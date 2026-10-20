/* verbunddata-ampel.js - Verbundprojekt 2: Ampelanlage / Verkehr (Projektdefinition, Paket P2)
 * Format laut quelle/verbund/SPEC.md, Abschnitte 4 und 9.2. Lädt unabhängig von der Reihenfolge, auch in Node.
 * Registriert sich bei window.Verbund (registerProject); ist der Kern noch nicht da, wartet die Definition in window.VERBUND_QUEUE.
 * In Node liefert module.exports die Definition (def) selbst.
 * Benötigt zur Laufzeit der Prüfungen (alle rein rechnerisch, ohne Browser): dscore.js + dslib-semi.js + dslib-ic.js (7805), spscore.js +
 * spsplant-ampel.js, verbundnl.js (nl.equiv) und verbundrun.js (runSketch/runPython; dazu arduino.js und pyrun.js).
 * Die Strom-/Spannungsmodelle der LED-Kanäle stehen bewusst in dieser Datei (Gleichstrom-Rechnung wie in verbunddata-garage.js),
 * damit die Prüfung weder simcore.js noch simics.js braucht.
 *
 * Slot-Formate (Daten der Hülle), von den Adaptern zu liefern:
 *   ds.pick       { items:[{role:'led'|'transistor'|'regler', ds, part, ref}], vals:{rV, pRv, rB, hfeKey}, calc:{iLedMa, iSumMa, pRegW, tjReg} }
 *   sch.circuit   { lab, name, netlist, meas:{U_12V (V), U_5V (V), I_LED<k> (A; auch I_LED<k>_mA in mA) ...}, snap }       Kanal k: RVk (R), Dk (LED), Qk (NPN|NMOS), RBk (R), Sk (SPST); U1 (REG 7805), C1, C2, V1 (BAT 12)
 *   loch.layout   { name, netlist, boards, bom:[{ref,kind,value}], doc:{items:[...]}, wiresRibbon }
 *   mess.protocol { rows:[{id,label,unit,soll,ist,tol,instrument,tp?}], values:{u5v}, findings:[text] }   ids: U_12V, U_5V, I_LED1.., U_CE1..
 *   sen.chain     { rig:'licht', preset:'', ctl:{sensor:'ldr', rLoad, thresh, hyst, ambient, fdelay}, bits, vref, nachtBelow, tagAbove (Formularwerte oben), state, derived }
 *   code.sketch   { lang:'arduino', src, run?:{ serial, events, nightTimeline? } }       A0 = LDR-Zählwert, D7 = Nachtsignal, D9 = PWM der Signalgeber
 *   sps.program   { prog, plant:'ampel', opts, lang }          der Betriebslog (ampel.log, sps.log) wird aus dem Programm neu gerechnet (def.logFor)
 *   pi.script     { lang:'python', src, out:[Zeilen] }         daten = [[Zeit s, Anforderung, Fussgaenger-Gruen, Nacht], ...] im Kopf (station.dataFor(ctx), def.stationData)
 * Werte mit (A) sind Annahmen (Lehrwerte), siehe SPEC Abschnitt 8 und 13.3. */
