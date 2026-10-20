/* Tonfunk Datenblatt-Lab: Uebungsdatenblaetter Halbleiter (8 Stueck)
   window.DS_LIB (Registry), Node: globalThis + module.exports.
   Alle Datenblaetter sind EIGENE Uebungsdatenblaetter (Hersteller "Tonfunk Uebung (fiktiv)"),
   Werte angelehnt an typische Bauteile. Kennlinien werden beim Laden aus kleinen
   Bauteilmodellen berechnet (Konsistenz mit den Tabellen), danach liegen sie als feste Messpunkte vor. */
(function () {
  'use strict';
  var _G = (typeof window !== 'undefined') ? window : globalThis;
  _G.DS_LIB = _G.DS_LIB || { list: [], byId: {}, add: function (ds) { if (this.byId[ds.id]) return; this.byId[ds.id] = ds; this.list.push(ds); } };
  var LIB = _G.DS_LIB;

  var MFR = 'Tonfunk Übung (fiktiv)';
  var NOTE_DE = 'Übungsdatenblatt, Werte angelehnt an typische Bauteile; maßgeblich sind immer die Datenblätter des Herstellers';
  var NOTE_EN = 'Exercise datasheet, values based on typical devices; the manufacturer\'s datasheets are always authoritative.';

  /* ---------- Hilfsfunktionen ---------- */
  function sg(v, n) { return Number(Number(v).toPrecision(n || 4)); }
  function mk(xs, fy, nx, ny) { return xs.map(function (x) { return [sg(x, nx || 4), sg(fy(x), ny || 4)]; }); }
  function ilog(pts, x) { // log-x, linear-y Interpolation (Punkte aufsteigend), geklemmt
    if (x <= pts[0][0]) return pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        var a = pts[i - 1], b = pts[i];
        var f = (Math.log(x) - Math.log(a[0])) / (Math.log(b[0]) - Math.log(a[0]));
        return a[1] + f * (b[1] - a[1]);
      }
    }
    return pts[pts.length - 1][1];
  }
  function diodeVF(i, T, p) { // Shockley + Bahnwiderstand, Temperaturgang linear
    var nVt = p.n * 8.617e-5 * 298.15;
    return nVt * Math.log(i / p.is + 1) + i * p.rs - p.tc * (T - 25);
  }
  // MOSFET-Modell: Sperrschicht (Level-1 mit Mobilitaetsabnahme) plus Bahnwiderstand rc am Drain
  function mosSat(p, vov) {
    if (vov <= 0.1) { var i1 = 0.5 * p.K * 0.01 / (1 + p.th * 0.1); return i1 * Math.exp((vov - 0.1) / 0.08); }
    return 0.5 * p.K * vov * vov / (1 + p.th * vov);
  }
  function mosF(p, vov, vds) {
    if (vds <= 0) return 0;
    if (vov <= 0.1) return mosSat(p, vov) * (1 - Math.exp(-vds / 0.0259));
    if (vds < vov) return p.K * (vov * vds - vds * vds / 2) / (1 + p.th * vov);
    return mosSat(p, vov) * (1 + p.lam * (vds - vov));
  }
  function mosId(p, vgs, vds, vth) {
    var vov = vgs - vth, lo = 0, hi = 5000, i;
    for (i = 0; i < 80; i++) {
      var m = (lo + hi) / 2;
      var g = m - mosF(p, vov, vds - m * p.rc);
      if (g > 0) hi = m; else lo = m;
    }
    return (lo + hi) / 2;
  }
  function mosRds(p, vgs, vth) { var vov = vgs - vth; return p.rc + (1 + p.th * vov) / (p.K * vov); }

  /* ---------- Fachenglisch-Pool (Glossar) ---------- */
  var T = {
    amr: { en: 'absolute maximum ratings', de: 'absolute Grenzwerte (Höchstwerte)', note: 'Beschädigungsgrenze, kein Betriebswert; keine Reserve einplanen' },
    roc: { en: 'recommended operating conditions', de: 'empfohlene Betriebsbedingungen', note: 'Bereich, in dem die Tabellenwerte gelten' },
    ec: { en: 'electrical characteristics', de: 'elektrische Kenndaten', note: 'Tabelle mit Min, Typ, Max und Testbedingungen' },
    tc_cond: { en: 'test conditions', de: 'Testbedingungen (Messbedingungen)', note: 'Ohne sie ist ein Tabellenwert wertlos' },
    typ: { en: 'typical (typ)', de: 'typisch', note: 'Mittelwert, nicht garantiert' },
    vf: { en: 'forward voltage', de: 'Durchlassspannung', note: 'Spannung in Flussrichtung bei einem bestimmten Strom' },
    vr: { en: 'reverse voltage', de: 'Sperrspannung', note: 'Spannung in Sperrrichtung' },
    ir: { en: 'reverse leakage current', de: 'Sperrstrom (Leckstrom)', note: 'steigt stark mit der Temperatur' },
    vbr: { en: 'breakdown voltage', de: 'Durchbruchspannung', note: 'oberhalb davon steigt der Sperrstrom steil an' },
    trr: { en: 'reverse recovery time', de: 'Sperrverzugszeit', note: 'Zeit, bis die Diode nach dem Umschalten sperrt' },
    cj: { en: 'junction capacitance', de: 'Sperrschichtkapazität', note: 'sinkt mit steigender Sperrspannung' },
    surge: { en: 'non-repetitive peak forward surge current', de: 'einmaliger Stoßstrom in Durchlassrichtung', note: 'zum Beispiel beim Einschalten eines Netzteils' },
    avg: { en: 'average forward current', de: 'mittlerer Durchlassstrom', note: 'Mittelwert über eine Periode' },
    ptot: { en: 'total power dissipation', de: 'Gesamtverlustleistung', note: 'gilt nur bei der angegebenen Temperatur' },
    tj: { en: 'junction temperature', de: 'Sperrschichttemperatur', note: 'Temperatur im Chip, nicht die Umgebung' },
    tstg: { en: 'storage temperature', de: 'Lagertemperatur', note: 'ohne Betrieb' },
    rthja: { en: 'thermal resistance, junction to ambient', de: 'Wärmewiderstand Sperrschicht–Umgebung', note: 'Einheit K/W; Tj = Tamb + P · RthJA' },
    rthjc: { en: 'thermal resistance, junction to case', de: 'Wärmewiderstand Sperrschicht–Gehäuse', note: 'wichtig bei Kühlkörpermontage' },
    derating: { en: 'derating', de: 'Belastbarkeit herabsetzen bei höherer Temperatur', note: 'Kurve: erlaubter Strom/Leistung über Temperatur' },
    heatsink: { en: 'heat sink', de: 'Kühlkörper', note: 'senkt den Wärmewiderstand zur Umgebung' },
    lead: { en: 'lead', de: 'Anschlussdraht (Anschlussbein)', note: 'Länge und Abstand zur Platine beeinflussen die Kühlung' },
    tcoef: { en: 'temperature coefficient', de: 'Temperaturkoeffizient', note: 'Änderung pro Kelvin, zum Beispiel mV/K' },
    zz: { en: 'dynamic (Zener) impedance', de: 'dynamischer Widerstand (Z-Widerstand)', note: 'ΔVZ/ΔIZ, kleiner Wert = stabile Spannung' },
    knee: { en: 'knee current', de: 'Knickstrom', note: 'unterhalb davon wird die Zener-Kennlinie weich' },
    izm: { en: 'maximum Zener current', de: 'maximaler Z-Strom', note: 'folgt aus Ptot / VZ' },
    lum: { en: 'luminous intensity', de: 'Lichtstärke', note: 'Einheit mcd (Millicandela)' },
    dwl: { en: 'dominant wavelength', de: 'dominante Wellenlänge', note: 'bestimmt den Farbeindruck' },
    angle: { en: 'viewing angle', de: 'Abstrahlwinkel (Halbwertswinkel)', note: 'Winkel, bei dem die Lichtstärke auf 50 % fällt' },
    pulsed: { en: 'pulsed current', de: 'Impulsstrom', note: 'nur für kurze Impulse mit kleinem Tastverhältnis' },
    duty: { en: 'duty cycle', de: 'Tastverhältnis', note: 'Anteil der Einschaltzeit an der Periode' },
    hfe: { en: 'DC current gain', de: 'Gleichstromverstärkung (hFE)', note: 'IC / IB, streut stark: Gruppe und Strom beachten' },
    vcesat: { en: 'collector-emitter saturation voltage', de: 'Kollektor-Emitter-Sättigungsspannung', note: 'Restspannung am durchgeschalteten Transistor' },
    vbe: { en: 'base-emitter voltage', de: 'Basis-Emitter-Spannung', note: 'etwa 0,6 V bis 0,8 V, sinkt mit der Temperatur' },
    ft: { en: 'transition frequency', de: 'Transitfrequenz', note: 'Frequenz, bei der die Stromverstärkung auf 1 fällt' },
    vceo: { en: 'collector-emitter voltage, base open', de: 'Kollektor-Emitter-Spannung bei offener Basis', note: 'VCEO' },
    icbo: { en: 'collector cut-off current', de: 'Kollektor-Reststrom', note: 'Sperrstrom Kollektor–Basis, Emitter offen' },
    nf: { en: 'noise figure', de: 'Rauschzahl', note: 'in dB, kleiner ist besser' },
    soa: { en: 'safe operating area (SOA)', de: 'sicherer Arbeitsbereich', note: 'zulässige Kombinationen von Strom und Spannung' },
    cutoff: { en: 'cut-off', de: 'Sperrbereich', note: 'Transistor leitet praktisch nicht' },
    rds: { en: 'drain-source on-state resistance', de: 'Drain-Source-Durchlasswiderstand', note: 'RDS(on), steigt mit der Temperatur' },
    vth: { en: 'gate threshold voltage', de: 'Gate-Schwellenspannung', note: 'Spannung, bei der ein kleiner Drainstrom fließt (Testbedingung beachten)' },
    gfs: { en: 'forward transconductance', de: 'Steilheit (Vorwärtssteilheit)', note: 'gfs = ΔID/ΔVGS' },
    ciss: { en: 'input capacitance', de: 'Eingangskapazität', note: 'Ciss = CGS + CGD, bestimmt den Gate-Treiberstrom' },
    qg: { en: 'total gate charge', de: 'Gesamt-Gateladung', note: 'Qg, Einheit nC; Treiberstrom = Qg / Schaltzeit' },
    ton: { en: 'turn-on delay time', de: 'Einschaltverzögerungszeit', note: 'td(on)' },
    bodydiode: { en: 'body diode', de: 'Body-Diode (Inversdiode)', note: 'parasitäre Diode zwischen Source und Drain' },
    gatedrive: { en: 'gate drive', de: 'Gate-Ansteuerung', note: 'Treiberspannung und -strom am Gate' },
    logiclevel: { en: 'logic level', de: 'Logikpegel-tauglich', note: 'schaltet voll durch bei 4,5 V oder 5 V am Gate' },
    idss: { en: 'zero gate voltage drain current', de: 'Drain-Reststrom bei Gate-Spannung null', note: 'IDSS' },
    pkg: { en: 'package', de: 'Gehäuse', note: 'Bauform, zum Beispiel TO-92' },
    pin: { en: 'pin assignment', de: 'Pinbelegung', note: 'Anschlüsse in der Draufsicht oder Unterseite beachten' },
    freewheel: { en: 'freewheeling diode (flyback diode)', de: 'Freilaufdiode', note: 'schützt den Schalter beim Abschalten einer Spule' },
    rectifier: { en: 'rectifier', de: 'Gleichrichter', note: 'wandelt Wechselspannung in pulsierende Gleichspannung' },
    peakrev: { en: 'repetitive peak reverse voltage', de: 'periodische Spitzensperrspannung', note: 'VRRM' },
    rms: { en: 'RMS reverse voltage', de: 'Effektivwert der Sperrspannung', note: 'für den Netztrafo-Eingang maßgeblich' },
    anode: { en: 'anode / cathode', de: 'Anode / Kathode', note: 'Ring am Gehäuse markiert die Kathode' },
    sw: { en: 'switching diode', de: 'Schaltdiode', note: 'schnelle Diode für Signale' },
    fwd: { en: 'forward current', de: 'Durchlassstrom', note: 'Strom in Flussrichtung' },
    seat: { en: 'seating plane', de: 'Auflageebene', note: 'Bezugsebene für die Maße am Gehäuse' }
  };
  function G(keys) { return keys.map(function (k) { return { en: T[k].en, de: T[k].de, note: T[k].note }; }); }
  function dim(label, min, max, unit, desc) { var d = { label: label, min: min, max: max, unit: unit || 'mm' }; if (desc) d.desc = desc; return d; }

  /* ========================================================================
     1) TF-1N4148  Signaldiode
     ======================================================================== */
  (function () {
    var P = { is: 4e-9, n: 1.9, rs: 1.2, tc: 2.1e-3 };
    var ifs = [1e-5, 3e-5, 1e-4, 3e-4, 1e-3, 3e-3, 1e-2, 3e-2, 0.1, 0.2, 0.3];
    function ser(T) { return ifs.map(function (i) { return [sg(diodeVF(i, T, P), 4), i]; }); }
    var irt = [25, 40, 55, 70, 85, 100, 115, 130, 145, 150];
    LIB.add({
      id: 'tf-1n4148', part: 'TF-1N4148', family: 'Diode', mfr: MFR, lang: 'en', ref: '1N4148',
      title: 'High-speed switching diode',
      desc: 'Small silicon diode in a glass axial package for fast switching of signals. Low capacitance and a reverse recovery time of a few nanoseconds make it suitable for logic clamping, small rectifiers and protection circuits.',
      notes: NOTE_DE, notesEn: NOTE_EN,
      features: ['Repetitive peak reverse voltage up to 100 V', 'Forward current up to 200 mA continuous', 'Reverse recovery time typically 3 ns', 'Low junction capacitance, typically 2 pF', 'Glass axial package DO-35, surface-mount version available'],
      pins: { pkg: 'DO-35', pins: [
        { n: 1, name: 'K', type: 'io', desc: 'Cathode (end with the colour band)' },
        { n: 2, name: 'A', type: 'io', desc: 'Anode' }] },
      abs: [
        { key: 'vrrm', param: 'Repetitive peak reverse voltage', sym: 'VRRM', cond: '', min: null, max: 100, unit: 'V', note: '' },
        { key: 'vr', param: 'Continuous reverse voltage', sym: 'VR', cond: '', min: null, max: 75, unit: 'V', note: '' },
        { key: 'if', param: 'Continuous forward current', sym: 'IF', cond: 'Tamb = 25 °C, leads 10 mm', min: null, max: 200, unit: 'mA', note: '' },
        { key: 'ifrm', param: 'Repetitive peak forward current', sym: 'IFRM', cond: 'tp ≤ 1 ms, duty cycle ≤ 0.1', min: null, max: 450, unit: 'mA', note: '' },
        { key: 'ifsm1us', param: 'Non-repetitive peak forward surge current', sym: 'IFSM', cond: 'tp = 1 µs', min: null, max: 4, unit: 'A', note: 'single pulse' },
        { key: 'ifsm1s', param: 'Non-repetitive peak forward surge current', sym: 'IFSM', cond: 'tp = 1 s', min: null, max: 1, unit: 'A', note: 'single pulse' },
        { key: 'ptot', param: 'Total power dissipation', sym: 'Ptot', cond: 'Tamb = 25 °C, leads 10 mm', min: null, max: 500, unit: 'mW', note: 'derate above 25 °C, see thermal data' },
        { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: null, max: 175, unit: '°C', note: '' },
        { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -65, max: 175, unit: '°C', note: '' }],
      rec: [
        { key: 'vr', param: 'Reverse voltage', sym: 'VR', min: 0, max: 75, unit: 'V' },
        { key: 'if', param: 'Forward current', sym: 'IF', min: 0, max: 150, unit: 'mA' },
        { key: 'tamb', param: 'Operating ambient temperature', sym: 'Tamb', min: -40, max: 125, unit: '°C' },
        { key: 'ptot', param: 'Power dissipation', sym: 'Ptot', min: 0, max: 350, unit: 'mW' }],
      elec: [
        { key: 'vf1', param: 'Forward voltage', sym: 'VF', cond: 'IF = 1 mA', min: 0.50, typ: 0.61, max: 0.72, unit: 'V', tj: 25 },
        { key: 'vf10', param: 'Forward voltage', sym: 'VF', cond: 'IF = 10 mA', min: 0.60, typ: 0.74, max: 1.00, unit: 'V', tj: 25 },
        { key: 'vf100', param: 'Forward voltage', sym: 'VF', cond: 'IF = 100 mA', min: 0.80, typ: 0.96, max: 1.25, unit: 'V', tj: 25 },
        { key: 'vbr', param: 'Reverse breakdown voltage', sym: 'V(BR)R', cond: 'IR = 100 µA', min: 100, typ: 130, max: null, unit: 'V', tj: 25 },
        { key: 'ir20', param: 'Reverse current', sym: 'IR', cond: 'VR = 20 V', min: null, typ: 5, max: 25, unit: 'nA', tj: 25 },
        { key: 'ir75', param: 'Reverse current', sym: 'IR', cond: 'VR = 75 V', min: null, typ: 40, max: 1000, unit: 'nA', tj: 25 },
        { key: 'ir20hot', param: 'Reverse current', sym: 'IR', cond: 'VR = 20 V', min: null, typ: 2, max: 50, unit: 'µA', tj: 150 },
        { key: 'cd', param: 'Diode capacitance', sym: 'Cd', cond: 'VR = 0 V, f = 1 MHz', min: null, typ: 2.0, max: 4.0, unit: 'pF', tj: 25 },
        { key: 'trr', param: 'Reverse recovery time', sym: 'trr', cond: 'IF = IR = 10 mA, Irr = 1 mA, RL = 100 Ω', min: null, typ: 3, max: 4, unit: 'ns', tj: 25 }],
      graphs: [
        { id: 'if_vf', title: 'Forward current vs. forward voltage', xLabel: 'Forward voltage', xUnit: 'V', xScale: 'lin', yLabel: 'Forward current', yUnit: 'A', yScale: 'log',
          series: [
            { name: 'Tj = −40 °C', cond: 'typical values', points: ser(-40) },
            { name: 'Tj = 25 °C', cond: 'typical values', points: ser(25) },
            { name: 'Tj = 100 °C', cond: 'typical values', points: ser(100) }],
          note: 'Typical values. The forward voltage falls by about 2 mV per kelvin at constant current.' },
        { id: 'ir_tj', title: 'Reverse current vs. junction temperature', xLabel: 'Junction temperature', xUnit: '°C', xScale: 'lin', yLabel: 'Reverse current', yUnit: 'A', yScale: 'log',
          series: [{ name: 'VR = 20 V', cond: 'typical values', points: mk(irt, function (t) { return 5e-9 * Math.pow(2, (t - 25) / 14.5); }, 4, 3) }],
          note: 'The leakage current roughly doubles every 15 K.' },
        { id: 'cd_vr', title: 'Diode capacitance vs. reverse voltage', xLabel: 'Reverse voltage', xUnit: 'V', xScale: 'lin', yLabel: 'Diode capacitance', yUnit: 'pF', yScale: 'lin',
          series: [{ name: 'f = 1 MHz', cond: 'Tj = 25 °C, typical values', points: mk([0, 0.5, 1, 2, 5, 10, 20, 50, 75], function (v) { return 2 / Math.pow(1 + v / 0.7, 0.2); }, 4, 3) }],
          note: '' }],
      thermal: { rthJA: 300, tjMax: 175, ptotMax: 0.5, note: 'Valid for leads 10 mm long, soldered to a PCB. Ptot = (Tjmax − Tamb) / RthJA; at Tamb = 25 °C: (175 − 25) K / 300 K/W = 0.5 W. Above 25 °C the permitted dissipation falls by 3.3 mW per kelvin.' },
      pkgDraw: { name: 'DO-35 (glass axial)', kind: 'do35', dims: [
        dim('A', 3.04, 5.08, 'mm', 'body length'), dim('B', 1.53, 2.28, 'mm', 'body diameter'),
        dim('C', 0.46, 0.56, 'mm', 'lead diameter'), dim('D', 25.4, null, 'mm', 'lead length (min)')] },
      app: [
        { title: 'Flyback diode across a relay coil', text: 'When the switching transistor turns off, the coil current keeps flowing and the coil voltage reverses. A diode across the coil, cathode to the positive supply, clamps this spike to about VF above the supply and protects the transistor. The diode must carry the coil current at turn-off and block the supply voltage.',
          circuit: ['+12 V ──┬──────────┐', '        │          │', '      [Relay]    ─▲─ D1 (cathode to +12 V)', '       coil       │', '        │          │', '        └────┬─────┘', '             │ collector', '       RB ──[B]  NPN', '             │ emitter', '            GND'],
          formulas: ['IF(D1) ≥ ILOAD (coil current at turn-off)', 'VR(D1) ≥ VSUPPLY, here VRRM = 100 V ≫ 12 V', 'Voltage spike at the collector = VSUPPLY + VF ≈ 12 V + 0.9 V'] },
        { title: 'Signal clamp to the supply rails', text: 'Two diodes from the signal line to the supply rails limit overshoot at a logic input to about 0.7 V beyond the rails. Keep the series resistor large enough that the clamp current stays well below IF.',
          circuit: ['VCC ──┬── (cathode)', '       ▲ D1', '       │', 'IN ───┴──── to logic input', '       │', '       ▲ D2 (anode to GND)', '      GND'],
          formulas: ['I(clamp) = (Vin − VCC − VF) / RS', 'RS ≥ (Vin,max − VCC − 0.7 V) / 20 mA'] }],
      order: [
        { type: 'TF-1N4148', pkg: 'DO-35', note: 'axial leads, bulk' },
        { type: 'TF-1N4148-T', pkg: 'DO-35', note: 'axial leads, on tape' },
        { type: 'TF-1N4148W', pkg: 'SOD-123', note: 'surface-mount variant (note: data differs slightly, e.g. Ptot lower)' }],
      glossary: G(['amr', 'roc', 'ec', 'tc_cond', 'vf', 'vr', 'ir', 'vbr', 'trr', 'cj', 'surge', 'ptot', 'tj', 'rthja', 'derating', 'sw', 'anode', 'lead', 'pkg', 'tstg'])
    });
  })();

  /* ========================================================================
     2) TF-1N4007  Gleichrichterdiode 1 A / 1000 V
     ======================================================================== */
  (function () {
    var P = { is: 2.8e-8, n: 2.0, rs: 0.03, tc: 2.0e-3 };
    var ifs = [1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2, 0.5, 1, 2, 3];
    function ser(T) { return ifs.map(function (i) { return [sg(diodeVF(i, T, P), 4), i]; }); }
    var ts = [25, 40, 55, 70, 75, 85, 100, 115, 130, 145, 160, 175];
    var irt = []; for (var t = 25; t <= 100; t += 5) irt.push(t);
    LIB.add({
      id: 'tf-1n4007', part: 'TF-1N4007', family: 'Diode', mfr: MFR, lang: 'en', ref: '1N4007',
      title: 'General purpose rectifier diode, 1 A, 1000 V',
      desc: 'Silicon rectifier diode in a moulded axial package for mains rectification and as a freewheeling diode. It blocks up to 1000 V and carries 1 A average forward current at moderate temperature.',
      notes: NOTE_DE, notesEn: NOTE_EN,
      features: ['Repetitive peak reverse voltage 1000 V', 'Average forward current 1 A', 'Surge current 30 A (8.3 ms half sine)', 'Low forward voltage, 1.1 V maximum at 1 A', 'Moulded axial package DO-41'],
      pins: { pkg: 'DO-41', pins: [
        { n: 1, name: 'K', type: 'io', desc: 'Cathode (end with the silver band)' },
        { n: 2, name: 'A', type: 'io', desc: 'Anode' }] },
      abs: [
        { key: 'vrrm', param: 'Repetitive peak reverse voltage', sym: 'VRRM', cond: '', min: null, max: 1000, unit: 'V', note: '' },
        { key: 'vrms', param: 'RMS reverse voltage', sym: 'VR(RMS)', cond: '', min: null, max: 700, unit: 'V', note: '' },
        { key: 'vdc', param: 'DC blocking voltage', sym: 'VR', cond: '', min: null, max: 1000, unit: 'V', note: '' },
        { key: 'ifav', param: 'Average forward current', sym: 'IF(AV)', cond: 'resistive load, lead temperature TL = 75 °C, leads 9.5 mm', min: null, max: 1, unit: 'A', note: 'derate above 75 °C' },
        { key: 'ifsm', param: 'Non-repetitive peak forward surge current', sym: 'IFSM', cond: '8.3 ms single half sine wave', min: null, max: 30, unit: 'A', note: '' },
        { key: 'ptot', param: 'Total power dissipation', sym: 'Ptot', cond: 'Tamb = 25 °C, leads 10 mm', min: null, max: 1.5, unit: 'W', note: '' },
        { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: null, max: 175, unit: '°C', note: '' },
        { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -65, max: 175, unit: '°C', note: '' }],
      rec: [
        { key: 'vr', param: 'Reverse voltage (20 % margin)', sym: 'VR', min: 0, max: 800, unit: 'V' },
        { key: 'ifav', param: 'Average forward current', sym: 'IF(AV)', min: 0, max: 1, unit: 'A' },
        { key: 'tl', param: 'Lead temperature', sym: 'TL', min: -55, max: 75, unit: '°C' },
        { key: 'tamb', param: 'Ambient temperature', sym: 'Tamb', min: -55, max: 125, unit: '°C' }],
      elec: [
        { key: 'vf10m', param: 'Forward voltage', sym: 'VF', cond: 'IF = 10 mA', min: 0.50, typ: 0.66, max: 0.80, unit: 'V', tj: 25 },
        { key: 'vf1', param: 'Forward voltage', sym: 'VF', cond: 'IF = 1 A', min: 0.80, typ: 0.93, max: 1.10, unit: 'V', tj: 25 },
        { key: 'vf3', param: 'Forward voltage', sym: 'VF', cond: 'IF = 3 A, tp = 300 µs', min: 0.90, typ: 1.05, max: 1.30, unit: 'V', tj: 25 },
        { key: 'vbr', param: 'Reverse breakdown voltage', sym: 'V(BR)R', cond: 'IR = 100 µA', min: 1100, typ: 1300, max: null, unit: 'V', tj: 25 },
        { key: 'ir25', param: 'Reverse current', sym: 'IR', cond: 'VR = 1000 V', min: null, typ: 0.05, max: 5, unit: 'µA', tj: 25 },
        { key: 'ir100', param: 'Reverse current', sym: 'IR', cond: 'VR = 1000 V', min: null, typ: 10, max: 50, unit: 'µA', tj: 100 },
        { key: 'cj', param: 'Junction capacitance', sym: 'Cj', cond: 'VR = 4 V, f = 1 MHz', min: null, typ: 8, max: 15, unit: 'pF', tj: 25 },
        { key: 'trr', param: 'Reverse recovery time', sym: 'trr', cond: 'IF = 0.5 A, IR = 1 A, Irr = 0.25 A', min: null, typ: 2, max: null, unit: 'µs', tj: 25 }],
      graphs: [
        { id: 'if_vf', title: 'Forward current vs. forward voltage', xLabel: 'Forward voltage', xUnit: 'V', xScale: 'lin', yLabel: 'Forward current', yUnit: 'A', yScale: 'log',
          series: [
            { name: 'Tj = 25 °C', cond: 'typical values', points: ser(25) },
            { name: 'Tj = 100 °C', cond: 'typical values', points: ser(100) }],
          note: 'Typical values; pulsed measurement, tp = 300 µs.' },
        { id: 'derating', title: 'Average forward current vs. lead temperature (derating)', xLabel: 'Lead temperature', xUnit: '°C', xScale: 'lin', yLabel: 'Average forward current', yUnit: 'A', yScale: 'lin',
          series: [{ name: 'Resistive or inductive load', cond: 'leads 9.5 mm', points: mk(ts, function (t) { return Math.min(1, (175 - t) / 100); }, 4, 3) }],
          note: 'Full current only up to a lead temperature of 75 °C; linear reduction to zero at 175 °C.' },
        { id: 'ir_tj', title: 'Reverse current vs. junction temperature', xLabel: 'Junction temperature', xUnit: '°C', xScale: 'lin', yLabel: 'Reverse current', yUnit: 'A', yScale: 'log',
          series: [{ name: 'VR = 1000 V', cond: 'typical values', points: mk(irt, function (t) { return 0.05e-6 * Math.pow(2, (t - 25) / 9.8); }, 4, 3) }],
          note: 'Leakage doubles about every 10 K.' }],
      thermal: { rthJA: 100, tjMax: 175, ptotMax: 1.5, note: 'Leads 10 mm, soldered to PCB. Ptot = (175 − 25) K / 100 K/W = 1.5 W. Thermal resistance junction to lead about 25 K/W: with short leads on a large copper area the current rating improves.' },
      pkgDraw: { name: 'DO-41 (axial)', kind: 'do41', dims: [
        dim('A', 4.1, 5.2, 'mm', 'body length'), dim('B', 2.0, 2.7, 'mm', 'body diameter'),
        dim('C', 0.71, 0.86, 'mm', 'lead diameter'), dim('D', 25.4, null, 'mm', 'lead length (min)')] },
      app: [
        { title: 'Bridge rectifier from four diodes', text: 'Four diodes make a full-wave bridge. At any time two diodes conduct, so the output is lower than the peak input by two diode drops. Choose the diodes for the peak reverse voltage with margin and for the average current.',
          circuit: ['AC ──┬──▶|──┬── +', '      │      │', '      └──|◀──┘', 'AC ──┬──▶|──┬── GND', '      └──|◀──┘'],
          formulas: ['Upeak = Urms · √2 − 2 · VF', 'VRRM ≥ 1.2 · Upeak,in   (e.g. 230 V: 325 V peak, 1000 V is plenty)', 'IF(AV) ≥ IOUT / 2 per diode (full-wave), plus inrush current < IFSM'] },
        { title: 'Freewheeling diode across a motor or coil', text: 'The diode conducts the current of the inductive load after the switch opens. Select a diode whose average current covers the load current during the freewheeling phase.',
          circuit: ['+U ──┬──[Motor]──┬── switch to GND', '      └──▲|───────┘  (cathode to +U)'],
          formulas: ['IF(AV) ≥ ILOAD · (1 − D)   (D = duty cycle of the switch)', 'P(diode) = VF · IF(AV)'] }],
      order: [
        { type: 'TF-1N4007', pkg: 'DO-41', note: 'bulk' },
        { type: 'TF-1N4007-T', pkg: 'DO-41', note: 'on tape (ammo pack)' }],
      glossary: G(['amr', 'ec', 'tc_cond', 'rectifier', 'peakrev', 'rms', 'avg', 'surge', 'vf', 'ir', 'cj', 'trr', 'rthja', 'derating', 'freewheel', 'lead', 'tj', 'anode'])
    });
  })();

  /* ========================================================================
     3) TF-ZD  Z-Diode 5,1 V
     ======================================================================== */
  (function () {
    function vz(i, dT) { return 5.10 + 10 * (i - 0.005) + 0.1 * Math.log(i / 0.005) + 0.5e-3 * dT; }
    function zz(i) { return 10 + 0.1 / i; }
    var iz = [1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 9e-2];
    var pts = function (dT) { return iz.map(function (i) { return [sg(vz(i, dT), 4), i]; }); };
    LIB.add({
      id: 'tf-zd', part: 'TF-ZD5V1', family: 'Diode', mfr: MFR, lang: 'en', ref: 'BZX55C5V1',
      title: 'Zener diode 5.1 V, 500 mW, 5 % tolerance',
      desc: 'Silicon voltage reference diode that holds a nearly constant voltage of 5.1 V when operated in reverse breakdown. Used as a simple shunt regulator, for voltage clamping and as a reference for low currents.',
      notes: NOTE_DE, notesEn: NOTE_EN,
      features: ['Nominal Zener voltage 5.1 V at 5 mA', 'Tolerance ±5 %', 'Total power dissipation 500 mW', 'Low dynamic impedance, typically 30 Ω at 5 mA', 'Glass axial package DO-35'],
      pins: { pkg: 'DO-35', pins: [
        { n: 1, name: 'K', type: 'io', desc: 'Cathode (colour band), connected to the positive side in normal use' },
        { n: 2, name: 'A', type: 'io', desc: 'Anode' }] },
      abs: [
        { key: 'ptot', param: 'Total power dissipation', sym: 'Ptot', cond: 'Tamb = 25 °C, leads 10 mm', min: null, max: 500, unit: 'mW', note: 'derate above 25 °C' },
        { key: 'izm', param: 'Zener current (limited by Ptot)', sym: 'IZM', cond: 'Tamb = 25 °C', min: null, max: 90, unit: 'mA', note: 'about Ptot / VZ(max)' },
        { key: 'if', param: 'Forward current', sym: 'IF', cond: '', min: null, max: 200, unit: 'mA', note: '' },
        { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: null, max: 175, unit: '°C', note: '' },
        { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -65, max: 175, unit: '°C', note: '' },
        { key: 'tsol', param: 'Soldering temperature', sym: 'Tsol', cond: 'leads 4 mm from the body, 10 s', min: null, max: 260, unit: '°C', note: '' }],
      rec: [
        { key: 'iz', param: 'Zener current', sym: 'IZ', min: 0.5, max: 50, unit: 'mA' },
        { key: 'ptot', param: 'Power dissipation', sym: 'Ptot', min: 0, max: 350, unit: 'mW' },
        { key: 'tamb', param: 'Ambient temperature', sym: 'Tamb', min: -55, max: 125, unit: '°C' }],
      elec: [
        { key: 'vz', param: 'Zener voltage', sym: 'VZ', cond: 'IZ = 5 mA', min: 4.85, typ: 5.10, max: 5.35, unit: 'V', tj: 25 },
        { key: 'vz1ma', param: 'Zener voltage', sym: 'VZ', cond: 'IZ = 1 mA', min: 4.60, typ: 4.90, max: 5.20, unit: 'V', tj: 25 },
        { key: 'zzt', param: 'Dynamic impedance', sym: 'zZT', cond: 'IZ = 5 mA, f = 1 kHz', min: null, typ: 30, max: 60, unit: 'Ω', tj: 25 },
        { key: 'zzk', param: 'Dynamic impedance at the knee', sym: 'zZK', cond: 'IZ = 1 mA, f = 1 kHz', min: null, typ: 110, max: 400, unit: 'Ω', tj: 25 },
        { key: 'tc', param: 'Temperature coefficient of Zener voltage', sym: 'SZ', cond: 'IZ = 5 mA', min: -1.0, typ: 0.5, max: 1.8, unit: 'mV/K', tj: 25 },
        { key: 'ir', param: 'Reverse current', sym: 'IR', cond: 'VR = 2 V', min: null, typ: 0.1, max: 1, unit: 'µA', tj: 25 },
        { key: 'vf', param: 'Forward voltage', sym: 'VF', cond: 'IF = 100 mA', min: null, typ: 0.90, max: 1.00, unit: 'V', tj: 25 },
        { key: 'cd', param: 'Diode capacitance', sym: 'Cd', cond: 'VR = 0 V, f = 1 MHz', min: null, typ: 110, max: 150, unit: 'pF', tj: 25 }],
      graphs: [
        { id: 'iz_vz', title: 'Zener current vs. Zener voltage', xLabel: 'Zener voltage', xUnit: 'V', xScale: 'lin', yLabel: 'Zener current', yUnit: 'A', yScale: 'log',
          series: [
            { name: 'Tj = 25 °C', cond: 'typical values', points: pts(0) },
            { name: 'Tj = 100 °C', cond: 'typical values', points: pts(75) }],
          note: 'Below about 1 mA the breakdown knee is soft; operate above the knee current for a stable voltage.' },
        { id: 'zz_iz', title: 'Dynamic impedance vs. Zener current', xLabel: 'Zener current', xUnit: 'A', xScale: 'log', yLabel: 'Dynamic impedance', yUnit: 'Ω', yScale: 'log',
          series: [{ name: 'f = 1 kHz', cond: 'Tj = 25 °C, typical values', points: iz.map(function (i) { return [i, sg(zz(i), 4)]; }) }],
          note: 'Low impedance means better regulation: raise IZ for a stiffer reference.' },
        { id: 'ptot_t', title: 'Power dissipation vs. ambient temperature', xLabel: 'Ambient temperature', xUnit: '°C', xScale: 'lin', yLabel: 'Power dissipation', yUnit: 'W', yScale: 'lin',
          series: [{ name: 'Ptot', cond: 'leads 10 mm', points: mk([-55, 25, 50, 75, 100, 125, 150, 175], function (t) { return Math.min(0.5, 0.5 * (175 - t) / 150); }, 4, 3) }],
          note: 'Derating: 3.3 mW/K above 25 °C.' }],
      thermal: { rthJA: 300, tjMax: 175, ptotMax: 0.5, note: 'Ptot = (175 − 25) K / 300 K/W = 0.5 W at Tamb = 25 °C. The Zener voltage drifts with temperature: about +0.5 mV/K at 5.1 V.' },
      pkgDraw: { name: 'DO-35 (glass axial)', kind: 'do35', dims: [
        dim('A', 3.04, 5.08, 'mm', 'body length'), dim('B', 1.53, 2.28, 'mm', 'body diameter'),
        dim('C', 0.46, 0.56, 'mm', 'lead diameter'), dim('D', 25.4, null, 'mm', 'lead length (min)')] },
      app: [
        { title: 'Shunt regulator for a small load', text: 'A series resistor RS feeds the Zener diode and the load. The Zener current is what is left of the supply current after the load takes its share. Design for the minimum supply voltage and the maximum load current so that IZ never falls below the knee, then check the diode power at the maximum supply voltage and minimum load.',
          circuit: ['Vin ──[ RS ]──┬────┬── Vout = VZ', '              │    │', '             ▼ Z   [Load]', '             │    │', 'GND ─────────┴────┘'],
          formulas: ['RS = (Vin,min − VZ) / (IZ,min + IL,max)', 'IZ = (Vin − VZ) / RS − IL', 'PZ = VZ · IZ,max  ≤ Ptot (with margin)', 'PR = (Vin,max − VZ)² / RS', 'Example: Vin = 9 V ± 10 %, IL = 0…10 mA → RS = (8.1 − 5.1) V / 15 mA = 200 Ω → E12: 180 Ω'] }],
      order: [
        { type: 'TF-ZD5V1', pkg: 'DO-35', note: 'axial, 5.1 V ±5 %' },
        { type: 'TF-ZD5V1S', pkg: 'SOD-123', note: 'surface-mount variant (Ptot lower, check separate data)' }],
      glossary: G(['amr', 'roc', 'ec', 'tc_cond', 'vbr', 'zz', 'knee', 'izm', 'tcoef', 'vr', 'ir', 'vf', 'ptot', 'tj', 'rthja', 'derating', 'cj', 'anode'])
    });
  })();

  /* ========================================================================
     4) TF-LED-R  Rote LED 5 mm
     ======================================================================== */
  (function () {
    var P = { is: 0.02 / Math.exp(1.9 / (2.0 * 8.617e-5 * 298.15)) / 1, n: 2.0, rs: 5, tc: 2.0e-3 };
    function vfLed(i, T) { return diodeVF(i, T, P); }
    var ifs = [1e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 1.5e-2, 2e-2, 2.5e-2, 3e-2];
    function ser(T) { return ifs.map(function (i) { return [sg(vfLed(i, T), 4), sg(i * 1000, 4)]; }); }
    var wl = [590, 600, 610, 615, 620, 625, 630, 632, 635, 640, 645, 650, 655, 660, 670, 680];
    var sigma = 20 / 2.3548;
    LIB.add({
      id: 'tf-led-r', part: 'TF-LED-R5', family: 'LED', mfr: MFR, lang: 'en', ref: 'LED 5 mm rot',
      title: 'Red LED, 5 mm, diffused or clear, 20 mA',
      desc: 'Standard red light emitting diode in a 5 mm through-hole housing. It is driven with a constant current of about 20 mA set by a series resistor, and emits red light at around 630 nm.',
      notes: NOTE_DE, notesEn: NOTE_EN,
      features: ['Red, dominant wavelength 625 nm', 'Luminous intensity typically 250 mcd at 20 mA', 'Viewing angle 30 degrees', 'Forward voltage typically 2.0 V at 20 mA', 'Through-hole 5 mm package with flange'],
      pins: { pkg: 'LED 5 mm', pins: [
        { n: 1, name: 'K', type: 'io', desc: 'Cathode (short lead, flat on the flange)' },
        { n: 2, name: 'A', type: 'io', desc: 'Anode (long lead)' }] },
      abs: [
        { key: 'if', param: 'Continuous forward current', sym: 'IF', cond: 'Tamb = 25 °C', min: null, max: 30, unit: 'mA', note: 'derate above 60 °C' },
        { key: 'ifp', param: 'Peak forward current', sym: 'IFP', cond: 'duty cycle 1:10, f = 1 kHz, tp = 100 µs', min: null, max: 100, unit: 'mA', note: '' },
        { key: 'vr', param: 'Reverse voltage', sym: 'VR', cond: '', min: null, max: 5, unit: 'V', note: 'LEDs block only a few volts' },
        { key: 'ptot', param: 'Power dissipation', sym: 'Ptot', cond: 'Tamb = 25 °C', min: null, max: 100, unit: 'mW', note: '' },
        { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: null, max: 100, unit: '°C', note: '' },
        { key: 'top', param: 'Operating temperature', sym: 'Top', cond: '', min: -40, max: 85, unit: '°C', note: '' },
        { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -40, max: 100, unit: '°C', note: '' },
        { key: 'tsol', param: 'Soldering temperature', sym: 'Tsol', cond: 'at 3 mm from the body, 3 s', min: null, max: 260, unit: '°C', note: '' }],
      rec: [
        { key: 'if', param: 'Forward current', sym: 'IF', min: 5, max: 20, unit: 'mA' },
        { key: 'vr', param: 'Reverse voltage', sym: 'VR', min: 0, max: 3, unit: 'V' },
        { key: 'tamb', param: 'Ambient temperature', sym: 'Tamb', min: -25, max: 70, unit: '°C' }],
      elec: [
        { key: 'vf10', param: 'Forward voltage', sym: 'VF', cond: 'IF = 10 mA', min: 1.5, typ: 1.91, max: 2.3, unit: 'V', tj: 25 },
        { key: 'vf20', param: 'Forward voltage', sym: 'VF', cond: 'IF = 20 mA', min: 1.6, typ: 2.0, max: 2.4, unit: 'V', tj: 25 },
        { key: 'ir', param: 'Reverse current', sym: 'IR', cond: 'VR = 5 V', min: null, typ: 0.1, max: 10, unit: 'µA', tj: 25 },
        { key: 'iv', param: 'Luminous intensity', sym: 'IV', cond: 'IF = 20 mA', min: 100, typ: 250, max: 400, unit: 'mcd', tj: 25 },
        { key: 'lamd', param: 'Dominant wavelength', sym: 'λd', cond: 'IF = 20 mA', min: 620, typ: 625, max: 630, unit: 'nm', tj: 25 },
        { key: 'lamp', param: 'Peak wavelength', sym: 'λp', cond: 'IF = 20 mA', min: null, typ: 632, max: null, unit: 'nm', tj: 25 },
        { key: 'dlam', param: 'Spectral bandwidth at 50 %', sym: 'Δλ', cond: 'IF = 20 mA', min: null, typ: 20, max: null, unit: 'nm', tj: 25 },
        { key: 'angle', param: 'Viewing angle (half intensity)', sym: '2θ½', cond: 'IF = 20 mA', min: 20, typ: 30, max: 40, unit: '°', tj: 25 },
        { key: 'cj', param: 'Junction capacitance', sym: 'Cj', cond: 'VR = 0 V, f = 1 MHz', min: null, typ: 40, max: null, unit: 'pF', tj: 25 }],
      graphs: [
        { id: 'if_vf', title: 'Forward current vs. forward voltage', xLabel: 'Forward voltage', xUnit: 'V', xScale: 'lin', yLabel: 'Forward current', yUnit: 'mA', yScale: 'lin',
          series: [
            { name: 'Tamb = 25 °C', cond: 'typical values', points: ser(25) },
            { name: 'Tamb = 85 °C', cond: 'typical values', points: ser(85) }],
          note: 'The forward voltage falls by about 2 mV/K. A resistor, not the supply voltage, must set the current.' },
        { id: 'iv_if', title: 'Relative luminous intensity vs. forward current', xLabel: 'Forward current', xUnit: 'mA', xScale: 'lin', yLabel: 'Relative luminous intensity', yUnit: '', yScale: 'lin',
          series: [{ name: 'Tamb = 25 °C', cond: 'normalised to 1 at IF = 20 mA', points: mk([1, 2, 5, 10, 15, 20, 25, 30], function (i) { return Math.pow(i / 20, 0.92); }, 4, 3) }],
          note: 'The light output is almost proportional to the current, with a small loss in efficiency at high current.' },
        { id: 'iv_t', title: 'Relative luminous intensity vs. ambient temperature', xLabel: 'Ambient temperature', xUnit: '°C', xScale: 'lin', yLabel: 'Relative luminous intensity', yUnit: '', yScale: 'lin',
          series: [{ name: 'IF = 20 mA', cond: 'normalised to 1 at 25 °C', points: mk([-40, -20, 0, 25, 50, 70, 85, 100], function (t) { return 1 - 0.011 * (t - 25); }, 4, 3) }],
          note: 'Red LEDs lose about 1 % of their brightness per kelvin.' },
        { id: 'spectrum', title: 'Relative spectral emission', xLabel: 'Wavelength', xUnit: 'nm', xScale: 'lin', yLabel: 'Relative emission', yUnit: '', yScale: 'lin',
          series: [{ name: 'IF = 20 mA', cond: 'Tamb = 25 °C', points: mk(wl, function (l) { return Math.exp(-Math.pow(l - 632, 2) / (2 * sigma * sigma)); }, 4, 3) }],
          note: 'Peak at 632 nm, bandwidth 20 nm.' }],
      thermal: { rthJA: 750, tjMax: 100, ptotMax: 0.1, note: 'Leads 3 mm from the body soldered into a PCB. Ptot = (100 − 25) K / 750 K/W = 100 mW. The maximum forward current must be reduced above 60 °C ambient temperature.' },
      pkgDraw: { name: 'LED 5 mm (T-1¾)', kind: 'led5', dims: [
        dim('D', 4.8, 5.2, 'mm', 'body diameter'), dim('F', 5.8, 6.2, 'mm', 'flange diameter'),
        dim('H', 8.4, 9.0, 'mm', 'height of the body above the flange base'), dim('e', 2.34, 2.74, 'mm', 'lead pitch'),
        dim('L', 25.0, null, 'mm', 'lead length (min)'), dim('d', 0.45, 0.55, 'mm', 'lead thickness')] },
      app: [
        { title: 'LED series resistor', text: 'The resistor takes the difference between the supply voltage and the forward voltage at the desired current. Use the typical VF at that current from the curve and round up to the next E12 value to stay below the limit.',
          circuit: ['Vs ──[ RV ]──▶|── GND', '         (anode to RV, cathode to GND)'],
          formulas: ['RV = (Vs − VF) / IF', 'PR = (Vs − VF) · IF', 'Example: Vs = 5 V, VF = 2.0 V, IF = 20 mA → RV = 3.0 V / 20 mA = 150 Ω (E12 value)', 'Example: Vs = 3.3 V, IF = 10 mA → RV = (3.3 − 1.91) V / 10 mA = 139 Ω → E12: 150 Ω, IF = 9.3 mA'] }],
      order: [{ type: 'TF-LED-R5', pkg: 'LED 5 mm', note: 'red, water-clear lens' }, { type: 'TF-LED-R5D', pkg: 'LED 5 mm', note: 'red, diffused lens' }],
      glossary: G(['amr', 'roc', 'ec', 'tc_cond', 'vf', 'vr', 'ir', 'lum', 'dwl', 'angle', 'pulsed', 'duty', 'ptot', 'tj', 'rthja', 'derating', 'lead', 'pin'])
    });
  })();

  /* ========================================================================
     5) TF-BC547  NPN-Kleinsignaltransistor
     ======================================================================== */
  (function () {
    var shape = [[0.01, 0.40], [0.02, 0.52], [0.05, 0.70], [0.1, 0.80], [0.2, 0.88], [0.5, 0.95], [1, 0.98], [2, 1.00], [5, 1.03], [10, 1.03], [20, 0.98], [50, 0.85], [100, 0.68]]; // IC in mA
    function hfe(h2, icmA) { return h2 * ilog(shape, icmA); }
    var icm = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
    var vces = [0, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 4, 6, 8, 10];
    function icFam(ibuA) {
      return vces.map(function (v) {
        var ic = ibuA * 1e-6 * 290, k;
        for (k = 0; k < 40; k++) ic = ibuA * 1e-6 * hfe(290, Math.max(ic * 1000, 0.01)) * (1 + v / 100) * (1 - Math.exp(-v / 0.12));
        return [v, sg(ic * 1000, 4)];
      });
    }
    var vcs = function (ratio) { return [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].map(function (i) { return [i, sg(ratio * 0.09 * Math.pow(i / 10, 0.347), 3)]; }); };
    LIB.add({
      id: 'tf-bc547', part: 'TF-BC547', family: 'Transistor', mfr: MFR, lang: 'en', ref: 'BC547',
      title: 'NPN general purpose small-signal transistor, 45 V, 100 mA',
      desc: 'Silicon NPN transistor in a plastic TO-92 package for amplifiers and switches in the milliampere range. Current gain is sorted in three groups A, B and C.',
      notes: NOTE_DE, notesEn: NOTE_EN,
      features: ['Collector-emitter voltage 45 V', 'Collector current 100 mA continuous', 'Total power dissipation 500 mW', 'Current gain groups A, B, C (110 to 800)', 'Transition frequency typically 300 MHz', 'Low noise'],
      pins: { pkg: 'TO-92', pins: [
        { n: 1, name: 'C', type: 'io', desc: 'Collector' },
        { n: 2, name: 'B', type: 'in', desc: 'Base' },
        { n: 3, name: 'E', type: 'io', desc: 'Emitter' }] },
      abs: [
        { key: 'vcbo', param: 'Collector-base voltage', sym: 'VCBO', cond: 'IE = 0', min: null, max: 50, unit: 'V', note: '' },
        { key: 'vceo', param: 'Collector-emitter voltage', sym: 'VCEO', cond: 'IB = 0', min: null, max: 45, unit: 'V', note: '' },
        { key: 'vebo', param: 'Emitter-base voltage', sym: 'VEBO', cond: 'IC = 0', min: null, max: 6, unit: 'V', note: '' },
        { key: 'ic', param: 'Collector current', sym: 'IC', cond: 'continuous', min: null, max: 100, unit: 'mA', note: '' },
        { key: 'icm', param: 'Peak collector current', sym: 'ICM', cond: 'tp ≤ 1 ms', min: null, max: 200, unit: 'mA', note: '' },
        { key: 'ptot', param: 'Total power dissipation', sym: 'Ptot', cond: 'Tamb = 25 °C', min: null, max: 500, unit: 'mW', note: '' },
        { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: null, max: 150, unit: '°C', note: '' },
        { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -65, max: 150, unit: '°C', note: '' }],
      rec: [
        { key: 'vce', param: 'Collector-emitter voltage', sym: 'VCE', min: 0, max: 30, unit: 'V' },
        { key: 'ic', param: 'Collector current', sym: 'IC', min: 0.01, max: 50, unit: 'mA' },
        { key: 'ptot', param: 'Power dissipation', sym: 'Ptot', min: 0, max: 350, unit: 'mW' },
        { key: 'tamb', param: 'Ambient temperature', sym: 'Tamb', min: -40, max: 85, unit: '°C' }],
      elec: [
        { key: 'icbo', param: 'Collector cut-off current', sym: 'ICBO', cond: 'VCB = 30 V, IE = 0', min: null, typ: 0.2, max: 15, unit: 'nA', tj: 25 },
        { key: 'vbrceo', param: 'Collector-emitter breakdown voltage', sym: 'V(BR)CEO', cond: 'IC = 10 mA, IB = 0', min: 45, typ: null, max: null, unit: 'V', tj: 25 },
        { key: 'hfeA', param: 'DC current gain, group A', sym: 'hFE', cond: 'VCE = 5 V, IC = 2 mA', min: 110, typ: 180, max: 220, unit: '', tj: 25 },
        { key: 'hfeB', param: 'DC current gain, group B', sym: 'hFE', cond: 'VCE = 5 V, IC = 2 mA', min: 200, typ: 290, max: 450, unit: '', tj: 25 },
        { key: 'hfeC', param: 'DC current gain, group C', sym: 'hFE', cond: 'VCE = 5 V, IC = 2 mA', min: 420, typ: 520, max: 800, unit: '', tj: 25 },
        { key: 'vcesat10', param: 'Collector-emitter saturation voltage', sym: 'VCEsat', cond: 'IC = 10 mA, IB = 0.5 mA', min: null, typ: 0.09, max: 0.25, unit: 'V', tj: 25 },
        { key: 'vcesat100', param: 'Collector-emitter saturation voltage', sym: 'VCEsat', cond: 'IC = 100 mA, IB = 5 mA', min: null, typ: 0.2, max: 0.6, unit: 'V', tj: 25 },
        { key: 'vbeon', param: 'Base-emitter voltage', sym: 'VBE(on)', cond: 'VCE = 5 V, IC = 2 mA', min: 0.58, typ: 0.65, max: 0.70, unit: 'V', tj: 25 },
        { key: 'ft', param: 'Transition frequency', sym: 'fT', cond: 'VCE = 5 V, IC = 10 mA, f = 100 MHz', min: 150, typ: 300, max: null, unit: 'MHz', tj: 25 },
        { key: 'ccb', param: 'Collector-base capacitance', sym: 'Ccb', cond: 'VCB = 10 V, IE = 0, f = 1 MHz', min: null, typ: 3.5, max: 4.5, unit: 'pF', tj: 25 },
        { key: 'nf', param: 'Noise figure', sym: 'NF', cond: 'VCE = 5 V, IC = 0.2 mA, RS = 2 kΩ, f = 1 kHz, B = 200 Hz', min: null, typ: 2, max: 10, unit: 'dB', tj: 25 }],
      graphs: [
        { id: 'ic_vce', title: 'Collector current vs. collector-emitter voltage', xLabel: 'Collector-emitter voltage', xUnit: 'V', xScale: 'lin', yLabel: 'Collector current', yUnit: 'mA', yScale: 'lin',
          series: [20, 40, 60, 80, 100].map(function (b) { return { name: 'IB = ' + b + ' µA', cond: 'group B, typical values', points: icFam(b) }; }),
          note: 'Output characteristics, Tamb = 25 °C. In the flat part the collector current is controlled by the base current; below about 0.3 V the transistor saturates.' },
        { id: 'hfe_ic', title: 'DC current gain vs. collector current', xLabel: 'Collector current', xUnit: 'mA', xScale: 'log', yLabel: 'DC current gain', yUnit: '', yScale: 'lin',
          series: [{ name: 'group A', cond: 'VCE = 5 V, Tamb = 25 °C', h: 180 }, { name: 'group B', cond: 'VCE = 5 V, Tamb = 25 °C', h: 290 }, { name: 'group C', cond: 'VCE = 5 V, Tamb = 25 °C', h: 520 }].map(function (s) {
            return { name: s.name, cond: s.cond + ', typical values', points: icm.map(function (i) { return [i, sg(hfe(s.h, i), 4)]; }) };
          }),
          note: 'The gain varies strongly with current and falls at very low and very high collector current.' },
        { id: 'vcesat_ic', title: 'Collector-emitter saturation voltage vs. collector current', xLabel: 'Collector current', xUnit: 'mA', xScale: 'log', yLabel: 'Saturation voltage', yUnit: 'V', yScale: 'log',
          series: [
            { name: 'IC / IB = 20', cond: 'Tamb = 25 °C, typical values', points: vcs(1) },
            { name: 'IC / IB = 10', cond: 'Tamb = 25 °C, typical values', points: vcs(0.78) }],
          note: 'More base current (smaller IC/IB) gives a lower saturation voltage.' },
        { id: 'vbe_ic', title: 'Base-emitter voltage vs. collector current', xLabel: 'Collector current', xUnit: 'mA', xScale: 'log', yLabel: 'Base-emitter voltage', yUnit: 'V', yScale: 'lin',
          series: [
            { name: 'Tamb = 25 °C', cond: 'VCE = 5 V, typical values', points: mk([0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100], function (i) { return 0.65 + 0.0259 * Math.log(i / 2); }, 4, 3) },
            { name: 'Tamb = 125 °C', cond: 'VCE = 5 V, typical values', points: mk([0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100], function (i) { return 0.65 - 0.2 + 0.0345 * Math.log(i / 2); }, 4, 3) }],
          note: 'VBE falls by about 2 mV per kelvin.' }],
      thermal: { rthJA: 250, tjMax: 150, ptotMax: 0.5, note: 'Ptot = (150 − 25) K / 250 K/W = 0.5 W at Tamb = 25 °C, free air, leads 3 mm. Above 25 °C the permitted power falls by 4 mW per kelvin.' },
      pkgDraw: { name: 'TO-92 (plastic)', kind: 'to92', dims: [
        dim('A', 4.32, 5.33, 'mm', 'body height'), dim('B', 4.45, 5.20, 'mm', 'body width'),
        dim('C', 3.18, 4.19, 'mm', 'body thickness'), dim('L', 12.7, null, 'mm', 'lead length (min)'),
        dim('e', 2.44, 2.64, 'mm', 'pitch of outer leads'), dim('d', 0.38, 0.55, 'mm', 'lead width')] },
      app: [
        { title: 'Transistor as a switch with base resistor', text: 'To switch a load of 40 mA (a small 12 V relay) from a 3.3 V logic output, drive the transistor into saturation with a forced current gain of 10, far below the minimum hFE. The base resistor sets this base current. Add a flyback diode across the coil.',
          circuit: ['+12 V ──┬──[Relay]──┬── C', '         └──▲|───────┘', 'IN ──[ RB ]──────── B   BC547', '                       E ── GND'],
          formulas: ['IB = IC / hFE,forced   (hFE,forced = 10 for saturation, VCEsat ≈ 0.1 V)', 'RB = (Vin − VBE) / IB', 'Example: IC = 40 mA, IB = 4 mA, Vin = 3.3 V, VBE ≈ 0.8 V → RB = 2.5 V / 4 mA = 625 Ω → E12: 560 Ω (IB = 4.5 mA)', 'P(transistor) = VCEsat · IC = 0.1 V · 40 mA = 4 mW'] },
        { title: 'Common-emitter amplifier, small signal', text: 'For small signals the transconductance gm tells how much collector current changes per millivolt of base voltage.',
          circuit: ['+Vcc ──[RC]──┬── Out', '            C', 'In ─[C1]─── B  BC547', '            E ─[RE]── GND'],
          formulas: ['gm = IC / UT   (UT ≈ 26 mV at room temperature)', 'Au ≈ − RC / (RE + 1/gm)', 'Example: IC = 2 mA → gm ≈ 77 mS'] }],
      order: [
        { type: 'TF-BC547A', pkg: 'TO-92', note: 'hFE 110 to 220' },
        { type: 'TF-BC547B', pkg: 'TO-92', note: 'hFE 200 to 450' },
        { type: 'TF-BC547C', pkg: 'TO-92', note: 'hFE 420 to 800' },
        { type: 'TF-BC847B', pkg: 'SOT-23', note: 'surface-mount variant, separate data' }],
      glossary: G(['amr', 'roc', 'ec', 'tc_cond', 'hfe', 'vcesat', 'vbe', 'ft', 'vceo', 'icbo', 'nf', 'cutoff', 'ptot', 'tj', 'rthja', 'pkg', 'pin'])
    });
  })();

  /* ========================================================================
     6) TF-BD139  NPN-Leistungstransistor TO-126
     ======================================================================== */
  (function () {
    var hp = [[0.005, 75], [0.01, 85], [0.02, 92], [0.05, 98], [0.1, 100], [0.15, 100], [0.3, 95], [0.5, 85], [1, 60], [1.5, 45]];
    function h25(ic) { return ilog(hp, ic); }
    var vces = [0, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 3, 4, 6, 8, 10];
    function fam(ibmA) {
      return vces.map(function (v) {
        var ic = ibmA * 1e-3 * 100, k;
        for (k = 0; k < 40; k++) ic = ibmA * 1e-3 * h25(Math.max(ic, 0.005)) * (1 + v / 150) * (1 - Math.exp(-v / 0.25));
        return [v, sg(ic, 4)];
      });
    }
    var icL = [0.005, 0.01, 0.02, 0.05, 0.1, 0.15, 0.3, 0.5, 1, 1.5];
    LIB.add({
      id: 'tf-bd139', part: 'TF-BD139', family: 'Transistor', mfr: MFR, lang: 'en', ref: 'BD139',
      title: 'NPN medium-power transistor, 80 V, 1.5 A, TO-126',
      desc: 'Silicon NPN power transistor in a plastic TO-126 package with a metal tab (connected to the collector) for mounting on a heat sink. Suitable for drivers, audio output stages and switches up to 1.5 A.',
      notes: NOTE_DE, notesEn: NOTE_EN,
      features: ['Collector-emitter voltage 80 V', 'Collector current 1.5 A continuous, 3 A peak', 'Power dissipation 12.5 W at a case temperature of 25 °C', 'Complementary type: PNP TF-BD140 (not part of this library)', 'TO-126 with mounting hole; tab connected to the collector'],
      pins: { pkg: 'TO-126', pins: [
        { n: 1, name: 'E', type: 'io', desc: 'Emitter' },
        { n: 2, name: 'C', type: 'io', desc: 'Collector (also the metal tab)' },
        { n: 3, name: 'B', type: 'in', desc: 'Base' }] },
      abs: [
        { key: 'vcbo', param: 'Collector-base voltage', sym: 'VCBO', cond: 'IE = 0', min: null, max: 80, unit: 'V', note: '' },
        { key: 'vceo', param: 'Collector-emitter voltage', sym: 'VCEO', cond: 'IB = 0', min: null, max: 80, unit: 'V', note: '' },
        { key: 'vebo', param: 'Emitter-base voltage', sym: 'VEBO', cond: 'IC = 0', min: null, max: 5, unit: 'V', note: '' },
        { key: 'ic', param: 'Collector current', sym: 'IC', cond: 'continuous', min: null, max: 1.5, unit: 'A', note: '' },
        { key: 'icm', param: 'Peak collector current', sym: 'ICM', cond: 'tp ≤ 10 ms', min: null, max: 3, unit: 'A', note: '' },
        { key: 'ib', param: 'Base current', sym: 'IB', cond: 'continuous', min: null, max: 0.5, unit: 'A', note: '' },
        { key: 'ptotc', param: 'Total power dissipation', sym: 'Ptot', cond: 'Tcase = 25 °C', min: null, max: 12.5, unit: 'W', note: 'only with a good heat sink; see thermal data' },
        { key: 'ptota', param: 'Total power dissipation', sym: 'Ptot', cond: 'Tamb = 25 °C, free air', min: null, max: 1.25, unit: 'W', note: '' },
        { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: null, max: 150, unit: '°C', note: '' },
        { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -65, max: 150, unit: '°C', note: '' }],
      rec: [
        { key: 'vce', param: 'Collector-emitter voltage', sym: 'VCE', min: 0, max: 60, unit: 'V' },
        { key: 'ic', param: 'Collector current', sym: 'IC', min: 0.005, max: 1.0, unit: 'A' },
        { key: 'tc', param: 'Case temperature', sym: 'TC', min: -40, max: 100, unit: '°C' },
        { key: 'tamb', param: 'Ambient temperature', sym: 'Tamb', min: -40, max: 85, unit: '°C' }],
      elec: [
        { key: 'icbo', param: 'Collector cut-off current', sym: 'ICBO', cond: 'VCB = 30 V, IE = 0', min: null, typ: 5, max: 100, unit: 'nA', tj: 25 },
        { key: 'iebo', param: 'Emitter cut-off current', sym: 'IEBO', cond: 'VEB = 5 V, IC = 0', min: null, typ: 0.1, max: 10, unit: 'µA', tj: 25 },
        { key: 'vbrceo', param: 'Collector-emitter breakdown voltage', sym: 'V(BR)CEO', cond: 'IC = 30 mA, IB = 0', min: 80, typ: null, max: null, unit: 'V', tj: 25 },
        { key: 'hfe5m', param: 'DC current gain', sym: 'hFE', cond: 'VCE = 2 V, IC = 5 mA', min: 25, typ: 75, max: null, unit: '', tj: 25 },
        { key: 'hfe150', param: 'DC current gain', sym: 'hFE', cond: 'VCE = 2 V, IC = 150 mA', min: 40, typ: 100, max: 250, unit: '', tj: 25 },
        { key: 'hfe500', param: 'DC current gain', sym: 'hFE', cond: 'VCE = 2 V, IC = 500 mA', min: 25, typ: 85, max: null, unit: '', tj: 25 },
        { key: 'vcesat', param: 'Collector-emitter saturation voltage', sym: 'VCEsat', cond: 'IC = 500 mA, IB = 50 mA', min: null, typ: 0.2, max: 0.5, unit: 'V', tj: 25 },
        { key: 'vbeon', param: 'Base-emitter voltage', sym: 'VBE(on)', cond: 'VCE = 2 V, IC = 500 mA', min: null, typ: 0.85, max: 1.0, unit: 'V', tj: 25 },
        { key: 'ft', param: 'Transition frequency', sym: 'fT', cond: 'VCE = 5 V, IC = 50 mA, f = 100 MHz', min: null, typ: 190, max: null, unit: 'MHz', tj: 25 }],
      graphs: [
        { id: 'ic_vce', title: 'Collector current vs. collector-emitter voltage', xLabel: 'Collector-emitter voltage', xUnit: 'V', xScale: 'lin', yLabel: 'Collector current', yUnit: 'A', yScale: 'lin',
          series: [1, 2, 5, 10, 15].map(function (b) { return { name: 'IB = ' + b + ' mA', cond: 'Tcase = 25 °C, typical values', points: fam(b) }; }),
          note: 'Pulsed measurement, tp = 300 µs, duty cycle ≤ 2 %. Not allowed as a continuous operating point at high VCE (see safe operating area).' },
        { id: 'hfe_ic', title: 'DC current gain vs. collector current', xLabel: 'Collector current', xUnit: 'A', xScale: 'log', yLabel: 'DC current gain', yUnit: '', yScale: 'lin',
          series: [
            { name: 'Tj = 25 °C', cond: 'VCE = 2 V, typical values', points: icL.map(function (i) { return [i, sg(h25(i), 4)]; }) },
            { name: 'Tj = 125 °C', cond: 'VCE = 2 V, typical values', points: icL.map(function (i) { return [i, sg(h25(i) * 1.35, 4)]; }) }],
          note: 'The gain rises with temperature and falls at high current.' },
        { id: 'vcesat_ic', title: 'Collector-emitter saturation voltage vs. collector current', xLabel: 'Collector current', xUnit: 'A', xScale: 'log', yLabel: 'Saturation voltage', yUnit: 'V', yScale: 'log',
          series: [{ name: 'IC / IB = 10', cond: 'Tcase = 25 °C, typical values', points: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 1.5].map(function (i) { return [i, sg(0.03 + 0.17 * Math.pow(i / 0.5, 0.9), 3)]; }) }],
          note: '' },
        { id: 'vbe_ic', title: 'Base-emitter voltage vs. collector current', xLabel: 'Collector current', xUnit: 'A', xScale: 'log', yLabel: 'Base-emitter voltage', yUnit: 'V', yScale: 'lin',
          series: [{ name: 'Tj = 25 °C', cond: 'VCE = 2 V, typical values', points: [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 1.5].map(function (i) { return [i, sg(0.85 + 0.0285 * Math.log(i / 0.5), 3)]; }) }],
          note: '' },
        { id: 'soa', title: 'Safe operating area (DC)', xLabel: 'Collector-emitter voltage', xUnit: 'V', xScale: 'log', yLabel: 'Collector current', yUnit: 'A', yScale: 'log',
          series: [{ name: 'DC operation', cond: 'Tcase = 25 °C', points: [[1, 1.5], [2, 1.5], [3, 1.5], [5, 1.5], [8.33, 1.5], [10, 1.25], [15, 0.833], [20, 0.625], [30, 0.417], [40, 0.313], [60, 0.208], [80, 0.156]] },
            { name: 'tp = 10 ms, single pulse', cond: 'Tcase = 25 °C', points: [[1, 3], [2, 3], [4, 3], [6, 3], [8.33, 3], [10, 2.5], [15, 1.67], [20, 1.25], [30, 0.833], [40, 0.625], [60, 0.417], [80, 0.3125]] }],
          note: 'Limits: collector current 1.5 A, power 12.5 W (inclined line), VCEO = 80 V. Valid only with the case held at 25 °C; in practice the permitted power is lower.' }],
      thermal: { rthJA: 100, rthJC: 10, tjMax: 150, ptotMax: 1.25, ptotMaxCase: 12.5, note: 'Free air: Ptot = (150 − 25) K / 100 K/W = 1.25 W. With the case held at 25 °C: (150 − 25) K / 10 K/W = 12.5 W. Heat sink: RthSA = (Tj − Tamb) / P − RthJC − RthCS, with RthCS about 1 K/W for an insulated mounting.' },
      pkgDraw: { name: 'TO-126 (SOT-32)', kind: 'to126', dims: [
        dim('A', 10.5, 11.1, 'mm', 'height of the body including tab'), dim('B', 7.4, 7.8, 'mm', 'body width'),
        dim('C', 2.4, 2.8, 'mm', 'body thickness'), dim('L', 14.0, 16.5, 'mm', 'lead length'),
        dim('e', 2.19, 2.39, 'mm', 'lead pitch'), dim('ØH', 3.0, 3.4, 'mm', 'mounting hole diameter')] },
      app: [
        { title: 'Switch for 12 V / 500 mA load', text: 'Drive the transistor into saturation with IB = IC / 10. At 500 mA the saturation voltage is only 0.2 V, so the power loss in the transistor is small and no heat sink is needed for pure switching. A logic output usually cannot supply 50 mA, therefore a small driver transistor or a Darlington stage is added.',
          circuit: ['+12 V ──[ Load ]── C', 'Drive ──[ RB ]── B   BD139', '                  E ── GND'],
          formulas: ['IB = IC / 10 = 50 mA', 'RB = (Vdrive − VBE) / IB;  Vdrive = 5 V, VBE = 0.9 V → RB = 82 Ω', 'P(transistor) = VCEsat · IC = 0.2 V · 0.5 A = 0.1 W (no heat sink)'] },
        { title: 'Linear stage: heat sink calculation', text: 'In linear operation the whole voltage difference falls across the transistor and becomes heat. Compute the power and the required thermal resistance of the heat sink.',
          circuit: ['Vin ── C   BD139 ── E ── Vout', '              B ── control'],
          formulas: ['P = (Vin − Vout) · IC', 'RthJA,total = (Tj,max − Tamb) / P', 'RthSA = RthJA,total − RthJC − RthCS', 'Example: 0.5 A, 12 V in, 5 V out: P = 3.5 W; with Tj = 125 °C, Tamb = 40 °C: 85 K / 3.5 W = 24 K/W → RthSA = 24 − 10 − 1 = 13 K/W'] }],
      order: [
        { type: 'TF-BD139', pkg: 'TO-126', note: 'standard' },
        { type: 'TF-BD139-10', pkg: 'TO-126', note: 'hFE group 63 to 160 at 150 mA' },
        { type: 'TF-BD139-16', pkg: 'TO-126', note: 'hFE group 100 to 250 at 150 mA' }],
      glossary: G(['amr', 'roc', 'ec', 'tc_cond', 'hfe', 'vcesat', 'vbe', 'ft', 'vceo', 'icbo', 'soa', 'ptot', 'tj', 'rthja', 'rthjc', 'heatsink', 'derating', 'pkg', 'pin'])
    });
  })();

  /* ========================================================================
     7) TF-2N7000  N-Kanal-MOSFET (Kleinsignal)
     ======================================================================== */
  (function () {
    var P = { K: 0.35, th: 0.35, lam: 0.03, rc: 0.5 };
    var VTH = 2.0;
    function id(vgs, vds, dT) {
      var p = P;
      if (dT) p = { K: P.K * Math.pow((298.15 + dT) / 298.15, -1.5), th: P.th, lam: P.lam, rc: P.rc * Math.pow((298.15 + dT) / 298.15, 1.8) };
      return mosId(p, vgs, vds, VTH - 4e-3 * dT);
    }
    var vds = [0, 0.1, 0.2, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 10];
    var vg = [3, 3.5, 4, 5, 6, 8];
    var vgsT = [0, 1, 1.5, 2, 2.1, 2.2, 2.4, 2.6, 3, 3.5, 4, 5, 6, 8, 10];
    var vgsR = [3, 3.5, 4, 4.5, 5, 6, 8, 10, 15];
    LIB.add({
      id: 'tf-2n7000', part: 'TF-2N7000', family: 'MOSFET', mfr: MFR, lang: 'en', ref: '2N7000',
      title: 'N-channel enhancement mode MOSFET, 60 V, 200 mA',
      desc: 'Small N-channel power MOSFET in a TO-92 package for switching loads up to a few hundred milliamperes directly from logic outputs. The gate is insulated, so the static gate current is practically zero.',
      notes: NOTE_DE, notesEn: NOTE_EN,
      features: ['Drain-source voltage 60 V', 'Continuous drain current 200 mA, pulsed 500 mA', 'RDS(on) 5 Ω maximum at VGS = 10 V', 'Gate threshold voltage 0.8 V to 3 V', 'Fast switching, about 10 ns', 'Built-in body diode'],
      pins: { pkg: 'TO-92', pins: [
        { n: 1, name: 'S', type: 'io', desc: 'Source' },
        { n: 2, name: 'G', type: 'in', desc: 'Gate' },
        { n: 3, name: 'D', type: 'io', desc: 'Drain' }] },
      abs: [
        { key: 'vds', param: 'Drain-source voltage', sym: 'VDS', cond: '', min: null, max: 60, unit: 'V', note: '' },
        { key: 'vdgr', param: 'Drain-gate voltage', sym: 'VDGR', cond: 'RGS ≤ 1 MΩ', min: null, max: 60, unit: 'V', note: '' },
        { key: 'vgs', param: 'Gate-source voltage, continuous', sym: 'VGS', cond: '', min: -20, max: 20, unit: 'V', note: '' },
        { key: 'vgsm', param: 'Gate-source voltage, non-repetitive', sym: 'VGSM', cond: 'tp < 50 µs', min: -40, max: 40, unit: 'V', note: '' },
        { key: 'id', param: 'Drain current, continuous', sym: 'ID', cond: 'Tamb = 25 °C', min: null, max: 200, unit: 'mA', note: '' },
        { key: 'idm', param: 'Drain current, pulsed', sym: 'IDM', cond: 'tp ≤ 10 µs, low duty cycle', min: null, max: 500, unit: 'mA', note: '' },
        { key: 'ptot', param: 'Total power dissipation', sym: 'Ptot', cond: 'Tamb = 25 °C', min: null, max: 400, unit: 'mW', note: 'derate 3.2 mW/K above 25 °C' },
        { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: null, max: 150, unit: '°C', note: '' },
        { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -55, max: 150, unit: '°C', note: '' }],
      rec: [
        { key: 'vds', param: 'Drain-source voltage', sym: 'VDS', min: 0, max: 50, unit: 'V' },
        { key: 'vgs', param: 'Gate-source voltage', sym: 'VGS', min: 0, max: 15, unit: 'V' },
        { key: 'id', param: 'Drain current', sym: 'ID', min: 0, max: 150, unit: 'mA' },
        { key: 'tamb', param: 'Ambient temperature', sym: 'Tamb', min: -40, max: 85, unit: '°C' }],
      elec: [
        { key: 'bvdss', param: 'Drain-source breakdown voltage', sym: 'V(BR)DSS', cond: 'VGS = 0 V, ID = 10 µA', min: 60, typ: null, max: null, unit: 'V', tj: 25 },
        { key: 'vgsth', param: 'Gate threshold voltage', sym: 'VGS(th)', cond: 'VDS = VGS, ID = 1 mA', min: 0.8, typ: 2.1, max: 3.0, unit: 'V', tj: 25 },
        { key: 'idss', param: 'Zero gate voltage drain current', sym: 'IDSS', cond: 'VDS = 48 V, VGS = 0 V', min: null, typ: 0.01, max: 1, unit: 'µA', tj: 25 },
        { key: 'igss', param: 'Gate-body leakage current', sym: 'IGSS', cond: 'VGS = ±15 V, VDS = 0 V', min: null, typ: 1, max: 10, unit: 'nA', tj: 25 },
        { key: 'rds10', param: 'Static drain-source on-resistance', sym: 'RDS(on)', cond: 'VGS = 10 V, ID = 500 mA', min: null, typ: 1.9, max: 5.0, unit: 'Ω', tj: 25 },
        { key: 'rds45', param: 'Static drain-source on-resistance', sym: 'RDS(on)', cond: 'VGS = 4.5 V, ID = 75 mA', min: null, typ: 2.6, max: 5.3, unit: 'Ω', tj: 25 },
        { key: 'gfs', param: 'Forward transconductance', sym: 'gfs', cond: 'VDS = 10 V, ID = 200 mA', min: 100, typ: 250, max: null, unit: 'mS', tj: 25 },
        { key: 'ciss', param: 'Input capacitance', sym: 'Ciss', cond: 'VDS = 25 V, VGS = 0 V, f = 1 MHz', min: null, typ: 20, max: 50, unit: 'pF', tj: 25 },
        { key: 'coss', param: 'Output capacitance', sym: 'Coss', cond: 'VDS = 25 V, VGS = 0 V, f = 1 MHz', min: null, typ: 11, max: 25, unit: 'pF', tj: 25 },
        { key: 'crss', param: 'Reverse transfer capacitance', sym: 'Crss', cond: 'VDS = 25 V, VGS = 0 V, f = 1 MHz', min: null, typ: 4, max: 5, unit: 'pF', tj: 25 },
        { key: 'ton', param: 'Turn-on time', sym: 'ton', cond: 'VDD = 15 V, ID = 500 mA, VGS = 10 V, RGEN = 25 Ω', min: null, typ: 6, max: 10, unit: 'ns', tj: 25 },
        { key: 'toff', param: 'Turn-off time', sym: 'toff', cond: 'VDD = 15 V, ID = 500 mA, VGS = 10 V, RGEN = 25 Ω', min: null, typ: 7, max: 10, unit: 'ns', tj: 25 },
        { key: 'vsd', param: 'Body diode forward voltage', sym: 'VSD', cond: 'VGS = 0 V, IS = 115 mA', min: null, typ: 0.88, max: 1.5, unit: 'V', tj: 25 }],
      graphs: [
        { id: 'id_vds', title: 'Drain current vs. drain-source voltage', xLabel: 'Drain-source voltage', xUnit: 'V', xScale: 'lin', yLabel: 'Drain current', yUnit: 'A', yScale: 'lin',
          series: vg.map(function (g) { return { name: 'VGS = ' + g + ' V', cond: 'Tj = 25 °C, tp = 300 µs, typical values', points: vds.map(function (v) { return [v, sg(id(g, v, 0), 4)]; }) }; }),
          note: 'Output characteristics (pulsed). The linear region on the left behaves like a resistor of RDS(on); the flat part is the saturation region.' },
        { id: 'id_vgs', title: 'Drain current vs. gate-source voltage', xLabel: 'Gate-source voltage', xUnit: 'V', xScale: 'lin', yLabel: 'Drain current', yUnit: 'A', yScale: 'lin',
          series: [
            { name: 'Tj = 25 °C', cond: 'VDS = 10 V, typical values', points: vgsT.map(function (g) { return [g, sg(id(g, 10, 0), 4)]; }) },
            { name: 'Tj = 125 °C', cond: 'VDS = 10 V, typical values', points: vgsT.map(function (g) { return [g, sg(id(g, 10, 100), 4)]; }) }],
          note: 'Transfer characteristics. The threshold voltage falls with temperature.' },
        { id: 'rds_vgs', title: 'On-resistance vs. gate-source voltage', xLabel: 'Gate-source voltage', xUnit: 'V', xScale: 'lin', yLabel: 'On-resistance', yUnit: 'Ω', yScale: 'lin',
          series: [{ name: 'Tj = 25 °C', cond: 'small VDS, typical values', points: vgsR.map(function (g) { return [g, sg(mosRds(P, g, VTH), 3)]; }) }],
          note: 'Drive with at least 4.5 V for a low resistance; at 2.5 V the device is not fully on.' },
        { id: 'ptot_t', title: 'Power dissipation vs. ambient temperature', xLabel: 'Ambient temperature', xUnit: '°C', xScale: 'lin', yLabel: 'Power dissipation', yUnit: 'W', yScale: 'lin',
          series: [{ name: 'Ptot', cond: 'free air', points: mk([-55, 0, 25, 50, 75, 100, 125, 150], function (t) { return Math.min(0.4, 0.4 * (150 - t) / 125); }, 4, 3) }],
          note: '' }],
      thermal: { rthJA: 312.5, tjMax: 150, ptotMax: 0.4, note: 'Ptot = (150 − 25) K / 312.5 K/W = 0.4 W at Tamb = 25 °C, free air. Conduction loss: P = ID² · RDS(on); RDS(on) rises with temperature.' },
      pkgDraw: { name: 'TO-92 (plastic)', kind: 'to92', dims: [
        dim('A', 4.32, 5.33, 'mm', 'body height'), dim('B', 4.45, 5.20, 'mm', 'body width'),
        dim('C', 3.18, 4.19, 'mm', 'body thickness'), dim('L', 12.7, null, 'mm', 'lead length (min)'),
        dim('e', 2.44, 2.64, 'mm', 'pitch of outer leads'), dim('d', 0.38, 0.55, 'mm', 'lead width')] },
      app: [
        { title: 'Low-side switch with gate resistor and pull-down', text: 'A logic output drives the gate. A series resistor RG limits the charging current of the input capacitance and damps ringing. A pull-down resistor keeps the gate low while the output is undefined. Use a flyback diode for inductive loads.',
          circuit: ['+U ──┬──[Load]──┬── D', '      └──▲|──────┘', 'MCU ──[ RG ]──┬── G  2N7000', '              [ RGS ]  S ── GND', '               GND'],
          formulas: ['RG ≈ 100 Ω, RGS = 10 kΩ…100 kΩ', 'Gate rise time tr ≈ 2.2 · RG · Ciss = 2.2 · 100 Ω · 20 pF ≈ 4.4 ns (plus driver slew)', 'Loss in the MOSFET: P = ID² · RDS(on) = (0.1 A)² · 2.6 Ω = 26 mW at VGS = 4.5 V', 'Choose VGS ≥ 4.5 V; with 3.3 V the 2N7000 is not reliably on (VGS(th) up to 3 V!)'] }],
      order: [
        { type: 'TF-2N7000', pkg: 'TO-92', note: 'bulk' },
        { type: 'TF-2N7000-T', pkg: 'TO-92', note: 'on tape' },
        { type: 'TF-2N7002', pkg: 'SOT-23', note: 'surface-mount variant, 115 mA, separate data' }],
      glossary: G(['amr', 'roc', 'ec', 'tc_cond', 'rds', 'vth', 'gfs', 'ciss', 'ton', 'bodydiode', 'idss', 'gatedrive', 'ptot', 'tj', 'rthja', 'pulsed', 'pkg', 'pin', 'freewheel'])
    });
  })();

  /* ========================================================================
     8) TF-IRLZ  Logik-Level-Leistungs-MOSFET TO-220
     ======================================================================== */
  (function () {
    var P = { K: 22.57, th: 0.2366, lam: 0.02, rc: 0.012 };
    var VTH = 1.97;
    function id(vgs, vds, dT) {
      var p = P;
      if (dT) p = { K: P.K * Math.pow((298.15 + dT) / 298.15, -1.5), th: P.th, lam: P.lam, rc: P.rc * Math.pow((298.15 + dT) / 298.15, 2.0) };
      return mosId(p, vgs, vds, VTH - 3.3e-3 * dT);
    }
    var vds = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1, 1.5, 2, 3, 4];
    var vg = [2.5, 3, 3.5, 4, 4.5, 5];
    var vgsT = [1.5, 1.8, 2, 2.2, 2.5, 3, 3.5, 4, 4.5, 5, 6];
    var vgsR = [2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 10];
    var tcs = [25, 40, 50, 75, 100, 125, 150, 175];
    LIB.add({
      id: 'tf-irlz', part: 'TF-IRLZ34', family: 'MOSFET', mfr: MFR, lang: 'en', ref: 'IRLZ34N',
      title: 'Logic-level power MOSFET, 55 V, 30 A, TO-220',
      desc: 'N-channel power MOSFET that is fully switched on with 4.5 V to 5 V at the gate, so it can be driven directly from a microcontroller output. Typical uses are PWM motor and lamp drivers and load switches.',
      notes: NOTE_DE, notesEn: NOTE_EN,
      features: ['Drain-source voltage 55 V', 'Continuous drain current 30 A (case 25 °C)', 'RDS(on) 0.05 Ω maximum at VGS = 4.5 V', 'Logic-level gate: fully on at 4.5 V', 'Fast switching, avalanche tested', 'TO-220 with metal tab (connected to the drain)'],
      pins: { pkg: 'TO-220', pins: [
        { n: 1, name: 'G', type: 'in', desc: 'Gate' },
        { n: 2, name: 'D', type: 'io', desc: 'Drain (also the metal tab)' },
        { n: 3, name: 'S', type: 'io', desc: 'Source' }] },
      abs: [
        { key: 'vds', param: 'Drain-source voltage', sym: 'VDS', cond: '', min: null, max: 55, unit: 'V', note: '' },
        { key: 'vgs', param: 'Gate-source voltage', sym: 'VGS', cond: '', min: -16, max: 16, unit: 'V', note: 'logic level: never above 16 V' },
        { key: 'id25', param: 'Drain current, continuous', sym: 'ID', cond: 'Tcase = 25 °C, VGS = 5 V', min: null, max: 30, unit: 'A', note: 'limited by the package' },
        { key: 'id100', param: 'Drain current, continuous', sym: 'ID', cond: 'Tcase = 100 °C, VGS = 5 V', min: null, max: 21, unit: 'A', note: '' },
        { key: 'idm', param: 'Drain current, pulsed', sym: 'IDM', cond: 'tp ≤ 80 µs', min: null, max: 100, unit: 'A', note: '' },
        { key: 'ptot', param: 'Total power dissipation', sym: 'Ptot', cond: 'Tcase = 25 °C', min: null, max: 68, unit: 'W', note: 'derate 0.45 W/K above 25 °C; needs a heat sink' },
        { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: -55, max: 175, unit: '°C', note: '' },
        { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -55, max: 175, unit: '°C', note: '' },
        { key: 'tsol', param: 'Soldering temperature', sym: 'Tsol', cond: '1.6 mm from the case, 10 s', min: null, max: 300, unit: '°C', note: '' }],
      rec: [
        { key: 'vds', param: 'Drain-source voltage', sym: 'VDS', min: 0, max: 44, unit: 'V' },
        { key: 'vgs', param: 'Gate-source voltage (drive)', sym: 'VGS', min: 4.5, max: 10, unit: 'V' },
        { key: 'id', param: 'Drain current', sym: 'ID', min: 0, max: 20, unit: 'A' },
        { key: 'tj', param: 'Junction temperature', sym: 'Tj', min: -40, max: 150, unit: '°C' }],
      elec: [
        { key: 'bvdss', param: 'Drain-source breakdown voltage', sym: 'V(BR)DSS', cond: 'VGS = 0 V, ID = 250 µA', min: 55, typ: null, max: null, unit: 'V', tj: 25 },
        { key: 'vgsth', param: 'Gate threshold voltage', sym: 'VGS(th)', cond: 'VDS = VGS, ID = 250 µA', min: 1.0, typ: 1.6, max: 2.0, unit: 'V', tj: 25 },
        { key: 'idss', param: 'Zero gate voltage drain current', sym: 'IDSS', cond: 'VDS = 55 V, VGS = 0 V', min: null, typ: 0.5, max: 25, unit: 'µA', tj: 25 },
        { key: 'igss', param: 'Gate-body leakage current', sym: 'IGSS', cond: 'VGS = ±16 V', min: -100, typ: null, max: 100, unit: 'nA', tj: 25 },
        { key: 'rds10', param: 'Static drain-source on-resistance', sym: 'RDS(on)', cond: 'VGS = 10 V, ID = 16 A', min: null, typ: 0.028, max: 0.035, unit: 'Ω', tj: 25 },
        { key: 'rds5', param: 'Static drain-source on-resistance', sym: 'RDS(on)', cond: 'VGS = 5 V, ID = 16 A', min: null, typ: 0.037, max: 0.046, unit: 'Ω', tj: 25 },
        { key: 'rds45', param: 'Static drain-source on-resistance', sym: 'RDS(on)', cond: 'VGS = 4.5 V, ID = 14 A', min: null, typ: 0.040, max: 0.050, unit: 'Ω', tj: 25 },
        { key: 'gfs', param: 'Forward transconductance', sym: 'gfs', cond: 'VDS = 25 V, ID = 16 A', min: 10, typ: 16, max: null, unit: 'S', tj: 25 },
        { key: 'ciss', param: 'Input capacitance', sym: 'Ciss', cond: 'VDS = 25 V, VGS = 0 V, f = 1 MHz', min: null, typ: 880, max: null, unit: 'pF', tj: 25 },
        { key: 'qg', param: 'Total gate charge', sym: 'Qg', cond: 'VGS = 5 V, ID = 16 A, VDS = 44 V', min: null, typ: 25, max: 35, unit: 'nC', tj: 25 },
        { key: 'tdon', param: 'Turn-on delay time', sym: 'td(on)', cond: 'VDD = 28 V, ID = 16 A, RG = 4.5 Ω, VGS = 5 V', min: null, typ: 12, max: null, unit: 'ns', tj: 25 },
        { key: 'tr', param: 'Rise time', sym: 'tr', cond: 'VDD = 28 V, ID = 16 A, RG = 4.5 Ω, VGS = 5 V', min: null, typ: 100, max: null, unit: 'ns', tj: 25 },
        { key: 'tdoff', param: 'Turn-off delay time', sym: 'td(off)', cond: 'VDD = 28 V, ID = 16 A, RG = 4.5 Ω, VGS = 5 V', min: null, typ: 28, max: null, unit: 'ns', tj: 25 },
        { key: 'tf', param: 'Fall time', sym: 'tf', cond: 'VDD = 28 V, ID = 16 A, RG = 4.5 Ω, VGS = 5 V', min: null, typ: 45, max: null, unit: 'ns', tj: 25 },
        { key: 'vsd', param: 'Body diode forward voltage', sym: 'VSD', cond: 'IS = 16 A, VGS = 0 V', min: null, typ: 0.95, max: 1.3, unit: 'V', tj: 25 }],
      graphs: [
        { id: 'id_vds', title: 'Drain current vs. drain-source voltage', xLabel: 'Drain-source voltage', xUnit: 'V', xScale: 'lin', yLabel: 'Drain current', yUnit: 'A', yScale: 'lin',
          series: vg.map(function (g) { return { name: 'VGS = ' + g + ' V', cond: 'Tj = 25 °C, tp = 80 µs, typical values', points: vds.map(function (v) { return [v, sg(id(g, v, 0), 4)]; }) }; }),
          note: 'Output characteristics (pulsed, 80 µs). In the linear region the device acts as a resistor RDS(on).' },
        { id: 'id_vgs', title: 'Drain current vs. gate-source voltage', xLabel: 'Gate-source voltage', xUnit: 'V', xScale: 'lin', yLabel: 'Drain current', yUnit: 'A', yScale: 'lin',
          series: [
            { name: 'Tj = 25 °C', cond: 'VDS = 15 V, tp = 80 µs, typical values', points: vgsT.map(function (g) { return [g, sg(id(g, 15, 0), 4)]; }) },
            { name: 'Tj = 175 °C', cond: 'VDS = 15 V, tp = 80 µs, typical values', points: vgsT.map(function (g) { return [g, sg(id(g, 15, 150), 4)]; }) }],
          note: 'Transfer characteristics: at 2 V almost nothing flows, at 4.5 V the channel is open.' },
        { id: 'rds_vgs', title: 'On-resistance vs. gate-source voltage', xLabel: 'Gate-source voltage', xUnit: 'V', xScale: 'lin', yLabel: 'On-resistance', yUnit: 'Ω', yScale: 'lin',
          series: [
            { name: 'Tj = 25 °C', cond: 'small VDS, typical values', points: vgsR.map(function (g) { return [g, sg(mosRds(P, g, VTH), 3)]; }) },
            { name: 'Tj = 125 °C', cond: 'small VDS, typical values', points: vgsR.map(function (g) { return [g, sg(1.65 * mosRds(P, g, VTH), 3)]; }) }],
          note: 'At 125 °C the on-resistance is about 1.65 times the value at 25 °C: always calculate the loss with the hot value.' },
        { id: 'id_tc', title: 'Maximum drain current vs. case temperature', xLabel: 'Case temperature', xUnit: '°C', xScale: 'lin', yLabel: 'Drain current', yUnit: 'A', yScale: 'lin',
          series: [{ name: 'VGS = 5 V', cond: 'DC', points: tcs.map(function (t) { return [t, sg(30 * Math.sqrt((175 - t) / 150), 3)]; }) }],
          note: 'Derating curve: the usable current falls with the case temperature because the power loss heats the chip.' }],
      thermal: { rthJA: 62, rthJC: 2.2, tjMax: 175, ptotMax: 2.4, ptotMaxCase: 68, note: 'Free air: Ptot = (175 − 25) K / 62 K/W = 2.4 W. With a perfect heat sink (case 25 °C): (175 − 25) K / 2.2 K/W = 68 W. Heat sink: RthSA = (Tj − Tamb) / P − RthJC − RthCS; RthCS about 0.5 K/W with thermal grease, 1.5 K/W or more with an insulating pad.' },
      pkgDraw: { name: 'TO-220AB', kind: 'to220', dims: [
        dim('A', 14.48, 15.75, 'mm', 'body height including tab'), dim('B', 9.65, 10.29, 'mm', 'body width'),
        dim('C', 4.06, 4.82, 'mm', 'body thickness'), dim('L', 12.70, 14.27, 'mm', 'lead length'),
        dim('e', 2.54, 2.54, 'mm', 'lead pitch'), dim('d', 0.64, 0.91, 'mm', 'lead width'),
        dim('ØH', 3.54, 4.09, 'mm', 'mounting hole diameter')] },
      app: [
        { title: 'PWM motor switch with heat sink calculation', text: 'The MOSFET switches a 12 V motor at 10 A. Because RDS(on) rises with temperature, calculate the conduction loss with the hot value. The loss at the chip decides whether a heat sink is needed. Place a flyback diode across the motor.',
          circuit: ['+12 V ──┬──[ Motor ]──┬── D', '         └──▲|─────────┘', 'PWM ──[ RG ]──┬── G   IRLZ', '            [ 10k ]    S ── GND', '             GND'],
          formulas: ['RDS(on),hot = 1.65 · RDS(on),25 °C = 1.65 · 0.028 Ω ≈ 0.046 Ω', 'P(cond) = ID² · RDS(on),hot = (10 A)² · 0.046 Ω = 4.6 W', 'Free air: Tj = Tamb + P · RthJA = 40 °C + 4.6 W · 62 K/W = 325 °C → impossible, heat sink needed', 'RthJA,total ≤ (125 °C − 40 °C) / 4.6 W = 18.5 K/W → RthSA ≤ 18.5 − 2.2 − 0.5 ≈ 15.8 K/W', 'Gate: IG,peak ≈ Qg / tsw = 25 nC / 100 ns = 250 mA → RG ≈ (5 V − 2.5 V) / 250 mA = 10 Ω'] }],
      order: [
        { type: 'TF-IRLZ34', pkg: 'TO-220AB', note: 'standard' },
        { type: 'TF-IRLZ34-I', pkg: 'TO-220 FullPAK', note: 'insulated tab, lower current rating (separate data)' }],
      glossary: G(['amr', 'roc', 'ec', 'tc_cond', 'rds', 'vth', 'gfs', 'ciss', 'qg', 'ton', 'bodydiode', 'logiclevel', 'gatedrive', 'ptot', 'tj', 'rthja', 'rthjc', 'heatsink', 'derating', 'pulsed', 'pkg', 'pin'])
    });
  })();

  if (typeof module !== 'undefined' && module.exports) module.exports = LIB;
})();
