'use strict';
/* Tonfunk CNC-Lab: Kern (Lab-Kennung 'cnc'), window.CNC_CORE, per Node testbar (module.exports).
   Teilmenge nach DIN 66025, herstellerneutral. Zwei Maschinenarten: 'turn' (Drehen, X = DURCHMESSER, Z) und 'mill' (Fräsen, X Y Z).
   Festlegungen dieses Labs (vom Ausbilder zu prüfen, siehe Kennzeichnung PRUEFEN):
   - Drehen: X wird als Durchmesser programmiert (wie bei den meisten Drehmaschinen im Betrieb). Der Radius ist X/2.
     G91: X ist dann die Änderung des DURCHMESSERS. U/W = inkrementales X/Z (Typ-A-Schreibweise, unabhängig von G90/G91).
     Kreise: I und K sind Mittelpunktabstände vom Startpunkt, I als RADIUSwert.  PRUEFEN
     Drehrichtung G2 = Uhrzeigersinn in der Ansicht Z nach rechts, X nach oben (Werkzeug hinter der Drehmitte).  PRUEFEN
   - Fräsen: Werkstücknullpunkt links vorne oben (Z0 = Oberseite), Z negativ = ins Material, G2 = Uhrzeigersinn von oben (+Z) gesehen.
   - Kreis mit R: positives R = Bogen höchstens 180 Grad, negatives R = Bogen größer als 180 Grad.  PRUEFEN
   - G41/G42 werden nur erklärt (Hinweis); die Simulation fährt die programmierte Bahn ohne Radiuskorrektur.
   - Werkzeug im Material: Dreh-Meißel als Spitze mit Körper nach +Z und nach außen, Fräser/Bohrer als Zylinder mit ebener Stirn (Bohrerspitze vernachlässigt).
   - Zeit: Hauptzeit = Summe (Weg / Vorschubgeschwindigkeit) der Arbeitsgänge; G95: vf = f * n. Eilgang separat (Nebenzeit, grob). */
