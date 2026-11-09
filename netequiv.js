/* Tonfunk Lab: Prüfung zweier Verdrahtungen auf elektrische Gleichwertigkeit (netequiv.js).
   Reine Funktionen auf Netzlisten, keine DOM-Zugriffe. Browser: window.NetEquiv, Node: module.exports.

   Eingabe je Schaltung: { parts: [{ id, k, v, vr, n, npins, label }], nets: [['id.pin', ...], ...] }
   (nets = Gruppen von Anschlüssen, die auf einem Knoten liegen; Anschlüsse ohne Eintrag gelten als frei).
   Die Bauteil-Nummern (id) sind in Lösung und Platine dieselben, weil die Bauteile vorgegeben sind.

   Gleichwertig heißt: Die Platine lässt sich durch diese Umformungen aus der Musterlösung gewinnen
     1. Anschluss-Symmetrie: Bauteile mit gleichwertigen Anschlüssen dürfen sie tauschen (Widerstand, Lampe, Kondensator,
        Spule, Sicherung, Taster, Schalter als Ein/Aus, Poti-Enden, Relaisspule, Trafo-Wicklung ...). Gepolte und ungleiche
        Anschlüsse bleiben fest (LED, Diode, Elko, Batterie, Transistor, MOSFET, Regler, ICs, Arduino, Pi, Poti-Schleifer,
        Relais Mitte/Schließer/Öffner).
     2. Reihenketten: Zweipole, die hintereinander an Knoten mit genau zwei Anschlüssen hängen, bilden eine Kette, deren
        Reihenfolge beliebig ist. Die Richtung gepolter Teile relativ zur Kette bleibt erhalten.
     3. Gleiche Bauteile (gleiche Art und gleicher Wert) dürfen die Rollen tauschen (vier gleiche Dioden, zwei gleiche Lampen).
   Alles andere ist ein Fehler: fehlende Verbindung, Kurzschluss zweier Netze, zusätzliche Verbindung an einem Anschluss,
   der frei bleiben soll, verpoltes Teil, vertauschte IC-/Transistorpins, fehlendes oder verändertes Bauteil.
   Optionen: sepOk (Anschlussgruppen, die zusammen getrennt vom Rest ihres Netzes liegen dürfen, z. B. eigener Lastkreis),
   keepOrder (Reihenfolge in Ketten bleibt fest, z. B. Spannungsteiler mit Abgriff zwischen den Widerständen),
   optional (Bauteil-Nummern, die fehlen dürfen), pinName(id, pin) und partName(id) für die Meldungen.

   Vorgehen: Aus der Musterlösung werden alle gleichwertigen Varianten aufgezählt (Bahn der Symmetriegruppe) und Netz für Netz
   mit der Platine verglichen. Stimmt eine Variante vollständig, ist die Platine richtig. Sonst liefern die Meldungen den
   Vergleich mit der Variante, die der Platine am nächsten kommt (so zeigen die Hinweise in die Richtung, die der Azubi schon
   eingeschlagen hat, nicht in die der Musterlösung). Die Bahn ist bei den Lab-Aufgaben klein (wenige tausend Varianten);
   eine Obergrenze (CAP) schützt vor Ausreißern, dann wird "capped" gemeldet. */
