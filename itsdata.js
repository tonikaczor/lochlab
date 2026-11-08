'use strict';
/* Tonfunk IT-Sicherheits-Lab: Daten (Aufgaben mit Zufallsgeneratoren oder festen Fällen, Beispiele).
   window.ITS_DATA  { tasks, beispiele, cats, build, FW1, FW2 }
   window.ITS_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'its', Status in localStorage 'lm4.its.done' = {id:true})
   Jede Aufgabe hat gen(R): seed-fähig (R = C.rng). Rückgabe je nach Art (kind):
     num    { text, unit, raw, dec, steps, tips[2] }                      Zahl mit Toleranz
     text   { kind:'text', text, accept[], label, steps, tips }           Textantwort (Geheimtext, Bitfolge)
     choice { kind:'choice', text, opts[], correct, steps, tips }         eine Antwort wählen
     multi  { kind:'multi', text, opts[], correct[], steps, tips }        mehrere Antworten markieren
     rows   { kind:'rows', text, rows:[{q, opts[], correct}], steps, tips } je Zeile eine Antwort wählen
   optional show: Liste von Blöcken {type:'mail'|'table'|'mono', ...} (E-Mail, Tabelle, Festbreiten-Text).
   build(task, seed) macht daraus die fertige Aufgabe (Lösung als Text in sol, Lösungsweg, Rundungshinweis).
   Nur Schutz-Sicht: Rechnen, Lesen, Bewerten. Keine Angriffsanleitungen. */
