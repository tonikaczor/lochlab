'use strict';
/* Tonfunk Konstruktions-Lab: reine Rechenlogik (Kennung 'kon'). window.KON_CORE bzw. module.exports.
   ALLE Tabellenwerte (Gewinde, Normteile, Passfedern, Wälzlager, Rauheit, Werkstoffe) sind ÜBUNGSWERTE für die Ausbildung,
   keine Konstruktionsvorgabe. Maßgebend sind Tabellenbuch, Normen und die Vorgaben des Betriebs.
   Konventionen: Längen in mm, Kräfte in N, Drehmoment in N·m, Spannungen in N/mm², Federrate in N/mm.
   Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN, nie Infinity.
   Nicht enthalten (steht in tollab): ISO-286-Passungen, Abmaße, Messmittel. Nicht enthalten (steht in zeilab): Ansichten, Linien, Bemaßung. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const ceilN = x => (fin(x) ? Math.ceil(x - 1e-9) : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(mm²|mm2|n\/mm²|n|kn|nm|mm|cm|m|°|grad|k|µm|um|stück|stk|mal)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtDe(v, dec, group) {
    if (!fin(v)) return '–';
    dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '–'; dec = dec == null ? 2 : dec;
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

  /* ================================================================ Gewinde und Schrauben */
  /* PRUEFEN P1: Gewindetabelle (Regelgewinde M3 bis M24) als Übungswerte: Steigung P, Kernlochbohrer, Durchgangsloch "mittel" (ISO 273), Schlüsselweite SW (ISO 4017), Mutterhöhe m (ISO 4032), Scheibendicke s (ISO 7089), Spannungsquerschnitt As. Bitte gegen das Tabellenbuch des Betriebs prüfen (Schlüsselweite M12 18 mm nach ISO, früher 19 mm nach DIN 931). */
  const TH = [
    { d: 3, P: 0.5, kern: 2.5, dg: 3.4, sw: 5.5, m: 2.4, s: 0.5, As: 5.03 },
    { d: 4, P: 0.7, kern: 3.3, dg: 4.5, sw: 7, m: 3.2, s: 0.8, As: 8.78 },
    { d: 5, P: 0.8, kern: 4.2, dg: 5.5, sw: 8, m: 4.7, s: 1, As: 14.2 },
    { d: 6, P: 1, kern: 5, dg: 6.6, sw: 10, m: 5.2, s: 1.6, As: 20.1 },
    { d: 8, P: 1.25, kern: 6.8, dg: 9, sw: 13, m: 6.8, s: 1.6, As: 36.6 },
    { d: 10, P: 1.5, kern: 8.5, dg: 11, sw: 16, m: 8.4, s: 2, As: 58 },
    { d: 12, P: 1.75, kern: 10.2, dg: 13.5, sw: 18, m: 10.8, s: 2.5, As: 84.3 },
    { d: 16, P: 2, kern: 14, dg: 17.5, sw: 24, m: 14.8, s: 3, As: 157 },
    { d: 20, P: 2.5, kern: 17.5, dg: 22, sw: 30, m: 18, s: 3, As: 245 },
    { d: 24, P: 3, kern: 21, dg: 26, sw: 36, m: 21.5, s: 4, As: 353 }
  ];
  const thread = d => TH.find(t => t.d === d) || null;
  const pitch = d => { const t = thread(d); return t ? t.P : NAN; };
  /* PRUEFEN P2: Kernlochbohrer aus der Tabelle (M8 6,8; M10 8,5; M12 10,2). Die Faustformel d − P liefert M8 6,75 und M12 10,25. In den Aufgaben gilt ±0,05 mm als richtig. Welche Regel soll gelten? */
  const kernloch = d => { const t = thread(d); return t ? t.kern : NAN; };
  const kernFaust = d => { const t = thread(d); return t ? rd(d - t.P, 2) : NAN; };
  const durchgang = d => { const t = thread(d); return t ? t.dg : NAN; };
  const spannQuer = d => { const t = thread(d); return t ? t.As : NAN; };
  /* Weg einer eingängigen Schraube: s = n · P */
  const travel = (n, d) => (num(n) >= 0 && thread(d) ? n * thread(d).P : NAN);

  /* PRUEFEN P3: Festigkeitsklasse a.b: Rm = a · 100 N/mm², Re = a · b · 10 N/mm². Ab 8.8 ist der Wert genau genommen die 0,2-%-Dehngrenze Rp0,2; Mindestwerte nach ISO 898-1 weichen für 8.8 bei d > 16 mm leicht ab (830 statt 800 N/mm²). Reicht die Vereinfachung? */
  const FKS = ['4.6', '5.8', '8.8', '10.9', '12.9'];
  const fkParse = s => { const m = /^(\d{1,2})\.(\d)$/.exec(String(s == null ? '' : s).trim()); return m ? { a: +m[1], b: +m[2] } : null; };
  const fkRm = s => { const p = fkParse(s); return p ? p.a * 100 : NAN; };
  const fkRe = s => { const p = fkParse(s); return p ? p.a * p.b * 10 : NAN; };
  /* PRUEFEN P4: Mutter-Festigkeitsklasse mindestens "Zahl vor dem Punkt der Schraube" (8.8 gehört zu Mutter 8, 10.9 zu 10, 12.9 zu 12). Nach ISO 898-2 darf die Mutter auch eine Stufe höher sein (8.8 mit Klasse 8 oder 9, 4.6 mit Klasse 4 oder 5). Welche Zuordnung soll gelten? */
  const fkNut = s => { const p = fkParse(s); return p ? p.a : NAN; };
  const forceYield = (fk, d) => (thread(d) && fkParse(fk) ? fkRe(fk) * thread(d).As : NAN);
  const forceBreak = (fk, d) => (thread(d) && fkParse(fk) ? fkRm(fk) * thread(d).As : NAN);

  /* PRUEFEN P6: Schraubenlänge für eine Durchsteckverbindung: l ≥ Summe der Klemmdicken + Scheibe unter der Mutter + Mutterhöhe + Überstand 2 · P (zwei Gewindegänge ragen heraus), dann auf die nächste Normlänge aufrunden. Üblicher Überstand je nach Lehrbuch 1 bis 3 Gewindegänge; Normlängen in der Reihe 8, 10, 12, 16, 20, 25, 30 … 70, 80, 90 … Stimmt die Regel? */
  const NORMLEN = [8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100, 110, 120, 130, 140, 150];
  function screwLen(sumT, d, nW) {
    const t = thread(d); if (!t || !(num(sumT) > 0)) return { min: NAN, norm: NAN };
    const w = nW == null ? 1 : nW, min = sumT + w * t.s + t.m + 2 * t.P, nm = NORMLEN.find(x => x >= min - 1e-9);
    return { min: rd(min, 3), norm: nm == null ? NAN : nm, washer: w * t.s, nut: t.m, over: 2 * t.P };
  }

  /* ================================================================ Normteil-Bezeichnungen und Stückliste */
  /* PRUEFEN P5: Bezeichnungsformate als Kurzform: Schraube "ISO 4017 M8x30-8.8", Mutter "ISO 4032 M8-8", Scheibe "ISO 7089 - 8 - 200 HV", Stift "ISO 2338 6m6x30" (die volle Norm-Bezeichnung hat noch Werkstoff- und Ausführungsangaben), Passfeder "DIN 6885 A 8x7x32" (Form A: beidseitig rundstirnig, B: beidseitig eckig). Im Betrieb steht oft "DIN EN ISO 4017". Welche Schreibweise sollen die Azubis lesen können? */
  const NORMS = {
    '4017': { k: 'schraube', n: 'Sechskantschraube mit Gewinde bis Kopf' },
    '4014': { k: 'schraube', n: 'Sechskantschraube mit Schaft' },
    '4762': { k: 'schraube', n: 'Zylinderschraube mit Innensechskant' },
    '4032': { k: 'mutter', n: 'Sechskantmutter' },
    '7089': { k: 'scheibe', n: 'Scheibe (Unterlegscheibe)' },
    '2338': { k: 'stift', n: 'Zylinderstift' },
    '8752': { k: 'stift', n: 'Spannstift (geschlitzt)' },
    '6885': { k: 'passfeder', n: 'Passfeder' }
  };
  const KIND_N = { schraube: 'Schraube', mutter: 'Mutter', scheibe: 'Scheibe', stift: 'Stift', passfeder: 'Passfeder', bauteil: 'Bauteil' };
  const bez = {
    schraube: (no, d, l, fk) => 'ISO ' + no + ' M' + d + 'x' + l + '-' + fk,
    mutter: (d, fkn) => 'ISO 4032 M' + d + (fkn != null ? '-' + fkn : ''),
    scheibe: d => 'ISO 7089 - ' + d + ' - 200 HV',
    stift: (no, d, fit, l) => 'ISO ' + no + ' ' + d + (fit || '') + 'x' + l,
    passfeder: (form, b, h, l) => 'DIN 6885 ' + form + ' ' + b + 'x' + h + 'x' + l
  };
  function parseBez(s) {
    s = String(s == null ? '' : s).trim().replace(/\s+/g, ' ').replace(/[×]/g, 'x'); let m, o;
    if ((m = /^ISO (4017|4014|4762) M(\d+) ?x ?(\d+)(?: ?- ?(\d+\.\d))?$/i.exec(s))) o = { kind: 'schraube', no: m[1], d: +m[2], l: +m[3], fk: m[4] || null };
    else if ((m = /^ISO 4032 M(\d+)(?: ?- ?(\d+))?$/i.exec(s))) o = { kind: 'mutter', no: '4032', d: +m[1], fkn: m[2] ? +m[2] : null };
    else if ((m = /^ISO 7089 ?-? ?(\d+)(?: ?-? ?(\d+) ?HV)?$/i.exec(s))) o = { kind: 'scheibe', no: '7089', d: +m[1], hv: m[2] ? +m[2] : null };
    else if ((m = /^ISO (2338|8752) (\d+) ?([a-z]\d+)? ?x ?(\d+)$/i.exec(s))) o = { kind: 'stift', no: m[1], d: +m[2], fit: m[3] || null, l: +m[4] };
    else if ((m = /^DIN 6885 ?(A|B)? ?(\d+) ?x ?(\d+) ?x ?(\d+)$/i.exec(s))) o = { kind: 'passfeder', no: '6885', form: (m[1] || 'A').toUpperCase(), b: +m[2], h: +m[3], l: +m[4] };
    else return null;
    o.norm = (o.no === '6885' ? 'DIN ' : 'ISO ') + o.no; o.name = NORMS[o.no].n; o.warn = [];
    if (o.kind === 'schraube') { if (!thread(o.d)) o.warn.push('Gewinde M' + o.d + ' steht nicht in der Übungstabelle.'); if (!NORMLEN.includes(o.l)) o.warn.push('Länge ' + o.l + ' mm ist keine übliche Normlänge.'); if (o.fk && !fkParse(o.fk)) o.warn.push('Festigkeitsklasse unlesbar.'); }
    if (o.kind === 'mutter' && !thread(o.d)) o.warn.push('Gewinde M' + o.d + ' steht nicht in der Übungstabelle.');
    if (o.kind === 'passfeder' && !PF.some(p => p.b === o.b && p.h === o.h)) o.warn.push('Die Größe ' + o.b + ' × ' + o.h + ' gibt es in der Übungstabelle nicht.');
    return o;
  }
  function describeBez(p) {
    if (!p) return 'Keine bekannte Normteil-Bezeichnung (Übungsliste).';
    const f = v => fmtN(v, 2);
    if (p.kind === 'schraube') return p.name + ', Gewinde M' + p.d + ' (Steigung ' + f(pitch(p.d)) + ' mm), Länge ' + p.l + ' mm' + (p.fk ? ', Festigkeitsklasse ' + p.fk + ' (Rm ' + fkRm(p.fk) + ' N/mm²)' : '') + '.';
    if (p.kind === 'mutter') return p.name + ' für Gewinde M' + p.d + (p.fkn != null ? ', Festigkeitsklasse ' + p.fkn : '') + '.';
    if (p.kind === 'scheibe') return p.name + ' für Schraube M' + p.d + (p.hv ? ', Härte ' + p.hv + ' HV' : '') + '.';
    if (p.kind === 'stift') return p.name + ', Durchmesser ' + p.d + ' mm' + (p.fit ? ' (Toleranzfeld ' + p.fit + ')' : '') + ', Länge ' + p.l + ' mm.';
    return p.name + ' Form ' + p.form + (p.form === 'A' ? ' (beidseitig rundstirnig)' : ' (beidseitig eckig)') + ', Breite ' + p.b + ' mm, Höhe ' + p.h + ' mm, Länge ' + p.l + ' mm.';
  }
  const rowKind = r => { const p = parseBez(r && r.bez); return p ? p.kind : 'bauteil'; };
  /* PRUEFEN P25: Stücklistenregeln: Menge der Muttern gleich Menge der Schrauben, Scheiben und Mutter zur Schraube passend (gleiches Gewinde, Mutter-Festigkeitsklasse nicht niedriger als in P4). Wie wird das in eurer Stückliste gehandhabt (Scheibe unter Kopf und Mutter = doppelte Menge)? */
  function bomTotals(rows) {
    const o = { schraube: 0, mutter: 0, scheibe: 0, stift: 0, passfeder: 0, bauteil: 0, normteile: 0, positionen: 0 };
    (rows || []).forEach(r => { const q = num(+r.qty) >= 0 ? +r.qty : 0, k = rowKind(r); o[k] += q; o.positionen++; if (k !== 'bauteil') o.normteile += q; });
    return o;
  }
  /* Liefert die auffälligen Positionen: [{pos, msg}]. Bezugsschraube = erste Schraube der Liste. */
  function bomIssues(rows) {
    const out = [], ps = (rows || []).map(r => ({ r, p: parseBez(r.bez) })), ref = ps.find(x => x.p && x.p.kind === 'schraube');
    if (!ref) return out;
    const S = ref.p, sNut = fkParse(S.fk) ? fkNut(S.fk) : null;
    ps.forEach(x => {
      if (!x.p) return;
      if (x.p.kind === 'mutter') {
        if (x.p.d !== S.d) out.push({ pos: x.r.pos, msg: 'Mutter M' + x.p.d + ' passt nicht zur Schraube M' + S.d + '.' });
        else if (sNut != null && x.p.fkn != null && x.p.fkn < sNut) out.push({ pos: x.r.pos, msg: 'Mutter der Klasse ' + x.p.fkn + ' ist zu schwach für Schraube ' + S.fk + ' (mindestens Klasse ' + sNut + ').' });
        if (+x.r.qty !== +ref.r.qty) out.push({ pos: x.r.pos, msg: 'Menge ' + x.r.qty + ' der Mutter passt nicht zur Schraubenmenge ' + ref.r.qty + '.' });
      } else if (x.p.kind === 'scheibe' && x.p.d !== S.d) out.push({ pos: x.r.pos, msg: 'Scheibe für M' + x.p.d + ' passt nicht zur Schraube M' + S.d + '.' });
    });
    return out;
  }

  /* ================================================================ Welle-Nabe */
  /* PRUEFEN P7: Passfeder-Tabelle (DIN 6885 / ISO 773) als Übungswerte: Wellendurchmesser "über … bis …", Breite b × Höhe h, Nuttiefe in der Welle t1. Grenzen und t1 mit dem Tabellenbuch vergleichen. */
  const PF = [
    { from: 6, to: 8, b: 2, h: 2, t1: 1.2 }, { from: 8, to: 10, b: 3, h: 3, t1: 1.8 }, { from: 10, to: 12, b: 4, h: 4, t1: 2.5 },
    { from: 12, to: 17, b: 5, h: 5, t1: 3 }, { from: 17, to: 22, b: 6, h: 6, t1: 3.5 }, { from: 22, to: 30, b: 8, h: 7, t1: 4 },
    { from: 30, to: 38, b: 10, h: 8, t1: 5 }, { from: 38, to: 44, b: 12, h: 8, t1: 5 }, { from: 44, to: 50, b: 14, h: 9, t1: 5.5 },
    { from: 50, to: 58, b: 16, h: 10, t1: 6 }, { from: 58, to: 65, b: 18, h: 11, t1: 7 }
  ];
  const keyFor = d => (num(d) > 0 ? PF.find(p => d > p.from && d <= p.to) || null : null);
  const keyLabel = p => (p ? p.b + ' × ' + p.h : '–');
  /* PRUEFEN P19: Tragende Länge der Passfeder: Form A (rundstirnig) l − b, Form B (eckig) l. Die Flächenpressung wird in diesem Lab nicht berechnet. */
  const keyLen = (form, l, b) => (num(l) > 0 && num(b) > 0 ? (String(form).toUpperCase() === 'A' ? l - b : l) : NAN);
  const keyGroove = (d, p) => (num(d) > 0 && p ? d - p.t1 : NAN);
  /* PRUEFEN P18: Umfangskraft am Wellendurchmesser Fu = 2 · M / d (M in N·m, d in mm → Faktor 1000). Die Aufteilung auf Passfeder-Flanken und die Flächenpressung bleiben außen vor. */
  const tangForce = (M, d) => (num(M) >= 0 && num(d) > 0 ? 2 * M * 1000 / d : NAN);
  /* PRUEFEN P11: Wärmeausdehnung für das Fügen eines Pressverbands: Δd = α · d · ΔT mit α = 12 · 10⁻⁶ 1/K (Stahl, Übungswert). Nötig: Höchstübermaß plus Montagespiel. Üblich sind auch Abkühlen der Welle und Längspressen; Nabe und Welle werden hier nicht unterschiedlich erwärmt. */
  const ALPHA_ST = 12e-6;
  const thermalDT = (d, delta, alpha) => { const a = alpha == null ? ALPHA_ST : alpha; return num(d) > 0 && num(delta) >= 0 && a > 0 ? delta / (a * d) : NAN; };

  /* ================================================================ Wälzlager */
  /* PRUEFEN P8: Maßtabelle für Rillenkugellager der Reihen 60, 62, 63 (Bohrung d, Außendurchmesser D, Breite B) als Übungswerte; Bohrungskennzahl: 00 = 10 mm, 01 = 12, 02 = 15, 03 = 17, ab 04 gilt Kennzahl · 5 = Bohrung. Bitte mit dem Tabellenbuch (SKF, FAG oder Betrieb) vergleichen. */
  const BRDIM = {
    '0': { 10: [26, 8], 12: [28, 8], 15: [32, 9], 17: [35, 10], 20: [42, 12], 25: [47, 12], 30: [55, 13], 35: [62, 14], 40: [68, 15] },
    '2': { 10: [30, 9], 12: [32, 10], 15: [35, 11], 17: [40, 12], 20: [47, 14], 25: [52, 15], 30: [62, 16], 35: [72, 17], 40: [80, 18], 45: [85, 19], 50: [90, 20] },
    '3': { 10: [35, 11], 12: [37, 12], 15: [42, 13], 17: [47, 14], 20: [52, 15], 25: [62, 17], 30: [72, 19], 35: [80, 21], 40: [90, 23] }
  };
  const SERIES_N = { '0': 'Durchmesserreihe 0 (extra leicht)', '2': 'Durchmesserreihe 2 (leicht)', '3': 'Durchmesserreihe 3 (mittel)' };
  const brgBore = nn => (nn === 0 ? 10 : nn === 1 ? 12 : nn === 2 ? 15 : nn === 3 ? 17 : nn >= 4 && nn <= 96 ? nn * 5 : NAN);
  /* PRUEFEN P9: Lagerarten nach Kurzzeichen: 6 Rillenkugellager, 7 Schrägkugellager, 30 / 32 Kegelrollenlager, NU Zylinderrollenlager, 51 Axial-Rillenkugellager, 22 Pendelrollenlager, 12 Pendelkugellager. Nachsetzzeichen: 2RS berührende Dichtscheiben beidseitig, ZZ Deckscheiben beidseitig (nicht berührend), C3 Lagerluft größer als normal, K kegelige Bohrung. Vollständig und richtig? */
  const SUFFIX = { '2RS': 'beidseitig berührende Dichtscheiben', '2RSR': 'beidseitig berührende Dichtscheiben', 'ZZ': 'beidseitig Deckscheiben (nicht berührend)', '2Z': 'beidseitig Deckscheiben (nicht berührend)', 'C3': 'Lagerluft größer als normal', 'K': 'kegelige Bohrung (Kegel 1:12)' };
  function brgInfo(code) {
    const s = String(code == null ? '' : code).trim().toUpperCase().replace(/\s+/g, ' '), m = /^(NU|NJ)? ?(\d{3,5})(?:[ -]?(2RSR|2RS|2Z|ZZ|C3|K))?$/.exec(s);
    if (!m) return null;
    const pre = m[1] || '', dg = m[2], suf = m[3] || '', nn = +dg.slice(-2), o = { code: s, pre, digits: dg, suffix: suf, suffixText: suf ? SUFFIX[suf] : '', bore: brgBore(nn) };
    if (pre) o.type = 'Zylinderrollenlager';
    else if (/^22\d{3}$/.test(dg)) o.type = 'Pendelrollenlager';
    else if (/^3\d{4}$/.test(dg)) o.type = 'Kegelrollenlager';
    else if (/^51\d{3}$/.test(dg)) o.type = 'Axial-Rillenkugellager';
    else if (/^6\d{3}$/.test(dg)) o.type = 'Rillenkugellager';
    else if (/^7\d{3}$/.test(dg)) o.type = 'Schrägkugellager';
    else if (/^12\d{2}$/.test(dg)) o.type = 'Pendelkugellager';
    else return null;
    if (o.type === 'Rillenkugellager') { o.series = dg[1]; const t = BRDIM[o.series] && BRDIM[o.series][o.bore]; if (t) { o.D = t[0]; o.B = t[1]; } }
    return o;
  }
  const brgCode = (series, bore) => { const nn = bore <= 10 ? 0 : bore === 12 ? 1 : bore === 15 ? 2 : bore === 17 ? 3 : bore / 5; return '6' + series + String(nn).padStart(2, '0'); };
  const BRSIZES = s => Object.keys(BRDIM[s] || {}).map(Number);

  /* ================================================================ Federn */
  /* PRUEFEN P10: Federn: Federrate R = F / s (N/mm); Parallelschaltung R = R1 + R2 (die Kraft teilt sich); Reihenschaltung 1/R = 1/R1 + 1/R2 (der Weg addiert sich); Federarbeit W = ½ · F · s bei linearer Kennlinie. Keine Berechnung aus Drahtdurchmesser und Windungszahl. */
  const springRate = (F, s) => (num(F) >= 0 && num(s) > 0 ? F / s : NAN);
  const springForce = (R, s) => (num(R) > 0 && num(s) >= 0 ? R * s : NAN);
  const springPath = (F, R) => (num(F) >= 0 && num(R) > 0 ? F / R : NAN);
  const springParallel = rs => (Array.isArray(rs) && rs.length && rs.every(r => num(r) > 0) ? rs.reduce((a, r) => a + r, 0) : NAN);
  const springSeries = rs => (Array.isArray(rs) && rs.length && rs.every(r => num(r) > 0) ? 1 / rs.reduce((a, r) => a + 1 / r, 0) : NAN);
  const springWork = (F, s) => (num(F) >= 0 && num(s) >= 0 ? F * s / 2 / 1000 : NAN);

  /* ================================================================ Form- und Lagetoleranzen (ISO 1101) */
  /* PRUEFEN P12: Auswahl von neun Toleranzarten mit Einteilung Form (ohne Bezug), Richtung / Ort / Lauf (mit Bezug). dia: 0 = Zonenform ohne ⌀, 1 = ⌀ möglich, 2 = ⌀ nötig. Es fehlen Neigung, Symmetrie, Linien- und Flächenprofil, Gesamtlauf, Planlauf und Zusatzsymbole (Ⓜ, TED-Rahmen). Ist der Umfang für Azubis im 2. Lehrjahr richtig? */
  const SYMS = [
    { id: 'gerad', n: 'Geradheit', cls: 'Form', dat: 0, dia: 1 },
    { id: 'eben', n: 'Ebenheit', cls: 'Form', dat: 0, dia: 0 },
    { id: 'rund', n: 'Rundheit', cls: 'Form', dat: 0, dia: 0 },
    { id: 'zyl', n: 'Zylinderform', cls: 'Form', dat: 0, dia: 0 },
    { id: 'par', n: 'Parallelität', cls: 'Richtung', dat: 1, dia: 1 },
    { id: 'recht', n: 'Rechtwinkligkeit', cls: 'Richtung', dat: 1, dia: 1 },
    { id: 'koax', n: 'Koaxialität', cls: 'Ort', dat: 1, dia: 2 },
    { id: 'pos', n: 'Position', cls: 'Ort', dat: 1, dia: 2 },
    { id: 'rundl', n: 'Rundlauf', cls: 'Lauf', dat: 1, dia: 0 }
  ];
  const symOf = id => SYMS.find(s => s.id === id) || null;
  const needsDatum = id => { const s = symOf(id); return s ? s.dat === 1 : false; };
  function frameValid(f) {
    const out = [], s = f && symOf(f.sym); if (!s) return ['Wähle eine Toleranzart.'];
    const A = (f.datums || []).filter(Boolean);
    if (!(num(f.tol) > 0)) out.push('Der Toleranzwert muss größer als 0 sein.');
    if (s.dat === 1 && !A.length) out.push(s.n + ' braucht mindestens einen Bezug (Buchstabe), sonst ist die Angabe unvollständig.');
    if (s.dat === 0 && A.length) out.push(s.n + ' ist eine Formtoleranz und hat keinen Bezug.');
    if (s.dia === 0 && f.dia) out.push('Bei ' + s.n + ' steht kein ⌀ vor dem Wert.');
    if (s.dia === 2 && !f.dia) out.push('Bei ' + s.n + ' steht ein ⌀ vor dem Wert (zylindrische Toleranzzone).');
    return out;
  }
  const frameCells = f => { const s = symOf(f.sym), c = [{ k: 'sym', id: f.sym }, { k: 'tol', text: (f.dia ? '⌀' : '') + fmtN(f.tol, 3) }]; (f.datums || []).filter(Boolean).forEach(x => c.push({ k: 'dat', text: String(x).toUpperCase() })); return s ? c : []; };
  /* PRUEFEN P13: Beschreibung der Toleranzzonen (Abstand zweier Ebenen, Zylinder mit ⌀ t, Messuhr-Ausschlag beim Rundlauf). Position nur als Achse einer Bohrung mit kreisförmiger Zone ⌀ t um den theoretisch genauen Sollort; abweichende Fälle (Rechteckzone, Gruppen, Maximum-Material) fehlen. */
  function frameText(f) {
    const s = f && symOf(f.sym); if (!s) return ''; const t = fmtN(f.tol, 3), A = (f.datums || []).filter(Boolean), bz = A.length ? (A.length > 1 ? 'Bezüge ' : 'Bezug ') + A.join(' und ') : 'den Bezug';
    switch (s.id) {
      case 'gerad': return f.dia ? 'Die tolerierte Achse muss in einem Zylinder mit ⌀ ' + t + ' mm liegen.' : 'Die tolerierte Linie muss zwischen zwei parallelen Geraden im Abstand ' + t + ' mm liegen.';
      case 'eben': return 'Die tolerierte Fläche muss zwischen zwei parallelen Ebenen im Abstand ' + t + ' mm liegen.';
      case 'rund': return 'Jeder Querschnitt muss zwischen zwei konzentrischen Kreisen liegen, deren Radien sich um höchstens ' + t + ' mm unterscheiden.';
      case 'zyl': return 'Die Mantelfläche muss zwischen zwei koaxialen Zylindern liegen, deren Radien sich um höchstens ' + t + ' mm unterscheiden.';
      case 'par': return f.dia ? 'Die tolerierte Achse muss in einem Zylinder mit ⌀ ' + t + ' mm liegen, der parallel zu ' + bz + ' verläuft.' : 'Die tolerierte Fläche muss zwischen zwei Ebenen im Abstand ' + t + ' mm liegen, die parallel zu ' + bz + ' verlaufen.';
      case 'recht': return f.dia ? 'Die tolerierte Achse muss in einem Zylinder mit ⌀ ' + t + ' mm liegen, der rechtwinklig zu ' + bz + ' verläuft.' : 'Die tolerierte Fläche muss zwischen zwei Ebenen im Abstand ' + t + ' mm liegen, die rechtwinklig zu ' + bz + ' verlaufen.';
      case 'koax': return 'Die tolerierte Achse muss in einem Zylinder mit ⌀ ' + t + ' mm liegen, dessen Achse die Bezugsachse (' + bz + ') ist.';
      case 'pos': return 'Die Achse muss in einer Zone mit ⌀ ' + t + ' mm um den theoretisch genauen Sollort liegen (' + bz + ').';
      default: return 'Bei einer vollen Umdrehung um ' + bz + ' darf die Messuhr an jeder Stelle höchstens ' + t + ' mm Ausschlag zeigen.';
    }
  }
  /* Positionstoleranz mit Zone ⌀ t: die Abweichung vom Sollort (Abstand) darf höchstens t/2 betragen. Falsche Rechteck-Denke: |dx| und |dy| je ≤ t/2. */
  const posDist = (dx, dy) => (fin(dx) && fin(dy) ? Math.hypot(dx, dy) : NAN);
  const posOk = (dx, dy, t) => (fin(dx) && fin(dy) && num(t) > 0 ? posDist(dx, dy) <= t / 2 + 1e-9 : false);
  const posOkSquare = (dx, dy, t) => (fin(dx) && fin(dy) && num(t) > 0 ? Math.abs(dx) <= t / 2 + 1e-9 && Math.abs(dy) <= t / 2 + 1e-9 : false);

  /* ================================================================ Oberflächen */
  /* PRUEFEN P14: Normreihe der Mittenrauwerte Ra in µm und typische erreichbare Rauheit je Fertigungsverfahren (Übungswerte, in der Praxis streuen die Werte um mehrere Stufen). */
  const RA_SERIES = [0.1, 0.2, 0.4, 0.8, 1.6, 3.2, 6.3, 12.5, 25];
  const RA_PROC = [
    { id: 'saegen', n: 'Sägen', ra: 25 }, { id: 'schruppen', n: 'Schruppen (Drehen, Fräsen)', ra: 12.5 }, { id: 'bohren', n: 'Bohren', ra: 6.3 },
    { id: 'schlichten', n: 'Schlichten (Drehen, Fräsen)', ra: 3.2 }, { id: 'reiben', n: 'Reiben', ra: 1.6 }, { id: 'feindrehen', n: 'Feindrehen', ra: 0.8 },
    { id: 'schleifen', n: 'Schleifen', ra: 0.4 }, { id: 'honen', n: 'Honen', ra: 0.2 }, { id: 'laeppen', n: 'Läppen', ra: 0.1 }
  ];
  /* PRUEFEN P16: Zuordnung Funktion → Ra (Wälzlagersitz 0,8, Dichtlauffläche 0,4, Gleitfläche 0,4, Schraubenkopf-Auflage 6,3, Passfedernut-Flanke 3,2, unbearbeitete Nebenfläche 12,5). Welche Werte nutzt ihr im Unterricht? */
  const RA_FUNC = [
    { id: 'lager', n: 'Sitz eines Wälzlagers auf der Welle', ra: 0.8 },
    { id: 'dicht', n: 'Lauffläche für einen Radialwellendichtring', ra: 0.4 },
    { id: 'gleit', n: 'Gleitfläche einer Kolbenstange', ra: 0.4 },
    { id: 'kopf', n: 'Auflagefläche eines Schraubenkopfs', ra: 6.3 },
    { id: 'nut', n: 'Flanke einer Passfedernut', ra: 3.2 },
    { id: 'neben', n: 'spanend bearbeitete Nebenfläche ohne besondere Anforderung', ra: 12.5 }
  ];
  /* PRUEFEN P15: Bearbeitungszeichen nach ISO 1302 (offenes V = Fertigungsverfahren beliebig, V mit Strich = materialabtragend, V mit Kreis = nicht abtragend, Oberfläche bleibt wie angeliefert). Ältere Zeichnungen und Lehrbücher kennen noch die Dreiecke (Rauheitsstufen) nach DIN 3141; sie fehlen hier bewusst. Zusatz "rundum" fehlt. */
  const ROUGH_SYM = [
    { id: 'offen', n: 'Oberfläche mit beliebigem Fertigungsverfahren (offenes Zeichen)' },
    { id: 'abtrag', n: 'Oberfläche muss spanend bearbeitet werden (Zeichen mit Strich)' },
    { id: 'kein', n: 'Oberfläche bleibt im Anlieferzustand, kein Materialabtrag (Zeichen mit Kreis)' }
  ];
  /* PRUEFEN P17: Gussschräge: Zuwachs des Maßes über die Höhe h bei Winkel α ist Δ = h · tan α (je Seite). Üblich sind 1° bis 3°, je nach Gießverfahren und Höhe auch mehr. Reicht der Übungsbereich 1° bis 3°? */
  const draftGrowth = (h, deg) => (num(h) > 0 && num(deg) > 0 && deg < 45 ? h * Math.tan(deg * Math.PI / 180) : NAN);

  const API = { parseDe, fmtDe, fmtN, rd, num, ceilN, hashStr, rng, ri, pick, shuffle,
    TH, thread, pitch, kernloch, kernFaust, durchgang, spannQuer, travel, FKS, fkParse, fkRm, fkRe, fkNut, forceYield, forceBreak, NORMLEN, screwLen,
    NORMS, KIND_N, bez, parseBez, describeBez, rowKind, bomTotals, bomIssues,
    PF, keyFor, keyLabel, keyLen, keyGroove, tangForce, ALPHA_ST, thermalDT,
    BRDIM, SERIES_N, SUFFIX, brgBore, brgInfo, brgCode, BRSIZES,
    springRate, springForce, springPath, springParallel, springSeries, springWork,
    SYMS, symOf, needsDatum, frameValid, frameCells, frameText, posDist, posOk, posOkSquare,
    RA_SERIES, RA_PROC, RA_FUNC, ROUGH_SYM, draftGrowth };
  root.KON_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
