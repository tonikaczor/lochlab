'use strict';
/* Tonfunk Buchführungs-Lab: reine Logik (ohne Oberfläche, auch per Node testbar).
   Inhalt: Kontenübungsliste (IKR, vierstellig), Buchungssätze prüfen, T-Konten mit Saldo, Umsatzsteuer, Skonto,
   Abschreibung (linear), Personalkosten (Übungswerte), Abschluss (GuV, Schlussbilanz), Bilanz und Eigenkapital.
   Rundung: jeder Betrag wird kaufmännisch auf ganze Cent gerundet (0,005 wird aufgerundet).
   Buchungszeile: { s: 'S' (Soll) | 'H' (Haben), k: 'Kontonummer', b: Betrag }. Buchungssatz = Liste von Zeilen.
   Export: window.BUC_CORE bzw. module.exports (Node). */
(function (root) {
  const fin = v => typeof v === 'number' && isFinite(v);
  const rd = (v, d) => { const f = Math.pow(10, d); const s = v < 0 ? -1 : 1; return s * Math.round(Math.abs(v) * f + 1e-7) / f; };
  const rd2 = v => rd(v, 2);

  /* ---------------- Zahlen deutsch ---------------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NaN;
    s = String(s == null ? '' : s).replace(/[\s  ]+/g, '').replace(/(€|euro|eur|%|prozent|monate?|jahre?)$/i, '').replace('−', '-');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    if (!/^[+\-]?\d+(\.\d+)?$|^[+\-]?\.\d+$/.test(s)) return NaN;
    return parseFloat(s);
  }
  function fmtDe(v, dec, sign) {
    if (!fin(v)) return '–';
    dec = dec == null ? 2 : dec;
    let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    const neg = s[0] === '-'; if (neg) s = s.slice(1);
    const pp = s.split('.'); pp[0] = pp[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    s = pp.join(',');
    return (neg ? '−' : sign && v > 0 ? '+' : '') + s;
  }
  const trim0 = t => t.replace(/(,\d*?)0+$/, '$1').replace(/,$/, '');
  const fmtP = v => trim0(fmtDe(v, 2));
  const eur = v => fmtDe(v, 2) + ' €';
  function fmtRow(r) {
    if (!fin(r.v)) return '–';
    if (r.u === '€') return eur(r.v);
    if (r.u === '%') return fmtDe(r.v, 2) + ' %';
    if (r.u === 'Monate' || r.u === 'Jahre') return fmtDe(r.v, 0) + ' ' + r.u;
    return trim0(fmtDe(r.v, r.dec == null ? 4 : r.dec));
  }

  /* ---------------- Zufall (seed-fähig) ---------------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b, s) => { s = s || 1; return a + s * Math.floor(R() * (Math.floor((b - a) / s) + 1)); };
  const pick = (R, a) => a[Math.floor(R() * a.length)];
  function shuffle(R, a) { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = x[i]; x[i] = x[j]; x[j] = t; } return x; }

  /* ---------------- Kontenübungsliste (IKR) ----------------
     FESTLEGUNG für dieses Lab: kleine Übungsliste mit vierstelligen Nummern in Anlehnung an den Industriekontenrahmen (IKR).
     typ: A = aktives Bestandskonto, P = passives Bestandskonto, Aw = Aufwand, Er = Ertrag, Ab = Abschlusskonto.
     PRUEFEN: Die Nummern sind Übungswerte. Der Ausbildungsbetrieb kann abweichende Nummern verwenden (z. B. 0210 Maschinen, 2880 Kasse, 5000er Erlöse). */
  /* PRUEFEN: Kasse 2880 und Erlöse 5000/5100 sind IKR-Nummern (die Aufgabenvorgabe nannte 1000 Kasse und 8000er Erlöse, das ist eher SKR 03/04). 0210 Maschinen ist Vorgabe; in manchen IKR-Ausgaben ist 0210 ein anderes Sachanlagekonto. */
  /* PRUEFEN: 4830/4840 (Verbindlichkeiten gegenüber Finanzbehörden bzw. Sozialversicherungsträgern), 6001 Bezugskosten, 6002 Nachlässe, 5001 Erlösberichtigungen, 6400 Arbeitgeberanteil, 6520 Abschreibungen und 9100/9200/9300 sind aus dem Gedächtnis des IKR übernommen und mit dem betrieblichen Kontenplan abzugleichen. */
  const KDEF = [
    ['0210', 'Maschinen', 'A', 'Anlagevermögen'],
    ['0220', 'Fuhrpark', 'A', 'Anlagevermögen'],
    ['0230', 'Betriebs- und Geschäftsausstattung', 'A', 'Anlagevermögen'],
    ['2000', 'Rohstoffe', 'A', 'Umlaufvermögen'],
    ['2020', 'Hilfsstoffe', 'A', 'Umlaufvermögen'],
    ['2280', 'Waren', 'A', 'Umlaufvermögen'],
    ['2400', 'Forderungen aus L. u. L.', 'A', 'Umlaufvermögen'],
    ['2600', 'Vorsteuer', 'A', 'Umlaufvermögen'],
    ['2800', 'Bank', 'A', 'Umlaufvermögen'],
    ['2880', 'Kasse', 'A', 'Umlaufvermögen'],
    ['3000', 'Eigenkapital', 'P', 'Eigenkapital und Schulden'],
    ['4250', 'Darlehen (langfristige Bankverbindlichkeiten)', 'P', 'Eigenkapital und Schulden'],
    ['4400', 'Verbindlichkeiten aus L. u. L.', 'P', 'Eigenkapital und Schulden'],
    ['4800', 'Umsatzsteuer', 'P', 'Eigenkapital und Schulden'],
    ['4830', 'Verbindlichkeiten gegenüber Finanzbehörden', 'P', 'Eigenkapital und Schulden'],
    ['4840', 'Verbindlichkeiten gegenüber Sozialversicherungsträgern', 'P', 'Eigenkapital und Schulden'],
    ['5000', 'Umsatzerlöse für Erzeugnisse', 'Er', 'Erträge'],
    ['5001', 'Erlösberichtigungen', 'Er', 'Erträge'],
    ['5100', 'Umsatzerlöse für Waren', 'Er', 'Erträge'],
    ['6000', 'Aufwendungen für Rohstoffe', 'Aw', 'Aufwendungen'],
    ['6001', 'Bezugskosten', 'Aw', 'Aufwendungen'],
    ['6002', 'Nachlässe', 'Aw', 'Aufwendungen'],
    ['6020', 'Aufwendungen für Hilfsstoffe', 'Aw', 'Aufwendungen'],
    ['6080', 'Aufwendungen für Waren', 'Aw', 'Aufwendungen'],
    ['6200', 'Löhne', 'Aw', 'Aufwendungen'],
    ['6300', 'Gehälter', 'Aw', 'Aufwendungen'],
    ['6400', 'Arbeitgeberanteil zur Sozialversicherung', 'Aw', 'Aufwendungen'],
    ['6520', 'Abschreibungen auf Sachanlagen', 'Aw', 'Aufwendungen'],
    ['6800', 'Büromaterial', 'Aw', 'Aufwendungen'],
    ['9100', 'Eröffnungsbilanzkonto', 'Ab', 'Abschluss'],
    ['9200', 'Schlussbilanzkonto', 'Ab', 'Abschluss'],
    ['9300', 'Gewinn- und Verlustkonto', 'Ab', 'Abschluss']
  ];
  const KONTEN = KDEF.map(a => ({ nr: a[0], name: a[1], typ: a[2], grp: a[3] }));
  const KMAP = {}; KONTEN.forEach(k => { KMAP[k.nr] = k; });
  const GRUPPEN = ['Anlagevermögen', 'Umlaufvermögen', 'Eigenkapital und Schulden', 'Erträge', 'Aufwendungen', 'Abschluss'];
  const konto = nr => KMAP[nr] || null;
  const kontoName = nr => KMAP[nr] ? KMAP[nr].name : '';
  const kontoLabel = nr => KMAP[nr] ? nr + ' ' + KMAP[nr].name : String(nr);
  /* Seite, auf der ein Zugang bzw. der normale Bestand steht: Aktiv und Aufwand im Soll, Passiv und Ertrag im Haben */
  const normalSide = nr => { const k = KMAP[nr]; return !k ? null : (k.typ === 'A' || k.typ === 'Aw') ? 'S' : (k.typ === 'P' || k.typ === 'Er') ? 'H' : null; };

  /* ---------------- Buchungssätze ---------------- */
  const L = (s, k, b) => ({ s, k, b });
  function sums(lines) {
    let so = 0, ha = 0;
    lines.forEach(l => { const x = typeof l.b === 'number' ? l.b : parseDe(l.b); if (!fin(x)) return; if (l.s === 'S') so += x; else if (l.s === 'H') ha += x; });
    so = rd2(so); ha = rd2(ha);
    return { soll: so, haben: ha, diff: rd2(so - ha), ok: so > 0 && so === ha };
  }
  /* Text: "2600 Vorsteuer 190,00 € und 6000 … 1.000,00 € an 4400 … 1.190,00 €" */
  function bsText(lines) {
    const part = s => lines.filter(l => l.s === s).map(l => kontoLabel(l.k) + ' ' + eur(l.b)).join(' und ');
    return part('S') + ' an ' + part('H');
  }
  /* Antwort eines Lernenden gegen die Lösung (und gleichwertige Lösungen) prüfen.
     user: [{s,k,b:Text}], sol: [{s,k,b:Zahl}]. Jede Lösungszeile muss genau einmal getroffen sein, überzählige Zeilen sind falsch.
     Ergebnis: { ok, hit, total, extra, st:['ok'|'bad'|'' je Eingabezeile], empty, bal } */
  function matchOne(user, sol) {
    const used = user.map(() => false), st = user.map(() => ''); let hit = 0;
    user.forEach((u, i) => { if (u.blank) st[i] = ''; else st[i] = 'bad'; });
    sol.forEach(sl => {
      const i = user.findIndex((u, j) => !u.blank && !used[j] && u.s === sl.s && u.k === sl.k && fin(u.x) && Math.abs(u.x - sl.b) <= 0.01 + 1e-9);
      if (i >= 0) { used[i] = true; st[i] = 'ok'; hit++; }
    });
    const filled = user.filter(u => !u.blank).length;
    return { hit, total: sol.length, extra: filled - hit, st, filled };
  }
  function checkBuchung(userLines, sol, alts) {
    const user = (userLines || []).map(u => { const raw = u.b == null ? '' : String(u.b).trim(); return { s: u.s, k: u.k || '', x: parseDe(raw), blank: !u.k && raw === '' }; });
    const cands = [sol].concat(alts || []).map(s => matchOne(user, s));
    let best = cands[0];
    cands.forEach(c => { const a = c.hit === c.total && c.extra === 0, b = best.hit === best.total && best.extra === 0; if ((a && !b) || (a === b && c.hit - c.extra > best.hit - best.extra)) best = c; });
    const ul = userLines.filter((u, i) => !user[i].blank).map(u => ({ s: u.s, k: u.k, b: u.b }));
    return { ok: best.hit === best.total && best.extra === 0 && best.filled > 0, hit: best.hit, total: best.total, extra: best.extra, st: best.st, empty: best.filled === 0, bal: sums(ul) };
  }

  /* ---------------- T-Konten ----------------
     buchungen: [{lines:[{s,k,b}]}], ab: { Kontonummer: Anfangsbestand } (steht auf der normalen Seite des Kontos).
     Ergebnis: { m: { nr: {nr, s:[{g,b}], h:[{g,b}], sumS, sumH, bal, saldo:{side,b}|null, sum} }, order:[nr] }
     bal = Soll minus Haben (positiv: Soll-Saldo). saldo = Ausgleichsposten auf der betragsmäßig kleineren Seite. */
  function finishT(t) {
    t.sumS = rd2(t.s.reduce((a, x) => a + x.b, 0)); t.sumH = rd2(t.h.reduce((a, x) => a + x.b, 0));
    t.bal = rd2(t.sumS - t.sumH);
    t.saldo = t.bal > 0 ? { side: 'h', b: t.bal } : t.bal < 0 ? { side: 's', b: -t.bal } : null;
    t.sum = Math.max(t.sumS, t.sumH);
    return t;
  }
  function tkonten(buchungen, ab) {
    const m = {}, order = [];
    const get = nr => { if (!m[nr]) { m[nr] = { nr, s: [], h: [] }; order.push(nr); } return m[nr]; };
    Object.keys(ab || {}).forEach(nr => { get(nr)[normalSide(nr) === 'H' ? 'h' : 's'].push({ g: KMAP[nr] && (KMAP[nr].typ === 'A' || KMAP[nr].typ === 'P') ? 'AB' : 'Jahr', b: ab[nr] }); });
    (buchungen || []).forEach(bu => bu.lines.forEach(l => {
      const opp = bu.lines.filter(x => x.s !== l.s);
      get(l.k)[l.s === 'S' ? 's' : 'h'].push({ g: opp.length === 1 ? opp[0].k : 'div.', b: l.b });
    }));
    order.forEach(nr => finishT(m[nr]));
    return { m, order };
  }
  /* Einzelnes T-Konto aus Listen bauen (für Aufgaben) */
  function tkontoOf(nr, s, h, ab) {
    const t = { nr, s: [], h: [] };
    if (fin(ab) && ab !== 0) t[normalSide(nr) === 'H' ? 'h' : 's'].push({ g: 'AB', b: ab });
    (s || []).forEach(x => t.s.push({ g: x.g, b: x.b })); (h || []).forEach(x => t.h.push({ g: x.g, b: x.b }));
    return finishT(t);
  }
  /* Endbestand eines Bestandskontos (immer positiv, wenn es auf seiner normalen Seite steht) */
  const endbestand = t => normalSide(t.nr) === 'H' ? rd2(-t.bal) : t.bal;

  /* ---------------- Umsatzsteuer ---------------- */
  const ustVon = (netto, satz) => rd2(netto * satz / 100);
  const bruttoVon = (netto, satz) => rd2(netto + ustVon(netto, satz));
  const nettoAus = (brutto, satz) => rd2(brutto * 100 / (100 + satz));
  const ustAus = (brutto, satz) => rd2(brutto - nettoAus(brutto, satz));
  /* Zahllast = Umsatzsteuer − Vorsteuer; negativ = Erstattungsanspruch */
  const zahllast = (ust, vst) => rd2(ust - vst);
  /* Skonto auf eine Bruttorechnung: Skontobetrag brutto, darin enthaltene USt (Berichtigung), Skonto netto, Zahlbetrag.
     PRUEFEN: Skontobetrag wird vom Bruttobetrag berechnet, die USt-Berichtigung daraus herausgerechnet (ergibt bei glatten Nettobeträgen dasselbe wie die Rechnung vom Nettobetrag). */
  function skonto(brutto, pct, satz) {
    const sb = rd2(brutto * pct / 100), us = ustAus(sb, satz);
    return { sb, ust: us, sn: rd2(sb - us), zahl: rd2(brutto - sb) };
  }

  /* ---------------- Abschreibung (linear) ---------------- */
  const afaLinear = (ak, rest, nd) => (fin(ak) && fin(rest) && nd > 0) ? rd2((ak - rest) / nd) : null;
  const restbuchwert = (ak, afa, n) => rd2(ak - afa * n);
  /* PRUEFEN: Im Anschaffungsjahr wird zeitanteilig abgeschrieben, der Anschaffungsmonat zählt voll mit (§ 7 Abs. 1 EStG: pro rata temporis). */
  const monateImJahr = monat => 13 - monat;
  const afaAnteilig = (afaJahr, monat) => rd2(afaJahr / 12 * monateImJahr(monat));

  /* ---------------- Personal ---------------- */
  /* PRUEFEN: Lohnsteuer und Sozialversicherungssätze sind frei gewählte ÜBUNGSWERTE, keine amtlichen Werte (die echten Sätze ändern sich jährlich). */
  const auszahlung = (brutto, lst, svAn) => rd2(brutto - lst - svAn);
  const anteil = (brutto, satz) => rd2(brutto * satz / 100);

  /* ---------------- Bilanz und Erfolg ---------------- */
  const summe = a => rd2(a.reduce((x, y) => x + y, 0));
  const eigenkapital = (vermoegen, schulden) => rd2(vermoegen - schulden);
  /* Gewinn = Endkapital − Anfangskapital + Entnahmen − Einlagen (Reinvermögensvergleich) */
  const gewinnVergleich = (ekEnd, ekAnf, entnahmen, einlagen) => rd2(ekEnd - ekAnf + entnahmen - einlagen);
  const verbrauch = (anfang, zugang, schluss) => rd2(anfang + zugang - schluss);
  const ergebnis = (ertraege, aufwendungen) => rd2(ertraege - aufwendungen);

  /* ---------------- Antworten prüfen ---------------- */
  const tolOf = u => u === '%' ? 0.1 : 0.01;
  function checkNum(inp, v, tol) {
    const x = parseDe(inp);
    if (!fin(x)) return { ok: false, empty: String(inp == null ? '' : inp).trim() === '', nan: true };
    return { ok: Math.abs(x - v) <= (tol == null ? 0.01 : tol) + 1e-9, x };
  }

  const api = {
    fin, rd, rd2, parseDe, fmtDe, fmtP, eur, fmtRow, trim0, rng, hashStr, ri, pick, shuffle,
    KONTEN, GRUPPEN, konto, kontoName, kontoLabel, normalSide, L, sums, bsText, checkBuchung,
    tkonten, tkontoOf, finishT, endbestand,
    ustVon, bruttoVon, nettoAus, ustAus, zahllast, skonto,
    afaLinear, restbuchwert, monateImJahr, afaAnteilig,
    auszahlung, anteil, summe, eigenkapital, gewinnVergleich, verbrauch, ergebnis,
    tolOf, checkNum
  };
  root.BUC_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
