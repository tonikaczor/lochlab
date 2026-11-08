'use strict';
/* Tonfunk Auftrag-und-Recht-Lab: reine Rechenlogik (Kennung 'rec'). window.REC_CORE bzw. module.exports.
   KEINE RECHTSBERATUNG. Prozentsätze, Fristen und Beträge sind ÜBUNGSWERTE für die Ausbildung; Gesetze ändern sich.
   Konventionen: Datum als Millisekunden (UTC, nur Kalendertage), Anzeige TT.MM.JJJJ; Geld in Euro, auf Cent gerundet;
   Zinsen nach der Formel Z = K · p · t / (100 · 360), t = Zinstage.
   Ungültige Eingaben (fehlende Zahlen, unmögliche Daten, negative Werte) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(€|eur|euro|tage|tag|%|prozent|jahre|jahr|monate|monat)$/i, '');
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
    if (group && i.length > (group === 'all' ? 3 : 4)) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '–'; dec = dec == null ? 2 : dec;
    let s = fmtDe(rd(v, dec), dec, group);
    if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, '');
    return s;
  }
  const eur = v => (fin(v) ? fmtDe(v, 2, 'all') + ' €' : '–');

  /* ---------- Zufall (seed-fähig) ---------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ---------- Datum ---------- */
  const DAY = 864e5, WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const mk = (y, m, d) => Date.UTC(y, m - 1, d);
  const ymd = ms => { const t = new Date(ms); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  function parseDate(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(String(s == null ? '' : s).trim()); if (!m) return NAN;
    let y = +m[3]; if (m[3].length === 2) y += 2000;
    if (y < 1970 || y > 2200) return NAN;
    const ms = mk(y, +m[2], +m[1]), t = ymd(ms); return t.y === y && t.m === +m[2] && t.d === +m[1] ? ms : NAN;
  }
  const p2 = n => (n < 10 ? '0' : '') + n;
  const fmtDate = ms => { if (!fin(ms)) return '–'; const t = ymd(ms); return p2(t.d) + '.' + p2(t.m) + '.' + t.y; };
  const weekday = ms => new Date(ms).getUTCDay();
  const isWeekend = ms => fin(ms) && (weekday(ms) === 0 || weekday(ms) === 6);
  const fmtDateWd = ms => (fin(ms) ? WD[weekday(ms)] + ', ' + fmtDate(ms) : '–');
  const addDays = (ms, n) => (fin(ms) && fin(n) ? ms + n * DAY : NAN);
  const diffDays = (a, b) => (fin(a) && fin(b) ? Math.round((b - a) / DAY) : NAN);
  function addMonths(ms, n) {
    if (!fin(ms) || !fin(n)) return NAN;
    const t = ymd(ms), tot = t.y * 12 + (t.m - 1) + n, ny = Math.floor(tot / 12), nm = tot - ny * 12 + 1;
    return mk(ny, nm, Math.min(t.d, dim(ny, nm)));
  }
  const addYears = (ms, n) => addMonths(ms, 12 * n);
  const endOfMonth = ms => { if (!fin(ms)) return NAN; const t = ymd(ms); return mk(t.y, t.m, dim(t.y, t.m)); };
  /* § 193 BGB (vereinfacht): fällt das Fristende auf Samstag oder Sonntag, endet die Frist am nächsten Montag. Feiertage sind NICHT eingebaut. */
  const nextWerktag = ms => (!fin(ms) ? NAN : weekday(ms) === 6 ? ms + 2 * DAY : weekday(ms) === 0 ? ms + DAY : ms);
  /* Zufälliges Datum (für Aufgaben) */
  const dateRand = (R, y0, y1) => mk(ri(R, y0 == null ? 2024 : y0, y1 == null ? 2026 : y1), ri(R, 1, 12), ri(R, 1, 28));

  /* ---------- Fristen ---------- */
  /* PRUEFEN P1: Fristrechnung vereinfacht nach §§ 187, 188 BGB: Der Tag des auslösenden Ereignisses (Ablieferung, Zugang, Rechnungsdatum) zählt nicht mit; die Frist endet mit Ablauf des Tages, der durch Zahl bzw. Benennung dem Ereignistag entspricht. Wochenende/Feiertag (§ 193 BGB) wird in den Aufgaben nicht angewendet (Aufgaben vermeiden solche Enddaten), im Fristenrechner nur als Hinweis. Feiertage sind nicht eingebaut. Passt das so für den Unterricht? */
  /* PRUEFEN P2: Regelmäßige Verjährung 3 Jahre (§§ 195, 199 BGB), Beginn mit dem Schluss des Jahres, in dem der Anspruch entstanden ist und der Gläubiger Kenntnis hatte (hier vorausgesetzt): Ende immer am 31.12. des dritten Folgejahres. Die Höchstfristen (10/30 Jahre) und Hemmung/Neubeginn der Verjährung werden nicht behandelt. */
  const verjaehrungEnde = ms => (fin(ms) ? mk(ymd(ms).y + 3, 12, 31) : NAN);
  /* PRUEFEN P3: Gewährleistung (Mängelansprüche) beim Kauf neuer beweglicher Sachen 2 Jahre ab Ablieferung (§ 438 BGB). Nicht behandelt: Bauwerke (5 Jahre), gebrauchte Sachen (1 Jahr vereinbar), arglistig verschwiegene Mängel (regelmäßige Verjährung), Verbrauchsgüterkauf (Beweislastumkehr, Sonderregeln), Garantie. Ist die Vereinfachung für das Lab in Ordnung? */
  const gewaehrleistungEnde = (abl, jahre) => addYears(abl, jahre == null ? 2 : jahre);
  /* PRUEFEN P4: Rügepflicht im Handelskauf (§ 377 HGB): Der Käufer muss die Ware unverzüglich prüfen und offene Mängel unverzüglich rügen, versteckte Mängel unverzüglich nach Entdeckung, sonst gilt die Ware als genehmigt. Das Gesetz nennt keine Tage. Als ÜBUNGSWERT gilt hier 7 Kalendertage. Welche Frist soll im Unterricht gelten (oft 'wenige Tage' bzw. 'bis zu etwa einer Woche')? */
  const RUEGE_TAGE = 7;
  const ruegeEnde = (start, tage) => addDays(start, tage == null ? RUEGE_TAGE : tage);
  const ruegeRechtzeitig = (start, rueg, tage) => (fin(start) && fin(rueg) ? rueg >= start && rueg <= ruegeEnde(start, tage) : false);

  /* ---------- Zahlungsfristen, Verzug, Zinsen ---------- */
  /* PRUEFEN P5: Zahlungsverzug ohne Mahnung 30 Tage nach Fälligkeit und Zugang der Rechnung (§ 286 Abs. 3 BGB). Hier: Rechnung ist sofort fällig, der Zugangstag zählt nicht mit, die Frist endet mit Ablauf des 30. Tages, Verzug beginnt am Folgetag. Bei Verbrauchern gilt dies nur, wenn die Rechnung darauf hinweist; das Lab rechnet mit Unternehmen. Stimmt die Zählweise (30. oder 31. Tag) mit eurem Lehrbuch überein? */
  const verzugFristEnde = zugang => addDays(zugang, 30);
  const verzugBeginn = zugang => addDays(zugang, 31);
  /* Zinstage: Tage vom Ende der 30-Tage-Frist bis zum Zahlungstag (0, wenn nicht verspätet) */
  const zinsTage = (zugang, zahlung) => { const t = diffDays(verzugFristEnde(zugang), zahlung); return fin(t) ? Math.max(0, t) : NAN; };
  /* PRUEFEN P6: Übungswerte für den Verzug: Basiszinssatz 2,0 % (ändert sich halbjährlich, Übungswert), Verzugszinssatz im Geschäftsverkehr Basiszins + 9 Prozentpunkte (§ 288 Abs. 2 BGB), bei Verbrauchern + 5 Prozentpunkte, Verzugspauschale 40 € (§ 288 Abs. 5 BGB, nur Geschäftsverkehr). Zinsformel mit Jahr = 360 Tage und tatsächlichen Zinstagen (vereinfacht, 'deutsche Methode'). Passt das zum Unterricht? */
  const VERZ = { basis: 2.0, pp: 9, ppPrivat: 5, pauschale: 40 };
  const verzugssatz = privat => VERZ.basis + (privat ? VERZ.ppPrivat : VERZ.pp);
  const zins = (K, p, t) => (num(K) >= 0 && num(p) >= 0 && num(t) >= 0 ? rd(K * p * t / 36000, 2) : NAN);
  /* PRUEFEN P7: Skonto und Zahlungsziel werden ab Rechnungsdatum gezählt (nicht ab Zugang); der Tag des Rechnungsdatums zählt nicht mit; maßgeblich ist der Tag der Zahlung (in der Praxis oft Eingang bzw. Gutschrift, regeln viele Verträge anders). Der letzte Tag der Frist gilt als rechtzeitig, die Aufgaben vermeiden aber genau diesen Randtag. Skonto wird nur als Zahlungsbedingung behandelt, Berechnung in der Kalkulation siehe kallab. */
  const skontoEnde = (rd0, tage) => addDays(rd0, tage);
  function zahlungsArt(rechnung, zahlung, skontoTage, zielTage) {
    if (!fin(rechnung) || !fin(zahlung)) return null;
    if (zahlung < rechnung) return null;
    if (zahlung <= skontoEnde(rechnung, skontoTage)) return 'skonto';
    if (zahlung <= skontoEnde(rechnung, zielTage)) return 'netto';
    return 'ueberfaellig';
  }

  /* ---------- Zustandekommen des Kaufvertrags ---------- */
  /* PRUEFEN P8: Regeln (§§ 145-150 BGB, vereinfacht): Ein bindendes Angebot ist ein Antrag; es bindet bis zum angegebenen Datum (einschließlich), die rechtzeitige, unveränderte Bestellung ist dann die Annahme, der Vertrag entsteht mit dem Eingang der Bestellung. Verspätete oder abweichende Bestellung = neuer Antrag des Kunden. Freibleibende Angebote und bloße Anfragen/Kataloge sind nur Aufforderung zur Bestellung: Die Bestellung ist der Antrag, die Auftragsbestätigung die Annahme. Weicht die Auftragsbestätigung ab, ist sie ein neuer Antrag (§ 150 Abs. 2 BGB). Nicht behandelt: kaufmännisches Bestätigungsschreiben, Schweigen im Handelsverkehr, Bindung bei Angeboten ohne Frist, elektronische Bestellung. Reicht das? */
  const VERTRAG = {
    bestellung: 'Der Kaufvertrag ist mit dem Eingang der Bestellung zustande gekommen',
    ab: 'Der Kaufvertrag ist mit der Auftragsbestätigung zustande gekommen',
    'wartet-lieferant': 'Es gibt noch keinen Vertrag: Der Lieferant muss die Bestellung erst annehmen',
    'wartet-kunde': 'Es gibt noch keinen Vertrag: Der Kunde muss dem geänderten Angebot des Lieferanten erst zustimmen',
    'kein-antrag': 'Es gibt noch keinen Vertrag: Es liegt noch keine Bestellung vor'
  };
  function kaufvertrag(f) {
    if (!f || !['bindend', 'frei', 'kein'].includes(f.angebot)) return { code: null, grund: 'Angebotsart fehlt.' };
    if (f.bestellung == null || !fin(f.bestellung)) return { code: 'kein-antrag', grund: 'Ohne Bestellung kann kein Vertrag entstehen. Ein Angebot ist nur der Antrag des Lieferanten, die Anfrage des Kunden bindet niemanden.' };
    const rechtzeitig = f.angebot === 'bindend' && fin(f.gueltigBis) && f.bestellung <= f.gueltigBis;
    if (f.angebot === 'bindend' && !f.abweichend && rechtzeitig) return { code: 'bestellung', grund: 'Das Angebot war bindend und noch gültig. Die unveränderte Bestellung ist die Annahme: Der Vertrag entsteht mit dem Eingang der Bestellung, eine Auftragsbestätigung ist nicht nötig.' };
    let warum;
    if (f.angebot === 'frei') warum = 'Das Angebot war freibleibend, es ist nur eine Aufforderung zur Bestellung. Erst die Bestellung ist der Antrag.';
    else if (f.angebot === 'kein') warum = 'Es gab kein Angebot, nur eine Anfrage. Die Bestellung ist der Antrag des Kunden.';
    else if (f.abweichend) warum = 'Die Bestellung weicht vom Angebot ab. Das gilt als neuer Antrag des Kunden.';
    else warum = 'Die Bestellung kam nach Ablauf der Bindungsfrist. Das gilt als neuer Antrag des Kunden.';
    if (f.ab === 'gleich') return { code: 'ab', grund: warum + ' Die unveränderte Auftragsbestätigung ist die Annahme: Der Vertrag entsteht mit ihr.' };
    if (f.ab === 'abweichend') return { code: 'wartet-kunde', grund: warum + ' Die Auftragsbestätigung weicht ab und gilt deshalb als neuer Antrag des Lieferanten (§ 150 Abs. 2 BGB). Der Vertrag entsteht erst, wenn der Kunde zustimmt.' };
    return { code: 'wartet-lieferant', grund: warum + ' Der Lieferant hat noch nicht angenommen, deshalb besteht noch kein Vertrag.' };
  }

  /* ---------- Rechte des Käufers (Fall-Prüfer) ---------- */
  /* PRUEFEN P9: Vereinfachte Prüfung (BGB, HGB): Mangel: Im Handelskauf muss der Käufer rechtzeitig rügen (§ 377 HGB), sonst gilt die Ware als genehmigt (Ausnahme arglistig verschwiegener Mangel). Danach hat die Nacherfüllung Vorrang (§ 439 BGB); erst wenn sie scheitert (fehlgeschlagen, verweigert, Nachfrist erfolglos), kommen Rücktritt (nur bei erheblichem Mangel), Minderung und, bei Verschulden, Schadensersatz in Betracht. Lieferverzug: Verzug braucht Fälligkeit, Mahnung (oder kalendermäßig bestimmten Termin, Fixgeschäft, ernsthafte Verweigerung) und Verschulden; Auf Erfüllung kann der Käufer bestehen, den Verzugsschaden bekommt er bei Verschulden; Rücktritt und Schadensersatz statt der Leistung erst nach angemessener Nachfrist (beim Fixgeschäft ohne Nachfrist). Der Verschuldensmaßstab ist vereinfacht. Stimmt das für das Lab? */
  const RECHTE = {
    nacherfuellung: { n: 'Nacherfüllung', d: 'Nachbesserung oder Ersatzlieferung verlangen' },
    ruecktritt: { n: 'Rücktritt', d: 'Vom Vertrag zurücktreten, die Ware zurückgeben und das Geld zurückbekommen' },
    minderung: { n: 'Minderung', d: 'Den Kaufpreis herabsetzen und die Ware behalten' },
    schadensersatz: { n: 'Schadensersatz', d: 'Den entstandenen Schaden ersetzt verlangen (nur bei Verschulden)' },
    erfuellung: { n: 'Lieferung verlangen', d: 'Auf der Lieferung bestehen (Erfüllung)' },
    verzugsschaden: { n: 'Verzugsschaden', d: 'Zusätzlich den durch die Verspätung entstandenen Schaden ersetzt verlangen (nur bei Verschulden)' }
  };
  const RIGHT_ORDER = ['nacherfuellung', 'erfuellung', 'minderung', 'ruecktritt', 'verzugsschaden', 'schadensersatz'];
  function kaeuferRechte(f) {
    const rights = [], notes = []; let blocked = null;
    if (!f || !['mangel', 'verzug'].includes(f.stoerung)) return { rights, notes, blocked: 'Störung fehlt.' };
    if (f.stoerung === 'mangel') {
      if (f.handel && !f.ruege && f.mangelart !== 'arglist') blocked = 'Die Mängelrüge war nicht rechtzeitig. Im Handelskauf gilt die Ware dann als genehmigt (§ 377 HGB), die Mängelrechte entfallen.';
      else {
        if (f.handel && f.mangelart === 'arglist') notes.push('Der Mangel wurde arglistig verschwiegen: Die Rügepflicht fällt weg.');
        rights.push('nacherfuellung');
        if (f.nacherf === 'gescheitert') {
          rights.push('minderung');
          if (f.erheblich) rights.push('ruecktritt'); else notes.push('Der Mangel ist nur unerheblich: Rücktritt ist ausgeschlossen, Minderung bleibt möglich.');
          if (f.verschulden) rights.push('schadensersatz'); else notes.push('Ohne Verschulden des Verkäufers gibt es keinen Schadensersatz.');
        } else notes.push('Die Nacherfüllung ist noch offen: Setze dem Verkäufer eine angemessene Frist. Erst wenn sie scheitert, kommen Rücktritt oder Minderung in Betracht.');
      }
    } else {
      const verzug = !!(f.fix || f.kalender || f.mahnung || f.verweigert);
      if (!verzug) blocked = 'Der Verzug ist noch nicht eingetreten: Ohne bestimmten Kalendertermin ist erst eine Mahnung nötig.';
      else {
        rights.push('erfuellung');
        if (f.verschulden) rights.push('verzugsschaden'); else notes.push('Ohne Verschulden des Lieferanten gibt es keinen Ersatz des Verzugsschadens.');
        if (f.fix || f.nachfrist) {
          rights.push('ruecktritt');
          if (f.verschulden) rights.push('schadensersatz');
        } else notes.push('Für Rücktritt oder Schadensersatz statt der Leistung musst du zuerst eine angemessene Nachfrist setzen (beim Fixgeschäft nicht).');
      }
    }
    rights.sort((a, b) => RIGHT_ORDER.indexOf(a) - RIGHT_ORDER.indexOf(b));
    return { rights, notes, blocked };
  }

  /* ---------- Ordnungsketten (Belege, Mahnstufen, Mängelrüge) ---------- */
  /* PRUEFEN P10: Belegkette der Auftragsabwicklung (Verkäufer-Sicht): Anfrage (Kunde), Angebot (Lieferant), Bestellung/Auftrag (Kunde), Auftragsbestätigung (Lieferant), Lieferschein (Lieferant), Rechnung (Lieferant), Zahlung per Überweisung (Kunde). Betriebe haben je nach Abläufen weitere Belege (Wareneingangsschein, Kommissionierliste, Versandpapiere). Stimmt die Kette für euren Betrieb? */
  /* PRUEFEN P11: Mahnstufen: Zahlungserinnerung, 1. Mahnung, 2. Mahnung mit Frist, letzte Mahnung mit Androhung des gerichtlichen Mahnverfahrens, Antrag auf Mahnbescheid, Vollstreckungsbescheid. Anzahl und Name der Stufen sind betrieblich verschieden, Mahngebühren werden nicht behandelt. Welche Stufen verwendet ihr? */
  const ORDER = {
    beleg: { title: 'Belegkette der Kaufabwicklung', hint: 'Bringe die Belege in die richtige Reihenfolge.', items: [
      { n: 'Anfrage', k: 'Anfrage', wer: 'Kunde', d: 'Der Kunde fragt unverbindlich nach Preis, Menge und Lieferzeit.' },
      { n: 'Angebot', k: 'Angebot', wer: 'Lieferant', d: 'Der Lieferant nennt Ware, Preis, Lieferzeit und Zahlungsbedingungen und ist daran meist gebunden.' },
      { n: 'Bestellung (Auftrag)', k: 'Bestellung', wer: 'Kunde', d: 'Der Kunde bestellt verbindlich. Beim Lieferanten heißt der Beleg Auftrag.' },
      { n: 'Auftragsbestätigung', k: 'Auftragsbestätigung', wer: 'Lieferant', d: 'Der Lieferant bestätigt Menge, Preis und Termin schriftlich.' },
      { n: 'Lieferschein', k: 'Lieferschein', wer: 'Lieferant', d: 'Er liegt der Ware bei und beschreibt Art und Menge der Lieferung.' },
      { n: 'Rechnung', k: 'Rechnung', wer: 'Lieferant', d: 'Der Beleg fordert zur Zahlung auf und ist die Grundlage für die Buchung.' },
      { n: 'Zahlung (Überweisung)', k: 'Zahlung', wer: 'Kunde', d: 'Der Kunde bezahlt, der Beleg ist der Kontoauszug bzw. die Überweisung.' }
    ] },
    mahn: { title: 'Mahnwesen', hint: 'Bringe die Mahnstufen in die richtige Reihenfolge.', items: [
      { n: 'Rechnung mit Zahlungsziel', k: 'Rechnung', wer: 'Lieferant', d: 'Der Rechnungsbetrag wird fällig.' },
      { n: 'Zahlungserinnerung', k: 'Zahlungserinnerung', wer: 'Lieferant', d: 'Freundlicher Hinweis, dass die Zahlung noch fehlt.' },
      { n: '1. Mahnung', k: '1. Mahnung', wer: 'Lieferant', d: 'Förmliche Mahnung mit neuer Zahlungsfrist.' },
      { n: '2. Mahnung mit Fristsetzung', k: '2. Mahnung', wer: 'Lieferant', d: 'Mahnung mit kurzer Frist, Hinweis auf Verzugszinsen.' },
      { n: 'Letzte Mahnung (Androhung gerichtlicher Schritte)', k: 'Letzte Mahnung', wer: 'Lieferant', d: 'Letzte Frist, danach folgt das gerichtliche Mahnverfahren.' },
      { n: 'Antrag auf Mahnbescheid', k: 'Mahnbescheid', wer: 'Lieferant', d: 'Der Lieferant beantragt beim Mahngericht einen Mahnbescheid.' },
      { n: 'Vollstreckungsbescheid', k: 'Vollstreckungsbescheid', wer: 'Lieferant', d: 'Folgt, wenn der Schuldner nicht widerspricht oder zahlt.' }
    ] },
    ruege: { title: 'Ablauf der Mängelrüge', hint: 'Bringe die Schritte in die richtige Reihenfolge.', items: [
      { n: 'Ware annehmen und sofort prüfen', k: 'Ware prüfen', wer: 'Kunde', d: 'Menge, Art und Beschaffenheit mit Bestellung und Lieferschein vergleichen.' },
      { n: 'Mangel feststellen und dokumentieren', k: 'Mangel festhalten', wer: 'Kunde', d: 'Fotos, Mengen, Seriennummern notieren.' },
      { n: 'Mängelrüge an den Lieferanten senden', k: 'Rüge senden', wer: 'Kunde', d: 'Unverzüglich und schriftlich; sonst gilt die Ware als genehmigt.' },
      { n: 'Nacherfüllung verlangen und Nachfrist setzen', k: 'Nacherfüllung', wer: 'Kunde', d: 'Nachbesserung oder Ersatzlieferung, mit angemessener Frist.' },
      { n: 'Bei Misserfolg: Rücktritt oder Minderung', k: 'Rücktritt oder Minderung', wer: 'Kunde', d: 'Wenn die Nacherfüllung scheitert; Schadensersatz bei Verschulden.' }
    ] }
  };
  const orderRight = key => ORDER[key].items.map(x => x.k);
  /* Erwartet eine Reihenfolge (Array von Indizes) und liefert für jede Position, ob sie stimmt */
  const orderCheck = (key, idx) => (Array.isArray(idx) ? idx.map((v, i) => v === i) : []);

  /* ---------- Rechnung: Pflichtangaben ---------- */
  /* PRUEFEN P12: Pflichtangaben einer Rechnung nach § 14 Abs. 4 UStG (hier neun zusammengefasst). Nicht behandelt: Kleinbetragsrechnung (bis 250 € brutto, weniger Angaben), Gutschrift, Hinweis auf Steuerbefreiung, Aufbewahrungshinweis, elektronische Rechnung (E-Rechnungspflicht im Geschäftsverkehr, schrittweise ab 2025). Ist die Liste so für den Unterricht in Ordnung, und soll die E-Rechnung ergänzt werden? */
  const PFLICHT = [
    'Name und Anschrift des Lieferanten',
    'Name und Anschrift des Kunden',
    'Steuernummer oder Umsatzsteuer-Identifikationsnummer des Lieferanten',
    'Ausstellungsdatum der Rechnung',
    'fortlaufende Rechnungsnummer',
    'Menge und Art der gelieferten Ware',
    'Zeitpunkt der Lieferung',
    'Entgelt (netto) und vorab vereinbarte Minderungen, z. B. Skonto',
    'Steuersatz und Steuerbetrag (Umsatzsteuer)'
  ];

  /* ---------- Lohn und Gehalt (Übungswerte) ---------- */
  /* PRUEFEN P13: Lohn und Gehalt sind stark vereinfacht und ausdrücklich ÜBUNGSWERTE: Lohnsteuer pauschal 15 % vom Brutto (in der Praxis nach Lohnsteuertabelle, Steuerklasse, Solidaritätszuschlag, Kirchensteuer), Sozialversicherung Arbeitnehmeranteil Rentenversicherung 9,3 %, Krankenversicherung 7,3 %, Pflegeversicherung 1,8 %, Arbeitslosenversicherung 1,3 % (zusammen 19,7 %), ohne Zusatzbeitrag der Krankenkasse, ohne Zuschlag für Kinderlose, ohne Beitragsbemessungsgrenzen. Überstundenzuschlag 25 % ist ebenfalls ein Übungswert (Tarif oder Vertrag). Sind die Werte für den Unterricht in Ordnung? */
  const LOHN = { lst: 15, rv: 9.3, kv: 7.3, pv: 1.8, av: 1.3, zuschlag: 25 };
  const svSatz = (L) => { L = L || LOHN; return rd(L.rv + L.kv + L.pv + L.av, 4); };
  const abzug = (brutto, pct) => (num(brutto) >= 0 && num(pct) >= 0 ? rd(brutto * pct / 100, 2) : NAN);
  function abrechnung(brutto, L) {
    L = L || LOHN;
    if (!(num(brutto) >= 0)) return null;
    const lst = abzug(brutto, L.lst), rv = abzug(brutto, L.rv), kv = abzug(brutto, L.kv), pv = abzug(brutto, L.pv), av = abzug(brutto, L.av);
    const sv = rd(rv + kv + pv + av, 2), summe = rd(lst + sv, 2);
    return { brutto, lst, rv, kv, pv, av, sv, summe, netto: rd(brutto - summe, 2) };
  }
  const bruttoLohn = (stundenlohn, normalStd, ueberStd, zuschlagPct) => (num(stundenlohn) >= 0 && num(normalStd) >= 0 && num(ueberStd) >= 0
    ? rd(stundenlohn * normalStd + stundenlohn * (1 + (zuschlagPct == null ? LOHN.zuschlag : zuschlagPct) / 100) * ueberStd, 2) : NAN);

  /* ---------- Arbeitsvertrag: Kündigungsfristen ---------- */
  /* PRUEFEN P14: Kündigungsfristen nach § 622 BGB bei Kündigung durch den Arbeitgeber (Übungswerte, Arbeits- oder Tarifvertrag kann abweichen): Grundfrist 4 Wochen zum 15. oder zum Monatsende; nach 2 Jahren 1 Monat, 5 Jahren 2 Monate, 8 Jahren 3 Monate, 10 Jahren 4 Monate, 12 Jahren 5 Monate, 15 Jahren 6 Monate, 20 Jahren 7 Monate jeweils zum Monatsende. Für die Kündigung durch den Arbeitnehmer gilt nur die Grundfrist (hier nicht gerechnet). Probezeit: Kündigungsfrist 2 Wochen (§ 622 Abs. 3 BGB). Kündigungsschutz, Betriebsrat, Schriftform nicht behandelt. Richtig wiedergegeben? */
  const KFRIST = [[20, 7], [15, 6], [12, 5], [10, 4], [8, 3], [5, 2], [2, 1]];
  const kuendMonate = jahre => { if (!(num(jahre) >= 0)) return NAN; const e = KFRIST.find(x => jahre >= x[0]); return e ? e[1] : 0; };
  /* Ende des Arbeitsverhältnisses bei Kündigung durch den Arbeitgeber, Zugang am Tag 'zugang' */
  function kuendEnde(zugang, jahre, probezeit) {
    if (!fin(zugang) || !(num(jahre) >= 0)) return NAN;
    if (probezeit) return addDays(zugang, 14);
    const m = kuendMonate(jahre);
    if (m > 0) return endOfMonth(addMonths(zugang, m));
    let t = addDays(zugang, 28);
    for (let i = 0; i < 40; i++) { const d = ymd(t).d; if (d === 15 || t === endOfMonth(t)) return t; t = addDays(t, 1); }
    return NAN;
  }
  /* PRUEFEN P15: Probezeit im Arbeitsvertrag höchstens 6 Monate; in der Berufsausbildung mindestens 1, höchstens 4 Monate (§ 20 BBiG), in der Probezeit kann der Ausbildungsvertrag von beiden Seiten ohne Frist und ohne Angabe von Gründen gekündigt werden (§ 22 BBiG, schriftlich). Richtig? */
  const PROBE = { arbeitMax: 6, azubiMin: 1, azubiMax: 4, arbeitFristTage: 14 };

  const API = { parseDe, fmtDe, fmtN, eur, rd, num, hashStr, rng, ri, pick, shuffle,
    DAY, WD, WDL, mk, ymd, parseDate, fmtDate, fmtDateWd, weekday, isWeekend, addDays, diffDays, addMonths, addYears, endOfMonth, nextWerktag, dateRand,
    verjaehrungEnde, gewaehrleistungEnde, RUEGE_TAGE, ruegeEnde, ruegeRechtzeitig,
    verzugFristEnde, verzugBeginn, zinsTage, VERZ, verzugssatz, zins, skontoEnde, zahlungsArt,
    VERTRAG, kaufvertrag, RECHTE, RIGHT_ORDER, kaeuferRechte, ORDER, orderRight, orderCheck, PFLICHT,
    LOHN, svSatz, abzug, abrechnung, bruttoLohn, KFRIST, kuendMonate, kuendEnde, PROBE };
  root.REC_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
