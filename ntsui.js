'use strict';
/* Tonfunk Netzteil-Lab: Oberfläche (WP3a, SPEC Abschnitt 6, VERTRAG 6.4).
   Seite, Tabs (Prüfstand, Verläufe, Kennlinien, Auslegen, Rechnen, Aufgaben, Lernen), Bedienpult und Messgeräte automatisch aus rig.controls / rig.meters
   (Gruppen und Farben nach der Stufe, eine Tabelle: NTS_DRAW.STUFEN), Ampelzeile aus rig.assess(), Blockschaltbild mit Leistungsbilanz aus rig.bilanz(),
   Vorher/Nachher (Taste M, V, W), Sweep und Ablauf (Ablauf über NTS_CORE.runSeq), Beispiele, Speichern/Öffnen/Teilen (#z=), Aufgabenrahmen mit Fehler-Würfel,
   Effekte (nur window.LochFX &&), Tastenkürzel aus EINER Tabelle (KEYS).
   Verläufe, Kennlinien, Auslegen, Rechnen und Lernen kommen aus ntsui-wave.js, ntsui-curve.js, ntsui-design.js, ntsui-calc.js und ntsui-help.js über
   window.NTS_UI_EXT (VERTRAG 6.4); fehlt eine Erweiterung, erscheint "Ansicht wird geladen" statt eines Absturzes.
   Es gibt hier KEINE zweite Formelimplementierung: alle Zahlen kommen aus dem Prüfstand (assess, bilanz, readMeters, curves) bzw. NTS_CORE (runSeq, limits, fault).
   Speicher: nts.cur, nts.seen, nts.speed, nts.faults, nts.saves, nts.fx, nts.tab, nts.q, nts.design (Erweiterung Auslegen); sim.done / sim.hints (gemeinsam). */
