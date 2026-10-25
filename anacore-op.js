/* anacore-op.js - ANA-Lab Kern Teil 2 (ANA_CORE: op, komp, act, deep): Operationsverstaerker, Komparator/Schmitt-Trigger/Rechteckgenerator,
 * Integrierer/Differenzierer/aktive Filter, aufklappbare Vertiefungen (Bode/GBW, Slew-Rate, Offset, Saettigung).
 * Haengt sich per ANA_CORE.extend(...) an anacore.js (Teil 1; in Node per require('./anacore.js') geladen). Reine Rechnung, keine DOM-Zugriffe, node-ladbar.
 * Alle Bauteil- und Anlagenwerte sind Uebungswerte (Lehrmodell, feste Zahlen nur aus ANA_CORE.limits). Simulation fuer Kleinspannung, keine Anleitung
 * fuer Arbeiten an Netzspannung. Kein eval, kein DOM, alle oeffentlichen Funktionen werfen nie.
 *
 * ===================================================================================================
 * LEHRMODELL OPERATIONSVERSTAERKER (SPEC 4.5)
 *  opv:'ideal' (Standard) | 'langsam' | 'schnell'; uv = Betriebsspannung (+), uvn = Betrag der negativen Versorgung (Standard uv, 0 = fehlt/Einfachversorgung).
 *  Aussteuergrenzen usatP = max(0, uv - dU), usatN = max(0, uvn - dU), dU = 0 (ideal) bzw. limits.dusat (real).
 *  Real: ein Pol, A(f) = A0/(1 + j f/fA), fA = GBW/A0; Schaltung mit Vn = 1 + Rf/R1 (Schleife): k = 1/(1 + Vn/A0), fg = fA (1 + A0/Vn) (exakt, ein Tiefpass
 *  erster Ordnung), ra = Ro/(1 + A0/Vn); Slew-Rate und Offsetspannung nur in wave/deep/uosOut. Offset und Eingangsstroeme wirken NICHT auf ua.
 *  Alle Zahlen in SI (V, A, Ohm, F, Hz, s, V/s), Winkel in Grad, Verstaerkung als Zahl (negativ = invertierend), nicht definierte Felder NaN (nie Infinity).
 *
 * SIGNATUREN (SPEC 4.5 bis 4.8; Rueckgabeformen wie stub/stubcore.js, hier die Festlegungen, die dort offen waren)
 *  op.usat(opv, uv) -> Zahl            op.grenzen(cfg) -> { ok, p, n, ideal }
 *  op.inv({r1, rf, ue?, f?, +opv/uv/uvn})  -> { ok, valid, vId, v, vn, beta, fg, ra, ri, usat, usatN, ualin, ua, sat, ueMax, uosOut, hf, phiF, ideal }
 *  op.sum({rf, r[1..6], u[], +opv..})      -> { ok, valid, i[], vk[], ualin, ua, sat, vn, fg, ra, usat, usatN, uosOut, ideal }
 *  op.nin({rg?, rf?, ue?, f?, +opv..})     -> { ok, valid, vId, v, vn, beta, fg, ra, ri, usat, usatN, ualin, ua, sat, ueMax, uosOut, hf, phiF, ideal, folger }
 *  op.folger(cfg) = nin mit rf 0           op.diff({r1..r4, u1?, u2?, +opv..}) -> { ok, valid, a1, a2, vgl, up, ualin, ua, sat, abgleich, vn, fg, ra, usat, usatN, ideal }
 *  op.open({up, un, +opv..}) -> { ok, ua, zustand:'hoch'|'tief'|'schwebt', ud, linear }
 *  op.aussteuer({usat, v}) -> { ok, ueMax }     op.fpb({sr, uhat}) -> Zahl (Hz)     op.slewMax({sr, f}) -> Zahl (V)     op.offset({uos, rf, r1}) -> Zahl (V)
 *  op.freq({art:'inv'|'nin'|'offen', r1|rg, rf, +opv..}, fList) -> { ok, valid, f[], h[], a[], phi[], fg, v0, gbwProdukt, art }  (ideal: valid:false, Felder NaN)
 *  op.wave({art:'inv'|'nin'|'folger', ..., ue, f, form, +opv..}, n) -> { ok, valid, t[], uin[], uout[], slew, clip:null|'ja', uaPeak, usat, usatN, v, fg }
 *  komp.comparator(cfg) = op.open    komp.schmitt({art:'inv'|'nin', r1, r2, r3, r4?, u4?, uref?, +opv..}) -> { ok, valid, art, uo, uu, uh, mitte, usat, usatN, ideal }
 *  komp.osc({r, c, r2, r3, r4?, u4?, uref?, +opv..}) -> { ok, valid, uo, uu, uh, tau, t1, t2, T, f, tastgrad }   komp.sweep(cfg, ueList, hoch) -> { ok, ue[], ua[], uo, uu, hochEnde }
 *  act.integrator({r, c, rp?, ue?, f?, uos?, +opv..}) -> { ok, valid, tau, slope, fRef, vf, v0, fgRp, tSat, drift, tSatOff, uaInf, usat, usatN, rpOffen, tauRp, uaEnd }
 *  act.differentiator({rf, c, rs?, f?}) -> { ok, valid, tau, fRef, vf, fgRs }     act.tp({r1, rf, cf}) -> { ok, valid, v0, fg, tau }   act.hp({r1, rf, c1}) -> { ok, valid, vInf, fg, tau }
 *  act.response({art:'integrierer'|'differenzierer'|'tp'|'hp', ...}, fList) -> { ok, valid, f[], h[], a[], phi[] }
 *  act.wave({art:'integrierer'|'differenzierer'|'tp'|'hp', ..., ue, f, form, +opv..}, n) -> { ok, valid, t[], uin[], uout[], usat, usatN, uaPeak, clip }
 *  deep.bode / slew / offset / sat -> { ok, valid, ...Zahlen, text } oder { ok:true, valid:false, why }
 *
 * Abweichungen von SPEC/Stub (Begruendung ABWEICHUNGEN.md, Abschnitt WP1b1):
 *  - act.integrator: ohne Parallelwiderstand (rp fehlt oder >= 1e11) sind v0, fgRp, uaInf NaN (rpOffen:true); der Stub rechnete mit R_OFFEN.
 *  - op.diff, op.sum rechnen mit dem endlichen A0 (Verstaerkungsfehler k) wie inv/nin; Offset wirkt nie auf ua.
 *  - op.wave/act.wave: Ausgabe fuer t_i = i*T/n gleichzeitig mit dem Eingang bei t_i. Tiefpass erster Ordnung exakt fuer stueckweise lineare Eingaenge
 *    (Rechteck: stueckweise konstant, Flanken exakt bei halber Periode), Startzustand = eingeschwungener linearer Zustand; der Integrierer startet entladen,
 *    sein Zustand wird an den Aussteuergrenzen festgehalten (kein Aufwickeln). Ideal: nur Begrenzen, kein Frequenzgang.
 * ===================================================================================================
 */
