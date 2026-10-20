/* pcbfab.js - Fertigungs-Ansichten des Leiterplatten-Labs: 'stack' (Lagenaufbau, Impedanz), 'gerber' (Gerber-Viewer, ZIP, Quiz),
 * 'fab' (Fertigungsschritte als Animation, Kostenrechner, DFM-Pruefliste). Registriert sich bei window.PCB_VIEWS.
 * Vanilla-JS, Canvas/SVG, kein eval, keine externen Abhaengigkeiten.
 *
 * ENTSCHEIDUNGEN / Hinweise zur UI-Anbindung:
 *  - Zusatzfeld im Datenmodell: board.layerRoles = { 'In1.Cu':'gnd'|'vcc'|'signal', ... } (nur Innenlagen). Fehlt es, wird die Rolle
 *    aus vorhandenen Zonen abgeleitet, sonst nach Standard (4 Lagen: In1 Masse, In2 Versorgung; 6 Lagen: In1 Masse, In4 Versorgung).
 *  - Lagenzahl-Wechsel aendert board.layers, entfernt/verschiebt Objekte auf entfallenden Innenlagen (mit ctx.confirm) und ruft ctx.changed().
 *  - Jede Ansicht ist gegen fehlende/abweichende Kern-Funktionen abgesichert (lokale Rueckfall-Rechnung), wirft nie in mount/refresh.
 *  - Optionale Hooks, falls die UI sie bereitstellt: ctx.goto(x, y) (springt im Editor zur Stelle eines DFM-Verstosses).
 */