(function (root) {
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const lsRaw = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsPut = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const clone = o => JSON.parse(JSON.stringify(o));
  const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const stat = (k, v, m) => { if (root.Badges) try { root.Badges.stat(k, v, m); } catch (e) {} };
  const fin = v => typeof v === 'number' && isFinite(v);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const CORE = () => root.NTS_CORE;
  const DRAW = () => root.NTS_DRAW;
  const ORDER = ['trafo', 'gleich', 'stabil', 'buck', 'topo', 'gate', 'regel', 'fehler'];
  const RIGMETA = {
    trafo: { icon: '🔄', name: 'Transformator', short: 'Trafo', info: 'Übersetzung, Belastung' },
    gleich: { icon: '🌊', name: 'Gleichrichter und Siebung', short: 'Gleichrichter', info: 'Brumm, Ladekondensator' },
    stabil: { icon: '⚓', name: 'Stabilisieren', short: 'Stabilisieren', info: 'Z-Diode, 7805, LM317' },
    buck: { icon: '⬇️', name: 'Tiefsetzsteller', short: 'Tiefsetzsteller', info: 'Drossel, Tastverhältnis' },
    topo: { icon: '🔀', name: 'Hochsetzsteller, Inverswandler, Sperrwandler', short: 'Hoch/Invers/Sperr', info: 'Weitere Wandler' },
    gate: { icon: '⚡', name: 'Gate und Schaltverluste', short: 'Gate', info: 'Schaltzeit, Verlust' },
    regel: { icon: '🎚️', name: 'Regelkreis und Labornetzteil', short: 'Regelkreis', info: 'Rückkopplung, CV/CC' },
    fehler: { icon: '🔍', name: 'Fehlersuche am Netzteil', short: 'Fehlersuche', info: 'Symptom, Messpunkt, Ursache' }
  };
  const RIGFILE = { trafo: 'ntsrig-trafo.js', gleich: 'ntsrig-gleich.js', stabil: 'ntsrig-stabil.js', buck: 'ntsrig-buck.js', topo: 'ntsrig-topo.js', gate: 'ntsrig-gate.js', regel: 'ntsrig-regel.js', fehler: 'ntsrig-fehler.js' };
  const FIRE = { trafo: 'Einschalten', gleich: 'Einschalten', stabil: 'Last anlegen', buck: 'Lastsprung', topo: 'Lastsprung', gate: 'Schaltvorgang', regel: 'Lastsprung', fehler: 'Messen' };
  const GROUPS = ['Eingang und Transformator', 'Gleichrichtung und Siebung', 'Regelung', 'Schalten und Gate', 'Last und Anzeige'];
  const ART = { linear: 'Linearregler', getaktet: 'getaktet', passiv: 'passiv', diagnose: 'Diagnose' };
  const SPEEDS = [0.1, 0.25, 0.5, 1, 2];
  const QUAL = ['hoch', 'mittel', 'niedrig'];
  const decs = step => { step = +step || 0; if (!step || step >= 1) return 0; return Math.min(3, Math.ceil(-Math.log10(step) - 1e-9)); };
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',').replace(/^-(?=\d)/, '−') : '–');
  const adig = v => { v = Math.abs(v); if (v === 0) return 0; return v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : v >= 0.1 ? 3 : 4; };
  const fauto = v => (fin(v) ? fnum(v, adig(v)) : '–');
  const parseNum = s => {
    const C = CORE(); if (C && typeof C.parseNum === 'function') { const v = C.parseNum(s); if (fin(v)) return v; if (typeof s === 'number') return NaN; }
    return fin(s) ? s : parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.'));
  };
  const clickSnd = k => { if (root.LochFX) try { root.LochFX.sound(k || 'tick'); } catch (e) {} };
  const reducedMotion = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
  const TX = () => (CORE() && CORE().TEXTS) || {};
  const simOnlyText = () => TX().simOnly || 'Simulation – kein Eigenbau und keine Messung an Netzspannung.';
  const ampelNote = () => TX().ampelHinweis || 'Grün heißt nicht: gefahrlos anfassen.';

  /* ============================================================ Fenster, Meldungen, Dialoge */
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2400, String(m).length * 55)); }
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
  function pick(title, options, opt) {
    opt = opt || {};
    return new Promise(res => {
      let done = false; const fin2 = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        const search = options.length > 14;
        b.innerHTML = (opt.intro ? `<p class="hint2" style="margin-top:0">${esc(opt.intro)}</p>` : '') + (search ? '<input id="pq" type="search" placeholder="Suchen …" autocomplete="off" style="margin-bottom:6px">' : '') + '<div id="pl"></div>';
        const draw = q => {
          let last = null, html = '';
          options.forEach((o, i) => {
            if (q && !((o.label || '') + ' ' + (o.sub || '') + ' ' + (o.group || '') + ' ' + (o.value == null ? '' : o.value)).toLowerCase().includes(q)) return;
            if (o.group !== last) { last = o.group; if (o.group) html += `<div class="gh">${esc(o.group)}</div>`; }
            html += `<button class="row" data-i="${i}"${o.disabled ? ' disabled' : ''}>${o.icon ? `<span style="font-size:22px;display:inline-block;width:32px;text-align:center;flex:none">${o.icon}</span>` : ''}<div class="grow"><b>${esc(o.label)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div>${o.mark ? `<span class="lv">${esc(o.mark)}</span>` : ''}</button>`;
          });
          $('#pl', b).innerHTML = html || '<p class="hint2">Nichts gefunden.</p>';
        };
        draw('');
        if (search) $('#pq', b).addEventListener('input', e => draw(e.target.value.trim().toLowerCase()));
        b.addEventListener('click', e => { const r = e.target.closest('.row[data-i]'); if (!r || r.disabled) return; fin2(options[+r.dataset.i].value); close(); });
      }, () => fin2(null));
    });
  }
  function ask(title, fields, opt) {
    opt = opt || {};
    return new Promise(res => {
      let done = false; const fin2 = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        b.innerHTML = (opt.intro ? `<p class="hint2" style="margin-top:0">${esc(opt.intro)}</p>` : '') + fields.map((f, i) =>
          `<label class="f"><span>${esc(f.label)}</span><input id="ak${i}" type="text" inputmode="${f.type === 'number' ? 'decimal' : 'text'}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(f.value == null ? '' : f.value)}"></label>`).join('') +
          '<div id="akErr" class="hint2" style="color:var(--bad-fg);min-height:18px"></div><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn pri" data-ok>OK</button></div>';
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
  function confirmSheet(title, text, okLabel, danger) {
    return new Promise(res => {
      let done = false; const fin2 = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        b.innerHTML = `<p style="margin-top:0">${text}</p><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn ${danger ? 'danger' : 'pri'}" data-ok>${esc(okLabel || 'OK')}</button></div>`;
        $('[data-c]', b).onclick = close; $('[data-ok]', b).onclick = () => { fin2(true); close(); };
      }, () => fin2(false));
    });
  }
  root.LabUI = { sheet, esc, toast, userName: () => lsRaw('lm4.name', ''), LAB: 'nts' };
  root.sheet = sheet; root.toast = toast;

  /* ============================================================ Registry-Zugriff */
  const defOf = id => { const r = root.NTS_RIGS; return r && r.defs && r.defs[id] ? r.defs[id] : null; };
  const rigName = id => (defOf(id) && defOf(id).name) || (RIGMETA[id] || {}).name || id;
  const rigIcon = id => (defOf(id) && defOf(id).icon) || (RIGMETA[id] || {}).icon || '🔌';
  const rigShort = id => (RIGMETA[id] || {}).short || rigName(id);
  const rigInfo = id => (RIGMETA[id] || {}).info || (defOf(id) && defOf(id).info) || '';
  const STUF = () => (DRAW() && DRAW().STUFEN) || { trafo: { name: 'Transformator', sym: 'T', key: 's_trafo' }, gleich: { name: 'Gleichrichtung', sym: 'G', key: 's_gleich' }, sieb: { name: 'Glättung', sym: 'C', key: 's_sieb' }, regel: { name: 'Regelung', sym: 'R', key: 's_regel' }, schalt: { name: 'Schalten', sym: 'S', key: 's_schalt' }, last: { name: 'Last', sym: 'L', key: 's_last' } };
  const stufeName = s => (STUF()[s] || {}).name || '';
  const stufeSym = s => (STUF()[s] || {}).sym || '';
  const isDark = () => { const a = document.documentElement.getAttribute('data-theme'); if (a === 'dark') return true; if (a === 'light') return false; try { return !(root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches); } catch (e) { return true; } };
  const theme = () => (isDark() ? 'dark' : 'light');
  const stufeColor = s => { const D = DRAW(), st = STUF()[s]; if (!st) return 'var(--mute)'; try { const p = D && D.palette ? D.palette(theme()) : null; return (p && p[st.key]) || 'var(--mute)'; } catch (e) { return 'var(--mute)'; } };
  const AMP = { gruen: { sym: '✓', text: 'grün: Auslegung trägt', cls: 'ok' }, gelb: { sym: '!', text: 'gelb: knapp', cls: 'warnc' }, rot: { sym: '✗', text: 'rot: Grenze verletzt', cls: 'bad' }, grau: { sym: '–', text: 'grau: noch nicht bewertet', cls: '' } };
  const ampInfo = st => { const D = DRAW(); let i = null; try { i = D && D.ampelInfo ? D.ampelInfo(st) : null; } catch (e) { i = null; } const k = i && AMP[i.state] ? i.state : AMP[st] ? st : 'grau'; return { state: k, sym: (i && i.sym) || AMP[k].sym, text: (i && i.text) || AMP[k].text, cls: AMP[k].cls }; };

  /* ============================================================ Zustand */
  const seenObj = () => { const o = lsGet('nts.seen', {}); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; };
  const S = {
    tab: lsRaw('nts.tab', 'rig'), rigId: null, rig: null, err: '', name: 'Neuer Versuch', id: null, task: null, dirty: false,
    running: false, speed: +lsRaw('nts.speed', '1') || 1, slots: {}, ctlMem: {}, ctl: {}, st: null, live: null, readonly: false,
    needDraw: true, animT: 0, autoRun: false, tkCat: '', tkLv: 0, preset: null, q: lsRaw('nts.q', 'auto'), qEff: 'mittel',
    evSeen: new WeakSet(), evSig: '', evLen: 0, diag: [], faultUntil: 0, faultText: '', dice: null, taskStart: null,
    ref: null, refRig: null, cmp: false, wipe: false, wipeAt: 0.5, rows: [], rowRes: null, sweepRes: null,
    clicks: [], diagnose: null, fired: false, designUsed: false, calcUsed: false, amp: 'grau', ampSeen: false, touched: false, lastAmpelFx: 0
  };
  const TABS = [['rig', '🎛️', 'Prüfstand'], ['wave', '〰️', 'Verläufe'], ['curve', '📈', 'Kennlinien'], ['design', '📐', 'Auslegen'], ['calc', '🧮', 'Rechnen'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Lernen']];
  if (!TABS.some(x => x[0] === S.tab)) S.tab = 'rig';
  if (!SPEEDS.includes(S.speed)) S.speed = 1;
  if (S.q !== 'auto' && !QUAL.includes(S.q)) S.q = 'auto';
  S.qEff = QUAL.includes(S.q) ? S.q : 'mittel';

  /* ---- Tastenkürzel: EINE Tabelle für Behandler, Hilfe-Blatt (Lernen 19) und Menü ---- */
  const kmatch = (e, k) => e.key.toLowerCase() === k && !(e.ctrlKey || e.metaKey);
  const KEYS = [
    { id: 'run', keys: ['Leertaste'], match: e => e.key === ' ', t: 'Prüfstand starten und anhalten', act: () => setRun(!S.running) },
    { id: 'enter', keys: ['Eingabe', 'F5'], ext: true, t: 'Starten und anhalten (gilt auch außerhalb der Bildfläche)' },
    { id: 'reset', keys: ['Z'], match: e => kmatch(e, 'z'), t: 'Prüfstand zurücksetzen (Reset)', act: () => resetRig() },
    { id: 'fx', keys: ['E'], match: e => kmatch(e, 'e'), t: 'Effekte und Ton ein oder aus', act: () => toggleFx() },
    { id: 'speed', keys: ['1', '2', '3', '4', '5'], match: e => e.key >= '1' && e.key <= '5', t: 'Zeitlupe ×0,1 / ×0,25 / ×0,5 / ×1 / ×2', act: e => setSpeed(SPEEDS[+e.key - 1]) },
    { id: 'mark', keys: ['M'], match: e => kmatch(e, 'm'), t: 'Vorher merken (aktuellen Stand als Vergleich festhalten)', act: () => setRef(true) },
    { id: 'cmp', keys: ['V'], match: e => kmatch(e, 'v'), t: 'Vorher und Nachher nebeneinander ein oder aus', act: () => toggleCmp() },
    { id: 'wipe', keys: ['W'], match: e => kmatch(e, 'w'), t: 'Wischer zwischen Vorher und Nachher ein oder aus', act: () => toggleWipe() },
    { id: 'fire', keys: ['F'], match: e => kmatch(e, 'f'), t: 'Auslösen: Einschalten, Lastsprung, Schaltvorgang oder Messung (je nach Anlage)', act: () => fireRig() },
    { id: 'sweep', keys: ['S'], match: e => kmatch(e, 's'), t: 'Bereich "Sweep und Ablauf" öffnen oder schließen', act: () => toggleSweep() },
    { id: 'save', keys: ['Strg + S'], match: e => (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's', t: 'Versuch speichern', act: () => doSave() },
    { id: 'help', keys: ['?'], ext: true, t: 'Diese Übersicht' }
  ];
  function keysHtml() {
    const kd = a => a.map(x => `<code>${esc(x)}</code>`).join(' oder ');
    return '<table>' + KEYS.map(k => `<tr><td style="white-space:nowrap">${kd(k.keys)}</td><td>${esc(k.t)}</td></tr>`).join('') + '</table><p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>';
  }
  root.NTS_KEYS = KEYS;

  let curT = 0, drawErr = false;
  const listOf = (rigV, defV) => (Array.isArray(rigV) ? rigV : Array.isArray(defV) ? defV : []);
  const ctlsOf = () => (S.rig ? listOf(S.rig.controls, (defOf(S.rigId) || {}).controls) : []);
  const metersOf = () => (S.rig ? listOf((defOf(S.rigId) || {}).meters, S.rig.meters) : []);
  const ctlDef = (key, list) => (list || ctlsOf()).find(c => c.key === key);
  const hasCtl = k => !!ctlDef(k);
  const optsOf = c => (c.options || []).map(o => (o && typeof o === 'object' ? { value: o.value, label: o.label != null ? String(o.label) : String(o.value), help: o.help } : { value: o, label: String(o) }));
  /* Wert an die Definition anpassen (Auswahl über Wert, Nummer oder Beschriftung, Schieber begrenzen); undefined = nicht passend */
  function coerce(def, v) {
    if (!def) return undefined;
    if (def.type === 'slider') { v = typeof v === 'string' ? parseNum(v) : +v; if (!fin(v)) return undefined; return clamp(v, def.min, def.max); }
    if (def.type === 'switch' || def.type === 'button') return !!v;
    if (def.type === 'select') {
      const o = optsOf(def);
      const m = o.find(x => x.value === v) || o.find(x => String(x.value) === String(v)) || (typeof v === 'number' ? o.find(x => typeof x.value === 'number' && Math.abs(x.value - v) <= 1e-9 * Math.max(1, Math.abs(v))) : null) || o.find(x => x.label.toLowerCase() === String(v).toLowerCase());
      return m ? m.value : undefined;
    }
    return v;
  }

  /* ============================================================ Prüfstände (Plätze) und Steuerwerte */
  function bindSlot(id) {
    const sl = S.slots[id]; S.rigId = id; S.rig = sl ? sl.rig : null;
    S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; S.st = null; S.diag = []; S.amp = 'grau'; S.ampSeen = false; S.touched = false;
  }
  function setRig(id, o) {
    o = o || {};
    if (!ORDER.includes(id)) id = ORDER[0];
    S.err = ''; S.ctl = {}; S.preset = null; S.live = null; S.clicks = []; S.diagnose = null; S.dice = null;
    if (S.ref && S.ref.rig !== id) clearRef(true);
    const d = defOf(id); let rig = null;
    if (d) { try { rig = d.create(o.opts || {}); } catch (e) { S.err = (e && e.message) || String(e); console.error('Prüfstand ' + id + ':', e); } }
    S.slots[id] = { rig };
    bindSlot(id); S.running = o.run === undefined ? true : !!o.run; S.autoRun = !S.running; fxReset();
    afterRigChange(); saveCurSoon();
  }
  function useRig(id) {
    if (S.rigId === id && S.rig) return;
    if (S.ref && S.ref.rig !== id) clearRef(true);
    if (S.slots[id] && S.slots[id].rig) { S.live = null; bindSlot(id); S.ctl = {}; S.clicks = []; S.diagnose = null; fxReset(); afterRigChange(); }
    else { setRig(id); if (S.ctlMem[id]) applyCtl(S.ctlMem[id]); }
  }
  function afterRigChange() {
    S.needDraw = true; blkSig = '';
    buildPick(); buildPresets(); buildControls(); buildMeters(); buildSimBand(); buildFaultPanel(); buildBa(); buildSweep(); buildLimits(); fitCanvas(); updateEvents(true); updateChrome(); readState();
    updateAmpel(true); updateLinks(); buildDiceBar();
    if (S.tab !== 'rig' && S.tab !== 'tasks') renderExt(S.tab);
  }
  const SELFIRST = c => (c && (c.type === 'select' || c.type === 'switch') ? 0 : 1);
  function applyCtl(map) {
    if (!S.rig || !map || typeof map !== 'object') return;
    const keys = Object.keys(map).sort((a, b) => SELFIRST(ctlDef(a)) - SELFIRST(ctlDef(b)));
    keys.forEach(k => {
      const v = coerce(ctlDef(k), map[k]); if (v === undefined) return;
      try { S.rig.setControl(k, v); S.ctl[k] = v; } catch (e) { console.error('Steuerwert ' + k, e); }
    });
    syncCtl(true); S.needDraw = true;
  }
  function setCtl(key, val, silent) {
    if (!S.rig || S.readonly) return false;
    const def = ctlDef(key), v = coerce(def, val); if (v === undefined) return false;
    let ok = true; try { ok = S.rig.setControl(key, v) !== false; } catch (e) { console.error(e); return false; }
    if (!ok) { syncCtl(true); toast('Diesen Wert gibt es an dieser Anlage nicht.'); return false; }
    S.ctl[key] = v;
    if (!silent) {
      S.dirty = true; S.touched = true; saveCurSoon();
      if (!S.running && S.autoRun && def.type !== 'button' && !S.live && S.tab === 'rig') setRun(true, true);
    }
    readState(); syncCtl(); S.needDraw = true; return true;
  }
  const allCtl = () => { const o = {}; if (S.rig) ctlsOf().forEach(c => { try { const v = S.rig.getControl(c.key); if (v !== undefined && c.type !== 'button') o[c.key] = v; } catch (e) {} }); return o; };
  const rnd6 = v => (typeof v === 'number' && isFinite(v) ? +v.toFixed(6) : v);
  function saveCurSoon() { clearTimeout(curT); curT = setTimeout(saveCur, 400); }
  function saveCur() {
    if (!S.rig) return; S.ctlMem[S.rigId] = allCtl();
    lsSet('nts.cur', { rig: S.rigId, ctls: S.ctlMem, name: S.name, id: S.id, task: S.task ? S.task.id : null, dirty: S.dirty, rows: S.rows, ref: refState() });
  }
  function usedRig() {
    if (!S.rigId || S.err) return;
    const sn = seenObj(), r = sn.rigs && typeof sn.rigs === 'object' ? sn.rigs : {}; if (!r[S.rigId]) { r[S.rigId] = 1; sn.rigs = r; lsSet('nts.seen', sn); }
    stat('ntsrigs', Object.keys(r).length, 'max');
  }
  function readState() { if (!S.rig) { S.st = null; return null; } try { S.st = S.rig.state(); } catch (e) { S.st = S.st || null; } return S.st; }

  /* ---- Prüfstandwahl (Chips), Voreinstellungen ---- */
  function buildPick() {
    const el = $('#rigPick'); if (!el) return;
    el.innerHTML = ORDER.map(id => {
      const have = !!defOf(id), on = id === S.rigId;
      return `<button class="chip${on ? ' on' : ''}${have ? '' : ' miss'}" data-rig="${id}" aria-pressed="${on}" title="${esc(rigName(id))}${have ? '' : ' (nicht geladen)'}"><span>${rigIcon(id)} ${esc(rigShort(id))}${have ? '' : ' ⚠'}</span><small>${esc(rigInfo(id))}</small></button>`;
    }).join('');
  }
  $('#rigPick').addEventListener('click', e => { const b = e.target.closest('[data-rig]'); if (b) usePick(b.dataset.rig); });
  function usePick(id) {
    if (id === S.rigId && S.tab === 'rig') return;
    if (S.task) { toast('Während einer Aufgabe ist der Prüfstand fest. Beende zuerst die Aufgabe.'); return; }
    if (id === S.rigId) { setTab('rig'); return; }
    saveCur(); stash(); S.name = 'Neuer Versuch'; S.id = null; S.dirty = false; useRig(id); if (S.tab !== 'rig' && S.tab !== 'tasks') renderExt(S.tab); toast('Prüfstand: ' + rigName(id));
  }
  const presetsOf = () => (S.rig ? listOf(S.rig.presets, (defOf(S.rigId) || {}).presets) : []);
  function buildPresets() {
    const P = presetsOf(), el = $('#presetBar');
    if (!P.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="gh" style="padding-top:2px">Voreinstellung</div><div class="chips">${P.map(p => `<button class="chip s${S.preset === p.id ? ' on' : ''}" data-pre="${esc(p.id)}">${esc(p.name || p.id)}</button>`).join('')}</div>`;
  }
  $('#presetBar').addEventListener('click', e => {
    const b = e.target.closest('[data-pre]'); if (!b || !S.rig) return;
    if (S.task) { toast('Während einer Aufgabe gelten die Einstellungen der Aufgabe.'); return; }
    const p = presetsOf().find(x => String(x.id) === b.dataset.pre); if (!p) return;
    let ok = true;
    if (typeof S.rig.applyPreset === 'function') { try { ok = S.rig.applyPreset(p.id) !== false; } catch (er) { console.error(er); ok = false; } }
    else if (p.controls && typeof p.controls === 'object') applyCtl(p.controls);
    if (!ok) { toast('Voreinstellung nicht möglich'); return; }
    S.preset = p.id; S.evSeen = new WeakSet(); S.evSig = ''; S.live = null; S.ctl = {}; S.faultUntil = 0; fxReset(); S.needDraw = true;
    buildControls(); buildMeters(); buildPresets(); readState(); updateEvents(true); updateChrome(); toast('Voreinstellung: ' + (p.name || p.id)); S.dirty = true; S.touched = true; saveCurSoon();
  });

  /* ---- Platzhalter, wenn ein Prüfstand fehlt ---- */
  function placeholderHtml() {
    const why = S.err ? 'Der Prüfstand konnte nicht gestartet werden: ' + esc(S.err) : 'Die Datei für „' + esc(rigName(S.rigId)) + '“ (' + esc(RIGFILE[S.rigId] || '') + ') ist noch nicht geladen.';
    return `<div class="ph2"><b>Prüfstand noch nicht geladen</b>${why}<br><button class="btn" data-retry>Erneut prüfen</button></div>`;
  }
  function retryLoad() {
    const want = [];
    if (!root.NTS_CORE) want.push('ntscore.js'); if (!root.NTS_DRAW) want.push('ntsdraw.js'); if (!(root.NTS_RIGS && root.NTS_RIGS.base)) want.push('ntsrig-base.js');
    ORDER.forEach(id => { if (!defOf(id)) want.push(RIGFILE[id]); });
    if (!want.length) { const keep = S.rig ? allCtl() : {}; setRig(S.rigId); applyCtl(keep); toast('Alles geladen'); return Promise.resolve(); }
    toast('Lade fehlende Dateien …');
    return Promise.all(want.map(f => new Promise(res => { const s = document.createElement('script'); s.src = f + '?t=' + Date.now(); s.onload = s.onerror = () => res(); document.head.appendChild(s); }))).then(() => {
      const still = ORDER.filter(i => !defOf(i)).length, keep = S.rig ? allCtl() : {}; setRig(S.rigId); applyCtl(keep); buildPick();
      if (S.tab === 'tasks') renderTasks(); toast(still ? still + ' Prüfstand' + (still > 1 ? 'e fehlen' : ' fehlt') + ' noch' : 'Alle Prüfstände geladen');
    });
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-retry]')) { if (S.tab === 'rig' || S.tab === 'tasks') retryLoad(); else renderExt(S.tab); } });

  /* ============================================================ Bedienpult aus rig.controls (Gruppen und Farben nach der Stufe) */
  let panels = [];
  const slPosOf = (c, v) => { if (c.scale === 'log' && c.min > 0 && c.max > c.min) return Math.round(1000 * Math.log(clamp(v, c.min, c.max) / c.min) / Math.log(c.max / c.min)); return Math.round(1000 * (clamp(v, c.min, c.max) - c.min) / ((c.max - c.min) || 1)); };
  function slVal(c, pos) {
    let v = c.scale === 'log' && c.min > 0 && c.max > c.min ? c.min * Math.pow(c.max / c.min, pos / 1000) : c.min + (c.max - c.min) * pos / 1000;
    if (c.step && !(c.scale === 'log')) v = Math.round(v / c.step) * c.step; else if (c.scale === 'log') { const d = fin(v) ? Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, v))) - 2) : 0.01; v = Math.round(v / d) * d; }
    return clamp(+v.toPrecision(10), c.min, c.max);
  }
  const ctlShow = (c, v) => fnum(v, c.scale === 'log' ? adig(v) : decs(c.step));
  /* Status: belegt (Pool oder Toni) oder Übungswert (A); Quelle ist NTS_CORE.limits, sonst gilt jeder Bauteilwert als Übungswert */
  function statusOf(c) {
    const C = CORE(), id = c.limitId || c.limit || c.key; let l = null;
    try { l = C && Array.isArray(C.limits) ? C.limits.find(x => x.id === id) : null; } catch (e) { l = null; }
    const st = c.status || (l && l.status) || 'A';
    return { belegt: st === 'belegt', frage: l && l.frage, quelle: l && l.quelle };
  }
  const badgeHtml = c => { const s = statusOf(c); return s.belegt ? `<span class="bdg ok" title="belegt: Prüfungspool oder Ausbilder${s.quelle && s.quelle !== '—' ? ' (' + esc(s.quelle) + ')' : ''}">✓ belegt</span>` : `<span class="bdg uw" title="Übungswert (A): nicht aus einer Prüfung belegt${s.frage ? ', Frage ' + esc(s.frage) : ''}">(A) Übungswert</span>`; };
  function ctlHtml(c) {
    const k = esc(c.key), lab = c.label || c.key, hp = c.help || '', help = hp ? `<small class="hp">${esc(hp)}</small>` : '', col = stufeColor(c.stufe), sym = c.stufe ? `<i class="sb" style="--lc:${col}" aria-hidden="true">${esc(stufeSym(c.stufe))}</i> ` : '';
    const st = c.stufe ? ` data-st="${esc(c.stufe)}"` : '';
    if (c.type === 'slider') return `<div class="ct" data-k="${k}" data-t="slider"${st} title="${esc(hp)}"><div class="ctl"><span class="lb">${sym}${esc(lab)}</span><span class="vi"><input class="num" inputmode="decimal" autocomplete="off" aria-label="${esc(lab)}, Wert eingeben"><small class="un"></small></span></div>${help}<div class="barow" style="padding:0">${c.unit ? badgeHtml(c) : ''}</div><input type="range" min="0" max="1000" step="1" value="0" aria-label="${esc(lab)}"></div>`;
    if (c.type === 'switch') return `<div class="ct p0" data-k="${k}" data-t="switch"${st} title="${esc(hp)}"><button class="sw" role="switch" aria-checked="false" aria-label="${esc(lab)}"><span class="lab"><span>${sym}${esc(lab)}${help}</span></span><span class="tgl"><i></i></span></button></div>`;
    if (c.type === 'button') return `<div class="ct p0" data-k="${k}" data-t="button"${st} title="${esc(hp)}"><button class="bt" aria-label="${esc(lab)}">${esc(lab)}</button></div>`;
    if (c.type === 'select') {
      const o = optsOf(c), tt = x => (x.help ? ` title="${esc(x.help)}"` : '');
      const body = o.length <= 4 ? `<div class="seg">${o.map((x, i) => `<button data-i="${i}"${tt(x)}>${esc(x.label)}</button>`).join('')}</div>`
        : o.length <= 8 ? `<div class="seg wrap">${o.map((x, i) => `<button data-i="${i}"${tt(x)}>${esc(x.label)}</button>`).join('')}</div>` : `<select aria-label="${esc(lab)}">${o.map((x, i) => `<option value="${i}">${esc(x.label)}</option>`).join('')}</select>`;
      return `<div class="ct" data-k="${k}" data-t="select"${st} title="${esc(hp)}"><div class="ctl"><span class="lb">${sym}${esc(lab)}</span></div>${help}${body}</div>`;
    }
    return '';
  }
  function buildPanel(host) {
    panels = panels.filter(p => p.host !== host && p.host.isConnected);
    if (!S.rig) { host.innerHTML = '<div class="card">' + placeholderHtml() + '</div>'; return; }
    const list = ctlsOf(), groups = [], gm = {};
    list.forEach(c => { const g = c.group || 'Last und Anzeige'; if (!gm[g]) { gm[g] = { n: g, items: [] }; groups.push(gm[g]); } gm[g].items.push(c); });
    groups.sort((a, b) => { const i = GROUPS.indexOf(a.n), j = GROUPS.indexOf(b.n); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
    host.innerHTML = `<p class="hint2" style="margin:6px 4px 4px">Alle Bauteilwerte sind Übungswerte (A). Mit ✓ belegt sind nur Werte aus Prüfungspool oder vom Ausbilder.</p>` + groups.map((g, i) => {
      const s0 = (g.items.find(c => c.stufe) || {}).stufe, col = stufeColor(s0);
      return `<details class="card ctg" style="--lc:${col}"${i < 3 ? ' open' : ''}><summary>${s0 ? `<i class="sb" aria-hidden="true">${esc(stufeSym(s0))}</i>` : ''}${esc(g.n)}</summary><div class="cb">${g.items.map(ctlHtml).join('')}</div></details>`;
    }).join('');
    const els = {}; $$('.ct[data-k]', host).forEach(el => { els[el.dataset.k] = { el, t: el.dataset.t, last: undefined, vis: true }; });
    panels.push({ host, els }); wirePanel(host); syncCtl(true);
  }
  function buildControls() { buildPanel($('#ctlHost')); }
  /* Würfel-Fehler (fehler = zufall): Die Auswahl zeigt "Zufall" statt der gewürfelten Id, bis aufgelöst, behoben oder eine Diagnose abgegeben ist */
  function faultHidden(st) {
    if (S.rigId !== 'fehler' || !st || st.zufall !== true) return false;
    return !(st.behoben || S.diagnose || (S.dice && S.dice.shown));
  }
  function syncCtl(force) {
    if (!S.rig) return;
    const st = S.st || readState();
    panels = panels.filter(p => p.host.isConnected);
    panels.forEach(p => ctlsOf().forEach(c => {
      const x = p.els[c.key]; if (!x) return;
      if (typeof c.visible === 'function') { let vis = true; try { vis = !!c.visible(st || {}); } catch (e) {} if (vis !== x.vis) { x.vis = vis; x.el.hidden = !vis; } }
      if (c.type === 'button') return;
      let v; try { v = S.rig.getControl(c.key); } catch (e) { return; }
      if (c.key === 'fehler' && faultHidden(st)) v = 'zufall';
      if (!force && x.last === v) return; x.last = v; const el = x.el;
      if (c.type === 'slider') {
        const inp = $('input[type=range]', el), num = $('.num', el), un = $('.un', el), n = +v;
        if (fin(n)) { if (document.activeElement !== inp || force) inp.value = slPosOf(c, n); if (document.activeElement !== num || force) num.value = ctlShow(c, n); }
        un.textContent = c.unit || '';
      } else if (c.type === 'switch') $('button', el).setAttribute('aria-checked', v ? 'true' : 'false');
      else if (c.type === 'select') {
        const o = optsOf(c), i = o.findIndex(q => q.value === v || String(q.value) === String(v));
        $$('.seg button', el).forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
        const sel = $('select', el); if (sel && i >= 0) sel.value = String(i);
      }
    }));
  }
  function wirePanel(H) {
    H.addEventListener('input', e => {
      const inp = e.target.closest('input[type=range]'); if (!inp) return; const el = inp.closest('.ct'), c = ctlDef(el.dataset.k); if (c) setCtl(c.key, slVal(c, +inp.value));
    });
    H.addEventListener('change', e => {
      const num = e.target.closest('input.num'), sel = e.target.closest('select');
      if (num) { const el = num.closest('.ct'), c = ctlDef(el.dataset.k); if (!c) return; const v = parseNum(num.value); if (fin(v)) setCtl(c.key, v); syncCtl(true); return; }
      if (sel) { const el = sel.closest('.ct'), c = ctlDef(el.dataset.k); if (c) setCtl(c.key, optsOf(c)[+sel.value].value); }
    });
    H.addEventListener('click', e => {
      const sw = e.target.closest('.sw'), sg = e.target.closest('.seg button'), bt = e.target.closest('button.bt');
      if (sw) { const k = sw.closest('.ct').dataset.k; setCtl(k, !S.rig.getControl(k)); clickSnd('click'); }
      else if (sg) { const el = sg.closest('.ct'), c = ctlDef(el.dataset.k); if (c) { setCtl(c.key, optsOf(c)[+sg.dataset.i].value); clickSnd('tick'); } }
      else if (bt) { const k = bt.closest('.ct').dataset.k; setCtl(k, true); clickSnd('click'); }
    });
  }

  /* ---- Grenzwerte und ihr Status (Quelle: NTS_CORE.limits) ---- */
  function buildLimits() {
    const H = $('#limList'); if (!H) return; const C = CORE(), L = C && Array.isArray(C.limits) ? C.limits : [];
    if (!L.length) { H.innerHTML = '<p class="hint2" style="padding:6px 10px">Die Grenzwerte (NTS_CORE.limits) sind noch nicht geladen.</p>'; return; }
    H.innerHTML = L.map(l => `<div class="lim"><span>${esc(l.text || l.id)}</span><span><b>${esc((l.cmp && l.cmp !== '=' ? l.cmp.replace('<=', '≤').replace('>=', '≥') + ' ' : '') + fauto(l.value))} ${esc(l.unit || '')}</b> ${l.status === 'belegt' ? '<span class="bdg ok">✓ belegt</span>' : '<span class="bdg uw">(A) Übungswert</span>'}</span><small>${l.status === 'belegt' ? 'Quelle: ' + esc(l.quelle || '—') : 'Übungswert' + (l.frage ? ', Frage ' + esc(l.frage) + ' an den Ausbilder' : '')}</small></div>`).join('');
  }

  /* ============================================================ Messgeräte aus rig.meters */
  let mEls = [];
  function buildMeters() {
    const H = $('#meters'); mEls = [];
    if (!S.rig) { H.innerHTML = ''; return; }
    const ms = metersOf();
    H.innerHTML = ms.map((m, i) => `<button class="mt" data-i="${i}" aria-label="${esc(m.label || m.key)}: Erklärung anzeigen"><span class="qi" aria-hidden="true">i</span><div class="lbl">${esc(m.label || m.key)}</div><div class="num"><span class="v">–</span><small>${esc(m.unit || '')}</small></div></button>`).join('');
    mEls = $$('.mt', H).map((el, i) => ({ el, m: ms[i], v: $('.v', el), txt: '', warn: false, vis: true }));
  }
  $('#meters').addEventListener('click', e => { const b = e.target.closest('.mt'); if (b) meterHelp(+b.dataset.i); });
  const mdig = (m, t) => (m.digits != null ? m.digits : adig(t));
  function meterHelp(i) {
    const m = metersOf()[i]; if (!m || !S.rig) return;
    const val = (() => { try { return (S.rig.readMeters() || {})[m.key]; } catch (e) { return NaN; } })();
    sheet(m.label || m.key, b => {
      b.innerHTML = `<p style="margin-top:0">Aktueller Wert: <b>${fnum(val, mdig(m, val))} ${esc(m.unit || '')}</b></p>` + (m.help ? `<p class="hint2">${esc(m.help)}</p>` : '') + '<p class="hint2">Die Zahl kommt aus derselben Rechnung wie das Bild. Im Tab „Rechnen“ kannst du den Weg mit eigenen Werten nachrechnen.</p>';
    });
  }
  function updateMeters() {
    if (!S.rig || !mEls.length) return;
    let vals; try { vals = S.rig.readMeters() || {}; } catch (e) { return; }
    const st = S.st;
    mEls.forEach(x => {
      if (typeof x.m.visible === 'function') { let vis = true; try { vis = !!x.m.visible(st || {}); } catch (e) {} if (vis !== x.vis) { x.vis = vis; x.el.style.display = vis ? '' : 'none'; } }
      const t = vals[x.m.key]; if (!fin(t)) return;
      const txt = fnum(t, mdig(x.m, t)); if (txt !== x.txt) { x.txt = txt; x.v.textContent = txt; }
      const wn = fin(+x.m.warnAbove) && t > +x.m.warnAbove; if (wn !== x.warn) { x.warn = wn; x.el.classList.toggle('warn', wn); }
    });
  }

  /* ============================================================ Zeichenfläche (Anlage) und Zeigerereignisse */
  const cvs = $('#cv'), g2 = cvs.getContext('2d'), cvw = $('#cvw');
  let cw = 0, ch = 0, dpr = 1;
  const cvfx = document.createElement('canvas'); cvfx.id = 'cvfx'; cvfx.setAttribute('aria-hidden', 'true'); cvfx.style.pointerEvents = 'none'; cvw.appendChild(cvfx);
  const fxg = cvfx.getContext('2d'); let fxDrew = false;
  function worldSz() {
    let ws = null; try { const w = S.rig && S.rig.worldSize; ws = typeof w === 'function' ? w.call(S.rig, cvw.clientWidth) : w; } catch (e) {}
    if (!(ws && ws.w > 0 && ws.h > 0)) ws = { w: 1000, h: 560 };
    return ws;
  }
  function fitCanvas() {
    const ws = worldSz(), ar = ws.w + '/' + ws.h; if (cvw.style.aspectRatio !== ar) cvw.style.aspectRatio = ar;
    cvw.style.maxHeight = ws.h > ws.w ? '78vh' : '';
    const w = cvw.clientWidth, h = cvw.clientHeight; if (!w || !h) return;
    dpr = Math.min(2, root.devicePixelRatio || 1); const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; }
    if (cvfx.width !== W || cvfx.height !== H) { cvfx.width = W; cvfx.height = H; }
    cw = w; ch = h; S.needDraw = true;
  }
  if (root.ResizeObserver) new ResizeObserver(() => { fitCanvas(); blkSig = ''; }).observe(cvw);
  root.addEventListener('resize', () => { fitCanvas(); blkSig = ''; redrawTab(); updateMeters(); });
  const bgOf = () => (getComputedStyle(document.documentElement).getPropertyValue('--cv') || '#14181c').trim();
  function drawOpts() {
    const o = { quality: S.qEff, reduced: reducedMotion() };
    if (S.ref && S.ref.rig === S.rigId && (S.cmp || S.wipe)) { o.ghost = ghostOf(); if (S.wipe) o.wipe = S.wipeAt; }
    return o;
  }
  function drawRig() {
    if (!cw || cvw.offsetParent === null) return;
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.fillStyle = bgOf(); g2.fillRect(0, 0, cw, ch);
    if (!S.rig) { g2.fillStyle = '#8d99a6'; g2.font = '600 16px system-ui'; g2.textAlign = 'center'; g2.fillText('Prüfstand noch nicht geladen', cw / 2, ch / 2); return; }
    const t0 = performance.now();
    try { S.rig.draw(g2, cw, ch, S.animT, drawOpts()); }
    catch (e) { if (!drawErr) { drawErr = true; console.error('Zeichnung des Prüfstands:', e); } }
    qNote(performance.now() - t0);
  }
  const cvPos = e => { const r = cvs.getBoundingClientRect(); return [(e.clientX - r.left) * cw / (r.width || 1), (e.clientY - r.top) * ch / (r.height || 1)]; };
  /* hitTest liefert { key, kind:'switch'|'drag'|'info', to?, value?, set?, also? } oder { point } (Messpunkt antippen); Welt-Koordinaten rechnet der Prüfstand */
  function applyHit(h) {
    if (!h || typeof h !== 'object' || S.readonly) return false;
    if (h.point !== undefined || h.messpunkt !== undefined) { setCtl('messpunkt', h.point !== undefined ? h.point : h.messpunkt); return true; }
    ['set', 'also'].forEach(k => { if (h[k] && typeof h[k] === 'object') Object.keys(h[k]).forEach(q => setCtl(q, h[k][q], true)); });
    if (h.key) { const v = h.to !== undefined ? h.to : h.value; if (v !== undefined) return setCtl(h.key, v); }
    return true;
  }
  cvs.addEventListener('pointerdown', e => {
    e.preventDefault(); const r = S.rig; if (!r || typeof r.hitTest !== 'function') return;
    const [x, y] = cvPos(e); let h = null; try { h = r.hitTest(x, y, cw, ch); } catch (er) { h = null; } if (!h) return;
    if (h.kind === 'info') toast((h.title ? h.title + ': ' : '') + (h.text || '')); else { applyHit(h); clickSnd('click'); if (S.rigId === 'fehler' && (h.point !== undefined || h.messpunkt !== undefined)) fireRig(); }
  });
  cvs.addEventListener('pointermove', e => { const r = S.rig; if (!r || e.pointerType !== 'mouse' || typeof r.hitTest !== 'function') return; const [x, y] = cvPos(e); let h = null; try { h = r.hitTest(x, y, cw, ch); } catch (er) {} cvs.style.cursor = h ? 'pointer' : 'default'; });
  cvs.addEventListener('contextmenu', e => e.preventDefault());

  /* ---- Bildqualität: automatisch nach der Bildzeit, oder fest (nts.q) ---- */
  const qs = { n: 0, sum: 0, t: 0 };
  function qNote(ms) {
    if (S.q !== 'auto') return; qs.n++; qs.sum += ms; const now = performance.now(); if (now - qs.t < 2000 || qs.n < 20) return;
    const mean = qs.sum / qs.n; qs.n = 0; qs.sum = 0; qs.t = now; const i = QUAL.indexOf(S.qEff);
    if (mean > 14 && i < QUAL.length - 1) { S.qEff = QUAL[i + 1]; buildQLine(); } else if (mean < 5 && i > 0) { S.qEff = QUAL[i - 1]; buildQLine(); }
  }
  function buildQLine() {
    const el = $('#qLine'); if (!el) return;
    el.innerHTML = `<span>Bildqualität:</span><span class="seg" role="group" aria-label="Bildqualität">${['auto'].concat(QUAL).map(q => `<button data-q="${q}" class="${S.q === q ? 'on' : ''}" aria-pressed="${S.q === q}">${q === 'auto' ? 'automatisch' : q}</button>`).join('')}</span><span>jetzt: <b>${esc(S.qEff)}</b>${reducedMotion() ? ' · Standbild (Bewegung reduziert)' : ''}</span>`;
  }
  $('#qLine').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (!b) return; S.q = b.dataset.q; lsPut('nts.q', S.q); if (QUAL.includes(S.q)) S.qEff = S.q; buildQLine(); S.needDraw = true; blkSig = ''; });

  /* ============================================================ Hinweisband, Ampelzeile, Pfad, Blockschaltbild mit Leistungsbilanz */
  function buildSimBand() {
    const el = $('#simBand'), tx = $('#simTx'); if (!el) return;
    tx.textContent = simOnlyText(); const sn = seenObj(), closed = !!(sn.sim && sn.sim[S.rigId]);
    el.hidden = closed || !S.rig;
  }
  $('#simX').onclick = () => { const sn = seenObj(); sn.sim = sn.sim && typeof sn.sim === 'object' ? sn.sim : {}; sn.sim[S.rigId] = 1; lsSet('nts.seen', sn); $('#simBand').hidden = true; };
  let ampSig = '';
  function updateAmpel(force) {
    const el = $('#ampRow'); if (!el) return;
    let a = null; if (S.rig && typeof S.rig.assess === 'function') { try { a = S.rig.assess(); } catch (e) { a = null; } }
    const i = ampInfo(a && a.ampel), tx = a && a.text ? String(a.text) : (S.rig ? '' : 'Prüfstand noch nicht geladen.');
    const mg = a && fin(a.margin) ? a.margin : null;
    const sig = i.state + '|' + tx + '|' + mg; if (!force && sig === ampSig) return; ampSig = sig;
    const prev = S.amp; S.amp = i.state;
    el.className = 'amprow ' + i.cls;
    el.innerHTML = `<span class="asym" aria-hidden="true">${esc(i.sym)}</span><span class="atx"><b>${esc(i.text)}</b><small class="nt">${esc(tx)}</small><small>${esc(ampelNote())}</small></span>${mg != null ? `<span class="avs"><span>Marge</span><b style="color:var(--fg)">${fnum(mg, 2)}</b></span>` : ''}`;
    const cvEl = $('#cv'); if (cvEl) { let t = ''; try { t = DRAW() && DRAW().ariaText ? DRAW().ariaText(i.state, tx) : i.text + '. ' + tx; } catch (e) { t = i.text; } cvEl.setAttribute('aria-label', t); }
    if (!force && S.ampSeen) ampelFx(prev, i.state, tx); S.ampSeen = true;
  }
  function pfadHtml() {
    const p = S.rig && S.rig.pfad; if (!p) return '';
    return `<b>Pfad:</b> ${esc(p.quelle || '')} → ${esc(p.wandlung || '')} → ${esc(p.senke || '')} <span class="bdg">${esc(ART[p.art] || p.art || '')}</span>`;
  }
  let blkSig = '';
  const blk = $('#blk');
  function updateBlock(force) {
    if (!S.rig || S.tab !== 'rig') return;
    let b = null; try { b = typeof S.rig.bilanz === 'function' ? S.rig.bilanz() : null; } catch (e) { b = null; }
    const sig = JSON.stringify(b && [b.pzu, b.pab, b.eta, (b.pv || []).map(x => [x.stufe, x.w])]) + S.qEff + theme() + blk.clientWidth; if (!force && sig === blkSig) return; blkSig = sig;
    $('#pfadBar').innerHTML = pfadHtml();
    const tx = $('#blkTx');
    if (!b || !fin(b.pzu) || !fin(b.pab)) { tx.textContent = 'Die Leistungsbilanz (rig.bilanz) liefert zurzeit keine Zahlen.'; const g = blk.getContext('2d'); g.clearRect(0, 0, blk.width, blk.height); return; }
    const pv = (b.pv || []).filter(x => x && fin(x.w) && STUF()[x.stufe]), sum = pv.reduce((s, x) => s + x.w, 0);
    tx.innerHTML = `<b>P_zu</b> ${fauto(b.pzu)} W − <b>P_V</b> ${fauto(sum)} W = <b>P_ab</b> ${fauto(b.pab)} W${fin(b.eta) ? ` · <b>η</b> ${fnum(b.eta * 100, 1)} %` : ''}<br>${pv.map(x => `<span class="sb" style="--lc:${stufeColor(x.stufe)}" aria-hidden="true">${esc(stufeSym(x.stufe))}</span> ${esc(stufeName(x.stufe))}: ${fauto(x.w)} W`).join(' · ')}`;
    const w = blk.clientWidth, h = blk.clientHeight; if (!w || !h) return;
    const d = Math.min(2, root.devicePixelRatio || 1); if (blk.width !== Math.round(w * d) || blk.height !== Math.round(h * d)) { blk.width = Math.round(w * d); blk.height = Math.round(h * d); }
    const g = blk.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
    const D = DRAW(); if (!D || !D.blockDiagram) { g.fillStyle = '#8d99a6'; g.font = '14px system-ui'; g.fillText('Blockschaltbild: ntsdraw.js ist nicht geladen', 8, 24); return; }
    const ok = D.blockDiagram(g, { x: 0, y: 0, w, h }, { pIn: b.pzu, pOut: b.pab, eta: fin(b.eta) ? b.eta : undefined, blocks: pv.map(x => ({ stufe: x.stufe, pLoss: x.w })) }, { theme: theme(), q: S.qEff, reduced: reducedMotion(), t: S.animT / 1000 });
    if (!ok) { g.fillStyle = '#8d99a6'; g.font = '14px system-ui'; g.fillText('Das Blockschaltbild konnte nicht gezeichnet werden.', 8, 24); }
  }
  /* Verweise: Kühlung (nur Linearregler ab Schwelle), Entstörung (nur getaktet), Sicherheitsregeln (Fehlersuche) */
  function updateLinks() {
    const el = $('#linkBar'); if (!el) return; let h = '';
    const art = S.rig && S.rig.pfad && S.rig.pfad.art; let pv = 0, th = 1;
    try { const b = S.rig && S.rig.bilanz ? S.rig.bilanz() : null; pv = b && Array.isArray(b.pv) ? b.pv.reduce((s, x) => s + (fin(x.w) ? x.w : 0), 0) : 0; } catch (e) {}
    try { const l = CORE() && CORE().limit ? CORE().limit('pv_therm') : null; if (l && fin(l.value)) th = l.value; } catch (e) {}
    if (art === 'linear' && pv >= th) h += '<a class="btn" href="thmlab.html">🌡 Kühlung im Thermik-Lab</a>';
    if (art === 'getaktet') h += '<a class="btn" href="emvlab.html">📡 Entstörung im EMV-Lab</a>';
    if (S.rigId === 'fehler') h += '<a class="btn" href="elslab.html">🛡 Sicherheitsregeln im Sicherheits-Lab</a>';
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  }

  /* ============================================================ Vorher/Nachher (Vorher merken = M, nebeneinander = V, Wischer = W) */
  function mkRefFromCtl(rigId, ctl) {
    const d = defOf(rigId); if (!d) return null; let r = null;
    try { r = d.create({}); } catch (e) { return null; }
    const keys = Object.keys(ctl || {}).sort((a, b) => SELFIRST(ctlDef(a, listOf(r.controls, d.controls))) - SELFIRST(ctlDef(b, listOf(r.controls, d.controls))));
    keys.forEach(k => { try { const c = ctlDef(k, listOf(r.controls, d.controls)), v = coerce(c, ctl[k]); if (v !== undefined) r.setControl(k, v); } catch (e) {} });
    return refOfRig(rigId, r);
  }
  function refOfRig(rigId, r) {
    let snap = null, meters = {}, a = null, bi = null, ctl = {};
    try { snap = r.snapshot(); } catch (e) {} try { meters = r.readMeters() || {}; } catch (e) {} try { a = r.assess(); } catch (e) {} try { bi = r.bilanz(); } catch (e) {}
    listOf(r.controls, (defOf(rigId) || {}).controls).forEach(c => { try { const v = r.getControl(c.key); if (v !== undefined && c.type !== 'button') ctl[c.key] = rnd6(v); } catch (e) {} });
    return { rig: rigId, snap, ctl, meters, ampel: a && a.ampel, text: a && a.text, bilanz: bi };
  }
  function setRef(on) {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return false; }
    if (on === false || (on === undefined && S.ref)) { clearRef(); toast('Vorher gelöscht'); return false; }
    S.ref = refOfRig(S.rigId, S.rig); S.refRig = null; S.dirty = true; stat('ntsref', 1, 'max'); buildBa(); drawCmp(); S.needDraw = true; saveCurSoon();
    toast('Vorher gemerkt. Ändere jetzt etwas und tippe auf „Vorher und Nachher“ (Taste V).'); return true;
  }
  function clearRef(quiet) { S.ref = null; S.refRig = null; S.cmp = false; S.wipe = false; if (!quiet) { buildBa(); drawCmp(); S.needDraw = true; saveCurSoon(); } else { buildBa(); drawCmp(); } }
  function refState() { return S.ref ? { rig: S.ref.rig, ctl: S.ref.ctl } : null; }
  /* Vorher als eigener Prüfstand (für die Zeichnung und für Erweiterungen); wird nur bei Bedarf erzeugt */
  function ghostOf() {
    if (!S.ref) return null;
    if (!S.refRig) { const d = defOf(S.ref.rig); if (d) { try { S.refRig = d.create({}); S.refRig.restore(S.ref.snap); } catch (e) { S.refRig = null; } } }
    return { rig: S.refRig, snapshot: S.ref.snap, meters: S.ref.meters, ampel: S.ref.ampel, bilanz: S.ref.bilanz };
  }
  function toggleCmp() { if (!S.ref) { toast('Merke zuerst einen Vorher-Stand (Taste M).'); return; } S.cmp = !S.cmp; buildBa(); drawCmp(); S.needDraw = true; }
  function toggleWipe() { if (!S.ref) { toast('Merke zuerst einen Vorher-Stand (Taste M).'); return; } S.wipe = !S.wipe; buildBa(); S.needDraw = true; }
  function buildBa() {
    const el = $('#baBar'); if (!el) return; const w = $('#wipeBar');
    const has = !!(S.ref && S.ref.rig === S.rigId);
    el.innerHTML = `<button class="chip s" data-ba="mark" title="Taste M">📌 Vorher merken</button><button class="chip s${S.cmp ? ' on' : ''}" data-ba="cmp"${has ? '' : ' disabled'} aria-pressed="${S.cmp}" title="Taste V">⇄ Vorher und Nachher</button><button class="chip s${S.wipe ? ' on' : ''}" data-ba="wipe"${has ? '' : ' disabled'} aria-pressed="${S.wipe}" title="Taste W">↔ Wischer</button>${has ? '<button class="chip s danger" data-ba="clear">Vorher löschen</button>' : ''}<button class="chip s" data-ba="dice" title="Einen Fehler auswürfeln und die Ursache suchen">🎲 Fehler-Würfel</button>`;
    w.hidden = !(S.wipe && has); w.style.setProperty('--wp', (S.wipeAt * 100) + '%'); w.setAttribute('aria-valuenow', Math.round(S.wipeAt * 100));
  }
  $('#baBar').addEventListener('click', e => { const b = e.target.closest('[data-ba]'); if (!b || b.disabled) return; const a = b.dataset.ba; if (a === 'mark') setRef(true); else if (a === 'cmp') toggleCmp(); else if (a === 'wipe') toggleWipe(); else if (a === 'clear') { clearRef(); toast('Vorher gelöscht'); } else if (a === 'dice') diceRoll(); });
  (function () {
    const w = $('#wipeBar'); let drag = null;
    const setAt = e => { const r = cvw.getBoundingClientRect(); S.wipeAt = clamp((e.clientX - r.left) / (r.width || 1), 0, 1); w.style.setProperty('--wp', (S.wipeAt * 100) + '%'); w.setAttribute('aria-valuenow', Math.round(S.wipeAt * 100)); S.needDraw = true; };
    w.addEventListener('pointerdown', e => { drag = e.pointerId; try { w.setPointerCapture(e.pointerId); } catch (x) {} setAt(e); e.preventDefault(); });
    w.addEventListener('pointermove', e => { if (drag === e.pointerId) setAt(e); });
    w.addEventListener('pointerup', () => { drag = null; }); w.addEventListener('pointercancel', () => { drag = null; });
    w.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { S.wipeAt = clamp(S.wipeAt + (e.key === 'ArrowLeft' ? -0.05 : 0.05), 0, 1); w.style.setProperty('--wp', (S.wipeAt * 100) + '%'); w.setAttribute('aria-valuenow', Math.round(S.wipeAt * 100)); S.needDraw = true; e.preventDefault(); } });
  })();
  let cmpSig = '';
  function drawCmp() {
    const el = $('#cmpHost'); if (!el) return;
    if (!(S.cmp && S.ref && S.ref.rig === S.rigId && S.rig)) { if (el.innerHTML) el.innerHTML = ''; cmpSig = ''; return; }
    let now = {}, a = null; try { now = S.rig.readMeters() || {}; } catch (e) {} try { a = S.rig.assess(); } catch (e) {}
    const ms = metersOf(), rows = ms.map(m => { const v0 = S.ref.meters[m.key], v1 = now[m.key]; return { m, v0, v1 }; }).filter(r => fin(r.v0) || fin(r.v1));
    const sig = JSON.stringify([rows.map(r => [r.v0, r.v1]), a && a.ampel]); if (sig === cmpSig) return; cmpSig = sig;
    const a0 = ampInfo(S.ref.ampel), a1 = ampInfo(a && a.ampel);
    el.innerHTML = `<div class="card pl"><h4>Vorher und Nachher</h4><div class="cmpt"><table class="kt"><tr><th>Messgerät</th><th class="n">Vorher</th><th class="n">Nachher</th><th class="n">Änderung</th></tr>${rows.map(r => `<tr><td>${esc(r.m.label || r.m.key)}</td><td class="n">${fin(r.v0) ? fnum(r.v0, mdig(r.m, r.v0)) : '–'} ${esc(r.m.unit || '')}</td><td class="n">${fin(r.v1) ? fnum(r.v1, mdig(r.m, r.v1)) : '–'} ${esc(r.m.unit || '')}</td><td class="n">${fin(r.v0) && fin(r.v1) ? (r.v1 - r.v0 >= 0 ? '+' : '') + fnum(r.v1 - r.v0, mdig(r.m, r.v1 - r.v0)) : '–'}</td></tr>`).join('')}<tr><td>Ampel</td><td class="n">${esc(a0.sym + ' ' + a0.text.split(':')[0])}</td><td class="n">${esc(a1.sym + ' ' + a1.text.split(':')[0])}</td><td class="n"></td></tr></table></div><p class="hint2">Vorher ist der Stand, den du mit „Vorher merken“ festgehalten hast; Nachher ist der Stand jetzt.</p></div>`;
  }

  /* ---- Effekte (alles über LochFX, geschützt; nichts blinkt, nur Töne und Konfetti) ---- */
  let fxCool = {};
  function fxReset() { fxCool = {}; fxDrew = false; if (root.LochFX && root.LochFX.clear) try { root.LochFX.clear(); } catch (e) {} }
  const fxOn = () => !!(root.LochFX && !root.LochFX.isMuted());
  function ampelFx(prev, now, text) {
    const F = root.LochFX; if (!F || !S.touched) return; const ts = performance.now(); if (ts - S.lastAmpelFx < 1500) return;
    try {
      if (now === 'gruen' && prev !== 'gruen') { S.lastAmpelFx = ts; F.sound('ding', 0.35); }
      else if (now === 'rot' && prev !== 'rot') { S.lastAmpelFx = ts; F.sound('buzz', 0.2); noteFault(text); S.faultUntil = ts + 7000; S.faultText = text || ''; }
    } catch (e) { /* Effekte sind Beiwerk */ }
  }
  function noteFault(text) {
    const key = S.rigId + ':' + String(text || '').slice(0, 28);
    const a = lsGet('nts.faults', []), s = new Set(Array.isArray(a) ? a : []); if (s.has(key)) return;
    s.add(key); lsSet('nts.faults', [...s]); stat('ntsfault', s.size, 'max');
  }
  function fxFrame() {
    const F = root.LochFX; if (!F || !F.draw || !cw) return;
    try {
      const act = F.active ? F.active() : true;
      if (act) { fxg.setTransform(dpr, 0, 0, dpr, 0, 0); fxg.clearRect(0, 0, cw, ch); F.draw(fxg); fxDrew = true; }
      else if (fxDrew) { fxg.setTransform(1, 0, 0, 1, 0, 0); fxg.clearRect(0, 0, cvfx.width, cvfx.height); fxDrew = false; }
    } catch (e) { if (!fxFrame.err) { fxFrame.err = 1; console.error('Effekte:', e); } }
  }
  if (root.LochFX && root.LochFX.setShakeEl) try { root.LochFX.setShakeEl(cvw); } catch (e) {}
  function toggleFx() {
    const F = root.LochFX; if (!F) return; F.setMuted(fxOn()); lsPut('nts.fx', fxOn() ? '1' : '0'); updateChrome(); toast(fxOn() ? 'Effekte und Ton an' : 'Ton aus');
    if (fxOn()) F.sound('ding', 0.6);
  }

  /* ---- Meldungsliste und Hinweise aus rig.diagnose() ---- */
  const evTime = e => { const t = e && fin(+e.t) ? +e.t : 0; return fnum(t, t >= 100 ? 0 : 1) + ' s'; };
  const KIND = { error: '✗', warn: '!', info: 'i', ok: '✓' };
  function watchEvents() {
    const r = S.rig; if (!r) return; const ev = r.events || []; let changed = false;
    for (let i = Math.max(0, ev.length - 30); i < ev.length; i++) {
      const e = ev[i]; if (!e || S.evSeen.has(e)) continue; S.evSeen.add(e); changed = true;
      if (e.kind === 'error') { S.faultUntil = performance.now() + 9000; S.faultText = e.text || ''; if (S.tab !== 'rig' && S.running) toast('⚠ ' + (e.text || 'Fehler')); noteFault(e.text); }
    }
    if (changed || ev.length !== S.evLen) { S.evLen = ev.length; updateEvents(); }
  }
  function updateEvents(force) {
    const l = $('#evList'); if (!l) return; const ev = (S.rig && S.rig.events) || [];
    const sig = ev.length + '|' + (ev.length ? (ev[ev.length - 1].text || '') + (ev[ev.length - 1].t || '') : '');
    if (!force && sig === S.evSig) return; S.evSig = sig;
    l.innerHTML = ev.length ? ev.slice(-40).reverse().map(x => `<li class="${esc(x.kind || 'info')}"><span class="dk" aria-hidden="true">${esc(KIND[x.kind] || 'i')}</span><time>${esc(evTime(x))}</time><span>${esc(x.text || x.type || '')}</span></li>`).join('') : '<li class="empty">Keine Meldungen. Meldet der Prüfstand etwas (zum Beispiel eine Grenzverletzung), steht es hier.</li>';
  }
  $('#evClr').onclick = () => { if (S.rig && S.rig.events) { S.rig.events.length = 0; S.evSig = ''; updateEvents(true); } };
  let lastDiag = 0;
  function updateDiag(force) {
    const el = $('#diagList'); if (!el || !S.rig) return;
    const now = performance.now(); if (!force && now - lastDiag < 600) return; lastDiag = now;
    let d = []; try { d = typeof S.rig.diagnose === 'function' ? (S.rig.diagnose() || []) : []; } catch (e) { d = []; }
    S.diag = d;
    const h = d.length ? d.map(x => `<li class="${esc(x.kind || 'info')}"><span class="dk" aria-hidden="true">${esc(KIND[x.kind] || 'i')}</span><span>${esc(x.text || x)}</span></li>`).join('') : '<li class="empty">Keine Hinweise: Zu den aktuellen Einstellungen meldet der Prüfstand nichts.</li>';
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  }

  /* ============================================================ Simulation */
  function setRun(on, auto) {
    if (on && !S.rig) { toast('Der Prüfstand ist noch nicht geladen.'); return; }
    S.running = !!on; if (!on && !auto) S.autoRun = false; updateChrome();
    if (on) { stat('ntsrun', 1, 'max'); usedRig(); const sn = seenObj(); if (auto && !sn.autohint) { sn.autohint = 1; lsSet('nts.seen', sn); toast('Der Prüfstand läuft jetzt. Mit ⏸ unten hältst du ihn an.'); } }
  }
  function resetRig(quiet) {
    if (!S.rig) return;
    try { S.rig.reset(); } catch (e) { console.error(e); }
    S.live = null; S.ctl = {}; S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; S.clicks = []; S.diagnose = null; S.fired = false; fxReset();
    S.needDraw = true; readState(); syncCtl(true); updateMeters(); updateEvents(true); updateChrome(); buildFaultPanel(); updateAmpel(true); if (!quiet) toast('Prüfstand zurückgesetzt');
  }
  function setSpeed(v) { S.speed = v; lsPut('nts.speed', String(v)); updateChrome(); }
  /* Auslösen: Einschalten, Lastsprung, Schaltvorgang, Last anlegen oder Messung; die Anlage bestimmt, was passiert */
  function fireRig() {
    if (!S.rig || S.readonly) return false; if (typeof S.rig.fire !== 'function') { toast('Dieser Prüfstand hat keine Auslösung.'); return false; }
    let ok = true; try { ok = S.rig.fire() !== false; } catch (e) { console.error(e); ok = false; }
    S.fired = true; S.touched = true; S.dirty = true; stat('ntsfire', 1, 'max'); saveCurSoon();
    if (S.rigId === 'fehler') { const m = (() => { try { return S.rig.readMeters() || {}; } catch (e) { return {}; } })(); S.clicks.push({ point: S.rig.getControl('messpunkt'), wert: fin(m.wert) ? m.wert : null }); buildFaultPanel(); if (ok) { try { if (root.Duell && root.Duell.mess) root.Duell.mess('nts', S.rig.getControl('messpunkt')); } catch (e) { /* D4: Messung ans Duell (nur im Duell aktiv) */ } } }
    if (!S.running) setRun(true, true);
    S.needDraw = true; readState(); updateEvents(); clickSnd('click');
    if (!ok) toast('Das ging nicht: ' + (FIRE[S.rigId] || 'Auslösen') + ' ist im Moment nicht möglich.');
    return ok;
  }
  function simAdvance(dtMs) {
    const r = S.rig; if (!r) return;
    if (S.live) liveAdvance(dtMs);
    r.step(dtMs * S.speed);
  }
  function updateStat() {
    const sEl = $('#stat'); if (!sEl) return; const st = S.st || {};
    const html = (S.running ? '<b style="color:var(--ok)">LÄUFT</b> ' : '<b>PAUSE</b> ') + (fin(st.t) ? 'Zeit ' + fnum(st.t, 1) + ' s' : '') + (S.speed < 1 ? ' · Zeitlupe ×' + String(S.speed).replace('.', ',') : '') + (S.live ? ' · Ablauf ' + fnum(100 * S.live.t / S.live.end, 0) + ' %' : '');
    if (sEl.dataset.h !== html) { sEl.dataset.h = html; sEl.innerHTML = html; }
  }

  /* ============================================================ Fehlersuche (nur Prüfstand "fehler"): Sichtprüfung, Messen, Tauschen, Diagnose abgeben */
  function causeList() { const C = CORE(); let l = []; try { l = C && C.fault && Array.isArray(C.fault.catalog) ? C.fault.catalog : []; } catch (e) { l = []; } return l.map(f => ({ value: f.id, label: f.ursache ? f.name + ' · ' + f.ursache : f.name || f.id, sub: f.symptom || '' })); }
  function buildFaultPanel() {
    const H = $('#faultHost'); if (!H) return;
    if (S.rigId !== 'fehler' || !S.rig) { H.innerHTML = ''; return; }
    const log = S.clicks.slice(-8).map(c => c.sicht ? 'Sichtprüfung' : c.tausche ? 'Getauscht: ' + c.tausche : 'Messpunkt ' + esc(String(c.point)) + (c.wert != null ? ': ' + fauto(c.wert) : '')).map((t, i) => `<li>${i + 1}. ${t}</li>`).join('');
    H.innerHTML = `<div class="card pl"><h4>Fehlersuche (Simulation)</h4><p class="hint2" style="margin:0 0 6px">${esc(simOnlyText())} ${esc(TX().unterweisung || '')}</p><div class="btns" style="margin-top:0"><button class="btn" data-fa="sicht">👁 Sichtprüfung</button><button class="btn" data-fa="messen">📏 Messpunkt messen</button><button class="btn" data-fa="tausche">🔧 Bauteil tauschen</button><button class="btn pri" data-fa="diagnose">🩺 Diagnose abgeben</button></div>${log ? `<ul class="tl" style="margin-top:8px">${log}</ul>` : '<p class="hint2">Noch nichts geprüft. Beginne mit der Sichtprüfung, dann Versorgung, Zwischenkreis, Regler, Last.</p>'}${S.diagnose ? `<p class="hint2">Abgegebene Diagnose: <b>${esc(S.diagnose.label)}</b></p>` : ''}</div>`;
  }
  $('#faultHost').addEventListener('click', async e => {
    const b = e.target.closest('[data-fa]'); if (!b || !S.rig || S.readonly) return; const a = b.dataset.fa;
    if (a === 'sicht') { let r = null; if (typeof S.rig.sicht === 'function') { try { r = S.rig.sicht(); } catch (er) { r = null; } } S.clicks.push({ sicht: true }); S.dirty = true; buildFaultPanel(); toast(typeof r === 'string' && r ? r : typeof S.rig.sicht === 'function' ? 'Sichtprüfung gemacht. Siehe Meldungen.' : 'Sichtprüfung notiert. Der Prüfstand liefert dazu noch keinen Text.'); updateEvents(); }
    else if (a === 'messen') fireRig();
    else if (a === 'tausche') {
      const c = ctlDef('tausche'); if (!c) { toast('An dieser Anlage kann man nichts tauschen.'); return; }
      const v = await pick('Bauteil tauschen', optsOf(c).filter(o => o.value !== 'keins').map(o => ({ value: o.value, label: o.label }))); if (v == null) return;
      if (!await confirmSheet('Bauteil tauschen?', 'Du tauschst das Bauteil „' + esc(String((optsOf(c).find(o => o.value === v) || {}).label || v)) + '“ in der Simulation. Wenn es nicht die Ursache war, ist der Tausch umsonst.', 'Tauschen')) return;
      setCtl('tausche', v); S.clicks.push({ tausche: String(v) }); buildFaultPanel(); updateEvents();
    } else if (a === 'diagnose') {
      const opts = causeList(); if (!opts.length) { toast('Die Ursachenliste (NTS_CORE.fault.catalog) ist noch nicht geladen.'); return; }
      const v = await pick('Diagnose abgeben: Was ist die Ursache?', opts); if (v == null) return;
      const o = opts.find(x => x.value === v); S.diagnose = { id: v, label: o ? o.label : v }; S.dirty = true; if (hasCtl('diagnose')) setCtl('diagnose', v); syncCtl(true); buildFaultPanel(); toast('Diagnose abgegeben. Prüfe sie im Tab „Aufgaben“.');
    }
  });

  /* ============================================================ Sweep und Ablauf */
  function toggleSweep() { const c = $('#cSweep'); if (!c) return; if (S.tab !== 'rig') setTab('rig'); c.open = !c.open; if (c.open && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' }); }
  const sliders = () => ctlsOf().filter(c => c.type === 'slider');
  const meterList = () => metersOf().filter(m => m && m.key);
  const sw = { key: '', meter: '', from: NaN, to: NaN, n: 9 };
  function buildSweep() {
    const H = $('#sweepView'); if (!H) return;
    if (!S.rig) { H.innerHTML = placeholderHtml(); return; }
    const sl = sliders(), ml = meterList();
    if (!sl.some(c => c.key === sw.key)) { sw.key = sl.length ? sl[0].key : ''; sw.from = sl.length ? sl[0].min : NaN; sw.to = sl.length ? sl[0].max : NaN; }
    if (!ml.some(m => m.key === sw.meter)) sw.meter = ml.length ? ml[0].key : '';
    S.sweepRes = null; S.rowRes = null;
    const c0 = ctlDef(sw.key);
    H.innerHTML = `<div class="gh" style="padding-top:0">Sweep: Ein Steuerwert läuft durch seinen Bereich</div>${S.rigId === 'fehler' || !sl.length ? '<p class="hint2">An dieser Anlage gibt es keinen Sweep.</p>' : `<div class="fl"><select id="swKey" aria-label="Steuerwert">${sl.map(c => `<option value="${esc(c.key)}"${c.key === sw.key ? ' selected' : ''}>${esc(c.label || c.key)}</option>`).join('')}</select><select id="swMeter" aria-label="Messgerät">${ml.map(m => `<option value="${esc(m.key)}"${m.key === sw.meter ? ' selected' : ''}>${esc(m.label || m.key)}</option>`).join('')}</select></div>
      <div class="fl"><label class="f" style="margin:0;flex:1 1 90px"><span>von ${c0 && c0.unit ? '(' + esc(c0.unit) + ')' : ''}</span><input id="swFrom" inputmode="decimal" value="${esc(ctlShow(c0, sw.from))}"></label><label class="f" style="margin:0;flex:1 1 90px"><span>bis</span><input id="swTo" inputmode="decimal" value="${esc(ctlShow(c0, sw.to))}"></label><label class="f" style="margin:0;flex:1 1 70px"><span>Punkte (3 bis 40)</span><input id="swN" inputmode="numeric" value="${sw.n}"></label></div>
      <div class="btns" style="margin-top:4px"><button class="btn pri" id="swGo">Sweep rechnen</button></div><div id="swOut"></div>`}
      <div class="gh">Ablauf: Schritte mit Zeit, vom Kern gerechnet (runSeq)</div><div id="rowHost"></div><div class="btns" style="margin-top:4px"><button class="btn" id="rowAdd">＋ Schritt</button><button class="btn pri" id="rowGo"${S.rows.length ? '' : ' disabled'}>Ablauf rechnen</button><button class="btn" id="rowLive"${S.rows.length ? '' : ' disabled'}>▶ Live abspielen</button></div><div id="rowOut"></div>`;
    buildRows();
  }
  $('#cSweep').addEventListener('toggle', () => { /* nur Zustand der Seite */ });
  function sweepRun() {
    const c = ctlDef(sw.key), d = defOf(S.rigId); if (!c || !d) return;
    let a = parseNum($('#swFrom').value), b = parseNum($('#swTo').value), n = Math.round(parseNum($('#swN').value));
    if (!fin(a) || !fin(b) || !fin(n)) { toast('Bitte Zahlen für von, bis und Punkte eingeben.'); return; }
    n = clamp(n, 3, 40); a = clamp(a, c.min, c.max); b = clamp(b, c.min, c.max); if (a === b) { toast('Von und bis sind gleich. Wähle einen Bereich.'); return; }
    sw.from = a; sw.to = b; sw.n = n;
    let tmp = null; try { tmp = d.create({}); tmp.restore(S.rig.snapshot()); } catch (e) { toast('Der Sweep braucht einen zweiten Prüfstand; er konnte nicht erzeugt werden.'); return; }
    const pts = []; const log = c.scale === 'log' && a > 0 && b > 0;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1), x = log ? a * Math.pow(b / a, f) : a + (b - a) * f; let y = NaN;
      try { tmp.setControl(sw.key, x); y = (tmp.readMeters() || {})[sw.meter]; } catch (e) { y = NaN; }
      pts.push([+tmp.getControl(sw.key), y]);
    }
    S.sweepRes = { key: sw.key, meter: sw.meter, pts }; drawSweep();
  }
  function drawSweep() {
    const o = $('#swOut'); if (!o || !S.sweepRes) return; const R = S.sweepRes, c = ctlDef(R.key), m = meterList().find(q => q.key === R.meter) || {};
    const ok = R.pts.filter(p => fin(p[0]) && fin(p[1]));
    if (ok.length < 2) { o.innerHTML = '<p class="hint2">Der Prüfstand lieferte keine Zahlen für diesen Bereich.</p>'; return; }
    o.innerHTML = `<div class="chartbox"><canvas id="swCv" aria-label="Sweep: ${esc(m.label || R.meter)} über ${esc(c ? c.label : R.key)}"></canvas></div><div class="nts-tbl"><table><tr><th>${esc(c ? c.label : R.key)} (${esc(c && c.unit || '')})</th><th>${esc(m.label || R.meter)} (${esc(m.unit || '')})</th></tr>${R.pts.map(p => `<tr><td>${fauto(p[0])}</td><td>${fauto(p[1])}</td></tr>`).join('')}</table></div>`;
    const cv = $('#swCv', o); const w = cv.clientWidth || 320, h = Math.round(w / (w < 520 ? 1.4 : 2.2)); cv.style.height = h + 'px'; const d = Math.min(2, root.devicePixelRatio || 1); cv.width = Math.round(w * d); cv.height = Math.round(h * d);
    const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); const css = getComputedStyle(document.documentElement), col = n => css.getPropertyValue(n).trim();
    const xs = ok.map(p => p[0]), ys = ok.map(p => p[1]); let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); if (y1 === y0) { y1 += 1; y0 -= 1; } const pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad;
    const L = 46, T = 10, Rr = 10, B = 28, pw = w - L - Rr, ph = h - T - B, X = x => L + (x1 === x0 ? 0 : (x - x0) / (x1 - x0)) * pw, Y = y => T + (1 - (y - y0) / (y1 - y0)) * ph;
    g.fillStyle = col('--well') || '#10151a'; g.fillRect(0, 0, w, h); g.strokeStyle = col('--chart-grid') || '#333'; g.lineWidth = 1; g.fillStyle = col('--mute') || '#999'; g.font = '11px system-ui'; g.textAlign = 'right';
    for (let i = 0; i <= 4; i++) { const yy = T + ph * i / 4; g.beginPath(); g.moveTo(L, yy); g.lineTo(L + pw, yy); g.stroke(); g.fillText(fauto(y1 - (y1 - y0) * i / 4), L - 4, yy + 4); }
    g.textAlign = 'center'; for (let i = 0; i <= 4; i++) { const xx = L + pw * i / 4; g.fillText(fauto(x0 + (x1 - x0) * i / 4), xx, h - 12); }
    g.fillText((c ? c.label : '') + (c && c.unit ? ' in ' + c.unit : ''), L + pw / 2, h - 1);
    g.strokeStyle = col('--accent') || '#3b9eff'; g.lineWidth = 2; g.beginPath(); ok.forEach((p, i) => { const px = X(p[0]), py = Y(p[1]); if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.stroke();
    g.fillStyle = col('--accent') || '#3b9eff'; ok.forEach(p => { g.beginPath(); g.arc(X(p[0]), Y(p[1]), 3, 0, 6.283); g.fill(); });
    const cur = c ? +S.rig.getControl(c.key) : NaN; if (fin(cur) && cur >= x0 && cur <= x1) { g.strokeStyle = col('--warn') || '#fa0'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(X(cur), T); g.lineTo(X(cur), T + ph); g.stroke(); g.setLineDash([]); }
  }
  /* Ablauf: Zeilen { t, kind:'set'|'ramp'|'fire'|'do', key, value, to, durS, act } */
  const ROWKINDS = [['set', 'Setzen'], ['ramp', 'Rampe'], ['fire', 'Auslösen'], ['do', 'Aktion']];
  function cleanRow(r) {
    if (!r || typeof r !== 'object' || !fin(+r.t) || +r.t < 0) return null; const k = ['set', 'ramp', 'fire', 'do'].includes(r.kind) ? r.kind : null; if (!k) return null;
    const o = { t: rnd6(+r.t), kind: k };
    if (k === 'set') { if (typeof r.key !== 'string') return null; o.key = r.key; o.value = typeof r.value === 'number' ? rnd6(r.value) : typeof r.value === 'boolean' ? r.value : String(r.value == null ? '' : r.value); }
    else if (k === 'ramp') { if (typeof r.key !== 'string' || !fin(+r.to)) return null; o.key = r.key; o.to = rnd6(+r.to); o.durS = fin(+r.durS) && +r.durS > 0 ? rnd6(+r.durS) : 1; }
    else if (k === 'do') { if (typeof r.act !== 'string' || !r.act) return null; o.act = r.act; }
    return o;
  }
  const rowsToSeq = rows => rows.map(cleanRow).filter(Boolean).sort((a, b) => a.t - b.t).map(r => r.kind === 'set' ? { t: r.t, set: { [r.key]: r.value } } : r.kind === 'ramp' ? { t: r.t, ramp: { key: r.key, to: r.to, durS: r.durS } } : r.kind === 'fire' ? { t: r.t, fire: true } : { t: r.t, do: r.act });
  const actOptions = () => { const o = ['sicht']; const mp = ctlDef('messpunkt'), tc = ctlDef('tausche'); if (mp) optsOf(mp).forEach(x => o.push('messe:' + x.value)); if (tc) optsOf(tc).filter(x => x.value !== 'keins').forEach(x => o.push('tausche:' + x.value)); return o; };
  function valInput(r, i) {
    const c = ctlDef(r.key);
    if (c && (c.type === 'select' || c.type === 'switch')) { const o = c.type === 'switch' ? [{ value: true, label: 'an' }, { value: false, label: 'aus' }] : optsOf(c); return `<select class="vIn" data-ri="${i}" data-rf="value" aria-label="Wert">${o.map(x => `<option value="${esc(String(x.value))}"${String(r.value) === String(x.value) ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`; }
    return `<input class="vIn" data-ri="${i}" data-rf="value" inputmode="decimal" value="${esc(r.value == null ? '' : typeof r.value === 'number' ? fauto(r.value) : r.value)}" aria-label="Wert">`;
  }
  function buildRows() {
    const H = $('#rowHost'); if (!H) return; const keys = ctlsOf().filter(c => c.type !== 'button');
    if (!S.rows.length) { H.innerHTML = '<p class="hint2">Noch kein Schritt. Ein Schritt setzt einen Wert, fährt eine Rampe oder löst aus (' + esc(FIRE[S.rigId] || 'Auslösen') + ').</p>'; return; }
    H.innerHTML = S.rows.map((r, i) => {
      const kindSel = `<select data-ri="${i}" data-rf="kind" aria-label="Art">${ROWKINDS.filter(k => k[0] !== 'do' || S.rigId === 'fehler').map(k => `<option value="${k[0]}"${r.kind === k[0] ? ' selected' : ''}>${k[1]}</option>`).join('')}</select>`;
      const keySel = `<select data-ri="${i}" data-rf="key" aria-label="Steuerwert">${keys.map(c => `<option value="${esc(c.key)}"${r.key === c.key ? ' selected' : ''}>${esc(c.label || c.key)}</option>`).join('')}</select>`;
      let mid = '';
      if (r.kind === 'set') mid = keySel + valInput(r, i);
      else if (r.kind === 'ramp') mid = keySel + `<input class="vIn" data-ri="${i}" data-rf="to" inputmode="decimal" value="${esc(fauto(r.to))}" aria-label="Zielwert"><input class="vIn" data-ri="${i}" data-rf="durS" inputmode="decimal" value="${esc(fauto(r.durS))}" aria-label="Dauer in Sekunden" title="Dauer in s">`;
      else if (r.kind === 'do') mid = `<select data-ri="${i}" data-rf="act" aria-label="Aktion">${actOptions().map(a => `<option value="${esc(a)}"${r.act === a ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select>`;
      return `<div class="sqr"><span class="n">${i + 1}</span><input class="tIn" data-ri="${i}" data-rf="t" inputmode="decimal" value="${esc(fauto(r.t))}" aria-label="Zeit in Sekunden" title="Zeit in s"><small>s</small>${kindSel}${mid}<button class="ib2" data-rdel="${i}" aria-label="Schritt ${i + 1} löschen">✕</button></div>`;
    }).join('');
  }
  function addRow() {
    const keys = ctlsOf().filter(c => c.type !== 'button'); const c = keys[0], t = S.rows.length ? Math.max(...S.rows.map(r => r.t)) + 1 : 0;
    S.rows.push(S.rigId === 'fehler' ? { t, kind: 'do', act: 'sicht' } : c ? { t, kind: 'set', key: c.key, value: S.rig.getControl(c.key) } : { t, kind: 'fire' });
    S.dirty = true; buildRows(); $('#rowGo').disabled = false; $('#rowLive').disabled = false; saveCurSoon();
  }
  $('#sweepView').addEventListener('click', e => {
    if (e.target.closest('#swGo')) sweepRun(); else if (e.target.closest('#rowAdd')) addRow();
    else if (e.target.closest('#rowGo')) rowRun(); else if (e.target.closest('#rowLive')) rowLive();
    else { const d = e.target.closest('[data-rdel]'); if (d) { S.rows.splice(+d.dataset.rdel, 1); S.dirty = true; buildRows(); $('#rowGo').disabled = !S.rows.length; $('#rowLive').disabled = !S.rows.length; saveCurSoon(); } }
  });
  $('#sweepView').addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'swKey') { sw.key = t.value; const c = ctlDef(sw.key); if (c) { sw.from = c.min; sw.to = c.max; } buildSweep(); $('#cSweep').open = true; }
    else if (t.id === 'swMeter') sw.meter = t.value;
    else if (t.dataset && t.dataset.ri !== undefined) {
      const r = S.rows[+t.dataset.ri], f = t.dataset.rf; if (!r) return; let v = t.value;
      if (f === 'kind') { const k = ctlsOf().filter(c => c.type !== 'button')[0]; S.rows[+t.dataset.ri] = v === 'fire' ? { t: r.t, kind: 'fire' } : v === 'do' ? { t: r.t, kind: 'do', act: 'sicht' } : v === 'ramp' ? { t: r.t, kind: 'ramp', key: r.key || (k && k.key), to: 0, durS: 1 } : { t: r.t, kind: 'set', key: r.key || (k && k.key), value: k ? S.rig.getControl(r.key || k.key) : 0 }; buildRows(); }
      else if (f === 'key') { r.key = v; if (r.kind === 'set') r.value = S.rig.getControl(v); if (r.kind === 'ramp') r.to = +S.rig.getControl(v) || 0; buildRows(); }
      else if (f === 'value') { const c = ctlDef(r.key); if (c && c.type === 'switch') r.value = v === 'true'; else if (c && c.type === 'select') { const o = optsOf(c).find(x => String(x.value) === v); r.value = o ? o.value : v; } else { const n = parseNum(v); r.value = fin(n) ? n : r.value; t.value = fauto(r.value); } }
      else if (f === 'act') r.act = v;
      else { const n = parseNum(v); if (fin(n)) r[f] = f === 't' ? Math.max(0, n) : f === 'durS' ? Math.max(0.001, n) : n; t.value = fauto(r[f]); }
      S.dirty = true; saveCurSoon();
    }
  });
  function seqEnd(seq) { return seq.length ? Math.max(...seq.map(s => (s.t || 0) + (s.ramp ? s.ramp.durS : 0))) + 1 : 1; }
  function rowRun() {
    const C = CORE(), o = $('#rowOut'); if (!C || typeof C.runSeq !== 'function') { toast('Der Läufer (NTS_CORE.runSeq) ist nicht geladen.'); return; }
    const seq = rowsToSeq(S.rows); if (!seq.length) { toast('Es gibt keinen gültigen Schritt.'); return; }
    o.innerHTML = '<p class="hint2">Rechne …</p>';
    setTimeout(() => {
      let res = null; try { res = C.runSeq(S.rigId, seq, seqEnd(seq), { controls: allCtl(), seed: 1 }); } catch (e) { console.error('runSeq:', e); res = null; }
      if (!res || !Array.isArray(res.samples) || !res.samples.length) { o.innerHTML = '<p class="hint2" style="color:var(--warn)">Der Ablauf konnte nicht berechnet werden.</p>'; return; }
      S.rowRes = res; rowResult(res);
    }, 20);
  }
  function rowResult(res) {
    const o = $('#rowOut'); if (!o) return; const ms = meterList().slice(0, 5), n = res.samples.length, step = Math.max(1, Math.floor((n - 1) / 8)); const sel = [];
    for (let i = 0; i < n; i += step) sel.push(res.samples[i]); if (sel[sel.length - 1] !== res.samples[n - 1]) sel.push(res.samples[n - 1]);
    const a = res.assess && res.assess.ampel ? ampInfo(res.assess.ampel) : null, extra = [].concat(res.errors || [], res.rejected || []).map(x => typeof x === 'string' ? x : x && x.text ? x.text : '').filter(Boolean);
    o.innerHTML = `<div class="nts-tbl"><table><tr><th>t (s)</th>${ms.map(m => `<th>${esc(m.label || m.key)} (${esc(m.unit || '')})</th>`).join('')}</tr>${sel.map(s => `<tr><td>${fauto(s.t)}</td>${ms.map(m => `<td>${fauto((s.meters || {})[m.key])}</td>`).join('')}</tr>`).join('')}</table></div>${a ? `<p class="hint2">Ampel am Ende: <b>${esc(a.sym + ' ' + a.text)}</b>${res.assess.text ? ' · ' + esc(res.assess.text) : ''}</p>` : ''}${extra.length ? `<p class="hint2" style="color:var(--warn)">${extra.map(esc).join(' ')}</p>` : ''}`;
  }
  function rowLive() { const seq = rowsToSeq(S.rows); if (!seq.length) return; if (S.task) { toast('Beende zuerst die Aufgabe.'); return; } startLive(seq, seqEnd(seq), 'Ablauf'); }

  /* ---- Live-Ablauf: Schritte laufen auf der Uhr der Oberfläche (1 s Ablaufzeit je Sekunde, mal Zeitlupe) ---- */
  function startLive(seq, dur, label) {
    const steps = (Array.isArray(seq) ? seq : []).filter(s => s && fin(+s.t)).map(s => ({ t: +s.t, set: s.set, ramp: s.ramp, fire: s.fire, act: typeof s.do === 'string' ? s.do : null })).sort((a, b) => a.t - b.t);
    if (!steps.length) { toast('Der Ablauf ist leer.'); return false; }
    S.live = { steps, i: 0, t: 0, end: fin(+dur) && dur > 0 ? +dur : steps[steps.length - 1].t + 1, ramps: [], label: label || '' }; S.running = true; setTab('rig'); updateChrome();
    toast('Ablauf läuft live: ' + (label || '')); return true;
  }
  /* Aktion { t, do } eines Beispiel-Ablaufs (nur Prüfstand fehler): sicht, messe:<punkt>, tausche:<bauteil>, gleiche Wirkung wie die Knöpfe der Fehlersuche */
  function liveAct(name) {
    if (S.rigId !== 'fehler' || !S.rig) return false; const m = /^(sicht|messe|tausche)(?::(.+))?$/.exec(String(name || '')); if (!m || (m[1] !== 'sicht' && !m[2])) return false;
    if (m[1] === 'sicht') { try { if (typeof S.rig.sicht === 'function') S.rig.sicht(); } catch (e) { return false; } S.clicks.push({ sicht: true }); S.dirty = true; buildFaultPanel(); updateEvents(); return true; }
    if (m[1] === 'messe') { setCtl('messpunkt', m[2], true); return fireRig(); }
    setCtl('tausche', m[2], true); S.clicks.push({ tausche: m[2] }); S.dirty = true; buildFaultPanel(); updateEvents(); return true;
  }
  function liveApply() {
    const L = S.live; if (!L) return;
    while (L.i < L.steps.length && L.steps[L.i].t <= L.t + 1e-9) {
      const st = L.steps[L.i++];
      if (st.set && typeof st.set === 'object') Object.keys(st.set).forEach(k => setCtl(k, st.set[k], true));
      if (st.fire) { try { S.rig.fire(); S.fired = true; } catch (e) {} }
      if (st.act) liveAct(st.act);
      if (st.ramp && typeof st.ramp === 'object') { let from = NaN; try { from = +S.rig.getControl(st.ramp.key); } catch (e) {} L.ramps.push({ key: st.ramp.key, from, to: +st.ramp.to, t0: st.t, d: Math.max(1e-9, +st.ramp.durS || 1e-9) }); }
    }
    L.ramps = L.ramps.filter(r => { const f = clamp((L.t - r.t0) / r.d, 0, 1); if (fin(r.from)) setCtl(r.key, r.from + (r.to - r.from) * f, true); return f < 1; });
  }
  function liveAdvance(dtMs) {
    const L = S.live; L.t += dtMs / 1000 * S.speed; liveApply();
    if (L.t >= L.end) { const l = S.live; S.live = null; toast('Ablauf beendet' + (l && l.label ? ': ' + l.label : '')); updateChrome(); }
  }

  /* ============================================================ Beispiele (NTS_DATA.examples; eingebauter Rückfall ohne Zahlen im Text) */
  const B = (id, name, cat, rig, desc, controls) => ({ id, name, cat, rig, desc, controls });
  const BUILTIN = [
    B('bx-trafo', 'Transformator unter Last', 'Transformator', 'trafo', 'Der Transformator setzt die Spannung herunter. Ändere Windungen und Laststrom und beobachte die Messgeräte.', {}),
    B('bx-gleich', 'Gleichrichter mit Ladekondensator', 'Gleichrichter', 'gleich', 'Die Brücke lädt den Kondensator. Verkleinere den Kondensator und sieh, wie die Brummspannung wächst.', {}),
    B('bx-buck', 'Tiefsetzsteller', 'Schaltregler', 'buck', 'Schalter, Drossel, Diode und Kondensator wandeln die Spannung herunter.', {})
  ];
  let exCache = null;
  function exampleList() {
    if (exCache) return exCache;
    const d = root.NTS_DATA; let a = null; try { a = d && d.examples; } catch (e) { console.error('Beispiele:', e); a = null; }
    if (a && !Array.isArray(a)) a = Object.keys(a).map(k => Object.assign({ id: k }, a[k]));
    if (!a || !a.length) return BUILTIN;
    exCache = a.filter(e => e && !e.error).map(e => ({ id: e.id, name: e.name, cat: e.cat || 'Beispiele', desc: e.desc || e.text || '', rig: e.rig, controls: e.controls || {}, dur: e.dur, seq: Array.isArray(e.seq) ? e.seq : null, ref: e.ref || null }));
    return exCache.length ? exCache : BUILTIN;
  }
  function loadExample(e) {
    if (typeof e === 'string') { const n = e.toLowerCase(); e = exampleList().find(x => x.id === e || x.name.toLowerCase().includes(n)); }
    if (!e) return false; if (S.task) { toast('Beende zuerst die Aufgabe.'); return false; }
    const had = stash(); S.task = null;
    setRig(e.rig && ORDER.includes(e.rig) ? e.rig : S.rigId || ORDER[0], { run: true });
    applyCtl(e.controls); S.name = e.name; S.id = null; S.dirty = false; S.rows = [];
    if (e.ref && typeof e.ref === 'object') { const r = mkRefFromCtl(S.rigId, e.ref.controls && typeof e.ref.controls === 'object' ? e.ref.controls : e.ref); if (r) { S.ref = r; S.refRig = null; } }
    if (e.seq && e.seq.length) seqToRows(e.seq);
    setTab('rig'); buildBa(); buildSweep(); updateChrome(); saveCurSoon();
    if (e.seq && e.seq.length) startLive(e.seq, e.dur, e.name);
    toast(had ? 'Beispiel geladen, dein Versuch ist gesichert' : 'Beispiel geladen: ' + e.name);
    return true;
  }
  /* Beispiel-Ablauf in die Zeilen des Bereichs "Sweep und Ablauf" übernehmen (nur gültige Schritte) */
  function seqToRows(seq) {
    S.rows = []; (Array.isArray(seq) ? seq : []).forEach(s => {
      if (!s || !fin(+s.t)) return; let r = null;
      if (s.set && typeof s.set === 'object') Object.keys(s.set).forEach(k => { const x = cleanRow({ t: +s.t, kind: 'set', key: k, value: s.set[k] }); if (x) S.rows.push(x); });
      else if (s.ramp && typeof s.ramp === 'object') r = { t: +s.t, kind: 'ramp', key: s.ramp.key, to: +s.ramp.to, durS: +s.ramp.durS };
      else if (s.fire) r = { t: +s.t, kind: 'fire' }; else if (typeof s.do === 'string') r = { t: +s.t, kind: 'do', act: s.do };
      const c = r && cleanRow(r); if (c) S.rows.push(c);
    });
    S.rows = S.rows.slice(0, 40);
  }
  const loadExampleByName = n => loadExample(String(n || ''));
  function openExamples() {
    const ex = exampleList();
    sheet('Beispielversuche', (b, close) => {
      let last = '', h = '<p class="hint2" style="margin-top:0">Tippe ein Beispiel an: Prüfstand und Einstellungen werden geladen. Dein bisheriger Versuch wird vorher gesichert.</p>';
      ex.forEach((e, i) => { if (e.cat !== last) { last = e.cat; h += `<div class="gh">${esc(e.cat)}</div>`; } h += `<button class="row" data-i="${i}"><span style="font-size:22px;display:inline-block;width:32px;text-align:center;flex:none">${rigIcon(e.rig)}</span><div class="grow"><b>${esc(e.name)}</b><small>${esc(e.desc)}${e.seq && e.seq.length ? ' · mit Ablauf' : ''}</small></div></button>`; });
      b.innerHTML = h;
      b.addEventListener('click', ev => { const r = ev.target.closest('.row'); if (!r) return; close(); loadExample(ex[+r.dataset.i]); });
    });
  }

  /* ============================================================ Speichern, Öffnen, Teilen (Zustand = { rig, ctl, ref, rows, name } plus design) */
  const PK = 'nts.saves';
  const saves = () => { const a = lsGet(PK, []); return Array.isArray(a) ? a : []; };
  const extOf = k => root.NTS_UI_EXT && root.NTS_UI_EXT[k];
  function designState() { const D = extOf('design'); try { return D && typeof D.getState === 'function' ? D.getState() : null; } catch (e) { return null; } }
  function stateObj() {
    const ctl = allCtl(); Object.keys(ctl).forEach(k => { ctl[k] = rnd6(ctl[k]); });
    return { k: 'nts', v: 1, name: S.name, rig: S.rigId, ctl, ref: refState(), rows: S.rows.map(cleanRow).filter(Boolean), design: designState() };
  }
  const snapshot = () => stateObj();
  const snapshotJson = () => JSON.stringify(stateObj());
  function saveItem(name) {
    const a = saves(), id = S.id || uid(); S.id = id; S.name = name || S.name;
    const e = Object.assign({ id, t: Date.now() }, stateObj()); e.name = S.name;
    const i = a.findIndex(x => x.id === id); if (i >= 0) a[i] = e; else a.push(e);
    lsSet(PK, a.slice(-100)); S.dirty = false; updateChrome(); saveCur();
  }
  function stash() { if (!S.dirty || !S.rig || S.readonly) return false; if (S.task) return false; saveItem(S.name || 'Versuch'); S.id = null; return true; }
  async function doSave() {
    const r = await ask('Versuch speichern', [{ key: 'n', label: 'Name', type: 'text', value: S.name }]);
    if (!r) return; const n = r.n.trim() || 'Versuch'; saveItem(n); toast('Gespeichert: ' + n);
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
  /* Zustand ohne Aufgaben-Vorbelegung wiederherstellen; unbekannte Schlüssel und Werte werden ignoriert (Regel 8) */
  function applyItem(it, suffix) {
    if (!it || typeof it !== 'object') return false;
    S.task = null; const rid = ORDER.includes(it.rig) ? it.rig : ORDER[0];
    setRig(rid, { run: true }); applyCtl(it.ctl && typeof it.ctl === 'object' ? it.ctl : {});
    S.rows = Array.isArray(it.rows) ? it.rows.map(cleanRow).filter(Boolean).slice(0, 40) : [];
    clearRef(true); if (it.ref && typeof it.ref === 'object' && it.ref.rig === rid && it.ref.ctl && typeof it.ref.ctl === 'object') { const r = mkRefFromCtl(rid, it.ref.ctl); if (r) { S.ref = r; S.refRig = null; } }
    const D = extOf('design'); if (it.design && typeof it.design === 'object' && D && typeof D.setState === 'function') { try { D.setState(it.design); lsSet('nts.design', D.getState ? D.getState() : it.design); } catch (e) { console.error('Auslegung laden:', e); } }
    S.name = (it.name || 'Versuch') + (suffix || ''); S.dirty = false; buildBa(); buildSweep(); drawCmp(); updateChrome(); saveCurSoon();
    setTab('rig'); return true;
  }
  function loadItem(it) { stash(); applyItem(it); S.id = it.id; toast('Geöffnet: ' + it.name); }
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
    if (!S.rig) { toast('Es gibt noch nichts zu teilen: der Prüfstand fehlt.'); return; }
    let url; try { url = location.href.split('#')[0].split('?')[0] + '#' + await packShare(stateObj()); } catch (e) { toast('Teilen nicht möglich'); return; }
    if (navigator.share) { try { await navigator.share({ title: 'Tonfunk Netzteil-Lab: ' + S.name, text: 'Schau dir meinen Netzteil-Versuch „' + S.name + '“ an:', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    sheet('Teilen', b => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">Diesen Link weitergeben (zum Beispiel per WhatsApp oder E-Mail). Wer ihn öffnet, bekommt eine Kopie deines Versuchs mit Prüfstand, Einstellungen, Vorher-Stand, Ablauf und Auslegung.</p><textarea id="shTx" rows="5" readonly></textarea><div class="btns"><button class="btn pri" id="shCp">Link kopieren</button></div>';
      const ta = $('#shTx', b); ta.value = url; ta.addEventListener('focus', () => ta.select());
      $('#shCp', b).onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Link kopiert'); } catch (e) { ta.select(); toast('Bitte Text markieren und kopieren'); } };
    });
  }
  async function loadShared(h) {
    let d = null; try { d = await unpackShare(h); } catch (e) {}
    if (!d || !d.rig || !ORDER.includes(d.rig)) { toast('Der Link oder Code ist ungültig'); return false; }
    stash(); applyItem(d, ' (geteilt)'); S.id = null; S.dirty = true; toast('Geteilter Versuch geladen'); return true;
  }
  function importSheet() {
    sheet('Aus Code oder Link laden', (b, close) => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">Füge einen Teilen-Link oder Code ein.</p><textarea id="tx" rows="6"></textarea><div class="btns"><button class="btn pri" id="ld">Laden</button></div>';
      $('#ld', b).onclick = async () => { const t = $('#tx', b).value.trim(), h = t.includes('#') ? t.slice(t.indexOf('#')) : t; if (await loadShared(h.startsWith('#') ? h : '#' + h)) close(); };
    });
  }

  /* ---- PNG, Druck ---- */
  function rigPng(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = bgOf(); x.fillRect(0, 0, w, h); try { if (S.rig) S.rig.draw(x, w, h, S.animT, { quality: 'hoch', reduced: true }); } catch (e) {} return c;
  }
  function exportPng() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    const ws = worldSz(), c = rigPng(1600, Math.round(1600 * ws.h / ws.w));
    c.toBlob(b => { if (b && root.LabExport) { root.LabExport.saveBlob(b, root.LabExport.fname('png')); stat('png'); } else toast('Bild konnte nicht erzeugt werden'); }, 'image/png');
  }
  function printNow() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    const ws = worldSz(), c = rigPng(1200, Math.round(1200 * ws.h / ws.w)), who = lsRaw('lm4.name', ''), vals = allCtl(); let mv = {}, a = null; try { mv = S.rig.readMeters(); } catch (e) {} try { a = S.rig.assess(); } catch (e) {}
    const cv = ctlsOf().filter(x => x.type !== 'button').map(x => { const v = vals[x.key]; let t = v; if (x.type === 'switch') t = v ? 'EIN' : 'AUS'; else if (x.type === 'select') { const o = optsOf(x).find(q => q.value === v); t = o ? o.label : v; } else t = ctlShow(x, v) + (x.unit ? ' ' + x.unit : ''); return `<tr><td>${esc(x.group || '')}</td><td>${esc(x.label)}</td><td>${esc(t)}</td></tr>`; }).join('');
    const mt = metersOf().map(m => `<tr><td>${esc(m.label || m.key)}</td><td>${fnum(mv[m.key], mdig(m, mv[m.key]))} ${esc(m.unit || '')}</td></tr>`).join('');
    const ev = ((S.rig.events) || []).slice(-15).map(e => `<tr><td>${esc(evTime(e))}</td><td>${esc(e.text || '')}</td></tr>`).join('');
    const ai = ampInfo(a && a.ampel);
    $('#printArea').innerHTML = `<div class="proto"><h1>${esc(S.name)}</h1><p>Prüfstand: ${esc(rigName(S.rigId))} · ${new Date().toLocaleDateString('de-DE')}${who ? ' · ' + esc(who) : ''}</p><p><b>${esc(simOnlyText())}</b></p>
      <h2>Prüfstand</h2><img src="${c.toDataURL('image/png')}" alt=""><p>Ampel: ${esc(ai.sym + ' ' + ai.text)}${a && a.text ? ' · ' + esc(a.text) : ''}. ${esc(ampelNote())}</p>
      <h2>Einstellungen</h2><table><tr><th>Gruppe</th><th>Steuerwert</th><th>Wert</th></tr>${cv}</table>
      <h2>Messwerte</h2><table><tr><th>Messgerät</th><th>Wert</th></tr>${mt}</table>
      ${ev ? `<h2>Meldungen</h2><table><tr><th>Zeit</th><th>Meldung</th></tr>${ev}</table>` : ''}</div>`;
    setTimeout(() => window.print(), 80);
  }

  /* ============================================================ Aufgaben (NTS_TASKS) */
  const TK = () => (root.NTS_TASKS && Array.isArray(root.NTS_TASKS.tasks) && root.NTS_TASKS.tasks.length ? root.NTS_TASKS.tasks : null);
  const taskDone = () => lsGet('sim.done', {});
  function markDone(id, pct) {
    try { const d = taskDone(); if ((d[id] || 0) < pct) d[id] = pct; localStorage.setItem('sim.done', JSON.stringify(d)); } catch (e) {}
    if (root.Badges) try { root.Badges.result(id, pct); } catch (e) {}
  }
  let taskRes = null; const taskAns = {};
  const curTask = () => { const a = TK(); return a && S.task ? a.find(t => t.id === S.task.id) : null; };
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
  $('#taskBar').addEventListener('click', e => { const b = e.target.closest('[data-ta]'); if (!b) return; if (b.dataset.ta === 'info') setTab('tasks'); else checkTask(); });
  /* Aufgabenzustand (start() und sol() liefern { rig?, controls?, rows?, seq?, ref?, dur?, value?, design? }) übernehmen */
  function applyTaskState(t, o) {
    o = o || {}; const rid = o.rig || t.rig || S.rigId;
    setRig(ORDER.includes(rid) ? rid : S.rigId, { run: false }); applyCtl(o.controls || o.ctl); S.taskStart = o;
    S.rows = Array.isArray(o.rows) ? o.rows.map(cleanRow).filter(Boolean) : Array.isArray(o.seq) ? (seqToRows(o.seq), S.rows) : [];
    clearRef(true); if (o.ref && typeof o.ref === 'object') { const r = mkRefFromCtl(S.rigId, o.ref.controls && typeof o.ref.controls === 'object' ? o.ref.controls : o.ref); if (r) { S.ref = r; S.refRig = null; } }
    applyTaskDesign(o.design); buildBa(); buildSweep(); drawCmp();
  }
  function applyTaskDesign(d) {
    const D = extOf('design'); if (!d || typeof d !== 'object' || !D || typeof D.setState !== 'function') return;
    try { if (D.setState(d) !== false) { lsSet('nts.design', D.getState ? D.getState() : d); if (S.tab === 'design') renderExt('design'); } } catch (e) { console.error(e); }
  }
  const fieldsOf = t => { let f = t.fields; if (typeof f === 'function') { try { f = f(S.taskStart); } catch (e) { f = []; } } return Array.isArray(f) ? f : []; };
  const choicesOf = t => { let f = t.choices; if (typeof f === 'function') { try { f = f(S.taskStart); } catch (e) { f = []; } } return Array.isArray(f) ? f : []; };
  async function startTask(id) {
    const t = (TK() || []).find(x => x.id === id); if (!t) return;
    const had = stash(); taskRes = null;
    if (root.Auswertung) root.Auswertung.hintReset(id);
    let o; try { o = typeof t.start === 'function' ? t.start() : {}; } catch (e) { console.error(e); toast('Die Startvorlage der Aufgabe fehlt'); return; }
    S.task = null; applyTaskState(t, o); S.task = { id }; S.name = t.title; S.id = null; S.dirty = false; delete taskAns[id];
    setTab('tasks'); updateChrome();
    toast(had ? 'Aufgabe gestartet, dein Versuch ist gesichert' : 'Aufgabe gestartet'); renderTasksIfOpen();
  }
  const renderTasksIfOpen = () => { if (S.tab === 'tasks') renderTasks(); };
  function collectAnswer(t) {
    const a = taskAns[t.id] || {}, v = a.v != null && a.v !== '' ? parseNum(a.v) : NaN, fl = fieldsOf(t), fo = {};
    fl.forEach(f => { const raw = a.f && a.f[f.key], x = raw != null && raw !== '' ? parseNum(raw) : NaN; fo[f.key] = fin(x) ? x : (typeof raw === 'string' && raw !== '' && !fin(x) ? raw : null); });
    const first = fl.length ? fo[fl[0].key] : null;
    return { rig: S.rigId, controls: allCtl(), ref: S.ref ? { rig: S.ref.rig, controls: clone(S.ref.ctl), meters: clone(S.ref.meters), ampel: S.ref.ampel } : null, value: fin(v) ? v : (fin(first) ? first : null), text: a.v == null ? '' : String(a.v), fields: fo, choices: Object.assign({}, a.c || {}),
      clicks: clone(S.clicks), seq: rowsToSeq(S.rows), diagnose: S.diagnose ? S.diagnose.id : null };
  }
  async function checkTask() {
    const t = curTask(); if (!t) return; const R = root.NTS_TASKS;
    S.readonly = true; updateChrome(); updateTaskBar();
    const ans = collectAnswer(t); let lines;
    try { lines = await (R.run ? R.run(t, ans) : t.check(ans)); } catch (e) { console.error(e); lines = [{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden: ' + (e && e.message || e), why: '' }]; }
    S.readonly = false; lines = Array.isArray(lines) ? lines : [];
    const pct = Math.round(100 * lines.filter(l => l.ok).length / Math.max(lines.length, 1));
    taskRes = { id: t.id, lines, pct }; markDone(t.id, pct); updateTaskBadge();
    const F = root.LochFX; if (F) try { if (pct === 100) { F.pass(100); if (F.isFun && F.isFun()) F.confetti(false); } else F.pass(pct); } catch (e) {}
    updateChrome(); updateTaskBar(); if (S.tab !== 'tasks') setTab('tasks'); else renderTasks();
    toast(pct === 100 ? '🎉 Geschafft!' : pct + ' % richtig');
  }
  /* Auto-Weg: Musterlösung laden (zählt als Hilfe Stufe 3) */
  function autoWay(t) {
    const had = stash(); let o; try { o = t.sol(); } catch (e) { console.error(e); toast('Die Musterlösung fehlt'); return; }
    const h = lsGet('sim.hints', {}); h[t.id] = 3; lsSet('sim.hints', h);
    S.task = null; taskRes = null; applyTaskState(t, o); S.name = t.title + ' (Musterlösung)'; S.id = null; S.dirty = false; updateChrome();
    setTab('rig'); if (o && Array.isArray(o.seq) && o.seq.length) startLive(o.seq, o.dur, 'Musterlösung'); else setRun(true);
    toast((had ? 'Auto-Weg läuft, dein Stand ist gesichert' : 'Auto-Weg: Die Musterlösung läuft') + (o && fin(o.value) ? ' · Ergebnis der Musterlösung: ' + fauto(o.value) : ''));
  }
  function hintTask() {
    const t = curTask(); if (!t) return; const h = t.hint, arr = Array.isArray(h) ? h : null;
    const o = { id: t.id, hint: arr ? arr[0] : h, concrete: () => { if (arr && arr[1]) return arr[1]; const l = taskRes && taskRes.id === t.id ? taskRes.lines.find(x => !x.ok) : null; return l ? 'Noch nicht erfüllt: ' + l.text : taskRes && taskRes.id === t.id ? 'Alle Prüfpunkte sind erfüllt. Tippe auf „Lösung prüfen“.' : 'Tippe zuerst auf „Lösung prüfen“, dann kann ich dir den ersten offenen Punkt nennen.'; }, reveal: arr && arr[2] ? () => arr[2] : null, solution: typeof t.sol === 'function' ? () => autoWay(t) : null };
    if (root.Auswertung) root.Auswertung.hint(o); else sheet('Tipp', b => { b.innerHTML = '<p style="margin-top:0">' + esc(o.hint || '') + '</p>'; });
  }
  const choiceOpts = c => (c.options || []).map(o => (o && typeof o === 'object' ? { value: o.value, label: o.label != null ? o.label : String(o.value) } : { value: o, label: String(o) }));
  function tableHtml(tb) {
    if (!tb) return ''; const list = Array.isArray(tb) && tb.length && !Array.isArray(tb[0]) && typeof tb[0] === 'object' ? tb : [tb];
    const cell = v => esc(typeof v === 'number' ? fauto(v) : v), one = t1 => {
      let head = t1.head || t1.header || t1.cols || t1.columns, rows = t1.rows || t1.data;
      if (Array.isArray(t1) && !head) { head = t1[0]; rows = t1.slice(1); }
      rows = Array.isArray(rows) ? rows : []; return `<div class="nts-tbl"><table>${t1.caption || t1.title ? `<caption>${esc(t1.caption || t1.title)}</caption>` : ''}${Array.isArray(head) ? `<thead><tr>${head.map(h => `<th>${cell(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map(r => `<tr>${(Array.isArray(r) ? r : [r]).map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    };
    return list.map(one).join('');
  }
  function renderTasks() {
    const V = $('#taskView'), A = TK();
    if (!A) { V.innerHTML = '<div class="card pl"><h4>Aufgaben</h4><p class="big">Aufgaben folgen</p><p class="hint2">Hier erscheinen Aufgaben mit automatischer Prüfung: Transformator, Gleichrichter, Siebung, Z-Diode, Linearregler, Schaltregler, Wirkungsgrad, Regelkreis, Fehlersuche und Prüfungsnahes. Bis dahin kannst du mit den Beispielen, dem Rechner und dem Tab „Lernen“ üben.</p><div class="btns"><button class="btn pri" id="tkEx">Beispiele ansehen</button><button class="btn" id="tkRetry" data-retry>Erneut prüfen</button></div></div>'; $('#tkEx', V).onclick = openExamples; return; }
    const d = taskDone(), t = curTask(); let h = '';
    const n100 = A.filter(x => (d[x.id] || 0) >= 100).length, ic = x => (x.rig ? rigIcon(x.rig) : '🧮'), rn = x => (x.rig ? rigName(x.rig) : 'Rechner');
    h += `<div class="pbar big"><i style="width:${Math.round(100 * n100 / A.length)}%"></i></div>`;
    if (t) {
      const r = taskRes && taskRes.id === t.id ? taskRes : null, ask2 = t.ask ? (typeof t.ask === 'string' ? { label: t.ask } : t.ask) : null, ans = taskAns[t.id] || {}, fl = fieldsOf(t), cl = choicesOf(t);
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat || '')}</h4><div class="big">${esc(t.title)}</div><div class="lv">${'●'.repeat(t.level || 1)}${'○'.repeat(3 - (t.level || 1))}</div>
        <p style="margin:8px 0;white-space:pre-line">${esc(t.text)}</p>${tableHtml(t.table)}<p class="hint2" style="margin-top:0">Prüfstand: ${ic(t)} ${esc(rn(t))}</p>
        ${ask2 ? `<label class="f"><span>${esc(ask2.label || 'Dein Ergebnis')}${ask2.unit ? ' (' + esc(ask2.unit) + ')' : ''}</span><input id="tkAns" inputmode="decimal" autocomplete="off" value="${esc(ans.v || '')}"></label>` : ''}
        ${fl.length ? `<div class="sheetbox"><div class="gh" style="padding-top:0">Antwortblatt</div>${fl.map(f => `<label class="f"><span>${esc(f.question || f.label || f.key)}${f.unit ? ' in ' + esc(f.unit) : ''}</span><input data-fk="${esc(f.key)}" inputmode="decimal" autocomplete="off" value="${esc((ans.f || {})[f.key] || '')}"></label>`).join('')}</div>` : ''}
        ${cl.map(c => `<fieldset class="choice"><legend>${esc(c.q || c.label || c.key)}</legend>${choiceOpts(c).map((o, i) => `<label class="opt"><input type="radio" name="ch-${esc(c.key)}" data-ck="${esc(c.key)}" data-ci="${i}"${(ans.c || {})[c.key] !== undefined && String((ans.c || {})[c.key]) === String(o.value) ? ' checked' : ''}> ${esc(o.label)}</label>`).join('')}</fieldset>`).join('')}
        <div class="btns"><button class="btn pri" data-ta="check">✓ Lösung prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button></div>
        <div class="btns"><button class="btn" data-ta="rig">Zum Prüfstand</button>${typeof t.sol === 'function' ? '<button class="btn" data-ta="auto">▶ Auto-Weg</button>' : ''}<button class="btn" data-ta="hand">Abgeben (QR)</button><button class="btn danger" data-ta="end">Aufgabe beenden</button></div>`;
      if (r) h += `<ul class="tl">${r.lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}${!l.ok && l.why ? `<details><summary>Warum?</summary>${esc(l.why)}</details>` : ''}</li>`).join('')}</ul><div class="score ${r.pct === 100 ? 'ok' : ''}">${r.pct === 100 ? '🎉 Geschafft!' : r.pct + ' % richtig'}</div>`;
      h += '</div>';
    }
    const cats = []; A.forEach(x => { if (!cats.includes(x.cat)) cats.push(x.cat); });
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${A.length} Aufgaben vollständig gelöst. Wähle eine Aufgabe: Du bekommst eine Startvorlage, stellst den Prüfstand ein (oder rechnest) und lässt die Lösung prüfen.</p>
      <div class="chips" id="tkCats" style="padding:8px 0 0"><button class="chip s${!S.tkCat ? ' on' : ''}" data-cat="">Alle</button>${cats.map(c => `<button class="chip s${S.tkCat === c ? ' on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="chips" id="tkLv" style="padding:0 0 4px">${[1, 2, 3].map(l => `<button class="chip s${S.tkLv === l ? ' on' : ''}" data-lv="${l}" aria-label="Stufe ${l}">Stufe ${l}</button>`).join('')}</div>`;
    let last = '';
    A.forEach(x => {
      if (S.tkCat && x.cat !== S.tkCat) return; if (S.tkLv && (x.level || 1) !== S.tkLv) return;
      if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; }
      const p = d[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${p >= 100 ? 'g' : p > 0 ? 'p' : ''}">${p >= 100 ? '✓' : p > 0 ? p : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${'●'.repeat(x.level || 1)}${'○'.repeat(3 - (x.level || 1))}</span> ${ic(x)} ${esc(rn(x))}${p != null ? ' · bisher ' + p + ' %' : ''}</small></div></button>`;
    });
    V.innerHTML = h;
  }
  $('#taskView').addEventListener('input', e => {
    if (!S.task) return; const id = S.task.id; taskAns[id] = taskAns[id] || {};
    if (e.target.id === 'tkAns') taskAns[id].v = e.target.value;
    else if (e.target.dataset.fk) { taskAns[id].f = taskAns[id].f || {}; taskAns[id].f[e.target.dataset.fk] = e.target.value; }
  });
  $('#taskView').addEventListener('change', e => {
    const r = e.target.closest('[data-ck]'); if (!r || !S.task) return; const t = curTask(), c = t && choicesOf(t).find(x => String(x.key) === r.dataset.ck); if (!c) return;
    const id = S.task.id; taskAns[id] = taskAns[id] || {}; taskAns[id].c = taskAns[id].c || {}; taskAns[id].c[c.key] = choiceOpts(c)[+r.dataset.ci].value;
  });
  $('#taskView').addEventListener('click', async e => {
    const tb = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]'), cat = e.target.closest('[data-cat]'), lv = e.target.closest('[data-lv]');
    if (cat) { S.tkCat = cat.dataset.cat || ''; renderTasks(); return; }
    if (lv) { S.tkLv = S.tkLv === +lv.dataset.lv ? 0 : +lv.dataset.lv; renderTasks(); return; }
    if (tb) {
      const a = tb.dataset.ta;
      if (a === 'check') checkTask(); else if (a === 'hint') hintTask(); else if (a === 'rig') setTab('rig');
      else if (a === 'auto') { const t = curTask(); if (t && await confirmSheet('Auto-Weg?', 'Der Prüfstand zeigt die Musterlösung. Das <b>zählt als Hilfe</b> (Stufe 3): Dein Ausbilder sieht es.', 'Abspielen')) autoWay(t); }
      else if (a === 'hand') { const t = curTask(); if (t && root.Auswertung) root.Auswertung.handIn(t.id, taskDone()[t.id] || 0, t.title); }
      else if (a === 'end') { S.task = null; taskRes = null; updateChrome(); renderTasks(); toast('Aufgabe beendet'); }
    } else if (row) startTask(row.dataset.t);
  });

  /* ============================================================ Fehler-Würfel: Fehler auswürfeln, "Finde den Fehler" prüft die Behebung mit runSeq gegen den Ausgangs-Ampelzustand */
  const curV = k => { try { return S.rig.getControl(k); } catch (e) { return undefined; } };
  const nextOpt = (k, not) => { const c = ctlDef(k); if (!c) return undefined; const o = optsOf(c).filter(x => String(x.value) !== String(not)); return o.length ? o[0].value : undefined; };
  const fmtV = (k, v) => { const c = ctlDef(k); if (!c) return String(v); if (c.type === 'slider') return fauto(+v) + (c.unit ? ' ' + c.unit : ''); const o = optsOf(c).find(x => String(x.value) === String(v)); return o ? o.label : String(v); };
  const has = (...ks) => ks.every(k => hasCtl(k));
  const DICE = {
    gleich: { id: 'c-ausgetrocknet', label: 'C ausgetrocknet', ok: () => has('c'), apply: () => ({ c: ctlDef('c').min }), text: (b, a) => 'Der Ladekondensator ist ausgetrocknet: Seine Kapazität steht nur noch bei ' + fmtV('c', a.c) + ' (vorher ' + fmtV('c', b.c) + ').' },
    gleichdiode: { id: 'diode-offen', label: 'Diode offen', rig: 'gleich', ok: () => has('topo') && optsOf(ctlDef('topo')).some(x => String(x.value) === 'einweg'), apply: () => ({ topo: 'einweg' }), text: (b, a) => 'Eine Brückendiode ist offen. Im Modell arbeitet jetzt nur noch eine Halbwelle (' + fmtV('topo', a.topo) + ', vorher ' + fmtV('topo', b.topo) + ').' },
    stabil: { id: 'dropout', label: 'Dropout', ok: () => has('ue', 'art'), apply: () => { let drop = 2; try { const l = CORE().limit('dropout_7805'); if (l && fin(l.value)) drop = l.value; } catch (e) {} return { art: '7805', ue: clamp(5 + drop - 1, ctlDef('ue').min, ctlDef('ue').max) }; }, text: (b, a) => 'Die Eingangsspannung ist zu klein: ' + fmtV('ue', a.ue) + ' am Festspannungsregler (vorher ' + fmtV('ue', b.ue) + '). Der Regler braucht einen Mindestabstand zwischen Eingang und Ausgang.' },
    regel: { id: 'r1-offen', label: 'R1 offen', ok: () => has('r1'), apply: () => ({ r1: ctlDef('r1').max }), text: (b, a) => 'R1 im Spannungsteiler ist nahezu offen (im Modell ' + fmtV('r1', a.r1) + ' statt ' + fmtV('r1', b.r1) + ').' },
    regel2: { id: 'r2-offen', label: 'R2 offen', rig: 'regel', ok: () => has('offen', 'modus') && optsOf(ctlDef('offen')).some(x => String(x.value) === 'R2') && optsOf(ctlDef('modus')).some(x => String(x.value) === 'regelung'), apply: () => ({ modus: 'regelung', offen: 'R2' }), text: (b, a) => 'R2 im Spannungsteiler ist offen (Lehrfehler am Teiler: ' + fmtV('offen', a.offen) + ', vorher ' + fmtV('offen', b.offen) + '). Die Rückkopplung sieht dann 0 V, und der Regler dreht auf.' },
    buck: { id: 'l-zu-klein', label: 'L zu klein', ok: () => has('l'), apply: () => ({ l: ctlDef('l').min }), text: (b, a) => 'Die Drossel ist zu klein: ' + fmtV('l', a.l) + ' (vorher ' + fmtV('l', b.l) + ').' },
    gate: { id: 'ug-zu-klein', label: 'Ug zu klein', ok: () => has('ug'), apply: () => ({ ug: ctlDef('ug').min }), text: (b, a) => 'Die Gate-Spannung ist zu klein: ' + fmtV('ug', a.ug) + ' (vorher ' + fmtV('ug', b.ug) + ').' },
    topo: { id: 'topologie-falsch', label: 'Topologie falsch', ok: () => has('topo'), apply: () => ({ topo: nextOpt('topo', curV('topo')) }), text: (b, a) => 'Die Topologie passt nicht zur Aufgabe: ' + fmtV('topo', a.topo) + ' statt ' + fmtV('topo', b.topo) + '.' },
    fehler: { id: 'messpunkt-fehler', label: 'Messpunkt-Fehler', ok: () => has('fehler'), apply: () => ({ fehler: 'zufall', seed: 1 + Math.floor(Math.random() * 98) }), text: () => { let n = ''; try { n = (S.rig.state() || {}).fehlerName || ''; } catch (e) { n = ''; } return 'Im Netzteil steckt ein zufälliger Fehler' + (n ? ': ' + n : '') + '. Grenze ihn mit Sichtprüfung und Messpunkten ein und gib deine Diagnose ab.'; } }
  };
  /* gleich: Diode offen oder C ausgetrocknet; regel: R1 offen oder R2 offen (je zur Hälfte, wenn beides möglich ist) */
  const DICE_ALT = { gleich: 'gleichdiode', regel: 'regel2' };
  const diceFor = id => { const alt = DICE_ALT[id] && DICE[DICE_ALT[id]]; let ok = false; try { ok = !!(alt && alt.ok()); } catch (e) { ok = false; } return ok && Math.random() < 0.5 ? alt : DICE[id]; };
  function diceRoll() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; } if (S.task) { toast('Beende zuerst die Aufgabe.'); return; }
    const d = diceFor(S.rigId); let ok = false; try { ok = !!(d && d.ok()); } catch (e) { ok = false; }
    if (!ok) { toast('An diesem Prüfstand lässt sich im Moment nichts auswürfeln.'); return; }
    const before = allCtl(), keys = d.apply(); Object.keys(keys).forEach(k => { if (keys[k] === undefined) delete keys[k]; });
    let base = null; const C = CORE(); try { base = C && C.runSeq ? C.runSeq(S.rigId, [], 1, { controls: before, seed: 1 }) : null; } catch (e) { base = null; }
    const b = {}; Object.keys(keys).forEach(k => { b[k] = before[k]; });
    applyCtl(keys); const a = {}; Object.keys(keys).forEach(k => { a[k] = curV(k); });
    S.dice = { id: d.id, label: d.label, text: d.text(b, a), before, keys, baseAmpel: base && base.assess ? base.assess.ampel : null, shown: false, res: '' };
    S.dirty = true; S.touched = true; saveCurSoon(); if (!S.running) setRun(true); if (S.rigId === 'fehler') S.clicks = [];
    if (root.LochFX) try { root.LochFX.sound('slide'); } catch (e) {}
    buildDiceBar();
  }
  function buildDiceBar() {
    const el = $('#diceBar'); if (!el) return; const d = S.dice;
    if (!d || !S.rig) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = `<b>🎲 Finde den Fehler: Die Anlage ist nicht in Ordnung. Beobachte Ampel, Meldungen und Messwerte.</b><button class="chip s" data-dc="show">Auflösung zeigen</button><button class="chip s fire" data-dc="check">Behebung prüfen</button><button class="chip s" data-dc="undo">Fehler beheben</button><button class="chip s danger" data-dc="end">Beenden</button>${d.shown ? `<div class="hint2" style="flex:1 1 100%;color:var(--fg)">${esc(d.text)}</div>` : ''}${d.res ? `<div class="hint2" style="flex:1 1 100%;color:var(--fg)">${esc(d.res)}</div>` : ''}`;
  }
  /* Behebung prüfen: Ampel des gewürfelten Standes (jetzt) gegen den Ausgangs-Ampelzustand, beide über NTS_CORE.runSeq gerechnet */
  function diceCheck() {
    const d = S.dice; if (!d) return; const C = CORE(); let res = '';
    if (S.rigId === 'fehler') {
      const st = readState() || {}, truth = st.fehlerId || st.fault || st.fehler;
      res = S.diagnose && typeof truth === 'string' ? (S.diagnose.id === truth ? 'Deine abgegebene Diagnose stimmt mit dem eingebauten Fehler überein.' : 'Deine abgegebene Diagnose stimmt nicht mit dem eingebauten Fehler überein.') : 'Gib zuerst eine Diagnose ab (Knopf „Diagnose abgeben“). Eine Prüfung ist nur möglich, wenn der Prüfstand den eingebauten Fehler meldet.';
    } else if (!C || typeof C.runSeq !== 'function' || !d.baseAmpel) res = 'Die Prüfung braucht NTS_CORE.runSeq; sie ist im Moment nicht möglich.';
    else {
      let now = null; try { now = C.runSeq(S.rigId, [], 1, { controls: allCtl(), seed: 1 }); } catch (e) { now = null; }
      const n = now && now.assess ? now.assess.ampel : null, i0 = ampInfo(d.baseAmpel), i1 = ampInfo(n);
      res = !n ? 'Die Ampel konnte nicht gerechnet werden.' : n === d.baseAmpel ? 'Die Ampel steht wieder auf ' + i0.text.split(':')[0] + ', wie vor dem Fehler. Die Behebung hat den Ausgangszustand wiederhergestellt.' : 'Die Ampel steht auf ' + i1.text.split(':')[0] + ', vor dem Fehler stand sie auf ' + i0.text.split(':')[0] + '. Die Behebung reicht noch nicht.';
      if (n === d.baseAmpel) { const F = root.LochFX; if (F) try { F.pass(100); } catch (e) {} }
    }
    d.res = res; buildDiceBar();
  }
  $('#diceBar').addEventListener('click', e => {
    const b = e.target.closest('[data-dc]'); if (!b || !S.dice) return; const a = b.dataset.dc;
    if (a === 'show') { S.dice.shown = true; syncCtl(true); buildDiceBar(); } else if (a === 'check') diceCheck();
    else if (a === 'undo') { applyCtl(S.dice.before); S.dice = null; buildDiceBar(); toast('Fehler behoben'); } else { S.dice = null; buildDiceBar(); }
  });

  /* ============================================================ Erweiterungen (WP3b, 3c, 3d), VERTRAG 6.4 */
  /* Lädt Prüfstand und Steuerwerte (zum Beispiel aus Auslegen oder einem Lernabschnitt), danach Tab Prüfstand */
  function loadRig(o) {
    o = o || {}; if (S.task) { toast('Beende zuerst die Aufgabe.'); return false; }
    const id = o.rig && ORDER.includes(o.rig) ? o.rig : S.rigId; if (!defOf(id)) { toast('Dieser Prüfstand ist noch nicht geladen.'); return false; }
    const had = stash(); S.name = o.name || 'Neuer Versuch'; S.id = null; S.dirty = false; setRig(id, { run: o.run !== false });
    if (o.controls) applyCtl(o.controls); setTab('rig'); updateChrome(); saveCurSoon(); toast(had ? 'Geladen, dein Versuch ist gesichert' : (o.toast || 'Im Prüfstand geladen: ' + rigName(id)));
    return true;
  }
  function extApi() {
    return { get S() { return S; }, get rig() { return S.rig; }, setTab, loadExample, startTask, toast, esc, lsGet, lsSet, snapshot, setRef, loadRig,
      stat: (k, v, m) => { if (k === 'ntscalc') S.calcUsed = true; if (k === 'ntsdesign') S.designUsed = true; stat(k, v, m); },
      get NTS_CORE() { return CORE(); }, get NTS_DRAW() { return DRAW(); }, get quality() { return S.qEff; }, get ref() { return S.ref; }, refRig: ghostOf, KEYS, ORDER, SPEEDS, rigName, rigIcon, defOf, tableHtml, theme, stufeColor };
  }
  const EXTTAB = { wave: ['#waveView', 'ntsui-wave.js', 'Verläufe'], curve: ['#curveView', 'ntsui-curve.js', 'Kennlinien'], design: ['#designView', 'ntsui-design.js', 'Auslegen'], calc: ['#calcView', 'ntsui-calc.js', 'Rechnen'], help: ['#helpView', 'ntsui-help.js', 'Lernen'] };
  function renderExt(kind) {
    const m = EXTTAB[kind]; if (!m) return; const host = $(m[0]), E = root.NTS_UI_EXT && root.NTS_UI_EXT[kind];
    if (!host) return;
    if (!E || typeof E.render !== 'function') { host.dataset.ext = ''; host.innerHTML = `<div class="card pl"><p class="big">Ansicht wird geladen</p><p class="hint2">${esc(m[2])}: Die Datei ${esc(m[1])} ist noch nicht geladen. Der Prüfstand läuft weiter.</p><div class="btns"><button class="btn" data-retry>Erneut prüfen</button><button class="btn" data-ta="rig">Zum Prüfstand</button></div></div>`; return; }
    if (kind === 'help' && host.dataset.ext === '1' && host.children.length) return;
    try { E.render(host, extApi()); host.dataset.ext = '1'; } catch (e) { console.error('Erweiterung ' + kind + ':', e); host.innerHTML = '<div class="card pl"><p class="big">Das hat nicht geklappt</p><p class="hint2">' + esc((e && e.message) || e) + '</p></div>'; }
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#pgWave [data-ta=rig],#pgCurve [data-ta=rig],#pgDesign [data-ta=rig],#pgCalc [data-ta=rig],#pgHelp [data-ta=rig]'); if (b) setTab('rig'); });
  /* Erweiterungen dürfen update(host, api) anbieten: wird alle 250 ms gerufen, solange ihr Tab offen ist und der Prüfstand läuft */
  let extT = 0;
  function extTick(ts) {
    if (ts - extT < 250 || !EXTTAB[S.tab]) return; extT = ts; const E = root.NTS_UI_EXT && root.NTS_UI_EXT[S.tab], host = $(EXTTAB[S.tab][0]);
    if (E && typeof E.update === 'function' && host && host.dataset.ext === '1' && (S.running || S.live)) { try { E.update(host, extApi()); } catch (e) { if (!extTick.err) { extTick.err = 1; console.error('Erweiterung update:', e); } } }
  }

  /* ============================================================ Oberfläche: Kopf, Tabs, Leiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd" style="display:none"></span>' : ''}</button>`).join('');
    updateTaskBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function redrawTab() { S.needDraw = true; blkSig = ''; }
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'rig'; S.tab = t; lsPut('nts.tab', t);
    $('#mid').dataset.tab = t; $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (EXTTAB[t]) renderExt(t); else if (t === 'tasks') renderTasks();
    updateChrome();
    requestAnimationFrame(() => { fitCanvas(); updateMeters(); redrawTab(); syncCtl(true); });
  }
  function updateTitle() {
    $('#title').innerHTML = esc(S.name) + (S.dirty ? ' •' : '') + '\n<small>' + esc(rigName(S.rigId || 'trafo')) + (S.running ? ' · läuft' : '') + (S.live ? ' · Ablauf' : '') + '</small>';
    document.title = 'Netzteil-Lab: ' + S.name;
    const tag = $('#cvTag'); if (tag) { tag.textContent = S.running ? '' : '⏸ Pause'; tag.style.display = S.running ? 'none' : ''; }
  }
  $('#title').onclick = async () => { const r = await ask('Name des Versuchs', [{ key: 'n', label: 'Name', type: 'text', value: S.name }]); if (r && r.n.trim()) { S.name = r.n.trim(); S.dirty = true; updateChrome(); saveCurSoon(); } };
  let palSig = '';
  function buildPal() {
    const fxOn2 = fxOn(), sig = [S.running, S.speed, fxOn2, !!S.rig, !!S.live, S.rigId].join('|');
    if (sig === palSig) return; palSig = sig; const F = !!root.LochFX;
    $('#pal').innerHTML = `<button class="chip ${S.running ? 'on' : 'go'}" data-a="run" aria-label="${S.running ? 'Pause' : 'Start'}">${S.running ? '⏸ Pause' : '▶ Start'}</button><button class="chip fire" data-a="fire" aria-label="${esc(FIRE[S.rigId] || 'Auslösen')}" title="Taste F">⚡ ${esc(FIRE[S.rigId] || 'Auslösen')}</button><button class="chip" data-a="reset" aria-label="Zurücksetzen">⟲ Reset</button><span class="sep"></span>
      <span class="seg" aria-label="Zeitlupe">${SPEEDS.map(v => `<button data-sp="${v}" class="${S.speed === v ? 'on' : ''}">×${String(v).replace('.', ',')}</button>`).join('')}</span><span class="sep"></span>
      ${F ? `<button class="chip ${fxOn2 ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn2}" aria-label="Effekte und Ton" title="Effekte und Ton">${fxOn2 ? '🎉' : '🔇'} Effekte</button>` : ''}
      <span id="stat"></span>`;
    const r = $('#bRun'); r.textContent = S.running ? '⏸' : '▶'; r.classList.toggle('on', S.running); r.setAttribute('aria-label', S.running ? 'Pause' : 'Start');
    updateStat();
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sp) setSpeed(+b.dataset.sp);
    else if (b.dataset.a === 'run') setRun(!S.running); else if (b.dataset.a === 'reset') resetRig(); else if (b.dataset.a === 'fx') toggleFx(); else if (b.dataset.a === 'fire') fireRig();
  });
  function updateChrome() { updateTitle(); buildPal(); updateTaskBar(); }
  $('#bRun').onclick = () => setRun(!S.running);
  $('#bEx').onclick = openExamples; $('#bOpen').onclick = openList; $('#bTasks').onclick = () => setTab('tasks'); $('#bShare').onclick = shareNow; $('#bPrint').onclick = printNow;

  /* ============================================================ Menü */
  function openMenu() {
    const nT = (TK() || []).length, kk = KEYS.filter(k => !k.ext).map(k => k.keys.join('/')).slice(0, 4).join(', ');
    const rows = [
      ['tasks', 'Aufgaben', nT ? nT + ' Aufgaben mit automatischer Prüfung' : 'Aufgaben folgen'], ['print', 'Drucken', 'Einstellungen, Messwerte und Prüfstandbild'], ['new', 'Neuer Versuch', 'Prüfstand wählen und von vorn beginnen'], ['ex', 'Beispielversuche', exampleList().length + ' Versuche zum Ausprobieren'],
      ['open', 'Öffnen', 'Gespeicherte Versuche auf diesem Gerät'], ['save', 'Speichern unter …', S.name], ['share', 'Teilen', 'Link zum Weitergeben (Versuch steckt im Link)'], ['import', 'Aus Code oder Link laden', 'Geteilten Versuch einfügen'],
      ['fx', 'Effekte und Ton: ' + (fxOn() ? 'an' : 'aus'), 'Töne und Konfetti ein- oder ausschalten'], ['png', 'Bild speichern (PNG)', 'Aktuelle Ansicht als Bilddatei'], ['dice', 'Fehler-Würfel', 'Einen Fehler auswürfeln und die Ursache suchen'],
      ['pool', 'Pool-Fragen zum Thema', 'Prüfungsfragen zu Netzteile, Spannungsregler, Z-Diode (nur Lesen)'],
      ['calc2', 'Rechnen', 'Rechner mit Rechenweg und Übungsgenerator'], ['calc', 'Taschenrechner', 'Ohm, Farbcode, Leitung und mehr'],
      ['abz', 'Abzeichen', 'Deine Sammlung und was noch fehlt'], ['kamp', 'Kampagne', 'Lernpfad mit Geschichte über alle Labs'], ['trainer', 'Trainer: Erste Schritte', 'Kurze Einführung zum Mitmachen'],
      ['neu', 'Neu in dieser Version', 'Was zuletzt dazukam und wo du es findest'], ['erg', 'Ergebnis senden', 'Code für den Ausbilder: meine bearbeiteten Aufgaben'], ['keys', 'Tastenkürzel', kk + ' und mehr (Taste ? drücken)'], ['help', 'Hilfe und Lernen', 'Grundlagen kurz erklärt'], ['start', 'Zur Startseite', '']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b>${r[2] ? `<small>${esc(r[2])}</small>` : ''}</div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); menuAct(r.dataset.m); });
    });
  }
  async function newExperiment() {
    if (S.task) { toast('Beende zuerst die Aufgabe.'); return; }
    const v = await pick('Neuer Versuch: Prüfstand wählen', ORDER.map(id => ({ value: id, label: rigName(id), sub: rigInfo(id), icon: rigIcon(id), mark: defOf(id) ? '' : 'fehlt' })));
    if (!v) return; saveCur(); const had = stash(); S.name = 'Neuer Versuch'; S.id = null; S.dirty = false; S.ctlMem[v] = null; S.rows = []; setRig(v); setTab('rig');
    toast(had ? 'Neuer Versuch, dein bisheriger ist gesichert' : 'Neuer Versuch');
  }
  /* Pool-Fragen: Menüpunkt, nur Lesen (F25). Das Lab liest den Pool nicht selbst; es öffnet die Prüfungsvorbereitung der Startseite, falls dort ein Filter besteht. */
  function poolSheet() {
    sheet('Pool-Fragen zum Thema', b => {
      b.innerHTML = '<p style="margin-top:0">Die Prüfungsfragen zu <b>Netzteile</b>, <b>Spannungsregler</b> und <b>Z-Diode</b> findest du in der Prüfungsvorbereitung.</p><p class="hint2">Das Lab ändert den Pool nicht und liest ihn nicht selbst; es verweist nur dorthin (nur Lesen).</p><div class="btns"><a class="btn pri" href="pruefungslab.html?thema=netzteile">Zum Training Stromversorgung (Prüfungs-Lab)</a></div>';
    });
  }
  function menuAct(m) {
    switch (m) {
      case 'tasks': setTab('tasks'); break; case 'new': newExperiment(); break; case 'ex': openExamples(); break; case 'open': openList(); break; case 'save': doSave(); break;
      case 'share': shareNow(); break; case 'import': importSheet(); break; case 'fx': toggleFx(); break; case 'png': exportPng(); break; case 'dice': diceRoll(); break; case 'pool': poolSheet(); break;
      case 'print': printNow(); break; case 'calc2': setTab('calc'); break; case 'calc': if (root.Rechner) root.Rechner.open(); break; case 'abz': if (root.Badges) root.Badges.open(); break;
      case 'kamp': if (root.Kampagne) root.Kampagne.open(); break; case 'trainer': if (root.Trainer) root.Trainer.start(); break; case 'neu': if (root.LabNeu) root.LabNeu(); break;
      case 'erg': if (root.Auswertung) root.Auswertung.openSend(); break; case 'keys': if (root.LochKeys) root.LochKeys.help(); else keysSheet(); break;
      case 'help': setTab('help'); break; case 'start': location.href = 'index.html'; break;
    }
  }
  $('#bMenu').onclick = openMenu;
  const keysSheet = () => sheet('Tastenkürzel', b => { b.innerHTML = keysHtml(); });

  /* ============================================================ Tastatur (liest die Tabelle KEYS) */
  const typing = e => { const t = e.target; return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); };
  root.addEventListener('keydown', e => {
    if (typing(e) || e.altKey || document.querySelector('.backdrop')) return;
    const k = KEYS.find(x => !x.ext && x.match && x.match(e)); if (!k) return;
    if (k.id === 'run' && !(e.target === document.body || e.target.tagName === 'CANVAS')) return;
    e.preventDefault(); k.act(e);
  });

  /* ============================================================ Hauptschleife */
  let last = 0, lastUI = 0, lastDrawT = 0; const perf = { n: 0, sum: 0, max: 0, recent: [] };
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = ts; return; }
    const t0 = performance.now(), dt = Math.min(100, ts - (last || ts)); last = ts;
    if (S.running && S.rig) {
      try { simAdvance(dt); }
      catch (e) { S.running = false; S.live = null; console.error('Simulation:', e); toast('Der Prüfstand hat einen Rechenfehler gemeldet und wurde angehalten.'); updateChrome(); }
      S.animT += dt * clamp(S.speed, 0.1, 2);
    }
    if (S.rig) watchEvents();
    if (S.tab === 'rig') {
      if (S.running || S.live || S.needDraw || ts - lastDrawT > 400) { drawRig(); lastDrawT = ts; S.needDraw = false; }
      updateMeters();
      if (ts - lastUI > 100) {
        lastUI = ts; readState(); syncCtl(); updateStat(); updateDiag(); updateAmpel(); updateBlock(); drawCmp(); updateLinks();
        const fb = $('#cvFault'), on = performance.now() < (S.faultUntil || 0);
        if (fb) { if (on) { const tx = S.faultText || ''; if (fb.textContent !== tx) fb.textContent = tx; } if (fb.classList.contains('on') !== on) fb.classList.toggle('on', on); }
      }
    } else if (ts - lastUI > 250) { lastUI = ts; readState(); updateStat(); updateAmpel(); }
    extTick(ts);
    fxFrame();
    const w = performance.now() - t0; perf.n++; perf.sum += w; if (w > perf.max) perf.max = w; perf.recent.push(w); if (perf.recent.length > 120) perf.recent.shift();
  }

  /* ============================================================ Schnittstellen für Trainer, Tasten, Tests */
  root.LabTrainerAPI = {
    lab: 'nts', tab: () => S.tab, go: setTab, simMode: () => S.running, running: () => S.running, rig: () => S.rigId, speed: () => S.speed,
    load: loadExampleByName, examples: () => exampleList().map(e => e.name), task: () => (S.task ? S.task.id : null), saved: () => saves().length,
    simTime: () => (S.st && fin(S.st.t) ? S.st.t : 0), faults: () => (lsGet('nts.faults', []) || []).length, calcUsed: () => !!S.calcUsed,
    bilanz: () => { try { return S.rig && typeof S.rig.bilanz === 'function' ? S.rig.bilanz() : null; } catch (e) { return null; } },
    refSet: () => !!S.ref, fired: () => !!S.fired, designed: () => !!S.designUsed
  };
  root.LabKeysAdapter = {
    lab: 'nts', sheet: (title, build) => (title === 'Tastenkürzel' ? sheet(title, b => { b.innerHTML = keysHtml(); }) : sheet(title, build)), esc, toast,
    sim: () => setRun(!S.running), busy: () => true, has: () => false
  };
  root.NTS_UI = { frame, S, KEYS, TABS, ORDER, setTab, setRig, useRig, setCtl, applyCtl, setRun, resetRig, simAdvance, loadExample, loadExampleByName, startTask, checkTask, snapshot, snapshotJson, stateObj, packShare, unpackShare, applyItem, saveItem,
    DICE, diceRoll, diceCheck, exampleList, BUILTIN, extApi, collectAnswer, retryLoad, openMenu, slPosOf, slVal, coerce, applyHit, setRef, clearRef, toggleCmp, toggleWipe, fireRig, sweepRun, rowRun, rowsToSeq, cleanRow, startLive, loadRig, tableHtml, updateAmpel, updateBlock, buildFaultPanel,
    perf: () => ({ n: perf.n, mean: perf.n ? perf.sum / perf.n : 0, max: perf.max, recentMean: perf.recent.length ? perf.recent.reduce((a, b) => a + b, 0) / perf.recent.length : 0 }), fnum, keysHtml, evTime };

  /* ============================================================ Start */
  function init() {
    buildTabs(); buildQLine();
    const cur = lsGet('nts.cur', null);
    if (cur && typeof cur === 'object') S.ctlMem = cur.ctls && typeof cur.ctls === 'object' && !Array.isArray(cur.ctls) ? cur.ctls : {};
    if (cur && ORDER.includes(cur.rig)) {
      S.name = cur.name || 'Neuer Versuch'; S.id = cur.id || null;
      setRig(cur.rig, { run: !cur.task }); if (S.ctlMem[cur.rig]) applyCtl(S.ctlMem[cur.rig]); S.dirty = !!cur.dirty; S.task = cur.task ? { id: cur.task } : null;
      S.rows = Array.isArray(cur.rows) ? cur.rows.map(cleanRow).filter(Boolean).slice(0, 40) : [];
      if (cur.ref && typeof cur.ref === 'object' && cur.ref.rig === cur.rig && cur.ref.ctl) { const r = mkRefFromCtl(cur.rig, cur.ref.ctl); if (r) S.ref = r; }
      buildBa(); buildSweep();
    } else {
      setRig(ORDER[0]);
      const sn = seenObj(); if (!sn.intro) { sn.intro = 1; lsSet('nts.seen', sn); setTimeout(() => toast('Willkommen im Netzteil-Lab! Bewege einen Regler und beobachte Ampel und Leistungsbilanz.'), 900); }
    }
    setTab(S.tab); requestAnimationFrame(frame);
    const lazyEx = () => { try { exampleList(); } catch (e) { console.error(e); } }; if (root.requestIdleCallback) root.requestIdleCallback(lazyEx, { timeout: 6000 }); else setTimeout(lazyEx, 2500);
    root.addEventListener('load', () => { if (EXTTAB[S.tab]) renderExt(S.tab); });
    try { if (root.matchMedia) { const mq = root.matchMedia('(prefers-color-scheme: light)'); const f = () => { buildControls(); blkSig = ''; S.needDraw = true; }; if (mq.addEventListener) mq.addEventListener('change', f); } } catch (e) {}
    /* Aufrufparameter von Startseite, Lernpfad, Kampagne und Lernheften: ?aufgabe=nt1, ?ex=Name, ?bsp, ?neu */
    try {
      const q = new URLSearchParams(location.search), qa = q.get('aufgabe'), qe = q.get('ex');
      if (qa && (TK() || []).some(x => x.id === qa)) setTimeout(() => startTask(qa), 250);
      else if (qe) setTimeout(() => loadExampleByName(qe), 250);
      else if (q.has('bsp')) setTimeout(openExamples, 400);
      else if (q.has('neu')) setTimeout(newExperiment, 400);
    } catch (e) { console.error(e); }
    if (/^#[sz]=/.test(location.hash)) { const h = location.hash; history.replaceState(null, '', location.pathname + location.search); loadShared(h); }
    root.addEventListener('hashchange', () => { if (/^#[sz]=/.test(location.hash)) { const h = location.hash; history.replaceState(null, '', location.pathname + location.search); loadShared(h); } });
    root.addEventListener('beforeunload', saveCur);
  }
  init();
})(window);
