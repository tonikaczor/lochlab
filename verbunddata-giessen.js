/* verbunddata-giessen.js - Verbundprojekt 4: Smarte Gartenbewässerung / Pumpensteuerung (Projektdefinition, Paket P4)
 * Format laut quelle/verbund/SPEC.md, Abschnitte 4 und 9.4. Lädt unabhängig von der Reihenfolge, auch in Node.
 * Registriert sich bei window.Verbund (registerProject); ist der Kern noch nicht da, wartet die Definition in window.VERBUND_QUEUE.
 * In Node liefert module.exports die Definition (def) selbst.
 * Benötigt zur Laufzeit der Prüfungen (alle rein rechnerisch, ohne Browser): dscore.js + dslib-semi.js, pcbcore.js, antcore.js,
 * spscore.js + spsplant-tank.js, arduino.js + pyrun.js über verbundrun.js (Verbund.runSketch / runPython). Die Hilfen für
 * Netzlisten (Union-Find, Platinen-Gleichwertigkeit) stehen bewusst privat in dieser Datei (wie in verbunddata-garage.js).
 *
 * Slot-Formate (Daten der Hülle), von den Adaptern zu liefern:
 *   haus.plan     { circuits:[{name, breaker:{type,inA}, rcd:{imaMa,type}, cable:{mm2,lenM}, socket:{ip}, loads:[{name,pW}]}], pAvailW, notes }
 *   ant.setup     { rig:'gleichstrom', preset, ctl:{motor,uSupply,duty,fPwm,load}, iNom, iStart, fPwm, state, derived:{qLpm,...} }
 *   ds.pick       { items:[{role:'mosfet'|'diode', ds, part, ref}], calc:{tjC, pSwMW}, vals:{} }
 *   sch.circuit   { lab, name, netlist, meas, snap }
 *   pcb.board     { board, report:{w,h,layers,drcErrors,drcWarns,unrouted,shorts,cost,bomCount} }
 *   mess.protocol { rows:[{id,label,unit,soll,ist,tol,instrument,tp}], values:{uSupLoaded}, findings:[text] }
 *   sen.chain     { rig:'normsignal', ctl:{signal,uSupply,rBurden,rLine,adcBits,lo,hi}, scale:{c0,c100,cBreak}, thr:{min,mid,max}, hyst, thrCounts, state, derived }
 *   code.sketch   { lang:'arduino', src, run:{serial:[Zeilen]} }
 *   pi.script     { lang:'python', src, out:[Zeilen] }   Kopfzeilen des Programms: daten, Q_LPM, V_BEET_L, DT_S, MIN_MM
 *   sps.program   { prog, plant:'tank', opts, lang }
 * Werte mit (A) sind Annahmen (Lehrwerte), siehe SPEC Abschnitt 8 und 13.3 sowie ABWEICHUNGEN.md (P4). */
