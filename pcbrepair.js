/* pcbrepair.js - Fehlersuche und Reparatur im Leiterplatten-Lab (View-Id 'repair')
 * Teil 1 (ohne DOM, auch mit Node ladbar): PCB_REPAIR = { inject, measure, operate, check, fix, autoFix, verify, faults, ... }
 * Teil 2 (nur im Browser): Ansicht mit Draufsicht (Vorder-/Rückseite), Multimeter, Lupe, Lötkolben, Entlötlitze, Pinzette/Messer,
 *   Fädeldraht, Schaltplan und Diagnoseprotokoll. Registriert sich bei window.PCB_VIEWS (id 'repair').
 *
 * ENTSCHEIDUNGEN / Hinweise zur Anbindung:
 *  - Fehler stehen als Zusatzfelder in der Platine (JSON-fähig, der Kern ignoriert sie):
 *      board.cuts   [{id,track,x,y,layer,ca,cb}]   Haarriss in einer Leiterbahn (Bahn bleibt gezeichnet, ist aber getrennt)
 *      board.blobs  [{id,kind:'bridge'|'ball'|'copper',a,b,x,y,r,ang,layer}]  Lötbrücke, Zinnperle, Kupferrest (verbindet zwei Punkte)
 *      board.wires  [{id,a:{x,y,side},b:{x,y,side}}]   Fädeldrähte (Reparatur)
 *      vias[].broken = true       gebrochenes Via (Hülse unterbrochen)
 *      parts[].cold = ['1','3']   kalte Lötstellen (Pin-Nummern), parts[].defect = 'open'|'short'
 *      board.repair = { faults:[info], soll:{parts,nets}, supply?:{net,v,gnd} }  Fehlerliste und Soll-Stand (für check)
 *  - Die Messwerte kommen aus einem eigenen Konnektivitätsgraphen (Pads, Bahnstücke, Vias je Lage, Zonen, Drähte, Lötbrücken),
 *    denn der Kern kennt keine Risse/Kaltlötstellen. Pads und Footprints kommen aus PCB_CORE.padsOf/footprint (sonst kleine Ersatzbibliothek).
 *  - Bauteil-Pinbelegung (wie KiCad): LED/Diode Pin 1 = Kathode, Pin 2 = Anode; Elko Pin 1 = Plus; 7805: 1 IN, 2 GND, 3 OUT;
 *    AMS1117 (SOT-223): 1 GND, 2 OUT, 3 IN; 555: 8 = VCC, 1 = GND.
 *  - API (PCB_REPAIR): inject(board, 'crack'|{kind,seed,ref,track,via,pad}) -> { board, info:{kind,name,desc,fix,where,layer,...} | null, error? }
 *      measure(board, probeA, probeB, mode, {power,t,rand}) mit Messspitze {pad:'R1.1'} oder {x,y,side:'top'|'bot'}, mode 'cont'|'res'|'volt'|'diode'
 *      -> { value, text, unit, beep, open, flaky, note, blocked }; operate(board,{t}) -> Betrieb (LED-Zustände, Hitze, Strom); check(board, soll) und
 *      verify(board) -> { ok, remaining:[{type,msg,...}], notes }; fix(board, {t:'reflow'|'wick'|'tweezer'|'knife'|'solderCut'|'viaFix'|'wire'|'unwire'|
 *      'rotate'|'remove'|'replace'|'insert', ...}) -> { board, ok, msg, fx }; autoFix(board) (Musterreparatur); faults (Liste id/name/group/desc); samples.
 *  - Verwendung in Aufgaben: PCB_REPAIR.inject(board, 'crack' | {kind,seed,ref,...}).board; Prüfung: PCB_REPAIR.verify(board).ok
 */
