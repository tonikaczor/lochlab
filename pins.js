/* Tonfunk Pin-Anzeige: Anschlussbezeichnungen an den Bauteilen (Stromlaufplan und Lochrasterplan). Rein optisch.
   EINE Quelle fuer alle Labs: Tabellen der Anschlussnamen (SCH = Bauteilarten des Stromlaufplans in der Reihenfolge von KINDS.pins,
   loch() = Bauteile des LochLab in der Reihenfolge von localPins), die Platzierung ohne Ueberlappung (layout) und das Zeichnen (paint).
   IC-Anschlussnamen kommen aus simics.js (LochSimICs.CATALOG[..].labels), nicht aus Kopien.
   Eintrag: { n: kurzer Name, x: Zusatzwort (nur wenn Platz ist), d: [dx,dy] Richtung der Beschriftung (lokal, wird mitgedreht) }.
   Tabelle ist { sym:true }, wenn das Symbol seine Anschluesse selbst beschriftet (dann keine zweite Beschriftung). */
(function (root) {
'use strict';
const KEY = 'lm4.pins';
let flag = null;
function readFlag() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
const on = () => { if (flag === null) flag = readFlag(); return flag; };
function set(v) { flag = !!v; try { localStorage.setItem(KEY, flag ? '1' : '0'); } catch (e) { /* ohne Speicher: gilt nur bis zum Neuladen */ } }

const E = (n, x, d) => { const o = { n }; if (x) o.x = x; if (d) o.d = d; return o; };
const MINUS = '−';
const num = n => Array.from({ length: n }, (_, i) => E(String(i + 1)));
const SYM = { sym: true };
const T2 = [E('1'), E('2')];
const DIODE = [E('A', 'Anode'), E('K', 'Kathode')];
const GATE2 = [E('A'), E('B'), E('Y', 'Ausgang')];
const GATE1 = [E('A'), E('Y', 'Ausgang')];
const BIP = [E('B', 'Basis'), E('C', 'Kollektor'), E('E', 'Emitter')];
const FET = [E('G', 'Gate'), E('D', 'Drain'), E('S', 'Source')];
const PM = [E('+'), E(MINUS)];
const AC2 = (a, b) => [E(a), E(b)];

/* Stromlaufplan: Reihenfolge wie KINDS[..].pins der Engine (schaltplan.js). Ein Eintrag je Bauteilart (auch dynamische Pins ueber Funktionen). */
const SCH = {
  R: T2, POT: [E('1', 'Anfang'), E('3', 'Ende'), E('2', 'Schleifer')], C: T2,
  CE: [E('+', 'Plus'), E(MINUS, 'Minus')], L: T2, LDR: T2,
  LAMP: p => (/230\s*V/i.test(String(p && p.v || '')) ? [E('1'), E('2'), E('PE', 'Schutzleiter')] : T2),
  D: DIODE, ZD: DIODE, SCHOTTKY: DIODE,
  LED: [E('+', 'Anode'), E(MINUS, 'Kathode')],
  NPN: BIP, PNP: BIP, BAT: [E('+', 'Plus'), E(MINUS, 'Minus')], AC: [E('+'), E(MINUS)], GND: SYM,
  SPST: T2, PB: T2, PBC: T2,
  SPDT: [E('COM', 'Mitte'), E('NC', 'Öffner'), E('NO', 'Schließer')],
  CABLE: T2, FUSE: T2, NTC: T2, PTC: T2, MOTOR: T2, SPK: T2,
  TRF: [E('P1', 'Primär'), E('P2', 'Primär'), E('S1', 'Sekundär'), E('S2', 'Sekundär')],
  RLY: [E('A1', 'Spule'), E('A2', 'Spule'), E('COM', 'Mitte', [0, -1]), E('NO', 'Schließer'), E('NC', 'Öffner')],
  NMOS: FET, PMOS: FET, DIAC: T2,
  TRIAC: [E('MT1'), E('MT2'), E('G', 'Gate')], VDR: T2,
  SEG8D: p => { const a = p && p.vr === 'a', k = a ? 'A' : 'K'; return ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'].map(s => E(s)).concat([E(k + '1', 'gem. ' + (a ? 'Anode' : 'Kathode')), E(k + '2', 'gem. ' + (a ? 'Anode' : 'Kathode'))]); },
  SEG8: p => { const a = p && p.vr === 'a'; return ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'].map(s => E(s)).concat([E(a ? 'A' : 'K', 'gem. ' + (a ? 'Anode' : 'Kathode'))]); },
  THY: [E('A', 'Anode'), E('K', 'Kathode'), E('G', 'Gate')],
  PHT: [E('C', 'Kollektor'), E('E', 'Emitter')],
  OPTO: [E('A', 'Anode'), E('K', 'Kathode'), E('C', 'Kollektor'), E('E', 'Emitter')],
  NETZ: [E('L', 'Außenleiter'), E('N', 'Neutralleiter'), E('PE', 'Schutzleiter')],
  LSS: T2,
  RCD4: [E('L1'), E('L2'), E('L3'), E('N'), E("L1'"), E("L2'"), E("L3'"), E("N'")],
  RCD: [E('L'), E('N'), E("L'"), E("N'")],
  SCHUETZ: [E('A1', 'Spule'), E('A2', 'Spule'), E('K1a'), E('K1b'), E('K2a'), E('K2b'), E('K3a'), E('K3b'), E('K4a'), E('K4b')],
  UNO: SYM, I2CTEMP: SYM, I2CLUX: SYM, MCP3008: SYM, PI: SYM, TMP36: SYM, HCSR04: SYM, SERVO: SYM, LCDI2C: SYM, NETZ3: SYM, ICX: SYM, CPU: SYM,
  DFF: SYM, JKFF: SYM, TFF: SYM,
  DUOLED: p => [E('R', 'rot'), E('COM', /^A/i.test(String(p && p.v || '')) ? 'gem. Anode' : 'gem. Kathode'), E('G', 'grün')],
  RGBLED: p => [E('R'), E('G'), E('B'), E('COM', /^A/i.test(String(p && p.v || '')) ? 'gem. Anode' : 'gem. Kathode')],
  PIEZO: PM, TOUCH: [E('1', 'Fläche')],
  PIR: [E('VCC'), E('OUT', 'Ausgang'), E('GND')],
  MOTOR3: [E('U'), E('V'), E('W'), E('PE', 'Schutzleiter')],
  BRUECKE: [E('AC1', '~'), E('AC2', '~'), E('+'), E(MINUS)],
  REG: [E('IN', 'Eingang'), E('GND', 'Masse'), E('OUT', 'Ausgang')],
  XTAL: T2, KREUZ: num(4),
  IMP: [E('A1', 'Spule'), E('A2', 'Spule'), E('K1', 'Kontakt'), E('K2', 'Kontakt')],
  HEAT: [E('1'), E('2'), E('PE', 'Schutzleiter')], SD: [E('L'), E('N'), E('PE', 'Schutzleiter')], JUN5: num(5), FAULT: T2,
  AND: GATE2, NAND: GATE2, OR: GATE2, NOR: GATE2, XOR: GATE2, NOT: GATE1, SNOT: GATE1,
  OPA: [E('+', 'nicht invertierend'), E(MINUS, 'invertierend'), E('OUT', 'Ausgang'), E('V+'), E('V' + MINUS)],
  VM: PM, AM: PM, OHM: T2, ISO: T2, ZS: T2, CLK: PM
};

/* LochLab: Anschlussnamen je Bauteil in der Reihenfolge von localPins (layout.html). it = { k, n, vr, v }.
   Die Belegungen stammen aus den Hilfetexten (HINTS) und Varianten des LochLab. */
function seg7(it) {
  const a = it.vr === 'ma' || it.vr === 'ka', nm = ['E', 'D', 'gem.', 'C', 'DP', 'B', 'A', 'F', 'G'];
  if (it.vr === 'dk') return num(18);                      // Doppelanzeige (18 Pins): nur Nummern
  nm.splice(7, 0, 'gem.');
  return nm.map((s, i) => (s === 'gem.' ? E((i + 1) + ' ' + (a ? 'A' : 'K'), 'gem. ' + (a ? 'Anode' : 'Kathode')) : E((i + 1) + ' ' + s)));
}
function lochTable(it, LI) {
  const k = it.k, n = it.n | 0;
  switch (k) {
    case 'R': case 'C': case 'CF': case 'L': case 'LDR': case 'NTC': case 'PTC': case 'PHT': case 'SPK': case 'VDR': case 'FUSE': case 'Q': case 'LAMP': return T2;
    case 'D': return it.vr === 'diac' ? T2 : [E('A', 'Anode'), E('K', 'Kathode (Ring)')];
    case 'CE': return [E('+', 'Plus (längerer Draht)'), E(MINUS, 'Minus (Streifen)')];
    case 'LED': return [E('+', 'Anode (langer Draht)'), E(MINUS, 'Kathode (Abflachung)')];
    case 'BZ': return [E('+'), E(MINUS)];
    case 'BAT': return [E('+', 'Plus'), E(MINUS, 'Minus')];
    case 'SIG': return T2;
    case 'RLY': return [E('A1', 'Spule'), E('A2', 'Spule'), E('COM', 'Mitte'), E('NO', 'Schließer'), E('NC', 'Öffner')];
    case 'THY': return [E('K', 'Kathode'), E('A', 'Anode'), E('G', 'Gate')];
    case 'FET': return FET;
    case 'TRIAC': return [E('MT1'), E('MT2'), E('G', 'Gate')];
    case 'OPTO': return [E('A', 'Anode'), E('K', 'Kathode'), E('E', 'Emitter'), E('C', 'Kollektor')];
    case 'TRF': return [E('P1', 'Primär'), E('P2', 'Primär'), E('S1', 'Sekundär'), E('S2', 'Sekundär')];
    case 'T': return /ebc$/.test(String(it.vr || '')) ? [E('E', 'Emitter'), E('B', 'Basis'), E('C', 'Kollektor')] : [E('C', 'Kollektor'), E('B', 'Basis'), E('E', 'Emitter')];
    case 'U': return [E('IN', 'Eingang'), E('GND', 'Masse'), E('OUT', 'Ausgang')];
    case 'P': case 'TP': return [E('1', 'Anfang'), E('2', 'Schleifer'), E('3', 'Ende')];
    case 'SW': return num(n === 2 || it.vr === 'k2' ? 2 : 4);
    case 'SCH': return it.vr === 'k6' ? num(6) : [E('1'), E('COM', 'Mitte'), E('2')];
    case 'GL': return num(4);
    case 'PIN': return [E('TP', 'Lötstift')];
    case 'SEG7': return seg7(it);
    case 'IC': case 'SOCK': case 'DSW': {
      const h = n / 2, out = [];
      for (let i = 0; i < n; i++) out.push(E(String(i + 1), '', i < h ? [0, -1] : [0, 1]));   // Zahl zwischen den Reihen; Reihe unten: Pin 1..h, oben: Rest
      return out;
    }
    case 'SIP': case 'BU': case 'KL': case 'KL5': return num(n);
    case 'DUOLED': case 'NANO': case 'UNO': case 'PI': return SYM;       // das Bauteil beschriftet seine Anschluesse selbst
    default: return null;
  }
}
/* Bauteilarten des LochLab, die die Tabelle kennt (Test gegen PARTS) */
const LOCH_KINDS = ['R', 'C', 'CF', 'L', 'LDR', 'NTC', 'PTC', 'PHT', 'SPK', 'VDR', 'FUSE', 'Q', 'LAMP', 'D', 'CE', 'LED', 'BZ', 'BAT', 'SIG', 'RLY', 'THY', 'FET', 'TRIAC', 'OPTO', 'TRF', 'T', 'U', 'P', 'TP', 'SW', 'SCH', 'GL', 'PIN', 'SEG7', 'IC', 'SOCK', 'DSW', 'SIP', 'BU', 'KL', 'KL5', 'DUOLED', 'NANO', 'UNO', 'PI'];

function sch(kind, part) {
  const t = SCH[kind]; if (!t) return null;
  const r = typeof t === 'function' ? t(part || {}) : t;
  return Array.isArray(r) ? r : null;                    // null = Symbol beschriftet selbst oder unbekannt
}
function loch(it, LI) {
  const r = lochTable(it, LI || root.LochSimICs);
  return Array.isArray(r) ? r : null;
}

/* ============ Platzierung ohne Ueberlappung ============
   parts: [{ id, pins: [{ x, y, n, x2, d }], box: [x0,y0,x1,y1] (Huellrechteck des Bauteils), solid: [..] | null (darf nicht ueberdeckt werden) }]
   o: { fs (Schrift in Welteinheiten), minfs, meas(text, fs) -> Breite, segs: [[x1,y1,x2,y2]] Leitungen, rects: [[..]] weitere Sperrflaechen }
   Ergebnis: [{ pid, i, text, cx, cy, w, h, fs, ok }] (Mittelpunkt des Textes, ok=false: keine freie Stelle gefunden). */
const approxW = (t, fs) => t.length * fs * 0.6;
function rectFor(mode, ax, ay, w, h) {
  switch (mode) {
    case 'E': return [ax, ay - h / 2, ax + w, ay + h / 2];
    case 'W': return [ax - w, ay - h / 2, ax, ay + h / 2];
    case 'N': return [ax - w / 2, ay - h, ax + w / 2, ay];
    default: return [ax - w / 2, ay, ax + w / 2, ay + h];
  }
}
const hit = (a, b, m) => a[0] < b[2] + m && a[2] > b[0] - m && a[1] < b[3] + m && a[3] > b[1] - m;
function segHit(r, s, m) {                                // Strecke gegen Rechteck (vergroessert um m)
  let x1 = s[0], y1 = s[1], dx = s[2] - s[0], dy = s[3] - s[1], t0 = 0, t1 = 1;
  const P = [-dx, dx, -dy, dy], Q = [x1 - (r[0] - m), (r[2] + m) - x1, y1 - (r[1] - m), (r[3] + m) - y1];
  for (let i = 0; i < 4; i++) {
    if (P[i] === 0) { if (Q[i] < 0) return false; continue; }
    const t = Q[i] / P[i];
    if (P[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}
function cands(P, dir, e) {                                // Kandidaten: [Modus, Ankerx, Ankery]
  const out = [], dx = dir[0], dy = dir[1];
  if (Math.abs(dx) >= Math.abs(dy)) {
    const s = dx < 0 ? -1 : 1, hang = s > 0 ? 'E' : 'W', back = s > 0 ? 'W' : 'E';
    out.push([hang, s * 0.15, -0.75], [hang, s * 0.15, 0.75], [hang, s * 0.6, 0], [back, -s * 0.1, -0.75], [back, -s * 0.1, 0.75], [hang, s * 0.15, -1.6], [hang, s * 0.15, 1.6], [hang, s * 1.4, 0], [back, -s * 0.1, -1.6], [back, -s * 0.1, 1.6]);
  } else {
    const s = dy < 0 ? -1 : 1;
    out.push(['E', 0.55, s * 0.5], ['W', -0.55, s * 0.5], [s < 0 ? 'N' : 'S', 0, s * 0.3], ['E', 0.55, -s * 0.5], ['W', -0.55, -s * 0.5], ['E', 0.55, s * 1.6], ['W', -0.55, s * 1.6], [s < 0 ? 'N' : 'S', 0, s * 1.4], ['E', 0.55, -s * 1.6], ['W', -0.55, -s * 1.6]);
  }
  return out.map(c => [c[0], P.x + c[1] * e, P.y + c[2] * e]);
}
function layout(parts, o) {
  o = o || {};
  const fs0 = o.fs || 12, minfs = o.minfs || fs0 * 0.6, meas = o.meas || approxW, segs = o.segs || [], extra = o.rects || [];
  const placed = [], res = [];
  const free = (r, pid, m, own) => {
    for (const q of placed) if (hit(r, q, m)) return false;
    for (const s of segs) if (segHit(r, s, m * 0.3)) return false;
    for (const q of extra) if (hit(r, q, 0)) return false;
    for (const pp of parts) if (pp.solid && (pp.id !== pid || own) && hit(r, pp.solid, 0)) return false;
    return true;
  };
  parts.forEach(pp => {
    const c = pp.box ? [(pp.box[0] + pp.box[2]) / 2, (pp.box[1] + pp.box[3]) / 2] : [0, 0];
    const pins = pp.pins.map((P, i) => ({ P, i })).filter(q => q.P && q.P.n);
    const hasLong = pins.some(q => q.P.x2);
    // Versuche fuer das ganze Bauteil: erst mit Zusatzwort, dann kurz, dann kleinere Schrift (nie ueberlappen, nie unter minfs)
    const attempts = [];
    if (hasLong) attempts.push([true, 1]);
    attempts.push([false, 1]);
    [0.85, 0.72].forEach(f => attempts.push([false, Math.max(minfs / fs0, f)]));
    let best = null;
    for (let ai = 0; ai < attempts.length; ai++) {
      const [lng, f] = attempts[ai], fs = fs0 * f, h = fs * 1.15, m = fs * 0.12, mine = [], out = [];
      let allOk = true;
      const isFree = r => { for (const q of mine) if (hit(r, q, m)) return false; return free(r, pp.id, m, pp.ownSolid !== false); };
      pins.forEach(({ P, i }) => {
        let dir = P.d;
        if (!dir) { dir = [P.x - c[0], P.y - c[1]]; if (Math.hypot(dir[0], dir[1]) < 1e-6) dir = [0, -1]; }
        const text = lng && P.x2 ? P.n + ' ' + P.x2 : P.n, w = meas(text, fs);
        let got = null, first = null;
        for (const cd of cands(P, dir, fs)) {
          const r = rectFor(cd[0], cd[1], cd[2], w, h);
          if (!first) first = r;
          if (isFree(r)) { got = r; break; }
        }
        const r = got || first; if (!got) allOk = false;
        mine.push(r);
        out.push({ pid: pp.id, i, text, cx: (r[0] + r[2]) / 2, cy: (r[1] + r[3]) / 2, w, h, fs, ok: !!got, px: P.x, py: P.y, r });
      });
      best = out;
      if (allOk) break;
    }
    (best || []).forEach(l => { placed.push(l.r); delete l.r; res.push(l); });
  });
  return res;
}

/* ============ Stromlaufplan: Beschriftungen fuer die ganze Zeichnung ============
   o: { parts, wires, KD(p) -> { box }, pinsOf(p) -> [[x,y]] (Gitter), rot(x,y,r), X, Y, S (Pixel je Gitter), meas, vis(x,y) optional } -> Liste fuer paint (Pixelkoordinaten) */
function schLabels(o) {
  const S = o.S, fs = Math.max(10, Math.min(17, S * 0.5)), parts = [];
  (o.parts || []).forEach(p => {
    const nm = sch(p.k, p); if (!nm) return;
    const wp = o.pinsOf(p), K = o.KD(p);
    if (nm.length !== wp.length) return;
    const b = K.box, cs = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(([a, c]) => { const r = o.rot(a, c, p.r); return [o.X(p.x + r[0]), o.Y(p.y + r[1])]; });
    const xs = cs.map(q => q[0]), ys = cs.map(q => q[1]);
    parts.push({
      id: p.id, box: [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)], ownSolid: false,
      solid: (() => { const m = S * 0.35, x0 = Math.min.apply(null, xs) + m, y0 = Math.min.apply(null, ys) + m, x1 = Math.max.apply(null, xs) - m, y1 = Math.max.apply(null, ys) - m; return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] : null; })(),
      pins: wp.map((q, i) => { const e = nm[i], d = e.d ? o.rot(e.d[0], e.d[1], p.r) : null; return { x: o.X(q[0]), y: o.Y(q[1]), n: e.n, x2: e.x, d }; })
    });
  });
  const segs = (o.wires || []).map(w => [o.X(w.x1), o.Y(w.y1), o.X(w.x2), o.Y(w.y2)]);
  return layout(parts, { fs, minfs: 8, meas: o.meas, segs, rects: o.texts || [] });
}

/* Flaeche, die die Beschriftung nicht ueberdecken soll: bei Pins in einer Reihe (TO-92, Poti ...) der Koerper auf einer Seite der Reihe,
   bei Pins im Rechteck (Relais, Trafo, Taster) das Innere zwischen den Pins */
function solidOf(wp, box) {
  if (!box || !wp.length) return null;
  const xs = wp.map(q => q[0]), ys = wp.map(q => q[1]), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
  if (x1 - x0 < 1e-6 && y1 - y0 < 1e-6) return null;
  if (y1 - y0 < 1e-6) return cy < y0 - 1e-6 ? [box[0], box[1], box[2], y0 - 0.2] : cy > y0 + 1e-6 ? [box[0], y0 + 0.2, box[2], box[3]] : null;
  if (x1 - x0 < 1e-6) return cx < x0 - 1e-6 ? [box[0], box[1], x0 - 0.2, box[3]] : cx > x0 + 1e-6 ? [x0 + 0.2, box[1], box[2], box[3]] : null;
  return x1 - x0 > 0.8 && y1 - y0 > 0.8 ? [x0 + 0.35, y0 + 0.35, x1 - 0.35, y1 - 0.35] : null;
}

/* ============ Lochrasterplan: Beschriftungen (Weltkoordinaten in Rasterlochern) ============
   o: { items, pinsOf(it), bodyRect(it), rot, segs (Draehte/Bahnen), s (Pixel je Loch), meas, LI } */
function lochLabels(o) {
  const s = o.s, fpx = Math.max(9, Math.min(16, s * 0.46)), fs = fpx / s, parts = [];
  (o.items || []).forEach(it => {
    if (it.t !== 'part') return;
    const nm = loch(it, o.LI); if (!nm) return;
    const wp = o.pinsOf(it); if (nm.length !== wp.length) return;
    const br = o.bodyRect(it);
    let box = null;
    if (br) {
      const cs = [[br[0], br[1]], [br[2], br[1]], [br[2], br[3]], [br[0], br[3]]].map(([a, c]) => { const r = o.rot(a, c, it.r); return [it.x + r[0], it.y + r[1]]; });
      box = [Math.min.apply(null, cs.map(q => q[0])), Math.min.apply(null, cs.map(q => q[1])), Math.max.apply(null, cs.map(q => q[0])), Math.max.apply(null, cs.map(q => q[1]))];
    }
    const span = !!(o.isSpan && o.isSpan(it));
    parts.push({
      id: it.id, box, solid: span ? null : solidOf(wp, box), ownSolid: !(it.k === 'IC' || it.k === 'SOCK' || it.k === 'DSW'),
      pins: wp.map((q, i) => { const e = nm[i], d = e.d ? o.rot(e.d[0], e.d[1], it.r) : null; return { x: q[0], y: q[1], n: e.n, x2: s >= 22 ? e.x : '', d }; })
    });
  });
  return layout(parts, { fs, minfs: 7 / s, meas: o.meas, segs: o.segs || [] });
}

/* Zeichnen: Text mit Halo. c = 2D-Kontext, labs = Ergebnis von layout, o: { fill, halo, mir (gespiegelte Ansicht: Text bleibt lesbar), unit } */
function paint(c, labs, o) {
  o = o || {};
  labs.forEach(l => {
    c.save(); c.translate(l.cx, l.cy); if (o.mir) c.scale(-1, 1); c.scale(l.fs / 100, l.fs / 100);
    c.font = '700 100px -apple-system,system-ui,Segoe UI,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round'; c.lineWidth = 26; c.strokeStyle = o.halo || '#080b0e'; c.strokeText(l.text, 0, 0);
    c.fillStyle = o.fill || '#ffd166'; c.fillText(l.text, 0, 0);
    c.restore();
  });
}

const api = { KEY, on, set, SCH, sch, loch, LOCH_KINDS, layout, schLabels, lochLabels, paint, rectFor, segHit, TIP: 'Zeigt an jedem Bauteil, welcher Anschluss welcher ist' };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TfPins = api;
})(typeof window !== 'undefined' ? window : globalThis);