(function (root) {
  'use strict';

  const PID = 'giess';
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
  const DS = () => root.DS_CORE, LIB = () => root.DS_LIB, PCB = () => root.PCB_CORE, ANT = () => root.ANT_CORE, SPS = () => root.SPS_CORE, PLANTS = () => root.SPS_PLANTS;
  function runners() {
    let V = root.Verbund;
    if (!(V && V.runSketch) && typeof require === 'function') { try { V = require('./verbundrun.js'); } catch (e) { V = null; } }
    return V && V.runSketch ? V : null;
  }
  function numOf(v) {                         // '4k7', '24V', '330', 4700 -> Zahl, sonst NaN
    if (fin(v)) return v;
    const s = String(v == null ? '' : v).trim();
    if (!s) return NaN;
    const d = DS();
    if (d && d.parseWithUnit) { const r = d.parseWithUnit(s); if (r && fin(r.value)) return r.value; }
    const m = /^(\d+(?:[.,]\d+)?)\s*([kKMm]?)/.exec(s);
    return m ? parseFloat(m[1].replace(',', '.')) * ({ k: 1e3, K: 1e3, M: 1e6, m: 1e-3 }[m[2]] || 1) : NaN;
  }
  const E12 = (root.ENORM || (function () { try { return typeof require === 'function' ? require('./enorm.js') : null; } catch (e) { return null; } })() || {}).E12;   // eine Quelle: enorm.js
  function isE(v, series) {
    const d = DS(); if (!d || !fin(v) || v <= 0) return false;
    const n = d.eSeries(series || 'E12', v, 'nearest');
    return fin(n) && Math.abs(n - v) <= 1e-6 * v;
  }

  /* ====================================================================== Fachwerte des Projekts (A = Annahme/Lehrwert) */
  const RHO = 1000, G = 9.81;                  // sicher: Wasserdichte und Fallbeschleunigung (SPEC Abschnitt 8)
  const PUMP = { K: 5e-7, eta: 0.3, iLimit: 10, fStart: 0.02, ri: 0.2, drop: 0.2 };   // (A) Verdrängung 0,5 ml je rad, Wirkungsgrad 0,3, Netzteil-Strombegrenzung 10 A (Prüfstand), Anlaufanteil 2 %, Netzteil-Innenwiderstand 0,2 Ω
  const FUSES = [0.5, 1, 1.6, 2, 2.5, 3.15, 4, 5, 6.3, 8, 10];
  const MOTOR_IDS = { antrieb24: 'antrieb24', getriebe12: 'gm12', gm12: 'gm12', modell: 'modell6', modell6: 'modell6' };
  const LS_MAX = { 0.75: 10, 1: 10, 1.5: 16, 2.5: 20, 4: 25, 6: 32 };       // größter zugeordneter Leitungsschutz je Querschnitt in A (1,5 mm² -> B16 üblich, übrige (A))
  const KAPPA = 56;                             // sicher: Kupfer in m/(Ω·mm²)
  const IO = [
    { key: 'I0.0', sym: 'S1_Start', text: 'Taster Start Gießen (Schließer)' },
    { key: 'I0.1', sym: 'S2_Stopp', text: 'Taster Stopp (Öffner, Ruhe = 1)' },
    { key: 'I0.2', sym: 'B1_Min', text: 'Füllstand min (ab Schwelle min)' },
    { key: 'I0.3', sym: 'B2_Mitte', text: 'Füllstand mitte (ab Schwelle mitte)' },
    { key: 'I0.4', sym: 'B3_Max', text: 'Füllstand max (ab Schwelle max)' },
    { key: 'I0.6', sym: 'S3_NotHalt', text: 'Not-Halt (Öffner, Ruhe = 1)' },
    { key: 'Q0.0', sym: 'Y1_Nachspeisen', text: 'Ventil Nachspeisen (Zulauf A)' },
    { key: 'Q0.4', sym: 'P1_Pumpe', text: 'Pumpe Gießen' },
    { key: 'Q0.5', sym: 'H1_Stoerung', text: 'Lampe Störung' }
  ];

  /* ====================================================================== Lastenheft */
  function lastenheft(seed, level) {
    level = level === 1 || level === 3 ? level : 2;
    const r = rng((seed >>> 0) ^ 0x3c6ef372);
    const qSoll = pick(r, level === 1 ? [4, 6] : [4, 6, 8]);
    const H = pick(r, level === 1 ? [3, 4] : [3, 4, 5]);
    const lenM = pick(r, level === 1 ? [10, 15] : [10, 15, 25]);
    const vBeetL = pick(r, level === 1 ? [20, 30] : [20, 30, 40]);
    const pMech = RHO * G * (qSoll / 60000) * H / PUMP.eta;
    const pAvailW = pMech <= 11 ? 40 : 60;
    const thr = level === 3 ? { min: pick(r, [10, 15, 20]), mid: 50, max: pick(r, [85, 90]) } : { min: 15, mid: 50, max: 90 };
    const fault = level === 3 ? pick(r, ['rgs', 'diodeRev']) : null;
    const p = {
      uSup: 24, pAvailW: pAvailW, lenM: lenM, qSoll: qSoll, H: H, etaP: PUMP.eta, pumpK: PUMP.K, tAmb: 40, vGate: 5,
      hTank: 1.0, tankL: 100, pSensMbar: 100, uMinLoop: 12, uRef: 5, adcBits: 10, rLine: 20, iLimit: PUMP.iLimit,
      vBeetL: vBeetL, thr: thr, fault: fault, boardW: 70, boardH: 45, layers: 2, cycleMs: 20
    };
    const text = [
      'Projekt Smarte Gartenbewässerung, Stufe ' + level + ' (' + (level === 1 ? 'Einsteiger' : level === 2 ? 'Standard' : 'Profi') + ').',
      'Außenanschluss: Gartenhaus, Zuleitung ' + p.lenM + ' m, Netzteil 230 V auf ' + p.uSup + ' V (A) mit ' + p.pAvailW + ' W (A). Außensteckdose mit Schutzeinrichtung.',
      'Pumpe: ' + p.qSoll + ' l/min bei ' + p.H + ' m Förderhöhe, Pumpenwirkungsgrad ' + fm(p.etaP, 1) + ' (A), Verdrängung ' + fm(p.pumpK * 1e6, 1) + ' ml je rad (A). Das Beet braucht ' + p.vBeetL + ' l.',
      'Motor: ' + p.uSup + ' V Gleichstrommotor aus dem Antriebs-Prüfstand, PWM-Ansteuerung, Netzteil begrenzt auf ' + p.iLimit + ' A (A). Umgebung ' + p.tAmb + ' °C (A).',
      'Treiber: Logikpegel ' + p.vGate + ' V, Low-Side-MOSFET mit Freilaufdiode. Platine höchstens ' + p.boardW + ' x ' + p.boardH + ' mm, ' + p.layers + ' Lagen.',
      'Füllstand: Regentonne ' + p.tankL + ' l (A) und ' + fm(p.hTank * 1000, 0) + ' mm hoch, hydrostatischer Sensor 0 bis ' + p.pSensMbar + ' mbar mit 4 bis 20 mA (A), Schleife aus dem Netzteil, Mindestspannung am Messumformer ' + p.uMinLoop + ' V (A). ADU ' + p.adcBits + ' Bit mit ' + p.uRef + ' V Referenz.',
      'Schaltpunkte Füllstand: min ' + p.thr.min + ' %, mitte ' + p.thr.mid + ' %, max ' + p.thr.max + ' % (A).'
    ];
    if (fault) text.push('Hinweis Inbetriebnahme: Der Messaufbau enthält einen eingebauten Fehler. Finde ihn.');
    return { params: p, text: text, io: IO.map(clone) };
  }

  /* ====================================================================== Netzlisten-Hilfen (privat) */
  const PINNAMES = { R: ['1', '2'], FUSE: ['1', '2'], MOTOR: ['1', '2'], SPST: ['1', '2'], D: ['A', 'K'], NMOS: ['G', 'D', 'S'], BAT: ['+', '-'] };
  const SRC_KINDS = { BAT: 1, SPST: 1, MOTOR: 1, GND: 1 };
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
  const pinKeys = p => (isObj(p.pins) && Object.keys(p.pins).length ? Object.keys(p.pins) : (PINNAMES[p.kind] || []).slice());
  const netOf = (ix, ref, pin) => ix.net[ref + '.' + pin];
  const ofKind = (ix, kinds) => Object.keys(ix.parts).map(k => ix.parts[k]).filter(p => kinds.split(',').indexOf(p.kind) >= 0);
  function batPins(p) { const k = pinKeys(p); const plus = k.find(x => /^\+|^p$|^1$/i.test(x)) || k[0] || '+'; const minus = k.find(x => x !== plus) || '-'; return { plus: plus, minus: minus }; }
  function supplyOf(ix, volt) {
    const bats = ofKind(ix, 'BAT').filter(b => Math.abs(numOf(b.value) - volt) <= 0.5);
    if (!bats.length) return null;
    const b = bats[0], bp = batPins(b);
    return { ref: b.ref, plusNet: netOf(ix, b.ref, bp.plus), minusNet: netOf(ix, b.ref, bp.minus) };
  }
  const refOf = ds => (ds ? String(ds.ref || ds.part || ds.id) : '');
  const valueIs = (value, ds) => { const a = lc(value).replace(/[\s-]/g, ''), b = lc(refOf(ds)).replace(/[\s-]/g, ''); return !!b && a.indexOf(b) >= 0; };
  function nlBuilder(name) {
    const parts = [], nets = {}, order = [];
    const b = {
      add(ref, kind, value, pins) {
        parts.push({ ref: ref, kind: kind, value: value == null ? '' : String(value), pins: Object.assign({}, pins) });
        Object.keys(pins).forEach(k => { const n = pins[k]; if (!nets[n]) { nets[n] = []; order.push(n); } nets[n].push(ref + '.' + k); });
        return b;
      },
      done() { return { v: 1, name: name, parts: parts, nets: order.map(n => ({ name: n, cls: /^(GND|VCC)$/.test(n) ? 'power' : 'signal', pins: nets[n].slice() })) }; }
    };
    return b;
  }
  function fmtR(v) { v = rd(v, 6); return v >= 1e6 ? String(rd(v / 1e6, 3)) + 'M' : v >= 1000 ? String(rd(v / 1000, 3)) + 'k' : String(rd(v, 3)); }
  const fmtRde = v => fmtR(v).replace('.', ',');
  const nextE12 = (v, up) => { const d = DS(); const n = d && d.eSeries ? d.eSeries('E12', v, up ? 'up' : 'nearest') : null; return fin(n) ? n : v; };

  /* ====================================================================== Datenblatt-Hilfen */
  const dsOf = id => { const l = LIB(); return l && l.byId ? l.byId[id] || null : null; };
  function dsRow(ds, key) { if (!ds) return null; const all = arr(ds.abs).concat(arr(ds.elec), arr(ds.rec)); return all.find(r => r.key === key) || null; }
  function dsVal(row, field) {
    if (!row || !fin(row[field == null ? 'max' : field])) return NaN;
    const d = DS(); const x = d && d.toSI ? d.toSI(row[field == null ? 'max' : field], row.unit) : row[field == null ? 'max' : field];
    return fin(x) ? x : NaN;
  }
  function pickInfo(pk) {
    const o = { ok: false, why: '', tr: null, di: null };
    if (!isObj(pk)) { o.why = 'Auswahl fehlt'; return o; }
    const items = arr(pk.items);
    const it = items.find(x => isObj(x) && (x.role === 'mosfet' || x.role === 'transistor')), id = items.find(x => isObj(x) && x.role === 'diode');
    o.tr = it ? dsOf(it.ds) : null; o.di = id ? dsOf(id.ds) : null;
    o.calc = isObj(pk.calc) ? pk.calc : {}; o.vals = isObj(pk.vals) ? pk.vals : {};
    o.ok = !!(o.tr && o.di);
    if (!o.tr) o.why = 'MOSFET nicht gewählt'; else if (!o.di) o.why = 'Diode nicht gewählt';
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
  function need(ctx, slot) {                    // Eingang: vorhandene Daten, sonst die Musterlösung der erzeugenden Station (Hub-/Testläufe)
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
  const kvOf = lines => {                       // KEY=Wert aus Zeilen oder Text
    const o = {}, ls = Array.isArray(lines) ? lines : String(lines == null ? '' : lines).split('\n');
    ls.forEach(l => { const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(String(l)); if (m) o[m[1]] = /^[-+]?\d+(?:[.,]\d+)?(?:[eE][-+]?\d+)?$/.test(m[2]) ? Number(m[2].replace(',', '.')) : m[2]; });
    return o;
  };

  /* ====================================================================== vw1: Außenanschluss planen (Haus-Lab) */
  const ETA_NT = 0.8;                           // (A) Netzteil-Wirkungsgrad einschließlich Leistungsfaktor für den Netzstrom
  function hausInfo(data, P) {
    const cs = arr(data && data.circuits).filter(isObj);
    const c = cs.find(x => /auß|auss|garten|steckdose|aussen/i.test(String(x.name))) || cs[0] || null;
    const o = { c: c, n: cs.length };
    if (!c) return o;
    const loads = arr(c.loads).filter(isObj), pW = loads.reduce((a, l) => a + (fin(+l.pW) ? +l.pW : 0), 0);
    o.pLoad = pW;
    o.iB = (pW > 0 ? pW : (fin(+data.pAvailW) ? +data.pAvailW : P.pAvailW)) / (230 * ETA_NT);
    o.mm2 = c.cable && fin(+c.cable.mm2) ? +c.cable.mm2 : NaN;
    o.len = c.cable && fin(+c.cable.lenM) ? +c.cable.lenM : NaN;
    o.dUpct = fin(o.mm2) && fin(o.len) ? 2 * o.len * o.iB / (KAPPA * o.mm2) / 230 * 100 : NaN;
    o.iZ = LS_MAX[o.mm2];
    return o;
  }
  function checkHaus(data, ctx) {
    const P = P_(ctx), lines = [], h = hausInfo(data, P), c = h.c;
    const rcd = c && isObj(c.rcd) ? c.rcd : null;
    const fiOk = !!rcd && lc(rcd.type) === 'a' && fin(+rcd.imaMa) && +rcd.imaMa > 0 && +rcd.imaMa <= 30;
    lines.push(L(fiOk, 'FI am Außenabgang: Typ A mit höchstens 30 mA' + (rcd ? ' (angegeben: Typ ' + String(rcd.type) + ', ' + fm(+rcd.imaMa, 0) + ' mA)' : ' – kein FI eingetragen'), 25));
    const br = c && isObj(c.breaker) ? c.breaker : null;
    const typeOk = br && ['b', 'c'].indexOf(lc(br.type)) >= 0, inA = br ? +br.inA : NaN;
    const lsOk = !!(c && typeOk && fin(inA) && fin(h.iZ) && inA >= h.iB && inA <= h.iZ);
    lines.push(L(lsOk, 'Leitungsschutz: I_N ' + (fin(inA) ? fm(inA, 0) + ' A' : 'fehlt') + ' mindestens Betriebsstrom ' + fm(h.iB, 2) + ' A und höchstens ' + (fin(h.iZ) ? fm(h.iZ, 0) + ' A (' + fm(h.mm2, 1) + ' mm²)' : 'Leitung unbekannt') + (br && !typeOk ? ' – Typ B oder C verlangt' : ''), 25));
    const ip = c && c.socket ? numOf(String(c.socket.ip).replace(/^ip/i, '')) : NaN;
    lines.push(L(fin(ip) && ip >= 44, 'Schutzart der Steckdose: IP' + (fin(ip) ? fm(ip, 0) : '?') + ', verlangt mindestens IP44 (Außenbereich)', 15));
    const lenOk = fin(h.len) && Math.abs(h.len - P.lenM) <= 0.5;
    lines.push(L(lenOk && fin(h.dUpct) && h.dUpct <= 3, 'Spannungsfall über ' + (fin(h.len) ? fm(h.len, 0) : '?') + ' m Leitung (Lastenheft ' + P.lenM + ' m): ' + (fin(h.dUpct) ? fm(h.dUpct, 2) + ' %' : 'nicht berechenbar') + ', erlaubt höchstens 3 %' + (lenOk ? '' : ' – Leitungslänge weicht vom Lastenheft ab'), 15));
    const pa = data && fin(+data.pAvailW) ? +data.pAvailW : NaN;
    lines.push(L(fin(pa) && Math.abs(pa - P.pAvailW) <= 1 && (!(h.pLoad > 0) || h.pLoad <= pa + 1e-9), 'Leistungsbudget: Netzteil ' + (fin(pa) ? fm(pa, 0) + ' W' : 'fehlt') + ' (Lastenheft ' + P.pAvailW + ' W), angeschlossene Lasten ' + fm(h.pLoad || 0, 0) + ' W', 20));
    return lines;
  }
  function hausSolution(ctx) {
    const P = P_(ctx);
    return { circuits: [{ name: 'Außenabgang Garten', breaker: { type: 'B', inA: 16 }, rcd: { imaMa: 30, type: 'A' }, cable: { mm2: 1.5, lenM: P.lenM },
      socket: { ip: 44 }, loads: [{ name: 'Netzteil Bewässerung', pW: P.pAvailW }] }], pAvailW: P.pAvailW, notes: 'Außensteckdose IP44 hinter FI Typ A 30 mA, B16 auf 1,5 mm².' };
  }

  /* ====================================================================== vw2: Pumpe auslegen (Antriebs-Lab) */
  const antCache = new Map();
  function pumpDerive(ant, ctx, withTemp) {
    const P = P_(ctx), A = ANT(), o = { ok: false, errs: [] };
    if (!isObj(ant) || !A) { o.errs.push('keine Antriebsdaten'); return o; }
    const ctl = isObj(ant.ctl) ? ant.ctl : {};
    const mid = MOTOR_IDS[ctl.motor || ant.preset], preset = mid && A.dcPresets && A.dcPresets[mid];
    if (!preset) { o.errs.push('Motor „' + (ctl.motor || ant.preset) + '“ unbekannt'); return o; }
    const uS = +ctl.uSupply, duty = +ctl.duty;
    if (!fin(uS) || uS <= 0 || !fin(duty) || duty < 0 || duty > 100) { o.errs.push('Versorgungsspannung oder Tastgrad fehlen'); return o; }
    const key = JSON.stringify([mid, uS, duty, P.H, PUMP.K]);
    let r = antCache.get(key);
    if (!r || (withTemp && !fin(r.tempMax))) {
      const mP = RHO * G * P.H * PUMP.K / PUMP.eta, u = A.pwmAverage(duty / 100, uS, PUMP.drop);
      const m = A.dcMotor(Object.assign({}, preset.params, { Jload: 0, thermFactor: 1 }));
      let st = null; for (let t = 0; t < 1500; t += 2) st = m.step(2, { u: u, load: mP });
      let temp = NaN;
      if (withTemp) { temp = st.temp; for (let t = 0; t < 600000; t += 500) temp = Math.max(temp, m.step(500, { u: u, load: mP }).temp); }   // zehn Minuten Gießen
      const mn = A.dcMotor(Object.assign({}, preset.params, { Jload: 0, thermFactor: 1 })); let sn = null;
      for (let t = 0; t < 800; t += 2) sn = mn.step(2, { u: preset.nominal.u, load: preset.nominal.load });
      const ra = preset.params.Ra;
      r = { mPump: mP, uMean: u, rpm: st.rpm, w: st.w, qLpm: PUMP.K * st.w * 60000, pEl: u * st.i, iNom: st.i, iN: sn.i, tempMax: temp, iStart: Math.min(u / ra, PUMP.iLimit), duty: duty, uSupply: uS, tempLimit: preset.params.tempMax || 130 };
      if (antCache.size > 400) antCache.clear();
      antCache.set(key, r);
    }
    return Object.assign({ ok: true, errs: [] }, r, { fPwm: fPwmOf(ant) });
  }
  function fPwmOf(ant) { const c = isObj(ant && ant.ctl) ? ant.ctl : {}, v = [ant && ant.fPwm, c.fPwm, c.freq].find(x => fin(+x) && x !== null && x !== ''); return v === undefined ? NaN : +v; }
  const antField = (a, k) => (isObj(a) ? (fin(+a[k]) && a[k] !== null ? +a[k] : (isObj(a.derived) && fin(+a.derived[k]) && a.derived[k] !== null ? +a.derived[k] : NaN)) : NaN);
  function checkAnt(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], d = pumpDerive(data, ctx, true), ok = d.ok;
    const dev = ok ? Math.abs(d.qLpm - P.qSoll) / P.qSoll : NaN;
    lines.push(L(ok && dev <= 0.10 * tol, 'Förderstrom Q = k · ω (Q ∝ n): ' + (ok ? fm(d.qLpm, 2) + ' l/min bei ' + fm(d.rpm, 0) + ' 1/min' : 'nicht berechenbar (' + (d.errs[0] || '?') + ')') + ', verlangt ' + fm(P.qSoll, 1) + ' l/min (±' + fm(10 * tol, 0) + ' %)', 30));
    const hp = slotOf(ctx, 'giess.haus'), pAv = hp && fin(+hp.pAvailW) ? +hp.pAvailW : P.pAvailW;
    lines.push(L(ok && d.pEl <= 0.8 * pAv, 'Elektrische Leistung P_el = U · I: ' + (ok ? fm(d.pEl, 1) + ' W' : '?') + ', höchstens 80 % von ' + fm(pAv, 0) + ' W = ' + fm(0.8 * pAv, 1) + ' W', 25));
    const uOk = ok && Math.abs(+data.ctl.uSupply - P.uSup) <= 0.01;
    lines.push(L(ok && uOk && d.iNom <= d.iN * (1 + 1e-9) && d.tempMax <= d.tempLimit, 'Motor im Nennbereich: Strom ' + (ok ? fm(d.iNom, 2) : '?') + ' A (Nennstrom ' + (ok ? fm(d.iN, 2) : '?') + ' A), Wicklung höchstens ' + (ok ? fm(d.tempMax, 0) : '?') + ' °C nach zehn Minuten (Grenze ' + (ok ? fm(d.tempLimit, 0) : '?') + ' °C)' + (ok && !uOk ? ' – Versorgung muss ' + P.uSup + ' V sein' : ''), 20));
    const sNom = antField(data, 'iNom'), sSt = antField(data, 'iStart');
    const nOk = ok && fin(sNom) && fin(sSt) && Math.abs(sNom - d.iNom) <= Math.max(0.1 * d.iNom, 0.05) && Math.abs(sSt - d.iStart) <= Math.max(0.1 * d.iStart, 0.2);
    lines.push(L(nOk, 'Strom im Slot: iNom ' + (fin(sNom) ? fm(sNom, 2) : 'fehlt') + ' A (gerechnet ' + (ok ? fm(d.iNom, 2) : '?') + ' A), iStart ' + (fin(sSt) ? fm(sSt, 1) : 'fehlt') + ' A (gerechnet ' + (ok ? fm(d.iStart, 1) : '?') + ' A, Netzteil begrenzt auf ' + P.iLimit + ' A)', 15));
    const f = fPwmOf(data);
    lines.push(L(fin(f) && f >= 1000 && f <= 20000, 'PWM-Frequenz ' + (fin(f) ? fm(f, 0) + ' Hz' : 'fehlt') + ' (zwischen 1 und 20 kHz, A: darunter pfeift der Motor, darüber steigen die Schaltverluste)', 10));
    return lines;
  }
  function antSolution(ctx) {
    const P = P_(ctx), key = 'sol' + [P.qSoll, P.H, P.uSup].join('/');
    if (!antSolution.memo) antSolution.memo = {};
    if (!antSolution.memo[key]) {
      let lo = 5, hi = 100;
      const q = d => pumpDerive({ ctl: { motor: 'antrieb24', uSupply: P.uSup, duty: d } }, { spec: { params: P } }).qLpm;
      for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (q(mid) < P.qSoll) lo = mid; else hi = mid; }
      antSolution.memo[key] = rd(hi, 1);
    }
    const data = { rig: 'gleichstrom', preset: 'antrieb24', ctl: { motor: 'antrieb24', uSupply: P.uSup, duty: antSolution.memo[key], fPwm: 5000, dir: 'vor', loadType: 'bremse', load: 0 }, fPwm: 5000, state: {}, derived: {} };
    const d = pumpDerive(data, { spec: { params: P } }, true);
    data.ctl.load = rd(d.mPump, 4);
    data.iNom = rd(d.iNom, 3); data.iStart = rd(d.iStart, 2);
    data.state = { rpm: rd(d.rpm, 0), i: rd(d.iNom, 3), temp: rd(d.tempMax, 1) };
    data.derived = { qLpm: rd(d.qLpm, 3), pEl: rd(d.pEl, 2), uMean: rd(d.uMean, 2), iNom: data.iNom, iStart: data.iStart };
    return data;
  }

  /* ====================================================================== vw3: MOSFET und Diode wählen (Datenblatt-Lab) */
  function fetCalc(pi, P, an) {
    const o = { ok: false };
    if (!pi.tr || !an || !an.ok) return o;
    const row = dsRow(pi.tr, 'rds45') || dsRow(pi.tr, 'rds10'), rds = row ? dsVal(row, 'max') : NaN;
    const th = isObj(pi.tr.thermal) ? pi.tr.thermal : {};
    const tr = dsVal(dsRow(pi.tr, 'tr') || dsRow(pi.tr, 'ton'), 'typ'), tf = dsVal(dsRow(pi.tr, 'tf') || dsRow(pi.tr, 'toff'), 'typ');
    if (!fin(rds) || !fin(th.rthJA) || !fin(th.tjMax)) return o;
    o.rdsHot = rds * 1.65;                       // Datenblatt: bei 125 °C etwa 1,65-facher Wert
    o.pCond = an.iNom * an.iNom * o.rdsHot;
    o.pSw = fin(tr) && fin(tf) && fin(an.fPwm) ? 0.5 * an.uSupply * an.iNom * (tr + tf) * an.fPwm : NaN;
    o.tj = P.tAmb + (o.pCond + (fin(o.pSw) ? o.pSw : 0)) * th.rthJA;
    o.tjLimit = th.tjMax - 20; o.rth = th.rthJA; o.tjMax = th.tjMax;
    o.ok = true;
    return o;
  }
  function checkDs(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], pi = pickInfo(data), an = pumpDerive(need(ctx, 'giess.ant'), ctx);
    const tr = pi.tr, di = pi.di, isMos = !!tr && tr.family === 'MOSFET';
    const vth = tr ? dsVal(dsRow(tr, 'vgsth'), 'max') : NaN, rrow = tr ? (dsRow(tr, 'rds45')) : null;
    lines.push(L(isMos && fin(vth) && vth <= P.vGate - 1 && !!rrow, 'Logic-Level: ' + (isMos ? 'V_GS(th),max ' + fm(vth, 1) + ' V (höchstens ' + fm(P.vGate - 1, 1) + ' V bei ' + P.vGate + ' V Ansteuerung)' + (rrow ? ', R_DS(on)-Zeile bei 4,5 V vorhanden' : ' – keine R_DS(on)-Zeile bei 4,5 V') : 'kein MOSFET gewählt'), 25));
    const idm = tr ? (dsVal(dsRow(tr, 'id100'), 'max') || dsVal(dsRow(tr, 'id'), 'max') || dsVal(dsRow(tr, 'id25'), 'max')) : NaN, vds = tr ? dsVal(dsRow(tr, 'vds'), 'max') : NaN;
    const iS = an.ok ? an.iStart : NaN;
    lines.push(L(isMos && fin(idm) && fin(iS) && idm >= 2 * iS && vds >= 2 * P.uSup, 'Strom und Spannung: I_D ' + (fin(idm) ? fm(idm, 1) : '?') + ' A (nötig mindestens 2 · iStart = ' + (fin(iS) ? fm(2 * iS, 1) : '?') + ' A), V_DS ' + (fin(vds) ? fm(vds, 0) : '?') + ' V (nötig mindestens ' + fm(2 * P.uSup, 0) + ' V)', 20));
    const fc = fetCalc(pi, P, an), stj = fin(+pi.calc.tjC) ? +pi.calc.tjC : NaN;
    const tjOk = fc.ok && fc.tj <= fc.tjLimit && fin(stj) && Math.abs(stj - fc.tj) <= Math.max(4, 0.08 * fc.tj) * tol;
    lines.push(L(tjOk, 'Durchlassverluste und Sperrschichttemperatur ohne Kühlkörper: ' + (fc.ok ? 'P = iNom² · R_DS(on),warm = ' + fm(fc.pCond * 1000, 0) + ' mW, T_j = ' + fm(fc.tj, 0) + ' °C (höchstens ' + fm(fc.tjLimit, 0) + ' °C, T_jmax − 20 K)' : 'nicht berechenbar') + ', deine Rechnung ' + (fin(stj) ? fm(stj, 0) + ' °C' : 'fehlt'), 25));
    const spw = fin(+pi.calc.pSwMW) ? +pi.calc.pSwMW / 1000 : NaN;
    const swOk = fc.ok && fin(fc.pSw) && fin(spw) && Math.abs(spw - fc.pSw) <= Math.max(0.4 * fc.pSw * tol, 0.003);
    lines.push(L(swOk, 'Schaltverluste P_sw = ½ · U · I · (t_r + t_f) · f_PWM: ' + (fc.ok && fin(fc.pSw) ? fm(fc.pSw * 1000, 1) + ' mW' : 'nicht berechenbar') + ', deine Rechnung ' + (fin(spw) ? fm(spw * 1000, 1) + ' mW' : 'fehlt'), 15));
    const vrrm = di ? dsVal(dsRow(di, 'vrrm'), 'max') : NaN, ifm = di ? (dsVal(dsRow(di, 'ifav'), 'max') || dsVal(dsRow(di, 'if'), 'max')) : NaN, trr = di ? dsVal(dsRow(di, 'trr'), 'typ') : NaN;
    const iDi = an.ok ? an.iNom * (1 - an.duty / 100) : NaN, fP = an.ok && fin(an.fPwm) ? an.fPwm : 5000;
    lines.push(L(!!di && di.family === 'Diode' && fin(vrrm) && fin(ifm) && fin(iDi) && vrrm >= 2 * P.uSup && ifm >= iDi && (!fin(trr) || trr <= 0.05 / fP), 'Freilaufdiode: V_RRM ' + (fin(vrrm) ? fm(vrrm, 0) : '?') + ' V (mindestens ' + fm(2 * P.uSup, 0) + ' V), I_F ' + (fin(ifm) ? fm(ifm, 2) : '?') + ' A (mindestens ' + (fin(iDi) ? fm(iDi, 2) : '?') + ' A, nur in der Aus-Phase), Erholzeit ' + (fin(trr) ? fm(trr * 1e6, 3) + ' µs' : '?') + (di && !fin(vrrm) ? ' – das ist keine Diode mit V_RRM (Z-Diode?)' : ''), 15));
    return lines;
  }
  function dsSolution(ctx) {
    const P = P_(ctx), pi = pickInfo({ items: [{ role: 'mosfet', ds: 'tf-irlz' }, { role: 'diode', ds: 'tf-1n4007' }] }), an = pumpDerive(need(ctx, 'giess.ant'), ctx), fc = fetCalc(pi, P, an);
    return { items: [{ role: 'mosfet', ds: 'tf-irlz', part: 'TF-IRLZ34', ref: 'IRLZ34N' }, { role: 'diode', ds: 'tf-1n4007', part: 'TF-1N4007', ref: '1N4007' }],
      calc: { tjC: rd(fc.tj, 1), pSwMW: rd(fc.pSw * 1000, 2), pCondMW: rd(fc.pCond * 1000, 1), rdsHot: rd(fc.rdsHot, 4) }, vals: {} };
  }

  /* ====================================================================== vw4: Pumpentreiber zeichnen (SchaltLab) */
  function findDriver(ix, P) {
    const o = { ok: false, errs: [] }, qs = ofKind(ix, 'NMOS');
    if (!qs.length) { o.errs.push('kein N-MOSFET in der Schaltung'); return o; }
    const q = qs[0]; o.q = q;
    const m = ofKind(ix, 'MOTOR')[0];
    if (!m) o.errs.push('kein Motor in der Schaltung');
    const sup = supplyOf(ix, P.uSup);
    if (!sup) o.errs.push('keine ' + fm(P.uSup, 0) + '-V-Quelle in der Schaltung');
    const nG = netOf(ix, q.ref, 'G'), nD = netOf(ix, q.ref, 'D'), nS = netOf(ix, q.ref, 'S');
    o.nG = nG; o.nD = nD; o.nS = nS;
    if (sup) { o.vcc = sup.plusNet; o.gnd = sup.minusNet; if (nS !== sup.minusNet) o.errs.push('die Source liegt nicht an Masse'); }
    // Motor: ein Anschluss am Drain, der andere (über die Sicherung) an +U
    let nM = null;
    if (m) {
      const a = netOf(ix, m.ref, '1'), b = netOf(ix, m.ref, '2');
      if (a === nD) nM = b; else if (b === nD) nM = a;
      if (nM === null) o.errs.push('der Motor liegt nicht am Drain des MOSFET');
      o.nM = nM;
    }
    const fuse = ofKind(ix, 'FUSE')[0];
    o.fuse = fuse || null;
    if (sup && nM !== null) {
      let direct = nM === sup.plusNet;
      if (!direct && fuse) { const a = netOf(ix, fuse.ref, '1'), b = netOf(ix, fuse.ref, '2'); direct = (a === nM && b === sup.plusNet) || (b === nM && a === sup.plusNet); }
      o.motorSupplyOk = direct;
      if (!direct) o.errs.push('der Motor liegt nicht (über die Sicherung) an +' + fm(P.uSup, 0) + ' V');
    }
    // Freilaufdiode antiparallel zum Motor: Anode Drain, Kathode Motor-Plus
    const dd = ofKind(ix, 'D');
    o.dio = dd.find(x => { const a = netOf(ix, x.ref, 'A'), k = netOf(ix, x.ref, 'K'); return nM !== null && ((a === nD && k === nM) || (k === nD && a === nM)); }) || null;
    if (!o.dio) o.errs.push('keine Freilaufdiode antiparallel zum Motor');
    else { o.diodeRev = !(netOf(ix, o.dio.ref, 'A') === nD && netOf(ix, o.dio.ref, 'K') === nM); if (o.diodeRev) o.errs.push('die Freilaufdiode ist verpolt (Anode an den Drain, Kathode an +' + fm(P.uSup, 0) + ' V)'); }
    // Pulldown zwischen Gate und Masse, Gatewiderstand vom Eingang zum Gate
    const rs = ofKind(ix, 'R');
    o.rgs = sup ? rs.find(x => { const a = netOf(ix, x.ref, '1'), b = netOf(ix, x.ref, '2'); return (a === nG && b === sup.minusNet) || (b === nG && a === sup.minusNet); }) || null : null;
    if (!o.rgs) o.errs.push('kein Pulldown-Widerstand zwischen Gate und Masse');
    o.rg = rs.find(x => x !== o.rgs && (netOf(ix, x.ref, '1') === nG || netOf(ix, x.ref, '2') === nG)) || null;
    if (!o.rg) o.errs.push('kein Gate-Widerstand am Gate');
    else {
      o.nIn = netOf(ix, o.rg.ref, '1') === nG ? netOf(ix, o.rg.ref, '2') : netOf(ix, o.rg.ref, '1');
      const sw = ofKind(ix, 'SPST').find(x => pinKeys(x).some(k => netOf(ix, x.ref, k) === o.nIn)), v5 = ofKind(ix, 'BAT').find(b => Math.abs(numOf(b.value) - P.vGate) <= 0.3);
      if (!(sw && v5)) o.errs.push('der Eingang IN ist keine ' + fm(P.vGate, 0) + '-V-Quelle mit Schalter am Gate-Widerstand');
    }
    o.ok = o.errs.length === 0;
    return o;
  }
  function buildSch(P, pk, an) {
    const pi = pickInfo(pk), b = nlBuilder('Pumpentreiber Bewässerung');
    const fuseA = FUSES.find(f => f >= 1.5 * an.iNom) || 10;
    const rds = dsVal(dsRow(pi.tr, 'rds5') || dsRow(pi.tr, 'rds45'), 'typ') || 0.04;
    b.add('V1', 'BAT', String(P.uSup), { '+': 'VCC', '-': 'GND' });
    b.add('V2', 'BAT', String(P.vGate), { '+': 'N_V2', '-': 'GND' });
    b.add('S1', 'SPST', '', { '1': 'N_V2', '2': 'IN' });
    b.add('R1', 'R', fmtR(100), { '1': 'IN', '2': 'N_G' });
    b.add('R2', 'R', fmtR(10000), { '1': 'N_G', '2': 'GND' });
    b.add('Q1', 'NMOS', refOf(pi.tr), { G: 'N_G', D: 'N_D', S: 'GND' });
    b.add('F1', 'FUSE', String(fuseA), { '1': 'VCC', '2': 'N_M' });
    b.add('M1', 'MOTOR', 'Pumpe', { '1': 'N_M', '2': 'N_D' });
    b.add('D1', 'D', refOf(pi.di), { A: 'N_D', K: 'N_M' });
    const reqEq = an.uMean / Math.max(an.iNom, 1e-6), iOn = P.uSup / (reqEq + rds), udsOn = iOn * rds;
    return { lab: 'sch', name: 'Pumpentreiber Bewässerung', netlist: b.done(),
      meas: { I_on_A: rd(iOn, 3), I_mean_A: rd(an.duty / 100 * iOn, 3), U_DS_on_V: rd(udsOn, 4), I_off_mA: 0 }, snap: {} };
  }
  function checkSch(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], pi = pickInfo(need(ctx, 'giess.ds')), an = pumpDerive(need(ctx, 'giess.ant'), ctx);
    const ix = nlIdx(data && data.netlist);
    const d = ix.ok ? findDriver(ix, P) : { ok: false, errs: ['keine Schaltung (Netzliste leer)'] };
    const e1 = [];
    if (!pi.ok) e1.push('die Auswahl der Datenblatt-Station fehlt');
    else {
      if (!d.q || !valueIs(d.q.value, pi.tr)) e1.push('MOSFET ' + (d.q ? '„' + d.q.value + '“' : 'fehlt') + ' statt ' + refOf(pi.tr));
      if (!d.dio || !valueIs(d.dio.value, pi.di)) e1.push('Diode ' + (d.dio ? '„' + d.dio.value + '“' : 'fehlt') + ' statt ' + refOf(pi.di));
    }
    lines.push(L(e1.length === 0, 'Bauteile entsprechen der Auswahl (MOSFET ' + (pi.tr ? refOf(pi.tr) : '?') + ', Diode ' + (pi.di ? refOf(pi.di) : '?') + ')' + (e1.length ? ' – ' + e1[0] : ''), 20));
    lines.push(L(d.ok, 'Topologie: Motor zwischen +' + fm(P.uSup, 0) + ' V (Sicherung) und Drain, Source an Masse, Freilaufdiode antiparallel, Pulldown am Gate' + (d.errs.length ? ' – ' + d.errs[0] : ''), 30));
    const fz = d.fuse ? numOf(d.fuse.value) : NaN;
    lines.push(L(fin(fz) && an.ok && fz >= 1.5 * an.iNom && fz <= P.iLimit, 'Sicherung ' + (fin(fz) ? fm(fz, 2) + ' A' : 'fehlt') + ': mindestens 1,5 · iNom = ' + (an.ok ? fm(1.5 * an.iNom, 2) : '?') + ' A (A), höchstens ' + P.iLimit + ' A', 10));
    const usable = !!(d.q && d.nD && d.nM !== undefined && d.motorSupplyOk && an.ok);
    let iOn = NaN, iMean = NaN, udsOn = NaN;
    if (usable) {
      const rds = dsVal(dsRow(pi.tr, 'rds5') || dsRow(pi.tr, 'rds45'), 'typ') || 0.04, rEq = an.uMean / an.iNom;
      iOn = P.uSup / (rEq + rds); iMean = an.duty / 100 * iOn; udsOn = iOn * rds;
    }
    const dI = fin(iMean) ? Math.abs(iMean - an.iNom) / an.iNom : NaN;
    lines.push(L(usable && d.ok && dI <= 0.2 * tol, 'Simulation bei Gate = ' + fm(P.vGate, 0) + ' V und Tastgrad ' + (an.ok ? fm(an.duty, 0) : '?') + ' %: mittlerer Motorstrom ' + (fin(iMean) ? fm(iMean, 2) : '?') + ' A, erwartet iNom ' + (an.ok ? fm(an.iNom, 2) : '?') + ' A (±' + fm(20 * tol, 0) + ' %)' + (usable ? '' : ' – Schaltung nicht auswertbar'), 15));
    lines.push(L(usable && !!d.rgs && !d.diodeRev, 'Simulation bei Gate = 0 V: der Pulldown hält das Gate auf Masse, der Motor ist aus (Strom unter 1 mA)' + (d.rgs ? '' : ' – ohne Pulldown schwebt das Gate'), 10));
    lines.push(L(fin(udsOn) && udsOn < 0.5, 'Simulation: Spannungsabfall am durchgeschalteten MOSFET ' + (fin(udsOn) ? fm(udsOn * 1000, 0) + ' mV' : '?') + ' (unter 500 mV)', 5));
    const rgv = d.rg ? numOf(d.rg.value) : NaN, rsv = d.rgs ? numOf(d.rgs.value) : NaN;
    lines.push(L(isE(rgv, 'E12') && rgv >= 10 && rgv <= 1000 && isE(rsv, 'E12') && rsv >= 4700, 'Gate-Widerstand ' + (fin(rgv) ? fmtRde(rgv) + ' Ω' : 'fehlt') + ' (E12, 10 Ω bis 1 kΩ) und Pulldown ' + (fin(rsv) ? fmtRde(rsv) + ' Ω' : 'fehlt') + ' (E12, mindestens 4,7 kΩ)', 10));
    return lines;
  }
  function schSolution(ctx) { return buildSch(P_(ctx), need(ctx, 'giess.ds'), pumpDerive(need(ctx, 'giess.ant'), ctx)); }

  /* ====================================================================== vw5: Leistungsplatine (Leiterplatten-Lab) */
  const FPMAP = {
    R: { maps: [{ '1': '1', '2': '2' }] },
    D: { maps: [{ A: '2', K: '1' }] },
    FUSE: { maps: [{ '1': '1', '2': '2' }] }
  };
  function fpmapOf(part) {                      // Pad-Zuordnung je Bauteil (MOSFET: TO-220 für Leistungstypen, TO-92 für 2N7000)
    if (part.kind === 'NMOS') return /7000/.test(String(part.value)) ? { maps: [{ S: '1', G: '2', D: '3' }, { D: '1', G: '2', S: '3' }], fp: 'TO-92' } : { maps: [{ G: '1', D: '2', S: '3' }], fp: 'TO-220' };
    return FPMAP[part.kind] || null;
  }
  const fpExists = id => { const c = PCB(); return !!(c && c.footprint && c.footprint(id)); };
  const isTerm = p => isObj(p) && /^X\d/i.test(String(p.ref || ''));
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
  function expectedNets(ixs, board) {
    const bparts = {}; arr(board && board.parts).forEach(p => { if (isObj(p)) bparts[p.ref] = p; });
    const missing = [], wrongFp = [], nets = [];
    Object.keys(ixs.nets).forEach(name => {
      const pads = [], flags = { ext: false };
      ixs.nets[name].forEach(pin => {
        const dot = pin.indexOf('.'), ref = pin.slice(0, dot), pn = pin.slice(dot + 1), part = ixs.parts[ref];
        if (!part) return;
        if (SRC_KINDS[part.kind]) { flags.ext = true; return; }
        const fmap = fpmapOf(part);
        if (!fmap) return;
        if (!bparts[ref]) { if (missing.indexOf(ref) < 0) missing.push(ref); return; }
        if (fmap.fp && bparts[ref].fp !== fmap.fp && wrongFp.indexOf(ref) < 0) wrongFp.push(ref);
        const map = fmap.maps[0];
        if (map[pn] !== undefined) pads.push(ref + '.' + map[pn]);
      });
      if (pads.length) nets.push({ name: name, pads: pads, ext: flags.ext });
    });
    return { nets: nets, missing: missing, wrongFp: wrongFp };
  }
  function boardEquiv(ixs, board) {
    const bnet = {}; arr(board.nets).forEach(n => { if (isObj(n)) arr(n.pins).forEach(p => { if (bnet[String(p)] === undefined) bnet[String(p)] = n.name; }); });
    const terms = arr(board.parts).filter(isTerm), termPads = [];
    if (terms.length && PCB()) { PCB().padsOf(board).forEach(p => { if (terms.some(t => t.ref === p.ref)) termPads.push(p.id); }); }
    const ex = expectedNets(ixs, board), viol = [];
    ex.missing.forEach(r => viol.push('Bauteil ' + r + ' fehlt auf der Platine'));
    ex.wrongFp.forEach(r => viol.push('Bauteil ' + r + ' hat nicht das passende Gehäuse'));
    const seen = {};
    ex.nets.forEach(n => {
      const names = n.pads.map(p => bnet[p]), none = n.pads.filter((p, i) => names[i] === undefined);
      if (none.length === n.pads.length && n.pads.length === 1 && !n.ext) return;
      if (none.length) { viol.push('Pad ' + none[0] + ' (Netz ' + n.name + ') ist keinem Netz zugeordnet'); return; }
      const first = names[0], diff = n.pads.find((p, i) => names[i] !== first);
      if (diff) { viol.push(n.pads[0] + ' und ' + diff + ' müssen im gleichen Netz liegen (' + n.name + ')'); return; }
      if (seen[first]) viol.push('die Netze ' + seen[first] + ' und ' + n.name + ' sind auf der Platine verbunden'); else seen[first] = n.name;
      n.bname = first;
      if (n.ext && !termPads.some(tp => bnet[tp] === first)) viol.push('Netz ' + n.name + ' hat keine Anschlussklemme');
    });
    const good = {}; ex.nets.forEach(n => { if (n.ext && n.bname !== undefined) good[n.bname] = 1; });
    termPads.forEach(tp => { if (bnet[tp] === undefined) viol.push('Klemmenpin ' + tp + ' ist nirgends angeschlossen'); else if (!good[bnet[tp]]) viol.push('Klemmenpin ' + tp + ' hängt an keinem Anschlussnetz der Schaltung'); });
    return { viol: viol, nets: ex.nets, bnet: bnet, termPads: termPads };
  }
  function courtyardRect(board, part) {
    const c = PCB(), fp = c.footprint(part.fp);
    if (!fp || !fp.courtyard) return null;
    const cy = fp.courtyard, xs = [], ys = [];
    [[cy.x, cy.y], [cy.x + cy.w, cy.y], [cy.x, cy.y + cy.h], [cy.x + cy.w, cy.y + cy.h]].forEach(pt => { const q = c.xform(part, pt[0], pt[1]); xs.push(q[0]); ys.push(q[1]); });
    return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys) };
  }
  const polyArea = poly => { let a = 0; arr(poly).forEach((p, i, l) => { const q = l[(i + 1) % l.length]; a += p[0] * q[1] - q[0] * p[1]; }); return Math.abs(a) / 2; };
  function checkPcb(data, ctx) {
    const P = P_(ctx), lines = [];
    const sch = need(ctx, 'giess.sch'), ixs = nlIdx(sch && sch.netlist), an = pumpDerive(need(ctx, 'giess.ant'), ctx);
    const board = asBoard(data && data.board);
    if (!board || !ixs.ok || !PCB()) return [L(false, 'Platine oder Schaltplan fehlt, die Platine lässt sich nicht prüfen', 100)];
    const norm = PCB().normalize(board), st = boardStats(norm), eq = boardEquiv(ixs, norm), nParts = arr(norm.parts).length;
    lines.push(L(nParts > 0 && eq.viol.length === 0, 'Netze der Platine identisch zur Netzliste (jeder Pin im richtigen Netz, Klemmen für ' + fm(P.uSup, 0) + ' V, IN und Motor)' + (eq.viol.length ? ' – ' + eq.viol[0] + (eq.viol.length > 1 ? ' (+' + (eq.viol.length - 1) + ' weitere)' : '') : ''), 20));
    const needNets = eq.nets.filter(n => n.pads.length >= 2 || n.ext).length;
    lines.push(L(nParts > 0 && st.unrouted === 0 && arr(norm.nets).length >= needNets && needNets > 0, 'Alle Netze verlegt: offene Verbindungen ' + st.unrouted + (arr(norm.nets).length < needNets ? ', es fehlen Netze auf der Platine' : ''), 15));
    lines.push(L(nParts > 0 && st.errs.length === 0, 'DRC ohne Fehler: ' + st.errs.length + ' Fehler' + (st.errs.length ? ' (' + String(st.errs[0].msg).slice(0, 60) + ')' : '') + (nParts ? '' : ' – die Platine ist leer'), 15));
    // Motorpfad: Netze, an denen Drain, Diode oder Sicherung hängen
    const drv = findDriver(ixs, P), pathNets = [];
    [drv.vcc, drv.nM, drv.nD].forEach(n => { const e = eq.nets.find(x => x.name === n); if (e && e.bname !== undefined && pathNets.indexOf(e.bname) < 0) pathNets.push(e.bname); });
    const iDim = an.ok ? Math.sqrt(an.iNom * an.iNom + PUMP.fStart * an.iStart * an.iStart) : NaN;
    const need_ = fin(iDim) ? Math.max(PCB().ipcWidth(iDim, { oz: norm.copperOz || 1, rise: 10 }), 0.3) : NaN;
    let minW = Infinity, nTr = 0;
    arr(norm.tracks).forEach(t => { const nm = st.conn.itemNet && st.conn.itemNet[t.id] || t.net; if (pathNets.indexOf(nm) >= 0) { nTr++; minW = Math.min(minW, +t.w || 0); } });
    lines.push(L(nTr > 0 && fin(need_) && minW >= need_ - 1e-9, 'Motorpfad: Bahnbreite mindestens ' + fm(need_, 2) + ' mm (IPC-2221 für ' + fm(iDim, 2) + ' A Effektivstrom aus iNom ' + (an.ok ? fm(an.iNom, 2) : '?') + ' A und Anlauf iStart ' + (an.ok ? fm(an.iStart, 0) : '?') + ' A, A: Anlaufanteil 2 %, 10 K)' + (nTr ? ', schmalste ' + fm(minW, 2) + ' mm' : ' – keine Leiterbahnen auf den Motornetzen'), 25));
    const drainNet = (eq.nets.find(x => x.name === drv.nD) || {}).bname;
    let cu = 0;
    arr(norm.zones).forEach(z => { if (isObj(z) && z.net === drainNet) cu += polyArea(z.poly); });
    lines.push(L(drainNet !== undefined && cu >= 100 - 1e-6, 'Kupferfläche am MOSFET-Drain: ' + fm(cu / 100, 2) + ' cm² Fläche am Drain-Netz (mindestens 1 cm², A: Kühlfläche)' + (drainNet === undefined ? ' – Drain-Netz nicht gefunden' : ''), 10));
    lines.push(L(fin(norm.w) && fin(norm.h) && norm.w <= P.boardW + 1e-6 && norm.h <= P.boardH + 1e-6 && norm.w >= 20 && norm.h >= 15 && norm.layers >= 1 && norm.layers <= P.layers, 'Maße und Lagen: ' + fm(norm.w, 0) + ' x ' + fm(norm.h, 0) + ' mm, ' + norm.layers + ' Lagen (höchstens ' + P.boardW + ' x ' + P.boardH + ' mm, ' + P.layers + ' Lagen)', 10));
    const rep = isObj(data.report) ? data.report : null, own = boardReport(norm);
    let repOk = !!rep && fin(own.cost);
    if (repOk) repOk = sameVal(+rep.w, norm.w, 0.01) && sameVal(+rep.h, norm.h, 0.01) && +rep.layers === norm.layers && +rep.unrouted === own.unrouted && sameVal(+rep.cost, own.cost, 0.01) && (+rep.bomCount === nParts || +rep.bomCount === arr(PCB().bom(norm)).length);
    lines.push(L(repOk, 'Kosten ' + (fin(own.cost) ? fm(own.cost, 2) + ' €' : '?') + ' und Kennzahlen im Bericht stimmen mit der Platine überein' + (rep ? '' : ' – Bericht fehlt'), 5));
    return lines;
  }
  const boardCacheSol = new Map();
  function buildBoard(nlIn, P, an) {
    const ixs = nlIdx(nlIn), c = PCB();
    const key = hash(JSON.stringify([nlIn, P.boardW, P.boardH, P.layers, an.iNom, an.iStart]));
    if (boardCacheSol.has(key)) return clone(boardCacheSol.get(key));
    const drv = findDriver(ixs, P), sup = supplyOf(ixs, P.uSup);
    const empty = () => clone(c.newBoard({ id: 'giess', name: 'Treiberplatine Bewässerung', w: P.boardW, h: P.boardH, layers: P.layers }));
    if (!drv.q || !sup) return empty();
    const ext = [['X3', [drv.nM, drv.nD], 'MOTOR'], ['X1', [sup.plusNet, sup.minusNet], '24V'], ['X2', [drv.nIn, sup.minusNet], 'IN']];
    const order = ['D1', 'Q1', 'F1', 'R1', 'R2'];
    const bps = Object.keys(ixs.parts).map(k => ixs.parts[k]).filter(p => FPMAP[p.kind] || p.kind === 'NMOS');
    bps.sort((a, b) => { const ia = order.indexOf(a.ref), ib = order.indexOf(b.ref); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    const fpOf = p => (p.kind === 'NMOS' ? fpmapOf(p).fp : p.kind === 'D' ? 'D_DO41' : p.kind === 'FUSE' ? 'HDR_1x2' : 'R_AXIAL_10');
    const iDim = Math.sqrt(an.iNom * an.iNom + PUMP.fStart * an.iStart * an.iStart), wPow = rd(Math.max(c.ipcWidth(iDim, { oz: 1, rise: 10 }), 0.3) + 0.1, 2);
    const pow = [sup.plusNet, drv.nM, drv.nD];
    let last = null;
    const variants = [{ gap: 3, rot: 0 }, { gap: 4, rot: 0 }, { gap: 5, rot: 0 }, { gap: 3, rot: 90 }, { gap: 6, rot: 0 }];
    for (let vi = 0; vi < variants.length; vi++) {
      const v = variants[vi], board = c.newBoard({ id: 'giess', name: 'Treiberplatine Bewässerung', w: P.boardW, h: P.boardH, layers: P.layers });
      let cx = 14, cy = 4, rowH = 0, n = 0;
      bps.forEach(p => {
        const fpId = fpOf(p), probe = { x: 0, y: 0, rot: 0, side: 'top', fp: fpId };
        const cr = courtyardRect(board, probe) || { x0: -3, x1: 3, y0: -3, y1: 3 }, w = cr.x1 - cr.x0, h = cr.y1 - cr.y0;
        if (cx + w > P.boardW - 2) { cx = 14; cy += rowH + v.gap; rowH = 0; }
        board.parts.push({ id: 'p' + (++n), ref: p.ref, fp: fpId, x: rd(cx - cr.x0, 2), y: rd(cy - cr.y0, 2), rot: 0, side: 'top', value: p.value });
        cx += w + v.gap; rowH = Math.max(rowH, h);
      });
      ext.forEach((e, i) => board.parts.push({ id: 'p' + (++n), ref: e[0], fp: 'TERMINAL_2', x: 2.8, y: rd(8 + i * 14, 1), rot: 0, side: 'top', value: e[2] }));
      const nets = {}, ord = [];
      const addPad = (name, pad) => { if (name === undefined) return; if (!nets[name]) { nets[name] = []; ord.push(name); } nets[name].push(pad); };
      bps.forEach(p => { const map = fpmapOf(p).maps[0]; Object.keys(ixs.parts[p.ref].pins || {}).forEach(pn => { if (map[pn] !== undefined) addPad(netOf(ixs, p.ref, pn), p.ref + '.' + map[pn]); }); });
      ext.forEach(e => { addPad(e[1][0], e[0] + '.1'); addPad(e[1][1], e[0] + '.2'); });
      board.nets = ord.filter(nm => nets[nm].length >= 2).map(nm => { const o = { name: nm, cls: (nm === sup.minusNet || pow.indexOf(nm) >= 0) ? 'power' : 'signal', pins: nets[nm] }; if (pow.indexOf(nm) >= 0) o.width = wPow; return o; });
      const dnet = board.nets.find(x => x.name === drv.nD);
      if (dnet) {                               // Kühlfläche am Drain (Rückseite): Rechteck um alle Drain-Pads, mindestens 14 x 8 mm
        const ps = c.padsOf(board).filter(p => dnet.pins.indexOf(p.id) >= 0);
        if (ps.length) {
          let x0 = Math.min.apply(null, ps.map(p => p.x)) - 2, x1 = Math.max.apply(null, ps.map(p => p.x)) + 2, y0 = Math.min.apply(null, ps.map(p => p.y)) - 2, y1 = Math.max.apply(null, ps.map(p => p.y)) + 2;
          if (x1 - x0 < 14) { const m = (x0 + x1) / 2; x0 = m - 7; x1 = m + 7; }
          if (y1 - y0 < 8) { const m = (y0 + y1) / 2; y0 = m - 4; y1 = m + 4; }
          x0 = Math.max(1, x0); y0 = Math.max(1, y0); x1 = Math.min(P.boardW - 1, x1); y1 = Math.min(P.boardH - 1, y1);
          board.zones.push({ id: 'z1', net: drv.nD, layer: 'B.Cu', poly: [[rd(x0, 2), rd(y0, 2)], [rd(x1, 2), rd(y0, 2)], [rd(x1, 2), rd(y1, 2)], [rd(x0, 2), rd(y1, 2)]] });
        }
      }
      const r = c.autoroute(board, {}), res = r.board || board;
      last = res;
      const st = boardStats(res);
      if (!r.failed.length && st.unrouted === 0 && st.errs.length === 0) break;
    }
    boardCacheSol.set(key, clone(last));
    return clone(last);
  }
  function pcbSolution(ctx) { const P = P_(ctx), sch = need(ctx, 'giess.sch'), an = pumpDerive(need(ctx, 'giess.ant'), ctx), b = buildBoard(sch.netlist, P, an); return { board: b, report: boardReport(b) }; }

  /* ====================================================================== vw6: Treiberplatine prüfen (MessLab) */
  const normId = s => lc(s).replace(/[^a-z0-9]/g, '');
  function messTruth(ctx, withFault) {
    const P = P_(ctx), A = ANT(), an = pumpDerive(need(ctx, 'giess.ant'), ctx), pi = pickInfo(need(ctx, 'giess.ds'));
    const rds = (pi.tr ? dsVal(dsRow(pi.tr, 'rds45'), 'typ') : NaN) || 0.04;
    const f = withFault ? P.fault : null;
    const iMot = an.iNom * (f === 'rgs' ? 0.8 : f === 'diodeRev' ? 0.9 : 1);
    const uDs = iMot * rds * 1.2 * (f === 'rgs' ? 3 : 1);
    const uSupLoaded = P.uSup - (f === 'diodeRev' ? 10 : 1) * PUMP.ri * (an.duty / 100) * iMot;
    const uMean = A.pwmAverage(an.duty / 100, uSupLoaded, PUMP.drop) * (f === 'rgs' ? 0.8 : 1);
    return { U_DS: uDs, I_mot: iMot, U_sup: uSupLoaded, U_mean: uMean, rdsOn: uDs / iMot, rdsLo: 0.85 * rds, rdsHi: 1.25 * (pi.tr ? dsVal(dsRow(pi.tr, 'rds45'), 'max') : 0.05) };
  }
  const scaleTo = (v, unit, base) => { const u = String(unit || base); if (u === 'mV' && base === 'V') return v / 1000; if (u === 'V' && base === 'mV') return v * 1000; if (u === 'mA' && base === 'A') return v / 1000; if (u === 'A' && base === 'mA') return v * 1000; return v; };
  function rowOf(rows, key) { return arr(rows).find(r => isObj(r) && normId(r.id || r.label) === key) || null; }
  function rowVal(r, base) { if (!r) return NaN; const v = fin(r.ist) ? r.ist : numOf(r.ist); return fin(v) ? scaleTo(v, r.unit, base) : NaN; }
  function checkMess(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], rows = arr(data && data.rows), truth = messTruth(ctx, true), design = messTruth(ctx, false), faulty = !!P.fault;
    const uds = rowVal(rowOf(rows, 'uds'), 'V'), imot = rowVal(rowOf(rows, 'imot'), 'A');
    const rIst = fin(uds) && fin(imot) && imot > 0 ? uds / imot : NaN;
    const lo = truth.rdsLo * (faulty ? 1 : 1), hi = truth.rdsHi;
    const rOk = fin(rIst) && (faulty && P.fault === 'rgs' ? Math.abs(rIst - truth.rdsOn) <= 0.25 * truth.rdsOn * tol : rIst >= lo * (1 - 0.1 * tol) && rIst <= hi * (1 + 0.1 * tol));
    lines.push(L(rOk, 'R_DS(on),ist = U_DS / I: ' + (fin(rIst) ? fm(rIst * 1000, 1) + ' mΩ' : 'nicht berechenbar (U_DS oder I fehlt)') + ', Datenblatt-Fenster ' + fm(lo * 1000, 0) + ' bis ' + fm(hi * 1000, 0) + ' mΩ (R_DS(on) bei 4,5 V)' + (faulty && P.fault === 'rgs' ? ' – hier weicht die Anlage vom Entwurf ab' : ''), 25));
    const tI = Math.max(0.05 * tol * truth.I_mot, 0.01 * tol);
    lines.push(L(fin(imot) && Math.abs(imot - truth.I_mot) <= tI, 'Motorstrom: ' + (fin(imot) ? 'gemessen ' + fm(imot, 2) + ' A' : 'nicht eingetragen') + ', erwartet ' + fm(truth.I_mot, 2) + ' A (±' + fm(5 * tol, 1) + ' %)' + (faulty && Math.abs(truth.I_mot - design.I_mot) > tI ? ' – hier weicht die Anlage vom Entwurf ab' : ''), 20));
    const vv = data && isObj(data.values) && fin(+data.values.uSupLoaded) ? +data.values.uSupLoaded : rowVal(rowOf(rows, 'usup'), 'V');
    const tS = Math.max(0.05 * tol, 0.01);
    lines.push(L(fin(vv) && Math.abs(vv - truth.U_sup) <= tS, 'Versorgung unter Last (drei Stellen): ' + (fin(vv) ? fm(vv, 2) + ' V' : 'nicht eingetragen') + ', erwartet ' + fm(truth.U_sup, 2) + ' V (±' + fm(tS, 2) + ' V)' + (faulty && Math.abs(truth.U_sup - design.U_sup) > tS ? ' – hier weicht die Anlage vom Entwurf ab' : ''), 20));
    if (faulty) {
      const f = arr(data && data.findings).map(lc).join(' | ');
      const words = P.fault === 'rgs' ? ['pulldown', 'r_gs', 'rgs', 'gate'] : ['diode', 'freilauf'];
      const kind = P.fault === 'rgs' ? /(fehlt|fehlen|nicht vorhanden|weggelassen|offen|schwebt|schwebend|kein)/.test(f) : /(verpol|falsch ?herum|umgekehrt|falsch gepolt|polarit|falsch eingebaut)/.test(f);
      lines.push(L(words.some(w => f.indexOf(w) >= 0) && kind, 'Fehler benannt: ' + (P.fault === 'rgs' ? 'Pulldown R_GS fehlt, das Gate schwebt' : 'Freilaufdiode verpolt') + (f ? '' : ' – kein Befund eingetragen'), 20));
    } else {
      const um = rowVal(rowOf(rows, 'umean'), 'V'), tU = Math.max(0.05 * tol * truth.U_mean, 0.05);
      lines.push(L(fin(um) && Math.abs(um - truth.U_mean) <= tU, 'Mittlere Motorspannung bei PWM: ' + (fin(um) ? 'gemessen ' + fm(um, 2) + ' V' : 'nicht eingetragen') + ', erwartet ' + fm(truth.U_mean, 2) + ' V (Tastgrad · Versorgung, ±' + fm(5 * tol, 1) + ' %)', 20));
    }
    const pcb = slotOf(ctx, 'giess.pcb'), pb = pcb && asBoard(pcb.board), bnames = {}; arr(pb && pb.nets).forEach(n => { bnames[n.name] = 1; });
    const need4 = ['uds', 'imot', 'usup', 'umean'];
    const miss = need4.filter(k => { const r = rowOf(rows, k); return !r || !fin(rowVal(r, k === 'imot' ? 'A' : k === 'uds' ? 'V' : 'V')) || !String(r.unit || '').trim() || !String(r.instrument || '').trim(); });
    const badTp = rows.filter(r => isObj(r) && r.tp && pb && !bnames[r.tp]);
    lines.push(L(miss.length === 0 && badTp.length === 0, 'Protokoll vollständig: vier Messzeilen mit Wert, Einheit und Messgerät, Prüfpunkte liegen auf der Platine' + (miss.length ? ' – fehlt: ' + miss[0] : badTp.length ? ' – Prüfpunkt „' + badTp[0].tp + '“ gibt es auf der Platine nicht' : ''), 15));
    return lines;
  }
  function messSolution(ctx) {
    const P = P_(ctx), t = messTruth(ctx, true), d = messTruth(ctx, false), pcb = need(ctx, 'giess.pcb'), pb = asBoard(pcb && pcb.board);
    const sch = need(ctx, 'giess.sch'), drv = sch && isObj(sch.netlist) ? findDriver(nlIdx(sch.netlist), P) : null;
    const role = { vcc: drv && drv.vcc, n_d: drv && drv.nD, n_m: drv && drv.nM };      // Netznamen aus dem Schaltplan des Labs (N1, V1 ...), nicht die idealen Namen
    const nm = n => { const bn = arr(pb && pb.nets), m = bn.find(x => lc(x.name) === n) || (role[n] ? bn.find(x => x.name === role[n]) : null); return m ? m.name : n.toUpperCase(); };
    const mk = (id, label, unit, key, ins, tp, f) => ({ id: id, label: label, unit: unit, soll: rd(d[key] * f, 4), ist: rd(t[key] * f, 4), tol: 5, instrument: ins, tp: tp });
    const rows = [mk('U_DS', 'Spannung Drain-Source (durchgeschaltet)', 'mV', 'U_DS', 'Multimeter', nm('n_d'), 1000), mk('I_mot', 'Motorstrom', 'A', 'I_mot', 'Multimeter', nm('n_m'), 1),
      mk('U_sup', 'Versorgung unter Last', 'V', 'U_sup', 'Multimeter', nm('vcc'), 1), mk('U_mean', 'Mittlere Motorspannung', 'V', 'U_mean', 'Oszilloskop', nm('n_m'), 1)];
    rows[2].ist = rd(t.U_sup, 3); rows[2].soll = rd(d.U_sup, 3);
    const findings = P.fault === 'rgs' ? ['Der Pulldown R_GS fehlt, das Gate schwebt und der MOSFET wird nicht voll durchgesteuert.'] : P.fault === 'diodeRev' ? ['Die Freilaufdiode ist verpolt eingebaut, sie belastet die Versorgung und bricht die Spannung ein.'] : [];
    return { rows: rows, values: { uSupLoaded: rd(t.U_sup, 3) }, findings: findings };
  }

  /* ====================================================================== vw7: Füllstandsmesskette 4...20 mA (Sensorik-Lab) */
  function loopCalc(sen, P) {
    const ctl = isObj(sen && sen.ctl) ? sen.ctl : {}, o = { ok: false, errs: [] };
    const rB = +ctl.rBurden, bits = fin(+ctl.adcBits) ? +ctl.adcBits : P.adcBits, rLine = fin(+ctl.rLine) ? +ctl.rLine : P.rLine, ul = sen ? sen.uSupLoop : null, uS = fin(+ul) && ul !== null && ul !== '' ? +ul : +ctl.uSupply;   // uSupLoop: im Lab lässt sich die Versorgung nur in Stufen (12/18/24/30 V) wählen, die gemessene Spannung unter Last steht im Formular
    if (!fin(rB) || rB <= 0) o.errs.push('Bürde fehlt');
    if (!fin(uS)) o.errs.push('Versorgungsspannung fehlt');
    if (!(bits >= 6 && bits <= 16)) o.errs.push('Wandlerbreite unsinnig');
    if (o.errs.length) return o;
    const n = Math.pow(2, bits), spanI = 16, i100 = 4 + spanI * (P.hTank * RHO * G / (P.pSensMbar * 100));
    const count = i => clamp(Math.floor(i * rB / 1000 / P.uRef * n), 0, n - 1);
    Object.assign(o, { rB: rB, rLine: rLine, bits: bits, uS: uS, n: n, i100: i100, c0: count(4), c100: count(i100), cBreakLo: count(3.6), cBreakHi: count(4), count: count });
    o.uB20 = 0.02 * rB;
    o.rMax = (uS - P.uMinLoop) / 0.02 - rLine;
    o.mmPerLsb = o.c100 > o.c0 ? P.hTank * 1000 / (o.c100 - o.c0) : Infinity;
    o.ok = true;
    return o;
  }
  const thrCounts = (lc_, thr, P) => ({ min: Math.round(lc_.c0 + (lc_.c100 - lc_.c0) * thr.min / 100), mid: Math.round(lc_.c0 + (lc_.c100 - lc_.c0) * thr.mid / 100), max: Math.round(lc_.c0 + (lc_.c100 - lc_.c0) * thr.max / 100) });
  function uSupFromMess(ctx, useNeed) { const m = useNeed ? need(ctx, 'giess.mess') : slotOf(ctx, 'giess.mess'); const v = m && isObj(m.values) ? +m.values.uSupLoaded : NaN; return fin(v) ? v : (m ? rowVal(rowOf(arr(m.rows), 'usup'), 'V') : NaN); }
  function checkSen(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], d = isObj(data) ? data : {}, lcl = loopCalc(d, P), ok = lcl.ok, uMeas = uSupFromMess(ctx);
    const usedOk = ok && fin(uMeas) && Math.abs(lcl.uS - uMeas) <= 0.1;
    lines.push(L(ok && usedOk && lcl.rB <= lcl.rMax, 'Bürde: R_B ' + (ok ? fm(lcl.rB, 0) + ' Ω' : 'fehlt') + ' höchstens (U_V − ' + P.uMinLoop + ' V) / 20 mA − R_Leitung = ' + (ok ? fm(lcl.rMax, 0) + ' Ω' : '?') + ' mit der gemessenen Versorgung ' + (fin(uMeas) ? fm(uMeas, 2) + ' V' : '? (Messprotokoll fehlt)') + (ok && !usedOk && fin(uMeas) ? ' – du hast ' + fm(lcl.uS, 2) + ' V eingestellt, gemessen sind ' + fm(uMeas, 2) + ' V' : ''), 25));
    lines.push(L(ok && lcl.uB20 <= P.uRef, 'Spannung an der Bürde bei 20 mA: ' + (ok ? fm(lcl.uB20, 2) : '?') + ' V, höchstens die ADU-Referenz ' + P.uRef + ' V', 20));
    lines.push(L(ok && lcl.mmPerLsb <= 2, 'Auflösung: ' + (ok && fin(lcl.mmPerLsb) ? fm(lcl.mmPerLsb, 2) : '?') + ' mm je Digit bei ' + (ok ? lcl.bits : '?') + ' Bit (höchstens 2 mm, A)', 15));
    const sc = isObj(d.scale) ? d.scale : {}, cb = +sc.cBreak;
    lines.push(L(ok && fin(cb) && cb >= lcl.cBreakLo && cb <= lcl.cBreakHi, 'Drahtbruch: Schwelle cBreak ' + (fin(cb) ? fm(cb, 0) : 'fehlt') + ' Digit, erlaubt ' + (ok ? lcl.cBreakLo + ' (3,6 mA) bis ' + lcl.cBreakHi + ' (4 mA)' : '?') + ': ein Strom unter 3,6 mA muss darunter liegen, ein leerer Tank (4 mA) darüber', 15));
    lines.push(L(ok && fin(+sc.c0) && fin(+sc.c100) && Math.abs(+sc.c0 - lcl.c0) <= 2 && Math.abs(+sc.c100 - lcl.c100) <= 2, 'Skalierung Digit zu Millimeter: c0 ' + (fin(+sc.c0) ? fm(+sc.c0, 0) : 'fehlt') + ' (erwartet ' + (ok ? lcl.c0 : '?') + ' bei 4 mA), c100 ' + (fin(+sc.c100) ? fm(+sc.c100, 0) : 'fehlt') + ' (erwartet ' + (ok ? lcl.c100 : '?') + ' bei ' + fm(P.hTank * 1000, 0) + ' mm)', 15));
    const thr = isObj(d.thr) ? d.thr : {}, tc = isObj(d.thrCounts) ? d.thrCounts : {}, exp = ok ? thrCounts(lcl, P.thr, P) : {};
    const tOk = ['min', 'mid', 'max'].every(k => fin(+thr[k]) && Math.abs(+thr[k] - P.thr[k]) <= 0.5 && fin(+tc[k]) && ok && Math.abs(+tc[k] - exp[k]) <= 2) && fin(+d.hyst) && +d.hyst > 0 && +d.hyst <= 5;
    lines.push(L(tOk, 'Schaltpunkte min/mitte/max: ' + P.thr.min + ' / ' + P.thr.mid + ' / ' + P.thr.max + ' % = ' + (ok ? exp.min + ' / ' + exp.mid + ' / ' + exp.max : '?') + ' Digit, deine Werte ' + ['min', 'mid', 'max'].map(k => (fin(+thr[k]) ? thr[k] : '?') + ' % = ' + (fin(+tc[k]) ? tc[k] : '?')).join(' / ') + ', Hysterese ' + (fin(+d.hyst) ? fm(+d.hyst, 1) + ' %' : 'fehlt') + ' (1 bis 5 %)', 10));
    return lines;
  }
  function senSolution(ctx) {
    const P = P_(ctx), uS = uSupFromMess(ctx, true);
    const rB = 220, ctl = { signal: '420', uSupply: fin(uS) ? rd(uS, 3) : P.uSup, rBurden: rB, rLine: P.rLine, adcBits: P.adcBits, lo: 0, hi: P.pSensMbar / 1000, emi: 0 };
    const data = { rig: 'normsignal', preset: '', ctl: ctl, state: {}, derived: {} };
    const l = loopCalc(data, P), tc = thrCounts(l, P.thr, P);
    data.scale = { c0: l.c0, c100: l.c100, cBreak: Math.round((l.cBreakLo + l.cBreakHi) / 2), hTankMm: P.hTank * 1000, adcBits: l.bits };
    data.thr = { min: P.thr.min, mid: P.thr.mid, max: P.thr.max }; data.hyst = 2; data.thrCounts = tc; data.uSupLoop = ctl.uSupply;
    data.derived = { mmPerLsb: rd(l.mmPerLsb, 3), uB20: rd(l.uB20, 3), rMax: rd(l.rMax, 0), i100: rd(l.i100, 3) };
    return data;
  }

  /* ====================================================================== vw8: Sensorknoten programmieren (Arduino-Lab) */
  const FMT = /^FILL=-?\d+(?:\.\d+)?;PUMP=[01];ERR=\d+$/;
  function sketchCfg(ctx) {                     // erwartete Skalierung aus der Messketten-Station (neu gerechnet)
    const P = P_(ctx), sd = need(ctx, 'giess.sen'), l = loopCalc(sd, P);
    return { l: l, P: P, ok: l.ok, minMm: P.thr.min / 100 * P.hTank * 1000 };
  }
  const mmOf = (cnt, l, P) => (cnt - l.c0) * P.hTank * 1000 / (l.c100 - l.c0);
  function lastKv(r) { const ln = r && r.lines ? r.lines : []; const last = ln.length ? ln[ln.length - 1] : ''; const m = /FILL=(-?[\d.]+);PUMP=(\d);ERR=(\d+)/.exec(last); return m ? { fill: +m[1], pump: +m[2], err: +m[3] } : null; }
  function checkCode(data, ctx) {
    const lines = [], R = runners(), src = String(isObj(data) && typeof data.src === 'string' ? data.src : ''), cfg = sketchCfg(ctx);
    if (!R) return [L(false, 'Der Prüf-Läufer (verbundrun.js) ist nicht geladen', 100)];
    if (!cfg.ok) return [L(false, 'Die Messketten-Station fehlt oder ist unbrauchbar, die Skalierung lässt sich nicht prüfen', 100)];
    const tol = TOL(ctx), l = cfg.l, P = cfg.P, base = R.runSketch(src, { T: 1.2, analog: { A0: l.c0 + (l.c100 - l.c0) * 0.5 } });
    lines.push(L(base.ok || base.phase !== 'compile', 'Sketch lässt sich übersetzen' + (base.phase === 'compile' ? ' – ' + base.error : base.phase === 'run' ? ' (Laufzeitfehler: ' + base.error + ')' : ''), 5));
    const levels = [0, 250, 500, 750, 1000], dev = [];
    let allOk = base.phase !== 'compile';
    levels.forEach(mm => {
      if (!allOk) return;
      const cnt = Math.round(l.c0 + (l.c100 - l.c0) * mm / (P.hTank * 1000)), r = R.runSketch(src, { T: 1.2, analog: { A0: cnt } }), kv = r.ok ? lastKv(r) : null;
      if (!kv) { allOk = false; dev.push('keine auswertbare Zeile bei ' + mm + ' mm'); return; }
      const e = Math.abs(kv.fill - mm);
      if (e > 3 * tol) { allOk = false; dev.push(fm(kv.fill, 0) + ' mm statt ' + mm + ' mm'); }
    });
    lines.push(L(allOk, 'Umrechnung Digit zu Millimeter über den ganzen Messbereich (0 bis 1000 mm, höchstens ±' + fm(3 * tol, 1) + ' mm Fehler)' + (dev.length ? ' – ' + dev[0] : ''), 30));
    const br = base.phase !== 'compile' ? R.runSketch(src, { T: 1.2, analog: { A0: 0 } }) : null, kb = br && br.ok ? lastKv(br) : null, kn = lastKv(base);
    lines.push(L(!!kb && kb.err === 1 && !!kn && kn.err === 0, 'Drahtbruch: bei 0 Digit meldet der Knoten ERR=' + (kb ? kb.err : '?') + ' (muss 1 sein), im Normalbetrieb ERR=' + (kn ? kn.err : '?'), 20));
    const nl = base.phase !== 'compile' ? R.runSketch(src, { T: 1.2, analog: { A0: 500 } }) : null;
    const all = [].concat(base.lines || [], nl && nl.lines || [], br && br.lines || []);
    lines.push(L(all.length >= 5 && all.every(x => FMT.test(String(x))), 'Zeilenformat exakt FILL=<mm>;PUMP=<0/1>;ERR=<n>' + (all.length ? (all.every(x => FMT.test(String(x))) ? '' : ' – falsche Zeile: „' + String(all.find(x => !FMT.test(String(x)))).slice(0, 40) + '“') : ' – keine Ausgabe'), 20));
    // Mittelwert: Rauschen
    const mid = Math.round(l.c0 + (l.c100 - l.c0) * 0.5), nr = base.phase !== 'compile' ? R.runSketch(src, { T: 3, analog: { A0: { v: mid, noise: 6, seed: 4 } } }) : null;
    let ratio = NaN;
    if (nr && nr.ok && nr.lines.length >= 10) {
      const vals = nr.lines.map(x => { const m = /FILL=(-?[\d.]+)/.exec(String(x)); return m ? +m[1] : NaN; }).filter(fin), mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length), raw = (6 / Math.sqrt(3)) * P.hTank * 1000 / (l.c100 - l.c0);
      ratio = sd / raw;
    }
    lines.push(L(fin(ratio) && ratio <= 0.5, 'Mittelwertbildung dämpft das Rauschen: Streuung ' + (fin(ratio) ? fm(ratio * 100, 0) : '?') + ' % der Einzelmessung (höchstens 50 %, mitteln über mindestens fünf Werte)', 15));
    const rs = isObj(data) && isObj(data.run) ? arr(data.run.serial) : [];
    lines.push(L(rs.length >= 120 && rs.every(x => FMT.test(String(x))), 'Probelauf im Slot: ' + rs.length + ' Zeilen im Ausgabeformat (mindestens 120)', 10));
    return lines;
  }
  function sketchSource(l, P) {
    return ['const int PIN = A0;', 'const float C0 = ' + l.c0 + '.0;', 'const float C100 = ' + l.c100 + '.0;', 'const float HMM = ' + (P.hTank * 1000) + '.0;', 'const int CBREAK = ' + Math.round((l.cBreakLo + l.cBreakHi) / 2) + ';', 'const float MINMM = ' + rd(P.thr.min / 100 * P.hTank * 1000, 1) + ';',
      'void setup() { Serial.begin(9600); }', 'void loop() {', '  long sum = 0;', '  for (int i = 0; i < 8; i++) { sum += analogRead(PIN); }', '  float avg = sum / 8.0;', '  int err = 0;', '  if (avg < CBREAK) { err = 1; }',
      '  float mm = (avg - C0) * HMM / (C100 - C0);', '  if (mm < 0) { mm = 0; }', '  int pump = 0;', '  if (err == 0 && mm >= MINMM) { pump = 1; }',
      '  Serial.print("FILL="); Serial.print(mm, 0); Serial.print(";PUMP="); Serial.print(pump); Serial.print(";ERR="); Serial.println(err);', '  delay(100);', '}'].join('\n');
  }
  function probeProfile(l, P) {                 // Füllstand im Probelauf: 800 mm sinkend auf 100 mm (unter min)
    const pts = [[0, 800], [4, 800], [12, 100]].map(x => [x[0], l.c0 + (l.c100 - l.c0) * x[1] / (P.hTank * 1000)]);
    return pts;
  }
  function codeSolution(ctx) {
    const cfg = sketchCfg(ctx), l = cfg.l, P = cfg.P, R = runners(), src = sketchSource(l, P);
    let serial = [];
    if (R) { const r = R.runSketch(src, { T: 12.5, analog: { A0: { pts: probeProfile(l, P), noise: 3, seed: 2 } } }); serial = (r.lines || []).slice(0, 124); }
    return { lang: 'arduino', src: src, run: { serial: serial, events: [] } };
  }

  /* ====================================================================== vw9: Gießplan rechnen (Pi-Lab) */
  const DT_S = 0.1;
  function expectedPlan(daten, Q, V, minMm) {
    let lauf = 0, minFill = Infinity, err = 0;
    daten.forEach(z => { const m = /FILL=(-?[\d.]+);PUMP=(\d);ERR=(\d+)/.exec(String(z)); if (!m) return; if (+m[2] === 1) lauf += DT_S; if (+m[1] < minFill) minFill = +m[1]; if (+m[3] > 0) err++; });
    return { LAUFZEIT_S: lauf, LITER: Q * lauf / 60, GIESSZEIT_S: V / Q * 60, FREIGABE: minFill >= minMm && err === 0 ? 'ja' : 'nein', MIN_FUELL: minFill };
  }
  function piHeader(ctx) {
    const P = P_(ctx), an = pumpDerive(need(ctx, 'giess.ant'), ctx), cs = slotOf(ctx, 'giess.code'), serial = cs && isObj(cs.run) ? arr(cs.run.serial) : arr((codeSolution(ctx).run || {}).serial);
    return { daten: serial, Q_LPM: an.ok ? rd(an.qLpm, 3) : P.qSoll, V_BEET_L: P.vBeetL, DT_S: DT_S, MIN_MM: rd(P.thr.min / 100 * P.hTank * 1000, 1) };
  }
  function checkPi(data, ctx) {
    const lines = [], R = runners(), src = String(isObj(data) && typeof data.src === 'string' ? data.src : ''), tol = TOL(ctx);
    if (!R || !R.runPython) return [L(false, 'Der Prüf-Läufer (verbundrun.js) ist nicht geladen', 100)];
    const h = piHeader(ctx), alt = clone(h);
    alt.daten = h.daten.slice(10, 90).map((z, i) => (i % 9 === 0 ? String(z).replace(/FILL=-?[\d.]+/, 'FILL=95').replace(/PUMP=\d/, 'PUMP=0') : z)); alt.MIN_MM = h.MIN_MM; alt.V_BEET_L = h.V_BEET_L + 10;
    const run1 = R.runPython(src, h, { T: 30 }), run2 = R.runPython(src, alt, { T: 30 });
    const e1 = expectedPlan(h.daten, h.Q_LPM, h.V_BEET_L, h.MIN_MM), e2 = expectedPlan(alt.daten, alt.Q_LPM, alt.V_BEET_L, alt.MIN_MM);
    const keys = [['LAUFZEIT_S', 'Laufzeit der Pumpe', 0.15], ['LITER', 'Liter = Q · t', 0.05], ['GIESSZEIT_S', 'Gießzeit für das Beet', 0.2], ['FREIGABE', 'Freigabe', null], ['MIN_FUELL', 'minimaler Füllstand', 1]];
    keys.forEach(k => {
      const g = (run, e) => { const v = run.kv ? run.kv[k[0]] : undefined; return k[2] === null ? v === e[k[0]] : (fin(v) && Math.abs(v - e[k[0]]) <= k[2] * Math.max(1, tol)); };
      const okK = run1.ok && run2.ok && g(run1, e1) && g(run2, e2), got = run1.kv ? run1.kv[k[0]] : undefined;
      lines.push(L(okK, k[0] + ' (' + k[1] + '): ' + (got === undefined ? 'nicht ausgegeben' : 'ausgegeben ' + got) + ', erwartet ' + (k[2] === null ? e1[k[0]] : fm(e1[k[0]], k[0] === 'LITER' ? 2 : 1)) + (run2.ok && !g(run2, e2) ? ' – mit anderen Daten stimmt der Wert nicht (Ergebnis nicht aus den Daten gerechnet?)' : ''), 18));
    });
    const fmtOk = run1.ok && keys.every(k => run1.kv && run1.kv[k[0]] !== undefined) && arr(run1.lines).every(x => /^[A-Z_]+=/.test(String(x)));
    lines.push(L(fmtOk, 'Ausgabeformat KEY=Wert, alle fünf Zeilen, kein Laufzeitfehler' + (run1.ok ? '' : ' – ' + run1.error), 10));
    return lines;
  }
  const PY_SRC = [
    'daten = []', 'Q_LPM = 6.0', 'V_BEET_L = 30', 'DT_S = 0.1', 'MIN_MM = 150', 'lauf = 0', 'minfill = 100000', 'fehler = 0',
    'for z in daten:', '    teile = z.split(";")', '    fill = float(teile[0].split("=")[1])', '    pump = int(teile[1].split("=")[1])', '    err = int(teile[2].split("=")[1])',
    '    if pump == 1:', '        lauf = lauf + DT_S', '    if fill < minfill:', '        minfill = fill', '    if err > 0:', '        fehler = fehler + 1',
    'liter = Q_LPM * lauf / 60', 'giess = V_BEET_L / Q_LPM * 60',
    'print("LAUFZEIT_S=" + str(round(lauf, 1)))', 'print("LITER=" + str(round(liter, 2)))', 'print("GIESSZEIT_S=" + str(round(giess, 1)))',
    'if minfill >= MIN_MM and fehler == 0:', '    print("FREIGABE=ja")', 'else:', '    print("FREIGABE=nein")', 'print("MIN_FUELL=" + str(round(minfill, 0)))'].join('\n');
  function piSolution(ctx) {
    const R = runners(), h = piHeader(ctx);
    let out = [];
    if (R && R.runPython) { const r = R.runPython(PY_SRC, h, { T: 30 }); out = r.lines || []; }
    return { lang: 'python', src: PY_SRC, out: out };
  }

  /* ====================================================================== vw10: Pumpensteuerung (SPS-Lab, Anlage tank) */
  const v_ = a => ({ t: 'var', a: a }), nv_ = a => ({ t: 'var', a: a, neg: true });
  const AND_ = (...i) => ({ t: 'and', in: i }), OR_ = (...i) => ({ t: 'or', in: i });
  const PE_ = a => ({ t: 'edge', a: a, mode: 'P' });
  const TON_ = (id, pt, i) => ({ t: 'fb', fb: 'ton', id: id, pt: pt, in: i });
  const coil_ = a => ({ t: 'coil', a: a }), set_ = a => ({ t: 'set', a: a }), rst_ = a => ({ t: 'reset', a: a });
  const net_ = (id, title, expr, outs) => ({ id: id, title: title, expr: expr, outs: outs || [] });
  const SYM = { 'I0.0': 'S1_Start', 'I0.1': 'S2_Stopp', 'I0.2': 'B1_Min', 'I0.3': 'B2_Mitte', 'I0.4': 'B3_Max', 'I0.6': 'S3_NotHalt', 'Q0.0': 'Y1_Nachspeisen', 'Q0.4': 'P1_Pumpe', 'Q0.5': 'H1_Stoerung',
    'M0.0': 'M_Giessen', 'M0.1': 'M_Nachspeisen', 'M0.2': 'M_Stoerung' };
  function buildProgram(giessMs) {
    return { lang: 'kop', symbols: Object.assign({}, SYM), networks: [
      net_('N1', 'Start Gießen (Wasser da, kein Stopp, keine Störung)', AND_(PE_('I0.0'), v_('I0.1'), v_('I0.6'), v_('I0.2'), nv_('M0.2')), [set_('M0.0')]),
      net_('N2', 'Start ohne Wasser: Störung (Trockenlaufschutz)', AND_(PE_('I0.0'), nv_('I0.2')), [set_('M0.2')]),
      net_('N3', 'Wasser weg während des Gießens: Störung', AND_(v_('M0.0'), nv_('I0.2')), [set_('M0.2')]),
      net_('N4', 'Gießzeit', TON_('T1', giessMs, v_('M0.0')), []),
      net_('N5', 'Gießen beenden: Zeit um, Stopp, Not-Halt oder Störung', OR_(v_('T1.Q'), nv_('I0.1'), nv_('I0.6'), v_('M0.2')), [rst_('M0.0')]),
      net_('N6', 'Störung quittieren mit Stopp', nv_('I0.1'), [rst_('M0.2')]),
      net_('N7', 'Pumpe', AND_(v_('M0.0'), nv_('T1.Q'), v_('I0.1'), v_('I0.6'), v_('I0.2'), nv_('M0.2')), [coil_('Q0.4')]),
      net_('N8', 'Nachspeisen einschalten unter Mitte', nv_('I0.3'), [set_('M0.1')]),
      net_('N9', 'Nachspeisen beenden bei Max', v_('I0.4'), [rst_('M0.1')]),
      net_('N10', 'Ventil Nachspeisen', AND_(v_('M0.1'), nv_('I0.4'), v_('I0.6')), [coil_('Q0.0')]),
      net_('N11', 'Störlampe', v_('M0.2'), [coil_('Q0.5')])
    ] };
  }
  function thrOf(sn, P) {                       // Schaltpunkte aus der Messkette, nur wenn gültig (0 < min < mid < max <= 100), sonst Lastenheft
    const t = sn && isObj(sn.thr) ? { min: +sn.thr.min, mid: +sn.thr.mid, max: +sn.thr.max } : null;
    return t && t.min > 0 && t.min < t.mid && t.mid < t.max && t.max <= 100 ? t : P.thr;
  }
  function spsContext(ctx) {                    // Anlagenwerte aus den Vorstationen (nicht aus der Einreichung)
    const P = P_(ctx), an = pumpDerive(need(ctx, 'giess.ant'), ctx), sn = need(ctx, 'giess.sen'), pi = need(ctx, 'giess.pi');
    const kv = pi ? kvOf(pi.out) : {}, thr = thrOf(sn, P);
    const q = an.ok && an.qLpm > 0.5 ? an.qLpm : P.qSoll, gs = fin(kv.GIESSZEIT_S) && kv.GIESSZEIT_S > 5 ? kv.GIESSZEIT_S : P.vBeetL / q * 60;
    return { thr: thr, qLpm: q, giessS: gs, tankL: P.tankL };
  }
  const press = (key, t0, dur, rest) => { let a = false, b = false; return (t, p) => { if (!a && t >= t0) { a = true; p.setInput(key, !rest); } if (a && !b && t >= t0 + dur) { b = true; p.setInput(key, !!rest); } }; };
  const chain = (...f) => (t, p) => f.forEach(x => x(t, p));
  function runTank(prog, o) {
    const plant = PLANTS().create('tank', { seed: 1, thr: o.thr, pumpLpm: o.qLpm, tankL: o.tankL }), plc = SPS().create(clone(prog));
    plant.scenarios({ level: o.level, level2: 0, fracB: 0, mixed: 0 });
    const qk = plant.io.outputs.map(x => x.key), out = {}, dt = o.dt || 50, rec = { q05: NaN, pumpLowMs: 0, pumpMs: 0 };
    const scanOnce = (st) => {
      const inp = plant.readInputs();
      for (const k in inp) plc.setInput(k, inp[k]);
      plc.scan(st);
      for (let i = 0; i < qk.length; i++) out[qk[i]] = plc.getOutput(qk[i]);
      plant.writeOutputs(out);
    };
    for (let t = 0; t < o.ms;) {
      if (o.drive) o.drive(t, plant);
      scanOnce(dt);
      plant.step(dt);
      if (out['Q0.5'] && !fin(rec.q05)) rec.q05 = t;
      if (out['Q0.4']) { rec.pumpMs += dt; if (plant.state().level < o.thr.min) rec.pumpLowMs += dt; }
      if (o.watch) o.watch(t, out, plant, rec);
      t += dt;
      if (o.coarse && !out['Q0.0'] && !out['Q0.4']) {                // ruhige Zeit (Tageslauf): grob springen, nie über das nächste Ereignis hinweg
        const nx = (o.events || []).find(e => e > t), rest = Math.min(o.coarse, (nx === undefined ? o.ms : nx) - t, o.ms - t);
        if (rest >= 2 * dt) {
          plant.step(rest);                                          // Pumpe und Ventil sind aus: der Zustand ändert sich nicht
          plc.scan(rest);
          for (let i = 0; i < qk.length; i++) out[qk[i]] = plc.getOutput(qk[i]);
          plant.writeOutputs(out);
          t += rest;
        }
      }
    }
    return { st: plant.state(), out: out, rec: rec };
  }
  const spsCache = new Map();
  function spsRuns(prog, ctx) {
    const P = P_(ctx), c = spsContext(ctx), key = hash(JSON.stringify([prog, c, P.vBeetL]));
    if (spsCache.has(key)) return spsCache.get(key);
    const base = { thr: c.thr, qLpm: c.qLpm, tankL: c.tankL }, gMs = c.giessS * 1000, R = { c: c };
    const dryLevel = Math.min(Math.round(0.5 * P.vBeetL), Math.floor(c.thr.min) - 2);
    R.giess = runTank(prog, Object.assign({ level: 95, ms: 2.2 * gMs + 20000, drive: press('I0.0', 1000, 200) }, base));
    R.trocken = runTank(prog, Object.assign({ level: dryLevel, ms: 120000, drive: press('I0.0', 20, 200) }, base));
    R.nachspeisen = runTank(prog, Object.assign({ level: 30, ms: 60000 }, base));
    const stopAt = 1000 + Math.round(gMs * 0.4);
    R.stopp = runTank(prog, Object.assign({ level: 95, ms: stopAt + 4000, drive: chain(press('I0.0', 1000, 200), press('I0.1', stopAt, 600, true)),
      watch: (t, out, p, rec) => { if (t >= stopAt + 400 && out['Q0.4']) rec.q04late = t; } }, base));
    R.nothalt = runTank(prog, Object.assign({ level: 95, ms: stopAt + 4000, drive: chain(press('I0.0', 1000, 200), press('I0.6', stopAt, 600, true)),
      watch: (t, out, p, rec) => { if (t >= stopAt + 400 && out['Q0.4']) rec.q04late = t; } }, base));
    R.dryLevel = dryLevel;
    if (spsCache.size > 300) spsCache.clear();
    spsCache.set(key, R);
    return R;
  }
  function checkSps(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], prog = data && data.prog;
    if (!isObj(prog)) return [L(false, 'Kein SPS-Programm übergeben', 100)];
    if (data.plant && data.plant !== 'tank') return [L(false, 'Das Programm gehört zur Anlage „' + data.plant + '“, verlangt ist die Tankanlage', 100)];
    let val = { ok: false, errors: ['SPS_CORE fehlt'] };
    try { val = SPS().validate(prog); } catch (e) { val = { ok: false, errors: [String(e && e.message || e)] }; }
    let plc = null; try { plc = SPS().create(clone(prog)); } catch (e) { plc = null; }
    const comp = !!(val && val.ok && plc && plc.ok);
    lines.push(L(comp, 'Programm lässt sich übersetzen (SPS_CORE.validate)' + (comp ? '' : ' – ' + String((val && val.errors && val.errors[0]) || (plc && plc.errorList && plc.errorList[0]) || 'Fehler')), 10));
    if (!comp) { lines.push(L(false, 'Szenarien nicht ausführbar, solange das Programm Fehler hat', 90)); return lines; }
    const R = spsRuns(prog, ctx), s = R.giess.st, vOk = Math.abs(s.pumpedL - P.vBeetL) <= 0.08 * tol * P.vBeetL;
    lines.push(L(vOk, 'Gießen: Start bei vollem Tank, gefördert V = Q · t = ' + fm(s.pumpedL, 1) + ' l, verlangt ' + P.vBeetL + ' l (±' + fm(8 * tol, 1) + ' %) bei ' + fm(R.c.qLpm, 2) + ' l/min', 25));
    const t = R.trocken.st;
    lines.push(L(!t.dryRun && R.trocken.rec.pumpLowMs <= 100, 'Trockenlaufschutz: Start bei Füllstand ' + R.dryLevel + ' % (unter min ' + R.c.thr.min + ' %): die Pumpe lief ' + fm(R.trocken.rec.pumpLowMs / 1000, 1) + ' s unter der Schwelle min (erlaubt höchstens 0,1 s)' + (t.dryRun ? ' und fiel trocken' : ''), 25));
    const n = R.nachspeisen.st;
    lines.push(L(!n.overflow && n.level >= R.c.thr.max - 1 && n.level <= 100, 'Nachspeisen: aus ' + 30 + ' % bis max ' + R.c.thr.max + ' %, Füllstand am Ende ' + fm(n.level, 1) + ' %' + (n.overflow ? ', der Tank läuft über' : ', ohne Überlauf'), 20));
    const sp = R.stopp.rec.q04late === undefined || !fin(R.stopp.rec.q04late), nh = R.nothalt.rec.q04late === undefined || !fin(R.nothalt.rec.q04late);
    lines.push(L(sp && nh && R.stopp.st.pumpedL > 1 && R.nothalt.st.pumpedL > 1, 'Stopp und Not-Halt: die Pumpe hält mitten im Gießen innerhalb von 400 ms an' + (sp ? '' : ' (Stopp wirkt nicht)') + (nh ? '' : ' (Not-Halt wirkt nicht)'), 10));
    lines.push(L(fin(R.trocken.rec.q05) && R.trocken.rec.q05 <= 2000, 'Störmeldung: bei Start ohne Wasser leuchtet die Störlampe' + (fin(R.trocken.rec.q05) ? ' nach ' + fm((R.trocken.rec.q05 - 20) / 1000, 1) + ' s' : ' nie'), 10));
    return lines;
  }
  function spsSolution(ctx) {
    const c = spsContext(ctx);
    return { prog: buildProgram(Math.round(c.giessS * 1000 / 100) * 100), plant: 'tank', opts: { thr: c.thr, pumpLpm: rd(c.qLpm, 2), tankL: c.tankL }, lang: 'kop', notes: 'Musterlösung: Start mit Wasserprüfung, Gießzeit, Trockenlaufschutz, Nachspeisen mit Hysterese, Störlampe' };
  }

  /* ====================================================================== vwF: Abschlusstest (ein Tag im Garten) */
  function finalCheck(slots, spec, level) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {};
    const lv = level === 1 || level === 3 ? level : 2, tolMul = { 1: 1.5, 2: 1, 3: 0.6 }[lv];
    const ctx = { spec: { params: P }, level: lv, tol: tolMul, slots: slots || {}, get: k => (slots || {})[k] };
    const g = k => slotOf(ctx, k), lines = [], kpis = [];
    const haus = g('giess.haus'), ant = g('giess.ant'), dsp = g('giess.ds'), sch = g('giess.sch'), pcb = g('giess.pcb'), mess = g('giess.mess'), sen = g('giess.sen'), sps = g('giess.sps');
    const an = pumpDerive(ant, ctx), pi = pickInfo(dsp), fc = fetCalc(pi, P, an), lcl = loopCalc(sen, P);
    // 1: Tag im Garten (24 h)
    let day = null;
    const progOk = isObj(sps) && isObj(sps.prog) && SPS() && (() => { try { return !!SPS().create(clone(sps.prog)).ok; } catch (e) { return false; } })();
    if (progOk && an.ok) {
      const c = { thr: thrOf(sen, P), qLpm: an.qLpm > 0.5 ? an.qLpm : P.qSoll, tankL: P.tankL };
      day = runTank(sps.prog, { thr: c.thr, qLpm: c.qLpm, tankL: c.tankL, level: 40, ms: 86400000, dt: 50, coarse: 60000, events: [6 * 3600000, 6 * 3600000 + 4000], drive: press('I0.0', 6 * 3600000, 4000) });
    }
    const wDay = day ? day.st.pumpedL : NaN;
    lines.push(L(!!day && Math.abs(wDay - P.vBeetL) <= 0.08 * tolMul * P.vBeetL && !day.st.dryRun && !day.st.overflow, 'Ein Tag im Garten (24 h, Start um 6 Uhr, Tank anfangs 40 %): ' + (day ? fm(wDay, 1) + ' l Wasser (verlangt ' + P.vBeetL + ' l ±' + fm(8 * tolMul, 1) + ' %), Trockenlauf ' + (day.st.dryRun ? 'ja' : 'nein') + ', Überlauf ' + (day.st.overflow ? 'ja' : 'nein') : 'Programm oder Antrieb nicht auswertbar'), 30));
    const hp = haus && fin(+haus.pAvailW) ? +haus.pAvailW : NaN;
    lines.push(L(an.ok && fin(hp) && an.pEl <= hp, 'Leistung: Pumpe ' + (an.ok ? fm(an.pEl, 1) : '?') + ' W, das Netzteil liefert ' + (fin(hp) ? fm(hp, 0) : '?') + ' W', 15));
    lines.push(L(fc.ok && fc.tj <= fc.tjLimit && pi.ok && fin(an.iStart) && (dsVal(dsRow(pi.tr, 'id100'), 'max') || dsVal(dsRow(pi.tr, 'id'), 'max')) >= 2 * an.iStart, 'MOSFET: T_j ' + (fc.ok ? fm(fc.tj, 0) : '?') + ' °C (höchstens ' + (fc.ok ? fm(fc.tjLimit, 0) : '?') + ' °C) und Strom I_D mindestens 2 · iStart', 15));
    const errPct = lcl.ok ? (0.5 * lcl.mmPerLsb / (P.hTank * 1000) * 100 + 0.5 + 0.1) : NaN, brk = lcl.ok && isObj(sen.scale) && fin(+sen.scale.cBreak) && +sen.scale.cBreak >= lcl.cBreakLo && +sen.scale.cBreak <= lcl.cBreakHi;
    lines.push(L(lcl.ok && errPct <= 1 && brk, 'Messkette: Füllstandsfehler ' + (fin(errPct) ? fm(errPct, 2) : '?') + ' % der Spanne (halbes Digit + ADU-Referenz 0,5 % + Bürde 0,1 %, A, höchstens 1 %), Drahtbruch ' + (brk ? 'erkennbar' : 'nicht sicher erkennbar'), 20));
    const h = hausInfo(haus, P), iTot = an.ok ? an.pEl / (230 * ETA_NT) : NaN, rcdOk = h.c && isObj(h.c.rcd) && lc(h.c.rcd.type) === 'a' && +h.c.rcd.imaMa <= 30;
    lines.push(L(!!h.c && !!rcdOk && fin(iTot) && +h.c.breaker.inA >= iTot && fin(h.iZ) && +h.c.breaker.inA <= h.iZ, 'Sicherheit: FI ' + (rcdOk ? 'Typ A 30 mA' : 'unpassend') + ', Leitungsschutz ' + (h.c && h.c.breaker ? fm(+h.c.breaker.inA, 0) : '?') + ' A gegen Gesamtstrom ' + (fin(iTot) ? fm(iTot, 2) : '?') + ' A', 10));
    const board = asBoard(pcb && pcb.board), ixs = nlIdx(sch && sch.netlist), eq = board && ixs.ok && PCB() ? boardEquiv(ixs, PCB().normalize(board)) : null;
    const drv = ixs.ok ? findDriver(ixs, P) : { errs: ['keine Schaltung'] }, same_ = pi.ok && drv.q && valueIs(drv.q.value, pi.tr) && valueIs(drv.dio && drv.dio.value, pi.di);
    lines.push(L(!!eq && eq.viol.length === 0 && same_ && isObj(mess) && arr(mess.rows).length >= 4, 'Konsistenz: Datenblatt-Auswahl, Schaltplan, Platine und Messprotokoll gehören zusammen' + (eq && eq.viol.length ? ' – ' + eq.viol[0] : !same_ ? ' – Schaltplan weicht von der Auswahl ab' : ''), 10));
    const rep = board && PCB() ? boardReport(PCB().normalize(board)) : null;
    const k = (key, label, value, unit, ok) => kpis.push({ key: key, label: label, value: fin(value) ? rd(value, 2) : null, unit: unit, ok: !!ok && fin(value) });
    k('wasserTag', 'Wasser pro Tag', wDay, 'l', !!day && Math.abs(wDay - P.vBeetL) <= 0.08 * tolMul * P.vBeetL);
    k('pumpeW', 'Pumpenleistung', an.ok ? an.pEl : NaN, 'W', an.ok && fin(hp) && an.pEl <= hp);
    k('fetC', 'FET-Temperatur', fc.ok ? fc.tj : NaN, '°C', fc.ok && fc.tj <= fc.tjLimit);
    k('aufloesung', 'Auflösung', lcl.ok ? lcl.mmPerLsb : NaN, 'mm/LSB', lcl.ok && lcl.mmPerLsb <= 2);
    k('drahtbruch', 'Drahtbruch erkannt', brk ? 1 : 0, '', brk);
    k('spannungsfall', 'Spannungsfall Zuleitung', h.dUpct, '%', fin(h.dUpct) && h.dUpct <= 3);
    return { lines: lines, kpis: kpis, rep: rep };
  }

  /* ====================================================================== Stationen */
  const dropPin = (nl, addr) => {
    const dot = addr.indexOf('.'), ref = addr.slice(0, dot), pn = addr.slice(dot + 1);
    nl.nets.forEach(n => { n.pins = n.pins.filter(p => p !== addr); });
    nl.parts.forEach(p => { if (p.ref === ref && p.pins) delete p.pins[pn]; });
    return nl;
  };
  const setPart = (nl, ref, fn) => { nl.parts.forEach(p => { if (p.ref === ref) fn(p); }); return nl; };
  const rmPart = (nl, ref) => { nl.parts = nl.parts.filter(p => p.ref !== ref); nl.nets.forEach(n => { n.pins = n.pins.filter(p => p.indexOf(ref + '.') !== 0); }); return nl; };

  const STATIONS = [
    { id: 'vw1', lab: 'vb', cat: 'Gartenbewässerung', title: 'Außenanschluss im Gartenhaus planen', level: 1,
      on: 'haus',
      text: 'Im Gartenhaus kommt eine Außensteckdose für das Netzteil der Bewässerung. Plane den Abgang: Leitung mit Querschnitt und Länge aus dem Lastenheft, Leitungsschutzschalter, FI-Schutzschalter und Schutzart der Steckdose. Gib die Leistung des Netzteils an und rechne den Spannungsfall.',
      in: [], out: 'giess.haus', type: 'haus.plan', w: 100, pass: null,
      open: { ex: 'Gartenhaus Außenanschluss' },
      hint: ['Für Steckdosen im Außenbereich verlangt die Norm einen FI mit höchstens 30 mA. Dazu passt eine Steckdose mit Schutzart IP44.',
        'Der Leitungsschutz muss mindestens den Betriebsstrom führen können und darf höchstens so groß sein, wie die Leitung verträgt. Für 1,5 mm² ist B16 die übliche Zuordnung.',
        'Spannungsfall: ΔU = 2 · l · I / (κ · A) mit κ(Cu) = 56 m/(Ω·mm²). Er darf höchstens 3 % von 230 V betragen. Trage das Netzteil mit der Leistung aus dem Lastenheft ein.'],
      check: safe(checkHaus, 'Außenanschluss'),
      form: [
        { key: 'brType', label: 'Leitungsschutzschalter: Auslösecharakteristik', type: 'select', options: ['B', 'C'] },
        { key: 'brA', label: 'Leitungsschutzschalter: Bemessungsstrom', type: 'number', unit: 'A' },
        { key: 'rcdType', label: 'FI-Schutzschalter: Typ', type: 'select', options: ['AC', 'A', 'F'] },
        { key: 'rcdMa', label: 'FI-Schutzschalter: Bemessungsfehlerstrom', type: 'number', unit: 'mA' },
        { key: 'mm2', label: 'Leitung: Querschnitt', type: 'number', unit: 'mm²', hint: 'Zum Beispiel 1,5 oder 2,5' },
        { key: 'lenM', label: 'Leitung: Länge laut Lastenheft', type: 'number', unit: 'm' },
        { key: 'ip', label: 'Außensteckdose: Schutzart IP', type: 'select', options: ['20', '44', '54', '65'] },
        { key: 'pW', label: 'Leistung des Netzteils', type: 'number', unit: 'W' }
      ],
      fromForm: v => {   // nur gefüllte Felder; was das HausLab aus dem Plan liest (Automat, FI, Querschnitt), gibt das Formular vor
        v = v || {}; const n = k => { const x = typeof v[k] === 'string' ? parseFloat(v[k].replace(',', '.')) : v[k]; return fin(x) ? x : null; };
        const c = { name: 'Außenabgang Garten' }; const br = {}, rc = {}, ca = {};
        if (v.brType) br.type = String(v.brType); if (n('brA') !== null) br.inA = n('brA'); if (Object.keys(br).length) c.breaker = br;
        if (v.rcdType) rc.type = String(v.rcdType); if (n('rcdMa') !== null) rc.imaMa = n('rcdMa'); if (Object.keys(rc).length) c.rcd = rc;
        if (n('mm2') !== null) ca.mm2 = n('mm2'); if (n('lenM') !== null) ca.lenM = n('lenM'); if (Object.keys(ca).length) c.cable = ca;
        if (v.ip) c.socket = { ip: n('ip') !== null ? n('ip') : String(v.ip) };
        const o = { circuits: [c] }; if (n('pW') !== null) { o.pAvailW = n('pW'); c.loads = [{ name: 'Netzteil Bewässerung', pW: n('pW') }]; } return o;
      },
      toForm: d => {
        const cs = d && Array.isArray(d.circuits) ? d.circuits : [], c = cs.find(x => x && /auß|auss|garten|steckdose|aussen/i.test(String(x.name))) || cs[0] || {}; const b = c.breaker || {}, r = c.rcd || {}, k = c.cable || {}, s = c.socket || {};
        return { brType: b.type, brA: b.inA, rcdType: r.type, rcdMa: r.imaMa, mm2: k.mm2, lenM: k.lenM, ip: s.ip, pW: d ? d.pAvailW : undefined };
      },
      starter: ctx => ({ circuits: [], pAvailW: 0, notes: '' }),
      solution: ctx => hausSolution(ctx),
      mutants: [
        { name: 'kein FI am Außenabgang', mutate: d => { d.circuits[0].rcd = null; return d; }, expectFail: ['FI am Außenabgang'] },
        { name: 'FI mit 300 mA', mutate: d => { d.circuits[0].rcd.imaMa = 300; return d; }, expectFail: ['FI am Außenabgang'] },
        { name: 'Steckdose nur IP20', mutate: d => { d.circuits[0].socket.ip = 20; return d; }, expectFail: ['Schutzart'] },
        { name: 'B32 auf 1,5 mm² (Leitung ungeschützt)', mutate: d => { d.circuits[0].breaker.inA = 32; return d; }, expectFail: ['Leitungsschutz'] },
        { name: 'Netzteilleistung falsch', mutate: d => { d.pAvailW = 100; return d; }, expectFail: ['Leistungsbudget'] }
      ] },

    { id: 'vw2', lab: 'vb', cat: 'Gartenbewässerung', title: 'Pumpe im Antriebs-Prüfstand auslegen', level: 2,
      on: 'ant',
      text: 'Die Pumpe soll den Förderstrom aus dem Lastenheft liefern. Der Antriebsmotor läuft an der Netzteilspannung mit PWM, der Förderstrom folgt der Drehzahl. Stelle den Tastgrad so ein, dass er stimmt, und wähle die PWM-Frequenz. Die Leistung muss unter 80 Prozent des Netzteils aus Station 1 bleiben. Trage Nenn- und Anlaufstrom für den Treiber ein.',
      in: ['giess.haus'], out: 'giess.ant', type: 'ant.setup', w: 100, pass: null,
      open: { ex: 'Pumpenantrieb', rig: 'gleichstrom' },
      hint: ['Die Pumpe fördert pro Umdrehung eine feste Menge: Q = k · ω. Aus dem Soll-Förderstrom folgt die nötige Drehzahl. Das Lastmoment der Pumpe folgt aus der Förderhöhe: M = ρ · g · H · k / η.',
        'Im Prüfstand: Motor „24-V-Antrieb“, Betriebsspannung wie im Lastenheft, Lastart Bremse mit dem berechneten Moment. Dann den Tastgrad so lange ändern, bis die Drehzahl den Förderstrom ergibt. Der mittlere Spannungswert ist Tastgrad mal Betriebsspannung.',
        'Die elektrische Leistung ist Mittelspannung mal Motorstrom. Der Anlaufstrom ist der Strom bei stehendem Motor, das Netzteil begrenzt ihn. Wähle eine PWM-Frequenz zwischen 1 und 20 kHz, zum Beispiel 5 kHz.'],
      check: safe(checkAnt, 'Pumpe'),
      starter: ctx => ({ rig: 'gleichstrom', preset: 'antrieb24', ctl: { motor: 'antrieb24', uSupply: 24, duty: 0, fPwm: 5000, dir: 'vor', loadType: 'bremse', load: 0 }, state: {}, derived: {} }),
      solution: ctx => antSolution(ctx),
      mutants: [
        { name: 'Tastgrad 100 Prozent (viel zu viel Wasser)', mutate: d => { d.ctl.duty = 100; return d; }, expectFail: ['Förderstrom'] },
        { name: 'Tastgrad 20 Prozent (zu wenig)', mutate: d => { d.ctl.duty = 20; return d; }, expectFail: ['Förderstrom'] },
        { name: 'PWM-Frequenz 50 Hz', mutate: d => { d.ctl.fPwm = 50; d.fPwm = 50; return d; }, expectFail: ['PWM-Frequenz'] },
        { name: 'Anlaufstrom nicht eingetragen', mutate: d => { delete d.iStart; delete d.derived.iStart; return d; }, expectFail: ['Strom im Slot'] },
        { name: 'falsche Betriebsspannung (12 V)', mutate: d => { d.ctl.uSupply = 12; return d; }, expectFail: ['Förderstrom', 'Motor im Nennbereich'] }
      ] },

    { id: 'vw3', lab: 'vb', cat: 'Gartenbewässerung', title: 'MOSFET und Freilaufdiode wählen', level: 2,
      on: 'ds',
      text: 'Der Motorstrom aus deinem Prüfstand fließt durch einen Low-Side-MOSFET, den ein 5-V-Logikausgang ansteuert. Wähle in den Übungsdatenblättern MOSFET und Freilaufdiode. Rechne die Durchlassverluste mit dem warmen R_DS(on), die Sperrschichttemperatur ohne Kühlkörper und die Schaltverluste bei deiner PWM-Frequenz.',
      in: ['giess.ant'], out: 'giess.ds', type: 'ds.pick', w: 100, pass: null,
      form: [
        { key: 'mosfet', label: 'MOSFET', type: 'select', options: [{ value: 'tf-2n7000', label: '2N7000 (TO-92, 200 mA)' }, { value: 'tf-irlz', label: 'IRLZ34N (TO-220, 30 A)' }, { value: 'tf-bd139', label: 'BD139 (Bipolartransistor)' }] },
        { key: 'diode', label: 'Freilaufdiode', type: 'select', options: [{ value: 'tf-1n4148', label: '1N4148' }, { value: 'tf-1n4007', label: '1N4007' }, { value: 'tf-zd', label: 'Z-Diode 5,1 V' }] },
        { key: 'tjC', label: 'Sperrschichttemperatur T_j ohne Kühlkörper', type: 'number', unit: '°C' },
        { key: 'pSwMW', label: 'Schaltverluste P_sw', type: 'number', unit: 'mW' }
      ],
      fromForm: v => {
        const t = dsOf(v.mosfet), d = dsOf(v.diode);
        return { items: [{ role: 'mosfet', ds: v.mosfet, part: t ? t.part : '', ref: t ? t.ref : '' }, { role: 'diode', ds: v.diode, part: d ? d.part : '', ref: d ? d.ref : '' }],
          calc: { tjC: fin(numOf(v.tjC)) ? numOf(v.tjC) : null, pSwMW: fin(numOf(v.pSwMW)) ? numOf(v.pSwMW) : null }, vals: {} };
      },
      open: { ex: 'MOSFET als Schalter' },
      hint: ['Der MOSFET muss mit 5 V am Gate voll durchschalten (Logic-Level). Schau auf V_GS(th),max und auf die R_DS(on)-Zeile bei 4,5 V. Er muss mindestens den doppelten Anlaufstrom und die doppelte Betriebsspannung aushalten.',
        'Durchlassverluste: P = iNom² · R_DS(on). Nimm den Maximalwert und multipliziere mit 1,65 für den warmen Zustand. Dann T_j = T_amb + P · R_thJA mit dem Wert aus dem Datenblatt. Die Grenze ist T_jmax minus 20 K.',
        'Schaltverluste: P_sw = ½ · U · I · (t_r + t_f) · f_PWM mit den typischen Zeiten aus dem Datenblatt. Die Freilaufdiode führt den Strom nur in der Aus-Phase: I_F ≥ iNom · (1 − Tastgrad). Prüfe auch die Erholzeit gegen die PWM-Periode.'],
      check: safe(checkDs, 'Auswahl'),
      starter: ctx => ({ items: [], calc: {}, vals: {} }),
      solution: ctx => dsSolution(ctx),
      mutants: [
        { name: '2N7000 gewählt (zu schwach)', mutate: d => { d.items[0] = { role: 'mosfet', ds: 'tf-2n7000', part: 'TF-2N7000', ref: '2N7000' }; return d; }, expectFail: ['Strom und Spannung', 'Durchlassverluste'] },
        { name: 'Bipolartransistor statt MOSFET', mutate: d => { d.items[0] = { role: 'mosfet', ds: 'tf-bd139', part: 'TF-BD139', ref: 'BD139' }; return d; }, expectFail: ['Logic-Level'] },
        { name: 'Z-Diode als Freilaufdiode', mutate: d => { d.items[1] = { role: 'diode', ds: 'tf-zd', part: 'TF-ZD5V1', ref: 'BZX55C5V1' }; return d; }, expectFail: ['Freilaufdiode'] },
        { name: '1N4148 (zu wenig Strom)', mutate: d => { d.items[1] = { role: 'diode', ds: 'tf-1n4148', part: 'TF-1N4148', ref: '1N4148' }; return d; }, expectFail: ['Freilaufdiode'] },
        { name: 'Temperatur falsch gerechnet', mutate: d => { d.calc.tjC = d.calc.tjC + 40; return d; }, expectFail: ['Sperrschichttemperatur'] },
        { name: 'Schaltverluste nicht gerechnet', mutate: d => { delete d.calc.pSwMW; return d; }, expectFail: ['Schaltverluste'] }
      ] },

    { id: 'vw4', lab: 'vb', cat: 'Gartenbewässerung', title: 'Pumpentreiber im Schaltplan zeichnen', level: 2,
      on: 'sch',
      text: 'Zeichne den Pumpentreiber mit deinen Bauteilen: Netzteil, Sicherung, Motor, Low-Side-MOSFET, Freilaufdiode antiparallel zum Motor, Gate-Widerstand und Pulldown am Gate. Der Eingang IN ist eine 5-V-Quelle mit Schalter. Simuliere, dass der mittlere Motorstrom zu deinem Nennstrom passt und der Motor bei Gate gleich null aus ist.',
      in: ['giess.ds', 'giess.ant'], out: 'giess.sch', type: 'sch.circuit', w: 100, pass: null,
      open: { ex: 'Motortreiber mit MOSFET' },
      assist: { 1: { kind: 'startschaltung', parts: ['BAT 24 V', 'BAT 5 V', 'Masse'] } },
      hint: ['Der Motor liegt zwischen +24 V (über die Sicherung) und dem Drain, die Source an Masse. Der MOSFET schaltet den Motor gegen Masse.',
        'Die Freilaufdiode liegt antiparallel zum Motor: Anode am Drain, Kathode an der Plusseite des Motors. Sie nimmt beim Abschalten den Motorstrom auf. Ohne sie entstehen Spannungsspitzen.',
        'Zwischen IN und Gate sitzt ein kleiner Gate-Widerstand (E12, zum Beispiel 100 Ω), zwischen Gate und Masse ein Pulldown (zum Beispiel 10 kΩ), damit das Gate nie schwebt. Die Sicherung wählst du mindestens 1,5-mal so groß wie iNom und höchstens so groß wie die Strombegrenzung.'],
      check: safe(checkSch, 'Schaltplan'),
      starter: ctx => ({ lab: 'sch', name: 'neu', netlist: { v: 1, name: 'neu', parts: [], nets: [] }, meas: {}, snap: {} }),
      solution: ctx => schSolution(ctx),
      mutants: [
        { name: 'Freilaufdiode fehlt', mutate: d => { rmPart(d.netlist, 'D1'); return d; }, expectFail: ['Topologie'] },
        { name: 'Pulldown am Gate fehlt', mutate: d => { rmPart(d.netlist, 'R2'); return d; }, expectFail: ['Topologie', 'Simulation bei Gate = 0 V'] },
        { name: 'Sicherung zu klein', mutate: d => { setPart(d.netlist, 'F1', p => { p.value = '0.5'; }); return d; }, expectFail: ['Sicherung'] },
        { name: 'MOSFET passt nicht zur Auswahl', mutate: d => { setPart(d.netlist, 'Q1', p => { p.value = '2N7000'; }); return d; }, expectFail: ['Bauteile entsprechen der Auswahl'] },
        { name: 'Gate-Widerstand nicht aus E12', mutate: d => { setPart(d.netlist, 'R1', p => { p.value = '120'; p.value = '125'; }); return d; }, expectFail: ['Gate-Widerstand'] }
      ] },

    { id: 'vw5', lab: 'vb', cat: 'Gartenbewässerung', title: 'Leistungsplatine entwerfen', level: 3,
      on: 'pcb',
      text: 'Entwirf aus deinem Schaltplan die Leistungsplatine, höchstens 70 mal 45 Millimeter und zweilagig. Die Quellen und der Motor werden Schraubklemmen. Die Leiterbahnen im Motorpfad müssen für den Strom aus deinem Prüfstand breit genug sein, und am Drain des MOSFETs brauchst du eine Kupferfläche von mindestens einem Quadratzentimeter zur Kühlung.',
      in: ['giess.sch', 'giess.ant'], out: 'giess.pcb', type: 'pcb.board', w: 100, pass: null,
      open: { ex: 'Leistungsplatine' },
      assist: { 1: { kind: 'vorplatziert' } },
      hint: ['Lege zuerst die Bauteile und die drei Klemmen (24 V, IN, Motor), dann ordne sie so, dass die Verbindungen kurz bleiben. Jeder Pin muss im gleichen Netz wie im Schaltplan liegen.',
        'Die Bahnbreite im Motorpfad (Versorgung, Motor, Drain) richtet sich nach dem Effektivstrom: Der Strom im Betrieb zählt voll, der kurze Anlaufstrom nur zu einem kleinen Teil. Nimm die IPC-2221-Breite mit 10 K Erwärmung und stelle die Netzbreite entsprechend ein.',
        'Für die Kühlfläche legst du auf der Rückseite eine Kupferfläche (Zone) am Drain-Netz an, mindestens 100 mm². Dann Autorouter, DRC und Kosten prüfen.'],
      check: safe(checkPcb, 'Platine'),
      starter: ctx => { const P = P_(ctx); const b = PCB().newBoard({ id: 'giess', name: 'Neue Platine', w: P.boardW, h: P.boardH, layers: P.layers }); return { board: b, report: boardReport(b) }; },
      solution: ctx => pcbSolution(ctx),
      mutants: [
        { name: 'keine Leiterbahnen', mutate: d => { d.board.tracks = []; d.board.vias = []; d.report = boardReport(d.board); return d; }, expectFail: ['Alle Netze verlegt'] },
        { name: 'Motorbahnen zu schmal', mutate: d => { d.board.tracks.forEach(t => { t.w = 0.25; }); d.report = boardReport(d.board); return d; }, expectFail: ['Motorpfad'] },
        { name: 'Kupferfläche am MOSFET fehlt', mutate: d => { d.board.zones = []; d.report = boardReport(d.board); return d; }, expectFail: ['Kupferfläche'] },
        { name: 'Pads des MOSFETs vertauscht', mutate: d => { d.board.nets.forEach(n => { n.pins = n.pins.map(p => p === 'Q1.2' ? 'Q1.3' : p === 'Q1.3' ? 'Q1.2' : p); }); d.report = boardReport(d.board); return d; }, expectFail: ['Netze der Platine identisch'] },
        { name: 'Platine zu groß', mutate: d => { d.board.w = 90; d.report = boardReport(d.board); return d; }, expectFail: ['Maße und Lagen'] }
      ] },

    { id: 'vw6', lab: 'vb', cat: 'Gartenbewässerung', title: 'Treiberplatine prüfen und messen', level: 2,
      on: 'mess',
      text: 'Die Platine ist bestückt und die Pumpe läuft mit deinem Tastgrad. Miss den Spannungsabfall über dem durchgeschalteten MOSFET, den Motorstrom, die Versorgung unter Last (drei Stellen) und die mittlere Motorspannung bei PWM. Trage Werte, Einheiten und Messgeräte ein. Wenn etwas nicht stimmt, notiere deinen Befund.',
      in: ['giess.pcb'], out: 'giess.mess', type: 'mess.protocol', w: 100, pass: null,
      form: [
        { key: 'uDs', label: 'Spannung U_DS am durchgeschalteten MOSFET', type: 'number', unit: 'mV' },
        { key: 'iMot', label: 'Motorstrom', type: 'number', unit: 'A' },
        { key: 'uSup', label: 'Versorgung unter Last (drei Stellen)', type: 'number', unit: 'V' },
        { key: 'uMean', label: 'Mittlere Motorspannung bei PWM', type: 'number', unit: 'V' },
        { key: 'finding', label: 'Befund', type: 'area' }
      ],
      fromForm: v => {
        const mk = (id, label, unit, val, ins, tp) => ({ id: id, label: label, unit: unit, soll: 0, ist: fin(numOf(val)) ? numOf(val) : null, tol: 5, instrument: ins, tp: tp });
        return { rows: [mk('U_DS', 'Drain-Source', 'mV', v.uDs, 'Multimeter', ''), mk('I_mot', 'Motorstrom', 'A', v.iMot, 'Multimeter', ''), mk('U_sup', 'Versorgung unter Last', 'V', v.uSup, 'Multimeter', ''), mk('U_mean', 'Motorspannung Mittelwert', 'V', v.uMean, 'Oszilloskop', '')],
          values: fin(numOf(v.uSup)) ? { uSupLoaded: numOf(v.uSup) } : {}, findings: v.finding ? [String(v.finding)] : [] };
      },
      open: { ex: 'Motortreiber messen' },
      hint: ['Den Widerstand des durchgeschalteten MOSFETs bekommst du aus Spannung und Strom: R_DS(on) = U_DS / I. Er liegt im Bereich des Datenblatts bei 4,5 V Gate-Spannung.',
        'Die Versorgung bricht unter Last etwas ein, weil das Netzteil einen Innenwiderstand hat. Miss sie direkt an der Klemme bei laufender Pumpe und gib drei Stellen an, denn du brauchst den Wert in der nächsten Station.',
        'Die mittlere Motorspannung ist ungefähr Tastgrad mal Versorgungsspannung. Weicht ein Wert stark ab, ist die Schaltung fehlerhaft: Fehlt der Pulldown, schwebt das Gate, eine verpolte Freilaufdiode belastet die Versorgung. Trage den gemessenen Wert trotzdem ein und notiere den Befund.'],
      check: safe(checkMess, 'Messprotokoll'),
      starter: ctx => ({ rows: [], values: {}, findings: [] }),
      solution: ctx => messSolution(ctx),
      mutants: [
        { name: 'Motorstrom doppelt gemessen', mutate: d => { const r = d.rows.find(x => x.id === 'I_mot'); r.ist *= 2; return d; }, expectFail: ['Motorstrom', 'R_DS(on)'] },
        { name: 'Versorgung unter Last falsch', mutate: d => { d.values.uSupLoaded = d.values.uSupLoaded - 2; d.rows.find(x => x.id === 'U_sup').ist -= 2; return d; }, expectFail: ['Versorgung unter Last'] },
        { name: 'Spannung in Volt statt Millivolt', mutate: d => { const r = d.rows.find(x => x.id === 'U_DS'); r.unit = 'V'; return d; }, expectFail: ['R_DS(on)'] },
        { name: 'Messgerät und Einheit fehlen', mutate: d => { d.rows.forEach(r => { r.instrument = ''; r.unit = ''; }); return d; }, expectFail: ['Protokoll vollständig'] },
        { name: 'Mittelwert nicht gemessen', levels: [1, 2], mutate: d => { d.rows = d.rows.filter(x => x.id !== 'U_mean'); return d; }, expectFail: ['Mittlere Motorspannung', 'Protokoll vollständig'] },
        { name: 'Befund fehlt', levels: [3], mutate: d => { d.findings = []; return d; }, expectFail: ['Fehler benannt'] }
      ] },

    { id: 'vw7', lab: 'vb', cat: 'Gartenbewässerung', title: 'Füllstandsmesskette 4 bis 20 mA auslegen', level: 3,
      on: 'sen',
      text: 'Ein hydrostatischer Drucksensor misst den Füllstand der Regentonne als 4-bis-20-mA-Signal. Wähle die Bürde mit der Versorgung, die du gerade unter Last gemessen hast, und stelle den ADU ein. Lege die Skalierung von Digit in Millimeter fest, die Schwelle für den Drahtbruch und die Schaltpunkte min, mitte und max mit Hysterese.',
      in: ['giess.mess'], out: 'giess.sen', type: 'sen.chain', w: 100, pass: null,
      open: { ex: 'Normsignale 4 bis 20 mA', rig: 'normsignal' },
      form: [
        { key: 'uSup', label: 'Versorgung der Schleife unter Last (aus deiner Messung)', type: 'number', unit: 'V', hint: 'Im Prüfstand gibt es nur 12, 18, 24 oder 30 V: wähle 24 V und trage hier den gemessenen Wert ein' },
        { key: 'c0', label: 'Zählwert bei leerem Tank (4 mA), c0', type: 'number', unit: 'Digit' },
        { key: 'c100', label: 'Zählwert bei 1000 mm, c100', type: 'number', unit: 'Digit' },
        { key: 'cBreak', label: 'Drahtbruch-Schwelle', type: 'number', unit: 'Digit', hint: 'Zwischen dem Zählwert von 3,6 mA und dem von 4 mA' },
        { key: 'thrMin', label: 'Schaltpunkt min', type: 'number', unit: '%' },
        { key: 'thrMid', label: 'Schaltpunkt mitte', type: 'number', unit: '%' },
        { key: 'thrMax', label: 'Schaltpunkt max', type: 'number', unit: '%' },
        { key: 'cntMin', label: 'Zählwert für min', type: 'number', unit: 'Digit' },
        { key: 'cntMid', label: 'Zählwert für mitte', type: 'number', unit: 'Digit' },
        { key: 'cntMax', label: 'Zählwert für max', type: 'number', unit: 'Digit' },
        { key: 'hyst', label: 'Hysterese', type: 'number', unit: '%', hint: '1 bis 5 %' }
      ],
      fromForm: v => {   // nur gefüllte Felder; Bürde, Versorgung und ADU kommen aus dem Prüfstand
        v = v || {}; const n = k => { const x = typeof v[k] === 'string' ? parseFloat(v[k].replace(',', '.')) : v[k]; return fin(x) ? x : null; };
        const sub = (o, m) => { const r = {}; Object.keys(m).forEach(k => { const x = n(m[k]); if (x !== null) r[k] = x; }); return r; };
        const o = { scale: sub(0, { c0: 'c0', c100: 'c100', cBreak: 'cBreak' }), thr: sub(0, { min: 'thrMin', mid: 'thrMid', max: 'thrMax' }), thrCounts: sub(0, { min: 'cntMin', mid: 'cntMid', max: 'cntMax' }) };
        if (n('hyst') !== null) o.hyst = n('hyst'); if (n('uSup') !== null) o.uSupLoop = n('uSup'); return o;
      },
      toForm: d => { d = d || {}; const sc = d.scale || {}, th = d.thr || {}, tc = d.thrCounts || {}; return { uSup: d.uSupLoop !== undefined ? d.uSupLoop : (d.ctl || {}).uSupply, c0: sc.c0, c100: sc.c100, cBreak: sc.cBreak, thrMin: th.min, thrMid: th.mid, thrMax: th.max, cntMin: tc.min, cntMid: tc.mid, cntMax: tc.max, hyst: d.hyst }; },
      hint: ['Der Zweileiter-Messumformer braucht mindestens 12 V an seinen Klemmen. Für 20 mA gilt R_B + R_Leitung ≤ (U_V − 12 V) / 20 mA. Nimm für U_V deinen gemessenen Wert aus der Messstation.',
        'Der ADU hat 5 V Referenz. Bei 20 mA darf an der Bürde höchstens 5 V abfallen, also R_B ≤ 250 Ω. Aus der E12-Reihe passt 220 Ω. Rechne die Zählwerte aus: N = U / U_ref · 2^n.',
        'Der Füllstand 1 m entspricht fast 98 mbar, also gut 19,7 mA. c0 gehört zu 4 mA, c100 zu 1000 mm. Ein Strom unter 3,6 mA ist ein Drahtbruch: Lege die Schwelle zwischen dem Zählwert von 3,6 mA und dem von 4 mA fest.'],
      check: safe(checkSen, 'Messkette'),
      starter: ctx => { const P = P_(ctx); return { rig: 'normsignal', preset: '', ctl: { signal: '420', uSupply: 24, rBurden: 750, rLine: 20, adcBits: 8, lo: 0, hi: 0.1, emi: 0 }, scale: { c0: 0, c100: 0, cBreak: 0 }, thr: {}, state: {}, derived: {} }; },
      solution: ctx => senSolution(ctx),
      mutants: [
        { name: 'Bürde 750 Ω (Sättigung, Spannung zu hoch)', mutate: d => { d.ctl.rBurden = 750; return d; }, expectFail: ['Bürde', 'Spannung an der Bürde'] },
        { name: 'Versorgung nicht aus der Messung', mutate: d => { d.ctl.uSupply = 24; d.ctl.uSupply = d.ctl.uSupply + 0.5; d.uSupLoop = d.ctl.uSupply; return d; }, expectFail: ['Bürde'] },
        { name: 'nur 8 Bit (Auflösung zu grob)', mutate: d => { d.ctl.adcBits = 8; return d; }, expectFail: ['Auflösung', 'Skalierung'] },
        { name: 'Drahtbruchschwelle null', mutate: d => { d.scale.cBreak = 0; return d; }, expectFail: ['Drahtbruch'] },
        { name: 'Skalierung falsch', mutate: d => { d.scale.c100 = d.scale.c100 + 50; return d; }, expectFail: ['Skalierung'] },
        { name: 'Schaltpunkte ohne Hysterese', mutate: d => { d.hyst = 0; return d; }, expectFail: ['Schaltpunkte'] }
      ] },

    { id: 'vw8', lab: 'vb', cat: 'Gartenbewässerung', title: 'Sensorknoten im Arduino programmieren', level: 3,
      on: 'code',
      text: 'Der Arduino liest den ADU-Wert an A0, mittelt über mehrere Messungen, rechnet mit deiner Skalierung in Millimeter um und meldet alle 100 Millisekunden seriell eine Zeile im Format FILL=<mm>;PUMP=<0/1>;ERR=<n>. PUMP ist 1, wenn der Füllstand mindestens die Schwelle min erreicht. Bei Drahtbruch ist ERR gleich 1. Dein Probelauf mit 120 Zeilen kommt in den Slot.',
      in: ['giess.sen'], out: 'giess.code', type: 'code.sketch', w: 100, pass: null,
      open: { ex: 'Serielle Meldung' },
      hint: ['Lies in einer Schleife mehrmals analogRead(A0), addiere die Werte und teile durch die Anzahl. Das dämpft das Rauschen. Mit acht Werten sinkt die Streuung auf gut ein Drittel.',
        'Umrechnung: mm = (Mittelwert − c0) · 1000 / (c100 − c0). Die Werte c0, c100 und die Drahtbruchschwelle cBreak kommen aus deiner Messketten-Station. Unter cBreak ist ERR gleich 1.',
        'Gib mit Serial.print die Teile FILL=, den Wert, ;PUMP=, 0 oder 1, ;ERR= und mit Serial.println die Fehlernummer aus. PUMP ist 1, wenn kein Fehler vorliegt und der Füllstand mindestens der Schwelle min entspricht. Dann delay(100).'],
      check: safe(checkCode, 'Sketch'),
      starter: ctx => ({ lang: 'arduino', src: 'void setup() {\n}\nvoid loop() {\n}\n', run: { serial: [], events: [] } }),
      probe: ctx => { const c = sketchCfg(ctx); return { T: 12.5, analog: { A0: { pts: probeProfile(c.l, c.P), noise: 3, seed: 2 } } }; },
      solution: ctx => codeSolution(ctx),
      mutants: [
        { name: 'ohne Mittelwert', mutate: d => { d.src = d.src.replace('for (int i = 0; i < 8; i++)', 'for (int i = 0; i < 1; i++)').replace('sum / 8.0', 'sum / 1.0'); return d; }, expectFail: ['Mittelwertbildung'] },
        { name: 'Drahtbruch nicht erkannt', mutate: d => { d.src = d.src.replace('if (avg < CBREAK) { err = 1; }', ''); return d; }, expectFail: ['Drahtbruch'] },
        { name: 'falsches Zeilenformat', mutate: d => { d.src = d.src.replace('";PUMP="', '", PUMP="'); return d; }, expectFail: ['Zeilenformat'] },
        { name: 'falsche Skalierung', mutate: d => { d.src = d.src.replace(/const float C100 = [\d.]+;/, 'const float C100 = 900.0;'); return d; }, expectFail: ['Umrechnung'] },
        { name: 'Probelauf fehlt', mutate: d => { d.run = { serial: [] }; return d; }, expectFail: ['Probelauf'] }
      ] },

    { id: 'vw9', lab: 'vb', cat: 'Gartenbewässerung', title: 'Gießplan in Python rechnen', level: 2,
      on: 'pi',
      text: 'Dein Python-Programm wertet das serielle Protokoll aus der Sensorknoten-Station aus. Im Kopf stehen daten (die Zeilen), Q_LPM, V_BEET_L, DT_S und MIN_MM. Gib die Zeilen LAUFZEIT_S, LITER, GIESSZEIT_S, FREIGABE (ja oder nein) und MIN_FUELL aus. Die Liter folgen aus Förderstrom mal Laufzeit.',
      in: ['giess.code'], out: 'giess.pi', type: 'pi.script', w: 100, pass: null,
      open: { ex: 'Daten auswerten' },
      hint: ['Gehe mit einer for-Schleife durch die Zeilen. Zerlege jede Zeile mit split(";") und danach split("=") und wandle die Werte mit float() und int() um.',
        'Laufzeit: Zeilen mit PUMP=1 mal DT_S. Liter = Q_LPM · Laufzeit / 60. Gießzeit für das Beet: V_BEET_L / Q_LPM · 60. Der kleinste Füllstand ist das Minimum aller FILL-Werte.',
        'Freigabe ist ja, wenn der kleinste Füllstand nicht unter MIN_MM liegt und kein ERR größer null vorkam, sonst nein. Gib alles als KEY=Wert aus, zum Beispiel print("LITER=" + str(round(liter, 2))).'],
      check: safe(checkPi, 'Auswertung'),
      starter: ctx => ({ lang: 'python', src: 'daten = []\nQ_LPM = 6.0\nV_BEET_L = 30\nDT_S = 0.1\nMIN_MM = 150\n', out: [] }),
      dataFor: ctx => piHeader(ctx),
      solution: ctx => piSolution(ctx),
      mutants: [
        { name: 'Liter ohne Umrechnung auf Minuten', mutate: d => { d.src = d.src.replace('liter = Q_LPM * lauf / 60', 'liter = Q_LPM * lauf'); return d; }, expectFail: ['LITER'] },
        { name: 'Ergebnis fest eingetragen statt gerechnet', mutate: d => { d.src = d.src.replace('print("LAUFZEIT_S=" + str(round(lauf, 1)))', 'print("LAUFZEIT_S=3.0")'); return d; }, expectFail: ['LAUFZEIT_S'] },
        { name: 'Freigabe ignoriert den Mindestfüllstand', mutate: d => { d.src = d.src.replace('if minfill >= MIN_MM and fehler == 0:', 'if fehler == 0:'); return d; }, expectFail: ['FREIGABE'] },
        { name: 'Zeile MIN_FUELL fehlt', mutate: d => { d.src = d.src.replace('print("MIN_FUELL=" + str(round(minfill, 0)))', ''); return d; }, expectFail: ['MIN_FUELL', 'Ausgabeformat'] },
        { name: 'Syntaxfehler', mutate: d => { d.src = d.src.replace('for z in daten:', 'for z in daten'); return d; }, expectFail: ['Ausgabeformat'] }
      ] },

    { id: 'vw10', lab: 'vb', cat: 'Gartenbewässerung', title: 'Pumpensteuerung programmieren', level: 3,
      on: 'sps',
      text: 'Programmiere die Pumpensteuerung an der Tankanlage: Der Start-Taster gießt für die Gießzeit aus deiner Python-Station, aber nur, wenn Wasser da ist. Ohne Wasser läuft die Pumpe nie, die Störlampe leuchtet. Das Nachspeiseventil füllt unter der mittleren Marke bis max und darf nie überlaufen lassen. Stopp und Not-Halt halten sofort an.',
      in: ['giess.pi', 'giess.sen', 'giess.ant'], out: 'giess.sps', type: 'sps.program', w: 100, pass: null,
      open: { ex: 'Tankanlage', plant: 'tank', opts: ctx => { const c = spsContext(ctx); return { thr: c.thr, pumpLpm: rd(c.qLpm, 2), tankL: c.tankL }; } },
      assist: { 1: { kind: 'rahmenprogramm' } },
      hint: ['Merke dir „Gießen läuft“ in einem Merker. Gesetzt wird er beim Start, aber nur wenn der Füllstandssensor min Wasser meldet. Gelöscht wird er, wenn die Zeit um ist, bei Stopp, Not-Halt oder Störung.',
        'Die Gießzeit ist ein Zeitglied (TON) auf dem Merker mit der Zeit aus GIESSZEIT_S in Millisekunden. Die Pumpe läuft, solange der Merker gesetzt, die Zeit nicht um und der Füllstand über min ist. Start ohne Wasser setzt einen Störungsmerker, der die Störlampe einschaltet.',
        'Nachspeisen mit Hysterese: Unter der mittleren Marke einen Merker setzen, bei „max“ zurücksetzen. Das Ventil öffnet nur, solange der Merker gesetzt und max nicht erreicht ist. Quittiert wird die Störung mit dem Stopp-Taster.'],
      check: safe(checkSps, 'SPS'),
      starter: ctx => ({ prog: { lang: 'kop', symbols: Object.assign({}, SYM), networks: [] }, plant: 'tank', opts: {}, lang: 'kop' }),
      solution: ctx => spsSolution(ctx),
      mutants: [
        { name: 'kein Trockenlaufschutz', mutate: d => { d.prog.networks.forEach(n => { if (n.id === 'N1' || n.id === 'N7') n.expr.in = n.expr.in.filter(e => !(e.a === 'I0.2')); }); d.prog.networks = d.prog.networks.filter(n => n.id !== 'N2' && n.id !== 'N3'); return d; }, expectFail: ['Trockenlaufschutz', 'Störmeldung'] },
        { name: 'Nachspeisen läuft über', mutate: d => { d.prog.networks.forEach(n => { if (n.id === 'N10') n.expr.in = n.expr.in.filter(e => !(e.a === 'I0.4')); }); d.prog.networks = d.prog.networks.filter(n => n.id !== 'N9'); return d; }, expectFail: ['Nachspeisen'] },
        { name: 'Gießzeit doppelt so lang', mutate: d => { d.prog.networks.forEach(n => { if (n.expr && n.expr.fb === 'ton') n.expr.pt = n.expr.pt * 2; }); return d; }, expectFail: ['Gießen: Start'] },
        { name: 'Not-Halt wirkt nicht auf die Pumpe', mutate: d => { d.prog.networks.forEach(n => { if (n.id === 'N7') n.expr.in = n.expr.in.filter(e => !(e.a === 'I0.6')); if (n.id === 'N5') n.expr.in = n.expr.in.filter(e => !(e.a === 'I0.6')); }); return d; }, expectFail: ['Stopp und Not-Halt'] },
        { name: 'keine Störlampe', mutate: d => { d.prog.networks = d.prog.networks.filter(n => n.id !== 'N11'); return d; }, expectFail: ['Störmeldung'] }
      ] }
  ];

  /* ====================================================================== Bericht, Selbsttest, Projektdefinition */
  function reportParts(slots, spec) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {}, g = k => (slots || {})[k] ? unwrap(slots[k]) : null;
    const ctx = { spec: { params: P }, slots: slots || {}, get: k => (slots || {})[k] };
    const out = [], haus = g('giess.haus'), ant = g('giess.ant'), dsp = g('giess.ds'), sch = g('giess.sch'), pcb = g('giess.pcb'), mess = g('giess.mess'), sen = g('giess.sen'), code = g('giess.code'), pi = g('giess.pi'), sps = g('giess.sps');
    out.push({ h: 'Lastenheft', rows: [['Pumpe', P.qSoll + ' l/min bei ' + P.H + ' m'], ['Beet', P.vBeetL + ' l'], ['Netzteil', fm(P.uSup, 0) + ' V, ' + P.pAvailW + ' W'], ['Zuleitung', P.lenM + ' m'], ['Schwellen min/mitte/max', P.thr.min + ' / ' + P.thr.mid + ' / ' + P.thr.max + ' %']] });
    if (haus) { const h = hausInfo(haus, P); out.push({ h: 'Außenanschluss', rows: [['FI', h.c && h.c.rcd ? 'Typ ' + h.c.rcd.type + ', ' + h.c.rcd.imaMa + ' mA' : '-'], ['Leitungsschutz', h.c && h.c.breaker ? h.c.breaker.type + h.c.breaker.inA : '-'], ['Spannungsfall', fm(h.dUpct, 2) + ' %'], ['Netzteil', fm(+haus.pAvailW, 0) + ' W']] }); }
    const an = ant ? pumpDerive(ant, ctx) : null;
    if (an && an.ok) out.push({ h: 'Pumpe und Antrieb', rows: [['Förderstrom', fm(an.qLpm, 2) + ' l/min'], ['Tastgrad', fm(an.duty, 1) + ' %'], ['Motorstrom', fm(an.iNom, 2) + ' A'], ['Anlaufstrom', fm(an.iStart, 1) + ' A'], ['Leistung', fm(an.pEl, 1) + ' W'], ['PWM-Frequenz', fm(an.fPwm, 0) + ' Hz']] });
    const pk = pickInfo(dsp); if (pk.ok) out.push({ h: 'Treiberbauteile', rows: [['MOSFET', refOf(pk.tr)], ['Freilaufdiode', refOf(pk.di)], ['T_j ohne Kühlkörper', fm(+pk.calc.tjC, 0) + ' °C'], ['Schaltverluste', fm(+pk.calc.pSwMW, 1) + ' mW']] });
    if (sch && isObj(sch.netlist)) out.push({ h: 'Schaltung und Stückliste', rows: sch.netlist.parts.map(p => [p.ref, p.kind + (p.value ? ' ' + p.value : '')]) });
    const b = pcb && asBoard(pcb.board); if (b && PCB()) { const r = boardReport(PCB().normalize(b)); out.push({ h: 'Platine', rows: [['Maße', fm(r.w, 0) + ' x ' + fm(r.h, 0) + ' mm, ' + r.layers + ' Lagen'], ['Bauteile', r.bomCount], ['DRC-Fehler', r.drcErrors], ['Kosten', fm(r.cost, 2) + ' €']] }); }
    if (mess) out.push({ h: 'Messprotokoll', rows: arr(mess.rows).map(r => [r.label || r.id, fm(+r.ist, 2) + ' ' + (r.unit || '') + (r.instrument ? ' (' + r.instrument + ')' : '')]) });
    const l = sen ? loopCalc(sen, P) : null;
    if (l && l.ok) out.push({ h: 'Füllstandsmesskette', rows: [['Bürde', fm(l.rB, 0) + ' Ω'], ['Versorgung (gemessen)', fm(l.uS, 2) + ' V'], ['Auflösung', fm(l.mmPerLsb, 2) + ' mm je Digit'], ['Drahtbruchschwelle', String(sen.scale && sen.scale.cBreak)]] });
    if (code && code.src) out.push({ h: 'Sensorknoten (Arduino)', html: '<pre>' + String(code.src).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>' });
    if (pi && pi.out) out.push({ h: 'Gießplan (Python)', rows: arr(pi.out).map(x => { const m = /^([^=]+)=(.*)$/.exec(String(x)); return m ? [m[1], m[2]] : [String(x), '']; }) });
    if (sps && isObj(sps.prog) && SPS()) { let txt = ''; try { txt = SPS().toText(sps.prog, 'iec', { symbols: true }); } catch (e) { txt = ''; } out.push({ h: 'SPS-Programm', html: '<pre>' + String(txt).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>' }); }
    return out;
  }
  function selfTest() {
    const r = [];
    try {
      const a = lastenheft(12345, 2), b = lastenheft(12345, 2);
      r.push({ ok: JSON.stringify(a) === JSON.stringify(b), text: 'Gießen: Lastenheft deterministisch' });
      const slots = {}, ctx = { spec: a, level: 2, tol: 1, slots: slots, get: k => slots[k] || null };
      let all = true;
      STATIONS.forEach(s => { const d = s.solution(ctx); slots[s.out] = d; const res = s.check(d, ctx); const sum = res.lines.reduce((p, l) => p + l.pts, 0), got = res.lines.filter(l => l.ok).reduce((p, l) => p + l.pts, 0); if (got !== sum || sum !== 100) all = false; });
      r.push({ ok: all, text: 'Gießen: Musterlösungen aller Stationen 100 %' });
    } catch (e) { r.push({ ok: false, text: 'Gießen: Selbsttest Fehler ' + (e && e.message) }); }
    return r;
  }

  const def = {
    id: PID, name: 'Smarte Gartenbewässerung', icon: '🌱', prefix: 'vw', order: 4,
    story: 'Der Kantinengarten der Tonfunk GmbH wird aus einer Regentonne bewässert. Die Lehrwerkstatt baut eine Steuerung, die gießt, wenn Wasser da ist, nie trocken läuft und genau so viel fördert wie nötig. Meister Funk mahnt: „Wasser und Strom vertragen sich nur, wenn der FI stimmt.“ Du planst den Außenanschluss, legst Pumpe, Treiber und Platine aus, misst, baust die Füllstandskette und programmierst am Ende die Steuerung.',
    company: 'Tonfunk GmbH Ermsleben',
    labs: ['haus', 'ant', 'ds', 'sch', 'pcb', 'mess', 'sen', 'code', 'pi', 'sps'],
    levels: { 1: { name: 'Einsteiger', pass: 70, tolMul: 1.5 }, 2: { name: 'Standard', pass: 80, tolMul: 1 }, 3: { name: 'Profi', pass: 90, tolMul: 0.6 } },
    lastenheft: lastenheft,
    stations: STATIONS,
    final: {
      id: 'vwF', title: 'Abschlusstest: Ein Tag im Garten', check: finalCheck,
      solution: ctx => { const slots = {}, c = Object.assign({}, ctx, { get: k => slots[k] || null, slots: slots }); STATIONS.forEach(s => { slots[s.out] = s.solution(c); }); return { slots: slots }; },
      mutants: [
        { name: 'Pumpensteuerung leer', mutate: s => { s['giess.sps'] = { prog: { lang: 'kop', symbols: {}, networks: [] }, plant: 'tank' }; return s; }, expectFail: ['Ein Tag im Garten'] },
        { name: 'Zuleitung ohne FI', mutate: s => { s['giess.haus'].circuits[0].rcd = null; return s; }, expectFail: ['Sicherheit'] },
        { name: 'Drahtbruchschwelle zu niedrig', mutate: s => { s['giess.sen'].scale.cBreak = 10; return s; }, expectFail: ['Messkette'] }
      ]
    },
    kpis: ['wasserTag', 'pumpeW', 'fetC', 'aufloesung', 'drahtbruch', 'spannungsfall'],
    report: reportParts,
    selfTest: selfTest,
    _test: { pumpDerive: pumpDerive, loopCalc: loopCalc, PUMP: PUMP, expectedPlan: expectedPlan, buildProgram: buildProgram, hausInfo: hausInfo, fetCalc: fetCalc },
    demos: [{ id: 'bis4', name: 'Gartenbewässerung bis Station 4', upTo: 'vw4' }, { id: 'fertig', name: 'Gartenbewässerung fertig', upTo: 'vwF' }]
  };

  /* ---------- Registrierung ---------- */
  const V = root.Verbund || (typeof require === 'function' && typeof module !== 'undefined' ? (function () { try { return require('./verbund.js'); } catch (e) { return null; } })() : null);
  if (V && typeof V.registerProject === 'function') V.registerProject(def);
  else { root.VERBUND_QUEUE = root.VERBUND_QUEUE || []; root.VERBUND_QUEUE.push(def); }
  if (typeof module !== 'undefined' && module.exports) module.exports = def;
  root.VERBUND_GIESS = def;
})(typeof window !== 'undefined' ? window : globalThis);
