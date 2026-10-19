'use strict';
/* Tonfunk Leiterplatten-Lab: Oberfläche.
   Seite, Tabs (Layout, Lagen, Fertigung, Bestückung, Fehlersuche, Aufgaben, Lernen), Statusleiste, Platinen speichern/öffnen/teilen/exportieren,
   Aufgabenanbindung, Effekte und das ctx-Objekt für die Ansichten (PCB_VIEWS.views[id].mount(el, ctx)).
   Die Ansichten kommen aus pcbedit.js (edit), pcbfab.js (stack, gerber, fab), pcbasm.js (asm, solder), pcbrepair.js (repair); Kern: pcbcore.js (PCB_CORE);
   Beispiele und Aufgaben: pcbdata.js (PCB_DATA, PCB_TASKS).
   Speicher: pcb.boards (gespeicherte Platinen), pcb.cur (laufende Arbeit), pcb.tab, pcb.sub, sim.done (Aufgaben, gemeinsam mit den anderen Labs). */
(function (root) {
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const lsRaw = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsPut = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const clone = o => JSON.parse(JSON.stringify(o));
  const CORE = () => root.PCB_CORE;
  const stat = (k, v, m) => { if (root.Badges) try { root.Badges.stat(k, v, m); } catch (e) {} };
  const uid = () => 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const fmt = (x, d) => { const f = Math.pow(10, d == null ? 2 : d); return (Math.round(x * f) / f).toString().replace('.', ','); };
  const num = s => parseFloat(String(s).replace(',', '.'));

  /* ============================================================ Fenster, Meldungen, Dialoge */
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }
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
  /* Auswahl-Dialog: options [{value,label,sub?,group?,disabled?,mark?}] oder Texte -> Promise<value|null> */
  function pick(title, options, opt) {
    opt = opt || {};
    options = (options || []).map(o => (o && typeof o === 'object') ? o : { value: o, label: String(o) });
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
  /* Eingabeformular: fields [{key,label,type:'text'|'number'|'select',value,options?,optional?,unit?}] -> Promise<{key:value}|null> */
  function ask(title, fields, opt) {
    opt = opt || {};
    return new Promise(res => {
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        b.innerHTML = (opt.intro ? `<p class="hint2" style="margin-top:0">${esc(opt.intro)}</p>` : '') + fields.map((f, i) => {
          if (f.type === 'select') {
            const os = (f.options || []).map(o => (o && typeof o === 'object') ? o : { value: o, label: String(o) });
            return `<label class="f"><span>${esc(f.label)}</span><select id="ak${i}">${os.map(o => `<option value="${esc(o.value)}"${String(o.value) === String(f.value) ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
          }
          const v = f.value == null ? '' : (f.type === 'number' ? String(f.value).replace('.', ',') : f.value);
          return `<label class="f"><span>${esc(f.label)}${f.unit ? ' (' + esc(f.unit) + ')' : ''}</span><input id="ak${i}" type="text" inputmode="${f.type === 'number' ? 'decimal' : 'text'}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(v)}"></label>`;
        }).join('') + '<div id="akErr" class="hint2" style="color:#ff8a7a;min-height:18px"></div><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn pri" data-ok>OK</button></div>';
        const ok = () => {
          const out = {};
          for (let i = 0; i < fields.length; i++) {
            const f = fields[i], raw = $('#ak' + i, b).value;
            if (f.type === 'number') {
              if (f.optional && !String(raw).trim()) { out[f.key] = null; continue; }
              const v = num(raw); if (!isFinite(v)) { $('#akErr', b).textContent = f.label + ': Bitte eine Zahl eingeben.'; return; }
              if (f.min != null && v < f.min) { $('#akErr', b).textContent = f.label + ': mindestens ' + fmt(f.min) + '.'; return; }
              if (f.max != null && v > f.max) { $('#akErr', b).textContent = f.label + ': höchstens ' + fmt(f.max) + '.'; return; }
              out[f.key] = v;
            } else out[f.key] = raw;
          }
          fin(out); close();
        };
        $('[data-c]', b).onclick = close; $('[data-ok]', b).onclick = ok;
        b.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
        if (!('ontouchstart' in window)) setTimeout(() => { const i = $('#ak0', b); if (i && i.select) { i.focus(); i.select(); } }, 60);
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
  root.LabUI = { sheet, esc, toast, userName: () => lsRaw('lm4.name', ''), LAB: 'pcb' };
  root.sheet = sheet; root.toast = toast;

  /* ============================================================ Effekte (nur über die öffentliche API von fx.js) */
  const SOUNDS = ['boom', 'pop', 'zap', 'fizz', 'tick', 'click', 'crash', 'splash', 'boing', 'honk', 'buzz', 'alarm', 'ding', 'tada', 'sad', 'clunk', 'spark', 'whistle', 'slide', 'kazoo', 'squeak'];
  const DRCOK = ['Null Fehler. Genau so!', 'DRC sauber, Respekt!', 'Alles im grünen Bereich.', 'Der Prüfer hat nichts zu meckern.'];
  const pickOf = a => a[Math.floor(Math.random() * a.length)];
  /* fx(kind, x?, y?, text?): kind = 'pass' | 'fail' | 'confetti' | Variantenart aus fx.js ('ok', 'fail', 'done', ...) | Tonname ('ding', 'zap', 'tada', ...) | 'say' */
  function fx(kind, x, y, text) {
    const F = root.LochFX; if (!F) return;
    try {
      if (kind === 'pass') { F.pass(100); return; }
      if (kind === 'fail') { F.pass(30); return; }
      if (kind === 'confetti') { F.confetti(!!text); return; }
      if (kind === 'say') { if (text) F.say(text); return; }
      if (SOUNDS.includes(kind)) {
        F.sound(kind); if (text) F.say(text);
        if (kind === 'zap') setTimeout(() => { try { F.sound('spark', 0.5); } catch (e) {} }, 180);
        return;
      }
      if (F.kinds && F.kinds().includes(kind)) { const v = F.variant(kind); if (text || (v && v.text)) F.say(text || v.text); return; }
      if (text) F.say(text);
    } catch (e) {}
  }
  const fxOn = () => !!(root.LochFX && !root.LochFX.isMuted());
  function toggleFx() {
    const F = root.LochFX; if (!F) return;
    F.setMuted(fxOn()); updateChrome(); toast(fxOn() ? 'Effekte und Ton an' : 'Ton aus');
    if (fxOn()) F.sound('ding', 0.6);
  }

  /* ============================================================ Platine: Grundform, Zustand, Verlauf */
  const DEFRULES = { minWidth: 0.2, clearance: 0.2, minDrill: 0.3, annular: 0.15, edge: 0.3, viaDia: 0.8, viaDrill: 0.4, maskExpansion: 0.05, silkWidth: 0.15 };
  const LAYERN = { 1: 'Einseitig (1 Lage)', 2: 'Zweilagig', 4: 'Vierlagig', 6: 'Sechslagig' };
  function ensureShape(b) {
    ['nets', 'parts', 'tracks', 'vias', 'zones', 'texts'].forEach(k => { if (!Array.isArray(b[k])) b[k] = []; });
    b.rules = Object.assign({}, DEFRULES, b.rules || {});
    if (!(b.w > 0)) b.w = 50; if (!(b.h > 0)) b.h = 40; if (![1, 2, 4, 6].includes(b.layers)) b.layers = 2;
    if (!(b.copperOz > 0)) b.copperOz = 1; if (!(b.grid > 0)) b.grid = 0.25; if (!b.id) b.id = uid(); if (!b.name) b.name = 'Platine';
    return b;
  }
  function mkBoard(o) {
    o = o || {}; const C = CORE(); let b = null;
    if (C && C.newBoard) { try { b = C.newBoard(o); } catch (e) { console.error('newBoard', e); } }
    if (!b) b = { id: uid(), name: o.name || 'Neue Platine', w: o.w || 50, h: o.h || 40, layers: o.layers || 2, copperOz: o.copperOz || 1, rules: Object.assign({}, DEFRULES), grid: 0.25, nets: [], parts: [], tracks: [], vias: [], zones: [], texts: [] };
    if (o.name) b.name = o.name; if (o.w) b.w = o.w; if (o.h) b.h = o.h; if (o.layers) b.layers = o.layers; if (o.copperOz) b.copperOz = o.copperOz;
    return ensureShape(b);
  }
  const S = {
    tab: lsRaw('pcb.tab', 'edit'), sub: Object.assign({ fab: 'gerber', asm: 'asm' }, lsGet('pcb.sub', {})), board: null, id: null, task: null, readonly: false, dirty: false,
    drc: [], conn: null, connStale: true, drcStale: true, userEdit: false, minErr: 0, prevErr: null, prevShorts: 0, cnt: { t: 0, v: 0 }, cur: null
  };
  const TABS = [['edit', '🧩', 'Layout'], ['stack', '📚', 'Lagen'], ['fab', '🏭', 'Fertigung'], ['asm', '🔧', 'Bestückung'], ['repair', '🔍', 'Fehlersuche'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Lernen']];
  const TAB_VIEWS = { edit: ['edit'], stack: ['stack'], fab: ['gerber', 'fab', 'test'], asm: ['asm', 'solder'], repair: ['repair'] };
  const VIEW_IDS = ['edit', 'stack', 'gerber', 'fab', 'test', 'asm', 'solder', 'repair'];
  const VNAME = { edit: 'Layout-Editor', stack: 'Lagenaufbau', gerber: 'Gerber-Viewer', fab: 'Fertigung und Kosten', test: 'Prüfverfahren und Fertigungslinie', asm: 'Bestückung', solder: 'Löten', repair: 'Fehlersuche und Reparatur' };
  const SUBN = { gerber: '🗂 Gerber-Daten', fab: '⚙ Herstellung und Kosten', test: '🔬 Prüfen', asm: '📋 Bestückungsplan', solder: '🔥 Löten' };
  if (!TABS.some(t => t[0] === S.tab)) S.tab = 'edit';
  if (!TAB_VIEWS.fab.includes(S.sub.fab)) S.sub.fab = 'gerber'; if (!TAB_VIEWS.asm.includes(S.sub.asm)) S.sub.asm = 'asm';
  let hist = [], hi = -1, booted = false;

  const counts = () => ({ t: S.board.tracks.length, v: S.board.vias.length });
  const hasContent = b => !!b && ((b.parts || []).length > 0 || (b.tracks || []).length > 0 || (b.vias || []).length > 0 || (b.zones || []).length > 0);
  function replaceBoard(o) { Object.keys(S.board).forEach(k => delete S.board[k]); Object.assign(S.board, o); ensureShape(S.board); }

  /* ---- DRC (verzögert, Entprellung 250 ms) ---- */
  let drcT = 0;
  const errList = () => S.drc.filter(d => d.severity === 'error' && d.type !== 'unconnected');
  const warnList = () => S.drc.filter(d => d.severity !== 'error' && d.severity !== 'info');
  const shortCount = () => (S.conn && S.conn.shorts ? S.conn.shorts.length : 0);
  const unroutedCount = () => (S.conn && S.conn.unrouted ? S.conn.unrouted.length : 0);
  function scheduleDrc() { clearTimeout(drcT); S.drcStale = true; drcT = setTimeout(computeDrc, 250); }
  function computeDrc() {
    clearTimeout(drcT); const C = CORE(); let d = [], cn = null;
    if (C && S.board) {
      try { d = (C.drc ? C.drc(S.board) : []) || []; } catch (e) { console.error('DRC:', e); d = []; }
      try { cn = C.connectivity ? C.connectivity(S.board) : null; } catch (e) { console.error('Konnektivität:', e); }
    }
    S.drc = d; S.conn = cn; S.connStale = false; S.drcStale = false; afterDrc();
  }
  function afterDrc() {
    const errs = errList().length, sh = shortCount(), un = unroutedCount();
    if (S.prevErr != null && S.userEdit) {
      if (S.prevErr >= 5 && errs === 0) fx('ding', null, null, pickOf(DRCOK));
      if (sh > 0 && S.prevShorts === 0) fx('zap', null, null, 'Zwei Netze, eine Idee: Kurzschluss!');
      if (errs < S.minErr) { stat('pcbfix', S.minErr - errs); S.minErr = errs; }
      if (S.board.layers === 4 && errs === 0 && sh === 0 && un === 0 && (S.board.parts || []).length && (S.board.tracks || []).length) stat('pcblayers4', 1, 'max');
    }
    S.prevErr = errs; S.prevShorts = sh; if (errs < S.minErr || !S.userEdit) S.minErr = Math.min(S.minErr, errs);
    updateChrome(); refreshView('drc');
  }

  /* ---- Verlauf (Rückgängig/Wiederholen, mindestens 100 Schritte) ---- */
  const HMAX = 150;
  function pushHist() {
    const j = JSON.stringify(S.board);
    if (hist[hi] !== j) { hist = hist.slice(0, hi + 1); hist.push(j); if (hist.length > HMAX) hist.shift(); hi = hist.length - 1; }
  }
  function undo() { if (hi <= 0 || S.readonly) return; hi--; restoreHist(); }
  function redo() { if (hi >= hist.length - 1 || S.readonly) return; hi++; restoreHist(); }
  function restoreHist() {
    replaceBoard(JSON.parse(hist[hi])); S.dirty = true; S.cnt = counts(); S.userEdit = true;
    computeDrc(); refreshAllViews(); saveCur(); updateChrome();
  }
  let saveT = 0;
  const curObj = () => ({ id: S.id, board: S.board, task: S.task ? S.task.id : null, dirty: S.dirty });
  function saveCur() { clearTimeout(saveT); saveT = setTimeout(() => lsSet('pcb.cur', curObj()), 400); }

  /* ---- Änderungen, Laden ---- */
  function onChanged() {
    S.dirty = true; S.userEdit = true; S.connStale = true; pushHist();
    const c = counts();
    if (c.t > S.cnt.t) stat('pcbtracks', c.t - S.cnt.t);
    if (c.v > S.cnt.v) { stat('pcbvias', c.v - S.cnt.v); fx('click'); }
    S.cnt = c;
    scheduleDrc(); refreshView('changed'); saveCur(); updateChrome();
  }
  /* setBoard: ersetzt die Platine (z. B. Autorouter-Ergebnis) – zählt als Änderung, wenn keep=true */
  function setBoard(b, o) {
    o = o || {}; if (!b || typeof b !== 'object') return;
    ensureShape(b); if (o.name) b.name = o.name;
    if (S.board && b === S.board) { onChanged(); refreshAllViews(); return; }
    if (S.board) replaceBoard(b); else S.board = b;
    S.cnt = counts();
    if (o.load) {
      S.id = o.id || null; S.dirty = false; S.userEdit = false; hist = [JSON.stringify(S.board)]; hi = 0; S.prevErr = null; S.prevShorts = 0;
      computeDrc(); S.minErr = errList().length; S.prevErr = S.minErr; S.prevShorts = shortCount();
      refreshAllViews(true); saveCur(); updateChrome();
    } else { onChanged(); refreshAllViews(); }
  }
  const loadBoard = (b, name, id) => setBoard(b, { load: true, name, id });

  /* ============================================================ Platinen speichern, öffnen */
  const PK = 'pcb.boards';
  const saved = () => { const a = lsGet(PK, []); return Array.isArray(a) ? a : []; };
  function saveBoard(name) {
    const a = saved(), id = S.id || uid(); S.id = id; S.board.name = name || S.board.name;
    const e = { id, name: S.board.name, t: Date.now(), layers: S.board.layers, board: clone(S.board) };
    const i = a.findIndex(x => x.id === id); if (i >= 0) a[i] = e; else a.push(e);
    if (!lsSet(PK, a.slice(-100))) { toast('Speicher voll: Bitte alte Platinen löschen'); return false; }
    S.dirty = false; stat('pcbsaved', a.length, 'max'); updateChrome(); saveCur(); return true;
  }
  /* aktuelle Platine vor dem Ersetzen sichern, wenn etwas drinsteht und sie noch nicht gesichert ist */
  function stash() {
    if (!hasContent(S.board) || (S.task && !S.dirty)) return false;
    if (S.id && !S.dirty) return false; if (!S.dirty && !S.userEdit) return false;
    return saveBoard(S.board.name || 'Platine');
  }
  async function doSave() {
    const r = await ask('Platine speichern', [{ key: 'n', label: 'Name', type: 'text', value: S.board.name }]);
    if (!r) return; const n = r.n.trim() || 'Platine'; if (saveBoard(n)) toast('Gespeichert: ' + n);
  }
  function openList() {
    sheet('Gespeicherte Platinen', (b, close) => {
      const draw = () => {
        const items = saved().slice().sort((a, c) => c.t - a.t);
        if (!items.length) { b.innerHTML = '<p class="hint2">Noch nichts gespeichert. Speichern findest du im Menü („Speichern unter …“).</p>'; return; }
        b.innerHTML = items.map(i => `<div class="row"><button class="grow" data-o="${esc(i.id)}" style="text-align:left"><b>${esc(i.name)}</b><small>${i.layers || (i.board && i.board.layers) || '?'} Lagen · ${fmt((i.board || {}).w || 0, 1)} × ${fmt((i.board || {}).h || 0, 1)} mm · ${new Date(i.t).toLocaleDateString('de-DE')}</small></button><button class="chip danger s" data-d="${esc(i.id)}">Löschen</button></div>`).join('');
      };
      draw();
      b.addEventListener('click', async e => {
        const o = e.target.closest('[data-o]'), d = e.target.closest('[data-d]');
        if (o) { const it = saved().find(x => x.id === o.dataset.o); if (!it) return; close(); loadItem(it); }
        else if (d) { if (!await confirmSheet('Löschen?', 'Die gespeicherte Platine wird gelöscht.', 'Löschen', true)) return; lsSet(PK, saved().filter(x => x.id !== d.dataset.d)); draw(); }
      });
    });
  }
  function loadItem(it) { stash(); S.task = null; loadBoard(clone(it.board), it.name, it.id); setTab('edit'); toast('Geöffnet: ' + it.name); }

  /* ============================================================ Neue Platine */
  const LAYERINFO = {
    1: 'Einseitig: Leiterbahnen nur auf der Lötseite (unten), Bauteile stehen oben als THT. Billig und einfach, aber Leiterbahnen dürfen sich nicht kreuzen.',
    2: 'Zweilagig: Leiterbahnen oben und unten, verbunden über Durchkontaktierungen (Vias). Der Standard für einfache Schaltungen.',
    4: 'Vierlagig: Signal, Masse, Versorgung, Signal. Die Innenlagen sind Flächen für GND und VCC; das hilft bei Störungen und Rückströmen.',
    6: 'Sechslagig: Signal, Masse, Signal, Signal, Versorgung, Signal. Für dichte Schaltungen mit schnellen Signalen.'
  };
  function newBoardDialog() {
    sheet('Neue Platine', (b, close) => {
      let L = 2, Cu = 1;
      b.innerHTML = `<label class="f"><span>Name</span><input id="nbName" autocomplete="off" value="Neue Platine"></label>
        <div class="two"><label class="f"><span>Breite (mm)</span><input id="nbW" inputmode="decimal" value="50"></label><label class="f"><span>Höhe (mm)</span><input id="nbH" inputmode="decimal" value="40"></label></div>
        <div class="chips" style="display:flex;gap:6px;flex-wrap:wrap;margin:-4px 0 10px"><button class="chip s" data-sz="30,20">Klein 30 × 20</button><button class="chip s" data-sz="50,40">Mittel 50 × 40</button><button class="chip s" data-sz="80,60">Groß 80 × 60</button><button class="chip s" data-sz="100,80">100 × 80</button></div>
        <div class="f"><span>Lagenzahl</span><div class="seg" id="nbL">${[1, 2, 4, 6].map(n => `<button data-l="${n}" class="${n === L ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="f"><span>Kupferdicke außen</span><div class="seg" id="nbC">${[[0.5, '0,5 oz'], [1, '1 oz'], [2, '2 oz']].map(c => `<button data-c="${c[0]}" class="${c[0] === Cu ? 'on' : ''}">${c[1]}</button>`).join('')}</div></div>
        <p class="hint2" id="nbInfo">${LAYERINFO[L]}</p><div id="akErr" class="hint2" style="color:#ff8a7a;min-height:18px"></div>
        <div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn pri" data-ok>Anlegen</button></div>`;
      b.addEventListener('click', e => {
        const s = e.target.closest('[data-sz]'), l = e.target.closest('[data-l]'), c = e.target.closest('#nbC [data-c]');
        if (s) { const [w, h] = s.dataset.sz.split(','); $('#nbW', b).value = w; $('#nbH', b).value = h; }
        if (l) { L = +l.dataset.l; $$('#nbL button', b).forEach(x => x.classList.toggle('on', x === l)); $('#nbInfo', b).textContent = LAYERINFO[L]; }
        if (c) { Cu = +c.dataset.c; $$('#nbC button', b).forEach(x => x.classList.toggle('on', x === c)); }
      });
      $('[data-c]', b).onclick = close;
      $('[data-ok]', b).onclick = () => {
        const w = num($('#nbW', b).value), h = num($('#nbH', b).value), nm = $('#nbName', b).value.trim() || 'Neue Platine', er = $('#akErr', b);
        if (!(w >= 10 && w <= 400) || !(h >= 10 && h <= 400)) { er.textContent = 'Breite und Höhe müssen zwischen 10 und 400 mm liegen.'; return; }
        close(); const had = stash(); S.task = null; loadBoard(mkBoard({ name: nm, w, h, layers: L, copperOz: Cu }), nm); setTab('edit');
        toast(had ? 'Neue Platine. Deine bisherige ist unter „Öffnen“ gesichert' : 'Neue Platine: ' + L + ' Lagen, ' + fmt(w, 1) + ' × ' + fmt(h, 1) + ' mm');
      };
      b.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('[data-ok]', b).click(); } });
    });
  }

  /* ============================================================ Platinen-Eigenschaften */
  function layerListFor(n) {
    const C = CORE(), t = { layers: n };
    if (C && C.layerList) { try { return C.layerList(Object.assign(clone(S.board), t)); } catch (e) {} }
    return n === 1 ? ['B.Cu'] : n === 2 ? ['F.Cu', 'B.Cu'] : n === 4 ? ['F.Cu', 'In1.Cu', 'In2.Cu', 'B.Cu'] : ['F.Cu', 'In1.Cu', 'In2.Cu', 'In3.Cu', 'In4.Cu', 'B.Cu'];
  }
  async function changeLayers(n) {
    const b = S.board; if (n === b.layers) return true;
    const L = layerListFor(n), badT = b.tracks.filter(t => !L.includes(t.layer)), badZ = b.zones.filter(z => !L.includes(z.layer));
    if (badT.length || badZ.length) {
      if (!await confirmSheet('Lagenzahl ändern?', `Auf den wegfallenden Lagen liegen ${badT.length} Leiterbahnen und ${badZ.length} Kupferflächen. Sie werden entfernt (Rückgängig holt sie zurück).`, 'Ändern', true)) return false;
      b.tracks = b.tracks.filter(t => L.includes(t.layer)); b.zones = b.zones.filter(z => L.includes(z.layer));
    }
    b.vias.forEach(v => { if (!L.includes(v.from) || !L.includes(v.to)) { v.from = L[0]; v.to = L[L.length - 1]; } });
    b.layers = n; onChanged(); refreshAllViews(); return true;
  }
  function propsSheet() {
    const b0 = S.board, ro = !!(S.task && S.readonly);
    sheet('Platine', (b, close) => {
      const r = b0.rules; let L = b0.layers, Cu = b0.copperOz, G = b0.grid;
      const rf = (k, lab) => `<label class="f"><span>${lab} (mm)</span><input data-r="${k}" inputmode="decimal" value="${String(r[k]).replace('.', ',')}"></label>`;
      b.innerHTML = `<label class="f"><span>Name</span><input id="pName" value="${esc(b0.name)}"></label>
        <div class="two"><label class="f"><span>Breite (mm)</span><input id="pW" inputmode="decimal" value="${String(b0.w).replace('.', ',')}"></label><label class="f"><span>Höhe (mm)</span><input id="pH" inputmode="decimal" value="${String(b0.h).replace('.', ',')}"></label></div>
        <div class="f"><span>Lagenzahl</span><div class="seg" id="pL">${[1, 2, 4, 6].map(n => `<button data-l="${n}" class="${n === L ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="f"><span>Kupferdicke außen</span><div class="seg" id="pC">${[[0.5, '0,5 oz'], [1, '1 oz'], [2, '2 oz']].map(c => `<button data-c="${c[0]}" class="${c[0] === Cu ? 'on' : ''}">${c[1]}</button>`).join('')}</div></div>
        <div class="f"><span>Raster (mm)</span><div class="seg" id="pG">${[0.25, 0.5, 1.27, 2.54].map(g => `<button data-g="${g}" class="${g === G ? 'on' : ''}">${String(g).replace('.', ',')}</button>`).join('')}</div></div>
        <details><summary class="chip s" style="display:inline-flex;list-style:none">Entwurfsregeln</summary><div style="margin-top:8px" class="two">${rf('minWidth', 'Mindest-Leiterbahnbreite')}${rf('clearance', 'Mindestabstand')}${rf('minDrill', 'Mindestbohrung')}${rf('annular', 'Mindest-Restring')}${rf('edge', 'Abstand zum Rand')}${rf('viaDia', 'Via-Durchmesser')}${rf('viaDrill', 'Via-Bohrung')}</div></details>
        <div id="akErr" class="hint2" style="color:#ff8a7a;min-height:18px"></div><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn pri" data-ok${ro ? ' disabled' : ''}>Übernehmen</button></div>`;
      b.addEventListener('click', e => {
        const l = e.target.closest('#pL [data-l]'), c = e.target.closest('#pC [data-c]'), g = e.target.closest('#pG [data-g]');
        if (l) { L = +l.dataset.l; $$('#pL button', b).forEach(x => x.classList.toggle('on', x === l)); }
        if (c) { Cu = +c.dataset.c; $$('#pC button', b).forEach(x => x.classList.toggle('on', x === c)); }
        if (g) { G = +g.dataset.g; $$('#pG button', b).forEach(x => x.classList.toggle('on', x === g)); }
      });
      $('[data-c]', b).onclick = close;
      $('[data-ok]', b).onclick = async () => {
        const er = $('#akErr', b), w = num($('#pW', b).value), h = num($('#pH', b).value), rules = {};
        if (!(w >= 10 && w <= 400) || !(h >= 10 && h <= 400)) { er.textContent = 'Breite und Höhe müssen zwischen 10 und 400 mm liegen.'; return; }
        for (const i of $$('input[data-r]', b)) { const v = num(i.value); if (!(v > 0 && v < 20)) { er.textContent = 'Entwurfsregeln: bitte Zahlen größer 0 eingeben.'; return; } rules[i.dataset.r] = v; }
        close();
        const bd = S.board; bd.name = $('#pName', b).value.trim() || bd.name; bd.w = w; bd.h = h; bd.copperOz = Cu; bd.grid = G; Object.assign(bd.rules, rules);
        if (L !== bd.layers) { if (!await changeLayers(L)) return; } else onChanged();
        refreshAllViews();
      };
    });
  }

  /* ============================================================ Netzliste und Netzklassen */
  function ipcWidthFor(I, ext) {
    const C = CORE(), oz = S.board.copperOz || 1;
    if (C && C.ipcWidth) { try { return C.ipcWidth(I, { oz, rise: 10, external: ext }); } catch (e) {} }
    const k = ext ? 0.048 : 0.024, A = Math.pow(I / (k * Math.pow(10, 0.44)), 1 / 0.725); return A / (1.378 * oz) * 0.0254;   // mil² -> mm
  }
  function netSheet() {
    sheet('Netzliste', (b, close) => {
      const draw = () => {
        const nets = S.board.nets, cn = ctx.connectivity();
        const info = {}; if (cn && cn.nets) cn.nets.forEach(n => { info[n.name] = n; });
        const open = {}; if (cn && cn.unrouted) cn.unrouted.forEach(u => { open[u.net] = (open[u.net] || 0) + 1; });
        if (!nets.length) { b.innerHTML = '<p class="hint2">Diese Platine hat noch keine Netzliste. Die Netze kommen aus dem Schaltplan; in Aufgaben und Beispielen sind sie vorgegeben.</p>'; return; }
        b.innerHTML = '<p class="hint2" style="margin-top:0">Tippe ein Netz an, um Netzklasse, Strom und Leiterbahnbreite einzustellen. Der Strom wird für die IPC-Prüfung der Leiterbahnbreite benutzt.</p>' + nets.map((n, i) => {
          const o = open[n.name] || 0, cl = n.cls === 'power' ? 'Versorgung' : 'Signal';
          const need = n.current > 0 ? ' · nötig außen ' + fmt(ipcWidthFor(n.current, true)) + ' mm, innen ' + fmt(ipcWidthFor(n.current, false)) + ' mm' : '';
          return `<button class="row" data-i="${i}"><div class="grow"><b>${esc(n.name)}</b> <span class="badge">${cl}</span> ${o ? `<span class="badge w">${o} offen</span>` : (n.pins || []).length > 1 ? '<span class="badge g">verbunden</span>' : ''}<small>${(n.pins || []).length} Pins${n.current > 0 ? ' · ' + fmt(n.current) + ' A' : ''}${n.width ? ' · Breite ' + fmt(n.width) + ' mm' : ''}${need}</small></div></button>`;
        }).join('');
      };
      draw();
      b.addEventListener('click', async e => {
        const r = e.target.closest('.row[data-i]'); if (!r) return; const n = S.board.nets[+r.dataset.i]; if (!n) return;
        if (S.readonly) { toast('Gerade wird geprüft'); return; }
        const v = await ask('Netz ' + n.name, [
          { key: 'cls', label: 'Netzklasse', type: 'select', value: n.cls === 'power' ? 'power' : 'signal', options: [{ value: 'signal', label: 'Signal' }, { value: 'power', label: 'Versorgung (Power)' }] },
          { key: 'cur', label: 'Strom in diesem Netz', type: 'number', unit: 'A', optional: true, value: n.current > 0 ? n.current : '', min: 0, max: 50 },
          { key: 'w', label: 'Leiterbahnbreite (leer = Standard der Klasse)', type: 'number', unit: 'mm', optional: true, value: n.width || '', min: 0.05, max: 10 }
        ], { intro: 'Mit dem Strom prüft der DRC, ob die Leiterbahn dick genug ist (IPC-2221, 10 K Erwärmung).' });
        if (!v) return;
        n.cls = v.cls; if (v.cur > 0) n.current = v.cur; else delete n.current; if (v.w > 0) n.width = v.w; else delete n.width;
        onChanged(); refreshAllViews(); draw();
      });
    });
  }

  /* ============================================================ DRC-Liste */
  function drcSheet() {
    if (S.drcStale) computeDrc();
    const all = S.drc;
    sheet('Entwurfsprüfung (DRC)', (b, close) => {
      if (!all.length) { b.innerHTML = '<p>Keine Fehler und keine Hinweise. Die Platine besteht den DRC.</p>'; return; }
      const ord = { error: 0, warn: 1, info: 2 }, a = all.slice().sort((x, y) => (ord[x.severity] || 0) - (ord[y.severity] || 0));
      b.innerHTML = '<p class="hint2" style="margin-top:0">Tippe einen Eintrag an, dann springt der Editor zur Stelle.</p>' + a.slice(0, 200).map((d, i) => `<button class="row" data-i="${i}"><div class="grow"><span class="badge ${d.severity === 'error' ? 'e' : d.severity === 'warn' ? 'w' : ''}">${d.severity === 'error' ? 'Fehler' : d.severity === 'warn' ? 'Hinweis' : 'Info'}</span> <b>${esc(d.msg)}</b>${d.at ? `<small>bei x ${fmt(d.at.x, 1)}, y ${fmt(d.at.y, 1)} mm${d.layer ? ' · ' + esc(d.layer) : ''}</small>` : ''}</div></button>`).join('') + (a.length > 200 ? `<p class="hint2">… und ${a.length - 200} weitere.</p>` : '');
      b.addEventListener('click', e => { const r = e.target.closest('.row[data-i]'); if (!r) return; close(); jumpTo(a[+r.dataset.i]); });
    });
  }
  function jumpTo(item) {
    setTab('edit'); const V = VIEWS.edit, api = V && V.api; if (!api || !item) return;
    const f = api.gotoDrc || api.goto || api.jumpTo || api.focusAt || api.focus;
    if (typeof f === 'function') { try { f.call(api, item.at ? Object.assign({}, item, item.at) : item, item); } catch (e) { console.error(e); } }
    else if (item.at) toast('Stelle: x ' + fmt(item.at.x, 1) + ', y ' + fmt(item.at.y, 1) + ' mm');
  }

  /* ============================================================ Beispiele */
  function fallbackExamples() {
    const C = () => CORE();
    const route = (b, layers) => { const c = C(); if (!c || !c.autoroute) return b; try { const r = c.autoroute(b, { layers }); if (r && r.board) { b.tracks = r.board.tracks || []; b.vias = r.board.vias || []; } } catch (e) { console.error('autoroute', e); } return b; };
    let pid = 0; const P = (ref, fp, value, x, y, rot) => ({ id: 'p' + (++pid), ref, fp, value, x, y, rot: rot || 0, side: 'top' });
    return [
      { id: 'ui-led', name: 'LED mit Vorwiderstand (einseitig)', cat: 'Grundlagen', desc: 'Die einfachste Platine: Stecker, Widerstand, LED. Leiterbahnen nur auf der Lötseite.', board: () => {
        pid = 0; const b = mkBoard({ name: 'LED mit Vorwiderstand', w: 40, h: 25, layers: 1 });
        b.parts = [P('J1', 'HDR_1x2', '', 6, 12.5, 90), P('R1', 'R_AXIAL_10', '330R', 20, 12.5), P('D1', 'LED_5MM', 'rot', 33, 12.5)];
        b.nets = [{ name: 'VCC', cls: 'power', pins: ['J1.1', 'R1.1'] }, { name: 'N1', cls: 'signal', pins: ['R1.2', 'D1.1'] }, { name: 'GND', cls: 'power', pins: ['D1.2', 'J1.2'] }];
        return route(b, ['B.Cu']);
      } },
      { id: 'ui-abblock', name: 'Abblockkondensator am IC (SMD, 2 Lagen)', cat: 'Grundlagen', desc: 'Ein IC im SOIC-8 mit Kondensator dicht am Versorgungspin. Die Verbindungen sind noch offen: verlege sie selbst.', board: () => {
        pid = 0; const b = mkBoard({ name: 'Abblockkondensator', w: 30, h: 22, layers: 2 });
        b.parts = [P('U1', 'SOIC-8', 'NE555', 15, 11, 0), P('C1', 'C0603', '100n', 8, 6, 0), P('J1', 'HDR_1x2', '', 4, 16, 0)];
        b.nets = [{ name: 'VCC', cls: 'power', pins: ['J1.1', 'U1.8', 'C1.1'] }, { name: 'GND', cls: 'power', pins: ['J1.2', 'U1.1', 'C1.2'] }];
        return b;
      } }
    ];
  }
  function exampleList() {
    const d = root.PCB_DATA; let a = d && d.examples;
    if (a && !Array.isArray(a)) a = Object.keys(a).map(k => Object.assign({ id: k }, a[k]));
    if (!a || !a.length) a = fallbackExamples();
    return a.map(e => ({ id: e.id, name: e.name, cat: e.cat || 'Beispiele', desc: e.desc || e.text || '', get: () => { try { const b = typeof e.board === 'function' ? e.board() : e.board; return b ? clone(b) : null; } catch (x) { console.error('Beispiel', e.id, x); return null; } } }));
  }
  function openExamples() {
    const ex = exampleList();
    sheet('Beispiel-Platinen', (b, close) => {
      let last = '', h = '<p class="hint2" style="margin-top:0">Tippe ein Beispiel an, es wird geladen. Deine bisherige Platine wird vorher gesichert.</p>';
      ex.forEach((e, i) => { if (e.cat !== last) { last = e.cat; h += `<div class="gh">${esc(e.cat)}</div>`; } h += `<button class="row" data-i="${i}"><span style="font-size:22px">🟩</span><div class="grow"><b>${esc(e.name)}</b><small>${esc(e.desc)}</small></div></button>`; });
      b.innerHTML = h;
      b.addEventListener('click', ev => { const r = ev.target.closest('.row'); if (!r) return; close(); loadExample(ex[+r.dataset.i]); });
    });
  }
  function loadExample(e) {
    if (!e) return false; const bd = e.get(); if (!bd) { toast('Dieses Beispiel konnte nicht geladen werden'); return false; }
    const had = stash(); S.task = null; loadBoard(bd, e.name); setTab('edit'); toast(had ? 'Beispiel geladen, deine Platine ist gesichert' : 'Beispiel geladen: ' + e.name);
    return true;
  }
  function findExample(keys) {
    const list = exampleList();
    for (const k of String(keys || '').toLowerCase().split('|')) { if (!k) continue; const e = list.find(x => x.id.toLowerCase() === k || x.name.toLowerCase().includes(k)); if (e) return e; }
    return null;
  }
  function loadExampleByName(n) {
    const e = findExample(n); if (e) return loadExample(e);
    return false;
  }

  /* ============================================================ Teilen (komprimierter Link wie in den anderen Labs, #z=) */
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
    if (!hasContent(S.board)) { toast('Noch nichts auf der Platine'); return; }
    let url; try { url = location.href.split('#')[0].split('?')[0] + '#' + await packShare({ k: 'pcb', name: S.board.name, board: S.board }); } catch (e) { toast('Teilen nicht möglich'); return; }
    if (navigator.share) { try { await navigator.share({ title: 'Tonfunk Leiterplatten-Lab: ' + S.board.name, text: 'Schau dir meine Platine „' + S.board.name + '“ an:', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    sheet('Teilen', b => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">Diesen Link weitergeben (zum Beispiel per WhatsApp oder E-Mail). Wer ihn öffnet, bekommt eine Kopie deiner Platine.</p><textarea id="shTx" rows="5" readonly></textarea><div class="btns"><button class="btn pri" id="shCp">Link kopieren</button></div>';
      const ta = $('#shTx', b); ta.value = url; ta.addEventListener('focus', () => ta.select());
      $('#shCp', b).onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Link kopiert'); } catch (e) { ta.select(); toast('Bitte Text markieren und kopieren'); } };
    });
  }
  async function loadShared(h) {
    let d = null; try { d = await unpackShare(h); } catch (e) {}
    if (!d || !d.board || !Array.isArray(d.board.parts)) { toast('Der Link oder Code ist ungültig'); return false; }
    stash(); S.task = null; loadBoard(d.board, (d.name || d.board.name || 'Platine') + ' (geteilt)'); setTab('edit'); toast('Geteilte Platine geladen'); return true;
  }
  function importSheet() {
    sheet('Aus Code oder Link laden', (b, close) => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">Füge einen Teilen-Link oder Code ein.</p><textarea id="tx" rows="6"></textarea><div class="btns"><button class="btn pri" id="ld">Laden</button></div>';
      $('#ld', b).onclick = async () => { const t = $('#tx', b).value.trim(), h = t.includes('#') ? t.slice(t.indexOf('#')) : t; if (await loadShared(h.startsWith('#') ? h : '#' + h)) close(); };
    });
  }

  /* ============================================================ Export: Gerber-ZIP, Stückliste, Pick&Place, PNG */
  const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = crcT[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  /* ZIP ohne Kompression (Store), selbst geschrieben */
  function makeZip(files) {
    const enc = new TextEncoder(), parts = [], cd = []; let off = 0; const d = new Date();
    const dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF, dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    Object.keys(files).forEach(name => {
      const nm = enc.encode(name), data = typeof files[name] === 'string' ? enc.encode(files[name]) : files[name], crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), nm, data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      cd.push(new Uint8Array(ch.buffer), nm); off += 30 + nm.length + data.length;
    });
    const cdSize = cd.reduce((s, x) => s + x.length, 0), n = Object.keys(files).length, end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, n, true); end.setUint16(10, n, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(cd, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }
  const fileBase = () => 'Tonfunk-' + (String(S.board.name || 'Platine').replace(/[^\wäöüÄÖÜß\- ]+/g, '').trim().replace(/\s+/g, '-') || 'Platine');
  const csvCell = v => { v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const csv = rows => '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
  function save(blob, name) {
    if (root.LabExport && root.LabExport.saveBlob) { root.LabExport.saveBlob(blob, name); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  const needCore = f => { const C = CORE(); if (!C || !C[f]) { toast('Der Kern ist noch nicht geladen'); return null; } return C; };
  function gerberFiles() {
    const C = needCore('gerber'); if (!C) return null;
    try { return C.gerber(S.board, { name: fileBase().replace(/^Tonfunk-/, '') }).files; } catch (e) { console.error(e); toast('Gerber-Daten konnten nicht erzeugt werden: ' + (e.message || e)); return null; }
  }
  function exportGerberZip() {
    const f = gerberFiles(); if (!f) return; save(makeZip(f), fileBase() + '-Gerber.zip'); stat('pcbgerber', 1, 'max'); fx('ding', null, null, 'Gerber-Paket gepackt!');
    toast(Object.keys(f).length + ' Dateien im ZIP');
  }
  function exportBom() {
    const C = needCore('bom'); if (!C) return; let rows;
    try { rows = C.bom(S.board); } catch (e) { toast('Stückliste nicht möglich'); return; }
    save(new Blob([csv([['Anzahl', 'Wert', 'Gehäuse', 'Referenzen']].concat(rows.map(r => [r.qty, r.value, r.fp, (r.refs || []).join(' ')])))], { type: 'text/csv;charset=utf-8' }), fileBase() + '-Stückliste.csv');
  }
  function exportPnp() {
    const C = needCore('pickplace'); if (!C) return; let txt;
    try { txt = C.pickplaceCsv ? C.pickplaceCsv(S.board) : csv([['Ref', 'X', 'Y', 'Drehung', 'Seite', 'Gehäuse', 'Wert']].concat(C.pickplace(S.board).map(r => [r.ref, r.x, r.y, r.rot, r.side, r.fp, r.value]))); } catch (e) { toast('Pick&Place nicht möglich'); return; }
    save(new Blob([txt], { type: 'text/csv;charset=utf-8' }), fileBase() + '-PickAndPlace.csv');
  }
  /* Bild der Editor-Ansicht: größte Zeichenfläche im Editor-Container */
  async function editorCanvas() {
    if (!VIEWS.edit || !VIEWS.edit.mounted) { setTab('edit'); await new Promise(r => setTimeout(r, 350)); }
    const V = VIEWS.edit; if (V && V.api && typeof V.api.canvas === 'function') { try { const c = V.api.canvas(); if (c) return c; } catch (e) {} }
    let best = null; $$('canvas', $('#vh-edit')).forEach(c => { if (!best || c.width * c.height > best.width * best.height) best = c; });
    return best && best.width > 10 ? best : null;
  }
  async function exportPng() {
    const c = await editorCanvas(); if (!c) { toast('Die Editor-Ansicht ist noch nicht verfügbar'); return; }
    c.toBlob(b => { if (b) { save(b, fileBase() + '.png'); stat('png'); } else toast('Bild konnte nicht erzeugt werden'); }, 'image/png');
  }
  function exportSheet() {
    sheet('Exportieren', (b, close) => {
      const rows = [['gzip', 'Gerber-Dateien als ZIP', 'Alle Lagen, Bohrdaten und Umriss: das Paket für den Platinenhersteller'], ['gfiles', 'Gerber-Dateien einzeln', 'Jede Datei für sich speichern'], ['bom', 'Stückliste (CSV)', 'Bauteile mit Wert, Gehäuse und Referenzen'], ['pnp', 'Pick&Place (CSV)', 'Bestückungsdaten: Position und Drehung je Bauteil'], ['png', 'Bild der Editor-Ansicht (PNG)', 'So, wie die Platine im Editor aussieht']];
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${r[1]}</b><small>${r[2]}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); ({ gzip: exportGerberZip, gfiles: gerberSheet, bom: exportBom, pnp: exportPnp, png: exportPng })[r.dataset.m](); });
    });
  }
  function gerberSheet() {
    const f = gerberFiles(); if (!f) return; const names = Object.keys(f);
    sheet('Gerber-Dateien', (b, close) => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">Tippe eine Datei an, um sie zu speichern.</p>' + names.map((n, i) => `<button class="row" data-i="${i}"><div class="grow"><b>${esc(n)}</b><small>${fmt(f[n].length / 1024, 1)} KB</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; const n = names[+r.dataset.i]; save(new Blob([f[n]], { type: 'text/plain;charset=utf-8' }), n); stat('pcbgerber', 1, 'max'); });
    });
  }

  /* ============================================================ Drucken */
  async function printNow() {
    const C = CORE(), b = S.board, who = lsRaw('lm4.name', ''); let img = '';
    try { const c = await editorCanvas(); if (c) img = c.toDataURL('image/png'); } catch (e) {}
    let bom = []; try { bom = C && C.bom ? C.bom(b) : []; } catch (e) {}
    const errs = errList(), un = unroutedCount();
    $('#printArea').innerHTML = `<div class="proto"><h1>${esc(b.name)}</h1><p>${b.layers} ${b.layers === 1 ? 'Lage' : 'Lagen'} · ${fmt(b.w, 1)} × ${fmt(b.h, 1)} mm · Kupfer ${fmt(b.copperOz)} oz · ${new Date().toLocaleDateString('de-DE')}${who ? ' · ' + esc(who) : ''}</p>
      ${img ? `<h2>Layout</h2><img src="${img}" alt="">` : ''}
      <h2>Prüfung</h2><p>DRC: ${errs.length ? errs.length + ' Fehler' : 'keine Fehler'}${warnList().length ? ', ' + warnList().length + ' Hinweise' : ''} · Offene Verbindungen: ${un}</p>${errs.length ? '<ul>' + errs.slice(0, 20).map(d => '<li>' + esc(d.msg) + '</li>').join('') + '</ul>' : ''}
      <h2>Netze</h2><table><tr><th>Netz</th><th>Klasse</th><th>Pins</th><th>Strom</th></tr>${b.nets.map(n => `<tr><td>${esc(n.name)}</td><td>${n.cls === 'power' ? 'Versorgung' : 'Signal'}</td><td>${(n.pins || []).map(esc).join(', ')}</td><td>${n.current > 0 ? fmt(n.current) + ' A' : ''}</td></tr>`).join('')}</table>
      <h2>Stückliste</h2><table><tr><th>Anzahl</th><th>Wert</th><th>Gehäuse</th><th>Referenzen</th></tr>${bom.map(r => `<tr><td>${r.qty}</td><td>${esc(r.value)}</td><td>${esc(r.fp)}</td><td>${esc((r.refs || []).join(' '))}</td></tr>`).join('')}</table></div>`;
    setTimeout(() => window.print(), 120);
  }

  /* ============================================================ Ansichten: Registry, Einbindung, ctx */
  const VIEWS = {};   // id -> { host, mounted, api, stale, failed }
  const viewDef = id => root.PCB_VIEWS && root.PCB_VIEWS.views && root.PCB_VIEWS.views[id];
  const ctx = {
    getBoard: () => S.board, changed: () => onChanged(), setBoard: b => setBoard(b),
    drc: () => { if (S.drcStale && !S.drc.length && S.board) computeDrc(); return S.drc; },
    connectivity: () => { if ((!S.conn || S.connStale) && CORE() && CORE().connectivity && S.board) { try { S.conn = CORE().connectivity(S.board); S.connStale = false; } catch (e) { console.error(e); } } return S.conn || { nets: [], unrouted: [], shorts: [], floating: [] }; },
    task: () => { const t = curTask(); return t ? Object.assign({}, t, { readonly: S.readonly }) : null; },
    toast, pick, ask, confirm: msg => confirmSheet('Bitte bestätigen', esc(msg), 'OK'),
    fx, mode: () => (S.readonly ? 'view' : 'edit'),
    /* Zusätze */
    undo, redo, canUndo: () => hi > 0, canRedo: () => hi < hist.length - 1, drcNow: () => { computeDrc(); return S.drc; },
    stat, jump: jumpTo, openDrc: drcSheet, openNets: netSheet, openProps: propsSheet, save: doSave, exportSheet, go: t => setTab(t), version: '1.0'
  };
  function hostFor(id) { return $('#vh-' + id); }
  function placeholder(host, id, title, text, btn) {
    host.innerHTML = `<div class="ph"><b>${esc(title)}</b>${esc(text)}<br><button class="btn" data-retry>${esc(btn || 'Erneut prüfen')}</button></div>`;
    $('[data-retry]', host).onclick = () => { VIEWS[id].mounted = false; showView(id); };
  }
  function mountView(id) {
    const V = VIEWS[id], host = V.host, def = viewDef(id);
    if (V.api && V.api.destroy) { try { V.api.destroy(); } catch (e) { console.error(e); } }
    V.api = null; V.mounted = false; host.innerHTML = '';
    if (!def || typeof def.mount !== 'function') { placeholder(host, id, 'Ansicht noch nicht geladen', (VNAME[id] || id) + ' ist noch nicht verfügbar.'); return; }
    const el = document.createElement('div'); el.className = 'vmount'; host.appendChild(el);
    try { V.api = def.mount(el, ctx) || {}; V.mounted = true; V.stale = false; if (V.api.refresh) V.api.refresh(); }
    catch (e) { console.error('Ansicht ' + id + ':', e); V.api = null; placeholder(host, id, 'Die Ansicht konnte nicht gestartet werden', String(e && e.message || e), 'Erneut versuchen'); }
  }
  function showView(id) {
    VIEW_IDS.forEach(v => { const V = VIEWS[v]; if (!V) return; const on = v === id; if (V.host.classList.contains('on') && !on && V.api && V.api.onHide) { try { V.api.onHide(); } catch (e) {} } V.host.classList.toggle('on', on); });
    S.cur = id; const V = VIEWS[id]; if (!V) return;
    if (!V.mounted) mountView(id); else if (V.stale && V.api && V.api.refresh) { V.stale = false; safeRefresh(V, id); }
    if (V.mounted && V.api && V.api.onShow) { try { V.api.onShow(); } catch (e) { console.error('Ansicht ' + id + ' onShow:', e); } }
  }
  const errOnce = {};
  function safeRefresh(V, id, why) { try { V.api.refresh(why); } catch (e) { if (!errOnce[id]) { errOnce[id] = 1; console.error('Ansicht ' + id + ' refresh:', e); } } }
  /* aktuelle Ansicht sofort auffrischen, die anderen beim nächsten Zeigen */
  function refreshView(why) {
    VIEW_IDS.forEach(id => { const V = VIEWS[id]; if (!V || !V.mounted || !V.api || !V.api.refresh) return; if (id === S.cur && ['edit', 'stack', 'fab', 'asm', 'repair'].includes(S.tab) && V.host.classList.contains('on')) safeRefresh(V, id, why); else V.stale = true; });
  }
  function refreshAllViews(boardReplaced) {
    VIEW_IDS.forEach(id => {
      const V = VIEWS[id]; if (!V || !V.mounted || !V.api) return;
      if (boardReplaced && V.api.onBoard) { try { V.api.onBoard(); } catch (e) { console.error(e); } }
      if (id === S.cur && V.host.classList.contains('on') && V.api.refresh) safeRefresh(V, id, 'board'); else V.stale = true;
    });
  }
  function buildHosts() {
    const h = $('#viewHost'); h.innerHTML = '';
    VIEW_IDS.forEach(id => { const d = document.createElement('div'); d.className = 'vh'; d.id = 'vh-' + id; d.dataset.v = id; h.appendChild(d); VIEWS[id] = { host: d, mounted: false, api: null, stale: false }; });
  }
  if (root.ResizeObserver) { let rt = 0; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { const V = VIEWS[S.cur]; if (V && V.api && V.api.onResize) { try { V.api.onResize(); } catch (e) {} } }, 60); }).observe($('#viewHost')); }

  /* ============================================================ Tabs, Kopf, Leiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd" style="display:none"></span>' : ''}</button>`).join('');
    updateTaskBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'edit'; S.tab = t; lsPut('pcb.tab', t);
    $('#mid').dataset.tab = t; $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    const vs = TAB_VIEWS[t];
    if (vs) {
      const id = vs.length > 1 ? S.sub[t] : vs[0];
      buildSubBar(t); showView(id);
      if (id === 'gerber' && booted) stat('pcbgerber', 1, 'max');
    } else { VIEW_IDS.forEach(v => { if (VIEWS[v]) VIEWS[v].host.classList.remove('on'); }); S.cur = null; $('#subBar').className = ''; }
    if (t === 'tasks') renderTasks(); else if (t === 'help') renderHelp();
    updateChrome();
  }
  function buildSubBar(t) {
    const bar = $('#subBar'), vs = TAB_VIEWS[t];
    if (!vs || vs.length < 2) { bar.className = ''; bar.innerHTML = ''; return; }
    bar.className = 'on'; bar.innerHTML = '<span class="seg">' + vs.map(v => `<button data-sub="${v}" class="${S.sub[t] === v ? 'on' : ''}">${SUBN[v]}</button>`).join('') + '</span>';
  }
  $('#subBar').addEventListener('click', e => { const b = e.target.closest('[data-sub]'); if (!b) return; const t = S.tab; S.sub[t] = b.dataset.sub; lsSet('pcb.sub', S.sub); buildSubBar(t); showView(b.dataset.sub); if (b.dataset.sub === 'gerber') stat('pcbgerber', 1, 'max'); });
  function updateTitle() {
    const b = S.board; if (!b) return;
    $('#title').innerHTML = esc(b.name) + (S.dirty ? ' •' : '') + '\n<small>' + esc(LAYERN[b.layers] || '') + ' · ' + fmt(b.w, 1) + ' × ' + fmt(b.h, 1) + ' mm</small>';
    document.title = 'Leiterplatten-Lab: ' + b.name;
  }
  $('#title').onclick = async () => { const r = await ask('Name der Platine', [{ key: 'n', label: 'Name', type: 'text', value: S.board.name }]); if (r && r.n.trim()) { S.board.name = r.n.trim(); S.dirty = true; updateChrome(); saveCur(); } };
  let palSig = '';
  function buildPal() {
    const b = S.board; if (!b) return;
    const errs = errList().length, warns = warnList().length, un = unroutedCount(), sh = shortCount(), nn = b.nets.length, on = fxOn();
    const sig = [b.layers, b.w, b.h, errs, warns, un, sh, nn, on, !!S.conn, S.drcStale].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `<button class="chip s" data-a="props" aria-label="Platinen-Eigenschaften">▦ ${b.layers} ${b.layers === 1 ? 'Lage' : 'Lagen'} · ${fmt(b.w, 1)} × ${fmt(b.h, 1)} mm</button>
      <button class="chip ${errs ? 'bad' : 'okc'}" data-a="drc" aria-label="Entwurfsprüfung">${errs ? '⚠ ' + errs + (errs === 1 ? ' DRC-Fehler' : ' DRC-Fehler') : '✓ DRC sauber'}${warns ? ' · ' + warns + (warns === 1 ? ' Hinweis' : ' Hinweise') : ''}</button>
      ${sh ? `<button class="chip bad" data-a="drc">⚡ ${sh} ${sh === 1 ? 'Kurzschluss' : 'Kurzschlüsse'}</button>` : ''}
      <button class="chip ${nn && un ? 'warnc' : nn ? 'okc' : ''}" data-a="nets" aria-label="Netzliste">${!nn ? '🔗 keine Netze' : (un ? '↔ ' + un + ' offen' : '✓ alles verbunden') + ' · ' + nn + (nn === 1 ? ' Netz' : ' Netze')}</button><span class="sep"></span>
      <button class="chip" data-a="exp">⬇ Export</button>${root.LochFX ? `<button class="chip ${on ? 'on' : ''}" data-a="fx" aria-pressed="${on}" aria-label="Effekte und Ton">${on ? '🎉' : '🔇'} Effekte</button>` : ''}`;
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
    if (a === 'props') propsSheet(); else if (a === 'drc') drcSheet(); else if (a === 'nets') netSheet(); else if (a === 'exp') exportSheet(); else if (a === 'fx') toggleFx();
  });
  function updateChrome() {
    updateTitle(); buildPal(); updateTaskBar();
    const u = $('#bUndo'), r = $('#bRedo'); u.disabled = hi <= 0 || S.readonly; r.disabled = hi >= hist.length - 1 || S.readonly;
  }
  $('#bUndo').onclick = undo; $('#bRedo').onclick = redo; $('#bNew').onclick = newBoardDialog;
  $('#bEx').onclick = openExamples; $('#bOpen').onclick = openList; $('#bTasks').onclick = () => setTab('tasks'); $('#bShare').onclick = shareNow; $('#bPrint').onclick = printNow; $('#bExp').onclick = exportSheet;

  /* ============================================================ Aufgaben */
  const TK = () => (root.PCB_TASKS && Array.isArray(root.PCB_TASKS.tasks) && root.PCB_TASKS.tasks.length ? root.PCB_TASKS.tasks : null);
  const taskDone = () => lsGet('sim.done', {});
  function markDone(id, pct) {
    try { const d = taskDone(); if ((d[id] || 0) < pct) d[id] = pct; localStorage.setItem('sim.done', JSON.stringify(d)); } catch (e) {}
    if (root.Badges) try { root.Badges.result(id, pct); } catch (e) {}
  }
  let taskRes = null;
  const curTask = () => { const a = TK(); return a && S.task ? a.find(t => t.id === S.task.id) || null : null; };
  function updateTaskBadge() {
    const a = TK(), b = $('#tkBd'); if (!b) return;
    if (!a) { b.style.display = 'none'; return; }
    const d = taskDone(), n = a.filter(t => (d[t.id] || 0) >= 100).length; b.style.display = ''; b.textContent = n + '/' + a.length;
  }
  function updateTaskBar() {
    const t = curTask(), el = $('#taskBar'); if (!el) return;
    if (!t) { el.className = ''; el.innerHTML = ''; el.dataset.s = ''; return; }
    el.className = 'on'; const sig = t.id + S.readonly; if (el.dataset.s === sig) return; el.dataset.s = sig;
    el.innerHTML = `<span>📝</span><b>${esc(t.title)}</b><button class="chip s" data-ta="info">Aufgabe</button><button class="chip s" data-ta="hint">💡 Tipp</button><button class="chip s on" data-ta="check"${S.readonly ? ' disabled' : ''}>✓ Prüfen</button>`;
  }
  $('#taskBar').addEventListener('click', e => { const b = e.target.closest('[data-ta]'); if (!b) return; if (b.dataset.ta === 'info') setTab('tasks'); else if (b.dataset.ta === 'hint') hintTask(); else checkTask(); });
  async function startTask(id) {
    const t = (TK() || []).find(x => x.id === id); if (!t) return;
    const had = stash(); S.task = { id }; taskRes = null;
    if (root.Auswertung) root.Auswertung.hintReset(id);
    let p; try { p = clone(t.start()); } catch (e) { console.error(e); toast('Die Startvorlage der Aufgabe fehlt'); S.task = null; return; }
    loadBoard(p, t.title); S.dirty = false; S.id = null; setTab('edit'); updateChrome();
    toast(had ? 'Aufgabe gestartet, deine Platine ist gesichert' : 'Aufgabe gestartet'); if (S.tab === 'tasks') renderTasks();
  }
  async function checkTask() {
    const t = curTask(); if (!t) return; const R = root.PCB_TASKS;
    if (S.drcStale) computeDrc();
    S.readonly = true; refreshView('mode'); updateChrome(); updateTaskBar();
    let lines;
    try { lines = await (R.run ? R.run(t, clone(S.board)) : t.check(clone(S.board))); } catch (e) { console.error(e); lines = [{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden: ' + (e && e.message || e), why: '' }]; }
    S.readonly = false; refreshView('mode');
    lines = Array.isArray(lines) ? lines : [];
    const pct = Math.round(100 * lines.filter(l => l.ok).length / Math.max(lines.length, 1));
    taskRes = { id: t.id, lines, pct }; markDone(t.id, pct); updateTaskBadge();
    if (pct === 100) fx('pass');
    updateChrome(); updateTaskBar(); if (S.tab !== 'tasks') setTab('tasks'); else renderTasks();
    toast(pct === 100 ? '🎉 Geschafft!' : pct + ' % richtig');
  }
  function hintTask() {
    const t = curTask(); if (!t) return; const h = t.hint, arr = Array.isArray(h) ? h : null;
    const open = () => {
      const had = stash(); const p = clone(t.sol()); S.task = null; taskRes = null;
      loadBoard(p, t.title + ' (Musterlösung)'); setTab('edit'); toast(had ? 'Musterlösung geöffnet, dein Stand ist gesichert' : 'Musterlösung geöffnet');
    };
    const o = { id: t.id, hint: arr ? arr[0] : h, concrete: () => { if (arr && arr[1]) return arr[1]; const l = taskRes && taskRes.id === t.id ? taskRes.lines.find(x => !x.ok) : null; return l ? 'Noch nicht erfüllt: ' + l.text : taskRes && taskRes.id === t.id ? 'Alle Prüfpunkte sind erfüllt. Tippe auf „Lösung prüfen“.' : 'Tippe zuerst auf „Lösung prüfen“, dann kann ich dir den ersten offenen Punkt nennen.'; }, reveal: arr && arr[2] ? () => arr[2] : null, solution: typeof t.sol === 'function' ? open : null };
    if (root.Auswertung) root.Auswertung.hint(o); else sheet('Tipp', b => { b.innerHTML = '<p style="margin-top:0">' + esc(o.hint || '') + '</p>'; });
  }
  function renderTasks() {
    const V = $('#taskView'), A = TK();
    if (!A) { V.innerHTML = '<div class="card pl"><h4>Aufgaben</h4><p class="big">Aufgaben folgen</p><p class="hint2">Hier erscheinen bald Aufgaben mit automatischer Prüfung: Grundlagen, Leiterbahnen, Mehrlagen, Layout, DRC, Fertigung, Bestückung, Löten und Fehlersuche. Bis dahin kannst du mit den Beispielen üben (📖 oben).</p><div class="btns"><button class="btn pri" id="tkEx">Beispiele ansehen</button></div></div>'; $('#tkEx', V).onclick = openExamples; return; }
    const d = taskDone(), t = curTask(); let h = '';
    const n100 = A.filter(x => (d[x.id] || 0) >= 100).length;
    if (t) {
      const r = taskRes && taskRes.id === t.id ? taskRes : null;
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat || '')}</h4><div class="big">${esc(t.title)}</div><div class="lv">${'●'.repeat(t.level || 1)}${'○'.repeat(Math.max(0, 3 - (t.level || 1)))}</div>
        <p style="margin:8px 0">${esc(t.text)}</p><div id="pcbAnsHost"></div>
        <div class="btns"><button class="btn pri" data-ta="check">✓ Lösung prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button></div>
        <div class="btns"><button class="btn" data-ta="prog">Zur Platine</button><button class="btn" data-ta="hand">Abgeben (QR)</button><button class="btn danger" data-ta="end">Aufgabe beenden</button></div>`;
      if (r) h += `<ul class="tl">${r.lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}${!l.ok && l.why ? `<details><summary>Warum?</summary>${esc(l.why)}</details>` : ''}</li>`).join('')}</ul><div class="score ${r.pct === 100 ? 'ok' : ''}">${r.pct === 100 ? '🎉 Geschafft!' : r.pct + ' % richtig'}</div>`;
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${A.length} Aufgaben vollständig gelöst. Wähle eine Aufgabe: Du bekommst eine Startplatine, bearbeitest sie und lässt die Lösung automatisch prüfen.</p>`;
    let last = '';
    A.forEach(x => {
      if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; }
      const p = d[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${p >= 100 ? 'g' : p > 0 ? 'p' : ''}">${p >= 100 ? '✓' : p > 0 ? p : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${'●'.repeat(x.level || 1)}${'○'.repeat(Math.max(0, 3 - (x.level || 1)))}</span>${p != null ? ' · bisher ' + p + ' %' : ''}</small></div></button>`;
    });
    V.innerHTML = h;
    const host = $('#pcbAnsHost', V);
    if (t && host && root.PCB_TASKS && root.PCB_TASKS.answerSheet && S.board) { const el = root.PCB_TASKS.answerSheet(t, S.board, () => onChanged()); if (el) host.appendChild(el); }
  }
  $('#taskView').addEventListener('click', async e => {
    const tb = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tb) {
      const a = tb.dataset.ta;
      if (a === 'check') checkTask(); else if (a === 'hint') hintTask(); else if (a === 'prog') setTab('edit');
      else if (a === 'hand') { const t = curTask(); if (t && root.Auswertung) root.Auswertung.handIn(t.id, taskDone()[t.id] || 0, t.title); }
      else if (a === 'end') { S.task = null; taskRes = null; updateChrome(); renderTasks(); toast('Aufgabe beendet'); }
    } else if (row) startTask(row.dataset.t);
  });

  /* ============================================================ Tab Lernen */
  function stackSvg(rows, w) {
    const H = rows.reduce((s, r) => s + r[1], 0) + 4; let y = 2, s = `<svg class="tm" viewBox="0 0 ${w} ${H}" width="${w}" role="img" aria-label="Lagenaufbau im Querschnitt">`;
    rows.forEach(r => { s += `<rect x="2" y="${y}" width="${w - 4}" height="${r[1]}" fill="${r[2]}"/><text x="10" y="${y + r[1] / 2 + 4}" fill="${r[3] || '#fff'}" font-size="11" font-family="system-ui">${r[0]}</text>`; y += r[1]; });
    return s + '</svg>';
  }
  let helpDone = false;
  function renderHelp() {
    const V = $('#helpView'); if (helpDone) return; helpDone = true;
    const ex = (keys, t) => `<button class="chip s" data-ex="${esc(keys)}">${t}</button>`;
    const cu = '#c8873a', fr = '#3d7a4c', mk = '#1f8a3f', pp = '#7c8f5a';
    V.innerHTML = `<p class="big">Lernen und Hilfe</p><p class="hint2" style="margin:0 0 12px">Kurz erklärt, was du für Entwurf, Fertigung und Bestückung von Leiterplatten brauchst. Zum Ausprobieren gibt es Knöpfe, die ein passendes Beispiel laden.</p>
    <details open><summary>1 · Aufbau einer Leiterplatte</summary><div class="hb2"><p>Eine Leiterplatte besteht aus einem <b>Basismaterial</b> (meist FR-4: Glasfasergewebe mit Epoxidharz) und <b>Kupferschichten</b>. Aus dem Kupfer entstehen durch Ätzen die Leiterbahnen und Pads.</p>
      ${stackSvg([['Lötstopplack (grün)', 10, mk], ['Kupfer oben (Leiterbahnen, Pads)', 12, cu], ['Basismaterial FR-4 (etwa 1,5 mm)', 46, fr], ['Kupfer unten', 12, cu], ['Lötstopplack', 10, mk]], 330)}
      <p>Das Kupfer wird in <b>Unzen (oz)</b> angegeben: 1 oz bedeutet 35 µm Schichtdicke. Der <b>Lötstopplack</b> schützt das Kupfer und verhindert, dass Lot zwischen eng liegende Bahnen läuft; nur die Pads bleiben offen. Der <b>Bestückungsdruck</b> (Silk) beschriftet Bauteile. Die <b>Oberfläche</b> der Pads (zum Beispiel HASL oder ENIG) hält sie lötbar. Typische Gesamtdicke: 1,6 mm.</p>
      <div class="tryit">${ex('led|555|blinker|ui-led', 'Einfache Platine ansehen')}</div></div></details>
    <details><summary>2 · Lagen und Vias</summary><div class="hb2"><p><b>Einseitig:</b> Leiterbahnen nur unten, Bauteile oben als THT. <b>Zweilagig:</b> Bahnen oben und unten, verbunden durch <b>Vias</b> (durchkontaktierte Löcher). <b>Vier- und sechslagig:</b> zusätzliche Innenlagen, meist als Flächen für Masse (GND) und Versorgung (VCC).</p>
      ${stackSvg([['Signal (F.Cu)', 12, cu], ['Prepreg', 16, pp], ['GND-Fläche (In1)', 12, cu], ['Kern', 28, fr], ['VCC-Fläche (In2)', 12, cu], ['Prepreg', 16, pp], ['Signal (B.Cu)', 12, cu]], 330)}
      <p>Ein <b>Via</b> verbindet Lagen elektrisch. Ein <b>Durchgangs-Via</b> läuft durch die ganze Platine, <b>Blind-Vias</b> enden in einer Innenlage, <b>Buried-Vias</b> liegen ganz innen. Blind und Buried sind aufwendiger und kosten mehr. Auch THT-Pads sind durchkontaktiert und zählen auf allen Lagen.</p>
      <div class="tryit">${ex('4 lagen|vierlagig|sensor|4-lagen', 'Mehrlagen-Beispiel laden')}</div></div></details>
    <details><summary>3 · Leiterbahnbreite nach IPC</summary><div class="hb2"><p>Eine Leiterbahn hat einen Widerstand und erwärmt sich, wenn Strom fließt. Die Norm <b>IPC-2221</b> gibt dafür die Näherung <code>I = k · ΔT^0,44 · A^0,725</code> mit der Querschnittsfläche A in mil². Der Faktor <code>k</code> ist 0,048 für Außenlagen und 0,024 für Innenlagen: Innenlagen kühlen schlechter und müssen deshalb deutlich breiter sein.</p>
      <p>Faustwerte bei 1 oz und 10 K Erwärmung: für 1 A etwa 0,3 mm außen. Mit mehr Kupfer (2 oz) wird die Bahn bei gleicher Breite belastbarer.</p>
      <div class="calc"><label><span>Strom (A)</span><input id="ipcI" inputmode="decimal" value="1"></label><label><span>Kupfer (oz)</span><input id="ipcOz" inputmode="decimal" value="1"></label><label><span>Erwärmung (K)</span><input id="ipcDT" inputmode="decimal" value="10"></label><label><span>Lage</span><select id="ipcExt"><option value="1">außen</option><option value="0">innen</option></select></label><div class="res" id="ipcRes"></div></div>
      <p class="hint2">Im Netzlisten-Fenster (unten „Netze“) trägst du den Strom je Netz ein. Der DRC meldet dann Leiterbahnen, die dafür zu schmal sind.</p>
      <div class="tryit">${ex('motor|netzteil|h-brücke', 'Beispiel mit breiten Bahnen')}</div></div></details>
    <details><summary>4 · Abstände, Restring und Säurefallen</summary><div class="hb2"><p>Jeder Hersteller hat Mindestmaße. Der <b>DRC</b> (Design Rule Check) prüft sie: Abstand zwischen Kupfer verschiedener Netze, Mindestbreite der Leiterbahn, Mindestbohrung, <b>Restring</b> (das Kupfer, das um die Bohrung stehen bleibt: (Pad − Bohrung) ÷ 2) und Abstand zum Platinenrand, weil die Platine dort gefräst oder geritzt wird.</p>
      <p><b>Spitze Winkel</b> (Säurefallen) sammeln beim Ätzen Ätzmittel und können Bahnen unerwünscht verengen. Deshalb zeichnet man Ecken mit 45° statt 90° oder spitzer. Alle Mindestwerte stellst du unter „Platine“ (Leiste unten, links) ein.</p>
      <div class="tryit">${ex('fehler|drc|reparieren', 'Platine mit Fehlern laden')}</div></div></details>
    <details><summary>5 · Masse und Rückstrom</summary><div class="hb2"><p>Strom fließt immer im Kreis: Zu jedem Signalstrom gehört ein <b>Rückstrom</b>. Bei niedrigen Frequenzen sucht er sich den Weg mit dem geringsten Widerstand, bei hohen Frequenzen den Weg mit der kleinsten Induktivität, also <b>direkt unter der Signalleitung</b>. Eine durchgehende <b>Massefläche</b> gibt ihm diesen Weg.</p>
      <p><b>Merke:</b> Führe Signalbahnen nicht über Schlitze oder Aussparungen der Massefläche, sonst muss der Rückstrom einen Umweg nehmen. Das vergrößert die Schleife und damit Abstrahlung und Störempfindlichkeit. Abblockkondensatoren gehören <b>dicht an die Versorgungspins</b> des ICs, damit ihre Schleife klein bleibt. Bahnen, die lange parallel laufen, koppeln aufeinander (<b>Übersprechen</b>); mehr Abstand oder eine Masselage dazwischen hilft.</p>
      <div class="tryit">${ex('verstärker|vorverstärker|opv|masse', 'Beispiel mit Masseführung')}</div></div></details>
    <details><summary>6 · Bestückung und Löten</summary><div class="hb2"><p><b>THT</b>-Bauteile (bedrahtet) werden durch Bohrungen gesteckt und auf der Lötseite verlötet, von Hand oder in der Schwall-Lötanlage. <b>SMD</b>-Bauteile liegen auf Pads: Erst druckt man <b>Lotpaste</b> durch eine Schablone, dann bestückt der Automat, dann wandert die Platine durch den <b>Reflow-Ofen</b>.</p>
      <p>Das Reflow-Profil hat vier Phasen: <b>Vorwärmen</b>, <b>Soak</b> (Temperatur angleichen), <b>Peak</b> (Lot schmilzt, die Spitze liegt etwas über der Schmelztemperatur des Lots) und <b>Abkühlen</b>. Typische Fehler: <b>Tombstone</b> (Grabstein: ein Ende hebt ab, weil ein Pad früher schmilzt), <b>Lötbrücke</b> (zu viel Lot), <b>kalte Lötstelle</b> (matt, nicht richtig geflossen) und Zinnperlen.</p>
      <p>Beim Handlöten erwärmst du Pad und Anschlussdraht gleichzeitig, gibst dann Lot an die erwärmte Stelle, nicht an die Kolbenspitze. Eine gute Lötstelle glänzt und hat einen kleinen Meniskus.</p>
      <div class="tryit">${ex('smd|led-treiber|treiber', 'SMD-Beispiel laden')}</div></div></details>
    <details><summary>7 · Gerber-Daten</summary><div class="hb2"><p>Der Hersteller bekommt kein Layout-Programm, sondern <b>Gerber-Dateien</b> (Format RS-274X): eine Datei je Lage, wie Plotterbefehle. Eine <b>Blende</b> (Apertur) legt fest, wie ein Punkt oder Strich aussieht; „Flash“ setzt eine Blende ab (Pad), „Draw“ zieht eine Linie (Leiterbahn), Regionen füllen Flächen. Dazu kommen die <b>Bohrdatei</b> im Excellon-Format und der Platinenumriss.</p>
      <table><tr><th>Datei</th><th>Inhalt</th></tr><tr><td><code>.gtl</code> / <code>.gbl</code></td><td>Kupfer oben / unten</td></tr><tr><td><code>.gts</code> / <code>.gbs</code></td><td>Lötstopplack oben / unten</td></tr><tr><td><code>.gtp</code> / <code>.gbp</code></td><td>Lotpastenschablone</td></tr><tr><td><code>.gto</code> / <code>.gbo</code></td><td>Bestückungsdruck</td></tr><tr><td><code>.gm1</code></td><td>Platinenumriss</td></tr><tr><td><code>.drl</code></td><td>Bohrungen (Excellon)</td></tr></table>
      <p>Im Tab <b>Fertigung</b> siehst du die Dateien und kannst sie über „Export“ als ZIP speichern.</p>
      <div class="tryit">${ex('usb|arduino|shield|netzteil', 'Beispiel für den Gerber-Viewer')}</div></div></details>
    <details><summary>8 · Fehlersuche</summary><div class="hb2"><p>Gehe von außen nach innen vor: <b>1. Sichtprüfung</b> mit Lupe (Lötbrücken, kalte Lötstellen, falsch herum eingebaute Bauteile, fehlende Teile). <b>2. Bei ausgeschalteter Platine</b> Durchgang und Kurzschluss messen, zum Beispiel zwischen VCC und GND. <b>3. Unter Spannung</b> die Versorgung Stufe für Stufe nachmessen: Wo kommt die Spannung noch an, wo nicht mehr?</p>
      <p>Typische Fehler: <b>Unterbrechung</b> (Haarriss in der Bahn, gebrochenes Via), <b>Kurzschluss</b> (Lötbrücke, Zinnperle, Kupferrest), <b>falscher Bauteilwert</b>, <b>verpoltes Bauteil</b> (Elko, LED, IC) und <b>kalte Lötstelle</b>. Der Schaltplan sagt dir, was zwischen zwei Punkten sein müsste.</p>
      <div class="tryit">${ex('fehlersuche|defekt|fehler', 'Defekte Platine laden')}<button class="chip s" data-go="repair">Zur Fehlersuche</button></div></div></details>
    <details><summary>9 · Tastenkürzel</summary><div class="hb2">${keysHtml()}</div></details>`;
    ipcCalc();
  }
  function ipcCalc() {
    const I = num($('#ipcI').value), oz = num($('#ipcOz').value), dt = num($('#ipcDT').value), ext = $('#ipcExt').value === '1', out = $('#ipcRes');
    if (!(I > 0) || !(oz > 0) || !(dt > 0)) { out.textContent = 'Bitte Zahlen eingeben'; return; }
    const k = ext ? 0.048 : 0.024, A = Math.pow(I / (k * Math.pow(dt, 0.44)), 1 / 0.725), w = A / (1.378 * oz) * 0.0254;
    out.textContent = 'Mindestbreite: ' + fmt(w) + ' mm';
  }
  $('#helpView').addEventListener('input', e => { if (e.target.closest('.calc')) ipcCalc(); });
  $('#helpView').addEventListener('change', e => { if (e.target.closest('.calc')) ipcCalc(); });
  $('#helpView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'), g = e.target.closest('[data-go]');
    if (g) { setTab(g.dataset.go); return; }
    if (!b) return;
    const f = findExample(b.dataset.ex);
    if (f) { loadExample(f); return; }
    const fb = fallbackExamples()[0]; toast('Dazu gibt es noch kein eigenes Beispiel, ich lade eine kleine Platine'); loadExample({ id: fb.id, name: fb.name, get: () => clone(fb.board()) });
  });
  function keysHtml() {
    const k = (a, t) => `<tr><td style="white-space:nowrap"><code>${a}</code></td><td>${t}</td></tr>`;
    return '<table>' + k('W', 'Leiterbahn zeichnen') + k('V', 'Via setzen (Lagenwechsel)') + k('R', 'Bauteil drehen') + k('F', 'Bauteil spiegeln (auf die andere Seite)') + k('M', 'Messen (Abstand und Winkel)') + k('Entf', 'Auswahl löschen') + k('1 bis 6', 'Lage wählen (1 oben, die letzte Zahl unten)') + k('Strg + Z', 'Rückgängig') + k('Strg + Y oder Strg + Umschalt + Z', 'Wiederholen') + k('Strg + S', 'Platine speichern') + k('Mausrad oder Zwei-Finger-Geste', 'Zoomen') + k('Esc', 'Werkzeug beenden, Auswahl aufheben') + k('?', 'Diese Übersicht') + '</table><p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>';
  }

  /* ============================================================ Menü */
  function openMenu() {
    const nT = (TK() || []).length;
    const rows = [
      ['tasks', 'Aufgaben', nT ? nT + ' Aufgaben mit automatischer Prüfung' : 'Aufgaben folgen'], ['new', 'Neue Platine', 'Name, Größe, Lagenzahl, Kupferdicke'], ['ex', 'Beispiel-Platinen', exampleList().length + ' Platinen zum Ausprobieren'],
      ['open', 'Öffnen', 'Gespeicherte Platinen auf diesem Gerät'], ['save', 'Speichern unter …', S.board.name], ['props', 'Platine: Größe, Lagen, Regeln', 'Eigenschaften und Entwurfsregeln'], ['nets', 'Netzliste', 'Netzklassen und Strom je Netz'], ['drc', 'Entwurfsprüfung (DRC)', 'Fehler und Hinweise anzeigen'],
      ['share', 'Teilen', 'Link zum Weitergeben (Platine steckt im Link)'], ['import', 'Aus Code oder Link laden', 'Geteilte Platine einfügen'], ['export', 'Exportieren', 'Gerber-ZIP, Stückliste, Pick&Place, PNG'],
      ['fx', 'Effekte und Ton: ' + (fxOn() ? 'an' : 'aus'), 'Töne, Sprüche und Konfetti ein- oder ausschalten'], ['print', 'Drucken', 'Layout, Netze, Stückliste und Prüfergebnis'], ['calc', 'Rechner', 'Ohm, Farbcode, Leitung und mehr'],
      ['abz', 'Abzeichen', 'Deine Sammlung und was noch fehlt'], ['kamp', 'Kampagne: Das Abschlussgerät', 'Lernpfad mit Geschichte über alle Labs'], ['trainer', 'Trainer: Erste Schritte', 'Kurze Einführung zum Mitmachen'],
      ['neu', 'Neu in dieser Version', 'Was zuletzt dazukam und wo du es findest'], ['erg', 'Ergebnis senden', 'Code für den Ausbilder: meine bearbeiteten Aufgaben'], ['keys', 'Tastenkürzel', 'Alle Tasten (Taste ? drücken)'], ['help', 'Hilfe und Lernen', 'Grundlagen kurz erklärt'], ['start', 'Zur Startseite', '']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b>${r[2] ? `<small>${esc(r[2])}</small>` : ''}</div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); menuAct(r.dataset.m); });
    });
  }
  function menuAct(m) {
    switch (m) {
      case 'tasks': setTab('tasks'); break; case 'new': newBoardDialog(); break; case 'ex': openExamples(); break; case 'open': openList(); break; case 'save': doSave(); break;
      case 'props': propsSheet(); break; case 'nets': netSheet(); break; case 'drc': drcSheet(); break; case 'share': shareNow(); break; case 'import': importSheet(); break; case 'export': exportSheet(); break;
      case 'fx': toggleFx(); break; case 'print': printNow(); break; case 'calc': if (root.Rechner) root.Rechner.open(); break; case 'abz': if (root.Badges) root.Badges.open(); break;
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
    if (e.defaultPrevented || typing(e) || e.altKey || document.querySelector('.backdrop')) return;
    const k = e.key, mod = e.ctrlKey || e.metaKey, l = k.toLowerCase();
    if (mod) {
      if (l === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (l === 'y') { e.preventDefault(); redo(); }
      else if (l === 's') { e.preventDefault(); doSave(); }
      return;
    }
    const V = VIEWS[S.cur]; if (V && V.api && typeof V.api.onKey === 'function') { try { V.api.onKey(e); } catch (x) { console.error(x); } }
  });

  /* ============================================================ Schnittstellen für Trainer, Tasten, Tests */
  root.LabTrainerAPI = {
    lab: 'pcb', tab: () => S.tab, go: setTab, simMode: () => false, running: () => false, load: loadExampleByName, examples: () => exampleList().map(e => e.name),
    board: () => S.board, layers: () => S.board.layers, parts: () => S.board.parts.length, tracks: () => S.board.tracks.length, vias: () => S.board.vias.length, zones: () => S.board.zones.length,
    drcErrors: () => errList().length, unrouted: () => unroutedCount(), task: () => (S.task ? S.task.id : null), content: () => hasContent(S.board), saved: () => saved().length, view: () => S.cur
  };
  root.LabKeysAdapter = {
    lab: 'pcb', sheet: (title, build) => (title === 'Tastenkürzel' ? sheet(title, b => { b.innerHTML = keysHtml(); }) : sheet(title, build)), esc, toast,
    busy: () => true, has: () => false
  };
  root.PCB_UI = { S, ctx, setTab, setBoard, loadBoard, newBoardDialog, mkBoard, loadExampleByName, exampleList, startTask, checkTask, undo, redo, computeDrc, makeZip, crc32, showView, VIEWS, saveBoard, openList, propsSheet, netSheet, drcSheet, exportSheet, fx };

  /* ============================================================ Start */
  function init() {
    buildHosts(); buildTabs();
    const cur = lsGet('pcb.cur', null);
    let started = false;
    if (cur && cur.board && Array.isArray(cur.board.parts)) {
      S.task = cur.task ? { id: cur.task } : null; loadBoard(ensureShape(cur.board), null, cur.id || null); S.dirty = !!cur.dirty; started = true;
    }
    if (!started) {
      const ex = exampleList()[0]; const b = ex && ex.get();
      loadBoard(b || mkBoard({ name: 'Neue Platine' }), ex ? ex.name : null);
      if (!lsRaw('pcb.seen', '')) { lsPut('pcb.seen', '1'); setTimeout(() => toast('Willkommen! Zeichne Leiterbahnen im Layout-Tab oder wähle oben ein Beispiel.'), 900); }
    }
    setTab(S.tab); booted = true;
    /* Aufrufparameter von Startseite, Lernpfad, Kampagne und Lernheften: ?aufgabe=pb1, ?ex=id, ?bsp, ?neu */
    try {
      const q = new URLSearchParams(location.search), qa = q.get('aufgabe'), qe = q.get('ex');
      if (qa && (TK() || []).some(x => x.id === qa)) setTimeout(() => startTask(qa), 250);
      else if (qe) setTimeout(() => { if (!loadExampleByName(qe)) toast('Beispiel nicht gefunden: ' + qe); }, 250);
      else if (q.has('bsp')) setTimeout(openExamples, 400);
      else if (q.has('neu')) setTimeout(newBoardDialog, 400);
    } catch (e) { console.error(e); }
    if (/^#[sz]=/.test(location.hash)) { const h = location.hash; history.replaceState(null, '', location.pathname + location.search); loadShared(h); }
    root.addEventListener('hashchange', () => { if (/^#[sz]=/.test(location.hash)) { const h = location.hash; history.replaceState(null, '', location.pathname + location.search); loadShared(h); } });
    root.addEventListener('beforeunload', () => { lsSet('pcb.cur', curObj()); });
    if (!CORE()) setTimeout(() => toast('Der Platinen-Kern (pcbcore.js) ist noch nicht geladen'), 1400);
  }
  init();
})(window);
