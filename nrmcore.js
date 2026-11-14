'use strict';
/* Tonfunk Normen und Konformität: reine Rechen- und Entscheidungslogik (Kennung 'nrm', Stufe 'studium'). window.NRM_CORE bzw. module.exports.
   Blöcke: 1 CE und Richtlinien, 2 Schutzklassen, IP, Überspannungskategorie, Verschmutzungsgrad, Luft- und Kriechstrecken,
   3 Maschinensicherheit (Risikograph, PL, SIL, Kategorien, Not-Halt, Sicherheitsabstand), 4 Prüfen elektrischer Geräte, 5 Qualität.
   WICHTIG: Alles hier ist ein eigenes, vereinfachtes LERNMODELL in eigenen Worten und mit eigener Struktur. Es enthält keine Normtexte
   und ersetzt keine Norm. Maßgeblich ist immer die aktuelle Normfassung. Zahlenwerte sind an die in der Praxis bekannten Größenordnungen
   angelehnt und stehen zur fachlichen Gegenprüfung in NRM_CORE.SOURCES (wird im Lab und im Test ausgegeben).
   Unter NRM_CORE.chk stehen unabhängige Zweitrechnungen (anderer Rechenweg: Tabellenscan, Schleife, Formel statt Tabelle ...);
   die Aufgaben-Generatoren (q.alt) und die Tests vergleichen die Hauptrechnung damit. Ungültige Eingaben liefern NaN bzw. null, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/−/g, '-');
    const m = /^([+-]?)(\d[\d.]*(?:,\d+)?|,\d+)((?:[eE][+-]?\d+)?)[A-Za-zµΩ%°/²]*$/.exec(s);
    if (!m) return NAN;
    let n = m[2];
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(n)) n = n.replace(/\./g, '');
    n = n.replace(',', '.');
    if (!/^\d+(\.\d+)?$|^\.\d+$/.test(n)) return NAN;
    const v = parseFloat(m[1] + n + m[3]);
    return fin(v) ? v : NAN;
  }
  function fmtDe(v, dec, group) {
    if (!fin(v)) return '–'; dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
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
  function fmtSig(v, n) {
    if (!fin(v)) return '–'; if (v === 0) return '0'; n = n || 3;
    const e = Math.floor(Math.log10(Math.abs(v))), d = Math.max(0, n - 1 - e);
    return fmtN(v, Math.min(d, 9), true);
  }
  /* 4,5·10⁻⁷ (Zehnerpotenz hochgestellt) */
  function fmtExp(v, dig) {
    if (!fin(v) || v <= 0) return '–'; dig = dig == null ? 2 : dig;
    let e = Math.floor(Math.log10(v) + 1e-12), m = v / Math.pow(10, e); if (rd(m, dig - 1) >= 10) { m /= 10; e++; }
    const sup = String(e).replace(/-/g, '⁻').replace(/\d/g, c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]);
    return fmtN(m, dig - 1, false) + '·10' + sup;
  }
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ================================================================ 1. CE, Richtlinien, Konformitätsbewertung */
  const DIRS = [
    { id: 'LVD', name: 'Niederspannungsrichtlinie', ref: '2014/35/EU', ce: true },
    { id: 'EMV', name: 'EMV-Richtlinie', ref: '2014/30/EU', ce: true },
    { id: 'MD', name: 'Maschinenrichtlinie / Maschinenverordnung', ref: '2006/42/EG, ab 20.01.2027 (EU) 2023/1230', ce: true },
    { id: 'RED', name: 'Funkanlagenrichtlinie (RED)', ref: '2014/53/EU', ce: true },
    { id: 'ROHS', name: 'RoHS-Richtlinie', ref: '2011/65/EU', ce: true },
    { id: 'WEEE', name: 'WEEE-Richtlinie', ref: '2012/19/EU', ce: false },
    { id: 'REACH', name: 'REACH-Verordnung', ref: '(EG) Nr. 1907/2006', ce: false }
  ];
  const DIR = {}; DIRS.forEach(d => { DIR[d.id] = d; });
  const EXC = { gross: 'ortsfeste Großanlage oder Großwerkzeug', fahrzeug: 'Fahrzeug / Verkehrsmittel', militaer: 'Militärausrüstung' };
  function norm(p) {
    p = p || {};
    const q = { ee: !!p.ee, funktion: p.funktion !== false, funk: !!p.funk, maschine: !!p.maschine, vac: Math.max(0, +p.vac || 0), vdc: Math.max(0, +p.vdc || 0), ausnahme: EXC[p.ausnahme] ? p.ausnahme : '' };
    if (q.funk) q.ee = true;
    return q;
  }
  const lvdRange = q => (q.vac >= 50 && q.vac <= 1000) || (q.vdc >= 75 && q.vdc <= 1500);
  /* Gesamtbild: für jede Rechtsvorschrift gilt/gilt nicht plus Begründung (Lernmodell, vereinfacht) */
  function directives(p) {
    const q = norm(p), app = q.ee && q.funktion, low = q.vac <= 1000 && q.vdc <= 1500;
    const rows = [];
    const add = (id, applies, yes, no) => rows.push({ id, applies, text: applies ? yes : no });
    add('LVD', app && !q.funk && !q.maschine && lvdRange(q), 'Elektrisches Gerät mit Bemessungsspannung im Bereich 50 bis 1000 V AC bzw. 75 bis 1500 V DC.',
      !app ? 'Kein elektrisches Gerät mit eigener Funktion (zum Beispiel nur ein Bauteil).' : q.funk ? 'Funkanlage: Die Sicherheitsanforderungen stehen in der RED (Artikel 3).' : q.maschine ? 'Maschine: Die elektrischen Gefährdungen sind über die Maschinenrichtlinie erfasst, deren Konformitätsverfahren gilt.' : 'Spannung außerhalb des Bereichs 50 bis 1000 V AC bzw. 75 bis 1500 V DC.');
    add('EMV', app && !q.funk, 'Das Gerät kann Störungen aussenden oder durch Störungen beeinträchtigt werden.', !app ? 'Kein Gerät mit eigener Funktion für Endnutzer (Bauteil).' : 'Funkanlage: Die EMV-Schutzziele stehen in der RED (Artikel 3).');
    add('MD', q.maschine, 'Angetriebene Gesamtheit mit beweglichen Teilen (Maschine).', 'Keine Maschine: keine angetriebenen beweglichen Teile.');
    add('RED', app && q.funk, 'Das Gerät sendet oder empfängt absichtlich Funkwellen.', 'Keine absichtliche Funkfunktion.');
    const rw = app && low && !q.ausnahme;
    add('ROHS', rw, 'Elektro- und Elektronikgerät bis 1000 V AC bzw. 1500 V DC: Stoffbeschränkungen.', !app ? 'Bauteil ohne eigene Funktion: Die Anforderung gilt für das fertige Gerät.' : !low ? 'Bemessungsspannung über 1000 V AC bzw. 1500 V DC: außerhalb des Geltungsbereichs.' : 'Ausnahme: ' + EXC[q.ausnahme] + '.');
    add('WEEE', rw, 'Elektro- und Elektronikgerät: Rücknahme, Sammlung und Entsorgung (in Deutschland ElektroG).', !app ? 'Bauteil ohne eigene Funktion: Die Anforderung gilt für das fertige Gerät.' : !low ? 'Bemessungsspannung über 1000 V AC bzw. 1500 V DC: außerhalb des Geltungsbereichs.' : 'Ausnahme: ' + EXC[q.ausnahme] + '.');
    add('REACH', true, 'Gilt für jedes Produkt: Stoffe in Erzeugnissen, Informationspflicht bei besonders besorgniserregenden Stoffen über 0,1 %.', '');
    const list = rows.filter(r => r.applies).map(r => r.id);
    return { rows, list, ce: list.some(id => DIR[id].ce), ceList: list.filter(id => DIR[id].ce) };
  }
  const PRODUCTS = [
    { id: 'netzteil', name: 'Steckernetzteil 230 V → 12 V', p: { ee: 1, vac: 230 } },
    { id: 'led', name: 'LED-Leuchte 230 V', p: { ee: 1, vac: 230 } },
    { id: 'router', name: 'WLAN-Router (230 V)', p: { ee: 1, funk: 1, vac: 230 } },
    { id: 'kopfh', name: 'Bluetooth-Kopfhörer (Akku 3,7 V)', p: { ee: 1, funk: 1, vdc: 3.7 } },
    { id: 'uhr', name: 'Smartwatch (Akku 3,8 V, Bluetooth)', p: { ee: 1, funk: 1, vdc: 3.8 } },
    { id: 'sps', name: 'SPS-Baugruppe 24 V DC', p: { ee: 1, vdc: 24 } },
    { id: 'fu', name: 'Frequenzumrichter 400 V', p: { ee: 1, vac: 400 } },
    { id: 'saege', name: 'Elektro-Kappsäge 230 V', p: { ee: 1, maschine: 1, vac: 230 } },
    { id: 'schrauber', name: 'Akku-Schrauber 18 V', p: { ee: 1, maschine: 1, vdc: 18 } },
    { id: 'fraese', name: 'Ortsfeste Großfräsmaschine 400 V', p: { ee: 1, maschine: 1, vac: 400, ausnahme: 'gross' } },
    { id: 'pruef', name: 'Mittelspannungs-Schaltgerät 10 kV AC', p: { ee: 1, vac: 10000 } },
    { id: 'widerstand', name: 'Widerstand 1 kΩ (Bauteil)', p: { ee: 1, funktion: false } },
    { id: 'hydraulik', name: 'Pneumatische Presse (Druckluft, ohne Elektrik)', p: { maschine: 1 } }
  ];
  /* Konformitätsbewertung: Reihenfolge mit Abhängigkeiten (eigene Gliederung, keine Normgliederung) */
  const STEPS = [
    { id: 'rl', name: 'Anwendbare Rechtsvorschriften bestimmen', after: [] },
    { id: 'norm', name: 'Harmonisierte Normen auswählen', after: ['rl'] },
    { id: 'risk', name: 'Risikobeurteilung durchführen', after: ['rl'] },
    { id: 'konstr', name: 'Konstruieren, Schutzmaßnahmen umsetzen, prüfen', after: ['norm', 'risk'] },
    { id: 'doku', name: 'Technische Dokumentation zusammenstellen', after: ['konstr'] },
    { id: 'verf', name: 'Konformitätsbewertungsverfahren abschließen', after: ['doku'] },
    { id: 'kerkl', name: 'EU-Konformitätserklärung ausstellen', after: ['verf'] },
    { id: 'ce', name: 'CE-Kennzeichnung anbringen', after: ['kerkl'] },
    { id: 'inv', name: 'Produkt in Verkehr bringen', after: ['ce'] },
    { id: 'aufb', name: 'Unterlagen aufbewahren (10 Jahre)', after: ['inv'] }
  ];
  const STEP = {}; STEPS.forEach(s => { STEP[s.id] = s; });
  function stepsOk(order) {
    if (!Array.isArray(order) || order.length !== STEPS.length) return false;
    const seen = new Set();
    for (const id of order) { const s = STEP[id]; if (!s || seen.has(id)) return false; if (!s.after.every(a => seen.has(a))) return false; seen.add(id); }
    return true;
  }
  const stepsAvailable = done => STEPS.filter(s => !done.includes(s.id) && s.after.every(a => done.includes(a))).map(s => s.id);
  /* Konformitätsbewertungsverfahren (Lernmodell): 'intern' = Hersteller allein (interne Fertigungskontrolle), 'benannt' = Benannte Stelle muss mitwirken,
     'wahl' = Hersteller darf wählen (Maschine aus der Anhang-IV-Liste, wenn die harmonisierten Normen angewandt sind) */
  function verfahren(id, o) {
    o = o || {};
    if (id === 'MD') return o.anhangIV ? (o.normen === false ? 'benannt' : 'wahl') : 'intern';
    if (id === 'RED') return o.normen === false ? 'benannt' : 'intern';
    if (id === 'LVD' || id === 'EMV' || id === 'ROHS') return 'intern';
    return null;
  }
  const ROHS_LIMITS = [
    { id: 'Pb', name: 'Blei (Pb)', pct: 0.1 }, { id: 'Hg', name: 'Quecksilber (Hg)', pct: 0.1 }, { id: 'Cr6', name: 'sechswertiges Chrom (Cr⁶⁺)', pct: 0.1 },
    { id: 'PBB', name: 'polybromierte Biphenyle (PBB)', pct: 0.1 }, { id: 'PBDE', name: 'polybromierte Diphenylether (PBDE)', pct: 0.1 },
    { id: 'DEHP', name: 'Phthalat DEHP', pct: 0.1 }, { id: 'BBP', name: 'Phthalat BBP', pct: 0.1 }, { id: 'DBP', name: 'Phthalat DBP', pct: 0.1 }, { id: 'DIBP', name: 'Phthalat DIBP', pct: 0.1 },
    { id: 'Cd', name: 'Cadmium (Cd)', pct: 0.01 }
  ];
  const rohsLimitPct = id => { const r = ROHS_LIMITS.find(x => x.id === id); return r ? r.pct : NAN; };
  const sharePct = (mSub, mTot) => (mSub >= 0 && mTot > 0 ? mSub / mTot * 100 : NAN);
  const exceeds = (pct, limit) => fin(pct) && fin(limit) && pct > limit + 1e-12;
  const rohsMaxMass = (id, mMat) => mMat * rohsLimitPct(id) / 100;
  const REACH_PCT = 0.1;

  /* ================================================================ 2. Schutzarten, Kategorien, Strecken */
  const SK = {
    1: { name: 'Schutzklasse I', kurz: 'Basisisolierung plus Anschluss des Gehäuses an den Schutzleiter (PE)', symbol: 'Schutzleiter-Symbol' },
    2: { name: 'Schutzklasse II', kurz: 'Schutzisolierung (doppelte oder verstärkte Isolierung), kein Schutzleiter', symbol: 'Doppelquadrat' },
    3: { name: 'Schutzklasse III', kurz: 'Betrieb mit Kleinspannung (SELV oder PELV), keine gefährliche Spannung im Gerät', symbol: 'Raute mit römisch III' }
  };
  const IP1 = ['kein Schutz gegen feste Körper', 'Fremdkörper ab 50 mm (zum Beispiel Handrücken)', 'Fremdkörper ab 12,5 mm (zum Beispiel Finger)', 'Fremdkörper ab 2,5 mm (Werkzeug, dicker Draht)', 'Fremdkörper ab 1 mm (dünner Draht)', 'staubgeschützt (Staub dringt nicht in schädlicher Menge ein)', 'staubdicht (kein Staub dringt ein)'];
  const IP2 = ['kein Schutz gegen Wasser', 'senkrecht fallende Tropfen', 'schräg fallende Tropfen (bis 15°)', 'Sprühwasser (bis 60°)', 'Spritzwasser aus allen Richtungen', 'Strahlwasser (Düse)', 'starkes Strahlwasser', 'zeitweiliges Untertauchen (1 m, 30 min)', 'dauerndes Untertauchen (nach Herstellerangabe)', 'Hochdruck- und Heißwasserstrahl (nahe, aus mehreren Winkeln)'];
  function ipParse(s) {
    const m = /^IP([0-6X])([0-9X])$/i.exec(String(s == null ? '' : s).trim());
    if (!m) return null;
    return { a: /x/i.test(m[1]) ? null : +m[1], b: /x/i.test(m[2]) ? null : +m[2] };
  }
  const ipStr = (a, b) => 'IP' + (a == null ? 'X' : a) + (b == null ? 'X' : b);
  /* Zweite Ziffer: 0-6 bauen aufeinander auf; 7 und 8 (Untertauchen) schließen Tropf-, Sprüh- und Spritzwasser (1-4) ein, aber nicht Strahlwasser (5, 6);
     9 (Strahl heiß) wird vorsichtig als eigener Zweig behandelt (schließt weder 5/6 noch 7/8 ein) */
  const covers2 = (rb, ab) => (rb <= 4 ? (ab >= rb && ab <= 8) : rb <= 6 ? (ab >= rb && ab <= 6) : rb <= 8 ? (ab >= rb && ab <= 8) : ab === 9);
  function ipCovers(req, act) {
    const r = typeof req === 'string' ? ipParse(req) : req, a = typeof act === 'string' ? ipParse(act) : act;
    if (!r || !a) return null;
    if (r.a != null && !(a.a != null && a.a >= r.a)) return false;
    if (r.b != null) {
      if (a.b == null) return false;
      if (!covers2(r.b, a.b)) return false;
    }
    return true;
  }
  const SOLID = { keine: 0, gross: 1, finger: 2, werkzeug: 3, draht: 4, staub: 5, staubdicht: 6 };
  const ipRequired = (solid, water) => (SOLID[solid] == null || !(water >= 0 && water <= 9 && Number.isInteger(water)) ? null : ipStr(SOLID[solid], water));
  /* Überspannungskategorien: Bemessungs-Stoßspannung in V nach Spannung Leiter–Neutral des Netzes (Zeile = obere Grenze) */
  const IMPULSE_ROWS = [[50, [330, 500, 800, 1500]], [100, [500, 800, 1500, 2500]], [150, [800, 1500, 2500, 4000]], [300, [1500, 2500, 4000, 6000]], [600, [2500, 4000, 6000, 8000]], [1000, [4000, 6000, 8000, 12000]]];
  function impulseV(uLn, cat) {
    if (!(uLn > 0) || !(cat >= 1 && cat <= 4) || !Number.isInteger(cat)) return NAN;
    const row = IMPULSE_ROWS.find(r => uLn <= r[0]); return row ? row[1][cat - 1] : NAN;
  }
  const IMPULSE_SERIES = [330, 500, 800, 1500, 2500, 4000, 6000, 8000, 12000];
  const stepUp = v => { const i = IMPULSE_SERIES.indexOf(v); return i < 0 || i === IMPULSE_SERIES.length - 1 ? NAN : IMPULSE_SERIES[i + 1]; };
  const CAT_TEXT = { 4: 'Einspeisung: Hausanschluss, Zähler, Hauptsicherung (vor der Hauptverteilung)', 3: 'Festinstallation: Verteiler, Installationsgeräte, ortsfeste Industriegeräte', 2: 'Verbrauchsmittel: Haushaltsgeräte und Geräte am Steckdosenkreis', 1: 'Geräte mit besonderem Überspannungsschutz davor, zum Beispiel Elektronik hinter Schutzbeschaltung' };
  /* Luftstrecke (Lernmodell, homogenes Feld nicht berücksichtigt, ungünstiger Fall): Tabellenwert zur Stoßspannung, mindestens der Wert zum Verschmutzungsgrad, mal Höhenfaktor */
  const CLR = { 330: 0.01, 500: 0.04, 800: 0.1, 1500: 0.5, 2500: 1.5, 4000: 3.0, 6000: 5.5, 8000: 8.0, 12000: 14.0 };
  const PD_MIN = { 1: 0, 2: 0.2, 3: 0.8 };
  const altFactor = h => (!(h >= 0) ? NAN : h <= 2000 ? 1 : h <= 3000 ? 1.14 : h <= 4000 ? 1.29 : h <= 5000 ? 1.48 : NAN);
  /* Kriechstrecke (Lernmodell, Grundisolierung, Werte nach oben gerundete Zeile): Arbeitsspannung eff., Verschmutzungsgrad 2 und 3, Werkstoffgruppe I, II, III */
  const CR_V = [250, 400, 500, 630];
  /* Verschmutzungsgrad 1: eigene Kriechstreckenwerte, werkstoffunabhängig (nie kleiner als die Luftstrecke) */
  const CR1 = [0.56, 1.0, 1.3, 1.8];
  const CR = { 2: [[1.25, 1.8, 2.5], [2.0, 2.8, 4.0], [2.5, 3.6, 5.0], [3.2, 4.5, 6.3]], 3: [[3.2, 3.6, 4.0], [5.0, 5.6, 6.3], [6.3, 7.1, 8.0], [8.0, 9.0, 10.0]] };
  const ctiGroup = cti => (!(cti >= 100) ? null : cti >= 600 ? 'I' : cti >= 400 ? 'II' : cti >= 175 ? 'IIIa' : 'IIIb');
  const grpIdx = g => (g === 'I' ? 0 : g === 'II' ? 1 : g === 'IIIa' || g === 'IIIb' || g === 'III' ? 2 : -1);
  /* Gesamtberechnung. inp = {uLn, cat, uw, pd, cti|group, reinforced, altitude}. Ergebnis mit Zwischenschritten */
  function isolation(inp) {
    const o = { ok: false }, pd = inp.pd, rein = !!inp.reinforced;
    if (!(pd === 1 || pd === 2 || pd === 3)) { o.err = 'Das Lernmodell kennt nur die Verschmutzungsgrade 1 bis 3.'; return o; }
    const imp = impulseV(inp.uLn, inp.cat); if (!fin(imp)) { o.err = 'Für diese Netzspannung oder Kategorie gibt es keinen Wert im Lernmodell.'; return o; }
    const impUsed = rein ? stepUp(imp) : imp; if (!fin(impUsed)) { o.err = 'Eine Stufe über dieser Stoßspannung gibt es im Lernmodell nicht.'; return o; }
    const af = altFactor(inp.altitude == null ? 2000 : inp.altitude); if (!fin(af)) { o.err = 'Das Lernmodell gilt bis 5000 m Höhe.'; return o; }
    const tab = CLR[impUsed], clrBase = Math.max(tab * af, PD_MIN[pd]), clr = rd(clrBase, 3);
    let group = inp.group || ctiGroup(inp.cti); if (grpIdx(group) < 0) { o.err = 'Werkstoffgruppe fehlt oder CTI unter 100.'; return o; }
    const rowI = CR_V.findIndex(v => inp.uw <= v);
    let crBasic, rowV = null;
    if (pd === 1) { if (rowI < 0 || !(inp.uw > 0)) { o.err = 'Arbeitsspannung außerhalb 0 bis 630 V (Lernmodell).'; return o; } rowV = CR_V[rowI]; crBasic = CR1[rowI]; }
    else { if (rowI < 0 || !(inp.uw > 0)) { o.err = 'Arbeitsspannung außerhalb 0 bis 630 V (Lernmodell).'; return o; } rowV = CR_V[rowI]; crBasic = CR[pd][rowI][grpIdx(group)]; }
    const crTab = rd(crBasic * (rein ? 2 : 1), 3), crp = rd(Math.max(crTab, clr), 3);
    return { ok: true, imp, impUsed, tab, af, clearance: clr, group, rowV, crBasic, crTab, creepage: crp, creepFromClr: crp > crTab, reinforced: rein, pd };
  }
  const isolationCheck = (req, aClr, aCrp) => ({ clrOk: aClr >= req.clearance - 1e-9, crpOk: aCrp >= req.creepage - 1e-9 });

  /* ================================================================ 3. Maschinensicherheit */
  const PLS = ['a', 'b', 'c', 'd', 'e'];
  const RG = { '1-1-1': 'a', '1-1-2': 'b', '1-2-1': 'b', '1-2-2': 'c', '2-1-1': 'c', '2-1-2': 'd', '2-2-1': 'd', '2-2-2': 'e' };
  const riskGraph = (S, F, P) => RG[S + '-' + F + '-' + P] || null;
  const plRank = pl => PLS.indexOf(pl) + 1;
  const plMeets = (ach, req) => plRank(ach) >= plRank(req) && plRank(ach) > 0 && plRank(req) > 0;
  /* Obere Grenzen je Stunde: PL a: 1e-5..1e-4, b: 3e-6..1e-5, c: 1e-6..3e-6, d: 1e-7..1e-6, e: 1e-8..1e-7 */
  function plFromPfh(p) {
    if (!(p > 0)) return null; if (p >= 1e-4) return { pl: null, none: true };
    if (p >= 1e-5) return { pl: 'a' }; if (p >= 3e-6) return { pl: 'b' }; if (p >= 1e-6) return { pl: 'c' }; if (p >= 1e-7) return { pl: 'd' }; if (p >= 1e-8) return { pl: 'e' };
    return { pl: 'e', beyond: true };
  }
  function silFromPfh(p) {
    if (!(p > 0)) return null; if (p >= 1e-5) return { sil: 0 };
    if (p >= 1e-6) return { sil: 1 }; if (p >= 1e-7) return { sil: 2 }; if (p >= 1e-8) return { sil: 3 };
    return { sil: 3, beyond: true };
  }
  const SIL_OF_PL = { a: 0, b: 1, c: 1, d: 2, e: 3 };
  const mttfdClass = y => (!(y >= 3) ? null : y < 10 ? 'niedrig' : y < 30 ? 'mittel' : 'hoch');
  const dcClass = dc => (!(dc >= 0) ? null : dc < 60 ? 'keine' : dc < 90 ? 'niedrig' : dc < 99 ? 'mittel' : 'hoch');
  const capMttfd = y => Math.min(y, 100);
  const CATS = ['B', '1', '2', '3', '4'];
  /* Vereinfachte Zuordnung (Lernmodell) Kategorie × DCavg × MTTFd-Klasse → erreichbarer PL; null = Kombination nicht zulässig */
  const CATPL = {
    B: { keine: { niedrig: 'a', mittel: 'b', hoch: 'b' } },
    1: { keine: { hoch: 'c' } },
    2: { niedrig: { niedrig: 'a', mittel: 'b', hoch: 'c' }, mittel: { niedrig: 'b', mittel: 'c', hoch: 'd' } },
    3: { niedrig: { niedrig: 'b', mittel: 'c', hoch: 'd' }, mittel: { niedrig: 'c', mittel: 'd', hoch: 'd' } },
    4: { hoch: { hoch: 'e' } }
  };
  const plFromCat = (cat, mc, dc) => { const a = CATPL[cat]; const b = a && a[dc]; return (b && b[mc]) || null; };
  const mttfdSeries = arr => { if (!arr.length || arr.some(x => !(x > 0))) return NAN; return 1 / arr.reduce((s, x) => s + 1 / x, 0); };
  const mttfdTwoChannel = (a, b) => (a > 0 && b > 0 ? 2 / 3 * (a + b - 1 / (1 / a + 1 / b)) : NAN);
  /* DCavg = Σ(DC_i/MTTFd_i) / Σ(1/MTTFd_i), items = [[DC in %, MTTFd]] */
  const dcAvg = items => { if (!items.length || items.some(x => !(x[1] > 0) || !(x[0] >= 0))) return NAN; return items.reduce((s, x) => s + x[0] / x[1], 0) / items.reduce((s, x) => s + 1 / x[1], 0); };
  const pfhSum = arr => (arr.length && arr.every(x => x >= 0) ? arr.reduce((s, x) => s + x, 0) : NAN);
  /* Not-Halt-Logik (zweikanalig). Taster b, Kanal-1-Defekt d1; Kanal 1 geschlossen = !b && !d1, Kanal 2 = !b. */
  const NH_EVENTS = ['NH', 'LOESEN', 'K1_AUF', 'K1_ZU', 'WARTE', 'RESET', 'START', 'STOP'];
  const nhInit = () => ({ b: false, d1: false, st: 'WARTEN_RESET', disc: false });
  function nhStep(s, ev) {
    const n = { b: s.b, d1: s.d1, st: s.st, disc: s.disc };
    if (ev === 'NH') n.b = true; else if (ev === 'LOESEN') n.b = false; else if (ev === 'K1_AUF') n.d1 = true; else if (ev === 'K1_ZU') n.d1 = false;
    const c1 = !n.b && !n.d1, c2 = !n.b;
    if (!c1 && !c2) { n.st = 'NOTHALT'; n.disc = false; }
    else if (c1 !== c2) { if (n.st !== 'FEHLER') { n.st = 'NOTHALT'; n.disc = true; } if (ev === 'WARTE' && n.disc) n.st = 'FEHLER'; }
    else if (n.st === 'NOTHALT') { n.st = 'WARTEN_RESET'; n.disc = false; }
    else if (ev === 'RESET' && n.st === 'WARTEN_RESET') n.st = 'BEREIT';
    else if (ev === 'START' && n.st === 'BEREIT') n.st = 'LAEUFT';
    else if (ev === 'STOP' && n.st === 'LAEUFT') n.st = 'BEREIT';
    return n;
  }
  const nhRun = evs => evs.reduce(nhStep, nhInit());
  const NH_TEXT = { NOTHALT: 'Not-Halt wirkt: Ausgänge aus', FEHLER: 'Fehler (Kanäle uneinig): verriegelt, Ausgänge aus', WARTEN_RESET: 'Ausgänge aus, wartet auf Rücksetzen', BEREIT: 'Freigabe erteilt, Maschine steht, wartet auf Start', LAEUFT: 'Maschine läuft' };
  const NH_EV_TEXT = { NH: 'Not-Halt drücken', LOESEN: 'Not-Halt entriegeln', K1_AUF: 'Kanal 1 fällt aus (Drahtbruch)', K1_ZU: 'Kanal 1 wieder in Ordnung', WARTE: 'Diskrepanzzeit läuft ab', RESET: 'Rücksetzen', START: 'Start', STOP: 'Normal-Stopp' };
  const stopCatOkForEstop = c => c === 0 || c === 1;
  /* Sicherheitsabstand Lichtvorhang (Annäherung senkrecht, Lernmodell): S = K·T + C; d = Detektionsvermögen in mm, T = Gesamtnachlaufzeit in s */
  function safetyDistance(d, T) {
    if (!(d > 0 && d <= 70) || !(T > 0)) return NAN;
    if (d <= 40) { const C = Math.max(0, 8 * (d - 14)); let S = 2000 * T + C; if (S > 500) { S = 1600 * T + C; if (S < 500) S = 500; } return rd(Math.max(S, 100), 3); }
    return rd(1600 * T + 850, 3);
  }

  /* ================================================================ 4. Prüfen elektrischer Geräte */
  const peLimit = len => {
    if (!(len >= 0)) return NAN; const n = len <= 5 ? 0 : Math.ceil(Math.round((len - 5) * 100) / 750 - 1e-9);
    return Math.min(1, rd(0.3 + 0.1 * n, 1));
  };
  const heatBig = (heater, pw) => !!heater && pw >= 3500;
  const isoLimit = (sk, heater, pw) => (sk === 1 ? (heater ? 0.3 : 1) : sk === 2 ? 2 : sk === 3 ? 0.25 : NAN);
  const leakLimit = (sk, heater, pw) => (sk === 1 ? (heatBig(heater, pw) ? Math.min(10, pw / 1000) : 3.5) : sk === 2 ? 0.5 : null);
  const PROC = [{ id: 'sicht', name: 'Sichtprüfung' }, { id: 'pe', name: 'Schutzleiterwiderstand' }, { id: 'iso', name: 'Isolationswiderstand' }, { id: 'ab', name: 'Schutzleiter- bzw. Berührungsstrom' }, { id: 'funk', name: 'Funktionsprüfung' }, { id: 'doku', name: 'Dokumentation und Kennzeichnung' }];
  const procSequence = sk => PROC.map(p => p.id).filter(id => !(id === 'pe' && sk !== 1) && !(id === 'ab' && sk === 3));
  const procOk = (order, sk) => { const s = procSequence(sk); return Array.isArray(order) && order.length === s.length && order.every((x, i) => x === s[i]); };
  /* dev = {sk, len, pw, heater}, m = {vis: true wenn ohne Mangel, pe (Ω), iso (MΩ), leak (mA), func: true} */
  function evaluate(dev, m) {
    const steps = []; let fail = null;
    const push = s => { s.skipped = !!fail; s.ok = fail ? null : s.ok; if (!fail && s.ok === false) fail = s.id; steps.push(s); };
    push({ id: 'sicht', name: 'Sichtprüfung', applies: true, limit: null, value: null, unit: '', ok: !!m.vis, note: m.vis ? 'ohne Mangel' : 'Mangel festgestellt' });
    if (dev.sk === 1) { const l = peLimit(dev.len); push({ id: 'pe', name: 'Schutzleiterwiderstand', applies: true, limit: l, cmp: '≤', value: m.pe, unit: 'Ω', ok: fin(m.pe) && m.pe <= l + 1e-12 }); }
    else steps.push({ id: 'pe', name: 'Schutzleiterwiderstand', applies: false, note: 'entfällt (kein Schutzleiter)', ok: null, skipped: false });
    { const l = isoLimit(dev.sk, dev.heater, dev.pw); push({ id: 'iso', name: 'Isolationswiderstand', applies: true, limit: l, cmp: '≥', value: m.iso, unit: 'MΩ', ok: fin(m.iso) && m.iso >= l - 1e-12 }); }
    { const l = leakLimit(dev.sk, dev.heater, dev.pw); if (l == null) steps.push({ id: 'ab', name: 'Schutzleiter- bzw. Berührungsstrom', applies: false, note: 'entfällt im Lernmodell (Kleinspannung)', ok: null, skipped: false }); else push({ id: 'ab', name: 'Schutzleiter- bzw. Berührungsstrom', applies: true, limit: l, cmp: '≤', value: m.leak, unit: 'mA', ok: fin(m.leak) && m.leak <= l + 1e-12 }); }
    push({ id: 'funk', name: 'Funktionsprüfung', applies: true, limit: null, value: null, unit: '', ok: m.func !== false, note: m.func !== false ? 'Funktion in Ordnung' : 'Funktion gestört' });
    const verdict = fail ? 'nicht bestanden' : 'bestanden';
    return { steps, verdict, failAt: fail, action: fail ? 'Gerät kennzeichnen und nicht benutzen, Mangel beheben lassen, danach vollständig neu prüfen.' : 'Prüfergebnis dokumentieren, Prüfplakette und nächsten Termin festlegen.' };
  }
  const usage = (value, limit) => (limit > 0 ? value / limit * 100 : NAN);

  /* ================================================================ 5. Qualität */
  function daysFromCivil(y, m, d) {
    y -= m <= 2 ? 1 : 0; const era = Math.floor(y / 400), yoe = y - era * 400, doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1, doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }
  function civilFromDays(z) {
    z += 719468; const era = Math.floor(z / 146097), doe = z - era * 146097, yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)), mp = Math.floor((5 * doy + 2) / 153), d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp + (mp < 10 ? 3 : -9);
    return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
  }
  const parseIso = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s)); if (!m) return null; const y = +m[1], mo = +m[2], d = +m[3]; return mo >= 1 && mo <= 12 && d >= 1 && d <= dim(y, mo) ? [y, mo, d] : null; };
  const leap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  function dim(y, m) { return [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }
  const p2 = n => String(n).padStart(2, '0');
  const isoOf = ymd => ymd[0] + '-' + p2(ymd[1]) + '-' + p2(ymd[2]);
  const dayNum = s => { const a = parseIso(s); return a ? daysFromCivil(a[0], a[1], a[2]) : NAN; };
  const isoFromDay = n => isoOf(civilFromDays(n));
  const daysBetween = (a, b) => dayNum(b) - dayNum(a);
  function addMonths(s, n) {
    const a = parseIso(s); if (!a || !Number.isInteger(n)) return null;
    const t = a[0] * 12 + (a[1] - 1) + n, y = Math.floor(t / 12), m = ((t % 12) + 12) % 12 + 1;
    return isoOf([y, m, Math.min(a[2], dim(y, m))]);
  }
  const fmtDate = s => { const a = parseIso(s); return a ? p2(a[2]) + '.' + p2(a[1]) + '.' + a[0] : '–'; };
  const weekday = s => { const z = dayNum(s); return fin(z) ? (((z % 7) + 7 + 4) % 7) : NAN; };   /* 0 = Sonntag */
  /* Arbeitstage (Mo–Fr) nach Tag a bis einschließlich Tag b */
  function workdays(a, b) {
    const n = daysBetween(a, b); if (!fin(n) || n < 0) return NAN;
    const wd0 = weekday(isoFromDay(dayNum(a) + 1)); let c = Math.floor(n / 7) * 5;
    for (let i = 0; i < n % 7; i++) { const w = (wd0 + i) % 7; if (w !== 0 && w !== 6) c++; }
    return c;
  }
  function calStatus(last, months, today, warn) {
    const due = addMonths(last, months); if (!due || !fin(dayNum(today))) return null;
    const left = daysBetween(today, due), w = warn == null ? 30 : warn;
    return { due, left, status: left < 0 ? 'ueberfaellig' : left <= w ? 'bald' : 'gueltig' };
  }
  const CAL_TEXT = { gueltig: 'gültig', bald: 'bald fällig', ueberfaellig: 'überfällig' };
  const capability = (tol, u) => (tol > 0 && u > 0 ? tol / u : NAN);
  /* Dokumentenlenkung: gültig ist die höchste freigegebene Revision, deren Gültigkeitsdatum erreicht ist. docs = [{rev, status:'entwurf'|'frei'|'zurueck', ab:'YYYY-MM-DD'}] */
  function validDoc(docs, today) {
    let best = null; const t = dayNum(today); if (!fin(t)) return null;
    docs.forEach(d => { if (d.status === 'frei' && dayNum(d.ab) <= t && (best == null || d.rev > best)) best = d.rev; });
    return best;
  }
  const yieldPct = (good, total) => (total > 0 && good >= 0 && good <= total ? good / total * 100 : NAN);
  const rolled = arr => (arr.length && arr.every(x => x >= 0 && x <= 100) ? arr.reduce((p, x) => p * x / 100, 1) * 100 : NAN);
  const ppm = (def, n) => (n > 0 && def >= 0 && def <= n ? def / n * 1e6 : NAN);
  const CLAUSES = [
    { k: '4', name: 'Kontext der Organisation (Rahmen des Zyklus)', phase: 'P' }, { k: '5', name: 'Führung (Verantwortung der obersten Leitung, Mitte des Zyklus)', phase: 'P' }, { k: '6', name: 'Planung (Risiken und Chancen, Ziele)', phase: 'P' },
    { k: '7', name: 'Unterstützung (Ressourcen, Kompetenz, dokumentierte Information)', phase: 'D' }, { k: '8', name: 'Betrieb (Realisierung von Produkten und Dienstleistungen)', phase: 'D' },
    { k: '9', name: 'Bewertung der Leistung (Überwachung, internes Audit, Managementbewertung)', phase: 'C' }, { k: '10', name: 'Verbesserung (Korrekturmaßnahmen)', phase: 'A' }
  ];
  const PHASE = { P: 'Plan (Planen)', D: 'Do (Durchführen)', C: 'Check (Prüfen)', A: 'Act (Handeln)' };

  /* ================================================================ Quellenliste zur fachlichen Gegenprüfung */
  const SOURCES = [
    ['Richtlinie 2014/35/EU', 'Niederspannungsrichtlinie (LVD): Bereich 50–1000 V AC, 75–1500 V DC'], ['Richtlinie 2014/30/EU', 'EMV-Richtlinie'],
    ['Richtlinie 2006/42/EG', 'Maschinenrichtlinie (abgelöst durch Verordnung (EU) 2023/1230, anwendbar ab 20.01.2027); Anhang I 1.5.1 elektrische Gefährdungen'],
    ['Richtlinie 2014/53/EU', 'Funkanlagenrichtlinie (RED), Artikel 3'], ['Richtlinie 2011/65/EU', 'RoHS (Grenzwerte 0,1 %, Cadmium 0,01 %; Änderung (EU) 2015/863 für vier Phthalate)'],
    ['Richtlinie 2012/19/EU', 'WEEE; in Deutschland ElektroG'], ['Verordnung (EG) Nr. 1907/2006', 'REACH, Artikel 33: Information bei SVHC über 0,1 % je Erzeugnis'],
    ['Beschluss Nr. 768/2008/EG', 'Neuer Rechtsrahmen, Module (zum Beispiel Modul A interne Fertigungskontrolle)'],
    ['DIN EN 60529 (IEC 60529)', 'IP-Schutzarten; Schlüsselzahlen 0–6 und 0–9, Zusatz für IPX7/IPX8 gegenüber IPX5/IPX6'],
    ['DIN EN 60664-1 (VDE 0110-1, IEC 60664-1)', 'Isolationskoordination: Überspannungskategorien I–IV, Stoßspannungen, Luft- und Kriechstrecken, Verschmutzungsgrade 1–4, Werkstoffgruppen (CTI)'],
    ['DIN EN 61140 (VDE 0140-1)', 'Schutz gegen elektrischen Schlag, Schutzklassen I, II, III'],
    ['DIN EN ISO 12100', 'Risikobeurteilung und Risikominderung an Maschinen'], ['DIN EN ISO 13849-1', 'Sicherheitsbezogene Steuerungsteile: Risikograph (S, F, P), PLr, PL a–e, PFHd, Kategorien B–4, MTTFd, DCavg'],
    ['DIN EN 62061 (IEC 62061)', 'SIL 1–3 bei Maschinen, PFH-Bereiche'], ['IEC 61508', 'Funktionale Sicherheit, SIL (PFH-Bereiche bei hoher Anforderungsrate)'],
    ['DIN EN ISO 13850', 'Not-Halt: Gestaltungsleitsätze, Stopp-Kategorie 0 oder 1'], ['DIN EN 60204-1 (VDE 0113-1)', 'Elektrische Ausrüstung von Maschinen, Stopp-Kategorien 0, 1, 2'],
    ['DIN EN ISO 13855', 'Anordnung von Schutzeinrichtungen im Hinblick auf Annäherungsgeschwindigkeiten: S = K·T + C (Rechenmodell nach der Ausgabe 2010, Mindestwert 100 mm; die Ausgabe 2025 nennt die Größen anders (Trennungsabstand) und verlangt zusätzliche Zuschläge, an der aktuellen Ausgabe prüfen)'],
    ['DIN EN 50678 (VDE 0701)', 'Prüfung nach Instandsetzung (früher DIN VDE 0701-0702)'], ['DIN EN 50699 (VDE 0702)', 'Wiederholungsprüfung (früher DIN VDE 0701-0702)'],
    ['DIN EN ISO 9001:2015', 'QM-Systeme (Normbezug Ausgabe 2015; Ausgabe 2026 ist erschienen, Abschnittsnummern prüfen): Abschnitte 4–10; 7.1.5 Überwachungs- und Messmittel, 7.5 dokumentierte Information, 9.2 internes Audit, 9.3 Managementbewertung, 10.2 Korrekturmaßnahmen'],
    ['DIN EN ISO/IEC 17025', 'Kalibrierlaboratorien (nur Erwähnung, DAkkS-Akkreditierung)']
  ];

  /* ================================================================ Unabhängige Zweitrechnungen (anderer Rechenweg) */
  const chk = {
    /* Richtlinien: Wahrheitswerte über Summen statt Verkettung */
    directives(p) {
      const q = norm(p), b = x => (x ? 1 : 0), app = b(q.ee && q.funktion), fk = b(q.funk), mc = b(q.maschine), rng = b(lvdRange(q)), rw = app * b(q.vac <= 1000) * b(q.vdc <= 1500) * b(!q.ausnahme);
      const v = { LVD: (app + (1 - fk) + (1 - mc) + rng) === 4, EMV: app + (1 - fk) === 2, MD: mc === 1, RED: app + fk === 2, ROHS: rw === 1, WEEE: rw === 1, REACH: true };
      return DIRS.filter(d => v[d.id]).map(d => d.id);
    },
    /* Reihenfolge: Positionstabelle */
    stepsOk(order) {
      if (!Array.isArray(order) || order.length !== STEPS.length) return false; const pos = {}; order.forEach((id, i) => { if (pos[id] != null) pos[id] = -1; else pos[id] = i; });
      return STEPS.every(s => pos[s.id] != null && pos[s.id] >= 0 && s.after.every(a => pos[a] != null && pos[a] >= 0 && pos[a] < pos[s.id]));
    },
    /* IP: kleinster Code, der beides abdeckt (Suche in aufsteigender Reihenfolge) */
    ipMin(solid, water) {
      for (let a = 0; a <= 6; a++) for (let b = 0; b <= 9; b++) { const code = 'IP' + a + b; if (a >= (SOLID[solid] || 0) && ipCovers(ipStr(null, water), code) && ipCovers(ipStr(SOLID[solid], null), code)) return code; }
      return null;
    },
    /* Stoßspannung: Textform der Tabelle */
    impulse(uLn, cat) {
      const t = '50:330,500,800,1500;100:500,800,1500,2500;150:800,1500,2500,4000;300:1500,2500,4000,6000;600:2500,4000,6000,8000;1000:4000,6000,8000,12000';
      const rows = t.split(';').map(r => r.split(':')).map(r => [+r[0], r[1].split(',').map(Number)]);
      for (let i = 0; i < rows.length; i++) if (uLn <= rows[i][0]) return rows[i][1][cat - 1];
      return NAN;
    },
    /* Luft- und Kriechstrecke: Berechnung aus einer in Textform notierten Tabelle, ohne Hilfsfunktionen */
    isolation(inp) {
      const clrTxt = '330=0.01 500=0.04 800=0.1 1500=0.5 2500=1.5 4000=3 6000=5.5 8000=8 12000=14', ser = clrTxt.split(' ').map(x => x.split('=').map(Number));
      const imp0 = this.impulse(inp.uLn, inp.cat); let k = ser.findIndex(x => x[0] === imp0); if (inp.reinforced) k++;
      const pdMin = [0, 0, 0.2, 0.8][inp.pd], hf = inp.altitude <= 2000 ? 1 : inp.altitude <= 3000 ? 1.14 : inp.altitude <= 4000 ? 1.29 : 1.48;
      const clr = Math.round(Math.max(ser[k][1] * hf, pdMin) * 1000) / 1000;
      const grp = inp.group || (inp.cti >= 600 ? 'I' : inp.cti >= 400 ? 'II' : 'III'), gi = grp === 'I' ? 0 : grp === 'II' ? 1 : 2;
      let base;
      if (inp.pd === 1) base = +'0.56,1,1.3,1.8'.split(',')[[250, 400, 500, 630].findIndex(v => inp.uw <= v)];
      else { const rowsTxt = inp.pd === 2 ? '1.25,1.8,2.5|2,2.8,4|2.5,3.6,5|3.2,4.5,6.3' : '3.2,3.6,4|5,5.6,6.3|6.3,7.1,8|8,9,10'; const vs = [250, 400, 500, 630]; const ri2 = vs.findIndex(v => inp.uw <= v); base = +rowsTxt.split('|')[ri2].split(',')[gi]; }
      const crp = Math.round(Math.max(base * (inp.reinforced ? 2 : 1), clr) * 1000) / 1000;
      return { clearance: clr, creepage: crp };
    },
    /* PLr: Formel statt Tabelle */
    riskGraph(S, F, P) { return 'abcde'[2 * (S - 1) + (F - 1) + (P - 1)]; },
    /* PL aus PFHd über ganzzahlige Pikostunden-Skala */
    plFromPfh(p) { const n = Math.round(p * 1e12); if (n >= 1e8) return null; return n >= 1e7 ? 'a' : n >= 3e6 ? 'b' : n >= 1e6 ? 'c' : n >= 1e5 ? 'd' : 'e'; },
    silFromPfh(p) { const n = Math.round(p * 1e12); return n >= 1e7 ? 0 : n >= 1e6 ? 1 : n >= 1e5 ? 2 : 3; },
    /* Kategorie → PL aus einer Zeichenketten-Tabelle */
    plFromCat(cat, mc, dc) {
      const rows = 'B|keine|niedrig:a,mittel:b,hoch:b;1|keine|hoch:c;2|niedrig|niedrig:a,mittel:b,hoch:c;2|mittel|niedrig:b,mittel:c,hoch:d;3|niedrig|niedrig:b,mittel:c,hoch:d;3|mittel|niedrig:c,mittel:d,hoch:d;4|hoch|hoch:e'.split(';');
      for (const r of rows) { const [c, d, cells] = r.split('|'); if (c === String(cat) && d === dc) { const m = cells.split(',').map(x => x.split(':')).find(x => x[0] === mc); return m ? m[1] : null; } }
      return null;
    },
    /* MTTFd seriell über Leitwerte, zweikanalig über Symmetrieformel mit Kehrwerten */
    mttfdTwo(a, b) { const s = 1 / a + 1 / b; return (2 * (a + b) - 2 / s) / 3; },
    /* Not-Halt: Zustandsmuster, jede Zustandsart als eigene Funktion */
    nhRun(evs) {
      let b = false, d1 = false, st = 'WARTEN_RESET', disc = false;
      for (const ev of evs) {
        const before = { b, d1, st, disc };
        if (ev === 'NH') b = true; if (ev === 'LOESEN') b = false; if (ev === 'K1_AUF') d1 = true; if (ev === 'K1_ZU') d1 = false;
        const open1 = b || d1, open2 = b;
        if (open1 && open2) { st = 'NOTHALT'; disc = false; continue; }
        if (open1 !== open2) { if (before.st === 'FEHLER') { st = 'FEHLER'; } else { st = ev === 'WARTE' ? 'FEHLER' : 'NOTHALT'; disc = true; } continue; }
        if (st === 'NOTHALT') { st = 'WARTEN_RESET'; disc = false; }
        else if (ev === 'RESET' && st === 'WARTEN_RESET') st = 'BEREIT';
        else if (ev === 'START' && st === 'BEREIT') st = 'LAEUFT';
        else if (ev === 'STOP' && st === 'LAEUFT') st = 'BEREIT';
      }
      return { b, d1, st, disc };
    },
    /* Verfahren als Tabelle */
    verfahren(id, o) {
      o = o || {}; const tab = { 'MD|1|0': 'wahl', 'MD|1|1': 'wahl', 'MD|1|x': 'wahl', 'MD|0': 'intern', 'RED|n': 'benannt', 'RED|y': 'intern' };
      if (id === 'MD') return !o.anhangIV ? tab['MD|0'] : o.normen === false ? 'benannt' : tab['MD|1|x'];
      if (id === 'RED') return tab[o.normen === false ? 'RED|n' : 'RED|y'];
      return ['LVD', 'EMV', 'ROHS'].indexOf(id) >= 0 ? 'intern' : null;
    },
    safetyDistance(d, T) {
      const C = d <= 40 ? Math.max(0, 8 * (d - 14)) : 850, S20 = 2000 * T + C, S16 = 1600 * T + C;
      if (d > 40) return Math.round(S16 * 1000) / 1000;
      return Math.round(Math.max(100, S20 <= 500 ? S20 : Math.max(500, S16)) * 1000) / 1000;
    },
    peLimit(len) { let lim = 0.3, up = 5; while (len > up + 1e-9 && lim < 0.99) { lim += 0.1; up += 7.5; } return Math.round(Math.min(lim, 1) * 10) / 10; },
    /* Datum: JS-Date statt Zivilkalender-Formel */
    addMonths(s, n) { const [y, m, d] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(d, last)); return t.toISOString().slice(0, 10); },
    daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); },
    workdays(a, b) { let c = 0; for (let t = Date.parse(a + 'T00:00:00Z') + 86400000, e = Date.parse(b + 'T00:00:00Z'); t <= e; t += 86400000) { const w = new Date(t).getUTCDay(); if (w !== 0 && w !== 6) c++; } return c; },
    validDoc(docs, today) { const ok = docs.filter(d => d.status === 'frei' && d.ab <= today).sort((x, y) => y.rev - x.rev); return ok.length ? ok[0].rev : null; },
    rolled(arr) { return Math.exp(arr.reduce((s, x) => s + Math.log(x / 100), 0)) * 100; }
  };

  const API = {
    parseDe, fmtDe, fmtN, fmtSig, fmtExp, rd, hashStr, rng, ri, pick, shuffle,
    DIRS, DIR, EXC, norm, lvdRange, directives, PRODUCTS, STEPS, STEP, stepsOk, stepsAvailable, verfahren, ROHS_LIMITS, rohsLimitPct, sharePct, exceeds, rohsMaxMass, REACH_PCT,
    SK, IP1, IP2, ipParse, ipStr, ipCovers, SOLID, ipRequired, IMPULSE_ROWS, impulseV, IMPULSE_SERIES, stepUp, CAT_TEXT, CLR, PD_MIN, altFactor, CR_V, CR, ctiGroup, isolation, isolationCheck,
    PLS, riskGraph, plRank, plMeets, plFromPfh, silFromPfh, SIL_OF_PL, mttfdClass, dcClass, capMttfd, CATS, CATPL, plFromCat, mttfdSeries, mttfdTwoChannel, dcAvg, pfhSum,
    NH_EVENTS, nhInit, nhStep, nhRun, NH_TEXT, NH_EV_TEXT, stopCatOkForEstop, safetyDistance,
    peLimit, isoLimit, leakLimit, PROC, procSequence, procOk, evaluate, usage,
    parseIso, isoOf, dayNum, isoFromDay, daysBetween, addMonths, fmtDate, weekday, workdays, calStatus, CAL_TEXT, capability, validDoc, yieldPct, rolled, ppm, CLAUSES, PHASE,
    SOURCES, chk
  };
  root.NRM_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
