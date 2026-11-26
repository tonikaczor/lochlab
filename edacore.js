'use strict';
/* Tonfunk Simulations- und EDA-Lab: reine Rechenlogik (Kennung 'eda'). window.EDA_CORE bzw. module.exports.
   ALLE Zahlen (Spannungen, Ströme, Bauteilwerte, Mindestmaße des Leiterplattenherstellers) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   Themen: Analysearten der Simulation, Ergebnisse lesen (LED, Transistor, Gleichrichter), Modell und Wirklichkeit, Schaltplan und ERC, Fertigungsdaten, Ablauf bis zur Freigabe.
   Nicht hier (siehe pcblab, simlab): Leiterbahnen legen, Mehrlagen, DRC beheben, Schaltungssimulator zum Aufbauen.
   Konventionen: Ströme in A, Kapazitäten in F, Widerstände in Ohm, Frequenzen in Hz, Längen auf der Platine in mm.
   Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN bzw. null, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const ceilN = x => (fin(x) ? Math.ceil(x - 1e-9) : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(volt|v|ma|a|µf|uf|nf|pf|f|khz|hz|db|mv|mw|w|mm|µm|ms|µs|ω|ohm|kω|%|°|grad|stück|stk|plätze|läufe|nutzen|positionen|pins|fehler|k)$/i, '');
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
  /* Bauteilwerte mit Vorsatz: 4700 Ω -> "4,7 kΩ", 1e-7 F -> "100 nF" */
  function fmtOhm(r) { if (!fin(r)) return '-'; return r >= 1e6 ? fmtN(r / 1e6, 2) + ' MΩ' : r >= 1e3 ? fmtN(r / 1e3, 2) + ' kΩ' : fmtN(r, 1) + ' Ω'; }
  function fmtF(c) { if (!fin(c)) return '-'; return c >= 1e-3 ? fmtN(c * 1e3, 2) + ' mF' : c >= 1e-6 ? fmtN(c * 1e6, 2) + ' µF' : c >= 1e-9 ? fmtN(c * 1e9, 2) + ' nF' : fmtN(c * 1e12, 1) + ' pF'; }
  function fmtHz(h) { if (!fin(h)) return '-'; return h >= 1e6 ? fmtN(h / 1e6, 2) + ' MHz' : h >= 1e3 ? fmtN(h / 1e3, 2) + ' kHz' : fmtN(h, 1) + ' Hz'; }

  /* ---------- Zufall (seed-fähig) ---------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ============================================================ Normreihe und LED */
  const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
  /* nächster Normwert der Reihe E12, der nicht kleiner ist als r */
  function e12Up(r) {
    if (!(num(r) > 0)) return NAN;
    const dec = Math.floor(Math.log10(r) + 1e-12), m = r / Math.pow(10, dec), v = E12.find(x => x >= m - 1e-9);
    return rd((v == null ? 10 : v) * Math.pow(10, dec), 6);
  }
  const rvLed = (ub, uf, i) => (num(ub) > num(uf) && num(uf) >= 0 && num(i) > 0 ? (ub - uf) / i : NAN);
  /* Übungs-LED (rot): Shockley-Form mit Vt = 75 mV und Is = 1e-13 A; bei 10 mA liegen rund 1,9 V an */
  const LED = { vt: 0.075, is: 1e-13 };
  const ledU = i => (num(i) > 0 ? LED.vt * Math.log(i / LED.is + 1) : 0);
  /* Arbeitspunkt: Schnitt der LED-Kennlinie mit der Widerstandsgeraden (Bisektion). Liefert {i in A, u in V}. */
  function operatingPoint(ub, r) {
    if (!(num(ub) > 0) || !(num(r) > 0)) return null;
    let lo = 0, hi = ub / r;
    for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (ub - r * mid - ledU(mid) > 0) lo = mid; else hi = mid; }
    const i = (lo + hi) / 2; return { i, u: ledU(i) };
  }

  /* ============================================================ Gleichrichter mit Glättung (Brücke, B2) */
  const UD = 0.7;
  /* Scheitelwert hinter der Brücke: zwei Dioden im Strompfad */
  const peakDC = (ueff, ud) => (num(ueff) > 0 ? ueff * Math.SQRT2 - 2 * (ud == null ? UD : ud) : NAN);
  /* Brummspannung (Spitze-Spitze), Näherung für konstanten Laststrom */
  const ripple = (i, c, f) => (num(i) >= 0 && num(c) > 0 && num(f) > 0 ? i / (f * c) : NAN);
  const cForRipple = (i, f, du) => (num(i) >= 0 && num(f) > 0 && num(du) > 0 ? i / (f * du) : NAN);
  /* Zeitverlauf (Transientenanalyse): ideale Brücke, ideale Quelle, Kondensator wird bis zum Scheitelwert geladen und mit konstantem Strom entladen.
     p = {ueff, c (F), i (A), fnet (Hz, Standard 50), tEnd (s, Standard 0,06), dt (s, Standard 50 µs)}
     liefert {t[], src[], uc[], vmax, vmin, vpp, vmean} (Messfenster: letzte 20 ms) oder null */
  function rectSim(p) {
    if (!p || !(num(p.ueff) > 0) || !(num(p.c) > 0) || !(num(p.i) >= 0)) return null;
    const fnet = p.fnet || 50, tEnd = p.tEnd || 0.06, dt = p.dt || 5e-5, n = Math.round(tEnd / dt), up = p.ueff * Math.SQRT2;
    const t = [], src = [], uc = []; let vc = 0, vmax = 0, vmin = Infinity, sum = 0, cnt = 0;
    for (let k = 0; k <= n; k++) {
      const tk = k * dt, s = Math.max(0, Math.abs(up * Math.sin(2 * Math.PI * fnet * tk)) - 2 * UD);
      vc = Math.max(0, vc - p.i * dt / p.c); if (s > vc) vc = s;
      t.push(tk); src.push(s); uc.push(vc);
      if (tk >= tEnd - 0.02 - 1e-12) { vmax = Math.max(vmax, vc); vmin = Math.min(vmin, vc); sum += vc; cnt++; }
    }
    return { t, src, uc, vmax, vmin, vpp: vmax - vmin, vmean: sum / cnt };
  }

  /* ============================================================ Frequenzgang RC-Tiefpass */
  const fgRC = (r, c) => (num(r) > 0 && num(c) > 0 ? 1 / (2 * Math.PI * r * c) : NAN);
  /* Dämpfung in dB (positiver Zahlenwert): 10 · log10(1 + (f/fg)²) */
  const attenDb = (f, fg) => (num(f) >= 0 && num(fg) > 0 ? 10 * Math.log10(1 + Math.pow(f / fg, 2)) : NAN);
  const ampRC = (f, fg) => (num(f) >= 0 && num(fg) > 0 ? 1 / Math.sqrt(1 + Math.pow(f / fg, 2)) : NAN);
  const phaseRC = (f, fg) => (num(f) >= 0 && num(fg) > 0 ? Math.atan(f / fg) * 180 / Math.PI : NAN);

  /* ============================================================ Transistor als Schalter */
  const UBE = 0.7, UCESAT = 0.2;
  const icSat = (ub, rc, uce) => (num(ub) > 0 && num(rc) > 0 ? (ub - (uce == null ? UCESAT : uce)) / rc : NAN);
  const ibNeeded = (ic, b, k) => (num(ic) > 0 && num(b) > 0 && num(k) >= 1 ? ic / b * k : NAN);
  const rbFor = (ue, ib, ube) => (num(ue) > (ube == null ? UBE : ube) && num(ib) > 0 ? (ue - (ube == null ? UBE : ube)) / ib : NAN);

  /* ============================================================ Modell und Wirklichkeit */
  const tolMax = (v, pct) => (num(v) >= 0 && num(pct) >= 0 ? v * (1 + pct / 100) : NAN);
  const tolMin = (v, pct) => (num(v) >= 0 && num(pct) >= 0 && pct <= 100 ? v * (1 - pct / 100) : NAN);
  /* Spannungsteiler Ua = Ue · R2 / (R1 + R2); größter bzw. kleinster Wert bei der Toleranz pct beider Widerstände */
  const dividerOut = (ue, r1, r2) => ue * r2 / (r1 + r2);
  const dividerMax = (ue, r1, r2, pct) => (num(ue) > 0 && num(r1) > 0 && num(r2) > 0 && num(pct) >= 0 && pct < 100 ? dividerOut(ue, tolMin(r1, pct), tolMax(r2, pct)) : NAN);
  const devPct = (meas, sim) => (num(meas) >= 0 && num(sim) > 0 ? Math.abs(meas - sim) / sim * 100 : NAN);
  /* Temperaturgang der Flussspannung einer Silizium-Diode: rund −2 mV je Kelvin; Betrag in mV */
  const UF_TK = 2;
  const ufDrift = dT => (num(dT) >= 0 ? dT * UF_TK : NAN);

  /* ============================================================ Schaltplan und ERC */
  /* Pintypen: out Ausgang, in Eingang, pwrout Versorgungsausgang (Quelle), pwrin Versorgungseingang, pas passiv */
  const PINTYPE = { out: 'Ausgang', in: 'Eingang', pwrout: 'Versorgungsausgang', pwrin: 'Versorgungseingang', pas: 'passiv' };
  /* Grundschaltung (Modellbetrieb, erfunden): Batterie J1, Regler U1, Sensor U3, Steuer-IC U2, Vorwiderstand R1, LED D1, Kondensatoren C1 und C2.
     Pins: n Nummer, name, type, side (l, r, t, b), off Lage entlang der Seite, net Netzname (null = nicht angeschlossen) */
  function baseSchematic() {
    const P = (n, name, type, side, off, net) => ({ n, name, type, side, off, net });
    const sch = { comps: [
      { ref: 'J1', val: 'Batterie 9 V', fp: 'Batterieclip', x: 14, y: 40, w: 44, h: 56, pins: [P('1', '+', 'pwrout', 't', 22, '+9V'), P('2', '−', 'pwrout', 'b', 22, 'GND')] },
      { ref: 'C2', val: '100 µF', fp: 'Elko 5 mm', x: 80, y: 44, w: 34, h: 48, pins: [P('1', '+', 'pas', 't', 17, '+9V'), P('2', '−', 'pas', 'b', 17, 'GND')] },
      { ref: 'U1', val: 'Regler 5 V', fp: 'TO-220', x: 156, y: 40, w: 74, h: 56, pins: [P('1', 'IN', 'pwrin', 'l', 18, '+9V'), P('3', 'OUT', 'pwrout', 'r', 18, '+5V'), P('2', 'GND', 'pwrin', 'b', 37, 'GND')] },
      { ref: 'C1', val: '100 nF', fp: 'C 0805', x: 284, y: 44, w: 34, h: 48, pins: [P('1', '+', 'pas', 't', 17, '+5V'), P('2', '−', 'pas', 'b', 17, 'GND')] },
      { ref: 'U3', val: 'Sensor 1', fp: 'SOT-23', x: 14, y: 176, w: 80, h: 62, pins: [P('1', 'VCC', 'pwrin', 't', 40, '+5V'), P('2', 'GND', 'pwrin', 'b', 40, 'GND'), P('3', 'OUT', 'out', 'r', 30, 'SENS')] },
      { ref: 'U2', val: 'Steuer-IC', fp: 'SOIC-8', x: 180, y: 176, w: 76, h: 62, pins: [P('1', 'VCC', 'pwrin', 't', 38, '+5V'), P('2', 'GND', 'pwrin', 'b', 38, 'GND'), P('3', 'IN', 'in', 'l', 30, 'SENS'), P('4', 'OUT', 'out', 'r', 30, 'LED_A')] },
      { ref: 'R1', val: '330 Ω', fp: 'R 0805', x: 278, y: 188, w: 40, h: 22, pins: [P('1', '1', 'pas', 'l', 11, 'LED_A'), P('2', '2', 'pas', 'r', 11, 'N_LED')] },
      { ref: 'D1', val: 'LED rot', fp: 'LED 3 mm', x: 350, y: 176, w: 40, h: 60, pins: [P('1', 'A', 'pas', 'l', 12, 'N_LED'), P('2', 'K', 'pas', 'b', 22, 'GND')] }
    ] };
    sch.comps.forEach(c => { c.id = c.ref; });
    return sch;
  }
  const pinList = sch => { const o = []; sch.comps.forEach(c => c.pins.forEach(p => o.push({ c, p }))); return o; };
  /* Netze: Name -> Liste der Pins ({c, p}) */
  function nets(sch) {
    const m = {}; pinList(sch).forEach(e => { if (e.p.net != null) (m[e.p.net] = m[e.p.net] || []).push(e); });
    return m;
  }
  const pinName = e => e.c.ref + '.' + e.p.name;
  /* Elektrische Regelprüfung. Liefert Meldungen {code, level ('Fehler'|'Warnung'), text, ref, net, pin} in fester Reihenfolge */
  function ercCheck(sch) {
    if (!sch || !Array.isArray(sch.comps)) return [];
    const out = [], N = nets(sch), seen = {};
    sch.comps.forEach(c => {
      if (seen[c.ref] != null && seen[c.ref] !== 'x') { out.push({ code: 'doppelt', level: 'Fehler', ref: c.ref, cid: c.id, text: 'Die Referenz ' + c.ref + ' ist doppelt vergeben (' + seen[c.ref] + ' und ' + c.val + ').' }); seen[c.ref] = 'x'; } else if (seen[c.ref] == null) seen[c.ref] = c.val;
      c.pins.forEach(p => { if (p.net == null) out.push({ code: 'offen', level: 'Fehler', ref: c.ref, cid: c.id, pin: p.name, text: 'Pin ' + c.ref + '.' + p.name + ' ist nicht angeschlossen.' }); });
    });
    Object.keys(N).forEach(name => {
      const L = N[name], drv = L.filter(e => e.p.type === 'out' || e.p.type === 'pwrout');
      if (drv.length >= 2) out.push({ code: 'zweiAus', level: 'Fehler', net: name, text: 'Zwei Ausgänge sind verbunden: ' + drv.map(pinName).join(' und ') + ' (Netz ' + name + ').' });
      L.filter(e => e.p.type === 'pwrin').forEach(e => { if (!L.some(x => x.p.type === 'pwrout')) out.push({ code: 'versorgung', level: 'Fehler', net: name, ref: e.c.ref, cid: e.c.id, pin: e.p.name, text: 'Der Versorgungspin ' + pinName(e) + ' wird von keiner Quelle gespeist (Netz ' + name + ').' }); });
      L.filter(e => e.p.type === 'in').forEach(e => { if (!drv.length) out.push({ code: 'ohneTreiber', level: 'Fehler', net: name, ref: e.c.ref, cid: e.c.id, pin: e.p.name, text: 'Der Eingang ' + pinName(e) + ' hat keinen Treiber (Netz ' + name + ').' }); });
      if (L.length === 1) out.push({ code: 'einzel', level: 'Warnung', net: name, ref: L[0].c.ref, cid: L[0].c.id, pin: L[0].p.name, text: 'Das Netz ' + name + ' hat nur einen Anschluss (' + pinName(L[0]) + ').' });
    });
    sch.comps.forEach(c => { if (!c.fp) out.push({ code: 'fp', level: 'Warnung', ref: c.ref, cid: c.id, text: 'Für ' + c.ref + ' ist kein Footprint zugewiesen.' }); });
    return out;
  }
  /* Ursachen, aus denen ein Fall gebaut wird; jede Meldung gehört zu genau einer Ursache */
  const CAUSES = [
    { k: 'offen', n: 'Pin nicht angeschlossen', fix: 'Den Pin mit dem passenden Netz verbinden oder, wenn er wirklich frei bleibt, als „nicht angeschlossen“ markieren.' },
    { k: 'zweiAus', n: 'Zwei Ausgänge auf einem Netz', fix: 'Eine der beiden Quellen abtrennen. Zwei Ausgänge dürfen nicht gegeneinander arbeiten.' },
    { k: 'tippfehler', n: 'Netzname falsch geschrieben', fix: 'Den Netznamen an allen Pins gleich schreiben. Ein Tippfehler trennt das Netz in zwei Teile.' },
    { k: 'doppelt', n: 'Referenz doppelt vergeben', fix: 'Die Bauteile neu durchnummerieren (Annotation), jede Referenz nur einmal.' },
    { k: 'fp', n: 'Footprint fehlt', fix: 'Dem Bauteil ein Gehäuse mit passendem Footprint zuordnen.' }
  ];
  const causeOf = m => (m.code === 'versorgung' || m.code === 'ohneTreiber' || m.code === 'einzel' ? 'tippfehler' : m.code);
  /* zweiter Sensor, kommt nur im Fall „zwei Ausgänge“ dazu: sein Ausgang liegt ebenfalls auf dem Netz SENS */
  const U4 = () => ({ id: 'U4', ref: 'U4', val: 'Sensor 2', fp: 'SOT-23', x: 338, y: 40, w: 62, h: 56, pins: [{ n: '1', name: 'VCC', type: 'pwrin', side: 't', off: 31, net: '+5V' }, { n: '2', name: 'GND', type: 'pwrin', side: 'r', off: 28, net: 'GND' }, { n: '3', name: 'OUT', type: 'out', side: 'b', off: 31, net: 'SENS' }] });
  /* Fall aus Seed: drei von fünf Ursachen werden eingebaut. Liefert {seed, sch, causes[k], msgs, hit}; hit = Ort (Bauteil-id, Pin) je Ursache */
  function makeCase(seed) {
    const R = rng('eda-erc-' + seed), sch = baseSchematic(), causes = shuffle(R, CAUSES.map(x => x.k)).slice(0, 3), hit = {};
    const comp = r => sch.comps.find(c => c.id === r), pin = (r, n) => comp(r).pins.find(p => p.name === n);
    causes.forEach(k => {
      if (k === 'offen') { const t = pick(R, [['U3', 'GND'], ['U2', 'GND'], ['U1', 'GND']]); pin(t[0], t[1]).net = null; hit.offen = { id: t[0], pin: t[1] }; }
      else if (k === 'zweiAus') { sch.comps.push(U4()); hit.zweiAus = { id: 'U4', pin: 'OUT' }; }
      else if (k === 'tippfehler') { const t = pick(R, [['U1', 'IN', '+9V', '+9'], ['U2', 'IN', 'SENS', 'SENS1']]); pin(t[0], t[1]).net = t[3]; hit.tippfehler = { id: t[0], pin: t[1] }; }
      else if (k === 'doppelt') { comp('C2').ref = 'C1'; hit.doppelt = { id: 'C2' }; }
      else if (k === 'fp') { const r = pick(R, ['R1', 'D1', 'U2']); comp(r).fp = ''; hit.fp = { id: r }; }
    });
    return { seed: String(seed), sch, causes, msgs: ercCheck(sch), hit };
  }

  /* ============================================================ Fertigungsdaten */
  const LAYERS = [
    { k: 'cuTop', n: 'Kupfer oben', ext: '.gtl', info: 'Leiterbahnen, Pads und Flächen auf der Bestückungsseite.' },
    { k: 'cuBot', n: 'Kupfer unten', ext: '.gbl', info: 'Leiterbahnen, Pads und Flächen auf der Rückseite.' },
    { k: 'mask', n: 'Lötstoppmaske', ext: '.gts', info: 'Zeigt die Öffnungen im Lack: Nur dort liegt das Kupfer blank und kann gelötet werden.' },
    { k: 'silk', n: 'Bestückungsdruck', ext: '.gto', info: 'Bauteilumrisse, Referenzen und Polaritätsmarken für Bestückung und Reparatur.' },
    { k: 'paste', n: 'Pastenlage', ext: '.gtp', info: 'Öffnungen für die Schablone: Hier wird Lötpaste auf die SMD-Pads gedruckt.' },
    { k: 'edge', n: 'Platinenkontur', ext: '.gko', info: 'Der Umriss der Platine, entlang dem sie ausgefräst oder geritzt wird.' },
    { k: 'drill', n: 'Bohrdatei', ext: '.drl', info: 'Lage und Durchmesser aller Bohrungen, getrennt nach durchkontaktiert und nicht durchkontaktiert.' }
  ];
  /* Mindestwerte des (erfundenen) Leiterplattenherstellers in mm, Übungswerte */
  const DFM_MIN = { track: 0.15, gap: 0.15, drill: 0.3, ring: 0.15 };
  const DFM_NAMES = { track: 'Leiterbahnbreite', gap: 'Abstand zwischen Kupferflächen', drill: 'Bohrdurchmesser', ring: 'Restring' };
  const ringOf = (pad, drill) => (num(pad) > 0 && num(drill) > 0 && pad > drill ? (pad - drill) / 2 : NAN);
  const drillFor = (lead, add) => (num(lead) > 0 && num(add) >= 0 ? lead + add : NAN);
  /* p = {track, gap, drill, pad}; Ergebnis: Liste {k, n, val, min, ok} */
  function dfmCheck(p) {
    if (!p || !(num(p.track) > 0) || !(num(p.gap) > 0) || !(num(p.drill) > 0) || !(num(p.pad) > 0)) return null;
    const ring = ringOf(p.pad, p.drill), vals = { track: p.track, gap: p.gap, drill: p.drill, ring: fin(ring) ? ring : 0 };
    return Object.keys(DFM_MIN).map(k => ({ k, n: DFM_NAMES[k], val: vals[k], min: DFM_MIN[k], ok: vals[k] >= DFM_MIN[k] - 1e-9 }));
  }
  /* Stückliste: gleiche Werte und Gehäuse werden zu einer Position zusammengefasst */
  function bomGroup(items) {
    if (!Array.isArray(items) || !items.length) return null;
    const g = {}; items.forEach(it => { const k = it.val + '|' + it.fp; (g[k] = g[k] || { val: it.val, fp: it.fp, refs: [] }).refs.push(it.ref); });
    const rows = Object.keys(g).map(k => ({ val: g[k].val, fp: g[k].fp, qty: g[k].refs.length, refs: g[k].refs }));
    return { rows, positions: rows.length, total: items.length };
  }
  const panelCount = (need, per) => (num(need) > 0 && num(per) > 0 ? ceilN(need / per) : NAN);
  const ABLAUF = ['Anforderung klären', 'Schaltplan zeichnen', 'ERC durchführen und Fehler beheben', 'Bauteile den Footprints zuordnen', 'Layout entwerfen', 'DRC durchführen und Fehler beheben', 'Fertigungsdaten erzeugen', 'Daten im Viewer prüfen (DFM)', 'Freigabe und Bestellung', 'Revision festhalten'];

  const API = { parseDe, fmtN, fmtOhm, fmtF, fmtHz, rd, num, rng, ri, pick, shuffle,
    E12, e12Up, rvLed, LED, ledU, operatingPoint,
    peakDC, ripple, cForRipple, rectSim,
    fgRC, attenDb, ampRC, phaseRC,
    UBE, icSat, ibNeeded, rbFor,
    tolMax, tolMin, dividerMax, devPct, ufDrift,
    PINTYPE, baseSchematic, nets, ercCheck, CAUSES, causeOf, makeCase,
    LAYERS, DFM_MIN, DFM_NAMES, ringOf, drillFor, dfmCheck, bomGroup, panelCount, ABLAUF };
  root.EDA_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
