'use strict';
/* Tonfunk Regelungstechnik-Lab: Oberfläche (WP3a).
   Seite, Tabs (Prüfstand, Strecke messen, Regler einstellen, Ablauf, Rechnen, Aufgaben, Lernen), Bedienpult und Messgeräte automatisch aus rig.controls / rig.meters,
   Messschreiber mit Zeitreise, Assistenten für Sprungantwort und Schwingversuch, Einstellhilfe, Kenngrößen-Tafel, Stabilität (Vertiefung), Ablaufprogramm,
   Speichern/Öffnen/Teilen, Aufgabenanbindung, Effekte. Rechnen und Lernen kommen aus regui-calc.js und regui-help.js über window.REG_UI_EXT (Abschnitt 6.8 der SPEC).
   Die Prüfstände kommen aus regrig-*.js über window.REG_RIGS (Registry), Rechnen und Läufer aus regcore.js (window.REG_CORE), Beispiele und Aufgaben aus regdata.js.
   Es gibt hier KEINE zweite Formelimplementierung: stepMetrics, fitStep, rules, margins, runSeq, diagnose, exercise rufen immer den Kern.
   Speicher: reg.cur (laufende Arbeit), reg.saves (gespeicherte Versuche), reg.tab, reg.speed, reg.seen, reg.faults, reg.fx, reg.rigsused, reg.digital, sim.done (Aufgaben, gemeinsam mit den anderen Labs). */
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
  const CORE = () => root.REG_CORE;
  const ORDER = ['fuellstand', 'durchfluss', 'raumtemp', 'thermostat', 'drehzahl', 'position', 'baukasten'];
  const RIGMETA = {
    fuellstand: { icon: '🛢️', name: 'Füllstandsregelung', file: 'regrig-fuell.js', info: 'Tank mit Pumpe und Entnahmeventil' },
    durchfluss: { icon: '🚰', name: 'Durchflussregelung', file: 'regrig-fluss.js', info: 'Rohrleitung mit Regelventil' },
    raumtemp: { icon: '🏠', name: 'Raumtemperatur', file: 'regrig-raum.js', info: 'Heizung mit Totzeit, Zeit in Minuten' },
    thermostat: { icon: '🌡️', name: 'Thermostat', file: 'regrig-thermo.js', info: 'Zweipunktregler mit Bimetall' },
    drehzahl: { icon: '⚙️', name: 'Drehzahlregelung', file: 'regrig-drehz.js', info: 'Motor mit Tachogenerator' },
    position: { icon: '📏', name: 'Positionsregelung', file: 'regrig-pos.js', info: 'Spindelachse' },
    baukasten: { icon: '🧱', name: 'Streckenbaukasten', file: 'regrig-bau.js', info: 'Freie Strecke für Versuche' }
  };
  /* Messschreiber: Zeitfenster je Anlage in Prozess-Sekunden (SPEC 4.7.8); Thermostat je nach Gerät */
  const SPAN = { fuellstand: 300, durchfluss: 60, raumtemp: 14400, thermostat: 2400, drehzahl: 3, position: 6, baukasten: 100 };
  /* Arbeitspunkt für den Sprungversuch (Assistent „Strecke messen“); y0 in %, Sprung dy in % */
  const MEAS_Y0 = { fuellstand: 40, durchfluss: 40, raumtemp: 40, drehzahl: 40, position: 50, baukasten: 50 };
  const TDIV = { s: 1, min: 60, h: 3600 };
  const decs = step => { step = +step || 0; if (!step || step >= 1) return 0; return Math.min(3, Math.ceil(-Math.log10(step) - 1e-9)); };
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',') : '–');
  const adig = v => { v = Math.abs(v); return v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : v >= 0.1 ? 3 : 4; };
  const fauto = v => (fin(v) ? fnum(v, adig(v)) : '–');
  const parseNum = s => { const C = CORE(); if (C && typeof C.parseNum === 'function') { const v = C.parseNum(s); if (fin(v)) return v; if (typeof s === 'number') return NaN; } return fin(s) ? s : parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.')); };
  const clickSnd = k => { if (root.LochFX) try { root.LochFX.sound(k || 'tick'); } catch (e) {} };
  const pad2 = n => String(n).padStart(2, '0');

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
          '<div id="akErr" class="hint2" style="color:#ff8a7a;min-height:18px"></div><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn pri" data-ok>OK</button></div>';
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
  root.LabUI = { sheet, esc, toast, userName: () => lsRaw('lm4.name', ''), LAB: 'reg' };
  root.sheet = sheet; root.toast = toast;

  /* ============================================================ Notfall-Attrappe (nur wenn REG_RIGS ganz fehlt) */
  const DUMMY = (function () {
    const sl = (key, label, min, max, step, unit, value, group, extra) => Object.assign({ key, label, type: 'slider', min, max, step, unit, value, group, help: label + '.' }, extra || {});
    const controls = [
      { key: 'mode', label: 'Betriebsart', type: 'select', options: [{ value: 'hand', label: 'hand' }, { value: 'auto', label: 'auto' }], value: 'auto', group: 'Regler', help: 'Hand oder Automatik.' },
      { key: 'ctrl', label: 'Reglerart', type: 'select', options: [{ value: 'P', label: 'P' }, { value: 'PI', label: 'PI' }], value: 'P', group: 'Regler', help: 'Reglerart.' },
      sl('kp', 'Kp', 0.1, 100, 0.1, '', 2, 'Regler', { scale: 'log' }), sl('tn', 'Nachstellzeit Tn', 5, 500, 1, 's', 50, 'Regler', { scale: 'log', unitKind: 'time', visible: s => s.ctrl === 'PI' }),
      sl('yHand', 'Handstellgröße', 0, 100, 1, '%', 20, 'Regler'), sl('w', 'Sollwert w', 5, 95, 1, 'cm', 50, 'Anlage und Störung'), sl('z', 'Störgröße z', 0, 100, 1, '', 0, 'Anlage und Störung')
    ];
    const meters = [{ key: 'x', label: 'Füllstand', unit: 'cm', digits: 1, min: 0, max: 100 }, { key: 'y', label: 'Stellgröße', unit: '%', digits: 1, min: 0, max: 100 }, { key: 'e', label: 'Regeldifferenz', unit: 'cm', digits: 1, min: -50, max: 50 }];
    function create() {
      const c = {}, events = [], h = 0.1; controls.forEach(x => { c[x.key] = x.value; });
      let x = 20, I = 0, y = 20, t = 0, acc = 0;
      const rig = {
        id: 'fuellstand', controls, meters, events, presets: [], range: { lo: 0, hi: 100, unit: 'cm', digits: 1 }, timeScale: 1, tUnit: 's', h, roles: {}, requiredDir: 'direkt', params: {},
        setControl(k, v) { const d = controls.find(q => q.key === k); if (!d) return false; c[k] = d.type === 'slider' ? clamp(+v, d.min, d.max) : v; return true; }, getControl(k) { return c[k]; },
        stepProcess(dt) { acc += dt; while (acc >= h) { acc -= h; const e = c.w - x; I += c.kp * h / c.tn * e; y = c.mode === 'hand' ? c.yHand : clamp(c.kp * e + (c.ctrl === 'PI' ? I : 0), 0, 100); x += h * (2 * y - x - c.z * 0.2) / 20; x = clamp(x, 0, 100); t += h; } },
        step(ms) { rig.stepProcess(ms / 1000); }, readMeters() { return { x, y, e: c.w - x }; },
        state() { return { t, w: c.w, x, y, z: c.z, e: c.w - x, wPct: c.w, xPct: x, yPct: y, ePct: c.w - x, mode: c.mode, ctrl: c.ctrl, kp: c.kp, tn: c.tn, tv: 0, ta: h, dir: 'direkt', ymax: 100, satHigh: false, satLow: false, windup: 0, osc: 'aperiodisch', faults: [] }; },
        trace() { return { t: [], w: [], x: [], y: [], z: [], e: [], extra: {} }; },
        draw(g, w, hh) { g.fillStyle = '#1b2128'; g.fillRect(0, 0, w, hh); g.fillStyle = '#3b9eff'; const f = x / 100; g.fillRect(w * 0.35, hh * 0.1 + hh * 0.65 * (1 - f), w * 0.3, hh * 0.65 * f); g.strokeStyle = '#8d99a6'; g.lineWidth = 3; g.strokeRect(w * 0.35, hh * 0.1, w * 0.3, hh * 0.65); g.fillStyle = '#8d99a6'; g.font = '600 16px system-ui'; g.textAlign = 'center'; g.fillText('Notfall-Attrappe: die Prüfstände sind nicht geladen', w / 2, hh * 0.92); },
        curves() { return []; }, reset() { x = 20; I = 0; y = 20; t = 0; acc = 0; events.length = 0; controls.forEach(q => { c[q.key] = q.value; }); }, worldSize() { return { w: 1000, h: 560 }; },
        setOperatingPoint(yy) { y = yy; c.mode = 'hand'; c.yHand = yy; x = clamp(2 * yy, 0, 100); }, steady(yy) { return clamp(2 * yy, 0, 100); }, linBlocks() { return []; }, analysis() { return { ok: false, why: 'Attrappe', blocks: [] }; }, identify() { return { ok: false, why: 'Attrappe' }; }, diagnose() { return []; }, applyPreset() {}
      };
      return rig;
    }
    return { id: 'fuellstand', name: 'Füllstand (Notfall-Attrappe)', icon: '🛢️', info: 'Einfache Ersatzanzeige, bis die echten Prüfstände geladen sind.', controls, meters, create, attrappe: true };
  })();
  const defOf = id => {
    const r = root.REG_RIGS;
    if (r && r.defs && r.defs[id]) return r.defs[id];
    if (!r && id === 'fuellstand') return DUMMY;
    return null;
  };
  const rigName = id => { const d = defOf(id); return (d && !d.attrappe && d.name) || (RIGMETA[id] || {}).name || id; };
  const rigIcon = id => { const d = defOf(id); return (d && d.icon) || (RIGMETA[id] || {}).icon || '🎛️'; };

  /* ============================================================ Zustand */
  const S = {
    tab: lsRaw('reg.tab', 'rig'), rigId: null, rig: null, err: '', name: 'Neuer Versuch', id: null, task: null, dirty: false,
    running: false, speed: +lsRaw('reg.speed', '1') || 1, digital: lsRaw('reg.digital', '0') === '1', plan: false,
    ctl: {}, simT: 0, rows: {}, live: null, seqRes: null, seqPrev: null, readonly: false, strecke: null, op: null, seqDur: {},
    hist: { t: [], w: [], x: [], y: [], z: [] }, view: { mul: 1, off: 0, full: false }, jump: null, ghost: null, meas: null, osc: { cls: 'aperiodisch' },
    throttled: false, helpUsed: false, tuned: false
  };
  const TABS = [['rig', '🎛️', 'Prüfstand'], ['meas', '📏', 'Strecke messen'], ['tune', '🔧', 'Regler einstellen'], ['seq', '⏱️', 'Ablauf'], ['calc', '🧮', 'Rechnen'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Lernen']];
  if (!TABS.some(x => x[0] === S.tab)) S.tab = 'rig';
  if (![0.5, 1, 2, 5, 20].includes(S.speed)) S.speed = 1;
  const SPEEDS = [0.5, 1, 2, 5, 20];

  /* ---- Tastenkürzel: EINE Tabelle für Behandler, Hilfe-Blatt und Menü (Regel 5) ---- */
  const KEYS = [
    { id: 'run', keys: ['Leertaste'], match: e => e.key === ' ', t: 'Prüfstand starten und anhalten', act: () => setRun(!S.running) },
    { id: 'enter', keys: ['Eingabe', 'F5'], ext: true, t: 'Starten und anhalten (gilt auch außerhalb der Bildfläche)' },
    { id: 'reset', keys: ['Z'], match: e => e.key.toLowerCase() === 'z' && !(e.ctrlKey || e.metaKey), t: 'Prüfstand zurücksetzen (Reset)', act: () => resetRig() },
    { id: 'fx', keys: ['E'], match: e => e.key.toLowerCase() === 'e', t: 'Effekte und Ton ein oder aus', act: () => toggleFx() },
    { id: 'speed', keys: ['1', '2', '3', '4', '5'], match: e => e.key >= '1' && e.key <= '5', t: 'Zeitraffer ×0,5 / ×1 / ×2 / ×5 / ×20', act: e => setSpeed(SPEEDS[+e.key - 1]) },
    { id: 'hand', keys: ['H'], match: e => e.key.toLowerCase() === 'h', t: 'Hand und Automatik umschalten (stoßfrei)', act: () => toggleMode() },
    { id: 'plan', keys: ['W'], match: e => e.key.toLowerCase() === 'w', t: 'Wirkungsplan ein oder aus', act: () => togglePlan() },
    { id: 'save', keys: ['Strg + S'], match: e => (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's', t: 'Versuch speichern', act: () => doSave() },
    { id: 'help', keys: ['?'], ext: true, t: 'Diese Übersicht' }
  ];
  function keysHtml() {
    const kd = a => a.map(x => `<code>${esc(x)}</code>`).join(' oder ');
    return '<table>' + KEYS.map(k => `<tr><td style="white-space:nowrap">${kd(k.keys)}</td><td>${esc(k.t)}</td></tr>`).join('') + '</table><p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>';
  }
  root.REG_KEYS = KEYS;

  let rec = null, recAcc = 0, drawErr = false, curT = 0;
  const handText = () => { const T = CORE() && CORE().TEXTS, t = T && ((T.diag && T.diag.hand) || T.hand); return typeof t === 'string' ? t : ''; };
  const clsName = c => (c && typeof c === 'object' ? c.cls : c);
  const ctlsOf = () => (S.rig ? (S.rig.controls || (defOf(S.rigId) || {}).controls || []) : []);
  const metersOf = () => (S.rig ? (S.rig.meters || (defOf(S.rigId) || {}).meters || []) : []);
  const ctlDef = (key, list) => (list || ctlsOf()).find(c => c.key === key);
  const hasCtl = k => !!ctlDef(k);
  const TU = () => (S.rig && S.rig.tUnit) || 's';
  const toU = s => s / (TDIV[TU()] || 1);
  const fromU = v => v * (TDIV[TU()] || 1);
  const tstr = (s, d) => { const v = toU(s); return fnum(v, d == null ? adig(v) : d) + ' ' + TU(); };
  const rng = () => (S.rig && S.rig.range) || { lo: 0, hi: 100, unit: '%', digits: 1 };
  const span = () => { const r = rng(); return (r.hi - r.lo) || 100; };
  const toPct = v => 100 * (v - rng().lo) / span();
  const fromPct = p => rng().lo + p * span() / 100;
  const physStr = v => fnum(v, rng().digits == null ? 1 : rng().digits) + ' ' + (rng().unit || '');
  /* Wert an die Definition anpassen (Auswahl über Wert oder Beschriftung, Schieber begrenzen); undefined = nicht passend */
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

  /* ============================================================ Prüfstand wechseln, Steuerwerte */
  function resetRun() {
    S.running = false; S.simT = 0; S.live = null; S.seqRes = null; S.jump = null; S.ghost = null; S.view.off = 0; S.meas = null; S.osc = { cls: 'aperiodisch' }; S.oscFx = false; S.windFx = false;
    S.hist = { t: [], w: [], x: [], y: [], z: [] }; rec = null; S.op = null; S.diag = []; S.diagSeen = {};
  }
  function setRig(id, o) {
    o = o || {};
    if (!ORDER.includes(id)) id = ORDER[0];
    S.rigId = id; S.rig = null; S.err = ''; S.ctl = {}; S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; S.preset = null; S.st = null; S.view.mul = 1; S.view.full = false;
    resetRun(); fxReset(); S.curveCache = null;
    const d = defOf(id);
    if (d) { try { S.rig = d.create(o.opts || {}); } catch (e) { S.err = (e && e.message) || String(e); console.error('Prüfstand ' + id + ':', e); } }
    if (!S.rows[id]) S.rows[id] = [];
    S.attrappe = !!(d && d.attrappe);
    if (S.strecke && S.strecke.rig !== id) { /* Kennwerte bleiben gespeichert, gelten aber nur für ihre Anlage */ }
    buildPick(); buildPresets(); buildControls(); buildMeters(); fitCanvas(); updateEvents(true); updateChrome(); readState();
    if (S.tab === 'meas') renderMeas(); if (S.tab === 'tune') renderTune(); if (S.tab === 'seq') renderSeq(); if (S.tab === 'calc') renderExt('calc'); if (S.tab === 'help') renderExt('help');
    saveCurSoon();
  }
  const SELFIRST = c => (c && (c.type === 'select' || c.type === 'switch') ? 0 : 1);
  /* mehrere Steuerwerte setzen: map { key: Wert }, Auswahlfelder zuerst (Gerät, Art, Betrieb), nur passende Schlüssel, ohne Hinweise */
  function applyCtl(map) {
    if (!S.rig || !map) return;
    const keys = Object.keys(map).sort((a, b) => SELFIRST(ctlDef(a)) - SELFIRST(ctlDef(b)));
    keys.forEach(k => {
      const v = coerce(ctlDef(k), map[k]); if (v === undefined) return;
      try { S.rig.setControl(k, v); S.ctl[k] = v; } catch (e) { console.error('Steuerwert ' + k, e); }
    });
    syncCtl(true);
  }
  function setCtl(key, val, silent) {
    if (!S.rig || S.readonly) return false;
    const def = ctlDef(key), v = coerce(def, val); if (v === undefined) return false;
    let old; if (key === 'w' || key === 'z') { try { old = S.rig.getControl(key); } catch (e) {} readState(); sample(); }
    let ok = true; try { ok = S.rig.setControl(key, v) !== false; } catch (e) { console.error(e); return false; }
    if (!ok) { syncCtl(true); return false; }
    S.ctl[key] = v;
    if (!silent) {
      S.dirty = true; saveCurSoon();
      if (!S.running && def.type !== 'button' && !S.live && (S.tab === 'rig' || S.tab === 'tune') && !(S.meas && S.meas.on)) setRun(true, true);
      if (key === 'mode') modeMsg(v);
    }
    noteCtlChange(key); if (key === 'w' || key === 'z') noteJump(key, old, v); readState(); syncCtl(); return true;
  }
  const allCtl = () => { const o = {}; if (S.rig) ctlsOf().forEach(c => { try { const v = S.rig.getControl(c.key); if (v !== undefined) o[c.key] = v; } catch (e) {} }); return o; };
  const curRows = () => S.rows[S.rigId] || (S.rows[S.rigId] = []);
  const snapshot = () => ({ rig: S.rigId, ctl: allCtl(), rows: clone(curRows()), name: S.name, strecke: S.strecke ? clone(S.strecke) : null });
  function saveCurSoon() { clearTimeout(curT); curT = setTimeout(saveCur, 400); }
  function saveCur() { if (!S.rig) return; lsSet('reg.cur', { rig: S.rigId, ctl: allCtl(), rows: S.rows, name: S.name, id: S.id, task: S.task ? S.task.id : null, dirty: S.dirty, strecke: S.strecke, dur: S.seqDur }); }
  function usedRig() {
    if (S.attrappe || !S.rigId) return;
    const a = lsGet('reg.rigsused', []), s = new Set(Array.isArray(a) ? a : []); s.add(S.rigId); lsSet('reg.rigsused', [...s]); stat('regrigs', s.size, 'max');
  }
  function readState() { if (!S.rig) { S.st = null; return null; } try { S.st = S.rig.state(); } catch (e) { S.st = S.st || null; } return S.st; }
  /* Hand/Automatik: nur Tatsachen melden (Regel 2): y vor und nach dem Umschalten stammen aus state() */
  function modeMsg(v) {
    const st = readState(); if (!st) return;
    if (v === 'auto') toast('Automatik: Der Regler übernimmt bei y = ' + fnum(st.y, 1) + ' %.'); else toast('Handbetrieb: Die Stellgröße bleibt bei y = ' + fnum(st.y, 1) + ' % und folgt jetzt dem Schieber.');
  }
  function toggleMode() { if (!S.rig || !hasCtl('mode')) return; const v = S.rig.getControl('mode'); setCtl('mode', v === 'hand' ? 'auto' : 'hand'); clickSnd('click'); }
  function togglePlan() { S.plan = !S.plan; if (S.tab !== 'rig') setTab('rig'); updateChrome(); }
  const noteCtlChange = key => { if (key === 'device' || key === 'type') { S.view.mul = 1; } };

  /* ---- Prüfstandwahl und Voreinstellungen ---- */
  function buildPick() {
    $('#rigPick').innerHTML = ORDER.map(id => {
      const have = !!defOf(id) && !(defOf(id).attrappe && id !== 'fuellstand');
      return `<button class="chip${id === S.rigId ? ' on' : ''}" data-rig="${id}" style="${have ? '' : 'opacity:.6'}">${rigIcon(id)} ${esc(rigName(id))}${have ? '' : ' ⚠'}</button>`;
    }).join('');
  }
  $('#rigPick').addEventListener('click', e => { const b = e.target.closest('[data-rig]'); if (b) usePick(b.dataset.rig); });
  function usePick(id) {
    if (id === S.rigId) return;
    if (S.task) { toast('Während einer Aufgabe ist der Prüfstand fest. Beende zuerst die Aufgabe.'); return; }
    stash(); S.name = 'Neuer Versuch'; S.id = null; S.dirty = false; setRig(id); toast('Prüfstand: ' + rigName(id));
  }
  const presetsOf = () => (S.rig && (S.rig.presets || (defOf(S.rigId) || {}).presets)) || [];
  function buildPresets() {
    const P = presetsOf(), el = $('#presetBar');
    if (!P.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="gh" style="padding-top:2px">Voreinstellung</div><div class="chips">${P.map(p => `<button class="chip s${S.preset === p.id ? ' on' : ''}" data-pre="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>`;
  }
  $('#presetBar').addEventListener('click', e => {
    const b = e.target.closest('[data-pre]'); if (!b || !S.rig) return;
    const p = presetsOf().find(x => String(x.id) === b.dataset.pre); if (!p) return;
    S.preset = p.id; let done = false;
    for (const fn of ['applyPreset', 'setPreset']) if (typeof S.rig[fn] === 'function') { try { S.rig[fn](p.id, p.params); done = true; } catch (er) { console.error(er); } break; }
    if (!done) { try { S.rig = defOf(S.rigId).create({ preset: p.id, params: p.params, seed: 1 }); } catch (er) { console.error(er); toast('Voreinstellung nicht möglich'); return; } S.evSeen = new WeakSet(); }
    S.evSeen = new WeakSet(); S.evSig = ''; resetRun(); S.ctl = {};
    buildControls(); buildMeters(); buildPresets(); readState(); updateEvents(true); updateChrome(); toast('Voreinstellung: ' + p.name); S.dirty = true; saveCurSoon();
  });

  /* ---- Platzhalter, wenn ein Prüfstand fehlt ---- */
  const FILES = ['regcore.js', 'regdraw.js', 'regrig-fuell.js', 'regrig-fluss.js', 'regrig-bau.js', 'regrig-raum.js', 'regrig-thermo.js', 'regrig-drehz.js', 'regrig-pos.js', 'regdata.js'];
  function placeholderHtml() {
    const why = S.err ? 'Der Prüfstand konnte nicht gestartet werden: ' + esc(S.err) : 'Die Datei für „' + esc(rigName(S.rigId)) + '“ ist noch nicht geladen.';
    return `<div class="ph2"><b>Prüfstand noch nicht geladen</b>${why}<br><button class="btn" data-retry>Erneut prüfen</button></div>`;
  }
  function retryLoad() {
    const want = FILES.filter(f => {
      if (f === 'regcore.js') return !root.REG_CORE; if (f === 'regdraw.js') return !root.REG_DRAW; if (f === 'regdata.js') return !root.REG_DATA && !root.REG_TASKS;
      const id = ORDER.find(i => RIGMETA[i].file === f); return !(root.REG_RIGS && root.REG_RIGS.defs && root.REG_RIGS.defs[id]);
    });
    if (!want.length) { setRig(S.rigId); toast('Alles geladen'); return Promise.resolve(); }
    toast('Lade fehlende Dateien …');
    return Promise.all(want.map(f => new Promise(res => {
      const s = document.createElement('script'); s.src = f + '?t=' + Date.now(); s.onload = s.onerror = () => res(); document.head.appendChild(s);
    }))).then(() => {
      const still = ORDER.filter(i => !defOf(i)).length;
      const keep = S.rig ? allCtl() : ((lsGet('reg.cur', {}) || {}).ctl || {}); setRig(S.rigId); applyCtl(keep); buildPick();
      if (S.tab === 'tasks') renderTasks(); toast(still ? still + ' Prüfstand' + (still > 1 ? 'e fehlen' : ' fehlt') + ' noch' : 'Alle Prüfstände geladen');
    });
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-retry]')) retryLoad(); });

  /* ============================================================ Bedienpult aus rig.controls (mehrere Instanzen, synchron) */
  let panels = [];
  const isTime = c => c.unitKind === 'time';
  const slPos = (c, v) => { if (c.scale === 'log' && c.min > 0 && c.max > c.min) return Math.round(1000 * Math.log(clamp(v, c.min, c.max) / c.min) / Math.log(c.max / c.min)); return Math.round(1000 * (clamp(v, c.min, c.max) - c.min) / ((c.max - c.min) || 1)); };
  function slVal(c, pos) {
    let v = c.scale === 'log' && c.min > 0 && c.max > c.min ? c.min * Math.pow(c.max / c.min, pos / 1000) : c.min + (c.max - c.min) * pos / 1000;
    if (c.step && !(c.scale === 'log')) v = Math.round(v / c.step) * c.step; else if (c.scale === 'log') { const d = fin(v) ? Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, v))) - 2) : 0.01; v = Math.round(v / d) * d; }
    return clamp(+v.toPrecision(10), c.min, c.max);
  }
  const ctlUnit = c => (isTime(c) ? TU() : (c.unit || ''));
  const ctlShow = (c, v) => { if (isTime(c)) { const u = toU(v); return fnum(u, adig(u)); } return fnum(v, c.scale === 'log' ? adig(v) : decs(c.step)); };
  function ctlHtml(c) {
    const k = esc(c.key), help = c.help ? `<small class="hp">${esc(c.help)}</small>` : '';
    if (c.type === 'slider') return `<div class="ct" data-k="${k}" data-t="slider"><div class="ctl"><span>${esc(c.label)}</span><span class="vi"><input class="num" inputmode="decimal" autocomplete="off" aria-label="${esc(c.label)}, Wert eingeben"><small class="un"></small></span></div>${help}<input type="range" min="0" max="1000" step="1" value="0" aria-label="${esc(c.label)}"></div>`;
    if (c.type === 'switch') return `<div class="ct p0" data-k="${k}" data-t="switch"><button class="sw" role="switch" aria-checked="false" aria-label="${esc(c.label)}"><span class="lab">${esc(c.label)}${help}</span><span class="tgl"><i></i></span></button></div>`;
    if (c.type === 'button') return `<div class="ct p0" data-k="${k}" data-t="button"><button class="bt">${esc(c.label)} (halten)</button>${help ? `<div style="padding:0 12px 4px">${help}</div>` : ''}</div>`;
    if (c.type === 'select') {
      const o = c.options || [];
      const body = c.key === 'ctrl' ? `<div class="chips ctrlchips">${o.map((x, i) => `<button class="chip s" data-i="${i}">${esc(x.label)}</button>`).join('')}</div>`
        : o.length <= 4 ? `<div class="seg">${o.map((x, i) => `<button data-i="${i}">${esc(x.label)}</button>`).join('')}</div>` : `<select aria-label="${esc(c.label)}">${o.map((x, i) => `<option value="${i}">${esc(x.label)}</option>`).join('')}</select>`;
      return `<div class="ct${c.key === 'mode' ? ' modect' : ''}" data-k="${k}" data-t="select"><div class="ctl"><span>${esc(c.label)}</span></div>${help}${body}</div>`;
    }
    return '';
  }
  /* host: Behälter; filter: null (alle, nach Gruppen) oder Liste von Schlüsseln (eine Karte) */
  function buildPanel(host, filter, title) {
    panels = panels.filter(p => p.host !== host && p.host.isConnected);
    if (!S.rig) { host.innerHTML = '<div class="card">' + placeholderHtml() + '</div>'; return; }
    const list = ctlsOf().filter(c => !filter || filter.includes(c.key)), groups = [], gm = {};
    list.forEach(c => { const g = filter ? (title || 'Regler') : (c.group || 'Bedienung'); if (!gm[g]) { gm[g] = { n: g, items: [] }; groups.push(gm[g]); } gm[g].items.push(c); });
    if (filter) groups.forEach(g => g.items.sort((a, b) => filter.indexOf(a.key) - filter.indexOf(b.key)));
    else groups.sort((a, b) => (b.n === 'Regler') - (a.n === 'Regler'));
    host.innerHTML = groups.map(g => `<details class="card ctg" open><summary>${esc(g.n)}</summary><div class="cb">${g.items.map(ctlHtml).join('')}${g.n === 'Regler' && !filter && S.rig && hasCtl('mode') && handText() ? `<p class="hint2" style="margin:2px 10px 6px">${esc(handText())}</p>` : ''}</div></details>`).join('');
    const els = {}; $$('.ct[data-k]', host).forEach(el => { els[el.dataset.k] = { el, t: el.dataset.t, last: undefined, vis: true }; });
    panels.push({ host, els }); wirePanel(host); syncCtl(true);
  }
  function buildControls() { buildPanel($('#ctlHost'), null); }
  function syncCtl(force) {
    if (!S.rig) return;
    const st = S.st || readState();
    panels = panels.filter(p => p.host.isConnected);
    panels.forEach(p => ctlsOf().forEach(c => {
      const x = p.els[c.key]; if (!x) return;
      if (typeof c.visible === 'function') { let vis = true; try { vis = !!c.visible(st || {}); } catch (e) {} if (vis !== x.vis) { x.vis = vis; x.el.hidden = !vis; } }
      let v; try { v = S.rig.getControl(c.key); } catch (e) { return; }
      if (!force && x.last === v) return; x.last = v; const el = x.el;
      if (c.type === 'slider') {
        const inp = $('input[type=range]', el), num = $('.num', el), un = $('.un', el), n = +v;
        if (fin(n)) { if (document.activeElement !== inp || force) inp.value = slPos(c, n); if (document.activeElement !== num || force) num.value = ctlShow(c, n); }
        un.textContent = ctlUnit(c);
      } else if (c.type === 'switch') $('button', el).setAttribute('aria-checked', v ? 'true' : 'false');
      else if (c.type === 'button') $('button', el).classList.toggle('on', !!v);
      else if (c.type === 'select') {
        const o = c.options || [], i = o.findIndex(q => q.value === v || String(q.value) === String(v));
        $$('.seg button, .ctrlchips .chip', el).forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
        const sel = $('select', el); if (sel && i >= 0) sel.value = String(i);
      }
    }));
  }
  function wirePanel(H) {
    let hold = null;
    H.addEventListener('input', e => {
      const inp = e.target.closest('input[type=range]'); if (!inp) return; const el = inp.closest('.ct'), c = ctlDef(el.dataset.k); if (c) setCtl(c.key, slVal(c, +inp.value));
    });
    H.addEventListener('change', e => {
      const num = e.target.closest('input.num'), sel = e.target.closest('select');
      if (num) { const el = num.closest('.ct'), c = ctlDef(el.dataset.k); if (!c) return; let v = parseNum(num.value); if (fin(v)) { if (isTime(c)) v = fromU(v); setCtl(c.key, v); } syncCtl(true); return; }
      if (sel) { const el = sel.closest('.ct'), c = ctlDef(el.dataset.k); if (c) setCtl(c.key, (c.options || [])[+sel.value].value); }
    });
    H.addEventListener('click', e => {
      const sw = e.target.closest('.sw'), sg = e.target.closest('.seg button, .ctrlchips .chip');
      if (sw) { const k = sw.closest('.ct').dataset.k; setCtl(k, !S.rig.getControl(k)); clickSnd('click'); }
      else if (sg) { const el = sg.closest('.ct'), c = ctlDef(el.dataset.k); if (c) { setCtl(c.key, (c.options || [])[+sg.dataset.i].value); clickSnd('tick'); } }
    });
    H.addEventListener('pointerdown', e => {
      const b = e.target.closest('.bt'); if (!b || !S.rig) return; e.preventDefault(); const k = b.closest('.ct').dataset.k;
      try { b.setPointerCapture(e.pointerId); } catch (x) {} hold = { id: e.pointerId, k }; setCtl(k, true); clickSnd('tick');
    });
    const up = e => { if (!hold || (e.pointerId != null && hold.id !== e.pointerId)) return; const k = hold.k; hold = null; setCtl(k, false, true); };
    H.addEventListener('pointerup', up); H.addEventListener('pointercancel', up); H.addEventListener('lostpointercapture', up);
    H.addEventListener('contextmenu', e => { if (e.target.closest('.bt,.sw')) e.preventDefault(); });
  }

  /* ============================================================ Messgeräte aus rig.meters */
  let mEls = [], markKey = null;
  function buildMeters() {
    const H = $('#meters'); mEls = []; markKey = null;
    if (!S.rig) { H.innerHTML = ''; return; }
    const ms = metersOf();
    const flagged = ms.find(m => m.marker === 'w' || m.role === 'x' || m.setKey) || ms.find(m => m.key === 'x') || ms.find(m => m.unit === rng().unit && !['w', 'e', 'y', 'z'].includes(m.key));
    markKey = flagged ? flagged.key : null;
    H.innerHTML = ms.map((m, i) => {
      const gauge = !S.digital && fin(+m.min) && fin(+m.max) && m.max > m.min;
      return gauge ? `<div class="mt" data-i="${i}" aria-label="${esc(m.label)}"><canvas></canvas><div class="lbl">${esc(m.label)}</div></div>` : `<div class="mt dg" data-i="${i}"><div class="lbl">${esc(m.label)}</div><div class="num"><span class="v">–</span><small>${esc(m.unit || '')}</small></div></div>`;
    }).join('');
    mEls = $$('.mt', H).map((el, i) => ({ el, m: ms[i], cv: $('canvas', el), v: $('.v', el), disp: null, drawn: null, txt: '', warn: false, set: null }));
  }
  function drawGauge(x, val, setv) {
    const cvs = x.cv, m = x.m, w = cvs.clientWidth, h = cvs.clientHeight; if (!w || !h) return;
    const dpr = Math.min(2, root.devicePixelRatio || 1), W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; }
    const g = cvs.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.42, r = Math.min(w / 2 - 12, h * 0.36), a0 = Math.PI * 0.75, sw = Math.PI * 1.5, mn = +m.min, mx = +m.max;
    const ang = v => a0 + sw * clamp((v - mn) / (mx - mn), 0, 1);
    const warnV = fin(+m.warnAbove) ? +m.warnAbove : null, isWarn = warnV != null && val > warnV;
    g.lineCap = 'butt'; g.lineWidth = 7; g.strokeStyle = '#2c343e'; g.beginPath(); g.arc(cx, cy, r, a0, a0 + sw); g.stroke();
    if (warnV != null && warnV < mx) { g.strokeStyle = '#ff5c5c'; g.beginPath(); g.arc(cx, cy, r, ang(warnV), a0 + sw); g.stroke(); }
    g.strokeStyle = '#3b9eff'; if (val > mn) { g.beginPath(); g.arc(cx, cy, r - 0.5, a0, ang(warnV != null ? Math.min(val, warnV) : val)); g.globalAlpha = 0.9; g.stroke(); g.globalAlpha = 1; }
    for (let i = 0; i <= 10; i++) {
      const a = a0 + sw * i / 10, len = i % 5 === 0 ? 9 : 5; g.strokeStyle = '#8d99a6'; g.lineWidth = i % 5 === 0 ? 1.6 : 1;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6)); g.lineTo(cx + Math.cos(a) * (r - 6 - len), cy + Math.sin(a) * (r - 6 - len)); g.stroke();
    }
    if (fin(setv)) { const a = ang(setv); g.strokeStyle = '#ffb340'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + Math.cos(a) * (r + 5), cy + Math.sin(a) * (r + 5)); g.lineTo(cx + Math.cos(a) * (r - 11), cy + Math.sin(a) * (r - 11)); g.stroke(); }
    g.fillStyle = '#8d99a6'; g.font = '10px system-ui'; g.textAlign = 'center';
    const lab = v => fnum(v, Math.abs(v) >= 100 || Number.isInteger(v) ? 0 : 1);
    if (w >= 110) { g.fillText(lab(mn), cx - r * 0.72, cy + r * 0.72 + 13); g.fillText(lab(mx), cx + r * 0.72, cy + r * 0.72 + 13); }
    const a = ang(val); g.strokeStyle = isWarn ? '#ff5c5c' : '#e8ecf0'; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - Math.cos(a) * 6, cy - Math.sin(a) * 6); g.lineTo(cx + Math.cos(a) * (r - 11), cy + Math.sin(a) * (r - 11)); g.stroke();
    g.fillStyle = '#222830'; g.strokeStyle = '#8d99a6'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill(); g.stroke();
    g.fillStyle = isWarn ? '#ff8a7a' : '#e8ecf0'; g.font = '700 ' + Math.max(11, Math.min(15, Math.round(w * 0.1))) + 'px system-ui'; g.fillText(fnum(val, m.digits == null ? 1 : m.digits) + (m.unit ? ' ' + m.unit : ''), cx, Math.min(h - 4, cy + r + (w >= 110 ? 15 : 13)));
  }
  function updateMeters(dt, force) {
    if (!S.rig || !mEls.length) return;
    let vals; try { vals = S.rig.readMeters() || {}; } catch (e) { return; }
    const st = S.st, k = Math.min(1, dt / 90);
    mEls.forEach(x => {
      const t = vals[x.m.key]; if (!fin(t)) return;
      const sv = x.m.key === markKey ? (fin(+vals[x.m.setKey]) ? vals[x.m.setKey] : (st ? st.w : null)) : null;
      if (x.cv) {
        if (x.disp == null || force) x.disp = t; else x.disp += (t - x.disp) * k;
        const rg = (x.m.max - x.m.min) || 1;
        if (force || x.drawn == null || Math.abs(x.disp - x.drawn) > rg * 0.0015 || Math.abs(t - x.disp) > rg * 0.0015 || sv !== x.set) { x.drawn = x.disp; x.set = sv; drawGauge(x, x.disp, sv); }
        const wn = fin(+x.m.warnAbove) && t > +x.m.warnAbove; if (wn !== x.warn) { x.warn = wn; x.el.classList.toggle('warn', wn); }
      } else {
        const txt = fnum(t, x.m.digits == null ? 1 : x.m.digits); if (txt !== x.txt) { x.txt = txt; x.v.textContent = txt; }
        const wn = fin(+x.m.warnAbove) && t > +x.m.warnAbove; if (wn !== x.warn) { x.warn = wn; x.el.classList.toggle('warn', wn); }
      }
    });
  }

  /* ============================================================ Zeichenfläche (Anlage, Wirkungsplan) und Effekte */
  const cvs = $('#cv'), g2 = cvs.getContext('2d'), cvw = $('#cvw');
  let cw = 0, ch = 0, dpr = 1;
  const cvfx = document.createElement('canvas'); cvfx.id = 'cvfx'; cvfx.setAttribute('aria-hidden', 'true'); cvfx.style.pointerEvents = 'none'; cvw.appendChild(cvfx);
  const fxg = cvfx.getContext('2d'); let fxDrew = false;
  function worldSz() { try { const w = S.rig && S.rig.worldSize && S.rig.worldSize(); if (w && w.w > 0 && w.h > 0) return w; } catch (e) {} return { w: 1000, h: 560 }; }
  function fitCanvas() {
    const ws = worldSz(), ar = ws.w + '/' + ws.h; if (cvw.style.aspectRatio !== ar) { cvw.style.aspectRatio = ar; cvw.style.setProperty('--ar', String(+(ws.w / ws.h).toFixed(4))); }
    const w = cvw.clientWidth, h = cvw.clientHeight; if (!w || !h) return;
    dpr = Math.min(2, root.devicePixelRatio || 1); const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; }
    if (cvfx.width !== W || cvfx.height !== H) { cvfx.width = W; cvfx.height = H; }
    cw = w; ch = h;
  }
  if (root.ResizeObserver) new ResizeObserver(() => fitCanvas()).observe(cvw);
  root.addEventListener('resize', () => { fitCanvas(); redrawTab(); updateMeters(0, true); });
  /* Wirkungsplan: REG_DRAW.wirkungsplan, sonst einfache eigene Ersatzzeichnung */
  function planKind() {
    let id = null; try { id = S.rig && typeof S.rig.identify === 'function' ? S.rig.identify() : null; } catch (e) { id = null; }
    if (!id || id.ok === false) return 'p'; const n = Array.isArray(id.taus) ? id.taus.length : 1;
    if (id.art === 'I') return 'it1'; if (id.Tt > 0) return n > 1 ? 'pt2tt' : 'pt1tt'; return n >= 3 ? 'pt3' : n === 2 ? 'pt2' : 'pt1';
  }
  /* Seitenfarben fuer REG_DRAW (cssColors): bei jedem Themenwechsel (data-theme, Systemschema) neu abfragen */
  let pcKey = null, pcVal;
  function planColors() {
    const D = root.REG_DRAW; if (!D || typeof D.cssColors !== 'function') return undefined;
    let key = '';
    try { key = (document.documentElement.getAttribute('data-theme') || '') + '|' + (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'd' : 'l') + '|' + (getComputedStyle(document.documentElement).getPropertyValue('--bg') || '').trim(); } catch (e) { key = ''; }
    if (key !== pcKey) { pcKey = key; try { pcVal = D.cssColors(document.documentElement); } catch (e) { pcVal = undefined; } }
    return pcVal && Object.keys(pcVal).length ? pcVal : undefined;
  }
  function planData() {
    const st = S.st || {}, r = S.rig || {}, t = TU();
    return { colors: planColors(), roles: r.roles || {}, values: { w: st.w, x: st.x, xm: st.xm != null ? st.xm : st.x, e: st.e, y: st.y, z: st.z }, units: { x: rng().unit, y: '%', time: t }, ctrl: st.ctrl, dir: st.dir, mode: st.mode, rigId: S.rigId, rigName: rigName(S.rigId), range: rng(), plant: rigName(S.rigId), plantKind: planKind(), digits: { x: rng().digits, w: rng().digits, e: rng().digits, xm: rng().digits } };
  }
  function planFallback(g, w, h, d) {
    g.fillStyle = '#14181c'; g.fillRect(0, 0, w, h); const bx = (x, y, bw, bh, t, c) => { g.strokeStyle = c || '#8d99a6'; g.lineWidth = 2; g.strokeRect(x, y, bw, bh); g.fillStyle = '#e8ecf0'; g.font = '600 ' + Math.max(11, w / 55) + 'px system-ui'; g.textAlign = 'center'; g.fillText(t, x + bw / 2, y + bh / 2 + 4); };
    const arr = (x0, y0, x1, y1) => { g.strokeStyle = '#8d99a6'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); const a = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 8 * Math.cos(a - 0.4), y1 - 8 * Math.sin(a - 0.4)); g.lineTo(x1 - 8 * Math.cos(a + 0.4), y1 - 8 * Math.sin(a + 0.4)); g.closePath(); g.fillStyle = '#8d99a6'; g.fill(); };
    const y0 = h * 0.38, bh = h * 0.2, v = d.values || {}, ro = d.roles || {}, f = (a) => (fin(a) ? fnum(a, 1) : '–');
    g.beginPath(); g.arc(w * 0.12, y0 + bh / 2, 14, 0, 7); g.strokeStyle = '#8d99a6'; g.stroke();
    bx(w * 0.22, y0, w * 0.16, bh, 'Regler ' + (d.ctrl || ''), '#3b9eff'); bx(w * 0.45, y0, w * 0.14, bh, ro.stell || 'Stellglied'); bx(w * 0.66, y0, w * 0.16, bh, 'Regelstrecke');
    arr(w * 0.02, y0 + bh / 2, w * 0.12 - 14, y0 + bh / 2); arr(w * 0.12 + 14, y0 + bh / 2, w * 0.22, y0 + bh / 2); arr(w * 0.38, y0 + bh / 2, w * 0.45, y0 + bh / 2); arr(w * 0.59, y0 + bh / 2, w * 0.66, y0 + bh / 2); arr(w * 0.82, y0 + bh / 2, w * 0.96, y0 + bh / 2);
    g.strokeStyle = '#8d99a6'; g.beginPath(); g.moveTo(w * 0.89, y0 + bh / 2); g.lineTo(w * 0.89, y0 + bh * 1.9); g.lineTo(w * 0.12, y0 + bh * 1.9); g.lineTo(w * 0.12, y0 + bh / 2 + 14); g.stroke();
    g.fillStyle = '#ffb340'; g.font = '600 ' + Math.max(11, w / 55) + 'px system-ui'; g.textAlign = 'left';
    g.fillText('w ' + f(v.w) + ' (' + (ro.w || 'Sollwert') + ')', w * 0.02, y0 - 8); g.fillText('e ' + f(v.e), w * 0.14, y0 - 8); g.fillText('y ' + f(v.y) + ' %', w * 0.40, y0 - 8); g.fillText('z ' + f(v.z) + ' (' + (ro.z || 'Störgröße') + ')', w * 0.62, y0 - 8); g.fillText('x ' + f(v.x) + ' (' + (ro.x || 'Istwert') + ')', w * 0.76, y0 + bh * 1.35);
    g.fillStyle = '#8d99a6'; g.textAlign = 'center'; g.fillText('Wirkungsplan: ' + (d.rigName || ''), w / 2, h * 0.1);
  }
  function drawRig(ts) {
    if (!cw || cvw.offsetParent === null) return;
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.fillStyle = '#14181c'; g2.fillRect(0, 0, cw, ch);
    if (!S.rig) { g2.fillStyle = '#8d99a6'; g2.font = '600 16px system-ui'; g2.textAlign = 'center'; g2.fillText('Prüfstand noch nicht geladen', cw / 2, ch / 2); return; }
    try {
      if (S.plan) { const D = root.REG_DRAW; if (D && typeof D.wirkungsplan === 'function') D.wirkungsplan(g2, cw, ch, planData()); else planFallback(g2, cw, ch, planData()); }
      else S.rig.draw(g2, cw, ch, ts);
    } catch (e) { if (!drawErr) { drawErr = true; console.error('Zeichnung des Prüfstands:', e); } }
  }
  const cvPos = e => { const r = cvs.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const holdsC = new Map();
  cvs.addEventListener('pointerdown', e => {
    e.preventDefault(); const r = S.rig; if (!r || !r.hitTest || S.plan) return; try { cvs.setPointerCapture(e.pointerId); } catch (x) {}
    const [x, y] = cvPos(e); let h = null; try { h = r.hitTest(x, y, cw, ch); } catch (er) {} if (!h || !h.key) return;
    if (h.kind === 'switch') { if (h.key === 'mode') toggleMode(); else setCtl(h.key, !r.getControl(h.key)); clickSnd('click'); } else if (h.kind === 'button') { holdsC.set(e.pointerId, h.key); setCtl(h.key, true); clickSnd('tick'); }
  });
  const cvUp = e => { const k = holdsC.get(e.pointerId); if (k == null) return; holdsC.delete(e.pointerId); setCtl(k, false, true); };
  cvs.addEventListener('pointerup', cvUp); cvs.addEventListener('pointercancel', cvUp);
  cvs.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || !S.rig || !S.rig.hitTest || S.plan) return; const [x, y] = cvPos(e); let h = null; try { h = S.rig.hitTest(x, y, cw, ch); } catch (er) {} cvs.style.cursor = h ? 'pointer' : 'default'; });
  cvs.addEventListener('contextmenu', e => e.preventDefault());

  /* ---- Effekte (alles über LochFX, geschützt); die Zuordnung fx-Name → Effekt steht NUR hier (SPEC 4.7.8) ---- */
  const FXKINDS = { splash: 1, overheat: 1, stall: 1, crash: 1, osc: 1, windup: 1, tick: 1 };
  let fxCool = {}, fxBudgetT = 0;
  function fxReset() { fxCool = {}; fxDrew = false; S.oscFx = false; if (root.LochFX && root.LochFX.clear) try { root.LochFX.clear(); } catch (e) {} }
  const fxOn = () => !!(root.LochFX && !root.LochFX.isMuted());
  const fast = () => S.speed > 5;
  function worldToPx(x, y) {
    const ws = worldSz(), s = Math.min(cw / ws.w, ch / ws.h);
    if (!fin(x) || !fin(y)) return [cw / 2, ch / 2];
    return [(cw - ws.w * s) / 2 + x * s, (ch - ws.h * s) / 2 + y * s];
  }
  function fxEvent(e, ts) {
    const F = root.LochFX; if (!F || !FXKINDS[e.fx]) return;
    const cd = (e.fx === 'tick' ? 120 : 1500) * (S.speed > 1 ? S.speed : 1);
    if (ts - (fxCool[e.fx] || -1e9) < cd) return; fxCool[e.fx] = ts;
    const [x, y] = worldToPx(e.x, e.y), sc = Math.max(14, Math.min(34, cw / 28));
    try {
      if (e.fx === 'splash') { F.explode(x, y, { part: 'TANK', why: 'Wasser', kind: 'res', color: '90,170,255', text: 'PLATSCH!', scale: sc * 0.8, sound: 'splash', at: () => [x, y] }); if (F.say) F.say('Überlauf! Das Wasser spritzt.'); }
      else if (e.fx === 'overheat') { F.explode(x, y, { part: 'HEIZUNG', why: 'Heizung', kind: 'res', color: '200,200,210', scale: sc * 0.8, at: () => [x, y] }); F.sound('alarm'); if (F.say) F.say('Zu heiß! Der Regler hat die Heizung nicht im Griff.'); }
      else if (e.fx === 'stall') { F.sound('buzz'); if (F.say) F.say('Stromgrenze: Der Motor kommt nicht mehr mit.'); }
      else if (e.fx === 'crash') { F.sound('crash'); if (F.say) F.say('Anschlag!'); }
      else if (e.fx === 'osc') { if (!S.oscFx) { S.oscFx = true; F.trip(x, y, 'WACKEL!', sc * 0.8, {}); F.sound('kazoo'); } }
      else if (e.fx === 'windup') { if (F.say) F.say('Der I-Anteil läuft weg!'); F.sound('buzz', 0.4); }
      else if (e.fx === 'tick') F.sound('tick', 0.5);
    } catch (er) {}
  }
  /* Verdeckte Fehler: Aufgaben der Fehlersuche koennen Meldungen/Hinweise einer Diagnose-Kennung (task.maskDiag) bis zum Ende der Aufgabe ausblenden */
  function masked(x) { try { const t = curTask(); return !!(t && Array.isArray(t.maskDiag) && x && t.maskDiag.indexOf(x.id) >= 0); } catch (e) { return false; } }
  function noteFault(e) {
    const key = S.rigId + ':' + (e.fx || String(e.text || '').slice(0, 28));
    const a = lsGet('reg.faults', []), s = new Set(Array.isArray(a) ? a : []); if (s.has(key)) return;
    s.add(key); lsSet('reg.faults', [...s]); stat('regfault', s.size, 'max');
  }
  /* neue Meldungen beobachten: Liste, Abzeichenstatistik, Effekte */
  function watchEvents(ts) {
    const r = S.rig; if (!r) return; const ev = r.events || [];
    let changed = false;
    for (let i = Math.max(0, ev.length - 30); i < ev.length; i++) {
      const e = ev[i]; if (!e || S.evSeen.has(e)) continue; S.evSeen.add(e); changed = true;
      if (masked(e)) continue;
      if (e.kind === 'error' || (e.fx && FXKINDS[e.fx] && e.fx !== 'tick')) noteFault(e);
      if (e.fx === 'windup') { if (!S.windFx) { S.windFx = true; stat('regwind', 1, 'max'); } }
      if (e.kind === 'error') { S.faultUntil = performance.now() + 9000; S.faultText = e.text; if (S.tab !== 'rig' && S.running) toast('⚠ ' + e.text); }
      if (e.fx && (!fast() || ts - fxBudgetT > 700)) { fxBudgetT = ts; fxEvent(e, ts); }
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
    const F = root.LochFX; if (!F) return; F.setMuted(fxOn()); lsPut('reg.fx', fxOn() ? '1' : '0'); updateChrome(); toast(fxOn() ? 'Effekte und Ton an' : 'Ton aus');
    if (fxOn()) F.sound('ding', 0.6);
  }

  /* ---- Meldungsliste (Zeitstempel in der Zeiteinheit der Anlage) und Hinweise aus rig.diagnose() ---- */
  const tstamp = s => { const v = toU(+s || 0); return fnum(v, adig(v)) + ' ' + TU(); };
  function updateEvents(force) {
    const l = $('#evList'); if (!l) return; const ev = ((S.rig && S.rig.events) || []).filter(x => !masked(x));
    const sig = ev.length + '|' + (ev.length ? (ev[ev.length - 1].text || '') + (ev[ev.length - 1].t || '') : '');
    if (!force && sig === S.evSig) return; S.evSig = sig;
    l.innerHTML = ev.length ? ev.slice(-40).reverse().map(x => `<li class="${esc(x.kind || 'info')}"><time>${esc(tstamp(x.t))}</time><span>${esc(x.text)}</span></li>`).join('') : '<li class="empty">Keine Meldungen. Meldet der Prüfstand etwas (zum Beispiel einen Fehler), steht es hier.</li>';
  }
  $('#evClr').onclick = () => { if (S.rig && S.rig.events) { S.rig.events.length = 0; S.evSig = ''; updateEvents(true); } };
  let lastDiag = 0;
  function updateDiag(force) {
    const el = $('#diagList'); if (!el || !S.rig) return;
    const now = performance.now(); if (!force && now - lastDiag < 600) return; lastDiag = now;
    let d = []; try { d = typeof S.rig.diagnose === 'function' ? (S.rig.diagnose() || []) : []; } catch (e) { d = []; }
    d = d.filter(x => !masked(x)); S.diag = d;
    d.forEach(x => { if (!x || !x.id || S.diagSeen[x.id]) return; S.diagSeen[x.id] = 1; if (x.id === 'dauer' || x.id === 'auf') stat('regosc', 1, 'max'); if (x.id === 'windup') stat('regwind', 1, 'max'); });
    const h = d.length ? d.map(x => `<li class="${esc(x.kind || 'info')}"><span>${esc(x.text)}</span></li>`).join('') : '<li class="empty">Keine Hinweise: Zu den aktuellen Einstellungen meldet der Prüfstand nichts.</li>';
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  }

  /* ============================================================ Simulation */
  const defSpan = () => { const r = S.rig; if (r && fin(+r.spanS) && +r.spanS > 0) return +r.spanS; let s = SPAN[S.rigId] || 100; if (S.rigId === 'thermostat' && r && r.getControl) { let d; try { d = r.getControl('device'); } catch (e) {} if (d === 'kuehlen' || d === 'beides') s = 14400; } return s; };
  const viewSpan = () => defSpan() * S.view.mul;
  const rigH = () => Math.max(1e-6, (S.rig && S.rig.h) || 0.01);
  const hDt = () => Math.max(rigH(), defSpan() / 900);
  function setRun(on, auto) {
    if (on && !S.rig) { toast('Der Prüfstand ist noch nicht geladen.'); return; }
    S.running = !!on; updateChrome();
    if (on) { stat('regrun', 1, 'max'); usedRig(); if (auto && !lsRaw('reg.autohint', '')) { lsPut('reg.autohint', '1'); toast('Der Prüfstand läuft jetzt. Mit ⏸ unten hältst du ihn an.'); } }
  }
  function resetRig(quiet) {
    if (!S.rig) return;
    try { S.rig.reset(); } catch (e) { console.error(e); }
    resetRun(); S.ctl = {}; S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; S.curveCache = null; fxReset();
    readState(); syncCtl(true); updateMeters(0, true); updateEvents(true); updateChrome(); renderSeqLive(); if (S.tab === 'meas') renderMeas(); if (S.tab === 'tune') renderTune(); if (!quiet) toast('Prüfstand zurückgesetzt');
  }
  function setSpeed(v) { S.speed = v; lsPut('reg.speed', String(v)); updateChrome(); }
  const lowerBound = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; };

  /* Messschreiber-Speicher: ein Eintrag je hDt Prozess-Sekunden aus state() (w, x physikalisch, y in %, z Anlagenwert) */
  function sample(force) {
    const st = readState(); if (!st) return; if (fin(st.t)) S.simT = st.t;
    const H = S.hist, n = H.t.length; if (!fin(st.t) || (n && st.t <= H.t[n - 1])) return;
    H.t.push(st.t); H.w.push(+st.w); H.x.push(+st.x); H.y.push(+st.y); H.z.push(+st.z);
    if (H.t.length > 24000) Object.keys(H).forEach(k => H[k].splice(0, 2000));
    if (S.meas && S.meas.rec) measSample(st);
    if (/^(2P|3P)$/.test(st.ctrl) && S.running) { S.t2p = (S.t2p || 0) + hDt(); if (S.t2p > 60) { S.t2p = -1e9; stat('reg2p', 1, 'max'); } }
  }
  function noteJump(key, old, v) {
    if (!S.rig || !fin(+old) || !fin(+v)) return; const st = S.st || readState(); if (!st) return;
    if (key === 'w') {
      let ramp = 0; try { ramp = +S.rig.getControl('wRamp') || 0; } catch (e) {}
      if (Math.abs(v - old) >= 0.02 * span() && !ramp) S.jump = { kind: 'w', t0: st.t, w0: +old, w1: +v, done: false, res: null };
    } else if (key === 'z') {
      const zc = ctlDef('z'); if (zc && Math.abs(v - old) >= 0.02 * (zc.max - zc.min)) S.jump = { kind: 'z', t0: st.t, z0: +old, z1: +v, wRef: st.w, done: false, res: null };
    }
  }
  /* Kenngrößen des letzten Sollwert- oder Störsprungs: immer über den Kern (stepMetrics / disturbMetrics) */
  function evalJump(force) {
    const J = S.jump, C = CORE(); if (!J || !C || (J.done && !force)) return null;
    const H = S.hist, i0 = lowerBound(H.t, J.t0 - 1e-9), t = H.t.slice(i0), x = H.x.slice(i0); let res = null;
    try {
      if (J.kind === 'w') res = typeof C.stepMetrics === 'function' ? C.stepMetrics(t, x, { w0: J.w0, w1: J.w1, t0: J.t0, tol: 0.02 }) : null;
      else res = typeof C.disturbMetrics === 'function' ? C.disturbMetrics(t, x, { w: J.wRef, tz: J.t0, band: 0.02 * span() }) : null;
    } catch (e) { res = { ok: false, why: 'Die Auswertung ist fehlgeschlagen: ' + (e && e.message || e) }; }
    J.res = res; J.done = true; J.tEval = H.t.length ? H.t[H.t.length - 1] : J.t0; J.t = t; J.x = x;
    if (res && res.ok !== false && J.kind === 'w' && fin(res.ueberPct) && res.ueberPct < 5 && fin(res.tAus2) && fxOn() && !S.dingFx) { S.dingFx = true; try { root.LochFX.sound('ding', 0.6); } catch (e) {} setTimeout(() => { S.dingFx = false; }, 4000); }
    if (S.tab === 'tune') renderTuneMetrics();
    return res;
  }
  /* Schwingungsklasse über die letzten 8 Fenster der Anlage (hier: 8 Schreiberspannen · 1/8) */
  function oscCheck() {
    const C = CORE(); if (!C || typeof C.oscillation !== 'function' || !S.hist.t.length) return;
    const H = S.hist, t1 = H.t[H.t.length - 1], i0 = lowerBound(H.t, t1 - defSpan() / 2); if (H.t.length - i0 < 12) return;
    let r = null; try { r = C.oscillation(H.t.slice(i0), H.x.slice(i0), { range: span() }); } catch (e) { r = null; } if (r && r.cls) { S.osc = r; if (r.cls === 'dauerschwingung' && !/^(2P|3P)$/.test((S.st || {}).ctrl)) stat('regosc', 1, 'max'); }
  }

  /* geplanten Ablauf im Prüfstand ausführen: Schritte und Rampen, die fällig sind */
  function liveApply() {
    const L = S.live; if (!L) return;
    while (L.i < L.steps.length && L.steps[L.i].t <= L.t + 1e-9) {
      const st = L.steps[L.i++];
      if (st.set) Object.keys(st.set).forEach(k => setCtl(k, st.set[k], true));
      if (st.ramp) { let from = NaN; try { from = +S.rig.getControl(st.ramp.key); } catch (e) {} L.ramps.push({ key: st.ramp.key, from, to: +st.ramp.to, t0: st.t, d: Math.max(1e-9, +st.ramp.durS || 1e-9) }); }
    }
    L.ramps = L.ramps.filter(r => { const f = clamp((L.t - r.t0) / r.d, 0, 1); if (fin(r.from)) setCtl(r.key, r.from + (r.to - r.from) * f, true); return f < 1; });
  }
  const liveNext = () => { const L = S.live; if (!L) return null; let n = L.i < L.steps.length ? L.steps[L.i].t : null; if (L.ramps.length) { const t = L.t + hDt(); n = n == null ? t : Math.min(n, t); } return n; };
  function simAdvance(dtMs) {
    const r = S.rig, ts = r.timeScale || 1, h = rigH(), hs = hDt(), cap = 1800 * h;
    let left = dtMs / 1000 * ts * S.speed; S.throttled = false;
    if (left > cap) { left = cap; S.throttled = true; }
    let guard = 0;
    while (left > 1e-12 && guard++ < 300) {
      let c = Math.min(left, hs - recAcc);
      if (S.live) { liveApply(); const nx = liveNext(); if (nx != null) c = Math.min(c, Math.max(h, nx - S.live.t)); }
      c = Math.max(Math.min(c, left), 1e-9);
      r.step(c / ts * 1000); left -= c; recAcc += c;
      if (S.live) { S.live.t += c; if (S.live.t >= S.live.end) { seqLiveDone(); break; } }
      if (recAcc >= hs * 0.999) { recAcc = 0; sample(); if (S.meas && S.meas.on) measTick(); }
    }
    if (S.jump && !S.jump.done && S.simT - S.jump.t0 >= viewSpan() * 0.8) evalJump();
    if (S.sw && S.sw.auto) swTick();
  }
  function updateStat() {
    const sEl = $('#stat'); if (!sEl) return;
    const html = (S.running ? '<b class="run" style="color:var(--ok)">LÄUFT</b> ' : '<b>PAUSE</b> ') + 'Prozesszeit ' + tstr(S.simT) + (S.throttled ? ' · <b style="color:var(--warn)">Zeitraffer gedrosselt</b>' : '');
    if (sEl.dataset.h !== html) { sEl.dataset.h = html; sEl.innerHTML = html; }
  }

  /* ============================================================ Diagramme (Canvas) */
  const PAL = ['#3b9eff', '#4cd964', '#ffb340', '#ff5c5c', '#c77dff', '#5be3d9'];
  function niceStep(range, n) { const raw = range / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag; }
  function ticksOf(a, b, n) {
    if (!(b > a)) b = a + 1; const s = niceStep(b - a, n), t = [];
    for (let v = Math.ceil(a / s - 1e-9) * s; v <= b + s * 1e-6; v += s) t.push(+v.toPrecision(12));
    return { t, s };
  }
  const tickFmt = (v, s) => fnum(v, Math.max(0, Math.min(4, -Math.floor(Math.log10(s) + 1e-9))));
  function prepCv(cv) {
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return null;
    const d = Math.min(2, root.devicePixelRatio || 1), W = Math.round(w * d), H = Math.round(h * d);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h); return { g, w, h };
  }
  /* o: { series:[{name,color,pts,dash,width,alpha}], hlines:[{y,color,dash,label}], bands:[{y0,y1,color}], vlines:[{x,color,dash,label}|x], segs:[{x0,y0,x1,y1,color,dash,width}], points:[{x,y,color,r}],
          xMin,xMax,yMin,yMax, xLabel,yLabel, yHide, noX, zeroLine, marker:{x,y}, cursorX, strips:[{x0,x1,color}] } */
  function drawChart(cv, o) {
    const c = prepCv(cv); if (!c) return; const { g, w, h } = c;
    const L = o.yHide ? 14 : 54, R = 14, T = 12, B = o.noX ? 8 : 38, pw = w - L - R, ph = h - T - B; if (pw < 20 || ph < 14) return;
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    (o.series || []).forEach(s => (s.pts || []).forEach(p => { if (fin(p[0]) && fin(p[1])) { xmin = Math.min(xmin, p[0]); xmax = Math.max(xmax, p[0]); ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); } }));
    if (o.marker && fin(o.marker.x) && fin(o.marker.y)) { xmin = Math.min(xmin, o.marker.x); xmax = Math.max(xmax, o.marker.x); ymin = Math.min(ymin, o.marker.y); ymax = Math.max(ymax, o.marker.y); }
    if (fin(o.xMin)) xmin = o.xMin; if (fin(o.xMax)) xmax = o.xMax; if (fin(o.yMin)) ymin = o.yMin; if (fin(o.yMax)) ymax = o.yMax;
    if (!fin(xmin) || !fin(ymin)) { g.fillStyle = '#8d99a6'; g.font = '14px system-ui'; g.textAlign = 'center'; g.fillText(o.empty || 'Noch keine Daten', w / 2, h / 2); cv._ch = null; return; }
    if (!(xmax > xmin)) xmax = xmin + 1; if (!(ymax > ymin)) ymax = ymin + 1;
    if (!fin(o.yMin) && ymin > 0 && ymin < (ymax - ymin) * 0.6) ymin = 0;
    if (!fin(o.yMax)) ymax += (ymax - ymin) * 0.06;
    const tx = o.xTicks ? { t: o.xTicks.filter(v => v >= xmin && v <= xmax), s: 1 } : ticksOf(xmin, xmax, Math.max(3, Math.floor(pw / 80))), ty = ticksOf(ymin, ymax, Math.max(2, Math.floor(ph / 40)));
    const X = v => L + pw * (v - xmin) / (xmax - xmin), Y = v => T + ph * (1 - (v - ymin) / (ymax - ymin));
    g.font = '11px system-ui'; g.lineWidth = 1; g.strokeStyle = '#26303a'; g.fillStyle = '#8d99a6'; g.textAlign = 'center';
    tx.t.forEach(v => { const x = Math.round(X(v)) + 0.5; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); if (!o.noX) g.fillText(o.xFmt ? o.xFmt(v) : tickFmt(v, tx.s), x, T + ph + 14); });
    g.textAlign = 'right';
    if (o.yHide) { for (let i = 0; i <= 4; i++) { const y = Math.round(T + ph * i / 4) + 0.5; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); } }
    else ty.t.forEach(v => { const y = Math.round(Y(v)) + 0.5; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.fillText(tickFmt(v, ty.s), L - 6, y + 4); });
    if (o.zeroLine && ymin < 0 && ymax > 0) { g.strokeStyle = '#4a5663'; const y = Math.round(Y(0)) + 0.5; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); }
    g.strokeStyle = '#4a5663'; g.strokeRect(L + 0.5, T + 0.5, pw, ph);
    g.fillStyle = '#8d99a6'; g.font = '12px system-ui'; g.textAlign = 'center'; if (!o.noX) g.fillText(o.xLabel || '', L + pw / 2, h - 6);
    if (o.yLabel && !o.yHide) { g.save(); g.translate(12, T + ph / 2); g.rotate(-Math.PI / 2); g.fillText(o.yLabel, 0, 0); g.restore(); }
    g.save(); g.beginPath(); g.rect(L, T, pw, ph); g.clip();
    (o.strips || []).forEach(s => { g.fillStyle = s.color; g.fillRect(X(s.x0), T + ph - (s.h || 6), Math.max(1, X(s.x1) - X(s.x0)), s.h || 6); });
    (o.bands || []).forEach(b => { g.fillStyle = b.color || 'rgba(76,217,100,.12)'; g.fillRect(L, Y(b.y1), pw, Y(b.y0) - Y(b.y1)); });
    (o.hlines || []).forEach(b => { const y = Math.round(Y(b.y)) + 0.5; g.strokeStyle = b.color || 'rgba(255,179,64,.5)'; g.lineWidth = 1; g.setLineDash(b.dash || [3, 4]); g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.setLineDash([]); if (b.label) { g.fillStyle = b.color || '#ffb340'; g.font = '11px system-ui'; g.textAlign = 'left'; g.fillText(b.label, L + 4, y - 3); } });
    (o.vlines || []).forEach(v0 => { const v = typeof v0 === 'number' ? { x: v0 } : v0, x = Math.round(X(v.x)) + 0.5; g.strokeStyle = v.color || 'rgba(255,179,64,.45)'; g.lineWidth = v.width || 1; g.setLineDash(v.dash || [3, 4]); g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); g.setLineDash([]); if (v.label) { g.fillStyle = v.color || '#ffb340'; g.font = '11px system-ui'; g.textAlign = 'left'; g.fillText(v.label, x + 3, T + 11); } });
    (o.series || []).forEach((s, i) => {
      const pts = (s.pts || []).filter(p => fin(p[0]) && fin(p[1])); if (!pts.length) return;
      g.strokeStyle = s.color || PAL[i % PAL.length]; g.lineWidth = s.width || 2.2; g.lineJoin = 'round'; g.globalAlpha = s.alpha == null ? 1 : s.alpha; if (s.dash) g.setLineDash(s.dash);
      g.beginPath(); pts.forEach((p, j) => { const x = X(p[0]), y = Y(p[1]); if (j) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    });
    (o.segs || []).forEach(s => { g.strokeStyle = s.color || '#c77dff'; g.lineWidth = s.width || 1.6; g.setLineDash(s.dash || []); g.beginPath(); g.moveTo(X(s.x0), Y(s.y0)); g.lineTo(X(s.x1), Y(s.y1)); g.stroke(); g.setLineDash([]); });
    g.restore();
    (o.points || []).forEach(p => { g.fillStyle = p.color || '#ff5c5c'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(X(p.x), Y(p.y), p.r || 6, 0, 7); g.fill(); g.stroke(); });
    if (fin(o.cursorX) && o.cursorX >= xmin && o.cursorX <= xmax) { const x = Math.round(X(o.cursorX)) + 0.5; g.strokeStyle = '#e8ecf0'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); }
    if (o.marker && fin(o.marker.x) && fin(o.marker.y)) {
      const mx = X(o.marker.x), my = Y(o.marker.y); g.strokeStyle = 'rgba(232,236,240,.45)'; g.setLineDash([4, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(mx, T + ph); g.lineTo(mx, my); g.lineTo(L, my); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#ff5c5c'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, 6, 0, 7); g.fill(); g.stroke();
    }
    cv._ch = { L, T, pw, ph, xmin, xmax, ymin, ymax, w, h };
  }
  const cvX = (cv, e) => { const r = cv.getBoundingClientRect(), ch2 = cv._ch; if (!ch2 || !r.width) return null; const px = (e.clientX - r.left) / r.width * cv.clientWidth; const f = (px - ch2.L) / ch2.pw; return f < 0 || f > 1 ? null : ch2.xmin + f * (ch2.xmax - ch2.xmin); };
  const cvY = (cv, e) => { const r = cv.getBoundingClientRect(), c2 = cv._ch; if (!c2 || !r.height) return null; const py = (e.clientY - r.top) / r.height * cv.clientHeight; return c2.ymax - (py - c2.T) / c2.ph * (c2.ymax - c2.ymin); };

  /* ============================================================ Messschreiber (Prüfstand und Regler einstellen) */
  const scopeBoxHtml = id => `<div class="scope" id="${id}"><div class="scbar"><button class="chip s" data-sc="half" aria-label="Zeitfenster halbieren">½×</button><button class="chip s" data-sc="dbl" aria-label="Zeitfenster verdoppeln">2×</button><button class="chip s" data-sc="scale" aria-label="Skala umschalten">Skala</button><button class="chip s" data-sc="live" aria-label="Zurück zur Gegenwart">⏭ Live</button><span class="scinfo"></span></div>
    <div class="chartbox sc"><canvas class="scTop" aria-label="Messschreiber: Istwert und Sollwert"></canvas></div><div class="chartbox lane"><canvas class="scLane" aria-label="Messschreiber: Stellgröße und Störgröße"></canvas></div>
    <label class="f scrub"><span>Zeitreise: ziehe nach links, um zurückzuschauen</span><input type="range" class="scScrub" min="0" max="1000" step="1" value="1000"></label><div class="readout scRead"></div></div>`;
  function scopeWin() {
    const H = S.hist, n = H.t.length, sp = viewSpan(); if (!n) return null;
    const tEnd = H.t[n - 1], tStart = H.t[0], maxOff = Math.max(0, tEnd - tStart - sp);
    S.view.off = clamp(S.view.off, 0, maxOff);
    const t1 = tEnd - S.view.off, t0 = t1 - sp, i0 = Math.max(0, lowerBound(H.t, t0) - 1), i1 = Math.min(n, lowerBound(H.t, t1 + 1e-12) + 1);
    return { t0, t1, i0, i1, maxOff, tEnd, tStart, sp };
  }
  function scopeData(win) {
    const H = S.hist, step = Math.max(1, Math.ceil((win.i1 - win.i0) / 700)), d = { w: [], x: [], y: [], z: [], t: [] };
    for (let i = win.i0; i < win.i1; i += step) { const tt = toU(H.t[i]); d.t.push(H.t[i]); d.w.push([tt, H.w[i]]); d.x.push([tt, H.x[i]]); d.y.push([tt, H.y[i]]); d.z.push([tt, H.z[i]]); }
    return d;
  }
  function drawScope(box) {
    const top = $('.scTop', box), lane = $('.scLane', box); if (!top || !lane) return;
    const win = scopeWin(), info = $('.scinfo', box), rd = $('.scRead', box), scr = $('.scScrub', box);
    if (!win) { drawChart(top, { series: [], empty: 'Der Messschreiber läuft, sobald der Prüfstand läuft (▶ unten).' }); drawChart(lane, { series: [] }); if (info) info.textContent = ''; return; }
    const d = scopeData(win), r = rng(), xs = [toU(win.t0), toU(win.t1)], ser = [];
    if (S.ghost && S.jump && S.jump.kind === 'w' && S.ghost.t) ser.push({ name: 'gemerkt', color: '#9aa7b4', alpha: 0.5, width: 2, pts: S.ghost.t.map((t, i) => [toU(S.jump.t0 + t), S.ghost.x[i]]) });
    ser.push({ name: 'w', color: '#ffb340', dash: [6, 5], width: 1.8, pts: d.w }, { name: 'x', color: '#3b9eff', width: 2.4, pts: d.x });
    let yMin, yMax; if (S.view.full) { yMin = r.lo; yMax = r.hi; } else {
      let lo = Infinity, hi = -Infinity; d.x.concat(d.w).forEach(p => { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }); const pad = Math.max((hi - lo) * 0.12, span() * 0.03); yMin = Math.max(r.lo - span() * 0.05, lo - pad); yMax = Math.min(r.hi + span() * 0.05, hi + pad);
    }
    const J = S.jump, hl = [], vl = [], bands = [];
    if (J && J.done && J.res && J.res.ok !== false && J.kind === 'w') { const dw = Math.abs(J.w1 - J.w0) * 0.02; bands.push({ y0: J.w1 - dw, y1: J.w1 + dw, color: 'rgba(76,217,100,.12)' }); vl.push({ x: toU(J.t0), color: 'rgba(232,236,240,.55)', dash: [2, 3] }); if (fin(J.res.tAus2)) vl.push({ x: toU(J.t0 + J.res.tAus2), color: 'rgba(76,217,100,.8)', dash: [4, 3], label: 'ausgeregelt' }); }
    if (J && J.kind === 'z' && J.res && J.res.ok !== false) vl.push({ x: toU(J.t0), color: 'rgba(255,92,92,.6)', dash: [2, 3], label: 'Störung' });
    drawChart(top, { series: ser, bands, hlines: hl, vlines: vl, xMin: xs[0], xMax: xs[1], yMin, yMax, noX: true, yLabel: (r.unit || '') , cursorX: S.cursorT != null ? toU(S.cursorT) : null });
    const zc = ctlDef('z'), z0 = zc && fin(+zc.value) ? +zc.value : 0, strips = []; let sx = null;
    for (let i = 0; i < d.z.length; i++) { const on = Math.abs(d.z[i][1] - z0) > 1e-9; if (on && sx == null) sx = d.z[i][0]; if ((!on || i === d.z.length - 1) && sx != null) { strips.push({ x0: sx, x1: d.z[i][0], color: 'rgba(255,92,92,.75)' }); sx = null; } }
    drawChart(lane, { series: [{ name: 'y', color: '#4cd964', width: 2, pts: d.y }], strips, xMin: xs[0], xMax: xs[1], yMin: 0, yMax: 105, xLabel: 'Prozesszeit in ' + TU(), yLabel: 'y in %', cursorX: S.cursorT != null ? toU(S.cursorT) : null });
    if (info) { const t = (win.sp >= 1 ? fnum(toU(win.sp), adig(toU(win.sp))) : fnum(toU(win.sp), 2)) + ' ' + TU(); const h = 'Fenster ' + t + (S.view.off > 0 ? ' · zurückgeschaut' : ' · live'); if (info.textContent !== h) info.textContent = h; }
    if (scr && document.activeElement !== scr) scr.value = win.maxOff > 0 ? String(Math.round(1000 * (1 - S.view.off / win.maxOff))) : '1000';
    if (scr) scr.disabled = !(win.maxOff > 0);
    if (rd) {
      let txt = '';
      if (S.cursorT != null) { const H = S.hist; let i = clamp(lowerBound(H.t, S.cursorT), 0, H.t.length - 1); if (i > 0 && Math.abs(H.t[i - 1] - S.cursorT) < Math.abs(H.t[i] - S.cursorT)) i--; txt = 't = <b>' + tstr(H.t[i]) + '</b> · Sollwert w <b>' + physStr(H.w[i]) + '</b> · Istwert x <b>' + physStr(H.x[i]) + '</b> · Stellgröße y <b>' + fnum(H.y[i], 1) + ' %</b> · Störgröße z <b>' + fauto(H.z[i]) + '</b>'; }
      if (rd.dataset.h !== txt) { rd.dataset.h = txt; rd.innerHTML = txt; }
    }
  }
  function wireScope(box) {
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-sc]'); if (!b) return; const k = b.dataset.sc;
      if (k === 'half') S.view.mul = Math.max(1 / 16, S.view.mul / 2); else if (k === 'dbl') S.view.mul = Math.min(16, S.view.mul * 2); else if (k === 'scale') S.view.full = !S.view.full; else if (k === 'live') S.view.off = 0;
      drawScopes();
    });
    box.addEventListener('input', e => {
      if (!e.target.classList.contains('scScrub')) return; const win = scopeWin(); if (!win) return;
      S.view.off = win.maxOff * (1 - (+e.target.value) / 1000); drawScopes();
    });
    const set = e => { const cv = e.target.closest('canvas'); if (!cv || !cv._ch) return; const x = cvX(cv, e); S.cursorT = x == null ? null : fromU(x); drawScopes(); };
    box.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) set(e); });
    box.addEventListener('pointerdown', e => { const cv = e.target.closest('canvas'); if (cv) { try { cv.setPointerCapture(e.pointerId); } catch (x) {} } set(e); });
    box.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { S.cursorT = null; drawScopes(); } }, true);
  }
  function drawScopes() { $$('.scope').forEach(b => { if (b.offsetParent !== null) drawScope(b); }); }

  /* ---- Aufzeichnung als CSV (Prozesszeit in Sekunden, Dezimalkomma, Semikolon) und Rückleser (Roundtrip-Test) ---- */
  const csvNum = v => (fin(v) ? String(+(+v).toPrecision(9)).replace('.', ',') : '');
  function csvText() {
    const H = S.hist, r = rng();
    const head = ['Prozesszeit [s]', 'Sollwert w [' + (r.unit || '') + ']', 'Istwert x [' + (r.unit || '') + ']', 'Stellgröße y [%]', 'Störgröße z'].join(';');
    const rows = H.t.map((t, i) => [csvNum(t), csvNum(H.w[i]), csvNum(H.x[i]), csvNum(H.y[i]), csvNum(H.z[i])].join(';'));
    return head + '\r\n' + rows.join('\r\n') + '\r\n';
  }
  function parseCsv(txt) {
    const lines = String(txt).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean), out = { t: [], w: [], x: [], y: [], z: [] };
    lines.slice(1).forEach(l => { const c = l.split(';').map(q => parseFloat(q.replace(',', '.'))); if (c.length >= 5 && c.every(fin)) { out.t.push(c[0]); out.w.push(c[1]); out.x.push(c[2]); out.y.push(c[3]); out.z.push(c[4]); } });
    return out;
  }
  function exportCsv() {
    if (!S.hist.t.length) { toast('Noch nichts aufgezeichnet. Starte den Prüfstand.'); return; }
    const blob = new Blob(['﻿' + csvText()], { type: 'text/csv;charset=utf-8' });
    if (root.LabExport) root.LabExport.saveBlob(blob, root.LabExport.fname('csv'));
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'regelung-aufzeichnung.csv'; document.body.appendChild(a); a.click(); a.remove(); }
    toast('CSV mit ' + S.hist.t.length + ' Messpunkten gespeichert');
  }

  /* ============================================================ Tab Strecke messen */
  const canMeasure = () => !!(S.rig && hasCtl('mode') && hasCtl('yHand') && typeof S.rig.setOperatingPoint === 'function' && S.rigId !== 'thermostat');
  const idOf = () => { let r = null; try { r = S.rig && typeof S.rig.identify === 'function' ? S.rig.identify() : null; } catch (e) { r = null; } return r; };
  /* Länge der Aufzeichnung in Prozess-Sekunden: aus identify() (nur die Zeit wird gezeigt, nie die Kennwerte) */
  function recLen(dy) {
    const id = idOf() || {}, Tg = fin(id.Tg) ? id.Tg : NaN, Tu = fin(id.Tu) ? id.Tu : 0, Ts = fin(id.Tsum) ? id.Tsum : NaN; let L;
    if (id.art === 'I') { L = fin(Ts) ? 14 * Ts : 60 * rigH(); if (fin(id.Kis) && id.Kis > 0) L = Math.min(L, 55 / (id.Kis * dy)); }
    else L = fin(Tg) ? 6 * Tg + 3 * Tu : (fin(Ts) ? 8 * Ts : 600 * rigH());
    return Math.max(L, 60 * hDt());
  }
  const MS = () => S.meas || (S.meas = { stage: 0, on: false, rec: null, marker: null, v1: null, v2: null, isI: false, cmp: null });
  function measReset() { S.meas = null; if (S.tab === 'meas') renderMeas(); }
  /* (a) Arbeitspunkt anfahren: Hand, y0, Beharrungszustand ohne Vorlauf */
  function measPrepare() {
    if (!canMeasure()) return; const y0 = clamp(parseNum($('#mY0') && $('#mY0').value), 0, 100);
    const yy = fin(y0) ? y0 : (MEAS_Y0[S.rigId] || 40);
    setRun(false); S.live = null; S.hist = { t: [], w: [], x: [], y: [], z: [] }; S.jump = null; S.view.off = 0;
    try { S.rig.setOperatingPoint(yy); } catch (e) { console.error(e); toast('Der Arbeitspunkt konnte nicht gesetzt werden.'); return; }
    applyCtl({ mode: 'hand', yHand: yy }); readState(); sample(); S.meas = { stage: 1, on: false, rec: null, marker: null, v1: null, v2: null, isI: false, cmp: null, y0: yy };
    toast('Arbeitspunkt angefahren: Handbetrieb mit y = ' + fnum(yy, 1) + ' %. Der Prüfstand steht im Beharrungszustand.'); measUpdate(true);
  }
  /* (b) Sprung auslösen: Aufzeichnung ab dem Sprung */
  function measStep() {
    const M = MS(); if (M.stage < 1) { toast('Fahre zuerst den Arbeitspunkt an (Schritt 1).'); return; }
    let dy = parseNum($('#mDy') && $('#mDy').value); if (!fin(dy)) dy = 10; dy = clamp(dy, 2, 30); if (M.y0 + dy > 100) dy = Math.max(2, 100 - M.y0);
    const y1 = M.y0 + dy, st = readState(); if (!st) return; sample();
    M.rec = { t0: st.t, y0: M.y0, y1, dy, x0: st.x, t: [0], x: [st.x], y: [M.y0], L: recLen(dy), done: false }; M.on = true; M.stage = 2; M.marker = null; M.v1 = null; M.v2 = null; M.cmp = null; M.isI = false;
    setCtl('yHand', y1, true); setRun(true); measUpdate(true);
  }
  function measSample(st) { const M = S.meas; if (!M || !M.rec || M.rec.done) return; const R = M.rec; R.t.push(st.t - R.t0); R.x.push(+st.x); R.y.push(+st.y); }
  function measTick() {
    const M = S.meas; if (!M || !M.rec || M.rec.done) return; const R = M.rec;
    if (R.t[R.t.length - 1] >= R.L) { R.done = true; M.on = false; M.stage = 3; setRun(false); stat('regstep', 1, 'max'); S.stepDone = true; toast('Die Aufzeichnung ist fertig. Lege jetzt die Wendetangente an.'); measUpdate(true); }
  }
  const measT = () => (S.meas && S.meas.rec ? S.meas.rec.t : []);
  /* Steigung (physikalisch je Prozess-s) um den Index i über ein kurzes Fenster */
  function slopeAt(R, i) {
    const k = Math.max(2, Math.round(R.t.length * 0.012)), a = Math.max(0, i - k), b = Math.min(R.t.length - 1, i + k); let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
    for (let j = a; j <= b; j++) { sx += R.t[j]; sy += R.x[j]; sxx += R.t[j] * R.t[j]; sxy += R.t[j] * R.x[j]; n++; }
    const den = n * sxx - sx * sx; return Math.abs(den) < 1e-18 ? 0 : (n * sxy - sx * sy) / den;
  }
  function measChartOpts() {
    const M = S.meas, R = M && M.rec; if (!R || R.t.length < 2) return null;
    const dsp = TDIV[TU()] || 1, pts = R.t.map((t, i) => [t / dsp, R.x[i]]), tEnd = R.t[R.t.length - 1];
    if (M.marker == null) { M.marker = R.L * 0.18; M.v1 = R.L * 0.05; M.v2 = R.L * 0.4; }
    const i = clamp(lowerBound(R.t, M.marker), 0, R.t.length - 1), xM = R.x[i], s = slopeAt(R, i), tM = R.t[i];
    const t0 = 0, t1 = Math.max(tEnd, R.L), segs = [{ x0: t0 / dsp, y0: xM + s * (t0 - tM), x1: t1 / dsp, y1: xM + s * (t1 - tM), color: '#c77dff', width: 1.6 }];
    const hl = [{ y: R.x0, color: 'rgba(141,153,166,.55)', label: 'Anfangswert' }];
    if (R.done) { const n = R.t.length, k = Math.max(3, Math.floor(n * 0.05)); let m = 0; for (let j = n - k; j < n; j++) m += R.x[j]; hl.push({ y: m / k, color: 'rgba(141,153,166,.55)', label: 'Endwert (letzte 5 %)' }); }
    return { series: [{ name: 'x', color: '#3b9eff', pts }], segs, hlines: hl, vlines: [{ x: M.v1 / dsp, color: '#ffb340', dash: [5, 4], width: 2, label: 'Tu' }, { x: M.v2 / dsp, color: '#4cd964', dash: [5, 4], width: 2, label: 'Tu + Tg' }], points: [{ x: tM / dsp, y: xM, color: '#c77dff', r: 7 }], xMin: 0, xMax: t1 / dsp, xLabel: 'Zeit seit dem Sprung in ' + TU() + ' (Prozesszeit)', yLabel: rng().unit || '', _i: i, _slope: s };
  }
  function drawMeasChart() {
    const cv = $('#mCv'); if (!cv) return; const o = measChartOpts();
    if (!o) { drawChart(cv, { series: [], empty: 'Noch keine Aufzeichnung: Schritt 1 und 2 ausführen.' }); return; }
    drawChart(cv, o);
    const M = S.meas, Tu = M.v1, Tg = M.v2 - M.v1, tu = $('#mTu'), tg = $('#mTg');
    if (M.syncFields) { if (tu && document.activeElement !== tu) tu.value = fnum(toU(Math.max(0, Tu)), adig(toU(Math.max(0.0001, Tu)))); if (tg && document.activeElement !== tg) tg.value = fnum(toU(Math.max(0, Tg)), adig(toU(Math.max(0.0001, Tg)))); }
    const rt = $('#mRatio'); if (rt) { const a = parseNum(tu && tu.value), b = parseNum(tg && tg.value); rt.textContent = fin(a) && fin(b) && a > 0 ? 'Tg/Tu = ' + fnum(b / a, 2) : 'Tg/Tu = –'; }
  }
  function wireMeasChart() {
    const cv = $('#mCv'); if (!cv) return; let drag = null;
    const hit = e => {
      const c = cv._ch, M = S.meas; if (!c || !M || !M.rec) return null; const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * cv.clientWidth, py = (e.clientY - r.top) / r.height * cv.clientHeight, dsp = TDIV[TU()] || 1;
      const X = t => c.L + c.pw * (t / dsp - c.xmin) / (c.xmax - c.xmin), Y = v => c.T + c.ph * (1 - (v - c.ymin) / (c.ymax - c.ymin));
      const R = M.rec, i = clamp(lowerBound(R.t, M.marker), 0, R.t.length - 1), cand = [{ k: 'm', d: Math.hypot(px - X(R.t[i]), py - Y(R.x[i])) * 0.8 }, { k: 'v1', d: Math.abs(px - X(M.v1)) }, { k: 'v2', d: Math.abs(px - X(M.v2)) }].sort((a, b) => a.d - b.d);
      return cand[0].d < 36 ? cand[0].k : 'm';
    };
    const move = e => {
      if (!drag) return; const M = S.meas, R = M.rec, x = cvX(cv, e); if (x == null) return; const t = clamp(x * (TDIV[TU()] || 1), 0, Math.max(R.t[R.t.length - 1], R.L));
      if (drag === 'm') { const i = clamp(lowerBound(R.t, t), 0, R.t.length - 1); M.marker = R.t[i]; } else if (drag === 'v1') M.v1 = Math.min(t, M.v2 - 1e-9); else M.v2 = Math.max(t, M.v1 + 1e-9);
      M.syncFields = true; M.cmp = null; drawMeasChart(); measUpdate(false);
    };
    cv.addEventListener('pointerdown', e => { if (!S.meas || !S.meas.rec) return; try { cv.setPointerCapture(e.pointerId); } catch (x) {} drag = hit(e); move(e); });
    cv.addEventListener('pointermove', e => { if (drag) move(e); });
    const up = () => { drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  }
  /* Vergleich mit dem automatischen Verfahren: einziger Algorithmus REG_CORE.fitStep (Regel 7) */
  function measFit() {
    const M = S.meas, C = CORE(); if (!M || !M.rec || !M.rec.done) return null; if (!C || typeof C.fitStep !== 'function') return { ok: false, why: 'Die automatische Auswertung ist nicht geladen (regcore.js fehlt).' };
    const R = M.rec; let r; try { r = C.fitStep(R.t.slice(), R.x.map(toPct), R.dy, {}); } catch (e) { r = { ok: false, why: 'Die Auswertung ist fehlgeschlagen: ' + (e && e.message || e) }; } return r;
  }
  const rel = (a, b) => (fin(a) && fin(b) && b !== 0 ? Math.abs(a - b) / Math.abs(b) : NaN);
  /* Ampel: Toleranz Ks 10 %, Tu und Tg 15 % (A13); ist Tu fast 0, gilt zusätzlich 3 % von Tg als Absolutgrenze (A) */
  function ampel(kind, mine, ref, Tg) {
    if (!fin(mine) || !fin(ref)) return { cls: 'bad', pct: NaN, text: 'kein Wert' };
    const tol = kind === 'Ks' || kind === 'Kis' ? 0.10 : 0.15; let dev = rel(mine, ref); const absOk = (kind === 'Tu' && fin(Tg) && Math.abs(mine - ref) <= 0.03 * Tg);
    const ok = dev <= tol || absOk, near = dev <= 2 * tol;
    return { cls: ok ? 'ok' : near ? 'warnc' : 'bad', pct: dev * 100, text: ok ? (dev <= tol ? 'passt' : 'passt (klein gegen Tg)') : near ? 'knapp daneben' : 'zu weit weg' };
  }
  function measCompare() {
    const M = S.meas; if (!M || !M.rec || !M.rec.done) { toast('Die Aufzeichnung ist noch nicht fertig.'); return; }
    const fit = measFit(); const Ks = parseNum($('#mKs').value), Tu = fromU(parseNum($('#mTu').value)), Tg = fromU(parseNum($('#mTg').value)), isI = $('#mIsI').checked;
    M.cmp = { fit, mine: { Ks, Tu, Tg, isI } }; measUpdate(true);
  }
  function measAccept(which) {
    const M = S.meas; if (!M || !M.cmp || !M.cmp.fit || M.cmp.fit.ok === false) { toast('Es gibt noch keinen Vergleich.'); return; }
    const f = M.cmp.fit, m = M.cmp.mine, use = which === 'auto' ? { Ks: f.Ks, Tu: f.Tu, Tg: f.Tg, Kis: f.Kis, art: f.art } : { Ks: m.isI ? null : m.Ks, Tu: m.Tu, Tg: m.isI ? null : m.Tg, Kis: m.isI ? m.Ks : null, art: m.isI ? 'I' : 'P' };
    S.strecke = Object.assign({}, S.strecke && S.strecke.rig === S.rigId ? S.strecke : {}, { rig: S.rigId, art: use.art }, use.art === 'I' ? { Kis: use.Kis, Tu: use.Tu } : { Ks: use.Ks, Tu: use.Tu, Tg: use.Tg }, { urteil: f.urteil || f.verdict || '' });
    S.dirty = true; saveCurSoon(); toast('Kennwerte der Strecke gespeichert. Du findest sie bei „Regler einstellen“ und im Rechner.'); measUpdate(true);
  }
  const KW = [['Ks', 'Streckenverstärkung Ks', ''], ['Kis', 'Integrierbeiwert Kis', '1/s'], ['Tu', 'Verzugszeit Tu', 'T'], ['Tg', 'Ausgleichszeit Tg', 'T'], ['Kkrit', 'Kritische Verstärkung Kkrit', ''], ['Tkrit', 'Periodendauer Tkrit', 'T']];
  function kwHtml() {
    const s = S.strecke && S.strecke.rig === S.rigId ? S.strecke : null;
    if (!s) return '<p class="hint2" style="margin:0">Noch keine Kennwerte gespeichert. Nimm die Sprungantwort auf (Schritte 1 bis 4) oder mache den Schwingversuch.</p>';
    return '<table class="kt"><tr><th>Kennwert</th><th>Wert</th></tr>' + KW.filter(k => fin(s[k[0]])).map(k => `<tr><td>${esc(k[1])}</td><td><b>${k[2] === 'T' ? tstr(s[k[0]]) : fnum(s[k[0]], adig(s[k[0]])) + (k[2] ? ' ' + k[2] : '')}</b></td></tr>`).join('') + (s.art ? `<tr><td>Streckenart</td><td><b>${s.art === 'I' ? 'ohne Ausgleich (I-Strecke)' : 'mit Ausgleich (P-Strecke)'}</b></td></tr>` : '') + '</table>' + (s.kkritAuto ? '<p class="hint2">Kkrit und Tkrit hat der Prüfstand automatisch bestimmt (zählt als Hilfe).</p>' : '');
  }

  /* ---- Schwingversuch (Ziegler-Nichols) ---- */
  function swUnavail() { const C = CORE(); if (!C || typeof C.ultimate !== 'function' || !S.rig || typeof S.rig.linBlocks !== 'function') return null; let u = null; try { u = C.ultimate(S.rig.linBlocks()); } catch (e) { return null; } return u && u.ok === false ? (u.why || 'Diese Strecke schwingt mit einem P-Regler nie.') : null; }
  function swPrepare() {
    if (!S.rig) return; const why = swUnavail(); if (why) { S.sw = { unavail: why }; swUpdate(); return; }
    const y0 = MEAS_Y0[S.rigId] || 40; S.live = null; S.hist = { t: [], w: [], x: [], y: [], z: [] }; S.jump = null; S.meas = null; setRun(false);
    try { S.rig.setOperatingPoint(y0); } catch (e) { console.error(e); }
    let wv = null; try { wv = typeof S.rig.steady === 'function' ? S.rig.steady(y0) : null; } catch (e) { wv = null; }
    const kp0 = clamp(0.5, (ctlDef('kp') || { min: 0.1 }).min, (ctlDef('kp') || { max: 100 }).max);
    applyCtl({ ctrl: 'P', tv: 0, dir: S.rig.requiredDir || 'direkt', u0: y0, kp: kp0, mode: 'auto' }); if (fin(wv)) applyCtl({ w: wv }); readState(); sample();
    S.sw = { on: true, kp: kp0, tChange: S.st ? S.st.t : 0, base: fin(wv) ? wv : S.st.w, sign: 1, found: null, auto: false, low: null, high: null, osc: null, msg: 'Versuch vorbereitet: P-Regler, Tv aus, kleines Kp. Stoße den Kreis an und erhöhe Kp.' };
    swUpdate(); drawScopes();
  }
  function swKick() {
    const sw = S.sw; if (!sw || !sw.on) return; const d = 0.05 * span() * sw.sign; sw.sign = -sw.sign;
    const c = ctlDef('w'); setCtl('w', clamp(sw.base + (sw.sign < 0 ? d : 0), c.min, c.max), true); sw.tChange = S.st ? S.st.t : sw.tChange;
    if (!S.running) setRun(true);
  }
  function swSetKp(kp, kick) {
    const sw = S.sw; if (!sw || !sw.on) return; const c = ctlDef('kp'); kp = clamp(kp, c.min, c.max); setCtl('kp', kp, true); sw.kp = kp; sw.tChange = S.st ? S.st.t : 0; sw.osc = null; if (kick !== false) swKick(); swUpdate();
  }
  function swUp() { const sw = S.sw; if (!sw || !sw.on) { toast('Bereite zuerst den Versuch vor.'); return; } sw.msg = ''; swSetKp(sw.kp * 1.15); }
  function swAutoInterval() { const id = idOf() || {}, Td = fin(id.Tg) ? id.Tg : (fin(id.Tsum) ? id.Tsum : 20 * ((S.rig && S.rig.timeScale) || 1)); return Math.max(3 * Td, 20 * ((S.rig && S.rig.timeScale) || 1)); }
  function swAuto() { const sw = S.sw; if (!sw || !sw.on) { toast('Bereite zuerst den Versuch vor.'); return; } sw.auto = !sw.auto; if (sw.auto) { sw.every = swAutoInterval(); if (!S.running) setRun(true); } swUpdate(); }
  function swTick() {
    const sw = S.sw, C = CORE(); if (!sw || !sw.on || sw.found || !C || typeof C.oscillation !== 'function' || !S.st) return;
    const now = performance.now(); if (now - (sw.ck || 0) < 350) return; sw.ck = now;
    const H = S.hist, i0 = lowerBound(H.t, sw.tChange); if (H.t.length - i0 < 30) return;
    let r = null; try { r = C.oscillation(H.t.slice(i0), H.x.slice(i0), { range: span() }); } catch (e) { r = null; } if (!r) return; sw.osc = r;
    if (r.cls === 'dauerschwingung' && fin(r.period) && r.period > 0) {
      sw.found = { Kkrit: S.st.kp, Tkrit: r.period }; sw.auto = false; sw.msg = 'Dauerschwingung erkannt: Kkrit ist das aktuelle Kp, Tkrit die gemessene Periode.';
      S.strecke = Object.assign({}, S.strecke && S.strecke.rig === S.rigId ? S.strecke : {}, { rig: S.rigId, Kkrit: sw.found.Kkrit, Tkrit: sw.found.Tkrit, kkritAuto: false }); S.dirty = true; saveCurSoon(); stat('regzn', 1, 'max'); stat('regosc', 1, 'max'); setRun(false); toast('Dauerschwingung: Kkrit = ' + fnum(sw.found.Kkrit, 2) + ', Tkrit = ' + tstr(sw.found.Tkrit)); swUpdate(); return;
    }
    if (r.cls === 'aufschaukelnd') { sw.high = sw.kp; sw.msg = 'Die Schwingung wird größer: Kkrit liegt unter dem aktuellen Kp. Gehe in kleineren Schritten zurück.'; if (sw.auto && sw.low != null) { const mid = Math.sqrt(sw.low * sw.high); if (sw.high / sw.low < 1.02) { sw.auto = false; sw.msg = 'Kkrit liegt zwischen ' + fnum(sw.low, 2) + ' und ' + fnum(sw.high, 2) + '. Die Dauerschwingung lässt sich nicht genauer treffen: Wähle Kp in diesem Bereich von Hand.'; } else swSetKp(mid); } else if (sw.auto) { sw.auto = false; } swUpdate(); return; }
    if (sw.auto && S.st.t - sw.tChange >= sw.every && (r.cls === 'gedaempft' || r.cls === 'aperiodisch')) { sw.low = sw.kp; sw.msg = ''; swSetKp(sw.high != null ? Math.sqrt(sw.kp * sw.high) : sw.kp * 1.15); }
  }
  async function swFind() {
    if (!S.rig) return; const C = CORE(); if (!C || typeof C.findCritical !== 'function') { toast('Die automatische Bestimmung ist nicht geladen (regcore.js fehlt).'); return; }
    const why = swUnavail(); if (why) { S.sw = { unavail: why }; swUpdate(); return; }
    if (!await confirmSheet('Automatisch bestimmen?', 'Der Prüfstand führt den Schwingversuch selbst durch und liefert Kkrit und Tkrit. Das <b>zählt als Hilfe</b>: Dein Ausbilder sieht es bei den Aufgaben.', 'Bestimmen')) return;
    const id = S.rigId, d = defOf(id); let r; try { r = C.findCritical(() => d.create({ seed: 1 }), {}); } catch (e) { r = { ok: false, why: 'Der Versuch ist fehlgeschlagen: ' + (e && e.message || e) }; }
    S.helpUsed = true;
    if (!r || r.ok === false) { S.sw = Object.assign(S.sw || {}, { unavail: (r && r.why) || 'Kkrit konnte nicht bestimmt werden.', on: false }); swUpdate(); return; }
    S.strecke = Object.assign({}, S.strecke && S.strecke.rig === S.rigId ? S.strecke : {}, { rig: S.rigId, Kkrit: r.Kkrit, Tkrit: r.Tkrit, kkritAuto: true }); S.dirty = true; saveCurSoon(); stat('regzn', 1, 'max');
    S.sw = Object.assign(S.sw || {}, { unavail: null, found: { Kkrit: r.Kkrit, Tkrit: r.Tkrit }, msg: 'Der Prüfstand hat Kkrit und Tkrit bestimmt (Hilfe).' }); swUpdate(); measUpdate(true);
  }
  const OSCTXT = { aperiodisch: 'aperiodisch (keine Schwingung erkennbar)', gedaempft: 'gedämpft (die Schwingung klingt ab)', dauerschwingung: 'Dauerschwingung', aufschaukelnd: 'aufschaukelnd (die Schwingung wächst)' };
  function swUpdate() {
    const el = $('#swBox'); if (!el) return; const sw = S.sw, st = S.st || {};
    let h;
    if (sw && sw.unavail) h = `<p class="hint2" style="color:var(--warn)">${esc(sw.unavail)}</p>`;
    else if (!sw || !sw.on) h = '<p class="hint2">Bei diesem Versuch regelst du mit einem reinen P-Regler und steigerst Kp, bis der Kreis gerade noch dauernd schwingt. Dieses Kp ist <b>Kkrit</b>, die Schwingdauer ist <b>Tkrit</b>.</p>';
    else h = `<div class="kvs"><span>Aktuelles Kp</span><b>${fnum(sw.kp, 2)}</b></div><div class="kvs"><span>Schwingung</span><b>${sw.osc ? esc(OSCTXT[sw.osc.cls] || sw.osc.cls) : 'noch nicht beurteilt'}</b></div>${sw.found ? `<div class="res"><div class="big2">Kkrit = ${fnum(sw.found.Kkrit, 2)}</div><div class="big2">Tkrit = ${tstr(sw.found.Tkrit)}</div></div>` : ''}${sw.msg ? `<p class="hint2">${esc(sw.msg)}</p>` : ''}`;
    void st; el.innerHTML = h; const b = $('[data-sw=auto]'); if (b) { b.classList.toggle('on', !!(sw && sw.auto)); b.textContent = sw && sw.auto ? '⏹ Automatik stoppen' : '⏵ Automatisch steigern'; }
  }

  /* ---- Anzeige des Tabs ---- */
  function renderMeas() {
    const V = $('#measView');
    if (!S.rig) { V.innerHTML = '<div class="card pl">' + placeholderHtml() + '</div>'; return; }
    const r = rng(), cm = canMeasure(), M = MS(), y0 = M.y0 != null ? M.y0 : (MEAS_Y0[S.rigId] || 40);
    V.innerHTML = `<div class="card pl"><h4>Die Regelstrecke ohne Regler vermessen</h4>
      <p class="hint2" style="margin:0 0 6px">Prüfstand: ${rigIcon(S.rigId)} <b>${esc(rigName(S.rigId))}</b>. Messbereich der Regelgröße: ${esc(physStr(r.lo))} bis ${esc(physStr(r.hi))} = 100 %. Zeiten stehen in <b>Prozesszeit</b> (${esc(TU())}).</p>
      ${cm ? `<ol class="steps" id="mSteps">
        <li data-s="1"><b>Arbeitspunkt anfahren</b><span class="sdesc">Handbetrieb mit der Stellgröße y0, die Anlage steht im Beharrungszustand.</span><div class="srow"><label class="f"><span>y0 in %</span><input id="mY0" inputmode="decimal" autocomplete="off" value="${fnum(y0, 0)}"></label><button class="btn pri" data-m="prep">Arbeitspunkt anfahren</button></div></li>
        <li data-s="2"><b>Sprung auslösen</b><span class="sdesc">Die Stellgröße springt um Δy, die Aufzeichnung beginnt.</span><div class="srow"><label class="f"><span>Δy in % (2 bis 30)</span><input id="mDy" inputmode="decimal" autocomplete="off" value="10"></label><button class="btn pri" data-m="step">Sprung auslösen</button></div></li>
        <li data-s="3"><b>Aufzeichnung läuft</b><div class="pbar big"><i id="mProg" style="width:0%"></i></div><span class="sdesc" id="mProgTxt">Noch nicht gestartet.</span></li>
        <li data-s="4"><b>Auswerten</b><span class="sdesc">Lege unten die Wendetangente an und lies Tu und Tg ab.</span></li></ol>` : '<p class="hint2" style="color:var(--warn)">An diesem Prüfstand gibt es keine Handbetrieb-Strecke zum Vermessen (hier regelt ein Schaltregler). Wähle einen anderen Prüfstand, zum Beispiel die Füllstandsregelung.</p>'}</div>
      ${cm ? `<div class="card pl" id="mEval"><h4>Auswertung von Hand: Wendetangente</h4>
        <p class="hint2" style="margin:0 0 6px">Ziehe den <b style="color:#c77dff">Wendepunkt</b> (Punkt auf der Kurve) an die steilste Stelle, die Tangente folgt. Schiebe die <b style="color:var(--warn)">orange Linie</b> auf den Schnitt der Tangente mit dem Anfangswert (Tu) und die <b style="color:var(--ok)">grüne Linie</b> auf den Schnitt mit dem Endwert (Tu + Tg).</p>
        <div class="chartbox"><canvas id="mCv" aria-label="Aufgezeichnete Sprungantwort mit Wendetangente"></canvas></div>
        <div class="frm"><label class="f"><span>Ks (Δx / Δy, beide in %)</span><input id="mKs" inputmode="decimal" autocomplete="off"></label><label class="f"><span>Tu in ${esc(TU())}</span><input id="mTu" inputmode="decimal" autocomplete="off"></label><label class="f"><span>Tg in ${esc(TU())}</span><input id="mTg" inputmode="decimal" autocomplete="off"></label></div>
        <div class="readout" id="mRatio">Tg/Tu = –</div>
        <label class="chk"><input type="checkbox" id="mIsI"> Strecke ohne Ausgleich (I-Strecke): statt Ks gilt der Integrierbeiwert Kis in 1/s, Tg entfällt</label>
        <div class="btns"><button class="btn" data-m="ksend">Ks aus dem Endwert berechnen</button><button class="btn pri" data-m="cmp">Vergleichen</button></div><div id="mCmp"></div></div>` : ''}
      <div class="card pl"><h4>Statische Kennlinie</h4><div class="chartbox"><canvas id="mCrv" aria-label="Statische Kennlinie der Strecke"></canvas></div><div class="legend" id="mCrvLeg"></div><div class="readout" id="mCrvRead"></div><div class="rbar" id="mCrvSel"></div></div>
      <div class="card pl" id="mZn"><h4>Schwingversuch nach Ziegler-Nichols</h4><div id="swBox"></div>
        <div class="btns"><button class="btn pri" data-sw="prep">Versuch vorbereiten</button><button class="btn" data-sw="kick">Anstoßen</button><button class="btn" data-sw="up">Kp erhöhen (×1,15)</button><button class="btn" data-sw="auto">⏵ Automatisch steigern</button><button class="btn" data-sw="find">Automatisch bestimmen (Hilfe)</button></div>
        <p class="hint2">Den Verlauf siehst du im Messschreiber im Tab „Prüfstand“ und im Tab „Regler einstellen“.</p></div>
      <div class="card pl"><h4>Kennwerte der Strecke</h4><div id="mRes"></div><div class="btns"><button class="btn pri" data-m="tune">Zu „Regler einstellen“</button><button class="btn" data-m="calc">In den Rechner</button><button class="btn danger" data-m="clr">Kennwerte löschen</button></div></div>`;
    M.syncFields = !!(M.rec && M.marker != null);
    wireMeasChart(); measUpdate(true); swUpdate(); drawMeasCurves(true);
  }
  let measCurSel = null, measCurLast = 0;
  function drawMeasCurves(force) {
    const cv = $('#mCrv'); if (!cv || !S.rig) return; const now = performance.now(); if (!force && now - measCurLast < 250) return; measCurLast = now;
    let cs = []; try { cs = typeof S.rig.curves === 'function' ? (S.rig.curves() || []) : []; } catch (e) { cs = []; }
    if (!cs.some(c => c.id === measCurSel)) measCurSel = cs.length ? cs[0].id : null;
    const sel = $('#mCrvSel'), sig = cs.map(c => c.id + c.title).join('|') + measCurSel; if (sel && sel.dataset.sig !== sig) { sel.dataset.sig = sig; sel.innerHTML = cs.length > 1 ? cs.map(c => `<button class="chip s${c.id === measCurSel ? ' on' : ''}" data-cid="${esc(c.id)}">${esc(c.title)}</button>`).join('') : ''; }
    const cur = cs.find(c => c.id === measCurSel), leg = $('#mCrvLeg'), rd = $('#mCrvRead');
    if (!cur) { drawChart(cv, { series: [], empty: 'Dieser Prüfstand liefert keine Kennlinien.' }); return; }
    const ser = (cur.series || []).map((s, i) => ({ name: s.name, color: s.color || PAL[i % PAL.length], dash: s.dash, pts: s.points || [] }));
    drawChart(cv, { series: ser, xLabel: (cur.xLabel || '') + (cur.xUnit ? ' in ' + cur.xUnit : ''), yLabel: (cur.yLabel || '') + (cur.yUnit ? ' in ' + cur.yUnit : ''), points: cur.marker && fin(cur.marker.x) && fin(cur.marker.y) ? [{ x: cur.marker.x, y: cur.marker.y }] : [] });
    const lh = ser.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('') + (cur.marker ? '<span><i class="dotm"></i>Betriebspunkt</span>' : ''); if (leg && leg.dataset.h !== lh) { leg.dataset.h = lh; leg.innerHTML = lh; }
    const txt = cur.marker && fin(cur.marker.x) ? 'Betriebspunkt: ' + esc(cur.xLabel || 'x') + ' = <b>' + fnum(cur.marker.x, 2) + ' ' + esc(cur.xUnit || '') + '</b>, ' + esc(cur.yLabel || 'y') + ' = <b>' + fnum(cur.marker.y, 2) + ' ' + esc(cur.yUnit || '') + '</b>' : ''; if (rd && rd.dataset.h !== txt) { rd.dataset.h = txt; rd.innerHTML = txt; }
  }
  function cmpHtml(M) {
    if (!M.cmp) return '';
    const f = M.cmp.fit, m = M.cmp.mine;
    if (!f || f.ok === false) return `<div class="res"><p class="hint2" style="color:var(--warn);margin:0">${esc((f && f.why) || 'Die automatische Auswertung ist nicht möglich.')}</p></div>`;
    const Tg = f.Tg, rows = [], isI = f.art === 'I';
    const add = (k, label, mine, ref, fmtv) => { const a = ampel(k, mine, ref, Tg); rows.push(`<tr class="${a.cls}"><td>${esc(label)}</td><td>${fmtv(mine)}</td><td>${fmtv(ref)}</td><td>${fin(a.pct) ? fnum(a.pct, 0) + ' %' : '–'}</td><td><span class="amp ${a.cls}">${esc(a.text)}</span></td></tr>`); };
    const tf = v => (fin(v) ? tstr(v) : '–'), nf = v => (fin(v) ? fnum(v, adig(v)) : '–');
    if (isI) { add('Kis', 'Kis in 1/s', m.isI ? m.Ks : NaN, f.Kis, nf); add('Tu', 'Tu', m.Tu, f.Tu, tf); } else { add('Ks', 'Ks', m.isI ? NaN : m.Ks, f.Ks, nf); add('Tu', 'Tu', m.Tu, f.Tu, tf); add('Tg', 'Tg', m.isI ? NaN : m.Tg, f.Tg, tf); }
    const C = CORE(); let warn = []; if (!isI && C && C.rules && typeof C.rules.validity === 'function') { try { const v = C.rules.validity('zn-sprung', { Ks: f.Ks, Tu: f.Tu, Tg: f.Tg }); warn = Array.isArray(v) ? v : (v && v.warn) || []; } catch (e) { warn = []; } }
    const art = `<p style="margin:8px 0 2px"><b>Streckenart:</b> ${isI ? 'ohne Ausgleich (I-Strecke)' : 'mit Ausgleich (P-Strecke)'}${m.isI !== isI ? ' <span class="amp bad">Du hast die andere Art gewählt.</span>' : ''}</p>`;
    const reg = !isI && fin(f.regelbarkeit) ? `<p style="margin:2px 0"><b>Regelbarkeit Tg/Tu:</b> ${fnum(f.regelbarkeit, 1)}${f.urteil || f.verdict ? ' (' + esc(f.urteil || f.verdict) + ')' : ''}</p>` : '';
    return `<div class="res"><table class="iot cmp"><tr><th>Kennwert</th><th>Deine Messung</th><th>Automatisch</th><th>Abweichung</th><th>Urteil</th></tr>${rows.join('')}</table>${art}${reg}${f.text ? `<p class="hint2">${esc(f.text)}</p>` : ''}${warn.map(w => `<p class="hint2">${esc(w)}</p>`).join('')}<div class="btns"><button class="btn" data-m="acc-mine">Meine Werte übernehmen</button><button class="btn pri" data-m="acc-auto">Automatische Werte übernehmen</button></div></div>`;
  }
  let measSig = '';
  function measUpdate(force) {
    if (S.tab !== 'meas') return; const M = S.meas;
    const steps = $('#mSteps'); if (steps) $$('li', steps).forEach(li => { const n = +li.dataset.s, stg = M ? M.stage : 0; li.classList.toggle('done', stg >= n + (n === 3 ? 0 : 0) && (n < 3 ? stg >= n : stg >= 3)); li.classList.toggle('cur', (stg + 1 === n) || (n === 3 && stg === 2)); });
    const pg = $('#mProg'), pt = $('#mProgTxt');
    if (pg && pt) {
      if (M && M.rec) { const R = M.rec, p = clamp(R.t[R.t.length - 1] / R.L, 0, 1), w = Math.round(p * 100) + '%'; if (pg.style.width !== w) pg.style.width = w; const txt = R.done ? 'Aufzeichnung fertig: ' + tstr(R.t[R.t.length - 1]) + ' Prozesszeit.' : 'Aufzeichnung läuft: ' + tstr(R.t[R.t.length - 1]) + ' Prozesszeit seit dem Sprung.'; if (pt.textContent !== txt) pt.textContent = txt; } else { pg.style.width = '0%'; pt.textContent = M && M.stage >= 1 ? 'Löse jetzt den Sprung aus.' : 'Noch nicht gestartet.'; }
    }
    const cmp = $('#mCmp'); if (cmp) { const h = M ? cmpHtml(M) : ''; if (force || measSig !== h) { measSig = h; cmp.innerHTML = h; } }
    const rs = $('#mRes'); if (rs) { const h = kwHtml(); if (rs.dataset.h !== h) { rs.dataset.h = h; rs.innerHTML = h; } }
    drawMeasChart(); drawMeasCurves(false);
  }
  (function () {
    const V = $('#measView');
    V.addEventListener('click', async e => {
      const m = e.target.closest('[data-m]'), sw = e.target.closest('[data-sw]'), cid = e.target.closest('[data-cid]');
      if (cid) { measCurSel = cid.dataset.cid; const s = $('#mCrvSel'); if (s) s.dataset.sig = ''; drawMeasCurves(true); return; }
      if (sw) { const k = sw.dataset.sw; if (k === 'prep') swPrepare(); else if (k === 'kick') { if (!S.sw || !S.sw.on) toast('Bereite zuerst den Versuch vor.'); else swKick(); } else if (k === 'up') swUp(); else if (k === 'auto') swAuto(); else if (k === 'find') swFind(); return; }
      if (!m) return; const k = m.dataset.m;
      if (k === 'prep') measPrepare(); else if (k === 'step') measStep(); else if (k === 'cmp') measCompare(); else if (k === 'acc-mine') measAccept('mine'); else if (k === 'acc-auto') measAccept('auto');
      else if (k === 'ksend') {
        const M2 = S.meas; if (!M2 || !M2.rec || !M2.rec.done) { toast('Die Aufzeichnung ist noch nicht fertig.'); return; } const R = M2.rec, n = R.t.length, kk = Math.max(3, Math.floor(n * 0.05)); let mm = 0; for (let j = n - kk; j < n; j++) mm += R.x[j]; mm /= kk;
        const ks = ((mm - R.x0) / span() * 100) / R.dy; const el = $('#mKs'); if (el) el.value = fnum(ks, 2);
      } else if (k === 'tune') setTab('tune'); else if (k === 'calc') setTab('calc');
      else if (k === 'clr') { if (await confirmSheet('Kennwerte löschen?', 'Die gespeicherten Kennwerte der Strecke werden gelöscht.', 'Löschen', true)) { S.strecke = null; S.dirty = true; saveCurSoon(); measUpdate(true); } }
    });
    V.addEventListener('input', e => { if (e.target.id === 'mTu' || e.target.id === 'mTg') { if (S.meas) { S.meas.syncFields = false; S.meas.cmp = null; } const a = parseNum($('#mTu').value), b = parseNum($('#mTg').value), rt = $('#mRatio'); if (rt) rt.textContent = fin(a) && fin(b) && a > 0 ? 'Tg/Tu = ' + fnum(b / a, 2) : 'Tg/Tu = –'; } });
  })();

  /* ============================================================ Tab Regler einstellen */
  const METHODS = [['zn-schwing', 'Ziegler-Nichols (Schwingversuch)', 'swing'], ['zn-sprung', 'Ziegler-Nichols (Sprungantwort)', 'step'], ['chr-fuehr-0', 'CHR Führung, aperiodisch', 'step'], ['chr-fuehr-20', 'CHR Führung, 20 % Überschwingen', 'step'],
    ['chr-stoer-0', 'CHR Störung, aperiodisch', 'step'], ['chr-stoer-20', 'CHR Störung, 20 % Überschwingen', 'step'], ['tsumme', 'T-Summe (Betragsoptimum)', 'tsum']];
  const methodName = id => { const C = CORE(), t = C && C.rules && C.rules.table, e = Array.isArray(t) ? t.find(x => x && x.id === id) : null; return (e && (e.name || e.title)) || (METHODS.find(m => m[0] === id) || [])[1] || id; };
  const TUNE = { method: 'zn-sprung', type: 'PI', vals: {} };
  const TFIELDS = { swing: [['Kkrit', 'Kkrit', ''], ['Tkrit', 'Tkrit', 'T']], step: [['Ks', 'Ks', ''], ['Tu', 'Tu', 'T'], ['Tg', 'Tg', 'T']], tsum: [['Ks', 'Ks', ''], ['T1', 'T1 (größte Zeitkonstante)', 'T'], ['TsumKlein', 'TΣk (Summe der kleinen Zeitkonstanten und Totzeit)', 'T'], ['T2', 'T2 (nur für PID: zweitgrößte Zeitkonstante, Tv = T2; im PID-Kp steht TΣk′ = TΣk − T2)', 'T'], ['Tu', 'oder Tu aus der Sprungantwort', 'T'], ['Tg', 'oder Tg aus der Sprungantwort', 'T']] };
  const strOf = () => (S.strecke && S.strecke.rig === S.rigId ? S.strecke : null);
  function tuneFieldsHtml() {
    const kind = (METHODS.find(m => m[0] === TUNE.method) || [])[2] || 'step', s = strOf();
    return TFIELDS[kind].map(([k, label, u]) => {
      const auto = s && fin(s[k]) && TUNE.vals[k] == null; const v = TUNE.vals[k] != null ? TUNE.vals[k] : (s && fin(s[k]) ? (u === 'T' ? fnum(toU(s[k]), adig(toU(s[k]))) : fnum(s[k], adig(s[k]))) : '');
      return `<label class="f${auto ? ' auto' : ''}"><span>${esc(label)}${u === 'T' ? ' in ' + esc(TU()) : ''}${auto ? ' · aus „Strecke messen“' : ''}</span><input data-tk="${k}" inputmode="decimal" autocomplete="off" value="${esc(v)}"></label>`;
    }).join('');
  }
  function tuneKennwerte() {
    const kind = (METHODS.find(m => m[0] === TUNE.method) || [])[2] || 'step', s = strOf(), k = {};
    TFIELDS[kind].forEach(([key, , u]) => { let raw = TUNE.vals[key]; let v = raw != null ? parseNum(raw) : (s && fin(s[key]) ? (u === 'T' ? toU(s[key]) : s[key]) : NaN); if (raw === '') v = NaN; if (fin(v)) k[key] = u === 'T' ? fromU(v) : v; });
    return k;
  }
  function tuneResult() {
    const C = CORE(); if (!C || !C.rules || typeof C.rules.apply !== 'function') return { ok: false, why: 'Die Einstellregeln sind nicht geladen (regcore.js fehlt).' };
    const k = tuneKennwerte(); let r; try { r = C.rules.apply(TUNE.method, k, TUNE.type); } catch (e) { r = { ok: false, why: 'Die Berechnung ist fehlgeschlagen: ' + (e && e.message || e) }; }
    let warn = []; try { const v = C.rules.validity ? C.rules.validity(TUNE.method, k) : null; warn = Array.isArray(v) ? v : (v && v.warn) || []; } catch (e) { warn = []; }
    return { r, k, warn };
  }
  function tuneHelpHtml() {
    const T = tuneResult(), r = T.r || T, kind = (METHODS.find(m => m[0] === TUNE.method) || [])[2], s = strOf();
    const types = ['P', 'PI', 'PID'];
    let h = `<div class="frm"><label class="f"><span>Methode</span><select id="tMeth">${METHODS.map(m => `<option value="${m[0]}"${m[0] === TUNE.method ? ' selected' : ''}>${esc(methodName(m[0]))}</option>`).join('')}</select></label>
      <div class="f"><span>Reglerart</span><div class="seg" id="tType">${types.map(t => `<button data-ty="${t}" class="${t === TUNE.type ? 'on' : ''}">${t}</button>`).join('')}</div></div></div>
      <div class="frm" id="tFields">${tuneFieldsHtml()}</div>`;
    h += s ? '<p class="hint2" style="margin:0 0 6px"><span class="auto-key"></span> gelb = aus „Strecke messen“ übernommen. Du kannst jeden Wert überschreiben.</p>' : '<p class="hint2" style="margin:0 0 6px">Trage die Kennwerte ein oder miss sie im Tab „Strecke messen“ (dann stehen sie hier gelb vorbelegt).</p>';
    const k = T.k || {}; if (kind === 'step' && fin(k.Tu) && fin(k.Tg) && k.Tg > 0) h += `<div class="readout">Tu/Tg = ${fnum(k.Tu / k.Tg, 2)}${s && s.urteil ? ' · ' + esc(s.urteil) : ''}</div>`;
    if (r.ok === false) h += `<div class="res"><p class="hint2" style="margin:0;color:var(--warn)">${esc(r.why || 'Mit diesen Werten gibt es keinen Vorschlag.')}</p></div>`;
    else if (r.ok) {
      const tv = v => (v == null ? 'kein I-Anteil' : tstr(v) + (TU() !== 's' ? ' (' + fnum(v, adig(v)) + ' s)' : ''));
      const tvv = v => (v == null || !(v > 0) ? 'kein D-Anteil' : tstr(v) + (TU() !== 's' ? ' (' + fnum(v, adig(v)) + ' s)' : ''));
      h += `<div class="res"><div class="big2">Kp = ${fnum(r.Kp, adig(r.Kp))}</div><div class="kvs"><span>Proportionalbereich Xp</span><b>${fin(r.Xp) ? fnum(r.Xp, adig(r.Xp)) + ' %' : '–'}</b></div><div class="kvs"><span>Nachstellzeit Tn</span><b>${tv(r.Tn)}</b></div><div class="kvs"><span>Vorhaltzeit Tv</span><b>${tvv(r.Tv)}</b></div>
        ${r.limited ? '<p class="hint2" style="color:var(--warn)">Kp wurde begrenzt (siehe Warnung).</p>' : ''}${[].concat(r.warn || [], T.warn || []).filter((w, i, a) => a.indexOf(w) === i).map(w => `<p class="hint2" style="color:var(--warn);margin:4px 0">${esc(w)}</p>`).join('')}
        <details><summary class="lnk">Rechenweg</summary><ol>${(r.steps || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol><p class="hint2">Der Rechenweg steht in Prozess-Sekunden.</p></details>
        <div class="btns"><button class="btn pri" data-tn="apply">Übernehmen</button></div></div>`;
    }
    return h;
  }
  function renderTuneHelp() { const el = $('#tHelp'); if (!el) return; const a = document.activeElement; if (a && el.contains(a) && a.tagName === 'INPUT') return; el.innerHTML = tuneHelpHtml(); }
  function tuneApply() {
    if (!S.rig) return; const T = tuneResult(), r = T.r; if (!r || !r.ok) { toast('Mit diesen Werten gibt es keinen Vorschlag.'); return; }
    const want = { ctrl: TUNE.type, kp: r.Kp }; const notes = [];
    if (hasCtl('mode')) want.mode = 'auto';
    if (r.Tn != null && hasCtl('tn')) want.tn = r.Tn; if (hasCtl('tv')) want.tv = r.Tv != null && r.Tv > 0 ? r.Tv : 0;
    if (!coerceable('ctrl', TUNE.type)) { toast('Die Reglerart ' + TUNE.type + ' gibt es an dieser Anlage nicht.'); return; }
    applyCtl(want); S.dirty = true; saveCurSoon(); stat('regtune', 1, 'max'); S.tuned = true; readState(); syncCtl(true);
    [['kp', 'Kp', r.Kp, ''], ['tn', 'Tn', r.Tn, 'T'], ['tv', 'Tv', r.Tv, 'T']].forEach(([key, nm, want2, u]) => { if (want2 == null || !hasCtl(key)) return; if (key === 'tv' && !(want2 > 0)) return; let got = NaN; try { got = +S.rig.getControl(key); } catch (e) {} if (fin(got) && Math.abs(got - want2) > 0.01 * Math.abs(want2)) notes.push(nm + ' liegt außerhalb des Bedienbereichs: gesetzt wurde ' + (u === 'T' ? tstr(got) : fnum(got, adig(got))) + ' statt ' + (u === 'T' ? tstr(want2) : fnum(want2, adig(want2))) + '.'); });
    toast('Übernommen: ' + TUNE.type + ', Kp = ' + fnum(+S.rig.getControl('kp'), adig(+S.rig.getControl('kp'))) + (notes.length ? '. ' + notes.join(' ') : '. Teste den Regler mit „Sollwert +10 %“.'));
  }
  const coerceable = (k, v) => coerce(ctlDef(k), v) !== undefined;
  /* Sollwert- und Störsprung: Schrittgröße steht in der Meldung */
  function wStep(sign) {
    if (!S.rig || !hasCtl('w')) return; const c = ctlDef('w'), cur = +S.rig.getControl('w'), nv = clamp(cur + 0.1 * span() * sign, c.min, c.max);
    if (Math.abs(nv - cur) < 1e-9) { toast('Der Sollwert steht schon am Ende des Bedienbereichs (' + physStr(cur) + ').'); return; }
    setCtl('w', nv); toast('Sollwert w: ' + physStr(cur) + ' → ' + physStr(nv) + ' (Sprung ' + (nv >= cur ? '+' : '−') + physStr(Math.abs(nv - cur)) + '; 10 % des Messbereichs sind ' + physStr(0.1 * span()) + ')');
  }
  const zOnVal = () => { const c = ctlDef('z'); if (!c) return null; const off = fin(+c.value) ? +c.value : 0, up = c.max - off, down = off - c.min, tgt = up > down ? c.max : c.min; return +(off + 0.6 * (tgt - off)).toPrecision(6); };
  function zToggle() {
    if (!S.rig || !hasCtl('z')) return; const c = ctlDef('z'), off = fin(+c.value) ? +c.value : 0, cur = +S.rig.getControl('z'), on = Math.abs(cur - off) < 1e-9, nv = on ? zOnVal() : off;
    setCtl('z', nv); toast('Störgröße z: ' + fauto(cur) + ' → ' + fauto(nv) + (c.unit ? ' ' + c.unit : '') + (on ? ' (Störung an)' : ' (Störung aus)'));
  }
  function renderTuneMetrics() {
    const el = $('#tMet'); if (!el) return; const J = S.jump; let h;
    if (!J) h = '<p class="hint2" style="margin:0">Noch kein Sprung. Springt der Sollwert um mindestens 2 % des Messbereichs (oder die Störgröße), erscheinen hier die Kenngrößen. Tippe auf „Sollwert +10 %“ oder „Störung an“.</p>';
    else if (!J.done) h = `<p class="hint2" style="margin:0">${J.kind === 'w' ? 'Sollwertsprung' : 'Störgrößensprung'} bei ${tstr(J.t0)} Prozesszeit. Die Auswertung kommt, wenn die Aufzeichnung lang genug ist. Oder tippe auf „Jetzt auswerten“.</p>`;
    else h = metricsHtml(J.kind, J.res, J);
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  }
  /* ---- Stabilität (Vertiefung): Ampel, Bode, Ortskurve; alles aus rig.analysis() und dem Kern ---- */
  let stabLast = 0;
  function renderStab(force) {
    const d = $('#tStab'); if (!d || !d.open || !S.rig) return; const now = performance.now(); if (!force && now - stabLast < 500) return; stabLast = now;
    const C = CORE(), box = $('#tStabBox'); let an = null; try { an = typeof S.rig.analysis === 'function' ? S.rig.analysis() : null; } catch (e) { an = null; }
    const tlight = (S.osc && S.osc.cls) || 'aperiodisch', st = S.st || {}, sw2 = /^(2P|3P)$/.test(st.ctrl);
    const lamp = (cls, txt) => `<span class="amp ${cls}">${esc(txt)}</span>`;
    const timeCls = sw2 ? 'warnc' : tlight === 'dauerschwingung' || tlight === 'aufschaukelnd' ? 'bad' : tlight === 'gedaempft' ? 'ok' : 'ok';
    let h = `<div class="kvs"><span>Zeitbereich (Messschreiber)</span>${lamp(timeCls, sw2 ? 'Schaltregler: Schaltspiel' : OSCTXT[tlight] || tlight)}</div>`;
    const mg = an && an.ok !== false ? an.margins || an : null;
    if (!an || an.ok === false || !mg) h += `<p class="hint2" style="margin:6px 0">${esc((an && an.why) || (sw2 ? 'Für Schaltregler gibt es keinen Frequenzgang.' : 'Für diese Einstellung gibt es keinen Frequenzgang.'))}</p>`;
    else {
      const fcls = mg.valid === false ? 'warnc' : mg.stable ? 'ok' : 'bad';
      h += `<div class="kvs"><span>Frequenzbereich (Reserven)</span>${lamp(fcls, mg.valid === false ? 'Kriterium gilt hier nicht' : mg.stable ? 'stabil' : 'instabil')}</div>
        <table class="kt"><tr><td>Kreisverstärkung V0</td><td><b>${fin(mg.V0 != null ? mg.V0 : an.V0) ? fnum(mg.V0 != null ? mg.V0 : an.V0, 2) : '–'}</b></td></tr><tr><td>Phasenreserve φR</td><td><b>${fin(mg.phiR) ? fnum(mg.phiR, 1) + ' °' : 'kein Durchtritt'}</b></td></tr><tr><td>Amplitudenreserve AR</td><td><b>${fin(mg.AR) ? fnum(mg.AR, 1) + ' dB' : 'unendlich'}</b></td></tr></table>${mg.note ? `<p class="hint2">${esc(mg.note)}</p>` : ''}${an.linearised ? '<p class="hint2">Linearisiert im Arbeitspunkt.</p>' : ''}
        <div class="chartbox"><canvas id="bodeM" aria-label="Bode-Diagramm Betrag"></canvas></div><div class="chartbox lane"><canvas id="bodeP" aria-label="Bode-Diagramm Phase"></canvas></div><div class="chartbox sq"><canvas id="nyq" aria-label="Ortskurve des offenen Kreises"></canvas></div>`;
    }
    if (box.dataset.h !== h) { box.dataset.h = h; box.innerHTML = h; }
    if (mg && C && typeof C.bode === 'function' && $('#bodeM')) {
      let b = null; try { b = C.bode(an.blocks, {}); } catch (e) { b = null; }
      if (b && Array.isArray(b.w)) {
        const lx = b.w.map(w => Math.log10(w)), mk = b.marks || {}, vl = []; if (fin(mk.wD)) vl.push({ x: Math.log10(mk.wD), color: '#ffb340', label: 'ωD' }); if (fin(mk.wPi)) vl.push({ x: Math.log10(mk.wPi), color: '#4cd964', label: 'ωπ' });
        const dec = []; for (let k = Math.ceil(lx[0]); k <= Math.floor(lx[lx.length - 1]); k++) dec.push(k);
        drawChart($('#bodeM'), { series: [{ name: 'Betrag', color: '#3b9eff', pts: lx.map((x, i) => [x, b.magDb[i]]) }], hlines: [{ y: 0, color: 'rgba(232,236,240,.6)', dash: [4, 3], label: '0 dB' }], vlines: vl, noX: true, yLabel: 'Betrag in dB', xTicks: dec, xFmt: v => fnum(Math.pow(10, v), v < 0 ? -v : 0) });
        drawChart($('#bodeP'), { series: [{ name: 'Phase', color: '#ff8a7a', pts: lx.map((x, i) => [x, b.phaseDeg[i]]) }], hlines: [{ y: -180, color: 'rgba(232,236,240,.6)', dash: [4, 3], label: '−180°' }], vlines: vl, xLabel: 'ω in rad/s (Prozesszeit)', yLabel: 'Phase in °', xTicks: dec, xFmt: v => fnum(Math.pow(10, v), v < 0 ? -v : 0) });
        if (!S.bodeSeen) { S.bodeSeen = true; stat('regbode', 1, 'max'); }
      }
    }
    if (mg && C && typeof C.nyquist === 'function' && $('#nyq')) {
      let n = null; try { n = C.nyquist(an.blocks, {}); } catch (e) { n = null; }
      if (n && Array.isArray(n.pts)) { const pts = n.pts.filter(p => fin(p[0]) && fin(p[1])); drawChart($('#nyq'), { series: [{ name: 'L(jω)', color: '#c77dff', pts }], points: [{ x: -1, y: 0, color: '#ff5c5c', r: 5 }], xMin: -3, xMax: 2, yMin: -2.5, yMax: 2.5, zeroLine: true, xLabel: 'Re   (roter Punkt: −1 | 0)', yLabel: 'Im' }); }
    }
  }
  function renderTune() {
    const V = $('#tuneView');
    if (!S.rig) { V.innerHTML = '<div class="card pl">' + placeholderHtml() + '</div>'; return; }
    V.innerHTML = `<div class="card pl"><h4>Regler</h4><div id="tuneCtl"></div></div>
      <div class="card pl"><h4>Messschreiber und Sprünge</h4>${scopeBoxHtml('scopeT')}
        <div class="btns"><button class="btn" data-tw="up">Sollwert +10 %</button><button class="btn" data-tw="dn">Sollwert −10 %</button><button class="btn" data-tw="z">Störung an/aus</button></div>
        <p class="hint2" style="margin:6px 0 0">Ein Sprung ist 10 % des Messbereichs. Die genaue Größe steht nach jedem Tippen in der Meldung.</p></div>
      <div class="card pl"><h4>Kenngrößen des letzten Sprungs</h4><div id="tMet"></div><div class="btns"><button class="btn" data-tw="eval">Jetzt auswerten</button><button class="btn" data-tw="keep">Lauf merken</button><button class="btn danger" data-tw="unkeep">Gemerkten Lauf löschen</button></div></div>
      <div class="card pl"><h4>Einstellhilfe</h4><div id="tHelp"></div></div>
      <details class="card" id="tStab"><summary>Stabilität (Vertiefung)</summary><div class="cb" style="padding:6px 12px 12px"><p class="hint2" style="margin:0 0 6px">Warum schwingt ein Regelkreis? Hier siehst du den Frequenzgang des offenen Kreises: Bode-Diagramm und Ortskurve. Das ist Vertiefung und gehört nicht zum Pflichtstoff.</p><div id="tStabBox"></div></div></details>`;
    buildPanel($('#tuneCtl'), ['ctrl', 'kp', 'tn', 'tv', 'aw', 'dir', 'ta', 'hyst', 'dead'], 'Regler'); wireScope($('#scopeT'));
    renderTuneMetrics(); $('#tHelp').innerHTML = tuneHelpHtml(); $('#tStab').addEventListener('toggle', () => renderStab(true)); drawScopes();
  }
  (function () {
    const V = $('#tuneView');
    V.addEventListener('click', e => {
      const t = e.target.closest('[data-tw]'), ty = e.target.closest('[data-ty]'), ap = e.target.closest('[data-tn]');
      if (ty) { TUNE.type = ty.dataset.ty; renderTuneHelp(); return; }
      if (ap) { tuneApply(); return; }
      if (!t) return; const k = t.dataset.tw;
      if (k === 'up') wStep(1); else if (k === 'dn') wStep(-1); else if (k === 'z') zToggle();
      else if (k === 'eval') { if (!S.jump) toast('Es gibt noch keinen Sprung zum Auswerten.'); else { evalJump(true); renderTuneMetrics(); } }
      else if (k === 'keep') {
        const J = S.jump; if (!J || J.kind !== 'w') { toast('Es gibt noch keinen Sollwertsprung zum Merken.'); return; } if (!J.done) evalJump(true);
        S.ghost = { t: (J.t || []).map(v => v - J.t0), x: (J.x || []).slice(), w1: J.w1 }; toast('Lauf gemerkt: Er erscheint blass hinter dem nächsten Sollwertsprung.'); drawScopes();
      } else if (k === 'unkeep') { S.ghost = null; toast('Gemerkter Lauf gelöscht.'); drawScopes(); }
    });
    V.addEventListener('change', e => { if (e.target.id === 'tMeth') { TUNE.method = e.target.value; TUNE.vals = {}; if (!['P', 'PI', 'PID'].includes(TUNE.type)) TUNE.type = 'PI'; if (TUNE.method === 'tsumme' && TUNE.type === 'P') TUNE.type = 'PI'; renderTuneHelp(); } });
    V.addEventListener('input', e => { const i = e.target.closest('[data-tk]'); if (!i) return; TUNE.vals[i.dataset.tk] = i.value; i.closest('label').classList.remove('auto'); clearTimeout(V._t); V._t = setTimeout(() => { const el = $('#tHelp'); if (el) { const act = i.dataset.tk; el.innerHTML = tuneHelpHtml(); const n = $('[data-tk="' + act + '"]', el); if (n) { n.focus(); try { n.setSelectionRange(n.value.length, n.value.length); } catch (x) {} } } }, 450); });
  })();

  /* ============================================================ Ablaufprogramm */
  let seqIdx = -1, lastSeqUI = 0;
  const rowEnd = r => (+r.t || 0) + (r.kind === 'ramp' ? (+r.dur || 0) : 0);
  const seqDur = () => { const d = S.seqDur && S.seqDur[S.rigId]; if (fin(d) && d > 0) return d; const rs = curRows(); return Math.max(defSpan() * 0.5, rs.reduce((m, r) => Math.max(m, rowEnd(r)), 0) * 1.3, 20 * rigH()); };
  const defVal = c => (c.type === 'switch' || c.type === 'button' ? !!c.value : c.type === 'select' ? ((c.value !== undefined ? c.value : (c.options && c.options[0] ? c.options[0].value : ''))) : (c.value != null ? c.value : c.min));
  function newRow() {
    const rs = curRows(), c = ctlDef('w') || ctlsOf()[0]; if (!c) return null;
    const last = rs.length ? rs[rs.length - 1] : null, t = last ? +(rowEnd(last) + defSpan() / 20).toPrecision(6) : 0;
    return { t, kind: 'set', key: c.key, value: defVal(c) };
  }
  /* Zeilen → Läufer-Format (Prozess-Sekunden): { t, set:{key:Wert} } und { t, ramp:{key,to,durS} } */
  function seqSteps(rows) {
    const m = new Map(), ramps = [];
    (rows || []).forEach(r => {
      const c = ctlDef(r.key); if (!c) return; const t = Math.round(Math.max(0, +r.t || 0) * 1e6) / 1e6;
      if (r.kind === 'ramp') { const to = coerce(c, r.to != null ? r.to : r.value); if (to !== undefined && c.type === 'slider') ramps.push({ t, ramp: { key: r.key, to, durS: Math.max(1e-6, +r.dur || 0) } }); return; }
      if (!m.has(t)) m.set(t, {}); m.get(t)[r.key] = r.value;
    });
    return [...m.entries()].map(([t, set]) => ({ t, set })).concat(ramps).sort((a, b) => a.t - b.t);
  }
  /* Läufer-Format → Zeilen (Umkehrung von seqSteps; Rampen und Setzen bleiben getrennt) */
  function seqToRows(seq) {
    const rows = []; if (!Array.isArray(seq)) return rows;
    seq.forEach(s => {
      if (!s) return;
      if (s.ramp && typeof s.ramp === 'object' && s.ramp.key != null) rows.push({ t: +s.t || 0, kind: 'ramp', key: s.ramp.key, to: +s.ramp.to, dur: +s.ramp.durS || 0 });
      if (s.set && typeof s.set === 'object') Object.keys(s.set).forEach(k => rows.push({ t: +s.t || 0, kind: 'set', key: k, value: s.set[k] }));
      else if (s.key != null) rows.push({ t: +s.t || 0, kind: 'set', key: s.key, value: s.value });
    });
    return rows;
  }
  const rowNorm = rows => (rows || []).map(r => (r.kind === 'ramp' ? { t: +r.t || 0, kind: 'ramp', key: r.key, to: +r.to, dur: +r.dur || 0 } : { t: +r.t || 0, kind: 'set', key: r.key, value: r.value }));
  function valueEd(r, i) {
    const c = ctlDef(r.key); if (!c) return '<span class="hint2">Steuerwert unbekannt</span>';
    const v = r.kind === 'ramp' ? r.to : r.value;
    if (c.type === 'slider') { const sh = isTime(c) ? fnum(toU(v), adig(toU(v))) : fnum(v, c.scale === 'log' ? adig(v) : decs(c.step)); return `<span class="vv"><input class="vIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${sh}" aria-label="Wert"><small>${esc(ctlUnit(c))}</small></span>`; }
    if (c.type === 'switch') return `<select class="vSel" data-i="${i}" aria-label="Wert"><option value="1"${r.value ? ' selected' : ''}>EIN</option><option value="0"${r.value ? '' : ' selected'}>AUS</option></select>`;
    if (c.type === 'button') return `<select class="vSel" data-i="${i}" aria-label="Wert"><option value="1"${r.value ? ' selected' : ''}>gedrückt</option><option value="0"${r.value ? '' : ' selected'}>losgelassen</option></select>`;
    const o = c.options || [], cur = o.findIndex(x => x.value === r.value || String(x.value) === String(r.value));
    return `<select class="vSel" data-i="${i}" aria-label="Wert">${o.map((x, j) => `<option value="${j}"${j === cur ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`;
  }
  function rowHtml(r, i, n) {
    const keys = ctlsOf(), c = ctlDef(r.key), canRamp = c && c.type === 'slider', ramp = r.kind === 'ramp';
    return `<div class="sqr" data-i="${i}"><span class="n">${i + 1}</span><label class="tb"><small>nach</small><input class="tIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${fnum(toU(r.t), adig(toU(r.t)))}" aria-label="Zeit in ${esc(TU())}"> <small>${esc(TU())}</small></label>
      <select class="kdSel" data-i="${i}" aria-label="Art"><option value="set"${ramp ? '' : ' selected'}>setze</option>${canRamp ? `<option value="ramp"${ramp ? ' selected' : ''}>Rampe auf</option>` : ''}</select>
      <select class="kSel" data-i="${i}" aria-label="Steuerwert">${keys.map(k => `<option value="${esc(k.key)}"${k.key === r.key ? ' selected' : ''}>${esc(k.label)}${ctlUnit(k) ? ' (' + esc(ctlUnit(k)) + ')' : ''}</option>`).join('')}</select>
      <span class="vb">${valueEd(r, i)}</span>${ramp ? `<label class="tb"><small>in</small><input class="dIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${fnum(toU(r.dur), adig(toU(r.dur) || 1))}" aria-label="Dauer der Rampe in ${esc(TU())}"> <small>${esc(TU())}</small></label>` : ''}
      <span class="ac"><button class="ib2" data-a="up" data-i="${i}" aria-label="Nach oben"${i === 0 ? ' disabled' : ''}>↑</button><button class="ib2" data-a="dn" data-i="${i}" aria-label="Nach unten"${i === n - 1 ? ' disabled' : ''}>↓</button><button class="ib2" data-a="del" data-i="${i}" aria-label="Löschen">🗑</button></span></div>`;
  }
  function tlHtml() {
    const end = seqDur(), st = seqSteps(curRows()); let h = '<div id="tl">';
    st.forEach(s => { const p = Math.min(100, s.t / end * 100); h += `<i class="tk" style="left:${p.toFixed(2)}%"></i>`; });
    for (let k = 0; k <= 4; k++) h += `<span class="sc" style="left:${k * 25}%;${k === 4 ? 'transform:translateX(-100%)' : ''}">${fnum(toU(end * k / 4), adig(toU(end * k / 4)))} ${esc(TU())}</span>`;
    return h + '<b class="hd" id="tlHd" style="left:0%"></b></div>';
  }
  function renderSeq() {
    const V = $('#seqView');
    if (!S.rig) { V.innerHTML = '<div class="card pl">' + placeholderHtml() + '</div>'; return; }
    const rs = curRows();
    V.innerHTML = `<div class="card pl"><h4>Ablaufprogramm für ${rigIcon(S.rigId)} ${esc(rigName(S.rigId))}</h4>
      <p class="hint2" style="margin:0 0 8px">Jede Zeile heißt: <b>nach … ${esc(TU())}</b> (Prozesszeit) wird ein Steuerwert gesetzt oder in einer Rampe verändert. So baust du Sollwertsprünge, Störungen, eine Nachtabsenkung oder das Umschalten von Hand auf Automatik, ohne selbst zu drücken.</p>
      <div class="chips"><button class="chip s on" data-q="add">➕ Zeile</button><button class="chip s" data-q="ex">📖 Beispiel-Ablauf</button><button class="chip s danger" data-q="clr"${rs.length ? '' : ' disabled'}>🗑 Leeren</button></div>
      <div id="sqRows">${rs.length ? rs.map((r, i) => rowHtml(r, i, rs.length)).join('') : '<p class="hint2" style="padding:8px 4px">Noch keine Zeilen. Tippe auf „Zeile“ oder lade ein Beispiel.</p>'}</div>
      <div class="frm" style="margin-top:10px"><label class="f"><span>Dauer des Ablaufs in ${esc(TU())}</span><input id="sqDur" inputmode="decimal" autocomplete="off" value="${fnum(toU(seqDur()), adig(toU(seqDur())))}"></label><label class="chk"><input type="checkbox" id="sqCur"${S.seqCur === false ? '' : ' checked'}> mit den aktuellen Steuerwerten des Prüfstands starten</label></div>
      <div id="tlHost">${tlHtml()}</div><div class="readout" id="sqLiveRead"></div>
      <div class="btns"><button class="btn pri" data-q="bg"${rs.length ? '' : ' disabled'}>▶ Berechnen (Diagramm)</button><button class="btn" data-q="live"${rs.length ? '' : ' disabled'}>▶ Live im Prüfstand</button><button class="btn danger" data-q="stop">■ Stopp</button></div></div>
      <div id="sqRes"></div>`;
    renderSeqRes(); renderSeqLive();
  }
  /* Ablaufprogramm im Hintergrund: REG_CORE.runSeq (Prozess-Sekunden), sonst Hinweis */
  function seqRunBg() {
    if (!S.rig) return; const steps = seqSteps(curRows()), end = seqDur(), id = S.rigId, d = defOf(id), C = CORE();
    if (!steps.length) { toast('Das Ablaufprogramm ist leer.'); return; }
    if (!C || typeof C.runSeq !== 'function') { toast('Der Läufer ist nicht geladen (regcore.js fehlt).'); return; }
    toast('Berechne den Ablauf …');
    setTimeout(() => {
      const o = { seed: 1 }; if (S.seqCur !== false) o.controls = allCtl(); if (S.op) o.op = clone(S.op);
      const factory = () => d.create({ seed: 1 }); let res = null;
      try { res = C.runSeq(factory, steps, end, o); } catch (e) { console.error('runSeq:', e); res = null; }
      const fin2 = r => {
        if (!r || !Array.isArray(r.samples) || !r.samples.length) { toast('Der Ablauf konnte nicht berechnet werden.'); return; }
        S.seqPrev = S.seqRes && S.seqRes.rigId === id ? S.seqRes : S.seqPrev; S.seqRes = { samples: r.samples, final: r.final, events: r.events || [], faults: r.faults || [], errors: r.errors || [], metrics: r.metrics || null, end, rigId: id, steps, meters: metersOf(), range: clone(rng()), tUnit: TU() }; seqIdx = r.samples.length - 1;
        stat('regseq', 1, 'max'); renderSeqRes(); const el = $('#sqRes'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      if (res && typeof res.then === 'function') res.then(fin2, () => fin2(null)); else fin2(res);
    }, 30);
  }
  function seqLive() {
    if (!S.rig) return; const steps = seqSteps(curRows());
    if (!steps.length) { toast('Das Ablaufprogramm ist leer.'); return; }
    const keep = S.seqCur !== false ? allCtl() : null, op = S.op ? clone(S.op) : null;
    resetRig(true); if (keep) applyCtl(keep); if (op && S.rig.setOperatingPoint) { try { S.rig.setOperatingPoint(op.y); if (op.z != null) applyCtl({ z: op.z }); S.op = op; } catch (e) {} }
    readState(); sample(); S.live = { steps, i: 0, t: 0, end: seqDur(), ramps: [] }; setRun(true); renderSeqLive();
    toast('Ablauf läuft live. Im Tab „Prüfstand“ siehst du die Animation.');
  }
  function seqLiveDone() { S.live = null; stat('regseq', 1, 'max'); toast('Ablauf beendet'); renderSeqLive(); }
  function seqStop() { if (S.live) { S.live = null; S.running = false; updateChrome(); toast('Ablauf gestoppt'); renderSeqLive(); } else if (S.running) setRun(false); }
  function renderSeqLive() {
    if (S.tab !== 'seq') return; const hd = $('#tlHd'), rd = $('#sqLiveRead'); if (!hd) return; const end = seqDur();
    if (S.live) hd.style.left = Math.min(100, S.live.t / end * 100).toFixed(2) + '%';
    else if (S.seqRes && seqIdx >= 0 && S.seqRes.samples[seqIdx]) hd.style.left = Math.min(100, S.seqRes.samples[seqIdx].t / S.seqRes.end * 100).toFixed(2) + '%';
    else hd.style.left = '0%';
    const rows = $$('.sqr'); rows.forEach(r => r.classList.remove('cur'));
    if (S.live && S.rig) {
      const st = S.st || {}, txt = 'Live: Prozesszeit <b>' + tstr(S.live.t) + '</b> von ' + tstr(end) + ' · Sollwert w <b>' + physStr(st.w) + '</b> · Istwert x <b>' + physStr(st.x) + '</b> · y <b>' + fnum(st.y, 1) + ' %</b>';
      if (rd.dataset.h !== txt) { rd.dataset.h = txt; rd.innerHTML = txt; }
      const last = S.live.steps[Math.max(0, S.live.i - 1)]; if (last && S.live.i > 0) rows.forEach(r => { const row = curRows()[+r.dataset.i]; if (row && Math.abs((+row.t || 0) - last.t) < 1e-6) r.classList.add('cur'); });
    } else if (rd.dataset.h) { rd.dataset.h = ''; rd.innerHTML = ''; }
  }
  /* Ergebnis anzeigen: Diagramm w, x, y, z; Vergleich mit dem gemerkten Lauf; Kenngrößen aus result.metrics */
  function metricsHtml(kind, r, J, who) {
    if (!r || r.ok === false) return `<p class="hint2" style="margin:0;color:var(--warn)">${esc((r && r.why) || 'Keine Auswertung möglich.')}</p>`;
    const rg = who && who.range ? who.range : rng(), tu = who && who.tUnit ? who.tUnit : TU(), dv = TDIV[tu] || 1, ts = s => fnum(s / dv, adig(s / dv)) + ' ' + tu;
    if (kind === 'w') {
      const tz = (v, tx) => (v == null ? esc(tx || 'nicht erreicht') : ts(v)), ex = (a, b) => r[a] || r[b] || 'nicht ausgeregelt';
      return `<p class="hint2" style="margin:0 0 6px">Führungsverhalten: Sollwertsprung von ${esc(fnum(J.w0, rg.digits == null ? 1 : rg.digits))} auf ${esc(fnum(J.w1, rg.digits == null ? 1 : rg.digits))} ${esc(rg.unit || '')}.</p><table class="kt"><tr><th>Kenngröße</th><th>Wert</th></tr>
        <tr><td>Anregelzeit (erster Eintritt in ±2 %)</td><td><b>${tz(fin(r.tAn) ? r.tAn : null, 'nie im Band')}</b></td></tr>
        <tr><td>Ausregelzeit 2 %</td><td><b>${tz(fin(r.tAus2) ? r.tAus2 : null, ex('tAus2Text', 'tAus2Why'))}</b></td></tr>
        <tr><td>Ausregelzeit 5 %</td><td><b>${tz(fin(r.tAus5) ? r.tAus5 : null, ex('tAus5Text', 'tAus5Why'))}</b></td></tr>
        <tr><td>Überschwingweite</td><td><b>${fin(r.ueberPct) ? fnum(r.ueberPct, 1) + ' %' : '–'}</b></td></tr>
        <tr><td>Bleibende Regelabweichung</td><td><b>${fin(r.ebl) ? fnum(r.ebl, Math.max(2, rg.digits == null ? 2 : rg.digits)) + ' ' + esc(rg.unit || '') : '–'}${fin(r.eblPct) ? ' (' + fnum(r.eblPct, 1) + ' % des Sprungs)' : ''}</b></td></tr>
        <tr><td>Dämpfung</td><td><b>${esc(OSCTXT[clsName(r.cls)] || clsName(r.cls) || '–')}</b></td></tr></table>${r.warn ? `<p class="hint2" style="color:var(--warn)">${esc(r.warn)}</p>` : ''}`;
    }
    return `<p class="hint2" style="margin:0 0 6px">Störverhalten: Die Störgröße sprang von ${fauto(J.z0)} auf ${fauto(J.z1)}.</p><table class="kt"><tr><th>Kenngröße</th><th>Wert</th></tr>
      <tr><td>Größte Abweichung vom Sollwert</td><td><b>${fin(r.xdMax) ? fnum(r.xdMax, 2) + ' ' + esc(rg.unit || '') : '–'}</b></td></tr><tr><td>Zeit bis zur größten Abweichung</td><td><b>${fin(r.tMax) ? ts(r.tMax) : '–'}</b></td></tr>
      <tr><td>Ausregelzeit (±2 % des Bereichs)</td><td><b>${fin(r.tAus) ? ts(r.tAus) : esc(r.tAusText || 'nicht ausgeregelt')}</b></td></tr><tr><td>Bleibende Abweichung am Ende</td><td><b>${fin(r.eblStoer) ? fnum(r.eblStoer, 2) + ' ' + esc(rg.unit || '') : '–'}</b></td></tr></table>${r.warn ? `<p class="hint2" style="color:var(--warn)">${esc(r.warn)}</p>` : ''}`;
  }
  function renderSeqRes() {
    const el = $('#sqRes'); if (!el) return; const R = S.seqRes;
    if (!R || R.rigId !== S.rigId) { el.innerHTML = ''; return; }
    const faults = (R.faults || []).filter(f => !masked({ id: typeof f === 'string' ? f : f && f.id })).map(f => (typeof f === 'string' ? f : f && (f.text || f.msg || f.name)) || '').filter(Boolean), evs = (R.events || []).filter(e => !masked(e)).slice(-30), st0 = R.metrics && R.metrics.step;
    const first = R.samples[0], chg = st0 ? R.samples.find(s => Math.abs(s.w - first.w) >= 0.02 * (R.range.hi - R.range.lo)) : null, J = chg ? { w0: first.w, w1: chg.w } : null;
    el.innerHTML = `<div class="card pl"><h4>Ergebnis des Ablaufs</h4><div class="chartbox"><canvas id="sqCv" aria-label="Ergebnis: Sollwert und Istwert"></canvas></div><div class="chartbox lane"><canvas id="sqCv2" aria-label="Ergebnis: Stellgröße und Störgröße"></canvas></div>
      <label class="f" style="margin:8px 0 0"><span>Zeitleiste: Zeitpunkt auswählen</span><input type="range" id="sqScrub" min="0" max="${R.samples.length - 1}" step="1" value="${seqIdx}"></label><div class="readout" id="sqRead"></div>
      <div class="chips" style="margin-top:6px"><button class="chip s" data-q="keep">Lauf merken</button><button class="chip s" data-q="unkeep"${S.seqPrev ? '' : ' disabled'}>Gemerkten Lauf löschen</button><button class="chip s" data-q="csv">⬇ CSV</button></div>
      ${st0 && J ? `<div style="margin-top:8px">${metricsHtml('w', st0, J, R)}</div>` : '<p class="hint2" style="margin:8px 0 0">Kenngrößen gibt es, wenn der Sollwert im Ablauf um mindestens 2 % des Messbereichs springt.</p>'}
      ${R.errors && R.errors.length ? `<p style="color:var(--warn);margin:6px 0 0"><b>Hinweis zum Ablauf:</b> ${R.errors.map(esc).join(' ')}</p>` : ''}
      ${faults.length ? `<p style="color:var(--danger);margin:6px 0 0"><b>Fehler im Ablauf:</b> ${faults.map(esc).join('; ')}</p>` : '<p class="hint2" style="margin:6px 0 0">Keine Fehler im Ablauf.</p>'}
      ${evs.length ? `<ul class="ev" style="padding:0">${evs.map(x => `<li class="${esc(x.kind || 'info')}"><time>${fnum((x.t || 0) / (TDIV[R.tUnit] || 1), 1)} ${esc(R.tUnit)}</time><span>${esc(x.text)}</span></li>`).join('')}</ul>` : ''}</div>`;
    drawSeqChart();
  }
  function drawSeqChart() {
    const R = S.seqRes, cv = $('#sqCv'), cv2 = $('#sqCv2'); if (!R || !cv || R.rigId !== S.rigId) return; const dv = TDIV[R.tUnit] || 1;
    const px = k => R.samples.map(s => [s.t / dv, +s[k]]), ser = [];
    if (S.seqPrev && S.seqPrev.rigId === R.rigId && S.seqPrev !== R) ser.push({ name: 'gemerkt', color: '#9aa7b4', alpha: 0.5, pts: S.seqPrev.samples.map(s => [s.t / dv, +s.x]) });
    ser.push({ name: 'w', color: '#ffb340', dash: [6, 5], width: 1.8, pts: px('w') }, { name: 'x', color: '#3b9eff', width: 2.4, pts: px('x') });
    const cur = R.samples[seqIdx], cx = cur ? cur.t / dv : null, vl = R.steps.map(s => s.t / dv), xr = [0, R.end / dv];
    drawChart(cv, { series: ser, vlines: vl, xMin: xr[0], xMax: xr[1], noX: true, yLabel: R.range.unit || '', cursorX: cx });
    const z0 = (ctlDef('z') && fin(+ctlDef('z').value)) ? +ctlDef('z').value : 0, strips = []; let sx = null;
    R.samples.forEach((s, i) => { const on = Math.abs(s.z - z0) > 1e-9; if (on && sx == null) sx = s.t / dv; if ((!on || i === R.samples.length - 1) && sx != null) { strips.push({ x0: sx, x1: s.t / dv, color: 'rgba(255,92,92,.75)' }); sx = null; } });
    drawChart(cv2, { series: [{ name: 'y', color: '#4cd964', width: 2, pts: px('y') }], strips, vlines: vl, xMin: xr[0], xMax: xr[1], yMin: 0, yMax: 105, xLabel: 'Prozesszeit in ' + R.tUnit, yLabel: 'y in %', cursorX: cx });
    const rd = $('#sqRead'); if (rd && cur) rd.innerHTML = 't = <b>' + fnum(cur.t / dv, adig(cur.t / dv)) + ' ' + esc(R.tUnit) + '</b>: Sollwert w <b>' + fnum(cur.w, R.range.digits == null ? 1 : R.range.digits) + ' ' + esc(R.range.unit || '') + '</b> · Istwert x <b>' + fnum(cur.x, R.range.digits == null ? 1 : R.range.digits) + ' ' + esc(R.range.unit || '') + '</b> · y <b>' + fnum(cur.y, 1) + ' %</b> · z <b>' + fauto(cur.z) + '</b>';
    renderSeqLive();
  }
  function seqCsv() {
    const R = S.seqRes; if (!R) return ''; const head = ['Prozesszeit [s]', 'Sollwert w [' + (R.range.unit || '') + ']', 'Istwert x [' + (R.range.unit || '') + ']', 'Stellgröße y [%]', 'Störgröße z'].join(';');
    return head + '\r\n' + R.samples.map(s => [csvNum(s.t), csvNum(s.w), csvNum(s.x), csvNum(s.y), csvNum(s.z)].join(';')).join('\r\n') + '\r\n';
  }
  (function () {
    const V = $('#seqView');
    V.addEventListener('click', async e => {
      const q = e.target.closest('[data-q]'), a = e.target.closest('[data-a]'); const rs = curRows();
      if (q) {
        const k = q.dataset.q;
        if (k === 'add') { const r = newRow(); if (r) { rs.push(r); S.dirty = true; renderSeq(); saveCurSoon(); } }
        else if (k === 'clr') { if (await confirmSheet('Ablaufprogramm leeren?', 'Alle Zeilen werden gelöscht.', 'Leeren', true)) { rs.length = 0; S.seqRes = null; S.dirty = true; renderSeq(); saveCurSoon(); } }
        else if (k === 'ex') { const ex = seqExamples(); if (!ex.length) { toast('Für diesen Prüfstand gibt es noch keine Beispiel-Abläufe.'); return; } const v = await pick('Beispiel-Ablauf', ex.map((x, i) => ({ value: i, label: x.name, sub: x.desc || '' }))); if (v != null) loadExample(ex[v]); }
        else if (k === 'bg') seqRunBg(); else if (k === 'live') seqLive(); else if (k === 'stop') seqStop();
        else if (k === 'keep') { if (S.seqRes) { S.seqPrev = S.seqRes; toast('Lauf gemerkt: Er erscheint blass hinter dem nächsten Lauf.'); renderSeqRes(); } }
        else if (k === 'unkeep') { S.seqPrev = null; toast('Gemerkter Lauf gelöscht.'); renderSeqRes(); }
        else if (k === 'csv') { const txt = seqCsv(); if (!txt) return; const blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }); if (root.LabExport) root.LabExport.saveBlob(blob, root.LabExport.fname('csv')); else { const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = 'regelung-ablauf.csv'; document.body.appendChild(l); l.click(); l.remove(); } toast('CSV gespeichert'); }
      } else if (a) {
        const i = +a.dataset.i;
        if (a.dataset.a === 'del') rs.splice(i, 1); else if (a.dataset.a === 'up' && i > 0) [rs[i - 1], rs[i]] = [rs[i], rs[i - 1]]; else if (a.dataset.a === 'dn' && i < rs.length - 1) [rs[i + 1], rs[i]] = [rs[i], rs[i + 1]];
        S.dirty = true; renderSeq(); saveCurSoon();
      }
    });
    V.addEventListener('change', e => {
      const t = e.target, rs = curRows(), i = +t.dataset.i;
      if (t.id === 'sqCur') { S.seqCur = t.checked; return; }
      if (t.id === 'sqDur') { const v = fromU(parseNum(t.value)); S.seqDur[S.rigId] = fin(v) && v > 0 ? Math.min(7 * 86400, v) : null; t.value = fnum(toU(seqDur()), adig(toU(seqDur()))); $('#tlHost').innerHTML = tlHtml(); S.dirty = true; return; }
      if (!rs[i]) return; const r = rs[i];
      if (t.classList.contains('tIn')) { const v = fromU(parseNum(t.value)); r.t = fin(v) && v >= 0 ? +v.toPrecision(8) : r.t; t.value = fnum(toU(r.t), adig(toU(r.t))); $('#tlHost').innerHTML = tlHtml(); }
      else if (t.classList.contains('dIn')) { const v = fromU(parseNum(t.value)); r.dur = fin(v) && v >= 0 ? +v.toPrecision(8) : r.dur; t.value = fnum(toU(r.dur), adig(toU(r.dur) || 1)); }
      else if (t.classList.contains('kdSel')) { const c = ctlDef(r.key); if (t.value === 'ramp' && c) { r.kind = 'ramp'; r.to = fin(+r.value) ? +r.value : defVal(c); r.dur = r.dur || defSpan() / 20; delete r.value; } else { r.kind = 'set'; r.value = r.to != null ? r.to : defVal(c); delete r.to; delete r.dur; } renderSeq(); }
      else if (t.classList.contains('kSel')) { r.key = t.value; const c = ctlDef(t.value); if (r.kind === 'ramp' && !(c && c.type === 'slider')) { r.kind = 'set'; delete r.to; delete r.dur; } if (r.kind === 'ramp') r.to = c ? defVal(c) : 0; else r.value = c ? defVal(c) : 0; renderSeq(); }
      else if (t.classList.contains('vSel')) { const c = ctlDef(r.key); if (c) r.value = c.type === 'select' ? (c.options || [])[+t.value].value : t.value === '1'; }
      else if (t.classList.contains('vIn')) { const c = ctlDef(r.key); let v = parseNum(t.value); if (c && fin(v)) { if (isTime(c)) v = fromU(v); v = clamp(v, c.min, c.max); if (r.kind === 'ramp') r.to = v; else r.value = v; } const cur = r.kind === 'ramp' ? r.to : r.value; t.value = isTime(c) ? fnum(toU(cur), adig(toU(cur))) : fnum(cur, c && c.scale === 'log' ? adig(cur) : decs(c && c.step)); }
      S.dirty = true; saveCurSoon();
    });
    V.addEventListener('input', e => { if (e.target.id === 'sqScrub') { seqIdx = +e.target.value; drawSeqChart(); } });
    const pm = e => { const cv = e.target; if (!(cv.id === 'sqCv' || cv.id === 'sqCv2') || !S.seqRes) return; const x = cvX(cv, e); if (x == null) return; const dv = TDIV[S.seqRes.tUnit] || 1; let best = 0, bd = Infinity; S.seqRes.samples.forEach((s, i) => { const d = Math.abs(s.t / dv - x); if (d < bd) { bd = d; best = i; } }); seqIdx = best; const sc = $('#sqScrub'); if (sc) sc.value = best; drawSeqChart(); };
    V.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'mouse') pm(e); }); V.addEventListener('pointerdown', pm);
  })();

  /* ============================================================ Beispiele (REG_DATA.examples, eingebauter Rückfall) */
  const B = (id, name, cat, rig, desc, controls, extra) => Object.assign({ id, name, cat, rig, desc, controls }, extra || {});
  const BUILTIN = [
    B('bx-fuell', 'Füllstand: Sollwertsprung mit PI', 'Füllstand', 'fuellstand', 'Der Sollwert springt in der Mitte des Ablaufs. Beobachte, wie der PI-Regler den Füllstand nachführt.', { mode: 'auto', ctrl: 'PI' }, { dur: 300, op: { y: 25 }, seq: [{ t: 0, set: { mode: 'auto', w: 40 } }, { t: 60, set: { w: 60 } }] }),
    B('bx-wind', 'Füllstand: Windup-Test', 'Füllstand', 'fuellstand', 'Die Stellgröße ist begrenzt und der Anti-Windup ist aus. Vergleiche den Lauf mit eingeschaltetem Anti-Windup.', { mode: 'auto', ctrl: 'PI', ymax: 60, aw: 'aus' }, { dur: 400, op: { y: 20 }, seq: [{ t: 0, set: { w: 30 } }, { t: 30, set: { w: 80 } }] }),
    B('bx-fluss', 'Durchfluss: Vordruck-Einbruch', 'Durchfluss', 'durchfluss', 'Die Störgröße springt. Beobachte, wie der PI-Regler die Abweichung ausregelt.', { mode: 'auto', ctrl: 'PI' }, { dur: 60, op: { y: 40 }, seq: [{ t: 10, set: { z: -30 } }] }),
    B('bx-raum', 'Raumtemperatur: Nachtabsenkung', 'Raumtemperatur', 'raumtemp', 'Der Sollwert sinkt für die Nacht und steigt wieder. Die Zeit läuft hier in Prozess-Minuten.', { mode: 'auto', ctrl: 'PI' }, { dur: 43200, op: { y: 40 }, seq: [{ t: 0, set: { w: 20 } }, { t: 7200, set: { w: 17 } }, { t: 28800, set: { w: 20 } }] }),
    B('bx-drehz', 'Drehzahl: Lastsprung', 'Drehzahl', 'drehzahl', 'Die Last springt, die Drehzahl bricht kurz ein. Vergleiche P- und PI-Regler.', { mode: 'auto', ctrl: 'PI' }, { dur: 3, op: { y: 50 }, seq: [{ t: 1, set: { z: 50 } }] }),
    B('bx-hand', 'Drehzahl: Hand auf Automatik', 'Drehzahl', 'drehzahl', 'Der Prüfstand läuft von Hand und wird dann auf Automatik umgeschaltet. Achte auf die Stellgröße beim Umschalten.', { mode: 'hand', ctrl: 'PI', yHand: 40 }, { dur: 3, op: { y: 40 }, seq: [{ t: 1, set: { mode: 'auto' } }, { t: 1.5, set: { w: 1800 } }] }),
    B('bx-pos', 'Lage: Sprung mit PD', 'Position', 'position', 'Der Sollwert springt auf eine neue Position. Beobachte das Überschwingen.', { mode: 'auto', ctrl: 'PD' }, { dur: 6, op: { y: 50 }, seq: [{ t: 0, set: { w: 20 } }, { t: 1, set: { w: 60 } }] }),
    B('bx-bau', 'Baukasten: Sollwertsprung', 'Baukasten', 'baukasten', 'Ein Sollwertsprung an der frei wählbaren Strecke.', { mode: 'auto', ctrl: 'PI' }, { dur: 100, op: { y: 50 }, seq: [{ t: 0, set: { w: 40 } }, { t: 10, set: { w: 60 } }] }),
    B('bx-thermo', 'Thermostat: Zweipunktregler', 'Thermostat', 'thermostat', 'Ein Zweipunktregler schaltet die Heizung ein und aus. Beobachte das Schaltspiel im Messschreiber.', { ctrl: '2P' }, {})
  ];
  function exampleList() {
    const d = root.REG_DATA; let a = d && d.examples;
    if (a && !Array.isArray(a)) a = Object.keys(a).map(k => Object.assign({ id: k }, a[k]));
    if (!a || !a.length) a = BUILTIN;
    return a.map(e => ({ id: e.id, name: e.name, cat: e.cat || 'Beispiele', desc: e.desc || e.text || '', rig: e.rig, controls: e.controls || {}, dur: e.dur, op: e.op || null, rows: e.rows ? rowNorm(e.rows) : (e.seq ? seqToRows(e.seq) : null), seq: e.seq }));
  }
  const seqExamples = () => exampleList().filter(e => e.rows && e.rows.length && e.rig === S.rigId);
  function applyOp(op) {
    if (!op || !S.rig || typeof S.rig.setOperatingPoint !== 'function') return;
    try { S.rig.setOperatingPoint(+op.y); if (op.z != null) applyCtl({ z: op.z }); S.op = clone(op); readState(); sample(); } catch (e) { console.error(e); }
  }
  function loadExample(e) {
    if (typeof e === 'string') { const n = e.toLowerCase(); e = exampleList().find(x => x.id === e || x.name.toLowerCase().includes(n)); }
    if (!e) return false; const had = stash(); S.task = null;
    setRig(e.rig && ORDER.includes(e.rig) ? e.rig : S.rigId || ORDER[0]);
    applyCtl(e.controls); applyOp(e.op);
    S.rows[S.rigId] = e.rows ? clone(e.rows) : []; S.seqDur[S.rigId] = e.dur && e.dur > 0 ? e.dur : null; S.seqRes = null;
    S.name = e.name; S.id = null; S.dirty = false;
    setTab(e.rows && e.rows.length ? 'seq' : 'rig'); updateChrome(); saveCurSoon();
    toast(had ? 'Beispiel geladen, dein Versuch ist gesichert' : 'Beispiel geladen: ' + e.name);
    return true;
  }
  const loadExampleByName = n => loadExample(String(n || ''));
  function openExamples() {
    const ex = exampleList();
    sheet('Beispielversuche', (b, close) => {
      let last = '', h = '<p class="hint2" style="margin-top:0">Tippe ein Beispiel an: Prüfstand und Einstellungen werden geladen. Dein bisheriger Versuch wird vorher gesichert.</p>';
      ex.forEach((e, i) => { if (e.cat !== last) { last = e.cat; h += `<div class="gh">${esc(e.cat)}</div>`; } h += `<button class="row" data-i="${i}"><span style="font-size:22px;display:inline-block;width:32px;text-align:center;flex:none">${rigIcon(e.rig)}</span><div class="grow"><b>${esc(e.name)}</b><small>${esc(e.desc)}${e.rows && e.rows.length ? ' · mit Ablaufprogramm' : ''}</small></div></button>`; });
      b.innerHTML = h;
      b.addEventListener('click', ev => { const r = ev.target.closest('.row'); if (!r) return; close(); loadExample(ex[+r.dataset.i]); });
    });
  }

  /* ============================================================ Speichern, Öffnen, Teilen */
  const PK = 'reg.saves';
  const saves = () => { const a = lsGet(PK, []); return Array.isArray(a) ? a : []; };
  function saveItem(name) {
    const a = saves(), id = S.id || uid(); S.id = id; S.name = name || S.name;
    const e = { id, name: S.name, t: Date.now(), rig: S.rigId, ctl: allCtl(), rows: clone(curRows()), dur: seqDur(), strecke: S.strecke ? clone(S.strecke) : null, op: S.op ? clone(S.op) : null };
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
    S.task = null; setRig(ORDER.includes(it.rig) ? it.rig : ORDER[0]); if (it.op && fin(+it.op.y)) applyOp(it.op); applyCtl(it.ctl && typeof it.ctl === 'object' ? it.ctl : {});
    S.rows[S.rigId] = Array.isArray(it.rows) ? rowNorm(it.rows.filter(r => r && typeof r === 'object' && typeof r.key === 'string')) : []; S.seqDur[S.rigId] = fin(it.dur) && it.dur > 0 ? it.dur : null; S.seqRes = null;
    S.strecke = it.strecke && typeof it.strecke === 'object' ? it.strecke : S.strecke;
    S.name = (it.name || 'Versuch') + (suffix || ''); S.dirty = false; updateChrome(); saveCurSoon();
    setTab(['seq', 'meas', 'tune'].includes(S.tab) ? S.tab : 'rig'); if (S.tab === 'seq') renderSeq();
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
  const shareObj = () => ({ k: 'reg', name: S.name, rig: S.rigId, ctl: allCtl(), rows: curRows(), dur: seqDur(), strecke: S.strecke || null, op: S.op || null });
  async function shareNow() {
    if (!S.rig) { toast('Es gibt noch nichts zu teilen: der Prüfstand fehlt.'); return; }
    let url; try { url = location.href.split('#')[0].split('?')[0] + '#' + await packShare(shareObj()); } catch (e) { toast('Teilen nicht möglich'); return; }
    if (navigator.share) { try { await navigator.share({ title: 'Tonfunk Regelungstechnik-Lab: ' + S.name, text: 'Schau dir meinen Regelungs-Versuch „' + S.name + '“ an:', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    sheet('Teilen', b => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">Diesen Link weitergeben (zum Beispiel per WhatsApp oder E-Mail). Wer ihn öffnet, bekommt eine Kopie deines Versuchs mit Prüfstand, Einstellungen und Ablaufprogramm.</p><textarea id="shTx" rows="5" readonly></textarea><div class="btns"><button class="btn pri" id="shCp">Link kopieren</button></div>';
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
    x.fillStyle = '#14181c'; x.fillRect(0, 0, w, h); try { if (S.rig) S.rig.draw(x, w, h, 0); } catch (e) {} return c;
  }
  function exportPng() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    const c = rigPng(1600, 900);
    c.toBlob(b => { if (b && root.LabExport) { root.LabExport.saveBlob(b, root.LabExport.fname('png')); stat('png'); } else toast('Bild konnte nicht erzeugt werden'); }, 'image/png');
  }
  function printNow() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    const c = rigPng(1200, 675), who = lsRaw('lm4.name', ''), vals = allCtl(); let mv = {}; try { mv = S.rig.readMeters(); } catch (e) {}
    const cv = ctlsOf().map(x => { const v = vals[x.key]; let t = v; if (x.type === 'switch' || x.type === 'button') t = v ? 'EIN' : 'AUS'; else if (x.type === 'select') { const o = (x.options || []).find(q => q.value === v); t = o ? o.label : v; } else t = ctlShow(x, v) + (ctlUnit(x) ? ' ' + ctlUnit(x) : ''); return `<tr><td>${esc(x.group || '')}</td><td>${esc(x.label)}</td><td>${esc(t)}</td></tr>`; }).join('');
    const mt = metersOf().map(m => `<tr><td>${esc(m.label)}</td><td>${fnum(mv[m.key], m.digits == null ? 1 : m.digits)} ${esc(m.unit || '')}</td></tr>`).join('');
    const ev = ((S.rig.events) || []).filter(e => !masked(e)).slice(-15).map(e => `<tr><td>${esc(tstamp(e.t))}</td><td>${esc(e.text)}</td></tr>`).join('');
    const rows = curRows().map(r => { const d = ctlDef(r.key); return `<tr><td>${fnum(toU(r.t), adig(toU(r.t)))} ${esc(TU())}</td><td>${r.kind === 'ramp' ? 'Rampe auf' : 'setze'} ${esc(d ? d.label : r.key)}</td><td>${esc(r.kind === 'ramp' ? String(r.to) + ' in ' + fnum(toU(r.dur), adig(toU(r.dur) || 1)) + ' ' + TU() : typeof r.value === 'boolean' ? (r.value ? 'EIN' : 'AUS') : String(r.value))}</td></tr>`; }).join('');
    const kw = strOf() ? kwHtml() : '';
    $('#printArea').innerHTML = `<div class="proto"><h1>${esc(S.name)}</h1><p>Prüfstand: ${esc(rigName(S.rigId))} · ${new Date().toLocaleDateString('de-DE')}${who ? ' · ' + esc(who) : ''} · Zeiten in Prozesszeit (${esc(TU())})</p>
      <h2>Prüfstand</h2><img src="${c.toDataURL('image/png')}" alt="">
      <h2>Einstellungen</h2><table><tr><th>Gruppe</th><th>Steuerwert</th><th>Wert</th></tr>${cv}</table>
      <h2>Messwerte</h2><table><tr><th>Messgerät</th><th>Wert</th></tr>${mt}</table>
      ${kw ? `<h2>Kennwerte der Strecke</h2>${kw}` : ''}
      ${rows ? `<h2>Ablaufprogramm</h2><table><tr><th>Zeit</th><th>Aktion</th><th>Wert</th></tr>${rows}</table>` : ''}
      ${ev ? `<h2>Meldungen</h2><table><tr><th>Zeit</th><th>Meldung</th></tr>${ev}</table>` : ''}</div>`;
    setTimeout(() => window.print(), 80);
  }

  /* ============================================================ Aufgaben (REG_TASKS) */
  const TK = () => (root.REG_TASKS && Array.isArray(root.REG_TASKS.tasks) && root.REG_TASKS.tasks.length ? root.REG_TASKS.tasks : null);
  const taskDone = () => lsGet('sim.done', {});
  function markDone(id, pct) {
    try { const d = taskDone(); if ((d[id] || 0) < pct) d[id] = pct; localStorage.setItem('sim.done', JSON.stringify(d)); } catch (e) {}
    if (root.Badges) root.Badges.result(id, pct);
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
  /* Aufgabenzustand (start() und sol() liefern { rig?, controls?, op?, seq?: [{t(s), set|ramp}] | rows?, dur(s)? }) übernehmen */
  function applyTaskState(t, o) {
    o = o || {}; const rid = o.rig || t.rig || S.rigId;
    setRig(ORDER.includes(rid) ? rid : S.rigId); applyCtl(o.controls || o.ctl); applyOp(o.op);
    S.rows[S.rigId] = o.rows ? rowNorm(o.rows) : seqToRows(o.seq); S.seqDur[S.rigId] = o.dur && o.dur > 0 ? o.dur : null; S.seqRes = null; S.taskStart = o;
  }
  const fieldsOf = t => { let f = t.fields; if (typeof f === 'function') { try { f = f(S.taskStart); } catch (e) { f = []; } } return Array.isArray(f) ? f : []; };
  const choicesOf = t => { let f = t.choices; if (typeof f === 'function') { try { f = f(S.taskStart); } catch (e) { f = []; } } return Array.isArray(f) ? f : []; };
  async function startTask(id) {
    const t = (TK() || []).find(x => x.id === id); if (!t) return;
    const had = stash(); taskRes = null;
    if (root.Auswertung) root.Auswertung.hintReset(id);
    let o; try { o = typeof t.start === 'function' ? t.start() : {}; } catch (e) { console.error(e); toast('Die Startvorlage der Aufgabe fehlt'); return; }
    applyTaskState(t, o); S.task = { id }; S.name = t.title; S.id = null; S.dirty = false; delete taskAns[id];
    setTab(o && (o.rows && o.rows.length || o.seq && o.seq.length) ? 'seq' : 'tasks'); updateChrome();
    toast(had ? 'Aufgabe gestartet, dein Versuch ist gesichert' : 'Aufgabe gestartet'); renderTasksIfOpen();
  }
  const renderTasksIfOpen = () => { if (S.tab === 'tasks') renderTasks(); };
  const toSec = (v, u) => (fin(v) ? v * (TDIV[u] || 1) : v);
  function collectAnswer(t) {
    let st = null; try { st = S.rig ? clone(S.rig.state()) : null; } catch (e) {}
    const a = taskAns[t.id] || {}, v = a.v != null && a.v !== '' ? parseNum(a.v) : NaN, fl = fieldsOf(t), fo = {}, kw = Object.assign({}, S.strecke && S.strecke.rig === S.rigId ? S.strecke : {});
    delete kw.rig; delete kw.urteil; delete kw.kkritAuto;
    fl.forEach(f => { const raw = a.f && a.f[f.key], x = raw != null && raw !== '' ? parseNum(raw) : NaN; fo[f.key] = fin(x) ? x : null; if (fin(x) && ['Ks', 'Kis', 'Tu', 'Tg', 'Kkrit', 'Tkrit', 'T1', 'TsumKlein'].includes(f.key)) kw[f.key] = toSec(x, ['s', 'min', 'h'].includes(f.unit) ? f.unit : (['Tu', 'Tg', 'Tkrit', 'T1', 'TsumKlein'].includes(f.key) ? TU() : null)); });
    const first = fl.length ? fo[fl[0].key] : null;
    return { rig: S.rigId, controls: allCtl(), seq: seqSteps(curRows()), rows: clone(curRows()), dur: seqDur(), state: st, simTime: S.simT, value: fin(v) ? v : (fin(first) ? first : null), text: a.v == null ? '' : String(a.v), fields: fo, choices: Object.assign({}, a.c || {}), kennwerte: Object.keys(kw).length ? kw : null, op: S.op ? clone(S.op) : null };
  }
  async function checkTask() {
    const t = curTask(); if (!t) return; const R = root.REG_TASKS;
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
  /* Auto-Weg: Musterlösung laden und animiert abspielen (zählt als Hilfe Stufe 3) */
  function autoWay(t) {
    const had = stash(); let o; try { o = t.sol(); } catch (e) { console.error(e); toast('Die Musterlösung fehlt'); return; }
    const h = lsGet('sim.hints', {}); h[t.id] = 3; lsSet('sim.hints', h);
    S.task = null; taskRes = null; applyTaskState(t, o); S.name = t.title + ' (Musterlösung)'; S.id = null; S.dirty = false; updateChrome();
    const has = o && (o.rows && o.rows.length || o.seq && o.seq.length);
    if (has) { setTab('rig'); seqLive(); } else { setTab('rig'); setRun(true); }
    toast(had ? 'Auto-Weg läuft, dein Stand ist gesichert' : 'Auto-Weg: Die Musterlösung läuft');
  }
  function hintTask() {
    const t = curTask(); if (!t) return; const h = t.hint, arr = Array.isArray(h) ? h : null;
    const o = { id: t.id, hint: arr ? arr[0] : h, concrete: () => { if (arr && arr[1]) return arr[1]; const l = taskRes && taskRes.id === t.id ? taskRes.lines.find(x => !x.ok) : null; return l ? 'Noch nicht erfüllt: ' + l.text : taskRes && taskRes.id === t.id ? 'Alle Prüfpunkte sind erfüllt. Tippe auf „Lösung prüfen“.' : 'Tippe zuerst auf „Lösung prüfen“, dann kann ich dir den ersten offenen Punkt nennen.'; }, reveal: arr && arr[2] ? () => arr[2] : null, solution: typeof t.sol === 'function' ? () => autoWay(t) : null };
    if (root.Auswertung) root.Auswertung.hint(o); else sheet('Tipp', b => { b.innerHTML = '<p style="margin-top:0">' + esc(o.hint || '') + '</p>'; });
  }
  const choiceOpts = c => (c.options || []).map(o => (o && typeof o === 'object' ? { value: o.value, label: o.label != null ? o.label : String(o.value) } : { value: o, label: String(o) }));
  function renderTasks() {
    const V = $('#taskView'), A = TK();
    if (!A) { V.innerHTML = '<div class="card pl"><h4>Aufgaben</h4><p class="big">Aufgaben folgen</p><p class="hint2">Hier erscheinen Aufgaben mit automatischer Prüfung: Grundlagen, Strecke messen, Regler einstellen, Stabilität, Zweipunktregler, Fehlersuche und Prüfungsaufgaben. Bis dahin kannst du mit den Beispielen, dem Rechner und dem Tab „Lernen“ üben.</p><div class="btns"><button class="btn pri" id="tkEx">Beispiele ansehen</button><button class="btn" id="tkRetry" data-retry>Erneut prüfen</button></div></div>'; $('#tkEx', V).onclick = openExamples; return; }
    const d = taskDone(), t = curTask(); let h = '';
    const n100 = A.filter(x => (d[x.id] || 0) >= 100).length, ic = x => (x.rig ? rigIcon(x.rig) : '🧮'), rn = x => (x.rig ? rigName(x.rig) : 'Rechner');
    h += `<div class="pbar big"><i style="width:${Math.round(100 * n100 / A.length)}%"></i></div>`;
    if (t) {
      const r = taskRes && taskRes.id === t.id ? taskRes : null, ask2 = t.ask ? (typeof t.ask === 'string' ? { label: t.ask } : t.ask) : null, ans = taskAns[t.id] || {}, fl = fieldsOf(t), cl = choicesOf(t);
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat || '')}</h4><div class="big">${esc(t.title)}</div><div class="lv">${'●'.repeat(t.level || 1)}${'○'.repeat(3 - (t.level || 1))}</div>
        <p style="margin:8px 0">${esc(t.text)}</p><p class="hint2" style="margin-top:0">Prüfstand: ${ic(t)} ${esc(rn(t))}</p>
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
      <div class="chips" id="tkCats" style="padding:8px 0 0"><button class="chip s${!S.tkCat ? ' on' : ''}" data-cat="">Alle</button>${cats.map(c => `<button class="chip s${S.tkCat === c ? ' on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
    let last = '';
    A.forEach(x => {
      if (S.tkCat && x.cat !== S.tkCat) return;
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
    const tb = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]'), cat = e.target.closest('[data-cat]');
    if (cat) { S.tkCat = cat.dataset.cat || ''; renderTasks(); return; }
    if (tb) {
      const a = tb.dataset.ta;
      if (a === 'check') checkTask(); else if (a === 'hint') hintTask(); else if (a === 'rig') setTab('rig');
      else if (a === 'auto') { const t = curTask(); if (t && await confirmSheet('Auto-Weg?', 'Der Prüfstand spielt die Musterlösung ab. Das <b>zählt als Hilfe</b> (Stufe 3): Dein Ausbilder sieht es.', 'Abspielen')) autoWay(t); }
      else if (a === 'hand') { const t = curTask(); if (t && root.Auswertung) root.Auswertung.handIn(t.id, taskDone()[t.id] || 0, t.title); }
      else if (a === 'end') { S.task = null; S.evSig = ''; taskRes = null; updateChrome(); renderTasks(); toast('Aufgabe beendet'); }
    } else if (row) startTask(row.dataset.t);
  });

  /* ============================================================ Fehler-Würfel: Störung auswürfeln (wirkt auf Steuerwerte) */
  const DICE = [
    { id: 'klemmt', need: ['ymax'], run: () => { const c = ctlDef('ymax'), cur = +S.rig.getControl('ymax'), nv = Math.max(c.min, Math.round(cur * 0.6)); return { keys: { ymax: nv }, text: 'Das Stellglied klemmt: Die Stellgröße ist auf ' + fnum(nv, 0) + ' % begrenzt (vorher ' + fnum(cur, 0) + ' %).' }; } },
    { id: 'wirk', need: ['dir'], run: () => { const cur = S.rig.getControl('dir'), nv = cur === 'direkt' ? 'invers' : 'direkt'; return { keys: { dir: nv }, text: 'Der Wirkungssinn wurde vertauscht: Der Regler wirkt jetzt ' + nv + ' statt ' + cur + '.' }; } },
    { id: 'scharf', need: ['kp'], run: () => { const c = ctlDef('kp'), cur = +S.rig.getControl('kp'), nv = Math.min(c.max, cur * 4); return { keys: { kp: nv }, text: 'Der Regler ist zu scharf: Kp wurde von ' + fnum(cur, adig(cur)) + ' auf ' + fnum(nv, adig(nv)) + ' erhöht.' }; } },
    { id: 'rauschen', need: ['noise'], run: () => { const c = ctlDef('noise'), nv = Math.min(c.max, 3); return { keys: { noise: nv }, text: 'Das Messglied rauscht: Das Messrauschen steht auf ' + fnum(nv, 1) + ' %.' }; } },
    { id: 'last', need: ['z'], run: () => { const nv = zOnVal(); return { keys: { z: nv }, text: 'Lastsprung: Die Störgröße z steht jetzt auf ' + fauto(nv) + '.' }; } },
    { id: 'fenster', need: ['window'], run: () => ({ keys: { window: true }, text: 'Das Fenster ist offen: Die Strecke hat sich geändert.' }) },
    { id: 'drift', need: ['offset'], run: () => { const c = ctlDef('offset'), nv = Math.min(c.max, c.min + 0.7 * (c.max - c.min)); return { keys: { offset: nv }, text: 'Der Sensor driftet: Der Messoffset steht auf ' + fauto(nv) + '.' }; } },
    { id: 'totzeit', need: ['tt'], run: () => { const c = ctlDef('tt'), cur = +S.rig.getControl('tt'), nv = Math.min(c.max, Math.max(cur * 3, c.min + 0.3 * (c.max - c.min))); return { keys: { tt: nv }, text: 'Die Totzeit ist gewachsen: von ' + tstr(cur) + ' auf ' + tstr(nv) + '.' }; } }
  ];
  function diceRoll() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; } if (S.task) { toast('Beende zuerst die Aufgabe.'); return; }
    const ok = DICE.filter(d => d.need.every(k => hasCtl(k))); if (!ok.length) { toast('An diesem Prüfstand lässt sich nichts auswürfeln.'); return; }
    const d = ok[Math.floor(Math.random() * ok.length)], before = {}; const r = d.run(); Object.keys(r.keys).forEach(k => { before[k] = S.rig.getControl(k); });
    applyCtl(r.keys); S.dice = { id: d.id, text: r.text, before }; S.dirty = true; saveCurSoon(); if (!S.running) setRun(true);
    if (root.LochFX) try { root.LochFX.sound('slide'); } catch (e) {}
    sheet('🎲 Fehler gewürfelt', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Am Regelkreis stimmt etwas nicht. Beobachte den Messschreiber und finde die Ursache.</p><div class="btns"><button class="btn" data-d="show">Auflösung zeigen</button><button class="btn" data-d="undo">Fehler beheben</button><button class="btn pri" data-d="ok">Ich suche selbst</button></div><div id="dcOut"></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-d]'); if (!x) return; if (x.dataset.d === 'show') $('#dcOut', b).innerHTML = '<div class="ex">' + esc(S.dice.text) + '</div>'; else if (x.dataset.d === 'undo') { applyCtl(S.dice.before); S.dice = null; toast('Fehler behoben'); close(); } else close(); });
    });
  }

  /* ============================================================ Rechnen und Lernen: Erweiterungen (WP3b) */
  function extApi() {
    return { get S() { return S; }, get rig() { return S.rig; }, setTab, loadExample, startTask, toast, esc, stat: (k, v, m) => { if (k === 'regcalc') S.calcUsed = true; stat(k, v, m); }, lsGet, lsSet, get REG_CORE() { return CORE(); }, KEYS, tunit: TU, rngOf: rng };
  }
  function renderExt(kind) {
    const host = $(kind === 'calc' ? '#calcView' : '#helpView'), E = root.REG_UI_EXT && root.REG_UI_EXT[kind];
    if (!host) return;
    if (!E || typeof E.render !== 'function') { host.innerHTML = `<div class="card pl"><p class="big">${kind === 'calc' ? 'Rechner wird geladen' : 'Lernen wird geladen'}</p><p class="hint2">Die Datei ${kind === 'calc' ? 'regui-calc.js' : 'regui-help.js'} ist noch nicht geladen.</p><div class="btns"><button class="btn" data-retry>Erneut prüfen</button></div></div>`; return; }
    if (kind === 'help' && host.dataset.ext === '1' && host.children.length) return;
    try { E.render(host, extApi()); host.dataset.ext = '1'; } catch (e) { console.error('Erweiterung ' + kind + ':', e); host.innerHTML = '<div class="card pl"><p class="big">Das hat nicht geklappt</p><p class="hint2">' + esc((e && e.message) || e) + '</p></div>'; }
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-retry]') && S.tab === 'calc') renderExt('calc'); });

  /* ============================================================ Oberfläche: Kopf, Tabs, Leiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd" style="display:none"></span>' : ''}</button>`).join('');
    updateTaskBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function redrawTab() { if (S.tab === 'rig' || S.tab === 'tune') drawScopes(); if (S.tab === 'meas') { drawMeasChart(); drawMeasCurves(true); } if (S.tab === 'seq') drawSeqChart(); if (S.tab === 'tune') renderStab(true); }
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'rig'; const prev = S.tab; S.tab = t; lsPut('reg.tab', t);
    $('#mid').dataset.tab = t; $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'meas') renderMeas(); else if (t === 'tune') renderTune(); else if (t === 'seq') renderSeq(); else if (t === 'calc') renderExt('calc'); else if (t === 'tasks') renderTasks(); else if (t === 'help') renderExt('help');
    updateChrome();
    requestAnimationFrame(() => { fitCanvas(); updateMeters(0, true); redrawTab(); syncCtl(true); });
    if (prev !== t && t === 'seq') renderSeqLive();
  }
  function updateTitle() {
    const nm = S.rig ? rigName(S.rigId) : rigName(S.rigId || 'fuellstand');
    $('#title').innerHTML = esc(S.name) + (S.dirty ? ' •' : '') + '\n<small>' + esc(nm) + (S.attrappe ? ' (Notfall-Attrappe)' : '') + (S.running ? ' · läuft' : '') + '</small>';
    document.title = 'Regelungstechnik-Lab: ' + S.name;
    const tag = $('#cvTag'); if (tag) { tag.textContent = S.running ? '' : '⏸ Pause'; tag.style.display = S.running ? 'none' : ''; }
  }
  $('#title').onclick = async () => { const r = await ask('Name des Versuchs', [{ key: 'n', label: 'Name', type: 'text', value: S.name }]); if (r && r.n.trim()) { S.name = r.n.trim(); S.dirty = true; updateChrome(); saveCurSoon(); } };
  let palSig = '';
  function buildPal() {
    const fxOn2 = fxOn(), sig = [S.running, S.speed, S.digital, fxOn2, !!S.rig, !!S.live, S.plan].join('|');
    if (sig === palSig) return; palSig = sig; const F = !!root.LochFX;
    $('#pal').innerHTML = `<button class="chip ${S.running ? 'on' : 'go'}" data-a="run" aria-label="${S.running ? 'Pause' : 'Start'}">${S.running ? '⏸ Pause' : '▶ Start'}</button><button class="chip" data-a="reset" aria-label="Zurücksetzen">⟲ Reset</button><span class="sep"></span>
      <span class="seg" aria-label="Zeitraffer">${SPEEDS.map(v => `<button data-sp="${v}" class="${S.speed === v ? 'on' : ''}">×${String(v).replace('.', ',')}</button>`).join('')}</span><span class="sep"></span>
      <button class="chip ${S.plan ? 'on' : ''}" data-a="plan" aria-pressed="${S.plan}" title="Wirkungsplan statt Anlagenbild">🔀 Wirkungsplan</button><button class="chip ${S.digital ? 'on' : ''}" data-a="dig" aria-pressed="${S.digital}" title="Messgeräte als Zeiger oder Zahlen">${S.digital ? '🔢 Zahlen' : '🎯 Zeiger'}</button>${F ? `<button class="chip ${fxOn2 ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn2}" aria-label="Effekte und Ton" title="Effekte und Ton">${fxOn2 ? '🎉' : '🔇'} Effekte</button>` : ''}
      <span id="stat"></span>`;
    const r = $('#bRun'); r.textContent = S.running ? '⏸' : '▶'; r.classList.toggle('on', S.running); r.setAttribute('aria-label', S.running ? 'Pause' : 'Start');
    updateStat();
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sp) setSpeed(+b.dataset.sp);
    else if (b.dataset.a === 'run') setRun(!S.running); else if (b.dataset.a === 'reset') resetRig();
    else if (b.dataset.a === 'plan') togglePlan();
    else if (b.dataset.a === 'dig') { S.digital = !S.digital; lsPut('reg.digital', S.digital ? '1' : '0'); buildMeters(); updateMeters(0, true); updateChrome(); }
    else if (b.dataset.a === 'fx') toggleFx();
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
      ['fx', 'Effekte und Ton: ' + (fxOn() ? 'an' : 'aus'), 'Sprechblasen, Konfetti und lustige Töne ein- oder ausschalten'], ['png', 'Prüfstandbild speichern (PNG)', 'Aktuelle Ansicht als Bilddatei'], ['csv', 'Aufzeichnung als CSV', 'Messschreiber-Daten für Excel'], ['dice', 'Fehler-Würfel', 'Eine Störung am Regelkreis auswürfeln und suchen'],
      ['calc2', 'Rechnen', 'Einstellregeln, Stabilität, Skalierung und Übungen'], ['calc', 'Taschenrechner', 'Ohm, Farbcode, Leitung und mehr'],
      ['abz', 'Abzeichen', 'Deine Sammlung und was noch fehlt'], ['kamp', 'Kampagne: Das Abschlussgerät', 'Lernpfad mit Geschichte über alle Labs'], ['trainer', 'Trainer: Erste Schritte', 'Kurze Einführung zum Mitmachen'],
      ['neu', 'Neu in dieser Version', 'Was zuletzt dazukam und wo du es findest'], ['erg', 'Ergebnis senden', 'Code für den Ausbilder: meine bearbeiteten Aufgaben'], ['keys', 'Tastenkürzel', kk + ' und mehr (Taste ? drücken)'], ['help', 'Hilfe und Lernen', 'Grundlagen kurz erklärt'], ['start', 'Zur Startseite', '']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b>${r[2] ? `<small>${esc(r[2])}</small>` : ''}</div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); menuAct(r.dataset.m); });
    });
  }
  async function newExperiment() {
    if (S.task) { toast('Beende zuerst die Aufgabe.'); return; }
    const v = await pick('Neuer Versuch: Prüfstand wählen', ORDER.map(id => ({ value: id, label: rigName(id), sub: ((defOf(id) || {}).info) || RIGMETA[id].info, icon: rigIcon(id), mark: defOf(id) ? '' : 'fehlt' })));
    if (!v) return; const had = stash(); S.name = 'Neuer Versuch'; S.id = null; S.dirty = false; S.rows[v] = []; setRig(v); setTab('rig');
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
  let last = 0, lastUI = 0, lastSc = 0, lastMs = 0, lastOsc = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = ts; return; }
    const dt = Math.min(100, ts - (last || ts)); last = ts;
    if (S.running && S.rig) {
      try { simAdvance(dt); }
      catch (e) { S.running = false; S.live = null; console.error('Simulation:', e); toast('Der Prüfstand hat einen Rechenfehler gemeldet und wurde angehalten.'); updateChrome(); }
    }
    if (S.rig) watchEvents(ts);
    if (S.running && ts - lastOsc > 1000) { lastOsc = ts; oscCheck(); }
    if (S.tab === 'rig') {
      drawRig(ts); updateMeters(dt);
      if (ts - lastSc > 70) { lastSc = ts; drawScopes(); }
      if (ts - lastUI > 100) {
        lastUI = ts; readState(); syncCtl(); updateStat(); updateDiag();
        const fb = $('#cvFault'), on = performance.now() < (S.faultUntil || 0);
        if (fb) { if (on) { if (fb.textContent !== S.faultText) fb.textContent = S.faultText; } if (fb.classList.contains('on') !== on) fb.classList.toggle('on', on); }
      }
    } else if (ts - lastUI > 200) { lastUI = ts; readState(); updateStat(); }
    fxFrame();
    if (S.tab === 'tune' && ts - lastSc > 120) { lastSc = ts; drawScopes(); syncCtl(); renderStab(false); if (S.jump && !S.jump.done) renderTuneMetrics(); }
    if (S.tab === 'meas' && ts - lastMs > 160) { lastMs = ts; measUpdate(false); swUpdate(); }
    if (S.tab === 'seq' && ts - lastSc > 100) { lastSc = ts; renderSeqLive(); }
  }

  /* ============================================================ Schnittstellen für Trainer, Tasten, Tests */
  root.LabTrainerAPI = {
    lab: 'reg', tab: () => S.tab, go: setTab, simMode: () => S.running, running: () => S.running, rig: () => S.rigId, speed: () => S.speed,
    load: loadExampleByName, examples: () => exampleList().map(e => e.name), task: () => (S.task ? S.task.id : null), saved: () => saves().length,
    seqRows: () => curRows().length, seqDone: () => !!S.seqRes, simTime: () => S.simT, faults: () => (lsGet('reg.faults', []) || []).length, calcUsed: () => !!S.calcUsed,
    stepDone: () => !!(S.stepDone || (S.meas && S.meas.rec && S.meas.rec.done)), tuned: () => !!S.tuned, ctrlType: () => (S.st && S.st.ctrl) || null
  };
  root.LabKeysAdapter = {
    lab: 'reg', sheet: (title, build) => (title === 'Tastenkürzel' ? sheet(title, b => { b.innerHTML = keysHtml(); }) : sheet(title, build)), esc, toast,
    sim: () => setRun(!S.running), busy: () => true, has: () => false
  };
  /* kleine Testschnittstelle */
  root.REG_UI = { frame, S, KEYS, TABS, ORDER, setTab, setRig, setCtl, applyCtl, setRun, resetRig, simAdvance, loadExample, loadExampleByName, startTask, checkTask, seqRunBg, seqLive, seqSteps, seqToRows, curRows, snapshot, allCtl, coerce, csvText, parseCsv, shareObj, packShare, unpackShare, applyItem, saveItem, evalJump, sample, diceRoll, exampleList, BUILTIN, measPrepare, measStep, measCompare, measAccept, swPrepare, swUp, swKick, tuneResult, tuneApply, TUNE, wStep, zToggle, renderMeas, renderTune, renderSeq, drawScopes, renderStab, metricsHtml, extApi, collectAnswer, planData, retryLoad, toggleMode, togglePlan, openMenu, scopeWin, rowNorm, seqDur, DICE, slPos, slVal };

  /* ============================================================ Start */
  function init() {
    buildTabs(); $('#scopeHost').innerHTML = scopeBoxHtml('scopeR'); wireScope($('#scopeR'));
    const cur = lsGet('reg.cur', null);
    if (cur && ORDER.includes(cur.rig)) {
      S.rows = cur.rows && typeof cur.rows === 'object' && !Array.isArray(cur.rows) ? cur.rows : {}; Object.keys(S.rows).forEach(k => { S.rows[k] = Array.isArray(S.rows[k]) ? rowNorm(S.rows[k].filter(r => r && typeof r.key === 'string')) : []; });
      S.name = cur.name || 'Neuer Versuch'; S.id = cur.id || null; S.task = cur.task ? { id: cur.task } : null; S.strecke = cur.strecke && typeof cur.strecke === 'object' ? cur.strecke : null; S.seqDur = cur.dur && typeof cur.dur === 'object' ? cur.dur : {};
      setRig(cur.rig); applyCtl(cur.ctl); S.dirty = !!cur.dirty;
    } else {
      setRig(ORDER[0]);
      if (!lsRaw('reg.seen', '')) { lsPut('reg.seen', '1'); setTimeout(() => toast('Willkommen! Starte mit ▶ unten oder bewege einen Regler: Der Prüfstand läuft dann los.'), 900); }
    }
    setTab(S.tab); requestAnimationFrame(frame);
    root.addEventListener('load', () => { if (S.tab === 'calc' || S.tab === 'help') renderExt(S.tab); });
    /* Aufrufparameter von Startseite, Lernpfad, Kampagne und Lernheften: ?aufgabe=rg1, ?ex=Name, ?bsp, ?neu */
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
    if (S.attrappe) setTimeout(() => toast('Die Prüfstände sind nicht geladen: Es läuft nur eine Notfall-Attrappe.'), 1500);
  }
  init();
})(window);
