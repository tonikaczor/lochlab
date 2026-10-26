'use strict';
/* Tonfunk EMV-Lab: Oberfläche (WP3a).
   Seite, Tabs (Prüfstand, Spektrum, Layout-Fälle, Rechnen, Aufgaben, Lernen), Wirkungskette mit den drei Hebeln, Ampelzeile, Bedienpult und Messgeräte automatisch aus rig.controls / rig.meters,
   Vorher/Nachher (Merken, Geisterbild, Wischer), Sweep und Ablauf, Fehler-Würfel, Speichern/Öffnen/Teilen, Aufgabenanbindung, Qualitätsstufen, Effekte.
   Spektrum, Layout-Fälle, Rechnen und Lernen kommen aus emvui-spec.js, emvui-lay.js, emvui-calc.js und emvui-help.js über window.EMV_UI_EXT (SPEC 8.8).
   Die Prüfstände kommen aus emvrig-*.js über window.EMV_RIGS (Registry), Rechnen und Läufer aus emvcore.js (window.EMV_CORE), Zeichenhelfer aus emvdraw.js, Beispiele und Aufgaben aus emvdata.js.
   Es gibt hier KEINE zweite Formelimplementierung: assess, diagnose, runSeq, formulas, exercise, layout.hit rufen immer den Kern bzw. den Prüfstand (SPEC Regel 7).
   Speicher: emv.cur (laufende Arbeit), emv.saves (gespeicherte Versuche), emv.tab, emv.speed, emv.seen, emv.fx, emv.faults, emv.q (Qualität), emv.rigsused, emv.shots, emv.cases, emv.hint, sim.done (Aufgaben, gemeinsam mit den anderen Labs). */
