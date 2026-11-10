'use strict';
/* Tonfunk Füge-Lab: reine Rechenlogik (Kennung 'fug'). window.FUG_CORE bzw. module.exports.
   Thema: Fügetechnik nach DIN 8593 im Berufsalltag (Industriemechaniker): Schweißen, Löten, Kleben, Nieten, Schrauben, Welle-Nabe, Klemmen/Stecken.
   Alle Zahlen sind ÜBUNGSWERTE für die Ausbildung, nicht für die Auslegung echter Verbindungen. Maßgebend sind Tabellenbuch, Datenblätter, Normen und die Vorgaben des Betriebs.
   Konventionen: Längen in mm, Kräfte in N (Schrauben in kN), Spannungen in N/mm², Drehmoment in Nm, Temperatur in °C, Differenz in K.
   Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const pos = v => (num(v) > 0 ? v : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(mm²|mm2|n\/mm²|n\/mm2|kn|nm|°c|mm|kw|mpa|cm³|cm3|n|k|g|%)$/i, '');
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

  /* ============================================================ Fügen nach DIN 8593 */
  /* PRUEFEN P1: Gliederung des Fügens (Fertigungshauptgruppe 4) nach DIN 8593 als Nummernfolge 4.1 Zusammensetzen, 4.2 Füllen, 4.3 An- und Einpressen, 4.4 Fügen durch Urformen, 4.5 Fügen durch Umformen, 4.6 Fügen durch Schweißen, 4.7 Fügen durch Löten, 4.8 Kleben, 4.9 Textiles Fügen. Zuordnung der Beispiele: Stifte, Bolzen und Einlegen (Passfeder) = 4.1; Schrauben, Pressverband und Klemmen = 4.3; Nieten, Clinchen, Bördeln = 4.5. Stimmen Nummern und Zuordnung mit dem Tabellenbuch eurer Berufsschule überein? */
  const DIN8593 = [
    { n: '4.1', t: 'Zusammensetzen', ex: 'Stifte, Bolzen, Einlegen (Passfeder)' },
    { n: '4.2', t: 'Füllen', ex: 'Tränken, Einfüllen' },
    { n: '4.3', t: 'An- und Einpressen', ex: 'Schrauben, Pressverband, Klemmen' },
    { n: '4.4', t: 'Fügen durch Urformen', ex: 'Eingießen, Umspritzen' },
    { n: '4.5', t: 'Fügen durch Umformen', ex: 'Nieten, Clinchen, Bördeln' },
    { n: '4.6', t: 'Fügen durch Schweißen', ex: 'Lichtbogenschweißen, MAG, WIG' },
    { n: '4.7', t: 'Fügen durch Löten', ex: 'Weichlöten, Hartlöten' },
    { n: '4.8', t: 'Kleben', ex: 'Klebstoffe auf Metall, Kunststoff' },
    { n: '4.9', t: 'Textiles Fügen', ex: 'Nähen, Verflechten' }
  ];
  /* PRUEFEN P2: Zuordnung der Verfahren zu Stoffschluss, Formschluss und Kraftschluss sowie lösbar/unlösbar (Lehrbuchwissen): Schweißen, Löten, Kleben = stoffschlüssig und unlösbar (ohne Zerstörung); Nieten = formschlüssig, unlösbar; Schrauben = kraftschlüssig (Vorspannung), lösbar; Passfeder = formschlüssig, lösbar; Pressverband = kraftschlüssig, bedingt lösbar; Klemmen = kraftschlüssig, lösbar; Stecken (Bolzen, Stift) = formschlüssig, lösbar. Passt diese Einteilung zu euren Unterlagen (z. B. „Nieten: form- und kraftschlüssig“)? */
  const VERF = {
    sw: { n: 'Schweißen', s: 'Stoffschluss', lo: false, din: '4.6', ex: 'Rahmen, Stahlbau, Behälter', e: 'Die Werkstücke werden an der Fügestelle aufgeschmolzen und fließen ineinander; meist kommt Zusatzwerkstoff dazu.' },
    lo: { n: 'Löten', s: 'Stoffschluss', lo: false, din: '4.7', ex: 'Kupferrohr, Kühler, Hartmetallplatte', e: 'Nur das Lot schmilzt, die Werkstücke bleiben fest. Das flüssige Lot wird in den engen Spalt gesaugt (Kapillarwirkung).' },
    kl: { n: 'Kleben', s: 'Stoffschluss', lo: false, din: '4.8', ex: 'Typschild, Sensorhalter, Blechverkleidung', e: 'Ein Klebstoff haftet an beiden Flächen (Adhäsion) und hält in sich zusammen (Kohäsion). Belastet wird auf Schub, nicht auf Schälen.' },
    ni: { n: 'Nieten', s: 'Formschluss', lo: false, din: '4.5', ex: 'Blechverbindung, Blindniet am Gehäuse', e: 'Der Niet füllt das Loch und wird durch einen Schließkopf gesichert. Er wird auf Abscheren und Lochleibung belastet.' },
    sr: { n: 'Schrauben', s: 'Kraftschluss', lo: true, din: '4.3', ex: 'Flansch, Lagerdeckel, Maschinenfuß', e: 'Das Anziehen spannt die Schraube vor. Die Vorspannkraft presst die Teile zusammen, Reibung überträgt die Querkraft.' },
    wn: { n: 'Welle-Nabe (Passfeder)', s: 'Formschluss', lo: true, din: '4.1', ex: 'Zahnrad auf Welle, Kupplung', e: 'Die Passfeder sitzt in Nuten von Welle und Nabe und überträgt das Drehmoment über ihre Flanken.' },
    pv: { n: 'Pressverband', s: 'Kraftschluss', lo: false, din: '4.3', ex: 'Lagerring, Zahnkranz, Buchse', e: 'Die Welle ist etwas größer als die Bohrung (Übermaß). Die Teile werden gepresst oder durch Erwärmen gefügt, die Pressung hält sie.' },
    kl2: { n: 'Klemmen und Stecken', s: 'Kraftschluss / Formschluss', lo: true, din: '4.3', ex: 'Spannhülse, Bolzen mit Sicherungsring', e: 'Klemmen hält durch Reibung (Kraftschluss), Stecken mit Bolzen oder Stift durch die Form (Formschluss). Beides ist schnell lösbar.' }
  };
  const VERF_ORDER = ['sw', 'lo', 'kl', 'ni', 'sr', 'wn', 'pv', 'kl2'];

  /* ============================================================ Schweißen */
  /* PRUEFEN P3: Kehlnaht: Das a-Maß ist die Höhe des größten einbeschriebenen gleichschenkligen Dreiecks, das z-Maß die Schenkellänge: a = z / √2 ≈ 0,707 · z. Querschnitt des Dreiecks = a² (gleichschenklig, rechtwinklig). Tragende Nahtfläche beim Beanspruchen auf Schub = a · l (l = wirksame Nahtlänge ohne Endkrater). Faustregel für die Nahtdicke a ≈ 0,7 · Blechdicke (kleinere Dicke) ist als Hinweis genannt. Stimmt das, und rechnet ihr in der Schule mit a oder z? */
  const SQ2 = Math.SQRT2, A_PER_T = 0.7;
  const kehlA = z => (pos(z) ? z / SQ2 : NAN);
  const kehlZ = a => (pos(a) ? a * SQ2 : NAN);
  const kehlArea = a => (pos(a) ? a * a : NAN);
  const seamArea = (a, l) => (pos(a) && pos(l) ? a * l : NAN);
  const kehlAmax = t => (pos(t) ? A_PER_T * t : NAN);
  /* Spannung in der Naht: τ = F / (n · a · l), n = Zahl gleicher Nähte */
  const seamStress = (F, a, l, n) => (num(F) >= 0 && pos(a) && pos(l) && (n == null || n > 0) ? F / ((n == null ? 1 : n) * a * l) : NAN);
  const seamForce = (tau, a, l, n) => (num(tau) >= 0 && pos(a) && pos(l) && (n == null || n > 0) ? tau * (n == null ? 1 : n) * a * l : NAN);
  /* PRUEFEN P4: Zusatzwerkstoffmenge aus dem Nahtvolumen: V = a² · l für eine Kehlnaht (Dreieck, ohne Nahtüberhöhung und Einbrand, ohne Abbrand und Spritzer); Masse = Volumen · Dichte, Stahl 7,85 g/cm³. In der Praxis wird mit Zuschlägen (Verlust, Wurzel) gerechnet; hier bewusst die einfache Schulrechnung. */
  const RHO_ST = 7.85;
  const seamVol = (a, l) => (pos(a) && pos(l) ? a * a * l : NAN);
  const seamVolCm3 = (a, l) => (pos(a) && pos(l) ? a * a * l / 1000 : NAN);
  const seamMass = (a, l) => (pos(a) && pos(l) ? a * a * l / 1000 * RHO_ST : NAN);
  /* PRUEFEN P5: Schweißprozesse mit Ordnungsnummer nach ISO 4063: 111 Lichtbogenhandschweißen (umhüllte Stabelektrode), 131 MIG (Metall-Inertgas), 135 MAG (Metall-Aktivgas), 141 WIG (Wolfram-Inertgas, Zusatz als Stab von Hand). Schutzgase: MAG Mischgas aus Argon mit CO2 (oder reines CO2), WIG/MIG Argon. Bitte Nummern, Gase und die übliche Verwendung im Betrieb bestätigen. */
  const PROC = {
    111: { n: 'Lichtbogenhandschweißen (E-Hand)', k: 'Umhüllte Stabelektrode, Umhüllung bildet Schlacke und Schutzgas', gas: 'kein Gasbehälter nötig' },
    131: { n: 'MIG-Schweißen', k: 'Drahtelektrode, inertes Schutzgas (Argon)', gas: 'Argon' },
    135: { n: 'MAG-Schweißen', k: 'Drahtelektrode, aktives Schutzgas (Mischgas aus Argon und CO2 oder CO2)', gas: 'Mischgas Argon/CO2 oder CO2' },
    141: { n: 'WIG-Schweißen', k: 'Nicht abschmelzende Wolframelektrode, Zusatzstab von Hand, Schutzgas Argon', gas: 'Argon' }
  };
  /* PRUEFEN P6: Schweißpositionen nach ISO 6947 (grobe Einordnung für Azubis): PA Wannenlage (Naht liegt oben, am leichtesten), PB horizontale Kehlnaht, PC Querposition (Wand senkrecht, Naht waagerecht), PD horizontal überkopf (Kehlnaht von unten), PE Überkopf, PF steigend, PG fallend. Passt die Einteilung und die Aussage „Wannenlage am einfachsten, Überkopf am schwersten“? */
  const POS = {
    PA: { n: 'Wannenlage', k: 'Die Naht liegt waagerecht von oben erreichbar, die Schmelze bleibt in der „Wanne“. Am einfachsten.' },
    PB: { n: 'Horizontale Kehlnaht', k: 'Kehlnaht an einem waagerechten und einem senkrechten Blech, Brennerführung von der Seite.' },
    PC: { n: 'Querposition', k: 'Die Naht läuft waagerecht an einer senkrechten Wand.' },
    PD: { n: 'Horizontal-Überkopf', k: 'Kehlnaht von unten an einem waagerechten Blech; die Schmelze neigt zum Tropfen.' },
    PE: { n: 'Überkopf', k: 'Die Naht wird von unten geschweißt. Am schwersten, die Schmelze will nach unten.' },
    PF: { n: 'Steigend', k: 'Senkrechte Naht, von unten nach oben geschweißt.' },
    PG: { n: 'Fallend', k: 'Senkrechte Naht, von oben nach unten geschweißt.' }
  };
  /* PRUEFEN P7: Nahtarten und Kurzzeichen im Nahtsymbol nach ISO 2553 / DIN EN 22553: I-Naht (zwei parallele Striche), V-Naht (V), Y-Naht, HV-Naht (halbes V), U-Naht, Kehlnaht (Dreieck), Punktnaht (Kreis). Maße: a- oder z-Maß vor dem Symbol, Nahtlänge dahinter; Kreis am Knick der Bezugslinie = Rundumnaht, Fahne = Baustellennaht. Die Seitenregel (Symbol auf der Seite der durchgezogenen Bezugslinie = Pfeilseite) ist im Lab nur qualitativ erwähnt, nicht abgefragt. Soll sie geübt werden, und wie zeichnet ihr die Strichlinie? */
  const NAHT = {
    I: { n: 'I-Naht', d: 'Stumpfstoß ohne Fugenvorbereitung, für dünne Bleche', fig: 'stumpf' },
    V: { n: 'V-Naht', d: 'Stumpfstoß mit V-förmiger Fuge, für mittlere Blechdicken', fig: 'stumpf' },
    Y: { n: 'Y-Naht', d: 'Stumpfstoß mit V-Fuge und Steg an der Wurzel', fig: 'stumpf' },
    U: { n: 'U-Naht', d: 'Stumpfstoß mit U-förmiger Fuge, für dicke Teile, weniger Nahtvolumen als V', fig: 'stumpf' },
    K: { n: 'Kehlnaht', d: 'Eckverbindung oder Überlappung, Dreiecksquerschnitt mit a-Maß', fig: 'kehl' },
    P: { n: 'Punktnaht', d: 'Punktförmige Verbindung an Überlappungen (Widerstandspunktschweißen)', fig: 'punkt' }
  };
  const NAHT_ORDER = ['I', 'V', 'Y', 'U', 'K', 'P'];

  /* ============================================================ Löten */
  /* PRUEFEN P8: Löten: Weichlöten bei Arbeitstemperatur unter 450 °C, Hartlöten ab 450 °C (Grenze nach DIN ISO 857-2 bzw. DIN 8505, Liquidustemperatur des Lots). Das Lot schmilzt, der Grundwerkstoff nicht. Stimmt die Grenze von 450 °C in eurem Lehrmaterial? */
  const SOLDER_LIMIT = 450;
  const solderKind = T => (num(T) > 0 ? (T < SOLDER_LIMIT ? 'weich' : 'hart') : null);
  /* PRUEFEN P9: Lötspalt als Übungsbereich: Weichlöten 0,05 bis 0,20 mm, Hartlöten 0,05 bis 0,15 mm (Spaltbreite = halber Unterschied von Bohrungs- und Wellendurchmesser, bei Rohr in Muffe). Zu enger Spalt: Lot und Flussmittel kommen schlecht hinein; zu weiter Spalt: Kapillarkraft lässt nach, Festigkeit sinkt. Tabellenbücher nennen zum Teil andere Grenzen je nach Lot; welche Werte gelten bei euch? */
  const GAP = { weich: { lo: 0.05, hi: 0.2 }, hart: { lo: 0.05, hi: 0.15 } };
  const gapRadial = (D, d) => (pos(D) && pos(d) ? (D - d) / 2 : NAN);
  const gapState = (kind, s) => { if (!GAP[kind] || !fin(s)) return null; if (s < GAP[kind].lo - 1e-9) return 'eng'; if (s > GAP[kind].hi + 1e-9) return 'weit'; return 'ok'; };
  const brazeArea = (d, l) => (pos(d) && pos(l) ? Math.PI * d * l : NAN);
  /* PRUEFEN P10: Scherfestigkeit der Lötnaht als Übungswerte (nur in Aufgabentexten genannt): Weichlot etwa 20 N/mm², Hartlot (Silberbasis) etwa 100 N/mm². Reale Werte hängen von Lot, Spalt, Werkstoff und Sicherheitsfaktor ab. Passen die Größenordnungen? */
  const SOLDER_TAU = { weich: 20, hart: 100 };
  const lotForce = (tau, A) => (num(tau) >= 0 && pos(A) ? tau * A : NAN);

  /* ============================================================ Kleben */
  /* PRUEFEN P11: Zugscherfestigkeit τ = F / A mit A = Überlappungsfläche = b · l; Normprobe der Prüfung nach DIN EN 1465: Breite 25 mm, Überlappung 12,5 mm (312,5 mm²). Klebstoffwerte (z. B. 15 N/mm² Bruchfestigkeit) und ein Sicherheitsbeiwert S = 3 sind Übungswerte, die in den Aufgabentexten genannt werden. Stimmen Normmaße und Größenordnungen? */
  const glueArea = (b, l) => (pos(b) && pos(l) ? b * l : NAN);
  const shearStrength = (F, A) => (num(F) >= 0 && pos(A) ? F / A : NAN);
  const glueForceAllow = (tauB, S, A) => (pos(tauB) && pos(S) && pos(A) ? tauB / S * A : NAN);
  const glueAreaNeed = (F, S, tauB) => (num(F) >= 0 && pos(S) && pos(tauB) ? F * S / tauB : NAN);
  const EN1465 = { b: 25, l: 12.5 };

  /* ============================================================ Nieten */
  /* PRUEFEN P12: Halbrundniet: Nietlänge L = Summe der Blechdicken + 1,5 · d (Überstand für den Schließkopf). Scherkraft: F = n · m · (π/4) · d² · τ mit n Nieten und m Scherflächen (schnittig); τ_a,zul = 60 N/mm² ist ein Übungswert und steht im Aufgabentext. Stimmt der Überstand 1,5 · d für Halbrundniete, und wird bei euch mit dem Lochdurchmesser d1 statt d gerechnet? */
  const RIV_OVER = 1.5;
  const rivetLen = (sumT, d) => (pos(sumT) && pos(d) ? sumT + RIV_OVER * d : NAN);
  const rivetArea = d => (pos(d) ? Math.PI * d * d / 4 : NAN);
  const rivetForce = (n, m, d, tau) => (pos(n) && pos(m) && pos(d) && num(tau) >= 0 ? n * m * Math.PI * d * d / 4 * tau : NAN);

  /* ============================================================ Schrauben */
  /* PRUEFEN P13: Festigkeitsklasse x.y: Zugfestigkeit Rm = x · 100 N/mm², Streckgrenze Re = x · y · 10 N/mm² (8.8: 800 und 640; 10.9: 1000 und 900; 12.9: 1200 und 1080; 4.6: 400 und 240). Passende Mutter trägt die Zahl x (Mutter 8 zu Schraube 8.8). */
  const CLASSES = ['4.6', '5.6', '8.8', '10.9', '12.9'];
  const clsParts = c => { const m = /^(\d+)\.(\d+)$/.exec(String(c)); return m ? [+m[1], +m[2]] : null; };
  const boltRm = c => { const p = clsParts(c); return p ? p[0] * 100 : NAN; };
  const boltRe = c => { const p = clsParts(c); return p ? p[0] * p[1] * 10 : NAN; };
  const nutFor = c => { const p = clsParts(c); return p ? p[0] : NAN; };
  /* PRUEFEN P14: Regelgewinde M3 bis M24: Steigung P, Kernlochdurchmesser (Bohrer für Gewindebohren, Faustwert d − P, gerundet auf Tabellenwerte), Durchgangsloch mittel (ISO 273 / DIN EN 20273, Reihe „mittel“), Spannungsquerschnitt As. Bitte die Tabellenwerte gegen euer Tabellenbuch prüfen, insbesondere Durchgangsloch „mittel“ und die Spannungsquerschnitte. */
  const BOLT = {
    M3: { d: 3, P: 0.5, kern: 2.5, dh: 3.4, As: 5.03 },
    M4: { d: 4, P: 0.7, kern: 3.3, dh: 4.5, As: 8.78 },
    M5: { d: 5, P: 0.8, kern: 4.2, dh: 5.5, As: 14.2 },
    M6: { d: 6, P: 1, kern: 5, dh: 6.6, As: 20.1 },
    M8: { d: 8, P: 1.25, kern: 6.8, dh: 9, As: 36.6 },
    M10: { d: 10, P: 1.5, kern: 8.5, dh: 11, As: 58 },
    M12: { d: 12, P: 1.75, kern: 10.2, dh: 13.5, As: 84.3 },
    M14: { d: 14, P: 2, kern: 12, dh: 15.5, As: 115 },
    M16: { d: 16, P: 2, kern: 14, dh: 17.5, As: 157 },
    M20: { d: 20, P: 2.5, kern: 17.5, dh: 22, As: 245 },
    M24: { d: 24, P: 3, kern: 21, dh: 26, As: 353 }
  };
  const BOLT_ORDER = Object.keys(BOLT);
  /* PRUEFEN P15: Übungstabelle der Anzugsmomente in Nm (Gewinde M5 bis M20, Klassen 8.8, 10.9, 12.9) für leicht geölte bzw. übliche Reibungsverhältnisse (Gesamtreibwert etwa 0,12 bis 0,14), gerundet aus gängigen Tabellenwerten. Daraus Vorspannkraft Fv = M / (0,2 · d) (Faustformel mit Beiwert 0,2, M in Nm, d in mm, Ergebnis in kN) und Ausnutzung der Streckgrenze Fv / (Re · As). Bitte die Tabelle mit euren Herstellerangaben abgleichen; echte Montagen richten sich nach Reibwert, Schmierung und Vorschrift. */
  const TORQ = {
    M5: { '8.8': 5.5, '10.9': 8, '12.9': 9.5 },
    M6: { '8.8': 10, '10.9': 15, '12.9': 17 },
    M8: { '8.8': 25, '10.9': 36, '12.9': 43 },
    M10: { '8.8': 49, '10.9': 72, '12.9': 84 },
    M12: { '8.8': 86, '10.9': 125, '12.9': 145 },
    M14: { '8.8': 135, '10.9': 200, '12.9': 235 },
    M16: { '8.8': 210, '10.9': 310, '12.9': 355 },
    M20: { '8.8': 410, '10.9': 610, '12.9': 710 }
  };
  const TORQ_ORDER = Object.keys(TORQ), TORQ_CLS = ['8.8', '10.9', '12.9'];
  const K_TORQ = 0.2;
  const torque = (M, c) => (TORQ[M] && TORQ[M][c] != null ? TORQ[M][c] : NAN);
  const preload = (Mnm, d) => (pos(Mnm) && pos(d) ? Mnm / (K_TORQ * d) : NAN);
  const preloadMax = (M, c) => (BOLT[M] && fin(boltRe(c)) ? boltRe(c) * BOLT[M].As / 1000 : NAN);
  const utilPreload = (Fv, M, c) => { const m = preloadMax(M, c); return fin(m) && num(Fv) >= 0 ? Fv / m : NAN; };
  /* PRUEFEN P16: Mindest-Einschraubtiefe im Gewindeloch: Stahl 1,0 · d, Guss 1,25 · d, Aluminium 2,0 · d (Faustwerte, Werkstofffestigkeit entscheidet). Stimmen die Faktoren, oder verwendet ihr 1,5 für Guss? */
  const DEPTH = { stahl: { n: 'Stahl', f: 1 }, guss: { n: 'Gusseisen', f: 1.25 }, alu: { n: 'Aluminium', f: 2 } };
  const screwDepth = (mat, d) => (DEPTH[mat] && pos(d) ? DEPTH[mat].f * d : NAN);
  /* PRUEFEN P17: Reibschluss: übertragbare Querkraft F = μ · n · Fv (n Reibflächen); Haftreibwert μ = 0,15 für Stahl auf Stahl, trocken, als Übungswert (üblich 0,1 bis 0,2). */
  const MU_T = 0.15;
  const frictionLoad = (Fv, mu, n) => (num(Fv) >= 0 && pos(mu) && pos(n) ? mu * n * Fv : NAN);
  /* PRUEFEN P18: Schraubenmontage (Ablauf, Übung): Gewinde und Auflage sauber und unbeschädigt, Teile ausrichten, alle Schrauben von Hand ansetzen, kreuzweise (diagonal) in zwei bis drei Stufen anziehen, zuletzt mit dem Drehmomentschlüssel auf das Sollmoment; Moment kontrollieren und Sicherung setzen. Stimmt die Reihenfolge mit eurer Montageanweisung überein (z. B. Stufen 50 %, 100 %)? */
  const MONTAGE = ['Gewinde und Auflageflächen reinigen und prüfen', 'Teile ausrichten und alle Schrauben von Hand ansetzen', 'Schrauben kreuzweise mit etwa der Hälfte des Sollmoments anziehen', 'Schrauben kreuzweise mit dem Drehmomentschlüssel auf das Sollmoment anziehen', 'Anzugsmoment kontrollieren und Schraubensicherung beachten'];
  /* PRUEFEN P19: Sicherungselemente (qualitativ): Schraubensicherungsmittel (mittelfest, flüssig) und Gegenmutter wirken gegen Losdrehen; Kronenmutter mit Splint und Sicherungsblech sichern durch Form; Sperrzahnschrauben und Spannscheiben erhöhen die Reibung. Federringe gelten bei dynamischer Belastung als wenig wirksam; wir erwähnen das nur vorsichtig. Wie bewertet ihr Federringe, und welche Sicherungen kommen in der Werkstatt vor? */
  const SECURE = [
    { n: 'Gegenmutter', w: 'Reibung durch zweite, gegen die erste gekonterte Mutter' },
    { n: 'Schraubensicherungsmittel (flüssig, mittelfest)', w: 'Klebt das Gewinde, bleibt mit Werkzeug lösbar' },
    { n: 'Kronenmutter mit Splint', w: 'Formschluss: Der Splint verhindert das Drehen der Mutter' },
    { n: 'Sicherungsblech', w: 'Formschluss: umgebogene Lasche sperrt die Mutter' },
    { n: 'Sperrzahnschraube', w: 'Zähne im Kopf haken in der Auflage und erhöhen die Reibung' }
  ];

  /* ============================================================ Welle-Nabe */
  /* PRUEFEN P20: Passfeder nach DIN 6885 (Form A, runde Enden): b × h nach Wellendurchmesser (über d bis d), Tiefe der Wellennut t1 und der Nabennut t2: 6–8: 2×2, 1,2/1,0; 8–10: 3×3, 1,8/1,4; 10–12: 4×4, 2,5/1,8; 12–17: 5×5, 3,0/2,3; 17–22: 6×6, 3,5/2,8; 22–30: 8×7, 4,0/3,3; 30–38: 10×8, 5,0/3,3; 38–44: 12×8, 5,0/3,3; 44–50: 14×9, 5,5/3,8; 50–58: 16×10, 6,0/4,3. Tragende Länge der Form A: l_tr = l − b. Flächenpressung p = 2 · M / (d · (h − t1) · l_tr) mit M in N·mm. Bitte Tabellenwerte gegen das Tabellenbuch prüfen. */
  const KEYS = [
    { lo: 6, hi: 8, b: 2, h: 2, t1: 1.2, t2: 1.0 }, { lo: 8, hi: 10, b: 3, h: 3, t1: 1.8, t2: 1.4 }, { lo: 10, hi: 12, b: 4, h: 4, t1: 2.5, t2: 1.8 },
    { lo: 12, hi: 17, b: 5, h: 5, t1: 3.0, t2: 2.3 }, { lo: 17, hi: 22, b: 6, h: 6, t1: 3.5, t2: 2.8 }, { lo: 22, hi: 30, b: 8, h: 7, t1: 4.0, t2: 3.3 },
    { lo: 30, hi: 38, b: 10, h: 8, t1: 5.0, t2: 3.3 }, { lo: 38, hi: 44, b: 12, h: 8, t1: 5.0, t2: 3.3 }, { lo: 44, hi: 50, b: 14, h: 9, t1: 5.5, t2: 3.8 }, { lo: 50, hi: 58, b: 16, h: 10, t1: 6.0, t2: 4.3 }
  ];
  const keyFor = d => (pos(d) ? KEYS.find(k => d > k.lo && d <= k.hi) || null : null);
  const keyLtr = (l, b) => (pos(l) && pos(b) && l > b ? l - b : NAN);
  const keyPress = (Mnm, d, h, t1, ltr) => (pos(Mnm) && pos(d) && pos(h) && num(t1) >= 0 && h > t1 && pos(ltr) ? 2 * Mnm * 1000 / (d * (h - t1) * ltr) : NAN);
  /* PRUEFEN P21: Pressverband: Erwärmung der Nabe, damit die Bohrung um Übermaß plus Fügespiel wächst: ΔT = (U + Spiel) / (α · d). Längenausdehnungszahl α in 10⁻⁶/K: Stahl 12, Aluminium 23, Kupfer 17 (Tabellenwerte gerundet). Aufgaben rechnen nur die Temperaturdifferenz; Zahlen für reale Fügetemperaturen (Ölbad, Induktion, Schutzmaßnahmen) sind bewusst nicht Teil des Labs. */
  const ALPHA = { stahl: { n: 'Stahl', a: 12 }, alu: { n: 'Aluminium', a: 23 }, cu: { n: 'Kupfer', a: 17 } };
  const expandDT = (U, play, d, mat) => (num(U) >= 0 && num(play) >= 0 && pos(d) && ALPHA[mat] ? (U + play) / (ALPHA[mat].a * 1e-6 * d) : NAN);
  const expandGrow = (d, dT, mat) => (pos(d) && num(dT) >= 0 && ALPHA[mat] ? ALPHA[mat].a * 1e-6 * d * dT : NAN);

  /* ============================================================ Klemmen, Stecken */
  /* PRUEFEN P22: Stecken und Sichern (qualitativ): Bolzen mit Splint oder Sicherungsring (DIN 471 für Wellen/Außen, DIN 472 für Bohrungen/Innen), Passstift, Spannstift; Klemmen: Klemmverbindung, Spannsatz, Schnellspanner. Passen Normnummern und Beispiele? */
  const STECK = { 'DIN 471': 'Sicherungsring für Wellen (außen)', 'DIN 472': 'Sicherungsring für Bohrungen (innen)' };

  const api = {
    fin, rd, num, pos, parseDe, fmtDe, fmtN, hashStr, rng, ri, pick, shuffle,
    DIN8593, VERF, VERF_ORDER,
    SQ2, A_PER_T, kehlA, kehlZ, kehlArea, seamArea, kehlAmax, seamStress, seamForce, RHO_ST, seamVol, seamVolCm3, seamMass, PROC, POS, NAHT, NAHT_ORDER,
    SOLDER_LIMIT, solderKind, GAP, gapRadial, gapState, brazeArea, SOLDER_TAU, lotForce,
    glueArea, shearStrength, glueForceAllow, glueAreaNeed, EN1465,
    RIV_OVER, rivetLen, rivetArea, rivetForce,
    CLASSES, boltRm, boltRe, nutFor, BOLT, BOLT_ORDER, TORQ, TORQ_ORDER, TORQ_CLS, K_TORQ, torque, preload, preloadMax, utilPreload, DEPTH, screwDepth, MU_T, frictionLoad, MONTAGE, SECURE,
    KEYS, keyFor, keyLtr, keyPress, ALPHA, expandDT, expandGrow, STECK
  };
  root.FUG_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
