/* Tonfunk LochLab: Aufgaben mit automatischer Prüfung, Layout-Check und Lötanleitung.
   Läuft im selben Scope wie layout.html (doc, load, sheet, toast, pinsOf, labelsOf, PARTS ...). */
(function () {
'use strict';
const LS = window.LochSim;
if (!LS || !window.LOCH_EX) return;

/* ---------- Netze aus einem Layout bestimmen ---------- */
const partsOf = d => d.items.filter(i => i.t === 'part');
function circOf(d) {
  const parts = partsOf(d).map(i => ({ id: i.id, k: i.k, vr: i.vr, v: i.v, n: i.n, pins: pinsOf(i), sw: 0, pos: 0.5, light: 0.5, pressed: false, item: i }));
  return LS.buildCircuit({ parts, tracks: d.items.filter(t => t.t === 'track'), wires: d.items.filter(t => t.t === 'wire') });
}
// Liste der Netze: [{ pins: ['id.pin', ...] }] mit mindestens zwei Anschlüssen
function netList(d) {
  const c = circOf(d), m = new Map();
  partsOf(d).forEach(it => pinsOf(it).forEach(([x, y], i) => {
    const nd = c.nodeOfKey(x + ',' + y); if (nd < 0) return;
    if (!m.has(nd)) m.set(nd, []); m.get(nd).push(it.id + '.' + i);
  }));
  return { c, byNode: m, list: [...m.values()].filter(a => a.length > 1) };
}
const byIdIn = (d, id) => d.items.find(i => i.t === 'part' && i.id === +id);
function pinText(d, key) {
  const [id, pin] = String(key).split('.'), it = byIdIn(d, id); if (!it) return '?';
  const L = labelsOf(it), nm = (it.l || PARTS[it.k].name) + ' ' + (L && L[+pin] ? L[+pin] : 'Pin ' + (+pin + 1));
  return nm;
}
const listText = (d, keys) => { const s = keys.slice(0, 3).map(k => pinText(d, k)); return s.join(', ') + (keys.length > 3 ? ' …' : ''); };

/* ---------- Aufgaben aus den Beispielen ableiten ---------- */
const clone = o => JSON.parse(JSON.stringify(o));
const exDoc = name => { const e = LOCH_EX.find(x => x.name === name); return e ? clone(e.doc) : null; };
const stripConn = d => { d.items = d.items.filter(i => i.t === 'part'); return d; };
// Fehler einbauen: 'missing' = eine Verbindung fehlt, 'short' = zwei Netze sind kurzgeschlossen
function withFault(d, kind) {
  const f = clone(d);
  if (kind === 'missing') {
    const conn = f.items.filter(i => i.t !== 'part'); const victim = conn[Math.max(0, conn.length - 2)]; f.items = f.items.filter(i => i !== victim);
  } else {
    const nl = netList(f), P = [];
    nl.list.forEach((keys, ni) => keys.forEach(k => { const [id, pin] = k.split('.'), it = byIdIn(f, id), pt = pinsOf(it)[+pin]; P.push({ ni, pt }); }));
    let best = null;
    P.forEach(a => P.forEach(b => { if (a.ni >= b.ni) return; const dd = Math.abs(a.pt[0] - b.pt[0]) + Math.abs(a.pt[1] - b.pt[1]); if (dd >= 2 && dd <= 12 && (!best || dd < best[0])) best = [dd, a.pt, b.pt]; }));
    if (best) { const [, a, b] = best; let id = Math.max(0, ...f.items.map(i => i.id || 0)) + 1; f.items.push({ id: id++, t: 'track', x1: a[0], y1: a[1], x2: b[0], y2: a[1] }); if (a[1] !== b[1]) f.items.push({ id: id++, t: 'track', x1: b[0], y1: a[1], x2: b[0], y2: b[1] }); }
  }
  return f;
}
const T = (id, cat, level, title, ex, text, hint, extra) => Object.assign({ id, cat, level, title, ex, text, hint }, extra || {});
const TASKS = [
  T('l1', 'Aufbau', 1, 'Spannungsteiler aufbauen', 'Spannungsteiler', 'Die Bauteile liegen schon auf der Platine. Verbinde sie so, wie es der Stromlaufplan des Spannungsteilers verlangt: Batterie, zwei Widerstände in Reihe. Benutze Silberdraht auf der Lötseite (Werkzeug „Lötbahn“) oder Drahtbrücken.', 'Die beiden Widerstände hängen hintereinander an der Batterie. Der Abgriff liegt zwischen ihnen. Plus der Batterie geht an den oberen, Minus an den unteren Widerstand.'),
  T('l2', 'Aufbau', 1, 'LED mit Vorwiderstand und Schalter', 'LED mit Vorwiderstand und Schalter', 'Verdrahte die Batterie, den Schalter, den Vorwiderstand und die LED in einer Reihe. Der Strom soll von Plus über Schalter und Widerstand durch die LED nach Minus fließen.', 'Reihenfolge ist egal, aber alles muss einen geschlossenen Kreis bilden. Achte auf die Polung der LED (Anode zum Plus).'),
  T('l3', 'Aufbau', 2, 'Lampen in Reihe und parallel', 'Lampen in Reihe und parallel', 'Zwei Lampen sollen in Reihe und zwei parallel an der Batterie liegen. Verdrahte die Platine nach dem Stromlaufplan des Beispiels „Lampen in Reihe und parallel“.', 'Parallel heißt: beide Anschlüsse der Lampen liegen an denselben zwei Punkten. In Reihe heißt: der Ausgang der einen ist der Eingang der nächsten.'),
  T('l4', 'Aufbau', 2, 'Transistor als Schalter', 'Transistor als Schalter', 'Verdrahte den Transistorschalter: Basiswiderstand, Transistor, LED mit Vorwiderstand und die Batterie.', 'Emitter an Minus, Kollektor über LED und Vorwiderstand an Plus, die Basis über den Basiswiderstand zum Schalter.'),
  T('l5', 'Aufbau', 2, 'Dämmerungsschalter mit Fotowiderstand', 'Dämmerungsschalter (LDR)', 'Baue den Dämmerungsschalter auf: Der Fotowiderstand bildet mit einem Widerstand einen Spannungsteiler, der den Transistor ansteuert.', 'Zuerst den Spannungsteiler (LDR und Widerstand), dann den Mittelpunkt an die Basis, zuletzt die LED im Kollektorkreis.'),
  T('l6', 'Aufbau', 3, 'Relais mit Transistor und Freilaufdiode', 'Relais mit Transistor und Freilaufdiode', 'Der Transistor schaltet die Relaisspule, die Freilaufdiode schützt ihn. Verdrahte beide Stromkreise (Steuerung und Last) nach dem Beispiel.', 'Die Diode liegt in Sperrrichtung parallel zur Spule. Last und Steuerkreis sind galvanisch getrennt.'),
  T('l7', 'Aufbau', 3, 'Brückengleichrichter mit Glättung', 'Brückengleichrichter mit Glättung', 'Verdrahte den Brückengleichrichter, den Glättungskondensator und die Last.', 'Die Wechselspannung geht an die beiden Wechselstrom-Anschlüsse (~) des Gleichrichters, Plus und Minus gehen an den Elko (Polung!).'),
  T('l8', 'Aufbau', 3, '555-Blinker aufbauen', '555-Blinker (astabil)', 'Verdrahte den NE555 als astabilen Multivibrator (Blinker) mit zwei Widerständen, dem Kondensator und der LED.', 'Pin 2 und 6 sind verbunden, der Kondensator liegt an Pin 6 nach Masse. Pin 4 und 8 gehen an Plus.'),
  T('l9', 'Arduino und Pi', 2, 'Arduino: LED an Pin 13', 'Blink mit Arduino Uno', 'Der Uno steckt als zwei Stiftleisten auf der Platine. Verbinde Pin 13 über den Vorwiderstand mit der LED und die LED mit Masse (GND).', 'Pin 13 → Widerstand → LED → GND. Die Pinbeschriftung siehst du, wenn du näher heranzoomst.'),
  T('l10', 'Arduino und Pi', 2, 'Raspberry Pi: LED an GPIO17', 'LED blinkt', 'Der Pi hängt mit seiner 40-poligen Stiftleiste an der Platine. Verbinde GPIO17 über den Vorwiderstand mit der LED und die LED mit einem Masse-Pin (GND).', 'GPIO17 ist Pin 11. Masse (GND) gibt es zum Beispiel an Pin 6, 9 und 14.'),
  T('l11', 'Arduino und Pi', 3, 'Raspberry Pi: Temperatursensor am I²C-Bus', 'Temperatur über I²C (LM75)', 'Schließe den Temperatursensor LM75 an: 3,3 V (Pin 1), SDA (GPIO2, Pin 3), SCL (GPIO3, Pin 5) und Masse.', 'VCC an 3V3, SDA an GPIO2, SCL an GPIO3, GND an einen Masse-Pin des Pi.'),
  T('l12', 'Arduino und Pi', 3, 'Arduino: Einparkhilfe verdrahten', 'Einparkhilfe mit Ultraschall', 'Verdrahte den Ultraschallsensor (Plus, Trig, Echo, Masse), den Lautsprecher mit Vorwiderstand und die Stromversorgung nach dem Beispiel.', 'Trig und Echo gehen an digitale Pins, der Lautsprecher über einen Widerstand an einen weiteren Pin, alle Massen an GND.'),
  T('l13', 'Aufbau', 2, 'MOSFET als Schalter aufbauen', 'MOSFET als Schalter (N-Kanal, Low-Side)', 'Verdrahte den MOSFET-Schalter: Der Schalter legt 5 V ans Gate, der 10-kΩ-Widerstand liegt zwischen Gate und Masse, die LED mit Vorwiderstand liegt zwischen Plus und Drain, Source geht an Minus.', 'Pins des MOSFET von vorn: Gate, Drain, Source. Der Strom fließt von Plus über Vorwiderstand und LED in den Drain und aus der Source nach Minus.'),
  T('l14', 'Aufbau', 1, 'Duo-LED verdrahten', 'Duo-LED mit drei Beinen (rot/grün)', 'Verdrahte die Duo-LED: Jede Farbe bekommt einen Schalter und einen Vorwiderstand an ihrer Anode, das mittlere Bein (gemeinsame Kathode) geht an Minus.', 'Die Anoden der beiden Farben liegen außen, die Kathode in der Mitte. Zwei getrennte Zweige von Plus über Schalter und Widerstand zu je einer Anode.'),
  T('l15', 'Projekt Ampel', 3, 'Ampel aufbauen (Taktgeber und Zähler)', 'Ampel mit 555-Takt und Zähler (CD4017)', 'Projekt Ampel, Teil 2 (Aufbau): Baue den Schaltplan aus dem SchaltLab auf der Platine auf. Der NE555 und der CD4017 stecken in Sockeln, die LEDs mit 470-Ω-Vorwiderständen leuchten nacheinander rot, grün, gelb. Verbinde die Bauteile mit Lötbahnen und Drähten.', 'Plane zuerst die Plus- und die Masseschiene. Beim 555: Pin 2 und 6 verbinden, Kondensator an Pin 6 nach Masse. Beim CD4017: Pin 16 an Plus, Pin 8 und 13 an Masse, Pin 3, 2 und 4 über je 470 Ω zu den LEDs, Pin 7 an Pin 15, der 555-Ausgang (Pin 3) an Pin 14. Nutze Drahtbrücken, wo sich Bahnen kreuzen.', { plan: 's17' }),
  T('lf1', 'Fehlersuche', 2, 'Fehlersuche: eine Lötbrücke', 'Transistor als Schalter', 'Auf dieser fertigen Platine hat sich eine Lötbrücke gebildet, zwei Verbindungen berühren sich, die nicht zusammengehören. Finde die Stelle und entferne sie (Werkzeug „Löschen“).', 'Schau, wo zwei Silberdrähte dicht beieinander liegen oder sich kreuzen. „Layout prüfen“ nennt die zwei betroffenen Anschlüsse.', { fault: 'short' }),
  T('lf2', 'Fehlersuche', 2, 'Fehlersuche: eine Leitung fehlt', 'Dämmerungsschalter (LDR)', 'Die Platine ist fast fertig, aber eine Verbindung fehlt (kalte Lötstelle oder Draht vergessen). Finde sie und ergänze sie.', 'Verfolge den Stromweg Schritt für Schritt. „Layout prüfen“ zeigt, welche Anschlüsse nicht verbunden sind.', { fault: 'missing' }),
  T('lf3', 'Fehlersuche', 3, 'Fehlersuche: Netzteil ohne Spannung', 'Brückengleichrichter mit Glättung', 'Das Netzteil liefert keine Gleichspannung. In der Verdrahtung fehlt eine Verbindung. Finde und behebe sie.', 'Prüfe die Wechselspannungs-Anschlüsse und die Verbindung zum Elko.', { fault: 'missing' }),
  T('lf4', 'Fehlersuche', 3, 'Fehlersuche: Uno-Schaltung antwortet nicht', 'Blink mit Arduino Uno', 'Die LED am Arduino bleibt dunkel, obwohl das Programm stimmt. Eine Verbindung auf der Platine fehlt. Finde sie.', 'Pin 13, Vorwiderstand, LED, GND: Welche der Verbindungen fehlt?', { fault: 'missing' }),
];
TASKS.forEach(t => { const base = exDoc(t.ex); t.sol = base; if (!base) return; t.start = t.fault ? withFault(base, t.fault) : stripConn(clone(base)); });
const list = () => TASKS.filter(t => t.sol);
const byTask = id => list().find(t => t.id === id);

/* ---------- Prüfung ---------- */
function checkTask(t, d) {
  const out = [], sol = netList(t.sol), mine = netList(d);
  const missingParts = [];
  partsOf(t.sol).forEach(p => { if (!byIdIn(d, p.id)) missingParts.push(p.l || PARTS[p.k].name); });
  if (missingParts.length) out.push({ ok: false, text: 'Bauteil fehlt oder wurde ersetzt: ' + missingParts.join(', ') + '. Lass die vorgegebenen Bauteile auf der Platine.' });
  const nodeOf = key => { const [id, pin] = key.split('.'), it = byIdIn(d, id); if (!it) return -2; const pt = pinsOf(it)[+pin]; return mine.c.nodeOfKey(pt[0] + ',' + pt[1]); };
  const nodeNets = new Map();
  sol.list.forEach((keys, ni) => {
    const groups = new Map(); keys.forEach(k => { const nd = nodeOf(k); if (nd === -2) return; const g = nd < 0 ? 'x' + k : nd; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(k); });
    if (groups.size <= 1) { out.push({ ok: true, text: 'Verbunden: ' + listText(t.sol, keys) }); }
    else { const gs = [...groups.values()]; out.push({ ok: false, text: 'Es fehlt eine Verbindung: ' + listText(t.sol, gs[0]) + ' ist nicht mit ' + listText(t.sol, gs[1]) + ' verbunden.' }); }
    groups.forEach((ks, g) => { if (typeof g === 'number') { if (!nodeNets.has(g)) nodeNets.set(g, new Set()); nodeNets.get(g).add(ni); } });
  });
  nodeNets.forEach((nis, nd) => { if (nis.size > 1) { const a = [...nis]; out.push({ ok: false, text: 'Kurzschluss: ' + listText(t.sol, sol.list[a[0]]) + ' ist mit ' + listText(t.sol, sol.list[a[1]]) + ' verbunden. Das gehört nicht zusammen.' }); } });
  // Zerstörung in der Simulation
  try {
    const hasSrc = partsOf(d).some(i => i.k === 'BAT' || i.k === 'SIG');
    if (hasSrc && !out.some(o => !o.ok)) { const c = circOf(d), s = LS.createSim(c); for (let i = 0; i < 1500; i++) s.step(2e-4); const ev = s.events.filter(e => e.kind === 'burn'); out.push({ ok: !ev.length, text: ev.length ? 'In der Simulation wird ein Bauteil zerstört: ' + ev[0].text : 'Simulation: nichts wird überlastet.' }); }
  } catch (e) {}
  const good = out.filter(o => o.ok).length; return { lines: out, pct: Math.round(100 * good / Math.max(out.length, 1)), ok: out.length > 0 && out.every(o => o.ok) };
}

/* ---------- Layout-Check ---------- */
const NEED_ALL = ['R', 'LDR', 'NTC', 'PTC', 'LAMP', 'FUSE', 'D', 'LED', 'C', 'CE', 'CF', 'L', 'SPK', 'BZ', 'BAT', 'SIG', 'T', 'THY', 'P', 'TP', 'GL'];
function layoutCheck(d) {
  const out = [], P = partsOf(d); if (!P.length) return [{ ok: false, text: 'Auf der Platine liegen noch keine Bauteile.' }];
  let nl; try { nl = netList(d); } catch (e) { return [{ ok: false, text: 'Das Layout konnte nicht ausgewertet werden.' }]; }
  const nodeOfPin = (it, i) => { const pt = pinsOf(it)[i]; return nl.c.nodeOfKey(pt[0] + ',' + pt[1]); };
  P.forEach(it => {
    const pins = pinsOf(it), nm = it.l || PARTS[it.k].name;
    if (NEED_ALL.includes(it.k)) pins.forEach((_, i) => { const nd = nodeOfPin(it, i), cnt = (nl.byNode.get(nd) || []).length; if (cnt <= 1) out.push({ ok: false, text: nm + ' (' + PARTS[it.k].name + '): ' + (labelsOf(it) && labelsOf(it)[i] ? labelsOf(it)[i] : 'Anschluss ' + (i + 1)) + ' ist mit nichts verbunden.' }); });
    if (pins.length === 2 && nodeOfPin(it, 0) === nodeOfPin(it, 1) && nodeOfPin(it, 0) >= 0 && ['R', 'LED', 'D', 'C', 'CE', 'L', 'LAMP', 'SPK', 'FUSE'].includes(it.k)) out.push({ ok: false, text: nm + ' ist kurzgeschlossen: beide Anschlüsse liegen auf demselben Netz.' });
    if ((it.k === 'BAT' || it.k === 'SIG') && nodeOfPin(it, 0) === nodeOfPin(it, 1) && nodeOfPin(it, 0) >= 0) out.push({ ok: false, text: nm + ': Plus und Minus sind verbunden (Kurzschluss der Spannungsquelle).' });
  });
  // lose Drahtenden
  const holeUse = new Map(); const add = (x, y) => holeUse.set(x + ',' + y, (holeUse.get(x + ',' + y) || 0) + 1);
  P.forEach(it => pinsOf(it).forEach(([x, y]) => add(x, y)));
  d.items.filter(i => i.t === 'track' || i.t === 'wire').forEach(i => { add(i.x1, i.y1); add(i.x2, i.y2); });
  let loose = 0; d.items.filter(i => i.t === 'track' || i.t === 'wire').forEach(i => { [[i.x1, i.y1], [i.x2, i.y2]].forEach(([x, y]) => { if ((holeUse.get(x + ',' + y) || 0) <= 1) loose++; }); });
  if (loose) out.push({ ok: false, text: loose + ' Drahtende(n) liegen frei und berühren nichts (loser Draht oder Silberdraht mit freiem Ende).' });
  // Simulation: Zerstörung
  try {
    const c = nl.c, s = LS.createSim(c); if (c.elems.some(e => e.type === 'V')) { for (let i = 0; i < 2500; i++) s.step(2e-4); s.events.filter(e => e.kind === 'burn').slice(0, 3).forEach(e => out.push({ ok: false, text: 'Simulation: ' + e.text + (e.part && e.part.item && e.part.item.l ? ' (' + e.part.item.l + ')' : '') })); }
    c.warnings.slice(0, 3).forEach(w => { if (!/wird nicht simuliert/.test(w.text)) out.push({ ok: false, text: ((w.part && w.part.item && w.part.item.l) || '') + ' ' + w.text }); });
  } catch (e) {}
  if (!out.length) out.push({ ok: true, text: 'Keine Auffälligkeiten gefunden: alle Anschlüsse verbunden, keine Kurzschlüsse, keine losen Drähte.' });
  return out;
}

/* ---------- Lötanleitung ---------- */
const ORDER = ['R', 'D', 'GL', 'SOCK', 'C', 'CF', 'IC', 'T', 'FET', 'U', 'THY', 'TRIAC', 'VDR', 'OPTO', 'LED', 'LDR', 'NTC', 'PTC', 'PHT', 'L', 'CE', 'P', 'TP', 'SW', 'SCH', 'DSW', 'SEG7', 'Q', 'BZ', 'SPK', 'FUSE', 'LAMP', 'RLY', 'TRF', 'SIP', 'BU', 'KL', 'PIN', 'NANO', 'UNO', 'PI', 'BAT', 'SIG'];
const POLAR = { LED: 'Polung beachten: das lange Bein ist die Anode (+).', D: 'Polung beachten: der Ring markiert die Kathode.', CE: 'Polung beachten: der Streifen markiert Minus.', T: 'Flache Seite zeigt wie im Bild.', IC: 'Kerbe oder Punkt markiert Pin 1.', SOCK: 'Kerbe markiert Pin 1.', BAT: 'Plus und Minus nicht vertauschen.', U: 'Metallfahne wie im Bild ausrichten.', GL: 'Plus- und Minus-Anschluss beachten.', PI: 'Pin 1 (3,3 V) ist markiert.', UNO: 'Zwei Stiftleisten, Beschriftung beachten.' };
const pos = (it, i) => { const p = pinsOf(it)[i]; return 'Spalte ' + (p[0] + 1) + ', Zeile ' + (p[1] + 1); };
function solderHtml(d) {
  const P = partsOf(d).slice().sort((a, b) => { const ia = ORDER.indexOf(a.k), ib = ORDER.indexOf(b.k); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || pinsOf(a)[0][1] - pinsOf(b)[0][1] || pinsOf(a)[0][0] - pinsOf(b)[0][0]; });
  const wires = d.items.filter(i => i.t === 'wire'), tracks = d.items.filter(i => i.t === 'track'), dots = d.items.filter(i => i.t === 'dot');
  const e = s => esc(String(s == null ? '' : s));
  let n = 0, h = `<div class="sol"><h2>Lötanleitung: ${e(d.name)}</h2><p>Platine ${d.cols} × ${d.rows} Löcher. Spalten laufen von links nach rechts, Zeilen von oben nach unten (beide ab 1). Zuerst die niedrigen Bauteile, dann die höheren, zuletzt Stecker und Relais. Bauteile von oben (Bestückungsseite) einsetzen, auf der Lötseite verlöten und die Beinchen kürzen.</p>`;
  if (wires.length) h += `<h3>1. Drahtbrücken (Bestückungsseite)</h3><table><tr><th>Nr.</th><th>Von</th><th>Nach</th></tr>${wires.map((w, i) => `<tr><td>${i + 1}</td><td>Spalte ${w.x1 + 1}, Zeile ${w.y1 + 1}</td><td>Spalte ${w.x2 + 1}, Zeile ${w.y2 + 1}</td></tr>`).join('')}</table>`;
  h += `<h3>${wires.length ? '2' : '1'}. Bauteile</h3><table><tr><th>Schritt</th><th>Bauteil</th><th>Wert</th><th>Lage (Pin 1)</th><th>Hinweis</th><th>✓</th></tr>${P.map(it => { n++; return `<tr><td>${n}</td><td>${e(it.l || '')} ${e(PARTS[it.k].name)}</td><td>${e(it.v || '')}</td><td>${pos(it, 0)}</td><td>${e(POLAR[it.k] || '')}</td><td class="chk">☐</td></tr>`; }).join('')}</table>`;
  if (tracks.length) h += `<h3>${wires.length ? '3' : '2'}. Silberdraht und Lötzinn (Lötseite, gespiegelt)</h3><p>Die Lötseite ist von unten gesehen gespiegelt. Die Angaben unten gelten für die Bestückungsseite; die Strecken werden auf der Rückseite gezogen.</p><table><tr><th>Nr.</th><th>Von</th><th>Nach</th><th>✓</th></tr>${tracks.map((t, i) => `<tr><td>${i + 1}</td><td>Spalte ${t.x1 + 1}, Zeile ${t.y1 + 1}</td><td>Spalte ${t.x2 + 1}, Zeile ${t.y2 + 1}</td><td class="chk">☐</td></tr>`).join('')}</table>`;
  h += `<h3>Zum Schluss</h3><ul><li>Lötstellen auf Zinnbrücken und kalte Lötstellen prüfen (Lupe).</li><li>Mit dem Durchgangsprüfer die Verbindungen gegen den Schaltplan prüfen, besonders Plus gegen Minus.</li><li>Erst dann die Spannung anlegen.</li></ul></div>`;
  return h;
}
function printHtml(html) {
  const pa = document.getElementById('printArea'); if (!pa) return;
  const old = pa.innerHTML; pa.innerHTML = html; document.body.classList.add('printhtml');
  const done = () => { pa.innerHTML = old; document.body.classList.remove('printhtml'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => window.print(), 50);
}

/* ---------- Oberfläche ---------- */
const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const done = () => store('lm4.tdone') || {};
const dots = n => '●'.repeat(n) + '○'.repeat(Math.max(0, 4 - n));
let card = null;
(function css() { const s = document.createElement('style'); s.textContent = `
#tcard{position:absolute;z-index:5;left:8px;top:8px;max-width:min(380px,calc(100% - 16px));background:var(--panel,#1b1f24);color:var(--fg,#e8ecf0);border:1px solid var(--line,#38424d);border-radius:12px;padding:10px 12px;font-size:13px;box-shadow:0 4px 18px rgba(0,0,0,.4)}
#tcard b{display:block;margin-bottom:4px;font-size:14px} #tcard p{margin:0 0 8px;color:var(--mute,#8d99a6);line-height:1.4} #tcard .tb{display:flex;gap:6px;flex-wrap:wrap}
#tcard .tb button{height:34px;padding:0 12px;border-radius:9px;background:var(--panel2,#2c343e);border:1px solid var(--line,#38424d);font-weight:600;font-size:13px}
#tcard .tb .pri{background:var(--accent,#3b9eff);border-color:var(--accent,#3b9eff);color:#fff}
#tcard.min p,#tcard.min .tb{display:none}
.tres .ln{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);font-size:14px} .tres .ln i{font-style:normal;flex:none;width:20px} .tres .ok i{color:#4cd964} .tres .no i{color:#ff6a5a}
.tres .pc{font-size:22px;font-weight:700;margin:4px 0 8px}
body.printhtml #printArea img{display:none} body.printhtml #printArea{background:#fff;color:#111}
@media print{body.printhtml #printArea .sol{font:12px/1.4 sans-serif;color:#111;padding:6mm} body.printhtml #printArea table{border-collapse:collapse;width:100%;margin:2mm 0} body.printhtml #printArea th,body.printhtml #printArea td{border:1px solid #999;padding:2px 5px;text-align:left} body.printhtml #printArea h2{margin:0 0 4mm} body.printhtml #printArea h3{margin:5mm 0 1mm} body.printhtml #printArea .chk{width:8mm;text-align:center}}`; document.head.appendChild(s); })();

function showCard() {
  if (card) { card.remove(); card = null; }
  const t = doc.task && byTask(doc.task); if (!t) return;
  card = document.createElement('div'); card.id = 'tcard';
  card.innerHTML = `<b>${esc(t.title)} <span style="color:var(--mute)">${dots(t.level)}</span></b><p>${esc(t.text)}</p><div class="tb"><button class="pri" data-a="chk">Lösung prüfen</button><button data-a="hint">Tipp</button>${t.plan ? '<button data-a="plan">Schaltplan</button>' : ''}<button data-a="hand">Abgeben</button><button data-a="min">Einklappen</button><button data-a="end">Beenden</button></div>`;
  $('#stage').appendChild(card);
  card.querySelector('[data-a=min]').textContent = card.classList.contains('min') ? 'Aufklappen' : 'Einklappen';
  card.onclick = e => {
    const a = e.target.dataset && e.target.dataset.a; if (!a) return;
    if (a === 'chk') runCheck(t);
    else if (a === 'hint') {
      if (!window.Auswertung) { sheet('Tipp', b => { b.innerHTML = `<p style="margin-top:0">${esc(t.hint)}</p>`; }); return; }
      window.Auswertung.hint({ id: t.id, hint: t.hint,
        concrete: () => { const r = checkTask(t, doc), bad = r.lines.find(l => !l.ok); return bad ? 'Noch nicht erfüllt: ' + bad.text : 'Alle Prüfpunkte sind erfüllt. Tippe auf „Lösung prüfen“.'; },
        solution: () => { try { save(); } catch (x) {} const s = clone(t.sol); s.id = uid(); s.name = 'Musterlösung: ' + t.title; s.updated = Date.now(); load(s); toast('Musterlösung geladen'); } });
    }
    else if (a === 'plan') { location.href = 'schaltplan.html?aufgabe=' + t.plan; }
    else if (a === 'hand') { if (window.Auswertung) window.Auswertung.handIn(t.id, done()[t.id] || 0, t.title); }
    else if (a === 'min') { card.classList.toggle('min'); e.target.textContent = card.classList.contains('min') ? 'Aufklappen' : 'Einklappen'; }
    else if (a === 'end') { delete doc.task; try { save(); } catch (x) {} showCard(); toast('Aufgabe beendet'); }
  };
}
function runCheck(t) {
  const r = checkTask(t, doc), dn = done(); dn[t.id] = Math.max(dn[t.id] || 0, r.pct); store('lm4.tdone', dn);
  sheet('Prüfung: ' + t.title, b => {
    b.innerHTML = `<div class="tres"><div class="pc" style="color:${r.ok ? '#4cd964' : '#ffb340'}">${r.ok ? '✓ Alles richtig' : r.pct + ' % richtig'}</div>${r.lines.map(l => `<div class="ln ${l.ok ? 'ok' : 'no'}"><i>${l.ok ? '✓' : '✗'}</i><span>${esc(l.text)}</span></div>`).join('')}</div>` + (r.ok ? '<p class="hint2">Super. Zum Abgeben tippe in der Aufgabenkarte auf „Abgeben“ und zeige den QR-Code deinem Ausbilder.</p>' : '<p class="hint2">Verbessere die Platine und prüfe nochmal. Du kannst beliebig oft prüfen.</p>');
  });
}
function startTask(id) {
  const t = byTask(id); if (!t) return;
  if (window.Auswertung) window.Auswertung.hintReset(id);
  try { save(); } catch (e) {}
  const d = clone(t.start); d.id = uid(); d.name = 'Aufgabe: ' + t.title; d.task = t.id; d.updated = Date.now();
  load(d); showCard(); toast('Aufgabe geladen');
}
function openTasks() {
  sheet('Aufgaben', (b, close) => {
    const dn = done(), cats = []; list().forEach(t => { if (!cats.includes(t.cat)) cats.push(t.cat); });
    b.innerHTML = '<p class="hint2" style="margin-top:0">Verdrahte die vorgegebenen Bauteile oder finde den Fehler. „Lösung prüfen“ sagt dir genau, was noch fehlt.</p>' + cats.map(c => `<div class="sh">${esc(c)}</div>` + list().filter(t => t.cat === c).map(t => `<button class="row" data-id="${t.id}"><div class="grow"><b>${esc(t.title)}</b><small>${dots(t.level)}${dn[t.id] != null ? ' · ' + (dn[t.id] >= 100 ? '✓ geschafft' : dn[t.id] + ' %') : ''}</small></div></button>`).join('')).join('');
    b.querySelectorAll('[data-id]').forEach(x => x.onclick = () => { close(); startTask(x.dataset.id); });
  });
}
function openCheck() {
  const r = layoutCheck(doc);
  sheet('Layout prüfen', b => { b.innerHTML = `<div class="tres">${r.map(l => `<div class="ln ${l.ok ? 'ok' : 'no'}"><i>${l.ok ? '✓' : '⚠'}</i><span>${esc(l.text)}</span></div>`).join('')}</div><p class="hint2">Die Prüfung ersetzt nicht den Vergleich mit dem Stromlaufplan und den Durchgangstest an der fertigen Platine.</p>`; });
}
function openSolder() {
  if (!partsOf(doc).length) { toast('Noch keine Bauteile auf der Platine'); return; }
  sheet('Lötanleitung', b => { b.innerHTML = '<div style="max-height:52vh;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:13px">' + solderHtml(doc) + '</div><div class="btns" style="margin-top:10px"><button class="btn pri" id="soPr">Drucken</button></div>'; b.querySelector('#soPr').onclick = () => printHtml(solderHtml(doc)); });
}

/* ---------- Einbindung in layout.html ---------- */
window.LochTasks = { menu: m => { if (m === 'tasks') openTasks(); else if (m === 'check') openCheck(); else if (m === 'solder') openSolder(); }, list, check: checkTask, layoutCheck, start: startTask };
const _load = window.load; window.load = function (d) { _load(d); showCard(); };
['#bTasks'].forEach(s => { const el = document.querySelector(s); if (el) el.onclick = openTasks; });
setTimeout(() => {
  showCard();
  const m = location.search.match(/[?&]aufgabe=(\w+)/); if (m && byTask(m[1])) { history.replaceState(null, '', 'layout.html'); startTask(m[1]); }
}, 450);
})();
