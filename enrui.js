'use strict';
/* Tonfunk Energie-Lab: Oberfläche (WP4a, SPEC Abschnitt 6).
   Seite, Tabs (Prüfstand, Kennlinien, Auslegen, Rechnen, Aufgaben, Lernen), Bedienpult und Messgeräte automatisch aus rig.controls / rig.meters,
   Szene mit Zeigerereignissen (Schalter, Ziehen, Info), Diagramme über ENR_CHART mit Fadenkreuz, Messschreiber mit Zeitreise, Szenario-Leiste,
   Kennlinien-Assistent ("Kennlinie selbst aufnehmen"), Speichern/Öffnen/Teilen, Aufgabenanbindung, Fehler-Würfel, Effekte, Tastenkürzel (Tabelle KEYS).
   Auslegen, Rechnen und Lernen kommen aus enrui-design.js, enrui-calc.js und enrui-help.js über window.ENR_UI_EXT (Abschnitt 6.7 der SPEC).
   Die Prüfstände kommen aus enrrig-*.js über window.ENR_RIGS (Registry), Rechnen und Läufer aus enrcore.js/enrsys.js/enrcalc.js (window.ENR_CORE),
   Beispiele und Aufgaben aus enrdata.js / enrtasks*.js. Es gibt hier KEINE zweite Formelimplementierung: Kennwerte, Vergleiche und Prüfungen
   rufen immer den Prüfstand (rig.analysis, rig.curves) bzw. den Kern. Fehlt etwas, erscheint ein deutscher Hinweis statt eines Absturzes.
   Speicher: enr.cur (laufende Arbeit), enr.saves (gespeicherte Versuche), enr.tab, enr.speed, enr.seen, enr.faults, enr.fx, enr.design (Auslegen),
   enr.curve (aufgenommene Messpunkte), sim.done / sim.hints (Aufgaben, gemeinsam mit den anderen Labs). */
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
  const CORE = () => root.ENR_CORE;
  const CH = () => root.ENR_CHART;
  const ORDER = ['modul', 'schatten', 'regler', 'insel', 'netz'];
  const RIGMETA = {
    modul: { icon: '☀️', name: 'Solarmodul-Kennlinie', short: 'Modul', info: 'Kennlinie, MPP, Einstrahlung, Temperatur' },
    schatten: { icon: '🌳', name: 'Verschattung und Bypassdioden', short: 'Schatten', info: 'Teilverschattung, Hotspot, MPP-Suche' },
    regler: { icon: '🔋', name: 'Laderegler mit Akku', short: 'Laderegler', info: 'PWM, MPPT, Dreistufenladung' },
    insel: { icon: '🏡', name: 'Inselanlage im Tagesgang', short: 'Inselanlage', info: 'Sonne, Akku und Last über den Tag' },
    netz: { icon: '🔌', name: 'Netzeinspeisung und Eigenverbrauch', short: 'Netz', info: 'Wechselrichter, Zähler, Speicher' }
  };
  const RIGFILE = { modul: 'enrrig-modul.js', schatten: 'enrrig-schatten.js', regler: 'enrrig-regler.js', insel: 'enrrig-insel.js', netz: 'enrrig-netz.js' };
  const DAYRIGS = ['regler', 'insel', 'netz'];            // Prüfstände mit Tageslauf (Sonnenzeit, Tagesgang)
  const PORTRAIT_RIGS = ['modul', 'schatten'];            // haben im Hochformat eine eigene Anordnung (compactWorld), die UI gibt dafür ein Hochformat vor
  /* Welche Kurven (curves()-Ids) im Prüfstand unter der Szene stehen */
  const DIAG = { modul: ['iu', 'pu'], schatten: ['iu', 'pu'], regler: ['lade'], insel: ['tagesgang'], netz: ['tagesgang'] };
  const SPEEDS = [0.25, 0.5, 1, 2, 5];
  const decs = step => { step = +step || 0; if (!step || step >= 1) return 0; return Math.min(3, Math.ceil(-Math.log10(step) - 1e-9)); };
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',').replace(/^-(?=\d)/, '−') : '–');
  const adig = v => { v = Math.abs(v); if (v === 0) return 0; return v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : v >= 0.1 ? 3 : 4; };
  const fauto = v => (fin(v) ? fnum(v, adig(v)) : '–');
  /* Datenblattwerte: drei bis vier gültige Stellen, Dezimalkomma, ohne überflüssige Nullen */
  const fds = v => { if (!fin(v)) return '–'; const a = Math.abs(v), d = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 2 : 3; let t = fnum(v, d); if (t.indexOf(',') >= 0) t = t.replace(/0+$/, '').replace(/,$/, ''); return t; };
  const hhmm = tS => { tS = ((tS % 24) + 24) % 24; let h = Math.floor(tS), m = Math.round((tS - h) * 60); if (m === 60) { h = (h + 1) % 24; m = 0; } return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; };
  const parseNum = s => {
    if (typeof s === 'string') { const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(s); if (m) return +m[1] + m[2] / 60; }
    const C = CORE(); if (C && typeof C.parseNum === 'function') { const v = C.parseNum(s); if (fin(v)) return v; if (typeof s === 'number') return NaN; }
    return fin(s) ? s : parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.'));
  };
  const clickSnd = k => { if (root.LochFX) try { root.LochFX.sound(k || 'tick'); } catch (e) {} };
  const reducedMotion = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };

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
  root.LabUI = { sheet, esc, toast, userName: () => lsRaw('lm4.name', ''), LAB: 'enr' };
  root.sheet = sheet; root.toast = toast;

  /* ============================================================ Registry-Zugriff */
  const defOf = id => { const r = root.ENR_RIGS; return r && r.defs && r.defs[id] ? r.defs[id] : null; };
  const rigName = id => (defOf(id) && defOf(id).name) || (RIGMETA[id] || {}).name || id;
  const rigIcon = id => (defOf(id) && defOf(id).icon) || (RIGMETA[id] || {}).icon || '☀️';

  /* ============================================================ Zustand */
  const S = {
    tab: lsRaw('enr.tab', 'rig'), rigId: null, rig: null, err: '', name: 'Neuer Versuch', id: null, task: null, dirty: false,
    running: false, speed: +lsRaw('enr.speed', '1') || 1, slots: {}, ctlMem: {}, ctl: {}, st: null, simT: 0, live: null, scen: null, readonly: false,
    ghost: null, detail: false, throttled: false, calcUsed: false, curSel: {}, scope: { keys: {}, span: {}, off: 0 }, xh: null, animT: 0, autoRun: false,
    curvePts: [], curveMarks: {}, curveCmp: null, curveStep: 'mittel', curveTaken: false, designUsed: false, shadeUsed: false, dayRun: false, tkCat: '', tkLv: 0, preset: null,
    evSeen: new WeakSet(), evSig: '', evLen: 0, diag: [], diagSeen: {}, faultUntil: 0, faultText: '', dice: null, taskStart: null, designSnap: null
  };
  const TABS = [['rig', '🎛️', 'Prüfstand'], ['curve', '📈', 'Kennlinien'], ['design', '📐', 'Auslegen'], ['calc', '🧮', 'Rechnen'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Lernen']];
  if (!TABS.some(x => x[0] === S.tab)) S.tab = 'rig';
  if (!SPEEDS.includes(S.speed)) S.speed = 1;
  { const cp = lsGet('enr.curve', []); S.curvePts = Array.isArray(cp) ? cp.filter(p => p && fin(p.u) && fin(p.i)).slice(0, 20) : []; }

  /* ---- Tastenkürzel: EINE Tabelle für Behandler, Hilfe-Blatt und Menü (Regel 5) ---- */
  const KEYS = [
    { id: 'run', keys: ['Leertaste'], match: e => e.key === ' ', t: 'Prüfstand starten und anhalten', act: () => setRun(!S.running) },
    { id: 'enter', keys: ['Eingabe', 'F5'], ext: true, t: 'Starten und anhalten (gilt auch außerhalb der Bildfläche)' },
    { id: 'reset', keys: ['Z'], match: e => e.key.toLowerCase() === 'z' && !(e.ctrlKey || e.metaKey), t: 'Prüfstand zurücksetzen (Reset)', act: () => resetRig() },
    { id: 'fx', keys: ['E'], match: e => e.key.toLowerCase() === 'e' && !(e.ctrlKey || e.metaKey), t: 'Effekte und Ton ein oder aus', act: () => toggleFx() },
    { id: 'speed', keys: ['1', '2', '3', '4', '5'], match: e => e.key >= '1' && e.key <= '5', t: 'Zeitraffer ×0,25 / ×0,5 / ×1 / ×2 / ×5', act: e => setSpeed(SPEEDS[+e.key - 1]) },
    { id: 'noon', keys: ['M'], match: e => e.key.toLowerCase() === 'm' && !(e.ctrlKey || e.metaKey), t: 'Sprung auf Mittag (Sonnenzeit 12 Uhr)', act: () => dayJump('mittag') },
    { id: 'detail', keys: ['D'], match: e => e.key.toLowerCase() === 'd' && !(e.ctrlKey || e.metaKey), t: 'Detailmodus: graue Verlustpfeile ein oder aus', act: () => toggleDetail() },
    { id: 'legend', keys: ['L'], match: e => e.key.toLowerCase() === 'l' && !(e.ctrlKey || e.metaKey), t: 'Legende der Energieflüsse ein oder aus', act: () => toggleLegend() },
    { id: 'save', keys: ['Strg + S'], match: e => (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's', t: 'Versuch speichern', act: () => doSave() },
    { id: 'help', keys: ['?'], ext: true, t: 'Diese Übersicht' }
  ];
  function keysHtml() {
    const kd = a => a.map(x => `<code>${esc(x)}</code>`).join(' oder ');
    return '<table>' + KEYS.map(k => `<tr><td style="white-space:nowrap">${kd(k.keys)}</td><td>${esc(k.t)}</td></tr>`).join('') + '</table><p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>';
  }
  root.ENR_KEYS = KEYS;

  let curT = 0, drawErr = false;
  /* Listen bevorzugt aus der Registry: das Prüfstandobjekt kann unter meters eine Funktion führen (Tagesprüfstände), die Liste steht dann nur in der Registry */
  const listOf = (rigV, defV) => (Array.isArray(rigV) ? rigV : Array.isArray(defV) ? defV : []);
  const ctlsOf = () => (S.rig ? listOf(S.rig.controls, (defOf(S.rigId) || {}).controls) : []);
  const metersOf = () => (S.rig ? listOf((defOf(S.rigId) || {}).meters, S.rig.meters) : []);
  const ctlDef = (key, list) => (list || ctlsOf()).find(c => c.key === key);
  const hasCtl = k => !!ctlDef(k);
  const isDay = () => DAYRIGS.includes(S.rigId);
  /* Wert an die Definition anpassen (Auswahl über Wert oder Beschriftung, Schieber begrenzen); undefined = nicht passend */
  function coerce(def, v) {
    if (!def) return undefined;
    if (def.type === 'slider') { v = typeof v === 'string' ? parseNum(v) : +v; if (!fin(v)) return undefined; const ci = infoOf(def); return clamp(v, ci.min, ci.max); }
    if (def.type === 'switch' || def.type === 'button') return !!v;
    if (def.type === 'select') {
      const o = def.options || [];
      const m = o.find(x => x.value === v) || o.find(x => String(x.value) === String(v)) || (typeof v === 'number' ? o.find(x => typeof x.value === 'number' && Math.abs(x.value - v) <= 1e-9 * Math.max(1, Math.abs(v))) : null) || o.find(x => String(x.label).toLowerCase() === String(v).toLowerCase());
      return m ? m.value : undefined;
    }
    return v;
  }
  /* Grenzen eines Schiebers: bei dyn:true aus rig.controlInfo (hängen vom Zustand ab), sonst aus der Definition */
  function infoOf(c) {
    if (c.dyn && S.rig && typeof S.rig.controlInfo === 'function') { try { const i = S.rig.controlInfo(c.key); if (i && fin(i.min) && fin(i.max)) return i; } catch (e) {} }
    return c;
  }

  /* ============================================================ Prüfstände (Plätze) und Steuerwerte */
  function bindSlot(id) {
    const sl = S.slots[id]; S.rigId = id; S.rig = sl ? sl.rig : null;
    S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; S.st = null; S.diagSeen = {}; S.diag = []; S.xh = null;
    if (S.rig && typeof S.rig.setDetail === 'function') { try { S.rig.setDetail(S.detail); } catch (e) {} }
  }
  /* neuen Prüfstand erzeugen (frisch). o: { opts, run, keepMem } */
  function setRig(id, o) {
    o = o || {};
    if (!ORDER.includes(id)) id = ORDER[0];
    S.err = ''; S.ctl = {}; S.preset = null; S.live = null; S.scen = null; S.simT = 0;
    const d = defOf(id); let rig = null;
    if (d) { try { rig = d.create(o.opts || {}); } catch (e) { S.err = (e && e.message) || String(e); console.error('Prüfstand ' + id + ':', e); } }
    S.slots[id] = { rig };
    bindSlot(id); S.running = o.run === undefined ? true : !!o.run; S.autoRun = !S.running; fxReset();
    afterRigChange();
    saveCurSoon();
  }
  /* vorhandenen Prüfstand wieder einschalten, sonst neu erzeugen und gemerkte Steuerwerte setzen */
  function useRig(id) {
    if (S.rigId === id && S.rig) return;
    if (S.slots[id] && S.slots[id].rig) { S.live = null; S.scen = null; bindSlot(id); S.ctl = {}; fxReset(); afterRigChange(); }
    else { setRig(id); if (S.ctlMem[id]) applyCtl(S.ctlMem[id]); }
  }
  function afterRigChange() {
    S.needDraw = true;
    buildPick(); buildPresets(); buildControls(); buildMeters(); buildBar(); buildScen(); fitCanvas(); updateEvents(true); updateChrome(); readState();
    S.scopeReady = false; buildDiag(); buildScope(); buildLegend();
    if (S.tab === 'curve') renderCurveTab(); if (S.tab === 'design') renderExt('design'); if (S.tab === 'calc') renderExt('calc'); if (S.tab === 'help') renderExt('help');
    drawDiag(true);
  }
  const SELFIRST = c => (c && (c.type === 'select' || c.type === 'switch') ? 0 : 1);
  /* mehrere Steuerwerte setzen: map { key: Wert }, Auswahlfelder zuerst, nur passende Schlüssel, ohne Hinweise */
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
      S.dirty = true; saveCurSoon();
      if (!S.running && S.autoRun && def.type !== 'button' && !S.live && (S.tab === 'rig')) setRun(true, true);
      if (key === 'schatten' && v !== 'keiner') S.shadeUsed = true;
    }
    readState(); syncCtl(); drawDiag(true); S.needDraw = true; return true;
  }
  const allCtl = () => { const o = {}; if (S.rig) ctlsOf().forEach(c => { try { const v = S.rig.getControl(c.key); if (v !== undefined && c.type !== 'button') o[c.key] = v; } catch (e) {} }); return o; };
  function saveCurSoon() { clearTimeout(curT); curT = setTimeout(saveCur, 400); }
  function saveCur() {
    if (!S.rig) return; S.ctlMem[S.rigId] = allCtl();
    lsSet('enr.cur', { rig: S.rigId, ctls: S.ctlMem, name: S.name, id: S.id, task: S.task ? S.task.id : null, dirty: S.dirty, clock: clockOf(), design: designState() });
  }
  function usedRig() {
    if (!S.rigId || S.err) return;
    const a = lsGet('enr.rigsused', []), s = new Set(Array.isArray(a) ? a : []); s.add(S.rigId); lsSet('enr.rigsused', [...s]); stat('enrrigs', s.size, 'max');
  }
  function readState() { if (!S.rig) { S.st = null; return null; } try { S.st = S.rig.state(); } catch (e) { S.st = S.st || null; } return S.st; }
  function clockOf() { const st = S.st; return st && fin(st.N) && fin(st.tS) ? { N: st.N, tS: st.tS } : null; }

  /* ---- Prüfstandwahl (Karten), Voreinstellungen ---- */
  function buildPick() {
    const el = $('#rigPick'); if (!el) return;
    el.innerHTML = ORDER.map(id => {
      const have = !!defOf(id), m = RIGMETA[id], on = id === S.rigId;
      return `<button class="enr-card${on ? ' on' : ''}" data-rig="${id}" aria-pressed="${on}" style="${have ? '' : 'opacity:.6'}"><span class="ic">${rigIcon(id)}</span><b>${esc(m.short)}${have ? '' : ' ⚠'}</b><small>${esc(m.info)}</small></button>`;
    }).join('');
  }
  $('#rigPick').addEventListener('click', e => { const b = e.target.closest('[data-rig]'); if (b) usePick(b.dataset.rig); });
  function usePick(id) {
    if (id === S.rigId && S.tab === 'rig') return;
    if (S.task) { toast('Während einer Aufgabe ist der Prüfstand fest. Beende zuerst die Aufgabe.'); return; }
    if (id === S.rigId) return;
    saveCur(); stash(); S.name = 'Neuer Versuch'; S.id = null; S.dirty = false; useRig(id); toast('Prüfstand: ' + rigName(id));
  }
  const presetsOf = () => (S.rig ? listOf(S.rig.presets, (defOf(S.rigId) || {}).presets) : []);
  function buildPresets() {
    const P = presetsOf(), el = $('#presetBar');
    if (!P.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="gh" style="padding-top:2px">Voreinstellung</div><div class="chips">${P.map(p => `<button class="chip s${S.preset === p.id ? ' on' : ''}" data-pre="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>`;
  }
  $('#presetBar').addEventListener('click', e => {
    const b = e.target.closest('[data-pre]'); if (!b || !S.rig) return;
    if (S.task) { toast('Während einer Aufgabe gelten die Einstellungen der Aufgabe.'); return; }
    const p = presetsOf().find(x => String(x.id) === b.dataset.pre); if (!p) return;
    S.preset = p.id; let ok = false; try { ok = S.rig.applyPreset(p.id) !== false; } catch (er) { console.error(er); }
    if (!ok) { toast('Voreinstellung nicht möglich'); return; }
    S.evSeen = new WeakSet(); S.evSig = ''; S.live = null; S.scen = null; S.simT = 0; S.ctl = {}; S.faultUntil = 0; fxReset(); S.needDraw = true;
    buildControls(); buildMeters(); buildPresets(); readState(); updateEvents(true); updateChrome(); drawDiag(true); toast('Voreinstellung: ' + p.name); S.dirty = true; saveCurSoon();
  });

  /* ---- Platzhalter, wenn ein Prüfstand fehlt ---- */
  function placeholderHtml() {
    const why = S.err ? 'Der Prüfstand konnte nicht gestartet werden: ' + esc(S.err) : 'Die Datei für „' + esc(rigName(S.rigId)) + '“ (' + esc(RIGFILE[S.rigId] || '') + ') ist noch nicht geladen.';
    return `<div class="ph2"><b>Prüfstand noch nicht geladen</b>${why}<br><button class="btn" data-retry>Erneut prüfen</button></div>`;
  }
  function retryLoad() {
    const want = [];
    if (!root.ENR_CORE) want.push('enrcore.js'); if (!(root.ENR_CORE && root.ENR_CORE.sys)) want.push('enrsys.js'); if (!root.ENR_DRAW) want.push('enrdraw.js'); if (!root.ENR_CHART) want.push('enrchart.js');
    ORDER.forEach(id => { if (!defOf(id)) want.push(RIGFILE[id]); });
    if (!want.length) { const keep = S.rig ? allCtl() : {}; setRig(S.rigId); applyCtl(keep); toast('Alles geladen'); return Promise.resolve(); }
    toast('Lade fehlende Dateien …');
    return Promise.all(want.map(f => new Promise(res => { const s = document.createElement('script'); s.src = f + '?t=' + Date.now(); s.onload = s.onerror = () => res(); document.head.appendChild(s); }))).then(() => {
      const still = ORDER.filter(i => !defOf(i)).length, keep = S.rig ? allCtl() : {}; setRig(S.rigId); applyCtl(keep); buildPick();
      if (S.tab === 'tasks') renderTasks(); toast(still ? still + ' Prüfstand' + (still > 1 ? 'e fehlen' : ' fehlt') + ' noch' : 'Alle Prüfstände geladen');
    });
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-retry]')) retryLoad(); });

  /* ============================================================ Bedienpult aus rig.controls */
  let panels = [];
  const slPos = (c, v) => { const i = infoOf(c); if (c.scale === 'log' && i.min > 0 && i.max > i.min) return Math.round(1000 * Math.log(clamp(v, i.min, i.max) / i.min) / Math.log(i.max / i.min)); return Math.round(1000 * (clamp(v, i.min, i.max) - i.min) / ((i.max - i.min) || 1)); };
  function slVal(c, pos) {
    const i = infoOf(c);
    let v = c.scale === 'log' && i.min > 0 && i.max > i.min ? i.min * Math.pow(i.max / i.min, pos / 1000) : i.min + (i.max - i.min) * pos / 1000;
    if (i.step && !(c.scale === 'log')) v = Math.round(v / i.step) * i.step; else if (c.scale === 'log') { const d = fin(v) ? Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, v))) - 2) : 0.01; v = Math.round(v / d) * d; }
    return clamp(+v.toPrecision(10), i.min, i.max);
  }
  const ctlUnit = c => (c.unitKind === 'clock' ? 'Uhr' : (c.unit || ''));
  const ctlShow = (c, v) => (c.unitKind === 'clock' ? hhmm(v) : fnum(v, c.scale === 'log' ? adig(v) : decs(infoOf(c).step)));
  function ctlHtml(c) {
    const k = esc(c.key), lab = c.label || c.key, hp = c.help || '', help = hp ? `<small class="hp">${esc(hp)}</small>` : '';
    if (c.type === 'slider') return `<div class="ct" data-k="${k}" data-t="slider" title="${esc(hp)}"><div class="ctl"><span class="lb">${esc(lab)}</span><span class="vi"><input class="num" inputmode="${c.unitKind === 'clock' ? 'text' : 'decimal'}" autocomplete="off" aria-label="${esc(lab)}, Wert eingeben"><small class="un"></small></span></div>${help}<input type="range" min="0" max="1000" step="1" value="0" aria-label="${esc(lab)}"></div>`;
    if (c.type === 'switch') return `<div class="ct p0" data-k="${k}" data-t="switch" title="${esc(hp)}"><button class="sw" role="switch" aria-checked="false" aria-label="${esc(lab)}"><span class="lab"><span>${esc(lab)}${help}</span></span><span class="tgl"><i></i></span></button></div>`;
    if (c.type === 'select') {
      const o = c.options || [], tt = x => (x.help ? ` title="${esc(x.help)}"` : '');
      const body = o.length <= 4 ? `<div class="seg">${o.map((x, i) => `<button data-i="${i}"${tt(x)}>${esc(x.label)}</button>`).join('')}</div>`
        : o.length <= 8 ? `<div class="seg wrap">${o.map((x, i) => `<button data-i="${i}"${tt(x)}>${esc(x.label)}</button>`).join('')}</div>` : `<select aria-label="${esc(lab)}">${o.map((x, i) => `<option value="${i}">${esc(x.label)}</option>`).join('')}</select>`;
      return `<div class="ct" data-k="${k}" data-t="select" title="${esc(hp)}"><div class="ctl"><span class="lb">${esc(lab)}</span></div>${help}${body}</div>`;
    }
    return '';
  }
  function buildPanel(host) {
    panels = panels.filter(p => p.host !== host && p.host.isConnected);
    if (!S.rig) { host.innerHTML = '<div class="card">' + placeholderHtml() + '</div>'; return; }
    const list = ctlsOf(), groups = [], gm = {};
    list.forEach(c => { const g = c.group || 'Bedienung'; if (!gm[g]) { gm[g] = { n: g, items: [] }; groups.push(gm[g]); } gm[g].items.push(c); });
    host.innerHTML = groups.map((g, i) => `<details class="card ctg"${i < 3 ? ' open' : ''}><summary>${esc(g.n)}</summary><div class="cb">${g.items.map(ctlHtml).join('')}</div></details>`).join('');
    const els = {}; $$('.ct[data-k]', host).forEach(el => { els[el.dataset.k] = { el, t: el.dataset.t, last: undefined, vis: true }; });
    panels.push({ host, els }); wirePanel(host); syncCtl(true);
  }
  function buildControls() { buildPanel($('#ctlHost')); }
  function syncCtl(force) {
    if (!S.rig) return;
    const st = S.st || readState();
    panels = panels.filter(p => p.host.isConnected);
    panels.forEach(p => ctlsOf().forEach(c => {
      const x = p.els[c.key]; if (!x) return;
      if (typeof c.visible === 'function') { let vis = true; try { vis = !!c.visible(st || {}); } catch (e) {} if (vis !== x.vis) { x.vis = vis; x.el.hidden = !vis; } }
      let v; try { v = S.rig.getControl(c.key); } catch (e) { return; }
      if (!force && x.last === v && !(c.dyn || c.unitKind === 'clock')) return; x.last = v; const el = x.el;
      if (c.type === 'slider') {
        const inp = $('input[type=range]', el), num = $('.num', el), un = $('.un', el), n = +v;
        if (fin(n)) { if (document.activeElement !== inp || force) inp.value = slPos(c, n); if (document.activeElement !== num || force) num.value = ctlShow(c, n); }
        un.textContent = ctlUnit(c);
      } else if (c.type === 'switch') $('button', el).setAttribute('aria-checked', v ? 'true' : 'false');
      else if (c.type === 'select') {
        const o = c.options || [], i = o.findIndex(q => q.value === v || String(q.value) === String(v));
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
      if (sel) { const el = sel.closest('.ct'), c = ctlDef(el.dataset.k); if (c) setCtl(c.key, (c.options || [])[+sel.value].value); }
    });
    H.addEventListener('click', e => {
      const sw = e.target.closest('.sw'), sg = e.target.closest('.seg button');
      if (sw) { const k = sw.closest('.ct').dataset.k; setCtl(k, !S.rig.getControl(k)); clickSnd('click'); }
      else if (sg) { const el = sg.closest('.ct'), c = ctlDef(el.dataset.k); if (c) { setCtl(c.key, (c.options || [])[+sg.dataset.i].value); clickSnd('tick'); } }
    });
  }

  /* ============================================================ Messgeräte aus rig.meters (Zahl mit Skalenbalken und Warnmarke) */
  let mEls = [];
  function buildMeters() {
    const H = $('#meters'); mEls = [];
    if (!S.rig) { H.innerHTML = ''; return; }
    const ms = metersOf();
    H.innerHTML = ms.map((m, i) => `<button class="mt" data-i="${i}" aria-label="${esc(m.label)}: Erklärung anzeigen"><span class="qi" aria-hidden="true">i</span><div class="lbl">${esc(m.label)}</div><div class="num"><span class="v">–</span><small>${esc(m.unit || '')}</small></div>${fin(m.min) && fin(m.max) && m.max > m.min ? `<div class="gg"><i></i>${fin(m.warnAbove) ? `<b style="left:${(100 * clamp((m.warnAbove - m.min) / (m.max - m.min), 0, 1)).toFixed(1)}%"></b>` : ''}</div>` : ''}</button>`).join('');
    mEls = $$('.mt', H).map((el, i) => ({ el, m: ms[i], v: $('.v', el), g: $('.gg i', el), txt: '', warn: false, vis: true }));
  }
  $('#meters').addEventListener('click', e => { const b = e.target.closest('.mt'); if (b) meterHelp(+b.dataset.i); });
  function meterHelp(i) {
    const m = metersOf()[i]; if (!m || !S.rig) return;
    const val = (() => { try { return (S.rig.readMeters() || {})[m.key]; } catch (e) { return NaN; } })();
    sheet(m.label, b => {
      b.innerHTML = `<p style="margin-top:0">Aktueller Wert: <b>${fnum(val, m.digits == null ? 1 : m.digits)} ${esc(m.unit || '')}</b></p>` +
        (fin(m.min) && fin(m.max) ? `<p class="hint2">Skalenbereich des Messgeräts: ${fnum(m.min, m.digits == null ? 1 : m.digits)} bis ${fnum(m.max, m.digits == null ? 1 : m.digits)} ${esc(m.unit || '')}.${fin(m.warnAbove) ? ' Die orange Marke zeigt den Warnbereich ab ' + fnum(m.warnAbove, m.digits == null ? 1 : m.digits) + ' ' + esc(m.unit || '') + '.' : ''}</p>` : '') +
        (m.help ? `<p class="hint2">${esc(m.help)}</p>` : '') + '<p class="hint2">Die Zahl kommt aus derselben Rechnung wie die Animation. Im Tab „Rechnen“ kannst du den Weg mit eigenen Werten nachrechnen.</p>';
    });
  }
  function updateMeters() {
    if (!S.rig || !mEls.length) return;
    let vals; try { vals = S.rig.readMeters() || {}; } catch (e) { return; }
    const st = S.st;
    mEls.forEach(x => {
      if (typeof x.m.visible === 'function') { let vis = true; try { vis = !!x.m.visible(st || {}); } catch (e) {} if (vis !== x.vis) { x.vis = vis; x.el.style.display = vis ? '' : 'none'; } }
      const t = vals[x.m.key]; if (!fin(t)) return;
      const txt = x.m.unitKind === 'clock' ? hhmm(t) : fnum(t, x.m.digits == null ? 1 : x.m.digits); if (txt !== x.txt) { x.txt = txt; x.v.textContent = txt; }
      if (x.g && fin(x.m.min) && fin(x.m.max)) { const f = clamp((t - x.m.min) / ((x.m.max - x.m.min) || 1), 0, 1); x.g.style.width = (100 * f).toFixed(1) + '%'; }
      const wn = fin(+x.m.warnAbove) && t > +x.m.warnAbove; if (wn !== x.warn) { x.warn = wn; x.el.classList.toggle('warn', wn); }
    });
  }

  /* ============================================================ Zeichenfläche (Anlage) und Zeigerereignisse */
  const cvs = $('#cv'), g2 = cvs.getContext('2d'), cvw = $('#cvw');
  let cw = 0, ch = 0, dpr = 1;
  const cvfx = document.createElement('canvas'); cvfx.id = 'cvfx'; cvfx.setAttribute('aria-hidden', 'true'); cvfx.style.pointerEvents = 'none'; cvw.appendChild(cvfx);
  const fxg = cvfx.getContext('2d'); let fxDrew = false;
  function worldSz() {
    let ws = null; try { ws = S.rig && S.rig.worldSize && S.rig.worldSize(cvw.clientWidth); } catch (e) {}
    if (!(ws && ws.w > 0 && ws.h > 0)) ws = { w: 1000, h: 640 };
    if (PORTRAIT_RIGS.includes(S.rigId) && cvw.clientWidth > 0 && cvw.clientWidth < 600 && ws.w >= ws.h) ws = { w: 560, h: 800 };
    return ws;
  }
  /* Szene vergrößern (nur Hochformat-Handy, Anlagen mit festem Querformat-Bild): das Bild wird breiter als der Bildschirm und lässt sich im Rahmen wischen, damit die Beschriftungen lesbar sind */
  const ZOOMW = 900;
  const zoomOn = () => !!S.zoomScene && (S.rigId === 'insel' || S.rigId === 'netz') && cvw.parentElement && cvw.parentElement.clientWidth < 600;
  function fitCanvas() {
    const ws = worldSz();
    if (zoomOn()) {
      const Hz = Math.round(ZOOMW * ws.h / ws.w); cvw.style.aspectRatio = 'auto'; cvw.style.height = Hz + 'px'; cvw.style.maxHeight = 'none'; cvw.style.overflowX = 'auto'; cvw.style.overflowY = 'hidden';
      [cvs, cvfx].forEach(c => { c.style.width = ZOOMW + 'px'; c.style.height = Hz + 'px'; }); cvs.style.touchAction = 'pan-x pan-y';
    } else {
      const ar = ws.w + '/' + ws.h; if (cvw.style.aspectRatio !== ar) cvw.style.aspectRatio = ar; cvw.style.height = ''; cvw.style.overflowX = ''; cvw.style.overflowY = '';
      [cvs, cvfx].forEach(c => { c.style.width = ''; c.style.height = ''; }); cvs.style.touchAction = '';
      cvw.style.maxHeight = ws.h > ws.w ? '78vh' : '';
    }
    const z = zoomOn(), w = z ? ZOOMW : cvw.clientWidth, h = z ? Math.round(ZOOMW * ws.h / ws.w) : cvw.clientHeight; if (!w || !h) return;
    dpr = Math.min(2, root.devicePixelRatio || 1); const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; }
    if (cvfx.width !== W || cvfx.height !== H) { cvfx.width = W; cvfx.height = H; }
    cw = w; ch = h; S.needDraw = true;
  }
  if (root.ResizeObserver) new ResizeObserver(() => fitCanvas()).observe(cvw);
  root.addEventListener('resize', () => { buildBar(); fitCanvas(); redrawTab(); updateMeters(); });
  const bgOf = () => (getComputedStyle(document.documentElement).getPropertyValue('--cv') || '#14181c').trim();
  function drawRig() {
    if (!cw || cvw.offsetParent === null) return;
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.fillStyle = bgOf(); g2.fillRect(0, 0, cw, ch);
    if (!S.rig) { g2.fillStyle = '#8d99a6'; g2.font = '600 16px system-ui'; g2.textAlign = 'center'; g2.fillText('Prüfstand noch nicht geladen', cw / 2, ch / 2); return; }
    try { S.rig.draw(g2, cw, ch, S.animT); }
    catch (e) { if (!drawErr) { drawErr = true; console.error('Zeichnung des Prüfstands:', e); } }
  }
  const cvPos = e => { const r = cvs.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  /* hitTest liefert { key, kind:'switch'|'drag'|'info', to?, value?, set?, also? } (Welt-Koordinaten rechnet der Prüfstand) */
  function applyHit(h) {
    if (!h || typeof h !== 'object' || S.readonly) return false;
    ['set', 'also'].forEach(k => { if (h[k] && typeof h[k] === 'object') Object.keys(h[k]).forEach(q => setCtl(q, h[k][q], true)); });
    if (h.key) { const v = h.to !== undefined ? h.to : h.value; if (v !== undefined) return setCtl(h.key, v); }
    return true;
  }
  const dragging = new Map();
  function dragTo(d, x, y) {
    const r = S.rig; if (!r) return;
    if (typeof r.dragValue === 'function') { const v = r.dragValue(d.key, x, y, cw, ch); if (fin(v)) setCtl(d.key, v); }
    else if (typeof r.drag === 'function') { let ok = false; try { ok = r.drag(d.key, x, y, cw, ch); } catch (e) { ok = false; } if (ok) { S.dirty = true; saveCurSoon(); readState(); syncCtl(); drawDiag(true); S.needDraw = true; } }
  }
  cvs.addEventListener('pointerdown', e => {
    e.preventDefault(); const r = S.rig; if (!r || !r.hitTest) return; try { cvs.setPointerCapture(e.pointerId); } catch (x) {}
    const [x, y] = cvPos(e); let h = null; try { h = r.hitTest(x, y, cw, ch); } catch (er) { h = null; } if (!h) return;
    if (h.kind === 'switch') { applyHit(h); clickSnd('click'); }
    else if (h.kind === 'drag' && h.key) { dragging.set(e.pointerId, { key: h.key }); dragTo({ key: h.key }, x, y); }
    else if (h.kind === 'info') { toast((h.title ? h.title + ': ' : '') + (h.text || '')); noteInfo(h); }
  });
  const cvUp = e => { dragging.delete(e.pointerId); };
  cvs.addEventListener('pointerup', cvUp); cvs.addEventListener('pointercancel', cvUp);
  cvs.addEventListener('pointermove', e => {
    const [x, y] = cvPos(e), r = S.rig; if (!r) return;
    const d = dragging.get(e.pointerId); if (d) { dragTo(d, x, y); return; }
    if (e.pointerType !== 'mouse' || !r.hitTest) return; let h = null; try { h = r.hitTest(x, y, cw, ch); } catch (er) {} cvs.style.cursor = h ? 'pointer' : 'default';
  });
  cvs.addEventListener('contextmenu', e => e.preventDefault());
  function noteInfo() { /* keine Statistik zu Info-Antippen im Pflichtenheft */ }

  /* ---- Werkzeugleiste: Tag-Sprünge, Verluste, Legende, Lauf merken ---- */
  const JUMPS = [['aufgang', '🌅 Aufgang', 'Sonnenaufgang'], ['mittag', '☀️ Mittag', 'Mittag (Taste M)'], ['untergang', '🌇 Untergang', 'Sonnenuntergang'], ['mitternacht', '🌙 Mitternacht', 'Mitternacht'], ['tag', '⏭ Nächster Tag', 'Nächster Tag, gleiche Uhrzeit']];
  /* Tag-Sprünge nur, wenn das Bedienelement der Tageszeit gerade sichtbar ist (Regler: nur bei Quelle Tagesgang, Schatten: nur bei Hecke) */
  const hasClockCtl = () => { const c = ctlDef('uhr'); if (!c || S.rigId === 'modul') return false; if (typeof c.visible !== 'function') return true; try { return !!c.visible(S.st || {}); } catch (e) { return true; } };
  const hasDetail = () => !!S.rig && typeof S.rig.setDetail === 'function';
  function buildBar() {
    const el = $('#rigBar'); if (!el) return;
    S.clockVis = hasClockCtl();
    el.innerHTML = (S.clockVis ? `<span class="seg" role="group" aria-label="Tag-Sprünge">${JUMPS.map(j => `<button data-jump="${j[0]}" title="${esc(j[2])}">${j[1]}</button>`).join('')}</span>` : '') +
      ((S.rigId === 'insel' || S.rigId === 'netz') && cvw.parentElement && cvw.parentElement.clientWidth < 600 ? `<button class="chip s${S.zoomScene ? ' on' : ''}" id="bZoom" aria-pressed="${!!S.zoomScene}" title="Szene größer zeigen und im Rahmen wischen">🔍 Szene ${S.zoomScene ? 'verkleinern' : 'vergrößern'}</button>` : '') +
      (hasDetail() ? `<button class="chip s${S.detail ? ' on' : ''}" id="bDetail" aria-pressed="${S.detail}" title="Graue Verlustpfeile zeigen (Taste D)">Verluste zeigen</button>` : '') +
      (DAYRIGS.includes(S.rigId) ? '<button class="chip s" id="bLegend" title="Legende der Energieflüsse (Taste L)">Legende</button><button class="chip s" id="bKeep" title="Den Verlauf dieses Tages blass im Diagramm stehen lassen">📌 Lauf merken</button>' + (S.ghost ? '<button class="chip s" id="bUnkeep">Gemerktes löschen</button>' : '') : '');
  }
  $('#rigBar').addEventListener('click', e => {
    const j = e.target.closest('[data-jump]');
    if (j) dayJump(j.dataset.jump); else if (e.target.closest('#bZoom')) { S.zoomScene = !S.zoomScene; buildBar(); fitCanvas(); } else if (e.target.closest('#bDetail')) toggleDetail(); else if (e.target.closest('#bLegend')) toggleLegend(); else if (e.target.closest('#bKeep')) keepRun(); else if (e.target.closest('#bUnkeep')) { S.ghost = null; buildBar(); drawDiag(true); toast('Gemerkter Lauf gelöscht'); }
  });
  function jumpTo(N, tS) {
    const r = S.rig; if (!r) return false;
    if (typeof r.setClock === 'function' && S.rigId !== 'schatten') { let ok = false; try { ok = r.setClock(N, tS) !== false; } catch (e) { ok = false; } if (ok) { readState(); syncCtl(true); S.dirty = true; saveCurSoon(); drawDiag(true); updateStat(); return true; } }
    return setCtl('uhr', tS);
  }
  function dayJump(kind) {
    if (!S.rig || S.readonly) return; if (!hasClockCtl()) { toast('Dieser Prüfstand hat keine Tageszeit zum Springen.'); return; }
    const st = readState() || {};
    if (S.rigId === 'regler' && st.quelle === 'konstant') { toast('Die Tageszeit gilt nur bei der Einstrahlungsquelle „Tagesgang“. Stelle sie im Bedienpult um.'); return; }
    const C = CORE(); let N = fin(st.N) ? st.N : 172, lat = 51.7, ss = null;
    try { const site = C.sun.sites[st.ort]; if (site) lat = site.lat; ss = C.sun.sunriseSunset(N, lat); } catch (e) { ss = null; }
    let tS, nn = N;
    if (kind === 'mittag') tS = 12; else if (kind === 'mitternacht') tS = 0; else if (kind === 'tag') { nn = N % 365 + 1; tS = fin(st.tS) ? st.tS : 12; }
    else {
      if (!ss || ss.ok === false) { toast('Der Kern liefert für diesen Standort keine Aufgangszeit.'); return; }
      if (ss.polar === 'nacht') { toast('Polarnacht: Die Sonne geht an diesem Tag nicht auf.'); return; }
      if (ss.polar === 'tag') { toast('Polartag: Die Sonne geht an diesem Tag nicht unter.'); return; }
      tS = kind === 'aufgang' ? ss.rise : ss.set;
    }
    if (jumpTo(nn, tS)) { toast((kind === 'tag' ? 'Tag ' + nn + ', ' : '') + hhmm(tS) + ' Uhr Sonnenzeit'); clickSnd('tick'); }
  }
  function toggleDetail() {
    S.detail = !S.detail; Object.keys(S.slots).forEach(k => { const r = S.slots[k].rig; if (r && typeof r.setDetail === 'function') { try { r.setDetail(S.detail); } catch (e) {} } });
    buildBar(); S.needDraw = true; toast(S.detail ? 'Detailmodus: graue Pfeile zeigen die Verluste' : 'Detailmodus aus');
  }
  function toggleLegend() { const c = $('#cLeg'); if (c && c.style.display !== 'none') { c.open = !c.open; if (c.open) c.scrollIntoView && c.scrollIntoView({ block: 'nearest' }); } }
  /* Lauf merken: die erste Reihe des Tagesdiagramms (Solarleistung bzw. Akkuspannung) bleibt blass stehen (z. B. PWM gegen MPPT) */
  function keepRun() {
    if (!S.rig) return; let cs = []; try { cs = S.rig.curves() || []; } catch (e) { cs = []; }
    const id = (DIAG[S.rigId] || [])[0], cur = cs.find(c => c.id === id); if (!cur) { toast('Es gibt noch nichts zu merken.'); return; }
    const s = (cur.series || []).find(q => /^Solarleistung|^Akkuspannung/i.test(q.name)) || (cur.series || [])[0];
    if (!s || !Array.isArray(s.points) || s.points.length < 2) { toast('Es gibt noch nichts zu merken.'); return; }
    S.ghost = { rig: S.rigId, curveId: id, name: 'gemerkt: ' + s.name, points: s.points.map(p => [p[0], p[1]]), axis: s.axis };
    buildBar(); drawDiag(true); toast('Verlauf gemerkt: Er bleibt blass im Diagramm, bis du ihn löschst.');
  }
  /* Legende der Energieflüsse: Farbe, Linienart und Zeichen aus ENR_DRAW.FLOW_KINDS */
  function buildLegend() {
    const card = $('#cLeg'), host = $('#legHost'); if (!card || !host) return;
    const day = DAYRIGS.includes(S.rigId); card.style.display = day ? '' : 'none'; if (!day) return;
    const FK = (root.ENR_DRAW && root.ENR_DRAW.FLOW_KINDS) || {};
    const ids = S.rigId === 'netz' ? ['solar', 'last', 'bezug', 'einsp'] : ['solar', 'akku-laden', 'akku-entl', 'last'];
    if (S.detail) ids.push('verlust');
    host.innerHTML = '<div class="legend">' + ids.filter(k => FK[k]).map(k => { const f = FK[k]; return `<span><svg width="46" height="12" aria-hidden="true"><line x1="2" y1="6" x2="44" y2="6" stroke="${esc(f.color)}" stroke-width="4" stroke-dasharray="${(f.dash || []).join(' ')}"/></svg>${esc(f.name)}${f.sym ? ' (' + esc(f.sym) + ')' : ''}</span>`; }).join('') + '</div><p class="hint2" style="margin:0 4px 6px">Die Strichstärke wächst mit der Wurzel der Leistung (Strichstärke ~ √Leistung). Die Wattangabe steht am Pfeil. Farbe und Linienart sagen dasselbe, damit du die Pfeile auch ohne Farben unterscheiden kannst.</p>';
  }
  $('#cLeg').addEventListener('toggle', () => { /* nur Zustand der Seite */ });

  /* ============================================================ Szenario-Leiste (Beispiele mit Ablauf) */
  function buildScen() {
    const el = $('#scenBar'); if (!el) return;
    const list = exCache ? exCache.filter(e => e.rig === S.rigId && Array.isArray(e.seq) && e.seq.length) : [];
    el.style.display = list.length ? '' : 'none';
    el.innerHTML = list.length ? '<span class="hint2" style="margin:0 4px 0 0;white-space:nowrap">Szenarien:</span>' + list.map(e => `<button class="chip s${S.scen === e.id ? ' on' : ''}" data-scen="${esc(e.id)}" title="${esc(e.desc || '')}">${esc(e.name)}</button>`).join('') : '';
  }
  $('#scenBar').addEventListener('click', e => { const b = e.target.closest('[data-scen]'); if (!b) return; const ex = exampleList().find(x => x.id === b.dataset.scen); if (ex) scenarioSheet(ex); });
  function scenarioSheet(ex) {
    sheet('Szenario: ' + ex.name, (b, close) => {
      b.innerHTML = `<p style="margin-top:0">${esc(ex.desc || '')}</p><div class="btns"><button class="btn pri" data-s="live">▶ Live abspielen</button><button class="btn" data-s="calc">⚙ Gerechnet anzeigen</button></div><p class="hint2">Live: Du siehst die Anlage laufen, die Einstellungen ändern sich zu den festgelegten Zeiten. Gerechnet: Der Kern rechnet den Lauf im Hintergrund (runSeq) und zeigt Verlauf und Kennzahlen.</p>`;
      b.addEventListener('click', ev => { const x = ev.target.closest('[data-s]'); if (!x) return; close(); if (x.dataset.s === 'live') playScenario(ex); else runScenarioBg(ex); });
    });
  }
  function startClock(st) { if (st && fin(st.N) && fin(st.tS) && S.rig && typeof S.rig.setClock === 'function') { try { S.rig.setClock(st.N, st.tS); } catch (e) {} readState(); syncCtl(true); S.needDraw = true; } }
  function playScenario(ex) {
    if (S.task) { toast('Beende zuerst die Aufgabe.'); return; }
    stash(); S.name = ex.name; S.id = null; S.dirty = false; setRig(ex.rig && ORDER.includes(ex.rig) ? ex.rig : S.rigId, { run: true });
    applyCtl(ex.controls); startClock(ex.start);
    S.scen = ex.id; startLive(ex.seq, ex.dur || 3600, ex.name); setTab('rig'); buildScen(); updateChrome();
  }
  /* geplanten Ablauf live im Prüfstand ausführen: Schritte und Rampen, die fällig sind */
  function startLive(seq, dur, label) {
    const steps = (Array.isArray(seq) ? seq : []).filter(s => s && fin(+s.t)).map(s => ({ t: +s.t, set: s.set, ramp: s.ramp })).sort((a, b) => a.t - b.t);
    if (!steps.length) { toast('Das Szenario ist leer.'); return false; }
    S.live = { steps, i: 0, t: 0, end: fin(+dur) && dur > 0 ? +dur : steps[steps.length - 1].t + 60, ramps: [], label: label || '' }; S.running = true; updateChrome();
    toast('Szenario läuft live: ' + (label || '')); return true;
  }
  function liveApply() {
    const L = S.live; if (!L) return;
    while (L.i < L.steps.length && L.steps[L.i].t <= L.t + 1e-9) {
      const st = L.steps[L.i++];
      if (st.set && typeof st.set === 'object') Object.keys(st.set).forEach(k => setCtl(k, st.set[k], true));
      if (st.ramp && typeof st.ramp === 'object') { let from = NaN; try { from = +S.rig.getControl(st.ramp.key); } catch (e) {} L.ramps.push({ key: st.ramp.key, from, to: +st.ramp.to, t0: st.t, d: Math.max(1e-9, +st.ramp.durS || 1e-9) }); }
    }
    L.ramps = L.ramps.filter(r => { const f = clamp((L.t - r.t0) / r.d, 0, 1); if (fin(r.from)) setCtl(r.key, r.from + (r.to - r.from) * f, true); return f < 1; });
  }
  const liveNext = h => { const L = S.live; if (!L) return null; let n = L.i < L.steps.length ? L.steps[L.i].t : null; if (L.ramps.length) { const t = L.t + h; n = n == null ? t : Math.min(n, t); } return n; };
  function liveAdvance(dtMs) {
    const r = S.rig, L = S.live, h = Math.max(1e-6, +r.h || 1), rate = (r.tUnit === 'h' ? 1800 : 1) * S.speed; let left = dtMs / 1000 * rate, guard = 0;
    while (left > 1e-9 && S.live && guard++ < 400) {
      liveApply(); let c = Math.min(left, 2000 * h); const nx = liveNext(h); if (nx != null) c = Math.min(c, Math.max(h, nx - L.t));
      c = Math.max(Math.min(c, left), 1e-9); try { r.stepProcess(c); } catch (e) { console.error(e); S.live = null; break; } left -= c; L.t += c;
      if (L.t >= L.end) { liveDone(); break; }
    }
  }
  function liveDone() { const l = S.live; S.live = null; toast('Szenario beendet' + (l && l.label ? ': ' + l.label : '')); updateChrome(); }
  /* gerechnet: ENR_CORE.runSeq im Hintergrund, Ergebnis in einem Fenster */
  const SCENKEYS = { regler: ['pPv', 'pLoad', 'soc'], insel: ['pPv', 'pLoad', 'soc'], netz: ['pAc', 'pHaus', 'pNetz'], modul: ['pmpp', 'p'], schatten: ['pOp', 'pMpp', 'pFree'] };
  function runScenarioBg(ex) {
    const C = CORE(); if (!C || typeof C.runSeq !== 'function') { toast('Der Läufer (ENR_CORE.runSeq) ist nicht geladen.'); return; }
    toast('Rechne das Szenario …');
    setTimeout(() => {
      let res = null; try { res = C.runSeq(ex.rig, ex.seq, ex.dur || 3600, { controls: ex.controls, start: ex.start, seed: 1 }); } catch (e) { console.error('runSeq:', e); res = null; }
      if (!res || !Array.isArray(res.samples) || !res.samples.length) { toast('Der Lauf konnte nicht berechnet werden.'); return; }
      scenResultSheet(ex, res);
    }, 30);
  }
  function scenResultSheet(ex, res) {
    const d = defOf(ex.rig), meters = (d && d.meters) || [], keys = (SCENKEYS[ex.rig] || []).filter(k => meters.some(m => m.key === k)), tH = ex.rig && DAYRIGS.includes(ex.rig);
    sheet('Gerechnet: ' + ex.name, b => {
      const faults = (res.faults || []).filter(f => typeof f === 'string' && !masked({ id: f })), daily = res.metrics && Array.isArray(res.metrics.daily) ? res.metrics.daily : [];
      b.innerHTML = `<div class="chartbox"><canvas id="scCv" aria-label="Verlauf des gerechneten Szenarios"></canvas></div><div class="readout" id="scRd"></div>
        ${daily.length ? `<div class="gh">Tagesbilanz je Tag</div><div style="overflow-x:auto"><table class="kt"><tr><th>Tag</th><th class="n">Solar Wh</th><th class="n">Last Wh</th><th class="n">Ladezustand min %</th></tr>${daily.slice(0, 10).map((q, i) => `<tr><td>${fin(q.N) ? q.N : i + 1}</td><td class="n">${fnum(q.ePv != null ? q.ePv : q.ePvAc, 0)}</td><td class="n">${fnum(q.eLast != null ? q.eLast : q.eHaus, 0)}</td><td class="n">${fin(q.socMin) ? fnum(q.socMin * (q.socMin <= 1 ? 100 : 1), 0) : '–'}</td></tr>`).join('')}</table></div>` : ''}
        ${faults.length ? `<p style="color:var(--warn);margin:8px 0 0"><b>Meldungen im Lauf:</b> ${faults.map(esc).join(', ')}</p>` : '<p class="hint2">Keine Fehler im Lauf.</p>'}${res.errors && res.errors.length ? `<p class="hint2" style="color:var(--warn)">${res.errors.map(esc).join(' ')}</p>` : ''}`;
      const cv = $('#scCv', b), pal = ['#ffc83d', '#c792ea', '#8be28b'], series = keys.map((k, i) => ({ name: (meters.find(m => m.key === k) || {}).label || k, unit: (meters.find(m => m.key === k) || {}).unit || '', axis: i === 2 && k === 'soc' ? 'right' : undefined, color: pal[i % pal.length], line: ['solid', 'dot', 'dashdot'][i % 3], points: res.samples.map(s => [tH ? s.t / 3600 : s.t, +((s.meters || {})[k])]).filter(p => fin(p[1])) }));
      const curve = { kind: 'line', xLabel: tH ? 'Prozesszeit' : 'Prozesszeit', xUnit: tH ? 'h' : 's', yLabel: 'Messwerte', yUnit: '', series };
      let lay = null; const draw = () => { lay = drawChartOn(cv, curve, { aspect: 16 / 9 }); }; draw(); setTimeout(draw, 60);
      cv.addEventListener('pointermove', e => hoverOn(cv, curve, lay, e, $('#scRd', b), draw)); cv.addEventListener('pointerdown', e => hoverOn(cv, curve, lay, e, $('#scRd', b), draw));
    });
  }

  /* ---- Effekte (alles über LochFX, geschützt) ---- */
  let fxCool = {};
  function fxReset() { fxCool = {}; fxDrew = false; if (root.LochFX && root.LochFX.clear) try { root.LochFX.clear(); } catch (e) {} }
  const fxOn = () => !!(root.LochFX && !root.LochFX.isMuted());
  const fast = () => S.speed > 5;
  function fxEvent(e, ts) {
    const F = root.LochFX; if (!F) return;
    const id = e.id || e.fx || '', cd = 1500 * (S.speed > 1 ? S.speed : 1); if (ts - (fxCool[id] || -1e9) < cd) return; fxCool[id] = ts;
    const sc = Math.max(14, Math.min(34, cw / 28)), x = cw / 2, y = ch / 2, funny = F.isFun && F.isFun();
    try {
      if (id === 'hotspot') { if (e.kind === 'error') { F.sound('alarm', 0.6); F.explode(x, y, { part: 'ZELLE', why: 'Hotspot', kind: 'chip', color: '255,170,60', text: 'AUTSCH!', scale: sc * 0.7, sound: 'fizz', at: () => [x, y] }); if (F.say && funny) F.say('Autsch, die Zelle glüht!'); } else F.sound('buzz', 0.3); }
      else if (id === 'regler-tot' || id === 'wr-zerstoert') { F.explode(x, y, { part: id === 'regler-tot' ? 'REGLER' : 'WECHSELRICHTER', why: 'Überspannung', kind: 'chip', color: '255,170,60', scale: sc * 0.8, sound: 'crash', at: () => [x, y] }); if (F.say) F.say('Zu viel Spannung: Das Gerät ist defekt. Setze den Prüfstand zurück.'); }
      else if (id === 'ueberladung' || id === 'gasen') { F.sound('splash', 0.4); if (F.say && funny) F.say('Der Akku kocht!'); }
      else if (id === 'lvd-aus' || id === 'tiefentladung') F.sound('buzz', 0.5);
      else if (id === 'sonnenaufgang') F.sound('ding', 0.35);
      else if (id === 'akku-voll') { if (funny && F.confetti) F.confetti(false); else F.sound('ding', 0.4); }
      else if (id === 'netzausfall') { F.sound('clunk', 0.5); if (F.say && funny) F.say('Netz weg – ich schalte ab!'); }
      else if (id === 'wr-clipping') { if (F.say && funny) F.say('Zu viel Sonne!'); F.sound('boing', 0.3); }
      else if (e.fx === 'buzz' || e.fx === 'crash' || e.fx === 'ding' || e.fx === 'alarm') F.sound(e.fx, 0.4);
    } catch (er) { /* Effekte sind Beiwerk */ }
  }
  /* Verdeckte Fehler: Aufgaben der Fehlersuche blenden Meldungen/Hinweise bestimmter Diagnose-Kennungen (task.maskDiag) bis zum Ende der Aufgabe aus */
  function masked(x) { try { const t = curTask(); return !!(t && Array.isArray(t.maskDiag) && x && t.maskDiag.indexOf(x.id) >= 0); } catch (e) { return false; } }
  try { Object.defineProperty(root, 'ENR_VEIL', { configurable: true, get() { const o = {}; try { const t = curTask(); if (t && Array.isArray(t.maskDiag)) t.maskDiag.forEach(i => { o[i] = 1; }); } catch (e) {} return o; } }); } catch (e) {}
  function noteFault(e) {
    const key = S.rigId + ':' + (e.id || String(e.text || '').slice(0, 28));
    const a = lsGet('enr.faults', []), s = new Set(Array.isArray(a) ? a : []); if (s.has(key)) return;
    s.add(key); lsSet('enr.faults', [...s]); stat('enrfault', s.size, 'max');
  }
  /* neue Meldungen beobachten: Liste, Abzeichenstatistik, Effekte */
  let fxBudgetT = 0;
  function watchEvents(ts) {
    const r = S.rig; if (!r) return; const ev = r.events || [];
    let changed = false;
    for (let i = Math.max(0, ev.length - 30); i < ev.length; i++) {
      const e = ev[i]; if (!e || S.evSeen.has(e)) continue; S.evSeen.add(e); changed = true;
      if (masked(e)) continue;
      if (e.kind === 'error' || e.kind === 'warn' || e.fx) noteFault(e);
      if (e.id === 'lvd-aus') stat('enrlvd', 1, 'max');
      if (e.kind === 'error') { S.faultUntil = performance.now() + 9000; S.faultText = e.text; if (S.tab !== 'rig' && S.running) toast('⚠ ' + e.text); }
      if ((e.fx || e.kind === 'error' || /^(akku-voll|sonnenaufgang|netzausfall|wr-clipping|ueberladung|lvd-aus|hotspot)$/.test(e.id || '')) && (!fast() || ts - fxBudgetT > 700)) { fxBudgetT = ts; fxEvent(e, ts); }
    }
    if (changed || ev.length !== S.evLen) { S.evLen = ev.length; updateEvents(); }
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
    const F = root.LochFX; if (!F) return; F.setMuted(fxOn()); lsPut('enr.fx', fxOn() ? '1' : '0'); updateChrome(); toast(fxOn() ? 'Effekte und Ton an' : 'Ton aus');
    if (fxOn()) F.sound('ding', 0.6);
  }

  /* ---- Meldungsliste (Zeitstempel in Sonnenzeit bzw. Prozesszeit) und Hinweise aus rig.diagnose() ---- */
  function evTime(e) {
    if (e && fin(e.tS)) return hhmm(e.tS) + ' Sonnenzeit';
    const t = e && fin(+e.t) ? +e.t : 0; if (S.rig && S.rig.tUnit === 'h') return fnum(t / 3600, 1) + ' h'; return fnum(t, t >= 100 ? 0 : 1) + ' s';
  }
  function updateEvents(force) {
    const l = $('#evList'); if (!l) return; const ev = ((S.rig && S.rig.events) || []).filter(x => !masked(x));
    const sig = ev.length + '|' + (ev.length ? (ev[ev.length - 1].text || '') + (ev[ev.length - 1].t || '') : '');
    if (!force && sig === S.evSig) return; S.evSig = sig;
    l.innerHTML = ev.length ? ev.slice(-40).reverse().map(x => `<li class="${esc(x.kind || 'info')}"><time>${esc(evTime(x))}</time><span>${esc(x.text)}</span></li>`).join('') : '<li class="empty">Keine Meldungen. Meldet der Prüfstand etwas (zum Beispiel Sonnenaufgang oder einen Fehler), steht es hier.</li>';
  }
  $('#evClr').onclick = () => { if (S.rig && S.rig.events) { S.rig.events.length = 0; S.evSig = ''; updateEvents(true); } };
  let lastDiag = 0;
  function updateDiag(force) {
    const el = $('#diagList'); if (!el || !S.rig) return;
    const now = performance.now(); if (!force && now - lastDiag < 600) return; lastDiag = now;
    let d = []; try { d = typeof S.rig.diagnose === 'function' ? (S.rig.diagnose() || []) : []; } catch (e) { d = []; }
    d = d.filter(x => !masked(x)); S.diag = d; d.forEach(x => { if (x && x.id && !S.diagSeen[x.id]) S.diagSeen[x.id] = 1; });
    const h = d.length ? d.map(x => `<li class="${esc(x.kind || 'info')}"><span>${esc(x.text)}</span></li>`).join('') : '<li class="empty">Keine Hinweise: Zu den aktuellen Einstellungen meldet der Prüfstand nichts.</li>';
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  }

  /* ============================================================ Simulation */
  function setRun(on, auto) {
    if (on && !S.rig) { toast('Der Prüfstand ist noch nicht geladen.'); return; }
    S.running = !!on; if (!on && !auto) S.autoRun = false; updateChrome();
    if (on) { stat('enrrun', 1, 'max'); usedRig(); if (auto && !lsRaw('enr.autohint', '')) { lsPut('enr.autohint', '1'); toast('Der Prüfstand läuft jetzt. Mit ⏸ unten hältst du ihn an.'); } }
  }
  function resetRig(quiet) {
    if (!S.rig) return;
    try { S.rig.reset(); } catch (e) { console.error(e); }
    S.live = null; S.scen = null; S.simT = 0; S.ctl = {}; S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; fxReset();
    S.needDraw = true; readState(); syncCtl(true); updateMeters(); updateEvents(true); updateChrome(); buildScen(); drawDiag(true); if (!quiet) toast('Prüfstand zurückgesetzt');
  }
  function setSpeed(v) { S.speed = v; lsPut('enr.speed', String(v)); updateChrome(); }
  function simAdvance(dtMs) {
    const r = S.rig; if (!r) return;
    if (S.live) { liveAdvance(dtMs); return; }
    r.step(dtMs * S.speed);
  }
  function updateStat() {
    const sEl = $('#stat'); if (!sEl) return; const st = S.st || {};
    const when = S.rig && isDay() && fin(st.tS) ? hhmm(st.tS) + ' Uhr Sonnenzeit · Tag ' + st.N : (S.rig && S.rig.tUnit === 'h' ? 'Prozesszeit ' + fnum((st.t || 0) / 3600, 1) + ' h' : 'Prozesszeit ' + fnum(st.t || 0, 1) + ' s');
    const html = (S.running ? '<b class="run" style="color:var(--ok)">LÄUFT</b> ' : '<b>PAUSE</b> ') + esc(when) + (st.throttled ? ' · <b style="color:var(--warn)">Zeitraffer gedrosselt</b>' : '') + (S.live ? ' · Szenario ' + fnum(100 * S.live.t / S.live.end, 0) + ' %' : '');
    if (sEl.dataset.h !== html) { sEl.dataset.h = html; sEl.innerHTML = html; }
  }
  /* Abzeichen-Bedingungen aus dem Zustand */
  function checkBadges() {
    const st = S.st; if (!st || !S.rig) return;
    if (S.rigId === 'modul' && fin(st.anpass) && st.anpass >= 99 && st.G >= 100 && (st.lastart === 'widerstand' || st.lastart === 'spannung')) stat('enrmpp', 1, 'max');
    if (S.rigId === 'schatten') {
      if (fin(st.bypassN) && st.bypassN >= 1) stat('enrbypass', 1, 'max');
      if (st.mppt === 'global' && fin(st.nPeaks) && st.nPeaks >= 2 && fin(st.pOp) && fin(st.pMpp) && st.pMpp > 1 && st.pOp >= 0.97 * st.pMpp) stat('enrglobal', 1, 'max');
      if (st.schatten && st.schatten !== 'keiner') S.shadeUsed = true;
    }
    if (isDay() && fin(st.t) && st.t >= 86400) { S.dayRun = true; stat('enrtag', 1, 'max'); }
    if (S.rigId === 'regler' && st.lvdAktiv) stat('enrlvd', 1, 'max');
  }

  /* ============================================================ Diagramme (Canvas über ENR_CHART, Farben aus den Seitenvariablen) */
  const isDark = () => { const a = document.documentElement.getAttribute('data-theme'); if (a === 'dark') return true; if (a === 'light') return false; try { return !(root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches); } catch (e) { return true; } };
  let thKey = '', thVal = null;
  function chartTheme() {
    const key = (document.documentElement.getAttribute('data-theme') || '') + (isDark() ? 'd' : 'l');
    if (key !== thKey || !thVal) { thKey = key; thVal = CH() ? CH().theme(document.documentElement) : {}; if (!isDark()) thVal.light = true; }
    return thVal;
  }
  function prepCv(cv, aspect) {
    if (aspect && cv.dataset.ar !== String(aspect)) { cv.dataset.ar = String(aspect); cv.style.aspectRatio = String(aspect); }
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return null;
    const d = Math.min(2, root.devicePixelRatio || 1), W = Math.round(w * d), H = Math.round(h * d);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h); cv._d = d; return { g, w, h };
  }
  /* Diagramm in eine Canvas zeichnen; Rückgabe = Layout von ENR_CHART (für Fadenkreuz und Antippen) */
  function drawChartOn(cv, curve, o) {
    o = o || {}; const c = prepCv(cv, o.aspect || (cv.clientWidth < 520 ? 1.35 : 2)); if (!c) return null;
    if (!CH()) { c.g.fillStyle = '#8d99a6'; c.g.font = '600 14px system-ui'; c.g.textAlign = 'center'; c.g.fillText('Diagramme: enrchart.js ist nicht geladen', c.w / 2, c.h / 2); cv._lay = null; return null; }
    let lay = null; try { lay = CH().chart(c.g, { x: 0, y: 0, w: c.w, h: c.h }, curve, Object.assign({ colors: chartTheme() }, o.chartOpts || {})); } catch (e) { console.error('Diagramm:', e); }
    cv._lay = lay; cv._curve = curve; return lay;
  }
  const cvXY = (cv, e) => { const r = cv.getBoundingClientRect(); return r.width ? [(e.clientX - r.left) * cv.clientWidth / r.width, (e.clientY - r.top) * cv.clientHeight / r.height] : [0, 0]; };
  /* Fadenkreuz auf eine schon gezeichnete Canvas legen; gibt die Textzeile der Wertanzeige zurück */
  function crossOn(cv, px, py) {
    if (!cv || !cv._lay || !CH()) return ''; const g = cv.getContext('2d'); g.setTransform(cv._d || 1, 0, 0, cv._d || 1, 0, 0);
    let r = null; try { r = CH().crosshair(g, cv._lay, px, py, { colors: chartTheme() }); } catch (e) { r = null; } return r ? r.text : '';
  }
  function hoverOn(cv, curve, lay, e, readEl, redraw) {
    if (!cv || !(e.pointerType === 'mouse' || e.buttons || e.type === 'pointerdown')) return;
    const p = cvXY(cv, e); if (redraw) redraw(); const t = crossOn(cv, p[0], p[1]); if (readEl) readEl.textContent = t || '';
  }

  /* ---- Prüfstand: Diagramme unter der Szene (modul, schatten: I-U und P-U; regler: Ladekennlinie; insel, netz: Tagesgang) ---- */
  let lastDiagDraw = 0;
  function curvesOf() { let cs = []; try { cs = S.rig && typeof S.rig.curves === 'function' ? (S.rig.curves() || []) : []; } catch (e) { cs = []; } return Array.isArray(cs) ? cs : []; }
  function withGhost(cur) {
    if (!S.ghost || S.ghost.rig !== S.rigId || S.ghost.curveId !== cur.id) return cur;
    const c = Object.assign({}, cur); c.series = (cur.series || []).concat([{ name: S.ghost.name, points: S.ghost.points, color: '#9aa5b1', dash: [3, 4], axis: S.ghost.axis }]); return c;
  }
  function buildDiag() {
    const host = $('#diagHost'); if (!host) return;
    const ids = S.rig ? (DIAG[S.rigId] || []) : [];
    host.dataset.empty = ''; host.innerHTML = ids.length ? `<div class="dgrid">${ids.map(id => `<div class="card pl" data-cid="${id}" style="margin:0"><h4></h4><div class="chartbox"><canvas data-cid="${id}" aria-label="Diagramm ${id}"></canvas></div><div class="readout"></div></div>`).join('')}</div>` : '';
  }
  function drawDiag(force) {
    if (!S.rig || S.tab !== 'rig') return; const host = $('#diagHost'); if (!host || host.offsetParent === null) return;
    const now = performance.now(); if (!force && now - lastDiagDraw < 180) return; lastDiagDraw = now;
    const cs = curvesOf(), ids = DIAG[S.rigId] || [];
    if (!cs.length || !ids.some(id => cs.some(c => c.id === id))) {
      if (host.dataset.empty !== '1') { host.dataset.empty = '1'; host.innerHTML = `<p class="hint2" style="margin:8px 4px">${S.rigId === 'modul' ? 'Im Aufbau-Modus gibt es keine Kennlinie. Schalte die Ansicht auf „Kennlinie“.' : 'Für diese Einstellung liefert der Prüfstand zurzeit kein Diagramm.'}</p>`; }
      return;
    }
    if (host.dataset.empty === '1') buildDiag();
    $$('canvas[data-cid]', host).forEach(cv => {
      const cur = cs.find(c => c.id === cv.dataset.cid), card = cv.closest('.card'); if (!cur) { card.style.display = 'none'; return; } card.style.display = '';
      const h4 = $('h4', card), tt = cur.title || ''; if (h4.textContent !== tt) h4.textContent = tt;
      const lay = drawChartOn(cv, withGhost(cur), { aspect: cur.kind === 'bars' ? 1.6 : (cv.clientWidth < 520 ? 1.35 : (DAYRIGS.includes(S.rigId) ? 2.1 : 1.7)) });
      const rd = $('.readout', card);
      if (S.xh && S.xh.cid === cur.id && lay && !S.xh.gone) { const t = crossOn(cv, S.xh.px, S.xh.py); if (rd.textContent !== t) rd.textContent = t; }
      else if (rd.textContent) rd.textContent = '';
    });
  }
  $('#diagHost').addEventListener('pointermove', e => { const cv = e.target.closest && e.target.closest('canvas[data-cid]'); if (!cv || !(e.pointerType === 'mouse' || e.buttons)) return; const p = cvXY(cv, e); S.xh = { cid: cv.dataset.cid, px: p[0], py: p[1] }; drawDiag(true); });
  $('#diagHost').addEventListener('pointerdown', e => { const cv = e.target.closest && e.target.closest('canvas[data-cid]'); if (!cv) return; try { cv.setPointerCapture(e.pointerId); } catch (x) {} const p = cvXY(cv, e); S.xh = { cid: cv.dataset.cid, px: p[0], py: p[1] }; drawDiag(true); });
  $('#diagHost').addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { S.xh = null; drawDiag(true); } }, true);

  /* ============================================================ Messschreiber mit Zeitreise (rig.trace) */
  const SPANS = [['6 h', 6 * 3600], ['24 h', 86400], ['3 Tage', 3 * 86400], ['7 Tage', 7 * 86400]];
  const PREFKEYS = ['pPv', 'pLoad', 'soc', 'pAc', 'pHaus', 'pNetz', 'uBat', 'iBat', 'pBat'];
  const SCOPELINES = ['solid', 'dot', 'dashdot', 'dash'];
  let scopeAvail = [];
  function scopeKeys() {
    scopeAvail = []; if (!S.rig || typeof S.rig.trace !== 'function') return scopeAvail;
    let tr = null; try { tr = S.rig.trace(60); } catch (e) { tr = null; }
    const ks = tr && tr.series ? Object.keys(tr.series) : []; const ms = metersOf();
    ks.forEach(k => { const m = ms.find(q => q.key === k); if (m) scopeAvail.push({ key: k, label: m.label, unit: m.unit || '' }); else if (k === 'g') scopeAvail.push({ key: k, label: 'Einstrahlung in der Modulebene', unit: 'W/m²' }); });
    return scopeAvail;
  }
  function buildScope() {
    const host = $('#scopeHost'); if (!host) return; const av = scopeKeys();
    if (!av.length) { host.innerHTML = ''; S.scopeReady = false; return; }
    S.scopeReady = true;
    if (!S.scope.keys[S.rigId]) S.scope.keys[S.rigId] = PREFKEYS.filter(k => av.some(a => a.key === k)).slice(0, 3);
    if (!S.scope.span[S.rigId]) S.scope.span[S.rigId] = 86400; S.scope.off = 0;
    host.innerHTML = `<div class="scope"><div class="scbar"><span class="seg" role="group" aria-label="Zeitfenster">${SPANS.map(s => `<button data-sp="${s[1]}">${s[0]}</button>`).join('')}</span><span class="scinfo"></span></div>
      <div class="rbar" id="scKeys" style="padding-bottom:4px">${av.map(a => `<button class="chip s" data-sk="${esc(a.key)}" title="${esc(a.label)}">${esc(a.label.replace(/ \(.*\)$/, ''))}</button>`).join('')}</div>
      <div class="chartbox"><canvas class="scCv" aria-label="Messschreiber über der Prozesszeit"></canvas></div>
      <label class="f scrub"><span>Zeitreise: ziehe nach links, um zurückzuschauen</span><input type="range" class="scScrub" min="0" max="1000" step="1" value="1000"></label><div class="readout scRead"></div></div>`;
  }
  function scopeData() {
    const r = S.rig, span = S.scope.span[S.rigId] || 86400, st = S.st || {}, now = fin(st.t) ? st.t : 0; let full = null, tr = null;
    try { full = r.trace(7 * 86400); tr = r.trace(span + S.scope.off); } catch (e) { return null; }
    if (!tr || !Array.isArray(tr.t) || !tr.t.length) return null;
    const t0 = full && full.t.length ? full.t[0] : tr.t[0], maxOff = Math.max(0, now - t0 - span); S.scope.off = clamp(S.scope.off, 0, maxOff);
    const hi = now - S.scope.off, lo = hi - span, idx = []; tr.t.forEach((t, i) => { if (t >= lo - 1e-6 && t <= hi + 1e-6) idx.push(i); });
    return { tr, idx, lo, hi, span, maxOff, now };
  }
  function drawScope() {
    const box = $('.scope'); if (!box || !S.rig || S.tab !== 'rig' || box.offsetParent === null) return;
    const cv = $('.scCv', box), info = $('.scinfo', box), scr = $('.scScrub', box), rd = $('.scRead', box), D = scopeData();
    $$('[data-sp]', box).forEach(b => b.classList.toggle('on', +b.dataset.sp === (S.scope.span[S.rigId] || 86400)));
    const sel = S.scope.keys[S.rigId] || []; $$('[data-sk]', box).forEach(b => b.classList.toggle('on', sel.includes(b.dataset.sk)));
    if (!D) { drawChartOn(cv, { kind: 'line', series: [] }, { aspect: 2.4 }); if (info) info.textContent = ''; return; }
    const big = D.span >= 3 * 86400, dv = big ? 86400 : 3600;
    const series = sel.map((k, i) => { const a = scopeAvail.find(q => q.key === k); if (!a || !D.tr.series[k]) return null; return { name: a.label, unit: a.unit, axis: a.unit === '%' && sel.length > 1 ? 'right' : undefined, line: SCOPELINES[i % 4], points: D.idx.map(j => [D.tr.t[j] / dv, +D.tr.series[k][j]]).filter(p => fin(p[1])) }; }).filter(Boolean);
    const curve = { kind: 'line', xLabel: 'Prozesszeit', xUnit: big ? 'd' : 'h', yLabel: 'Messwerte', yUnit: '', series, xMin: D.lo / dv, xMax: D.hi / dv };
    drawChartOn(cv, curve, { aspect: cv.clientWidth < 520 ? 1.5 : 2.4 });
    if (info) { const t = 'Fenster ' + (SPANS.find(s => s[1] === D.span) || ['', D.span])[0] + (S.scope.off > 0 ? ' · zurückgeschaut' : ' · live'); if (info.textContent !== t) info.textContent = t; }
    if (scr && document.activeElement !== scr) scr.value = D.maxOff > 0 ? String(Math.round(1000 * (1 - S.scope.off / D.maxOff))) : '1000';
    if (scr) scr.disabled = !(D.maxOff > 0);
    if (S.scope.cur && cv._lay) { const t = crossOn(cv, S.scope.cur[0], S.scope.cur[1]); if (rd.textContent !== t) rd.textContent = t; } else if (rd.textContent) rd.textContent = '';
  }
  $('#scopeHost').addEventListener('click', e => {
    const sp = e.target.closest('[data-sp]'), sk = e.target.closest('[data-sk]');
    if (sp) { S.scope.span[S.rigId] = +sp.dataset.sp; S.scope.off = 0; drawScope(); }
    else if (sk) { const k = sk.dataset.sk, a = (S.scope.keys[S.rigId] = S.scope.keys[S.rigId] || []), i = a.indexOf(k); if (i >= 0) a.splice(i, 1); else if (a.length < 4) a.push(k); else toast('Du kannst höchstens vier Größen zugleich anzeigen.'); drawScope(); }
  });
  $('#scopeHost').addEventListener('input', e => { if (!e.target.classList.contains('scScrub')) return; const D = scopeData(); if (!D) return; S.scope.off = D.maxOff * (1 - (+e.target.value) / 1000); drawScope(); });
  $('#scopeHost').addEventListener('pointermove', e => { const cv = e.target.closest && e.target.closest('.scCv'); if (!cv || !(e.pointerType === 'mouse' || e.buttons)) return; S.scope.cur = cvXY(cv, e); drawScope(); });
  $('#scopeHost').addEventListener('pointerdown', e => { const cv = e.target.closest && e.target.closest('.scCv'); if (!cv) return; try { cv.setPointerCapture(e.pointerId); } catch (x) {} S.scope.cur = cvXY(cv, e); drawScope(); });
  $('#scopeHost').addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { S.scope.cur = null; drawScope(); } }, true);

  /* ============================================================ Aufzeichnung und Kurven als CSV (Dezimalkomma, Semikolon) mit Rückleser (Roundtrip-Test) */
  const csvNum = v => (fin(v) ? String(+(+v).toPrecision(9)).replace('.', ',') : '');
  const CSVHEAD = 'Kurve;Reihe;x;y;Einheit x;Einheit y';
  function curvesCsv() {
    const rows = [CSVHEAD];
    curvesOf().forEach(c => {
      (c.series || []).forEach(s => (s.points || []).forEach(p => { if (fin(p[0]) && fin(p[1])) rows.push([c.id, s.name, csvNum(p[0]), csvNum(p[1]), c.xUnit || '', s.unit || c.yUnit || ''].join(';')); }));
      (c.stack || []).forEach(s => (s.points || []).forEach(p => { if (fin(p[0]) && fin(p[1])) rows.push([c.id, s.name, csvNum(p[0]), csvNum(p[1]), c.xUnit || '', c.yUnit || ''].join(';')); }));
      (c.bars || []).forEach(b => { if (fin(b.value)) rows.push([c.id, b.label, '', csvNum(b.value), '', b.unit || ''].join(';')); });
    });
    return rows.join('\r\n') + '\r\n';
  }
  function parseCsv(txt) {
    const lines = String(txt).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean), out = [];
    lines.slice(1).forEach(l => { const c = l.split(';'); if (c.length < 6) return; const x = c[2] === '' ? null : parseFloat(c[2].replace(',', '.')), y = parseFloat(c[3].replace(',', '.')); if (fin(y) && (x === null || fin(x))) out.push({ curve: c[0], series: c[1], x, y, xu: c[4], yu: c[5] }); });
    return out;
  }
  function saveCsv(txt, fallbackName) {
    const blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' });
    if (root.LabExport) root.LabExport.saveBlob(blob, root.LabExport.fname('csv'));
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fallbackName; document.body.appendChild(a); a.click(); a.remove(); }
  }
  function exportCsv() {
    const txt = curvesCsv(); if (txt.split('\n').length < 3) { toast('Es gibt noch keine Kurvendaten. Stelle einen Prüfstand ein und lass ihn laufen.'); return; }
    saveCsv(txt, 'energie-kurven.csv'); toast('CSV mit ' + (txt.split('\n').length - 2) + ' Zeilen gespeichert');
  }

  /* ============================================================ Tab Kennlinien */
  const IVIDS = ['iu', 'pu', 'schar-iu', 'schar-pu', 'p-r'];
  function specIdOfRig() { if (!S.rig) return null; try { const v = S.rig.getControl(S.rigId === 'modul' || S.rigId === 'schatten' ? 'preset' : 'modul'); return typeof v === 'string' ? v : null; } catch (e) { return null; } }
  function datasheetHtml() {
    const C = CORE(); if (!C || !C.pv || typeof C.pv.datasheet !== 'function') return '';
    const id = specIdOfRig(); if (!id) return '';
    let ds = null; try { ds = C.pv.datasheet(C.pv.spec(id)); } catch (e) { ds = null; }
    if (!ds || !Array.isArray(ds.rows) || !ds.rows.length) return '';
    return `<details class="card" open><summary>Moduldatenblatt (Übungsmodul, Werte aus dem Modell)</summary><div class="cb"><div class="enr-tbl"><table class="kt"><tr><th>Größe</th><th class="n">Wert</th><th>Einheit</th></tr>${ds.rows.map(r => `<tr><td>${esc(r.label)}</td><td class="n">${esc(typeof r.value === 'number' ? fds(r.value) : r.value)}</td><td>${esc(r.unit || '')}</td></tr>`).join('')}</table></div>${ds.note ? `<p class="hint2">${esc(ds.note)}</p>` : ''}</div></details>`;
  }
  function tablesHtml() {
    let ts = []; try { ts = S.rig && typeof S.rig.tables === 'function' ? (S.rig.tables() || []) : []; } catch (e) { ts = []; }
    return ts.map(t => `<details class="card" open><summary>${esc(t.title || 'Tabelle')}</summary><div class="cb"><div class="enr-tbl" style="overflow-x:auto"><table class="kt"><tr>${(t.head || []).map((h, i) => `<th${i ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr>${(t.rows || []).map(r => `<tr>${r.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(typeof c === 'number' ? fds(c) : c)}</td>`).join('')}</tr>`).join('')}</table></div></div></details>`).join('');
  }
  let crvLay = null;
  function renderCurveTab() {
    const V = $('#curveView'); if (!V) return;
    if (!S.rig) { V.innerHTML = '<div class="card pl">' + placeholderHtml() + '</div>'; return; }
    const cs = curvesOf(); let sel = S.curSel[S.rigId]; if (!cs.some(c => c.id === sel) && cs.length) sel = S.curSel[S.rigId] = cs[0].id;
    const interactive = S.rigId === 'modul' && cs.some(c => IVIDS.includes(c.id));
    V.innerHTML = `<div class="card pl"><h4>Kennlinien: ${esc(rigIcon(S.rigId))} ${esc(rigName(S.rigId))}</h4>
      <div class="rbar" id="cvRigs">${ORDER.map(id => `<button class="chip s${id === S.rigId ? ' on' : ''}" data-rg="${id}">${rigIcon(id)} ${esc(RIGMETA[id].short)}</button>`).join('')}</div>
      ${cs.length ? `<div class="rbar" id="crvSel">${cs.map(c => `<button class="chip s${c.id === sel ? ' on' : ''}" data-cid="${esc(c.id)}">${esc(c.title || c.id)}</button>`).join('')}</div>
      <div class="chartbox"><canvas id="crvCv" aria-label="Kennlinie des Prüfstands"></canvas></div><div class="readout" id="crvRead"></div>
      <p class="hint2" style="margin-top:2px">${interactive ? 'Tippe auf die Kurve oder ziehe darüber: Der Arbeitspunkt des Prüfstands springt dorthin (Lastart „Spannung vorgeben“ beziehungsweise Lastwiderstand).' : 'Fahre mit der Maus über das Diagramm oder tippe darauf: Das Fadenkreuz zeigt die Werte.'}</p>` : `<p class="hint2">Für diese Einstellung liefert der Prüfstand keine Kennlinie.${S.rigId === 'modul' ? ' Schalte im Bedienpult die Ansicht auf „Kennlinie“.' : ''}</p>`}
      <div class="btns"><button class="btn" data-ck="csv">⬇ Kurven als CSV</button><button class="btn" data-ck="rig">🎛️ Zum Prüfstand</button></div></div>
      ${S.rigId === 'modul' ? assistantHtml() : ''}${tablesHtml()}${S.rigId !== 'modul' ? datasheetHtml() : ''}`;
    drawCurveTab(true); if (S.rigId === 'modul') drawAssistant();
  }
  function drawCurveTab() {
    const cv = $('#crvCv'); if (!cv || !S.rig || cv.offsetParent === null) return;
    const cs = curvesOf(), cur = cs.find(c => c.id === S.curSel[S.rigId]) || cs[0]; if (!cur) return;
    crvLay = drawChartOn(cv, withGhost(cur), { aspect: cur.kind === 'bars' ? 1.5 : (cv.clientWidth < 520 ? 1.2 : cv.clientWidth > 900 ? 2.4 : 1.8) });
    if (S.xh && S.xh.cid === 'crv' && crvLay) { const t = crossOn(cv, S.xh.px, S.xh.py), rd = $('#crvRead'); if (rd && rd.textContent !== t) rd.textContent = t; }
  }
  function crvSet(px, py) {
    const cv = $('#crvCv'); if (!cv || !cv._lay || !S.rig) return;
    const cur = cv._curve || {}, lay = cv._lay;
    if (S.rigId === 'modul' && IVIDS.includes(cur.id) && lay.plot && px >= lay.plot.x && px <= lay.plot.x + lay.plot.w) {
      const x = lay.xAt(px), st = readState() || {};
      if (cur.id === 'p-r') { if (fin(x) && x > 0) { setCtl('lastart', 'widerstand', true); setCtl('rLast', x); } }
      else if (fin(st.uoc) && st.uoc > 0 && fin(x)) { setCtl('lastart', 'spannung', true); setCtl('uFrac', clamp(x / st.uoc * 100, 0, 105)); }
    }
    S.xh = { cid: 'crv', px, py }; drawCurveTab(); const rd = $('#crvRead'); if (rd) rd.textContent = crossOn(cv, px, py);
  }
  (function () {
    const V = $('#curveView');
    V.addEventListener('click', e => {
      const rg = e.target.closest('[data-rg]'), cid = e.target.closest('#crvSel [data-cid]'), ck = e.target.closest('[data-ck]'), as = e.target.closest('[data-as]'), mk = e.target.closest('[data-mk]');
      if (rg) { if (S.task && rg.dataset.rg !== S.rigId) { toast('Während einer Aufgabe ist der Prüfstand fest.'); return; } if (rg.dataset.rg !== S.rigId) { saveCur(); stash(); S.name = 'Neuer Versuch'; S.id = null; S.dirty = false; useRig(rg.dataset.rg); } renderCurveTab(); }
      else if (cid) { S.curSel[S.rigId] = cid.dataset.cid; S.xh = null; renderCurveTab(); }
      else if (ck) { if (ck.dataset.ck === 'csv') exportCsv(); else setTab('rig'); }
      else if (as) assistAct(as.dataset.as, as);
      else if (mk) { const i = +mk.dataset.i, k = mk.dataset.mk; if (S.curveMarks[k] === i) delete S.curveMarks[k]; else S.curveMarks[k] = i; S.curveCmp = null; renderCurveTab(); }
    });
    V.addEventListener('change', e => { if (e.target.id === 'asStep') { S.curveStep = e.target.value; } });
    V.addEventListener('pointerdown', e => { const cv = e.target.closest && e.target.closest('#crvCv'); if (!cv) return; try { cv.setPointerCapture(e.pointerId); } catch (x) {} const p = cvXY(cv, e); crvSet(p[0], p[1]); });
    V.addEventListener('pointermove', e => { const cv = e.target.closest && e.target.closest('#crvCv'); if (!cv || !(e.pointerType === 'mouse' ? true : e.buttons)) return; if (e.pointerType === 'mouse' && !e.buttons) { const p = cvXY(cv, e); S.xh = { cid: 'crv', px: p[0], py: p[1] }; drawCurveTab(); const rd = $('#crvRead'); if (rd) rd.textContent = crossOn(cv, p[0], p[1]); return; } const p = cvXY(cv, e); crvSet(p[0], p[1]); });
    V.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { S.xh = null; drawCurveTab(); const rd = $('#crvRead'); if (rd) rd.textContent = ''; } }, true);
  })();

  /* ---- Assistent "Kennlinie selbst aufnehmen" (nur Prüfstand modul) ---- */
  const STEPF = { fein: 1.3, mittel: 2, grob: 3 };
  const TOL = { uoc: 3, isc: 3, mpp: 5 };           // Toleranzen in Prozent (SPEC 6.3, Annahme A17)
  function assistantHtml() {
    const pts = S.curvePts, mk = S.curveMarks, cmp = S.curveCmp, rl = S.rig ? S.rig.getControl('rLast') : NaN;
    return `<div class="card pl" id="asCard"><h4>Kennlinie selbst aufnehmen</h4>
      <p class="hint2" style="margin-top:0">So misst du wie im Labor: Du stellst nacheinander verschiedene Lastwiderstände ein, speicherst jeden Messpunkt und markierst am Ende Leerlauf, Kurzschluss und MPP. Erst danach zeigt dir die App die Modellkurve und die Abweichung.</p>
      <div class="frm"><label class="f"><span>Schrittweite der Lastwiderstände (Faktor je Schritt)</span><select id="asStep">${Object.keys(STEPF).map(k => `<option value="${k}"${S.curveStep === k ? ' selected' : ''}>${k} (Faktor ${String(STEPF[k]).replace('.', ',')})</option>`).join('')}</select></label><div class="kvs"><span>Lastwiderstand jetzt</span><b>${fin(rl) ? fauto(rl) + ' Ω' : '–'}</b></div></div>
      <div class="btns"><button class="btn" data-as="prep">① Messaufbau</button><button class="btn" data-as="next">② Nächster Widerstand</button><button class="btn pri" data-as="save">③ Messpunkt speichern</button></div>
      ${pts.length ? `<div style="overflow-x:auto"><table class="kt"><tr><th class="n">Nr.</th><th class="n">R in Ω</th><th class="n">U in V</th><th class="n">I in A</th><th class="n">P in W</th><th>Markieren als</th><th></th></tr>${pts.map((p, i) => `<tr><td class="n">${i + 1}</td><td class="n">${fin(p.r) ? fauto(p.r) : '–'}</td><td class="n">${fnum(p.u, 2)}</td><td class="n">${fnum(p.i, 3)}</td><td class="n">${fnum(p.p, 2)}</td><td>${[['uoc', 'Uoc'], ['isc', 'Isc'], ['mpp', 'MPP']].map(m => `<button class="chip s${mk[m[0]] === i ? ' on' : ''}" data-mk="${m[0]}" data-i="${i}" aria-pressed="${mk[m[0]] === i}">${m[1]}</button>`).join(' ')}</td><td><button class="chip s danger" data-as="del" data-i="${i}" aria-label="Messpunkt ${i + 1} löschen">✕</button></td></tr>`).join('')}</table></div>` : '<p class="hint2">Noch kein Messpunkt gespeichert. Tippe auf ① und dann auf ③.</p>'}
      <div class="dgrid"><div class="chartbox"><canvas id="asIU" aria-label="Messpunkte im I-U-Diagramm"></canvas></div><div class="chartbox"><canvas id="asPU" aria-label="Messpunkte im P-U-Diagramm"></canvas></div></div>
      <div class="btns"><button class="btn danger" data-as="clr"${pts.length ? '' : ' disabled'}>Alles löschen</button><button class="btn pri" data-as="cmp"${pts.length ? '' : ' disabled'}>④ Mit dem Modell vergleichen</button></div>
      ${cmp ? cmpHtml(cmp) : ''}</div>`;
  }
  function assistMeta() { const st = readState() || {}; return { G: st.G, tc: st.tcell, preset: S.rig ? S.rig.getControl('preset') : null, ns: st.ns, np: st.np }; }
  function persistCurve() { lsSet('enr.curve', S.curvePts); S.dirty = true; saveCurSoon(); }
  function assistAct(a, btn) {
    if (!S.rig || S.rigId !== 'modul') return;
    if (a === 'prep') { setCtl('view', 'kennlinie', true); setCtl('lastart', 'widerstand', true); setCtl('rLast', 500); toast('Messaufbau: Lastart „Widerstand“, Lastwiderstand 500 Ω (fast Leerlauf). Speichere jetzt den ersten Messpunkt.'); renderCurveTab(); }
    else if (a === 'next') { const f = STEPF[S.curveStep] || 2, r = +S.rig.getControl('rLast'); setCtl('lastart', 'widerstand', true); const nr = fin(r) ? r / f : 500; if (nr < 0.05) toast('Kleiner geht der Lastwiderstand nicht (Kurzschlusspunkt).'); setCtl('rLast', Math.max(0.05, nr)); renderCurveTab(); }
    else if (a === 'save') {
      if (S.curvePts.length >= 20) { toast('Du hast schon 20 Messpunkte. Lösche Punkte oder vergleiche.'); return; }
      const st = readState() || {}, m = S.rig.readMeters() || {};
      if (!(st.G >= 1)) { toast('Nacht: Das Modul liefert nichts. Stelle eine Einstrahlung ein.'); return; }
      if (st.lastart !== 'widerstand' && st.lastart !== 'spannung') { toast('Stelle die Lastart auf „Widerstand“ (Taste ① richtet es ein).'); return; }
      const p = { u: +m.u, i: +m.i, p: +m.p, r: st.lastart === 'widerstand' ? +S.rig.getControl('rLast') : null };
      if (![p.u, p.i, p.p].every(fin)) { toast('Der Prüfstand liefert keinen gültigen Messwert.'); return; }
      if (S.curvePts.length === 0) S.curveMeta = assistMeta();
      S.curvePts.push(p); S.curveCmp = null; persistCurve(); clickSnd('tick'); renderCurveTab();
    } else if (a === 'del') { const i = +btn.dataset.i; S.curvePts.splice(i, 1); ['uoc', 'isc', 'mpp'].forEach(k => { if (S.curveMarks[k] === i) delete S.curveMarks[k]; else if (S.curveMarks[k] > i) S.curveMarks[k]--; }); S.curveCmp = null; persistCurve(); renderCurveTab(); }
    else if (a === 'clr') { S.curvePts = []; S.curveMarks = {}; S.curveCmp = null; persistCurve(); renderCurveTab(); }
    else if (a === 'cmp') compareCurve();
  }
  /* Vergleich mit dem Modell: Messwerte aus den markierten Punkten, Sollwerte aus rig.analysis() (= pv.keys), Ampel mit Toleranz */
  function compareCurve() {
    const pts = S.curvePts, mk = S.curveMarks, miss = [['uoc', 'Leerlauf (Uoc)'], ['isc', 'Kurzschluss (Isc)'], ['mpp', 'MPP']].filter(m => mk[m[0]] === undefined).map(m => m[1]);
    if (pts.length < 3) { toast('Speichere mindestens drei Messpunkte, besser zehn.'); return; }
    if (miss.length) { toast('Markiere erst noch: ' + miss.join(', ') + '.'); return; }
    let an = null; try { an = S.rig.analysis(); } catch (e) { an = null; }
    if (!an || an.ok === false || !an.keys || !fin(an.keys.Uoc)) { toast('Der Prüfstand liefert zurzeit keine Modellwerte (Nacht oder Kern fehlt).'); return; }
    const K = an.keys, uoc = pts[mk.uoc].u, isc = pts[mk.isc].i, pm = pts[mk.mpp].p;
    const row = (id, name, meas, model, unit, tol, lo, hi) => {
      const dev = model > 0 ? 100 * (meas - model) / model : NaN, a = Math.abs(dev);
      const state = !fin(dev) ? 'x' : a <= tol ? 'g' : a <= 2 * tol ? 'y' : 'r';
      const txt = state === 'g' ? 'in Ordnung' : state === 'x' ? 'nicht vergleichbar' : (dev < 0 ? lo : hi);
      return { id, name, meas, model, unit, dev, tol, state, text: txt };
    };
    const rows = [
      row('uoc', 'Leerlaufspannung Uoc', uoc, K.Uoc, 'V', TOL.uoc, 'Dein Wert ist zu klein. Der Leerlaufpunkt hat die größte Spannung und den kleinsten Strom: Miss noch bei größerem Lastwiderstand weiter oder wähle den Punkt mit der höchsten Spannung.', 'Dein Wert ist größer als das Modell. Hast du zwischen den Messungen Einstrahlung oder Temperatur verändert?'),
      row('isc', 'Kurzschlussstrom Isc', isc, K.Isc, 'A', TOL.isc, 'Dein Wert ist zu klein. Der Kurzschlusspunkt hat den größten Strom bei kleinster Spannung: Miss noch mit kleinerem Lastwiderstand weiter.', 'Dein Wert ist größer als das Modell. Hast du zwischen den Messungen die Einstrahlung verändert?'),
      row('mpp', 'Maximale Leistung Pmpp', pm, K.Pmpp, 'W', TOL.mpp, 'Dein Wert ist zu klein. Vielleicht fehlt ein Messpunkt nahe dem Knick der Kennlinie: Miss dort enger.', 'Dein Wert ist größer als das Modell. Hast du zwischen den Messungen Einstrahlung oder Temperatur verändert?')
    ];
    const maxP = pts.reduce((b, p, i) => (p.p > pts[b].p ? i : b), 0), maxU = pts.reduce((b, p, i) => (p.u > pts[b].u ? i : b), 0), maxI = pts.reduce((b, p, i) => (p.i > pts[b].i ? i : b), 0), notes = [];
    if (maxP !== mk.mpp && pts[maxP].p > pts[mk.mpp].p * 1.0005) notes.push('Der Punkt ' + (maxP + 1) + ' hat eine größere Leistung als dein markierter MPP (Punkt ' + (mk.mpp + 1) + ').');
    if (maxU !== mk.uoc && pts[maxU].u > pts[mk.uoc].u * 1.0005) notes.push('Der Punkt ' + (maxU + 1) + ' hat eine größere Spannung als dein markierter Leerlaufpunkt (Punkt ' + (mk.uoc + 1) + ').');
    if (maxI !== mk.isc && pts[maxI].i > pts[mk.isc].i * 1.0005) notes.push('Der Punkt ' + (maxI + 1) + ' hat einen größeren Strom als dein markierter Kurzschlusspunkt (Punkt ' + (mk.isc + 1) + ').');
    const meta = S.curveMeta, now = assistMeta(); if (meta && (meta.G !== now.G || meta.preset !== now.preset || meta.ns !== now.ns || meta.np !== now.np || Math.abs((meta.tc || 0) - (now.tc || 0)) > 0.5)) notes.push('Einstrahlung, Temperatur oder Schaltung haben sich seit dem ersten Messpunkt geändert. Das Modell gilt für die Einstellungen von jetzt.');
    S.curveCmp = { rows, notes, n: pts.length }; S.curveTaken = true; if (pts.length >= 6) stat('enrkurve', 1, 'max');
    renderCurveTab(); const c = $('#asRes'); if (c && c.scrollIntoView) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  const AMPEL = { g: '🟢', y: '🟡', r: '🔴', x: '⚪' };
  function cmpHtml(c) {
    return `<div id="asRes" class="res"><b>Ergebnis des Vergleichs (${c.n} Messpunkte)</b><table class="kt" style="margin-top:6px"><tr><th></th><th>Größe</th><th class="n">Gemessen</th><th class="n">Modell</th><th class="n">Abweichung</th></tr>${c.rows.map(r => `<tr><td>${AMPEL[r.state]}</td><td>${esc(r.name)}</td><td class="n">${fauto(r.meas)} ${esc(r.unit)}</td><td class="n">${fauto(r.model)} ${esc(r.unit)}</td><td class="n">${fin(r.dev) ? (r.dev >= 0 ? '+' : '') + fnum(r.dev, 1) + ' %' : '–'}</td></tr>`).join('')}</table>
      <ul class="tl">${c.rows.map(r => `<li class="${r.state === 'g' ? 'ok' : 'bad'}">${esc(r.name)}: ${esc(r.text)} (Toleranz ${r.tol} %)</li>`).join('')}${c.notes.map(n => `<li class="bad">${esc(n)}</li>`).join('')}</ul></div>`;
  }
  /* Messpunkte (Punkte), nach dem Vergleich zusätzlich die Modellkurve */
  function drawAssistant() {
    const a = $('#asIU'), b = $('#asPU'); if (!a || !b || !S.rig) return;
    const pts = S.curvePts, cs = curvesOf(), mIU = cs.find(c => c.id === 'iu'), mPU = cs.find(c => c.id === 'pu'), cmp = S.curveCmp;
    const mk = S.curveMarks, mkOf = (k, ycoord) => (mk[k] !== undefined && pts[mk[k]] ? { x: pts[mk[k]].u, y: pts[mk[k]][ycoord], label: { uoc: 'Uoc', isc: 'Isc', mpp: 'MPP' }[k] } : null);
    const mk1 = ['uoc', 'isc', 'mpp'].map(k => mkOf(k, 'i')).filter(Boolean), mk2 = ['mpp'].map(k => mkOf(k, 'p')).filter(Boolean);
    const mkCurve = (title, xs, ys, model, marks, unit) => {
      const series = [{ name: 'Deine Messpunkte', points: pts.map(p => [p.u, p[ys]]), dots: true, color: '#ff7a59' }];
      if (cmp && model && model.series && model.series[0]) series.push({ name: 'Modellkurve', points: model.series[0].points, color: '#4ea1ff', bold: true });
      return { kind: 'iv', title, xLabel: 'Spannung U', xUnit: 'V', yLabel: ys === 'i' ? 'Strom I' : 'Leistung P', yUnit: unit, series, marks: marks };
    };
    drawChartOn(a, mkCurve('Messpunkte I(U)', 'u', 'i', mIU, mk1, 'A'), { aspect: 1.5 }); drawChartOn(b, mkCurve('Messpunkte P(U)', 'u', 'p', mPU, mk2, 'W'), { aspect: 1.5 });
  }

  /* ============================================================ Beispiele (ENR_DATA.examples, eingebauter Rückfall ohne Zahlen im Text) */
  const B = (id, name, cat, rig, desc, controls, extra) => Object.assign({ id, name, cat, rig, desc, controls }, extra || {});
  const BUILTIN = [
    B('bx-modul', 'Modul bei Standardbedingungen', 'Modul', 'modul', 'Das Modul arbeitet an einem Lastwiderstand. Verändere Einstrahlung und Temperatur und beobachte Kennlinie und Arbeitspunkt.', { preset: 'si60', G: 1000 }),
    B('bx-insel', 'Inselanlage über den Tag', 'Inselanlage', 'insel', 'Die Sonne wandert über den Himmel, das Feld lädt über den Laderegler den Akku, die Last läuft.', {}),
    B('bx-netz', 'Netzanlage mit Haushalt', 'Netz', 'netz', 'Der Wechselrichter speist ein, der Haushalt verbraucht, der Zähler zählt beide Richtungen.', {})
  ];
  let exCache = null;
  function exampleList() {
    if (exCache) return exCache;
    const d = root.ENR_DATA; let a = null; try { a = d && d.examples; } catch (e) { console.error('Beispiele:', e); a = null; }
    if (a && !Array.isArray(a)) a = Object.keys(a).map(k => Object.assign({ id: k }, a[k]));
    if (!a || !a.length) return BUILTIN;
    exCache = a.filter(e => e && !e.error).map(e => ({ id: e.id, name: e.name, cat: e.cat || 'Beispiele', desc: e.desc || e.text || '', rig: e.rig, controls: e.controls || {}, dur: e.dur, start: e.start, seq: Array.isArray(e.seq) ? e.seq : null }));
    return exCache.length ? exCache : BUILTIN;
  }
  function loadExample(e) {
    if (typeof e === 'string') { const n = e.toLowerCase(); e = exampleList().find(x => x.id === e || x.name.toLowerCase().includes(n)); }
    if (!e) return false; const had = stash(); S.task = null;
    setRig(e.rig && ORDER.includes(e.rig) ? e.rig : S.rigId || ORDER[0], { run: true });
    applyCtl(e.controls); startClock(e.start);
    S.name = e.name; S.id = null; S.dirty = false; S.scen = null;
    if (e.seq && e.seq.length) { S.scen = e.id; startLive(e.seq, e.dur, e.name); }
    setTab('rig'); updateChrome(); buildScen(); saveCurSoon();
    toast(had ? 'Beispiel geladen, dein Versuch ist gesichert' : 'Beispiel geladen: ' + e.name);
    return true;
  }
  const loadExampleByName = n => loadExample(String(n || ''));
  function openExamples() {
    const ex = exampleList(); buildScen();
    sheet('Beispielversuche', (b, close) => {
      let last = '', h = '<p class="hint2" style="margin-top:0">Tippe ein Beispiel an: Prüfstand und Einstellungen werden geladen. Dein bisheriger Versuch wird vorher gesichert.</p>';
      ex.forEach((e, i) => { if (e.cat !== last) { last = e.cat; h += `<div class="gh">${esc(e.cat)}</div>`; } h += `<button class="row" data-i="${i}"><span style="font-size:22px;display:inline-block;width:32px;text-align:center;flex:none">${rigIcon(e.rig)}</span><div class="grow"><b>${esc(e.name)}</b><small>${esc(e.desc)}${e.seq && e.seq.length ? ' · mit Szenario' : ''}</small></div></button>`; });
      b.innerHTML = h;
      b.addEventListener('click', ev => { const r = ev.target.closest('.row'); if (!r) return; close(); loadExample(ex[+r.dataset.i]); });
    });
  }

  /* ============================================================ Speichern, Öffnen, Teilen (Zustand = Prüfstand, Steuerwerte, Uhr, Auslegung, Messpunkte) */
  const PK = 'enr.saves';
  const saves = () => { const a = lsGet(PK, []); return Array.isArray(a) ? a : []; };
  const extOf = k => root.ENR_UI_EXT && root.ENR_UI_EXT[k];
  function designState() { const D = extOf('design'); try { return D && typeof D.getState === 'function' ? D.getState() : null; } catch (e) { return null; } }
  /* Zahlen auf sechs Nachkommastellen runden: Rundungsreste der Rechnung (7,499999999999995 gegen 7,499999999999993) dürfen den Rundlauf Speichern → Link → Laden nicht stören */
  const rnd6 = v => (typeof v === 'number' && isFinite(v) ? +v.toFixed(6) : v);
  function stateObj() {
    const ctl = allCtl(); Object.keys(ctl).forEach(k => { ctl[k] = rnd6(ctl[k]); }); const ck = clockOf();
    return { k: 'enr', v: 1, name: S.name, rig: S.rigId, ctl, clock: ck ? { N: ck.N, tS: rnd6(ck.tS) } : null, design: designState(), curve: clone(S.curvePts), marks: Object.assign({}, S.curveMarks) };
  }
  const snapshot = () => JSON.stringify(stateObj());
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
    if (it.clock && fin(+it.clock.N) && fin(+it.clock.tS)) startClock({ N: +it.clock.N, tS: +it.clock.tS });
    if (Array.isArray(it.curve)) { S.curvePts = it.curve.filter(p => p && fin(+p.u) && fin(+p.i)).slice(0, 20).map(p => ({ u: +p.u, i: +p.i, p: fin(+p.p) ? +p.p : +p.u * +p.i, r: fin(+p.r) ? +p.r : null })); lsSet('enr.curve', S.curvePts); }
    S.curveMarks = {}; if (it.marks && typeof it.marks === 'object') ['uoc', 'isc', 'mpp'].forEach(k => { if (Number.isInteger(it.marks[k]) && it.marks[k] >= 0 && it.marks[k] < S.curvePts.length) S.curveMarks[k] = it.marks[k]; }); S.curveCmp = null;
    const D = extOf('design'); if (it.design && typeof it.design === 'object' && D && typeof D.setState === 'function') { try { D.setState(it.design); lsSet('enr.design', D.getState()); } catch (e) { console.error('Auslegung laden:', e); } }
    S.name = (it.name || 'Versuch') + (suffix || ''); S.dirty = false; updateChrome(); saveCurSoon();
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
  const shareObj = () => stateObj();
  async function shareNow() {
    if (!S.rig) { toast('Es gibt noch nichts zu teilen: der Prüfstand fehlt.'); return; }
    let url; try { url = location.href.split('#')[0].split('?')[0] + '#' + await packShare(shareObj()); } catch (e) { toast('Teilen nicht möglich'); return; }
    if (navigator.share) { try { await navigator.share({ title: 'Tonfunk Energie-Lab: ' + S.name, text: 'Schau dir meinen Energie-Versuch „' + S.name + '“ an:', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    sheet('Teilen', b => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">Diesen Link weitergeben (zum Beispiel per WhatsApp oder E-Mail). Wer ihn öffnet, bekommt eine Kopie deines Versuchs mit Prüfstand, Einstellungen, Uhrzeit, Auslegung und Messpunkten.</p><textarea id="shTx" rows="5" readonly></textarea><div class="btns"><button class="btn pri" id="shCp">Link kopieren</button></div>';
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
    x.fillStyle = bgOf(); x.fillRect(0, 0, w, h); try { if (S.rig) S.rig.draw(x, w, h, S.animT); } catch (e) {} return c;
  }
  function exportPng() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    const ws = worldSz(), c = rigPng(1600, Math.round(1600 * ws.h / ws.w));
    c.toBlob(b => { if (b && root.LabExport) { root.LabExport.saveBlob(b, root.LabExport.fname('png')); stat('png'); } else toast('Bild konnte nicht erzeugt werden'); }, 'image/png');
  }
  function printNow() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    const ws = worldSz(), c = rigPng(1200, Math.round(1200 * ws.h / ws.w)), who = lsRaw('lm4.name', ''), vals = allCtl(); let mv = {}; try { mv = S.rig.readMeters(); } catch (e) {}
    const cv = ctlsOf().filter(x => x.type !== 'button').map(x => { const v = vals[x.key]; let t = v; if (x.type === 'switch') t = v ? 'EIN' : 'AUS'; else if (x.type === 'select') { const o = (x.options || []).find(q => q.value === v); t = o ? o.label : v; } else t = ctlShow(x, v) + (ctlUnit(x) ? ' ' + ctlUnit(x) : ''); return `<tr><td>${esc(x.group || '')}</td><td>${esc(x.label)}</td><td>${esc(t)}</td></tr>`; }).join('');
    const mt = metersOf().map(m => `<tr><td>${esc(m.label)}</td><td>${m.unitKind === 'clock' ? hhmm(mv[m.key]) : fnum(mv[m.key], m.digits == null ? 1 : m.digits)} ${esc(m.unit || '')}</td></tr>`).join('');
    const ev = ((S.rig.events) || []).filter(e => !masked(e)).slice(-15).map(e => `<tr><td>${esc(evTime(e))}</td><td>${esc(e.text)}</td></tr>`).join('');
    const pts = S.curvePts.length && S.rigId === 'modul' ? `<h2>Eigene Messpunkte</h2><table><tr><th>Nr.</th><th>R in Ω</th><th>U in V</th><th>I in A</th><th>P in W</th></tr>${S.curvePts.map((p, i) => `<tr><td>${i + 1}</td><td>${fin(p.r) ? fauto(p.r) : '–'}</td><td>${fnum(p.u, 2)}</td><td>${fnum(p.i, 3)}</td><td>${fnum(p.p, 2)}</td></tr>`).join('')}</table>` : '';
    $('#printArea').innerHTML = `<div class="proto"><h1>${esc(S.name)}</h1><p>Prüfstand: ${esc(rigName(S.rigId))} · ${new Date().toLocaleDateString('de-DE')}${who ? ' · ' + esc(who) : ''} · Zeiten in Sonnenzeit bzw. Prozesszeit</p>
      <h2>Prüfstand</h2><img src="${c.toDataURL('image/png')}" alt="">
      <h2>Einstellungen</h2><table><tr><th>Gruppe</th><th>Steuerwert</th><th>Wert</th></tr>${cv}</table>
      <h2>Messwerte</h2><table><tr><th>Messgerät</th><th>Wert</th></tr>${mt}</table>${pts}
      ${ev ? `<h2>Meldungen</h2><table><tr><th>Zeit</th><th>Meldung</th></tr>${ev}</table>` : ''}</div>`;
    setTimeout(() => window.print(), 80);
  }

  /* ============================================================ Aufgaben (ENR_TASKS) */
  const TK = () => (root.ENR_TASKS && Array.isArray(root.ENR_TASKS.tasks) && root.ENR_TASKS.tasks.length ? root.ENR_TASKS.tasks : null);
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
  /* Aufgabenzustand (start() und sol() liefern { rig?, controls?, seq?, dur?, start?, value?, design? }) übernehmen */
  function applyTaskState(t, o) {
    o = o || {}; const rid = o.rig || t.rig || S.rigId;
    setRig(ORDER.includes(rid) ? rid : S.rigId, { run: false }); applyCtl(o.controls || o.ctl); startClock(o.start); S.taskStart = o; applyTaskDesign(o.design);
  }
  /* start().design = { inp, result } (Form der Kerneingabe) oder { wiz, ... } (Zustand des Tabs Auslegen) in den Assistenten übernehmen */
  function applyTaskDesign(d) {
    const D = extOf('design'); if (!d || typeof d !== 'object' || !D || typeof D.setState !== 'function') return;
    try {
      let st = null;
      if (d.wiz && typeof d.wiz === 'object') st = d;
      else if (d.inp && typeof d.inp === 'object') {
        const i = d.inp, w = { geraete: Array.isArray(i.geraete) ? i.geraete.map(x => Object.assign({}, x)) : [], done: {}, step: 1, preset: '' };
        ['ort', 'tag', 'wetter', 'azimut', 'Usys', 'chem', 'tage', 'modul', 'regler', 'sparmodus'].forEach(k => { if (i[k] != null) w[k] = i[k]; });
        if (i.neigung != null) { w.neigungAuto = false; w.neigung = i.neigung; } else w.neigungAuto = true;
        if (i.dod != null) { w.dodAuto = false; w.dod = Math.round(i.dod * 1000) / 10; } else w.dodAuto = true;
        if (i.laenge && typeof i.laenge === 'object') w.laenge = Object.assign({}, i.laenge);
        if (i.spannungsfall != null) w.spannungsfall = Math.round(i.spannungsfall * 1000) / 10;
        st = { wiz: w };
      }
      if (st && D.setState(st)) { lsSet('enr.design', D.getState()); if (S.tab === 'design') renderExt('design'); }
    } catch (e) { console.error(e); }
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
  function designAnswer() {
    const D = extOf('design'); if (!D || typeof D.getState !== 'function' || !D.fn || typeof D.fn.designRun !== 'function') return null;
    try { const w = D.getState().wiz, d = D.fn.designRun(w); return d && d.ok ? { inp: d.inp, result: d.res } : null; } catch (e) { return null; }
  }
  function collectAnswer(t) {
    let st = null; try { st = S.rig ? clone(S.rig.state()) : null; } catch (e) {}
    const a = taskAns[t.id] || {}, v = a.v != null && a.v !== '' ? parseNum(a.v) : NaN, fl = fieldsOf(t), fo = {};
    fl.forEach(f => { const raw = a.f && a.f[f.key], x = raw != null && raw !== '' ? parseNum(raw) : NaN; fo[f.key] = fin(x) ? x : (typeof raw === 'string' && raw !== '' && !fin(x) ? raw : null); });
    const first = fl.length ? fo[fl[0].key] : null, ts = S.taskStart || {};
    return { rig: S.rigId, controls: allCtl(), seq: Array.isArray(ts.seq) ? ts.seq : [], dur: fin(ts.dur) ? ts.dur : 0, state: st, simTime: S.st && fin(S.st.t) ? S.st.t : 0, value: fin(v) ? v : (fin(first) ? first : null), text: a.v == null ? '' : String(a.v), fields: fo, choices: Object.assign({}, a.c || {}), design: designAnswer(), curve: S.curvePts.map(p => ({ u: p.u, i: p.i, p: p.p })) };
  }
  async function checkTask() {
    const t = curTask(); if (!t) return; const R = root.ENR_TASKS;
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
  /* Auto-Weg: Musterlösung laden und abspielen (zählt als Hilfe Stufe 3) */
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
  /* Tabellen im Aufgabentext: { caption?, head:[…], rows:[[…]] } oder Liste davon oder Liste von Zeilen (erste Zeile = Kopf) */
  function tableHtml(tb) {
    if (!tb) return ''; const list = Array.isArray(tb) && tb.length && !Array.isArray(tb[0]) && typeof tb[0] === 'object' ? tb : [tb];
    const cell = v => esc(typeof v === 'number' ? fauto(v) : v), one = t1 => {
      let head = t1.head || t1.header || t1.cols || t1.columns, rows = t1.rows || t1.data;
      if (Array.isArray(t1) && !head) { head = t1[0]; rows = t1.slice(1); }
      rows = Array.isArray(rows) ? rows : []; return `<div class="enr-tbl"><table>${t1.caption || t1.title ? `<caption>${esc(t1.caption || t1.title)}</caption>` : ''}${Array.isArray(head) ? `<thead><tr>${head.map(h => `<th>${cell(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map(r => `<tr>${(Array.isArray(r) ? r : [r]).map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    };
    return list.map(one).join('');
  }
  function renderTasks() {
    const V = $('#taskView'), A = TK();
    if (!A) { V.innerHTML = '<div class="card pl"><h4>Aufgaben</h4><p class="big">Aufgaben folgen</p><p class="hint2">Hier erscheinen Aufgaben mit automatischer Prüfung: Grundlagen, Kennlinie, Verschaltung, Verschattung, Laderegler, Akku, Wechselrichter, Auslegung, Rechnen, Fehlersuche und Prüfungsaufgaben. Bis dahin kannst du mit den Beispielen, dem Rechner und dem Tab „Lernen“ üben.</p><div class="btns"><button class="btn pri" id="tkEx">Beispiele ansehen</button><button class="btn" id="tkRetry" data-retry>Erneut prüfen</button></div></div>'; $('#tkEx', V).onclick = openExamples; return; }
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
      else if (a === 'auto') { const t = curTask(); if (t && await confirmSheet('Auto-Weg?', 'Der Prüfstand spielt die Musterlösung ab. Das <b>zählt als Hilfe</b> (Stufe 3): Dein Ausbilder sieht es.', 'Abspielen')) autoWay(t); }
      else if (a === 'hand') { const t = curTask(); if (t && root.Auswertung) root.Auswertung.handIn(t.id, taskDone()[t.id] || 0, t.title); }
      else if (a === 'end') { S.task = null; S.evSig = ''; taskRes = null; updateChrome(); renderTasks(); toast('Aufgabe beendet'); }
    } else if (row) startTask(row.dataset.t);
  });

  /* ============================================================ Fehler-Würfel: Fehler auswürfeln (wirkt auf Steuerwerte; die Texte nennen nur, was eingestellt wurde) */
  const infoMax = k => { const c = ctlDef(k); if (!c) return NaN; return infoOf(c).max; };
  const infoMin = k => { const c = ctlDef(k); if (!c) return NaN; return infoOf(c).min; };
  const curV = k => { try { return S.rig.getControl(k); } catch (e) { return undefined; } };
  const DICE = [
    { id: 'laub', ok: () => S.rigId === 'schatten' && hasCtl('schatten'), apply: () => ({ schatten: 'laub', dunkel: 100, tiefe: 40 }), text: () => 'Laub liegt auf dem Modul: Einige Zellen sind verschattet (Schattenart „Laub“).' },
    { id: 'bypass', ok: () => S.rigId === 'schatten' && hasCtl('bypass'), apply: () => ({ bypass: 'kurz' }), text: () => 'Eine Bypassdiode ist defekt (Kurzschluss): Ein Teilstrang des ersten Moduls ist dauerhaft überbrückt.' },
    { id: 'wolken', ok: () => isDay() && hasCtl('wetter'), apply: () => Object.assign({ wetter: 'bedeckt' }, S.rigId === 'regler' ? { quelle: 'tagesgang' } : {}), text: () => 'Eine Wolkenwoche: Die Wetterlage steht auf „bedeckt“, das Feld bekommt nur diffuses Licht.' },
    { id: 'akku', ok: () => isDay() && hasCtl('cap') && S.rigId !== 'netz', apply: () => ({ cap: Math.max(infoMin('cap'), Math.round(+curV('cap') / 2)) }), text: (b, a) => 'Der Akku ist zu klein: Die Kapazität wurde auf ' + fauto(a.cap) + ' Ah halbiert (vorher ' + fauto(+b.cap) + ' Ah).' },
    { id: 'ladeschluss', ok: () => hasCtl('uAbs'), apply: () => ({ uAbs: Math.min(infoMax('uAbs'), +(+curV('uAbs') + 0.8).toFixed(1)) }), text: (b, a) => 'Der Ladeschluss ist falsch eingestellt: Die Ladeschlussspannung steht auf ' + fnum(a.uAbs, 1) + ' V (vorher ' + fnum(+b.uAbs, 1) + ' V).' },
    { id: 'kabel', ok: () => hasCtl('aPv'), apply: () => ({ aPv: 1.5, lPv: Math.max(+curV('lPv') || 0, 10) }), text: (b, a) => 'Die Leitung vom Feld zum Regler ist zu dünn: ' + fauto(a.aPv) + ' mm² bei ' + fauto(a.lPv) + ' m Länge.' },
    { id: 'regler', ok: () => S.rigId === 'regler' && hasCtl('ctrl'), apply: () => ({ ctrl: 'direkt' }), text: () => 'Der Laderegler fehlt: Das Feld hängt direkt am Akku (Reglertyp „direkt“).' },
    { id: 'netz', ok: () => S.rigId === 'netz' && hasCtl('netz'), apply: () => ({ netz: false }), text: () => 'Netzausfall: Der Schalter „Netz vorhanden“ steht auf aus.' },
    { id: 'last', ok: () => hasCtl('load') || hasCtl('lastF'), apply: () => (hasCtl('load') ? { load: Math.min(infoMax('load'), Math.round(Math.max(40, 2 * +curV('load')))) } : { lastF: Math.min(infoMax('lastF'), +(2 * +curV('lastF')).toFixed(2)) }), text: (b, a) => (a.load !== undefined ? 'Lastsprung: Die Last wurde auf ' + fauto(a.load) + ' W erhöht (vorher ' + fauto(+b.load) + ' W).' : 'Lastsprung: Der Lastfaktor steht auf ' + fnum(a.lastF, 1) + ' (vorher ' + fnum(+b.lastF, 1) + ').') },
    { id: 'standby', ok: () => S.rigId === 'insel' && hasCtl('sparmodus'), apply: () => ({ sparmodus: false, wr: curV('wr') === 'kein' ? '1000' : curV('wr') }), text: () => 'Der Wechselrichter-Sparmodus ist aus: Der Wechselrichter verbraucht auch ohne Last Standby-Leistung.' }
  ];
  function diceRoll() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; } if (S.task) { toast('Beende zuerst die Aufgabe.'); return; }
    const ok = DICE.filter(d => { try { return d.ok(); } catch (e) { return false; } }); if (!ok.length) { toast('An diesem Prüfstand lässt sich nichts auswürfeln. Wechsle zu Schatten, Laderegler, Inselanlage oder Netz.'); return; }
    const d = ok[Math.floor(Math.random() * ok.length)], before = {}, keys = d.apply();
    Object.keys(keys).forEach(k => { before[k] = curV(k); });
    applyCtl(keys); const text = d.text(before, keys); S.dice = { id: d.id, text, before };
    S.dirty = true; saveCurSoon(); if (!S.running) setRun(true);
    if (root.LochFX) try { root.LochFX.sound('slide'); } catch (e) {}
    sheet('🎲 Fehler gewürfelt', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">An der Anlage stimmt etwas nicht. Beobachte Szene, Meldungen und Messwerte und finde die Ursache.</p><div class="btns"><button class="btn" data-d="show">Auflösung zeigen</button><button class="btn" data-d="undo">Fehler beheben</button><button class="btn pri" data-d="ok">Ich suche selbst</button></div><div id="dcOut"></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-d]'); if (!x) return; if (x.dataset.d === 'show') $('#dcOut', b).innerHTML = '<div class="ex">' + esc(S.dice.text) + '</div>'; else if (x.dataset.d === 'undo') { applyCtl(S.dice.before); S.dice = null; toast('Fehler behoben'); close(); } else close(); });
    });
  }

  /* ============================================================ Auslegen, Rechnen und Lernen: Erweiterungen (WP4b, WP4c), Schnittstelle 6.7 */
  /* Lädt Prüfstand, Voreinstellung und Steuerwerte (zum Beispiel aus dem Auslegen-Assistenten oder einem Lernabschnitt), danach Tab Prüfstand */
  function loadRig(o) {
    o = o || {}; if (S.task) { toast('Beende zuerst die Aufgabe.'); return false; }
    const id = o.rig && ORDER.includes(o.rig) ? o.rig : S.rigId; if (!defOf(id)) { toast('Dieser Prüfstand ist noch nicht geladen.'); return false; }
    const had = stash(); S.name = o.name || 'Neuer Versuch'; S.id = null; S.dirty = false; setRig(id, { run: o.run !== false });
    if (o.preset && S.rig && typeof S.rig.applyPreset === 'function') { try { S.rig.applyPreset(o.preset); S.preset = o.preset; } catch (e) { console.error(e); } buildControls(); buildMeters(); buildPresets(); }
    if (o.controls) applyCtl(o.controls); startClock(o.start);
    setTab('rig'); updateChrome(); saveCurSoon(); toast(had ? 'Geladen, dein Versuch ist gesichert' : (o.toast || 'Im Prüfstand geladen: ' + rigName(id)));
    return true;
  }
  /* Auslegung (Eingabe und Ergebnis von ENR_CORE.design.autoDesign) in den Prüfstand "Inselanlage" legen */
  function loadDesign(inp, res) {
    if (S.task) { toast('Beende zuerst die Aufgabe.'); return false; }
    const d = defOf('insel'); if (!d) { toast('Der Prüfstand „Inselanlage“ ist nicht geladen.'); return false; }
    inp = inp && typeof inp === 'object' ? inp : {}; res = res && typeof res === 'object' ? res : {};
    const cd = k => d.controls.find(q => q.key === k), ct = {};
    const near = (key, v) => { const c = cd(key); if (!c || !fin(v)) return undefined; if (c.type === 'slider') return clamp(v, c.min, c.max); const nums = c.options.filter(o => fin(+o.value)).sort((a, b) => +a.value - +b.value); const hit = nums.find(o => +o.value >= v - 1e-9); return (hit || nums[nums.length - 1] || {}).value; };
    const sel = (key, v) => { const c = cd(key); return c && c.type === 'select' && c.options.some(o => o.value === v) ? v : undefined; };
    const put = (k, v) => { if (v !== undefined && v !== null) ct[k] = v; };
    const st = res.strang || {}, ac = Array.isArray(inp.geraete) && inp.geraete.some(g => g && g.typ === 'ac');
    put('modul', sel('modul', inp.modul)); put('ns', near('ns', st.ns)); put('np', near('np', st.np)); put('neigung', near('neigung', fin(inp.neigung) ? inp.neigung : res.neigung)); put('azimut', near('azimut', inp.azimut));
    put('regler', sel('regler', inp.regler) || 'mppt'); put('imax', near('imax', res.reglerA)); put('chem', sel('chem', inp.chem)); put('usys', near('usys', inp.Usys)); put('cap', near('cap', res.akkuAh)); put('lvd', true);
    put('ort', sel('ort', inp.ort));
    if (fin(inp.tag)) { if (inp.tag === 355) put('datum', 'winter'); else if (inp.tag === 172) put('datum', 'sommer'); else if (inp.tag === 80) put('datum', 'fruehling'); else { put('datum', 'frei'); put('tag', near('tag', inp.tag)); } }
    put('wetter', sel('wetter', inp.wetter));
    if (ac) { put('wr', near('wr', res.wrVA)); put('sparmodus', !!inp.wrSparmodus); } else put('wr', 'kein');
    const profs = ['gartenhaus', 'camper', 'pumpe']; if (profs.includes(inp.profil) || profs.includes(inp.preset)) put('lastprofil', profs.includes(inp.profil) ? inp.profil : inp.preset);
    else if (fin(res.tagesWh)) { put('lastprofil', 'frei'); put('pFrei', near('pFrei', Math.round(res.tagesWh / 24))); }
    const kab = res.kabel || {}; put('aPv', near('aPv', kab.pv)); put('aBat', near('aBat', kab.akku)); if (inp.laenge) { put('lPv', near('lPv', inp.laenge.pv)); put('lBat', near('lBat', inp.laenge.akku)); }
    const ok = loadRig({ rig: 'insel', controls: ct, name: 'Meine Auslegung', toast: 'Auslegung im Prüfstand „Inselanlage“ geladen. Starte einen Tag und prüfe, ob der Akku reicht.' });
    if (ok) S.designUsed = true; return ok;
  }
  function extApi() {
    return { get S() { return S; }, get rig() { return S.rig; }, setTab, loadExample, startTask, toast, esc, stat: (k, v, m) => { if (k === 'enrcalc') S.calcUsed = true; if (k === 'enrdesign') S.designUsed = true; stat(k, v, m); }, lsGet, lsSet, loadDesign, loadRig,
      get ENR_CORE() { return CORE(); }, get ENR_CHART() { return CH(); }, KEYS, drawChartOn, tableHtml, rigName, rigIcon, defOf, ORDER, SPEEDS };
  }
  function renderExt(kind) {
    const host = $(kind === 'design' ? '#designView' : kind === 'calc' ? '#calcView' : '#helpView'), E = root.ENR_UI_EXT && root.ENR_UI_EXT[kind];
    if (!host) return;
    const file = kind === 'design' ? 'enrui-design.js' : kind === 'calc' ? 'enrui-calc.js' : 'enrui-help.js', nm = kind === 'design' ? 'Auslegen' : kind === 'calc' ? 'Rechner' : 'Lernen';
    if (!E || typeof E.render !== 'function') { host.innerHTML = `<div class="card pl"><p class="big">${nm} wird geladen</p><p class="hint2">Die Datei ${file} ist noch nicht geladen.</p><div class="btns"><button class="btn" data-retry>Erneut prüfen</button></div></div>`; return; }
    if (kind === 'help' && host.dataset.ext === '1' && host.children.length) return;
    try { E.render(host, extApi()); host.dataset.ext = '1'; } catch (e) { console.error('Erweiterung ' + kind + ':', e); host.innerHTML = '<div class="card pl"><p class="big">Das hat nicht geklappt</p><p class="hint2">' + esc((e && e.message) || e) + '</p></div>'; }
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-retry]') && (S.tab === 'calc' || S.tab === 'design')) renderExt(S.tab); });

  /* ============================================================ Oberfläche: Kopf, Tabs, Leiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd" style="display:none"></span>' : ''}</button>`).join('');
    updateTaskBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function redrawTab() { S.needDraw = true; if (S.tab === 'rig') { drawDiag(true); drawScope(); } else if (S.tab === 'curve') { drawCurveTab(); drawAssistant(); } }
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'rig'; S.tab = t; lsPut('enr.tab', t);
    $('#mid').dataset.tab = t; $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'curve') renderCurveTab(); else if (t === 'design') renderExt('design'); else if (t === 'calc') renderExt('calc'); else if (t === 'tasks') renderTasks(); else if (t === 'help') renderExt('help');
    updateChrome();
    requestAnimationFrame(() => { fitCanvas(); updateMeters(); redrawTab(); syncCtl(true); });
  }
  function updateTitle() {
    $('#title').innerHTML = esc(S.name) + (S.dirty ? ' •' : '') + '\n<small>' + esc(rigName(S.rigId || 'modul')) + (S.running ? ' · läuft' : '') + (S.live ? ' · Szenario' : '') + '</small>';
    document.title = 'Energie-Lab: ' + S.name;
    const tag = $('#cvTag'); if (tag) { tag.textContent = S.running ? '' : '⏸ Pause'; tag.style.display = S.running ? 'none' : ''; }
  }
  $('#title').onclick = async () => { const r = await ask('Name des Versuchs', [{ key: 'n', label: 'Name', type: 'text', value: S.name }]); if (r && r.n.trim()) { S.name = r.n.trim(); S.dirty = true; updateChrome(); saveCurSoon(); } };
  let palSig = '';
  function buildPal() {
    const fxOn2 = fxOn(), sig = [S.running, S.speed, fxOn2, !!S.rig, !!S.live].join('|');
    if (sig === palSig) return; palSig = sig; const F = !!root.LochFX;
    $('#pal').innerHTML = `<button class="chip ${S.running ? 'on' : 'go'}" data-a="run" aria-label="${S.running ? 'Pause' : 'Start'}">${S.running ? '⏸ Pause' : '▶ Start'}</button><button class="chip" data-a="reset" aria-label="Zurücksetzen">⟲ Reset</button><span class="sep"></span>
      <span class="seg" aria-label="Zeitraffer">${SPEEDS.map(v => `<button data-sp="${v}" class="${S.speed === v ? 'on' : ''}">×${String(v).replace('.', ',')}</button>`).join('')}</span><span class="sep"></span>
      ${F ? `<button class="chip ${fxOn2 ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn2}" aria-label="Effekte und Ton" title="Effekte und Ton">${fxOn2 ? '🎉' : '🔇'} Effekte</button>` : ''}
      <span id="stat"></span>`;
    const r = $('#bRun'); r.textContent = S.running ? '⏸' : '▶'; r.classList.toggle('on', S.running); r.setAttribute('aria-label', S.running ? 'Pause' : 'Start');
    updateStat();
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sp) setSpeed(+b.dataset.sp);
    else if (b.dataset.a === 'run') setRun(!S.running); else if (b.dataset.a === 'reset') resetRig(); else if (b.dataset.a === 'fx') toggleFx();
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
      ['fx', 'Effekte und Ton: ' + (fxOn() ? 'an' : 'aus'), 'Sprechblasen, Konfetti und lustige Töne ein- oder ausschalten'], ['png', 'Szenebild speichern (PNG)', 'Aktuelle Ansicht als Bilddatei'], ['csv', 'Aufzeichnung als CSV', 'Kurven und Tagesgang für Excel (Dezimalkomma)'], ['dice', 'Fehler-Würfel', 'Einen Fehler auswürfeln und die Ursache suchen'],
      ['calc2', 'Rechnen', 'Rechner mit Rechenweg und Übungsgenerator'], ['calc', 'Taschenrechner', 'Ohm, Farbcode, Leitung und mehr'],
      ['abz', 'Abzeichen', 'Deine Sammlung und was noch fehlt'], ['kamp', 'Kampagne: Die Sonne', 'Lernpfad mit Geschichte über alle Labs'], ['trainer', 'Trainer: Erste Schritte', 'Kurze Einführung zum Mitmachen'],
      ['neu', 'Neu in dieser Version', 'Was zuletzt dazukam und wo du es findest'], ['erg', 'Ergebnis senden', 'Code für den Ausbilder: meine bearbeiteten Aufgaben'], ['keys', 'Tastenkürzel', kk + ' und mehr (Taste ? drücken)'], ['help', 'Hilfe und Lernen', 'Grundlagen kurz erklärt'], ['start', 'Zur Startseite', '']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b>${r[2] ? `<small>${esc(r[2])}</small>` : ''}</div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); menuAct(r.dataset.m); });
    });
  }
  async function newExperiment() {
    if (S.task) { toast('Beende zuerst die Aufgabe.'); return; }
    const v = await pick('Neuer Versuch: Prüfstand wählen', ORDER.map(id => ({ value: id, label: rigName(id), sub: ((defOf(id) || {}).info) || RIGMETA[id].info, icon: rigIcon(id), mark: defOf(id) ? '' : 'fehlt' })));
    if (!v) return; saveCur(); const had = stash(); S.name = 'Neuer Versuch'; S.id = null; S.dirty = false; S.ctlMem[v] = null; setRig(v); setTab('rig');
    toast(had ? 'Neuer Versuch, dein bisheriger ist gesichert' : 'Neuer Versuch');
  }
  function menuAct(m) {
    switch (m) {
      case 'tasks': setTab('tasks'); break; case 'new': newExperiment(); break; case 'ex': openExamples(); break; case 'open': openList(); break; case 'save': doSave(); break;
      case 'share': shareNow(); break; case 'import': importSheet(); break; case 'fx': toggleFx(); break; case 'png': exportPng(); break; case 'csv': exportCsv(); break; case 'dice': diceRoll(); break;
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
      S.animT += dt * clamp(S.speed, 0.25, 2);
    }
    if (S.rig) watchEvents(ts);
    if (S.tab === 'rig') {
      if (S.running || S.live || S.needDraw || ts - lastDrawT > 400) { drawRig(); lastDrawT = ts; S.needDraw = false; }
      updateMeters();
      if (ts - lastUI > 100) {
        lastUI = ts; readState(); syncCtl(); updateStat(); updateDiag(); checkBadges(); if (S.running || S.live) { drawDiag(); drawScope(); }
        if (S.rig && hasClockCtl() !== !!S.clockVis) buildBar();
        if (!S.scopeReady && S.rig && isDay() && S.tab === 'rig') buildScope();
        const fb = $('#cvFault'), on = performance.now() < (S.faultUntil || 0);
        if (fb) { if (on) { const tx = S.faultText || ''; if (fb.textContent !== tx) fb.textContent = tx; } if (fb.classList.contains('on') !== on) fb.classList.toggle('on', on); }
      }
    } else if (ts - lastUI > 250) { lastUI = ts; readState(); updateStat(); checkBadges(); if (S.tab === 'curve' && S.running) drawCurveTab(); }
    fxFrame();
    const w = performance.now() - t0; perf.n++; perf.sum += w; if (w > perf.max) perf.max = w; perf.recent.push(w); if (perf.recent.length > 120) perf.recent.shift();
  }

  /* ============================================================ Schnittstellen für Trainer, Tasten, Tests */
  root.LabTrainerAPI = {
    lab: 'enr', tab: () => S.tab, go: setTab, simMode: () => S.running, running: () => S.running, rig: () => S.rigId, speed: () => S.speed,
    load: loadExampleByName, examples: () => exampleList().map(e => e.name), task: () => (S.task ? S.task.id : null), saved: () => saves().length,
    simTime: () => (S.st && fin(S.st.t) ? S.st.t : 0), faults: () => (lsGet('enr.faults', []) || []).length, calcUsed: () => !!S.calcUsed,
    curveTaken: () => !!S.curveTaken, designed: () => !!S.designUsed, dayRun: () => !!S.dayRun, shaded: () => !!S.shadeUsed
  };
  root.LabKeysAdapter = {
    lab: 'enr', sheet: (title, build) => (title === 'Tastenkürzel' ? sheet(title, b => { b.innerHTML = keysHtml(); }) : sheet(title, build)), esc, toast,
    sim: () => setRun(!S.running), busy: () => true, has: () => false
  };
  /* kleine Testschnittstelle */
  root.ENR_UI = { frame, S, KEYS, TABS, ORDER, setTab, setRig, useRig, setCtl, applyCtl, setRun, resetRig, simAdvance, loadExample, loadExampleByName, startTask, checkTask, snapshot, stateObj, shareObj, packShare, unpackShare, applyItem, saveItem,
    curvesCsv, parseCsv, DICE, diceRoll, exampleList, BUILTIN, extApi, collectAnswer, retryLoad, openMenu, slPos, slVal, drawChartOn, drawDiag, drawScope, renderCurveTab, drawCurveTab, assistAct, compareCurve, dayJump, jumpTo, playScenario, startLive, loadRig, loadDesign, tableHtml, coerce, applyHit, toggleDetail,
    perf: () => ({ n: perf.n, mean: perf.n ? perf.sum / perf.n : 0, max: perf.max, recentMean: perf.recent.length ? perf.recent.reduce((a, b) => a + b, 0) / perf.recent.length : 0 }), fnum, hhmm, keysHtml, scopeData, evTime, checkBadges };

  /* ============================================================ Start */
  function init() {
    buildTabs();
    const cur = lsGet('enr.cur', null);
    if (cur && typeof cur === 'object') S.ctlMem = cur.ctls && typeof cur.ctls === 'object' && !Array.isArray(cur.ctls) ? cur.ctls : {};
    if (cur && ORDER.includes(cur.rig)) {
      S.name = cur.name || 'Neuer Versuch'; S.id = cur.id || null;
      setRig(cur.rig, { run: !cur.task }); if (S.ctlMem[cur.rig]) applyCtl(S.ctlMem[cur.rig]); if (cur.clock) startClock(cur.clock); S.dirty = !!cur.dirty; S.task = cur.task ? { id: cur.task } : null;
    } else {
      setRig(ORDER[0]);
      if (!lsRaw('enr.seen', '')) { lsPut('enr.seen', '1'); setTimeout(() => toast('Willkommen im Energie-Lab! Bewege einen Regler: Du siehst sofort, wie die Sonne das Solarmodul beeinflusst.'), 900); }
    }
    setTab(S.tab); requestAnimationFrame(frame);
    const lazyEx = () => { try { exampleList(); buildScen(); } catch (e) { console.error(e); } }; if (root.requestIdleCallback) root.requestIdleCallback(lazyEx, { timeout: 6000 }); else setTimeout(lazyEx, 2500);
    root.addEventListener('load', () => { if (S.tab === 'design' || S.tab === 'calc' || S.tab === 'help') renderExt(S.tab); });
    /* Aufrufparameter von Startseite, Lernpfad, Kampagne und Lernheften: ?aufgabe=en1, ?ex=Name, ?bsp, ?neu */
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