(function (root) {
  'use strict';
  let core = null;
  try { if (typeof require === 'function') core = require('./anacore.js'); } catch (e) { core = null; }
  if (!core) core = root.ANA_CORE;
  if (!core || !core.util || typeof core.extend !== 'function') {
    try { if (typeof console !== 'undefined') console.warn('anacore-op.js: anacore.js (Teil 1) fehlt, nichts registriert.'); } catch (e) { /* */ }
    return;
  }
  const U = core.util;
  const num = U.num, fin = U.fin, isArr = U.isArr, none = U.none, invalid = U.invalid, V = U.V, reqObj = U.reqObj, reqPos = U.reqPos, reqNn = U.reqNn, reqFin = U.reqFin,
    optPos = U.optPos, optNn = U.optNn, optFin = U.optFin, reqRange = U.reqRange, C = U.C, S = U.S, LV = U.LV, TWO_PI = U.TWO_PI, DEG = U.DEG, R_OFFEN = U.R_OFFEN;
  const fmtEng = core.fmtEng, fmt = core.fmt;
  const E = function (x, u) { return fmtEng(x, u); };
  const OFFEN_AB = 1e11;   // ab diesem Widerstand gilt ein Zweig als "offen"

  /* =============================== Modell des Operationsverstaerkers =============================== */
  const OPV = { langsam: { gbw: 'gbw_langsam', sr: 'sr_langsam', uos: 'uos_langsam' }, schnell: { gbw: 'gbw_schnell', sr: 'sr_schnell', uos: 'uos_schnell' } };
  function model(c) {
    const o = c.opv;
    let ideal = true, t = null;
    if (!none(o)) {
      if (o === 'ideal') ideal = true;
      else if (typeof o === 'string' && U.has(OPV, o)) { ideal = false; t = OPV[o]; }
      else V('Den Operationsverstärker „' + (typeof o === 'string' ? o : '?') + '“ gibt es nicht: erlaubt sind ideal, langsam und schnell.');
    }
    const uv = optNn(c.uv, LV('uv_std'), 'Die Betriebsspannung U_v', 1e3), uvn = optNn(c.uvn, uv, 'Die negative Betriebsspannung', 1e3);
    if (ideal) return { ideal: true, a0: NaN, gbw: NaN, sr: NaN, uos: 0, ro: 0, rid: NaN, uv: uv, uvn: uvn, usat: uv, usatN: uvn, fA: NaN };
    const ds = LV('dusat'), a0 = LV('a0'), gbw = LV(t.gbw);
    return { ideal: false, a0: a0, gbw: gbw, sr: LV(t.sr), uos: LV(t.uos), ro: LV('ro_ol'), rid: LV('rid'), uv: uv, uvn: uvn, usat: Math.max(0, uv - ds), usatN: Math.max(0, uvn - ds), fA: gbw / a0 };
  }
  /* Schleife mit Rauschverstaerkung vn = 1 + Rf/R1: Verstaerkungsfehler k, Grenzfrequenz fg, Ausgangswiderstand ra */
  function loop(vn, m) {
    if (m.ideal) return { beta: 1 / vn, k: 1, fg: NaN, ra: 0, ab: NaN };
    const ab = m.a0 / vn;
    return { beta: 1 / vn, k: 1 / (1 + 1 / ab), fg: m.fA * (1 + ab), ra: m.ro / (1 + ab), ab: ab };
  }
  function clipU(u, m) { return u > m.usat ? m.usat : (u < -m.usatN ? -m.usatN : u); }
  function over(u, m) { return u > m.usat || u < -m.usatN; }
  function lg20(h) { return h > 0 ? 20 * Math.log10(h) : NaN; }

  /* =============================== Signalformen (Darstellung) =============================== */
  const FORMS = ['sinus', 'rechteck', 'dreieck', 'gleich'];
  function formOf(v) { if (none(v)) return 'sinus'; if (FORMS.indexOf(v) < 0) V('Die Eingangsform „' + (typeof v === 'string' ? v : '?') + '“ gibt es nicht: erlaubt sind sinus, rechteck, dreieck und gleich.'); return v; }
  function wf(form, ue, f, t) {
    let x = f * t; x -= Math.floor(x + 1e-9); if (x < 0) x = 0;
    if (form === 'rechteck') return x < 0.5 - 1e-9 ? ue : -ue;
    if (form === 'dreieck') return 2 * ue / Math.PI * Math.asin(Math.sin(TWO_PI * x));
    if (form === 'gleich') return ue;
    return ue * Math.sin(TWO_PI * x);
  }
  /* Tiefpass erster Ordnung, exakter Schritt fuer stueckweise linearen Eingang: y1 = ea*y0 + om*w0 + gh*(w1 - w0); h = dt/tau; numerisch stabil fuer jedes h */
  function foh(dt, tau) {
    const h = dt / tau, ea = Math.exp(-h), om = -Math.expm1(-h), g = h < 1e-3 ? h * h / 2 * (1 - h / 3 * (1 - h / 4)) : h - om;
    return { ea: ea, om: om, gh: g / h };
  }
  /* Eingang des Schritts k als Paar [w0, w1]: Rechteck stueckweise konstant (Flanken liegen auf den Schrittgrenzen), sonst stueckweise linear von t_k nach t_(k+1); w(x) = Eingang bei x*dt */
  function seg(form, w) { return form === 'rechteck' ? function (k) { const m = w(k + 0.5); return [m, m]; } : function (k) { return [w(k), w(k + 1)]; }; }
  /* Eingeschwungener Zustand bei t = 0 fuer einen periodischen Eingang (sg(k) = Eingang des Schritts k, n Schritte je Periode): Antwort einer Periode ab null, geteilt durch 1 - e^(-T/tau) */
  function steadyState(n, K, tOverTau, sg) {
    let s = 0;
    for (let i = 0; i < n; i++) { const q = sg(i); s = K.ea * s + K.om * q[0] + K.gh * (q[1] - q[0]); }
    return s / -Math.expm1(-tOverTau);
  }
  function nPoints(n) { return none(n) ? 256 : Math.floor(reqRange(n, 16, 8192, 'Die Punktzahl n')); }
  function maxAbs(a) { let m = 0; for (let i = 0; i < a.length; i++) { const x = Math.abs(a[i]); if (x > m) m = x; } return m; }
  function freqList(fl) {
    if (!isArr(fl)) V('Die Frequenzliste fehlt.');
    if (fl.length > 20000) V('Die Frequenzliste ist zu lang (höchstens 20000 Werte).');
    const o = [];
    for (let i = 0; i < fl.length; i++) { const x = num(fl[i], NaN); if (x > 0 && x <= 1e13) o.push(x); }
    return o;
  }

  /* =============================== 4.5 Operationsverstaerker (op) =============================== */
  function invCalc(cfg) {
    const c = reqObj(cfg), r1 = reqPos(c.r1, 'Der Eingangswiderstand R_1'), rf = reqPos(c.rf, 'Der Rückkopplungswiderstand R_f'), m = model(c);
    const ue = optFin(c.ue, 0, 'Die Eingangsspannung U_e', 1e6), f = optNn(c.f, 0, 'Die Frequenz f', 1e13);
    const vn = 1 + rf / r1, lp = loop(vn, m), vId = -rf / r1, v = vId * lp.k, lin = v * ue;
    const x = !m.ideal && f > 0 ? f / lp.fg : 0;
    return { ok: true, valid: true, vId: vId, v: v, vn: vn, beta: lp.beta, fg: lp.fg, ra: lp.ra, ri: r1, usat: m.usat, usatN: m.usatN, ualin: lin, ua: clipU(lin, m), sat: over(lin, m),
      ueMax: Math.min(m.usat, m.usatN) / Math.abs(v), uosOut: m.uos * vn, hf: Math.abs(v) / Math.sqrt(1 + x * x), phiF: 180 - Math.atan(x) * DEG, ideal: m.ideal };
  }
  function ninCalc(cfg) {
    const c = reqObj(cfg), rf = optNn(c.rf, 0, 'Der Rückkopplungswiderstand R_f'), rg = optPos(c.rg, R_OFFEN, 'Der Widerstand R_g nach Masse'), m = model(c);
    const ue = optFin(c.ue, 0, 'Die Eingangsspannung U_e', 1e6), f = optNn(c.f, 0, 'Die Frequenz f', 1e13);
    const folger = rf === 0 || rg >= OFFEN_AB, vn = folger ? 1 : 1 + rf / rg, lp = loop(vn, m), v = vn * lp.k, lin = v * ue;
    const x = !m.ideal && f > 0 ? f / lp.fg : 0;
    return { ok: true, valid: true, vId: vn, v: v, vn: vn, beta: lp.beta, fg: lp.fg, ra: lp.ra, ri: m.ideal ? R_OFFEN : m.rid * (1 + lp.ab), usat: m.usat, usatN: m.usatN, ualin: lin, ua: clipU(lin, m),
      sat: over(lin, m), ueMax: Math.min(m.usat, m.usatN) / v, uosOut: m.uos * vn, hf: v / Math.sqrt(1 + x * x), phiF: -Math.atan(x) * DEG, ideal: m.ideal, folger: folger };
  }
  function openCalc(cfg) {
    const c = reqObj(cfg), up = reqFin(c.up, 'Die Spannung am +Eingang', 1e6), un = reqFin(c.un, 'Die Spannung am −Eingang', 1e6), m = model(c), d = up - un;
    const zustand = d > 0 ? 'hoch' : (d < 0 ? 'tief' : 'schwebt');
    let ua, linear = false;
    if (m.ideal) ua = d > 0 ? m.usat : (d < 0 ? -m.usatN : 0);
    else { const lin = m.a0 * d; ua = clipU(lin, m); linear = !over(lin, m); }
    return { ok: true, ua: ua, zustand: zustand, ud: d, linear: linear, usat: m.usat, usatN: m.usatN, ideal: m.ideal };
  }
  function freqCalc(cfg, fList) {
    const c = reqObj(cfg), f = freqList(fList), m = model(c), art = none(c.art) ? 'inv' : c.art;
    if (art !== 'inv' && art !== 'nin' && art !== 'offen') V('Die Schaltung „' + (typeof art === 'string' ? art : '?') + '“ gibt es nicht: erlaubt sind inv, nin und offen.');
    let v0, fc, ph0, vn = NaN;
    if (art === 'offen') { if (!m.ideal) { v0 = m.a0; fc = m.fA; ph0 = 0; } }
    else if (art === 'inv') {
      const r1 = reqPos(c.r1, 'Der Eingangswiderstand R_1'), rf = reqPos(c.rf, 'Der Rückkopplungswiderstand R_f'); vn = 1 + rf / r1;
      if (!m.ideal) { const lp = loop(vn, m); v0 = rf / r1 * lp.k; fc = lp.fg; ph0 = 180; }
    } else {
      const rf = optNn(c.rf, 0, 'Der Rückkopplungswiderstand R_f'), rg = optPos(c.rg, R_OFFEN, 'Der Widerstand R_g nach Masse'); vn = (rf === 0 || rg >= OFFEN_AB) ? 1 : 1 + rf / rg;
      if (!m.ideal) { const lp = loop(vn, m); v0 = vn * lp.k; fc = lp.fg; ph0 = 0; }
    }
    if (m.ideal) {
      const nan = f.map(function () { return NaN; });
      return invalid('Beim idealen Operationsverstärker ist der Frequenzgang unbegrenzt: Wähle langsam oder schnell, dann gibt es eine Grenzfrequenz.', ['fg', 'v0', 'gbwProdukt'],
        { f: f, h: nan.slice(), a: nan.slice(), phi: nan.slice(), art: art });
    }
    const h = f.map(function (x) { const q = x / fc; return v0 / Math.sqrt(1 + q * q); });
    return { ok: true, valid: true, f: f, h: h, a: h.map(lg20), phi: f.map(function (x) { return ph0 - Math.atan(x / fc) * DEG; }), fg: fc, v0: v0, gbwProdukt: v0 * fc, art: art, vn: vn };
  }
  function opWave(cfg, nIn) {
    const c = reqObj(cfg), n = nPoints(nIn), art = none(c.art) ? 'inv' : c.art;
    if (art !== 'inv' && art !== 'nin' && art !== 'folger') V('Die Schaltung „' + (typeof art === 'string' ? art : '?') + '“ gibt es nicht: erlaubt sind inv, nin und folger.');
    const r = art === 'inv' ? invCalc(c) : ninCalc(art === 'folger' ? Object.assign({}, c, { rf: 0 }) : c), m = model(c);
    const ue = reqFin(c.ue, 'Die Amplitude U_e', 1e6), f = reqPos(c.f, 'Die Frequenz f', 1e9), form = formOf(c.form);
    const T = 1 / f, dt = T / n, t = [], uin = [], uout = []; let slew = false, clip = false;
    if (m.ideal) {   // ohne Frequenzgang: Ausgang = V * Eingang, nur Begrenzen
      for (let i = 0; i < n; i++) { const u = wf(form, ue, f, i * dt), w = r.v * u; t.push(i * dt); uin.push(u); uout.push(clipU(w, m)); if (over(w, m)) clip = true; }
    } else {
      // Verzoegerung erster Ordnung (f_g), exakt fuer stueckweise lineare Eingaenge, danach Slew-Rate-Begrenzung und Begrenzen auf die Aussteuergrenzen.
      // Startzustand: eingeschwungener linearer Zustand der Periode; danach drei Perioden Einschwingen (fuer Slew-Rate und Begrenzen), dann eine Periode Ausgabe.
      const tau = 1 / (TWO_PI * r.fg), K = foh(dt, tau), mx = m.sr * dt, warm = 3, sg = seg(form, function (x) { return r.v * wf(form, ue, f, x * dt); });
      let y = steadyState(n, K, T / tau, sg), p, i;
      for (p = 0; p <= warm; p++) {
        for (i = 0; i < n; i++) {
          const k = p * n + i, q = sg(k), w0 = q[0], w1 = q[1];
          if (p === warm) { t.push(i * dt); uin.push(wf(form, ue, f, k * dt)); uout.push(y); }
          let ny = K.ea * y + K.om * w0 + K.gh * (w1 - w0);
          const dy = ny - y; if (Math.abs(dy) > mx) { ny = y + (dy > 0 ? mx : -mx); if (p === warm) slew = true; }
          if (ny > m.usat) { ny = m.usat; if (p === warm) clip = true; } else if (ny < -m.usatN) { ny = -m.usatN; if (p === warm) clip = true; }
          y = ny;
        }
      }
    }
    return { ok: true, valid: true, art: art, t: t, uin: uin, uout: uout, slew: slew, clip: clip ? 'ja' : null, uaPeak: maxAbs(uout), usat: m.usat, usatN: m.usatN, v: r.v, fg: r.fg, ideal: m.ideal };
  }
  const op = {
    usat: C(function (opv, uv) { return model({ opv: opv, uv: uv }).usat; }),
    grenzen: S(function (cfg) { const m = model(reqObj(cfg)); return { ok: true, p: m.usat, n: m.usatN, ideal: m.ideal }; }),
    inv: S(invCalc),
    sum: S(function (cfg) {
      const c = reqObj(cfg), rf = reqPos(c.rf, 'Der Rückkopplungswiderstand R_f'), r = c.r, u = c.u;
      if (!isArr(r) || r.length < 1 || r.length > 6) V('Der Summierer braucht 1 bis 6 Eingangswiderstände.');
      if (!isArr(u) || u.length !== r.length) V('Zu jedem Eingangswiderstand gehört genau eine Eingangsspannung.');
      const rr = r.map(function (x) { return reqPos(x, 'Der Eingangswiderstand R_k'); }), uu = u.map(function (x) { return reqFin(x, 'Die Eingangsspannung U_k', 1e6); });
      const m = model(c), gs = rr.reduce(function (s, x) { return s + 1 / x; }, 0), vn = 1 + rf * gs, lp = loop(vn, m), i = uu.map(function (x, j) { return x / rr[j]; });
      const lin = -rf * i.reduce(function (s, x) { return s + x; }, 0) * lp.k;
      return { ok: true, valid: true, i: i, vk: rr.map(function (x) { return -rf / x * lp.k; }), ualin: lin, ua: clipU(lin, m), sat: over(lin, m), vn: vn, fg: lp.fg, ra: lp.ra, usat: m.usat, usatN: m.usatN, uosOut: m.uos * vn, ideal: m.ideal };
    }),
    nin: S(ninCalc),
    folger: S(function (cfg) { return ninCalc(Object.assign({}, reqObj(cfg), { rf: 0 })); }),
    diff: S(function (cfg) {
      const c = reqObj(cfg), r1 = reqPos(c.r1, 'Der Widerstand R_1'), r2 = reqPos(c.r2, 'Der Widerstand R_2'), r3 = reqPos(c.r3, 'Der Widerstand R_3'), r4 = reqPos(c.r4, 'Der Widerstand R_4'), m = model(c);
      const u1 = optFin(c.u1, 0, 'Die Spannung U_1', 1e6), u2 = optFin(c.u2, 0, 'Die Spannung U_2', 1e6), vn = 1 + r3 / r1, lp = loop(vn, m);
      const a1 = -r3 / r1 * lp.k, a2 = r4 / (r2 + r4) * vn * lp.k, lin = a1 * u1 + a2 * u2;
      return { ok: true, valid: true, a1: a1, a2: a2, vgl: a1 + a2, up: u2 * r4 / (r2 + r4), ualin: lin, ua: clipU(lin, m), sat: over(lin, m), abgleich: (r4 / r2) / (r3 / r1), vn: vn, fg: lp.fg, ra: lp.ra, usat: m.usat, usatN: m.usatN, ideal: m.ideal };
    }),
    open: S(openCalc),
    aussteuer: S(function (cfg) {
      const c = reqObj(cfg), us = reqNn(c.usat, 'Die Aussteuergrenze U_sat', 1e4), v = reqFin(c.v, 'Die Spannungsverstärkung V_u', 1e12);
      if (v === 0) V('Die Spannungsverstärkung V_u darf nicht 0 sein.');
      return { ok: true, ueMax: us / Math.abs(v) };
    }),
    fpb: C(function (cfg) { const c = reqObj(cfg); return reqPos(c.sr, 'Die Slew-Rate SR', 1e12) / (TWO_PI * reqPos(c.uhat, 'Die Amplitude û', 1e4)); }),
    slewMax: C(function (cfg) { const c = reqObj(cfg); return reqPos(c.sr, 'Die Slew-Rate SR', 1e12) / (TWO_PI * reqPos(c.f, 'Die Frequenz f', 1e13)); }),
    offset: C(function (cfg) { const c = reqObj(cfg); return reqFin(c.uos, 'Die Offsetspannung U_os', 1) * (1 + optNn(c.rf, 0, 'Der Widerstand R_f') / reqPos(c.r1, 'Der Widerstand R_1')); }),
    freq: S(freqCalc),
    wave: S(opWave)
  };

  /* =============================== 4.6 Komparator, Schmitt-Trigger, Rechteckgenerator (komp) =============================== */
  function thr(c, m) {   // invertierender Schmitt-Trigger: Schwellen aus Thevenin am +Knoten
    const r2 = reqPos(c.r2, 'Der Widerstand R_2 (Mitkopplung)'), r3 = reqPos(c.r3, 'Der Widerstand R_3'), r4 = optPos(c.r4, 0, 'Der Widerstand R_4');
    const uref = optFin(c.uref, 0, 'Die Bezugsspannung U_ref', 1e4), u4 = optFin(c.u4, 0, 'Die Spannung U_4', 1e4);
    const g3 = 1 / r3, g4 = r4 > 0 ? 1 / r4 : 0, rth = 1 / (g3 + g4), uth = (g3 * uref + g4 * u4) / (g3 + g4), k = rth / (r2 + rth);
    return { uo: uth + (m.usat - uth) * k, uu: uth + (-m.usatN - uth) * k, uth: uth, rth: rth };
  }
  function schmittCalc(cfg) {
    const c = reqObj(cfg), m = model(c), art = none(c.art) ? 'inv' : c.art;
    if (art !== 'inv' && art !== 'nin') V('Die Art „' + (typeof art === 'string' ? art : '?') + '“ gibt es nicht: erlaubt sind inv (invertierend) und nin (nichtinvertierend).');
    let uo, uu;
    if (art === 'nin') {
      const r1 = reqPos(c.r1, 'Der Widerstand R_1 (Eingang)'), r2 = reqPos(c.r2, 'Der Widerstand R_2 (Mitkopplung)'), uref = optFin(c.uref, 0, 'Die Bezugsspannung U_ref', 1e4), q = uref * (1 + r1 / r2);
      uo = q + m.usatN * r1 / r2; uu = q - m.usat * r1 / r2;
    } else { const t = thr(c, m); uo = t.uo; uu = t.uu; }
    const r = { ok: true, valid: true, art: art, uo: uo, uu: uu, uh: uo - uu, mitte: (uo + uu) / 2, usat: m.usat, usatN: m.usatN, ideal: m.ideal };
    if (!(m.usat + m.usatN > 0)) { r.valid = false; r.why = 'Ohne Versorgung kippt der Ausgang nicht: Es gibt keine Schaltschwellen mit Hysterese (U_H = 0).'; }
    return r;
  }
  const komp = {
    comparator: S(openCalc),
    schmitt: S(schmittCalc),
    osc: S(function (cfg) {
      const c = reqObj(cfg), r = reqPos(c.r, 'Der Widerstand R des Zeitglieds'), cc = reqPos(c.c, 'Der Kondensator C', 1), m = model(c), t = thr(c, m), tau = r * cc;
      if (!(t.uo < m.usat && t.uu > -m.usatN && t.uo > t.uu)) {
        return invalid('Die Schwellen (U_o = ' + E(t.uo, 'V') + ', U_u = ' + E(t.uu, 'V') + ') liegen außerhalb der Aussteuergrenzen (+' + E(m.usat, 'V') + ' / −' + E(m.usatN, 'V') + '): Der Oszillator schwingt nicht.',
          ['uh', 't1', 't2', 'T', 'f', 'tastgrad'], { uo: t.uo, uu: t.uu, tau: tau });
      }
      const t1 = tau * Math.log((m.usat - t.uu) / (m.usat - t.uo)), t2 = tau * Math.log((t.uo + m.usatN) / (t.uu + m.usatN)), T = t1 + t2;
      return { ok: true, valid: true, uo: t.uo, uu: t.uu, uh: t.uo - t.uu, tau: tau, t1: t1, t2: t2, T: T, f: 1 / T, tastgrad: t1 / T };
    }),
    sweep: S(function (cfg, ueList, hoch) {
      const s = schmittCalc(cfg);
      if (!isArr(ueList)) V('Die Liste der Eingangsspannungen fehlt.');
      if (ueList.length > 100000) V('Die Liste der Eingangsspannungen ist zu lang (höchstens 100000 Werte).');
      const ue = ueList.map(function (x) { return reqFin(x, 'Die Eingangsspannung U_e', 1e6); });
      let high = hoch !== false; const inv = s.art === 'inv', ua = [];
      for (let i = 0; i < ue.length; i++) {
        const u = ue[i];
        if (inv) { if (high && u > s.uo) high = false; else if (!high && u < s.uu) high = true; }
        else { if (!high && u > s.uo) high = true; else if (high && u < s.uu) high = false; }
        ua.push(high ? s.usat : -s.usatN);
      }
      return { ok: true, ue: ue, ua: ua, uo: s.uo, uu: s.uu, hochEnde: high, valid: s.valid, art: s.art };
    })
  };

  /* =============================== 4.7 Integrierer, Differenzierer, aktive Filter (act) =============================== */
  const act = {
    integrator: S(function (cfg) {
      const c = reqObj(cfg), r = reqPos(c.r, 'Der Widerstand R'), cc = reqPos(c.c, 'Der Kondensator C', 1), m = model(c), rp = optPos(c.rp, R_OFFEN, 'Der Parallelwiderstand R_p'), rpOffen = rp >= OFFEN_AB;
      const ue = optFin(c.ue, 0, 'Die Eingangsspannung U_e', 1e6), f = optNn(c.f, 0, 'Die Frequenz f', 1e13), uos = optFin(c.uos, m.uos, 'Die Offsetspannung U_os', 1);
      const tau = r * cc, slope = -ue / tau, drift = uos / tau;
      const v0 = rpOffen ? NaN : -rp / r, uaInf = rpOffen ? NaN : uos * (1 + rp / r);
      return { ok: true, valid: true, tau: tau, slope: slope, fRef: 1 / (TWO_PI * tau), vf: f > 0 ? 1 / (TWO_PI * f * tau) : NaN, v0: v0, fgRp: rpOffen ? NaN : 1 / (TWO_PI * rp * cc),
        tSat: slope === 0 ? NaN : (slope < 0 ? m.usatN : m.usat) / Math.abs(slope), drift: drift, tSatOff: uos === 0 ? NaN : (uos > 0 ? m.usat : m.usatN) * tau / Math.abs(uos),
        uaInf: uaInf, usat: m.usat, usatN: m.usatN, rpOffen: rpOffen, tauRp: rpOffen ? NaN : rp * cc, uaEnd: rpOffen ? NaN : v0 * ue + uaInf };
    }),
    differentiator: S(function (cfg) {
      const c = reqObj(cfg), rf = reqPos(c.rf, 'Der Widerstand R_f'), cc = reqPos(c.c, 'Der Kondensator C', 1), rs = optNn(c.rs, 0, 'Der Serienwiderstand R_s'), f = none(c.f) ? NaN : reqNn(c.f, 'Die Frequenz f', 1e13), tau = rf * cc;
      const q = rs > 0 ? TWO_PI * f * rs * cc : 0;
      return { ok: true, valid: true, tau: tau, fRef: 1 / (TWO_PI * tau), vf: fin(f) ? TWO_PI * f * tau / Math.sqrt(1 + q * q) : NaN, fgRs: rs > 0 ? 1 / (TWO_PI * rs * cc) : NaN };
    }),
    tp: S(function (cfg) {
      const c = reqObj(cfg), r1 = reqPos(c.r1, 'Der Widerstand R_1'), rf = reqPos(c.rf, 'Der Widerstand R_f'), cf = reqPos(c.cf, 'Der Kondensator C_f', 1);
      return { ok: true, valid: true, v0: -rf / r1, fg: 1 / (TWO_PI * rf * cf), tau: rf * cf };
    }),
    hp: S(function (cfg) {
      const c = reqObj(cfg), r1 = reqPos(c.r1, 'Der Widerstand R_1'), rf = reqPos(c.rf, 'Der Widerstand R_f'), c1 = reqPos(c.c1, 'Der Kondensator C_1', 1);
      return { ok: true, valid: true, vInf: -rf / r1, fg: 1 / (TWO_PI * r1 * c1), tau: r1 * c1 };
    }),
    response: S(function (cfg, fList) {
      const c = reqObj(cfg), f = freqList(fList), art = c.art;
      let H;   // komplexer Frequenzgang { re, im } bei f
      if (art === 'integrierer') {
        const r = reqPos(c.r, 'Der Widerstand R'), cc = reqPos(c.c, 'Der Kondensator C', 1), rp = optPos(c.rp, R_OFFEN, 'Der Parallelwiderstand R_p');
        if (rp >= OFFEN_AB) H = function (x) { return { re: 0, im: 1 / (TWO_PI * x * r * cc) }; };   // -1/(jwRC) = j/(wRC)
        else { const t = rp * cc; H = function (x) { const w = TWO_PI * x * t, d = 1 + w * w; return { re: -rp / r / d, im: rp / r * w / d }; }; }
      } else if (art === 'differenzierer') {
        const rf = reqPos(c.rf, 'Der Widerstand R_f'), cc = reqPos(c.c, 'Der Kondensator C', 1), rs = optNn(c.rs, 0, 'Der Serienwiderstand R_s');
        H = function (x) { const w = TWO_PI * x, nr = w * rf * cc, q = rs > 0 ? w * rs * cc : 0, d = 1 + q * q; return { re: -nr * q / d, im: -nr / d }; };   // -jwRfC/(1 + jwRsC)
      } else if (art === 'tp') {
        const r1 = reqPos(c.r1, 'Der Widerstand R_1'), rf = reqPos(c.rf, 'Der Widerstand R_f'), cf = reqPos(c.cf, 'Der Kondensator C_f', 1);
        H = function (x) { const w = TWO_PI * x * rf * cf, d = 1 + w * w; return { re: -rf / r1 / d, im: rf / r1 * w / d }; };   // -(Rf/R1)/(1 + jwRfCf)
      } else if (art === 'hp') {
        const r1 = reqPos(c.r1, 'Der Widerstand R_1'), rf = reqPos(c.rf, 'Der Widerstand R_f'), c1 = reqPos(c.c1, 'Der Kondensator C_1', 1);
        H = function (x) { const w = TWO_PI * x * r1 * c1, d = 1 + w * w, g = rf / r1; return { re: -g * w * w / d, im: -g * w / d }; };   // -(Rf/R1) jwR1C1/(1 + jwR1C1)
      } else V('Die Schaltung „' + (typeof art === 'string' ? art : '?') + '“ gibt es nicht: erlaubt sind integrierer, differenzierer, tp und hp.');
      const z = f.map(H), h = z.map(function (q) { return Math.hypot(q.re, q.im); });
      if (!h.every(fin)) V('Mit diesen Bauteilwerten gibt es keinen gültigen Frequenzgang.');
      return { ok: true, valid: true, art: art, f: f, h: h, a: h.map(lg20), phi: z.map(function (q) { const p = Math.atan2(q.im, q.re) * DEG; return p === -180 ? 180 : p; }) };
    }),
    wave: S(function (cfg, nIn) {
      const c = reqObj(cfg), n = nPoints(nIn), art = c.art;
      if (['integrierer', 'differenzierer', 'tp', 'hp'].indexOf(art) < 0) V('Die Schaltung „' + (typeof art === 'string' ? art : '?') + '“ gibt es nicht: erlaubt sind integrierer, differenzierer, tp und hp.');
      const m = model(c), ue = reqFin(c.ue, 'Die Amplitude U_e', 1e6), f = reqPos(c.f, 'Die Frequenz f', 1e9), form = formOf(c.form), T = 1 / f, dt = T / n;
      let gain = 0, tauS = 0, rp = R_OFFEN, r = 0, tauI = 0, rfC = 0, rs = 0, cc = 0;
      if (art === 'integrierer') { r = reqPos(c.r, 'Der Widerstand R'); cc = reqPos(c.c, 'Der Kondensator C', 1); rp = optPos(c.rp, R_OFFEN, 'Der Parallelwiderstand R_p'); tauI = r * cc; }
      else if (art === 'differenzierer') { const rf = reqPos(c.rf, 'Der Widerstand R_f'); cc = reqPos(c.c, 'Der Kondensator C', 1); rs = optNn(c.rs, 0, 'Der Serienwiderstand R_s'); rfC = rf * cc; if (rs > 0) { gain = rf / rs; tauS = rs * cc; } }
      else if (art === 'tp') { const r1 = reqPos(c.r1, 'Der Widerstand R_1'), rf = reqPos(c.rf, 'Der Widerstand R_f'), cf = reqPos(c.cf, 'Der Kondensator C_f', 1); gain = rf / r1; tauS = rf * cf; }
      else { const r1 = reqPos(c.r1, 'Der Widerstand R_1'), rf = reqPos(c.rf, 'Der Widerstand R_f'), c1 = reqPos(c.c1, 'Der Kondensator C_1', 1); gain = rf / r1; tauS = r1 * c1; }
      const t = [], uin = [], uout = []; let clip = false;
      function emit(i, u, out) { const lim = clipU(out, m); t.push(i * dt); uin.push(u); uout.push(lim); if (lim !== out) clip = true; }
      if (art === 'integrierer') {
        // Kondensator zu Beginn entladen, zwei Perioden, Ausgabe der zweiten; der Zustand wird an den Aussteuergrenzen festgehalten (kein Aufwickeln)
        const rpOff = rp >= OFFEN_AB, om = rpOff ? 0 : -Math.expm1(-dt / (rp * cc)); let y = 0;
        for (let i = 0; i < 2 * n; i++) {
          const t0 = i * dt;
          if (i >= n) emit(i - n, wf(form, ue, f, t0), y);
          const um = wf(form, ue, f, t0 + dt / 2), yn = rpOff ? y - um * dt / tauI : y * (1 - om) + om * (-um * rp / r);
          if (i >= n && (yn > m.usat || yn < -m.usatN)) clip = true;
          y = clipU(yn, m);
        }
      } else if (art === 'differenzierer' && !(rs > 0)) {
        for (let i = 0; i < n; i++) { const t0 = i * dt; emit(i, wf(form, ue, f, t0), -rfC * (wf(form, ue, f, t0 + dt / 2) - wf(form, ue, f, t0 - dt / 2)) / dt); }
      } else {
        // Tiefpasszustand s (Tiefpass: Ausgang, Hochpass/Differenzierer mit R_s: Tiefpass des Eingangs) im eingeschwungenen periodischen Zustand
        const K = foh(dt, tauS), sg = seg(form, function (x) { const u = wf(form, ue, f, x * dt); return art === 'tp' ? -gain * u : u; });
        let s = steadyState(n, K, T / tauS, sg);
        for (let i = 0; i < n; i++) {
          const ua = wf(form, ue, f, i * dt), q = sg(i), w0 = q[0], w1 = q[1];
          emit(i, ua, art === 'tp' ? s : -gain * (ua - s));
          s = K.ea * s + K.om * w0 + K.gh * (w1 - w0);
        }
      }
      return { ok: true, valid: true, art: art, t: t, uin: uin, uout: uout, usat: m.usat, usatN: m.usatN, uaPeak: maxAbs(uout), clip: clip ? 'ja' : null };
    })
  };

  /* =============================== 4.8 Vertiefungen (deep): reine Packer ueber op.* und act.* =============================== */
  const deep = {
    bode: S(function (cfg) {
      const c = reqObj(cfg), art = none(c.art) ? 'inv' : c.art;
      if (art !== 'inv' && art !== 'nin') V('Das Bode-Diagramm gibt es für inv und nin.');
      const r = freqCalc(Object.assign({}, c, { art: art }), core.grid(1e3, 61, 1, 4));
      if (r.valid === false) return r;
      const m = model(c), vn = r.vn, hO = r.f.map(function (x) { const q = x / m.fA; return m.a0 / Math.sqrt(1 + q * q); }), phiO = r.f.map(function (x) { return -Math.atan(x / m.fA) * DEG; });
      const prod = vn * r.fg;
      return Object.assign({}, r, { fA: m.fA, gbw: m.gbw, a0: m.a0, vn: vn, fgNaeh: m.gbw / vn, abwNaeh: Math.abs(m.gbw / vn - r.fg) / r.fg, hOpen: hO, aOpen: hO.map(lg20), phiOpen: phiO,
        text: 'GBW ≈ V_n · f_g = ' + fmt(vn) + ' · ' + E(r.fg, 'Hz') + ' = ' + E(prod, 'Hz') + ' (Leerlauf: f_A = ' + E(m.fA, 'Hz') + ', GBW = ' + E(m.gbw, 'Hz') + ')' });
    }),
    slew: S(function (cfg) {
      const c = reqObj(cfg), m = model(c), uhat = none(c.uhat) ? NaN : reqPos(c.uhat, 'Die Amplitude û', 1e4), f = none(c.f) ? NaN : reqPos(c.f, 'Die Frequenz f', 1e13);
      if (m.ideal) return invalid('Der ideale Operationsverstärker hat keine Slew-Rate: Wähle langsam oder schnell.', ['sr', 'fpb', 'uhatMax', 'tAnstieg']);
      const fpb = fin(uhat) ? m.sr / (TWO_PI * uhat) : NaN, uhatMax = fin(f) ? m.sr / (TWO_PI * f) : NaN, tA = fin(uhat) ? uhat / m.sr : NaN, srT = fmt(m.sr / 1e6, 3) + ' V/µs';
      const parts = [];
      if (fin(uhat)) parts.push('f_max = SR / (2π · û) = ' + srT + ' / (2π · ' + E(uhat, 'V') + ') = ' + E(fpb, 'Hz') + '; Anstiegszeit für ' + E(uhat, 'V') + ' = û / SR = ' + E(tA, 's'));
      if (fin(f)) parts.push('û_max = SR / (2π · f) = ' + srT + ' / (2π · ' + E(f, 'Hz') + ') = ' + E(uhatMax, 'V'));
      return { ok: true, valid: true, sr: m.sr, fpb: fpb, uhatMax: uhatMax, tAnstieg: tA, text: parts.length ? parts.join('; ') : 'Slew-Rate SR = ' + srT + ' (gib û oder f an).' };
    }),
    offset: S(function (cfg) {
      const c = reqObj(cfg), m = model(c), r1 = reqPos(c.r1, 'Der Widerstand R_1'), rf = optNn(c.rf, 0, 'Der Widerstand R_f'), uos = optFin(c.uos, m.uos, 'Die Offsetspannung U_os', 1), vn = 1 + rf / r1, off = uos * vn;
      return { ok: true, valid: true, uos: uos, uaOff: off, vn: vn, ideal: m.ideal,
        text: 'U_a,off = U_os · (1 + R_f / R_1) = ' + E(uos, 'V') + ' · (1 + ' + E(rf, 'Ω') + ' / ' + E(r1, 'Ω') + ') = ' + E(off, 'V') + (m.ideal && none(c.uos) ? ' (idealer Operationsverstärker: U_os = 0)' : '') };
    }),
    sat: S(function (cfg) {
      const c = reqObj(cfg), m = model(c), v = reqFin(c.v, 'Die Spannungsverstärkung V_u', 1e12);
      if (v === 0) V('Die Spannungsverstärkung V_u darf nicht 0 sein.');
      const ue = Math.min(m.usat, m.usatN) / Math.abs(v);
      return { ok: true, valid: true, usat: m.usat, usatN: m.usatN, ueMax: ue, ideal: m.ideal, text: 'U_e,max = U_sat / |V_u| = ' + E(Math.min(m.usat, m.usatN), 'V') + ' / ' + fmt(Math.abs(v)) + ' = ' + E(ue, 'V') };
    })
  };

  core.extend('op', op); core.extend('komp', komp); core.extend('act', act); core.extend('deep', deep);
  if (typeof module !== 'undefined') module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);