(function (root) {
'use strict';

const KEY = (id, t) => id + '.' + t;
const CAP = 60000;

/* ============ Bauteilmodelle ============
   Modell: { nterm, term: [Pin -> Terminal], edges: [{ a, b, type, ph, polar }], atomic, phase }
   - Terminal: elektrisch ein Anschluss (intern verbundene Pins, z. B. die zwei Beinpaare eines Tasters, die Masse-Pins des Pi, sind ein Terminal)
   - edges: innere Zweipole zwischen Terminals (Widerstand, Schalterkontakt, Relaisspule ...), type = Art, polar = Richtung zählt,
     ph = Schaltstellung (Wechselschalter: Kontakt 0 ist bei "aus" geschlossen, Kontakt 1 bei "ein"); phase = true: alle ph dürfen
     gemeinsam getauscht werden (welche Stellung "ein" heißt, ist egal)
   - atomic: feste Rollen aller Anschlüsse (Transistor, IC, Arduino ...), keine Umformung erlaubt */
function fixed(npins, groups) {
  const term = [], first = new Map(), g = new Map(); let nt = 0;
  (groups || []).forEach((grp, gi) => grp.forEach(p => g.set(p, gi)));
  for (let p = 0; p < npins; p++) {
    if (g.has(p)) { const gi = g.get(p); if (!first.has(gi)) first.set(gi, nt++); term.push(first.get(gi)); } else term.push(nt++);
  }
  return { nterm: nt, term, edges: [], atomic: true, phase: false };
}
function atomic(npins, groups, term) { const m = fixed(npins, groups); if (term) { m.term = term.slice(); m.nterm = Math.max.apply(null, term) + 1; } return m; }
function mk(npins, groups, edges, o) {
  const m = fixed(npins, groups); m.atomic = false; m.phase = !!(o && o.phase);
  m.edges = edges.map(e => ({ a: m.term[e[0]], b: m.term[e[1]], type: e[2], ph: e[3] || 0, polar: !!e[4] }));
  return m;
}
const two = (type, polar) => mk(2, null, [[0, 1, type, 0, polar]]);
const PI_GND = [5, 8, 13, 19, 24, 29, 33, 38];   // Pins 6, 9, 14, 20, 25, 30, 34, 39 der 40-poligen Leiste

/* LochLab (layout.html PARTS): Pinreihenfolge wie localPins() */
function lochModel(p) {
  const k = p.k, n = p.npins | 0, vr = String(p.vr || ''), v = String(p.v || '');
  switch (k) {
    case 'R': case 'LDR': case 'NTC': case 'PTC': case 'LAMP': case 'FUSE': case 'C': case 'CF': case 'L': case 'SPK': case 'BZ': case 'Q': case 'VDR': return two(k, false);
    case 'SIG': return two(k, false);                        // Wechselspannungsquelle: Tausch = Phasendrehung um 180°, elektrisch gleichwertig
    case 'LED': case 'D': case 'CE': case 'BAT': case 'PHT': return two(k, true);
    case 'SW': return n === 4 ? mk(4, [[0, 2], [1, 3]], [[0, 1, 'SW']]) : two('SW', false);
    case 'SCH': return n === 6 ? mk(6, null, [[1, 0, 'SCH', 0], [1, 2, 'SCH', 1], [4, 3, 'SCH', 0], [4, 5, 'SCH', 1]], { phase: true })
      : mk(3, null, [[1, 0, 'SCH', 0], [1, 2, 'SCH', 1]], { phase: true });
    case 'P': case 'TP': return mk(3, null, [[1, 0, 'P'], [1, 2, 'P']]);
    case 'RLY': return mk(5, null, [[0, 1, 'COIL'], [2, 3, 'NO'], [2, 4, 'NC']]);
    case 'TRF': return mk(4, null, [[0, 1, 'PRIM'], [2, 3, 'SEC']]);
    case 'DUOLED': return /^A/i.test(v) ? mk(3, null, [[1, 0, 'LEDr', 0, true], [1, 2, 'LEDg', 0, true]]) : mk(3, null, [[0, 1, 'LEDr', 0, true], [2, 1, 'LEDg', 0, true]]);
    case 'OPTO': return mk(4, null, [[0, 1, 'LED', 0, true], [3, 2, 'PHT', 0, true]]);
    case 'DSW': { const e = []; for (let i = 0; i < n / 2; i++) e.push([i, n - 1 - i, 'DSW']); return mk(n, null, e); }
    case 'T': return atomic(3, null, /ebc$/.test(vr) ? [2, 1, 0] : [0, 1, 2]);   // Terminals immer C, B, E
    case 'UNO': return atomic(n, [[3, 23, 24]]);             // GND oben und zweimal unten
    case 'NANO': return atomic(n, [[3, 16]]);
    case 'PI': return atomic(n, [PI_GND, [0, 16], [1, 3]]);  // GND, 3V3 (Pin 1, 17), 5V (Pin 2, 4)
    default: return atomic(n);                               // FET, U, THY, TRIAC, GL, IC, SOCK, SEG7, SIP, BU, KL, KL5, PIN ...
  }
}
function lochSig(p) {
  const k = p.k, vr = String(p.vr || ''); let x = '';
  if (k === 'T') x = /^pnp/.test(vr) ? 'pnp' : 'npn';
  else if (k === 'FET') x = /^p/.test(vr) ? 'p' : 'n';
  else if (k === 'IC' || k === 'SOCK' || k === 'DSW' || k === 'SCH' || k === 'SIP' || k === 'BU' || k === 'KL' || k === 'KL5') x = String(p.npins | 0);   // Taster (SW): 2 oder 4 Beine sind dieselben zwei Anschlüsse
  else if (k === 'D' || k === 'SIG' || k === 'DUOLED' || k === 'SEG7') x = vr;
  return k + '|' + normV(p.v) + '|' + x;
}

/* SchaltLab/SimLab (schaltplan.js KINDS): Pinreihenfolge wie KINDS[k].pins */
function schModel(p) {
  const k = p.k, n = p.npins | 0, v = String(p.v || '');
  switch (k) {
    case 'R': case 'C': case 'L': case 'LDR': case 'FUSE': case 'NTC': case 'PTC': case 'SPK': case 'XTAL': case 'DIAC': case 'VDR': case 'CABLE': case 'FAULT':
    case 'SPST': case 'PB': case 'PBC': case 'LSS': case 'VM': case 'AM': case 'OHM': case 'ISO': case 'ZS': return two(k, false);
    case 'AC': return two(k, false);
    case 'LAMP': case 'HEAT': return n === 3 ? mk(3, null, [[0, 1, k]]) : two(k, false);   // 230-V-Lampe: dritter Pin ist PE
    case 'D': case 'ZD': case 'LED': case 'SCHOTTKY': case 'CE': case 'BAT': case 'PHT': case 'MOTOR': case 'CLK': return two(k, true);
    case 'POT': return mk(3, null, [[2, 0, 'P'], [2, 1, 'P']]);                         // Pins: Anfang, Ende, Schleifer
    case 'SPDT': return mk(3, null, [[0, 1, 'SCH', 0], [0, 2, 'SCH', 1]], { phase: true });   // Pins: COM, Kontakt 1, Kontakt 2
    case 'RLY': return mk(5, null, [[0, 1, 'COIL'], [2, 3, 'NO'], [2, 4, 'NC']]);
    case 'TRF': return mk(4, null, [[0, 1, 'PRIM'], [2, 3, 'SEC']]);
    case 'BRUECKE': return mk(4, null, [[0, 2, 'D', 0, true], [1, 2, 'D', 0, true], [3, 0, 'D', 0, true], [3, 1, 'D', 0, true]]);   // ~, ~, +, -
    case 'DUOLED': return /^A/i.test(v) ? mk(3, null, [[1, 0, 'LEDr', 0, true], [1, 2, 'LEDg', 0, true]]) : mk(3, null, [[0, 1, 'LEDr', 0, true], [2, 1, 'LEDg', 0, true]]);
    case 'OPTO': return mk(4, null, [[0, 1, 'LED', 0, true], [2, 3, 'PHT', 0, true]]);
    case 'JUN5': return atomic(n, [[0, 1, 2, 3, 4]]);
    case 'UNO': return atomic(n, [[3, 24]]);
    case 'PI': return atomic(n, [PI_GND, [0, 16], [1, 3]]);
    default: return atomic(n);   // GND, NPN, PNP, NMOS, PMOS, THY, TRIAC, REG, ICX, Gatter, Flipflops, OPA, Sensoren, NETZ, RCD, SCHUETZ, IMP, KREUZ, SD ...
  }
}
function schSig(p) {
  const k = p.k, vr = String(p.vr || ''); let x = '';
  if (k === 'ICX' || k === 'CPU' || k === 'SEG8' || k === 'SEG8D' || k === 'DUOLED' || k === 'RGBLED' || k === 'AC') x = vr;
  if (k === 'ICX' || k === 'CPU') x += '|' + (p.n | 0);
  return k + '|' + normV(p.v) + '|' + x;
}
function normV(v) { return String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, '').replace(/µ/g, 'u').replace(/,/g, '.'); }

/* ============ Netzliste -> Terminal-Partition ============ */
function prepare(nl, modelFn, sigFn, onlyIds) {
  const parts = new Map();
  nl.parts.forEach(p => { if (onlyIds && !onlyIds.has(p.id)) return; parts.set(p.id, { id: p.id, p, m: modelFn(p), sig: sigFn(p) }); });
  const par = new Map();
  const find = k => { if (!par.has(k)) par.set(k, k); let r = k; while (par.get(r) !== r) r = par.get(r); let c = k; while (par.get(c) !== r) { const nx = par.get(c); par.set(c, r); c = nx; } return r; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) par.set(ra, rb); };
  parts.forEach(P => { for (let t = 0; t < P.m.nterm; t++) find(KEY(P.id, t)); });
  (nl.nets || []).forEach(ks => {
    let first = null;
    ks.forEach(k => { const sp = String(k).split('.'), P = parts.get(+sp[0]); if (!P) return; const t = P.m.term[+sp[1]]; if (t == null) return; const tk = KEY(P.id, t); if (first === null) first = tk; else union(first, tk); });
  });
  const idx = new Map(), nets = [];
  parts.forEach(P => { for (let t = 0; t < P.m.nterm; t++) { const r = find(KEY(P.id, t)); if (!idx.has(r)) { idx.set(r, nets.length); nets.push([]); } nets[idx.get(r)].push(KEY(P.id, t)); } });
  const netIdx = new Map(); nets.forEach((ks, i) => ks.forEach(k => netIdx.set(k, i)));
  return { parts, nets, netIdx };
}
const partOfKey = k => +String(k).split('.')[0];
const termOfKey = k => +String(k).split('.')[1];

