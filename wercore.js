'use strict';
/* Tonfunk Werkstoff-Lab: reine Logik (ohne Oberfläche, auch per Node testbar).
   Inhalt: Zugversuch (Spannung, Dehnung, Bruchdehnung, Hooke, Spannungs-Dehnungs-Kurven, Ablesen von Re/Rp0,2/Rm/A/E),
   Härteprüfung (HBW, HV, HRC, Rm aus HB, Näherung HRC-HV), Werkstoffbezeichnungen (DIN EN 10027-1, Decoder),
   vereinfachtes Eisen-Kohlenstoff-Diagramm (Stahlseite), Anlassdiagramm (qualitativ), Werkstoffwahl (Punktebewertung),
   Zufallsaufgaben (seed-fähig) und Antwortprüfung.
   Alle Kennwerte sind Übungswerte (siehe werdata.js). Export: window.WER_CORE bzw. module.exports (Node). */
(function (root) {
  const fin = v => typeof v === 'number' && isFinite(v);
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f) / f; };

  /* ---------------- Zahlen deutsch ---------------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NaN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(N\/mm²|N\/mm2|MPa|mm|µm|um|%|°C|kN|N|HBW|HV|HRC)$/i, '').replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NaN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtDe(v, dec, sign) {
    if (!fin(v)) return '–';
    dec = dec == null ? 2 : dec;
    let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    if (sign && v > 0) s = '+' + s;
    return s.replace('-', '−').replace('.', ',');
  }
  /* kurze Schreibweise ohne unnötige Nullen: 1.25 -> "1,25" */
  const nd = (v, dec) => { const s = fmtDe(v, dec == null ? 2 : dec); return s.indexOf(',') < 0 ? s : s.replace(/0+$/, '').replace(/,$/, ''); };

  /* ---------------- Zufall (seed-fähig) ---------------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];

  /* ============================================================ Zugversuch: Rechnung */
  const circleArea = d => Math.PI * d * d / 4;                 /* mm -> mm² */
  const stress = (F, S0) => F / S0;                            /* N, mm² -> N/mm² */
  const strainPct = (dL, L0) => dL / L0 * 100;                 /* mm, mm -> % */
  const elongationA = (L0, Lu) => (Lu - L0) / L0 * 100;        /* A in % */
  const hookeStress = (E, epsPct) => E * epsPct / 100;         /* N/mm², % -> N/mm² */
  const hookeStrainPct = (E, sigma) => sigma / E * 100;        /* % */
  const modulusE = (dSigma, dEpsPct) => dSigma / (dEpsPct / 100);
  const maxForce = (Rm, S0) => Rm * S0;                        /* N */
  const sigmaPerm = (Re, S) => Re / S;
  const Lu = (L0, A) => L0 * (1 + A / 100);

  /* ============================================================ Kurven */
  /* Werkstoff m: {type:'re'|'rp'|'sprod', E, Re|Rp, Rm, Ag, A}; Dehnung in %, Spannung in N/mm².
     're' : ausgeprägte Streckgrenze (obere Streckgrenze ReH = Re, kurzes Fließplateau mit unterer Streckgrenze 0,96*Re).
     'rp' : keine ausgeprägte Streckgrenze, Dehngrenze Rp0,2 (Ramberg-Osgood, Exponent so gewählt, dass bei Rm genau Ag erreicht wird).
     'sprod': spröder Bruch ohne Einschnürung (Parabel, Maximum = Bruch).
     Nach Ag (Höchstkraft) folgt die Einschnürung: technische Spannung fällt bis zum Bruch bei A (elastische Rückfederung vernachlässigt). */
  const NECK_DROP = { re: 0.22, rp: 0.2, sprod: 0 };
  function curvePoints(m) {
    const E = m.E, pts = [];
    const neck = (e0, s0, e1) => { const n = 40; for (let i = 1; i <= n; i++) { const y = i / n; pts.push([e0 + (e1 - e0) * y, s0 * (1 - (m.neck == null ? NECK_DROP[m.type] : m.neck) * y * y)]); } };
    if (m.type === 'sprod') {
      const n = 80, A = m.A;   /* sigma = E*e - E/(2*A)*e² mit e als Verhältnis (nicht %), Maximum bei e = A */
      for (let i = 0; i <= n; i++) { const e = A * i / n, er = e / 100; pts.push([e, E * er - (E / (2 * (A / 100))) * er * er]); }
      return pts;
    }
    if (m.type === 're') {
      const Re = m.Re, eY = Re / E * 100, ReL = 0.96 * Re, eL = eY + (m.lueders || 1.8);
      pts.push([0, 0]); pts.push([eY, Re]); pts.push([eY + 0.04, ReL]);
      for (let i = 1; i <= 24; i++) { const e = eY + 0.04 + (eL - eY - 0.04) * i / 24; pts.push([e, ReL + 0.012 * Re * Math.sin(i * 1.7) * (i < 24 ? 1 : 0)]); }
      const n = 120;
      for (let i = 1; i <= n; i++) { const x = i / n; pts.push([eL + (m.Ag - eL) * x, ReL + (m.Rm - ReL) * (1 - Math.pow(1 - x, 2.2))]); }
      neck(m.Ag, m.Rm, m.A);
      return pts;
    }
    /* 'rp': Ramberg-Osgood, Parameter über die Spannung */
    const Rp = m.Rp, n = Math.log((m.Ag - m.Rm / E * 100) / 0.2) / Math.log(m.Rm / Rp), N = 160;
    for (let i = 0; i <= N; i++) { const s = m.Rm * i / N; pts.push([s / E * 100 + 0.2 * Math.pow(s / Rp, n), s]); }
    pts[pts.length - 1][0] = m.Ag;
    neck(m.Ag, m.Rm, m.A);
    return pts;
  }
  const _cache = new Map();
  function curve(m) { let c = _cache.get(m); if (!c) { c = curvePoints(m); _cache.set(m, c); } return c; }
  /* Spannung bei Dehnung eps (%): lineare Interpolation; NaN außerhalb 0..A */
  function sigmaAt(m, eps) {
    const p = curve(m); if (!(eps >= 0) || eps > m.A + 1e-12) return NaN;
    let lo = 0, hi = p.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (p[mid][0] <= eps) lo = mid; else hi = mid; }
    const a = p[lo], b = p[hi]; if (b[0] === a[0]) return b[1];
    return a[1] + (b[1] - a[1]) * (eps - a[0]) / (b[0] - a[0]);
  }
  /* Phase (Text) bei Dehnung */
  function phaseAt(m, eps) {
    if (eps >= m.A - 1e-9) return 'bruch';
    if (m.type === 'sprod') return eps <= 0 ? 'ruhe' : 'elastisch';
    if (eps <= 0) return 'ruhe';
    if (m.type === 're') { const eY = m.Re / m.E * 100; if (eps <= eY) return 'elastisch'; if (eps <= eY + (m.lueders || 1.8)) return 'fliessen'; }
    else if (sigmaAt(m, eps) <= 0.8 * m.Rp) return 'elastisch';
    return eps <= m.Ag ? 'verfestigung' : 'einschnuerung';
  }
  /* Kennwerte aus der Kurve selbst ablesen (numerisch, unabhängig von den Angaben im Werkstoff) */
  function readFromCurve(m) {
    const p = curve(m); let Rm = 0, eRm = 0; p.forEach(q => { if (q[1] > Rm) { Rm = q[1]; eRm = q[0]; } });
    const res = { Rm: Rm, Ag: eRm, A: p[p.length - 1][0] };
    const e1 = m.type === 'sprod' ? m.A * 0.02 : 0.1 * (m.Re || m.Rp) / m.E * 100;
    res.E = (sigmaAt(m, e1) - sigmaAt(m, 0)) / (e1 / 100);
    if (m.type === 're') { let h = 0; p.forEach(q => { if (q[0] <= m.Re / m.E * 100 + 0.05 && q[1] > h) h = q[1]; }); res.ReH = h; }
    if (m.type === 'rp') {
      let e = 0.2; const step = 0.0005; while (e < m.A && sigmaAt(m, e) > m.E * (e - 0.2) / 100) e += step;
      res.Rp02 = m.E * (e - 0.2) / 100;
    }
    return res;
  }
  /* Toleranz beim Ablesen im Diagramm (Beschriftung 50er-Raster -> Lesetoleranz) */
  function readTol(q, truth) {
    if (q === 'A') return Math.max(1, 0.05 * truth);          /* %-Punkte */
    if (q === 'E') return 0.06 * truth;                       /* aus dem Anstieg nur grob */
    return Math.max(10, 0.04 * truth);                        /* Re, Rp0,2, Rm in N/mm² */
  }
  function checkReading(m, q, given) {
    const truth = { Re: m.Re, Rp02: m.Rp, Rm: m.Rm, A: m.A, E: m.E }[q], v = parseDe(given);
    if (truth == null) return { ok: false, na: true };
    if (!fin(v)) return { empty: true, ok: false, truth };
    const tol = readTol(q, truth);
    return { ok: Math.abs(v - truth) <= tol + 1e-9, truth, tol, diff: v - truth };
  }

  /* ============================================================ Härteprüfung */
  const G = 9.80665;
  const brinellForce = (X, D) => X * D * D * G;          /* N; X = Prüfkraftkennzahl 0,102*F/D² */
  const hbw = (D, F, d) => (d >= D || d <= 0) ? NaN : 0.102 * 2 * F / (Math.PI * D * (D - Math.sqrt(D * D - d * d)));
  const brinellValid = (D, d) => d >= 0.24 * D - 1e-9 && d <= 0.6 * D + 1e-9;
  const hv = (F, d) => 0.1891 * F / (d * d);              /* F in N, d = Mittel der Diagonalen in mm */
  const hrc = h => 100 - h / 0.002;                       /* h = bleibende Eindringtiefe in mm */
  const hrcDepth = c => (100 - c) * 0.002;
  const rmFromHB = hb => 3.5 * hb;
  /* Näherungstabelle HRC -> HV (gerundete Richtwerte, Umwertung nach DIN EN ISO 18265, bitte im Tabellenbuch gegenprüfen) */
  const HRC_HV = [[20, 238], [30, 302], [40, 392], [50, 513], [60, 697]];   /* PRUEFEN */
  function hrcToHv(c) {
    if (c < 20 || c > 60) return NaN;
    for (let i = 0; i < HRC_HV.length - 1; i++) { const a = HRC_HV[i], b = HRC_HV[i + 1]; if (c >= a[0] && c <= b[0]) return a[1] + (b[1] - a[1]) * (c - a[0]) / (b[0] - a[0]); }
    return NaN;
  }

  /* ============================================================ Werkstoffbezeichnungen (DIN EN 10027-1) */
  const FACTOR = { Cr: 4, Co: 4, Mn: 4, Ni: 4, Si: 4, W: 4, Al: 10, Be: 10, Cu: 10, Mo: 10, Nb: 10, Pb: 10, Ta: 10, Ti: 10, V: 10, Zr: 10, C: 100, Ce: 100, N: 100, P: 100, S: 100, B: 1000 };
  const ELN = { Cr: 'Chrom', Mn: 'Mangan', Ni: 'Nickel', Mo: 'Molybdän', V: 'Vanadium', Si: 'Silizium', W: 'Wolfram', Co: 'Kobalt', Ti: 'Titan', Al: 'Aluminium', Cu: 'Kupfer', Nb: 'Niob', B: 'Bor', S: 'Schwefel', Pb: 'Blei', P: 'Phosphor', N: 'Stickstoff' };
  const KERB = { JR: 'Kerbschlagarbeit 27 J bei +20 °C', J0: 'Kerbschlagarbeit 27 J bei 0 °C', J2: 'Kerbschlagarbeit 27 J bei −20 °C', K2: 'Kerbschlagarbeit 40 J bei −20 °C' };
  const AL_SERIES = { 1: 'Reinaluminium (mind. 99 % Al)', 2: 'AlCu (Kupfer)', 3: 'AlMn (Mangan)', 4: 'AlSi (Silizium)', 5: 'AlMg (Magnesium)', 6: 'AlMgSi (Magnesium und Silizium)', 7: 'AlZn (Zink)' };
  const GROUPS = {
    bau: 'Baustahl (unlegiert, nach Verwendung und Streckgrenze)',
    unleg: 'Unlegierter Stahl nach C-Gehalt (z. B. Vergütungs- oder Einsatzstahl)',
    nied: 'Niedrig legierter Stahl (jedes Legierungselement unter 5 %)',
    hoch: 'Hoch legierter Stahl (mindestens ein Element 5 % oder mehr)',
    auto: 'Automatenstahl (Schwefel für gute Zerspanbarkeit)',
    guss: 'Gusseisen',
    alu: 'Aluminium-Knetlegierung'
  };
  const elemList = str => str.match(/[A-Z][a-z]?/g) || [];
  function decode(name) {
    const s = String(name == null ? '' : name).trim().replace(/\s+/g, ' '), parts = [], data = {};
    const bad = msg => ({ ok: false, name: s, error: msg });
    if (!s) return bad('Bitte einen Kurznamen eingeben, zum Beispiel S235JR.');
    let m;
    if ((m = /^EN[ -]AW[ -](\d)(\d{3})(?: ?([A-Z]\d{1,2}))?$/.exec(s))) {
      parts.push({ t: 'EN AW', txt: 'Europäische Norm, Aluminium (Aluminium Wrought = Knetwerkstoff)' }, { t: m[1] + m[2], txt: 'Legierungsnummer, die erste Ziffer gibt die Legierungsgruppe: ' + (AL_SERIES[m[1]] || 'unbekannt') });
      if (m[3]) parts.push({ t: m[3], txt: m[3] === 'T6' ? 'Werkstoffzustand T6: lösungsgeglüht und warm ausgelagert (ausgehärtet)' : 'Werkstoffzustand ' + m[3] });
      return { ok: true, name: s, group: 'alu', groupLabel: GROUPS.alu, parts, data: { series: +m[1], system: AL_SERIES[m[1]] } };
    }
    if ((m = /^EN[ -]GJ([LS])-(\d{2,4})(?:-(\d{1,2}))?$/.exec(s))) {
      const L = m[1] === 'L';
      parts.push({ t: 'EN-GJ', txt: 'Europäische Norm, Gusseisen (G = Guss, J = Eisen)' }, { t: m[1], txt: L ? 'Lamellengraphit (Grauguss): spröde, gut dämpfend, gut gießbar' : 'Kugelgraphit (Sphäroguss): deutlich zäher als Grauguss' });
      parts.push({ t: m[2], txt: 'Mindest-Zugfestigkeit Rm = ' + m[2] + ' N/mm²' });
      data.type = m[1]; data.Rm = +m[2];
      if (m[3]) { parts.push({ t: m[3], txt: 'Mindest-Bruchdehnung A = ' + m[3] + ' %' }); data.A = +m[3]; }
      else if (!L) return bad('Bei Kugelgraphitguss folgt nach der Zugfestigkeit die Bruchdehnung, zum Beispiel EN-GJS-400-15.');
      return { ok: true, name: s, group: 'guss', groupLabel: GROUPS.guss, parts, data };
    }
    if ((m = /^([SEP])(\d{3})([A-Z0-9+]*)$/.exec(s))) {
      parts.push({ t: m[1], txt: { S: 'Stahl für den Stahlbau', E: 'Stahl für den Maschinenbau', P: 'Stahl für den Druckbehälterbau' }[m[1]] }, { t: m[2], txt: 'Mindest-Streckgrenze Re = ' + m[2] + ' N/mm² (für die kleinste Erzeugnisdicke)' });
      data.Re = +m[2]; data.use = m[1];
      if (m[3]) { const k = /^(J0|J2|JR|K2)/.exec(m[3]); if (k) { parts.push({ t: k[1], txt: KERB[k[1]] }); data.kerb = k[1]; } const r = m[3].slice(k ? k[1].length : 0); if (r) parts.push({ t: r, txt: 'Zusatzsymbol (zum Beispiel Lieferzustand)' }); }
      return { ok: true, name: s, group: 'bau', groupLabel: GROUPS.bau, parts, data };
    }
    if ((m = /^C(\d{2,3})(E|R|S|D)?$/.exec(s))) {
      parts.push({ t: 'C', txt: 'unlegierter Stahl mit Mangangehalt unter 1 %' }, { t: m[1], txt: 'Kohlenstoffgehalt: ' + m[1] + ' / 100 = ' + nd(+m[1] / 100) + ' % C' });
      data.C = +m[1] / 100;
      if (m[2]) parts.push({ t: m[2], txt: { E: 'vorgeschriebener höchster Schwefelgehalt', R: 'vorgeschriebener Schwefelbereich', S: 'für Federn', D: 'für Drahtziehen' }[m[2]] });
      return { ok: true, name: s, group: 'unleg', groupLabel: GROUPS.unleg, parts, data };
    }
    if ((m = /^X(\d{1,3})((?:[A-Z][a-z]?)+)(\d+(?:-\d+)*)$/.exec(s))) {
      const els = elemList(m[2]), nums = m[3].split('-').map(Number);
      parts.push({ t: 'X', txt: 'hoch legierter Stahl (mindestens ein Legierungselement mit 5 % oder mehr)' }, { t: m[1], txt: 'Kohlenstoffgehalt: ' + m[1] + ' / 100 = ' + nd(+m[1] / 100) + ' % C' });
      data.C = +m[1] / 100; data.el = {};
      els.forEach((e, i) => { parts.push({ t: e, txt: ELN[e] || e }); if (nums[i] != null) data.el[e] = nums[i]; });
      parts.push({ t: m[3], txt: 'Gehalte in Prozent in der Reihenfolge der Elemente: ' + els.map((e, i) => e + (nums[i] != null ? ' ' + nums[i] + ' %' : '')).join(', ') });
      return { ok: true, name: s, group: 'hoch', groupLabel: GROUPS.hoch, parts, data };
    }
    if ((m = /^(\d{2,3})((?:[A-Z][a-z]?)+)(\d+(?:-\d+)*)$/.exec(s))) {
      const els = elemList(m[2]), nums = m[3].split('-').map(Number), f0 = FACTOR[els[0]];
      if (!els.every(e => FACTOR[e])) return bad('Ein Legierungselement im Namen ist unbekannt.');
      parts.push({ t: m[1], txt: 'Kohlenstoffgehalt: ' + m[1] + ' / 100 = ' + nd(+m[1] / 100) + ' % C' });
      data.C = +m[1] / 100; data.el = els;
      els.forEach(e => parts.push({ t: e, txt: ELN[e] }));
      const first = nums[0] / f0; data.first = { el: els[0], pct: first };
      parts.push({ t: m[3], txt: 'Kennzahl ' + nums[0] + ' gehört zum ersten Element ' + els[0] + ': ' + nums[0] + ' / ' + f0 + ' = ' + nd(first) + ' % ' + els[0] + (els.length > 1 ? ' (die übrigen Elemente sind nur in kleinen Gehalten enthalten)' : '') });
      if (nums.length > 1) { data.second = { el: els[els.length - 1], pct: nums[1] / FACTOR[els[els.length - 1]] }; parts[parts.length - 1].txt += '; Kennzahl ' + nums[1] + ' für ' + els[els.length - 1] + ': ' + nums[1] + ' / ' + FACTOR[els[els.length - 1]] + ' = ' + nd(data.second.pct) + ' %'; }
      const auto = els[0] === 'S';
      return { ok: true, name: s, group: auto ? 'auto' : 'nied', groupLabel: auto ? GROUPS.auto : GROUPS.nied, parts, data };
    }
    return bad('Diesen Namen kann der Decoder nicht lesen. Er kennt: S/E/P (Baustahl), C45 (unlegiert), 42CrMo4 (niedrig legiert), X5CrNi18-10 (hoch legiert), EN-GJL-200 (Gusseisen), EN AW-6082 (Aluminium). Groß- und Kleinschreibung beachten.');
  }

  /* ============================================================ Eisen-Kohlenstoff-Diagramm (vereinfachtes Lehrmodell, Stahlseite) */
  const FEC = { A1: 723, CS: 0.8, CMAX: 2.06, A3_0: 911, CZEM: 6.67, ACM_MAX: 1147, CFER: 0.02, HARDEN_MIN_C: 0.2 };
  const a3 = c => FEC.A3_0 - (FEC.A3_0 - FEC.A1) / FEC.CS * c;                              /* untereutektoid */
  const acm = c => FEC.A1 + (FEC.ACM_MAX - FEC.A1) / (FEC.CMAX - FEC.CS) * (c - FEC.CS);     /* übereutektoid */
  const upperLine = c => c <= FEC.CS ? a3(c) : acm(c);
  function structure(C, T) {
    if (!(C >= 0 && C <= FEC.CMAX + 1e-9) || !fin(T)) return null;
    const A1 = FEC.A1;
    if (T <= A1) {
      if (C < FEC.CFER) return { key: 'ferrit', name: 'Ferrit', parts: [{ n: 'Ferrit', p: 100 }], gamma: false };
      if (Math.abs(C - FEC.CS) < 1e-9) return { key: 'perlit', name: 'Perlit', parts: [{ n: 'Perlit', p: 100 }], gamma: false };
      if (C < FEC.CS) { const p = C / FEC.CS * 100; return { key: 'ferrit_perlit', name: 'Ferrit + Perlit', parts: [{ n: 'Ferrit', p: 100 - p }, { n: 'Perlit', p }], gamma: false }; }
      const z = (C - FEC.CS) / (FEC.CZEM - FEC.CS) * 100; return { key: 'perlit_zem', name: 'Perlit + Zementit', parts: [{ n: 'Perlit', p: 100 - z }, { n: 'Zementit (Fe₃C)', p: z }], gamma: false };
    }
    const up = upperLine(C);
    if (T >= up - 1e-9) return { key: 'gamma', name: 'Austenit', parts: [{ n: 'Austenit', p: 100 }], gamma: true };
    if (C < FEC.CS) return { key: 'gamma_alpha', name: 'Austenit + Ferrit', parts: [], gamma: true, share: (up - T) / (up - A1) };
    return { key: 'gamma_zem', name: 'Austenit + Zementit', parts: [], gamma: true, share: (up - T) / (up - A1) };
  }
  /* Härtetemperatur: 30 bis 50 °C über A3 (C <= 0,8 %) bzw. über A1 (C > 0,8 %); unter 0,2 % C nicht merklich härtbar */
  function hardenTemp(C) {
    if (!(C >= 0 && C <= FEC.CMAX)) return null;
    if (C < FEC.HARDEN_MIN_C) return { ok: false, why: 'Unter etwa 0,2 % C ist ein Stahl durch Abschrecken kaum härtbar (zu wenig Kohlenstoff für Martensit). Solche Stähle werden einsatzgehärtet.' };
    const ref = C <= FEC.CS ? a3(C) : FEC.A1;
    return { ok: true, ref: C <= FEC.CS ? 'A3' : 'A1', refT: ref, lo: ref + 30, hi: ref + 50 };
  }

  /* ============================================================ Anlassen (qualitativ) */
  /* Härte und Zähigkeit relativ in %, Anlasstemperatur in °C; nur der Verlauf (fallend/steigend) ist die Aussage */
  const TEMPER = [[100, 100, 10], [200, 93, 18], [300, 84, 28], [400, 70, 45], [500, 56, 62], [600, 42, 78], [700, 30, 90]];   /* PRUEFEN: qualitative Übungskurve */
  function temper(T) {
    T = Math.max(100, Math.min(700, T));
    for (let i = 0; i < TEMPER.length - 1; i++) { const a = TEMPER[i], b = TEMPER[i + 1]; if (T >= a[0] && T <= b[0]) { const f = (T - a[0]) / (b[0] - a[0]); return { hard: a[1] + (b[1] - a[1]) * f, tough: a[2] + (b[2] - a[2]) * f }; } }
    return null;
  }

  /* ============================================================ Werkstoffwahl */
  const PROPS = ['fest', 'zaeh', 'korr', 'zerspan', 'leicht', 'leit'];
  /* groups: [{id, r:{fest,...}}]; w: {fest: 0|1|2,...}; Punkte = Summe Gewicht * Bewertung (1..5) */
  function rank(groups, w) {
    const out = groups.map(g => ({ id: g.id, score: PROPS.reduce((s, p) => s + (w[p] || 0) * (g.r[p] || 0), 0) }));
    out.sort((a, b) => b.score - a.score);
    const max = out.length ? out[0].score : 0;
    return { list: out, best: out.filter(x => x.score === max && max > 0).map(x => x.id), max };
  }

  /* ============================================================ Zufallsaufgaben (Trainer) */
  const D_LIST = [6, 8, 10, 12, 14, 16, 20];
  function genTask(R, o, DATA) {
    o = o || {}; const kinds = { zug: ['sigma', 'eps', 'a', 'hooke', 'fm', 'lesen'], haerte: ['hbw', 'hv', 'hrc', 'rm'], name: ['c', 'el'], gefuege: ['perlit', 'zem', 'a3'] };
    let kind = o.kind || 'mixed'; if (kind === 'mixed') kind = pick(R, Object.keys(kinds));
    const sub = pick(R, kinds[kind]), lvl = o.level || 2, t = { kind, sub, level: lvl };
    if (kind === 'zug') {
      if (sub === 'sigma') { const d = pick(R, D_LIST), F = ri(R, 4, 60) * 500; t.text = `Eine Zugprobe mit dem Durchmesser d₀ = ${d} mm wird mit F = ${nd(F / 1000, 1)} kN belastet. Wie groß ist die Spannung σ?`; t.unit = 'N/mm²'; t.value = stress(F, circleArea(d)); t.tol = Math.max(0.6, t.value * 0.005); t.expl = `S₀ = π·d²/4 = π·${d}²/4 = ${nd(circleArea(d), 1)} mm². σ = F/S₀ = ${F} N / ${nd(circleArea(d), 1)} mm² = ${nd(t.value, 1)} N/mm².`; }
      else if (sub === 'eps') { const L0 = pick(R, [50, 80, 100, 200]), dL = ri(R, 2, 40) / 20 * (L0 / 50); t.text = `Messlänge L₀ = ${L0} mm. Unter Last verlängert sich die Probe um ΔL = ${nd(dL, 2)} mm. Wie groß ist die Dehnung ε in %?`; t.unit = '%'; t.value = strainPct(dL, L0); t.tol = Math.max(0.02, t.value * 0.01); t.expl = `ε = ΔL/L₀ · 100 % = ${nd(dL, 2)} mm / ${L0} mm · 100 % = ${nd(t.value, 3)} %.`; }
      else if (sub === 'a') { const L0 = pick(R, [50, 80, 100]), A = ri(R, 8, 40), Lu_ = L0 * (1 + A / 100); t.text = `Messlänge L₀ = ${L0} mm. Nach dem Bruch messen die zusammengelegten Probenteile Lᵤ = ${nd(Lu_, 1)} mm. Wie groß ist die Bruchdehnung A in %?`; t.unit = '%'; t.value = elongationA(L0, Lu_); t.tol = 0.3; t.expl = `A = (Lᵤ − L₀)/L₀ · 100 % = (${nd(Lu_, 1)} − ${L0}) / ${L0} · 100 % = ${nd(t.value, 1)} %.`; }
      else if (sub === 'hooke') { const E = pick(R, [210000, 70000, 120000]), s = pick(R, [50, 80, 100, 120, 150]), L0 = pick(R, [100, 200, 500]); t.text = `Ein Stab (E = ${E} N/mm²) mit L₀ = ${L0} mm wird elastisch mit σ = ${s} N/mm² belastet. Wie groß ist die Längenänderung ΔL in mm?`; t.unit = 'mm'; const eps = s / E; t.value = eps * L0; t.tol = Math.max(0.003, t.value * 0.02); t.expl = `Hooke: ε = σ/E = ${s}/${E} = ${nd(eps * 100, 4)} %. ΔL = ε · L₀ = ${nd(eps, 6)} · ${L0} mm = ${nd(t.value, 3)} mm.`; }
      else if (sub === 'fm') { const d = pick(R, [8, 10, 12, 16]), Rm = pick(R, [360, 400, 500, 600, 700]); t.text = `Eine Zugprobe (d₀ = ${d} mm) hat die Zugfestigkeit Rm = ${Rm} N/mm². Welche Höchstkraft Fm in kN wird im Versuch erreicht?`; t.unit = 'kN'; t.value = maxForce(Rm, circleArea(d)) / 1000; t.tol = Math.max(0.1, t.value * 0.005); t.expl = `S₀ = π·${d}²/4 = ${nd(circleArea(d), 1)} mm². Fm = Rm · S₀ = ${Rm} · ${nd(circleArea(d), 1)} = ${nd(t.value * 1000, 0)} N = ${nd(t.value, 2)} kN.`; }
      else { const ms = (DATA && DATA.materials) || [], m = ms.length ? pick(R, ms) : null; if (!m) { return genTask(R, { kind: 'zug', level: lvl }, null); } const q = m.type === 're' ? 'Re' : m.type === 'rp' ? 'Rp02' : 'Rm', qn = { Re: 'die obere Streckgrenze Re', Rp02: 'die Dehngrenze Rp0,2', Rm: 'die Zugfestigkeit Rm' }[q]; t.chart = m.id; t.text = `Lies im Diagramm von ${m.name} ${qn} ab.`; t.unit = 'N/mm²'; t.value = q === 'Re' ? m.Re : q === 'Rp02' ? m.Rp : m.Rm; t.tol = readTol(q, t.value); t.expl = `${qn} wird im Diagramm abgelesen: ${t.value} N/mm² (Lesetoleranz ±${nd(t.tol, 0)}).`; }
    } else if (kind === 'haerte') {
      if (sub === 'hbw') { const d = ri(R, 29, 50) / 10; t.text = `Brinellprüfung mit Kugel D = 10 mm und F = 29 420 N (HBW 10/3000). Eindruckdurchmesser d = ${nd(d, 1)} mm. Wie groß ist die Brinellhärte HBW?`; t.unit = 'HBW'; t.value = hbw(10, 29420, d); t.tol = Math.max(2, t.value * 0.01); t.expl = `HBW = 0,102 · 2F / (π·D·(D − √(D² − d²))) = 0,102 · 2 · 29420 / (π · 10 · (10 − √(100 − ${nd(d * d, 2)}))) = ${nd(t.value, 0)}.`; }
      else if (sub === 'hv') { const d = ri(R, 18, 40) / 100; t.text = `Vickersprüfung HV 10 (F = 98,07 N). Die mittlere Eindruckdiagonale beträgt d = ${nd(d, 2)} mm. Wie groß ist die Vickershärte HV?`; t.unit = 'HV'; t.value = hv(98.07, d); t.tol = Math.max(2, t.value * 0.01); t.expl = `HV = 0,1891 · F/d² = 0,1891 · 98,07 / ${nd(d * d, 4)} = ${nd(t.value, 0)}.`; }
      else if (sub === 'hrc') { const h = ri(R, 60, 120) / 1000; t.text = `Rockwell-C-Prüfung: Die bleibende Eindringtiefe beträgt h = ${nd(h, 3)} mm. Wie groß ist die Härte in HRC? (HRC = 100 − h/0,002 mm)`; t.unit = 'HRC'; t.value = hrc(h); t.tol = 0.6; t.expl = `HRC = 100 − h/0,002 = 100 − ${nd(h, 3)}/0,002 = ${nd(t.value, 1)}.`; }
      else { const hb = ri(R, 10, 30) * 10; t.text = `Eine Brinellprüfung ergibt ${hb} HBW. Wie groß ist die Zugfestigkeit Rm ungefähr? (Faustformel Rm ≈ 3,5 · HB, nur Richtwert für Stahl)`; t.unit = 'N/mm²'; t.value = rmFromHB(hb); t.tol = Math.max(10, t.value * 0.02); t.expl = `Rm ≈ 3,5 · ${hb} = ${nd(t.value, 0)} N/mm² (Richtwert).`; }
    } else if (kind === 'name') {
      if (sub === 'c') { const c = pick(R, [15, 22, 35, 45, 53, 60]), nm = 'C' + c; t.text = `Wie viel Prozent Kohlenstoff enthält der Stahl ${nm}?`; t.unit = '%'; t.value = c / 100; t.tol = 0.0051; t.expl = `Bei C45 und ähnlichen Namen gibt die Zahl das Hundertfache des Kohlenstoffgehalts an: ${c} / 100 = ${nd(c / 100)} % C.`; }
      else { const c = pick(R, [16, 20, 25, 34, 42]), n = pick(R, [4, 5, 6]), els = ['Cr', 'Mn'], el = pick(R, els), other = el === 'Cr' ? 'Mo' : 'Cr', nm = c + el + other + n; t.text = `Wie viel Prozent ${ELN[el]} (${el}) enthält ${nm} etwa? Das erste Legierungselement gehört zur Kennzahl ${n}.`; t.unit = '%'; t.value = n / 4; t.tol = 0.011; t.expl = `Für ${el} gilt der Faktor 4: ${n} / 4 = ${nd(n / 4)} %.`; }
    } else {
      if (sub === 'perlit') { const c = ri(R, 1, 7) / 10; t.text = `Ein langsam abgekühlter Stahl mit ${nd(c, 1)} % C liegt bei Raumtemperatur vor. Wie groß ist (nach dem vereinfachten Lehrmodell) der Perlitanteil in %?`; t.unit = '%'; t.value = c / 0.8 * 100; t.tol = 1; t.expl = `Perlit-Anteil = C-Gehalt / 0,8 · 100 % = ${nd(c, 1)} / 0,8 · 100 % = ${nd(t.value, 1)} %. Der Rest ist Ferrit.`; }
      else if (sub === 'zem') { const c = ri(R, 9, 20) / 10; t.text = `Ein Werkzeugstahl mit ${nd(c, 1)} % C liegt langsam abgekühlt vor. Wie groß ist der Zementit-Anteil (Lehrmodell: Zementit hat 6,67 % C) in %?`; t.unit = '%'; t.value = (c - 0.8) / (6.67 - 0.8) * 100; t.tol = 0.4; t.expl = `Zementit-Anteil = (C − 0,8) / (6,67 − 0,8) · 100 % = (${nd(c, 1)} − 0,8) / 5,87 · 100 % = ${nd(t.value, 1)} %.`; }
      else { const c = ri(R, 2, 7) / 10; t.text = `Wie hoch liegt die A₃-Temperatur bei ${nd(c, 1)} % C im vereinfachten Diagramm (gerade Linie von 911 °C bei 0 % C zu 723 °C bei 0,8 % C)?`; t.unit = '°C'; t.value = a3(c); t.tol = 6; t.expl = `A₃ = 911 − 235 · C = 911 − 235 · ${nd(c, 1)} = ${nd(t.value, 0)} °C (Steigung: 188 °C auf 0,8 % C = 235 °C je 1 % C).`; }
    }
    t.tips = ['Schreibe zuerst die passende Formel auf.', 'Setze die Zahlen ein und rechne mit den Einheiten (N und mm² ergeben N/mm²).'];
    return t;
  }
  function checkNumber(given, task) {
    const v = parseDe(given); if (!fin(v)) return { empty: true, ok: false };
    return { ok: Math.abs(v - task.value) <= task.tol + 1e-9, value: v };
  }

  const API = {
    parseDe, fmtDe, nd, rng, ri, pick, hashStr,
    circleArea, stress, strainPct, elongationA, hookeStress, hookeStrainPct, modulusE, maxForce, sigmaPerm, Lu,
    curvePoints, curve, sigmaAt, phaseAt, readFromCurve, readTol, checkReading,
    brinellForce, hbw, brinellValid, hv, hrc, hrcDepth, rmFromHB, hrcToHv, HRC_HV,
    decode, GROUPS, FACTOR, ELN,
    FEC, a3, acm, upperLine, structure, hardenTemp,
    TEMPER, temper, PROPS, rank,
    genTask, checkNumber
  };
  root.WER_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
