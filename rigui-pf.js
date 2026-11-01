'use strict';
/* rigui-pf.js (Schlank Stufe 4): Bloecke der Pruefstand-Labs fuer RIGUI. GENERIERT von quelle/gen/rigui/build_rigui.js, nicht von Hand aendern.
   Labs im Kit-Modus: wsl, ana, els. Fehlt rigui-base.js, tut diese Datei nichts. */
(function (__rgRoot) {
  const __rgR = __rgRoot.RIGUI; if (!__rgR) return;
  const __rgB = __rgR.B;
  __rgB['p~ana+els+wsl~434882e1'] = { d: ["loadExample","root","setCtl"], l: [], f: function (__rk) { const { loadExample, root, setCtl } = __rk;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const AMP = { gruen: { sym: '✓', name: 'grün', cls: 'ok' }, gelb: { sym: '!', name: 'gelb', cls: 'warnc' }, rot: { sym: '✗', name: 'rot', cls: 'bad' }, grau: { sym: '–', name: 'grau', cls: '' } };
  const B = (id, name, cat, rig, desc, controls, extra) => Object.assign({ id, name, cat, rig, desc, controls }, extra || {});
  const CMPSYM = { '<=': '≤', '>=': '≥', '=': '=' };
  const NARROW_AR = '5/6';
  const PRE = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  const QLEVELS = ['hoch', 'mittel', 'niedrig'];
  const RANK = { grau: 0, rot: 1, gelb: 2, gruen: 3 };
  const SELFIRST = c => (c && (c.type === 'select' || c.type === 'switch') ? 0 : 1);
  const SIBASE = /^(Hz|F|H|Ω|V|A|W|s)$/;
  const adig = v => { v = Math.abs(v); return v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : v >= 0.1 ? 3 : 4; };
  const ampKey = a => { a = String(a || 'grau').toLowerCase().replace('ü', 'ue'); return AMP[a] ? a : 'grau'; };
  function applyHit(h) {
    if (h.set && typeof h.set === 'object') { Object.keys(h.set).forEach(k => setCtl(k, h.set[k])); return true; }
    if (h.to !== undefined) { setCtl(h.key, h.to); return true; }
    return false;
  }
  function assessOf(rig) { let a = null; try { a = rig && typeof rig.assess === 'function' ? rig.assess() : null; } catch (e) { a = null; } return a && typeof a === 'object' ? a : null; }
  const bgOf = () => (getComputedStyle(document.documentElement).getPropertyValue('--cv') || '#14181c').trim();
  const canSound = () => !root.navigator || !navigator.userActivation || navigator.userActivation.hasBeenActive;
  const choiceOpts = c => (c.options || []).map(o => (o && typeof o === 'object' ? { value: o.value, label: o.label != null ? o.label : String(o.value) } : { value: o, label: String(o) }));
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clickSnd = (k, v) => { if (root.LochFX && canSound()) try { root.LochFX.sound(k || 'tick', v); } catch (e) {} };
  const clone = o => JSON.parse(JSON.stringify(o));
  function confirmSheet(title, text, okLabel, danger) {
    return new Promise(res => {
      let done = false; const fin2 = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        b.innerHTML = `<p style="margin-top:0">${text}</p><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn ${danger ? 'danger' : 'pri'}" data-ok>${esc(okLabel || 'OK')}</button></div>`;
        $('[data-c]', b).onclick = close; $('[data-ok]', b).onclick = () => { fin2(true); close(); };
      }, () => fin2(false));
    });
  }
  function csvNum(v) { return fin(v) ? String(+(+v).toPrecision(9)).replace('.', ',') : ''; }
  const ctlOfRig = (r, k) => { const c = (r.controls || []).find(x => x && x.key === k); return c && c.type === 'select' ? Object.assign({}, c, { options: optNorm(c.options) }) : c; };
  const decs = step => { step = +step || 0; if (!step || step >= 1) return 0; return Math.min(3, Math.ceil(-Math.log10(step) - 1e-9)); };
  const defVal = c => (c.type === 'switch' || c.type === 'button' ? !!c.value : c.type === 'select' ? (c.value !== undefined ? c.value : (c.options && c.options[0] ? c.options[0].value : '')) : (c.value != null ? c.value : c.min));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fauto = v => (fin(v) ? fnum(v, adig(v)) : '–');
  const fin = v => typeof v === 'number' && isFinite(v);
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',') : '–');
  const fxOn = () => !!(root.LochFX && !root.LochFX.isMuted());
  const isDark = () => { const a = document.documentElement.getAttribute('data-theme'); if (a === 'dark') return true; if (a === 'light') return false; try { return !(root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches); } catch (e) { return true; } };
  const isWarn = (m, v) => (fin(+m.warnAbove) && v > +m.warnAbove) || (fin(+m.warnBelow) && v < +m.warnBelow);
  const limBadge = l => (l.status === 'belegt' ? '<span class="bdg ok" title="belegt: Prüfungspool oder Ausbilder">✓ belegt</span>' : '<span class="bdg uw" title="Übungswert: Der Ausbilder gleicht ab">Übungswert (A)</span>');
  const limSrc = l => (l.status !== 'belegt' ? 'Der Ausbilder gleicht ab' + (l.frage ? ' (' + l.frage + ')' : '') : /^pool:/.test(l.quelle || '') ? 'Quelle: Prüfungs-Pool ' + l.quelle.slice(5) : l.quelle === 'toni' ? 'Quelle: Ausbilder' : 'Quelle: ' + (l.quelle || '–'));
  const loadExampleByName = n => loadExample(String(n || ''));
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsPut = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const lsRaw = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const margTxt = a => (a && fin(a.margin) ? 'Marge ' + fnum(a.margin, 2) + (a.marginUnit ? ' ' + a.marginUnit : '') : '');
  function markDone(id, pct) {
    try { const d = taskDone(); if ((d[id] || 0) < pct) d[id] = pct; localStorage.setItem('sim.done', JSON.stringify(d)); } catch (e) {}
    if (root.Badges) root.Badges.result(id, pct);
  }
  const optLabel = (c, v) => { const o = (c.options || []).find(q => q.value === v || String(q.value) === String(v)); return o ? o.label : String(v); };
  const optNorm = o => (Array.isArray(o) ? o : []).map(x => (x && typeof x === 'object' ? { value: x.value, label: x.label != null ? x.label : String(x.value) } : { value: x, label: String(x) }));
  async function packShare(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj)); let out = bytes, tag = 's';
    if (root.CompressionStream) { try { const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); w.write(bytes); w.close(); out = new Uint8Array(await new Response(cs.readable).arrayBuffer()); tag = 'z'; } catch (e) {} }
    let bin = ''; out.forEach(b => { bin += String.fromCharCode(b); });
    return tag + '=' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  const pad2 = n => String(n).padStart(2, '0');
  function parseCsv(txt) {
    const out = []; String(txt || '').split(/\r?\n/).forEach(ln => {
      if (!ln || ln[0] === '#') return; const c = ln.split(';'), n = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return fin(x) ? x : null; };
      const x = n(c[0]), y = n(c[1]); if (x != null && y != null) out.push({ x, y, name: c[2] || '' });
    });
    return out;
  }
  function pick(title, options, opt) {
    opt = opt || {};
    return new Promise(res => {
      let done = false; const fin2 = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        b.innerHTML = (opt.intro ? `<p class="hint2" style="margin-top:0">${esc(opt.intro)}</p>` : '') + '<div id="pl"></div>';
        $('#pl', b).innerHTML = options.map((o, i) => `<button class="row" data-i="${i}"${o.disabled ? ' disabled' : ''}>${o.icon ? `<span class="ric">${o.icon}</span>` : ''}<div class="grow"><b>${esc(o.label)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div>${o.mark ? `<span class="lv">${esc(o.mark)}</span>` : ''}</button>`).join('');
        b.addEventListener('click', e => { const r = e.target.closest('.row[data-i]'); if (!r || r.disabled) return; fin2(options[+r.dataset.i].value); close(); });
      }, () => fin2(null));
    });
  }
  const rowEnd = r => (+r.t || 0) + (r.kind === 'ramp' ? (+r.dur || 0) : 0);
  const rowNorm = rows => (rows || []).filter(r => r && typeof r === 'object').map(r => (r.kind === 'fire' ? { t: +r.t || 0, kind: 'fire' } : r.kind === 'do' ? { t: +r.t || 0, kind: 'do', key: String(r.key || '') } : r.kind === 'ramp' ? { t: +r.t || 0, kind: 'ramp', key: r.key, to: +r.to, dur: +r.dur || 0 } : { t: +r.t || 0, kind: 'set', key: r.key, value: r.value }));
  function saveCsv(txt, fallbackName) {
    const blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' });
    if (root.LabExport && root.LabExport.saveBlob) { try { root.LabExport.saveBlob(blob, root.LabExport.fname ? root.LabExport.fname('csv') : fallbackName); return; } catch (e) {} }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fallbackName; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function seqToRows(seq) {
    const rows = []; if (!Array.isArray(seq)) return rows;
    seq.forEach(s => {
      if (!s) return;
      if (s.fire) rows.push({ t: +s.t || 0, kind: 'fire' });
      if (s.do != null) rows.push({ t: +s.t || 0, kind: 'do', key: String(s.do) });
      if (s.ramp && typeof s.ramp === 'object' && s.ramp.key != null) rows.push({ t: +s.t || 0, kind: 'ramp', key: s.ramp.key, to: +s.ramp.to, dur: +s.ramp.durS || 0 });
      if (s.set && typeof s.set === 'object') Object.keys(s.set).forEach(k => rows.push({ t: +s.t || 0, kind: 'set', key: k, value: s.set[k] }));
      else if (s.key != null) rows.push({ t: +s.t || 0, kind: 'set', key: s.key, value: s.value });
    });
    return rows;
  }
  const sgn = v => (v > 0 ? '+' : '');
  function sheet(title, build, onClose) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sh-h"><b>${esc(title)}</b><button class="x" aria-label="Schließen">✕</button></div><div class="sh-b"></div></div>`;
    document.body.appendChild(bd);
    let closed = false;
    const close = () => { if (closed) return; closed = true; bd.remove(); if (onClose) onClose(); };
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
    $('.x', bd).onclick = close;
    build($('.sh-b', bd), close);
    return close;
  }
  const siUnit = c => !!(c.unit && SIBASE.test(c.unit));
  const slPos = (c, v) => { if (c.scale === 'log' && c.min > 0 && c.max > c.min) return Math.round(1000 * Math.log(clamp(v, c.min, c.max) / c.min) / Math.log(c.max / c.min)); return Math.round(1000 * (clamp(v, c.min, c.max) - c.min) / ((c.max - c.min) || 1)); };
  function slVal(c, pos) {
    let v = c.scale === 'log' && c.min > 0 && c.max > c.min ? c.min * Math.pow(c.max / c.min, pos / 1000) : c.min + (c.max - c.min) * pos / 1000;
    if (c.step && c.scale !== 'log') v = Math.round(v / c.step) * c.step; else if (c.scale === 'log') { const d = fin(v) ? Math.pow(10, Math.floor(Math.log10(Math.max(1e-12, v))) - 2) : 0.01; v = Math.round(v / d) * d; }
    return clamp(+v.toPrecision(10), c.min, c.max);
  }
  const stat = (k, v, m) => { if (root.Badges) try { root.Badges.stat(k, v, m); } catch (e) {} };
  const taskDone = () => lsGet('sim.done', {});
  const theme = () => (isDark() ? 'dark' : 'light');
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2400, String(m).length * 55)); }
  const tstamp = t => (fin(+t) ? fnum(+t, 1) + ' s' : '');
  const typing = e => { const t = e.target; return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); };
  const uid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  async function unpackShare(h) {
    const m = String(h).match(/^#?([sz])=([\w-]+)$/); if (!m) return null;
    let b64 = m[2].replace(/-/g, '+').replace(/_/g, '/'); while (b64.length % 4) b64 += '=';
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); let txt;
    if (m[1] === 'z') { const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(bytes); w.close(); txt = new TextDecoder().decode(await new Response(ds.readable).arrayBuffer()); }
    else txt = new TextDecoder().decode(bytes);
    return JSON.parse(txt);
  }
  return [{ $, $$, AMP, B, CMPSYM, NARROW_AR, PRE, QLEVELS, RANK, SELFIRST, adig, ampKey, applyHit, assessOf, bgOf, canSound, choiceOpts, clamp, clickSnd, clone, confirmSheet, csvNum, ctlOfRig, decs, defVal, esc, fauto, fin, fnum, fxOn, isWarn, limBadge, limSrc, loadExampleByName, lsGet, lsPut, lsRaw, lsSet, margTxt, markDone, optLabel, optNorm, packShare, parseCsv, pick, rowEnd, rowNorm, saveCsv, seqToRows, sgn, sheet, siUnit, slPos, slVal, stat, taskDone, theme, toast, tstamp, typing, uid, unpackShare }]; } };
  __rgB['k~ana+wsl~b587eda6'] = { d: ["GRUPPEN","ORDER","PK","S","allCtl","applyCtl","buildControls","buildMeters","buildSicht","clone","curRows","deepGet","defOf","lsSet","rigName","saveCur","saveCurSoon","saves","seqDur","setRig","setTab","toast","uid","updateChrome"], l: ["buildPresets","stash"], f: function (__rk) { const { GRUPPEN, ORDER, PK, S, allCtl, applyCtl, buildControls, buildMeters, buildSicht, clone, curRows, deepGet, defOf, lsSet, rigName, saveCur, saveCurSoon, saves, seqDur, setRig, setTab, toast, uid, updateChrome } = __rk; let buildPresets, stash;
  const deepOpened = () => +deepGet().n || 0;
  const gruppeOf = c => (c && c.gruppe && GRUPPEN[c.gruppe] ? c.gruppe : 'ziel');
  function loadRig(o) {
    o = o || {}; if (S.task) { toast('Beende zuerst die Aufgabe.'); return false; }
    const id = o.rig && ORDER.includes(o.rig) ? o.rig : S.rigId; if (!defOf(id)) { toast('Dieser Prüfstand ist noch nicht geladen.'); return false; }
    const had = stash(); S.name = o.name || 'Neuer Versuch'; S.id = null; S.dirty = false; S.rows[id] = []; setRig(id);
    if (o.preset && S.rig && typeof S.rig.applyPreset === 'function') { try { S.rig.applyPreset(o.preset); S.preset = o.preset; } catch (e) { console.error(e); } buildControls(); buildMeters(); buildPresets(); buildSicht(); }
    if (o.controls) applyCtl(o.controls);
    setTab(o.tab || 'rig'); updateChrome(); saveCurSoon(); toast(had ? 'Geladen, dein Versuch ist gesichert' : (o.toast || 'Im Prüfstand geladen: ' + rigName(id)));
    return true;
  }
  function saveItem(name) {
    const a = saves(), id = S.id || uid(); S.id = id; S.name = name || S.name;
    const e = { id, name: S.name, t: Date.now(), rig: S.rigId, ctl: allCtl(), ref: S.ref ? clone(S.ref) : null, refMode: S.refMode, rows: clone(curRows()), dur: seqDur(), bericht: S.bericht ? clone(S.bericht) : null };
    const i = a.findIndex(x => x.id === id); if (i >= 0) a[i] = e; else a.push(e);
    lsSet(PK, a.slice(-100)); S.dirty = false; updateChrome(); saveCur();
  }
  return [{ deepOpened, gruppeOf, loadRig, saveItem }, function (__rk) { ({ buildPresets, stash } = __rk); }]; } };
  __rgB['k~ana+els+wsl~b2abfc64'] = { d: ["$","CORE","FIREHINT","FIRELBL","KEYS","ORDER","PK","PRE","QLEVELS","RIGLIMITS","RIGMETA","S","SELFIRST","TABS","TK","adig","ampKey","applyItem","assessOf","buildPal","clamp","clickSnd","clone","confirmSheet","ctlDef","ctlOfRig","ctlsOf","cvs","defOf","doFire","esc","extRefresh","fin","fnum","lsGet","lsSet","mqReduce","optLabel","pick","renderSweepLive","renderTasks","root","rowEnd","saveCurSoon","setCtl","setRig","setRun","setTab","sheet","simText","slVal","stat","syncCtl","taskDone","toast","unpackShare","updateAmp","updateQLine","updateTitle","updateWipeDom"], l: ["buildRefRig","ctlParse","ctlShow","renderSeqRes","resetRig","rigPng","seqKeys","stash"], f: function (__rk) { const { $, CORE, FIREHINT, FIRELBL, KEYS, ORDER, PK, PRE, QLEVELS, RIGLIMITS, RIGMETA, S, SELFIRST, TABS, TK, adig, ampKey, applyItem, assessOf, buildPal, clamp, clickSnd, clone, confirmSheet, ctlDef, ctlOfRig, ctlsOf, cvs, defOf, doFire, esc, extRefresh, fin, fnum, lsGet, lsSet, mqReduce, optLabel, pick, renderSweepLive, renderTasks, root, rowEnd, saveCurSoon, setCtl, setRig, setRun, setTab, sheet, simText, slVal, stat, syncCtl, taskDone, toast, unpackShare, updateAmp, updateQLine, updateTitle, updateWipeDom } = __rk; let buildRefRig, ctlParse, ctlShow, renderSeqRes, resetRig, rigPng, seqKeys, stash;
  const allCtl = () => {
    if (!S.rig) return {};
    if (typeof S.rig.getControls === 'function') { try { const o = S.rig.getControls(); if (o && typeof o === 'object') return clone(o); } catch (e) {} }
    const o = {}; ctlsOf().forEach(c => { try { const v = S.rig.getControl(c.key); if (v !== undefined) o[c.key] = v; } catch (e) {} }); return o;
  };
  const ampelNow = () => { const a = assessOf(S.rig); return a ? ampKey(a.ampel) : 'grau'; };
  function applyCtl(map) {
    if (!S.rig || !map) return;
    const keys = Object.keys(map).sort((a, b) => SELFIRST(ctlDef(a)) - SELFIRST(ctlDef(b)));
    keys.forEach(k => {
      const v = coerce(ctlDef(k), map[k]); if (v === undefined) return;
      try { S.rig.setControl(k, v); S.ctl[k] = v; } catch (e) { console.error('Steuerwert ' + k, e); }
    });
    syncCtl(true);
  }
  function ask(title, fields, opt) {
    opt = opt || {};
    return new Promise(res => {
      let done = false; const fin2 = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        b.innerHTML = (opt.intro ? `<p class="hint2" style="margin-top:0">${esc(opt.intro)}</p>` : '') + fields.map((f, i) =>
          `<label class="f"><span>${esc(f.label)}</span><input id="ak${i}" type="text" inputmode="${f.type === 'number' ? 'decimal' : 'text'}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(f.value == null ? '' : f.value)}"></label>`).join('') +
          '<div id="akErr" class="hint2 err"></div><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn pri" data-ok>OK</button></div>';
        const ok = () => {
          const out = {};
          for (let i = 0; i < fields.length; i++) {
            const f = fields[i], raw = $('#ak' + i, b).value;
            if (f.type === 'number') { const v = parseNum(raw); if (!fin(v)) { $('#akErr', b).textContent = f.label + ': Bitte eine Zahl eingeben.'; return; } out[f.key] = v; } else out[f.key] = raw;
          }
          fin2(out); close();
        };
        $('[data-c]', b).onclick = close; $('[data-ok]', b).onclick = ok;
        b.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
        if (!('ontouchstart' in window)) setTimeout(() => { const i = $('#ak0', b); if (i) { i.focus(); i.select(); } }, 60);
      }, () => fin2(null));
    });
  }
  function backToRef() {
    if (!S.ref || !S.rig) return; try { S.rig.restore(clone(S.ref)); } catch (e) { console.error(e); toast('Zurückstellen nicht möglich.'); return; }
    S.refMode = 'nachher'; S.dirty = true; saveCurSoon(); syncCtl(true); readState(); buildBA(); updateAmp(true); toast('Zurück zum Vorher: Die Einstellungen sind wieder wie beim Merken.');
  }
  function buildBA() {
    const el = $('#baBar'); if (!el) return;
    const mode = (v, t, key) => `<button data-bm="${v}" class="${S.refMode === v ? 'on' : ''}" aria-pressed="${S.refMode === v}" title="${esc(key)}">${t}</button>`;
    el.innerHTML = `<div class="barow"><button class="chip s" data-ba="merk" title="Taste M">📌 Merken</button>${S.ref ? `<span class="seg" aria-label="Anzeige">${mode('vorher', 'Vorher', 'V')}${mode('nachher', 'Nachher', 'V')}${mode('wischer', 'Wischer', 'W')}</span><button class="chip s${S.ghost ? ' on' : ''}" data-ba="ghost" aria-pressed="${S.ghost}" title="Vorher als blasses Geisterbild hinter dem Bild">👻 Geisterbild</button><button class="chip s" data-ba="back">↩ Zurück zum Vorher</button><button class="chip s" data-ba="clear">✕ Vergessen</button>` : '<span class="hint2 inl">Merke einen Zustand, ändere dann etwas und vergleiche: Vorher | Nachher | Wischer.</span>'}</div>`;
    const wb = $('#wipeBar'); if (wb) { wb.hidden = !(S.ref && S.refMode === 'wischer'); updateWipeDom(); }
  }
  function buildPick() {
    $('#rigPick').innerHTML = ORDER.map(id => {
      const have = !!defOf(id);
      return `<button class="chip${id === S.rigId ? ' on' : ''}${have ? '' : ' miss'}" data-rig="${id}">${rigIcon(id)} ${esc(rigName(id))}${have ? '' : ' ⚠'}</button>`;
    }).join('');
  }
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd" style="display:none"></span>' : ''}</button>`).join('');
    updateTaskBadge();
  }
  const canFire = () => !!(S.rig && typeof S.rig.fire === 'function');
  const choicesOf = t => { let f = t.choices; if (typeof f === 'function') { try { f = f(S.taskStart); } catch (e) { f = []; } } return Array.isArray(f) ? f : []; };
  function coerce(def, v) {
    if (!def) return undefined;
    if (v && typeof v === 'object' && 'rel' in v && def.type === 'slider') v = def.min + (def.max - def.min) * (+v.rel || 0);
    if (def.type === 'slider') { v = typeof v === 'string' ? parseNum(v) : +v; if (!fin(v)) return undefined; return clamp(v, def.min, def.max); }
    if (def.type === 'switch' || def.type === 'button') return !!v;
    if (def.type === 'select') {
      const o = def.options || [];
      const m = o.find(x => x.value === v) || o.find(x => String(x.value) === String(v)) || (typeof v === 'number' ? o.find(x => typeof x.value === 'number' && Math.abs(x.value - v) <= 1e-9 * Math.max(1, Math.abs(v))) : null) || o.find(x => String(x.label).toLowerCase() === String(v).toLowerCase());
      return m ? m.value : undefined;
    }
    return v;
  }
  const curQ = () => (reduced() ? 'niedrig' : S.q.mode === 'auto' ? S.q.level : S.q.mode);
  const curRows = () => S.rows[S.rigId] || (S.rows[S.rigId] = []);
  const curTask = () => { const a = TK(); return a && S.task ? a.find(t => t.id === S.task.id) : null; };
  const cvPos = e => { const r = cvs.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const cval = k => { try { return S.rig.getControl(k); } catch (e) { return undefined; } };
  function exportPng() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    const c = rigPng(1600, 1000);
    c.toBlob(b => { if (b && root.LabExport) { root.LabExport.saveBlob(b, root.LabExport.fname('png')); stat('png'); } else toast('Bild konnte nicht erzeugt werden'); }, 'image/png');
  }
  function fe(x, unit) {
    const C = CORE(); if (C && typeof C.fmtEng === 'function') { try { const t = C.fmtEng(x, unit || ''); if (typeof t === 'string' && t) return t; } catch (e) {} }
    if (!fin(x)) return '–'; if (x === 0) return '0 ' + (unit || ''); const a = Math.abs(x), p = PRE.find(q => a >= q[0] * 0.9995) || PRE[PRE.length - 1], v = x / p[0];
    return String(+v.toFixed(Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2)).replace('.', ',') + ' ' + p[1] + (unit || '');
  }
  const fieldsOf = t => { let f = t.fields; if (typeof f === 'function') { try { f = f(S.taskStart); } catch (e) { f = []; } } return Array.isArray(f) ? f : []; };
  const fireHtml = () => (canFire() && !hasCtl('fire') ? `<div class="ct p0" data-fire="1"><button class="bt fire" title="Taste F" aria-label="${esc(FIRELBL[S.rigId] || 'Auslösen')} (Taste F)">⚡ ${esc(FIRELBL[S.rigId] || 'Auslösen')}</button><div class="bth"><small class="hp" style="padding:0 12px">${esc(FIREHINT[S.rigId] || '')}</small></div></div>` : '');
  const hasCtl = k => !!ctlDef(k);
  function importSheet() {
    sheet('Aus Code oder Link laden', (b, close) => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">Füge einen Teilen-Link oder Code ein.</p><textarea id="tx" rows="6"></textarea><div class="btns"><button class="btn pri" id="ld">Laden</button></div>';
      $('#ld', b).onclick = async () => { const t = $('#tx', b).value.trim(), h = t.includes('#') ? t.slice(t.indexOf('#')) : t; if (await loadShared(h.startsWith('#') ? h : '#' + h)) close(); };
    });
  }
  function keysHtml() {
    const kd = a => a.map(x => `<code>${esc(x)}</code>`).join(' oder ');
    return '<table>' + KEYS.map(k => `<tr><td class="nw">${kd(k.keys)}</td><td>${esc(k.t)}</td></tr>`).join('') + '</table><p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>';
  }
  const keysSheet = () => sheet('Tastenkürzel', b => { b.innerHTML = keysHtml(); });
  const limGet = id => { const C = CORE(); try { const l = C && typeof C.limit === 'function' ? C.limit(id) : null; return l && l.ok !== false && l.id ? l : null; } catch (e) { return null; } };
  function limIds() { const ids = new Set(RIGLIMITS[S.rigId] || []); ctlsOf().forEach(c => { if (c && c.limit) ids.add(c.limit); }); metersOf().forEach(m => { if (m && m.limit) ids.add(m.limit); }); return [...ids]; }
  function loadItem(it) { stash(); applyItem(it); S.id = it.id; toast('Geöffnet: ' + it.name); }
  async function loadShared(h) {
    let d = null; try { d = await unpackShare(h); } catch (e) {}
    if (!d || !d.rig || !ORDER.includes(d.rig)) { toast('Der Link oder Code ist ungültig'); return false; }
    stash(); applyItem(d, ' (geteilt)'); S.id = null; S.dirty = true; toast('Geteilter Versuch geladen'); return true;
  }
  const metersOf = () => (S.rig ? (S.rig.meters || (defOf(S.rigId) || {}).meters || []) : []);
  async function newExperiment() {
    if (S.task) { toast('Beende zuerst die Aufgabe.'); return; }
    const v = await pick('Neuer Versuch: Prüfstand wählen', ORDER.map(id => ({ value: id, label: rigName(id), sub: ((defOf(id) || {}).info) || RIGMETA[id].info, icon: rigIcon(id), mark: defOf(id) ? '' : 'fehlt' })));
    if (!v) return; const had = stash(); S.name = 'Neuer Versuch'; S.id = null; S.dirty = false; S.rows[v] = []; setRig(v); setTab('rig');
    toast(had ? 'Neuer Versuch, dein bisheriger ist gesichert' : 'Neuer Versuch');
  }
  function openList() {
    sheet('Gespeicherte Versuche', (b, close) => {
      const draw = () => {
        const items = saves().slice().sort((a, b2) => b2.t - a.t);
        if (!items.length) { b.innerHTML = '<p class="hint2">Noch nichts gespeichert. Speichern findest du im Menü („Speichern unter …“).</p>'; return; }
        b.innerHTML = items.map(i => `<div class="row"><button class="grow" data-o="${esc(i.id)}" style="text-align:left"><b>${esc(i.name)}</b><small>${rigIcon(i.rig)} ${esc(rigName(i.rig))} · ${new Date(i.t).toLocaleDateString('de-DE')}</small></button><button class="chip danger s" data-d="${esc(i.id)}">Löschen</button></div>`).join('');
      };
      draw();
      b.addEventListener('click', async e => {
        const o = e.target.closest('[data-o]'), d = e.target.closest('[data-d]');
        if (o) { const it = saves().find(x => x.id === o.dataset.o); if (!it) return; close(); loadItem(it); }
        else if (d) { if (!await confirmSheet('Löschen?', 'Der gespeicherte Versuch wird gelöscht.', 'Löschen', true)) return; lsSet(PK, saves().filter(x => x.id !== d.dataset.d)); draw(); }
      });
    });
  }
  function parseNum(s) {
    const C = CORE(); if (typeof s === 'number') return fin(s) ? s : NaN;
    if (C && typeof C.parseNum === 'function') { const v = C.parseNum(s); if (fin(v)) return v; return NaN; }
    return parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.'));
  }
  function placeholderHtml() {
    const why = S.err ? 'Der Prüfstand konnte nicht gestartet werden: ' + esc(S.err) : 'Die Datei für „' + esc(rigName(S.rigId)) + '“ ist noch nicht geladen.';
    return `<div class="ph2"><b>Prüfstand noch nicht geladen</b>${why}<br><button class="btn" data-retry>Erneut prüfen</button></div>`;
  }
  const presetsOf = () => (S.rig && (S.rig.presets || (defOf(S.rigId) || {}).presets)) || [];
  function qualityFeed(ms, now) {
    if (S.q.mode !== 'auto' || reduced() || !fin(ms)) return;
    const q = S.q; now = now == null ? performance.now() : now;
    q.ms.push(ms); if (q.ms.length > 30) q.ms.shift(); if (q.ms.length < 30) return;
    const avg = q.ms.reduce((a, b) => a + b, 0) / q.ms.length, i = QLEVELS.indexOf(q.level);
    if (avg > 22 && i < QLEVELS.length - 1 && now - q.lastSwitch > 800) { q.level = QLEVELS[i + 1]; q.lastSwitch = now; q.ms = []; q.fastSince = 0; updateQLine(true); }
    else if (avg < 10 && i > 0) { if (!q.fastSince) q.fastSince = now; if (now - q.fastSince > 3000) { q.level = QLEVELS[i - 1]; q.lastSwitch = now; q.ms = []; q.fastSince = 0; updateQLine(true); } }
    else q.fastSince = 0;
  }
  function readState() { if (!S.rig) { S.st = null; return null; } try { S.st = S.rig.state(); } catch (e) { S.st = S.st || null; } return S.st; }
  const reduced = () => !!mqReduce.matches;
  function refFromExample(e) {
    const rf = e.ref; if (!rf || typeof rf !== 'object') return null; if (rf.ctl && typeof rf.ctl === 'object') return clone(rf);
    const d = defOf(e.rig); if (!d) return null;
    try { const r = d.create({ seed: 1 }); Object.keys(e.controls || {}).forEach(k => { const v = coerce(ctlOfRig(r, k), e.controls[k]); if (v !== undefined) r.setControl(k, v); }); Object.keys(rf).forEach(k => { const v = coerce(ctlOfRig(r, k), rf[k]); if (v !== undefined) r.setControl(k, v); }); return clone(r.snapshot()); } catch (er) { return null; }
  }
  function renderSweep() {
    const V = $('#sweepView'); if (!V) return;
    if (!S.rig) { V.innerHTML = placeholderHtml(); return; }
    const rs = curRows();
    V.innerHTML = `<p class="hint2" style="margin:0 0 8px">Jede Zeile heißt: <b>nach … s</b> (Anlagenzeit) wird ein Steuerwert gesetzt oder in einer Rampe verändert${canFire() ? ' oder ausgelöst (' + esc(FIRELBL[S.rigId] || 'Auslösen') + ')' : ''}. So fährst du Maßnahmen nacheinander, ohne selbst zu drücken, und siehst am Ende das Ampelband.</p>
      <div class="chips"><button class="chip s on" data-q="add">➕ Zeile</button><button class="chip s" data-q="ex">📖 Beispiel-Ablauf</button><button class="chip s danger" data-q="clr"${rs.length ? '' : ' disabled'}>🗑 Leeren</button></div>
      <div id="sqRows">${rs.length ? rs.map((r, i) => rowHtml(r, i, rs.length)).join('') : '<p class="hint2" style="padding:8px 4px">Noch keine Zeilen. Tippe auf „Zeile“ oder lade ein Beispiel.</p>'}</div>
      <div class="frm" style="margin-top:10px"><label class="f"><span>Dauer des Ablaufs in s</span><input id="sqDur" inputmode="decimal" autocomplete="off" value="${fnum(seqDur(), adig(seqDur()))}"></label><label class="chk"><input type="checkbox" id="sqCur"${S.seqCur === false ? '' : ' checked'}> mit den aktuellen Steuerwerten des Prüfstands starten</label></div>
      <div class="readout" id="sqLiveRead" aria-live="polite"></div>
      <div class="btns"><button class="btn pri" data-q="bg"${rs.length ? '' : ' disabled'}>▶ Berechnen (Ampelband)</button><button class="btn" data-q="live"${rs.length ? '' : ' disabled'}>▶ Live im Prüfstand</button><button class="btn danger" data-q="stop">■ Stopp</button></div><div id="sqRes"></div>`;
    renderSeqRes(); renderSweepLive();
  }
  const renderTasksIfOpen = () => { if (S.tab === 'tasks') renderTasks(); };
  function resetRun() {
    S.running = false; S.simT = 0; S.live = null; S.seqRes = null; S.fired = false; S.diag = []; S.diagSeen = {}; S.fx = { amp: null, kazoo: false, flags: {} };
  }
  const rigIcon = id => { const d = defOf(id); return (d && d.icon) || (RIGMETA[id] || {}).icon || '🎛️'; };
  const rigName = id => { const d = defOf(id); return (d && d.name) || (RIGMETA[id] || {}).name || id; };
  function rowHtml(r, i, n) {
    const keys = seqKeys(), c = ctlDef(r.key), canRamp = c && c.type === 'slider', ramp = r.kind === 'ramp', fire = r.kind === 'fire', isDo = r.kind === 'do';
    const kinds = `<option value="set"${r.kind === 'set' ? ' selected' : ''}>setze</option>${canRamp || ramp ? `<option value="ramp"${ramp ? ' selected' : ''}>ändere bis</option>` : ''}${canFire() ? `<option value="fire"${fire ? ' selected' : ''}>löse aus</option>` : ''}${isDo ? '<option value="do" selected>führe aus</option>' : ''}`;
    return `<div class="sqr" data-i="${i}"><span class="n">${i + 1}</span><label class="tb"><small>nach</small><input class="tIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${fnum(r.t, adig(r.t))}" aria-label="Zeit in Sekunden"> <small>s</small></label>
      <select class="kdSel" data-i="${i}" aria-label="Art">${kinds}</select>
      ${fire ? `<span class="vb hint2">${esc(FIRELBL[S.rigId] || 'Auslösen')}</span>` : isDo ? `<span class="vb hint2">Aktion: ${esc(r.key)}</span>` : `<select class="kSel" data-i="${i}" aria-label="Steuerwert">${keys.map(k => `<option value="${esc(k.key)}"${k.key === r.key ? ' selected' : ''}>${esc(k.label)}</option>`).join('')}</select><span class="vb">${valueEd(r, i)}</span>`}${ramp ? `<label class="tb"><small>in</small><input class="dIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${fnum(r.dur, adig(r.dur || 1))}" aria-label="Dauer der Änderung in Sekunden"> <small>s</small></label>` : ''}
      <span class="ac"><button class="ib2" data-a="up" data-i="${i}" aria-label="Nach oben"${i === 0 ? ' disabled' : ''}>↑</button><button class="ib2" data-a="dn" data-i="${i}" aria-label="Nach unten"${i === n - 1 ? ' disabled' : ''}>↓</button><button class="ib2" data-a="del" data-i="${i}" aria-label="Löschen">🗑</button></span></div>`;
  }
  function rowText(r) {
    if (r.kind === 'fire') return 'löse aus: ' + (FIRELBL[S.rigId] || 'Auslösen');
    if (r.kind === 'do') return 'führe aus: ' + r.key;
    const c = ctlDef(r.key), nm = c ? c.label : r.key;
    return r.kind === 'ramp' ? 'ändere ' + nm + ' in ' + fnum(r.dur, 1) + ' s auf ' + valText(c, r.to) : 'setze ' + nm + ' = ' + valText(c, r.value);
  }
  const saves = () => { const a = lsGet(PK, []); return Array.isArray(a) ? a : []; };
  const seqDur = () => { const d = S.seqDur && S.seqDur[S.rigId]; if (fin(d) && d > 0) return d; const rs = curRows(); return Math.max(10, rs.reduce((m, r) => Math.max(m, rowEnd(r)), 0) * 1.25); };
  function seqLive() {
    if (!S.rig) return; const steps = seqSteps(curRows());
    if (!steps.length) { toast('Der Ablauf ist leer.'); return; }
    const keep = S.seqCur !== false ? allCtl() : null;
    resetRig(true); if (keep) applyCtl(keep);
    readState(); S.live = { steps, i: 0, t: 0, end: seqDur(), ramps: [] }; setRun(true); renderSweepLive(); toast('Der Ablauf läuft live. Oben siehst du die Animation.');
  }
  function seqSteps(rows) {
    const m = new Map(), other = [];
    (rows || []).forEach(r => {
      if (!r) return; const t = Math.round(Math.max(0, +r.t || 0) * 1e6) / 1e6;
      if (r.kind === 'fire') { other.push({ t, fire: true }); return; }
      if (r.kind === 'do') { if (r.key) other.push({ t, do: String(r.key) }); return; }
      const c = ctlDef(r.key); if (!c) return;
      if (r.kind === 'ramp') { const to = coerce(c, r.to != null ? r.to : r.value); if (to !== undefined && c.type === 'slider') other.push({ t, ramp: { key: r.key, to, durS: Math.max(1e-6, +r.dur || 0) } }); return; }
      if (!m.has(t)) m.set(t, {}); m.get(t)[r.key] = r.value;
    });
    return [...m.entries()].map(([t, set]) => ({ t, set })).concat(other).sort((a, b) => a.t - b.t);
  }
  function seqStop() { if (S.live) { S.live = null; S.running = false; updateChrome(); toast('Ablauf gestoppt'); renderSweepLive(); } else if (S.running) setRun(false); }
  function setRef(snap) { S.ref = snap ? clone(snap) : null; if (!S.ref) S.refMode = 'nachher'; buildRefRig(); buildBA(); updateAmp(true); extRefresh(); S.dirty = true; saveCurSoon(); }
  const snapshot = () => { let s = null; try { s = S.rig && typeof S.rig.snapshot === 'function' ? S.rig.snapshot() : null; } catch (e) { s = null; } return s ? clone(s) : { ctl: allCtl() }; };
  function toggleCtl(key, value) {
    const def = ctlDef(key); if (!def || !S.rig) return;
    if (value !== undefined) { setCtl(key, value); return; }
    if (def.type === 'select') { const o = def.options || [], v = S.rig.getControl(key), i = o.findIndex(q => q.value === v || String(q.value) === String(v)); if (o.length) setCtl(key, o[(i + 1) % o.length].value); }
    else if (def.type === 'switch') setCtl(key, !S.rig.getControl(key));
  }
  function updateChrome() { updateTitle(); buildPal(); updateTaskBar(); updateQLine(); }
  function updateSimBand() { const el = $('#simBand'); if (!el) return; $('#simTx').textContent = simText(); el.hidden = !!S.simClosed[S.rigId]; }
  function updateTaskBadge() {
    const a = TK(), b = $('#tkBd'); if (!b) return;
    if (!a) { b.style.display = 'none'; return; }
    const d = taskDone(), n = a.filter(t => (d[t.id] || 0) >= 100).length; b.style.display = ''; b.textContent = n + '/' + a.length;
  }
  function updateTaskBar() {
    const t = curTask(), el = $('#taskBar'); if (!el) return;
    if (!t) { el.className = ''; el.innerHTML = ''; el.dataset.s = ''; return; }
    el.className = 'on'; const sig = t.id + S.readonly; if (el.dataset.s === sig) return; el.dataset.s = sig;
    el.innerHTML = `<span>📝</span><b>${esc(t.title)}</b><button class="chip s" data-ta="info">Aufgabe</button><button class="chip s on" data-ta="check"${S.readonly ? ' disabled' : ''}>✓ Prüfen</button>`;
  }
  function usePick(id) {
    if (id === S.rigId) return;
    if (S.task) { toast('Während einer Aufgabe ist der Prüfstand fest. Beende zuerst die Aufgabe.'); return; }
    stash(); S.name = 'Neuer Versuch'; S.id = null; S.dirty = false; setRig(id); toast('Prüfstand: ' + rigName(id));
  }
  const valText = (c, v) => (!c ? String(v) : c.type === 'switch' ? (v ? 'EIN' : 'AUS') : c.type === 'select' ? optLabel(c, v) : ctlShow(c, +v));
  function valueEd(r, i) {
    const c = ctlDef(r.key); if (!c) return '<span class="hint2">Steuerwert unbekannt</span>';
    const v = r.kind === 'ramp' ? r.to : r.value;
    if (c.type === 'slider') return `<span class="vv"><input class="vIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${esc(ctlShow(c, +v))}" aria-label="Wert"></span>`;
    if (c.type === 'switch') return `<select class="vSel" data-i="${i}" aria-label="Wert"><option value="1"${r.value ? ' selected' : ''}>EIN</option><option value="0"${r.value ? '' : ' selected'}>AUS</option></select>`;
    const o = c.options || [], cur = o.findIndex(x => x.value === r.value || String(x.value) === String(r.value));
    return `<select class="vSel" data-i="${i}" aria-label="Wert">${o.map((x, j) => `<option value="${j}"${j === cur ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`;
  }
  function wirePanel(H) {
    let hold = null;
    H.addEventListener('input', e => {
      const inp = e.target.closest('input[type=range]'); if (!inp) return; const el = inp.closest('.ct'), c = ctlDef(el.dataset.k); if (c) setCtl(c.key, slVal(c, +inp.value));
    });
    H.addEventListener('change', e => {
      const num = e.target.closest('input.num'), sel = e.target.closest('select');
      if (num) { const el = num.closest('.ct'), c = ctlDef(el.dataset.k); if (!c) return; const v = ctlParse(c, num.value); if (fin(v)) setCtl(c.key, v); syncCtl(true); return; }
      if (sel) { const el = sel.closest('.ct'), c = ctlDef(el.dataset.k); if (c) setCtl(c.key, (c.options || [])[+sel.value].value); }
    });
    H.addEventListener('click', e => {
      const sw = e.target.closest('.sw'), sg = e.target.closest('.seg button, .ctrlchips .chip'), sn = e.target.closest('[data-snap]'), fb = e.target.closest('.bt.fire');
      if (fb) { doFire(); return; }
      if (sw) { const k = sw.closest('.ct').dataset.k; setCtl(k, !S.rig.getControl(k)); clickSnd('click'); }
      else if (sg) { const el = sg.closest('.ct'), c = ctlDef(el.dataset.k); if (c) { setCtl(c.key, (c.options || [])[+sg.dataset.i].value); clickSnd('tick'); } }
      else if (sn) { const el = sn.closest('.ct'), c = ctlDef(el.dataset.k); if (c) { setCtl(c.key, +sn.dataset.snap); syncCtl(true); clickSnd('tick'); } }
    });
    H.addEventListener('pointerdown', e => {
      const b = e.target.closest('.bt:not(.fire)'); if (!b || !S.rig) return; e.preventDefault(); const k = b.closest('.ct').dataset.k;
      try { b.setPointerCapture(e.pointerId); } catch (x) {} hold = { id: e.pointerId, k }; setCtl(k, true); clickSnd('tick');
    });
    const up = e => { if (!hold || (e.pointerId != null && hold.id !== e.pointerId)) return; const k = hold.k; hold = null; setCtl(k, false, true); };
    H.addEventListener('pointerup', up); H.addEventListener('pointercancel', up); H.addEventListener('lostpointercapture', up);
    H.addEventListener('contextmenu', e => { if (e.target.closest('.bt,.sw')) e.preventDefault(); });
  }
  return [{ allCtl, ampelNow, applyCtl, ask, backToRef, buildBA, buildPick, buildTabs, canFire, choicesOf, coerce, curQ, curRows, curTask, cvPos, cval, exportPng, fe, fieldsOf, fireHtml, hasCtl, importSheet, keysHtml, keysSheet, limGet, limIds, loadShared, metersOf, newExperiment, openList, parseNum, placeholderHtml, presetsOf, qualityFeed, readState, reduced, refFromExample, renderSweep, renderTasksIfOpen, resetRun, rigIcon, rigName, rowText, saves, seqDur, seqLive, seqSteps, seqStop, setRef, snapshot, toggleCtl, updateChrome, updateSimBand, updateTaskBadge, updateTaskBar, usePick, wirePanel }, function (__rk) { ({ buildRefRig, ctlParse, ctlShow, renderSeqRes, resetRig, rigPng, seqKeys, stash } = __rk); }]; } };
  __rgB['p~els+wsl~7b5d9385'] = { d: ["fnum"], l: [], f: function (__rk) { const { fnum } = __rk;
  const FXKINDS = { zap: 1, spark: 1, click: 1, trip: 1, defekt: 1, smoke: 1, buzz: 1, alarm: 1, ding: 1, tick: 1 };
  const SPEEDS = [0.1, 0.5, 1, 2, 5];
  const dm = (b, a) => (b != null && a != null ? ' Die Marge ändert sich von ' + fnum(b, 2) + ' auf ' + fnum(a, 2) + '.' : '');
  return [{ FXKINDS, SPEEDS, dm }]; } };
  __rgB['p~ana+wsl~5f164d9f'] = { d: ["root"], l: [], f: function (__rk) { const { root } = __rk;
  const MVIEWS = ['gauge', 'digital', 'front'], MVNAME = { gauge: 'Zeiger', digital: 'Zahlen', front: 'Frontplatte' };
  const frontOk = () => !!(root.GERAETE && typeof root.GERAETE.renderMultimeter === 'function');
  return [{ MVIEWS, MVNAME, frontOk }]; } };
  __rgB['k~els+wsl~4b1a03aa'] = { d: ["$","AMP","CMPSYM","CORE","EXTFILE","EXTHOST","EXTNAME","RANK","S","adig","allCtl","ampKey","applyCtl","ask","assessOf","bandOf","bgOf","clamp","clone","ctlDef","ctlsOf","curQ","cval","decs","defOf","doFire","esc","extApi","extOf","extRefresh","fauto","fe","fin","fnum","fxReset","limBadge","limGet","limIds","limSrc","margTxt","metersOf","parseNum","presetsOf","readState","reduced","renderSweepLive","resetRun","saveItem","seqLiveDone","setCtl","sheet","siUnit","syncCtl","theme","toast","tstamp","updateAmp","updateChrome","updateDiag","updateMeters"], l: [], f: function (__rk) { const { $, AMP, CMPSYM, CORE, EXTFILE, EXTHOST, EXTNAME, RANK, S, adig, allCtl, ampKey, applyCtl, ask, assessOf, bandOf, bgOf, clamp, clone, ctlDef, ctlsOf, curQ, cval, decs, defOf, doFire, esc, extApi, extOf, extRefresh, fauto, fe, fin, fnum, fxReset, limBadge, limGet, limIds, limSrc, margTxt, metersOf, parseNum, presetsOf, readState, reduced, renderSweepLive, resetRun, saveItem, seqLiveDone, setCtl, sheet, siUnit, syncCtl, theme, toast, tstamp, updateAmp, updateChrome, updateDiag, updateMeters } = __rk;
  function buildLimits() {
    const card = $('#cLim'), host = $('#limList'); if (!card || !host) return;
    const L = limIds().map(limGet).filter(Boolean);
    card.hidden = !L.length; host.innerHTML = L.map(l => `<div class="lim"><span>${esc(l.text || l.id)}</span><span><b>${esc(CMPSYM[l.cmp] || '')} ${esc(fauto(l.value))}${l.unit ? ' ' + esc(l.unit) : ''}</b> ${limBadge(l)}</span><small>${esc(limSrc(l))}</small></div>`).join('');
  }
  function buildPresets() {
    const P = presetsOf(), el = $('#presetBar');
    if (!P.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="gh gh0">Voreinstellung</div><div class="chips">${P.map(p => `<button class="chip s${S.preset === p.id ? ' on' : ''}" data-pre="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>`;
  }
  function buildRefRig() {
    S.refRig = null; if (!S.ref || !S.rig) return; const d = defOf(S.rigId); if (!d) return;
    try { const r = d.create({ seed: 1 }); if (typeof r.restore === 'function') r.restore(clone(S.ref)); S.refRig = r; } catch (e) { console.error('Referenz:', e); S.refRig = null; }
  }
  async function checkDice() {
    const d = S.dice; if (!d || !S.rig) return; const C = CORE(); let res = null;
    if (C && typeof C.runSeq === 'function') { try { res = await C.runSeq(() => defOf(S.rigId).create({ seed: 1 }), [{ t: 0, set: {} }], 1, { seed: 1, controls: allCtl() }); } catch (e) { console.error('runSeq:', e); res = null; } }
    const a = res && (res.assess || (res.final && res.final.assess));
    if (!a) { d.result = 'Die Prüfung konnte nicht ausgeführt werden: Der Läufer fehlt oder meldet einen Fehler.'; updateDice(); return; }
    const now = ampKey(a.ampel), ba = d.base ? d.base.ampel : 'gruen', want = ba === 'grau' ? 'gelb' : ba;
    d.fixed = RANK[now] >= RANK[want];
    d.result = d.fixed ? 'Behoben: Die Ampel steht auf ' + AMP[now].name + ', wie vor dem Fehler (' + AMP[ba].name + ').' : 'Noch nicht behoben: Die Ampel steht auf ' + AMP[now].name + ', vorher war sie ' + AMP[ba].name + '. ' + (a.text || '');
    updateDice(); toast(d.fixed ? 'Fehler behoben' : 'Noch nicht behoben');
  }
  const cmax = id => { const c = ctlDef(id); return c && c.type === 'slider' ? c.max : undefined; };
  function ctlParse(c, text) {
    let t = String(text == null ? '' : text).trim(); if (!t) return NaN;
    if (siUnit(c)) return parseNum(t);
    if (c.unit && t.endsWith(c.unit)) t = t.slice(0, -c.unit.length).trim();
    const v = parseFloat(t.replace(/\s/g, '').replace(',', '.')); return fin(v) ? v : NaN;
  }
  const ctlShow = (c, v) => (siUnit(c) && c.unitKind !== 'plain' ? fe(v, c.unit) : fnum(v, c.scale === 'log' ? adig(v) : decs(c.step)) + (c.unit ? ' ' + c.unit : ''));
  const diceKeys = d => { let m = null; try { m = d.apply(); } catch (e) { m = null; } if (!m || !Object.keys(m).length || !Object.values(m).every(v => v !== undefined)) return null; return Object.keys(m).some(k => String(cval(k)) !== String(m[k])) ? m : null; };
  async function doSave() {
    const r = await ask('Versuch speichern', [{ key: 'n', label: 'Name', type: 'text', value: S.name }]);
    if (!r) return; const n = r.n.trim() || 'Versuch'; saveItem(n); toast('Gespeichert: ' + n);
  }
  function drawOpts() {
    const o = { quality: curQ(), reduced: reduced(), theme: theme(), ghost: null, wipe: null };
    if (S.ref && S.rig) { if (S.refMode === 'wischer') { o.ghost = S.ref; o.wipe = S.wipe; } else if (S.refMode === 'nachher' && S.ghost) o.ghost = S.ref; }
    return o;
  }
  function liveApply() {
    const L = S.live; if (!L) return;
    while (L.i < L.steps.length && L.steps[L.i].t <= L.t + 1e-9) {
      const st = L.steps[L.i++];
      if (st.set) Object.keys(st.set).forEach(k => setCtl(k, st.set[k], true));
      if (st.ramp) { let from = NaN; try { from = +S.rig.getControl(st.ramp.key); } catch (e) {} L.ramps.push({ key: st.ramp.key, from, to: +st.ramp.to, t0: st.t, d: Math.max(1e-9, +st.ramp.durS || 1e-9), log: (ctlDef(st.ramp.key) || {}).unitKind === 'freq' }); }
      if (st.fire) doFire();
      if (st.do != null) { if (typeof S.rig.do === 'function') { try { S.rig.do(st.do); } catch (e) { console.error(e); } } else doFire(); }
    }
    L.ramps = L.ramps.filter(r => {
      const f = clamp((L.t - r.t0) / r.d, 0, 1);
      if (fin(r.from)) { const v = r.log && r.from > 0 && r.to > 0 ? r.from * Math.pow(r.to / r.from, f) : r.from + (r.to - r.from) * f; setCtl(r.key, v, true); }
      return f < 1;
    });
  }
  const marg = () => { const a = assessOf(S.rig); return a && fin(a.margin) ? a.margin : null; };
  const pickOpt = (id, re) => { const c = ctlDef(id); if (!c || c.type !== 'select') return undefined; const o = (c.options || []).find(x => re.test(String(x.value)) || re.test(String(x.label))); return o ? o.value : undefined; };
  function renderExt(kind) {
    const host = $(EXTHOST[kind]), E = extOf(kind);
    if (!host) return;
    if (!E || typeof E.render !== 'function') { host.innerHTML = `<div class="card pl"><p class="big">Ansicht wird geladen</p><p class="hint2">Die Datei ${EXTFILE[kind]} ist noch nicht geladen (${EXTNAME[kind]}).</p><div class="btns"><button class="btn" data-retry>Erneut prüfen</button></div></div>`; host.dataset.ext = ''; return; }
    if (kind === 'help' && host.dataset.ext === '1' && host.children.length) return;
    try { E.render(host, extApi()); host.dataset.ext = '1'; } catch (e) { console.error('Erweiterung ' + kind + ':', e); host.innerHTML = '<div class="card pl"><p class="big">Das hat nicht geklappt</p><p class="hint2">' + esc((e && e.message) || e) + '</p></div>'; }
  }
  function renderSeqRes() {
    const el = $('#sqRes'); if (!el) return; const R = S.seqRes;
    if (!R || R.rigId !== S.rigId) { el.innerHTML = ''; return; }
    const band = bandOf(R), faults = (R.faults || []).map(f => (typeof f === 'string' ? f : f && (f.text || f.msg || f.name)) || '').filter(Boolean), evs = (R.events || []).slice(-20), fm = (R.final && R.final.meters) || {};
    const tot = Math.max(1e-9, R.end), a = R.assess || (R.final && R.final.assess) || null;
    el.innerHTML = `<div class="card pl"><h4>Ergebnis des Ablaufs</h4>
      <div class="bandbar" role="img" aria-label="Ampelband über die Zeit">${band.map(b => `<i class="bd-${b.k}" style="flex:${Math.max(0.5, (b.t1 - b.t0) / tot * 100).toFixed(2)}" title="${esc(AMP[b.k].name)}">${AMP[b.k].sym}</i>`).join('')}</div>
      <ul class="tl">${band.map(b => `<li class="${AMP[b.k].cls === 'ok' ? 'ok' : AMP[b.k].cls === 'bad' ? 'bad' : ''}">${AMP[b.k].sym} ${fnum(b.t0, 1)} s bis ${fnum(b.t1, 1)} s: ${esc(AMP[b.k].name)}${fin(b.m) ? ', kleinste Marge ' + fnum(b.m, 2) : ''}</li>`).join('')}</ul>
      ${a ? `<p style="margin:6px 0 0"><b>Am Ende:</b> ${esc((AMP[ampKey(a.ampel)] || AMP.grau).sym)} ${esc((AMP[ampKey(a.ampel)] || AMP.grau).name)}${margTxt(a) ? ', ' + esc(margTxt(a)) : ''}. ${esc(a.text || '')}</p>` : ''}
      <table class="kt"><tr><th>Messgerät am Ende</th><th class="n">Wert</th></tr>${metersOf().map(m => `<tr><td>${esc(m.label)}</td><td class="n"><b>${fnum(fm[m.key], m.digits == null ? 1 : m.digits)}</b> ${esc(m.unit || '')}</td></tr>`).join('')}</table>
      ${R.errors && R.errors.length ? `<p style="color:var(--warn);margin:6px 0 0"><b>Hinweis zum Ablauf:</b> ${R.errors.map(x => esc(typeof x === 'string' ? x : x && x.text || '')).join(' ')}</p>` : ''}
      ${faults.length ? `<p style="color:var(--danger);margin:6px 0 0"><b>Fehler im Ablauf:</b> ${faults.map(esc).join('; ')}</p>` : '<p class="hint2" style="margin:6px 0 0">Keine Fehler im Ablauf.</p>'}
      ${evs.length ? `<ul class="ev" style="padding:0">${evs.map(x => `<li class="${esc(x.kind || 'info')}"><time>${esc(tstamp(x.t))}</time><span>${esc(x.text)}</span></li>`).join('')}</ul>` : ''}</div>`;
  }
  function resetRig(quiet) {
    if (!S.rig) return;
    try { S.rig.reset(); } catch (e) { console.error(e); }
    const keepRef = S.ref; resetRun(); S.ctl = {}; S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; fxReset(); S.ref = keepRef; buildRefRig();
    readState(); syncCtl(true); updateMeters(0, true); updateEvents(true); updateDiag(true); updateAmp(true); updateChrome(); renderSweepLive(); extRefresh(); if (!quiet) toast('Prüfstand zurückgesetzt');
  }
  function rigPng(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = bgOf(); x.fillRect(0, 0, w, h); try { if (S.rig) S.rig.draw(x, w, h, 0, { quality: 'hoch', reduced: true, theme: theme() }); } catch (e) {} return c;
  }
  const seqKeys = () => ctlsOf().filter(c => c.type !== 'button');
  function showDice() { const d = S.dice; if (!d) return; sheet('Auflösung: ' + d.name, b => { b.innerHTML = '<div class="ex">' + esc(d.text) + '</div>'; }); }
  function simAdvance(dtMs) {
    const r = S.rig; if (!r) return; const d = dtMs * S.speed;
    if (S.live) { S.live.t += d / 1000; liveApply(); if (S.live && S.live.t >= S.live.end) seqLiveDone(); }
    try { r.step(d); } catch (e) { throw e; }
    if (S.ref && S.refRig && S.refMode === 'vorher') { try { S.refRig.step(d); } catch (e) {} }
    S.simT += d / 1000;
  }
  const slowFx = () => S.speed > 2 || S.speed < 1;
  function stash() { if (!S.dirty || !S.rig || S.readonly) return false; if (S.task) return false; saveItem(S.name || 'Versuch'); S.id = null; return true; }
  function undoDice() { const d = S.dice; if (!d || !S.rig) return; applyCtl(d.before); S.dice = null; updateDice(); readState(); updateAmp(true); toast('Fehler behoben'); }
  function updateDice() {
    const el = $('#diceBar'); if (!el) return; const d = S.dice;
    if (!d || d.rigId !== S.rigId) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = `<b>🎲 Finde den Fehler${d.fixed ? ' – behoben' : ''}</b><button class="chip s on" data-d="check">✓ Behebung prüfen</button><button class="chip s" data-d="show">Auflösung</button><button class="chip s" data-d="undo">Fehler beheben</button>${d.result ? `<div class="hint2 inl" style="flex-basis:100%" role="status">${esc(d.result)}</div>` : ''}`;
  }
  function updateEvents(force) {
    const l = $('#evList'); if (!l) return; const ev = (S.rig && S.rig.events) || [];
    const sig = ev.length + '|' + (ev.length ? (ev[ev.length - 1].text || '') + (ev[ev.length - 1].t || '') : ''); if (!force && sig === S.evSig) return; S.evSig = sig;
    l.innerHTML = ev.length ? ev.slice(-40).reverse().map(x => `<li class="${esc(x.kind || 'info')}"><time>${esc(tstamp(x.t))}</time><span>${esc(x.text)}</span></li>`).join('') : '<li class="empty">Keine Meldungen. Meldet der Prüfstand etwas (zum Beispiel eine Auslösung), steht es hier.</li>';
  }
  function updateStat() {
    const sEl = $('#stat'); if (!sEl) return;
    const html = (S.running ? '<b class="run" style="color:var(--ok)">LÄUFT</b> ' : '<b>PAUSE</b> ') + 'Zeit ' + fnum(S.simT, 1) + ' s' + (S.speed !== 1 ? ' · ×' + String(S.speed).replace('.', ',') : '');
    if (sEl.dataset.h !== html) { sEl.dataset.h = html; sEl.innerHTML = html; }
  }
  return [{ buildLimits, buildPresets, buildRefRig, checkDice, cmax, ctlParse, ctlShow, diceKeys, doSave, drawOpts, liveApply, marg, pickOpt, renderExt, renderSeqRes, resetRig, rigPng, seqKeys, showDice, simAdvance, slowFx, stash, undoDice, updateDice, updateEvents, updateStat }]; } };
  __rgR.map.wsl = {"h":"59ae85a9","p":["p~ana+els+wsl~434882e1","p~ana+wsl~5f164d9f","p~els+wsl~7b5d9385"],"k":["k~ana+els+wsl~b2abfc64","k~ana+wsl~b587eda6","k~els+wsl~4b1a03aa"]};
  __rgR.map.ana = {"h":"6e3904d3","p":["p~ana+els+wsl~434882e1","p~ana+wsl~5f164d9f"],"k":["k~ana+els+wsl~b2abfc64","k~ana+wsl~b587eda6"]};
  __rgR.map.els = {"h":"4f1dcca7","p":["p~ana+els+wsl~434882e1","p~els+wsl~7b5d9385"],"k":["k~ana+els+wsl~b2abfc64","k~els+wsl~4b1a03aa"]};
})(typeof window !== 'undefined' ? window : globalThis);