(function (root) {
  const C = root.ITS_CORE || (typeof require === 'function' ? require('./itscore.js') : null);
  const { fmt, rs, rd, pick, ri, shuffle, fmtBig } = C;
  const dig = n => n === 0 ? 'ganze Zahlen' : n === 1 ? 'eine Nachkommastelle' : n + ' Nachkommastellen';
  const cats = ['Passwörter', 'Verschlüsselung und Hash', 'Phishing und Social Engineering', 'Rechte und Firewall', 'Backup', 'Verfügbarkeit', 'Schutzziele und Recht'];
  const names = ['Anna', 'Ben', 'Cem', 'Dora'];

  /* richtige Antwort + falsche Antworten mischen: { opts, correct } */
  function mk(R, right, wrongs) { const all = shuffle(R, [right].concat(wrongs)); return { opts: all, correct: all.indexOf(right) }; }
  const bin4 = b => b.slice(0, 4) + ' ' + b.slice(4);
  const byte = R => ri(R, 17, 238);   /* nie 0 oder 255: keine triviale Lösung */

  /* ---------- Firewall-Regelsätze (Quelle der Wahrheit für Aufgaben und Werkzeug) ---------- */
  const FW1 = [
    { action: 'deny', proto: '*', src: '203.0.113.0/24', dst: '*', port: '*' },
    { action: 'allow', proto: 'tcp', src: '*', dst: '192.168.10.80', port: 443 },
    { action: 'allow', proto: 'tcp', src: '192.168.10.0/24', dst: '*', port: 443 },
    { action: 'allow', proto: 'udp', src: '192.168.10.0/24', dst: '*', port: 53 },
    { action: 'deny', proto: '*', src: '*', dst: '*', port: '*' }
  ];
  const FW2 = [
    { action: 'allow', proto: 'tcp', src: '10.1.0.0/16', dst: '10.2.0.10', port: 3306 },
    { action: 'deny', proto: 'tcp', src: '*', dst: '10.2.0.10', port: '*' },
    { action: 'allow', proto: 'tcp', src: '*', dst: '10.2.0.0/24', port: 443 },
    { action: 'deny', proto: '*', src: '*', dst: '*', port: '*' }
  ];
  const FW1_PKTS = [
    { proto: 'tcp', src: '203.0.113.7', dst: '192.168.10.80', port: 443 }, { proto: 'tcp', src: '198.51.100.4', dst: '192.168.10.80', port: 443 },
    { proto: 'tcp', src: '198.51.100.4', dst: '192.168.10.80', port: 22 }, { proto: 'tcp', src: '192.168.10.23', dst: '93.184.216.34', port: 443 },
    { proto: 'udp', src: '192.168.10.23', dst: '192.168.10.1', port: 53 }, { proto: 'tcp', src: '192.168.10.23', dst: '93.184.216.34', port: 25 },
    { proto: 'udp', src: '198.51.100.9', dst: '192.168.10.80', port: 53 }, { proto: 'tcp', src: '192.168.10.44', dst: '93.184.216.34', port: 80 }
  ];
  const fwTable = rules => ({ type: 'table', title: 'Regeln (von oben nach unten)', head: ['Nr.', 'Aktion', 'Protokoll', 'Quelle', 'Ziel', 'Zielport'], rows: rules.map((r, i) => [String(i + 1), r.action === 'allow' ? 'erlauben' : 'blocken', r.proto === '*' ? 'alle' : r.proto.toUpperCase(), r.src === '*' ? 'alle' : r.src, r.dst === '*' ? 'alle' : r.dst, r.port === '*' ? 'alle' : String(r.port)]) });

  /* ---------- Phishing-Beispiel-Mails (fiktive Adressen, Schutz-Sicht: erkennen, nicht bauen) ---------- */
  /* PRUEFEN: Bewertung der Mail-Merkmale: Als „nicht auffällig“ gelten bewusst Anzeigename, https, Signatur, Anrede mit Vornamen, „Passwort läuft ab“ im Betreff und „Gesendet von meinem Smartphone“. Stimmt ihr dieser Einordnung zu, oder soll eines davon als verdächtig zählen? */
  const MAILS = {
    paket: {
      show: { type: 'mail', from: 'DHL Kundenservice <info@dhl-paket-zustellung.xyz>', subj: 'Dein Paket wartet - letzte Chance!', body: ['Lieber Kunde,', 'deine Sendung konnte nicht zugestellt werden. Bitte zahle die Zollgebühr von 1,99 € innerhalb von 24 Stunden, sonst geht das Paket an den Absender zurück.', 'Mit freundlichen Grüßen', 'Dein Zustellteam'], linkText: 'Jetzt Gebühr bezahlen', link: 'http://dhl.paket-zustellung-konto.xyz/zoll' },
      items: [
        { t: 'Absenderadresse: info@dhl-paket-zustellung.xyz', bad: true, why: 'Die Domain gehört nicht dem Paketdienst: Endung .xyz und ein zusammengesetzter Name, der nur echt wirkt.' },
        { t: 'Betreff: „Dein Paket wartet - letzte Chance!“', bad: true, why: 'Druck („letzte Chance“) soll zum schnellen, unüberlegten Klicken bringen.' },
        { t: 'Anrede: „Lieber Kunde“', bad: true, why: 'Keine persönliche Anrede: Eine echte Zustellung kennt deinen Namen.' },
        { t: 'Angezeigter Absendername: „DHL Kundenservice“', bad: false, why: 'Der Anzeigename lässt sich beliebig einstellen. Entscheidend ist die Adresse dahinter, nicht der Name davor.' },
        { t: 'Frist: Zahlung innerhalb von 24 Stunden', bad: true, why: 'Eine knappe Frist mit Folge (Paket geht zurück) ist ein typisches Druckmittel.' },
        { t: 'Link-Ziel: http://dhl.paket-zustellung-konto.xyz/zoll', bad: true, why: 'Die Domain steht direkt vor der Endung: paket-zustellung-konto.xyz. „dhl“ ist nur eine vorgeschobene Unterdomain. Dazu ohne Verschlüsselung (http).' },
        { t: 'Grußformel: „Mit freundlichen Grüßen“', bad: false, why: 'Eine höfliche Grußformel sagt nichts über die Echtheit aus.' }
      ]
    },
    it: {
      show: { type: 'mail', from: 'IT-Helpdesk <helpdesk@firma-beispiel.de.mail-sicherheit.net>', subj: 'Dein Passwort läuft heute ab', body: ['Hallo,', 'dein Passwort für das Firmennetz läuft heute um 18:00 Uhr ab. Melde dich bitte über den Link an und gib dein altes und dein neues Passwort ein, sonst wird dein Konto gesperrt.', 'Viele Grüße', 'IT-Abteilung'], linkText: 'Passwort jetzt erneuern', link: 'https://firma-beispiel.de.mail-sicherheit.net/anmeldung' },
      items: [
        { t: 'Absenderadresse: helpdesk@firma-beispiel.de.mail-sicherheit.net', bad: true, why: 'Maßgeblich ist der Teil ganz rechts vor der Endung: mail-sicherheit.net. „firma-beispiel.de“ steht nur davor und ist nicht die Firmendomain.' },
        { t: 'Betreff: „Dein Passwort läuft heute ab“', bad: false, why: 'Ablauf-Hinweise verschickt auch eine echte IT. Für sich allein beweist der Betreff nichts.' },
        { t: 'Aufforderung, das alte und das neue Passwort einzugeben', bad: true, why: 'Eine echte IT-Abteilung fragt nie per Link-Formular nach deinem Passwort.' },
        { t: 'Androhung: „sonst wird dein Konto gesperrt“', bad: true, why: 'Drohung mit Sperrung erzeugt Druck.' },
        { t: 'Anrede: „Hallo,“', bad: false, why: 'Eine kurze Anrede ohne Namen kommt auch in echten internen Rundmails vor.' },
        { t: 'Link-Ziel: https://firma-beispiel.de.mail-sicherheit.net/anmeldung', bad: true, why: 'Der Link führt auf mail-sicherheit.net, nicht auf die Firmendomain.' },
        { t: 'Der Link beginnt mit https', bad: false, why: 'https heißt nur „verschlüsselte Verbindung“. Auch Betrugsseiten bekommen Zertifikate. Es sagt nichts über die Echtheit.' },
        { t: 'Signatur: „IT-Abteilung“', bad: false, why: 'Eine Signatur ist schnell nachgemacht und beweist nichts.' }
      ]
    },
    chef: {
      show: { type: 'mail', from: 'Dr. Martin Weber (Geschäftsführung) <m.weber.gf@mailbox-direkt.de>', subj: 'Dringend und vertraulich', body: ['Hallo Anna,', 'ich sitze in einer Sitzung und kann nicht telefonieren. Besorge bitte heute noch 5 Geschenkkarten zu je 100 € und schicke mir die Codes per Antwort. Sprich mit niemandem darüber. Ich erstatte dir alles morgen.', 'Gesendet von meinem Smartphone'], linkText: '', link: '' },
      items: [
        { t: 'Absenderadresse: m.weber.gf@mailbox-direkt.de', bad: true, why: 'Die Geschäftsführung schreibt von der Firmendomain und nicht von einem privaten Mail-Anbieter. Der Anzeigename „Geschäftsführung“ ist frei einstellbar.' },
        { t: 'Betreff: „Dringend und vertraulich“', bad: true, why: 'Dringlichkeit und Geheimhaltung sind typische Zutaten dieser Masche (Chef-Betrug).' },
        { t: 'Anrede: „Hallo Anna,“', bad: false, why: 'Die Anrede mit Vornamen ist nicht auffällig. Namen lassen sich leicht aus Firmenwebseiten oder Netzwerken ablesen.' },
        { t: 'Bitte, Geschenkkarten zu kaufen und die Codes per Antwort zu schicken', bad: true, why: 'Eine ungewöhnliche Geldforderung, die auf dem normalen Weg (Bestellung, Freigabe, Rechnung) nicht vorkäme.' },
        { t: 'Aufforderung: „Sprich mit niemandem darüber“', bad: true, why: 'Geheimhaltung verhindert, dass du nachfragst und der Betrug auffällt.' },
        { t: 'Hinweis: „kann nicht telefonieren“', bad: true, why: 'Die Ausrede verhindert den wichtigsten Gegencheck: Rückruf auf der bekannten Nummer.' },
        { t: 'Zeile: „Gesendet von meinem Smartphone“', bad: false, why: 'Dieser Zusatz steht in vielen echten Mails und ist allein kein Merkmal.' }
      ]
    }
  };
  function mailTask(key, tips) {
    return R => {
      const m = MAILS[key], order = shuffle(R, m.items.map((_, i) => i)), items = order.map(i => m.items[i]);
      return { kind: 'multi', text: 'Du bekommst diese E-Mail an deine Firmenadresse. Welche Punkte sind auffällig und sprechen gegen eine echte Nachricht? Markiere alle zutreffenden Punkte.', show: [m.show],
        opts: items.map(x => x.t), correct: items.map((x, i) => x.bad ? i : -1).filter(i => i >= 0),
        steps: ['Auffällig:'].concat(items.filter(x => x.bad).map(x => '✗ ' + x.t + ': ' + x.why), ['Nicht auffällig (für sich allein kein Beweis):'], items.filter(x => !x.bad).map(x => '✓ ' + x.t + ': ' + x.why), ['Im Zweifel nicht klicken, nichts eingeben und die Mail der IT melden (über einen bekannten Weg, nicht per Antwort).']),
        tips };
    };
  }

  /* ---------- Hilfen für Aufgaben ---------- */
  function bruteGen(list, big) {
    return R => {
      const [N, L, rate] = pick(R, list), b = C.brute(N, L, rate), s = b.seconds; let unit, div;
      if (big) { if (s >= 31536000) { unit = 'Jahre'; div = 31536000; } else { unit = 'Tage'; div = 86400; } } else { if (s >= 3600) { unit = 'Stunden'; div = 3600; } else { unit = 'Minuten'; div = 60; } }
      const raw = s / div, dec = raw >= 100 ? 0 : 1;
      return { text: `Ein Angreifer kann ${fmtBig(rate)} Passwörter pro Sekunde ausprobieren. Das Passwort hat ${L} zufällig gewählte Zeichen aus einem Zeichenvorrat von ${N} Zeichen. Wie lange braucht er höchstens, um alle Möglichkeiten durchzuprobieren? Angabe in ${{ Minuten: 'Minuten', Stunden: 'Stunden', Tage: 'Tagen', Jahre: 'Jahren' }[unit]}.` + (unit === 'Jahre' ? ' (1 Jahr = 365 Tage)' : ''),
        unit, raw, dec, meta: { N, L, rate },
        steps: b.steps.slice(0, 2).concat([`${fmtBig(rs(s))} s : ${fmtBig(div)} = ${fmt(rd(raw, dec), dec)} ${unit}`]),
        tips: ['Zuerst die Zahl aller möglichen Passwörter bestimmen: Zeichenvorrat hoch Länge. Dann durch die Versuche pro Sekunde teilen.', `Möglichkeiten = ${N}^${L}. Das Ergebnis in Sekunden dann in ${unit} umrechnen (${unit === 'Minuten' ? ': 60' : unit === 'Stunden' ? ': 3600' : unit === 'Tage' ? ': 86400' : ': 86400 und : 365'}).`] };
    };
  }
  const WORDS = ['NETZWERK', 'SERVER', 'FIREWALL', 'PASSWORT', 'BACKUP', 'ROUTER', 'SWITCH', 'DATENBANK', 'PROTOKOLL', 'SICHERHEIT', 'VIRUS', 'ZUGRIFF'];

  /* ---------- Aufgaben (Reihenfolge = ID its1 ... itsN) ---------- */
  const defs = [
    /* ===== Passwörter ===== */
    ['Passwörter', 1, 'Zeichenvorrat bestimmen', R => {
      const combo = pick(R, [['klein', 'ziff'], ['klein', 'gross'], ['klein', 'gross', 'ziff'], ['klein', 'gross', 'ziff', 'sonder'], ['ziff'], ['gross', 'ziff'], ['klein', 'sonder']]), sets = C.CHARSETS.filter(c => combo.indexOf(c.k) >= 0), N = C.poolSize(combo);
      return { text: `Ein Passwortfeld erlaubt genau diese Zeichengruppen: ${sets.map(s => s.name).join('; ')}. Aus wie vielen verschiedenen Zeichen kann man pro Stelle wählen?`, unit: '', label: 'Zeichenvorrat N', raw: N, dec: 0, meta: { combo },
        steps: sets.map(s => `${s.name}: ${s.n}`).concat([`Summe: ${sets.map(s => s.n).join(' + ')} = ${N}`]),
        tips: ['Zähle, wie viele Zeichen jede erlaubte Gruppe enthält, und addiere die Gruppen.', 'Das Alphabet hat 26 Buchstaben, es gibt 10 Ziffern. Bei den Sonderzeichen gilt die Angabe aus der Aufgabe.'] };
    }],
    ['Passwörter', 2, 'Entropie in Bit berechnen', R => {
      const N = pick(R, [26, 36, 52, 62, 94]), L = ri(R, 6, 12), e = C.entropy(N, L);
      return { text: `Ein Passwort besteht aus ${L} zufällig gewählten Zeichen. Pro Stelle stehen ${N} verschiedene Zeichen zur Verfügung. Wie hoch ist die Entropie?`, unit: 'Bit', label: 'Entropie', raw: e.bits, dec: 1, steps: e.steps, meta: { N, L },
        tips: ['Die Entropie in Bit gibt an, wie oft man die Zahl der Möglichkeiten halbieren kann. Du brauchst den Zweierlogarithmus (log₂).', `Eine Stelle bringt log₂(${N}) Bit. Das gilt für jede der ${L} Stellen.`] };
    }],
    ['Passwörter', 2, 'Passphrase aus Wörtern', R => {
      const W = pick(R, [1024, 2048, 4096, 7776]), k = ri(R, 4, 6), e = C.passphrase(W, k);   /* PRUEFEN: 7776 = Würfelliste (Diceware, 6^5 Wörter); Entropie nur bei gleichverteilter, zufälliger Wortwahl */
      return { text: `Eine Passphrase besteht aus ${k} zufällig gewählten Wörtern. Die Wortliste enthält ${W} Wörter, jedes ist gleich wahrscheinlich. Wie hoch ist die Entropie?`, unit: 'Bit', label: 'Entropie', raw: e.bits, dec: 1, steps: e.steps, meta: { W, k },
        tips: ['Behandle jedes Wort wie ein Zeichen aus einem großen Zeichenvorrat. Die Wortliste ist der Zeichenvorrat.', `Ein Wort bringt log₂(${W}) Bit. Das mal ${k} Wörter.`] };
    }],
    ['Passwörter', 2, 'Brute-Force: Dauer bis zum Ende', bruteGen([[26, 8, 1e8], [36, 8, 1e9], [62, 7, 1e9], [26, 9, 1e9], [10, 10, 1e8], [52, 6, 1e8]], false)],
    ['Passwörter', 3, 'Brute-Force: lange Passwörter', bruteGen([[62, 10, 1e10], [26, 12, 1e9], [94, 9, 1e10], [62, 9, 1e9], [36, 10, 1e10]], true)],
    /* ===== Verschlüsselung und Hash ===== */
    ['Verschlüsselung und Hash', 1, 'Caesar: verschlüsseln', R => {
      const w = pick(R, WORDS), k = ri(R, 2, 12), c = C.caesar(w, k);
      return { kind: 'text', text: `Verschlüssele das Wort ${w} mit dem Caesar-Verfahren und dem Schlüssel k = ${k}. Jeder Buchstabe wandert k Stellen im Alphabet nach hinten, nach Z folgt wieder A.`, label: 'Geheimtext', accept: [c], steps: C.caesarSteps(w, k, false), meta: { w, k },
        tips: ['Gehe für jeden Buchstaben einzeln vor: so viele Stellen im Alphabet weiter, wie der Schlüssel angibt.', 'Wenn du über Z hinauskommst, zählst du bei A weiter (A = 1, ... Z = 26).'] };
    }],
    ['Verschlüsselung und Hash', 1, 'Caesar: entschlüsseln', R => {
      const w = pick(R, WORDS), k = ri(R, 2, 12), c = C.caesar(w, k);
      return { kind: 'text', text: `Der Geheimtext ${c} wurde mit dem Caesar-Verfahren und dem Schlüssel k = ${k} verschlüsselt (Verschiebung nach hinten). Wie lautet der Klartext?`, label: 'Klartext', accept: [w], steps: C.caesarSteps(c, k, true), meta: { w, k },
        tips: ['Beim Entschlüsseln läuft die Verschiebung in die Gegenrichtung.', `Schiebe jeden Buchstaben des Geheimtextes um ${k} Stellen im Alphabet zurück (vor A folgt Z).`] };
    }],
    ['Verschlüsselung und Hash', 2, 'Vigenère: verschlüsseln', R => {
      const w = pick(R, ['SERVER', 'ROUTER', 'SWITCH', 'PROXY', 'LOGIN', 'DATEN', 'NETZ']), key = pick(R, ['IT', 'BIT', 'LAN', 'KEY', 'AES']), c = C.vigenere(w, key, 1);
      return { kind: 'text', text: `Verschlüssele das Wort ${w} mit dem Vigenère-Verfahren und dem Schlüsselwort ${key}. Zähle A = 0, B = 1, ... Z = 25. Der Buchstabe des Schlüsselworts gibt die Verschiebung des jeweiligen Klartextbuchstabens an, das Schlüsselwort wird dabei wiederholt.`, label: 'Geheimtext', accept: [c], steps: C.vigenereSteps(w, key, false), meta: { w, key },
        tips: ['Schreibe das Schlüsselwort (wiederholt) unter den Klartext. Jeder Buchstabe bekommt seine eigene Verschiebung.', `Erster Buchstabe: ${w[0]} wird um die Zahl des Buchstabens ${key[0]} verschoben (${key[0]} = ${key.charCodeAt(0) - 65}).`] };
    }],
    ['Verschlüsselung und Hash', 2, 'XOR: 8 Bit verschlüsseln', R => {
      const p = C.toBin(byte(R)), k = C.toBin(byte(R)), r = C.xorBin(p, k);
      return { kind: 'text', text: `Verschlüssele die Bitfolge ${bin4(p)} mit dem Schlüssel ${bin4(k)} per XOR (bitweise). Gib das Ergebnis als 8 Bit an.`, label: 'Geheimtext (8 Bit)', numeric: true, accept: [r], steps: C.xorSteps(p, k).steps, meta: { p, k },
        tips: ['XOR vergleicht Bit für Bit: Sind beide Bits gleich, ist das Ergebnis 0, sonst 1.', 'Rechne von links nach rechts, immer nur zwei übereinanderstehende Bits.'] };
    }],
    ['Verschlüsselung und Hash', 3, 'XOR: Schlüssel bestimmen', R => {
      const p = C.toBin(byte(R)), k = C.toBin(byte(R)), c = C.xorBin(p, k);
      return { kind: 'text', text: `Ein Klartext ${bin4(p)} wurde mit einem 8-Bit-Schlüssel per XOR zum Geheimtext ${bin4(c)} verschlüsselt. Wie lautet der Schlüssel?`, label: 'Schlüssel (8 Bit)', numeric: true, accept: [k], meta: { p, k },
        steps: ['Bei XOR gilt: Klartext ⊕ Schlüssel = Geheimtext. Wendet man den Klartext noch einmal an, kommt der Schlüssel heraus: Klartext ⊕ Geheimtext = Schlüssel.', `  ${bin4(p)}\n⊕ ${bin4(c)}\n= ${bin4(k)}`, 'Probe: Klartext ⊕ Schlüssel ergibt wieder den Geheimtext.'],
        tips: ['XOR lässt sich umkehren: Zweimal dasselbe anwenden, ergibt wieder den Ausgangswert.', 'Verknüpfe Klartext und Geheimtext bitweise mit XOR.'] };
    }],
    ['Verschlüsselung und Hash', 1, 'Symmetrisch oder asymmetrisch', R => {
      const pool = [['Zum Verschlüsseln und Entschlüsseln wird derselbe Schlüssel verwendet.', 0], ['Es gibt einen öffentlichen und einen privaten Schlüssel.', 1], ['AES ist ein Beispiel für dieses Verfahren.', 0], ['RSA ist ein Beispiel für dieses Verfahren.', 1], ['Der sichere Austausch des Schlüssels vorab ist das Hauptproblem.', 0], ['Eine Nachricht wird mit dem öffentlichen Schlüssel des Empfängers verschlüsselt.', 1], ['Das Verfahren ist bei großen Datenmengen deutlich schneller.', 0], ['Eine digitale Signatur wird mit dem privaten Schlüssel des Absenders erzeugt.', 1]];
      const rows = shuffle(R, pool).slice(0, 5).map(x => ({ q: x[0], opts: ['symmetrisch', 'asymmetrisch'], correct: x[1] }));
      return { kind: 'rows', text: 'Ordne jede Aussage dem passenden Verfahren zu.', rows,
        steps: rows.map(r => `${r.q} → ${r.opts[r.correct]}`).concat(['Merkhilfe: symmetrisch = ein gemeinsamer Schlüssel; asymmetrisch = Schlüsselpaar (öffentlich + privat). In der Praxis werden beide kombiniert (hybride Verschlüsselung).']),
        tips: ['Frage dich bei jeder Aussage: Geht es um einen gemeinsamen Schlüssel oder um ein Schlüsselpaar?', 'AES und der gemeinsame geheime Schlüssel gehören zusammen. RSA, „öffentlich“ und „privat“ gehören zusammen.'] };
    }],
    ['Verschlüsselung und Hash', 2, 'Wie viele Schlüssel?', R => {
      const n = pick(R, [5, 6, 8, 10, 12, 15, 20]);
      return { text: `${n} Personen wollen untereinander verschlüsselt kommunizieren. Jedes Paar von Personen benutzt einen eigenen gemeinsamen geheimen Schlüssel (symmetrisches Verfahren). Wie viele verschiedene Schlüssel werden insgesamt benötigt?`, unit: '', label: 'Anzahl Schlüssel', raw: C.symKeys(n), dec: 0, meta: { n },
        steps: [`Jede der ${n} Personen braucht einen Schlüssel zu jeder anderen: ${n} · ${n - 1} = ${n * (n - 1)}`, `Jeder Schlüssel wurde dabei doppelt gezählt (A–B und B–A sind derselbe Schlüssel): ${n * (n - 1)} / 2 = ${C.symKeys(n)}`, `Formel: n · (n − 1) / 2. Zum Vergleich: asymmetrisch brauchte jede Person nur ein Schlüsselpaar, also ${C.asymKeys(n)} Schlüssel.`],
        tips: ['Zähle die Paare: Wie viele Verbindungen gibt es zwischen n Personen? A–B und B–A sind dieselbe Verbindung.', `Rechne n · (n − 1) und teile durch 2 (n = ${n}).`] };
    }],
    ['Verschlüsselung und Hash', 2, 'Hashfunktionen: Aussagen prüfen', R => {
      const T = ['Gleiche Eingabe ergibt immer den gleichen Hashwert.', 'Der Hashwert hat immer die gleiche Länge, egal wie lang die Eingabe ist.', 'Aus dem Hashwert lässt sich die Eingabe praktisch nicht zurückrechnen.', 'Schon die Änderung eines einzigen Zeichens verändert den Hashwert völlig.', 'Mit einem Hashwert lässt sich prüfen, ob eine Datei verändert wurde.', 'Passwörter sollten nur als gesalzener Hash gespeichert werden.'];
      const F = ['Mit dem passenden Schlüssel lässt sich aus dem Hashwert der Klartext wieder herstellen.', 'Ein längerer Text ergibt einen längeren Hashwert.', 'Für Hashfunktionen braucht man ein Schlüsselpaar aus öffentlichem und privatem Schlüssel.', 'Zwei verschiedene Eingaben ergeben mathematisch nie denselben Hashwert.', 'Ein Hash dient dazu, Daten geheim zu halten (Vertraulichkeit).', 'MD5 gilt heute als sicher gegen gezielt erzeugte Kollisionen.'];   /* PRUEFEN: "gesalzen" (Salt) und MD5-Aussage: passt das zum Stoff des 1.-2. Lehrjahrs, oder soll MD5 nicht vorkommen? */
      const t = shuffle(R, T).slice(0, ri(R, 3, 4)), f = shuffle(R, F).slice(0, 6 - t.length), all = shuffle(R, t.map(x => [x, true]).concat(f.map(x => [x, false])));
      return { kind: 'multi', text: 'Welche Aussagen über kryptografische Hashfunktionen (zum Beispiel SHA-256) stimmen? Markiere alle richtigen.', opts: all.map(x => x[0]), correct: all.map((x, i) => x[1] ? i : -1).filter(i => i >= 0),
        steps: all.map(x => (x[1] ? '✓ ' : '✗ ') + x[0]).concat(['Merke: Ein Hash ist eine Einweg-Prüfsumme fester Länge. Er schützt die Integrität, verschlüsselt aber nichts und braucht keinen Schlüssel.']),
        tips: ['Ein Hash ist keine Verschlüsselung: Man kann ihn nicht „entschlüsseln“.', 'Denke an: feste Länge, Einweg, Lawineneffekt (kleine Änderung, ganz anderer Wert), Prüfung von Integrität.'] };
    }],
    /* ===== Phishing und Social Engineering ===== */
    ['Phishing und Social Engineering', 1, 'E-Mail prüfen: Paketdienst', mailTask('paket', ['Prüfe zuerst die Absenderadresse und das Ziel des Links. Der angezeigte Name ist nur Text.', 'Achte auch auf Druck (Frist, Drohung) und auf eine unpersönliche Anrede.'])],
    ['Phishing und Social Engineering', 2, 'E-Mail prüfen: IT-Abteilung', mailTask('it', ['Lies Adressen von rechts nach links: Der Teil direkt vor der Endung gehört dem Betreiber.', 'Nicht jedes Merkmal ist ein Beweis: Manche Punkte kommen auch in echten Mails vor. Wäge ab.'])],
    ['Phishing und Social Engineering', 3, 'E-Mail prüfen: Anfrage der Geschäftsleitung', mailTask('chef', ['Überlege, ob die Bitte zum normalen Ablauf im Betrieb passen würde (Bestellung, Freigabe, Rechnung).', 'Was verhindert hier, dass du nachprüfen kannst? Und was steht in der Adresse, was nur im Anzeigenamen?'])],
    ['Phishing und Social Engineering', 2, 'Welcher Link führt wirklich zum Portal?', R => {
      const nm = pick(R, ['firma-beispiel', 'kabelwerk-nord', 'holzbau-lorenz']), real = `portal.${nm}.de`, typo = nm.replace(/[lo]/, m => m === 'l' ? '1' : '0');
      const right = `https://${real}/login`, wrongs = [`https://${real}.anmeldung-sicher.net/login`, `https://portal.${typo}.de/login`, `https://portal-${nm}.de/login`, `https://${real}@anmeldung-sicher.net/login`];
      const m = mk(R, right, shuffle(R, wrongs).slice(0, 3));
      return { kind: 'choice', text: `Die echte Adresse des Firmenportals lautet ${real}. Du bekommst vier Links in Mails. Welcher führt wirklich zu diesem Portal?`, opts: m.opts, correct: m.correct,
        steps: ['Maßgeblich ist die Domain: der Name direkt vor der Endung (.de, .net), gelesen bis zum ersten einzelnen „/“. Steht ein „@“ in der Adresse, zählt nur der Teil dahinter.', `✓ ${right}: Domain ${nm}.de, davor nur die Unterdomain „portal“.`, `✗ ${wrongs[0]}: Domain ist anmeldung-sicher.net. Der echte Name steht nur davor.`, `✗ ${wrongs[1]}: ein Zeichen vertauscht (Ähnlichkeit „${nm}“ / „${typo}“).`, `✗ ${wrongs[2]}: andere Domain (Bindestrich statt Punkt).`, `✗ ${wrongs[3]}: Alles vor dem „@“ ist nur Benutzername, die Domain ist anmeldung-sicher.net.`],   /* PRUEFEN: Erklärung zur @-Schreibweise in URLs (Benutzerinfo vor dem @) ist für das 1.-2. Lehrjahr evtl. zu viel. Beibehalten oder Variante streichen? */
        tips: ['Lies die Adresse von rechts nach links bis zum ersten einzelnen Schrägstrich. Der Teil direkt vor der Endung (.de, .net) ist die Domain.', 'Achte auf vertauschte Zeichen, Bindestriche statt Punkte und ein „@“ in der Adresse.'] };
    }],
    ['Phishing und Social Engineering', 1, 'Richtig reagieren', R => {
      const pool = [
        { q: 'Jemand ruft an: „Hier ist der IT-Support. Bei dir gibt es ein Problem, ich brauche kurz dein Passwort, um es zu beheben.“ Was tust du?', right: 'Das Passwort nicht nennen, Namen und Ticketnummer notieren, über die bekannte interne Nummer zurückrufen und die IT informieren.', wrongs: ['Das Passwort nennen, weil der IT-Support dafür zuständig ist.', 'Das Passwort nennen, aber nur wenn der Anrufer freundlich und sicher klingt.', 'Das Passwort per E-Mail schicken, damit es schriftlich dokumentiert ist.'], why: 'Echte IT-Mitarbeiter fragen nie nach deinem Passwort. Rückruf über eine bekannte Nummer prüft die Identität.' },
        { q: 'Eine fremde Person mit Kisten in den Händen steht vor der Tür zum Büro: „Mein Ausweis ist im Auto, hältst du kurz die Tür auf?“ Was tust du?', right: 'Freundlich zum Empfang begleiten, damit dort ein Besucherausweis ausgestellt wird.', wrongs: ['Tür aufhalten, ein Nein wäre unhöflich.', 'Tür aufhalten, aber nur wenn die Person nett wirkt.', 'Die Person allein durchlassen und im Büro nicht weiter beachten.'], why: 'Zutritt hinter einer fremden Person (Hinterherlaufen) umgeht die Zutrittskontrolle. Höflich auf den Empfang verweisen.' },
        { q: 'Auf dem Firmenparkplatz liegt ein USB-Stick mit der Aufschrift „Gehälter 2025“. Was tust du?', right: 'Nicht anstecken, bei der IT oder dem Sicherheitsbeauftragten abgeben.', wrongs: ['Anstecken, um den Besitzer anhand der Dateien zu finden.', 'Nur am privaten Laptop anstecken, damit der Firmenrechner sicher bleibt.', 'Mit nach Hause nehmen und dort in Ruhe ansehen.'], why: 'Unbekannte Datenträger können Schadsoftware enthalten, die sich beim Anstecken ausführt. Neugier gezielt ausnutzen ist eine bekannte Masche.' }
      ], x = pick(R, pool), m = mk(R, x.right, x.wrongs);
      return { kind: 'choice', text: x.q, opts: m.opts, correct: m.correct, steps: ['Richtig: ' + x.right, x.why], tips: ['Bei solchen Situationen wird Hilfsbereitschaft, Neugier oder Respekt vor Autorität ausgenutzt. Wie kannst du die Person oder Sache sicher prüfen, ohne etwas zu riskieren?', 'Gib nichts heraus und lass nichts zu, was du nicht prüfen kannst. Verweise auf den offiziellen Weg und melde den Vorfall.'] };
    }],
    /* ===== Rechte und Firewall ===== */
    ['Rechte und Firewall', 1, 'Dateirechte in Oktalschreibweise', R => {
      const p = pick(R, ['rwxr-xr-x', 'rw-r--r--', 'rwxr-x---', 'rw-r-----', 'rwx------', 'rw-rw-r--', 'r--r-----', 'rwxrwxr-x']), o = C.permToOctal(p);
      return { text: `Eine Datei unter Linux hat die Rechte ${p} (Besitzer, Gruppe, Andere). Wie lautet die Oktalschreibweise (dreistellig, wie bei chmod)?`, unit: '', label: 'Oktalzahl', raw: o.value, dec: 0, meta: { p }, steps: o.steps,
        tips: ['Jede Gruppe aus drei Zeichen ergibt eine Ziffer. Jedes Recht hat einen Wert: lesen, schreiben, ausführen.', 'r = 4, w = 2, x = 1, ein Strich = 0. Addiere je Gruppe.'] };
    }],
    ['Rechte und Firewall', 2, 'Minimale Rechte vergeben', R => {
      const O = ['Nur lesen', 'Lesen und schreiben', 'Vollzugriff (auch Rechte vergeben)'];
      const pool = [['Die Buchhaltung soll die Preisliste nur ansehen.', 0], ['Der Vertrieb pflegt die Preisliste und ändert Preise.', 1], ['Der Teamleiter vergibt Zugriffe auf den Projektordner an neue Kollegen.', 2], ['Eine Praktikantin soll die Bedienungsanleitungen im Ordner lesen.', 0], ['Die Entwickler legen im Ordner Quellcode ab und ändern ihn.', 1], ['Das Konto der Backup-Software soll alle Dateien des Servers sichern.', 0] /* PRUEFEN: Backup-Konten brauchen meist nur Lesezugriff auf die Quelldaten (plus ein Backup-Operator-Recht im System). Ist "Nur lesen" hier die erwartete Antwort? */];
      const rows = shuffle(R, pool).slice(0, 4).map(x => ({ q: x[0], opts: O, correct: x[1] }));
      return { kind: 'rows', text: 'Wähle für jede Person oder Aufgabe das kleinste Recht, mit dem sie ihre Aufgabe noch erledigen kann.', rows,
        steps: rows.map(r => `${r.q} → ${O[r.correct]}`).concat(['Prinzip der minimalen Rechte (Need-to-know): Nur so viel Zugriff wie für die Aufgabe nötig, nicht mehr.']),
        tips: ['Frage dich: Was muss die Person mit den Dateien tun: nur ansehen, ändern oder auch anderen Zugriff geben?', 'Vollzugriff braucht nur, wer Rechte an andere vergibt. Wer nur etwas ansieht, braucht nur Lesen.'] };
    }],
    ['Rechte und Firewall', 2, 'Rechte-Matrix lesen', R => {
      const cell = () => pick(R, ['–', 'L', 'L+S']), ft = ['Projekte', 'Lohn', 'Archiv', 'Vorlagen']; let M, ask, cnt, tries = 0;
      do {
        M = names.map(() => ft.map(cell)); const byFolder = R() < 0.5;
        if (byFolder) { const f = ri(R, 0, 3); cnt = M.filter(r => r[f] === 'L+S').length; ask = { t: `Wie viele der vier Personen dürfen im Ordner „${ft[f]}“ Dateien ändern?`, unit: 'Personen', st: names.map((n, i) => `${n}: ${M[i][f]}`).join(';  ') }; }
        else { const u = ri(R, 0, 3); cnt = M[u].filter(c => c === 'L+S').length; ask = { t: `Auf wie viele Ordner darf ${names[u]} Dateien ändern?`, unit: 'Ordner', st: ft.map((f, j) => `${f}: ${M[u][j]}`).join(';  ') }; }
      } while ((cnt < 1 || cnt > 3) && ++tries < 30);
      return { text: `Die Tabelle zeigt die Rechte (L = lesen, S = schreiben, – = kein Zugriff). ${ask.t}`, unit: ask.unit, label: 'Anzahl', raw: cnt, dec: 0, meta: { M },
        show: [{ type: 'table', title: 'Rechte-Matrix', head: [''].concat(ft), rows: names.map((n, i) => [n].concat(M[i])) }],
        steps: ['Nur Felder mit „L+S“ erlauben das Ändern (Schreiben).', ask.st, `Anzahl: ${cnt}`],
        tips: ['Zähle nur die Felder, in denen ein Schreibrecht steht. Ein reines „L“ erlaubt nur das Ansehen.', 'Gehe die Zeile oder Spalte, nach der gefragt ist, Feld für Feld durch.'] };
    }],
    ['Rechte und Firewall', 2, 'Firewall-Regeln anwenden', R => {
      let idx, tries = 0, res; do { idx = shuffle(R, FW1_PKTS.map((_, i) => i)).slice(0, 4); res = idx.map(i => C.fwEval(FW1, FW1_PKTS[i]).action); } while ((res.indexOf('allow') < 0 || res.indexOf('deny') < 0) && ++tries < 30);
      const pk = idx.map(i => FW1_PKTS[i]), rows = pk.map(p => ({ q: 'Paket: ' + C.pktText(p), opts: ['Erlauben', 'Blocken'], correct: C.fwEval(FW1, p).action === 'allow' ? 0 : 1 }));
      return { kind: 'rows', text: 'Die Firewall prüft Pakete von oben nach unten anhand der Regeltabelle. Was passiert mit jedem Paket?', show: [fwTable(FW1)], rows,
        steps: pk.map((p, i) => C.fwStep(FW1, p, i)).concat(['Regel: Die erste passende Regel entscheidet. Was keine Regel trifft, wird geblockt.']),
        tips: ['Gehe die Regeln von oben nach unten durch und höre bei der ersten auf, die zum Paket passt (Protokoll, Quelle, Ziel und Zielport müssen alle passen).', 'Eine Regel weiter oben kann eine spätere überstimmen. Achte darum auf die Reihenfolge, nicht nur auf die „erlauben“-Regeln.'] };
    }],
    ['Rechte und Firewall', 3, 'Firewall: Pakete zählen', R => {
      const srcs = ['10.1.5.7', '10.3.0.9', '172.16.0.4', '203.0.113.5'], dsts = ['10.2.0.10', '10.2.0.20'], ports = [3306, 443, 22, 80]; let pk, blocked, tries = 0;
      do { pk = []; for (let i = 0; i < 6; i++) pk.push({ proto: 'tcp', src: pick(R, srcs), dst: pick(R, dsts), port: pick(R, ports) }); blocked = pk.filter(p => C.fwEval(FW2, p).action === 'deny').length; } while ((blocked < 2 || blocked > 4) && ++tries < 50);
      return { text: 'Die Firewall prüft Pakete von oben nach unten. Wie viele der sechs Pakete werden geblockt?', unit: 'Pakete', label: 'Anzahl geblockt', raw: blocked, dec: 0, meta: { pk },
        show: [fwTable(FW2), { type: 'table', title: 'Pakete', head: ['Nr.', 'Protokoll', 'Quelle', 'Ziel', 'Zielport'], rows: pk.map((p, i) => [String(i + 1), 'TCP', p.src, p.dst, String(p.port)]) }],
        steps: pk.map((p, i) => C.fwStep(FW2, p, i)).concat([`Geblockt: ${blocked} von 6`]),
        tips: ['Prüfe jedes Paket einzeln von der ersten Regel an. Die erste passende Regel entscheidet, danach wird nicht weitergesucht.', 'Notiere neben jedem Paket „erlaubt“ oder „geblockt“ und zähle erst am Ende die geblockten.'] };
    }],
    /* ===== Backup ===== */
    ['Backup', 1, 'Backup-Strategie bewerten', R => {
      const good = [{ t: 'Original auf dem Server, Kopie 1 auf einem NAS im Serverraum, Kopie 2 auf Bandkassetten im Bankschließfach.', copies: 3, media: 2, offsite: 1 }, { t: 'Original auf den Festplatten des Servers, Kopie 1 auf Band im Büro-Tresor, Kopie 2 bei einem Cloud-Anbieter.', copies: 3, media: 3, offsite: 1 }];
      const bad = [{ t: 'Original auf dem Server, eine Kopie auf einer zweiten Festplatte im selben Server.', copies: 2, media: 1, offsite: 0 }, { t: 'Original und zwei Kopien auf drei Festplatten im Serverraum.', copies: 3, media: 1, offsite: 0 }, { t: 'Original auf dem Server, Kopie 1 auf einem NAS und Kopie 2 auf Band, beides im selben Serverraum.', copies: 3, media: 2, offsite: 0 }, { t: 'Original auf dem Server und eine Kopie in der Cloud.', copies: 2, media: 2, offsite: 1 }, { t: 'Original auf dem Server, zwei Kopien auf zwei NAS-Geräten in einem anderen Gebäude.', copies: 3, media: 1, offsite: 1 }];
      const g = pick(R, good), w = shuffle(R, bad).slice(0, 3), all = shuffle(R, [g].concat(w)), why = o => `${o.copies} Kopien (${o.copies >= 3 ? 'ok' : 'zu wenig'}), ${o.media} Medium${o.media === 1 ? '' : 'en'} (${o.media >= 2 ? 'ok' : 'zu wenig'}), ${o.offsite} an anderem Ort (${o.offsite >= 1 ? 'ok' : 'fehlt'})`;
      return { kind: 'choice', text: 'Für die Datensicherung eines Servers gibt es vier Vorschläge. Welcher erfüllt die 3-2-1-Regel?', opts: all.map(o => o.t), correct: all.findIndex(o => C.check321(o)),
        steps: ['3-2-1: mindestens 3 Kopien der Daten (Original mitgezählt), auf 2 verschiedenen Medien, 1 Kopie an einem anderen Ort.'].concat(all.map(o => (C.check321(o) ? '✓ ' : '✗ ') + why(o) + ': ' + o.t)),
        tips: ['Prüfe jeden Vorschlag auf drei Dinge: Wie viele Kopien, wie viele verschiedene Medienarten, ist eine Kopie außer Haus?', 'Zähle das Original als eine der drei Kopien. Festplatte und NAS sind beide „Festplatten-Medien“, Band und Cloud sind eigene Medienarten.'] };
    }],
    ['Backup', 2, 'RPO: Datenverlust', R => {
      if (R() < 0.5) {
        const a = ri(R, 1, 5), f = a + ri(R, 6, 15);
        return { text: `Die tägliche Sicherung läuft um ${String(a).padStart(2, '0')}:00 Uhr. Um ${String(f).padStart(2, '0')}:00 Uhr am selben Tag fällt der Server aus und wird aus der letzten Sicherung wiederhergestellt. Wie viele Stunden an Datenänderungen gehen verloren?`, unit: 'h', label: 'Verlorene Zeit', raw: C.lossHours(a, f), dec: 0, meta: { a, f },
          steps: [`Verloren sind alle Änderungen seit der letzten Sicherung: ${f}:00 − ${a}:00 = ${f - a} Stunden.`, 'Der größtmögliche Datenverlust ergibt den erreichbaren RPO (Recovery Point Objective): Er entspricht dem Zeitraum zwischen zwei Sicherungen.'],
          tips: ['Alles, was nach der letzten Sicherung geändert wurde, ist weg.', 'Rechne die Zeit zwischen Sicherung und Ausfall.'] };
      }
      const h = pick(R, [1, 2, 3, 4, 6, 8, 12]);
      return { text: `Ein Unternehmen darf nach einem Ausfall höchstens ${h} Stunden Datenänderungen verlieren (RPO = ${h} h). Die Sicherung soll gleichmäßig über den Tag verteilt laufen. Wie oft muss mindestens in 24 Stunden gesichert werden?`, unit: 'mal', label: 'Sicherungen pro Tag', raw: 24 / h, dec: 0, meta: { h },
        steps: [`Zwischen zwei Sicherungen dürfen höchstens ${h} Stunden liegen.`, `24 h : ${h} h = ${24 / h} Sicherungen pro Tag.`],
        tips: ['Der RPO sagt, wie groß der Abstand zwischen zwei Sicherungen höchstens sein darf.', 'Teile die 24 Stunden eines Tages durch den erlaubten Abstand.'] };
    }],
    ['Backup', 2, 'RTO: Wiederherstellungszeit', R => {
      const [D, v] = pick(R, [[300, 100], [600, 200], [900, 250], [1200, 150], [1800, 250], [450, 150]]), m = C.restoreMinutes(D, v);
      return { text: `Ein Server mit ${fmt(D)} GB Daten wird aus der Sicherung zurückgespielt. Das Sicherungslaufwerk liefert ${v} MB/s (1 GB = 1000 MB). Wie viele Minuten dauert das reine Zurückspielen?`, unit: 'min', label: 'Dauer', raw: m, dec: 1, meta: { D, v },
        steps: [`${fmt(D)} GB = ${fmt(D * 1000)} MB`, `Zeit = Datenmenge / Rate = ${fmt(D * 1000)} MB : ${v} MB/s = ${fmt(rd(D * 1000 / v, 2))} s`, `${fmt(rd(D * 1000 / v, 2))} s : 60 = ${fmt(rd(m, 1))} min`, 'Diese Dauer geht in die Wiederanlaufzeit (RTO, Recovery Time Objective) ein, dazu kommen Fehlersuche und Neuaufbau.'],
        tips: ['Rechne zuerst die Datenmenge in MB um, damit die Einheiten zur Rate passen.', 'Datenmenge geteilt durch Rate ergibt Sekunden. Für Minuten noch durch 60.'] };
    }],
    ['Backup', 3, 'Speicherbedarf: inkrementell oder differentiell', R => {
      const F = pick(R, [100, 200, 500, 1000]), c = pick(R, [5, 10, 20, 8]), type = R() < 0.5 ? 'inc' : 'diff', tn = type === 'inc' ? 'inkrementell' : 'differentiell', pl = C.backupPlan(type, F, [c, c, c, c]);
      return { text: `Am Montag gibt es eine Vollsicherung mit ${F} GB. Von Dienstag bis Freitag ändern sich täglich ${c} GB an neuen, bisher unveränderten Daten. Von Dienstag bis Freitag wird jeden Abend ${tn} gesichert. Wie viel Speicherplatz belegen alle fünf Sicherungen zusammen?`, unit: 'GB', label: 'Gesamtgröße', raw: pl.total, dec: 0, meta: { F, c, type }, steps: pl.steps.concat(type === 'inc' ? ['Inkrementell: jede Sicherung enthält nur die Änderungen seit der letzten Sicherung.'] : ['Differentiell: jede Sicherung enthält alle Änderungen seit der Vollsicherung und wächst deshalb täglich.']),
        tips: [type === 'inc' ? 'Bei dieser Art enthält jede Sicherung nur das, was seit der vorherigen Sicherung neu ist.' : 'Bei dieser Art enthält jede Sicherung alles, was seit der letzten Vollsicherung neu ist.', 'Bestimme die Größe jeder der fünf Sicherungen einzeln und addiere sie.'] };
    }],
    ['Backup', 3, 'Wiederherstellung: wie viele Sicherungen?', R => {
      const type = R() < 0.5 ? 'inc' : 'diff', tn = type === 'inc' ? 'inkrementell' : 'differentiell', d = ri(R, 2, 6), day = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][d], n = C.restoreSets(type, d);
      return { text: `Am Sonntagabend gibt es eine Vollsicherung. Danach wird jeden Abend von Montag bis Samstag ${tn} gesichert. Die letzte erfolgreiche Sicherung vor einem Ausfall war die vom ${day}abend. Wie viele Sicherungen (die Vollsicherung eingerechnet) braucht man mindestens, um den letzten Stand wiederherzustellen?`, unit: 'Sicherungen', label: 'Anzahl', raw: n, dec: 0, meta: { type, d },
        steps: type === 'inc' ? [`Inkrementell: Man braucht die Vollsicherung und jede Sicherung seit der Vollsicherung bis zum ${day}.`, `Vollsicherung + ${d} Tage = ${d + 1} Sicherungen`] : ['Differentiell: Man braucht die Vollsicherung und nur die letzte differentielle Sicherung (sie enthält alle Änderungen seit der Vollsicherung).', 'Vollsicherung + letzte Differenz = 2 Sicherungen'],   /* PRUEFEN: "Sicherungen" = Sicherungssätze/Bänder; Wiederherstellung bis zum Stand des letzten Backups. Stimmt die Zählweise (Vollsicherung eingerechnet)? */
        tips: [type === 'inc' ? 'Jede inkrementelle Sicherung baut auf der vorherigen auf. Fehlt eine, ist die Kette unterbrochen.' : 'Jede differentielle Sicherung enthält schon alles seit der Vollsicherung. Welche davon brauchst du dann noch?', 'Zähle die Vollsicherung immer mit.'] };
    }],
    /* ===== Verfügbarkeit ===== */
    ['Verfügbarkeit', 1, 'Ausfallzeit pro Jahr', R => {
      const pct = pick(R, [99, 99.5, 99.9, 99.95, 99.99]), mins = pct === 99.99, h = C.downHours(pct), raw = mins ? h * 60 : h, unit = mins ? 'Minuten' : 'Stunden';
      return { text: `Ein Dienst hat laut Vertrag eine Verfügbarkeit von ${fmt(pct)} % pro Jahr (365 Tage zu je 24 Stunden). Wie lange darf er pro Jahr höchstens ausfallen? Angabe in ${unit}.`, unit: mins ? 'min' : 'h', label: 'Ausfallzeit', raw, dec: 2, meta: { pct },
        steps: [`Ein Jahr hat 365 · 24 = ${C.HOURS_YEAR} Stunden.`, `Ausfallanteil = 100 % − ${fmt(pct)} % = ${fmt(rs(100 - pct))} %`, `Ausfallzeit = ${C.HOURS_YEAR} h · ${fmt(rs(100 - pct))} / 100 = ${fmt(rd(h, 2), 2)} h` + (mins ? `  = ${fmt(rd(raw, 2), 2)} min` : '')],
        tips: ['Zuerst: Wie viele Stunden hat ein Jahr (365 Tage)? Dann: Welcher Anteil davon darf ausfallen?', `Der erlaubte Ausfallanteil ist 100 % − ${fmt(pct)} %. Davon den Anteil der Jahresstunden berechnen.`] };
    }],
    ['Verfügbarkeit', 2, 'Verfügbarkeit aus Ausfallzeit', R => {
      const d = pick(R, [9, 18, 24, 48, 72]), a = C.availFromDown(d);
      return { text: `Ein Server stand in einem Jahr (8760 Stunden) insgesamt ${d} Stunden nicht zur Verfügung. Wie hoch war seine Verfügbarkeit in Prozent?`, unit: '%', label: 'Verfügbarkeit', raw: a, dec: 2, meta: { d },
        steps: [`Laufzeit = 8760 h − ${d} h = ${8760 - d} h`, `Verfügbarkeit = Laufzeit / Gesamtzeit = ${8760 - d} / 8760 = ${fmt(rd(a / 100, 6), 6)}`, `In Prozent: ${fmt(rd(a, 2), 2)} %`],
        tips: ['Verfügbarkeit = Zeit, in der der Server läuft, geteilt durch die Gesamtzeit.', 'Laufzeit = Gesamtzeit minus Ausfallzeit. Das Ergebnis mal 100 ergibt Prozent.'] };
    }],
    ['Verfügbarkeit', 3, 'Gesamtverfügbarkeit mehrerer Komponenten', R => {
      const a = pick(R, [90, 95, 98, 99, 99.5]), b = pick(R, [95, 98, 99, 99.5, 99.9]);
      if (R() < 0.5) {
        return { text: `Ein Dienst läuft nur, wenn der Server (Verfügbarkeit ${fmt(a)} %) und die Internetanbindung (Verfügbarkeit ${fmt(b)} %) gleichzeitig laufen. Beide fallen unabhängig voneinander aus. Wie hoch ist die Verfügbarkeit des Gesamtdienstes?`, unit: '%', label: 'Gesamtverfügbarkeit', raw: C.serial([a, b]), dec: 2, meta: { a, b },
          steps: [`Beide müssen laufen: Die Wahrscheinlichkeiten werden multipliziert.`, `${fmt(a)} % = ${fmt(a / 100, 4)} und ${fmt(b)} % = ${fmt(b / 100, 4)}`, `${fmt(a / 100, 4)} · ${fmt(b / 100, 4)} = ${fmt(rd(C.serial([a, b]) / 100, 6), 6)} = ${fmt(rd(C.serial([a, b]), 2), 2)} %`],
          tips: ['Der Dienst fällt aus, sobald eine der beiden Komponenten ausfällt. Die Gesamtverfügbarkeit ist deshalb kleiner als jeder Einzelwert.', 'Rechne die Prozentwerte in Anteile um (durch 100) und multipliziere sie.'] };
      }
      return { text: `Ein Dienst läuft auf zwei voneinander unabhängigen, redundanten Servern mit den Verfügbarkeiten ${fmt(a)} % und ${fmt(b)} %. Der Dienst ist erreichbar, solange mindestens ein Server läuft. Wie hoch ist die Verfügbarkeit des Gesamtdienstes?`, unit: '%', label: 'Gesamtverfügbarkeit', raw: C.parallel([a, b]), dec: 2, meta: { a, b },
        steps: ['Der Dienst fällt nur aus, wenn beide Server gleichzeitig ausfallen.', `Ausfallanteile: ${fmt(rs(100 - a))} % = ${fmt(rs(1 - a / 100), 4)} und ${fmt(rs(100 - b))} % = ${fmt(rs(1 - b / 100), 4)}`, `Beide ausgefallen: ${fmt(rs(1 - a / 100), 4)} · ${fmt(rs(1 - b / 100), 4)} = ${fmt(rd((1 - a / 100) * (1 - b / 100), 8), 8)}`, `Verfügbarkeit = 1 − ${fmt(rd((1 - a / 100) * (1 - b / 100), 8), 8)} = ${fmt(rd(C.parallel([a, b]) / 100, 8), 8)} = ${fmt(rd(C.parallel([a, b]), 2), 2)} %`],
        tips: ['Hier hilft die Frage: Wann fällt der Dienst aus? Nur wenn beide Server zugleich ausfallen.', 'Berechne die Ausfallanteile (1 − Verfügbarkeit), multipliziere sie und ziehe das Ergebnis von 1 ab.'] };
    }],
    /* ===== Schutzziele und Recht ===== */
    ['Schutzziele und Recht', 1, 'Schutzziele zuordnen', R => {
      const O = ['Vertraulichkeit', 'Integrität', 'Verfügbarkeit'];
      const pool = [['Ein Mitarbeiter liest ohne Berechtigung die Gehaltslisten.', 0], ['Jemand ändert unbemerkt Beträge in einer Überweisung.', 1], ['Der Webshop ist wegen eines Angriffs mit Überlast nicht erreichbar.', 2], ['Ein unverschlüsselter Laptop mit Kundendaten wird im Zug vergessen.', 0], ['Eine Datei wird durch einen Festplattenfehler beschädigt, ohne dass es auffällt.', 1], ['Ein Wasserschaden zerstört den Serverraum, alle Dienste stehen still.', 2]];
      const rows = shuffle(R, pool).slice(0, 5).map(x => ({ q: x[0], opts: O, correct: x[1] }));
      return { kind: 'rows', text: 'Welches Schutzziel ist in jedem Fall hauptsächlich verletzt?', rows,
        steps: rows.map(r => `${r.q} → ${O[r.correct]}`).concat(['Vertraulichkeit: nur Berechtigte sehen die Daten. Integrität: Daten bleiben unverändert und korrekt. Verfügbarkeit: Daten und Dienste sind bei Bedarf nutzbar.']),
        tips: ['Frage: Wurde etwas gelesen (Vertraulichkeit), verändert oder beschädigt (Integrität) oder war es nicht nutzbar (Verfügbarkeit)?', 'Bei Gehaltslisten, die Fremde sehen, denke an Vertraulichkeit. Bei Datenfehlern an Integrität. Bei Ausfall an Verfügbarkeit.'] };
    }],
    ['Schutzziele und Recht', 2, 'Meldepflicht bei Datenpannen', R => {
      const days = R() < 0.5, sc = pick(R, ['Durch einen Konfigurationsfehler waren Kundendaten (Name, Adresse) mehrere Stunden frei im Internet abrufbar.', 'Ein Laptop mit unverschlüsselten Personaldaten wurde gestohlen.', 'Ein Mitarbeiter hat versehentlich eine Kundenliste an einen falschen externen Empfänger gesendet.']);
      return { text: `${sc} Nach der DSGVO ist die Panne der Aufsichtsbehörde zu melden, wenn sie voraussichtlich zu einem Risiko für die Betroffenen führt. Innerhalb welcher Frist ab Bekanntwerden soll die Meldung spätestens erfolgen? Angabe in ${days ? 'Tagen' : 'Stunden'}.`, unit: days ? 'Tage' : 'Stunden', label: 'Frist', raw: days ? 3 : 72, dec: 0, meta: { days },
        steps: ['Art. 33 DSGVO: Eine Verletzung des Schutzes personenbezogener Daten ist unverzüglich und möglichst binnen 72 Stunden nach Bekanntwerden an die Aufsichtsbehörde zu melden, außer ein Risiko für die Betroffenen ist unwahrscheinlich.', days ? '72 Stunden : 24 = 3 Tage' : '72 Stunden = 3 Tage'],   /* PRUEFEN: Art. 33 DSGVO: 72 Stunden ab Kenntnis; Ausnahme "Risiko unwahrscheinlich". Reicht diese Vereinfachung, oder soll auch die Benachrichtigung der Betroffenen (Art. 34, hohes Risiko) vorkommen? */
        tips: ['Die DSGVO nennt eine feste Frist, die ab dem Moment läuft, in dem das Unternehmen von der Panne erfährt.', 'Die DSGVO nennt die Frist in Stunden. Das sind nur einige wenige Tage, keine Woche.'] };
    }],
    ['Schutzziele und Recht', 2, 'DSGVO und BSI: Grundbegriffe', R => {
      const pool = [
        { q: 'Welche Angabe ist nach der DSGVO ein personenbezogenes Datum?', right: 'Die private E-Mail-Adresse max.mueller@example.org', wrongs: ['Die Gesamtzahl der Besucher einer Webseite im Monat', 'Der Umsatz des Unternehmens im letzten Quartal', 'Die Typenbezeichnung eines Druckers'], why: 'Personenbezogen sind alle Angaben, die sich auf eine identifizierte oder identifizierbare Person beziehen (Name, E-Mail, Kennzeichen, ...). Zahlen ohne Personenbezug sind es nicht.' },
        { q: 'Was bedeutet der Grundsatz der Datenminimierung?', right: 'Es werden nur die Daten erhoben, die für den Zweck erforderlich sind.', wrongs: ['Alle Daten werden komprimiert gespeichert, um Platz zu sparen.', 'Daten werden nach der Erhebung sofort gelöscht.', 'Es wird nur eine Kopie der Daten angelegt.'], why: 'Datenminimierung (Art. 5 DSGVO): angemessen, erheblich und auf das notwendige Maß beschränkt.' },
        { q: 'Wer ist nach der DSGVO die „betroffene Person“?', right: 'Die Person, auf die sich die personenbezogenen Daten beziehen.', wrongs: ['Der Mitarbeiter, der die Daten verarbeitet.', 'Der Datenschutzbeauftragte des Unternehmens.', 'Die Aufsichtsbehörde, die den Vorfall prüft.'], why: 'Betroffene Person = Mensch, dessen Daten verarbeitet werden (Kunde, Mitarbeiter, Besucher).' },
        { q: 'Welches Beispiel ist eine organisatorische (nicht rein technische) Schutzmaßnahme?', right: 'Eine Dienstanweisung zur Passwortnutzung mit Schulung der Mitarbeiter.', wrongs: ['Die Verschlüsselung der Festplatte im Laptop.', 'Der Einbau einer Firewall am Netzübergang.', 'Eine Zutrittssperre per Chipkarte am Serverraum.'], why: 'Technische und organisatorische Maßnahmen (TOM) ergänzen sich. Regeln, Schulungen und Verantwortlichkeiten sind organisatorisch, Verschlüsselung und Firewall sind technisch.' },
        { q: 'In welche Schutzbedarfskategorien teilt der BSI IT-Grundschutz Schutzziele üblicherweise ein?', right: 'normal, hoch, sehr hoch', wrongs: ['niedrig, mittel, kritisch', 'öffentlich, intern, geheim', 'gering, erhöht, maximal'], why: 'Das BSI unterscheidet beim Schutzbedarf die Kategorien „normal“, „hoch“ und „sehr hoch“.' },   /* PRUEFEN: BSI-Standard 200-2: Schutzbedarfskategorien normal, hoch, sehr hoch. Stimmt die Benennung zum Unterrichtsstoff? */
        { q: 'Wofür steht der BSI IT-Grundschutz in der Praxis?', right: 'Ein Vorgehen mit Bausteinen und Maßnahmenkatalogen, mit dem ein Unternehmen seine Informationssicherheit systematisch aufbaut.', wrongs: ['Ein Programm, das Viren automatisch löscht.', 'Ein Gesetz, das Verschlüsselung verbietet.', 'Eine Versicherung gegen Datenverlust.'], why: 'Der IT-Grundschutz des BSI (Bundesamt für Sicherheit in der Informationstechnik) liefert Standards und Bausteine (Kompendium) für ein Sicherheitskonzept.' }
      ], x = pick(R, pool), m = mk(R, x.right, x.wrongs);
      return { kind: 'choice', text: x.q, opts: m.opts, correct: m.correct, steps: ['Richtig: ' + x.right, x.why], tips: ['Lies jede Antwort und streiche, was offensichtlich nicht zum Begriff passt.', 'Denke an den Sinn des Begriffs: Es geht um den Schutz von Menschen und ihren Daten beziehungsweise um ein systematisches Vorgehen.'] };
    }]
  ];
  const tasks = defs.map((d, i) => ({ id: 'its' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3] }));

  /* Fertige Aufgabe aus Aufgabe + Seed (gleicher Seed = gleiche Zahlen und Fälle) */
  function build(t, seed) {
    const R = C.rng(t.id + ':' + (seed == null ? 0 : seed)), g = t.gen(R), kind = g.kind || 'num';
    const base = { id: t.id, seed, cat: t.cat, level: t.level, title: t.title, kind, show: g.show || null, tips: g.tips, meta: g.meta };
    if (kind === 'num') {
      const dec = g.dec, value = rd(g.raw, dec), exact = value === rs(g.raw), tol = exact ? Math.max(1e-6, Math.abs(value) * 1e-6) : Math.pow(10, -dec), sol = fmt(value, Math.max(dec, 0)) + (g.unit ? ' ' + g.unit : '');
      return Object.assign(base, { text: g.text + (exact ? '' : ' Runde auf ' + dig(dec) + '.'), unit: g.unit, label: g.label || 'Dein Ergebnis', value, tol, dec, exact, raw: g.raw, sol, steps: g.steps.concat(['Ergebnis: ' + sol]) });
    }
    if (kind === 'text') return Object.assign(base, { text: g.text, label: g.label || 'Deine Antwort', accept: g.accept, numeric: !!g.numeric, sol: g.accept[0], steps: g.steps.concat(['Ergebnis: ' + g.accept[0]]) });
    if (kind === 'choice') return Object.assign(base, { text: g.text, opts: g.opts, correct: g.correct, sol: g.opts[g.correct], steps: g.steps });
    if (kind === 'multi') return Object.assign(base, { text: g.text, opts: g.opts, correct: g.correct, sol: g.correct.map(i => g.opts[i]).join(' | '), steps: g.steps });
    return Object.assign(base, { text: g.text, rows: g.rows, sol: g.rows.map(r => r.opts[r.correct]).join(', '), steps: g.steps });   /* rows */
  }

  /* ---------- Beispiele (Reiter "Beispiele", Aufruf ?bsp): Schritt für Schritt durchgerechnet ---------- */
  const bs = [];
  { const e = C.entropy(36, 8), b = C.brute(36, 8, 1e9); bs.push({ id: 'ib1', tab: 'pw', titel: 'Passwort: Entropie und Brute-Force-Zeit', aufgabe: 'Ein Passwort besteht aus 8 zufälligen Zeichen aus Kleinbuchstaben und Ziffern. Ein Angreifer probiert 1 Milliarde Passwörter pro Sekunde. Wie hoch ist die Entropie, und wie lange dauert das Durchprobieren höchstens?', steps: ['Zeichenvorrat: 26 Kleinbuchstaben + 10 Ziffern = 36'].concat(e.steps, b.steps.slice(1)), ergebnis: `H ≈ ${fmt(rd(e.bits, 1), 1)} Bit, Höchstdauer ${C.humanTime(b.seconds)}`, set: { sets: ['klein', 'ziff'], L: '8', rate: '1000000000' } }); }
  { const w = 'NETZWERK', c = C.caesar(w, 3); bs.push({ id: 'ib2', tab: 'kry', titel: 'Caesar: NETZWERK mit Schlüssel 3', aufgabe: 'Verschlüssele das Wort NETZWERK mit dem Caesar-Verfahren (k = 3).', steps: C.caesarSteps(w, 3, false), ergebnis: 'NETZWERK → ' + c, set: { mode: 'caesar', text: w, key: '3', dir: 'enc' } }); }
  { const x = C.xorSteps('01001000', '10110101'); bs.push({ id: 'ib3', tab: 'kry', titel: 'XOR: ein Byte verschlüsseln', aufgabe: 'Verschlüssele 0100 1000 mit dem Schlüssel 1011 0101 per XOR.', steps: x.steps.concat(['Probe: Geheimtext ⊕ Schlüssel ergibt wieder den Klartext 0100 1000.']), ergebnis: 'Geheimtext: ' + bin4(x.result), set: { mode: 'xor', a: '01001000', b: '10110101' } }); }
  { const o = C.permToOctal('rw-r-----'); bs.push({ id: 'ib4', tab: 'net', titel: 'Rechte: rw-r----- als Oktalzahl', aufgabe: 'Eine Datei hat die Rechte rw-r----- . Wie lautet die Oktalzahl, und wer darf was?', steps: o.steps.concat(['Der Besitzer darf lesen und schreiben, die Gruppe nur lesen, alle anderen haben keinen Zugriff.']), ergebnis: 'chmod ' + o.octal, set: { perm: 'rw-r-----' } }); }
  { const p = { proto: 'tcp', src: '203.0.113.7', dst: '192.168.10.80', port: 443 }, e = C.fwEval(FW1, p); bs.push({ id: 'ib5', tab: 'net', titel: 'Firewall: erste passende Regel zählt', aufgabe: 'Ein Paket TCP von 203.0.113.7 an den Webserver 192.168.10.80, Port 443, trifft auf die Beispiel-Regeltabelle. Wird es erlaubt?', steps: ['Die Firewall prüft von oben nach unten und nimmt die erste passende Regel.', 'Regel 1: blocke alles von 203.0.113.0/24. Die Quelle 203.0.113.7 liegt in diesem Netz: passt.', 'Regel 2 („erlauben TCP an den Webserver, Port 443“) würde auch passen, wird aber nicht mehr erreicht.'], ergebnis: `Das Paket wird geblockt (Regel ${e.idx + 1})`, set: { proto: 'tcp', src: p.src, dst: p.dst, port: '443' } }); }
  { const a = C.backupPlan('inc', 200, [10, 10, 10, 10]), d = C.backupPlan('diff', 200, [10, 10, 10, 10]); bs.push({ id: 'ib6', tab: 'bak', titel: 'Backup: inkrementell gegen differentiell', aufgabe: 'Vollsicherung mit 200 GB am Montag. Dienstag bis Freitag ändern sich täglich 10 GB neue Daten. Wie viel Speicher brauchen die fünf Sicherungen inkrementell und differentiell?', steps: ['Inkrementell:'].concat(a.steps, ['Differentiell:'], d.steps, ['Wiederherstellung am Freitag: inkrementell 5 Sicherungen (alle in Folge), differentiell nur 2 (Voll + letzte Differenz).']), ergebnis: `Inkrementell ${fmt(a.total)} GB, differentiell ${fmt(d.total)} GB`, set: { type: 'inc', F: '200', c: '10', days: '4' } }); }
  { const h = C.downHours(99.9); bs.push({ id: 'ib7', tab: 'bak', titel: 'Verfügbarkeit: 99,9 % pro Jahr', aufgabe: 'Ein Dienst hat 99,9 % Verfügbarkeit im Jahr. Wie viele Stunden darf er höchstens ausfallen?', steps: ['Ein Jahr: 365 · 24 = 8760 Stunden', 'Ausfallanteil: 100 % − 99,9 % = 0,1 %', `Ausfallzeit = 8760 h · 0,001 = ${fmt(rd(h, 2), 2)} h = ${fmt(rd(h * 60, 1), 1)} min`], ergebnis: `Höchstens ${fmt(rd(h, 2), 2)} Stunden pro Jahr`, set: { pct: '99,9' } }); }

  root.ITS_DATA = { tasks, beispiele: bs, cats, build, FW1, FW2, FW1_PKTS };
  root.ITS_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.ITS_DATA, TASKS: root.ITS_TASKS, build, tasks, beispiele: bs, FW1, FW2, MAILS };
})(typeof window !== 'undefined' ? window : globalThis);