(function (root) {
  const SETUPS = {
    turn: { stock: { d: 40, zmax: 2, zmin: -50 }, start: { x: 100, y: 0, z: 50 }, tools: { 1: { name: 'Schruppmeißel' }, 2: { name: 'Schlichtmeißel' }, 3: { name: 'Stechmeißel' } } },
    mill: { stock: { x0: 0, y0: 0, x1: 80, y1: 60, depth: 20 }, start: { x: 0, y: 0, z: 50 }, tools: { 1: { name: 'Schaftfräser Ø10', r: 5 }, 2: { name: 'Schaftfräser Ø6', r: 3 }, 3: { name: 'Spiralbohrer Ø8', r: 4 }, 4: { name: 'Schaftfräser Ø16', r: 8 } } }
  };

  const CODES = {
    G0: ['Eilgang', 'Das Werkzeug fährt auf geradem Weg mit größter Geschwindigkeit zum Ziel. Es wird nicht zerspant, der Weg muss frei sein.'],
    G1: ['Linearinterpolation', 'Gerade Bahn mit dem Arbeitsvorschub F. Hier wird zerspant.'],
    G2: ['Kreis im Uhrzeigersinn', 'Kreisbogen im Uhrzeigersinn zum Endpunkt. Mittelpunkt mit I/J/K (Abstand vom Startpunkt) oder Radius R.'],
    G3: ['Kreis gegen den Uhrzeigersinn', 'Kreisbogen gegen den Uhrzeigersinn zum Endpunkt. Mittelpunkt mit I/J/K oder Radius R.'],
    G17: ['Ebene XY', 'Arbeitsebene X-Y (Fräsen, Ansicht von oben). Wirkt auf Kreisbögen.'],
    G18: ['Ebene ZX', 'Arbeitsebene Z-X (Drehen). Wirkt auf Kreisbögen.'],
    G19: ['Ebene YZ', 'Arbeitsebene Y-Z. Wirkt auf Kreisbögen.'],
    G40: ['Radiuskorrektur aus', 'Werkzeugradiuskorrektur ausschalten. Die Steuerung fährt wieder die Werkzeugmitte auf der programmierten Bahn.'],
    G41: ['Radiuskorrektur links', 'Das Werkzeug liegt in Vorschubrichtung links von der Kontur (bei M3 Gleichlauf). Nur Hinweis: Die Simulation fährt die programmierte Bahn.'],
    G42: ['Radiuskorrektur rechts', 'Das Werkzeug liegt in Vorschubrichtung rechts von der Kontur (bei M3 Gegenlauf). Nur Hinweis: Die Simulation fährt die programmierte Bahn.'],
    G54: ['Nullpunkt G54', 'Nullpunktverschiebung: Alle Koordinaten beziehen sich auf den Werkstücknullpunkt.'],
    G80: ['Zyklus aus', 'Bohrzyklus abwählen.'],
    G81: ['Bohrzyklus', 'Bohren: Eilgang zur Position, Eilgang auf R, Vorschub bis Z, Eilgang zurück. Wiederholt sich an jeder neuen Position bis G80.'],
    G90: ['Absolutmaß', 'Koordinaten sind Werte im Werkstückkoordinatensystem (vom Nullpunkt aus gemessen).'],
    G91: ['Kettenmaß (inkremental)', 'Koordinaten sind Wege vom aktuellen Punkt aus. Beim Drehen ist X die Änderung des Durchmessers.'],
    G94: ['Vorschub mm/min', 'F ist die Vorschubgeschwindigkeit in mm pro Minute.'],
    G95: ['Vorschub mm/Umdrehung', 'F ist der Vorschub pro Umdrehung in mm. Vorschubgeschwindigkeit vf = f · n.'],
    G97: ['Drehzahl in 1/min', 'S ist die Drehzahl in Umdrehungen pro Minute.'],
    G98: ['Rückzug auf Startebene', 'Nach dem Bohren zurück auf die Ebene vor dem Zyklus.'],
    G99: ['Rückzug auf R-Ebene', 'Nach dem Bohren zurück auf die Rückzugsebene R.'],
    M0: ['Programmhalt', 'Programm hält an, Start setzt es fort.'],
    M1: ['Wahlweiser Halt', 'Hält nur an, wenn der Schalter „Wahlhalt“ eingeschaltet ist.'],
    M2: ['Programmende', 'Programm beendet.'],
    M3: ['Spindel rechts', 'Spindel dreht im Uhrzeigersinn (Standard beim Fräsen und Drehen). Drehzahl S muss gesetzt sein.'],
    M4: ['Spindel links', 'Spindel dreht gegen den Uhrzeigersinn.'],
    M5: ['Spindel halt', 'Spindel steht.'],
    M6: ['Werkzeugwechsel', 'Das mit T gewählte Werkzeug wird eingewechselt.'],
    M8: ['Kühlmittel ein', 'Kühlschmierstoff einschalten.'],
    M9: ['Kühlmittel aus', 'Kühlschmierstoff ausschalten.'],
    M30: ['Programmende', 'Programmende mit Rücksprung auf den Programmanfang.']
  };
  const GGROUP = { 0: 'mo', 1: 'mo', 2: 'mo', 3: 'mo', 80: 'mo', 81: 'mo', 17: 'pl', 18: 'pl', 19: 'pl', 40: 'co', 41: 'co', 42: 'co', 54: 'wc', 55: 'wc', 56: 'wc', 57: 'wc', 58: 'wc', 59: 'wc', 90: 'di', 91: 'di', 94: 'fm', 95: 'fm', 97: 'sm', 98: 'rt', 99: 'rt' };
  const MGROUP = { 3: 'sp', 4: 'sp', 5: 'sp', 8: 'cl', 9: 'cl', 0: 'en', 1: 'en', 2: 'en', 30: 'en', 6: 'tc' };
  const ADDR = 'NGMXYZIJKRFSTDUW';
  const AX = { 17: ['x', 'y', 'z'], 18: ['z', 'x', 'y'], 19: ['y', 'z', 'x'] };   /* [erste Achse, zweite Achse, dritte Achse] der Ebene */
  const OFF = { x: 'I', y: 'J', z: 'K' };
  const UNSUP = { 4: 'Verweilzeit G4', 28: 'Referenzfahrt G28', 53: 'Maschinenkoordinaten G53', 92: 'Nullpunkt setzen G92', 96: 'konstante Schnittgeschwindigkeit G96 (nutze G97 mit Drehzahl S)', 70: 'Zoll/Metrisch G70/G71', 71: 'Zoll/Metrisch G70/G71', 20: 'Zoll G20', 21: 'Metrisch G21', 50: 'Drehzahlbegrenzung G50', 64: 'Bahnsteuerbetrieb G64', 83: 'Tiefbohrzyklus G83' };

  /* ============================================================ Zahlen */
  function parseDe(s) {
    if (s == null) return NaN;
    const t = String(s).trim().replace(/[−–]/g, '-').replace(/\s*(mm|min|s|°)\s*$/i, '').replace(/\s+/g, '');
    if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(t)) return NaN;
    return parseFloat(t.replace(',', '.'));
  }
  function fmtDe(v, d, sign) {
    if (!isFinite(v)) return '–';
    d = d == null ? 2 : d; let s = v.toFixed(d); if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    s = s.replace('.', ','); if (sign && v > 0) s = '+' + s; return s;
  }
  const fmtNum = v => { const r = Math.round(v * 1000) / 1000; return String(r).replace('.', ','); };
  function fmtTime(min) { const s = min * 60; return fmtDe(min, 2) + ' min (' + (s < 100 ? fmtDe(s, 1) : String(Math.round(s))) + ' s)'; }
  function rng(seed) {
    const s = String(seed); let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* ============================================================ Rohteile */
  function TurnStock(o) {
    this.kind = 'turn'; this.R = o.d / 2; this.zmin = o.zmin; this.zmax = o.zmax; this.dz = 0.1;
    this.n = Math.round((o.zmax - o.zmin) / this.dz); this.rp = new Float64Array(this.n).fill(this.R);
  }
  TurnStock.prototype = {
    col(z) { return Math.floor((z - this.zmin) / this.dz + 1e-6); },
    cutAt(z, r) { if (r < 0) r = 0; let i = Math.ceil((z - this.zmin) / this.dz - 0.5 - 1e-6); if (i < 0) i = 0; const rp = this.rp; for (; i < this.n; i++) if (rp[i] > r) rp[i] = r; },
    cutPath(pts) {
      for (let k = 0; k + 1 < pts.length || k === 0; k++) {
        const a = pts[k], b = pts[k + 1] || a, dz = b[2] - a[2], dr = (b[0] - a[0]) / 2, st = Math.max(1, Math.ceil(Math.hypot(dz, dr) / 0.05));
        for (let s = 0; s <= st; s++) { const f = s / st; this.cutAt(a[2] + dz * f, (a[0] + (b[0] - a[0]) * f) / 2); }
        if (!pts[k + 1]) break;
      }
    },
    inMat(z, r) {
      if (z > this.zmax + 0.02 || z < this.zmin - 0.02) return false;
      const i0 = Math.floor((z - 0.02 - this.zmin) / this.dz + 1e-6), i1 = Math.floor((z + 0.02 - this.zmin) / this.dz + 1e-6); let m = Infinity;
      for (let i = i0; i <= i1; i++) { const v = (i < 0 || i >= this.n) ? 0 : this.rp[i]; if (v < m) m = v; }
      return m > Math.max(r, 0) + 0.01;
    },
    diaAt(z) { let i = this.col(z); if (i < 0) i = 0; if (i >= this.n) i = this.n - 1; return 2 * this.rp[i]; },
    diff(o) { let s = 0; const n = Math.min(this.n, o.n); for (let i = 0; i < n; i++) s += Math.abs(this.rp[i] - o.rp[i]) * this.dz; return s + Math.abs(this.n - o.n) * this.dz * this.R; },
    removed() { let s = 0; for (let i = 0; i < this.n; i++) s += (this.R - this.rp[i]) * this.dz; return s; }
  };
  function MillStock(o) {
    this.kind = 'mill'; this.x0 = o.x0; this.y0 = o.y0; this.x1 = o.x1; this.y1 = o.y1; this.depth = o.depth; this.c = 0.5;
    this.nx = Math.ceil((o.x1 - o.x0) / this.c); this.ny = Math.ceil((o.y1 - o.y0) / this.c); this.h = new Float32Array(this.nx * this.ny);
  }
  MillStock.prototype = {
    range(x, y, r) { const c = this.c; return [Math.max(0, Math.floor((x - r - this.x0) / c)), Math.min(this.nx - 1, Math.floor((x + r - this.x0) / c)), Math.max(0, Math.floor((y - r - this.y0) / c)), Math.min(this.ny - 1, Math.floor((y + r - this.y0) / c))]; },
    cutAt(x, y, z, r) {
      if (z >= 0) return; if (z < -this.depth) z = -this.depth;
      const g = this.range(x, y, r), c = this.c, r2 = r * r;
      for (let j = g[2]; j <= g[3]; j++) { const cy = this.y0 + (j + 0.5) * c, dy = (cy - y) * (cy - y); for (let i = g[0]; i <= g[1]; i++) { const cx = this.x0 + (i + 0.5) * c; if ((cx - x) * (cx - x) + dy <= r2) { const k = j * this.nx + i; if (this.h[k] > z) this.h[k] = z; } } }
    },
    cutPath(pts, r) {
      for (let k = 0; k + 1 < pts.length || k === 0; k++) {
        const a = pts[k], b = pts[k + 1] || a, st = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.25));
        for (let s = 0; s <= st; s++) { const f = s / st; this.cutAt(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, r); }
        if (!pts[k + 1]) break;
      }
    },
    collide(x, y, z, r) {
      if (z >= -1e-6) return false;
      const g = this.range(x, y, r), c = this.c, r2 = r * r;
      for (let j = g[2]; j <= g[3]; j++) { const cy = this.y0 + (j + 0.5) * c, dy = (cy - y) * (cy - y); for (let i = g[0]; i <= g[1]; i++) { const cx = this.x0 + (i + 0.5) * c; if ((cx - x) * (cx - x) + dy <= r2 && this.h[j * this.nx + i] > z + 1e-6) return true; } }
      return false;
    },
    overlaps(x, y, r) { return x + r > this.x0 && x - r < this.x1 && y + r > this.y0 && y - r < this.y1; },
    heightAt(x, y) { const i = Math.floor((x - this.x0) / this.c), j = Math.floor((y - this.y0) / this.c); if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return null; return this.h[j * this.nx + i]; },
    diff(o) { let n = 0; const m = Math.min(this.h.length, o.h.length); for (let k = 0; k < m; k++) if (Math.abs(this.h[k] - o.h[k]) > 0.05) n++; return n * this.c * this.c; },
    removed() { let s = 0; for (let k = 0; k < this.h.length; k++) s -= this.h[k]; return s * this.c * this.c; }
  };

  /* ============================================================ Satz lesen */
  function parseLine(raw) {
    const r = { raw, words: [], errs: [], skip: false, comment: '', blank: false };
    let out = '', cm = '', depth = 0;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (depth > 0) { if (c === ')') depth = 0; else cm += c; continue; }
      if (c === '(') { depth = 1; continue; }
      if (c === ')') { r.errs.push('Schließende Klammer ) ohne öffnende Klammer'); continue; }
      if (c === ';') { cm += raw.slice(i + 1); break; }
      out += c;
    }
    if (depth > 0) r.errs.push('Die Kommentarklammer ( ist nicht geschlossen');
    r.comment = cm.trim();
    let t = out.trim();
    if (t[0] === '/') { r.skip = true; return r; }
    if (t === '' || t === '%') { r.blank = true; return r; }
    if (/^O\d+$/i.test(t)) { r.blank = true; r.progNo = t; return r; }
    let p = 0; const L = t.length;
    while (p < L) {
      const c = t[p];
      if (/\s/.test(c)) { p++; continue; }
      if (!/[A-Za-z]/.test(c)) { r.errs.push('Unerwartetes Zeichen „' + c + '“'); p++; continue; }
      const a = c.toUpperCase(); p++;
      const m = /^\s*([+-]?\s*(?:\d+[.,]?\d*|[.,]\d+))/.exec(t.slice(p));
      if (!m) { r.errs.push('Adresse ' + a + ' ohne Zahlenwert'); continue; }
      p += m[0].length; let txt = m[1].replace(/\s+/g, '');
      if (txt.indexOf(',') >= 0) { r.errs.push('Komma als Dezimalzeichen: schreibe ' + a + txt.replace(',', '.') + ' (Dezimalpunkt)'); txt = txt.replace(',', '.'); }
      r.words.push({ a, v: parseFloat(txt), txt });
    }
    if (!r.words.length && !r.errs.length) r.blank = true;
    return r;
  }
  function staticCheck(b, turn) {
    const errs = [], seen = {}, gs = [], ms = [];
    b.words.forEach((w, i) => {
      if (ADDR.indexOf(w.a) < 0) { errs.push('Unbekannte Adresse „' + w.a + '“ (' + w.a + w.txt + ')'); return; }
      if (w.a === 'N') { if (i !== 0) errs.push('Die Satznummer N muss am Satzanfang stehen'); else if (!Number.isInteger(w.v) || w.v < 0) errs.push('Die Satznummer N braucht eine ganze Zahl'); return; }
      if (w.a === 'G') { gs.push(w.v); return; }
      if (w.a === 'M') { ms.push(w.v); return; }
      if (seen[w.a]) errs.push('Adresse ' + w.a + ' kommt im Satz doppelt vor'); seen[w.a] = 1;
    });
    const gseen = {};
    gs.forEach(g => {
      if (!Number.isInteger(g) || !GGROUP[g]) { errs.push(UNSUP[g] ? UNSUP[g] + ' wird in dieser Simulation nicht unterstützt' : 'G' + fmtNum(g) + ' ist unbekannt oder wird nicht unterstützt'); return; }
      const grp = GGROUP[g]; if (gseen[grp] != null && gseen[grp] !== g) errs.push('G' + gseen[grp] + ' und G' + g + ' im selben Satz: Sie gehören zur selben Gruppe und schließen sich aus'); gseen[grp] = g;
    });
    const mseen = {};
    ms.forEach(m => {
      if (!Number.isInteger(m) || !MGROUP[m]) { errs.push('M' + fmtNum(m) + ' ist unbekannt oder wird nicht unterstützt'); return; }
      const grp = MGROUP[m]; if (mseen[grp] != null && mseen[grp] !== m) errs.push('M' + mseen[grp] + ' und M' + m + ' im selben Satz schließen sich aus'); mseen[grp] = m;
    });
    if (turn) { if (seen.Y) errs.push('Die Drehmaschine hat keine Y-Achse'); if (seen.J) errs.push('J gibt es beim Drehen nicht (Kreismittelpunkt mit I und K)'); }
    else { if (seen.U) errs.push('U (inkrementales X) gibt es nur beim Drehen, beim Fräsen G91 benutzen'); if (seen.W) errs.push('W (inkrementales Z) gibt es nur beim Drehen, beim Fräsen G91 benutzen'); }
    if (seen.X && seen.U) errs.push('X und U im selben Satz'); if (seen.Z && seen.W) errs.push('Z und W im selben Satz');
    b.gs = gs; b.ms = ms; b.W = {}; b.words.forEach(w => { if ('NGM'.indexOf(w.a) < 0) b.W[w.a] = w.v; });
    b.n = b.words[0] && b.words[0].a === 'N' ? b.words[0].v : null;
    return errs;
  }

  /* ============================================================ Bahnen */
  const rlen = (a, b, turn) => Math.hypot(turn ? (b[0] - a[0]) / 2 : b[0] - a[0], turn ? 0 : b[1] - a[1], b[2] - a[2]);
  function mkCum(pts, turn) { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + rlen(pts[i - 1], pts[i], turn)); return c; }
  function posAt(m, d) {
    const p = m.pts, c = m.cum;
    if (d <= 0 || p.length === 1) return p[0].slice(); if (d >= c[c.length - 1]) return p[p.length - 1].slice();
    let i = 1; while (i < c.length - 1 && c[i] < d) i++;
    const f = (d - c[i - 1]) / ((c[i] - c[i - 1]) || 1); return [0, 1, 2].map(k => p[i - 1][k] + (p[i][k] - p[i - 1][k]) * f);
  }
  function subPath(m, d0, d1) {
    const out = [posAt(m, d0)];
    for (let i = 1; i < m.pts.length - 1; i++) if (m.cum[i] > d0 && m.cum[i] < d1) out.push(m.pts[i]);
    out.push(posAt(m, d1)); return out;
  }

  /* ============================================================ Interpreter */
  class CncErr extends Error {}
  function run(src, opt) {
    opt = opt || {};
    const machine = opt.machine === 'turn' ? 'turn' : 'mill', turn = machine === 'turn', base = SETUPS[machine];
    const stockCfg = Object.assign({}, base.stock, opt.stock || {}), tools = opt.tools || base.tools, start = Object.assign({}, base.start, opt.start || {}), rapidSpeed = opt.rapid || 10000;
    const mkStock = () => turn ? new TurnStock(stockCfg) : new MillStock(stockCfg);
    const stock = mkStock();
    const res = { machine, errors: [], warnings: [], infos: [], moves: [], steps: [], stock, newStock: mkStock, setup: { stock: stockCfg, tools, start, rapid: rapidSpeed }, ended: false, stopLine: null, time: { main: 0, rapid: 0, total: 0, feedLen: 0, rapidLen: 0 }, ok: false };
    const warnOnce = {}; const warn = (li, m) => { const k = li + m; if (!warnOnce[k]) { warnOnce[k] = 1; res.warnings.push({ line: li + 1, msg: m }); } };
    const text = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
    const parsed = text.map(parseLine);
    parsed.forEach((b, i) => {
      if (b.skip) return;
      if (!b.blank) staticCheck(b, turn).forEach(m => b.errs.push(m));
      b.errs.forEach(m => res.errors.push({ line: i + 1, msg: m, kind: 'syntax' }));
    });
    res.lines = parsed;
    if (!parsed.some(b => !b.skip && !b.blank)) { res.errors.push({ line: 1, msg: 'Das Programm ist leer', kind: 'run' }); res.ok = false; return res; }

    const S = { pos: { x: start.x, y: start.y || 0, z: start.z }, dist: 90, plane: turn ? 18 : 17, fm: turn ? 95 : 94, comp: 40, wcs: 54, motion: null, f: null, s: null, spindle: 'off', coolant: false, tool: null, toolSel: null, canned: null, ret: 98, initZ: 0 };
    const snap = () => ({ g: { motion: S.motion, dist: S.dist, plane: S.plane, fm: S.fm, comp: S.comp, wcs: S.wcs }, f: S.f, s: S.s, tool: S.tool, spindle: S.spindle, coolant: S.coolant, pos: Object.assign({}, S.pos), canned: !!S.canned });
    const toolR = () => { const t = tools[S.tool]; return t && t.r != null ? t.r : 0; };
    const sc = ax => (turn && ax === 'x') ? 0.5 : 1;
    let curLine = 0, negX = false;

    function checkTravel(pts, rapid) {
      const r = toolR();
      for (let k = 0; k < pts.length - 1 || k === 0; k++) {
        const a = pts[k], b = pts[k + 1] || a, len = rlen(a, b, turn), st = Math.max(1, Math.ceil(len / (turn ? 0.05 : 0.25)));
        if (rapid && !turn && a[2] >= 0 && b[2] >= 0) { if (!pts[k + 1]) break; continue; }
        for (let s = 0; s <= st; s++) {
          const f = s / st, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f;
          if (turn) {
            const rr = x / 2;
            if (z < stock.zmin - 1e-6 && rr < stock.R + 10) throw new CncErr('Kollision: Das Werkzeug fährt in das Spannfutter (Z kleiner als das Rohteilende Z' + fmtNum(stock.zmin) + ')');
            if (x < -10) throw new CncErr('X' + fmtNum(x) + ' liegt weit hinter der Drehmitte: Werkzeug zerstört');
            if (x < -2) negX = true;
            if (rapid && stock.inMat(z, rr)) throw new CncErr('Kollision: Eilgang G0 fährt in das Rohteil bei X' + fmtNum(x) + ' Z' + fmtNum(z));
          } else {
            if (z < -stock.depth - 1e-6 && stock.overlaps(x, y, r)) throw new CncErr('Kollision: Das Werkzeug fährt unter die Rohteil-Unterkante (Z' + fmtNum(z) + ') in den Maschinentisch');
            if (rapid && stock.collide(x, y, z, r)) throw new CncErr('Kollision: Eilgang G0 fährt in das Rohteil bei X' + fmtNum(x) + ' Y' + fmtNum(y) + ' Z' + fmtNum(z));
          }
        }
        if (!pts[k + 1]) break;
      }
    }
    function emit(kind, pts, g, extra) {
      const rapid = kind === 'rapid';
      let vf = 0;
      if (!rapid) {
        if (!(S.f > 0)) throw new CncErr('Vorschub F fehlt: Vor G1/G2/G3 muss ein Vorschub programmiert sein');
        if (S.spindle === 'off') throw new CncErr('Die Spindel steht: Zum Zerspanen fehlt M3 (oder M4) mit Drehzahl S');
        if (S.tool == null) throw new CncErr('Kein Werkzeug eingewechselt (T' + (turn ? '' : ' und M6') + ' fehlt)');
        if (!turn && S.toolSel != null && S.toolSel !== S.tool) throw new CncErr('Werkzeug T' + S.toolSel + ' ist nur vorgewählt, es fehlt M6 zum Einwechseln');
        vf = S.fm === 95 ? S.f * S.s : S.f;
        if (!(vf > 0)) throw new CncErr('Vorschubgeschwindigkeit ist 0 (Drehzahl S ist 0)');
      }
      checkTravel(pts, rapid);
      const cum = mkCum(pts, turn), len = cum[cum.length - 1];
      if (!rapid) { if (turn) stock.cutPath(pts); else stock.cutPath(pts, toolR()); }
      const m = Object.assign({ line: curLine, n: parsed[curLine].n, kind, g, pts, cum, len, vf, t: rapid ? len / rapidSpeed : len / vf, tool: S.tool }, extra || {});
      res.moves.push(m); S.pos = { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1], z: pts[pts.length - 1][2] };
      if (rapid) { res.time.rapid += m.t; res.time.rapidLen += len; } else { res.time.main += m.t; res.time.feedLen += len; }
    }
    const P = () => [S.pos.x, S.pos.y, S.pos.z];

    function arc(cw, tgt, W) {
      const pl = S.plane, A = AX[pl][0], B = AX[pl][1], T3 = AX[pl][2], sa = sc(A), sb = sc(B), p = S.pos;
      const a0 = p[A] * sa, b0 = p[B] * sb, a1 = tgt[A] * sa, b1 = tgt[B] * sb, t0 = p[T3], t1 = tgt[T3];
      const bad = ['I', 'J', 'K'].filter(L => (L in W) && L !== OFF[A] && L !== OFF[B]);
      if (bad.length) throw new CncErr(bad[0] + ' gehört nicht zur Ebene G' + pl + ' (dort gelten ' + OFF[A] + ' und ' + OFF[B] + ')');
      const oa = W[OFF[A]], ob = W[OFF[B]]; let ca, cb;
      if ('R' in W) {
        if (oa !== undefined || ob !== undefined) throw new CncErr('Kreis mit I/J/K und R gleichzeitig: Entweder Mittelpunkt oder Radius angeben');
        const R = W.R, d = Math.hypot(a1 - a0, b1 - b0);
        if (R === 0) throw new CncErr('Kreisradius R0 ist nicht möglich');
        if (d < 1e-7) throw new CncErr('Vollkreis ist mit R nicht eindeutig: Mittelpunkt mit I/J/K angeben');
        if (Math.abs(R) * 2 < d - 0.001) throw new CncErr('R' + fmtNum(R) + ' ist zu klein: Start und Ende sind ' + fmtNum(d) + ' mm auseinander, der Durchmesser wäre nur ' + fmtNum(Math.abs(R) * 2) + ' mm');
        const h = Math.sqrt(Math.max(0, R * R - d * d / 4)), ua = (a1 - a0) / d, ub = (b1 - b0) / d, k = (cw ? 1 : -1) * (R > 0 ? 1 : -1);
        ca = (a0 + a1) / 2 + k * h * ub; cb = (b0 + b1) / 2 - k * h * ua;
      } else {
        if (oa === undefined && ob === undefined) throw new CncErr('Kreis ohne Mittelpunkt: I/J/K (oder Radius R) fehlt');
        ca = a0 + (oa || 0); cb = b0 + (ob || 0);
      }
      const r0 = Math.hypot(a0 - ca, b0 - cb), r1 = Math.hypot(a1 - ca, b1 - cb);
      if (r0 < 1e-9) throw new CncErr('Kreisradius 0: Der Mittelpunkt liegt auf dem Startpunkt');
      if (Math.abs(r0 - r1) > 0.01) throw new CncErr('Kreis passt nicht: Radius am Start ' + fmtNum(r0) + ' mm, am Ende ' + fmtNum(r1) + ' mm (Mittelpunkt oder Endpunkt falsch)');
      const th0 = Math.atan2(b0 - cb, a0 - ca), th1 = Math.atan2(b1 - cb, a1 - ca); let sw = cw ? th0 - th1 : th1 - th0;
      if (Math.hypot(a1 - a0, b1 - b0) < 1e-7) sw = 2 * Math.PI; else { while (sw <= 1e-9) sw += 2 * Math.PI; while (sw > 2 * Math.PI) sw -= 2 * Math.PI; }
      const n = Math.min(900, Math.max(8, Math.ceil(sw * (r0 + r1) / 2 / 0.25), Math.ceil(sw * 180 / Math.PI)));
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const f = k / n, th = cw ? th0 - sw * f : th0 + sw * f, rr = r0 + (r1 - r0) * f, q = {};
        q[A] = (k === n ? a1 : k === 0 ? a0 : ca + rr * Math.cos(th)) / sa; q[B] = (k === n ? b1 : k === 0 ? b0 : cb + rr * Math.sin(th)) / sb; q[T3] = t0 + (t1 - t0) * f;
        pts.push([q.x, q.y, q.z]);
      }
      const ctr = {}; ctr[A] = ca / sa; ctr[B] = cb / sb;
      emit('feed', pts, cw ? 2 : 3, { arc: { center: ctr, r: (r0 + r1) / 2, cw, plane: pl, sweep: sw } });
    }

    function execBlock(b, li) {
      curLine = li; const W = b.W, m0 = res.moves.length, info = [];
      let motionG = null;
      b.gs.forEach(g => {
        info.push('G' + g);
        switch (GGROUP[g]) {
          case 'mo': motionG = g; break;
          case 'pl': if (turn && g !== 18) warn(li, 'G' + g + ': Die Drehmaschine arbeitet in G18 (Z-X), G' + g + ' wird ignoriert'); else S.plane = g; break;
          case 'di': S.dist = g; break;
          case 'co': S.comp = g; if (g !== 40) warn(li, 'G' + g + ' (Werkzeugradiuskorrektur): Die Simulation fährt die programmierte Bahn ohne Radiuskorrektur. Eine echte Steuerung versetzt das Werkzeug um den Radius ' + (g === 41 ? 'nach links' : 'nach rechts') + '.'); break;
          case 'wc': S.wcs = g; if (g !== 54) warn(li, 'G' + g + ': Die Simulation rechnet mit demselben Nullpunkt wie G54'); break;
          case 'fm': S.fm = g; break;
          case 'rt': S.ret = g; break;
        }
      });
      if (motionG === 81 && turn) throw new CncErr('Der Bohrzyklus G81 ist nur beim Fräsen vorgesehen');
      if (motionG !== null) { S.motion = motionG; if (motionG !== 81) S.canned = null; }
      if ('F' in W) { if (!(W.F > 0)) throw new CncErr('Vorschub F muss größer als 0 sein (F' + fmtNum(W.F) + ')'); S.f = W.F; }
      if (S.f != null && ('F' in W || 'G' in W)) {
        if (S.fm === 94 && S.f < 5 && 'F' in W) warn(li, 'G94: F' + fmtNum(S.f) + ' mm/min ist extrem langsam. Wolltest du mm/Umdrehung (G95)?');
        if (S.fm === 95 && S.f > 3 && 'F' in W) warn(li, 'G95: F' + fmtNum(S.f) + ' mm pro Umdrehung ist sehr groß. Wolltest du mm/min (G94)?');
      }
      if ('S' in W) { if (W.S < 0) throw new CncErr('Drehzahl S darf nicht negativ sein'); S.s = W.S; info.push('S'); }
      if ('T' in W) {
        let tn = W.T; if (turn && tn >= 100) tn = Math.floor(tn / 100);
        if (!Number.isInteger(tn) || !tools[tn]) throw new CncErr('Werkzeug T' + fmtNum(W.T) + ' ist nicht im Werkzeugspeicher (vorhanden: ' + Object.keys(tools).map(k => 'T' + k).join(', ') + ')');
        S.toolSel = tn; if (turn) S.tool = tn; info.push('T');
      }
      let endAfter = false;
      b.ms.forEach(m => {
        info.push('M' + m);
        if (m === 3 || m === 4) { if (!(S.s > 0)) throw new CncErr('M' + m + ' ohne Drehzahl: S fehlt oder ist 0'); S.spindle = m === 3 ? 'cw' : 'ccw'; }
        else if (m === 5) S.spindle = 'off';
        else if (m === 8) S.coolant = true; else if (m === 9) S.coolant = false;
        else if (m === 6) { if (S.toolSel == null) throw new CncErr('M6 ohne Werkzeugwahl: T fehlt'); S.tool = S.toolSel; }
        else if (m === 2 || m === 30) endAfter = true;
      });
      const hasAxis = ['X', 'Y', 'Z', 'U', 'W'].some(L => L in W);
      const mode = S.motion;
      if (hasAxis || (mode === 2 || mode === 3) && ('I' in W || 'J' in W || 'K' in W || 'R' in W)) {
        if (mode == null) throw new CncErr('Kein Verfahrbefehl aktiv: G0, G1, G2 oder G3 fehlt vor den Koordinaten');
        if (mode === 80) throw new CncErr('Nach G80 ist kein Verfahrbefehl aktiv: G0 oder G1 schreiben');
        const p = S.pos, tgt = { x: p.x, y: p.y, z: p.z }, ab = S.dist === 90;
        ['X', 'Y', 'Z'].forEach(L => { if (L in W) { const k = L.toLowerCase(); tgt[k] = ab ? W[L] : p[k] + W[L]; } });
        if ('U' in W) tgt.x = p.x + W.U; if ('W' in W) tgt.z = p.z + W.W;
        if (mode === 81) {
          if (!('Z' in W) && !S.canned) throw new CncErr('G81 ohne Bohrtiefe Z'); if (!('R' in W) && !S.canned) throw new CncErr('G81 ohne Rückzugsebene R');
          if (S.dist !== 90) throw new CncErr('G81 wird in dieser Simulation nur mit G90 unterstützt');   /* PRUEFEN: bei G91 bezieht sich R/Z je nach Steuerung unterschiedlich */
          if (!S.canned) S.canned = { z: W.Z, r: W.R, init: p.z }; else { if ('Z' in W) S.canned.z = W.Z; if ('R' in W) S.canned.r = W.R; }
          if ('X' in W || 'Y' in W) {
            const c = S.canned, x = tgt.x, y = tgt.y, z0 = S.pos.z, ret = S.ret === 98 ? c.init : c.r;
            if (!(c.z < c.r)) throw new CncErr('G81: Bohrtiefe Z' + fmtNum(c.z) + ' muss tiefer als die Rückzugsebene R' + fmtNum(c.r) + ' liegen');
            emit('rapid', [P(), [x, y, z0]], 0);
            if (Math.abs(z0 - c.r) > 1e-9) emit('rapid', [[x, y, z0], [x, y, c.r]], 0);
            emit('feed', [[x, y, c.r], [x, y, c.z]], 1, { drill: true });
            emit('rapid', [[x, y, c.z], [x, y, ret]], 0);
          }
        } else if (mode === 0) {
          const pts = [P(), [tgt.x, tgt.y, tgt.z]];
          if (rlen(pts[0], pts[1], turn) > 1e-9) emit('rapid', pts, 0);
        } else if (mode === 1) {
          const pts = [P(), [tgt.x, tgt.y, tgt.z]];
          if (rlen(pts[0], pts[1], turn) > 1e-9) emit('feed', pts, 1); else if (!(S.f > 0)) throw new CncErr('Vorschub F fehlt');
        } else arc(mode === 2, tgt, W);
      }
      if (endAfter) res.ended = true;
      const g0 = [], seen = {};
      b.gs.concat(b.ms.map(m => 'M' + m)).forEach(c => { const k = typeof c === 'number' ? 'G' + c : c; if (!seen[k]) { seen[k] = 1; g0.push(k); } });
      if (hasAxis && b.gs.every(g => GGROUP[g] !== 'mo') && S.motion != null) g0.unshift('G' + S.motion);
      res.steps.push({ line: li, n: b.n, text: b.raw.trim(), m0, m1: res.moves.length, state: snap(), codes: g0 });
    }

    let lastN = null, afterEnd = false;
    for (let li = 0; li < parsed.length; li++) {
      const b = parsed[li]; if (b.skip || b.blank) continue;
      if (b.errs.length) { res.stopLine = li + 1; break; }
      if (res.ended) { afterEnd = true; break; }
      if (b.n != null) { if (lastN != null && b.n <= lastN) warn(li, 'Satznummer N' + b.n + ' ist nicht größer als die vorige (N' + lastN + ')'); lastN = b.n; }
      try { execBlock(b, li); }
      catch (e) { if (e instanceof CncErr) { res.errors.push({ line: li + 1, msg: e.message, kind: 'run' }); res.stopLine = li + 1; break; } throw e; }
    }
    if (afterEnd) { res.warnings.push({ line: res.steps[res.steps.length - 1].line + 2, msg: 'Nach M30/M2 stehende Sätze werden nicht mehr ausgeführt' }); }
    if (!res.errors.length) {
      const last = res.steps.length ? res.steps[res.steps.length - 1].line : 0;
      if (!res.ended) res.warnings.push({ line: last + 1, msg: 'Programmende M30 fehlt' });
      else {
        if (S.spindle !== 'off') res.warnings.push({ line: last + 1, msg: 'Die Spindel läuft am Programmende noch (M5 fehlt)' });
        if (S.coolant) res.warnings.push({ line: last + 1, msg: 'Das Kühlmittel läuft am Programmende noch (M9 fehlt)' });
      }
      if (S.comp !== 40) res.warnings.push({ line: last + 1, msg: 'Radiuskorrektur G' + S.comp + ' ist am Programmende noch aktiv (G40 fehlt)' });
      if (negX) res.warnings.push({ line: 1, msg: 'Die Werkzeugspitze fährt über die Drehmitte (negatives X)' });
    }
    res.errors.sort((a, b) => a.line - b.line); res.warnings.sort((a, b) => a.line - b.line);
    res.time.total = res.time.main + res.time.rapid; res.final = snap(); res.ok = res.errors.length === 0;
    return res;
  }

  /* ============================================================ Vergleich Bahn und Material */
  function feedPolys(r) { const t = r.machine === 'turn'; return r.moves.filter(m => m.kind === 'feed').map(m => m.pts.map(p => [t ? p[0] / 2 : p[0], p[1], p[2]])); }
  function segDist(p, a, b) {
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], l2 = abx * abx + aby * aby + abz * abz;
    let t = l2 > 0 ? ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / l2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t, p[2] - a[2] - abz * t);
  }
  function maxDist(P, Q) {
    if (!P.length) return 0; if (!Q.length) return Infinity;
    let tot = 0; P.forEach(pl => { for (let i = 1; i < pl.length; i++) tot += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1], pl[i][2] - pl[i - 1][2]); });
    const step = Math.max(0.5, tot / 300); let worst = 0;
    P.forEach(pl => {
      for (let i = 0; i < pl.length; i++) {
        const a = pl[i], b = pl[i + 1], n = b ? Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step)) : 1;
        for (let s = 0; s < n; s++) {
          const f = s / n, p = b ? [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f] : a; let best = Infinity;
          for (let q = 0; q < Q.length && best > worst; q++) { const ql = Q[q]; for (let j = 1; j < ql.length; j++) { const d = segDist(p, ql[j - 1], ql[j]); if (d < best) best = d; } if (ql.length === 1) best = Math.min(best, Math.hypot(p[0] - ql[0][0], p[1] - ql[0][1], p[2] - ql[0][2])); }
          if (best > worst) worst = best;
        }
      }
    });
    return worst;
  }
  function pathDist(a, b) { const A = feedPolys(a), B = feedPolys(b); return Math.max(maxDist(A, B), maxDist(B, A)); }
  /* a = Ergebnis des Schülers, b = Referenz. opt: {path:true, stock:true, pathTol, stockTol} */
  function compare(a, b, opt) {
    opt = opt || {}; const out = { ok: true, lines: [], stockDiff: 0, pathDist: 0 };
    if (!a.ok) { out.ok = false; out.lines.push({ ok: false, text: 'Das Programm läuft nicht fehlerfrei durch: ' + (a.errors[0] ? 'Zeile ' + a.errors[0].line + ': ' + a.errors[0].msg : 'Fehler') }); return out; }
    if (!a.ended) { out.ok = false; out.lines.push({ ok: false, text: 'Das Programm endet nicht mit M30 oder M2.' }); }
    const turn = a.machine === 'turn';
    if (opt.stock !== false) {
      out.stockDiff = a.stock.diff(b.stock); const tol = opt.stockTol || (turn ? 1.5 : 3), good = out.stockDiff <= tol;
      out.lines.push({ ok: good, text: good ? 'Das abgetragene Material stimmt mit dem Soll überein.' : 'Das abgetragene Material weicht vom Soll ab (Unterschied ' + fmtDe(out.stockDiff, 1) + ' mm² ' + (turn ? 'im Längsschnitt' : 'in der Draufsicht') + ').' }); if (!good) out.ok = false;
    }
    if (opt.path !== false) {
      out.pathDist = pathDist(a, b); const tol = opt.pathTol || 0.15, good = out.pathDist <= tol;
      out.lines.push({ ok: good, text: good ? 'Die Arbeitsbahn liegt auf der Sollkontur.' : 'Die Arbeitsbahn weicht bis zu ' + (isFinite(out.pathDist) ? fmtDe(out.pathDist, 1) + ' mm' : 'stark') + ' von der Sollkontur ab.' }); if (!good) out.ok = false;
    }
    return out;
  }

  const api = { SETUPS, CODES, GGROUP, MGROUP, run, parseLine, parseDe, fmtDe, fmtNum, fmtTime, rng, compare, pathDist, posAt, subPath, rlen, TurnStock, MillStock, ADDR, version: 1 };
  root.CNC_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
