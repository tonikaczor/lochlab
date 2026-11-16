'use strict';
/* Tonfunk Netzwerk-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken).
   Wird in netlab.html NACH netui.js geladen und hängt sich per MutationObserver an die Reiter an:
   Binär        -> Bitbalken mit Trennlinie Netz-/Hostanteil
   Subnetz-Rechner -> Bitbalken + Adressbereich als Strahl (Netz, Hosts, Broadcast, IP-Marke)
   Werkstatt    -> geborgte Bits (Teilen) bzw. Auslastung je Abteilung (VLSM)
   Gleiches Netz? -> Bitvergleich Netzanteil A/B + kleines Netzschema (Switch bzw. Router)
   Schichten    -> Datenkapselung Schicht für Schicht (Senden/Empfangen, schrittweise)
   Aufgaben und Trainer bleiben absichtlich ohne Grafik (keine Lösungen verraten).
   Farben nur über die CSS-Variablen der Seite; Bewegung nur ohne prefers-reduced-motion.
   Export: window.NET_VIZ bzw. module.exports (Node-Test quelle/net/test_netviz.js). */
(function (root) {
  const C = root.NET_CORE || (typeof require === 'function' ? require('./netcore.js') : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nf = v => Number(v).toLocaleString('de-DE');
  const f1 = v => (Math.round(v * 10) / 10).toString();
  const tw = (s, fs) => String(s).length * (fs || 11) * 0.56;   /* grobe Textbreite */

  /* ---------------------------------------------------------- Bitbalken */
  const BW = 350, X0 = 4;
  const bx = i => X0 + Math.floor(i / 8) * 86 + (i % 8) * 10;                       /* linke Kante von Bit i (0..31) */
  const edge = p => p <= 0 ? X0 - 2 : p >= 32 ? bx(31) + 12 : (p % 8 === 0 ? bx(p) - 3 : bx(p));   /* x der Trennlinie bei Präfix p */

  /* Beschriftungen ohne Überlappung auf mehrere Zeilen verteilen; liefert SVG und Höhe */
  function labelRows(items, y0, W) {
    const rows = []; let s = '';
    items.forEach(it => {
      const w = tw(it.t, 11); let x = it.x;
      let a = x - w / 2, b = x + w / 2;
      if (a < 4) { b += 4 - a; a = 4; } if (b > W - 4) { a -= b - (W - 4); b = W - 4; }
      let r = 0; while (rows[r] !== undefined && a < rows[r] + 6) r++;
      rows[r] = b;
      s += `<text x="${f1((a + b) / 2)}" y="${y0 + r * 14}" text-anchor="middle" class="${it.c || ''}">${esc(it.t)}</text>`;
    });
    return { s, h: Math.max(1, rows.length) * 14 };
  }

  /* rows: [{label, n (32-Bit-Zahl), cls(i)->Klasse, bits:true}]; segs: [{from,to,c,t}] Klammern unten */
  function bitsSvg(rows, segs, aria) {
    let y = 0, s = '', top = 18;
    rows.forEach(r => {
      const b = C.toBin(r.n, 32);
      s += `<text x="${X0}" y="${y + 11}" class="lb">${esc(r.label)}</text>`;
      for (let i = 0; i < 32; i++) {
        s += `<rect x="${bx(i)}" y="${y + 16}" width="10" height="24" class="c ${r.cls(i)}"/>`;
        if (r.bits !== false) s += `<text x="${bx(i) + 5}" y="${y + 32.5}" text-anchor="middle" class="bt">${b[i]}</text>`;
      }
      [0, 1, 2, 3].forEach(k => { s += `<text x="${bx(k * 8) + 40}" y="${y + 53}" text-anchor="middle" class="m">${(r.n >>> (24 - 8 * k)) & 255}</text>`; });
      y += 64;
    });
    const bot = y - 20;
    let svg = s;
    /* Trennlinie an den Segmentgrenzen */
    const cuts = segs.map(g => g.to).filter(p => p > 0 && p < 32);
    cuts.forEach(p => { const x = edge(p); svg += `<line x1="${x}" y1="${top - 6}" x2="${x}" y2="${bot + 2}" class="cut"/>`; });
    /* Klammern */
    const yb = y - 10; let lab = [];
    segs.forEach(g => {
      if (g.to <= g.from) return;
      const xa = g.from === 0 ? X0 : (g.from % 8 === 0 ? bx(g.from) + 1 : bx(g.from) + 1), xe = g.to === 32 ? bx(31) + 10 : (g.to % 8 === 0 ? bx(g.to - 1) + 10 : bx(g.to) - 1);
      svg += `<path d="M${xa} ${yb - 4}V${yb}H${xe}V${yb - 4}" class="br ${g.c}s"/>`;
      lab.push({ x: (xa + xe) / 2, t: g.t, c: g.c + 't' });
    });
    const L = labelRows(lab, yb + 15, BW + 2);
    const H = yb + 15 + L.h - 4;
    return `<svg viewBox="0 0 ${BW + 2} ${H}" role="img" aria-label="${esc(aria)}">${svg}${L.s}</svg>`;
  }
  const clsNH = p => i => i < p ? 'cN' : 'cH';

  /* IP-Adresse als Bitbalken, Netz- und Hostanteil getrennt */
  function splitBar(ipN, p, label) {
    return bitsSvg([{ label, n: ipN, cls: clsNH(p) }],
      [{ from: 0, to: p, c: 'N', t: 'Netzanteil: ' + p + ' Bit' }, { from: p, to: 32, c: 'H', t: 'Hostanteil: ' + (32 - p) + ' Bit' }],
      'IP-Adresse ' + C.fmtIP(ipN) + ' als 32 Bit, davon ' + p + ' Bit Netzanteil und ' + (32 - p) + ' Bit Hostanteil');
  }

  /* ---------------------------------------------------------- Adressbereich als Strahl */
  function rayAddr(c) {
    const W = 360, L = 10, R = 350, T = R - L;
    const p = c.p, k = Math.min(3, Math.floor(p / 8)), sh = 8 * (3 - k), unit = Math.pow(2, sh);
    const oct = n => Math.floor(n / unit) % 256;
    const o4 = n => [24, 16, 8, 0].map(s => (n >>> s) & 255);
    const startU = oct(c.n.net), wU = c.total / unit, ipU = oct(c.n.ip);
    const xs = L + startU / 256 * T, wb = Math.max(3, wU / 256 * T), xe = Math.min(R, xs + wb);
    const xi = L + (ipU + 0.5) / 256 * T;
    const fixed = o4(c.n.ip).map((v, i) => i < k ? String(v) : 'x').slice(0, k + 1).join('.') + (k < 3 ? '.…' : '');
    let s = '';
    s += `<rect x="${L}" y="38" width="${T}" height="22" rx="4" class="trk"/>`;
    [0, 64, 128, 192, 255].forEach(v => { const x = L + v / 256 * T + (v === 255 ? T / 256 : 0); s += `<line x1="${f1(x)}" y1="60" x2="${f1(x)}" y2="65" class="tk"/><text x="${f1(Math.min(R - 6, Math.max(L + 6, x)))}" y="77" text-anchor="middle" class="m s10">${v}</text>`; });
    s += `<rect x="${f1(xs)}" y="36" width="${f1(xe - xs)}" height="26" rx="3" class="cH blk"/>`;
    if (c.kind === 'normal') {
      s += `<rect x="${f1(xs)}" y="36" width="${f1(Math.min(3, xe - xs))}" height="26" class="eN"/><rect x="${f1(xe - Math.min(3, xe - xs))}" y="36" width="${f1(Math.min(3, xe - xs))}" height="26" class="eB"/>`;
    }
    if (xe - xs > 84) s += `<text x="${f1((xs + xe) / 2)}" y="53" text-anchor="middle" class="s11">${nf(c.hosts)} ${c.hosts === 1 ? 'Host' : 'Hosts'}</text>`;
    s += `<path d="M${f1(xi - 6)} 22L${f1(xi + 6)} 22L${f1(xi)} 33Z" class="ptr"/><text x="${f1(Math.min(R - 24, Math.max(L + 24, xi)))}" y="19" text-anchor="middle" class="s11 b">IP ${esc(c.ip)}</text>`;
    /* Beschriftung Netz / Broadcast */
    let y2 = 94, y3 = 108;
    const tN = (c.kind === 'normal' ? 'Netzadresse ' : c.kind === 'p2p' ? 'Adresse 1: ' : 'Adresse: ') + c.network;
    const tB = c.kind === 'normal' ? 'Broadcast ' + c.broadcast : c.kind === 'p2p' ? 'Adresse 2: ' + c.end : '';
    const xa = Math.max(L, Math.min(xs, W - 6 - tw(tN))), xb = Math.min(R, Math.max(xe, 6 + tw(tB)));
    s += `<line x1="${f1(xs + 1)}" y1="62" x2="${f1(xs + 1)}" y2="${y2 - 11}" class="tk"/><text x="${f1(xa)}" y="${y2}" class="s11 tNs">${esc(tN)}</text>`;
    if (tB) s += `<line x1="${f1(xe - 1)}" y1="62" x2="${f1(xe - 1)}" y2="${y3 - 11}" class="tk"/><text x="${f1(xb)}" y="${y3}" text-anchor="end" class="s11 tBs">${esc(tB)}</text>`;
    s += `<text x="${L}" y="126" class="m s10">Ausschnitt: Oktett ${k + 1} der Adresse (${esc(fixed)}), Skala 0 bis 255</text>`;
    return `<svg viewBox="0 0 ${W} 132" role="img" aria-label="Adressbereich des Netzes ${esc(c.network)}/${c.p} mit ${nf(c.total)} Adressen">${s}</svg>`;
  }

  /* ---------------------------------------------------------- Werkstatt */
  function borrowBar(basePrefix, newPrefix, ipN) {
    const b = newPrefix - basePrefix;
    return bitsSvg([{ label: 'Adresse mit ' + b + ' geborgten Bit', n: ipN, bits: false, cls: i => i < basePrefix ? 'cN' : i < newPrefix ? 'cB' : 'cH' }],
      [{ from: 0, to: basePrefix, c: 'N', t: 'Ursprungsnetz /' + basePrefix }, { from: basePrefix, to: newPrefix, c: 'B', t: b + ' Bit geborgt' }, { from: newPrefix, to: 32, c: 'H', t: 'Hostanteil: ' + (32 - newPrefix) + ' Bit' }],
      'Aufteilung der 32 Bit: ' + basePrefix + ' Bit Ursprungsnetz, ' + b + ' Bit geborgt, ' + (32 - newPrefix) + ' Bit Host');
  }
  /* VLSM: je Abteilung Bedarf gegen nutzbare Hosts; list = Ergebnis von C.vlsm().list */
  function vlsmBars(list) {
    const W = 360, X = 100, MAXW = 150, RH = 28; if (!list.length) return '';
    const mx = Math.max.apply(null, list.map(x => x.c.hosts)); let s = '';
    list.forEach((x, i) => {
      const y = 6 + i * RH, cap = x.c.hosts, wc = Math.max(4, cap / mx * MAXW), wu = Math.max(2, Math.min(wc, x.h / mx * MAXW));
      const nm = x.name.length > 13 ? x.name.slice(0, 12) + '…' : x.name;
      s += `<text x="4" y="${y + 16}" class="s11 b">${esc(nm)}</text>`;
      s += `<rect x="${X}" y="${y + 3}" width="${f1(wc)}" height="18" rx="3" class="cap"/><rect x="${X}" y="${y + 3}" width="${f1(wu)}" height="18" rx="3" class="cN"/>`;
      s += `<text x="${X + MAXW + 8}" y="${y + 16}" class="s10">${nf(x.h)} von ${nf(cap)} · /${x.prefix}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${6 + list.length * RH}" role="img" aria-label="Benötigte Hosts gegen nutzbare Hosts je Abteilung">${s}</svg>`;
  }

  /* ---------------------------------------------------------- Gleiches Netz? */
  function sameBars(aN, bN, p) {
    const diff = i => i < p && (((aN >>> (31 - i)) & 1) !== ((bN >>> (31 - i)) & 1));
    const cls = (n, o) => i => i < p ? (diff(i) ? 'cD' : 'cN') : 'cH';
    const first = (() => { for (let i = 0; i < p; i++) if (diff(i)) return i; return -1; })();
    return bitsSvg([{ label: 'Host A ' + C.fmtIP(aN), n: aN, cls: cls(aN, bN) }, { label: 'Host B ' + C.fmtIP(bN), n: bN, cls: cls(bN, aN) }],
      [{ from: 0, to: p, c: first < 0 ? 'N' : 'D', t: first < 0 ? 'Netzanteil gleich' : 'Netzanteil verschieden' }, { from: p, to: 32, c: 'H', t: 'Hostanteil: ' + (32 - p) + ' Bit' }],
      first < 0 ? 'Die ersten ' + p + ' Bit beider Adressen sind gleich.' : 'Die Netzanteile unterscheiden sich ab Bit ' + (first + 1) + '.');
  }
  function hostBox(x, y, t) { return `<rect x="${x}" y="${y}" width="64" height="34" rx="6" class="nd"/><text x="${x + 32}" y="${y + 21}" text-anchor="middle" class="s11 b">${esc(t)}</text>`; }
  function topo(same, netA, netB) {
    let s = '';
    if (same) {
      s += `<line x1="76" y1="46" x2="148" y2="46" class="ln"/><line x1="212" y1="46" x2="284" y2="46" class="ln"/>`;
      s += hostBox(12, 29, 'Host A') + hostBox(284, 29, 'Host B');
      s += `<rect x="148" y="30" width="64" height="32" rx="6" class="nd sw"/><text x="180" y="50" text-anchor="middle" class="s11 b">Switch</text>`;
      s += `<text x="180" y="82" text-anchor="middle" class="s11 tNs">ein Netz: ${esc(netA)}</text>`;
    } else {
      s += `<line x1="76" y1="46" x2="126" y2="46" class="ln"/><line x1="234" y1="46" x2="284" y2="46" class="ln"/>`;
      s += hostBox(12, 29, 'Host A') + hostBox(284, 29, 'Host B');
      s += `<rect x="126" y="28" width="108" height="36" rx="6" class="nd rt"/><text x="180" y="50" text-anchor="middle" class="s11 b">Router</text>`;
      s += `<text x="44" y="82" text-anchor="middle" class="s10 tNs">${esc(netA)}</text><text x="316" y="82" text-anchor="middle" class="s10 tHs">${esc(netB)}</text>`;
    }
    return `<svg viewBox="0 0 360 92" role="img" aria-label="${same ? 'Beide Hosts hängen im selben Netz am Switch' : 'Die Hosts liegen in verschiedenen Netzen, dazwischen ist ein Router nötig'}">${s}</svg>`;
  }

  /* ---------------------------------------------------------- Datenkapselung */
  const LAYERS = [
    { k: '7–5', n: 'Anwendung', pdu: 'Daten' }, { k: '4', n: 'Transport', pdu: 'Segment (TCP)' }, { k: '3', n: 'Vermittlung', pdu: 'Paket' },
    { k: '2', n: 'Sicherung', pdu: 'Frame' }, { k: '1', n: 'Bitübertragung', pdu: 'Bits' }];
  const SEND = ['Anwendung (Schicht 7 bis 5): Die Anwendung liefert die Nutzdaten, z. B. eine Web-Anfrage. Es gibt noch keinen Header.',
    'Transport (Schicht 4): TCP setzt einen Header davor, u. a. mit Quell- und Zielport. Ergebnis: ein Segment.',
    'Vermittlung (Schicht 3): Der IP-Header trägt Quell- und Ziel-IP-Adresse. Ergebnis: ein Paket.',
    'Sicherung (Schicht 2): Ethernet setzt einen Header mit Ziel- und Quell-MAC-Adresse davor und hängt hinten eine Prüfsumme (FCS) an. Ergebnis: ein Frame.',
    'Bitübertragung (Schicht 1): Der Frame wird als Folge von Bits über Kabel oder Funk gesendet.'];
  const RECV = ['Anwendung: Die Nutzdaten kommen unverändert beim Empfänger an und gehen an die Anwendung.',
    'Transport (Schicht 4): Der TCP-Header wird ausgewertet (u. a. der Zielport) und entfernt. Die Daten gehen an die passende Anwendung.',
    'Vermittlung (Schicht 3): Der IP-Header wird ausgewertet und entfernt. Übrig bleibt das Segment.',
    'Sicherung (Schicht 2): Die Prüfsumme wird kontrolliert, Header und Trailer werden entfernt. Übrig bleibt das Paket.',
    'Bitübertragung (Schicht 1): Die Bits werden empfangen und wieder zu einem Frame zusammengesetzt.'];
  /* dir: 'send' | 'recv'; k: Schritt 0..4 */
  function osiState(dir, k) {
    k = Math.max(0, Math.min(4, k | 0));
    const cur = dir === 'recv' ? 4 - k : k;
    const active = r => dir === 'recv' ? r >= 4 - k : r <= k;
    return { cur, active, text: (dir === 'recv' ? RECV : SEND)[cur] };
  }
  function osiSvg(dir, k) {
    const st = osiState(dir, k), W = 360, RH = 50;
    const box = (x, w, y, t, c) => `<rect x="${x}" y="${y}" width="${w}" height="34" class="c ${c}"/><text x="${x + w / 2}" y="${y + 21}" text-anchor="middle" class="s10 b">${t}</text>`;
    let s = '';
    LAYERS.forEach((L, r) => {
      const y = 8 + r * RH, on = st.active(r), cur = r === st.cur;
      let g = `<rect x="0" y="${y - 4}" width="${W}" height="42" rx="6" class="rowbg${cur ? ' cur' : ''}"/>`;
      g += `<text x="6" y="${y + 13}" class="s10 b">${L.k} ${L.n}</text><text x="6" y="${y + 28}" class="m s10">${esc(L.pdu)}</text>`;
      if (r === 0) g += box(224, 80, y, 'Daten', 'cP');
      else if (r === 1) g += box(186, 38, y, 'TCP', 'cN') + box(224, 80, y, 'Daten', 'cP');
      else if (r === 2) g += box(148, 38, y, 'IP', 'cB') + box(186, 38, y, 'TCP', 'cN') + box(224, 80, y, 'Daten', 'cP');
      else if (r === 3) g += box(104, 44, y, 'Eth', 'cH') + box(148, 38, y, 'IP', 'cB') + box(186, 38, y, 'TCP', 'cN') + box(224, 80, y, 'Daten', 'cP') + box(304, 28, y, 'FCS', 'cH');
      else g += `<rect x="104" y="${y}" width="228" height="34" class="c cP"/><text x="218" y="${y + 21}" text-anchor="middle" class="mono s10">0110 1001 1010 0101 0011 1100 …</text>`;
      s += `<g class="row${on ? '' : ' off'}" data-r="${r}">${g}</g>`;
    });
    return `<svg viewBox="0 0 ${W} ${16 + 5 * RH - 8}" role="img" aria-label="Datenkapselung: Schicht für Schicht kommen Header dazu (Senden) bzw. fallen weg (Empfangen)">${s}</svg>`;
  }

  /* ---------------------------------------------------------- Paketweg: PC1 -> Switch -> Router -> Switch -> Server
     Vereinfachtes Lehrmodell: ein Beispielnetz, MAC-Adressen als Kurzform (echt: 6 Byte), ARP gilt als erledigt,
     TTL-Startwert 64 als Beispiel. Der Switch lernt die Quell-MAC jedes Frames und flutet bei unbekanntem Ziel. */
  const DEV = {
    pc1: { l: 'PC1', ip: '192.168.1.10', mac: 'AA:01' }, pc2: { l: 'PC2', ip: '192.168.1.20', mac: 'AA:02' },
    rA: { l: 'Router, Port A', ip: '192.168.1.1', mac: 'BB:01' }, rB: { l: 'Router, Port B', ip: '192.168.2.1', mac: 'BB:02' },
    sv: { l: 'Server', ip: '192.168.2.10', mac: 'CC:01' } };
  const WEG_FN = { dMac: 'Ziel-MAC', sMac: 'Quell-MAC', sIp: 'Quell-IP', dIp: 'Ziel-IP', ttl: 'TTL' };
  const netOf24 = ip => C.fmtIP(C.parseIP(ip) & C.maskOf(24));

  /* Schritte eines Szenarios. scn: 'diff' (PC1 an Server) | 'same' (PC1 an PC2); learned: kennt der Switch die Ziel-MAC schon? */
  function wegSteps(scn, learned) {
    const a = DEV.pc1, same = scn === 'same', dst = same ? DEV.pc2 : DEV.sv, gw = DEV.rA;
    const myNet = netOf24(a.ip) + '/24', dstNet = netOf24(dst.ip) + '/24';
    const base = { dMac: same ? dst.mac : gw.mac, sMac: a.mac, sIp: a.ip, dIp: dst.ip, ttl: 64 };
    const fl = ' Das Ziel steht nicht in der Tabelle, deshalb flutet der Switch: Er schickt den Frame an alle anderen Ports.';
    const S = [];
    S.push({ at: 'pc1', edges: [], flood: [], frame: base, changed: [], title: 'PC1 entscheidet',
      text: same ? `PC1 will an ${dst.ip} senden. Netz des Ziels: ${dstNet}, eigenes Netz: ${myNet}. Beide sind gleich, also liegt das Ziel im selben Netz und der Frame geht direkt an PC2, ohne Router. Die MAC von PC2 (${dst.mac}) kennt PC1 aus ARP.`
        : `PC1 will an ${dst.ip} senden. Netz des Ziels: ${dstNet}, eigenes Netz: ${myNet}. Das ist ein anderes Netz, also schickt PC1 den Frame an sein Standardgateway ${gw.ip}. Als Ziel-MAC trägt er die MAC des Gateways (${gw.mac}) ein, nicht die des Servers. Die Ziel-IP bleibt die des Servers.` });
    if (same) {
      S.push({ at: 'sw1', edges: ['e1'], flood: learned ? [] : ['e3'], frame: base, changed: [], title: 'Switch SW1 lernt und leitet weiter', sw: 'sw1',
        text: `SW1 empfängt den Frame an Port 1 und lernt: ${a.mac} sitzt an Port 1. Dann sucht er die Ziel-MAC ${dst.mac}.` + (learned ? ' Sie steht in der Tabelle (Port 2), also geht der Frame nur an Port 2.' : fl + ' Der Router (Port 3) verwirft den Frame, weil die Ziel-MAC nicht seine ist.') });
      S.push({ at: 'pc2', edges: ['e1', 'e2'], flood: [], frame: base, changed: [], title: 'PC2 nimmt an',
        text: `Die Ziel-MAC ${dst.mac} ist die von PC2, und die Ziel-IP ${dst.ip} ist seine Adresse. PC2 packt den Frame aus und gibt das Paket an die höheren Schichten weiter. Der Router wurde nicht gebraucht.` });
      return S;
    }
    S.push({ at: 'sw1', edges: ['e1'], flood: learned ? [] : ['e2'], frame: base, changed: [], title: 'Switch SW1 lernt und leitet weiter', sw: 'sw1',
      text: `SW1 empfängt den Frame an Port 1 und lernt: ${a.mac} sitzt an Port 1. Dann sucht er die Ziel-MAC ${gw.mac}.` + (learned ? ' Sie steht in der Tabelle (Port 3), also geht der Frame nur an Port 3, zum Router.' : fl + ' PC2 verwirft den Frame, weil die Ziel-MAC nicht seine ist.') });
    S.push({ at: 'rt', edges: ['e1', 'e3'], flood: [], frame: base, changed: [], title: 'Router schlägt in der Routing-Tabelle nach', rt: true,
      text: `Die Ziel-MAC ${gw.mac} gehört dem Router: Er packt den Frame aus und liest die Ziel-IP ${dst.ip}. Treffer in der Routing-Tabelle: ${dstNet} ist direkt an Port B angeschlossen. Der Router leitet das Paket dort hinaus und senkt die TTL um 1.` });
    const nf = { dMac: dst.mac, sMac: DEV.rB.mac, sIp: a.ip, dIp: dst.ip, ttl: 63 };
    S.push({ at: 'rt', edges: ['e1', 'e3'], flood: [], frame: nf, changed: ['dMac', 'sMac', 'ttl'], title: 'Router packt neu ein',
      text: `Der Router baut einen neuen Frame: Quell-MAC ist jetzt Port B (${DEV.rB.mac}), Ziel-MAC ist der Server (${dst.mac}, per ARP). Die IP-Adressen bleiben auf dem ganzen Weg gleich, die MAC-Adressen wechseln an jedem Router. Die TTL ist auf 63 gesunken.` });
    S.push({ at: 'sw2', edges: ['e1', 'e3', 'e4'], flood: [], frame: nf, changed: [], title: 'Switch SW2 lernt und leitet weiter', sw: 'sw2',
      text: `SW2 empfängt den Frame an Port 1 und lernt: ${DEV.rB.mac} sitzt an Port 1. Dann sucht er die Ziel-MAC ${dst.mac}.` + (learned ? ' Sie steht in der Tabelle (Port 2), also geht der Frame an Port 2.' : ' Sie steht nicht in der Tabelle, also flutet er an alle anderen Ports. Hier gibt es nur Port 2, der Frame landet trotzdem beim Server.') });
    S.push({ at: 'sv', edges: ['e1', 'e3', 'e4', 'e5'], flood: [], frame: nf, changed: [], title: 'Server nimmt an',
      text: `Ziel-MAC ${dst.mac} und Ziel-IP ${dst.ip} passen zum Server. Er packt den Frame aus und gibt das Paket an die höheren Schichten weiter.` });
    return S;
  }

  /* Tabellen zum Schritt k: MAC-Tabellen der Switches, Routing-Tabelle (nur bei anderem Netz).
     Zeile: neu = in diesem Schritt gelernt, hit = in diesem Schritt nachgeschlagen */
  function wegTables(scn, learned, k) {
    const same = scn === 'same', steps = wegSteps(scn, learned);
    k = Math.max(0, Math.min(steps.length - 1, k | 0));
    const out = [];
    const sw = (id, name, init, learnStep, srcDev, srcPort, lookupMac) => {
      const rows = init.map(r => ({ mac: r[0], port: r[1], dev: r[2], neu: false, hit: false }));
      if (k >= learnStep) rows.push({ mac: srcDev.mac, port: srcPort, dev: srcDev.l, neu: k === learnStep, hit: false });
      if (k === learnStep && learned) rows.forEach(r => { if (r.mac === lookupMac) r.hit = true; });
      out.push({ id, name, rows, note: k === learnStep ? (learned ? 'Quelle gelernt, Ziel gefunden: gezielt weiterleiten' : 'Quelle gelernt, Ziel unbekannt: fluten') : '' });
    };
    sw('sw1', 'MAC-Tabelle von SW1', learned ? (same ? [[DEV.pc2.mac, 'Port 2', DEV.pc2.l]] : [[DEV.rA.mac, 'Port 3', DEV.rA.l]]) : [], 1, DEV.pc1, 'Port 1', same ? DEV.pc2.mac : DEV.rA.mac);
    if (!same) sw('sw2', 'MAC-Tabelle von SW2', learned ? [[DEV.sv.mac, 'Port 2', DEV.sv.l]] : [], 4, DEV.rB, 'Port 1', DEV.sv.mac);
    if (!same) out.push({ id: 'rt', name: 'Routing-Tabelle des Routers', routing: true, rows: [
      { net: '192.168.1.0/24', via: 'direkt angeschlossen', port: 'Port A', hit: false }, { net: '192.168.2.0/24', via: 'direkt angeschlossen', port: 'Port B', hit: k === 2 }] });
    return out;
  }

  /* Ziel-Aufgaben: test(state) prüft die Einstellung der Grafik (state = {scn, learned, k}) */
  const WEG_TASKS = [
    { text: 'Stell ein: „Anderes Netz“ und zeige den Schritt, in dem der Router neue MAC-Adressen in den Frame schreibt.', test: s => s.scn === 'diff' && s.k === 3,
      set: { scn: 'diff', learned: true, k: 3 },
      ok: 'Richtig: Beim Router wechseln Ziel-MAC und Quell-MAC (und die TTL sinkt um 1). Die IP-Adressen bleiben gleich.' },
    { text: 'Stell ein: „Gleiches Netz“, Switch-Tabelle „leer“, und zeige den Schritt, in dem der Switch den Frame flutet.', test: s => s.scn === 'same' && !s.learned && s.k === 1,
      set: { scn: 'same', learned: false, k: 1 },
      ok: 'Richtig: Ist die Ziel-MAC unbekannt, schickt der Switch den Frame an alle anderen Ports. Die Quell-MAC lernt er trotzdem.' },
    { text: 'Zeige bei „Anderes Netz“ den Schritt, in dem PC1 entscheidet, den Frame an das Standardgateway zu schicken.', test: s => s.scn === 'diff' && s.k === 0,
      set: { scn: 'diff', learned: true, k: 0 },
      ok: 'Richtig: Liegt das Ziel in einem anderen Netz, geht der Frame an das Gateway. Die Ziel-IP bleibt die des Servers, die Ziel-MAC ist die des Routers.' },
    { text: 'Zeige bei „Anderes Netz“ den Schritt, in dem der Router die Routing-Tabelle befragt.', test: s => s.scn === 'diff' && s.k === 2,
      set: { scn: 'diff', learned: true, k: 2 },
      ok: 'Richtig: Der Router liest die Ziel-IP, findet 192.168.2.0/24 an Port B und leitet dorthin weiter.' },
    { text: 'Stell ein: „Gleiches Netz“, Switch-Tabelle „gelernt“, und zeige den Schritt, in dem der Switch den Frame nur an Port 2 weiterleitet.', test: s => s.scn === 'same' && s.learned && s.k === 1,
      set: { scn: 'same', learned: true, k: 1 },
      ok: 'Richtig: Kennt der Switch die Ziel-MAC, geht der Frame nur an den passenden Port. Das spart Verkehr gegenüber dem Fluten.' }];

  /* Grafik: Topologie oben, darunter die Felder des Frames im aktuellen Schritt. SVG ist direktes Kind von .wrap (feste Bühne am Handy). */
  const WN = { pc1: [6, 14], pc2: [6, 88], sw1: [94, 51], rt: [180, 51], sw2: [266, 51], sv: [338, 51] };
  const WL = { pc1: 'PC1', pc2: 'PC2', sw1: 'SW1', rt: 'Router', sw2: 'SW2', sv: 'Server' };
  const WE = { e1: [56, 32, 94, 60], e2: [56, 106, 94, 78], e3: [144, 69, 180, 69], e4: [230, 69, 266, 69], e5: [316, 69, 338, 69] };
  function wegSvg(scn, k, learned) {
    const steps = wegSteps(scn, learned !== false); k = Math.max(0, Math.min(steps.length - 1, k | 0));
    const st = steps[k], same = scn === 'same';
    const used = same ? ['pc1', 'sw1', 'pc2'] : ['pc1', 'sw1', 'rt', 'sw2', 'sv'];
    const reach = new Set(used);
    const floodNodes = { e2: 'pc2', e3: 'rt' }; st.flood.forEach(e => reach.add(floodNodes[e]));
    const usedEdges = same ? ['e1', 'e2'] : ['e1', 'e3', 'e4', 'e5'];
    let s = '<rect x="2" y="4" width="152" height="126" rx="8" class="band"/><rect x="262" y="4" width="126" height="126" rx="8" class="band"/>';
    s += '<text x="6" y="147" class="m">Netz A 192.168.1.0/24</text><text x="386" y="147" text-anchor="end" class="m">Netz B 192.168.2.0/24</text>';
    Object.keys(WE).forEach(e => {
      const g = WE[e], lit = st.edges.includes(e), fl = st.flood.includes(e), on = usedEdges.includes(e) || fl;
      s += `<line x1="${g[0]}" y1="${g[1]}" x2="${g[2]}" y2="${g[3]}" class="ln${lit ? ' lit' : ''}${fl ? ' fl' : ''}${on ? '' : ' off'}"/>`;
    });
    s += '<text x="88" y="44" text-anchor="middle" class="m">P1</text><text x="88" y="100" text-anchor="middle" class="m">P2</text><text x="154" y="63" text-anchor="middle" class="m">P3</text>'
      + '<text x="173" y="63" text-anchor="middle" class="m">A</text><text x="237" y="63" text-anchor="middle" class="m">B</text><text x="257" y="63" text-anchor="middle" class="m">P1</text><text x="327" y="63" text-anchor="middle" class="m">P2</text>';
    Object.keys(WN).forEach(n => {
      const p = WN[n], act = st.at === n, kind = /^sw/.test(n) ? 'sw' : n === 'rt' ? 'rt' : 'nd';
      s += `<g class="${kind}${act ? ' act' : ''}${reach.has(n) ? '' : ' off'}"><rect x="${p[0]}" y="${p[1]}" width="50" height="36" rx="6" class="nb"/><text x="${p[0] + 25}" y="${p[1] + 23}" text-anchor="middle" class="b">${WL[n]}</text>${act ? `<circle cx="${p[0] + 48}" cy="${p[1] + 2}" r="7" class="pk"/>` : ''}</g>`;
    });
    const cell = (f, x, w) => `<rect x="${x}" y="176" width="${w}" height="42" class="fc${st.changed.includes(f) ? ' chg' : ''}"/><text x="${x + w / 2}" y="191" text-anchor="middle" class="m">${WEG_FN[f]}</text><text x="${x + w / 2}" y="210" text-anchor="middle" class="b">${esc(st.frame[f])}</text>`;
    s += '<text x="6" y="168" class="b">Schicht 2: Frame</text><text x="146" y="168" class="b">Schicht 3: Paket</text>'
      + cell('dMac', 6, 68) + cell('sMac', 74, 68) + cell('sIp', 146, 92) + cell('dIp', 238, 92) + cell('ttl', 330, 54);
    return `<svg data-lr-buehne="verh" class="nvw" viewBox="0 0 390 226" role="img" aria-label="Paketweg, Schritt ${k + 1} von ${steps.length}: ${esc(st.title)}. Frame: Ziel-MAC ${esc(st.frame.dMac)}, Quell-MAC ${esc(st.frame.sMac)}, Quell-IP ${esc(st.frame.sIp)}, Ziel-IP ${esc(st.frame.dIp)}, TTL ${st.frame.ttl}">${s}</svg>`;
  }

  /* ---------------------------------------------------------- Stil */
  const CSS = `
.nv svg{display:block;width:100%;height:auto;max-width:600px;margin:4px auto 0;overflow:visible}
.nv svg text{fill:var(--fg);font:11px system-ui,-apple-system,"Segoe UI",sans-serif}
.nv svg .b{font-weight:700}.nv svg .m{fill:var(--mute)}.nv svg .s10{font-size:10px}.nv svg .s11{font-size:11px}.nv svg .lb{font-size:12px;font-weight:600}
.nv svg .bt{font:600 10px ui-monospace,Menlo,Consolas,monospace}.nv svg .mono{font:10px ui-monospace,Menlo,Consolas,monospace}
.nv svg .tNs{fill:var(--accent)}.nv svg .tHs{fill:var(--hi)}.nv svg .tBs{fill:var(--hi)}.nv svg .Nt{fill:var(--accent);font-weight:700}.nv svg .Ht{fill:var(--hi);font-weight:700}.nv svg .Bt{fill:var(--ok);font-weight:700}.nv svg .Dt{fill:var(--danger);font-weight:700}
.nv svg .c{stroke-width:1}
.nv svg .cN{fill:var(--accent);fill-opacity:.28;stroke:var(--accent)}
.nv svg .cH{fill:var(--hi);fill-opacity:.28;stroke:var(--hi)}
.nv svg .cB{fill:var(--ok);fill-opacity:.28;stroke:var(--ok)}
.nv svg .cD{fill:var(--danger);fill-opacity:.30;stroke:var(--danger)}
.nv svg .cP{fill:var(--panel2);stroke:var(--mute)}
.nv svg .cap{fill:none;stroke:var(--mute);stroke-dasharray:4 3}
.nv svg .trk{fill:var(--panel2);stroke:var(--line)}
.nv svg .blk{stroke-width:1.5}.nv svg .eN{fill:var(--accent)}.nv svg .eB{fill:var(--hi)}
.nv svg .tk{stroke:var(--mute);stroke-width:1}
.nv svg .cut{stroke:var(--fg);stroke-width:2;stroke-linecap:round}
.nv svg .br{fill:none;stroke-width:1.5}.nv svg .Ns{stroke:var(--accent)}.nv svg .Hs{stroke:var(--hi)}.nv svg .Bs{stroke:var(--ok)}.nv svg .Ds{stroke:var(--danger)}
.nv svg .ptr{fill:var(--fg)}
.nv svg .nd{fill:var(--panel2);stroke:var(--mute)}.nv svg .ln{stroke:var(--mute);stroke-width:2}
.nv svg .sw{stroke:var(--accent)}.nv svg .rt{stroke:var(--hi)}
.nv svg .rowbg{fill:transparent;stroke:transparent}.nv svg .rowbg.cur{stroke:var(--accent);stroke-width:1.5}
.nv svg .row{cursor:pointer}.nv svg .row.off{opacity:.25}
.nv .nvc{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;align-items:center}
.nv .nvc .btn{flex:1 1 120px;min-height:44px}
.nv .nvc .seg{flex:1 1 200px}.nv .nvc .seg button{flex:1;min-height:44px}
.nv .nvx{margin:8px 0 0;font-size:14px;line-height:1.45}
.nv .nvk{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--mute);margin:6px 0 0}
.nv .nvk i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-2px;border:3px solid}
.nv .nvk .kN{border-color:var(--accent)}.nv .nvk .kH{border-color:var(--hi)}.nv .nvk .kB{border-color:var(--ok)}.nv .nvk .kD{border-color:var(--danger)}




svg.nvw{display:block;width:100%;height:auto;max-width:640px;margin:0 auto 8px;overflow:visible}
svg.nvw text{fill:var(--fg);font:12.5px system-ui,-apple-system,"Segoe UI",sans-serif}
svg.nvw .b{font-weight:700}svg.nvw .m{fill:var(--mute)}
svg.nvw .band{fill:var(--panel2);fill-opacity:.55;stroke:var(--line)}
svg.nvw .nb{fill:var(--panel);stroke:var(--mute);stroke-width:1.5}
svg.nvw .sw .nb{stroke:var(--accent)}svg.nvw .rt .nb{stroke:var(--hi)}
svg.nvw .act .nb{stroke-width:3.5;fill:var(--panel2)}
svg.nvw .off{opacity:.4}
svg.nvw .pk{fill:var(--hi);stroke:var(--bg);stroke-width:1.5}
svg.nvw .ln{stroke:var(--mute);stroke-width:2}
svg.nvw .ln.lit{stroke:var(--accent);stroke-width:4}
svg.nvw .ln.fl{stroke:var(--hi);stroke-width:3;stroke-dasharray:5 4}
svg.nvw .fc{fill:var(--panel);stroke:var(--mute)}
svg.nvw .fc.chg{fill:var(--hi);fill-opacity:.3;stroke:var(--hi);stroke-width:2}
.nv .wgs{margin:0 0 4px;font-weight:700;font-size:15px}
.nv .wgq{margin:0 0 6px;font-size:15px;line-height:1.45}
.nv .wgtask{margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}
.nv .nvl{margin:10px 0 4px;font-size:14px;color:var(--mute)}
.nv .seg{flex-wrap:wrap;border-radius:12px}
.nv .nvt{display:grid;gap:12px;margin-top:12px}
.nv .nvt h5{margin:0 0 4px;font-size:14px}
.nv .nvt table{width:100%;border-collapse:collapse;font-size:14px}
.nv .nvt th,.nv .nvt td{padding:6px 8px;text-align:left;border-bottom:1px solid var(--line)}
.nv .nvt tr.hit td{background:var(--panel2);background:color-mix(in srgb,var(--hi) 22%,var(--panel))}
.nv .nvt tr.neu td{background:var(--panel2);background:color-mix(in srgb,var(--ok) 18%,var(--panel))}
.nv .nvt .note{margin:4px 0 0;font-size:14px;color:var(--mute)}

@media (prefers-reduced-motion:no-preference){.nv svg .row{transition:opacity .25s}.nv svg .rowbg{transition:stroke .25s}}
@media print{.nv{display:none!important}}`;

  const KEY = { N: '<span><i class="kN"></i>Netzanteil</span>', H: '<span><i class="kH"></i>Hostanteil</span>', B: '<span><i class="kB"></i>geborgte Bits</span>', D: '<span><i class="kD"></i>Netzbit unterscheidet sich</span>' };
  const key = (...a) => `<div class="nvk">${a.map(k => KEY[k]).join('')}</div>`;

  /* ---------------------------------------------------------- Einbau in die Seite (nur im Browser) */
  const API = { splitBar, rayAddr, borrowBar, vlsmBars, sameBars, topo, osiSvg, osiState, LAYERS, wegSteps, wegTables, wegSvg, WEG_TASKS, DEV, CSS, bitsSvg, edge, bx };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.NET_VIZ = API;
  if (typeof document === 'undefined' || !C) return;

  const $ = id => document.getElementById(id);
  const val = id => { const e = $(id); return e ? e.value : ''; };
  const st = document.createElement('style'); st.id = 'nvCss'; st.textContent = CSS; document.head.appendChild(st);

  /* Karte als letztes (pos 'end') oder erstes (pos 'start') Kind der Ansicht sicherstellen */
  function card(view, id, title, pos) {
    let c = $(id);
    if (!c || c.parentNode !== view) {
      c = document.createElement('div'); c.id = id; c.className = 'card pl nv'; c.innerHTML = '<h4></h4><div class="nvb"></div>';
      pos === 'start' ? view.insertBefore(c, view.firstChild) : view.appendChild(c);
    }
    c.firstChild.textContent = title; return c;
  }
  function watch(viewId, build) {
    const v = $(viewId); if (!v) return;
    let t = 0;
    const run = () => { t = 0; mo.disconnect(); try { build(v); } catch (e) { if (root.console) console.warn('netviz', e); } mo.observe(v, { childList: true, subtree: true }); };
    const mo = new MutationObserver(() => { if (!t) t = setTimeout(run, 30); });
    run(); return run;
  }
  const show = (c, html) => { c.style.display = html ? '' : 'none'; c.lastChild.innerHTML = html || ''; };

  /* Binär */
  watch('binView', v => {
    const c = card(v, 'nvBin', 'Grafik: Netzanteil und Hostanteil', 'end'), ip = C.parseIP(val('bIp')), p = C.parsePrefix(val('bM'));
    if (ip === null || p === null) return show(c, '');
    show(c, splitBar(ip, p, 'IP-Adresse ' + C.fmtIP(ip) + ' (/' + p + ')') + key('N', 'H') + '<p class="hint2">Die dicke Linie zeigt, wo die Maske die Adresse teilt. Links davon steht das Netz, rechts der Host. Liegt die Linie mitten in einem Oktett, wird dieses Oktett „zerschnitten“.</p>');
  });
  /* Subnetz-Rechner */
  watch('calcView', v => {
    const c = card(v, 'nvCalc', 'Grafik: Adresse und Adressbereich', 'end'), r = C.calc(val('cIp'), val('cM'));
    if (!r) return show(c, '');
    show(c, splitBar(r.n.ip, r.p, 'IP-Adresse ' + r.ip + ' (/' + r.p + ')') + key('N', 'H') + '<div style="height:10px"></div>' + rayAddr(r)
      + '<p class="hint2">Der Strahl zeigt den Block des Netzes innerhalb des Adressraums. Orange: Adressen des Netzes, blaue Kante: Netzadresse, orange Kante: Broadcast, Pfeil: die eingegebene IP-Adresse.</p>');
  });
  /* Werkstatt */
  watch('werkView', v => {
    const c = card(v, 'nvWerk', 'Grafik: Bits borgen und Auslastung', 'end');
    const netEl = $('wNet'); if (!netEl) return show(c, '');
    const cc = C.parseCidr(netEl.value); if (!cc) return show(c, '');
    if ($('wN')) {
      const n = /^\d+$/.test($('wN').value.trim()) ? +$('wN').value : NaN, r = C.splitEqual(netEl.value, n);
      if (!r.ok) return show(c, '');
      show(c, borrowBar(r.basePrefix, r.prefix, C.parseIP(r.base)) + key('N', 'B', 'H') + `<p class="hint2">${Math.log2(r.count)} Bit werden aus dem Hostanteil geborgt: 2<sup>${Math.log2(r.count)}</sup> = ${nf(r.count)} Subnetze. Jedes geborgte Bit halbiert die Hostzahl je Subnetz.</p>`);
    } else {
      const rows = [...v.querySelectorAll('.dep')], deps = rows.map((d, i) => ({ n: (d.querySelector('.nm').value.trim() || 'Abteilung ' + (i + 1)), h: /^\d+$/.test(d.querySelector('.hn').value.trim()) ? +d.querySelector('.hn').value : NaN }));
      const r = C.vlsm(netEl.value, deps); if (!r.ok) return show(c, '');
      show(c, vlsmBars(r.list) + '<p class="hint2">Gestrichelt: nutzbare Hosts des zugeteilten Blocks. Blau gefüllt: benötigte Hosts. Der Rest des Blocks bleibt ungenutzt, weil Blockgrößen Zweierpotenzen sind.</p>');
    }
  });
  /* Gleiches Netz? */
  watch('sameView', v => {
    const c = card(v, 'nvSame', 'Grafik: Vergleich der Netzanteile', 'end');
    const a = C.parseIP(val('sA')), b = C.parseIP(val('sB')), p = C.parsePrefix(val('sM'));
    if (a === null || b === null || p === null) return show(c, '');
    const sm = C.sameNet(val('sA'), val('sB'), val('sM'));
    show(c, sameBars(a, b, p) + key('N', 'H', 'D') + topo(sm.same, sm.netA + '/' + p, sm.netB + '/' + p)
      + `<p class="hint2">${sm.same ? 'Alle Netzbits stimmen überein: Die Hosts liegen im selben Netz und erreichen sich direkt.' : 'Mindestens ein Netzbit unterscheidet sich (rot): Die Hosts liegen in verschiedenen Netzen, ein Router muss vermitteln.'}</p>`);
  });
  /* Schichten: Zustand bleibt beim Neuaufbau erhalten */
  const OS = { dir: 'send', k: 4 };
  const osiRun = watch('osiView', v => {
    const c = card(v, 'nvOsi', 'Grafik: Datenkapselung', 'start');
    const send = OS.dir === 'send';
    c.lastChild.innerHTML = `<div class="seg" role="group" aria-label="Richtung"><button data-d="send" class="${send ? 'on' : ''}" aria-pressed="${send}">Senden ▼</button><button data-d="recv" class="${send ? '' : 'on'}" aria-pressed="${!send}">Empfangen ▲</button></div>`
      + osiSvg(OS.dir, OS.k) + `<p class="nvx" aria-live="polite">${esc(osiState(OS.dir, OS.k).text)}</p>`
      + `<div class="nvc"><button class="btn" data-s="-1" ${OS.k <= 0 ? 'disabled' : ''}>◀ Zurück</button><button class="btn pri" data-s="1" ${OS.k >= 4 ? 'disabled' : ''}>Weiter ▶</button></div>`
      + '<p class="hint2">Beispiel: TCP über IPv4 über Ethernet. Beim Senden kommt je Schicht ein Header dazu (Kapselung), der Empfänger packt sie in umgekehrter Reihenfolge wieder aus. Tippe auf eine Schicht, um zu ihr zu springen.</p>';
  });
  const ov = $('osiView');
  if (ov) ov.addEventListener('click', e => {
    const d = e.target.closest('#nvOsi [data-d]'), s = e.target.closest('#nvOsi [data-s]'), r = e.target.closest('#nvOsi .row');
    if (d) { OS.dir = d.dataset.d; OS.k = 4; } else if (s) OS.k = Math.max(0, Math.min(4, OS.k + +s.dataset.s)); else if (r) { const n = +r.dataset.r; OS.k = OS.dir === 'send' ? n : 4 - n; } else return;
    osiRun();
  });
  /* Paketweg (Reiter 'weg'): der Zustand bleibt beim Reiterwechsel erhalten, wird aber nicht gespeichert */
  const WG = { scn: 'diff', learned: true, k: 0, task: 0, shown: false };
  const wegTabHtml = t => {
    if (t.routing) return `<div><h5>${esc(t.name)}</h5><div class="scrx"><table><thead><tr><th>Zielnetz</th><th>Weg</th><th>Port</th><th>Schritt</th></tr></thead><tbody>${t.rows.map(r => `<tr class="${r.hit ? 'hit' : ''}"><td>${r.net}</td><td>${r.via}</td><td>${r.port}</td><td>${r.hit ? 'Treffer' : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
    return `<div><h5>${esc(t.name)}</h5><div class="scrx"><table><thead><tr><th>MAC</th><th>Port</th><th>Gerät</th><th>Schritt</th></tr></thead><tbody>${t.rows.length ? t.rows.map(r => `<tr class="${r.hit ? 'hit' : ''}${r.neu ? ' neu' : ''}"><td>${r.mac}</td><td>${r.port}</td><td>${esc(r.dev)}</td><td>${r.neu ? 'neu gelernt' : r.hit ? 'nachgeschlagen' : ''}</td></tr>`).join('') : '<tr><td colspan="4">noch leer</td></tr>'}</tbody></table></div>${t.note ? `<p class="note">${esc(t.note)}</p>` : ''}</div>`;
  };
  const wegAddr = () => `<div><h5>Adressen im Beispiel</h5><div class="scrx"><table><thead><tr><th>Gerät</th><th>IP-Adresse (/24)</th><th>MAC (Kurzform)</th></tr></thead><tbody>${['pc1', 'pc2', 'rA', 'rB', 'sv'].map(k => `<tr><td>${esc(DEV[k].l)}</td><td>${DEV[k].ip}</td><td>${DEV[k].mac}</td></tr>`).join('')}</tbody></table></div><p class="note">PC1 hat das Standardgateway 192.168.1.1. Echte MAC-Adressen haben 6 Byte, hier stehen Kurzformen.</p></div>`;
  function wegRender(view) {
    if (!view) return;
    view.innerHTML = wegSvg(WG.scn, WG.k, WG.learned) + `<div class="card pl nv" id="nvWeg"><h4>Paketweg: ein Frame von PC1 bis zum Ziel</h4>
      <p class="wgs" id="wgHead" aria-live="polite"></p><p class="nvx" id="wgText"></p>
      <div class="nvc"><button class="btn" data-w="back">◀ Zurück</button><button class="btn pri" data-w="next">Weiter ▶</button></div>
      <div id="wgTask" class="wgtask"></div>
      <p class="nvl" id="wgl1">Ziel von PC1</p><div class="seg" role="group" aria-labelledby="wgl1"><button data-w="scn" data-v="diff">Anderes Netz (Server)</button><button data-w="scn" data-v="same">Gleiches Netz (PC2)</button></div>
      <p class="nvl" id="wgl2">Switch-Tabellen am Anfang</p><div class="seg" role="group" aria-labelledby="wgl2"><button data-w="lrn" data-v="0">leer</button><button data-w="lrn" data-v="1">gelernt</button></div>
      <div class="nvt" id="wgTabs"></div>
      <p class="hint2">Orange hinterlegte Felder haben sich im aktuellen Schritt geändert. Eine gestrichelte Linie zeigt, wohin ein Switch mit unbekanntem Ziel flutet. Beispielwerte, vereinfacht: ein Netz je Seite, ARP schon erledigt, TTL 64 als Startwert.</p></div>`;
    wegUpdate();
  }
  function wegUpdate() {
    const view = $('wegView'), svg = view && view.querySelector('svg.nvw'); if (!svg) return;
    const steps = wegSteps(WG.scn, WG.learned), n = steps.length; WG.k = Math.max(0, Math.min(n - 1, WG.k));
    const st = steps[WG.k], tmp = document.createElement('div'); tmp.innerHTML = wegSvg(WG.scn, WG.k, WG.learned);
    svg.innerHTML = tmp.firstChild.innerHTML; svg.setAttribute('aria-label', tmp.firstChild.getAttribute('aria-label'));
    $('wgHead').textContent = 'Schritt ' + (WG.k + 1) + ' von ' + n + ': ' + st.title; $('wgText').textContent = st.text;
    const b = view.querySelector('[data-w=back]'), x = view.querySelector('[data-w=next]'); b.disabled = WG.k <= 0; x.disabled = WG.k >= n - 1;
    view.querySelectorAll('[data-w=scn]').forEach(e => { const on = e.dataset.v === WG.scn; e.classList.toggle('on', on); e.setAttribute('aria-pressed', on); });
    view.querySelectorAll('[data-w=lrn]').forEach(e => { const on = (e.dataset.v === '1') === WG.learned; e.classList.toggle('on', on); e.setAttribute('aria-pressed', on); });
    $('wgTabs').innerHTML = wegTables(WG.scn, WG.learned, WG.k).map(wegTabHtml).join('') + wegAddr();
    const T = WEG_TASKS[WG.task], solved = T.test(WG);
    $('wgTask').innerHTML = `<p class="wgs">Aufgabe ${WG.task + 1} von ${WEG_TASKS.length}</p><p class="wgq">${esc(T.text)}</p>`
      + (solved ? `<div class="lr-fb ${WG.shown ? 'loes' : 'ok'}" role="status"><p>${WG.shown ? 'Lösung: ' : '✓ '}${esc(T.ok)}</p></div>` : '')
      + `<div class="nvc"><button class="btn" data-w="tsol">Lösung zeigen</button><button class="btn${solved ? ' pri' : ''}" data-w="tnext">Nächste Aufgabe ▶</button></div>`;
  }
  const wv = $('wegView');
  if (wv) wv.addEventListener('click', e => {
    const b = e.target.closest('[data-w]'); if (!b || b.disabled) return; const w = b.dataset.w;
    if (w === 'back') { WG.k--; WG.shown = false; } else if (w === 'next') { WG.k++; WG.shown = false; }
    else if (w === 'scn') { if (WG.scn !== b.dataset.v) { WG.scn = b.dataset.v; WG.k = 0; WG.shown = false; } }
    else if (w === 'lrn') { WG.learned = b.dataset.v === '1'; WG.shown = false; }
    else if (w === 'tnext') { WG.task = (WG.task + 1) % WEG_TASKS.length; WG.shown = false; }
    else if (w === 'tsol') { const s = WEG_TASKS[WG.task].set; WG.scn = s.scn; WG.learned = s.learned; WG.k = s.k; WG.shown = true; }
    else return;
    wegUpdate();
  });
  API.wegRender = wegRender;
  { const mid = $('mid'); if (mid && mid.dataset.tab === 'weg') wegRender(wv); }
})(typeof window !== 'undefined' ? window : globalThis);