(function (root) {
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const lsRaw = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsPut = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const clone = o => JSON.parse(JSON.stringify(o));
  const uid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const stat = (k, v, m) => { if (root.Badges) try { root.Badges.stat(k, v, m); } catch (e) {} };
  const fin = v => typeof v === 'number' && isFinite(v);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const CORE = () => root.EMV_CORE;
  const DRAW = () => root.EMV_DRAW;
  const ORDER = ['kopplung', 'quelle', 'filter', 'schirm', 'abstrahlung', 'layout', 'esd', 'tastkopf', 'vorpruef'];
  const RIGMETA = {
    kopplung: { icon: '🔌', name: 'Kopplungs-Labor', file: 'emvrig-kopplung.js', info: 'Zwei Leitungen über Masse: Störer und Opfer' },
    quelle: { icon: '⚡', name: 'Störquelle Schalter', file: 'emvrig-quelle.js', info: 'Schaltzelle eines Schaltnetzteils am LISN' },
    filter: { icon: '🎚️', name: 'Netzfilter-Prüfstand', file: 'emvrig-filter.js', info: 'Filter zwischen Quelle und Netznachbildung' },
    schirm: { icon: '🛡️', name: 'Schirmung und Gehäuse', file: 'emvrig-schirm.js', info: 'Schirmdämpfung, Schlitz, Kabeldurchführung' },
    abstrahlung: { icon: '📡', name: 'Kabel als Antenne', file: 'emvrig-antenne.js', info: 'Viertelwellen-Resonanz und Takt-Oberwellen' },
    layout: { icon: '🧩', name: 'Leiterplatten-Layout', file: 'emvrig-layout.js', info: 'Zwölf Fälle: Rückstrom, Schleifenfläche, Abblock-C' },
    esd: { icon: '💥', name: 'ESD, Burst und Surge', file: 'emvrig-impuls.js', info: 'Prüfgenerator, Schutzbauteile, Bewertungskriterien' },
    tastkopf: { icon: '🔍', name: 'Tastkopf am Oszilloskop', file: 'emvrig-messen.js', info: 'Masseanschluss, Überschwinger, eingefangene Störung' },
    vorpruef: { icon: '🚦', name: 'Vorprüfung Entstörung', file: 'emvrig-messen.js', info: 'Steckernetzteil an der Netznachbildung' }
  };
  /* Die drei Hebel: EINE Tabelle für Bedienpult, Wirkungskette, Aufgabe em1 und Lernen (Regel 5). */
  const LEVERS = {
    quelle: { id: 'quelle', name: 'Quelle entschärfen', short: 'Quelle', chain: 'quelle', color: 'var(--lv-quelle)', sym: 'Q' },
    pfad: { id: 'pfad', name: 'Kopplung verringern', short: 'Pfad', chain: 'pfad', color: 'var(--lv-pfad)', sym: 'K' },
    senke: { id: 'senke', name: 'Senke härten', short: 'Senke', chain: 'senke', color: 'var(--lv-senke)', sym: 'S' },
    none: { id: 'none', name: 'Anzeige und Vorgaben', short: '', chain: null, color: 'var(--lv-none)', sym: '' }
  };
  const LEVER_ORDER = ['quelle', 'pfad', 'senke', 'none'];
  const leverOf = c => (c && c.lever && LEVERS[c.lever] ? c.lever : 'none');
  const SNAPS = [[50, '50 Hz'], [150e3, '150 kHz'], [1e6, '1 MHz'], [30e6, '30 MHz'], [100e6, '100 MHz'], [1e9, '1 GHz']];
  const SIBASE = /^(Hz|F|H|Ω|V|A|W|s|m)$/;
  const decs = step => { step = +step || 0; if (!step || step >= 1) return 0; return Math.min(3, Math.ceil(-Math.log10(step) - 1e-9)); };
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',') : '–');
  const adig = v => { v = Math.abs(v); return v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : v >= 0.1 ? 3 : 4; };
  const fauto = v => (fin(v) ? fnum(v, adig(v)) : '–');
  const PRE = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  function fe(x, unit) {
    const C = CORE(); if (C && typeof C.fmtEng === 'function') { try { const t = C.fmtEng(x, unit || ''); if (typeof t === 'string' && t) return t; } catch (e) {} }
    if (!fin(x)) return '–'; if (x === 0) return '0 ' + (unit || ''); const a = Math.abs(x), p = PRE.find(q => a >= q[0] * 0.9995) || PRE[PRE.length - 1], v = x / p[0];
    return String(+v.toFixed(Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2)).replace('.', ',') + ' ' + p[1] + (unit || '');
  }
  function parseNum(s) {
    const C = CORE(); if (typeof s === 'number') return fin(s) ? s : NaN;
    if (C && typeof C.parseNum === 'function') { const v = C.parseNum(s); if (fin(v)) return v; return NaN; }
    return parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.'));
  }
  /* Töne nur nach einer Bedienung durch den Nutzer (sonst Warnung des Browsers) */
  const canSound = () => !root.navigator || !navigator.userActivation || navigator.userActivation.hasBeenActive;
  const clickSnd = (k, v) => { if (root.LochFX && canSound()) try { root.LochFX.sound(k || 'tick', v); } catch (e) {} };
  const pad2 = n => String(n).padStart(2, '0');
  const AMP = { gruen: { sym: '✓', name: 'grün', cls: 'ok' }, gelb: { sym: '!', name: 'gelb', cls: 'warnc' }, rot: { sym: '✗', name: 'rot', cls: 'bad' }, grau: { sym: '–', name: 'grau', cls: '' } };
  const ampKey = a => { a = String(a || 'grau').toLowerCase().replace('ü', 'ue'); return AMP[a] ? a : 'grau'; };

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
        b.innerHTML = (opt.intro ? `<p class="hint2" style="margin-top:0">${esc(opt.intro)}</p>` : '') + '<div id="pl"></div>';
        $('#pl', b).innerHTML = options.map((o, i) => `<button class="row" data-i="${i}"${o.disabled ? ' disabled' : ''}>${o.icon ? `<span class="ric">${o.icon}</span>` : ''}<div class="grow"><b>${esc(o.label)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div>${o.mark ? `<span class="lv">${esc(o.mark)}</span>` : ''}</button>`).join('');
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
  function confirmSheet(title, text, okLabel, danger) {
    return new Promise(res => {
      let done = false; const fin2 = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        b.innerHTML = `<p style="margin-top:0">${text}</p><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn ${danger ? 'danger' : 'pri'}" data-ok>${esc(okLabel || 'OK')}</button></div>`;
        $('[data-c]', b).onclick = close; $('[data-ok]', b).onclick = () => { fin2(true); close(); };
      }, () => fin2(false));
    });
  }
  root.LabUI = { sheet, esc, toast, userName: () => lsRaw('lm4.name', ''), LAB: 'emv' };
  root.sheet = sheet; root.toast = toast;

  /* ============================================================ Notfall-Attrappe (nur wenn EMV_RIGS ganz fehlt) */
  const DUMMY = (function () {
    const controls = [
      { key: 'ab', label: 'Abstand', type: 'slider', min: 1, max: 100, step: 1, unit: 'mm', value: 10, scale: 'log', lever: 'pfad', help: 'Mittenabstand der Leitungen.' },
      { key: 'us', label: 'Störspannung', type: 'slider', min: 1, max: 400, step: 1, unit: 'V', value: 24, scale: 'log', lever: 'quelle', help: 'Spitzenwert der Störspannung.' }
    ];
    const meters = [{ key: 'u', label: 'Störpegel', unit: 'dBµV', digits: 1, min: 0, max: 120 }];
    function create() {
      const c = {}, events = []; controls.forEach(x => { c[x.key] = x.value; }); let phase = 0;
      const lvl = () => 20 * Math.log10(Math.max(1e-6, c.us * 1e6 * 0.01 / c.ab));
      const rig = {
        id: 'kopplung', controls, meters, events, presets: [], roles: { quelle: ['us'], pfad: ['ab'] }, chain: { quelle: 'Störer', pfad: 'Kopplung', senke: 'Opfer' }, params: {},
        setControl(k, v) { const d = controls.find(q => q.key === k); if (!d) return false; v = +v; if (!fin(v)) return false; c[k] = clamp(v, d.min, d.max); return true; }, getControl(k) { return c[k]; }, getControls() { return Object.assign({}, c); }, snapshot() { return { ctl: Object.assign({}, c) }; }, restore(s) { if (s && s.ctl) Object.assign(c, s.ctl); },
        step(ms) { phase += ms / 1000; }, readMeters() { return { u: lvl() }; }, state() { return { phase }; }, assess() { const m = 60 - lvl(); return { ok: m >= 0, ampel: m >= 6 ? 'gruen' : m >= 0 ? 'gelb' : 'rot', margin: m, text: 'Notfall-Attrappe: Marge ' + fnum(m, 1) + ' dB' }; },
        curves() { return []; }, reset() { controls.forEach(q => { c[q.key] = q.value; }); }, worldSize() { return { w: 1000, h: 560 }; }, diagnose() { return []; },
        draw(g, w, h) { g.fillStyle = '#1b2128'; g.fillRect(0, 0, w, h); g.fillStyle = '#8d99a6'; g.font = '600 16px system-ui'; g.textAlign = 'center'; g.fillText('Notfall-Attrappe: Die Prüfstände sind nicht geladen', w / 2, h / 2); }
      };
      return rig;
    }
    return { id: 'kopplung', name: 'Kopplungs-Labor (Notfall-Attrappe)', icon: '🔌', info: 'Einfache Ersatzanzeige, bis die echten Prüfstände geladen sind.', controls, meters, create, attrappe: true, presets: [] };
  })();
  const defOf = id => {
    const r = root.EMV_RIGS;
    if (r && r.defs && r.defs[id]) return r.defs[id];
    if (!r && id === 'kopplung') return DUMMY;
    return null;
  };
  const rigName = id => { const d = defOf(id); return (d && !d.attrappe && d.name) || (RIGMETA[id] || {}).name || id; };
  const rigIcon = id => { const d = defOf(id); return (d && d.icon) || (RIGMETA[id] || {}).icon || '🎛️'; };

  /* ============================================================ Zustand */
  const mqReduce = (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)')) || { matches: false };
  const SPEEDS = [0.1, 0.5, 1, 2, 5];
  const S = {
    tab: lsRaw('emv.tab', 'rig'), rigId: null, rig: null, refRig: null, err: '', name: 'Neuer Versuch', id: null, task: null, dirty: false,
    running: false, speed: +lsRaw('emv.speed', '1') || 1, digital: lsRaw('emv.digital', '0') === '1',
    ctl: {}, simT: 0, rows: {}, live: null, seqRes: null, readonly: false, ref: null, refMode: 'nachher', wipe: 0.5, lever: null,
    peak: false, clicks: [], lay: null, layRigId: null, calcUsed: false, fired: false, specOpened: false,
    q: { mode: lsRaw('emv.q', 'auto'), level: 'hoch', ms: [], lastSwitch: 0, fastSince: 0 }
  };
  const TABS = [['rig', '🎛️', 'Prüfstand'], ['spec', '📊', 'Spektrum'], ['lay', '🧩', 'Layout-Fälle'], ['calc', '🧮', 'Rechnen'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Lernen']];
  if (!TABS.some(x => x[0] === S.tab)) S.tab = 'rig';
  if (!SPEEDS.includes(S.speed)) S.speed = 1;
  if (!['auto', 'hoch', 'mittel', 'niedrig'].includes(S.q.mode)) S.q.mode = 'auto';
  const QLEVELS = ['hoch', 'mittel', 'niedrig'];

  /* ---- Tastenkürzel: EINE Tabelle für Behandler, Hilfe-Blatt und Menü (Regel 5) ---- */
  const KEYS = [
    { id: 'run', keys: ['Leertaste'], match: e => e.key === ' ', t: 'Prüfstand starten und anhalten', act: () => setRun(!S.running) },
    { id: 'reset', keys: ['Z'], match: e => e.key.toLowerCase() === 'z' && !(e.ctrlKey || e.metaKey), t: 'Prüfstand zurücksetzen (Reset)', act: () => resetRig() },
    { id: 'fx', keys: ['E'], match: e => e.key.toLowerCase() === 'e', t: 'Effekte und Ton ein oder aus', act: () => toggleFx() },
    { id: 'speed', keys: ['1', '2', '3', '4', '5'], match: e => e.key >= '1' && e.key <= '5', t: 'Zeitlupe und Zeitraffer ×0,1 / ×0,5 / ×1 / ×2 / ×5', act: e => setSpeed(SPEEDS[+e.key - 1]) },
    { id: 'merk', keys: ['M'], match: e => e.key.toLowerCase() === 'm', t: 'Zustand merken (Vorher)', act: () => merken() },
    { id: 'vn', keys: ['V'], match: e => e.key.toLowerCase() === 'v', t: 'Zwischen Vorher und Nachher wechseln', act: () => toggleVN() },
    { id: 'wipe', keys: ['W'], match: e => e.key.toLowerCase() === 'w', t: 'Wischer Vorher | Nachher ein oder aus', act: () => toggleWipe() },
    { id: 'fire', keys: ['F'], match: e => e.key.toLowerCase() === 'f', t: 'Entladung auslösen (nur Prüfstand ESD, Burst und Surge)', act: () => doFire() },
    { id: 'peak', keys: ['P'], match: e => e.key.toLowerCase() === 'p', t: 'Spitzenwert halten (Tab Spektrum)', act: () => togglePeak() },
    { id: 'save', keys: ['Strg + S'], match: e => (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's', t: 'Versuch speichern', act: () => doSave() },
    { id: 'enter', keys: ['Eingabe', 'F5'], ext: true, t: 'Starten und anhalten (gilt auch außerhalb der Bildfläche)' },
    { id: 'help', keys: ['?'], ext: true, t: 'Diese Übersicht' }
  ];
  function keysHtml() {
    const kd = a => a.map(x => `<code>${esc(x)}</code>`).join(' oder ');
    return '<table>' + KEYS.map(k => `<tr><td class="nw">${kd(k.keys)}</td><td>${esc(k.t)}</td></tr>`).join('') + '</table><p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>';
  }
  root.EMV_KEYS = KEYS;

  let drawErr = false, curT = 0, taskRes = null; const taskAns = {};
  const ctlsOf = () => (S.rig ? (S.rig.controls || (defOf(S.rigId) || {}).controls || []) : []);
  const metersOf = () => (S.rig ? (S.rig.meters || (defOf(S.rigId) || {}).meters || []) : []);
  const ctlDef = (key, list) => (list || ctlsOf()).find(c => c.key === key);
  const hasCtl = k => !!ctlDef(k);
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
    S.running = false; S.simT = 0; S.live = null; S.seqRes = null; S.fired = false; S.diag = []; S.diagSeen = {}; S.fx = { amp: null, kazoo: false, flags: {} };
  }
  function setRig(id, o) {
    o = o || {};
    if (!ORDER.includes(id)) id = ORDER[0];
    const same = id === S.rigId;
    S.rigId = id; S.rig = null; S.refRig = null; S.err = ''; S.ctl = {}; S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; S.preset = null; S.st = null; S.lever = null;
    if (!same && !o.keepRef) { S.ref = null; S.refMode = 'nachher'; }
    resetRun(); fxReset();
    const d = defOf(id);
    if (d) { try { S.rig = d.create(o.opts || {}); } catch (e) { S.err = (e && e.message) || String(e); console.error('Prüfstand ' + id + ':', e); } }
    if (!S.rows[id]) S.rows[id] = [];
    S.attrappe = !!(d && d.attrappe);
    buildRefRig(); buildPick(); buildPresets(); buildControls(); buildMeters(); buildChain(); buildBA(); renderSweep(); fitCanvas(); updateEvents(true); updateChrome(); readState(); updateAmp(true);
    if (S.tab === 'spec') renderExt('spec'); if (S.tab === 'lay') renderExt('lay'); if (S.tab === 'calc') renderExt('calc'); if (S.tab === 'help') renderExt('help');
    saveCurSoon();
  }
  const SELFIRST = c => (c && (c.type === 'select' || c.type === 'switch') ? 0 : 1);
  /* mehrere Steuerwerte setzen: map { key: Wert }, Auswahlfelder zuerst (Fall, Stapel, Prüfart), nur passende Schlüssel, ohne Hinweise */
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
    let ok = true; try { ok = S.rig.setControl(key, v) !== false; } catch (e) { console.error(e); return false; }
    if (!ok) { syncCtl(true); return false; }
    S.ctl[key] = v;
    if (!silent) {
      S.dirty = true; saveCurSoon(); S.lever = leverOf(def); S.leverT = performance.now(); updateChain();
      if (!S.running && def.type !== 'button' && !S.live && S.tab === 'rig') setRun(true, true);
    }
    readState(); syncCtl(); return true;
  }
  const allCtl = () => {
    if (!S.rig) return {};
    if (typeof S.rig.getControls === 'function') { try { const o = S.rig.getControls(); if (o && typeof o === 'object') return clone(o); } catch (e) {} }
    const o = {}; ctlsOf().forEach(c => { try { const v = S.rig.getControl(c.key); if (v !== undefined) o[c.key] = v; } catch (e) {} }); return o;
  };
  const curRows = () => S.rows[S.rigId] || (S.rows[S.rigId] = []);
  const snapshot = () => { let s = null; try { s = S.rig && typeof S.rig.snapshot === 'function' ? S.rig.snapshot() : null; } catch (e) { s = null; } return s ? clone(s) : { ctl: allCtl() }; };
  function saveCurSoon() { clearTimeout(curT); curT = setTimeout(saveCur, 400); }
  function saveCur() { if (!S.rig) return; lsSet('emv.cur', { rig: S.rigId, ctl: allCtl(), ref: S.ref, refMode: S.refMode, rows: S.rows, name: S.name, id: S.id, task: S.task ? S.task.id : null, dirty: S.dirty }); }
  function usedRig() {
    if (S.attrappe || !S.rigId) return;
    const a = lsGet('emv.rigsused', []), s = new Set(Array.isArray(a) ? a : []); s.add(S.rigId); lsSet('emv.rigsused', [...s]); stat('emvrigs', s.size, 'max');
  }
  function readState() { if (!S.rig) { S.st = null; return null; } try { S.st = S.rig.state(); } catch (e) { S.st = S.st || null; } return S.st; }

  /* ---- Prüfstandwahl und Voreinstellungen ---- */
  function buildPick() {
    $('#rigPick').innerHTML = ORDER.map(id => {
      const have = !!defOf(id) && !(defOf(id).attrappe && id !== 'kopplung');
      return `<button class="chip${id === S.rigId ? ' on' : ''}${have ? '' : ' miss'}" data-rig="${id}">${rigIcon(id)} ${esc(rigName(id))}${have ? '' : ' ⚠'}</button>`;
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
    el.innerHTML = `<div class="gh gh0">Voreinstellung</div><div class="chips">${P.map(p => `<button class="chip s${S.preset === p.id ? ' on' : ''}" data-pre="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>`;
  }
  $('#presetBar').addEventListener('click', e => {
    const b = e.target.closest('[data-pre]'); if (!b || !S.rig) return;
    const p = presetsOf().find(x => String(x.id) === b.dataset.pre); if (!p) return;
    S.preset = p.id; let done = false;
    for (const fn of ['applyPreset', 'setPreset']) if (typeof S.rig[fn] === 'function') { try { done = S.rig[fn](p.id, p.params) !== false; } catch (er) { console.error(er); } break; }
    if (!done && p.controls) { applyCtl(p.controls); done = true; }
    if (!done) { try { S.rig = defOf(S.rigId).create({ preset: p.id, params: p.params, seed: 1 }); } catch (er) { console.error(er); toast('Voreinstellung nicht möglich'); return; } }
    const keepRef = S.ref; S.evSeen = new WeakSet(); S.evSig = ''; const run = S.running; resetRun(); S.running = run; S.ctl = {};
    buildControls(); buildMeters(); buildPresets(); buildChain(); readState(); updateEvents(true); updateChrome(); updateAmp(true); toast('Voreinstellung: ' + p.name); S.dirty = true; saveCurSoon(); void keepRef;
  });

  /* ---- Platzhalter, wenn ein Prüfstand fehlt ---- */
  const FILES = ['emvcore.js', 'emvcore-lay.js', 'emvdraw.js', 'emvrig-base.js', 'emvrig-kit.js', 'emvrig-quelle.js', 'emvrig-filter.js', 'emvrig-kopplung.js', 'emvrig-schirm.js', 'emvrig-antenne.js', 'emvrig-layout.js', 'emvrig-impuls.js', 'emvrig-messen.js', 'emvdata.js', 'emvtasks1.js', 'emvtasks2.js'];
  function placeholderHtml() {
    const why = S.err ? 'Der Prüfstand konnte nicht gestartet werden: ' + esc(S.err) : 'Die Datei für „' + esc(rigName(S.rigId)) + '“ ist noch nicht geladen.';
    return `<div class="ph2"><b>Prüfstand noch nicht geladen</b>${why}<br><button class="btn" data-retry>Erneut prüfen</button></div>`;
  }
  function retryLoad() {
    const want = FILES.filter(f => {
      if (f === 'emvcore.js') return !root.EMV_CORE; if (f === 'emvcore-lay.js') return !(root.EMV_CORE && root.EMV_CORE.layout); if (f === 'emvdraw.js') return !root.EMV_DRAW; if (f === 'emvdata.js') return !root.EMV_DATA;
      if (f === 'emvtasks1.js' || f === 'emvtasks2.js') return !root.EMV_TASKS; if (f === 'emvrig-base.js') return !(root.EMV_RIGS && root.EMV_RIGS.base); if (f === 'emvrig-kit.js') return !(root.EMV_RIGS && root.EMV_RIGS.kit);
      const id = ORDER.find(i => RIGMETA[i].file === f); return !(root.EMV_RIGS && root.EMV_RIGS.defs && root.EMV_RIGS.defs[id]);
    });
    if (!want.length) { setRig(S.rigId); toast('Alles geladen'); return Promise.resolve(); }
    toast('Lade fehlende Dateien …');
    const ld = f => new Promise(res => { const s = document.createElement('script'); s.src = f + '?t=' + Date.now(); s.onload = s.onerror = () => res(); document.head.appendChild(s); });
    const PRE = ['emvrig-base.js', 'emvrig-kit.js'], pre = PRE.filter(f => want.includes(f)), rest = want.filter(f => !PRE.includes(f));   /* Basis und Kit muessen vor den Pruefstaenden laufen */
    return pre.reduce((p, f) => p.then(() => ld(f)), Promise.resolve()).then(() => Promise.all(rest.map(ld))).then(() => {
      const still = ORDER.filter(i => !defOf(i)).length;
      const keep = S.rig ? allCtl() : ((lsGet('emv.cur', {}) || {}).ctl || {}); setRig(S.rigId); applyCtl(keep); buildPick();
      if (S.tab === 'tasks') renderTasks(); toast(still ? still + ' Prüfstand' + (still > 1 ? 'e fehlen' : ' fehlt') + ' noch' : 'Alle Prüfstände geladen');
    });
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-retry]')) retryLoad(); });

  /* ============================================================ Wirkungskette (Quelle - Pfad - Senke) und Ampelzeile */
  function chainOf() { const c = S.rig && S.rig.chain; return c && typeof c === 'object' ? c : null; }
  function buildChain() {
    const el = $('#chainBar'), c = chainOf(); if (!el) return;
    if (!c) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    const box = (lv, last) => { const L = LEVERS[lv]; return `<div class="cn" data-lv="${lv}" style="--lc:${L.color}" title="${esc(L.short + ': ' + (c[L.chain] || '–') + ' (' + L.name + ')')}"><b><i class="lsym">${L.sym}</i> ${esc(L.short)}</b><span>${esc(c[L.chain] || '–')}</span><small>${esc(L.name)}</small></div>${last ? '' : '<i class="ca" aria-hidden="true">➜</i>'}`; };
    el.innerHTML = `<div class="cnrow" role="group" aria-label="Wirkungskette Quelle, Pfad, Senke">${box('quelle')}${box('pfad')}${box('senke', true)}</div><div class="cmeta">${c.art ? 'Störart: ' + esc(c.art) : ''}${Array.isArray(c.kopplung) && c.kopplung.length ? ' · Kopplung: ' + esc(c.kopplung.join(', ')) : ''}</div>`;
    updateChain();
  }
  function updateChain() { $$('#chainBar .cn').forEach(n => n.classList.toggle('hot', n.dataset.lv === S.lever)); }
  let ampSig = '';
  const sgn = v => (v > 0 ? '+' : '');
  function assessOf(rig) { let a = null; try { a = rig && typeof rig.assess === 'function' ? rig.assess() : null; } catch (e) { a = null; } return a && typeof a === 'object' ? a : null; }
  function ampHtml(a, tag) {
    const k = ampKey(a.ampel), A = AMP[k];
    return `<div class="amp-b ${A.cls}"><span class="asym" aria-hidden="true">${A.sym}</span><span class="atx"><b>${tag ? esc(tag) + ': ' : ''}${esc(A.name)}${fin(a.margin) ? ', Marge ' + fnum(a.margin, 1) + ' dB' : ''}</b>${a.kriterium ? ' · Kriterium ' + esc(a.kriterium) : ''}${fin(a.freq) ? ' · bei ' + esc(fe(a.freq, 'Hz')) : ''}</span></div>`;
  }
  function updateAmp(force) {
    const el = $('#ampRow'); if (!el) return; const a = assessOf(S.rig);
    if (!a) { el.innerHTML = ''; return; }
    const k = ampKey(a.ampel), ra = S.ref && S.refRig ? assessOf(S.refRig) : null;
    const sig = [k, a.margin, a.text, a.freq, a.kriterium, ra ? ra.ampel + ra.margin : '', S.refMode].join('|');
    if (!force && sig === ampSig) return; ampSig = sig;
    const A = AMP[k];
    el.className = 'amprow ' + A.cls; el.setAttribute('role', 'status');
    el.innerHTML = `<span class="asym" aria-hidden="true">${A.sym}</span><div class="atx"><b>${esc(A.name.charAt(0).toUpperCase() + A.name.slice(1))}${fin(a.margin) ? ': Marge ' + fnum(a.margin, 1) + ' dB' : ''}${a.kriterium ? ' · Kriterium ' + esc(a.kriterium) : ''}${fin(a.freq) ? ' · bei ' + esc(fe(a.freq, 'Hz')) : ''}</b><small>${esc(a.text || '')}</small></div>${ra ? `<div class="avs"><span>Vorher: ${esc(AMP[ampKey(ra.ampel)].sym)} ${fin(ra.margin) ? fnum(ra.margin, 1) + ' dB' : esc(AMP[ampKey(ra.ampel)].name)}</span><span>Nachher: ${esc(A.sym)} ${fin(a.margin) ? fnum(a.margin, 1) + ' dB' : esc(A.name)}${fin(a.margin) && fin(ra.margin) ? ' (' + sgn(a.margin - ra.margin) + fnum(a.margin - ra.margin, 1) + ' dB)' : ''}</span></div>` : ''}`;
    const cv = $('#cv'); if (cv) cv.setAttribute('aria-label', 'Bild des Prüfstands ' + rigName(S.rigId) + '. Ampel ' + A.name + (fin(a.margin) ? ', Marge ' + fnum(a.margin, 1) + ' dB' : '') + '. ' + (a.text || ''));
  }

  /* ============================================================ Vorher/Nachher: Merken, Geisterbild, Wischer */
  function buildRefRig() {
    S.refRig = null; if (!S.ref || !S.rig) return; const d = defOf(S.rigId); if (!d) return;
    try { const r = d.create({ seed: 1 }); if (typeof r.restore === 'function') r.restore(clone(S.ref)); S.refRig = r; } catch (e) { console.error('Referenz:', e); S.refRig = null; }
  }
  function setRef(snap) { S.ref = snap ? clone(snap) : null; if (!S.ref) S.refMode = 'nachher'; buildRefRig(); buildBA(); updateAmp(true); extRefresh(); S.dirty = true; saveCurSoon(); }
  function merken() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    let s = null; try { s = S.rig.snapshot(); } catch (e) { s = null; } if (!s) { toast('Dieser Prüfstand kann seinen Zustand nicht merken.'); return; }
    setRef(s); stat('emvref', 1, 'max'); const a = assessOf(S.rig);
    toast('Gemerkt als Vorher' + (a && fin(a.margin) ? ' (Marge ' + fnum(a.margin, 1) + ' dB)' : '') + '. Ändere jetzt etwas und vergleiche.');
  }
  function toggleVN() {
    if (!S.ref) { toast('Merke zuerst einen Zustand: Taste M oder „Merken“.'); return; }
    S.refMode = S.refMode === 'vorher' ? 'nachher' : 'vorher'; buildBA(); updateAmp(true); stat('emvref', 1, 'max');
  }
  function toggleWipe() {
    if (!S.ref) { toast('Merke zuerst einen Zustand: Taste M oder „Merken“.'); return; }
    S.refMode = S.refMode === 'wischer' ? 'nachher' : 'wischer'; buildBA(); updateAmp(true); stat('emvref', 1, 'max'); if (S.tab !== 'rig') setTab('rig');
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
  $('#baBar').addEventListener('click', e => {
    const b = e.target.closest('[data-ba]'), m = e.target.closest('[data-bm]');
    if (m) { S.refMode = m.dataset.bm; buildBA(); updateAmp(true); stat('emvref', 1, 'max'); return; }
    if (!b) return; const a = b.dataset.ba;
    if (a === 'merk') merken(); else if (a === 'ghost') { S.ghost = !S.ghost; buildBA(); } else if (a === 'back') backToRef(); else if (a === 'clear') { setRef(null); toast('Vorher vergessen'); }
  });
  function updateWipeDom() { const wb = $('#wipeBar'); if (!wb) return; wb.style.setProperty('--wp', (S.wipe * 100).toFixed(2) + '%'); }
  (function () {
    const wb = $('#wipeBar'); if (!wb) return; let drag = null;
    const set = e => { const r = $('#cvw').getBoundingClientRect(); S.wipe = clamp((e.clientX - r.left) / Math.max(1, r.width), 0.03, 0.97); updateWipeDom(); };
    wb.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); drag = e.pointerId; try { wb.setPointerCapture(e.pointerId); } catch (x) {} set(e); });
    wb.addEventListener('pointermove', e => { if (drag === e.pointerId) set(e); });
    const up = e => { if (drag === e.pointerId) drag = null; };
    wb.addEventListener('pointerup', up); wb.addEventListener('pointercancel', up);
    wb.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); S.wipe = clamp(S.wipe + (e.key === 'ArrowLeft' ? -0.05 : 0.05), 0.03, 0.97); updateWipeDom(); } });
  })();

  /* ============================================================ Bedienpult aus rig.controls (nach Hebeln gruppiert, mehrere Instanzen synchron) */
  let panels = [];
  const slPos = (c, v) => { if (c.scale === 'log' && c.min > 0 && c.max > c.min) return Math.round(1000 * Math.log(clamp(v, c.min, c.max) / c.min) / Math.log(c.max / c.min)); return Math.round(1000 * (clamp(v, c.min, c.max) - c.min) / ((c.max - c.min) || 1)); };
  function slVal(c, pos) {
    let v = c.scale === 'log' && c.min > 0 && c.max > c.min ? c.min * Math.pow(c.max / c.min, pos / 1000) : c.min + (c.max - c.min) * pos / 1000;
    if (c.freqSnap !== false && c.unitKind === 'freq' && c.scale === 'log') { const lp = Math.log(v); for (const [f] of SNAPS) if (f >= c.min && f <= c.max && Math.abs(lp - Math.log(f)) < 0.012 * Math.log(c.max / c.min)) { v = f; break; } }
    if (c.step && c.scale !== 'log') v = Math.round(v / c.step) * c.step; else if (c.scale === 'log' && !SNAPS.some(s => s[0] === v)) { const d = fin(v) ? Math.pow(10, Math.floor(Math.log10(Math.max(1e-12, v))) - 2) : 0.01; v = Math.round(v / d) * d; }
    return clamp(+v.toPrecision(10), c.min, c.max);
  }
  const siUnit = c => !!(c.unit && SIBASE.test(c.unit));
  /* Anzeige: Werte in SI-Basiseinheit (Hz, F, H, Ω ...) mit Vorsatz (34,2 MHz), sonst in der Einheit des Reglers (mm, %, dB, V ...) */
  const ctlShow = (c, v) => (siUnit(c) && c.unitKind !== 'plain' ? fe(v, c.unit) : fnum(v, c.scale === 'log' ? adig(v) : decs(c.step)) + (c.unit ? ' ' + c.unit : ''));
  function ctlParse(c, text) {
    let t = String(text == null ? '' : text).trim(); if (!t) return NaN;
    if (siUnit(c)) return parseNum(t);
    if (c.unit && t.endsWith(c.unit)) t = t.slice(0, -c.unit.length).trim();
    const v = parseFloat(t.replace(/\s/g, '').replace(',', '.')); return fin(v) ? v : NaN;
  }
  function ctlHtml(c) {
    const k = esc(c.key), L = LEVERS[leverOf(c)], help = c.help ? `<small class="hp">${esc(c.help)}</small>` : '', lv = `data-lv="${leverOf(c)}" style="--lc:${L.color}"`;
    if (c.type === 'slider') {
      const snaps = c.unitKind === 'freq' && c.scale === 'log' ? SNAPS.filter(s => s[0] >= c.min && s[0] <= c.max) : [];
      return `<div class="ct" data-k="${k}" data-t="slider" ${lv}><div class="ctl"><span>${esc(c.label)}</span><span class="vi"><input class="num" inputmode="decimal" autocomplete="off" aria-label="${esc(c.label)}, Wert eingeben"></span></div>${help}<input type="range" min="0" max="1000" step="1" value="0" aria-label="${esc(c.label)}">${snaps.length ? `<div class="snaps">${snaps.map(s => `<button class="chip s" data-snap="${s[0]}">${s[1]}</button>`).join('')}</div>` : ''}</div>`;
    }
    if (c.type === 'switch') return `<div class="ct p0" data-k="${k}" data-t="switch" ${lv}><button class="sw" role="switch" aria-checked="false" aria-label="${esc(c.label)}"><span class="lab">${esc(c.label)}${help}</span><span class="tgl"><i></i></span></button></div>`;
    if (c.type === 'button') return `<div class="ct p0" data-k="${k}" data-t="button" ${lv}><button class="bt${c.key === 'fire' ? ' fire' : ''}">${c.key === 'fire' ? '💥 ' : ''}${esc(c.label)}${c.key === 'fire' ? '' : ' (halten)'}</button>${help ? `<div class="bth">${help}</div>` : ''}</div>`;
    if (c.type === 'select') {
      const o = c.options || [], long = o.some(x => String(x.label).length > 14) && o.length > 2;
      const body = o.length <= 4 && !long ? `<div class="seg">${o.map((x, i) => `<button data-i="${i}">${esc(x.label)}</button>`).join('')}</div>` : o.length <= 5 && o.length > 1 && o.every(x => String(x.label).length <= 26) ? `<div class="chips ctrlchips">${o.map((x, i) => `<button class="chip s" data-i="${i}">${esc(x.label)}</button>`).join('')}</div>` : `<select aria-label="${esc(c.label)}">${o.map((x, i) => `<option value="${i}">${esc(x.label)}</option>`).join('')}</select>`;
      return `<div class="ct" data-k="${k}" data-t="select" ${lv}><div class="ctl"><span>${esc(c.label)}</span></div>${help}${body}</div>`;
    }
    return '';
  }
  /* host: Behälter; filter: null (alle, nach Hebeln gruppiert) oder Liste von Schlüsseln (eine Karte) */
  function buildPanel(host, filter, title) {
    panels = panels.filter(p => p.host !== host && p.host.isConnected);
    if (!S.rig) { host.innerHTML = '<div class="card">' + placeholderHtml() + '</div>'; return; }
    const list = ctlsOf().filter(c => !filter || filter.includes(c.key)), groups = [], gm = {};
    list.forEach(c => { const lv = filter ? 'f' : leverOf(c), L = LEVERS[lv] || { name: title || 'Bedienung', color: '#8d99a6' }; if (!gm[lv]) { gm[lv] = { lv, n: filter ? (title || 'Bedienung') : L.name, color: L.color, sym: (LEVERS[lv] || {}).sym || '', items: [] }; groups.push(gm[lv]); } gm[lv].items.push(c); });
    if (!filter) groups.sort((a, b) => LEVER_ORDER.indexOf(a.lv) - LEVER_ORDER.indexOf(b.lv)); else groups.forEach(g => g.items.sort((a, b) => filter.indexOf(a.key) - filter.indexOf(b.key)));
    host.innerHTML = groups.map(g => `<details class="card ctg" open data-lv="${g.lv}" style="--lc:${g.color}"><summary>${g.sym ? `<i class="lsym">${g.sym}</i> ` : ''}${esc(g.n)}</summary><div class="cb">${g.items.map(ctlHtml).join('')}</div></details>`).join('');
    const els = {}; $$('.ct[data-k]', host).forEach(el => { els[el.dataset.k] = { el, t: el.dataset.t, last: undefined, vis: true }; });
    panels.push({ host, els }); if (!host.__emvWired) { host.__emvWired = true; wirePanel(host); } syncCtl(true);
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
        const inp = $('input[type=range]', el), num = $('.num', el), n = +v;
        if (fin(n)) { if (document.activeElement !== inp || force) inp.value = slPos(c, n); if (document.activeElement !== num || force) num.value = ctlShow(c, n); }
      } else if (c.type === 'switch') $('button', el).setAttribute('aria-checked', v ? 'true' : 'false');
      else if (c.type === 'button') $('button', el).classList.toggle('on', !!v);
      else if (c.type === 'select') {
        const o = c.options || [], i = o.findIndex(q => q.value === v || String(q.value) === String(v));
        $$('.seg button, .ctrlchips .chip', el).forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
        const sel = $('select', el); if (sel && i >= 0) sel.value = String(i);
      }
    }));
  }
  function doFire() {
    if (!S.rig || typeof S.rig.fire !== 'function') { toast('Hier gibt es nichts auszulösen: Das geht nur am Prüfstand ESD, Burst und Surge.'); return false; }
    if (S.readonly) return false;
    let r; try { r = S.rig.fire(); } catch (e) { console.error(e); return false; } if (r === false) return false;
    S.fired = true; S.lever = 'quelle'; S.leverT = performance.now(); updateChain(); if (!S.running) setRun(true, true);
    const kind = (() => { try { return S.rig.getControl('pruef'); } catch (e) { return ''; } })(); noteShot(kind);
    if (root.LochFX && !slowFx() && canSound()) try { root.LochFX.sound('zap', 0.3); } catch (e) {}
    readState(); updateAmp(true); updateMeters(0, true); return true;
  }
  function noteShot(kind) {
    const g = /^esd/.test(kind) ? 'esd' : kind === 'burst' ? 'burst' : kind === 'surge' ? 'surge' : null; if (!g) return;
    const a = lsGet('emv.shots', []), s = new Set(Array.isArray(a) ? a : []); s.add(g); lsSet('emv.shots', [...s]); stat('emvshots', s.size, 'max');
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

  /* ============================================================ Messgeräte aus rig.meters */
  let mEls = [];
  function buildMeters() {
    const H = $('#meters'); mEls = [];
    if (!S.rig) { H.innerHTML = ''; return; }
    const ms = metersOf();
    H.innerHTML = ms.map((m, i) => {
      const gauge = !S.digital && fin(+m.min) && fin(+m.max) && m.max > m.min;
      return gauge ? `<div class="mt" data-i="${i}" aria-label="${esc(m.label)}"><canvas></canvas><div class="lbl">${esc(m.label)}</div></div>` : `<div class="mt dg" data-i="${i}"><div class="lbl">${esc(m.label)}</div><div class="num"><span class="v">–</span><small>${esc(m.unit || '')}</small></div></div>`;
    }).join('');
    mEls = $$('.mt', H).map((el, i) => ({ el, m: ms[i], cv: $('canvas', el), v: $('.v', el), disp: null, drawn: null, txt: '', warn: false }));
  }
  const isWarn = (m, v) => (fin(+m.warnAbove) && v > +m.warnAbove) || (fin(+m.warnBelow) && v < +m.warnBelow);
  /* Farben der Zeigerinstrumente aus den Seitenvariablen (Hell und Dunkel) */
  let gpT = 0, gpV = null;
  function gaugePal() {
    const now = performance.now(); if (gpV && now - gpT < 800) return gpV; gpT = now; const cs = getComputedStyle(document.documentElement), q = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
    return (gpV = { track: q('--panel2', '#2c343e'), bad: q('--danger', '#ff5c5c'), acc: q('--accent', '#3b9eff'), mute: q('--mute', '#8d99a6'), fg: q('--fg', '#e8ecf0'), panel: q('--panel', '#222830'), badfg: q('--bad-fg', '#ff8a7a') });
  }
  function drawGauge(x, val) {
    const cvs = x.cv, m = x.m, w = cvs.clientWidth, h = cvs.clientHeight; if (!w || !h) return;
    const dpr = Math.min(2, root.devicePixelRatio || 1), W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; }
    const g = cvs.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); const K = gaugePal();
    const cx = w / 2, cy = h * 0.42, r = Math.min(w / 2 - 12, h * 0.36), a0 = Math.PI * 0.75, sw = Math.PI * 1.5, mn = +m.min, mx = +m.max;
    const ang = v => a0 + sw * clamp((v - mn) / (mx - mn), 0, 1);
    const warnV = fin(+m.warnAbove) ? +m.warnAbove : null, wl = isWarn(m, val);
    g.lineCap = 'butt'; g.lineWidth = 7; g.strokeStyle = K.track; g.beginPath(); g.arc(cx, cy, r, a0, a0 + sw); g.stroke();
    if (warnV != null && warnV < mx) { g.strokeStyle = K.bad; g.beginPath(); g.arc(cx, cy, r, ang(warnV), a0 + sw); g.stroke(); }
    if (fin(+m.warnBelow) && +m.warnBelow > mn) { g.strokeStyle = K.bad; g.beginPath(); g.arc(cx, cy, r, a0, ang(+m.warnBelow)); g.stroke(); }
    g.strokeStyle = K.acc; if (val > mn) { g.beginPath(); g.arc(cx, cy, r - 0.5, a0, ang(warnV != null ? Math.min(val, warnV) : val)); g.globalAlpha = 0.9; g.stroke(); g.globalAlpha = 1; }
    for (let i = 0; i <= 10; i++) { const a = a0 + sw * i / 10, len = i % 5 === 0 ? 9 : 5; g.strokeStyle = K.mute; g.lineWidth = i % 5 === 0 ? 1.6 : 1; g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6)); g.lineTo(cx + Math.cos(a) * (r - 6 - len), cy + Math.sin(a) * (r - 6 - len)); g.stroke(); }
    g.fillStyle = K.mute; g.font = '11px system-ui'; g.textAlign = 'center';
    const lab = v => fnum(v, Math.abs(v) >= 100 || Number.isInteger(v) ? 0 : 1);
    if (w >= 110) { g.fillText(lab(mn), cx - r * 0.72, cy + r * 0.72 + 13); g.fillText(lab(mx), cx + r * 0.72, cy + r * 0.72 + 13); }
    const a = ang(val); g.strokeStyle = wl ? K.bad : K.fg; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - Math.cos(a) * 6, cy - Math.sin(a) * 6); g.lineTo(cx + Math.cos(a) * (r - 11), cy + Math.sin(a) * (r - 11)); g.stroke();
    g.fillStyle = K.panel; g.strokeStyle = K.mute; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill(); g.stroke();
    g.fillStyle = wl ? K.badfg : K.fg; g.font = '700 ' + Math.max(11, Math.min(15, Math.round(w * 0.1))) + 'px system-ui'; g.fillText(fnum(val, m.digits == null ? 1 : m.digits) + (m.unit ? ' ' + m.unit : ''), cx, Math.min(h - 4, cy + r + (w >= 110 ? 15 : 13)));
  }
  function updateMeters(dt, force) {
    if (!S.rig || !mEls.length) return;
    let vals; try { vals = S.rig.readMeters() || {}; } catch (e) { return; }
    const k = Math.min(1, dt / 90);
    mEls.forEach(x => {
      const t = vals[x.m.key]; if (!fin(t)) return;
      if (x.cv) {
        if (x.disp == null || force) x.disp = t; else x.disp += (t - x.disp) * k;
        const rg = (x.m.max - x.m.min) || 1;
        if (force || x.drawn == null || Math.abs(x.disp - x.drawn) > rg * 0.0015 || Math.abs(t - x.disp) > rg * 0.0015) { x.drawn = x.disp; drawGauge(x, x.disp); }
      } else { const txt = fnum(t, x.m.digits == null ? 1 : x.m.digits); if (txt !== x.txt) { x.txt = txt; x.v.textContent = txt; } }
      const wn = isWarn(x.m, t); if (wn !== x.warn) { x.warn = wn; x.el.classList.toggle('warn', wn); }
    });
  }

  /* ============================================================ Zeichenfläche (Prüfstand), Zeigerereignisse, Qualitätsstufen */
  const cvs = $('#cv'), g2 = cvs.getContext('2d'), cvw = $('#cvw');
  let cw = 0, ch = 0, dpr = 1;
  const cvfx = document.createElement('canvas'); cvfx.id = 'cvfx'; cvfx.setAttribute('aria-hidden', 'true'); cvfx.style.pointerEvents = 'none'; cvw.appendChild(cvfx);
  const fxg = cvfx.getContext('2d'); let fxDrew = false;
  /* Handybreite: Die Szenen legen sich nach der echten Pixelgröße aus, ein hohes Bild gibt ihnen Platz für die Beschriftungen */
  const NARROW_AR = '5/6';
  function worldSz() { try { const w = S.rig && S.rig.worldSize && S.rig.worldSize(); if (w && w.w > 0 && w.h > 0) return w; } catch (e) {} return { w: 960, h: 600 }; }
  function fitCanvas() {
    const ws = worldSz(), narrow = (cvw.parentElement ? cvw.parentElement.clientWidth : 1000) < 600, ar = narrow ? NARROW_AR : ws.w + '/' + ws.h; if (cvw.style.aspectRatio !== ar) cvw.style.aspectRatio = ar;
    const w = cvw.clientWidth, h = cvw.clientHeight; if (!w || !h) return;
    dpr = Math.min(2, root.devicePixelRatio || 1); const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; }
    if (cvfx.width !== W || cvfx.height !== H) { cvfx.width = W; cvfx.height = H; }
    cw = w; ch = h;
  }
  if (root.ResizeObserver) new ResizeObserver(() => fitCanvas()).observe(cvw);
  root.addEventListener('resize', () => { fitCanvas(); redrawTab(); updateMeters(0, true); });
  const isDark = () => { const a = document.documentElement.getAttribute('data-theme'); if (a === 'dark') return true; if (a === 'light') return false; try { return !(root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches); } catch (e) { return true; } };
  const theme = () => (isDark() ? 'dark' : 'light');
  const bgOf = () => (getComputedStyle(document.documentElement).getPropertyValue('--cv') || '#14181c').trim();

  /* ---- Qualitätsstufen (SPEC 6.4): Bildzeit (gleitender Mittelwert über 30 Bilder) steuert eine Stufe zurück oder hoch ---- */
  const reduced = () => !!mqReduce.matches;
  const curQ = () => (reduced() ? 'niedrig' : S.q.mode === 'auto' ? S.q.level : S.q.mode);
  function qualityFeed(ms, now) {
    if (S.q.mode !== 'auto' || reduced() || !fin(ms)) return;
    const q = S.q; now = now == null ? performance.now() : now;
    q.ms.push(ms); if (q.ms.length > 30) q.ms.shift(); if (q.ms.length < 30) return;
    const avg = q.ms.reduce((a, b) => a + b, 0) / q.ms.length, i = QLEVELS.indexOf(q.level);
    if (avg > 22 && i < QLEVELS.length - 1 && now - q.lastSwitch > 800) { q.level = QLEVELS[i + 1]; q.lastSwitch = now; q.ms = []; q.fastSince = 0; updateQLine(true); }
    else if (avg < 10 && i > 0) { if (!q.fastSince) q.fastSince = now; if (now - q.fastSince > 3000) { q.level = QLEVELS[i - 1]; q.lastSwitch = now; q.ms = []; q.fastSince = 0; updateQLine(true); } }
    else q.fastSince = 0;
  }
  function setQMode(m) { if (!['auto', ...QLEVELS].includes(m)) return; S.q.mode = m; lsPut('emv.q', m); S.q.ms = []; S.q.fastSince = 0; updateQLine(true); }
  const hasFreqAnim = () => ctlsOf().some(c => c.unitKind === 'freq' && c.type === 'slider');
  let qSig = '';
  function updateQLine(force) {
    const el = $('#qLine'); if (!el) return;
    const hints = lsGet('emv.hint', []), hid = Array.isArray(hints) && hints.includes(S.rigId), fq = hasFreqAnim();
    const sig = [curQ(), S.q.mode, reduced(), fq, hid, S.rigId].join('|'); if (!force && sig === qSig) return; qSig = sig;
    el.innerHTML = `<span class="qv">Qualität: <b>${esc(curQ())}</b>${S.q.mode === 'auto' && !reduced() ? ' (automatisch)' : reduced() ? ' (Bewegung reduziert)' : ''}</span><button class="chip s" data-qc="1" aria-label="Qualitätsstufe wechseln" title="Qualität: automatisch, hoch, mittel, niedrig">⚙ ${esc(S.q.mode === 'auto' ? 'Auto' : S.q.mode)}</button>${fq ? '<span class="qv">Animation verlangsamt</span>' : ''}${hid ? '' : `<span class="qh" id="qHint">Übungsanlage: Zahlen sind Übungswerte. <button class="chip s" data-qh="1" aria-label="Hinweis schließen">✕</button></span>`}`;
  }
  $('#qLine').addEventListener('click', e => {
    if (e.target.closest('[data-qc]')) { const o = ['auto', ...QLEVELS], i = o.indexOf(S.q.mode); setQMode(o[(i + 1) % o.length]); toast('Qualität: ' + (S.q.mode === 'auto' ? 'automatisch' : S.q.mode)); }
    else if (e.target.closest('[data-qh]')) { const a = lsGet('emv.hint', []), s = new Set(Array.isArray(a) ? a : []); s.add(S.rigId); lsSet('emv.hint', [...s]); updateQLine(true); }
  });
  try { if (mqReduce.addEventListener) mqReduce.addEventListener('change', () => { updateQLine(true); updateChrome(); }); } catch (e) {}

  /* ---- Zeichnen: Vorher | Nachher | Wischer (SPEC 6.1, 8.2) ---- */
  function drawOpts() {
    const o = { quality: curQ(), reduced: reduced(), theme: theme(), ghost: null, wipe: null };
    if (S.ref && S.rig) { if (S.refMode === 'wischer') { o.ghost = S.ref; o.wipe = S.wipe; } else if (S.refMode === 'nachher' && S.ghost) o.ghost = S.ref; }
    return o;
  }
  function drawRig(ts) {
    if (!cw || cvw.offsetParent === null) return;
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.fillStyle = bgOf(); g2.fillRect(0, 0, cw, ch);
    if (!S.rig) { g2.fillStyle = '#8d99a6'; g2.font = '600 16px system-ui'; g2.textAlign = 'center'; g2.fillText('Prüfstand noch nicht geladen', cw / 2, ch / 2); return; }
    const r = S.ref && S.refRig && S.refMode === 'vorher' ? S.refRig : S.rig;
    try { r.draw(g2, cw, ch, ts, r === S.rig ? drawOpts() : { quality: curQ(), reduced: reduced(), theme: theme() }); }
    catch (e) { if (!drawErr) { drawErr = true; console.error('Zeichnung des Prüfstands:', e); } }
  }
  const cvPos = e => { const r = cvs.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const holdsC = new Map(); let drag = null;
  /* hitTest liefert { key, kind:'switch'|'select'|'button'|'slider'|'knob', to?, set? }: to = Zielwert (Antippen/Ziehen), set = mehrere Steuerwerte (Sonde) */
  function toggleCtl(key, value) {
    const def = ctlDef(key); if (!def || !S.rig) return;
    if (value !== undefined) { setCtl(key, value); return; }
    if (def.type === 'select') { const o = def.options || [], v = S.rig.getControl(key), i = o.findIndex(q => q.value === v || String(q.value) === String(v)); if (o.length) setCtl(key, o[(i + 1) % o.length].value); }
    else if (def.type === 'switch') setCtl(key, !S.rig.getControl(key));
  }
  function applyHit(h) {
    if (h.set && typeof h.set === 'object') { Object.keys(h.set).forEach(k => setCtl(k, h.set[k])); return true; }
    if (h.to !== undefined) { setCtl(h.key, h.to); return true; }
    return false;
  }
  cvs.addEventListener('pointerdown', e => {
    e.preventDefault(); const r = S.rig; if (!r) return; try { cvs.setPointerCapture(e.pointerId); } catch (x) {}
    const [x, y] = cvPos(e); if (!r.hitTest || S.readonly) return; let h = null; try { h = r.hitTest(x, y, cw, ch); } catch (er) {} if (!h || !h.key) return;
    const c = ctlDef(h.key); if (!c) return;
    if (h.key === 'fire' || (c.type === 'button' && h.key === 'fire')) { doFire(); return; }
    if (h.kind === 'button' || c.type === 'button') { holdsC.set(e.pointerId, h.key); setCtl(h.key, true); clickSnd('tick'); return; }
    if (h.kind === 'switch' || c.type === 'switch') { toggleCtl(h.key, h.to); clickSnd('click'); return; }
    if (c.type === 'select' && h.kind !== 'knob') { if (h.to !== undefined) setCtl(h.key, h.to); else toggleCtl(h.key); clickSnd('click'); return; }
    if (c.type === 'slider' || h.kind === 'knob') {
      let v0 = null; try { v0 = r.getControl(h.key); } catch (er) {}
      drag = { id: e.pointerId, key: h.key, x0: x, y0: y, c, pos0: c.type === 'slider' ? slPos(c, +v0) : 0, i0: c.type === 'select' ? (c.options || []).findIndex(q => q.value === v0) : 0, abs: h.to !== undefined || !!h.set };
      applyHit(h);
    }
  });
  const cvUp = e => { const k = holdsC.get(e.pointerId); if (drag && drag.id === e.pointerId) drag = null; if (k == null) return; holdsC.delete(e.pointerId); setCtl(k, false, true); };
  cvs.addEventListener('pointerup', cvUp); cvs.addEventListener('pointercancel', cvUp);
  cvs.addEventListener('pointermove', e => {
    const r = S.rig; if (!r) return; const [x, y] = cvPos(e);
    if (drag && drag.id === e.pointerId) {
      if (drag.abs && r.hitTest) { let h = null; try { h = r.hitTest(x, y, cw, ch); } catch (er) {} if (h && h.key === drag.key) applyHit(h); return; }
      const c = drag.c, d = (x - drag.x0) - (y - drag.y0);
      if (c.type === 'slider') setCtl(drag.key, slVal(c, clamp(drag.pos0 + d * 1000 / (0.55 * Math.min(cw, ch)), 0, 1000)));
      else { const o = c.options || [], i = clamp(drag.i0 + Math.round(d / 40), 0, o.length - 1); if (o[i]) setCtl(drag.key, o[i].value); }
      return;
    }
    if (e.pointerType !== 'mouse' || !r.hitTest) return; let h = null; try { h = r.hitTest(x, y, cw, ch); } catch (er) {} cvs.style.cursor = h ? 'pointer' : 'default';
  });
  cvs.addEventListener('contextmenu', e => e.preventDefault());

  /* ---- Effekte (alles über LochFX, geschützt); die Zuordnung Name → Effekt steht NUR hier ---- */
  const FXKINDS = { zap: 1, spark: 1, defekt: 1, smoke: 1, crash: 1, reset: 1, buzz: 1, alarm: 1, kazoo: 1, ding: 1, tick: 1 };
  let fxCool = {}, fxBudgetT = 0;
  function fxReset() { fxCool = {}; fxDrew = false; if (S.fx) S.fx = { amp: null, kazoo: false, flags: {} }; if (root.LochFX && root.LochFX.clear) try { root.LochFX.clear(); } catch (e) {} }
  const fxOn = () => !!(root.LochFX && !root.LochFX.isMuted());
  const slowFx = () => S.speed > 2 || S.speed < 1;
  function worldToPx(x, y) {
    const ws = worldSz(), s = Math.min(cw / ws.w, ch / ws.h);
    if (!fin(x) || !fin(y)) return [cw / 2, ch / 2];
    return [(cw - ws.w * s) / 2 + x * s, (ch - ws.h * s) / 2 + y * s];
  }
  function fxPlay(kind, vol, once) {
    const F = root.LochFX; if (!F || !fxOn() || !canSound()) return; if (slowFx() && kind !== 'ding') return;
    const ts = performance.now(), cd = once ? 1e9 : 900; if (ts - (fxCool[kind] || -1e9) < cd) return; fxCool[kind] = ts;
    try { F.sound(kind, vol == null ? 0.4 : vol); } catch (e) {}
  }
  function fxEvent(e, ts) {
    const F = root.LochFX; if (!F || !FXKINDS[e.fx] || !canSound()) return;
    const cd = (e.fx === 'tick' ? 150 : 1500); if (ts - (fxCool['e' + e.fx] || -1e9) < cd) return; fxCool['e' + e.fx] = ts;
    const sc = Math.max(14, Math.min(34, cw / 28)), x = cw * 0.5, y = ch * 0.5;
    try {
      if (e.fx === 'zap' || e.fx === 'spark') F.sound('zap', 0.3);
      else if (e.fx === 'defekt' || e.fx === 'smoke' || e.fx === 'crash') { F.sound('crash', 0.5); if (F.explode) F.explode(x, y, { part: 'GERÄT', why: 'Überlastet', kind: 'chip', color: '255,170,60', scale: sc * 0.7, sound: 'crash', at: () => [x, y] }); if (F.say && e.fx !== 'smoke') F.say('Das Gerät ist defekt. Setze den Prüfstand zurück.'); }
      else if (e.fx === 'reset' || e.fx === 'buzz') F.sound('buzz', 0.4);
      else if (e.fx === 'alarm') F.sound('alarm', 0.25);
      else if (e.fx === 'kazoo') F.sound('kazoo', 0.4);
      else if (e.fx === 'ding') F.sound('ding', 0.5);
      else if (e.fx === 'tick') F.sound('tick', 0.3);
    } catch (er) {}
  }
  function noteFault(e) {
    const key = S.rigId + ':' + (e.fx || String(e.text || '').slice(0, 28));
    const a = lsGet('emv.faults', []), s = new Set(Array.isArray(a) ? a : []); if (s.has(key)) return;
    s.add(key); lsSet('emv.faults', [...s]); stat('emvfault', s.size, 'max');
  }
  /* Ampelwechsel (SPEC 8.6): grün (nach nicht grün) → ding; Wechsel auf rot → alarm (leise), je Wechsel einmal; Kriterium C/Ausfall nach fire → crash */
  function fxAmpel(a) {
    if (!a || !S.fx) return; const k = ampKey(a.ampel), p = S.fx.amp; S.fx.amp = k; if (p == null || p === k) return;
    if (k === 'gruen' && p !== 'grau') fxPlay('ding', 0.5); else if (k === 'rot') fxPlay('alarm', 0.2);
    if (S.rigId === 'esd' && a.kriterium === 'Ausfall') fxPlay('crash', 0.5); else if (S.rigId === 'esd' && a.kriterium === 'B') fxPlay('buzz', 0.35);
  }
  /* neue Meldungen beobachten: Liste, Abzeichenstatistik, Effekte */
  function watchEvents(ts) {
    const r = S.rig; if (!r) return; const ev = r.events || []; let changed = false;
    for (let i = Math.max(0, ev.length - 30); i < ev.length; i++) {
      const e = ev[i]; if (!e || S.evSeen.has(e)) continue; S.evSeen.add(e); changed = true;
      if (e.kind === 'error' || (e.fx && FXKINDS[e.fx] && e.fx !== 'tick' && e.fx !== 'ding')) noteFault(e);
      if (e.kind === 'error') { S.faultUntil = performance.now() + 9000; S.faultText = String(e.text || ''); if (S.tab !== 'rig' && S.running) toast('⚠ ' + S.faultText); }
      if (e.fx && (S.speed <= 2 || ts - fxBudgetT > 700) && fxOn() && !slowFx()) { fxBudgetT = ts; fxEvent(e, ts); }
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
    const F = root.LochFX; if (!F) { toast('Effekte sind auf dieser Seite nicht geladen.'); return; } F.setMuted(fxOn()); lsPut('emv.fx', fxOn() ? '1' : '0'); palSig = ''; updateChrome(); toast(fxOn() ? 'Effekte und Ton an' : 'Ton aus');
    if (fxOn()) F.sound('ding', 0.5);
  }

  /* ---- Meldungsliste (Zeitstempel in Anlagenzeit) und Hinweise aus rig.diagnose() ---- */
  const tstamp = t => (fin(+t) ? fnum(+t, 1) + ' s' : '');
  function updateEvents(force) {
    const l = $('#evList'); if (!l) return; const ev = (S.rig && S.rig.events) || [];
    const sig = ev.length + '|' + (ev.length ? (ev[ev.length - 1].text || '') + (ev[ev.length - 1].t || '') : ''); if (!force && sig === S.evSig) return; S.evSig = sig;
    l.innerHTML = ev.length ? ev.slice(-40).reverse().map(x => `<li class="${esc(x.kind || 'info')}"><time>${esc(tstamp(x.t))}</time><span>${esc(x.text)}</span></li>`).join('') : '<li class="empty">Keine Meldungen. Meldet der Prüfstand etwas (zum Beispiel einen Reset des Geräts), steht es hier.</li>';
  }
  $('#evClr').onclick = () => { if (S.rig && S.rig.events) { S.rig.events.length = 0; S.evSig = ''; updateEvents(true); } };
  let lastDiag = 0;
  function updateDiag(force) {
    const el = $('#diagList'); if (!el || !S.rig) return;
    const now = performance.now(); if (!force && now - lastDiag < 400) return; lastDiag = now;
    let d = []; try { d = typeof S.rig.diagnose === 'function' ? (S.rig.diagnose() || []) : []; } catch (e) { d = []; }
    S.diag = d; d.forEach(x => { if (x && x.id && !S.diagSeen[x.id]) S.diagSeen[x.id] = 1; if (x && x.id === 'kabel-res') fxPlay('kazoo', 0.4, true); });
    const h = d.length ? d.map(x => `<li class="${esc(x.kind || 'info')}"><span class="dk" aria-hidden="true">${x.kind === 'error' ? '✗' : x.kind === 'warn' ? '!' : 'i'}</span><span>${esc(x.text)}</span></li>`).join('') : '<li class="empty">Keine Hinweise: Zu den aktuellen Einstellungen meldet der Prüfstand nichts.</li>';
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  }

  /* ============================================================ Simulation (Animationsphase, Partikel, Impulsfolge; Ablauf live) */
  function setRun(on, auto) {
    if (on && !S.rig) { toast('Der Prüfstand ist noch nicht geladen.'); return; }
    S.running = !!on; updateChrome();
    if (on) { stat('emvrun', 1, 'max'); usedRig(); if (auto && !lsRaw('emv.autohint', '')) { lsPut('emv.autohint', '1'); toast('Die Animation läuft jetzt. Mit ⏸ unten hältst du sie an.'); } }
  }
  function resetRig(quiet) {
    if (!S.rig) return;
    try { S.rig.reset(); } catch (e) { console.error(e); }
    const keepRef = S.ref; resetRun(); S.ctl = {}; S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; fxReset(); S.ref = keepRef; buildRefRig();
    readState(); syncCtl(true); updateMeters(0, true); updateEvents(true); updateDiag(true); updateAmp(true); updateChrome(); renderSweepLive(); extRefresh(); if (!quiet) toast('Prüfstand zurückgesetzt');
  }
  function setSpeed(v) { if (!SPEEDS.includes(v)) return; S.speed = v; lsPut('emv.speed', String(v)); palSig = ''; updateChrome(); }
  /* geplanten Ablauf im Prüfstand ausführen (Zeit in Sekunden Demo-Zeit): Setzen, Rampen (Frequenz logarithmisch), Auslösen */
  function liveApply() {
    const L = S.live; if (!L) return;
    while (L.i < L.steps.length && L.steps[L.i].t <= L.t + 1e-9) {
      const st = L.steps[L.i++];
      if (st.set) Object.keys(st.set).forEach(k => setCtl(k, st.set[k], true));
      if (st.ramp) { let from = NaN; try { from = +S.rig.getControl(st.ramp.key); } catch (e) {} L.ramps.push({ key: st.ramp.key, from, to: +st.ramp.to, t0: st.t, d: Math.max(1e-9, +st.ramp.durS || 1e-9), log: (ctlDef(st.ramp.key) || {}).unitKind === 'freq' }); }
      if (st.fire) doFire();
    }
    L.ramps = L.ramps.filter(r => {
      const f = clamp((L.t - r.t0) / r.d, 0, 1);
      if (fin(r.from)) { const v = r.log && r.from > 0 && r.to > 0 ? r.from * Math.pow(r.to / r.from, f) : r.from + (r.to - r.from) * f; setCtl(r.key, v, true); }
      return f < 1;
    });
  }
  function simAdvance(dtMs) {
    const r = S.rig; if (!r) return; const d = dtMs * S.speed;
    if (S.live) { S.live.t += d / 1000; liveApply(); if (S.live && S.live.t >= S.live.end) seqLiveDone(); }
    try { r.step(d); } catch (e) { throw e; }
    if (S.ref && S.refRig && S.refMode === 'vorher') { try { S.refRig.step(d); } catch (e) {} }
    S.simT += d / 1000;
  }
  function updateStat() {
    const sEl = $('#stat'); if (!sEl) return;
    const html = (S.running ? '<b class="run" style="color:var(--ok)">LÄUFT</b> ' : '<b>PAUSE</b> ') + 'Zeit ' + fnum(S.simT, 1) + ' s' + (S.speed !== 1 ? ' · ×' + String(S.speed).replace('.', ',') : '');
    if (sEl.dataset.h !== html) { sEl.dataset.h = html; sEl.innerHTML = html; }
  }
  /* Ergebnisse (Ampelwechsel, Statistik) regelmäßig aus dem Prüfstand lesen */
  function watchState() {
    const a = assessOf(S.rig); if (!a) return; fxAmpel(a);
    const k = ampKey(a.ampel); if (k === 'gruen' && S.rigId === 'vorpruef') stat('emvgruen', 1, 'max');
  }

  /* ============================================================ CSV (Spektrum), PNG, Druck */
  function csvNum(v) { return fin(v) ? String(+(+v).toPrecision(9)).replace('.', ',') : ''; }
  /* Spektrum als CSV: Kopf, dann Frequenz in Hz; Pegel in dBµV (bzw. dBµV/m); Gleichtakt und Gegentakt, wenn vorhanden */
  function csvText() {
    let sp = null; try { sp = S.rig && typeof S.rig.spectrum === 'function' ? S.rig.spectrum() : null; } catch (e) { sp = null; }
    const unit = (sp && sp.unit) || 'dBµV';
    let head = '# Tonfunk EMV-Lab;' + S.name + ';' + (S.rig ? rigName(S.rigId) : '') + ';Übungswerte\r\nFrequenz in Hz;Pegel in ' + unit + ';Gleichtakt in ' + unit + ';Gegentakt in ' + unit;
    if (!sp || !Array.isArray(sp.lines)) {
      const cv = S.rig && S.rig.curves ? (S.rig.curves() || [])[0] : null; if (!cv) return '';
      const rows = []; (cv.series || []).forEach(s => (s.points || []).forEach(p => rows.push([csvNum(p[0]), csvNum(p[1]), '', ''].join(';')))); return '# Tonfunk EMV-Lab;' + S.name + ';' + (cv.title || '') + ';Übungswerte\r\nFrequenz in Hz;' + (cv.yLabel || 'Wert') + ' in ' + (cv.yUnit || '') + ';;\r\n' + rows.join('\r\n') + '\r\n';
    }
    return head + '\r\n' + sp.lines.map(l => [csvNum(l.f), csvNum(l.L), csvNum(l.Lcm), csvNum(l.Ldm)].join(';')).join('\r\n') + '\r\n';
  }
  function parseCsv(txt) {
    const out = []; String(txt || '').split(/\r?\n/).forEach(ln => {
      if (!ln || ln[0] === '#' || /^Frequenz/.test(ln)) return; const c = ln.split(';'), n = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return fin(x) ? x : null; };
      const f = n(c[0]), L = n(c[1]); if (f != null && L != null) out.push({ f, L, Lcm: n(c[2]), Ldm: n(c[3]) });
    });
    return out;
  }
  function saveCsv(txt, fallbackName) {
    const blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' });
    if (root.LabExport && root.LabExport.saveBlob) { try { root.LabExport.saveBlob(blob, root.LabExport.fname ? root.LabExport.fname('csv') : fallbackName); return; } catch (e) {} }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fallbackName; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportCsv() { const t = csvText(); if (!t) { toast('Dieser Prüfstand hat kein Spektrum zum Exportieren.'); return; } saveCsv(t, 'emv-spektrum.csv'); stat('csv'); toast('CSV gespeichert'); }
  function rigPng(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = bgOf(); x.fillRect(0, 0, w, h); try { if (S.rig) S.rig.draw(x, w, h, 0, { quality: 'hoch', reduced: true, theme: theme() }); } catch (e) {} return c;
  }
  function exportPng() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    const c = rigPng(1600, 1000);
    c.toBlob(b => { if (b && root.LabExport) { root.LabExport.saveBlob(b, root.LabExport.fname('png')); stat('png'); } else toast('Bild konnte nicht erzeugt werden'); }, 'image/png');
  }
  function printNow() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    const c = rigPng(1200, 750), who = lsRaw('lm4.name', ''), vals = allCtl(); let mv = {}; try { mv = S.rig.readMeters(); } catch (e) {} const a = assessOf(S.rig) || {};
    const cv = ctlsOf().filter(x => x.type !== 'button').map(x => { const v = vals[x.key]; let t = v; if (x.type === 'switch') t = v ? 'EIN' : 'AUS'; else if (x.type === 'select') { const o = (x.options || []).find(q => q.value === v || String(q.value) === String(v)); t = o ? o.label : v; } else t = ctlShow(x, v); return `<tr><td>${esc(LEVERS[leverOf(x)].name)}</td><td>${esc(x.label)}</td><td>${esc(t)}</td></tr>`; }).join('');
    const mt = metersOf().map(m => `<tr><td>${esc(m.label)}</td><td>${fnum(mv[m.key], m.digits == null ? 1 : m.digits)} ${esc(m.unit || '')}</td></tr>`).join('');
    const ev = ((S.rig.events) || []).slice(-15).map(e => `<tr><td>${esc(tstamp(e.t))}</td><td>${esc(e.text)}</td></tr>`).join('');
    const rows = curRows().map(r => `<tr><td>${fnum(r.t, 1)} s</td><td>${esc(rowText(r))}</td></tr>`).join('');
    $('#printArea').innerHTML = `<div class="proto"><h1>${esc(S.name)}</h1><p>Prüfstand: ${esc(rigName(S.rigId))} · ${new Date().toLocaleDateString('de-DE')}${who ? ' · ' + esc(who) : ''} · Übungsanlage: Zahlen sind Übungswerte</p>
      <h2>Prüfstand</h2><img src="${c.toDataURL('image/png')}" alt="">
      <h2>Ampel</h2><p>${esc((AMP[ampKey(a.ampel)] || AMP.grau).sym + ' ' + (AMP[ampKey(a.ampel)] || AMP.grau).name)}${fin(a.margin) ? ', Marge ' + fnum(a.margin, 1) + ' dB' : ''}. ${esc(a.text || '')}</p>
      <h2>Einstellungen</h2><table><tr><th>Hebel</th><th>Steuerwert</th><th>Wert</th></tr>${cv}</table>
      <h2>Messwerte</h2><table><tr><th>Messgerät</th><th>Wert</th></tr>${mt}</table>
      ${rows ? `<h2>Ablauf</h2><table><tr><th>Zeit</th><th>Aktion</th></tr>${rows}</table>` : ''}
      ${ev ? `<h2>Meldungen</h2><table><tr><th>Zeit</th><th>Meldung</th></tr>${ev}</table>` : ''}</div>`;
    setTimeout(() => window.print(), 80);
  }

  /* ============================================================ Sweep und Ablauf (eingeklappte Zeile im Tab Prüfstand, Läufer EMV_CORE.runSeq) */
  const rowEnd = r => (+r.t || 0) + (r.kind === 'ramp' ? (+r.dur || 0) : 0);
  const seqDur = () => { const d = S.seqDur && S.seqDur[S.rigId]; if (fin(d) && d > 0) return d; const rs = curRows(); return Math.max(10, rs.reduce((m, r) => Math.max(m, rowEnd(r)), 0) * 1.25); };
  const defVal = c => (c.type === 'switch' || c.type === 'button' ? !!c.value : c.type === 'select' ? (c.value !== undefined ? c.value : (c.options && c.options[0] ? c.options[0].value : '')) : (c.value != null ? c.value : c.min));
  const seqKeys = () => ctlsOf().filter(c => c.type !== 'button');
  const canFire = () => !!(S.rig && typeof S.rig.fire === 'function' && hasCtl('fire'));
  const optLabel = (c, v) => { const o = (c.options || []).find(q => q.value === v || String(q.value) === String(v)); return o ? o.label : String(v); };
  const valText = (c, v) => (!c ? String(v) : c.type === 'switch' ? (v ? 'EIN' : 'AUS') : c.type === 'select' ? optLabel(c, v) : ctlShow(c, +v));
  function rowText(r) {
    if (r.kind === 'fire') return 'löse die Entladung aus';
    const c = ctlDef(r.key), nm = c ? c.label : r.key;
    return r.kind === 'ramp' ? 'ändere ' + nm + ' in ' + fnum(r.dur, 1) + ' s auf ' + valText(c, r.to) : 'setze ' + nm + ' = ' + valText(c, r.value);
  }
  function newRow() {
    const rs = curRows(), c = seqKeys()[0]; if (!c) return null;
    const last = rs.length ? rs[rs.length - 1] : null, t = last ? +(rowEnd(last) + 1).toPrecision(6) : 1;
    return { t, kind: 'set', key: c.key, value: defVal(c) };
  }
  /* Zeilen → Läufer-Format (Sekunden): { t, set:{key:Wert} }, { t, ramp:{key,to,durS} }, { t, fire:true } */
  function seqSteps(rows) {
    const m = new Map(), other = [];
    (rows || []).forEach(r => {
      if (!r) return; const t = Math.round(Math.max(0, +r.t || 0) * 1e6) / 1e6;
      if (r.kind === 'fire') { other.push({ t, fire: true }); return; }
      const c = ctlDef(r.key); if (!c) return;
      if (r.kind === 'ramp') { const to = coerce(c, r.to != null ? r.to : r.value); if (to !== undefined && c.type === 'slider') other.push({ t, ramp: { key: r.key, to, durS: Math.max(1e-6, +r.dur || 0) } }); return; }
      if (!m.has(t)) m.set(t, {}); m.get(t)[r.key] = r.value;
    });
    return [...m.entries()].map(([t, set]) => ({ t, set })).concat(other).sort((a, b) => a.t - b.t);
  }
  function seqToRows(seq) {
    const rows = []; if (!Array.isArray(seq)) return rows;
    seq.forEach(s => {
      if (!s) return;
      if (s.fire) rows.push({ t: +s.t || 0, kind: 'fire' });
      if (s.ramp && typeof s.ramp === 'object' && s.ramp.key != null) rows.push({ t: +s.t || 0, kind: 'ramp', key: s.ramp.key, to: +s.ramp.to, dur: +s.ramp.durS || 0 });
      if (s.set && typeof s.set === 'object') Object.keys(s.set).forEach(k => rows.push({ t: +s.t || 0, kind: 'set', key: k, value: s.set[k] }));
      else if (s.key != null) rows.push({ t: +s.t || 0, kind: 'set', key: s.key, value: s.value });
    });
    return rows;
  }
  const rowNorm = rows => (rows || []).filter(r => r && typeof r === 'object').map(r => (r.kind === 'fire' ? { t: +r.t || 0, kind: 'fire' } : r.kind === 'ramp' ? { t: +r.t || 0, kind: 'ramp', key: r.key, to: +r.to, dur: +r.dur || 0 } : { t: +r.t || 0, kind: 'set', key: r.key, value: r.value }));
  function valueEd(r, i) {
    const c = ctlDef(r.key); if (!c) return '<span class="hint2">Steuerwert unbekannt</span>';
    const v = r.kind === 'ramp' ? r.to : r.value;
    if (c.type === 'slider') return `<span class="vv"><input class="vIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${esc(ctlShow(c, +v))}" aria-label="Wert"></span>`;
    if (c.type === 'switch') return `<select class="vSel" data-i="${i}" aria-label="Wert"><option value="1"${r.value ? ' selected' : ''}>EIN</option><option value="0"${r.value ? '' : ' selected'}>AUS</option></select>`;
    const o = c.options || [], cur = o.findIndex(x => x.value === r.value || String(x.value) === String(r.value));
    return `<select class="vSel" data-i="${i}" aria-label="Wert">${o.map((x, j) => `<option value="${j}"${j === cur ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`;
  }
  function rowHtml(r, i, n) {
    const keys = seqKeys(), c = ctlDef(r.key), canRamp = c && c.type === 'slider', ramp = r.kind === 'ramp', fire = r.kind === 'fire';
    const kinds = `<option value="set"${r.kind === 'set' ? ' selected' : ''}>setze</option>${canRamp || ramp ? `<option value="ramp"${ramp ? ' selected' : ''}>ändere bis</option>` : ''}${canFire() ? `<option value="fire"${fire ? ' selected' : ''}>löse aus</option>` : ''}`;
    return `<div class="sqr" data-i="${i}"><span class="n">${i + 1}</span><label class="tb"><small>nach</small><input class="tIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${fnum(r.t, adig(r.t))}" aria-label="Zeit in Sekunden"> <small>s</small></label>
      <select class="kdSel" data-i="${i}" aria-label="Art">${kinds}</select>
      ${fire ? '<span class="vb hint2">Entladung (nur ESD, Burst und Surge)</span>' : `<select class="kSel" data-i="${i}" aria-label="Steuerwert">${keys.map(k => `<option value="${esc(k.key)}"${k.key === r.key ? ' selected' : ''}>${esc(k.label)}</option>`).join('')}</select><span class="vb">${valueEd(r, i)}</span>`}${ramp ? `<label class="tb"><small>in</small><input class="dIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${fnum(r.dur, adig(r.dur || 1))}" aria-label="Dauer der Änderung in Sekunden"> <small>s</small></label>` : ''}
      <span class="ac"><button class="ib2" data-a="up" data-i="${i}" aria-label="Nach oben"${i === 0 ? ' disabled' : ''}>↑</button><button class="ib2" data-a="dn" data-i="${i}" aria-label="Nach unten"${i === n - 1 ? ' disabled' : ''}>↓</button><button class="ib2" data-a="del" data-i="${i}" aria-label="Löschen">🗑</button></span></div>`;
  }
  const freqCtls = () => ctlsOf().filter(c => c.type === 'slider' && c.unitKind === 'freq');
  function renderSweep() {
    const V = $('#sweepView'); if (!V) return;
    if (!S.rig) { V.innerHTML = placeholderHtml(); return; }
    const rs = curRows(), fk = freqCtls(), sw = S.sweepForm || (S.sweepForm = {});
    const f0 = fk[0], key = (sw.key && fk.some(c => c.key === sw.key)) ? sw.key : (f0 && f0.key), fc = key && ctlDef(key);
    V.innerHTML = `<p class="hint2" style="margin:0 0 8px">Jede Zeile heißt: <b>nach … s</b> (Anlagenzeit) wird ein Steuerwert gesetzt oder in einer Rampe verändert${canFire() ? ' oder die Entladung ausgelöst' : ''}. So fährst du Frequenz-Sweeps oder Maßnahmen nacheinander, ohne selbst zu drücken.</p>
      ${fc ? `<div class="frm sweepf"><label class="f"><span>Sweep: Steuerwert</span><select id="swKey">${fk.map(c => `<option value="${esc(c.key)}"${c.key === key ? ' selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>
        <label class="f"><span>von</span><input id="swFrom" inputmode="decimal" autocomplete="off" value="${esc(sw.from != null ? sw.from : ctlShow(fc, fc.min))}"></label>
        <label class="f"><span>bis</span><input id="swTo" inputmode="decimal" autocomplete="off" value="${esc(sw.to != null ? sw.to : ctlShow(fc, fc.max))}"></label>
        <label class="f"><span>Dauer in s</span><input id="swDur" inputmode="decimal" autocomplete="off" value="${esc(sw.dur != null ? sw.dur : '8')}"></label></div>
        <div class="btns"><button class="btn" data-q="sweep">➕ Sweep als Zeilen eintragen</button></div>` : ''}
      <div class="chips"><button class="chip s on" data-q="add">➕ Zeile</button><button class="chip s" data-q="ex">📖 Beispiel-Ablauf</button><button class="chip s danger" data-q="clr"${rs.length ? '' : ' disabled'}>🗑 Leeren</button></div>
      <div id="sqRows">${rs.length ? rs.map((r, i) => rowHtml(r, i, rs.length)).join('') : '<p class="hint2" style="padding:8px 4px">Noch keine Zeilen. Tippe auf „Zeile“, trage einen Sweep ein oder lade ein Beispiel.</p>'}</div>
      <div class="frm" style="margin-top:10px"><label class="f"><span>Dauer des Ablaufs in s</span><input id="sqDur" inputmode="decimal" autocomplete="off" value="${fnum(seqDur(), adig(seqDur()))}"></label><label class="chk"><input type="checkbox" id="sqCur"${S.seqCur === false ? '' : ' checked'}> mit den aktuellen Steuerwerten des Prüfstands starten</label></div>
      <div class="readout" id="sqLiveRead" aria-live="polite"></div>
      <div class="btns"><button class="btn pri" data-q="bg"${rs.length ? '' : ' disabled'}>▶ Berechnen (Ampelband)</button><button class="btn" data-q="live"${rs.length ? '' : ' disabled'}>▶ Live im Prüfstand</button><button class="btn danger" data-q="stop">■ Stopp</button></div><div id="sqRes"></div>`;
    renderSeqRes(); renderSweepLive();
  }
  function seqRunBg() {
    if (!S.rig) return; const steps = seqSteps(curRows()), end = seqDur(), id = S.rigId, d = defOf(id), C = CORE();
    if (!steps.length) { toast('Der Ablauf ist leer.'); return; }
    if (!C || typeof C.runSeq !== 'function') { toast('Der Läufer ist nicht geladen (emvcore.js fehlt).'); return; }
    toast('Berechne den Ablauf …');
    setTimeout(() => {
      const o = { seed: 1, sampleS: Math.max(0.05, end / 200) }; if (S.seqCur !== false) o.controls = allCtl();
      let res = null; try { res = C.runSeq(() => d.create({ seed: 1 }), steps, end, o); } catch (e) { console.error('runSeq:', e); res = null; }
      const fin2 = r => {
        if (!r || !Array.isArray(r.samples) || !r.samples.length) { toast('Der Ablauf konnte nicht berechnet werden.'); return; }
        S.seqRes = { samples: r.samples, final: r.final || {}, events: r.events || [], faults: r.faults || [], errors: r.errors || [], rejected: r.rejected || [], assess: r.assess || null, end, rigId: id, steps };
        stat('emvseq', 1, 'max'); renderSeqRes(); const el = $('#sqRes'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
      if (res && typeof res.then === 'function') res.then(fin2, () => fin2(null)); else fin2(res);
    }, 30);
  }
  function seqLive() {
    if (!S.rig) return; const steps = seqSteps(curRows());
    if (!steps.length) { toast('Der Ablauf ist leer.'); return; }
    const keep = S.seqCur !== false ? allCtl() : null;
    resetRig(true); if (keep) applyCtl(keep);
    readState(); S.live = { steps, i: 0, t: 0, end: seqDur(), ramps: [] }; setRun(true); renderSweepLive(); toast('Der Ablauf läuft live. Oben siehst du die Animation.');
  }
  function seqLiveDone() { S.live = null; stat('emvseq', 1, 'max'); toast('Ablauf beendet'); renderSweepLive(); }
  function seqStop() { if (S.live) { S.live = null; S.running = false; updateChrome(); toast('Ablauf gestoppt'); renderSweepLive(); } else if (S.running) setRun(false); }
  function renderSweepLive() {
    const rd = $('#sqLiveRead'); if (!rd) return; const rows = $$('.sqr');
    rows.forEach(r => r.classList.remove('cur'));
    if (S.live && S.rig) {
      const txt = `Live: Zeit <b>${fnum(S.live.t, 1)} s</b> von ${fnum(S.live.end, 1)} s`; if (rd.dataset.h !== txt) { rd.dataset.h = txt; rd.innerHTML = txt; }
      const last = S.live.steps[Math.max(0, S.live.i - 1)]; if (last && S.live.i > 0) rows.forEach(r => { const row = curRows()[+r.dataset.i]; if (row && Math.abs((+row.t || 0) - last.t) < 1e-6) r.classList.add('cur'); });
    } else if (rd.dataset.h) { rd.dataset.h = ''; rd.innerHTML = ''; }
  }
  /* Ergebnis: Ampelband in Abschnitten (Symbol und Text, nie nur Farbe) und Messgeräte am Ende */
  function bandOf(R) {
    const out = []; (R.samples || []).forEach(s => {
      const st = s.state || {}, k = ampKey(st.ampel), last = out[out.length - 1];
      if (last && last.k === k) { last.t1 = s.t; if (fin(st.margin)) last.m = fin(last.m) ? Math.min(last.m, st.margin) : st.margin; } else out.push({ k, t0: s.t, t1: s.t, m: fin(st.margin) ? st.margin : null });
    });
    return out;
  }
  function renderSeqRes() {
    const el = $('#sqRes'); if (!el) return; const R = S.seqRes;
    if (!R || R.rigId !== S.rigId) { el.innerHTML = ''; return; }
    const band = bandOf(R), faults = (R.faults || []).map(f => (typeof f === 'string' ? f : f && (f.text || f.msg || f.name)) || '').filter(Boolean), evs = (R.events || []).slice(-20), fm = (R.final && R.final.meters) || {};
    const tot = Math.max(1e-9, R.end), a = R.assess || (R.final && R.final.assess) || null;
    el.innerHTML = `<div class="card pl"><h4>Ergebnis des Ablaufs</h4>
      <div class="bandbar" role="img" aria-label="Ampelband über die Zeit">${band.map(b => `<i class="bd-${b.k}" style="flex:${Math.max(0.5, (b.t1 - b.t0) / tot * 100).toFixed(2)}" title="${esc(AMP[b.k].name)}">${AMP[b.k].sym}</i>`).join('')}</div>
      <ul class="tl">${band.map(b => `<li class="${AMP[b.k].cls === 'ok' ? 'ok' : AMP[b.k].cls === 'bad' ? 'bad' : ''}">${AMP[b.k].sym} ${fnum(b.t0, 1)} s bis ${fnum(b.t1, 1)} s: ${esc(AMP[b.k].name)}${fin(b.m) ? ', kleinste Marge ' + fnum(b.m, 1) + ' dB' : ''}</li>`).join('')}</ul>
      ${a ? `<p style="margin:6px 0 0"><b>Am Ende:</b> ${esc((AMP[ampKey(a.ampel)] || AMP.grau).sym)} ${esc((AMP[ampKey(a.ampel)] || AMP.grau).name)}${fin(a.margin) ? ', Marge ' + fnum(a.margin, 1) + ' dB' : ''}. ${esc(a.text || '')}</p>` : ''}
      <table class="kt"><tr><th>Messgerät am Ende</th><th class="n">Wert</th></tr>${metersOf().map(m => `<tr><td>${esc(m.label)}</td><td class="n"><b>${fnum(fm[m.key], m.digits == null ? 1 : m.digits)}</b> ${esc(m.unit || '')}</td></tr>`).join('')}</table>
      ${R.errors && R.errors.length ? `<p style="color:var(--warn);margin:6px 0 0"><b>Hinweis zum Ablauf:</b> ${R.errors.map(x => esc(typeof x === 'string' ? x : x && x.text || '')).join(' ')}</p>` : ''}
      ${faults.length ? `<p style="color:var(--danger);margin:6px 0 0"><b>Fehler im Ablauf:</b> ${faults.map(esc).join('; ')}</p>` : '<p class="hint2" style="margin:6px 0 0">Keine Fehler im Ablauf.</p>'}
      ${evs.length ? `<ul class="ev" style="padding:0">${evs.map(x => `<li class="${esc(x.kind || 'info')}"><time>${esc(tstamp(x.t))}</time><span>${esc(x.text)}</span></li>`).join('')}</ul>` : ''}</div>`;
  }
  (function () {
    const V = $('#sweepView');
    V.addEventListener('click', async e => {
      const q = e.target.closest('[data-q]'), a = e.target.closest('[data-a]'); const rs = curRows();
      if (q) {
        const k = q.dataset.q;
        if (k === 'add') { const r = newRow(); if (r) { rs.push(r); S.dirty = true; renderSweep(); saveCurSoon(); } }
        else if (k === 'clr') { if (await confirmSheet('Ablauf leeren?', 'Alle Zeilen werden gelöscht.', 'Leeren', true)) { rs.length = 0; S.seqRes = null; S.dirty = true; renderSweep(); saveCurSoon(); } }
        else if (k === 'ex') { const ex = exampleList().filter(x => x.rows && x.rows.length && x.rig === S.rigId); if (!ex.length) { toast('Für diesen Prüfstand gibt es noch keine Beispiel-Abläufe.'); return; } const v = await pick('Beispiel-Ablauf', ex.map((x, i) => ({ value: i, label: x.name, sub: x.desc || '' }))); if (v != null) loadExample(ex[v]); }
        else if (k === 'sweep') sweepAdd();
        else if (k === 'bg') seqRunBg(); else if (k === 'live') seqLive(); else if (k === 'stop') seqStop();
      } else if (a) {
        const i = +a.dataset.i;
        if (a.dataset.a === 'del') rs.splice(i, 1); else if (a.dataset.a === 'up' && i > 0) [rs[i - 1], rs[i]] = [rs[i], rs[i - 1]]; else if (a.dataset.a === 'dn' && i < rs.length - 1) [rs[i + 1], rs[i]] = [rs[i], rs[i + 1]];
        S.dirty = true; renderSweep(); saveCurSoon();
      }
    });
    V.addEventListener('change', e => {
      const t = e.target, rs = curRows(), i = +t.dataset.i, sw = S.sweepForm || (S.sweepForm = {});
      if (t.id === 'swKey') { sw.key = t.value; sw.from = sw.to = null; renderSweep(); return; }
      if (t.id === 'swFrom') { sw.from = t.value; return; } if (t.id === 'swTo') { sw.to = t.value; return; } if (t.id === 'swDur') { sw.dur = t.value; return; }
      if (t.id === 'sqCur') { S.seqCur = t.checked; return; }
      if (t.id === 'sqDur') { const v = parseNum(t.value); S.seqDur[S.rigId] = fin(v) && v > 0 ? Math.min(3600, v) : null; t.value = fnum(seqDur(), adig(seqDur())); S.dirty = true; return; }
      if (!rs[i]) return; const r = rs[i];
      if (t.classList.contains('tIn')) { const v = parseNum(t.value); r.t = fin(v) && v >= 0 ? +v.toPrecision(8) : r.t; t.value = fnum(r.t, adig(r.t)); }
      else if (t.classList.contains('dIn')) { const v = parseNum(t.value); r.dur = fin(v) && v >= 0 ? +v.toPrecision(8) : r.dur; t.value = fnum(r.dur, adig(r.dur || 1)); }
      else if (t.classList.contains('kdSel')) {
        if (t.value === 'fire') { r.kind = 'fire'; delete r.key; delete r.value; delete r.to; delete r.dur; }
        else { if (!r.key) r.key = (seqKeys()[0] || {}).key; const c = ctlDef(r.key); if (t.value === 'ramp' && c && c.type === 'slider') { r.kind = 'ramp'; r.to = fin(+r.value) ? +r.value : defVal(c); r.dur = r.dur || 2; delete r.value; } else { r.kind = 'set'; r.value = r.to != null ? r.to : defVal(c); delete r.to; delete r.dur; } }
        renderSweep();
      }
      else if (t.classList.contains('kSel')) { r.key = t.value; const c = ctlDef(t.value); if (r.kind === 'ramp' && !(c && c.type === 'slider')) { r.kind = 'set'; delete r.to; delete r.dur; } if (r.kind === 'ramp') r.to = c ? defVal(c) : 0; else r.value = c ? defVal(c) : 0; renderSweep(); }
      else if (t.classList.contains('vSel')) { const c = ctlDef(r.key); if (c) r.value = c.type === 'select' ? (c.options || [])[+t.value].value : t.value === '1'; }
      else if (t.classList.contains('vIn')) { const c = ctlDef(r.key); const v = ctlParse(c, t.value); if (c && fin(v)) { const cv0 = clamp(v, c.min, c.max); if (r.kind === 'ramp') r.to = cv0; else r.value = cv0; } const cur = r.kind === 'ramp' ? r.to : r.value; t.value = c ? ctlShow(c, cur) : String(cur); }
      S.dirty = true; saveCurSoon();
    });
  })();
  /* Sweep als zwei Zeilen: setze von (nach dem letzten Schritt), dann Rampe nach bis; Zeitachse logarithmisch (Frequenz), wie im Läufer */
  function sweepAdd() {
    const fk = freqCtls(), sw = S.sweepForm || (S.sweepForm = {}), c = ctlDef(sw.key && fk.some(x => x.key === sw.key) ? sw.key : fk[0] && fk[0].key); if (!c) { toast('An diesem Prüfstand gibt es keinen Frequenzregler.'); return; }
    const from = clamp(ctlParse(c, sw.from != null ? sw.from : ctlShow(c, c.min)), c.min, c.max), to = clamp(ctlParse(c, sw.to != null ? sw.to : ctlShow(c, c.max)), c.min, c.max), dur = parseNum(sw.dur != null ? sw.dur : '8');
    if (![from, to, dur].every(fin) || !(dur > 0)) { toast('Bitte „von“, „bis“ und die Dauer als Zahlen eintragen (Dauer größer 0).'); return; }
    const rs = curRows(), t0 = rs.length ? +(rowEnd(rs[rs.length - 1]) + 0.5).toPrecision(6) : 0;
    rs.push({ t: t0, kind: 'set', key: c.key, value: from }, { t: +(t0 + 0.01).toPrecision(6), kind: 'ramp', key: c.key, to, dur }); S.dirty = true; renderSweep(); saveCurSoon(); toast('Sweep eingetragen: ' + c.label + ' von ' + ctlShow(c, from) + ' bis ' + ctlShow(c, to));
  }

  /* ============================================================ Beispiele (EMV_DATA.examples, eingebauter Rückfall ohne Zahlen im Text) */
  const B = (id, name, cat, rig, desc, controls, extra) => Object.assign({ id, name, cat, rig, desc, controls }, extra || {});
  const BUILTIN = [
    B('bx-abstand', 'Zwei Leitungen: Der Abstand wirkt', 'Kopplung', 'kopplung', 'Zwei Leitungen laufen nebeneinander über der Masse. Verändere den Abstand und beobachte, wie sich die Kopplung ändert.', {}, {}),
    B('bx-quelle', 'Die Störquelle am Netz', 'Spektrum', 'quelle', 'Die Schaltzelle eines Netzteils speist Oberwellen ins Netz. Vergleiche das Spektrum mit der Übungsgrenzlinie.', {}, {}),
    B('bx-filter', 'Netzfilter', 'Filter', 'filter', 'Ein Netzfilter zwischen Netzteil und Netznachbildung: Ändere die Bauteile und sieh die Dämpfung.', {}, {})
  ];
  function exampleList() {
    const d = root.EMV_DATA; let a = d && d.examples;
    if (a && !Array.isArray(a)) a = Object.keys(a).map(k => Object.assign({ id: k }, a[k]));
    if (!a || !a.length) a = BUILTIN;
    return a.map(e => ({ id: e.id, name: e.name, cat: e.cat || 'Beispiele', desc: e.desc || e.text || '', rig: e.rig, controls: e.controls || {}, dur: e.dur, ref: e.ref || null, rows: e.rows ? rowNorm(e.rows) : (e.seq ? seqToRows(e.seq) : null), seq: e.seq }));
  }
  /* Vorher-Zustand eines Beispiels: Steuerwerte des Beispiels, darüber die Werte aus ref (oder ein fertiger Schnappschuss) */
  function refFromExample(e) {
    const rf = e.ref; if (!rf || typeof rf !== 'object') return null; if (rf.ctl && typeof rf.ctl === 'object') return clone(rf);
    const d = defOf(e.rig); if (!d) return null;
    try { const r = d.create({ seed: 1 }); Object.keys(e.controls || {}).forEach(k => { const v = coerce((r.controls || []).find(c => c.key === k), e.controls[k]); if (v !== undefined) r.setControl(k, v); }); Object.keys(rf).forEach(k => { const v = coerce((r.controls || []).find(c => c.key === k), rf[k]); if (v !== undefined) r.setControl(k, v); }); return clone(r.snapshot()); } catch (er) { return null; }
  }
  function loadExample(e) {
    if (typeof e === 'string') { const n = e.toLowerCase(); e = exampleList().find(x => x.id === e || x.name.toLowerCase().includes(n)); }
    if (!e) return false; const had = stash(); S.task = null; taskRes = null;
    setRig(e.rig && ORDER.includes(e.rig) ? e.rig : S.rigId || ORDER[0]);
    applyCtl(e.controls); S.rows[S.rigId] = e.rows ? clone(e.rows) : []; S.seqDur[S.rigId] = e.dur && e.dur > 0 ? e.dur : null; S.seqRes = null;
    const rs = refFromExample(e); if (rs) { S.ref = rs; S.refMode = 'nachher'; buildRefRig(); buildBA(); updateAmp(true); }
    S.name = e.name; S.id = null; S.dirty = false; setTab('rig'); updateChrome(); saveCurSoon(); renderSweep();
    toast(had ? 'Beispiel geladen, dein Versuch ist gesichert' : 'Beispiel geladen: ' + e.name);
    return true;
  }
  const loadExampleByName = n => loadExample(String(n || ''));
  function openExamples() {
    const ex = exampleList();
    sheet('Beispielversuche', (b, close) => {
      let last = '', h = '<p class="hint2" style="margin-top:0">Tippe ein Beispiel an: Prüfstand und Einstellungen werden geladen. Dein bisheriger Versuch wird vorher gesichert.</p>';
      ex.forEach((e, i) => { if (e.cat !== last) { last = e.cat; h += `<div class="gh">${esc(e.cat)}</div>`; } h += `<button class="row" data-i="${i}"><span style="font-size:22px;display:inline-block;width:32px;text-align:center;flex:none">${rigIcon(e.rig)}</span><div class="grow"><b>${esc(e.name)}</b><small>${esc(e.desc)}${e.rows && e.rows.length ? ' · mit Ablauf' : ''}</small></div></button>`; });
      b.innerHTML = h;
      b.addEventListener('click', ev => { const r = ev.target.closest('.row'); if (!r) return; close(); loadExample(ex[+r.dataset.i]); });
    });
  }

  Object.assign(S, { seqDur: {}, ghost: true, diag: [], diagSeen: {}, evSeen: new WeakSet(), evSig: '', evLen: 0, fx: { amp: null, kazoo: false, flags: {} }, dice: null, tkCat: '', sweepForm: null, seqCur: true, seqRes: null });

  /* ============================================================ Speichern, Öffnen, Teilen */
  const PK = 'emv.saves';
  const saves = () => { const a = lsGet(PK, []); return Array.isArray(a) ? a : []; };
  function saveItem(name) {
    const a = saves(), id = S.id || uid(); S.id = id; S.name = name || S.name;
    const e = { id, name: S.name, t: Date.now(), rig: S.rigId, ctl: allCtl(), ref: S.ref ? clone(S.ref) : null, refMode: S.refMode, rows: clone(curRows()), dur: seqDur() };
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
  /* Zustand ohne Aufgaben-Vorbelegung wiederherstellen; unbekannte Schlüssel, Werte und Versionen werden toleriert (Regel 8) */
  function applyItem(it, suffix) {
    S.task = null; taskRes = null; const rid = ORDER.includes(it.rig) ? it.rig : ORDER[0];
    setRig(rid, { keepRef: false }); applyCtl(it.ctl && typeof it.ctl === 'object' ? it.ctl : {});
    if (it.ref && typeof it.ref === 'object' && it.ref.ctl && typeof it.ref.ctl === 'object') { S.ref = clone(it.ref); S.refMode = ['vorher', 'nachher', 'wischer'].includes(it.refMode) ? it.refMode : 'nachher'; buildRefRig(); buildBA(); updateAmp(true); }
    S.rows[S.rigId] = Array.isArray(it.rows) ? rowNorm(it.rows.filter(r => r && typeof r === 'object' && (r.kind === 'fire' || typeof r.key === 'string'))) : []; S.seqDur[S.rigId] = fin(it.dur) && it.dur > 0 ? it.dur : null; S.seqRes = null;
    S.name = (it.name || 'Versuch') + (suffix || ''); S.dirty = false; updateChrome(); saveCurSoon();
    setTab(S.tab === 'lay' && S.rigId === 'layout' ? 'lay' : 'rig'); renderSweep();
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
  const shareObj = () => ({ k: 'emv', name: S.name, rig: S.rigId, ctl: allCtl(), ref: S.ref ? clone(S.ref) : null, refMode: S.refMode, rows: clone(curRows()), dur: seqDur() });
  async function shareNow() {
    if (!S.rig) { toast('Es gibt noch nichts zu teilen: der Prüfstand fehlt.'); return; }
    let url; try { url = location.href.split('#')[0].split('?')[0] + '#' + await packShare(shareObj()); } catch (e) { toast('Teilen nicht möglich'); return; }
    if (navigator.share) { try { await navigator.share({ title: 'Tonfunk EMV-Lab: ' + S.name, text: 'Schau dir meinen EMV-Versuch „' + S.name + '“ an:', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    sheet('Teilen', b => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">Diesen Link weitergeben (zum Beispiel per WhatsApp oder E-Mail). Wer ihn öffnet, bekommt eine Kopie deines Versuchs mit Prüfstand, Einstellungen, Vorher-Zustand und Ablauf.</p><textarea id="shTx" rows="5" readonly></textarea><div class="btns"><button class="btn pri" id="shCp">Link kopieren</button></div>';
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

  /* ============================================================ Aufgaben (EMV_TASKS) */
  const TK = () => (root.EMV_TASKS && Array.isArray(root.EMV_TASKS.tasks) && root.EMV_TASKS.tasks.length ? root.EMV_TASKS.tasks : null);
  const taskDone = () => lsGet('sim.done', {});
  function markDone(id, pct) {
    try { const d = taskDone(); if ((d[id] || 0) < pct) d[id] = pct; localStorage.setItem('sim.done', JSON.stringify(d)); } catch (e) {}
    if (root.Badges) root.Badges.result(id, pct);
  }
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
  /* Aufgabenzustand (start() und sol() liefern { rig?, controls?, seq?: [{t(s), set|ramp|fire}], dur(s)?, ref?, value? }) übernehmen */
  function applyTaskState(t, o) {
    o = o || {}; const rid = o.rig || t.rig || S.rigId;
    setRig(ORDER.includes(rid) ? rid : S.rigId); applyCtl(o.controls || o.ctl);
    S.rows[S.rigId] = o.rows ? rowNorm(o.rows) : seqToRows(o.seq); S.seqDur[S.rigId] = o.dur && o.dur > 0 ? o.dur : null; S.seqRes = null; S.taskStart = o; S.clicks = [];
    if (o.ref && typeof o.ref === 'object') { const rs = o.ref.ctl ? clone(o.ref) : refFromExample({ rig: S.rigId, controls: o.controls || {}, ref: o.ref }); if (rs) { S.ref = rs; S.refMode = 'nachher'; buildRefRig(); buildBA(); updateAmp(true); } }
  }
  const fieldsOf = t => { let f = t.fields; if (typeof f === 'function') { try { f = f(S.taskStart); } catch (e) { f = []; } } return Array.isArray(f) ? f : []; };
  const choicesOf = t => { let f = t.choices; if (typeof f === 'function') { try { f = f(S.taskStart); } catch (e) { f = []; } } return Array.isArray(f) ? f : []; };
  async function startTask(id) {
    const t = (TK() || []).find(x => x.id === id); if (!t) return;
    const had = stash(); taskRes = null;
    if (root.Auswertung) root.Auswertung.hintReset(id);
    let o; try { o = typeof t.start === 'function' ? t.start() : {}; } catch (e) { console.error(e); toast('Die Startvorlage der Aufgabe fehlt'); return; }
    S.task = null; applyTaskState(t, o); S.task = { id }; S.name = t.title; S.id = null; S.dirty = false; delete taskAns[id];
    setTab(t.rig === 'layout' && t.clicks ? 'lay' : 'tasks'); updateChrome();
    toast(had ? 'Aufgabe gestartet, dein Versuch ist gesichert' : 'Aufgabe gestartet'); renderTasksIfOpen();
  }
  const renderTasksIfOpen = () => { if (S.tab === 'tasks') renderTasks(); };
  /* Abgabe: { rig, controls, ref, value, text, fields, choices, clicks, ... } (SPEC 8.5) */
  function collectAnswer(t) {
    let st = null; try { st = S.rig ? clone(S.rig.state()) : null; } catch (e) {}
    const a = taskAns[t.id] || {}, v = a.v != null && a.v !== '' ? parseNum(a.v) : NaN, fl = fieldsOf(t), fo = {};
    fl.forEach(f => { const raw = a.f && a.f[f.key], x = raw != null && raw !== '' ? parseNum(raw) : NaN; fo[f.key] = fin(x) ? x : null; });
    const first = fl.length ? fo[fl[0].key] : null;
    return { rig: S.rigId, controls: allCtl(), ref: S.ref ? clone(S.ref) : null, seq: seqSteps(curRows()), rows: clone(curRows()), dur: seqDur(), state: st, simTime: S.simT, fired: !!S.fired, value: fin(v) ? v : (fin(first) ? first : null), text: a.v == null ? '' : String(a.v), fields: fo, choices: Object.assign({}, a.c || {}), clicks: clone(S.clicks || []) };
  }
  async function checkTask() {
    const t = curTask(); if (!t) return; const R = root.EMV_TASKS;
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
    const has = o && (o.rows && o.rows.length || o.seq && o.seq.length);
    setTab(t.rig === 'layout' ? 'lay' : 'rig'); if (has) seqLive(); else { setRun(true); if (canFire() && o && o.fire !== false && (o.fired || t.rig === 'esd')) doFire(); }
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
      rows = Array.isArray(rows) ? rows : []; return `<div class="emv-tbl"><table>${t1.caption || t1.title ? `<caption>${esc(t1.caption || t1.title)}</caption>` : ''}${Array.isArray(head) ? `<thead><tr>${head.map(h => `<th>${cell(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map(r => `<tr>${(Array.isArray(r) ? r : [r]).map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    };
    return list.map(one).join('');
  }
  function renderTasks() {
    const V = $('#taskView'), A = TK();
    if (!A) { V.innerHTML = '<div class="card pl"><h4>Aufgaben</h4><p class="big">Aufgaben folgen</p><p class="hint2">Hier erscheinen Aufgaben mit automatischer Prüfung: Grundlagen, Kopplung, Spektrum, Filter, Schirmung, Layout, Impulse, Messen und Prüfungsaufgaben. Bis dahin kannst du mit den Beispielen, dem Rechner und dem Tab „Lernen“ üben.</p><div class="btns"><button class="btn pri" id="tkEx">Beispiele ansehen</button><button class="btn" id="tkRetry" data-retry>Erneut prüfen</button></div></div>'; $('#tkEx', V).onclick = openExamples; return; }
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
        ${t.clicks ? `<p class="hint2">Diese Aufgabe verlangt, dass du Stellen im Bild antippst (bisher ${(S.clicks || []).length} Antipper). Das geht im Tab „Layout-Fälle“.</p>` : ''}
        <div class="btns"><button class="btn pri" data-ta="check">✓ Lösung prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button></div>
        <div class="btns"><button class="btn" data-ta="rig">${t.clicks || t.rig === 'layout' ? 'Zu den Layout-Fällen' : 'Zum Prüfstand'}</button>${typeof t.sol === 'function' ? '<button class="btn" data-ta="auto">▶ Auto-Weg</button>' : ''}<button class="btn" data-ta="hand">Abgeben (QR)</button><button class="btn danger" data-ta="end">Aufgabe beenden</button></div>`;
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
      const a = tb.dataset.ta, t = curTask();
      if (a === 'check') checkTask(); else if (a === 'hint') hintTask(); else if (a === 'rig') setTab(t && (t.clicks || t.rig === 'layout') ? 'lay' : 'rig');
      else if (a === 'auto') { if (t && await confirmSheet('Auto-Weg?', 'Der Prüfstand spielt die Musterlösung ab. Das <b>zählt als Hilfe</b> (Stufe 3): Dein Ausbilder sieht es.', 'Abspielen')) autoWay(t); }
      else if (a === 'hand') { if (t && root.Auswertung) root.Auswertung.handIn(t.id, taskDone()[t.id] || 0, t.title); }
      else if (a === 'end') { S.task = null; taskRes = null; updateChrome(); renderTasks(); toast('Aufgabe beendet'); }
    } else if (row) startTask(row.dataset.t);
  });

  /* ============================================================ Fehler-Würfel: Störung auswürfeln (wirkt auf Steuerwerte, je Prüfstand nur sinnvolle Arten, Tabelle DICE) */
  const marg = () => { const a = assessOf(S.rig); return a && fin(a.margin) ? a.margin : null; };
  const dm = (b, a) => (b != null && a != null ? ' Die Marge ändert sich von ' + fnum(b, 1) + ' dB auf ' + fnum(a, 1) + ' dB.' : '');
  const optVal = (id, v) => { const c = ctlDef(id); return !!(c && c.type === 'select' && (c.options || []).some(o => o.value === v || String(o.value) === String(v))); };
  const firstClockHarm = () => { const fc = hasCtl('fclk') ? +S.rig.getControl('fclk') : NaN; if (!fin(fc) || fc <= 0) return NaN; let f = fc; while (f < 30e6) f += fc; return f; };
  const DICE = {
    kopplung: [{ id: 'masseschleife', ok: () => hasCtl('loop'), apply: () => { const m = { loop: true }; if (hasCtl('dUg') && +S.rig.getControl('dUg') < 0.5) m.dUg = 0.5; return m; }, text: (b, a) => 'Masseschleife: Beide Enden der Leitung sind geerdet und fangen die Potenzialdifferenz ein.' + dm(b, a) }],
    quelle: [{ id: 'rgklein', ok: () => hasCtl('rg'), apply: () => ({ rg: 1 }), text: (b, a) => 'Gate-Widerstand zu klein: Die Flanke wird sehr steil, die Oberwellen reichen weit nach oben.' + dm(b, a) }],
    filter: [
      { id: 'ykond', ok: () => hasCtl('cy'), apply: () => ({ cy: 0 }), text: (b, a) => 'Y-Kondensator fehlt: Der Gleichtakt wird nicht mehr nach Masse abgeleitet.' + dm(b, a) },
      { id: 'drossel', ok: () => hasCtl('drossel'), apply: () => ({ drossel: 'ohne' }), text: (b, a) => 'Drossel entfernt: Die Gleichtaktdämpfung fehlt.' + dm(b, a) }],
    schirm: [
      { id: 'pigtail', ok: () => optVal('kabel', 'pigtail'), apply: () => ({ kabel: 'pigtail' }), text: (b, a) => 'Schirm auf Pigtail: Die Schirmlitze hat eine hohe Kopplungsimpedanz.' + dm(b, a) },
      { id: 'schlitz', ok: () => hasCtl('slot'), apply: () => ({ slot: 120 }), text: (b, a) => 'Schlitz im Gehäuse: Ein langer Schlitz lässt hohe Frequenzen durch.' + dm(b, a) }],
    abstrahlung: [
      { id: 'pigtail', ok: () => optVal('kabel', 'geschirmtPigtail'), apply: () => ({ kabel: 'geschirmtPigtail' }), text: (b, a) => 'Schirm auf Pigtail: Der Kabelschirm ist nur mit einer Litze angeschlossen.' + dm(b, a) },
      { id: 'lambda4', ok: () => fin(firstClockHarm()) && hasCtl('len'), apply: () => ({ len: clamp(CORE() && CORE().C0 ? CORE().C0 / (4 * firstClockHarm()) : 1.5, 0.1, 5) }), text: (b, a) => { const f = firstClockHarm(); return 'Das Kabel ist genau eine Viertelwellenlänge lang (bei ' + fe(f, 'Hz') + ') und strahlt dort besonders gut.' + dm(b, a); } }],
    layout: [
      { id: 'abblock', ok: () => optVal('fall', 'abblock-weit'), apply: () => ({ fall: 'abblock-weit', fix1: false, fix2: false, fix3: false }), text: (b, a) => 'Abblockkondensator zu weit vom Pin: Die Zuleitung ist eine Induktivität.' + dm(b, a) },
      { id: 'lagen', ok: () => hasCtl('stack') && optVal('stack', '2'), apply: () => ({ stack: '2' }), text: (b, a) => 'Lagenaufbau 2 statt 4: Es gibt keine Massefläche unter der Bahn.' + dm(b, a) }],
    esd: [{ id: 'schutz', ok: () => optVal('schutz', 'kein'), apply: () => ({ schutz: 'kein' }), text: (b, a) => 'Schutz fehlt: Der Impuls erreicht den Eingang ungebremst. Löse mit „Entladung auslösen“ aus und beobachte das Gerät.' + dm(b, a) }],
    tastkopf: [{ id: 'klemme', ok: () => optVal('lead', 'klemme'), apply: () => ({ lead: 'klemme' }), text: (b, a) => 'Masseklemme zu lang: Die lange Masseleitung schwingt mit der Tastkopfkapazität.' + dm(b, a) }],
    vorpruef: [{ id: 'ykond', ok: () => hasCtl('cy'), apply: () => ({ cy: 0 }), text: (b, a) => 'Y-Kondensator fehlt: Der Gleichtakt wird nicht mehr nach Masse abgeleitet.' + dm(b, a) }]
  };
  root.EMV_DICE = DICE;
  function diceRoll() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; } if (S.task) { toast('Beende zuerst die Aufgabe.'); return; }
    const ok = (DICE[S.rigId] || []).filter(d => { try { return d.ok(); } catch (e) { return false; } }); if (!ok.length) { toast('An diesem Prüfstand lässt sich nichts auswürfeln.'); return; }
    const d = ok[Math.floor(Math.random() * ok.length)], bm = marg(), keys = d.apply(), before = {}; Object.keys(keys).forEach(k => { try { before[k] = S.rig.getControl(k); } catch (e) {} });
    applyCtl(keys); readState(); const am = marg(), text = d.text(bm, am);
    S.dice = { id: d.id, text, before }; S.dirty = true; saveCurSoon(); if (!S.running) setRun(true);
    if (root.LochFX && canSound()) try { root.LochFX.sound('slide'); } catch (e) {}
    sheet('🎲 Fehler gewürfelt', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Am Aufbau stimmt etwas nicht. Beobachte Ampel und Messgeräte und finde die Ursache.</p><div class="btns"><button class="btn" data-d="show">Auflösung zeigen</button><button class="btn" data-d="undo">Fehler beheben</button><button class="btn pri" data-d="ok">Ich suche selbst</button></div><div id="dcOut"></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-d]'); if (!x) return; if (x.dataset.d === 'show') $('#dcOut', b).innerHTML = '<div class="ex">' + esc(S.dice.text) + '</div>'; else if (x.dataset.d === 'undo') { applyCtl(S.dice.before); S.dice = null; toast('Fehler behoben'); close(); } else close(); });
    });
  }

  /* ============================================================ Spektrum, Layout-Fälle, Rechnen, Lernen: Erweiterungen (SPEC 8.8) */
  function loadRig(o) {
    o = o || {}; if (S.task) { toast('Beende zuerst die Aufgabe.'); return false; }
    const id = o.rig && ORDER.includes(o.rig) ? o.rig : S.rigId; if (!defOf(id)) { toast('Dieser Prüfstand ist noch nicht geladen.'); return false; }
    const had = stash(); S.name = o.name || 'Neuer Versuch'; S.id = null; S.dirty = false; S.rows[id] = []; setRig(id);
    if (o.preset && S.rig && typeof S.rig.applyPreset === 'function') { try { S.rig.applyPreset(o.preset); S.preset = o.preset; } catch (e) { console.error(e); } buildControls(); buildMeters(); buildPresets(); buildChain(); }
    if (o.controls) applyCtl(o.controls);
    setTab(o.tab || (id === 'layout' && S.tab === 'lay' ? 'lay' : 'rig')); updateChrome(); saveCurSoon(); toast(had ? 'Geladen, dein Versuch ist gesichert' : (o.toast || 'Im Prüfstand geladen: ' + rigName(id)));
    return true;
  }
  function extApi() {
    return { get S() { return S; }, get rig() { return S.rig; }, setTab, loadExample, startTask, toast, esc, stat: (k, v, m) => { if (k === 'emvcalc') S.calcUsed = true; stat(k, v, m); }, lsGet, lsSet, get EMV_CORE() { return CORE(); }, get EMV_DRAW() { return DRAW(); }, snapshot, setRef, get quality() { return curQ(); }, get reduced() { return reduced(); }, get theme() { return theme(); },
      KEYS, LEVERS, ORDER, SPEEDS, loadRig, setCtl, applyCtl, ctlShow, ctlParse, rigName, rigIcon, defOf, fnum, fe, parseNum, setRun, resetRig, merken, toggleVN, doFire, assessOf, allCtl };
  }
  const EXTHOST = { spec: '#specView', lay: '#layView', calc: '#calcView', help: '#helpView' }, EXTFILE = { spec: 'emvui-spec.js', lay: 'emvui-lay.js', calc: 'emvui-calc.js', help: 'emvui-help.js' }, EXTNAME = { spec: 'Spektrum', lay: 'Layout-Fälle', calc: 'Rechner', help: 'Lernen' };
  function renderExt(kind) {
    const host = $(EXTHOST[kind]), E = root.EMV_UI_EXT && root.EMV_UI_EXT[kind];
    if (!host) return;
    if (!E || typeof E.render !== 'function') { host.innerHTML = `<div class="card pl"><p class="big">Ansicht wird geladen</p><p class="hint2">Die Datei ${EXTFILE[kind]} ist noch nicht geladen (${EXTNAME[kind]}).</p><div class="btns"><button class="btn" data-retry>Erneut prüfen</button></div></div>`; return; }
    if (kind === 'help' && host.dataset.ext === '1' && host.children.length) return;
    try { E.render(host, extApi()); host.dataset.ext = '1'; } catch (e) { console.error('Erweiterung ' + kind + ':', e); host.innerHTML = '<div class="card pl"><p class="big">Das hat nicht geklappt</p><p class="hint2">' + esc((e && e.message) || e) + '</p></div>'; }
  }
  function extRefresh() { if (S.tab === 'spec' || S.tab === 'lay') { const E = root.EMV_UI_EXT && root.EMV_UI_EXT[S.tab]; if (E && typeof E.refresh === 'function') { try { E.refresh(); return; } catch (e) {} } renderExt(S.tab); } }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-retry]') && ['calc', 'spec', 'lay', 'help'].includes(S.tab)) renderExt(S.tab); });

  /* ============================================================ Oberfläche: Kopf, Tabs, Leiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd" style="display:none"></span>' : ''}</button>`).join('');
    updateTaskBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function redrawTab() { if (S.tab === 'spec' || S.tab === 'lay') { const E = root.EMV_UI_EXT && root.EMV_UI_EXT[S.tab]; if (E && typeof E.redraw === 'function') { try { E.redraw(); } catch (e) {} } } }
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'rig'; S.tab = t; lsPut('emv.tab', t);
    if (t === 'lay' && !S.task && S.rigId !== 'layout' && defOf('layout')) { stash(); S.name = 'Neuer Versuch'; S.id = null; S.dirty = false; setRig('layout'); }
    if (t === 'spec') S.specOpened = true;
    $('#mid').dataset.tab = t; $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'spec') renderExt('spec'); else if (t === 'lay') renderExt('lay'); else if (t === 'calc') renderExt('calc'); else if (t === 'tasks') renderTasks(); else if (t === 'help') renderExt('help');
    buildPick(); updateChrome();
    requestAnimationFrame(() => { fitCanvas(); updateMeters(0, true); redrawTab(); syncCtl(true); });
  }
  function updateTitle() {
    const nm = rigName(S.rigId || ORDER[0]);
    $('#title').innerHTML = esc(S.name) + (S.dirty ? ' •' : '') + '\n<small>' + esc(nm) + (S.attrappe ? ' (Notfall-Attrappe)' : '') + (S.running ? ' · läuft' : '') + '</small>';
    document.title = 'EMV-Lab: ' + S.name;
    const tag = $('#cvTag'); if (tag) { tag.textContent = S.running ? '' : '⏸ Pause'; tag.style.display = S.running ? 'none' : ''; }
  }
  $('#title').onclick = async () => { const r = await ask('Name des Versuchs', [{ key: 'n', label: 'Name', type: 'text', value: S.name }]); if (r && r.n.trim()) { S.name = r.n.trim(); S.dirty = true; updateChrome(); saveCurSoon(); } };
  let palSig = '';
  function buildPal() {
    const fx2 = fxOn(), fire = canFire(), sig = [S.running, S.speed, fx2, !!S.rig, !!S.live, fire, S.rigId, reduced()].join('|');
    if (sig === palSig) return; palSig = sig; const F = !!root.LochFX;
    $('#pal').innerHTML = `<button class="chip ${S.running ? 'on' : 'go'}" data-a="run" aria-label="${S.running ? 'Pause' : 'Start'}">${S.running ? '⏸ Pause' : '▶ Start'}</button><button class="chip" data-a="reset" aria-label="Zurücksetzen">⟲ Reset</button>${fire ? '<button class="chip fire" data-a="fire" aria-label="Entladung auslösen" title="Taste F">💥 Auslösen</button>' : ''}<span class="sep"></span>
      <span class="seg" aria-label="Zeitlupe und Zeitraffer">${SPEEDS.map((v, i) => `<button data-sp="${v}" class="${S.speed === v ? 'on' : ''}" title="Taste ${i + 1}">×${String(v).replace('.', ',')}</button>`).join('')}</span><span class="sep"></span>
      <button class="chip" data-a="dice" aria-label="Fehler würfeln" title="Fehler würfeln">🎲 Fehler</button>${F ? `<button class="chip ${fx2 ? 'on' : ''}" data-a="fx" aria-pressed="${fx2}" aria-label="Effekte und Ton" title="Effekte und Ton">${fx2 ? '🎉' : '🔇'} Effekte</button>` : ''}
      <span id="stat"></span>`;
    const r = $('#bRun'); r.textContent = S.running ? '⏸' : '▶'; r.classList.toggle('on', S.running); r.setAttribute('aria-label', S.running ? 'Pause' : 'Start');
    updateStat();
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sp) setSpeed(+b.dataset.sp);
    else if (b.dataset.a === 'run') setRun(!S.running); else if (b.dataset.a === 'reset') resetRig(); else if (b.dataset.a === 'fire') doFire(); else if (b.dataset.a === 'dice') diceRoll(); else if (b.dataset.a === 'fx') toggleFx();
  });
  function updateChrome() { updateTitle(); buildPal(); updateTaskBar(); updateQLine(); }
  $('#bRun').onclick = () => setRun(!S.running);
  $('#bEx').onclick = openExamples; $('#bOpen').onclick = openList; $('#bTasks').onclick = () => setTab('tasks'); $('#bShare').onclick = shareNow; $('#bPrint').onclick = printNow;
  function togglePeak() { S.peak = !S.peak; if (S.tab !== 'spec') { toast(S.peak ? 'Spitzenwert halten ist an. Du siehst ihn im Tab „Spektrum“.' : 'Spitzenwert halten ist aus.'); } extRefresh(); }

  /* ============================================================ Menü */
  function openMenu() {
    const nT = (TK() || []).length, kk = KEYS.filter(k => !k.ext).map(k => k.keys.join('/')).slice(0, 4).join(', ');
    const rows = [
      ['tasks', 'Aufgaben', nT ? nT + ' Aufgaben mit automatischer Prüfung' : 'Aufgaben folgen'], ['print', 'Drucken', 'Einstellungen, Messwerte, Ampel und Prüfstandbild'], ['new', 'Neuer Versuch', 'Prüfstand wählen und von vorn beginnen'], ['ex', 'Beispielversuche', exampleList().length + ' Versuche zum Ausprobieren'],
      ['open', 'Öffnen', 'Gespeicherte Versuche auf diesem Gerät'], ['save', 'Speichern unter …', S.name], ['share', 'Teilen', 'Link zum Weitergeben (Versuch steckt im Link)'], ['import', 'Aus Code oder Link laden', 'Geteilten Versuch einfügen'],
      ['fx', 'Effekte und Ton: ' + (fxOn() ? 'an' : 'aus'), 'Töne und Effekte ein- oder ausschalten'], ['png', 'Prüfstandbild speichern (PNG)', 'Aktuelle Ansicht als Bilddatei'], ['csv', 'Spektrum als CSV', 'Linien für Excel (Frequenz in Hz, Pegel in dBµV)'], ['dice', 'Fehler-Würfel', 'Eine Störung auswürfeln und suchen'],
      ['meters', 'Messgeräte: ' + (S.digital ? 'Zahlen' : 'Zeiger'), 'Zwischen Zeigerinstrument und Zahlenanzeige wechseln'], ['calc2', 'Rechnen', 'dB, Filter, Schleifen, Oberwellen, Schirmung, Antenne, Impulse und Übungen'], ['calc', 'Taschenrechner', 'Ohm, Farbcode, Leitung und mehr'],
      ['abz', 'Abzeichen', 'Deine Sammlung und was noch fehlt'], ['kamp', 'Kampagne: Der Störfall', 'Lernpfad mit Geschichte über alle Labs'], ['trainer', 'Trainer: Erste Schritte', 'Kurze Einführung zum Mitmachen'],
      ['neu', 'Neu in dieser Version', 'Was zuletzt dazukam und wo du es findest'], ['erg', 'Ergebnis senden', 'Code für den Ausbilder: meine bearbeiteten Aufgaben'], ['keys', 'Tastenkürzel', kk + ' und mehr (Taste ? drücken)'], ['help', 'Hilfe und Lernen', 'Grundlagen kurz erklärt'], ['start', 'Zur Startseite', '']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b>${r[2] ? `<small>${esc(r[2])}</small>` : ''}</div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); menuAct(r.dataset.m); });
    });
  }
  async function newExperiment() {
    if (S.task) { toast('Beende zuerst die Aufgabe.'); return; }
    const v = await pick('Neuer Versuch: Prüfstand wählen', ORDER.map(id => ({ value: id, label: rigName(id), sub: ((defOf(id) || {}).info) || RIGMETA[id].info, icon: rigIcon(id), mark: defOf(id) ? '' : 'fehlt' })));
    if (!v) return; const had = stash(); S.name = 'Neuer Versuch'; S.id = null; S.dirty = false; S.rows[v] = []; setRig(v); setTab(v === 'layout' && S.tab === 'lay' ? 'lay' : 'rig');
    toast(had ? 'Neuer Versuch, dein bisheriger ist gesichert' : 'Neuer Versuch');
  }
  function menuAct(m) {
    switch (m) {
      case 'tasks': setTab('tasks'); break; case 'new': newExperiment(); break; case 'ex': openExamples(); break; case 'open': openList(); break; case 'save': doSave(); break;
      case 'share': shareNow(); break; case 'import': importSheet(); break; case 'fx': toggleFx(); break; case 'png': exportPng(); break; case 'csv': exportCsv(); break; case 'dice': diceRoll(); break;
      case 'meters': S.digital = !S.digital; lsPut('emv.digital', S.digital ? '1' : '0'); buildMeters(); updateMeters(0, true); break;
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
  let last = 0, lastUI = 0, lastSt = 0; const perf = { n: 0, sum: 0, max: 0, recent: [] };
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = ts; return; }
    const t0 = performance.now(), dt = Math.min(100, ts - (last || ts)); last = ts;
    if (S.running && S.rig) {
      try { simAdvance(dt); }
      catch (e) { S.running = false; S.live = null; console.error('Simulation:', e); toast('Der Prüfstand hat einen Rechenfehler gemeldet und wurde angehalten.'); updateChrome(); }
    }
    if (S.rig) watchEvents(ts);
    if (S.tab === 'rig') {
      drawRig(ts); updateMeters(dt);
      if (ts - lastUI > 100) {
        lastUI = ts; readState(); syncCtl(); updateStat(); updateDiag(); updateAmp(); renderSweepLive(); updateQLine();
        const fb = $('#cvFault'), on = performance.now() < (S.faultUntil || 0);
        if (fb) { if (on) { const tx = S.faultText || ''; if (fb.textContent !== tx) fb.textContent = tx; } if (fb.classList.contains('on') !== on) fb.classList.toggle('on', on); }
      }
    } else if (ts - lastUI > 200) { lastUI = ts; readState(); updateStat(); }
    if (ts - lastSt > 250) { lastSt = ts; if (S.rig) watchState(); }
    fxFrame();
    const w = performance.now() - t0; perf.n++; perf.sum += w; if (w > perf.max) perf.max = w; perf.recent.push(w); if (perf.recent.length > 120) perf.recent.shift();
    if (S.tab === 'rig' && S.rig) qualityFeed(w, ts);
  }

  /* ============================================================ Schnittstellen für Trainer, Tasten, Tests */
  const ampelNow = () => { const a = assessOf(S.rig); return a ? ampKey(a.ampel) : 'grau'; };
  root.LabTrainerAPI = {
    lab: 'emv', tab: () => S.tab, go: setTab, simMode: () => S.running, running: () => S.running, rig: () => S.rigId, speed: () => S.speed,
    load: loadExampleByName, examples: () => exampleList().map(e => e.name), task: () => (S.task ? S.task.id : null), saved: () => saves().length,
    seqRows: () => curRows().length, seqDone: () => !!S.seqRes, simTime: () => S.simT, faults: () => (lsGet('emv.faults', []) || []).length, calcUsed: () => !!S.calcUsed,
    ampel: ampelNow, refSet: () => !!S.ref, fired: () => !!S.fired, specTab: () => !!S.specOpened
  };
  root.LabKeysAdapter = {
    lab: 'emv', sheet: (title, build) => (title === 'Tastenkürzel' ? sheet(title, b => { b.innerHTML = keysHtml(); }) : sheet(title, build)), esc, toast,
    sim: () => setRun(!S.running), busy: () => true, has: () => false
  };
  /* kleine Testschnittstelle */
  root.EMV_UI = { frame, S, KEYS, TABS, ORDER, LEVERS, setTab, setRig, setCtl, applyCtl, setRun, resetRig, simAdvance, loadExample, loadExampleByName, startTask, checkTask, seqRunBg, seqLive, seqSteps, seqToRows, curRows, allCtl, coerce, csvText, parseCsv, shareObj, packShare, unpackShare, applyItem, saveItem, diceRoll, DICE, exampleList, BUILTIN, renderSweep, extApi, collectAnswer, retryLoad, openMenu, rowNorm, seqDur, slPos, slVal, merken, toggleVN, toggleWipe, backToRef, setRef, qualityFeed, curQ, setQMode, drawOpts, drawRig, fitCanvas, updateAmp, updateDiag, fxAmpel, doFire, tableHtml, perf: () => ({ n: perf.n, mean: perf.n ? perf.sum / perf.n : 0, max: perf.max, recentMean: perf.recent.length ? perf.recent.reduce((a, b) => a + b, 0) / perf.recent.length : 0 }), fnum, ctlShow, ctlParse, DUMMY, refFromExample, bandOf, rigPng, printNow, openExamples, newExperiment, openList, importSheet, exportPng, toggleFx, hintTask };

  /* ============================================================ Start */
  function init() {
    buildTabs();
    const cur = lsGet('emv.cur', null);
    if (cur && ORDER.includes(cur.rig)) {
      S.rows = cur.rows && typeof cur.rows === 'object' && !Array.isArray(cur.rows) ? cur.rows : {}; Object.keys(S.rows).forEach(k => { S.rows[k] = Array.isArray(S.rows[k]) ? rowNorm(S.rows[k].filter(r => r && (r.kind === 'fire' || typeof r.key === 'string'))) : []; });
      S.name = cur.name || 'Neuer Versuch'; S.id = cur.id || null;
      setRig(cur.rig); applyCtl(cur.ctl); S.dirty = !!cur.dirty; S.task = cur.task ? { id: cur.task } : null;
      if (cur.ref && typeof cur.ref === 'object' && cur.ref.ctl) { S.ref = clone(cur.ref); S.refMode = ['vorher', 'nachher', 'wischer'].includes(cur.refMode) ? cur.refMode : 'nachher'; buildRefRig(); buildBA(); updateAmp(true); }
    } else {
      setRig(ORDER[0]);
      if (!lsRaw('emv.seen', '')) { lsPut('emv.seen', '1'); setTimeout(() => toast('Willkommen! Starte mit ▶ unten oder bewege einen Regler: Die Animation läuft dann los.'), 900); }
    }
    renderSweep(); setTab(S.tab); requestAnimationFrame(frame);
    root.addEventListener('load', () => { if (['calc', 'help', 'spec', 'lay'].includes(S.tab)) renderExt(S.tab); });
    /* Aufrufparameter von Startseite, Lernpfad, Kampagne und Lernheften: ?aufgabe=em1, ?ex=Name, ?bsp, ?neu */
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
