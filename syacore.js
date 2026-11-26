'use strict';
/* Tonfunk Systemanalyse-Lab: reine Rechenlogik (Kennung 'sya'). window.SYA_CORE bzw. module.exports.
   ALLE Zahlen (Spannungen, Ströme, Bauteilwerte, Preise, Stundensätze) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   Modellgerät: Temperaturwächter TW-1 vom Modellbetrieb (frei erfunden). Netzteil mit Trafo, Brückengleichrichter, Ladeelko und 5-V-Festspannungsregler,
   Mikrocontroller mit Anzeige, NTC-Fühler im Spannungsteiler, Relaistreiber mit NPN-Transistor und Freilaufdiode, Relais mit Ausgang.
   Themen: Blockschaltbild und Signalweg, Fehlersuche nach Messprotokoll, Prüfung nach Instandsetzung (Grenzwerte siehe PRUEFEN.md),
   Bauteile dimensionieren, Dokumentation und Kostenvoranschlag.
   Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(€|eur|euro|mΩ|kΩ|MΩ|Ω|ohm|µF|uF|mF|mA|µA|A|mV|kV|V|mW|W|K\/W|°C|°|grad|%|min|h|Hz|m|Stück|Stk)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtDe(v, dec, group) {
    if (!fin(v)) return '-';
    dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '-'; dec = dec == null ? 2 : dec;
    let s = fmtDe(rd(v, dec), dec, group);
    if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, '');
    return s;
  }

  /* ---------- Zufall (seed-fähig) ---------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ============================================================ Modellgerät TW-1 */
  /* PRUEFEN S1: Modellwerte des TW-1 (Trafo 230 V / 9 V unter Last, Brücke mit 0,7 V je Diode, Ladeelko 2.200 µF, 5-V-Regler mit 2 V Mindestabstand,
     5-V-Last 200 mA, Relaisspule 12 V / 400 Ω an der ungeregelten Spannung, NTC 10 kΩ bei 25 °C mit B = 3.950 K gegen 10 kΩ, Schaltpunkt 60 °C) sind Übungswerte. */
  const MODEL = { Unetz: 230, U2: 9, UF: 0.7, C1: 2200e-6, Ureg: 5, Udrop: 2, I5: 0.2, Rsp: 400, Rf: 10000, R25: 10000, B: 3950, Tsoll: 60, RB: 4700, UBE: 0.7, UCEsat: 0.1, fNetz: 50 };
  const BLOCKS = [
    { k: 'netz', n: 'Netzanschluss', d: 'Netzstecker mit Schutzleiter (Schutzklasse I), Netzleitung' },
    { k: 'f1', n: 'Sicherung F1 und Schalter S1', d: 'Feinsicherung träge und Netzschalter auf der Primärseite' },
    { k: 'trafo', n: 'Trafo T1', d: 'Netztrafo 230 V / 9 V, trennt sicher vom Netz' },
    { k: 'gl', n: 'Gleichrichter V1', d: 'Brückengleichrichter aus vier Dioden' },
    { k: 'c1', n: 'Ladeelko C1', d: 'Glättet die pulsierende Gleichspannung (2.200 µF)' },
    { k: 'reg', n: 'Regler U1', d: 'Festspannungsregler 5 V mit Kühlkörper' },
    { k: 'mc', n: 'Mikrocontroller und Anzeige', d: 'Misst die Temperatur, zeigt sie an und schaltet das Relais ab 60 °C' },
    { k: 'ntc', n: 'Temperaturfühler', d: 'NTC 10 kΩ im Spannungsteiler mit 10 kΩ gegen 5 V' },
    { k: 'drv', n: 'Relaistreiber', d: 'Basiswiderstand RB, NPN-Transistor V2, Freilaufdiode V3' },
    { k: 'rel', n: 'Relais K1', d: 'Relais 12 V, Spule an der ungeregelten Spannung von C1, Kontakt schaltet den Ausgang' }
  ];
  /* Messpunkte: wo, was erwartet wird (Art), Block davor */
  const MPS = [
    { k: 'MP1', n: 'Primärseite nach F1 und S1', art: 'ac', blk: 'f1', netz: true },
    { k: 'MP2', n: 'Sekundärseite des Trafos', art: 'ac', blk: 'trafo' },
    { k: 'MP3', n: 'Ladeelko C1 (ungeregelt)', art: 'dc', blk: 'c1' },
    { k: 'MP4', n: 'Ausgang des Reglers (5 V)', art: 'dc', blk: 'reg' },
    { k: 'MP5', n: 'Fühlereingang (Spannungsteiler)', art: 'dc', blk: 'ntc' },
    { k: 'MP6', n: 'Ausgang des Mikrocontrollers zum Treiber', art: 'dc', blk: 'mc' },
    { k: 'MP7', n: 'Basis von V2', art: 'dc', blk: 'drv' },
    { k: 'MP8', n: 'Kollektor von V2 (Spule unten)', art: 'dc', blk: 'drv' }
  ];
  /* Fehler im Modellgerät. bild = was der Kunde meldet bzw. was du siehst; ursache = Erklärung nach der Auflösung */
  /* PRUEFEN S2: Fehlerbilder und Messwerte der Fehler (vor allem: ausgetrockneter Elko 330 µF statt 2.200 µF, thermische Abschaltung des Reglers, durchlegierter Transistor wegen fehlender Freilaufdiode) sind vereinfacht. */
  const FAULTS = [
    { k: 'ok', n: 'Kein Fehler, Gerät in Ordnung', blk: '', ursache: 'Alle Messwerte liegen im Sollbereich. Das Gerät arbeitet richtig.' },
    { k: 'sich', n: 'Sicherung F1 durchgebrannt', blk: 'f1', ursache: 'Hinter F1 liegt keine Netzspannung an (MP1 = 0 V), davor schon. Wichtig: Vor dem Tausch die Ursache suchen (z. B. Windungsschluss im Trafo), sonst brennt die neue Sicherung gleich wieder durch.' },
    { k: 'trafo', n: 'Trafo T1: Primärwicklung unterbrochen', blk: 'trafo', ursache: 'An MP1 liegen 230 V, an MP2 kommt nichts an. Die Primärwicklung ist unterbrochen (häufig durch Überhitzung). Prüfung spannungsfrei: Widerstand der Primärwicklung ist unendlich.' },
    { k: 'diode', n: 'Gleichrichter V1: eine Diode unterbrochen', blk: 'gl', ursache: 'Die Brücke arbeitet nur noch als Einweggleichrichter: Die Brummspannung an MP3 hat 50 Hz statt 100 Hz und ist etwa doppelt so groß. Das Gerät läuft noch, die Reserve des Reglers ist aber kleiner.' },
    { k: 'elko', n: 'Ladeelko C1 ausgetrocknet (Kapazität zu klein)', blk: 'c1', ursache: 'Der Elko hat nur noch etwa 330 µF statt 2.200 µF. Die Brummspannung an MP3 ist stark gestiegen, in den Tälern fällt die Spannung unter 7 V. Dann kann der Regler die 5 V nicht mehr halten: Einbrüche an MP4, Neustarts, flackernde Anzeige.' },
    { k: 'regler', n: 'Regler U1 überhitzt (Wärmeleitpaste fehlt, Kühlkörper lose)', blk: 'reg', ursache: 'Der Regler wird zu heiß und schaltet sich mit seinem Übertemperaturschutz ab. Nach dem Abkühlen geht er wieder an. MP4 springt zwischen 0 V und 5 V, MP3 ist in Ordnung. Abhilfe: Kühlkörper fest montieren, Wärmeleitpaste bzw. Wärmeleitfolie.' },
    { k: 'fopen', n: 'Temperaturfühler: Leitung unterbrochen', blk: 'ntc', ursache: 'Ist der NTC (unten im Teiler) abgetrennt, zieht der 10-kΩ-Widerstand den Eingang auf 5 V (MP5 = 5 V). Die Software erkennt das und meldet F1. Das Relais bleibt aus (sicherer Zustand).' },
    { k: 'fshort', n: 'Temperaturfühler: Kurzschluss in der Leitung', blk: 'ntc', ursache: 'Bei Kurzschluss liegt der Eingang auf 0 V (MP5 = 0 V). Die Software meldet F2, das Relais bleibt aus.' },
    { k: 'rb', n: 'Basiswiderstand RB unterbrochen', blk: 'drv', ursache: 'Der Mikrocontroller schaltet richtig (MP6 = 5 V), an der Basis kommt aber nichts an (MP7 = 0 V). V2 sperrt, das Relais zieht nie an.' },
    { k: 'tr', n: 'Transistor V2 durchlegiert (Freilaufdiode V3 fehlt)', blk: 'drv', ursache: 'Kollektor und Emitter von V2 sind kurzgeschlossen: MP8 liegt immer bei 0 V, das Relais ist dauernd angezogen, auch wenn MP6 = 0 V ist. Ursache: Ohne Freilaufdiode erzeugt die Spule beim Abschalten eine hohe Spannungsspitze, die den Transistor zerstört. Beim Tausch die Diode wieder einbauen (Kathode an Plus).' },
    { k: 'spule', n: 'Relaisspule K1 unterbrochen', blk: 'rel', ursache: 'Ohne Spule bekommt der Kollektor keine Spannung: MP8 zeigt auch bei ausgeschaltetem Transistor 0 V statt der Spannung von C1. Ansteuerung und Transistor sind in Ordnung, das Relais zieht nie an.' }
  ];
  const faultOf = k => FAULTS.find(x => x.k === k) || FAULTS[0];

  /* NTC und Spannungsteiler (NTC unten gegen Masse, Rf oben gegen 5 V) */
  const T0 = 273.15;
  const rntc = T => (num(T) > -T0 ? MODEL.R25 * Math.exp(MODEL.B * (1 / (T + T0) - 1 / (25 + T0))) : NAN);
  const divider = (U, Rtop, Rbot) => (num(U) >= 0 && num(Rtop) >= 0 && num(Rbot) >= 0 && Rtop + Rbot > 0 ? U * Rbot / (Rtop + Rbot) : NAN);
  const usens = (T, U) => divider(U == null ? MODEL.Ureg : U, MODEL.Rf, rntc(T));

  /* Netzteil-Grundformeln */
  const peak = Ueff => (num(Ueff) >= 0 ? Ueff * Math.SQRT2 : NAN);
  const ucPeak = (Ueff, nD, UF) => (num(Ueff) >= 0 && num(nD) >= 0 && num(UF) >= 0 ? Math.max(0, Ueff * Math.SQRT2 - nD * UF) : NAN);
  const ripple = (I, f, C) => (num(I) >= 0 && num(f) > 0 && num(C) > 0 ? I / (f * C) : NAN);
  const capFor = (I, f, dU) => (num(I) >= 0 && num(f) > 0 && num(dU) > 0 ? I / (f * dU) : NAN);

  /* Simulation des Geräts: fault = Fehlerkennung, T = Temperatur am Fühler (°C). Messwerte je Messpunkt { dc, ac, pp, f, jump } */
  function sim(fault, T) {
    const M = MODEL; fault = faultOf(fault).k; T = num(T); if (!fin(T)) T = 25;
    const r = { fault, T, mp: {} };
    const U1 = fault === 'sich' ? 0 : M.Unetz, U2 = fault === 'sich' || fault === 'trafo' ? 0 : M.U2;
    const fr = fault === 'diode' ? M.fNetz : 2 * M.fNetz, C = fault === 'elko' ? 330e-6 : M.C1;
    const up = ucPeak(U2, 2, M.UF), on = up > 0;
    /* Sensor und Steuerung zuerst mit idealen 5 V bestimmen (danach Versorgungszustand) */
    const uSens = fault === 'fopen' ? M.Ureg : fault === 'fshort' ? 0 : usens(T);
    const sensErr = fault === 'fopen' ? 'F1' : fault === 'fshort' ? 'F2' : '';
    const cmd = on && !sensErr && T >= M.Tsoll;
    const relayOn = on && (fault === 'tr' || (cmd && fault !== 'rb' && fault !== 'spule'));
    const Icoil = relayOn ? (up - 0.5) / M.Rsp : 0;
    const Iload = on ? M.I5 * (fault === 'regler' ? 0.5 : 1) + Icoil : 0;
    const pp3 = on ? ripple(Iload, fr, C) : 0, dc3 = on ? up - pp3 / 2 : 0, min3 = up - pp3;
    /* Regler: hält 5 V, solange die Eingangsspannung nicht unter Ureg + Udrop fällt */
    let dc4 = 0, pp4 = 0, jump4 = false;
    if (on) {
      if (fault === 'regler') { dc4 = 2.5; pp4 = M.Ureg; jump4 = true; }
      else if (min3 < M.Ureg + M.Udrop) { pp4 = rd(M.Ureg + M.Udrop - min3, 2); dc4 = M.Ureg - pp4 / 3; }
      else { dc4 = M.Ureg; pp4 = 0.01; }
    }
    const v5 = on ? dc4 / M.Ureg : 0;
    const dc5 = on ? uSens * v5 : 0;
    const dc6 = cmd ? dc4 : 0;
    const dc7 = !on ? 0 : fault === 'rb' ? 0 : cmd ? M.UBE : 0;
    let dc8;
    if (!on) dc8 = 0;
    else if (fault === 'tr') dc8 = 0;
    else if (fault === 'spule') dc8 = 0;
    else if (cmd && fault !== 'rb') dc8 = M.UCEsat;
    else dc8 = dc3;
    const dcp = (dc, pp, f, jump) => ({ dc: rd(dc, 2), pp: rd(pp, 2), ac: rd(pp / (2 * Math.sqrt(3)), 2), f, jump: !!jump });
    const acp = Ueff => ({ dc: 0, ac: rd(Ueff, 1), pp: rd(Ueff * 2 * Math.SQRT2, 1), f: Ueff > 0 ? M.fNetz : 0, jump: false });
    r.mp.MP1 = acp(U1); r.mp.MP2 = acp(U2);
    r.mp.MP3 = dcp(dc3, pp3, on ? fr : 0);
    r.mp.MP4 = dcp(dc4, pp4, on && pp4 > 0.05 && !jump4 ? fr : 0, jump4);
    r.mp.MP5 = dcp(dc5, on ? pp4 * dc5 / M.Ureg : 0, 0, jump4);
    r.mp.MP6 = dcp(dc6, 0, 0, jump4 && cmd);
    r.mp.MP7 = dcp(dc7, 0, 0, jump4 && cmd);
    r.mp.MP8 = dcp(dc8, dc8 > 1 ? pp3 : 0, 0, false);
    /* Zustand am Gerät */
    const tShow = Math.round(T);
    r.relay = relayOn && fault !== 'regler' ? true : relayOn && fault === 'regler' ? 'springt' : false;
    r.display = !on ? 'dunkel' : fault === 'regler' ? 'geht nach einigen Minuten aus und kommt nach dem Abkühlen wieder' : sensErr ? sensErr : fault === 'elko' ? tShow + ' °C, flackert, Gerät startet manchmal neu' : tShow + ' °C';
    r.led = !on ? 'aus' : cmd ? 'an' : 'aus';
    r.cmd = cmd; r.sensErr = sensErr;
    return r;
  }
  /* Messung mit dem simulierten Messgerät: mode 'dc' (V=), 'ac' (V~ Effektivwert), 'osz' (Oszilloskop: Uss und Frequenz) */
  function measure(fault, T, mpk, mode) {
    const s = sim(fault, T), m = s.mp[mpk]; if (!m) return null;
    const mp = MPS.find(x => x.k === mpk);
    if (mode === 'dc') return { mode, v: mp.art === 'ac' ? 0 : m.dc, unit: 'V', jump: m.jump };
    if (mode === 'ac') return { mode, v: m.ac, unit: 'V', jump: m.jump };
    if (mode === 'osz') return { mode, v: m.pp, dc: mp.art === 'ac' ? 0 : m.dc, f: m.f, unit: 'V', jump: m.jump, art: mp.art };
    return null;
  }
  /* Halbierungsmethode: bei n Stufen (Blöcken) höchstens ceil(log2 n) Messungen; erste Messung hinter Block n/2 */
  const maxMeas = n => (Number.isInteger(n) && n >= 1 ? (n === 1 ? 0 : Math.ceil(Math.log2(n) - 1e-12)) : NAN);

  /* ============================================================ Prüfung nach Instandsetzung (Grenzwerte: siehe PRUEFEN.md) */
  /* PRUEFEN S3: Grenzwerte nach DIN VDE 0701-0702 bzw. DIN EN 50678 (VDE 0701) und DIN EN 50699 (VDE 0702): Schutzleiterwiderstand 0,3 Ω bis 5 m Leitung,
     je weitere 7,5 m plus 0,1 Ω, höchstens 1 Ω; Isolationswiderstand SK I 1 MΩ, SK II 2 MΩ, SK III 0,25 MΩ (Prüfspannung 500 V DC, SK III 250 V);
     Schutzleiterstrom 3,5 mA; Berührungsstrom 0,5 mA. Sonderfälle (Heizelemente, große Leistungen) sind nicht im Lab. */
  function rpeLimit(L) {
    if (!(num(L) > 0)) return NAN;
    return Math.min(1, rd(0.3 + 0.1 * Math.max(0, Math.ceil((L - 5) / 7.5 - 1e-9)), 2));
  }
  const RISO = { 1: 1.0, 2: 2.0, 3: 0.25 };
  const risoLimit = sk => (RISO[sk] != null ? RISO[sk] : NAN);
  const IPE_MAX = 3.5, IB_MAX = 0.5;
  const PRUEF_SCHRITTE = ['Sichtprüfung', 'Schutzleiterwiderstand messen (nur Schutzklasse I)', 'Isolationswiderstand messen', 'Schutzleiterstrom bzw. Berührungsstrom messen', 'Funktionsprüfung', 'Bewerten und dokumentieren'];
  const SICHT_OK = ['Gehäuse ohne Risse, Schrauben fest', 'Netzleitung ohne Schäden, Zugentlastung fest', 'Aufschriften und Typenschild lesbar', 'Stecker unbeschädigt, Kontakte sauber'];
  const SICHT_BAD = ['Netzleitung am Knickschutz gequetscht, Isolierung eingerissen', 'Zugentlastung lose, Leitung lässt sich herausziehen', 'Gehäuse gerissen, Teile mit Netzspannung berührbar', 'Stecker angeschmort'];
  /* Prüffall: Schutzklasse, Leitungslänge, Messwerte; jede Zeile mit Grenzwert und Urteil */
  function makePruef(seed) {
    const R = rng('sya-pr-' + seed), sk = R() < 0.65 ? 1 : 2, L = pick(R, [1.5, 2, 3, 5, 7, 10, 15]);
    const nBad = pick(R, [0, 0, 1, 1, 2]), which = shuffle(R, sk === 1 ? ['sicht', 'rpe', 'riso', 'ileak', 'fkt'] : ['sicht', 'riso', 'ileak', 'fkt']).slice(0, nBad);
    const bad = k => which.includes(k), rows = [];
    rows.push({ k: 'sicht', n: 'Sichtprüfung', wert: bad('sicht') ? pick(R, SICHT_BAD) : pick(R, SICHT_OK), grenz: 'keine Schäden', ok: !bad('sicht') });
    if (sk === 1) {
      const lim = rpeLimit(L), v = bad('rpe') ? rd(lim + pick(R, [0.05, 0.12, 0.3]), 2) : rd(Math.max(0.05, lim - pick(R, [0.06, 0.12, 0.18])), 2);
      rows.push({ k: 'rpe', n: 'Schutzleiterwiderstand', wert: v, unit: 'Ω', grenz: '≤ ' + fmtN(lim, 2) + ' Ω', lim, ok: v <= lim });
    }
    const rl = risoLimit(sk), rv = bad('riso') ? rd(rl * pick(R, [0.3, 0.5, 0.8]), 2) : pick(R, [12, 35, 80, 150, 300]);
    rows.push({ k: 'riso', n: 'Isolationswiderstand (500 V DC)', wert: rv, unit: 'MΩ', grenz: '≥ ' + fmtN(rl, 2) + ' MΩ', lim: rl, ok: rv >= rl });
    const il = sk === 1 ? IPE_MAX : IB_MAX, iv = bad('ileak') ? rd(il * pick(R, [1.2, 1.5, 2.2]), 2) : rd(il * pick(R, [0.05, 0.1, 0.3, 0.6]), 2);
    rows.push({ k: 'ileak', n: sk === 1 ? 'Schutzleiterstrom' : 'Berührungsstrom', wert: iv, unit: 'mA', grenz: '≤ ' + fmtN(il, 2) + ' mA', lim: il, ok: iv <= il });
    rows.push({ k: 'fkt', n: 'Funktionsprüfung', wert: bad('fkt') ? 'Relais schaltet bei 60 °C nicht' : 'Anzeige und Relais arbeiten bei 60 °C richtig', grenz: 'Funktion wie vorgesehen', ok: !bad('fkt') });
    return { seed: String(seed), sk, L, rows, ok: rows.every(x => x.ok) };
  }

  /* ============================================================ Bauteile dimensionieren */
  const regLoss = (Uin, Uout, I) => (num(Uin) >= 0 && num(Uout) >= 0 && num(I) >= 0 && Uin >= Uout ? (Uin - Uout) * I : NAN);
  /* größter zulässiger Wärmewiderstand des Kühlkörpers: Rth,K = (ϑj − ϑu) / P − Rth,JG − Rth,GK */
  const rthK = (tj, tu, P, rjg, rgk) => (num(tj) > num(tu) && num(P) > 0 && num(rjg) >= 0 && num(rgk) >= 0 ? (tj - tu) / P - rjg - rgk : NAN);
  const minUin = (Uout, Udrop, dU) => (num(Uout) >= 0 && num(Udrop) >= 0 && num(dU) >= 0 ? Uout + Udrop + dU : NAN);
  /* Relaistreiber: Ic = U / R_Spule, IB = Ic / B · ü, RB = (U_St − UBE) / IB */
  const coilI = (U, R) => (num(U) >= 0 && num(R) > 0 ? U / R : NAN);
  const baseI = (Ic, B, ue) => (num(Ic) >= 0 && num(B) > 0 && num(ue) > 0 ? Ic / B * ue : NAN);
  const rBase = (Ust, Ube, Ib) => (num(Ust) > num(Ube) && num(Ube) >= 0 && num(Ib) > 0 ? (Ust - Ube) / Ib : NAN);
  const rLed = (U, UF, I) => (num(U) > num(UF) && num(UF) >= 0 && num(I) > 0 ? (U - UF) / I : NAN);
  const pRes = (I, R) => (num(I) >= 0 && num(R) >= 0 ? I * I * R : NAN);
  const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2], E6 = [1.0, 1.5, 2.2, 3.3, 4.7, 6.8];
  function eNear(v, ser, up) {
    if (!(num(v) > 0)) return NAN;
    const dec = Math.floor(Math.log10(v) + 1e-12); let best = NAN;
    for (let d = dec - 1; d <= dec + 1; d++) for (const m of ser) {
      const x = rd(m * Math.pow(10, d), 6);
      if (up ? x >= v * (1 - 1e-9) && !(x >= best) : x <= v * (1 + 1e-9) && !(x <= best)) best = x;
    }
    return best;
  }
  const eUp = (v, ser) => eNear(v, ser || E12, true), eDown = (v, ser) => eNear(v, ser || E12, false);

  /* ============================================================ Kostenvoranschlag (Übungswerte) */
  /* PRUEFEN S4: Stundensatz 68 €/h, Materialpreise, Prüfpauschale und Mehrwertsteuer 19 % sind Übungswerte; Rechtsfragen zum Kostenvoranschlag sind nicht im Lab. */
  const MWST = 19, RATE = 68;
  function kva(items, minutes, rate, vat) {
    rate = rate == null ? RATE : rate; vat = vat == null ? MWST : vat;
    if (!Array.isArray(items) || !items.every(x => num(x.menge) >= 0 && num(x.preis) >= 0) || !(num(minutes) >= 0) || !(num(rate) >= 0) || !(num(vat) >= 0)) return null;
    const mat = rd(items.reduce((s, x) => s + x.menge * x.preis, 0), 2), lohn = rd(minutes / 60 * rate, 2), netto = rd(mat + lohn, 2), mwst = rd(netto * vat / 100, 2);
    return { mat, lohn, netto, mwst, brutto: rd(netto + mwst, 2) };
  }

  const API = { parseDe, fmtDe, fmtN, rd, num, hashStr, rng, ri, pick, shuffle,
    MODEL, BLOCKS, MPS, FAULTS, faultOf, rntc, divider, usens, peak, ucPeak, ripple, capFor, sim, measure, maxMeas,
    rpeLimit, RISO, risoLimit, IPE_MAX, IB_MAX, PRUEF_SCHRITTE, SICHT_OK, SICHT_BAD, makePruef,
    regLoss, rthK, minUin, coilI, baseI, rBase, rLed, pRes, E12, E6, eUp, eDown,
    MWST, RATE, kva };
  root.SYA_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
