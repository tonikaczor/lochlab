'use strict';
/* Tonfunk Thermik-Lab: Oberfläche (WP3a).
   Seite, Tabs (Prüfstand, Rechnen, Vergleichen, Ablauf, Aufgaben, Lernen), Bedienpult und Messgeräte automatisch aus rig.controls / rig.meters,
   Messschreiber mit Zeitreise, Kennlinien, Ablaufprogramm, Vergleichs-Tafel, Speichern/Öffnen/Teilen, Aufgabenanbindung, Effekte.
   Rechnen und Lernen kommen aus thmui-calc.js und thmui-help.js über window.THM_UI_EXT (Abschnitt 6.7 der SPEC).
   Die Prüfstände kommen aus thmrig-*.js über window.THM_RIGS (Registry), Rechnen und Läufer aus thmcore.js (window.THM_CORE), Beispiele und Aufgaben aus thmdata.js / thmtasks*.js.
   Es gibt hier KEINE zweite Formelimplementierung: chain, steady, rthKerf, recipe, diagnose, runSeq, exercise ruft immer der Kern bzw. der Prüfstand.
   Speicher: thm.cur (laufende Arbeit), thm.saves (gespeicherte Versuche), thm.tab, thm.speed, thm.seen, thm.faults, thm.fx, thm.view, thm.sym, thm.vergl, thm.rigsused, thm.autohint,
   sim.done / sim.hints (Aufgaben, gemeinsam mit den anderen Labs). */
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
  const CORE = () => root.THM_CORE;
  const ORDER = ['linear', 'transistor', 'mosfet', 'bauteil', 'vergleich'];
  const MAIN = ORDER.slice(0, 4);
  const RIGMETA = {
    linear: { icon: '🔥', name: 'Linearregler (7805, LM317)', info: 'Verlustleistung am Spannungsregler' },
    transistor: { icon: '🔌', name: 'Leistungstransistor (BD139)', info: 'Längstransistor und Endstufe' },
    mosfet: { icon: '⚡', name: 'MOSFET als Schalter (IRLZ34N)', info: 'Leit- und Schaltverluste' },
    bauteil: { icon: '💡', name: 'Diode, Widerstand, LED', info: 'Kleine Bauteile und LED-Treiber' },
    vergleich: { icon: '⚖️', name: 'Vergleich (bis zu drei Aufbauten)', info: 'Aufbauten nebeneinander' }
  };
  const RIGFILE = { linear: 'thmrig-linear.js', transistor: 'thmrig-transistor.js', mosfet: 'thmrig-mosfet.js', bauteil: 'thmrig-bauteil.js', vergleich: 'thmrig-vergleich.js' };
  const SHORT = { linear: 'Linearregler', transistor: 'Transistor', mosfet: 'MOSFET', bauteil: 'Bauteile', vergleich: 'Vergleich' };
  /* Zeitfenster des Messschreibers je Aufbau in Prozess-Sekunden (SPEC 5.6): frei 1800, Kühlkörper s/m 3600, l/xl 7200 */
  const SPAN_FREE = 1800, SPAN_MID = 3600, SPAN_BIG = 7200;
  const TDIV = { s: 1, min: 60, h: 3600 };
  const MONTAGE_KEYS = ['heatsink', 'blechA', 'joint', 'paste', 'bushing', 'screw', 'ksPot', 'fan', 'orient'];
  const VIEWS = [['schnitt', 'Schnittbild'], ['kamera', 'Wärmebild'], ['ersatz', 'Ersatzschaltbild'], ['balken', 'Balken']];
  const decs = step => { step = +step || 0; if (!step || step >= 1) return 0; return Math.min(3, Math.ceil(-Math.log10(step) - 1e-9)); };
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',') : '–');
  const adig = v => { v = Math.abs(v); if (v === 0) return 0; return v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : v >= 0.1 ? 3 : 4; };
  const fauto = v => (fin(v) ? fnum(v, adig(v)) : '–');
  const parseNum = s => { const C = CORE(); if (C && typeof C.parseNum === 'function') { const v = C.parseNum(s); if (fin(v)) return v; if (typeof s === 'number') return NaN; } return fin(s) ? s : parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.')); };
  const clickSnd = k => { if (root.LochFX) try { root.LochFX.sound(k || 'tick'); } catch (e) {} };
  const reducedMotion = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };

  /* ============================================================ Symbolsatz: {sym:key}-Platzhalter und feste Symbole nur über THM_CORE.sym */
  const SYMFB = { db: { Tj: 'Tj', Tc: 'Tc', Tk: 'Tk', Ta: 'Ta', P: 'P' }, de: { Tj: 'ϑj', Tc: 'ϑG', Tk: 'ϑK', Ta: 'ϑU', P: 'P_V' } };
  const symSet = () => (S.sym === 'de' ? 'de' : 'db');
  function sy(key) {
    const C = CORE(); let r;
    if (C && typeof C.sym === 'function') { try { r = C.sym(key, symSet()); } catch (e) { r = null; } }
    return typeof r === 'string' && r ? r : ((SYMFB[symSet()] || {})[key] || key);
  }
  const sx = s => { s = String(s == null ? '' : s); return s.indexOf('{sym:') < 0 ? s : s.replace(/\{sym:([^}]+)\}/g, (m, k) => sy(k.trim())); };
  const syMax = () => sy('Tj') + ',max';

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
  root.LabUI = { sheet, esc, toast, userName: () => lsRaw('lm4.name', ''), LAB: 'thm' };
  root.sheet = sheet; root.toast = toast;

  /* ============================================================ Notfall-Attrappe (nur wenn THM_RIGS ganz fehlt): ein Einknoten-Modell, kein zweiter Kern */
  const DUMMY = (function () {
    const sl = (key, label, min, max, step, unit, value, group) => ({ key, label, type: 'slider', min, max, step, unit, value, group, help: label + '.' });
    const controls = [sl('pv', 'Verlustleistung', 0, 20, 0.1, 'W', 3.5, 'Bauteil und Last'), { key: 'heatsink', label: 'Kühlkörper', type: 'select', options: [{ value: 'none', label: 'ohne' }, { value: 'm', label: 'Profil m' }], value: 'none', group: 'Montage und Umgebung', help: 'Kühlkörper montieren.' }, sl('ta', 'Umgebungstemperatur', 0, 70, 1, '°C', 25, 'Montage und Umgebung')];
    const meters = [{ key: 'tj', label: 'Sperrschichttemperatur', unit: '°C', digits: 1, min: 0, max: 200 }];
    function create() {
      const c = {}, events = [], h = 0.25; controls.forEach(x => { c[x.key] = x.value; }); let tj = 25, t = 0, acc = 0;
      const rth = () => (c.heatsink === 'm' ? 14.5 : 50), tau = () => (c.heatsink === 'm' ? 500 : 60);
      const rig = {
        id: 'linear', controls, meters, events, presets: [], range: { lo: 0, hi: 200, unit: '°C', digits: 1 }, timeScale: 30, tUnit: 'min', h, view: 'schnitt', params: {},
        setControl(k, v) { const d = controls.find(q => q.key === k); if (!d) return false; c[k] = d.type === 'slider' ? clamp(+v, d.min, d.max) : v; return true; }, getControl(k) { return c[k]; },
        stepProcess(dt) { acc += dt; while (acc >= h) { acc -= h; tj += (c.ta + c.pv * rth() - tj) * (1 - Math.exp(-h / tau())); t += h; } }, step(ms) { rig.stepProcess(ms / 1000 * rig.timeScale); },
        settle() { tj = c.ta + c.pv * rth(); }, readMeters() { return { tj }; },
        state() { return { t, device: '7805', pv: c.pv, tj, tc: tj, tk: tj, ta: c.ta, rthJC: 5, rthCK: 0, rthK: 0, rthTotal: rth(), dJC: 0, dCK: 0, dK: 0, pzul: 0, mode: c.heatsink === 'm' ? 'kk' : 'frei', shutdown: false, shutCount: 0, destroyed: false, short: false, tjMax: 125, faults: [], tau: tau(), heatsink: c.heatsink }; },
        trace() { return { t: [] }; }, curves() { return []; }, reset() { tj = 25; t = 0; acc = 0; events.length = 0; controls.forEach(q => { c[q.key] = q.value; }); }, worldSize() { return { w: 1000, h: 560 }; },
        draw(g, w, hh) { g.fillStyle = '#1b2128'; g.fillRect(0, 0, w, hh); g.fillStyle = '#ff7a3b'; g.fillRect(w * 0.35, hh * 0.15, w * 0.3, hh * 0.5 * clamp(tj / 200, 0.05, 1)); g.fillStyle = '#8d99a6'; g.font = '600 16px system-ui'; g.textAlign = 'center'; g.fillText('Notfall-Attrappe: die Prüfstände sind nicht geladen', w / 2, hh * 0.9); },
        hitTest() { return null; }, steady() { return {}; }, chain() { return {}; }, cfg() { return {}; }, analysis() { return { ok: false, steps: ['Notfall-Attrappe'], warn: [] }; }, identify() { return { tau: tau(), tau63: tau() }; }, thermalInfo() { return { P: c.pv, ta: c.ta }; }, diagnose() { return []; }, applyPreset() { return false; }
      };
      return rig;
    }
    return { id: 'linear', name: 'Linearregler (Notfall-Attrappe)', icon: '🔥', info: 'Einfache Ersatzanzeige, bis die echten Prüfstände geladen sind.', controls, meters, create, attrappe: true };
  })();
  const defOf = id => {
    const r = root.THM_RIGS;
    if (r && r.defs && r.defs[id]) return r.defs[id];
    if (!r && id === 'linear') return DUMMY;
    return null;
  };
  const rigName = id => { const d = defOf(id); return (d && !d.attrappe && d.name) || (RIGMETA[id] || {}).name || id; };
  const rigIcon = id => { const d = defOf(id); return (d && d.icon) || (RIGMETA[id] || {}).icon || '🌡️'; };

  /* ============================================================ Zustand */
  const S = {
    tab: lsRaw('thm.tab', 'rig'), rigId: null, rig: null, main: 'linear', err: '', name: 'Neuer Versuch', id: null, task: null, dirty: false,
    running: false, speed: +lsRaw('thm.speed', '1') || 1, sym: lsRaw('thm.sym', 'db') === 'de' ? 'de' : 'db', views: {}, slots: {},
    ctl: {}, simT: 0, rows: {}, live: null, seqRes: null, seqPrev: null, readonly: false, seqDur: {}, seqSettle: {}, hist: null, marks: [], viewS: { mul: 1, off: 0, full: false }, ghost: null,
    throttled: false, calcUsed: false, montage: false, compared: false, shutSeen: false, viewChanged: false, curSel: {}, vergl: lsGet('thm.vergl', null)
  };
  const TABS = [['rig', '🌡️', 'Prüfstand'], ['calc', '🧮', 'Rechnen'], ['cmp', '⚖️', 'Vergleichen'], ['seq', '⏱️', 'Ablauf'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Lernen']];
  if (!TABS.some(x => x[0] === S.tab)) S.tab = 'rig';
  { const v = lsGet('thm.view', {}); S.views = v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  const SPEEDS = [0.5, 1, 2, 5, 20];
  if (!SPEEDS.includes(S.speed)) S.speed = 1;

  /* ---- Tastenkürzel: EINE Tabelle für Behandler, Hilfe-Blatt und Menü (Regel 5) ---- */
  const KEYS = [
    { id: 'run', keys: ['Leertaste'], match: e => e.key === ' ', t: 'Prüfstand starten und anhalten', act: () => setRun(!S.running) },
    { id: 'enter', keys: ['Eingabe', 'F5'], ext: true, t: 'Starten und anhalten (gilt auch außerhalb der Bildfläche)' },
    { id: 'reset', keys: ['Z'], match: e => e.key.toLowerCase() === 'z' && !(e.ctrlKey || e.metaKey), t: 'Prüfstand zurücksetzen (Reset)', act: () => resetRig() },
    { id: 'fx', keys: ['E'], match: e => e.key.toLowerCase() === 'e', t: 'Effekte und Ton ein oder aus', act: () => toggleFx() },
    { id: 'speed', keys: ['1', '2', '3', '4', '5'], match: e => e.key >= '1' && e.key <= '5', t: 'Zeitraffer ×0,5 / ×1 / ×2 / ×5 / ×20', act: e => setSpeed(SPEEDS[+e.key - 1]) },
    { id: 'settle', keys: ['B'], match: e => e.key.toLowerCase() === 'b', t: 'Beharrungszustand: gleich eingeschwungen', act: () => settleNow() },
    { id: 'view', keys: ['V'], match: e => e.key.toLowerCase() === 'v' && !(e.ctrlKey || e.metaKey), t: 'Ansicht wechseln (Schnittbild, Wärmebild, Ersatzschaltbild, Balken)', act: () => nextView() },
    { id: 'save', keys: ['Strg + S'], match: e => (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's', t: 'Versuch speichern', act: () => doSave() },
    { id: 'help', keys: ['?'], ext: true, t: 'Diese Übersicht' }
  ];
  function keysHtml() {
    const kd = a => a.map(x => `<code>${esc(x)}</code>`).join(' oder ');
    return '<table>' + KEYS.map(k => `<tr><td style="white-space:nowrap">${kd(k.keys)}</td><td>${esc(k.t)}</td></tr>`).join('') + '</table><p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>';
  }
  root.THM_KEYS = KEYS;

  let recAcc = 0, drawErr = false, curT = 0;
  const ctlsOf = () => (S.rig ? (S.rig.controls || (defOf(S.rigId) || {}).controls || []) : []);
  const metersOf = () => (S.rig ? (S.rig.meters || (defOf(S.rigId) || {}).meters || []) : []);
  const ctlDef = (key, list) => (list || ctlsOf()).find(c => c.key === key);
  const hasCtl = k => !!ctlDef(k);
  const TU = () => (S.rig && S.rig.tUnit) || 'min';
  const toU = s => s / (TDIV[TU()] || 1);
  const fromU = v => v * (TDIV[TU()] || 1);
  const tstr = (s, d) => { const v = toU(s); return fnum(v, d == null ? adig(v) : d) + ' ' + TU(); };
  const tstamp = s => { const v = toU(+s || 0); return fnum(v, adig(v)) + ' ' + TU(); };
  const rng = () => (S.rig && S.rig.range) || { lo: 0, hi: 200, unit: '°C', digits: 1 };
  /* Wert an die Definition anpassen (Auswahl über Wert oder Beschriftung, Schieber begrenzen); undefined = nicht passend */
  function coerce(def, v) {
    if (!def) return undefined;
    if (def.type === 'slider') { v = typeof v === 'string' ? parseNum(v) : +v; if (!fin(v)) return undefined; return clamp(v, def.min, def.max); }
    if (def.type === 'switch' || def.type === 'button') return !!v;
    if (def.type === 'select') {
      const o = def.options || [];
      const m = o.find(x => x.value === v) || o.find(x => String(x.value) === String(v)) || (typeof v === 'number' ? o.find(x => typeof x.value === 'number' && Math.abs(x.value - v) <= 1e-9 * Math.max(1, Math.abs(v))) : null) || o.find(x => String(x.label).toLowerCase() === String(v).toLowerCase());
      return m ? m.value : undefined;
    }
    return v;
  }

  /* ============================================================ Prüfstände (Plätze) und Steuerwerte */
  /* Jeder Prüfstand hat einen Platz (slot) mit Objekt, Aufzeichnung und Marken; der Wechsel zwischen Prüfstand und Vergleichen schaltet nur um. */
  const newHist = () => ({ t: [], tj: [], tc: [], tk: [], ta: [], p: [], tja: [], tjb: [], tjc: [] });
  function resetRun() {
    S.running = false; S.simT = 0; S.live = null; S.seqRes = null; S.viewS.off = 0; S.hist = newHist(); S.marks = []; S.diag = []; S.diagSeen = {}; S.shutNote = null;
    if (S.slots[S.rigId]) { S.slots[S.rigId].hist = S.hist; S.slots[S.rigId].marks = S.marks; }
  }
  function bindSlot(id) {
    const sl = S.slots[id]; S.rigId = id; S.rig = sl ? sl.rig : null; S.hist = sl ? sl.hist : newHist(); S.marks = sl ? sl.marks : [];
    if (MAIN.includes(id)) S.main = id;
    S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; S.st = null; S.curveCache = null; S.diagSeen = {}; S.diag = [];
    if (S.rig) { S.rig.view = S.views[id] || (id === 'vergleich' ? 'balken' : 'schnitt'); S.rig.symSet = symSet(); S.rig.reduced = reducedMotion(); }
  }
  /* neuen Prüfstand erzeugen (frisch) */
  function setRig(id, o) {
    o = o || {};
    if (!ORDER.includes(id)) id = ORDER[0];
    S.err = ''; S.ctl = {}; S.preset = null; S.viewS.mul = 1; S.viewS.full = false;
    const d = defOf(id); let rig = null;
    if (d) { try { rig = d.create(o.opts || {}); } catch (e) { S.err = (e && e.message) || String(e); console.error('Prüfstand ' + id + ':', e); } }
    S.slots[id] = { rig, hist: newHist(), marks: [] };
    bindSlot(id); S.running = false; S.simT = 0; S.live = null; S.seqRes = null; fxReset();
    if (!S.rows[id]) S.rows[id] = [];
    S.attrappe = !!(d && d.attrappe);
    afterRigChange(); applyVerglPending();
    saveCurSoon();
  }
  /* vorhandenen Prüfstand wieder einschalten (Wechsel Prüfstand und Vergleichen), sonst neu erzeugen */
  function useRig(id) {
    if (S.rigId === id && S.rig) return;
    if (S.slots[id] && S.slots[id].rig) { S.live = null; bindSlot(id); S.ctl = {}; S.running = false; fxReset(); afterRigChange(); applyVerglPending(); }
    else setRig(id);
  }
  function afterRigChange() {
    buildPick(); buildPresets(); buildControls(); buildMeters(); buildBar(); fitCanvas(); updateEvents(true); updateChrome(); readState(); sample();
    if (S.tab === 'seq') renderSeq(); if (S.tab === 'calc') renderExt('calc'); if (S.tab === 'help') renderExt('help'); renderCmp(); drawCurves(true);
  }
  const SELFIRST = c => (c && (c.type === 'select' || c.type === 'switch') ? 0 : 1);
  /* mehrere Steuerwerte setzen: map { key: Wert }, Auswahlfelder zuerst (Bauteil, Kühlkörper), nur passende Schlüssel, ohne Hinweise */
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
    let old; try { old = S.rig.getControl(key); } catch (e) {}
    let ok = true; try { ok = S.rig.setControl(key, v) !== false; } catch (e) { console.error(e); return false; }
    if (!ok) { syncCtl(true); toast('Diesen Wert gibt es an dieser Anlage nicht.'); return false; }
    S.ctl[key] = v;
    if (!silent) {
      S.dirty = true; saveCurSoon();
      if (!S.running && def.type !== 'button' && !S.live && (S.tab === 'rig' || S.tab === 'cmp')) setRun(true, true);
      if (MONTAGE_KEYS.some(m => key === m || key.indexOf(m + '_') === 0) && old !== v) { S.montage = true; notePaste(); }
      if (S.rigId === 'vergleich') S.compared = true;
    }
    readState(); syncCtl(); return true;
  }
  const allCtl = () => { const o = {}; if (S.rig) ctlsOf().forEach(c => { try { const v = S.rig.getControl(c.key); if (v !== undefined && c.type !== 'button') o[c.key] = v; } catch (e) {} }); return o; };
  const curRows = () => S.rows[S.rigId] || (S.rows[S.rigId] = []);
  function saveCurSoon() { clearTimeout(curT); curT = setTimeout(saveCur, 400); }
  function saveCur() { if (!S.rig) return; lsSet('thm.cur', { rig: S.rigId, main: S.main, ctl: allCtl(), rows: S.rows, name: S.name, id: S.id, task: S.task ? S.task.id : null, dirty: S.dirty, dur: S.seqDur, settle: S.seqSettle }); }
  function usedRig() {
    if (S.attrappe || !S.rigId) return;
    const a = lsGet('thm.rigsused', []), s = new Set(Array.isArray(a) ? a : []); s.add(S.rigId); lsSet('thm.rigsused', [...s]); stat('thmrigs', s.size, 'max');
  }
  function readState() { if (!S.rig) { S.st = null; return null; } try { S.st = S.rig.state(); } catch (e) { S.st = S.st || null; } return S.st; }
  /* Paste mit und ohne bei Glimmer erlebt: im Prüfstand beide Zustände auf demselben Aufbau, im Vergleich zwei Aufbauten, die sich nur in der Paste unterscheiden */
  function notePaste() {
    if (!S.rig) return;
    try {
      if (S.rigId === 'vergleich') {
        const g = X => ({ hs: S.rig.getControl('heatsink_' + X), j: S.rig.getControl('joint_' + X), p: S.rig.getControl('paste_' + X), f: S.rig.getControl('fan_' + X) });
        const L = ['a', 'b', 'c'].slice(0, +S.rig.getControl('n') || 3).map(g);
        for (let i = 0; i < L.length; i++) for (let k = i + 1; k < L.length; k++) { const a = L[i], b = L[k]; if (a.hs !== 'none' && a.hs === b.hs && a.j === 'glimmer' && b.j === 'glimmer' && a.f === b.f && a.p !== b.p && [a.p, b.p].includes('keine') && [a.p, b.p].includes('duenn')) stat('thmpaste', 1, 'max'); }
      } else if (S.rig.getControl('joint') === 'glimmer' && S.rig.getControl('heatsink') !== 'none') {
        const seen = new Set(lsGet('thm.pastesee', []) || []); const p = S.rig.getControl('paste'); if (p === 'keine' || p === 'duenn') { seen.add(S.rigId + ':' + p); lsSet('thm.pastesee', [...seen]); if (seen.has(S.rigId + ':keine') && seen.has(S.rigId + ':duenn')) stat('thmpaste', 1, 'max'); }
      }
    } catch (e) {}
  }

  /* ---- Prüfstandwahl (große Karten), Werkzeugleiste, Voreinstellungen ---- */
  function buildPick() {
    const el = $('#rigPick'); if (!el) return;
    el.innerHTML = MAIN.map(id => {
      const have = !!defOf(id) && !(defOf(id).attrappe && id !== 'linear'), m = RIGMETA[id], on = id === S.main && S.tab !== 'cmp';
      return `<button class="thm-card${on ? ' on' : ''}" data-rig="${id}" aria-pressed="${on}" style="${have ? '' : 'opacity:.6'}"><span class="ic">${rigIcon(id)}</span><b>${esc(SHORT[id])}${have ? '' : ' ⚠'}</b><small>${esc(m.info)}</small></button>`;
    }).join('');
  }
  $('#rigPick').addEventListener('click', e => { const b = e.target.closest('[data-rig]'); if (b) usePick(b.dataset.rig); });
  function usePick(id) {
    if (id === S.rigId && S.tab === 'rig') return;
    if (S.task) { toast('Während einer Aufgabe ist der Prüfstand fest. Beende zuerst die Aufgabe.'); return; }
    if (id === S.rigId) return;
    stash(); S.name = 'Neuer Versuch'; S.id = null; S.dirty = false; setRig(id); toast('Prüfstand: ' + rigName(id));
  }
  const presetsOf = () => (S.rig && (S.rig.presets || (defOf(S.rigId) || {}).presets)) || [];
  function buildPresets() {
    const P = presetsOf(), el = $('#presetBar');
    if (!P.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="gh" style="padding-top:2px">Voreinstellung</div><div class="chips">${P.map(p => `<button class="chip s${S.preset === p.id ? ' on' : ''}" data-pre="${esc(p.id)}">${esc(sx(p.name))}</button>`).join('')}</div>`;
  }
  $('#presetBar').addEventListener('click', e => {
    const b = e.target.closest('[data-pre]'); if (!b || !S.rig) return;
    const p = presetsOf().find(x => String(x.id) === b.dataset.pre); if (!p) return;
    S.preset = p.id; let done = false;
    for (const fn of ['applyPreset', 'setPreset']) if (typeof S.rig[fn] === 'function') { try { S.rig[fn](p.id, p.params || p.values); done = true; } catch (er) { console.error(er); } break; }
    if (!done) { try { S.rig = defOf(S.rigId).create({ preset: p.id, params: p.params, seed: 1 }); S.slots[S.rigId].rig = S.rig; bindSlot(S.rigId); } catch (er) { console.error(er); toast('Voreinstellung nicht möglich'); return; } }
    S.evSeen = new WeakSet(); S.evSig = ''; const hs = S.hist; resetRun(); S.hist = hs; S.slots[S.rigId].hist = hs; S.ctl = {};
    S.rig.view = S.views[S.rigId] || (S.rigId === 'vergleich' ? 'balken' : 'schnitt'); S.rig.symSet = symSet();
    buildControls(); buildMeters(); buildPresets(); readState(); sample(); updateEvents(true); updateChrome(); drawCurves(true); renderCmp(); toast('Voreinstellung: ' + sx(p.name)); S.dirty = true; saveCurSoon();
  });

  /* ---- Platzhalter, wenn ein Prüfstand fehlt ---- */
  function placeholderHtml() {
    const why = S.err ? 'Der Prüfstand konnte nicht gestartet werden: ' + esc(S.err) : 'Die Datei für „' + esc(rigName(S.rigId)) + '“ (' + esc(RIGFILE[S.rigId] || '') + ') ist noch nicht geladen.';
    return `<div class="ph2"><b>Prüfstand noch nicht geladen</b>${why}<br><button class="btn" data-retry>Erneut prüfen</button></div>`;
  }
  function retryLoad() {
    const want = [];
    if (!root.THM_CORE) want.push('thmcore.js'); if (!root.THM_DRAW) want.push('thmdraw.js'); if (!root.THM_DATA && !root.THM_TASKS) want.push('thmdata.js');
    ORDER.forEach(id => { if (!(root.THM_RIGS && root.THM_RIGS.defs && root.THM_RIGS.defs[id])) want.push(RIGFILE[id]); });
    if (!want.length) { setRig(S.rigId); toast('Alles geladen'); return Promise.resolve(); }
    toast('Lade fehlende Dateien …');
    return Promise.all(want.map(f => new Promise(res => { const s = document.createElement('script'); s.src = f + '?t=' + Date.now(); s.onload = s.onerror = () => res(); document.head.appendChild(s); }))).then(() => {
      const still = ORDER.filter(i => !defOf(i)).length;
      const keep = S.rig ? allCtl() : ((lsGet('thm.cur', {}) || {}).ctl || {}); setRig(S.rigId); applyCtl(keep); buildPick();
      if (S.tab === 'tasks') renderTasks(); toast(still ? still + ' Prüfstand' + (still > 1 ? 'e fehlen' : ' fehlt') + ' noch' : 'Alle Prüfstände geladen');
    });
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-retry]')) retryLoad(); });

  /* ============================================================ Bedienpult aus rig.controls (Gruppen "Bauteil und Last", "Montage und Umgebung") */
  let panels = [];
  const slPos = (c, v) => { if (c.scale === 'log' && c.min > 0 && c.max > c.min) return Math.round(1000 * Math.log(clamp(v, c.min, c.max) / c.min) / Math.log(c.max / c.min)); return Math.round(1000 * (clamp(v, c.min, c.max) - c.min) / ((c.max - c.min) || 1)); };
  function slVal(c, pos) {
    let v = c.scale === 'log' && c.min > 0 && c.max > c.min ? c.min * Math.pow(c.max / c.min, pos / 1000) : c.min + (c.max - c.min) * pos / 1000;
    if (c.step && !(c.scale === 'log')) v = Math.round(v / c.step) * c.step; else if (c.scale === 'log') { const d = fin(v) ? Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, v))) - 2) : 0.01; v = Math.round(v / d) * d; }
    return clamp(+v.toPrecision(10), c.min, c.max);
  }
  const ctlUnit = c => c.unit || '';
  const ctlShow = (c, v) => fnum(v, c.scale === 'log' ? adig(v) : decs(c.step));
  /* kleine Bilder für die Montage-Schalter (Tube, Scheibe, Kühlkörper, Lüfter, Schraube, Thermometer) */
  const IC = {
    paste: '<svg class="thm-ic" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 12h14l5-3v14l-5-3H5z"/><path d="M24 12h3v8h-3"/><path d="M9 12v8M13 12v8"/></svg>',
    joint: '<svg class="thm-ic" viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="12" rx="11" ry="4"/><path d="M5 12v6c0 2.2 4.9 4 11 4s11-1.8 11-4v-6"/><circle cx="16" cy="12" r="1.8"/></svg>',
    heatsink: '<svg class="thm-ic" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 26h24M7 26V8M12 26V6M17 26V6M22 26V6M27 26V8"/></svg>',
    fan: '<svg class="thm-ic" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="2.2"/><path d="M16 14c-1-5 1-9 4-9 2 2 1 6-2 8M18 16c5-1 9 1 9 4-2 2-6 1-8-2M16 18c1 5-1 9-4 9-2-2-1-6 2-8M14 16c-5 1-9-1-9-4 2-2 6-1 8 2"/></svg>',
    screw: '<svg class="thm-ic" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 6h16v4H8zM12 10v16M20 10v16M12 14l8 2M12 18l8 2M12 22l8 2"/></svg>',
    orient: '<svg class="thm-ic" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 25h22M9 25V10M14 25V10M19 25V10M24 25V10"/><path d="M16 4v3M13 6l3-3 3 3"/></svg>',
    bushing: '<svg class="thm-ic" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="9"/><circle cx="16" cy="16" r="4"/></svg>'
  };
  const iconOf = key => IC[key] || '';
  function ctlHtml(c) {
    const k = esc(c.key), lab = sx(c.label), hp = c.help ? sx(c.help) : '', help = hp ? `<small class="hp">${esc(hp)}</small>` : '', ic = iconOf(c.key), big = ic ? ' big' : '';
    if (c.type === 'slider') return `<div class="ct" data-k="${k}" data-t="slider" title="${esc(hp)}"><div class="ctl"><span class="lb">${ic}${esc(lab)}</span><span class="vi"><input class="num" inputmode="decimal" autocomplete="off" aria-label="${esc(lab)}, Wert eingeben"><small class="un"></small></span></div>${help}<input type="range" min="0" max="1000" step="1" value="0" aria-label="${esc(lab)}"></div>`;
    if (c.type === 'switch') return `<div class="ct p0${big}" data-k="${k}" data-t="switch" title="${esc(hp)}"><button class="sw" role="switch" aria-checked="false" aria-label="${esc(lab)}"><span class="lab">${ic}<span>${esc(lab)}${help}</span></span><span class="tgl"><i></i></span></button></div>`;
    if (c.type === 'button') return `<div class="ct p0" data-k="${k}" data-t="button" title="${esc(hp)}"><button class="bt">${esc(lab)}${c.key === 'from' ? '' : ' (halten)'}</button>${help ? `<div style="padding:0 12px 4px">${help}</div>` : ''}</div>`;
    if (c.type === 'select') {
      const o = c.options || [], tt = x => (x.help ? ` title="${esc(sx(x.help))}"` : '');
      const body = o.length <= 4 ? `<div class="seg">${o.map((x, i) => `<button data-i="${i}"${tt(x)}>${esc(sx(x.label))}</button>`).join('')}</div>`
        : o.length <= 8 ? `<div class="seg wrap">${o.map((x, i) => `<button data-i="${i}"${tt(x)}>${esc(sx(x.label))}</button>`).join('')}</div>` : `<select aria-label="${esc(lab)}">${o.map((x, i) => `<option value="${i}">${esc(sx(x.label))}</option>`).join('')}</select>`;
      return `<div class="ct${big}" data-k="${k}" data-t="select" title="${esc(hp)}"><div class="ctl"><span class="lb">${ic}${esc(lab)}</span></div>${help}${body}</div>`;
    }
    return '';
  }
  /* host: Behälter; Gruppen aus c.group in der Reihenfolge "Bauteil und Last", dann "Montage und Umgebung", dann übrige */
  function buildPanel(host) {
    panels = panels.filter(p => p.host !== host && p.host.isConnected);
    if (!S.rig) { host.innerHTML = '<div class="card">' + placeholderHtml() + '</div>'; return; }
    const list = ctlsOf(), groups = [], gm = {};
    list.forEach(c => { const g = c.group || 'Bedienung'; if (!gm[g]) { gm[g] = { n: g, items: [] }; groups.push(gm[g]); } gm[g].items.push(c); });
    const rank = n => (/^Montage/.test(n) ? 2 : /^Bauteil/.test(n) ? 0 : 1);
    groups.sort((a, b) => rank(a.n) - rank(b.n));
    host.innerHTML = groups.map(g => `<details class="card ctg" open><summary>${esc(sx(g.n))}</summary><div class="cb">${g.items.map(ctlHtml).join('')}</div></details>`).join('');
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
      if (!force && x.last === v) return; x.last = v; const el = x.el;
      if (c.type === 'slider') {
        const inp = $('input[type=range]', el), num = $('.num', el), un = $('.un', el), n = +v;
        if (fin(n)) { if (document.activeElement !== inp || force) inp.value = slPos(c, n); if (document.activeElement !== num || force) num.value = ctlShow(c, n); }
        un.textContent = ctlUnit(c);
      } else if (c.type === 'switch') $('button', el).setAttribute('aria-checked', v ? 'true' : 'false');
      else if (c.type === 'button') $('button', el).classList.toggle('on', !!v);
      else if (c.type === 'select') {
        const o = c.options || [], i = o.findIndex(q => q.value === v || String(q.value) === String(v));
        $$('.seg button', el).forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
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
      if (num) { const el = num.closest('.ct'), c = ctlDef(el.dataset.k); if (!c) return; const v = parseNum(num.value); if (fin(v)) setCtl(c.key, v); syncCtl(true); return; }
      if (sel) { const el = sel.closest('.ct'), c = ctlDef(el.dataset.k); if (c) setCtl(c.key, (c.options || [])[+sel.value].value); }
    });
    H.addEventListener('click', e => {
      const sw = e.target.closest('.sw'), sg = e.target.closest('.seg button');
      if (sw) { const k = sw.closest('.ct').dataset.k; setCtl(k, !S.rig.getControl(k)); clickSnd('click'); }
      else if (sg) { const el = sg.closest('.ct'), c = ctlDef(el.dataset.k); if (c) { setCtl(c.key, (c.options || [])[+sg.dataset.i].value); clickSnd('tick'); } }
    });
    H.addEventListener('pointerdown', e => {
      const b = e.target.closest('.bt'); if (!b || !S.rig) return; e.preventDefault(); const k = b.closest('.ct').dataset.k;
      if (k === 'from') { verglFromMain(); clickSnd('click'); return; }
      try { b.setPointerCapture(e.pointerId); } catch (x) {} hold = { id: e.pointerId, k }; setCtl(k, true); clickSnd('tick');
    });
    const up = e => { if (!hold || (e.pointerId != null && hold.id !== e.pointerId)) return; const k = hold.k; hold = null; setCtl(k, false, true); };
    H.addEventListener('pointerup', up); H.addEventListener('pointercancel', up); H.addEventListener('lostpointercapture', up);
    H.addEventListener('contextmenu', e => { if (e.target.closest('.bt,.sw')) e.preventDefault(); });
  }

  /* ============================================================ Messgeräte aus rig.meters (Zahlen, dazu Thermometer für Tj) */
  let mEls = [], thEl = null;
  function buildMeters() {
    const H = $('#meters'); mEls = []; thEl = null;
    if (!S.rig) { H.innerHTML = ''; return; }
    const ms = metersOf();
    H.innerHTML = `<div class="mt th" id="mTh" aria-label="Thermometer Sperrschicht"><canvas></canvas><div><div class="lbl">${esc(sy('Tj'))} Thermometer</div><div class="num"><span class="v">–</span><small>°C</small></div><div class="lbl" id="mThSub"></div></div></div>` +
      ms.map((m, i) => `<button class="mt dg" data-i="${i}" aria-label="${esc(sx(m.label))}: Rechenweg anzeigen"><span class="qi" aria-hidden="true">i</span><div class="lbl">${esc(sx(m.label))}</div><div class="num"><span class="v">–</span><small>${esc(sx(m.unit || ''))}</small></div></button>`).join('');
    mEls = $$('.mt.dg', H).map((el, i) => ({ el, m: ms[i], v: $('.v', el), txt: '', warn: false }));
    const t = $('#mTh', H); thEl = { el: t, cv: $('canvas', t), v: $('.v', t), sub: $('#mThSub', t), sig: '' };
  }
  $('#meters').addEventListener('click', e => { const b = e.target.closest('.mt.dg'); if (b) meterHelp(+b.dataset.i); });
  /* Schritt des Rechenwegs: Text oder { n, title, lines:[…], text } (so liefert THM_CORE.recipe die Schritte) */
  const stepLi = s => { if (typeof s === 'string') return `<li>${esc(sx(s))}</li>`; const ls = Array.isArray(s && s.lines) ? s.lines : [(s && s.text) || '']; return `<li>${s && s.title ? '<b>' + esc(sx(s.title)) + '</b><br>' : ''}${ls.map(l => esc(sx(l))).join('<br>')}</li>`; };
  /* Hilfe-Symbol: Rechenweg mit Live-Zahlen aus rig.analysis() (= THM_CORE.recipe) */
  function meterHelp(i) {
    const m = metersOf()[i]; if (!m || !S.rig) return;
    let a = null; try { a = typeof S.rig.analysis === 'function' ? S.rig.analysis() : null; } catch (e) { a = null; }
    const steps = a && Array.isArray(a.steps) ? a.steps : [], warn = a && Array.isArray(a.warn) ? a.warn : [], val = (() => { try { return (S.rig.readMeters() || {})[m.key]; } catch (e) { return NaN; } })();
    sheet(sx(m.label), b => {
      b.innerHTML = `<p style="margin-top:0">Aktueller Wert: <b>${fnum(val, m.digits == null ? 1 : m.digits)} ${esc(sx(m.unit || ''))}</b></p>${m.help ? `<p class="hint2">${esc(sx(m.help))}</p>` : ''}` +
        (steps.length ? `<div class="gh">Rechenweg des Prüfstands (mit den Zahlen von jetzt)</div><ol class="res" style="margin:0;padding-left:28px">${steps.map(stepLi).join('')}</ol>` : '<p class="hint2">Der Prüfstand liefert zurzeit keinen Rechenweg.</p>') +
        warn.map(w => `<p class="hint2" style="color:var(--warn)">${esc(sx(w))}</p>`).join('') + '<p class="hint2">Die Zahlen stammen aus derselben Rechnung wie die Anzeige. Im Tab „Rechnen“ kannst du den Weg mit eigenen Werten durchgehen.</p>';
    });
  }
  /* Thermometer mit Skalenzonen: grün bis Tj,max − 10 K, gelb bis Tj,max, rot darüber, schwarz bei Defekt, Marke für die Abschalttemperatur */
  function drawThermo(st) {
    const x = thEl; if (!x || !x.cv || !st) return; const cvs2 = x.cv, w = cvs2.clientWidth, h = cvs2.clientHeight; if (!w || !h) return;
    const d = Math.min(2, root.devicePixelRatio || 1), W = Math.round(w * d), H = Math.round(h * d); if (cvs2.width !== W || cvs2.height !== H) { cvs2.width = W; cvs2.height = H; }
    const g = cvs2.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
    const lo = fin(st.ta) ? Math.min(st.ta, 0) : 0, tjm = fin(st.tjMax) ? st.tjMax : 125, hi = Math.max(tjm + 30, st.tj || 0), y = v => 4 + (h - 14) * (1 - (clamp(v, lo, hi) - lo) / (hi - lo)), cx = Math.round(w * 0.42), tw = 10;
    const css = k => (getComputedStyle(document.documentElement).getPropertyValue(k) || '').trim() || '#888';
    g.fillStyle = css('--well'); g.strokeStyle = css('--chart-axis'); g.lineWidth = 1.2; g.beginPath(); g.roundRect ? g.roundRect(cx - tw / 2, 3, tw, h - 6, 5) : g.rect(cx - tw / 2, 3, tw, h - 6); g.fill(); g.stroke();
    const zone = (a, b, c) => { g.fillStyle = c; g.globalAlpha = 0.28; g.fillRect(cx - tw / 2 + 1, y(b), tw - 2, y(a) - y(b)); g.globalAlpha = 1; };
    zone(lo, tjm - 10, '#4cd964'); zone(tjm - 10, tjm, '#ffb340'); zone(tjm, hi, '#ff5c5c');
    const v = st.tj, col = st.destroyed ? '#111' : v > tjm ? '#ff3b3b' : v > tjm - 10 ? '#ffb340' : '#3fbf5a';
    g.fillStyle = col; g.fillRect(cx - tw / 2 + 2, y(v), tw - 4, y(lo) - y(v)); g.strokeStyle = css('--fg'); g.lineWidth = 1;
    g.font = '10px system-ui'; g.fillStyle = css('--mute'); g.textAlign = 'left';
    [tjm - 10, tjm].forEach(t => { g.beginPath(); g.moveTo(cx + tw / 2, y(t)); g.lineTo(cx + tw / 2 + 5, y(t)); g.stroke(); });
    g.fillText(fnum(tjm, 0), cx + tw / 2 + 6, y(tjm) + 3);
    if (fin(st.tShut)) { g.strokeStyle = '#c77dff'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - tw / 2 - 5, y(st.tShut)); g.lineTo(cx + tw / 2 + 5, y(st.tShut)); g.stroke(); g.fillStyle = '#c77dff'; g.textAlign = 'right'; g.fillText('Abschalt.', cx - tw / 2 - 6, y(st.tShut) + 3); }
  }
  function updateMeters(dt, force) {
    if (!S.rig || !mEls.length) return;
    let vals; try { vals = S.rig.readMeters() || {}; } catch (e) { return; }
    const st = S.st;
    mEls.forEach(x => {
      if (typeof x.m.visible === 'function') { let vis = true; try { vis = !!x.m.visible(st || {}); } catch (e) {} if (vis !== x.vis) { x.vis = vis; x.el.style.display = vis ? '' : 'none'; } }   // Messgeräte, die für das gewählte Bauteil nicht gelten, ausblenden (THM-INT, WUENSCHE WP2b)
      const t = vals[x.m.key]; if (!fin(t)) return;
      const txt = fnum(t, x.m.digits == null ? 1 : x.m.digits); if (txt !== x.txt) { x.txt = txt; x.v.textContent = txt; }
      const wn = (fin(+x.m.warnAbove) && t > +x.m.warnAbove) || (x.m.key === 'tj' && st && fin(st.tjMax) && t > st.tjMax); if (wn !== x.warn) { x.warn = wn; x.el.classList.toggle('warn', wn); }
    });
    if (thEl && st && fin(st.tj)) {
      const tx = fnum(st.tj, 1); if (thEl.v.textContent !== tx) thEl.v.textContent = tx;
      const sub = st.destroyed ? 'Bauteil defekt' : st.shutdown ? 'abgeschaltet' : fin(st.tjMax) ? (syMax() + ' = ' + fnum(st.tjMax, 0) + ' °C, Reserve ' + fnum(st.tjMax - st.tj, 1) + ' K') : '';
      if (thEl.sub.textContent !== sub) thEl.sub.textContent = sub;
      const sig = [Math.round(st.tj * 2), st.destroyed, st.shutdown, S.sym].join('|'); if (force || sig !== thEl.sig) { thEl.sig = sig; drawThermo(st); }
      thEl.el.classList.toggle('warn', fin(st.tjMax) && st.tj > st.tjMax);
    }
  }

  /* ============================================================ Zeichenfläche (Anlage) und Zeigerereignisse */
  const cvs = $('#cv'), g2 = cvs.getContext('2d'), cvw = $('#cvw');
  let cw = 0, ch = 0, dpr = 1;
  const cvfx = document.createElement('canvas'); cvfx.id = 'cvfx'; cvfx.setAttribute('aria-hidden', 'true'); cvfx.style.pointerEvents = 'none'; cvw.appendChild(cvfx);
  const fxg = cvfx.getContext('2d'); let fxDrew = false;
  function worldSz() { try { const w = S.rig && S.rig.worldSize && S.rig.worldSize(); if (w && w.w > 0 && w.h > 0) return w; } catch (e) {} return { w: 1000, h: 560 }; }
  function fitCanvas() {
    const ws = worldSz(), ar = ws.w + '/' + ws.h; if (cvw.style.aspectRatio !== ar) cvw.style.aspectRatio = ar;
    cvw.style.maxHeight = ws.h > ws.w ? '78vh' : '';
    const w = cvw.clientWidth, h = cvw.clientHeight; if (!w || !h) return;
    dpr = Math.min(2, root.devicePixelRatio || 1); const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; }
    if (cvfx.width !== W || cvfx.height !== H) { cvfx.width = W; cvfx.height = H; }
    cw = w; ch = h;
  }
  if (root.ResizeObserver) new ResizeObserver(() => fitCanvas()).observe(cvw);
  root.addEventListener('resize', () => { fitCanvas(); redrawTab(); updateMeters(0, true); });
  const bgOf = () => (getComputedStyle(document.documentElement).getPropertyValue('--cv') || '#14181c').trim();
  function drawRig(ts) {
    if (!cw || cvw.offsetParent === null) return;
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.fillStyle = bgOf(); g2.fillRect(0, 0, cw, ch);
    if (!S.rig) { g2.fillStyle = '#8d99a6'; g2.font = '600 16px system-ui'; g2.textAlign = 'center'; g2.fillText('Prüfstand noch nicht geladen', cw / 2, ch / 2); return; }
    try { S.rig.symSet = symSet(); S.rig.draw(g2, cw, ch, ts); }
    catch (e) { if (!drawErr) { drawErr = true; console.error('Zeichnung des Prüfstands:', e); } }
  }
  const cvPos = e => { const r = cvs.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const holdsC = new Map(); let knob = null;
  /* hitTest liefert { key, kind: 'switch' | 'button' | 'knob', value? }:
     switch = Kippschalter (Ein/Aus oder nächster Wert einer Auswahl, mit value direkt dieser Wert), button = gedrückt halten, knob = Drehregler (ziehen: hoch oder nach rechts erhöht) */
  function toggleCtl(key, value) {
    const def = ctlDef(key); if (!def || !S.rig) return;
    if (value !== undefined) { setCtl(key, value); return; }
    if (def.type === 'select') { const o = def.options || [], i = o.findIndex(q => q.value === S.rig.getControl(key) || String(q.value) === String(S.rig.getControl(key))); setCtl(key, o[(i + 1) % o.length].value); }
    else if (def.type === 'switch') setCtl(key, !S.rig.getControl(key));
  }
  cvs.addEventListener('pointerdown', e => {
    e.preventDefault(); const r = S.rig; if (!r) return; try { cvs.setPointerCapture(e.pointerId); } catch (x) {}
    const [x, y] = cvPos(e); r.pointer = { x, y, down: true };
    if (!r.hitTest) return; let h = null; try { h = r.hitTest(x, y, cw, ch); } catch (er) {} if (!h || !h.key) return;
    if (h.kind === 'switch') { toggleCtl(h.key, h.value); clickSnd('click'); }
    else if (h.kind === 'button') { holdsC.set(e.pointerId, h.key); setCtl(h.key, true); clickSnd('tick'); }
    else if (h.kind === 'knob') { const c = ctlDef(h.key); if (c && (c.type === 'slider' || c.type === 'select')) { let v0 = null; try { v0 = r.getControl(h.key); } catch (er) {} knob = { id: e.pointerId, key: h.key, x0: x, y0: y, c, v0, pos0: c.type === 'slider' ? slPos(c, +v0) : 0, i0: c.type === 'select' ? (c.options || []).findIndex(q => q.value === v0) : 0 }; }
    }
  });
  const cvUp = e => { const k = holdsC.get(e.pointerId); if (S.rig && S.rig.pointer) S.rig.pointer.down = false; if (knob && knob.id === e.pointerId) { knob = null; } if (k == null) return; holdsC.delete(e.pointerId); setCtl(k, false, true); };
  cvs.addEventListener('pointerup', cvUp); cvs.addEventListener('pointercancel', cvUp);
  cvs.addEventListener('pointermove', e => {
    const [x, y] = cvPos(e), r = S.rig; if (!r) return;
    if (e.pointerType === 'mouse' || e.buttons) r.pointer = { x, y, down: !!e.buttons };
    if (knob && knob.id === e.pointerId) {
      const c = knob.c, d = (x - knob.x0) - (y - knob.y0);
      if (c.type === 'slider') setCtl(knob.key, slVal(c, clamp(knob.pos0 + d * 1000 / (0.55 * Math.min(cw, ch)), 0, 1000)));
      else { const o = c.options || [], i = clamp(knob.i0 + Math.round(d / 40), 0, o.length - 1); if (o[i]) setCtl(knob.key, o[i].value); }
      return;
    }
    if (e.pointerType !== 'mouse' || !r.hitTest) return; let h = null; try { h = r.hitTest(x, y, cw, ch); } catch (er) {} cvs.style.cursor = h ? 'pointer' : 'default';
  });
  cvs.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && S.rig && S.rig.pointer && !S.rig.pointer.down) S.rig.pointer = null; });
  cvs.addEventListener('contextmenu', e => e.preventDefault());

  /* ---- Ansicht, Symbolsatz, Beharrungszustand, Vergleich übernehmen (Werkzeugleiste über dem Bild) ---- */
  const symPair = () => { const C = CORE(); const g = k => { let a = 'Tj', b = 'ϑj'; if (C && typeof C.sym === 'function') { try { const x = C.sym(k, 'db'), y = C.sym(k, 'de'); if (typeof x === 'string' && x) a = x; if (typeof y === 'string' && y) b = y; } catch (e) {} } return [a, b]; }; return g('Tj'); };
  function buildBar() {
    const el = $('#rigBar'); if (!el) return; const v = (S.rig && S.rig.view) || 'schnitt', sp = symPair();
    el.innerHTML = `<span class="seg" id="viewSeg" role="group" aria-label="Ansicht">${VIEWS.map(([k, n]) => `<button data-view="${k}" class="${v === k ? 'on' : ''}" aria-pressed="${v === k}">${esc(n)}</button>`).join('')}</span>
      <span class="seg" id="symSeg" role="group" aria-label="Symbolsatz"><button data-sym="db" class="${S.sym === 'db' ? 'on' : ''}" aria-pressed="${S.sym === 'db'}" title="Bezeichnungen wie im Datenblatt">${esc(sp[0])}</button><button data-sym="de" class="${S.sym === 'de' ? 'on' : ''}" aria-pressed="${S.sym === 'de'}" title="Bezeichnungen wie in der Berufsschule">${esc(sp[1])}</button></span>
      <button class="chip s" id="bSettle" title="Gleich eingeschwungen (Taste B)">⚡ Beharrungszustand</button><button class="chip s only-rig" id="bToCmp" title="Bauteil, Verlustleistung, Umgebungstemperatur und Aufbau in den Vergleich legen">⚖ In Vergleich übernehmen</button>`;
  }
  $('#rigBar').addEventListener('click', e => {
    const v = e.target.closest('[data-view]'), s = e.target.closest('[data-sym]');
    if (v) setView(v.dataset.view); else if (s) setSym(s.dataset.sym); else if (e.target.closest('#bSettle')) settleNow(); else if (e.target.closest('#bToCmp')) toCmp();
  });
  function setView(v) {
    if (!S.rig || !VIEWS.some(x => x[0] === v)) return; S.rig.view = v; S.views[S.rigId] = v; lsSet('thm.view', S.views); S.viewChanged = true; buildBar(); S.dirty = true; saveCurSoon();
    if (!S.running) requestAnimationFrame(() => drawRig(performance.now()));
  }
  function nextView() { if (!S.rig || (S.tab !== 'rig' && S.tab !== 'cmp')) return; const i = VIEWS.findIndex(x => x[0] === S.rig.view); setView(VIEWS[(i + 1) % VIEWS.length][0]); toast('Ansicht: ' + VIEWS[(i + 1) % VIEWS.length][1]); }
  function setSym(s) {
    if (s !== 'db' && s !== 'de') return; S.sym = s; lsPut('thm.sym', s); Object.keys(S.slots).forEach(k => { if (S.slots[k].rig) S.slots[k].rig.symSet = s; });
    const C = CORE(); if (C && typeof C.symSet === 'function') { try { C.symSet(s); } catch (e) {} }
    buildPresets(); buildControls(); buildMeters(); buildBar(); updateEvents(true); updateDiag(true); drawCurves(true); renderCmp(true); redrawTab(); updateMeters(0, true);
    const h = $('#helpView'); if (h) { h.dataset.ext = ''; } if (S.tab === 'calc' || S.tab === 'help') renderExt(S.tab);
    if (S.tab === 'tasks') renderTasks(); if (S.tab === 'seq') renderSeq(); updateChrome();
  }
  function settleNow() {
    if (!S.rig || S.readonly) return; try { S.rig.settle(); } catch (e) { console.error(e); toast('Der Prüfstand kennt den Beharrungszustand noch nicht.'); return; }
    readState(); sample(true); S.marks.push({ t: S.simT, label: 'Beharrung' }); const st = S.st || {};
    toast('Beharrungszustand: ' + sy('Tj') + ' = ' + fnum(st.tj, 1) + ' °C, ' + sy('Tk') + ' = ' + fnum(st.tk, 1) + ' °C'); syncCtl(true); updateMeters(0, true); drawScopes(); drawCurves(true); renderCmp(true); clickSnd('tick'); S.dirty = true; saveCurSoon();
    if (!S.running) requestAnimationFrame(() => drawRig(performance.now()));
  }

  /* ---- Effekte (alles über LochFX, geschützt); die Zuordnung fx-Name → Effekt steht NUR hier (SPEC 5.6) ---- */
  const FXKINDS = { smoke: 1, shutdown: 1, spark: 1, defekt: 1, tick: 1, ding: 1 };
  let fxCool = {}, fxBudgetT = 0;
  function fxReset() { fxCool = {}; fxDrew = false; S.shutFx = false; S.dingFx = false; if (root.LochFX && root.LochFX.clear) try { root.LochFX.clear(); } catch (e) {} }
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
      if (e.fx === 'smoke') { if (F.say) F.say('Autsch, ist das heiß!'); F.sound('fizz', 0.5); }
      else if (e.fx === 'shutdown') { if (!S.shutFx) { S.shutFx = true; F.trip(x, y, 'KLACK!', sc * 0.8, {}); F.sound('alarm', 0.6); } }
      else if (e.fx === 'spark') { F.sound('zap'); F.explode(x, y, { part: 'KÜHLKÖRPER', why: 'Kurzschluss', kind: 'chip', color: '255,215,120', text: 'ZAP!', scale: sc * 0.7, sound: 'zap', at: () => [x, y] }); }
      else if (e.fx === 'defekt') { F.explode(x, y, { part: 'REGLER', why: 'Bauteil', kind: 'chip', color: '255,170,60', scale: sc * 0.8, sound: 'crash', at: () => [x, y] }); if (F.say) F.say('Das Bauteil ist defekt. Setze den Prüfstand zurück.'); }
      else if (e.fx === 'ding') { if (!S.dingFx) { S.dingFx = true; F.sound('ding', 0.6); } }
      else if (e.fx === 'tick') F.sound('tick', 0.4);
    } catch (er) {}
  }
  function noteFault(e) {
    const key = S.rigId + ':' + (e.fx || String(e.text || '').slice(0, 28));
    const a = lsGet('thm.faults', []), s = new Set(Array.isArray(a) ? a : []); if (s.has(key)) return;
    s.add(key); lsSet('thm.faults', [...s]); stat('thmfault', s.size, 'max');
  }
  /* neue Meldungen beobachten: Liste, Abzeichenstatistik, Effekte */
  function watchEvents(ts) {
    const r = S.rig; if (!r) return; const ev = r.events || [];
    let changed = false;
    for (let i = Math.max(0, ev.length - 30); i < ev.length; i++) {
      const e = ev[i]; if (!e || S.evSeen.has(e)) continue; S.evSeen.add(e); changed = true;
      if (e.kind === 'error' || (e.fx && FXKINDS[e.fx] && e.fx !== 'tick' && e.fx !== 'ding')) noteFault(e);
      if (e.fx === 'shutdown') { S.shutSeen = true; S.shutNote = { lastT: fin(+e.t) ? +e.t : S.simT }; }
      if (e.kind === 'error') { S.faultUntil = performance.now() + 9000; S.faultText = sx(e.text); if (S.tab !== 'rig' && S.tab !== 'cmp' && S.running) toast('⚠ ' + sx(e.text)); }
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
    const F = root.LochFX; if (!F) return; F.setMuted(fxOn()); lsPut('thm.fx', fxOn() ? '1' : '0'); updateChrome(); toast(fxOn() ? 'Effekte und Ton an' : 'Ton aus');
    if (fxOn()) F.sound('ding', 0.6);
  }

  /* ---- Meldungsliste (Zeitstempel in Prozess-Minuten) und Hinweise aus rig.diagnose() ---- */
  function updateEvents(force) {
    const l = $('#evList'); if (!l) return; const ev = (S.rig && S.rig.events) || [];
    const sig = ev.length + '|' + (ev.length ? (ev[ev.length - 1].text || '') + (ev[ev.length - 1].t || '') : '') + S.sym;
    if (!force && sig === S.evSig) return; S.evSig = sig;
    l.innerHTML = ev.length ? ev.slice(-40).reverse().map(x => `<li class="${esc(x.kind || 'info')}"><time>${esc(tstamp(x.t))}</time><span>${esc(sx(x.text))}</span></li>`).join('') : '<li class="empty">Keine Meldungen. Meldet der Prüfstand etwas (zum Beispiel eine Abschaltung), steht es hier.</li>';
  }
  $('#evClr').onclick = () => { if (S.rig && S.rig.events) { S.rig.events.length = 0; S.evSig = ''; updateEvents(true); } };
  let lastDiag = 0;
  function updateDiag(force) {
    const el = $('#diagList'); if (!el || !S.rig) return;
    const now = performance.now(); if (!force && now - lastDiag < 600) return; lastDiag = now;
    let d = []; try { d = typeof S.rig.diagnose === 'function' ? (S.rig.diagnose() || []) : []; } catch (e) { d = []; }
    S.diag = d;
    d.forEach(x => { if (x && x.id && !S.diagSeen[x.id]) S.diagSeen[x.id] = 1; });
    const h = d.length ? d.map(x => `<li class="${esc(x.kind || 'info')}"><span>${esc(sx(x.text))}</span></li>`).join('') : '<li class="empty">Keine Hinweise: Zu den aktuellen Einstellungen meldet der Prüfstand nichts.</li>';
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  }

  /* ============================================================ Simulation */
  function defSpan() {
    const r = S.rig; if (r && fin(+r.spanS) && +r.spanS > 0) return +r.spanS;
    const rank = hs => (hs === 'l' || hs === 'xl' ? SPAN_BIG : hs && hs !== 'none' ? SPAN_MID : SPAN_FREE); let s = SPAN_FREE;
    try { if (S.rigId === 'vergleich') ['a', 'b', 'c'].forEach(X => { s = Math.max(s, rank(r.getControl('heatsink_' + X))); }); else if (r) s = rank(r.getControl('heatsink')); } catch (e) {}
    return s;
  }
  const viewSpan = () => defSpan() * S.viewS.mul;
  const rigH = () => Math.max(1e-6, (S.rig && S.rig.h) || 0.25);
  const hDt = () => Math.max(rigH(), defSpan() / 900);
  function setRun(on, auto) {
    if (on && !S.rig) { toast('Der Prüfstand ist noch nicht geladen.'); return; }
    S.running = !!on; updateChrome();
    if (on) { stat('thmrun', 1, 'max'); usedRig(); if (auto && !lsRaw('thm.autohint', '')) { lsPut('thm.autohint', '1'); toast('Der Prüfstand läuft jetzt. Mit ⏸ unten hältst du ihn an.'); } }
  }
  function resetRig(quiet) {
    if (!S.rig) return;
    try { S.rig.reset(); } catch (e) { console.error(e); }
    resetRun(); S.ctl = {}; S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; S.curveCache = null; S.rig.view = S.views[S.rigId] || (S.rigId === 'vergleich' ? 'balken' : 'schnitt'); S.rig.symSet = symSet(); fxReset();
    readState(); sample(); syncCtl(true); updateMeters(0, true); updateEvents(true); updateChrome(); renderSeqLive(); drawCurves(true); renderCmp(true); if (!quiet) toast('Prüfstand zurückgesetzt');
  }
  function setSpeed(v) { S.speed = v; lsPut('thm.speed', String(v)); updateChrome(); }
  const lowerBound = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; };
  const nz = v => (fin(+v) ? +v : NaN);
  /* Messschreiber-Speicher: ein Eintrag je hDt Prozess-Sekunden aus state() */
  function sample(force) {
    const st = readState(); if (!st) return; if (fin(st.t)) S.simT = st.t;
    const H = S.hist, n = H.t.length; if (!fin(st.t)) return;
    const put = (i, set) => { H.t[set] = st.t; H.tj[set] = nz(st.tj); H.tc[set] = nz(st.tc); H.tk[set] = nz(st.tk); H.ta[set] = nz(st.ta); H.p[set] = nz(st.pv); H.tja[set] = nz(st.tj_a); H.tjb[set] = nz(st.tj_b); H.tjc[set] = nz(st.tj_c); };
    if (n && st.t <= H.t[n - 1]) { if (force) put(0, n - 1); return; }
    put(0, n);
    if (H.t.length > 24000) Object.keys(H).forEach(k => H[k].splice(0, 2000));
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
    const r = S.rig, ts = r.timeScale || 30, h = rigH(), hs = hDt(), cap = 2000 * h;
    let left = dtMs / 1000 * ts * S.speed; S.throttled = false;
    if (left > cap) { left = cap; S.throttled = true; }
    let guard = 0;
    while (left > 1e-12 && guard++ < 300) {
      let c = Math.min(left, hs - recAcc);
      if (S.live) { liveApply(); const nx = liveNext(); if (nx != null) c = Math.min(c, Math.max(h, nx - S.live.t)); }
      c = Math.max(Math.min(c, left), 1e-9);
      r.step(c / ts * 1000); left -= c; recAcc += c;
      if (S.live) { S.live.t += c; if (S.live.t >= S.live.end) { seqLiveDone(); break; } }
      if (recAcc >= hs * 0.999) { recAcc = 0; sample(); }
    }
  }
  function updateStat() {
    const sEl = $('#stat'); if (!sEl) return;
    const html = (S.running ? '<b class="run" style="color:var(--ok)">LÄUFT</b> ' : '<b>PAUSE</b> ') + 'Prozesszeit ' + tstr(S.simT) + (S.throttled ? ' · <b style="color:var(--warn)">Zeitraffer gedrosselt</b>' : '');
    if (sEl.dataset.h !== html) { sEl.dataset.h = html; sEl.innerHTML = html; }
  }
  /* Abzeichen-Bedingungen aus dem Zustand: Abschaltung erlebt und behoben, Kühlkörper bestätigt, drei Aufbauten verglichen */
  function checkBadges() {
    const st = S.st; if (!st) return;
    if (S.shutNote && st.shutdown === false && fin(st.t) && st.t - S.shutNote.lastT > 600 && fin(st.tjMax) && st.tj < st.tjMax && S.shutNote.lastT >= 0) { stat('thmshut', 1, 'max'); S.shutNote = null; }
    if (S.confirm && st.mode === 'kk' && fin(st.tjMax) && st.tj <= st.tjMax) { stat('thmkuehl', 1, 'max'); S.confirm = false; toast('Bestätigt: Mit diesem Kühlkörper bleibt ' + sy('Tj') + ' = ' + fnum(st.tj, 1) + ' °C unter ' + fnum(st.tjMax, 0) + ' °C.'); }
    if (S.rigId === 'vergleich' && S.running && fin(st.t) && st.t >= 60) { let n = 3; try { n = +S.rig.getControl('n') || 3; } catch (e) {} if (n >= 3) { stat('thmvergl', 1, 'max'); S.compared = true; } }
  }

  /* ============================================================ Diagramme (Canvas, Farben aus den Seitenvariablen) */
  const isDark = () => { const a = document.documentElement.getAttribute('data-theme'); if (a === 'dark') return true; if (a === 'light') return false; try { return !(root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches); } catch (e) { return true; } };
  const COL = { tj: ['#ff5c5c', '#d62d33'], tc: ['#ff9f43', '#c96a00'], tk: ['#e6c200', '#8f7500'], ta: ['#8d99a6', '#5f6b77'], lim: ['#ff5c5c', '#c42b2b'], shut: ['#c77dff', '#8e3fd0'], p: ['#3b9eff', '#1a6fd4'], ghost: ['#9aa7b4', '#7b8791'], mark: ['rgba(76,217,100,.8)', 'rgba(29,138,54,.8)'] };
  const col = k => COL[k][isDark() ? 0 : 1];
  const PAL = ['#3b9eff', '#4cd964', '#ffb340', '#ff5c5c', '#c77dff', '#5be3d9'];
  let thKey = '', thVal = null;
  function theme() {
    const key = (document.documentElement.getAttribute('data-theme') || '') + (isDark() ? 'd' : 'l');
    if (key !== thKey || !thVal) { thKey = key; const cs = getComputedStyle(document.documentElement), v = k => (cs.getPropertyValue(k) || '').trim(); thVal = { grid: v('--chart-grid') || '#26303a', axis: v('--chart-axis') || '#4a5663', mute: v('--mute') || '#8d99a6', fg: v('--fg') || '#e8ecf0' }; }
    return thVal;
  }
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
  /* o: { series:[{name,color,pts,dash,width,alpha}], hlines:[{y,color,dash,label}], vlines:[{x,color,dash,label}|x], points:[{x,y,color,r}], xMin,xMax,yMin,yMax, xLabel,yLabel, noX, marker:{x,y}, cursorX, xLog, strips } */
  function drawChart(cv, o) {
    const c = prepCv(cv); if (!c) return; const { g, w, h } = c, T0 = theme();
    const L = 54, R = 14, T = 12, B = o.noX ? 8 : 38, pw = w - L - R, ph = h - T - B; if (pw < 20 || ph < 14) return;
    const lg = !!o.xLog, fx = v => (lg ? Math.log10(Math.max(v, 1e-9)) : v);
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    (o.series || []).forEach(s => (s.pts || []).forEach(p => { if (fin(p[0]) && fin(p[1]) && (!lg || p[0] > 0)) { xmin = Math.min(xmin, p[0]); xmax = Math.max(xmax, p[0]); ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); } }));
    if (o.marker && fin(o.marker.x) && fin(o.marker.y)) { xmin = Math.min(xmin, o.marker.x); xmax = Math.max(xmax, o.marker.x); ymin = Math.min(ymin, o.marker.y); ymax = Math.max(ymax, o.marker.y); }
    (o.hlines || []).forEach(b => { if (b.fit && fin(b.y)) { ymin = Math.min(ymin, b.y); ymax = Math.max(ymax, b.y); } });
    if (fin(o.xMin)) xmin = o.xMin; if (fin(o.xMax)) xmax = o.xMax; if (fin(o.yMin)) ymin = o.yMin; if (fin(o.yMax)) ymax = o.yMax;
    if (!fin(xmin) || !fin(ymin)) { g.fillStyle = T0.mute; g.font = '14px system-ui'; g.textAlign = 'center'; g.fillText(o.empty || 'Noch keine Daten', w / 2, h / 2); cv._ch = null; return; }
    if (!(xmax > xmin)) xmax = xmin + 1; if (!(ymax > ymin)) ymax = ymin + 1;
    if (!fin(o.yMax)) ymax += (ymax - ymin) * 0.06;
    if (!fin(o.yMin) && ymin > 0 && ymin < (ymax - ymin) * 0.6) ymin = 0;
    const tx = lg ? { t: [1, 10, 100, 1000, 10000, 1e5].filter(v => v >= xmin * 0.999 && v <= xmax * 1.001), s: 1 } : ticksOf(xmin, xmax, Math.max(3, Math.floor(pw / 80))), ty = ticksOf(ymin, ymax, Math.max(2, Math.floor(ph / 40)));
    const X = v => L + pw * (fx(v) - fx(xmin)) / ((fx(xmax) - fx(xmin)) || 1), Y = v => T + ph * (1 - (v - ymin) / (ymax - ymin));
    g.font = '11px system-ui'; g.lineWidth = 1; g.strokeStyle = T0.grid; g.fillStyle = T0.mute; g.textAlign = 'center';
    tx.t.forEach(v => { const x = Math.round(X(v)) + 0.5; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); if (!o.noX) g.fillText(o.xFmt ? o.xFmt(v) : (lg ? String(v) : tickFmt(v, tx.s)), x, T + ph + 14); });
    g.textAlign = 'right';
    ty.t.forEach(v => { const y = Math.round(Y(v)) + 0.5; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.fillText(tickFmt(v, ty.s), L - 6, y + 4); });
    g.strokeStyle = T0.axis; g.strokeRect(L + 0.5, T + 0.5, pw, ph);
    g.fillStyle = T0.mute; g.font = '12px system-ui'; g.textAlign = 'center'; if (!o.noX) g.fillText(o.xLabel || '', L + pw / 2, h - 6);
    if (o.yLabel) { g.save(); g.translate(12, T + ph / 2); g.rotate(-Math.PI / 2); g.fillText(o.yLabel, 0, 0); g.restore(); }
    g.save(); g.beginPath(); g.rect(L, T, pw, ph); g.clip();
    (o.bands || []).forEach(b => { g.fillStyle = b.color || 'rgba(76,217,100,.12)'; g.fillRect(L, Y(b.y1), pw, Y(b.y0) - Y(b.y1)); });
    (o.hlines || []).forEach(b => { const y = Math.round(Y(b.y)) + 0.5; g.strokeStyle = b.color || 'rgba(255,179,64,.7)'; g.lineWidth = b.width || 1.4; g.setLineDash(b.dash || [5, 4]); g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.setLineDash([]); if (b.label) { g.fillStyle = b.color || '#ffb340'; g.font = '11px system-ui'; g.textAlign = 'left'; g.fillText(b.label, L + 4, y - 3); } });
    (o.vlines || []).forEach(v0 => { const v = typeof v0 === 'number' ? { x: v0 } : v0, x = Math.round(X(v.x)) + 0.5; g.strokeStyle = v.color || 'rgba(255,179,64,.55)'; g.lineWidth = v.width || 1; g.setLineDash(v.dash || [3, 4]); g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); g.setLineDash([]); if (v.label) { g.fillStyle = v.color || '#ffb340'; g.font = '11px system-ui'; g.textAlign = 'left'; g.fillText(v.label, x + 3, T + 11); } });
    (o.series || []).forEach((s, i) => {
      const pts = (s.pts || []).filter(p => fin(p[0]) && fin(p[1])); if (!pts.length) return;
      g.strokeStyle = s.color || PAL[i % PAL.length]; g.lineWidth = s.width || 2.2; g.lineJoin = 'round'; g.globalAlpha = s.alpha == null ? 1 : s.alpha; if (s.dash) g.setLineDash(s.dash);
      g.beginPath(); pts.forEach((p, j) => { const x = X(p[0]), y = Y(p[1]); if (j) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    });
    g.restore();
    (o.points || []).forEach(p => { g.fillStyle = p.color || '#ff5c5c'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(X(p.x), Y(p.y), p.r || 6, 0, 7); g.fill(); g.stroke(); });
    if (fin(o.cursorX) && o.cursorX >= xmin && o.cursorX <= xmax) { const x = Math.round(X(o.cursorX)) + 0.5; g.strokeStyle = T0.fg; g.lineWidth = 1; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); }
    if (o.marker && fin(o.marker.x) && fin(o.marker.y)) {
      const mx = X(o.marker.x), my = Y(o.marker.y); g.strokeStyle = T0.mute; g.setLineDash([4, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(mx, T + ph); g.lineTo(mx, my); g.lineTo(L, my); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#ff5c5c'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, 6, 0, 7); g.fill(); g.stroke();
    }
    cv._ch = { L, T, pw, ph, xmin, xmax, ymin, ymax, w, h };
  }
  const cvX = (cv, e) => { const r = cv.getBoundingClientRect(), ch2 = cv._ch; if (!ch2 || !r.width) return null; const px = (e.clientX - r.left) / r.width * cv.clientWidth; const f = (px - ch2.L) / ch2.pw; return f < 0 || f > 1 ? null : ch2.xmin + f * (ch2.xmax - ch2.xmin); };
  /* gestapeltes Balkendiagramm (Kennlinie mit kind 'bars'): { categories:[…], stacks:[{name,color?,values:[…]}], hline:{y,label}, yLabel, yUnit } */
  function drawBars(cv, cur) {
    const c = prepCv(cv); if (!c) return; const { g, w, h } = c, T0 = theme(); const cats = cur.categories || [], st = cur.stacks || [];
    const L = 54, R = 14, T = 12, B = 30, pw = w - L - R, ph = h - T - B; if (pw < 40 || ph < 30 || !cats.length) return;
    const sums = cats.map((_, i) => st.reduce((a, s) => a + (fin(+s.values[i]) ? +s.values[i] : 0), 0)); let ymax = Math.max(1e-6, ...sums, cur.hline && fin(cur.hline.y) ? cur.hline.y : 0) * 1.08;
    const ty = ticksOf(0, ymax, Math.max(2, Math.floor(ph / 40))), Y = v => T + ph * (1 - v / ymax), bw = Math.min(70, pw / cats.length * 0.6);
    g.font = '11px system-ui'; g.lineWidth = 1; g.strokeStyle = T0.grid; g.fillStyle = T0.mute; g.textAlign = 'right'; ty.t.forEach(v => { const y = Math.round(Y(v)) + 0.5; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.fillText(tickFmt(v, ty.s), L - 6, y + 4); });
    cats.forEach((cn, i) => { const x = L + pw * (i + 0.5) / cats.length; let acc = 0; st.forEach((s, k) => { const v = fin(+s.values[i]) ? +s.values[i] : 0; g.fillStyle = s.color || PAL[k % PAL.length]; g.fillRect(x - bw / 2, Y(acc + v), bw, Y(acc) - Y(acc + v)); acc += v; });
      g.fillStyle = T0.fg; g.textAlign = 'center'; g.fillText(cn, x, T + ph + 14); g.fillText(fnum(sums[i], 1), x, Y(acc) - 4); });
    if (cur.hline && fin(cur.hline.y)) { g.strokeStyle = col('lim'); g.setLineDash([5, 4]); g.lineWidth = 1.5; const y = Math.round(Y(cur.hline.y)) + 0.5; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.setLineDash([]); g.fillStyle = col('lim'); g.textAlign = 'left'; g.fillText(sx(cur.hline.label || ''), L + 4, y - 3); }
    g.strokeStyle = T0.axis; g.strokeRect(L + 0.5, T + 0.5, pw, ph);
    if (cur.yLabel) { g.fillStyle = T0.mute; g.save(); g.translate(12, T + ph / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText(sx(cur.yLabel) + (cur.yUnit ? ' in ' + cur.yUnit : ''), 0, 0); g.restore(); }
    cv._ch = null;
  }

  /* ============================================================ Messschreiber (Prüfstand und Vergleichen) */
  const scopeBoxHtml = id => `<div class="scope" id="${id}"><div class="scbar"><button class="chip s" data-sc="half" aria-label="Zeitfenster halbieren">½×</button><button class="chip s" data-sc="dbl" aria-label="Zeitfenster verdoppeln">2×</button><button class="chip s" data-sc="scale" aria-label="Skala umschalten">Skala</button><button class="chip s" data-sc="live" aria-label="Zurück zur Gegenwart">⏭ Live</button><span class="scinfo"></span></div>
    <div class="chartbox sc"><canvas class="scTop" aria-label="Messschreiber: Temperaturen über der Prozesszeit"></canvas></div><div class="chartbox lane"><canvas class="scLane" aria-label="Messschreiber: Verlustleistung über der Prozesszeit"></canvas></div>
    <label class="f scrub"><span>Zeitreise: ziehe nach links, um zurückzuschauen</span><input type="range" class="scScrub" min="0" max="1000" step="1" value="1000"></label><div class="readout scRead"></div></div>`;
  function scopeWin() {
    const H = S.hist, n = H.t.length, sp = viewSpan(); if (!n) return null;
    const tEnd = H.t[n - 1], tStart = H.t[0], maxOff = Math.max(0, tEnd - tStart - sp);
    S.viewS.off = clamp(S.viewS.off, 0, maxOff);
    const t1 = tEnd - S.viewS.off, t0 = t1 - sp, i0 = Math.max(0, lowerBound(H.t, t0) - 1), i1 = Math.min(n, lowerBound(H.t, t1 + 1e-12) + 1);
    return { t0, t1, i0, i1, maxOff, tEnd, tStart, sp };
  }
  function scopeData(win) {
    const H = S.hist, step = Math.max(1, Math.ceil((win.i1 - win.i0) / 700)), d = { tj: [], tc: [], tk: [], ta: [], p: [], t: [], tja: [], tjb: [], tjc: [] };
    for (let i = win.i0; i < win.i1; i += step) { const tt = toU(H.t[i]); d.t.push(H.t[i]); ['tj', 'tc', 'tk', 'ta', 'p', 'tja', 'tjb', 'tjc'].forEach(k => d[k].push([tt, H[k][i]])); }
    return d;
  }
  const shutT = () => { const st = S.st; if (st && fin(st.tShut)) return st.tShut; return null; };
  function drawScope(box) {
    const top = $('.scTop', box), lane = $('.scLane', box); if (!top || !lane) return;
    const win = scopeWin(), info = $('.scinfo', box), rd = $('.scRead', box), scr = $('.scScrub', box);
    if (!win) { drawChart(top, { series: [], empty: 'Der Messschreiber läuft, sobald der Prüfstand läuft (▶ unten).' }); drawChart(lane, { series: [] }); if (info) info.textContent = ''; return; }
    const d = scopeData(win), r = rng(), xs = [toU(win.t0), toU(win.t1)], ser = [], st = S.st || {}, ver = S.rigId === 'vergleich';
    if (S.ghost && S.ghost.t) ser.push({ name: 'gemerkt', color: col('ghost'), alpha: 0.7, width: 2, dash: [8, 5], pts: S.ghost.t.map((t, i) => [toU(t), S.ghost.tj[i]]) });
    if (ver) { const cc = [col('tj'), col('tc'), col('tk')]; [['tja', 'A'], ['tjb', 'B'], ['tjc', 'C']].forEach(([k], i) => ser.push({ name: 'Tj ' + 'ABC'[i], color: cc[i], width: 2.3, dash: i === 1 ? [7, 4] : i === 2 ? [2, 3] : null, pts: d[k] })); ser.push({ name: 'Ta', color: col('ta'), width: 1.6, pts: d.ta }); }
    else ser.push({ name: sy('Ta'), color: col('ta'), width: 1.6, pts: d.ta }, { name: sy('Tk'), color: col('tk'), width: 2, pts: d.tk }, { name: sy('Tc'), color: col('tc'), width: 2, pts: d.tc }, { name: sy('Tj'), color: col('tj'), width: 2.6, pts: d.tj });
    const hl = [], tjm = fin(st.tjMax) ? st.tjMax : null; if (tjm != null) hl.push({ y: tjm, color: col('lim'), dash: [6, 4], label: syMax() + ' = ' + fnum(tjm, 0) + ' °C', fit: true });
    const sh = shutT(); if (sh != null && !ver) hl.push({ y: sh, color: col('shut'), dash: [2, 4], label: 'Abschaltung ' + fnum(sh, 0) + ' °C', fit: true });
    let yMin, yMax; if (S.viewS.full) { yMin = r.lo; yMax = r.hi; } else {
      let lo = Infinity, hi = -Infinity; ['tj', 'tc', 'tk', 'ta', 'tja', 'tjb', 'tjc'].forEach(k => d[k].forEach(p => { if (fin(p[1])) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); } })); if (tjm != null) hi = Math.max(hi, tjm + 4);
      const pad = Math.max((hi - lo) * 0.08, 3); yMin = Math.max(Math.min(r.lo, lo) - pad * 0.2, lo - pad); yMax = hi + pad; if (!fin(lo)) { yMin = r.lo; yMax = r.hi; }
    }
    const vl = S.marks.filter(m => m.t >= win.t0 && m.t <= win.t1).map(m => ({ x: toU(m.t), color: col('mark'), dash: [2, 3], label: m.label }));
    drawChart(top, { series: ser, hlines: hl, vlines: vl, xMin: xs[0], xMax: xs[1], yMin, yMax, noX: true, yLabel: '°C', cursorX: S.cursorT != null ? toU(S.cursorT) : null });
    drawChart(lane, { series: [{ name: 'P', color: col('p'), width: 2, pts: d.p }], vlines: vl, xMin: xs[0], xMax: xs[1], yMin: 0, xLabel: 'Prozesszeit in ' + TU(), yLabel: 'P in W', cursorX: S.cursorT != null ? toU(S.cursorT) : null });
    if (info) { const t = fnum(toU(win.sp), toU(win.sp) >= 10 ? 0 : 1) + ' ' + TU(); const h = 'Fenster ' + t + (S.viewS.off > 0 ? ' · zurückgeschaut' : ' · live'); if (info.textContent !== h) info.textContent = h; }
    if (scr && document.activeElement !== scr) scr.value = win.maxOff > 0 ? String(Math.round(1000 * (1 - S.viewS.off / win.maxOff))) : '1000';
    if (scr) scr.disabled = !(win.maxOff > 0);
    if (rd) {
      let txt = '';
      if (S.cursorT != null) { const H = S.hist; let i = clamp(lowerBound(H.t, S.cursorT), 0, H.t.length - 1); if (i > 0 && Math.abs(H.t[i - 1] - S.cursorT) < Math.abs(H.t[i] - S.cursorT)) i--; txt = 't = <b>' + tstr(H.t[i]) + '</b> · ' + sy('Tj') + ' <b>' + fnum(H.tj[i], 1) + ' °C</b> · ' + sy('Tc') + ' <b>' + fnum(H.tc[i], 1) + ' °C</b> · ' + sy('Tk') + ' <b>' + fnum(H.tk[i], 1) + ' °C</b> · ' + sy('Ta') + ' <b>' + fnum(H.ta[i], 1) + ' °C</b> · P <b>' + fnum(H.p[i], 2) + ' W</b>'; }
      if (rd.dataset.h !== txt) { rd.dataset.h = txt; rd.innerHTML = txt; }
    }
  }
  function wireScope(box) {
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-sc]'); if (!b) return; const k = b.dataset.sc;
      if (k === 'half') S.viewS.mul = Math.max(1 / 16, S.viewS.mul / 2); else if (k === 'dbl') S.viewS.mul = Math.min(16, S.viewS.mul * 2); else if (k === 'scale') S.viewS.full = !S.viewS.full; else if (k === 'live') S.viewS.off = 0;
      drawScopes();
    });
    box.addEventListener('input', e => {
      if (!e.target.classList.contains('scScrub')) return; const win = scopeWin(); if (!win) return;
      S.viewS.off = win.maxOff * (1 - (+e.target.value) / 1000); drawScopes();
    });
    const set = e => { const cv = e.target.closest('canvas'); if (!cv || !cv._ch) return; const x = cvX(cv, e); S.cursorT = x == null ? null : fromU(x); drawScopes(); };
    box.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) set(e); });
    box.addEventListener('pointerdown', e => { const cv = e.target.closest('canvas'); if (cv) { try { cv.setPointerCapture(e.pointerId); } catch (x) {} } set(e); });
    box.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { S.cursorT = null; drawScopes(); } }, true);
  }
  function drawScopes() { $$('.scope').forEach(b => { if (b.offsetParent !== null) drawScope(b); }); }

  /* ---- Aufzeichnung als CSV (Prozesszeit in Minuten, Dezimalkomma, Semikolon) und Rückleser (Roundtrip-Test) ---- */
  const csvNum = v => (fin(v) ? String(+(+v).toPrecision(9)).replace('.', ',') : '');
  const CSVHEAD = () => ['Prozesszeit [min]', sy('Tj') + ' [°C]', sy('Tc') + ' [°C]', sy('Tk') + ' [°C]', sy('Ta') + ' [°C]', 'P [W]'].join(';');
  function csvText() {
    const H = S.hist; const rows = H.t.map((t, i) => [csvNum(t / 60), csvNum(H.tj[i]), csvNum(H.tc[i]), csvNum(H.tk[i]), csvNum(H.ta[i]), csvNum(H.p[i])].join(';'));
    return CSVHEAD() + '\r\n' + rows.join('\r\n') + '\r\n';
  }
  function parseCsv(txt) {
    const lines = String(txt).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean), out = { t: [], tj: [], tc: [], tk: [], ta: [], p: [] };
    lines.slice(1).forEach(l => { const c = l.split(';').map(q => parseFloat(q.replace(',', '.'))); if (c.length >= 6 && c.every(fin)) { out.t.push(c[0] * 60); out.tj.push(c[1]); out.tc.push(c[2]); out.tk.push(c[3]); out.ta.push(c[4]); out.p.push(c[5]); } });
    return out;
  }
  function saveCsv(txt, fallbackName) {
    const blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' });
    if (root.LabExport) root.LabExport.saveBlob(blob, root.LabExport.fname('csv'));
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fallbackName; document.body.appendChild(a); a.click(); a.remove(); }
  }
  function exportCsv() {
    if (!S.hist.t.length) { toast('Noch nichts aufgezeichnet. Starte den Prüfstand.'); return; }
    saveCsv(csvText(), 'thermik-aufzeichnung.csv'); toast('CSV mit ' + S.hist.t.length + ' Messpunkten gespeichert');
  }

  /* ============================================================ Kennlinien (aus rig.curves(), mit Betriebspunkt) */
  let lastCrv = 0;
  function crvHtml() { return '<div class="card pl" id="curveCard"><h4>Kennlinien des Prüfstands</h4><div class="rbar" id="crvSel"></div><div class="chartbox"><canvas id="crvCv" aria-label="Kennlinie des Prüfstands"></canvas></div><div class="legend" id="crvLeg"></div><div class="readout" id="crvRead"></div></div>'; }
  function drawCurves(force) {
    const cv = $('#crvCv'); if (!cv || !S.rig || cv.offsetParent === null) return; const now = performance.now(); if (!force && now - lastCrv < 350) return; lastCrv = now;
    let cs = []; try { cs = typeof S.rig.curves === 'function' ? (S.rig.curves() || []) : []; } catch (e) { cs = []; }
    const card = $('#curveCard'); if (card) card.style.display = cs.length ? '' : 'none'; if (!cs.length) return;
    let sel = S.curSel[S.rigId]; if (!cs.some(c => c.id === sel)) sel = S.curSel[S.rigId] = cs[0].id;
    const selEl = $('#crvSel'), sig = cs.map(c => c.id + c.title).join('|') + sel + S.sym; if (selEl && selEl.dataset.sig !== sig) { selEl.dataset.sig = sig; selEl.innerHTML = cs.length > 1 ? cs.map(c => `<button class="chip s${c.id === sel ? ' on' : ''}" data-cid="${esc(c.id)}">${esc(sx(c.title))}</button>`).join('') : `<b style="padding:0 6px">${esc(sx(cs[0].title))}</b>`; }
    const cur = cs.find(c => c.id === sel), leg = $('#crvLeg'), rd = $('#crvRead');
    if (cur.kind === 'bars' || cur.stacks) { drawBars(cv, cur); const lh = (cur.stacks || []).map((s, k) => `<span><i style="background:${s.color || PAL[k % PAL.length]}"></i>${esc(sx(s.name))}</span>`).join(''); if (leg.dataset.h !== lh) { leg.dataset.h = lh; leg.innerHTML = lh; } rd.innerHTML = ''; return; }
    const ser = (cur.series || []).map((s, i) => ({ name: s.name, color: s.color || PAL[i % PAL.length], dash: s.dash, pts: s.points || [] }));
    drawChart(cv, { series: ser, xLog: !!cur.xLog, hlines: (cur.hlines || []).map(h => ({ y: h.y, label: sx(h.label || ''), color: h.color || col('lim'), fit: true })), vlines: (cur.vlines || []).map(v => ({ x: v.x, label: sx(v.label || ''), color: v.color || col('shut') })), xLabel: sx(cur.xLabel || '') + (cur.xUnit ? ' in ' + cur.xUnit : ''), yLabel: sx(cur.yLabel || '') + (cur.yUnit ? ' in ' + cur.yUnit : ''), points: cur.marker && fin(cur.marker.x) && fin(cur.marker.y) ? [{ x: cur.marker.x, y: cur.marker.y }] : [] });
    const lh = ser.map(s => `<span><i style="background:${s.color}"></i>${esc(sx(s.name))}</span>`).join('') + (cur.marker ? '<span><i class="dotm"></i>Betriebspunkt</span>' : ''); if (leg && leg.dataset.h !== lh) { leg.dataset.h = lh; leg.innerHTML = lh; }
    const txt = cur.marker && fin(cur.marker.x) ? 'Betriebspunkt: ' + esc(sx(cur.xLabel || 'x')) + ' = <b>' + fnum(cur.marker.x, 2) + ' ' + esc(cur.xUnit || '') + '</b>, ' + esc(sx(cur.yLabel || 'y')) + ' = <b>' + fnum(cur.marker.y, 2) + ' ' + esc(cur.yUnit || '') + '</b>' : ''; if (rd && rd.dataset.h !== txt) { rd.dataset.h = txt; rd.innerHTML = txt; }
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-cid]'); if (!b || !S.rig) return; S.curSel[S.rigId] = b.dataset.cid; const s = $('#crvSel'); if (s) s.dataset.sig = ''; drawCurves(true); });

  /* ============================================================ Tab Vergleichen: Tafel je Aufbau, "Was bringt's", Maßnahmen-Rangliste */
  const XS = ['a', 'b', 'c'];
  /* Daten je Aufbau: bevorzugt state().aufbau[X] = { tj, tc, tk, rthJC, rthCK, rthK, rthTotal, dJC, dCK, dK, pzul, reserve, tau, mode, groessterAbfall:[…] }, sonst Messgeräte oder Zustand mit Suffix _a, _b, _c */
  const XALIAS = { rthTot: 'rthTotal', dtJC: 'dJC', dtCK: 'dCK', dtK: 'dK' };
  function xval(st, mv, key, X) {
    const ab = st && st.aufbau && st.aufbau[X], k2 = XALIAS[key] || key;
    if (ab) { if (fin(+ab[key])) return +ab[key]; if (fin(+ab[k2])) return +ab[k2]; }
    const k = key + '_' + X; for (const src of [mv, st]) { if (src && fin(+src[k])) return +src[k]; if (XALIAS[key] && src && fin(+src[XALIAS[key] + '_' + X])) return +src[XALIAS[key] + '_' + X]; if (k2 !== key && src && fin(+src[k2 + '_' + X])) return +src[k2 + '_' + X]; }
    return NaN;
  }
  const letterOf = v => (typeof v === 'string' && /^[abc]$/i.test(v) ? v.toLowerCase() : fin(+v) && +v >= 0 && +v <= 2 ? XS[Math.round(+v)] : '');
  function cmpData() {
    if (!S.rig || S.rigId !== 'vergleich') return null; const st = S.st || readState() || {}; let mv = {}; try { mv = S.rig.readMeters() || {}; } catch (e) {}
    let n = 3; try { n = +S.rig.getControl('n') || 3; } catch (e) {} const list = XS.slice(0, n), tjm = fin(st.tjMax) ? st.tjMax : NaN;
    const rows = list.map(X => { const ab = (st.aufbau && st.aufbau[X]) || {}, o = { X, mode: ab.mode, over: ab.over, big: Array.isArray(ab.groessterAbfall) ? ab.groessterAbfall : [], tj: xval(st, mv, 'tj', X), tc: xval(st, mv, 'tc', X), tk: xval(st, mv, 'tk', X), rthJC: xval(st, mv, 'rthJC', X), rthCK: xval(st, mv, 'rthCK', X), rthK: xval(st, mv, 'rthK', X), rthTot: xval(st, mv, 'rthTot', X), pzul: xval(st, mv, 'pzul', X), dtJC: xval(st, mv, 'dtJC', X), dtCK: xval(st, mv, 'dtCK', X), dtK: xval(st, mv, 'dtK', X), reserve: xval(st, mv, 'reserve', X) };
      if (!fin(o.reserve) && fin(o.tj) && fin(tjm)) o.reserve = tjm - o.tj; if (!fin(o.rthTot) && fin(o.rthJC) && fin(o.rthCK) && fin(o.rthK)) o.rthTot = o.rthJC + o.rthCK + o.rthK; return o; });
    return { st, mv, rows, tjm, n, pv: fin(+st.pv) ? +st.pv : (fin(+mv.pv) ? +mv.pv : NaN), ta: st.ta, best: letterOf(st.bestId != null ? st.bestId : mv.bestId) };
  }
  const CMPCOL = { jc: '#e5484d', ck: '#f5a524', k: '#3b9eff' };
  function cmpHtml(D) {
    const f2 = (v, d) => fnum(v, d == null ? 2 : d), thc = c => `<th class="n">${esc(c)}</th>`, R = D.rows;
    const BIGN = { JC: sy('Rth_JC'), CK: sy('Rth_CK'), K: sy('Rth_K'), CA: sy('Rth_CA') }, bigRow = RR => `<tr><td>größter Temperaturabfall</td>${RR.map(o => `<td class="n t">${o.big && o.big.length ? esc(o.big.map(b => BIGN[b] || b).join(', ')) : '–'}</td>`).join('')}</tr>`;
    const rowH = (label, key, d, fn) => `<tr><td>${label}</td>${R.map(o => `<td class="n t">${fin(o[key]) ? (fn ? fn(o[key], o) : f2(o[key], d)) : '–'}</td>`).join('')}</tr>`;
    let h = `<div class="card pl thm-cmp"><h4>Tafel der Aufbauten (${esc(sx(rigName('vergleich')))})</h4><p class="hint2" style="margin:0 0 6px">Bauteil <b>${esc((D.st.device || '').toString())}</b>, Verlustleistung <b>${f2(D.pv)} W</b>, ${esc(sy('Ta'))} = <b>${f2(D.ta, 1)} °C</b>. Alle Aufbauten laufen gleichzeitig in derselben Prozesszeit.</p>
      <div class="thm-tbl"><table class="kt"><thead><tr><th></th>${R.map(o => thc('Aufbau ' + o.X.toUpperCase())).join('')}</tr></thead><tbody>
      ${rowH(esc(sy('Rth_JC')) + ' in K/W', 'rthJC')}${rowH(esc(sy('Rth_CK')) + ' in K/W', 'rthCK')}${rowH(esc(sy('Rth_K')) + ',eff in K/W', 'rthK')}${rowH('<b>Rth_ges</b> in K/W', 'rthTot')}
      ${rowH('<b>' + esc(sy('Tj')) + '</b> in °C', 'tj', 1, (v, o) => '<b' + (fin(D.tjm) && v > D.tjm ? ' style="color:var(--bad-fg)"' : '') + '>' + f2(v, 1) + '</b>' + (fin(D.tjm) && v > D.tjm ? ' ⚠' : ''))}${rowH(esc(sy('Tc')) + ' in °C', 'tc', 1)}${rowH(esc(sy('Tk')) + ' in °C', 'tk', 1)}
      ${bigRow(R)}${rowH('P_zul in W', 'pzul')}${rowH('Reserve zu ' + esc(syMax()) + ' in K', 'reserve', 1, (v) => '<span style="color:' + (v < 0 ? 'var(--bad-fg)' : 'inherit') + '">' + f2(v, 1) + (v < 0 ? ' (zu heiß)' : '') + '</span>')}
      </tbody></table></div>`;
    h += wasBringts(D) + '</div>'; return h;
  }
  /* "Was bringt's?": Unterschiede in K aus den Messgeräten dTjAB und dTjBC (Rechnung steht im Prüfstand, hier nur die Anzeige) */
  function wasBringts(D) {
    const ab = D.mv.dTjAB, bc = D.mv.dTjBC, p = [];
    if (fin(ab)) p.push(`von A nach B: ${ab >= 0 ? '<b>' + fnum(Math.abs(ab), 1) + ' K kühler</b>' : '<b>' + fnum(Math.abs(ab), 1) + ' K heißer</b>'}`);
    if (fin(bc) && D.n >= 3) p.push(`von B nach C: ${bc >= 0 ? '<b>' + fnum(Math.abs(bc), 1) + ' K kühler</b>' : '<b>' + fnum(Math.abs(bc), 1) + ' K heißer</b>'}`);
    let best = ''; if (D.best) best = ` Die geringste ${esc(sy('Tj'))} hat Aufbau <b>${esc(D.best.toUpperCase())}</b>.`; else if (D.rows.length && D.rows.every(o => fin(o.tj))) { const b = D.rows.reduce((a, o) => (o.tj < a.tj ? o : a)); best = ` Die geringste ${esc(sy('Tj'))} hat Aufbau <b>${b.X.toUpperCase()}</b>.`; }
    return `<p style="margin:10px 0 0"><b>Was bringt's?</b> ${p.length ? 'Die Sperrschicht wird ' + p.join(', ') + '.' : 'Der Prüfstand liefert die Unterschiede noch nicht.'}${best}</p>`;
  }
  /* Maßnahmen-Rangliste: für den Aufbau mit der höchsten Tj die Glieder nach Anteil an Rth_ges (nur Zahlen, keine Behauptung über Machbarkeit) */
  function rangHtml(D) {
    const okR = D.rows.filter(o => fin(o.tj) && fin(o.rthJC) && fin(o.rthCK) && fin(o.rthK) && o.rthTot > 0);
    if (!okR.length) return '<div class="card pl"><h4>Wo steckt das größte Potenzial?</h4><p class="hint2" style="margin:0">Der Prüfstand liefert die Glieder noch nicht.</p></div>';
    const w = okR.reduce((a, o) => (o.tj > a.tj ? o : a)), parts = [['jc', sy('Rth_JC'), w.rthJC], ['ck', sy('Rth_CK'), w.rthCK], ['k', w.mode === 'frei' ? sy('Rth_CA') : sy('Rth_K') + ',eff', w.rthK]].map(a => ({ id: a[0], n: a[1], v: a[2], pct: 100 * a[2] / w.rthTot })).sort((a, b) => b.pct - a.pct);
    return `<div class="card pl"><h4>Wo steckt das größte Potenzial?</h4><p class="hint2" style="margin:0 0 6px">Aufbau <b>${w.X.toUpperCase()}</b> hat mit ${fnum(w.tj, 1)} °C die höchste ${esc(sy('Tj'))}. Seine Glieder nach Anteil an Rth_ges = ${fnum(w.rthTot, 2)} K/W:</p>
      <div class="thm-bars" role="img" aria-label="Anteile der Glieder">${parts.map(p => `<i style="width:${p.pct.toFixed(1)}%;background:${CMPCOL[p.id]}" title="${esc(p.n)}"></i>`).join('')}</div>
      <table class="kt"><tbody>${parts.map((p, i) => `<tr><td><span class="thm-sw" style="background:${CMPCOL[p.id]}"></span>${esc(p.n)}</td><td class="n t">${fnum(p.v, 2)} K/W</td><td class="n t"><b>${fnum(p.pct, 0)} %</b></td><td>${i === 0 ? 'größter Anteil' : ''}</td></tr>`).join('')}</tbody></table>
      <p class="hint2">Je größer der Anteil, desto mehr Temperaturabfall entsteht in diesem Glied. Die Reihenfolge folgt nur aus diesen Zahlen.</p></div>`;
  }
  let cmpSig = '';
  function renderCmp(force) {
    const top = $('#cmpTop'), bot = $('#cmpBottom'); if (!top || !bot) return;
    if (S.tab !== 'cmp' || S.rigId !== 'vergleich' || !S.rig) { if (top.innerHTML) { top.innerHTML = ''; bot.innerHTML = ''; cmpSig = ''; } return; }
    const D = cmpData(); if (!D) return; const sig = JSON.stringify([D.rows, D.mv.dTjAB, D.mv.dTjBC, D.mv.bestId, D.pv, D.ta, S.sym]); if (!force && sig === cmpSig) return; cmpSig = sig;
    top.innerHTML = '<div class="card pl"><div class="chips" style="padding:0"><button class="chip s on" data-cmp="keep">📌 Aufbau merken</button><button class="chip s" data-cmp="unkeep"' + (S.ghost ? '' : ' disabled') + '>Gemerkte Kurve löschen</button><button class="chip s" data-cmp="load">📂 Aufbau aus gespeichertem Versuch laden</button></div>' + (S.ghost ? `<p class="hint2" style="margin:6px 0 0">Gemerkt: ${esc(S.ghost.label)}. Die Kurve erscheint blass im Messschreiber des Prüfstands.</p>` : '') + '</div>' + cmpHtml(D);
    bot.innerHTML = rangHtml(D);
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest && e.target.closest('[data-cmp]'); if (!b || !S.rig || S.rigId !== 'vergleich') return;
    if (b.dataset.cmp === 'keep') {
      const D = cmpData(); if (!D) return; const v = await pick('Welchen Aufbau merken?', D.rows.map(o => ({ value: o.X, label: 'Aufbau ' + o.X.toUpperCase(), sub: fin(o.tj) ? sy('Tj') + ' = ' + fnum(o.tj, 1) + ' °C' : '' }))); if (!v) return;
      const H = S.hist, k = 'tj' + v; if (!H.t.length) { toast('Starte zuerst den Vergleich.'); return; }
      const t = [], tj = []; H.t.forEach((tt, i) => { if (fin(H[k][i])) { t.push(tt); tj.push(H[k][i]); } });
      S.ghost = { label: 'Aufbau ' + v.toUpperCase() + ' (' + (S.st && S.st.device || '') + ', ' + fnum(S.st && S.st.pv, 1) + ' W)', t, tj }; stat('thmvergl', 1, 'max'); S.compared = true; toast('Aufbau ' + v.toUpperCase() + ' gemerkt: Er erscheint blass im Messschreiber.'); renderCmp(true);
    } else if (b.dataset.cmp === 'unkeep') { S.ghost = null; toast('Gemerkte Kurve gelöscht.'); renderCmp(true); }
    else if (b.dataset.cmp === 'load') loadAufbauFromSave();
  });
  const MKEYS = ['heatsink', 'blechA', 'joint', 'paste', 'bushing', 'screw', 'ksPot', 'fan', 'orient'];
  async function loadAufbauFromSave() {
    const items = saves().filter(i => i.rig !== 'vergleich' && i.ctl && i.ctl.heatsink !== undefined).sort((a, b) => b.t - a.t);
    if (!items.length) { toast('Es gibt noch keinen gespeicherten Prüfstand mit Aufbau. Speichere einen im Menü („Speichern unter …“).'); return; }
    const it = await pick('Aufbau laden aus', items.map(i => ({ value: i, label: i.name, sub: rigName(i.rig) + ' · ' + new Date(i.t).toLocaleDateString('de-DE') }))); if (!it) return;
    const X = await pick('Als welchen Aufbau?', XS.map(x => ({ value: x, label: 'Aufbau ' + x.toUpperCase() }))); if (!X) return;
    const m = {}; MKEYS.forEach(k => { if (it.ctl[k] !== undefined) m[k + '_' + X] = it.ctl[k]; }); applyCtl(m); S.dirty = true; saveCurSoon(); renderCmp(true); toast('Aufbau ' + X.toUpperCase() + ' aus „' + it.name + '“ geladen');
  }
  /* In Vergleich übernehmen: Bauteil, P_V und Ta als Startwert, Aufbau A = aktueller Aufbau (Schlüssel thm.vergl) */
  function collectFromRig(r) {
    if (!r) return null; let cfg = {}, info = {}, st = {}; try { cfg = r.cfg ? (r.cfg() || {}) : {}; } catch (e) {} try { info = r.thermalInfo ? (r.thermalInfo() || {}) : {}; } catch (e) {} try { st = r.state() || {}; } catch (e) {}
    const a = {}; ['heatsink', 'joint', 'paste', 'bushing', 'screw', 'ksPot', 'fan', 'orient'].forEach(k => { if (cfg[k] !== undefined) a[k] = cfg[k]; }); if (cfg.blech && fin(+cfg.blech.A_cm2)) a.blechA = +cfg.blech.A_cm2;
    return { device: cfg.device || st.device, pv: fin(+info.P) ? +info.P : +st.pv, ta: fin(+info.ta) ? +info.ta : +st.ta, a, cfg: clone(cfg), src: r.id };
  }
  /* Werte in den Vergleichs-Prüfstand legen: bevorzugt rig.adopt({ device, pv, ta, cfg }) des Prüfstands, sonst über die Steuerwerte (Aufbau A = aktueller Aufbau) */
  function verglApply(v) {
    if (!v || !S.rig || S.rigId !== 'vergleich') return 0; const dev0 = S.rig.getControl('device'); let done = false;
    if (typeof S.rig.adopt === 'function') { try { done = S.rig.adopt({ device: v.device, pv: v.pv, ta: v.ta, cfg: v.cfg || undefined }) !== false; } catch (e) { console.error(e); done = false; } }
    if (!done) { const m = {}; if (v.device) m.device = v.device; if (fin(+v.pv)) m.pv = +v.pv; if (fin(+v.ta)) m.ta = +v.ta; Object.keys(v.a || {}).forEach(k => { m[k + '_a'] = v.a[k]; }); applyCtl(m); }
    syncCtl(true); try { S.rig.settle(); } catch (e) {} readState(); sample(true); S.compared = true; S.dirty = true; saveCurSoon(); renderCmp(true);
    if (v.device && S.rig.getControl('device') !== v.device) toast('Das Bauteil „' + v.device + '“ gibt es im Vergleich nicht. Bauteil bleibt ' + String(S.rig.getControl('device') || dev0) + '.');
    return 1;
  }
  function applyVerglPending() { if (S.verglPending && S.rigId === 'vergleich' && S.rig) { const v = S.vergl; S.verglPending = false; if (v) { verglApply(v); toast('Aufbau A ist jetzt dein Aufbau aus dem Prüfstand.'); } } }
  function toCmp() {
    const r = S.slots[S.main] && S.slots[S.main].rig; if (!r || S.attrappe) { toast('Es gibt noch keinen Prüfstand zum Übernehmen.'); return; }
    const v = collectFromRig(r); if (!v) return; S.vergl = v; lsSet('thm.vergl', v); S.verglPending = true; setTab('cmp');
  }
  function verglFromMain() {
    const r = S.slots[S.main] && S.slots[S.main].rig; if (!r) { toast('Es gibt noch keinen Prüfstand mit Werten. Öffne zuerst den Tab „Prüfstand“.'); return; }
    const v = collectFromRig(r); S.vergl = v; lsSet('thm.vergl', v); verglApply(v); toast('Aus dem Prüfstand übernommen: Aufbau A, ' + sy('P') + ' und ' + sy('Ta') + '.');
  }

  /* ============================================================ Tab Ablauf (Ablaufprogramm, Läufer THM_CORE.runSeq) */
  let seqIdx = -1;
  const rowEnd = r => (+r.t || 0) + (r.kind === 'ramp' ? (+r.dur || 0) : 0);
  const seqDur = () => { const d = S.seqDur && S.seqDur[S.rigId]; if (fin(d) && d > 0) return d; const rs = curRows(); return Math.max(defSpan(), rs.reduce((m, r) => Math.max(m, rowEnd(r)), 0) * 1.3, 20 * rigH()); };
  const seqSettleOn = () => !!(S.seqSettle && S.seqSettle[S.rigId]);
  const defVal = c => (c.type === 'switch' || c.type === 'button' ? !!c.value : c.type === 'select' ? ((c.value !== undefined ? c.value : (c.options && c.options[0] ? c.options[0].value : ''))) : (c.value != null ? c.value : c.min));
  const seqKeys = () => ctlsOf().filter(c => c.type !== 'button');
  function newRow() {
    const rs = curRows(), c = ctlDef('fan') || ctlDef('ue') || ctlDef('iLoad') || seqKeys()[0]; if (!c) return null;
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
    if (c.type === 'slider') { const sh = fnum(v, c.scale === 'log' ? adig(v) : decs(c.step)); return `<span class="vv"><input class="vIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${sh}" aria-label="Wert"><small>${esc(ctlUnit(c))}</small></span>`; }
    if (c.type === 'switch') return `<select class="vSel" data-i="${i}" aria-label="Wert"><option value="1"${r.value ? ' selected' : ''}>EIN</option><option value="0"${r.value ? '' : ' selected'}>AUS</option></select>`;
    const o = c.options || [], cur = o.findIndex(x => x.value === r.value || String(x.value) === String(r.value));
    return `<select class="vSel" data-i="${i}" aria-label="Wert">${o.map((x, j) => `<option value="${j}"${j === cur ? ' selected' : ''}>${esc(sx(x.label))}</option>`).join('')}</select>`;
  }
  function rowHtml(r, i, n) {
    const keys = seqKeys(), c = ctlDef(r.key), canRamp = c && c.type === 'slider', ramp = r.kind === 'ramp';
    return `<div class="sqr" data-i="${i}"><span class="n">${i + 1}</span><label class="tb"><small>nach</small><input class="tIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${fnum(toU(r.t), adig(toU(r.t)))}" aria-label="Zeit in ${esc(TU())}"> <small>${esc(TU())}</small></label>
      <select class="kdSel" data-i="${i}" aria-label="Art"><option value="set"${ramp ? '' : ' selected'}>setze</option>${canRamp ? `<option value="ramp"${ramp ? ' selected' : ''}>Rampe auf</option>` : ''}</select>
      <select class="kSel" data-i="${i}" aria-label="Steuerwert">${keys.map(k => `<option value="${esc(k.key)}"${k.key === r.key ? ' selected' : ''}>${esc(sx(k.label))}${ctlUnit(k) ? ' (' + esc(ctlUnit(k)) + ')' : ''}</option>`).join('')}</select>
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
      <p class="hint2" style="margin:0 0 8px">Jede Zeile heißt: <b>nach … ${esc(TU())}</b> (Prozesszeit) wird ein Steuerwert gesetzt oder in einer Rampe verändert. So baust du Lastsprünge, einen Lüfter, der später dazukommt, oder einen Kühlkörperwechsel, ohne selbst zu drücken.</p>
      <div class="chips"><button class="chip s on" data-q="add">➕ Zeile</button><button class="chip s" data-q="ex">📖 Beispiel-Ablauf</button><button class="chip s danger" data-q="clr"${rs.length ? '' : ' disabled'}>🗑 Leeren</button></div>
      <div id="sqRows">${rs.length ? rs.map((r, i) => rowHtml(r, i, rs.length)).join('') : '<p class="hint2" style="padding:8px 4px">Noch keine Zeilen. Tippe auf „Zeile“ oder lade ein Beispiel.</p>'}</div>
      <div class="frm" style="margin-top:10px"><label class="f"><span>Dauer des Ablaufs in ${esc(TU())} (Prozesszeit)</span><input id="sqDur" inputmode="decimal" autocomplete="off" value="${fnum(toU(seqDur()), adig(toU(seqDur())))}"></label><div><label class="chk"><input type="checkbox" id="sqCur"${S.seqCur === false ? '' : ' checked'}> mit den aktuellen Steuerwerten des Prüfstands starten</label><label class="chk"><input type="checkbox" id="sqSet"${seqSettleOn() ? ' checked' : ''}> mit dem eingeschwungenen Zustand beginnen (sonst kalt bei ${esc(sy('Ta'))})</label></div></div>
      <div id="tlHost">${tlHtml()}</div><div class="readout" id="sqLiveRead"></div>
      <div class="btns"><button class="btn pri" data-q="bg"${rs.length ? '' : ' disabled'}>▶ Berechnen (Diagramm)</button><button class="btn" data-q="live"${rs.length ? '' : ' disabled'}>▶ Live im Prüfstand</button><button class="btn danger" data-q="stop">■ Stopp</button></div></div>
      <div id="sqRes"></div>`;
    renderSeqRes(); renderSeqLive();
  }
  /* Ablaufprogramm im Hintergrund: THM_CORE.runSeq (Prozess-Sekunden), sonst Hinweis */
  function seqRunBg() {
    if (!S.rig) return; const steps = seqSteps(curRows()), end = seqDur(), id = S.rigId, d = defOf(id), C = CORE();
    if (!steps.length) { toast('Das Ablaufprogramm ist leer.'); return; }
    if (!C || typeof C.runSeq !== 'function') { toast('Der Läufer ist nicht geladen (thmcore.js fehlt).'); return; }
    toast('Berechne den Ablauf …');
    setTimeout(() => {
      const o = { seed: 1, settle: seqSettleOn(), sampleS: Math.max(1, end / 400) }; if (S.seqCur !== false) o.controls = allCtl();
      const factory = () => d.create({ seed: 1 }); let res = null;
      try { res = C.runSeq(factory, steps, end, o); } catch (e) { console.error('runSeq:', e); res = null; }
      const fin2 = r => {
        if (!r || !Array.isArray(r.samples) || !r.samples.length) { toast('Der Ablauf konnte nicht berechnet werden.'); return; }
        S.seqPrev = S.seqRes && S.seqRes.rigId === id ? S.seqRes : S.seqPrev; S.seqRes = { samples: r.samples, final: r.final, events: r.events || [], faults: r.faults || [], errors: r.errors || [], metrics: r.metrics || null, end, rigId: id, steps, tUnit: TU() }; seqIdx = r.samples.length - 1;
        stat('thmseq', 1, 'max'); renderSeqRes(); const el = $('#sqRes'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      if (res && typeof res.then === 'function') res.then(fin2, () => fin2(null)); else fin2(res);
    }, 30);
  }
  function seqLive() {
    if (!S.rig) return; const steps = seqSteps(curRows());
    if (!steps.length) { toast('Das Ablaufprogramm ist leer.'); return; }
    const keep = S.seqCur !== false ? allCtl() : null;
    resetRig(true); if (keep) applyCtl(keep); if (seqSettleOn()) { try { S.rig.settle(); } catch (e) {} }
    readState(); sample(true); S.live = { steps, i: 0, t: 0, end: seqDur(), ramps: [] }; setRun(true); renderSeqLive();
    toast('Ablauf läuft live. Im Tab „Prüfstand“ siehst du die Animation.');
  }
  function seqLiveDone() { S.live = null; stat('thmseq', 1, 'max'); toast('Ablauf beendet'); renderSeqLive(); }
  function seqStop() { if (S.live) { S.live = null; S.running = false; updateChrome(); toast('Ablauf gestoppt'); renderSeqLive(); } else if (S.running) setRun(false); }
  function renderSeqLive() {
    if (S.tab !== 'seq') return; const hd = $('#tlHd'), rd = $('#sqLiveRead'); if (!hd) return; const end = seqDur();
    if (S.live) hd.style.left = Math.min(100, S.live.t / end * 100).toFixed(2) + '%';
    else if (S.seqRes && seqIdx >= 0 && S.seqRes.samples[seqIdx]) hd.style.left = Math.min(100, S.seqRes.samples[seqIdx].t / S.seqRes.end * 100).toFixed(2) + '%';
    else hd.style.left = '0%';
    const rows = $$('.sqr'); rows.forEach(r => r.classList.remove('cur'));
    if (S.live && S.rig) {
      const st = S.st || {}, txt = 'Live: Prozesszeit <b>' + tstr(S.live.t) + '</b> von ' + tstr(end) + ' · ' + esc(sy('Tj')) + ' <b>' + fnum(st.tj, 1) + ' °C</b> · ' + esc(sy('Tk')) + ' <b>' + fnum(st.tk, 1) + ' °C</b> · P <b>' + fnum(st.pv, 2) + ' W</b>';
      if (rd.dataset.h !== txt) { rd.dataset.h = txt; rd.innerHTML = txt; }
      const last = S.live.steps[Math.max(0, S.live.i - 1)]; if (last && S.live.i > 0) rows.forEach(r => { const row = curRows()[+r.dataset.i]; if (row && Math.abs((+row.t || 0) - last.t) < 1e-6) r.classList.add('cur'); });
    } else if (rd.dataset.h) { rd.dataset.h = ''; rd.innerHTML = ''; }
  }
  /* Kenngrößen des Laufs aus result.metrics (Läufer im Kern, nicht hier gerechnet) */
  function metricsHtml(m, tu) {
    if (!m) return '<p class="hint2" style="margin:0">Der Läufer liefert keine Kenngrößen.</p>';
    const dv = TDIV[tu] || 1, tm = s => (fin(s) ? fnum(s / dv, adig(s / dv)) + ' ' + tu : 'nicht erreicht'), tc = v => (fin(v) ? fnum(v, 1) + ' °C' : '–');
    return `<table class="kt"><tr><th>Kenngröße</th><th class="n">Wert</th></tr>
      <tr><td>Höchste ${esc(sy('Tj'))} im Lauf</td><td class="n"><b>${tc(m.tjMax)}</b></td></tr><tr><td>${esc(sy('Tj'))} am Ende</td><td class="n"><b>${tc(m.tjFinal)}</b></td></tr><tr><td>${esc(sy('Tj'))} im Beharrungszustand (stationär gerechnet)</td><td class="n"><b>${tc(m.tjSteady)}</b></td></tr>
      <tr><td>Zeit bis 63 % des Endwerts</td><td class="n"><b>${tm(m.t63)}</b></td></tr><tr><td>Zeit bis 90 % des Endwerts</td><td class="n"><b>${tm(m.t90)}</b></td></tr><tr><td>Zeitkonstante τ aus der Kurve angepasst</td><td class="n"><b>${tm(m.tauFit)}</b></td></tr>
      <tr><td>Abschaltungen</td><td class="n"><b>${fin(m.shutCount) ? fnum(m.shutCount, 0) : '–'}</b></td></tr></table>`;
  }
  function renderSeqRes() {
    const el = $('#sqRes'); if (!el) return; const R = S.seqRes;
    if (!R || R.rigId !== S.rigId) { el.innerHTML = ''; return; }
    const faults = (R.faults || []).map(f => (typeof f === 'string' ? f : f && (f.text || f.msg || f.name)) || '').filter(Boolean), evs = (R.events || []).slice(-30);
    el.innerHTML = `<div class="card pl"><h4>Ergebnis des Ablaufs</h4><div class="chartbox"><canvas id="sqCv" aria-label="Ergebnis: Temperaturen"></canvas></div><div class="chartbox lane"><canvas id="sqCv2" aria-label="Ergebnis: Verlustleistung"></canvas></div>
      <label class="f" style="margin:8px 0 0"><span>Zeitleiste: Zeitpunkt auswählen</span><input type="range" id="sqScrub" min="0" max="${R.samples.length - 1}" step="1" value="${seqIdx}"></label><div class="readout" id="sqRead"></div>
      <div class="chips" style="margin-top:6px"><button class="chip s" data-q="keep">Lauf merken</button><button class="chip s" data-q="unkeep"${S.seqPrev ? ' ' : ' disabled '}>Gemerkten Lauf löschen</button><button class="chip s" data-q="csv">⬇ CSV</button></div>
      <div style="margin-top:8px">${metricsHtml(R.metrics, R.tUnit)}</div>
      ${R.errors && R.errors.length ? `<p style="color:var(--warn);margin:6px 0 0"><b>Hinweis zum Ablauf:</b> ${R.errors.map(x => esc(sx(x))).join(' ')}</p>` : ''}
      ${faults.length ? `<p style="color:var(--danger);margin:6px 0 0"><b>Fehler im Ablauf:</b> ${faults.map(x => esc(sx(x))).join('; ')}</p>` : '<p class="hint2" style="margin:6px 0 0">Keine Fehler im Ablauf.</p>'}
      ${evs.length ? `<ul class="ev" style="padding:0">${evs.map(x => `<li class="${esc(x.kind || 'info')}"><time>${fnum((x.t || 0) / (TDIV[R.tUnit] || 1), 1)} ${esc(R.tUnit)}</time><span>${esc(sx(x.text))}</span></li>`).join('')}</ul>` : ''}</div>`;
    drawSeqChart();
  }
  function drawSeqChart() {
    const R = S.seqRes, cv = $('#sqCv'), cv2 = $('#sqCv2'); if (!R || !cv || R.rigId !== S.rigId) return; const dv = TDIV[R.tUnit] || 1;
    const px = k => R.samples.map(s => [s.t / dv, +s[k]]), ser = [];
    if (S.seqPrev && S.seqPrev.rigId === R.rigId && S.seqPrev !== R) ser.push({ name: 'gemerkt', color: col('ghost'), alpha: 0.7, dash: [8, 5], pts: S.seqPrev.samples.map(s => [s.t / dv, +s.tj]) });
    ser.push({ name: sy('Ta'), color: col('ta'), width: 1.6, pts: px('ta') }, { name: sy('Tk'), color: col('tk'), width: 2, pts: px('tk') }, { name: sy('Tc'), color: col('tc'), width: 2, pts: px('tc') }, { name: sy('Tj'), color: col('tj'), width: 2.6, pts: px('tj') });
    const cur = R.samples[seqIdx], cx = cur ? cur.t / dv : null, vl = R.steps.map(s => s.t / dv), xr = [0, R.end / dv], st0 = (R.samples[0] && R.samples[0].state) || {}, hl = [];
    if (fin(st0.tjMax)) hl.push({ y: st0.tjMax, color: col('lim'), dash: [6, 4], label: syMax() + ' = ' + fnum(st0.tjMax, 0) + ' °C', fit: true }); if (fin(st0.tShut)) hl.push({ y: st0.tShut, color: col('shut'), dash: [2, 4], label: 'Abschaltung ' + fnum(st0.tShut, 0) + ' °C', fit: true });
    drawChart(cv, { series: ser, hlines: hl, vlines: vl, xMin: xr[0], xMax: xr[1], noX: true, yLabel: '°C', cursorX: cx });
    drawChart(cv2, { series: [{ name: 'P', color: col('p'), width: 2, pts: px('p') }], vlines: vl, xMin: xr[0], xMax: xr[1], yMin: 0, xLabel: 'Prozesszeit in ' + R.tUnit, yLabel: 'P in W', cursorX: cx });
    const rd = $('#sqRead'); if (rd && cur) rd.innerHTML = 't = <b>' + fnum(cur.t / dv, adig(cur.t / dv)) + ' ' + esc(R.tUnit) + '</b>: ' + esc(sy('Tj')) + ' <b>' + fnum(cur.tj, 1) + ' °C</b> · ' + esc(sy('Tc')) + ' <b>' + fnum(cur.tc, 1) + ' °C</b> · ' + esc(sy('Tk')) + ' <b>' + fnum(cur.tk, 1) + ' °C</b> · ' + esc(sy('Ta')) + ' <b>' + fnum(cur.ta, 1) + ' °C</b> · P <b>' + fnum(cur.p, 2) + ' W</b>';
    renderSeqLive();
  }
  function seqCsv() {
    const R = S.seqRes; if (!R) return '';
    return CSVHEAD() + '\r\n' + R.samples.map(s => [csvNum(s.t / 60), csvNum(s.tj), csvNum(s.tc), csvNum(s.tk), csvNum(s.ta), csvNum(s.p)].join(';')).join('\r\n') + '\r\n';
  }
  (function () {
    const V = $('#seqView');
    V.addEventListener('click', async e => {
      const q = e.target.closest('[data-q]'), a = e.target.closest('[data-a]'); const rs = curRows();
      if (q) {
        const k = q.dataset.q;
        if (k === 'add') { const r = newRow(); if (r) { rs.push(r); S.dirty = true; renderSeq(); saveCurSoon(); } }
        else if (k === 'clr') { if (await confirmSheet('Ablaufprogramm leeren?', 'Alle Zeilen werden gelöscht.', 'Leeren', true)) { rs.length = 0; S.seqRes = null; S.dirty = true; renderSeq(); saveCurSoon(); } }
        else if (k === 'ex') { const ex = seqExamples(); if (!ex.length) { toast('Für diesen Prüfstand gibt es noch keine Beispiel-Abläufe.'); return; } const v = await pick('Beispiel-Ablauf', ex.map((x, i) => ({ value: i, label: x.name, sub: sx(x.desc || '') }))); if (v != null) loadExample(ex[v]); }
        else if (k === 'bg') seqRunBg(); else if (k === 'live') seqLive(); else if (k === 'stop') seqStop();
        else if (k === 'keep') { if (S.seqRes) { S.seqPrev = S.seqRes; toast('Lauf gemerkt: Er erscheint blass hinter dem nächsten Lauf.'); renderSeqRes(); } }
        else if (k === 'unkeep') { S.seqPrev = null; toast('Gemerkter Lauf gelöscht.'); renderSeqRes(); }
        else if (k === 'csv') { const txt = seqCsv(); if (!txt) return; saveCsv(txt, 'thermik-ablauf.csv'); toast('CSV gespeichert'); }
      } else if (a) {
        const i = +a.dataset.i;
        if (a.dataset.a === 'del') rs.splice(i, 1); else if (a.dataset.a === 'up' && i > 0) [rs[i - 1], rs[i]] = [rs[i], rs[i - 1]]; else if (a.dataset.a === 'dn' && i < rs.length - 1) [rs[i + 1], rs[i]] = [rs[i], rs[i + 1]];
        S.dirty = true; renderSeq(); saveCurSoon();
      }
    });
    V.addEventListener('change', e => {
      const t = e.target, rs = curRows(), i = +t.dataset.i;
      if (t.id === 'sqCur') { S.seqCur = t.checked; return; }
      if (t.id === 'sqSet') { S.seqSettle[S.rigId] = t.checked; S.dirty = true; return; }
      if (t.id === 'sqDur') { const v = fromU(parseNum(t.value)); S.seqDur[S.rigId] = fin(v) && v > 0 ? Math.min(7 * 86400, v) : null; t.value = fnum(toU(seqDur()), adig(toU(seqDur()))); $('#tlHost').innerHTML = tlHtml(); S.dirty = true; return; }
      if (!rs[i]) return; const r = rs[i];
      if (t.classList.contains('tIn')) { const v = fromU(parseNum(t.value)); r.t = fin(v) && v >= 0 ? +v.toPrecision(8) : r.t; t.value = fnum(toU(r.t), adig(toU(r.t))); $('#tlHost').innerHTML = tlHtml(); }
      else if (t.classList.contains('dIn')) { const v = fromU(parseNum(t.value)); r.dur = fin(v) && v >= 0 ? +v.toPrecision(8) : r.dur; t.value = fnum(toU(r.dur), adig(toU(r.dur) || 1)); }
      else if (t.classList.contains('kdSel')) { const c = ctlDef(r.key); if (t.value === 'ramp' && c) { r.kind = 'ramp'; r.to = fin(+r.value) ? +r.value : defVal(c); r.dur = r.dur || defSpan() / 20; delete r.value; } else { r.kind = 'set'; r.value = r.to != null ? r.to : defVal(c); delete r.to; delete r.dur; } renderSeq(); }
      else if (t.classList.contains('kSel')) { r.key = t.value; const c = ctlDef(t.value); if (r.kind === 'ramp' && !(c && c.type === 'slider')) { r.kind = 'set'; delete r.to; delete r.dur; } if (r.kind === 'ramp') r.to = c ? defVal(c) : 0; else r.value = c ? defVal(c) : 0; renderSeq(); }
      else if (t.classList.contains('vSel')) { const c = ctlDef(r.key); if (c) r.value = c.type === 'select' ? (c.options || [])[+t.value].value : t.value === '1'; }
      else if (t.classList.contains('vIn')) { const c = ctlDef(r.key); const v = parseNum(t.value); if (c && fin(v)) { const cv0 = clamp(v, c.min, c.max); if (r.kind === 'ramp') r.to = cv0; else r.value = cv0; } const cur = r.kind === 'ramp' ? r.to : r.value; t.value = fnum(cur, c && c.scale === 'log' ? adig(cur) : decs(c && c.step)); }
      S.dirty = true; saveCurSoon();
    });
    V.addEventListener('input', e => { if (e.target.id === 'sqScrub') { seqIdx = +e.target.value; drawSeqChart(); } });
    const pm = e => { const cv = e.target; if (!(cv.id === 'sqCv' || cv.id === 'sqCv2') || !S.seqRes) return; const x = cvX(cv, e); if (x == null) return; const dv = TDIV[S.seqRes.tUnit] || 1; let best = 0, bd = Infinity; S.seqRes.samples.forEach((s, i) => { const d = Math.abs(s.t / dv - x); if (d < bd) { bd = d; best = i; } }); seqIdx = best; const sc = $('#sqScrub'); if (sc) sc.value = best; drawSeqChart(); };
    V.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'mouse') pm(e); }); V.addEventListener('pointerdown', pm);
  })();

  /* ============================================================ Beispiele (THM_DATA.examples, eingebauter Rückfall ohne Zahlen im Text) */
  const B = (id, name, cat, rig, desc, controls, extra) => Object.assign({ id, name, cat, rig, desc, controls }, extra || {});
  const BUILTIN = [
    B('bx-frei', '7805 ohne Kühlkörper', 'Linearregler', 'linear', 'Der Regler steht frei im Raum. Beobachte, wohin die Sperrschichttemperatur läuft und was der Schutz des Reglers tut.', { device: '7805', heatsink: 'none' }, {}),
    B('bx-kk', '7805 am Kühlkörper', 'Linearregler', 'linear', 'Der Regler sitzt mit Isolierscheibe und Paste am Kühlkörper. Vergleiche die Temperaturen von Sperrschicht, Gehäuse und Kühlkörper.', { device: '7805', heatsink: 'm', joint: 'glimmer', paste: 'duenn' }, { settle: true }),
    B('bx-vergl', 'Drei Aufbauten im Vergleich', 'Vergleich', 'vergleich', 'Dasselbe Bauteil mit derselben Verlustleistung in drei Aufbauten nebeneinander.', {}, {})
  ];
  function exampleList() {
    const d = root.THM_DATA; let a = d && d.examples;
    if (a && !Array.isArray(a)) a = Object.keys(a).map(k => Object.assign({ id: k }, a[k]));
    if (!a || !a.length) a = BUILTIN;
    return a.map(e => ({ id: e.id, name: e.name, cat: e.cat || 'Beispiele', desc: e.desc || e.text || '', rig: e.rig, controls: e.controls || {}, dur: e.dur, settle: e.settle, rows: e.rows ? rowNorm(e.rows) : (e.seq ? seqToRows(e.seq) : null), seq: e.seq }));
  }
  const seqExamples = () => exampleList().filter(e => e.rows && e.rows.length && e.rig === S.rigId);
  const tabFor = id => (id === 'vergleich' ? 'cmp' : S.tab === 'seq' ? 'seq' : 'rig');
  function loadExample(e) {
    if (typeof e === 'string') { const n = e.toLowerCase(); e = exampleList().find(x => x.id === e || x.name.toLowerCase().includes(n)); }
    if (!e) return false; const had = stash(); S.task = null;
    setRig(e.rig && ORDER.includes(e.rig) ? e.rig : S.rigId || ORDER[0]);
    applyCtl(e.controls); S.rows[S.rigId] = e.rows ? clone(e.rows) : []; S.seqDur[S.rigId] = e.dur && e.dur > 0 ? e.dur : null; S.seqSettle[S.rigId] = e.settle === true; S.seqRes = null;
    if (e.settle === true && S.rig) { try { S.rig.settle(); readState(); sample(true); } catch (er) { console.error(er); } }
    S.name = e.name; S.id = null; S.dirty = false;
    setTab(e.rows && e.rows.length ? 'seq' : tabFor(S.rigId)); updateChrome(); saveCurSoon();
    toast(had ? 'Beispiel geladen, dein Versuch ist gesichert' : 'Beispiel geladen: ' + sx(e.name));
    return true;
  }
  const loadExampleByName = n => loadExample(String(n || ''));
  function openExamples() {
    const ex = exampleList();
    sheet('Beispielversuche', (b, close) => {
      let last = '', h = '<p class="hint2" style="margin-top:0">Tippe ein Beispiel an: Prüfstand und Einstellungen werden geladen. Dein bisheriger Versuch wird vorher gesichert.</p>';
      ex.forEach((e, i) => { if (e.cat !== last) { last = e.cat; h += `<div class="gh">${esc(e.cat)}</div>`; } h += `<button class="row" data-i="${i}"><span style="font-size:22px;display:inline-block;width:32px;text-align:center;flex:none">${rigIcon(e.rig)}</span><div class="grow"><b>${esc(sx(e.name))}</b><small>${esc(sx(e.desc))}${e.rows && e.rows.length ? ' · mit Ablaufprogramm' : ''}</small></div></button>`; });
      b.innerHTML = h;
      b.addEventListener('click', ev => { const r = ev.target.closest('.row'); if (!r) return; close(); loadExample(ex[+r.dataset.i]); });
    });
  }

  /* ============================================================ Speichern, Öffnen, Teilen */
  const PK = 'thm.saves';
  const saves = () => { const a = lsGet(PK, []); return Array.isArray(a) ? a : []; };
  function saveItem(name) {
    const a = saves(), id = S.id || uid(); S.id = id; S.name = name || S.name;
    const e = { id, name: S.name, t: Date.now(), rig: S.rigId, ctl: allCtl(), view: S.rig && S.rig.view, rows: clone(curRows()), dur: seqDur(), settle: seqSettleOn(), vergl: S.vergl ? clone(S.vergl) : null };
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
    S.task = null; const rid = ORDER.includes(it.rig) ? it.rig : ORDER[0];
    if (it.vergl && typeof it.vergl === 'object') { S.vergl = it.vergl; lsSet('thm.vergl', it.vergl); }
    setRig(rid); applyCtl(it.ctl && typeof it.ctl === 'object' ? it.ctl : {});
    if (S.rig && typeof it.view === 'string' && VIEWS.some(v => v[0] === it.view)) { S.rig.view = it.view; S.views[S.rigId] = it.view; lsSet('thm.view', S.views); buildBar(); }
    S.rows[S.rigId] = Array.isArray(it.rows) ? rowNorm(it.rows.filter(r => r && typeof r === 'object' && typeof r.key === 'string')) : []; S.seqDur[S.rigId] = fin(it.dur) && it.dur > 0 ? it.dur : null; S.seqSettle[S.rigId] = it.settle === true; S.seqRes = null;
    S.name = (it.name || 'Versuch') + (suffix || ''); S.dirty = false; updateChrome(); saveCurSoon();
    setTab(tabFor(S.rigId)); if (S.tab === 'seq') renderSeq();
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
  const shareObj = () => ({ k: 'thm', name: S.name, rig: S.rigId, ctl: allCtl(), view: S.rig && S.rig.view, rows: curRows(), dur: seqDur(), settle: seqSettleOn(), vergl: S.vergl || null });
  async function shareNow() {
    if (!S.rig) { toast('Es gibt noch nichts zu teilen: der Prüfstand fehlt.'); return; }
    let url; try { url = location.href.split('#')[0].split('?')[0] + '#' + await packShare(shareObj()); } catch (e) { toast('Teilen nicht möglich'); return; }
    if (navigator.share) { try { await navigator.share({ title: 'Tonfunk Thermik-Lab: ' + S.name, text: 'Schau dir meinen Thermik-Versuch „' + S.name + '“ an:', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
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
    x.fillStyle = bgOf(); x.fillRect(0, 0, w, h); try { if (S.rig) { S.rig.symSet = symSet(); S.rig.draw(x, w, h, 0); } } catch (e) {} return c;
  }
  function exportPng() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    const c = rigPng(1600, 900);
    c.toBlob(b => { if (b && root.LabExport) { root.LabExport.saveBlob(b, root.LabExport.fname('png')); stat('png'); } else toast('Bild konnte nicht erzeugt werden'); }, 'image/png');
  }
  function printNow() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    const c = rigPng(1200, 675), who = lsRaw('lm4.name', ''), vals = allCtl(); let mv = {}; try { mv = S.rig.readMeters(); } catch (e) {}
    const cv = ctlsOf().filter(x => x.type !== 'button').map(x => { const v = vals[x.key]; let t = v; if (x.type === 'switch') t = v ? 'EIN' : 'AUS'; else if (x.type === 'select') { const o = (x.options || []).find(q => q.value === v); t = o ? sx(o.label) : v; } else t = ctlShow(x, v) + (ctlUnit(x) ? ' ' + ctlUnit(x) : ''); return `<tr><td>${esc(sx(x.group || ''))}</td><td>${esc(sx(x.label))}</td><td>${esc(t)}</td></tr>`; }).join('');
    const mt = metersOf().map(m => `<tr><td>${esc(sx(m.label))}</td><td>${fnum(mv[m.key], m.digits == null ? 1 : m.digits)} ${esc(sx(m.unit || ''))}</td></tr>`).join('');
    const ev = ((S.rig.events) || []).slice(-15).map(e => `<tr><td>${esc(tstamp(e.t))}</td><td>${esc(sx(e.text))}</td></tr>`).join('');
    const rows = curRows().map(r => { const d = ctlDef(r.key); return `<tr><td>${fnum(toU(r.t), adig(toU(r.t)))} ${esc(TU())}</td><td>${r.kind === 'ramp' ? 'Rampe auf' : 'setze'} ${esc(d ? sx(d.label) : r.key)}</td><td>${esc(r.kind === 'ramp' ? String(r.to) + ' in ' + fnum(toU(r.dur), adig(toU(r.dur) || 1)) + ' ' + TU() : typeof r.value === 'boolean' ? (r.value ? 'EIN' : 'AUS') : String(r.value))}</td></tr>`; }).join('');
    $('#printArea').innerHTML = `<div class="proto"><h1>${esc(S.name)}</h1><p>Prüfstand: ${esc(rigName(S.rigId))} · ${new Date().toLocaleDateString('de-DE')}${who ? ' · ' + esc(who) : ''} · Zeiten in Prozesszeit (${esc(TU())})</p>
      <h2>Prüfstand</h2><img src="${c.toDataURL('image/png')}" alt="">
      <h2>Einstellungen</h2><table><tr><th>Gruppe</th><th>Steuerwert</th><th>Wert</th></tr>${cv}</table>
      <h2>Messwerte</h2><table><tr><th>Messgerät</th><th>Wert</th></tr>${mt}</table>
      ${rows ? `<h2>Ablaufprogramm</h2><table><tr><th>Zeit</th><th>Aktion</th><th>Wert</th></tr>${rows}</table>` : ''}
      ${ev ? `<h2>Meldungen</h2><table><tr><th>Zeit</th><th>Meldung</th></tr>${ev}</table>` : ''}</div>`;
    setTimeout(() => window.print(), 80);
  }

  /* ============================================================ Aufgaben (THM_TASKS) */
  const TK = () => (root.THM_TASKS && Array.isArray(root.THM_TASKS.tasks) && root.THM_TASKS.tasks.length ? root.THM_TASKS.tasks : null);
  const taskDone = () => lsGet('sim.done', {});
  function markDone(id, pct) {
    try { const d = taskDone(); if ((d[id] || 0) < pct) d[id] = pct; localStorage.setItem('sim.done', JSON.stringify(d)); } catch (e) {}
    if (root.Badges) root.Badges.result(id, pct);
    if (pct >= 100 && (id === 'th11' || id === 'th12')) stat('thmzeit', 1, 'max');
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
    el.className = 'on'; const sig = t.id + S.readonly + S.sym; if (el.dataset.s === sig) return; el.dataset.s = sig;
    el.innerHTML = `<span>📝</span><b>${esc(sx(t.title))}</b><button class="chip s" data-ta="info">Aufgabe</button><button class="chip s on" data-ta="check"${S.readonly ? ' disabled' : ''}>✓ Prüfen</button>`;
  }
  $('#taskBar').addEventListener('click', e => { const b = e.target.closest('[data-ta]'); if (!b) return; if (b.dataset.ta === 'info') setTab('tasks'); else checkTask(); });
  /* Aufgabenzustand (start() und sol() liefern { rig?, controls?, seq?: [{t(s), set|ramp}] | rows?, dur(s)?, settle?, value? }) übernehmen */
  function applyTaskState(t, o) {
    o = o || {}; const rid = o.rig || t.rig || S.rigId;
    setRig(ORDER.includes(rid) ? rid : S.rigId); applyCtl(o.controls || o.ctl);
    if (o.settle && S.rig) { try { S.rig.settle(); readState(); sample(true); } catch (e) { console.error(e); } }
    S.rows[S.rigId] = o.rows ? rowNorm(o.rows) : seqToRows(o.seq); S.seqDur[S.rigId] = o.dur && o.dur > 0 ? o.dur : null; S.seqSettle[S.rigId] = o.settle === true; S.seqRes = null; S.taskStart = o;
  }
  const fieldsOf = t => { let f = t.fields; if (typeof f === 'function') { try { f = f(S.taskStart); } catch (e) { f = []; } } return Array.isArray(f) ? f : []; };
  const choicesOf = t => { let f = t.choices; if (typeof f === 'function') { try { f = f(S.taskStart); } catch (e) { f = []; } } return Array.isArray(f) ? f : []; };
  async function startTask(id) {
    const t = (TK() || []).find(x => x.id === id); if (!t) return;
    const had = stash(); taskRes = null;
    if (root.Auswertung) root.Auswertung.hintReset(id);
    let o; try { o = typeof t.start === 'function' ? t.start() : {}; } catch (e) { console.error(e); toast('Die Startvorlage der Aufgabe fehlt'); return; }
    S.task = null; applyTaskState(t, o); S.task = { id }; S.name = sx(t.title); S.id = null; S.dirty = false; delete taskAns[id];
    setTab(o && (o.rows && o.rows.length || o.seq && o.seq.length) ? 'seq' : 'tasks'); updateChrome();
    toast(had ? 'Aufgabe gestartet, dein Versuch ist gesichert' : 'Aufgabe gestartet'); renderTasksIfOpen();
  }
  const renderTasksIfOpen = () => { if (S.tab === 'tasks') renderTasks(); };
  function collectAnswer(t) {
    let st = null; try { st = S.rig ? clone(S.rig.state()) : null; } catch (e) {}
    const a = taskAns[t.id] || {}, v = a.v != null && a.v !== '' ? parseNum(a.v) : NaN, fl = fieldsOf(t), fo = {};
    fl.forEach(f => { const raw = a.f && a.f[f.key], x = raw != null && raw !== '' ? parseNum(raw) : NaN; fo[f.key] = fin(x) ? x : null; });
    const first = fl.length ? fo[fl[0].key] : null;
    return { rig: S.rigId, controls: allCtl(), seq: seqSteps(curRows()), rows: clone(curRows()), dur: seqDur(), state: st, simTime: S.simT, value: fin(v) ? v : (fin(first) ? first : null), text: a.v == null ? '' : String(a.v), fields: fo, choices: Object.assign({}, a.c || {}), kennwerte: null };
  }
  async function checkTask() {
    const t = curTask(); if (!t) return; const R = root.THM_TASKS;
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
    S.task = null; taskRes = null; applyTaskState(t, o); S.name = sx(t.title) + ' (Musterlösung)'; S.id = null; S.dirty = false; updateChrome();
    const has = o && (o.rows && o.rows.length || o.seq && o.seq.length);
    setTab(tabFor(S.rigId) === 'cmp' ? 'cmp' : 'rig'); if (has) seqLive(); else setRun(true);
    toast((had ? 'Auto-Weg läuft, dein Stand ist gesichert' : 'Auto-Weg: Die Musterlösung läuft') + (o && fin(o.value) ? ' · Ergebnis der Musterlösung: ' + fauto(o.value) : ''));
  }
  function hintTask() {
    const t = curTask(); if (!t) return; const h = t.hint, arr = Array.isArray(h) ? h : null;
    const o = { id: t.id, hint: sx(arr ? arr[0] : h), concrete: () => { if (arr && arr[1]) return sx(arr[1]); const l = taskRes && taskRes.id === t.id ? taskRes.lines.find(x => !x.ok) : null; return l ? 'Noch nicht erfüllt: ' + sx(l.text) : taskRes && taskRes.id === t.id ? 'Alle Prüfpunkte sind erfüllt. Tippe auf „Lösung prüfen“.' : 'Tippe zuerst auf „Lösung prüfen“, dann kann ich dir den ersten offenen Punkt nennen.'; }, reveal: arr && arr[2] ? () => sx(arr[2]) : null, solution: typeof t.sol === 'function' ? () => autoWay(t) : null };
    if (root.Auswertung) root.Auswertung.hint(o); else sheet('Tipp', b => { b.innerHTML = '<p style="margin-top:0">' + esc(o.hint || '') + '</p>'; });
  }
  const choiceOpts = c => (c.options || []).map(o => (o && typeof o === 'object' ? { value: o.value, label: o.label != null ? o.label : String(o.value) } : { value: o, label: String(o) }));
  /* Tabellen im Aufgabentext (Bauteil, Übergang, Kühlkörper wie in Prüfungen): { caption?, head:[…], rows:[[…]] } oder Liste davon oder Liste von Zeilen (erste Zeile = Kopf) */
  function tableHtml(tb) {
    if (!tb) return ''; const list = Array.isArray(tb) && tb.length && !Array.isArray(tb[0]) && typeof tb[0] === 'object' ? tb : [tb];
    const cell = v => esc(sx(typeof v === 'number' ? fauto(v) : v)), one = t1 => {
      let head = t1.head || t1.header || t1.cols || t1.columns, rows = t1.rows || t1.data;
      if (Array.isArray(t1) && !head) { head = t1[0]; rows = t1.slice(1); }
      rows = Array.isArray(rows) ? rows : []; return `<div class="thm-tbl"><table>${t1.caption || t1.title ? `<caption>${esc(sx(t1.caption || t1.title))}</caption>` : ''}${Array.isArray(head) ? `<thead><tr>${head.map(h => `<th>${cell(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map(r => `<tr>${(Array.isArray(r) ? r : [r]).map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    };
    return list.map(one).join('');
  }
  function renderTasks() {
    const V = $('#taskView'), A = TK();
    if (!A) { V.innerHTML = '<div class="card pl"><h4>Aufgaben</h4><p class="big">Aufgaben folgen</p><p class="hint2">Hier erscheinen Aufgaben mit automatischer Prüfung: Grundlagen, Verlustleistung, Wärmekette, Montage, Kühlkörper wählen, Fehlersuche und Prüfungsaufgaben. Bis dahin kannst du mit den Beispielen, dem Rechner und dem Tab „Lernen“ üben.</p><div class="btns"><button class="btn pri" id="tkEx">Beispiele ansehen</button><button class="btn" id="tkRetry" data-retry>Erneut prüfen</button></div></div>'; $('#tkEx', V).onclick = openExamples; return; }
    const d = taskDone(), t = curTask(); let h = '';
    const n100 = A.filter(x => (d[x.id] || 0) >= 100).length, ic = x => (x.rig ? rigIcon(x.rig) : '🧮'), rn = x => (x.rig ? rigName(x.rig) : 'Rechner');
    h += `<div class="pbar big"><i style="width:${Math.round(100 * n100 / A.length)}%"></i></div>`;
    if (t) {
      const r = taskRes && taskRes.id === t.id ? taskRes : null, ask2 = t.ask ? (typeof t.ask === 'string' ? { label: t.ask } : t.ask) : null, ans = taskAns[t.id] || {}, fl = fieldsOf(t), cl = choicesOf(t);
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat || '')}</h4><div class="big">${esc(sx(t.title))}</div><div class="lv">${'●'.repeat(t.level || 1)}${'○'.repeat(3 - (t.level || 1))}</div>
        <p style="margin:8px 0;white-space:pre-line">${esc(sx(t.text))}</p>${tableHtml(t.table)}<p class="hint2" style="margin-top:0">Prüfstand: ${ic(t)} ${esc(rn(t))}</p>
        ${ask2 ? `<label class="f"><span>${esc(sx(ask2.label || 'Dein Ergebnis'))}${ask2.unit ? ' (' + esc(ask2.unit) + ')' : ''}</span><input id="tkAns" inputmode="decimal" autocomplete="off" value="${esc(ans.v || '')}"></label>` : ''}
        ${fl.length ? `<div class="sheetbox"><div class="gh" style="padding-top:0">Antwortblatt</div>${fl.map(f => `<label class="f"><span>${esc(sx(f.question || f.label || f.key))}${f.unit ? ' in ' + esc(f.unit) : ''}</span><input data-fk="${esc(f.key)}" inputmode="decimal" autocomplete="off" value="${esc((ans.f || {})[f.key] || '')}"></label>`).join('')}</div>` : ''}
        ${cl.map(c => `<fieldset class="choice"><legend>${esc(sx(c.q || c.label || c.key))}</legend>${choiceOpts(c).map((o, i) => `<label class="opt"><input type="radio" name="ch-${esc(c.key)}" data-ck="${esc(c.key)}" data-ci="${i}"${(ans.c || {})[c.key] !== undefined && String((ans.c || {})[c.key]) === String(o.value) ? ' checked' : ''}> ${esc(sx(o.label))}</label>`).join('')}</fieldset>`).join('')}
        <div class="btns"><button class="btn pri" data-ta="check">✓ Lösung prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button></div>
        <div class="btns"><button class="btn" data-ta="rig">${S.rigId === 'vergleich' ? 'Zum Vergleich' : 'Zum Prüfstand'}</button>${typeof t.sol === 'function' ? '<button class="btn" data-ta="auto">▶ Auto-Weg</button>' : ''}<button class="btn" data-ta="hand">Abgeben (QR)</button><button class="btn danger" data-ta="end">Aufgabe beenden</button></div>`;
      if (r) h += `<ul class="tl">${r.lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(sx(l.text))}${!l.ok && l.why ? `<details><summary>Warum?</summary>${esc(sx(l.why))}</details>` : ''}</li>`).join('')}</ul><div class="score ${r.pct === 100 ? 'ok' : ''}">${r.pct === 100 ? '🎉 Geschafft!' : r.pct + ' % richtig'}</div>`;
      h += '</div>';
    }
    const cats = []; A.forEach(x => { if (!cats.includes(x.cat)) cats.push(x.cat); });
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${A.length} Aufgaben vollständig gelöst. Wähle eine Aufgabe: Du bekommst eine Startvorlage, stellst den Prüfstand ein (oder rechnest) und lässt die Lösung prüfen.</p>
      <div class="chips" id="tkCats" style="padding:8px 0 0"><button class="chip s${!S.tkCat ? ' on' : ''}" data-cat="">Alle</button>${cats.map(c => `<button class="chip s${S.tkCat === c ? ' on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
    let last = '';
    A.forEach(x => {
      if (S.tkCat && x.cat !== S.tkCat) return;
      if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; }
      const p = d[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${p >= 100 ? 'g' : p > 0 ? 'p' : ''}">${p >= 100 ? '✓' : p > 0 ? p : ''}</span><div class="grow"><b>${esc(sx(x.title))}</b><small><span class="lv">${'●'.repeat(x.level || 1)}${'○'.repeat(3 - (x.level || 1))}</span> ${ic(x)} ${esc(rn(x))}${p != null ? ' · bisher ' + p + ' %' : ''}</small></div></button>`;
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
      if (a === 'check') checkTask(); else if (a === 'hint') hintTask(); else if (a === 'rig') setTab(S.rigId === 'vergleich' ? 'cmp' : 'rig');
      else if (a === 'auto') { const t = curTask(); if (t && await confirmSheet('Auto-Weg?', 'Der Prüfstand spielt die Musterlösung ab. Das <b>zählt als Hilfe</b> (Stufe 3): Dein Ausbilder sieht es.', 'Abspielen')) autoWay(t); }
      else if (a === 'hand') { const t = curTask(); if (t && root.Auswertung) root.Auswertung.handIn(t.id, taskDone()[t.id] || 0, sx(t.title)); }
      else if (a === 'end') { S.task = null; taskRes = null; updateChrome(); renderTasks(); toast('Aufgabe beendet'); }
    } else if (row) startTask(row.dataset.t);
  });

  /* ============================================================ Fehler-Würfel: Montage- oder Betriebsfehler auswürfeln (wirkt auf Steuerwerte) */
  const chainNow = () => { try { return (S.rig && S.rig.chain && S.rig.chain()) || {}; } catch (e) { return {}; } };
  const HEALTHY = { heatsink: 'm', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', ksPot: 'masse', fan: 'aus', orient: 'senkrecht' };
  const mountedPrep = () => { const m = {}; if (S.rig && hasCtl('heatsink') && S.rig.getControl('heatsink') === 'none') Object.keys(HEALTHY).forEach(k => { if (hasCtl(k)) m[k] = HEALTHY[k]; }); return m; };
  const kv = (v, u) => fauto(v) + ' ' + u;
  const LOADK = [['iLoad', 1.2], ['ic', 1.2], ['id', 18], ['iF', 2.5], ['iLed', 1], ['uR', 40]], VOLTK = [['ue', 24], ['uce', 20], ['u', 40], ['ub', 28]];
  const visibleCtl = c => { if (!c) return false; if (typeof c.visible !== 'function') return true; try { return !!c.visible(S.st || readState() || {}); } catch (e) { return true; } };
  const firstOf = list => { for (const [k, v] of list) { const c = ctlDef(k); if (c && c.type === 'slider' && visibleCtl(c)) return { key: k, c, target: v }; } return null; };
  const DICE = [
    { id: 'paste', ok: () => hasCtl('paste') && hasCtl('heatsink'), prep: mountedPrep, apply: () => ({ paste: 'keine' }), text: (b, a) => 'Wärmeleitpaste vergessen: ' + sy('Rth_CK') + ' steigt von ' + kv(b.rthCK, 'K/W') + ' auf ' + kv(a.rthCK, 'K/W') + '.' },
    { id: 'buchse', ok: () => hasCtl('bushing') && hasCtl('joint'), prep: () => { const m = mountedPrep(); const j = S.rig.getControl('joint'); if ((m.joint || j) === 'direkt') { m.joint = 'glimmer'; if (!m.paste && S.rig.getControl('paste') === 'keine') m.paste = 'duenn'; } return m; }, apply: () => ({ bushing: false }), text: (b, a, st) => 'Isolierbuchse vergessen: Die Schraube berührt den Kühlkörper. ' + (st && st.short ? 'Der Prüfstand meldet einen Kurzschluss.' : 'Der Prüfstand meldet keinen Kurzschluss.') },
    { id: 'schraube', ok: () => hasCtl('screw') && hasCtl('heatsink'), prep: mountedPrep, apply: () => ({ screw: 'locker' }), text: (b, a) => 'Die Schraube ist locker: ' + sy('Rth_CK') + ' steigt von ' + kv(b.rthCK, 'K/W') + ' auf ' + kv(a.rthCK, 'K/W') + '.' },
    { id: 'luefter', ok: () => hasCtl('fan') && hasCtl('heatsink'), prep: () => { const m = mountedPrep(); m.fan = 'mittel'; return m; }, apply: () => ({ fan: 'aus' }), text: (b, a) => 'Der Lüfter ist ausgefallen: ' + sy('Rth_K') + ' steigt von ' + kv(b.rthK, 'K/W') + ' auf ' + kv(a.rthK, 'K/W') + '.' },
    { id: 'gehaeuse', ok: () => hasCtl('ta'), prep: () => ({}), apply: () => ({ ta: 55 }), text: (b, a, st, bs) => 'Das Gehäuse ist zu: ' + sy('Ta') + ' steigt von ' + kv(bs && bs.ta, '°C') + ' auf ' + kv(st && st.ta, '°C') + '.' },
    { id: 'waagrecht', ok: () => hasCtl('orient') && hasCtl('heatsink'), prep: mountedPrep, apply: () => ({ orient: 'waagrecht' }), text: (b, a) => 'Der Kühlkörper steckt waagrecht: ' + sy('Rth_K') + ' steigt von ' + kv(b.rthK, 'K/W') + ' auf ' + kv(a.rthK, 'K/W') + '.' },
    { id: 'last', ok: () => !!firstOf(LOADK), prep: () => ({}), apply: () => { const f = firstOf(LOADK), cur = +S.rig.getControl(f.key); return { [f.key]: clamp(Math.max(f.target, cur), f.c.min, f.c.max) }; }, text: (b, a, st, bs, keys) => { const k = Object.keys(keys)[0], c = ctlDef(k); return 'Die Last ist zu hoch: ' + sx(c.label) + ' steht jetzt auf ' + kv(keys[k], c.unit || '') + ' (vorher ' + kv(bs[k], c.unit || '') + ').'; } },
    { id: 'spannung', ok: () => !!firstOf(VOLTK), prep: () => ({}), apply: () => { const f = firstOf(VOLTK), cur = +S.rig.getControl(f.key); return { [f.key]: clamp(Math.max(f.target, cur), f.c.min, f.c.max) }; }, text: (b, a, st, bs, keys) => { const k = Object.keys(keys)[0], c = ctlDef(k); return 'Die Eingangsspannung ist zu hoch: ' + sx(c.label) + ' steht jetzt auf ' + kv(keys[k], c.unit || '') + ' (vorher ' + kv(bs[k], c.unit || '') + ').'; } }
  ];
  function diceRoll() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; } if (S.task) { toast('Beende zuerst die Aufgabe.'); return; }
    const ok = DICE.filter(d => { try { return d.ok(); } catch (e) { return false; } }); if (!ok.length) { toast('An diesem Prüfstand lässt sich nichts auswürfeln.'); return; }
    const d = ok[Math.floor(Math.random() * ok.length)], before = {}, bs = (() => { try { return clone(S.rig.state()); } catch (e) { return {}; } })();
    const prep = d.prep() || {}, keysApply = d.apply(), all = Object.assign({}, prep, keysApply), bCh = (() => { applyCtl(prep); readState(); return chainNow(); })();
    Object.keys(all).forEach(k => { before[k] = bs[k] !== undefined ? bs[k] : S.rig.getControl(k); });
    applyCtl(keysApply); const st = readState() || {}, aCh = chainNow(), text = (Object.keys(prep).length ? 'Zuerst wurde ein gesunder Aufbau montiert. ' : '') + d.text(bCh, aCh, st, bs, keysApply);
    S.dice = { id: d.id, text, before }; S.dirty = true; saveCurSoon(); if (!S.running) setRun(true);
    if (root.LochFX) try { root.LochFX.sound('slide'); } catch (e) {}
    sheet('🎲 Fehler gewürfelt', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Am Aufbau stimmt etwas nicht. Beobachte die Temperaturen und finde die Ursache.</p><div class="btns"><button class="btn" data-d="show">Auflösung zeigen</button><button class="btn" data-d="undo">Fehler beheben</button><button class="btn pri" data-d="ok">Ich suche selbst</button></div><div id="dcOut"></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-d]'); if (!x) return; if (x.dataset.d === 'show') $('#dcOut', b).innerHTML = '<div class="ex">' + esc(S.dice.text) + '</div>'; else if (x.dataset.d === 'undo') { applyCtl(S.dice.before); S.dice = null; toast('Fehler behoben'); close(); } else close(); });
    });
  }

  /* ============================================================ Rechnen und Lernen: Erweiterungen (WP3b), Schnittstelle 6.7 */
  /* Lädt Prüfstand, Voreinstellung und Steuerwerte (zum Beispiel aus dem Rechner oder einem Lernabschnitt), settle, danach Tab Prüfstand bzw. Vergleichen */
  function loadRig(o) {
    o = o || {}; if (S.task) { toast('Beende zuerst die Aufgabe.'); return false; }
    const id = o.rig && ORDER.includes(o.rig) ? o.rig : S.main; if (!defOf(id)) { toast('Dieser Prüfstand ist noch nicht geladen.'); return false; }
    const had = stash(); S.name = o.name || 'Neuer Versuch'; S.id = null; S.dirty = false; S.rows[id] = []; setRig(id);
    if (o.preset && S.rig && typeof S.rig.applyPreset === 'function') { try { S.rig.applyPreset(o.preset); S.preset = o.preset; } catch (e) { console.error(e); } buildControls(); buildMeters(); buildPresets(); }
    if (o.controls) applyCtl(o.controls);
    if (o.settle !== false && S.rig) { try { S.rig.settle(); readState(); sample(true); } catch (e) {} }
    S.confirm = !!o.confirm; setTab(tabFor(id)); updateChrome(); saveCurSoon(); toast(had ? 'Geladen, dein Versuch ist gesichert' : (o.toast || 'Im Prüfstand geladen: ' + rigName(id)));
    return true;
  }
  function extApi() {
    return { get S() { return S; }, get rig() { return S.rig; }, setTab, loadExample, startTask, toast, esc, stat: (k, v, m) => { if (k === 'thmcalc') S.calcUsed = true; stat(k, v, m); }, lsGet, lsSet, get THM_CORE() { return CORE(); }, KEYS, loadRig, sx, sy, symSet, tableHtml, setView, tunit: TU, rigName, rigIcon, defOf, ORDER, SPEEDS };
  }
  function renderExt(kind) {
    const host = $(kind === 'calc' ? '#calcView' : '#helpView'), E = root.THM_UI_EXT && root.THM_UI_EXT[kind];
    if (!host) return;
    if (!E || typeof E.render !== 'function') { host.innerHTML = `<div class="card pl"><p class="big">${kind === 'calc' ? 'Rechner wird geladen' : 'Lernen wird geladen'}</p><p class="hint2">Die Datei ${kind === 'calc' ? 'thmui-calc.js' : 'thmui-help.js'} ist noch nicht geladen.</p><div class="btns"><button class="btn" data-retry>Erneut prüfen</button></div></div>`; return; }
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
  function redrawTab() { if (S.tab === 'rig' || S.tab === 'cmp') { drawScopes(); drawCurves(true); } if (S.tab === 'seq') drawSeqChart(); }
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'rig'; const prev = S.tab; S.tab = t; lsPut('thm.tab', t);
    if (!S.task) { if (t === 'cmp' && S.rigId !== 'vergleich') useRig('vergleich'); else if (t === 'rig' && S.rigId === 'vergleich') useRig(S.main); }
    $('#mid').dataset.tab = t; $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'seq') renderSeq(); else if (t === 'calc') renderExt('calc'); else if (t === 'tasks') renderTasks(); else if (t === 'help') renderExt('help'); else if (t === 'cmp') { renderCmp(true); S.compared = S.compared || false; }
    buildPick(); updateChrome();
    requestAnimationFrame(() => { fitCanvas(); updateMeters(0, true); redrawTab(); syncCtl(true); });
    if (prev !== t && t === 'seq') renderSeqLive();
  }
  function updateTitle() {
    const nm = rigName(S.rigId || 'linear');
    $('#title').innerHTML = esc(S.name) + (S.dirty ? ' •' : '') + '\n<small>' + esc(nm) + (S.attrappe ? ' (Notfall-Attrappe)' : '') + (S.running ? ' · läuft' : '') + '</small>';
    document.title = 'Thermik-Lab: ' + S.name;
    const tag = $('#cvTag'); if (tag) { tag.textContent = S.running ? '' : '⏸ Pause'; tag.style.display = S.running ? 'none' : ''; }
  }
  $('#title').onclick = async () => { const r = await ask('Name des Versuchs', [{ key: 'n', label: 'Name', type: 'text', value: S.name }]); if (r && r.n.trim()) { S.name = r.n.trim(); S.dirty = true; updateChrome(); saveCurSoon(); } };
  let palSig = '';
  function buildPal() {
    const fxOn2 = fxOn(), sig = [S.running, S.speed, fxOn2, !!S.rig, !!S.live].join('|');
    if (sig === palSig) return; palSig = sig; const F = !!root.LochFX;
    $('#pal').innerHTML = `<button class="chip ${S.running ? 'on' : 'go'}" data-a="run" aria-label="${S.running ? 'Pause' : 'Start'}">${S.running ? '⏸ Pause' : '▶ Start'}</button><button class="chip" data-a="reset" aria-label="Zurücksetzen">⟲ Reset</button><button class="chip" data-a="settle" aria-label="Beharrungszustand: gleich eingeschwungen" title="Beharrungszustand (B)">⚡</button><span class="sep"></span>
      <span class="seg" aria-label="Zeitraffer">${SPEEDS.map(v => `<button data-sp="${v}" class="${S.speed === v ? 'on' : ''}">×${String(v).replace('.', ',')}</button>`).join('')}</span><span class="sep"></span>
      <button class="chip" data-a="view" aria-label="Ansicht wechseln" title="Ansicht wechseln (V)">👁 Ansicht</button>${F ? `<button class="chip ${fxOn2 ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn2}" aria-label="Effekte und Ton" title="Effekte und Ton">${fxOn2 ? '🎉' : '🔇'} Effekte</button>` : ''}
      <span id="stat"></span>`;
    const r = $('#bRun'); r.textContent = S.running ? '⏸' : '▶'; r.classList.toggle('on', S.running); r.setAttribute('aria-label', S.running ? 'Pause' : 'Start');
    updateStat();
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sp) setSpeed(+b.dataset.sp);
    else if (b.dataset.a === 'run') setRun(!S.running); else if (b.dataset.a === 'reset') resetRig(); else if (b.dataset.a === 'settle') settleNow(); else if (b.dataset.a === 'view') nextView();
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
      ['fx', 'Effekte und Ton: ' + (fxOn() ? 'an' : 'aus'), 'Sprechblasen, Konfetti und lustige Töne ein- oder ausschalten'], ['png', 'Prüfstandbild speichern (PNG)', 'Aktuelle Ansicht als Bilddatei'], ['csv', 'Aufzeichnung als CSV', 'Messschreiber-Daten für Excel (Zeit in Prozess-Minuten)'], ['dice', 'Fehler-Würfel', 'Einen Montage- oder Betriebsfehler auswürfeln und suchen'],
      ['calc2', 'Rechnen', 'Prüfungsassistent, Verlustleistung, Kühlkörper, Zeitverhalten und Übungen'], ['calc', 'Taschenrechner', 'Ohm, Farbcode, Leitung und mehr'],
      ['abz', 'Abzeichen', 'Deine Sammlung und was noch fehlt'], ['kamp', 'Kampagne: Der Kühlkörper', 'Lernpfad mit Geschichte über alle Labs'], ['trainer', 'Trainer: Erste Schritte', 'Kurze Einführung zum Mitmachen'],
      ['neu', 'Neu in dieser Version', 'Was zuletzt dazukam und wo du es findest'], ['erg', 'Ergebnis senden', 'Code für den Ausbilder: meine bearbeiteten Aufgaben'], ['keys', 'Tastenkürzel', kk + ' und mehr (Taste ? drücken)'], ['help', 'Hilfe und Lernen', 'Grundlagen kurz erklärt'], ['start', 'Zur Startseite', '']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b>${r[2] ? `<small>${esc(r[2])}</small>` : ''}</div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); menuAct(r.dataset.m); });
    });
  }
  async function newExperiment() {
    if (S.task) { toast('Beende zuerst die Aufgabe.'); return; }
    const v = await pick('Neuer Versuch: Prüfstand wählen', ORDER.map(id => ({ value: id, label: rigName(id), sub: ((defOf(id) || {}).info) || RIGMETA[id].info, icon: rigIcon(id), mark: defOf(id) ? '' : 'fehlt' })));
    if (!v) return; const had = stash(); S.name = 'Neuer Versuch'; S.id = null; S.dirty = false; S.rows[v] = []; setRig(v); setTab(tabFor(v));
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
  let last = 0, lastUI = 0, lastSc = 0; const perf = { n: 0, sum: 0, max: 0, recent: [] };
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = ts; return; }
    const t0 = performance.now(), dt = Math.min(100, ts - (last || ts)); last = ts;
    if (S.running && S.rig) {
      try { simAdvance(dt); }
      catch (e) { S.running = false; S.live = null; console.error('Simulation:', e); toast('Der Prüfstand hat einen Rechenfehler gemeldet und wurde angehalten.'); updateChrome(); }
    }
    if (S.rig) watchEvents(ts);
    if (S.tab === 'rig' || S.tab === 'cmp') {
      drawRig(ts); updateMeters(dt);
      if (ts - lastSc > 70) { lastSc = ts; drawScopes(); }
      if (ts - lastUI > 100) {
        lastUI = ts; readState(); syncCtl(); updateStat(); updateDiag(); renderCmp(); drawCurves(); checkBadges();
        const fb = $('#cvFault'), on = performance.now() < (S.faultUntil || 0);
        if (fb) { if (on) { const tx = S.faultText || ''; if (fb.textContent !== tx) fb.textContent = tx; } if (fb.classList.contains('on') !== on) fb.classList.toggle('on', on); }
      }
    } else if (ts - lastUI > 200) { lastUI = ts; readState(); updateStat(); checkBadges(); }
    fxFrame();
    if (S.tab === 'seq' && ts - lastSc > 100) { lastSc = ts; renderSeqLive(); }
    const w = performance.now() - t0; perf.n++; perf.sum += w; if (w > perf.max) perf.max = w; perf.recent.push(w); if (perf.recent.length > 120) perf.recent.shift();
  }

  /* ============================================================ Schnittstellen für Trainer, Tasten, Tests */
  root.LabTrainerAPI = {
    lab: 'thm', tab: () => S.tab, go: setTab, simMode: () => S.running, running: () => S.running, rig: () => S.rigId, speed: () => S.speed,
    load: loadExampleByName, examples: () => exampleList().map(e => e.name), task: () => (S.task ? S.task.id : null), saved: () => saves().length,
    seqRows: () => curRows().length, seqDone: () => !!S.seqRes, simTime: () => S.simT, faults: () => (lsGet('thm.faults', []) || []).length, calcUsed: () => !!S.calcUsed,
    montageChanged: () => !!S.montage, compared: () => !!S.compared, shutdownSeen: () => !!S.shutSeen, viewChanged: () => !!S.viewChanged
  };
  root.LabKeysAdapter = {
    lab: 'thm', sheet: (title, build) => (title === 'Tastenkürzel' ? sheet(title, b => { b.innerHTML = keysHtml(); }) : sheet(title, build)), esc, toast,
    sim: () => setRun(!S.running), busy: () => true, has: () => false
  };
  /* kleine Testschnittstelle */
  root.THM_UI = { frame, S, KEYS, TABS, ORDER, setTab, setRig, useRig, setCtl, applyCtl, setRun, resetRig, simAdvance, loadExample, loadExampleByName, startTask, checkTask, seqRunBg, seqLive, seqSteps, seqToRows, curRows, allCtl, coerce, csvText, parseCsv, seqCsv, shareObj, packShare, unpackShare, applyItem, saveItem, sample, diceRoll, DICE, exampleList, BUILTIN, renderSeq, drawScopes, metricsHtml, extApi, collectAnswer, retryLoad, openMenu, scopeWin, rowNorm, seqDur, slPos, slVal, sx, sy, setSym, setView, settleNow, toCmp, verglFromMain, loadRig, tableHtml, cmpData, cmpHtml, rangHtml, drawChart, perf: () => ({ n: perf.n, mean: perf.n ? perf.sum / perf.n : 0, max: perf.max, recentMean: perf.recent.length ? perf.recent.reduce((a, b) => a + b, 0) / perf.recent.length : 0 }), tstr, fnum, defSpan, toggleCtl, nextView, DUMMY };

  /* ============================================================ Start */
  function init() {
    { const C0 = CORE(); if (C0 && typeof C0.symSet === 'function') { try { C0.symSet(S.sym); } catch (e) {} } }
    buildTabs(); $('#scopeHost').innerHTML = scopeBoxHtml('scopeR'); wireScope($('#scopeR')); $('#curveHost').innerHTML = crvHtml();
    const cur = lsGet('thm.cur', null);
    if (cur && ORDER.includes(cur.rig)) {
      S.rows = cur.rows && typeof cur.rows === 'object' && !Array.isArray(cur.rows) ? cur.rows : {}; Object.keys(S.rows).forEach(k => { S.rows[k] = Array.isArray(S.rows[k]) ? rowNorm(S.rows[k].filter(r => r && typeof r.key === 'string')) : []; });
      S.name = cur.name || 'Neuer Versuch'; S.id = cur.id || null; S.seqDur = cur.dur && typeof cur.dur === 'object' ? cur.dur : {}; S.seqSettle = cur.settle && typeof cur.settle === 'object' ? cur.settle : {};
      if (MAIN.includes(cur.main)) S.main = cur.main; if (MAIN.includes(cur.rig)) S.main = cur.rig;
      setRig(cur.rig); applyCtl(cur.ctl); S.dirty = !!cur.dirty; S.task = cur.task ? { id: cur.task } : null;
    } else {
      setRig(ORDER[0]);
      if (!lsRaw('thm.seen', '')) { lsPut('thm.seen', '1'); setTimeout(() => toast('Willkommen! Starte mit ▶ unten oder bewege einen Regler: Der Prüfstand läuft dann los.'), 900); }
    }
    setTab(S.tab); requestAnimationFrame(frame);
    root.addEventListener('load', () => { if (S.tab === 'calc' || S.tab === 'help') renderExt(S.tab); });
    /* Aufrufparameter von Startseite, Lernpfad, Kampagne und Lernheften: ?aufgabe=th1, ?ex=Name, ?bsp, ?neu */
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