/* ============ Struktur: feste Teile, Mehrpol-Teile mit Symmetrien, Reihenketten ============ */
function permutations(n) {
  const out = [], a = []; for (let i = 0; i < n; i++) a.push(i);
  const rec = (k) => { if (k === n) { out.push(a.slice()); return; } for (let i = k; i < n; i++) { [a[k], a[i]] = [a[i], a[k]]; rec(k + 1); [a[k], a[i]] = [a[i], a[k]]; } };
  rec(0); return out;
}
const edgeKey = e => e.a < e.b ? e.a + '-' + e.b : e.b + '-' + e.a;
function multiPerms(m, F, Eeff) {
  if (m.nterm > 7) return [[...Array(m.nterm).keys()]];
  const out = [];
  permutations(m.nterm).forEach(s => {
    const sF = new Set([...F].map(t => s[t]));
    const target = m.edges.filter(e => !sF.has(e.a) && !sF.has(e.b));
    if (target.length !== Eeff.length) return;
    const phases = m.phase ? [0, 1] : [0];
    const okFlip = phases.some(fl => {
      const used = new Set();
      return Eeff.every(e => {
        const a = s[e.a], b = s[e.b];
        const j = target.findIndex((t, i) => !used.has(i) && t.type === e.type && (!m.phase || t.ph === (e.ph ^ fl)) && (e.polar ? (t.a === a && t.b === b) : ((t.a === a && t.b === b) || (t.a === b && t.b === a))));
        if (j < 0) return false; used.add(j); return true;
      });
    });
    if (okFlip) out.push(s);
  });
  const id = out.findIndex(s => s.every((x, i) => x === i)); if (id > 0) { const s = out.splice(id, 1)[0]; out.unshift(s); }
  return out;
}
function analyze(S, opts) {
  const floating = k => S.nets[S.netIdx.get(k)].length === 1;
  const multis = [], elems = [], fixedP = [];
  S.parts.forEach(P => {
    const F = new Set(); for (let t = 0; t < P.m.nterm; t++) if (floating(KEY(P.id, t))) F.add(t);
    const Eeff = P.m.edges.filter(e => !F.has(e.a) && !F.has(e.b));
    P.F = F; P.Eeff = Eeff;
    if (P.m.atomic || !Eeff.length) { P.role = 'fixed'; fixedP.push(P); }
    else if (Eeff.length === 1) { P.role = 'elem'; P.edge = Eeff[0]; elems.push(P); }
    else { P.role = 'multi'; P.perms = multiPerms(P.m, F, Eeff); multis.push(P); }
  });
  // Ketten
  const owner = new Map(), at = new Map();
  elems.forEach(E => { ['a', 'b'].forEach(side => { const k = KEY(E.id, E.edge[side]), ni = S.netIdx.get(k); owner.set(k, E); if (!at.has(ni)) at.set(ni, []); at.get(ni).push({ E, side }); }); });
  const internal = ni => { const ks = S.nets[ni]; return ks.length === 2 && owner.has(ks[0]) && owner.has(ks[1]) && owner.get(ks[0]) !== owner.get(ks[1]); };
  const seen = new Set(), chains = [];
  const walk = (E0, side0, ring) => {
    const members = []; let E = E0, side = side0, b = null;
    for (let guard = 0; guard < 1000; guard++) {
      seen.add(E.id); members.push({ P: E, o: side === 'a' ? 1 : -1 });
      const exitT = side === 'a' ? E.edge.b : E.edge.a, ni = S.netIdx.get(KEY(E.id, exitT));
      if (!internal(ni)) { b = ni; break; }
      const nx = at.get(ni).find(x => x.E !== E);
      if (nx.E === E0) break;   // Ring geschlossen
      E = nx.E; side = nx.side;
    }
    return { a: ring ? null : S.netIdx.get(KEY(E0.id, E0.edge[side0])), b: ring ? null : b, members };
  };
  elems.forEach(E => {
    if (seen.has(E.id)) return;
    const na = S.netIdx.get(KEY(E.id, E.edge.a)), nb = S.netIdx.get(KEY(E.id, E.edge.b));
    if (!internal(na)) chains.push(walk(E, 'a', false)); else if (!internal(nb)) chains.push(walk(E, 'b', false));
  });
  elems.forEach(E => { if (!seen.has(E.id)) chains.push(walk(E, 'a', true)); });
  // Platzierungen je Kettenglied: Terminalpaar [zur Seite a, zur Seite b]
  chains.forEach(ch => {
    ch.members.forEach(mb => {
      const E = mb.P, e = E.edge, own = mb.o > 0 ? [e.a, e.b] : [e.b, e.a];
      const pl = [];
      E.m.edges.filter(c => c.type === e.type).forEach(c => {
        if (e.polar) pl.push(mb.o > 0 ? [c.a, c.b] : [c.b, c.a]); else { pl.push([c.a, c.b]); pl.push([c.b, c.a]); }
      });
      const i0 = pl.findIndex(x => x[0] === own[0] && x[1] === own[1]);
      if (i0 > 0) { const x = pl.splice(i0, 1)[0]; pl.unshift(x); } else if (i0 < 0) pl.unshift(own);
      mb.pl = pl;
    });
    ch.orders = (opts && opts.keepOrder) ? [[...Array(ch.members.length).keys()]] : permutations(ch.members.length);
  });
  // feste Anschlüsse je Netz: alles außer den Kontakten der Kettenglieder (ihre Kettenkontakte und ihre freien Anschlüsse werden neu vergeben)
  const chainKeys = new Set(); chains.forEach(ch => ch.members.forEach(mb => { const P = mb.P; for (let t = 0; t < P.m.nterm; t++) if (t === P.edge.a || t === P.edge.b || P.F.has(t)) chainKeys.add(KEY(P.id, t)); }));
  const base = S.nets.map(ks => ks.filter(k => !chainKeys.has(k)));
  // gleiche Bauteile
  const bySig = new Map(); S.parts.forEach(P => { if (!bySig.has(P.sig)) bySig.set(P.sig, []); bySig.get(P.sig).push(P.id); });
  const classes = [...bySig.values()].filter(a => a.length > 1 && a.length <= 5).map(ids => ({ ids, perms: permutations(ids.length) }));
  return { S, multis, chains, base, classes, fixedP };
}

