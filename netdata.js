'use strict';
/* Tonfunk Netzwerk-Lab: Daten (Aufgaben, Beispiele).
   window.NET_DATA   { tasks, examples, cats }
   window.NET_TASKS  Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'net', Status in localStorage 'lm4.net.done' = {id:true})
   Aufgaben sind reine Daten: {id, cat, level, title, kind, p}; die Frage (Text, Lösung, Erklärung, Tipps) baut NET_CORE.mk(kind, p). */
(function (root) {
  const CATS = ['Binär', 'Subnetting', 'VLSM', 'Adressierung', 'Schichten/Ports', 'Übertragungstechnik'];
  const D4 = [{ n: 'Vertrieb', h: 100 }, { n: 'Technik', h: 50 }, { n: 'Verwaltung', h: 25 }, { n: 'Server', h: 10 }];
  const D4B = [{ n: 'Entwicklung', h: 12 }, { n: 'Lager', h: 60 }, { n: 'Büro', h: 30 }, { n: 'Drucker', h: 2 }];
  const D4C = [{ n: 'Fertigung', h: 28 }, { n: 'Büro', h: 14 }, { n: 'Gäste-WLAN', h: 60 }, { n: 'Lager', h: 5 }];
  const t = (cat, level, title, kind, p) => ({ cat, level, title, kind, p });
  const list = [
    t('Binär', 1, 'Binär nach Dezimal', 'bin2dec', { bits: '10110101' }),
    t('Binär', 1, 'Dezimal nach Binär', 'dec2bin', { n: 200 }),
    t('Binär', 1, 'Maske in Präfix umrechnen', 'mask2prefix', { mask: '255.255.255.192' }),
    t('Binär', 2, 'Präfix in Maske umrechnen', 'prefix2mask', { p: 20 }),
    t('Binär', 2, 'Oktett einer IP-Adresse binär', 'dec2bin', { n: 172 }),
    t('Subnetting', 1, 'Netzadresse bei /26', 'netaddr', { ip: '192.168.10.77', p: 26 }),
    t('Subnetting', 1, 'Broadcast-Adresse bei /26', 'bcast', { ip: '192.168.10.77', p: 26 }),
    t('Subnetting', 1, 'Hosts in einem /26-Netz', 'hosts', { p: 26 }),
    t('Subnetting', 2, 'Erste Hostadresse bei /25', 'firsthost', { ip: '10.1.2.200', p: 25 }),
    t('Subnetting', 2, 'Letzte Hostadresse bei /20', 'lasthost', { ip: '172.16.45.200', p: 20 }),
    t('Subnetting', 2, 'Netzadresse bei /20', 'netaddr', { ip: '172.16.45.200', p: 20 }),
    t('Subnetting', 2, 'Präfix für 50 Hosts', 'prefixForHosts', { h: 50 }),
    t('Subnetting', 3, 'Präfix für 500 Hosts', 'prefixForHosts', { h: 500 }),
    t('Subnetting', 2, 'Wildcard-Maske zu /27', 'wildcard', { p: 27 }),
    /* PRUEFEN: /31 mit 2 Hosts folgt RFC 3021 (Punkt-zu-Punkt); manche Lehrbücher nennen 0 Hosts. Ausbilder: gewünschte Sprechweise festlegen. */
    t('Subnetting', 3, 'Sonderfall /31', 'hosts', { p: 31 }),
    t('Subnetting', 3, 'Netzadresse mit Maske in Punktschreibweise', 'netaddr', { ip: '10.20.30.45', p: 29, dotted: true }),
    t('VLSM', 2, 'Gleich große Subnetze: 3. Netz', 'splitnth', { net: '192.168.0.0/24', n: 8, k: 3 }),
    t('VLSM', 2, 'Präfix beim Teilen in 16 Netze', 'splitprefix', { net: '10.0.0.0/16', n: 16 }),
    t('VLSM', 2, 'VLSM: Präfix einer Abteilung', 'vlsmpref', { net: '192.168.0.0/24', deps: D4, who: 2 }),
    t('VLSM', 3, 'VLSM: Netzadresse einer Abteilung', 'vlsmnet', { net: '192.168.0.0/24', deps: D4B, who: 0 }),
    t('Adressierung', 1, 'Gleiches Subnetz? (/24)', 'samenet', { a: '10.0.5.20', b: '10.0.6.20', p: 24 }),
    t('Adressierung', 2, 'Gleiches Subnetz? (/26)', 'samenet', { a: '192.168.1.130', b: '192.168.1.190', p: 26 }),
    t('Adressierung', 3, 'Standardgateway prüfen', 'gwok', { host: '192.168.10.100', gw: '192.168.10.1', p: 26 }),
    t('Adressierung', 2, 'Privat oder öffentlich?', 'private', { ip: '172.32.0.5' }),
    t('Schichten/Ports', 1, 'Switch im OSI-Modell', 'osi', { item: 'Switch (Layer 2)' }),
    t('Schichten/Ports', 2, 'Router im OSI-Modell', 'osi', { item: 'Router' }),
    t('Schichten/Ports', 1, 'TCP im TCP/IP-Modell', 'tcpip', { item: 'TCP' }),
    t('Schichten/Ports', 1, 'Standard-Port von SSH', 'port', { name: 'SSH' }),
    t('Binär', 1, 'Binäre Oktettfolge in Dezimal', 'bin2dec', { bits: '11001010' }),
    t('Binär', 2, 'Kurze Präfixlänge in Maske', 'prefix2mask', { p: 13 }),
    t('Subnetting', 2, 'Broadcast-Adresse bei /27', 'bcast', { ip: '10.10.10.130', p: 27 }),
    t('Subnetting', 3, 'Netzadresse bei /19', 'netaddr', { ip: '192.168.77.130', p: 19 }),
    t('Subnetting', 3, 'Präfix für 1000 Hosts', 'prefixForHosts', { h: 1000 }),
    t('VLSM', 3, 'VLSM: Netzadresse bei unsortierter Liste', 'vlsmnet', { net: '192.168.5.0/24', deps: D4C, who: 1 }),
    t('Adressierung', 2, 'Gateway-Adresse prüfen', 'gwok', { host: '172.16.5.20', gw: '172.16.5.255', p: 24 }),
    t('Adressierung', 2, 'Adressbereich einer 169.254-Adresse', 'private', { ip: '169.254.12.7' }),
    t('Schichten/Ports', 2, 'ICMP im TCP/IP-Modell', 'tcpip', { item: 'ICMP (Ping)' }),
    t('Schichten/Ports', 2, 'Standard-Port von IMAP', 'port', { name: 'IMAP' }),
    /* ---- Berufsschulstoff (Übertragungstechnik, OSI-Schicht 1 und 2, Nebensprechen): Wissensfragen, eigene Worte. Neue Aufgaben stehen hinten, die Nummern der bisherigen bleiben. */
    t('Schichten/Ports', 1, 'Dateneinheit der Sicherungsschicht', 'wissen', { q: 'Auf der Sicherungsschicht (OSI-Schicht 2) werden die Bits zu Einheiten mit Absender- und Ziel-MAC-Adresse und Prüfsumme zusammengefasst. Wie heißt diese Dateneinheit?', right: 'Rahmen (Frame)', wrong: ['Paket (Packet)', 'Segment (TCP)', 'Bitfolge (Bits)'],
      expl: 'Auf Schicht 2 heißt die Dateneinheit Rahmen (englisch Frame). Er trägt die MAC-Adressen von Absender und Ziel und eine Prüfsumme, mit der der Empfänger Übertragungsfehler erkennt. Pakete gehören zu Schicht 3 (IP), Segmente zu Schicht 4 (TCP), einzelne Bits zu Schicht 1.',
      tips: ['Jede Schicht hat für ihre Dateneinheit einen eigenen Namen. Schicht 2 ist die Schicht des Switches und der MAC-Adressen.', 'Schicht 1: Bits, Schicht 3: Pakete, Schicht 4: Segmente. Welcher Name bleibt für Schicht 2?'] }),
    t('Schichten/Ports', 2, 'Dateneinheiten von unten nach oben', 'wissen', { q: 'Wie heißen die Dateneinheiten der OSI-Schichten 1 bis 4, von der untersten Schicht aus gezählt?', right: 'Bits, Rahmen, Pakete, Segmente', wrong: ['Bits, Pakete, Rahmen, Segmente', 'Rahmen, Bits, Segmente, Pakete', 'Bits, Segmente, Pakete, Rahmen'],
      expl: 'Schicht 1 (Bitübertragung) überträgt Bits, Schicht 2 (Sicherung) bildet daraus Rahmen, Schicht 3 (Vermittlung) arbeitet mit Paketen und IP-Adressen, Schicht 4 (Transport) mit Segmenten und Ports. Beim Senden packt jede Schicht die Einheit der Schicht darüber in ihre eigene ein.',
      tips: ['Denke an die Geräte: Hub auf Schicht 1, Switch auf Schicht 2, Router auf Schicht 3. Welche Einheit bearbeitet jedes Gerät?', 'Der Router leitet Pakete weiter, der Switch Rahmen. Ganz oben in dieser Reihe steht die Einheit von TCP.'] }),
    t('Übertragungstechnik', 1, 'Störquelle im Blockbild', 'wissen', { q: 'Im Blockbild der Nachrichtenübertragung stehen Quelle, Sender, Kanal, Empfänger und Senke. Zusätzlich wird eine Störquelle eingezeichnet. Wo wirkt sie in der Regel ein?', right: 'am Übertragungskanal (Leitung oder Funkstrecke)', wrong: ['an der Quelle, bevor die Nachricht den Sender erreicht', 'an der Senke, nachdem der Empfänger fertig ist', 'nur am Netzteil des Empfängers'],
      expl: 'Der Sender wandelt die Nachricht der Quelle in ein Signal, das über den Kanal (Kabel, Lichtwellenleiter, Funkstrecke) läuft. Auf diesem Weg wirken die meisten Störungen ein, zum Beispiel Einkopplung von Nachbarleitungen oder Funkstörungen. Der Empfänger gewinnt die Nachricht zurück und gibt sie an die Senke weiter.',
      tips: ['Überlege, welcher Teil der Strecke am längsten und am wenigsten geschützt ist.', 'Quelle, Sender, Empfänger und Senke sitzen in Geräten. Dazwischen liegt der Weg durch Kabel oder Luft.'] }),
    t('Übertragungstechnik', 2, 'Übersprechen am Kabelende', 'wissen', { q: 'In einem Datenkabel koppelt das Signal eines Aderpaares in ein benachbartes Paar über. Gemessen wird das Übersprechen an dem Kabelende, an dem auch gesendet wird. Wie heißt diese Größe?', right: 'NEXT (Nahnebensprechen)', wrong: ['FEXT (Fernnebensprechen)', 'Alien Crosstalk (Fremdnebensprechen)', 'Dämpfung (Einfügedämpfung)'],
      expl: 'NEXT (Near End Crosstalk) ist das Übersprechen am nahen Ende, also dort, wo das störende Paar eingespeist wird. FEXT (Far End Crosstalk) misst man am fernen Ende. Als Alien Crosstalk bezeichnet man das Übersprechen zwischen verschiedenen, nebeneinander verlegten Kabeln. Die Dämpfung beschreibt, wie stark das eigene Signal auf dem Weg abnimmt.',
      tips: ['Die Abkürzungen kommen aus dem Englischen: near heißt nah, far heißt fern.', 'Entscheidend ist der Messort: Liegt er beim Sender oder am anderen Ende des Kabels?'] }),
    t('Übertragungstechnik', 3, 'Übersprechen verringern', 'wissen', { q: 'Wodurch wird das Übersprechen zwischen den Aderpaaren eines Datenkabels vor allem klein gehalten?', right: 'Jedes Paar ist verdrillt, und die Paare haben verschiedene Schlaglängen', wrong: ['Alle Paare sind mit genau derselben Schlaglänge eng miteinander verdrillt', 'Die Adern liegen ohne Verdrillung parallel, damit alle gleich lang bleiben', 'Das Kabel wird möglichst lang gewählt, damit es die Störung dämpft'],
      expl: 'Übersprechen entsteht durch kapazitive und induktive Kopplung zwischen den Paaren. Durch das Verdrillen heben sich die eingekoppelten Spannungen der beiden Adern eines Paares weitgehend auf. Mit verschiedenen Schlaglängen liegen die Adern zweier Paare nie lange parallel nebeneinander. Gleiche Schlaglängen, parallele Adern oder lange Kabel verschlechtern das Übersprechen.',
      tips: ['Das Übersprechen kommt von der Kopplung zwischen Adern, die dicht und lange nebeneinander liegen.', 'Wenn zwei Paare gleich verdrillt sind, laufen ihre Adern immer wieder parallel. Wie verhindert man das?'] })
  ].map((x, i) => Object.assign({ id: 'net' + (i + 1) }, x));

  /* ===== Beispiele =====
     tab: Reiter, in den das Beispiel geladen wird; load: Eingaben für diesen Reiter; expect: Soll-Werte (im Test gegen NET_CORE geprüft). */
  const examples = [
    { id: 'bsp1', title: 'Subnetting 192.168.10.0/26', sub: 'Maske, Blockgröße, Netz, Broadcast, Hosts', tab: 'calc', load: { ip: '192.168.10.0', m: '26' },
      expect: { network: '192.168.10.0', broadcast: '192.168.10.63', first: '192.168.10.1', last: '192.168.10.62', hosts: 62, mask: '255.255.255.192' },
      steps: ['Das Präfix /26 bedeutet 26 Einsen: drei volle Oktette und 2 Bit im vierten Oktett (128 + 64 = 192). Maske 255.255.255.192.',
        'Hostbits = 32 − 26 = 6. Ein Subnetz hat 2^6 = 64 Adressen, die Blockgröße im letzten Oktett ist 64 (256 − 192).',
        '192.168.10.0 ist ein Vielfaches von 64, also die Netzadresse. Broadcast = 0 + 64 − 1 = 63, also 192.168.10.63.',
        'Hosts: 192.168.10.1 bis 192.168.10.62. Anzahl 2^6 − 2 = 62.',
        'Die nächsten Subnetze beginnen bei .64, .128 und .192 (jeweils Blockgröße 64).'] },
    { id: 'bsp2', title: 'Netz- und Broadcast-Adresse bestimmen', sub: '172.16.45.200/20', tab: 'calc', load: { ip: '172.16.45.200', m: '20' },
      expect: { network: '172.16.32.0', broadcast: '172.16.47.255', first: '172.16.32.1', last: '172.16.47.254', hosts: 4094, mask: '255.255.240.0', wildcard: '0.0.15.255' },
      steps: ['/20 = 255.255.240.0. Das Oktett, in dem die Maske nicht 255 oder 0 ist, ist das dritte (240).',
        'Blockgröße = 256 − 240 = 16. Die 45 liegt im Block 32 bis 47 (32 = 2 × 16, der nächste Block beginnt bei 48).',
        'Netzadresse: 172.16.32.0. Broadcast: 172.16.47.255 (das dritte Oktett 47, danach alle Hostbits 1).',
        'Hosts: 172.16.32.1 bis 172.16.47.254. Hostbits 12, also 2^12 − 2 = 4094 Hosts.',
        'Wildcard-Maske = 255 − Maske je Oktett: 0.0.15.255.'] },
    { id: 'bsp3', title: 'VLSM: 192.168.0.0/24 auf 4 Abteilungen', sub: 'Vertrieb 100, Technik 50, Verwaltung 25, Server 10 Hosts', tab: 'werk', load: { mode: 'vlsm', net: '192.168.0.0/24', deps: D4 },
      expect: { list: [['Vertrieb', '192.168.0.0', 25], ['Technik', '192.168.0.128', 26], ['Verwaltung', '192.168.0.192', 27], ['Server', '192.168.0.224', 28]], freeFrom: '192.168.0.240' },
      steps: ['Abteilungen absteigend nach Hosts sortieren: 100, 50, 25, 10 (bereits sortiert).',
        'Hostbits bestimmen (2^h − 2 ≥ Hosts): 100 braucht 7 Bit (126), 50 braucht 6 Bit (62), 25 braucht 5 Bit (30), 10 braucht 4 Bit (14).',
        'Präfixe: /25, /26, /27 und /28.',
        'Lückenlos vergeben: Vertrieb 192.168.0.0/25 (0 bis 127), Technik 192.168.0.128/26 (128 bis 191), Verwaltung 192.168.0.192/27 (192 bis 223), Server 192.168.0.224/28 (224 bis 239).',
        'Frei bleibt 192.168.0.240 bis 192.168.0.255 (16 Adressen) für spätere Erweiterungen.'] },
    { id: 'bsp4', title: 'Binär-Umrechnung einer IP-Adresse', sub: '192.168.10.1 in vier Oktetten', tab: 'bin', load: { ip: '192.168.10.1', m: '24', v: 168 },
      expect: { bin: '11000000.10101000.00001010.00000001' },
      steps: ['Jedes Oktett einzeln umrechnen, Stellenwerte 128, 64, 32, 16, 8, 4, 2, 1.',
        '192 = 128 + 64 gibt 11000000.',
        '168 = 128 + 32 + 8 gibt 10101000.',
        '10 = 8 + 2 gibt 00001010. 1 gibt 00000001.',
        'Ergebnis: 11000000.10101000.00001010.00000001. Bei /24 gehören die ersten 24 Bit zum Netzanteil.'] },
    { id: 'bsp5', title: 'Gleiches Netz? Gateway prüfen', sub: '192.168.1.130 und 192.168.1.190 mit /26', tab: 'same', load: { a: '192.168.1.130', b: '192.168.1.190', m: '26', gw: '192.168.1.129' },
      expect: { same: true, netA: '192.168.1.128', gw: 'ok' },
      steps: ['/26 hat die Blockgröße 64. Die Blöcke im letzten Oktett: 0 bis 63, 64 bis 127, 128 bis 191, 192 bis 255.',
        '130 und 190 liegen beide im Block 128 bis 191, Netzadresse 192.168.1.128. Die Hosts sind im selben Subnetz.',
        'Das Gateway 192.168.1.129 liegt im selben Block und ist die erste Hostadresse: plausibel.',
        'Ein Gateway 192.168.1.1 wäre dagegen falsch, denn es liegt im Block 0 bis 63 (anderes Subnetz).'] },
    { id: 'bsp6', title: 'Netz in 4 gleich große Subnetze teilen', sub: '10.0.0.0/16 in 4 Netze', tab: 'werk', load: { mode: 'split', net: '10.0.0.0/16', n: '4' },
      expect: { prefix: 18, nets: ['10.0.0.0', '10.0.64.0', '10.0.128.0', '10.0.192.0'] },
      steps: ['4 Subnetze = 2^2, es werden 2 Bits aus dem Hostteil geborgt: /16 + 2 = /18.',
        'Blockgröße im dritten Oktett: Maske 255.255.192.0, 256 − 192 = 64.',
        'Subnetze: 10.0.0.0/18, 10.0.64.0/18, 10.0.128.0/18, 10.0.192.0/18.',
        'Jedes Subnetz hat 2^14 − 2 = 16382 Hosts.'] }
  ];

  root.NET_DATA = { tasks: list, examples, cats: CATS };
  root.NET_TASKS = list.map(x => ({ id: x.id, cat: x.cat, title: x.title, level: x.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.NET_DATA, TASKS: root.NET_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