(function (root) {
  'use strict';

  const PID = 'ampel';
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

  /* ---------- Kerne und Bibliotheken (erst zur Laufzeit gelesen) ---------- */
  const DS = () => root.DS_CORE, LIB = () => root.DS_LIB, SPS = () => root.SPS_CORE, PLANTS = () => root.SPS_PLANTS;
  function tryReq(f) { try { if (typeof require === 'function') return require(f); } catch (e) { /* nicht vorhanden */ } return null; }
  const NLB = () => root.VerbundNL || (root.Verbund && root.Verbund.nl) || tryReq('./verbundnl.js');
  const RUN = () => (root.Verbund && typeof root.Verbund.runSketch === 'function' ? root.Verbund : null) || root.VerbundRun || tryReq('./verbundrun.js');
  function numOf(v) {                         // '4k7', '12V', '330', 4700 -> Zahl, sonst NaN
    if (fin(v)) return v;
    const s = String(v == null ? '' : v).trim();
    if (!s) return NaN;
    const d = DS();
    if (d && d.parseWithUnit) { const r = d.parseWithUnit(s); if (r && fin(r.value)) return r.value; }
    const m = /^(\d+(?:[.,]\d+)?)\s*([kKMm]?)/.exec(s);
    return m ? parseFloat(m[1].replace(',', '.')) * ({ k: 1e3, K: 1e3, M: 1e6, m: 1e-3 }[m[2]] || 1) : NaN;
  }
  const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
  function e12up(x) {                         // nächster E12-Wert, der nicht kleiner als x ist
    if (!(x > 0)) return NaN;
    const dec = Math.pow(10, Math.floor(Math.log10(x)));
    for (let k = 0; k < E12.length; k++) { const v = E12[k] * dec; if (v >= x * (1 - 1e-9)) return rd(v, 6); }
    return rd(10 * dec, 6);
  }
  function isE(v, series) {                   // Wert in E12/E24?
    if (!fin(v) || v <= 0) return false;
    const d = DS();
    if (d && d.eSeries) { const n = d.eSeries(series || 'E12', v, 'nearest'); return fin(n) && Math.abs(n - v) <= 1e-6 * v; }
    const dec = Math.pow(10, Math.floor(Math.log10(v)));
    return E12.some(m => Math.abs(m * dec - v) <= 1e-6 * v);
  }
  const eList = [];                           // alle E12-Werte von 100 Ω bis 100 kΩ
  [100, 1000, 10000].forEach(dec => E12.forEach(m => eList.push(Math.round(m * dec))));
  eList.push(100000);

  /* ====================================================================== Modelle der LED-Kanäle (Gleichstrom) */
  /* Konstanten aus dem Übungsdatenblatt (tf-led-r: U_F 1,91 V bei 10 mA und 2,0 V bei 20 mA, typ.; tf-bc547: U_CE,sat 0,09 V bei 10 mA und 0,2 V bei 100 mA, typ.),
     bewusst fest, damit das Lastenheft nicht vom Laden der Datenblätter abhängt (ein Test vergleicht sie mit den Datenblättern). */
  const LED_UF = [1.91, 2.0], VCE_SAT = [0.09, 0.2], U_BE = 0.7;
  const ufOf = iMa => LED_UF[0] + (LED_UF[1] - LED_UF[0]) * clamp((iMa - 10) / 10, 0, 1);
  const vceOf = iMa => VCE_SAT[0] + (VCE_SAT[1] - VCE_SAT[0]) * clamp((iMa - 10) / 90, 0, 1);
  const RIG = { vcc: 5, r10: 10000, gamma: 0.7 };               // LDR-Teiler wie im Prüfstand "Licht" (senrig-opt.js): LDR oben an 5 V, Lastwiderstand nach Masse
  const IPORT_MAX = 5, I_Q_TYP = 5, I_Q_MAX = 8;                  // (A) Portbelastung in mA; Ruhestrom 7805 aus dem Datenblatt (typ. 5 mA, max. 8 mA)
  /* LED-Strom in mA bei Vorwiderstand rV (Ω), 12-V-Versorgung v12; mos: MOSFET mit R_DS(on) rds (Ω) statt Transistor */
  function ledI(rV, v12, mos, rds) {
    if (!(rV > 0)) return NaN;
    let i = 15;
    for (let k = 0; k < 16; k++) { const uce = mos ? i / 1000 * (rds || 2.6) : vceOf(i); i = (v12 - ufOf(i) - uce) / rV * 1000; if (!(i > 0)) { i = 0; break; } }
    return i;
  }
  /* d = { mos, rV, rB, hfe, rds }, o = { v12, v5, rvMul, ledRev } -> { i (mA), uce (V), sat } */
  function chanSim(d, o) {
    o = o || {};
    const v12 = o.v12 == null ? 12 : o.v12, v5 = o.v5 == null ? 5 : o.v5, rV = d.rV * (o.rvMul || 1), rds = d.rds || 2.6;
    if (!fin(rV) || !(rV > 0)) return { i: NaN, uce: NaN, sat: false };
    if (o.ledRev) return { i: 0, uce: 0.02, sat: true };
    let iB = 0;
    if (d.mos) { if (!(v5 > 2.1)) return { i: 0, uce: v12, sat: false }; }
    else iB = fin(d.rB) && d.rB > 0 ? Math.max(0, (v5 - U_BE) / d.rB) * 1000 : 0;
    const i = ledI(rV, v12, d.mos, rds), uce = d.mos ? i / 1000 * rds : vceOf(i);
    if (!d.mos) {
      const ipot = (d.hfe || 200) * iB;
      if (ipot <= 0) return { i: 0, uce: v12, sat: false };
      if (ipot < i) return { i: ipot, uce: v12 - ufOf(ipot) - ipot / 1000 * rV, sat: false };
    }
    return { i: i, uce: uce, sat: true };
  }
  const TOLMUL = { 1: 1.5, 2: 1, 3: 0.6 };
  const lowOf = tol => 1 - 0.15 * tol;                           // untere Grenze des LED-Stroms (Anteil von iLed); Aufrunden auf E12 kostet bis zu 17 %
  /* Ströme für das Lastenheft: nur Werte, bei denen der nächste E12-Wert nach oben die Toleranz der Stufe einhält ("nur lösbare Kombinationen") */
  function ledCandidates(level) {
    const low = lowOf(TOLMUL[level]) + 0.012;
    const base = level === 1 ? [10, 15, 18] : level === 2 ? [10, 11, 12, 13, 14, 15, 16, 17, 18, 19] : [10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5];
    return base.filter(i => {
      const rA = (12 - ufOf(i)) / (i / 1000), rB = (12 - ufOf(i) - vceOf(i)) / (i / 1000);          // Handrechnung ohne und mit U_CE,sat
      return [rA, rB].every(rx => ledI(e12up(rx), 12) / i >= low);
    });
  }

  /* ====================================================================== Lastenheft */
  const IO = [
    { key: 'I0.0', sym: 'S1_Fussgaengertaster', text: 'S1 Fußgängertaster (Schließer)' },
    { key: 'I0.1', sym: 'S2_Betrieb', text: 'S2 Betrieb: 1 = Tagbetrieb, 0 = Nacht (kommt vom Arduino)' },
    { key: 'I0.2', sym: 'B1_Schleife', text: 'B1 Induktionsschleife (1 = Fahrzeug an der Haltelinie)' },
    { key: 'Q0.0', sym: 'H1_Strasse_rot', text: 'H1 Ampel Straße rot' },
    { key: 'Q0.1', sym: 'H2_Strasse_gelb', text: 'H2 Ampel Straße gelb' },
    { key: 'Q0.2', sym: 'H3_Strasse_gruen', text: 'H3 Ampel Straße grün' },
    { key: 'Q0.3', sym: 'H4_Fuss_rot', text: 'H4 Fußgängerampel rot' },
    { key: 'Q0.4', sym: 'H5_Fuss_gruen', text: 'H5 Fußgängerampel grün' }
  ];
  const PIN_NACHT = 7, PIN_PWM = 9;
  function faultOf(P) { const m = P && typeof P.fault === 'string' ? /^(rv10|ledRev):(\d+)$/.exec(P.fault) : null; return m ? { kind: m[1], ch: +m[2] } : null; }   // Aufbaufehler Stufe 3

  function lastenheft(seed, level) {
    level = level === 1 || level === 3 ? level : 2;
    const r = rng((seed >>> 0) ^ 0x3c6ef372);
    const nCh = [1, 3, 5][level - 1];
    const cand = ledCandidates(level), iLed = pick(r, cand.length ? cand : [10]);
    const lWeg = pick(r, [6, 7, 8]), vPed = 1.2;
    const luxNacht = level === 1 ? pick(r, [10, 20, 30]) : level === 2 ? 10 + 5 * Math.floor(r() * 5) : 10 + Math.floor(r() * 21);
    const iLogik = pick(r, [80, 100, 120]);
    const dev12 = pick(r, level === 1 ? [-0.1, 0.1] : [-0.2, -0.1, 0.1, 0.2]), dev5 = pick(r, [-0.08, -0.05, -0.03, 0.03, 0.05, 0.08]);
    const fault = level === 3 ? pick(r, ['rv10', 'ledRev']) + ':' + (1 + Math.floor(r() * nCh)) : null;      // 'rv10:<Kanal>' oder 'ledRev:<Kanal>'
    const p = {
      lWeg: lWeg, vPed: vPed, tPedGruen: Math.ceil(lWeg / vPed - 1e-9), tGelb: 3, tRotGelb: 1, tSperr: 2, tMinKfzGruen: 8, tMaxWait: 40,
      uSup: 12, uLogik: 5, nCh: nCh, iLed: iLed, tAmb: 40, iLogik: iLogik, iNetz: 300,
      luxNacht: luxNacht, luxTag: 2 * luxNacht, dutyNacht: 30, adcBits: 10, noiseMv: [20, 25, 30][level - 1],
      dev12: dev12, dev5: dev5, fault: fault, plantSeed: 1 + Math.floor(r() * 9000), pinNacht: PIN_NACHT, pinPwm: PIN_PWM
    };
    const text = [
      'Projekt Ampelanlage / Verkehr, Stufe ' + level + ' (' + (level === 1 ? 'Einsteiger' : level === 2 ? 'Standard' : 'Profi') + ').',
      'Signalgeber: ' + nCh + ' ' + (nCh > 1 ? 'Leuchtkanäle' : 'Leuchtkanal') + ' mit je einer LED, ' + fm(iLed, iLed % 1 ? 1 : 0) + ' mA je Kanal (A), Versorgung ' + p.uSup + ' V, Umgebung ' + p.tAmb + ' °C (A). Der Netzteilstrom ist auf ' + p.iNetz + ' mA begrenzt (A).',
      'Logik: 5 V aus 12 V über den Festregler 7805, Logikstrom ' + iLogik + ' mA (A). Der Arduino steuert die Kanäle über Transistoren (Portstrom höchstens ' + IPORT_MAX + ' mA, A).',
      'Fußgängerüberweg: Fahrbahn ' + lWeg + ' m, Räumgeschwindigkeit ' + fm(vPed, 1) + ' m/s (A), also Fußgänger-Grün ' + p.tPedGruen + ' s (aufgerundet).',
      'Zeiten (A): Gelb ' + p.tGelb + ' s, Rot-Gelb ' + p.tRotGelb + ' s, Sperrzeit (alles Rot) ' + p.tSperr + ' s, Mindest-Grün für die Straße ' + p.tMinKfzGruen + ' s, Fußgänger warten höchstens ' + p.tMaxWait + ' s.',
      'Dämmerung: Nacht unter ' + luxNacht + ' lx, Tag über ' + p.luxTag + ' lx (A). Nachts blinkt Gelb mit 1 Hz, die Kanäle werden auf ' + p.dutyNacht + ' % gedimmt (A).',
      'Messkette: LDR im Teiler (LDR oben an 5 V), ' + p.adcBits + '-Bit-ADU mit der gemessenen 5-V-Schiene als Referenz, Rauschen ' + p.noiseMv + ' mV effektiv (A). Arduino: A0 = LDR, D' + PIN_NACHT + ' = Nachtsignal, D' + PIN_PWM + ' = PWM der Signalgeber.'
    ];
    if (fault) text.push('Hinweis Inbetriebnahme: Der Prototyp enthält einen Aufbaufehler. Finde ihn.');
    return { params: p, text: text, io: IO.map(clone) };
  }

  /* ====================================================================== Netzlisten-Hilfen (privat) */
  const PINNAMES = {
    R: ['1', '2'], C: ['1', '2'], CE: ['1', '2'], SPST: ['1', '2'], PB: ['1', '2'], SPDT: ['COM', 'NC', 'NO'], D: ['A', 'K'], LED: ['A', 'K'],
    NPN: ['B', 'C', 'E'], NMOS: ['G', 'D', 'S'], REG: ['IN', 'GND', 'OUT'], BAT: ['+', '-']
  };
  const OFFB = { BAT: 1, AC: 1, GND: 1, SPST: 1, SPDT: 1, PB: 1, PBC: 1, CLK: 1, VM: 1, AM: 1, OHM: 1, NETZ: 1, LSS: 1 };   // Bauteile, die nicht aufs Raster gehören
  function nlIdx(nl) {
    const ix = { ok: false, net: {}, nets: {}, parts: {}, dups: [] };
    if (!isObj(nl)) return ix;
    arr(nl.parts).forEach(p => { if (isObj(p) && typeof p.ref === 'string') ix.parts[p.ref] = p; });
    arr(nl.nets).forEach(n => {
      if (!isObj(n) || typeof n.name !== 'string') return;
      if (!ix.nets[n.name]) ix.nets[n.name] = [];
      arr(n.pins).forEach(pin => { pin = String(pin); if (ix.net[pin] !== undefined && ix.net[pin] !== n.name) ix.dups.push(pin); if (ix.net[pin] === undefined) ix.nets[n.name].push(pin); ix.net[pin] = n.name; });
    });
    Object.keys(ix.parts).forEach(ref => {
      const pp = ix.parts[ref].pins;
      if (isObj(pp)) Object.keys(pp).forEach(k => { const a = ref + '.' + k; if (ix.net[a] === undefined && typeof pp[k] === 'string' && pp[k]) { ix.net[a] = pp[k]; (ix.nets[pp[k]] = ix.nets[pp[k]] || []).push(a); } });
    });
    ix.ok = Object.keys(ix.parts).length > 0;
    return ix;
  }
  const netOf = (ix, ref, pin) => ix.net[ref + '.' + pin];
  function byRef(a, b) { const ma = /^(\D*)(\d*)/.exec(a.ref), mb = /^(\D*)(\d*)/.exec(b.ref); return ma[1] === mb[1] ? (+ma[2] || 0) - (+mb[2] || 0) : (ma[1] < mb[1] ? -1 : 1); }
  const ofKind = (ix, kinds) => Object.keys(ix.parts).map(k => ix.parts[k]).filter(p => kinds.split(',').indexOf(p.kind) >= 0).sort(byRef);
  const pinsOf = p => PINNAMES[p.kind] || Object.keys(p.pins || {});
  const otherNet = (ix, p, net) => { const k = pinsOf(p), a = netOf(ix, p.ref, k[0]), b = netOf(ix, p.ref, k[1]); return a === net ? b : b === net ? a : undefined; };
  const touches = (ix, p, net) => net !== undefined && pinsOf(p).some(k => netOf(ix, p.ref, k) === net);
  const refOf = ds => (ds ? String(ds.ref || ds.part || ds.id) : '');
  const valueIs = (value, ds) => { const a = lc(value).replace(/[\s-]/g, ''), b = lc(refOf(ds)).replace(/[\s-]/g, ''); return !!b && (a === b || a.indexOf(b) >= 0); };
  function fmtR(v) { v = rd(v, 6); return v >= 1e6 ? rd(v / 1e6, 3) + 'M' : v >= 1000 ? rd(v / 1000, 3) + 'k' : String(rd(v, 3)); }
  const fmtRde = v => fmtR(v).replace('.', ',');
  function nlBuilder(name) {
    const parts = [], nets = {}, order = [];
    const b = {
      add(ref, kind, value, pins, props) {
        const pt = { ref: ref, kind: kind, value: value == null ? '' : String(value), pins: Object.assign({}, pins) }; if (props) pt.props = Object.assign({}, props);   // props z. B. { sw: 1 }: Schalter geschlossen
        parts.push(pt);
        Object.keys(pins).forEach(k => { const n = pins[k]; if (!nets[n]) { nets[n] = []; order.push(n); } nets[n].push(ref + '.' + k); });
        return b;
      },
      done() { return { v: 1, name: name, parts: parts, nets: order.map(n => ({ name: n, cls: /^(GND|VCC|V5)$/.test(n) ? 'power' : 'signal', pins: nets[n].slice() })) }; }
    };
    return b;
  }
  /* Platinen-Sicht: nur bestückbare Bauteile, nur Netze mit mindestens zwei solchen Anschlüssen (Quellen und Schalter bleiben draußen) */
  function boardView(nl) {
    const ix = nlIdx(nl); if (!ix.ok) return null;
    const keep = {}; Object.keys(ix.parts).forEach(r => { if (!OFFB[ix.parts[r].kind]) keep[r] = 1; });
    const nets = [], pinNet = {};
    Object.keys(ix.nets).forEach(n => {
      const pins = ix.nets[n].filter(p => keep[p.slice(0, p.indexOf('.'))]);
      if (pins.length >= 2) { nets.push({ name: n, cls: 'signal', pins: pins }); pins.forEach(p => { pinNet[p] = n; }); }
    });
    const parts = Object.keys(keep).sort((a, b) => byRef({ ref: a }, { ref: b })).map(r => { const p = ix.parts[r], pins = {}; Object.keys(isObj(p.pins) ? p.pins : {}).forEach(k => { if (pinNet[r + '.' + k]) pins[k] = pinNet[r + '.' + k]; }); return { ref: r, kind: p.kind, value: p.kind === 'LED' ? '' : p.value, pins: pins }; });      // LED-Farbe ist egal
    return { v: 1, name: nl.name || '', parts: parts, nets: nets };
  }
  function equivBoards(a, b) {
    const Lb = NLB(), A = boardView(a), B = boardView(b);
    if (!Lb || typeof Lb.equiv !== 'function') return { ok: false, errs: ['Die Netzlisten-Bibliothek (verbundnl.js) fehlt.'], shorts: false };
    if (!A || !B) return { ok: false, errs: [!A ? 'Der Schaltplan hat keine Netzliste.' : 'Das Lochraster hat keine Netzliste.'], shorts: false };
    const r = Lb.equiv(A, B, { extra: 'allow' });
    return { ok: r.ok, errs: r.errs, shorts: r.errs.some(e => /Kurzschluss/.test(e)) };
  }

  /* Schienen: 12-V-Netz, Masse und 5-V-Netz aus Quelle bzw. Regler */
  function railsOf(ix, P) {
    const bats = ofKind(ix, 'BAT'), b12 = bats.find(b => Math.abs(numOf(b.value) - P.uSup) <= 0.5), reg = ofKind(ix, 'REG')[0];
    let vcc, gnd;
    if (b12) { vcc = netOf(ix, b12.ref, '+'); gnd = netOf(ix, b12.ref, '-'); }
    if (reg) { if (vcc === undefined) vcc = netOf(ix, reg.ref, 'IN'); if (gnd === undefined) gnd = netOf(ix, reg.ref, 'GND'); }
    return { vcc: vcc, gnd: gnd, v5: reg ? netOf(ix, reg.ref, 'OUT') : undefined, hasSource: !!b12, reg: reg || null };
  }
  function drivenNet(ix, n, v5) {            // Steuernetz wird aus der 5-V-Schiene gespeist (Schalter oder 5-V-Quelle)?
    if (n === undefined) return false;
    return arr(ix.nets[n]).some(pin => {
      const dot = pin.indexOf('.'), ref = pin.slice(0, dot), pn = pin.slice(dot + 1), p = ix.parts[ref];
      if (!p) return false;
      if (p.kind === 'BAT' && pn === '+' && Math.abs(numOf(p.value) - 5) <= 0.3) return true;
      if (p.kind === 'SPST' || p.kind === 'PB' || p.kind === 'SPDT') return pinsOf(p).some(k => k !== pn && netOf(ix, ref, k) === v5 && v5 !== undefined);
      return p.kind === 'REG' && pn === 'OUT';
    });
  }
  /* Kanäle: je Transistor die Reihenschaltung 12 V - R_V - LED - Kollektor, Emitter an Masse, R_B an der Basis */
  function findChannels(ix, P, R, needDrive) {
    return ofKind(ix, 'NPN,NMOS').map((q, i) => {
      const mos = q.kind === 'NMOS', pb = mos ? 'G' : 'B', pc = mos ? 'D' : 'C', pe = mos ? 'S' : 'E';
      const c = { k: i + 1, q: q, mos: mos, errs: [], ledRev: false, rv: null, led: null, rb: null };
      c.nB = netOf(ix, q.ref, pb); c.nC = netOf(ix, q.ref, pc); c.nE = netOf(ix, q.ref, pe);
      if (R.gnd === undefined || c.nE !== R.gnd) c.errs.push(q.ref + ': Emitter liegt nicht an Masse');
      let chain = null;
      ofKind(ix, 'R,LED').filter(p => touches(ix, p, c.nC)).some(x => {
        const nm = otherNet(ix, x, c.nC);
        if (nm === undefined || nm === R.vcc || nm === R.gnd) return false;
        const y = R.vcc === undefined ? null : ofKind(ix, 'R,LED').find(p => p !== x && p.kind !== x.kind && touches(ix, p, nm) && otherNet(ix, p, nm) === R.vcc);
        if (y) { chain = { x: x, y: y }; return true; }
        return false;
      });
      if (!chain) c.errs.push(q.ref + ': keine Reihenschaltung 12 V - Vorwiderstand - LED - Kollektor');
      else {
        c.led = chain.x.kind === 'LED' ? chain.x : chain.y; c.rv = chain.x.kind === 'R' ? chain.x : chain.y;
        c.ledRev = chain.x.kind === 'LED' ? netOf(ix, c.led.ref, 'K') !== c.nC : netOf(ix, c.led.ref, 'A') !== R.vcc;
        if (c.ledRev) c.errs.push(c.led.ref + ': LED verkehrt herum (Anode zur 12-V-Seite)');
      }
      const rbs = ofKind(ix, 'R').filter(r => r !== c.rv && touches(ix, r, c.nB));
      if (rbs.length) { c.rb = rbs[0]; c.nIn = otherNet(ix, c.rb, c.nB); }
      else { c.nIn = c.nB; if (!mos) c.errs.push(q.ref + ': kein Basiswiderstand an der Basis'); }
      c.driven = drivenNet(ix, c.nIn, R.v5);
      if (needDrive && !c.driven) c.errs.push(q.ref + ': der Steuereingang hängt nicht an der 5-V-Schiene (Schalter oder Quelle)');
      c.good = c.errs.length === 0;
      return c;
    });
  }
  function regInfo(ix, R) {
    const o = { errs: [], ok: false, part: R.reg, cin: false, cout: false };
    if (!R.reg) { o.errs.push('kein Festregler (REG 7805) in der Schaltung'); return o; }
    const reg = R.reg, nIn = netOf(ix, reg.ref, 'IN'), nG = netOf(ix, reg.ref, 'GND'), nO = netOf(ix, reg.ref, 'OUT');
    if (!/7805/.test(String(reg.value))) o.errs.push('der Regler ist kein 7805');
    if (nIn === undefined || nIn !== R.vcc) o.errs.push('der Reglereingang liegt nicht an den 12 V');
    if (nG === undefined || nG !== R.gnd) o.errs.push('der Regler hat keine Masse');
    if (nO === undefined || nO === R.vcc || nO === R.gnd) o.errs.push('der Reglerausgang liegt nicht an einem eigenen 5-V-Netz');
    const caps = ofKind(ix, 'C,CE');
    o.cin = caps.some(c => touches(ix, c, nIn) && touches(ix, c, nG)); o.cout = caps.some(c => touches(ix, c, nO) && touches(ix, c, nG));
    o.ok = !o.errs.length;
    return o;
  }

  /* ====================================================================== Datenblatt-Hilfen */
  const dsOf = id => { const l = LIB(); return l && l.byId ? l.byId[id] || null : null; };
  function dsRow(ds, key) { if (!ds) return null; const all = arr(ds.abs).concat(arr(ds.elec), arr(ds.rec)); return all.find(r => r.key === key) || null; }
  function dsVal(row, field) {
    if (!row || !fin(row[field == null ? 'max' : field])) return NaN;
    const d = DS(); const x = d && d.toSI ? d.toSI(row[field == null ? 'max' : field], row.unit) : row[field == null ? 'max' : field];
    return fin(x) ? x : NaN;
  }
  const recMax = (ds, key) => { const r = ds && arr(ds.rec).find(x => x.key === key); return r ? dsVal(r, 'max') : NaN; };
  const isMos = ds => !!ds && ds.family === 'MOSFET';
  function dsByRef(v) { const l = LIB(); if (!l || !l.byId) return null; const k = Object.keys(l.byId).find(id => valueIs(v, l.byId[id])); return k ? l.byId[k] : null; }
  function pickInfo(pk) {
    const o = { ok: false, why: '', tr: null, led: null, reg: null, vals: {}, calc: {}, items: [] };
    if (!isObj(pk)) { o.why = 'Auswahl fehlt'; return o; }
    o.items = arr(pk.items).filter(isObj);
    const f = role => o.items.find(x => x.role === role);
    const it = f('transistor'), il = f('led'), ir = f('regler');
    o.tr = it ? dsOf(it.ds) : null; o.led = il ? dsOf(il.ds) : null; o.reg = ir ? dsOf(ir.ds) : null;
    o.vals = isObj(pk.vals) ? pk.vals : {}; o.calc = isObj(pk.calc) ? pk.calc : {};
    o.rV = numOf(o.vals.rV); o.rB = numOf(o.vals.rB); o.pRv = numOf(o.vals.pRv); o.hfeKey = typeof o.vals.hfeKey === 'string' ? o.vals.hfeKey : '';
    o.mos = isMos(o.tr);
    o.ok = !!(o.tr && o.reg);
    return o;
  }
  const hfeTyp = (ds, key) => { const r = dsRow(ds, key) || arr(ds && ds.elec).find(x => /^hfe/.test(x.key)); return r && fin(r.typ) ? r.typ : (r && fin(r.min) ? r.min * 1.6 : 200); };
  /* Kanalparameter für chanSim aus Auswahl, ggf. mit Werten aus dem Plan */
  function chanParams(pi, rV, rB, trValue) {
    const tr = trValue !== undefined ? (dsByRef(trValue) || pi.tr) : pi.tr, mos = isMos(tr);
    return { mos: mos, rV: rV, rB: rB, hfe: mos ? 0 : hfeTyp(tr, tr === pi.tr ? pi.hfeKey : ''), rds: mos ? (dsVal(dsRow(tr, 'rds45'), 'typ') || 2.6) : 0 };
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
  const normId = s => lc(s).replace(/[^a-z0-9]/g, '');
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
  const dropPart = (nl, ref) => { nl.parts = nl.parts.filter(p => p.ref !== ref); nl.nets.forEach(n => { n.pins = n.pins.filter(p => p.indexOf(ref + '.') !== 0); }); return nl; };

  /* ====================================================================== va1: LED-Kanal und Versorgung rechnen (Datenblatt-Lab) */
  const PR_LIST = [0.125, 0.25, 0.5, 1, 2];
  function chooseRb(P, hmin) {
    const iBreq = 2 * (P.iLed / 1000) / hmin, rMax = (P.uLogik - U_BE) / iBreq, rMin = (P.uLogik - U_BE) / (IPORT_MAX / 1000);
    const c = eList.filter(r => r >= rMin * 0.9999 && r <= rMax * 1.0001);
    if (!c.length) return null;
    const mid = Math.sqrt(rMin * rMax);
    c.sort((a, b) => Math.abs(Math.log(a / mid)) - Math.abs(Math.log(b / mid)));
    return c[0];
  }
  const regTh = reg => { const t = reg && isObj(reg.thermal) ? reg.thermal : {}; return { rth: fin(+t.rthJA) ? +t.rthJA : 50, tjMax: fin(+t.tjMax) ? +t.tjMax : 125 }; };
  function dsSolution(ctx, variant) {
    const P = P_(ctx), uf = ufOf(P.iLed), rV = e12up((P.uSup - uf) / (P.iLed / 1000)), iTxt = (P.uSup - uf) / rV * 1000;
    const iModel = ledI(rV, P.uSup), pNeed = 2 * Math.pow(iModel / 1000, 2) * rV;
    const pRv = PR_LIST.find(x => x >= pNeed) || 2;
    const th = regTh(dsOf('tf-7805')), pReg = (P.uSup - P.uLogik) * P.iLogik / 1000 + P.uSup * I_Q_TYP / 1000;
    const base = {
      items: [{ role: 'led', ds: 'tf-led-r', part: 'TF-LED-R5', ref: 'LED 5 mm rot' }, null, { role: 'regler', ds: 'tf-7805', part: 'TF-7805', ref: '7805' }],
      calc: { iLedMa: rd(iTxt, 2), iSumMa: rd(P.nCh * iModel + P.iLogik + I_Q_TYP, 1), pRegW: rd(pReg, 3), tjReg: rd(P.tAmb + pReg * th.rth, 1) },
      vals: { rV: rV, pRv: pRv }
    };
    if (variant === 'mos') {
      base.items[1] = { role: 'transistor', ds: 'tf-2n7000', part: 'TF-2N7000', ref: '2N7000' };
      base.vals.rB = 100; base.vals.hfeKey = '';
    } else {
      const hmin = dsVal(dsRow(dsOf('tf-bc547'), 'hfeB'), 'min'), rB = chooseRb(P, hmin) || 4700;
      base.items[1] = { role: 'transistor', ds: 'tf-bc547', part: 'TF-BC547', ref: 'BC547' };
      base.vals.rB = rB; base.vals.hfeKey = 'hfeB';
    }
    return base;
  }
  function checkDs(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], pi = pickInfo(data), i0 = P.iLed, rV = pi.rV;
    const ist = fin(rV) && rV > 0 ? ledI(rV, P.uSup) : NaN, low = lowOf(tol), ifRec = recMax(pi.led || dsOf('tf-led-r'), 'if') * 1000;
    // R_V
    const calcOk = !fin(+pi.calc.iLedMa) || sameVal(+pi.calc.iLedMa, ist, 0.08);
    lines.push(L(fin(ist) && isE(rV, 'E12') && ist >= low * i0 - 1e-9 && ist <= 1.02 * i0 && (!fin(ifRec) || ist <= ifRec + 1e-9) && calcOk,
      'Vorwiderstand R_V: ' + (fin(rV) ? fmtRde(rV) + ' Ω' + (isE(rV, 'E12') ? ' (E12)' : ' (nicht aus E12)') + ', LED-Strom ' + fm(ist, 1) + ' mA' : 'nicht eingetragen') + ', verlangt ' + fm(i0, 1) + ' mA (nach dem Aufrunden auf E12 zwischen ' + fm(low * i0, 1) + ' und ' + fm(1.02 * i0, 1) + ' mA, höchstens ' + fm(ifRec, 0) + ' mA)' + (calcOk ? '' : ' – dein angegebener Strom passt nicht zu R_V'), 25));
    // Leistung
    const pNeed = fin(ist) ? 2 * Math.pow(ist / 1000, 2) * rV : NaN;
    lines.push(L(fin(pi.pRv) && fin(pNeed) && pi.pRv >= pNeed - 1e-12, 'Leistung des Vorwiderstands: P = ' + (fin(pNeed) ? fm(pNeed / 2 * 1000, 0) + ' mW' : '?') + ', gewählt ' + (fin(pi.pRv) ? fm(pi.pRv, 3) + ' W' : 'nichts') + ' (mindestens 2 · P = ' + (fin(pNeed) ? fm(pNeed * 1000, 0) + ' mW' : '?') + ')', 15));
    // Transistor
    const tr = pi.tr, iC = i0 / 1000;
    const vceo = tr ? dsVal(dsRow(tr, pi.mos ? 'vds' : 'vceo'), 'max') : NaN, icmax = tr ? dsVal(dsRow(tr, pi.mos ? 'id' : 'ic'), 'max') : NaN;
    lines.push(L(tr && vceo >= 2 * P.uSup && icmax >= 2 * iC, 'Transistor-Grenzwerte: ' + (tr ? 'U_max ' + fm(vceo, 0) + ' V (nötig mindestens ' + fm(2 * P.uSup, 0) + ' V), I_max ' + fm(icmax * 1000, 0) + ' mA (nötig mindestens ' + fm(2 * i0, 0) + ' mA)' : 'kein Transistor gewählt'), 8));
    if (pi.mos) {
      const vth = dsVal(dsRow(tr, 'vgsth'), 'max');
      lines.push(L(vth < P.uLogik - 1, 'Gate-Schwelle: V_GS(th),max ' + fm(vth, 1) + ' V muss kleiner sein als ' + fm(P.uLogik - 1, 1) + ' V (Logikpegel minus 1 V)', 12));
    } else {
      const hrow = tr ? dsRow(tr, pi.hfeKey) : null, hmin = hrow ? dsVal(hrow, 'min') : NaN;
      const iBreq = fin(hmin) ? 2 * iC / hmin : NaN, iBist = fin(pi.rB) && pi.rB > 0 ? (P.uLogik - U_BE) / pi.rB : NaN;
      lines.push(L(tr && fin(iBreq) && fin(iBist) && iBist >= iBreq * (1 - 1e-9) && iBist <= IPORT_MAX / 1000 * (1 + 1e-9) && isE(pi.rB, 'E12'),
        'Basisstrom: nötig mindestens ' + fm(iBreq * 1000, 2) + ' mA (Übersteuerung 2 mit h_FE,min ' + fm(hmin, 0) + '), tatsächlich ' + fm(iBist * 1000, 2) + ' mA, der Port liefert höchstens ' + IPORT_MAX + ' mA (A), R_B ' + (fin(pi.rB) ? fmtRde(pi.rB) + ' Ω' + (isE(pi.rB, 'E12') ? '' : ' (nicht aus E12)') : 'fehlt') + (!hrow ? ' – h_FE-Zeile fehlt' : ''), 12));
    }
    // Summenstrom
    const ii = fin(ist) ? ist : i0, lo = P.nCh * ii + P.iLogik + I_Q_TYP, hi = P.nCh * Math.max(i0, ii) + P.iLogik + I_Q_MAX, sum = +pi.calc.iSumMa;
    lines.push(L(fin(sum) && sum >= 0.95 * lo && sum <= 1.05 * hi && hi <= P.iNetz, 'Summenstrom aus dem Netzteil: ' + (fin(sum) ? fm(sum, 0) + ' mA' : 'nicht berechnet') + ', erwartet etwa ' + fm(lo, 0) + ' bis ' + fm(hi, 0) + ' mA (' + P.nCh + ' Kanäle + Logik ' + P.iLogik + ' mA + Ruhestrom), das Netzteil liefert ' + P.iNetz + ' mA (A)', 15));
    // Regler
    const reg = pi.reg, is7805 = !!reg && reg.id === 'tf-7805', th = regTh(reg);
    lines.push(L(is7805, 'Festregler: ' + (reg ? refOf(reg) : 'keiner gewählt') + ', verlangt ist der 7805 (5 V aus 12 V)', 5));
    const pLo = (P.uSup - P.uLogik) * P.iLogik / 1000, pHi = pLo + P.uSup * I_Q_MAX / 1000, pr = +pi.calc.pRegW;
    lines.push(L(is7805 && fin(pr) && pr >= 0.95 * pLo && pr <= 1.05 * pHi, 'Verlustleistung des Reglers P = (U_ein − U_aus) · I + U_ein · I_Q: ' + (fin(pr) ? fm(pr * 1000, 0) + ' mW' : 'nicht berechnet') + ', erwartet etwa ' + fm(pLo * 1000, 0) + ' bis ' + fm(pHi * 1000, 0) + ' mW', 10));
    const tjs = +pi.calc.tjReg, der = is7805 && DS() ? DS().derate(reg, { tAmb: P.tAmb, ptot: (pLo + pHi) / 2 }) : null;
    lines.push(L(is7805 && fin(tjs) && fin(pr) && Math.abs(tjs - (P.tAmb + pr * th.rth)) <= 3 && tjs <= th.tjMax && !!der && der.ok, 'Sperrschichttemperatur T_j = T_amb + P · R_thJA: ' + (fin(tjs) ? fm(tjs, 0) + ' °C' : 'nicht berechnet') + ', erwartet ' + (fin(pr) ? fm(P.tAmb + pr * th.rth, 0) : fm(P.tAmb + pLo * th.rth, 0)) + ' °C bei ' + P.tAmb + ' °C Umgebung, Grenze ' + th.tjMax + ' °C', 10));
    return lines;
  }

  /* ====================================================================== va2: Signalgeber-Treiber und 5-V-Versorgung zeichnen (SchaltLab) */
  function buildSch(P, pk) {
    const pi = pickInfo(pk), b = nlBuilder('Signalgeber Ampel');
    const rV = fin(pi.rV) ? pi.rV : 1000, rB = pi.mos ? (fin(pi.rB) ? pi.rB : 100) : (fin(pi.rB) ? pi.rB : 4700), meas = {};
    b.add('V1', 'BAT', String(P.uSup), { '+': 'VCC', '-': 'GND' });
    b.add('U1', 'REG', '7805', { IN: 'VCC', GND: 'GND', OUT: 'V5' });
    b.add('C1', 'C', '330n', { '1': 'VCC', '2': 'GND' });
    b.add('C2', 'C', '100n', { '1': 'V5', '2': 'GND' });
    const sim = chanSim(chanParams(pi, rV, rB), {});
    for (let k = 1; k <= P.nCh; k++) {
      b.add('RV' + k, 'R', fmtR(rV), { '1': 'VCC', '2': 'NL' + k });
      b.add('D' + k, 'LED', 'rot', { A: 'NL' + k, K: 'NC' + k });
      if (pi.mos) b.add('Q' + k, 'NMOS', refOf(pi.tr), { G: 'NB' + k, D: 'NC' + k, S: 'GND' });
      else b.add('Q' + k, 'NPN', refOf(pi.tr), { B: 'NB' + k, C: 'NC' + k, E: 'GND' });
      b.add('RB' + k, 'R', fmtR(rB), { '1': 'NIN' + k, '2': 'NB' + k });
      b.add('S' + k, 'SPST', '', { '1': 'V5', '2': 'NIN' + k }, { sw: 1 });   // geschlossen: die Musterlösung zeigt im Lab den Strom je LED
      meas['I_LED' + k] = rd(sim.i / 1000, 6);
    }
    meas.U_12V = P.uSup; meas.U_5V = 5;
    return { lab: 'sch', name: 'Signalgeber Ampel', netlist: b.done(), meas: meas, snap: {} };
  }
  /* Kanalströme aus einer Netzliste (Plan oder Lochraster) mit den eingetragenen Werten */
  function simNetlist(ix, P, pi, R, chans) {
    return chans.map(c => {
      if (!c.good) return { i: NaN, uce: NaN };
      const rv = numOf(c.rv.value), rb = c.rb ? numOf(c.rb.value) : 0;
      return chanSim(chanParams(pi, rv, rb, c.q.value), { v12: P.uSup, v5: 5 });
    });
  }
  function analyseNl(nl, P, needDrive) {
    const ix = nlIdx(nl), o = { ix: ix };
    o.R = ix.ok ? railsOf(ix, P) : {}; o.chans = ix.ok ? findChannels(ix, P, o.R, needDrive) : []; o.ri = ix.ok ? regInfo(ix, o.R) : { ok: false, errs: ['keine Schaltung (Netzliste leer)'], cin: false, cout: false };
    return o;
  }
  function openPins(ix) {
    const bad = [];
    Object.keys(ix.parts).forEach(ref => {
      const p = ix.parts[ref];
      if (!PINNAMES[p.kind]) return;
      PINNAMES[p.kind].forEach(k => { const nn = netOf(ix, ref, k); if (nn === undefined || arr(ix.nets[nn]).length < 2) bad.push(ref + '.' + k); });
    });
    return bad;
  }
  function checkSch(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], pi = pickInfo(need(ctx, 'ampel.ds'));
    const a = analyseNl(data && data.netlist, P, true), ix = a.ix, R = a.R, chans = a.chans, ri = a.ri, n = P.nCh;
    // 1: Werte entsprechen der Auswahl
    const e1 = [];
    if (!pi.ok) e1.push('die Auswahl der Datenblatt-Station fehlt');
    else if (!chans.length) e1.push('keine Kanäle gezeichnet');
    else {
      chans.forEach(c => {
        if (c.rv && !sameVal(numOf(c.rv.value), pi.rV, 1e-3)) e1.push('R_V in Kanal ' + c.k + ' ist ' + c.rv.value + ' statt ' + fmtR(pi.rV));
        if (!valueIs(c.q.value, pi.tr)) e1.push('Transistor in Kanal ' + c.k + ' ist „' + c.q.value + '“ statt ' + refOf(pi.tr));
        if (!pi.mos && c.rb && !sameVal(numOf(c.rb.value), pi.rB, 1e-3)) e1.push('R_B in Kanal ' + c.k + ' ist ' + c.rb.value + ' statt ' + fmtR(pi.rB));
      });
      if (!R.reg || !valueIs(R.reg.value, pi.reg)) e1.push('Regler ist „' + (R.reg ? R.reg.value : 'keiner') + '“ statt ' + refOf(pi.reg));
    }
    lines.push(L(pi.ok && e1.length === 0, 'Bauteilwerte entsprechen der Auswahl (R_V ' + (fin(pi.rV) ? fmtRde(pi.rV) + ' Ω' : '?') + ', Transistor ' + (pi.tr ? refOf(pi.tr) : '?') + ', R_B ' + (fin(pi.rB) ? fmtRde(pi.rB) + ' Ω' : '?') + ', Regler ' + (pi.reg ? refOf(pi.reg) : '?') + ')' + (e1.length ? ' – ' + e1[0] : ''), 20));
    // 2: Topologie je Kanal
    const good = chans.filter(c => c.good).length, firstErr = (chans.find(c => !c.good) || { errs: [] }).errs[0];
    lines.push(L(good === n && chans.length === n, 'Topologie: ' + good + ' von ' + n + ' Kanälen richtig (12 V – R_V – LED – Transistor, Emitter an Masse, Basis über R_B, Steuereingang an der 5-V-Schiene)' + (chans.length > n ? ' – es sind ' + chans.length + ' Transistoren gezeichnet' : firstErr ? ' – ' + firstErr : ''), 25));
    // 3: Regler-Beschaltung
    lines.push(L(ri.ok && ri.cin && ri.cout, 'Regler-Beschaltung: 7805 zwischen 12 V und 5-V-Netz, Kondensator am Eingang ' + (ri.cin ? 'vorhanden' : 'fehlt') + ', am Ausgang ' + (ri.cout ? 'vorhanden' : 'fehlt') + (ri.errs.length ? ' – ' + ri.errs[0] : ''), 10));
    // 4: Simulation LED-Strom
    const sims = simNetlist(ix, P, pi, R, chans), is = sims.map(s => s.i).filter(fin);
    const okI = good === n && chans.length === n && is.length === n && is.every(i => Math.abs(i - P.iLed) <= 0.15 * tol * P.iLed + 1e-9);
    lines.push(L(okI, 'Simulation: LED-Strom je Kanal ' + (is.length ? fm(Math.min.apply(null, is), 1) + ' bis ' + fm(Math.max.apply(null, is), 1) + ' mA' : 'nicht auswertbar') + ', erwartet ' + fm(P.iLed, 1) + ' mA (±' + fm(15 * tol, 0) + ' %)', 20));
    // 5: U_5V
    const u5 = ri.ok ? 5.0 : NaN;
    lines.push(L(fin(u5) && u5 >= 4.8 && u5 <= 5.2, 'Simulation: 5-V-Schiene ' + (fin(u5) ? fm(u5, 2) + ' V' : 'ohne Spannung (Regler falsch angeschlossen)') + ' (4,8 bis 5,2 V)', 5));
    // 6: meas passt zum Plan
    const m = data && isObj(data.meas) ? data.meas : {};
    let mOk = fin(+m.U_5V) && fin(u5) && Math.abs(+m.U_5V - u5) <= 0.03 * u5 && is.length === n;
    const mv = [], sv = is.slice().sort((x, y) => x - y);          // Ströme in A (Engine-Adapter) oder mA (_mA), Reihenfolge der Kanäle egal
    for (let k = 1; k <= n; k++) mv.push(fin(+m['I_LED' + k]) ? +m['I_LED' + k] * 1000 : +m['I_LED' + k + '_mA']);
    mv.sort((x, y) => x - y);
    for (let k = 0; k < n && mOk; k++) if (!fin(mv[k]) || !fin(sv[k]) || Math.abs(mv[k] - sv[k]) > 0.05 * Math.abs(sv[k]) + 0.2) mOk = false;
    lines.push(L(mOk, 'Messwerte der Simulation (meas) stimmen mit dem gezeichneten Plan überein: U_5V und LED-Strom je Kanal', 5));
    // 7: Pins
    const bad = ix.ok ? openPins(ix) : [];
    lines.push(L(ix.ok && bad.length === 0 && ix.dups.length === 0 && chans.length === n, 'Alle Pins zugeordnet (' + Object.keys(ix.parts).length + ' Bauteile, ' + Object.keys(ix.nets).length + ' Netze), alle ' + n + ' Kanäle vorhanden' + (bad.length ? ' – offen: ' + bad.slice(0, 3).join(', ') : ix.dups.length ? ' – Pin in zwei Netzen: ' + ix.dups[0] : ''), 15));
    return lines;
  }

  /* ====================================================================== va3: Prototyp auf dem Lochraster (LochLab) */
  function buildLoch(P, sch) {
    const nl = boardView(sch.netlist); nl.name = 'Prototyp Ampel';
    const bom = nl.parts.map(p => ({ ref: p.ref, kind: p.kind, value: p.value }));
    const items = nl.parts.map((p, i) => ({ id: i + 1, t: 'part', k: p.kind, x: 4 + (i % 8) * 6, y: 4 + Math.floor(i / 8) * 6, r: 0, v: p.value, l: p.ref }));
    return { name: 'Prototyp Ampel', netlist: nl, boards: 1, bom: bom, doc: { items: items }, wiresRibbon: 0 };
  }
  function bomKey(p) { const v = numOf(p.value); return p.kind + '|' + (p.kind === 'LED' ? '' : fin(v) ? rd(v, 6) : lc(p.value).replace(/\s/g, '')); }
  const BOMKINDS = { R: 1, C: 1, CE: 1, LED: 1, NPN: 1, NMOS: 1, REG: 1, D: 1 };
  function docRules(doc) {
    const items = isObj(doc) && Array.isArray(doc.items) ? doc.items : null;
    if (!items) return { ok: true, msg: '' };
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!isObj(it)) return { ok: false, msg: 'Eintrag ' + (i + 1) + ' im Layout ist ungültig' };
      if (it.t === 'part') { if (!fin(+it.x) || !fin(+it.y)) return { ok: false, msg: 'Bauteil ' + (it.l || i + 1) + ' hat keine Rasterposition' }; }
      else if (it.t === 'track' || it.t === 'wire') {
        const c = [it.x1, it.y1, it.x2, it.y2].map(Number);
        if (!c.every(x => Number.isInteger(x))) return { ok: false, msg: (it.t === 'wire' ? 'Draht' : 'Lötbahn') + ' ' + (i + 1) + ' liegt nicht auf Rasterpunkten' };
        if (c[0] === c[2] && c[1] === c[3]) return { ok: false, msg: (it.t === 'wire' ? 'Draht' : 'Lötbahn') + ' ' + (i + 1) + ' hat keine Länge' };
        if (it.t === 'track' && c[0] !== c[2] && c[1] !== c[3]) return { ok: false, msg: 'Lötbahn ' + (i + 1) + ' verläuft schräg (nur waagerecht oder senkrecht)' };
      }
    }
    return { ok: true, msg: '' };
  }
  function checkLoch(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], sch = need(ctx, 'ampel.sch'), nl = data && data.netlist;
    const eq = equivBoards(sch && sch.netlist, nl), ixL = nlIdx(nl), nParts = ixL.ok ? Object.keys(ixL.parts).filter(r => !OFFB[ixL.parts[r].kind]).length : 0;
    lines.push(L(nParts > 0 && eq.ok, 'Netze identisch zum Schaltplan (jeder Pin im richtigen Netz)' + (eq.errs.length ? ' – ' + eq.errs[0] + (eq.errs.length > 1 ? ' (+' + (eq.errs.length - 1) + ' weitere)' : '') : ''), 35));
    const exp = boardView(sch && sch.netlist), missing = exp ? exp.parts.filter(p => !ixL.parts[p.ref]).map(p => p.ref) : ['?'];
    lines.push(L(nParts > 0 && missing.length === 0, 'Alle Bauteile platziert: ' + nParts + ' von ' + (exp ? exp.parts.length : '?') + ' Bauteilen auf dem Raster' + (missing.length ? ' – es fehlt ' + missing.slice(0, 3).join(', ') : ''), 12));
    const dr = docRules(data && data.doc);
    lines.push(L(nParts > 0 && dr.ok && fin(+(data && data.boards)) && +data.boards >= 1, 'Raster-Regeln: Lötbahnen waagerecht oder senkrecht auf Rasterpunkten, Drähte nur auf der Bestückungsseite' + (dr.msg ? ' – ' + dr.msg : ''), 8));
    lines.push(L(nParts > 0 && !eq.shorts, 'Keine Kurzschlüsse zwischen Netzen' + (nParts === 0 ? ' – das Raster ist leer' : eq.shorts ? ' – ' + (eq.errs.find(e => /Kurzschluss/.test(e)) || '') : ''), 15));
    // Simulation des Rasters
    const pi = pickInfo(need(ctx, 'ampel.ds')), a = analyseNl(nl, P, false), sims = simNetlist(a.ix, P, pi, a.R, a.chans), is = sims.map(s => s.i).filter(fin), good = a.chans.filter(c => c.good).length;
    const okI = nParts > 0 && good === P.nCh && a.chans.length === P.nCh && is.length === P.nCh && a.ri.ok && is.every(i => Math.abs(i - P.iLed) <= 0.15 * tol * P.iLed + 1e-9);
    lines.push(L(okI, 'Simulation des Rasters: LED-Strom ' + (is.length ? fm(Math.min.apply(null, is), 1) + ' bis ' + fm(Math.max.apply(null, is), 1) + ' mA' : 'nicht auswertbar') + ', erwartet ' + fm(P.iLed, 1) + ' mA (±' + fm(15 * tol, 0) + ' %)' + (good === P.nCh ? '' : ' – ' + good + ' von ' + P.nCh + ' Kanälen erkannt' + ((a.chans.find(c => !c.good) || { errs: [] }).errs[0] ? ': ' + a.chans.find(c => !c.good).errs[0] : '')) + (a.ri.ok ? '' : ' – ' + a.ri.errs[0]), 20));
    // Stückliste
    const want = {}, have = {};
    if (exp) exp.parts.forEach(p => { if (BOMKINDS[p.kind]) { const k = bomKey(p); want[k] = (want[k] || 0) + 1; } });
    arr(data && data.bom).forEach(p => { if (isObj(p) && BOMKINDS[p.kind]) { const k = bomKey(p); have[k] = (have[k] || 0) + 1; } });
    const diff = Object.keys(want).concat(Object.keys(have)).filter((k, i, l) => l.indexOf(k) === i && want[k] !== have[k]);
    lines.push(L(arr(data && data.bom).length > 0 && diff.length === 0, 'Stückliste ohne Abweichung zum Schaltplan (' + Object.keys(want).length + ' verschiedene Bauteile)' + (diff.length ? ' – Abweichung bei ' + diff[0].replace('|', ' ') + ' (soll ' + (want[diff[0]] || 0) + ', Liste ' + (have[diff[0]] || 0) + ')' : ''), 10));
    return lines;
  }

  /* ====================================================================== va4: Prototyp prüfen (MessLab) */
  function messTruth(ctx, withFault) {
    const P = P_(ctx), pi = pickInfo(need(ctx, 'ampel.ds')), rV = fin(pi.rV) ? pi.rV : 1000, rB = fin(pi.rB) ? pi.rB : 4700, d = chanParams(pi, rV, rB);
    const o = { u12: withFault ? P.uSup + P.dev12 : P.uSup, u5: withFault ? 5 + P.dev5 : 5, ch: [] };
    for (let k = 1; k <= P.nCh; k++) {
      const opt = { v12: o.u12, v5: o.u5 };
      const ft = withFault ? faultOf(P) : null;
      if (ft && ft.ch === k) { if (ft.kind === 'rv10') opt.rvMul = 10; else opt.ledRev = true; }
      const s = chanSim(d, opt); o.ch.push({ i: s.i, uce: s.uce });
    }
    return o;
  }
  function messSpec(P) {
    const rows = [{ id: 'U_12V', key: 'u12v', label: 'Versorgung 12 V', unit: 'V', get: t => t.u12 }, { id: 'U_5V', key: 'u5v', label: '5-V-Schiene', unit: 'V', get: t => t.u5 }];
    for (let k = 1; k <= P.nCh; k++) {
      rows.push({ id: 'I_LED' + k, key: 'iled' + k, label: 'LED-Strom Kanal ' + k, unit: 'mA', get: t => t.ch[k - 1].i });
      rows.push({ id: 'U_CE' + k, key: 'uce' + k, label: 'Spannung am Treiber Kanal ' + k, unit: 'V', get: t => t.ch[k - 1].uce });
    }
    return rows;
  }
  const alloc = (total, n) => { const b = Math.floor(total / n), x = total - b * n, r = []; for (let i = 0; i < n; i++) r.push(b + (i < x ? 1 : 0)); return r; };
  const scaleTo = (v, unit, base) => { const u = String(unit || base); if (u === 'mV' && base === 'V') return v / 1000; if (u === 'A' && base === 'mA') return v * 1000; if (u === 'µA' && base === 'mA') return v / 1000; if (u === 'V' && base === 'mA') return NaN; return v; };
  const rowOf = (rows, key) => arr(rows).find(r => isObj(r) && normId(r.id || r.label) === key) || null;
  const rowVal = (r, base) => { if (!r) return NaN; const v = fin(r.ist) ? r.ist : numOf(typeof r.ist === 'string' ? r.ist.replace(',', '.') : r.ist); return fin(v) ? scaleTo(v, r.unit, base) : NaN; };
  function checkMess(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], rows = arr(data && data.rows), truth = messTruth(ctx, true), design = messTruth(ctx, false), spec = messSpec(P), ft = faultOf(P), f3 = !!ft;
    const pts = alloc(f3 ? 50 : 70, spec.length);
    spec.forEach((s, idx) => {
      const r = rowOf(rows, s.key), v = rowVal(r, s.unit), t = s.get(truth), dd = s.get(design), tl = Math.max(0.03 * tol * Math.abs(t), (s.unit === 'mA' ? 0.2 : 0.02) * tol);
      lines.push(L(r && fin(v) && Math.abs(v - t) <= tl, s.id + ': ' + (fin(v) ? 'gemessen ' + fm(v, 2) + ' ' + s.unit : 'nicht eingetragen') + ', erwartet ' + fm(t, 2) + ' ' + s.unit + ' (±' + fm(tl, 2) + ')' + (Math.abs(t - dd) > tl ? ' – hier weicht der Prototyp vom Entwurf ab' : ''), pts[idx]));
    });
    const u5 = data && isObj(data.values) ? +data.values.u5v : NaN, u5t = truth.u5;
    lines.push(L(fin(u5) && Math.abs(u5 - u5t) <= 0.005 * u5t, 'Messwert der 5-V-Schiene mit drei Stellen (values.u5v): ' + (fin(u5) ? fm(u5, 3) + ' V' : 'nicht eingetragen') + ', erwartet ' + fm(u5t, 3) + ' V (±0,5 %) – dieser Wert ist später die ADU-Referenz', 10));
    // Protokoll
    const loch = slotOf(ctx, 'ampel.loch'), lix = nlIdx(loch && loch.netlist), miss = [];
    spec.forEach(s => { const r = rowOf(rows, s.key); if (!r || !fin(rowVal(r, s.unit)) || !String(r.unit || '').trim() || !String(r.instrument || '').trim()) miss.push(s.id); });
    const badTp = rows.filter(r => isObj(r) && r.tp && lix.ok && !lix.nets[r.tp]);
    lines.push(L(miss.length === 0 && badTp.length === 0, 'Protokoll vollständig: ' + spec.length + ' Messzeilen mit Wert, Einheit und Messgerät, Prüfpunkte liegen im Lochraster' + (miss.length ? ' – fehlt: ' + miss[0] : badTp.length ? ' – Prüfpunkt „' + badTp[0].tp + '“ gibt es im Lochraster nicht' : ''), 20));
    if (f3) {
      const f = arr(data && data.findings).map(lc).join(' | '), k = ft.ch;
      const chOk = new RegExp('(kanal|k|ch|spalte)\\s*[-_]?\\s*' + k + '(?!\\d)|(^|[^\\d])' + k + '(\\.|\\s*(\\.|-)?\\s*kanal)').test(f);
      let kindOk;
      if (ft.kind === 'rv10') kindOk = /(vorwiderstand|widerstand|r_?v|rv)/.test(f) && /(zu gro|zu hoch|zehn|10 ?x|10-fach|10fach|verzehnfacht|statt)/.test(f);
      else kindOk = /led/.test(f) && /(verpol|falsch ?herum|umgekehrt|verkehrt|falsch gepolt|polarit|falsch eingebaut)/.test(f);
      lines.push(L(chOk && kindOk, 'Fehler benannt: ' + (ft.kind === 'rv10' ? 'Vorwiderstand in Kanal ' + k + ' zehnmal zu groß' : 'LED in Kanal ' + k + ' verpolt') + (f ? '' : ' – kein Befund eingetragen') + (f && !chOk ? ' – der Kanal fehlt im Befund' : ''), 20));
    }
    return lines;
  }
  function messSolution(ctx) {
    const P = P_(ctx), t = messTruth(ctx, true), d = messTruth(ctx, false), loch = need(ctx, 'ampel.loch'), lix = nlIdx(loch && loch.netlist);
    const tp = addr => lix.net[addr] || '';
    const rows = messSpec(P).map(s => {
      let ins = 'Multimeter', net = '';
      if (s.id === 'U_12V') net = tp('U1.IN'); else if (s.id === 'U_5V') net = tp('U1.OUT');
      else { const k = +/\d+/.exec(s.id)[0]; net = s.id.indexOf('I_LED') === 0 ? tp('RV' + k + '.2') : tp('Q' + k + '.C'); }
      return { id: s.id, label: s.label, unit: s.unit, soll: rd(s.get(d), 3), ist: rd(s.get(t), 3), tol: 3, instrument: ins, tp: net };
    });
    const findings = [];
    const ft = faultOf(P);
    if (ft) findings.push(ft.kind === 'rv10' ? 'Kanal ' + ft.ch + ': Der Vorwiderstand ist zehnmal zu groß, der LED-Strom ist viel zu klein.' : 'Kanal ' + ft.ch + ': Die LED ist verpolt eingebaut, es fließt kein Strom.');
    return { rows: rows, values: { u5v: rd(t.u5, 3) }, findings: findings };
  }

  /* ====================================================================== va5: Dämmerungssensor (Sensorik-Lab) */
  const ldrR = lux => RIG.r10 * Math.pow(10 / Math.max(lux, 1e-6), RIG.gamma);                 // R = R10 · (E / 10 lx)^(-γ)  (= SEN_CORE.formulas.ldrResistance)
  const ldrLux = R => 10 * Math.pow(R / RIG.r10, -1 / RIG.gamma);                                // E = 10 lx · (R / R10)^(-1/γ)  (= SEN_CORE.formulas.ldrLux)
  const divU = (lux, rLoad) => RIG.vcc * rLoad / (rLoad + ldrR(lux));
  const full = bits => Math.pow(2, bits);
  function luxOfCount(c, bits, vref, rLoad) {
    const u = c * vref / full(bits);
    if (!(u > 0) || !(u < RIG.vcc)) return NaN;
    return ldrLux(rLoad * (RIG.vcc - u) / u);
  }
  const sigmaCounts = (P, bits, vref) => Math.sqrt(Math.pow(P.noiseMv / (1000 * vref / full(bits)), 2) + 1 / 12);
  function senRead(d, P) {
    d = isObj(d) ? d : {};
    const ctl = isObj(d.ctl) ? d.ctl : {}, adc = isObj(d.adc) ? d.adc : {}, cn = isObj(d.counts) ? d.counts : {};
    const num1 = (...xs) => { for (let i = 0; i < xs.length; i++) { const x = xs[i], v = numOf(typeof x === 'string' ? x.replace(',', '.') : x); if (fin(v)) return v; } return NaN; };
    // Formularwerte der Leiste stehen oben in den Daten (bits, vref, nachtBelow, tagAbove); die verschachtelte Form (adc, counts) wird ebenfalls gelesen
    const o = { sensor: lc(ctl.sensor), rLoad: numOf(ctl.rLoad), bits: num1(d.bits, adc.bits), vref: num1(d.vref, adc.vref), nB: num1(d.nachtBelow, cn.nachtBelow), tA: num1(d.tagAbove, cn.tagAbove) };
    o.valid = fin(o.rLoad) && o.rLoad > 0 && Number.isInteger(o.bits) && o.bits >= 4 && o.bits <= 16 && Number.isInteger(o.nB) && Number.isInteger(o.tA) && o.nB >= 0 && o.tA >= 0 && o.nB < full(o.bits) && o.tA < full(o.bits);
    return o;
  }
  const measU5 = ctx => { const m = slotOf(ctx, 'ampel.mess'); let v = m && isObj(m.values) ? +m.values.u5v : NaN; if (!fin(v) && m) v = rowVal(rowOf(arr(m.rows), 'u5v'), 'V'); return v; };
  function checkSen(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], s = senRead(data, P), vTrue = P.uLogik + P.dev5, u5m = measU5(ctx);
    const luxN = s.valid ? luxOfCount(s.nB, s.bits, vTrue, s.rLoad) : NaN, luxT = s.valid ? luxOfCount(s.tA, s.bits, vTrue, s.rLoad) : NaN;
    const wn = 0.15 * tol * P.luxNacht, wt = 0.15 * tol * P.luxTag, why = s.valid ? '' : ' – Werte unvollständig (Widerstand, Bitzahl, Zählwerte)';
    lines.push(L(s.valid && fin(luxN) && Math.abs(luxN - P.luxNacht) <= wn, 'Nachtschwelle: Zählwert ' + (fin(s.nB) ? s.nB : '?') + ' entspricht ' + fm(luxN, 1) + ' lx, verlangt ' + P.luxNacht + ' lx (±' + fm(wn, 1) + ' lx)' + why, 17));
    lines.push(L(s.valid && fin(luxT) && Math.abs(luxT - P.luxTag) <= wt, 'Tagschwelle: Zählwert ' + (fin(s.tA) ? s.tA : '?') + ' entspricht ' + fm(luxT, 1) + ' lx, verlangt ' + P.luxTag + ' lx (±' + fm(wt, 1) + ' lx)' + why, 18));
    lines.push(L(fin(s.vref) && fin(u5m) && Math.abs(s.vref - u5m) <= 0.005 * u5m, 'ADU-Referenz: verwendet ' + (fin(s.vref) ? fm(s.vref, 3) + ' V' : '?') + ', gemessen in Station 4: ' + (fin(u5m) ? fm(u5m, 3) + ' V' : '? (Messprotokoll fehlt)') + ' (±0,5 %)', 20));
    const sg = s.valid ? sigmaCounts(P, s.bits, vTrue) : NaN, hy = s.valid ? s.tA - s.nB : NaN;
    lines.push(L(s.valid && hy > 0 && hy >= 3 * sg, 'Hysterese: ' + (fin(hy) ? hy + ' Zählwerte' : '?') + ' zwischen Nacht- und Tagschwelle, das Rauschen ' + (fin(sg) ? fm(sg, 1) : '?') + ' Zählwerte (σ) verlangt mindestens 3σ = ' + (fin(sg) ? fm(3 * sg, 1) : '?'), 25));
    const span = s.valid ? divU(P.luxTag, s.rLoad) - divU(P.luxNacht, s.rLoad) : NaN, lsb = s.valid ? vTrue / full(s.bits) : NaN;
    lines.push(L(s.valid && fin(span) && lsb <= span / 50, 'Auflösung: LSB ' + (fin(lsb) ? fm(lsb * 1000, 2) + ' mV' : '?') + ', Spannungsunterschied zwischen Nacht und Tag ' + (fin(span) ? fm(span * 1000, 0) + ' mV' : '?') + ' (LSB höchstens 1/50, also ' + (fin(span) ? fm(span / 50 * 1000, 1) : '?') + ' mV)', 10));
    lines.push(L(s.sensor === 'ldr' && fin(s.rLoad) && isE(s.rLoad, 'E12'), 'Teilerwiderstand ' + (fin(s.rLoad) ? fmtRde(s.rLoad) + ' Ω' + (isE(s.rLoad, 'E12') ? ' (E12)' : ' (nicht aus E12)') : 'fehlt') + ', Sensor ' + (s.sensor === 'ldr' ? 'LDR' : '„' + (s.sensor || '?') + '“ statt LDR'), 10));
    return lines;
  }
  function senSolution(ctx) {
    const P = P_(ctx), rMid = Math.sqrt(ldrR(P.luxNacht) * ldrR(P.luxTag));
    const rLoad = eList.reduce((b, c) => (Math.abs(Math.log(c / rMid)) < Math.abs(Math.log(b / rMid)) ? c : b), eList[0]);
    let u5 = measU5(ctx); if (!fin(u5)) { const m = need(ctx, 'ampel.mess'); u5 = m && isObj(m.values) && fin(+m.values.u5v) ? +m.values.u5v : P.uLogik + P.dev5; }
    const bits = P.adcBits, uN = divU(P.luxNacht, rLoad), uT = divU(P.luxTag, rLoad);
    const nB = Math.round(uN / u5 * full(bits)), tA = Math.round(uT / u5 * full(bits)), sg = sigmaCounts(P, bits, u5);
    return { rig: 'licht', preset: '', ctl: { sensor: 'ldr', rLoad: rLoad, thresh: rd((uN + uT) / 2, 3), hyst: rd(uT - uN, 3), ambient: 0, fdelay: 0 }, bits: bits, vref: u5,
      nachtBelow: nB, tagAbove: tA, state: {}, derived: { lsbMv: rd(u5 / full(bits) * 1000, 3), sigma: rd(sg, 2), hyst: tA - nB, luxNacht: P.luxNacht, luxTag: P.luxTag } };
  }

  /* ====================================================================== va6: Nachtabsenkung programmieren (Arduino-Lab) */
  const T_CODE = 70;                                // virtuelle Laufzeit des Prüflaufs in s
  const T_FINAL = 420000;                           // Gesamtlauf des Abschlusstests in ms (SPEC nennt 600 s als Obergrenze)
  function luxProfile(P) {
    const lDay = 4 * P.luxTag, lNight = P.luxNacht / 4, a = Math.log(lDay), b = Math.log(lNight);
    return t => (t < 10 ? lDay : t < 30 ? Math.exp(a + (b - a) * (t - 10) / 20) : t < 40 ? lNight : t < 60 ? Math.exp(b + (a - b) * (t - 40) / 20) : lDay);
  }
  function codeScen(P, sen) {
    const s = senRead(sen, P), rLoad = s.valid ? s.rLoad : (fin(s.rLoad) && s.rLoad > 0 ? s.rLoad : 4700), bits = s.valid ? s.bits : P.adcBits, vTrue = P.uLogik + P.dev5, lux = luxProfile(P);
    const sigma = sigmaCounts(P, bits, vTrue), amp = sigma * Math.sqrt(3), top = full(bits) - 1, seed = P.plantSeed;
    const c0 = t => divU(lux(t), rLoad) / vTrue * full(bits);
    const analog = t => clamp(Math.round(c0(t) + (hash('n' + seed + ':' + Math.round(t * 1000)) / 4294967296 * 2 - 1) * amp), 0, top);
    return { T: T_CODE, dt: 0.005, c0: c0, amp: amp, analog: analog, lux: lux, bits: bits, rLoad: rLoad, key: [seed, P.dev5, rLoad, bits, P.luxNacht, P.luxTag, P.noiseMv].join('/') };
  }
  const codeCache = new Map();
  function runCode(src, scen) {
    const key = hash(String(src)) + '|' + scen.key;
    if (codeCache.has(key)) return codeCache.get(key);
    const R = RUN();
    const r = R ? R.runSketch(String(src), { T: scen.T, dt: scen.dt, analog: { A0: scen.analog } }) : { ok: false, phase: 'compile', error: 'Der Läufer (verbundrun.js) ist nicht geladen.', io: null };
    if (codeCache.size > 60) codeCache.clear();
    codeCache.set(key, r);
    return r;
  }
  const timelineOf = (io, pin) => [[0, 0]].concat(io.edges(pin).map(e => [rd(e.t, 3), e.v]));
  function dutyPct(io, pin, t) {
    let tp = -1, vp = null, tw = -1, vw = 0;
    io.pwms.forEach(e => { if (e.pin === pin && e.t <= t + 1e-9 && e.t >= tp) { tp = e.t; vp = e.v; } });
    io.writes.forEach(e => { if (e.pin === pin && e.t <= t + 1e-9 && e.t >= tw) { tw = e.t; vw = e.v; } });
    if (tp < 0 && tw < 0) return NaN;
    return tw > tp ? vw * 100 : (fin(+vp) ? +vp / 255 * 100 : NaN);
  }
  function checkCode(data, ctx) {
    const P = P_(ctx), lines = [], src = data && typeof data.src === 'string' ? data.src : '';
    const sen = need(ctx, 'ampel.sen'), s = senRead(sen, P), scen = codeScen(P, sen);
    const r = src ? runCode(src, scen) : { ok: false, phase: 'compile', error: 'kein Programmtext', io: null };
    const bigDelay = (src.match(/delay\s*\(\s*(\d+)\s*\)/g) || []).map(x => +/(\d+)/.exec(x)[1]).filter(v => v > 1000);
    const hasRead = /analogRead\s*\(/.test(src);
    const prog = r.ok && !bigDelay.length && hasRead;
    const io = r && r.ok ? r.io : null, edges = io ? io.edges(P.pinNacht) : [], on = edges.find(e => e.v === 1), off = on ? edges.find(e => e.v === 0 && e.t > on.t) : null, mg = scen.amp + 3;
    const why = !r.ok ? ' – ' + (r.error || 'Lauf nicht möglich') : '';
    lines.push(L(prog, 'Programm: ' + (r.ok ? 'läuft ohne Fehler (' + r.loops + ' Durchläufe in ' + T_CODE + ' s)' : 'Fehler') + (bigDelay.length ? ', aber delay(' + bigDelay[0] + ') ist länger als 1 s' : '') + (r.ok && !hasRead ? ', der LDR wird nicht mit analogRead gelesen' : '') + (r.ok ? '' : why), 10));
    const nB = s.valid ? s.nB : NaN, tA = s.valid ? s.tA : NaN;
    const cOn = on ? scen.c0(on.t) : NaN, cOff = off ? scen.c0(off.t) : NaN;
    lines.push(L(!!io && !!on && on.t > 10 && on.t < 30 && fin(nB) && Math.abs(cOn - nB) <= mg, 'Nachtschwelle: das Nachtsignal D' + P.pinNacht + ' schaltet ' + (on ? 'bei Zählwert ' + fm(cOn, 0) + ' ein' : 'nie ein') + ', verlangt ist ' + (fin(nB) ? nB : '?') + ' aus der Sensorik-Station (±' + fm(mg, 0) + ')' + (io ? '' : why), 15));
    lines.push(L(!!io && !!off && off.t > 40 && fin(tA) && Math.abs(cOff - tA) <= mg, 'Tagschwelle: das Nachtsignal schaltet ' + (off ? 'bei Zählwert ' + fm(cOff, 0) + ' aus' : 'nie aus') + ', verlangt ist ' + (fin(tA) ? tA : '?') + ' aus der Sensorik-Station (±' + fm(mg, 0) + ')' + (io ? '' : why), 15));
    lines.push(L(!!io && edges.length === 2 && !!on && !!off, 'Hysterese: ' + (io ? edges.length + ' Wechsel des Nachtsignals im Lauf mit Rauschen (verlangt genau 2: einmal ein, einmal aus)' : 'Lauf nicht möglich'), 25));
    const dd = io ? [dutyPct(io, P.pinPwm, 5), dutyPct(io, P.pinPwm, 35), dutyPct(io, P.pinPwm, 65)] : [NaN, NaN, NaN];
    lines.push(L(!!io && dd[0] >= 95 && dd[2] >= 95 && Math.abs(dd[1] - P.dutyNacht) <= 5, 'PWM der Signalgeber an D' + P.pinPwm + ': Tag ' + fm(dd[0], 0) + ' % und ' + fm(dd[2], 0) + ' % (verlangt 100 %), Nacht ' + fm(dd[1], 0) + ' % (verlangt ' + P.dutyNacht + ' % ±5)', 20));
    let tDefN = NaN, tDefD = NaN;
    for (let t = 10; t < 30; t += 0.01) if (scen.c0(t) < nB - mg) { tDefN = t; break; }
    for (let t = 40; t < 60; t += 0.01) if (scen.c0(t) > tA + mg) { tDefD = t; break; }
    const rN = on && fin(tDefN) ? on.t - tDefN : NaN, rD = off && fin(tDefD) ? off.t - tDefD : NaN;
    lines.push(L(!!io && fin(rN) && fin(rD) && rN <= 1 && rD <= 1, 'Reaktion: das Nachtsignal folgt dem eindeutigen Dämmerungswechsel ' + (fin(rN) ? 'nach ' + fm(Math.max(0, rN) * 1000, 0) + ' ms' : 'nie') + ' (Nacht) und ' + (fin(rD) ? 'nach ' + fm(Math.max(0, rD) * 1000, 0) + ' ms' : 'nie') + ' (Tag), verlangt unter 1 s', 15));
    return lines;
  }
  function codeSource(P, nB, tA) {
    const duty = Math.round(P.dutyNacht / 100 * 255);
    return ['// Nachtabsenkung der Bedarfsampel',
      '// A0: LDR-Teiler (Zählwert 0 bis 1023), D' + P.pinNacht + ': Nachtsignal, D' + P.pinPwm + ': PWM der Signalgeber',
      'const int PIN_LDR = A0;', 'const int PIN_NACHT = ' + P.pinNacht + ';', 'const int PIN_PWM = ' + P.pinPwm + ';',
      'const int NACHT_UNTER = ' + nB + ';   // Zählwert: darunter wird es Nacht', 'const int TAG_UEBER = ' + tA + ';     // Zählwert: darüber wird es Tag',
      'const int DUTY_NACHT = ' + duty + ';   // ' + P.dutyNacht + ' Prozent von 255', 'bool nacht = false;', '',
      'void setup() {', '  pinMode(PIN_NACHT, OUTPUT);', '  pinMode(PIN_PWM, OUTPUT);', '  analogWrite(PIN_PWM, 255);', '}', '',
      'void loop() {', '  int wert = analogRead(PIN_LDR);',
      '  if (!nacht && wert < NACHT_UNTER) { nacht = true; }', '  if (nacht && wert > TAG_UEBER) { nacht = false; }',
      '  digitalWrite(PIN_NACHT, nacht ? HIGH : LOW);', '  analogWrite(PIN_PWM, nacht ? DUTY_NACHT : 255);', '  delay(20);', '}'].join('\n');
  }
  const codeFrame = P => ['// Nachtabsenkung der Bedarfsampel', '// A0: LDR-Teiler (Zählwert 0 bis 1023), D' + P.pinNacht + ': Nachtsignal, D' + P.pinPwm + ': PWM der Signalgeber', '', 'void setup() {', '}', '', 'void loop() {', '}'].join('\n');
  function codeSolution(ctx) {
    const P = P_(ctx), sen = need(ctx, 'ampel.sen'), s = senRead(sen, P), src = codeSource(P, s.nB, s.tA), r = runCode(src, codeScen(P, sen));
    return { lang: 'arduino', src: src, run: { serial: [], events: [], nightTimeline: r && r.ok ? timelineOf(r.io, P.pinNacht) : [] } };
  }
  function codeTimeline(code, ctx) {
    const P = P_(ctx), sen = need(ctx, 'ampel.sen');
    if (code && typeof code.src === 'string') { const r = runCode(code.src, codeScen(P, sen)); if (r && r.ok) return timelineOf(r.io, P.pinNacht); }
    return code && code.run && Array.isArray(code.run.nightTimeline) ? code.run.nightTimeline : [];
  }

  /* ====================================================================== va7: Ampelsteuerung programmieren (SPS-Lab) */
  const v_ = a => ({ t: 'var', a: a }), nv_ = a => ({ t: 'var', a: a, neg: true });
  const AND_ = (...i) => ({ t: 'and', in: i }), OR_ = (...i) => ({ t: 'or', in: i });
  const TON_ = (id, pt, i) => ({ t: 'fb', fb: 'ton', id: id, pt: pt, in: i });
  const coil_ = a => ({ t: 'coil', a: a }), set_ = a => ({ t: 'set', a: a }), rst_ = a => ({ t: 'reset', a: a });
  const net_ = (id, title, expr, outs) => ({ id: id, title: title, expr: expr, outs: outs || [] });
  const SYM = { 'I0.0': 'S1_Fussgaengertaster', 'I0.1': 'S2_Betrieb', 'I0.2': 'B1_Schleife', 'Q0.0': 'H1_Strasse_rot', 'Q0.1': 'H2_Strasse_gelb', 'Q0.2': 'H3_Strasse_gruen', 'Q0.3': 'H4_Fuss_rot', 'Q0.4': 'H5_Fuss_gruen',
    'M0.0': 'M_Anforderung', 'M1.0': 'M_Gruen', 'M1.1': 'M_Gelb', 'M1.2': 'M_Sperr1', 'M1.3': 'M_FussGruen', 'M1.4': 'M_Sperr2', 'M1.5': 'M_RotGelb', 'M2.0': 'M_Blink' };
  const PH = ['M1.0', 'M1.1', 'M1.2', 'M1.3', 'M1.4', 'M1.5'];
  function buildProgram(P) {
    const ms = s => Math.round(s * 1000);
    return { lang: 'kop', symbols: Object.assign({}, SYM), networks: [
      net_('N1', 'Tagbetrieb starten: Straße grün', AND_(v_('I0.1'), ...PH.map(nv_)), [set_('M1.0')]),
      net_('N2', 'Nachtbetrieb erst aus der Grünphase', AND_(nv_('I0.1'), v_('M1.0')), [rst_('M1.0')]),
      net_('N3', 'Anforderung merken (auch nachts)', v_('I0.0'), [set_('M0.0')]),
      net_('N4', 'Mindest-Grün Straße', TON_('T1', ms(P.tMinKfzGruen), v_('M1.0')), []),
      net_('N5', 'Grün endet bei Anforderung', AND_(v_('M1.0'), v_('T1.Q'), v_('M0.0')), [set_('M1.1'), rst_('M1.0')]),
      net_('N6', 'Gelbzeit', TON_('T2', ms(P.tGelb), v_('M1.1')), []),
      net_('N7', 'Gelb zu Sperrzeit', v_('T2.Q'), [set_('M1.2'), rst_('M1.1')]),
      net_('N8', 'Sperrzeit vor Fußgänger-Grün', TON_('T3', ms(P.tSperr), v_('M1.2')), []),
      net_('N9', 'Fußgänger-Grün beginnt, Anforderung erledigt', v_('T3.Q'), [set_('M1.3'), rst_('M1.2'), rst_('M0.0')]),
      net_('N10', 'Fußgänger-Grünzeit', TON_('T4', ms(P.tPedGruen), v_('M1.3')), []),
      net_('N11', 'Fußgänger-Grün zu Räumzeit', v_('T4.Q'), [set_('M1.4'), rst_('M1.3')]),
      net_('N12', 'Sperrzeit nach Fußgänger-Grün', TON_('T5', ms(P.tSperr), v_('M1.4')), []),
      net_('N13', 'Räumzeit zu Rot-Gelb', v_('T5.Q'), [set_('M1.5'), rst_('M1.4')]),
      net_('N14', 'Rot-Gelb-Zeit', TON_('T6', ms(P.tRotGelb), v_('M1.5')), []),
      net_('N15', 'Rot-Gelb zu Grün', v_('T6.Q'), [set_('M1.0'), rst_('M1.5')]),
      net_('N16', 'Blinken Nacht: Pause', TON_('T7', 500, AND_(nv_('I0.1'), ...PH.map(nv_), nv_('T8.Q'))), [coil_('M2.0')]),
      net_('N17', 'Blinken Nacht: Leuchtzeit', TON_('T8', 500, v_('T7.Q')), []),
      net_('N18', 'Straße rot', OR_(v_('M1.2'), v_('M1.3'), v_('M1.4'), v_('M1.5')), [coil_('Q0.0')]),
      net_('N19', 'Straße gelb (Gelbphase, Rot-Gelb, Nachtblinken)', OR_(v_('M1.1'), v_('M1.5'), v_('M2.0')), [coil_('Q0.1')]),
      net_('N20', 'Straße grün', v_('M1.0'), [coil_('Q0.2')]),
      net_('N21', 'Fußgänger rot', nv_('M1.3'), [coil_('Q0.3')]),
      net_('N22', 'Fußgänger grün', v_('M1.3'), [coil_('Q0.4')])
    ] };
  }
  /* Nachtfenster aus dem Nachtsignal des Arduino: Zeitlinie [[t,0/1],...] aus T_CODE s auf den SPS-Lauf von ms Millisekunden gedehnt */
  function nightWins(tl, ms) {
    const f = ms / (T_CODE * 1000), w = []; let a = null;
    arr(tl).forEach(e => { if (!Array.isArray(e)) return; if (e[1] === 1 && a === null) a = e[0]; else if (e[1] === 0 && a !== null) { w.push([Math.round(a * 1000 * f), Math.round(e[0] * 1000 * f)]); a = null; } });
    if (a !== null) w.push([Math.round(a * 1000 * f), ms]);
    return w;
  }
  const spsCache = new Map();
  function runAmpel(prog, o) {
    const key = hash(JSON.stringify([prog, o.ms, o.seed, o.wins]));
    if (spsCache.has(key)) return spsCache.get(key);
    const plant = PLANTS().create('ampel', { seed: o.seed }), plc = SPS().create(clone(prog));
    plant.scenarios('viele_fussgaenger');
    const qk = plant.io.outputs.map(x => x.key), n = Math.floor(o.ms / 10), m = new Uint8Array(n), nt = new Uint8Array(n), log = [], out = {};
    let wi = 0;
    for (let i = 0; i < n; i++) {
      const t = i * 10;
      while (wi < o.wins.length && t >= o.wins[wi][1]) wi++;
      const night = wi < o.wins.length && t >= o.wins[wi][0] ? 1 : 0;
      plant.setInput('I0.1', !night);
      const inp = plant.readInputs();
      for (const k in inp) plc.setInput(k, inp[k]);
      plc.scan(10);
      for (let j = 0; j < qk.length; j++) out[qk[j]] = plc.getOutput(qk[j]);
      plant.writeOutputs(out); plant.step(10);
      m[i] = (out['Q0.0'] ? 1 : 0) | (out['Q0.1'] ? 2 : 0) | (out['Q0.2'] ? 4 : 0) | (out['Q0.3'] ? 8 : 0) | (out['Q0.4'] ? 16 : 0); nt[i] = night;
      if ((i + 1) % 100 === 0) log.push([(i + 1) / 100, plant.state().pedRequest && !night ? 1 : 0, out['Q0.4'] ? 1 : 0, night]);
    }
    const r = { m: m, nt: nt, n: n, log: log, st: plant.state(), wins: o.wins, ms: o.ms };
    if (spsCache.size > 30) spsCache.clear();
    spsCache.set(key, r);
    return r;
  }
  function spsRun(prog, ctx, ms) {
    const P = P_(ctx), tl = codeTimeline(need(ctx, 'ampel.code'), ctx);
    return runAmpel(prog, { ms: ms, seed: P.plantSeed, wins: nightWins(tl, ms) });
  }
  /* Zustandsfolge der Tagphasen: Segmente gleicher Ausgangsbelegung innerhalb der Tagbereiche (das letzte, abgeschnittene Segment jedes Bereichs entfällt) */
  function segmentsOf(run) {
    const segs = []; let i = 0, rg = 0;
    while (i < run.n) {
      if (run.nt[i]) { i++; continue; }
      let j = i; while (j < run.n && !run.nt[j]) j++;
      const rs = []; let k = i;
      while (k < j) { let e = k; while (e < j && run.m[e] === run.m[k]) e++; rs.push({ mask: run.m[k], t0: k * 10, len: (e - k) * 10, range: rg }); k = e; }
      rs.pop();
      rs.forEach((s, idx) => { s.first = idx === 0; segs.push(s); });
      rg++; i = j;
    }
    return segs;
  }
  const MASK = { G: 12, Y: 10, R: 9, P: 17, RY: 11 }, NEXT = { 12: [10], 10: [9], 9: [17, 11], 17: [9], 11: [12] };
  function seqCheck(segs) {
    const bad = [];
    if (!segs.length) return { ok: false, msg: 'keine Tagphasen aufgezeichnet', nP: 0 };
    segs.forEach((s, i) => {
      if (!NEXT[s.mask]) bad.push('unerlaubte Ausgangsbelegung ' + s.mask);
      if (s.first && s.mask !== MASK.G) bad.push('die Straße beginnt nicht mit Grün');
      const nx = segs[i + 1];
      if (nx && nx.range === s.range && NEXT[s.mask] && NEXT[s.mask].indexOf(nx.mask) < 0) bad.push('nach Phase ' + s.mask + ' folgt ' + nx.mask);
      const n2 = segs[i + 2];
      if (n2 && nx && n2.range === s.range && nx.range === s.range && nx.mask === 9) { if (s.mask === 10 && n2.mask !== 17) bad.push('nach Gelb muss Fußgänger-Grün folgen'); if (s.mask === 17 && n2.mask !== 11) bad.push('nach dem Fußgänger-Grün muss Rot-Gelb folgen'); }
    });
    const nP = segs.filter(s => s.mask === 17).length;
    if (nP < 2) bad.push('weniger als zwei Fußgängerphasen im Tagbetrieb (' + nP + ')');
    return { ok: bad.length === 0, msg: bad[0] || '', nP: nP };
  }
  const durOf = (segs, mask) => segs.filter(s => s.mask === mask && !s.first).map(s => s.len);
  function logStats(rows) {
    let anf = 0, vorher = 0, start = 0, wartend = false, sum = 0, cnt = 0, max = 0, nacht = 0;
    rows.forEach(z => {
      if (z[3] === 1) nacht++;
      if (z[1] === 1 && vorher === 0) { anf++; start = z[0]; wartend = true; }
      if (wartend && z[2] === 1) { const w = z[0] - start; sum += w; cnt++; if (w > max) max = w; wartend = false; }
      vorher = z[1];
    });
    return { anf: anf, mittel: cnt ? sum / cnt : 0, max: max, nacht: rows.length ? 100 * nacht / rows.length : 0, waits: cnt };
  }
  function nightCheck(run) {
    if (!run.wins.length) return { ok: false, msg: 'kein Nachtsignal aus der Arduino-Station (Zeitlinie ohne Nacht)' };
    let best = null;
    run.wins.forEach(w => { const a = w[0] + 18000, b = Math.min(w[1] - 1000, run.ms); if (b - a >= 5000 && (!best || b - a > best[1] - best[0])) best = [a, b]; });
    if (!best) return { ok: false, msg: 'die Nacht ist zu kurz zum Prüfen' };
    let bad = null, last = 0, rises = [];
    for (let i = Math.floor(best[0] / 10); i < Math.floor(best[1] / 10); i++) {
      const mk = run.m[i];
      if (mk & (1 | 4 | 16)) { bad = bad || 'Rot, Grün oder Fußgänger-Grün leuchtet in der Nacht'; }
      if (!(mk & 8)) bad = bad || 'die Fußgängerampel zeigt nachts nicht Rot';
      const y = mk & 2 ? 1 : 0; if (y && !last) rises.push(i * 10); last = y;
    }
    if (bad) return { ok: false, msg: bad };
    if (rises.length < 4) return { ok: false, msg: 'Gelb blinkt nicht (nur ' + rises.length + ' Einschaltungen)' };
    const per = (rises[rises.length - 1] - rises[0]) / (rises.length - 1);
    return { ok: per >= 900 && per <= 1100, msg: 'Periode ' + fm(per, 0) + ' ms', per: per };
  }
  function checkSps(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], prog = data && data.prog;
    if (!isObj(prog)) return [L(false, 'Kein SPS-Programm übergeben', 100)];
    if (data.plant && data.plant !== 'ampel') return [L(false, 'Das Programm gehört zur Anlage „' + data.plant + '“, verlangt ist die Ampel', 100)];
    let val = { ok: false, errors: ['SPS_CORE fehlt'] };
    try { val = SPS().validate(prog); } catch (e) { val = { ok: false, errors: [String(e && e.message || e)] }; }
    let plc = null; try { plc = SPS().create(clone(prog)); } catch (e) { plc = null; }
    const comp = !!(val && val.ok && plc && plc.ok);
    if (!comp) {
      lines.push(L(false, 'Programm lässt sich nicht übersetzen (SPS_CORE.validate): ' + String((val && val.errors && val.errors[0]) || (plc && plc.errorList && plc.errorList[0]) || 'Fehler'), 5));
      lines.push(L(false, 'Szenarien nicht ausführbar, solange das Programm Fehler hat', 95));
      return lines;
    }
    const run = spsRun(prog, ctx, 300000), segs = segmentsOf(run), sq = seqCheck(segs);
    lines.push(L(sq.ok, 'Phasenfolge Grün – Gelb – Rot – Fußgänger-Grün – Rot – Rot-Gelb – Grün: ' + sq.nP + ' Fußgängerphasen im Tagbetrieb geprüft' + (sq.msg ? ' – ' + sq.msg : ''), 20));
    const tim = (mask, name, T, pts, label) => {
      const d = durOf(segs, mask), w = Math.max(0.10 * tol * T * 1000, 40), okT = d.length > 0 && d.every(x => Math.abs(x - T * 1000) <= w);
      lines.push(L(okT, label + ': ' + (d.length ? fm(Math.min.apply(null, d) / 1000, 2) + ' bis ' + fm(Math.max.apply(null, d) / 1000, 2) + ' s' : 'nicht gefunden') + ', verlangt ' + T + ' s (±' + fm(w / 1000, 2) + ' s)', pts));
    };
    tim(MASK.Y, 'Gelb', P.tGelb, 5, 'Gelbzeit'); tim(MASK.RY, 'Rot-Gelb', P.tRotGelb, 5, 'Rot-Gelb-Zeit'); tim(MASK.P, 'Fußgänger-Grün', P.tPedGruen, 5, 'Fußgänger-Grünzeit'); tim(MASK.R, 'Sperrzeit', P.tSperr, 5, 'Sperrzeit (alles Rot)');
    const st = run.st;
    lines.push(L(st.violations === 0 && st.carsCrashed === 0 && st.pedsCrashed === 0, 'Sicherheit in ' + run.ms / 1000 + ' s mit Verkehr: ' + st.violations + ' Verstöße, ' + st.carsCrashed + ' Fahrzeug-Unfälle, ' + st.pedsCrashed + ' Fußgänger-Unfälle (verlangt 0)', 25));
    const gd = segs.filter(s => s.mask === MASK.G).map(s => s.len), minG = P.tMinKfzGruen * 1000;
    lines.push(L(gd.length > 0 && gd.every(x => x >= minG - 60), 'Mindest-Grün der Straße: kürzeste Grünphase ' + (gd.length ? fm(Math.min.apply(null, gd) / 1000, 2) + ' s' : '?') + ', verlangt mindestens ' + P.tMinKfzGruen + ' s', 8));
    const ls = logStats(run.log), maxW = ls.max;
    lines.push(L(ls.waits >= 2 && maxW <= P.tMaxWait, 'Wartezeit der Fußgänger: höchstens ' + fm(maxW, 0) + ' s bei ' + ls.waits + ' bedienten Anforderungen, erlaubt ' + P.tMaxWait + ' s', 7));
    const nc = nightCheck(run);
    lines.push(L(nc.ok, 'Nachtbetrieb: Gelb blinkt mit 1 Hz (±10 %), Fußgänger rot, sonst alles aus' + (nc.msg ? ' – ' + nc.msg : ''), 15));
    lines.push(L(true, 'Programm lässt sich übersetzen (SPS_CORE.validate), ' + (val.warnings && val.warnings.length ? val.warnings.length + ' Hinweise' : 'ohne Hinweise'), 5));
    return lines;
  }

  /* ====================================================================== va8: Betriebsstatistik (Pi-Lab, Python) */
  function logFor(ctx) {                    // sps.log aus dem Programm der Station 7 (300 s, Abtastung 1 s)
    const P = P_(ctx), sps = need(ctx, 'ampel.sps');
    if (!sps || !isObj(sps.prog)) return null;
    const run = spsRun(sps.prog, ctx, 300000), rows = run.log;
    return { plant: 'ampel', seed: P.plantSeed, dtMs: 1000, daten: rows, series: rows.map(r => ({ t: r[0], anf: r[1], gruen: r[2], nacht: r[3] })), counters: { anforderungen: logStats(rows).anf, violations: run.st.violations, pedsCrossed: run.st.pedsCrossed } };
  }
  function synthLog(P) {                     // zweiter Datensatz: das Programm muss rechnen, nicht auswendig kennen
    const r = rng(hash('log' + P.plantSeed + ':' + P.luxNacht)), rows = []; let anf = 0, gruen = 0, nacht = 0;
    for (let t = 1; t <= 160; t++) {
      if (!nacht && r() < 0.012) nacht = 1; else if (nacht && r() < 0.05) nacht = 0;
      if (nacht) { anf = 0; gruen = 0; }
      else if (gruen) { if (r() < 0.2) gruen = 0; }
      else if (anf) { if (r() < 0.15) { gruen = 1; anf = 0; } }
      else if (r() < 0.14) anf = 1;
      rows.push([t, anf, gruen, nacht]);
    }
    return rows;
  }
  const PY_KEYS = ['ANFORDERUNGEN', 'WARTE_MITTEL', 'WARTE_MAX', 'NACHT_PROZENT'];
  const refOfLog = rows => { const s = logStats(rows); return { ANFORDERUNGEN: s.anf, WARTE_MITTEL: s.mittel, WARTE_MAX: s.max, NACHT_PROZENT: s.nacht }; };
  function checkPi(data, ctx) {
    const P = P_(ctx), lines = [], src = data && typeof data.src === 'string' ? data.src : '', R = RUN();
    const lg = logFor(ctx), rows1 = lg ? lg.daten : [], rows2 = synthLog(P);
    if (!R) return [L(false, 'Der Läufer (verbundrun.js) ist nicht geladen', 100)];
    const r1 = R.runPython(src, { daten: rows1 }, { T: 60 }), r2 = R.runPython(src, { daten: rows2 }, { T: 60 }), ref1 = refOfLog(rows1), ref2 = refOfLog(rows2);
    const lab = { ANFORDERUNGEN: 'Anzahl der Anforderungen', WARTE_MITTEL: 'mittlere Wartezeit in s', WARTE_MAX: 'größte Wartezeit in s', NACHT_PROZENT: 'Nachtanteil in %' };
    PY_KEYS.forEach(k => {
      const v1 = r1.ok ? r1.kv[k] : NaN, v2 = r2.ok ? r2.kv[k] : NaN, ok1 = fin(v1) && Math.abs(v1 - ref1[k]) <= 0.1 + 1e-9, ok2 = fin(v2) && Math.abs(v2 - ref2[k]) <= 0.1 + 1e-9;
      lines.push(L(ok1 && ok2, k + ' (' + lab[k] + '): ' + (fin(v1) ? fm(v1, 1) : 'keine Ausgabe') + ', erwartet ' + fm(ref1[k], 1) + (ok1 && !ok2 ? ' – mit anderen Daten stimmt der Wert nicht mehr (nicht fest eintragen, rechnen!)' : ''), 20));
    });
    const fmtOk = r1.ok && r2.ok && PY_KEYS.every(k => fin(r1.kv[k]) && fin(r2.kv[k]));
    lines.push(L(fmtOk, 'Ausgabeformat: vier Zeilen SCHLÜSSEL=Zahl und kein Laufzeitfehler' + (!r1.ok ? ' – ' + r1.error : !r2.ok ? ' – ' + r2.error : !fmtOk ? ' – es fehlen Zeilen ' + PY_KEYS.filter(k => !fin(r1.kv[k])).join(', ') : ''), 20));
    return lines;
  }
  const pyFrame = rows => ['# Betriebsstatistik der Bedarfsampel', '# daten: eine Zeile je Sekunde [Zeit in s, Anforderung, Fussgaenger-Gruen, Nacht]', 'daten = ' + JSON.stringify(rows || [[0, 0, 0, 0]]), '',
    '# Ausgabe: ANFORDERUNGEN=..., WARTE_MITTEL=..., WARTE_MAX=..., NACHT_PROZENT=...'].join('\n');
  function pySource() {
    return ['# Betriebsstatistik der Bedarfsampel',
      '# daten: eine Zeile je Sekunde [Zeit in s, Anforderung, Fussgaenger-Gruen, Nacht]',
      'daten = [[0, 0, 0, 0]]', '',
      'anforderungen = 0', 'vorher = 0', 'start = 0', 'wartend = 0', 'summe = 0', 'anzahl = 0', 'maximum = 0', 'nacht = 0', '',
      'for z in daten:', '    zeit = z[0]', '    if z[3] == 1:', '        nacht = nacht + 1',
      '    if z[1] == 1 and vorher == 0:', '        anforderungen = anforderungen + 1', '        start = zeit', '        wartend = 1',
      '    if wartend == 1 and z[2] == 1:', '        w = zeit - start', '        summe = summe + w', '        anzahl = anzahl + 1',
      '        if w > maximum:', '            maximum = w', '        wartend = 0', '    vorher = z[1]', '',
      'mittel = 0', 'if anzahl > 0:', '    mittel = summe / anzahl', 'prozent = 100 * nacht / len(daten)', '',
      'print("ANFORDERUNGEN=" + str(anforderungen))', 'print("WARTE_MITTEL=" + str(round(mittel, 1)))', 'print("WARTE_MAX=" + str(round(maximum, 1)))', 'print("NACHT_PROZENT=" + str(round(prozent, 1)))'].join('\n');
  }
  function piSolution(ctx) {
    const R = RUN(), lg = logFor(ctx), src = pySource(), r = R && lg ? R.runPython(src, { daten: lg.daten }, { T: 60 }) : null;
    return { lang: 'python', src: src, out: r && r.ok ? r.lines.slice() : [] };
  }

  /* ====================================================================== vaF: Abschlusstest (Gesamtsystem) */
  function finalCheck(slots, spec, level) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {};
    const lv = level === 1 || level === 3 ? level : 2, tolMul = TOLMUL[lv];
    const ctx = { spec: { params: P }, level: lv, tol: tolMul, slots: slots || {}, get: k => (slots || {})[k] };
    const g = k => slotOf(ctx, k), lines = [], kpis = [];
    const pk = g('ampel.ds'), sch = g('ampel.sch'), loch = g('ampel.loch'), mess = g('ampel.mess'), sen = g('ampel.sen'), code = g('ampel.code'), sps = g('ampel.sps'), pyd = g('ampel.pi');
    const pi = pickInfo(pk), th = regTh(pi.reg || dsOf('tf-7805'));
    // 1: Gesamtlauf
    const progOk = isObj(sps) && isObj(sps.prog) && SPS() && (() => { try { const p = SPS().create(clone(sps.prog)); return !!p.ok; } catch (e) { return false; } })();
    let run = null, segs = [], sq = { ok: false, msg: '', nP: 0 }, nc = { ok: false, msg: '' }, st = null;
    if (progOk) {
      const tl = codeTimeline(code, ctx);
      run = runAmpel(sps.prog, { ms: T_FINAL, seed: P.plantSeed, wins: nightWins(tl, T_FINAL) });
      segs = segmentsOf(run); sq = seqCheck(segs); nc = nightCheck(run); st = run.st;
    }
    const runOk = !!run && st.violations === 0 && st.carsCrashed === 0 && st.pedsCrashed === 0 && sq.ok && nc.ok;
    lines.push(L(runOk, 'Gesamtlauf ' + T_FINAL / 1000 + ' s (Hell/Dunkel-Verlauf → LDR → Arduino → SPS → Anlage): ' + (run ? st.violations + ' Verstöße, ' + (st.carsCrashed + st.pedsCrashed) + ' Unfälle, Tagphasen ' + (sq.ok ? 'richtig' : 'fehlerhaft (' + sq.msg + ')') + ', Nachtbetrieb ' + (nc.ok ? 'richtig' : 'fehlerhaft (' + nc.msg + ')') : 'Programm nicht auswertbar'), 30));
    // 2: Elektronik
    const eq = equivBoards(sch && sch.netlist, loch && loch.netlist);
    lines.push(L(eq.ok, 'Elektronik: Schaltplan und Lochraster haben dieselben Netze' + (eq.errs.length ? ' – ' + eq.errs[0] : ''), 10));
    const a = analyseNl(loch && loch.netlist, P, false), sims = simNetlist(a.ix, P, pi, a.R, a.chans), is = sims.map(s => s.i).filter(fin), good = a.chans.filter(c => c.good).length;
    const iOk = good === P.nCh && a.chans.length === P.nCh && is.length === P.nCh && a.ri.ok && is.every(i => Math.abs(i - P.iLed) <= 0.15 * tolMul * P.iLed + 1e-9);
    lines.push(L(iOk, 'Elektronik: LED-Strom je Kanal ' + (is.length ? fm(Math.min.apply(null, is), 1) + ' bis ' + fm(Math.max.apply(null, is), 1) + ' mA' : 'nicht auswertbar') + ' im Lochraster, erwartet ' + fm(P.iLed, 1) + ' mA (±' + fm(15 * tolMul, 0) + ' %)', 10));
    // 3: Dämmerungsgenauigkeit
    const scen = codeScen(P, sen), rc = code && typeof code.src === 'string' ? runCode(code.src, scen) : null, edges = rc && rc.ok ? rc.io.edges(P.pinNacht) : [];
    const on = edges.find(e => e.v === 1), off = on ? edges.find(e => e.v === 0 && e.t > on.t) : null, luxOn = on ? scen.lux(on.t) : NaN, luxOff = off ? scen.lux(off.t) : NaN, wl = 0.15 * tolMul + 0.05;
    lines.push(L(!!on && !!off && Math.abs(luxOn / P.luxNacht - 1) <= wl && Math.abs(luxOff / P.luxTag - 1) <= wl, 'Dämmerungsgenauigkeit: Nacht ab ' + (on ? fm(luxOn, 1) + ' lx' : 'nie') + ' (verlangt ' + P.luxNacht + ' lx), Tag ab ' + (off ? fm(luxOff, 1) + ' lx' : 'nie') + ' (verlangt ' + P.luxTag + ' lx), Toleranz ±' + fm(wl * 100, 0) + ' %', 15));
    // 4: Statistik
    const R = RUN(), pr = R && pyd && typeof pyd.src === 'string' && run ? R.runPython(pyd.src, { daten: run.log }, { T: 60 }) : null, ref = run ? refOfLog(run.log) : null;
    const stOk = !!pr && pr.ok && PY_KEYS.every(k => fin(pr.kv[k]) && Math.abs(pr.kv[k] - ref[k]) <= 0.1 + 1e-9);
    lines.push(L(stOk, 'Statistik: dein Python-Programm rechnet auf dem Protokoll des Gesamtlaufs ' + (pr && pr.ok ? PY_KEYS.map(k => k.split('_')[0].slice(0, 5) + ' ' + (fin(pr.kv[k]) ? fm(pr.kv[k], 1) : '?') + ' (soll ' + fm(ref[k], 1) + ')').join(', ') : 'nicht auswertbar' + (pr && pr.error ? ' – ' + pr.error : '')), 15));
    // 5: Leistungsbilanz
    const i12 = is.length ? is.reduce((x, y) => x + y, 0) + P.iLogik + I_Q_MAX : NaN, pReg = (P.uSup - P.uLogik) * P.iLogik / 1000 + P.uSup * I_Q_MAX / 1000, tjReg = P.tAmb + pReg * th.rth;
    lines.push(L(fin(i12) && i12 <= P.iNetz && tjReg <= th.tjMax, 'Leistungsbilanz: Summenstrom ' + (fin(i12) ? fm(i12, 0) + ' mA' : '?') + ' (Netzteil ' + P.iNetz + ' mA), Regler ' + fm(pReg * 1000, 0) + ' mW und ' + fm(tjReg, 0) + ' °C (Grenze ' + th.tjMax + ' °C)', 10));
    // 6: Konsistenz
    const lSame = !!pi.ok && a.chans.length > 0 && a.chans.every(c => c.rv && sameVal(numOf(c.rv.value), pi.rV, 1e-3) && valueIs(c.q.value, pi.tr)) && eq.ok;
    const ss = senRead(sen, P), u5m = measU5(ctx), srcT = code && typeof code.src === 'string' ? code.src : '';
    const same2 = ss.valid && fin(u5m) && Math.abs(ss.vref - u5m) <= 0.005 * u5m && new RegExp('\\b' + ss.nB + '\\b').test(srcT) && new RegExp('\\b' + ss.tA + '\\b').test(srcT);
    lines.push(L(lSame && same2 && isObj(mess) && arr(mess.rows).length >= 4, 'Konsistenz: Datenblatt-Auswahl, Schaltplan, Lochraster, Messprotokoll, Sensorik und Sketch gehören zusammen' + (!lSame ? ' – Auswahl, Schaltplan und Lochraster passen nicht zusammen' : !same2 ? ' – Referenzspannung oder Schwellen in Sketch und Sensorik weichen ab' : ''), 10));
    // Kennzahlen
    const k = (key, label, value, unit, ok) => kpis.push({ key: key, label: label, value: fin(value) ? rd(value, 2) : null, unit: unit, ok: !!ok && fin(value) });
    const pd = durOf(segs, MASK.P), pAvg = pd.length ? pd.reduce((x, y) => x + y, 0) / pd.length / 1000 : NaN, ls = run ? logStats(run.log) : null;
    let cycles = 0; if (run) for (let i = 1; i < run.n; i++) if (run.m[i] === MASK.P && run.m[i - 1] !== MASK.P) cycles++;
    k('pedgruen', 'Fußgänger-Grünzeit', pAvg, 's', Math.abs(pAvg - P.tPedGruen) <= 0.1 * P.tPedGruen + 0.05);
    k('wartemittel', 'Wartezeit mittel', ls ? ls.mittel : NaN, 's', !!ls && ls.mittel <= P.tMaxWait);
    k('wartemax', 'Wartezeit höchstens', ls ? ls.max : NaN, 's', !!ls && ls.max <= P.tMaxWait);
    k('iled', 'LED-Strom', is.length ? is.reduce((x, y) => x + y, 0) / is.length : NaN, 'mA', iOk);
    k('nachtlux', 'Nachtschwelle', luxOn, 'lx', fin(luxOn) && Math.abs(luxOn / P.luxNacht - 1) <= wl);
    k('tjreg', 'Reglertemperatur', tjReg, '°C', tjReg <= th.tjMax);
    k('zyklen', 'Zyklen ohne Verstoß', run && st.violations === 0 && st.carsCrashed + st.pedsCrashed === 0 ? cycles : 0, '', !!run && st.violations === 0 && cycles >= 2);
    return { lines: lines, kpis: kpis };
  }

  /* ====================================================================== Stationen */
  const piData = ctx => { const lg = logFor(ctx); return { daten: lg ? lg.daten : [] }; };      // Daten für das Python-Programm: Zeilen [Zeit s, Anforderung, Fußgänger-Grün, Nacht]
  const e12down = x => { const dec = Math.pow(10, Math.floor(Math.log10(x))), l = E12.map(m => m * dec).concat(E12.map(m => m * dec / 10)); return Math.max.apply(null, l.filter(v => v < x * (1 - 1e-9))); };
  const mkMessRow = (id, label, unit, val, ins) => ({ id: id, label: label, unit: unit, soll: 0, ist: fin(numOf(val)) ? numOf(val) : null, tol: 3, instrument: ins, tp: '' });
  const MESS_FORM = [{ key: 'u12', label: 'Versorgung U_12V', type: 'number', unit: 'V' }, { key: 'u5', label: '5-V-Schiene U_5V (drei Stellen)', type: 'number', unit: 'V' }];
  for (let k = 1; k <= 5; k++) { MESS_FORM.push({ key: 'i' + k, label: 'LED-Strom Kanal ' + k, type: 'number', unit: 'mA' }); MESS_FORM.push({ key: 'c' + k, label: 'Spannung am Treiber Kanal ' + k, type: 'number', unit: 'V' }); }
  MESS_FORM.push({ key: 'finding', label: 'Befund', type: 'area' });
  const tonOf = (d, id) => { let r = null; d.prog.networks.forEach(n => { if (n.expr && n.expr.fb === 'ton' && n.expr.id === id) r = n.expr; }); return r; };

  const STATIONS = [
    { id: 'va1', lab: 'vb', cat: 'Ampelanlage', title: 'LED-Kanal und Versorgung berechnen', level: 2,
      on: 'ds',
      text: 'Die Signalgeber der Ampel brauchen einen Treiber und eine 5-V-Versorgung. Berechne in den Übungsdatenblättern den Vorwiderstand deiner LED (E12, aufrunden), wähle den Treibertransistor und seinen Basiswiderstand, rechne den Summenstrom aus dem Netzteil und die Verlustleistung und Sperrschichttemperatur des Festreglers 7805 bei der Umgebungstemperatur aus dem Lastenheft.',
      in: [], out: 'ampel.ds', type: 'ds.pick', w: 100, pass: null,
      form: [
        { key: 'rV', label: 'Vorwiderstand R_V', type: 'eseries', unit: 'Ω', hint: 'E12-Reihe, aufrunden' },
        { key: 'pRv', label: 'Belastbarkeit von R_V', type: 'select', options: [{ value: '0.125', label: '0,125 W' }, { value: '0.25', label: '0,25 W' }, { value: '0.5', label: '0,5 W' }, { value: '1', label: '1 W' }, { value: '2', label: '2 W' }] },
        { key: 'transistor', label: 'Treiber', type: 'select', options: [{ value: 'tf-bc547', label: 'BC547 (NPN)' }, { value: 'tf-bd139', label: 'BD139 (NPN, TO-126)' }, { value: 'tf-2n7000', label: '2N7000 (N-MOSFET)' }] },
        { key: 'hfeKey', label: 'h_FE-Zeile des Datenblatts', type: 'select', options: [{ value: 'hfeA', label: 'BC547 Gruppe A' }, { value: 'hfeB', label: 'BC547 Gruppe B' }, { value: 'hfeC', label: 'BC547 Gruppe C' }, { value: 'hfe5m', label: 'BD139 bei 5 mA' }, { value: 'hfe150', label: 'BD139 bei 150 mA' }, { value: '', label: 'keine (MOSFET)' }] },
        { key: 'rB', label: 'Basiswiderstand R_B', type: 'eseries', unit: 'Ω', hint: 'E12-Reihe' },
        { key: 'regler', label: 'Festregler', type: 'select', options: [{ value: 'tf-7805', label: '7805 (5 V, 1 A)' }, { value: 'tf-lm317', label: 'LM317 (einstellbar)' }] },
        { key: 'iLedMa', label: 'LED-Strom mit deinem R_V', type: 'number', unit: 'mA' },
        { key: 'iSumMa', label: 'Summenstrom aus dem Netzteil', type: 'number', unit: 'mA' },
        { key: 'pRegW', label: 'Verlustleistung des Reglers', type: 'number', unit: 'W' },
        { key: 'tjReg', label: 'Sperrschichttemperatur des Reglers', type: 'number', unit: '°C' }
      ],
      fromForm: v => {
        const t = dsOf(v.transistor), r = dsOf(v.regler), l = dsOf('tf-led-r'), n = k => { const x = numOf(typeof v[k] === 'string' ? v[k].replace(',', '.') : v[k]); return fin(x) ? x : null; };
        return { items: [{ role: 'led', ds: 'tf-led-r', part: l ? l.part : '', ref: l ? l.ref : '' }, { role: 'transistor', ds: v.transistor, part: t ? t.part : '', ref: t ? t.ref : '' }, { role: 'regler', ds: v.regler, part: r ? r.part : '', ref: r ? r.ref : '' }],
          calc: { iLedMa: n('iLedMa'), iSumMa: n('iSumMa'), pRegW: n('pRegW'), tjReg: n('tjReg') }, vals: { rV: n('rV'), pRv: n('pRv'), rB: n('rB'), hfeKey: v.hfeKey || '' } };
      },
      open: { ex: 'LED-Vorwiderstand und Regler', ds: 'tf-led-r' },
      hint: ['Der Vorwiderstand nimmt die Spannung auf, die an der LED nicht abfällt: R = (U_Versorgung − U_F) / I. Die Flussspannung steht im Datenblatt der LED (zwischen 10 und 20 mA). Wähle danach den nächsten E12-Wert nach oben.',
        'Der Transistor schaltet den LED-Strom und muss mit Faktor 2 übersteuert werden: I_B = 2 · I_C / h_FE,min, mit h_FE,min aus der Datenblattzeile. R_B = (5 V − 0,7 V) / I_B. Die Verlustleistung des 7805 ist P = (12 V − 5 V) · I_Logik + 12 V · I_Q, die Sperrschichttemperatur T_j = T_amb + P · R_thJA.',
        'LED-Strom, Vorwiderstand E12 aufrunden und Leistung mindestens das Doppelte von I² · R. BC547 Gruppe B (h_FE,min 200), R_B so, dass der Basisstrom zwischen dem nötigen Wert und 5 mA liegt (nächster E12-Wert). Summenstrom = Kanäle · I_LED + Logikstrom + Ruhestrom des Reglers (5 bis 8 mA).'],
      check: safe(checkDs, 'Auswahl'),
      starter: ctx => ({ items: [], calc: {}, vals: {} }),
      solution: ctx => dsSolution(ctx),
      mutants: [
        { name: 'R_V zu klein (LED-Strom viel zu groß)', mutate: (d, ctx) => { d.vals.rV = e12down(e12down(d.vals.rV)); delete d.calc.iLedMa; return d; }, expectFail: ['Vorwiderstand R_V'] },
        { name: 'R_V nicht aus der E12-Reihe', mutate: d => { d.vals.rV = d.vals.rV * 1.03; delete d.calc.iLedMa; return d; }, expectFail: ['Vorwiderstand R_V'] },
        { name: 'Leistung des Vorwiderstands viel zu klein', mutate: d => { d.vals.pRv = 0.01; return d; }, expectFail: ['Leistung des Vorwiderstands'] },
        { name: 'R_B viel zu groß (Basisstrom zu klein)', mutate: d => { d.vals.rB = 47000; return d; }, expectFail: ['Basisstrom'] },
        { name: 'Summenstrom ohne Logik und Regler', mutate: (d, ctx) => { d.calc.iSumMa = P_(ctx).nCh * P_(ctx).iLed; return d; }, expectFail: ['Summenstrom'] },
        { name: 'LM317 statt 7805', mutate: d => { d.items[2] = { role: 'regler', ds: 'tf-lm317', part: 'TF-LM317', ref: 'LM317' }; return d; }, expectFail: ['Festregler'] },
        { name: 'Verlustleistung des Reglers dreifach', mutate: d => { d.calc.pRegW = d.calc.pRegW * 3; return d; }, expectFail: ['Verlustleistung des Reglers'] },
        { name: 'Sperrschichttemperatur ohne Umgebung', mutate: (d, ctx) => { d.calc.tjReg = d.calc.tjReg - P_(ctx).tAmb; return d; }, expectFail: ['Sperrschichttemperatur'] }
      ] },

    { id: 'va2', lab: 'vb', cat: 'Ampelanlage', title: 'Signalgeber-Treiber und 5-V-Versorgung zeichnen', level: 2,
      on: 'sch',
      text: 'Zeichne die Elektronik des Signalgebers mit den Bauteilen aus deiner Auswahl: Für jeden Kanal eine LED mit Vorwiderstand an den 12 V, der Transistor schaltet sie nach Masse und bekommt seinen Strom über R_B von einem Schalter an der 5-V-Schiene. Die 5 V macht der Festregler 7805 aus den 12 V, mit je einem Kondensator an Ein- und Ausgang. Simuliere die LED-Ströme und die 5-V-Schiene.',
      in: ['ampel.ds'], out: 'ampel.sch', type: 'sch.circuit', w: 100, pass: null,
      open: { ex: 'Signalgeber' },
      start: { supply: 12 },
      meas: nl => {                      // gewünschte Messwerte der Simulation (Engine-Adapter: Spannungen in V, Ströme in A)
        const out = [], parts = nl && Array.isArray(nl.parts) ? nl.parts : [], bat = parts.find(p => p.kind === 'BAT' && Math.abs(numOf(p.value) - 12) <= 0.5), reg = parts.find(p => p.kind === 'REG');
        if (bat) out.push({ label: 'U_12V', kind: 'v', ref: bat.ref, pin: '+' });
        if (reg) out.push({ label: 'U_5V', kind: 'v', ref: reg.ref, pin: 'OUT' });
        parts.filter(p => p.kind === 'LED').sort(byRef).forEach((p, i) => out.push({ label: 'I_LED' + (i + 1), kind: 'i', ref: p.ref, pin: 'A' }));
        return out;
      },
      assist: { 1: { kind: 'startschaltung', parts: ['BAT 12 V', 'Masse'] } },
      hint: ['Ein Kanal besteht aus drei Teilen in Reihe zwischen 12 V und Masse: Vorwiderstand, LED und der Transistor (Kollektor zur LED, Emitter an Masse). Der Schalter an der Basis steht für den Arduino-Ausgang.',
        'Beachte die Polung der LED: Die Anode zeigt zur 12-V-Seite. Der Basiswiderstand R_B liegt zwischen dem Schalter und der Basis, der Schalter zwischen R_B und der 5-V-Schiene.',
        'Der 7805 hat die Anschlüsse Eingang, Masse und Ausgang. Eingang an die 12 V, Masse an Masse, Ausgang ist das 5-V-Netz. Je ein Kondensator (zum Beispiel 330 nF am Eingang und 100 nF am Ausgang) gegen Masse. Dann einen Kanal nach dem anderen kopieren und den Strom jeder LED messen.'],
      check: safe(checkSch, 'Schaltplan'),
      starter: ctx => ({ lab: 'sch', name: 'neu', netlist: { v: 1, name: 'neu', parts: [], nets: [] }, meas: {}, snap: {} }),
      solution: ctx => buildSch(P_(ctx), need(ctx, 'ampel.ds')),
      mutants: [
        { name: 'Vorwiderstand eines Kanals falsch', mutate: d => { setPart(d.netlist, 'RV1', p => { p.value = fmtR(numOf(p.value) * 10); }); return d; }, expectFail: ['Bauteilwerte'] },
        { name: 'LED in Kanal 1 verpolt', mutate: d => { setPart(d.netlist, 'D1', p => { p.pins = { A: p.pins.K, K: p.pins.A }; }); d.netlist.nets.forEach(n => { n.pins = n.pins.map(a => (a === 'D1.A' ? 'D1.K' : a === 'D1.K' ? 'D1.A' : a)); }); return d; }, expectFail: ['Topologie'] },
        { name: 'Kondensator am Reglereingang fehlt', mutate: d => dropPart(d.netlist, 'C1') && d, expectFail: ['Regler-Beschaltung'] },
        { name: 'Emitter von Kanal 1 nicht an Masse', mutate: d => { movePin(d.netlist, 'Q1.E', 'N_X'); movePin(d.netlist, 'Q1.S', 'N_X'); return d; }, expectFail: ['Topologie'] },
        { name: 'Reglereingang nicht an den 12 V', mutate: d => { movePin(d.netlist, 'U1.IN', 'N_Y'); return d; }, expectFail: ['Regler-Beschaltung'] },
        { name: 'Steuerschalter von Kanal 1 fehlt', mutate: d => dropPart(d.netlist, 'S1') && d, expectFail: ['Topologie'] },
        { name: 'Messwerte der Simulation gefälscht', mutate: d => { d.meas.I_LED1 = d.meas.I_LED1 * 2; return d; }, expectFail: ['Messwerte der Simulation'] }
      ] },

    { id: 'va3', lab: 'vb', cat: 'Ampelanlage', title: 'Prototyp auf dem Lochraster aufbauen', level: 2,
      on: 'loch',
      text: 'Baue die Schaltung als Prototyp auf das Lochraster. Es kommen nur die Bauteile auf die Platine, die Quellen und Schalter bleiben draußen. Verbinde sie so, dass jedes Netz genau wie im Schaltplan entsteht. Lötbahnen nur waagerecht oder senkrecht, Drähte nur auf der Bestückungsseite, und es darf keine Kurzschlüsse geben.',
      in: ['ampel.sch'], out: 'ampel.loch', type: 'loch.layout', w: 100, pass: null,
      open: { ex: 'Prototyp Ampel' },
      assist: { 1: { kind: 'startverdrahtung' } },
      hint: ['Setze zuerst alle Bauteile aufs Raster, ein Kanal neben dem anderen. Der Plan zeigt dir, welcher Anschluss mit welchem verbunden wird.',
        'Verlege die Masse als durchgehende Lötbahn und die 12 V als zweite. Die kurzen Verbindungen zwischen LED, Widerstand und Transistor lassen sich meist mit der Lötseite lösen, Kreuzungen mit Drahtbrücken auf der Bestückungsseite.',
        'Prüfe am Ende jeden Anschluss mit der Durchgangsprüfung gegen den Plan. Ein Kurzschluss zwischen zwei Netzen ist der häufigste Fehler, vor allem zwischen den Anschlüssen des 7805 nebeneinander.'],
      check: safe(checkLoch, 'Lochraster'),
      starter: ctx => ({ name: 'neu', netlist: { v: 1, name: 'neu', parts: [], nets: [] }, boards: 1, bom: [], doc: { items: [] }, wiresRibbon: 0 }),
      solution: ctx => buildLoch(P_(ctx), need(ctx, 'ampel.sch')),
      mutants: [
        { name: 'Kollektor von Kanal 1 nicht angeschlossen', mutate: d => { dropPin(d.netlist, 'Q1.C'); dropPin(d.netlist, 'Q1.D'); return d; }, expectFail: ['Netze identisch'] },
        { name: 'Kurzschluss: Basiswiderstand an Masse', mutate: d => { movePin(d.netlist, 'RB1.2', 'GND'); return d; }, expectFail: ['Keine Kurzschlüsse', 'Netze identisch'] },
        { name: 'Bauteil fehlt (R_B von Kanal 1)', mutate: d => { dropPart(d.netlist, 'RB1'); return d; }, expectFail: ['Alle Bauteile platziert'] },
        { name: 'Stückliste mit falschem Wert', mutate: d => { d.bom[0].value = d.bom[0].value === '1k' ? '2k2' : '1k'; return d; }, expectFail: ['Stückliste'] },
        { name: 'schräge Lötbahn', mutate: d => { d.doc.items.push({ id: 99, t: 'track', x1: 1, y1: 1, x2: 5, y2: 4 }); return d; }, expectFail: ['Raster-Regeln'] },
        { name: 'Vorwiderstand mit anderem Wert aufgebaut', mutate: d => { setPart(d.netlist, 'RV1', p => { p.value = fmtR(numOf(p.value) * 2); }); return d; }, expectFail: ['Netze identisch'] }
      ] },

    { id: 'va4', lab: 'vb', cat: 'Ampelanlage', title: 'Prototyp prüfen: Messprotokoll', level: 2,
      on: 'mess',
      text: 'Der Prototyp läuft an 12 V. Miss mit dem Multimeter die Versorgung, die 5-V-Schiene und für jeden Kanal den LED-Strom und die Spannung am Treiber. Trage die 5-V-Schiene mit drei Stellen ein, denn sie wird später die Referenz deines ADU. Schreibe in den Befund, wenn etwas nicht zum Schaltplan passt.',
      in: ['ampel.loch', 'ampel.sch'], out: 'ampel.mess', type: 'mess.protocol', w: 100, pass: null,
      form: MESS_FORM,
      fromForm: v => {
        const rows = [], n = k => numOf(typeof v[k] === 'string' ? v[k].replace(',', '.') : v[k]);
        if (fin(n('u12'))) rows.push(mkMessRow('U_12V', 'Versorgung 12 V', 'V', n('u12'), 'Multimeter'));
        if (fin(n('u5'))) rows.push(mkMessRow('U_5V', '5-V-Schiene', 'V', n('u5'), 'Multimeter'));
        for (let k = 1; k <= 5; k++) { if (fin(n('i' + k))) rows.push(mkMessRow('I_LED' + k, 'LED-Strom Kanal ' + k, 'mA', n('i' + k), 'Multimeter')); if (fin(n('c' + k))) rows.push(mkMessRow('U_CE' + k, 'Spannung am Treiber Kanal ' + k, 'V', n('c' + k), 'Multimeter')); }
        return { rows: rows, values: fin(n('u5')) ? { u5v: n('u5') } : {}, findings: v.finding ? [String(v.finding)] : [] };
      },
      open: { ex: 'Prototyp Ampel messen' },
      hint: ['Miss alle Spannungen gegen Masse. Den LED-Strom misst du im Multimeter in Reihe zur LED oder als Spannung über dem Vorwiderstand geteilt durch R_V.',
        'Die 5-V-Schiene weicht von 5,000 V ab: Lies den Wert mit drei Stellen ab (zum Beispiel 4,97 V). Mit dem Wert rechnest du später den ADU.',
        'Weicht ein Kanal stark ab, dann ist am Prototyp etwas anders als im Plan: Ein zehnmal größerer Vorwiderstand lässt die LED fast dunkel, eine verpolte LED lässt keinen Strom fließen. Trage den gemessenen Wert trotzdem ein und schreibe den Befund mit der Kanalnummer.'],
      check: safe(checkMess, 'Messprotokoll'),
      starter: ctx => ({ rows: [], values: {}, findings: [] }),
      solution: ctx => messSolution(ctx),
      mutants: [
        { name: 'U_5V falsch gemessen', mutate: d => { const r = d.rows.find(x => x.id === 'U_5V'); r.ist = r.ist * 0.8; return d; }, expectFail: ['U_5V:'] },
        { name: 'values.u5v auf eine Stelle gerundet', mutate: d => { d.values.u5v = 5; return d; }, expectFail: ['drei Stellen'] },
        { name: 'LED-Strom von Kanal 1 mit falscher Einheit', mutate: d => { d.rows.find(x => x.id === 'I_LED1').unit = 'A'; return d; }, expectFail: ['I_LED1'] },
        { name: 'Messgerät und Einheit fehlen', mutate: d => { d.rows.forEach(r => { r.instrument = ''; }); return d; }, expectFail: ['Protokoll vollständig'] },
        { name: 'Zeile U_CE1 nicht gemessen', mutate: d => { d.rows = d.rows.filter(x => x.id !== 'U_CE1'); return d; }, expectFail: ['U_CE1'] },
        { name: 'Versorgung 12 V falsch', mutate: d => { d.rows.find(x => x.id === 'U_12V').ist = 9; return d; }, expectFail: ['U_12V'] },
        { name: 'Befund fehlt', levels: [3], mutate: d => { d.findings = []; return d; }, expectFail: ['Fehler benannt'] },
        { name: 'Befund ohne Kanalnummer', levels: [3], mutate: d => { d.findings = ['Irgendwo ist ein Fehler im Aufbau.']; return d; }, expectFail: ['Fehler benannt'] }
      ] },

    { id: 'va5', lab: 'vb', cat: 'Ampelanlage', title: 'Dämmerungssensor einstellen', level: 3,
      on: 'sen',
      text: 'Der Dämmerungssensor ist ein LDR im Spannungsteiler an 5 V, gelesen von einem 10-Bit-ADU. Wähle den Teilerwiderstand (E12) und rechne die Schwellen für Nacht und Tag in ADU-Zählwerte um. Als Referenz des ADU nimmst du die 5-V-Schiene, die du gemessen hast. Die Hysterese muss mindestens das Dreifache des Rauschens betragen.',
      in: ['ampel.mess'], out: 'ampel.sen', type: 'sen.chain', w: 100, pass: null,
      form: [
        { key: 'bits', label: 'ADU-Auflösung', type: 'number', unit: 'Bit' },
        { key: 'vref', label: 'ADU-Referenz (deine gemessene 5-V-Schiene)', type: 'number', unit: 'V', hint: 'drei Stellen' },
        { key: 'nachtBelow', label: 'Nachtschwelle: Zählwert, darunter ist Nacht', type: 'number', unit: 'Digit' },
        { key: 'tagAbove', label: 'Tagschwelle: Zählwert, darüber ist Tag', type: 'number', unit: 'Digit' }
      ],
      open: { ex: 'LDR im Teiler', rig: 'licht', sensor: 'ldr' },
      hint: ['Der LDR wird bei Licht niederohmig. Mit dem LDR oben an 5 V steigt die Teilerspannung mit dem Licht. Der Teilerwiderstand sollte etwa zwischen den LDR-Werten bei Nacht- und Tagschwelle liegen.',
        'Zählwert = Teilerspannung / U_ref · 2^Bit. Die Teilerspannung folgt aus der LDR-Kennlinie R = R10 · (E / 10 lx)^(-0,7) mit R10 = 10 kΩ. Die Referenz U_ref ist deine gemessene 5-V-Schiene aus Station 4.',
        'Rechne die Zählwerte für Nachtschwelle und Tagschwelle getrennt aus. Der Abstand zwischen beiden ist die Hysterese. Das Rauschen steht im Lastenheft in mV, geteilt durch die Stufenhöhe (LSB) ergibt es Zählwerte.'],
      check: safe(checkSen, 'Sensorik'),
      starter: ctx => ({ rig: 'licht', preset: '', ctl: { sensor: 'ldr', rLoad: 100, thresh: 2.5, hyst: 0, ambient: 0, fdelay: 0 }, bits: 6, vref: 5, nachtBelow: 0, tagAbove: 0, state: {}, derived: {} }),
      solution: ctx => senSolution(ctx),
      mutants: [
        { name: 'ADU-Referenz nominal 5,000 V statt gemessen', mutate: d => { d.vref = 5; return d; }, expectFail: ['ADU-Referenz'] },
        { name: 'Teilerwiderstand 100 Ω', mutate: d => { d.ctl.rLoad = 100; return d; }, expectFail: ['Nachtschwelle'] },
        { name: 'keine Hysterese', mutate: d => { d.tagAbove = d.nachtBelow + 1; return d; }, expectFail: ['Hysterese'] },
        { name: 'Auflösung 6 Bit', mutate: d => { d.bits = 6; return d; }, expectFail: ['Auflösung'] },
        { name: 'Tagschwelle viel zu hoch', mutate: d => { d.tagAbove = Math.round(d.nachtBelow * 1.8); return d; }, expectFail: ['Tagschwelle'] },
        { name: 'Teilerwiderstand nicht aus E12', mutate: d => { d.ctl.rLoad = d.ctl.rLoad * 1.04; return d; }, expectFail: ['Teilerwiderstand'] }
      ] },

    { id: 'va6', lab: 'vb', cat: 'Ampelanlage', title: 'Nachtabsenkung programmieren', level: 3,
      on: 'code',
      text: 'Programmiere den Arduino: Er liest den LDR an A0 und setzt das Nachtsignal an D7, wenn es dunkel wird, und nimmt es zurück, wenn es hell wird. Benutze die Zählwerte deiner Sensorik-Station und eine Hysterese, damit das Rauschen nicht flattert. Nachts dimmst du die Signalgeber mit PWM an D9 auf den Wert aus dem Lastenheft, tagsüber leuchten sie voll.',
      in: ['ampel.sen'], out: 'ampel.code', type: 'code.sketch', w: 100, pass: null,
      open: { ex: 'Nachtabsenkung' },
      assist: { 1: { kind: 'rahmen' } },
      frame: ctx => codeFrame(P_(ctx)),
      hint: ['Lies den LDR mit analogRead(A0). Merke dir in einer Variablen, ob gerade Nacht ist. Das Nachtsignal schreibst du mit digitalWrite, die Helligkeit der Signalgeber mit analogWrite (0 bis 255).',
        'Nacht ein: Zählwert kleiner als die Nachtschwelle. Nacht aus: Zählwert größer als die Tagschwelle. Dazwischen bleibt der alte Zustand, das ist die Hysterese. Zwei getrennte Bedingungen, nicht eine.',
        '30 Prozent von 255 sind etwa 77. Setze die Helligkeit nachts auf diesen Wert und tagsüber auf 255. Ein delay(20) am Ende von loop() reicht, nie länger als 1 s warten.'],
      check: safe(checkCode, 'Sketch'),
      starter: ctx => ({ lang: 'arduino', src: codeFrame(P_(ctx)), run: { serial: [], events: [] } }),
      solution: ctx => codeSolution(ctx),
      mutants: [
        { name: 'eine Schwelle statt Hysterese', mutate: d => { d.src = d.src.replace(/TAG_UEBER = (\d+)/, (m0, a) => 'TAG_UEBER = ' + (/NACHT_UNTER = (\d+)/.exec(d.src) || [0, a])[1]); return d; }, expectFail: ['Hysterese'] },
        { name: 'Nachtschwelle falsch (50)', mutate: d => { d.src = d.src.replace(/NACHT_UNTER = \d+/, 'NACHT_UNTER = 50'); return d; }, expectFail: ['Nachtschwelle'] },
        { name: 'keine Dimmung nachts', mutate: d => { d.src = d.src.replace('nacht ? DUTY_NACHT : 255', '255'); return d; }, expectFail: ['PWM der Signalgeber'] },
        { name: 'delay(2000)', mutate: d => { d.src = d.src.replace('delay(20)', 'delay(2000)'); return d; }, expectFail: ['Programm:'] },
        { name: 'Syntaxfehler', mutate: d => { d.src = d.src.replace(/\}\s*$/, ''); return d; }, expectFail: ['Programm:'] },
        { name: 'Nachtsignal am falschen Pin', mutate: d => { d.src = d.src.replace(/PIN_NACHT = \d+/, 'PIN_NACHT = 8'); return d; }, expectFail: ['Nachtschwelle'] }
      ] },

    { id: 'va7', lab: 'vb', cat: 'Ampelanlage', title: 'Ampelsteuerung programmieren', level: 3,
      on: 'sps',
      text: 'Programmiere die Bedarfsampel mit den Zeiten aus dem Lastenheft: Die Straße ist grün, bis ein Fußgänger den Taster drückt. Nach der Mindest-Grünzeit folgen Gelb, Sperrzeit, Fußgänger-Grün, Sperrzeit und Rot-Gelb. Fußgänger und Fahrzeuge haben nie gleichzeitig Grün. Wenn der Arduino Nacht meldet (Eingang I0.1 gleich 0), blinkt Gelb mit 1 Hz und die Fußgänger sehen Rot.',
      in: ['ampel.code'], out: 'ampel.sps', type: 'sps.program', w: 100, pass: null,
      open: { ex: 'Ampel', plant: 'ampel' },
      assist: { 1: { kind: 'rahmenprogramm', lang: 'kop', symbols: SYM, networks: ['Tagbetrieb starten', 'Nachtbetrieb', 'Anforderung merken', 'Mindest-Grün', 'Gelbzeit', 'Sperrzeit', 'Fußgänger-Grün', 'Rot-Gelb', 'Nachtblinken', 'Ausgänge'] } },
      hint: ['Baue die Phasen als Kette von Merkern mit je einem Zeitglied (TON): Grün, Gelb, Sperrzeit, Fußgänger-Grün, Sperrzeit, Rot-Gelb. Wenn ein Zeitglied abläuft, setzt es den nächsten Merker und löscht den alten.',
        'Der Taster liefert nur einen kurzen Impuls: Merke dir die Anforderung in einem eigenen Merker und lösche ihn erst, wenn das Fußgänger-Grün beginnt. Die Straße darf erst nach der Mindest-Grünzeit auf Gelb gehen.',
        'Nachtbetrieb: Zwei Zeitglieder, die sich gegenseitig zurücksetzen, erzeugen den 1-Hz-Takt (0,5 s Pause, 0,5 s Leuchten). Die Nacht beginnt am besten erst, wenn die Straße wieder grün ist, damit kein Fußgänger auf der Fahrbahn überrascht wird.'],
      check: safe(checkSps, 'SPS'),
      starter: ctx => ({ prog: { lang: 'kop', symbols: Object.assign({}, SYM), networks: [] }, plant: 'ampel', opts: {}, lang: 'kop' }),
      solution: ctx => ({ prog: buildProgram(P_(ctx)), plant: 'ampel', opts: { scenario: 'viele_fussgaenger' }, lang: 'kop', notes: 'Musterlösung: Phasenkette mit Merkern und Zeitgliedern, gemerkte Anforderung, Nachtblinken' }),
      mutants: [
        { name: 'Gelbzeit nur 1 s', mutate: d => { tonOf(d, 'T2').pt = 1000; return d; }, expectFail: ['Gelbzeit'] },
        { name: 'Mindest-Grün entfernt (1 s)', mutate: d => { tonOf(d, 'T1').pt = 1000; return d; }, expectFail: ['Mindest-Grün'] },
        { name: 'keine Sperrzeit', mutate: d => { tonOf(d, 'T3').pt = 100; tonOf(d, 'T5').pt = 100; return d; }, expectFail: ['Sperrzeit'] },
        { name: 'Fußgänger-Grün nur 2 s', mutate: d => { tonOf(d, 'T4').pt = 2000; return d; }, expectFail: ['Fußgänger-Grünzeit'] },
        { name: 'kein Nachtbetrieb', mutate: d => { d.prog.networks = d.prog.networks.filter(n => n.id !== 'N16' && n.id !== 'N17'); return d; }, expectFail: ['Nachtbetrieb'] },
        { name: 'Nachts blinkt Gelb mit 2 Hz', mutate: d => { tonOf(d, 'T7').pt = 250; tonOf(d, 'T8').pt = 250; return d; }, expectFail: ['Nachtbetrieb'] },
        { name: 'Fußgänger-Grün gleichzeitig mit Straßen-Grün', mutate: d => { d.prog.networks.forEach(n => { if (n.id === 'N22') n.expr = OR_(v_('M1.3'), v_('M1.0')); }); return d; }, expectFail: ['Sicherheit', 'Phasenfolge'] },
        { name: 'Anforderung wird nicht gemerkt', mutate: d => { d.prog.networks.forEach(n => { if (n.id === 'N3') n.expr = AND_(v_('I0.0'), v_('M1.0'), v_('T1.Q')); }); return d; }, expectFail: ['Phasenfolge', 'Wartezeit'] },
        { name: 'Rot-Gelb nur 0,1 s', mutate: d => { tonOf(d, 'T6').pt = 100; return d; }, expectFail: ['Rot-Gelb-Zeit'] }
      ] },

    { id: 'va8', lab: 'vb', cat: 'Ampelanlage', title: 'Betriebsstatistik mit Python', level: 2,
      on: 'pi',
      text: 'Die Ampel schreibt ein Betriebsprotokoll: eine Zeile je Sekunde mit Zeit, Anforderung, Fußgänger-Grün und Nacht. Schreibe ein Python-Programm, das die Daten in der Liste daten auswertet und ausgibt: ANFORDERUNGEN, WARTE_MITTEL, WARTE_MAX und NACHT_PROZENT, jeweils als SCHLÜSSEL=Zahl. Wartezeit ist die Zeit von der Anforderung bis zum nächsten Fußgänger-Grün.',
      in: ['ampel.sps'], out: 'ampel.pi', type: 'pi.script', w: 100, pass: null,
      open: { ex: 'Betriebsstatistik' },
      assist: { 1: { kind: 'rahmen' } },
      frame: ctx => { const lg = logFor(ctx); return pyFrame(lg ? lg.daten.slice(0, 40) : null); },
      dataFor: ctx => piData(ctx),
      stationData: ctx => piData(ctx),
      hint: ['Gehe die Zeilen der Liste der Reihe nach durch (for z in daten). Jede Zeile ist [Zeit, Anforderung, Fußgänger-Grün, Nacht]. Eine neue Anforderung beginnt, wenn die Anforderung von 0 auf 1 springt.',
        'Merke dir die Startzeit der Anforderung. Sobald in einer späteren Zeile das Fußgänger-Grün 1 ist, ist die Wartezeit Zeit minus Startzeit. Summe, Anzahl und Maximum der Wartezeiten mitführen, dann ist der Mittelwert Summe geteilt durch Anzahl.',
        'Nachtanteil = 100 · (Zeilen mit Nacht gleich 1) / Anzahl aller Zeilen. Gib alles mit print aus, zum Beispiel print("WARTE_MAX=" + str(round(maximum, 1))). Das Programm muss mit jeder Liste rechnen, trage keine Zahlen fest ein.'],
      check: safe(checkPi, 'Python'),
      starter: ctx => ({ lang: 'python', src: pyFrame(null), out: [] }),
      solution: ctx => piSolution(ctx),
      mutants: [
        { name: 'Nachtanteil nicht gerechnet', mutate: d => { d.src = d.src.replace('prozent = 100 * nacht / len(daten)', 'prozent = 0'); return d; }, expectFail: ['NACHT_PROZENT'] },
        { name: 'Zahlen fest eingetragen', mutate: (d, ctx) => { const lg = logFor(ctx), r = refOfLog(lg.daten); d.src = '# nur Ausgabe\ndaten = []\nprint("ANFORDERUNGEN=' + r.ANFORDERUNGEN + '")\nprint("WARTE_MITTEL=' + rd(r.WARTE_MITTEL, 1) + '")\nprint("WARTE_MAX=' + rd(r.WARTE_MAX, 1) + '")\nprint("NACHT_PROZENT=' + rd(r.NACHT_PROZENT, 1) + '")'; return d; }, expectFail: ['ANFORDERUNGEN'] },
        { name: 'Maximum statt Mittelwert', mutate: d => { d.src = d.src.replace('str(round(mittel, 1))', 'str(round(maximum, 1))'); return d; }, expectFail: ['WARTE_MITTEL'] },
        { name: 'Syntaxfehler', mutate: d => { d.src = d.src.replace('for z in daten:', 'for z in daten'); return d; }, expectFail: ['Ausgabeformat'] },
        { name: 'Startzeit wird nie gesetzt', mutate: d => { d.src = d.src.replace('        start = zeit\n', ''); return d; }, expectFail: ['WARTE_MAX', 'WARTE_MITTEL'] },
        { name: 'Ausgabe ohne Gleichheitszeichen', mutate: d => { d.src = d.src.replace('"ANFORDERUNGEN="', '"ANFORDERUNGEN: "'); return d; }, expectFail: ['Ausgabeformat', 'ANFORDERUNGEN'] }
      ] }
  ];

  /* ====================================================================== Bericht, Selbsttest, Projektdefinition */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function reportParts(slots, spec) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {}, g = k => (slots || {})[k] ? unwrap(slots[k]) : null;
    const ctx = { spec: { params: P }, slots: slots || {}, get: k => (slots || {})[k] };
    const out = [], pk = g('ampel.ds'), sch = g('ampel.sch'), loch = g('ampel.loch'), mess = g('ampel.mess'), sen = g('ampel.sen'), code = g('ampel.code'), sps = g('ampel.sps'), pyd = g('ampel.pi');
    out.push({ h: 'Lastenheft', rows: [['Signalgeber', P.nCh + ' Kanäle, je ' + fm(P.iLed, 1) + ' mA, ' + P.uSup + ' V'], ['Fußgängerüberweg', P.lWeg + ' m, Fußgänger-Grün ' + P.tPedGruen + ' s'], ['Zeiten', 'Gelb ' + P.tGelb + ' s, Rot-Gelb ' + P.tRotGelb + ' s, Sperrzeit ' + P.tSperr + ' s, Mindest-Grün ' + P.tMinKfzGruen + ' s'], ['Dämmerung', 'Nacht unter ' + P.luxNacht + ' lx, Tag über ' + P.luxTag + ' lx, Dimmung ' + P.dutyNacht + ' %'], ['Versorgung', '5 V über 7805, Logikstrom ' + P.iLogik + ' mA, Netzteil ' + P.iNetz + ' mA']] });
    const pi = pickInfo(pk);
    if (pk) out.push({ h: 'Datenblatt-Auswahl', rows: [['Vorwiderstand', fin(pi.rV) ? fmtRde(pi.rV) + ' Ω, ' + fm(pi.pRv, 3) + ' W' : '?'], ['Treiber', pi.tr ? refOf(pi.tr) + ', R_B ' + (fin(pi.rB) ? fmtRde(pi.rB) + ' Ω' : '?') : '?'], ['Regler', pi.reg ? refOf(pi.reg) : '?'], ['Summenstrom', fm(+pi.calc.iSumMa, 0) + ' mA'], ['Reglerverlust', fm(+pi.calc.pRegW * 1000, 0) + ' mW, ' + fm(+pi.calc.tjReg, 0) + ' °C']] });
    if (sch && isObj(sch.netlist)) out.push({ h: 'Schaltung und Stückliste', rows: sch.netlist.parts.filter(p => !OFFB[p.kind]).map(p => [p.ref, p.kind + (p.value ? ' ' + p.value : '')]) });
    if (loch) out.push({ h: 'Lochraster-Prototyp', rows: [['Platinen', loch.boards], ['Bauteile', arr(loch.bom).length]] });
    if (mess) out.push({ h: 'Messprotokoll', rows: arr(mess.rows).map(r => [r.label || r.id, fm(+r.ist, 2) + ' ' + (r.unit || '') + (r.instrument ? ' (' + r.instrument + ')' : '')]) });
    const ss = sen ? senRead(sen, P) : null;
    if (ss && ss.valid) out.push({ h: 'Sensorik', rows: [['Teilerwiderstand', fmtRde(ss.rLoad) + ' Ω'], ['ADU', ss.bits + ' Bit, Referenz ' + fm(ss.vref, 3) + ' V'], ['Nachtschwelle', ss.nB + ' (' + fm(luxOfCount(ss.nB, ss.bits, P.uLogik + P.dev5, ss.rLoad), 1) + ' lx)'], ['Tagschwelle', ss.tA + ' (' + fm(luxOfCount(ss.tA, ss.bits, P.uLogik + P.dev5, ss.rLoad), 1) + ' lx)']] });
    if (code && code.src) out.push({ h: 'Arduino-Programm', html: '<pre>' + esc(code.src) + '</pre>' });
    if (sps && isObj(sps.prog) && SPS()) { let txt = ''; try { txt = SPS().toText(sps.prog, 'iec', { symbols: true }); } catch (e) { txt = ''; } out.push({ h: 'SPS-Programm', html: '<pre>' + esc(txt) + '</pre>' }); }
    if (pyd && pyd.src) out.push({ h: 'Betriebsstatistik (Python)', html: '<pre>' + esc(pyd.src) + '</pre><pre>' + esc(arr(pyd.out).join('\n')) + '</pre>' });
    return out;
  }
  function selfTest() {
    const r = [];
    try {
      const a = lastenheft(12345, 2), b = lastenheft(12345, 2);
      r.push({ ok: JSON.stringify(a) === JSON.stringify(b), text: 'Ampel: Lastenheft deterministisch' });
      const slots = {}, ctx = { spec: a, level: 2, tol: 1, slots: slots, get: k => slots[k] || null };
      let all = true;
      STATIONS.forEach(s => { const d = s.solution(ctx); slots[s.out] = d; const res = s.check(d, ctx); const sum = res.lines.reduce((p, l) => p + l.pts, 0), got = res.lines.filter(l => l.ok).reduce((p, l) => p + l.pts, 0); if (got !== sum || sum !== 100) all = false; });
      r.push({ ok: all, text: 'Ampel: Musterlösungen aller Stationen 100 %' });
    } catch (e) { r.push({ ok: false, text: 'Ampel: Selbsttest Fehler ' + (e && e.message) }); }
    return r;
  }

  const def = {
    id: PID, name: 'Ampelanlage / Verkehr', icon: '🚦', prefix: 'va', order: 2,
    story: 'Vor der Lehrwerkstatt in Ermsleben queren die Azubis morgens die Straße. Die Stadt will eine Bedarfsampel, und die Tonfunk-Lehrwerkstatt baut das Signalgeber-Modul und die Steuerung. Meister Funk: „Eine Ampel muss vor allem eines: sicher sein. Erst danach darf sie schön blinken – nachts zum Beispiel.“',
    company: 'Tonfunk GmbH Ermsleben',
    labs: ['ds', 'sch', 'loch', 'mess', 'sen', 'code', 'sps', 'pi'],
    levels: { 1: { name: 'Einsteiger', pass: 70, tolMul: 1.5 }, 2: { name: 'Standard', pass: 80, tolMul: 1 }, 3: { name: 'Profi', pass: 90, tolMul: 0.6 } },
    lastenheft: lastenheft,
    stations: STATIONS,
    final: {
      id: 'vaF', title: 'Abschlusstest: Ampelanlage', check: finalCheck,
      solution: ctx => { const slots = {}, c = Object.assign({}, ctx, { get: k => slots[k] || null, slots: slots }); STATIONS.forEach(s => { slots[s.out] = s.solution(c); }); return { slots: slots }; },
      mutants: [
        { name: 'Ampelsteuerung leer', mutate: s => { s['ampel.sps'] = { prog: { lang: 'kop', symbols: {}, networks: [] }, plant: 'ampel', opts: {}, lang: 'kop' }; return s; }, expectFail: ['Gesamtlauf'] },
        { name: 'Lochraster passt nicht zum Schaltplan', mutate: s => { dropPart(s['ampel.loch'].netlist, 'RV1'); return s; }, expectFail: ['Elektronik'] },
        { name: 'Sketch schaltet bei falscher Helligkeit', mutate: s => { s['ampel.code'].src = s['ampel.code'].src.replace(/NACHT_UNTER = (\d+)/, (m0, a) => 'NACHT_UNTER = ' + Math.round(+a * 0.5)); return s; }, expectFail: ['Dämmerungsgenauigkeit', 'Konsistenz'] },
        { name: 'Statistik-Programm fehlt', mutate: s => { s['ampel.pi'] = { lang: 'python', src: 'print("nichts")', out: [] }; return s; }, expectFail: ['Statistik'] }
      ]
    },
    kpis: ['pedgruen', 'wartemittel', 'wartemax', 'iled', 'nachtlux', 'tjreg', 'zyklen'],
    report: reportParts,
    selfTest: selfTest,
    logFor: logFor,
    stationData: (sid, ctx) => { const st = STATIONS.find(s => s.id === sid); return st && typeof st.stationData === 'function' ? st.stationData(ctx) : null; },
    _test: { logStats: logStats, refOfLog: refOfLog, synthLog: synthLog, segmentsOf: segmentsOf, runAmpel: runAmpel, codeScen: codeScen, runCode: runCode, ledCandidates: ledCandidates, ledI: ledI, ufOf: ufOf, vceOf: vceOf, ldrR: ldrR, divU: divU, luxOfCount: luxOfCount, sigmaCounts: sigmaCounts, e12up: e12up, chanSim: chanSim, nightWins: nightWins, boardView: boardView, equivBoards: equivBoards, clearCaches: function () { spsCache.clear(); codeCache.clear(); } },
    demos: [{ id: 'bis4', name: 'Ampelanlage bis Station 4', upTo: 'va4' }, { id: 'fertig', name: 'Ampelanlage fertig', upTo: 'vaF' }]
  };

  /* ---------- Registrierung ---------- */
  const V = root.Verbund || (typeof require === 'function' && typeof module !== 'undefined' ? (function () { try { return require('./verbund.js'); } catch (e) { return null; } })() : null);
  if (V && typeof V.registerProject === 'function') V.registerProject(def);
  else { root.VERBUND_QUEUE = root.VERBUND_QUEUE || []; root.VERBUND_QUEUE.push(def); }
  if (typeof module !== 'undefined' && module.exports) module.exports = def;
  root.VERBUND_AMPEL = def;
})(typeof window !== 'undefined' ? window : globalThis);