/* ============ Varianten aufzählen und mit der Platine vergleichen ============ */
function evaluate(Q, M, opts, sepNet, polar) {
  // Q: Netze der Variante als Listen von Platinen-Schlüsseln (id.term); M: Partition der Platine; polar: gepolte Zweipole [{ id, ka, kb }]
  const lines = [], used = new Map(), swap = new Map(), swapName = new Map();
  const name = k => opts.keyName(swapName.has(k) ? swapName.get(k) : k), lt = ks => ks.slice(0, 3).map(name).join(', ') + (ks.length > 3 ? ' …' : '');
  let okN = 0, bad = 0;
  const idxOf0 = k => { const i = M.netIdx.get(k); return i == null ? 'x' + k : i; };
  // Verpoltes Zweipol-Teil: Beide Anschlüsse liegen genau am jeweils anderen Netz. Das wird als EIN Fehler "verpolt" gemeldet,
  // die zwei Netze gelten dabei als verbunden (sonst gäbe es zwei "fehlt"-Zeilen und einen "Kurzschluss", die in die Irre führen).
  // In den Zeilen heißen die beiden Anschlüsse so, wie sie auf der Platine wirklich liegen.
  const qOf = new Map(); Q.forEach((ks, qi) => ks.forEach(k => qOf.set(k, qi)));
  (polar || []).forEach(P => {
    const qa = qOf.get(P.ka), qb = qOf.get(P.kb); if (qa == null || qb == null || qa === qb) return;
    const oa = Q[qa].filter(k => k !== P.ka), ob = Q[qb].filter(k => k !== P.kb); if (!oa.length || !ob.length) return;
    const ma = new Set(oa.map(idxOf0)), mb = new Set(ob.map(idxOf0)); if (ma.size !== 1 || mb.size !== 1) return;
    const m1 = [...ma][0], m2 = [...mb][0]; if (m1 === m2) return;
    if (idxOf0(P.kb) === m1 && idxOf0(P.ka) === m2) { swap.set(P.ka, m1); swap.set(P.kb, m2); swapName.set(P.ka, P.kb); swapName.set(P.kb, P.ka); bad++; lines.push({ ok: false, kind: 'polar', text: 'Verpolt: ' + opts.partName(P.id) + ' sitzt falsch herum, die beiden Anschlüsse sind vertauscht.' }); }
  });
  const idxOf = k => (swap.has(k) ? swap.get(k) : idxOf0(k));
  Q.forEach((ks, qi) => {
    if (!ks.length) return;   // Netz bestand nur aus Kettenkontakten, die jetzt woanders liegen
    if (ks.length < 2) { const mi = idxOf(ks[0]); if (!used.has(mi)) used.set(mi, []); used.get(mi).push(qi); return; }
    const groups = new Map(); ks.forEach(k => { const mi = idxOf(k); if (!groups.has(mi)) groups.set(mi, []); groups.get(mi).push(k); });
    groups.forEach((_, mi) => { if (!used.has(mi)) used.set(mi, []); used.get(mi).push(qi); });
    if (groups.size <= 1) { okN++; lines.push(qi === sepNet ? { ok: true, kind: 'sep', text: 'Getrennter Stromkreis: ' + lt(ks) + ' liegen zusammen und haben keine Verbindung zur übrigen Masse. Das ist ebenfalls richtig.' } : { ok: true, kind: 'net', text: 'Verbunden: ' + lt(ks) }); }
    else { bad++; const gs = [...groups.values()].sort((x, y) => y.length - x.length); lines.push({ ok: false, kind: 'missing', text: 'Es fehlt eine Verbindung: ' + lt(gs[0]) + ' ist nicht mit ' + lt(gs[1]) + ' verbunden.' }); }
  });
  const seenPair = new Set();
  used.forEach(qis => {
    if (qis.length < 2) return;
    const multi = qis.filter(q => Q[q].length > 1), single = qis.filter(q => Q[q].length < 2);
    const pk = qis.slice(0, 2).join(','); if (seenPair.has(pk)) return; seenPair.add(pk);
    bad++;
    if (multi.length >= 2) lines.push({ ok: false, kind: 'short', text: 'Kurzschluss: ' + lt(Q[multi[0]]) + ' ist mit ' + lt(Q[multi[1]]) + ' verbunden. Das gehört nicht zusammen.' });
    else if (multi.length === 1) lines.push({ ok: false, kind: 'extra', text: 'Zu viel verbunden: ' + name(Q[single[0]][0]) + ' soll frei bleiben, hängt aber an ' + lt(Q[multi[0]]) + '.' });
    else lines.push({ ok: false, kind: 'extra', text: 'Zu viel verbunden: ' + name(Q[single[0]][0]) + ' und ' + name(Q[single[1]][0]) + ' sollen beide frei bleiben, sind aber verbunden.' });
  });
  return { lines, okN, bad };
}
const better = (a, b) => !b || a.bad < b.bad || (a.bad === b.bad && a.okN > b.okN);

