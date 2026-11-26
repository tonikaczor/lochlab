'use strict';
/* Tonfunk Kleinsteuerungs-Lab: reine Rechenlogik (Kennung 'ksp'). window.KSP_CORE bzw. module.exports.
   ALLE Zahlen (Spannungen, Ströme, Zeiten, Schaltabstände, Reduktionsfaktoren) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   Themen: Relais und Schütz (Selbsthaltung, Verriegelung, Wende), Kleinsteuerung als Gerät (24 V, Ein-/Ausgänge, Netzteil),
           Funktionsplan mit Zeiten und Zähler, Elektropneumatik (Ventil, Zylinder, Endlagen), Sensoren am Eingang (PNP/NPN, Schaltabstand, Fehlersuche).
   Nicht hier (siehe spslab, pnelab): GRAFCET, Ampel, Förderband, Symbole der Pneumatik, Verschlauchen, Kraft und Luftverbrauch.
   Ungültige Eingaben (Division durch 0, fehlende Zahlen) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(ms|ma|mm|mw|kω|ω|ohm|zyklen|stück|stk|mal|min|hz|v|a|s|w|%)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtDe(v, dec, group) {
    if (!fin(v)) return '?';
    dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '?'; dec = dec == null ? 2 : dec;
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

  /* ============================================================ Relais, Schütz, Selbsthaltung */
  /* Selbsthaltung: S1 Ein (Schließer), S2 Aus (Öffner), K1 Spule mit Selbsthaltekontakt 13/14 parallel zu S1.
     Vorrang 'aus': S2 liegt vor der Parallelschaltung und unterbricht immer. Vorrang 'ein': S2 liegt nur im Zweig des Selbsthaltekontakts, S1 überbrückt ihn. */
  const shNext = (k1, s1, s2, vorrang, netz) => (netz === false ? false : vorrang === 'ein' ? !!(s1 || (!s2 && k1)) : !!(!s2 && (s1 || k1)));
  /* Wendeschaltung: S1 Rechts (K1), S3 Links (K2), S2 Aus. Verriegelung: Öffner von K2 im Strompfad von K1 und umgekehrt. Ohne Verriegelung ziehen beide an (Kurzschluss im Hauptstrom).
     Bei gleichzeitigem Druck auf S1 und S3 aus dem Stillstand gewinnt K1 (K1 zieht zuerst an und sperrt K2). */
  function wendeNext(st, s, netz, verr) {
    if (netz === false) return { k1: false, k2: false };
    const v = verr !== false;
    const k1 = !s.s2 && !!(s.s1 || st.k1) && !(v && st.k2);
    const k2 = !s.s2 && !!(s.s3 || st.k2) && !(v && k1);
    return { k1, k2 };
  }
  /* Ein Schaltvorgang mit gedrückten Tastern s = {s1,s2,s3}: wiederholen, bis die Schütze sich nicht mehr ändern */
  function shSettle(cfg, st, s) {
    let cur = { k1: !!st.k1, k2: !!st.k2 };
    for (let i = 0; i < 4; i++) {
      const n = cfg.mode === 'wende' ? wendeNext(cur, s, cfg.netz, cfg.verr) : { k1: shNext(cur.k1, s.s1, s.s2, cfg.vorrang, cfg.netz), k2: false };
      if (n.k1 === cur.k1 && n.k2 === cur.k2) break; cur = n;
    }
    return cur;
  }
  /* Folge von Tasterzuständen; Ergebnis: Zustand nach jedem Schritt */
  function shRun(cfg, steps) {
    let st = { k1: !!cfg.k1, k2: !!cfg.k2 }; const out = [];
    steps.forEach(s => { st = shSettle(cfg, st, s); out.push(st); });
    return out;
  }
  const coilMA = (u, r) => (num(u) > 0 && num(r) > 0 ? u / r * 1000 : NAN);

  /* ============================================================ Kleinsteuerung als Gerät */
  /* Eingangspegel im Übungsmodell für 24-V-Eingänge: bis 5 V gilt 0, ab 15 V gilt 1, dazwischen ist der Zustand nicht definiert (null) */
  const pegel = u => (num(u) < 0 ? NAN : u <= 5 ? 0 : u >= 15 ? 1 : null);
  const NETZTEILE = [0.5, 1, 2.5, 5, 10];
  /* kleinstes Netzteil (Nennstrom in A), das den Strom in mA mit 20 % Reserve liefert */
  const psuFor = ma => { if (!(num(ma) > 0)) return NAN; const n = NETZTEILE.find(a => a * 1000 >= ma * 1.2 - 1e-9); return n === undefined ? NAN : n; };

  /* ============================================================ Funktionsplan, Zeiten, Zähler */
  const GATES = { und: (a, b) => a && b, oder: (a, b) => a || b, nand: (a, b) => !(a && b), nor: (a, b) => !(a || b), xor: (a, b) => a !== b };
  /* Anzahl der Kombinationen von I1, I2, I3, bei denen f den Wert 1 liefert */
  function ones3(f) { let n = 0; for (let k = 0; k < 8; k++) if (f(!!(k & 1), !!(k & 2), !!(k & 4))) n++; return n; }
  /* Zähler: 'auf' zählt von 0 aufwärts, Q bei Stand >= S; 'ab' lädt S, zählt abwärts bis 0, Q bei 0 */
  function zStep(mode, S, z, reset, pulse) {
    if (reset) return mode === 'ab' ? S : 0;
    if (!pulse) return z;
    return mode === 'ab' ? Math.max(0, z - 1) : z + 1;
  }
  const zQ = (mode, S, z) => (mode === 'ab' ? z === 0 : z >= S);
  function zaehler(mode, S, seq) {
    let z = mode === 'ab' ? S : 0;
    for (const c of seq) z = zStep(mode, S, z, c === 'r', c === 'p');
    return { z, q: zQ(mode, S, z) };
  }
  /* Zeitverlauf eines Bausteins. prog: und | oder | sr | ton | tof | wisch | zaehl. par: {T (s), S, mode}.
     ev: [{t, i1, i2}] gilt ab t. Rastermaß dt = 50 ms. Liefert Arrays t, i1, i2, q, e (Ablauf der Zeit 0 bis 1), z (Zählerstand).
     sr: I1 setzt, I2 setzt zurück (Rücksetzen hat Vorrang). wisch: Impuls der Länge T bei steigender Flanke an I1, nicht nachtriggerbar.
     ton: Q nach T, wenn I1 so lange anliegt. tof: Q bleibt nach dem Abfall von I1 noch T an (neues Einschalten startet neu). zaehl: I1 zählt, I2 setzt zurück. */
  function fupTrace(prog, par, ev, tEnd, dt) {
    dt = dt || 0.05; par = par || {};
    const n = Math.round(tEnd / dt), T = par.T > 0 ? par.T : 1, mode = par.mode === 'ab' ? 'ab' : 'auf', S = par.S >= 1 ? par.S : 3;
    const evs = (ev || []).slice().sort((a, b) => a.t - b.t), o = { dt, t: [], i1: [], i2: [], q: [], e: [], z: [] };
    let ei = 0, i1 = 0, i2 = 0, q = 0, el = 0, run = 0, prev1 = 0, prev2 = 0, z = mode === 'ab' ? S : 0;
    for (let k = 0; k <= n; k++) {
      const t = Math.round(k * dt * 1000) / 1000;
      while (ei < evs.length && evs[ei].t <= t + 1e-9) { i1 = evs[ei].i1 ? 1 : 0; i2 = evs[ei].i2 ? 1 : 0; ei++; }
      const rise1 = i1 && !prev1, rise2 = i2 && !prev2, fall1 = !i1 && prev1; let e = 0;
      if (prog === 'und') q = i1 && i2 ? 1 : 0;
      else if (prog === 'oder') q = i1 || i2 ? 1 : 0;
      else if (prog === 'sr') q = !i2 && (i1 || q) ? 1 : 0;
      else if (prog === 'ton') { if (i1) { el = rise1 ? 0 : el + dt; q = el >= T - 1e-9 ? 1 : 0; } else { el = 0; q = 0; } e = i1 ? Math.min(1, el / T) : 0; }
      else if (prog === 'tof') { if (i1) { q = 1; el = 0; } else if (q) { el = fall1 ? 0 : el + dt; if (el >= T - 1e-9) { q = 0; el = 0; } } e = !i1 && q ? Math.min(1, el / T) : 0; }
      else if (prog === 'wisch') { if (rise1 && !run) { run = 1; el = 0; } q = run ? 1 : 0; e = run ? Math.min(1, el / T) : 0; if (run) { el += dt; if (el >= T - 1e-9) run = 0; } }
      else if (prog === 'zaehl') { z = zStep(mode, S, z, rise2 || (k === 0 && i2), rise1); q = zQ(mode, S, z) ? 1 : 0; }
      o.t.push(t); o.i1.push(i1); o.i2.push(i2); o.q.push(q); o.e.push(e); o.z.push(z);
      prev1 = i1; prev2 = i2;
    }
    return o;
  }
  /* Gesamtzeit in s, in der Q eingeschaltet ist */
  const onTime = tr => rd(tr.q.reduce((a, v) => a + v, 0) * tr.dt, 3);

  /* ============================================================ Elektropneumatik */
  /* Doppelt wirkender Zylinder, 5/2-Magnetventil. Y1 (Anschluss 14) fährt aus (A+), Y2 (12) fährt ein (A-).
     mono: Feder fährt ein, solange Y1 stromlos ist. bi: Ventil bleibt in der letzten Stellung (bei Y1 und Y2 gleichzeitig unverändert).
     cfg {ventil, T}: T = Hubzeit in s von hinten nach vorn. st {x: 0 hinten bis 1 vorn, lat: Stellung des bistabilen Ventils (1 = ausfahren)} */
  function epStep(cfg, st, y1, y2, dt) {
    let lat = st.lat ? 1 : 0;
    if (cfg.ventil === 'bi') { if (y1 && !y2) lat = 1; else if (y2 && !y1) lat = 0; }
    const dir = cfg.ventil === 'bi' ? lat : (y1 ? 1 : 0);
    return { x: clamp(st.x + (dir ? 1 : -1) * dt / cfg.T, 0, 1), lat, dir };
  }
  const epB1 = x => x <= 0.02;
  const epB2 = x => x >= 0.98;
  /* Ablaufsteuerung A+ A-: Start (mit B1 betätigt) -> Y1 -> B2 -> mono: Y1 aus, bi: Y2 -> B1 -> Ruhe. ph: 0 Ruhe, 1 ausfahren, 2 einfahren */
  function epAuto(cfg, ph, start, x) {
    if (ph === 0 && start && epB1(x)) ph = 1;
    else if (ph === 1 && epB2(x)) ph = 2;
    else if (ph === 2 && epB1(x)) ph = 0;
    return { ph, y1: ph === 1, y2: ph === 2 && cfg.ventil === 'bi' };
  }
  /* Spule Y1 wird nur tOn Sekunden bestromt (danach Y1 aus). Ergebnis: größte Ausfahrt in Prozent des Hubs und Stellung am Ende */
  function epPulse(cfg, tOn, x0) {
    let st = { x: x0 || 0, lat: 0 }, mx = st.x; const dt = 0.01, n = Math.round((tOn + cfg.T * 2) / dt);
    for (let k = 0; k < n; k++) { st = epStep(cfg, st, k * dt < tOn - 1e-9, false, dt); if (st.x > mx) mx = st.x; }
    return { max: rd(mx * 100, 2), end: rd(st.x * 100, 2) };
  }
  /* Steuerspannung fällt aus (Druckluft bleibt): Stellung des Kolbens nach langer Zeit in Prozent des Hubs, x0 vorher */
  function epPowerLoss(cfg, x0, lat0) {
    let st = { x: x0, lat: lat0 ? 1 : 0 }; const dt = 0.01, n = Math.round(cfg.T * 3 / dt);
    for (let k = 0; k < n; k++) st = epStep(cfg, st, false, false, dt);
    return rd(st.x * 100, 2);
  }

  /* ============================================================ Sensoren am Eingang */
  /* Übungswerte: Nenn-Schaltabstand Sn und Reduktionsfaktor je Werkstoff (reduzierter Schaltabstand Sr = Sn · Faktor) */
  const PRINZ = {
    ind: { n: 'induktiv', sn: 8, mat: { stahl: 1, alu: 0.4, kunst: 0 } },
    kap: { n: 'kapazitiv', sn: 10, mat: { stahl: 1, alu: 1, kunst: 0.5 } }
  };
  const MAT = { stahl: 'Stahl', alu: 'Aluminium', kunst: 'Kunststoff' };
  const HYST = 0.1;
  const srOf = (prinz, mat) => { const p = PRINZ[prinz]; return p && p.mat[mat] !== undefined ? rd(p.sn * p.mat[mat], 3) : NAN; };
  /* Schaltzustand mit Hysterese: schaltet bei d <= Sr ein und erst bei d >= Sr · (1 + h) wieder aus */
  function senState(prev, d, sr, h) {
    if (!(sr > 0) || !(d >= 0)) return false;
    h = h == null ? HYST : h;
    if (d <= sr) return true;
    if (d >= sr * (1 + h)) return false;
    return !!prev;
  }
  /* Dreidraht-Sensor an einem 24-V-Eingang (der Eingang erwartet +24 V für 1, Übungsmodell).
     typ pnp|npn, fkt s (Schließer) | o (Öffner), aktiv = Werkstück im Schaltabstand, fehler: keiner | braun | blau | schwarz (Ader unterbrochen).
     Spannungen gegen 0 V der Steuerung. Sensor-LED zeigt den Schaltzustand des Ausgangs. */
  function sensorSim(p) {
    const ausEin = p.fkt === 'o' ? !p.aktiv : !!p.aktiv, vers = p.fehler !== 'braun' && p.fehler !== 'blau', schaltet = vers && ausEin;
    const braun = p.fehler === 'braun' ? 0 : 24, schwarz = schaltet && p.typ === 'pnp' ? 24 : 0, eingang = p.fehler === 'schwarz' ? 0 : schwarz;
    return { led: schaltet, braun, schwarz, eingang, eingangLed: eingang >= 15, wert: pegel(eingang) };
  }
  /* Fehlerbild an einem Sensor mit Werkstück im Schaltabstand: Sensor-LED, braun gegen 0 V, schwarz am Sensor, Eingangs-LED; jede Zeile ist eindeutig */
  const SEN_FEHLER = [
    { k: 'braun', n: 'Braune Ader (+24 V) unterbrochen', p: { typ: 'pnp', fehler: 'braun' } },
    { k: 'blau', n: 'Blaue Ader (0 V) unterbrochen', p: { typ: 'pnp', fehler: 'blau' } },
    { k: 'schwarz', n: 'Schwarze Ader (Signal) unterbrochen', p: { typ: 'pnp', fehler: 'schwarz' } },
    { k: 'npn', n: 'Falscher Sensortyp (NPN an einem Eingang für PNP)', p: { typ: 'npn', fehler: 'keiner' } }
  ];
  const senBild = k => { const f = SEN_FEHLER.find(x => x.k === k); return f ? sensorSim({ typ: f.p.typ, fkt: 's', aktiv: true, fehler: f.p.fehler }) : null; };
  /* Fehlerbild an einem Ausgang, dessen Ventilspule nicht anzieht: Q-LED, Klemme Q, Lastplus, Lastminus (alle gegen 0 V der Steuerung) in V */
  const AUS_FEHLER = [
    { k: 'prog', n: 'Der Ausgang wird vom Programm nicht eingeschaltet', led: false, q: 0, lp: 0, lm: 0 },
    { k: 'plus', n: 'Die Leitung vom Ausgang zur Spule ist unterbrochen', led: true, q: 24, lp: 0, lm: 0 },
    { k: 'null', n: 'Die 0-V-Leitung der Spule ist unterbrochen', led: true, q: 24, lp: 24, lm: 24 },
    { k: 'spule', n: 'Die Spule selbst ist durchgebrannt (offen)', led: true, q: 24, lp: 24, lm: 0 }
  ];

  const API = { parseDe, fmtN, rd, num, clamp, rng, ri, pick, shuffle,
    shSettle, shRun, coilMA, pegel, psuFor,
    GATES, ones3, zaehler, fupTrace, onTime,
    epStep, epB1, epB2, epAuto, epPulse, epPowerLoss,
    PRINZ, MAT, HYST, srOf, senState, sensorSim, SEN_FEHLER, senBild, AUS_FEHLER };
  root.KSP_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
