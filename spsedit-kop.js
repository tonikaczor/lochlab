/* spsedit-kop.js - SPS-Lab Editor Kontaktplan (KOP), id 'kop'
 * Grafischer Kontaktplan (SVG): Stromschiene links, Spulen rechts, je Netzwerk eine Zeile.
 * Datenbasis: prog.networks (Netzwerkmodell Abschnitt 3.1). Aenderungen direkt an ctx.getProg(), danach ctx.changed().
 *
 * ENTSCHEIDUNGEN / BESONDERHEITEN
 *  - Reihe = 'and', Parallelzweig = 'or'. Funktionsbausteine (fb) werden als Box dargestellt; Eingaenge der Box
 *    (in/s/r/ld) sind eigene Kontaktzeilen links der Box. Das Hinzufuegen eines Bausteins erfolgt am Zeilenende
 *    (die bisherige Zeile wird zum Eingang). Aus dem FUP geladene Ausdruecke (XOR, negierte Gatter, Bausteine mitten
 *    in einer Reihe) werden als gestrichelt umrahmtes Teilnetz mit Box gezeichnet und bleiben bearbeitbar.
 *  - Neue Felder im Netzwerk: 'comment' (optional, vom Kern ignoriert). Netzwerke ohne id bekommen beim ersten Aendern eine id.
 *  - Leeres Netzwerk: expr = {t:'const', v:true}, outs = [].
 *  - Zeitwerte (ctx.ask type 'time'): es wird die Zeit in ms als Zahl uebergeben; zurueck werden Zahl (ms) oder Text
 *    wie "2s", "500ms", "1,5 s" akzeptiert.
 *  - Begrenzungen: Reihe max. 8 Elemente, Parallelzweige max. 6 je Gruppe, Verschachtelung max. 4 Ebenen, max. 6 Spulen.
 *  - Rueckgaengig/Wiederholen: lokal, 60 Schritte, wird bei einem anderen Programmobjekt (ctx.getProg()) zurueckgesetzt.
 */