function enumerate(A, M, opts, sepNet) {
  const { S, multis, chains, base, classes } = A;
  let count = 0, best = null, capped = false, stop = false;
  const sigma = new Map(), pi = new Map();
  const chainCfg = chains.map(() => ({ order: null, pl: null }));
  const build = () => {
    const nets = base.map(ks => ks.slice());
    const relabel = k => { const id = partOfKey(k), t = termOfKey(k), s = sigma.get(id); return KEY(pi.has(id) ? pi.get(id) : id, s ? s[t] : t); };
    chains.forEach((ch, ci) => {
      const cfg = chainCfg[ci], mem = cfg.order.map(i => ch.members[i]), pls = cfg.pl;
      const kA = (j) => KEY(mem[j].P.id, pls[j][0]), kB = (j) => KEY(mem[j].P.id, pls[j][1]);
      if (ch.a == null) { for (let j = 0; j < mem.length; j++) nets.push([kB(j), kA((j + 1) % mem.length)]); }
      else {
        nets[ch.a].push(kA(0));
        for (let j = 0; j + 1 < mem.length; j++) nets.push([kB(j), kA(j + 1)]);
        nets[ch.b].push(kB(mem.length - 1));
      }
    });
    const inNet = new Set(); nets.forEach(ks => ks.forEach(k => inNet.add(k)));
    S.parts.forEach(P => { for (let t = 0; t < P.m.nterm; t++) { const k = KEY(P.id, t); if (!inNet.has(k)) nets.push([k]); } });
    return nets.map(ks => ks.map(relabel));
  };
  const idOf = (arr) => arr.every((x, i) => x === i);
  const state = { ident: true };
  const visit = () => {
    if (stop) return;
    if (count >= CAP) { capped = true; stop = true; return; }
    count++;
    const polar = []; S.parts.forEach(P => { if (P.role === 'elem' && P.edge.polar && P.m.nterm === 2) { const id = pi.has(P.id) ? pi.get(P.id) : P.id; polar.push({ id, ka: KEY(id, P.edge.a), kb: KEY(id, P.edge.b) }); } });
    const Q = build(), r = evaluate(Q, M, opts, sepNet, polar);
    r.ident = state.ident; r.sep = sepNet != null;
    if (better(r, best)) best = r;
    if (r.bad === 0) stop = true;
  };
  // Rekursion über Wahlgruppen: Klassen-Permutationen, Mehrpol-Symmetrien, Kettenreihenfolgen und -platzierungen
  const recClass = (ci, identSoFar) => {
    if (ci === classes.length) { recMulti(0, identSoFar); return; }
    const c = classes[ci];
    for (const pm of c.perms) { if (stop) return; c.ids.forEach((id, i) => pi.set(id, c.ids[pm[i]])); recClass(ci + 1, identSoFar && idOf(pm)); }
  };
  const recMulti = (mi, identSoFar) => {
    if (mi === multis.length) { recChain(0, identSoFar); return; }
    const P = multis[mi];
    for (const s of P.perms) { if (stop) return; sigma.set(P.id, s); recMulti(mi + 1, identSoFar && idOf(s)); }
  };
  const recChain = (ci, identSoFar) => {
    if (ci === chains.length) { state.ident = identSoFar; visit(); return; }
    const ch = chains[ci], cfg = chainCfg[ci];
    for (const ord of ch.orders) {
      if (stop) return;
      cfg.order = ord; const mem = ord.map(i => ch.members[i]); cfg.pl = new Array(mem.length);
      const recPl = (j, idp) => {
        if (stop) return;
        if (j === mem.length) { recChain(ci + 1, identSoFar && idOf(ord) && idp); return; }
        mem[j].pl.forEach((pl, pi2) => { cfg.pl[j] = pl; recPl(j + 1, idp && pi2 === 0); });
      };
      recPl(0, true);
    }
  };
  recClass(0, true);
  return { best, count, capped };
}

