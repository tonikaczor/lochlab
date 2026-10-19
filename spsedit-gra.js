/* spsedit-gra.js - GRAFCET-Editor des SPS-Labs (Editor-ID 'gra')
 * Grafische Ablaufsprache nach DIN EN 60848: Schritte, Aktionen (N S R D L), Transitionen mit Bedingungstext,
 * Verzweigungen (alternativ / parallel), Ruecksprung-Pfeile, automatisches Layout, Livewerte.
 * Vanilla-JS, SVG, kein eval, keine externen Abhaengigkeiten. Registriert sich bei window.SPS_EDIT.
 *
 * ENTSCHEIDUNGEN / Hinweise zur UI-Anbindung:
 *  - Datenmodell Abschnitt 3.2: prog.gra = { steps:[{id,init?,title?,actions:[{q,a,t?}]}], transitions:[{id,from[],to[],cond}] }.
 *    Der Editor aendert ctx.getProg().gra direkt und ruft danach ctx.changed().
 *  - Ist prog.lang nicht 'gra', zeigt der Editor nur einen Hinweis (er legt nichts an). Fehlt prog.gra bei lang==='gra',
 *    wird beim Einbinden ein Grundgeruest (ein Anfangsschritt S0) angelegt und ctx.changed() gerufen.
 *  - ctx.ask mit type:'time': Wert wird in Millisekunden (Zahl) uebergeben; als Ergebnis akzeptiert der Editor
 *    eine Zahl (ms) oder einen Text mit Einheit ('3s', '500ms', '1,5 s'); ein reiner Zifferntext zaehlt als ms.
 *  - Rueckgaengig/Wiederholen (100 Schritte) liegt im Editor (JSON-Schnappschuesse von prog.gra) und wird
 *    verworfen, wenn ctx.getProg() ein anderes Objekt liefert.
 *  - Neue Transitionen bekommen eine Platzhalter-Bedingung (t/S/1s, true oder false, siehe Funktionen op*).
 */
