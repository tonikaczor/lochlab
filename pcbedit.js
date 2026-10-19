/* pcbedit.js - Leiterplatten-Lab, Layout-Editor (View-Id 'edit')
 * Canvas-Editor mit Lagenleiste, Werkzeugen (Auswaehlen, Bauteil, Bahn, Via, Flaeche, Text, Messen, Loeschen),
 * Ratsnest, DRC-Markern, Netz-Hervorhebung, Auto-Weg, Rueckgaengig (200 Schritte), Schnitt durch Via und 3D-Ansicht.
 *
 * Schnittstelle: PCB_VIEWS.register('edit', { title, mount(el, ctx) -> { refresh(), destroy(), onShow() } }).
 * Der Editor aendert das Board-Objekt von ctx.getBoard() direkt und ruft danach ctx.changed().
 * Rueckgaengig/Wiederholen sind lokal (Snapshots als JSON); wird ein anderes Board-Objekt geliefert, wird die Historie geleert
 * (ausser bei Auto-Weg: dort ruft der Editor selbst ctx.setBoard() auf und behaelt die Historie).
 *
 * BESONDERHEITEN
 *  - Zeichenwerkzeuge (Bauteil/Bahn/Via/Flaeche/Text/Messen): Finger bewegt das Fadenkreuz, Loslassen setzt (Tippen = setzen).
 *    Verschieben der Ansicht dort mit zwei Fingern, Maus: Mausrad/mittlere Taste/rechte Taste/Leertaste+Ziehen.
 *  - Bahn: Doppeltipp, Taste V oder Knopf "Via" setzt eine Via und wechselt die Lage (2 Lagen: andere Seite;
 *    sonst Wechsel der aktiven Lage waehrend des Routens setzt ebenfalls eine Via). Fertig: Knopf, Enter, Tippen auf ein
 *    Pad/eine Via desselben Netzes, rechte Maustaste. Backspace nimmt den letzten Punkt zurueck, Esc bricht ab.
 *  - Tasten: S Waehlen, P Bauteil, B Bahn, O Via, Z Flaeche, X Text, M Messen, D Loeschen, R drehen, F spiegeln, V Via (Bahn),
 *    Entf loeschen, Strg+Z / Strg+Y, 1..6 Lage, H Netz hervorheben aus.
 *  - Gesperrte Bauteile (part.locked), ctx.mode()==='view' und ctx.task().readonly verhindern Aenderungen.
 *  - Zusatzfelder im Board (alle optional): board.grid (Raster), net.width / net.current (Breite/Strom), zone.clearance.
 */