(function (root) {
  'use strict';

  const PCB_REPAIR = {};
  const C = () => root.PCB_CORE;
  const clone = o => JSON.parse(JSON.stringify(o));
  const hypot = Math.hypot;

  /* ================================================================ Teil 1: Logik */

  function rngOf(seed) { let s = ((seed == null ? 1 : seed) >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function shuffle(a, rnd) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* Werte lesen: 10k, 4k7, 2.2k, 100n, 10uF, 470R, 1M -> Zahl */
  function parseVal(v) {
    if (typeof v === 'number') return v;
    let s = String(v == null ? '' : v).trim().replace(/[ΩΩ\s]/g, '').replace(/ohm$/i, '').replace(/F$/, '').replace(',', '.');
    let m = /^(\d+)([RkKMmunpG])(\d+)?$/.exec(s);
    const mul = { R: 1, k: 1e3, K: 1e3, M: 1e6, G: 1e9, m: 1e-3, u: 1e-6, 'µ': 1e-6, n: 1e-9, p: 1e-12 };
    if (m) return parseFloat(m[1] + '.' + (m[3] || '0')) * mul[m[2]];
    m = /^(\d*\.?\d+)\s*([pnuµmkKMG]?)$/.exec(s);
    if (m) return parseFloat(m[1]) * (m[2] ? mul[m[2]] : 1);
    return NaN;
  }
  function sameValue(a, b) {
    const x = parseVal(a), y = parseVal(b);
    if (isFinite(x) && isFinite(y)) return Math.abs(x - y) <= 1e-6 * Math.max(Math.abs(x), Math.abs(y), 1e-12);
    return String(a || '').replace(/\s/g, '').toLowerCase() === String(b || '').replace(/\s/g, '').toLowerCase();
  }
  function fmtNum(x, dec) { let t = (+x).toFixed(dec == null ? 3 : dec); if (t.indexOf('.') >= 0) t = t.replace(/0+$/, '').replace(/\.$/, ''); return t; }
  function fmtVal(v, like) {
    const suf = /F$/.test(String(like || '')) ? 'F' : /Ω$/.test(String(like || '')) ? 'Ω' : '';
    const a = Math.abs(v); let t;
    if (a >= 1e6) t = fmtNum(v / 1e6) + 'M'; else if (a >= 1e3) t = fmtNum(v / 1e3) + 'k'; else if (a >= 1) t = fmtNum(v) + (like && /[ΩR]$/.test(like) ? '' : '');
    else if (a >= 1e-3) t = fmtNum(v * 1e3) + 'm'; else if (a >= 1e-6) t = fmtNum(v * 1e6) + 'u'; else if (a >= 1e-9) t = fmtNum(v * 1e9) + 'n'; else t = fmtNum(v * 1e12) + 'p';
    return t + suf;
  }
  const dec = (x, n) => (+x).toFixed(n).replace('.', ',');
  function fmtOhm(r) {
    if (r == null || !isFinite(r) || r >= 5e7) return 'OL';
    if (r >= 1e6) return dec(r / 1e6, 2) + ' MΩ';
    if (r >= 1e3) return dec(r / 1e3, r >= 1e4 ? 1 : 2) + ' kΩ';
    return dec(r, r < 10 ? 2 : 1) + ' Ω';
  }

  /* ---------- Geometrie: Kapseln (Strecke mit Radius) */
  function ptSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    const x = a.x + t * dx, y = a.y + t * dy; return { d: hypot(p.x - x, p.y - y), x, y, t };
  }
  function segInter(a, b, c, d) {
    const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y }, den = r.x * s.y - r.y * s.x;
    if (Math.abs(den) < 1e-12) return null;
    const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den, u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return { x: a.x + t * r.x, y: a.y + t * r.y };
    return null;
  }
  function segSeg(a, b, c, d) {
    const hit = segInter(a, b, c, d); if (hit) return { d: 0, pa: hit, pb: hit };
    let best = null;
    const tryit = (p, s0, s1, flip) => { const r = ptSeg(p, s0, s1); if (!best || r.d < best.d) best = flip ? { d: r.d, pa: { x: r.x, y: r.y }, pb: p } : { d: r.d, pa: p, pb: { x: r.x, y: r.y } }; };
    tryit(a, c, d, false); tryit(b, c, d, false); tryit(c, a, b, true); tryit(d, a, b, true);
    return best;
  }
  function capDist(A, B) { const r = segSeg(A.a, A.b, B.a, B.b); return { d: r.d - A.r - B.r, pa: r.pa, pb: r.pb }; }
  function bbox(caps, grow) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    caps.forEach(c => { x0 = Math.min(x0, c.a.x - c.r, c.b.x - c.r); x1 = Math.max(x1, c.a.x + c.r, c.b.x + c.r); y0 = Math.min(y0, c.a.y - c.r, c.b.y - c.r); y1 = Math.max(y1, c.a.y + c.r, c.b.y + c.r); });
    return { x0: x0 - (grow || 0), y0: y0 - (grow || 0), x1: x1 + (grow || 0), y1: y1 + (grow || 0) };
  }
  const bbHit = (p, q) => p.x0 <= q.x1 && q.x0 <= p.x1 && p.y0 <= q.y1 && q.y0 <= p.y1;
  function capsHit(A, B) { for (const a of A) for (const b of B) if (capDist(a, b).d <= 0) return true; return false; }
  function capsMin(A, B) { let best = null; for (const a of A) for (const b of B) { const r = capDist(a, b); if (!best || r.d < best.d) best = r; } return best; }
  function inPoly(p, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > p.y) !== (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function padCaps(p) {
    const w = p.w || 1, h = p.h || 1;
    if (p.shape === 'round' || Math.abs(w - h) < 1e-6) return [{ a: { x: p.x, y: p.y }, b: { x: p.x, y: p.y }, r: Math.max(w, h) / 2 * (p.shape === 'round' ? 1 : 0.92) }];
    if (w > h) { const k = (w - h) / 2; return [{ a: { x: p.x - k, y: p.y }, b: { x: p.x + k, y: p.y }, r: h / 2 }]; }
    const k = (h - w) / 2; return [{ a: { x: p.x, y: p.y - k }, b: { x: p.x, y: p.y + k }, r: w / 2 }];
  }
  function polyCaps(pts, w) {
    const out = [], r = (w || 0.25) / 2;
    if (pts.length === 1) return [{ a: { x: pts[0][0], y: pts[0][1] }, b: { x: pts[0][0], y: pts[0][1] }, r }];
    for (let i = 0; i < pts.length - 1; i++) out.push({ a: { x: pts[i][0], y: pts[i][1] }, b: { x: pts[i + 1][0], y: pts[i + 1][1] }, r });
    return out;
  }

  /* ---------- Footprints: Kern oder kleine Ersatzbibliothek */
  const FB_FP = (function () {
    const f = {}, rect = (w, h) => ({ x: -w / 2, y: -h / 2, w, h });
    const two = (id, name, kind, pitch, pw, ph, shape, drill, body) => { f[id] = { id, name, kind, pads: [{ n: '1', x: -pitch / 2, y: 0, shape: shape, w: pw, h: ph, drill }, { n: '2', x: pitch / 2, y: 0, shape: shape, w: pw, h: ph, drill }], silk: [], courtyard: rect(pitch + pw + 1, Math.max(ph, body || 0) + 1), bodyH: 3 }; };
    two('R_AXIAL_10', 'Widerstand axial 10,16', 'tht', 10.16, 1.8, 1.8, 'round', 0.9, 2.5); two('R_AXIAL_7', 'Widerstand axial 7,62', 'tht', 7.62, 1.8, 1.8, 'round', 0.9, 2.5);
    two('C_RADIAL_2.5', 'Elko radial 2,5', 'tht', 2.5, 1.6, 1.6, 'round', 0.8, 5); two('C_RADIAL_5', 'Elko radial 5', 'tht', 5, 1.8, 1.8, 'round', 0.9, 8);
    two('LED_5MM', 'LED 5 mm', 'tht', 2.54, 1.8, 1.8, 'round', 0.9, 5); two('HDR_1x2', 'Stiftleiste 1x2', 'tht', 2.54, 1.7, 1.7, 'round', 1.0, 2.5); f['HDR_1x2'].pads.forEach(function (q) { q.y = q.x; q.x = 0; });
    two('R0603', 'Widerstand 0603', 'smd', 1.6, 0.9, 1.0, 'rect'); two('C0603', 'Kondensator 0603', 'smd', 1.6, 0.9, 1.0, 'rect'); two('LED0603', 'LED 0603', 'smd', 1.6, 0.9, 1.0, 'rect');
    two('R0805', 'Widerstand 0805', 'smd', 2.0, 1.0, 1.4, 'rect'); two('SOD-123', 'Diode SOD-123', 'smd', 3.3, 1.0, 1.2, 'rect');
    const dip = (id, n, rows) => { const pads = [], half = n / 2; for (let i = 0; i < half; i++) { pads.push({ n: String(i + 1), x: -rows / 2, y: (-(half - 1) / 2 + i) * 2.54, shape: i === 0 ? 'rect' : 'oval', w: 1.6, h: 1.6, drill: 0.8 }); pads.push({ n: String(n - i), x: rows / 2, y: (-(half - 1) / 2 + i) * 2.54, shape: 'oval', w: 1.6, h: 1.6, drill: 0.8 }); } pads.sort((a, b) => +a.n - +b.n); f[id] = { id, name: id, kind: 'tht', pads, silk: [], courtyard: rect(rows + 2.6, half * 2.54 + 1), bodyH: 4 }; };
    dip('DIP-8', 8, 7.62); dip('DIP-14', 14, 7.62);
    const soic = (id, n) => { const pads = [], half = n / 2; for (let i = 0; i < half; i++) { pads.push({ n: String(i + 1), x: -2.7, y: (-(half - 1) / 2 + i) * 1.27, shape: 'rect', w: 1.5, h: 0.6 }); pads.push({ n: String(n - i), x: 2.7, y: (-(half - 1) / 2 + i) * 1.27, shape: 'rect', w: 1.5, h: 0.6 }); } pads.sort((a, b) => +a.n - +b.n); f[id] = { id, name: id, kind: 'smd', pads, silk: [], courtyard: rect(7.4, half * 1.27 + 1), bodyH: 1.5 }; };
    soic('SOIC-8', 8);
    f['TO-220'] = { id: 'TO-220', name: 'TO-220', kind: 'tht', pads: [1, 2, 3].map((n, i) => ({ n: String(n), x: (i - 1) * 2.54, y: 0, shape: i === 0 ? 'rect' : 'oval', w: 1.8, h: 1.8, drill: 1.0 })), silk: [], courtyard: rect(10.4, 4.7), bodyH: 9 };
    f['TO-92'] = { id: 'TO-92', name: 'TO-92', kind: 'tht', pads: [1, 2, 3].map((n, i) => ({ n: String(n), x: (i - 1) * 1.27, y: 0, shape: 'round', w: 1.2, h: 1.2, drill: 0.7 })), silk: [], courtyard: rect(5, 4), bodyH: 5 };
    f['SOT-223'] = { id: 'SOT-223', name: 'SOT-223', kind: 'smd', pads: [{ n: '1', x: -2.3, y: 3.15, shape: 'rect', w: 1.0, h: 1.8 }, { n: '2', x: 0, y: 3.15, shape: 'rect', w: 1.0, h: 1.8 }, { n: '3', x: 2.3, y: 3.15, shape: 'rect', w: 1.0, h: 1.8 }, { n: '4', x: 0, y: -3.15, shape: 'rect', w: 3.4, h: 1.8 }], silk: [], courtyard: rect(7.6, 8.4), bodyH: 1.8 };
    return f;
  })();
  function fpOf(id) {
    const c = C();
    if (c) { try { if (c.footprint) { const f = c.footprint(id); if (f) return f; } } catch (e) {} if (c.footprints && c.footprints[id]) return c.footprints[id]; }
    return FB_FP[id] || FB_FP.R_AXIAL_10;
  }
  function layerListOf(board) {
    const c = C(); if (c && c.layerList) { try { return c.layerList(board); } catch (e) {} }
    const n = board.layers || 2; return n === 6 ? ['F.Cu', 'In1.Cu', 'In2.Cu', 'In3.Cu', 'In4.Cu', 'B.Cu'] : n === 4 ? ['F.Cu', 'In1.Cu', 'In2.Cu', 'B.Cu'] : ['F.Cu', 'B.Cu'];
  }
  function netMap(board) { const m = {}; (board.nets || []).forEach(n => (n.pins || []).forEach(p => { m[p] = n.name; })); return m; }

  /* Pads in Weltkoordinaten (Kern bevorzugt) */
  function worldPads(board) {
    const nm = netMap(board), c = C(), all = layerListOf(board);
    const partOf = {}; (board.parts || []).forEach(p => { partOf[p.ref] = p; });
    let list = null;
    if (c && c.padsOf) { try { list = c.padsOf(board); } catch (e) { list = null; } }
    if (!list) {
      list = [];
      (board.parts || []).forEach(p => {
        const f = fpOf(p.fp), th = -(((p.rot || 0) % 360 + 360) % 360), cs = Math.cos(th * Math.PI / 180), sn = Math.sin(th * Math.PI / 180);
        f.pads.forEach(pd => {
          let x = pd.x, y = pd.y; if (p.side === 'bot') x = -x;
          const wx = p.x + x * cs - y * sn, wy = p.y + x * sn + y * cs, sw = Math.abs(th) % 180 === 90;
          list.push({ ref: p.ref, n: pd.n, x: wx, y: wy, w: sw ? pd.h : pd.w, h: sw ? pd.w : pd.h, shape: pd.shape, drill: pd.drill, worldWH: true });
        });
      });
    }
    return list.map(pd => {
      const p = partOf[pd.ref] || {}, side = p.side === 'bot' ? 'bot' : 'top', f = fpOf(p.fp);
      let w = pd.w, h = pd.h;
      if (!pd.worldWH && ((p.rot || 0) % 180 + 180) % 180 === 90) { const lp = f.pads.find(q => q.n === pd.n); if (lp && lp.w !== lp.h && Math.abs(w - lp.w) < 1e-6 && Math.abs(h - lp.h) < 1e-6) { w = lp.h; h = lp.w; } }
      const layers = pd.layers && pd.layers.length ? pd.layers : (pd.drill ? all : [side === 'bot' ? 'B.Cu' : 'F.Cu']);
      const key = pd.ref + '.' + pd.n;
      return { key, ref: pd.ref, n: pd.n, x: pd.x, y: pd.y, w, h, shape: pd.shape || 'rect', drill: pd.drill, side, layers: layers.length > 2 && !pd.drill ? layers : layers, net: nm[key] || pd.net || null };
    });
  }

  /* ---------- Bauteilmodelle */
  const DB = {
    '555': { vcc: '8', gnd: '1', out: '3' }
  };
  function classify(p) {
    const ref = String(p.ref || ''), fp = String(p.fp || '').toUpperCase(), val = String(p.value || '');
    const L = ref.replace(/[0-9]/g, '').toUpperCase();
    if (/LED/.test(fp) || L === 'LED' || (L === 'D' && /LED/i.test(val))) return { k: 'led', K: '1', A: '2', vf: /blau|blue/i.test(val) ? 3.0 : /gr[uü]n|green/i.test(val) ? 2.1 : /wei|white/i.test(val) ? 3.0 : /gelb|yell/i.test(val) ? 2.0 : 1.9 };
    if (L === 'D' || L === 'ZD') return { k: 'diode', K: '1', A: '2', vf: /BAT|SS|SCHOTTKY|1N581/i.test(val) ? 0.3 : 0.65 };
    if (L === 'R' || L === 'RN' || L === 'VR' || L === 'RV') return { k: 'res' };
    if (L === 'C') return /RADIAL|ELKO|CP_|POL|TANT/.test(fp) && /^[0-9.,]+\s*[uµ]/i.test(val) ? { k: 'cap', pol: true, plus: '1', minus: '2' } : { k: 'cap' };
    if (L === 'F') return { k: 'fuse' };
    if (L === 'L') return { k: 'ind' };
    if (L === 'U' || L === 'IC') {
      if (/78L?\d\d|AMS1117|LD1117|LM1117|MCP1700|LDO|LM317/i.test(val)) {
        let v = 5; const m1 = /78L?(\d\d)/.exec(val), m2 = /(\d)[.,V](\d)/.exec(val); if (m1) v = +m1[1]; else if (m2) v = parseFloat(m2[1] + '.' + m2[2]);
        const sot = /SOT-223/.test(fp) || /AMS1117|LD1117|LM1117|MCP1700/i.test(val);
        return { k: 'reg', v, drop: /78/.test(val) ? 2 : 1.1, IN: sot ? '3' : '1', GND: sot ? '1' : '2', OUT: sot ? '2' : '3' };
      }
      if (/555/.test(val)) return { k: 'ic', t: '555', vcc: '8', gnd: '1', out: '3' };
      if (/TL07|TL08|LM358|LM324|NE5532|OPA|MCP60|LM741|LF35/i.test(val)) return { k: 'ic', t: 'opamp', vcc: '8', gnd: '4' };
      return { k: 'ic' };
    }
    if (L === 'Q' || L === 'T') return { k: 'tr' };
    if (L === 'SW' || L === 'S') return { k: 'sw' };
    if (L === 'J' || L === 'X' || L === 'P' || L === 'CN' || L === 'K' || L === 'BT' || L === 'BAT') return { k: 'conn' };
    return { k: 'other' };
  }
  PCB_REPAIR.classify = classify;
  const isIC = cl => cl.k === 'ic' || cl.k === 'reg' || cl.k === 'tr';
  const isPolar = cl => cl.k === 'led' || cl.k === 'diode' || (cl.k === 'cap' && cl.pol);

  /* ---------- Konnektivitätsgraph */
  const GCACHE = new WeakMap();
  function gsig(board) { return JSON.stringify([board.parts, board.tracks, board.vias, board.zones, board.cuts, board.blobs, board.wires, board.layers, board.nets]); }

  function buildGraph(board) {
    const sig = gsig(board), hit = GCACHE.get(board);
    if (hit && hit.sig === sig) return hit.g;
    const pads = worldPads(board), layers = layerListOf(board), lidx = {}; layers.forEach((l, i) => { lidx[l] = i; });
    const nodes = [], P = [], PS = [];
    const add = (o) => { nodes.push(o); P.push(P.length); PS.push(PS.length); return nodes.length - 1; };
    const find = (a, i) => { while (a[i] !== i) { a[i] = a[a[i]]; i = a[i]; } return i; };
    const un = (a, b, solid) => { P[find(P, a)] = find(P, b); if (solid !== false) PS[find(PS, a)] = find(PS, b); };
    const g = { sig, nodes, pads, layers, padNode: {}, termNode: {}, cold: {} };
    pads.forEach(pd => { pd.caps = padCaps(pd); pd.bb = bbox(pd.caps, 0.05); pd.node = add({ kind: 'pad', pad: pd }); g.padNode[pd.key] = pd.node; });
    // Bahnstücke (Risse trennen)
    const pieces = [];
    (board.tracks || []).forEach(t => {
      const cuts = (board.cuts || []).filter(c => c.track === t.id);
      let ps = [{ pts: (t.pts || []).map(p => [p[0], p[1]]), nj: new Set() }];
      cuts.forEach(c => {
        let best = null;
        ps.forEach((pc, pi) => { for (let i = 0; i < pc.pts.length - 1; i++) { const r = ptSeg({ x: c.x, y: c.y }, { x: pc.pts[i][0], y: pc.pts[i][1] }, { x: pc.pts[i + 1][0], y: pc.pts[i + 1][1] }); if (!best || r.d < best.d) best = { d: r.d, pi, i, x: r.x, y: r.y }; } });
        if (!best) return;
        const pc = ps[best.pi], A = { pts: pc.pts.slice(0, best.i + 1).concat([[best.x, best.y]]), nj: new Set(pc.nj) }, B = { pts: [[best.x, best.y]].concat(pc.pts.slice(best.i + 1)), nj: new Set(pc.nj) };
        A.nj.add(B); B.nj.add(A); ps.splice(best.pi, 1, A, B);
      });
      ps.forEach(pc => { const o = { t, pts: pc.pts, src: pc, nj: pc.nj, layer: t.layer, caps: polyCaps(pc.pts, t.w) }; o.bb = bbox(o.caps, 0.05); o.node = add({ kind: 'trk', track: t, piece: o }); pieces.push(o); });
    });
    // Vias: ein Knoten je Lage
    const viaN = [];
    (board.vias || []).forEach(v => {
      const f = lidx[v.from || layers[0]], tt = lidx[v.to || layers[layers.length - 1]], a = Math.min(f, tt), b = Math.max(f, tt), vn = { v, byLayer: {}, caps: [{ a: { x: v.x, y: v.y }, b: { x: v.x, y: v.y }, r: (v.dia || 0.8) / 2 }] };
      vn.bb = bbox(vn.caps, 0.05);
      for (let i = a; i <= b; i++) vn.byLayer[layers[i]] = add({ kind: 'via', via: v, layer: layers[i] });
      const ids = Object.keys(vn.byLayer).map(k => vn.byLayer[k]); if (!v.broken) for (let i = 1; i < ids.length; i++) un(ids[0], ids[i]);
      viaN.push(vn);
    });
    // Zonen
    const zoneN = (board.zones || []).map(z => ({ z, node: add({ kind: 'zone', zone: z }) }));
    // Pads untereinander und mit Bahnen
    for (let i = 0; i < pads.length; i++) for (let j = i + 1; j < pads.length; j++) {
      const a = pads[i], b = pads[j]; if (!bbHit(a.bb, b.bb) || !a.layers.some(l => b.layers.indexOf(l) >= 0)) continue;
      if (capsHit(a.caps, b.caps)) un(a.node, b.node);
    }
    pieces.forEach(pc => {
      pads.forEach(pd => { if (pd.layers.indexOf(pc.layer) >= 0 && bbHit(pc.bb, pd.bb) && capsHit(pc.caps, pd.caps)) un(pc.node, pd.node); });
      viaN.forEach(vn => { const nd = vn.byLayer[pc.layer]; if (nd != null && bbHit(pc.bb, vn.bb)) { let ok = false; for (const c of pc.caps) if (ptSeg(vn.v, c.a, c.b).d <= c.r + 0.05) ok = true; if (ok) un(pc.node, nd); } });
    });
    for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i], b = pieces[j]; if (a.layer !== b.layer || a.nj.has(b.src) || !bbHit(a.bb, b.bb)) continue;
      if (capsHit(a.caps, b.caps)) un(a.node, b.node);
    }
    viaN.forEach(vn => pads.forEach(pd => {
      if (!bbHit(vn.bb, pd.bb)) return;
      Object.keys(vn.byLayer).forEach(l => { if (pd.layers.indexOf(l) >= 0 && capsMin(vn.caps.map(c => ({ a: c.a, b: c.b, r: 0.01 })), pd.caps).d <= 0) un(vn.byLayer[l], pd.node); });
    }));
    zoneN.forEach(zn => {
      const z = zn.z, l = z.layer;
      pads.forEach(pd => { if (pd.layers.indexOf(l) >= 0 && pd.net && pd.net === z.net && inPoly(pd, z.poly)) un(zn.node, pd.node); });
      viaN.forEach(vn => { if (vn.byLayer[l] != null && vn.v.net === z.net && inPoly(vn.v, z.poly)) un(zn.node, vn.byLayer[l]); });
      pieces.forEach(pc => { if (pc.layer === l && pc.t.net === z.net && pc.pts.some(p => inPoly({ x: p[0], y: p[1] }, z.poly))) un(zn.node, pc.node); });
    });
    // Suche: Knoten an einem Punkt
    const nodeAt = (x, y, layer, tol) => {
      tol = tol == null ? 0.2 : tol; const pt = { x, y }; let best = -1, bd = 1e9;
      pads.forEach(pd => { if (pd.layers.indexOf(layer) < 0) return; const d = capsMin([{ a: pt, b: pt, r: 0 }], pd.caps).d; if (d <= tol && d < bd - 1e-9) { bd = d; best = pd.node; } });
      if (best >= 0) return best;
      viaN.forEach(vn => { const nd = vn.byLayer[layer]; if (nd == null) return; const d = hypot(x - vn.v.x, y - vn.v.y) - (vn.v.dia || 0.8) / 2; if (d <= tol && d < bd) { bd = d; best = nd; } });
      if (best >= 0) return best;
      pieces.forEach(pc => { if (pc.layer !== layer) return; for (const c of pc.caps) { const d = ptSeg(pt, c.a, c.b).d - c.r; if (d <= tol && d < bd) { bd = d; best = pc.node; } } });
      if (best >= 0) return best;
      zoneN.forEach(zn => { if (zn.z.layer === layer && inPoly(pt, zn.z.poly)) best = zn.node; });
      return best;
    };
    g.nodeAt = nodeAt;
    const sideLayer = s => (s === 'bot' || s === 'B' || s === 'B.Cu') ? 'B.Cu' : 'F.Cu';
    // Drähte und Lötbrücken
    (board.wires || []).forEach(w => { const a = nodeAt(w.a.x, w.a.y, sideLayer(w.a.side), 0.35), b = nodeAt(w.b.x, w.b.y, sideLayer(w.b.side), 0.35); if (a >= 0 && b >= 0) un(a, b); });
    (board.blobs || []).forEach(bl => { const a = nodeAt(bl.a.x, bl.a.y, bl.layer || 'F.Cu', 0.2), b = nodeAt(bl.b.x, bl.b.y, bl.layer || 'F.Cu', 0.2); if (a >= 0 && b >= 0) un(a, b); });
    // Anschlüsse der Bauteile (kalte Lötstellen trennen nur im soliden Graphen)
    (board.parts || []).forEach(part => {
      const cold = part.cold || [];
      pads.filter(pd => pd.ref === part.ref).forEach(pd => {
        const t = add({ kind: 'term', pad: pd, part }); g.termNode[pd.key] = t;
        const isCold = cold.indexOf(pd.n) >= 0; if (isCold) g.cold[pd.key] = true;
        P[find(P, t)] = find(P, pd.node); if (!isCold) PS[find(PS, t)] = find(PS, pd.node);
      });
    });
    g.P = P; g.PS = PS; g.find = find;
    g.comp = (i, solid) => find(solid ? PS : P, i);
    g.layerOf = sideLayer;
    GCACHE.set(board, { sig, g });
    return g;
  }

  /* ---------- Messpunkte */
  function resolveProbe(board, probe) {
    const g = buildGraph(board); if (!probe) return { idx: -1 };
    if (probe.pad) { const i = g.padNode[probe.pad]; return { idx: i == null ? -1 : i, label: 'Pad ' + probe.pad.replace('.', ' Pin ') }; }
    const layer = probe.layer || g.layerOf(probe.side);
    const i = g.nodeAt(probe.x, probe.y, layer, probe.tol);
    if (i < 0) return { idx: -1, label: 'Leerstelle' };
    const nd = g.nodes[i];
    const label = nd.kind === 'pad' ? 'Pad ' + nd.pad.ref + ' Pin ' + nd.pad.n : nd.kind === 'via' ? 'Via' : nd.kind === 'zone' ? 'Kupferfläche' : 'Leiterbahn ' + (layer === 'B.Cu' ? 'Rückseite' : layer === 'F.Cu' ? 'Vorderseite' : layer);
    return { idx: i, label, kind: nd.kind };
  }
  PCB_REPAIR.probeAt = resolveProbe;

  /* Elemente für die Widerstandsmessung */
  const OPEN = 1e12;
  function resElements(board, g) {
    const els = [];
    (board.parts || []).forEach(p => {
      const cl = classify(p), t = n => g.termNode[p.ref + '.' + n];
      const A = (a, b, r) => { if (t(a) != null && t(b) != null && isFinite(r)) els.push({ a: t(a), b: t(b), r: Math.max(r, 1e-3), ref: p.ref }); };
      if (cl.k === 'res') { const v = parseVal(p.value); A('1', '2', p.defect === 'open' ? OPEN : p.defect === 'short' ? 0.05 : (isFinite(v) ? v : OPEN)); }
      else if (cl.k === 'cap') { if (p.defect === 'short') A('1', '2', 0.4); }
      else if (cl.k === 'fuse' || cl.k === 'ind') A('1', '2', p.defect === 'open' ? OPEN : 0.1);
      else if ((cl.k === 'led' || cl.k === 'diode') && p.defect === 'short') A('1', '2', 0.2);
      else if (cl.k === 'sw') { if (p.closed) A('1', '2', 0.05); }
    });
    return els;
  }
  /* Ersatzwiderstand zwischen zwei Komponenten (Laplace-Matrix) */
  function effRes(els, ca, cb, solid, g) {
    if (ca === cb) return 0;
    const cm = i => g.comp(i, solid);
    const edges = els.map(e => ({ a: cm(e.a), b: cm(e.b), r: e.r })).filter(e => e.a !== e.b);
    const adj = new Map(); const push = (x, y) => { if (!adj.has(x)) adj.set(x, []); adj.get(x).push(y); };
    edges.forEach(e => { push(e.a, e.b); push(e.b, e.a); });
    const seen = new Set([ca]), q = [ca]; while (q.length) { const x = q.pop(); (adj.get(x) || []).forEach(y => { if (!seen.has(y)) { seen.add(y); q.push(y); } }); }
    if (!seen.has(cb)) return Infinity;
    const ids = [...seen].filter(x => x !== cb), ix = new Map(); ids.forEach((x, i) => ix.set(x, i));
    const n = ids.length, M = []; for (let i = 0; i < n; i++) M.push(new Array(n + 1).fill(0));
    edges.forEach(e => { if (!seen.has(e.a) || !seen.has(e.b)) return; const gc = 1 / e.r, i = ix.get(e.a), j = ix.get(e.b); if (i != null) M[i][i] += gc; if (j != null) M[j][j] += gc; if (i != null && j != null) { M[i][j] -= gc; M[j][i] -= gc; } });
    M[ix.get(ca)][n] = 1;
    const v = gauss(M, n); if (!v) return Infinity; return v[ix.get(ca)];
  }
  function gauss(M, n) {
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-18) return null; const t = M[c]; M[c] = M[p]; M[p] = t;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((row, i) => row[n] / row[i]);
  }

  /* ---------- Betrieb: einfaches Gleichstrommodell */
  function supplyOf(board) {
    if (board.repair && board.repair.supply) return board.repair.supply;
    const cand = []; (board.nets || []).forEach(n => {
      const nm = String(n.name || ''); let v = null, m;
      if ((m = /^\+?(\d+)V(\d)?$/i.exec(nm))) v = parseFloat(m[1] + (m[2] ? '.' + m[2] : '')); else if (/^(V?CC|VIN|VBAT|\+V|VDD)$/i.test(nm)) v = 5; else if ((m = /^\+(\d+(?:\.\d+)?)V?$/i.exec(nm))) v = parseFloat(m[1]);
      if (v != null) cand.push({ net: nm, v, n });
    });
    let pick = cand.find(c => c.n.pins.some(p => /^(J|X|P|CN|BT|BAT)\d/i.test(p))) || cand[0];
    const gnd = (board.nets || []).find(n => /^(GND|0V|VSS|MASSE)$/i.test(n.name));
    return pick ? { net: pick.net, v: pick.v, gnd: gnd ? gnd.name : 'GND' } : null;
  }
  PCB_REPAIR.supplyOf = supplyOf;
  function coldOn(key, t, mode) {
    if (mode === 'open') return false; if (mode === 'closed') return true;
    let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const x = ((t || 0) * 1.7 + (h % 97) / 97) % 1; return x < 0.55;
  }
  function operate(board, opts) {
    opts = opts || {}; const g = buildGraph(board), t = opts.t || 0;
    const res = { powered: false, V: () => 0, leds: [], hot: [], notes: [], short: false, mA: 0, comps: 0 };
    const sup = supplyOf(board); if (!sup) { res.notes.push('Keine Versorgung erkannt.'); return res; }
    // Union-Find mit kalten Stellen nach Zeitmuster
    const Q = g.PS.slice(); const fq = i => { while (Q[i] !== i) { Q[i] = Q[Q[i]]; i = Q[i]; } return i; };
    Object.keys(g.cold).forEach(k => { if (coldOn(k, t, opts.cold)) { const a = fq(g.termNode[k]), b = fq(g.padNode[k]); Q[a] = b; } });
    const cm = i => fq(i);
    const padComp = key => (g.padNode[key] == null ? -1 : cm(g.padNode[key]));
    const termComp = key => (g.termNode[key] == null ? -1 : cm(g.termNode[key]));
    // Quelle und Masse
    const sp = g.pads.filter(p => p.net === sup.net), gp = g.pads.filter(p => p.net === sup.gnd);
    const conn = pd => /^(J|X|P|CN|BT|BAT)\d/i.test(pd.ref);
    const srcPads = sp.filter(conn).length ? sp.filter(conn) : sp.slice(0, 1), gndPads = gp.filter(conn).length ? gp.filter(conn) : gp.slice(0, 1);
    if (!srcPads.length || !gndPads.length) { res.notes.push('Anschluss für die Versorgung fehlt.'); return res; }
    const src = new Set(srcPads.map(p => termComp(p.key)).filter(x => x >= 0)), gnd = new Set(gndPads.map(p => termComp(p.key)).filter(x => x >= 0));
    if (!src.size || !gnd.size) { res.notes.push('Anschluss für die Versorgung fehlt.'); return res; }
    const sc = [...src][0], gc = [...gnd][0];
    // Elemente
    const R = [], D = [], regs = [], c555 = [], caps = [];
    (board.parts || []).forEach(p => {
      const cl = classify(p), tc = n => termComp(p.ref + '.' + n);
      if (cl.k === 'res') { const v = parseVal(p.value); const a = tc('1'), b = tc('2'); if (a >= 0 && b >= 0 && p.defect !== 'open') R.push({ a, b, g: 1 / Math.max(p.defect === 'short' ? 0.05 : (isFinite(v) ? v : OPEN), 0.05), ref: p.ref }); }
      else if (cl.k === 'cap') { const a = tc('1'), b = tc('2'); if (p.defect === 'short' && a >= 0 && b >= 0) R.push({ a, b, g: 1 / 0.4, ref: p.ref }); if (cl.pol) caps.push({ ref: p.ref, plus: tc(cl.plus), minus: tc(cl.minus) }); }
      else if (cl.k === 'fuse' || cl.k === 'ind') { const a = tc('1'), b = tc('2'); if (a >= 0 && b >= 0 && p.defect !== 'open') R.push({ a, b, g: 10, ref: p.ref }); }
      else if (cl.k === 'sw') { const a = tc('1'), b = tc('2'); if (a >= 0 && b >= 0) R.push({ a, b, g: p.closed === false ? 0 : 20, ref: p.ref }); }
      else if (cl.k === 'led' || cl.k === 'diode') { const a = tc(cl.A), k = tc(cl.K); if (p.defect === 'short' && a >= 0 && k >= 0) R.push({ a, b: k, g: 5, ref: p.ref }); else if (p.defect !== 'open' && a >= 0 && k >= 0) D.push({ a, k, vf: cl.vf, rd: cl.k === 'led' ? 8 : 2, on: false, ref: p.ref, led: cl.k === 'led' }); }
      else if (cl.k === 'reg') regs.push({ cl, ref: p.ref, i: tc(cl.IN), gnd: tc(cl.GND), o: tc(cl.OUT), part: p });
      else if (cl.k === 'ic' && cl.t === '555') c555.push({ cl, ref: p.ref, vcc: tc(cl.vcc), gnd: tc(cl.gnd), o: tc(cl.out), part: p });
      else if (cl.k === 'ic' && cl.t === 'opamp') c555.push({ cl, ref: p.ref, vcc: tc(cl.vcc), gnd: tc(cl.gnd), o: -1, part: p, opamp: true });
    });
    if (sc === gc) { res.short = true; res.notes.push('Kurzschluss zwischen Plus und Masse: das Netzteil schaltet ab (Strombegrenzung).'); res.V = () => 0; return res; }
    // Quellen: fest
    const fixed = new Map(); fixed.set(gc, 0); src.forEach(c => { if (c !== gc) fixed.set(c, sup.v); });
    gnd.forEach(c => fixed.set(c, 0));
    let outs = new Map(); // reg und 555 Ausgänge
    let V = new Map();
    const all = new Set(); R.forEach(e => { all.add(e.a); all.add(e.b); }); D.forEach(e => { all.add(e.a); all.add(e.k); }); regs.forEach(r => { [r.i, r.o, r.gnd].forEach(c => c >= 0 && all.add(c)); });
    c555.forEach(r => { [r.vcc, r.gnd, r.o].forEach(c => c >= 0 && all.add(c)); }); caps.forEach(c => { c.plus >= 0 && all.add(c.plus); c.minus >= 0 && all.add(c.minus); });
    fixed.forEach((v, c) => all.add(c));
    let converged = false;
    for (let it = 0; it < 40 && !converged; it++) {
      const fx = new Map(fixed); outs.forEach((v, c) => { if (!fx.has(c)) fx.set(c, v); });
      const unk = [...all].filter(c => !fx.has(c)), ix = new Map(); unk.forEach((c, i) => ix.set(c, i));
      const n = unk.length, M = []; for (let i = 0; i < n; i++) { M.push(new Array(n + 1).fill(0)); M[i][i] += 1e-9; }
      const stamp = (a, b, gcnd, i0) => { // Strom a->b = g (Va-Vb) - i0
        const ia = ix.get(a), ib = ix.get(b);
        if (ia != null) { M[ia][ia] += gcnd; M[ia][n] += i0; if (ib != null) M[ia][ib] -= gcnd; else M[ia][n] += gcnd * fx.get(b); }
        if (ib != null) { M[ib][ib] += gcnd; M[ib][n] -= i0; if (ia != null) M[ib][ia] -= gcnd; else M[ib][n] += gcnd * fx.get(a); }
      };
      R.forEach(e => { if (e.a !== e.b) stamp(e.a, e.b, e.g, 0); });
      D.forEach(d => { if (d.on && d.a !== d.k) stamp(d.a, d.k, 1 / d.rd, d.vf / d.rd); });
      regs.forEach(r => { const ii = ix.get(r.i); if (ii != null && r.load) M[ii][n] -= r.load; });
      const sol = n ? gauss(M, n) : [];
      if (!sol) { res.notes.push('Das Netz ließ sich nicht berechnen.'); return res; }
      V = new Map(fx); unk.forEach((c, i) => V.set(c, sol[i]));
      let changed = false;
      regs.concat(c555.filter(r => !r.opamp)).forEach(r => { if (r.o < 0) return; let il = 0; R.forEach(e => { if (e.a === r.o) il += e.g * (V.get(e.a) - V.get(e.b)); if (e.b === r.o) il += e.g * (V.get(e.b) - V.get(e.a)); }); D.forEach(d => { if (d.on && d.a === r.o) il += (V.get(d.a) - V.get(d.k) - d.vf) / d.rd; }); il = Math.max(0, il); if (Math.abs(il - (r.load || 0)) > 1e-5) changed = true; r.load = il; });
      D.forEach(d => { const on = (V.get(d.a) - V.get(d.k)) > d.vf + (d.on ? -0.02 : 0.0); if (on !== d.on) { d.on = on; changed = true; } });
      // Regler und Zeitgeber
      const nout = new Map();
      regs.forEach(r => {
        if (r.i < 0 || r.o < 0 || r.gnd < 0 || r.o === r.i || r.o === r.gnd) { return; }
        const vin = (V.get(r.i) || 0) - (V.get(r.gnd) || 0); let vo = vin >= r.cl.v + r.cl.drop ? r.cl.v : Math.max(0, vin - r.cl.drop);
        if (r.part.defect === 'open') vo = 0; nout.set(r.o, vo + (V.get(r.gnd) || 0));
      });
      c555.forEach(r => {
        if (r.opamp || r.o < 0) return; const vc = V.get(r.vcc), vg = V.get(r.gnd), ok = vc != null && vg != null && vc - vg >= 4.5 && vc - vg <= 16.5;
        const per = r.part.period || 1; const hi = (t % per) < per * 0.5;
        nout.set(r.o, ok ? (hi ? vc - 1.7 : vg + 0.1) : vg == null ? 0 : vg); r.ok = ok;
      });
      let diff = changed; nout.forEach((v, c) => { if (Math.abs((outs.get(c) || 0) - v) > 1e-4) diff = true; }); outs = nout;
      if (!diff) converged = true;
    }
    res.comps = all.size; res.powered = true;
    res.V = c => (V.has(c) ? V.get(c) : 0);
    res.Vnode = idx => { if (idx < 0) return null; const c = cm(idx); return V.has(c) ? V.get(c) : 0; };
    res.floating = idx => { const c = cm(idx); return !V.has(c); };
    // Auswertung
    D.forEach(d => { const i = Math.max(0, (V.get(d.a) - V.get(d.k) - d.vf) / d.rd) * 1000; if (d.led) { res.leds.push({ ref: d.ref, on: d.on && i > 0.05, mA: i, level: Math.min(1, i / 12) }); if (i > 45) res.hot.push({ ref: d.ref, msg: d.ref + ' bekommt viel zu viel Strom (' + Math.round(i) + ' mA) und brennt durch.' }); } });
    caps.forEach(c => { if (c.plus >= 0 && c.minus >= 0 && V.get(c.plus) != null && V.get(c.minus) != null && V.get(c.minus) - V.get(c.plus) > 1) res.hot.push({ ref: c.ref, msg: c.ref + ' (Elko) ist falsch herum eingebaut: er wird heiß und kann platzen.' }); });
    c555.forEach(r => { const vc = V.get(r.vcc), vg = V.get(r.gnd); if (vc != null && vg != null && vg - vc > 1) res.hot.push({ ref: r.ref, msg: r.ref + ' steckt verdreht: Plus und Masse sind vertauscht, der Baustein wird heiß.' }); else if (r.ok === false && !r.opamp) res.notes.push(r.ref + ' bekommt keine richtige Betriebsspannung und läuft nicht.'); });
    regs.forEach(r => { const vin = (V.get(r.i) || 0) - (V.get(r.gnd) || 0); if (r.i >= 0 && (V.get(r.i) || 0) < (V.get(r.gnd) || 0) - 0.5) res.hot.push({ ref: r.ref, msg: r.ref + ' hat die Spannung verkehrt herum.' }); });
    // Strom aus der Quelle
    let I = 0; R.forEach(e => { if (src.has(e.a)) I += e.g * (V.get(e.a) - V.get(e.b)); if (src.has(e.b)) I += e.g * (V.get(e.b) - V.get(e.a)); });
    D.forEach(d => { if (d.on) { const i = (V.get(d.a) - V.get(d.k) - d.vf) / d.rd; if (src.has(d.a)) I += i; if (src.has(d.k)) I -= i; } });
    regs.forEach(r => { if (src.has(r.i)) I += r.load || 0; }); c555.forEach(r => { if (src.has(r.vcc) && r.ok) I += (r.load || 0) + 0.003; });
    res.mA = I * 1000; res.supply = sup;
    return res;
  }
  PCB_REPAIR.operate = operate;

  /* ---------- Messen */
  function measure(board, probeA, probeB, mode, opts) {
    opts = opts || {}; const g = buildGraph(board), rnd = opts.rand || Math.random;
    const a = resolveProbe(board, probeA), b = resolveProbe(board, probeB);
    const out = { mode, value: null, unit: '', text: 'OL', open: true, beep: false, flaky: false, note: '', a: a.label, b: b.label, power: !!opts.power };
    if (a.idx < 0 || b.idx < 0) { out.note = 'Eine Messspitze berührt kein Kupfer.'; if (mode === 'volt' && !opts.power) { out.text = '0,00 V'; out.value = 0; out.unit = 'V'; out.open = false; out.note = 'Betrieb ist aus; außerdem berührt eine Spitze kein Kupfer.'; } return out; }
    if (mode === 'volt') {
      out.unit = 'V';
      if (!opts.power) { out.value = 0; out.text = '0,00 V'; out.open = false; out.note = 'Die Baugruppe ist nicht in Betrieb: Schalte den Betrieb ein, um Spannungen zu messen.'; return out; }
      const op = opts.op || operate(board, opts); out.op = op;
      if (!op.powered && !op.short) { out.value = 0; out.text = '0,00 V'; out.open = false; out.note = op.notes[0] || ''; return out; }
      const va = op.Vnode(a.idx), vb = op.Vnode(b.idx); out.value = va - vb; out.open = false;
      out.text = dec(out.value, 2) + ' V'; if (op.short) out.note = 'Kurzschluss: das Netzteil hat abgeschaltet.';
      else if (op.floating(a.idx) || op.floating(b.idx)) out.note = 'Ein Messpunkt hängt "in der Luft": der Wert ist nicht verlässlich.';
      return out;
    }
    if (opts.power) { out.note = 'Widerstand und Durchgang misst du nur an der abgeschalteten Baugruppe. Schalte den Betrieb aus!'; out.text = '----'; out.open = false; out.blocked = true; return out; }
    if (mode === 'diode') {
      out.unit = 'V'; const ca = g.comp(a.idx, true), cb = g.comp(b.idx, true), ca2 = g.comp(a.idx, false), cb2 = g.comp(b.idx, false);
      if (ca2 === cb2) { out.value = 0; out.text = '0,00 V'; out.open = false; out.beep = true; out.note = 'Direkte Verbindung (kein Halbleiter dazwischen).'; return out; }
      let found = null, cold = false;
      (board.parts || []).forEach(p => { const cl = classify(p); if ((cl.k === 'led' || cl.k === 'diode') && p.defect !== 'open') { const A = g.termNode[p.ref + '.' + cl.A], K = g.termNode[p.ref + '.' + cl.K]; if (A == null || K == null) return;
        if (g.comp(A, false) === ca2 && g.comp(K, false) === cb2) { found = { p, cl }; cold = g.comp(A, true) !== ca || g.comp(K, true) !== cb; } } });
      if (found) { if (found.p.defect === 'short') { out.value = 0.05; out.text = '0,05 V'; out.open = false; out.note = 'Die Diode schließt in beide Richtungen kurz.'; return out; } if (cold && rnd() < 0.5) { out.flaky = true; out.note = 'Die Anzeige flackert: wackelt da ein Anschluss?'; return out; } out.value = found.cl.vf + (found.cl.k === 'led' ? 0.0 : 0.0); out.text = dec(out.value, 2) + ' V'; out.open = false; out.lit = found.p.ref; out.note = (found.cl.k === 'led' ? 'Durchlassspannung der LED' : 'Durchlassspannung der Diode') + ' ' + found.p.ref + '. Die LED glimmt schwach.'; return out; }
      const rev = (board.parts || []).find(p => { const cl = classify(p); if (cl.k !== 'led' && cl.k !== 'diode') return false; const A = g.termNode[p.ref + '.' + cl.A], K = g.termNode[p.ref + '.' + cl.K]; return A != null && K != null && g.comp(A, false) === cb2 && g.comp(K, false) === ca2; });
      out.note = rev ? 'Sperrrichtung: rot (A) an der Kathode. Tausche die Spitzen!' : 'Zwischen den Spitzen liegt keine Diode.'; return out;
    }
    // Widerstand / Durchgang
    const els = resElements(board, g), ra = g.comp(a.idx, false), rb = g.comp(b.idx, false);
    let rAll = effRes(els, ra, rb, false, g), rSol = effRes(els, g.comp(a.idx, true), g.comp(b.idx, true), true, g);
    let r = rAll;
    if (Math.abs(rAll - rSol) > 1e-9 && !(rAll === Infinity && rSol === Infinity) && (Math.abs(rAll - rSol) / Math.max(rAll, 1e-3) > 0.02 || rSol === Infinity)) {
      out.flaky = true; out.note = 'Der Wert springt: Wackelkontakt!';
      if (rnd() < 0.5) r = rSol; else r = rAll * (1 + (rnd() - 0.5) * 0.3);
    }
    if (mode === 'cont') {
      out.unit = 'Ω'; out.beep = r < 50; out.open = !(r < 50) && !(r < 1e6);
      out.text = r < 50 ? (r < 1 ? 'Durchgang 0,0 Ω' : 'Durchgang ' + fmtOhm(r)) : 'OL'; out.value = isFinite(r) ? r : null; out.open = !out.beep;
      if (!out.beep && !out.flaky) out.note = 'Kein Durchgang zwischen den Spitzen.'; else if (out.beep && !out.flaky && els.length && r > 1) out.note = 'Durchgang über ein Bauteil (' + fmtOhm(r) + ').';
      return out;
    }
    out.unit = 'Ω'; out.value = isFinite(r) ? r : null; out.text = fmtOhm(r); out.open = !isFinite(r) || r >= 5e7;
    if (out.open && !out.flaky) { const capBetween = (board.parts || []).some(p => { const cl = classify(p); if (cl.k !== 'cap' || p.defect) return false; const A = g.termNode[p.ref + '.1'], B = g.termNode[p.ref + '.2']; return A != null && B != null && ((g.comp(A, false) === ra && g.comp(B, false) === rb) || (g.comp(A, false) === rb && g.comp(B, false) === ra)); }); out.note = capBetween ? 'Zwischen den Spitzen liegt ein Kondensator: Gleichstrom fließt nicht (der Wert steigt langsam).' : 'Keine Verbindung: unendlich hoher Widerstand.'; }
    return out;
  }
  PCB_REPAIR.measure = measure;
  PCB_REPAIR.graph = buildGraph;

  /* ---------- Prüfung gegen den Soll-Stand */
  function refParts(reference) { return (reference.parts || []); }
  function check(board, reference) {
    const rem = [], notes = [];
    if (!reference) reference = board.repair && board.repair.soll; if (!reference) return { ok: true, remaining: [], notes: ['Kein Soll-Stand vorhanden.'] };
    const g = buildGraph(board), have = {}; (board.parts || []).forEach(p => { have[p.ref] = p; });
    const bad = new Set();
    refParts(reference).forEach(rp => {
      const p = have[rp.ref], cl = classify(rp);
      if (!p) { rem.push({ type: 'missing', ref: rp.ref, msg: 'Bauteil ' + rp.ref + ' (' + rp.value + ') fehlt.' }); return; }
      if (!sameValue(p.value, rp.value) && cl.k !== 'ic' && cl.k !== 'conn') rem.push({ type: 'value', ref: rp.ref, msg: rp.ref + ' hat den falschen Wert: ' + p.value + ' statt ' + rp.value + '.' });
      if (isPolar(cl) || isIC(cl)) {
        const dr = ((((p.rot || 0) - (rp.rot || 0)) % 360) + 360) % 360;
        if (dr !== 0 || (p.side || 'top') !== (rp.side || 'top')) { bad.add(rp.ref); rem.push({ type: 'rot', ref: rp.ref, msg: rp.ref + (isIC(cl) ? ' ist verdreht eingebaut (Pin 1 sitzt an der falschen Stelle).' : ' ist verpolt eingebaut.') }); }
      }
      if (p.defect) rem.push({ type: 'defect', ref: rp.ref, msg: rp.ref + ' ist defekt (' + (p.defect === 'open' ? 'unterbrochen' : 'Kurzschluss im Bauteil') + ') und muss ersetzt werden.' });
      (p.cold || []).forEach(n => rem.push({ type: 'cold', ref: rp.ref, pad: rp.ref + '.' + n, msg: 'Kalte Lötstelle an ' + rp.ref + ' Pin ' + n + ': nachlöten.' }));
    });
    // offene Netze
    const compNets = new Map();
    const noteNet = (c, net) => { if (!net) return; if (!compNets.has(c)) compNets.set(c, new Set()); compNets.get(c).add(net); };
    (reference.nets || []).forEach(net => {
      const pins = (net.pins || []).filter(pk => g.padNode[pk] != null && !bad.has(pk.split('.')[0]));
      if (pins.length < 2) return;
      const groups = new Map(); pins.forEach(pk => { const c = g.comp(g.padNode[pk], false); if (!groups.has(c)) groups.set(c, []); groups.get(c).push(pk); });
      if (groups.size > 1) { const gs = [...groups.values()].sort((a, b) => b.length - a.length); rem.push({ type: 'open', net: net.name, pins: gs.map(x => x.join(', ')), msg: 'Netz ' + net.name + ' ist unterbrochen: ' + gs.map(x => x.join(', ')).join(' und ') + ' sind nicht verbunden.' }); }
    });
    // Kurzschlüsse: Komponente mit Pads mehrerer Netze
    const netOfPin = {}; (reference.nets || []).forEach(n => (n.pins || []).forEach(pk => { netOfPin[pk] = n.name; }));
    g.pads.forEach(pd => { if (bad.has(pd.ref)) return; noteNet(g.comp(pd.node, false), netOfPin[pd.key]); });
    g.nodes.forEach((nd, i) => { if (nd.kind === 'trk' && nd.track.net) noteNet(g.comp(i, false), nd.track.net); else if (nd.kind === 'via' && nd.via.net) noteNet(g.comp(i, false), nd.via.net); });
    const shortSeen = new Set();
    compNets.forEach(set => { if (set.size > 1) { const k = [...set].sort().join('|'); if (shortSeen.has(k)) return; shortSeen.add(k); rem.push({ type: 'short', nets: [...set].sort(), msg: 'Kurzschluss zwischen ' + [...set].sort().join(' und ') + '.' }); } });
    if ((board.wires || []).length) notes.push('Fädeldraht eingesetzt: das ist eine Reparatur-Notlösung. Bei einer Serienplatine würdest du die Bahn sauber reparieren oder die Leiterplatte ersetzen.');
    return { ok: rem.length === 0, remaining: rem, notes, wires: (board.wires || []).length };
  }
  PCB_REPAIR.check = check;
  PCB_REPAIR.verify = function (board) { return check(board, board.repair && board.repair.soll); };

  /* ---------- Fehlerarten */
  const FAULTS = [
    { id: 'crack', name: 'Haarriss in der Leiterbahn', group: 'Unterbrechung', desc: 'Eine Leiterbahn hat einen feinen Riss. Mit bloßem Auge fast unsichtbar, aber der Strom fließt nicht.' },
    { id: 'viabreak', name: 'Gebrochene Via', group: 'Unterbrechung', desc: 'Die Kupferhülse einer Durchkontaktierung ist gebrochen: Vorder- und Rückseite sind nicht mehr verbunden.' },
    { id: 'bridge', name: 'Lötbrücke', group: 'Kurzschluss', desc: 'Zu viel Lot verbindet zwei benachbarte Pads.' },
    { id: 'ball', name: 'Zinnperle', group: 'Kurzschluss', desc: 'Eine Lotkugel liegt zwischen zwei Kupferflächen und schließt sie kurz.' },
    { id: 'copper', name: 'Kupferrest', group: 'Kurzschluss', desc: 'Beim Ätzen blieb ein Kupferfetzen stehen, der zwei Bahnen verbindet.' },
    { id: 'wrongvalue', name: 'Falscher Bauteilwert', group: 'Bauteil', desc: 'Es wurde ein Widerstand oder Kondensator mit falschem Wert bestückt.' },
    { id: 'reversed', name: 'Bauteil verpolt', group: 'Bauteil', desc: 'Elko, LED oder Diode sitzen falsch herum.' },
    { id: 'icrot', name: 'IC verdreht', group: 'Bauteil', desc: 'Ein IC wurde um 180 Grad gedreht bestückt: Pin 1 sitzt am falschen Ende.' },
    { id: 'cold', name: 'Kalte Lötstelle', group: 'Löten', desc: 'Eine Lötstelle sieht matt aus und hat keinen sicheren Kontakt (Wackelkontakt).' },
    { id: 'missing', name: 'Bauteil fehlt', group: 'Bauteil', desc: 'Ein Bauteil wurde nicht bestückt.' },
    { id: 'def_open', name: 'Bauteil defekt: unterbrochen', group: 'Bauteil', desc: 'Ein Bauteil (Widerstand, LED, Sicherung) ist durchgebrannt und leitet nicht mehr.' },
    { id: 'def_short', name: 'Bauteil defekt: Schluss', group: 'Bauteil', desc: 'Ein Kondensator (oder eine Diode) hat einen Schluss und leitet in beide Richtungen.' }
  ];
  PCB_REPAIR.faults = FAULTS;

  function ensureRepair(board) {
    if (!board.repair) board.repair = {};
    if (!board.repair.faults) board.repair.faults = [];
    if (!board.repair.soll) board.repair.soll = { parts: clone(board.parts || []), nets: clone(board.nets || []) };
    return board.repair;
  }
  const nextId = (arr, pre) => { let n = 1; const ids = new Set((arr || []).map(x => x.id)); while (ids.has(pre + n)) n++; return pre + n; };

  /* Nahe Kupferpaare (verschiedene Netze) auf einer Außenlage */
  function closePairs(board, maxGap, kinds) {
    const pads = worldPads(board), out = [];
    ['F.Cu', 'B.Cu'].forEach(layer => {
      const items = [];
      pads.forEach(pd => { if (pd.layers.indexOf(layer) >= 0 && pd.net) items.push({ kind: 'pad', net: pd.net, caps: padCaps(pd), ref: pd.ref + ' Pin ' + pd.n, pad: pd }); });
      (board.tracks || []).forEach(t => { if (t.layer === layer && t.net) items.push({ kind: 'trk', net: t.net, caps: polyCaps(t.pts, t.w), tr: t }); });
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const A = items[i], B = items[j]; if (A.net === B.net) continue; if (kinds.indexOf(A.kind + B.kind) < 0 && kinds.indexOf(B.kind + A.kind) < 0) continue;
        if (A.kind === 'trk' && B.kind === 'trk' && A.tr === B.tr) continue;
        const r = capsMin(A.caps, B.caps); if (r.d > 0.02 && r.d <= maxGap) out.push({ layer, A, B, gap: r.d, pa: r.pa, pb: r.pb });
      }
    });
    return out;
  }

  function injectTry(board, kind, opt, rnd) {
    const b = clone(board), rp = ensureRepair(b), info = { id: kind, kind, seed: opt.seed };
    const F = FAULTS.find(f => f.id === kind); info.name = F.name; info.group = F.group;
    const partsOf = fn => shuffle((b.parts || []).filter(p => !opt.ref || p.ref === opt.ref).filter(p => fn(p, classify(p))), rnd);
    if (kind === 'crack') {
      const cands = shuffle((b.tracks || []).filter(t => (t.layer === 'F.Cu' || t.layer === 'B.Cu') && (!opt.track || t.id === opt.track)), rnd);
      for (const t of cands) {
        const segs = []; let tot = 0; for (let i = 0; i < t.pts.length - 1; i++) { const l = hypot(t.pts[i + 1][0] - t.pts[i][0], t.pts[i + 1][1] - t.pts[i][1]); segs.push(l); tot += l; }
        if (tot < 2.6) continue;
        const s = tot * (0.35 + rnd() * 0.3); let acc = 0, x = 0, y = 0, dx = 1, dy = 0;
        for (let i = 0; i < segs.length; i++) { if (acc + segs[i] >= s || i === segs.length - 1) { const f = segs[i] ? (s - acc) / segs[i] : 0; x = t.pts[i][0] + (t.pts[i + 1][0] - t.pts[i][0]) * f; y = t.pts[i][1] + (t.pts[i + 1][1] - t.pts[i][1]) * f; dx = (t.pts[i + 1][0] - t.pts[i][0]) / (segs[i] || 1); dy = (t.pts[i + 1][1] - t.pts[i][1]) / (segs[i] || 1); break; } acc += segs[i]; }
        const cut = { id: nextId(b.cuts, 'k'), track: t.id, x, y, layer: t.layer, ca: { x: x - dx * 0.7, y: y - dy * 0.7 }, cb: { x: x + dx * 0.7, y: y + dy * 0.7 }, ang: Math.atan2(dy, dx) };
        const b2 = clone(b); b2.cuts = (b2.cuts || []).concat([cut]);
        if (!effective(b2, board)) continue;
        b.cuts = b2.cuts; info.track = t.id; info.net = t.net; info.where = { x, y }; info.layer = t.layer; info.cut = cut.id;
        info.desc = 'Haarriss in der Leiterbahn ' + (t.net ? 'des Netzes ' + t.net : '') + ' auf der ' + (t.layer === 'B.Cu' ? 'Rückseite' : 'Vorderseite') + '.';
        info.fix = 'Mit der Lupe den Riss suchen und mit Fädeldraht überbrücken (oder mit Lötzinn überziehen).';
        return fin(b, rp, info);
      }
      return null;
    }
    if (kind === 'viabreak') {
      for (const v of shuffle((b.vias || []).filter(v => !opt.via || v.id === opt.via), rnd)) {
        const b2 = clone(b); b2.vias.find(q => q.id === v.id).broken = true; if (!effective(b2, board)) continue;
        b.vias = b2.vias; info.via = v.id; info.net = v.net; info.where = { x: v.x, y: v.y };
        info.desc = 'Das Via ' + (v.net ? 'im Netz ' + v.net : '') + ' ist gebrochen.'; info.fix = 'Die Verbindung zwischen Vorder- und Rückseite mit einem Draht durch die Via-Bohrung wiederherstellen (Fädeldraht oder Via durchlöten).';
        return fin(b, rp, info);
      }
      return null;
    }
    if (kind === 'bridge' || kind === 'ball' || kind === 'copper') {
      const kinds = kind === 'bridge' ? ['padpad'] : kind === 'ball' ? ['padpad', 'padtrk', 'trktrk'] : ['trktrk', 'padtrk'];
      const maxg = kind === 'bridge' ? 1.1 : kind === 'ball' ? 1.0 : 1.4;
      let cands = closePairs(b, maxg, kinds);
      if (opt.ref) cands = cands.filter(c => (c.A.pad && c.A.pad.ref === opt.ref) || (c.B.pad && c.B.pad.ref === opt.ref));
      cands.sort((p, q) => p.gap - q.gap); cands = shuffle(cands.slice(0, Math.max(6, cands.length >> 1)), rnd);
      for (const c of cands) {
        const mx = (c.pa.x + c.pb.x) / 2, my = (c.pa.y + c.pb.y) / 2, ang = Math.atan2(c.pb.y - c.pa.y, c.pb.x - c.pa.x);
        const centerA = c.A.pad ? { x: c.A.pad.x, y: c.A.pad.y } : c.pa, centerB = c.B.pad ? { x: c.B.pad.x, y: c.B.pad.y } : c.pb;
        const bl = { id: nextId(b.blobs, 'b'), kind, a: centerA, b: centerB, x: mx, y: my, ang, r: kind === 'bridge' ? Math.max(0.5, c.gap / 2 + 0.38) : kind === 'ball' ? 0.42 : 0.3, len: c.gap + 0.9, layer: c.layer };
        const b2 = clone(b); b2.blobs = (b2.blobs || []).concat([bl]); if (!effective(b2, board)) continue;
        b.blobs = b2.blobs; info.blob = bl.id; info.nets = [c.A.net, c.B.net]; info.where = { x: mx, y: my }; info.layer = c.layer;
        info.desc = (kind === 'bridge' ? 'Lötbrücke' : kind === 'ball' ? 'Zinnperle' : 'Kupferrest') + ' zwischen ' + c.A.net + ' und ' + c.B.net + ' auf der ' + (c.layer === 'B.Cu' ? 'Rückseite' : 'Vorderseite') + '.';
        info.fix = kind === 'bridge' ? 'Mit der Lupe die Brücke finden und mit Entlötlitze absaugen.' : kind === 'ball' ? 'Mit der Pinzette entfernen.' : 'Mit dem Messer wegschaben.';
        return fin(b, rp, info);
      }
      return null;
    }
    if (kind === 'wrongvalue') {
      for (const p of partsOf((q, cl) => cl.k === 'res' || (cl.k === 'cap'))) {
        const v = parseVal(p.value); if (!isFinite(v)) continue;
        const cl0 = classify(p), facs = [10, 0.1].filter(f => (cl0.k === 'res' ? v * f >= 1 && v * f <= 2e6 : v * f >= 1e-11 && v * f <= 5e-3)), fac = facs[Math.floor(rnd() * facs.length)], nv = fmtVal(v * fac, p.value); if (!facs.length || sameValue(nv, p.value)) continue;
        const pi = b.parts.find(q => q.ref === p.ref); info.was = pi.value; pi.value = nv; info.ref = p.ref; info.where = { x: p.x, y: p.y };
        info.desc = p.ref + ' hat den Wert ' + nv.replace('.', ',') + ' statt ' + info.was.replace('.', ',') + '.'; info.fix = 'Wert am Bauteil ablesen (Farbringe/Aufdruck) oder messen, mit dem Schaltplan vergleichen und das Bauteil ersetzen.';
        if (!effective(b, board)) continue; return fin(b, rp, info);
      }
      return null;
    }
    if (kind === 'reversed' || kind === 'icrot') {
      for (const p of partsOf((q, cl) => kind === 'reversed' ? isPolar(cl) : (cl.k === 'ic' || cl.k === 'reg'))) {
        const pi = b.parts.find(q => q.ref === p.ref); pi.rot = (((pi.rot || 0) + 180) % 360); info.ref = p.ref; info.where = { x: p.x, y: p.y };
        info.desc = p.ref + (kind === 'icrot' ? ' sitzt um 180 Grad verdreht.' : ' sitzt falsch herum (verpolt).'); info.fix = 'Bauteil auslöten und richtig herum (Pin 1 / Plus-Markierung beachten) wieder einlöten.';
        if (!effective(b, board)) continue; return fin(b, rp, info);
      }
      return null;
    }
    if (kind === 'cold') {
      for (const p of partsOf((q, cl) => cl.k !== 'other')) {
        const pads = worldPads(b).filter(pd => pd.ref === p.ref); if (!pads.length) continue;
        const pd = opt.pad ? pads.find(q => q.n === opt.pad) : pads[Math.floor(rnd() * pads.length)]; if (!pd) continue;
        const pi = b.parts.find(q => q.ref === p.ref); pi.cold = (pi.cold || []).concat([pd.n]); info.ref = p.ref; info.pad = p.ref + '.' + pd.n; info.where = { x: pd.x, y: pd.y }; info.layer = pd.side === 'bot' ? 'B.Cu' : 'F.Cu';
        info.desc = 'Die Lötstelle an ' + p.ref + ' Pin ' + pd.n + ' ist kalt (matt, kein Meniskus).'; info.fix = 'Mit dem Lötkolben nachlöten.';
        return fin(b, rp, info);
      }
      return null;
    }
    if (kind === 'missing') {
      for (const p of partsOf((q, cl) => cl.k === 'res' || cl.k === 'cap' || cl.k === 'led' || cl.k === 'diode')) {
        b.parts = b.parts.filter(q => q.ref !== p.ref); info.ref = p.ref; info.where = { x: p.x, y: p.y };
        info.desc = 'Bauteil ' + p.ref + ' fehlt.'; info.fix = 'Wert im Schaltplan nachsehen und das Bauteil einlöten.'; return fin(b, rp, info);
      }
      return null;
    }
    if (kind === 'def_open' || kind === 'def_short') {
      for (const p of partsOf((q, cl) => kind === 'def_open' ? (cl.k === 'res' || cl.k === 'led' || cl.k === 'fuse') : (cl.k === 'cap' || cl.k === 'diode'))) {
        b.parts.find(q => q.ref === p.ref).defect = kind === 'def_open' ? 'open' : 'short'; info.ref = p.ref; info.where = { x: p.x, y: p.y };
        info.desc = p.ref + (kind === 'def_open' ? ' ist durchgebrannt (unterbrochen).' : ' hat einen Schluss.'); info.fix = 'Bauteil messen und durch ein neues mit gleichem Wert ersetzen.';
        if (!effective(b, board)) continue; return fin(b, rp, info);
      }
      return null;
    }
    return null;
  }
  function effective(faulty, orig) { const ref = faulty.repair && faulty.repair.soll ? faulty.repair.soll : { parts: orig.parts, nets: orig.nets }; return !check(faulty, ref).ok; }
  function fin(b, rp, info) { info.hint = info.fix; rp.faults.push(info); return { board: b, info }; }

  /* inject(board, fault): reine Funktion. fault = 'crack' | { kind, seed, ref, track, via, pad } */
  PCB_REPAIR.inject = function (board, fault) {
    const opt = typeof fault === 'string' ? { kind: fault } : Object.assign({}, fault || {}), kind = opt.kind || opt.id;
    if (!FAULTS.find(f => f.id === kind)) return { board: clone(board), info: null, error: 'Unbekannte Fehlerart: ' + kind };
    const start = ensureBase(board);
    const rnd = rngOf(opt.seed == null ? 1 : opt.seed);
    for (let k = 0; k < 8; k++) {
      const r = injectTry(start, kind, opt, rnd);
      if (r) return r;
      if (opt.ref || opt.track || opt.via) break;
    }
    return { board: clone(board), info: null, error: 'Auf dieser Platine gibt es keine passende Stelle für "' + (FAULTS.find(f => f.id === kind).name) + '".' };
  };
  function ensureBase(board) { const b = clone(board); ensureRepair(b); return b; }

  /* ---------- Reparaturaktionen (reine Funktionen auf einer Kopie) */
  function fix(board, act) {
    const b = clone(board), rp = ensureRepair(b), sol = rp.soll, res = { board: b, ok: false, msg: '', fx: 'click' };
    const part = ref => (b.parts || []).find(p => p.ref === ref), solPart = ref => (sol.parts || []).find(p => p.ref === ref);
    switch (act.t) {
      case 'reflow': { const p = part(act.ref); if (!p || !(p.cold || []).length) { res.msg = 'Hier ist nichts nachzulöten.'; return res; }
        const n = act.n || (p.cold && p.cold[0]); if ((p.cold || []).indexOf(n) < 0) { res.msg = 'Diese Lötstelle ist in Ordnung (glänzend, mit sauberem Meniskus).'; res.fx = 'click'; return res; }
        p.cold = p.cold.filter(x => x !== n); if (!p.cold.length) delete p.cold; res.ok = true; res.fx = 'fizz'; res.msg = 'Nachgelötet: ' + act.ref + ' Pin ' + n + ' glänzt wieder.'; return res; }
      case 'wick': case 'tweezer': case 'knife': {
        const bl = (b.blobs || []).find(x => x.id === act.id); if (!bl) { res.msg = 'Da ist nichts zu entfernen.'; return res; }
        const need = bl.kind === 'bridge' ? 'wick' : bl.kind === 'ball' ? 'tweezer' : 'knife';
        if (act.t !== need) { res.msg = bl.kind === 'bridge' ? 'Eine Lötbrücke saugst du mit Entlötlitze ab.' : bl.kind === 'ball' ? 'Eine Zinnperle nimmst du mit der Pinzette weg.' : 'Einen Kupferrest schabst du mit dem Messer weg.'; return res; }
        b.blobs = b.blobs.filter(x => x.id !== act.id); res.ok = true; res.fx = bl.kind === 'bridge' ? 'fizz' : 'click'; res.msg = (bl.kind === 'bridge' ? 'Brücke abgesaugt.' : bl.kind === 'ball' ? 'Zinnperle entfernt.' : 'Kupferrest abgeschabt.'); return res; }
      case 'solderCut': { const c = (b.cuts || []).find(x => x.id === act.id); if (!c) { res.msg = 'Hier ist kein Riss.'; return res; } b.cuts = b.cuts.filter(x => x.id !== act.id); res.ok = true; res.fx = 'fizz'; res.msg = 'Riss mit Lötzinn überbrückt.'; return res; }
      case 'viaFix': { const v = (b.vias || []).find(x => x.id === act.id); if (!v || !v.broken) { res.msg = 'Dieses Via ist in Ordnung.'; return res; } delete v.broken; res.ok = true; res.fx = 'fizz'; res.msg = 'Draht durch das Via gelötet: Vorder- und Rückseite sind wieder verbunden.'; return res; }
      case 'wire': {
        const g = buildGraph(b), a = g.nodeAt(act.a.x, act.a.y, g.layerOf(act.a.side), 0.35), c = g.nodeAt(act.b.x, act.b.y, g.layerOf(act.b.side), 0.35);
        if (a < 0 || c < 0) { res.msg = 'Der Draht muss auf beiden Seiten an Kupfer (Pad, Bahn oder Via) angelötet werden.'; return res; }
        if (a === c) { res.msg = 'Beide Enden liegen am selben Kupferstück.'; return res; }
        b.wires = (b.wires || []).concat([{ id: nextId(b.wires, 'w'), a: { x: act.a.x, y: act.a.y, side: act.a.side || 'top' }, b: { x: act.b.x, y: act.b.y, side: act.b.side || 'top' } }]); res.ok = true; res.fx = 'fizz'; res.msg = 'Fädeldraht gelötet: Reparatur-Notlösung.'; return res; }
      case 'unwire': { if (!(b.wires || []).some(w => w.id === act.id)) { res.msg = 'Kein Draht.'; return res; } b.wires = b.wires.filter(w => w.id !== act.id); res.ok = true; res.msg = 'Draht entfernt.'; return res; }
      case 'rotate': { const p = part(act.ref); if (!p) { res.msg = 'Bauteil nicht gefunden.'; return res; } p.rot = (((p.rot || 0) + (act.deg == null ? 180 : act.deg)) % 360 + 360) % 360; delete p.cold; res.ok = true; res.fx = 'fizz'; res.msg = act.ref + ' ausgelötet, gedreht und neu eingelötet.'; return res; }
      case 'remove': { const p = part(act.ref); if (!p) { res.msg = 'Bauteil nicht gefunden.'; return res; } b.parts = b.parts.filter(q => q.ref !== act.ref); res.ok = true; res.fx = 'fizz'; res.msg = act.ref + ' ausgelötet.'; return res; }
      case 'replace': case 'insert': {
        const sp = solPart(act.ref), old = part(act.ref); if (!sp && !old) { res.msg = 'Unbekanntes Bauteil.'; return res; }
        const base = old || sp; const np = { id: base.id, ref: act.ref, fp: base.fp || sp.fp, value: act.value != null ? String(act.value) : (sp ? sp.value : base.value), x: base.x, y: base.y, rot: act.rot != null ? act.rot : (sp ? sp.rot : base.rot) || 0, side: base.side || 'top' };
        if (old && old.locked) np.locked = old.locked;
        b.parts = (b.parts || []).filter(q => q.ref !== act.ref).concat([np]); res.ok = true; res.fx = 'fizz'; res.msg = act.ref + ' eingelötet (' + np.value + ').'; return res; }
      default: res.msg = 'Unbekannte Aktion.'; return res;
    }
  }
  PCB_REPAIR.fix = fix;
  /* automatische Musterreparatur (für Tests und "Lösung zeigen") */
  PCB_REPAIR.autoFix = function (board) {
    let b = clone(board); const faults = (b.repair && b.repair.faults) || [], steps = [];
    const run = a => { const r = fix(b, a); if (r.ok) { b = r.board; steps.push(a); } return r.ok; };
    (b.blobs || []).slice().forEach(bl => run({ t: bl.kind === 'bridge' ? 'wick' : bl.kind === 'ball' ? 'tweezer' : 'knife', id: bl.id }));
    (b.cuts || []).slice().forEach(c => run({ t: 'wire', a: { x: c.ca.x, y: c.ca.y, side: c.layer === 'B.Cu' ? 'bot' : 'top' }, b: { x: c.cb.x, y: c.cb.y, side: c.layer === 'B.Cu' ? 'bot' : 'top' } }));
    (b.vias || []).forEach(v => { if (v.broken) run({ t: 'viaFix', id: v.id }); });
    const sol = b.repair && b.repair.soll;
    if (sol) {
      sol.parts.forEach(sp => {
        const p = (b.parts || []).find(q => q.ref === sp.ref);
        if (!p) run({ t: 'insert', ref: sp.ref });
        else if (p.defect || !sameValue(p.value, sp.value)) run({ t: 'replace', ref: sp.ref });
        else if ((((p.rot || 0) - (sp.rot || 0)) % 360 + 360) % 360 !== 0) run({ t: 'rotate', ref: sp.ref, deg: ((sp.rot || 0) - (p.rot || 0) + 360) % 360 });
      });
      (b.parts || []).forEach(p => (p.cold || []).slice().forEach(n => run({ t: 'reflow', ref: p.ref, n })));
    }
    return { board: b, steps, faults };
  };

  /* ---------- Beispielplatinen (heile Baugruppen, Ausgangspunkt für Fehlerfälle) */
  PCB_REPAIR.samples = (function () {
  const rules = { minWidth: 0.2, clearance: 0.2, minDrill: 0.3, annular: 0.15, edge: 0.3, viaDia: 0.8, viaDrill: 0.4, maskExpansion: 0.05, silkWidth: 0.15 };
    let tid = 0;
    const T = (layer, net, pts, w) => ({ id: 't' + (++tid), layer, net, w: w || 0.4, pts });
    const base = (id, name, w, h) => ({ id, name, w, h, layers: 2, copperOz: 1, rules: Object.assign({}, rules), grid: 0.25, nets: [], parts: [], tracks: [], vias: [], zones: [], texts: [] });
    function ledtreiber() {
      tid = 0; const b = base('rp-led', 'LED-Treiber (3 Bauteile)', 26, 20);
      b.parts = [
        { id: 'p1', ref: 'J1', fp: 'HDR_1x2', value: '5V', x: 4, y: 10, rot: 0, side: 'top' },
        { id: 'p2', ref: 'R1', fp: 'R_AXIAL_7', value: '330', x: 14, y: 6, rot: 0, side: 'top' },
        { id: 'p3', ref: 'D1', fp: 'LED_5MM', value: 'LED rot', x: 14, y: 14, rot: 0, side: 'top' }];
      b.nets = [{ name: 'VCC', cls: 'power', pins: ['J1.1', 'R1.1'] }, { name: 'N1', cls: 'signal', pins: ['R1.2', 'D1.2'] }, { name: 'GND', cls: 'power', pins: ['D1.1', 'J1.2'] }];
      b.tracks = [T('F.Cu', 'VCC', [[4, 8.73], [4, 6], [10.19, 6]]), T('F.Cu', 'N1', [[17.81, 6], [17.81, 14], [15.27, 14]]), T('F.Cu', 'GND', [[12.73, 14], [8, 14]]), T('B.Cu', 'GND', [[8, 14], [4, 14], [4, 11.27]])];
      b.vias = [{ id: 'v1', x: 8, y: 14, net: 'GND', dia: 0.8, drill: 0.4, from: 'F.Cu', to: 'B.Cu' }];
      b.repair = { supply: { net: 'VCC', v: 5, gnd: 'GND' } };
      return b;
    }
    function netzteil() {
      tid = 0; const b = base('rp-netz', 'Netzteil 5 V mit 7805', 46, 24);
      b.parts = [
        { id: 'p1', ref: 'J1', fp: 'HDR_1x2', value: '9V', x: 4, y: 12, rot: 0, side: 'top' },
        { id: 'p2', ref: 'D1', fp: 'SOD-123', value: '1N4007', x: 9, y: 6, rot: 180, side: 'top' },
        { id: 'p3', ref: 'C1', fp: 'C_RADIAL_5', value: '330u', x: 14, y: 13, rot: 270, side: 'top' },
        { id: 'p4', ref: 'U1', fp: 'TO-220', value: 'LM7805', x: 22, y: 10, rot: 0, side: 'top' },
        { id: 'p5', ref: 'C2', fp: 'C_RADIAL_2.5', value: '10u', x: 30, y: 13, rot: 270, side: 'top' },
        { id: 'p6', ref: 'R1', fp: 'R0603', value: '470', x: 34, y: 6, rot: 0, side: 'top' },
        { id: 'p7', ref: 'D2', fp: 'LED0603', value: 'LED grün', x: 38, y: 10, rot: 270, side: 'top' }];
      b.nets = [
        { name: '+9V', cls: 'power', pins: ['J1.1', 'D1.2'] }, { name: 'VD', cls: 'power', pins: ['D1.1', 'C1.1', 'U1.1'] },
        { name: 'GND', cls: 'power', pins: ['J1.2', 'C1.2', 'U1.2', 'C2.2', 'D2.1'] }, { name: '+5V', cls: 'power', pins: ['U1.3', 'C2.1', 'R1.1'] }, { name: 'N1', cls: 'signal', pins: ['R1.2', 'D2.2'] }];
      b.tracks = [
        T('F.Cu', '+9V', [[4, 10.73], [4, 6], [7.4, 6]]), T('F.Cu', 'VD', [[10.6, 6], [19.46, 6], [19.46, 10]]), T('F.Cu', 'VD', [[14, 10.5], [14, 6]]),
        T('B.Cu', 'GND', [[4, 13.27], [4, 18], [40, 18], [40, 9.2]]), T('B.Cu', 'GND', [[14, 15.5], [14, 18]]), T('B.Cu', 'GND', [[22, 10], [22, 18]]), T('B.Cu', 'GND', [[30, 14.25], [30, 18]]),
        T('F.Cu', '+5V', [[24.54, 10], [30, 10], [30, 11.75]]), T('F.Cu', '+5V', [[30, 10], [33.2, 10], [33.2, 6]]),
        T('F.Cu', 'N1', [[34.8, 6], [36.5, 6], [36.5, 10.8], [38, 10.8]]), T('F.Cu', 'GND', [[38, 9.2], [40, 9.2]])];
      b.vias = [{ id: 'v1', x: 40, y: 9.2, net: 'GND', dia: 0.8, drill: 0.4, from: 'F.Cu', to: 'B.Cu' }];
      return b;
    }
    function blinker555() {
      tid = 0; const b = base('rp-555', '555-Blinker', 48, 25);
      b.parts = [
        { id: 'p1', ref: 'J1', fp: 'HDR_1x2', value: '5V', x: 4, y: 12, rot: 0, side: 'top' },
        { id: 'p2', ref: 'U1', fp: 'DIP-8', value: 'NE555', x: 20, y: 12, rot: 0, side: 'top' },
        { id: 'p3', ref: 'R1', fp: 'R_AXIAL_7', value: '10k', x: 30, y: 8, rot: 270, side: 'top' },
        { id: 'p4', ref: 'R2', fp: 'R_AXIAL_7', value: '47k', x: 36, y: 12, rot: 270, side: 'top' },
        { id: 'p5', ref: 'C1', fp: 'C_RADIAL_2.5', value: '10u', x: 26, y: 18, rot: 270, side: 'top' },
        { id: 'p6', ref: 'R3', fp: 'R_AXIAL_7', value: '470', x: 42, y: 8, rot: 270, side: 'top' },
        { id: 'p7', ref: 'D1', fp: 'LED_5MM', value: 'LED rot', x: 42, y: 18, rot: 90, side: 'top' }];
      b.nets = [
        { name: 'VCC', cls: 'power', pins: ['J1.1', 'U1.8', 'U1.4', 'R1.1'] }, { name: 'GND', cls: 'power', pins: ['J1.2', 'U1.1', 'C1.2', 'D1.1'] },
        { name: 'DIS', cls: 'signal', pins: ['U1.7', 'R1.2', 'R2.1'] }, { name: 'TH', cls: 'signal', pins: ['U1.6', 'U1.2', 'R2.2', 'C1.1'] },
        { name: 'OUT', cls: 'signal', pins: ['U1.3', 'R3.1'] }, { name: 'NL', cls: 'signal', pins: ['R3.2', 'D1.2'] }];
      b.tracks = [
        T('F.Cu', 'VCC', [[4, 10.73], [4, 4], [30, 4]]), T('F.Cu', 'VCC', [[23.81, 8.19], [23.81, 4]]), T('B.Cu', 'VCC', [[16.19, 15.81], [12, 15.81], [12, 4]]),
        T('F.Cu', 'GND', [[16.19, 8.19], [8, 8.19], [8, 13.27], [4, 13.27]]), T('B.Cu', 'GND', [[4, 13.27], [4, 22], [42, 22], [42, 19.27]]), T('B.Cu', 'GND', [[26, 22], [26, 19.25]]),
        T('F.Cu', 'TH', [[23.81, 13.27], [26, 13.27], [26, 16.75]]), T('F.Cu', 'TH', [[36, 15.81], [26, 15.81]]), T('B.Cu', 'TH', [[16.19, 10.73], [20, 10.73], [20, 13.27], [23.81, 13.27]]),
        T('F.Cu', 'DIS', [[23.81, 10.73], [28, 10.73], [28, 11.81], [30, 11.81]]), T('F.Cu', 'DIS', [[30, 11.81], [33, 11.81], [33, 8.19], [36, 8.19]]),
        T('B.Cu', 'OUT', [[16.19, 13.27], [14, 13.27], [14, 2], [42, 2], [42, 4.19]]), T('F.Cu', 'NL', [[42, 11.81], [42, 16.73]])];
      b.vias = [{ id: 'v1', x: 12, y: 4, net: 'VCC', dia: 0.8, drill: 0.4, from: 'F.Cu', to: 'B.Cu' }];
      b.repair = { supply: { net: 'VCC', v: 5, gnd: 'GND' } };
      return b;
    }
    
    return { ledtreiber: ledtreiber, netzteil: netzteil, blinker555: blinker555, all: function () { return [ledtreiber(), netzteil(), blinker555()]; } };
  })();

  PCB_REPAIR.parseVal = parseVal; PCB_REPAIR.fmtVal = fmtVal; PCB_REPAIR.fmtOhm = fmtOhm; PCB_REPAIR.sameValue = sameValue; PCB_REPAIR.worldPads = worldPads; PCB_REPAIR.fpOf = fpOf;
  PCB_REPAIR.padCaps = padCaps;

  /* ================================================================ Ende Teil 1 */
  if (typeof module !== 'undefined' && module.exports) module.exports = PCB_REPAIR;
  root.PCB_REPAIR = PCB_REPAIR;
  
  /* ================================================================ Teil 2: Ansicht (nur im Browser) */
  if (typeof document === 'undefined') return;

  const PI = Math.PI;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  /* ---------- Stil */
  const CSS = [
    '.pr-root{position:relative;display:flex;flex-direction:column;height:100%;min-height:340px;background:#14181c;color:#e8edf2;font:14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden;box-sizing:border-box}',
    '.pr-root *{box-sizing:border-box}',
    '.pr-bar{display:flex;gap:6px;padding:6px 8px;background:#222830;border-bottom:1px solid #2c343e;align-items:center;flex:0 0 auto;overflow-x:auto;scrollbar-width:none}',
    '.pr-bar::-webkit-scrollbar{display:none}',
    '.pr-btn{flex:0 0 auto;min-height:40px;min-width:40px;padding:0 11px;border:1px solid #3a4452;background:#2c343e;color:#e8edf2;border-radius:10px;font:inherit;font-weight:600;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:6px}',
    '.pr-btn:active{background:#3a4452}.pr-btn.on{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff}.pr-btn.go{background:#1a7f37;border-color:#1a7f37;color:#fff}.pr-btn.warn{border-color:#c97a1a;color:#ffb340}.pr-btn[disabled]{opacity:.4}',
    '.pr-sep{flex:0 0 1px;align-self:stretch;background:#3a4452;margin:2px 2px}',
    '.pr-hint{flex:0 0 auto;padding:5px 10px;background:#1b2128;border-bottom:1px solid #2c343e;color:#aab6c3;font-size:13px;min-height:30px;display:flex;align-items:center;gap:8px}',
    '.pr-hint b{color:#e8edf2}',
    '.pr-main{position:relative;flex:1 1 auto;min-height:0;display:flex}',
    '.pr-stage{position:relative;flex:1 1 auto;min-width:0;background:#0e1114;overflow:hidden}',
    '.pr-stage canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block;cursor:crosshair}',
    '.pr-meter{position:absolute;left:8px;bottom:8px;width:min(372px,calc(100% - 16px));background:linear-gradient(#e8b92a,#c99a14);border-radius:14px;padding:8px;box-shadow:0 6px 18px rgba(0,0,0,.55);color:#222;z-index:3;border:2px solid #8a6a0c}',
    '.pr-lcd{background:#a8c0a0;border-radius:8px;border:2px solid #3b4a38;padding:4px 10px 3px;color:#16231a;font-family:ui-monospace,"Cascadia Mono",Consolas,Menlo,monospace;min-height:54px;position:relative;box-shadow:inset 0 2px 6px rgba(0,0,0,.35)}',
    '.pr-lcd .v{font-size:27px;font-weight:700;letter-spacing:1px;line-height:1.15;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pr-lcd .n{font-size:12px;line-height:1.2;opacity:.8;min-height:13px;overflow:hidden;max-height:26px}',
    '.pr-lcd .m{position:absolute;left:6px;top:3px;font-size:10px;font-weight:700;opacity:.65}',
    '.pr-modes{display:flex;gap:5px;margin-top:6px}',
    '.pr-modes button{flex:1 1 0;min-height:40px;border-radius:9px;border:1px solid #6b5208;background:#f3d36a;color:#2a2000;font:700 13px system-ui;cursor:pointer;touch-action:manipulation;padding:0 2px}',
    '.pr-modes button.on{background:#222;color:#ffe27a;border-color:#000}',
    '.pr-probes{display:flex;gap:6px;margin-top:5px;font-size:12px;font-weight:600}',
    '.pr-probes span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 6px;border-radius:6px}',
    '.pr-pa{background:#b3261e;color:#fff}.pr-pb{background:#111;color:#fff}',
    '.pr-side{flex:0 0 340px;background:#1b2128;border-left:1px solid #2c343e;display:none;flex-direction:column;min-width:0;min-height:0;z-index:4}',
    '.pr-side.on{display:flex}',
    '.pr-root.narrow .pr-side{position:absolute;left:0;right:0;bottom:0;top:34%;flex:none;border-left:0;border-top:2px solid #3a4452;box-shadow:0 -8px 20px rgba(0,0,0,.5)}',
    '.pr-tabs{display:flex;gap:4px;padding:6px;border-bottom:1px solid #2c343e;flex:0 0 auto;align-items:center}',
    '.pr-tabs .pr-btn{flex:1 1 0}',
    '.pr-body{flex:1 1 auto;overflow:auto;padding:8px;-webkit-overflow-scrolling:touch}',
    '.pr-card{display:inline-block;vertical-align:top;margin:0 6px 8px 0;background:#222830;border:1px solid #38424d;border-radius:10px;padding:5px 7px;width:158px}',
    '.pr-card.sel{border-color:#3b9eff}',
    '.pr-card .h{font-size:12px;color:#aab6c3;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pr-card .h b{color:#fff;font-size:13px}',
    '.pr-card svg{display:block;width:100%;height:auto}',
    '.pr-body h4{margin:10px 0 4px;font-size:13px;color:#8d99a6;text-transform:uppercase;letter-spacing:.5px}',
    '.pr-body table{width:100%;border-collapse:collapse;font-size:13px}.pr-body td,.pr-body th{padding:3px 5px;border-bottom:1px solid #2c343e;text-align:left;vertical-align:top}',
    '.pr-log{font-size:13px;line-height:1.35}.pr-log div{padding:5px 2px;border-bottom:1px solid #2c343e}.pr-log time{color:#8d99a6;font-size:12px;margin-right:6px}',
    '.pr-log .ok{color:#4cd964}.pr-log .bad{color:#ff8a7a}.pr-log .warn{color:#ffb340}',
    '.pr-banner{position:absolute;left:50%;top:10px;transform:translateX(-50%);max-width:min(560px,calc(100% - 20px));background:rgba(34,40,48,.96);border:1px solid #3a4452;border-radius:12px;padding:8px 12px;z-index:3;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.45);pointer-events:none}',
    '.pr-tip{position:absolute;right:8px;bottom:8px;z-index:3;display:flex;flex-direction:column;gap:6px;align-items:flex-end}',
    '.pr-zoom{position:absolute;right:8px;top:8px;z-index:3;display:flex;flex-direction:column;gap:6px}',
    '.pr-zoom .pr-btn{width:44px;padding:0;font-size:20px;background:rgba(44,52,62,.92)}'
  ].join('');
  function injectCss() { if (document.getElementById('pr-css')) return; const s = document.createElement('style'); s.id = 'pr-css'; s.textContent = CSS; document.head.appendChild(s); }

  /* ---------- Zeichenhilfen */
  const hash = (a, b) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function padPath(c, pd, grow) {
    const g = grow || 0, w = pd.w + 2 * g, h = pd.h + 2 * g, x = pd.x - w / 2, y = pd.y - h / 2; c.beginPath();
    if (pd.shape === 'round' || Math.abs(pd.w - pd.h) < 1e-6 && pd.shape !== 'rect') { c.arc(pd.x, pd.y, Math.max(w, h) / 2, 0, 2 * PI); }
    else if (pd.shape === 'oval') { const r = Math.min(w, h) / 2; c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arc(x + w - r, y + r, r, -PI / 2, PI / 2 * (w > h ? 1 : 1)); c.lineTo(x + r, y + h); c.arc(x + r, y + r, r, PI / 2, PI * 1.5); c.closePath(); if (w < h) { c.beginPath(); c.moveTo(x, y + r); c.arc(x + r, y + r, r, PI, 0); c.lineTo(x + w, y + h - r); c.arc(x + r, y + h - r, r, 0, PI); c.closePath(); } }
    else { const r = Math.min(0.12, Math.min(w, h) / 4); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath(); }
  }
  function rrect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath(); }
  const BAND = ['#111', '#7a4a1e', '#d42a1f', '#f28a1a', '#f5dc1a', '#2aa03a', '#2a62d0', '#8a3ad0', '#8a8a8a', '#f4f4f4'];
  function bandsOf(v) {
    let x = parseVal(v); if (!isFinite(x) || x <= 0) return null;
    let e = Math.floor(Math.log10(x)) - 1; let m = Math.round(x / Math.pow(10, e));
    if (m >= 100) { m = Math.round(m / 10); e++; } if (m < 10) { m *= 10; e--; }
    const d1 = Math.floor(m / 10), d2 = m % 10; const mult = e >= 0 && e <= 9 ? BAND[e] : e === -1 ? '#c9a227' : '#c0c4c8';
    return [BAND[d1], BAND[d2], mult, '#c9a227'];
  }
  function ledColor(val) {
    const s = String(val || '').toLowerCase();
    if (/blau|blue/.test(s)) return [70, 120, 255]; if (/gr[uü]n|green/.test(s)) return [60, 220, 90]; if (/gelb|yell/.test(s)) return [255, 214, 40]; if (/wei|white/.test(s)) return [240, 240, 255]; if (/orange/.test(s)) return [255, 150, 30];
    return [255, 50, 40];
  }
  function fmtShort(v) { const s = String(v == null ? '' : v); return s.length > 9 ? s.slice(0, 9) : s; }
  function circleFp(fp) { return (fp.silk || []).find(s => s.t === 'circle'); }
  function localPad(fp, n) { return (fp.pads || []).find(p => p.n === n); }
  function bodyBox(fp) {
    const pads = fp.pads || []; if (!pads.length) return { x0: -1, y0: -1, x1: 1, y1: 1 };
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pads.forEach(p => { x0 = Math.min(x0, p.x - p.w / 2); x1 = Math.max(x1, p.x + p.w / 2); y0 = Math.min(y0, p.y - p.h / 2); y1 = Math.max(y1, p.y + p.h / 2); });
    return { x0, y0, x1, y1 };
  }
  /* Koordinatensystem des Bauteils (wie padsOf: erst spiegeln, dann drehen) */
  let ROT_SIGN = -1, calibrated = false;
  function calibrate() {
    if (calibrated) return; calibrated = true;
    const c = C(); if (!c || !c.padsOf) return;
    try {
      const b = { w: 50, h: 50, layers: 2, nets: [], parts: [{ id: 'z', ref: 'U1', fp: 'DIP-8', value: 'x', x: 20, y: 20, rot: 90, side: 'top' }], tracks: [], vias: [], zones: [], texts: [], rules: {} };
      const pd = c.padsOf(b).find(p => p.n === '1'), lf = localPad(fpOf('DIP-8'), '1'); if (!pd || !lf) return;
      const px = pd.x - 20, py = pd.y - 20, ex = -lf.y, ey = lf.x; // +90 Grad im y-nach-unten-System: (x,y) -> (-y, x)
      if (Math.hypot(px - ex, py - ey) < 0.01) ROT_SIGN = 1; else if (Math.hypot(px + ex, py + ey) < 0.01) ROT_SIGN = -1;
    } catch (e) {}
  }
  function partFrame(c, p) {
    c.translate(p.x, p.y); c.rotate(ROT_SIGN * (p.rot || 0) * PI / 180); if (p.side === 'bot') c.scale(-1, 1);
  }

  /* ---------- Farben und Bauteile */
  const COL = { sub1: '#216f3f', sub2: '#17572f', trk: '#2c8a50', trkHi: '#4fae77', tin1: '#f1f3f5', tin2: '#98a0a8', silk: '#f2f0e4', hole: '#0c0e10' };

  function drawPad(c, pd, bare) {
    padPath(c, pd, 0.05);
    const g = c.createLinearGradient(pd.x - pd.w / 2, pd.y - pd.h / 2, pd.x + pd.w / 2, pd.y + pd.h / 2); g.addColorStop(0, COL.tin1); g.addColorStop(0.5, '#c8cdd2'); g.addColorStop(1, COL.tin2);
    c.fillStyle = bare ? '#d3a15f' : g; c.fill(); c.lineWidth = 0.04; c.strokeStyle = 'rgba(0,0,0,.35)'; c.stroke();
    if (pd.drill) { c.beginPath(); c.arc(pd.x, pd.y, pd.drill / 2, 0, 2 * PI); c.fillStyle = COL.hole; c.fill(); c.lineWidth = 0.03; c.strokeStyle = 'rgba(255,255,255,.25)'; c.stroke(); }
  }
  /* Lötstelle: glänzend (gut) oder matt mit Riss (kalt). detail 2 = Lupe */
  function drawJoint(c, pd, cold, detail, seed) {
    const r = Math.max(pd.w, pd.h) / 2;
    if (pd.drill || pd.shape === 'round') { // Lötkegel
      const R = r * 0.92;
      if (!cold) {
        const g = c.createRadialGradient(pd.x - R * 0.3, pd.y - R * 0.35, R * 0.05, pd.x, pd.y, R); g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, '#e7eaed'); g.addColorStop(0.7, '#a9b0b7'); g.addColorStop(1, '#6a7178');
        c.beginPath(); c.arc(pd.x, pd.y, R, 0, 2 * PI); c.fillStyle = g; c.fill();
        if (detail >= 2) { c.beginPath(); c.arc(pd.x, pd.y, R * 0.55, 0, 2 * PI); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = R * 0.05; c.stroke(); c.beginPath(); c.arc(pd.x - R * 0.28, pd.y - R * 0.32, R * 0.14, 0, 2 * PI); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill(); c.beginPath(); c.arc(pd.x, pd.y, pd.drill ? pd.drill * 0.28 : R * 0.12, 0, 2 * PI); c.fillStyle = '#8c9298'; c.fill(); }
      } else {
        c.beginPath(); const n = 28; for (let i = 0; i <= n; i++) { const a = i / n * 2 * PI, w = 1 - 0.14 * hash(seed, i % n) - 0.04 * Math.sin(a * 3); const x = pd.x + Math.cos(a) * R * w, y = pd.y + Math.sin(a) * R * w; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
        c.closePath(); c.fillStyle = '#7d8185'; c.fill();
        if (detail >= 2) {
          for (let i = 0; i < 70; i++) { const a = hash(seed, 100 + i) * 2 * PI, d = Math.sqrt(hash(seed, 200 + i)) * R * 0.85; c.fillStyle = hash(seed, 300 + i) > 0.5 ? 'rgba(40,42,44,.55)' : 'rgba(200,204,208,.45)'; c.fillRect(pd.x + Math.cos(a) * d, pd.y + Math.sin(a) * d, R * 0.045, R * 0.045); }
          c.beginPath(); c.arc(pd.x, pd.y, R * 0.42, 0.3, 4.9); c.lineWidth = R * 0.07; c.strokeStyle = '#1a1c1e'; c.stroke();
          c.beginPath(); c.arc(pd.x, pd.y, R * 0.18, 0, 2 * PI); c.fillStyle = '#5a5e62'; c.fill();
        }
      }
    } else { // SMD: Kehle am Pad
      const hor = pd.w >= pd.h, L = hor ? pd.w : pd.h, W = hor ? pd.h : pd.w;
      c.save(); c.translate(pd.x, pd.y); if (!hor) c.rotate(PI / 2);
      rrect(c, -L * 0.46, -W * 0.44, L * 0.92, W * 0.88, W * 0.3);
      if (!cold) { const g = c.createLinearGradient(0, -W / 2, 0, W / 2); g.addColorStop(0, '#fbfbfc'); g.addColorStop(0.35, '#d9dde1'); g.addColorStop(0.7, '#9aa1a8'); g.addColorStop(1, '#6e757c'); c.fillStyle = g; c.fill(); if (detail >= 2) { c.beginPath(); c.ellipse(-L * 0.12, -W * 0.18, L * 0.18, W * 0.09, 0, 0, 2 * PI); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill(); } }
      else { c.fillStyle = '#80848a'; c.fill(); if (detail >= 2) { for (let i = 0; i < 40; i++) { c.fillStyle = hash(seed, i) > 0.5 ? 'rgba(40,42,44,.5)' : 'rgba(210,214,218,.4)'; c.fillRect((hash(seed, 50 + i) - 0.5) * L * 0.85, (hash(seed, 90 + i) - 0.5) * W * 0.8, W * 0.06, W * 0.06); } c.beginPath(); c.moveTo(-L * 0.35, -W * 0.38); c.lineTo(-L * 0.1, W * 0.1); c.lineTo(-L * 0.25, W * 0.4); c.lineWidth = W * 0.05; c.strokeStyle = '#18191b'; c.stroke(); } }
      c.restore();
    }
  }
  function drawBlob(c, bl, detail) {
    c.save(); c.translate(bl.x, bl.y); c.rotate(bl.ang || 0);
    if (bl.kind === 'bridge') {
      const L = bl.len || 1.8, R = bl.r; rrect(c, -L / 2, -R * 0.62, L, R * 1.24, R * 0.6);
      const g = c.createLinearGradient(0, -R * 0.62, 0, R * 0.62); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#d5d9dd'); g.addColorStop(0.8, '#8f969d'); g.addColorStop(1, '#5e656c'); c.fillStyle = g; c.fill(); c.lineWidth = 0.03; c.strokeStyle = 'rgba(0,0,0,.4)'; c.stroke();
      if (detail >= 2) { c.beginPath(); c.ellipse(-L * 0.1, -R * 0.28, L * 0.22, R * 0.1, 0, 0, 2 * PI); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill(); }
    } else if (bl.kind === 'ball') {
      const R = bl.r; c.beginPath(); c.arc(0.05, 0.08, R * 1.05, 0, 2 * PI); c.fillStyle = 'rgba(0,0,0,.35)'; c.fill();
      const g = c.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.05, 0, 0, R); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#dfe3e6'); g.addColorStop(0.8, '#8d949b'); g.addColorStop(1, '#4f565d'); c.beginPath(); c.arc(0, 0, R, 0, 2 * PI); c.fillStyle = g; c.fill();
      if (detail >= 2) { c.beginPath(); c.arc(-R * 0.32, -R * 0.36, R * 0.16, 0, 2 * PI); c.fillStyle = '#fff'; c.fill(); }
    } else { // Kupferrest
      const L = bl.len || 1.6, W = 0.2; c.beginPath(); c.moveTo(-L / 2, 0); c.lineTo(-L * 0.3, -W * 0.8); c.lineTo(L * 0.05, -W * 0.5); c.lineTo(L * 0.4, -W * 0.9); c.lineTo(L / 2, 0); c.lineTo(L * 0.3, W * 0.7); c.lineTo(-L * 0.05, W * 0.5); c.lineTo(-L * 0.38, W * 0.85); c.closePath();
      const g = c.createLinearGradient(0, -W, 0, W); g.addColorStop(0, '#f0b070'); g.addColorStop(0.5, '#c8793a'); g.addColorStop(1, '#8a4a20'); c.fillStyle = g; c.fill(); c.lineWidth = 0.025; c.strokeStyle = 'rgba(0,0,0,.45)'; c.stroke();
    }
    c.restore();
  }
  function drawCut(c, cut, trackW) {
    const w = (trackW || 0.4) / 2 + 0.06; c.save(); c.translate(cut.x, cut.y); c.rotate(cut.ang || 0);
    c.beginPath(); const n = 9; for (let i = 0; i <= n; i++) { const t = i / n, yy = -w + t * 2 * w, xx = (hash(cut.id.length * 7 + 3, i) - 0.5) * 0.09; if (i) c.lineTo(xx, yy); else c.moveTo(xx, yy); }
    c.lineWidth = 0.024; c.strokeStyle = '#0a0b0c'; c.stroke();
    c.translate(0.03, 0); c.beginPath(); for (let i = 0; i <= n; i++) { const t = i / n, yy = -w + t * 2 * w, xx = (hash(cut.id.length * 7 + 3, i) - 0.5) * 0.09; if (i) c.lineTo(xx, yy); else c.moveTo(xx, yy); }
    c.lineWidth = 0.01; c.strokeStyle = 'rgba(180,255,205,.55)'; c.stroke();
    c.restore();
  }
  function drawText(c, txt, x, y, size, color, mir, align, weight) {
    c.save(); c.translate(x, y); if (mir) c.scale(-1, 1); c.font = (weight || '600') + ' ' + size + 'px system-ui,sans-serif'; c.fillStyle = color; c.textAlign = align || 'center'; c.textBaseline = 'middle'; c.fillText(txt, 0, 0); c.restore();
  }

  function ledShape(c, R) { c.beginPath(); c.moveTo(-0.8 * R, -0.6 * R); c.arc(0, 0, R, Math.atan2(-0.6, -0.8), Math.atan2(0.6, -0.8), false); c.closePath(); }
  /* Bauteilkörper (lokales Koordinatensystem des Bauteils) */
  function drawBody(c, p, cl, fp, st, detail, scale) {
    const pads = fp.pads || [], bb = bodyBox(fp), cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
    const label = p.value || '';
    if (cl.k === 'res' && pads.length === 2) {
      const a = pads[0], b = pads[1], pitch = Math.hypot(b.x - a.x, b.y - a.y);
      if (fp.kind === 'tht' || pitch > 4) {
        const L = Math.max(2.6, Math.min(6.4, pitch * 0.62)), W = L * 0.38, ang = Math.atan2(b.y - a.y, b.x - a.x);
        c.save(); c.translate((a.x + b.x) / 2, (a.y + b.y) / 2); c.rotate(ang);
        c.beginPath(); c.moveTo(-pitch / 2, 0); c.lineTo(pitch / 2, 0); c.lineWidth = 0.55; c.strokeStyle = '#aab0b6'; c.lineCap = 'round'; c.stroke();
        const g = c.createLinearGradient(0, -W / 2, 0, W / 2); g.addColorStop(0, '#f1e3c0'); g.addColorStop(0.45, '#d8c595'); g.addColorStop(1, '#a6905e');
        c.beginPath(); c.moveTo(-L / 2 + W * 0.2, -W / 2); c.lineTo(L / 2 - W * 0.2, -W / 2); c.quadraticCurveTo(L / 2 + W * 0.18, -W / 2, L / 2 + W * 0.18, 0); c.quadraticCurveTo(L / 2 + W * 0.18, W / 2, L / 2 - W * 0.2, W / 2); c.lineTo(-L / 2 + W * 0.2, W / 2); c.quadraticCurveTo(-L / 2 - W * 0.18, W / 2, -L / 2 - W * 0.18, 0); c.quadraticCurveTo(-L / 2 - W * 0.18, -W / 2, -L / 2 + W * 0.2, -W / 2); c.closePath(); c.fillStyle = g; c.fill(); c.lineWidth = 0.03; c.strokeStyle = 'rgba(0,0,0,.4)'; c.stroke();
        const bands = bandsOf(p.value);
        if (bands) bands.forEach((col, i) => { const x = -L / 2 + L * (0.18 + i * 0.145) + (i === 3 ? L * 0.12 : 0); c.fillStyle = col; c.fillRect(x, -W / 2 + 0.02, L * 0.075, W - 0.04); });
        else drawText(c, label, 0, 0, W * 0.45, '#222', false);
        if (p.defect === 'open' && detail >= 2) { c.beginPath(); c.arc(L * 0.05, 0, W * 0.38, 0, 2 * PI); c.fillStyle = 'rgba(30,18,10,.8)'; c.fill(); c.beginPath(); c.moveTo(-W * 0.2, -W * 0.5); c.lineTo(W * 0.1, W * 0.5); c.strokeStyle = '#000'; c.lineWidth = 0.05; c.stroke(); }
        c.restore();
      } else {
        const L = pitch + 0.2, W = Math.max(a.h, 0.7) * 0.85;
        c.save(); c.translate((a.x + b.x) / 2, (a.y + b.y) / 2); c.rotate(Math.atan2(b.y - a.y, b.x - a.x));
        rrect(c, -L / 2, -W / 2, L, W, 0.06); c.fillStyle = '#1a1b1d'; c.fill(); c.fillStyle = '#c3c7cb'; c.fillRect(-L / 2, -W / 2, L * 0.16, W); c.fillRect(L / 2 - L * 0.16, -W / 2, L * 0.16, W);
        const v = parseVal(p.value); let code = ''; if (isFinite(v) && v > 0) { let e = Math.floor(Math.log10(v)) - 1, m = Math.round(v / Math.pow(10, e)); if (m >= 100) { m = Math.round(m / 10); e++; } if (m < 10) { m *= 10; e--; } code = e < 0 ? String(m / 10).replace('.', 'R') : String(Math.floor(m)).slice(0, 2) + String(Math.max(0, e)); }
        if (scale >= 22 || detail >= 2) drawText(c, code, 0, 0, W * 0.55, '#e8e8e8', false);
        if (p.defect === 'open' && detail >= 2) { c.beginPath(); c.arc(0, 0, W * 0.4, 0, 2 * PI); c.fillStyle = 'rgba(70,40,20,.75)'; c.fill(); }
        c.restore();
      }
      return;
    }
    if (cl.k === 'cap' && pads.length === 2) {
      const a = pads[0], b = pads[1], pitch = Math.hypot(b.x - a.x, b.y - a.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (fp.kind === 'tht' || pitch > 3.5) {
        const cc = circleFp(fp), D = cc ? cc.r * 2 : Math.max(3.2, Math.min(12, (fp.courtyard ? Math.min(fp.courtyard.w, fp.courtyard.h) : pitch + 2) - 0.6)), R = D / 2;
        if (cl.pol) {
          c.save(); c.translate(mx, my);
          c.beginPath(); c.arc(0, 0, R, 0, 2 * PI); const g = c.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R); g.addColorStop(0, '#34487a'); g.addColorStop(0.7, '#1c2b52'); g.addColorStop(1, '#101a36'); c.fillStyle = g; c.fill(); c.lineWidth = 0.05; c.strokeStyle = '#0a0f20'; c.stroke();
          const ang = Math.atan2(b.y - a.y, b.x - a.x); c.save(); c.rotate(ang); c.beginPath(); c.rect(R * 0.45, -R, R * 0.55, 2 * R); c.save(); c.clip(); c.beginPath(); c.arc(0, 0, R, 0, 2 * PI); c.fillStyle = '#c4ccd8'; c.fill(); c.restore();
          for (let i = -2; i <= 2; i++) drawText(c, '−', R * 0.72, i * R * 0.32, R * 0.4, '#162033', false, 'center', '800');
          c.restore();
          c.beginPath(); c.arc(0, 0, R * 0.62, 0, 2 * PI); c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 0.05; c.stroke();
          if (scale >= 16 || detail >= 2) { c.save(); c.rotate(p.side === 'bot' ? 0 : -ROT_SIGN * (p.rot || 0) * PI / 180); drawText(c, (p.value || '').replace(/F$/, '').replace('u', 'µ') + 'F', 0, -R * 0.1, R * 0.34, '#dfe6f2', false); drawText(c, '25V', 0, R * 0.28, R * 0.28, '#b8c4dc', false); c.restore(); }
          c.restore();
        } else {
          c.save(); c.translate(mx, my); c.beginPath(); c.ellipse(0, 0, Math.min(R, 2.2), Math.min(R, 2.2) * 1.15, 0, 0, 2 * PI); const g = c.createRadialGradient(-0.6, -0.6, 0.1, 0, 0, 2.6); g.addColorStop(0, '#f0d27a'); g.addColorStop(1, '#b5882a'); c.fillStyle = g; c.fill(); c.lineWidth = 0.04; c.strokeStyle = 'rgba(0,0,0,.4)'; c.stroke(); if (scale >= 16 || detail >= 2) drawText(c, (p.value || '').replace(/F$/, ''), 0, 0, 0.9, '#3a2a00', false); c.restore();
        }
        if (p.defect === 'short' && detail >= 2) { c.beginPath(); c.arc(mx, my, R * 0.9, 0, 2 * PI); c.fillStyle = 'rgba(60,40,10,.35)'; c.fill(); }
      } else {
        const L = pitch + 0.1, W = Math.max(a.h, 0.7) * 0.85;
        c.save(); c.translate(mx, my); c.rotate(Math.atan2(b.y - a.y, b.x - a.x)); rrect(c, -L / 2, -W / 2, L, W, 0.06); c.fillStyle = cl.pol ? '#c9a05a' : '#a98a5c'; c.fill(); c.fillStyle = '#c8cdd2'; c.fillRect(-L / 2, -W / 2, L * 0.16, W); c.fillRect(L / 2 - L * 0.16, -W / 2, L * 0.16, W);
        if (cl.pol) { c.fillStyle = '#6a4f1e'; c.fillRect(-L / 2 + L * 0.16, -W / 2, L * 0.1, W); }
        c.restore();
      }
      return;
    }
    if ((cl.k === 'led' || cl.k === 'diode') && pads.length >= 2) {
      const K = localPad(fp, cl.K) || pads[0], A = localPad(fp, cl.A) || pads[1], mx = (K.x + A.x) / 2, my = (K.y + A.y) / 2, pitch = Math.hypot(K.x - A.x, K.y - A.y), ang = Math.atan2(A.y - K.y, A.x - K.x);
      if (cl.k === 'led' && (fp.kind === 'tht' || pitch > 3)) {
        const cc = circleFp(fp), R = cc ? cc.r : Math.max(1.4, Math.min(3, ((fp.courtyard ? Math.min(fp.courtyard.w, fp.courtyard.h) : 5) - 0.6) / 2)), rgb = ledColor(p.value), on = st && st.on ? st.level : 0;
        c.save(); c.translate(mx, my); c.rotate(ang);
        ledShape(c, R * 1.1); c.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',.28)'; c.fill(); c.lineWidth = 0.04; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
        ledShape(c, R * 0.98); const g = c.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.05, 0, 0, R);
        const lit = Math.max(on, 0), mix = (v, t) => Math.round(v + (255 - v) * t);
        g.addColorStop(0, 'rgb(' + mix(rgb[0], 0.75 * (0.4 + lit * 0.6)) + ',' + mix(rgb[1], 0.75 * (0.4 + lit * 0.6)) + ',' + mix(rgb[2], 0.75 * (0.4 + lit * 0.6)) + ')'); g.addColorStop(0.75, 'rgb(' + Math.round(rgb[0] * (0.55 + lit * 0.45)) + ',' + Math.round(rgb[1] * (0.55 + lit * 0.45)) + ',' + Math.round(rgb[2] * (0.55 + lit * 0.45)) + ')'); g.addColorStop(1, 'rgb(' + Math.round(rgb[0] * 0.45) + ',' + Math.round(rgb[1] * 0.45) + ',' + Math.round(rgb[2] * 0.45) + ')');
        c.fillStyle = g; c.fill(); c.lineWidth = 0.05; c.strokeStyle = 'rgba(0,0,0,.45)'; c.stroke();
                c.beginPath(); c.arc(-R * 0.3, -R * 0.38, R * 0.17, 0, 2 * PI); c.fillStyle = 'rgba(255,255,255,.7)'; c.fill();
        if (detail >= 2 && p.defect === 'open') { c.beginPath(); c.moveTo(-R * 0.4, -R * 0.1); c.lineTo(R * 0.4, R * 0.1); c.strokeStyle = '#222'; c.lineWidth = 0.06; c.stroke(); }
        c.restore();
        if (lit > 0.02) { c.save(); c.globalCompositeOperation = 'lighter'; const gg = c.createRadialGradient(mx, my, R * 0.3, mx, my, R * (2.4 + lit * 2)); gg.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (0.55 * lit) + ')'); gg.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)'); c.fillStyle = gg; c.beginPath(); c.arc(mx, my, R * (2.4 + lit * 2), 0, 2 * PI); c.fill(); c.restore(); }
      } else {
        const L = pitch + 0.1, W = Math.max(K.h, 0.7) * 0.85, rgb = ledColor(p.value), on = st && st.on ? st.level : 0;
        c.save(); c.translate(mx, my); c.rotate(ang); rrect(c, -L / 2, -W / 2, L, W, 0.06);
        if (cl.k === 'led') { const f = 0.45 + 0.55 * on; c.fillStyle = 'rgb(' + Math.round(rgb[0] * f) + ',' + Math.round(rgb[1] * f) + ',' + Math.round(rgb[2] * f) + ')'; c.fill(); c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(-L / 2, -W / 2, L * 0.12, W); }
        else { c.fillStyle = '#18191b'; c.fill(); c.fillStyle = '#d6d9dc'; c.fillRect(-L / 2 + L * 0.06, -W / 2, L * 0.14, W); }
        c.restore();
        if (on > 0.02) { c.save(); c.globalCompositeOperation = 'lighter'; const gg = c.createRadialGradient(mx, my, 0.1, mx, my, 2.2); gg.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (0.5 * on) + ')'); gg.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)'); c.fillStyle = gg; c.beginPath(); c.arc(mx, my, 2.2, 0, 2 * PI); c.fill(); c.restore(); }
      }
      return;
    }
    if (cl.k === 'conn') {
      const pw = pads.length ? Math.max(0.5, bb.x1 - bb.x0 - 0.2) : 4, ph = Math.max(2.54, bb.y1 - bb.y0 - 0.3);
      c.save(); rrect(c, bb.x0 + 0.05, bb.y0 + 0.15, bb.x1 - bb.x0 - 0.1, bb.y1 - bb.y0 - 0.3, 0.2); const g = c.createLinearGradient(0, bb.y0, 0, bb.y1); g.addColorStop(0, '#3a3d42'); g.addColorStop(1, '#1b1d20'); c.fillStyle = g; c.fill();
      pads.forEach(pp => { c.fillStyle = '#d9b44a'; c.fillRect(pp.x - 0.32, pp.y - 0.32, 0.64, 0.64); });
      if (scale >= 14 || detail >= 2) drawText(c, p.ref, cx, cy, 0.9, '#9aa3ad', false); c.restore(); return;
    }
    // IC und alles andere: dunkler Körper zwischen den Pads
    let x0 = bb.x0, x1 = bb.x1, y0 = bb.y0, y1 = bb.y1;
    const xs = pads.map(q => q.x), ys = pads.map(q => q.y), dxs = new Set(xs.map(v => Math.round(v * 100))).size, dys = new Set(ys.map(v => Math.round(v * 100))).size;
    const skRect = (fp.silk || []).find(q => q.t === 'rect');
    if (pads.length >= 4 && dxs <= 2 && dys >= 2) { // zwei Spalten (DIP, SOIC, SOT-223)
      const half = pads.reduce((m, q) => Math.min(m, Math.abs(q.x) - q.w / 2), 1e9); x0 = -Math.max(half, 0.6) + 0.05; x1 = -x0; y0 = bb.y0 + 0.3; y1 = bb.y1 - 0.3;
    } else if (pads.length >= 4 && dys <= 2 && dxs >= 2) { // zwei Reihen
      const half = pads.reduce((m, q) => Math.min(m, Math.abs(q.y) - q.h / 2), 1e9); y0 = -Math.max(half, 0.6) + 0.05; y1 = -y0; x0 = bb.x0 + 0.3; x1 = bb.x1 - 0.3;
    } else if (pads.length < 4 && skRect) { x0 = skRect.x; y0 = skRect.y; x1 = skRect.x + skRect.w; y1 = skRect.y + skRect.h; }
    else if (pads.length < 4) { y0 = bb.y0 - 3.2; y1 = bb.y1 + 0.3; }
    else { x0 += 0.5; x1 -= 0.5; y0 += 0.5; y1 -= 0.5; }
    const isTO = /TO-?220/i.test(fp.id || ''), isReg = cl.k === 'reg';

    c.save();
    if (isTO) { // Kühlfahne
      c.fillStyle = '#b9bec4'; rrect(c, x0 + 0.5, y0 - 2.2, x1 - x0 - 1, 2.8, 0.3); c.fill(); c.beginPath(); c.arc((x0 + x1) / 2, y0 - 1.1, 0.85, 0, 2 * PI); c.fillStyle = '#111'; c.fill();
    }
    rrect(c, x0, y0, x1 - x0, y1 - y0, 0.25); const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, '#34383d'); g.addColorStop(1, '#17191c'); c.fillStyle = g; c.fill(); c.lineWidth = 0.04; c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
    // Markierung Pin 1
    const p1 = localPad(fp, '1') || pads[0];
    if (p1 && pads.length >= 3 && !isTO) {
      const bw = x1 - x0, bh = y1 - y0; let nx = 0, ny = 0;
      if (bh >= bw) ny = p1.y < 0 ? -1 : 1; else nx = p1.x < 0 ? -1 : 1;
      const ex = nx ? (nx < 0 ? x0 : x1) : (x0 + x1) / 2, ey = ny ? (ny < 0 ? y0 : y1) : (y0 + y1) / 2;
      c.beginPath(); if (nx) c.arc(ex, ey, Math.min(bw, bh) * 0.12, nx < 0 ? -PI / 2 : PI / 2, nx < 0 ? PI / 2 : PI * 1.5); else c.arc(ex, ey, Math.min(bw, bh) * 0.12, ny < 0 ? 0 : PI, ny < 0 ? PI : 2 * PI);
      c.fillStyle = '#0b0c0e'; c.fill();
      const dx = p1.x < (x0 + x1) / 2 ? x0 + Math.min(bw, bh) * 0.18 : x1 - Math.min(bw, bh) * 0.18, dy = p1.y < (y0 + y1) / 2 ? y0 + Math.min(bw, bh) * 0.18 : y1 - Math.min(bw, bh) * 0.18;
      c.beginPath(); c.arc(dx, dy, Math.min(0.4, Math.min(bw, bh) * 0.07), 0, 2 * PI); c.fillStyle = '#9aa0a6'; c.fill();
    }
    if (scale >= 10 || detail >= 2) {
      const bw = x1 - x0, bh = y1 - y0, vert = bh > bw * 1.15; c.save(); c.translate((x0 + x1) / 2, (y0 + y1) / 2 + (isTO ? 0.3 : 0)); if (vert) c.rotate(-PI / 2 * 0 + PI / 2);
      const L = vert ? bh : bw, W = vert ? bw : bh; drawText(c, fmtShort(p.value || p.ref), 0, 0, Math.min(1.1, L * 0.16, W * 0.45), '#cfd5dc', false); c.restore();
    }
    c.restore();
  }

  /* Polaritäts-Siebdruck nach Soll-Stand (zeigt die richtige Einbaulage) */
  function drawPolSilk(c, sp, cl, fp, mirSide) {
    const pads = fp.pads || []; if (!pads.length) return;
    c.save(); c.translate(sp.x, sp.y); c.rotate(ROT_SIGN * (sp.rot || 0) * PI / 180); if (sp.side === 'bot') c.scale(-1, 1);
    c.strokeStyle = COL.silk; c.fillStyle = COL.silk; c.lineWidth = 0.15; c.lineCap = 'round';
    if ((cl.k === 'led' || cl.k === 'diode' || (cl.k === 'cap' && cl.pol)) && pads.length >= 2) {
      const a = localPad(fp, cl.k === 'cap' ? cl.minus : cl.K) || pads[0], b = localPad(fp, cl.k === 'cap' ? cl.plus : cl.A) || pads[1], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, pitch = Math.hypot(a.x - b.x, a.y - b.y);
      const ang = Math.atan2(a.y - b.y, a.x - b.x); // von Plus/Anode zu Minus/Kathode
      c.save(); c.translate(mx, my); c.rotate(ang);
      if (fp.kind === 'tht' || pitch > 3.5) {
        const cc = circleFp(fp), R = cc ? cc.r : Math.max(1.5, Math.min(4.2, ((fp.courtyard ? Math.min(fp.courtyard.w, fp.courtyard.h) : 5) - 0.4) / 2)) + 0.15;
        if (cl.k === 'led') ledShape(c, R + 0.35); else { c.beginPath(); c.arc(0, 0, R, 0, 2 * PI); }
        c.stroke();
        if (cl.k === 'cap') { c.beginPath(); c.arc(0, 0, R, -PI / 2, PI / 2, false); c.closePath(); c.globalAlpha = 0.55; c.fill(); c.globalAlpha = 1; c.save(); c.translate(-R * 0.62, 0); c.rotate(-ang); drawText(c, '+', 0, 0, 1.3, COL.silk, false, 'center', '800'); c.restore(); }
      } else { c.beginPath(); c.moveTo(pitch / 2 + 0.9, -0.9); c.lineTo(pitch / 2 + 0.9, 0.9); c.stroke(); }
      c.restore();
    } else if ((cl.k === 'ic' || cl.k === 'reg') && !(fp.silk && fp.silk.length)) {
      const p1 = localPad(fp, '1') || pads[0], bb = bodyBox(fp); c.beginPath(); c.arc(p1.x + (p1.x < 0 ? -1.0 : 1.0) * (Math.abs(p1.x) > Math.abs(p1.y) ? 0.9 : 0), p1.y + (Math.abs(p1.y) >= Math.abs(p1.x) ? (p1.y < 0 ? -1.1 : 1.1) : 0), 0.28, 0, 2 * PI); c.fill();
      c.beginPath(); c.rect(bb.x0 - 0.15, bb.y0 - 0.15, bb.x1 - bb.x0 + 0.3, bb.y1 - bb.y0 + 0.3); c.lineWidth = 0.1; c.globalAlpha = 0.7; c.stroke(); c.globalAlpha = 1;
    }
    c.restore();
  }

  /* ---------- Szene zeichnen: Draufsicht der Baugruppe */
  function sceneCache(S) {
    const b = S.board; if (S._cb === b && S._cs === (b.parts || []).length) return S._c;
    const pads = worldPads(b); pads.forEach(p => { p.caps = padCaps(p); });
    const part = {}; (b.parts || []).forEach(p => { part[p.ref] = p; });
    const sol = {}; ((b.repair && b.repair.soll && b.repair.soll.parts) || []).forEach(p => { sol[p.ref] = p; });
    S._cb = b; S._cs = (b.parts || []).length; S._c = { pads, part, sol }; return S._c;
  }
  function renderScene(c, S, o) {
    calibrate();
    const b = S.board, sc = sceneCache(S), detail = o.detail || 0, mir = S.side === 'bot', layer = mir ? 'B.Cu' : 'F.Cu', s = o.scale, cull = o.cull;
    const inView = (x, y, r) => !cull || !(x + r < cull.x0 || x - r > cull.x1 || y + r < cull.y0 || y - r > cull.y1);
    const ops = {}; if (S.op && S.op.leds) S.op.leds.forEach(l => { ops[l.ref] = l; });
    // Platine
    const g = c.createLinearGradient(0, 0, b.w, b.h); g.addColorStop(0, COL.sub1); g.addColorStop(1, COL.sub2);
    rrect(c, 0, 0, b.w, b.h, 0.8); c.fillStyle = g; c.fill(); c.lineWidth = 0.18; c.strokeStyle = '#d8c76a'; c.stroke();
    if (detail < 2) { c.save(); c.globalAlpha = 0.05; for (let i = 0; i < 90; i++) { c.fillStyle = hash(i, 7) > 0.5 ? '#fff' : '#000'; c.fillRect(hash(i, 1) * b.w, hash(i, 2) * b.h, 0.3 + hash(i, 3) * 0.8, 0.12); } c.restore(); }
    // Kupferflächen
    (b.zones || []).forEach(z => { if (z.layer !== layer || !z.poly || z.poly.length < 3) return; c.beginPath(); z.poly.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fillStyle = 'rgba(90,190,130,.22)'; c.fill(); });
    // Leiterbahnen (unter Lötstopplack)
    c.lineCap = 'round'; c.lineJoin = 'round';
    (b.tracks || []).forEach(t => {
      if (t.layer !== layer && !(S.ghost && (t.layer === 'F.Cu' || t.layer === 'B.Cu'))) return; const ghost = t.layer !== layer;
      c.beginPath(); (t.pts || []).forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      c.globalAlpha = ghost ? 0.18 : 1; c.lineWidth = (t.w || 0.25) + 0.12; c.strokeStyle = 'rgba(0,0,0,.22)'; c.stroke();
      c.lineWidth = t.w || 0.25; c.strokeStyle = COL.trk; c.stroke();
      if (!ghost) { c.lineWidth = Math.max(0.05, (t.w || 0.25) * 0.28); c.strokeStyle = COL.trkHi; c.stroke(); }
      c.globalAlpha = 1;
    });
    // Vias
    (b.vias || []).forEach(v => {
      if (!inView(v.x, v.y, 1)) return; const R = (v.dia || 0.8) / 2;
      c.beginPath(); c.arc(v.x, v.y, R, 0, 2 * PI); const gg = c.createRadialGradient(v.x - R * 0.3, v.y - R * 0.3, 0.02, v.x, v.y, R); gg.addColorStop(0, '#d9a768'); gg.addColorStop(1, '#8a5a2a'); c.fillStyle = gg; c.fill(); c.lineWidth = 0.03; c.strokeStyle = 'rgba(0,0,0,.4)'; c.stroke();
      c.beginPath(); c.arc(v.x, v.y, (v.drill || 0.4) / 2, 0, 2 * PI); c.fillStyle = COL.hole; c.fill();
      if (v.broken && detail >= 2) { c.beginPath(); c.moveTo(v.x - R * 0.9, v.y + R * 0.15); c.lineTo(v.x - R * 0.35, v.y - R * 0.1); c.lineTo(v.x + R * 0.1, v.y + R * 0.3); c.lineTo(v.x + R * 0.95, v.y - R * 0.2); c.lineWidth = 0.035; c.strokeStyle = '#0a0a0a'; c.stroke(); }
    });
    // Pads und Lötstellen
    sc.pads.forEach(pd => {
      if (pd.layers.indexOf(layer) < 0 || !inView(pd.x, pd.y, 3)) return;
      const p = sc.part[pd.ref]; drawPad(c, pd, false);
      if (!p) return;
      const cold = (p.cold || []).indexOf(pd.n) >= 0, tht = !!pd.drill, solderSide = tht && (p.side === 'bot') === !mir ? false : true;
      const onPartSide = (p.side === 'bot') === mir;
      if (tht && !onPartSide) drawJoint(c, pd, detail >= 2 && cold, detail, pd.x * 13 + pd.y * 7);
      else if (!tht && onPartSide && (s >= 14 || detail >= 1)) drawJoint(c, pd, detail >= 2 && cold, detail, pd.x * 13 + pd.y * 7);
      else if (tht && onPartSide && detail >= 2) drawJoint(c, pd, cold, detail, pd.x * 13 + pd.y * 7);
    });
    // Siebdruck: Einbaulage nach Soll, fehlende Bauteile
    c.save(); c.globalAlpha = 0.95;
    Object.keys(sc.sol).forEach(ref => {
      const sp = sc.sol[ref]; if ((sp.side === 'bot') !== mir) return; if (!inView(sp.x, sp.y, 8)) return;
      const fp = fpOf(sp.fp), cl = classify(sp); drawPolSilk(c, sp, cl, fp, mir);
      if (!sc.part[ref]) { // leerer Bestückungsplatz
        const cy = fp.courtyard || { x: -2, y: -1, w: 4, h: 2 }; c.save(); partFrame(c, sp); c.setLineDash([0.4, 0.3]); c.lineWidth = 0.12; c.strokeStyle = COL.silk; c.strokeRect(cy.x, cy.y, cy.w, cy.h); c.restore();
      }
      (fp.silk || []).forEach(sk => { c.save(); partFrame(c, sp); c.lineWidth = 0.15; c.strokeStyle = COL.silk; c.beginPath(); if (sk.t === 'line') { c.moveTo(sk.x1, sk.y1); c.lineTo(sk.x2, sk.y2); } else if (sk.t === 'rect') c.rect(sk.x, sk.y, sk.w, sk.h); else if (sk.t === 'circle') c.arc(sk.x, sk.y, sk.r, 0, 2 * PI); c.stroke(); c.restore(); });
    });
    c.restore();
    // Bauteilkörper
    (b.parts || []).forEach(p => {
      if ((p.side === 'bot') !== mir || !inView(p.x, p.y, 10)) return;
      const fp = fpOf(p.fp), cl = classify(p), st = ops[p.ref];
      c.save(); partFrame(c, p); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = Math.max(1, s * 0.25); c.shadowOffsetX = 1; c.shadowOffsetY = 1; drawBody(c, p, cl, fp, st, detail, s); c.restore();
      if (S.hot && S.hot[p.ref] && S.power) { c.save(); c.globalCompositeOperation = 'lighter'; const gg = c.createRadialGradient(p.x, p.y, 0.2, p.x, p.y, 4); const k = 0.5 + 0.5 * Math.sin(performance.now() / 120); gg.addColorStop(0, 'rgba(255,120,30,' + (0.45 + 0.3 * k) + ')'); gg.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = gg; c.beginPath(); c.arc(p.x, p.y, 4, 0, 2 * PI); c.fill(); c.restore(); }
    });
    // Lötbrücken, Zinnperlen, Kupferreste
    (b.blobs || []).forEach(bl => {
      if (bl.layer !== layer || !inView(bl.x, bl.y, 3)) return;
      const vis = bl.kind === 'bridge' ? (s >= 16 || detail >= 2) : detail >= 2; if (!vis) return;
      drawBlob(c, bl, detail);
    });
    // Haarrisse nur in der Lupe
    if (detail >= 2) (b.cuts || []).forEach(ct => { if (ct.layer !== layer || !inView(ct.x, ct.y, 2)) return; const t = (b.tracks || []).find(q => q.id === ct.track); drawCut(c, ct, t && t.w); });
    // Fädeldrähte
    (b.wires || []).forEach(w => {
      const sa = (w.a.side === 'bot') === mir, sb = (w.b.side === 'bot') === mir; c.save(); c.lineCap = 'round';
      c.beginPath(); c.moveTo(w.a.x, w.a.y); const mx = (w.a.x + w.b.x) / 2, my = (w.a.y + w.b.y) / 2, dx = w.b.x - w.a.x, dy = w.b.y - w.a.y, L = Math.hypot(dx, dy) || 1;
      c.quadraticCurveTo(mx - dy / L * 0.8, my + dx / L * 0.8, w.b.x, w.b.y); c.globalAlpha = sa && sb ? 1 : 0.35; c.lineWidth = 0.42; c.strokeStyle = 'rgba(0,0,0,.4)'; c.stroke(); c.lineWidth = 0.3; c.strokeStyle = '#3d7bd9'; if (!(sa && sb)) c.setLineDash([0.5, 0.4]); c.stroke(); c.setLineDash([]);
      [w.a, w.b].forEach(pt => { c.beginPath(); c.arc(pt.x, pt.y, 0.38, 0, 2 * PI); const gg = c.createRadialGradient(pt.x - 0.1, pt.y - 0.1, 0.02, pt.x, pt.y, 0.38); gg.addColorStop(0, '#fff'); gg.addColorStop(1, '#8d949b'); c.fillStyle = gg; c.fill(); });
      c.restore();
    });
    if (S.wire) { const a = S.wire.a; c.beginPath(); c.arc(a.x, a.y, 0.5, 0, 2 * PI); c.strokeStyle = '#3d9bff'; c.lineWidth = 0.12; c.stroke(); if (S.wire.cur) { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(S.wire.cur.x, S.wire.cur.y); c.setLineDash([0.4, 0.3]); c.stroke(); c.setLineDash([]); } }
    // Bezeichnungen
    if (detail < 2 && s >= 7) (b.parts || []).forEach(p => {
      if ((p.side === 'bot') !== mir) return; const fp = fpOf(p.fp), cy = fp.courtyard || { x: -1, y: -1, w: 2, h: 2 }, r = Math.max(cy.w, cy.h) / 2 + 0.9;
      drawText(c, p.ref, p.x, p.y - r, 1.15, COL.silk, mir, 'center', '700');
    });
    Object.keys(sc.sol).forEach(ref => { if (sc.part[ref] || detail >= 2 && false) return; const sp = sc.sol[ref]; if ((sp.side === 'bot') !== mir) return; const fp = fpOf(sp.fp), cy = fp.courtyard || { w: 2, h: 2 }; drawText(c, ref, sp.x, sp.y - Math.max(cy.w, cy.h) / 2 - 0.9, 1.15, COL.silk, mir, 'center', '700'); });
    // Rauch
    (S.smoke || []).forEach(q => { c.beginPath(); c.arc(q.x + Math.sin(q.age * 4 + q.ph) * 0.6, q.y - q.age * 3, 0.5 + q.age * 1.6, 0, 2 * PI); c.fillStyle = 'rgba(150,150,150,' + Math.max(0, 0.45 - q.age * 0.3) + ')'; c.fill(); });
    // Tipp-Markierung
    if (S.hl) { c.beginPath(); c.arc(S.hl.x, S.hl.y, S.hl.r, 0, 2 * PI); c.lineWidth = 0.3; c.strokeStyle = 'rgba(255,214,64,.95)'; c.setLineDash([0.8, 0.6]); c.stroke(); c.setLineDash([]); }
  }

  /* ---------- Schaltplan-Karten */
  function netLabel(n) { return n ? esc(n) : '–'; }
  function symbolSvg(p, cl, fp, pinNet) {
    const pn = k => pinNet[k] || '';
    const lab = (x, y, t, a) => `<text x="${x}" y="${y}" text-anchor="${a || 'middle'}" font-size="9.5" fill="#8fd1ff">${netLabel(t)}</text>`;
    const num = (x, y, t, a) => `<text x="${x}" y="${y}" text-anchor="${a || 'middle'}" font-size="8" fill="#707c88">${t}</text>`;
    let body = '';
    const stroke = 'stroke="#e8edf2" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"';
    if (cl.k === 'res' || cl.k === 'fuse') body = `<path d="M8 36H42M108 36H142" ${stroke}/><rect x="42" y="28" width="66" height="16" ${stroke}/>${lab(22, 28, pn('1'))}${lab(128, 28, pn('2'))}${num(22, 52, '1')}${num(128, 52, '2')}`;
    else if (cl.k === 'cap') body = `<path d="M8 36H66M84 36H142M66 20V52M84 20V52" ${stroke}/>${cl.pol ? '<text x="58" y="20" font-size="12" fill="#e8edf2" text-anchor="end">+</text>' : ''}${lab(28, 28, pn(cl.pol ? cl.plus : '1'))}${lab(122, 28, pn(cl.pol ? cl.minus : '2'))}${num(28, 52, cl.pol ? '+' : '1')}${num(122, 52, cl.pol ? '−' : '2')}`;
    else if (cl.k === 'led' || cl.k === 'diode') body = `<path d="M8 36H52M98 36H142M52 20L52 52L98 36Z M98 20V52" ${stroke}/>${cl.k === 'led' ? '<path d="M70 14L82 4M80 20L92 10" stroke="#ffd24a" stroke-width="1.6" fill="none"/>' : ''}${lab(24, 28, pn(cl.A))}${lab(124, 28, pn(cl.K))}${num(24, 52, 'A')}${num(124, 52, 'K')}`;
    else if (cl.k === 'conn') {
      const ps = fp.pads || [], n = ps.length, h = Math.min(60, 12 + n * 12); body = `<rect x="52" y="${34 - h / 2 + 4}" width="46" height="${h}" ${stroke}/>` + ps.map((q, i) => { const y = 34 - h / 2 + 4 + 8 + i * ((h - 12) / Math.max(1, n - 1 || 1)); return `<path d="M8 ${y}H52" ${stroke}/>${lab(30, y - 3, pn(q.n))}${num(88, y + 3, q.n)}`; }).join('');
    } else {
      const ps = (fp.pads || []).slice().sort((a, b) => +a.n - +b.n), n = ps.length, half = Math.ceil(n / 2), rows = Math.max(3, half), h = Math.min(70, rows * 11 + 6); const two = n > 3;
      body = `<rect x="56" y="${36 - h / 2}" width="38" height="${h}" ${stroke}/><text x="75" y="${36 - h / 2 + 11}" text-anchor="middle" font-size="8" fill="#aab6c3">${esc(fmtShort(p.value))}</text>`;
      ps.forEach((q, i) => { const left = two ? i < half : true, idx = two ? (left ? i : n - 1 - i) : i, y = 36 - h / 2 + 16 + idx * ((h - 22) / Math.max(1, (two ? half : n) - 1)); body += `<path d="M${left ? 40 : 94} ${y}H${left ? 56 : 110}" ${stroke}/>${lab(left ? 26 : 125, y + 3, pn(q.n))}${num(left ? 62 : 88, y + 3, q.n)}`; });
    }
    const hh = (cl.k === 'ic' || cl.k === 'reg' || cl.k === 'conn') ? 78 : 58;
    return `<svg viewBox="0 0 150 ${hh}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  }
  function schematicHtml(S) {
    const b = S.board, ref = (b.repair && b.repair.soll) || { parts: b.parts, nets: b.nets }, nm = {};
    (ref.nets || b.nets || []).forEach(n => (n.pins || []).forEach(pk => { nm[pk] = n.name; }));
    const cards = (ref.parts || []).map(p => {
      const cl = classify(p), fp = fpOf(p.fp), pinNet = {}; (fp.pads || []).forEach(q => { pinNet[q.n] = nm[p.ref + '.' + q.n] || ''; });
      const val = cl.k === 'res' || cl.k === 'fuse' ? p.value.replace('.', ',') + ' Ω' : cl.k === 'cap' ? p.value.replace(/F$/, '').replace('u', 'µ').replace('.', ',') + 'F' : p.value;
      return `<div class="pr-card${S.sel === p.ref ? ' sel' : ''}" data-ref="${esc(p.ref)}"><div class="h"><b>${esc(p.ref)}</b> · ${esc(val)} · ${esc(p.fp)}</div>${symbolSvg(p, cl, fp, pinNet)}</div>`;
    }).join('');
    const rows = (ref.nets || []).map(n => `<tr><td><b>${esc(n.name)}</b></td><td>${(n.pins || []).map(esc).join(', ')}</td></tr>`).join('');
    return `<p style="margin:0 0 8px;color:#aab6c3;font-size:13px">So sollte die Baugruppe verschaltet sein. Jeder Anschluss zeigt sein Netz. Die Werte in der Überschrift sind die <b style="color:#fff">Soll-Werte</b>.</p>${cards}<h4>Netzliste</h4><table>${rows}</table>`;
  }

  /* ---------- Wertelisten fürs Bauteiltauschen */
  const E_R = ['10', '47', '100', '150', '220', '330', '470', '680', '1k', '1.5k', '2.2k', '3.3k', '4.7k', '6.8k', '10k', '22k', '47k', '100k', '470k', '1M'];
  const E_C = ['10p', '100p', '1n', '10n', '100n', '1u', '4.7u', '10u', '47u', '100u', '220u', '330u', '470u', '1000u'];
  function valueOptions(p, cl, solValue) {
    const mk = (arr, unit) => { const l = arr.slice(); if (solValue && !l.some(v => sameValue(v, solValue))) l.push(solValue); l.sort((a, b) => parseVal(a) - parseVal(b)); return l.map(v => ({ value: v, label: unit === 'F' ? v.replace('u', 'µ') + 'F' : v.replace('.', ',').replace(/k$/, ' kΩ').replace(/M$/, ' MΩ').replace(/(\d)$/, '$1 Ω') })); };
    if (cl.k === 'res') return mk(E_R, 'R'); if (cl.k === 'cap') return mk(E_C, 'F');
    if (cl.k === 'led') return ['LED rot', 'LED grün', 'LED gelb', 'LED blau'].map(v => ({ value: v, label: v }));
    if (cl.k === 'diode') return ['1N4007', '1N4148', 'BAT43'].map(v => ({ value: v, label: v }));
    return [{ value: solValue || p.value, label: (solValue || p.value) }];
  }

  /* ================================================================ Die Ansicht */
  const REG = root.PCB_VIEWS = root.PCB_VIEWS || { views: {}, register(id, def) { this.views[id] = def; } };
  REG.register('repair', {
    title: 'Fehlersuche',
    mount(el, ctx) {
      injectCss(); calibrate();
      const S = { board: null, mode: 'local', side: 'top', tool: 'meter', mmode: 'cont', power: false, probes: { A: null, B: null }, next: 'A', lens: { x: 0, y: 0, on: false, Z: 6 }, wire: null, v: { s: 10, ox: 10, oy: 10 }, W: 600, H: 400, log: lsGet('pcb.repair.log', []), panel: null, ptab: 'sch', hintN: 0, op: null, hl: null, sel: null, smoke: [], hot: null, power0: 0, solvedFx: false, dirty: true, meter: null, ghost: false, caseNo: 0, lensCap: '' };
      el.innerHTML = '';
      const root0 = document.createElement('div'); root0.className = 'pr-root'; el.appendChild(root0);
      root0.innerHTML = `<div class="pr-bar" id="prBar"></div><div class="pr-hint" id="prHint"></div>
        <div class="pr-main"><div class="pr-stage" id="prStage"><canvas id="prCv"></canvas><div class="pr-banner" id="prBan" style="display:none"></div>
          <div class="pr-zoom"><button class="pr-btn" data-a="zin" aria-label="Vergrößern">+</button><button class="pr-btn" data-a="zout" aria-label="Verkleinern">−</button><button class="pr-btn" data-a="fit" aria-label="Ganze Platine">⤢</button><button class="pr-btn" data-a="lz" id="prLz" style="font-size:14px;display:none" aria-label="Lupen-Vergrößerung">6×</button></div>
          <div class="pr-meter" id="prMeter"></div></div>
          <div class="pr-side" id="prSide"><div class="pr-tabs"><button class="pr-btn" data-pt="sch">📐 Schaltplan</button><button class="pr-btn" data-pt="log">📋 Protokoll</button><button class="pr-btn" data-a="closep" aria-label="Schließen">✕</button></div><div class="pr-body" id="prBody"></div></div></div>`;
      const $ = s => root0.querySelector(s), cv = $('#prCv'), c = cv.getContext('2d'), bar = $('#prBar'), hint = $('#prHint'), stage = $('#prStage'), meterEl = $('#prMeter'), ban = $('#prBan'), side = $('#prSide'), body = $('#prBody');
      let raf = 0, alive = true, beepTimer = 0, lastBeep = false, lastSmoke = 0, shown = false, fitDone = false, dpr = 1;
      const toast = m => { if (ctx.toast) ctx.toast(m); };
      const fx = (k, x, y, t) => { try { if (ctx.fx) ctx.fx(k, x, y, t); } catch (e) {} };
      const clientXY = (wx, wy) => { const r = cv.getBoundingClientRect(), p = w2s(wx, wy); return [r.left + p.x, r.top + p.y]; };

      /* ---- Koordinaten */
      const mir = () => S.side === 'bot';
      function w2s(wx, wy) { const v = S.v, b = S.board; return { x: v.ox + (mir() ? (b.w - wx) : wx) * v.s, y: v.oy + wy * v.s }; }
      function s2w(px, py) { const v = S.v, b = S.board, x = (px - v.ox) / v.s; return { x: mir() ? b.w - x : x, y: (py - v.oy) / v.s }; }
      function setTransform(g, v, m, W) { if (!m) g.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.ox, dpr * v.oy); else g.setTransform(-dpr * v.s, 0, 0, dpr * v.s, dpr * (v.ox + W * v.s), dpr * v.oy); }
      function fit() { const b = S.board; if (!b) return; const pad = 14, res = (S.tool === 'meter' && S.W < 800) ? (meterEl.offsetHeight || 130) + 6 : 0, H2 = S.H - res; const s = Math.max(2, Math.min((S.W - 2 * pad) / b.w, (H2 - 2 * pad) / b.h)); S.v = { s, ox: (S.W - b.w * s) / 2, oy: (H2 - b.h * s) / 2 }; S.fitS = s; S.auto = true; dirty(); }
      function zoomAt(px, py, f) { const w = s2w(px, py), v = S.v, ns = Math.max((S.fitS || 5) * 0.6, Math.min(140, v.s * f)); S.auto = false; v.s = ns; v.ox = mir() ? px - (S.board.w - w.x) * ns : px - w.x * ns; v.oy = py - w.y * ns; dirty(); }
      function resize() { const r = stage.getBoundingClientRect(); const W = Math.max(100, Math.round(r.width)), H = Math.max(100, Math.round(r.height)); dpr = Math.min(2.5, root.devicePixelRatio || 1); if (W === S.W && H === S.H && cv.width === Math.round(W * dpr)) return; const first = !fitDone; S.W = W; S.H = H; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); root0.classList.toggle('narrow', root0.getBoundingClientRect().width < 720); if (S.board && (first || !S.fitS || S.auto)) { fit(); fitDone = true; } dirty(); }

      /* ---- Platine verwalten */
      function adopt() {
        const cb = ctx.getBoard && ctx.getBoard();
        if (cb && cb.repair && cb.repair.soll && (cb.repair.faults || []).length) { if (S.board !== cb) { S.board = cb; S.mode = 'ctx'; boardChanged(); } return; }
        if (S.mode === 'ctx') { S.mode = 'local'; S.board = null; }
        if (!S.board) { const sv = lsGet('pcb.repair.case', null); if (sv && sv.repair && sv.parts) { S.board = sv; boardChanged(); } else newCase({ auto: true }); }
      }
      function boardChanged() { ban.style.display = 'none'; S._cb = null; S.op = null; S.smoke = []; S.hot = null; if (!S.board) return; S.wire = null; S.hl = null; if (S.W) { if (!S.fitS || S.fitKey !== S.board.id) { fit(); S.fitKey = S.board.id; } } updateAll(); }
      function commit(nb, logTxt, cls) {
        if (S.mode === 'ctx' && ctx.setBoard) { ctx.setBoard(nb); const g = ctx.getBoard(); S.board = (g && g.repair) ? g : nb; if (g && !g.repair) S.board = nb; }
        else { S.board = nb; lsSet('pcb.repair.case', nb); }
        S._cb = null; S.op = null; if (logTxt) addLog(logTxt, cls);
        if (S.power) S.op = operate(S.board, { t: now() }); measureNow(false); updateAll();
        const v = PCB_REPAIR.verify(S.board);
        if (v.ok && !S.solvedFx) { S.solvedFx = true; fx('tada', 0, 0, 'Fehler gefunden und behoben!'); addLog('Prüfung: Die Baugruppe funktioniert wieder. Fehler gefunden und behoben!', 'ok'); showBanner('✔ Fehler gefunden und behoben! Die Baugruppe funktioniert wieder.' + (v.notes.length ? ' (' + v.notes[0] + ')' : ''), 6000); }
        else if (!v.ok) S.solvedFx = false;
      }
      const now = () => performance.now() / 1000;
      function addLog(t, cls) { const d = new Date(); S.log.push({ t: d.toTimeString().slice(0, 8), x: t, c: cls || '' }); if (S.log.length > 200) S.log.shift(); lsSet('pcb.repair.log', S.log); if (S.panel && S.ptab === 'log') renderPanel(); }
      let banT = 0; function showBanner(t, ms) { ban.textContent = t; ban.style.display = 'block'; clearTimeout(banT); banT = setTimeout(() => { ban.style.display = 'none'; }, ms || 3500); }

      /* ---- Fehlerfall erzeugen */
      async function newCase(o) {
        o = o || {}; const samples = PCB_REPAIR.samples.all(); let base = null, kind = null;
        const examples = (root.PCB_DATA && root.PCB_DATA.examples) || [];
        if (!o.auto) {
          const opts = samples.map((b, i) => ({ value: 's' + i, label: b.name, sub: 'Mitgelieferte Übungsplatine', group: 'Übungsplatinen' }));
          examples.slice(0, 40).forEach((e, i) => opts.push({ value: 'e' + i, label: e.name, sub: e.desc || '', group: 'Beispiele aus dem Lab' }));
          const cur = ctx.getBoard && ctx.getBoard(); if (cur && cur.parts && cur.parts.length && !(cur.repair && cur.repair.faults && cur.repair.faults.length)) opts.unshift({ value: 'cur', label: 'Aktuelle Platine: ' + cur.name, sub: 'Die Platine aus dem Layout-Editor (bleibt dort unverändert)', group: 'Meine Platine' });
          const pk = await ctx.pick('Auf welcher Platine soll ein Fehler stecken?', opts); if (!pk) return;
          base = pk === 'cur' ? ctx.getBoard() : pk[0] === 's' ? samples[+pk.slice(1)] : examples[+pk.slice(1)].board();
          const fl = [{ value: 'rand', label: '🎲 Zufälliger Fehler', sub: 'Du weißt nicht, was kaputt ist', group: 'Überraschung' }].concat(PCB_REPAIR.faults.map(f => ({ value: f.id, label: f.name, sub: f.desc, group: f.group })));
          kind = await ctx.pick('Welcher Fehler soll eingebaut werden?', fl); if (!kind) return;
        } else { base = samples[0]; kind = 'rand'; }
        const seed = (Date.now() % 100000) + (S.caseNo++);
        const rnd = rngOf(seed); const ids = PCB_REPAIR.faults.map(f => f.id); let r = null;
        const order = kind === 'rand' ? shuffle(ids, rnd) : [kind];
        for (const id of order) { r = PCB_REPAIR.inject(base, { kind: id, seed: seed }); if (r.info) break; }
        if (!r || !r.info) { toast((r && r.error) || 'Auf dieser Platine ging das nicht. Nimm eine andere.'); return; }
        S.board = r.board; S.mode = 'local'; S.log = []; lsSet('pcb.repair.log', S.log); lsSet('pcb.repair.case', r.board);
        S.probes = { A: null, B: null }; S.next = 'A'; S.power = false; S.hintN = 0; S.solvedFx = false; S.side = 'top'; S.lens.on = false; S.fitS = 0; boardChanged(); fit();
        addLog('Neuer Fehlerfall auf "' + base.name + '". Finde den Fehler!', ''); showBanner('Neuer Fehlerfall: Die Baugruppe geht nicht. Finde den Fehler und repariere sie.', 4500);
      }

      /* ---- Werkzeugleiste */
      const TOOLS = [['sel', '👆', 'Zeiger'], ['meter', '📟', 'Messen'], ['lupe', '🔍', 'Lupe'], ['iron', '🔥', 'Lötkolben'], ['wick', '🧵', 'Entlötlitze'], ['pin', '🥢', 'Pinzette'], ['wire', '➰', 'Draht']];
      const HINTS = {
        sel: 'Tippe ein Bauteil an: Du siehst Wert und Aufdruck. Ziehen verschiebt die Ansicht, zwei Finger zoomen.',
        meter: 'Tippe zwei Messpunkte (Pad, Bahn oder Via) oder ziehe die Spitzen. Rot = A, schwarz = B. Wähle unten die Messart.',
        lupe: 'Ziehe die Lupe über Lötstellen, Bahnen und Vias. Manche Fehler siehst du nur im Zoom.',
        iron: 'Tippe eine Lötstelle, ein Bauteil, einen Riss oder ein Via an: nachlöten, ausbauen, drehen oder ersetzen.',
        wick: 'Entlötlitze: Tippe auf überschüssiges Lot (Lötbrücke), um es abzusaugen.',
        pin: 'Pinzette und Messer: Tippe auf eine Zinnperle oder einen Kupferrest (oder einen Draht), um ihn zu entfernen.',
        wire: 'Fädeldraht: Tippe erst den Anfang, dann das Ende der Überbrückung (Pad, Bahn oder Via). Das ist eine Notlösung.'
      };
      function buildBar() {
        bar.innerHTML = `<button class="pr-btn" data-a="case">🛠 Fehlerfall</button><span class="pr-sep"></span>` +
          TOOLS.map(t => `<button class="pr-btn${S.tool === t[0] ? ' on' : ''}" data-tool="${t[0]}" aria-pressed="${S.tool === t[0]}" title="${t[2]}"><span>${t[1]}</span> ${t[2]}</button>`).join('') + `<span class="pr-sep"></span>` +
          `<button class="pr-btn" data-a="side">${S.side === 'top' ? '⟳ Rückseite' : '⟳ Vorderseite'}</button>` +
          `<button class="pr-btn${S.power ? ' on' : ''}" data-a="power" aria-pressed="${S.power}">⚡ Betrieb ${S.power ? 'an' : 'aus'}</button><span class="pr-sep"></span>` +
          `<button class="pr-btn${S.panel && S.ptab === 'sch' ? ' on' : ''}" data-a="sch">📐 Schaltplan</button><button class="pr-btn${S.panel && S.ptab === 'log' ? ' on' : ''}" data-a="log">📋 Protokoll</button>` +
          `<button class="pr-btn" data-a="tip">💡 Tipp</button><button class="pr-btn go" data-a="check">✔ Prüfen</button>`;
        hint.innerHTML = '<span>' + esc(HINTS[S.tool]) + '</span>'; const lz = $('#prLz'); if (lz) { lz.style.display = S.tool === 'lupe' ? 'block' : 'none'; lz.textContent = S.lens.Z + '×'; }
      }
      function buildMeter() {
        const m = S.mmode, o = S.meter, show = S.tool === 'meter';
        meterEl.style.display = show ? 'block' : 'none'; if (!show) return;
        const MODES = [['cont', '🔔 Durchgang'], ['res', 'Ω Widerstand'], ['volt', 'V Spannung'], ['diode', '▶| Diode']];
        meterEl.innerHTML = `<div class="pr-lcd"><div class="m">${MODES.find(x => x[0] === m)[1].replace(/^\S+\s/, '')}${S.power ? ' · BETRIEB' : ''}</div><div class="v" id="prV">${o ? esc(o.text) : '- - - -'}</div><div class="n" id="prN">${o ? esc(o.note || '') : 'Setze beide Messspitzen auf die Platine.'}</div></div>
          <div class="pr-modes">${MODES.map(x => `<button data-mm="${x[0]}" class="${m === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>
          <div class="pr-probes"><span class="pr-pa" id="prPA">A: ${S.probes.A ? esc(S.probes.A.label || '') : '–'}</span><span class="pr-pb" id="prPB">B: ${S.probes.B ? esc(S.probes.B.label || '') : '–'}</span></div>`;
      }
      function updateLcd() { const v = meterEl.querySelector('#prV'), n = meterEl.querySelector('#prN'), a = meterEl.querySelector('#prPA'), b = meterEl.querySelector('#prPB'), o = S.meter; if (!v) return; v.textContent = o ? o.text : '- - - -'; n.textContent = o ? (o.note || '') : 'Setze beide Messspitzen auf die Platine.'; a.textContent = 'A: ' + (S.probes.A ? S.probes.A.label || '' : '–'); b.textContent = 'B: ' + (S.probes.B ? S.probes.B.label || '' : '–'); }
      function updateAll() { buildBar(); buildMeter(); renderPanel(); dirty(); }

      /* ---- Messen */
      function probeSpec(p) { return p ? { x: p.x, y: p.y, side: p.side, tol: p.tol } : null; }
      function netOfProbe(p) {
        const g = PCB_REPAIR.graph(S.board); const layer = g.layerOf(p.side); const i = g.nodeAt(p.x, p.y, layer, p.tol); if (i < 0) return null; const nd = g.nodes[i];
        return nd.kind === 'pad' ? nd.pad.net : nd.kind === 'trk' ? nd.track.net : nd.kind === 'via' ? nd.via.net : nd.kind === 'zone' ? nd.zone.net : null;
      }
      function measureNow(final) {
        if (!S.board) return;
        const A = S.probes.A, B = S.probes.B; if (!A || !B) { S.meter = null; stopBeep(); updateLcd(); return; }
        const o = measure(S.board, probeSpec(A), probeSpec(B), S.mmode, { power: S.power, t: now(), op: S.power ? S.op : null }); S.meter = o; A.label = o.a; B.label = o.b;
        const mm = S.mmode;
        if (mm === 'cont') {
          if (o.beep) { startBeep(); if (!lastBeep) { const [x, y] = clientXY(B.x, B.y); fx('ding', x, y); } if (final) { const na = netOfProbe(A), nb = netOfProbe(B); if (na && nb && na !== nb) { const [x, y] = clientXY(B.x, B.y); fx('zap', x, y, 'Zwei Netze, eine Idee: Kurzschluss!'); showBanner('Kurzschluss gefunden: ' + na + ' und ' + nb + ' haben Durchgang!', 4000); addLog('Kurzschluss zwischen ' + na + ' und ' + nb + ' gefunden (Durchgang an ' + o.a + ' / ' + o.b + ').', 'bad'); } } }
          else stopBeep();
          lastBeep = !!o.beep;
        } else { stopBeep(); lastBeep = false; }
        updateLcd();
        if (final && !(mm === 'cont' && o.beep && netOfProbe(A) !== netOfProbe(B) && netOfProbe(A) && netOfProbe(B))) addLog(({ cont: 'Durchgang', res: 'Widerstand', volt: 'Spannung', diode: 'Diodentest' })[mm] + ' ' + o.a + ' ↔ ' + o.b + ': ' + o.text + (o.note ? ' (' + o.note.split('. ')[0].replace(/\.$/, '') + ')' : ''), mm === 'cont' ? (o.beep ? 'ok' : 'bad') : '');
        dirty();
      }
      function startBeep() { const F = root.LochFX; if (F && F.tone) { try { F.tone(2300); } catch (e) {} } else ownTone(true); clearTimeout(beepTimer); beepTimer = setTimeout(stopBeep, 1800); }
      let ownOsc = null, ownAC = null;
      function ownTone(on) {
        try { if (on) { if (ownOsc) return; const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return; ownAC = ownAC || new AC(); ownOsc = ownAC.createOscillator(); const g = ownAC.createGain(); g.gain.value = 0.04; ownOsc.type = 'square'; ownOsc.frequency.value = 2300; ownOsc.connect(g); g.connect(ownAC.destination); ownOsc.start(); } else if (ownOsc) { ownOsc.stop(); ownOsc = null; } } catch (e) {}
      }
      function stopBeep() { clearTimeout(beepTimer); const F = root.LochFX; if (F && F.toneOff) { try { F.toneOff(); } catch (e) {} } ownTone(false); }

      /* ---- Treffer */
      function tolMM(px) { return px / S.v.s; }
      function snapAt(wx, wy, tol) {
        const b = S.board, sc = sceneCache(S), layer = mir() ? 'B.Cu' : 'F.Cu', pt = { x: wx, y: wy }; let best = null;
        const take = (d, o) => { if (d <= tol && (!best || d < best.d - 1e-9)) { best = Object.assign({ d }, o); } };
        sc.pads.forEach(pd => { if (pd.layers.indexOf(layer) < 0) return; let d = 1e9; pd.caps.forEach(q => { d = Math.min(d, ptSeg(pt, q.a, q.b).d - q.r); }); take(d, { x: pd.x, y: pd.y, kind: 'pad', label: 'Pad ' + pd.ref + ' Pin ' + pd.n }); });
        if (best) return best;
        (b.vias || []).forEach(v => take(Math.hypot(wx - v.x, wy - v.y) - (v.dia || 0.8) / 2, { x: v.x, y: v.y, kind: 'via', label: 'Via' }));
        if (best) return best;
        (b.tracks || []).forEach(t => { if (t.layer !== layer) return; for (let i = 0; i < t.pts.length - 1; i++) { const r = ptSeg(pt, { x: t.pts[i][0], y: t.pts[i][1] }, { x: t.pts[i + 1][0], y: t.pts[i + 1][1] }); take(r.d - (t.w || 0.25) / 2, { x: r.x, y: r.y, kind: 'trk', label: 'Leiterbahn' }); } });
        return best;
      }
      function partAt(wx, wy, tol) {
        const b = S.board, sc = sceneCache(S); let best = null;
        const test = (p, missing) => {
          if ((p.side === 'bot') === !mir() && !(fpOf(p.fp).kind === 'tht')) return; const fp = fpOf(p.fp); const pads = sc.pads.filter(q => q.ref === p.ref);
          let x0, y0, x1, y1;
          if (pads.length) { x0 = 1e9; y0 = 1e9; x1 = -1e9; y1 = -1e9; pads.forEach(q => { x0 = Math.min(x0, q.x - q.w / 2); x1 = Math.max(x1, q.x + q.w / 2); y0 = Math.min(y0, q.y - q.h / 2); y1 = Math.max(y1, q.y + q.h / 2); }); }
          else { const th = (p.rot || 0) * PI / 180, bb = bodyBox(fp), cs = Math.cos(th), sn = Math.sin(th); const xs = [bb.x0, bb.x1], ys = [bb.y0, bb.y1]; x0 = 1e9; y0 = 1e9; x1 = -1e9; y1 = -1e9; xs.forEach(a => ys.forEach(bq => { const X = p.x + (p.side === 'bot' ? -a : a) * cs - bq * sn, Y = p.y + (p.side === 'bot' ? -a : a) * sn + bq * cs; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); })); }
          const m = 0.7 + tol; if (wx >= x0 - m && wx <= x1 + m && wy >= y0 - m && wy <= y1 + m) { const area = (x1 - x0) * (y1 - y0); if (!best || area < best.area) best = { part: p, area, missing: !!missing, x: (x0 + x1) / 2, y: (y0 + y1) / 2 }; }
        };
        (b.parts || []).forEach(p => test(p, false));
        Object.keys(sc.sol).forEach(ref => { if (!sc.part[ref]) test(sc.sol[ref], true); });
        return best;
      }
      function blobAt(wx, wy, tol) { const layer = mir() ? 'B.Cu' : 'F.Cu'; let best = null; (S.board.blobs || []).forEach(bl => { if (bl.layer !== layer) return; const d = Math.hypot(bl.x - wx, bl.y - wy) - Math.max(bl.r, (bl.len || 1) / 2); if (d <= tol + 0.4 && (!best || d < best.d)) best = { bl, d }; }); return best && best.bl; }
      function cutAt(wx, wy, tol) { const layer = mir() ? 'B.Cu' : 'F.Cu'; return (S.board.cuts || []).find(k => k.layer === layer && Math.hypot(k.x - wx, k.y - wy) <= 0.9 + tol); }
      function wireAt(wx, wy, tol) { return (S.board.wires || []).find(w => ptSeg({ x: wx, y: wy }, w.a, w.b).d <= 0.7 + tol); }

      /* ---- Werkzeuge: Tippen */
      async function doFix(act, x, y, okTxt) {
        const r = fix(S.board, act); const [cx, cy] = clientXY(x == null ? S.board.w / 2 : x, y == null ? S.board.h / 2 : y);
        if (!r.ok) { toast(r.msg); fx('click'); return false; }
        fx(r.fx, cx, cy, r.fx === 'fizz' ? '' : ''); toast(r.msg); commit(r.board, r.msg, 'ok'); return true;
      }
      async function tapTool(wx, wy, px, py) {
        const tol = tolMM(14);
        if (S.tool === 'lupe') { S.lens.x = px; S.lens.y = py; S.lens.on = true; inspect(true); dirty(); return; }
        if (S.tool === 'meter') { placeProbe(wx, wy); return; }
        if (S.tool === 'sel') {
          const h = partAt(wx, wy, tol); if (!h) { S.sel = null; renderPanel(); toast('Hier ist kein Bauteil.'); return; }
          const p = h.part; S.sel = p.ref; const sol = sceneCache(S).sol[p.ref]; const cl = classify(p);
          const unit = cl.k === 'res' ? ' Ω' : '';
          const t = h.missing ? p.ref + ' fehlt! Laut Schaltplan gehört hier ' + p.value + unit + ' hin.' : p.ref + ': ' + p.value + unit + ' (' + p.fp + ')' + (p.defect ? ', sieht angebrannt aus' : '');
          toast(t); addLog('Sichtprüfung ' + t, ''); renderPanel(); return;
        }
        if (S.tool === 'wire') {
          const sn = snapAt(wx, wy, Math.max(0.4, tolMM(16)));
          if (!sn) { toast('Der Draht muss an Kupfer (Pad, Bahn oder Via) angelötet werden.'); return; }
          if (!S.wire) { S.wire = { a: { x: sn.x, y: sn.y, side: S.side } }; toast('Anfang gesetzt (' + sn.label + '). Jetzt das Ende antippen.'); dirty(); return; }
          const b = { x: sn.x, y: sn.y, side: S.side }, a = S.wire.a; S.wire = null;
          const r = fix(S.board, { t: 'wire', a, b }); if (!r.ok) { toast(r.msg); dirty(); return; }
          fx('fizz', ...clientXY(sn.x, sn.y)); toast('Fädeldraht gelötet. Reparatur-Notlösung: In einer Serienplatine würdest du die Bahn sauber reparieren.'); commit(r.board, 'Fädeldraht von (' + a.x.toFixed(1) + '|' + a.y.toFixed(1) + ') nach (' + b.x.toFixed(1) + '|' + b.y.toFixed(1) + ') gelötet (Notlösung).', 'warn'); return;
        }
        if (S.tool === 'wick') { const bl = blobAt(wx, wy, tol); if (!bl) { const w = wireAt(wx, wy, tol); toast(w ? 'Das ist ein Draht, kein Lot. Nimm Pinzette oder Messer.' : 'Hier ist kein überschüssiges Lot. (Tipp: Mit der Lupe findest du es.)'); fx('click'); return; } await doFix({ t: 'wick', id: bl.id }, bl.x, bl.y); return; }
        if (S.tool === 'pin') {
          const w = wireAt(wx, wy, tol), bl = blobAt(wx, wy, tol);
          if (bl) { await doFix({ t: bl.kind === 'copper' ? 'knife' : 'tweezer', id: bl.id }, bl.x, bl.y); return; }
          if (w) { await doFix({ t: 'unwire', id: w.id }, wx, wy); return; }
          toast('Hier ist nichts zu entfernen.'); fx('click'); return;
        }
        if (S.tool === 'iron') {
          const ct = cutAt(wx, wy, tol); if (ct) { await doFix({ t: 'solderCut', id: ct.id }, ct.x, ct.y); return; }
          const vi = (S.board.vias || []).find(v => v.broken && Math.hypot(v.x - wx, v.y - wy) <= 0.7 + tol); if (vi) { await doFix({ t: 'viaFix', id: vi.id }, vi.x, vi.y); return; }
          const sn = snapAt(wx, wy, tol); const sc = sceneCache(S);
          if (sn && sn.kind === 'pad') { const m = /Pad (\S+) Pin (\S+)/.exec(sn.label), p = sc.part[m[1]]; if (p && (p.cold || []).indexOf(m[2]) >= 0) { await doFix({ t: 'reflow', ref: p.ref, n: m[2] }, sn.x, sn.y); return; } }
          const h = partAt(wx, wy, tol);
          if (h) return partMenu(h);
          const w = wireAt(wx, wy, tol); if (w) { await doFix({ t: 'unwire', id: w.id }, wx, wy); return; }
          toast('Hier gibt es nichts zu löten. Tippe auf eine Lötstelle oder ein Bauteil.'); fx('click');
        }
      }
      async function partMenu(h) {
        const p = h.part, sol = sceneCache(S).sol[p.ref] || p, cl = classify(p);
        if (h.missing) { const opts = valueOptions(p, cl, sol.value); const v = await ctx.pick('Bauteil ' + p.ref + ' einbauen: welchen Wert?', opts.length > 1 ? opts : opts); if (v == null) return; await doFix({ t: 'insert', ref: p.ref, value: v }, h.x, h.y); return; }
        const opts = [{ value: 'resolder', label: 'Alle Lötstellen nachlöten', sub: 'Frisches Lot, nichts geht kaputt' }, { value: 'rot', label: 'Auslöten, um 180° drehen und wieder einlöten' }, { value: 'swap', label: 'Durch ein neues Bauteil ersetzen …', sub: 'Du wählst den Wert' }, { value: 'out', label: 'Nur auslöten (Platz bleibt leer)' }];
        const a = await ctx.pick(p.ref + ' (' + p.value + ')', opts); if (!a) return;
        if (a === 'resolder') { const cold = (p.cold || []).slice(); if (!cold.length) { toast('Alle Lötstellen von ' + p.ref + ' glänzen schon. Nachlöten bringt nichts.'); return; } let nb = S.board; for (const n of cold) { const r = fix(nb, { t: 'reflow', ref: p.ref, n }); if (r.ok) nb = r.board; } fx('fizz', ...clientXY(h.x, h.y)); toast('Nachgelötet: ' + p.ref); commit(nb, 'Lötstellen von ' + p.ref + ' nachgelötet.', 'ok'); return; }
        if (a === 'rot') { await doFix({ t: 'rotate', ref: p.ref, deg: 180 }, h.x, h.y); return; }
        if (a === 'out') { await doFix({ t: 'remove', ref: p.ref }, h.x, h.y); return; }
        if (a === 'swap') { const v = await ctx.pick(p.ref + ': neuer Wert', valueOptions(p, cl, sol.value)); if (v == null) return; await doFix({ t: 'replace', ref: p.ref, value: v, rot: sol.rot }, h.x, h.y); }
      }

      /* ---- Messspitzen */
      function placeProbe(wx, wy) {
        const sn = snapAt(wx, wy, Math.max(0.3, tolMM(16))), which = S.next; S.next = which === 'A' ? 'B' : 'A';
        const pr = sn ? { x: sn.x, y: sn.y, side: S.side, tol: 0.4, label: sn.label } : { x: wx, y: wy, side: S.side, tol: 0.05, label: 'Leerstelle' };
        S.probes[which] = pr; measureNow(true); dirty();
      }
      function probeScreen(p) { if (!p) return null; const prev = S.side; const m = (p.side === 'bot'); const v = S.v, b = S.board; if (m !== mir()) return { x: v.ox + (m ? b.w - p.x : p.x) * v.s * 0 + (mir() ? (b.w - p.x) : p.x) * v.s, y: v.oy + p.y * v.s, ghost: true }; return { x: w2s(p.x, p.y).x, y: w2s(p.x, p.y).y, ghost: false }; }
      function probeHit(px, py) {
        let best = null; ['A', 'B'].forEach(k => { const p = S.probes[k]; if (!p || p.side !== S.side) return; const sp = w2s(p.x, p.y); const d = distSeg(px, py, sp.x, sp.y, sp.x + 34, sp.y - 64); if (d < 30 && (!best || d < best.d)) best = { k, d, dx: sp.x - px, dy: sp.y - py }; });
        return best;
      }
      function distSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); }
      function drawProbes(g) {
        ['A', 'B'].forEach(k => {
          const p = S.probes[k]; if (!p) return; const m = p.side === 'bot', same = m === mir(); const sp = same ? w2s(p.x, p.y) : null; if (!sp) return;
          const col = k === 'A' ? '#e0372d' : '#1a1a1a';
          g.save(); g.translate(sp.x, sp.y);
          g.beginPath(); g.moveTo(0, 0); g.lineTo(5, -14); g.lineTo(34, -64); g.lineTo(26, -68); g.lineTo(-4, -14); g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 1.5; g.strokeStyle = k === 'A' ? '#ff9a92' : '#777'; g.stroke();
          g.beginPath(); g.moveTo(30, -66); g.quadraticCurveTo(80, -110, 140, -70); g.lineWidth = 3; g.strokeStyle = col; g.stroke();
          g.beginPath(); g.arc(0, 0, 6, 0, 2 * PI); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); g.beginPath(); g.arc(0, 0, 2, 0, 2 * PI); g.fillStyle = '#ffd24a'; g.fill();
          g.font = '700 12px system-ui'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(k, 20, -36);
          g.restore();
        });
      }

      /* ---- Lupe */
      const lensR = () => Math.max(70, Math.min(120, Math.min(S.W, S.H) * 0.23));
      function drawLens(g) {
        if (S.tool !== 'lupe' || !S.lens.on) return; const R = lensR(), lx = S.lens.x, ly = S.lens.y, Z = S.lens.Z, w = s2w(lx, ly);
        g.save(); g.beginPath(); g.arc(lx, ly, R, 0, 2 * PI); g.clip(); g.fillStyle = '#0b0d0f'; g.fillRect(lx - R, ly - R, 2 * R, 2 * R);
        const s2 = S.v.s * Z, v2 = { s: s2, ox: mir() ? lx - (S.board.w - w.x) * s2 : lx - w.x * s2, oy: ly - w.y * s2 };
        setTransform(g, v2, mir(), S.board.w); const half = R / s2 * 1.05;
        renderScene(g, S, { detail: 2, scale: s2, cull: { x0: w.x - half, x1: w.x + half, y0: w.y - half, y1: w.y + half } });
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.restore();
        g.save(); g.beginPath(); g.arc(lx, ly, R, 0, 2 * PI); g.lineWidth = 9; g.strokeStyle = '#2a3038'; g.stroke(); g.lineWidth = 3; g.strokeStyle = '#8f9aa6'; g.stroke();
        g.beginPath(); g.moveTo(lx + R * 0.7, ly + R * 0.7); g.lineTo(lx + R * 0.7 + 38, ly + R * 0.7 + 38); g.lineWidth = 14; g.lineCap = 'round'; g.strokeStyle = '#2a3038'; g.stroke(); g.lineWidth = 8; g.strokeStyle = '#5a4630'; g.stroke();
        g.beginPath(); g.arc(lx - R * 0.45, ly - R * 0.5, R * 0.12, 0, 2 * PI); g.fillStyle = 'rgba(255,255,255,.12)'; g.fill();
        g.font = '700 12px system-ui'; g.fillStyle = '#ffd24a'; g.textAlign = 'center'; g.fillText(Z + '×', lx, ly - R + 18); g.restore();
        if (S.lensCap) { g.save(); g.font = '600 13px system-ui'; const t = S.lensCap, tw = Math.min(S.W - 20, g.measureText(t).width + 18); let x = Math.max(10, Math.min(S.W - tw - 10, lx - tw / 2)), y = ly + R + 12 > S.H - 40 ? ly - R - 40 : ly + R + 12; g.fillStyle = 'rgba(20,24,28,.92)'; g.fillRect(x, y, tw, 26); g.strokeStyle = '#3a4452'; g.strokeRect(x, y, tw, 26); g.fillStyle = '#e8edf2'; g.textAlign = 'left'; g.fillText(t.length > 90 ? t.slice(0, 88) + '…' : t, x + 9, y + 18, tw - 14); g.restore(); }
      }
      function inspect(final) {
        const w = s2w(S.lens.x, S.lens.y), b = S.board, sc = sceneCache(S), layer = mir() ? 'B.Cu' : 'F.Cu', tol = 1.3 / 1; let t = '';
        const ct = (b.cuts || []).find(k => k.layer === layer && Math.hypot(k.x - w.x, k.y - w.y) < 1.0);
        const vi = (b.vias || []).find(v => v.broken && Math.hypot(v.x - w.x, v.y - w.y) < 1.2);
        const bl = (b.blobs || []).find(k => k.layer === layer && Math.hypot(k.x - w.x, k.y - w.y) < Math.max(k.r, (k.len || 1) / 2) + 0.6);
        let pad = null, bd = 1e9; sc.pads.forEach(pd => { if (pd.layers.indexOf(layer) < 0) return; const d = Math.hypot(pd.x - w.x, pd.y - w.y); if (d < bd) { bd = d; pad = pd; } });
        if (ct) t = 'Haarriss quer über der Leiterbahn: Die Bahn ist hier unterbrochen!';
        else if (vi) t = 'Die Kupferhülse des Vias hat einen Riss: keine Verbindung zwischen den Seiten.';
        else if (bl) t = bl.kind === 'bridge' ? 'Zu viel Lot: eine Lötbrücke verbindet zwei Pads.' : bl.kind === 'ball' ? 'Eine Zinnperle liegt zwischen den Kupferflächen.' : 'Ein Kupferrest verbindet zwei Bahnen.';
        else if (pad && bd < Math.max(pad.w, pad.h) / 2 + 0.5) { const p = sc.part[pad.ref]; if (p && pad.drill && (p.side === 'bot') === mir()) t = 'Hier verdeckt das Bauteil die Lötstelle. Die Lötstelle von ' + pad.ref + ' Pin ' + pad.n + ' sieht man von der Lötseite (Rückseite).'; else if (p && (p.cold || []).indexOf(pad.n) >= 0) t = 'Lötstelle ' + pad.ref + ' Pin ' + pad.n + ': matt, körnig, Riss am Rand. Das ist eine kalte Lötstelle.'; else if (p) t = 'Lötstelle ' + pad.ref + ' Pin ' + pad.n + ': glänzend, sauberer Meniskus. In Ordnung.'; }
        const part = partAt(w.x, w.y, 0); if (!t && part && !part.missing) { const p = part.part; t = p.ref + ': Aufdruck ' + p.value + (p.defect === 'open' ? ', Körper angekohlt' : '') + '.'; } else if (!t && part && part.missing) t = 'Leerer Bestückungsplatz ' + part.part.ref + '.';
        S.lensCap = t;
        if (final && t) { const key = t; if (S._lastInsp !== key) { S._lastInsp = key; addLog('Lupe: ' + t, /Riss|Brücke|Zinnperle|Kupferrest|kalte/.test(t) ? 'bad' : ''); } }
      }

      /* ---- Zeichnen */
      function dirty() { S.dirty = true; if (!raf && alive) raf = requestAnimationFrame(frame); }
      function frame() {
        raf = 0; if (!alive || !S.board) return;
        const t = now();
        if (S.power) {
          S.op = operate(S.board, { t }); S.hot = {}; S.op.hot.forEach(h => { S.hot[h.ref] = true; });
          if (S.op.hot.length && t - lastSmoke > 0.12) { lastSmoke = t; const pm = sceneCache(S).part; S.op.hot.forEach(h => { const p = pm[h.ref]; if (p) S.smoke.push({ x: p.x, y: p.y, age: 0, ph: Math.random() * 6 }); }); }
        }
        S.smoke.forEach(q => { q.age += 0.04; }); S.smoke = S.smoke.filter(q => q.age < 1.3);
        if (S.power && S.mmode === 'volt' && S.probes.A && S.probes.B && (t - (S._lm || 0)) > 0.12) { S._lm = t; const o = measure(S.board, probeSpec(S.probes.A), probeSpec(S.probes.B), 'volt', { power: true, t, op: S.op }); S.meter = o; updateLcd(); }
        paint();
        if (S.power || S.smoke.length) { raf = requestAnimationFrame(frame); }
      }
      function paint() {
        const g = c; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#0e1114'; g.fillRect(0, 0, S.W, S.H);
        if (!S.board) return;
        setTransform(g, S.v, mir(), S.board.w); const a = s2w(0, 0), bz = s2w(S.W, S.H);
        renderScene(g, S, { detail: 0, scale: S.v.s, cull: { x0: Math.min(a.x, bz.x) - 2, x1: Math.max(a.x, bz.x) + 2, y0: a.y - 2, y1: bz.y + 2 } });
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.font = '700 12px system-ui'; g.fillStyle = 'rgba(255,255,255,.55)'; g.textAlign = 'left'; g.fillText(mir() ? 'RÜCKSEITE (von unten gesehen)' : 'VORDERSEITE (Bestückungsseite)', 10, S.H - 10 - (S.tool === 'meter' ? 0 : 0));
        drawProbes(g); drawLens(g);
      }

      /* ---- Zeigerereignisse */
      const ptr = new Map(); let gesture = null;
      cv.addEventListener('pointerdown', e => {
        try { cv.setPointerCapture(e.pointerId); } catch (er) {} const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        ptr.set(e.pointerId, { x, y, sx: x, sy: y, t: performance.now(), moved: false });
        if (ptr.size === 2) { const [p, q] = [...ptr.values()]; gesture = { d: Math.hypot(p.x - q.x, p.y - q.y), cx: (p.x + q.x) / 2, cy: (p.y + q.y) / 2, pinch: true }; ptr.forEach(v => { v.moved = true; }); return; }
        gesture = { grab: null, pan: false };
        if (S.tool === 'meter' || true) { const h = probeHit(x, y); if (h && S.tool === 'meter') gesture.grab = h; }
        if (S.tool === 'lupe' && S.lens.on && Math.hypot(x - S.lens.x, y - S.lens.y) < lensR() + 20) gesture.lens = true;
        if (S.tool === 'lupe' && !gesture.lens) { S.lens.x = x; S.lens.y = y; S.lens.on = true; gesture.lens = true; dirty(); }
      });
      cv.addEventListener('pointermove', e => {
        const p = ptr.get(e.pointerId); const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        if (!p) { if (S.tool === 'wire' && S.wire) { const w = s2w(x, y); const sn = snapAt(w.x, w.y, 0.6); S.wire.cur = sn ? { x: sn.x, y: sn.y } : w; dirty(); } return; }
        const dx = x - p.x, dy = y - p.y; p.x = x; p.y = y;
        if (ptr.size >= 2 && gesture && gesture.pinch) { const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2; S.auto = false; S.v.ox += cx - gesture.cx; S.v.oy += cy - gesture.cy; if (gesture.d > 0) zoomAt(cx, cy, d / gesture.d); gesture.d = d; gesture.cx = cx; gesture.cy = cy; dirty(); return; }
        if (!p.moved && Math.hypot(x - p.sx, y - p.sy) > 7) p.moved = true;
        if (!p.moved) return;
        if (gesture && gesture.grab) { const k = gesture.grab.k, w = s2w(x + gesture.grab.dx, y + gesture.grab.dy), sn = snapAt(w.x, w.y, Math.max(0.3, tolMM(14))); S.probes[k] = sn ? { x: sn.x, y: sn.y, side: S.side, tol: 0.4, label: sn.label } : { x: w.x, y: w.y, side: S.side, tol: 0.05, label: 'Leerstelle' }; gesture.moved = true; measureNow(false); dirty(); return; }
        if (gesture && gesture.lens) { S.lens.x = x; S.lens.y = y; inspect(false); dirty(); return; }
        S.auto = false; S.v.ox += dx * (1); S.v.oy += dy; dirty();
      });
      const up = e => {
        const p = ptr.get(e.pointerId); ptr.delete(e.pointerId); if (!p) return;
        if (gesture && gesture.pinch) { if (ptr.size < 2) gesture = null; return; }
        if (gesture && gesture.grab && p.moved) { measureNow(true); gesture = null; return; }
        if (gesture && gesture.lens && p.moved) { inspect(true); gesture = null; dirty(); return; }
        if (!p.moved && performance.now() - p.t < 700) { const w = s2w(p.x, p.y); tapTool(w.x, w.y, p.x, p.y); }
        gesture = null;
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { ptr.delete(e.pointerId); gesture = null; });
      cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.18 : 1 / 1.18); }, { passive: false });

      /* ---- Bedienung */
      function setTool(t) { const was = S.tool; S.tool = t; S.wire = null; if (S.auto && (t === 'meter') !== (was === 'meter')) { buildMeter(); fit(); } if (t !== 'meter') stopBeep(); if (t === 'lupe' && !S.lens.on) { S.lens.x = S.W / 2; S.lens.y = S.H / 2; S.lens.on = true; inspect(false); } updateAll(); }
      function togglePower() {
        if (!S.power) {
          const op = operate(S.board, { t: now() }); S.power = true; S.op = op; stopBeep();
          if (op.short) { fx('zap', 0, 0, 'Zwei Netze, eine Idee: Kurzschluss!'); toast('Kurzschluss! Das Netzteil schaltet sofort ab.'); addLog('Betrieb: Kurzschluss zwischen Plus und Masse, Netzteil schaltet ab.', 'bad'); S.power = false; S.op = null; updateAll(); measureNow(false); return; }
          if (op.hot.length) { fx('spark', 0, 0); toast(op.hot[0].msg); addLog('Betrieb: ' + op.hot[0].msg, 'bad'); }
          else { const on = op.leds.filter(l => l.on).length, tot = op.leds.length; const v = PCB_REPAIR.verify(S.board); addLog('Betrieb eingeschaltet' + (tot ? ': ' + on + ' von ' + tot + ' LED leuchten' : '') + ' (' + dec(op.mA, 1) + ' mA).', on === tot ? 'ok' : 'bad'); toast(tot && !on ? 'Die LED bleibt dunkel. Irgendwas stimmt nicht.' : 'Die Baugruppe ist in Betrieb.'); }
        } else { S.power = false; S.op = null; S.hot = null; S.smoke = []; addLog('Betrieb ausgeschaltet.', ''); }
        updateAll(); measureNow(false);
      }
      function check() {
        const v = PCB_REPAIR.verify(S.board);
        if (v.ok) { fx('tada', 0, 0, 'Fehler gefunden und behoben!'); showBanner('✔ Funktioniert wieder! Fehler gefunden und behoben.' + (v.notes.length ? ' ' + v.notes[0] : ''), 6000); addLog('Prüfung bestanden: Die Baugruppe funktioniert wieder.', 'ok'); }
        else { const g = {}; v.remaining.forEach(r => { g[r.type] = (g[r.type] || 0) + 1; }); const names = { open: 'eine Unterbrechung', short: 'ein Kurzschluss', value: 'ein falscher Wert', rot: 'ein falsch herum eingebautes Bauteil', defect: 'ein defektes Bauteil', cold: 'eine kalte Lötstelle', missing: 'ein fehlendes Bauteil' }; const txt = Object.keys(g).map(k => (g[k] > 1 ? g[k] + 'x ' : '') + names[k]).join(', ');
          showBanner('Noch nicht repariert: ' + txt + '. Miss weiter!', 5000); fx('sad', 0, 0, ''); addLog('Prüfung: noch nicht in Ordnung (' + txt + ').', 'bad'); }
        updateAll();
      }
      function tip() {
        const f = (S.board.repair && S.board.repair.faults || [])[0]; if (!f) { toast('Diese Platine hat keine bekannten Fehler.'); return; }
        const v = PCB_REPAIR.verify(S.board); if (v.ok) { toast('Alles in Ordnung. Du bist fertig!'); return; }
        const open = (S.board.repair.faults || []).find(x => v.remaining.some(r => !x.ref || r.ref === x.ref || (r.nets && x.nets && r.nets[0] === x.nets[0]) || (r.net && r.net === x.net)) ) || f;
        S.hintN = Math.min(3, S.hintN + 1); let t;
        if (S.hintN === 1) t = 'Tipp 1: Es handelt sich um: ' + (open.group || 'einen Fehler') + '. Messen und Anschauen hilft.';
        else if (S.hintN === 2) { S.hl = { x: open.where.x, y: open.where.y, r: 6 }; t = 'Tipp 2: Der Fehler steckt im markierten Bereich.'; if (open.layer === 'B.Cu' && S.side === 'top') t += ' (Schau auf die Rückseite.)'; }
        else { S.hl = { x: open.where.x, y: open.where.y, r: 1.6 }; t = 'Tipp 3: ' + open.desc + ' ' + open.fix; }
        toast(t); addLog(t, 'warn'); dirty();
      }
      function renderPanel() {
        side.classList.toggle('on', !!S.panel); if (!S.panel) { requestAnimationFrame(resize); return; }
        side.querySelectorAll('[data-pt]').forEach(b => b.classList.toggle('on', b.dataset.pt === S.ptab));
        if (S.ptab === 'sch') body.innerHTML = S.board ? schematicHtml(S) : '';
        else body.innerHTML = '<div class="pr-log">' + (S.log.length ? S.log.slice().reverse().map(l => `<div class="${l.c || ''}"><time>${l.t}</time>${esc(l.x)}</div>`).join('') : '<div>Noch keine Einträge. Jede Messung und Reparatur wird hier mit Uhrzeit notiert.</div>') + '</div><div style="margin-top:8px"><button class="pr-btn" data-a="clearlog">Protokoll leeren</button></div>';
        requestAnimationFrame(resize);
      }
      root0.addEventListener('click', async e => {
        const t = e.target.closest('[data-tool],[data-a],[data-mm],[data-pt],.pr-card'); if (!t) return;
        if (t.dataset.tool) { setTool(t.dataset.tool); return; }
        if (t.dataset.mm) { S.mmode = t.dataset.mm; stopBeep(); lastBeep = false; buildMeter(); measureNow(false); return; }
        if (t.dataset.pt) { S.ptab = t.dataset.pt; S.panel = true; buildBar(); renderPanel(); return; }
        if (t.classList.contains('pr-card')) { S.sel = t.dataset.ref; const p = sceneCache(S).part[S.sel] || sceneCache(S).sol[S.sel]; if (p) { S.hl = { x: p.x, y: p.y, r: 4 }; if (S.side !== (p.side || 'top')) S.side = p.side === 'bot' ? 'bot' : 'top'; dirty(); } renderPanel(); return; }
        switch (t.dataset.a) {
          case 'case': await newCase(); break;
          case 'side': S.side = S.side === 'top' ? 'bot' : 'top'; S.hl = null; S.wire = null; buildBar(); dirty(); break;
          case 'power': togglePower(); break;
          case 'sch': if (S.panel && S.ptab === 'sch') S.panel = false; else { S.panel = true; S.ptab = 'sch'; } buildBar(); renderPanel(); break;
          case 'log': if (S.panel && S.ptab === 'log') S.panel = false; else { S.panel = true; S.ptab = 'log'; } buildBar(); renderPanel(); break;
          case 'closep': S.panel = false; buildBar(); renderPanel(); break;
          case 'tip': tip(); break;
          case 'check': check(); break;
          case 'zin': zoomAt(S.W / 2, S.H / 2, 1.3); break;
          case 'zout': zoomAt(S.W / 2, S.H / 2, 1 / 1.3); break;
          case 'fit': fit(); break;
          case 'lz': S.lens.Z = S.lens.Z === 6 ? 12 : S.lens.Z === 12 ? 3 : 6; buildBar(); dirty(); break;
          case 'clearlog': S.log = []; lsSet('pcb.repair.log', S.log); renderPanel(); break;
        }
      });
      lensZoomHook();
      function lensZoomHook() { cv.addEventListener('dblclick', () => { if (S.tool === 'lupe') { S.lens.Z = S.lens.Z === 6 ? 12 : 6; dirty(); } }); }
      const ro = root.ResizeObserver ? new ResizeObserver(() => resize()) : null; if (ro) ro.observe(stage);
      const onWin = () => resize(); root.addEventListener('resize', onWin);

      adopt(); buildBar(); buildMeter(); resize(); if (S.board && !S.fitS) fit(); updateAll();
      return {
        refresh() { const before = S.board; adopt(); if (S.board && (S.board !== before)) { S.probes = { A: null, B: null }; S.power = false; S.op = null; S.hot = null; S.smoke = []; S.meter = null; stopBeep(); S.lens.on = false; } updateAll(); resize(); measureNow(false); },
        onBoard() { S.mode === 'ctx' && adopt(); },
        destroy() { alive = false; stopBeep(); if (ro) ro.disconnect(); root.removeEventListener('resize', onWin); cancelAnimationFrame(raf); clearTimeout(banT); el.innerHTML = ''; },
        onShow() { shown = true; resize(); if (S.board && !S.fitS) fit(); updateAll(); },
        onHide() { stopBeep(); },
        onResize() { resize(); },
        _st: S, _fix: doFix, _measure: measureNow, _tap: tapTool, _paint: paint, _inspect: inspect, _power: togglePower
      };
    }
  });

})(typeof window !== 'undefined' ? window : globalThis);