(function (root) {
  'use strict';

  const SPS_EDIT = root.SPS_EDIT = root.SPS_EDIT || { editors: {}, register: function (id, def) { this.editors[id] = def; } };
  const NSV = 'http://www.w3.org/2000/svg';
  const CORE = function () { return root.SPS_CORE; };
  const MONO = 'ui-monospace, "Cascadia Mono", Consolas, Menlo, "Courier New", monospace';
  const RESERVED = ['AND', 'OR', 'XOR', 'NOT', 'UND', 'ODER', 'XODER', 'EXOR', 'NICHT', 'TRUE', 'FALSE', 'WAHR', 'FALSCH', 'RE', 'FE', 'T'];
  const QTYPES = [
    { value: 'N', label: 'N – nur solange der Schritt aktiv ist' },
    { value: 'S', label: 'S – setzen (bleibt gespeichert)' },
    { value: 'R', label: 'R – zurücksetzen' },
    { value: 'D', label: 'D – verzögert einschalten (mit Zeit)' },
    { value: 'L', label: 'L – zeitbegrenzt einschalten (mit Zeit)' }
  ];

  // ------------------------------------------------------------------ Stil
  const CSS = [
    '.sg-root{position:relative;display:flex;flex-direction:column;height:100%;min-height:380px;background:#14181c;color:#e8edf2;font:14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden;box-sizing:border-box}',
    '.sg-root *{box-sizing:border-box}',
    '.sg-bar{display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:#222830;border-bottom:1px solid #2c343e;align-items:center;flex:0 0 auto}',
    '.sg-sp{flex:1 1 4px}',
    '.sg-btn{min-height:40px;min-width:40px;padding:0 12px;border:1px solid #3a4452;background:#2c343e;color:#e8edf2;border-radius:10px;font:inherit;font-weight:600;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;white-space:nowrap}',
    '.sg-btn:active{filter:brightness(1.25)}',
    '.sg-btn:disabled{opacity:.38;cursor:default}',
    '.sg-btn.pri{background:#3b9eff;border-color:#3b9eff;color:#06121f}',
    '.sg-btn.ok{background:#4cd964;border-color:#4cd964;color:#06200d}',
    '.sg-btn.dng{background:#3a2226;border-color:#6d3038;color:#ffb3ba}',
    '.sg-btn.warn{color:#ffb340;border-color:#6b5427}',
    '.sg-btn.sm{min-height:40px;padding:0 10px;font-weight:500}',
    '.sg-scroll{flex:1 1 auto;overflow:auto;position:relative;-webkit-overflow-scrolling:touch;background:#14181c}',
    '.sg-svg{display:block;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}',
    '.sg-link{stroke:#aab6c3;stroke-width:2;fill:none;stroke-linejoin:round}',
    '.sg-link.on{stroke:#4cd964}',
    '.sg-bar2{stroke:#aab6c3;stroke-width:2.4}',
    '.sg-arrow{fill:#aab6c3}',
    '.sg-step{cursor:pointer}',
    '.sg-step .main{fill:#222830;stroke:#aab6c3;stroke-width:2}',
    '.sg-step .inner{fill:none;stroke:#aab6c3;stroke-width:1.5}',
    '.sg-step.on .main{fill:#1d4a2b;stroke:#4cd964}',
    '.sg-step.on .inner{stroke:#4cd964}',
    '.sg-step.sel .main{stroke:#3b9eff;stroke-width:3.5}',
    '.sg-step .nm{fill:#e8edf2;font:700 14px ' + MONO + ';text-anchor:middle}',
    '.sg-step .tm{fill:#9fe6b0;font:10px ' + MONO + ';text-anchor:middle;display:none}',
    '.sg-step.on .tm{display:block}',
    '.sg-step .dot{fill:#4cd964;display:none}',
    '.sg-step.on .dot{display:block}',
    '.sg-step .ttl{fill:#8b97a3;font:11px system-ui,sans-serif;text-anchor:end}',
    '.sg-act{cursor:pointer}',
    '.sg-act rect{fill:#222830;stroke:#aab6c3;stroke-width:1.6}',
    '.sg-act line{stroke:#aab6c3;stroke-width:1.4}',
    '.sg-act text{fill:#e8edf2;font:12px ' + MONO + '}',
    '.sg-act .q{font-weight:700;text-anchor:middle;fill:#7fc0ff}',
    '.sg-act.on rect{fill:#1d4a2b;stroke:#4cd964}',
    '.sg-act.sel rect{stroke:#3b9eff}',
    '.sg-tr{cursor:pointer}',
    '.sg-tr .hit{fill:transparent}',
    '.sg-tr.sel .hit{fill:rgba(59,158,255,.14)}',
    '.sg-tr .tick{fill:#e8edf2}',
    '.sg-tr .tid{fill:#8b97a3;font:11px ' + MONO + ';text-anchor:end}',
    '.sg-tr .cond{fill:#d6dee7;font:12px ' + MONO + '}',
    '.sg-tr .cond.bad{fill:#ff8a8a}',
    '.sg-tr.rdy .tick{fill:#ffb340}',
    '.sg-tr.rdy .cond{fill:#ffcf80}',
    '.sg-tr.tru .cond{fill:#7ee08f}',
    '.sg-tr.rdy.tru .tick{fill:#4cd964}',
    '.sg-tr.rdy.tru .cond{fill:#4cd964}',
    '.sg-tr.sel .tick{fill:#3b9eff}',
    '.sg-ov{position:absolute;inset:0;background:rgba(5,8,12,.62);z-index:20;display:none}',
    '.sg-ov.show{display:block}',
    '.sg-sheet{position:absolute;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:760px;max-height:92%;overflow:auto;background:#222830;border:1px solid #3a4452;border-bottom:0;border-radius:16px 16px 0 0;padding:14px 14px 18px;box-shadow:0 -8px 30px rgba(0,0,0,.5);-webkit-overflow-scrolling:touch}',
    '.sg-sheet h3{margin:0 0 10px;font-size:17px;font-weight:700;display:flex;align-items:center;gap:8px}',
    '.sg-sheet h4{margin:14px 0 6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#8b97a3;font-weight:600}',
    '.sg-x{margin-left:auto}',
    '.sg-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0}',
    '.sg-in{flex:1 1 140px;min-height:44px;padding:0 12px;background:#14181c;border:1px solid #3a4452;border-radius:10px;color:#e8edf2;font:inherit;font-size:16px;min-width:0}',
    '.sg-in:focus{outline:2px solid #3b9eff;border-color:#3b9eff}',
    'textarea.sg-in{padding:10px 12px;min-height:84px;font-family:' + MONO + ';font-size:15px;resize:vertical;width:100%;flex:1 1 100%}',
    '.sg-lab{flex:0 0 64px;color:#8b97a3;font-size:13px}',
    '.sg-chip{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 6px 0 12px;background:#14181c;border:1px solid #3a4452;border-radius:20px;font-family:' + MONO + ';font-size:14px}',
    '.sg-chip button{width:32px;height:32px;border-radius:16px;border:0;background:#2c343e;color:#e8edf2;font-size:16px;cursor:pointer}',
    '.sg-act-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;background:#1a1f25;border:1px solid #2c343e;border-radius:10px;padding:6px;margin:4px 0}',
    '.sg-act-row .sg-btn{font-family:' + MONO + '}',
    '.sg-status{margin:8px 0 2px;padding:8px 10px;border-radius:10px;font-size:13px;line-height:1.4;background:#1a1f25;border:1px solid #2c343e;word-break:break-word}',
    '.sg-status.ok{color:#7ee08f;border-color:#2f6a3c}',
    '.sg-status.bad{color:#ff9a9a;border-color:#7a3a3a}',
    '.sg-mirror{font-family:' + MONO + ';font-size:13px;white-space:pre-wrap;word-break:break-all;margin-top:4px;color:#c9d3dd}',
    '.sg-mirror b{background:#ff5f5f;color:#14181c;border-radius:3px;padding:0 1px}',
    '.sg-live{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:10px;font-size:12px;background:#2c343e;color:#8b97a3}',
    '.sg-live.t{background:#1d4a2b;color:#7ee08f}',
    '.sg-help{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}',
    '.sg-help .sg-btn{font-family:' + MONO + ';min-width:48px;padding:0 10px}',
    '.sg-stick{position:sticky;bottom:-18px;background:#222830;padding:10px 0 6px;margin-top:10px;border-top:1px solid #2c343e;z-index:2}',
    '.sg-msg{padding:24px;color:#8b97a3;text-align:center}',
    '.sg-badlist{padding:6px 8px;background:#2b2418;border-top:1px solid #6b5427;color:#ffcf80;font-size:13px;display:none;flex:0 0 auto}',
    '.sg-badlist.show{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
    '.sg-list{margin:6px 0;padding:0;list-style:none}',
    '.sg-list li{padding:8px 10px;margin:4px 0;background:#1a1f25;border:1px solid #2c343e;border-radius:10px;font-size:13px;word-break:break-word}',
    '.sg-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px;margin:6px 0}'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('sps-gra-style')) return;
    const st = document.createElement('style');
    st.id = 'sps-gra-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ------------------------------------------------------------------ DOM-Helfer
  function setAttrs(e, attrs) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (k) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.setAttribute('class', v);
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'value' && 'value' in e) e.value = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
  }
  function kids(e, ch) {
    if (ch === undefined || ch === null) return e;
    (Array.isArray(ch) ? ch : [ch]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return e;
  }
  function h(tag, attrs, ch) { const e = document.createElement(tag); setAttrs(e, attrs); return kids(e, ch); }
  function sv(tag, attrs, ch) { const e = document.createElementNS(NSV, tag); setAttrs(e, attrs); return kids(e, ch); }

  // ------------------------------------------------------------------ Hilfsfunktionen Modell
  function fmtT(ms) { ms = Number(ms) || 0; return ms % 1000 === 0 ? (ms / 1000) + 's' : ms + 'ms'; }
  function fmtSec(ms) { return (Math.floor((ms || 0) / 100) / 10).toFixed(1) + 's'; }
  function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function normalize(prog) {
    if (!prog.gra || typeof prog.gra !== 'object') prog.gra = { steps: [], transitions: [] };
    const g = prog.gra;
    if (!Array.isArray(g.steps)) g.steps = [];
    if (!Array.isArray(g.transitions)) g.transitions = [];
    g.steps = g.steps.filter(function (s) { return s && typeof s === 'object' && typeof s.id === 'string'; });
    if (!g.steps.length) g.steps.push({ id: 'S0', init: true, title: 'Grundstellung', actions: [] });
    g.steps.forEach(function (s) { if (!Array.isArray(s.actions)) s.actions = []; });
    g.transitions = g.transitions.filter(function (t) { return t && typeof t === 'object'; });
    const used = {};
    g.transitions.forEach(function (t) {
      if (typeof t.from === 'string') t.from = [t.from];
      if (typeof t.to === 'string') t.to = [t.to];
      if (!Array.isArray(t.from)) t.from = [];
      if (!Array.isArray(t.to)) t.to = [];
      if (typeof t.cond !== 'string') t.cond = 'true';
      if (typeof t.id !== 'string' || !t.id || used[t.id]) t.id = null;
      else used[t.id] = true;
    });
    g.transitions.forEach(function (t) {
      if (t.id) return;
      let n = 1;
      while (used['T' + n]) n++;
      t.id = 'T' + n; used[t.id] = true;
    });
    if (!g.steps.some(function (s) { return s.init; })) g.steps[0].init = true;
    return g;
  }

  // Schrittbezeichner in einem Bedingungstext ersetzen (nur ganze Namen, nicht in Adressen)
  function replaceRef(cond, old, nw) {
    const re = new RegExp('(^|[^A-Za-z0-9_.%])' + esc(old) + '(?![A-Za-z0-9_.])', 'gi');
    return String(cond).replace(re, function (m0, p1) { return p1 + nw; });
  }

  function newStepId(g) {
    let max = -1;
    g.steps.forEach(function (s) { const m = /^S(\d+)$/.exec(s.id); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    let n = max + 1;
    const used = {}; g.steps.forEach(function (s) { used[s.id.toUpperCase()] = true; });
    while (used['S' + n]) n++;
    return 'S' + n;
  }
  function newTransId(g) {
    let max = 0;
    g.transitions.forEach(function (t) { const m = /^T(\d+)$/.exec(t.id); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    let n = max + 1;
    const used = {}; g.transitions.forEach(function (t) { used[t.id] = true; });
    while (used['T' + n]) n++;
    return 'T' + n;
  }
  function stepById(g, id) { for (let i = 0; i < g.steps.length; i++) if (g.steps[i].id === id) return g.steps[i]; return null; }
  function transById(g, id) { for (let i = 0; i < g.transitions.length; i++) if (g.transitions[i].id === id) return g.transitions[i]; return null; }

  function parseTime(v) {
    if (typeof v === 'number') return isFinite(v) && v > 0 ? Math.min(3600000, Math.round(v)) : null;
    if (typeof v !== 'string') return null;
    const m = /^\s*(\d+(?:[.,]\d+)?)\s*(ms|s|min)?\s*$/i.exec(v);
    if (!m) return null;
    const mult = { ms: 1, s: 1000, min: 60000 }[(m[2] || 'ms').toLowerCase()];
    const ms = Math.round(parseFloat(m[1].replace(',', '.')) * mult);
    return ms > 0 ? Math.min(3600000, ms) : null;
  }

  // erreichbare Schritte (Anfangsschritte, dann Transitionen mit allen Quellen erreichbar)
  function reachable(g) {
    const R = {};
    g.steps.forEach(function (s) { if (s.init) R[s.id] = true; });
    let ch = true, guard = 0;
    while (ch && guard++ < 500) {
      ch = false;
      g.transitions.forEach(function (t) {
        if (!t.from.length || !t.from.every(function (f) { return R[f]; })) return;
        t.to.forEach(function (x) { if (!R[x] && stepById(g, x)) { R[x] = true; ch = true; } });
      });
    }
    return R;
  }

  // Bedingung als Text (Anzeige im gewaehlten Adressmodus)
  function astText(ast, mode, fk) {
    const s7 = mode === 's7';
    const OP = s7 ? { and: ' UND ', or: ' ODER ', xor: ' XODER ', not: 'NICHT ' } : { and: ' AND ', or: ' OR ', xor: ' XOR ', not: 'NOT ' };
    const prec = { or: 1, xor: 2, and: 3 };
    function r(n, parent) {
      if (!n || typeof n !== 'object') return '?';
      switch (n.t) {
        case 'const': return n.v ? 'true' : 'false';
        case 'key': return fk(n.key);
        case 'step': return n.id;
        case 'time': return 't/' + n.step + '/' + fmtT(n.ms);
        case 'edge': return (n.mode === 'P' ? 'RE(' : 'FE(') + r(n.x, 0) + ')';
        case 'not': { const x = n.x; const sub = r(x, 0); return OP.not + (x && (x.t === 'and' || x.t === 'or' || x.t === 'xor') ? '(' + sub + ')' : sub); }
        case 'and': case 'or': case 'xor': {
          const s = (n.in || []).map(function (c) { return r(c, prec[n.t]); }).join(OP[n.t]);
          return parent && parent > prec[n.t] ? '(' + s + ')' : s;
        }
        default: return '?';
      }
    }
    return r(ast, 0);
  }

  function wrapText(text, maxChars, maxLines) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    words.forEach(function (w) {
      if (!cur) cur = w;
      else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    if (!lines.length) lines.push('');
    if (lines.length > maxLines) {
      const rest = lines.slice(0, maxLines);
      rest[maxLines - 1] = rest[maxLines - 1].slice(0, Math.max(1, maxChars - 1)) + '…';
      return rest;
    }
    return lines.map(function (l) { return l.length > maxChars + 8 ? l.slice(0, maxChars + 7) + '…' : l; });
  }

  // ------------------------------------------------------------------ Livewerte aus dem Zustand
  function keyVal(key, st) {
    if (!st) return false;
    let m;
    if (/^I\d\.\d$/.test(key)) return !!(st.I && st.I[key]);
    if (/^Q\d\.\d$/.test(key)) return !!(st.Q && st.Q[key]);
    if (/^M\d\.\d$/.test(key)) return !!(st.M && st.M[key]);
    if ((m = /^(T\d+)\.(Q|ET)$/.exec(key))) { const t = st.T && st.T[m[1]]; return !!t && (m[2] === 'Q' ? !!t.q : t.et > 0); }
    if ((m = /^(C\d+)\.(Q|CV)$/.exec(key))) { const c = st.C && st.C[m[1]]; return !!c && (m[2] === 'Q' ? !!c.q : c.cv > 0); }
    if ((m = /^(.+)\.Q$/.exec(key))) { const f = st.F && st.F[m[1]]; return !!f && !!f.q; }
    return false;
  }
  function evalAst(n, st, act, edges) {
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
        case 'edge': {
          const c = ev(x.x);
          if (!edges) return c;
          const prev = edges.get(x) || false;
          edges.set(x, c);
          return x.mode === 'P' ? (c && !prev) : (!c && prev);
        }
        default: return false;
      }
    }
    try { return !!ev(n); } catch (e) { return false; }
  }

  // ------------------------------------------------------------------ Layout (Sugiyama-Variante mit Dummy-Knoten)
  function pava(d, w, gaps) {
    const n = d.length;
    const o = new Array(n); o[0] = 0;
    for (let i = 1; i < n; i++) o[i] = o[i - 1] + gaps[i - 1];
    const st = [];
    for (let i = 0; i < n; i++) {
      st.push({ s: w[i] * (d[i] - o[i]), wt: w[i], start: i, cnt: 1 });
      while (st.length > 1) {
        const b = st[st.length - 1], a = st[st.length - 2];
        if (a.s / a.wt > b.s / b.wt) { a.s += b.s; a.wt += b.wt; a.cnt += b.cnt; st.pop(); } else break;
      }
    }
    const x = new Array(n);
    st.forEach(function (b) { const m = b.s / b.wt; for (let i = b.start; i < b.start + b.cnt; i++) x[i] = m + o[i]; });
    return x;
  }

  function buildLayout(prog, env) {
    const g = prog.gra;
    const steps = g.steps;
    const sIdx = Object.create(null);
    steps.forEach(function (s, i) { sIdx[s.id] = i; });
    const trs = [], bad = [];
    g.transitions.forEach(function (t, i) {
      const from = t.from.filter(function (x) { return x in sIdx; });
      const to = t.to.filter(function (x) { return x in sIdx; });
      if (from.length !== t.from.length || to.length !== t.to.length || !from.length || !to.length) bad.push(t);
      if (from.length && to.length) trs.push({ t: t, i: i, from: from, to: to });
    });

    // Rueckwaertskanten per Tiefensuche
    const outT = steps.map(function () { return []; });
    trs.forEach(function (tr) { tr.from.forEach(function (f) { outT[sIdx[f]].push(tr); }); });
    const color = steps.map(function () { return 0; });
    const back = new Set();
    function dfs(si) {
      color[si] = 1;
      outT[si].forEach(function (tr) {
        tr.to.forEach(function (to) {
          const k = sIdx[to];
          if (color[k] === 1) back.add(tr.i + '|' + to);
          else if (color[k] === 0) dfs(k);
        });
      });
      color[si] = 2;
    }
    steps.forEach(function (s, i) { if (s.init && color[i] === 0) dfs(i); });
    steps.forEach(function (s, i) { if (color[i] === 0) dfs(i); });

    // Ebenen (Schritte gerade, Transitionen ungerade)
    const inT = steps.map(function () { return []; });
    trs.forEach(function (tr, ti) { tr.to.forEach(function (to) { if (!back.has(tr.i + '|' + to)) inT[sIdx[to]].push(ti); }); });
    const sLv = steps.map(function () { return -1; }), tLv = trs.map(function () { return -1; });
    function SL(si, d) {
      if (sLv[si] >= 0) return sLv[si];
      if (d > 600) return 0;
      let l = 0;
      inT[si].forEach(function (ti) { l = Math.max(l, TL(ti, d + 1) + 1); });
      sLv[si] = l; return l;
    }
    function TL(ti, d) {
      if (tLv[ti] >= 0) return tLv[ti];
      if (d > 600) return 1;
      let l = 0;
      trs[ti].from.forEach(function (f) { l = Math.max(l, SL(sIdx[f], d + 1)); });
      tLv[ti] = l + 1; return l + 1;
    }
    steps.forEach(function (s, i) { SL(i, 0); });
    trs.forEach(function (tr, i) { TL(i, 0); });

    // Knoten
    const nodes = [];
    const sN = steps.map(function (s, i) {
      const m = env.stepMetrics(s);
      const n = { kind: 's', id: s.id, step: s, seq: i, L: sLv[i], preds: [], succs: [], predW: [], succW: [], w: 1, lx: m.lx, rx: m.rx, m: m, outD: outT[i].length, inD: inT[i].length };
      nodes.push(n); return n;
    });
    const tN = trs.map(function (tr, i) {
      const m = env.transMetrics(tr.t);
      const n = { kind: 't', id: tr.t.id, tr: tr, seq: 1000 + i, L: tLv[i], preds: [], succs: [], predW: [], succW: [], w: 1, lx: m.lx, rx: m.rx, m: m };
      nodes.push(n); return n;
    });
    const chains = [];
    function mkChain(a, b, info) {
      const arr = [a];
      for (let l = a.L + 1; l < b.L; l++) {
        const d = { kind: 'd', L: l, preds: [], succs: [], predW: [], succW: [], w: 3, lx: 7, rx: 7, seq: 3000 + nodes.length };
        nodes.push(d); arr.push(d);
      }
      arr.push(b);
      for (let i = 0; i < arr.length - 1; i++) {
        let wgt = ew(arr[i], arr[i + 1]);
        if ((i === 0 && info.type === 'out' && info.tr.to.length > 1) || (i === arr.length - 2 && info.type === 'in' && info.tr.from.length > 1)) wgt *= 0.02;   // Sammelschiene gleicht den Versatz aus
        arr[i].succs.push(arr[i + 1]); arr[i].succW.push(wgt);
        arr[i + 1].preds.push(arr[i]); arr[i + 1].predW.push(wgt);
      }
      info.nodes = arr; chains.push(info);
    }
    const backs = [];
    trs.forEach(function (tr, ti) {
      const t = tN[ti];
      tr.from.forEach(function (f) { mkChain(sN[sIdx[f]], t, { type: 'in', tr: tr, sid: f }); });
      tr.to.forEach(function (to) {
        if (back.has(tr.i + '|' + to)) backs.push({ tr: tr, tn: t, sn: sN[sIdx[to]] });
        else mkChain(t, sN[sIdx[to]], { type: 'out', tr: tr, sid: to });
      });
    });

    // Schichten und Reihenfolge
    let maxL = 0;
    nodes.forEach(function (n) { if (n.L > maxL) maxL = n.L; });
    const layers = [];
    for (let l = 0; l <= maxL; l++) layers.push([]);
    nodes.forEach(function (n) { layers[n.L].push(n); });
    layers.forEach(function (ly) { ly.sort(function (a, b) { return a.seq - b.seq; }); });
    function setPos() { layers.forEach(function (ly) { ly.forEach(function (n, i) { n.pos = i; }); }); }
    function bary(list, n) {
      if (!list.length) return n.pos;
      let s = 0; list.forEach(function (p) { s += p.pos; });
      return s / list.length;
    }
    setPos();
    function sortLayer(ly, which) {
      const keys = ly.map(function (n, i) { return { n: n, b: bary(which === 'p' ? n.preds : n.succs, n), i: i }; });
      keys.sort(function (a, b) { return a.b - b.b || a.i - b.i; });
      keys.forEach(function (k, i) { ly[i] = k.n; });
      ly.forEach(function (n, i) { n.pos = i; });
    }
    for (let it = 0; it < 5; it++) {
      for (let l = 1; l <= maxL; l++) sortLayer(layers[l], 'p');
      for (let l = maxL - 1; l >= 0; l--) sortLayer(layers[l], 's');
    }
    for (let l = 1; l <= maxL; l++) sortLayer(layers[l], 'p');

    // x-Koordinaten
    const GAP = 20;
    function gapsOf(ly) { const r = []; for (let i = 0; i < ly.length - 1; i++) r.push(ly[i].rx + ly[i + 1].lx + GAP); return r; }
    layers.forEach(function (ly) {
      let x = 0;
      ly.forEach(function (n, i) { if (i) x += ly[i - 1].rx + n.lx + GAP; n.x = x; });
    });
    function pass(ly, which) {
      if (ly.length < 1) return;
      const d = ly.map(function (n) {
        const list = which === 'p' ? n.preds : n.succs;
        if (!list.length) return n.x;
        let s = 0; list.forEach(function (p) { s += p.x; });
        return s / list.length;
      });
      const w = ly.map(function (n) { return n.w; });
      const x = pava(d, w, gapsOf(ly));
      ly.forEach(function (n, i) { n.x = x[i]; });
    }
    function ew(n, m) { return n.kind === 'd' && m.kind === 'd' ? 8 : (n.kind === 'd' || m.kind === 'd') ? 2 : 1; }
    function passB(ly) {
      if (!ly.length) return;
      const d = ly.map(function (n) {
        let s = 0, wt = 0;
        n.preds.forEach(function (p, i) { const q = n.predW[i]; s += q * p.x; wt += q; });
        n.succs.forEach(function (p, i) { const q = n.succW[i]; s += q * p.x; wt += q; });
        return n.fix !== undefined ? n.fix : wt ? s / wt : n.x;
      });
      const x = pava(d, ly.map(function (n) { return n.w; }), gapsOf(ly));
      ly.forEach(function (n, i) { n.x = x[i]; });
    }
    function relax(iters) {
      for (let it = 0; it < iters; it++) {
        for (let l = 0; l <= maxL; l++) passB(layers[l]);
        for (let l = maxL; l >= 0; l--) passB(layers[l]);
      }
    }
    for (let it = 0; it < 6; it++) {   // Startnaeherung: Eltern ueber Kindern
      for (let l = 1; l <= maxL; l++) pass(layers[l], 'p');
      for (let l = maxL - 1; l >= 0; l--) pass(layers[l], 's');
    }
    relax(220);
    // lange Verbindungen gerade ziehen: die Dummy-Spalte folgt dem Ende, das keine Sammelschiene hat
    let anyStraight = false;
    chains.forEach(function (c) {
      const N = c.nodes;
      if (N.length < 3) return;
      const A = N[0], B = N[N.length - 1], tr = c.tr;
      const startFree = (A.kind === 't' && tr.to.length > 1) || (A.kind === 's' && A.outD > 1);
      const endFree = (B.kind === 't' && c.type === 'in' && tr.from.length > 1) || (B.kind === 's' && B.inD > 1);
      if (startFree && endFree) return;
      const anchor = startFree ? B : A;
      for (let i = 1; i < N.length - 1; i++) { N[i].x = anchor.x; N[i].w = 1000; N[i].fix = anchor.x; }
      anchor.w = 1000; if (anchor.fix === undefined) anchor.fix = anchor.x;
      anyStraight = true;
    });
    if (anyStraight) relax(120);
    // kleine Versaetze in einfachen Ketten (ein Vorgaenger, dessen einziger Nachfolger der Knoten ist) glaetten
    function snapTo(ly, i, n, px) {
      if (Math.abs(n.x - px) > 110 || n.x === px) return;
      const lft = i > 0 ? ly[i - 1].x + ly[i - 1].rx + n.lx + GAP : -Infinity;
      const rgt = i < ly.length - 1 ? ly[i + 1].x - ly[i + 1].lx - n.rx - GAP : Infinity;
      if (px >= lft - 0.01 && px <= rgt + 0.01) n.x = px;
    }
    layers.forEach(function (ly) {
      ly.forEach(function (n, i) {
        if (n.preds.length === 1 && n.preds[0].succs.length === 1) snapTo(ly, i, n, n.preds[0].x);
      });
    });
    for (let l = maxL; l >= 0; l--) {
      layers[l].forEach(function (n, i) {
        if (n.succs.length === 1 && n.succs[0].preds.length === 1) snapTo(layers[l], i, n, n.succs[0].x);
      });
    }
    let minX = Infinity;
    nodes.forEach(function (n) { minX = Math.min(minX, n.x - n.lx); });
    const MARGIN = 22;
    nodes.forEach(function (n) { n.x += MARGIN - minX; });

    // y-Koordinaten
    const LT = [], LH = [];
    let y = 8;
    for (let l = 0; l <= maxL; l++) {
      let hh;
      if (l % 2 === 0) {
        let maxAct = 0;
        layers[l].forEach(function (n) { if (n.kind === 's') maxAct = Math.max(maxAct, n.m.n); });
        hh = 22 + Math.max(48, 4 + 40 * maxAct) + 28;
      } else hh = 76;
      LT[l] = y; LH[l] = hh; y += hh;
    }
    const H = y + 20;
    nodes.forEach(function (n) {
      if (n.kind === 's') { n.top = LT[n.L] + 22; n.bot = n.top + 48; }
      else if (n.kind === 't') { n.cy = LT[n.L] + 38; }
    });
    let maxRight = 0;
    nodes.forEach(function (n) { maxRight = Math.max(maxRight, n.x + n.rx); });

    // Verbindungen
    const links = [], bars = [];
    const joinXs = {}, splitXs = {};
    chains.forEach(function (c) {
      const N = c.nodes, k = N.length - 1, tr = c.tr;
      const pts = [];
      let px, py;
      const a = N[0];
      if (a.kind === 's') { px = a.x; py = a.bot; }
      else if (tr.to.length > 1) { px = N[1].x; py = a.cy + 26; (splitXs[tr.i] = splitXs[tr.i] || []).push(px); }
      else { px = a.x; py = a.cy + 2; }
      pts.push([px, py]);
      for (let j = 0; j < k; j++) {
        const A = N[j], B = N[j + 1];
        const last = j === k - 1;
        if (last && B.kind === 't' && tr.from.length > 1 && c.type === 'in') {
          const yj = B.cy - 24;
          pts.push([px, yj]);
          (joinXs[tr.i] = joinXs[tr.i] || []).push(px);
          break;
        }
        if (Math.abs(B.x - px) > 0.6) {
          let jy;
          if (j === 0 && A.kind === 's' && A.outD > 1) jy = A.bot + 14;
          else if (last && B.kind === 's' && B.inD > 1) jy = B.top - 14;
          else jy = LT[B.L] - 6;
          if (jy < py) jy = py + 4;
          pts.push([px, jy], [B.x, jy]);
          px = B.x;
        }
        if (last) pts.push([B.x, B.kind === 's' ? B.top : B.cy - 2]);
      }
      links.push({ pts: pts, src: c.type === 'in' ? c.sid : null, tid: tr.t.id });
    });
    trs.forEach(function (tr, ti) {
      const t = tN[ti];
      if (tr.from.length > 1) {
        const xs = (joinXs[tr.i] || []).concat([t.x]);
        const yj = t.cy - 24;
        bars.push({ y1: yj - 2, y2: yj + 2, x1: Math.min.apply(null, xs) - 6, x2: Math.max.apply(null, xs) + 6 });
        links.push({ pts: [[t.x, yj], [t.x, t.cy - 2]], src: null, tid: tr.t.id });
      }
      if (tr.to.length > 1) {
        const xs = (splitXs[tr.i] || []).concat([t.x]);
        const ys = t.cy + 24;
        bars.push({ y1: ys - 2, y2: ys + 2, x1: Math.min.apply(null, xs) - 6, x2: Math.max.apply(null, xs) + 6 });
        links.push({ pts: [[t.x, t.cy + 2], [t.x, ys - 2]], src: null, tid: tr.t.id });
      }
    });
    // Ruecksprungpfeile
    const backPaths = [];
    backs.sort(function (a, b) { return a.tn.cy - b.tn.cy; });
    backs.forEach(function (b, k) {
      const lane = maxRight + 26 + k * 16;
      const t = b.tn, s = b.sn;
      const y0 = b.tr.to.length > 1 ? t.cy + 26 : t.cy + 2;
      const yb = t.cy + 35;
      const yt = LT[s.L] + 8;
      backPaths.push({ pts: [[t.x, y0], [t.x, yb], [lane, yb], [lane, yt], [s.x, yt], [s.x, s.top]], ax: s.x, ay: s.top, tid: b.tr.t.id });
    });
    const W = maxRight + 26 + backs.length * 16 + 24;
    return { W: Math.max(W, 120), H: H, sN: sN, tN: tN, links: links, bars: bars, backs: backPaths, bad: bad, layers: layers };
  }

  // ------------------------------------------------------------------ Editor
  function mount(el, ctx) {
    injectStyle();
    const cv = document.createElement('canvas').getContext('2d');
    let CW = 7.2;
    try { cv.font = '12px ' + MONO; const w = cv.measureText('MMMMMMMMMMMM').width / 12; if (w > 4 && w < 12) CW = w; } catch (e) { /* Standardbreite */ }
    function tw(txt, px) { return String(txt).length * CW * (px || 12) / 12; }

    let sel = null;            // { k:'s'|'t', id }
    let zoom = 1, userZoom = false;
    let undo = [], redo = [];
    let lastProg = null;
    let sig = '', liveSig = '', lastErrSig = '';
    let L = null;
    let els = null;
    let sheet = null;          // { live?: fn }
    let reveal = null;
    let destroyed = false;
    const edgeMem = new WeakMap();

    // ----- Bausteine
    const root0 = h('div', { class: 'sg-root' });
    const bar = h('div', { class: 'sg-bar' });
    const scroll = h('div', { class: 'sg-scroll' });
    const badBar = h('div', { class: 'sg-badlist' });
    const ov = h('div', { class: 'sg-ov' });
    const sheetEl = h('div', { class: 'sg-sheet' });
    ov.appendChild(sheetEl);
    root0.appendChild(bar); root0.appendChild(scroll); root0.appendChild(badBar); root0.appendChild(ov);
    el.innerHTML = '';
    el.appendChild(root0);

    const btnUndo = h('button', { class: 'sg-btn', title: 'Rückgängig', 'aria-label': 'Rückgängig', text: '↶', onclick: doUndo });
    const btnRedo = h('button', { class: 'sg-btn', title: 'Wiederholen', 'aria-label': 'Wiederholen', text: '↷', onclick: doRedo });
    const btnAdd = h('button', { class: 'sg-btn pri', text: '＋ Schritt', onclick: function () { addMenu(); } });
    const btnZm = h('button', { class: 'sg-btn', text: '−', 'aria-label': 'Verkleinern', onclick: function () { setZoom(zoom / 1.2, true); } });
    const btnZp = h('button', { class: 'sg-btn', text: '＋', 'aria-label': 'Vergrößern', onclick: function () { setZoom(zoom * 1.2, true); } });
    const btnFit = h('button', { class: 'sg-btn', text: '⤢', title: 'Einpassen', 'aria-label': 'An Breite anpassen', onclick: function () { fit(); } });
    const btnWarn = h('button', { class: 'sg-btn warn', text: '', onclick: function () { showHints(); } });
    [btnUndo, btnRedo, btnAdd, h('span', { class: 'sg-sp' }), btnZm, btnZp, btnFit, btnWarn].forEach(function (b) { bar.appendChild(b); });
    btnWarn.style.display = 'none';

    const isRO = function () { return !!ctx.readonly; };
    const getProg = function () { return ctx.getProg(); };
    const mode = function () { return ctx.addrMode() === 's7' ? 's7' : 'iec'; };
    const showSym = function () { return !!(ctx.showSymbols && ctx.showSymbols()); };

    function dispKey(prog, key) {
      const sy = prog.symbols && prog.symbols[key];
      if (showSym() && typeof sy === 'string' && sy) return sy;
      return CORE().addr(key, mode());
    }

    // ----- Zoom
    function setZoom(z, user) {
      zoom = Math.max(0.35, Math.min(2.2, z));
      if (user) userZoom = true;
      applyZoom();
    }
    function applyZoom() {
      const svg = scroll.firstChild;
      if (svg && svg.tagName === 'svg' && L) { svg.setAttribute('width', Math.round(L.W * zoom)); svg.setAttribute('height', Math.round(L.H * zoom)); }
    }
    function fit() {
      if (!L) return;
      const aw = scroll.clientWidth - 4;
      userZoom = false;
      zoom = Math.max(0.5, Math.min(1.15, aw / L.W));
      applyZoom();
    }

    // ----- Zustandsaenderung mit Verlauf
    function mutate(fn) {
      const prog = getProg();
      const g = normalize(prog);
      const before = JSON.stringify(g);
      const res = fn(g);
      if (res === false) return false;
      normalize(prog);
      const after = JSON.stringify(prog.gra);
      if (after === before) return false;
      undo.push(before);
      if (undo.length > 100) undo.shift();
      redo.length = 0;
      ctx.changed();
      rebuild(true);
      return true;
    }
    function restore(json) {
      const prog = getProg(), g = prog.gra, o = JSON.parse(json);
      g.steps = o.steps; g.transitions = o.transitions;
    }
    function doUndo() {
      if (!undo.length || isRO()) return;
      const prog = getProg(); normalize(prog);
      redo.push(JSON.stringify(prog.gra));
      restore(undo.pop());
      afterHistory();
    }
    function doRedo() {
      if (!redo.length || isRO()) return;
      const prog = getProg(); normalize(prog);
      undo.push(JSON.stringify(prog.gra));
      restore(redo.pop());
      afterHistory();
    }
    function afterHistory() {
      const g = getProg().gra;
      if (sel && (sel.k === 's' ? !stepById(g, sel.id) : !transById(g, sel.id))) sel = null;
      closeSheet();
      ctx.changed();
      rebuild(true);
    }

    // ----- Messung fuer das Layout
    function stepMetrics(s) {
      const prog = getProg();
      const ttl = s.title ? String(s.title) : '';
      const ttlShown = ttl.length > 20 ? ttl.slice(0, 19) + '…' : ttl;
      const acts = s.actions || [];
      let qw = 30, aw = 40;
      const rows = acts.map(function (a) {
        let q = String(a.q || 'N');
        if ((a.q === 'D' || a.q === 'L') && a.t) q += ' ' + fmtT(a.t);
        let ad = dispKey(prog, a.a);
        if (ad.length > 22) ad = ad.slice(0, 21) + '…';
        qw = Math.max(qw, tw(q, 12) + 16);
        aw = Math.max(aw, tw(ad, 12) + 16);
        return { q: q, ad: ad };
      });
      const lx = 38 + (ttlShown ? 10 + tw(ttlShown, 11) : 0);
      const rx = 38 + (acts.length ? 12 + qw + aw : 0);
      return { lx: lx, rx: rx, n: acts.length, qw: qw, aw: aw, rows: rows, ttl: ttlShown };
    }
    function transMetrics(t) {
      const prog = getProg();
      const r = CORE().parseCond(t.cond, prog);
      let text, bad = null, ast = null;
      if (r.ok) { text = astText(r.ast, mode(), function (k) { return dispKey(prog, k); }); ast = r.ast; }
      else { text = String(t.cond || '(leer)'); bad = r.error; }
      const lines = wrapText((bad ? '⚠ ' : '') + text, 26, 2);
      let mw = 0; lines.forEach(function (l) { mw = Math.max(mw, tw(l, 12)); });
      const idw = tw(t.id, 11);
      return { lx: 20 + idw + 8, rx: 20 + mw + 10, lines: lines, ast: ast, bad: bad, idw: idw, textW: mw };
    }

    // ----- Zeichnen
    function drawLayout() {
      const prog = getProg();
      const svg = sv('svg', { class: 'sg-svg', viewBox: '0 0 ' + L.W + ' ' + L.H, width: Math.round(L.W * zoom), height: Math.round(L.H * zoom), role: 'img', 'aria-label': 'GRAFCET' });
      els = { steps: {}, acts: {}, trs: {}, links: [], svg: svg, sNodes: {}, tNodes: {} };
      const gLinks = sv('g'), gBars = sv('g'), gNodes = sv('g');
      L.links.forEach(function (lk) {
        const d = lk.pts.map(function (p, i) { return (i ? 'L' : 'M') + (Math.round(p[0] * 10) / 10) + ' ' + (Math.round(p[1] * 10) / 10); }).join(' ');
        const p = sv('path', { class: 'sg-link', d: d });
        gLinks.appendChild(p);
        els.links.push({ p: p, src: lk.src, on: false });
      });
      L.backs.forEach(function (b) {
        const d = b.pts.map(function (p, i) { return (i ? 'L' : 'M') + (Math.round(p[0] * 10) / 10) + ' ' + (Math.round(p[1] * 10) / 10); }).join(' ');
        gLinks.appendChild(sv('path', { class: 'sg-link', d: d }));
        gLinks.appendChild(sv('path', { class: 'sg-arrow', d: 'M' + (b.ax - 6) + ' ' + (b.ay - 10) + ' L' + (b.ax + 6) + ' ' + (b.ay - 10) + ' L' + b.ax + ' ' + (b.ay - 0.5) + ' Z' }));
      });
      L.bars.forEach(function (b) {
        gBars.appendChild(sv('line', { class: 'sg-bar2', x1: b.x1, x2: b.x2, y1: b.y1, y2: b.y1 }));
        gBars.appendChild(sv('line', { class: 'sg-bar2', x1: b.x1, x2: b.x2, y1: b.y2, y2: b.y2 }));
      });
      L.sN.forEach(function (n) {
        const s = n.step, m = n.m, x = n.x, top = n.top;
        const g = sv('g', { class: 'sg-step', 'data-sid': s.id });
        g.appendChild(sv('rect', { class: 'main', x: x - 38, y: top, width: 76, height: 48, rx: 2 }));
        if (s.init) g.appendChild(sv('rect', { class: 'inner', x: x - 33, y: top + 5, width: 66, height: 38 }));
        g.appendChild(sv('text', { class: 'nm', x: x, y: top + 25, 'font-size': s.id.length > 6 ? 11 : 14, text: s.id }));
        const tm = sv('text', { class: 'tm', x: x, y: top + 39, text: '0.0s' });
        g.appendChild(tm);
        const dot = sv('circle', { class: 'dot', cx: x - 24, cy: top + 13, r: 4.5 });
        g.appendChild(dot);
        if (m.ttl) g.appendChild(sv('text', { class: 'ttl', x: x - 46, y: top + 28, text: m.ttl }));
        gNodes.appendChild(g);
        els.steps[s.id] = { g: g, tm: tm, on: false, tmText: '' };
        els.sNodes[s.id] = n;
        const acts = s.actions || [];
        if (acts.length) {
          const bx = x + 50, y0 = top + 4;
          gNodes.appendChild(sv('line', { class: 'sg-link', x1: x + 38, x2: bx, y1: top + 24, y2: top + 24, style: 'stroke-width:1.6' }));
          els.acts[s.id] = [];
          acts.forEach(function (a, i) {
            const ag = sv('g', { class: 'sg-act', 'data-sid': s.id, 'data-idx': i });
            ag.appendChild(sv('rect', { x: bx, y: y0 + i * 40, width: m.qw + m.aw, height: 40 }));
            ag.appendChild(sv('line', { x1: bx + m.qw, x2: bx + m.qw, y1: y0 + i * 40, y2: y0 + i * 40 + 40 }));
            ag.appendChild(sv('text', { class: 'q', x: bx + m.qw / 2, y: y0 + i * 40 + 25, text: m.rows[i].q }));
            ag.appendChild(sv('text', { x: bx + m.qw + 8, y: y0 + i * 40 + 25, text: m.rows[i].ad }));
            gNodes.appendChild(ag);
            els.acts[s.id].push({ g: ag, key: a.a, q: a.q, on: false });
          });
        }
      });
      L.tN.forEach(function (n) {
        const t = n.tr.t, m = n.m, x = n.x, cy = n.cy;
        const g = sv('g', { class: 'sg-tr', 'data-tid': t.id });
        g.appendChild(sv('rect', { class: 'hit', x: x - (20 + m.idw + 6), y: cy - 22, width: 20 + m.idw + 6 + 20 + m.textW + 12, height: 44, rx: 8 }));
        g.appendChild(sv('rect', { class: 'tick', x: x - 14, y: cy - 2, width: 28, height: 4 }));
        g.appendChild(sv('text', { class: 'tid', x: x - 20, y: cy + 4, text: t.id }));
        const tx = sv('text', { class: 'cond' + (m.bad ? ' bad' : ''), x: x + 20, y: cy - (m.lines.length - 1) * 7 + 4 });
        m.lines.forEach(function (ln, i) { tx.appendChild(sv('tspan', { x: x + 20, dy: i ? 14 : 0, text: ln })); });
        g.appendChild(tx);
        gNodes.appendChild(g);
        els.trs[t.id] = { g: g, ast: m.ast, from: n.tr.from, rdy: false, tru: false };
        els.tNodes[t.id] = n;
      });
      svg.appendChild(gLinks); svg.appendChild(gBars); svg.appendChild(gNodes);
      const ox = scroll.scrollLeft, oy = scroll.scrollTop;
      scroll.innerHTML = '';
      scroll.appendChild(svg);
      scroll.scrollLeft = ox; scroll.scrollTop = oy;
      void prog;
      applySel();
    }

    function applySel() {
      if (!els) return;
      Object.keys(els.steps).forEach(function (id) { els.steps[id].g.classList.toggle('sel', !!sel && sel.k === 's' && sel.id === id); });
      Object.keys(els.trs).forEach(function (id) { els.trs[id].g.classList.toggle('sel', !!sel && sel.k === 't' && sel.id === id); });
    }

    function revealNode(k, id) {
      if (!els) return;
      const n = k === 's' ? els.sNodes[id] : els.tNodes[id];
      if (!n) return;
      const yy = (k === 's' ? n.top + 24 : n.cy) * zoom, xx = n.x * zoom;
      const vw = scroll.clientWidth, vh = scroll.clientHeight;
      if (xx < scroll.scrollLeft + 30 || xx > scroll.scrollLeft + vw - 30) scroll.scrollLeft = Math.max(0, xx - vw / 2);
      if (yy < scroll.scrollTop + 40 || yy > scroll.scrollTop + vh - 60) scroll.scrollTop = Math.max(0, yy - vh / 2);
    }

    function showNotGra(msg) {
      els = null; L = null; sig = '';
      scroll.innerHTML = '';
      scroll.appendChild(h('div', { class: 'sg-msg', text: msg }));
      [btnUndo, btnRedo, btnAdd, btnZm, btnZp, btnFit].forEach(function (b) { b.disabled = true; });
    }

    // ----- Neuaufbau / Aktualisierung
    function currentSig(prog) {
      return JSON.stringify([prog.gra, prog.symbols || null, mode(), showSym(), isRO()]);
    }
    function rebuild(force) {
      if (destroyed) return;
      const prog = getProg();
      if (lastProg !== prog) { lastProg = prog; undo = []; redo = []; sel = null; closeSheet(); sig = ''; }
      if (!prog || prog.lang !== 'gra') { showNotGra('Dieses Programm ist kein GRAFCET. Lege ein neues Programm in der Sprache GRAFCET an, um diesen Editor zu benutzen.'); return; }
      normalize(prog);
      const s = currentSig(prog);
      if (!force && s === sig && els) return;
      if (s !== sig && sheet && !force && !selfSig) closeSheet();
      sig = s;
      L = buildLayout(prog, { stepMetrics: stepMetrics, transMetrics: transMetrics });
      drawLayout();
      if (!userZoom) {
        const aw = scroll.clientWidth - 4;
        if (aw > 100) zoom = Math.max(0.5, Math.min(1, aw / L.W)); applyZoom();
      }
      liveSig = '';
      updateBadBar();
      updateBar();
      applyLive();
      if (reveal) { const r = reveal; reveal = null; revealNode(r.k, r.id); }
    }
    let selfSig = false;

    function updateBar() {
      const ro = isRO();
      btnUndo.disabled = ro || !undo.length;
      btnRedo.disabled = ro || !redo.length;
      btnAdd.disabled = ro;
      btnZm.disabled = btnZp.disabled = btnFit.disabled = false;
    }
    function updateBadBar() {
      badBar.innerHTML = '';
      if (!L || !L.bad.length) { badBar.classList.remove('show'); return; }
      badBar.classList.add('show');
      badBar.appendChild(h('span', { text: 'Transition mit unbekanntem Schritt: ' }));
      L.bad.forEach(function (t) {
        badBar.appendChild(h('button', { class: 'sg-btn sm warn', text: t.id, onclick: function () { if (!isRO()) openTransSheet(t.id); } }));
      });
    }
    function updateHintBtn() {
      let errs = [];
      try { errs = (ctx.errors && ctx.errors()) || []; } catch (e) { errs = []; }
      const sg = errs.join('\u0001');
      if (sg === lastErrSig) return;
      lastErrSig = sg;
      btnWarn.style.display = errs.length ? '' : 'none';
      btnWarn.textContent = '⚠ ' + errs.length + (errs.length === 1 ? ' Hinweis' : ' Hinweise');
    }

    function liveInfo() {
      let lv = null;
      try { lv = ctx.live && ctx.live(); } catch (e) { lv = null; }
      if (!lv || !lv.state) return null;
      const st = lv.state;
      return { st: st, act: new Set(st.steps || []) };
    }

    function applyLive() {
      if (!els || destroyed) return;
      updateHintBtn();
      const lv = liveInfo();
      let s2 = 'x';
      if (lv) {
        const parts = [lv.st.steps.join(',')];
        Object.keys(els.steps).forEach(function (id) { if (lv.act.has(id)) parts.push(id + Math.floor((lv.st.stepTimes[id] || 0) / 100)); });
        Object.keys(els.acts).forEach(function (id) { els.acts[id].forEach(function (a) { parts.push(keyVal(a.key, lv.st) ? 1 : 0); }); });
        Object.keys(els.trs).forEach(function (id) {
          const t = els.trs[id];
          parts.push(t.ast ? (evalAst(t.ast, lv.st, lv.act, null) ? 1 : 0) : 0);
        });
        s2 = parts.join('|');
      }
      if (s2 === liveSig) { if (sheet && sheet.live) sheet.live(lv); return; }
      liveSig = s2;
      Object.keys(els.steps).forEach(function (id) {
        const e = els.steps[id];
        const on = !!lv && lv.act.has(id);
        if (on !== e.on) { e.on = on; e.g.classList.toggle('on', on); }
        if (on) {
          const tt = fmtSec(lv.st.stepTimes[id] || 0);
          if (tt !== e.tmText) { e.tmText = tt; e.tm.textContent = tt; }
        }
      });
      Object.keys(els.acts).forEach(function (id) {
        const stOn = !!lv && lv.act.has(id);
        els.acts[id].forEach(function (a) {
          const on = stOn && (a.q === 'R' ? true : keyVal(a.key, lv.st));
          if (on !== a.on) { a.on = on; a.g.classList.toggle('on', on); }
        });
      });
      Object.keys(els.trs).forEach(function (id) {
        const t = els.trs[id];
        let rdy = false, tru = false;
        if (lv) {
          rdy = t.from.length > 0 && t.from.every(function (f) { return lv.act.has(f); });
          if (t.ast) tru = evalAst(t.ast, lv.st, lv.act, edgeMem);
        }
        if (rdy !== t.rdy) { t.rdy = rdy; t.g.classList.toggle('rdy', rdy); }
        if (tru !== t.tru) { t.tru = tru; t.g.classList.toggle('tru', tru); }
      });
      els.links.forEach(function (l) {
        const on = !!lv && !!l.src && lv.act.has(l.src);
        if (on !== l.on) { l.on = on; l.p.classList.toggle('on', on); }
      });
      if (sheet && sheet.live) sheet.live(lv);
    }

    // ----- Interaktion auf der Zeichnung
    scroll.addEventListener('click', function (ev) {
      const t = ev.target;
      if (!t || !t.closest) return;
      const a = t.closest('.sg-act');
      if (a) { select('s', a.getAttribute('data-sid')); if (!isRO()) actionMenu(a.getAttribute('data-sid'), parseInt(a.getAttribute('data-idx'), 10)); return; }
      const s = t.closest('.sg-step');
      if (s) { select('s', s.getAttribute('data-sid')); if (!isRO()) openStepSheet(s.getAttribute('data-sid')); return; }
      const tr = t.closest('.sg-tr');
      if (tr) { select('t', tr.getAttribute('data-tid')); if (!isRO()) openTransSheet(tr.getAttribute('data-tid')); return; }
      select(null);
    });
    function select(k, id) { sel = k ? { k: k, id: id } : null; applySel(); }

    // ----- Sheets
    function openSheet(build) {
      sheetEl.innerHTML = '';
      const st = sheetEl.scrollTop;
      sheet = { live: null };
      const r = build(sheetEl);
      if (typeof r === 'function') sheet.live = r;
      ov.classList.add('show');
      sheetEl.scrollTop = st;
      if (sheet.live) sheet.live(liveInfo());
    }
    function closeSheet() { sheet = null; ov.classList.remove('show'); sheetEl.innerHTML = ''; }
    ov.addEventListener('click', function (ev) { if (ev.target === ov) closeSheet(); });
    function head(title, close) {
      return h('h3', null, [title, h('button', { class: 'sg-btn sg-x', text: '✕', 'aria-label': 'Schließen', onclick: close || closeSheet })]);
    }
    function sheetKeep(fn) { // Sheet nach einer Aenderung neu aufbauen, Scrollposition behalten
      const st = sheetEl.scrollTop; fn(); sheetEl.scrollTop = st;
    }

    function showHints() {
      let errs = [];
      try { errs = (ctx.errors && ctx.errors()) || []; } catch (e) { errs = []; }
      openSheet(function (box) {
        box.appendChild(head('Hinweise zum Programm'));
        if (!errs.length) box.appendChild(h('div', { class: 'sg-status ok', text: 'Keine Fehler oder Warnungen.' }));
        else box.appendChild(h('ul', { class: 'sg-list' }, errs.map(function (e) { return h('li', { text: e }); })));
      });
    }

    // ----- Schritt-Sheet
    function validStepName(g, old, nw) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,11}$/.test(nw)) return 'Der Name muss mit einem Buchstaben beginnen und darf nur Buchstaben, Ziffern und _ enthalten (höchstens 12 Zeichen).';
      if (RESERVED.indexOf(nw.toUpperCase()) >= 0) return '„' + nw + '“ ist ein reserviertes Wort der Bedingungen.';
      if (CORE().parseAddr(nw)) return '„' + nw + '“ sieht aus wie eine Adresse (Eingang, Ausgang, Zeitglied, Zähler). Wähle z. B. S1.';
      for (let i = 0; i < g.steps.length; i++) if (g.steps[i].id !== old && g.steps[i].id.toUpperCase() === nw.toUpperCase()) return 'Den Schritt „' + g.steps[i].id + '“ gibt es schon.';
      return null;
    }
    function renameStep(g, old, nw) {
      g.steps.forEach(function (s) { if (s.id === old) s.id = nw; });
      g.transitions.forEach(function (t) {
        t.from = t.from.map(function (x) { return x === old ? nw : x; });
        t.to = t.to.map(function (x) { return x === old ? nw : x; });
        t.cond = replaceRef(t.cond, old, nw);
      });
    }

    function openStepSheet(id) {
      const rebuildSheet = function () { sheetKeep(function () { openStepSheet(id); }); };
      const g = getProg().gra, s = stepById(g, id);
      if (!s) { closeSheet(); return; }
      const prog = getProg();
      openSheet(function (box) {
        box.appendChild(head('Schritt ' + s.id + (s.init ? ' (Anfangsschritt)' : '')));
        // Name / Titel
        const nameIn = h('input', { class: 'sg-in', value: s.id, maxlength: 12, autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Schrittname' });
        const nameMsg = h('div', { class: 'sg-status bad', style: 'display:none' });
        nameIn.addEventListener('change', function () {
          const nw = nameIn.value.trim();
          if (nw === s.id) { nameMsg.style.display = 'none'; return; }
          const err = validStepName(getProg().gra, s.id, nw);
          if (err) { nameMsg.textContent = err; nameMsg.style.display = ''; nameIn.value = s.id; return; }
          const old = s.id;
          mutate(function (gg) { renameStep(gg, old, nw); });
          sel = { k: 's', id: nw }; applySel();
          openStepSheet(nw);
        });
        box.appendChild(h('div', { class: 'sg-row' }, [h('span', { class: 'sg-lab', text: 'Name' }), nameIn]));
        box.appendChild(nameMsg);
        const ttlIn = h('input', { class: 'sg-in', value: s.title || '', maxlength: 40, placeholder: 'z. B. Grundstellung', 'aria-label': 'Titel' });
        ttlIn.addEventListener('change', function () {
          const v = ttlIn.value.trim();
          mutate(function (gg) { const ss = stepById(gg, s.id); if (v) ss.title = v; else delete ss.title; });
        });
        box.appendChild(h('div', { class: 'sg-row' }, [h('span', { class: 'sg-lab', text: 'Titel' }), ttlIn]));
        const initBtn = h('button', { class: 'sg-btn' + (s.init ? ' ok' : ''), text: s.init ? '✓ Anfangsschritt' : 'Als Anfangsschritt festlegen', onclick: function () {
          if (s.init) {
            if (g.steps.filter(function (x) { return x.init; }).length < 2) { ctx.toast('Es muss mindestens einen Anfangsschritt geben. Lege zuerst einen anderen Schritt als Anfangsschritt fest.'); return; }
            mutate(function (gg) { stepById(gg, s.id).init = false; });
          } else mutate(function (gg) { stepById(gg, s.id).init = true; });
          openStepSheet(s.id);
        } });
        box.appendChild(h('div', { class: 'sg-row' }, [h('span', { class: 'sg-lab', text: '' }), initBtn]));

        // Aktionen
        box.appendChild(h('h4', { text: 'Aktionen' }));
        if (!s.actions.length) box.appendChild(h('div', { style: 'color:#8b97a3;font-size:13px;margin:4px 0', text: 'Noch keine Aktion. Eine Aktion schaltet einen Ausgang oder Merker, solange der Schritt aktiv ist.' }));
        s.actions.forEach(function (a, i) {
          const row = h('div', { class: 'sg-act-row' });
          row.appendChild(h('button', { class: 'sg-btn sm', text: a.q, title: 'Typ ändern', onclick: function () { changeActType(s.id, i).then(rebuildSheet); } }));
          row.appendChild(h('button', { class: 'sg-btn sm', text: dispKey(prog, a.a), title: 'Adresse ändern', onclick: function () { changeActAddr(s.id, i).then(rebuildSheet); } }));
          if (a.q === 'D' || a.q === 'L') row.appendChild(h('button', { class: 'sg-btn sm', text: fmtT(a.t || 0), title: 'Zeit ändern', onclick: function () { changeActTime(s.id, i).then(rebuildSheet); } }));
          row.appendChild(h('span', { class: 'sg-sp' }));
          row.appendChild(h('button', { class: 'sg-btn sm dng', text: '🗑', 'aria-label': 'Aktion löschen', onclick: function () { mutate(function (gg) { stepById(gg, s.id).actions.splice(i, 1); }); rebuildSheet(); } }));
          box.appendChild(row);
        });
        box.appendChild(h('div', { class: 'sg-row' }, [h('button', { class: 'sg-btn pri', text: '＋ Aktion hinzufügen', onclick: function () { addAction(s.id).then(rebuildSheet); } })]));

        // Struktur
        box.appendChild(h('h4', { text: 'Ablauf erweitern' }));
        box.appendChild(h('div', { class: 'sg-grid' }, [
          h('button', { class: 'sg-btn', text: '↓ Schritt danach einfügen', onclick: function () { closeSheet(); opAfter(s.id); } }),
          h('button', { class: 'sg-btn', text: '⑂ Alternativer Zweig', onclick: function () { closeSheet(); opAlt(s.id); } }),
          h('button', { class: 'sg-btn', text: '‖ Paralleler Zweig', onclick: function () { closeSheet(); opPar(s.id); } }),
          h('button', { class: 'sg-btn', text: '⇉ Parallel zusammenführen', onclick: function () { closeSheet(); opJoin(s.id); } }),
          h('button', { class: 'sg-btn', text: '↩ Verbinden mit … (Rücksprung)', onclick: function () { closeSheet(); opConnect(s.id); } })
        ]));
        box.appendChild(h('div', { class: 'sg-row sg-stick' }, [
          h('button', { class: 'sg-btn dng', text: '🗑 Schritt löschen', onclick: function () { closeSheet(); delStep(s.id); } }),
          h('span', { class: 'sg-sp' }),
          h('button', { class: 'sg-btn pri', text: 'Fertig', onclick: closeSheet })
        ]));
      });
    }

    // ----- Aktionen bearbeiten
    async function pickType(title) {
      return ctx.pick(title, QTYPES);
    }
    async function pickAddr(title) {
      const list = (ctx.addresses && ctx.addresses()) || [];
      let opts = list.filter(function (a) { return a.group === 'Ausgang' || a.group === 'Merker'; });
      if (!opts.length) opts = list;
      return ctx.pick(title, opts.map(function (a) { return { value: a.key, label: a.label + (a.text ? ' – ' + a.text : ''), group: a.group }; }));
    }
    async function askTime(def, title) {
      const r = await ctx.ask(title || 'Zeit einstellen', [{ key: 't', label: 'Zeit (z. B. 3 s oder 500 ms)', type: 'time', value: def || 1000 }]);
      if (!r) return null;
      const ms = parseTime(r.t);
      if (ms === null) { ctx.toast('Die Zeit konnte nicht gelesen werden. Beispiel: 3 s oder 500 ms.'); return null; }
      return ms;
    }
    async function addAction(sid) {
      const q = await pickType('Aktionstyp wählen');
      if (!q) return;
      const a = await pickAddr('Welcher Ausgang oder Merker soll geschaltet werden?');
      if (!a) return;
      let t = null;
      if (q === 'D' || q === 'L') { t = await askTime(1000, q === 'D' ? 'Verzögerung (D)' : 'Zeitbegrenzung (L)'); if (t === null) return; }
      mutate(function (g) { const act = { q: q, a: a }; if (t !== null) act.t = t; stepById(g, sid).actions.push(act); });
    }
    async function changeActType(sid, i) {
      const q = await pickType('Aktionstyp ändern');
      if (!q) return;
      let t = null;
      const cur = stepById(getProg().gra, sid).actions[i];
      if ((q === 'D' || q === 'L')) { t = await askTime(cur && cur.t || 1000, q === 'D' ? 'Verzögerung (D)' : 'Zeitbegrenzung (L)'); if (t === null) return; }
      mutate(function (g) { const act = stepById(g, sid).actions[i]; act.q = q; if (t !== null) act.t = t; else delete act.t; });
    }
    async function changeActAddr(sid, i) {
      const a = await pickAddr('Adresse der Aktion ändern');
      if (!a) return;
      mutate(function (g) { stepById(g, sid).actions[i].a = a; });
    }
    async function changeActTime(sid, i) {
      const cur = stepById(getProg().gra, sid).actions[i];
      const t = await askTime(cur && cur.t || 1000);
      if (t === null) return;
      mutate(function (g) { stepById(g, sid).actions[i].t = t; });
    }
    async function actionMenu(sid, i) {
      const s = stepById(getProg().gra, sid);
      const a = s && s.actions[i];
      if (!a) return;
      const opts = [
        { value: 'type', label: 'Typ ändern (jetzt ' + a.q + ')' },
        { value: 'addr', label: 'Adresse ändern (jetzt ' + dispKey(getProg(), a.a) + ')' }
      ];
      if (a.q === 'D' || a.q === 'L') opts.push({ value: 'time', label: 'Zeit ändern (jetzt ' + fmtT(a.t || 0) + ')' });
      opts.push({ value: 'add', label: 'Weitere Aktion an diesem Schritt hinzufügen' });
      opts.push({ value: 'del', label: 'Aktion löschen' });
      const r = await ctx.pick('Aktion ' + a.q + ' ' + dispKey(getProg(), a.a) + ' (Schritt ' + sid + ')', opts);
      if (r === 'type') await changeActType(sid, i);
      else if (r === 'addr') await changeActAddr(sid, i);
      else if (r === 'time') await changeActTime(sid, i);
      else if (r === 'add') await addAction(sid);
      else if (r === 'del') mutate(function (g) { stepById(g, sid).actions.splice(i, 1); });
    }

    // ----- Transitions-Sheet
    function insertAt(ta, txt, caretIn) {
      const s0 = ta.selectionStart, e0 = ta.selectionEnd, v = ta.value;
      const pre = v.slice(0, s0), post = v.slice(e0);
      const sel0 = v.slice(s0, e0);
      let body = txt;
      let caret = null;
      if (caretIn === 'wrap') {
        body = txt + sel0 + ')';
        caret = sel0 ? null : -1;
      }
      const needL = pre && !/[\s(]$/.test(pre) && !/^\)/.test(body);
      const needR = post && !/^[\s)]/.test(post) && !/\($/.test(body);
      const full = (needL ? ' ' : '') + body + (needR ? ' ' : '');
      ta.value = pre + full + post;
      let pos = pre.length + full.length - (needR ? 1 : 0);
      if (caret === -1) pos -= 1;
      try { ta.setSelectionRange(pos, pos); } catch (e) { /* ignorieren */ }
      ta.dispatchEvent(new Event('input'));
    }

    function openTransSheet(tid) {
      const g0 = getProg().gra, t0 = transById(g0, tid);
      if (!t0) { closeSheet(); return; }
      const draft = { from: t0.from.slice(), to: t0.to.slice(), cond: null };
      const prog0 = getProg();
      const r0 = CORE().parseCond(t0.cond, prog0);
      draft.cond = r0.ok ? astText(r0.ast, mode(), function (k) { return CORE().addr(k, mode()); }) : String(t0.cond || '');
      renderTransSheet(tid, draft);
    }

    function renderTransSheet(tid, draft) {
      const prog = getProg(), g = prog.gra;
      const t0 = transById(g, tid);
      if (!t0) { closeSheet(); return; }
      openSheet(function (box) {
        box.appendChild(head('Transition ' + tid));
        // Von / Nach
        function chips(label, key) {
          const row = h('div', { class: 'sg-row' });
          row.appendChild(h('span', { class: 'sg-lab', text: label }));
          draft[key].forEach(function (id, i) {
            const known = !!stepById(g, id);
            row.appendChild(h('span', { class: 'sg-chip', style: known ? '' : 'border-color:#7a3a3a;color:#ff9a9a' }, [
              id + (known ? '' : ' (fehlt)'),
              h('button', { text: '✕', 'aria-label': id + ' entfernen', onclick: function () { if (draft[key].length < 2) { ctx.toast('Eine Transition braucht mindestens einen Schritt auf jeder Seite.'); return; } draft[key].splice(i, 1); renderKeep(); } })
            ]));
          });
          row.appendChild(h('button', { class: 'sg-btn sm', text: '＋ Schritt', onclick: async function () {
            const opts = g.steps.filter(function (s) { return draft[key].indexOf(s.id) < 0; }).map(function (s) { return { value: s.id, label: s.id + (s.title ? ' – ' + s.title : '') }; });
            if (!opts.length) { ctx.toast('Alle Schritte sind schon eingetragen.'); return; }
            const v = await ctx.pick(key === 'from' ? 'Weiteren Quellschritt hinzufügen (Parallel-Zusammenführung)' : 'Weiteren Zielschritt hinzufügen (Parallel-Verzweigung)', opts);
            if (v) { draft[key].push(v); renderKeep(); }
          } }));
          return row;
        }
        function renderKeep() { const st = sheetEl.scrollTop; const ta0 = box.querySelector('textarea'); if (ta0) draft.cond = ta0.value; renderTransSheet(tid, draft); sheetEl.scrollTop = st; }
        box.appendChild(chips('Von', 'from'));
        box.appendChild(chips('Nach', 'to'));
        if (draft.from.length > 1) box.appendChild(h('div', { style: 'color:#8b97a3;font-size:12px;margin:2px 0 0 70px', text: 'Parallele Zusammenführung: schaltet erst, wenn alle Quellschritte aktiv sind.' }));
        if (draft.to.length > 1) box.appendChild(h('div', { style: 'color:#8b97a3;font-size:12px;margin:2px 0 0 70px', text: 'Parallele Verzweigung: aktiviert alle Zielschritte gleichzeitig.' }));

        // Bedingung
        box.appendChild(h('h4', { text: 'Bedingung' }));
        const ta = h('textarea', { class: 'sg-in', rows: 3, autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Bedingung der Transition', placeholder: 'z. B. ' + CORE().addr('I0.0', mode()) + ' AND NOT ' + CORE().addr('I0.1', mode()) });
        ta.value = draft.cond;
        const status = h('div', { class: 'sg-status' });
        const mirror = h('div', { class: 'sg-mirror' });
        const liveBadge = h('span', { class: 'sg-live', text: '' });
        const okBtn = h('button', { class: 'sg-btn ok', text: 'Übernehmen' });
        let curAst = null;
        function check() {
          const v = ta.value;
          draft.cond = v;
          mirror.innerHTML = '';
          if (!v.trim()) {
            status.className = 'sg-status bad'; status.textContent = '✗ Die Bedingung ist leer. Schreibe z. B. I0.0 oder true.'; okBtn.disabled = true; curAst = null; return;
          }
          const gg = getProg();
          const r = CORE().parseCond(v, gg);
          if (r.ok) {
            curAst = r.ast;
            status.className = 'sg-status ok';
            status.textContent = '✓ Bedingung in Ordnung: ' + astText(r.ast, mode(), function (k) { return dispKey(gg, k); });
            status.appendChild(liveBadge);
            okBtn.disabled = false;
          } else {
            curAst = null;
            status.className = 'sg-status bad';
            status.textContent = '✗ ' + r.error;
            const p = Math.max(1, Math.min(v.length + 1, r.pos)) - 1;
            mirror.appendChild(document.createTextNode(v.slice(0, p)));
            mirror.appendChild(h('b', null, v.slice(p, p + 1) || '␣'));
            mirror.appendChild(document.createTextNode(v.slice(p + 1)));
            okBtn.disabled = true;
          }
        }
        ta.addEventListener('input', check);
        box.appendChild(h('div', { class: 'sg-row' }, [ta]));
        box.appendChild(status); box.appendChild(mirror);

        // Hilfeleiste
        box.appendChild(h('h4', { text: 'Einfügen' }));
        const help = h('div', { class: 'sg-help' });
        const ins = function (label, txt, caret, title) { help.appendChild(h('button', { class: 'sg-btn', text: label, title: title || '', onclick: function () { insertAt(ta, txt, caret); } })); };
        help.appendChild(h('button', { class: 'sg-btn pri', text: 'Adresse …', onclick: async function () {
          const list = (ctx.addresses && ctx.addresses()) || [];
          const v = await ctx.pick('Adresse einfügen', list.map(function (a) { return { value: a.key, label: a.label + (a.text ? ' – ' + a.text : ''), group: a.group }; }));
          if (v) insertAt(ta, CORE().addr(v, mode()));
        } }));
        help.appendChild(h('button', { class: 'sg-btn pri', text: 'Schritt …', onclick: async function () {
          const v = await ctx.pick('Schrittmerker einfügen (Schritt aktiv?)', g.steps.map(function (s) { return { value: s.id, label: s.id + (s.title ? ' – ' + s.title : '') }; }));
          if (v) insertAt(ta, v);
        } }));
        help.appendChild(h('button', { class: 'sg-btn pri', text: 't/S/3s …', title: 'Zeitbedingung: Schritt seit mindestens … aktiv', onclick: async function () {
          let sid = draft.from[0];
          if (draft.from.length > 1 || !sid) sid = await ctx.pick('Zeit seit Aktivierung welches Schritts?', g.steps.map(function (s) { return { value: s.id, label: s.id + (s.title ? ' – ' + s.title : '') }; }));
          if (!sid) return;
          const ms = await askTime(1000, 'Zeitbedingung für Schritt ' + sid);
          if (ms !== null) insertAt(ta, 't/' + sid + '/' + fmtT(ms));
        } }));
        ins('AND', 'AND'); ins('OR', 'OR'); ins('NOT', 'NOT'); ins('XOR', 'XOR');
        ins('RE( )', 'RE(', 'wrap', 'steigende Flanke'); ins('FE( )', 'FE(', 'wrap', 'fallende Flanke');
        ins('(', '('); ins(')', ')'); ins('true', 'true');
        help.appendChild(h('button', { class: 'sg-btn dng', text: '⌫ Alles löschen', onclick: function () { ta.value = ''; ta.dispatchEvent(new Event('input')); } }));
        box.appendChild(help);

        // Knoepfe
        okBtn.addEventListener('click', function () {
          check();
          if (okBtn.disabled) return;
          const cond = ta.value.trim().replace(/\s+/g, ' ');
          const from = draft.from.slice(), to = draft.to.slice();
          if (from.some(function (f) { return !stepById(getProg().gra, f); }) || to.some(function (f) { return !stepById(getProg().gra, f); })) { ctx.toast('Entferne zuerst die fehlenden Schritte aus Von/Nach.'); return; }
          mutate(function (gg) { const t = transById(gg, tid); t.from = from; t.to = to; t.cond = cond; });
          closeSheet();
        });
        box.appendChild(h('div', { class: 'sg-row sg-stick' }, [
          h('button', { class: 'sg-btn dng', text: '🗑 Löschen', onclick: function () { closeSheet(); delTrans(tid); } }),
          h('span', { class: 'sg-sp' }),
          h('button', { class: 'sg-btn', text: 'Abbrechen', onclick: closeSheet }),
          okBtn
        ]));
        check();
        return function (lv) {
          if (!lv || !curAst) { liveBadge.textContent = ''; return; }
          const v = evalAst(curAst, lv.st, lv.act, null);
          liveBadge.textContent = v ? 'gerade wahr' : 'gerade falsch';
          liveBadge.className = 'sg-live' + (v ? ' t' : '');
        };
      });
    }

    // ----- Strukturoperationen
    function stepOpt(s) { return { value: s.id, label: s.id + (s.title ? ' – ' + s.title : '') }; }
    function afterAdd(k, id) { select(k, id); reveal = { k: k, id: id }; if (els) { revealNode(k, id); } }

    function opAfter(sid) {
      let nid = null;
      const ok = mutate(function (g) {
        const s = stepById(g, sid); if (!s) return false;
        nid = newStepId(g);
        const tid = newTransId(g);
        g.steps.push({ id: nid, title: '', actions: [] });
        delete g.steps[g.steps.length - 1].title;
        g.transitions.forEach(function (t) {
          if (t.from.indexOf(sid) < 0) return;
          t.from = t.from.map(function (x) { return x === sid ? nid : x; });
          t.cond = replaceRef(t.cond, sid, nid);   // Zeit-/Schrittbezug wandert mit zum neuen Quellschritt
        });
        g.transitions.push({ id: tid, from: [sid], to: [nid], cond: 't/' + sid + '/1s' });
      });
      if (ok) afterAdd('s', nid);
    }
    async function opAlt(sid) {
      let nid = null, tid = null;
      const ok = mutate(function (g) {
        if (!stepById(g, sid)) return false;
        nid = newStepId(g); tid = newTransId(g);
        g.steps.push({ id: nid, actions: [] });
        g.transitions.push({ id: tid, from: [sid], to: [nid], cond: 'false' });
      });
      if (ok) { afterAdd('s', nid); ctx.toast('Alternativer Zweig angelegt. Lege jetzt die Bedingung fest und verbinde das Zweigende mit „Verbinden mit …“ wieder.'); openTransSheet(tid); }
    }
    async function opPar(sid) {
      const g0 = getProg().gra;
      if (!stepById(g0, sid)) return;
      const inc = g0.transitions.filter(function (t) { return t.to.indexOf(sid) >= 0; });
      let via = null;
      if (inc.length > 1) {
        via = await ctx.pick('Über welche Transition soll der parallele Zweig gleichzeitig starten?', inc.map(function (t) { return { value: t.id, label: t.id + ' (von ' + t.from.join(' + ') + ' nach ' + t.to.join(' + ') + ')' }; }));
        if (!via) return;
      } else if (inc.length === 1) via = inc[0].id;
      let nid = null;
      const ok = mutate(function (g) {
        nid = newStepId(g);
        if (via) { const t = transById(g, via); if (!t) return false; g.steps.push({ id: nid, actions: [] }); t.to.push(nid); }
        else g.steps.push({ id: nid, init: true, actions: [] });
      });
      if (ok) {
        afterAdd('s', nid);
        ctx.toast(via ? 'Paralleler Zweig angelegt. Führe die Zweige mit „Parallel zusammenführen“ wieder zusammen.' : 'Zweiter Anfangsschritt angelegt (beide starten gleichzeitig).');
      }
    }
    async function opJoin(sid) {
      const g0 = getProg().gra;
      const others = g0.steps.filter(function (s) { return s.id !== sid; });
      if (!others.length) { ctx.toast('Es gibt keinen weiteren Schritt zum Zusammenführen.'); return; }
      const y = await ctx.pick('Welcher Schritt endet parallel zu ' + sid + '?', others.map(stepOpt));
      if (!y) return;
      const tg = await ctx.pick('Wohin führen beide Zweige?', [{ value: '__new', label: 'Neuer Schritt danach' }].concat(g0.steps.filter(function (s) { return s.id !== sid && s.id !== y; }).map(stepOpt)));
      if (!tg) return;
      let nid = null, tid = null;
      const ok = mutate(function (g) {
        tid = newTransId(g);
        if (tg === '__new') { nid = newStepId(g); g.steps.push({ id: nid, actions: [] }); } else nid = tg;
        g.transitions.push({ id: tid, from: [sid, y], to: [nid], cond: 'true' });
      });
      if (ok) { afterAdd('s', nid); ctx.toast('Parallele Zusammenführung angelegt (schaltet, wenn beide Schritte aktiv sind und die Bedingung wahr ist).'); }
    }
    async function opConnect(sid) {
      const g0 = getProg().gra;
      const others = g0.steps.filter(function (s) { return s.id !== sid; });
      if (!others.length) { ctx.toast('Es gibt keinen anderen Schritt zum Verbinden.'); return; }
      const x = await ctx.pick('Von ' + sid + ' mit welchem Schritt verbinden? (Rücksprung oder Zusammenführung)', others.map(stepOpt));
      if (!x) return;
      let tid = null;
      const ok = mutate(function (g) {
        tid = newTransId(g);
        g.transitions.push({ id: tid, from: [sid], to: [x], cond: 't/' + sid + '/1s' });
      });
      if (ok) { select('t', tid); reveal = { k: 't', id: tid }; openTransSheet(tid); }
    }
    function opInsertInTrans(tid) {
      let nid = null;
      const ok = mutate(function (g) {
        const t = transById(g, tid); if (!t) return false;
        nid = newStepId(g);
        const t2 = newTransId(g);
        g.steps.push({ id: nid, actions: [] });
        const oldTo = t.to.slice();
        t.to = [nid];
        g.transitions.push({ id: t2, from: [nid], to: oldTo, cond: 't/' + nid + '/1s' });
      });
      if (ok) afterAdd('s', nid);
    }
    function opParOnTrans(tid) {
      let nid = null;
      const ok = mutate(function (g) {
        const t = transById(g, tid); if (!t) return false;
        nid = newStepId(g);
        g.steps.push({ id: nid, actions: [] });
        t.to.push(nid);
      });
      if (ok) { afterAdd('s', nid); ctx.toast('Paralleler Zweig angelegt. Führe die Zweige mit „Parallel zusammenführen“ wieder zusammen.'); }
    }

    async function addMenu() {
      if (isRO()) return;
      const g = getProg().gra;
      let ssel = sel && sel.k === 's' && stepById(g, sel.id) ? sel.id : null;
      const tsel = sel && sel.k === 't' && transById(g, sel.id) ? sel.id : null;
      if (tsel) {
        const v = await ctx.pick('Schritt zu Transition ' + tsel + ' hinzufügen', [
          { value: 'ins', label: 'In diese Transition einen Schritt einfügen (davor/danach je eine Transition)' },
          { value: 'par', label: 'Paralleler Zweig: weiterer Zielschritt dieser Transition' }
        ]);
        if (v === 'ins') opInsertInTrans(tsel); else if (v === 'par') opParOnTrans(tsel);
        return;
      }
      if (!ssel) {
        // kein Schritt gewaehlt: am Ende der Kette anhaengen
        const R = g.steps.filter(function (s) { return !g.transitions.some(function (t) { return t.from.indexOf(s.id) >= 0; }); });
        ssel = (R.length ? R[R.length - 1] : g.steps[g.steps.length - 1]).id;
        opAfter(ssel);
        return;
      }
      const v = await ctx.pick('Schritt hinzufügen bei ' + ssel, [
        { value: 'after', label: 'Danach einfügen (in der Kette)' },
        { value: 'alt', label: 'Alternativer Zweig (Auswahl: entweder – oder)' },
        { value: 'par', label: 'Paralleler Zweig (gleichzeitig)' }
      ]);
      if (v === 'after') opAfter(ssel); else if (v === 'alt') opAlt(ssel); else if (v === 'par') opPar(ssel);
    }

    // ----- Loeschen mit Pruefung
    function deleteStepIn(g, id) {
      const incoming = g.transitions.filter(function (t) { return t.to.indexOf(id) >= 0; });
      const outgoing = g.transitions.filter(function (t) { return t.from.indexOf(id) >= 0; });
      g.steps = g.steps.filter(function (s) { return s.id !== id; });
      if (incoming.length === 1 && outgoing.length === 1 && incoming[0].to.length === 1 && outgoing[0].from.length === 1 && incoming[0] !== outgoing[0]) {
        // Kette: Eingangs-Transition zeigt jetzt auf das Ziel der Ausgangs-Transition
        incoming[0].to = outgoing[0].to.slice();
        g.transitions = g.transitions.filter(function (t) { return t !== outgoing[0]; });
      } else {
        g.transitions.forEach(function (t) { t.from = t.from.filter(function (x) { return x !== id; }); t.to = t.to.filter(function (x) { return x !== id; }); });
        g.transitions = g.transitions.filter(function (t) { return t.from.length && t.to.length; });
      }
    }
    function orphans(g) {
      const R = reachable(g);
      return g.steps.filter(function (s) { return !R[s.id]; }).map(function (s) { return s.id; });
    }
    function badConds(prog, g) {
      const out = [];
      g.transitions.forEach(function (t) { if (!CORE().parseCond(t.cond, { symbols: prog.symbols, gra: g }).ok) out.push(t.id); });
      return out;
    }
    async function delStep(id) {
      const prog = getProg(), g = prog.gra;
      const s = stepById(g, id); if (!s) return;
      if (g.steps.length < 2) { ctx.toast('Das GRAFCET braucht mindestens einen Schritt, der letzte kann nicht gelöscht werden.'); return; }
      if (s.init && g.steps.filter(function (x) { return x.init; }).length < 2) { ctx.toast('„' + id + '“ ist der einzige Anfangsschritt. Lege zuerst einen anderen Schritt als Anfangsschritt fest.'); return; }
      const sim = JSON.parse(JSON.stringify(g));
      deleteStepIn(sim, id);
      const orph = orphans(sim);
      const before = badConds(prog, g);
      const after = badConds(prog, sim);
      const newBad = after.filter(function (x) { return before.indexOf(x) < 0; });
      const inT = g.transitions.filter(function (t) { return t.from.indexOf(id) >= 0 || t.to.indexOf(id) >= 0; }).map(function (t) { return t.id; });
      let msg = 'Schritt ' + id + ' löschen' + (inT.length ? ' (Transitionen ' + inT.join(', ') + ' werden angepasst oder entfernt)' : '') + '?';
      const opts = [{ value: 'yes', label: 'Ja, ' + id + ' löschen' }];
      if (orph.length) {
        msg = 'Wenn ' + id + ' wegfällt, ' + (orph.length > 1 ? 'sind ' : 'ist ') + orph.join(', ') + ' vom Start aus nicht mehr erreichbar.';
        opts[0].label = 'Nur ' + id + ' löschen (' + orph.join(', ') + ' bleiben unverbunden)';
        opts.push({ value: 'all', label: id + ' und ' + orph.join(', ') + ' löschen' });
      }
      opts.push({ value: 'no', label: 'Abbrechen' });
      const v = await ctx.pick(msg, opts);
      if (v !== 'yes' && v !== 'all') return;
      mutate(function (gg) {
        deleteStepIn(gg, id);
        if (v === 'all') {
          let guard = 0;
          while (guard++ < 100) {
            const o = orphans(gg);
            if (!o.length || o.length >= gg.steps.length) break;
            deleteStepIn(gg, o[0]);
          }
        }
      });
      if (sel && sel.k === 's' && !stepById(getProg().gra, sel.id)) sel = null;
      applySel();
      if (newBad.length) ctx.toast('Die Bedingung von ' + newBad.join(', ') + ' verweist auf einen gelöschten Schritt und muss angepasst werden.');
    }
    async function delTrans(id) {
      const prog = getProg(), g = prog.gra;
      const t = transById(g, id); if (!t) return;
      const sim = JSON.parse(JSON.stringify(g));
      sim.transitions = sim.transitions.filter(function (x) { return x.id !== id; });
      const orph = orphans(sim);
      const before = orphans(g);
      const newOrph = orph.filter(function (x) { return before.indexOf(x) < 0; });
      const opts = [];
      let msg = 'Transition ' + id + ' (' + t.from.join(' + ') + ' → ' + t.to.join(' + ') + ') löschen?';
      if (newOrph.length) {
        msg = 'Wenn ' + id + ' wegfällt, ' + (newOrph.length > 1 ? 'sind ' : 'ist ') + newOrph.join(', ') + ' nicht mehr erreichbar.';
        opts.push({ value: 'only', label: 'Nur die Transition löschen (' + newOrph.join(', ') + ' bleiben unverbunden)' });
        opts.push({ value: 'all', label: 'Transition und ' + newOrph.join(', ') + ' löschen' });
      } else opts.push({ value: 'only', label: 'Ja, Transition ' + id + ' löschen' });
      opts.push({ value: 'no', label: 'Abbrechen' });
      const v = await ctx.pick(msg, opts);
      if (v !== 'only' && v !== 'all') return;
      mutate(function (gg) {
        gg.transitions = gg.transitions.filter(function (x) { return x.id !== id; });
        if (v === 'all') {
          newOrph.forEach(function (sid) { if (stepById(gg, sid) && gg.steps.length > 1) deleteStepIn(gg, sid); });
        }
      });
      if (sel && sel.k === 't') sel = null;
      applySel();
    }

    // ----- Start
    (function init() {
      const prog = getProg();
      lastProg = prog;
      if (prog && prog.lang === 'gra') {
        const before = JSON.stringify(prog.gra || null);
        normalize(prog);
        if (JSON.stringify(prog.gra) !== before) ctx.changed();
      }
      rebuild(true);
      if (L && !userZoom) { requestAnimationFrame(function () { if (!destroyed && !userZoom) fit(); }); }
    })();

    return {
      refresh: function () { if (destroyed) return; selfSig = false; rebuild(false); applyLive(); updateBar(); },
      destroy: function () { destroyed = true; closeSheet(); el.innerHTML = ''; },
      _layout: function () { return L; }
    };
  }

  SPS_EDIT.register('gra', { title: 'GRAFCET', mount: mount, internals: { buildLayout: buildLayout, evalAst: evalAst, astText: astText } });
})(typeof window !== 'undefined' ? window : globalThis);
