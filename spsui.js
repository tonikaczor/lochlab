'use strict';
/* Tonfunk SPS-Lab: Oberfläche.
   Seite, Tabs (Anlage, Programm, Simulation, Aufgaben, Lernen), Statusleiste, Simulation (UI treibt plant.step und plc.scan, fester Zyklus 10 ms),
   Programme speichern/öffnen/teilen, Adressmodus, Menü, Hilfe. Die Editoren (KOP, FUP, GRAFCET, Text) kommen aus spsedit-*.js über SPS_EDIT.editors[id].mount(el, ctx).
   Speicher: sps.addr, sps.sym, sps.speed, sps.progs (gespeicherte Programme), sps.cur (laufende Arbeit), sps.tab, sim.done (Aufgaben, gemeinsam mit den anderen Labs). */
(function (root) {
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const lsRaw = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsPut = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const clone = o => JSON.parse(JSON.stringify(o));
  const CORE = root.SPS_CORE, PL = root.SPS_PLANTS, FX = root.SPS_FX;
  const ORDER = ['foerderband', 'ampel', 'tank', 'garagentor'];
  const stat = (k, v, m) => { if (root.Badges) root.Badges.stat(k, v, m); };
  const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const num1 = x => (Math.round(x * 10) / 10).toString().replace('.', ',');

  /* ============================================================ Fenster, Meldungen, Dialoge */
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); }
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
  /* Auswahl-Dialog: options [{value,label,sub?,group?,disabled?,mark?}] -> Promise<value|null> */
  function pick(title, options, opt) {
    opt = opt || {};
    return new Promise(res => {
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        const search = options.length > 14;
        b.innerHTML = (opt.intro ? `<p class="hint2" style="margin-top:0">${esc(opt.intro)}</p>` : '') + (search ? '<input id="pq" type="search" placeholder="Suchen …" autocomplete="off" style="margin-bottom:6px">' : '') + '<div id="pl"></div>';
        const draw = q => {
          let last = null, html = '';
          options.forEach((o, i) => {
            if (q && !((o.label || '') + ' ' + (o.sub || '') + ' ' + (o.group || '') + ' ' + (o.value == null ? '' : o.value)).toLowerCase().includes(q)) return;
            if (o.group !== last) { last = o.group; if (o.group) html += `<div class="gh">${esc(o.group)}</div>`; }
            html += `<button class="row" data-i="${i}"${o.disabled ? ' disabled' : ''}><div class="grow"><b>${esc(o.label)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div>${o.mark ? `<span class="lv">${esc(o.mark)}</span>` : ''}</button>`;
          });
          $('#pl', b).innerHTML = html || '<p class="hint2">Nichts gefunden.</p>';
        };
        draw('');
        if (search) $('#pq', b).addEventListener('input', e => draw(e.target.value.trim().toLowerCase()));
        b.addEventListener('click', e => { const r = e.target.closest('.row[data-i]'); if (!r || r.disabled) return; fin(options[+r.dataset.i].value); close(); });
      }, () => fin(null));
    });
  }
  const fmtMs = ms => { ms = Math.round(+ms || 0); if (ms >= 1000 && ms % 100 === 0) return (ms / 1000).toString().replace('.', ',') + ' s'; return ms + ' ms'; };
  function parseTime(s) {
    const t = String(s).trim().toLowerCase().replace(',', '.').replace(/\s+/g, '');
    const m = /^(\d+(?:\.\d+)?)(ms|s|sek|min)?$/.exec(t); if (!m) return NaN;
    const v = parseFloat(m[1]); return Math.round(m[2] === 's' || m[2] === 'sek' ? v * 1000 : m[2] === 'min' ? v * 60000 : v);
  }
  /* Eingabeformular: fields [{key,label,type:'text'|'number'|'time',value}] -> Promise<{key:value}|null> */
  function ask(title, fields, opt) {
    opt = opt || {};
    return new Promise(res => {
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        b.innerHTML = (opt.intro ? `<p class="hint2" style="margin-top:0">${esc(opt.intro)}</p>` : '') + fields.map((f, i) => {
          const v = f.type === 'time' ? fmtMs(f.value) : (f.value == null ? '' : f.value);
          return `<label class="f"><span>${esc(f.label)}${f.type === 'time' ? ' (z. B. 3 s, 500 ms)' : ''}</span><input id="ak${i}" type="${f.type === 'number' ? 'text' : 'text'}" inputmode="${f.type === 'number' ? 'decimal' : 'text'}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(v)}"></label>`;
        }).join('') + '<div id="akErr" class="hint2" style="color:#ff8a7a;min-height:18px"></div><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn pri" data-ok>OK</button></div>';
        const ok = () => {
          const out = {};
          for (let i = 0; i < fields.length; i++) {
            const f = fields[i], raw = $('#ak' + i, b).value;
            if (f.type === 'time') { const v = parseTime(raw); if (isNaN(v)) { $('#akErr', b).textContent = f.label + ': Bitte eine Zeit wie 3 s oder 500 ms eingeben.'; return; } out[f.key] = v; }
            else if (f.type === 'number') { const v = parseFloat(String(raw).replace(',', '.')); if (!isFinite(v)) { $('#akErr', b).textContent = f.label + ': Bitte eine Zahl eingeben.'; return; } out[f.key] = v; }
            else out[f.key] = raw;
          }
          fin(out); close();
        };
        $('[data-c]', b).onclick = close; $('[data-ok]', b).onclick = ok;
        b.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
        if (!('ontouchstart' in window)) setTimeout(() => { const i = $('#ak0', b); if (i) { i.focus(); i.select(); } }, 60);
      }, () => fin(null));
    });
  }
  function confirmSheet(title, text, okLabel, danger) {
    return new Promise(res => {
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        b.innerHTML = `<p style="margin-top:0">${text}</p><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn ${danger ? 'danger' : 'pri'}" data-ok>${esc(okLabel || 'OK')}</button></div>`;
        $('[data-c]', b).onclick = close; $('[data-ok]', b).onclick = () => { fin(true); close(); };
      }, () => fin(false));
    });
  }
  root.LabUI = { sheet, esc, toast, userName: () => lsRaw('lm4.name', ''), LAB: 'sps' };
  root.sheet = sheet; root.toast = toast;

  /* ============================================================ Zustand */
  if (!CORE || !PL || !PL.list.length) { document.body.insertAdjacentHTML('afterbegin', '<p style="padding:30px;color:#ff8a7a">SPS-Kern oder Anlagen konnten nicht geladen werden.</p>'); return; }
  const plantIds = () => ORDER.filter(id => PL.defs[id]).concat(Object.keys(PL.defs).filter(id => !ORDER.includes(id)));
  const pdef = id => PL.defs[id];
  const S = {
    tab: lsRaw('sps.tab', 'prog'), plantId: null, plant: null, plc: null, prog: null, name: 'Neues Programm', id: null, task: null,
    running: false, speed: +lsRaw('sps.speed', '1') || 1, addr: lsRaw('sps.addr', 's7') === 'iec' ? 'iec' : 's7', sym: lsRaw('sps.sym', '1') !== '0',
    view: 'edit', forces: {}, live: null, scanned: false, readonly: false, dirty: false, miniHidden: lsRaw('sps.mini', '0') === '1', errOpen: null
  };
  if (!['plant', 'prog', 'sim', 'tasks', 'help'].includes(S.tab)) S.tab = 'prog';
  let acc = 0, hist = [], hi = -1;

  const plantSyms = id => { const o = {}, d = pdef(id); if (d) d.io.inputs.concat(d.io.outputs).forEach(x => { if (x.sym) o[x.key] = x.sym; }); return o; };
  const emptyProg = (lang, plantId) => {
    const symbols = plantSyms(plantId);
    if (lang === 'gra') return { lang: 'gra', symbols, gra: { steps: [{ id: 'S0', init: true, title: 'Grundstellung', actions: [] }], transitions: [] } };
    return { lang, symbols, networks: [{ id: 'N1', title: '', expr: null, outs: [] }] };
  };
  const hasContent = p => {
    if (!p) return false;
    if (p.lang === 'gra') { const g = p.gra || {}; return (g.transitions || []).length > 0 || (g.steps || []).length > 1 || (g.steps || []).some(s => (s.actions || []).length); }
    return (p.networks || []).some(n => n.expr || (n.outs || []).length);
  };
  const LANGN = { kop: 'KOP', fup: 'FUP', gra: 'GRAFCET' };

  /* ---- Anlage ---- */
  function setPlant(id) {
    if (!pdef(id)) id = plantIds()[0];
    S.plantId = id; S.plant = PL.create(id, { seed: 1 }); S.running = false; acc = 0; holds.clear(); evSig = ''; opSig = ''; fxReset();
    recompile(); buildIO(); buildActions(); updateChrome();
  }

  /* ---- Programm übersetzen ---- */
  function recompile() {
    S.plc = CORE.create(S.prog);
    Object.keys(S.forces).forEach(k => S.plc.force(k, S.forces[k]));
    S.scanned = false; S.live = null; acc = 0;
    updateErrors(); updateChrome();
  }
  const allErrors = () => (S.plc ? S.plc.errors : []);

  /* ---- Programm laden ---- */
  function setProg(p, name, id) {
    S.prog = p; S.name = name || 'Programm'; S.id = id || null; S.dirty = false;
    hist = [JSON.stringify(p)]; hi = 0;
    recompile(); buildIO(); mountEditor(); updateChrome(); saveCur();
  }
  function onChanged() {
    S.dirty = true; recompile();
    const j = JSON.stringify(S.prog);
    if (hist[hi] !== j) { hist = hist.slice(0, hi + 1); hist.push(j); if (hist.length > 80) hist.shift(); hi = hist.length - 1; }
    refreshEditor(true); buildIO(); saveCur(); updateChrome();
  }
  function replaceProg(o) { Object.keys(S.prog).forEach(k => delete S.prog[k]); Object.assign(S.prog, o); }
  function undo() { if (hi <= 0 || S.readonly) return; hi--; replaceProg(JSON.parse(hist[hi])); S.dirty = true; recompile(); buildIO(); mountEditor(); saveCur(); updateChrome(); }
  function redo() { if (hi >= hist.length - 1 || S.readonly) return; hi++; replaceProg(JSON.parse(hist[hi])); S.dirty = true; recompile(); buildIO(); mountEditor(); saveCur(); updateChrome(); }
  let saveT = 0;
  function saveCur() { clearTimeout(saveT); saveT = setTimeout(() => lsSet('sps.cur', { name: S.name, id: S.id, plant: S.plantId, prog: S.prog, task: S.task ? S.task.id : null, dirty: S.dirty }), 250); }

  /* ---- Programme speichern, öffnen ---- */
  const PK = 'sps.progs';
  const progs = () => { const a = lsGet(PK, []); return Array.isArray(a) ? a : []; };
  function saveProg(name) {
    const a = progs(), id = S.id || uid(); S.id = id; S.name = name || S.name;
    const e = { id, name: S.name, t: Date.now(), plant: S.plantId, prog: clone(S.prog) };
    const i = a.findIndex(x => x.id === id); if (i >= 0) a[i] = e; else a.push(e);
    lsSet(PK, a.slice(-200)); S.dirty = false; stat('spsprogs', a.length, 'max'); updateChrome(); saveCur();
  }
  /* aktuelles Programm vor dem Ersetzen sichern, wenn etwas drinsteht und es noch nicht gesichert ist */
  function stash() {
    if (!hasContent(S.prog) || S.task && !S.dirty) return false;
    if (S.id && !S.dirty) return false;
    const nm = S.name || 'Programm'; S.name = nm; saveProg(nm); return true;
  }
  async function doSave() {
    const r = await ask('Programm speichern', [{ key: 'n', label: 'Name', type: 'text', value: S.name }]);
    if (!r) return; const n = r.n.trim() || 'Programm'; saveProg(n); toast('Gespeichert: ' + n);
  }
  function openList() {
    sheet('Gespeicherte Programme', (b, close) => {
      const draw = () => {
        const items = progs().slice().sort((a, b2) => b2.t - a.t);
        if (!items.length) { b.innerHTML = '<p class="hint2">Noch nichts gespeichert. Speichern findest du im Menü („Speichern unter …“).</p>'; return; }
        b.innerHTML = items.map(i => `<div class="row"><button class="grow" data-o="${i.id}" style="text-align:left"><b>${esc(i.name)}</b><small>${esc(LANGN[(i.prog || {}).lang] || '')} · ${esc((pdef(i.plant) || {}).name || i.plant)} · ${new Date(i.t).toLocaleDateString('de-DE')}</small></button><button class="chip danger s" data-d="${i.id}">Löschen</button></div>`).join('');
      };
      draw();
      b.addEventListener('click', async e => {
        const o = e.target.closest('[data-o]'), d = e.target.closest('[data-d]');
        if (o) { const it = progs().find(x => x.id === o.dataset.o); if (!it) return; close(); loadItem(it); }
        else if (d) { if (!await confirmSheet('Löschen?', 'Das gespeicherte Programm wird gelöscht.', 'Löschen', true)) return; lsSet(PK, progs().filter(x => x.id !== d.dataset.d)); draw(); }
      });
    });
  }
  function loadItem(it) {
    stash(); S.task = null; S.view = 'edit';
    if (it.plant && it.plant !== S.plantId) setPlant(it.plant);
    setProg(clone(it.prog), it.name, it.id); setTab('prog'); toast('Geöffnet: ' + it.name);
  }

  /* ---- Neues Programm ---- */
  async function newProgram() {
    const l = await pick('Neues Programm', [
      { value: 'kop', label: 'Kontaktplan (KOP)', sub: 'Stromlaufplan mit Kontakten und Spulen, wie im Schaltschrank' },
      { value: 'fup', label: 'Funktionsplan (FUP)', sub: 'Gatter (UND, ODER, …) und Bausteine, Signalfluss von links nach rechts' },
      { value: 'gra', label: 'GRAFCET (Ablaufsprache)', sub: 'Schritte, Aktionen und Transitionen für Ablaufsteuerungen' }]);
    if (!l) return;
    const had = stash(); S.task = null; S.view = 'edit';
    setProg(emptyProg(l, S.plantId), 'Neues Programm'); setTab('prog');
    toast(had ? 'Dein bisheriges Programm ist unter „Öffnen“ gesichert' : 'Neues Programm');
  }
  async function switchLang(l) {
    S.view = 'edit';
    if (l === S.prog.lang) { mountEditor(); updateChrome(); return; }
    if (l === 'gra' || S.prog.lang === 'gra') {
      if (hasContent(S.prog) && !await confirmSheet('Neues Programm beginnen?', 'KOP und FUP sind dasselbe Programm in zwei Darstellungen. <b>GRAFCET</b> ist eine eigene Sprache und beginnt ein neues Programm. Dein bisheriges wird vorher gesichert.', 'Neu beginnen')) return;
      stash(); S.task = null; setProg(emptyProg(l, S.plantId), 'Neues Programm'); return;
    }
    S.prog.lang = l; onChanged(); mountEditor(); toast('Als ' + LANGN[l] + ' dargestellt');
  }

  /* ---- Beispiele ---- */
  function exampleList() {
    const d = root.SPS_DATA; let a = d && d.examples;
    if (a && !Array.isArray(a)) a = Object.keys(a).map(k => Object.assign({ id: k }, a[k]));
    if (!a || !a.length) a = CORE.exampleProgs;
    return a.map(e => ({ id: e.id, name: e.name, cat: e.cat || e.group || 'Beispiele', desc: e.desc || e.text || '', plant: e.plant, get: () => { const p = typeof e.prog === 'function' ? e.prog() : e.prog || (typeof e.make === 'function' ? e.make() : null); return p ? clone(p) : null; } }));
  }
  function openExamples() {
    const ex = exampleList();
    sheet('Beispielprogramme', (b, close) => {
      let last = '', h = '<p class="hint2" style="margin-top:0">Tippe ein Beispiel an: Anlage und Programm werden geladen. Dein bisheriges Programm wird vorher gesichert.</p>';
      ex.forEach((e, i) => { if (e.cat !== last) { last = e.cat; h += `<div class="gh">${esc(e.cat)}</div>`; } const pd = pdef(e.plant); h += `<button class="row" data-i="${i}"><span style="font-size:22px">${pd ? pd.icon : '⚙'}</span><div class="grow"><b>${esc(e.name)}</b><small>${esc(e.desc)}</small></div></button>`; });
      b.innerHTML = h;
      b.addEventListener('click', ev => { const r = ev.target.closest('.row'); if (!r) return; close(); loadExample(ex[+r.dataset.i]); });
    });
  }
  function loadExample(e) {
    if (!e) return false; const p = e.get(); if (!p) return false;
    const had = stash(); S.task = null; S.view = 'edit';
    if (e.plant && pdef(e.plant) && e.plant !== S.plantId) setPlant(e.plant);
    setProg(p, e.name); setTab('prog'); toast(had ? 'Beispiel geladen, dein Programm ist gesichert' : 'Beispiel geladen: ' + e.name);
    return true;
  }
  function loadExampleByName(n) { n = String(n || '').toLowerCase(); const e = exampleList().find(x => x.name.toLowerCase().includes(n) || x.id === n); return loadExample(e); }

  /* ---- Teilen (komprimierter Link wie in den anderen Labs) ---- */
  async function packShare(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj)); let out = bytes, tag = 's';
    if (root.CompressionStream) { try { const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); w.write(bytes); w.close(); out = new Uint8Array(await new Response(cs.readable).arrayBuffer()); tag = 'z'; } catch (e) {} }
    let bin = ''; out.forEach(b => { bin += String.fromCharCode(b); });
    return tag + '=' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function unpackShare(h) {
    const m = String(h).match(/^#?([sz])=([\w-]+)$/); if (!m) return null;
    let b64 = m[2].replace(/-/g, '+').replace(/_/g, '/'); while (b64.length % 4) b64 += '=';
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); let txt;
    if (m[1] === 'z') { const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(bytes); w.close(); txt = new TextDecoder().decode(await new Response(ds.readable).arrayBuffer()); }
    else txt = new TextDecoder().decode(bytes);
    return JSON.parse(txt);
  }
  async function shareNow() {
    if (!hasContent(S.prog)) { toast('Noch nichts programmiert'); return; }
    let url; try { url = location.href.split('#')[0] + '#' + await packShare({ k: 'sps', name: S.name, plant: S.plantId, prog: S.prog }); } catch (e) { toast('Teilen nicht möglich'); return; }
    if (navigator.share) { try { await navigator.share({ title: 'Tonfunk SPS-Lab: ' + S.name, text: 'Schau dir mein SPS-Programm „' + S.name + '“ an:', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    sheet('Teilen', b => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">Diesen Link weitergeben (zum Beispiel per WhatsApp oder E-Mail). Wer ihn öffnet, bekommt eine Kopie deines Programms mit der passenden Anlage.</p><textarea id="shTx" rows="5" readonly></textarea><div class="btns"><button class="btn pri" id="shCp">Link kopieren</button></div>';
      const ta = $('#shTx', b); ta.value = url; ta.addEventListener('focus', () => ta.select());
      $('#shCp', b).onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Link kopiert'); } catch (e) { ta.select(); toast('Bitte Text markieren und kopieren'); } };
    });
  }
  async function loadShared(h) {
    let d = null; try { d = await unpackShare(h); } catch (e) {}
    if (!d || !d.prog || !(d.prog.networks || d.prog.gra)) { toast('Der Link oder Code ist ungültig'); return false; }
    stash(); S.task = null; S.view = 'edit'; if (d.plant && pdef(d.plant) && d.plant !== S.plantId) setPlant(d.plant);
    setProg(d.prog, (d.name || 'Programm') + ' (geteilt)'); setTab('prog'); toast('Geteiltes Programm geladen'); return true;
  }
  function importSheet() {
    sheet('Aus Code oder Link laden', (b, close) => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">Füge einen Teilen-Link oder Code ein.</p><textarea id="tx" rows="6"></textarea><div class="btns"><button class="btn pri" id="ld">Laden</button></div>';
      $('#ld', b).onclick = async () => { const t = $('#tx', b).value.trim(), h = t.includes('#') ? t.slice(t.indexOf('#')) : t; if (await loadShared(h.startsWith('#') ? h : '#' + h)) close(); };
    });
  }

  /* ---- Text, PNG, Druck ---- */
  const progText = () => { try { return CORE.toText(S.prog, S.addr, { symbols: S.sym }); } catch (e) { return '(Text nicht verfügbar: ' + e.message + ')'; } };
  function textSheet() {
    sheet('Programm als Text', b => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">So sieht dein Programm als Anweisungsliste aus.</p><textarea id="tx" rows="14" readonly></textarea><div class="btns"><button class="btn pri" id="cp">Kopieren</button><button class="btn" id="sv">Als Datei sichern</button></div>';
      const ta = $('#tx', b); ta.value = progText();
      $('#cp', b).onclick = async () => { try { await navigator.clipboard.writeText(ta.value); toast('Kopiert'); } catch (e) { ta.select(); toast('Bitte Text markieren und kopieren'); } };
      $('#sv', b).onclick = () => { if (root.LabExport) root.LabExport.saveBlob(new Blob(['﻿' + ta.value], { type: 'text/plain;charset=utf-8' }), root.LabExport.fname('txt')); };
    });
  }
  function plantPng(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = '#14181c'; x.fillRect(0, 0, w, h); try { S.plant.draw(x, w, h); } catch (e) {}
    drawPlant(); return c;
  }
  function exportPng() {
    const c = plantPng(1600, 1000);
    c.toBlob(b => { if (b && root.LabExport) { root.LabExport.saveBlob(b, root.LabExport.fname('png')); stat('png'); } else toast('Bild konnte nicht erzeugt werden'); }, 'image/png');
  }
  function printNow() {
    const pd = pdef(S.plantId), c = plantPng(1200, 750), who = lsRaw('lm4.name', '');
    const io = pd.io.inputs.map(x => ['Eingang', x]).concat(pd.io.outputs.map(x => ['Ausgang', x]));
    const sym = k => (S.prog.symbols && S.prog.symbols[k]) || '';
    $('#printArea').innerHTML = `<div class="proto"><h1>${esc(S.name)}</h1><p>${esc(LANGN[S.prog.lang])} · Anlage: ${esc(pd.name)} · ${new Date().toLocaleDateString('de-DE')}${who ? ' · ' + esc(who) : ''}</p>
      <h2>Anlage</h2><img src="${c.toDataURL('image/png')}" alt="">
      <h2>Programm (Anweisungsliste, ${S.addr === 'iec' ? 'IEC' : 'Siemens'})</h2><pre>${esc(progText())}</pre>
      <h2>Zuordnungsliste</h2><table><tr><th>Art</th><th>Adresse</th><th>Symbol</th><th>Bedeutung</th></tr>${io.map(([a, x]) => `<tr><td>${a}</td><td>${esc(CORE.addr(x.key, S.addr))}</td><td>${esc(sym(x.key) || x.sym || '')}</td><td>${esc(x.text)}</td></tr>`).join('')}</table></div>`;
    setTimeout(() => window.print(), 80);
  }

  /* ---- Symboltabelle ---- */
  function symbolSheet() {
    const pd = pdef(S.plantId), rows = [];
    pd.io.inputs.forEach(x => rows.push(['Eingänge', x.key, x.text])); pd.io.outputs.forEach(x => rows.push(['Ausgänge', x.key, x.text]));
    for (let i = 0; i < 8; i++) rows.push(['Merker', 'M0.' + i, 'Merker']);
    sheet('Symboltabelle', (b, close) => {
      let last = '', h = '<p class="hint2" style="margin-top:0">Symbolnamen machen das Programm lesbar (zum Beispiel <b>S1_Start</b> statt E0.0). Sie gelten nur für dieses Programm.</p>';
      rows.forEach(([g, k, t], i) => { if (g !== last) { last = g; h += `<div class="gh">${g}</div>`; } h += `<label class="f" style="margin-bottom:6px"><span>${esc(CORE.addr(k, 's7'))} · ${esc(CORE.addr(k, 'iec'))} · ${esc(t)}</span><input data-k="${k}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc((S.prog.symbols || {})[k] || '')}"></label>`; });
      h += '<div class="btns"><button class="btn" id="symAnl">Aus Anlage übernehmen</button><button class="btn pri" id="symOk">Übernehmen</button></div>';
      b.innerHTML = h;
      $('#symAnl', b).onclick = () => { const s = plantSyms(S.plantId); $$('input[data-k]', b).forEach(i => { if (s[i.dataset.k] != null) i.value = s[i.dataset.k]; }); };
      $('#symOk', b).onclick = () => {
        const s = {}; $$('input[data-k]', b).forEach(i => { const v = i.value.trim().replace(/\s+/g, '_'); if (v) s[i.dataset.k] = v; });
        Object.keys(S.prog.symbols || {}).forEach(k => { if (!rows.some(r => r[1] === k) && S.prog.symbols[k]) s[k] = S.prog.symbols[k]; });
        S.prog.symbols = s; close(); onChanged(); mountEditor(); toast('Symbole übernommen');
      };
    });
  }

  /* ============================================================ Simulation */
  const holds = new Map();
  let evSig = '', opSig = '', ioSig = '';
  function cycle() {
    const p = S.plant, c = S.plc, io = p.io || pdef(S.plantId).io;
    if (!c.ok) { const z = {}; io.outputs.forEach(o => { z[o.key] = false; }); p.writeOutputs(z); p.step(10); return; }
    const ins = p.readInputs(); for (const k in ins) c.setInput(k, !!ins[k]);
    c.scan(10);
    const out = {}; io.outputs.forEach(o => { out[o.key] = !!c.getOutput(o.key); });
    p.writeOutputs(out); p.step(10);
  }
  function makeLive() {
    if (!S.plc || !S.plc.ok) { S.live = null; return; }
    const st = S.plc.state(); let pw = null;
    S.live = { running: S.running, state: st, get power() { if (!pw) pw = S.plc.power(); return pw; } };
  }
  function runCycles(n) { for (let i = 0; i < n; i++) cycle(); S.scanned = true; makeLive(); }
  function setRun(on) {
    if (on && S.readonly) return;
    if (on && S.plc && !S.plc.ok) { toast('Das Programm hat Fehler und kann nicht laufen. Siehe Fehlerliste.'); showErrors(); return; }
    S.running = !!on; if (S.live) S.live.running = S.running; updateChrome(); refreshEditor(true);
    if (on) stat('spsrun', 1, 'max');
    if (on && S.prog && S.prog.lang) stat('spslang_' + S.prog.lang, 1, 'max');
  }
  function stepOnce() {
    if (S.readonly || !S.plc) return; if (!S.plc.ok) { showErrors(); return; }
    S.running = false; runCycles(1); updateChrome(); refreshEditor(true);
  }
  function resetSim() {
    holds.forEach(h => { if (h.key) S.plant.setInput(h.key, h.rest); }); holds.clear();
    S.running = false; acc = 0; S.plant.reset(); S.plc.reset(); Object.keys(S.forces).forEach(k => S.plc.force(k, S.forces[k]));
    S.scanned = false; S.live = null; evSig = ''; fxReset(); updateChrome(); refreshEditor(true); toast('Anlage und SPS zurückgesetzt');
  }
  function setSpeed(v) { S.speed = v; lsPut('sps.speed', String(v)); updateChrome(); }
  function applyForce(k, v) {
    if (v == null) delete S.forces[k]; else S.forces[k] = !!v;
    S.plc.force(k, v == null ? null : !!v); if (v != null) stat('spsforce', 1, 'max');
    makeLive(); updateChrome();
  }
  async function forceDialog(k) {
    const cur = S.forces[k], lab = labelOf(k);
    const v = await pick('Zwangssetzen: ' + lab, [
      { value: 1, label: 'Auf 1 (EIN) zwingen', sub: 'Die SPS sieht diesen Wert, egal was die Anlage meldet.' },
      { value: 0, label: 'Auf 0 (AUS) zwingen' },
      { value: 'x', label: 'Zwang lösen', sub: cur == null ? 'Dieser Operand ist nicht gezwungen.' : 'Aktuell auf ' + (cur ? '1' : '0') + ' gezwungen.', disabled: cur == null }]);
    if (v == null) return;
    if (v === 'x') { applyForce(k, null); toast('Zwang gelöst: ' + lab); }
    else { applyForce(k, v === 1 ? 1 : 0); toast('Gezwungen: ' + lab + ' = ' + v); }
  }
  async function releaseForces() {
    if (!Object.keys(S.forces).length) return;
    if (!await confirmSheet('Alle Zwänge lösen?', 'Es sind ' + Object.keys(S.forces).length + ' Operanden gezwungen.', 'Lösen')) return;
    Object.keys(S.forces).forEach(k => applyForce(k, null)); toast('Alle Zwänge gelöst');
  }
  const labelOf = (k, mode) => { try { return CORE.label(S.prog, k, mode || S.addr); } catch (e) { return k; } };

  /* ---- Zeichenfläche ---- */
  const cvs = $('#cv'), g2 = cvs.getContext('2d'), cvw = $('#cvw');
  let cw = 0, ch = 0, dpr = 1, drawErr = false;
  /* Effekt-Overlay: liegt deckungsgleich über #cv (klickt durch) und wird mit ihm skaliert; Details in spsfx.js */
  const cvfx = document.createElement('canvas'); cvfx.id = 'cvfx'; cvfx.setAttribute('aria-hidden', 'true'); cvfx.style.pointerEvents = 'none'; cvw.appendChild(cvfx);
  let cvScr = null;
  if (FX) FX.attach(cvfx, cvw);
  function ensureScreen() {
    if (cvScr || !FX) return;
    cvScr = document.createElement('canvas'); cvScr.id = 'cvscr'; cvScr.setAttribute('aria-hidden', 'true');
    cvScr.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:90';
    cvScr.width = root.innerWidth; cvScr.height = root.innerHeight; document.body.appendChild(cvScr); FX.attachScreen(cvScr);
  }
  function fitCanvas() {
    const w = cvw.clientWidth, h = cvw.clientHeight; if (!w || !h) return;
    dpr = Math.min(2, root.devicePixelRatio || 1); const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; }
    if (cvfx.width !== W || cvfx.height !== H) { cvfx.width = W; cvfx.height = H; }
    if (cvScr && (cvScr.width !== root.innerWidth || cvScr.height !== root.innerHeight)) { cvScr.width = root.innerWidth; cvScr.height = root.innerHeight; }
    cw = w; ch = h;
  }
  /* ---- Effekte: neue Anlagenereignisse beobachten (Töne, Funken, Sprechblasen), Not-Halt, Meilensteine ---- */
  let fxSeen = new WeakSet(), fxCnt = { sorted: 0 }, fxCool = {}, estopKey = null, estopPrev = null, fxLast = 0;
  const FXCOOL = { sorted: 200, delivered: 500, wrong: 800, lost: 600, pedwait: 3000, crash: 350, overflow: 900, dry: 1500, interlock: 1500, overrun: 1500, obstacle: 600, redrun: 700, pedhit: 600, batch: 600, badbatch: 1200, estop: 400 };
  function fxReset() {
    fxSeen = new WeakSet(); fxCnt = { sorted: 0 }; fxCool = {}; estopPrev = null; estopKey = null;
    const d = S.plantId && pdef(S.plantId); if (d) { const x = d.io.inputs.find(i => /Not-Halt/i.test(i.text)); if (x) estopKey = x.key; }
    if (FX) FX.clear();
  }
  function fxWatch(ts) {
    if (!FX || !S.plant || !FX.isEnabled()) return;
    const p = S.plant, ev = p.events || [];
    if (p.worldSize) { const w = p.worldSize(); FX.setWorld(w.w, w.h); }
    const fast = S.speed > 1, o = { plant: S.plantId, fast, q: S.speed >= 4 ? 0.5 : 1 };
    let budget = fast ? 2 : 3;
    for (let i = Math.max(0, ev.length - 30); i < ev.length; i++) {
      const e = ev[i]; if (fxSeen.has(e)) continue; fxSeen.add(e); if (!e.fx) continue;
      const mile = e.fx === 'sorted' && ++fxCnt.sorted % 10 === 0 ? fxCnt.sorted + ' Teile sortiert!' : '';
      if (mile) FX.trigger('milestone', null, null, mile, o);
      if (S.speed >= 2 && (e.fx === 'delivered' || e.fx === 'wrong')) continue;
      if (ts - (fxCool[e.fx] || -1e9) < (FXCOOL[e.fx] || 300) * (fast ? S.speed : 1) || budget <= 0) continue;
      fxCool[e.fx] = ts; budget--;
      FX.trigger(e.fx, e.x, e.y, null, Object.assign({ what: e.what }, o));
    }
    if (estopKey) {
      let v = true; try { v = !!p.readInputs()[estopKey]; } catch (x) {}
      if (estopPrev === true && v === false) { const fb = S.plantId === 'foerderband'; FX.trigger('estop', fb ? 806 : null, fb ? 440 : null, null, o); }
      estopPrev = v;
    }
  }
  function fxFrame(ts) {
    if (!FX) return; const dt = fxLast ? ts - fxLast : 16; fxLast = ts;
    try { fxWatch(ts); FX.render(cw, ch, dpr, dt); } catch (e) { if (!fxFrame.err) { fxFrame.err = 1; console.error('Effekte:', e); } }
  }
  function toggleFx() {
    if (!FX) return; FX.setEnabled(!FX.isEnabled()); updateChrome(); toast(FX.isEnabled() ? 'Effekte und Ton an' : 'Effekte und Ton aus');
    if (FX.isEnabled()) FX.sound('ding', 0.6);
  }
  function drawPlant() {
    if (!cw || !S.plant || cvw.offsetParent === null) return;
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.fillStyle = '#14181c'; g2.fillRect(0, 0, cw, ch);
    try { S.plant.draw(g2, cw, ch); } catch (e) { if (!drawErr) { drawErr = true; console.error('Anlagenzeichnung:', e); } }
  }
  function placeCanvas() {
    const wide = root.innerWidth >= 900, mini = S.tab === 'prog' && !wide && !S.miniHidden;
    const want = mini ? $('#miniHost') : $('#cvHost');
    if (cvw.parentNode !== want) want.appendChild(cvw);
    $('#miniHost').classList.toggle('on', mini);
    const mt = $('#bMini'); if (mt) { mt.style.display = S.tab === 'prog' && !wide ? '' : 'none'; mt.classList.toggle('on', mini); }
    fitCanvas();
  }
  if (root.ResizeObserver) new ResizeObserver(() => fitCanvas()).observe(cvw);
  root.addEventListener('resize', () => { placeCanvas(); });
  const cvPos = e => { const r = cvs.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const clickSnd = k => { if (root.LochFX) try { root.LochFX.sound(k || 'tick'); } catch (e) {} };
  cvs.addEventListener('pointerdown', e => {
    e.preventDefault(); const p = S.plant; if (!p) return; try { cvs.setPointerCapture(e.pointerId); } catch (x) {}
    const [x, y] = cvPos(e);
    if (p.pointer) { const id = p.pointer('down', x, y); holds.set(e.pointerId, { ptr: true, id }); if (id) clickSnd('tick'); }
    else if (p.hitTest) {
      const h = p.hitTest(x, y, cw, ch); if (!h) return;
      const rest = !!p.readInputs()[h.key]; p.setInput(h.key, !rest); clickSnd(h.kind === 'switch' ? 'click' : 'tick');
      if (h.kind === 'button') holds.set(e.pointerId, { key: h.key, rest });
    }
  });
  const cvUp = e => {
    const h = holds.get(e.pointerId); if (!h) return; holds.delete(e.pointerId);
    if (h.ptr) { const [x, y] = cvPos(e); S.plant.pointer('up', x, y); } else if (h.key) S.plant.setInput(h.key, h.rest);
  };
  cvs.addEventListener('pointerup', cvUp); cvs.addEventListener('pointercancel', cvUp);
  cvs.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || !S.plant || !S.plant.hitTest) return; const [x, y] = cvPos(e); cvs.style.cursor = S.plant.hitTest(x, y, cw, ch) ? 'pointer' : 'default'; });
  cvs.addEventListener('contextmenu', e => e.preventDefault());

  /* ============================================================ Editor-Anbindung */
  let ed = null, edId = '';
  const EDNAME = { kop: 'Kontaktplan-Editor', fup: 'Funktionsplan-Editor', gra: 'GRAFCET-Editor', text: 'Textansicht' };
  function addresses() {
    const pd = pdef(S.plantId), sy = (S.prog && S.prog.symbols) || {}, out = [];
    const add = (key, group, text) => out.push({ key, label: labelOf(key), group, sym: sy[key] || '', text: text || '' });
    pd.io.inputs.forEach(x => add(x.key, 'Eingang', x.text));
    pd.io.outputs.forEach(x => add(x.key, 'Ausgang', x.text));
    for (let b = 0; b < 2; b++) for (let i = 0; i < 8; i++) add('M' + b + '.' + i, 'Merker', 'Merker');
    for (let i = 1; i <= 16; i++) add('T' + i, 'Zeitglied', 'Zeitglied');
    for (let i = 1; i <= 16; i++) add('C' + i, 'Zähler', 'Zähler');
    return out;
  }
  const ctx = {
    getProg: () => S.prog, changed: () => onChanged(), addrMode: () => S.addr, showSymbols: () => S.sym, addresses,
    live: () => S.live, errors: () => allErrors(), toast, pick, ask,
    get readonly() { return S.readonly; }
  };
  function unmountEditor() { if (ed && ed.destroy) { try { ed.destroy(); } catch (e) { console.error(e); } } ed = null; edId = ''; }
  function mountEditor() {
    unmountEditor(); const host = $('#edHost'); host.innerHTML = '';
    if (!S.prog) return;
    const id = S.view === 'text' ? 'text' : S.prog.lang, def = root.SPS_EDIT && root.SPS_EDIT.editors && root.SPS_EDIT.editors[id];
    if (!def) {
      host.innerHTML = `<div class="ph"><b>Editor noch nicht geladen</b>${esc(EDNAME[id] || id)} ist noch nicht verfügbar.<br><button class="btn" id="edRetry">Erneut prüfen</button></div>`;
      $('#edRetry', host).onclick = () => mountEditor(); return;
    }
    const el = document.createElement('div'); el.className = 'edMount'; host.appendChild(el);
    try { ed = def.mount(el, ctx) || {}; edId = id; if (ed.refresh) ed.refresh(); }
    catch (e) { console.error(e); ed = null; host.innerHTML = `<div class="ph"><b>Der Editor konnte nicht gestartet werden</b>${esc(e.message || e)}<br><button class="btn" id="edRetry">Erneut versuchen</button></div>`; $('#edRetry', host).onclick = () => mountEditor(); }
  }
  function refreshEditor(force) { if (ed && ed.refresh && (S.tab === 'prog' || force === 'always')) { try { ed.refresh(); } catch (e) { if (!refreshEditor.err) { refreshEditor.err = 1; console.error('Editor refresh:', e); } } } }

  /* ============================================================ Fehlerlisten */
  function updateErrors() {
    const b = $('#errBox'), c = S.plc; if (!c) return;
    const er = c.errorList || [], wa = c.warnings || [];
    if (!er.length && !wa.length) { b.className = ''; b.innerHTML = ''; return; }
    b.className = 'on'; if (S.errOpen == null) b.open = er.length > 0; else b.open = S.errOpen;
    b.innerHTML = `<summary><span style="color:${er.length ? '#ff8a7a' : 'var(--warn)'}">⚠</span> ${er.length ? er.length + (er.length === 1 ? ' Fehler' : ' Fehler') : ''}${er.length && wa.length ? ' · ' : ''}${wa.length ? wa.length + (wa.length === 1 ? ' Hinweis' : ' Hinweise') : ''}${er.length ? ' – das Programm läuft erst, wenn die Fehler behoben sind' : ''}</summary><ul>${er.map(t => `<li class="e">${esc(t)}</li>`).join('')}${wa.map(t => `<li class="w">${esc(t)}</li>`).join('')}</ul>`;
  }
  $('#errBox').addEventListener('toggle', e => { S.errOpen = e.target.open; });
  function showErrors() {
    const c = S.plc; if (!c) return; const er = c.errorList || [], wa = c.warnings || [];
    sheet('Programmprüfung', b => { b.innerHTML = (!er.length && !wa.length ? '<p>Alles in Ordnung, keine Fehler und keine Hinweise.</p>' : `<ul style="padding-left:18px;margin:0">${er.map(t => `<li style="color:#ff8a7a;padding:4px 0">${esc(t)}</li>`).join('')}${wa.map(t => `<li style="color:var(--warn);padding:4px 0">${esc(t)}</li>`).join('')}</ul>`); });
  }

  /* ============================================================ Oberfläche: Kopf, Tabs, Leiste */
  const TABS = [['plant', '🏭', 'Anlage'], ['prog', '🧩', 'Programm'], ['sim', '🎬', 'Simulation'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Lernen']];
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd" style="display:none"></span>' : ''}</button>`).join('');
    updateTaskBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'prog'; S.tab = t; lsPut('sps.tab', t);
    $('#mid').dataset.tab = t; $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    placeCanvas();
    if (t === 'plant') renderPlant(); else if (t === 'tasks') renderTasks(); else if (t === 'help') renderHelp();
    if (t === 'prog') { mountEditor(); } else if (t === 'sim') { buildIO(); }
    updateChrome();
    requestAnimationFrame(() => { fitCanvas(); drawPlant(); });
  }
  function updateTitle() {
    const pd = pdef(S.plantId);
    $('#title').innerHTML = esc(S.name) + (S.dirty ? ' •' : '') + '\n<small>' + esc(pd ? pd.name : '') + ' · ' + esc(LANGN[S.prog.lang]) + '</small>';
    document.title = 'SPS-Lab: ' + S.name;
  }
  function buildEdBar() {
    const l = S.prog ? S.prog.lang : 'kop', tx = S.view === 'text';
    $('#edBar').innerHTML = ['kop', 'fup', 'gra'].map(k => `<button class="chip${!tx && l === k ? ' on' : ''}" data-l="${k}">${LANGN[k]}</button>`).join('') +
      `<button class="chip${tx ? ' on' : ''}" data-l="text">📄 Text</button><span class="sep"></span><button class="chip" data-a="sym">🏷 Symbole</button><button class="chip" data-a="new">➕ Neu</button><button class="chip" id="bMini" data-a="mini" style="display:${S.tab==='prog'&&root.innerWidth<900?'':'none'}">📺 Anlage</button>`;
  }
  $('#edBar').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.l) { if (b.dataset.l === 'text') { S.view = S.view === 'text' ? 'edit' : 'text'; mountEditor(); updateChrome(); } else switchLang(b.dataset.l); }
    else if (b.dataset.a === 'sym') symbolSheet(); else if (b.dataset.a === 'new') newProgram();
    else if (b.dataset.a === 'mini') { S.miniHidden = !S.miniHidden; lsPut('sps.mini', S.miniHidden ? '1' : '0'); placeCanvas(); }
  });
  $('#miniTog').onclick = () => { S.miniHidden = true; lsPut('sps.mini', '1'); placeCanvas(); };
  $('#title').onclick = async () => { const r = await ask('Name des Programms', [{ key: 'n', label: 'Name', type: 'text', value: S.name }]); if (r && r.n.trim()) { S.name = r.n.trim(); S.dirty = true; updateChrome(); saveCur(); } };

  let palSig = '';
  function buildPal() {
    const nErr = (S.plc && S.plc.errorList.length) || 0, nWarn = (S.plc && S.plc.warnings.length) || 0, nF = Object.keys(S.forces).length;
    const fxOn = FX ? FX.isEnabled() : false, sig = [S.running, S.speed, S.addr, S.sym, nErr, nWarn, nF, hi, hist.length, S.readonly, fxOn].join('|');
    if (sig === palSig) return; palSig = sig;
    const sp = [0.5, 1, 2, 4];
    $('#pal').innerHTML = `<button class="chip ${S.running ? 'on' : 'go'}" data-a="run" aria-label="${S.running ? 'Stopp' : 'Start'}">${S.running ? '⏸ Stopp' : '▶ Start'}</button><button class="chip" data-a="step" aria-label="Ein Zyklus">⏭ Schritt</button><button class="chip" data-a="reset" aria-label="Zurücksetzen">⟲ Reset</button><span class="sep"></span>
      <span class="seg" aria-label="Zeitraffer">${sp.map(v => `<button data-sp="${v}" class="${S.speed === v ? 'on' : ''}">×${String(v).replace('.', ',')}</button>`).join('')}</span><span class="sep"></span>
      <span class="seg" aria-label="Adressanzeige"><button data-ad="iec" class="${S.addr === 'iec' ? 'on' : ''}">IEC</button><button data-ad="s7" class="${S.addr === 's7' ? 'on' : ''}">Siemens</button></span>
      <button class="chip ${S.sym ? 'on' : ''}" data-a="sym" aria-pressed="${S.sym}">🏷 Symbole</button>${FX ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" aria-label="Effekte und Ton" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}
      <span id="stat"></span>${nErr ? `<button class="chip bad" data-a="err">⚠ ${nErr} Fehler</button>` : nWarn ? `<button class="chip warnc" data-a="err">⚠ ${nWarn} ${nWarn === 1 ? 'Hinweis' : 'Hinweise'}</button>` : ''}${nF ? `<button class="chip warnc" data-a="unforce">🔒 ${nF} gezwungen</button>` : ''}`;
    const r = $('#bRun'); r.textContent = S.running ? '⏸' : '▶'; r.classList.toggle('on', S.running); r.setAttribute('aria-label', S.running ? 'Stopp' : 'Start');
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sp) setSpeed(+b.dataset.sp);
    else if (b.dataset.ad) setAddr(b.dataset.ad);
    else if (b.dataset.a === 'run') setRun(!S.running); else if (b.dataset.a === 'step') stepOnce(); else if (b.dataset.a === 'reset') resetSim();
    else if (b.dataset.a === 'sym') toggleSym(); else if (b.dataset.a === 'fx') toggleFx(); else if (b.dataset.a === 'err') showErrors(); else if (b.dataset.a === 'unforce') releaseForces();
  });
  function setAddr(m) { if (S.addr === m) return; S.addr = m; lsPut('sps.addr', m); afterModeChange(); }
  function toggleSym() { S.sym = !S.sym; lsPut('sps.sym', S.sym ? '1' : '0'); afterModeChange(); }
  function afterModeChange() { buildIO(); buildActions(); mountEditor(); updateChrome(); if (S.tab === 'plant') renderPlant(); }
  function updateChrome() { updateTitle(); buildEdBar(); buildPal(); updateTaskBar(); const u = $('#bUndo'), r = $('#bRedo'); u.disabled = hi <= 0 || S.readonly; r.disabled = hi >= hist.length - 1 || S.readonly; }
  $('#bRun').onclick = () => setRun(!S.running);
  $('#bUndo').onclick = undo; $('#bRedo').onclick = redo;
  $('#bEx').onclick = openExamples; $('#bOpen').onclick = openList; $('#bTasks').onclick = () => setTab('tasks'); $('#bShare').onclick = shareNow; $('#bPrint').onclick = printNow;

  /* ============================================================ Ein-/Ausgänge, Status, Meldungen (Seitenleiste) */
  let ioRows = [], actSig = '';
  function buildIO() {
    const pd = pdef(S.plantId), P = $('#simPanel'); if (!P || !pd) return;
    const row = (x, isOut) => {
      const kind = isOut ? 'out' : x.kind || 'sensor', ac = !isOut && (kind === 'button' || kind === 'switch');
      const sy = (S.sym && S.prog.symbols && S.prog.symbols[x.key]) || '';
      const main = S.sym && sy ? sy : CORE.addr(x.key, S.addr), sub = (S.sym && sy ? CORE.addr(x.key, S.addr) + ' · ' : '') + x.text;
      return `<div class="io${ac ? ' ac' : ''}" data-k="${x.key}" data-kind="${kind}"><span class="led${isOut ? ' q' : ''}"></span><div class="lb"><b>${esc(main)}</b><small>${esc(sub)}</small></div><span class="fz">F</span>${ac ? `<span class="k">${kind === 'button' ? 'Taster' : 'Schalter'}</span>` : ''}</div>`;
    };
    const cardOpen = id => { const o = $('#' + id, P); return o ? o.open : true; };
    const op = { cI: cardOpen('cI'), cQ: cardOpen('cQ'), cP: cardOpen('cP'), cE: cardOpen('cE'), cA: cardOpen('cA') };
    P.innerHTML = `<div id="errCard"></div>
      <details class="card" id="cI"${op.cI ? ' open' : ''}><summary>Eingänge</summary><div class="cb">${pd.io.inputs.map(x => row(x, false)).join('')}<p class="hint2" style="padding:0 6px">Taster halten, Schalter antippen. Lange drücken: Zwangssetzen.</p></div></details>
      <details class="card" id="cQ"${op.cQ ? ' open' : ''}><summary>Ausgänge</summary><div class="cb">${pd.io.outputs.map(x => row(x, true)).join('')}</div></details>
      <details class="card" id="cA"${op.cA ? ' open' : ''}><summary>Anlage bedienen</summary><div class="cb" id="actBody"></div></details>
      <details class="card wide" id="cP"${op.cP ? ' open' : ''}><summary>Programmstatus</summary><div class="cb" id="progStat"></div></details>
      <details class="card wide" id="cE"${op.cE ? ' open' : ''}><summary>Meldungen der Anlage</summary><div class="cb"><ul class="ev" id="evList"></ul><div style="padding:4px 6px"><button class="chip s" id="evClr">Liste leeren</button></div></div></details>`;
    ioRows = $$('.io', P).map(el => ({ el, k: el.dataset.k, led: $('.led', el), on: null, f: null }));
    ioSig = ''; opSig = ''; evSig = ''; actSig = ''; buildActions(); updateErrCard();
  }
  function updateErrCard() {
    const c = S.plc, el = $('#errCard'); if (!el || !c) return;
    const er = c.errorList || [];
    el.innerHTML = er.length ? `<div class="card pl warn"><h4>Programm hat Fehler</h4><div style="font-size:13px;color:#ff8a7a">${esc(er[0])}${er.length > 1 ? ' (+' + (er.length - 1) + ' weitere)' : ''}</div><div style="margin-top:8px"><button class="chip s" id="errMore">Alle anzeigen</button></div></div>` : '';
    const m = $('#errMore'); if (m) m.onclick = showErrors;
  }
  const SCENN = { zufall: 'Zufällig', nur_hell: 'Nur helle Teile', nur_metall: 'Nur dunkle Teile', abwechselnd: 'Abwechselnd', dicht: 'Dichter Verkehr', leer: 'Leer', normal: 'Normal', viele_fussgaenger: 'Viele Fußgänger', nur_fussgaenger: 'Nur Fußgänger', nur_autos: 'Nur Autos', halbvoll: 'Halbvoll', voll: 'Voll', voll_ungemischt: 'Voll, ungemischt', behaelter2voll: 'Behälter 2 voll', zu: 'Tor zu', offen: 'Tor offen', halboffen: 'Tor halb offen', hindernis_auto: 'Auto im Tor', hindernis_person: 'Person im Tor', hindernis_katze: 'Katze im Tor' };
  function scenarioNames(p) {
    let l = null; const s = p.scenarios; if (!s) return [];
    if (Array.isArray(s.list)) l = s.list; else if (typeof s === 'function') { try { const r = s(); if (Array.isArray(r)) l = r; } catch (e) {} }
    if (!l && S.plantId === 'tank') l = ['leer', 'halbvoll', 'voll', 'voll_ungemischt', 'behaelter2voll'];
    return l || [];
  }
  function buildActions() {
    const body = $('#actBody'); if (!body || !S.plant) return; const p = S.plant, id = S.plantId; let h = '';
    const b = (a, t) => `<button class="chip s" data-act="${a}">${t}</button>`;
    if (id === 'foerderband') h += '<div class="chips">' + b('piece0', '▫ Helles Teil auflegen') + b('piece1', '▪ Dunkles Teil auflegen') + '</div>';
    if (id === 'ampel') h += '<div class="chips">' + b('ped0', '🚶 Fußgänger links') + b('ped1', '🚶 Fußgänger rechts') + '</div>';
    if (id === 'garagentor') h += '<div class="chips">' + b('obst', '🚧 Hindernis ein/aus') + '</div>';
    const sc = scenarioNames(p);
    if (sc.length) h += '<div class="hint2" style="padding:0 6px 2px">Szenario (setzt die Anlage zurück):</div><div class="chips">' + sc.map(n => `<button class="chip s" data-sc="${n}">${esc(SCENN[n] || n.replace(/_/g, ' '))}</button>`).join('') + '</div>';
    if (!h) h = '<p class="hint2" style="padding:0 6px">Bedienen direkt im Bild: Taster halten, Schalter antippen.</p>';
    body.innerHTML = h;
  }
  $('#simPanel').addEventListener('click', e => {
    const a = e.target.closest('[data-act]'), s = e.target.closest('[data-sc]'), c = e.target.closest('#evClr');
    const p = S.plant;
    if (a) {
      const k = a.dataset.act;
      if (k === 'piece0' || k === 'piece1') { if (!p.addPiece(k === 'piece1')) toast('Am Einlauf ist gerade kein Platz'); }
      else if (k === 'ped0' || k === 'ped1') { if (!p.addPed(k === 'ped1')) toast('Gerade ist kein Platz am Gehweg'); }
      else if (k === 'obst') { const on = p.toggleObstacle(); toast(on ? 'Hindernis steht im Tor' : 'Hindernis entfernt'); }
    } else if (s) { if (p.scenarios(s.dataset.sc)) { S.plc.reset(); Object.keys(S.forces).forEach(k => S.plc.force(k, S.forces[k])); S.scanned = false; S.live = null; evSig = ''; fxReset(); updateChrome(); refreshEditor(true); toast('Szenario: ' + (SCENN[s.dataset.sc] || s.dataset.sc)); } }
    else if (c) { p.events.length = 0; evSig = ''; }
  });
  /* Zeilen: Taster halten, Schalter antippen, lange drücken = Zwangssetzen */
  (function () {
    const P = $('#simPanel'); let cur = null;
    P.addEventListener('pointerdown', e => {
      const r = e.target.closest('.io[data-k]'); if (!r || !S.plant) return;
      const k = r.dataset.k, kind = r.dataset.kind; cur = { id: e.pointerId, el: r, k, kind, long: false, x: e.clientX, y: e.clientY, rest: null, held: false };
      if (kind === 'button') { cur.rest = !!S.plant.readInputs()[k]; S.plant.setInput(k, !cur.rest); cur.held = true; r.classList.add('press'); clickSnd('tick'); }
      cur.t = setTimeout(() => { if (!cur) return; cur.long = true; if (cur.held) { S.plant.setInput(k, cur.rest); cur.held = false; r.classList.remove('press'); } forceDialog(k); }, 520);
    });
    const end = (e, cancel) => {
      if (!cur || cur.id !== e.pointerId) return; clearTimeout(cur.t);
      if (cur.held) { S.plant.setInput(cur.k, cur.rest); cur.el.classList.remove('press'); }
      else if (!cur.long && !cancel && cur.kind === 'switch') { const v = !!S.plant.readInputs()[cur.k]; S.plant.setInput(cur.k, !v); clickSnd('click'); }
      cur = null;
    };
    P.addEventListener('pointerup', e => end(e, false)); P.addEventListener('pointercancel', e => end(e, true));
    P.addEventListener('pointermove', e => { if (cur && !cur.long && Math.hypot(e.clientX - cur.x, e.clientY - cur.y) > 10) { clearTimeout(cur.t); } });
    P.addEventListener('contextmenu', e => { if (e.target.closest('.io')) e.preventDefault(); });
  })();

  const mmss = ms => { const s = Math.floor(ms / 1000), m = Math.floor(s / 60); return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') + ',' + Math.floor((ms % 1000) / 100); };
  let lastUI = 0, lastErrN = -1;
  function updateIO() {
    const st = S.live && S.live.state, ins = S.plant.readInputs(), fz = S.forces;
    ioRows.forEach(r => {
      const isQ = r.k[0] === 'Q'; let v;
      if (r.k in fz) v = fz[r.k]; else if (isQ) v = st ? !!st.Q[r.k] : false; else v = st ? !!st.I[r.k] : !!ins[r.k];
      if (!isQ && !st && !(r.k in fz)) v = !!ins[r.k];
      if (r.on !== v) { r.on = v; r.led.classList.toggle('on', v); }
      const f = r.k in fz; if (r.f !== f) { r.f = f; r.el.classList.toggle('forced', f); }
    });
  }
  function updatePanel() {
    // Programmstatus
    const st = S.live && S.live.state, el = $('#progStat'); if (!el) return;
    let h = '';
    if (!st) h = '<p class="hint2" style="padding:0 6px">Noch kein Zyklus gelaufen. Starte die Simulation mit ▶ oder gehe mit „Schritt“ einen Zyklus weiter.</p>';
    else {
      h += `<div class="kv"><span>SPS-Zeit</span><b>${num1(st.timeMs / 1000)} s</b></div><div class="kv"><span>Zyklen (je 10 ms)</span><b>${st.cycles}</b></div>`;
      if (S.prog.lang === 'gra') {
        const g = S.prog.gra || {}, act = new Set(st.steps || []);
        h += '<div class="kv"><span>Aktive Schritte</span></div><div class="sc">' + (g.steps || []).map(s => `<span class="${act.has(s.id) ? 'on' : ''}" title="${esc(s.title || '')}">${esc(s.id)}</span>`).join('') + '</div>';
      }
      const T = st.T || {}, tk = Object.keys(T);
      tk.forEach(k => { const t = T[k]; const f = t.pt > 0 ? Math.min(100, 100 * t.et / t.pt) : (t.q ? 100 : 0); h += `<div class="tg"><span class="nm" title="${esc(labelOf(k))}">${esc(CORE.addr(k, S.addr))}</span><div class="pbar"><i style="width:${f.toFixed(0)}%"></i></div><span class="vl">${num1(t.et / 1000)} / ${num1(t.pt / 1000)} s</span><span class="q${t.q ? ' on' : ''}"></span></div>`; });
      const C = st.C || {}; Object.keys(C).forEach(k => { const c = C[k]; const f = c.pv > 0 ? Math.min(100, 100 * c.cv / c.pv) : 0; h += `<div class="tg"><span class="nm">${esc(CORE.addr(k, S.addr))}</span><div class="pbar"><i style="width:${f.toFixed(0)}%"></i></div><span class="vl">${c.cv} / ${c.pv}</span><span class="q${c.q ? ' on' : ''}"></span></div>`; });
      const ms = Object.keys(st.M || {}).filter(k => st.M[k]);
      h += '<div class="kv"><span>Merker mit 1</span></div><div class="sc">' + (ms.length ? ms.map(k => `<span class="on">${esc(labelOf(k))}</span>`).join('') : '<span>keine</span>') + '</div>';
    }
    if (h !== opSig) { opSig = h; el.innerHTML = h; }
    // Meldungen
    const ev = S.plant.events || [], sig = ev.length + '|' + (ev.length ? ev[ev.length - 1].text + ev[ev.length - 1].t : '');
    if (sig !== evSig) {
      evSig = sig; const l = $('#evList');
      if (l) l.innerHTML = ev.length ? ev.slice(-40).reverse().map(x => `<li class="${esc(x.kind || 'info')}"><time>${mmss(x.t || 0)}</time><span>${esc(x.text)}</span></li>`).join('') : '<li class="empty">Keine Meldungen. Meldet die Anlage etwas (zum Beispiel einen Fehler), steht es hier.</li>';
      const last = ev[ev.length - 1]; if (last && last.kind === 'error' && S.running && S.tab !== 'sim') toast('⚠ ' + last.text);
    }
    // Zustandsanzeige in der Leiste
    const sEl = $('#stat'); if (sEl) { const html = S.running ? `<b class="run" style="color:var(--ok)">RUN</b> ${st ? num1(st.timeMs / 1000) + ' s' : ''}` : `<b>STOP</b>${st ? ' · ' + num1(st.timeMs / 1000) + ' s' : ''}`; if (sEl.dataset.h !== html) { sEl.dataset.h = html; sEl.innerHTML = html; } }
    const en = S.plc ? S.plc.errorList.length : 0; if (en !== lastErrN) { lastErrN = en; updateErrCard(); }
  }

  /* ============================================================ Tab Anlage */
  function renderPlant() {
    const V = $('#plantView'); const ids = plantIds();
    V.innerHTML = `<p class="big">Anlage wählen</p><p class="hint2" style="margin:0 0 12px">Dein Programm steuert diese Anlage. Jede Anlage hat feste Ein- und Ausgänge, die du unten in der Tabelle siehst. Die Anlage ${S.task ? '<b>ist während der Aufgabe fest vorgegeben</b>' : 'kannst du jederzeit wechseln, das Programm bleibt'}.</p><div class="pgrid">` + ids.map(id => {
      const d = pdef(id), on = id === S.plantId;
      return `<div class="pcard${on ? ' on' : ''}" data-id="${id}"><canvas data-pv="${id}" width="640" height="400"></canvas><div class="pb"><h3>${d.icon} ${esc(d.name)}</h3><p>${esc(d.info)}</p>
        <details><summary>Ein- und Ausgänge (${d.io.inputs.length + d.io.outputs.length})</summary><table class="iot"><tr><th>Adresse</th><th>Symbol</th><th>Bedeutung</th></tr>${d.io.inputs.concat(d.io.outputs).map(x => `<tr><td class="a">${esc(CORE.addr(x.key, S.addr))}</td><td>${esc(x.sym || '')}</td><td>${esc(x.text)}</td></tr>`).join('')}</table></details>
        <button class="btn ${on ? '' : 'pri'}" data-use="${id}">${on ? '✓ Diese Anlage ist aktiv – zum Programm' : 'Diese Anlage verwenden'}</button></div></div>`;
    }).join('') + '</div>';
    ids.forEach(id => {
      const c = $(`canvas[data-pv="${id}"]`, V); if (!c) return;
      try {
        const p = PL.create(id, { seed: 1 }), x = c.getContext('2d');
        if (id === 'foerderband') p.writeOutputs({ 'Q0.0': true }); p.step(id === 'foerderband' ? 5000 : 800);
        x.fillStyle = '#14181c'; x.fillRect(0, 0, 640, 400); p.draw(x, 640, 400);
      } catch (e) { console.error('Vorschau', id, e); }
    });
  }
  $('#plantView').addEventListener('click', e => { const b = e.target.closest('[data-use]'); if (b) usePlant(b.dataset.use); });
  function usePlant(id) {
    if (id === S.plantId) { setTab('prog'); return; }
    if (S.task) { toast('Während einer Aufgabe ist die Anlage fest. Beende zuerst die Aufgabe.'); return; }
    const old = plantSyms(S.plantId), sy = S.prog.symbols || {};
    const own = Object.keys(sy).length === 0 || Object.keys(sy).every(k => old[k] === sy[k]);
    setPlant(id);
    if (own) { S.prog.symbols = plantSyms(id); onChanged(); mountEditor(); }
    setTab('prog'); toast('Anlage: ' + pdef(id).name + (own ? ' (Symbole angepasst)' : ''));
  }

  /* ============================================================ Tab Aufgaben */
  const TK = () => (root.SPS_TASKS && Array.isArray(root.SPS_TASKS.tasks) && root.SPS_TASKS.tasks.length ? root.SPS_TASKS.tasks : null);
  const taskDone = () => lsGet('sim.done', {});
  function markDone(id, pct) {
    try { const d = taskDone(); if ((d[id] || 0) < pct) d[id] = pct; localStorage.setItem('sim.done', JSON.stringify(d)); } catch (e) {}
    if (root.Badges) root.Badges.result(id, pct);
  }
  let taskRes = null;
  const curTask = () => { const a = TK(); return a && S.task ? a.find(t => t.id === S.task.id) : null; };
  function updateTaskBadge() {
    const a = TK(), b = $('#tkBd'); if (!b) return;
    if (!a) { b.style.display = 'none'; return; }
    const d = taskDone(), n = a.filter(t => (d[t.id] || 0) >= 100).length; b.style.display = ''; b.textContent = n + '/' + a.length;
  }
  function updateTaskBar() {
    const t = curTask(), el = $('#taskBar'); if (!el) return;
    if (!t) { el.className = ''; el.innerHTML = ''; return; }
    el.className = 'on'; const sig = t.id + S.readonly; if (el.dataset.s === sig) return; el.dataset.s = sig;
    el.innerHTML = `<span>📝</span><b>${esc(t.title)}</b><button class="chip s" data-ta="info">Aufgabe</button><button class="chip s on" data-ta="check"${S.readonly ? ' disabled' : ''}>✓ Prüfen</button>`;
  }
  $('#taskBar').addEventListener('click', e => { const b = e.target.closest('[data-ta]'); if (!b) return; if (b.dataset.ta === 'info') setTab('tasks'); else checkTask(); });
  async function startTask(id) {
    const t = (TK() || []).find(x => x.id === id); if (!t) return;
    const had = stash(); S.task = { id }; S.view = 'edit'; taskRes = null;
    if (root.Auswertung) root.Auswertung.hintReset(id);
    if (t.plant && pdef(t.plant) && t.plant !== S.plantId) setPlant(t.plant);
    let p; try { p = clone(t.start()); } catch (e) { console.error(e); toast('Die Startvorlage der Aufgabe fehlt'); S.task = null; return; }
    setProg(p, t.title); S.dirty = false; setTab('prog'); updateChrome();
    toast(had ? 'Aufgabe gestartet, dein Programm ist gesichert' : 'Aufgabe gestartet'); renderTasksIfOpen();
  }
  const renderTasksIfOpen = () => { if (S.tab === 'tasks') renderTasks(); };
  async function checkTask() {
    const t = curTask(); if (!t) return; const R = root.SPS_TASKS;
    S.readonly = true; refreshEditor(true); updateChrome(); updateTaskBar();
    let lines;
    try { lines = await (R.run ? R.run(t, clone(S.prog)) : t.check(clone(S.prog))); } catch (e) { console.error(e); lines = [{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden: ' + (e && e.message || e), why: '' }]; }
    S.readonly = false; refreshEditor(true);
    lines = Array.isArray(lines) ? lines : [];
    const pct = Math.round(100 * lines.filter(l => l.ok).length / Math.max(lines.length, 1));
    taskRes = { id: t.id, lines, pct }; markDone(t.id, pct); updateTaskBadge();
    if (FX && FX.isEnabled()) { ensureScreen(); FX.trigger(pct === 100 ? 'pass' : 'fail', null, null, null, { plant: S.plantId }); }
    else if (pct === 100 && root.LochFX) try { root.LochFX.sound('pop'); } catch (e) {}
    updateChrome(); updateTaskBar(); if (S.tab !== 'tasks') setTab('tasks'); else renderTasks();
    toast(pct === 100 ? '🎉 Geschafft!' : pct + ' % richtig');
  }
  function hintTask() {
    const t = curTask(); if (!t) return; const h = t.hint, arr = Array.isArray(h) ? h : null;
    const open = () => {
      const had = stash(); const p = clone(t.sol()); S.task = null; taskRes = null;
      if (t.plant && pdef(t.plant) && t.plant !== S.plantId) setPlant(t.plant);
      setProg(p, t.title + ' (Musterlösung)'); setTab('prog'); toast(had ? 'Musterlösung geöffnet, dein Stand ist gesichert' : 'Musterlösung geöffnet');
    };
    const o = { id: t.id, hint: arr ? arr[0] : h, concrete: () => { if (arr && arr[1]) return arr[1]; const l = taskRes && taskRes.id === t.id ? taskRes.lines.find(x => !x.ok) : null; return l ? 'Noch nicht erfüllt: ' + l.text : taskRes && taskRes.id === t.id ? 'Alle Prüfpunkte sind erfüllt. Tippe auf „Lösung prüfen“.' : 'Tippe zuerst auf „Lösung prüfen“, dann kann ich dir den ersten offenen Punkt nennen.'; }, reveal: arr && arr[2] ? () => arr[2] : null, solution: typeof t.sol === 'function' ? open : null };
    if (root.Auswertung) root.Auswertung.hint(o); else sheet('Tipp', b => { b.innerHTML = '<p style="margin-top:0">' + esc(o.hint || '') + '</p>'; });
  }
  function renderTasks() {
    const V = $('#taskView'), A = TK();
    if (!A) { V.innerHTML = '<div class="card pl"><h4>Aufgaben</h4><p class="big">Aufgaben folgen</p><p class="hint2">Hier erscheinen bald Aufgaben mit automatischer Prüfung: Grundlagen, Zeit und Zählen, Ampel, Förderband, Tank, Garagentor, GRAFCET und Fehlersuche. Bis dahin kannst du mit den Beispielen üben (📖 oben).</p><div class="btns"><button class="btn pri" id="tkEx">Beispiele ansehen</button></div></div>'; $('#tkEx', V).onclick = openExamples; return; }
    const d = taskDone(), t = curTask(); let h = '';
    const n100 = A.filter(x => (d[x.id] || 0) >= 100).length;
    if (t) {
      const pd = pdef(t.plant), r = taskRes && taskRes.id === t.id ? taskRes : null;
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat || '')}</h4><div class="big">${esc(t.title)}</div><div class="lv">${'●'.repeat(t.level || 1)}${'○'.repeat(3 - (t.level || 1))}</div>
        <p style="margin:8px 0">${esc(t.text)}</p><p class="hint2" style="margin-top:0">Anlage: ${pd ? pd.icon + ' ' + esc(pd.name) : ''}</p>
        <div class="btns"><button class="btn pri" data-ta="check">✓ Lösung prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button></div>
        <div class="btns"><button class="btn" data-ta="prog">Zum Programm</button><button class="btn" data-ta="hand">Abgeben (QR)</button><button class="btn danger" data-ta="end">Aufgabe beenden</button></div>`;
      if (r) h += `<ul class="tl">${r.lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}${!l.ok && l.why ? `<details><summary>Warum?</summary>${esc(l.why)}</details>` : ''}</li>`).join('')}</ul><div class="score ${r.pct === 100 ? 'ok' : ''}">${r.pct === 100 ? '🎉 Geschafft!' : r.pct + ' % richtig'}</div>`;
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${A.length} Aufgaben vollständig gelöst. Wähle eine Aufgabe: Du bekommst eine Startvorlage, programmierst und lässt die Lösung in der Simulation prüfen.</p>`;
    let last = '';
    A.forEach(x => {
      if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; }
      const p = d[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${p >= 100 ? 'g' : p > 0 ? 'p' : ''}">${p >= 100 ? '✓' : p > 0 ? p : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${'●'.repeat(x.level || 1)}${'○'.repeat(3 - (x.level || 1))}</span> ${(pdef(x.plant) || {}).icon || ''} ${esc((pdef(x.plant) || {}).name || '')}${p != null ? ' · bisher ' + p + ' %' : ''}</small></div></button>`;
    });
    V.innerHTML = h;
  }
  $('#taskView').addEventListener('click', async e => {
    const tb = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tb) {
      const a = tb.dataset.ta;
      if (a === 'check') checkTask(); else if (a === 'hint') hintTask(); else if (a === 'prog') setTab('prog');
      else if (a === 'hand') { const t = curTask(); if (t && root.Auswertung) root.Auswertung.handIn(t.id, taskDone()[t.id] || 0, t.title); }
      else if (a === 'end') { S.task = null; taskRes = null; updateChrome(); renderTasks(); toast('Aufgabe beendet'); }
    } else if (row) startTask(row.dataset.t);
  });

  /* ============================================================ Tab Lernen */
  function timing(rows, T) {
    const L = 58, W = 330, R = 8, rh = 36, H = rows.length * rh + 22, X = t => (L + (W - L - R) * t / T).toFixed(1);
    let s = `<svg class="tm" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Zeitdiagramm">`;
    rows.forEach((r, i) => {
      const y0 = 10 + i * rh + 24, y1 = y0 - 20; let d = '', pv = null;
      r.p.forEach(([t, v]) => { const y = v ? y1 : y0; d += pv === null ? `M${X(t)},${y}` : `L${X(t)},${pv}L${X(t)},${y}`; pv = y; });
      d += `L${X(T)},${pv}`;
      s += `<text x="4" y="${y0 - 6}" fill="#8d99a6" font-size="12" font-family="system-ui">${r.n}</text><path d="${d}" fill="none" stroke="${r.c || '#4cd964'}" stroke-width="2.2" stroke-linejoin="round"/>`;
    });
    for (let t = 0; t <= T; t++) s += `<line x1="${X(t)}" x2="${X(t)}" y1="6" y2="${H - 18}" stroke="#38424d" stroke-dasharray="2 3"/><text x="${X(t)}" y="${H - 5}" fill="#8d99a6" font-size="10" text-anchor="middle" font-family="system-ui">${t} s</text>`;
    return s + '</svg>';
  }
  let helpDone = false;
  function renderHelp() {
    const V = $('#helpView'); if (helpDone) { return; } helpDone = true;
    const ex = (id, t) => `<button class="chip s" data-ex="${id}">${t}</button>`;
    V.innerHTML = `<p class="big">Lernen und Hilfe</p><p class="hint2" style="margin:0 0 12px">Kurz erklärt, was du für die SPS-Programmierung brauchst. Zum Ausprobieren gibt es Knöpfe, die ein passendes Beispiel laden.</p>
    <details open><summary>1 · So arbeitet eine SPS</summary><div class="hb2"><p>Eine speicherprogrammierbare Steuerung (SPS) wiederholt immer wieder denselben <b>Zyklus</b>:</p><p><b>1.</b> Eingänge einlesen (Taster, Schalter, Sensoren) und als <b>Prozessabbild</b> einfrieren<br><b>2.</b> Programm von oben nach unten abarbeiten<br><b>3.</b> Ausgänge schreiben (Schütze, Ventile, Lampen)</p><p>Im SPS-Lab dauert ein Zyklus <b>10 ms</b>. Während des Zyklus ändert sich ein Eingang nie mitten im Programm, jede Stelle sieht denselben Wert. Mit dem Zeitraffer (×0,5 bis ×4) läuft die Anlage schneller oder langsamer, die SPS rechnet immer 10-ms-Schritte. Mit <b>Schritt</b> gehst du genau einen Zyklus weiter.</p></div></details>
    <details><summary>2 · Adressen: IEC und Siemens</summary><div class="hb2"><p>Jeder Ein- und Ausgang hat eine Adresse. Unten in der Leiste schaltest du zwischen <b>IEC</b> (nach Norm) und <b>Siemens</b> um. Das Programm bleibt gleich, nur die Anzeige ändert sich. Mit <b>Symbole</b> siehst du statt der Adresse einen Namen wie <code>S1_Start</code>.</p><table><tr><th>Bedeutung</th><th>IEC</th><th>Siemens</th></tr><tr><td>Eingang</td><td><code>%IX0.0</code></td><td><code>E0.0</code></td></tr><tr><td>Ausgang</td><td><code>%QX0.1</code></td><td><code>A0.1</code></td></tr><tr><td>Merker</td><td><code>%MX0.2</code></td><td><code>M0.2</code></td></tr><tr><td>Zeitglied</td><td><code>TON1</code>, <code>TOF1</code>, <code>TP1</code></td><td><code>T1</code> (SE, SA, SI)</td></tr><tr><td>Zähler</td><td><code>CTU1</code>, <code>CTD1</code></td><td><code>Z1</code></td></tr><tr><td>Anweisungen</td><td>LD, AND, OR, ST, S, R</td><td>U, UN, O, =, S, R</td></tr></table><p>Die Zahl hinter dem Punkt ist das Bit (0 bis 7), davor das Byte. <code>E0.3</code> ist also Bit 3 im Eingangsbyte 0.</p></div></details>
    <details><summary>3 · Öffner und Schließer beim Stopp-Taster</summary><div class="hb2"><p>Ein <b>Schließer</b> liefert nur gedrückt eine 1. Ein <b>Öffner</b> liefert in Ruhe eine 1 und gedrückt eine 0. Stopp-Taster und Not-Halt sind aus Sicherheitsgründen <b>Öffner</b>: Bricht ein Draht, sieht die SPS eine 0 und schaltet ab, genau wie bei Betätigung.</p><p>Im Programm heißt das: Den Stopp-Taster fragst du als <b>Schließer-Kontakt</b> ab (Ruhe = 1 = Strom fließt). Das überrascht am Anfang, ist aber Absicht.</p><div class="tryit">${ex('selbsthaltung', 'Selbsthaltung ausprobieren')}</div></div></details>
    <details><summary>4 · KOP, FUP und GRAFCET</summary><div class="hb2"><p><b>KOP (Kontaktplan)</b> sieht aus wie ein Stromlaufplan: Kontakte (Schließer, Öffner) in Reihe sind UND, parallel sind ODER. Rechts steht die Spule oder eine Zuweisung. <b>Setzen (S)</b> hält einen Ausgang auch nach dem Loslassen, <b>Rücksetzen (R)</b> löscht ihn.</p><p><b>FUP (Funktionsplan)</b> zeigt dieselbe Logik mit Gattern (UND, ODER, XOR) und Bausteinen. KOP und FUP lassen sich ineinander umschalten.</p><p><b>GRAFCET</b> beschreibt Abläufe: Ein <b>Schritt</b> ist aktiv oder nicht, <b>Aktionen</b> gehören zu einem Schritt, eine <b>Transition</b> schaltet weiter, wenn ihre Bedingung wahr ist. Aktionen: <code>N</code> nur solange aktiv, <code>S</code> speichern (setzen), <code>R</code> rücksetzen, <code>D</code> verzögert, <code>L</code> zeitbegrenzt. Zeitbedingungen schreibst du so: <code>t/S1/3s</code> (Schritt S1 seit 3 s aktiv).</p><p>Die Ansicht <b>Text</b> zeigt dein Programm als Anweisungsliste.</p></div></details>
    <details><summary>5 · Zeitglieder und Zähler</summary><div class="hb2"><table><tr><th>Baustein</th><th>Verhalten</th></tr><tr><td><b>TON</b> (SE)<br>Einschaltverzögerung</td><td>Ausgang geht erst an, wenn der Eingang <b>PT</b> lang durchgehend 1 war.</td></tr><tr><td><b>TOF</b> (SA)<br>Ausschaltverzögerung</td><td>Ausgang geht sofort an und fällt erst <b>PT</b> nach dem Abschalten des Eingangs ab.</td></tr><tr><td><b>TP</b> (SI)<br>Impuls</td><td>Eine steigende Flanke startet einen Impuls von genau <b>PT</b> Länge.</td></tr><tr><td><b>CTU</b> (Z vorwärts)</td><td>Jede steigende Flanke zählt +1, Reset setzt auf 0, Ausgang bei Zählwert ≥ <b>PV</b>.</td></tr><tr><td><b>CTD</b> (Z rückwärts)</td><td>Jede steigende Flanke zählt −1 (nie unter 0), Laden setzt auf <b>PV</b>, Ausgang bei Zählwert 0.</td></tr></table>
      ${timing([{ n: 'Eingang', p: [[0, 0], [1, 1], [5, 0]], c: '#3b9eff' }, { n: 'TON 3 s', p: [[0, 0], [4, 1], [5, 0]] }], 6)}${timing([{ n: 'Eingang', p: [[0, 0], [1, 1], [3, 0]], c: '#3b9eff' }, { n: 'TOF 2 s', p: [[0, 0], [1, 1], [5, 0]] }], 6)}${timing([{ n: 'Eingang', p: [[0, 0], [1, 1], [2, 0]], c: '#3b9eff' }, { n: 'TP 3 s', p: [[0, 0], [1, 1], [4, 0]] }], 6)}
      <p>Oben der Eingang (blau), darunter der Ausgang des Bausteins (grün). Jedes Zeitglied und jeder Zähler darf nur <b>einmal</b> im Programm vorkommen.</p><div class="tryit">${ex('blinker', 'Blinker ansehen')}${ex('zaehler', 'Zähler ansehen')}${ex('treppenlicht', 'Treppenlicht (TP)')}</div></div></details>
    <details><summary>6 · Die Anlage bedienen</summary><div class="hb2"><p><b>Taster</b> halten (solange du drückst, ist der Eingang gesetzt), <b>Schalter</b> antippen (rasten ein). Das geht direkt im Bild und in der Eingangsliste. Beim Garagentor stellst du ein <b>Hindernis</b> ins Tor, indem du es antippst.</p><p><b>Zwangssetzen:</b> Drücke in der Ein- oder Ausgangsliste lange auf eine Zeile. Du kannst den Wert dann auf 1 oder 0 festhalten, egal was die Anlage meldet. So testest du Programmteile, auch wenn der Sensor gerade nichts liefert. Gezwungene Zeilen sind orange markiert, unten in der Leiste löst du alle Zwänge wieder.</p><p><b>Meldungen:</b> Die Anlage meldet Fehler wie „Tank läuft über“ oder „Zylinder fährt bei Teil davor“. Dein Ziel ist immer ein Programm, bei dem die Anlage ohne Meldung läuft.</p></div></details>
    <details><summary>7 · Fehler suchen</summary><div class="hb2"><p><b>Nichts bewegt sich:</b> Läuft die Simulation (▶)? Hat das Programm Fehler (rotes Feld unten)? Ist ein Eingang noch gezwungen?</p><p><b>Anlage geht nicht aus:</b> Hast du den Stopp-Taster als Schließer-Kontakt abgefragt (siehe Abschnitt 3)? Steht der Not-Halt noch in Ruhe?</p><p><b>Spule wird zweimal beschrieben:</b> Ein Ausgang sollte nur in einem Netzwerk stehen, sonst gewinnt das letzte. Nutze Merker, wenn mehrere Bedingungen zusammenwirken.</p><p><b>Mit „Schritt“ arbeiten:</b> Gehe Zyklus für Zyklus, im KOP sind Kontakte mit Stromfluss grün.</p></div></details>
    <details><summary>8 · Tastenkürzel</summary><div class="hb2">${keysHtml()}</div></details>`;
  }
  $('#helpView').addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (b) loadExampleByName(b.dataset.ex); });
  function keysHtml() {
    const k = (a, t) => `<tr><td style="white-space:nowrap"><code>${a}</code></td><td>${t}</td></tr>`;
    return '<table>' + k('Eingabe oder F5', 'Simulation starten und anhalten') + k('N', 'Ein Zyklus weiter (Schritt)') + k('Z', 'Zurücksetzen (Reset)') + k('1 bis 4', 'Zeitraffer ×0,5 / ×1 / ×2 / ×4') + k('A', 'Adressanzeige IEC / Siemens') + k('S', 'Symbolnamen ein oder aus') + k('Strg + Z', 'Rückgängig') + k('Strg + Umschalt + Z', 'Wiederholen') + k('Strg + S', 'Programm speichern') + k('?', 'Diese Übersicht') + '</table><p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>';
  }

  /* ============================================================ Menü */
  function openMenu() {
    const nT = (TK() || []).length;
    const rows = [
      ['tasks', 'Aufgaben', nT ? nT + ' Aufgaben mit automatischer Prüfung' : 'Aufgaben folgen'], ['new', 'Neues Programm', 'KOP, FUP oder GRAFCET'], ['ex', 'Beispielprogramme', exampleList().length + ' Programme zum Ausprobieren'],
      ['open', 'Öffnen', 'Gespeicherte Programme auf diesem Gerät'], ['save', 'Speichern unter …', S.name], ['sym', 'Symboltabelle', 'Namen für Ein- und Ausgänge'],
      ['text', 'Programm als Text', 'Anweisungsliste ansehen, kopieren, sichern'], ['share', 'Teilen', 'Link zum Weitergeben (Programm steckt im Link)'], ['import', 'Aus Code oder Link laden', 'Geteiltes Programm einfügen'],
      ['fx', 'Effekte und Ton: ' + (FX && FX.isEnabled() ? 'an' : 'aus'), 'Funken, Sprechblasen, Konfetti und lustige Töne ein- oder ausschalten'], ['png', 'Anlagenbild speichern (PNG)', 'Aktuelle Ansicht als Bilddatei'], ['print', 'Drucken', 'Programm, Zuordnungsliste und Anlagenbild'], ['calc', 'Rechner', 'Ohm, Farbcode, Leitung und mehr'],
      ['abz', 'Abzeichen', 'Deine Sammlung und was noch fehlt'], ['kamp', 'Kampagne: Das Abschlussgerät', 'Lernpfad mit Geschichte über alle Labs'], ['trainer', 'Trainer: Erste Schritte', 'Kurze Einführung zum Mitmachen'],
      ['neu', 'Neu in dieser Version', 'Was zuletzt dazukam und wo du es findest'], ['erg', 'Ergebnis senden', 'Code für den Ausbilder: meine bearbeiteten Aufgaben'], ['keys', 'Tastenkürzel', 'Alle Tasten (Taste ? drücken)'], ['help', 'Hilfe und Lernen', 'Grundlagen kurz erklärt'], ['start', 'Zur Startseite', '']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${r[1]}</b>${r[2] ? `<small>${esc(r[2])}</small>` : ''}</div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); menuAct(r.dataset.m); });
    });
  }
  function menuAct(m) {
    switch (m) {
      case 'tasks': setTab('tasks'); break; case 'new': newProgram(); break; case 'ex': openExamples(); break; case 'open': openList(); break; case 'save': doSave(); break;
      case 'sym': symbolSheet(); break; case 'text': textSheet(); break; case 'share': shareNow(); break; case 'import': importSheet(); break; case 'fx': toggleFx(); break; case 'png': exportPng(); break;
      case 'print': printNow(); break; case 'calc': if (root.Rechner) root.Rechner.open(); break; case 'abz': if (root.Badges) root.Badges.open(); break;
      case 'kamp': if (root.Kampagne) root.Kampagne.open(); break; case 'trainer': if (root.Trainer) root.Trainer.start(); break; case 'neu': if (root.LabNeu) root.LabNeu(); break;
      case 'erg': if (root.Auswertung) root.Auswertung.openSend(); break; case 'keys': if (root.LochKeys) root.LochKeys.help(); else keysSheet(); break;
      case 'help': setTab('help'); break; case 'start': location.href = 'index.html'; break;
    }
  }
  $('#bMenu').onclick = openMenu;
  const keysSheet = () => sheet('Tastenkürzel', b => { b.innerHTML = keysHtml(); });

  /* ============================================================ Tastatur */
  const typing = e => { const t = e.target; return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); };
  root.addEventListener('keydown', e => {
    if (typing(e) || e.altKey || document.querySelector('.backdrop')) return;
    const k = e.key, mod = e.ctrlKey || e.metaKey;
    if (mod) {
      if (k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (k.toLowerCase() === 's') { e.preventDefault(); doSave(); }
      return;
    }
    const l = k.toLowerCase();
    if (l === 'n') stepOnce(); else if (l === 'z') resetSim(); else if (l === 'a') setAddr(S.addr === 'iec' ? 's7' : 'iec'); else if (l === 's') toggleSym();
    else if (k >= '1' && k <= '4') setSpeed([0.5, 1, 2, 4][+k - 1]);
  });

  /* ============================================================ Hauptschleife */
  let last = 0, lastDrawEd = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = ts; return; }
    const dt = Math.min(100, ts - (last || ts)); last = ts;
    let cycled = false;
    if (S.running && S.plc) {
      acc += dt * S.speed; let n = Math.floor(acc / 10);
      if (n > 0) { acc -= n * 10; n = Math.min(n, 240); runCycles(n); cycled = true; }
    }
    drawPlant(); fxFrame(ts);
    if (S.tab === 'sim' || S.tab === 'prog') {
      if (ts - lastUI > 60 || cycled && ts - lastUI > 30) { lastUI = ts; updateIO(); updatePanel(); }
      if (S.tab === 'prog' && (cycled || S.running)) refreshEditor();
    }
  }

  /* ============================================================ Schnittstellen für Trainer, Tasten, Tests */
  root.LabTrainerAPI = {
    lab: 'sps', tab: () => S.tab, go: setTab, simMode: () => S.tab === 'sim' || S.running, running: () => S.running, plant: () => S.plantId, lang: () => S.prog.lang,
    prog: () => S.prog, load: loadExampleByName, examples: () => exampleList().map(e => e.name), cycles: () => (S.live ? S.live.state.cycles : 0), forced: () => Object.keys(S.forces).length,
    addr: () => S.addr, symbols: () => S.sym, speed: () => S.speed, task: () => (S.task ? S.task.id : null), content: () => hasContent(S.prog), saved: () => progs().length
  };
  root.LabKeysAdapter = {
    lab: 'sps', sheet: (title, build) => (title === 'Tastenkürzel' ? sheet(title, b => { b.innerHTML = keysHtml(); }) : sheet(title, build)), esc, toast,
    sim: () => setRun(!S.running), busy: () => true, has: () => false
  };
  /* kleine Testschnittstelle */
  root.SPS_UI = { S, setTab, setPlant, setProg, setRun, stepOnce, resetSim, runCycles, onChanged, emptyProg, loadExampleByName, ctx, addresses, mountEditor, forceDialog, applyForce, pick, ask, startTask, checkTask, undo, redo, usePlant, fitCanvas, placeCanvas };

  /* ============================================================ Start */
  function init() {
    buildTabs();
    const cur = lsGet('sps.cur', null);
    let started = false;
    if (cur && cur.prog && (cur.prog.networks || cur.prog.gra) && pdef(cur.plant)) {
      S.plantId = cur.plant; S.task = cur.task ? { id: cur.task } : null; S.prog = cur.prog; S.name = cur.name || 'Programm'; S.id = cur.id || null;
      setPlant(cur.plant); setProg(cur.prog, cur.name, cur.id); S.dirty = !!cur.dirty; started = true;
    }
    if (!started) {
      const e = CORE.exampleProgs.selbsthaltung; S.prog = clone(e.prog); S.plantId = e.plant;
      setPlant(e.plant); setProg(clone(e.prog), 'Selbsthaltung (Beispiel)');
      if (!lsRaw('sps.seen', '')) { lsPut('sps.seen', '1'); setTimeout(() => toast('Willkommen! Starte mit ▶ und tippe die Taster der Anlage an.'), 900); }
    }
    placeCanvas(); setTab(S.tab);
    requestAnimationFrame(frame);
    /* Aufrufparameter von Startseite, Lernpfad, Kampagne und Lernheften: ?aufgabe=sp1, ?ex=Name, ?bsp, ?neu */
    try {
      const q = new URLSearchParams(location.search), qa = q.get('aufgabe'), qe = q.get('ex');
      if (qa && (TK() || []).some(x => x.id === qa)) setTimeout(() => startTask(qa), 250);
      else if (qe) setTimeout(() => loadExampleByName(qe), 250);
      else if (q.has('bsp')) setTimeout(openExamples, 400);
      else if (q.has('neu')) setTimeout(newProgram, 400);
    } catch (e) { console.error(e); }
    if (/^#[sz]=/.test(location.hash)) { const h = location.hash; history.replaceState(null, '', location.pathname + location.search); loadShared(h); }
    root.addEventListener('hashchange', () => { if (/^#[sz]=/.test(location.hash)) { const h = location.hash; history.replaceState(null, '', location.pathname + location.search); loadShared(h); } });
    root.addEventListener('beforeunload', () => { lsSet('sps.cur', { name: S.name, id: S.id, plant: S.plantId, prog: S.prog, task: S.task ? S.task.id : null, dirty: S.dirty }); });
  }
  init();
})(window);
