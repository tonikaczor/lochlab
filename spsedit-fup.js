/* spsedit-fup.js - SPS-Lab Editor Funktionsplan (FUP), id 'fup'
 * Gatter-Blöcke, automatisch von links nach rechts gezeichnet (SVG). Datenbasis wie KOP: prog.networks (Abschnitt 3.1).
 *
 * ENTSCHEIDUNGEN / BESONDERHEITEN
 *  - Layout: Spalte = Höhe des Teilbaums (Variablen links in Spalte 0, Blöcke gleicher Höhe stehen untereinander in einer
 *    Spalte). Die Eingangspins eines Blocks liegen genau auf den Zeilen seiner Kindknoten, daher sind alle Leitungen
 *    waagerecht bzw. (nur am Ausgang zu mehreren Zuweisungen) rechtwinklig und es kann nichts überlappen.
 *  - Negationskreis am Eingang = neg einer Variablen bzw. eines Kind-Blocks; am Ausgang = neg des Blocks.
 *    Flanke oder Konstante negieren: die Flanke wird in ein negiertes Gatter (NICHT) gepackt, die Konstante umgedreht.
 *  - Neue Gatter nehmen das angetippte Signal als ersten Eingang; zweiter Eingang ist die Konstante 1 (UND) bzw. 0 (ODER/XOR)
 *    und wird per Antippen ersetzt. Gatter: 2 bis 6 Eingänge (aus KOP geladene längere Reihen werden vollständig gezeichnet).
 *  - Ein Gatter mit einem Eingang ohne Negation wird beim Bearbeiten automatisch aufgelöst.
 *  - Netzwerk-Felder wie im KOP: title, comment (optional). Zeit: ctx.ask type 'time' bekommt ms als Zahl, akzeptiert Zahl
 *    oder Text ("2s", "500ms", "1,5 s").
 *  - Beschriftung: IEC: & / ≥1 / =1, TON/TOF/TP/CTU/CTD; Siemens: & / ≥1 / XOR, SE/SA/SI/ZV/ZR (Adressen über SPS_CORE.addr).
 *  - Rückgängig/Wiederholen: lokal, 60 Schritte, Reset bei neuem Programmobjekt.
 */