(function (root) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const CORE = () => root.PCB_CORE || null;
  const MONO = 'ui-monospace, "Cascadia Mono", Consolas, Menlo, "Courier New", monospace';
  const C_ACC = '#3b9eff', C_OK = '#4cd964', C_WARN = '#ffb340', C_ERR = '#ff6b6b';

  // ------------------------------------------------------------------ kleine Helfer
  function add(e, kids) {
    for (const c of kids) {
      if (c == null || c === false) continue;
      if (Array.isArray(c)) add(e, c);
      else e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    }
  }
  function h(tag, a) {
    const e = document.createElement(tag);
    if (a) for (const k in a) {
      const v = a[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style') { if (typeof v === 'string') e.style.cssText = v; else Object.assign(e.style, v); }
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    add(e, Array.prototype.slice.call(arguments, 2));
    return e;
  }
  function sv(tag, a) {
    const e = document.createElementNS(NS, tag);
    if (a) for (const k in a) {
      const v = a[k];
      if (v == null || v === false) continue;
      if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v);
    }
    add(e, Array.prototype.slice.call(arguments, 2));
    return e;
  }
  const fmt = (n, d) => (isFinite(n) ? Number(n).toFixed(d == null ? 2 : d) : '–').replace('.', ',');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);       // Teilfortschritt von t im Fenster [a,b]
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k, d) => { try { const v = root.localStorage.getItem('pcb.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { root.localStorage.setItem('pcb.' + k, JSON.stringify(v)); } catch (e) { /* egal */ } };
  const safe = (f, d) => { try { return f(); } catch (e) { return d; } };
  async function askYes(ctx, msg) {
    if (!ctx || !ctx.confirm) return true;
    try { return !!(await Promise.resolve(ctx.confirm(msg))); } catch (e) { return false; }
  }
  const toast = (ctx, m) => { try { if (ctx && ctx.toast) ctx.toast(m); } catch (e) { /* egal */ } };
  const fx = (ctx, kind, x, y, text) => { try { if (ctx && ctx.fx) ctx.fx(kind, x, y, text); } catch (e) { /* egal */ } };

  // ------------------------------------------------------------------ Stil
  const CSS = [
    '.pf-root{position:relative;display:flex;flex-direction:column;height:100%;min-height:380px;background:#14181c;color:#e8edf2;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden;box-sizing:border-box}',
    '.pf-root *{box-sizing:border-box}',
    '.pf-tabs{display:flex;gap:6px;padding:8px;background:#222830;border-bottom:1px solid #2c343e;flex:0 0 auto;overflow-x:auto;-webkit-overflow-scrolling:touch}',
    '.pf-tab{flex:0 0 auto;min-height:40px;padding:0 14px;border:1px solid #3a4452;background:#2c343e;color:#c9d2dc;border-radius:10px;font:inherit;font-weight:600;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;white-space:nowrap}',
    '.pf-tab.on{background:#3b9eff;border-color:#3b9eff;color:#06121f}',
    '.pf-body{flex:1 1 auto;overflow:auto;padding:10px;-webkit-overflow-scrolling:touch}',
    '.pf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:12px;align-items:start}',
    '.pf-card{background:#222830;border:1px solid #2c343e;border-radius:12px;padding:12px;margin-bottom:12px;min-width:0}',
    '.pf-grid>.pf-card{margin-bottom:0}',
    '.pf-card h3{margin:0 0 8px;font-size:15px;color:#e8edf2}',
    '.pf-card h4{margin:10px 0 4px;font-size:13px;color:#9fb0c2;font-weight:600}',
    '.pf-card p{margin:0 0 8px;color:#c9d2dc}',
    '.pf-muted{color:#8b97a3;font-size:12.5px}',
    '.pf-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}',
    '.pf-sp{flex:1 1 4px}',
    '.pf-btn{min-height:40px;min-width:40px;padding:0 12px;border:1px solid #3a4452;background:#2c343e;color:#e8edf2;border-radius:10px;font:inherit;font-weight:600;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;white-space:nowrap}',
    '.pf-btn:active{filter:brightness(1.25)}',
    '.pf-btn:disabled{opacity:.38;cursor:default}',
    '.pf-btn.pri{background:#3b9eff;border-color:#3b9eff;color:#06121f}',
    '.pf-btn.ok{background:#4cd964;border-color:#4cd964;color:#06200d}',
    '.pf-btn.on{background:#1d3550;border-color:#3b9eff;color:#bfe0ff}',
    '.pf-btn.warn{color:#ffb340;border-color:#6b5427}',
    '.pf-seg{display:inline-flex;border:1px solid #3a4452;border-radius:10px;overflow:hidden;flex:0 0 auto}',
    '.pf-seg button{min-height:40px;min-width:44px;padding:0 12px;border:0;border-right:1px solid #3a4452;background:#2c343e;color:#c9d2dc;font:inherit;font-weight:600;cursor:pointer;touch-action:manipulation}',
    '.pf-seg button:last-child{border-right:0}',
    '.pf-seg button.on{background:#3b9eff;color:#06121f}',
    '.pf-seg button:disabled{opacity:.38;cursor:default}',
    '.pf-lbl{font-size:13px;color:#9fb0c2;margin-right:2px}',
    '.pf-sl{display:grid;grid-template-columns:minmax(90px,130px) 1fr minmax(64px,auto);gap:8px;align-items:center;margin:2px 0}',
    '.pf-sl input[type=range]{width:100%;height:40px;margin:0;accent-color:#3b9eff;touch-action:pan-y}',
    '.pf-sl output{font:600 13px ' + MONO + ';color:#7fc0ff;text-align:right}',
    '.pf-sel{min-height:40px;background:#2c343e;color:#e8edf2;border:1px solid #3a4452;border-radius:10px;padding:0 8px;font:inherit}',
    '.pf-chip{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 12px;border:1px solid #3a4452;background:#2c343e;color:#e8edf2;border-radius:20px;font:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}',
    '.pf-chip.off{opacity:.45}',
    '.pf-chip i{display:inline-block;width:14px;height:14px;border-radius:4px;border:1px solid rgba(255,255,255,.35)}',
    '.pf-svg{display:block;width:100%;height:auto;user-select:none;-webkit-user-select:none}',
    '.pf-big{font:700 32px ' + MONO + ';color:#7fc0ff}',
    '.pf-ok{color:#4cd964}.pf-warn{color:#ffb340}.pf-err{color:#ff6b6b}',
    '.pf-tbl{width:100%;border-collapse:collapse;font-size:13px}',
    '.pf-tbl th,.pf-tbl td{text-align:left;padding:5px 6px;border-bottom:1px solid #2c343e;vertical-align:top}',
    '.pf-tbl th{color:#9fb0c2;font-weight:600}',
    '.pf-tbl td.n,.pf-tbl th.n{text-align:right;font-family:' + MONO + '}',
    '.pf-note{border-left:3px solid #3b9eff;background:#1b2530;padding:8px 10px;border-radius:0 8px 8px 0;margin:8px 0;color:#c9d2dc}',
    '.pf-note.ok{border-color:#4cd964;background:#1a2a20}.pf-note.warn{border-color:#ffb340;background:#2c2618}.pf-note.err{border-color:#ff6b6b;background:#2d1d20}',
    '.pf-acc>summary{min-height:40px;display:flex;align-items:center;cursor:pointer;font-weight:700;list-style:none;padding:2px 0}',
    '.pf-acc>summary::-webkit-details-marker{display:none}',
    '.pf-acc>summary::before{content:"\\203A";font-weight:700;font-size:20px;width:12px;text-align:center;margin-right:8px;color:#3b9eff;transition:transform .15s}',
    '.pf-acc[open]>summary::before{transform:rotate(90deg)}',
    '.pf-cv{display:block;width:100%;background:#0e1115;border-radius:10px;touch-action:none}',
    '.pf-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,340px);gap:12px;align-items:start}',
    '.pf-split>.pf-card{margin-bottom:0}',
    '@media (max-width:820px){.pf-split{grid-template-columns:minmax(0,1fr)}.pf-split>.pf-card{margin-bottom:12px}}',
    '.pf-list{display:flex;flex-direction:column;gap:6px}',
    '.pf-file{display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:center;background:#1b2128;border:1px solid #2c343e;border-radius:10px;padding:8px 10px}',
    '.pf-file b{font-family:' + MONO + ';font-size:12.5px;color:#e8edf2;word-break:break-all}',
    '.pf-file pre{grid-column:1/-1;margin:6px 0 0;max-height:200px;overflow:auto;background:#0e1115;border-radius:8px;padding:8px;font:11px/1.35 ' + MONO + ';color:#aab6c3}',
    '.pf-steps{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch}',
    '.pf-stp{flex:0 0 auto;min-width:44px;min-height:44px;border-radius:22px;border:2px solid #3a4452;background:#2c343e;color:#c9d2dc;font:700 14px system-ui;cursor:pointer;touch-action:manipulation}',
    '.pf-stp.on{background:#3b9eff;border-color:#3b9eff;color:#06121f}',
    '.pf-stp.done{border-color:#4cd964;color:#9fe6b0}',
    '.pf-stp.skip{opacity:.45;border-style:dashed}',
    '.pf-bar{height:14px;border-radius:7px;background:#14181c;overflow:hidden;border:1px solid #2c343e}',
    '.pf-bar>div{height:100%;background:#3b9eff}',
    '.pf-opt{display:block;width:100%;min-height:44px;text-align:left;padding:8px 12px;margin:6px 0;border-radius:10px;border:1px solid #3a4452;background:#2c343e;color:#e8edf2;font:inherit;cursor:pointer;touch-action:manipulation}',
    '.pf-opt.good{background:#1d4a2b;border-color:#4cd964}.pf-opt.bad{background:#4a2026;border-color:#ff6b6b}',
    '.pf-badge{display:inline-block;padding:2px 10px;border-radius:12px;font-weight:700;font-size:12.5px}',
    '.pf-badge.ok{background:#1d4a2b;color:#9fe6b0}.pf-badge.err{background:#4a2026;color:#ffb3ba}.pf-badge.warn{background:#4a3a18;color:#ffd58a}',
    '.pf-dash{stroke-dasharray:6 5;animation:pfdash 1s linear infinite}',
    '@keyframes pfdash{to{stroke-dashoffset:-22}}',
    '@media (max-width:520px){.pf-sl{grid-template-columns:1fr auto}.pf-sl input{grid-column:1/-1;grid-row:2}.pf-sl output{grid-row:1;grid-column:2}.pf-body{padding:8px}}',
    '@media (prefers-reduced-motion:reduce){.pf-dash{animation:none}}'
  ].join('\n');
  function injectCss() {
    if (document.getElementById('pcbfab-css')) return;
    const s = document.createElement('style'); s.id = 'pcbfab-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function tabsBar(items, cur, onSel) {
    return h('div', { class: 'pf-tabs', role: 'tablist' }, items.map(it => h('button', {
      class: 'pf-tab' + (it[0] === cur ? ' on' : ''), role: 'tab', 'aria-selected': it[0] === cur ? 'true' : 'false', onclick: () => onSel(it[0])
    }, it[1])));
  }
  function slider(label, min, max, step, val, fmtf, oninput) {
    const out = h('output', null, fmtf(val));
    const inp = h('input', { type: 'range', min, max, step, value: val, 'aria-label': label });
    inp.addEventListener('input', () => { const v = parseFloat(inp.value); out.textContent = fmtf(v); oninput(v); });
    const row = h('div', { class: 'pf-sl' }, h('span', { class: 'pf-lbl' }, label), inp, out);
    row.set = v => { inp.value = v; out.textContent = fmtf(parseFloat(inp.value)); };
    return row;
  }
  function segCtl(opts, cur, onSel, dis) {
    const wrap = h('div', { class: 'pf-seg', role: 'group' });
    opts.forEach(o => {
      const b = h('button', { class: o[0] === cur ? 'on' : '', disabled: dis && dis(o[0]) ? true : null, onclick: () => onSel(o[0]) }, o[1]);
      wrap.appendChild(b);
    });
    return wrap;
  }
  // Canvas mit automatischer Groesse (dpr), Zeichenfunktion draw(ctx2d, w, h)
  function autoCanvas(parent, ratio, draw, minH) {
    const cv = h('canvas', { class: 'pf-cv' });
    parent.appendChild(cv);
    const o = { cv, w: 300, h: 200, dpr: 1, ro: null, draw };
    o.resize = function () {
      const w = Math.max(60, cv.clientWidth || cv.parentNode.clientWidth || 300);
      const hh = Math.max(minH || 120, Math.round(w * ratio));
      const dpr = Math.min(2.5, root.devicePixelRatio || 1);
      if (o.onResize && (Math.abs(w - o.w) > 1 || hh !== o.h)) o.onResize();
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); }
      cv.style.height = hh + 'px';
      o.w = w; o.h = hh; o.dpr = dpr;
    };
    o.paint = function () {
      o.resize();
      const g = cv.getContext('2d');
      g.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
      g.clearRect(0, 0, o.w, o.h);
      try { draw(g, o.w, o.h); } catch (e) { /* Zeichenfehler duerfen die Oberflaeche nicht stoeren */ }
    };
    if (root.ResizeObserver) { o.ro = new root.ResizeObserver(() => { if (cv.isConnected && cv.clientWidth) o.paint(); }); o.ro.observe(cv); }
    return o;
  }

  // ------------------------------------------------------------------ Lagen und Lagenaufbau
  const LAYER_IDS = {
    1: ['B.Cu'], 2: ['F.Cu', 'B.Cu'], 4: ['F.Cu', 'In1.Cu', 'In2.Cu', 'B.Cu'], 6: ['F.Cu', 'In1.Cu', 'In2.Cu', 'In3.Cu', 'In4.Cu', 'B.Cu']
  };
  function layerIds(n) { return (LAYER_IDS[n] || LAYER_IDS[2]).slice(); }
  function innerIds(n) { return layerIds(n).filter(i => /^In/.test(i)); }
  function layerIdsOf(b) {
    const c = CORE();
    const l = c && c.layerList ? safe(() => c.layerList(b), null) : null;
    return Array.isArray(l) && l.length ? l.slice() : layerIds(b.layers || 2);
  }
  function localStack(b) {
    const n = b.layers || 2, oz = b.copperOz || 1, inOz = b.inOz || 0.5;
    const cuO = 35 * oz, cuI = 35 * inOz, mask = 20, silk = 10;
    const rows = [];
    const R = (id, kind, name, t, mat) => rows.push({ id, kind, name, thickness: t, material: mat });
    const FR = 'FR-4';
    const total = 1600;
    if (n === 1) {
      R('F.Silk', 'silk', 'Siebdruck oben', silk, 'Epoxid-Tinte');
      R('', 'core', 'Kern', total - cuO - mask, FR);
      R('B.Cu', 'copper', 'B.Cu', cuO, 'Kupfer');
      R('B.Mask', 'mask', 'Lötstopplack unten', mask, 'Epoxid-Lack');
      R('B.Silk', 'silk', 'Siebdruck unten', silk, 'Epoxid-Tinte');
      return rows;
    }
    R('F.Silk', 'silk', 'Siebdruck oben', silk, 'Epoxid-Tinte');
    R('F.Mask', 'mask', 'Lötstopplack oben', mask, 'Epoxid-Lack');
    R('F.Cu', 'copper', 'F.Cu', cuO, 'Kupfer');
    if (n === 2) R('', 'core', 'Kern', total - 2 * cuO - 2 * mask, FR);
    else if (n === 4) {
      const pp = 210, core = total - 2 * cuO - 2 * cuI - 2 * pp - 2 * mask;
      R('', 'prepreg', 'Prepreg', pp, FR + ' (Harz-getränkt)'); R('In1.Cu', 'copper', 'In1.Cu', cuI, 'Kupfer');
      R('', 'core', 'Kern', core, FR); R('In2.Cu', 'copper', 'In2.Cu', cuI, 'Kupfer'); R('', 'prepreg', 'Prepreg', pp, FR + ' (Harz-getränkt)');
    } else {
      const pp = 120, core = (total - 2 * cuO - 4 * cuI - 3 * pp - 2 * mask) / 2;
      R('', 'prepreg', 'Prepreg', pp, FR + ' (Harz-getränkt)'); R('In1.Cu', 'copper', 'In1.Cu', cuI, 'Kupfer');
      R('', 'core', 'Kern', core, FR); R('In2.Cu', 'copper', 'In2.Cu', cuI, 'Kupfer');
      R('', 'prepreg', 'Prepreg', pp, FR + ' (Harz-getränkt)'); R('In3.Cu', 'copper', 'In3.Cu', cuI, 'Kupfer');
      R('', 'core', 'Kern', core, FR); R('In4.Cu', 'copper', 'In4.Cu', cuI, 'Kupfer'); R('', 'prepreg', 'Prepreg', pp, FR + ' (Harz-getränkt)');
    }
    R('B.Cu', 'copper', 'B.Cu', cuO, 'Kupfer');
    R('B.Mask', 'mask', 'Lötstopplack unten', mask, 'Epoxid-Lack');
    R('B.Silk', 'silk', 'Siebdruck unten', silk, 'Epoxid-Tinte');
    return rows;
  }
  // Liefert { rows:[{id,kind,name,thickness(µm),material}], total(µm, ohne Siebdruck), src:'core'|'lokal' }
  function normStack(b) {
    let rows = null, src = 'lokal', coreTotal = null;
    const c = CORE();
    if (c && c.stackup) {
      const r = safe(() => c.stackup(b), null);
      let arr = null;
      if (Array.isArray(r)) { arr = r; coreTotal = Number(r.total); }
      else if (r && typeof r === 'object') { arr = r.layers || r.stack || r.items || r.rows || r.list; coreTotal = Number(r.total != null ? r.total : r.totalThickness); }
      if (arr && arr.length) {
        rows = arr.map(x => {
          let kind = String(x.kind || x.type || '').toLowerCase();
          const nm = String(x.name || x.id || '');
          if (!/^(copper|prepreg|core|mask|silk)$/.test(kind)) {
            if (/cu|kupfer/i.test(nm)) kind = 'copper'; else if (/prepreg|pp/i.test(nm)) kind = 'prepreg'; else if (/mask|lötstopp|loetstopp/i.test(nm)) kind = 'mask';
            else if (/silk|druck/i.test(nm)) kind = 'silk'; else kind = 'core';
          }
          return { id: x.id || '', kind, name: nm, thickness: Number(x.thickness != null ? x.thickness : x.t), material: x.material || '' };
        });
        if (rows.some(r => !isFinite(r.thickness) || r.thickness <= 0)) rows = null;
      }
    }
    if (rows) {
      const sum = rows.reduce((a, r) => a + r.thickness, 0);
      if (sum < 20) { rows.forEach(r => { r.thickness *= 1000; }); if (coreTotal) coreTotal *= 1000; }   // Kern liefert mm
      const cu = rows.filter(r => r.kind === 'copper');
      if (cu.length && /^B\./.test(cu[0].id || cu[0].name) && !/^B\./.test(cu[cu.length - 1].id || cu[cu.length - 1].name)) rows.reverse();
      src = 'core';
    } else rows = localStack(b);
    // Kupfer-Ids sicherstellen
    const ids = layerIdsOf(b); let ci = 0;
    rows.forEach(r => {
      if (r.kind === 'copper') {
        if (!/Cu$/.test(r.id)) r.id = ids[ci] || ('Cu' + ci);
        ci++;
      } else if (r.kind === 'mask' || r.kind === 'silk') {
        if (!r.id) r.id = (rows.indexOf(r) < rows.length / 2 ? 'F.' : 'B.') + (r.kind === 'mask' ? 'Mask' : 'Silk');
      }
    });
    const nameOf = r => r.kind === 'copper' ? r.id : r.kind === 'core' ? 'Kern' : r.kind === 'prepreg' ? 'Prepreg' : r.kind === 'mask' ? (/^B/.test(r.id) ? 'Lötstopplack unten' : 'Lötstopplack oben') : (/^B/.test(r.id) ? 'Siebdruck unten' : 'Siebdruck oben');
    rows.forEach(r => { r.name = nameOf(r); });
    const total = src === 'core' && coreTotal > 100 ? coreTotal : rows.filter(r => r.kind !== 'silk').reduce((a, r) => a + r.thickness, 0);
    return { rows, total, src };
  }

  // Rolle einer Innenlage: 'signal' | 'gnd' | 'vcc'
  function isGndName(n) { return /^(gnd|agnd|dgnd|pgnd|masse|vss|0v|gnd\d*)$/i.test(String(n || '')); }
  function roleOf(b, id) {
    if (!/^In/.test(id)) return 'signal';
    if (b.layerRoles && b.layerRoles[id]) return b.layerRoles[id];
    const zs = (b.zones || []).filter(z => z.layer === id);
    if (zs.length) return isGndName(zs[0].net) ? 'gnd' : 'vcc';
    const n = b.layers || 2;
    if (n === 4) return id === 'In1.Cu' ? 'gnd' : 'vcc';
    if (n === 6) return id === 'In1.Cu' ? 'gnd' : id === 'In4.Cu' ? 'vcc' : 'signal';
    return 'signal';
  }
  const ROLE_NAME = { signal: 'Signal', gnd: 'Masse', vcc: 'Versorgung' };
  function netFor(b, role) {
    const nets = b.nets || [];
    if (role === 'gnd') { const n = nets.find(x => isGndName(x.name)); return n ? n.name : 'GND'; }
    const n = nets.find(x => !isGndName(x.name) && (x.cls === 'power' && /^\+?(vcc|vdd|v\+|\d+v\d*|\+?\d+(\.\d+)?v)/i.test(x.name))) ||
      nets.find(x => !isGndName(x.name) && x.cls === 'power') || nets.find(x => /^(vcc|vdd|\+?5v|\+?3v3|\+?12v)$/i.test(x.name));
    return n ? n.name : 'VCC';
  }
  function boardRectPoly(b, m) {
    if (Array.isArray(b.outline) && b.outline.length >= 3) return b.outline.map(p => [p[0], p[1]]);
    const w = b.w || 50, hh = b.h || 40;
    return [[m, m], [w - m, m], [w - m, hh - m], [m, hh - m]];
  }
  function newId(b, pre) {
    const c = CORE();
    if (c && c.nextId) { const v = safe(() => c.nextId(b), null); if (v != null) return v; }
    return pre + Math.random().toString(36).slice(2, 8);
  }
  function ensurePlane(b, layerId, role) {
    const net = netFor(b, role);
    if (!(b.nets || []).some(n => n.name === net)) { b.nets = b.nets || []; b.nets.push({ name: net, cls: 'power', pins: [] }); }
    b.zones = b.zones || [];
    b.zones.push({ id: newId(b, 'z'), layer: layerId, net, poly: boardRectPoly(b, 0.3), clearance: 0.3, thermals: true });
    return net;
  }
  function viaType(v) {
    const f = v.from || 'F.Cu', t = v.to || 'B.Cu', fo = f === 'F.Cu' || f === 'B.Cu', to = t === 'F.Cu' || t === 'B.Cu';
    if (fo && to) return 'thru';
    return fo || to ? 'blind' : 'buried';
  }

  // ================================================================== Ansicht 'stack'
  const COL = { cu: '#d9a24a', pp: '#c3cf7d', core: '#8c9a52', mask: '#1f9e4a', silk: '#f2f2f2', hole: '#0d1114' };
  const ROLE_COL = { signal: '#d9a24a', gnd: '#5aa2ff', vcc: '#ff7a7a' };

  // Impedanz: Mikrostreifen (IPC-Naeherung) und symmetrische Stripline
  function zMicro(w, hh, er, t) {
    const c = CORE();
    if (c && c.microstrip) { const z = safe(() => c.microstrip(w, hh, er, t), NaN); if (isFinite(z) && z > 0) return z; }
    const x = 5.98 * hh / (0.8 * w + t);
    return x > 1 ? 87 / Math.sqrt(er + 1.41) * Math.log(x) : NaN;
  }
  function zStrip(w, hh, er, t) {
    const b = 2 * hh + t, c = CORE();
    if (c && c.stripline) { const z = safe(() => c.stripline(w, b, er, t), NaN); if (isFinite(z) && z > 0) return z; }
    const x = 4 * b / (0.67 * Math.PI * (0.8 * w + t));
    return x > 1 ? 60 / Math.sqrt(er) * Math.log(x) : NaN;
  }
  const zOf = (m, p) => m === 'strip' ? zStrip(p.w, p.h, p.er, p.t / 1000) : zMicro(p.w, p.h, p.er, p.t / 1000);

  const WISSEN = [
    { id: 'gnd', t: 'Warum eine Masselage?', p: [
      'Eine durchgehende Kupferfläche auf Masse (GND) ist die beste Bezugsebene, die du auf einer Platine haben kannst: Sie hat einen sehr kleinen Widerstand und eine sehr kleine Induktivität. Jedes Signal findet dort direkt unter sich seinen Rückweg.',
      'Dazu kommt: Die Fläche schirmt Signale gegeneinander ab, verteilt Wärme, und du musst keine Masseleitungen mehr einzeln verlegen. Jedes Bauteil geht mit einem kurzen Via nach unten auf Masse. Das spart beim Routen viel Platz und macht die Schaltung unempfindlicher gegen Störungen.'
    ] },
    { id: 'ret', t: 'Rückstrompfad', p: [
      'Strom fließt immer im Kreis. Bei niedrigen Frequenzen nimmt der Rückstrom den Weg mit dem kleinsten Widerstand. Bei schnellen Signalen nimmt er den Weg mit der kleinsten Induktivität, und das ist der Weg direkt unter der Leiterbahn.',
      'Zerschneidest du die Massefläche mit einem Schlitz, muss der Rückstrom außen herum. Die Schleife wird größer, sie strahlt mehr und fängt mehr Störungen ein. Probiere es unten aus.'
    ], fig: 'ret' },
    { id: 'xt', t: 'Übersprechen', p: [
      'Zwei Leiterbahnen nebeneinander sind wie ein kleiner Kondensator und ein kleiner Transformator: Ein schnelles Signal auf der einen Bahn koppelt sich auf die andere ein. Je länger die Bahnen parallel laufen und je näher sie beieinander liegen, desto stärker.',
      'Gegenmittel: mehr Abstand (Faustregel 3-fache Bahnbreite zwischen den Mitten, die 3W-Regel), kürzere Parallelführung, eine Masselage dicht unter der Signallage (je näher die Masse, desto weniger Feld seitlich) und eine Masse-Bahn als Schutz zwischen empfindlichen Signalen.'
    ], fig: 'xt' },
    { id: 'four', t: 'Warum 4 Lagen?', p: [
      'Mit zwei Lagen musst du Signale, Versorgung und Masse alle auf zwei Flächen verteilen. Das wird bei vielen Bauteilen eng und Masse und Versorgung bekommen lange Umwege.',
      'Vier Lagen (Signal – Masse – Versorgung – Signal) geben dir zwei durchgehende Flächen: kurze Rückwege, saubere Versorgung (die beiden Flächen dicht nebeneinander wirken sogar wie ein flacher Kondensator), definierbare Wellenwiderstände und deutlich weniger Störabstrahlung. Dafür kostet die Platine mehr, weil sie laminiert werden muss. Für einfache Schaltungen reichen zwei Lagen völlig.'
    ] },
    { id: 'emc', t: 'EMV und Lagenaufbau', p: [
      'EMV heißt: Dein Gerät stört nicht andere und lässt sich nicht stören. Der Lagenaufbau legt dafür den Grundstein.'
    ], list: [
      'Jede Signallage sollte direkt neben einer Massefläche liegen (kurzer Rückweg).',
      'Schnelle Signale auf der Lage neben der Masse führen, möglichst ohne Lagenwechsel; wenn doch, ein Masse-Via direkt daneben setzen.',
      'Masse- und Versorgungsfläche dicht benachbart legen: weniger Induktivität, mehr Eigenkapazität.',
      'Zwei Signallagen ohne Fläche dazwischen: Bahnen senkrecht kreuzen lassen, nie parallel übereinander.',
      'Aufbau symmetrisch halten (gleich viel Kupfer oben und unten), sonst verzieht sich die Platine beim Löten.',
      'Außenlagen-Signale sind nur zur Masse hin abgeschirmt. Wirklich empfindliche Leitungen verlaufen innen zwischen zwei Flächen (Stripline).'
    ] }
  ];

  function mountStack(el, ctx) {
    injectCss();
    const S = { tab: lsGet('stack.tab', 'aufbau'), scaled: false, via: 'thru', sel: null, open: {}, busy: false,
      imp: { mode: 'micro', w: 0.3, h: 0.2, er: 4.3, t: 35, target: 50 }, xt: { d: 0.5, h: 0.2 }, slot: false };
    const rootEl = h('div', { class: 'pf-root' });
    el.appendChild(rootEl);
    let alive = true, bodyEl = null;
    const board = () => (ctx.getBoard && ctx.getBoard()) || { layers: 2, w: 50, h: 40, tracks: [], vias: [], zones: [], parts: [], nets: [] };
    const readonly = () => safe(() => (ctx.mode && ctx.mode() === 'view') || (ctx.task && ctx.task() && ctx.task().readonly), false);
    const changed = () => { try { ctx.changed && ctx.changed(); } catch (e) { /* egal */ } };

    // ---------- Lagenzahl und Rollen aendern
    async function setLayers(n) {
      const b = board(), old = b.layers || 2;
      if (n === old || S.busy) return;
      if (readonly()) { toast(ctx, 'Der Lagenaufbau ist in dieser Aufgabe gesperrt.'); return; }
      S.busy = true;
      try {
        const keep = new Set(layerIds(n));
        const lostT = (b.tracks || []).filter(t => !keep.has(t.layer));
        const lostZ = (b.zones || []).filter(z => !keep.has(z.layer));
        const viaFix = (b.vias || []).filter(v => (v.from && !keep.has(v.from)) || (v.to && !keep.has(v.to)));
        // Zonen auf entfallenden Innenlagen auf freie Innenlagen verschieben
        const usedInner = new Set();
        (b.tracks || []).forEach(t => { if (keep.has(t.layer)) usedInner.add(t.layer); });
        (b.zones || []).forEach(z => { if (keep.has(z.layer)) usedInner.add(z.layer); });
        const freeInner = innerIds(n).filter(i => !usedInner.has(i));
        const moves = [];
        lostZ.slice().sort((a, c) => String(c.layer).localeCompare(String(a.layer))).forEach(z => {
          if (/^In/.test(z.layer) && n > 2 && freeInner.length) moves.push([z, freeInner.shift()]);
        });
        const dropZ = lostZ.filter(z => !moves.some(m => m[0] === z));
        const smdTop = n === 1 ? (b.parts || []).filter(p => p.side !== 'bot' && safe(() => CORE().footprint(p.fp).kind, '') === 'smd').length : 0;
        const msgs = [];
        if (lostT.length) msgs.push(lostT.length + ' Leiterbahn(en) auf ' + [...new Set(lostT.map(t => t.layer))].join(', ') + ' werden gelöscht');
        if (moves.length) msgs.push(moves.length + ' Fläche(n) wandern auf ' + moves.map(m => m[1]).join(', '));
        if (dropZ.length) msgs.push(dropZ.length + ' Fläche(n) (' + [...new Set(dropZ.map(z => z.net + ' auf ' + z.layer))].join(', ') + ') werden gelöscht');
        if (n === 1 && (b.vias || []).length) msgs.push((b.vias || []).length + ' Via(s) entfallen, weil es nur noch eine Kupferlage gibt');
        else if (viaFix.length) msgs.push(viaFix.length + ' Blind-/Buried-Via(s) werden zu normalen Durchkontaktierungen');
        if (smdTop) msgs.push('Achtung: ' + smdTop + ' SMD-Bauteil(e) auf der Oberseite haben danach keine Kupferlage mehr');
        if (msgs.length) {
          const ok = await askYes(ctx, 'Von ' + old + ' auf ' + n + ' Lagen wechseln?\n\n- ' + msgs.join('\n- ') + '.');
          if (!ok) { S.busy = false; render(); return; }
        }
        lostT.forEach(t => { b.tracks.splice(b.tracks.indexOf(t), 1); });
        dropZ.forEach(z => { b.zones.splice(b.zones.indexOf(z), 1); });
        moves.forEach(m => { m[0].layer = m[1]; });
        if (n === 1) b.vias = [];
        else viaFix.forEach(v => { v.from = 'F.Cu'; v.to = 'B.Cu'; });
        b.layers = n;
        // Rollen bereinigen und Standardrollen fuer neue Innenlagen
        const roles = b.layerRoles || {}, inn = innerIds(n);
        Object.keys(roles).forEach(k => { if (inn.indexOf(k) < 0) delete roles[k]; });
        moves.forEach(m => { roles[m[1]] = isGndName(m[0].net) ? 'gnd' : 'vcc'; });
        b.layerRoles = roles;
        if (n > old && n >= 4) {
          const need = [];
          const gl = 'In1.Cu', vl = n === 4 ? 'In2.Cu' : 'In4.Cu';
          if (!(b.zones || []).some(z => z.layer === gl)) need.push([gl, 'gnd']);
          if (!(b.zones || []).some(z => z.layer === vl)) need.push([vl, 'vcc']);
          roles[gl] = roles[gl] || 'gnd'; roles[vl] = roles[vl] || 'vcc';
          if (need.length && await askYes(ctx, 'Sollen gleich Kupferflächen angelegt werden?\n\n' + need.map(x => '- ' + x[0] + ': ' + (x[1] === 'gnd' ? 'Masse' : 'Versorgung') + '-Fläche über die ganze Platine').join('\n'))) {
            need.forEach(x => { ensurePlane(b, x[0], x[1]); });
            toast(ctx, 'Flächen angelegt. Pads des Netzes verbindest du im Editor mit einem Via.');
          }
        }
        fx(ctx, 'click');
        changed();
      } catch (e) { toast(ctx, 'Lagenwechsel nicht möglich: ' + (e && e.message)); }
      S.busy = false; render();
    }
    async function setRole(id, role) {
      const b = board();
      if (roleOf(b, id) === role) return;
      if (readonly()) { toast(ctx, 'Der Lagenaufbau ist in dieser Aufgabe gesperrt.'); return; }
      const zs = (b.zones || []).filter(z => z.layer === id), tr = (b.tracks || []).filter(t => t.layer === id);
      if (role === 'signal' && zs.length && !(await askYes(ctx, 'Die Fläche(n) auf ' + id + ' (' + zs.map(z => z.net).join(', ') + ') werden entfernt. Fortfahren?'))) { render(); return; }
      if (role !== 'signal' && tr.length && !(await askYes(ctx, 'Auf ' + id + ' liegen ' + tr.length + ' Leiterbahnen. Sie zerschneiden die Fläche. Trotzdem als ' + ROLE_NAME[role] + '-Lage verwenden?'))) { render(); return; }
      b.layerRoles = b.layerRoles || {};
      b.layerRoles[id] = role;
      if (role === 'signal') b.zones = (b.zones || []).filter(z => z.layer !== id);
      else if (zs.length) zs.forEach(z => { z.net = netFor(b, role); });
      else { ensurePlane(b, id, role); toast(ctx, ROLE_NAME[role] + '-Fläche auf ' + id + ' angelegt.'); }
      fx(ctx, 'click');
      changed(); render();
    }

    // ---------- Querschnitt
    function sectionSvg() {
      const b = board(), st = normStack(b), rows = st.rows;
      const X0 = 150, W = 360, k = 0.14;
      const hp = r => {
        if (S.scaled) return Math.max(2.5, r.thickness * k);
        const outer = /^(F|B)\.Cu$/.test(r.id);
        return r.kind === 'copper' ? (outer ? 17 : 15) : r.kind === 'prepreg' ? 30 : r.kind === 'core' ? ((b.layers || 2) <= 2 ? 80 : 54) : r.kind === 'mask' ? 15 : 13;
      };
      const hs = rows.map(hp), sumH = hs.reduce((a, c) => a + c, 0), top = 30, H = top + sumH + 96;
      const svg = sv('svg', { class: 'pf-svg', viewBox: '0 0 640 ' + H, role: 'img', 'aria-label': 'Querschnitt des Lagenaufbaus' });
      svg.appendChild(sv('defs', null,
        sv('pattern', { id: 'pfh', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, sv('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: 'rgba(0,0,0,.18)', 'stroke-width': 2 }))));
      let y = top; const ypos = [];
      rows.forEach((r, i) => {
        ypos.push([y, hs[i]]);
        const fill = r.kind === 'copper' ? COL.cu : r.kind === 'prepreg' ? COL.pp : r.kind === 'core' ? COL.core : r.kind === 'mask' ? COL.mask : COL.silk;
        const g = sv('g', { style: 'cursor:pointer', onclick: () => { S.sel = S.sel === i ? null : i; render(); } });
        g.appendChild(sv('rect', { x: X0, y, width: W, height: hs[i], fill, stroke: S.sel === i ? C_ACC : 'rgba(0,0,0,.35)', 'stroke-width': S.sel === i ? 3 : 1 }));
        if (r.kind === 'core' || r.kind === 'prepreg') g.appendChild(sv('rect', { x: X0, y, width: W, height: hs[i], fill: 'url(#pfh)' }));
        const lblY = y + hs[i] / 2 + 4.5;
        g.appendChild(sv('text', { x: X0 - 10, y: lblY, 'text-anchor': 'end', fill: '#e8edf2', 'font-size': 13, 'font-weight': r.kind === 'copper' ? 700 : 400 }, r.name));
        const um = r.thickness >= 100 ? Math.round(r.thickness) : fmt(r.thickness, r.thickness % 1 ? 1 : 0);
        g.appendChild(sv('text', { x: X0 + W + 10, y: lblY, fill: '#aab6c3', 'font-size': 13, 'font-family': MONO }, um + ' µm'));
        if (r.kind === 'copper' && /^In/.test(r.id)) {
          const ro = roleOf(b, r.id);
          g.appendChild(sv('rect', { x: X0 + W + 78, y: y + hs[i] / 2 - 9, width: 62, height: 18, rx: 9, fill: ROLE_COL[ro], opacity: 0.9 }));
          g.appendChild(sv('text', { x: X0 + W + 109, y: lblY, 'text-anchor': 'middle', fill: '#10161c', 'font-size': 11, 'font-weight': 700 }, ro === 'gnd' ? 'GND' : ro === 'vcc' ? 'VCC' : 'Signal'));
        }
        svg.appendChild(g);
        y += hs[i];
      });
      // Vias
      const copperIdx = rows.map((r, i) => r.kind === 'copper' ? i : -1).filter(i => i >= 0);
      const n = b.layers || 2;
      const defs = [['thru', 200, 0, copperIdx.length - 1]];
      if (n >= 4) {
        defs.push(['blind', 320, 0, 1]);
        const a = n === 4 ? 1 : 2; defs.push(['buried', 440, a, a + 1]);
      }
      defs.forEach(d => {
        const [tp, cx, ia, ib] = d, ra = copperIdx[ia], rb = copperIdx[ib];
        if (ra == null || rb == null) return;
        const y0 = ypos[ra][0], y1 = ypos[rb][0] + ypos[rb][1], on = S.via === tp, op = on ? 1 : 0.35;
        const g = sv('g', { opacity: on ? 1 : 0.55, style: 'cursor:pointer', onclick: () => { S.via = tp; render(); } });
        g.appendChild(sv('rect', { x: cx - 36, y: y0 - 4, width: 72, height: y1 - y0 + 8, fill: 'transparent' }));
        for (let q = ia; q <= ib; q++) {
          const rr = copperIdx[q], yy = ypos[rr];
          g.appendChild(sv('rect', { x: cx - 24, y: yy[0] - 1, width: 48, height: yy[1] + 2, fill: '#f0c060', stroke: '#8a5d14', 'stroke-width': 1 }));
        }
        g.appendChild(sv('rect', { x: cx - 8, y: y0 - 1, width: 16, height: y1 - y0 + 2, fill: COL.hole }));
        g.appendChild(sv('rect', { x: cx - 10, y: y0 - 1, width: 3, height: y1 - y0 + 2, fill: '#f0c060' }));
        g.appendChild(sv('rect', { x: cx + 7, y: y0 - 1, width: 3, height: y1 - y0 + 2, fill: '#f0c060' }));
        if (tp !== 'thru') g.appendChild(sv('rect', { x: cx - 8, y: tp === 'blind' ? y1 - 2 : y1 - 2, width: 16, height: 3, fill: '#f0c060' }));
        const nm = tp === 'thru' ? 'Durchkontaktierung' : tp === 'blind' ? 'Blind-Via' : 'Buried-Via';
        g.appendChild(sv('text', { x: cx, y: top + sumH + 22 + (tp === 'blind' ? 0 : tp === 'buried' ? 0 : 0), 'text-anchor': 'middle', fill: on ? '#7fc0ff' : '#aab6c3', 'font-size': 12, 'font-weight': on ? 700 : 400 }, nm));
        svg.appendChild(g);
      });
      // Gesamtdicke
      const yb = top + sumH + 54;
      svg.appendChild(sv('line', { x1: X0, y1: yb, x2: X0 + W, y2: yb, stroke: '#9fb0c2', 'stroke-width': 1.5 }));
      svg.appendChild(sv('line', { x1: X0, y1: yb - 6, x2: X0, y2: yb + 6, stroke: '#9fb0c2', 'stroke-width': 1.5 }));
      svg.appendChild(sv('line', { x1: X0 + W, y1: yb - 6, x2: X0 + W, y2: yb + 6, stroke: '#9fb0c2', 'stroke-width': 1.5 }));
      svg.appendChild(sv('text', { x: X0 + W / 2, y: yb + 24, 'text-anchor': 'middle', fill: '#e8edf2', 'font-size': 15, 'font-weight': 700 },
        'Gesamtdicke ' + fmt(st.total / 1000, 2) + ' mm (' + Math.round(st.total) + ' µm)'));
      svg.appendChild(sv('text', { x: 14, y: 20, fill: '#8b97a3', 'font-size': 12 }, S.scaled ? 'maßstäblich (Dicken im Verhältnis)' : 'lesbar (Dicken nicht maßstäblich)'));
      return { svg, st };
    }

    function viaInfo(b) {
      const cnt = { thru: 0, blind: 0, buried: 0 };
      (b.vias || []).forEach(v => { cnt[viaType(v)]++; });
      const txt = {
        thru: ['Durchkontaktierung (Through-Via)', 'Wird nach dem Laminieren durch die ganze Platine gebohrt und innen verkupfert. Sie verbindet alle Lagen, die dort Kupfer haben. Das ist der Standard und mit Abstand die billigste Lösung.'],
        blind: ['Blind-Via', 'Beginnt auf einer Außenlage und endet in einer Innenlage, sie geht also nicht durch. Praktisch bei sehr dichten Bauteilen (z. B. BGA), weil darunter und dahinter Platz bleibt. Teurer, weil die Platine in mehreren Pressvorgängen entsteht und oft mit Laser gebohrt wird.'],
        buried: ['Buried-Via (vergrabenes Via)', 'Verbindet nur Innenlagen und ist von außen nicht zu sehen. Es wird gebohrt und verkupfert, bevor die Außenlagen aufgepresst werden. Das ist aufwendig und deshalb die teuerste Variante.']
      }[S.via] || ['', ''];
      return h('div', null,
        h('div', { class: 'pf-row' }, [['thru', 'Durchkontaktiert'], ['blind', 'Blind'], ['buried', 'Buried']].map(o => {
          const dis = o[0] !== 'thru' && (b.layers || 2) < 4;
          return h('button', { class: 'pf-chip' + (S.via === o[0] ? '' : ' off'), disabled: dis ? true : null, onclick: () => { S.via = o[0]; render(); },
            title: dis ? 'Blind- und Buried-Vias gibt es erst ab 4 Lagen' : '' }, o[1] + ' (' + cnt[o[0]] + ')');
        })),
        h('div', { class: 'pf-note' }, h('b', null, txt[0]), h('br'), txt[1]),
        (b.layers || 2) < 4 ? h('p', { class: 'pf-muted' }, 'Blind- und Buried-Vias brauchen Innenlagen und sind erst ab 4 Lagen möglich.') : null,
        cnt.blind + cnt.buried ? h('p', { class: 'pf-warn' }, 'Deine Platine enthält ' + (cnt.blind + cnt.buried) + ' Blind-/Buried-Via(s). Das erhöht den Preis und nicht jeder Hersteller bietet es an.') : null);
    }

    function stackChecks(b) {
      const out = [], n = b.layers || 2, ids = layerIds(n).filter(i => n !== 1 || i === 'B.Cu');
      if (n === 1) { out.push(['warn', 'Einseitige Platine: nur B.Cu führt Kupfer. Bauteile (THT) sitzen oben, Löten von unten. Brücken müssen als Drahtbrücke ausgeführt werden.']); return out; }
      if (n === 2) out.push(['ok', 'Zwei Lagen: Masse als Kupferfläche (Polygon-Pour) auf einer Seite hilft Rückströmen und EMV.']);
      if (n >= 4) {
        ids.forEach((id, i) => {
          if (roleOf(b, id) !== 'signal') return;
          const nb = [ids[i - 1], ids[i + 1]].filter(Boolean).map(q => roleOf(b, q));
          const hasPlane = nb.some(r => r !== 'signal');
          out.push([hasPlane ? 'ok' : 'warn', id + ' (Signal) ' + (hasPlane ? 'liegt neben einer Fläche: guter Rückweg.' : 'hat keine Fläche als Nachbar: Rückstrom unklar, Bahnen auf benachbarten Signallagen senkrecht kreuzen.')]);
        });
        const gl = ids.filter(i => roleOf(b, i) === 'gnd'), vl = ids.filter(i => roleOf(b, i) === 'vcc');
        if (!gl.length) out.push(['err', 'Keine Masselage zugewiesen. Ohne Massefläche fehlt der Rückweg für schnelle Signale.']);
        if (!vl.length) out.push(['warn', 'Keine Versorgungslage zugewiesen. Versorgung muss dann als Bahn oder Fläche auf Signallagen geführt werden.']);
        if (gl.length && vl.length && Math.abs(ids.indexOf(gl[0]) - ids.indexOf(vl[0])) === 1) out.push(['ok', 'Masse- und Versorgungsfläche liegen nebeneinander: geringe Induktivität, etwas Eigenkapazität.']);
        ids.filter(i => /^In/.test(i) && roleOf(b, i) !== 'signal').forEach(id => {
          if (!(b.zones || []).some(z => z.layer === id)) out.push(['warn', id + ' ist als ' + ROLE_NAME[roleOf(b, id)] + ' vorgesehen, hat aber noch keine Kupferfläche.']);
        });
        out.push(['ok', 'Der Aufbau ist symmetrisch zur Mitte (Kern in der Mitte), das verhindert Verzug beim Löten.']);
      }
      return out;
    }

    function tabAufbau() {
      const b = board(), n = b.layers || 2, ro = readonly();
      const r = sectionSvg();
      const left = h('div', { class: 'pf-card' },
        h('div', { class: 'pf-row' },
          h('span', { class: 'pf-lbl' }, 'Lagenzahl'),
          segCtl([[1, '1'], [2, '2'], [4, '4'], [6, '6']], n, v => setLayers(v), () => ro),
          h('span', { class: 'pf-sp' }),
          segCtl([[false, 'lesbar'], [true, 'maßstäblich']], S.scaled, v => { S.scaled = v; render(); })),
        r.svg,
        S.sel != null && r.st.rows[S.sel] ? (() => {
          const q = r.st.rows[S.sel];
          return h('div', { class: 'pf-note' }, h('b', null, q.name), ' – ' + (q.kind === 'copper' ? 'Kupfer' : q.kind === 'core' ? 'Kern (ausgehärtetes Glasgewebe/Epoxid)' : q.kind === 'prepreg' ? 'Prepreg (Glasgewebe mit Harz, verklebt beim Pressen die Lagen)' : q.kind === 'mask' ? 'Lötstopplack (grün, schützt vor Lötzinn)' : 'Siebdruck (Beschriftung)') + ', ' + fmt(q.thickness, q.thickness % 1 ? 1 : 0) + ' µm' + (q.kind === 'copper' ? ' (' + fmt(q.thickness / 35, 2) + ' oz)' : '') + (q.material ? ', Material: ' + q.material : '') + '.');
        })() : h('p', { class: 'pf-muted' }, 'Tippe auf eine Schicht für Details, auf ein Via für die Erklärung.'),
        r.st.src === 'lokal' ? h('p', { class: 'pf-muted' }, 'Hinweis: Lagenaufbau mit Standardwerten berechnet.') : null,
        viaInfo(b));
      const right = h('div', null);
      const roles = h('div', { class: 'pf-card' }, h('h3', null, 'Innenlagen zuweisen'));
      const inn = innerIds(n);
      if (!inn.length) roles.appendChild(h('p', { class: 'pf-muted' }, 'Bei ' + n + ' Lage' + (n === 1 ? '' : 'n') + ' gibt es keine Innenlagen. Wähle 4 oder 6 Lagen, um Masse- und Versorgungsflächen innen zu legen.'));
      inn.forEach(id => {
        const cur = roleOf(b, id), zs = (b.zones || []).filter(z => z.layer === id), tr = (b.tracks || []).filter(t => t.layer === id);
        roles.appendChild(h('div', { class: 'pf-row' },
          h('b', { style: 'min-width:56px' }, id.replace('.Cu', '')),
          segCtl([['signal', 'Signal'], ['gnd', 'Masse'], ['vcc', 'Versorgung']], cur, v => setRole(id, v), () => ro),
          h('span', { class: 'pf-muted' }, zs.length ? zs.length + ' Fläche(n)' : '', zs.length && tr.length ? ', ' : '', tr.length ? tr.length + ' Bahn(en)' : '')));
      });
      if (inn.length) roles.appendChild(h('p', { class: 'pf-muted' }, 'Eine Masse- oder Versorgungslage ist eine durchgehende Kupferfläche. Beim Zuweisen wird eine Fläche über die ganze Platine angelegt, wenn noch keine da ist.'));
      const chk = h('div', { class: 'pf-card' }, h('h3', null, 'Check deines Aufbaus'));
      stackChecks(b).forEach(c => chk.appendChild(h('div', { class: 'pf-note ' + c[0] }, (c[0] === 'ok' ? 'OK: ' : c[0] === 'err' ? 'Fehler: ' : 'Hinweis: ') + c[1])));
      right.appendChild(roles); right.appendChild(chk);
      return h('div', { class: 'pf-split' }, left, right);
    }

    // ---------- Impedanz
    function impGeom(p) {
      const W = 300, Hh = 150;
      const svg = sv('svg', { class: 'pf-svg', viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', style: 'max-width:360px;margin:6px auto', 'aria-label': 'Querschnitt der Leiterbahn' });
      const strip = p.mode === 'strip';
      const hs = clamp(p.h * 60, 14, 52), ws = clamp(p.w * 60, 6, 130), ts = clamp(p.t / 35 * 6, 3, 12);
      const cx = W / 2, mid = Hh / 2;
      if (!strip) {
        const yb = mid + 8;
        svg.appendChild(sv('rect', { x: 20, y: yb, width: W - 40, height: hs, fill: COL.core }));
        svg.appendChild(sv('rect', { x: 20, y: yb + hs, width: W - 40, height: 8, fill: COL.cu }));
        svg.appendChild(sv('text', { x: 24, y: yb + hs + 7, fill: '#10161c', 'font-size': 8, 'font-weight': 700 }, 'Massefläche'));
        svg.appendChild(sv('rect', { x: cx - ws / 2, y: yb - ts, width: ws, height: ts, fill: COL.cu }));
        svg.appendChild(sv('text', { x: cx, y: yb - ts - 6, 'text-anchor': 'middle', fill: '#e8edf2', 'font-size': 11 }, 'Leiterbahn w'));
        svg.appendChild(sv('line', { x1: cx + ws / 2 + 14, y1: yb, x2: cx + ws / 2 + 14, y2: yb + hs, stroke: C_ACC, 'stroke-width': 1.5 }));
        svg.appendChild(sv('text', { x: cx + ws / 2 + 20, y: yb + hs / 2 + 4, fill: '#7fc0ff', 'font-size': 11 }, 'h'));
        svg.appendChild(sv('text', { x: cx, y: Hh - 6, 'text-anchor': 'middle', fill: '#8b97a3', 'font-size': 10 }, 'Mikrostreifen: außen, Luft darüber'));
      } else {
        const y0 = mid - hs - ts / 2;
        svg.appendChild(sv('rect', { x: 20, y: y0 - 8, width: W - 40, height: 8, fill: COL.cu }));
        svg.appendChild(sv('rect', { x: 20, y: y0, width: W - 40, height: 2 * hs + ts, fill: COL.core }));
        svg.appendChild(sv('rect', { x: 20, y: y0 + 2 * hs + ts, width: W - 40, height: 8, fill: COL.cu }));
        svg.appendChild(sv('rect', { x: cx - ws / 2, y: mid - ts / 2, width: ws, height: ts, fill: COL.cu }));
        svg.appendChild(sv('text', { x: cx, y: mid - ts / 2 - 4, 'text-anchor': 'middle', fill: '#10161c', 'font-size': 10, 'font-weight': 700 }, 'w'));
        svg.appendChild(sv('line', { x1: cx + ws / 2 + 14, y1: mid + ts / 2, x2: cx + ws / 2 + 14, y2: mid + ts / 2 + hs, stroke: C_ACC, 'stroke-width': 1.5 }));
        svg.appendChild(sv('text', { x: cx + ws / 2 + 20, y: mid + ts / 2 + hs / 2 + 4, fill: '#10161c', 'font-size': 11, 'font-weight': 700 }, 'h'));
        svg.appendChild(sv('text', { x: cx, y: Hh - 6, 'text-anchor': 'middle', fill: '#8b97a3', 'font-size': 10 }, 'Stripline: innen zwischen zwei Flächen'));
      }
      return svg;
    }
    function impPlot(p, z0) {
      const W = 300, Hh = 140, L = 34, B = 22, T = 8, R = 8;
      const svg = sv('svg', { class: 'pf-svg', viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', style: 'max-width:360px;margin:6px auto', 'aria-label': 'Wellenwiderstand über der Bahnbreite' });
      const wmin = 0.05, wmax = 3, zmax = 150;
      const X = w => L + (Math.log(w / wmin) / Math.log(wmax / wmin)) * (W - L - R), Y = z => Hh - B - clamp(z, 0, zmax) / zmax * (Hh - B - T);
      [25, 50, 75, 100, 125].forEach(z => {
        svg.appendChild(sv('line', { x1: L, y1: Y(z), x2: W - R, y2: Y(z), stroke: z === 50 ? 'rgba(76,217,100,.6)' : '#2c343e', 'stroke-width': 1 }));
        svg.appendChild(sv('text', { x: L - 4, y: Y(z) + 4, 'text-anchor': 'end', fill: '#8b97a3', 'font-size': 9 }, String(z)));
      });
      [0.1, 0.3, 1, 3].forEach(w => svg.appendChild(sv('text', { x: X(w), y: Hh - 8, 'text-anchor': 'middle', fill: '#8b97a3', 'font-size': 9 }, fmt(w, w < 1 ? 1 : 0) + ' mm')));
      let d = '';
      for (let i = 0; i <= 60; i++) {
        const w = wmin * Math.pow(wmax / wmin, i / 60), z = zOf(p.mode, Object.assign({}, p, { w }));
        if (isFinite(z)) d += (d ? 'L' : 'M') + X(w).toFixed(1) + ' ' + Y(z).toFixed(1);
      }
      svg.appendChild(sv('path', { d, fill: 'none', stroke: C_ACC, 'stroke-width': 2 }));
      if (isFinite(z0)) svg.appendChild(sv('circle', { cx: X(clamp(p.w, wmin, wmax)), cy: Y(z0), r: 5, fill: C_WARN, stroke: '#10161c' }));
      svg.appendChild(sv('text', { x: W - R, y: T + 8, 'text-anchor': 'end', fill: '#8b97a3', 'font-size': 9 }, 'Z0 in Ω über Bahnbreite w'));
      return svg;
    }
    function tabImpedanz() {
      const p = S.imp, card = h('div', { class: 'pf-card' }), res = h('div', { class: 'pf-card' });
      const out = { z: h('div', { class: 'pf-big' }), bar: h('div', { class: 'pf-bar' }, h('div')), txt: h('div', { class: 'pf-note' }), geom: h('div'), plot: h('div'), delay: h('p', { class: 'pf-muted' }) };
      const upd = () => {
        const z = zOf(p.mode, p);
        out.z.textContent = isFinite(z) ? fmt(z, 1) + ' Ω' : '– (Maße außerhalb des Gültigkeitsbereichs)';
        out.z.style.color = isFinite(z) && Math.abs(z - p.target) <= p.target * 0.1 ? C_OK : '#7fc0ff';
        out.bar.firstChild.style.width = clamp((isFinite(z) ? z : 0) / 150 * 100, 0, 100) + '%';
        out.bar.firstChild.style.background = isFinite(z) && Math.abs(z - p.target) <= p.target * 0.1 ? C_OK : C_ACC;
        const dz = isFinite(z) ? z - p.target : 0;
        out.txt.className = 'pf-note' + (isFinite(z) ? (Math.abs(dz) <= p.target * 0.1 ? ' ok' : ' warn') : ' err');
        out.txt.textContent = !isFinite(z) ? 'Die Näherungsformel gilt nur für Bahnen, die nicht viel breiter als die Höhe sind. Verkleinere w oder vergrößere h.' :
          Math.abs(dz) <= p.target * 0.1 ? 'Treffer: innerhalb von ±10 % um ' + p.target + ' Ω. Signal und Leitung passen zueinander, Reflexionen bleiben klein.' :
            dz > 0 ? 'Zu hoch um ' + fmt(dz, 1) + ' Ω. Bahn breiter machen oder die Masse näher heranrücken (h kleiner).' : 'Zu niedrig um ' + fmt(-dz, 1) + ' Ω. Bahn schmaler machen oder h vergrößern.';
        out.geom.replaceChildren(impGeom(p));
        out.plot.replaceChildren(impPlot(p, z));
        const eff = p.mode === 'strip' ? p.er : 0.475 * p.er + 0.67;
        const ps = Math.sqrt(eff) / 0.2998;
        out.delay.textContent = 'Signallaufzeit ca. ' + fmt(ps, 1) + ' ps pro mm (≈ ' + fmt(1 / ps * 1000 / 10, 1) + ' cm/ns). ' + (p.mode === 'micro' ? 'Außen läuft das Signal etwas schneller als innen, weil ein Teil des Feldes in der Luft liegt.' : '');
      };
      card.appendChild(h('h3', null, 'Impedanzrechner'));
      card.appendChild(h('div', { class: 'pf-row' }, segCtl([['micro', 'Mikrostreifen (außen)'], ['strip', 'Stripline (innen)']], p.mode, v => { p.mode = v; mode.update(); upd(); })));
      const mode = { update() { sw.set(p.w); sh.set(p.h); } };
      const sw = slider('Bahnbreite w', 0.05, 3, 0.01, p.w, v => fmt(v, 2) + ' mm', v => { p.w = v; upd(); });
      const sh = slider('Höhe h zur Masse', 0.05, 1.6, 0.01, p.h, v => fmt(v, 2) + ' mm', v => { p.h = v; upd(); });
      const ser = slider('Dielektrizitätszahl εr', 2.2, 10, 0.1, p.er, v => fmt(v, 1), v => { p.er = v; upd(); });
      const tsel = h('select', { class: 'pf-sel', 'aria-label': 'Kupferdicke' }, [[17.5, '0,5 oz (17,5 µm)'], [35, '1 oz (35 µm)'], [70, '2 oz (70 µm)']].map(o => h('option', { value: o[0], selected: o[0] === p.t ? true : null }, o[1])));
      tsel.addEventListener('change', () => { p.t = parseFloat(tsel.value); upd(); });
      const stg = slider('Ziel-Z0', 25, 120, 1, p.target, v => v + ' Ω', v => { p.target = v; upd(); });
      card.appendChild(sw); card.appendChild(sh); card.appendChild(ser);
      card.appendChild(h('div', { class: 'pf-row' }, h('span', { class: 'pf-lbl' }, 'Kupferdicke t'), tsel,
        h('span', { class: 'pf-sp' }),
        h('button', { class: 'pf-chip', onclick: () => { p.er = 4.3; ser.set(4.3); upd(); } }, 'FR-4 ≈ 4,3'),
        h('button', { class: 'pf-chip', onclick: () => { p.er = 3.5; ser.set(3.5); upd(); } }, 'Hochfrequenz ≈ 3,5')));
      card.appendChild(stg);
      const solveW = () => {
        let lo = 0.03, hi = 6;
        for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2, z = zOf(p.mode, Object.assign({}, p, { w: m })); if (isFinite(z) && z > p.target) lo = m; else hi = m; }
        p.w = clamp((lo + hi) / 2, 0.05, 3);
      };
      card.appendChild(h('div', { class: 'pf-row' },
        h('button', { class: 'pf-btn pri', onclick: () => { solveW(); sw.set(p.w); upd(); fx(ctx, 'click'); } }, 'Breite für Ziel-Z0 berechnen'),
        h('button', { class: 'pf-btn', onclick: () => {
          const st = normStack(board()), rows = st.rows, ci = rows.findIndex(r => r.kind === 'copper');
          const nx = rows.slice(ci + 1).find(r => r.kind === 'prepreg' || r.kind === 'core');
          if (ci >= 0 && nx) {
            p.h = clamp(nx.thickness / 1000, 0.05, 1.6); p.t = rows[ci].thickness < 25 ? 17.5 : rows[ci].thickness > 50 ? 70 : 35; p.mode = 'micro'; solveW();
            render(); toast(ctx, 'Aus dem Lagenaufbau übernommen: h = ' + fmt(p.h, 2) + ' mm, Bahnbreite für ' + p.target + ' Ω = ' + fmt(p.w, 2) + ' mm.');
          }
        } }, 'Aus Lagenaufbau übernehmen')));
      res.appendChild(h('h3', null, 'Ergebnis'));
      res.appendChild(out.z); res.appendChild(out.bar); res.appendChild(out.txt); res.appendChild(out.delay);
      res.appendChild(out.geom); res.appendChild(out.plot);
      res.appendChild(h('p', { class: 'pf-muted' }, 'Grobe Näherungsformeln (IPC-Art). Für echte Platinen rechnet der Hersteller mit einem Feldlöser nach. Typische Ziele: 50 Ω für Einzelleitungen, 90 bis 100 Ω für differentielle Paare (z. B. USB).'));
      upd();
      return h('div', { class: 'pf-grid' }, card, res);
    }

    // ---------- Wissen
    function figRet() {
      const p = S, W = 300, Hh = 134;
      const svg = sv('svg', { class: 'pf-svg', viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': 'Rückstrompfad mit und ohne Schlitz in der Massefläche' });
      svg.appendChild(sv('rect', { x: 10, y: 20, width: W - 20, height: 90, fill: '#2a4a73', rx: 4 }));
      svg.appendChild(sv('text', { x: 16, y: 34, fill: '#bfe0ff', 'font-size': 10 }, 'Massefläche (von oben gesehen)'));
      if (p.slot) svg.appendChild(sv('rect', { x: 140, y: 38, width: 14, height: 56, fill: '#14181c' }));
      svg.appendChild(sv('line', { x1: 14, y1: 65, x2: W - 14, y2: 65, stroke: COL.cu, 'stroke-width': 5, 'stroke-linecap': 'round' }));
      svg.appendChild(sv('text', { x: 20, y: 56, fill: '#f0c060', 'font-size': 10 }, 'Signal →'));
      const ret = p.slot ? 'M286 71 L170 71 L170 96 L124 96 L124 71 L14 71' : 'M286 71 L14 71';
      svg.appendChild(sv('path', { d: ret, fill: 'none', stroke: p.slot ? C_ERR : C_OK, 'stroke-width': 2.5, class: 'pf-dash' }));
      svg.appendChild(sv('text', { x: 14, y: 126, fill: p.slot ? '#ffb3ba' : '#9fe6b0', 'font-size': 10 }, p.slot ? '← Rückstrom muss ums Hindernis: große Schleife' : '← Rückstrom folgt direkt unter der Bahn'));
      return svg;
    }
    function figXt() {
      const d = S.xt.d, hh = S.xt.h, k = 1 / (1 + Math.pow(d / hh, 2)), W = 300, Hh = 110;
      const svg = sv('svg', { class: 'pf-svg', viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': 'Übersprechen zwischen zwei Bahnen' });
      const gap = clamp(d * 30, 6, 110), w1 = W / 2 - gap / 2 - 6, w2 = W / 2 + gap / 2 + 6;
      svg.appendChild(sv('rect', { x: 10, y: 30, width: W - 20, height: 34, fill: COL.core }));
      svg.appendChild(sv('rect', { x: 10, y: 64, width: W - 20, height: 8, fill: COL.cu }));
      svg.appendChild(sv('rect', { x: w1 - 12, y: 24, width: 12, height: 6, fill: COL.cu }));
      svg.appendChild(sv('rect', { x: w2, y: 24, width: 12, height: 6, fill: COL.cu }));
      svg.appendChild(sv('text', { x: w1 - 6, y: 16, 'text-anchor': 'middle', fill: '#f0c060', 'font-size': 10 }, 'schnell'));
      svg.appendChild(sv('text', { x: w2 + 6, y: 16, 'text-anchor': 'middle', fill: '#aab6c3', 'font-size': 10 }, 'Opfer'));
      svg.appendChild(sv('path', { d: 'M' + (w1 + 4) + ' 28 Q' + W / 2 + ' ' + (28 - 16 * k - 2) + ' ' + (w2 - 4) + ' 28', fill: 'none', stroke: C_ERR, 'stroke-width': 1 + 3 * k, opacity: 0.4 + 0.6 * k }));
      svg.appendChild(sv('text', { x: W / 2, y: 96, 'text-anchor': 'middle', fill: k > 0.3 ? '#ffb3ba' : '#9fe6b0', 'font-size': 11 }, 'Kopplung grob ' + fmt(k * 100, 0) + ' % (Faustwert 1/(1+(d/h)²))'));
      return svg;
    }
    function tabWissen() {
      const wrap = h('div', null);
      const b = board();
      WISSEN.forEach(c => {
        const d = h('details', { class: 'pf-card pf-acc' }, h('summary', null, c.t));
        if (S.open[c.id] || (!Object.keys(S.open).length && c.id === 'gnd')) d.setAttribute('open', '');
        d.addEventListener('toggle', () => { S.open[c.id] = d.open; });
        c.p.forEach(t => d.appendChild(h('p', null, t)));
        if (c.list) d.appendChild(h('ul', { style: 'margin:0 0 8px;padding-left:20px;color:#c9d2dc' }, c.list.map(x => h('li', { style: 'margin:3px 0' }, x))));
        if (c.fig === 'ret') {
          const holder = h('div', null, figRet());
          d.appendChild(holder);
          d.appendChild(h('div', { class: 'pf-row' }, h('button', { class: 'pf-btn' + (S.slot ? ' warn' : ''), onclick: () => { S.slot = !S.slot; holder.replaceChildren(figRet()); fx(ctx, S.slot ? 'squeak' : 'click'); } }, S.slot ? 'Schlitz wieder schließen' : 'Schlitz in die Massefläche schneiden')));
        }
        if (c.fig === 'xt') {
          const holder = h('div', null, figXt());
          d.appendChild(holder);
          d.appendChild(slider('Abstand d', 0.1, 3, 0.05, S.xt.d, v => fmt(v, 2) + ' mm', v => { S.xt.d = v; holder.replaceChildren(figXt()); }));
          d.appendChild(slider('Höhe h zur Masse', 0.05, 1, 0.05, S.xt.h, v => fmt(v, 2) + ' mm', v => { S.xt.h = v; holder.replaceChildren(figXt()); }));
          d.appendChild(h('p', { class: 'pf-muted' }, 'Je näher die Masse (kleines h), desto schneller fällt die Kopplung mit dem Abstand ab.'));
        }
        if (c.id === 'four') {
          const n = b.layers || 2;
          d.appendChild(h('div', { class: 'pf-note' }, 'Deine Platine hat ' + n + ' Lage' + (n === 1 ? '' : 'n') + '. ' + (n >= 4 ? 'Sie nutzt Innenlagen als Fläche.' : 'Im Reiter "Aufbau" kannst du auf 4 Lagen umstellen und das Ergebnis sehen.')));
        }
        wrap.appendChild(d);
      });
      return wrap;
    }

    function render() {
      if (!alive) return;
      const keepScroll = bodyEl ? bodyEl.scrollTop : 0;
      rootEl.replaceChildren();
      rootEl.appendChild(tabsBar([['aufbau', 'Aufbau'], ['imp', 'Impedanz'], ['wissen', 'Wissen']], S.tab, t => { S.tab = t; lsSet('stack.tab', t); render(); }));
      bodyEl = h('div', { class: 'pf-body' });
      try { bodyEl.appendChild(S.tab === 'imp' ? tabImpedanz() : S.tab === 'wissen' ? tabWissen() : tabAufbau()); }
      catch (e) { bodyEl.appendChild(h('div', { class: 'pf-note err' }, 'Anzeige nicht möglich: ' + (e && e.message))); }
      rootEl.appendChild(bodyEl);
      bodyEl.scrollTop = keepScroll;
    }
    render();
    return {
      refresh() { if (alive && !S.busy) render(); },
      onShow() { render(); },
      onBoard() { S.sel = null; render(); },
      destroy() { alive = false; rootEl.remove(); }
    };
  }

  // ================================================================== Gerber: ZIP, Klassifizierung, Rendering
  let CRC_T = null;
  function crc32(u8) {
    if (!CRC_T) { CRC_T = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c >>> 0; } }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  // Store-ZIP (Methode 0, keine Kompression), Namen UTF-8
  function makeZip(entries) {
    const enc = new TextEncoder(), parts = [], cen = [];
    const d = new Date();
    const dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
    const dd = (((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    let off = 0;
    entries.forEach(e => {
      const nm = enc.encode(e.name), data = e.data, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true); lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), nm, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true); ch.setUint16(28, nm.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, off, true);
      cen.push(new Uint8Array(ch.buffer), nm);
      off += 30 + nm.length + data.length;
    });
    let cs = 0; cen.forEach(c => { cs += c.length; });
    const eo = new DataView(new ArrayBuffer(22));
    eo.setUint32(0, 0x06054b50, true); eo.setUint16(4, 0, true); eo.setUint16(6, 0, true); eo.setUint16(8, entries.length, true);
    eo.setUint16(10, entries.length, true); eo.setUint32(12, cs, true); eo.setUint32(16, off, true); eo.setUint16(20, 0, true);
    return new Blob(parts.concat(cen, [new Uint8Array(eo.buffer)]), { type: 'application/zip' });
  }
  function canDownload() { return !!(root.LabExport && root.LabExport.saveBlob) || !!(root.Blob && root.URL && root.URL.createObjectURL); }
  async function downloadBlob(blob, name) {
    if (root.LabExport && root.LabExport.saveBlob) { await root.LabExport.saveBlob(blob, name); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  const GM = {
    fcu: { id: 'F.Cu', title: 'Kupfer oben (Top Copper)', col: '#d94a4a', ord: 30, purpose: 'Leiterbahnen, Pads und Kupferflächen der Oberseite. Daraus entsteht beim Ätzen die obere Kupferstruktur.', clue: 'Eine einzige Kupferstruktur mit Bahnen, Pads und Flächen. Pads für Bohrungen und SMD sind enthalten.' },
    bcu: { id: 'B.Cu', title: 'Kupfer unten (Bottom Copper)', col: '#4a86e8', ord: 0, alpha: 0.85, purpose: 'Leiterbahnen, Pads und Kupferflächen der Unterseite.', clue: 'Wie die obere Kupferlage, aber für die Unterseite (hier wie von oben durchgesehen gezeichnet).' },
    in1: { id: 'In1.Cu', title: 'Innenlage 1 (Inner Copper 1)', col: '#5dbb63', ord: 28, alpha: 0.65, purpose: 'Erste Innenlage, oft die Masse- oder Versorgungsfläche. Liegt im Inneren der Platine.', clue: 'Meist eine große Fläche mit Ausschnitten um Durchkontaktierungen und mit Wärmefallen (Thermals).' },
    in2: { id: 'In2.Cu', title: 'Innenlage 2 (Inner Copper 2)', col: '#e6a23c', ord: 26, alpha: 0.65, purpose: 'Zweite Innenlage.', clue: 'Innenlage: keine SMD-Pads, nur Flächen und Anschlüsse an Bohrungen.' },
    in3: { id: 'In3.Cu', title: 'Innenlage 3 (Inner Copper 3)', col: '#a77de0', ord: 24, alpha: 0.65, purpose: 'Dritte Innenlage (nur bei 6 Lagen).', clue: 'Innenlage: keine SMD-Pads, nur Flächen und Anschlüsse an Bohrungen.' },
    in4: { id: 'In4.Cu', title: 'Innenlage 4 (Inner Copper 4)', col: '#3cc9c9', ord: 22, alpha: 0.65, purpose: 'Vierte Innenlage (nur bei 6 Lagen).', clue: 'Innenlage: keine SMD-Pads, nur Flächen und Anschlüsse an Bohrungen.' },
    fmask: { id: 'F.Mask', title: 'Lötstopplack oben (Top Solder Mask)', col: '#37c26a', ord: 40, alpha: 0.55, purpose: 'Zeigt, wo der Lack NICHT liegt: Öffnungen über den Pads. Alles andere wird grün lackiert.', clue: 'Nur Öffnungen, etwas größer als die Pads. Keine Bahnen.' },
    bmask: { id: 'B.Mask', title: 'Lötstopplack unten (Bottom Solder Mask)', col: '#2aa6a0', ord: 5, alpha: 0.55, purpose: 'Lackaussparungen der Unterseite.', clue: 'Nur Öffnungen, etwas größer als die Pads, für die Unterseite.' },
    fpaste: { id: 'F.Paste', title: 'Lotpaste oben (Top Paste)', col: '#c4c4c4', ord: 50, purpose: 'Schablone für den Lotpastendruck: Öffnungen nur über SMD-Pads der Oberseite.', clue: 'Nur SMD-Pads, keine Bohrungen (THT-Pads fehlen), meist leicht kleiner als das Pad.' },
    bpaste: { id: 'B.Paste', title: 'Lotpaste unten (Bottom Paste)', col: '#8fa0ad', ord: 6, purpose: 'Pastenschablone für die Unterseite.', clue: 'Nur SMD-Pads, Unterseite.' },
    fsilk: { id: 'F.Silk', title: 'Siebdruck oben (Top Silkscreen)', col: '#f4efb0', ord: 60, purpose: 'Bestückungsdruck: Bauteilumrisse, Referenzen (R1, C2), Polaritätsmarken.', clue: 'Dünne Linien, Umrisse und Beschriftung. Keine Flächen.' },
    bsilk: { id: 'B.Silk', title: 'Siebdruck unten (Bottom Silkscreen)', col: '#e8b4c0', ord: 7, purpose: 'Bestückungsdruck der Unterseite.', clue: 'Dünne Linien und Beschriftung der Unterseite.' },
    edge: { id: 'Edge', title: 'Platinenumriss (Board Outline)', col: '#f0d040', ord: 70, purpose: 'Außenkontur der Platine. Danach fräst oder ritzt der Hersteller.', clue: 'Nur eine geschlossene Umrisslinie.' },
    pth: { id: 'PTH', title: 'Bohrungen mit Durchkontaktierung (PTH)', col: '#e8edf2', ord: 80, drill: true, purpose: 'Excellon-Bohrdatei für Löcher, die innen verkupfert werden (Bauteilbeine, Vias).', clue: 'Nur Kreise unterschiedlicher Größe, die später Kupfer in der Wand bekommen.' },
    npth: { id: 'NPTH', title: 'Bohrungen ohne Kupfer (NPTH)', col: '#9fb0c2', ord: 81, drill: true, purpose: 'Excellon-Bohrdatei für unmetallisierte Löcher, z. B. Montagelöcher.', clue: 'Nur Kreise, ohne Kupferwand: Löcher für Schrauben und Halterungen.' }
  };
  const EXT_PREF = { fcu: '.gtl', bcu: '.gbl', fmask: '.gts', bmask: '.gbs', fpaste: '.gtp', bpaste: '.gbp', fsilk: '.gto', bsilk: '.gbo', edge: '.gm1', pth: '.drl', npth: '.drl', in1: '.g2', in2: '.g3', in3: '.g4', in4: '.g5' };
  function classify(name) {
    const n = String(name).replace(/\\/g, '/').split('/').pop();
    const m = n.match(/In(\d)[._]Cu/i);
    if (m && GM['in' + m[1]]) return 'in' + m[1];
    const tests = [['fcu', /F[._]Cu|\.gtl$/i], ['bcu', /B[._]Cu|\.gbl$/i], ['fmask', /F[._]Mask|\.gts$/i], ['bmask', /B[._]Mask|\.gbs$/i],
      ['fpaste', /F[._]Paste|\.gtp$/i], ['bpaste', /B[._]Paste|\.gbp$/i], ['fsilk', /F[._]Silk|\.gto$/i], ['bsilk', /B[._]Silk|\.gbo$/i],
      ['edge', /Edge|\.gm1$|\.gko$|\.gml$/i], ['npth', /NPTH/i], ['pth', /PTH|\.drl$|\.xln$/i]];
    for (const t of tests) if (t[1].test(n)) return t[0];
    return null;
  }
  const extOf = n => { const m = String(n).match(/(\.[A-Za-z0-9]+)$/); return m ? m[1].toLowerCase() : ''; };
  const YUP = true;   // Gerber-Koordinaten haben y nach oben; Anzeige wie in Gerber-Viewern

  function apInfo(P, ap) {
    let a = ap;
    if (a == null) return null;
    if (typeof a !== 'object') {
      const A = P && P.apertures;
      if (A) {
        a = A[a];
        if (a == null && typeof ap === 'number') a = A['D' + ap];
        if (a == null && typeof ap === 'string') a = A[ap.replace(/^D/i, '')] != null ? A[ap.replace(/^D/i, '')] : A['D' + ap];
        if (a == null && Array.isArray(A)) a = A.find(x => x && (x.code == ap || x.id == ap || x.n == ap || x.d == ap));
      }
    }
    if (!a) return null;
    const shape = String(a.shape || a.type || a.t || a.kind || a.s || 'C').toUpperCase()[0];
    const m = a.mods || a.params || a.p || a.args || a.size || [];
    const num = v => (v == null || v === '' ? NaN : +v);
    let d = num(a.d != null ? a.d : a.dia != null ? a.dia : a.diameter), w = num(a.w != null ? a.w : a.width != null ? a.width : a.x), hh = num(a.h != null ? a.h : a.height != null ? a.height : a.y);
    if (!isFinite(d)) d = num(m[0]);
    if (!isFinite(w)) w = num(m[0]);
    if (!isFinite(hh)) hh = isFinite(num(m[1])) ? num(m[1]) : w;
    if (shape === 'C') { const dd = isFinite(d) ? d : w; return { s: 'C', d: isFinite(dd) && dd > 0 ? dd : 0.1 }; }
    const ww = isFinite(w) ? w : d;
    return { s: shape === 'O' ? 'O' : 'R', w: isFinite(ww) && ww > 0 ? ww : 0.1, h: isFinite(hh) && hh > 0 ? hh : (isFinite(ww) ? ww : 0.1) };
  }
  const ptXY = p => Array.isArray(p) ? [+p[0], +p[1]] : [+p.x, +p.y];

  // Datei einlesen -> { ops (aufbereitet), bbox } | { holes, bbox }
  function loadGerberFile(name, text, key) {
    const c = CORE(), f = { name, key, text, bytes: new TextEncoder().encode(text).length, meta: GM[key] || null, ext: extOf(name), ops: [], holes: [], bbox: null, err: null, units: 'mm' };
    const bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const ext = (x, y, r) => { if (isFinite(x) && isFinite(y)) { bb.x0 = Math.min(bb.x0, x - r); bb.y0 = Math.min(bb.y0, y - r); bb.x1 = Math.max(bb.x1, x + r); bb.y1 = Math.max(bb.y1, y + r); } };
    try {
      if (GM[key] && GM[key].drill) {
        const hs = c.parseDrill(text) || [];
        f.holes = hs.map(o => ({ x: +o.x, y: +o.y, d: +o.d })).filter(o => isFinite(o.x) && isFinite(o.y) && isFinite(o.d));
        f.holes.forEach(o => ext(o.x, o.y, o.d / 2));
      } else {
        const P = c.parseGerber(text) || {};
        const sc = P.units && /^in/i.test(String(P.units)) ? 25.4 : 1;
        f.units = P.units || 'mm';
        (P.ops || []).forEach(op => {
          const o = { t: op.t, a: apInfo(P, op.ap), clear: /^c/i.test(String(op.polarity == null ? 'D' : op.polarity)) || op.polarity === false, x: sc * op.x, y: sc * op.y, x2: sc * op.x2, y2: sc * op.y2, pts: null };
          if (o.a && sc !== 1) { if (o.a.d) o.a.d *= sc; if (o.a.w) { o.a.w *= sc; o.a.h *= sc; } }
          if (op.t === 'region') {
            o.pts = (op.pts || []).map(p => { const q = ptXY(p); return [q[0] * sc, q[1] * sc]; });
            o.pts.forEach(p => ext(p[0], p[1], 0));
          } else if (op.t === 'draw') {
            const r = o.a ? (o.a.d || o.a.w || 0.1) / 2 : 0.05; ext(o.x, o.y, r); ext(o.x2, o.y2, r);
          } else if (op.t === 'flash') {
            const r = o.a ? (o.a.s === 'C' ? o.a.d / 2 : Math.max(o.a.w, o.a.h) / 2) : 0.1; ext(o.x, o.y, r);
          }
          f.ops.push(o);
        });
      }
    } catch (e) { f.err = e && e.message ? e.message : String(e); }
    f.bbox = isFinite(bb.x0) ? bb : null;
    return f;
  }

  function drawGerberOps(g, f, tr, color) {
    g.fillStyle = color; g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
    const s = tr.s;
    let clr = false;
    for (let i = 0; i < f.ops.length; i++) {
      const o = f.ops[i];
      if (o.clear !== clr) { clr = o.clear; g.globalCompositeOperation = clr ? 'destination-out' : 'source-over'; }
      if (o.t === 'region' && o.pts && o.pts.length > 2) {
        g.beginPath();
        for (let k = 0; k < o.pts.length; k++) { const X = tr.x(o.pts[k][0]), Y = tr.y(o.pts[k][1]); if (k) g.lineTo(X, Y); else g.moveTo(X, Y); }
        g.closePath(); g.fill();
      } else if (o.t === 'draw') {
        g.lineWidth = Math.max(1, (o.a ? (o.a.d || Math.min(o.a.w, o.a.h)) : 0.1) * s);
        g.beginPath(); g.moveTo(tr.x(o.x), tr.y(o.y)); g.lineTo(tr.x(o.x2), tr.y(o.y2)); g.stroke();
      } else if (o.t === 'flash') {
        const X = tr.x(o.x), Y = tr.y(o.y), a = o.a || { s: 'C', d: 0.2 };
        if (a.s === 'C') { g.beginPath(); g.arc(X, Y, Math.max(0.8, a.d * s / 2), 0, 6.2832); g.fill(); }
        else {
          const w = Math.max(1.5, a.w * s), hh = Math.max(1.5, a.h * s);
          if (a.s === 'O') {
            const r = Math.min(w, hh) / 2; g.beginPath();
            if (g.roundRect) g.roundRect(X - w / 2, Y - hh / 2, w, hh, r); else g.rect(X - w / 2, Y - hh / 2, w, hh);
            g.fill();
          } else g.fillRect(X - w / 2, Y - hh / 2, w, hh);
        }
      }
    }
    g.globalCompositeOperation = 'source-over';
  }

  // Betrachter (Canvas mit Pan/Zoom). opts: { mode:'view'|'drill'|'quiz', onInfo }
  function makeViewer(parent, st, opts) {
    const V = { cx: 0, cy: 0, scale: 5, flip: false, fitted: false, touched: false };
    const offs = {};
    let raf = 0, dead = false;
    const info = h('div', { class: 'pf-muted', style: 'min-height:18px;margin-top:4px' }, ' ');
    const wrap = h('div', null);
    parent.appendChild(wrap);
    const cvo = autoCanvas(wrap, 0.78, draw, 260);
    wrap.appendChild(info);
    const cv = cvo.cv;
    cvo.onResize = () => { if (!V.touched) V.fitted = false; };

    function bboxAll() {
      const e = st.files.find(f => f.key === 'edge' && f.bbox);
      if (e) return e.bbox;
      const bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      st.files.forEach(f => { if (f.bbox) { bb.x0 = Math.min(bb.x0, f.bbox.x0); bb.y0 = Math.min(bb.y0, f.bbox.y0); bb.x1 = Math.max(bb.x1, f.bbox.x1); bb.y1 = Math.max(bb.y1, f.bbox.y1); } });
      return isFinite(bb.x0) ? bb : { x0: 0, y0: 0, x1: 50, y1: 40 };
    }
    function fit() {
      const bb = bboxAll(), w = Math.max(1, bb.x1 - bb.x0), hh = Math.max(1, bb.y1 - bb.y0);
      V.cx = (bb.x0 + bb.x1) / 2; V.cy = (bb.y0 + bb.y1) / 2;
      V.scale = Math.min((cvo.w - 24) / w, (cvo.h - 24) / hh); V.fitted = true;
    }
    function tr() {
      const k = V.flip ? -1 : 1, W = cvo.w, H = cvo.h;
      return { s: V.scale, x: X => W / 2 + (X - V.cx) * V.scale * k, y: Y => H / 2 + (YUP ? -1 : 1) * (Y - V.cy) * V.scale, inv: (px, py) => [V.cx + (px - W / 2) / (V.scale * k), V.cy + (YUP ? -1 : 1) * (py - H / 2) / V.scale] };
    }
    function offFor(key) {
      let o = offs[key];
      if (!o) o = offs[key] = document.createElement('canvas');
      if (o.width !== cv.width || o.height !== cv.height) { o.width = cv.width; o.height = cv.height; }
      const g = o.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, o.width, o.height); g.setTransform(cvo.dpr, 0, 0, cvo.dpr, 0, 0);
      return [o, g];
    }
    function drawGrid(g, T) {
      const px = V.scale; let step = 1;
      if (px * 1 < 7) step = px * 5 < 7 ? 10 : 5;
      const a = T.inv(0, 0), b = T.inv(cvo.w, cvo.h);
      const x0 = Math.floor(Math.min(a[0], b[0]) / step) * step, x1 = Math.max(a[0], b[0]), y0 = Math.floor(Math.min(a[1], b[1]) / step) * step, y1 = Math.max(a[1], b[1]);
      if ((x1 - x0) / step > 200 || (y1 - y0) / step > 200) return;
      g.fillStyle = 'rgba(160,180,200,.16)';
      for (let x = x0; x <= x1; x += step) for (let y = y0; y <= y1; y += step) g.fillRect(T.x(x) - 0.75, T.y(y) - 0.75, 1.5, 1.5);
    }
    function drawHoles(g, T, list, colorFor, ring) {
      list.forEach(f => f.holes.forEach(o => {
        const r = Math.max(1.6, o.d * V.scale / 2), X = T.x(o.x), Y = T.y(o.y);
        g.beginPath(); g.arc(X, Y, r, 0, 6.2832); g.fillStyle = '#05070a'; g.fill();
        g.lineWidth = Math.max(1.2, r * 0.18); g.strokeStyle = colorFor(f, o); g.stroke();
      }));
    }
    function draw(g) {
      if (!V.fitted) fit();
      const T = tr(), W = cvo.w, H = cvo.h;
      g.fillStyle = '#0b0e12'; g.fillRect(0, 0, W, H);
      drawGrid(g, T);
      const mode = opts.mode;
      let list;
      if (mode === 'quiz') list = st.files.filter(f => f.key === st.solo || (f.key === 'edge' && st.solo !== 'edge'));
      else if (mode === 'drill') list = st.files.filter(f => f.key === 'edge' || (GM[f.key] && GM[f.key].drill));
      else list = st.files.filter(f => st.vis[f.key] !== false);
      list = list.slice().sort((a, b) => ((GM[a.key] || {}).ord || 0) - ((GM[b.key] || {}).ord || 0));
      const drillList = [];
      list.forEach(f => {
        const m = GM[f.key];
        if (!m) return;
        if (m.drill) { drillList.push(f); return; }
        if (mode === 'quiz' && f.key === 'edge' && st.solo !== 'edge') { const [o, og] = offFor('q-edge'); drawGerberOps(og, f, T, 'rgba(240,208,64,.35)'); g.drawImage(o, 0, 0, W, H); return; }
        const [o, og] = offFor(f.key);
        drawGerberOps(og, f, T, mode === 'drill' ? 'rgba(240,208,64,.8)' : m.col);
        g.globalAlpha = m.alpha || (m.ord >= 40 && f.key !== 'edge' ? 0.9 : 1);
        g.drawImage(o, 0, 0, W, H); g.globalAlpha = 1;
      });
      if (mode === 'drill') {
        const dia = st.drillDias();
        drawHoles(g, T, drillList, (f, o) => { const q = dia.findIndex(x => Math.abs(x.d - o.d) < 0.0005); return DRILL_COL[q % DRILL_COL.length]; });
      } else drawHoles(g, T, drillList, (f) => (GM[f.key] || {}).col || '#e8edf2');
      // Massstab
      const targets = [0.5, 1, 2, 5, 10, 20, 50, 100]; let L = targets.find(x => x * V.scale >= 60) || 100;
      g.strokeStyle = '#e8edf2'; g.lineWidth = 2; g.beginPath(); g.moveTo(12, H - 14); g.lineTo(12 + L * V.scale, H - 14); g.stroke();
      g.fillStyle = '#e8edf2'; g.font = '11px system-ui'; g.fillText(fmt(L, L < 1 ? 1 : 0) + ' mm', 12, H - 20);
      if (V.flip) { g.fillStyle = '#ffb340'; g.font = '700 12px system-ui'; g.fillText('Ansicht von unten (gespiegelt)', 12, 18); }
    }
    function sched() { if (raf || dead) return; raf = requestAnimationFrame(() => { raf = 0; if (!dead) cvo.paint(); }); }

    // Zeiger: Pan, Pinch
    const ptr = new Map(); let pinch = null;
    cv.addEventListener('pointerdown', e => { V.touched = true; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); pinch = null; });
    cv.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect(), T = tr();
      const q = T.inv(e.clientX - r.left, e.clientY - r.top);
      info.textContent = 'X ' + fmt(q[0], 2) + ' mm   Y ' + fmt(q[1], 2) + ' mm  (Koordinaten wie in der Gerber-Datei)';
      if (!ptr.has(e.pointerId)) return;
      const prev = ptr.get(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptr.size === 1) {
        const k = V.flip ? -1 : 1;
        V.cx -= (e.clientX - prev[0]) / V.scale * k; V.cy -= (YUP ? -1 : 1) * (e.clientY - prev[1]) / V.scale;
      } else if (ptr.size === 2) {
        const pts = [...ptr.values()], d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
        if (pinch) { const f = d / pinch; if (f > 0.2 && f < 5) zoomAt((pts[0][0] + pts[1][0]) / 2 - r.left, (pts[0][1] + pts[1][1]) / 2 - r.top, f); }
        pinch = d;
      }
      sched();
    });
    const up = e => { ptr.delete(e.pointerId); pinch = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') up(e); });
    function zoomAt(px, py, f) {
      const T = tr(), before = T.inv(px, py);
      V.scale = clamp(V.scale * f, 0.5, 600);
      const T2 = tr(), after = T2.inv(px, py);
      V.cx += before[0] - after[0]; V.cy += before[1] - after[1];
    }
    cv.addEventListener('wheel', e => { e.preventDefault(); V.touched = true; const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015)); sched(); }, { passive: false });
    cv.addEventListener('dblclick', e => { const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, 1.8); sched(); });

    const api = {
      cv: cvo, paint: () => cvo.paint(), sched,
      fit() { V.touched = false; fit(); sched(); },
      zoom(f) { V.touched = true; zoomAt(cvo.w / 2, cvo.h / 2, f); sched(); },
      flip(v) { V.flip = !!v; sched(); },
      isFlipped: () => V.flip,
      refit() { V.fitted = false; V.touched = false; sched(); },
      destroy() { dead = true; if (raf) cancelAnimationFrame(raf); if (cvo.ro) cvo.ro.disconnect(); }
    };
    return api;
  }
  const DRILL_COL = ['#ff6b6b', '#ffb340', '#f4e04d', '#4cd964', '#3bd6c6', '#3b9eff', '#a77de0', '#ff7fd0', '#c8d27a', '#9fb0c2'];

  // ================================================================== Ansicht 'gerber'
  const TOP_KEYS = ['fcu', 'fmask', 'fpaste', 'fsilk', 'edge', 'pth', 'npth'], BOT_KEYS = ['bcu', 'bmask', 'bpaste', 'bsilk', 'edge', 'pth', 'npth'];
  const GBASICS = [
    ['Gerber (RS-274X)', 'Eine Textdatei mit Zeichenbefehlen für den Fotoplotter: "%MOMM*%" legt Millimeter fest, "%FSLAX46Y46*%" das Zahlenformat (4 Stellen vor, 6 nach dem Komma). Blenden (Apertures) wie "%ADD10C,0.25*%" sind Formen: C Kreis, R Rechteck, O Oval.'],
    ['Befehle D01, D02, D03', 'D02 bewegt den Stift ohne zu zeichnen, D01 zeichnet eine Linie mit der gewählten Blende, D03 setzt die Blende als Pad ("flashen"). Flächen entstehen mit G36 bis G37 (Region). "LPD" zeichnet Kupfer, "LPC" löscht wieder (Clear-Polarität).'],
    ['Gerber X2', 'Erweiterung mit Zusatzinformationen als Attribute (z. B. "%TF.FileFunction,Copper,L1,Top*%"). Sie sagen dem Hersteller, welche Lage die Datei ist. Dateiendungen wie .gtl oder .gbl sind nur ein Hinweis, die Funktion steht im Attribut.'],
    ['Excellon (Bohrdaten)', 'Textdatei mit Werkzeugliste ("T1C0.300" = Bohrer 0,3 mm) und Koordinaten der Löcher. Getrennt in PTH (mit Kupferwand) und NPTH (ohne). "M30" beendet die Datei.']
  ];

  function mountGerber(el, ctx) {
    injectCss();
    const S = { tab: lsGet('gerber.tab', 'view'), sig: '', open: {}, quiz: { q: null, ok: 0, n: 0, streak: 0, best: lsGet('gerber.best', 0) }, err: null };
    const st = { files: [], vis: {}, solo: null, drillDias: () => [] };
    const rootEl = h('div', { class: 'pf-root' }); el.appendChild(rootEl);
    let alive = true, viewer = null, bodyEl = null;
    const board = () => (ctx.getBoard && ctx.getBoard()) || null;

    st.drillDias = () => {
      const m = {};
      st.files.forEach(f => f.holes.forEach(o => { const k = o.d.toFixed(3); (m[k] = m[k] || { d: +k, n: 0, pth: 0, npth: 0 }).n++; if (f.key === 'npth') m[k].npth++; else m[k].pth++; }));
      return Object.keys(m).map(k => m[k]).sort((a, b) => a.d - b.d);
    };
    function reload(force) {
      const b = board();
      if (!b) { S.err = 'Keine Platine geladen.'; st.files = []; return; }
      let sig = '';
      try { sig = JSON.stringify(b); } catch (e) { sig = String(Math.random()); }
      if (!force && sig === S.sig) return;
      S.sig = sig; S.err = null;
      try {
        const c = CORE();
        if (!c || !c.gerber || !c.parseGerber) throw new Error('Der Platinen-Kern (PCB_CORE.gerber) ist nicht geladen.');
        const nm = String(b.name || 'platine').replace(/[^\wäöüÄÖÜß\-]+/g, '_').replace(/^_+|_+$/g, '') || 'platine';
        const r = c.gerber(b, { name: nm });
        let files = r && r.files;
        if (Array.isArray(files)) { const o = {}; files.forEach(f => { o[f.name] = f.text; }); files = o; }
        if (!files || !Object.keys(files).length) throw new Error('Der Kern hat keine Gerber-Dateien geliefert.');
        const old = st.files;
        st.files = Object.keys(files).map(n => loadGerberFile(n, String(files[n]), classify(n))).filter(f => f.key || f.text);
        st.files.sort((a, c2) => ((GM[a.key] || {}).ord || 99) - ((GM[c2.key] || {}).ord || 99));
        st.files.reverse();
        // Reihenfolge der Dateiliste: Oberseite vom Kupfer nach aussen, dann unten, dann Bohrungen
        const rank = f => { const k = f.key; const order = ['fcu', 'in1', 'in2', 'in3', 'in4', 'bcu', 'fmask', 'bmask', 'fpaste', 'bpaste', 'fsilk', 'bsilk', 'edge', 'pth', 'npth']; const i = order.indexOf(k); return i < 0 ? 99 : i; };
        st.files.sort((a, c2) => rank(a) - rank(c2));
        st.files.forEach(f => { if (st.vis[f.key] === undefined) st.vis[f.key] = true; });
        if (!old.length && viewer) viewer.refit();
      } catch (e) { S.err = e && e.message ? e.message : String(e); st.files = []; }
    }

    // ---------- Tab: Betrachter
    function tabView() {
      const split = h('div', { class: 'pf-split' });
      const left = h('div', { class: 'pf-card' }), right = h('div', { class: 'pf-card' });
      const tools = h('div', { class: 'pf-row' });
      left.appendChild(tools);
      viewer = makeViewer(left, st, { mode: 'view' });
      tools.appendChild(h('button', { class: 'pf-btn', 'aria-label': 'Vergrößern', onclick: () => viewer.zoom(1.5) }, '+'));
      tools.appendChild(h('button', { class: 'pf-btn', 'aria-label': 'Verkleinern', onclick: () => viewer.zoom(1 / 1.5) }, '−'));
      tools.appendChild(h('button', { class: 'pf-btn', onclick: () => viewer.fit() }, 'Einpassen'));
      const fl = h('button', { class: 'pf-btn' + (viewer.isFlipped() ? ' on' : ''), onclick: () => { viewer.flip(!viewer.isFlipped()); fl.classList.toggle('on', viewer.isFlipped()); fl.textContent = viewer.isFlipped() ? 'Ansicht: unten' : 'Ansicht: oben'; } }, 'Ansicht: oben');
      tools.appendChild(fl);
      tools.appendChild(h('span', { class: 'pf-muted' }, 'Ziehen = verschieben, zwei Finger oder Mausrad = zoomen'));
      right.appendChild(h('h3', null, 'Lagen'));
      const presets = h('div', { class: 'pf-row' });
      const setVis = fn => { st.files.forEach(f => { st.vis[f.key] = fn(f.key); }); fillChips(); viewer.sched(); };
      [['Alle', () => true], ['Oben', k => TOP_KEYS.indexOf(k) >= 0], ['Unten', k => BOT_KEYS.indexOf(k) >= 0],
        ['Kupfer', k => /cu$|^in\d$|^edge$/.test(k)], ['Bohrungen', k => k === 'pth' || k === 'npth' || k === 'edge']].forEach(p => presets.appendChild(h('button', { class: 'pf-btn', onclick: () => setVis(p[1]) }, p[0])));
      right.appendChild(presets);
      const chips = h('div', { class: 'pf-list' });
      right.appendChild(chips);
      function fillChips() {
        chips.replaceChildren();
        st.files.forEach(f => {
          const m = GM[f.key] || { id: f.name, col: '#aab6c3', title: f.name };
          const on = st.vis[f.key] !== false;
          chips.appendChild(h('button', { class: 'pf-chip' + (on ? '' : ' off'), 'aria-pressed': on ? 'true' : 'false', style: 'justify-content:flex-start',
            onclick: () => { st.vis[f.key] = !(st.vis[f.key] !== false); fillChips(); viewer.sched(); } },
            h('i', { style: 'background:' + m.col }), h('span', null, m.id), h('span', { class: 'pf-muted' }, f.ext || '')));
        });
      }
      fillChips();
      right.appendChild(h('p', { class: 'pf-muted', style: 'margin-top:8px' }, 'Lötstopp-Dateien zeigen die Lack-Öffnungen, Paste-Dateien die Schablonenöffnungen. Schalte Lagen einzeln ein, um sie zu vergleichen.'));
      split.appendChild(left); split.appendChild(right);
      return split;
    }

    // ---------- Tab: Dateien
    function fabRulesCard() {
      const b = board() || {}, holes = []; st.files.forEach(f => f.holes.forEach(o => holes.push(o.d)));
      const minD = holes.length ? Math.min.apply(null, holes) : null;
      const minW = (b.tracks || []).length ? Math.min.apply(null, b.tracks.map(t => +t.w || 0)) : null;
      const P = PROFILES;
      const row = (lbl, val, key) => h('tr', null, h('td', null, lbl), h('td', { class: 'n' }, val == null ? '–' : fmt(val, 2) + ' mm'),
        ...Object.keys(P).map(pk => {
          const ok = val == null ? null : val >= P[pk][key] - 1e-9;
          return h('td', { class: 'n ' + (ok == null ? '' : ok ? 'pf-ok' : 'pf-err') }, (ok == null ? '' : ok ? '✓ ' : '✗ ') + '≥ ' + fmt(P[pk][key], 2));
        }));
      return h('div', { class: 'pf-card' }, h('h3', null, 'Passt das zu den Fertigungsregeln?'),
        h('table', { class: 'pf-tbl' }, h('thead', null, h('tr', null, h('th', null, 'Wert deiner Platine'), h('th', { class: 'n' }, 'Dein Wert'), ...Object.keys(P).map(k => h('th', { class: 'n' }, P[k].name)))),
          h('tbody', null, row('Kleinste Bohrung', minD, 'drill'), row('Schmalste Leiterbahn', minW, 'trace'))),
        h('p', { class: 'pf-muted', style: 'margin-top:8px' }, 'Der Hersteller prüft deine Gerber-Dateien gegen seine Mindestwerte. Alle Abstände, Restringe und Bohrungen findest du in der Fertigungs-Ansicht unter "DFM-Prüfung".'));
    }
    function tabFiles() {
      const wrap = h('div', null);
      const top = h('div', { class: 'pf-card' }, h('h3', null, 'Dateiliste (' + st.files.length + ' Dateien)'));
      const zipOk = canDownload() && st.files.length;
      top.appendChild(h('div', { class: 'pf-row' },
        zipOk ? h('button', { class: 'pf-btn pri', onclick: async () => {
          try {
            const enc = new TextEncoder(), b = board();
            const blob = makeZip(st.files.map(f => ({ name: f.name, data: enc.encode(f.text) })));
            const nm = String((b && b.name) || 'platine').replace(/[^\wäöüÄÖÜß\-]+/g, '_').replace(/^_+|_+$/g, '') || 'platine';
            await downloadBlob(blob, nm + '-gerber.zip');
            toast(ctx, 'Gerber-ZIP mit ' + st.files.length + ' Dateien gespeichert.');
          } catch (e) { toast(ctx, 'ZIP konnte nicht erzeugt werden.'); }
        } }, 'Alle Dateien als ZIP laden') : h('span', { class: 'pf-muted' }, 'ZIP-Download ist auf diesem Gerät nicht verfügbar.'),
        h('span', { class: 'pf-muted' }, 'Diese ZIP-Datei schickst du an den Hersteller.')));
      const list = h('div', { class: 'pf-list' });
      st.files.forEach(f => {
        const m = f.meta, isD = m && m.drill;
        const pre = h('pre', { style: 'display:none' });
        const card = h('div', { class: 'pf-file' },
          h('b', null, f.name),
          h('span', { class: 'pf-badge ' + (isD ? 'warn' : 'ok') }, isD ? 'Excellon' : 'Gerber X2 (RS-274X)'),
          h('div', { style: 'grid-column:1/-1' }, h('span', { style: 'color:#e8edf2;font-weight:600' }, m ? m.title : 'Unbekannte Datei'), m ? ' – ' + m.purpose : ''),
          h('div', { class: 'pf-muted', style: 'grid-column:1/-1' }, 'Endung ' + (f.ext || '–') + ' · ' + (f.bytes > 1024 ? fmt(f.bytes / 1024, 1) + ' KB' : f.bytes + ' Byte') + ' · ' + (isD ? f.holes.length + ' Bohrungen' : f.ops.length + ' Zeichenbefehle') + (f.err ? ' · Lesefehler: ' + f.err : '')),
          h('div', { class: 'pf-row', style: 'grid-column:1/-1;margin:4px 0 0' },
            h('button', { class: 'pf-btn', onclick: () => { Object.keys(st.vis).forEach(k => { st.vis[k] = (k === f.key || k === 'edge'); }); S.tab = 'view'; render(); } }, 'Im Betrachter zeigen'),
            h('button', { class: 'pf-btn', onclick: () => {
              const on = pre.style.display === 'none';
              if (on && !pre.textContent) { const ls = f.text.split('\n'); pre.textContent = ls.slice(0, 60).join('\n') + (ls.length > 60 ? '\n… (' + (ls.length - 60) + ' weitere Zeilen)' : ''); }
              pre.style.display = on ? 'block' : 'none';
            } }, 'Inhalt ansehen')),
          pre);
        list.appendChild(card);
      });
      top.appendChild(list);
      wrap.appendChild(top);
      const basics = h('div', { class: 'pf-card' }, h('h3', null, 'So sind die Dateien aufgebaut'));
      GBASICS.forEach(g => basics.appendChild(h('details', { class: 'pf-acc' }, h('summary', null, g[0]), h('p', null, g[1]))));
      wrap.appendChild(basics);
      wrap.appendChild(fabRulesCard());
      return wrap;
    }

    // ---------- Tab: Bohrplan
    function tabDrill() {
      const split = h('div', { class: 'pf-split' });
      const left = h('div', { class: 'pf-card' }), right = h('div', { class: 'pf-card' });
      viewer = makeViewer(left, st, { mode: 'drill' });
      left.insertBefore(h('div', { class: 'pf-row' },
        h('button', { class: 'pf-btn', onclick: () => viewer.zoom(1.5) }, '+'), h('button', { class: 'pf-btn', onclick: () => viewer.zoom(1 / 1.5) }, '−'),
        h('button', { class: 'pf-btn', onclick: () => viewer.fit() }, 'Einpassen')), left.firstChild);
      right.appendChild(h('h3', null, 'Bohrplan'));
      const dia = st.drillDias(), total = dia.reduce((a, d) => a + d.n, 0);
      if (!dia.length) right.appendChild(h('p', { class: 'pf-muted' }, 'Keine Bohrungen auf dieser Platine.'));
      else {
        right.appendChild(h('table', { class: 'pf-tbl' },
          h('thead', null, h('tr', null, h('th', null, 'Werkzeug'), h('th', { class: 'n' }, '⌀ mm'), h('th', { class: 'n' }, 'Anzahl'), h('th', null, 'Art'))),
          h('tbody', null, dia.map((d, i) => h('tr', null,
            h('td', null, h('span', { style: 'display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;background:' + DRILL_COL[i % DRILL_COL.length] }), 'T' + (i + 1)),
            h('td', { class: 'n' }, fmt(d.d, 2)), h('td', { class: 'n' }, d.n), h('td', null, d.pth && d.npth ? 'PTH + NPTH' : d.npth ? 'NPTH' : 'PTH'))))));
        right.appendChild(h('p', { class: 'pf-muted', style: 'margin-top:8px' }, total + ' Bohrungen mit ' + dia.length + ' Werkzeug' + (dia.length === 1 ? '' : 'en') + '. Jeder Wechsel kostet Zeit. Weniger verschiedene Durchmesser machen die Platine günstiger.'));
        right.appendChild(h('div', { class: 'pf-note' }, 'Der kleinste Bohrer bestimmt den Preis: ' + fmt(dia[0].d, 2) + ' mm. Prototyp-Fertiger bohren meist ab 0,3 mm, Industrie auch kleiner.'));
        const mn = dia[0].d, ar = 1.6 / mn;
        right.appendChild(h('p', { class: 'pf-muted' }, 'Aspektverhältnis (Plattendicke zu kleinster Bohrung): ca. ' + fmt(ar, 1) + ' : 1. Je höher, desto schwieriger ist das gleichmäßige Verkupfern der Bohrungswand.'));
      }
      split.appendChild(left); split.appendChild(right);
      const wrap = h('div', null, split, fabRulesCard());
      return wrap;
    }

    // ---------- Tab: Quiz
    function newQuestion() {
      const cand = st.files.filter(f => GM[f.key]);
      if (cand.length < 2) { S.quiz.q = null; return; }
      const f = cand[Math.floor(Math.random() * cand.length)];
      const kind = Math.random() < 0.5 ? 'name' : 'ext';
      let opts;
      const k0 = f.key;
      if (kind === 'name') {
        // verwechselbare zuerst
        const sim = { fcu: ['bcu', 'in1'], bcu: ['fcu', 'in2'], fmask: ['fpaste', 'bmask'], bmask: ['bpaste', 'fmask'], fpaste: ['fmask', 'bpaste'], bpaste: ['bmask', 'fpaste'], fsilk: ['bsilk', 'edge'], bsilk: ['fsilk'], edge: ['fsilk', 'npth'], pth: ['npth'], npth: ['pth'], in1: ['in2', 'fcu'], in2: ['in1'], in3: ['in4'], in4: ['in3'] }[k0] || [];
        const pool = Object.keys(GM).filter(k => k !== k0);
        const picks = sim.filter(k => k !== k0).slice(0, 2);
        while (picks.length < 3) { const k = pool[Math.floor(Math.random() * pool.length)]; if (picks.indexOf(k) < 0) picks.push(k); }
        opts = [k0].concat(picks).map(k => ({ k, label: GM[k].title + ' (' + (k === k0 ? f.ext : EXT_PREF[k]) + ')', ok: k === k0 }));
      } else {
        const right = f.ext || EXT_PREF[k0];
        const all = ['.gtl', '.gbl', '.gts', '.gbs', '.gtp', '.gbp', '.gto', '.gbo', '.gm1', '.drl', '.g2', '.g3'].filter(x => x !== right);
        const picks = [];
        while (picks.length < 3) { const x = all[Math.floor(Math.random() * all.length)]; if (picks.indexOf(x) < 0) picks.push(x); }
        opts = [right].concat(picks).map(x => ({ label: x, ok: x === right }));
      }
      for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
      S.quiz.q = { f, kind, opts, done: false };
      st.solo = f.key;
    }
    function tabQuiz() {
      const Q = S.quiz;
      if (!Q.q || !st.files.some(f => f === Q.q.f)) newQuestion();
      const wrap = h('div', { class: 'pf-split' });
      const left = h('div', { class: 'pf-card' }), right = h('div', { class: 'pf-card' });
      if (!Q.q) { left.appendChild(h('p', null, 'Für das Quiz braucht die Platine mindestens zwei Gerber-Dateien.')); wrap.appendChild(left); return wrap; }
      st.solo = Q.q.f.key;
      viewer = makeViewer(left, st, { mode: 'quiz' });
      left.insertBefore(h('div', { class: 'pf-row' }, h('button', { class: 'pf-btn', onclick: () => viewer.zoom(1.5) }, '+'), h('button', { class: 'pf-btn', onclick: () => viewer.zoom(1 / 1.5) }, '−'), h('button', { class: 'pf-btn', onclick: () => viewer.fit() }, 'Einpassen'),
        h('span', { class: 'pf-muted' }, 'Blick von oben; helle Linie = Platinenrand')), left.firstChild);
      right.appendChild(h('h3', null, 'Welche Datei ist das?'));
      right.appendChild(h('p', null, Q.q.kind === 'name' ? 'Welche Gerber-Datei zeigt dieses Bild?' : 'Welche Dateiendung hat diese Datei?'));
      const fb = h('div');
      Q.q.opts.forEach(o => {
        const btn = h('button', { class: 'pf-opt', onclick: () => {
          if (Q.q.done) return;
          Q.q.done = true; Q.n++;
          const bx = btn.getBoundingClientRect();
          if (o.ok) { Q.ok++; Q.streak++; if (Q.streak > Q.best) { Q.best = Q.streak; lsSet('gerber.best', Q.best); } btn.classList.add('good'); fx(ctx, Q.streak >= 3 ? 'tada' : 'ding', bx.left + bx.width / 2, bx.top, Q.streak >= 3 ? 'Serie ' + Q.streak + '!' : 'Richtig!'); }
          else { Q.streak = 0; btn.classList.add('bad'); fx(ctx, 'sad', bx.left + bx.width / 2, bx.top, 'Knapp daneben'); }
          [...right.querySelectorAll('.pf-opt')].forEach((b2, i) => { if (Q.q.opts[i].ok) b2.classList.add('good'); b2.disabled = true; });
          const m = GM[Q.q.f.key];
          fb.replaceChildren(h('div', { class: 'pf-note ' + (o.ok ? 'ok' : 'err') }, h('b', null, (o.ok ? 'Richtig. ' : 'Nicht ganz. ') + m.title + ' (' + (Q.q.f.ext || '') + ')'), h('br'), m.purpose, h('br'), h('span', { class: 'pf-muted' }, 'Erkennungs-Tipp: ' + m.clue)),
            h('button', { class: 'pf-btn pri', style: 'margin-top:6px', onclick: () => { newQuestion(); render(); } }, 'Nächste Frage'));
          score.textContent = Q.ok + ' von ' + Q.n + ' richtig · Serie ' + Q.streak + ' · Bestwert ' + Q.best;
        } }, o.label);
        right.appendChild(btn);
      });
      right.appendChild(fb);
      const score = h('p', { class: 'pf-muted', style: 'margin-top:8px' }, Q.n ? Q.ok + ' von ' + Q.n + ' richtig · Serie ' + Q.streak + ' · Bestwert ' + Q.best : 'Noch keine Frage beantwortet.');
      right.appendChild(score);
      wrap.appendChild(left); wrap.appendChild(right);
      return wrap;
    }

    function render() {
      if (!alive) return;
      if (viewer) { viewer.destroy(); viewer = null; }
      const keep = bodyEl ? bodyEl.scrollTop : 0;
      rootEl.replaceChildren();
      rootEl.appendChild(tabsBar([['view', 'Betrachter'], ['files', 'Dateien'], ['drill', 'Bohrplan'], ['quiz', 'Quiz']], S.tab, t => { S.tab = t; lsSet('gerber.tab', t); render(); }));
      bodyEl = h('div', { class: 'pf-body' });
      rootEl.appendChild(bodyEl);
      if (S.err) bodyEl.appendChild(h('div', { class: 'pf-note err' }, 'Gerber-Dateien nicht verfügbar: ' + S.err));
      else {
        try { bodyEl.appendChild(S.tab === 'files' ? tabFiles() : S.tab === 'drill' ? tabDrill() : S.tab === 'quiz' ? tabQuiz() : tabView()); }
        catch (e) { bodyEl.appendChild(h('div', { class: 'pf-note err' }, 'Anzeige nicht möglich: ' + (e && e.message))); }
      }
      bodyEl.scrollTop = keep;
      if (viewer) requestAnimationFrame(() => { if (alive && viewer) viewer.refit(); });
    }
    reload(true); render();
    return {
      refresh() { if (!alive) return; const o = S.sig; reload(false); if (S.sig !== o || (S.err && !st.files.length)) render(); },
      onShow() { const o = S.sig; reload(false); if (S.sig !== o || !bodyEl) render(); else if (viewer) viewer.sched(); },
      onBoard() { reload(true); S.quiz.q = null; render(); },
      destroy() { alive = false; if (viewer) viewer.destroy(); rootEl.remove(); }
    };
  }

  // ================================================================== Ansicht 'fab': Schritte, Kosten, DFM
  const PROFILES = {
    proto: { name: 'Prototyp', trace: 0.15, space: 0.15, drill: 0.3, annular: 0.15, edge: 0.3, silk: 0.15, aspect: 8, blind: false },
    ind: { name: 'Industrie', trace: 0.1, space: 0.1, drill: 0.2, annular: 0.1, edge: 0.3, silk: 0.15, aspect: 10, blind: true }
  };

  const STEPS = [
    { t: 'Basismaterial', c: 'FR-4-Kern', txt: 'Am Anfang steht der Kern: Glasfasergewebe, mit Epoxidharz getränkt und ausgehärtet (FR-4). Er ist der Isolator und gibt der Platine ihre Festigkeit. Meist wird auf ca. 1,6 mm Gesamtdicke hin gearbeitet.', why: 'Das Glasgewebe macht die Platine biegesteif und hitzefest genug zum Löten.' },
    { t: 'Kupfer aufbringen', c: 'Kupferfolie', txt: 'Auf den Kern wird beidseitig Kupferfolie gepresst, meist 35 µm dick (1 oz). Das gekaufte Halbzeug heißt kupferkaschiertes Basismaterial. Innenlagen bekommen oft dünneres Kupfer (17,5 µm).', why: 'Dicker Kupfer trägt mehr Strom, lässt sich aber schlechter fein ätzen.' },
    { t: 'Fotolack und Belichten', c: 'UV-Belichtung', txt: 'Die Folie wird mit lichtempfindlichem Lack (Fotoresist) beschichtet. Ein Film mit deinem Layout liegt darüber, UV-Licht härtet den Lack nur dort, wo später Kupfer stehen bleiben soll. Der Film wird aus deinen Gerber-Daten erzeugt.', why: 'Der Lack wirkt wie eine Schablone: Wo er gehärtet ist, schützt er das Kupfer.' },
    { t: 'Ätzen', c: 'Ätzlösung', txt: 'Der Entwickler wäscht den nicht belichteten Lack ab. Die Ätzlösung (z. B. Kupferchlorid) löst nun alles Kupfer auf, das nicht geschützt ist. Zum Schluss wird der Lack entfernt. Übrig bleiben nur Leiterbahnen, Pads und Flächen.', why: 'Die Ätzlösung greift auch seitlich an (Unterätzung). Darum gibt es Mindestbreiten und Mindestabstände.' },
    { t: 'Laminieren', c: 'Heiß verpressen', txt: 'Bei mehr als zwei Lagen werden die geätzten Innenlagen mit Prepreg (Glasgewebe mit Harz) und Kupferfolie gestapelt und unter Druck und Hitze verpresst. Das Harz schmilzt, verklebt alles und härtet aus. Bei zwei Lagen gibt es diesen Schritt nicht.', why: 'Durch das Laminieren entstehen Innenlagen, die von außen nicht zu erreichen sind. Dafür braucht man Vias.' },
    { t: 'Bohren', c: 'CNC-Bohrer', txt: 'CNC-Maschinen bohren die Löcher für Bauteilbeine und Vias mit Hartmetallbohrern, oft mehrere Platinen im Stapel. Die Daten kommen aus der Excellon-Datei. Danach ist die Lochwand noch reines Glasgewebe und Harz, also nicht leitend.', why: 'Jeder Bohrdurchmesser braucht ein eigenes Werkzeug, und sehr kleine Bohrer brechen leicht. Das treibt den Preis.' },
    { t: 'Durchkontaktieren', c: 'Kupferbad', txt: 'Damit die Lochwand leitet, wird sie zuerst chemisch aktiviert und mit einer hauchdünnen Kupferschicht überzogen. Dann wächst im galvanischen Bad Kupfer auf (etwa 20 bis 25 µm in der Bohrung). Die Außenlagen werden danach wie in Schritt 3 strukturiert.', why: 'Erst jetzt verbindet das Loch die Kupferlagen miteinander. Das heißt "plated through hole" (PTH).' },
    { t: 'Lötstopplack', c: 'Lack und Öffnungen', txt: 'Grüner Epoxidlack wird aufgetragen und mit einem Film belichtet. Die Pads werden beim Entwickeln wieder freigelegt. Der Lack schützt Kupfer vor Korrosion und verhindert, dass Lötzinn zwischen Bahnen Brücken bildet.', why: 'Die Lötstopp-Datei zeigt deshalb die Öffnungen, nicht den Lack selbst.' },
    { t: 'Siebdruck', c: 'Bestückungsdruck', txt: 'Mit weißer Tinte (Sieb oder Digitaldruck) werden Bauteilumrisse, Referenzen wie R1 und Polaritätsmarken aufgedruckt. Der Druck liegt auf dem Lack und darf nicht auf Pads landen.', why: 'Der Druck hilft beim Bestücken und bei der Fehlersuche. Er trägt keine Elektronik.' },
    { t: 'Oberfläche', c: 'HASL / ENIG', txt: 'Freies Kupfer oxidiert schnell und lässt sich dann nicht mehr löten. HASL: Die Platine wird in flüssiges Lot getaucht, Heißluft bläst den Überschuss weg (günstig, aber nicht ganz eben). ENIG: chemisch Nickel mit einer dünnen Goldschicht (sehr eben, lange lagerfähig, teurer).', why: 'Feine SMD-Pads (z. B. QFN, 0,5 mm Raster) brauchen eine ebene Oberfläche, deshalb wird dort oft ENIG gewählt.' },
    { t: 'Fräsen und Ritzen', c: 'Kontur', txt: 'Viele Platinen sitzen zusammen auf einem Nutzen. Ein Fräser trennt die Kontur aus dem Material. Beim V-Ritzen schneiden Sägeblätter von beiden Seiten eine Kerbe, bis nur noch ein dünner Steg bleibt; später bricht man die Platinen aus dem Nutzen.', why: 'Die Umrisslinie (Edge) deiner Gerber-Daten gibt dem Fräser die Bahn vor. Halte Kupfer mit Abstand vom Rand.' },
    { t: 'Elektrischer Test', c: 'Flying Probe', txt: 'Nadeln (Flying Probe) oder ein Nadelbettadapter fahren die Pads an. Der Tester prüft Durchgang (Pads desselben Netzes sind verbunden) und Isolation (verschiedene Netze sind es nicht) gegen die Netzliste. Erst dann geht die Platine in den Versand.', why: 'So werden Unterbrechungen und Kurzschlüsse gefunden, bevor du bestückt hast.' }
  ];

  // ---------- Szene (Querschnitt) ----------
  const SCW = 640, SCH = 340, SCX = 320, HR = 14;
  const PATS = {
    T: [[24, 170], [264, 376], [470, 616]], B: [[24, 130], [264, 376], [430, 616]],
    I1: [[24, 210], [264, 376], [440, 616]], I2: [[24, 236], [404, 616]], I3: [[24, 150], [264, 376], [500, 616]], I4: [[24, 236], [404, 616]]
  };
  const gapsOf = iv => { const out = []; let x = 10; iv.forEach(q => { if (q[0] > x) out.push([x, q[0]]); x = q[1]; }); if (x < 630) out.push([x, 630]); return out; };
  function buildSeq(nl) {
    const cuO = 9, cuI = 6, pp = 16, core = nl <= 2 ? 70 : 44, L = [];
    const c = (id, face, hh, lam) => ({ k: 'cu', id, pat: id, face, h: hh, lam });
    const d = (k, hh, lam) => ({ k, h: hh, lam });
    if (nl === 1) L.push(d('core', core + 9, false), c('B', 'down', cuO, false));
    else if (nl === 2) L.push(c('T', 'up', cuO, false), d('core', core, false), c('B', 'down', cuO, false));
    else if (nl === 4) L.push(c('T', 'up', cuO, true), d('pp', pp, true), c('I1', 'up', cuI, false), d('core', core, false), c('I2', 'down', cuI, false), d('pp', pp, true), c('B', 'down', cuO, true));
    else L.push(c('T', 'up', cuO, true), d('pp', pp, true), c('I1', 'up', cuI, false), d('core', core, false), c('I2', 'down', cuI, false), d('pp', pp, true), c('I3', 'up', cuI, false), d('core', core, false), c('I4', 'down', cuI, false), d('pp', pp, true), c('B', 'down', cuO, true));
    let tot = 0; L.forEach(e => { tot += e.h; });
    let y = 172 - tot / 2; L.forEach(e => { e.y = y; y += e.h; });
    return { L, top: L[0].y, bot: y, tot };
  }
  const mixCol = (a, b, t) => { const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16)); return 'rgb(' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',') + ')'; };
  function gapFrac(e, s, p, nl) {
    if (e.lam && nl > 2) return (s <= 5 || (s === 6 && p < 0.6)) ? 1 : s === 6 ? 1 - ease(seg(p, 0.6, 0.9)) : 0;
    return s < 3 ? 1 : s === 3 ? 1 - ease(seg(p, 0.15, 0.85)) : 0;
  }
  function drawScene(g, W, H, st) {
    const s = st.s, p = st.p, nl = st.nl, t = st.t || 0;
    const sc = Math.min(W / SCW, H / SCH);
    g.save(); g.translate((W - SCW * sc) / 2, (H - SCH * sc) / 2); g.scale(sc, sc);
    g.fillStyle = '#0e1115'; g.fillRect(0, 0, SCW, SCH);
    const R = (x, y, w, h, col, a) => { if (w <= 0 || h <= 0) return; if (a != null) g.globalAlpha = a; g.fillStyle = col; g.fillRect(x, y, w, h); if (a != null) g.globalAlpha = 1; };
    const T = (txt, x, y, col, size, al) => { g.fillStyle = col || '#aab6c3'; g.font = (size || 12) + 'px system-ui,sans-serif'; g.textAlign = al || 'left'; g.fillText(txt, x, y); };
    const sq = buildSeq(nl), top = sq.top, bot = sq.bot;
    const skipLam = s === 4 && nl <= 2;
    // Schichten
    const baseCu = sq.L.filter(e => e.k === 'cu' && !e.lam);
    sq.L.forEach(e => {
      let vis;
      if (e.k !== 'cu') {
        if (e.lam) vis = s < 4 ? null : s === 4 ? { a: Math.min(1, p * 8), dy: (e.y < 172 ? -1 : 1) * (1 - ease(seg(p, 0, 0.5))) * 80 } : { a: 1, dy: 0 };
        else vis = s === 0 ? { a: ease(seg(p, 0, 0.6)), dy: 0 } : { a: 1, dy: 0 };
      } else if (e.lam && nl > 2) vis = s < 4 ? null : s === 4 ? { a: Math.min(1, p * 8), dy: (e.face === 'up' ? -1 : 1) * (1 - ease(seg(p, 0, 0.5))) * 110 } : { a: 1, dy: 0 };
      else vis = s < 1 ? null : s === 1 ? { a: Math.min(1, p * 6), dy: (e.face === 'up' ? -1 : 1) * (1 - ease(seg(p, 0, 0.6))) * 50 } : { a: 1, dy: 0 };
      if (!vis) return;
      const y = e.y + vis.dy;
      g.globalAlpha = vis.a;
      if (e.k === 'core') { R(10, y, 620, e.h, '#8c9a52'); if (s === 0) T('FR-4: Glasgewebe + Epoxidharz', 20, y + e.h / 2 + 4, 'rgba(255,255,255,.75)', 12); g.fillStyle = 'rgba(0,0,0,.12)'; for (let x = 14; x < 630; x += 18) g.fillRect(x, y, 2, e.h); }
      else if (e.k === 'pp') R(10, y, 620, e.h, s === 4 ? mixCol('#e6edaa', '#c3cf7d', ease(seg(p, 0.55, 1))) : '#c3cf7d');
      else {
        const iv = PATS[e.pat], gf = gapFrac(e, s, p, nl);
        if (gf < 1) R(10, y, 620, e.h, e.lam ? '#a8b563' : '#8c9a52');
        iv.forEach(q => R(q[0], y, q[1] - q[0], e.h, COL.cu));
        if (gf > 0.001) gapsOf(iv).forEach(q => { const hh = e.h * gf; R(q[0], e.face === 'up' ? y + e.h - hh : y, q[1] - q[0], hh, '#b98a40'); });
        if (s === 1 && p < 0.7 && e.face === 'up' && e.id === baseCu[0].id) T('Kupferfolie', 22, y - 8, '#f0c060', 12);
      }
      g.globalAlpha = 1;
    });
    // Fotolack, Belichtung, Aetzen
    if ((s === 2 || s === 3) && !skipLam) {
      const first = baseCu[0], last = baseCu[baseCu.length - 1];
      baseCu.forEach(e => {
        const rh = 5, ry = e.face === 'up' ? e.y - rh : e.y + e.h, iv = PATS[e.pat], gaps = gapsOf(iv);
        if (s === 2) {
          const ex = ease(seg(p, 0.35, 0.65));
          R(10, ry, 620, rh, '#e8a0c8', 0.9 * ease(seg(p, 0, 0.12)));
          iv.forEach(q => R(q[0], ry, q[1] - q[0], rh, mixCol('#e8a0c8', '#9a3d7a', ex)));
          if ((e === first || e === last) && p > 0.15 && p < 0.7) {
            const up = e.face === 'up', fy = up ? ry - 26 : ry + rh + 26, a = ease(seg(p, 0.15, 0.3)) * (1 - ease(seg(p, 0.6, 0.7)));
            gaps.forEach(q => R(q[0], fy - 2, q[1] - q[0], 4, '#2b2f36', a));
            g.globalAlpha = a; g.strokeStyle = '#c3a6ff'; g.lineWidth = 2;
            iv.forEach(q => { for (let x = q[0] + 6; x < q[1] - 3; x += 12) { g.beginPath(); g.moveTo(x, up ? fy - 36 : fy + 36); g.lineTo(x, up ? ry : ry + rh); g.stroke(); } });
            g.globalAlpha = 1;
            T('UV-Licht', 24, up ? fy - 30 : fy + 42, '#c3a6ff', 12); T('Film mit Layout', 24, up ? fy - 8 : fy + 20, '#8b97a3', 11);
          }
        } else {
          const gone = 1 - seg(p, 0, 0.2), strip = 1 - ease(seg(p, 0.88, 1));
          gaps.forEach(q => R(q[0], ry, q[1] - q[0], rh, '#e8a0c8', gone * 0.9));
          iv.forEach(q => R(q[0], ry, q[1] - q[0], rh, '#9a3d7a', strip));
          if (p > 0.2 && p < 0.85) {   // Aetzblasen
            gaps.forEach(q => { for (let k = 0; k < 4; k++) { const bx = q[0] + ((k * 37 + Math.floor(t * 3) * 11) % Math.max(4, q[1] - q[0])), by = (e.face === 'up' ? ry - 4 : ry + rh + 4) + (e.face === 'up' ? -1 : 1) * ((t * 20 + k * 9) % 14); g.fillStyle = 'rgba(120,220,200,.55)'; g.beginPath(); g.arc(bx, by, 2, 0, 6.3); g.fill(); } });
            if (e === first) T('Ätzlösung löst ungeschütztes Kupfer', 24, e.y - 22, '#7fe0cc', 12);
          }
        }
      });
    }
    // Laminieren: Pressplatten
    if (s === 4 && nl > 2) {
      const m = ease(seg(p, 0.1, 0.6)), pr = ease(seg(p, 0.5, 0.85));
      const gap = (1 - m) * 110 + (1 - pr) * 0 ;
      const ty = top - 12 - (1 - ease(seg(p, 0.1, 0.6))) * 70, by = bot + 4 + (1 - ease(seg(p, 0.1, 0.6))) * 70;
      R(10, ty - 14, 620, 14, '#6b7480'); R(10, by, 620, 14, '#6b7480');
      g.strokeStyle = '#8fb5ff'; g.lineWidth = 3; g.fillStyle = '#8fb5ff';
      [100, 320, 540].forEach(x => { g.beginPath(); g.moveTo(x, ty - 44); g.lineTo(x, ty - 20); g.stroke(); g.beginPath(); g.moveTo(x - 7, ty - 26); g.lineTo(x, ty - 18); g.lineTo(x + 7, ty - 26); g.fill(); });
      if (p > 0.55) { g.strokeStyle = 'rgba(255,110,80,.8)'; g.lineWidth = 2; for (let x = 40; x < 620; x += 40) { g.beginPath(); g.moveTo(x, ty + 4); for (let k = 0; k < 4; k++) g.lineTo(x + (k % 2 ? 6 : -6), ty - 2 - k * 4); g.stroke(); } T('Hitze und Druck: Harz schmilzt und verklebt', 24, Math.max(40, ty - 50), '#ff9d80', 12); }
      else T('Innenlagen, Prepreg und Außenfolien stapeln', 24, Math.max(40, ty - 50), '#cfd8e3', 12);
      void gap; void pr;
    }
    if (skipLam) T('Bei 2 Lagen entfällt das Laminieren', 20, 36, '#ffb340', 14);
    // Aussenflaechen: Lack, Siebdruck, Finish
    const outers = sq.L.filter(e => e.k === 'cu' && (e.id === 'T' || e.id === 'B'));
    const topSurf = nl === 1 ? top : top;
    if (s >= 7) {
      const m = s === 7 ? p : 1, sweep = seg(m, 0, 0.4), open = ease(seg(m, 0.7, 1)), ex = seg(m, 0.4, 0.7);
      const col = mixCol('#35b95c', '#1b7a3a', s === 7 ? ex : 1);
      const faces = [];
      outers.forEach(e => faces.push({ e, up: e.id === 'T' }));
      if (nl === 1) faces.push({ e: { y: top, h: 0, id: 'Tn', pat: 'T' }, up: true, bare: true });
      faces.forEach(f => {
        const e = f.e, up = f.up, iv = f.bare ? [] : PATS[e.pat], gp = f.bare ? [[10, 630]] : gapsOf(iv);
        const stripY = up ? e.y - 4 : e.y + e.h, x1 = 10 + sweep * 620;
        const clipW = x => Math.max(0, Math.min(x, x1));
        const opening = [270, 370];
        const strip = (a, b) => { const aa = clipW(a), bb = clipW(b); if (bb > aa) R(aa, f.bare ? top - 4 : stripY, bb - aa, 4, col); };
        strip(10, opening[0]); strip(opening[1], 630);
        const pw = (opening[1] - opening[0]) * (1 - open);
        if (pw > 0) { const cx0 = (opening[0] + opening[1]) / 2; const aa = clipW(cx0 - pw / 2), bb = clipW(cx0 + pw / 2); if (bb > aa) R(aa, f.bare ? top - 4 : stripY, bb - aa, 4, col); }
        if (!f.bare) gp.forEach(q => { const aa = clipW(q[0]), bb = clipW(q[1]); if (bb > aa) R(aa, e.y, bb - aa, e.h, col); });
        if (s === 7 && sweep < 1 && sweep > 0) { g.fillStyle = '#9fe6b0'; g.fillRect(x1 - 2, stripY - (up ? 14 : -2), 4, 14); }
      });
      if (s === 7) T(p < 0.4 ? 'Lack wird aufgetragen' : p < 0.7 ? 'Belichten mit Pad-Film' : 'Pads werden freigelegt', 24, top - 28, '#9fe6b0', 12);
    }
    if (s >= 8) {
      const m = s === 8 ? ease(seg(p, 0, 0.8)) : 1, sy = nl === 1 ? top - 3 : top - 7;
      [[60, 140], [430, 520]].forEach(q => { const w = clamp((10 + m * 620) - q[0], 0, q[1] - q[0]); R(q[0], sy, w, 3, '#f4f4f4'); });
      if (s === 8 && m < 1) { g.fillStyle = '#cfd8e3'; g.fillRect(10 + m * 620 - 8, sy - 22, 16, 18); T('Rakel', 10 + m * 620 - 14, sy - 28, '#8b97a3', 11); }
    }
    if (s >= 9) {
      const m = s === 9 ? ease(seg(p, 0.15, 0.85)) : 1, fin = st.fin;
      outers.forEach(e => {
        const up = e.id === 'T';
        [[270, 301], [339, 370]].forEach(q => {
          const w = q[1] - q[0];
          if (fin === 'HASL') {
            const fh = 6 * m, by = up ? e.y : e.y + e.h; g.fillStyle = '#c9ced4'; g.beginPath();
            g.ellipse(q[0] + w / 2, by, w / 2, fh * 1.2 + 0.1, 0, up ? Math.PI : 0, up ? 2 * Math.PI : Math.PI); g.fill();
          } else {
            const by = up ? e.y - 2.5 * m : e.y + e.h; R(q[0], by, w, 2.5 * m, '#9aa3ad');
            const gy = up ? e.y - 2.5 * m - 1.8 * m : e.y + e.h + 2.5 * m; R(q[0], gy, w, 1.8 * m, '#f2c94c');
          }
        });
      });
      if (s === 9) {
        const dip = st.fin === 'HASL';
        T(dip ? 'HASL: Lot-Bad und Heißluft (Zinn)' : 'ENIG: Nickel + dünne Goldschicht', 24, top - 28, dip ? '#cfd8e3' : '#f2c94c', 12);
        if (dip && p > 0.5) { g.strokeStyle = 'rgba(200,220,255,.7)'; g.lineWidth = 2; for (let k = 0; k < 6; k++) { const x = 90 + k * 90; g.beginPath(); g.moveTo(x, top - 26 + (t * 40 % 10)); g.lineTo(x + 20, top - 18 + (t * 40 % 10)); g.stroke(); } }
      }
    }
    // Bohrung und Durchkontaktierung
    if (s >= 5) {
      const dep = s === 5 ? ease(seg(p, 0.15, 0.75)) : 1;
      const y0 = top - 6, y1 = bot + 6, hh = (y1 - y0) * dep;
      R(SCX - HR, y0, HR * 2, hh, '#0b0e12');
      if (s >= 6) {
        const wl = s === 6 ? 5 * ease(seg(p, 0.25, 1)) : 5, wl0 = s === 6 ? ease(seg(p, 0, 0.25)) : 1;
        const yy0 = nl === 1 ? top : top, yy1 = bot;
        if (s === 6 && p < 0.35) { R(SCX - HR - 2, yy0, 2, yy1 - yy0, '#7a5a30', wl0); R(SCX + HR, yy0, 2, yy1 - yy0, '#7a5a30', wl0); }
        else { R(SCX - HR - wl, yy0, wl, yy1 - yy0, COL.cu); R(SCX + HR, yy0, wl, yy1 - yy0, COL.cu); }
        if (s === 6) {
          T('Kupferbad: Kupfer wächst in der Bohrung', 24, top - 28, '#f0c060', 12);
          g.fillStyle = '#f0c060';
          for (let k = 0; k < 8; k++) { const ph = (t * 0.8 + k / 8) % 1, side = k % 2 ? 1 : -1; g.beginPath(); g.arc(SCX + side * (60 - ph * 46), top + 10 + ((k * 23) % Math.max(10, bot - top - 20)), 2, 0, 6.3); g.fill(); }
        }
      }
      if (s === 5) {
        const tip = p < 0.15 ? top - 80 + ease(p / 0.15) * 74 : p < 0.75 ? y0 + hh : p < 0.9 ? y1 - (1 - 0) * 0 - ease(seg(p, 0.75, 0.9)) * (y1 - top + 74) : top - 80;
        const bx = SCX, ty = tip;
        g.fillStyle = '#aab6c3'; g.fillRect(bx - 7, ty - 70, 14, 62);
        g.fillStyle = '#7a8591'; g.beginPath(); g.moveTo(bx - 7, ty - 8); g.lineTo(bx, ty + 4); g.lineTo(bx + 7, ty - 8); g.fill();
        g.strokeStyle = '#5b6672'; g.lineWidth = 2; for (let k = 0; k < 5; k++) { const yy = ty - 66 + k * 12 + ((t * 80) % 12); g.beginPath(); g.moveTo(bx - 7, yy); g.lineTo(bx + 7, yy - 6); g.stroke(); }
        g.fillStyle = '#6b7480'; g.fillRect(bx - 14, ty - 90, 28, 22);
        if (p > 0.15 && p < 0.75) { g.fillStyle = '#c8b27a'; for (let k = 0; k < 8; k++) { const ph = (t * 1.5 + k * 0.13) % 1; g.beginPath(); g.arc(bx + (k % 2 ? 1 : -1) * (10 + ph * 28), top - 4 - ph * 16 + ph * ph * 22, 1.8, 0, 6.3); g.fill(); } }
        T('Hartmetallbohrer', 24, top - 40, '#cfd8e3', 12);
      }
    }
    // Fraesen und Ritzen
    if (s === 10) {
      const m = ease(seg(p, 0.1, 0.55)), m2 = ease(seg(p, 0.45, 0.85));
      const dv = (bot - top) * 0.36 * m;
      g.fillStyle = '#0e1115';
      g.beginPath(); g.moveTo(14, top - 10); g.lineTo(34, top - 10); g.lineTo(24, top + dv); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(14, bot + 10); g.lineTo(34, bot + 10); g.lineTo(24, bot - dv); g.closePath(); g.fill();
      g.strokeStyle = '#aab6c3'; g.lineWidth = 3;
      [[top - 10 - 30 + dv, -1], [bot + 10 + 30 - dv, 1]].forEach(q => { g.beginPath(); g.arc(24, q[0], 18, 0, 6.3); g.stroke(); g.beginPath(); g.moveTo(24, q[0]); g.lineTo(24 + Math.cos(t * 14) * 16, q[0] + Math.sin(t * 14) * 16); g.stroke(); });
      T('V-Ritzen', 36, top - 44, '#cfd8e3', 12);
      const cy = top - 40 + (bot - top + 60) * m2, cut = Math.max(0, cy - (top - 10));
      R(612, top - 10, 10, Math.min(bot - top + 20, cut), '#0e1115');
      g.fillStyle = '#aab6c3'; g.fillRect(612 + 5 - 4, cy - 60, 8, 54);
      g.fillStyle = '#7a8591'; g.fillRect(612 + 5 - 6, cy - 12, 12, 10);
      T('Fräser', 560, top - 44, '#cfd8e3', 12);
    }
    // Elektrischer Test
    if (s === 11) {
      const probe = (x, y, up) => {
        g.fillStyle = '#cfd8e3'; g.beginPath(); g.moveTo(x - 1.5, y); g.lineTo(x + 1.5, y); g.lineTo(x + 6, y + (up ? -50 : 50)); g.lineTo(x - 6, y + (up ? -50 : 50)); g.closePath(); g.fill();
        g.fillStyle = '#f2c94c'; g.fillRect(x - 1.5, up ? y - 2 : y, 3, 2);
        g.fillStyle = '#6b7480'; g.fillRect(x - 10, up ? y - 70 : y + 50, 20, 20);
      };
      const d1 = (1 - ease(seg(p, 0, 0.22))) * 60;
      probe(285, top - 6 - d1, true);
      const ph2 = seg(p, 0.45, 0.8);
      const px = 285 + (520 - 285) * ease(ph2), lift = Math.sin(Math.PI * ph2) * 40;
      probe(px, bot + 6 + (p < 0.45 ? d1 : lift * (ph2 > 0 ? 1 : 0)), false);
      const ok1 = p > 0.25, ok2 = p > 0.85;
      g.fillStyle = '#10161c'; g.fillRect(180, 14, 280, 56); g.strokeStyle = '#2c343e'; g.strokeRect(180, 14, 280, 56);
      T(p < 0.45 ? 'Durchgang: oben ↔ unten' : 'Isolation: Netz ↔ Nachbarnetz', 190, 34, '#cfd8e3', 12);
      T(p < 0.45 ? (ok1 ? 'OK  (verbunden, < 1 Ω)' : 'misst …') : (ok2 ? 'OK  (getrennt, > 10 MΩ)' : 'misst …'), 190, 58, (p < 0.45 ? ok1 : ok2) ? '#4cd964' : '#ffb340', 15);
    }
    // Beschriftung
    T('Schritt ' + (s + 1) + ' von ' + STEPS.length + ': ' + STEPS[s].t, 12, 18, '#e8edf2', 13);
    T('Querschnitt, nicht maßstäblich · ' + nl + (nl === 1 ? ' Lage' : ' Lagen'), 12, SCH - 8, '#59636e', 11);
    g.restore();
  }

  // ---------- Kosten ----------
  function cloneBoard(b) { const c = CORE(); if (c && c.clone) { const r = safe(() => c.clone(b), null); if (r) return r; } return JSON.parse(JSON.stringify(b)); }
  const TIERS = [{ id: 'eco', name: 'Spar', f: 0.9, days: d => Math.round(d * 1.6) }, { id: 'std', name: 'Standard', f: 1, days: d => d }, { id: 'exp', name: 'Express', f: 1.5, days: d => Math.max(2, Math.round(d / 2.5)) }];
  const QTYS = [1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 500, 1000];
  function costFor(b, o) {
    const c = CORE();
    if (!c || !c.cost) return null;
    const b2 = cloneBoard(b);
    b2.layers = o.nl; b2.w = o.w; b2.h = o.h; delete b2.outline;
    b2.surface = b2.finish = b2.surfaceFinish = o.fin;
    const r = safe(() => c.cost(b2, o.qty, { finish: o.fin, surface: o.fin }), null);
    if (!r || !isFinite(r.total)) return null;
    const tier = TIERS[o.tier == null ? 1 : o.tier], base = r.leadTimeDays || 8;
    const items = (r.items || []).map(i => ({ label: i.label, cost: +i.cost }));
    const total = r.total * tier.f;
    if (tier.f !== 1) items.push({ label: tier.name + 'lieferung (' + (tier.f > 1 ? 'Zuschlag' : 'Rabatt') + ')', cost: r.total * (tier.f - 1) });
    return { total, perBoard: total / o.qty, items, days: tier.days(base) };
  }
  function boardFacts(b) {
    const out = { w: b.w, h: b.h, nl: b.layers || 2, drills: [], minTrace: null };
    const c = CORE();
    const pads = c && c.padsOf ? safe(() => c.padsOf(b), []) : [];
    (pads || []).forEach(p => { if (p.drill > 0) out.drills.push(p.drill); });
    (b.vias || []).forEach(v => { if (v.drill > 0) out.drills.push(v.drill); });
    if ((b.tracks || []).length) out.minTrace = Math.min.apply(null, b.tracks.map(t => +t.w || 0));
    out.minDrill = out.drills.length ? Math.min.apply(null, out.drills) : null;
    return out;
  }
  function stepNote(b, s, fin) {
    const f = boardFacts(b), st = normStack(b);
    switch (s) {
      case 0: return 'Deine Platine: ' + fmt(f.w, 1) + ' × ' + fmt(f.h, 1) + ' mm, Gesamtdicke ca. ' + fmt(st.total / 1000, 2) + ' mm.';
      case 1: return 'Außenlagen: ' + fmt((b.copperOz || 1) * 35, 0) + ' µm (' + fmt(b.copperOz || 1, 1).replace(',0', '') + ' oz).' + (f.nl > 2 ? ' Innenlagen: ' + fmt((b.inOz || 0.5) * 35, 1) + ' µm.' : '');
      case 3: return 'Deine schmalste Leiterbahn: ' + (f.minTrace != null ? fmt(f.minTrace, 2) + ' mm' : 'noch keine Bahn') + '. Regel für den Abstand: ' + fmt((b.rules || {}).clearance || 0.2, 2) + ' mm.';
      case 4: return f.nl > 2 ? 'Deine Platine hat ' + f.nl + ' Lagen: ' + (f.nl / 2 - 1) + ' Kern' + (f.nl === 4 ? '' : 'e') + ' und ' + (f.nl / 2) + ' Prepreg-Schichten werden verpresst.' : 'Deine Platine hat nur 2 Lagen (oder 1): dieser Schritt entfällt.';
      case 5: return f.drills.length ? 'Deine Platine: ' + f.drills.length + ' Bohrungen, kleinster Durchmesser ' + fmt(f.minDrill, 2) + ' mm.' : 'Deine Platine hat noch keine Bohrungen.';
      case 6: return 'Vias deiner Platine: ' + (b.vias || []).length + ' (Bohrung ' + fmt((b.rules || {}).viaDrill || 0.4, 2) + ' mm, Restring mindestens ' + fmt((b.rules || {}).annular || 0.15, 2) + ' mm).';
      case 9: return 'Gewählt: ' + (fin === 'HASL' ? 'HASL (günstig)' : 'ENIG (eben, teurer)') + '. Wechsle unten die Oberfläche, die Animation passt sich an.';
      case 11: return 'Getestet werden alle ' + (b.nets || []).length + ' Netze deiner Netzliste.';
      default: return null;
    }
  }

  // ---------- DFM ----------
  const GEN = { trace: 'Leiterbahnbreite', space: 'Abstand Kupfer–Kupfer', short: 'Kurzschlüsse', drill: 'Bohrdurchmesser', annular: 'Restring', aspect: 'Aspektverhältnis (Dicke : Bohrung)', edge: 'Kupfer zum Platinenrand', via: 'Blind-/Buried-Vias', acid: 'Säurefallen (spitze Winkel)', open: 'Offene Verbindungen', silk: 'Siebdruck-Linienbreite' };
  function dfmRun(b, key) {
    const P = PROFILES[key], c = CORE(), rows = [];
    const rowsMap = {};
    const R = (id, title, fix) => { const r = { id, title, fix, items: [], warn: false }; rows.push(r); rowsMap[id] = r; return r; };
    const rTrace = R('trace', 'Leiterbahnbreite ≥ ' + fmt(P.trace, 2) + ' mm', 'Bahn verbreitern oder einen Hersteller mit feineren Regeln wählen.');
    const rSpace = R('space', 'Abstand Kupfer–Kupfer ≥ ' + fmt(P.space, 2) + ' mm', 'Bahnen auseinanderrücken oder schmaler machen (Zonen-Abstand erhöhen).');
    const rShort = R('short', 'Keine Kurzschlüsse', 'Verbindung zwischen den Netzen auftrennen.');
    const rDrill = R('drill', 'Bohrung ≥ ' + fmt(P.drill, 2) + ' mm', 'Größere Bohrung wählen (Footprint oder Via-Maß ändern).');
    const rAnn = R('annular', 'Restring ≥ ' + fmt(P.annular, 2) + ' mm', 'Pad oder Via größer machen oder Bohrung verkleinern: Restring = (Pad − Bohrung) / 2.');
    const rAsp = R('aspect', 'Aspektverhältnis Dicke : Bohrung ≤ ' + P.aspect + ' : 1', 'Kleinste Bohrung vergrößern oder dünnere Platine wählen.');
    const rEdge = R('edge', 'Kupfer zum Rand ≥ ' + fmt(P.edge, 2) + ' mm', 'Kupfer vom Platinenrand wegrücken, sonst wird beim Fräsen Kupfer freigelegt.');
    const rVia = R('via', P.blind ? 'Blind-/Buried-Vias (nach Absprache möglich)' : 'Keine Blind-/Buried-Vias', P.blind ? 'Aufpreis beim Hersteller erfragen.' : 'Auf Durchkontaktierungen umstellen oder Industrie-Hersteller wählen.');
    const rAcid = R('acid', 'Keine Säurefallen (spitze Winkel)', 'Winkel auf mindestens 90° ändern, zwei 45°-Ecken statt einer spitzen.');
    const rOpen = R('open', 'Alle Netze verbunden', 'Fehlende Verbindungen im Editor verlegen.');
    const rSilk = R('silk', 'Siebdruck-Linienbreite ≥ ' + fmt(P.silk, 2) + ' mm', 'Silk-Linienbreite in den Regeln erhöhen, sonst wird der Druck unleserlich.');
    rAcid.warn = true; rSilk.warn = true;
    const at = pt => ({ x: pt && pt[0], y: pt && pt[1] });
    (b.tracks || []).forEach(t => { if ((+t.w || 0) < P.trace - 1e-9) rTrace.items.push(Object.assign({ text: 'Leiterbahn ' + (t.net || '?') + ' auf ' + t.layer + ': ' + fmt(t.w, 2) + ' mm' }, at(t.pts && t.pts[0]))); });
    // Bohrungen und Restringe
    const pads = c && c.padsOf ? safe(() => c.padsOf(b), []) : [];
    let minDr = Infinity;
    (pads || []).forEach(p => {
      if (!(p.drill > 0)) return;
      minDr = Math.min(minDr, p.drill);
      if (p.drill < P.drill - 1e-9) rDrill.items.push({ text: (p.ref || '?') + '.' + p.n + ': Bohrung ' + fmt(p.drill, 2) + ' mm', x: p.x, y: p.y });
      const an = (Math.min(p.w, p.h) - p.drill) / 2;
      if (an < P.annular - 1e-9) rAnn.items.push({ text: (p.ref || '?') + '.' + p.n + ': Restring ' + fmt(an, 2) + ' mm', x: p.x, y: p.y });
    });
    (b.vias || []).forEach(v => {
      minDr = Math.min(minDr, v.drill || 0.4);
      if ((v.drill || 0) < P.drill - 1e-9) rDrill.items.push({ text: 'Via ' + (v.net || '?') + ': Bohrung ' + fmt(v.drill, 2) + ' mm', x: v.x, y: v.y });
      const an = ((v.dia || 0.8) - (v.drill || 0.4)) / 2;
      if (an < P.annular - 1e-9) rAnn.items.push({ text: 'Via ' + (v.net || '?') + ': Restring ' + fmt(an, 2) + ' mm', x: v.x, y: v.y });
      if (viaType(v) !== 'thru') rVia.items.push({ text: 'Via ' + (v.net || '?') + ' (' + v.from + ' bis ' + v.to + ') ist ' + (viaType(v) === 'blind' ? 'blind' : 'buried'), x: v.x, y: v.y });
    });
    if (P.blind) rVia.warn = true;
    if (isFinite(minDr) && minDr > 0) { const th = normStack(b).total / 1000, ar = th / minDr; if (ar > P.aspect + 1e-9) rAsp.items.push({ text: 'Dicke ' + fmt(th, 2) + ' mm bei Bohrung ' + fmt(minDr, 2) + ' mm = ' + fmt(ar, 1) + ' : 1' }); }
    // Rand (nur Rechteck)
    if (!(Array.isArray(b.outline) && b.outline.length > 2) && b.w && b.h) {
      const d = (x, y, r) => Math.min(x, b.w - x, y, b.h - y) - r;
      (b.tracks || []).forEach(t => { const m = Math.min.apply(null, (t.pts || []).map(pt => d(pt[0], pt[1], (t.w || 0) / 2))); if (m < P.edge - 1e-9) rEdge.items.push({ text: 'Leiterbahn ' + (t.net || '?') + ' auf ' + t.layer + ': ' + fmt(Math.max(0, m), 2) + ' mm vom Rand', x: t.pts[0][0], y: t.pts[0][1] }); });
      (pads || []).forEach(p => { const dd = d(p.x, p.y, Math.max(p.w, p.h) / 2); if (dd < P.edge - 1e-9) rEdge.items.push({ text: (p.ref || '?') + '.' + p.n + ': Pad ' + fmt(Math.max(0, dd), 2) + ' mm vom Rand', x: p.x, y: p.y }); });
      (b.vias || []).forEach(v => { const dd = d(v.x, v.y, (v.dia || 0.8) / 2); if (dd < P.edge - 1e-9) rEdge.items.push({ text: 'Via ' + (v.net || '?') + ': ' + fmt(Math.max(0, dd), 2) + ' mm vom Rand', x: v.x, y: v.y }); });
    }
    if (((b.rules || {}).silkWidth || 0.15) < P.silk - 1e-9) rSilk.items.push({ text: 'Siebdruck-Linienbreite in den Regeln: ' + fmt((b.rules || {}).silkWidth, 2) + ' mm' });
    // DRC mit Herstellerregeln
    let drcNote = null;
    if (c && c.drc) {
      try {
        const bb = cloneBoard(b);
        bb.rules = Object.assign({}, b.rules || {}, { minWidth: P.trace, clearance: P.space, minDrill: P.drill, annular: P.annular });
        const res = c.drc(bb) || [];
        res.forEach(d => {
          const o = { text: d.msg || d.type, x: d.at && d.at.x, y: d.at && d.at.y };
          if (d.type === 'clearance') rSpace.items.push(o);
          else if (d.type === 'short') rShort.items.push(o);
          else if (d.type === 'acid') rAcid.items.push(o);
          else if (d.type === 'unconnected') rOpen.items.push(o);
        });
      } catch (e) { drcNote = 'DRC nicht verfügbar: ' + (e && e.message); }
    } else drcNote = 'Der Platinen-Kern (DRC) ist nicht geladen: Abstandsprüfung entfällt.';
    return { key, rows, errors: rows.reduce((a, r) => a + (r.warn ? 0 : r.items.length), 0), warns: rows.reduce((a, r) => a + (r.warn ? r.items.length : 0), 0), drcNote };
  }

  function mountFab(el, ctx) {
    injectCss();
    const b0 = (ctx.getBoard && ctx.getBoard()) || {};
    const S = { tab: lsGet('fab.tab', 'ablauf'), step: 0, p: 0, playing: true, auto: true, speed: 1, fin: lsGet('fab.fin', 'HASL'),
      cost: { qty: 10, nl: b0.layers || 2, w: b0.w || 50, h: b0.h || 40, fin: 'HASL', tier: 1, touched: {} }, dfmSig: '', dfm: null, lastErr: null };
    const rootEl = h('div', { class: 'pf-root' }); el.appendChild(rootEl);
    let alive = true, raf = 0, last = 0, anim = null, bodyEl = null, tClock = 0, uiRefs = {};
    const board = () => (ctx.getBoard && ctx.getBoard()) || { layers: 2, w: 50, h: 40, tracks: [], vias: [], parts: [], nets: [], rules: {} };
    const visible = () => rootEl.isConnected && rootEl.getClientRects().length > 0;

    function syncCostFromBoard() {
      const b = board(), c = S.cost;
      if (!c.touched.nl) c.nl = b.layers || 2;
      if (!c.touched.w) c.w = b.w || c.w;
      if (!c.touched.h) c.h = b.h || c.h;
    }

    // ----- Ablauf
    function paintScene() { if (anim) anim.paint(); }
    function setStep(i, keepPlay) {
      S.step = clamp(i, 0, STEPS.length - 1); S.p = 0;
      renderStepInfo(); paintScene();
      if (!keepPlay) { /* Wiedergabe bleibt wie sie ist */ }
    }
    function loop(ts) {
      raf = 0;
      if (!alive) return;
      if (!visible()) { last = 0; return; }
      const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts; tClock += dt;
      if (S.playing && S.tab === 'ablauf') {
        S.p += dt * S.speed / 6;
        if (S.p >= 1) {
          if (S.auto && S.step < STEPS.length - 1) { S.step++; S.p = 0; renderStepInfo(); }
          else if (S.auto) { S.p = 1; S.playing = false; fx(ctx, 'ding', null, null, 'Platine fertig'); uiRefs.play && (uiRefs.play.textContent = '▶ Abspielen'); }
          else S.p = 0;
        }
        if (uiRefs.scrub) uiRefs.scrub.set(S.p);
      }
      if (anim && S.tab === 'ablauf') anim.paint();
      if (S.playing && S.tab === 'ablauf') raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf && alive) { last = 0; raf = requestAnimationFrame(loop); } }
    function renderStepInfo() {
      if (!uiRefs.info) return;
      const s = STEPS[S.step], b = board(), n = b.layers || 2;
      const skip = S.step === 4 && n <= 2;
      uiRefs.info.replaceChildren(
        h('h3', null, (S.step + 1) + '. ' + s.t + (skip ? ' (entfällt)' : '')),
        h('p', null, s.txt), h('div', { class: 'pf-note' }, h('b', null, 'Warum? '), s.why),
        stepNote(b, S.step, S.fin) ? h('div', { class: 'pf-note ok' }, stepNote(b, S.step, S.fin)) : null);
      uiRefs.steps && [...uiRefs.steps.children].forEach((bt, i) => { bt.className = 'pf-stp' + (i === S.step ? ' on' : i < S.step ? ' done' : '') + (i === 4 && n <= 2 ? ' skip' : ''); });
      const cur = uiRefs.steps && uiRefs.steps.children[S.step];
      if (cur && cur.scrollIntoView) { try { const p = uiRefs.steps; p.scrollLeft = cur.offsetLeft - p.clientWidth / 2 + cur.clientWidth / 2; } catch (e) { /* egal */ } }
    }
    function tabAblauf() {
      const wrap = h('div', { class: 'pf-split' });
      const left = h('div', { class: 'pf-card' }), right = h('div', { class: 'pf-card' });
      uiRefs = {};
      anim = autoCanvas(left, SCH / SCW, (g, W, H) => drawScene(g, W, H, { s: S.step, p: S.p, nl: board().layers || 2, fin: S.fin, t: tClock }), 200);
      uiRefs.steps = h('div', { class: 'pf-steps', style: 'margin-top:8px' }, STEPS.map((s, i) => h('button', { class: 'pf-stp', title: s.t, 'aria-label': 'Schritt ' + (i + 1) + ': ' + s.t, onclick: () => { setStep(i); kick(); } }, String(i + 1))));
      left.appendChild(uiRefs.steps);
      uiRefs.play = h('button', { class: 'pf-btn pri', onclick: () => { S.playing = !S.playing; if (S.playing && S.p >= 1 && S.step === STEPS.length - 1) { S.step = 0; S.p = 0; renderStepInfo(); } uiRefs.play.textContent = S.playing ? '❚❚ Pause' : '▶ Abspielen'; kick(); } }, S.playing ? '❚❚ Pause' : '▶ Abspielen');
      left.appendChild(h('div', { class: 'pf-row' }, uiRefs.play,
        h('button', { class: 'pf-btn', 'aria-label': 'Voriger Schritt', onclick: () => { setStep(S.step - 1); kick(); } }, '◀'),
        h('button', { class: 'pf-btn', 'aria-label': 'Nächster Schritt', onclick: () => { setStep(S.step + 1); kick(); } }, '▶'),
        segCtl([[0.5, '0,5×'], [1, '1×'], [2, '2×']], S.speed, v => { S.speed = v; render(); }),
        h('button', { class: 'pf-btn' + (S.auto ? ' on' : ''), onclick: e => { S.auto = !S.auto; e.currentTarget.classList.toggle('on', S.auto); } }, 'Automatisch weiter')));
      uiRefs.scrub = slider('Fortschritt', 0, 1, 0.005, S.p, v => Math.round(v * 100) + ' %', v => { S.p = v; S.playing = false; uiRefs.play.textContent = '▶ Abspielen'; paintScene(); });
      left.appendChild(uiRefs.scrub);
      left.appendChild(h('div', { class: 'pf-row' }, h('span', { class: 'pf-lbl' }, 'Oberfläche'),
        segCtl([['HASL', 'HASL (Zinn)'], ['ENIG', 'ENIG (Gold)']], S.fin, v => { S.fin = v; lsSet('fab.fin', v); S.cost.fin = v; if (S.step < 9) { S.step = 9; S.p = 0.5; } render(); })));
      uiRefs.info = h('div');
      right.appendChild(uiRefs.info);
      renderStepInfo();
      wrap.appendChild(left); wrap.appendChild(right);
      requestAnimationFrame(() => { if (anim) anim.paint(); kick(); });
      return wrap;
    }

    // ----- Kosten
    function tabKosten() {
      syncCostFromBoard();
      const C = S.cost, b = board();
      const wrap = h('div', { class: 'pf-grid' });
      const ctl = h('div', { class: 'pf-card' }), res = h('div', { class: 'pf-card' });
      const out = h('div');
      const upd = () => {
        out.replaceChildren();
        const o = { qty: C.qty, nl: C.nl, w: C.w, h: C.h, fin: C.fin, tier: C.tier };
        const r = costFor(b, o);
        if (!r) { out.appendChild(h('div', { class: 'pf-note err' }, 'Kosten nicht verfügbar: Der Platinen-Kern (PCB_CORE.cost) fehlt oder hat einen Fehler gemeldet.')); return; }
        out.appendChild(h('div', { class: 'pf-row' }, h('div', null, h('div', { class: 'pf-muted' }, 'Gesamtpreis'), h('div', { class: 'pf-big', style: 'font-size:24px' }, fmt(r.total, 2) + ' €')),
          h('div', null, h('div', { class: 'pf-muted' }, 'Pro Platine'), h('div', { class: 'pf-big', style: 'font-size:24px;color:#9fe6b0' }, fmt(r.perBoard, 2) + ' €')),
          h('div', null, h('div', { class: 'pf-muted' }, 'Lieferzeit'), h('div', { class: 'pf-big', style: 'font-size:24px;color:#ffd58a' }, r.days + ' Tage'))));
        const mx = Math.max.apply(null, r.items.map(i => Math.abs(i.cost)).concat([0.01]));
        out.appendChild(h('table', { class: 'pf-tbl' }, h('tbody', null, r.items.map(i => h('tr', null, h('td', null, i.label),
          h('td', { style: 'width:38%' }, h('div', { class: 'pf-bar' }, h('div', { style: 'width:' + clamp(Math.abs(i.cost) / mx * 100, 2, 100) + '%;background:' + (i.cost < 0 ? C_OK : C_ACC) }))), h('td', { class: 'n' }, fmt(i.cost, 2) + ' €'))))));
        // Preis nach Lagen
        const rows = [1, 2, 4, 6].map(n => { const q = costFor(b, Object.assign({}, o, { nl: n })); return [n, q ? q.perBoard : NaN]; });
        out.appendChild(h('h4', null, 'Preis pro Platine nach Lagenzahl (bei ' + C.qty + ' Stück)'));
        out.appendChild(h('table', { class: 'pf-tbl' }, h('tbody', null, rows.map(q => h('tr', { style: q[0] === C.nl ? 'color:#7fc0ff;font-weight:700' : '' }, h('td', null, q[0] + (q[0] === 1 ? ' Lage' : ' Lagen')), h('td', { class: 'n' }, fmt(q[1], 2) + ' €'), h('td', { class: 'n' }, isFinite(q[1]) && isFinite(rows[1][1]) && q[0] !== 2 ? (q[1] >= rows[1][1] ? '+' : '') + fmt((q[1] / rows[1][1] - 1) * 100, 0) + ' % zu 2 Lagen' : ''))))));
        // Kurve Menge
        const pts = QTYS.map(q => [q, (costFor(b, Object.assign({}, o, { qty: q })) || {}).perBoard]).filter(q => isFinite(q[1]));
        if (pts.length > 2) {
          const W = 320, Hh = 130, L = 40, B2 = 20, T2 = 8, Rr = 10, mxv = Math.max.apply(null, pts.map(q => q[1])), mnv = 0;
          const X = q => L + Math.log(q) / Math.log(1000) * (W - L - Rr), Y = v => Hh - B2 - (v - mnv) / (mxv - mnv || 1) * (Hh - B2 - T2);
          const svg = sv('svg', { class: 'pf-svg', viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': 'Preis pro Platine über der Menge' });
          [0, 0.5, 1].forEach(f => { const v = mxv * f; svg.appendChild(sv('line', { x1: L, y1: Y(v), x2: W - Rr, y2: Y(v), stroke: '#2c343e' })); svg.appendChild(sv('text', { x: L - 4, y: Y(v) + 4, 'text-anchor': 'end', fill: '#8b97a3', 'font-size': 9 }, fmt(v, 1))); });
          [1, 10, 100, 1000].forEach(q => svg.appendChild(sv('text', { x: X(q), y: Hh - 6, 'text-anchor': 'middle', fill: '#8b97a3', 'font-size': 9 }, String(q))));
          svg.appendChild(sv('path', { d: pts.map((q, i) => (i ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1)).join(''), fill: 'none', stroke: C_ACC, 'stroke-width': 2 }));
          svg.appendChild(sv('circle', { cx: X(C.qty), cy: Y(r.perBoard / TIERS[C.tier].f), r: 5, fill: C_WARN }));
          out.appendChild(h('h4', null, 'Preis pro Platine über der Menge (€)'));
          out.appendChild(svg);
          out.appendChild(h('p', { class: 'pf-muted' }, 'Je mehr Platinen, desto weniger kostet jede einzelne: Die Rüstkosten (Filme, Programme, Werkzeug) verteilen sich.'));
        }
        out.appendChild(h('div', { class: 'pf-row' }, h('button', { class: 'pf-btn ok', onclick: async e => {
          const bx = e.currentTarget.getBoundingClientRect();
          if (await askYes(ctx, 'Platine bestellen? ' + C.qty + ' Stück für ' + fmt(r.total, 2) + ' € (Simulation, es wird nichts wirklich bestellt).')) { fx(ctx, 'tada', bx.left + bx.width / 2, bx.top, 'Platine bestellt!'); toast(ctx, 'Platine bestellt (Simulation): ' + C.qty + ' Stück, Lieferung in ' + r.days + ' Tagen.'); }
        } }, 'Platine bestellen (Simulation)'),
          h('span', { class: 'pf-muted' }, 'Preise sind ein Modell für die Übung, keine Herstellerpreise.')));
      };
      ctl.appendChild(h('h3', null, 'Kostenrechner'));
      const qi = Math.max(0, QTYS.indexOf(C.qty) < 0 ? QTYS.findIndex(q => q >= C.qty) : QTYS.indexOf(C.qty));
      ctl.appendChild(slider('Menge', 0, QTYS.length - 1, 1, qi, v => QTYS[v] + ' Stück', v => { C.qty = QTYS[v]; upd(); }));
      ctl.appendChild(h('div', { class: 'pf-row' }, h('span', { class: 'pf-lbl' }, 'Lagenzahl'), segCtl([[1, '1'], [2, '2'], [4, '4'], [6, '6']], C.nl, v => { C.nl = v; C.touched.nl = true; tabRerender(); })));
      ctl.appendChild(slider('Breite', 10, 300, 1, C.w, v => v + ' mm', v => { C.w = v; C.touched.w = true; upd(); }));
      ctl.appendChild(slider('Höhe', 10, 300, 1, C.h, v => v + ' mm', v => { C.h = v; C.touched.h = true; upd(); }));
      ctl.appendChild(h('div', { class: 'pf-row' }, h('span', { class: 'pf-lbl' }, 'Oberfläche'), segCtl([['HASL', 'HASL'], ['ENIG', 'ENIG']], C.fin, v => { C.fin = v; S.fin = v; lsSet('fab.fin', v); tabRerender(); })));
      ctl.appendChild(h('div', { class: 'pf-row' }, h('span', { class: 'pf-lbl' }, 'Lieferzeit'), segCtl(TIERS.map((t, i) => [i, t.name]), C.tier, v => { C.tier = v; tabRerender(); })));
      ctl.appendChild(h('div', { class: 'pf-row' }, h('button', { class: 'pf-btn', onclick: () => { C.touched = {}; syncCostFromBoard(); tabRerender(); } }, 'Werte der Platine übernehmen'),
        h('span', { class: 'pf-muted' }, 'Platine: ' + (b.layers || 2) + ' Lagen, ' + fmt(b.w, 0) + ' × ' + fmt(b.h, 0) + ' mm')));
      res.appendChild(h('h3', null, 'Preis und Lieferzeit'));
      res.appendChild(out);
      wrap.appendChild(ctl); wrap.appendChild(res);
      upd();
      return wrap;
    }
    function tabRerender() { render(); }

    // ----- DFM
    function dfmCompute() {
      const b = board();
      let sig = '';
      try { sig = JSON.stringify(b); } catch (e) { sig = String(Math.random()); }
      if (sig === S.dfmSig && S.dfm) return;
      S.dfmSig = sig;
      S.dfm = { proto: dfmRun(cloneBoard(b), 'proto'), ind: dfmRun(cloneBoard(b), 'ind') };
    }
    function tabDfm() {
      dfmCompute();
      const D = S.dfm, wrap = h('div', null);
      const sum = h('div', { class: 'pf-grid', style: 'margin-bottom:12px' });
      ['proto', 'ind'].forEach(k => {
        const P = PROFILES[k], r = D[k], ok = r.errors === 0;
        sum.appendChild(h('div', { class: 'pf-card' }, h('h3', null, P.name + '-Hersteller'),
          h('div', { class: 'pf-row' }, h('span', { class: 'pf-badge ' + (ok ? 'ok' : 'err') }, ok ? 'Fertigbar' : r.errors + ' Verstoß' + (r.errors === 1 ? '' : 'e')), r.warns ? h('span', { class: 'pf-badge warn' }, r.warns + ' Hinweis' + (r.warns === 1 ? '' : 'e')) : null),
          h('p', { class: 'pf-muted' }, 'Bahn/Abstand ' + fmt(P.trace, 2) + ' mm, Bohrung ' + fmt(P.drill, 2) + ' mm, Restring ' + fmt(P.annular, 2) + ' mm.')));
      });
      wrap.appendChild(sum);
      const e1 = D.proto.errors, e2 = D.ind.errors;
      if (S.lastErr != null && S.lastErr > 0 && e1 + e2 === 0) fx(ctx, 'ding', null, null, 'Fertigungsreif!');
      S.lastErr = e1 + e2;
      if (e1 > 0 && e2 === 0) wrap.appendChild(h('div', { class: 'pf-note warn' }, 'Beim Prototypen-Hersteller gibt es Verstöße, ein Industrie-Hersteller mit feineren Regeln würde die Platine fertigen. Meist ist es billiger, die Platine großzügiger zu legen.'));
      else if (e1 + e2 === 0) wrap.appendChild(h('div', { class: 'pf-note ok' }, 'Beide Profile: kein Verstoß. Deine Platine ist fertigungsreif.'));
      else if (e2 > 0) wrap.appendChild(h('div', { class: 'pf-note err' }, 'Selbst die Industrieregeln werden verletzt. Behebe zuerst diese Punkte.'));
      if (D.proto.drcNote) wrap.appendChild(h('div', { class: 'pf-note warn' }, D.proto.drcNote));
      const card = h('div', { class: 'pf-card' }, h('h3', null, 'DFM-Prüfliste (Design for Manufacturing)'));
      D.proto.rows.forEach((r, i) => {
        const r2 = D.ind.rows[i];
        const bad = (r.warn ? 0 : r.items.length) + (r2.warn ? 0 : r2.items.length);
        const d = h('details', { class: 'pf-acc', style: 'border-bottom:1px solid #2c343e' });
        const badge = (rr, nm) => h('span', { class: 'pf-badge ' + (rr.items.length ? (rr.warn ? 'warn' : 'err') : 'ok'), style: 'margin-left:6px' }, nm + ': ' + (rr.items.length ? rr.items.length + (rr.warn ? ' Hinweis' : ' ✗') : '✓'));
        d.appendChild(h('summary', { style: 'flex-wrap:wrap;gap:4px' }, h('span', { style: 'flex:1 1 220px' }, (r.items.length + r2.items.length ? (bad ? '✗ ' : '! ') : '✓ ') + (GEN[r.id] || r.title)), badge(r, 'Prototyp'), badge(r2, 'Industrie')));
        if (r.items.length + r2.items.length) {
          [['Prototyp', r], ['Industrie', r2]].forEach(q => {
            if (!q[1].items.length) return;
            d.appendChild(h('h4', null, q[0] + ': ' + q[1].title));
            const ul = h('div', { class: 'pf-list' });
            q[1].items.slice(0, 12).forEach(it => ul.appendChild(h('div', { class: 'pf-row', style: 'margin:0' }, h('span', { style: 'flex:1 1 200px' }, it.text + (it.x != null && isFinite(it.x) ? ' (bei ' + fmt(it.x, 1) + ' / ' + fmt(it.y, 1) + ' mm)' : '')),
              (ctx.jump || ctx.goto) && it.x != null && isFinite(it.x) ? h('button', { class: 'pf-btn', onclick: () => { try { if (ctx.jump) ctx.jump({ at: { x: it.x, y: it.y }, x: it.x, y: it.y }); else ctx.goto(it.x, it.y); } catch (e) { /* egal */ } } }, 'Zeigen') : null)));
            if (q[1].items.length > 12) ul.appendChild(h('span', { class: 'pf-muted' }, '… und ' + (q[1].items.length - 12) + ' weitere'));
            d.appendChild(ul);
          });
          d.appendChild(h('div', { class: 'pf-note' }, h('b', null, 'So behebst du es: '), r.fix));
        } else d.appendChild(h('p', { class: 'pf-muted', style: 'margin-top:6px' }, 'Kein Verstoß.' + (r.id === 'via' ? ' Es gibt keine Blind- oder Buried-Vias.' : '')));
        card.appendChild(d);
      });
      card.appendChild(h('div', { class: 'pf-row', style: 'margin-top:8px' }, h('button', { class: 'pf-btn', onclick: () => { S.dfmSig = ''; render(); toast(ctx, 'Prüfung neu gerechnet'); } }, 'Neu prüfen')));
      wrap.appendChild(card);
      wrap.appendChild(h('p', { class: 'pf-muted' }, 'Die Mindestwerte der Profile sind Übungswerte (Prototyp 0,15 / 0,3 / 0,15 mm, Industrie 0,1 / 0,2 / 0,1 mm für Bahn und Abstand / Bohrung / Restring). Echte Hersteller nennen ihre Werte in der Fertigungsspezifikation.'));
      return wrap;
    }

    function render() {
      if (!alive) return;
      if (anim && anim.ro) anim.ro.disconnect();
      anim = null;
      const keep = bodyEl ? bodyEl.scrollTop : 0;
      rootEl.replaceChildren();
      rootEl.appendChild(tabsBar([['ablauf', 'Ablauf'], ['kosten', 'Kosten'], ['dfm', 'DFM-Prüfung']], S.tab, t => { S.tab = t; lsSet('fab.tab', t); render(); }));
      bodyEl = h('div', { class: 'pf-body' });
      rootEl.appendChild(bodyEl);
      try { bodyEl.appendChild(S.tab === 'kosten' ? tabKosten() : S.tab === 'dfm' ? tabDfm() : tabAblauf()); }
      catch (e) { bodyEl.appendChild(h('div', { class: 'pf-note err' }, 'Anzeige nicht möglich: ' + (e && e.message))); }
      bodyEl.scrollTop = keep;
      if (S.tab === 'ablauf') kick();
    }
    render();
    return {
      refresh() { if (!alive) return; if (S.tab === 'ablauf') { renderStepInfo(); paintScene(); kick(); } else render(); },
      onShow() { render(); },
      onBoard() { S.cost.touched = {}; S.dfmSig = ''; render(); },
      destroy() { alive = false; if (raf) cancelAnimationFrame(raf); if (anim && anim.ro) anim.ro.disconnect(); rootEl.remove(); }
    };
  }

  // ------------------------------------------------------------------ Registrierung
  const REG = root.PCB_VIEWS = root.PCB_VIEWS || { views: {}, register(id, def) { this.views[id] = def; } };
  REG.register('stack', { title: 'Lagen', mount: mountStack });
  REG.register('gerber', { title: 'Gerber', mount: mountGerber });
  REG.register('fab', { title: 'Fertigung', mount: mountFab });
  root.PCB_FAB = { makeZip, crc32, classify, normStack, zMicro, zStrip, dfmRun, costFor, drawScene, version: '1.0' };
})(typeof window !== 'undefined' ? window : globalThis);
