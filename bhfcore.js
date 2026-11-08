'use strict';
/* Tonfunk Berichtsheft-Helfer: reine Logik (Kennung 'bhf'). window.BHF_CORE bzw. module.exports.
   Regelbasiert, ohne KI, offline: Der Helfer prüft Stichpunkte zu einem Arbeitstag und formt daraus ein Tagesbericht-Gerüst.
   Er erkennt: zu vage Sätze, Ich-Form, Wertung statt Tätigkeit, fehlende oder ungenaue Dauer, fehlende Fachbegriffe, gemischte Zeitform, wiederholte Satzanfänge.
   Alle Wortlisten und Regeln sind Faustregeln für die Ausbildung. Sie ersetzen weder die Vorgaben des Betriebs noch die Durchsicht durch den Ausbilder.
   Es werden nie Namen oder Berichtsinhalte gespeichert oder übertragen; dieses Modul hat keinen Zugriff auf Speicher oder Netz.
   Ungültige Eingaben liefern NaN beziehungsweise leere Listen, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const LOW = s => String(s == null ? '' : s).toLowerCase();
  const words = s => String(s == null ? '' : s).match(/[A-Za-zÄÖÜäöüß0-9]+/g) || [];
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  /* ---------- Zahlen deutsch (wie in den anderen Labs) ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(stunden|stunde|std|h|minuten|minute|min|stück|stk|tage|tag)$/i, '');
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
  /* Minuten als Text: 150 -> "2 h 30 min" */
  function fmtDauer(min) {
    if (!fin(min) || min < 0) return '–';
    const h = Math.floor(min / 60 + 1e-9), m = Math.round(min - h * 60);
    return h && m ? h + ' h ' + m + ' min' : h ? h + ' h' : m + ' min';
  }
  const fmtStd = min => (fin(min) ? fmtN(min / 60, 2, true) + ' h' : '–');

  /* ---------- Zufall (seed-fähig) ---------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ---------- Berufe und typische Einsatzorte ---------- */
  const BERUFE = [
    { k: 'egs', n: 'Elektroniker/in für Geräte und Systeme', s: 'Elektroniker/in', ort: [{ n: 'Lehrwerkstatt Elektronik', in: 'in der Lehrwerkstatt Elektronik' }, { n: 'Prüffeld', in: 'im Prüffeld' }, { n: 'Fertigung', in: 'in der Fertigung' }] },
    { k: 'im', n: 'Industriemechaniker/in', s: 'Industriemechaniker/in', ort: [{ n: 'Lehrwerkstatt Metall', in: 'in der Lehrwerkstatt Metall' }, { n: 'Dreherei', in: 'in der Dreherei' }, { n: 'Montage', in: 'in der Montage' }] },
    { k: 'tpd', n: 'Technische/r Produktdesigner/in', s: 'Produktdesigner/in', ort: [{ n: 'Konstruktionsbüro', in: 'im Konstruktionsbüro' }, { n: 'CAD-Raum', in: 'im CAD-Raum' }, { n: 'Arbeitsvorbereitung', in: 'in der Arbeitsvorbereitung' }] },
    { k: 'fll', n: 'Fachkraft für Lagerlogistik', s: 'Lagerlogistik', ort: [{ n: 'Wareneingang', in: 'im Wareneingang' }, { n: 'Lager', in: 'im Lager' }, { n: 'Versand', in: 'im Versand' }] },
    { k: 'ik', n: 'Industriekaufmann/-frau', s: 'Industriekaufmann/-frau', ort: [{ n: 'Einkauf', in: 'im Einkauf' }, { n: 'Buchhaltung', in: 'in der Buchhaltung' }, { n: 'Vertrieb', in: 'im Vertrieb' }] },
    { k: 'fi', n: 'Fachinformatiker/in', s: 'Fachinformatiker/in', ort: [{ n: 'IT-Abteilung', in: 'in der IT-Abteilung' }, { n: 'Serverraum', in: 'im Serverraum' }, { n: 'Support', in: 'im Support' }] }
  ];
  const berufOf = k => BERUFE.find(b => b.k === k) || BERUFE[0];

  /* ---------- Wortlisten ---------- */
  /* Eintrag 'wort*' = Wortanfang, 'wort' = ganzes Wort, 'zwei wörter' = Wortfolge */
  /* PRUEFEN P1: Listen für "zu vage" und "Wertung" sind Faustregeln. Fehlen typische Formulierungen eurer Azubis, oder wird etwas zu Unrecht angestrichen (z. B. "unterstützt")? */
  const VAGUE = ['geholfen', 'mitgeholfen', 'mitgearbeitet', 'hilfestellung', 'hilfe', 'dabei gewesen', 'zugeschaut', 'zugesehen', 'mitgemacht', 'mitgelaufen', 'assistiert', 'unterstützt', 'diverse*', 'verschiedene sachen', 'verschiedene arbeiten', 'verschiedene aufgaben', 'dies und das', 'allerlei', 'sachen', 'kram', 'zeug', 'irgendwas', 'aufgaben erledigt', 'arbeiten erledigt', 'gearbeitet', 'etwas gemacht', 'was gemacht', 'viel gemacht', 'vieles gemacht', 'einiges gemacht', 'rumgestanden', 'herumgestanden', 'rumgeschaut'];
  const WERT = ['langweilig*', 'interessant*', 'spaß', 'spass', 'toll*', 'blöd*', 'stressig*', 'anstrengend*', 'cool*', 'nervig*', 'schlimm*', 'super', 'schön*', 'lustig*', 'öde', 'mühsam*', 'gut gefallen', 'nicht gefallen', 'gefallen', 'gern*', 'ungern'];
  const VAGUE_G = ['viel gelernt', 'vieles gelernt', 'einiges gelernt', 'viel neues', 'viel dazugelernt', 'dazugelernt', 'allerlei', 'dies und das'];
  const ICH = ['ich', 'mir', 'mich', 'mein', 'meine', 'meinen', 'meinem', 'meiner', 'meines'];
  /* PRUEFEN P7: Als Lernertrag (nicht als Tätigkeit) gelten Sätze mit diesen Signalwörtern ("gelernt", "Erkenntnis", "mir ist klar geworden" ...). Heißt das Feld bei euch auch "Gelernt", oder anders (z. B. "Erkenntnisse")? */
  const LERN = ['gelernt', 'erkenntnis', 'merke', 'lernertrag', 'dabei habe ich', 'dabei wurde', 'dabei lernte', 'dabei erfuhr', 'mir ist aufgefallen', 'mir ist klar', 'mir wurde klar', 'wurde mir klar', 'ich weiß', 'jetzt weiß', 'jetzt kann', 'jetzt kenne', 'jetzt verstehe', 'ich kann jetzt', 'habe verstanden', 'habe erkannt', 'habe erfahren', 'habe ich verstanden', 'habe ich erkannt', 'habe ich erfahren', 'wurde deutlich'];

  /* PRUEFEN P5: Fachbegriff-Stämme je Beruf (Teilwort im Wort, '=wort' = ganzes Wort). Passen sie zu euren Ausbildungsplänen? Welche Begriffe fehlen, welche sind zu allgemein? */
  const FACH = {
    egs: ['löt', 'multimeter', 'oszilloskop', 'schaltplan', 'platine', 'leiterplatte', 'widerstand', 'kondensator', 'transistor', 'diode', 'netzteil', 'spannung', 'stromkreis', 'messgerät', 'messung', 'gemessen', 'sicherung', 'schaltung', 'bestück', 'verdrahtung', 'kabelbaum', 'relais', 'sensor', 'mikrocontroller', 'arduino', 'schutzleiter', 'isolation', '=led', '=sps', '=pcb', '=smd', 'durchgang'],
    im: ['dreh', 'fräs', 'bohr', 'feil', 'säg', 'schleif', 'messschieber', 'messschraube', 'toleranz', 'passung', 'werkstück', 'vorrichtung', 'pneumatik', 'hydraulik', 'zylinder', 'ventil', 'lager', 'schweiß', 'gewinde', 'schmier', 'wartung', 'instandhalt', 'spannmittel', 'schnittgeschwindigkeit', 'vorschub', 'entgrat', 'stahl', 'welle', 'zahnrad', 'dichtung', 'drehmoment', 'montage', '=cnc', '=nut'],
    tpd: ['=cad', 'zeichnung', 'stückliste', 'bemaß', 'schnitt', 'ansicht', 'toleranz', 'passung', 'normteil', 'schraube', 'gewinde', 'maßstab', 'schraffur', 'baugruppe', 'explosions', 'volumenmodell', 'skizz', 'rauheit', 'werkstoff', 'konstruktion', 'bauteil', 'schriftfeld', 'projektion', 'flansch', '=3d'],
    fll: ['wareneingang', 'warenausgang', 'kommission', 'lieferschein', 'palette', 'stapler', 'lagerplatz', 'inventur', 'ladungssicher', 'zurrgurt', 'gefahrgut', 'bestand', 'regal', 'versand', 'verpack', 'bestell', 'frachtbrief', 'scanner', 'etikett', '=mhd', '=fifo', 'disposition', 'umschlag', 'ladeeinheit', 'lagerverwaltung', 'packliste', 'retoure', 'artikelnummer'],
    ik: ['buchung', 'beleg', 'rechnung', 'kontier', 'konto', 'bilanz', 'kalkulation', 'angebot', 'bestellung', 'einkauf', 'umsatzsteuer', 'vorsteuer', 'mahnung', 'zahlung', 'lieferant', 'bezugspreis', '=erp', 'lohn', 'abrechnung', 'inventur', 'kostenstelle', 'skonto', 'rabatt', 'auftragsbestätigung', 'mahnwesen', 'kassenbuch', 'kostenrechnung'],
    fi: ['netzwerk', 'server', 'client', '=switch', '=router', 'subnetz', 'ip-adresse', '=dhcp', '=dns', '=vlan', 'firewall', 'datensicherung', 'backup', 'datenbank', '=sql', 'linux', 'windows', 'ticket', 'benutzerkonto', 'active directory', 'patch', 'update', 'virtualisier', 'programmier', 'python', '=java', 'skript', '=git', 'hardware', '=ram', '=ssd', 'kabel', 'konfigur', 'monitoring'],
    alle: ['unterweisung', 'arbeitsschutz', 'brandschutz', 'schutzbrille', 'qualitätskontrolle', 'protokoll', 'arbeitsplan']
  };

  /* ---------- Satzzerlegung ---------- */
  const PROT = /\b(z\.\s?B|d\.\s?h|u\.\s?a|bzw|ca|ggf|inkl|usw|std|min|nr|vgl)\./gi;
  /* Zerlegt den Text in Stichpunkte (Zeilen, Semikolon, Aufzählungszeichen, Satzende vor Großbuchstaben) */
  function splitItems(text) {
    let t = String(text == null ? '' : text).replace(/\r/g, '\n');
    t = t.replace(PROT, m => m.replace(/\./g, '\u0001'));
    t = t.replace(/([.!?])\s+(?=[A-ZÄÖÜ])/g, '$1\n');
    return t.split(/\n|;|•|·/).map(x => x.replace(/\u0001/g, '.').replace(/^\s*(?:[-–*]|\d{1,2}[.)])\s+/, '').trim()).filter(x => x.length > 0 && /[A-Za-zÄÖÜäöüß0-9]/.test(x));
  }
  const norm = s => ' ' + words(s).map(LOW).join(' ') + ' ';
  /* Treffer in einer Liste ('wort*', 'wort', 'zwei wörter'); liefert den gefundenen Text oder null */
  function hitList(list, s) {
    const toks = words(s).map(LOW), n = norm(s);
    for (const e of list) {
      if (e.charAt(e.length - 1) === '*') { const st = e.slice(0, -1), t = toks.find(x => x.indexOf(st) === 0); if (t) return t; }
      else if (n.indexOf(' ' + e + ' ') >= 0) return e;
    }
    return null;
  }

  /* ---------- Dauer ---------- */
  /* PRUEFEN P4: Als Dauer zählen Minuten- und Stundenangaben ("90 Minuten", "1,5 Stunden", "2 h", "halbe Stunde") und Zeiträume mit Uhr ("von 8:00 bis 10:00 Uhr"). "Vormittags", "ganztägig", "lange" zählen als zu ungenau. Reicht euch diese Genauigkeit (z. B. Viertelstunden)? */
  const WNUM = { anderthalb: 90, halbe: 30, ein: 60, eine: 60, zwei: 120, drei: 180, vier: 240, 'fünf': 300, sechs: 360, sieben: 420, acht: 480 };
  function findDauer(s) {
    s = String(s == null ? '' : s);
    const L = 'A-Za-zÄÖÜäöüß';
    const mr = new RegExp('(?:von\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s*(?:uhr)?\\s*(?:-|–|bis)\\s*(\\d{1,2})(?:[:.](\\d{2}))?\\s*uhr', 'i').exec(s);
    if (mr) {
      const a = +mr[1] * 60 + (+mr[2] || 0), b = +mr[3] * 60 + (+mr[4] || 0);
      if (b > a && +mr[1] < 24 && +mr[3] <= 24) return { min: b - a, vague: false, spans: [[mr.index, mr.index + mr[0].length]] };
    }
    const spans = []; let min = 0, found = false, m;
    const reN = new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(stunden|stunde|std\\.?|h|minuten|minute|min\\.?)(?![' + L + '])', 'gi');
    while ((m = reN.exec(s))) {
      const v = parseDe(m[1]); if (!(v >= 0)) continue;
      min += /^(s|h)/i.test(m[2]) ? v * 60 : v; found = true; spans.push([m.index, m.index + m[0].length]);
    }
    const reW = new RegExp('(?:^|[^' + L + '])(anderthalb|halbe|ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht)\\s+(stunden?|std)(?![' + L + '])', 'gi');
    while ((m = reW.exec(s))) {
      const st = m.index + m[0].indexOf(m[1]); min += WNUM[m[1].toLowerCase()]; found = true; spans.push([st, m.index + m[0].length]);
    }
    const reV = /(dreiviertelstunde|viertelstunde)/gi;
    while ((m = reV.exec(s))) { min += /^drei/i.test(m[1]) ? 45 : 15; found = true; spans.push([m.index, m.index + m[0].length]); }
    if (found) return { min, vague: false, spans };
    const vague = /ganzen\s+(tag|vormittag|nachmittag|morgen)|ganztägig|ganztaegig|vormittag|nachmittag|stundenlang|\blange\b|\bkurz\b|morgens|mittags|abends/i.test(s);
    return { min: NAN, vague, spans: [] };
  }
  /* Text ohne Zeit-/Dauerangabe (für das Gerüst) */
  function stripDauer(s) {
    s = String(s == null ? '' : s);
    const sp = findDauer(s).spans.slice().sort((a, b) => b[0] - a[0]);
    sp.forEach(x => { s = s.slice(0, x[0]) + s.slice(x[1]); });
    return s.replace(/\(\s*[,;]?\s*\)/g, '').replace(/\s+([,.;)!?])/g, '$1').replace(/[,;]\s*([.!?])/g, '$1').replace(/[,;]\s*$/, '')
      .replace(/\s+(in|für|ca\.?|etwa|dauer:?|dauerte)\s*([.!?]?)$/i, '$2').replace(/\s{2,}/g, ' ').trim();
  }

  /* ---------- Zeitform ---------- */
  /* PRUEFEN P3: Die Zeitform wird nur grob erkannt: Perfekt (haben/sein + Partizip, auch "Platine gelötet"), Präteritum (lötete, war, maß) oder neutral (Nominalstil "Löten von ..."). Gemischt wird beanstandet, wenn Perfekt und Präteritum im selben Eintrag vorkommen. Welche Form soll im Betrieb gelten (Präteritum, Perfekt, Nominalstil)? */
  const AUX = ['habe', 'haben', 'hat', 'hast', 'habt', 'bin', 'bist', 'sind', 'ist', 'seid'];
  const PRAET = new Set(['war', 'waren', 'hatte', 'hatten', 'wurde', 'wurden', 'musste', 'mussten', 'durfte', 'durften', 'konnte', 'konnten', 'sollte', 'sollten', 'wollte', 'fand', 'ging', 'kam', 'sah', 'nahm', 'gab', 'half', 'hielt', 'las', 'maß', 'schrieb', 'schnitt', 'schloss', 'trug', 'zog', 'fuhr', 'begann', 'bekam', 'brachte', 'dachte', 'lernte', 'arbeitete', 'übte', 'prüfte', 'montierte', 'bestellte', 'lötete', 'bohrte', 'drehte', 'fräste', 'feilte', 'sägte', 'zeichnete', 'erstellte', 'kontrollierte', 'sortierte', 'lagerte', 'verpackte', 'buchte', 'legte', 'stellte', 'baute', 'richtete', 'wechselte', 'schaltete', 'installierte', 'konfigurierte', 'testete', 'dokumentierte', 'bearbeitete', 'erfasste', 'beschriftete', 'reinigte', 'schmierte', 'wartete', 'kalibrierte', 'programmierte', 'öffnete', 'skizzierte', 'bemaßte', 'modellierte', 'wählte', 'sicherte', 'zählte', 'holte', 'berechnete', 'kontierte', 'crimpte', 'erledigte', 'unterstützte', 'schraubte', 'maß', 'stellte', 'half', 'verglich', 'arbeiteten', 'prüften', 'montierten', 'machten', 'führte', 'trennte', 'lieferte', 'packte', 'räumte']);
  const PP_RE = /^(?:ge[a-zäöüß]{2,}(?:t|en)|[a-zäöüß]{3,}iert|[a-zäöüß]+ge[a-zäöüß]{2,}(?:t|en)|(?:ver|be|er|ent|zer|miss)[a-zäöüß]{3,}(?:t|en))$/;
  const PP_NOT = new Set(['gegen', 'genug', 'gelten', 'gehören', 'gestern', 'gesamt', 'gesamten', 'geringen', 'genauen', 'gemeinsamen', 'verschieden', 'beiden', 'entlang', 'erst']);
  const isPP = x => PP_RE.test(x) && !PP_NOT.has(x);
  /* Präteritum: bekannte Formen oder (nicht am Satzanfang, kleingeschrieben) regelmäßige Endung -te (Plural-Formen auf -ten nur aus der Liste, sonst stören Adjektive und Infinitive wie "breiten", "ableiten"), ohne Partizip-Adjektive (ge...), Superlative (-ste) und "letzte" */
  const isPraet = (x, orig, first) => PRAET.has(x) || (!first && /^[a-zäöüß]{3,}te$/.test(orig) && !/^ge/.test(orig) && !/(?:ste|zte)$/.test(orig) && !PP_NOT.has(orig));
  function tenseOf(item) {
    const ot = words(stripDauer(item)), tok = ot.map(LOW); if (!tok.length) return 'neutral';
    /* Partizip nur bei kleingeschriebenem Wort (Substantive wie "Bezugskosten" oder "Geräten" sehen sonst wie Partizipien aus) */
    const pp = i => /^[a-zäöüß]/.test(ot[i]) && isPP(tok[i]);
    const aux = tok.some(x => AUX.indexOf(x) >= 0), parts = tok.some((x, i) => pp(i)), last = pp(tok.length - 1);
    const praet = tok.some((x, i) => isPraet(x, ot[i], i === 0) && (i === 0 || /^[a-zäöüß]/.test(ot[i])));
    if (aux && parts) return 'perf';
    if (praet) return 'praet';
    if (last) return 'perf';
    return 'neutral';
  }

  /* ---------- Einzelne Prüfungen ---------- */
  const hasIch = s => words(s).some(w => ICH.indexOf(LOW(w)) >= 0);
  const isLern = s => !!hitList(LERN, s);
  function vagueHit(s) {
    const h = hitList(VAGUE, s); if (h) return h;
    const t = words(s).map(LOW);
    if (t.indexOf('dabei') >= 0 && ['war', 'waren', 'bin', 'sind', 'gewesen'].some(x => t.indexOf(x) >= 0) && !isLern(s)) return 'dabei';
    return null;
  }
  function findFach(s, beruf) {
    /* nur großgeschriebene Wörter (Substantive wie "Multimeter", "Löten") zählen; kleingeschriebene Verben wie "gelötet" sind keine Fachbegriffe */
    const low = LOW(s), toks = words(s).filter(t => /^[A-ZÄÖÜ0-9]/.test(t)), out = [], seen = {};
    (FACH[beruf] || []).concat(FACH.alle).forEach(st => {
      let hit = null;
      if (st.charAt(0) === '=') { const e = st.slice(1); hit = toks.find(t => LOW(t) === e); }
      else if (st.indexOf(' ') >= 0) { if (low.indexOf(st) >= 0) hit = st; }
      else hit = toks.find(t => LOW(t).indexOf(st) >= 0);
      if (hit && !seen[LOW(hit)]) { seen[LOW(hit)] = 1; out.push(hit); }
    });
    return out;
  }
  const hasFach = (s, beruf) => findFach(s, beruf).length > 0;
  const hasDauer = s => fin(findDauer(s).min);
  const firstWord = s => { const w = words(s)[0]; return w ? LOW(w) : ''; };

  /* Prüfung eines einzelnen Stichpunkts. flags: vage, wertung, ich, dauer, dauervage, fach (Lernertrag-Sätze bekommen keine Flags). */
  function checkItem(item, beruf) {
    const lern = isLern(item), d = findDauer(item), f = { text: item, lern, dauer: d, tense: lern ? 'neutral' : tenseOf(item), fach: findFach(item, beruf), flags: [] };
    if (lern) return f;
    const v = vagueHit(item); if (v) { f.vage = v; f.flags.push('vage'); }
    const w = hitList(WERT, item); if (w) { f.wertung = w; f.flags.push('wertung'); }
    if (hasIch(item)) f.flags.push('ich');
    if (!fin(d.min)) f.flags.push(d.vague ? 'dauervage' : 'dauer');
    if (!f.fach.length) f.flags.push('fach');
    return f;
  }

  /* Satzanfänge: Wort, das bei mindestens 3 Stichpunkten vorn steht oder bei 2 direkt aufeinanderfolgenden. Liefert null oder { word, idx (0-basiert) } */
  /* PRUEFEN P6: Regel "mindestens 3 gleiche Satzanfänge oder 2 direkt hintereinander". Ist das sinnvoll oder zu streng (z. B. bei Aufzählungen nach Uhrzeit)? */
  function startStats(items) {
    const fw = items.map(firstWord), cnt = {};
    fw.forEach(w => { if (w) cnt[w] = (cnt[w] || 0) + 1; });
    let best = null;
    Object.keys(cnt).forEach(w => {
      let run = 0, maxRun = 0; fw.forEach(x => { run = x === w ? run + 1 : 0; maxRun = Math.max(maxRun, run); });
      if (cnt[w] >= 3 || maxRun >= 2) { if (!best || cnt[w] > best.n) best = { word: w, n: cnt[w], idx: fw.map((x, i) => (x === w ? i : -1)).filter(i => i >= 0) }; }
    });
    return best;
  }
  const maxStart = items => { const fw = items.map(firstWord), c = {}; fw.forEach(w => { c[w] = (c[w] || 0) + 1; }); return Math.max(0, ...Object.keys(c).map(k => c[k])); };

  /* Feld "Gelernt": Flags leer, kurz, vage, wertung, taetigkeit */
  function checkGelernt(text) {
    const t = String(text == null ? '' : text).trim(), fl = [];
    if (!t) return { flags: ['leer'], words: 0 };
    const w = words(t).length;
    if (hitList(VAGUE_G, t)) fl.push('vage');
    if (hitList(WERT, t)) fl.push('wertung');
    if (w < 5 && fl.indexOf('vage') < 0) fl.push('kurz');
    if (!isLern(t) && tenseOf(t) !== 'neutral') fl.push('taetigkeit');
    return { flags: fl, words: w };
  }

  /* ---------- Gesamtanalyse ---------- */
  const MSG = {
    vage: (h) => 'Zu vage: „' + h + '“ sagt nicht, was du konkret getan hast. Nenne Bauteil, Vorgang oder Werkzeug.',
    wertung: (h) => 'Wertung statt Tätigkeit: „' + h + '“ beschreibt dein Gefühl, nicht deine Arbeit. Schreibe die Tätigkeit sachlich auf; was du daraus mitnimmst, gehört ins Feld „Gelernt“.',
    ich: () => 'Ich-Form: Im Bericht steht die Tätigkeit im Vordergrund („Platine gelötet“ statt „Ich habe gelötet“). Frag deinen Ausbilder, ob bei euch die Ich-Form erlaubt ist.',
    dauer: () => 'Keine Dauer: Ergänze, wie lange die Tätigkeit dauerte (zum Beispiel „2 Stunden“ oder „von 8:00 bis 10:00 Uhr“).',
    dauervage: () => 'Zu ungenau: „vormittags“, „ganztägig“ oder „lange“ ist keine Dauer. Nenne Stunden oder Minuten oder Anfang und Ende.',
    fach: () => 'Kein Fachbegriff: Welches Bauteil, Werkzeug oder Verfahren war beteiligt? Nenne es beim Namen.'
  };
  /* PRUEFEN P2: "Ich-Form" wird als Hinweis angezeigt (nicht als Fehler). Gilt im Betrieb die sachliche Form ohne "ich", oder ist die Ich-Form erlaubt? */
  const SEV = { vage: 'warn', wertung: 'warn', ich: 'hint', dauer: 'warn', dauervage: 'warn', fach: 'hint' };

  function analyze(text, beruf, opts) {
    opts = opts || {};
    const raw = splitItems(text), items = raw.map(x => checkItem(x, beruf)), findings = [];
    const taet = items.filter(i => !i.lern), lerns = items.filter(i => i.lern);
    items.forEach((it, i) => it.flags.forEach(c => findings.push({ code: c, sev: SEV[c], idx: [i], msg: MSG[c](c === 'vage' ? it.vage : c === 'wertung' ? it.wertung : null) })));
    const perf = [], praet = [];
    items.forEach((it, i) => { if (it.tense === 'perf') perf.push(i); else if (it.tense === 'praet') praet.push(i); });
    const mixed = perf.length > 0 && praet.length > 0;
    if (mixed) {
      const minor = perf.length <= praet.length ? perf : praet;
      findings.push({ code: 'zeit', sev: 'warn', idx: minor, msg: 'Zeitform gemischt: ' + perf.length + ' Stichpunkt(e) im Perfekt, ' + praet.length + ' im Präteritum. Bleibe bei einer Form und prüfe vor allem Nr. ' + minor.map(i => i + 1).join(', ') + '.' });
    }
    const st = startStats(items.map(i => i.text));
    if (st) findings.push({ code: 'anfang', sev: 'hint', idx: st.idx, msg: 'Satzanfänge wiederholen sich: ' + st.n + ' Stichpunkte beginnen mit „' + st.word + '“ (Nr. ' + st.idx.map(i => i + 1).join(', ') + '). Beginne mit der Tätigkeit selbst oder lasse das Wort weg.' });
    const fachAll = []; taet.forEach(i => i.fach.forEach(f => { if (fachAll.map(LOW).indexOf(LOW(f)) < 0) fachAll.push(f); }));
    let total = 0, nDauer = 0; taet.forEach(i => { if (fin(i.dauer.min)) { total += i.dauer.min; nDauer++; } });
    const g = opts.gelernt != null ? checkGelernt(opts.gelernt) : null;
    if (!items.length) findings.push({ code: 'leer', sev: 'warn', idx: [], msg: 'Noch keine Stichpunkte: Schreibe pro Zeile eine Tätigkeit.' });
    if (items.length && !taet.length) findings.push({ code: 'keine-taetigkeit', sev: 'warn', idx: [], msg: 'Es steht nur Gelerntes da, aber keine Tätigkeit. Beschreibe zuerst, was du gemacht hast.' });
    if (taet.length && nDauer === 0) findings.push({ code: 'keine-gesamtdauer', sev: 'warn', idx: [], msg: 'Bei keinem Stichpunkt steht eine Dauer, die Gesamtzeit des Tages bleibt unbekannt.' });
    return { items, findings, nTaet: taet.length, nLern: lerns.length, total, nDauer, tense: { perf, praet, mixed }, starts: st, fachAll, gelernt: g, count: findings.filter(f => f.sev === 'warn').length };
  }

  /* ---------- Gerüst (Tagesbericht) ---------- */
  /* Ein Stichpunkt als sachliche Tätigkeit: ohne Ich-Satzanfang und ohne Dauerangabe, erster Buchstabe groß */
  function neutralize(item) {
    let t = stripDauer(item);
    for (let k = 0; k < 3; k++) t = t.replace(/^(?:ich\s+(?:habe|hab)\s+|(?:habe|hab)\s+ich\s+|ich\s+|dann\s+|danach\s+|anschließend\s+|außerdem\s+|zuletzt\s+|zuerst\s+|heute\s+|auch\s+)/i, '');
    t = t.replace(/\s+ich\b/i, '').replace(/[.!?]+$/, '').trim();
    return cap(t);
  }
  /* PRUEFEN P11: Das Gerüst enthält Tätigkeit, Ort/Abteilung, Dauer, Fachbegriff und Gelerntes. Fehlt eine Spalte, die euer Vordruck verlangt? */
  function buildReport(opts) {
    opts = opts || {};
    const beruf = opts.beruf || 'egs', a = analyze(opts.text, beruf, { gelernt: opts.gelernt }), rows = [], lern = [];
    a.items.forEach((it, i) => {
      if (it.lern) { lern.push(it.text); return; }
      const bad = it.flags.indexOf('vage') >= 0 || it.flags.indexOf('wertung') >= 0;
      rows.push({ nr: rows.length + 1, idx: i, orig: it.text, taetigkeit: bad ? '' : neutralize(it.text), neu: bad, dauerMin: it.dauer.min, dauer: fin(it.dauer.min) ? fmtDauer(it.dauer.min) : '', fach: it.fach.slice(0, 2).join(', '), flags: it.flags });
    });
    const gel = String(opts.gelernt == null ? '' : opts.gelernt).trim();
    return { beruf, ort: String(opts.ort == null ? '' : opts.ort).trim(), datum: String(opts.datum == null ? '' : opts.datum).trim(), rows, total: a.total, gelernt: (gel ? [gel] : []).concat(lern), analysis: a };
  }

  /* ---------- Woche ---------- */
  const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
  function weekSummary(days, beruf) {
    const out = [], by = {}; let total = 0, warn = 0, missing = 0;
    (days || []).forEach((txt, d) => {
      const a = analyze(txt, beruf), taet = a.items.filter(i => !i.lern), miss = taet.filter(i => i.flags.indexOf('dauer') >= 0 || i.flags.indexOf('dauervage') >= 0).length;
      taet.forEach(i => { if (fin(i.dauer.min) && i.fach.length) { const k = i.fach[0]; by[LOW(k)] = by[LOW(k)] || { name: k, min: 0 }; by[LOW(k)].min += i.dauer.min; } });
      out.push({ tag: TAGE[d] || 'Tag ' + (d + 1), n: taet.length, min: a.total, miss, warn: a.count, mixed: a.tense.mixed });
      total += a.total; warn += a.count; missing += miss;
    });
    const byFach = Object.keys(by).map(k => by[k]).sort((x, y) => y.min - x.min || (x.name < y.name ? -1 : 1));
    return { days: out, total, warn, missing, byFach, empty: out.filter(x => !x.n).length };
  }

  const API = { parseDe, fmtDe, fmtN, rd, num, hashStr, rng, ri, pick, shuffle, cap, words, fmtDauer, fmtStd,
    BERUFE, berufOf, VAGUE, WERT, FACH, TAGE, splitItems, findDauer, stripDauer, tenseOf, isLern, hasIch, vagueHit, findFach, hasFach, hasDauer, firstWord,
    checkItem, startStats, maxStart, checkGelernt, analyze, neutralize, buildReport, weekSummary, hitList };
  root.BHF_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