(function (root) {
  'use strict';
  const SE = root.SPS_EDIT = root.SPS_EDIT || { editors: {}, register: function (id, def) { this.editors[id] = def; } };
  const NS = 'http://www.w3.org/2000/svg';

  const ROW = 64, WY = 42, PADL = 12, LEAFW = 138, GAPX = 40, GATEW = 56, FBW = 132, OUTBOX = 46, OUTLAB = 128;
  const MAXH = 60, MAXIN = 6, MAXHEIGHT = 6, MAXOUT = 6;
  const COLN = '#aeb9c5', COLOFF = '#59636f', COLON = '#4cd964';
  const TN = '#e6edf3', TOFF = '#7d8895';

  const PINK = ['in', 's', 'r', 'ld'];
  const FBINFO = {
    ton: { cls: 'T', pins: ['in'], lab: 'TON', s7: 'SE', name: 'Einschaltverzögerung (TON)' },
    tof: { cls: 'T', pins: ['in'], lab: 'TOF', s7: 'SA', name: 'Ausschaltverzögerung (TOF)' },
    tp: { cls: 'T', pins: ['in'], lab: 'TP', s7: 'SI', name: 'Impuls (TP)' },
    ctu: { cls: 'C', pins: ['in', 'r'], lab: 'CTU', s7: 'ZV', name: 'Vorwärtszähler (CTU)' },
    ctd: { cls: 'C', pins: ['in', 'ld'], lab: 'CTD', s7: 'ZR', name: 'Rückwärtszähler (CTD)' },
    rs: { cls: 'F', pins: ['s', 'r'], lab: 'RS', s7: 'RS', name: 'Flipflop, Rücksetzen dominiert (RS)' },
    sr: { cls: 'F', pins: ['s', 'r'], lab: 'SR', s7: 'SR', name: 'Flipflop, Setzen dominiert (SR)' }
  };
  const PINLAB = {
    ton: { in: 'IN' }, tof: { in: 'IN' }, tp: { in: 'IN' },
    ctu: { in: 'CU', r: 'R' }, ctd: { in: 'CD', ld: 'LD' },
    rs: { s: 'S', r: 'R1' }, sr: { s: 'S1', r: 'R' }
  };
  const PINLAB7 = { ctu: { in: 'ZV', r: 'R' }, ctd: { in: 'ZR', ld: 'S' }, rs: { s: 'S', r: 'R' }, sr: { s: 'S', r: 'R' } };
  const OPNAME = {
    iec: { and: 'UND  (AND, &)', or: 'ODER  (OR, ≥1)', xor: 'XOR  (=1)' },
    s7: { and: 'UND  (U, &)', or: 'ODER  (O, ≥1)', xor: 'XODER  (X)' }
  };

  const isObj = function (x) { return x !== null && typeof x === 'object' && !Array.isArray(x); };

  // ------------------------------------------------------------ Baum-Helfer
  const isGate = function (n) { return n.t === 'and' || n.t === 'or' || n.t === 'xor'; };
  const isLeaf = function (n) { return n.t === 'var' || n.t === 'edge' || n.t === 'const'; };
  function childList(n) {
    if (isGate(n)) return (n.in || []).map(function (c, i) { return { key: i, idx: i, node: c }; });
    if (n.t === 'fb' && FBINFO[n.fb]) return FBINFO[n.fb].pins.map(function (k) { return { key: k, idx: PINK.indexOf(k), node: n[k] }; });
    return [];
  }
  function resolve(expr, path) {
    const segs = path.split('.').slice(1);
    let node = expr, parent = null, key = null, ppath = null, cur = 'n0';
    for (let i = 0; i < segs.length; i++) {
      if (!node) return null;
      parent = node; ppath = cur;
      key = node.t === 'fb' ? PINK[+segs[i]] : +segs[i];
      node = node.t === 'fb' ? node[key] : (node.in || [])[key];
      cur += '.' + segs[i];
    }
    return { node: node, parent: parent, key: key, parentPath: ppath, path: path };
  }
  function setAt(net, path, val) {
    if (path === 'n0') { net.expr = val; return; }
    const r = resolve(net.expr, path);
    if (!r || !r.parent) return;
    if (r.parent.t === 'fb') { if (val === undefined) delete r.parent[r.key]; else r.parent[r.key] = val; }
    else r.parent.in[r.key] = val;
  }
  function norm(n) {
    if (!isObj(n)) return n;
    if (isGate(n)) {
      const list = (n.in || []).map(norm).filter(Boolean);
      if (!list.length) return { t: 'const', v: n.t === 'and' };
      if (list.length === 1 && !n.neg) return list[0];
      n.in = list;
      return n;
    }
    if (n.t === 'fb' && FBINFO[n.fb]) {
      const keep = FBINFO[n.fb].pins;
      PINK.forEach(function (k) {
        if (keep.indexOf(k) < 0) delete n[k];
        else if (n[k]) n[k] = norm(n[k]);
      });
    }
    return n;
  }
  const isEmptyExpr = function (e) { return !e || (e.t === 'const' && e.v === true); };
  function treeHeight(n) {
    if (!isObj(n) || isLeaf(n)) return 0;
    let m = -1;
    childList(n).forEach(function (c) { m = Math.max(m, c.node ? treeHeight(c.node) : 0); });
    return m + 1 + (childList(n).length ? 0 : 0);
  }
  function collectFb(expr, acc) {
    if (!isObj(expr)) return acc;
    if (expr.t === 'fb') acc.push(expr);
    childList(expr).forEach(function (c) { if (c.node) collectFb(c.node, acc); });
    return acc;
  }
  function allFbs(prog) {
    const acc = [];
    (prog.networks || []).forEach(function (n) { if (n && n.expr) collectFb(n.expr, acc); });
    return acc;
  }
  function freeId(prog, cls) {
    const used = {};
    allFbs(prog).forEach(function (f) { used[f.id] = true; });
    if (cls === 'T') { for (let i = 1; i <= 16; i++) if (!used['T' + i]) return 'T' + i; return null; }
    if (cls === 'C') { for (let i = 1; i <= 16; i++) if (!used['C' + i]) return 'C' + i; return null; }
    for (let i = 1; i < 100; i++) if (!used['FF' + i]) return 'FF' + i;
    return null;
  }
  function renameRefs(e, from, to) {
    if (!isObj(e)) return;
    if ((e.t === 'var' || e.t === 'edge') && e.a === from) e.a = to;
    childList(e).forEach(function (c) { if (c.node) renameRefs(c.node, from, to); });
  }
  function fmtMs(ms) {
    ms = Number(ms) || 0;
    if (ms < 1000) return Math.round(ms) + ' ms';
    return String(+(ms / 1000).toFixed(2)).replace('.', ',') + ' s';
  }
  function parseTime(v) {
    if (typeof v === 'number') return isFinite(v) && v >= 0 ? Math.round(v) : NaN;
    if (typeof v !== 'string') return NaN;
    const m = /^\s*(\d+(?:[.,]\d+)?)\s*(ms|s|sek|min)?\s*$/i.exec(v);
    if (!m) return NaN;
    let x = parseFloat(m[1].replace(',', '.'));
    const u = (m[2] || 'ms').toLowerCase();
    if (u === 's' || u === 'sek') x *= 1000; else if (u === 'min') x *= 60000;
    return Math.round(x);
  }

  // ------------------------------------------------------------ CSS
  function injectCss() {
    if (document.getElementById('spf-css')) return;
    const st = document.createElement('style');
    st.id = 'spf-css';
    st.textContent = [
      '.spf{--bg:#14181c;--card:#222830;--card2:#2c343e;--acc:#3b9eff;--on:#4cd964;--txt:#e6edf3;--mut:#8b98a6;--bad:#ff7b72;',
      'color:var(--txt);font:14px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);height:100%;min-height:160px;display:flex;flex-direction:column;box-sizing:border-box;-webkit-text-size-adjust:100%}',
      '.spf *{box-sizing:border-box}',
      '.spf-bar{display:flex;flex-wrap:wrap;gap:6px;padding:6px 8px;background:var(--card);border-bottom:1px solid #0b0d10;align-items:center;flex:none}',
      '.spf-b{min-width:44px;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid #3a4552;background:var(--card2);color:var(--txt);font:600 15px system-ui,sans-serif;cursor:pointer;touch-action:manipulation;display:inline-flex;align-items:center;justify-content:center;gap:6px}',
      '.spf-b:active{background:#394554}.spf-b[disabled]{opacity:.35;cursor:default}',
      '.spf-b.acc{background:var(--acc);border-color:var(--acc);color:#04121f}',
      '.spf-b.bad{color:var(--bad)}',
      '.spf-sep{width:1px;height:28px;background:#3a4552;margin:0 4px}',
      '.spf-info{color:var(--mut);font-size:12px;margin-left:auto;padding-right:4px}',
      '.spf-err{flex:none;margin:0;padding:8px 12px;background:#3a2326;color:#ffb4ad;font-size:13px;border-bottom:1px solid #0b0d10;cursor:pointer}',
      '.spf-body{flex:1;overflow:auto;padding:10px;min-height:0;-webkit-overflow-scrolling:touch}',
      '.spf-net{background:var(--card);border:2px solid transparent;border-radius:12px;margin-bottom:12px;position:relative}',
      '.spf-net.sel{border-color:var(--acc)}.spf-net.bad{border-color:#7a3a3a}',
      '.spf-nh{display:flex;gap:10px;align-items:center;padding:6px 10px;min-height:42px;cursor:pointer}',
      '.spf-nn{background:var(--card2);border-radius:8px;padding:3px 10px;font-weight:700;color:var(--acc);flex:none}',
      '.spf-nt{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.spf-nt i{color:var(--mut);font-weight:400}',
      '.spf-nc{padding:0 12px 4px;color:var(--mut);font-size:13px;font-style:italic}',
      '.spf-ne{padding:0 12px 4px;color:var(--bad);font-size:12px}',
      '.spf-tools{display:flex;gap:6px;padding:4px 8px 8px;flex-wrap:wrap}',
      '.spf-sc{overflow-x:auto;padding:0 8px 8px;-webkit-overflow-scrolling:touch}',
      '.spf svg{display:block;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}',
      '.spf svg text{pointer-events:none;fill:#e6edf3;font:12px system-ui,-apple-system,"Segoe UI",sans-serif}',
      '.spf svg .tb{font-weight:700;font-size:13px}.spf svg .tm{fill:#9aa7b5;font-size:10.5px}.spf svg .tv{font-size:10.5px;font-weight:700}',
      '.spf svg .tt{font-size:11px;fill:#9aa7b5}',
      '.spf svg .hit{fill:transparent;cursor:pointer;pointer-events:all}',
      '.spf svg .hit:hover{fill:rgba(59,158,255,.10)}',
      '.spf svg .plus{fill:rgba(59,158,255,.12);stroke:#3b9eff;stroke-width:2;stroke-dasharray:4 3}',
      '.spf svg .plust{fill:#3b9eff;font-size:22px;font-weight:700}',
      '.spf-empty{padding:30px;text-align:center;color:var(--mut)}',
      '@media (max-width:560px){.spf-b span{display:none}.spf-b{padding:0 10px}.spf-bar{gap:4px}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function S(tag, at, par) {
    const e = document.createElementNS(NS, tag);
    if (at) for (const k in at) e.setAttribute(k, at[k]);
    if (par) par.appendChild(e);
    return e;
  }
  function tx(par, x, y, text, cls, anchor) {
    const e = S('text', { x: x, y: y, 'text-anchor': anchor || 'middle' }, par);
    if (cls) e.setAttribute('class', cls);
    e.textContent = text;
    return e;
  }
  function trunc(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  // ------------------------------------------------------------ Editor
  function mount(el, ctx) {
    injectCss();
    const C = root.SPS_CORE;
    const rootEl = document.createElement('div');
    rootEl.className = 'spf';
    rootEl.innerHTML =
      '<div class="spf-bar">' +
      '<button class="spf-b" data-c="undo" title="Rückgängig">↶ <span>Zurück</span></button>' +
      '<button class="spf-b" data-c="redo" title="Wiederholen">↷</button><span class="spf-sep"></span>' +
      '<button class="spf-b" data-c="zout" title="Kleiner">A−</button><button class="spf-b" data-c="zin" title="Größer">A+</button>' +
      '<button class="spf-b" data-c="zfit" title="Einpassen">⤢</button><span class="spf-sep"></span>' +
      '<button class="spf-b acc" data-c="addnet">＋ Netzwerk</button>' +
      '<span class="spf-info"></span></div>' +
      '<div class="spf-err" hidden></div><div class="spf-body"></div>';
    el.appendChild(rootEl);
    const bar = rootEl.querySelector('.spf-bar'), errEl = rootEl.querySelector('.spf-err'), body = rootEl.querySelector('.spf-body');
    const infoEl = rootEl.querySelector('.spf-info');
    const btnUndo = bar.querySelector('[data-c=undo]'), btnRedo = bar.querySelector('[data-c=redo]');

    let sel = -1, lastSig = null, lastProg = null, busy = false, errOpen = false;
    const undo = [], redo = [];
    let views = [];
    let zoom = 1;
    try { const z = parseFloat(localStorage.getItem('sps.fup.zoom')); if (z >= 0.4 && z <= 2.5) zoom = z; else zoom = (el.clientWidth || window.innerWidth) < 640 ? 0.8 : 1; } catch (e) { zoom = 1; }

    const prog = function () { return ctx.getProg(); };
    const ro = function () { return !!ctx.readonly; };
    const toast = function (m) { if (ctx.toast) ctx.toast(m); };
    const mode = function () { return ctx.addrMode ? ctx.addrMode() : 'iec'; };

    function labLines(key) {
      const p = prog();
      const a = C.addr(key, mode());
      const sym = ctx.showSymbols && ctx.showSymbols() && p.symbols && p.symbols[key];
      return sym ? [String(sym), a] : [a];
    }
    function gateSym(n) {
      if (n.in && n.in.length === 1) return '1';
      if (n.t === 'xor') return mode() === 's7' ? 'XOR' : '=1';
      return n.t === 'or' ? '≥1' : '&';
    }
    function pinLabel(n, k) {
      const m = mode() === 's7' ? PINLAB7[n.fb] : null;
      return (m && m[k]) || (PINLAB[n.fb] && PINLAB[n.fb][k]) || k.toUpperCase();
    }

    // ---- Layout ------------------------------------------------------
    // Block: { k:'leaf'|'node'|'ph', n, path, ch, rows, hgt, boxW, eW:[], eRaw:[], eBody:[], eTxt:[] }
    function lay(n, path) {
      if (isLeaf(n)) return { k: 'leaf', n: n, path: path, rows: 1, hgt: 0, eW: [], eRaw: [], eBody: [], eTxt: [] };
      const isFb = n.t === 'fb' && !!FBINFO[n.fb];
      let ch;
      if (isFb) {
        ch = FBINFO[n.fb].pins.map(function (k) {
          const idx = PINK.indexOf(k);
          return n[k] ? lay(n[k], path + '.' + idx) : { k: 'ph', owner: path, pin: k, path: path + '.' + idx, rows: 1, hgt: 0, eW: [] };
        });
      } else ch = (n.in || []).map(function (c, i) { return lay(c, path + '.' + i); });
      let rows = 0, hg = 0, last = 0;
      ch.forEach(function (c, i) { if (i === ch.length - 1) last = rows; rows += c.rows; hg = Math.max(hg, c.hgt); });
      const boxRows = Math.max(isFb ? 2 : 1, last + 1);
      const boxW = (isFb ? FBW : GATEW) + (n.neg ? 12 : 0);
      return { k: 'node', n: n, path: path, ch: ch, rows: Math.max(rows, boxRows), boxRows: boxRows, hgt: hg + 1, isFb: isFb, boxW: boxW, eW: [], eRaw: [], eBody: [], eTxt: [] };
    }
    function colInfo(b, colW) {
      if (b.k === 'node') {
        colW[b.hgt] = Math.max(colW[b.hgt] || 0, b.boxW);
        b.ch.forEach(function (c) { colInfo(c, colW); });
      }
    }

    // ---- Zeichnen ----------------------------------------------------
    function wire(g, list, x1, y1, x2, y2) {
      const l = S('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: COLN, 'stroke-width': 3 }, g);
      if (list) list.push(l);
      return l;
    }
    function hit(g, x, y, w, h, d) {
      const r = S('rect', { x: x, y: y, width: w, height: h, class: 'hit' }, g);
      for (const k in d) r.setAttribute('data-' + k, d[k]);
      return r;
    }
    function bubble(g, cx, cy, list) {
      const c = S('circle', { cx: cx, cy: cy, r: 5.5, fill: '#14181c', stroke: COLN, 'stroke-width': 2.5 }, g);
      if (list) list.push(c);
      return c;
    }
    function lab(g, x, y0, key, anchor) {
      const ls = labLines(key);
      if (ls.length === 2) { tx(g, x, y0 - 22, trunc(ls[0], 15), 'tb', anchor); tx(g, x, y0 - 10, trunc(ls[1], 17), 'tm', anchor); }
      else tx(g, x, y0 - 10, trunc(ls[0], 17), 'tb', anchor);
    }

    // zeichnet Block b (Start in Zeile r). Rückgabe nicht nötig; setzt b.outX, b.y (y der Hauptleitung)
    function draw(g, b, r, nv) {
      const y0 = r * ROW + WY;
      b.y = y0;
      if (b.k === 'leaf') { drawLeaf(g, b, r, nv); return; }
      if (b.k === 'ph') {
        const x = PADL, cx = x + 40;
        b.outX = x + LEAFW;
        wire(g, null, cx + 17, y0, x + LEAFW, y0);
        if (!ro()) {
          S('circle', { cx: cx, cy: y0, r: 17, class: 'plus' }, g);
          tx(g, cx, y0 + 8, '+', 'plust');
          hit(g, x, r * ROW, LEAFW, ROW, { act: 'pin', net: nv.idx, path: b.owner, key: b.pin });
        }
        b.wireStart = x + LEAFW;
        return;
      }
      // Knoten
      const n = b.n, bx = nv.colX[b.hgt];
      let rr = r;
      b.ch.forEach(function (c) { draw(g, c, rr, nv); rr += c.rows; });
      // Eingangsleitungen
      b.ch.forEach(function (c) { pinWire(g, c, bx, nv); });
      const bh = b.boxRows * ROW - 14;
      b.box = S('rect', { x: bx, y: r * ROW + 7, width: b.boxW - (n.neg ? 12 : 0), height: bh, rx: 6, fill: '#1a2027', stroke: COLN, 'stroke-width': 3 }, g);
      b.eBody.push(b.box);
      const bw = b.boxW - (n.neg ? 12 : 0);
      let ox = bx + bw;
      if (n.neg) { bubble(g, ox + 6, y0, b.eBody); ox += 12; }
      b.outX = ox;
      if (b.isFb) {
        const inf = FBINFO[n.fb];
        b.ch.forEach(function (c, i) { tx(g, bx + 7, c.y + 4, pinLabel(n, inf.pins[i]), 'tb', 'start'); });
        tx(g, bx + bw / 2, r * ROW + 24, mode() === 's7' ? inf.s7 : inf.lab, 'tb');
        let inst = inf.cls === 'F' ? String(n.id) : C.addr(n.id, mode());
        const ls = labLines(n.id);
        tx(g, bx + bw / 2, r * ROW + 36, trunc(ls.length === 2 ? ls[0] + ' · ' + inst : inst, 18), 'tm');
        tx(g, bx + bw - 7, y0 + 4, 'Q', 'tb', 'end');
        const iy = (r + 1) * ROW + 14, cx = bx + bw / 2 + 6;
        if (inf.cls === 'T' || inf.cls === 'C') {
          tx(g, cx, iy, inf.cls === 'T' ? 'PT ' + fmtMs(n.pt) : 'PV ' + (Number(n.pv) || 0), 'tt');
          b.info = tx(g, cx, iy + 14, '', 'tt');
          b.barBg = S('rect', { x: bx + 32, y: iy + 21, width: bw - 44, height: 7, rx: 3, fill: '#313a45' }, g);
          b.bar = S('rect', { x: bx + 12, y: iy + 21, width: 0, height: 7, rx: 3, fill: COLON }, g);
          b.barW = bw - 44;
        } else b.info = tx(g, cx, iy + 6, '', 'tt');
      } else {
        const t = tx(g, bx + bw / 2, y0 + 5, gateSym(n), 'tb');
        t.setAttribute('style', 'font-size:' + (gateSym(n).length > 2 ? 13 : 17) + 'px');
      }
      hit(g, bx, r * ROW + 7, bw, bh, { act: 'box', net: nv.idx, path: b.path });
    }

    // Leitung vom Ausgang des Kindes c zum Pin an der Box (Spalte x = px)
    function pinWire(g, c, px, nv) {
      const y = c.y;
      if (c.k === 'ph') { wire(g, null, c.outX, y, px, y); return; }
      const n = c.n;
      if (c.k === 'leaf' && n.t === 'var' && n.neg) {
        wire(g, c.eRaw, c.outX, y, px - 13, y);
        bubble(g, px - 7, y, c.eBody);
        wire(g, c.eW, px - 1.5, y, px, y);
      } else {
        wire(g, c.eW, c.outX, y, px, y);
      }
      c.pinTxt = tx(g, px - 6, y - 7, '', 'tv', 'end');
    }

    function drawLeaf(g, b, r, nv) {
      const n = b.n, x = PADL, y0 = b.y;
      b.outX = x + LEAFW;
      if (n.t === 'const') {
        const rc = S('rect', { x: x + 4, y: y0 - 12, width: 34, height: 24, rx: 4, fill: 'none', stroke: COLN, 'stroke-width': 3 }, g);
        b.eBody.push(rc);
        b.eTxt.push(tx(g, x + 21, y0 + 5, n.v ? '1' : '0', 'tb'));
        tx(g, x + 4, y0 - 17, n.v ? 'TRUE' : 'FALSE', 'tm', 'start');
        wire(g, b.eRaw, x + 38, y0, b.outX, y0); b.eW = b.eRaw;
      } else if (n.t === 'edge') {
        const ex = x + LEAFW - 46;
        wire(g, b.eRaw, x + 2, y0, ex, y0);
        const rc = S('rect', { x: ex, y: y0 - 12, width: 30, height: 24, rx: 4, fill: 'none', stroke: COLN, 'stroke-width': 3 }, g);
        b.eBody.push(rc);
        b.eTxt.push(tx(g, ex + 15, y0 + 5, n.mode === 'N' ? 'N' : 'P', 'tb'));
        wire(g, b.eW, ex + 30, y0, b.outX, y0);
        lab(g, x + 2, y0, n.a, 'start');
      } else {
        wire(g, n.neg ? b.eRaw : b.eW, x + 2, y0, b.outX, y0);
        if (n.neg) { /* Rest der Leitung (hinter dem Kreis) zeichnet pinWire */ }
        lab(g, x + 2, y0, n.a, 'start');
      }
      hit(g, x, r * ROW, LEAFW, ROW, { act: 'leaf', net: nv.idx, path: b.path });
    }

    // ---- Netzwerk aufbauen -------------------------------------------
    function netErrors(net, ni) {
      const id = net.id || ('N' + (ni + 1));
      const out = [];
      (ctx.errors ? ctx.errors() : []).forEach(function (e) {
        if (typeof e === 'string' && (e.indexOf('Netzwerk ' + id + ' ') >= 0 || e.indexOf('Netzwerk ' + id + ':') >= 0 || e.indexOf('Netzwerk ' + id + '.') >= 0)) out.push(e);
      });
      return out;
    }

    function buildNet(ni) {
      const p = prog(), net = p.networks[ni];
      const nid = net.id || ('N' + (ni + 1));
      const selected = ni === sel && !ro();
      const card = document.createElement('div');
      card.className = 'spf-net' + (selected ? ' sel' : '');
      const errs = netErrors(net, ni);
      if (errs.length && !selected) card.classList.add('bad');
      const head = document.createElement('div');
      head.className = 'spf-nh';
      head.innerHTML = '<span class="spf-nn"></span><span class="spf-nt"></span>';
      head.firstChild.textContent = 'N' + (ni + 1);
      const ttl = head.lastChild;
      if (net.title) ttl.textContent = net.title; else ttl.innerHTML = '<i>Netzwerk ' + (ni + 1) + '</i>';
      head.addEventListener('click', function () { select(selected ? -1 : ni); });
      card.appendChild(head);
      if (net.comment) { const c = document.createElement('div'); c.className = 'spf-nc'; c.textContent = net.comment; card.appendChild(c); }
      if (errs.length) { const c = document.createElement('div'); c.className = 'spf-ne'; c.textContent = '⚠ ' + errs[0]; card.appendChild(c); }
      if (selected) {
        const t = document.createElement('div');
        t.className = 'spf-tools';
        t.innerHTML = '<button class="spf-b" data-n="title">✎ Titel</button><button class="spf-b" data-n="up" title="Nach oben">▲</button>' +
          '<button class="spf-b" data-n="down" title="Nach unten">▼</button><button class="spf-b" data-n="add">＋ darunter</button>' +
          '<button class="spf-b bad" data-n="del">🗑 Löschen</button>';
        t.querySelector('[data-n=up]').disabled = ni === 0;
        t.querySelector('[data-n=down]').disabled = ni === p.networks.length - 1;
        t.addEventListener('click', function (ev) {
          const b = ev.target.closest('button'); if (!b || b.disabled) return;
          netOp(b.dataset.n, ni);
        });
        card.appendChild(t);
      }

      const expr = net.expr && isObj(net.expr) ? net.expr : { t: 'const', v: true };
      const outs = Array.isArray(net.outs) ? net.outs : [];
      const empty = isEmptyExpr(expr);
      const nv = { idx: ni, id: nid, net: net, tail: [], coils: [], colX: [] };
      const rootB = empty ? { k: 'ph', owner: null, pin: null, path: 'n0', rows: 1, hgt: 0, eW: [], isRoot: true } : lay(expr, 'n0');
      const colW = [LEAFW];
      colInfo(rootB, colW);
      const maxH = rootB.hgt || 0;
      nv.colX[0] = PADL;
      for (let c = 1; c <= maxH; c++) nv.colX[c] = nv.colX[c - 1] + (c === 1 ? LEAFW : colW[c - 1] || GATEW) + GAPX;
      const lastRight = maxH === 0 ? PADL + LEAFW : nv.colX[maxH] + (colW[maxH] || GATEW);
      const jx = lastRight + 26, ox = jx + 24;
      const showPlus = !ro() && (selected || outs.length === 0) && outs.length < MAXOUT;
      const outRows = outs.length + (showPlus ? 1 : 0);
      const rows = Math.max(rootB.rows, outRows, 1);
      const Wd = ox + OUTBOX + OUTLAB, Ht = rows * ROW + 8;
      const svg = S('svg', { viewBox: '0 0 ' + Wd + ' ' + Ht, width: Math.round(Wd * zoom), height: Math.round(Ht * zoom), 'data-net': ni });
      const g = S('g', null, svg);
      nv.svg = svg; nv.root = rootB; nv.W = Wd;
      if (empty) {
        // Platzhalter für leeres Netzwerk
        const x = PADL, cx = x + 40, y0 = WY;
        rootB.outX = x + LEAFW; rootB.y = y0;
        S('circle', { cx: cx, cy: y0, r: 17, class: 'plus' }, g);
        tx(g, cx, y0 + 8, '+', 'plust');
        tx(g, cx + 24, y0 + 4, 'Signal oder Block einsetzen', 'tm', 'start');
        hit(g, x, 0, LEAFW + 60, ROW, { act: 'root', net: ni });
      } else draw(g, rootB, 0, nv);
      // Ausgangsleitung -> Verteiler -> Zuweisungen
      const y0 = WY;
      nv.tail.push(wire(g, null, rootB.outX, y0, jx, y0));
      if (!empty) { rootB.pinTxt = tx(g, jx - 6, y0 - 7, '', 'tv', 'end'); }
      if (outRows > 1) nv.tail.push(wire(g, null, jx, y0, jx, (outRows - 1) * ROW + WY));
      outs.forEach(function (o, j) {
        const my = j * ROW + WY;
        nv.tail.push(wire(g, null, jx, my, o.neg ? ox - 12 : ox, my));
        if (outRows > 1) nv.tail.push(S('circle', { cx: jx, cy: my, r: 3.5, fill: COLN }, g));
        if (o.neg) { bubble(g, ox - 6, my, null); }
        const box = S('rect', { x: ox, y: my - 16, width: OUTBOX, height: 32, rx: 5, fill: '#1a2027', stroke: COLN, 'stroke-width': 3 }, g);
        const sym = o.t === 'set' ? 'S' : o.t === 'reset' ? 'R' : '=';
        const t = tx(g, ox + OUTBOX / 2, my + 5, sym, 'tb');
        t.setAttribute('style', 'font-size:16px');
        const ls = labLines(o.a);
        const lx = ox + OUTBOX + 8;
        if (ls.length === 2) { tx(g, lx, my - 4, trunc(ls[0], 15), 'tb', 'start'); tx(g, lx, my + 9, trunc(ls[1], 17), 'tm', 'start'); }
        else tx(g, lx, my + 4, trunc(ls[0], 17), 'tb', 'start');
        const val = tx(g, lx + 0, my + 22, '', 'tv', 'start');
        nv.coils.push({ box: box, txt: t, val: val, o: o, wire: nv.tail[nv.tail.length - 1], neg: !!o.neg, j: j });
        hit(g, ox, my - ROW / 2 + 4, OUTBOX + OUTLAB, ROW - 8, { act: 'out', net: ni, out: j });
      });
      if (showPlus) {
        const my = outs.length * ROW + WY, cx = ox + OUTBOX / 2;
        nv.tail.push(wire(g, null, jx, my, cx - 17, my));
        S('circle', { cx: cx, cy: my, r: 17, class: 'plus' }, g);
        tx(g, cx, my + 8, '+', 'plust');
        hit(g, ox, my - ROW / 2 + 4, OUTBOX + OUTLAB, ROW - 8, { act: 'outslot', net: ni });
      }
      svg.addEventListener('click', function (ev) {
        const t = ev.target.closest ? ev.target.closest('[data-act]') : null;
        if (!t) return;
        ev.stopPropagation();
        act(ni, t.dataset);
      });
      const sc = document.createElement('div');
      sc.className = 'spf-sc';
      sc.appendChild(svg);
      sc.addEventListener('click', function (ev) { if (ev.target === sc && !ro()) select(selected ? -1 : ni); });
      card.appendChild(sc);
      nv.card = card; nv.sc = sc;
      return nv;
    }

    function build() {
      const keepTop = body.scrollTop;
      const keepLeft = views.map(function (v) { return v.sc ? v.sc.scrollLeft : 0; });
      body.textContent = '';
      views = [];
      const p = prog();
      if (!Array.isArray(p.networks)) p.networks = [];
      if (sel >= p.networks.length) sel = -1;
      if (!p.networks.length) {
        const d = document.createElement('div'); d.className = 'spf-empty';
        d.innerHTML = '<p>Noch kein Netzwerk.</p>';
        const b = document.createElement('button'); b.className = 'spf-b acc'; b.textContent = '＋ Erstes Netzwerk anlegen';
        b.addEventListener('click', function () { netOp('add', -1); });
        d.appendChild(b); body.appendChild(d);
      }
      for (let i = 0; i < p.networks.length; i++) {
        try { const v = buildNet(i); views.push(v); body.appendChild(v.card); }
        catch (e) {
          const d = document.createElement('div'); d.className = 'spf-net'; d.style.padding = '10px';
          d.textContent = 'Netzwerk ' + (i + 1) + ' kann nicht dargestellt werden: ' + (e && e.message ? e.message : e);
          body.appendChild(d); views.push({ idx: i });
          if (root.console) console.error(e);
        }
      }
      if (p.networks.length) {
        const add = document.createElement('button');
        add.className = 'spf-b'; add.style.width = '100%'; add.textContent = '＋ Netzwerk hinzufügen';
        add.disabled = ro();
        add.addEventListener('click', function () { netOp('add', p.networks.length - 1); });
        body.appendChild(add);
      }
      body.scrollTop = keepTop;
      views.forEach(function (v, i) { if (v.sc && keepLeft[i]) v.sc.scrollLeft = keepLeft[i]; });
      updBar();
      paintLive();
    }

    function updBar() {
      const r = ro();
      btnUndo.disabled = r || !undo.length;
      btnRedo.disabled = r || !redo.length;
      bar.querySelector('[data-c=addnet]').disabled = r;
      infoEl.textContent = Math.round(zoom * 100) + ' %';
      const errs = ctx.errors ? ctx.errors() : [];
      if (errs && errs.length) {
        errEl.hidden = false;
        errEl.textContent = errOpen ? '⚠ ' + errs.join('\n⚠ ') : '⚠ ' + errs[0] + (errs.length > 1 ? '  (+' + (errs.length - 1) + ' weitere, antippen)' : '');
        errEl.style.whiteSpace = errOpen ? 'pre-wrap' : 'nowrap';
        errEl.style.overflow = 'hidden'; errEl.style.textOverflow = 'ellipsis';
      } else errEl.hidden = true;
    }
    errEl.addEventListener('click', function () { errOpen = !errOpen; updBar(); });

    // ---- Livewerte ---------------------------------------------------
    function paintS(list, v) {
      if (!list) return;
      const c = v < 0 ? COLN : v ? COLON : COLOFF;
      for (let i = 0; i < list.length; i++) { const e = list[i]; if (e._c !== v) { e._c = v; e.setAttribute('stroke', c); } }
    }
    function paintT(list, v) {
      if (!list) return;
      const c = v < 0 ? TN : v ? COLON : TOFF;
      for (let i = 0; i < list.length; i++) { const e = list[i]; if (e._c !== v) { e._c = v; e.style.fill = c; } }
    }
    function setTxt(e, s, on) {
      if (!e) return;
      if (e.textContent !== s) e.textContent = s;
      if (s) e.style.fill = on ? COLON : TOFF;
    }
    function opVal(key, lv) {
      const s = lv && lv.state; if (!s) return false;
      let m;
      if (/^I\d/.test(key)) return !!(s.I && s.I[key]);
      if (/^Q\d/.test(key)) return !!(s.Q && s.Q[key]);
      if (/^M\d/.test(key)) return !!(s.M && s.M[key]);
      if ((m = /^(T\d+)\.(Q|ET)$/.exec(key))) { const t = s.T && s.T[m[1]]; return !!(t && (m[2] === 'Q' ? t.q : t.et > 0)); }
      if ((m = /^(C\d+)\.(Q|CV)$/.exec(key))) { const c = s.C && s.C[m[1]]; return !!(c && (m[2] === 'Q' ? c.q : c.cv > 0)); }
      if ((m = /^(\w+)\.Q$/.exec(key))) { const f = s.F && s.F[m[1]]; return !!(f && f.q); }
      return false;
    }
    function walk(b, nodes, lv) {
      if (b.k === 'ph') return;
      const st = function (v) { return lv ? (v ? 1 : 0) : -1; };
      const v = !!nodes[b.path];
      if (b.k === 'leaf') {
        const n = b.n;
        const raw = n.t === 'var' ? (n.neg ? !v : v) : n.t === 'edge' ? opVal(n.a, lv) : v;
        paintS(b.eRaw, st(raw)); paintS(b.eW, st(v));
        paintS(b.eBody, st(v)); paintT(b.eTxt, st(v));
        setTxt(b.pinTxt, lv ? (v ? '1' : '0') : '', v);
        return;
      }
      b.ch.forEach(function (c) { walk(c, nodes, lv); });
      paintS(b.eW, st(v)); paintS(b.eBody, st(v));
      setTxt(b.pinTxt, lv ? (v ? '1' : '0') : '', v);
      if (b.isFb) liveBox(b, lv);
    }
    function liveBox(b, lv) {
      const n = b.n, inf = FBINFO[n.fb];
      if (!b.info) return;
      const stt = lv && lv.state;
      if (inf.cls === 'T') {
        const t = stt && stt.T && stt.T[n.id];
        if (t) {
          setTxt(b.info, 'ET ' + fmtMs(t.et), t.q);
          b.info.style.fill = '#9aa7b5';
          b.bar.setAttribute('width', ((t.pt > 0 ? Math.max(0, Math.min(1, t.et / t.pt)) : (t.q ? 1 : 0)) * b.barW).toFixed(1));
        } else { b.info.textContent = ''; b.bar.setAttribute('width', 0); }
      } else if (inf.cls === 'C') {
        const c = stt && stt.C && stt.C[n.id];
        if (c) {
          setTxt(b.info, 'CV ' + c.cv, c.q);
          b.info.style.fill = '#9aa7b5';
          b.bar.setAttribute('width', ((c.pv > 0 ? Math.max(0, Math.min(1, c.cv / c.pv)) : 0) * b.barW).toFixed(1));
        } else { b.info.textContent = ''; b.bar.setAttribute('width', 0); }
      } else {
        const f = stt && stt.F && stt.F[n.id];
        setTxt(b.info, f ? 'Q = ' + (f.q ? '1' : '0') : '', f && f.q);
      }
    }
    function paintLive() {
      let lv = null;
      try { lv = ctx.live ? ctx.live() : null; } catch (e) { lv = null; }
      if (lv && !lv.power) lv = null;
      views.forEach(function (v) {
        if (!v.svg) return;
        const pw = lv && lv.power ? lv.power[v.id] : null;
        const live = pw ? lv : null;
        const nodes = pw ? pw.nodes : {};
        const st = function (x) { return live ? (x ? 1 : 0) : -1; };
        if (v.root.k !== 'ph') walk(v.root, nodes, live);
        const power = !!(pw && pw.power);
        paintS(v.tail, st(power));
        if (v.root.k !== 'ph') {
          // letzte Leitung des Wurzelknotens zum Verteiler gehört zu tail
          setTxt(v.root.pinTxt, live ? (power ? '1' : '0') : '', power);
        }
        v.coils.forEach(function (c) {
          const o = c.o;
          let lit = false;
          if (live) lit = o.t === 'reset' ? power : !!(pw.outs && pw.outs[c.j]);
          paintS([c.box], live ? (lit ? 1 : 0) : -1);
          c.box.setAttribute('fill', live && lit ? 'rgba(76,217,100,.28)' : '#1a2027');
          paintT([c.txt], st(lit));
          if (live) {
            const raw = !!(pw.outs && pw.outs[c.j]);
            setTxt(c.val, raw ? '1' : '0', raw);
          } else if (c.val.textContent) c.val.textContent = '';
        });
      });
    }

    // ---- Änderungen --------------------------------------------------
    function newId(p) {
      const used = {}; let m = 0;
      p.networks.forEach(function (n) { if (n && n.id) { used[n.id] = true; const mm = /^N(\d+)$/.exec(n.id); if (mm) m = Math.max(m, +mm[1]); } });
      let k = Math.max(m + 1, p.networks.length + 1);
      while (used['N' + k]) k++;
      return 'N' + k;
    }
    function ensureIds(p) {
      const used = {};
      p.networks.forEach(function (n) { if (n && n.id) used[n.id] = true; });
      p.networks.forEach(function (n, i) {
        if (n && !n.id) { let k = i + 1; while (used['N' + k]) k++; n.id = 'N' + k; used[n.id] = true; }
      });
    }
    function mutate(fn) {
      if (ro()) { toast('Das Programm ist gerade schreibgeschützt.'); return false; }
      const p = prog();
      const snap = JSON.stringify(p.networks);
      fn(p);
      let tooDeep = false;
      p.networks.forEach(function (n) {
        if (!n) return;
        if (!isObj(n.expr)) n.expr = { t: 'const', v: true };
        n.expr = norm(n.expr);
        if (!Array.isArray(n.outs)) n.outs = [];
        if (treeHeight(n.expr) > MAXHEIGHT) tooDeep = true;
      });
      if (tooDeep) { p.networks = JSON.parse(snap); toast('Zu tief verschachtelt (max. ' + MAXHEIGHT + ' Ebenen).'); lastSig = null; refresh(); return false; }
      ensureIds(p);
      const now = JSON.stringify(p.networks);
      if (now === snap) return false;
      undo.push(snap); if (undo.length > MAXH) undo.shift();
      redo.length = 0;
      ctx.changed();
      lastSig = null;
      refresh();
      return true;
    }
    function doUndo(back) {
      if (ro()) return;
      const from = back ? undo : redo, to = back ? redo : undo;
      if (!from.length) return;
      const p = prog();
      to.push(JSON.stringify(p.networks));
      p.networks = JSON.parse(from.pop());
      ctx.changed();
      lastSig = null;
      refresh();
    }
    function select(i) { sel = i; lastSig = null; refresh(); }

    async function pick(title, opts) { try { return await ctx.pick(title, opts); } catch (e) { return null; } }

    async function netOp(op, ni) {
      if (busy) return; busy = true;
      try {
        const p = prog();
        if (op === 'add') {
          if (p.networks.length >= 40) { toast('Mehr als 40 Netzwerke sind zu viel für den Editor.'); return; }
          const at = ni + 1;
          mutate(function (pp) { pp.networks.splice(at, 0, { id: newId(pp), expr: { t: 'const', v: true }, outs: [] }); });
          sel = at; lastSig = null; refresh();
          const v = views[at]; if (v && v.card && v.card.scrollIntoView) v.card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (op === 'del') {
          const r = await pick('Netzwerk ' + (ni + 1) + ' löschen?', [{ value: 'y', label: 'Ja, Netzwerk ' + (ni + 1) + ' löschen' }, { value: 'n', label: 'Abbrechen' }]);
          if (r === 'y') { mutate(function (pp) { pp.networks.splice(ni, 1); }); sel = -1; lastSig = null; refresh(); }
        } else if (op === 'up' || op === 'down') {
          const to = op === 'up' ? ni - 1 : ni + 1;
          if (to < 0 || to >= p.networks.length) return;
          mutate(function (pp) { const t = pp.networks[ni]; pp.networks[ni] = pp.networks[to]; pp.networks[to] = t; });
          sel = to; lastSig = null; refresh();
        } else if (op === 'title') {
          const net = p.networks[ni];
          const r = await ctx.ask('Netzwerk ' + (ni + 1), [
            { key: 'title', label: 'Titel', type: 'text', value: net.title || '' },
            { key: 'comment', label: 'Kommentar', type: 'text', value: net.comment || '' }]);
          if (r) mutate(function (pp) {
            const n = pp.networks[ni];
            const t = String(r.title || '').trim(), c = String(r.comment || '').trim();
            if (t) n.title = t; else delete n.title;
            if (c) n.comment = c; else delete n.comment;
          });
        }
      } finally { busy = false; }
    }

    // ---- Auswahl: Adressen und Quellen -------------------------------
    function fbContactOptions() {
      const p = prog(), m = mode(), out = [];
      allFbs(p).forEach(function (f) {
        const inf = FBINFO[f.fb]; if (!inf || !f.id) return;
        let lab;
        if (inf.cls === 'T') lab = C.addr(f.id + '.Q', m) + '  (' + (m === 's7' ? inf.s7 : inf.lab) + ' ' + fmtMs(f.pt) + ')';
        else if (inf.cls === 'C') lab = C.addr(f.id + '.Q', m) + '  (' + (m === 's7' ? inf.s7 : inf.lab) + ' PV ' + (f.pv | 0) + ')';
        else lab = f.id + '.Q  (' + inf.lab + ')';
        const sym = ctx.showSymbols && ctx.showSymbols() && p.symbols && p.symbols[f.id + '.Q'];
        out.push({ value: f.id + '.Q', label: sym ? sym + ' (' + lab.split('  ')[0] + ')' : lab, group: 'Bausteine im Programm' });
      });
      return out;
    }
    async function pickAddr(title, write) {
      const items = (ctx.addresses ? ctx.addresses() : []) || [];
      const opts = [];
      items.forEach(function (it) {
        const g = it.group;
        if (write) { if (g !== 'Ausgang' && g !== 'Merker') return; }
        else if (g === 'Zeitglied' || g === 'Zähler') return;
        opts.push({ value: it.key, label: it.label || it.key, group: g });
      });
      if (!write) fbContactOptions().forEach(function (o) { opts.push(o); });
      if (!opts.length) { toast('Keine passenden Adressen vorhanden.'); return null; }
      return pick(title, opts);
    }
    const SIGNALS = [
      { value: 'var', label: 'Variable (Eingang, Ausgang, Merker, Baustein-Ausgang)', group: 'Signal' },
      { value: 'c1', label: 'Konstante 1', group: 'Signal' },
      { value: 'c0', label: 'Konstante 0', group: 'Signal' },
      { value: 'P', label: 'Flanke steigend (P)', group: 'Signal' },
      { value: 'N', label: 'Flanke fallend (N)', group: 'Signal' }];
    function blockOptions() {
      const m = mode() === 's7' ? 's7' : 'iec';
      const o = [
        { value: 'and', label: OPNAME[m].and, group: 'Block (Gatter)' },
        { value: 'or', label: OPNAME[m].or, group: 'Block (Gatter)' },
        { value: 'xor', label: OPNAME[m].xor, group: 'Block (Gatter)' }];
      Object.keys(FBINFO).forEach(function (k) {
        const inf = FBINFO[k];
        o.push({ value: 'fb:' + k, label: inf.name + (m === 's7' && inf.s7 !== inf.lab ? ' / ' + inf.s7 : ''), group: inf.cls === 'T' ? 'Block (Zeitglied)' : inf.cls === 'C' ? 'Block (Zähler)' : 'Block (Flipflop)' });
      });
      return o;
    }
    const placeholderFor = function (t) { return { t: 'const', v: t === 'and' }; };

    // erzeugt ein Signal-Blatt; null bei Abbruch
    async function makeLeaf(kind) {
      if (kind === 'c1') return { t: 'const', v: true };
      if (kind === 'c0') return { t: 'const', v: false };
      const a = await pickAddr('Adresse wählen', false);
      if (!a) return null;
      if (kind === 'var') return { t: 'var', a: a };
      return { t: 'edge', a: a, mode: kind };
    }
    // erzeugt einen Block; old = bisheriges Signal (wird erster Eingang), darf null sein
    async function makeBlock(kind, old) {
      if (kind === 'and' || kind === 'or' || kind === 'xor') {
        return { t: kind, in: [old || placeholderFor(kind), placeholderFor(kind)] };
      }
      const k = kind.slice(3), inf = FBINFO[k];
      const p = prog();
      const id = freeId(p, inf.cls);
      if (!id) { toast('Alle Kennungen dieses Bausteintyps sind belegt.'); return null; }
      const node = { t: 'fb', fb: k, id: id };
      if (inf.cls === 'T') {
        const r = await ctx.ask(inf.name, [{ key: 'pt', label: 'Zeit PT (z. B. 2s oder 500ms)', type: 'time', value: 1000 }]);
        if (!r) return null;
        const ms = parseTime(r.pt);
        if (isNaN(ms)) { toast('Die Zeit ist ungültig. Beispiel: 2s oder 500ms.'); return null; }
        node.pt = ms;
      } else if (inf.cls === 'C') {
        const r = await ctx.ask(inf.name, [{ key: 'pv', label: 'Vorgabewert PV (ganze Zahl)', type: 'number', value: 5 }]);
        if (!r) return null;
        const v = parseInt(r.pv, 10);
        if (isNaN(v) || v < 0 || v > 999) { toast('Der Vorgabewert muss eine ganze Zahl von 0 bis 999 sein.'); return null; }
        node.pv = v;
      }
      if (old && !(old.t === 'const' && old.v === true && false)) node[inf.pins[0]] = old;
      return node;
    }
    // Auswahl für leeren Platz: Signal oder Block
    async function chooseAny(title, old) {
      const t = await pick(title, SIGNALS.concat(blockOptions()));
      if (!t) return null;
      if (t.indexOf('fb:') === 0 || t === 'and' || t === 'or' || t === 'xor') return makeBlock(t, old || null);
      return makeLeaf(t);
    }

    // ---- Aktionen ----------------------------------------------------
    async function act(ni, d) {
      if (busy) return;
      if (ro()) { toast('Das Programm ist gerade schreibgeschützt.'); return; }
      busy = true;
      try {
        if (ni !== sel) { sel = ni; lastSig = null; refresh(); }
        const net = prog().networks[ni];
        if (!net) return;
        switch (d.act) {
          case 'root': {
            const nn = await chooseAny('Signal oder Block einsetzen', null);
            if (nn) mutate(function () { net.expr = nn; });
            break;
          }
          case 'pin': {
            const nn = await chooseAny('Eingang ' + (d.key || '').toUpperCase() + ': Signal oder Block', null);
            if (nn) mutate(function () { const r = resolve(net.expr, d.path); if (r && r.node && r.node.t === 'fb') r.node[d.key] = nn; });
            break;
          }
          case 'leaf': await actLeaf(ni, d.path); break;
          case 'box': await actBox(ni, d.path); break;
          case 'out': await actOut(ni, +d.out); break;
          case 'outslot': await actOutSlot(ni); break;
        }
      } catch (e) {
        toast('Fehler im Editor: ' + (e && e.message ? e.message : e));
        if (root.console) console.error(e);
      } finally { busy = false; }
    }

    function negToggle(net, path) {
      const x = resolve(net.expr, path).node;
      if (x.t === 'var') { if (x.neg) delete x.neg; else x.neg = true; }
      else if (x.t === 'const') x.v = !x.v;
      else if (x.t === 'edge') setAt(net, path, { t: 'and', in: [x], neg: true });
      else { if (x.neg) delete x.neg; else x.neg = true; }
    }
    function removeAt(net, path) {
      const r = resolve(net.expr, path);
      if (!r) return;
      if (!r.parent) { net.expr = { t: 'const', v: true }; return; }
      if (r.parent.t === 'fb') delete r.parent[r.key];
      else r.parent.in.splice(r.key, 1);
    }

    async function actLeaf(ni, path) {
      const net = prog().networks[ni];
      const r = resolve(net.expr, path);
      if (!r || !r.node) return;
      const n = r.node;
      const opts = [];
      if (n.t !== 'const') opts.push({ value: 'addr', label: 'Adresse ändern', group: 'Bearbeiten' });
      opts.push({ value: 'neg', label: (n.t === 'const' ? 'Konstante umkehren (0/1)' : n.neg ? 'Negation am Eingang entfernen' : 'Negation am Eingang (Kreis) setzen'), group: 'Bearbeiten' });
      opts.push({ value: 'repl', label: 'Signal ersetzen (Variable, Konstante, Flanke)', group: 'Bearbeiten' });
      opts.push({ value: 'block', label: 'Block davorsetzen (UND, ODER, XOR, Zeitglied, Zähler …)', group: 'Einfügen' });
      opts.push({ value: 'del', label: r.parent ? (r.parent.t === 'fb' ? 'Eingang leeren' : 'Eingang entfernen') : 'Signal löschen', group: 'Entfernen' });
      const title = n.t === 'const' ? (n.v ? 'Konstante 1' : 'Konstante 0') : (n.t === 'edge' ? 'Flanke ' : 'Variable ') + C.addr(n.a, mode());
      const t = await pick(title, opts);
      if (!t) return;
      if (t === 'addr') {
        const a = await pickAddr('Neue Adresse', false); if (!a) return;
        mutate(function () { resolve(net.expr, path).node.a = a; });
      } else if (t === 'neg') {
        mutate(function () { negToggle(net, path); });
      } else if (t === 'repl') {
        const k = await pick('Signal ersetzen durch', SIGNALS); if (!k) return;
        const nn = await makeLeaf(k); if (!nn) return;
        mutate(function () { setAt(net, path, nn); });
      } else if (t === 'block') {
        const k = await pick('Block mit diesem Signal als Eingang', blockOptions()); if (!k) return;
        const old = resolve(net.expr, path).node;
        const nn = await makeBlock(k, old); if (!nn) return;
        mutate(function () { setAt(net, path, nn); });
      } else if (t === 'del') {
        mutate(function () { removeAt(net, path); });
      }
    }

    async function actBox(ni, path) {
      const p = prog(), net = p.networks[ni];
      const r = resolve(net.expr, path);
      if (!r || !r.node) return;
      const n = r.node;
      const m = mode() === 's7' ? 's7' : 'iec';
      if (isGate(n)) {
        const opts = [
          { value: 'neg', label: n.neg ? 'Negation am Ausgang entfernen' : 'Negation am Ausgang (Kreis) setzen', group: 'Bearbeiten' },
          { value: 'kind', label: 'Gattertyp ändern (jetzt ' + n.t.toUpperCase() + ')', group: 'Bearbeiten' }];
        if (n.in.length < MAXIN) opts.push({ value: 'addin', label: 'Eingang hinzufügen (jetzt ' + n.in.length + ')', group: 'Eingänge' });
        if (n.in.length > 2 || (n.in.length > 1 && false)) opts.push({ value: 'rmin', label: 'Eingang entfernen …', group: 'Eingänge' });
        opts.push({ value: 'block', label: 'Block davorsetzen (dieses Gatter wird Eingang)', group: 'Einfügen' });
        opts.push({ value: 'del', label: 'Gatter samt Eingängen löschen', group: 'Entfernen' });
        const t = await pick('Gatter ' + n.t.toUpperCase() + (n.neg ? ' (negiert)' : ''), opts);
        if (!t) return;
        if (t === 'neg') mutate(function () { const x = resolve(net.expr, path).node; if (x.neg) delete x.neg; else x.neg = true; });
        else if (t === 'kind') {
          const k = await pick('Gattertyp', ['and', 'or', 'xor'].filter(function (x) { return x !== n.t; }).map(function (x) { return { value: x, label: OPNAME[m][x] }; }));
          if (k) mutate(function () { resolve(net.expr, path).node.t = k; });
        } else if (t === 'addin') {
          const nn = await chooseAny('Neuer Eingang: Signal oder Block', null); if (!nn) return;
          mutate(function () { const x = resolve(net.expr, path).node; if (x.in.length >= MAXIN) { toast('Mehr als ' + MAXIN + ' Eingänge sind nicht möglich.'); return; } x.in.push(nn); });
        } else if (t === 'rmin') {
          const labs = n.in.map(function (c, i) {
            let s;
            if (isLeaf(c)) s = c.t === 'const' ? 'Konstante ' + (c.v ? 1 : 0) : C.addr(c.a, mode()); else s = c.t === 'fb' ? FBINFO[c.fb].lab + ' ' + c.id : 'Gatter ' + c.t.toUpperCase();
            return { value: String(i), label: 'Eingang ' + (i + 1) + ': ' + s };
          });
          const k = await pick('Welchen Eingang entfernen?', labs);
          if (k !== null && k !== undefined) mutate(function () { resolve(net.expr, path).node.in.splice(+k, 1); });
        } else if (t === 'block') {
          const k = await pick('Block mit diesem Gatter als Eingang', blockOptions()); if (!k) return;
          const nn = await makeBlock(k, n); if (!nn) return;
          mutate(function () { setAt(net, path, nn); });
        } else if (t === 'del') mutate(function () { removeAt(net, path); });
        return;
      }
      // Funktionsbaustein
      const inf = FBINFO[n.fb];
      const opts = [];
      if (inf.cls === 'T') opts.push({ value: 'pt', label: 'Zeit PT ändern (jetzt ' + fmtMs(n.pt) + ')', group: 'Bearbeiten' });
      if (inf.cls === 'C') opts.push({ value: 'pv', label: 'Vorgabewert PV ändern (jetzt ' + (n.pv | 0) + ')', group: 'Bearbeiten' });
      opts.push({ value: 'kind', label: 'Bausteintyp ändern (jetzt ' + inf.lab + ')', group: 'Bearbeiten' });
      if (inf.cls !== 'F') opts.push({ value: 'id', label: 'Kennung ändern (jetzt ' + n.id + ')', group: 'Bearbeiten' });
      opts.push({ value: 'neg', label: n.neg ? 'Negation am Ausgang entfernen' : 'Negation am Ausgang (Kreis) setzen', group: 'Bearbeiten' });
      opts.push({ value: 'block', label: 'Block davorsetzen (Baustein wird Eingang)', group: 'Einfügen' });
      opts.push({ value: 'del', label: 'Baustein entfernen (erster Eingang bleibt)', group: 'Entfernen' });
      opts.push({ value: 'delall', label: 'Baustein samt Eingängen löschen', group: 'Entfernen' });
      const t = await pick(inf.name + ' ' + n.id, opts);
      if (!t) return;
      if (t === 'pt') {
        const rr = await ctx.ask('Zeit PT', [{ key: 'pt', label: 'Zeit PT (z. B. 2s oder 500ms)', type: 'time', value: n.pt }]);
        if (!rr) return;
        const ms = parseTime(rr.pt);
        if (isNaN(ms)) { toast('Die Zeit ist ungültig. Beispiel: 2s oder 500ms.'); return; }
        mutate(function () { resolve(net.expr, path).node.pt = ms; });
      } else if (t === 'pv') {
        const rr = await ctx.ask('Vorgabewert PV', [{ key: 'pv', label: 'Vorgabewert PV (ganze Zahl)', type: 'number', value: n.pv }]);
        if (!rr) return;
        const v = parseInt(rr.pv, 10);
        if (isNaN(v) || v < 0 || v > 999) { toast('Der Vorgabewert muss eine ganze Zahl von 0 bis 999 sein.'); return; }
        mutate(function () { resolve(net.expr, path).node.pv = v; });
      } else if (t === 'kind') {
        const fam = Object.keys(FBINFO).filter(function (k) { return FBINFO[k].cls === inf.cls && k !== n.fb; });
        const k = await pick('Neuer Typ', fam.map(function (kk) { return { value: kk, label: FBINFO[kk].name }; }));
        if (!k) return;
        mutate(function () {
          const x = resolve(net.expr, path).node;
          x.fb = k;
          if (inf.cls === 'C' && k === 'ctd' && x.r) x.ld = x.r;
          else if (inf.cls === 'C' && k === 'ctu' && x.ld) x.r = x.ld;
        });
      } else if (t === 'id') {
        const used = {}; allFbs(p).forEach(function (f) { used[f.id] = true; });
        const opts2 = [];
        for (let i = 1; i <= 16; i++) { const id = inf.cls + i; if (id === n.id || !used[id]) opts2.push({ value: id, label: C.addr(id, mode()) + (id === n.id ? ' (aktuell)' : '') }); }
        const id = await pick('Kennung wählen', opts2);
        if (!id || id === n.id) return;
        mutate(function () {
          const oldId = n.id;
          resolve(net.expr, path).node.id = id;
          p.networks.forEach(function (nn) { renameRefs(nn.expr, oldId + '.Q', id + '.Q'); });
        });
      } else if (t === 'neg') {
        mutate(function () { const x = resolve(net.expr, path).node; if (x.neg) delete x.neg; else x.neg = true; });
      } else if (t === 'block') {
        const k = await pick('Block mit diesem Baustein als Eingang', blockOptions()); if (!k) return;
        const nn = await makeBlock(k, n); if (!nn) return;
        mutate(function () { setAt(net, path, nn); });
      } else if (t === 'del') {
        mutate(function () { const x = resolve(net.expr, path).node; const first = inf.pins.map(function (k) { return x[k]; }).filter(Boolean)[0]; if (first) setAt(net, path, first); else removeAt(net, path); });
      } else if (t === 'delall') {
        mutate(function () { removeAt(net, path); });
      }
    }

    const OUT_TYPES = [
      { value: 'coil', label: 'Zuweisung  =', group: 'Zuweisung' },
      { value: 'coiln', label: 'Zuweisung negiert  (Kreis am Eingang)', group: 'Zuweisung' },
      { value: 'set', label: 'Setzen  S', group: 'Zuweisung' },
      { value: 'reset', label: 'Rücksetzen  R', group: 'Zuweisung' }];
    function mkOut(type, a) {
      if (type === 'coiln') return { t: 'coil', a: a, neg: true };
      return { t: type, a: a };
    }
    async function actOutSlot(ni) {
      const net = prog().networks[ni];
      if ((net.outs || []).length >= MAXOUT) { toast('Mehr als ' + MAXOUT + ' Zuweisungen je Netzwerk sind nicht möglich.'); return; }
      const t = await pick('Zuweisung hinzufügen', OUT_TYPES); if (!t) return;
      const a = await pickAddr('Ausgang oder Merker wählen', true); if (!a) return;
      mutate(function () { net.outs = net.outs || []; net.outs.push(mkOut(t, a)); });
    }
    async function actOut(ni, j) {
      const net = prog().networks[ni];
      const o = net.outs[j]; if (!o) return;
      const cur = o.t === 'set' ? 'Setzen' : o.t === 'reset' ? 'Rücksetzen' : o.neg ? 'Zuweisung negiert' : 'Zuweisung';
      const t = await pick(cur + ' ' + C.addr(o.a, mode()), [
        { value: 'addr', label: 'Adresse ändern', group: 'Bearbeiten' },
        { value: 'type', label: 'Typ ändern (jetzt: ' + cur + ')', group: 'Bearbeiten' },
        { value: 'add', label: 'Weitere Zuweisung hinzufügen', group: 'Einfügen' },
        { value: 'del', label: 'Zuweisung löschen', group: 'Entfernen' }]);
      if (!t) return;
      if (t === 'addr') {
        const a = await pickAddr('Neue Adresse (Ausgang oder Merker)', true); if (!a) return;
        mutate(function () { net.outs[j].a = a; });
      } else if (t === 'type') {
        const ty = await pick('Typ der Zuweisung', OUT_TYPES); if (!ty) return;
        mutate(function () { net.outs[j] = mkOut(ty, o.a); });
      } else if (t === 'add') await actOutSlot(ni);
      else if (t === 'del') mutate(function () { net.outs.splice(j, 1); });
    }

    // ---- Leiste ------------------------------------------------------
    function setZoom(z) {
      zoom = Math.max(0.4, Math.min(2.5, z));
      try { localStorage.setItem('sps.fup.zoom', String(zoom)); } catch (e) { /* ignorieren */ }
      views.forEach(function (v) {
        if (v.svg) {
          const vb = v.svg.viewBox.baseVal;
          v.svg.setAttribute('width', Math.round(vb.width * zoom)); v.svg.setAttribute('height', Math.round(vb.height * zoom));
        }
      });
      updBar();
    }
    function onBar(ev) {
      const b = ev.target.closest('button'); if (!b || b.disabled) return;
      switch (b.dataset.c) {
        case 'undo': doUndo(true); break;
        case 'redo': doUndo(false); break;
        case 'zin': setZoom(zoom * 1.15); break;
        case 'zout': setZoom(zoom / 1.15); break;
        case 'zfit': {
          let mw = 200; views.forEach(function (v) { if (v.W) mw = Math.max(mw, v.W); });
          setZoom(Math.min(1.6, Math.max(0.4, (body.clientWidth - 40) / mw)));
          break;
        }
        case 'addnet': netOp('add', sel >= 0 ? sel : prog().networks.length - 1); break;
      }
    }
    bar.addEventListener('click', onBar);

    function refresh() {
      const p = prog();
      if (p !== lastProg) { lastProg = p; undo.length = 0; redo.length = 0; sel = -1; lastSig = null; }
      let sig;
      try { sig = JSON.stringify([p.networks, p.symbols || null, mode(), !!(ctx.showSymbols && ctx.showSymbols()), ro(), ctx.errors ? ctx.errors() : null]); }
      catch (e) { sig = String(Math.random()); }
      if (sig !== lastSig) { lastSig = sig; build(); }
      else paintLive();
    }

    refresh();
    return {
      refresh: refresh,
      destroy: function () { bar.removeEventListener('click', onBar); if (rootEl.parentNode) rootEl.parentNode.removeChild(rootEl); views = []; }
    };
  }

  SE.register('fup', { title: 'Funktionsplan (FUP)', mount: mount });
  if (typeof module !== 'undefined' && module.exports) module.exports = SE;
})(typeof window !== 'undefined' ? window : globalThis);