(function (root) {
  'use strict';
  const SE = root.SPS_EDIT = root.SPS_EDIT || { editors: {}, register: function (id, def) { this.editors[id] = def; } };
  const NS = 'http://www.w3.org/2000/svg';

  // Geometrie
  const CW = 104, RH = 76, MY = 46, PAD = 14, SLOTW = 64, BW = 150, GBW = 62, RAILX = 12, GP = 10, PINW = 74;
  const MAXSER = 8, MAXPAR = 6, MAXDEPTH = 4, MAXOUT = 6, MAXH = 60;
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

  const isObj = function (x) { return x !== null && typeof x === 'object' && !Array.isArray(x); };
  const clone = function (x) { return JSON.parse(JSON.stringify(x)); };

  // ------------------------------------------------------------ Baum-Helfer
  function childList(n) {
    if (n.t === 'and' || n.t === 'or' || n.t === 'xor') return (n.in || []).map(function (c, i) { return { key: i, idx: i, node: c }; });
    if (n.t === 'fb' && FBINFO[n.fb]) return FBINFO[n.fb].pins.map(function (k) { return { key: k, idx: PINK.indexOf(k), node: n[k] }; });
    return [];
  }
  function resolve(expr, path) {
    const segs = path.split('.').slice(1);
    let node = expr, parent = null, key = null, ppath = null;
    let cur = 'n0';
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
    if (n.t === 'and' || n.t === 'or' || n.t === 'xor') {
      const list = [];
      (n.in || []).forEach(function (c) {
        c = norm(c);
        if (!c) return;
        if (n.t !== 'xor' && c.t === n.t && !c.neg) (c.in || []).forEach(function (cc) { list.push(cc); });
        else list.push(c);
      });
      if (n.t !== 'xor' && list.length === 1 && !n.neg) return list[0];
      if (!list.length) return { t: 'const', v: n.t === 'and' };
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
  function kindOf(n) {
    if (n.t === 'var' || n.t === 'edge' || n.t === 'const') return 'leaf';
    if (n.t === 'and' && !n.neg) return 'ser';
    if (n.t === 'or' && !n.neg) return 'par';
    return 'grp';
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
  function orDepth(expr, path) {
    let d = 0, node = expr, cur = 'n0';
    const segs = path.split('.').slice(1);
    for (let i = 0; i < segs.length && node; i++) {
      if (node.t === 'or' || node.t === 'xor' || node.t === 'fb' || (node.t === 'and' && node.neg)) d++;
      node = node.t === 'fb' ? node[PINK[+segs[i]]] : (node.in || [])[+segs[i]];
      cur += '.' + segs[i];
    }
    return d;
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
  let cssDone = false;
  function injectCss() {
    if (cssDone || document.getElementById('spk-css')) { cssDone = true; return; }
    cssDone = true;
    const st = document.createElement('style');
    st.id = 'spk-css';
    st.textContent = [
      '.spk{--bg:#14181c;--card:#222830;--card2:#2c343e;--acc:#3b9eff;--on:#4cd964;--txt:#e6edf3;--mut:#8b98a6;--bad:#ff7b72;',
      'color:var(--txt);font:14px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);height:100%;min-height:160px;display:flex;flex-direction:column;box-sizing:border-box;-webkit-text-size-adjust:100%}',
      '.spk *{box-sizing:border-box}',
      '.spk-bar{display:flex;flex-wrap:wrap;gap:6px;padding:6px 8px;background:var(--card);border-bottom:1px solid #0b0d10;align-items:center;flex:none}',
      '.spk-b{min-width:44px;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid #3a4552;background:var(--card2);color:var(--txt);font:600 15px system-ui,sans-serif;cursor:pointer;touch-action:manipulation;display:inline-flex;align-items:center;justify-content:center;gap:6px}',
      '.spk-b:active{background:#394554}.spk-b[disabled]{opacity:.35;cursor:default}',
      '.spk-b.acc{background:var(--acc);border-color:var(--acc);color:#04121f}',
      '.spk-b.bad{color:var(--bad)}',
      '.spk-sep{width:1px;height:28px;background:#3a4552;margin:0 4px}',
      '.spk-info{color:var(--mut);font-size:12px;margin-left:auto;padding-right:4px}',
      '.spk-err{flex:none;margin:0;padding:8px 12px;background:#3a2326;color:#ffb4ad;font-size:13px;border-bottom:1px solid #0b0d10;cursor:pointer}',
      '.spk-err.warn{background:#352f1d;color:#f5d98a}',
      '.spk-body{flex:1;overflow:auto;padding:10px;min-height:0;-webkit-overflow-scrolling:touch}',
      '.spk-net{background:var(--card);border:2px solid transparent;border-radius:12px;margin-bottom:12px;position:relative}',
      '.spk-net.sel{border-color:var(--acc)}',
      '.spk-net.bad{border-color:#7a3a3a}',
      '.spk-nh{display:flex;gap:10px;align-items:center;padding:6px 10px;min-height:42px;cursor:pointer}',
      '.spk-nn{background:var(--card2);border-radius:8px;padding:3px 10px;font-weight:700;color:var(--acc);flex:none}',
      '.spk-nt{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.spk-nt i{color:var(--mut);font-weight:400}',
      '.spk-nc{padding:0 12px 4px;color:var(--mut);font-size:13px;font-style:italic}',
      '.spk-ne{padding:0 12px 4px;color:var(--bad);font-size:12px}',
      '.spk-tools{display:flex;gap:6px;padding:4px 8px 8px;flex-wrap:wrap}',
      '.spk-sc{overflow-x:auto;padding:0 8px 8px;-webkit-overflow-scrolling:touch}',
      '.spk svg{display:block;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}',
      '.spk svg text{pointer-events:none;fill:#e6edf3;font:12px system-ui,-apple-system,"Segoe UI",sans-serif}',
      '.spk svg .tb{font-weight:700;font-size:13px}.spk svg .tm{fill:#9aa7b5;font-size:10.5px}.spk svg .tv{font-size:11px;font-weight:700}',
      '.spk svg .tt{font-size:11px;fill:#9aa7b5}',
      '.spk svg .hit{fill:transparent;cursor:pointer;pointer-events:all}',
      '.spk svg .hit:hover{fill:rgba(59,158,255,.10)}',
      '.spk svg .plus{fill:rgba(59,158,255,.12);stroke:#3b9eff;stroke-width:2;stroke-dasharray:4 3}',
      '.spk svg .plust{fill:#3b9eff;font-size:22px;font-weight:700}',
      '.spk-empty{padding:30px;text-align:center;color:var(--mut)}',
      '@media (max-width:560px){.spk-b span{display:none}.spk-b{padding:0 10px}.spk-bar{gap:4px}}'
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
    rootEl.className = 'spk';
    rootEl.innerHTML =
      '<div class="spk-bar">' +
      '<button class="spk-b" data-c="undo" title="Rückgängig">↶ <span>Zurück</span></button>' +
      '<button class="spk-b" data-c="redo" title="Wiederholen">↷</button><span class="spk-sep"></span>' +
      '<button class="spk-b" data-c="zout" title="Kleiner">A−</button><button class="spk-b" data-c="zin" title="Größer">A+</button>' +
      '<button class="spk-b" data-c="zfit" title="Einpassen">⤢</button><span class="spk-sep"></span>' +
      '<button class="spk-b acc" data-c="addnet">＋ Netzwerk</button>' +
      '<span class="spk-info"></span></div>' +
      '<div class="spk-err" hidden></div><div class="spk-body"></div>';
    el.appendChild(rootEl);
    const bar = rootEl.querySelector('.spk-bar'), errEl = rootEl.querySelector('.spk-err'), body = rootEl.querySelector('.spk-body');
    const infoEl = rootEl.querySelector('.spk-info');
    const btnUndo = bar.querySelector('[data-c=undo]'), btnRedo = bar.querySelector('[data-c=redo]');

    let sel = -1, lastSig = null, lastProg = null, busy = false, errOpen = false;
    const undo = [], redo = [];
    let views = [];
    let zoom = 1;
    try { const z = parseFloat(localStorage.getItem('sps.kop.zoom')); if (z >= 0.4 && z <= 2.5) zoom = z; else zoom = (el.clientWidth || window.innerWidth) < 640 ? 0.8 : 1; } catch (e) { zoom = 1; }
    let lastLive = null;

    const prog = function () { return ctx.getProg(); };
    const ro = function () { return !!ctx.readonly; };
    const toast = function (m) { if (ctx.toast) ctx.toast(m); };
    const mode = function () { return ctx.addrMode ? ctx.addrMode() : 'iec'; };

    // ---- Beschriftung
    function labLines(key) {
      const p = prog();
      const a = C.addr(key, mode());
      const sym = ctx.showSymbols && ctx.showSymbols() && p.symbols && p.symbols[key];
      return sym ? [String(sym), a] : [a];
    }

    // ---- Layout ------------------------------------------------------
    function lay(n, path) {
      const kind = kindOf(n);
      if (kind === 'leaf') return { k: 'leaf', n: n, path: path, w: CW, h: 1, eIn: [], eOut: [], eBody: [], eTxt: [] };
      if (kind === 'ser') {
        const ch = n.in.map(function (c, i) { return lay(c, path + '.' + i); });
        let w = 0, h = 1;
        ch.forEach(function (c) { w += c.w; h = Math.max(h, c.h); });
        return { k: 'ser', n: n, path: path, ch: ch, w: w, h: h };
      }
      if (kind === 'par') {
        const ch = n.in.map(function (c, i) { return lay(c, path + '.' + i); });
        let w = 0, h = 0;
        ch.forEach(function (c) { w = Math.max(w, c.w); h += c.h; });
        return { k: 'par', n: n, path: path, ch: ch, w: w + 2 * PAD, h: h, eIn: [], eOut: [] };
      }
      // Box (Funktionsbaustein, XOR, negierte Gatter)
      const rooted = path === 'n0';
      const isFb = n.t === 'fb' && !!FBINFO[n.fb];
      let ch;
      if (isFb) {
        ch = FBINFO[n.fb].pins.map(function (k) {
          const idx = PINK.indexOf(k);
          return n[k] ? lay(n[k], path + '.' + idx) : { k: 'slot', pin: k, owner: path, path: path + '.' + idx, w: PINW, h: 1 };
        });
      } else {
        ch = (n.in || []).map(function (c, i) { return lay(c, path + '.' + i); });
      }
      let inW = 0, h = 0;
      ch.forEach(function (c) { inW = Math.max(inW, c.w); h += c.h; });
      const bw = isFb ? BW : GBW;
      h = Math.max(h, isFb ? 2 : 1);
      const gp = rooted ? 0 : GP;
      return { k: 'grp', n: n, path: path, ch: ch, inW: inW, bw: bw, isFb: isFb, rooted: rooted, gp: gp,
        w: inW + bw + 2 * gp + (n.neg || (isFb && n.neg) ? 12 : 0), h: h, eOut: [], eBody: [], eTxt: [] };
    }

    // ---- Zeichnen ----------------------------------------------------
    function wire(g, list, x1, y1, x2, y2) {
      const l = S('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: COLN, 'stroke-width': 3, 'stroke-linecap': 'butt' }, g);
      if (list) list.push(l);
      return l;
    }
    function hit(g, x, y, w, h, d) {
      const r = S('rect', { x: x, y: y, width: w, height: h, class: 'hit' }, g);
      for (const k in d) r.setAttribute('data-' + k, d[k]);
      return r;
    }
    function label(g, cx, y0, key) {
      const ls = labLines(key);
      if (ls.length === 2) {
        tx(g, cx, y0 - 35, trunc(ls[0], 14), 'tb');
        tx(g, cx, y0 - 22, trunc(ls[1], 16), 'tm');
      } else tx(g, cx, y0 - 22, trunc(ls[0], 16), 'tb');
    }
    function plusCell(g, x, y, w, d, always) {
      const cx = x + w / 2, y0 = y + MY;
      wire(g, null, x, y0, x + w, y0).setAttribute('stroke', COLN);
      S('circle', { cx: cx, cy: y0, r: 17, class: 'plus' }, g);
      tx(g, cx, y0 + 8, '+', 'plust');
      hit(g, x, y, w, RH, d);
    }

    function draw(g, b, x, y, nv) {
      const d = { net: nv.idx, path: b.path };
      switch (b.k) {
        case 'leaf': drawLeaf(g, b, x, y, nv); break;
        case 'ser': { let xx = x; b.ch.forEach(function (c) { draw(g, c, xx, y, nv); xx += c.w; }); break; }
        case 'par': {
          const lx = x + PAD, rx = x + b.w - PAD;
          let yy = y; const ys = [];
          b.ch.forEach(function (c) {
            draw(g, c, lx, yy, nv);
            const my = yy + MY;
            if (c.w < b.w - 2 * PAD) { const cc = bOut(c); wire(g, cc, lx + c.w, my, rx, my); }
            ys.push(my); yy += c.h * RH;
          });
          wire(g, b.eIn, x, y + MY, lx, y + MY);
          wire(g, b.eOut, rx, y + MY, x + b.w, y + MY);
          if (ys.length > 1) { wire(g, b.eIn, lx, ys[0], lx, ys[ys.length - 1]); wire(g, b.eOut, rx, ys[0], rx, ys[ys.length - 1]); }
          break;
        }
        case 'grp': drawGrp(g, b, x, y, nv); break;
        case 'slot': {
          wire(g, null, x, y + MY, x + b.w, y + MY);
          if (!ro()) plusCell(g, x, y, b.w, { act: 'pin', net: nv.idx, path: b.owner, key: b.pin });
          break;
        }
      }
    }
    // Liste, in der die "Ausgangs"-Drähte eines Blocks liegen (für Stromfluss-Färbung)
    function bOut(b) {
      if (b.k === 'ser') return bOut(b.ch[b.ch.length - 1]);
      if (!b.eOut) b.eOut = [];
      return b.eOut;
    }

    function drawLeaf(g, b, x, y, nv) {
      const n = b.n, cx = x + CW / 2, y0 = y + MY;
      wire(g, b.eIn, x, y0, cx - 12, y0);
      wire(g, b.eOut, cx + 12, y0, x + CW, y0);
      if (n.t === 'const') {
        const r = S('rect', { x: cx - 15, y: y0 - 14, width: 30, height: 28, rx: 4, fill: 'none', stroke: COLN, 'stroke-width': 3 }, g);
        b.eBody.push(r);
        b.eTxt.push(tx(g, cx, y0 + 5, n.v ? '1' : '0', 'tb'));
        tx(g, cx, y0 - 22, n.v ? 'TRUE' : 'FALSE', 'tm');
      } else {
        b.eBody.push(S('line', { x1: cx - 12, y1: y0 - 15, x2: cx - 12, y2: y0 + 15, stroke: COLN, 'stroke-width': 3.5 }, g));
        b.eBody.push(S('line', { x1: cx + 12, y1: y0 - 15, x2: cx + 12, y2: y0 + 15, stroke: COLN, 'stroke-width': 3.5 }, g));
        if (n.t === 'var' && n.neg) b.eBody.push(S('line', { x1: cx - 14, y1: y0 + 16, x2: cx + 14, y2: y0 - 16, stroke: COLN, 'stroke-width': 3 }, g));
        if (n.t === 'edge') b.eTxt.push(tx(g, cx, y0 + 5, n.mode === 'N' ? 'N' : 'P', 'tb'));
        label(g, cx, y0, n.a);
        b.val = tx(g, cx, y0 + 33, '', 'tv');
      }
      hit(g, x, y, CW, RH, { act: 'leaf', net: nv.idx, path: b.path });
    }

    function pinLabel(n, k) {
      const m = mode() === 's7' ? PINLAB7[n.fb] : null;
      return (m && m[k]) || (PINLAB[n.fb] && PINLAB[n.fb][k]) || k.toUpperCase();
    }

    function drawGrp(g, b, x, y, nv) {
      const n = b.n, rows = b.h, y0 = y + MY;
      const fx = x + b.gp, bx = fx + b.inW;
      if (!b.rooted) S('rect', { x: x + 2, y: y + 3, width: b.w - 4, height: rows * RH - 6, rx: 8, fill: 'none', stroke: '#566370', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, g);
      b.box = S('rect', { x: bx, y: y + 6, width: b.bw, height: rows * RH - 12, rx: 6, fill: '#1a2027', stroke: COLN, 'stroke-width': 3 }, g);
      b.eBody.push(b.box);
      let ry = y;
      b.ch.forEach(function (c, i) {
        draw(g, c, fx, ry, nv);
        if (c.w < b.inW) { const cc = c.k === 'slot' ? null : bOut(c); wire(g, cc, fx + c.w, ry + MY, bx, ry + MY); }
        if (b.isFb) tx(g, bx + 8, ry + MY + 4, pinLabel(n, FBINFO[n.fb].pins[i]), 'tb', 'start');
        ry += c.h * RH;
      });
      b.pinsBottom = ry;
      let qx = bx + b.bw;
      if (n.neg) { const c = S('circle', { cx: qx + 6, cy: y0, r: 5.5, fill: '#14181c', stroke: COLN, 'stroke-width': 2.5 }, g); b.eBody.push(c); qx += 12; }
      wire(g, b.eOut, qx, y0, x + b.w, y0);
      if (b.isFb) {
        const inf = FBINFO[n.fb];
        const sub = mode() === 's7' ? inf.s7 : inf.lab;
        tx(g, bx + b.bw / 2, y + 24, sub, 'tb');
        let inst = '';
        if (inf.cls === 'F') inst = String(n.id); else inst = C.addr(n.id, mode());
        const ls = labLines(n.id);
        tx(g, bx + b.bw - 8, y0 + 4, 'Q', 'tb', 'end');
        tx(g, bx + b.bw / 2, y + 36, trunc(ls.length === 2 ? ls[0] + ' · ' + inst : inst, 18), 'tm');
        const cx = bx + b.bw / 2 + 6, iy = y + RH + 22;
        if (inf.cls === 'T') {
          tx(g, cx, iy, 'PT ' + fmtMs(n.pt), 'tt');
          b.info = tx(g, cx, iy + 15, '', 'tt');
          b.barBg = S('rect', { x: bx + 32, y: iy + 22, width: b.bw - 46, height: 8, rx: 3, fill: '#313a45' }, g);
          b.bar = S('rect', { x: bx + 14, y: iy + 22, width: 0, height: 8, rx: 3, fill: COLON }, g);
        } else if (inf.cls === 'C') {
          tx(g, cx, iy, 'PV ' + (Number(n.pv) || 0), 'tt');
          b.info = tx(g, cx, iy + 15, '', 'tt');
          b.barBg = S('rect', { x: bx + 32, y: iy + 22, width: b.bw - 46, height: 8, rx: 3, fill: '#313a45' }, g);
          b.bar = S('rect', { x: bx + 14, y: iy + 22, width: 0, height: 8, rx: 3, fill: COLON }, g);
        } else {
          b.info = tx(g, cx, iy + 4, '', 'tt');
        }
      } else {
        const sym = n.t === 'xor' ? '=1' : n.t === 'or' ? '≥1' : '&';
        tx(g, bx + b.bw / 2, y0 + 5, sym, 'tb').setAttribute('style', 'font-size:17px');
      }
      hit(g, bx, y + 6, b.bw, rows * RH - 12, { act: 'box', net: nv.idx, path: b.path });
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
      card.className = 'spk-net' + (selected ? ' sel' : '');
      const errs = netErrors(net, ni);
      if (errs.length && !selected) card.classList.add('bad');
      const head = document.createElement('div');
      head.className = 'spk-nh';
      head.innerHTML = '<span class="spk-nn"></span><span class="spk-nt"></span>';
      head.firstChild.textContent = 'N' + (ni + 1);
      const ttl = head.lastChild;
      if (net.title) ttl.textContent = net.title; else ttl.innerHTML = '<i>Netzwerk ' + (ni + 1) + '</i>';
      head.addEventListener('click', function () { select(selected ? -1 : ni); });
      card.appendChild(head);
      if (net.comment) { const c = document.createElement('div'); c.className = 'spk-nc'; c.textContent = net.comment; card.appendChild(c); }
      if (errs.length) { const c = document.createElement('div'); c.className = 'spk-ne'; c.textContent = '⚠ ' + errs[0]; card.appendChild(c); }
      if (selected) {
        const t = document.createElement('div');
        t.className = 'spk-tools';
        t.innerHTML = '<button class="spk-b" data-n="title">✎ Titel</button><button class="spk-b" data-n="up" title="Nach oben">▲</button>' +
          '<button class="spk-b" data-n="down" title="Nach unten">▼</button><button class="spk-b" data-n="add">＋ darunter</button>' +
          '<button class="spk-b bad" data-n="del">🗑 Löschen</button>';
        t.querySelector('[data-n=up]').disabled = ni === 0;
        t.querySelector('[data-n=down]').disabled = ni === p.networks.length - 1;
        t.addEventListener('click', function (ev) {
          const b = ev.target.closest('button'); if (!b || b.disabled) return;
          netOp(b.dataset.n, ni);
        });
        card.appendChild(t);
      }

      // Diagramm
      const expr = net.expr && isObj(net.expr) ? net.expr : { t: 'const', v: true };
      const outs = Array.isArray(net.outs) ? net.outs : [];
      const empty = isEmptyExpr(expr);
      const nv = { idx: ni, id: nid, net: net, tail: [], coils: [], rail: [], bus: [] };
      let rootB = empty ? { k: 'empty', path: 'n0', w: CW, h: 1 } : lay(expr, 'n0');
      const slotW = (!ro() && !empty && rootB.k !== 'grp') ? SLOTW : (empty ? 0 : 0);
      const exprEnd = RAILX + rootB.w + slotW;
      const busX = exprEnd + 18;
      const showCoilPlus = !ro() && (selected || outs.length === 0) && outs.length < MAXOUT;
      const coilRows = outs.length + (showCoilPlus ? 1 : 0);
      const rows = Math.max(rootB.h, coilRows, 1);
      const Wd = busX + CW + 26, Ht = rows * RH + 8;
      const svg = S('svg', { viewBox: '0 0 ' + Wd + ' ' + Ht, width: Math.round(Wd * zoom), height: Math.round(Ht * zoom), 'data-net': ni });
      const g = S('g', null, svg);
      nv.svg = svg; nv.root = rootB; nv.W = Wd;
      // linke Schiene
      nv.rail.push(S('line', { x1: RAILX, y1: 2, x2: RAILX, y2: rows * RH + 2, stroke: COLN, 'stroke-width': 5 }, g));
      const y0 = MY;
      if (empty) {
        plusCell(g, RAILX, 0, CW, { act: 'slot', net: ni });
        nv.tail.push(wire(g, null, RAILX + CW, y0, busX, y0));
      } else {
        draw(g, rootB, RAILX, 0, nv);
        if (slotW) {
          wire(g, nv.tail, RAILX + rootB.w, y0, exprEnd, y0);
          if (selected) {
            S('circle', { cx: RAILX + rootB.w + slotW / 2, cy: y0, r: 17, class: 'plus' }, g);
            tx(g, RAILX + rootB.w + slotW / 2, y0 + 8, '+', 'plust');
            hit(g, RAILX + rootB.w, 0, slotW, RH, { act: 'slot', net: ni });
          }
        }
        nv.tail.push(wire(g, null, exprEnd, y0, busX, y0));
      }
      // Spulen
      outs.forEach(function (o, j) {
        const yy = j * RH, my = yy + MY, cx = busX + CW / 2;
        const inW = wire(g, null, busX, my, cx - 16, my); nv.tail.push(inW);
        const outW = wire(g, null, cx + 16, my, busX + CW + 14, my);
        const circ = S('circle', { cx: cx, cy: my, r: 16, fill: 'none', stroke: COLN, 'stroke-width': 3.5 }, g);
        let sym = '';
        if (o.t === 'set') sym = 'S'; else if (o.t === 'reset') sym = 'R'; else if (o.neg) sym = '/';
        const t = tx(g, cx, my + 5, sym, 'tb');
        label(g, cx, my, o.a);
        const val = tx(g, cx, my + 33, '', 'tv');
        nv.coils.push({ circ: circ, txt: t, val: val, wOut: outW, o: o });
        hit(g, busX, yy, CW, RH, { act: 'coil', net: ni, out: j });
      });
      if (showCoilPlus) {
        const j = outs.length, yy = j * RH, my = yy + MY, cx = busX + CW / 2;
        wire(g, null, busX, my, cx - 17, my);
        S('circle', { cx: cx, cy: my, r: 17, class: 'plus' }, g);
        tx(g, cx, my + 8, '+', 'plust');
        hit(g, busX, yy, CW, RH, { act: 'coilslot', net: ni });
      }
      if (coilRows > 1) nv.tail.push(wire(g, null, busX, y0, busX, (coilRows - 1) * RH + MY));
      // rechte Schiene
      S('line', { x1: busX + CW + 14, y1: 2, x2: busX + CW + 14, y2: rows * RH + 2, stroke: '#566370', 'stroke-width': 3 }, g);

      svg.addEventListener('click', function (ev) {
        const t = ev.target.closest ? ev.target.closest('[data-act]') : null;
        if (!t) return;
        ev.stopPropagation();
        act(ni, t.dataset);
      });
      const sc = document.createElement('div');
      sc.className = 'spk-sc';
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
        const d = document.createElement('div'); d.className = 'spk-empty';
        d.innerHTML = '<p>Noch kein Netzwerk.</p>';
        const b = document.createElement('button'); b.className = 'spk-b acc'; b.textContent = '＋ Erstes Netzwerk anlegen';
        b.addEventListener('click', function () { netOp('add', -1); });
        d.appendChild(b); body.appendChild(d);
      }
      for (let i = 0; i < p.networks.length; i++) {
        try { const v = buildNet(i); views.push(v); body.appendChild(v.card); }
        catch (e) {
          const d = document.createElement('div'); d.className = 'spk-net'; d.style.padding = '10px';
          d.textContent = 'Netzwerk ' + (i + 1) + ' kann nicht dargestellt werden: ' + (e && e.message ? e.message : e);
          body.appendChild(d); views.push({ idx: i });
        }
      }
      if (p.networks.length) {
        const add = document.createElement('button');
        add.className = 'spk-b'; add.style.width = '100%'; add.textContent = '＋ Netzwerk hinzufügen';
        add.disabled = ro();
        add.addEventListener('click', function () { netOp('add', p.networks.length - 1); });
        body.appendChild(add);
      }
      body.scrollTop = keepTop;
      views.forEach(function (v, i) { if (v.sc && keepLeft[i]) v.sc.scrollLeft = keepLeft[i]; });
      updBar();
      lastLive = undefined;
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
        errEl.className = 'spk-err';
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
    function walk(b, inP, nodes, lv) {
      const st = function (v) { return lv ? (v ? 1 : 0) : -1; };
      switch (b.k) {
        case 'leaf': {
          const v = !!nodes[b.path], out = inP && v;
          paintS(b.eIn, st(inP)); paintS(b.eOut, st(out)); paintS(b.eBody, st(out)); paintT(b.eTxt, st(out));
          if (b.val) {
            if (lv && b.n.t !== 'const') {
              const raw = b.n.t === 'var' && b.n.neg ? !v : v;
              const s = raw ? '1' : '0';
              if (b.val.textContent !== s) b.val.textContent = s;
              b.val.style.fill = raw ? COLON : TOFF;
            } else if (b.val.textContent) b.val.textContent = '';
          }
          return out;
        }
        case 'ser': { let cur = inP; b.ch.forEach(function (c) { cur = walk(c, cur, nodes, lv); }); return cur; }
        case 'par': {
          let any = false;
          b.ch.forEach(function (c) { if (walk(c, inP, nodes, lv)) any = true; });
          const out = inP && any;
          paintS(b.eIn, st(inP)); paintS(b.eOut, st(out));
          return out;
        }
        case 'grp': {
          b.ch.forEach(function (c) { if (c.k !== 'slot') { const o = walk(c, b.rooted ? inP : true, nodes, lv); if (c.eOut) paintS(c.eOut, st(o)); } });
          const v = !!nodes[b.path], out = inP && v;
          paintS(b.eOut, st(out)); paintS(b.eBody, st(v));
          if (b.n.t === 'fb') liveBox(b, lv);
          return out;
        }
        case 'slot': case 'empty': return inP;
      }
      return inP;
    }
    function liveBox(b, lv) {
      const n = b.n, inf = FBINFO[n.fb];
      if (!b.info) return;
      const stt = lv && lv.state;
      if (inf.cls === 'T') {
        const t = stt && stt.T && stt.T[n.id];
        if (t) {
          const s = 'ET ' + fmtMs(t.et);
          if (b.info.textContent !== s) b.info.textContent = s;
          const w = t.pt > 0 ? Math.max(0, Math.min(1, t.et / t.pt)) * (b.bw - 46) : (t.q ? b.bw - 28 : 0);
          b.bar.setAttribute('width', w.toFixed(1));
        } else { b.info.textContent = ''; b.bar.setAttribute('width', 0); }
      } else if (inf.cls === 'C') {
        const c = stt && stt.C && stt.C[n.id];
        if (c) {
          const s = 'CV ' + c.cv;
          if (b.info.textContent !== s) b.info.textContent = s;
          const w = c.pv > 0 ? Math.max(0, Math.min(1, c.cv / c.pv)) * (b.bw - 46) : 0;
          b.bar.setAttribute('width', w.toFixed(1));
        } else { b.info.textContent = ''; b.bar.setAttribute('width', 0); }
      } else {
        const f = stt && stt.F && stt.F[n.id];
        const s = f ? 'Q = ' + (f.q ? '1' : '0') : '';
        if (b.info.textContent !== s) b.info.textContent = s;
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
        paintS(v.rail, live ? 1 : -1);
        if (v.root.k === 'empty') { /* nur Draht */ }
        else walk(v.root, true, nodes, live);
        const power = !!(pw && pw.power);
        paintS(v.tail, st(power));
        v.coils.forEach(function (c, j) {
          const o = c.o;
          let lit = false;
          if (live) lit = o.t === 'reset' ? power : !!(pw.outs && pw.outs[j]);
          const s = st(lit);
          paintS([c.circ], live ? (lit ? 1 : 0) : -1);
          paintS([c.wOut], st(lit && o.t !== 'reset' ? true : power && o.t === 'reset'));
          c.circ.setAttribute('fill', live && lit ? 'rgba(76,217,100,.28)' : 'none');
          paintT([c.txt], s);
          if (live) {
            const raw = !!(pw.outs && pw.outs[j]);
            const sv = raw ? '1' : '0';
            if (c.val.textContent !== sv) c.val.textContent = sv;
            c.val.style.fill = raw ? COLON : TOFF;
          } else if (c.val.textContent) c.val.textContent = '';
        });
      });
    }

    // ---- Änderungen --------------------------------------------------
    function ensureIds(p) {
      const used = {};
      p.networks.forEach(function (n) { if (n && n.id) used[n.id] = true; });
      p.networks.forEach(function (n, i) {
        if (n && !n.id) {
          let k = i + 1; while (used['N' + k]) k++;
          n.id = 'N' + k; used[n.id] = true;
        }
      });
    }
    function newId(p) {
      const used = {}; let m = 0;
      p.networks.forEach(function (n) { if (n && n.id) { used[n.id] = true; const mm = /^N(\d+)$/.exec(n.id); if (mm) m = Math.max(m, +mm[1]); } });
      let k = Math.max(m + 1, p.networks.length + 1);
      while (used['N' + k]) k++;
      return 'N' + k;
    }
    function mutate(fn) {
      if (ro()) { toast('Das Programm ist gerade schreibgeschützt.'); return false; }
      const p = prog();
      const snap = JSON.stringify(p.networks);
      fn(p);
      p.networks.forEach(function (n) {
        if (!n) return;
        if (!isObj(n.expr)) n.expr = { t: 'const', v: true };
        n.expr = norm(n.expr);
        if (!Array.isArray(n.outs)) n.outs = [];
      });
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
          const r = await ctx.pick('Netzwerk ' + (ni + 1) + ' löschen?', [{ value: 'y', label: 'Ja, Netzwerk ' + (ni + 1) + ' löschen' }, { value: 'n', label: 'Abbrechen' }]);
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

    // ---- Auswahlmenüs ------------------------------------------------
    async function pick(title, opts) { try { return await ctx.pick(title, opts); } catch (e) { return null; } }

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
    const CONTACT_TYPES = [
      { value: 'var', label: 'Schließer  —| |—', group: 'Kontakte' },
      { value: 'varn', label: 'Öffner  —|/|—', group: 'Kontakte' },
      { value: 'P', label: 'Flanke steigend (P)  —|P|—', group: 'Kontakte' },
      { value: 'N', label: 'Flanke fallend (N)  —|N|—', group: 'Kontakte' }];
    const BOX_TYPES = Object.keys(FBINFO).map(function (k) { return { value: 'fb:' + k, label: FBINFO[k].name, group: 'Bausteine (am Zeilenende)' }; });
    function mkContact(type, a) {
      if (type === 'var') return { t: 'var', a: a };
      if (type === 'varn') return { t: 'var', a: a, neg: true };
      return { t: 'edge', a: a, mode: type };
    }

    async function chooseContact(title, extra) {
      const opts = CONTACT_TYPES.concat(extra || []);
      const t = await pick(title, opts);
      if (!t) return null;
      if (t.indexOf('fb:') === 0 || t === 'par') return { special: t };
      const a = await pickAddr('Adresse wählen', false);
      if (!a) return null;
      return { node: mkContact(t, a) };
    }

    async function makeFb(kind, inner) {
      const p = prog(), inf = FBINFO[kind];
      const id = freeId(p, inf.cls);
      if (!id) { toast('Alle Kennungen dieses Bausteintyps sind belegt.'); return null; }
      const node = { t: 'fb', fb: kind, id: id };
      if (inf.cls === 'T') {
        const r = await ctx.ask(FBINFO[kind].name, [{ key: 'pt', label: 'Zeit PT (z. B. 2s oder 500ms)', type: 'time', value: 1000 }]);
        if (!r) return null;
        const ms = parseTime(r.pt);
        if (isNaN(ms)) { toast('Die Zeit ist ungültig. Beispiel: 2s oder 500ms.'); return null; }
        node.pt = ms;
      } else if (inf.cls === 'C') {
        const r = await ctx.ask(FBINFO[kind].name, [{ key: 'pv', label: 'Vorgabewert PV (ganze Zahl)', type: 'number', value: 5 }]);
        if (!r) return null;
        const v = parseInt(r.pv, 10);
        if (isNaN(v) || v < 0 || v > 999) { toast('Der Vorgabewert muss eine ganze Zahl von 0 bis 999 sein.'); return null; }
        node.pv = v;
      }
      if (inner && !isEmptyExpr(inner)) node[inf.pins[0]] = inner;
      return node;
    }

    function limitCheck(net, path, what) {
      if (orDepth(net.expr, path) >= MAXDEPTH) { toast('Zu tief verschachtelt (max. ' + MAXDEPTH + ' Ebenen).'); return false; }
      return true;
    }

    // Element in Reihe (vor/nach) einsetzen
    function insertSeries(net, path, nn, before) {
      const r = resolve(net.expr, path);
      if (!r || !r.node) return;
      if (r.parent && r.parent.t === 'and' && !r.parent.neg) {
        if (r.parent.in.length >= MAXSER) { toast('Die Reihe ist voll (max. ' + MAXSER + ' Elemente).'); return false; }
        r.parent.in.splice(r.key + (before ? 0 : 1), 0, nn);
      } else {
        setAt(net, path, { t: 'and', in: before ? [nn, r.node] : [r.node, nn] });
      }
      return true;
    }
    function insertParallel(net, path, nn) {
      const r = resolve(net.expr, path);
      if (!r || !r.node) return false;
      if (r.parent && r.parent.t === 'or' && !r.parent.neg) {
        if (r.parent.in.length >= MAXPAR) { toast('Zu viele Parallelzweige (max. ' + MAXPAR + ').'); return false; }
        r.parent.in.splice(r.key + 1, 0, nn);
      } else {
        if (!limitCheck(net, path)) return false;
        setAt(net, path, { t: 'or', in: [r.node, nn] });
      }
      return true;
    }
    function removeAt(net, path) {
      const r = resolve(net.expr, path);
      if (!r) return;
      if (!r.parent) { net.expr = { t: 'const', v: true }; return; }
      if (r.parent.t === 'fb') delete r.parent[r.key];
      else r.parent.in.splice(r.key, 1);
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
          case 'leaf': await actLeaf(ni, d.path); break;
          case 'slot': await actSlot(ni); break;
          case 'pin': await actPin(ni, d.path, d.key); break;
          case 'box': await actBox(ni, d.path); break;
          case 'coil': await actCoil(ni, +d.out); break;
          case 'coilslot': await actCoilSlot(ni); break;
        }
      } catch (e) {
        toast('Fehler im Editor: ' + (e && e.message ? e.message : e));
        if (root.console) console.error(e);
      } finally { busy = false; }
    }

    async function actLeaf(ni, path) {
      const net = prog().networks[ni];
      const r = resolve(net.expr, path);
      if (!r || !r.node) return;
      const n = r.node;
      const opts = [];
      if (n.t === 'const') {
        opts.push({ value: 'type', label: 'Durch Kontakt ersetzen', group: 'Bearbeiten' });
      } else {
        opts.push({ value: 'addr', label: 'Adresse ändern', group: 'Bearbeiten' });
        const cur = n.t === 'edge' ? (n.mode === 'N' ? 'Flanke fallend' : 'Flanke steigend') : n.neg ? 'Öffner' : 'Schließer';
        opts.push({ value: 'type', label: 'Typ ändern (jetzt: ' + cur + ')', group: 'Bearbeiten' });
        if (n.t === 'var') opts.push({ value: 'toggle', label: n.neg ? 'Zu Schließer umschalten' : 'Zu Öffner umschalten', group: 'Bearbeiten' });
      }
      opts.push({ value: 'before', label: 'Element davor einfügen', group: 'Einfügen' });
      opts.push({ value: 'after', label: 'Element danach einfügen', group: 'Einfügen' });
      opts.push({ value: 'par', label: 'Parallelzweig daneben (unter diesem Element)', group: 'Einfügen' });
      if (r.parent && r.parent.t === 'and' && !r.parent.neg) opts.push({ value: 'parrow', label: 'Parallelzweig zur ganzen Reihe', group: 'Einfügen' });
      opts.push({ value: 'del', label: 'Element löschen', group: 'Entfernen' });
      const t = await pick(n.t === 'const' ? 'Leeres Element' : 'Kontakt ' + C.addr(n.a, mode()), opts);
      if (!t) return;
      if (t === 'addr') {
        const a = await pickAddr('Neue Adresse', false); if (!a) return;
        mutate(function () { resolve(net.expr, path).node.a = a; });
      } else if (t === 'toggle') {
        mutate(function () { const x = resolve(net.expr, path).node; if (x.neg) delete x.neg; else x.neg = true; });
      } else if (t === 'type') {
        const ty = await pick('Kontakttyp', CONTACT_TYPES); if (!ty) return;
        let a = n.a;
        if (n.t === 'const') { a = await pickAddr('Adresse wählen', false); if (!a) return; }
        mutate(function () { setAt(net, path, mkContact(ty, a)); });
      } else if (t === 'before' || t === 'after') {
        const c = await chooseContact(t === 'before' ? 'Element davor einfügen' : 'Element danach einfügen');
        if (!c || !c.node) return;
        mutate(function () { insertSeries(net, path, c.node, t === 'before'); });
      } else if (t === 'par') {
        const c = await chooseContact('Parallelzweig: Element'); if (!c || !c.node) return;
        mutate(function () { insertParallel(net, path, c.node); });
      } else if (t === 'parrow') {
        const c = await chooseContact('Parallelzweig zur Reihe: Element'); if (!c || !c.node) return;
        mutate(function () { insertParallel(net, r.parentPath, c.node); });
      } else if (t === 'del') {
        mutate(function () { removeAt(net, path); });
      }
    }

    async function actSlot(ni) {
      const net = prog().networks[ni];
      const empty = isEmptyExpr(net.expr);
      const extra = empty ? [] : [{ value: 'par', label: 'Parallelzweig öffnen (ODER zur ganzen Zeile)', group: 'Zweig' }];
      const c = await chooseContact(empty ? 'Erstes Element' : 'Element am Zeilenende', extra.concat(BOX_TYPES));
      if (!c) return;
      if (c.special === 'par') {
        const c2 = await chooseContact('Parallelzweig: Element'); if (!c2 || !c2.node) return;
        mutate(function () { if (net.expr.t === 'or' && !net.expr.neg) { if (net.expr.in.length >= MAXPAR) { toast('Zu viele Parallelzweige.'); return; } net.expr.in.push(c2.node); } else net.expr = { t: 'or', in: [net.expr, c2.node] }; });
      } else if (c.special) {
        const kind = c.special.slice(3);
        const fb = await makeFb(kind, empty ? null : net.expr);
        if (!fb) return;
        mutate(function () { net.expr = fb; });
        toast(FBINFO[kind].lab + ' ' + fb.id + ' eingefügt' + (FBINFO[kind].pins.some(function (k) { return !fb[k]; }) ? ' – Eingänge noch belegen.' : '.'));
      } else {
        mutate(function () {
          if (isEmptyExpr(net.expr)) net.expr = c.node;
          else if (net.expr.t === 'and' && !net.expr.neg) { if (net.expr.in.length >= MAXSER) { toast('Die Reihe ist voll (max. ' + MAXSER + ' Elemente).'); return; } net.expr.in.push(c.node); }
          else net.expr = { t: 'and', in: [net.expr, c.node] };
        });
      }
    }

    async function actPin(ni, ownerPath, key) {
      const net = prog().networks[ni];
      const c = await chooseContact('Eingang ' + (key || '').toUpperCase() + ': Element');
      if (!c || !c.node) return;
      mutate(function () {
        const r = resolve(net.expr, ownerPath);
        if (r && r.node && r.node.t === 'fb') r.node[key] = c.node;
      });
    }

    async function actBox(ni, path) {
      const p = prog(), net = p.networks[ni];
      const r = resolve(net.expr, path);
      if (!r || !r.node) return;
      const n = r.node;
      if (n.t !== 'fb') {
        const opts = [
          { value: 'neg', label: n.neg ? 'Negation am Ausgang entfernen' : 'Ausgang negieren', group: 'Bearbeiten' },
          { value: 'addin', label: 'Eingang hinzufügen', group: 'Bearbeiten' },
          { value: 'del', label: 'Gatter auflösen (Eingänge in Reihe)', group: 'Entfernen' },
          { value: 'delall', label: 'Gatter samt Eingängen löschen', group: 'Entfernen' }];
        const t = await pick('Teilnetz ' + (n.t === 'xor' ? 'XOR' : n.t === 'or' ? 'ODER (negiert)' : 'UND (negiert)') + ' (aus dem FUP)', opts);
        if (!t) return;
        if (t === 'neg') mutate(function () { const x = resolve(net.expr, path).node; if (x.neg) delete x.neg; else x.neg = true; });
        else if (t === 'addin') {
          const c = await chooseContact('Neuer Eingang'); if (!c || !c.node) return;
          mutate(function () { const x = resolve(net.expr, path).node; if (x.in.length >= 6) { toast('Mehr als 6 Eingänge sind nicht möglich.'); return; } x.in.push(c.node); });
        } else if (t === 'del') mutate(function () { const x = resolve(net.expr, path).node; setAt(net, path, { t: 'and', in: x.in.slice() }); });
        else if (t === 'delall') mutate(function () { removeAt(net, path); });
        return;
      }
      const inf = FBINFO[n.fb];
      const opts = [];
      if (inf.cls === 'T') opts.push({ value: 'pt', label: 'Zeit PT ändern (jetzt ' + fmtMs(n.pt) + ')', group: 'Bearbeiten' });
      if (inf.cls === 'C') opts.push({ value: 'pv', label: 'Vorgabewert PV ändern (jetzt ' + (n.pv | 0) + ')', group: 'Bearbeiten' });
      opts.push({ value: 'kind', label: 'Bausteintyp ändern (jetzt ' + inf.lab + ')', group: 'Bearbeiten' });
      if (inf.cls !== 'F') opts.push({ value: 'id', label: 'Kennung ändern (jetzt ' + n.id + ')', group: 'Bearbeiten' });
      opts.push({ value: 'neg', label: n.neg ? 'Negation am Ausgang entfernen' : 'Ausgang negieren', group: 'Bearbeiten' });
      opts.push({ value: 'del', label: 'Baustein entfernen (Eingangskontakte bleiben)', group: 'Entfernen' });
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
          if (inf.cls === 'C' && k === 'ctd' && x.r) { x.ld = x.r; }
          else if (inf.cls === 'C' && k === 'ctu' && x.ld) { x.r = x.ld; }
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
          // Kontakte auf den alten Baustein mitführen
          p.networks.forEach(function (nn) { renameRefs(nn.expr, oldId + '.Q', id + '.Q'); });
        });
      } else if (t === 'neg') {
        mutate(function () { const x = resolve(net.expr, path).node; if (x.neg) delete x.neg; else x.neg = true; });
      } else if (t === 'del') {
        mutate(function () { const x = resolve(net.expr, path).node; const first = inf.pins.map(function (k) { return x[k]; }).filter(Boolean); setAt(net, path, first.length ? { t: 'and', in: first } : { t: 'const', v: true }); });
      } else if (t === 'delall') {
        mutate(function () { removeAt(net, path); });
      }
    }
    function renameRefs(e, from, to) {
      if (!isObj(e)) return;
      if ((e.t === 'var' || e.t === 'edge') && e.a === from) e.a = to;
      childList(e).forEach(function (c) { if (c.node) renameRefs(c.node, from, to); });
    }

    const COIL_TYPES = [
      { value: 'coil', label: 'Spule  —( )—', group: 'Spulen' },
      { value: 'coiln', label: 'Spule negiert  —(/)—', group: 'Spulen' },
      { value: 'set', label: 'Setzen  —(S)—', group: 'Spulen' },
      { value: 'reset', label: 'Rücksetzen  —(R)—', group: 'Spulen' }];
    function mkCoil(type, a) {
      if (type === 'coiln') return { t: 'coil', a: a, neg: true };
      return { t: type, a: a };
    }
    async function actCoilSlot(ni) {
      const net = prog().networks[ni];
      if ((net.outs || []).length >= MAXOUT) { toast('Mehr als ' + MAXOUT + ' Spulen je Netzwerk sind nicht möglich.'); return; }
      const t = await pick('Spule hinzufügen', COIL_TYPES); if (!t) return;
      const a = await pickAddr('Ausgang oder Merker wählen', true); if (!a) return;
      mutate(function () { net.outs = net.outs || []; net.outs.push(mkCoil(t, a)); });
    }
    async function actCoil(ni, j) {
      const net = prog().networks[ni];
      const o = net.outs[j]; if (!o) return;
      const cur = o.t === 'set' ? 'Setzen' : o.t === 'reset' ? 'Rücksetzen' : o.neg ? 'Spule negiert' : 'Spule';
      const t = await pick(cur + ' ' + C.addr(o.a, mode()), [
        { value: 'addr', label: 'Adresse ändern', group: 'Bearbeiten' },
        { value: 'type', label: 'Typ ändern (jetzt: ' + cur + ')', group: 'Bearbeiten' },
        { value: 'add', label: 'Weitere Spule parallel hinzufügen', group: 'Einfügen' },
        { value: 'del', label: 'Spule löschen', group: 'Entfernen' }]);
      if (!t) return;
      if (t === 'addr') {
        const a = await pickAddr('Neue Adresse (Ausgang oder Merker)', true); if (!a) return;
        mutate(function () { net.outs[j].a = a; });
      } else if (t === 'type') {
        const ty = await pick('Spulentyp', COIL_TYPES); if (!ty) return;
        mutate(function () { net.outs[j] = mkCoil(ty, o.a); });
      } else if (t === 'add') await actCoilSlot(ni);
      else if (t === 'del') mutate(function () { net.outs.splice(j, 1); });
    }

    // ---- Leiste ------------------------------------------------------
    function setZoom(z) {
      zoom = Math.max(0.4, Math.min(2.5, z));
      try { localStorage.setItem('sps.kop.zoom', String(zoom)); } catch (e) { /* ignorieren */ }
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
          const avail = body.clientWidth - 40;
          setZoom(Math.min(1.6, Math.max(0.4, avail / mw)));
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

  SE.register('kop', { title: 'Kontaktplan (KOP)', mount: mount });
  if (typeof module !== 'undefined' && module.exports) module.exports = SE;
})(typeof window !== 'undefined' ? window : globalThis);
