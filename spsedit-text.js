/* spsedit-text.js - Textansicht des SPS-Labs (Editor-ID 'text', nur lesen)
 * Zeigt das aktuelle Programm ueber SPS_CORE.toText(prog, addrMode, {symbols}) als Anweisungsliste (AWL / IL)
 * bzw. als lesbare GRAFCET-Liste, mit Zeilennummern, Kopierknopf und (bei laufender Simulation) Livewerten
 * als Kommentar am Zeilenende. Der Kopierknopf kopiert nur den Programmtext ohne Livewerte.
 *
 * Hinweise zur UI-Anbindung:
 *  - Der AWL-Stil (Siemens U UN O = S R / IEC LD AND OR ST) folgt automatisch ctx.addrMode() ('s7' / 'iec');
 *    die Stil-Anzeige oben ist nur eine Anzeige, kein Schalter.
 *  - refresh() baut den Text nur neu auf, wenn sich Programm, Adressmodus oder Symbolanzeige geaendert haben;
 *    sonst werden nur die Livewerte (Textknoten) aktualisiert.
 */
(function (root) {
  'use strict';

  const SPS_EDIT = root.SPS_EDIT = root.SPS_EDIT || { editors: {}, register: function (id, def) { this.editors[id] = def; } };
  const MONO = 'ui-monospace, "Cascadia Mono", Consolas, Menlo, "Courier New", monospace';

  const CSS = [
    '.st-root{display:flex;flex-direction:column;height:100%;min-height:300px;background:#14181c;color:#e8edf2;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden;box-sizing:border-box}',
    '.st-root *{box-sizing:border-box}',
    '.st-head{flex:0 0 auto;background:#222830;border-bottom:1px solid #2c343e;padding:10px 12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.st-hint{flex:1 1 260px;font-weight:600}',
    '.st-style{display:flex;gap:4px;align-items:center;font-size:12px;color:#8b97a3}',
    '.st-pill{padding:6px 10px;border-radius:16px;background:#2c343e;border:1px solid #3a4452;font-family:' + MONO + ';font-size:12px;color:#8b97a3}',
    '.st-pill.on{background:#3b9eff;border-color:#3b9eff;color:#06121f;font-weight:700}',
    '.st-btn{min-height:40px;min-width:40px;padding:0 14px;border:1px solid #3a4452;background:#2c343e;color:#e8edf2;border-radius:10px;font:inherit;font-weight:600;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}',
    '.st-btn:active{filter:brightness(1.25)}',
    '.st-btn.ok{background:#4cd964;border-color:#4cd964;color:#06200d}',
    '.st-body{flex:1 1 auto;overflow:auto;padding:8px 0 16px;-webkit-overflow-scrolling:touch}',
    '.st-grid{display:grid;grid-template-columns:auto auto 1fr;min-width:min-content;font:14px/1.55 ' + MONO + '}',
    '.st-row{display:contents}',
    '.st-ln{padding:0 10px 0 12px;text-align:right;color:#56626f;user-select:none;-webkit-user-select:none;border-right:1px solid #2c343e;position:sticky;left:0;background:#14181c}',
    '.st-code{padding:0 0 0 12px;white-space:pre;color:#e8edf2}',
    '.st-code.cm{color:#8b97a3}',
    '.st-code.hd{color:#7fc0ff;font-weight:700}',
    '.st-lv{padding:0 16px 0 28px;white-space:pre;color:#4cd964}',
    '.st-lv.z{color:#8b97a3}',
    '.st-row:hover .st-code{background:rgba(255,255,255,.04)}',
    '.st-note{padding:6px 12px;color:#8b97a3;font-size:12px}'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('sps-text-style')) return;
    const st = document.createElement('style');
    st.id = 'sps-text-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  function h(tag, attrs, ch) {
    const e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    if (ch !== undefined && ch !== null) (Array.isArray(ch) ? ch : [ch]).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  // ----- Livewerte
  function keyVal(key, st) {
    let m;
    if (/^I\d\.\d$/.test(key)) return !!(st.I && st.I[key]);
    if (/^Q\d\.\d$/.test(key)) return !!(st.Q && st.Q[key]);
    if (/^M\d\.\d$/.test(key)) return !!(st.M && st.M[key]);
    if ((m = /^(T\d+)\.(Q|ET)$/.exec(key))) { const t = st.T && st.T[m[1]]; return !!t && (m[2] === 'Q' ? !!t.q : t.et > 0); }
    if ((m = /^(C\d+)\.(Q|CV)$/.exec(key))) { const c = st.C && st.C[m[1]]; return !!c && (m[2] === 'Q' ? !!c.q : c.cv > 0); }
    return false;
  }
  function evalAst(n, st, act) {
    function ev(x) {
      switch (x.t) {
        case 'const': return x.v;
        case 'key': return keyVal(x.key, st);
        case 'step': return act.has(x.id);
        case 'time': return act.has(x.step) && ((st.stepTimes && st.stepTimes[x.step]) || 0) >= x.ms;
        case 'not': return !ev(x.x);
        case 'and': { let r = true; x.in.forEach(function (c) { if (!ev(c)) r = false; }); return r; }
        case 'or': { let r = false; x.in.forEach(function (c) { if (ev(c)) r = true; }); return r; }
        case 'xor': { let c = 0; x.in.forEach(function (k) { if (ev(k)) c++; }); return c % 2 === 1; }
        case 'edge': return ev(x.x);
        default: return false;
      }
    }
    try { return !!ev(n); } catch (e) { return false; }
  }

  const OPS = /^\s*(U|UN|O|ON|X|XN|LD|LDN|AND|ANDN|OR|ORN|XOR|XORN|ST|STN|=|S|R|SE|SA|SI|ZV|ZR|CAL)\s+(.+?)\s*$/;
  const ADDR_RE = /(%?[IQM]X?\d\.\d|[EA]\d\.\d|(?:TON|TOF|TP|CTU|CTD|[TCZ])\d+)(?:\.(Q|ET|CV))?/g;
  const SUBIN = /\.(IN|CU|CD|R|LD|S|S1|R1|PT|PV)\b/;

  function lastKey(operand, CORE) {
    let m, last = null;
    ADDR_RE.lastIndex = 0;
    while ((m = ADDR_RE.exec(operand))) last = m;
    if (!last) return null;
    const k = CORE.parseAddr(last[0]);
    return k;
  }

  function analyze(text, prog, ctxState, CORE) {
    // liefert { type, key?, id?, ... } oder null
    if (/^\s*\/\//.test(text) || !text.trim()) return null;
    const gra = prog && prog.lang === 'gra';
    if (gra) {
      let m = /^Schritt (\S+)/.exec(text);
      if (m) { ctxState.step = m[1]; return { type: 'step', id: m[1] }; }
      m = /^Transition (\S+?):/.exec(text);
      if (m) { ctxState.step = null; return { type: 'trans', id: m[1] }; }
      m = /^\s{4}[NSRDL] \([^)]*\) (.+?)(?:, t = .*)?$/.exec(text);
      if (m) {
        const k = lastKey(m[1], CORE);
        return k ? { type: 'act', key: k, step: ctxState.step } : null;
      }
      return null;
    }
    const m = OPS.exec(text);
    if (!m) return null;
    const op = m[1], opd = m[2];
    if (/^(P|N|R_TRIG|F_TRIG)\(/.test(opd) || /^T#|^C#/.test(opd)) return null;
    if (SUBIN.test(opd)) return null;
    if (op === 'CAL' && /^[A-Za-z_]\w*$/.test(opd.split('(')[0]) === false) return null;
    const ff = /^([A-Za-z_]\w*)(?:\.Q)?$/.exec(opd.split('(')[0]);
    const k = lastKey(opd, CORE);
    if (k) {
      if (/^[TC]\d+$/.test(k)) {
        if (/^(SE|SA|SI|ZV|ZR|CAL)$/.test(op)) return { type: /^T/.test(k) ? 'timer' : 'counter', id: k, op: op };
        return { type: 'bit', key: k + '.Q' };   // Abfrage des Bausteinausgangs (U T1, LD TON1 ...)
      }
      return { type: 'bit', key: k };
    }
    if (ff && !/^(TRUE|FALSE)$/i.test(ff[1])) return { type: 'ff', id: ff[1] };
    return null;
  }

  function mount(el, ctx) {
    injectStyle();
    const CORE = root.SPS_CORE;
    const hint = h('div', { class: 'st-hint' });
    const pill1 = h('span', { class: 'st-pill', text: 'Siemens: U UN O = S R' });
    const pill2 = h('span', { class: 'st-pill', text: 'IEC: LD AND OR ST' });
    const styleBox = h('div', { class: 'st-style' }, [pill1, pill2]);
    const copyBtn = h('button', { class: 'st-btn', text: '⧉ Kopieren', 'aria-label': 'Text kopieren', onclick: doCopy });
    const head = h('div', { class: 'st-head' }, [hint, styleBox, copyBtn]);
    const grid = h('div', { class: 'st-grid' });
    const body = h('div', { class: 'st-body' }, [grid]);
    const rootEl = h('div', { class: 'st-root' }, [head, body]);
    el.innerHTML = '';
    el.appendChild(rootEl);

    let sig = '', text = '', lines = [], info = [], cells = [], lastLv = '';
    let destroyed = false;

    function doCopy() {
      const done = function () { copyBtn.textContent = '✓ Kopiert'; copyBtn.classList.add('ok'); try { ctx.toast('Programmtext kopiert'); } catch (e) { /* ok */ } setTimeout(function () { copyBtn.textContent = '⧉ Kopieren'; copyBtn.classList.remove('ok'); }, 1600); };
      const fallback = function () {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        if (ok) done(); else { try { ctx.toast('Kopieren nicht möglich: markiere den Text und kopiere ihn von Hand'); } catch (e) { /* ok */ } }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    }

    function rebuild() {
      const prog = ctx.getProg();
      const mode = ctx.addrMode() === 's7' ? 's7' : 'iec';
      const sym = !!(ctx.showSymbols && ctx.showSymbols());
      let s;
      try { s = mode + '|' + sym + '|' + JSON.stringify(prog); } catch (e) { s = String(Math.random()); }
      if (s === sig) return;
      sig = s;
      const gra = !!prog && prog.lang === 'gra';
      hint.textContent = gra
        ? 'So wird das GRAFCET als Liste beschrieben: Schritte mit Aktionen, danach die Transitionen mit ihren Bedingungen'
        : 'So würde das Programm als Anweisungsliste in der Steuerung stehen';
      styleBox.style.display = gra ? 'none' : '';
      pill1.classList.toggle('on', mode === 's7');
      pill2.classList.toggle('on', mode !== 's7');
      text = prog ? CORE.toText(prog, mode, { symbols: sym }) : '';
      lines = text.split('\n');
      info = []; cells = [];
      const st = {};
      grid.innerHTML = '';
      const frag = document.createDocumentFragment();
      lines.forEach(function (ln, i) {
        info[i] = analyze(ln, prog, st, CORE);
        const row = h('div', { class: 'st-row' });
        const cm = /^\s*\/\//.test(ln);
        const hd = /^(Schritt|Transition) /.test(ln);
        const lv = h('span', { class: 'st-lv' });
        row.appendChild(h('span', { class: 'st-ln', text: String(i + 1) }));
        row.appendChild(h('span', { class: 'st-code' + (cm ? ' cm' : hd ? ' hd' : ''), text: ln === '' ? ' ' : ln }));
        row.appendChild(lv);
        frag.appendChild(row);
        cells[i] = { el: lv, txt: '' };
      });
      grid.appendChild(frag);
      lastLv = '';
    }

    function fmtB(v) { return v ? '1' : '0'; }

    function liveFor(inf, lv, prog) {
      const st = lv.state;
      switch (inf.type) {
        case 'bit': return '// ' + fmtB(keyVal(inf.key, st));
        case 'timer': { const t = st.T && st.T[inf.id]; return t ? '// Q=' + fmtB(t.q) + '  ET=' + Math.round(t.et) + ' ms' : null; }
        case 'counter': { const c = st.C && st.C[inf.id]; return c ? '// Q=' + fmtB(c.q) + '  CV=' + c.cv : null; }
        case 'ff': { const f = st.F && st.F[inf.id]; return f ? '// ' + fmtB(f.q) : null; }
        case 'step': {
          const on = (st.steps || []).indexOf(inf.id) >= 0;
          return on ? '// aktiv seit ' + (Math.floor(((st.stepTimes && st.stepTimes[inf.id]) || 0) / 100) / 10).toFixed(1) + ' s' : '// nicht aktiv';
        }
        case 'act': {
          const on = inf.step && (st.steps || []).indexOf(inf.step) >= 0;
          return '// ' + fmtB(keyVal(inf.key, st)) + (on ? '' : '  (Schritt nicht aktiv)');
        }
        case 'trans': {
          const g = prog && prog.gra;
          const t = g && (g.transitions || []).filter(function (x) { return x.id === inf.id; })[0];
          if (!t) return null;
          const act = new Set(st.steps || []);
          const rdy = (t.from || []).length > 0 && t.from.every(function (f) { return act.has(f); });
          const r = CORE.parseCond(t.cond, prog);
          const tru = r.ok ? evalAst(r.ast, st, act) : false;
          return '// ' + (rdy ? 'schaltbereit' : 'Quelle nicht aktiv') + (r.ok ? ', Bedingung ' + (tru ? 'wahr' : 'falsch') : ', Bedingung fehlerhaft');
        }
        default: return null;
      }
    }

    function applyLive() {
      let lv = null;
      try { lv = ctx.live && ctx.live(); } catch (e) { lv = null; }
      const prog = ctx.getProg();
      let key = 'off';
      if (lv && lv.state) {
        const st = lv.state;
        key = [(st.steps || []).join(','), st.cycles, st.timeMs].join('|');
        if (key === lastLv) return;
      } else if (lastLv === 'off') return;
      lastLv = key;
      for (let i = 0; i < cells.length; i++) {
        const inf = info[i];
        let t = '';
        if (lv && lv.state && inf) { t = liveFor(inf, lv, prog) || ''; }
        const c = cells[i];
        if (t !== c.txt) { c.txt = t; c.el.textContent = t; c.el.classList.toggle('z', /\/\/ 0\b|nicht aktiv|Quelle nicht/.test(t)); }
      }
    }

    rebuild();
    applyLive();
    return {
      refresh: function () { if (destroyed) return; rebuild(); applyLive(); },
      destroy: function () { destroyed = true; el.innerHTML = ''; }
    };
  }

  SPS_EDIT.register('text', { title: 'Text (AWL)', mount: mount });
})(typeof window !== 'undefined' ? window : globalThis);