(function (root) {
  'use strict';
  const VIEWS = root.PCB_VIEWS = root.PCB_VIEWS || { views: {}, register: function (id, def) { this.views[id] = def; } };
  const core = function () { return root.PCB_CORE; };

  // ------------------------------------------------------------ Konstanten
  const LCOL = {
    'F.Cu': '#c83434', 'In1.Cu': '#4fb04f', 'In2.Cu': '#d98a2b', 'In3.Cu': '#a56ad8', 'In4.Cu': '#3cc4c4', 'B.Cu': '#3f7fd0',
    'F.Silk': '#ffe14d', 'B.Silk': '#e8e8e8', 'F.Mask': '#c050c0', 'B.Mask': '#20c8c0', 'Edge': '#f5d742'
  };
  const LNAME = {
    'F.Cu': 'F.Cu (oben)', 'B.Cu': 'B.Cu (unten)', 'In1.Cu': 'In1.Cu (innen 1)', 'In2.Cu': 'In2.Cu (innen 2)',
    'In3.Cu': 'In3.Cu (innen 3)', 'In4.Cu': 'In4.Cu (innen 4)', 'F.Silk': 'Bestückungsdruck oben', 'B.Silk': 'Bestückungsdruck unten',
    'F.Mask': 'Lötstopplack oben', 'B.Mask': 'Lötstopplack unten', 'Edge': 'Platinenumriss'
  };
  const LSHORT = { 'F.Cu': 'F.Cu', 'In1.Cu': 'In1', 'In2.Cu': 'In2', 'In3.Cu': 'In3', 'In4.Cu': 'In4', 'B.Cu': 'B.Cu', 'F.Silk': 'F.Silk', 'B.Silk': 'B.Silk', 'F.Mask': 'F.Mask', 'B.Mask': 'B.Mask', 'Edge': 'Rand' };
  const EXTRA_LAYERS = ['F.Silk', 'B.Silk', 'F.Mask', 'B.Mask', 'Edge'];
  const GRIDS = [0.25, 0.5, 1.27, 2.54];
  const WIDTHS = [0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.8, 1, 1.5, 2];
  const BG = '#0d1013';
  const MAXUNDO = 200;

  // ------------------------------------------------------------ Hilfsfunktionen
  function h(tag, a, kids) {
    const e = document.createElement(tag);
    if (a) for (const k in a) {
      const v = a[k];
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    if (kids) for (let i = 0; i < kids.length; i++) { const c = kids[i]; if (c == null) continue; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return e;
  }
  const clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  const fmt = function (n, d) { if (d == null) d = 2; if (!isFinite(n)) return '–'; return String(+(+n).toFixed(d)).replace('.', ','); };
  const num = function (s, def) { const v = parseFloat(String(s).replace(',', '.')); return isFinite(v) ? v : def; };
  const hyp = Math.hypot;
  const deg = function (r) { return r * 180 / Math.PI; };
  const nrot = function (r) { return ((Math.round((r || 0) / 90) * 90) % 360 + 360) % 360; };
  const pt2 = function (p) { return Array.isArray(p) ? p : [p.x, p.y]; };

  function distPtSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    return hyp(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  function segInter(a, b, c, d) {
    function o(p, q, r) { return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); }
    const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
    return ((o1 > 0) !== (o2 > 0)) && ((o3 > 0) !== (o4 > 0));
  }
  function distSegSeg(a, b, c, d) {
    if (segInter(a, b, c, d)) return 0;
    return Math.min(distPtSeg(a[0], a[1], c[0], c[1], d[0], d[1]), distPtSeg(b[0], b[1], c[0], c[1], d[0], d[1]),
      distPtSeg(c[0], c[1], a[0], a[1], b[0], b[1]), distPtSeg(d[0], d[1], a[0], a[1], b[0], b[1]));
  }
  function distSegRect(a, b, r) { // r = [x1,y1,x2,y2]
    if (a[0] >= r[0] && a[0] <= r[2] && a[1] >= r[1] && a[1] <= r[3]) return 0;
    const cs = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
    let m = 1e9;
    for (let i = 0; i < 4; i++) m = Math.min(m, distSegSeg(a, b, cs[i], cs[(i + 1) % 4]));
    return m;
  }
  function distPtRect(px, py, r) {
    const dx = Math.max(r[0] - px, 0, px - r[2]), dy = Math.max(r[1] - py, 0, py - r[3]);
    return hyp(dx, dy);
  }
  function ptInPoly(x, y, poly) {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = pt2(poly[i]), b = pt2(poly[j]);
      if (((a[1] > y) !== (b[1] > y)) && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) ins = !ins;
    }
    return ins;
  }
  function polyBBox(poly) {
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    poly.forEach(function (p) { p = pt2(p); x1 = Math.min(x1, p[0]); y1 = Math.min(y1, p[1]); x2 = Math.max(x2, p[0]); y2 = Math.max(y2, p[1]); });
    return [x1, y1, x2, y2];
  }
  function polyLen(pts) { let l = 0; for (let i = 1; i < pts.length; i++) l += hyp(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; }

  function fpOf(id) {
    const C = core();
    if (!C) return null;
    if (typeof C.footprint === 'function') { const f = C.footprint(id); if (f) return f; }
    return (C.footprints || {})[id] || null;
  }
  // Transformation Footprint -> Welt wie im Kern (pcbcore xform): bei Unterseite an der y-Achse spiegeln,
  // positive Drehung = gegen den Uhrzeigersinn (y zeigt nach unten)
  function xfPart(p) {
    const r = nrot(p.rot) * Math.PI / 180, co = Math.round(Math.cos(r) * 1e9) / 1e9, si = Math.round(Math.sin(r) * 1e9) / 1e9;
    const m = p.side === 'bot' ? -1 : 1;
    return function (lx, ly) { const x = lx * m; return [p.x + x * co + ly * si, p.y - x * si + ly * co]; };
  }
  function padDims(pad, rot) { return nrot(rot) % 180 === 90 ? [pad.h, pad.w] : [pad.w, pad.h]; }
  function courtRect(p) {
    const fp = fpOf(p.fp);
    if (!fp) return [p.x - 1, p.y - 1, p.x + 1, p.y + 1];
    const xf = xfPart(p);
    let cr = fp.courtyard;
    if (!cr) {
      let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
      (fp.pads || []).forEach(function (q) { x1 = Math.min(x1, q.x - q.w / 2); y1 = Math.min(y1, q.y - q.h / 2); x2 = Math.max(x2, q.x + q.w / 2); y2 = Math.max(y2, q.y + q.h / 2); });
      cr = { x: x1 - 0.25, y: y1 - 0.25, w: x2 - x1 + 0.5, h: y2 - y1 + 0.5 };
    }
    const a = xf(cr.x, cr.y), b = xf(cr.x + cr.w, cr.y + cr.h);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  }
  function padRect(p) { // Welt-Pad (aus padsOf) als Rechteck
    return [p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2];
  }
  function prefixFor(fpId) {
    const s = String(fpId).toUpperCase();
    if (/^R[_0-9]/.test(s)) return 'R';
    if (/^C[_0-9]/.test(s)) return 'C';
    if (s.indexOf('LED') === 0) return 'D';
    if (s.indexOf('SOD') === 0) return 'D';
    if (s.indexOf('DIP') === 0 || s.indexOf('SOIC') === 0 || s.indexOf('TSSOP') === 0 || s.indexOf('QFP') === 0 || s.indexOf('QFN') === 0 || s.indexOf('SOT-223') === 0 || s.indexOf('TO-220') === 0) return 'U';
    if (s.indexOf('SOT') === 0 || s.indexOf('TO-92') === 0) return 'Q';
    if (s.indexOf('HDR') === 0 || s.indexOf('DC_JACK') === 0) return 'J';
    if (s.indexOf('SWITCH') === 0) return 'SW';
    return 'X';
  }
  function defaultValue(fpId, prefix) {
    if (prefix === 'R') return '10k';
    if (prefix === 'C') return /RADIAL_5/.test(fpId) ? '100µ' : '100n';
    if (prefix === 'D') return /LED/i.test(fpId) ? 'LED' : '1N4148';
    if (prefix === 'SW') return 'Taster';
    if (prefix === 'J') return '';
    return fpId;
  }
  function bodyHeight(fp, id) {
    if (fp && fp.bodyH) return fp.bodyH;
    const t = {
      R0402: 0.35, R0603: 0.5, R0805: 0.6, R1206: 0.6, C0603: 0.5, C0805: 0.6, LED0603: 0.5, 'SOT-23': 1.1, 'SOT-223': 1.7, 'SOIC-8': 1.7, 'SOIC-14': 1.7, 'SOIC-16': 1.7,
      'TSSOP-16': 1.1, 'QFP-32': 1.6, 'QFN-16': 0.9, 'SOD-123': 1.0, R_AXIAL_10: 2.5, R_AXIAL_7: 2.5, 'C_RADIAL_2.5': 6, C_RADIAL_5: 11, LED_5MM: 8.6,
      'DIP-8': 3.8, 'DIP-14': 3.8, 'DIP-16': 3.8, 'TO-92': 5, 'TO-220': 4.5, HDR_1x2: 8.5, HDR_1x4: 8.5, HDR_2x5: 8.5, DC_JACK: 11, SWITCH_6MM: 5
    };
    return t[id] || (fp && fp.kind === 'tht' ? 6 : 1);
  }
  function partColor(p) {
    const id = String(p.fp), v = String(p.value || '').toLowerCase();
    if (/^LED/.test(id)) {
      if (/gr[uü]n|green/.test(v)) return '#3cc860';
      if (/gelb|yellow/.test(v)) return '#e8d03c';
      if (/blau|blue/.test(v)) return '#4a7fe0';
      if (/wei[sß]|white/.test(v)) return '#eeeeee';
      return '#e03c3c';
    }
    if (/^R_AXIAL/.test(id)) return '#d6b676';
    if (/^R\d/.test(id)) return '#34312c';
    if (/^C_RADIAL/.test(id)) return '#2c4a8a';
    if (/^C\d/.test(id)) return '#a9805a';
    if (/^HDR|^DC_JACK/.test(id)) return '#26262a';
    if (/^SWITCH/.test(id)) return '#5a606a';
    if (/^SOD/.test(id)) return '#2a2a2e';
    return '#1f1f24';
  }

  // ------------------------------------------------------------ CSS
  let cssDone = false;
  function injectCss() {
    if (cssDone || document.getElementById('pe-css')) { cssDone = true; return; }
    cssDone = true;
    const st = document.createElement('style');
    st.id = 'pe-css';
    st.textContent = [
      '.pe-root{--bg:#14181c;--pn:#222830;--pn2:#2c343e;--bd:#3a4552;--ac:#3b9eff;--ok:#4cd964;--tx:#e6edf3;--mut:#8b98a6;--bad:#ff6b63;--warn:#ffb340;',
      'color:var(--tx);font:14px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);height:100%;min-height:360px;display:flex;flex-direction:column;box-sizing:border-box;position:relative;outline:0;-webkit-text-size-adjust:100%;overflow:hidden}',
      '.pe-root *{box-sizing:border-box}',
      '.pe-row{display:flex;gap:4px;padding:4px 6px;background:var(--pn);border-bottom:1px solid #0b0d10;align-items:center;overflow-x:auto;flex:none;scrollbar-width:thin;-webkit-overflow-scrolling:touch}',
      '.pe-row::-webkit-scrollbar{height:5px}.pe-row::-webkit-scrollbar-thumb{background:#44505e;border-radius:3px}',
      '.pe-b{min-width:44px;height:46px;padding:2px 8px;border-radius:10px;border:1px solid var(--bd);background:var(--pn2);color:var(--tx);font:600 13px system-ui,sans-serif;cursor:pointer;touch-action:manipulation;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:0;flex:none;white-space:nowrap;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}',
      '.pe-b i{font-style:normal;font-size:18px;line-height:20px}.pe-b span{font-size:10px;font-weight:600;color:var(--mut);line-height:12px}',
      '.pe-b:active{background:#394554}.pe-b[disabled]{opacity:.35;cursor:default}',
      '.pe-b.on{background:var(--ac);border-color:var(--ac);color:#04121f}.pe-b.on span{color:#0a2b4a}',
      '.pe-b.ok{background:var(--ok);border-color:var(--ok);color:#06210d}.pe-b.ok span{color:#0b3a17}',
      '.pe-b.flat{height:40px;flex-direction:row;gap:6px;font-size:13px}',
      '.pe-sep{width:1px;height:30px;background:var(--bd);margin:0 3px;flex:none}',
      '.pe-sel,.pe-in{height:40px;min-width:60px;border-radius:9px;border:1px solid var(--bd);background:#1a2027;color:var(--tx);font:600 13px system-ui,sans-serif;padding:0 8px;flex:none}',
      '.pe-in{width:90px}.pe-in.w{width:130px}',
      '.pe-lab{font-size:12px;color:var(--mut);flex:none;display:flex;align-items:center;gap:4px;white-space:nowrap}',
      '.pe-chip{display:inline-flex;align-items:center;height:40px;border-radius:20px;border:1px solid var(--bd);background:var(--pn2);flex:none;overflow:hidden;user-select:none;-webkit-user-select:none}',
      '.pe-chip button{height:100%;border:0;background:transparent;color:var(--tx);font:600 13px system-ui,sans-serif;cursor:pointer;touch-action:manipulation;padding:0 10px;-webkit-tap-highlight-color:transparent}',
      '.pe-chip .eye{width:40px;padding:0;font-size:16px;border-right:1px solid var(--bd)}',
      '.pe-chip .sw{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px}',
      '.pe-chip.act{border-color:var(--ac);box-shadow:0 0 0 2px rgba(59,158,255,.35)}',
      '.pe-chip.off{opacity:.5}',
      '.pe-chip.na button.nm{color:var(--mut)}',
      '.pe-main{flex:1;display:flex;min-height:0;position:relative}',
      '.pe-stage{flex:1;position:relative;min-width:0;min-height:200px;background:' + BG + ';overflow:hidden}',
      '.pe-cv{position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none;display:block;outline:0;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}',
      '.pe-stat{position:absolute;left:6px;bottom:6px;right:6px;display:flex;gap:8px;align-items:flex-end;pointer-events:none;flex-wrap:wrap}',
      '.pe-stat .msg{background:rgba(20,24,28,.88);border:1px solid var(--bd);border-radius:8px;padding:4px 9px;font-size:12px;color:var(--tx);max-width:100%}',
      '.pe-stat .msg.warn{border-color:var(--warn);color:#ffd9a0}.pe-stat .msg.bad{border-color:var(--bad);color:#ffb4ad}',
      '.pe-stat .pos{background:rgba(20,24,28,.88);border:1px solid var(--bd);border-radius:8px;padding:4px 9px;font:12px ui-monospace,Consolas,monospace;color:var(--mut);margin-left:auto}',
      '.pe-fab{position:absolute;right:8px;top:8px;display:flex;flex-direction:column;gap:6px;align-items:flex-end}',
      '.pe-fab .pe-b{height:44px;flex-direction:row;gap:6px;box-shadow:0 2px 10px rgba(0,0,0,.5)}',
      '.pe-zoomb{position:absolute;left:8px;top:8px;display:flex;flex-direction:column;gap:6px}',
      '.pe-zoomb .pe-b{min-width:44px;height:44px;box-shadow:0 2px 10px rgba(0,0,0,.5);opacity:.92}',
      '.pe-ro{position:absolute;left:50%;transform:translateX(-50%);top:8px;background:#3a2f1c;border:1px solid var(--warn);color:#ffd9a0;border-radius:8px;padding:4px 12px;font-size:12px;pointer-events:none;white-space:nowrap}',
      '.pe-side{width:310px;flex:none;background:var(--pn);border-left:1px solid #0b0d10;display:flex;flex-direction:column;min-height:0}',
      '.pe-tabs{display:flex;flex:none;border-bottom:1px solid #0b0d10}',
      '.pe-tab{flex:1;height:42px;border:0;background:transparent;color:var(--mut);font:600 13px system-ui,sans-serif;cursor:pointer;border-bottom:3px solid transparent;touch-action:manipulation;-webkit-tap-highlight-color:transparent}',
      '.pe-tab.on{color:var(--tx);border-bottom-color:var(--ac)}',
      '.pe-tab .n{display:inline-block;min-width:20px;padding:0 5px;border-radius:10px;background:#44505e;font-size:11px;margin-left:4px}',
      '.pe-tab .n.bad{background:var(--bad);color:#2a0a08}',
      '.pe-pane{flex:1;overflow:auto;padding:8px 10px;min-height:0;-webkit-overflow-scrolling:touch}',
      '.pe-narrow .pe-main{flex-direction:column}',
      '.pe-narrow .pe-stat .msg{font-size:11px;padding:3px 7px}',
      '.pe-narrow .pe-side{width:auto;height:230px;border-left:0;border-top:1px solid #0b0d10}',
      '.pe-narrow.pe-sidehide .pe-side{height:42px}.pe-narrow.pe-sidehide .pe-pane{display:none}',
      '.pe-fld{display:flex;align-items:center;gap:8px;margin:5px 0;min-height:40px}',
      '.pe-fld>label{width:92px;flex:none;font-size:12px;color:var(--mut)}',
      '.pe-fld .pe-in,.pe-fld .pe-sel{flex:1;width:auto;min-width:0}',
      '.pe-h4{margin:8px 0 4px;font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}',
      '.pe-p{margin:4px 0;font-size:12.5px;color:var(--mut)}.pe-p b{color:var(--tx)}',
      '.pe-btns{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}',
      '.pe-li{display:flex;gap:8px;align-items:flex-start;padding:8px 8px;border-radius:9px;margin-bottom:4px;background:var(--pn2);border:1px solid transparent;cursor:pointer;min-height:44px;font-size:13px}',
      '.pe-li.on{border-color:var(--ac)}.pe-li:active{background:#394554}',
      '.pe-dot{flex:none;width:12px;height:12px;border-radius:50%;margin-top:4px}',
      '.pe-li .s{color:var(--mut);font-size:11.5px}',
      '.pe-modal{position:absolute;left:0;top:0;right:0;bottom:0;background:rgba(5,8,10,.7);display:flex;align-items:center;justify-content:center;z-index:20;padding:10px}',
      '.pe-dlg{background:var(--pn);border:1px solid var(--bd);border-radius:14px;max-width:560px;width:100%;max-height:100%;display:flex;flex-direction:column;box-shadow:0 14px 50px rgba(0,0,0,.6)}',
      '.pe-dlg>header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--bd);font-weight:700}',
      '.pe-dlg>header .x{margin-left:auto}',
      '.pe-dlg>.bd{padding:10px 12px;overflow:auto;min-height:0;-webkit-overflow-scrolling:touch}',
      '.pe-fpl{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:9px;margin-bottom:4px;background:var(--pn2);cursor:pointer;min-height:52px;border:1px solid transparent}',
      '.pe-fpl:active,.pe-fpl.on{border-color:var(--ac)}',
      '.pe-fpl canvas{flex:none;background:#0d1013;border-radius:6px}',
      '.pe-fpl .t{font-weight:700;font-size:13px}.pe-fpl .d{font-size:11.5px;color:var(--mut)}',
      '.pe-pop{position:absolute;z-index:15;background:var(--pn);border:1px solid var(--bd);border-radius:12px;padding:8px 10px;box-shadow:0 10px 40px rgba(0,0,0,.6);min-width:230px}',
      '.pe-pop label.ck{display:flex;align-items:center;gap:10px;min-height:40px;font-size:13px;cursor:pointer}',
      '.pe-pop input[type=checkbox]{width:20px;height:20px}',
      '.pe-is3d .pe-zoomb{top:58px}',
      '.pe-3d{position:absolute;left:8px;top:8px;display:flex;gap:6px;flex-wrap:wrap;right:8px;pointer-events:none}',
      '.pe-3d .pe-b{pointer-events:auto;height:40px;flex-direction:row;gap:6px;opacity:.95}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ------------------------------------------------------------ Editor
  function mount(el, ctx) {
    injectCss();
    const TAU = Math.PI * 2;
    const S = {
      tool: 'select', layer: 'F.Cu', vis: {}, sel: null, hiNet: null,
      k: 12, ox: 20, oy: 20, W: 0, H: 0, dpr: 1, fitted: false,
      snap: true, grid: true, rats: true, drcOn: true, court: false, padNum: true, netNames: false, dim: 'dim', free: false,
      rev: 0, sig: '', board: null, padsRev: -1, pads: [], connRev: -1, conn: null, connT: 0, zfRev: -1, zf: {}, zfBusy: false,
      undo: [], redo: [], selfSet: false,
      trk: null, zone: null, meas: null,
      place: { fp: null, ref: '', value: '', rot: 0, side: 'top' },
      trackW: 'auto', viaNet: '', viaDia: 0, viaDrill: 0, zoneNet: '',
      cur: null, curLive: false, snapKind: 'grid', hint: '', hintCls: '',
      drag: null, ptrs: new Map(), pinch: null, panning: null, lastTap: null,
      flash: null, drcSel: null, tab: 'props', arNets: {}, sideHide: false,
      v3: false, cam: { yaw: 25, pitch: 48, k: 7, explode: false },
      dirty: true, raf: 0, destroyed: false, space: false, cornerMode: 0, propSig: '', listSig: '', fpFilter: 'all'
    };
    const B = function () { return ctx.getBoard(); };
    const toast = function (m) { if (ctx.toast) ctx.toast(m); };
    const fx = function (kind, x, y, text) { try { if (ctx.fx) ctx.fx(kind, x, y, text); } catch (e) { /* Effekte sind optional */ } };
    function R() {
      return Object.assign({ minWidth: 0.2, clearance: 0.2, minDrill: 0.3, annular: 0.15, edge: 0.3, viaDia: 0.8, viaDrill: 0.4, silkWidth: 0.15, maskExpansion: 0.05 }, B().rules || {});
    }
    function task() { try { return ctx.task ? ctx.task() : null; } catch (e) { return null; } }
    function readOnly() { const t = task(); return !!((ctx.mode && ctx.mode() === 'view') || (t && t.readonly)); }
    function guard() { if (readOnly()) { toast('Nur Ansicht: Hier kannst du nichts ändern.'); return false; } return true; }
    function isLocked(p) { return !!(p && p.locked); }

    // ---------------- DOM
    const rootEl = h('div', { class: 'pe-root', tabindex: '0' });
    const toolRow = h('div', { class: 'pe-row' });
    const actRow = h('div', { class: 'pe-row' });
    const layerRow = h('div', { class: 'pe-row' });
    const optRow = h('div', { class: 'pe-row', style: 'min-height:50px' });
    const main = h('div', { class: 'pe-main' });
    const stage = h('div', { class: 'pe-stage' });
    const cv = h('canvas', { class: 'pe-cv' });
    const stat = h('div', { class: 'pe-stat' });
    const msgEl = h('div', { class: 'msg', style: 'display:none' });
    const posEl = h('div', { class: 'pos', text: '' });
    const fab = h('div', { class: 'pe-fab' });
    const zoomb = h('div', { class: 'pe-zoomb' });
    const roEl = h('div', { class: 'pe-ro', text: 'Nur Ansicht', style: 'display:none' });
    const cam3 = h('div', { class: 'pe-3d', style: 'display:none' });
    const side = h('div', { class: 'pe-side' });
    const tabs = h('div', { class: 'pe-tabs' });
    const pane = h('div', { class: 'pe-pane' });
    stat.appendChild(msgEl); stat.appendChild(posEl);
    stage.appendChild(cv); stage.appendChild(zoomb); stage.appendChild(fab); stage.appendChild(cam3); stage.appendChild(roEl); stage.appendChild(stat);
    side.appendChild(tabs); side.appendChild(pane);
    main.appendChild(stage); main.appendChild(side);
    [toolRow, actRow, layerRow, optRow, main].forEach(function (x) { rootEl.appendChild(x); });
    el.appendChild(rootEl);

    // ---------------- Modell-Helfer
    function byId(arr, id) { arr = arr || []; for (let i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
    function partOfPad(pad) {
      const b = B();
      return byId(b.parts, pad.part) || (b.parts || []).filter(function (p) { return p.ref === pad.ref || p.ref === pad.part; })[0] || null;
    }
    function newId(prefix) {
      const b = B(), C = core();
      if (C && typeof C.nextId === 'function') { try { const v = C.nextId(b, prefix); if (v != null) return v; } catch (e) { /* Fallback */ } }
      let mx = 0;
      ['parts', 'tracks', 'vias', 'zones', 'texts'].forEach(function (k) {
        (b[k] || []).forEach(function (o) { const m = /(\d+)$/.exec(String(o.id)); if (m) mx = Math.max(mx, +m[1]); });
      });
      return prefix + (mx + 1);
    }
    function getItem(sel) {
      if (!sel) return null;
      const b = B(), key = { part: 'parts', track: 'tracks', via: 'vias', zone: 'zones', text: 'texts' }[sel.t];
      return key ? byId(b[key], sel.id) : null;
    }
    function netsOf() { return (B().nets || []); }
    function netObj(name) { const n = netsOf(); for (let i = 0; i < n.length; i++) if (n[i].name === name) return n[i]; return null; }
    function isOuter(l) { return l === 'F.Cu' || l === 'B.Cu'; }
    function needWidth(net, layer) {
      const n = netObj(net), C = core();
      if (!n || !n.current || !C || !C.ipcWidth) return 0;
      try { return C.ipcWidth(n.current, { oz: isOuter(layer) ? (B().copperOz || 1) : (B().inOz || 0.5), rise: 10, external: isOuter(layer) }); } catch (e) { return 0; }
    }
    function autoWidth(net, layer) {
      const n = netObj(net), r = R();
      let w = 0.25;
      if (n && n.width) w = n.width;
      else if (n && n.cls === 'power') w = 0.5;
      w = Math.max(w, needWidth(net, layer), r.minWidth);
      return Math.round(w * 1000) / 1000;
    }
    function curWidth(net, layer) { return S.trackW === 'auto' ? autoWidth(net, layer) : S.trackW; }

    // Lagen
    function cuList() {
      const C = core();
      try { const l = C.layerList(B()); if (l && l.length) return l; } catch (e) { /* Fallback */ }
      const n = B().layers;
      return n >= 6 ? ['F.Cu', 'In1.Cu', 'In2.Cu', 'In3.Cu', 'In4.Cu', 'B.Cu'] : n >= 4 ? ['F.Cu', 'In1.Cu', 'In2.Cu', 'B.Cu'] : ['F.Cu', 'B.Cu'];
    }
    const isCu = function (l) { return /\.Cu$/.test(l); };
    const visible = function (l) { return S.vis[l] !== false; };
    function viaSpan(v) {
      const cu = cuList(), a = cu.indexOf(v.from || 'F.Cu'), z = cu.indexOf(v.to || 'B.Cu');
      return [a < 0 ? 0 : Math.min(a, z < 0 ? cu.length - 1 : z), z < 0 ? cu.length - 1 : Math.max(a < 0 ? 0 : a, z)];
    }
    function viaOnLayer(v, layer) { const cu = cuList(), i = cu.indexOf(layer), s = viaSpan(v); return i >= s[0] && i <= s[1]; }
    function padOnLayer(p, layer) { return !p.layers || p.layers.indexOf(layer) >= 0; }

    // Caches
    function getPads() {
      if (S.padsRev !== S.rev) {
        try { S.pads = core().padsOf(B()) || []; } catch (e) { S.pads = []; }
        S.padsRev = S.rev;
      }
      return S.pads;
    }
    function getConn() {
      if (S.connRev !== S.rev) {
        const now = performance.now();
        if (S.drag && S.conn && now - S.connT < 90) return S.conn;
        try { S.conn = core().connectivity(B()); } catch (e) { try { S.conn = ctx.connectivity ? ctx.connectivity() : null; } catch (e2) { S.conn = null; } }
        S.connRev = S.rev; S.connT = now;
      }
      return S.conn;
    }
    function normPolys(res) {
      const out = [];
      (res || []).forEach(function (poly) {
        let pts = poly;
        if (poly && !Array.isArray(poly)) {
          if (poly.outer) { out.push(poly.outer.map(pt2)); (poly.holes || []).forEach(function (hh) { out.push(hh.map(pt2)); }); return; }
          pts = poly.pts || poly.poly || poly.points || [];
        }
        if (pts && pts.length >= 3) out.push(pts.map(pt2));
      });
      return out;
    }
    function zoneFills() {
      if (S.zfRev !== S.rev && !S.zfBusy && !(S.drag && S.drag.live)) {
        S.zfBusy = true;
        const rev0 = S.rev;
        setTimeout(function () {
          if (S.destroyed) return;
          const map = {};
          const b = B();
          (b.zones || []).forEach(function (z) {
            try {
              const pl = normPolys(core().zoneFill(b, z));
              if (pl.length && typeof Path2D !== 'undefined') {
                const pa = new Path2D();
                pl.forEach(function (poly) { poly.forEach(function (q, i) { if (i) pa.lineTo(q[0], q[1]); else pa.moveTo(q[0], q[1]); }); pa.closePath(); });
                pl.path = pa;
              }
              map[z.id] = pl;
            } catch (e) { map[z.id] = null; }
          });
          S.zf = map; S.zfRev = rev0; S.zfBusy = false;
          invalidate();
        }, 15);
      }
      return S.zf;
    }

    // Verlaufsspeicher
    const snapStr = function () { return JSON.stringify(B()); };
    function updUndo() {
      if (btnUndo) btnUndo.disabled = !S.undo.length;
      if (btnRedo) btnRedo.disabled = !S.redo.length;
    }
    function pushUndo(pre) {
      if (S.undo.length && S.undo[S.undo.length - 1] === pre) return;
      S.undo.push(pre);
      if (S.undo.length > MAXUNDO) S.undo.shift();
      S.redo.length = 0;
      updUndo();
    }
    function replaceBoard(str) {
      const b = B(), n = JSON.parse(str);
      Object.keys(b).forEach(function (k) { delete b[k]; });
      Object.assign(b, n);
    }
    function validateSel() {
      if (S.sel && !getItem(S.sel)) S.sel = null;
      if (S.hiNet && !netObj(S.hiNet) && !(B().tracks || []).some(function (t) { return t.net === S.hiNet; })) S.hiNet = null;
    }
    function modelChanged() {
      S.rev++;
      S.sig = snapStr();
      validateSel();
      try { ctx.changed(); } catch (e) { /* UI nicht bereit */ }
      S.propSig = ''; S.listSig = '';
      renderSide();
      invalidate();
    }
    function edit(fn) {
      const pre = snapStr();
      fn();
      if (snapStr() === pre) return false;
      pushUndo(pre);
      modelChanged();
      return true;
    }
    function undo() {
      if (!S.undo.length) return;
      cancelOps();
      S.redo.push(snapStr());
      replaceBoard(S.undo.pop());
      modelChanged(); updUndo();
      fx('click');
    }
    function redo() {
      if (!S.redo.length) return;
      cancelOps();
      S.undo.push(snapStr());
      replaceBoard(S.redo.pop());
      modelChanged(); updUndo();
      fx('click');
    }

    function invalidate() {
      S.dirty = true;
      if (!S.raf && !S.destroyed) S.raf = requestAnimationFrame(frame);
    }
    function frame() {
      S.raf = 0;
      if (S.destroyed) return;
      const t0 = performance.now();
      try { draw(); } catch (e) { if (root.console) console.error('pcbedit draw', e); }
      S.drawMs = performance.now() - t0;
      if (S.flash && performance.now() - S.flash.t0 < 1600) invalidate(); else S.flash = null;
    }

    // Hinweiszeile
    function setHint(text, cls) {
      S.hint = text || ''; S.hintCls = cls || '';
      msgEl.textContent = S.hint;
      msgEl.className = 'msg' + (cls ? ' ' + cls : '');
      msgEl.style.display = S.hint ? '' : 'none';
    }

    // Koordinaten
    const w2sx = function (x) { return x * S.k + S.ox; };
    const w2sy = function (y) { return y * S.k + S.oy; };
    const s2wx = function (x) { return (x - S.ox) / S.k; };
    const s2wy = function (y) { return (y - S.oy) / S.k; };
    const rnd = function (v) { return Math.round(v * 10000) / 10000; };
    const gridStep = function () { return B().grid || 0.25; };
    function gsnap(x, y) {
      if (!S.snap) return [rnd(x), rnd(y)];
      const g = gridStep();
      return [rnd(Math.round(x / g) * g), rnd(Math.round(y / g) * g)];
    }
    function boardBox() {
      const b = B();
      if (b.outline && b.outline.length > 2) return polyBBox(b.outline);
      return [0, 0, b.w || 100, b.h || 80];
    }
    function fit() {
      if (!S.W || !S.H) return;
      const bb = boardBox(), bw = bb[2] - bb[0], bh = bb[3] - bb[1], m = 16;
      S.k = clamp(Math.min((S.W - 2 * m) / bw, (S.H - 2 * m) / bh), 1.5, 120);
      S.ox = (S.W - bw * S.k) / 2 - bb[0] * S.k;
      S.oy = (S.H - bh * S.k) / 2 - bb[1] * S.k;
      S.fitted = true; S.userView = false;
      invalidate();
    }
    function zoomAt(sx, sy, f) {
      S.userView = true;
      const nk = clamp(S.k * f, 1.5, 150), wx = s2wx(sx), wy = s2wy(sy);
      S.k = nk; S.ox = sx - wx * nk; S.oy = sy - wy * nk;
      invalidate();
    }
    function centerOn(x, y, minK) {
      S.userView = true;
      if (minK && S.k < minK) S.k = minK;
      S.ox = S.W / 2 - x * S.k; S.oy = S.H / 2 - y * S.k;
      invalidate();
    }

    // Snap an Pads/Vias/Bahnenden
    function snapTo(wx, wy, o) {
      o = o || {};
      const rad = 12 / S.k;
      let best = null, bd = rad;
      getPads().forEach(function (p) {
        if (o.layer && !padOnLayer(p, o.layer)) return;
        const d = hyp(p.x - wx, p.y - wy);
        if (d < bd) { bd = d; best = { x: p.x, y: p.y, kind: 'pad', net: p.net || '', pad: p }; }
      });
      (B().vias || []).forEach(function (v) {
        if (o.layer && !viaOnLayer(v, o.layer)) return;
        const d = hyp(v.x - wx, v.y - wy);
        if (d < bd) { bd = d; best = { x: v.x, y: v.y, kind: 'via', net: v.net || '', via: v }; }
      });
      if (o.ends !== false) (B().tracks || []).forEach(function (t) {
        if (o.layer && t.layer !== o.layer) return;
        if (!o.layer && !visible(t.layer)) return;
        for (let i = 0; i < t.pts.length; i++) {
          const q = t.pts[i], d = hyp(q[0] - wx, q[1] - wy) + rad * 0.15;
          if (d < bd) { bd = d; best = { x: q[0], y: q[1], kind: 'end', net: t.net || '', track: t }; }
        }
      });
      if (best) return best;
      const g = gsnap(wx, wy);
      return { x: g[0], y: g[1], kind: 'grid', net: '' };
    }

    let btnUndo = null, btnRedo = null;

    // ================================================================ Zeichnen (2D)
    function padPath(c, x, y, w, h, shape) {
      if (shape === 'round') {
        if (Math.abs(w - h) < 1e-6) { c.moveTo(x + w / 2, y); c.arc(x, y, w / 2, 0, TAU); }
        else { c.moveTo(x + w / 2, y); c.ellipse(x, y, w / 2, h / 2, 0, 0, TAU); }
      } else if (shape === 'oval') {
        const r = Math.min(w, h) / 2;
        if (w >= h) {
          c.moveTo(x - w / 2 + r, y - h / 2); c.lineTo(x + w / 2 - r, y - h / 2); c.arc(x + w / 2 - r, y, r, -Math.PI / 2, Math.PI / 2);
          c.lineTo(x - w / 2 + r, y + h / 2); c.arc(x - w / 2 + r, y, r, Math.PI / 2, Math.PI * 1.5);
        } else {
          c.moveTo(x - w / 2, y - h / 2 + r); c.arc(x, y - h / 2 + r, r, Math.PI, 0);
          c.lineTo(x + w / 2, y + h / 2 - r); c.arc(x, y + h / 2 - r, r, 0, Math.PI);
        }
        c.closePath();
      } else { c.rect(x - w / 2, y - h / 2, w, h); }
    }
    function outlinePath(c) {
      const b = B();
      c.beginPath();
      if (b.outline && b.outline.length > 2) {
        b.outline.forEach(function (p, i) { p = pt2(p); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
        c.closePath();
      } else c.rect(0, 0, b.w || 100, b.h || 80);
    }
    function boardBase(c) {
      outlinePath(c);
      c.fillStyle = '#16231b'; c.fill();
    }
    function drawGrid(c) {
      if (!S.grid) return;
      let g = gridStep();
      while (g * S.k < 7) g *= 2;
      const bb = boardBox();
      const x1 = Math.max(bb[0], s2wx(0)), x2 = Math.min(bb[2], s2wx(S.W)), y1 = Math.max(bb[1], s2wy(0)), y2 = Math.min(bb[3], s2wy(S.H));
      const sx = Math.ceil(x1 / g) * g, sy = Math.ceil(y1 / g) * g, px = 1.2 / S.k;
      c.fillStyle = 'rgba(160,190,170,.32)';
      c.beginPath();
      let n = 0;
      for (let x = sx; x <= x2 + 1e-9; x += g) for (let y = sy; y <= y2 + 1e-9; y += g) { c.rect(x - px / 2, y - px / 2, px, px); if (++n > 40000) break; }
      c.fill();
    }
    function netAlpha(net) { return S.hiNet && net !== S.hiNet ? 0.25 : 1; }
    function drawCopper(c, layer, alpha, o) {
      o = o || {};
      const b = B(), col = LCOL[layer] || '#c83434', hi = S.hiNet;
      const fills = zoneFills();
      c.lineCap = 'round'; c.lineJoin = 'round';
      // Zonen
      (b.zones || []).forEach(function (z) {
        if (z.layer !== layer) return;
        const polys = fills[z.id];
        c.globalAlpha = alpha * netAlpha(z.net);
        c.fillStyle = col;
        if (polys && polys.length) {
          c.globalAlpha *= 0.4;
          if (polys.path) c.fill(polys.path);
          else {
            c.beginPath();
            polys.forEach(function (pl) { pl.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); });
            c.fill();
          }
        } else {
          c.globalAlpha *= 0.12;
          c.beginPath(); z.poly.forEach(function (p, i) { p = pt2(p); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.fill();
        }
        // Umriss
        if (!o.noOutline) {
          c.globalAlpha = alpha * netAlpha(z.net) * 0.55; c.strokeStyle = col; c.lineWidth = 1.2 / (o.k || S.k);
          c.setLineDash([5 / (o.k || S.k), 3 / (o.k || S.k)]);
          c.beginPath(); z.poly.forEach(function (p, i) { p = pt2(p); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.stroke();
          c.setLineDash([]);
        }
      });
      // Bahnen
      c.strokeStyle = col;
      (b.tracks || []).forEach(function (t) {
        if (t.layer !== layer || !t.pts || t.pts.length < 2) return;
        c.globalAlpha = alpha * netAlpha(t.net); c.lineWidth = t.w || 0.25;
        c.beginPath(); t.pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke();
      });
      // Vias
      c.fillStyle = col;
      (b.vias || []).forEach(function (v) {
        if (!viaOnLayer(v, layer)) return;
        c.globalAlpha = alpha * netAlpha(v.net);
        c.beginPath(); c.arc(v.x, v.y, (v.dia || 0.8) / 2, 0, TAU); c.fill();
      });
      // Pads
      getPads().forEach(function (p) {
        if (!padOnLayer(p, layer)) return;
        c.globalAlpha = alpha * netAlpha(p.net);
        c.beginPath(); padPath(c, p.x, p.y, p.w, p.h, p.shape); c.fill();
      });
      c.globalAlpha = 1;
    }
    function drawHoles(c, o) {
      const b = B();
      c.fillStyle = BG;
      c.beginPath();
      (b.vias || []).forEach(function (v) { if (!visibleVia(v)) return; const r = (v.drill || 0.4) / 2; c.moveTo(v.x + r, v.y); c.arc(v.x, v.y, r, 0, TAU); });
      getPads().forEach(function (p) {
        if (!p.drill) return;
        const dr = typeof p.drill === 'object' ? (p.drill.d || p.drill.w || 0.8) : p.drill, r = dr / 2;
        c.moveTo(p.x + r, p.y); c.arc(p.x, p.y, r, 0, TAU);
      });
      (b.holes || []).forEach(function (hh) { const r = (hh.d || 3) / 2; c.moveTo(hh.x + r, hh.y); c.arc(hh.x, hh.y, r, 0, TAU); });
      c.fill();
      if ((b.holes || []).length) {
        c.strokeStyle = LCOL.Edge; c.lineWidth = 1.2 / (o && o.k || S.k); c.beginPath();
        b.holes.forEach(function (hh) { const r = (hh.d || 3) / 2; c.moveTo(hh.x + r, hh.y); c.arc(hh.x, hh.y, r, 0, TAU); });
        c.stroke();
      }
    }
    function visibleVia(v) { return cuList().some(function (l) { return visible(l) && viaOnLayer(v, l); }); }
    function drawPadLabels(c) {
      const pk = S.k;
      if (!(S.padNum || S.netNames)) return;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      getPads().forEach(function (p) {
        if (!padOnLayer(p, S.layer) && !(p.layers && p.layers.some(visible))) return;
        const sz = Math.min(p.w, p.h) * 0.62;
        if (S.padNum && sz * pk >= 6 && p.n != null) {
          c.font = '600 ' + sz + 'px system-ui,sans-serif'; c.fillStyle = 'rgba(255,255,255,.92)';
          c.fillText(String(p.n), p.x, p.y);
        }
        if (S.netNames && p.net && pk >= 12) {
          c.font = '600 0.6px system-ui,sans-serif'; c.fillStyle = '#ffe9a8';
          c.fillText(p.net, p.x, p.y + Math.max(p.h / 2, 0.4) + 0.5);
        }
      });
    }
    function partSilk(c, p, col, lw) {
      const fp = fpOf(p.fp);
      if (!fp) return;
      const xf = xfPart(p);
      c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      (fp.silk || []).forEach(function (s) {
        if (s.t === 'line') { const a = xf(s.x1, s.y1), z = xf(s.x2, s.y2); c.moveTo(a[0], a[1]); c.lineTo(z[0], z[1]); }
        else if (s.t === 'rect') {
          const q = [xf(s.x, s.y), xf(s.x + s.w, s.y), xf(s.x + s.w, s.y + s.h), xf(s.x, s.y + s.h)];
          c.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) c.lineTo(q[i][0], q[i][1]); c.closePath();
        } else if (s.t === 'circle') { const m = xf(s.x, s.y); c.moveTo(m[0] + s.r, m[1]); c.arc(m[0], m[1], s.r, 0, TAU); }
      });
      c.stroke();
    }
    function drawSilk(c, layer, o) {
      const b = B(), col = LCOL[layer], side = layer === 'B.Silk' ? 'bot' : 'top', lw = R().silkWidth;
      c.globalAlpha = (o && o.alpha) || 0.95;
      (b.parts || []).forEach(function (p) {
        if ((p.side === 'bot' ? 'bot' : 'top') !== side) return;
        partSilk(c, p, col, lw);
        if (p.ref && !(o && o.noText)) {
          const cr = courtRect(p), sz = 1;
          if (sz * (o && o.k || S.k) >= 5) {
            c.font = '600 ' + sz + 'px system-ui,sans-serif'; c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(p.ref, (cr[0] + cr[2]) / 2, cr[1] - 0.7);
          }
        }
      });
      (b.texts || []).forEach(function (t) {
        if (t.layer !== layer || (o && o.noText)) return;
        c.font = '600 ' + (t.size || 1) + 'px system-ui,sans-serif'; c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(t.text || '', t.x, t.y);
      });
      c.globalAlpha = 1;
    }
    function drawMask(c, layer) {
      const side = layer === 'B.Mask' ? 'B.Cu' : 'F.Cu', col = LCOL[layer], ex = R().maskExpansion;
      c.globalAlpha = 0.07; c.fillStyle = col; outlinePath(c); c.fill();
      c.globalAlpha = 0.75; c.strokeStyle = col; c.lineWidth = 0.05;
      c.beginPath();
      getPads().forEach(function (p) { if (padOnLayer(p, side)) padPath(c, p.x, p.y, p.w + 2 * ex, p.h + 2 * ex, p.shape); });
      c.stroke();
      c.globalAlpha = 1;
    }
    function drawEdge(c, k) {
      outlinePath(c);
      c.strokeStyle = LCOL.Edge; c.lineWidth = 1.6 / (k || S.k); c.lineJoin = 'miter'; c.stroke();
    }
    function drawHiNet(c) {
      const b = B(), hi = S.hiNet;
      if (!hi) return;
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = '#ffffff';
      (b.tracks || []).forEach(function (t) {
        if (t.net !== hi || !visible(t.layer)) return;
        c.globalAlpha = t.layer === S.layer ? 0.55 : 0.28; c.lineWidth = t.w || 0.25;
        c.beginPath(); t.pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke();
      });
      c.fillStyle = '#ffffff';
      (b.vias || []).forEach(function (v) { if (v.net !== hi || !visibleVia(v)) return; c.globalAlpha = 0.5; c.beginPath(); c.arc(v.x, v.y, (v.dia || 0.8) / 2, 0, TAU); c.fill(); });
      getPads().forEach(function (p) {
        if (p.net !== hi || !(p.layers ? p.layers.some(visible) : true)) return;
        c.globalAlpha = 0.5; c.beginPath(); padPath(c, p.x, p.y, p.w, p.h, p.shape); c.fill();
        c.globalAlpha = 0.95; c.strokeStyle = '#fff'; c.lineWidth = 1.5 / S.k; c.beginPath(); padPath(c, p.x, p.y, p.w + 0.3, p.h + 0.3, p.shape); c.stroke();
      });
      const fills = zoneFills();
      (b.zones || []).forEach(function (z) {
        if (z.net !== hi || !visible(z.layer)) return;
        const polys = fills[z.id];
        if (!polys) return;
        c.globalAlpha = 0.18; c.fillStyle = '#fff';
        if (polys.path) c.fill(polys.path);
        else { c.beginPath(); polys.forEach(function (pl) { pl.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); }); c.fill(); }
      });
      c.globalAlpha = 1;
    }
    function copperOrder() {
      const cu = cuList(), act = cu.indexOf(S.layer) >= 0 ? S.layer : cu[0];
      const rest = cu.filter(function (l) { return l !== act; }).reverse();
      return { act: act, rest: rest };
    }
    function scene(c) {
      const ord = copperOrder();
      if (S.dim !== 'hide') ord.rest.forEach(function (l) { if (visible(l)) drawCopper(c, l, S.dim === 'full' ? 0.8 : 0.34); });
      if (visible(ord.act)) drawCopper(c, ord.act, 1);
      drawHoles(c);
      ['F.Mask', 'B.Mask'].forEach(function (l) { if (visible(l)) drawMask(c, l); });
      drawHiNet(c);
      drawPadLabels(c);
      ['B.Silk', 'F.Silk'].forEach(function (l) { if (visible(l)) drawSilk(c, l); });
      if (visible('Edge')) drawEdge(c);
    }
    function drawCourts(c) {
      const b = B();
      c.strokeStyle = 'rgba(190,200,215,.55)'; c.lineWidth = 1 / S.k; c.setLineDash([4 / S.k, 3 / S.k]);
      (b.parts || []).forEach(function (p) {
        const r = courtRect(p);
        c.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
      });
      c.setLineDash([]);
    }
    function drawRats(c) {
      const cn = getConn();
      if (!cn || !cn.unrouted) return;
      c.lineWidth = 1.3 / S.k; c.setLineDash([5 / S.k, 4 / S.k]); c.lineCap = 'butt';
      cn.unrouted.forEach(function (u) {
        const hl = S.hiNet && u.net === S.hiNet;
        if (S.hiNet && !hl) c.globalAlpha = 0.25; else c.globalAlpha = 1;
        c.strokeStyle = hl ? '#ffffff' : '#f0e6a0';
        c.beginPath(); c.moveTo(u.a.x, u.a.y); c.lineTo(u.b.x, u.b.y); c.stroke();
      });
      c.setLineDash([]); c.globalAlpha = 1;
    }
    function drawSel(c) {
      const it = getItem(S.sel);
      if (!it) return;
      const px = 1 / S.k, ac = '#3b9eff';
      c.strokeStyle = ac; c.fillStyle = ac; c.lineJoin = 'round'; c.lineCap = 'round';
      if (S.sel.t === 'part') {
        const r = courtRect(it), m = 0.25;
        c.lineWidth = 2 * px; c.setLineDash([6 * px, 3 * px]);
        c.strokeRect(r[0] - m, r[1] - m, r[2] - r[0] + 2 * m, r[3] - r[1] + 2 * m);
        c.setLineDash([]);
        c.globalAlpha = 0.12; c.fillRect(r[0] - m, r[1] - m, r[2] - r[0] + 2 * m, r[3] - r[1] + 2 * m); c.globalAlpha = 1;
        if (isLocked(it)) { c.font = '600 ' + (13 * px) + 'px system-ui,sans-serif'; c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillText('gesperrt', r[0], r[1] - m - 2 * px); }
      } else if (S.sel.t === 'track') {
        c.globalAlpha = 0.35; c.lineWidth = (it.w || 0.25) + 6 * px;
        c.beginPath(); it.pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); c.globalAlpha = 1;
        c.fillStyle = '#fff'; c.lineWidth = 2 * px;
        it.pts.forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 6 * px, 0, TAU); c.fill(); c.stroke(); });
      } else if (S.sel.t === 'via') {
        c.lineWidth = 2.5 * px; c.beginPath(); c.arc(it.x, it.y, (it.dia || 0.8) / 2 + 5 * px, 0, TAU); c.stroke();
      } else if (S.sel.t === 'zone') {
        c.lineWidth = 2 * px; c.setLineDash([6 * px, 3 * px]);
        c.beginPath(); it.poly.forEach(function (p, i) { p = pt2(p); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.stroke(); c.setLineDash([]);
        c.fillStyle = '#fff'; c.lineWidth = 2 * px;
        it.poly.forEach(function (p) { p = pt2(p); c.beginPath(); c.arc(p[0], p[1], 6 * px, 0, TAU); c.fill(); c.stroke(); });
      } else if (S.sel.t === 'text') {
        const w = (it.text || '').length * (it.size || 1) * 0.6, hh = (it.size || 1);
        c.lineWidth = 2 * px; c.strokeRect(it.x - w / 2 - 0.2, it.y - hh / 2 - 0.2, w + 0.4, hh + 0.4);
      }
    }
    function drawOutlineHandle(c) {
      const b = B();
      if (S.tool !== 'select' || S.sel || readOnly() || (b.outline && b.outline.length > 2)) return;
      const px = 1 / S.k, x = b.w, y = b.h;
      c.fillStyle = '#3b9eff'; c.strokeStyle = '#fff'; c.lineWidth = 2 * px;
      c.beginPath(); c.rect(x - 7 * px, y - 7 * px, 14 * px, 14 * px); c.fill(); c.stroke();
    }

    // --- Vorschau Bahn: Pruefung gegen fremde Netze
    function trackViolation(segs, layer, net, w) {
      const b = B(), r = R();
      let worst = null;
      function consider(gap, what, need) { if (gap < need - 1e-6 && (!worst || gap - need < worst.gap - worst.need)) worst = { gap: gap, need: need, what: what }; }
      segs.forEach(function (s) {
        getPads().forEach(function (p) {
          if (!padOnLayer(p, layer) || !p.net || p.net === net) return;
          let d;
          if (p.shape === 'round') d = distPtSeg(p.x, p.y, s[0][0], s[0][1], s[1][0], s[1][1]) - Math.min(p.w, p.h) / 2;
          else d = distSegRect(s[0], s[1], padRect(p));
          consider(d - w / 2, p.net, r.clearance);
        });
        (b.tracks || []).forEach(function (t) {
          if (t.layer !== layer || !t.net || t.net === net) return;
          for (let i = 1; i < t.pts.length; i++) consider(distSegSeg(s[0], s[1], t.pts[i - 1], t.pts[i]) - w / 2 - (t.w || 0.25) / 2, t.net, r.clearance);
        });
        (b.vias || []).forEach(function (v) {
          if (!viaOnLayer(v, layer) || !v.net || v.net === net) return;
          consider(distPtSeg(v.x, v.y, s[0][0], s[0][1], s[1][0], s[1][1]) - w / 2 - (v.dia || 0.8) / 2, v.net, r.clearance);
        });
        // Rand
        const bb = boardBox();
        [s[0], s[1]].forEach(function (q) {
          const d = Math.min(q[0] - bb[0], q[1] - bb[1], bb[2] - q[0], bb[3] - q[1]) - w / 2;
          consider(d, 'Platinenrand', r.edge);
        });
      });
      return worst;
    }
    function trackPreview() {
      const t = S.trk;
      if (!t || !S.cur) return null;
      const last = t.pts[t.pts.length - 1];
      const add = routePts(last, [S.cur.x, S.cur.y], S.cur.kind !== 'grid');
      const pts = [last].concat(add);
      const segs = [];
      for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]]);
      return { pts: pts, viol: segs.length ? trackViolation(segs, t.layer, t.net, t.w) : null };
    }
    function routePts(P, C, exact) {
      let dx = C[0] - P[0], dy = C[1] - P[1], adx = Math.abs(dx), ady = Math.abs(dy);
      if (adx < 1e-9 && ady < 1e-9) return [];
      // winziger Versatz (Start an einem Pad neben dem Raster): geradeaus statt kleiner Zacken
      if (!S.free && !exact && Math.min(adx, ady) > 1e-6 && Math.min(adx, ady) < 0.45 * gridStep()) {
        C = adx >= ady ? [C[0], P[1]] : [P[0], C[1]]; dx = C[0] - P[0]; dy = C[1] - P[1]; adx = Math.abs(dx); ady = Math.abs(dy);
        return [[rnd(C[0]), rnd(C[1])]];
      }
      if (S.free || adx < 1e-6 || ady < 1e-6 || Math.abs(adx - ady) < 1e-6) return [C];
      const sx = Math.sign(dx), sy = Math.sign(dy), m1 = S.cornerMode;
      let m;
      if (adx >= ady) m = m1 ? [P[0] + sx * ady, P[1] + dy] : [P[0] + dx - sx * ady, P[1]];
      else m = m1 ? [P[0] + dx, P[1] + sy * adx] : [P[0], P[1] + dy - sy * adx];
      return [[rnd(m[0]), rnd(m[1])], C];
    }

    function drawGhostPart(c, part, bad) {
      const fp = fpOf(part.fp);
      if (!fp) return;
      const xf = xfPart(part), col = LCOL[part.side === 'bot' ? 'B.Cu' : 'F.Cu'];
      c.globalAlpha = 0.65; c.fillStyle = bad ? '#ff3030' : col;
      c.beginPath();
      (fp.pads || []).forEach(function (q) { const m = xf(q.x, q.y), d = padDims(q, part.rot); padPath(c, m[0], m[1], d[0], d[1], q.shape); });
      c.fill();
      c.globalAlpha = 1;
      partSilk(c, part, part.side === 'bot' ? LCOL['B.Silk'] : LCOL['F.Silk'], R().silkWidth);
      const r = courtRect(part);
      c.strokeStyle = bad ? '#ff5050' : 'rgba(200,210,225,.8)'; c.lineWidth = 1.2 / S.k; c.setLineDash([4 / S.k, 3 / S.k]);
      c.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1]); c.setLineDash([]);
      c.fillStyle = '#3b9eff';
      c.beginPath(); c.arc(part.x, part.y, 3 / S.k, 0, TAU); c.fill();
    }
    function ghostBad(part) {
      const r = courtRect(part), b = B();
      return (b.parts || []).some(function (q) {
        const s = courtRect(q);
        return (q.side || 'top') === (part.side || 'top') && r[0] < s[2] - 0.01 && r[2] > s[0] + 0.01 && r[1] < s[3] - 0.01 && r[3] > s[1] + 0.01;
      });
    }

    function drawToolPreview(c) {
      const px = 1 / S.k;
      const cur = S.cur;
      // Fangring
      if (cur && S.curLive && S.snapKind !== 'grid') {
        c.strokeStyle = '#4cd964'; c.lineWidth = 2 * px; c.beginPath(); c.arc(cur.x, cur.y, 9 * px, 0, TAU); c.stroke();
      }
      if (S.tool === 'track' && S.trk) {
        const t = S.trk, col = LCOL[t.layer] || '#fff';
        c.lineCap = 'round'; c.lineJoin = 'round';
        const pv = trackPreview();
        const all = t.pts.slice();
        if (pv) pv.pts.slice(1).forEach(function (p) { all.push(p); });
        if (all.length > 1) {
          if (pv && pv.viol) {
            c.strokeStyle = '#ff3b30'; c.globalAlpha = 0.7; c.lineWidth = t.w + 2 * 2.2 * px * 3;
            c.beginPath(); all.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); c.globalAlpha = 1;
          }
          c.strokeStyle = col; c.globalAlpha = 0.9; c.lineWidth = t.w;
          c.beginPath(); all.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); c.globalAlpha = 1;
        }
        c.fillStyle = '#fff';
        t.pts.forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 3.5 * px, 0, TAU); c.fill(); });
      } else if (S.tool === 'zone' && S.zone) {
        const z = S.zone, col = LCOL[S.layer] || '#fff';
        c.strokeStyle = col; c.lineWidth = 2 * px; c.lineJoin = 'round';
        c.beginPath(); z.pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
        if (cur) c.lineTo(cur.x, cur.y);
        c.stroke();
        if (z.pts.length >= 3) { c.globalAlpha = 0.18; c.fillStyle = col; c.beginPath(); z.pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.fill(); c.globalAlpha = 1; }
        c.fillStyle = '#fff';
        z.pts.forEach(function (p, i) { c.beginPath(); c.arc(p[0], p[1], (i === 0 && z.pts.length >= 3 ? 7 : 3.5) * px, 0, TAU); c.fill(); });
      } else if (S.tool === 'measure' && S.meas) {
        const m = S.meas, e = m.b || (cur ? [cur.x, cur.y] : null);
        c.fillStyle = '#4cd964'; c.strokeStyle = '#4cd964'; c.lineWidth = 2 * px;
        c.beginPath(); c.arc(m.a[0], m.a[1], 4 * px, 0, TAU); c.fill();
        if (e) {
          c.beginPath(); c.moveTo(m.a[0], m.a[1]); c.lineTo(e[0], e[1]); c.stroke();
          c.beginPath(); c.arc(e[0], e[1], 4 * px, 0, TAU); c.fill();
          // Hilfsdreieck
          c.globalAlpha = 0.5; c.setLineDash([3 * px, 3 * px]); c.lineWidth = 1 * px;
          c.beginPath(); c.moveTo(m.a[0], m.a[1]); c.lineTo(e[0], m.a[1]); c.lineTo(e[0], e[1]); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
          const d = hyp(e[0] - m.a[0], e[1] - m.a[1]);
          c.font = '700 ' + (13 * px) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom';
          c.fillStyle = '#04210c'; c.strokeStyle = '#4cd964'; c.lineWidth = 4 * px;
          const tx = (m.a[0] + e[0]) / 2, ty = (m.a[1] + e[1]) / 2 - 6 * px, txt = fmt(d, 2) + ' mm';
          c.strokeText(txt, tx, ty); c.fillStyle = '#fff'; c.fillText(txt, tx, ty);
        }
      } else if (S.tool === 'place' && S.place.fp && cur && S.curLive) {
        const part = { fp: S.place.fp, x: cur.x, y: cur.y, rot: S.place.rot, side: S.place.side };
        drawGhostPart(c, part, ghostBad(part));
      } else if (S.tool === 'via' && cur && S.curLive) {
        const r = R(), dia = S.viaDia || r.viaDia;
        c.globalAlpha = 0.7; c.fillStyle = '#d8c46a'; c.beginPath(); c.arc(cur.x, cur.y, dia / 2, 0, TAU); c.fill();
        c.fillStyle = BG; c.beginPath(); c.arc(cur.x, cur.y, (S.viaDrill || r.viaDrill) / 2, 0, TAU); c.fill(); c.globalAlpha = 1;
      }
    }
    function drawMarkers(c) {
      if (!S.drcOn) return;
      let list = [];
      try { list = ctx.drc ? ctx.drc() || [] : []; } catch (e) { list = []; }
      list.forEach(function (m) {
        if (!m.at) return;
        const x = w2sx(m.at.x), y = w2sy(m.at.y);
        if (x < -20 || y < -20 || x > S.W + 20 || y > S.H + 20) return;
        const col = m.severity === 'error' ? '#ff3b30' : m.severity === 'warn' ? '#ffb340' : '#5ab0ff';
        const sel = S.drcSel === m.id;
        c.lineWidth = sel ? 3.5 : 2.2; c.strokeStyle = col; c.fillStyle = col;
        c.beginPath(); c.arc(x, y, sel ? 16 : 12, 0, TAU); c.globalAlpha = 0.18; c.fill(); c.globalAlpha = 1; c.stroke();
        c.beginPath(); c.moveTo(x - 5, y - 5); c.lineTo(x + 5, y + 5); c.moveTo(x + 5, y - 5); c.lineTo(x - 5, y + 5); c.lineWidth = 1.8; c.stroke();
      });
      if (S.flash) {
        const f = S.flash, t = (performance.now() - f.t0) / 1600;
        if (t < 1) {
          const x = w2sx(f.x), y = w2sy(f.y);
          for (let i = 0; i < 2; i++) {
            const tt = (t * 2 + i * 0.5) % 1;
            c.strokeStyle = 'rgba(255,255,255,' + (0.9 * (1 - tt)).toFixed(2) + ')'; c.lineWidth = 3;
            c.beginPath(); c.arc(x, y, 14 + tt * 50, 0, TAU); c.stroke();
          }
        }
      }
    }
    function drawCrosshair(c) {
      if (!S.cur || !S.curLive || S.tool === 'select' || S.tool === 'delete') return;
      const x = w2sx(S.cur.x), y = w2sy(S.cur.y);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x - 14, y); c.lineTo(x + 14, y); c.moveTo(x, y - 14); c.lineTo(x, y + 14); c.stroke();
    }

    function draw() {
      S.dirty = false;
      const c = cv.getContext('2d');
      if (S.v3) { draw3D(c); return; }
      c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      c.fillStyle = BG; c.fillRect(0, 0, S.W, S.H);
      if (!B()) return;
      c.save();
      c.translate(S.ox, S.oy); c.scale(S.k, S.k);
      boardBase(c);
      drawGrid(c);
      scene(c);
      if (S.court) drawCourts(c);
      if (S.rats) drawRats(c);
      drawSel(c);
      drawOutlineHandle(c);
      drawToolPreview(c);
      c.restore();
      drawMarkers(c);
      drawCrosshair(c);
      updatePos();
    }
    function updatePos() {
      posEl.textContent = (S.cur ? 'x ' + fmt(S.cur.x, 2) + '  y ' + fmt(S.cur.y, 2) + ' mm   ' : '') + Math.round(S.k * 100 / 3.78) + ' %  ' + S.layer;
    }

    // ================================================================ 3D-Ansicht (isometrisch, Canvas 2D)
    function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function shade(hex, f) { const r = hexRgb(hex); return 'rgb(' + clamp(Math.round(r[0] * f), 0, 255) + ',' + clamp(Math.round(r[1] * f), 0, 255) + ',' + clamp(Math.round(r[2] * f), 0, 255) + ')'; }
    function boardThickness() {
      try {
        const s = core().stackup(B());
        const arr = Array.isArray(s) ? s : (s.layers || s.stack || []);
        let tot = s.total || s.totalThickness || s.gesamt || 0;
        if (!tot) tot = arr.reduce(function (a, l) { return a + (l.kind === 'copper' || l.kind === 'prepreg' || l.kind === 'core' ? (l.thickness || 0) : 0); }, 0);
        if (tot > 0.3 && tot < 5) return tot;
      } catch (e) { /* Standard */ }
      return 1.6;
    }
    function bodyPoly(p) {
      const fp = fpOf(p.fp), id = String(p.fp), cr = courtRect(p);
      const cx = (cr[0] + cr[2]) / 2, cy = (cr[1] + cr[3]) / 2, w = cr[2] - cr[0], hh = cr[3] - cr[1];
      if (/^C_RADIAL|^LED_5MM/.test(id)) {
        const r = Math.max(0.5, Math.min(w, hh) / 2 - 0.15), pts = [];
        for (let i = 0; i < 20; i++) pts.push([cx + r * Math.cos(i / 20 * TAU), cy + r * Math.sin(i / 20 * TAU)]);
        return pts;
      }
      if (/^R_AXIAL/.test(id)) {
        const horiz = Math.abs(w) >= Math.abs(hh), len = Math.min(Math.max(w, hh) * 0.62, 6.4), th = 2.4;
        const a = horiz ? len : th, bb = horiz ? th : len;
        return [[cx - a / 2, cy - bb / 2], [cx + a / 2, cy - bb / 2], [cx + a / 2, cy + bb / 2], [cx - a / 2, cy + bb / 2]];
      }
      const m = fp && fp.kind === 'smd' ? 0.12 : 0.2;
      const x1 = cr[0] + m, y1 = cr[1] + m, x2 = cr[2] - m, y2 = cr[3] - m;
      if (x2 <= x1 || y2 <= y1) return [[cr[0], cr[1]], [cr[2], cr[1]], [cr[2], cr[3]], [cr[0], cr[3]]];
      return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
    }
    function cu3(c, layer, real, alpha, k) {
      const b = B(), fills = zoneFills();
      const tcol = real ? '#3cb26c' : LCOL[layer], pcol = real ? '#e0c06a' : LCOL[layer];
      c.lineCap = 'round'; c.lineJoin = 'round';
      (b.zones || []).forEach(function (z) {
        if (z.layer !== layer) return;
        const polys = fills[z.id];
        c.fillStyle = tcol; c.globalAlpha = alpha * (real ? 0.85 : 0.5);
        if (polys && polys.path) c.fill(polys.path);
        else {
          c.beginPath();
          if (polys && polys.length) polys.forEach(function (pl) { pl.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); });
          else z.poly.forEach(function (p, i) { p = pt2(p); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
          c.fill();
        }
      });
      c.globalAlpha = alpha; c.strokeStyle = tcol;
      (b.tracks || []).forEach(function (t) {
        if (t.layer !== layer) return;
        c.lineWidth = t.w || 0.25; c.beginPath(); t.pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke();
      });
      c.fillStyle = pcol;
      (b.vias || []).forEach(function (v) { if (viaOnLayer(v, layer)) { c.beginPath(); c.arc(v.x, v.y, (v.dia || 0.8) / 2, 0, TAU); c.fill(); } });
      c.beginPath();
      getPads().forEach(function (p) { if (padOnLayer(p, layer)) padPath(c, p.x, p.y, p.w, p.h, p.shape); });
      c.fill();
      c.globalAlpha = 1;
      drawHoles(c);
    }
    function draw3D(c) {
      const b = B(), cam = S.cam, W = S.W, H = S.H, dpr = S.dpr;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = '#0b0e11'; c.fillRect(0, 0, W, H);
      const yaw = cam.yaw * Math.PI / 180, pitch = cam.pitch * Math.PI / 180;
      const cs = Math.cos(yaw), sn = Math.sin(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch), k = cam.k;
      const bb = boardBox(), cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
      const cuL = cuList(), n = cuL.length, T = cam.explode ? 0.001 : boardThickness(), GAP = 6;
      const zOf = function (layer) { return cam.explode ? -cuL.indexOf(layer) * GAP : (layer === 'B.Cu' ? -T : 0); };
      const zMid = cam.explode ? -(n - 1) * GAP / 2 : -T / 2;
      function P(x, y, z) {
        const u = x - cx, v = y - cy, u2 = u * cs - v * sn, v2 = u * sn + v * cs;
        return [W / 2 + u2 * k, H / 2 + (v2 * sp - (z - zMid) * cp) * k];
      }
      function depth(x, y, z) { const u = x - cx, v = y - cy; return (u * sn + v * cs) * cp + z * sp; }
      function plane(z0, fn) {
        const a = cs * k, bq = sn * sp * k, cq = -sn * k, d = cs * sp * k;
        const e = W / 2 - (a * cx + cq * cy), f = H / 2 - (z0 - zMid) * cp * k - (bq * cx + d * cy);
        c.save(); c.setTransform(dpr * a, dpr * bq, dpr * cq, dpr * d, dpr * e, dpr * f);
        fn(); c.restore();
      }
      function polyPath(pts, z) { pts.forEach(function (p, i) { const q = P(p[0], p[1], z); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); }
      function prism(poly, z0, z1, color) {
        let ccx = 0, ccy = 0; poly.forEach(function (p) { ccx += p[0]; ccy += p[1]; }); ccx /= poly.length; ccy /= poly.length;
        const nn = poly.length;
        const faces = [];
        for (let i = 0; i < nn; i++) {
          const a = poly[i], bq = poly[(i + 1) % nn];
          let nx = bq[1] - a[1], ny = -(bq[0] - a[0]);
          const mx = (a[0] + bq[0]) / 2 - ccx, my = (a[1] + bq[1]) / 2 - ccy;
          if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
          const l = hyp(nx, ny) || 1; nx /= l; ny /= l;
          const nu = nx * cs - ny * sn, nv = nx * sn + ny * cs;
          if (nv * cp <= 1e-6) continue;
          faces.push({ a: a, b: bq, f: clamp(0.78 + 0.34 * (-nu * 0.6 + nv * 0.4), 0.4, 1.15), d: depth((a[0] + bq[0]) / 2, (a[1] + bq[1]) / 2, (z0 + z1) / 2) });
        }
        faces.sort(function (p, q) { return p.d - q.d; });
        faces.forEach(function (fc) {
          c.beginPath();
          const q1 = P(fc.a[0], fc.a[1], z1), q2 = P(fc.b[0], fc.b[1], z1), q3 = P(fc.b[0], fc.b[1], z0), q4 = P(fc.a[0], fc.a[1], z0);
          c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); c.lineTo(q3[0], q3[1]); c.lineTo(q4[0], q4[1]); c.closePath();
          c.fillStyle = shade(color, fc.f); c.fill();
          c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 0.6; c.stroke();
        });
        // Deckel (oben, wenn von oben gesehen; sonst Boden)
        const zt = sp > 0 ? Math.max(z0, z1) : Math.min(z0, z1);
        c.beginPath(); polyPath(poly, zt);
        c.fillStyle = shade(color, sp > 0 ? 1.18 : 0.8); c.fill();
        c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 0.6; c.stroke();
      }
      const items = [], labels = [];
      const outline = (b.outline && b.outline.length > 2) ? b.outline.map(pt2) : [[0, 0], [b.w, 0], [b.w, b.h], [0, b.h]];
      const real = !cam.explode;
      // Platine
      if (real) {
        const faceLayer = sp > 0 ? 'F.Cu' : 'B.Cu', silkL = sp > 0 ? 'F.Silk' : 'B.Silk', zf = sp > 0 ? 0 : -T;
        items.push({
          lvl: -T / 2, depth: 0, draw: function () {
            // Seitenflaechen
            prism(outline, -T, 0, '#b09a58');
            // Deckel mit Kupfer
            plane(zf, function () {
              outlinePath(c); c.fillStyle = '#1c6b3e'; c.fill();
              cu3(c, faceLayer, true, 1, k);
              c.save(); outlinePath(c); c.clip();
              (b.parts || []).forEach(function (p) { if ((p.side === 'bot') === (sp < 0)) partSilk(c, p, '#f0f0f0', R().silkWidth); });
              c.restore();
              c.strokeStyle = 'rgba(245,215,66,.55)'; c.lineWidth = 1 / k; outlinePath(c); c.stroke();
            });
          }
        });
      } else {
        cuL.forEach(function (l) {
          const z = zOf(l);
          items.push({
            lvl: z, depth: 0, draw: function () {
              plane(z, function () {
                outlinePath(c); c.fillStyle = 'rgba(40,110,70,.22)'; c.fill();
                cu3(c, l, false, 0.9, k);
                c.strokeStyle = LCOL[l]; c.globalAlpha = 0.6; c.lineWidth = 1.5 / k; outlinePath(c); c.stroke(); c.globalAlpha = 1;
              });
              const q = P(outline[0][0], outline[0][1], z);
              labels.push([LNAME[l] || l, q[0] + 6, q[1] - 4, LCOL[l]]);
            }
          });
        });
      }
      // Bauteile
      (b.parts || []).forEach(function (p) {
        const fp = fpOf(p.fp), bot = p.side === 'bot', hgt = bodyHeight(fp, p.fp), poly = bodyPoly(p);
        const base = bot ? zOf('B.Cu') - (real ? 0.02 : 0) : zOf('F.Cu') + 0.02, z1 = bot ? base - hgt : base + hgt;
        let ccx = 0, ccy = 0; poly.forEach(function (q) { ccx += q[0]; ccy += q[1]; }); ccx /= poly.length; ccy /= poly.length;
        const sel = S.sel && S.sel.t === 'part' && S.sel.id === p.id;
        items.push({
          lvl: bot ? zOf('B.Cu') - 0.01 - (real ? 0.01 : 0) : zOf('F.Cu') + 0.01, depth: depth(ccx, ccy, (base + z1) / 2),
          draw: function () {
            prism(poly, base, z1, partColor(p));
            if (sel) { c.strokeStyle = '#3b9eff'; c.lineWidth = 2.2; c.beginPath(); polyPath(poly, z1); c.stroke(); }
          }
        });
      });
      items.sort(function (a, b2) { return (sp > 0 ? a.lvl - b2.lvl : b2.lvl - a.lvl) || (a.depth - b2.depth); });
      items.forEach(function (it) { it.draw(); });
      c.font = '600 12px system-ui,sans-serif'; c.textAlign = 'left'; c.textBaseline = 'bottom';
      labels.forEach(function (l) { c.fillStyle = l[3]; c.fillText(l[0], l[1], l[2]); });
      c.font = '12px system-ui,sans-serif'; c.fillStyle = '#8b98a6'; c.textAlign = 'left'; c.textBaseline = 'bottom';
      c.fillText((sp > 0 ? 'Ansicht von oben' : 'Ansicht von unten') + (cam.explode ? ' · Lagen auseinandergezogen' : '') + ' · ziehen = drehen', 10, H - 40);
    }

    // ================================================================ Dialoge
    function openModal(title, body, onClose) {
      const m = h('div', { class: 'pe-modal' });
      function close() { if (m.parentNode) m.parentNode.removeChild(m); S.modal = null; if (onClose) onClose(); invalidate(); }
      const dlg = h('div', { class: 'pe-dlg' }, [
        h('header', null, [h('span', { text: title }), h('button', { class: 'pe-b flat x', text: '✕ Schließen', onclick: close })]),
        h('div', { class: 'bd' }, [body])
      ]);
      m.appendChild(dlg);
      m.addEventListener('pointerdown', function (e) { if (e.target === m) close(); });
      rootEl.appendChild(m);
      S.modal = { close: close, el: m };
      return S.modal;
    }

    // ---- Schnitt durch eine Via
    function viaLayersInfo(v) {
      const b = B(), cu = cuList(), sp = viaSpan(v), out = {};
      const r = (v.dia || 0.8) / 2;
      cu.forEach(function (l, i) {
        const o = { on: i >= sp[0] && i <= sp[1], conn: false, why: '' };
        if (!o.on) { out[l] = o; return; }
        (b.zones || []).forEach(function (z) {
          if (z.layer === l && z.net && z.net === v.net && ptInPoly(v.x, v.y, z.poly)) { o.conn = true; o.why = 'Fläche ' + z.net; }
        });
        (b.tracks || []).forEach(function (t) {
          if (t.layer !== l || o.conn) return;
          for (let j = 1; j < t.pts.length; j++) if (distPtSeg(v.x, v.y, t.pts[j - 1][0], t.pts[j - 1][1], t.pts[j][0], t.pts[j][1]) <= r + (t.w || 0.2) / 2) { o.conn = true; o.why = 'Bahn'; return; }
        });
        getPads().forEach(function (p) { if (!o.conn && padOnLayer(p, l) && hyp(p.x - v.x, p.y - v.y) <= r + Math.max(p.w, p.h) / 2) { o.conn = true; o.why = 'Pad ' + p.ref + '.' + p.n; } });
        const hasZone = (b.zones || []).some(function (z) { return z.layer === l; });
        o.plane = hasZone && !o.conn;
        out[l] = o;
      });
      return out;
    }
    function showXsec(v) {
      const C = core();
      let stk = [];
      try { const s = C.stackup(B()); stk = Array.isArray(s) ? s : (s.layers || s.stack || []); } catch (e) { stk = []; }
      if (!stk.length) { toast('Der Lagenaufbau ist nicht verfügbar.'); return; }
      const info = viaLayersInfo(v), cu = cuList();
      const cw = 430, ch = 330, can = h('canvas', { style: 'width:' + cw + 'px;max-width:100%;height:auto;background:#10151a;border-radius:10px;display:block;margin:0 auto' });
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      can.width = cw * dpr; can.height = ch * dpr;
      const g = can.getContext('2d'); g.scale(dpr, dpr);
      const total = stk.reduce(function (a, l) { return a + (l.thickness || 0); }, 0) || 1.6;
      const x0 = 16, wLay = 190, top = 14, availH = ch - 28;
      // Hoehen: Wurzel-Skalierung, damit Kupfer sichtbar bleibt
      const hs = stk.map(function (l) { return Math.max(l.kind === 'copper' ? 7 : l.kind === 'mask' || l.kind === 'silk' ? 5 : 10, Math.sqrt(l.thickness || 0.03) * 1000); });
      const sum = hs.reduce(function (a, b2) { return a + b2; }, 0), f = availH / sum;
      const KC = { copper: '#c88a3c', prepreg: '#7fae6a', core: '#9bbd7a', mask: '#1f7a46', silk: '#e8e8e8' };
      const cx = x0 + wLay / 2, barrel = Math.max(10, (v.dia || 0.8) * 40), hole = Math.max(4, (v.drill || 0.4) * 40);
      let y = top;
      const sp = viaSpan(v);
      let firstY = null, lastY = null;
      const ys = [];
      stk.forEach(function (l, i) {
        const hh = hs[i] * f;
        ys.push([y, hh]);
        g.fillStyle = KC[l.kind] || '#777'; g.fillRect(x0, y, wLay, hh);
        if (l.kind === 'copper') {
          const idx = cu.indexOf(l.id || l.name);
          const li = idx >= 0 ? info[cu[idx]] : null;
          g.fillStyle = idx >= 0 ? LCOL[cu[idx]] : '#c88a3c'; g.fillRect(x0, y, wLay, hh);
          if (li && li.on) {
            if (!li.conn) { // Lagen ohne Anschluss: nur Restring, Rest der Flaeche mit Freistellung
              g.fillStyle = '#10151a'; g.fillRect(x0 + 2, y, wLay - 4, hh);
              g.fillStyle = LCOL[cu[idx]];
              g.fillRect(cx - barrel / 2 - 6, y, 12 + barrel, hh);
              if (li.plane) { g.fillStyle = LCOL[cu[idx]]; g.fillRect(x0, y, cx - barrel / 2 - 14 - x0, hh); g.fillRect(cx + barrel / 2 + 14, y, x0 + wLay - (cx + barrel / 2 + 14), hh); }
            }
          } else if (li && !li.on) { g.globalAlpha = 0.9; }
          g.globalAlpha = 1;
          if (li && li.on) { if (firstY == null) firstY = y; lastY = y + hh; }
        }
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.6; g.strokeRect(x0, y, wLay, hh);
        y += hh;
      });
      // Huelse
      if (firstY != null) {
        g.fillStyle = '#e0c06a'; g.fillRect(cx - hole / 2 - 3, firstY, 3, lastY - firstY); g.fillRect(cx + hole / 2, firstY, 3, lastY - firstY);
        g.fillStyle = '#10151a'; g.fillRect(cx - hole / 2, top, hole, availH);
        // Bohrung ueberall dunkel (durchgehend), Huelse nochmals darueber
        g.fillStyle = '#e0c06a'; g.fillRect(cx - hole / 2 - 3, firstY, 3, lastY - firstY); g.fillRect(cx + hole / 2, firstY, 3, lastY - firstY);
      }
      // Beschriftungen
      g.font = '600 11px system-ui,sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
      stk.forEach(function (l, i) {
        if (l.kind === 'silk') return;
        const yy = ys[i][0] + ys[i][1] / 2;
        g.fillStyle = '#c8d2dc';
        const tx = (l.name || l.id || l.kind) + ' · ' + Math.round((l.thickness || 0) * 1000) + ' µm';
        g.fillText(tx, x0 + wLay + 10, yy);
      });
      const list = h('div', { style: 'margin-top:8px' });
      const kon = cu.filter(function (l) { return info[l].on && info[l].conn; });
      list.appendChild(h('p', { class: 'pe-p', html: '<b>Via ' + (v.net ? 'Netz ' + v.net : 'ohne Netz') + '</b> · Pad ' + fmt(v.dia || 0.8, 2) + ' mm · Bohrung ' + fmt(v.drill || 0.4, 2) + ' mm · Restring ' + fmt(((v.dia || 0.8) - (v.drill || 0.4)) / 2, 3) + ' mm' }));
      list.appendChild(h('p', { class: 'pe-p', html: 'Verbindet: <b>' + (kon.length ? kon.map(function (l) { return l + (info[l].why ? ' (' + info[l].why + ')' : ''); }).join(', ') : 'keine Lage (nur Hülse)') + '</b>' }));
      const nf = cu.filter(function (l) { return info[l].on && !info[l].conn; });
      if (nf.length) list.appendChild(h('p', { class: 'pe-p', text: 'Ohne Anschluss durchlaufen: ' + nf.join(', ') + (nf.some(function (l) { return info[l].plane; }) ? ' (Freistellung um die Hülse in Flächen anderer Netze)' : '') + '.' }));
      list.appendChild(h('p', { class: 'pe-p', text: 'Aspektverhältnis (Platinendicke : Bohrung) ca. ' + fmt(total / (v.drill || 0.4), 1) + ' : 1. Die Hülse ist innen verkupfert; sie verbindet die Lagen elektrisch.' }));
      openModal('Schnitt durch die Via', h('div', null, [can, list]));
    }

    // ---- Footprint-Auswahl
    function fpThumb(fp, w, hh) {
      const can = h('canvas', { width: w * 2, height: hh * 2, style: 'width:' + w + 'px;height:' + hh + 'px' });
      const g = can.getContext('2d');
      let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
      (fp.pads || []).forEach(function (p) { x1 = Math.min(x1, p.x - p.w / 2); y1 = Math.min(y1, p.y - p.h / 2); x2 = Math.max(x2, p.x + p.w / 2); y2 = Math.max(y2, p.y + p.h / 2); });
      if (fp.courtyard) { x1 = Math.min(x1, fp.courtyard.x); y1 = Math.min(y1, fp.courtyard.y); x2 = Math.max(x2, fp.courtyard.x + fp.courtyard.w); y2 = Math.max(y2, fp.courtyard.y + fp.courtyard.h); }
      if (!isFinite(x1)) return can;
      const k = Math.min((w * 2 - 8) / Math.max(0.5, x2 - x1), (hh * 2 - 8) / Math.max(0.5, y2 - y1));
      g.translate(w - (x1 + x2) / 2 * k, hh - (y1 + y2) / 2 * k); g.scale(k, k);
      g.strokeStyle = '#ffe14d'; g.lineWidth = 0.12; g.lineCap = 'round';
      g.beginPath();
      (fp.silk || []).forEach(function (s) {
        if (s.t === 'line') { g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); }
        else if (s.t === 'rect') g.rect(s.x, s.y, s.w, s.h);
        else if (s.t === 'circle') { g.moveTo(s.x + s.r, s.y); g.arc(s.x, s.y, s.r, 0, TAU); }
      });
      g.stroke();
      g.fillStyle = '#c83434'; g.beginPath();
      (fp.pads || []).forEach(function (p) { padPath(g, p.x, p.y, p.w, p.h, p.shape); });
      g.fill();
      g.fillStyle = '#0d1013'; g.beginPath();
      (fp.pads || []).forEach(function (p) { if (p.drill) { g.moveTo(p.x + p.drill / 2, p.y); g.arc(p.x, p.y, p.drill / 2, 0, TAU); } });
      g.fill();
      return can;
    }
    function missingRefs() {
      const have = {}; (B().parts || []).forEach(function (p) { have[p.ref] = true; });
      const miss = {};
      netsOf().forEach(function (n) { (n.pins || []).forEach(function (pin) { const r = String(pin).split('.')[0]; if (r && !have[r]) miss[r] = true; }); });
      return Object.keys(miss).sort(function (a, b2) {
        const ma = /^([A-Za-z]+)(\d+)/.exec(a), mb = /^([A-Za-z]+)(\d+)/.exec(b2);
        if (ma && mb && ma[1] === mb[1]) return +ma[2] - +mb[2];
        return a < b2 ? -1 : 1;
      });
    }
    function suggestRef(prefix) {
      const used = {}; (B().parts || []).forEach(function (p) { used[p.ref] = true; });
      const miss = missingRefs().filter(function (r) { return new RegExp('^' + prefix + '\\d+$').test(r); });
      if (miss.length) return miss[0];
      let mx = 0;
      Object.keys(used).forEach(function (r) { const m = new RegExp('^' + prefix + '(\\d+)$').exec(r); if (m) mx = Math.max(mx, +m[1]); });
      return prefix + (mx + 1);
    }
    function chooseFp(id) {
      const fp = fpOf(id);
      if (!fp) return;
      const prefix = prefixFor(id);
      S.place.fp = id;
      if (!S.place.ref || S.place.refAuto !== false || new RegExp('^' + prefix).test(S.place.ref) === false) S.place.ref = suggestRef(prefix);
      S.place.value = defaultValue(id, prefix);
      S.place.refAuto = true;
      S.tool = 'place';
      buildOpts(); buildTools(); invalidate();
    }
    function showFpDialog() {
      const C = core(), all = Object.keys(C.footprints || {}).map(function (id) { return C.footprints[id]; });
      const body = h('div');
      const q = h('input', { class: 'pe-in', style: 'width:100%;margin-bottom:8px', placeholder: 'Suchen (z. B. 0603, DIP, LED)…', type: 'search' });
      const chips = h('div', { class: 'pe-btns' });
      const miss = missingRefs();
      const missEl = h('div', { class: 'pe-p' });
      const listEl = h('div');
      body.appendChild(q);
      if (miss.length) {
        missEl.appendChild(document.createTextNode('Aus der Netzliste fehlen noch: '));
        miss.slice(0, 24).forEach(function (r) {
          missEl.appendChild(h('button', {
            class: 'pe-b flat', style: 'height:34px;min-width:0;padding:0 10px;margin:2px', text: r,
            onclick: function () { S.place.ref = r; S.place.refAuto = false; toast('Referenz ' + r + ' gewählt – jetzt Bauteilform wählen.'); }
          }));
        });
        body.appendChild(missEl);
      }
      [['all', 'Alle'], ['tht', 'Bedrahtet (THT)'], ['smd', 'SMD']].forEach(function (f) {
        const b2 = h('button', { class: 'pe-b flat' + (S.fpFilter === f[0] ? ' on' : ''), text: f[1], onclick: function () { S.fpFilter = f[0]; Array.prototype.forEach.call(chips.children, function (x, i) { x.classList.toggle('on', ['all', 'tht', 'smd'][i] === S.fpFilter); }); fill(); } });
        chips.appendChild(b2);
      });
      body.appendChild(chips); body.appendChild(listEl);
      const modal = openModal('Bauteilform wählen', body);
      function fill() {
        const t = q.value.trim().toLowerCase();
        listEl.innerHTML = '';
        all.filter(function (fp) {
          if (S.fpFilter !== 'all' && fp.kind !== S.fpFilter) return false;
          return !t || (fp.id + ' ' + (fp.name || '') + ' ' + (fp.desc || '')).toLowerCase().indexOf(t) >= 0;
        }).forEach(function (fp) {
          listEl.appendChild(h('div', {
            class: 'pe-fpl' + (S.place.fp === fp.id ? ' on' : ''), onclick: function () { chooseFp(fp.id); modal.close(); }
          }, [fpThumb(fp, 72, 44), h('div', null, [h('div', { class: 't', text: (fp.name || fp.id) + (fp.kind ? ' · ' + (fp.kind === 'smd' ? 'SMD' : 'THT') : '') }), h('div', { class: 'd', text: fp.desc || '' })])]));
        });
        if (!listEl.children.length) listEl.appendChild(h('p', { class: 'pe-p', text: 'Keine Bauteilform gefunden.' }));
      }
      q.addEventListener('input', fill);
      fill();
      setTimeout(function () { try { q.focus(); } catch (e) { /* egal */ } }, 50);
    }

    // ================================================================ Treffer, Aktionen
    function drcList() { try { return ctx.drc ? ctx.drc() || [] : []; } catch (e) { return []; } }
    function pickAt(sx, sy, o) {
      o = o || {};
      const wx = s2wx(sx), wy = s2wy(sy), tol = 9 / S.k, b = B(), del = o.mode === 'delete';
      if (!del && !o.noMarkers && S.drcOn) {
        const L = drcList();
        for (let i = L.length - 1; i >= 0; i--) {
          const m = L[i];
          if (m.at && hyp(w2sx(m.at.x) - sx, w2sy(m.at.y) - sy) <= 12) return { t: 'marker', m: m };
        }
      }
      let best = null, bs = 1e9;
      (b.vias || []).forEach(function (v) {
        if (!visibleVia(v)) return;
        const d = hyp(v.x - wx, v.y - wy) - (v.dia || 0.8) / 2;
        if (d <= tol && d < bs) { bs = d; best = { t: 'via', id: v.id }; }
      });
      if (best && !del) return best;
      const padHit = (function () {
        let pb = null, pd = 1e9;
        getPads().forEach(function (p) {
          if (p.layers && !p.layers.some(visible)) return;
          let d = distPtRect(wx, wy, padRect(p));
          if (p.shape === 'round') d = Math.max(0, hyp(p.x - wx, p.y - wy) - Math.min(p.w, p.h) / 2);
          if (d <= tol) { const sc = d + (padOnLayer(p, S.layer) ? 0 : tol * 2); if (sc < pd) { pd = sc; pb = p; } }
        });
        return pb;
      })();
      let trk = null, ts = 1e9;
      (b.tracks || []).forEach(function (t) {
        if (!visible(t.layer)) return;
        for (let i = 1; i < t.pts.length; i++) {
          const d = distPtSeg(wx, wy, t.pts[i - 1][0], t.pts[i - 1][1], t.pts[i][0], t.pts[i][1]) - (t.w || 0.25) / 2;
          if (d <= tol) { const sc = d + (t.layer === S.layer ? 0 : tol * 2); if (sc < ts) { ts = sc; trk = { t: 'track', id: t.id, seg: i - 1 }; } }
        }
      });
      if (del) {
        if (best) return best;
        if (trk) return trk;
      } else {
        if (padHit) { const part = partOfPad(padHit); if (part) return { t: 'pad', pad: padHit, part: part }; }
        if (trk) return trk;
      }
      // Texte
      let txt = null;
      (b.texts || []).forEach(function (t) {
        if (!visible(t.layer)) return;
        const w = (t.text || '').length * (t.size || 1) * 0.6 / 2 + tol, hh = (t.size || 1) / 2 + tol;
        if (Math.abs(wx - t.x) <= w && Math.abs(wy - t.y) <= hh) txt = { t: 'text', id: t.id };
      });
      if (txt) return txt;
      // Bauteile (Pad -> Bauteil beim Loeschen, Koerper)
      let pt = null, pa = 1e9;
      (b.parts || []).forEach(function (p) {
        const r = courtRect(p);
        if (wx >= r[0] - tol / 2 && wx <= r[2] + tol / 2 && wy >= r[1] - tol / 2 && wy <= r[3] + tol / 2) {
          const a = (r[2] - r[0]) * (r[3] - r[1]);
          if (a < pa) { pa = a; pt = { t: 'part', id: p.id }; }
        }
      });
      if (pt) return pt;
      if (padHit && del) { const pp = partOfPad(padHit); if (pp) return { t: 'part', id: pp.id }; }
      let zn = null;
      (b.zones || []).forEach(function (z) {
        if (!visible(z.layer) || !ptInPoly(wx, wy, z.poly)) return;
        if (!zn || z.layer === S.layer) zn = { t: 'zone', id: z.id };
      });
      return zn;
    }

    function cancelDrag() {
      const d = S.drag;
      if (d && d.started && d.pre) { replaceBoard(d.pre); S.rev++; }
      S.drag = null;
    }
    function cancelOps() {
      cancelDrag();
      S.trk = null; S.zone = null; S.meas = null;
      buildFab(); invalidate();
    }

    function selectTap(sx, sy) {
      const hit = pickAt(sx, sy);
      if (!hit) { S.sel = null; S.hiNet = null; S.drcSel = null; setHint(''); renderSide(); invalidate(); return; }
      if (hit.t === 'marker') {
        S.drcSel = hit.m.id; S.tab = 'drc'; buildTabs();
        setHint(hit.m.msg || 'DRC-Meldung', hit.m.severity === 'error' ? 'bad' : 'warn');
        const first = (hit.m.items || [])[0];
        if (first != null) selectById(first);
        renderSide(); invalidate(); return;
      }
      S.drcSel = null;
      if (hit.t === 'pad') {
        const same = S.sel && S.sel.t === 'part' && S.sel.id === hit.part.id && S.hiNet === hit.pad.net;
        S.sel = { t: 'part', id: hit.part.id };
        S.hiNet = same || !hit.pad.net ? null : hit.pad.net;
        setHint('Pad ' + hit.part.ref + '.' + hit.pad.n + (hit.pad.net ? ' · Netz ' + hit.pad.net : ' · kein Netz'));
      } else {
        S.sel = { t: hit.t, id: hit.id };
        const it = getItem(S.sel);
        S.hiNet = it && it.net ? it.net : null;
        setHint(describe(S.sel));
      }
      renderSide(); invalidate();
    }
    function selectById(id) {
      const b = B();
      const kinds = [['parts', 'part'], ['tracks', 'track'], ['vias', 'via'], ['zones', 'zone'], ['texts', 'text']];
      for (let i = 0; i < kinds.length; i++) { const it = byId(b[kinds[i][0]], id); if (it) { S.sel = { t: kinds[i][1], id: id }; if (it.net) S.hiNet = it.net; return true; } }
      if (typeof id === 'string' && id.indexOf('.') > 0) {   // Pad-Id wie 'R1.2' -> Bauteil
        const ref = id.split('.')[0], pt = (b.parts || []).filter(function (q) { return q.ref === ref; })[0];
        if (pt) { S.sel = { t: 'part', id: pt.id }; const pd = getPads().filter(function (q) { return q.id === id; })[0]; if (pd && pd.net) S.hiNet = pd.net; return true; }
      }
      return false;
    }
    function describe(sel) {
      const it = getItem(sel);
      if (!it) return '';
      if (sel.t === 'part') return 'Bauteil ' + it.ref + ' · ' + it.fp + (it.value ? ' · ' + it.value : '') + (it.locked ? ' · gesperrt' : '');
      if (sel.t === 'track') return 'Leiterbahn ' + (it.net || 'ohne Netz') + ' · ' + it.layer + ' · ' + fmt(it.w, 2) + ' mm · ' + fmt(polyLen(it.pts), 1) + ' mm lang';
      if (sel.t === 'via') return 'Via ' + (it.net || 'ohne Netz') + ' · Pad ' + fmt(it.dia, 2) + ' / Bohrung ' + fmt(it.drill, 2) + ' mm';
      if (sel.t === 'zone') return 'Kupferfläche ' + (it.net || 'ohne Netz') + ' · ' + it.layer;
      return 'Text „' + (it.text || '') + '“';
    }

    // ---- Bauteil
    function placePartAt(cur) {
      if (!guard()) return;
      const pl = S.place;
      if (!pl.fp) { showFpDialog(); return; }
      const prefix = prefixFor(pl.fp), id = newId('p');
      const part = { id: id, ref: pl.ref || suggestRef(prefix), fp: pl.fp, value: pl.value || '', x: cur.x, y: cur.y, rot: pl.rot, side: pl.side };
      const bad = ghostBad(part);
      edit(function () { const b = B(); b.parts = b.parts || []; b.parts.push(part); });
      S.sel = { t: 'part', id: id };
      pl.ref = suggestRef(prefix); pl.refAuto = true; pl.value = pl.value || defaultValue(pl.fp, prefix);
      buildOpts();
      fx('click', S.W / 2, S.H / 2);
      setHint('Bauteil ' + part.ref + ' gesetzt.' + (bad ? ' Achtung: überlappt mit einem anderen Bauteil.' : ''), bad ? 'warn' : '');
    }
    function rotateSel(dir) {
      dir = dir || 1;
      if (S.tool === 'place' && !S.sel) { S.place.rot = nrot(S.place.rot + 90 * dir); buildOpts(); invalidate(); return; }
      if (!S.sel) { if (S.tool === 'place') { S.place.rot = nrot(S.place.rot + 90 * dir); buildOpts(); invalidate(); } return; }
      if (S.sel.t !== 'part') { toast('Drehen geht nur bei Bauteilen.'); return; }
      const p = getItem(S.sel);
      if (!p || !guard()) return;
      if (isLocked(p)) { toast('Dieses Bauteil ist gesperrt.'); return; }
      edit(function () { p.rot = nrot((p.rot || 0) + 90 * dir); });
    }
    function flipSel() {
      if (S.tool === 'place' && !S.sel) { S.place.side = S.place.side === 'bot' ? 'top' : 'bot'; buildOpts(); invalidate(); return; }
      if (!S.sel || S.sel.t !== 'part') { toast('Wähle ein Bauteil, das du auf die andere Seite spiegeln willst.'); return; }
      const p = getItem(S.sel);
      if (!p || !guard()) return;
      if (isLocked(p)) { toast('Dieses Bauteil ist gesperrt.'); return; }
      edit(function () { p.side = p.side === 'bot' ? 'top' : 'bot'; });
      setHint('Bauteil ' + p.ref + ' liegt jetzt auf der ' + (p.side === 'bot' ? 'Unterseite' : 'Oberseite') + '.');
      fx('boing');
    }

    // ---- Bahn
    function dedupe(pts) {
      const o = [];
      pts.forEach(function (p) { const l = o[o.length - 1]; if (!l || hyp(l[0] - p[0], l[1] - p[1]) > 1e-6) o.push([p[0], p[1]]); });
      return o;
    }
    function trackStatus() {
      const t = S.trk;
      if (!t) return;
      const pv = trackPreview();
      let msg = 'Bahn auf ' + t.layer + ' · ' + (t.net ? 'Netz ' + t.net : 'noch kein Netz') + ' · ' + fmt(t.w, 2) + ' mm';
      let cls = '';
      const need = needWidth(t.net, t.layer);
      if (need && t.w < need - 0.005) { msg = 'Für ' + fmt(netObj(t.net).current, 1) + ' A braucht ' + t.net + ' mindestens ' + fmt(need, 2) + ' mm (IPC-2221), die Bahn ist nur ' + fmt(t.w, 2) + ' mm breit.'; cls = 'warn'; }
      if (pv && pv.viol) { msg = 'Zu eng: nur ' + fmt(Math.max(0, pv.viol.gap), 2) + ' mm zu ' + pv.viol.what + ', gefordert ' + fmt(pv.viol.need, 2) + ' mm.'; cls = 'bad'; }
      setHint(msg, cls);
    }
    function trackTap(dbl) {
      if (!guard()) return;
      const cur = S.cur;
      if (!cur) return;
      if (!S.trk) {
        if (cur.kind === 'pad' && !padOnLayer(cur.pad, S.layer)) { toast('Dieses Pad liegt nicht auf ' + S.layer + '. Wechsle die Lage oder starte an einer Via.'); return; }
        if (!isCu(S.layer)) { toast('Wähle zuerst eine Kupferlage.'); return; }
        const net = cur.net || '';
        S.trk = { layer: S.layer, net: net, w: curWidth(net, S.layer), pts: [[cur.x, cur.y]] };
        trackStatus(); buildFab(); invalidate();
        return;
      }
      const t = S.trk;
      if (dbl) { trackVia(); return; }
      const last = t.pts[t.pts.length - 1];
      const add = routePts(last, [cur.x, cur.y], cur.kind !== 'grid');
      if (!add.length) return;
      add.forEach(function (p) { t.pts.push(p); });
      if (!t.net && cur.net) { t.net = cur.net; if (S.trackW === 'auto') t.w = autoWidth(t.net, t.layer); }
      if (cur.kind === 'pad' && !padOnLayer(cur.pad, t.layer)) { toast('Achtung: Dieses Pad liegt auf der anderen Lage.'); }
      else if (cur.kind === 'pad' || cur.kind === 'via') {
        if (!cur.net || cur.net === t.net) { finishTrack(); return; }
        toast('Achtung: Dieses Pad gehört zu Netz ' + cur.net + ' – das wäre ein Kurzschluss mit ' + (t.net || 'der Bahn') + '.');
        fx('zap');
      }
      trackStatus(); buildFab(); invalidate();
    }
    function finishTrack() {
      const t = S.trk;
      S.trk = null;
      buildFab();
      if (!t) return;
      const pts = dedupe(t.pts);
      if (pts.length < 2) { invalidate(); return; }
      edit(function () { const b = B(); b.tracks = b.tracks || []; b.tracks.push({ id: newId('t'), layer: t.layer, net: t.net || '', w: t.w, pts: pts }); });
      setHint('Leiterbahn gesetzt (' + fmt(polyLen(pts), 1) + ' mm).');
      fx('click');
    }
    function trackVia(toLayer) {
      const t = S.trk;
      if (!t || !guard()) return;
      const cu = cuList();
      let to = toLayer;
      if (!to) to = t.layer === 'F.Cu' ? 'B.Cu' : 'F.Cu';
      if (to === t.layer || cu.indexOf(to) < 0) return;
      const pts = t.pts.slice(), last = pts[pts.length - 1];
      if (S.mouse && S.curLive && S.cur && hyp(S.cur.x - last[0], S.cur.y - last[1]) > 1e-6) routePts(last, [S.cur.x, S.cur.y], S.cur.kind !== 'grid').forEach(function (p) { pts.push(p); });
      const e = pts[pts.length - 1], r = R();
      const dia = S.viaDia || r.viaDia, dr = Math.min(S.viaDrill || r.viaDrill, dia - 0.1);
      edit(function () {
        const b = B();
        b.tracks = b.tracks || []; b.vias = b.vias || [];
        const dp = dedupe(pts);
        if (dp.length >= 2) b.tracks.push({ id: newId('t'), layer: t.layer, net: t.net || '', w: t.w, pts: dp });
        if (!b.vias.some(function (v) { return hyp(v.x - e[0], v.y - e[1]) < 0.01; })) b.vias.push({ id: newId('v'), x: e[0], y: e[1], net: t.net || '', dia: dia, drill: dr, from: 'F.Cu', to: 'B.Cu' });
      });
      S.layer = to;
      S.trk = { layer: to, net: t.net, w: curWidth(t.net, to), pts: [[e[0], e[1]]] };
      buildLayers(); trackStatus(); buildFab(); invalidate();
      fx('click');
      toast('Via gesetzt – weiter auf ' + to + '.');
    }
    function trackBack() {
      const t = S.trk;
      if (!t) return;
      t.pts.pop();
      if (!t.pts.length) S.trk = null;
      trackStatus(); buildFab(); invalidate();
    }

    // ---- Via, Flaeche, Text, Messen, Loeschen
    function placeViaAt(cur) {
      if (!guard()) return;
      if (cur.kind === 'via') { S.sel = { t: 'via', id: cur.via.id }; renderSide(); invalidate(); setHint(describe(S.sel)); return; }
      const r = R(), dia = S.viaDia || r.viaDia, dr = Math.min(S.viaDrill || r.viaDrill, dia - 0.1), id = newId('v');
      const net = S.viaNet || cur.net || '';
      edit(function () { const b = B(); b.vias = b.vias || []; b.vias.push({ id: id, x: cur.x, y: cur.y, net: net, dia: dia, drill: dr, from: 'F.Cu', to: 'B.Cu' }); });
      S.sel = { t: 'via', id: id };
      setHint('Via ' + (net ? 'im Netz ' + net : 'ohne Netz') + ' gesetzt. Im Eigenschaften-Reiter zeigt „Schnitt“ den Aufbau.');
      fx('click');
    }
    function zoneTap(cur) {
      if (!guard()) return;
      const z = S.zone || (S.zone = { pts: [] });
      const g = gsnap(cur.x, cur.y);
      if (z.pts.length >= 3 && hyp(w2sx(g[0]) - w2sx(z.pts[0][0]), w2sy(g[1]) - w2sy(z.pts[0][1])) < 16) { finishZone(); return; }
      const l = z.pts[z.pts.length - 1];
      if (l && hyp(l[0] - g[0], l[1] - g[1]) < 1e-6) return;
      z.pts.push(g);
      setHint('Fläche: ' + z.pts.length + ' Ecken. Zum Schließen auf die erste Ecke tippen oder „Fertig“.');
      buildFab(); invalidate();
    }
    async function askNet(title) {
      const nets = netsOf().map(function (n) { return n.name; });
      nets.sort(function (a, b2) { const ga = /gnd|masse/i.test(a) ? 0 : 1, gb = /gnd|masse/i.test(b2) ? 0 : 1; return ga - gb || (a < b2 ? -1 : 1); });
      if (!nets.length) return '';
      if (!ctx.pick) return nets[0];
      const v = await ctx.pick(title, nets.map(function (n) { return { value: n, label: n }; }).concat([{ value: '', label: '(kein Netz)' }]));
      return v;
    }
    async function finishZone(poly, netName) {
      const z = S.zone;
      poly = poly || (z && z.pts);
      if (!poly || poly.length < 3) { S.zone = null; buildFab(); invalidate(); return; }
      if (!guard()) return;
      let net = netName !== undefined ? netName : S.zoneNet;
      if (net === '' || net == null) {
        net = await askNet('Zu welchem Netz gehört die Kupferfläche?');
        if (net == null) { return; }
      }
      const r = R(), id = newId('z'), layer = S.layer;
      S.zone = null;
      edit(function () { const b = B(); b.zones = b.zones || []; b.zones.push({ id: id, layer: layer, net: net, poly: poly.map(function (p) { return [p[0], p[1]]; }), clearance: Math.max(r.clearance, 0.3), thermals: true }); });
      S.sel = { t: 'zone', id: id }; S.hiNet = net || null;
      buildFab(); renderSide();
      setHint('Kupferfläche ' + (net ? net : '(ohne Netz)') + ' auf ' + layer + ' angelegt.');
      fx('click');
    }
    function zoneWholeBoard() {
      if (!guard()) return;
      const bb = boardBox(), m = Math.max(R().edge, 0.3);
      finishZone([[bb[0] + m, bb[1] + m], [bb[2] - m, bb[1] + m], [bb[2] - m, bb[3] - m], [bb[0] + m, bb[3] - m]]);
    }
    async function textTap(cur) {
      if (!guard()) return;
      const layer = S.layer === 'B.Cu' ? 'B.Silk' : 'F.Silk';
      let r = null;
      try { r = ctx.ask ? await ctx.ask('Text auf ' + (layer === 'B.Silk' ? 'Unterseite' : 'Oberseite'), [{ key: 'text', label: 'Text', type: 'text', value: '' }, { key: 'size', label: 'Höhe (mm)', type: 'number', value: 1 }]) : null; } catch (e) { r = null; }
      if (!r || !String(r.text || '').trim()) return;
      const size = clamp(num(r.size, 1), 0.5, 10), id = newId('x');
      edit(function () { const b = B(); b.texts = b.texts || []; b.texts.push({ id: id, layer: layer, x: cur.x, y: cur.y, size: size, text: String(r.text).trim() }); });
      S.sel = { t: 'text', id: id };
    }
    function measureTap(cur) {
      const p = [cur.x, cur.y];
      if (!S.meas || S.meas.b) { S.meas = { a: p, b: null }; setHint('Messen: zweiten Punkt antippen.'); }
      else {
        S.meas.b = p;
        const dx = p[0] - S.meas.a[0], dy = p[1] - S.meas.a[1];
        setHint('Abstand ' + fmt(hyp(dx, dy), 3) + ' mm · Δx ' + fmt(dx, 2) + ' · Δy ' + fmt(dy, 2) + ' · Winkel ' + fmt((deg(Math.atan2(-dy, dx)) + 360) % 360, 1) + '°');
      }
      invalidate();
    }
    function deleteHit(hit) {
      if (!hit || !guard()) return;
      const b = B();
      if (hit.t === 'part' || hit.t === 'pad') {
        const p = hit.t === 'pad' ? hit.part : byId(b.parts, hit.id);
        if (!p) return;
        if (isLocked(p)) { toast('Dieses Bauteil ist gesperrt und kann nicht gelöscht werden.'); return; }
        edit(function () { b.parts = b.parts.filter(function (q) { return q.id !== p.id; }); });
        setHint('Bauteil ' + p.ref + ' gelöscht.');
      } else if (hit.t === 'via') edit(function () { b.vias = b.vias.filter(function (q) { return q.id !== hit.id; }); });
      else if (hit.t === 'text') edit(function () { b.texts = b.texts.filter(function (q) { return q.id !== hit.id; }); });
      else if (hit.t === 'zone') edit(function () { b.zones = b.zones.filter(function (q) { return q.id !== hit.id; }); });
      else if (hit.t === 'track') {
        const t = byId(b.tracks, hit.id);
        if (!t) return;
        edit(function () {
          const i = hit.seg == null ? -1 : hit.seg, out = [];
          b.tracks = b.tracks.filter(function (q) { return q.id !== t.id; });
          if (i >= 0) {
            const a = t.pts.slice(0, i + 1), c2 = t.pts.slice(i + 1);
            if (a.length >= 2) b.tracks.push({ id: newId('t'), layer: t.layer, net: t.net, w: t.w, pts: a });
            if (c2.length >= 2) b.tracks.push({ id: newId('t'), layer: t.layer, net: t.net, w: t.w, pts: c2 });
          }
          return out;
        });
        setHint('Bahnstück gelöscht.');
      }
      S.sel = null; renderSide();
      fx('fizz');
    }
    function deleteSel() {
      if (!S.sel) return;
      const it = getItem(S.sel);
      if (!it) return;
      deleteHit({ t: S.sel.t, id: S.sel.id, seg: null });
    }

    // ---- Auto-Weg
    async function runAutoroute() {
      if (!guard()) return;
      const C = core();
      if (!C || !C.autoroute) { toast('Der Auto-Weg ist nicht verfügbar.'); return; }
      const cn = getConn(), open = [];
      ((cn && cn.unrouted) || []).forEach(function (u) { if (open.indexOf(u.net) < 0) open.push(u.net); });
      let nets = Object.keys(S.arNets).filter(function (k) { return S.arNets[k]; });
      if (!nets.length && S.hiNet && open.indexOf(S.hiNet) >= 0) nets = [S.hiNet];
      if (!nets.length) {
        if (!open.length) { toast('Alle Netze sind schon verbunden.'); return; }
        const v = await ctx.pick('Auto-Weg: welche Netze sollen verlegt werden?', [{ value: '*', label: 'Alle offenen Netze (' + open.length + ')' }].concat(open.map(function (n) { return { value: n, label: n }; })));
        if (v == null) return;
        nets = v === '*' ? open : [v];
      }
      toast('Auto-Weg rechnet …');
      await new Promise(function (r) { setTimeout(r, 40); });
      let res;
      try { res = C.autoroute(B(), { nets: nets, layers: cuList(), viaCost: 10 }); } catch (e) { toast('Der Auto-Weg ist fehlgeschlagen: ' + (e && e.message)); return; }
      if (!res || !res.board) { toast('Der Auto-Weg hat kein Ergebnis geliefert.'); return; }
      const pre = snapStr();
      pushUndo(pre);
      S.keepHist = true;
      try { ctx.setBoard(res.board); } catch (e) { S.keepHist = false; toast('Das Ergebnis konnte nicht übernommen werden.'); return; }
      refresh();
      setTimeout(function () { S.keepHist = false; }, 800);
      const nm = function (x) { return typeof x === 'string' ? x : (x && (x.net || x.name)) || '?'; };
      const okN = (res.routed || []).map(nm), bad = (res.failed || []).map(nm);
      S.arNets = {};
      renderSide();
      if (bad.length) { toast((okN.length ? okN.length + ' Netz(e) verlegt. ' : '') + 'Nicht verlegbar: ' + bad.join(', ') + '. Gib mehr Platz oder lege selbst Hand an.'); fx('sad'); }
      else { toast(okN.length + ' Netz(e) automatisch verlegt.'); fx('ding'); }
    }

    // ---- Sprung zu einer DRC-Meldung / einem Netz
    function jumpTo(m) {
      if (S.v3) setV3(false);
      S.drcSel = m.id;
      if (m.at) { centerOn(m.at.x, m.at.y, Math.max(S.k, 24)); S.flash = { x: m.at.x, y: m.at.y, t0: performance.now() }; }
      if (m.layer && cuList().indexOf(m.layer) >= 0) { S.layer = m.layer; S.vis[m.layer] = true; buildLayers(); }
      S.sel = null;
      (m.items || []).some(function (id) { return selectById(id); });
      setHint(m.msg || '', m.severity === 'error' ? 'bad' : 'warn');
      renderSide(); invalidate();
    }
    function focusNet(name) {
      S.hiNet = name;
      let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
      function add(x, y) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
      getPads().forEach(function (p) { if (p.net === name) { add(p.x - p.w / 2, p.y - p.h / 2); add(p.x + p.w / 2, p.y + p.h / 2); } });
      (B().tracks || []).forEach(function (t) { if (t.net === name) t.pts.forEach(function (q) { add(q[0], q[1]); }); });
      if (x2 > x1 - 1e-9 && x1 < 1e8 && S.W) {
        if (S.v3) setV3(false);
        S.userView = true;
        const w = Math.max(x2 - x1, 4), hh = Math.max(y2 - y1, 4);
        S.k = clamp(Math.min((S.W - 60) / w, (S.H - 60) / hh), 3, 60);
        S.ox = S.W / 2 - (x1 + x2) / 2 * S.k; S.oy = S.H / 2 - (y1 + y2) / 2 * S.k;
      }
      setHint('Netz ' + name + ' hervorgehoben.');
      invalidate(); renderSide();
    }

    // ================================================================ Zeiger
    function evPos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    const DRAWING = { place: 1, track: 1, via: 1, zone: 1, text: 1, measure: 1 };
    function updateCursor(sx, sy, live) {
      const wx = s2wx(sx), wy = s2wy(sy);
      let c;
      if (S.tool === 'track') c = snapTo(wx, wy, { layer: S.trk ? S.trk.layer : S.layer });
      else if (S.tool === 'via' || S.tool === 'measure') c = snapTo(wx, wy, {});
      else if (S.tool === 'place' || S.tool === 'zone' || S.tool === 'text') { const g = gsnap(wx, wy); c = { x: g[0], y: g[1], kind: 'grid', net: '' }; }
      else c = { x: rnd(wx), y: rnd(wy), kind: 'grid', net: '' };
      S.cur = c; S.curLive = live !== false; S.snapKind = c.kind;
      if (S.tool === 'track' && S.trk) trackStatus();
      invalidate();
    }
    function beginPinch() {
      cancelDrag();
      S.panning = null;
      const a = Array.from(S.ptrs.values());
      const d = hyp(a[0].x - a[1].x, a[0].y - a[1].y) || 1, mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
      S.pinch = { d0: d, k0: S.v3 ? S.cam.k : S.k, wx: s2wx(mx), wy: s2wy(my) };
      S.curLive = false; invalidate();
    }
    function updatePinch() {
      const a = Array.from(S.ptrs.values());
      if (a.length < 2 || !S.pinch) return;
      const d = hyp(a[0].x - a[1].x, a[0].y - a[1].y) || 1, mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2, f = d / S.pinch.d0;
      if (S.v3) S.cam.k = clamp(S.pinch.k0 * f, 1.5, 80);
      else { S.userView = true; S.k = clamp(S.pinch.k0 * f, 1.5, 150); S.ox = mx - S.pinch.wx * S.k; S.oy = my - S.pinch.wy * S.k; }
      invalidate();
    }
    function onDown(e) {
      if (S.modal) return;
      S.mouse = e.pointerType === 'mouse';
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
      try { rootEl.focus({ preventScroll: true }); } catch (x) { /* egal */ }
      closePop();
      const p = evPos(e);
      const pr = { x: p[0], y: p[1], sx: p[0], sy: p[1], type: e.pointerType, button: e.button, t: performance.now(), moved: false, id: e.pointerId };
      S.ptrs.set(e.pointerId, pr);
      if (S.ptrs.size === 2) { beginPinch(); return; }
      if (S.ptrs.size > 2 || S.pinch) return;
      if (S.v3) { S.drag = { kind: 'rot3', yaw: S.cam.yaw, pitch: S.cam.pitch }; return; }
      if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2 || S.space)) {
        S.panning = { id: e.pointerId, ox: S.ox, oy: S.oy, sx: p[0], sy: p[1], button: e.button, moved: false };
        return;
      }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (S.tool === 'select') {
        const hit = pickAt(p[0], p[1]);
        const d = { kind: 'pan', ox: S.ox, oy: S.oy, hit: hit, live: false };
        const sel = getItem(S.sel), px = 1;
        // Eckpunkt einer gewaehlten Bahn/Flaeche
        if (sel && (S.sel.t === 'track' || S.sel.t === 'zone')) {
          const pts = S.sel.t === 'track' ? sel.pts : sel.poly.map(pt2);
          for (let i = 0; i < pts.length; i++) if (hyp(w2sx(pts[i][0]) - p[0], w2sy(pts[i][1]) - p[1]) <= 16) { d.kind = 'vertex'; d.idx = i; break; }
        }
        if (d.kind === 'pan' && !S.sel && !readOnly() && !(B().outline && B().outline.length > 2) && hyp(w2sx(B().w) - p[0], w2sy(B().h) - p[1]) <= 18) d.kind = 'outline';
        if (d.kind === 'pan' && hit) {
          let it = null;
          if (hit.t === 'pad') it = { t: 'part', id: hit.part.id };
          else if (hit.t === 'part' || hit.t === 'via' || hit.t === 'text') it = { t: hit.t, id: hit.id };
          else if ((hit.t === 'track' || hit.t === 'zone') && S.sel && S.sel.t === hit.t && S.sel.id === hit.id) it = { t: hit.t, id: hit.id };
          if (it) { d.kind = 'move'; d.item = it; }
        }
        S.drag = d;
        return;
      }
      if (S.tool === 'delete') { S.drag = { kind: 'tapdel' }; return; }
      updateCursor(p[0], p[1], true);
      S.drag = { kind: 'cursor' };
    }
    function onMove(e) {
      const p = evPos(e), pr = S.ptrs.get(e.pointerId);
      if (!pr) {
        if (e.pointerType === 'mouse' && !S.modal) {
          S.mouse = true;
          if (!S.v3 && DRAWING[S.tool]) updateCursor(p[0], p[1], true);
          else if (!S.v3) { S.cur = { x: rnd(s2wx(p[0])), y: rnd(s2wy(p[1])), kind: 'grid' }; S.curLive = false; invalidate(); }
        }
        return;
      }
      pr.x = p[0]; pr.y = p[1];
      if (hyp(p[0] - pr.sx, p[1] - pr.sy) > (pr.type === 'mouse' ? 4 : 8)) pr.moved = true;
      if (S.pinch) { updatePinch(); return; }
      if (S.panning && S.panning.id === e.pointerId) {
        const pn = S.panning;
        if (hyp(p[0] - pn.sx, p[1] - pn.sy) > 3) pn.moved = true;
        S.userView = true; S.ox = pn.ox + p[0] - pn.sx; S.oy = pn.oy + p[1] - pn.sy; invalidate(); return;
      }
      const d = S.drag;
      if (!d) return;
      if (d.kind === 'rot3') {
        const cam = S.cam, sgn = d.pitch >= 0 ? 1 : -1;
        cam.yaw = d.yaw + (p[0] - pr.sx) * 0.45;
        cam.pitch = sgn * clamp(Math.abs(d.pitch) + (p[1] - pr.sy) * 0.35 * sgn * sgn, 12, 88);
        invalidate(); return;
      }
      if (d.kind === 'cursor') { updateCursor(p[0], p[1], true); return; }
      if (!pr.moved) return;
      if (d.kind === 'pan') { S.userView = true; S.ox = d.ox + p[0] - pr.sx; S.oy = d.oy + p[1] - pr.sy; invalidate(); return; }
      if (d.kind === 'tapdel') return;
      // Verschieben
      if (!d.started) {
        if (readOnly()) { toast('Nur Ansicht: Hier kannst du nichts verschieben.'); d.kind = 'pan'; d.ox = S.ox; d.oy = S.oy; return; }
        if (d.kind === 'move' && d.item.t === 'part' && isLocked(getItem(d.item))) { toast('Dieses Bauteil ist gesperrt.'); d.kind = 'pan'; d.ox = S.ox; d.oy = S.oy; return; }
        d.started = true; d.live = true; d.pre = snapStr();
        if (d.kind === 'move') {
          S.sel = d.item; const it = getItem(d.item);
          d.orig = JSON.parse(JSON.stringify(it));
          S.hiNet = it && it.net ? it.net : S.hiNet;
          renderSide();
        }
      }
      const dx = (p[0] - pr.sx) / S.k, dy = (p[1] - pr.sy) / S.k, g = gridStep();
      if (d.kind === 'move') {
        const it = getItem(d.item);
        if (!it) return;
        if (d.item.t === 'part' || d.item.t === 'via' || d.item.t === 'text') {
          if (S.snap) { it.x = rnd(Math.round((d.orig.x + dx) / g) * g); it.y = rnd(Math.round((d.orig.y + dy) / g) * g); }
          else { it.x = rnd(d.orig.x + dx); it.y = rnd(d.orig.y + dy); }
        } else {
          const sx2 = S.snap ? Math.round(dx / g) * g : dx, sy2 = S.snap ? Math.round(dy / g) * g : dy;
          if (d.item.t === 'track') it.pts = d.orig.pts.map(function (q) { return [rnd(q[0] + sx2), rnd(q[1] + sy2)]; });
          else it.poly = d.orig.poly.map(function (q) { q = pt2(q); return [rnd(q[0] + sx2), rnd(q[1] + sy2)]; });
        }
      } else if (d.kind === 'vertex') {
        const it = getItem(S.sel);
        if (!it) return;
        if (S.sel.t === 'track') { const sn = snapTo(s2wx(p[0]), s2wy(p[1]), { layer: it.layer, ends: false }); it.pts[d.idx] = [sn.x, sn.y]; }
        else { const gp = gsnap(s2wx(p[0]), s2wy(p[1])); it.poly[d.idx] = [gp[0], gp[1]]; }
      } else if (d.kind === 'outline') {
        const b = B(), gp = gsnap(s2wx(p[0]), s2wy(p[1]));
        b.w = Math.max(5, gp[0]); b.h = Math.max(5, gp[1]);
      }
      S.rev++;
      invalidate();
    }
    function onUp(e) {
      const pr = S.ptrs.get(e.pointerId);
      S.ptrs.delete(e.pointerId);
      try { cv.releasePointerCapture(e.pointerId); } catch (x) { /* egal */ }
      if (S.pinch) { if (S.ptrs.size < 2) S.pinch = null; S.drag = null; return; }
      if (S.panning && S.panning.id === e.pointerId) {
        const pn = S.panning; S.panning = null;
        if (pn.button === 2 && !pn.moved && S.trk) finishTrack();
        else if (pn.button === 2 && !pn.moved && S.zone) finishZone();
        return;
      }
      const d = S.drag;
      S.drag = null;
      if (!pr || !d) return;
      if (d.kind === 'rot3') return;
      if (d.started) {
        const pre = d.pre;
        if (snapStr() !== pre) { pushUndo(pre); modelChanged(); if (d.kind === 'move' && d.item.t === 'part') fx('click'); }
        invalidate();
        return;
      }
      if (d.kind === 'tapdel') { if (!pr.moved) deleteHit(pickAt(pr.sx, pr.sy, { mode: 'delete' })); return; }
      if (d.kind === 'cursor') {
        if (!S.cur) return;
        const now = performance.now(), lt = S.lastTap;
        const dbl = !!(lt && now - lt.t < 420 && hyp(pr.x - lt.x, pr.y - lt.y) < (pr.type === 'mouse' ? 5 : 24) && lt.tool === S.tool);
        S.lastTap = { t: now, x: pr.x, y: pr.y, tool: S.tool };
        if (pr.type !== 'mouse') S.curLive = false;
        if (S.tool === 'place') placePartAt(S.cur);
        else if (S.tool === 'track') trackTap(dbl);
        else if (S.tool === 'via') placeViaAt(S.cur);
        else if (S.tool === 'zone') zoneTap(S.cur);
        else if (S.tool === 'text') textTap(S.cur);
        else if (S.tool === 'measure') measureTap(S.cur);
        invalidate();
        return;
      }
      if ((d.kind === 'pan' || d.kind === 'move' || d.kind === 'vertex' || d.kind === 'outline') && !pr.moved) selectTap(pr.sx, pr.sy);
    }
    function onCancel(e) {
      S.ptrs.delete(e.pointerId);
      if (S.pinch && S.ptrs.size < 2) S.pinch = null;
      cancelDrag(); S.panning = null; invalidate();
    }
    function onWheel(e) {
      e.preventDefault();
      if (S.modal) return;
      const p = evPos(e), f = Math.exp(-clamp(e.deltaY, -240, 240) * 0.0016);
      if (S.v3) { S.cam.k = clamp(S.cam.k * f, 1.5, 80); invalidate(); } else zoomAt(p[0], p[1], f);
    }

    // ---- Tastatur
    function shown() { return rootEl.offsetParent !== null; }
    function onKeyUp(e) { if (e.key === ' ') S.space = false; }
    function onKey(e) {
      if (S.destroyed || !shown()) return;
      const tg = e.target;
      if (tg && /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) { if (e.key === 'Escape') tg.blur(); return; }
      if (S.modal) { if (e.key === 'Escape') S.modal.close(); return; }
      if (tg && tg !== document.body && !rootEl.contains(tg)) return;
      const k = e.key, ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (ctrl && (k === 'y' || k === 'Y')) { e.preventDefault(); redo(); return; }
      if (ctrl || e.altKey) return;
      if (k === ' ') { S.space = true; e.preventDefault(); return; }
      if (k === 'Escape') { if (S.trk || S.zone || S.meas) cancelOps(); else { S.sel = null; S.hiNet = null; renderSide(); invalidate(); } return; }
      if (k === 'Enter') { if (S.trk) finishTrack(); else if (S.zone) finishZone(); return; }
      if (k === 'Backspace' && S.trk) { e.preventDefault(); trackBack(); return; }
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteSel(); return; }
      const lk = k.toLowerCase();
      const tm = { s: 'select', p: 'place', b: 'track', o: 'via', z: 'zone', x: 'text', m: 'measure', d: 'delete' };
      if (tm[lk]) { setTool(tm[lk]); return; }
      if (lk === 'r') { rotateSel(e.shiftKey ? -1 : 1); return; }
      if (lk === 'f') { flipSel(); return; }
      if (lk === 'v') { if (S.trk) trackVia(); else if (S.tool !== 'via') setTool('via'); return; }
      if (lk === 'h') { S.hiNet = null; invalidate(); return; }
      if (lk === 'c' && S.trk) { S.cornerMode ^= 1; invalidate(); return; }
      if (/^[1-9]$/.test(k)) { const cu = cuList(), l = cu[+k - 1]; if (l) setLayer(l); }
    }

    // ================================================================ Oberflaeche
    const TOOLS = [
      { id: 'select', ic: '↖', lab: 'Wählen', tip: 'Auswählen und Verschieben (S)', edit: false },
      { id: 'place', ic: '▣', lab: 'Bauteil', tip: 'Bauteil setzen (P)', edit: true },
      { id: 'track', ic: '⌇', lab: 'Bahn', tip: 'Leiterbahn zeichnen (B)', edit: true },
      { id: 'via', ic: '◉', lab: 'Via', tip: 'Via setzen (O)', edit: true },
      { id: 'zone', ic: '▨', lab: 'Fläche', tip: 'Kupferfläche (Zone) zeichnen (Z)', edit: true },
      { id: 'text', ic: 'T', lab: 'Text', tip: 'Text setzen (X)', edit: true },
      { id: 'measure', ic: '↔', lab: 'Messen', tip: 'Abstand und Winkel messen (M)', edit: false },
      { id: 'delete', ic: '✕', lab: 'Löschen', tip: 'Löschen (D, Entf)', edit: true }
    ];
    const HELP = {
      select: 'Antippen wählt aus (Pad = Netz leuchtet auf). Ziehen verschiebt, leere Fläche ziehen schiebt die Ansicht.',
      place: 'Bauteil: Form wählen, dann tippen. R dreht, F spiegelt auf die andere Seite.',
      track: 'Bahn: auf ein Pad tippen, dann Punkte setzen. Doppeltipp oder V = Via und Lagenwechsel, Fertig beendet.',
      via: 'Via: tippen setzt eine Durchkontaktierung (Netz vom getroffenen Pad oder Bahnende).',
      zone: 'Fläche: Ecken antippen, auf die erste Ecke tippen schließt. Danach das Netz wählen (GND auf Innenlage).',
      text: 'Text: tippen, dann Text eingeben (Bestückungsdruck).',
      measure: 'Messen: zwei Punkte antippen.',
      delete: 'Löschen: Bauteil, Via, Text oder Bahnstück antippen.'
    };
    function btn(ic, lab, tip, fn, cls) {
      const b = h('button', { class: 'pe-b' + (cls ? ' ' + cls : ''), title: tip || lab, type: 'button', onclick: fn }, [h('i', { text: ic }), h('span', { text: lab })]);
      return b;
    }
    function setTool(t) {
      const def = TOOLS.filter(function (x) { return x.id === t; })[0];
      if (!def) return;
      if (def.edit && readOnly()) { toast('Nur Ansicht: Hier kannst du nichts ändern.'); return; }
      cancelOps();
      if (S.v3) setV3(false);
      S.tool = t; S.curLive = false; S.meas = null;
      setHint(HELP[t] || '');
      buildTools(); buildOpts(); buildFab(); invalidate();
      if (t === 'place' && !S.place.fp) showFpDialog();
    }
    function setLayer(l) {
      const all = cuList().concat(EXTRA_LAYERS);
      if (all.indexOf(l) < 0) return;
      if (!isCu(l)) { S.vis[l] = S.vis[l] === false; buildLayers(); invalidate(); return; }
      if (S.trk && S.tool === 'track' && S.trk.layer !== l) { trackVia(l); return; }
      S.layer = l; S.vis[l] = true;
      buildLayers(); invalidate();
    }
    function setV3(on) {
      S.v3 = !!on;
      cam3.style.display = S.v3 ? 'flex' : 'none';
      stage.classList.toggle('pe-is3d', S.v3);
      if (S.v3 && !S.cam.init) { S.cam.init = true; fit3(); }
      if (S.v3) cancelOps();
      buildActions(); buildFab(); invalidate();
    }
    function buildTools() {
      toolRow.innerHTML = '';
      const ro = readOnly();
      TOOLS.forEach(function (t) {
        const b = btn(t.ic, t.lab, t.tip, function () { setTool(t.id); }, S.tool === t.id && !S.v3 ? 'on' : '');
        if (t.edit && ro) b.disabled = true;
        toolRow.appendChild(b);
      });
      roEl.style.display = ro ? '' : 'none';
    }
    function buildActions() {
      actRow.innerHTML = '';
      btnUndo = btn('↶', 'Zurück', 'Rückgängig (Strg+Z)', undo);
      btnRedo = btn('↷', 'Wieder', 'Wiederholen (Strg+Y)', redo);
      actRow.appendChild(btnUndo); actRow.appendChild(btnRedo);
      actRow.appendChild(h('span', { class: 'pe-sep' }));
      actRow.appendChild(btn('⟲', 'Drehen', 'Drehen (R)', function () { rotateSel(1); }));
      actRow.appendChild(btn('⇋', 'Spiegeln', 'Auf die andere Seite spiegeln (F)', flipSel));
      actRow.appendChild(h('span', { class: 'pe-sep' }));
      const gs = h('select', { class: 'pe-sel', title: 'Raster', 'aria-label': 'Raster' });
      GRIDS.forEach(function (g) { gs.appendChild(h('option', { value: String(g), text: fmt(g, 2) + ' mm' })); });
      const cg = B() ? (B().grid || 0.25) : 0.25;
      if (GRIDS.indexOf(cg) < 0) gs.appendChild(h('option', { value: String(cg), text: fmt(cg, 3) + ' mm' }));
      gs.value = String(cg);
      gs.addEventListener('change', function () { B().grid = parseFloat(gs.value); try { ctx.changed(); } catch (e) { /* egal */ } S.sig = snapStr(); invalidate(); });
      actRow.appendChild(h('span', { class: 'pe-lab' }, ['Raster ', gs]));
      actRow.appendChild(btn('⌗', S.snap ? 'Fangen an' : 'Fangen aus', 'Am Raster fangen', function () { S.snap = !S.snap; buildActions(); }, S.snap ? 'on' : ''));
      actRow.appendChild(h('span', { class: 'pe-sep' }));
      actRow.appendChild(btn('✦', 'Auto-Weg', 'Markierte (oder alle offenen) Netze automatisch verlegen', runAutoroute));
      actRow.appendChild(btn('◧', '3D', '3D-Ansicht', function () { setV3(!S.v3); buildTools(); }, S.v3 ? 'on' : ''));
      actRow.appendChild(btn('☰', 'Ansicht', 'Anzeige-Einstellungen', function (e) { togglePop(e.currentTarget); }));
      updUndo();
    }
    function buildLayers() {
      layerRow.innerHTML = '';
      const cu = cuList();
      if (cu.indexOf(S.layer) < 0) S.layer = cu[0];
      cu.concat(EXTRA_LAYERS).forEach(function (l) {
        const cop = isCu(l), vis = visible(l), act = cop && l === S.layer;
        const chip = h('div', { class: 'pe-chip' + (act ? ' act' : '') + (vis ? '' : ' off') + (cop ? '' : ' na'), title: LNAME[l] || l }, [
          h('button', { class: 'eye', type: 'button', text: vis ? '●' : '○', style: 'color:' + LCOL[l], 'aria-label': 'Sichtbarkeit ' + l, onclick: function (e) { e.stopPropagation(); S.vis[l] = !visible(l); buildLayers(); invalidate(); } }),
          h('button', { class: 'nm', type: 'button', onclick: function () { setLayer(l); } }, [h('span', { class: 'sw', style: 'background:' + LCOL[l] }), LSHORT[l] || l])
        ]);
        layerRow.appendChild(chip);
        if (l === 'B.Cu') layerRow.appendChild(h('span', { class: 'pe-sep' }));
      });
      layerRow.appendChild(h('span', { class: 'pe-sep' }));
      const dimLab = { dim: 'Andere abdunkeln', full: 'Andere hell', hide: 'Andere aus' };
      layerRow.appendChild(h('button', { class: 'pe-b flat', type: 'button', text: '◐ ' + dimLab[S.dim], title: 'Darstellung der nicht aktiven Kupferlagen', onclick: function () { S.dim = S.dim === 'dim' ? 'full' : S.dim === 'full' ? 'hide' : 'dim'; buildLayers(); invalidate(); } }));
    }
    function optField(label, el) { return h('span', { class: 'pe-lab' }, [label, el]); }
    function netSelect(value, first, onch) {
      const s = h('select', { class: 'pe-sel', style: 'max-width:150px' });
      s.appendChild(h('option', { value: '', text: first }));
      netsOf().forEach(function (n) { s.appendChild(h('option', { value: n.name, text: n.name })); });
      s.value = value || '';
      s.addEventListener('change', function () { onch(s.value); });
      return s;
    }
    function buildOpts() {
      optRow.innerHTML = '';
      const t = S.tool, r = B() ? R() : {};
      if (t === 'place') {
        const fp = S.place.fp ? fpOf(S.place.fp) : null;
        optRow.appendChild(h('button', { class: 'pe-b flat', type: 'button', text: fp ? '▣ ' + (fp.name || fp.id) + ' ▾' : '▣ Form wählen …', onclick: showFpDialog }));
        const ri = h('input', { class: 'pe-in', value: S.place.ref || '', placeholder: 'Ref', 'aria-label': 'Referenz', style: 'width:72px' });
        ri.addEventListener('input', function () { S.place.ref = ri.value; S.place.refAuto = false; });
        const vi = h('input', { class: 'pe-in', value: S.place.value || '', placeholder: 'Wert', 'aria-label': 'Wert', style: 'width:96px' });
        vi.addEventListener('input', function () { S.place.value = vi.value; });
        optRow.appendChild(optField('Ref', ri)); optRow.appendChild(optField('Wert', vi));
        const sd = h('select', { class: 'pe-sel' }, [h('option', { value: 'top', text: 'Oberseite' }), h('option', { value: 'bot', text: 'Unterseite' })]);
        sd.value = S.place.side; sd.addEventListener('change', function () { S.place.side = sd.value; invalidate(); });
        optRow.appendChild(sd);
        optRow.appendChild(h('button', { class: 'pe-b flat', type: 'button', text: '⟲ ' + S.place.rot + '°', title: 'Drehen (R)', onclick: function () { S.place.rot = nrot(S.place.rot + 90); buildOpts(); invalidate(); } }));
      } else if (t === 'track') {
        const ws = h('select', { class: 'pe-sel', 'aria-label': 'Breite' });
        ws.appendChild(h('option', { value: 'auto', text: 'Auto (Netz)' }));
        WIDTHS.forEach(function (w) { ws.appendChild(h('option', { value: String(w), text: fmt(w, 2) + ' mm' })); });
        if (S.trackW !== 'auto' && WIDTHS.indexOf(S.trackW) < 0) ws.appendChild(h('option', { value: String(S.trackW), text: fmt(S.trackW, 3) + ' mm' }));
        ws.value = String(S.trackW);
        ws.addEventListener('change', function () { S.trackW = ws.value === 'auto' ? 'auto' : parseFloat(ws.value); if (S.trk) { S.trk.w = curWidth(S.trk.net, S.trk.layer); trackStatus(); } invalidate(); });
        optRow.appendChild(optField('Breite', ws));
        optRow.appendChild(h('button', { class: 'pe-b flat' + (S.free ? '' : ' on'), type: 'button', text: S.free ? 'Winkel frei' : '45°-Raster', title: 'Winkel einrasten (45 Grad) oder frei', onclick: function () { S.free = !S.free; buildOpts(); invalidate(); } }));
        optRow.appendChild(h('button', { class: 'pe-b flat', type: 'button', text: '⌐ Ecke ' + (S.cornerMode ? 'schräg zuerst' : 'gerade zuerst'), title: 'Reihenfolge der 45-Grad-Ecke (C)', onclick: function () { S.cornerMode ^= 1; buildOpts(); invalidate(); } }));
        optRow.appendChild(h('button', { class: 'pe-b flat', type: 'button', text: '◉ Via (V)', onclick: function () { if (S.trk) trackVia(); else toast('Starte zuerst eine Bahn, dann setzt dieser Knopf eine Via.'); } }));
      } else if (t === 'via') {
        optRow.appendChild(optField('Netz', netSelect(S.viaNet, 'automatisch', function (v) { S.viaNet = v; })));
        const di = h('input', { class: 'pe-in', type: 'number', step: '0.05', min: '0.3', value: S.viaDia || r.viaDia, style: 'width:78px' });
        di.addEventListener('change', function () { S.viaDia = clamp(num(di.value, r.viaDia), 0.3, 5); });
        const dr = h('input', { class: 'pe-in', type: 'number', step: '0.05', min: '0.2', value: S.viaDrill || r.viaDrill, style: 'width:78px' });
        dr.addEventListener('change', function () { S.viaDrill = clamp(num(dr.value, r.viaDrill), 0.2, 4); });
        optRow.appendChild(optField('Ø Pad', di)); optRow.appendChild(optField('Bohrung', dr));
      } else if (t === 'zone') {
        optRow.appendChild(optField('Netz', netSelect(S.zoneNet, 'beim Fertigstellen fragen', function (v) { S.zoneNet = v; })));
        optRow.appendChild(h('button', { class: 'pe-b flat', type: 'button', text: '▨ Ganze Platine füllen', title: 'Fläche über die ganze Platine auf der aktiven Lage anlegen', onclick: zoneWholeBoard }));
      }
      optRow.style.display = /^(place|track|via|zone)$/.test(t) ? '' : 'none';
    }
    function buildFab() {
      fab.innerHTML = '';
      if (S.v3) return;
      function f(txt, fn, cls) { fab.appendChild(h('button', { class: 'pe-b' + (cls ? ' ' + cls : ''), type: 'button', text: txt, onclick: fn })); }
      if (S.tool === 'track' && S.trk) {
        f('◉ Via', function () { trackVia(); });
        f('✓ Fertig', finishTrack, 'ok');
        f('⌫ Zurück', trackBack);
        f('✕ Abbruch', cancelOps);
      } else if (S.tool === 'zone' && S.zone) {
        f('✓ Fertig', function () { finishZone(); }, 'ok');
        f('⌫ Zurück', function () { if (S.zone) { S.zone.pts.pop(); if (!S.zone.pts.length) S.zone = null; buildFab(); invalidate(); } });
        f('✕ Abbruch', cancelOps);
      }
    }
    function buildZoom() {
      zoomb.innerHTML = '';
      zoomb.appendChild(btn('＋', '', 'Vergrößern', function () { if (S.v3) { S.cam.k = clamp(S.cam.k * 1.25, 1.5, 80); invalidate(); } else zoomAt(S.W / 2, S.H / 2, 1.3); }));
      zoomb.appendChild(btn('－', '', 'Verkleinern', function () { if (S.v3) { S.cam.k = clamp(S.cam.k / 1.25, 1.5, 80); invalidate(); } else zoomAt(S.W / 2, S.H / 2, 1 / 1.3); }));
      zoomb.appendChild(btn('⤢', '', 'Einpassen', function () { if (S.v3) { fit3(); } else fit(); }));
      cam3.innerHTML = '';
      cam3.appendChild(h('button', { class: 'pe-b', type: 'button', text: '↻ 90°', onclick: function () { S.cam.yaw += 90; invalidate(); } }));
      cam3.appendChild(h('button', { class: 'pe-b', type: 'button', text: '⇅ Oben/Unten', onclick: function () { S.cam.pitch = -S.cam.pitch; invalidate(); } }));
      cam3.appendChild(h('button', { class: 'pe-b', type: 'button', text: '☰ Lagen auseinander', onclick: function () { S.cam.explode = !S.cam.explode; invalidate(); } }));
      cam3.appendChild(h('button', { class: 'pe-b', type: 'button', text: '← 2D', onclick: function () { setV3(false); buildTools(); } }));
    }
    function fit3() {
      const bb = boardBox();
      S.cam.k = clamp(Math.min(S.W, S.H) / (Math.max(bb[2] - bb[0], bb[3] - bb[1]) * 1.5), 1.5, 80);
      invalidate();
    }

    // ---- Anzeige-Einstellungen
    let pop = null;
    function closePop() { if (pop && pop.parentNode) pop.parentNode.removeChild(pop); pop = null; }
    function togglePop(anchor) {
      if (pop) { closePop(); return; }
      const rr = anchor.getBoundingClientRect(), rb = rootEl.getBoundingClientRect();
      pop = h('div', { class: 'pe-pop' });
      function ck(label, key) {
        const i = h('input', { type: 'checkbox' }); i.checked = !!S[key];
        i.addEventListener('change', function () { S[key] = i.checked; invalidate(); });
        pop.appendChild(h('label', { class: 'ck' }, [i, label]));
      }
      ck('Raster anzeigen', 'grid'); ck('Ratsnest (Luftlinien)', 'rats'); ck('DRC-Markierungen', 'drcOn'); ck('Bauteilgrenzen (Courtyard)', 'court');
      ck('Padnummern', 'padNum'); ck('Netznamen an Pads', 'netNames');
      pop.style.top = (rr.bottom - rb.top + 4) + 'px';
      pop.style.left = clamp(rr.left - rb.left - 120, 4, Math.max(4, rb.width - 250)) + 'px';
      rootEl.appendChild(pop);
    }

    // ---- Seitenleiste
    function drcCounts() {
      const L = drcList();
      return { err: L.filter(function (m) { return m.severity === 'error'; }).length, warn: L.filter(function (m) { return m.severity !== 'error'; }).length, n: L.length };
    }
    function buildTabs() {
      tabs.innerHTML = '';
      const dc = drcCounts(), cn = getConn(), open = cn && cn.unrouted ? cn.unrouted.length : 0;
      [['props', 'Eigenschaften', ''], ['drc', 'DRC', dc.n ? '<span class="n' + (dc.err ? ' bad' : '') + '">' + dc.n + '</span>' : ''], ['nets', 'Netze', open ? '<span class="n">' + open + ' offen</span>' : '']].forEach(function (t) {
        const b = h('button', { class: 'pe-tab' + (S.tab === t[0] ? ' on' : ''), type: 'button', html: t[1] + t[2], onclick: function () {
          if (S.tab === t[0]) rootEl.classList.toggle('pe-sidehide'); else { S.tab = t[0]; rootEl.classList.remove('pe-sidehide'); }
          buildTabs(); renderSide(true);
        } });
        tabs.appendChild(b);
      });
    }
    function fld(label, el) { return h('div', { class: 'pe-fld' }, [h('label', { text: label }), el]); }
    function inp(value, onch, o) {
      o = o || {};
      const i = h('input', { class: 'pe-in', type: o.type || 'text', value: value == null ? '' : value });
      if (o.step) i.step = o.step; if (o.min != null) i.min = o.min;
      if (o.dis) i.disabled = true;
      i.addEventListener('change', function () { onch(i.value); });
      i.addEventListener('keydown', function (e) { if (e.key === 'Enter') i.blur(); });
      return i;
    }
    function sel(opts, value, onch, dis) {
      const s = h('select', { class: 'pe-sel' });
      opts.forEach(function (o) { s.appendChild(h('option', { value: String(o[0]), text: o[1] })); });
      s.value = String(value);
      if (dis) s.disabled = true;
      s.addEventListener('change', function () { onch(s.value); });
      return s;
    }
    function setProp(obj, key, val) { edit(function () { obj[key] = val; }); renderSide(true); }
    function btnRow(list) { return h('div', { class: 'pe-btns' }, list.map(function (x) { return h('button', { class: 'pe-b flat', type: 'button', text: x[0], onclick: x[1], disabled: x[2] ? true : undefined }); })); }
    function renderProps() {
      pane.innerHTML = '';
      const b = B(), ro = readOnly(), it = getItem(S.sel), C = core();
      if (!it) {
        pane.appendChild(h('div', { class: 'pe-h4', text: 'Platine' }));
        pane.appendChild(fld('Name', inp(b.name || '', function (v) { setProp(b, 'name', v); }, { dis: ro })));
        pane.appendChild(fld('Breite (mm)', inp(b.w, function (v) { const n = clamp(num(v, b.w), 5, 400); setProp(b, 'w', n); fit(); }, { type: 'number', step: '0.5', dis: ro || !!(b.outline && b.outline.length > 2) })));
        pane.appendChild(fld('Höhe (mm)', inp(b.h, function (v) { const n = clamp(num(v, b.h), 5, 400); setProp(b, 'h', n); fit(); }, { type: 'number', step: '0.5', dis: ro || !!(b.outline && b.outline.length > 2) })));
        pane.appendChild(h('p', { class: 'pe-p', html: '<b>' + (b.layers || 2) + ' Lagen</b> · Kupfer außen ' + (b.copperOz || 1) + ' oz · Lagenzahl und Aufbau stellst du im Reiter „Lagen“ ein.' }));
        const r = R();
        pane.appendChild(h('div', { class: 'pe-h4', text: 'Entwurfsregeln' }));
        pane.appendChild(h('p', { class: 'pe-p', html: 'Bahnbreite min. <b>' + fmt(r.minWidth, 2) + '</b> mm · Abstand <b>' + fmt(r.clearance, 2) + '</b> mm · Bohrung min. <b>' + fmt(r.minDrill, 2) + '</b> mm · Restring <b>' + fmt(r.annular, 2) + '</b> mm · Rand <b>' + fmt(r.edge, 2) + '</b> mm' }));
        pane.appendChild(h('p', { class: 'pe-p', text: 'Tipp: Tippe auf ein Pad – dann leuchtet das ganze Netz. Der blaue Punkt unten rechts an der Platine zieht die Größe auf (nur ohne Auswahl).' }));
        return;
      }
      const dis = ro;
      if (S.sel.t === 'part') {
        const lk = isLocked(it);
        pane.appendChild(h('div', { class: 'pe-h4', text: 'Bauteil' }));
        pane.appendChild(fld('Referenz', inp(it.ref, function (v) { v = v.trim(); if (!v) return; if ((b.parts || []).some(function (q) { return q !== it && q.ref === v; })) toast('Achtung: Die Referenz ' + v + ' gibt es schon.'); setProp(it, 'ref', v); }, { dis: dis || lk })));
        pane.appendChild(fld('Wert', inp(it.value || '', function (v) { setProp(it, 'value', v.trim()); }, { dis: dis || lk })));
        const fp = fpOf(it.fp);
        pane.appendChild(h('p', { class: 'pe-p', html: 'Form: <b>' + (fp ? (fp.name || fp.id) : it.fp) + '</b>' + (fp && fp.desc ? ' · ' + fp.desc : '') }));
        pane.appendChild(fld('Drehung', sel([[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']], nrot(it.rot), function (v) { setProp(it, 'rot', +v); }, dis || lk)));
        pane.appendChild(fld('Seite', sel([['top', 'Oberseite (F.Cu)'], ['bot', 'Unterseite (B.Cu)']], it.side === 'bot' ? 'bot' : 'top', function (v) { setProp(it, 'side', v); }, dis || lk)));
        pane.appendChild(fld('x (mm)', inp(it.x, function (v) { setProp(it, 'x', rnd(num(v, it.x))); }, { type: 'number', step: String(gridStep()), dis: dis || lk })));
        pane.appendChild(fld('y (mm)', inp(it.y, function (v) { setProp(it, 'y', rnd(num(v, it.y))); }, { type: 'number', step: String(gridStep()), dis: dis || lk })));
        const lkc = h('input', { type: 'checkbox', style: 'width:22px;height:22px' }); lkc.checked = lk; lkc.disabled = dis;
        lkc.addEventListener('change', function () { setProp(it, 'locked', lkc.checked); });
        pane.appendChild(fld('Gesperrt', lkc));
        const pads = getPads().filter(function (p) { return p.part === it.id || (p.ref === it.ref && !byId(b.parts, p.part)); });
        if (pads.length) {
          pane.appendChild(h('div', { class: 'pe-h4', text: 'Pads und Netze' }));
          pane.appendChild(h('p', { class: 'pe-p', html: pads.slice(0, 40).map(function (p) { return '<b>' + p.n + '</b> ' + (p.net || '–'); }).join(' · ') }));
        }
        pane.appendChild(btnRow([['⟲ Drehen', function () { rotateSel(1); }, dis || lk], ['⇋ Spiegeln', flipSel, dis || lk], ['Löschen', deleteSel, dis || lk]]));
      } else if (S.sel.t === 'track') {
        pane.appendChild(h('div', { class: 'pe-h4', text: 'Leiterbahn' }));
        pane.appendChild(fld('Netz', sel([['', '(kein Netz)']].concat(netsOf().map(function (n) { return [n.name, n.name]; })), it.net || '', function (v) { setProp(it, 'net', v); S.hiNet = v || null; }, dis)));
        pane.appendChild(fld('Lage', sel(cuList().map(function (l) { return [l, LNAME[l] || l]; }), it.layer, function (v) { setProp(it, 'layer', v); }, dis)));
        pane.appendChild(fld('Breite (mm)', inp(it.w, function (v) { setProp(it, 'w', clamp(num(v, it.w), 0.05, 10)); }, { type: 'number', step: '0.05', min: '0.05', dis: dis })));
        const len = polyLen(it.pts);
        let info = 'Länge <b>' + fmt(len, 1) + ' mm</b>';
        try { if (C.traceResistance) info += ' · Widerstand <b>' + fmt(C.traceResistance(len, it.w, isOuter(it.layer) ? (b.copperOz || 1) : (b.inOz || 0.5)) * 1000, 1) + ' mΩ</b>'; } catch (e) { /* egal */ }
        try { if (C.ipcCurrent) info += '<br>Belastbar mit ca. <b>' + fmt(C.ipcCurrent(it.w, { oz: isOuter(it.layer) ? (b.copperOz || 1) : (b.inOz || 0.5), rise: 10, external: isOuter(it.layer) }), 2) + ' A</b> bei 10 K Erwärmung (IPC-2221)'; } catch (e) { /* egal */ }
        pane.appendChild(h('p', { class: 'pe-p', html: info }));
        const need = needWidth(it.net, it.layer);
        if (need && it.w < need - 0.005) pane.appendChild(h('p', { class: 'pe-p', style: 'color:#ffb340', text: 'Für ' + fmt(netObj(it.net).current, 1) + ' A wären mindestens ' + fmt(need, 2) + ' mm nötig.' }));
        pane.appendChild(btnRow([['Netz hervorheben', function () { S.hiNet = it.net || null; invalidate(); }], ['Bahn löschen', deleteSel, dis]]));
      } else if (S.sel.t === 'via') {
        pane.appendChild(h('div', { class: 'pe-h4', text: 'Via' }));
        pane.appendChild(fld('Netz', sel([['', '(kein Netz)']].concat(netsOf().map(function (n) { return [n.name, n.name]; })), it.net || '', function (v) { setProp(it, 'net', v); S.hiNet = v || null; }, dis)));
        pane.appendChild(fld('Ø Pad (mm)', inp(it.dia, function (v) { setProp(it, 'dia', clamp(num(v, it.dia), 0.3, 5)); }, { type: 'number', step: '0.05', dis: dis })));
        pane.appendChild(fld('Bohrung (mm)', inp(it.drill, function (v) { setProp(it, 'drill', clamp(num(v, it.drill), 0.1, Math.max(0.1, (it.dia || 0.8) - 0.1))); }, { type: 'number', step: '0.05', dis: dis })));
        pane.appendChild(h('p', { class: 'pe-p', html: 'Restring <b>' + fmt(((it.dia || 0.8) - (it.drill || 0.4)) / 2, 3) + ' mm</b> · von ' + (it.from || 'F.Cu') + ' bis ' + (it.to || 'B.Cu') }));
        pane.appendChild(btnRow([['◫ Schnitt anzeigen', function () { showXsec(it); }], ['Via löschen', deleteSel, dis]]));
      } else if (S.sel.t === 'zone') {
        pane.appendChild(h('div', { class: 'pe-h4', text: 'Kupferfläche (Zone)' }));
        pane.appendChild(fld('Netz', sel([['', '(kein Netz)']].concat(netsOf().map(function (n) { return [n.name, n.name]; })), it.net || '', function (v) { setProp(it, 'net', v); S.hiNet = v || null; }, dis)));
        pane.appendChild(fld('Lage', sel(cuList().map(function (l) { return [l, LNAME[l] || l]; }), it.layer, function (v) { setProp(it, 'layer', v); }, dis)));
        pane.appendChild(fld('Abstand (mm)', inp(it.clearance != null ? it.clearance : R().clearance, function (v) { setProp(it, 'clearance', clamp(num(v, 0.3), 0.1, 3)); }, { type: 'number', step: '0.05', dis: dis })));
        const tc = h('input', { type: 'checkbox', style: 'width:22px;height:22px' }); tc.checked = it.thermals !== false; tc.disabled = dis;
        tc.addEventListener('change', function () { setProp(it, 'thermals', tc.checked); });
        pane.appendChild(fld('Wärmefallen', tc));
        pane.appendChild(h('p', { class: 'pe-p', text: 'Die Füllung wird berechnet: Sie hält Abstand zu Kupfer anderer Netze und verbindet Pads des eigenen Netzes über Wärmefallen. Ecken lassen sich ziehen.' }));
        pane.appendChild(btnRow([['Neu füllen', function () { S.rev++; invalidate(); }], ['Fläche löschen', deleteSel, dis]]));
      } else if (S.sel.t === 'text') {
        pane.appendChild(h('div', { class: 'pe-h4', text: 'Text' }));
        pane.appendChild(fld('Text', inp(it.text, function (v) { setProp(it, 'text', v); }, { dis: dis })));
        pane.appendChild(fld('Höhe (mm)', inp(it.size || 1, function (v) { setProp(it, 'size', clamp(num(v, 1), 0.5, 10)); }, { type: 'number', step: '0.1', dis: dis })));
        pane.appendChild(fld('Lage', sel([['F.Silk', 'Druck oben'], ['B.Silk', 'Druck unten']], it.layer, function (v) { setProp(it, 'layer', v); }, dis)));
        pane.appendChild(btnRow([['Text löschen', deleteSel, dis]]));
      }
    }
    function renderDrc() {
      pane.innerHTML = '';
      const L = drcList().slice().sort(function (a, c) { return (a.severity === 'error' ? 0 : a.severity === 'warn' ? 1 : 2) - (c.severity === 'error' ? 0 : c.severity === 'warn' ? 1 : 2); });
      const dc = drcCounts();
      pane.appendChild(h('div', { class: 'pe-btns' }, [
        h('span', { class: 'pe-p', html: '<b>' + dc.err + '</b> Fehler · <b>' + dc.warn + '</b> Hinweise' }),
        h('button', { class: 'pe-b flat', type: 'button', text: S.drcOn ? 'Markierungen aus' : 'Markierungen an', onclick: function () { S.drcOn = !S.drcOn; renderSide(true); invalidate(); } })
      ]));
      if (!L.length) pane.appendChild(h('p', { class: 'pe-p', text: 'Keine DRC-Meldungen. Der Entwurfsregel-Test läuft nach jeder Änderung automatisch.' }));
      L.slice(0, 200).forEach(function (m) {
        const col = m.severity === 'error' ? '#ff3b30' : m.severity === 'warn' ? '#ffb340' : '#5ab0ff';
        pane.appendChild(h('div', { class: 'pe-li' + (S.drcSel === m.id ? ' on' : ''), onclick: function () { jumpTo(m); } }, [
          h('span', { class: 'pe-dot', style: 'background:' + col }),
          h('div', null, [h('div', { text: m.msg || m.type }), h('div', { class: 's', text: (m.type || '') + (m.layer ? ' · ' + m.layer : '') + (m.at ? ' · x ' + fmt(m.at.x, 1) + ' y ' + fmt(m.at.y, 1) : '') })])
        ]));
      });
      if (L.length > 200) pane.appendChild(h('p', { class: 'pe-p', text: '… und ' + (L.length - 200) + ' weitere.' }));
    }
    function renderNets() {
      pane.innerHTML = '';
      const cn = getConn();
      if (!cn) { pane.appendChild(h('p', { class: 'pe-p', text: 'Keine Verbindungsdaten.' })); return; }
      const open = (cn.unrouted || []).length;
      pane.appendChild(h('p', { class: 'pe-p', html: open ? '<b>' + open + '</b> offene Verbindung' + (open === 1 ? '' : 'en') + ' (gestrichelte Luftlinien).' : '<b>Alle Netze sind verbunden.</b>' }));
      const nOpen = Object.keys(S.arNets).filter(function (k) { return S.arNets[k]; }).length;
      pane.appendChild(btnRow([['✦ Auto-Weg' + (nOpen ? ' (' + nOpen + ')' : ''), runAutoroute, readOnly()], ['Alle offenen', function () { S.arNets = {}; (cn.unrouted || []).forEach(function (u) { S.arNets[u.net] = true; }); renderSide(true); }, readOnly() || !open]]));
      (cn.shorts || []).forEach(function (s) {
        pane.appendChild(h('div', { class: 'pe-li', onclick: function () { if (s.at) { centerOn(s.at.x, s.at.y, Math.max(S.k, 24)); S.flash = { x: s.at.x, y: s.at.y, t0: performance.now() }; if (S.v3) setV3(false); } } }, [
          h('span', { class: 'pe-dot', style: 'background:#ff3b30' }), h('div', null, [h('div', { text: 'Kurzschluss: ' + s.netA + ' – ' + s.netB }), h('div', { class: 's', text: s.layer || '' })])
        ]));
      });
      (cn.nets || []).forEach(function (n) {
        const ok = n.connected, cnt = (cn.unrouted || []).filter(function (u) { return u.net === n.name; }).length;
        const ck = h('input', { type: 'checkbox', style: 'width:22px;height:22px;flex:none', 'aria-label': 'Für Auto-Weg markieren' });
        ck.checked = !!S.arNets[n.name]; ck.disabled = ok;
        ck.addEventListener('click', function (e) { e.stopPropagation(); });
        ck.addEventListener('change', function () { S.arNets[n.name] = ck.checked; renderSide(true); });
        pane.appendChild(h('div', { class: 'pe-li' + (S.hiNet === n.name ? ' on' : ''), onclick: function () { focusNet(n.name); } }, [
          h('span', { class: 'pe-dot', style: 'background:' + (ok ? '#4cd964' : '#ffb340') }),
          h('div', { style: 'flex:1;min-width:0' }, [h('div', { text: n.name + (netObj(n.name) && netObj(n.name).cls === 'power' ? ' (Versorgung)' : '') }), h('div', { class: 's', text: (n.pads ? n.pads.length : 0) + ' Pads · ' + (ok ? 'verbunden' : cnt + ' offen') + (n.length ? ' · ' + fmt(n.length, 1) + ' mm' : '') })]),
          ck
        ]));
      });
    }
    function renderSide(force) {
      if (!force && pane.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
      // Reiter-Zaehler aktualisieren
      const dc = drcCounts(), cn = getConn(), open = cn && cn.unrouted ? cn.unrouted.length : 0;
      const sigTabs = dc.n + '/' + dc.err + '/' + open;
      if (sigTabs !== S.tabSig) { S.tabSig = sigTabs; buildTabs(); }
      if (S.tab === 'props') renderProps(); else if (S.tab === 'drc') renderDrc(); else renderNets();
    }

    // ---- Lebenszyklus
    function resize() {
      rootEl.classList.toggle('pe-narrow', rootEl.clientWidth < 760);
      const W = stage.clientWidth, H = stage.clientHeight;
      if (!W || !H) return;
      S.dpr = Math.min(2, window.devicePixelRatio || 1);
      if (W !== S.W || H !== S.H || cv.width !== Math.round(W * S.dpr)) {
        const hadSize = S.W > 0;
        S.W = W; S.H = H;
        cv.width = Math.round(W * S.dpr); cv.height = Math.round(H * S.dpr);
        if (!hadSize || !S.fitted || !S.userView) fit(); else invalidate();
      }
    }
    function refresh() {
      if (S.destroyed) return;
      const b = ctx.getBoard();
      if (!b) return;
      if (b !== S.board) {
        const first = !S.board;
        S.board = b; S.sig = '';
        if (!S.keepHist) {
          S.undo = []; S.redo = []; S.sel = null; S.hiNet = null; S.trk = null; S.zone = null; S.meas = null; S.drag = null; S.arNets = {};
          if (!first) S.fitted = false;
        }
        buildActions();
      }
      const sig = JSON.stringify(b);
      if (sig !== S.sig) {
        S.sig = sig; S.rev++;
        if ((b.grid || 0.25) !== S.gridSeen) { S.gridSeen = b.grid || 0.25; buildActions(); }
        const lsig = cuList().join(',');
        if (lsig !== S.lsig) { S.lsig = lsig; buildLayers(); }
        validateSel();
        if (!S.fitted && S.W) fit();
      }
      S.propSig = '';
      buildTools(); buildFab();
      renderSide();
      updUndo();
      invalidate();
    }
    const onWinKey = function (e) { onKey(e); };
    const onWinKeyUp = function (e) { onKeyUp(e); };
    const onWinResize = function () { resize(); };
    let ro = null;
    function destroy() {
      S.destroyed = true;
      document.removeEventListener('keydown', onWinKey); document.removeEventListener('keyup', onWinKeyUp);
      window.removeEventListener('resize', onWinResize);
      if (ro) { try { ro.disconnect(); } catch (e) { /* egal */ } }
      if (S.raf) cancelAnimationFrame(S.raf);
      closePop();
      if (rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
    }
    function onShow() { resize(); if (!S.fitted) fit(); refresh(); invalidate(); }
    function onHide() { cancelOps(); closePop(); S.space = false; }
    /* Die UI ersetzt die Platine im Objekt (Beispiel laden, Aufgabe starten): Verlauf und Auswahl zuruecksetzen */
    function onBoard() {
      cancelOps(); closePop();
      S.undo = []; S.redo = []; S.sel = null; S.hiNet = null; S.arNets = {}; S.drcSel = null; S.fitted = false; S.sig = '';
      S.gridSeen = 0; S.layer = cuList()[0];
      buildLayers(); updUndo();
    }

    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onCancel);
    cv.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !S.ptrs.size) { S.curLive = false; invalidate(); } });
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('keydown', onWinKey);
    document.addEventListener('keyup', onWinKeyUp);
    window.addEventListener('resize', onWinResize);
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { resize(); }); ro.observe(stage); ro.observe(rootEl); }

    S.board = null;
    buildActions(); buildLayers(); buildZoom(); buildOpts(); buildTabs(); buildTools();
    setHint(HELP.select);
    resize();
    refresh();
    return { refresh: refresh, destroy: destroy, onShow: onShow, onHide: onHide, onBoard: onBoard, onResize: resize, undo: undo, redo: redo, canUndo: function () { return S.undo.length > 0; }, canRedo: function () { return S.redo.length > 0; }, _s: S, _api: { setTool: setTool, setLayer: setLayer, undo: undo, redo: redo, fit: fit, runAutoroute: runAutoroute, jumpTo: jumpTo, showXsec: showXsec, setV3: setV3, deleteSel: deleteSel } };
  }

  VIEWS.register('edit', { title: 'Layout', mount: mount });
})(typeof window !== 'undefined' ? window : globalThis);