/* ============ Hauptfunktion ============ */
function compare(sol, mine, opts) {
  opts = opts || {};
  const modelFn = opts.model || lochModel, sigFn = opts.sig || lochSig;
  const optional = new Set(opts.optional || []);
  const partName = opts.partName || (id => 'Bauteil ' + id);
  const lines = [];
  const mineById = new Map(); mine.parts.forEach(p => mineById.set(p.id, p));
  const missing = [], changed = [], W = new Set();
  sol.parts.forEach(p => {
    const q = mineById.get(p.id);
    if (!q) { if (!optional.has(p.id)) missing.push(p.id); return; }
    if (sigFn(q) !== sigFn(p)) { changed.push(p.id); return; }
    W.add(p.id);
  });
  if (missing.length) lines.push({ ok: false, kind: 'part', text: 'Bauteil fehlt oder wurde ersetzt: ' + missing.map(partName).join(', ') + '. Lass die vorgegebenen Bauteile auf der Platine.' });
  if (changed.length) lines.push({ ok: false, kind: 'part', text: 'Bauteil verändert: ' + changed.map(partName).join(', ') + '. Lass Art und Wert der vorgegebenen Bauteile, wie sie sind.' });
  const S = prepare(sol, modelFn, sigFn, W), M = prepare(mine, modelFn, sigFn, W);
  // Namen in Meldungen: Terminal -> erster Pin des Terminals, dann opts.pinName(id, pin) (sonst "Bauteil Anschluss n")
  const pinName = opts.pinName || ((id, pin) => partName(id) + ' Anschluss ' + (pin + 1));
  const keyName = k => { const id = partOfKey(k), t = termOfKey(k), P = M.parts.get(id) || S.parts.get(id), pin = P ? P.m.term.indexOf(t) : -1; return pinName(id, pin < 0 ? t : pin); };
  const o2 = Object.assign({}, opts, { keyName, partName });
  // Basisvarianten: Musterlösung und erlaubte Trennungen (sepOk: Anschlüsse, die zusammen getrennt von ihrem Netz liegen dürfen)
  const bases = [{ S, sepNet: null }];
  const toTerm = k => { const P = S.parts.get(partOfKey(k)); return P ? KEY(P.id, P.m.term[termOfKey(k)]) : null; };
  (opts.sepOk || []).forEach(sp => {
    const tk = sp.map(toTerm).filter(Boolean); if (tk.length !== sp.length) return;
    const ni = S.netIdx.get(tk[0]); if (ni == null || !tk.every(k => S.netIdx.get(k) === ni)) return;
    const net = S.nets[ni], rest = net.filter(k => !tk.includes(k)); if (!rest.length) return;
    const nets = S.nets.map((ks, i) => i === ni ? rest : ks.slice()); nets.push(tk.slice());
    const netIdx = new Map(); nets.forEach((ks, i) => ks.forEach(k => netIdx.set(k, i)));
    const parts = new Map(); S.parts.forEach((P, id) => parts.set(id, { id, p: P.p, m: P.m, sig: P.sig }));
    bases.push({ S: { parts, nets, netIdx }, sepNet: nets.length - 1 });
  });
  let best = null, count = 0, capped = false;
  for (const b of bases) {
    const r = enumerate(analyze(b.S, o2), M, o2, b.sepNet);
    count += r.count; capped = capped || r.capped;
    if (r.best && better(r.best, best)) best = r.best;
    if (best && best.bad === 0 && !b.sepNet) break;
  }
  if (best) best.lines.forEach(l => lines.push(l));
  const ok = lines.length > 0 && lines.every(l => l.ok);
  const differs = !!(best && !best.ident);
  if (ok && differs) lines.push({ ok: true, kind: 'info', text: 'Anders verdrahtet als in der Musterlösung, aber elektrisch gleichwertig.' });
  const good = lines.filter(l => l.ok).length;
  return { ok, lines, pct: Math.round(100 * good / Math.max(lines.length, 1)), differs, sep: !!(best && best.sep && best.bad === 0), count, capped, missing, changed };
}

/* Hilfe für Tests: strenger Vergleich (Partition der Lösung muss der Platine genau gleichen) */
function same(sol, mine, opts) {
  opts = opts || {};
  const S = prepare(sol, opts.model || lochModel, opts.sig || lochSig), M = prepare(mine, opts.model || lochModel, opts.sig || lochSig);
  const can = X => X.nets.map(ks => ks.slice().sort().join(' ')).sort().join('|');
  return can(S) === can(M);
}

const api = { compare, same, prepare, analyze, lochModel, lochSig, schModel, schSig, normV, CAP };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.NetEquiv = api;
})(typeof window !== 'undefined' ? window : globalThis);
