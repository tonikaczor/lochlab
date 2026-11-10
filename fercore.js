'use strict';
/* Tonfunk Fertigungs-Lab: reine Rechenlogik (Kennung 'fer'). window.FER_CORE bzw. module.exports.
   Alle Werte (Gewinde-Kernlöcher, Durchgangslöcher, Zuschläge, Dichten, Grenzwerte der Regelkarte) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Planung echter Aufträge.
   Maßgebend sind Tabellenbuch, Zeichnung, Arbeitsplan und die Vorgaben des Betriebs.
   Konventionen: Länge in mm, Masse in kg, Zeit in min, Geld in €, Winkel in Grad, Anteile in Prozent (wenn "%" dabei steht).
   Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN, nie Infinity.
   Abgrenzung: Zerspanungswerte (Schnittgeschwindigkeit, Drehzahl) gehören ins zerlab, Toleranzen und Messen ins tollab, CNC ins cnclab, Werkstoffkunde ins werlab,
   Instandhaltung ins inslab, Fügeverfahren im Detail ins fuglab. Hier gibt es dazu nur die Einordnung. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const pos = v => (num(v) > 0);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(mm²|mm2|mm|min|kg|stk|stück|eur|€|%|°|h|m)$/i, '');
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
  /* Zahlenliste aus Text (Trenner: Leerzeichen, Semikolon, Zeilenumbruch; Komma ist das Dezimalkomma) */
  function parseList(s) {
    const out = []; String(s == null ? '' : s).split(/[;\s]+/).forEach(x => { if (x === '') return; const v = parseDe(x); if (fin(v)) out.push(v); });
    return out;
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
  /* Normalverteilter Zufallswert (Box-Muller) */
  function gauss(R) { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); }

  /* ============================================================ Fertigungsverfahren nach DIN 8580 */
  /* PRUEFEN P1: Die sechs Hauptgruppen nach DIN 8580 (1 Urformen, 2 Umformen, 3 Trennen, 4 Fügen, 5 Beschichten, 6 Stoffeigenschaft ändern) mit der Kennzeichnung des Zusammenhalts
     (schaffen, beibehalten, vermindern, vermehren, vermehren, ändern). Stimmen Reihenfolge, Begriffe und die Zuordnung der Beispiele (z. B. Sintern als Urformen, Gewindeschneiden und Sägen als Trennen, Nieten und Kleben als Fügen) mit dem Lehrmaterial überein? */
  const GROUPS = [
    { n: 1, k: 'urf', t: 'Urformen', z: 'schaffen', zl: 'Zusammenhalt schaffen', d: 'Aus formlosem Stoff (flüssig, pulvrig, körnig) entsteht zum ersten Mal ein fester Körper mit einer Form.', m: 'Vom Stoff zum ersten festen Körper.', col: 1 },
    { n: 2, k: 'umf', t: 'Umformen', z: 'beibehalten', zl: 'Zusammenhalt beibehalten', d: 'Die Form eines festen Körpers wird plastisch verändert, ohne dass Stoff verloren geht oder dazukommt.', m: 'Form ändern, Stoff bleibt zusammen.', col: 2 },
    { n: 3, k: 'tre', t: 'Trennen', z: 'vermindern', zl: 'Zusammenhalt vermindern', d: 'Der Zusammenhalt wird örtlich aufgehoben: Stoffteile lösen sich ab (Späne, Abfall) oder das Werkstück wird geteilt.', m: 'Etwas wird abgelöst oder geteilt.', col: 3 },
    { n: 4, k: 'fue', t: 'Fügen', z: 'vermehren', zl: 'Zusammenhalt vermehren', d: 'Mehrere Werkstücke werden dauerhaft oder lösbar zu einer Einheit verbunden.', m: 'Aus mehreren Teilen wird eines.', col: 4 },
    { n: 5, k: 'bes', t: 'Beschichten', z: 'vermehren', zl: 'Zusammenhalt vermehren', d: 'Auf die Oberfläche kommt eine fest haftende Schicht aus formlosem Stoff.', m: 'Eine Schicht kommt obendrauf.', col: 5 },
    { n: 6, k: 'stoff', t: 'Stoffeigenschaft ändern', z: 'ändern', zl: 'Stoffeigenschaften ändern', d: 'Das Gefüge oder die Zusammensetzung des Werkstoffs wird verändert, die Form bleibt (nahezu) gleich.', m: 'Gleiche Form, andere Eigenschaften.', col: 6 }
  ];
  const group = n => GROUPS[n - 1] || null;
  const PROC = [
    { p: 'Gießen', g: 1 }, { p: 'Sintern von Metallpulver', g: 1 }, { p: 'Spritzgießen', g: 1 },
    { p: 'Biegen', g: 2 }, { p: 'Schmieden', g: 2 }, { p: 'Tiefziehen', g: 2 }, { p: 'Walzen', g: 2 }, { p: 'Richten', g: 2 },
    { p: 'Sägen', g: 3 }, { p: 'Feilen', g: 3 }, { p: 'Bohren', g: 3 }, { p: 'Gewindeschneiden', g: 3 }, { p: 'Scherschneiden', g: 3 },
    { p: 'Schrauben', g: 4 }, { p: 'Nieten', g: 4 }, { p: 'Löten', g: 4 }, { p: 'Schweißen', g: 4 }, { p: 'Kleben', g: 4 },
    { p: 'Lackieren', g: 5 }, { p: 'Galvanisch Verzinken', g: 5 }, { p: 'Pulverbeschichten', g: 5 },
    { p: 'Härten', g: 6 }, { p: 'Anlassen', g: 6 }, { p: 'Glühen', g: 6 }, { p: 'Nitrieren', g: 6 }
  ];
  const procGroup = name => { const x = PROC.find(o => o.p === name); return x ? x.g : NAN; };

  /* ============================================================ Handfertigung: Gewinde, Bohren, Reiben */
  /* PRUEFEN P2: Kernlochdurchmesser für metrische Regelgewinde zum Schneiden von Hand (Richtwert Nenndurchmesser minus Steigung, gerundet): M3 2,5; M4 3,3; M5 4,2; M6 5,0; M8 6,8; M10 8,5; M12 10,2; M16 14,0; M20 17,5 mm.
     Steigungen: 0,5; 0,7; 0,8; 1,0; 1,25; 1,5; 1,75; 2,0; 2,5. Stimmen die Werte mit der Tabelle im Tabellenbuch der Werkstatt überein? */
  const THREADS = {
    3: { d: 3, P: 0.5, kern: 2.5, durch: 3.4 }, 4: { d: 4, P: 0.7, kern: 3.3, durch: 4.5 }, 5: { d: 5, P: 0.8, kern: 4.2, durch: 5.5 },
    6: { d: 6, P: 1, kern: 5, durch: 6.6 }, 8: { d: 8, P: 1.25, kern: 6.8, durch: 9 }, 10: { d: 10, P: 1.5, kern: 8.5, durch: 11 },
    12: { d: 12, P: 1.75, kern: 10.2, durch: 13.5 }, 16: { d: 16, P: 2, kern: 14, durch: 17.5 }, 20: { d: 20, P: 2.5, kern: 17.5, durch: 22 }
  };
  const TH_LIST = [3, 4, 5, 6, 8, 10, 12, 16, 20];
  const thread = d => THREADS[d] || null;
  const kernloch = d => (THREADS[d] ? THREADS[d].kern : NAN);
  const pitch = d => (THREADS[d] ? THREADS[d].P : NAN);
  /* Faustformel zur Kontrolle: Kernloch ≈ d − P */
  const kernFaust = d => (THREADS[d] ? d - THREADS[d].P : NAN);
  /* PRUEFEN P3: Durchgangsloch für Schrauben, mittlere Reihe nach DIN EN 20273: M3 3,4; M4 4,5; M5 5,5; M6 6,6; M8 9; M10 11; M12 13,5; M16 17,5; M20 22 mm. Verwendet ihr die mittlere Reihe, oder die feine (z. B. M8 = 8,4 mm)? */
  const durchgang = d => (THREADS[d] ? THREADS[d].durch : NAN);
  /* PRUEFEN P4: Sackloch-Gewinde: nutzbare Gewindetiefe T plus Auslauf für den Gewindebohrer; Übungswert 3 · P. Dazu der Richtwert T = 1,5 · d für Stahl (Einschraubtiefe). Passt das zur Praxis in der Werkstatt? */
  const AUSLAUF_P = 3, EINSCHRAUB = 1.5;
  const bohrtiefe = (T, d) => (pos(T) && THREADS[d] ? T + AUSLAUF_P * THREADS[d].P : NAN);
  const gewTiefe = d => (THREADS[d] ? EINSCHRAUB * d : NAN);
  /* PRUEFEN P5: Vorbohren zum Reiben: Aufmaß je nach Durchmesser 0,1 mm (bis 10 mm), 0,2 mm (über 10 bis 20 mm); Handreibahle immer im Uhrzeigersinn drehen, auch beim Zurückziehen. Übungswerte, die Praxis nutzt Herstellertabellen. */
  const reibAufmass = D => (pos(D) ? (D <= 10 ? 0.1 : 0.2) : NAN);
  const vorbohr = (D, z) => { const a = z == null ? reibAufmass(D) : z; return pos(D) && num(a) >= 0 ? D - a : NAN; };
  /* Anriss: Lage der k-ten Bohrung in einer Reihe (Randabstand r, Teilung t) */
  const lochLage = (r, t, k) => (num(r) >= 0 && num(t) >= 0 && k >= 1 ? r + (k - 1) * t : NAN);

  /* ============================================================ Biegen */
  /* PRUEFEN P6: Übungsmodell der gestreckten Länge: Die neutrale Faser liegt in der Blechmitte (Radius r + s/2, r = Innenradius, s = Blechdicke), ihre Länge bleibt beim Biegen gleich.
     Bogenlänge b = π · (r + s/2) · α / 180°. In der Praxis wandert die neutrale Faser bei kleinen Radien nach innen (k-Faktor, Tabellen des Biegewerkzeug-Herstellers, Rückfederung). Ist das Mittenmodell für die Grundausbildung ausreichend,
     oder arbeitet ihr mit Ausgleichswerten aus Tabellen (v bei 90°) bzw. einem k-Faktor (z. B. 0,33 bis 0,5 je nach r/s)? */
  const K_NEUTRAL = 0.5;
  const arc = (r, s, a, k) => (num(r) >= 0 && pos(s) && pos(a) ? Math.PI * (r + (k == null ? K_NEUTRAL : k) * s) * a / 180 : NAN);
  /* Außenmaße im Winkel- oder U-Profil (alle Biegungen 90°): Länge = Summe der Außenmaße − Biegungen · (2 · (r + s) − Bogen) */
  const ausgleich = (r, s) => { const b = arc(r, s, 90); return fin(b) ? 2 * (r + s) - b : NAN; };
  function lenOuter(dims, r, s) {
    if (!Array.isArray(dims) || dims.length < 2 || !dims.every(pos) || !(num(r) >= 0) || !pos(s)) return NAN;
    const n = dims.length - 1, v = ausgleich(r, s), sum = dims.reduce((a, b) => a + b, 0);
    const L = sum - n * v; return ok(dims, r, s) ? L : NAN;
  }
  /* Außenmaße müssen mindestens die Biegezonen aufnehmen: Endschenkel ≥ r + s, Mittelschenkel ≥ 2 · (r + s) */
  function ok(dims, r, s) { const n = dims.length; return dims.every((x, i) => x >= (i === 0 || i === n - 1 ? 1 : 2) * (r + s) - 1e-9); }
  /* Gerade Schenkel + Bögen: straights = gerade Längen zwischen den Biegezonen, ang = Biegewinkel (Umlenkung) je Biegung */
  function lenStraight(straights, angs, r, s) {
    if (!Array.isArray(straights) || !Array.isArray(angs) || straights.length !== angs.length + 1 || !straights.every(x => num(x) >= 0) || !angs.every(pos) || !(num(r) >= 0) || !pos(s)) return NAN;
    return straights.reduce((a, b) => a + b, 0) + angs.reduce((a, al) => a + arc(r, s, al), 0);
  }
  /* Rückrechnung: fehlender zweiter Außenmaß eines Winkels bei bekannter gestreckter Länge */
  const otherOuter = (L, a, r, s) => (pos(L) && pos(a) ? L - a + ausgleich(r, s) : NAN);
  /* Zerlegung in Teilstücke für die Zeichnung: Reihenfolge gerade / Bogen / gerade ... mit Längen */
  function bendParts(dims, r, s) {
    if (!fin(lenOuter(dims, r, s))) return null;
    const n = dims.length, out = [], b = arc(r, s, 90);
    dims.forEach((x, i) => { const cut = (i === 0 || i === n - 1 ? 1 : 2) * (r + s); out.push({ t: 's', l: x - cut }); if (i < n - 1) out.push({ t: 'b', l: b, a: 90 }); });
    return out;
  }

  /* ============================================================ Fertigungsplanung */
  /* Rohteil: Fertiglänge + Zugabe je bearbeiteter Stirnseite */
  const rohlaenge = (fertig, zug, seiten) => (pos(fertig) && num(zug) >= 0 ? fertig + zug * (seiten == null ? 2 : seiten) : NAN);
  /* Teile aus einer Stange: Jeder Schnitt kostet die Schnittbreite k, das letzte Teil endet am Stangenende (n Teile = n − 1 Schnitte) */
  const partsFromBar = (L, l, k) => (pos(L) && pos(l) && num(k) >= 0 ? Math.max(0, Math.floor((L + k) / (l + k) + 1e-9)) : NAN);
  const barRest = (L, l, k) => { const n = partsFromBar(L, l, k); return fin(n) ? (n > 0 ? L - n * l - (n - 1) * k : L) : NAN; };
  /* Schachtelung rechteckiger Teile im Raster: Tafel W × H, Teil w × h, Stegbreite e zwischen den Teilen, Rand rr rundum; beide Lagen werden probiert */
  function nest(W, H, w, h, e, rr) {
    if (![W, H, w, h].every(pos) || !(num(e) >= 0) || !(num(rr) >= 0)) return { n: NAN, nx: 0, ny: 0, rot: false };
    const cnt = (a, b) => { const nx = Math.floor((W - 2 * rr + e) / (a + e) + 1e-9), ny = Math.floor((H - 2 * rr + e) / (b + e) + 1e-9); return { nx: Math.max(0, nx), ny: Math.max(0, ny), n: Math.max(0, nx) * Math.max(0, ny) }; };
    const A = cnt(w, h), B = cnt(h, w);
    return B.n > A.n ? { n: B.n, nx: B.nx, ny: B.ny, rot: true, w: h, h: w } : { n: A.n, nx: A.nx, ny: A.ny, rot: false, w, h };
  }
  const nestUtil = (W, H, w, h, e, rr) => { const r = nest(W, H, w, h, e, rr); return fin(r.n) ? r.n * w * h / (W * H) * 100 : NAN; };
  /* PRUEFEN P24: Dichten für die Masseberechnung: Stahl 7,85, Aluminium 2,7, Kupfer 8,9 kg/dm³ (Rundwerte aus dem Tabellenbuch). Passen die Werte und die Werkstoffauswahl (z. B. Edelstahl 7,9, Messing 8,5) zu euren Aufgaben? Masse einer Platine: l · b · s in mm. */
  const DENS = { Stahl: 7.85, Aluminium: 2.7, Kupfer: 8.9 };
  const mass = (l, b, s, rho) => (pos(l) && pos(b) && pos(s) && pos(rho) ? l * b * s * rho / 1e6 : NAN);
  /* Zeiten nach dem Schema Grundzeit tg = th + tn, Zeit je Einheit te = tg · (1 + Erholzuschlag + Verteilzuschlag), Auftragszeit T = tr + m · te
     PRUEFEN P7: Vereinfachtes Zeitschema (Haupt- und Nebenzeit, Zuschläge in Prozent der Grundzeit, Rüstzeit je Auftrag). Welche Bezeichnungen und Zuschlagssätze (Erholzeit, Verteilzeit) verwendet ihr (z. B. nach REFA)? */
  const tg = (th, tn) => (num(th) >= 0 && num(tn) >= 0 ? th + tn : NAN);
  const te = (th, tn, zE, zV) => (fin(tg(th, tn)) && num(zE) >= 0 && num(zV) >= 0 ? tg(th, tn) * (1 + (zE + zV) / 100) : NAN);
  const auftragszeit = (tr, m, tE) => (num(tr) >= 0 && pos(m) && num(tE) >= 0 ? tr + m * tE : NAN);
  /* Kosten je Stück: Material + (Rüstzeit auf die Stückzahl verteilt + Zeit je Einheit) · Stundensatz / 60 */
  const kostenStk = (mat, tr, m, tE, satz) => (num(mat) >= 0 && num(tr) >= 0 && pos(m) && num(tE) >= 0 && num(satz) >= 0 ? mat + (tr / m + tE) * satz / 60 : NAN);
  const ruestAnteil = (tr, m, satz) => (num(tr) >= 0 && pos(m) && num(satz) >= 0 ? tr * satz / 60 / m : NAN);
  /* Zwei Verfahren: Gesamtkosten K = Kr + m · kv; gleich teuer bei m* = (Kr2 − Kr1) / (kv1 − kv2) */
  const gleichTeuer = (kr1, kv1, kr2, kv2) => { const dn = kv1 - kv2; return fin(dn) && Math.abs(dn) > 1e-12 && num(kr1) >= 0 && num(kr2) >= 0 ? (kr2 - kr1) / dn : NAN; };

  /* ============================================================ Qualitätssicherung */
  const mean = a => (Array.isArray(a) && a.length && a.every(fin) ? a.reduce((x, y) => x + y, 0) / a.length : NAN);
  const range = a => (Array.isArray(a) && a.length && a.every(fin) ? Math.max.apply(null, a) - Math.min.apply(null, a) : NAN);
  const sdev = a => { if (!Array.isArray(a) || a.length < 2 || !a.every(fin)) return NAN; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };
  /* PRUEFEN P8: Prozessfähigkeit, nur Grundidee: Cp = (OGW − UGW) / (6 · σ) vergleicht die Toleranzbreite mit der Streubreite ±3σ, Cpk = min(OGW − μ, μ − UGW) / (3 · σ) berücksichtigt zusätzlich die Lage des Mittelwerts.
     Als Richtwert gilt "fähig" ab 1,33 (Cpk), manche Betriebe fordern 1,67 oder nur 1,0 für unkritische Merkmale. Welcher Wert gilt bei euch? */
  const CPK_MIN = 1.33;
  const cp = (ugw, ogw, sigma) => (fin(ugw) && fin(ogw) && ogw > ugw && pos(sigma) ? (ogw - ugw) / (6 * sigma) : NAN);
  const cpk = (ugw, ogw, mu, sigma) => (fin(ugw) && fin(ogw) && ogw > ugw && fin(mu) && pos(sigma) ? Math.min(ogw - mu, mu - ugw) / (3 * sigma) : NAN);
  /* Normalverteilung: Verteilungsfunktion über erfc (relative Genauigkeit besser als 1,2e-7) */
  function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
  const phi = z => 0.5 * erfc(-z / Math.SQRT2);
  const pdf = (x, mu, sigma) => (pos(sigma) ? Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2)) / (sigma * Math.sqrt(2 * Math.PI)) : NAN);
  /* erwarteter Anteil außerhalb der Toleranz in Prozent (Normalverteilung vorausgesetzt) */
  const outShare = (ugw, ogw, mu, sigma) => (fin(ugw) && fin(ogw) && fin(mu) && pos(sigma) ? (phi((ugw - mu) / sigma) + 1 - phi((ogw - mu) / sigma)) * 100 : NAN);
  /* Klassen (Strichliste): k gleich breite Klassen ab lo, Klasse i = [lo + i·w, lo + (i+1)·w) */
  function classes(values, lo, w, k) {
    if (!Array.isArray(values) || !fin(lo) || !pos(w) || !(k >= 1)) return [];
    const out = []; for (let i = 0; i < k; i++) out.push({ lo: lo + i * w, hi: lo + (i + 1) * w, n: 0 });
    values.forEach(v => { const i = Math.floor((v - lo) / w + 1e-9); if (i >= 0 && i < k) out[i].n++; });
    return out;
  }
  /* Klassenzahl grob nach Wurzelregel, Klassenbreite = Spannweite / k */
  const klassenZahl = n => (n >= 1 ? Math.max(3, Math.round(Math.sqrt(n))) : NAN);
  /* Qualitätsregelkarte (Einzelwerte): Mittellinie, Eingriffsgrenzen ±3σ, Warngrenzen ±2σ.
     PRUEFEN P9: Regeln zum Lesen der Karte: Eingriff, wenn ein Punkt außerhalb der Eingriffsgrenzen liegt, 7 Punkte in Folge steigen oder fallen (Trend) oder 7 Punkte in Folge auf einer Seite der Mittellinie liegen (Lage). Die Zahl 7 und die Warngrenzen bei 2σ sind Übungswerte; in manchen Betrieben gelten 6, 8 oder 9 Punkte bzw. andere Regelwerke. Was gilt bei euch? */
  const RUN = 7;
  const limits = (mu, sigma, nSub) => { const m = nSub == null ? 1 : nSub, sm = pos(sigma) && m >= 1 ? sigma / Math.sqrt(m) : NAN; return fin(sm) && fin(mu) ? { mid: mu, ueg: mu - 3 * sm, oeg: mu + 3 * sm, uwg: mu - 2 * sm, owg: mu + 2 * sm } : null; };
  function chartRules(series, lim) {
    const out = { aus: [], trend: [], lage: [] };
    if (!Array.isArray(series) || !lim) return out;
    series.forEach((v, i) => { if (v > lim.oeg + 1e-12 || v < lim.ueg - 1e-12) out.aus.push(i); });
    for (let i = 0; i + RUN <= series.length; i++) {
      let up = true, dn = true, hi = true, lo = true;
      for (let j = 0; j < RUN; j++) { const v = series[i + j]; if (j > 0) { if (!(v > series[i + j - 1])) up = false; if (!(v < series[i + j - 1])) dn = false; } if (!(v > lim.mid)) hi = false; if (!(v < lim.mid)) lo = false; }
      if (up || dn) out.trend.push(i); if (hi || lo) out.lage.push(i);
    }
    return out;
  }
  const chartVerdict = (series, lim) => { const r = chartRules(series, lim); return r.aus.length ? 'aus' : r.trend.length ? 'trend' : r.lage.length ? 'lage' : 'ok'; };
  /* Stichprobenprüfung: Annahme, wenn die Zahl fehlerhafter Teile höchstens der Annahmezahl c entspricht */
  const accept = (fehler, c) => (fehler >= 0 && c >= 0 ? fehler <= c : NAN);
  const share = (bad, n) => (num(bad) >= 0 && pos(n) ? bad / n * 100 : NAN);

  /* ============================================================ Vorrichtungen: Bestimmung der Lage, 3-2-1-Regel */
  /* PRUEFEN P10: Ein frei beweglicher Körper hat 6 Freiheitsgrade (3 Verschiebungen, 3 Drehungen). 3-2-1-Regel: Hauptauflage (größte Fläche) 3 Punkte sperren 3, Führungsfläche 2 Punkte sperren 2, Anschlag 1 Punkt sperrt 1.
     Mehr Punkte als nötig = Überbestimmung (Teil kippelt, verspannt sich). Die Punkte der Hauptauflage dürfen nicht auf einer Geraden liegen (hier nur qualitativ). Passt die Darstellung zum Lehrmaterial, und wie nennt ihr die Flächen (Auflagefläche, Anlagefläche, Anschlagfläche)? */
  const DOF = ['Verschieben in z', 'Drehen um x', 'Drehen um y', 'Verschieben in y', 'Drehen um z', 'Verschieben in x'];
  const FACES = [{ k: 'haupt', t: 'Hauptauflage', max: 3, first: 0 }, { k: 'fuehr', t: 'Führungsfläche', max: 2, first: 3 }, { k: 'anschl', t: 'Anschlag', max: 1, first: 5 }];
  function dof(a, b, c) {
    const cnt = [a, b, c].map(v => (Number.isInteger(v) && v >= 0 ? v : NAN));
    if (!cnt.every(fin)) return null;
    const locked = [], over = [];
    FACES.forEach((f, i) => { const k = Math.min(cnt[i], f.max); for (let j = 0; j < k; j++) locked.push(f.first + j); if (cnt[i] > f.max) over.push({ k: f.k, t: f.t, extra: cnt[i] - f.max }); });
    const free = DOF.map((_, i) => i).filter(i => locked.indexOf(i) < 0);
    return { cnt, locked, free, nLocked: locked.length, nFree: free.length, over, fullyDetermined: free.length === 0 && over.length === 0 };
  }

  const api = {
    fin, rd, num, parseDe, fmtDe, fmtN, parseList, hashStr, rng, ri, pick, shuffle, gauss,
    GROUPS, group, PROC, procGroup,
    THREADS, TH_LIST, thread, kernloch, pitch, kernFaust, durchgang, AUSLAUF_P, EINSCHRAUB, bohrtiefe, gewTiefe, reibAufmass, vorbohr, lochLage,
    K_NEUTRAL, arc, ausgleich, lenOuter, lenStraight, otherOuter, bendParts, bendOk: ok,
    rohlaenge, partsFromBar, barRest, nest, nestUtil, DENS, mass, tg, te, auftragszeit, kostenStk, ruestAnteil, gleichTeuer,
    mean, range, sdev, CPK_MIN, cp, cpk, erfc, phi, pdf, outShare, classes, klassenZahl, RUN, limits, chartRules, chartVerdict, accept, share,
    DOF, FACES, dof
  };
  root.FER_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
