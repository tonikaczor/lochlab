'use strict';
/* Tonfunk Netzwerk-Lab: reine Logik (IPv4), ohne Oberfläche.
   Export: window.NET_CORE bzw. module.exports (Node).
   Adressen sind intern vorzeichenlose 32-Bit-Zahlen (Number), nach außen Texte wie '192.168.10.0'.
   Aufgaben-Bausteine: mk(kind, params) liefert eine Frage {text, ask, ans, sol, expl, tips};
   gen(R, cat, level) erzeugt eine zufällige Frage (R = rng(seed)); check(q, eingabe) prüft die Antwort. */
(function (root) {
  const P2 = n => Math.pow(2, n);
  const U = n => n >>> 0;

  /* ---------------- Zufall (seed-fähig) ---------------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];

  /* ---------------- Adressen, Masken ---------------- */
  /* Strenge Prüfung: genau 4 Zahlen 0..255, keine führenden Nullen (mehrdeutig, oft als Oktal gelesen). */
  function parseIP(s) {
    if (typeof s !== 'string') return null;
    const m = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*$/.exec(s); if (!m) return null;
    let v = 0;
    for (let i = 1; i <= 4; i++) { const t = m[i]; if (t.length > 1 && t[0] === '0') return null; const o = +t; if (o > 255) return null; v = v * 256 + o; }
    return v;
  }
  const fmtIP = n => { n = U(n); return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'); };
  const maskOf = p => p <= 0 ? 0 : U(0xFFFFFFFF << (32 - p));
  /* '/26', '26' oder '255.255.255.192' -> Präfixlänge 0..32, sonst null (Maske muss aus zusammenhängenden Einsen bestehen) */
  function parsePrefix(s) {
    if (typeof s === 'number') return Number.isInteger(s) && s >= 0 && s <= 32 ? s : null;
    if (typeof s !== 'string') return null;
    const t = s.trim(), m = /^\/?(\d{1,2})$/.exec(t);
    if (m) { const p = +m[1]; return p <= 32 ? p : null; }
    const v = parseIP(t); if (v === null) return null;
    const inv = U(~v); if ((inv & U(inv + 1)) !== 0) return null;
    let p = 0; for (let b = 31; b >= 0 && (v >>> b) & 1; b--) p++;
    return p;
  }
  /* '192.168.10.0/26' -> {ip, p} oder null */
  function parseCidr(s) {
    if (typeof s !== 'string') return null; const i = s.indexOf('/'); if (i < 0) return null;
    const ip = parseIP(s.slice(0, i)), p = parsePrefix(s.slice(i)); return ip === null || p === null || !/^\/\d{1,2}$/.test(s.slice(i).trim()) ? null : { ip, p };
  }
  function classOf(v) { const a = U(v) >>> 24; return a < 128 ? 'A' : a < 192 ? 'B' : a < 224 ? 'C' : a < 240 ? 'D' : 'E'; }
  /* scope: 'privat' (RFC 1918), 'loopback', 'linklocal' (APIPA), 'multicast', 'reserviert' (Klasse E, 0.0.0.0/8), 'oeffentlich' */
  function scopeOf(v) {
    v = U(v); const a = v >>> 24, b = (v >>> 16) & 255;
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'privat';
    if (a === 127) return 'loopback';
    if (a === 169 && b === 254) return 'linklocal';
    if (a >= 224 && a <= 239) return 'multicast';
    if (a >= 240 || a === 0) return 'reserviert';
    return 'oeffentlich';
  }
  const SCOPE_TXT = { privat: 'privat (RFC 1918)', loopback: 'Loopback (127.0.0.0/8)', linklocal: 'Link-Local / APIPA (169.254.0.0/16)', multicast: 'Multicast (Klasse D)', reserviert: 'reserviert', oeffentlich: 'öffentlich' };

  /* ---------------- Subnetz-Rechner ---------------- */
  /* ip: Text; pre: Präfix (Zahl, '/n', 'n') oder Maske als Text. Liefert null bei ungültiger Eingabe.
     Hostanzahl: 2^h − 2; Sonderfälle nach RFC 3021: /31 = 2 Hosts (Punkt-zu-Punkt, kein Broadcast), /32 = 1 Host (Host-Route). */
  function calc(ipS, pre) {
    const ip = parseIP(ipS), p = parsePrefix(pre); if (ip === null || p === null) return null;
    const mask = maskOf(p), net = U(ip & mask), wild = U(~mask), end = U(net | wild), total = P2(32 - p);
    let first, last, hosts, bc = end, kind = 'normal';
    if (p === 32) { first = last = ip; hosts = 1; bc = null; kind = 'host'; }
    else if (p === 31) { first = net; last = end; hosts = 2; bc = null; kind = 'p2p'; }
    else { first = net + 1; last = end - 1; hosts = total - 2; }
    return { ip: fmtIP(ip), p, mask: fmtIP(mask), wildcard: fmtIP(wild), network: fmtIP(net), broadcast: bc === null ? null : fmtIP(bc), end: fmtIP(end),
      first: fmtIP(first), last: fmtIP(last), hosts, total, cls: classOf(ip), scope: scopeOf(ip), kind,
      n: { ip, mask, net, end, first, last } };
  }
  /* kleinste Hostbit-Zahl b mit 2^b − 2 >= h (mindestens 2 Bit, wie bei /30); null bei h < 1 oder zu groß */
  function hostBits(h) { if (!Number.isInteger(h) || h < 1) return null; let b = 2; while (P2(b) - 2 < h) { b++; if (b > 32) return null; } return b; }
  const prefixForHosts = h => { const b = hostBits(h); return b === null ? null : 32 - b; };

  /* Netz in n gleich große Subnetze teilen (n wird auf die nächste Zweierpotenz aufgerundet). */
  function splitEqual(netS, n) {
    const c = parseCidr(netS); if (!c) return { ok: false, err: 'Netz bitte als Adresse/Präfix angeben, z. B. 192.168.0.0/24.' };
    if (!Number.isInteger(n) || n < 1) return { ok: false, err: 'Die Anzahl der Subnetze muss eine ganze Zahl ab 1 sein.' };
    let bits = 0; while (P2(bits) < n) bits++;
    const np = c.p + bits; if (np > 32) return { ok: false, err: 'Zu viele Subnetze: Im Netz /' + c.p + ' sind höchstens ' + P2(32 - c.p) + ' Adressen vorhanden.' };
    if (bits > 12) return { ok: false, err: 'Mehr als 4096 Subnetze werden nicht aufgelistet.' };
    const base = U(c.ip & maskOf(c.p)), size = P2(32 - np), subs = [];
    for (let i = 0; i < P2(bits); i++) subs.push(calc(fmtIP(base + i * size), np));
    return { ok: true, requested: n, count: P2(bits), prefix: np, rounded: P2(bits) !== n, base: fmtIP(base), basePrefix: c.p, subs };
  }

  /* VLSM: deps = [{n:'Name', h:Hostzahl}], absteigend nach Hosts sortiert, ab der Netzadresse lückenlos vergeben. */
  function vlsm(netS, deps) {
    const c = parseCidr(netS); if (!c) return { ok: false, err: 'Netz bitte als Adresse/Präfix angeben, z. B. 192.168.0.0/24.' };
    if (!Array.isArray(deps) || !deps.length) return { ok: false, err: 'Mindestens eine Abteilung angeben.' };
    for (const d of deps) if (!d || !Number.isInteger(d.h) || d.h < 1) return { ok: false, err: 'Jede Abteilung braucht eine Hostzahl ab 1 (ganze Zahl).' };
    const base = U(c.ip & maskOf(c.p)), limit = base + P2(32 - c.p);
    const order = deps.map((d, i) => ({ n: d.n, h: d.h, i })).sort((a, b) => b.h - a.h || a.i - b.i);
    let cur = base; const list = [];
    for (const d of order) {
      const b = hostBits(d.h); if (b === null) return { ok: false, err: 'Hostzahl ' + d.h + ' ist zu groß.' };
      const size = P2(b);
      if (cur + size > limit) return { ok: false, err: 'Der Adressraum reicht nicht: ' + d.n + ' (' + d.h + ' Hosts, /' + (32 - b) + ') passt nicht mehr in ' + fmtIP(base) + '/' + c.p + '.' };
      list.push({ name: d.n, h: d.h, idx: d.i, prefix: 32 - b, size, c: calc(fmtIP(cur), 32 - b) });
      cur += size;
    }
    return { ok: true, base: fmtIP(base), basePrefix: c.p, list, used: cur - base, free: limit - cur, freeFrom: cur < limit ? fmtIP(cur) : null };
  }

  /* ---------------- Gleiches Netz? Gateway ---------------- */
  function sameNet(aS, bS, mS) {
    const a = parseIP(aS), b = parseIP(bS), p = parsePrefix(mS); if (a === null || b === null || p === null) return { ok: false, err: 'Ungültige Adresse oder Maske.' };
    const m = maskOf(p), na = U(a & m), nb = U(b & m);
    return { ok: true, same: na === nb, netA: fmtIP(na), netB: fmtIP(nb), p };
  }
  /* reason: ok | other | net | bcast | self | invalid */
  function gwCheck(hostS, gwS, mS) {
    const h = parseIP(hostS), g = parseIP(gwS), p = parsePrefix(mS); if (h === null || g === null || p === null) return { ok: false, reason: 'invalid' };
    const m = maskOf(p), net = U(h & m), end = U(net | U(~m));
    if (U(g & m) !== net) return { ok: false, reason: 'other', network: fmtIP(net) };
    if (g === h) return { ok: false, reason: 'self', network: fmtIP(net) };
    if (p <= 30 && g === net) return { ok: false, reason: 'net', network: fmtIP(net) };
    if (p <= 30 && g === end) return { ok: false, reason: 'bcast', network: fmtIP(net) };
    return { ok: true, reason: 'ok', network: fmtIP(net) };
  }

  /* ---------------- Binär ---------------- */
  const toBin = (n, bits) => { bits = bits || 8; let s = U(n).toString(2); while (s.length < bits) s = '0' + s; return s; };
  function fromBin(s) { if (typeof s !== 'string') return null; const t = s.replace(/[\s.]/g, ''); return /^[01]{1,32}$/.test(t) ? parseInt(t, 2) : null; }
  const ipBin = v => { const n = typeof v === 'string' ? parseIP(v) : v; return n === null ? null : [24, 16, 8, 0].map(sh => toBin((n >>> sh) & 255, 8)).join('.'); };

  /* ---------------- Schichten, Ports ---------------- */
  /* PRUEFEN: Das TCP/IP-Modell wird in Büchern mit 4 oder 5 Schichten gezeichnet; hier 4 Schichten (Anwendung, Transport, Internet, Netzzugang). */
  const OSI = [
    { n: 7, name: 'Anwendung', pdu: 'Daten', bsp: 'HTTP, HTTPS, DNS, SMTP, SSH, DHCP', tcpip: 0 },
    { n: 6, name: 'Darstellung', pdu: 'Daten', bsp: 'Zeichensatz, Verschlüsselung, Kompression', tcpip: 0 },
    { n: 5, name: 'Sitzung', pdu: 'Daten', bsp: 'Sitzungsauf- und -abbau', tcpip: 0 },
    { n: 4, name: 'Transport', pdu: 'Segment (TCP) / Datagramm (UDP)', bsp: 'TCP, UDP, Portnummern', tcpip: 1 },
    { n: 3, name: 'Vermittlung', pdu: 'Paket', bsp: 'IP, ICMP, Router, IP-Adresse', tcpip: 2 },
    { n: 2, name: 'Sicherung', pdu: 'Frame', bsp: 'Ethernet, MAC-Adresse, Switch, WLAN-AP', tcpip: 3 },
    { n: 1, name: 'Bitübertragung', pdu: 'Bit', bsp: 'Kabel, Hub, Repeater, Funk', tcpip: 3 }
  ];
  const TCPIP = ['Anwendung', 'Transport', 'Internet', 'Netzzugang'];
  /* [Name, OSI-Schicht, TCP/IP-Schicht (Index in TCPIP)]; Switch = klassischer Layer-2-Switch */
  const ITEMS = [['Hub', 1, 3], ['Repeater', 1, 3], ['Netzwerkkabel', 1, 3], ['Switch (Layer 2)', 2, 3], ['MAC-Adresse', 2, 3], ['Ethernet', 2, 3],
    ['Router', 3, 2], ['IP', 3, 2], ['ICMP (Ping)', 3, 2], ['TCP', 4, 1], ['UDP', 4, 1], ['Portnummer', 4, 1], ['HTTP', 7, 0], ['DNS', 7, 0], ['SSH', 7, 0], ['SMTP', 7, 0]];
  const PORTS = [['HTTP', 80, 'TCP'], ['HTTPS', 443, 'TCP'], ['SSH', 22, 'TCP'], ['DNS', 53, 'UDP (und TCP)'], ['DHCP-Server', 67, 'UDP'], ['DHCP-Client', 68, 'UDP'],
    ['SMTP', 25, 'TCP'], ['FTP (Steuerkanal)', 21, 'TCP'], ['Telnet', 23, 'TCP'], ['POP3', 110, 'TCP'], ['IMAP', 143, 'TCP'], ['RDP', 3389, 'TCP'], ['NTP', 123, 'UDP'], ['SMB', 445, 'TCP']];

  /* ---------------- Fragen ---------------- */
  const ceTxt = (ip, p, dotted) => dotted ? ip + ' mit der Subnetzmaske ' + fmtIP(maskOf(p)) : ip + '/' + p;
  const num = (label, unit) => ({ type: 'num', label, unit: unit || '' });
  /* Interessantes Oktett: das erste, in dem die Maske nicht 0 oder 255 ist */
  function blockInfo(ip, p) {
    if (p % 8 === 0) return 'Die Maske /' + p + ' endet an einer Oktettgrenze: Alle Hostbits sind ganze Oktette und werden in der Netzadresse 0 (im Broadcast 255).';
    const k = Math.floor(p / 8), mo = (maskOf(p) >>> (24 - 8 * k)) & 255, B = 256 - mo, o = (parseIP(ip) >>> (24 - 8 * k)) & 255, st = Math.floor(o / B) * B;
    return 'Interessantes Oktett ist das ' + (k + 1) + '. (Maskenwert ' + mo + '). Blockgröße = 256 − ' + mo + ' = ' + B + '. Der Wert ' + o + ' liegt im Block ' + st + ' bis ' + (st + B - 1) + '.';
  }
  const CH_YN = ['Ja, im selben Subnetz', 'Nein, in unterschiedlichen Subnetzen'];
  const CH_GW = ['Ja, das Gateway ist plausibel', 'Nein: es liegt in einem anderen Subnetz', 'Nein: es ist die Netzadresse', 'Nein: es ist die Broadcast-Adresse', 'Nein: es ist die Adresse des Hosts selbst'];
  const CH_SC = ['Privat (RFC 1918)', 'Öffentlich', 'Sonderbereich (Loopback oder APIPA)', 'Multicast oder reserviert'];
  const CH_CL = ['Klasse A', 'Klasse B', 'Klasse C', 'Klasse D (Multicast)', 'Klasse E (reserviert)'];
  const CH_OSI = OSI.slice().reverse().map(o => o.n + ' ' + o.name);
  const depsTxt = deps => deps.map(d => d.n + ' (' + d.h + ' Hosts)').join(', ');

  const KINDS = {
    bin2dec: p => { const v = fromBin(p.bits), ws = []; for (let i = 0; i < 8; i++) if (p.bits[i] === '1') ws.push(128 >> i);
      return { text: 'Rechne die Binärzahl ' + p.bits + ' in eine Dezimalzahl um.', ask: num('Dezimalzahl'), ans: v,
        expl: 'Stellenwerte von links: 128, 64, 32, 16, 8, 4, 2, 1. Bei einer 1 zählt der Wert: ' + (ws.join(' + ') || '0') + ' = ' + v + '.',
        tips: ['Jede Stelle hat einen Stellenwert: 128, 64, 32, 16, 8, 4, 2, 1 (von links nach rechts).', 'Addiere die Stellenwerte aller Stellen, an denen eine 1 steht.'] }; },
    dec2bin: p => { const b = toBin(p.n, 8), ws = []; for (let i = 0; i < 8; i++) if (b[i] === '1') ws.push(128 >> i);
      return { text: 'Schreibe die Dezimalzahl ' + p.n + ' als 8-stellige Binärzahl.', ask: { type: 'bin', label: 'Binärzahl (8 Stellen)', unit: '' }, ans: b,
        expl: p.n + ' = ' + (ws.join(' + ') || '0') + '. An diesen Stellen steht eine 1, sonst eine 0: ' + b + '.',
        tips: ['Gehe die Stellenwerte 128, 64, 32, 16, 8, 4, 2, 1 von links durch. Passt der Wert noch in den Rest, schreibe 1 und ziehe ihn ab.', 'Beginne mit 128: ' + (p.n >= 128 ? 'er passt (1), Rest ' + (p.n - 128) + '.' : 'er passt nicht (0).') + ' Danach weiter mit 64.'] }; },
    mask2prefix: p => { const pr = parsePrefix(p.mask);
      return { text: 'Welche Präfixlänge (/n) hat die Subnetzmaske ' + p.mask + '?', ask: num('Präfixlänge', '/n'), ans: pr,
        expl: 'Binär hat die Maske ' + ipBin(p.mask) + '. Gezählt werden die Einsen von links: ' + pr + '. Also /' + pr + '.',
        tips: ['Die Präfixlänge ist die Anzahl der 1-Bits in der Maske. Ein Oktett 255 enthält acht davon.', 'Zähle zuerst die vollen 255-Oktette (je 8). Das restliche Oktett zerlegst du in 128, 64, 32, 16 …'] }; },
    prefix2mask: p =>
      ({ text: 'Wie lautet die Subnetzmaske zu /' + p.p + '? (Dezimal mit Punkten)', ask: { type: 'ip', label: 'Subnetzmaske', unit: '' }, ans: fmtIP(maskOf(p.p)),
        expl: '/' + p.p + ' bedeutet ' + p.p + ' Einsen von links: ' + ipBin(maskOf(p.p)) + ' = ' + fmtIP(maskOf(p.p)) + '.',
        tips: ['Schreibe ' + p.p + ' Einsen und fülle mit Nullen auf 32 Bit. Teile in vier Oktette zu je 8 Bit.', 'Ein volles Oktett ist 255. Das angebrochene Oktett: Einsen von links addieren (128, 192, 224, 240, 248, 252, 254).'] }),
    netaddr: p => { const c = calc(p.ip, p.p);
      return { text: 'Wie lautet die Netzadresse von ' + ceTxt(p.ip, p.p, p.dotted) + '?', ask: { type: 'ip', label: 'Netzadresse', unit: '' }, ans: c.network,
        expl: 'Netzadresse = IP-Adresse UND Subnetzmaske (' + c.mask + '). ' + blockInfo(p.ip, p.p) + ' Netzadresse: ' + c.network + '.',
        tips: ['Die Netzadresse entsteht, wenn alle Hostbits auf 0 gesetzt werden (IP UND Maske).', 'Bestimme das Oktett, in dem die Maske nicht 255 ist, und die Blockgröße 256 − Maskenwert. Runde den Wert dort auf das nächste Vielfache der Blockgröße ab.'] }; },
    bcast: p => { const c = calc(p.ip, p.p);
      return { text: 'Wie lautet die Broadcast-Adresse von ' + ceTxt(p.ip, p.p, p.dotted) + '?', ask: { type: 'ip', label: 'Broadcast-Adresse', unit: '' }, ans: c.broadcast,
        expl: 'Broadcast = alle Hostbits auf 1. ' + blockInfo(p.ip, p.p) + ' Netzadresse ' + c.network + ', Broadcast = letzte Adresse des Blocks: ' + c.broadcast + '.',
        tips: ['Die Broadcast-Adresse ist die letzte Adresse des Subnetzes: alle Hostbits sind 1.', 'Bestimme erst die Netzadresse und addiere dann Blockgröße − 1 im interessanten Oktett (die folgenden Oktette werden 255).'] }; },
    firsthost: p => { const c = calc(p.ip, p.p);
      return { text: 'Wie lautet die erste nutzbare Hostadresse im Netz von ' + ceTxt(p.ip, p.p) + '?', ask: { type: 'ip', label: 'Erste Hostadresse', unit: '' }, ans: c.first,
        expl: 'Die Netzadresse ' + c.network + ' selbst ist kein Host. Die erste Hostadresse ist Netzadresse + 1: ' + c.first + '.',
        tips: ['Die erste Hostadresse ist die Netzadresse plus 1.', 'Berechne zuerst die Netzadresse (Hostbits auf 0). ' + blockInfo(p.ip, p.p)] }; },
    lasthost: p => { const c = calc(p.ip, p.p);
      return { text: 'Wie lautet die letzte nutzbare Hostadresse im Netz von ' + ceTxt(p.ip, p.p) + '?', ask: { type: 'ip', label: 'Letzte Hostadresse', unit: '' }, ans: c.last,
        expl: 'Broadcast ist ' + c.broadcast + '. Die letzte Hostadresse ist Broadcast − 1: ' + c.last + '.',
        tips: ['Die letzte Hostadresse ist die Broadcast-Adresse minus 1.', 'Berechne zuerst die Broadcast-Adresse (Hostbits auf 1). ' + blockInfo(p.ip, p.p)] }; },
    hosts: p => { const c = calc('10.0.0.1', p.p), h = 32 - p.p;
      return { text: 'Wie viele nutzbare Hostadressen hat ein Netz mit Präfix /' + p.p + '?', ask: num('Hostanzahl'), ans: c.hosts,
        expl: p.p >= 31 ? '/' + p.p + ' ist ein Sonderfall: ' + (p.p === 31 ? 'Punkt-zu-Punkt-Verbindung nach RFC 3021, beide Adressen sind nutzbar, es gibt keine Broadcast-Adresse: 2 Hosts.' : 'Nur eine Adresse (Host-Route): 1 Host.')
          : 'Hostbits = 32 − ' + p.p + ' = ' + h + '. Adressen: 2^' + h + ' = ' + c.total + '. Minus Netz- und Broadcast-Adresse: ' + c.total + ' − 2 = ' + c.hosts + '.',
        tips: ['Hostbits = 32 − Präfixlänge. Es gibt 2 hoch Hostbits Adressen im Subnetz.', 'Davon sind zwei nicht für Hosts nutzbar: die Netzadresse und die Broadcast-Adresse (außer bei /31 und /32).'] }; },
    prefixForHosts: p => { const b = hostBits(p.h), pr = 32 - b;
      return { text: 'Ein Netz soll mindestens ' + p.h + ' Hosts aufnehmen. Welche Präfixlänge (/n) ist die längste, die noch reicht?', ask: num('Präfixlänge', '/n'), ans: pr,
        expl: 'Gesucht: kleinste Hostbit-Zahl h mit 2^h − 2 ≥ ' + p.h + '. Für h = ' + b + ' gilt 2^' + b + ' − 2 = ' + (P2(b) - 2) + ' (reicht)' + (b > 2 ? ', für h = ' + (b - 1) + ' nur ' + (P2(b - 1) - 2) + ' (zu wenig)' : '') + '. Präfix = 32 − ' + b + ' = /' + pr + '.',
        tips: ['Probiere Zweierpotenzen: 2^h − 2 muss mindestens so groß wie die Hostzahl sein (−2 für Netz- und Broadcast-Adresse).', 'Zweierpotenzen: 4, 8, 16, 32, 64, 128, 256, 512 … Präfix = 32 − Hostbits.'] }; },
    wildcard: p => { const w = fmtIP(U(~maskOf(p.p)));
      return { text: 'Wie lautet die Wildcard-Maske (inverse Maske) zu /' + p.p + '?', ask: { type: 'ip', label: 'Wildcard-Maske', unit: '' }, ans: w,
        expl: 'Die Wildcard-Maske ist die invertierte Subnetzmaske ' + fmtIP(maskOf(p.p)) + ': jede Stelle von 255 abziehen, ergibt ' + w + '.',
        tips: ['Wildcard = Subnetzmaske mit vertauschten Bits (aus 1 wird 0 und umgekehrt).', 'Rechne je Oktett 255 minus Maskenwert.'] }; },
    splitnth: p => { const s = splitEqual(p.net, p.n), e = s.subs[p.k - 1];
      return { text: 'Das Netz ' + p.net + ' wird in ' + p.n + ' gleich große Subnetze geteilt. Wie lautet die Netzadresse des ' + p.k + '. Subnetzes (Zählung ab 1)?', ask: { type: 'ip', label: 'Netzadresse', unit: '' }, ans: e.network,
        expl: p.n + ' Subnetze brauchen ' + Math.log2(s.count) + ' zusätzliche Bits: neuer Präfix /' + s.prefix + ', Blockgröße ' + e.total + '. Das ' + p.k + '. Subnetz beginnt bei ' + s.base + ' + ' + (p.k - 1) + ' × ' + e.total + ' = ' + e.network + '.',
        tips: ['Für n Subnetze borgst du Bits vom Hostteil: 2^Bits ≥ n. Der Präfix wächst um diese Bits.', 'Blockgröße = 2^(32 − neuer Präfix). Das k-te Subnetz beginnt bei Netzadresse + (k − 1) × Blockgröße.'] }; },
    splitprefix: p => { const s = splitEqual(p.net, p.n);
      return { text: 'Das Netz ' + p.net + ' wird in ' + p.n + ' gleich große Subnetze geteilt. Welche Präfixlänge haben die Subnetze?', ask: num('Präfixlänge', '/n'), ans: s.prefix,
        expl: p.n + ' = 2^' + Math.log2(s.count) + ', es werden ' + Math.log2(s.count) + ' Bits geborgt: /' + s.basePrefix + ' + ' + Math.log2(s.count) + ' = /' + s.prefix + '.',
        tips: ['Finde die Zweierpotenz: 2^Bits = Anzahl der Subnetze.', 'Neuer Präfix = alter Präfix + geborgte Bits.'] }; },
    vlsmpref: p => { const v = vlsm(p.net, p.deps), e = v.list.find(x => x.idx === p.who);
      return { text: 'Das Netz ' + p.net + ' wird per VLSM auf diese Abteilungen verteilt: ' + depsTxt(p.deps) + '. Es wird nach Hostzahl absteigend vergeben. Welche Präfixlänge erhält ' + p.deps[p.who].n + '?', ask: num('Präfixlänge', '/n'), ans: e.prefix,
        expl: p.deps[p.who].n + ' braucht ' + e.h + ' Hosts: kleinste Zweierpotenz mit 2^h − 2 ≥ ' + e.h + ' ist h = ' + (32 - e.prefix) + ' (' + (e.size - 2) + ' nutzbare Hosts). Präfix /' + e.prefix + '.',
        tips: ['Bestimme für die Abteilung die nötigen Hostbits: 2^h − 2 muss mindestens die Hostzahl ergeben.', 'Präfix = 32 − h. Bei VLSM bekommt jede Abteilung genau so viel Platz, wie sie braucht.'] }; },
    vlsmnet: p => { const v = vlsm(p.net, p.deps), e = v.list.find(x => x.idx === p.who), pos = v.list.indexOf(e) + 1;
      return { text: 'Das Netz ' + p.net + ' wird per VLSM auf diese Abteilungen verteilt: ' + depsTxt(p.deps) + '. Es wird nach Hostzahl absteigend vergeben, lückenlos ab der Netzadresse. Welche Netzadresse erhält ' + p.deps[p.who].n + '?', ask: { type: 'ip', label: 'Netzadresse', unit: '' }, ans: e.c.network,
        expl: 'Sortiert nach Hosts: ' + v.list.map(x => x.name + ' /' + x.prefix + ' ab ' + x.c.network).join('; ') + '. ' + p.deps[p.who].n + ' ist Platz ' + pos + ': ' + e.c.network + '/' + e.prefix + '.',
        tips: ['Sortiere die Abteilungen absteigend nach Hostzahl und bestimme für jede den Präfix (2^h − 2 ≥ Hosts).', 'Das erste Subnetz beginnt bei der Netzadresse, jedes weitere direkt hinter dem vorigen (Netzadresse + Blockgröße).'] }; },
    samenet: p => { const s = sameNet(p.a, p.b, '/' + p.p);
      return { text: 'Liegen die Hosts ' + p.a + ' und ' + p.b + ' mit der Maske /' + p.p + ' im selben Subnetz?', ask: { type: 'choice', choices: CH_YN }, ans: s.same ? 0 : 1,
        expl: 'Netzadresse von ' + p.a + ': ' + s.netA + '. Netzadresse von ' + p.b + ': ' + s.netB + '. ' + (s.same ? 'Beide sind gleich: selbes Subnetz, die Hosts erreichen sich ohne Router.' : 'Die Netzadressen sind verschieden: Für die Kommunikation ist ein Router nötig.'),
        tips: ['Berechne für beide Adressen die Netzadresse (IP UND Maske).', 'Sind beide Netzadressen gleich, liegen die Hosts im selben Subnetz.'] }; },
    gwok: p => { const g = gwCheck(p.host, p.gw, '/' + p.p), idx = { ok: 0, other: 1, net: 2, bcast: 3, self: 4 }[g.reason], c = calc(p.host, p.p);
      return { text: 'Ein Host hat die Adresse ' + p.host + '/' + p.p + ' und als Standardgateway ' + p.gw + '. Ist das Gateway plausibel eingetragen?', ask: { type: 'choice', choices: CH_GW }, ans: idx,
        expl: 'Das Netz des Hosts: ' + c.network + ' bis ' + c.end + '. ' + [p.gw + ' liegt im Netz und ist eine freie Hostadresse: plausibel.', p.gw + ' liegt außerhalb dieses Netzes: Der Host erreicht es nicht direkt, das Gateway muss im eigenen Subnetz liegen.', p.gw + ' ist die Netzadresse und keine Hostadresse.', p.gw + ' ist die Broadcast-Adresse und keine Hostadresse.', 'Das Gateway hat dieselbe Adresse wie der Host: Adresskonflikt.'][idx],
        tips: ['Das Standardgateway muss im selben Subnetz liegen wie der Host.', 'Prüfe außerdem: Das Gateway darf nicht Netz- oder Broadcast-Adresse sein und nicht die Adresse des Hosts.'] }; },
    private: p => { const s = scopeOf(parseIP(p.ip)), idx = { privat: 0, oeffentlich: 1, loopback: 2, linklocal: 2, multicast: 3, reserviert: 3 }[s];
      return { text: 'In welchen Adressbereich gehört ' + p.ip + '?', ask: { type: 'choice', choices: CH_SC }, ans: idx,
        expl: p.ip + ' ist ' + SCOPE_TXT[s] + '. Private Bereiche (RFC 1918): 10.0.0.0/8, 172.16.0.0/12 (172.16 bis 172.31), 192.168.0.0/16.',
        tips: ['Private Bereiche nach RFC 1918: 10.0.0.0/8, 172.16.0.0/12 und 192.168.0.0/16.', 'Bei 172 zählt nur das zweite Oktett 16 bis 31. Sonderbereiche: 127.x (Loopback), 169.254.x (APIPA).'] }; },
    class: p => { const k = classOf(parseIP(p.ip)), idx = 'ABCDE'.indexOf(k);
      return { text: 'Zu welcher klassenbehafteten Adressklasse gehört ' + p.ip + '?', ask: { type: 'choice', choices: CH_CL }, ans: idx,
        expl: 'Das erste Oktett entscheidet: 1 bis 126 Klasse A, 128 bis 191 Klasse B, 192 bis 223 Klasse C, 224 bis 239 Klasse D, ab 240 Klasse E. ' + p.ip + ' gehört zur Klasse ' + k + '.',
        tips: ['Nur das erste Oktett zählt.', 'Grenzen: A bis 127, B 128 bis 191, C 192 bis 223, D 224 bis 239, E ab 240.'] }; },
    osi: p => { const it = ITEMS.find(x => x[0] === p.item);
      return { text: 'Auf welcher OSI-Schicht ist „' + p.item + '“ einzuordnen?', ask: { type: 'choice', choices: CH_OSI }, ans: it[1] - 1,
        expl: p.item + ' gehört zur Schicht ' + it[1] + ' (' + OSI.find(o => o.n === it[1]).name + '). Merkhilfe: Schicht 1 Kabel/Hub, 2 Switch/MAC/Ethernet, 3 Router/IP, 4 TCP/UDP/Ports, 7 Anwendungsprotokolle.',
        tips: ['Von unten nach oben: 1 Bitübertragung, 2 Sicherung, 3 Vermittlung, 4 Transport, 5 Sitzung, 6 Darstellung, 7 Anwendung.', 'Geräte: Hub = 1, Switch = 2, Router = 3. Protokolle: Ethernet = 2, IP = 3, TCP/UDP = 4, HTTP/DNS/SSH = 7.'] }; },
    tcpip: p => { const it = ITEMS.find(x => x[0] === p.item);
      return { text: 'Zu welcher Schicht des TCP/IP-Modells (4 Schichten) gehört „' + p.item + '“?', ask: { type: 'choice', choices: TCPIP.slice() }, ans: it[2],
        expl: p.item + ' gehört zur TCP/IP-Schicht „' + TCPIP[it[2]] + '“. Zuordnung: Anwendung = OSI 5 bis 7, Transport = OSI 4, Internet = OSI 3, Netzzugang = OSI 1 und 2.',
        tips: ['TCP/IP fasst zusammen: Anwendung (OSI 5–7), Transport (OSI 4), Internet (OSI 3), Netzzugang (OSI 1–2).', 'Ordne zuerst die OSI-Schicht zu und übersetze sie dann in die TCP/IP-Schicht.'] }; },
    /* Wissensfrage aus dem Berufsschulstoff (net39 bis net42): p = { q, right, wrong[3], expl, tips[2] }; die Reihenfolge der Antworten
       hängt fest am Fragetext (gleiche Frage, gleiche Reihenfolge), damit die richtige Antwort nicht immer an derselben Stelle steht. */
    wissen: p => { const R = rng('wissen-' + p.q), ch = [p.right].concat(p.wrong);
      for (let i = ch.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = ch[i]; ch[i] = ch[j]; ch[j] = t; }
      return { text: p.q, ask: { type: 'choice', choices: ch }, ans: ch.indexOf(p.right), expl: p.expl, tips: p.tips.slice() }; },
    port: p => { const it = PORTS.find(x => x[0] === p.name);
      return { text: 'Welcher Standard-Port gehört zu ' + it[0] + '?', ask: num('Portnummer'), ans: it[1],
        expl: it[0] + ' nutzt standardmäßig Port ' + it[1] + ' (' + it[2] + '). Merkliste: HTTP 80, HTTPS 443, SSH 22, DNS 53, DHCP 67/68, SMTP 25, FTP 21, Telnet 23, POP3 110, IMAP 143, RDP 3389.',
        tips: ['Well-Known-Ports liegen zwischen 0 und 1023 (RDP 3389 ist ein registrierter Port).', 'Merkhilfe: SSH 22, Telnet 23, SMTP 25, DNS 53, HTTP 80, HTTPS 443.'] }; }
  };

  function mk(kind, params) {
    const f = KINDS[kind]; if (!f) return null;
    const q = f(params || {}); q.kind = kind; q.params = params;
    q.sol = q.ask.type === 'choice' ? q.ask.choices[q.ans] : String(q.ans) + (q.ask.unit === '/n' ? '' : '');
    if (q.ask.unit === '/n') q.sol = '/' + q.ans;
    return q;
  }

  /* Antwort prüfen. Eingabe: Text (num, ip, bin) oder Index (choice). */
  function check(q, input) {
    const t = q.ask.type;
    if (t === 'choice') return input === q.ans;
    if (typeof input !== 'string') return false;
    if (t === 'num') { const s = input.trim().replace(/^\//, '').replace(/\s/g, ''); return /^\d+$/.test(s) && +s === q.ans; }
    if (t === 'ip') { const v = parseIP(input); return v !== null && fmtIP(v) === q.ans; }
    if (t === 'bin') { const v = fromBin(input); return v !== null && toBin(v, 8) === q.ans; }
    return false;
  }

  /* ---------------- Zufallsgenerator ---------------- */
  const CATS = { bin: 'Binär', sub: 'Subnetting', vlsm: 'VLSM', adr: 'Adressierung', schicht: 'Schichten/Ports' };
  const DEPN = ['Vertrieb', 'Technik', 'Verwaltung', 'Server', 'Lager', 'Gäste-WLAN', 'Fertigung', 'Entwicklung'];
  function rndIP(R, priv) {
    if (!priv) return [ri(R, 11, 126), ri(R, 0, 255), ri(R, 0, 255), ri(R, 1, 254)].join('.');
    const k = ri(R, 0, 2); return (k === 0 ? [10, ri(R, 0, 255), ri(R, 0, 255), ri(R, 1, 254)] : k === 1 ? [172, ri(R, 16, 31), ri(R, 0, 255), ri(R, 1, 254)] : [192, 168, ri(R, 0, 255), ri(R, 1, 254)]).join('.');
  }
  function rndDeps(R, cnt) {
    const names = DEPN.slice(); for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = names[i]; names[i] = names[j]; names[j] = t; }
    for (let tr = 0; tr < 30; tr++) {
      const hs = new Set(); while (hs.size < cnt) hs.add(ri(R, 2, 100));
      const deps = [...hs].map((h, i) => ({ n: names[i], h })), v = vlsm('192.168.0.0/24', deps);
      if (v.ok) return deps;
    }
    return [{ n: 'Vertrieb', h: 60 }, { n: 'Technik', h: 30 }, { n: 'Verwaltung', h: 12 }, { n: 'Server', h: 2 }].slice(0, cnt);
  }
  function gen(R, cat, level) {
    level = level >= 1 && level <= 3 ? level : 2;
    const keys = Object.keys(CATS); if (!CATS[cat]) cat = pick(R, keys);
    const pre = level === 1 ? ri(R, 24, 30) : level === 2 ? ri(R, 16, 30) : ri(R, 9, 30);
    let kind, p;
    if (cat === 'bin') {
      kind = pick(R, level === 1 ? ['bin2dec', 'dec2bin', 'mask2prefix'] : ['bin2dec', 'dec2bin', 'mask2prefix', 'prefix2mask']);
      if (kind === 'bin2dec') p = { bits: toBin(ri(R, 1, 255)) }; else if (kind === 'dec2bin') p = { n: ri(R, 1, 255) };
      else if (kind === 'mask2prefix') p = { mask: fmtIP(maskOf(ri(R, level === 1 ? 24 : 9, 30))) }; else p = { p: ri(R, level === 1 ? 24 : 9, 30) };
    } else if (cat === 'sub') {
      kind = pick(R, level === 1 ? ['netaddr', 'bcast', 'hosts'] : level === 2 ? ['netaddr', 'bcast', 'hosts', 'firsthost', 'lasthost', 'wildcard', 'prefixForHosts'] : ['netaddr', 'bcast', 'firsthost', 'lasthost', 'prefixForHosts', 'wildcard']);
      if (kind === 'hosts' || kind === 'wildcard') p = { p: pre }; else if (kind === 'prefixForHosts') p = { h: level === 1 ? ri(R, 5, 120) : ri(R, 5, 3000) };
      else p = { ip: rndIP(R, true), p: pre, dotted: level === 3 && (kind === 'netaddr' || kind === 'bcast') && R() < 0.5 };
    } else if (cat === 'vlsm') {
      kind = pick(R, level === 1 ? ['splitprefix', 'splitnth'] : ['splitprefix', 'splitnth', 'vlsmpref', 'vlsmnet']);
      if (kind === 'splitprefix') p = { net: pick(R, ['192.168.0.0/24', '10.0.0.0/16', '172.16.0.0/20']), n: pick(R, [2, 4, 8, 16]) };
      else if (kind === 'splitnth') { const n = pick(R, [4, 8, 16]); p = { net: pick(R, ['192.168.0.0/24', '10.0.0.0/16', '172.16.0.0/20']), n, k: ri(R, 2, n) }; }
      else { const cnt = ri(R, 3, 4), deps = rndDeps(R, cnt); p = { net: '192.168.0.0/24', deps, who: ri(R, 0, cnt - 1) }; }
    } else if (cat === 'adr') {
      kind = pick(R, level === 1 ? ['samenet', 'private', 'class'] : ['samenet', 'gwok', 'private', 'class']);
      if (kind === 'samenet') { const c = calc(rndIP(R, true), pre), size = c.total, base = c.n.net, a0 = U(base + ri(R, 0, size - 1)), same = R() < 0.5; p = { a: fmtIP(a0), b: fmtIP(same ? U(base + ri(R, 0, size - 1)) : U(base + size + ri(R, 0, size - 1))), p: pre }; }
      else if (kind === 'gwok') { const ip = rndIP(R, true), c = calc(ip, Math.max(pre, 24)), t = ri(R, 0, 4); let gw;
        if (t === 0) gw = c.first; else if (t === 1) gw = fmtIP(U(c.n.end + 1 + ri(R, 1, 20))); else if (t === 2) gw = c.network; else if (t === 3) gw = c.broadcast; else gw = c.ip;
        p = { host: c.ip, gw, p: Math.max(pre, 24) }; if (t === 0 && c.ip === c.first) p.gw = fmtIP(c.n.first + 1); }
      else if (kind === 'private') p = { ip: pick(R, [rndIP(R, true), rndIP(R, false), '172.32.4.9', '172.15.1.1', '169.254.' + ri(R, 1, 200) + '.' + ri(R, 1, 200), '127.0.0.1', '224.0.0.' + ri(R, 1, 250), '192.169.1.1', '11.0.0.1', '240.1.2.3']) };
      else p = { ip: pick(R, [ri(R, 1, 126) + '.1.2.3', ri(R, 128, 191) + '.10.0.1', ri(R, 192, 223) + '.20.30.4', ri(R, 224, 239) + '.0.0.5', ri(R, 240, 254) + '.1.1.1']) };
    } else {
      kind = pick(R, ['osi', 'tcpip', 'port']);
      if (kind === 'osi') p = { item: pick(R, ITEMS)[0] }; else if (kind === 'tcpip') p = { item: pick(R, ITEMS)[0] }; else p = { name: pick(R, PORTS)[0] };
    }
    const q = mk(kind, p); q.cat = cat; q.level = level; return q;
  }

  const api = { rng, hashStr, ri, parseIP, fmtIP, maskOf, parsePrefix, parseCidr, classOf, scopeOf, SCOPE_TXT, calc, hostBits, prefixForHosts, splitEqual, vlsm, sameNet, gwCheck,
    toBin, fromBin, ipBin, OSI, TCPIP, ITEMS, PORTS, CATS, KINDS, mk, check, gen };
  root.NET_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
