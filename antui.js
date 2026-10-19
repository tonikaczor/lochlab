'use strict';
/* Tonfunk Antriebs-Lab: Oberfläche.
   Seite, Tabs (Prüfstand, Kennlinien, Ablauf, Rechnen, Aufgaben, Lernen), Bedienpult und Messgeräte automatisch aus rig.controls / rig.meters,
   Zeitschreiber, Kennlinien-Schreiber, Ablaufprogramm-Editor, Rechner mit Übungsgenerator, Speichern/Öffnen/Teilen, Aufgabenanbindung, Effekte.
   Die Prüfstände kommen aus antrig-*.js über window.ANT_RIGS (Registry), Physik und Läufer aus antcore.js (window.ANT_CORE), Beispiele und Aufgaben aus antdata.js.
   Speicher: ant.cur (laufende Arbeit), ant.saves (gespeicherte Versuche), ant.tab, ant.speed, ant.digital, ant.faults, ant.rigsused, sim.done (Aufgaben, gemeinsam mit den anderen Labs). */
(function (root) {
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const lsRaw = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsPut = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const clone = o => JSON.parse(JSON.stringify(o));
  const uid = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const stat = (k, v, m) => { if (root.Badges) try { root.Badges.stat(k, v, m); } catch (e) {} };
  const ORDER = ['gleichstrom', 'servo', 'schritt', 'drehstrom', 'getriebe'];
  const RIGMETA = {
    gleichstrom: { icon: '⚙️', name: 'Gleichstrommotor', file: 'antrig-dc.js', info: 'Gleichstrommotor mit H-Brücke und PWM' },
    servo: { icon: '🎛️', name: 'Servo', file: 'antrig-servo.js', info: 'Servo mit Lageregelung' },
    schritt: { icon: '🔩', name: 'Schrittmotor', file: 'antrig-step.js', info: 'Schrittmotor mit Treiber' },
    drehstrom: { icon: '🌀', name: 'Drehstrommotor', file: 'antrig-ac.js', info: 'Asynchronmotor mit Stern-Dreieck und Frequenzumrichter' },
    getriebe: { icon: '🛠️', name: 'Getriebe', file: 'antrig-gear.js', info: 'Getriebe und Mechanik' }
  };
  const decs = step => { step = +step || 0; if (!step || step >= 1) return 0; return Math.min(3, Math.ceil(-Math.log10(step) - 1e-9)); };
  const fnum = (v, d) => (isFinite(v) && v !== null ? (+v).toFixed(d == null ? 1 : d) : '–').replace('.', ',');
  const num1 = x => fnum(x, 1);
  const parseNum = s => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
  const mmss = ms => { const s = Math.floor(ms / 1000), m = Math.floor(s / 60); return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') + ',' + Math.floor((ms % 1000) / 100); };
  const clickSnd = k => { if (root.LochFX) try { root.LochFX.sound(k || 'tick'); } catch (e) {} };

  /* ============================================================ Fenster, Meldungen, Dialoge */
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2400, m.length * 55)); }
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
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        const search = options.length > 14;
        b.innerHTML = (opt.intro ? `<p class="hint2" style="margin-top:0">${esc(opt.intro)}</p>` : '') + (search ? '<input id="pq" type="search" placeholder="Suchen …" autocomplete="off" style="margin-bottom:6px">' : '') + '<div id="pl"></div>';
        const draw = q => {
          let last = null, html = '';
          options.forEach((o, i) => {
            if (q && !((o.label || '') + ' ' + (o.sub || '') + ' ' + (o.group || '') + ' ' + (o.value == null ? '' : o.value)).toLowerCase().includes(q)) return;
            if (o.group !== last) { last = o.group; if (o.group) html += `<div class="gh">${esc(o.group)}</div>`; }
            html += `<button class="row" data-i="${i}"${o.disabled ? ' disabled' : ''}>${o.icon ? `<span style="font-size:22px">${o.icon}</span>` : ''}<div class="grow"><b>${esc(o.label)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div>${o.mark ? `<span class="lv">${esc(o.mark)}</span>` : ''}</button>`;
          });
          $('#pl', b).innerHTML = html || '<p class="hint2">Nichts gefunden.</p>';
        };
        draw('');
        if (search) $('#pq', b).addEventListener('input', e => draw(e.target.value.trim().toLowerCase()));
        b.addEventListener('click', e => { const r = e.target.closest('.row[data-i]'); if (!r || r.disabled) return; fin(options[+r.dataset.i].value); close(); });
      }, () => fin(null));
    });
  }
  function ask(title, fields, opt) {
    opt = opt || {};
    return new Promise(res => {
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        b.innerHTML = (opt.intro ? `<p class="hint2" style="margin-top:0">${esc(opt.intro)}</p>` : '') + fields.map((f, i) =>
          `<label class="f"><span>${esc(f.label)}</span><input id="ak${i}" type="text" inputmode="${f.type === 'number' ? 'decimal' : 'text'}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(f.value == null ? '' : f.value)}"></label>`).join('') +
          '<div id="akErr" class="hint2" style="color:#ff8a7a;min-height:18px"></div><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn pri" data-ok>OK</button></div>';
        const ok = () => {
          const out = {};
          for (let i = 0; i < fields.length; i++) {
            const f = fields[i], raw = $('#ak' + i, b).value;
            if (f.type === 'number') { const v = parseNum(raw); if (!isFinite(v)) { $('#akErr', b).textContent = f.label + ': Bitte eine Zahl eingeben.'; return; } out[f.key] = v; } else out[f.key] = raw;
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
  root.LabUI = { sheet, esc, toast, userName: () => lsRaw('lm4.name', ''), LAB: 'ant' };
  root.sheet = sheet; root.toast = toast;

  /* ============================================================ Notfall-Attrappe (nur wenn ANT_RIGS ganz fehlt) */
  const DUMMY = (function () {
    const controls = [
      { key: 'uSupply', label: 'Netzteil', type: 'slider', min: 6, max: 24, step: 0.5, unit: 'V', value: 12, group: 'Netzteil' },
      { key: 'duty', label: 'Tastgrad', type: 'slider', min: 0, max: 100, step: 1, unit: '%', value: 0, group: 'Steuerung' },
      { key: 'dir', label: 'Drehrichtung', type: 'select', options: [{ value: 'vor', label: 'vor' }, { value: 'zurueck', label: 'zurück' }], value: 'vor', group: 'Steuerung' },
      { key: 'load', label: 'Lastmoment', type: 'slider', min: 0, max: 0.4, step: 0.01, unit: 'Nm', value: 0, group: 'Last' },
      { key: 'brake', label: 'Bremsen', type: 'button', group: 'Last' }
    ];
    const meters = [
      { key: 'rpm', label: 'Drehzahl', unit: '1/min', digits: 0, min: 0, max: 4000 },
      { key: 'current', label: 'Strom', unit: 'A', digits: 2, min: 0, max: 10, warnAbove: 6 },
      { key: 'torque', label: 'Drehmoment', unit: 'Nm', digits: 3, min: 0, max: 0.5 },
      { key: 'temp', label: 'Temperatur', unit: '°C', digits: 0, min: 0, max: 150, warnAbove: 110 }
    ];
    const Ra = 1.2, Ke = 0.03, J = 2e-4, fr = 0.0005;
    function create() {
      const c = {}; controls.forEach(x => { if (x.value != null) c[x.key] = x.value; });
      const s = { w: 0, i: 0, tq: 0, th: 0, temp: 25, t: 0 }, events = [];
      let hot = false, stalled = false;
      const ev = (text, kind, fx) => events.push({ t: s.t, text, kind, fx });
      const rig = {
        controls, meters, events, presets: [],
        setControl(k, v) { c[k] = v; }, getControl(k) { return c[k]; },
        step(dt) {
          let left = dt;
          while (left > 0) {
            const h = Math.min(1, left); left -= h;
            const sgn = c.dir === 'zurueck' ? -1 : 1, u = c.brake ? 0 : sgn * (c.duty / 100) * (c.uSupply - 0.4);
            const i = (u - Ke * s.w) / Ra; s.i = i; const m = Ke * i;
            const stuck = Math.abs(s.w) < 0.5 && Math.abs(m) < c.load, load = c.load * (s.w >= 0 ? 1 : -1);
            s.tq = m;
            if (stuck) s.w = 0; else s.w += (m - load - fr * s.w) / J * h / 1000;
            s.th += s.w * h / 1000;
            s.temp += (i * i * Ra * 0.9 - (s.temp - 25) * 0.08) * h / 1000 / 2.5; s.t += h;
            const stl = Math.abs(s.w) < 1 && Math.abs(i) > 3;
            if (stl && !stalled) { stalled = true; ev('Der Motor blockiert: Das Lastmoment ist größer als das Anlaufmoment.', 'error', 'stall'); } else if (!stl) stalled = false;
            if (s.temp > 110 && !hot) { hot = true; ev('Die Wicklung wird zu heiß (über 110 °C)!', 'error', 'overheat'); } else if (s.temp < 90) hot = false;
          }
        },
        readMeters() { return { rpm: Math.abs(s.w) * 60 / (2 * Math.PI), current: Math.abs(s.i), torque: Math.abs(s.tq), temp: s.temp }; },
        state() { return { rpm: s.w * 60 / (2 * Math.PI), torque: s.tq, current: Math.abs(s.i), temp: s.temp, stalled, faults: [] }; },
        draw(g, w, h) {
          const sc = Math.min(w / 1000, h / 560); g.save(); g.translate((w - 1000 * sc) / 2, (h - 560 * sc) / 2); g.scale(sc, sc);
          g.fillStyle = '#1b2128'; g.fillRect(0, 0, 1000, 560); g.fillStyle = '#2c343e'; g.fillRect(160, 330, 680, 40);
          g.save(); g.translate(500, 200); g.fillStyle = '#39424d'; g.beginPath(); g.arc(0, 0, 130, 0, 7); g.fill(); g.rotate(s.th); g.strokeStyle = '#8d99a6'; g.lineWidth = 10;
          for (let k = 0; k < 6; k++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 110); g.stroke(); } g.fillStyle = '#ffb340'; g.beginPath(); g.arc(0, 0, 18, 0, 7); g.fill(); g.restore();
          g.fillStyle = '#8d99a6'; g.font = '600 26px system-ui'; g.textAlign = 'center'; g.fillText('Notfall-Attrappe: die Prüfstände sind nicht geladen', 500, 440); g.restore();
        },
        curves() {
          const U = c.uSupply * (c.duty / 100), pts = [], pw = [];
          for (let m = 0; m <= 0.4001; m += 0.02) { const n = Math.max(0, (U - Ra * m / Ke) / Ke * 60 / (2 * Math.PI)); pts.push([m, n]); pw.push([m, m * n * 2 * Math.PI / 60]); }
          return [{ id: 'nm', title: 'Drehzahl über Moment', xLabel: 'Moment', xUnit: 'Nm', yLabel: 'Drehzahl', yUnit: '1/min', series: [{ name: 'n(M)', points: pts }], marker: { x: Math.abs(s.tq), y: Math.abs(s.w) * 60 / (2 * Math.PI) } },
            { id: 'pm', title: 'Leistung über Moment', xLabel: 'Moment', xUnit: 'Nm', yLabel: 'Leistung', yUnit: 'W', series: [{ name: 'P(M)', points: pw }], marker: { x: Math.abs(s.tq), y: Math.abs(s.w * s.tq) } }];
        },
        reset() { s.w = 0; s.i = 0; s.tq = 0; s.th = 0; s.temp = 25; s.t = 0; hot = false; stalled = false; events.length = 0; controls.forEach(x => { c[x.key] = x.value != null ? x.value : false; }); },
        worldSize() { return { w: 1000, h: 560 }; }
      };
      return rig;
    }
    return { id: 'gleichstrom', name: 'Gleichstrom (Notfall-Attrappe)', icon: '⚙️', info: 'Einfache Ersatzanzeige, bis die echten Prüfstände geladen sind.', controls, meters, create, attrappe: true };
  })();
  const defOf = id => {
    const r = root.ANT_RIGS;
    if (r && r.defs && r.defs[id]) return r.defs[id];
    if (!r && id === 'gleichstrom') return DUMMY;
    return null;
  };
  const rigName = id => { const d = defOf(id); return (d && !d.attrappe && d.name) || (RIGMETA[id] || {}).name || id; };
  const rigIcon = id => { const d = defOf(id); return (d && d.icon) || (RIGMETA[id] || {}).icon || '⚙️'; };

  /* ============================================================ Zustand */
  const S = {
    tab: lsRaw('ant.tab', 'rig'), rigId: null, rig: null, err: '', name: 'Neuer Versuch', id: null, task: null, dirty: false,
    running: false, speed: +lsRaw('ant.speed', '1') || 1, digital: lsRaw('ant.digital', '0') === '1',
    ctl: {}, simT: 0, rows: {}, live: null, seqRes: null, readonly: false, sigOn: { rpm: true, current: true, torque: true, temp: true }
  };
  if (!['rig', 'curves', 'seq', 'calc', 'tasks', 'help'].includes(S.tab)) S.tab = 'rig';
  if (![0.5, 1, 2, 5].includes(S.speed)) S.speed = 1;
  let rec = [], recAcc = 0, drawErr = false;

  /* Signale für den Zeitschreiber: rpm, current, torque, temp aus state() oder readMeters() */
  const SIGS = [
    { k: 'rpm', n: 'Drehzahl', u: '1/min', c: '#3b9eff', st: ['rpm'], mt: ['rpm', 'nOut', 'n'] },
    { k: 'current', n: 'Strom', u: 'A', c: '#ffb340', st: ['current', 'iLine', 'i'], mt: ['current', 'iMotor', 'iLine'] },
    { k: 'torque', n: 'Moment', u: 'Nm', c: '#4cd964', st: ['torque'], mt: ['torque', 'mOut'] },
    { k: 'temp', n: 'Temperatur', u: '°C', c: '#ff5c5c', st: ['temp'], mt: ['temp'] }
  ];
  const fin = v => typeof v === 'number' && isFinite(v);
  function sigVals(st, mt) {
    const o = {};
    SIGS.forEach(s => {
      let v = null;
      for (const k of s.st) if (st && fin(st[k])) { v = st[k]; break; }
      if (v == null) for (const k of s.mt) if (mt && fin(mt[k])) { v = mt[k]; break; }
      o[s.k] = v;
    });
    return o;
  }
  const ctlsOf = () => (S.rig ? (S.rig.controls || (defOf(S.rigId) || {}).controls || []) : []);
  const metersOf = () => (S.rig ? (S.rig.meters || (defOf(S.rigId) || {}).meters || []) : []);
  const ctlDef = (key, list) => (list || ctlsOf()).find(c => c.key === key);
  /* Wert an die Definition anpassen (Auswahl über Wert oder Beschriftung, Schieber begrenzen); undefined = nicht passend */
  function coerce(def, v) {
    if (!def) return undefined;
    if (v && typeof v === 'object' && 'rel' in v && def.type === 'slider') v = def.min + (def.max - def.min) * (+v.rel || 0);
    if (def.type === 'slider') { v = +v; if (!isFinite(v)) return undefined; return Math.max(def.min, Math.min(def.max, v)); }
    if (def.type === 'switch' || def.type === 'button') return !!v;
    if (def.type === 'select') {
      const o = def.options || [];
      const m = o.find(x => x.value === v) || o.find(x => String(x.value) === String(v)) || o.find(x => String(x.label).toLowerCase() === String(v).toLowerCase()) || (String(v).length > 2 ? o.find(x => String(x.label).toLowerCase().startsWith(String(v).toLowerCase())) : null);
      return m ? m.value : undefined;
    }
    return v;
  }

  /* ============================================================ Prüfstand wechseln, Steuerwerte */
  function setRig(id, o) {
    o = o || {};
    if (!ORDER.includes(id)) id = ORDER[0];
    S.rigId = id; S.rig = null; S.err = ''; S.running = false; S.simT = 0; S.live = null; S.seqRes = null;
    rec = []; recAcc = 0; S.ctl = {}; S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; fxReset(); S.curveCache = null; S.preset = null;
    const d = defOf(id);
    if (d) { try { S.rig = d.create(o.opts || {}); } catch (e) { S.err = (e && e.message) || String(e); console.error('Prüfstand ' + id + ':', e); } }
    if (!S.rows[id]) S.rows[id] = [];
    S.attrappe = !!(d && d.attrappe);
    buildPick(); buildPresets(); buildControls(); buildMeters(); fitCanvas(); updateEvents(true); updateChrome();
    if (S.tab === 'curves') renderCurves(); if (S.tab === 'seq') renderSeq();
    saveCurSoon();
  }
  /* mehrere Steuerwerte setzen: map { key: Wert }, nur passende Schlüssel, ohne Hinweise */
  function applyCtl(map) {
    if (!S.rig || !map) return;
    Object.keys(map).forEach(k => {
      const v = coerce(ctlDef(k), map[k]); if (v === undefined) return;
      try { S.rig.setControl(k, v); S.ctl[k] = v; } catch (e) { console.error('Steuerwert ' + k, e); }
    });
    syncCtl(true);
  }
  function setCtl(key, val, silent) {
    if (!S.rig || S.readonly) return;
    const def = ctlDef(key), v = coerce(def, val); if (v === undefined) return;
    try { S.rig.setControl(key, v); } catch (e) { console.error(e); return; }
    S.ctl[key] = v;
    if (!silent) { S.dirty = true; saveCurSoon(); if (!S.running && def.type !== 'button' && !S.live) setRun(true, true); }
    syncCtl();
  }
  const allCtl = () => { const o = {}; if (S.rig) ctlsOf().forEach(c => { try { const v = S.rig.getControl(c.key); if (v !== undefined) o[c.key] = v; } catch (e) {} }); return o; };
  const curRows = () => S.rows[S.rigId] || (S.rows[S.rigId] = []);
  const snapshot = () => ({ rig: S.rigId, ctl: allCtl(), rows: clone(curRows()), name: S.name });
  let curT = 0;
  function saveCurSoon() { clearTimeout(curT); curT = setTimeout(saveCur, 400); }
  function saveCur() { if (!S.rig) return; lsSet('ant.cur', { rig: S.rigId, ctl: allCtl(), rows: S.rows, name: S.name, id: S.id, task: S.task ? S.task.id : null, dirty: S.dirty }); }
  function usedRig() {
    if (S.attrappe || !S.rigId) return;
    const a = lsGet('ant.rigsused', []), s = new Set(Array.isArray(a) ? a : []); s.add(S.rigId); lsSet('ant.rigsused', [...s]); stat('antrigs', s.size, 'max');
  }

  /* ---- Prüfstandwahl und Voreinstellungen ---- */
  function buildPick() {
    $('#rigPick').innerHTML = ORDER.map(id => {
      const have = !!defOf(id) && !(defOf(id).attrappe && id !== 'gleichstrom');
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
    el.innerHTML = `<div class="gh" style="padding-top:2px">Voreinstellung</div><div class="mgr">${P.map(p => `<button class="chip s${S.preset === p.id ? ' on' : ''}" data-pre="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>`;
  }
  $('#presetBar').addEventListener('click', e => {
    const b = e.target.closest('[data-pre]'); if (!b || !S.rig) return;
    const p = presetsOf().find(x => String(x.id) === b.dataset.pre); if (!p) return;
    const keep = allCtl();
    S.preset = p.id; let done = false;
    for (const fn of ['applyPreset', 'setPreset']) if (typeof S.rig[fn] === 'function') { try { S.rig[fn](p.id, p.params); done = true; } catch (er) { console.error(er); } break; }
    if (!done) { const rid = S.rigId, d = defOf(rid); try { S.rig = d.create({ preset: p.id, params: p.params, seed: 1 }); } catch (er) { console.error(er); toast('Voreinstellung nicht möglich'); return; } S.evSeen = new WeakSet(); }
    rec = []; S.simT = 0; S.live = null; Object.keys(S.ctl).forEach(k => { if (!(k in keep)) delete S.ctl[k]; });
    buildControls(); buildMeters(); buildPresets(); toast('Voreinstellung: ' + p.name); S.dirty = true; saveCurSoon();
  });

  /* ---- Platzhalter, wenn ein Prüfstand fehlt ---- */
  const FILES = ['antcore.js', 'antrig-dc.js', 'antrig-servo.js', 'antrig-step.js', 'antrig-ac.js', 'antrig-gear.js', 'antdata.js'];
  function placeholderHtml() {
    const why = S.err ? 'Der Prüfstand konnte nicht gestartet werden: ' + esc(S.err) : 'Die Datei für „' + esc(rigName(S.rigId)) + '“ ist noch nicht geladen.';
    return `<div class="ph2"><b>Prüfstand noch nicht geladen</b>${why}<br><button class="btn" data-retry>Erneut prüfen</button></div>`;
  }
  function retryLoad() {
    const want = FILES.filter(f => {
      if (f === 'antcore.js') return !root.ANT_CORE; if (f === 'antdata.js') return !root.ANT_DATA && !root.ANT_TASKS;
      const id = ORDER.find(i => RIGMETA[i].file === f); return !(root.ANT_RIGS && root.ANT_RIGS.defs && root.ANT_RIGS.defs[id]);
    });
    if (!want.length) { setRig(S.rigId); toast('Alles geladen'); return Promise.resolve(); }
    toast('Lade fehlende Dateien …');
    return Promise.all(want.map(f => new Promise(res => {
      const s = document.createElement('script'); s.src = f + '?t=' + Date.now(); s.onload = s.onerror = () => res(); document.head.appendChild(s);
    }))).then(() => {
      const still = ORDER.filter(i => !defOf(i)).length;
      const keep = S.rig ? allCtl() : ((lsGet('ant.cur', {}) || {}).ctl || {}); setRig(S.rigId); applyCtl(keep); buildPick();
      if (S.tab === 'tasks') renderTasks(); toast(still ? still + ' Prüfstand' + (still > 1 ? 'e fehlen' : ' fehlt') + ' noch' : 'Alle Prüfstände geladen');
    });
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-retry]')) retryLoad(); });

  /* ============================================================ Bedienpult aus rig.controls */
  let ctlEls = {};
  const unitOf = c => (c.unit ? ' ' + c.unit : '');
  function ctlHtml(c) {
    const k = esc(c.key), help = c.help ? `<small class="hp">${esc(c.help)}</small>` : '';
    if (c.type === 'slider') return `<div class="ct" data-k="${k}" data-t="slider"><div class="ctl"><span>${esc(c.label)}</span><b class="vl"></b></div>${help}<input type="range" min="${c.min}" max="${c.max}" step="${c.step || 'any'}" value="${c.value == null ? c.min : c.value}" aria-label="${esc(c.label)}"></div>`;
    if (c.type === 'switch') return `<div class="ct p0" data-k="${k}" data-t="switch"><button class="sw" role="switch" aria-checked="false" aria-label="${esc(c.label)}"><span class="lab">${esc(c.label)}${help}</span><span class="tgl"><i></i></span></button></div>`;
    if (c.type === 'button') return `<div class="ct p0" data-k="${k}" data-t="button"><button class="bt">${esc(c.label)} (halten)</button>${help ? `<div style="padding:0 12px 4px">${help}</div>` : ''}</div>`;
    if (c.type === 'select') {
      const o = c.options || [];
      const body = o.length <= 4 ? `<div class="seg">${o.map((x, i) => `<button data-i="${i}">${esc(x.label)}</button>`).join('')}</div>` : `<select aria-label="${esc(c.label)}">${o.map((x, i) => `<option value="${i}">${esc(x.label)}</option>`).join('')}</select>`;
      return `<div class="ct" data-k="${k}" data-t="select"><div class="ctl"><span>${esc(c.label)}</span></div>${help}${body}</div>`;
    }
    return '';
  }
  function buildControls() {
    const H = $('#ctlHost'); ctlEls = {};
    if (!S.rig) { H.innerHTML = '<div class="card">' + placeholderHtml() + '</div>'; return; }
    const list = ctlsOf(), groups = [], gm = {};
    list.forEach(c => { const g = c.group || 'Bedienung'; if (!gm[g]) { gm[g] = { n: g, items: [] }; groups.push(gm[g]); } gm[g].items.push(c); });
    H.innerHTML = groups.map(g => `<details class="card ctg" open><summary>${esc(g.n)}</summary><div class="cb">${g.items.map(ctlHtml).join('')}</div></details>`).join('');
    $$('.ct[data-k]', H).forEach(el => { ctlEls[el.dataset.k] = { el, t: el.dataset.t, last: undefined }; });
    syncCtl(true);
  }
  function syncCtl(force) {
    if (!S.rig) return;
    ctlsOf().forEach(c => {
      const x = ctlEls[c.key]; if (!x) return;
      let v; try { v = S.rig.getControl(c.key); } catch (e) { return; }
      if (!force && x.last === v) return; x.last = v; const el = x.el;
      if (c.type === 'slider') {
        const inp = $('input', el), vl = $('.vl', el), n = +v;
        if (document.activeElement !== inp || force) { if (isFinite(n)) inp.value = n; }
        vl.textContent = fnum(n, decs(c.step)) + unitOf(c);
      } else if (c.type === 'switch') $('button', el).setAttribute('aria-checked', v ? 'true' : 'false');
      else if (c.type === 'button') $('button', el).classList.toggle('on', !!v);
      else if (c.type === 'select') {
        const o = c.options || [], i = o.findIndex(q => q.value === v || String(q.value) === String(v));
        $$('.seg button', el).forEach((b, j) => b.classList.toggle('on', j === i));
        const sel = $('select', el); if (sel && i >= 0) sel.value = String(i);
      }
    });
  }
  (function () {
    const H = $('#ctlHost'); let hold = null;
    H.addEventListener('input', e => {
      const inp = e.target.closest('input[type=range]'); if (!inp) return; const el = inp.closest('.ct'); setCtl(el.dataset.k, +inp.value);
    });
    H.addEventListener('change', e => {
      const sel = e.target.closest('select'); if (!sel) return; const el = sel.closest('.ct'), c = ctlDef(el.dataset.k); if (c) setCtl(c.key, (c.options || [])[+sel.value].value);
    });
    H.addEventListener('click', e => {
      const sw = e.target.closest('.sw'), sg = e.target.closest('.seg button');
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
  })();

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
  function drawGauge(x, val) {
    const cvs = x.cv, m = x.m, w = cvs.clientWidth, h = cvs.clientHeight; if (!w || !h) return;
    const dpr = Math.min(2, root.devicePixelRatio || 1), W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; }
    const g = cvs.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.42, r = Math.min(w / 2 - 12, h * 0.36), a0 = Math.PI * 0.75, sw = Math.PI * 1.5, mn = +m.min, mx = +m.max;
    const ang = v => a0 + sw * Math.max(0, Math.min(1, (v - mn) / (mx - mn)));
    const warnV = fin(+m.warnAbove) ? +m.warnAbove : null, isWarn = warnV != null && val > warnV;
    g.lineCap = 'butt'; g.lineWidth = 7; g.strokeStyle = '#2c343e'; g.beginPath(); g.arc(cx, cy, r, a0, a0 + sw); g.stroke();
    if (warnV != null && warnV < mx) { g.strokeStyle = '#ff5c5c'; g.beginPath(); g.arc(cx, cy, r, ang(warnV), a0 + sw); g.stroke(); }
    g.strokeStyle = warnV != null && warnV < mx ? '#3b9eff' : '#3b9eff'; if (val > mn) { g.beginPath(); g.arc(cx, cy, r - 0.5, a0, ang(warnV != null ? Math.min(val, warnV) : val)); g.globalAlpha = 0.9; g.stroke(); g.globalAlpha = 1; }
    for (let i = 0; i <= 10; i++) {
      const a = a0 + sw * i / 10, len = i % 5 === 0 ? 9 : 5; g.strokeStyle = '#8d99a6'; g.lineWidth = i % 5 === 0 ? 1.6 : 1;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6)); g.lineTo(cx + Math.cos(a) * (r - 6 - len), cy + Math.sin(a) * (r - 6 - len)); g.stroke();
    }
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
    const k = Math.min(1, dt / 90);
    mEls.forEach(x => {
      const t = vals[x.m.key]; if (!fin(t)) return;
      if (x.cv) {
        if (x.disp == null || force) x.disp = t; else x.disp += (t - x.disp) * k;
        const rng = (x.m.max - x.m.min) || 1;
        if (force || x.drawn == null || Math.abs(x.disp - x.drawn) > rng * 0.0015 || Math.abs(t - x.disp) > rng * 0.0015) { x.drawn = x.disp; drawGauge(x, x.disp); }
        const wn = fin(+x.m.warnAbove) && t > +x.m.warnAbove; if (wn !== x.warn) { x.warn = wn; x.el.classList.toggle('warn', wn); }
      } else {
        const txt = fnum(t, x.m.digits == null ? 1 : x.m.digits); if (txt !== x.txt) { x.txt = txt; x.v.textContent = txt; }
        const wn = fin(+x.m.warnAbove) && t > +x.m.warnAbove; if (wn !== x.warn) { x.warn = wn; x.el.classList.toggle('warn', wn); }
      }
    });
  }

  /* ============================================================ Zeichenfläche und Effekte */
  const cvs = $('#cv'), g2 = cvs.getContext('2d'), cvw = $('#cvw');
  let cw = 0, ch = 0, dpr = 1;
  const cvfx = document.createElement('canvas'); cvfx.id = 'cvfx'; cvfx.setAttribute('aria-hidden', 'true'); cvfx.style.pointerEvents = 'none'; cvw.appendChild(cvfx);
  const fxg = cvfx.getContext('2d'); let fxDrew = false;
  function worldSz() { try { const w = S.rig && S.rig.worldSize && S.rig.worldSize(); if (w && w.w > 0 && w.h > 0) return w; } catch (e) {} return { w: 1000, h: 560 }; }
  function fitCanvas() {
    const ws = worldSz(), ar = ws.w + '/' + ws.h; if (cvw.style.aspectRatio !== ar) cvw.style.aspectRatio = ar;
    const w = cvw.clientWidth, h = cvw.clientHeight; if (!w || !h) return;
    dpr = Math.min(2, root.devicePixelRatio || 1); const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; }
    if (cvfx.width !== W || cvfx.height !== H) { cvfx.width = W; cvfx.height = H; }
    cw = w; ch = h;
  }
  if (root.ResizeObserver) new ResizeObserver(() => fitCanvas()).observe(cvw);
  root.addEventListener('resize', () => { fitCanvas(); if (S.tab === 'curves') drawCharts(true); if (S.tab === 'seq') drawSeqChart(); updateMeters(0, true); });
  function drawRig(ts) {
    if (!cw || cvw.offsetParent === null) return;
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.fillStyle = '#14181c'; g2.fillRect(0, 0, cw, ch);
    if (!S.rig) { g2.fillStyle = '#8d99a6'; g2.font = '600 16px system-ui'; g2.textAlign = 'center'; g2.fillText('Prüfstand noch nicht geladen', cw / 2, ch / 2); return; }
    try { S.rig.draw(g2, cw, ch, ts); } catch (e) { if (!drawErr) { drawErr = true; console.error('Zeichnung des Prüfstands:', e); } }
  }
  const cvPos = e => { const r = cvs.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const holdsC = new Map();
  cvs.addEventListener('pointerdown', e => {
    e.preventDefault(); const r = S.rig; if (!r || !r.hitTest) return; try { cvs.setPointerCapture(e.pointerId); } catch (x) {}
    const [x, y] = cvPos(e); let h = null; try { h = r.hitTest(x, y, cw, ch); } catch (er) {} if (!h || !h.key) return;
    if (h.kind === 'switch') { setCtl(h.key, !r.getControl(h.key)); clickSnd('click'); } else if (h.kind === 'button') { holdsC.set(e.pointerId, h.key); setCtl(h.key, true); clickSnd('tick'); }
  });
  const cvUp = e => { const k = holdsC.get(e.pointerId); if (k == null) return; holdsC.delete(e.pointerId); setCtl(k, false, true); };
  cvs.addEventListener('pointerup', cvUp); cvs.addEventListener('pointercancel', cvUp);
  cvs.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || !S.rig || !S.rig.hitTest) return; const [x, y] = cvPos(e); let h = null; try { h = S.rig.hitTest(x, y, cw, ch); } catch (er) {} cvs.style.cursor = h ? 'pointer' : 'default'; });
  cvs.addEventListener('contextmenu', e => e.preventDefault());

  /* ---- Effekte (alles über LochFX, geschützt) ---- */
  const FXTEXT = { stall: 'Der Motor steht und brummt.', tip: 'Kippmoment überschritten!', stepslip: 'Schritt verloren!', overheat: 'Zu heiß! Last wegnehmen und abkühlen lassen.', shoot: 'Brückenkurzschluss! Funken!', crash: 'Zahnbruch! Zu viel Moment.' };
  const FXKINDS = { shoot: 1, overheat: 1, crash: 1, stall: 1, stepslip: 1, tip: 1 };
  let fxCool = {}, fxBudgetT = 0;
  function fxReset() { fxCool = {}; fxDrew = false; if (root.LochFX && root.LochFX.clear) try { root.LochFX.clear(); } catch (e) {} }
  const fxOn = () => !!(root.LochFX && !root.LochFX.isMuted());
  function worldToPx(x, y) {
    const ws = worldSz(), s = Math.min(cw / ws.w, ch / ws.h);
    if (!fin(x) || !fin(y)) return [cw / 2, ch / 2];
    return [(cw - ws.w * s) / 2 + x * s, (ch - ws.h * s) / 2 + y * s];
  }
  function fxEvent(e, ts) {
    const F = root.LochFX; if (!F || !FXKINDS[e.fx]) return;
    const fast = S.speed > 1, cd = (e.fx === 'stepslip' ? 900 : 1500) * (fast ? S.speed : 1);
    if (ts - (fxCool[e.fx] || -1e9) < cd) return; fxCool[e.fx] = ts;
    const [x, y] = worldToPx(e.x, e.y), sc = Math.max(14, Math.min(34, cw / 28));
    try {
      if (e.fx === 'shoot') { F.trip(x, y, 'ZAP!', sc, { kind: 'shock' }); setTimeout(() => { try { F.sound('crash', 0.5); } catch (er) {} }, 140); }
      else if (e.fx === 'overheat') { F.explode(x, y, { part: 'MOTOR', why: 'Motor', kind: 'res', color: '255,120,40', scale: sc * 0.8, at: () => [x, y] }); F.sound('alarm'); const v = F.variant('burn-motor', { silent: true }); F.say(v && v.text ? v.text : FXTEXT.overheat); }
      else if (e.fx === 'crash') { F.explode(x, y, { part: 'IC', kind: 'big', color: '255,190,70', scale: sc, at: () => [x, y] }); F.sound('crash'); F.say(FXTEXT.crash); }
      else if (e.fx === 'stall') { F.sound('buzz'); F.say(FXTEXT.stall); }
      else if (e.fx === 'tip') { F.sound('buzz'); F.say(FXTEXT.tip); }
      else if (e.fx === 'stepslip') { F.sound('squeak'); F.say(FXTEXT.stepslip); }
    } catch (er) {}
  }
  function noteFault(e) {
    const key = S.rigId + ':' + (e.fx || String(e.text || '').slice(0, 28));
    const a = lsGet('ant.faults', []), s = new Set(Array.isArray(a) ? a : []); if (s.has(key)) return;
    s.add(key); lsSet('ant.faults', [...s]); stat('antfault', s.size, 'max');
  }
  /* neue Meldungen beobachten: Liste, Abzeichenstatistik, Effekte */
  function watchEvents(ts) {
    const r = S.rig; if (!r) return; const ev = r.events || [];
    let changed = false;
    for (let i = Math.max(0, ev.length - 30); i < ev.length; i++) {
      const e = ev[i]; if (!e || S.evSeen.has(e)) continue; S.evSeen.add(e); changed = true;
      if (e.kind === 'error' || FXKINDS[e.fx]) noteFault(e);
      if (e.kind === 'error') { S.faultUntil = performance.now() + 9000; S.faultText = e.text; if (S.tab !== 'rig' && S.running) toast('⚠ ' + e.text); }
      if (e.fx && (!fast() || ts - fxBudgetT > 700)) { fxBudgetT = ts; fxEvent(e, ts); }
    }
    if (changed || ev.length !== S.evLen) { S.evLen = ev.length; updateEvents(); }
  }
  const fast = () => S.speed > 2;
  function fxFrame(ts, dt) {
    const F = root.LochFX; if (!F || !F.draw || !cw) return;
    try {
      const act = F.active ? F.active() : true;
      if (act) { fxg.setTransform(dpr, 0, 0, dpr, 0, 0); fxg.clearRect(0, 0, cw, ch); F.draw(fxg); fxDrew = true; }
      else if (fxDrew) { fxg.setTransform(1, 0, 0, 1, 0, 0); fxg.clearRect(0, 0, cvfx.width, cvfx.height); fxDrew = false; }
    } catch (e) { if (!fxFrame.err) { fxFrame.err = 1; console.error('Effekte:', e); } }
  }
  if (root.LochFX && root.LochFX.setShakeEl) try { root.LochFX.setShakeEl(cvw); } catch (e) {}
  function toggleFx() {
    const F = root.LochFX; if (!F) return; F.setMuted(fxOn()); updateChrome(); toast(fxOn() ? 'Effekte und Ton an' : 'Ton aus');
    if (fxOn()) F.sound('ding', 0.6);
  }

  /* ---- Meldungsliste ---- */
  function updateEvents(force) {
    const l = $('#evList'); if (!l) return; const ev = (S.rig && S.rig.events) || [];
    const sig = ev.length + '|' + (ev.length ? (ev[ev.length - 1].text || '') + (ev[ev.length - 1].t || '') : '');
    if (!force && sig === S.evSig) return; S.evSig = sig;
    l.innerHTML = ev.length ? ev.slice(-40).reverse().map(x => `<li class="${esc(x.kind || 'info')}"><time>${mmss(x.t || 0)}</time><span>${esc(x.text)}</span></li>`).join('') : '<li class="empty">Keine Meldungen. Meldet der Prüfstand etwas (zum Beispiel einen Fehler), steht es hier.</li>';
  }
  $('#evClr').onclick = () => { if (S.rig && S.rig.events) { S.rig.events.length = 0; S.evSig = ''; updateEvents(true); } };

  /* ============================================================ Simulation */
  function setRun(on, auto) {
    if (on && !S.rig) { toast('Der Prüfstand ist noch nicht geladen.'); return; }
    S.running = !!on; updateChrome();
    if (on) { stat('antrun', 1, 'max'); usedRig(); if (auto && !lsRaw('ant.autohint', '')) { lsPut('ant.autohint', '1'); toast('Der Prüfstand läuft jetzt. Mit ⏸ unten hältst du ihn an.'); } }
  }
  function resetRig(quiet) {
    if (!S.rig) return;
    try { S.rig.reset(); } catch (e) { console.error(e); }
    S.running = false; S.simT = 0; rec = []; recAcc = 0; S.live = null; S.ctl = {}; S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; S.curveCache = null; fxReset();
    syncCtl(true); updateMeters(0, true); updateEvents(true); updateChrome(); renderSeqLive(); if (!quiet) toast('Prüfstand zurückgesetzt');
  }
  function setSpeed(v) { S.speed = v; lsPut('ant.speed', String(v)); updateChrome(); }
  function recordSample() {
    let st = null, mt = null; try { st = S.rig.state(); mt = S.rig.readMeters(); } catch (e) { return; }
    const v = sigVals(st, mt); rec.push([S.simT, v.rpm, v.current, v.torque, v.temp]);
    if (rec.length > 12000) rec.splice(0, rec.length - 12000);
  }
  /* geplanten Ablauf im Prüfstand ausführen: Schritte, die fällig sind */
  function liveApply() {
    const L = S.live; if (!L) return;
    while (L.i < L.steps.length && L.steps[L.i].t <= L.t + 1e-6) { const st = L.steps[L.i++]; Object.keys(st.set).forEach(k => setCtl(k, st.set[k], true)); }
  }
  function simAdvance(dtMs) {
    const r = S.rig; let left = dtMs;
    while (left > 1e-4) {
      const c = Math.min(10, left);
      if (S.live) liveApply();
      r.step(c); S.simT += c; left -= c; recAcc += c;
      if (S.live) { S.live.t += c; if (S.live.t >= S.live.end) { seqLiveDone(); } }
      if (recAcc >= 50) { recAcc -= 50; recordSample(); }
    }
  }
  function updateStat() {
    const sEl = $('#stat'); if (!sEl) return;
    const html = S.running ? `<b class="run" style="color:var(--ok)">LÄUFT</b> ${num1(S.simT / 1000)} s` : `<b>PAUSE</b> ${num1(S.simT / 1000)} s`;
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
  /* o: { series:[{name,color,pts,dash}], xMin,xMax,yMin,yMax (sonst automatisch), xLabel,yLabel, yHide, marker:{x,y}, cursorX, vlines:[x], zeroLine } */
  function drawChart(cv, o) {
    const c = prepCv(cv); if (!c) return; const { g, w, h } = c;
    const L = o.yHide ? 14 : 54, R = 14, T = 14, B = 40, pw = w - L - R, ph = h - T - B; if (pw < 20 || ph < 20) return;
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    (o.series || []).forEach(s => (s.pts || []).forEach(p => { if (fin(p[0]) && fin(p[1])) { xmin = Math.min(xmin, p[0]); xmax = Math.max(xmax, p[0]); ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); } }));
    if (o.marker && fin(o.marker.x) && fin(o.marker.y)) { xmin = Math.min(xmin, o.marker.x); xmax = Math.max(xmax, o.marker.x); ymin = Math.min(ymin, o.marker.y); ymax = Math.max(ymax, o.marker.y); }
    if (fin(o.xMin)) xmin = o.xMin; if (fin(o.xMax)) xmax = o.xMax; if (fin(o.yMin)) ymin = o.yMin; if (fin(o.yMax)) ymax = o.yMax;
    if (!fin(xmin) || !fin(ymin)) { g.fillStyle = '#8d99a6'; g.font = '14px system-ui'; g.textAlign = 'center'; g.fillText('Noch keine Daten', w / 2, h / 2); return; }
    if (!(xmax > xmin)) xmax = xmin + 1; if (!(ymax > ymin)) { ymax = ymin + 1; }
    if (!fin(o.yMin) && ymin > 0 && ymin < (ymax - ymin) * 0.6) ymin = 0;
    if (!fin(o.yMax)) ymax += (ymax - ymin) * 0.06;
    const tx = ticksOf(xmin, xmax, Math.max(3, Math.floor(pw / 80))), ty = ticksOf(ymin, ymax, Math.max(3, Math.floor(ph / 45)));
    const X = v => L + pw * (v - xmin) / (xmax - xmin), Y = v => T + ph * (1 - (v - ymin) / (ymax - ymin));
    g.font = '11px system-ui'; g.lineWidth = 1;
    g.strokeStyle = '#26303a'; g.fillStyle = '#8d99a6'; g.textAlign = 'center';
    tx.t.forEach(v => { const x = Math.round(X(v)) + 0.5; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); g.fillText(tickFmt(v, tx.s), x, T + ph + 14); });
    g.textAlign = 'right';
    if (o.yHide) { for (let i = 0; i <= 4; i++) { const y = Math.round(T + ph * i / 4) + 0.5; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); } }
    else ty.t.forEach(v => { const y = Math.round(Y(v)) + 0.5; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.fillText(tickFmt(v, ty.s), L - 6, y + 4); });
    if (o.zeroLine && ymin < 0 && ymax > 0) { g.strokeStyle = '#4a5663'; const y = Math.round(Y(0)) + 0.5; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); }
    g.strokeStyle = '#4a5663'; g.strokeRect(L + 0.5, T + 0.5, pw, ph);
    g.fillStyle = '#8d99a6'; g.font = '12px system-ui'; g.textAlign = 'center'; g.fillText(o.xLabel || '', L + pw / 2, h - 6);
    if (o.yLabel && !o.yHide) { g.save(); g.translate(12, T + ph / 2); g.rotate(-Math.PI / 2); g.fillText(o.yLabel, 0, 0); g.restore(); }
    g.save(); g.beginPath(); g.rect(L, T, pw, ph); g.clip();
    (o.vlines || []).forEach(v => { const x = Math.round(X(v)) + 0.5; g.strokeStyle = 'rgba(255,179,64,.45)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); g.setLineDash([]); });
    (o.series || []).forEach((s, i) => {
      const pts = (s.pts || []).filter(p => fin(p[0]) && fin(p[1])); if (!pts.length) return;
      g.strokeStyle = s.color || PAL[i % PAL.length]; g.lineWidth = s.width || 2.2; g.lineJoin = 'round'; if (s.dash) g.setLineDash(s.dash);
      g.beginPath(); pts.forEach((p, j) => { const x = X(p[0]), y = Y(p[1]); if (j) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); g.setLineDash([]);
    });
    g.restore();
    if (fin(o.cursorX) && o.cursorX >= xmin && o.cursorX <= xmax) { const x = Math.round(X(o.cursorX)) + 0.5; g.strokeStyle = '#e8ecf0'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); }
    if (o.marker && fin(o.marker.x) && fin(o.marker.y)) {
      const mx = X(o.marker.x), my = Y(o.marker.y); g.strokeStyle = 'rgba(232,236,240,.45)'; g.setLineDash([4, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(mx, T + ph); g.lineTo(mx, my); g.lineTo(L, my); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#ff5c5c'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, 6, 0, 7); g.fill(); g.stroke();
    }
    cv._ch = { L, T, pw, ph, xmin, xmax, ymin, ymax };
  }
  const cvX = (cv, e) => { const r = cv.getBoundingClientRect(), ch2 = cv._ch; if (!ch2 || !r.width) return null; const px = (e.clientX - r.left) / r.width * cv.clientWidth; const f = (px - ch2.L) / ch2.pw; return f < 0 || f > 1 ? null : ch2.xmin + f * (ch2.xmax - ch2.xmin); };

  /* y-Werte auf 0..1 normieren (jedes Signal mit eigenem Maßstab), liefert { pts, lo, hi } */
  function normSeries(pts, fromMin) {
    let lo = fromMin ? Infinity : 0, hi = fromMin ? -Infinity : 0; pts.forEach(p => { if (fin(p[1])) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); } });
    if (fromMin) { if (!fin(lo)) { lo = 0; hi = 1; } hi = Math.max(hi, lo + 10); }
    if (hi - lo < 1e-9) hi = lo + 1; return { lo, hi, pts: pts.map(p => [p[0], fin(p[1]) ? (p[1] - lo) / (hi - lo) : null]) };
  }

  /* ============================================================ Tab Kennlinien */
  let curveSel = null, crvCur = null, recCur = null, lastCrv = 0, crvDirty = true;
  function renderCurves() {
    const V = $('#curveView');
    if (!S.rig) { V.innerHTML = '<div class="card pl">' + placeholderHtml() + '</div>'; return; }
    V.innerHTML = `<div class="card pl"><h4>Kennlinie von „${esc(rigName(S.rigId))}“</h4><div class="rbar" id="crvSel"></div><div class="chartbox"><canvas id="crvCv"></canvas></div><div class="legend" id="crvLeg"></div><div class="readout" id="crvRead"></div>
      <p class="hint2" style="margin:4px 0 0">Die Kurven werden aus dem Modell berechnet. Der rote Punkt ist dein aktueller Betriebspunkt, er wandert mit, wenn du am Prüfstand etwas änderst. Tippe oder fahre über die Kurve, um Werte abzulesen.</p></div>
      <div class="card pl"><h4>Zeitschreiber (letzte 20 s)</h4><div class="legend" id="recSig"></div><div class="chartbox t"><canvas id="recCv"></canvas></div><div class="readout" id="recRead"></div>
      <div class="btns"><button class="btn" id="recCsv">⬇ Aufzeichnung als CSV</button><button class="btn" id="recClr">Aufzeichnung löschen</button></div>
      <p class="hint2" style="margin:4px 0 0">Jedes Signal hat seinen eigenen Maßstab (0 bis zum Höchstwert im Fenster), damit alle gut sichtbar sind. Der Zeitschreiber läuft nur, solange der Prüfstand läuft. Mit dem Finger oder der Maus liest du genaue Werte ab.</p></div>`;
    crvDirty = true; S.curveCache = null; drawCharts(true);
    const first = S.curveCache && S.curveCache.length; if (first) stat('antcurve', 1, 'max');
  }
  function curveList() {
    const now = performance.now();
    if (S.curveCache && now - lastCrv < 220) return S.curveCache;
    lastCrv = now; let a = null; try { a = S.rig && S.rig.curves ? S.rig.curves() : null; } catch (e) { if (!curveList.err) { curveList.err = 1; console.error('Kennlinien:', e); } }
    S.curveCache = Array.isArray(a) ? a : []; return S.curveCache;
  }
  function drawCharts(force) {
    if (!S.rig || S.tab !== 'curves') return;
    const cs = curveList(), sel = $('#crvSel'); if (!sel) return;
    if (!cs.some(c => c.id === curveSel)) curveSel = cs.length ? cs[0].id : null;
    const sig = cs.map(c => c.id + c.title).join('|') + curveSel;
    if (sig !== sel.dataset.sig) {
      sel.dataset.sig = sig; sel.innerHTML = cs.length ? cs.map(c => `<button class="chip s${c.id === curveSel ? ' on' : ''}" data-cid="${esc(c.id)}">${esc(c.title)}</button>`).join('') : '<span class="hint2">Dieser Prüfstand liefert noch keine Kennlinien.</span>';
    }
    const cur = cs.find(c => c.id === curveSel), cv = $('#crvCv'), leg = $('#crvLeg'), rd = $('#crvRead');
    if (cur && cv) {
      const ser = (cur.series || []).map((s, i) => ({ name: s.name, color: PAL[i % PAL.length], pts: s.points || [] }));
      const xu = cur.xUnit ? ' in ' + cur.xUnit : '', yu = cur.yUnit ? ' in ' + cur.yUnit : '';
      drawChart(cv, { series: ser, xLabel: (cur.xLabel || '') + xu, yLabel: (cur.yLabel || '') + yu, marker: cur.marker, cursorX: crvCur, yMin: undefined });
      const lh = ser.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('') + (cur.marker ? '<span><i style="background:#ff5c5c;height:10px;width:10px;border-radius:50%"></i>Betriebspunkt</span>' : '');
      if (leg.dataset.h !== lh) { leg.dataset.h = lh; leg.innerHTML = lh; }
      let txt = '';
      if (cur.marker && fin(cur.marker.x)) txt = 'Betriebspunkt: ' + esc(cur.xLabel || 'x') + ' = <b>' + fnum(cur.marker.x, 2) + ' ' + esc(cur.xUnit || '') + '</b>, ' + esc(cur.yLabel || 'y') + ' = <b>' + fnum(cur.marker.y, 2) + ' ' + esc(cur.yUnit || '') + '</b>';
      if (crvCur != null && ser[0]) {
        const parts = ser.map(s => { const y = interp(s.pts, crvCur); return fin(y) ? esc(s.name) + ' = <b>' + fnum(y, 2) + ' ' + esc(cur.yUnit || '') + '</b>' : ''; }).filter(Boolean);
        txt = esc(cur.xLabel || 'x') + ' = <b>' + fnum(crvCur, 2) + ' ' + esc(cur.xUnit || '') + '</b>: ' + parts.join(', ') + (txt ? '<br><span style="color:var(--mute)">' + txt + '</span>' : '');
      }
      if (rd.dataset.h !== txt) { rd.dataset.h = txt; rd.innerHTML = txt; }
    } else if (cv) drawChart(cv, { series: [] });
    drawRecorder();
  }
  function interp(pts, x) {
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (x >= a[0] && x <= b[0] && b[0] > a[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
    return null;
  }
  function drawRecorder() {
    const cv = $('#recCv'); if (!cv) return;
    const tNow = rec.length ? rec[rec.length - 1][0] / 1000 : 0, t0 = Math.max(0, tNow - 20), xMin = tNow > 20 ? tNow - 20 : 0, xMax = tNow > 20 ? tNow : 20;
    const win = rec.filter(r => r[0] / 1000 >= t0 - 0.05), ser = [], lg = [];
    SIGS.forEach((s, idx) => {
      const col = idx + 1, has = win.some(r => r[col] != null); if (!has) return;
      const pts = win.map(r => [r[0] / 1000, r[col]]), n = normSeries(pts, s.k === 'temp'), last = [...win].reverse().find(r => r[col] != null);
      lg.push({ s, hi: n.hi, lo: n.lo, v: last ? last[col] : null });
      if (S.sigOn[s.k]) ser.push({ name: s.n, color: s.c, pts: n.pts });
    });
    drawChart(cv, { series: ser, xMin, xMax, yMin: 0, yMax: 1.05, yHide: true, xLabel: 'Zeit in s', cursorX: recCur });
    const sg = $('#recSig'), h = lg.length ? lg.map(x => `<button class="sig${S.sigOn[x.s.k] ? '' : ' off'}" data-sig="${x.s.k}"><i style="background:${x.s.c}"></i>${x.s.n} ${fnum(x.v, Math.abs(x.v) >= 100 ? 0 : 1)} ${x.s.u}<small style="color:var(--mute)"> (${x.lo !== 0 ? fnum(x.lo, 0) + ' bis ' : 'bis '}${fnum(x.hi, Math.abs(x.hi) >= 100 ? 0 : 1)})</small></button>`).join('') : '<span class="hint2">Noch keine Aufzeichnung: starte den Prüfstand (▶ unten).</span>';
    if (sg && sg.dataset.h !== h) { sg.dataset.h = h; sg.innerHTML = h; }
    const rd = $('#recRead'); if (rd) {
      let txt = '';
      if (recCur != null && win.length) {
        let best = win[0]; win.forEach(r => { if (Math.abs(r[0] / 1000 - recCur) < Math.abs(best[0] / 1000 - recCur)) best = r; });
        txt = 't = <b>' + fnum(best[0] / 1000, 2) + ' s</b>: ' + SIGS.map((s, i) => best[i + 1] != null ? s.n + ' <b>' + fnum(best[i + 1], Math.abs(best[i + 1]) >= 100 ? 0 : 2) + ' ' + s.u + '</b>' : '').filter(Boolean).join(' · ');
      }
      if (rd.dataset.h !== txt) { rd.dataset.h = txt; rd.innerHTML = txt; }
    }
  }
  (function () {
    const V = $('#curveView');
    V.addEventListener('click', e => {
      const c = e.target.closest('[data-cid]'), sg = e.target.closest('[data-sig]');
      if (c) { curveSel = c.dataset.cid; $('#crvSel').dataset.sig = ''; crvCur = null; drawCharts(true); }
      else if (sg) { S.sigOn[sg.dataset.sig] = !S.sigOn[sg.dataset.sig]; $('#recSig').dataset.h = ''; drawRecorder(); }
      else if (e.target.closest('#recCsv')) exportCsv();
      else if (e.target.closest('#recClr')) { rec = []; recAcc = 0; drawRecorder(); toast('Aufzeichnung gelöscht'); }
    });
    const mv = (id, set) => {
      V.addEventListener('pointermove', e => { if (e.target.id !== id) return; set(cvX(e.target, e)); drawCharts(); });
      V.addEventListener('pointerdown', e => { if (e.target.id !== id) return; try { e.target.setPointerCapture(e.pointerId); } catch (x) {} set(cvX(e.target, e)); drawCharts(); });
      V.addEventListener('pointerleave', e => { if (e.target.id === id && e.pointerType === 'mouse') { set(null); drawCharts(); } }, true);
    };
    mv('crvCv', x => { crvCur = x; }); mv('recCv', x => { recCur = x; });
  })();
  function exportCsv() {
    if (!rec.length) { toast('Noch nichts aufgezeichnet. Starte den Prüfstand.'); return; }
    const head = ['Zeit [s]'].concat(SIGS.map(s => s.n + ' [' + s.u + ']')).join(';');
    const rows = rec.map(r => [fnum(r[0] / 1000, 3)].concat(SIGS.map((s, i) => (r[i + 1] == null ? '' : fnum(r[i + 1], 4)))).join(';'));
    const blob = new Blob(['﻿' + head + '\r\n' + rows.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    if (root.LabExport) root.LabExport.saveBlob(blob, root.LabExport.fname('csv'));
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'antrieb-aufzeichnung.csv'; document.body.appendChild(a); a.click(); a.remove(); }
    toast('CSV mit ' + rec.length + ' Messpunkten gespeichert');
  }

  /* ============================================================ Ablaufprogramm */
  let seqIdx = -1, seqSig = null, lastSeqUI = 0;
  const seqDur = () => { const d = S.seqDur && S.seqDur[S.rigId]; if (fin(d) && d > 0) return d; const rs = curRows(); return Math.max(10, rs.reduce((m, r) => Math.max(m, +r.t || 0), 0) + 3); };
  function newRow() {
    const rs = curRows(), c = ctlsOf()[0]; if (!c) return null;
    const t = rs.length ? Math.round(((+rs[rs.length - 1].t || 0) + 1) * 10) / 10 : 0;
    return { t, key: c.key, value: defVal(c) };
  }
  const defVal = c => (c.type === 'switch' || c.type === 'button' ? !!c.value : c.type === 'select' ? ((c.value !== undefined ? c.value : (c.options && c.options[0] ? c.options[0].value : ''))) : (c.value != null ? c.value : c.min));
  function valueEd(r, i) {
    const c = ctlDef(r.key); if (!c) return '<span class="hint2">Steuerwert unbekannt</span>';
    if (c.type === 'slider') return `<span style="display:flex;align-items:center;gap:5px"><input class="vIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${fnum(r.value, decs(c.step))}" aria-label="Wert"><small style="color:var(--mute);white-space:nowrap">${esc(c.unit || '')}</small></span>`;
    if (c.type === 'switch') return `<select class="vSel" data-i="${i}" aria-label="Wert"><option value="1"${r.value ? ' selected' : ''}>EIN</option><option value="0"${r.value ? '' : ' selected'}>AUS</option></select>`;
    if (c.type === 'button') return `<select class="vSel" data-i="${i}" aria-label="Wert"><option value="1"${r.value ? ' selected' : ''}>gedrückt</option><option value="0"${r.value ? '' : ' selected'}>losgelassen</option></select>`;
    const o = c.options || [], cur = o.findIndex(x => x.value === r.value || String(x.value) === String(r.value));
    return `<select class="vSel" data-i="${i}" aria-label="Wert">${o.map((x, j) => `<option value="${j}"${j === cur ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`;
  }
  function rowHtml(r, i, n) {
    const keys = ctlsOf();
    return `<div class="sqr" data-i="${i}"><span class="n">${i + 1}</span><label class="tb"><input class="tIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${fnum(r.t, 1)}" aria-label="Zeit in Sekunden"> <small>s</small></label>
      <select class="kSel" data-i="${i}" aria-label="Steuerwert">${keys.map(c => `<option value="${esc(c.key)}"${c.key === r.key ? ' selected' : ''}>${esc(c.label)}${c.unit ? ' (' + esc(c.unit) + ')' : ''}</option>`).join('')}</select>
      <span class="vb">${valueEd(r, i)}</span><span class="ac"><button class="ib2" data-a="up" data-i="${i}" aria-label="Nach oben"${i === 0 ? ' disabled' : ''}>↑</button><button class="ib2" data-a="dn" data-i="${i}" aria-label="Nach unten"${i === n - 1 ? ' disabled' : ''}>↓</button><button class="ib2" data-a="del" data-i="${i}" aria-label="Löschen">🗑</button></span></div>`;
  }
  function tlHtml() {
    const end = seqDur(), st = seqSteps(curRows()); let h = '<div id="tl">';
    st.forEach(s => { const p = Math.min(100, s.t / 1000 / end * 100); h += `<i class="tk" style="left:${p.toFixed(2)}%"></i>`; });
    for (let k = 0; k <= 4; k++) h += `<span class="sc" style="left:${k * 25}%;${k === 4 ? 'transform:translateX(-100%)' : ''}">${fnum(end * k / 4, 1)} s</span>`;
    return h + '<b class="hd" id="tlHd" style="left:0%"></b></div>';
  }
  function renderSeq() {
    const V = $('#seqView');
    if (!S.rig) { V.innerHTML = '<div class="card pl">' + placeholderHtml() + '</div>'; return; }
    const rs = curRows();
    V.innerHTML = `<div class="card pl"><h4>Ablaufprogramm für ${rigIcon(S.rigId)} ${esc(rigName(S.rigId))}</h4>
      <p class="hint2" style="margin:0 0 8px">Jede Zeile heißt: <b>nach … Sekunden</b> wird ein Steuerwert auf einen neuen Wert gesetzt. So baust du zum Beispiel einen Stern-Dreieck-Anlauf, eine Drehzahlrampe oder eine Richtungsumkehr, ohne selbst zu drücken.</p>
      <div class="mgr"><button class="chip s on" data-q="add">➕ Zeile</button><button class="chip s" data-q="ex">📖 Beispiel-Ablauf</button><button class="chip s danger" data-q="clr"${rs.length ? '' : ' disabled'}>🗑 Leeren</button></div>
      <div id="sqRows">${rs.length ? rs.map((r, i) => rowHtml(r, i, rs.length)).join('') : '<p class="hint2" style="padding:8px 4px">Noch keine Zeilen. Tippe auf „Zeile“ oder lade ein Beispiel.</p>'}</div>
      <div class="frm" style="margin-top:10px"><label class="f"><span>Dauer des Ablaufs (s)</span><input id="sqDur" inputmode="decimal" autocomplete="off" value="${fnum(seqDur(), 1)}"></label></div>
      <div id="tlHost">${tlHtml()}</div><div class="readout" id="sqLiveRead"></div>
      <div class="btns"><button class="btn pri" data-q="bg"${rs.length ? '' : ' disabled'}>▶ Berechnen (Diagramm)</button><button class="btn" data-q="live"${rs.length ? '' : ' disabled'}>▶ Live im Prüfstand</button><button class="btn danger" data-q="stop">■ Stopp</button></div></div>
      <div id="sqRes"></div>`;
    renderSeqRes(); renderSeqLive();
  }
  function seqSteps(rows) {
    const m = new Map();
    rows.forEach(r => { const t = Math.round(Math.max(0, +r.t || 0) * 1000); if (!ctlDef(r.key)) return; if (!m.has(t)) m.set(t, {}); m.get(t)[r.key] = r.value; });
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, set]) => ({ t, set }));
  }
  /* Ablaufprogramm im Hintergrund: ANT_CORE.runSeq, sonst eigener gleichwertiger Läufer */
  function runSeqLocal(factory, steps, end) {
    const r = factory(), samples = []; let i = 0;
    for (let t = 0; t <= end; t += 5) {
      while (i < steps.length && steps[i].t <= t) { const s = steps[i++]; Object.keys(s.set).forEach(k => { try { r.setControl(k, s.set[k]); } catch (e) {} }); }
      if (t % 50 === 0) samples.push({ t, meters: r.readMeters(), state: r.state() });
      r.step(5);
    }
    const fin2 = r.state();
    return { samples, final: fin2, events: (r.events || []).slice(), faults: (fin2 && fin2.faults) || [] };
  }
  function seqRunBg() {
    if (!S.rig) return; const steps = seqSteps(curRows()), end = Math.round(seqDur() * 1000), id = S.rigId, d = defOf(id);
    if (!steps.length) { toast('Das Ablaufprogramm ist leer.'); return; }
    const factory = () => d.create({ seed: 1 });
    const done = res => {
      if (!res || !Array.isArray(res.samples) || !res.samples.length) { try { res = runSeqLocal(factory, steps, end); } catch (e) { console.error(e); toast('Der Ablauf konnte nicht berechnet werden.'); return; } }
      S.seqRes = { samples: res.samples, final: res.final, events: res.events || [], faults: res.faults || [], end, rigId: id, meters: metersOf(), steps }; seqIdx = res.samples.length - 1; seqSig = null;
      stat('antseq', 1, 'max'); if (res.faults && res.faults.length) { /* Fehler im Ablauf zählen für Abzeichen nicht extra */ }
      renderSeqRes(); const el = $('#sqRes'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    let res = null;
    try { if (root.ANT_CORE && typeof root.ANT_CORE.runSeq === 'function') res = root.ANT_CORE.runSeq(factory, steps, end); } catch (e) { console.warn('runSeq:', e); res = null; }
    if (res && typeof res.then === 'function') res.then(done, () => done(null)); else done(res);
  }
  function seqLive() {
    if (!S.rig) return; const steps = seqSteps(curRows());
    if (!steps.length) { toast('Das Ablaufprogramm ist leer.'); return; }
    resetRig(true); S.live = { steps, i: 0, t: 0, end: Math.round(seqDur() * 1000) }; setRun(true); renderSeqLive();
    toast('Ablauf läuft live. Im Tab „Prüfstand“ siehst du die Animation.');
  }
  function seqLiveDone() { S.live = null; stat('antseq', 1, 'max'); toast('Ablauf beendet'); renderSeqLive(); }
  function seqStop() { if (S.live) { S.live = null; S.running = false; updateChrome(); toast('Ablauf gestoppt'); renderSeqLive(); } else if (S.running) { setRun(false); } }
  function renderSeqLive() {
    if (S.tab !== 'seq') return; const hd = $('#tlHd'), rd = $('#sqLiveRead'); if (!hd) return;
    const end = seqDur() * 1000;
    if (S.live) hd.style.left = Math.min(100, S.live.t / end * 100).toFixed(2) + '%';
    else if (S.seqRes && seqIdx >= 0 && S.seqRes.samples[seqIdx]) hd.style.left = Math.min(100, S.seqRes.samples[seqIdx].t / S.seqRes.end * 100).toFixed(2) + '%';
    else hd.style.left = '0%';
    const rows = $$('.sqr'); rows.forEach(r => r.classList.remove('cur'));
    if (S.live && S.rig) {
      let vals = {}; try { vals = S.rig.readMeters(); } catch (e) {}
      const txt = 'Live: t = <b>' + fnum(S.live.t / 1000, 1) + ' s</b> von ' + fnum(end / 1000, 1) + ' s · ' + metersOf().slice(0, 4).map(m => esc(m.label) + ' <b>' + fnum(vals[m.key], m.digits == null ? 1 : m.digits) + ' ' + esc(m.unit || '') + '</b>').join(' · ');
      if (rd.dataset.h !== txt) { rd.dataset.h = txt; rd.innerHTML = txt; }
      const last = S.live.steps[Math.max(0, S.live.i - 1)]; if (last && S.live.i > 0) { const tt = last.t / 1000; rows.forEach(r => { const row = curRows()[+r.dataset.i]; if (row && Math.abs((+row.t || 0) - tt) < 0.0006) r.classList.add('cur'); }); }
    } else if (rd.dataset.h) { rd.dataset.h = ''; rd.innerHTML = ''; }
  }
  /* Ergebnis anzeigen */
  function defaultSig(ms) {
    const pref = ['rpm', 'nOut', 'angle', 'current', 'iMotor', 'iLine', 'torque', 'mOut', 'temp'], out = [];
    pref.forEach(k => { if (out.length < 3 && ms.some(m => m.key === k)) out.push(k); });
    ms.forEach(m => { if (out.length < 3 && !out.includes(m.key)) out.push(m.key); }); return out;
  }
  function renderSeqRes() {
    const el = $('#sqRes'); if (!el) return; const R = S.seqRes;
    if (!R || R.rigId !== S.rigId) { el.innerHTML = ''; return; }
    if (!seqSig) seqSig = defaultSig(R.meters);
    const faults = (R.faults || []).map(f => (typeof f === 'string' ? f : f && (f.text || f.msg || f.name)) || '').filter(Boolean);
    const evs = (R.events || []).slice(-30);
    el.innerHTML = `<div class="card pl"><h4>Ergebnis des Ablaufs</h4><div class="legend" id="sqSig">${R.meters.map((m, i) => `<button class="sig${seqSig.includes(m.key) ? '' : ' off'}" data-ms="${esc(m.key)}"><i style="background:${PAL[i % PAL.length]}"></i>${esc(m.label)}</button>`).join('')}</div>
      <div class="chartbox"><canvas id="sqCv"></canvas></div>
      <label class="f" style="margin:8px 0 0"><span>Zeitleiste: Zeitpunkt auswählen</span><input type="range" id="sqScrub" min="0" max="${R.samples.length - 1}" step="1" value="${seqIdx}"></label>
      <div class="readout" id="sqRead"></div>
      ${faults.length ? `<p style="color:var(--danger);margin:6px 0 0"><b>Fehler im Ablauf:</b> ${faults.map(esc).join('; ')}</p>` : '<p class="hint2" style="margin:6px 0 0">Keine Fehler im Ablauf.</p>'}
      ${evs.length ? `<ul class="ev" style="padding:0">${evs.map(x => `<li class="${esc(x.kind || 'info')}"><time>${mmss(x.t || 0)}</time><span>${esc(x.text)}</span></li>`).join('')}</ul>` : ''}</div>`;
    drawSeqChart();
  }
  function drawSeqChart() {
    const R = S.seqRes, cv = $('#sqCv'); if (!R || !cv || R.rigId !== S.rigId) return;
    const ser = [], sg = $('#sqSig'); const info = [];
    R.meters.forEach((m, i) => {
      const pts = R.samples.map(s => [s.t / 1000, s.meters ? s.meters[m.key] : null]), n = normSeries(pts);
      info.push({ m, n, i });
      if (seqSig.includes(m.key)) ser.push({ name: m.label, color: PAL[i % PAL.length], pts: n.pts });
    });
    const cur = R.samples[seqIdx]; const cx = cur ? cur.t / 1000 : null;
    drawChart(cv, { series: ser, xMin: 0, xMax: R.end / 1000, yMin: 0, yMax: 1.05, yHide: true, xLabel: 'Zeit in s', cursorX: cx, vlines: R.steps.map(s => s.t / 1000) });
    const rd = $('#sqRead');
    if (rd && cur) rd.innerHTML = 't = <b>' + fnum(cur.t / 1000, 2) + ' s</b>: ' + R.meters.map(m => (cur.meters && fin(cur.meters[m.key]) ? esc(m.label) + ' <b>' + fnum(cur.meters[m.key], m.digits == null ? 1 : m.digits) + ' ' + esc(m.unit || '') + '</b>' : '')).filter(Boolean).join(' · ');
    renderSeqLive();
  }
  function seqExamples() {
    const out = [], d = root.ANT_DATA && root.ANT_DATA.examples;
    if (Array.isArray(d)) d.forEach(e => { if (e.seq && e.seq.length && e.rig === S.rigId) out.push(e); });
    BUILTIN.forEach(e => { if (e.rows && e.rig === S.rigId && !out.some(o => o.name === e.name)) out.push(e); });
    return out;
  }
  (function () {
    const V = $('#seqView');
    V.addEventListener('click', async e => {
      const q = e.target.closest('[data-q]'), a = e.target.closest('[data-a]'), ms = e.target.closest('[data-ms]');
      const rs = curRows();
      if (q) {
        const k = q.dataset.q;
        if (k === 'add') { const r = newRow(); if (r) { rs.push(r); S.dirty = true; renderSeq(); saveCurSoon(); } }
        else if (k === 'clr') { if (await confirmSheet('Ablaufprogramm leeren?', 'Alle Zeilen werden gelöscht.', 'Leeren', true)) { rs.length = 0; S.seqRes = null; S.dirty = true; renderSeq(); saveCurSoon(); } }
        else if (k === 'ex') {
          const ex = seqExamples(); if (!ex.length) { toast('Für diesen Prüfstand gibt es noch keine Beispiel-Abläufe.'); return; }
          const v = await pick('Beispiel-Ablauf', ex.map((x, i) => ({ value: i, label: x.name, sub: x.desc || '' }))); if (v != null) loadExample(ex[v]);
        }
        else if (k === 'bg') seqRunBg(); else if (k === 'live') seqLive(); else if (k === 'stop') seqStop();
      } else if (a) {
        const i = +a.dataset.i;
        if (a.dataset.a === 'del') rs.splice(i, 1); else if (a.dataset.a === 'up' && i > 0) [rs[i - 1], rs[i]] = [rs[i], rs[i - 1]]; else if (a.dataset.a === 'dn' && i < rs.length - 1) [rs[i + 1], rs[i]] = [rs[i], rs[i + 1]];
        S.dirty = true; renderSeq(); saveCurSoon();
      } else if (ms) { const k = ms.dataset.ms; seqSig = seqSig.includes(k) ? seqSig.filter(x => x !== k) : seqSig.concat(k); renderSeqRes(); }
    });
    V.addEventListener('change', e => {
      const t = e.target, rs = curRows(), i = +t.dataset.i;
      if (t.id === 'sqDur') { const v = parseNum(t.value); (S.seqDur = S.seqDur || {})[S.rigId] = isFinite(v) && v > 0 ? Math.min(600, v) : null; t.value = fnum(seqDur(), 1); $('#tlHost').innerHTML = tlHtml(); S.dirty = true; return; }
      if (!rs[i]) return;
      if (t.classList.contains('tIn')) { const v = parseNum(t.value); rs[i].t = isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : rs[i].t; t.value = fnum(rs[i].t, 1); $('#tlHost').innerHTML = tlHtml(); }
      else if (t.classList.contains('kSel')) { rs[i].key = t.value; const c = ctlDef(t.value); rs[i].value = c ? defVal(c) : 0; const row = t.closest('.sqr'); $('.vb', row).innerHTML = valueEd(rs[i], i); }
      else if (t.classList.contains('vSel')) { const c = ctlDef(rs[i].key); if (c) rs[i].value = c.type === 'select' ? (c.options || [])[+t.value].value : t.value === '1'; }
      else if (t.classList.contains('vIn')) { const c = ctlDef(rs[i].key), v = parseNum(t.value); if (c && isFinite(v)) rs[i].value = Math.max(c.min, Math.min(c.max, v)); t.value = fnum(rs[i].value, decs(c && c.step)); }
      S.dirty = true; saveCurSoon();
    });
    V.addEventListener('input', e => { if (e.target.id === 'sqScrub') { seqIdx = +e.target.value; drawSeqChart(); } });
    const pm = e => { const cv = e.target; if (cv.id !== 'sqCv' || !S.seqRes) return; const x = cvX(cv, e); if (x == null) return; let best = 0, bd = Infinity; S.seqRes.samples.forEach((s, i) => { const d = Math.abs(s.t / 1000 - x); if (d < bd) { bd = d; best = i; } }); seqIdx = best; const sc = $('#sqScrub'); if (sc) sc.value = best; drawSeqChart(); };
    V.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'mouse') pm(e); }); V.addEventListener('pointerdown', pm);
  })();

  /* ============================================================ Beispiele (eingebaut als Rückfall, antdata.js hat Vorrang) */
  const B = (id, name, cat, rig, desc, controls, extra) => Object.assign({ id, name, cat, rig, desc, controls }, extra || {});
  const BUILTIN = [
    B('dc-pwm', 'PWM: halbe Leistung', 'Gleichstrom', 'gleichstrom', 'Tastgrad 50 % bei 12 V: Der Motor sieht im Mittel etwa die halbe Spannung.', { mode: 'pwm', dir: 'vor', duty: 50, uSupply: 12 }),
    B('dc-hbridge', 'H-Brücke von Hand: vorwärts', 'Gleichstrom', 'gleichstrom', 'S1 und S4 geschlossen: Der Strom fließt von links oben nach rechts unten durch den Motor.', { mode: 'manuell', S1: true, S2: false, S3: false, S4: true, uSupply: 12 }),
    B('dc-short', 'Fehler: Brückenkurzschluss', 'Gleichstrom', 'gleichstrom', 'S1 und S2 gleichzeitig: Die Brücke schließt das Netzteil kurz. Achte auf die Meldung.', { mode: 'manuell', S1: true, S2: true, S3: false, S4: false, uSupply: 12 }),
    B('dc-ramp', 'Rampe: hochfahren und abbremsen', 'Gleichstrom', 'gleichstrom', 'Der Tastgrad wird stufenweise erhöht und dann auf 0 zurückgenommen.', { mode: 'pwm', dir: 'vor', duty: 0, uSupply: 12 }, {
      dur: 10, rows: [{ t: 0, key: 'duty', value: 0 }, { t: 1, key: 'duty', value: 30 }, { t: 3, key: 'duty', value: 60 }, { t: 5, key: 'duty', value: 100 }, { t: 8, key: 'duty', value: 0 }] }),
    B('dc-rev', 'Richtungsumkehr mit Pause', 'Gleichstrom', 'gleichstrom', 'Erst anhalten, dann umkehren: So schont man Brücke und Netzteil.', { mode: 'pwm', dir: 'vor', duty: 0, uSupply: 12 }, {
      dur: 12, rows: [{ t: 0, key: 'duty', value: 60 }, { t: 4, key: 'duty', value: 0 }, { t: 6, key: 'dir', value: 'rueck' }, { t: 6.2, key: 'duty', value: 60 }, { t: 10, key: 'duty', value: 0 }] }),
    B('servo-rc', 'Servo: Mittelstellung', 'Servo', 'servo', 'Pulsbreite 1,5 ms: Der Servo fährt in die Mitte.', { mode: 'rc', pulse: 1.5 }),
    B('servo-pid', 'Lageregler: Sprungantwort', 'Servo', 'servo', 'Der Sollwinkel springt auf 90°. Beobachte Überschwingen und Ausregelzeit.', { mode: 'regler', setpoint: 0, kp: { rel: 0.3 }, ki: { rel: 0 }, kd: { rel: 0.1 } }, {
      dur: 6, rows: [{ t: 0, key: 'setpoint', value: 0 }, { t: 1, key: 'setpoint', value: 90 }] }),
    B('step-full', 'Schrittmotor: Vollschritt', 'Schrittmotor', 'schritt', 'Der Motor läuft mit 100 Schritten pro Sekunde, also eine halbe Umdrehung pro Sekunde.', { mode: 'auto', stepMode: 'voll', dir: 'vor', rate: 100, run: true }),
    B('step-slip', 'Fehler: Schrittverlust', 'Schrittmotor', 'schritt', 'Hohe Frequenz bei großer Last: Das Moment reicht nicht, der Motor verliert Schritte.', { mode: 'auto', stepMode: 'voll', dir: 'vor', rate: 1800, load: { rel: 0.8 }, run: true }),
    B('ac-direct', 'Drehstrom: Direktanlauf im Dreieck', 'Drehstrom', 'drehstrom', 'Beim Direktanlauf ist der Anlaufstrom ein Vielfaches des Nennstroms.', { source: 'netz', K1: true, K2: false, K3: true, load: 4 }),
    B('ac-sd', 'Stern-Dreieck-Anlauf', 'Drehstrom', 'drehstrom', 'Erst Stern (K1 und K2), nach dem Hochlauf Dreieck (K1 und K3). Der Anlaufstrom sinkt auf etwa ein Drittel.', { source: 'netz', K1: false, K2: false, K3: false, load: 3 }, {
      dur: 9, rows: [{ t: 0, key: 'K2', value: true }, { t: 0.2, key: 'K1', value: true }, { t: 4, key: 'K2', value: false }, { t: 4.3, key: 'K3', value: true }] }),
    B('ac-fu', 'Frequenzumrichter: sanfte Rampe', 'Drehstrom', 'drehstrom', 'Der Umrichter erhöht Frequenz und Spannung gemeinsam: weicher Hochlauf ohne Stromspitze.', { source: 'fu', freq: 0, ramp: 3, load: 4 }, {
      dur: 10, rows: [{ t: 0, key: 'freq', value: 0 }, { t: 0.5, key: 'freq', value: 25 }, { t: 5, key: 'freq', value: 50 }] }),
    B('ac-tip', 'Fehler: Kippmoment überschritten', 'Drehstrom', 'drehstrom', 'Die Last ist größer als das Kippmoment: Der Motor bleibt stehen und brummt.', { source: 'netz', K1: true, K2: false, K3: true, load: 80 }),
    B('ac-k2k3', 'Fehler: Stern und Dreieck zugleich', 'Drehstrom', 'drehstrom', 'K2 und K3 gleichzeitig ergibt einen Kurzschluss. Deshalb gibt es die Verriegelung.', { source: 'netz', K1: true, K2: true, K3: true }),
    B('gear-spur', 'Stirnradpaar 20:40', 'Getriebe', 'getriebe', 'Übersetzung i = 2: halbe Drehzahl, doppeltes Moment (abzüglich Verluste).', { type: 'Stirnrad', stages: 1, z1: 20, z2: 40, nIn: 1500, mIn: { rel: 0.3 }, lube: true }),
    B('gear-worm', 'Schneckengetriebe', 'Getriebe', 'getriebe', 'Große Untersetzung auf kleinem Raum, aber mit deutlich schlechterem Wirkungsgrad.', { type: 'Schnecke', stages: 1, z1: 8, z2: 40, nIn: 1500, mIn: { rel: 0.3 }, lube: true }),
    B('gear-dry', 'Fehler: ohne Schmierung', 'Getriebe', 'getriebe', 'Ohne Schmierung steigen Reibung und Temperatur.', { type: 'Stirnrad', stages: 1, z1: 20, z2: 40, nIn: 1500, mIn: 9, lube: false })
  ];
  function seqToRows(seq) {
    const rows = [], lastV = {}; if (!Array.isArray(seq)) return rows;
    seq.forEach(s => {
      if (!s) return;
      if (s.ramp && typeof s.ramp === 'object' && s.ramp.key != null) {   /* Rampe aus dem Kern: in kleine Stufen zerlegen */
        const c = ctlDef(s.ramp.key, (defOf(s.rig || S.rigId) || {}).controls), from = fin(lastV[s.ramp.key]) ? lastV[s.ramp.key] : (c && fin(+c.value) ? +c.value : 0), to = +s.ramp.to, d = Math.max(1, +s.ramp.durMs || 1000), n = Math.max(1, Math.min(10, Math.round(d / 500)));
        for (let i = 1; i <= n; i++) rows.push({ t: Math.round(((+s.t || 0) + d * i / n)) / 1000, key: s.ramp.key, value: Math.round((from + (to - from) * i / n) * 1000) / 1000 }); lastV[s.ramp.key] = to;
      }
      if (s.set && typeof s.set === 'object') Object.keys(s.set).forEach(k => { rows.push({ t: Math.round((+s.t || 0)) / 1000, key: k, value: s.set[k] }); lastV[k] = +s.set[k]; });
      else if (s.key != null) rows.push({ t: Math.round((+s.t || 0)) / 1000, key: s.key, value: s.value });
    });
    return rows;
  }
  function exampleList() {
    const d = root.ANT_DATA; let a = d && d.examples;
    if (a && !Array.isArray(a)) a = Object.keys(a).map(k => Object.assign({ id: k }, a[k]));
    if (!a || !a.length) a = BUILTIN;
    return a.map(e => ({ id: e.id, name: e.name, cat: e.cat || 'Beispiele', desc: e.desc || e.text || '', rig: e.rig, controls: e.controls || {}, dur: e.dur, rows: e.rows ? clone(e.rows) : (e.seq ? seqToRows(e.seq) : null), seq: e.seq }));
  }
  function loadExample(e) {
    if (!e) return false; const had = stash(); S.task = null;
    setRig(e.rig && ORDER.includes(e.rig) ? e.rig : S.rigId || ORDER[0]);
    applyCtl(e.controls);
    S.rows[S.rigId] = e.rows ? clone(e.rows) : []; if (!S.seqDur) S.seqDur = {}; S.seqDur[S.rigId] = e.dur ? (e.dur > 500 ? e.dur / 1000 : e.dur) : null; S.seqRes = null;
    S.name = e.name; S.id = null; S.dirty = false;
    setTab(e.rows && e.rows.length ? 'seq' : 'rig'); updateChrome(); saveCurSoon();
    toast(had ? 'Beispiel geladen, dein Versuch ist gesichert' : 'Beispiel geladen: ' + e.name);
    return true;
  }
  function loadExampleByName(n) { n = String(n || '').toLowerCase(); const e = exampleList().find(x => x.name.toLowerCase().includes(n) || x.id === n); return loadExample(e); }
  function openExamples() {
    const ex = exampleList();
    sheet('Beispielversuche', (b, close) => {
      let last = '', h = '<p class="hint2" style="margin-top:0">Tippe ein Beispiel an: Prüfstand und Einstellungen werden geladen. Dein bisheriger Versuch wird vorher gesichert.</p>';
      ex.forEach((e, i) => { if (e.cat !== last) { last = e.cat; h += `<div class="gh">${esc(e.cat)}</div>`; } h += `<button class="row" data-i="${i}"><span style="font-size:22px">${rigIcon(e.rig)}</span><div class="grow"><b>${esc(e.name)}</b><small>${esc(e.desc)}${e.rows && e.rows.length ? ' · mit Ablaufprogramm' : ''}</small></div></button>`; });
      b.innerHTML = h;
      b.addEventListener('click', ev => { const r = ev.target.closest('.row'); if (!r) return; close(); loadExample(ex[+r.dataset.i]); });
    });
  }

  /* ============================================================ Speichern, Öffnen, Teilen */
  const PK = 'ant.saves';
  const saves = () => { const a = lsGet(PK, []); return Array.isArray(a) ? a : []; };
  function saveItem(name) {
    const a = saves(), id = S.id || uid(); S.id = id; S.name = name || S.name;
    const e = { id, name: S.name, t: Date.now(), rig: S.rigId, ctl: allCtl(), rows: clone(curRows()), dur: seqDur() };
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
        b.innerHTML = items.map(i => `<div class="row"><button class="grow" data-o="${i.id}" style="text-align:left"><b>${esc(i.name)}</b><small>${rigIcon(i.rig)} ${esc(rigName(i.rig))} · ${new Date(i.t).toLocaleDateString('de-DE')}</small></button><button class="chip danger s" data-d="${i.id}">Löschen</button></div>`).join('');
      };
      draw();
      b.addEventListener('click', async e => {
        const o = e.target.closest('[data-o]'), d = e.target.closest('[data-d]');
        if (o) { const it = saves().find(x => x.id === o.dataset.o); if (!it) return; close(); loadItem(it); }
        else if (d) { if (!await confirmSheet('Löschen?', 'Der gespeicherte Versuch wird gelöscht.', 'Löschen', true)) return; lsSet(PK, saves().filter(x => x.id !== d.dataset.d)); draw(); }
      });
    });
  }
  function applyItem(it, suffix) {
    S.task = null; setRig(ORDER.includes(it.rig) ? it.rig : ORDER[0]); applyCtl(it.ctl);
    S.rows[S.rigId] = clone(it.rows || []); if (!S.seqDur) S.seqDur = {}; S.seqDur[S.rigId] = it.dur || null; S.seqRes = null;
    S.name = (it.name || 'Versuch') + (suffix || ''); S.dirty = false; updateChrome(); saveCurSoon();
    setTab(S.tab === 'seq' || S.tab === 'curves' ? S.tab : 'rig'); if (S.tab === 'seq') renderSeq();
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
    let url; try { url = location.href.split('#')[0].split('?')[0] + '#' + await packShare({ k: 'ant', name: S.name, rig: S.rigId, ctl: allCtl(), rows: curRows(), dur: seqDur() }); } catch (e) { toast('Teilen nicht möglich'); return; }
    if (navigator.share) { try { await navigator.share({ title: 'Tonfunk Antriebs-Lab: ' + S.name, text: 'Schau dir meinen Antriebs-Versuch „' + S.name + '“ an:', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
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
    const cv = ctlsOf().map(x => { const v = vals[x.key]; let t = v; if (x.type === 'switch' || x.type === 'button') t = v ? 'EIN' : 'AUS'; else if (x.type === 'select') { const o = (x.options || []).find(q => q.value === v); t = o ? o.label : v; } else t = fnum(v, decs(x.step)) + (x.unit ? ' ' + x.unit : ''); return `<tr><td>${esc(x.group || '')}</td><td>${esc(x.label)}</td><td>${esc(t)}</td></tr>`; }).join('');
    const mt = metersOf().map(m => `<tr><td>${esc(m.label)}</td><td>${fnum(mv[m.key], m.digits == null ? 1 : m.digits)} ${esc(m.unit || '')}</td></tr>`).join('');
    const ev = ((S.rig.events) || []).slice(-15).map(e => `<tr><td>${mmss(e.t || 0)}</td><td>${esc(e.text)}</td></tr>`).join('');
    const rows = curRows().map(r => { const d = ctlDef(r.key); return `<tr><td>${fnum(r.t, 1)} s</td><td>${esc(d ? d.label : r.key)}</td><td>${esc(typeof r.value === 'boolean' ? (r.value ? 'EIN' : 'AUS') : String(r.value))}</td></tr>`; }).join('');
    $('#printArea').innerHTML = `<div class="proto"><h1>${esc(S.name)}</h1><p>Prüfstand: ${esc(rigName(S.rigId))} · ${new Date().toLocaleDateString('de-DE')}${who ? ' · ' + esc(who) : ''}</p>
      <h2>Prüfstand</h2><img src="${c.toDataURL('image/png')}" alt="">
      <h2>Einstellungen</h2><table><tr><th>Gruppe</th><th>Steuerwert</th><th>Wert</th></tr>${cv}</table>
      <h2>Messwerte</h2><table><tr><th>Messgerät</th><th>Wert</th></tr>${mt}</table>
      ${rows ? `<h2>Ablaufprogramm</h2><table><tr><th>Zeit</th><th>Steuerwert</th><th>Wert</th></tr>${rows}</table>` : ''}
      ${ev ? `<h2>Meldungen</h2><table><tr><th>Zeit</th><th>Meldung</th></tr>${ev}</table>` : ''}</div>`;
    setTimeout(() => window.print(), 80);
  }

  /* ============================================================ Aufgaben */
  const TK = () => (root.ANT_TASKS && Array.isArray(root.ANT_TASKS.tasks) && root.ANT_TASKS.tasks.length ? root.ANT_TASKS.tasks : null);
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
  /* Aufgabenzustand (start() und sol() liefern { rig?, controls?, seq?: [{t(ms), set}] | rows? }) übernehmen */
  function applyTaskState(t, o) {
    o = o || {}; const rid = o.rig || t.rig || S.rigId;
    setRig(ORDER.includes(rid) ? rid : S.rigId); applyCtl(o.controls || o.ctl);
    S.rows[S.rigId] = o.rows ? clone(o.rows) : seqToRows(o.seq); if (!S.seqDur) S.seqDur = {}; S.seqDur[S.rigId] = o.dur ? (o.dur > 500 ? o.dur / 1000 : o.dur) : null; S.seqRes = null;
  }
  async function startTask(id) {
    const t = (TK() || []).find(x => x.id === id); if (!t) return;
    const had = stash(); taskRes = null;
    if (root.Auswertung) root.Auswertung.hintReset(id);
    let o; try { o = typeof t.start === 'function' ? t.start() : {}; } catch (e) { console.error(e); toast('Die Startvorlage der Aufgabe fehlt'); return; }
    applyTaskState(t, o); S.task = { id }; S.name = t.title; S.id = null; S.dirty = false; delete taskAns[id];
    setTab(o && o.rows && o.rows.length || o && o.seq && o.seq.length ? 'seq' : 'rig'); updateChrome();
    toast(had ? 'Aufgabe gestartet, dein Versuch ist gesichert' : 'Aufgabe gestartet'); renderTasksIfOpen();
  }
  const renderTasksIfOpen = () => { if (S.tab === 'tasks') renderTasks(); };
  function collectAnswer(t) {
    let st = null; try { st = S.rig ? clone(S.rig.state()) : null; } catch (e) {}
    const a = taskAns[t.id] || {}, v = a.v != null && a.v !== '' ? parseNum(a.v) : NaN;
    return { rig: S.rigId, controls: allCtl(), seq: seqSteps(curRows()), rows: clone(curRows()), dur: Math.round(seqDur() * 1000), state: st, simTime: S.simT, value: isFinite(v) ? v : null, text: a.v == null ? '' : String(a.v) };
  }
  async function checkTask() {
    const t = curTask(); if (!t) return; const R = root.ANT_TASKS;
    S.readonly = true; updateChrome(); updateTaskBar();
    const ans = collectAnswer(t); let lines;
    try { lines = await (R.run ? R.run(t, ans) : t.check(ans)); } catch (e) { console.error(e); lines = [{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden: ' + (e && e.message || e), why: '' }]; }
    S.readonly = false;
    lines = Array.isArray(lines) ? lines : [];
    const pct = Math.round(100 * lines.filter(l => l.ok).length / Math.max(lines.length, 1));
    taskRes = { id: t.id, lines, pct }; markDone(t.id, pct); updateTaskBadge();
    const F = root.LochFX;
    if (F) try { if (pct === 100) { F.pass(100); if (F.isFun && F.isFun()) F.confetti(false); } else F.pass(pct); } catch (e) {}
    updateChrome(); updateTaskBar(); if (S.tab !== 'tasks') setTab('tasks'); else renderTasks();
    toast(pct === 100 ? '🎉 Geschafft!' : pct + ' % richtig');
  }
  function hintTask() {
    const t = curTask(); if (!t) return; const h = t.hint, arr = Array.isArray(h) ? h : null;
    const open = () => {
      const had = stash(); let o; try { o = t.sol(); } catch (e) { console.error(e); toast('Die Musterlösung fehlt'); return; }
      S.task = null; taskRes = null; applyTaskState(t, o); S.name = t.title + ' (Musterlösung)'; S.id = null; S.dirty = false;
      setTab(o && (o.rows && o.rows.length || o.seq && o.seq.length) ? 'seq' : 'rig'); updateChrome(); toast(had ? 'Musterlösung geöffnet, dein Stand ist gesichert' : 'Musterlösung geöffnet');
    };
    const o = { id: t.id, hint: arr ? arr[0] : h, concrete: () => { if (arr && arr[1]) return arr[1]; const l = taskRes && taskRes.id === t.id ? taskRes.lines.find(x => !x.ok) : null; return l ? 'Noch nicht erfüllt: ' + l.text : taskRes && taskRes.id === t.id ? 'Alle Prüfpunkte sind erfüllt. Tippe auf „Lösung prüfen“.' : 'Tippe zuerst auf „Lösung prüfen“, dann kann ich dir den ersten offenen Punkt nennen.'; }, reveal: arr && arr[2] ? () => arr[2] : null, solution: typeof t.sol === 'function' ? open : null };
    if (root.Auswertung) root.Auswertung.hint(o); else sheet('Tipp', b => { b.innerHTML = '<p style="margin-top:0">' + esc(o.hint || '') + '</p>'; });
  }
  function renderTasks() {
    const V = $('#taskView'), A = TK();
    if (!A) { V.innerHTML = '<div class="card pl"><h4>Aufgaben</h4><p class="big">Aufgaben folgen</p><p class="hint2">Hier erscheinen bald Aufgaben mit automatischer Prüfung: Grundlagen, Gleichstrom und H-Brücke, Servo, Schrittmotor, Drehstrom, Getriebe, Fehlersuche und Prüfungsaufgaben. Bis dahin kannst du mit den Beispielen und dem Rechner üben.</p><div class="btns"><button class="btn pri" id="tkEx">Beispiele ansehen</button><button class="btn" id="tkRetry" data-retry>Erneut prüfen</button></div></div>'; $('#tkEx', V).onclick = openExamples; return; }
    const d = taskDone(), t = curTask(); let h = '';
    const n100 = A.filter(x => (d[x.id] || 0) >= 100).length, ic = x => rigIcon(x.rig);
    if (t) {
      const r = taskRes && taskRes.id === t.id ? taskRes : null, ask2 = t.ask ? (typeof t.ask === 'string' ? { label: t.ask } : t.ask) : null;
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat || '')}</h4><div class="big">${esc(t.title)}</div><div class="lv">${'●'.repeat(t.level || 1)}${'○'.repeat(3 - (t.level || 1))}</div>
        <p style="margin:8px 0">${esc(t.text)}</p><p class="hint2" style="margin-top:0">Prüfstand: ${ic(t)} ${esc(rigName(t.rig))}</p>
        ${ask2 ? `<label class="f"><span>${esc(ask2.label || 'Dein Ergebnis')}${ask2.unit ? ' (' + esc(ask2.unit) + ')' : ''}</span><input id="tkAns" inputmode="decimal" autocomplete="off" value="${esc((taskAns[t.id] || {}).v || '')}"></label>` : ''}
        <div class="btns"><button class="btn pri" data-ta="check">✓ Lösung prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button></div>
        <div class="btns"><button class="btn" data-ta="rig">Zum Prüfstand</button><button class="btn" data-ta="hand">Abgeben (QR)</button><button class="btn danger" data-ta="end">Aufgabe beenden</button></div>`;
      if (r) h += `<ul class="tl">${r.lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}${!l.ok && l.why ? `<details><summary>Warum?</summary>${esc(l.why)}</details>` : ''}</li>`).join('')}</ul><div class="score ${r.pct === 100 ? 'ok' : ''}">${r.pct === 100 ? '🎉 Geschafft!' : r.pct + ' % richtig'}</div>`;
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${A.length} Aufgaben vollständig gelöst. Wähle eine Aufgabe: Du bekommst eine Startvorlage, stellst den Prüfstand ein (oder rechnest) und lässt die Lösung prüfen.</p>`;
    let last = '';
    A.forEach(x => {
      if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; }
      const p = d[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${p >= 100 ? 'g' : p > 0 ? 'p' : ''}">${p >= 100 ? '✓' : p > 0 ? p : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${'●'.repeat(x.level || 1)}${'○'.repeat(3 - (x.level || 1))}</span> ${ic(x)} ${esc(rigName(x.rig))}${p != null ? ' · bisher ' + p + ' %' : ''}</small></div></button>`;
    });
    V.innerHTML = h;
  }
  $('#taskView').addEventListener('input', e => { if (e.target.id === 'tkAns' && S.task) { taskAns[S.task.id] = { v: e.target.value }; } });
  $('#taskView').addEventListener('click', async e => {
    const tb = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tb) {
      const a = tb.dataset.ta;
      if (a === 'check') checkTask(); else if (a === 'hint') hintTask(); else if (a === 'rig') setTab('rig');
      else if (a === 'hand') { const t = curTask(); if (t && root.Auswertung) root.Auswertung.handIn(t.id, taskDone()[t.id] || 0, t.title); }
      else if (a === 'end') { S.task = null; taskRes = null; updateChrome(); renderTasks(); toast('Aufgabe beendet'); }
    } else if (row) startTask(row.dataset.t);
  });

  /* ============================================================ Rechnen: Formelrechner und Übungsgenerator */
  const TP = 2 * Math.PI, SQ3 = Math.sqrt(3);
  const gz = (x, d) => fnum(x, d == null ? 2 : d);
  const CORE_F = () => (root.ANT_CORE && root.ANT_CORE.formulas) || null;
  const CALC = [
    { id: 'omega', name: 'Drehzahl und Winkelgeschwindigkeit', inp: [{ k: 'n', l: 'Drehzahl n', u: '1/min', d: 1500 }],
      fn: v => { const w = TP * v.n / 60; return { res: [['Winkelgeschwindigkeit ω', w, 'rad/s', 2], ['Umdrehungen pro Sekunde', v.n / 60, '1/s', 2]], steps: ['ω = 2π · n / 60 s', `ω = 2π · ${gz(v.n, 1)} / 60 = ${gz(w)} rad/s`] }; } },
    { id: 'power', name: 'Leistung aus Moment und Drehzahl', inp: [{ k: 'M', l: 'Drehmoment M', u: 'Nm', d: 10 }, { k: 'n', l: 'Drehzahl n', u: '1/min', d: 1420 }],
      fn: v => { const w = TP * v.n / 60, P = v.M * w; return { res: [['Mechanische Leistung P', P, 'W', 1], ['Mechanische Leistung P', P / 1000, 'kW', 3]], steps: ['ω = 2π · n / 60', `ω = 2π · ${gz(v.n, 1)} / 60 = ${gz(w)} rad/s`, 'P = M · ω', `P = ${gz(v.M)} Nm · ${gz(w)} rad/s = ${gz(P, 1)} W`] }; } },
    { id: 'torque', name: 'Moment aus Leistung und Drehzahl', inp: [{ k: 'P', l: 'Leistung P', u: 'kW', d: 1.5 }, { k: 'n', l: 'Drehzahl n', u: '1/min', d: 1420 }],
      fn: v => { const w = TP * v.n / 60, M = v.P * 1000 / w; return { res: [['Drehmoment M', M, 'Nm', 2]], steps: ['ω = 2π · n / 60', `ω = 2π · ${gz(v.n, 1)} / 60 = ${gz(w)} rad/s`, 'M = P / ω', `M = ${gz(v.P * 1000, 0)} W / ${gz(w)} rad/s = ${gz(M)} Nm`, `Faustformel: M ≈ 9550 · P[kW] / n = ${gz(9550 * v.P / v.n)} Nm`] }; } },
    { id: 'eta', name: 'Wirkungsgrad und Verlustleistung', inp: [{ k: 'Pab', l: 'abgegebene Leistung', u: 'W', d: 1500 }, { k: 'Pzu', l: 'zugeführte Leistung', u: 'W', d: 1880 }],
      fn: v => { const e = v.Pab / v.Pzu; return { res: [['Wirkungsgrad η', e * 100, '%', 1], ['Verlustleistung P_V', v.Pzu - v.Pab, 'W', 1]], steps: ['η = P_ab / P_zu', `η = ${gz(v.Pab, 1)} W / ${gz(v.Pzu, 1)} W = ${gz(e, 3)} = ${gz(e * 100, 1)} %`, 'P_V = P_zu − P_ab', `P_V = ${gz(v.Pzu, 1)} W − ${gz(v.Pab, 1)} W = ${gz(v.Pzu - v.Pab, 1)} W`] }; } },
    { id: 'ratio', name: 'Getriebe: Übersetzung, Drehzahl und Moment', inp: [{ k: 'z1', l: 'Zähne Antriebsrad z1', u: '', d: 20 }, { k: 'z2', l: 'Zähne Abtriebsrad z2', u: '', d: 40 }, { k: 'n', l: 'Eingangsdrehzahl', u: '1/min', d: 1500 }, { k: 'M', l: 'Eingangsmoment', u: 'Nm', d: 2 }, { k: 'eta', l: 'Wirkungsgrad', u: '%', d: 96 }],
      fn: v => { const i = v.z2 / v.z1, no = v.n / i, Mo = v.M * i * v.eta / 100; return { res: [['Übersetzung i', i, '', 3], ['Ausgangsdrehzahl n_aus', no, '1/min', 1], ['Ausgangsmoment M_aus', Mo, 'Nm', 2], ['Eingangsleistung', v.M * TP * v.n / 60, 'W', 1], ['Ausgangsleistung', Mo * TP * no / 60, 'W', 1]], steps: ['i = z2 / z1', `i = ${gz(v.z2, 0)} / ${gz(v.z1, 0)} = ${gz(i, 3)}`, 'n_aus = n_ein / i', `n_aus = ${gz(v.n, 1)} / ${gz(i, 3)} = ${gz(no, 1)} 1/min`, 'M_aus = M_ein · i · η', `M_aus = ${gz(v.M)} Nm · ${gz(i, 3)} · ${gz(v.eta / 100, 2)} = ${gz(Mo)} Nm`] }; } },
    { id: 'sync', name: 'Synchrondrehzahl', inp: [{ k: 'f', l: 'Frequenz f', u: 'Hz', d: 50 }, { k: 'p', l: 'Polpaarzahl p', u: '', d: 2 }],
      fn: v => { const ns = 60 * v.f / v.p; return { res: [['Synchrondrehzahl n_s', ns, '1/min', 0]], steps: ['n_s = 60 · f / p', `n_s = 60 · ${gz(v.f, 1)} / ${gz(v.p, 0)} = ${gz(ns, 0)} 1/min`] }; } },
    { id: 'slip', name: 'Schlupf eines Asynchronmotors', inp: [{ k: 'f', l: 'Frequenz f', u: 'Hz', d: 50 }, { k: 'p', l: 'Polpaarzahl p', u: '', d: 2 }, { k: 'n', l: 'Drehzahl n (Welle)', u: '1/min', d: 1420 }],
      fn: v => { const ns = 60 * v.f / v.p, s = (ns - v.n) / ns; return { res: [['Synchrondrehzahl n_s', ns, '1/min', 0], ['Schlupf s', s * 100, '%', 2], ['Drehzahldifferenz', ns - v.n, '1/min', 0]], steps: ['n_s = 60 · f / p', `n_s = 60 · ${gz(v.f, 1)} / ${gz(v.p, 0)} = ${gz(ns, 0)} 1/min`, 's = (n_s − n) / n_s', `s = (${gz(ns, 0)} − ${gz(v.n, 0)}) / ${gz(ns, 0)} = ${gz(s, 4)} = ${gz(s * 100, 2)} %`] }; } },
    { id: 'ts', name: 'Typenschild: alles aus den Angaben', inp: [{ k: 'P', l: 'Leistung P (Welle)', u: 'kW', d: 1.5 }, { k: 'U', l: 'Spannung U', u: 'V', d: 400 }, { k: 'I', l: 'Strom I', u: 'A', d: 3.4 }, { k: 'cos', l: 'cos φ', u: '', d: 0.8 }, { k: 'n', l: 'Drehzahl n', u: '1/min', d: 1420 }, { k: 'f', l: 'Frequenz f', u: 'Hz', d: 50 }],
      fn: v => {
        let Pz = SQ3 * v.U * v.I * v.cos, eta = v.P * 1000 / Pz, w = TP * v.n / 60, M = v.P * 1000 / w, p = Math.max(1, Math.round(60 * v.f / v.n)), ns = 60 * v.f / p, s = (ns - v.n) / ns, S3 = SQ3 * v.U * v.I;
        try {   /* Kernrechnung gegenprüfen: stimmt ANT_CORE.typenschild überein, nimmt die Anzeige dessen Werte */
          const K = root.ANT_CORE && root.ANT_CORE.typenschild && root.ANT_CORE.typenschild(v.P, v.U, v.I, v.cos, v.n, { unitP: 'kW', f: v.f });
          if (K && K.ok && Math.abs(K.pIn - Pz) < 0.01 * Pz && Math.abs(K.eta - eta) < 0.01 * eta + 1e-6) { Pz = K.pIn; eta = K.eta; M = K.torque; p = K.polePairs; ns = K.nSync; s = K.slip; S3 = K.S; }
        } catch (e) {}
        return { res: [['Aufgenommene Wirkleistung P_zu', Pz, 'W', 0], ['Wirkungsgrad η', eta * 100, '%', 1], ['Nennmoment M', M, 'Nm', 2], ['Polpaarzahl p', p, '', 0], ['Synchrondrehzahl n_s', ns, '1/min', 0], ['Schlupf s', s * 100, '%', 1], ['Scheinleistung S', S3, 'VA', 0]],
          steps: ['P_zu = √3 · U · I · cos φ', `P_zu = 1,732 · ${gz(v.U, 0)} V · ${gz(v.I)} A · ${gz(v.cos)} = ${gz(Pz, 0)} W`, 'η = P / P_zu', `η = ${gz(v.P * 1000, 0)} W / ${gz(Pz, 0)} W = ${gz(eta, 3)} = ${gz(eta * 100, 1)} %`, 'M = P / ω  mit ω = 2π · n / 60', `ω = ${gz(w)} rad/s, M = ${gz(v.P * 1000, 0)} W / ${gz(w)} rad/s = ${gz(M)} Nm`, 'Polpaarzahl: n_s ist die nächsthöhere Drehzahl über n (60 · f / p)', `p = 60 · ${gz(v.f, 0)} / ${gz(v.n, 0)} ≈ ${gz(60 * v.f / v.n, 2)} → gerundet p = ${p}, n_s = ${gz(ns, 0)} 1/min`, 's = (n_s − n) / n_s', `s = (${gz(ns, 0)} − ${gz(v.n, 0)}) / ${gz(ns, 0)} = ${gz(s * 100, 1)} %`] };
      } },
    { id: 'sd', name: 'Stern-Dreieck-Anlauf', inp: [{ k: 'I', l: 'Anlaufstrom bei Direktanlauf', u: 'A', d: 24 }, { k: 'M', l: 'Anlaufmoment bei Direktanlauf', u: 'Nm', d: 18 }],
      fn: v => ({ res: [['Anlaufstrom in Stern', v.I / 3, 'A', 2], ['Anlaufmoment in Stern', v.M / 3, 'Nm', 2]], steps: ['In Stern liegt an jeder Wicklung nur U / √3 (statt U).', 'Strom und Moment sinken dadurch auf ein Drittel.', `I_Y = I_Δ / 3 = ${gz(v.I)} A / 3 = ${gz(v.I / 3)} A`, `M_Y = M_Δ / 3 = ${gz(v.M)} Nm / 3 = ${gz(v.M / 3)} Nm`] }) },
    { id: 'dcstart', name: 'Gleichstrommotor: Anlaufstrom', inp: [{ k: 'U', l: 'Spannung U', u: 'V', d: 12 }, { k: 'R', l: 'Wicklungswiderstand R', u: 'Ω', d: 1.2 }],
      fn: v => ({ res: [['Anlaufstrom I_A', v.U / v.R, 'A', 2]], steps: ['Beim Anlauf steht der Motor still, es gibt keine Gegenspannung.', 'I_A = U / R', `I_A = ${gz(v.U)} V / ${gz(v.R)} Ω = ${gz(v.U / v.R)} A`] }) },
    { id: 'pwm', name: 'PWM: mittlere Spannung', inp: [{ k: 'U', l: 'Versorgungsspannung', u: 'V', d: 12 }, { k: 'D', l: 'Tastgrad D', u: '%', d: 50 }],
      fn: v => ({ res: [['Mittlere Spannung U_m', v.U * v.D / 100, 'V', 2]], steps: ['U_m = D · U', `U_m = ${gz(v.D / 100, 2)} · ${gz(v.U)} V = ${gz(v.U * v.D / 100)} V`] }) },
    { id: 'step', name: 'Schrittmotor: Drehzahl und Winkel', inp: [{ k: 'f', l: 'Schrittfrequenz', u: 'Schritte/s', d: 400 }, { k: 'z', l: 'Schritte je Umdrehung', u: '', d: 200 }],
      fn: v => ({ res: [['Winkel je Schritt', 360 / v.z, '°', 2], ['Drehzahl n', v.f * 60 / v.z, '1/min', 1]], steps: ['α = 360° / Schritte je Umdrehung', `α = 360° / ${gz(v.z, 0)} = ${gz(360 / v.z)}°`, 'n = f · 60 / Schritte je Umdrehung', `n = ${gz(v.f, 0)} · 60 / ${gz(v.z, 0)} = ${gz(v.f * 60 / v.z, 1)} 1/min`] }) }
  ];
  const calcVals = {};
  let calcId = 'ts', exCur = null, exScore = { ok: 0, n: 0, streak: 0 };
  /* Kern-Formeln zur Gegenprobe (nur Dev-Test): ANT_CORE.formulas.* wird nicht für die Anzeige verwendet, weil die Einheiten dort nicht festgelegt sind */
  function renderCalc() {
    const V = $('#calcView'), c = CALC.find(x => x.id === calcId) || CALC[0];
    if (!calcVals[c.id]) { calcVals[c.id] = {}; c.inp.forEach(i => { calcVals[c.id][i.k] = String(i.d).replace('.', ','); }); }
    V.innerHTML = `<div class="card pl"><h4>Formelrechner</h4><div class="cgrid">${CALC.map(x => `<button class="chip s${x.id === c.id ? ' on' : ''}" data-c="${x.id}">${esc(x.name)}</button>`).join('')}</div>
      <div class="frm" id="cForm">${c.inp.map(i => `<label class="f"><span>${esc(i.l)}${i.u ? ' in ' + esc(i.u) : ''}</span><input data-k="${i.k}" inputmode="decimal" autocomplete="off" value="${esc(calcVals[c.id][i.k])}"></label>`).join('')}</div>
      <div id="cRes"></div></div>
      <div class="card pl"><h4>Übungsaufgaben</h4><div id="exBox"></div></div>`;
    calcOut(); renderEx();
  }
  function calcOut() {
    const c = CALC.find(x => x.id === calcId), box = $('#cRes'); if (!c || !box) return;
    const v = {}; let ok = true; c.inp.forEach(i => { const x = parseNum(calcVals[c.id][i.k]); v[i.k] = x; if (!isFinite(x)) ok = false; });
    if (!ok) { box.innerHTML = '<div class="res"><span class="hint2">Bitte in alle Felder Zahlen eintragen (Komma oder Punkt).</span></div>'; return; }
    if (c.id === 'ratio' && (v.z1 <= 0 || v.z2 <= 0)) { box.innerHTML = '<div class="res"><span class="hint2">Die Zähnezahlen müssen größer als 0 sein.</span></div>'; return; }
    if (['slip', 'sync', 'ts'].includes(c.id) && (v.p === 0 || v.n === 0)) { box.innerHTML = '<div class="res"><span class="hint2">p und n dürfen nicht 0 sein.</span></div>'; return; }
    if (c.id === 'eta' && v.Pzu === 0) { box.innerHTML = '<div class="res"><span class="hint2">Die zugeführte Leistung darf nicht 0 sein.</span></div>'; return; }
    if ((c.id === 'dcstart' && v.R === 0) || (c.id === 'step' && v.z === 0)) { box.innerHTML = '<div class="res"><span class="hint2">Der Nenner darf nicht 0 sein.</span></div>'; return; }
    let r; try { r = c.fn(v); } catch (e) { box.innerHTML = '<div class="res"><span class="hint2">Das lässt sich nicht berechnen.</span></div>'; return; }
    box.innerHTML = `<div class="res">${r.res.map(x => `<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>${esc(x[0])}</span><span class="big2">${gz(x[1], x[3])} ${esc(x[2])}</span></div>`).join('')}<details open><summary style="min-height:36px;display:flex;align-items:center;color:var(--accent);cursor:pointer">Rechenweg</summary><ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></details></div>`;
  }
  /* ---- Übungsgenerator ---- */
  const rn = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pk = a => a[Math.floor(Math.random() * a.length)], r1 = (x, d) => Math.round(x * Math.pow(10, d)) / Math.pow(10, d);
  function genEx() {
    const kind = pk(['ts', 'ts', 'gear', 'gear', 'pow', 'sync', 'pwm', 'sd', 'dc']);
    if (kind === 'ts') {
      const P = pk([0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5]), p = pk([1, 2, 2, 2, 3]), sl = P < 1 ? rn(55, 75) / 1000 : P < 4 ? rn(40, 60) / 1000 : rn(30, 45) / 1000;
      const ns = 3000 / p, n = Math.round(ns * (1 - sl)), cos = r1(rn(72, 88) / 100, 2), et = rn(70, 90) / 100, U = 400, I = Math.max(0.5, r1(P * 1000 / (SQ3 * U * cos * et), 1)), f = 50;
      const Pz = SQ3 * U * I * cos, w = TP * n / 60, s = (ns - n) / ns, q = pk(['pz', 'eta', 'm', 's', 'p']);
      const head = `Typenschild eines Drehstrommotors: P = ${gz(P)} kW, U = ${U} V (Dreieck), I = ${gz(I, 1)} A, cos φ = ${gz(cos)}, n = ${n} 1/min, f = ${f} Hz.`;
      const stepsP = ['P_zu = √3 · U · I · cos φ', `P_zu = 1,732 · ${U} · ${gz(I, 1)} · ${gz(cos)} = ${gz(Pz, 0)} W`];
      if (q === 'pz') return { text: head + ' Welche Wirkleistung nimmt der Motor aus dem Netz auf?', label: 'P_zu', unit: 'W', ans: Pz, dec: 0, steps: stepsP };
      if (q === 'eta') return { text: head + ' Wie groß ist der Wirkungsgrad?', label: 'η', unit: '%', ans: P * 1000 / Pz * 100, dec: 1, steps: stepsP.concat(['η = P / P_zu', `η = ${gz(P * 1000, 0)} / ${gz(Pz, 0)} = ${gz(P * 1000 / Pz * 100, 1)} %`]) };
      if (q === 'm') return { text: head + ' Wie groß ist das Nennmoment an der Welle?', label: 'M', unit: 'Nm', ans: P * 1000 / w, dec: 2, steps: ['ω = 2π · n / 60', `ω = ${gz(w)} rad/s`, 'M = P / ω', `M = ${gz(P * 1000, 0)} / ${gz(w)} = ${gz(P * 1000 / w)} Nm`] };
      if (q === 's') return { text: head + ' Wie groß ist der Schlupf?', label: 's', unit: '%', ans: s * 100, dec: 1, steps: [`n_s = 60 · f / p mit p = ${p}: n_s = ${gz(ns, 0)} 1/min`, 's = (n_s − n) / n_s', `s = (${gz(ns, 0)} − ${n}) / ${gz(ns, 0)} = ${gz(s * 100, 1)} %`] };
      return { text: head + ' Wie viele Polpaare hat der Motor?', label: 'p', unit: '', ans: p, dec: 0, steps: [`Die Synchrondrehzahl liegt knapp über n = ${n} 1/min.`, `p = 60 · f / n_s: für p = ${p} ist n_s = ${gz(ns, 0)} 1/min`] };
    }
    if (kind === 'gear') {
      const z1 = rn(12, 30), z2 = Math.min(80, Math.round(z1 * pk([1.5, 2, 2.5, 3, 4]))), n = pk([1000, 1500, 2000, 3000]), M = r1(rn(5, 50) / 10, 1), et = pk([90, 95, 96, 98]), i = z2 / z1, q = pk(['i', 'n', 'm']);
      const head = `Stirnradgetriebe: Antriebsrad z1 = ${z1} Zähne, Abtriebsrad z2 = ${z2} Zähne, Eingang n = ${n} 1/min und M = ${gz(M, 1)} Nm, Wirkungsgrad ${et} %.`;
      if (q === 'i') return { text: head + ' Wie groß ist die Übersetzung i?', label: 'i', unit: '', ans: i, dec: 2, steps: ['i = z2 / z1', `i = ${z2} / ${z1} = ${gz(i, 3)}`] };
      if (q === 'n') return { text: head + ' Welche Drehzahl hat die Abtriebswelle?', label: 'n_aus', unit: '1/min', ans: n / i, dec: 0, steps: ['i = z2 / z1 = ' + gz(i, 3), 'n_aus = n_ein / i', `n_aus = ${n} / ${gz(i, 3)} = ${gz(n / i, 1)} 1/min`] };
      return { text: head + ' Welches Moment liefert die Abtriebswelle?', label: 'M_aus', unit: 'Nm', ans: M * i * et / 100, dec: 2, steps: ['i = z2 / z1 = ' + gz(i, 3), 'M_aus = M_ein · i · η', `M_aus = ${gz(M, 1)} · ${gz(i, 3)} · ${gz(et / 100, 2)} = ${gz(M * i * et / 100)} Nm`] };
    }
    if (kind === 'pow') {
      const n = pk([750, 1000, 1420, 2800, 3000]), M = r1(rn(10, 300) / 10, 1), w = TP * n / 60;
      if (Math.random() < 0.5) return { text: `Ein Motor liefert bei n = ${n} 1/min ein Moment von ${gz(M, 1)} Nm. Wie groß ist die mechanische Leistung?`, label: 'P', unit: 'W', ans: M * w, dec: 0, steps: ['ω = 2π · n / 60', `ω = ${gz(w)} rad/s`, 'P = M · ω', `P = ${gz(M, 1)} · ${gz(w)} = ${gz(M * w, 0)} W`] };
      const P = pk([0.25, 0.75, 1.5, 2.2, 4]);
      return { text: `Ein Motor gibt ${gz(P)} kW bei n = ${n} 1/min ab. Wie groß ist das Drehmoment?`, label: 'M', unit: 'Nm', ans: P * 1000 / w, dec: 2, steps: ['ω = 2π · n / 60', `ω = ${gz(w)} rad/s`, 'M = P / ω', `M = ${gz(P * 1000, 0)} / ${gz(w)} = ${gz(P * 1000 / w)} Nm`] };
    }
    if (kind === 'sync') {
      const f = pk([50, 50, 60, 25]), p = pk([1, 2, 3, 4]), ns = 60 * f / p;
      if (Math.random() < 0.5) return { text: `Ein Asynchronmotor hat ${p} Polpaar${p > 1 ? 'e' : ''} und läuft am Netz mit ${f} Hz. Wie groß ist die Synchrondrehzahl?`, label: 'n_s', unit: '1/min', ans: ns, dec: 0, steps: ['n_s = 60 · f / p', `n_s = 60 · ${f} / ${p} = ${gz(ns, 0)} 1/min`] };
      const sl = pk([3, 4, 5, 6]);
      return { text: `Ein Asynchronmotor mit ${p} Polpaar${p > 1 ? 'en' : ''} läuft an ${f} Hz und hat ${sl} % Schlupf. Welche Drehzahl hat die Welle?`, label: 'n', unit: '1/min', ans: ns * (1 - sl / 100), dec: 0, steps: ['n_s = 60 · f / p', `n_s = ${gz(ns, 0)} 1/min`, 'n = n_s · (1 − s)', `n = ${gz(ns, 0)} · (1 − ${gz(sl / 100, 2)}) = ${gz(ns * (1 - sl / 100), 0)} 1/min`] };
    }
    if (kind === 'pwm') {
      const U = pk([6, 12, 18, 24]), D = pk([20, 25, 40, 50, 60, 75, 80]);
      return { text: `Ein Gleichstrommotor hängt an ${U} V und wird mit PWM bei einem Tastgrad von ${D} % betrieben (Spannungsabfall am Schalter vernachlässigt). Wie groß ist die mittlere Motorspannung?`, label: 'U_m', unit: 'V', ans: U * D / 100, dec: 2, steps: ['U_m = D · U', `U_m = ${gz(D / 100, 2)} · ${U} V = ${gz(U * D / 100)} V`] };
    }
    if (kind === 'sd') {
      const I = pk([15, 21, 24, 30, 36, 45]);
      return { text: `Ein Motor zieht beim Direktanlauf im Dreieck ${I} A. Wie groß ist der Anlaufstrom bei Stern-Dreieck-Anlauf in der Sternstufe?`, label: 'I_Y', unit: 'A', ans: I / 3, dec: 1, steps: ['In Stern liegt nur U / √3 an der Wicklung, der Strom sinkt auf ein Drittel.', `I_Y = ${I} A / 3 = ${gz(I / 3)} A`] };
    }
    const U = pk([6, 12, 24]), R = pk([0.6, 1, 1.2, 2, 2.4, 4]);
    return { text: `Ein Gleichstrommotor mit R = ${gz(R, 1)} Ω Wicklungswiderstand wird an ${U} V direkt eingeschaltet. Wie groß ist der Anlaufstrom?`, label: 'I_A', unit: 'A', ans: U / R, dec: 2, steps: ['Beim Anlauf gibt es keine Gegenspannung: I_A = U / R', `I_A = ${U} V / ${gz(R, 1)} Ω = ${gz(U / R)} A`] };
  }
  function renderEx() {
    const el = $('#exBox'); if (!el) return; if (!exCur) exCur = genEx();
    el.innerHTML = `<p style="margin:0 0 8px">${esc(exCur.text)}</p><div class="frm"><label class="f"><span>${esc(exCur.label)}${exCur.unit ? ' in ' + esc(exCur.unit) : ''}</span><input id="exIn" inputmode="decimal" autocomplete="off" placeholder="Dein Ergebnis"></label></div><div id="exFb"></div>
      <div class="btns"><button class="btn pri" data-e="chk">✓ Prüfen</button><button class="btn" data-e="new">Neue Aufgabe</button></div><div class="hint2" id="exSc">${exScore.n ? exScore.ok + ' von ' + exScore.n + ' richtig' + (exScore.streak > 1 ? ' · ' + exScore.streak + ' in Folge' : '') : 'Rechne mit dem Taschenrechner oder dem Formelrechner oben. Toleranz: 2 %.'}</div>`;
  }
  function checkEx() {
    const inp = $('#exIn'), fb = $('#exFb'); if (!inp || !exCur) return; const x = parseNum(inp.value);
    if (!isFinite(x)) { fb.innerHTML = '<div class="ex bad">Bitte eine Zahl eintragen.</div>'; return; }
    const tol = Math.max(Math.abs(exCur.ans) * 0.02, 0.5 * Math.pow(10, -(exCur.dec || 0))), ok = Math.abs(x - exCur.ans) <= tol;
    if (!exCur.done) { exCur.done = true; exScore.n++; if (ok) { exScore.ok++; exScore.streak++; } else exScore.streak = 0; }
    stat('antcalc', 1, 'max');
    const F = root.LochFX; if (F) try { if (ok) { F.sound('ding'); if (exScore.streak % 5 === 0) { F.say(exScore.streak + ' in Folge!'); F.confetti(false); } } else F.sound('buzz', 0.4); } catch (e) {}
    fb.innerHTML = `<div class="ex ${ok ? 'ok' : 'bad'}"><b>${ok ? '✓ Richtig!' : '✗ Nicht ganz.'}</b> ${ok ? '' : 'Richtig wäre ' + gz(exCur.ans, exCur.dec) + (exCur.unit ? ' ' + esc(exCur.unit) : '') + '.'}<ol style="margin:6px 0 0;padding-left:20px;color:var(--mute);font-size:13.5px">${exCur.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>`;
    $('#exSc').textContent = exScore.ok + ' von ' + exScore.n + ' richtig' + (exScore.streak > 1 ? ' · ' + exScore.streak + ' in Folge' : '');
  }
  (function () {
    const V = $('#calcView');
    V.addEventListener('click', e => {
      const c = e.target.closest('[data-c]'), x = e.target.closest('[data-e]');
      if (c) { calcId = c.dataset.c; renderCalc(); }
      else if (x) { if (x.dataset.e === 'new') { exCur = genEx(); renderEx(); } else checkEx(); }
    });
    V.addEventListener('input', e => { const i = e.target.closest('#cForm input'); if (!i) return; calcVals[calcId][i.dataset.k] = i.value; calcOut(); stat('antcalc', 1, 'max'); });
    V.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'exIn') { e.preventDefault(); checkEx(); } });
  })();

  /* ============================================================ Lernen */
  const SV = (inner, label) => `<svg class="dr" viewBox="0 0 360 200" role="img" aria-label="${esc(label)}">${inner}</svg>`;
  const TX = (x, y, t, o) => `<text x="${x}" y="${y}" fill="${(o && o.c) || '#e8ecf0'}" font-size="${(o && o.s) || 12}" text-anchor="${(o && o.a) || 'middle'}" font-family="system-ui"${o && o.w ? ' font-weight="700"' : ''}>${esc(t)}</text>`;
  function svgBridge() {
    const sw = (x, y, n, on) => `<rect x="${x - 14}" y="${y}" width="28" height="34" rx="4" fill="${on ? '#1f5f2c' : '#2c343e'}" stroke="${on ? '#4cd964' : '#8d99a6'}" stroke-width="1.6"/>${TX(x, y + 22, n, { s: 12, w: 1 })}`;
    return SV(`<g stroke="#8d99a6" stroke-width="2" fill="none"><path d="M60 20H300M100 20V46M100 80V120M100 154V180M260 20V46M260 80V120M260 154V180M60 180H300M100 100H154M206 100H260"/></g>
      <path d="M100 20V100H154M206 100H260V180" stroke="#ffb340" stroke-width="3" fill="none" stroke-dasharray="6 5"/>
      ${sw(100, 46, 'S1', true)}${sw(100, 120, 'S2', false)}${sw(260, 46, 'S3', false)}${sw(260, 120, 'S4', true)}
      <circle cx="180" cy="100" r="26" fill="#222830" stroke="#3b9eff" stroke-width="2.4"/>${TX(180, 106, 'M', { s: 18, w: 1 })}${TX(52, 24, '+U', { a: 'end', w: 1, c: '#ff8a7a' })}${TX(52, 184, '0 V', { a: 'end', w: 1 })}${TX(180, 14, 'S1 + S4 geschlossen: Motor dreht vorwärts', { s: 11, c: '#ffb340' })}`, 'H-Brücke mit vier Schaltern und Motor');
  }
  function svgPwm() {
    let s = '';[25, 50, 75].forEach((D, r) => {
      const y0 = 44 + r * 56, h = 28, per = 100, x0 = 70; let d = `M${x0},${y0}`;
      for (let k = 0; k < 3; k++) { const a = x0 + k * per, w = per * D / 100; d += `L${a},${y0 - h}L${a + w},${y0 - h}L${a + w},${y0}L${a + per},${y0}`; }
      s += `<path d="${d}" fill="none" stroke="#4cd964" stroke-width="2.2"/><path d="M${x0},${y0 - h * D / 100}H${x0 + 3 * per}" stroke="#ffb340" stroke-width="1.6" stroke-dasharray="5 4"/>${TX(62, y0 - 8, 'D = ' + D + ' %', { a: 'end', s: 11 })}`;
    });
    return SV(s + TX(340, 62, 'Mittelwert', { a: 'end', c: '#ffb340', s: 10 }) + TX(220, 196, 'Zeit (3 Perioden)', { c: '#8d99a6', s: 10 }), 'PWM-Signale mit 25, 50 und 75 Prozent Tastgrad');
  }
  function svgServo() {
    let s = '';[[0.5, '−90°'], [1.5, '0° (Mitte)'], [2.5, '+90°']].forEach(([ms, a], r) => {
      const y0 = 50 + r * 56, h = 24, k = 14, x0 = 50, T2 = 20 * k;
      s += `<path d="M${x0},${y0}H${x0 + 10}V${y0 - h}H${x0 + 10 + ms * k}V${y0}H${x0 + T2}V${y0 - h}H${x0 + T2 + 0}" fill="none" stroke="#3b9eff" stroke-width="2.2"/>${TX(x0 + 10 + ms * k / 2, y0 - h - 4, ms.toString().replace('.', ',') + ' ms', { s: 10 })}${TX(x0 + T2 + 16, y0 - 6, a, { a: 'start', s: 11, c: '#ffb340', w: 1 })}`;
    });
    return SV(s + `<path d="M60 176H${50 + 20 * 14}" stroke="#8d99a6" stroke-width="1.2"/>${TX(190, 192, 'Periode 20 ms', { c: '#8d99a6', s: 10 })}`, 'Servo-Impulse mit 0,5, 1,5 und 2,5 Millisekunden');
  }
  function svgStepper() {
    const coil = (x, y, n) => `<rect x="${x - 26}" y="${y - 14}" width="52" height="28" rx="5" fill="#2c343e" stroke="#ffb340" stroke-width="1.8"/>${TX(x, y + 5, n, { w: 1 })}`;
    return SV(`<circle cx="180" cy="100" r="46" fill="#222830" stroke="#8d99a6" stroke-width="2"/><path d="M180 100V60" stroke="#ff5c5c" stroke-width="6" stroke-linecap="round"/><path d="M180 100V140" stroke="#3b9eff" stroke-width="6" stroke-linecap="round"/>${TX(180, 52, 'N', { c: '#ff8a7a', w: 1 })}${TX(180, 156, 'S', { c: '#7fbaff', w: 1 })}
      ${coil(180, 22, 'A1')}${coil(180, 178, 'A2')}${coil(278, 100, 'B1')}${coil(82, 100, 'B2')}<path d="M180 36V54M180 164V146M252 100H226M108 100H134" stroke="#ffb340" stroke-width="2"/>${TX(330, 100, '1,8° je Schritt', { a: 'end', s: 11, c: '#8d99a6' })}`, 'Schrittmotor mit vier Spulen und Rotor');
  }
  function svgSine() {
    let s = '<path d="M30 100H340" stroke="#4a5663"/>';
    [['L1', '#ffb340', 0], ['L2', '#4cd964', -120], ['L3', '#3b9eff', -240]].forEach(([n, c, ph]) => {
      let d = ''; for (let x = 0; x <= 300; x += 3) { const a = x / 300 * 360 + ph, y = 100 - 60 * Math.sin(a * Math.PI / 180); d += (x ? 'L' : 'M') + (35 + x) + ',' + y.toFixed(1); }
      s += `<path d="${d}" fill="none" stroke="${c}" stroke-width="2.2"/>${TX(340, 100 - 60 * Math.sin(ph * Math.PI / 180) + (n === 'L1' ? 16 : 0), n, { c, w: 1, a: 'end' })}`;
    });
    return SV(s + TX(185, 192, 'eine Periode (360°): drei Spannungen, je 120° versetzt', { s: 10, c: '#8d99a6' }), 'Drei um 120 Grad versetzte Sinusspannungen');
  }
  function svgStarDelta() {
    const board = (ox, star) => {
      const top = ['U1', 'V1', 'W1'], bot = ['W2', 'U2', 'V2'], xs = [ox + 20, ox + 70, ox + 120]; let s = '';
      xs.forEach((x, i) => { s += `<circle cx="${x}" cy="50" r="9" fill="#2c343e" stroke="#8d99a6" stroke-width="2"/>${TX(x, 36, top[i], { s: 11 })}<circle cx="${x}" cy="110" r="9" fill="#2c343e" stroke="#8d99a6" stroke-width="2"/>${TX(x, 136, bot[i], { s: 11 })}`; });
      if (star) s += `<path d="M${xs[0]} 110H${xs[2]}" fill="none" stroke="#ffb340" stroke-width="6" stroke-linecap="round"/>`;
      else xs.forEach(x => { s += `<path d="M${x} 59V101" stroke="#ffb340" stroke-width="5" stroke-linecap="round"/>`; });
      return s + TX(ox + 70, 20, star ? 'Stern (Y)' : 'Dreieck (Δ)', { w: 1, s: 13 }) + TX(ox + 70, 182, star ? 'Brücken unten: Wicklungsenden verbunden' : 'Brücken senkrecht: Ring aus drei Wicklungen', { s: 9.5, c: '#8d99a6' });
    };
    return SV(board(15, true) + board(195, false), 'Klemmenbrett in Stern- und Dreieckschaltung');
  }
  function svgFu() {
    const bx = (x, w, t, c) => `<rect x="${x}" y="70" width="${w}" height="60" rx="6" fill="#2c343e" stroke="${c || '#8d99a6'}" stroke-width="1.8"/>${t.map((l, i) => TX(x + w / 2, 96 + i * 14, l, { s: 10.5 })).join('')}`;
    return SV(`${bx(8, 62, ['Netz', '3~ 400 V', '50 Hz'])}${bx(88, 66, ['Gleich-', 'richter'], '#3b9eff')}${bx(172, 62, ['Zwischen-', 'kreis', '(Elko)'], '#ffb340')}${bx(252, 56, ['Wechsel-', 'richter'], '#4cd964')}<circle cx="338" cy="100" r="18" fill="#222830" stroke="#8d99a6" stroke-width="2"/>${TX(338, 105, 'M', { w: 1, s: 14 })}
      <g stroke="#8d99a6" stroke-width="2" fill="none"><path d="M70 100H88M154 100H172M234 100H252M308 100H320"/></g>${TX(180, 40, 'wechselnde Frequenz und Spannung', { c: '#4cd964', s: 11 })}${TX(180, 160, 'Gleichspannung (geglättet)', { c: '#ffb340', s: 11 })}`, 'Blockschaltbild eines Frequenzumrichters');
  }
  function svgUf() {
    return SV(`<path d="M50 160H330M50 160V30" stroke="#8d99a6" stroke-width="1.5" fill="none"/><path d="M50 140L220 50H320" stroke="#4cd964" stroke-width="2.6" fill="none"/><path d="M50 160L220 50" stroke="#8d99a6" stroke-width="1" stroke-dasharray="4 4" fill="none"/>
      ${TX(220, 176, '50 Hz', { s: 11 })}${TX(320, 176, 'f (87 Hz)', { s: 11, a: 'end' })}${TX(46, 54, '400 V', { a: 'end', s: 11 })}${TX(46, 34, 'U', { a: 'end', w: 1 })}${TX(70, 126, 'Boost', { c: '#ffb340', s: 10, a: 'start' })}${TX(136, 80, 'U/f konstant', { c: '#4cd964', s: 11, a: 'end' })}${TX(285, 40, 'Feldschwächung', { c: '#ff8a7a', s: 10 })}`, 'U-f-Kennlinie: Spannung steigt mit der Frequenz bis 50 Hz');
  }
  function gearPath(cx, cy, r, z, rot) {
    const ro = r + 7, ri = r - 6, pts = [];
    for (let i = 0; i < z; i++) { const a = rot + i * TP / z, w = TP / z; [[0, ri], [0.15, ro], [0.5, ro], [0.65, ri]].forEach(([f, rr]) => pts.push([cx + Math.cos(a + w * f) * rr, cy + Math.sin(a + w * f) * rr])); }
    return 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z';
  }
  function svgGear() {
    return SV(`<path d="${gearPath(110, 110, 40, 10, 0)}" fill="#2c343e" stroke="#3b9eff" stroke-width="2"/><circle cx="110" cy="110" r="9" fill="#14181c" stroke="#8d99a6"/>
      <path d="${gearPath(110 + 40 + 80 + 1, 110, 80, 20, Math.PI / 20)}" fill="#2c343e" stroke="#4cd964" stroke-width="2"/><circle cx="231" cy="110" r="9" fill="#14181c" stroke="#8d99a6"/>
      ${TX(110, 40, 'z1 = 10 (Antrieb)', { s: 10.5 })}${TX(250, 22, 'z2 = 20 (Abtrieb)', { s: 10.5 })}${TX(110, 176, '↻ schnell', { c: '#7fbaff', s: 11 })}${TX(250, 176, '↺ halb so schnell', { c: '#4cd964', s: 11 })}${TX(180, 196, 'i = z2 / z1 = 2, Drehrichtung kehrt sich um', { s: 10, c: '#8d99a6' })}`, 'Zwei ineinandergreifende Zahnräder, Übersetzung 2');
  }
  function svgPlate() {
    const row = (y, a, b) => TX(30, y, a, { a: 'start', s: 11, c: '#cfd6dd' }) + TX(336, y, b, { a: 'end', s: 11, c: '#e8ecf0', w: 1 });
    return SV(`<rect x="12" y="8" width="336" height="184" rx="10" fill="#3b4652" stroke="#8d99a6" stroke-width="2"/>${TX(180, 28, 'Drehstrom-Asynchronmotor  3~', { w: 1, s: 12 })}<path d="M24 36H336" stroke="#8d99a6"/>
      ${row(54, 'Δ/Y   Spannung U', '400 / 690 V')}${row(72, 'Strom I', '3,4 / 2,0 A')}${row(90, 'Leistung P (Welle)', '1,5 kW')}${row(108, 'Leistungsfaktor', 'cos φ 0,80')}${row(126, 'Drehzahl n', '1420 1/min')}${row(144, 'Frequenz f', '50 Hz')}${row(162, 'Schutzart / Betrieb', 'IP55  S1')}${row(180, 'Isolierstoffklasse', 'F')}`, 'Typenschild eines Drehstrommotors');
  }
  function svgSafety() {
    return SV(`<path d="M90 24L150 128H30Z" fill="#ffb340" stroke="#222830" stroke-width="3" stroke-linejoin="round"/><path d="M96 56L82 90H98L90 112L108 78H92L100 56Z" fill="#222830"/>${TX(90, 150, 'Warnung vor', { s: 10.5 })}${TX(90, 164, 'elektrischer Spannung', { s: 10.5 })}
      <rect x="205" y="30" width="130" height="130" rx="10" fill="#ffd23c" stroke="#222830" stroke-width="3"/><circle cx="270" cy="95" r="42" fill="#d82222" stroke="#7a1010" stroke-width="5"/>${TX(270, 100, 'NOT-HALT', { w: 1, s: 12 })}${TX(270, 182, 'Not-Halt-Taster', { s: 10.5 })}`, 'Warnschild Elektrizität und Not-Halt-Taster');
  }
  const LEARN = [
    { t: 'Gleichstrommotor und H-Brücke', ex: 'dc-hbridge', exT: 'H-Brücke ausprobieren', open: true, h: () => `<p>Ein Gleichstrommotor dreht, sobald Spannung an der Wicklung liegt. Das <b>Drehmoment</b> ist ungefähr proportional zum <b>Strom</b>, die <b>Leerlaufdrehzahl</b> ungefähr proportional zur <b>Spannung</b>.</p>
      <p>Beim Einschalten steht der Anker still und erzeugt noch keine Gegenspannung. Dann begrenzt nur der Wicklungswiderstand den Strom: <b>I<sub>A</sub> = U / R</b>. Mit der Drehzahl entsteht eine Gegenspannung, der Strom sinkt.</p>
      <p>Die Drehrichtung ändert sich, wenn du die Spannung umpolst. Das macht eine <b>H-Brücke</b> aus vier Schaltern (meist MOSFETs):</p>${svgBridge()}
      <table><tr><th>Zustand</th><th>Schalter</th><th>Wirkung</th></tr><tr><td>vorwärts</td><td>S1 und S4</td><td>Strom von links oben nach rechts unten</td></tr><tr><td>rückwärts</td><td>S3 und S2</td><td>Strom in Gegenrichtung</td></tr><tr><td>Bremsen</td><td>S2 und S4 (beide unten)</td><td>Wicklung kurzgeschlossen, Motor bremst als Generator</td></tr><tr><td>Freilauf</td><td>alle aus</td><td>Motor trudelt aus</td></tr><tr><td><b>Kurzschluss</b></td><td>S1 und S2 oder S3 und S4</td><td><b>Verboten!</b> Das Netzteil wird kurzgeschlossen</td></tr></table>
      <p>Beim Umschalten braucht man eine kleine <b>Totzeit</b>, in der beide Schalter einer Seite aus sind. <b>Freilaufdioden</b> nehmen den Strom der Motorinduktivität beim Abschalten auf.</p>` },
    { t: 'PWM: Drehzahl stellen mit Pulsweite', ex: 'dc-ramp', exT: 'Rampe ansehen', h: () => `<p>Statt die Spannung herunterzuregeln (das verheizt Leistung), schaltet man sie schnell ein und aus. Das Verhältnis von Einschaltzeit zur Periode heißt <b>Tastgrad D = t<sub>ein</sub> / T</b>. Der Motor sieht im Mittel <b>U<sub>m</sub> = D · U</b>.</p>${svgPwm()}
      <p>Die <b>Frequenz</b> ist ein Kompromiss: Der Motor glättet den Strom mit seiner Induktivität, je höher die Frequenz, desto kleiner die Stromwelligkeit. Unter etwa 16 bis 20 kHz hört man ein Pfeifen. Sehr hohe Frequenzen erhöhen aber die Schaltverluste. Üblich sind 1 bis 20 kHz.</p>
      <p>Jeder Schalter der Brücke hat einen kleinen Spannungsabfall (hier 0,2 V), der die wirksame Spannung etwas verringert. Bei kleinem Tastgrad dreht der Motor wegen Reibung oft gar nicht erst an.</p>` },
    { t: 'Servo und Lageregelung', ex: 'servo-pid', exT: 'Sprungantwort ansehen', h: () => `<p>Ein Modellbau-Servo enthält Motor, Getriebe, Poti als Lagesensor und Regelelektronik. Alle <b>20 ms</b> bekommt er einen Impuls, dessen <b>Breite</b> den Winkel vorgibt. Im Lab gilt: 0,5 ms = −90°, 1,5 ms = Mitte, 2,5 ms = +90° (viele echte Servos nutzen etwa 1 bis 2 ms).</p>${svgServo()}
      <p>Die Regelung vergleicht Sollwinkel und Istwinkel: <b>Regelabweichung = Soll − Ist</b>. Der <b>P-Anteil</b> reagiert proportional (schnell, lässt unter Last aber eine Restabweichung). Der <b>I-Anteil</b> beseitigt die Restabweichung, kann aber überschwingen. Der <b>D-Anteil</b> dämpft. Zu großes <b>k<sub>p</sub></b> führt zum Schwingen.</p>
      <p>Wichtige Kenngrößen der Sprungantwort sind das <b>Überschwingen</b> (in Prozent des Sprungs) und die <b>Ausregelzeit</b>.</p>` },
    { t: 'Schrittmotor', ex: 'step-full', exT: 'Schrittmotor laufen lassen', h: () => `<p>Ein Schrittmotor dreht sich bei jedem Ansteuerimpuls um einen festen Winkel. Hier: <b>1,8° je Schritt</b>, also <b>200 Schritte pro Umdrehung</b>. Im Halbschritt sind es 0,9° (400 Schritte).</p>${svgStepper()}
      <p>Die Spulen werden nacheinander bestromt (Spulenfolge A1, B1, A2, B2). Muster als 4-Bit-Tabelle:</p>
      <table><tr><th>Betrieb</th><th>Folge (A1 B1 A2 B2)</th></tr><tr><td>Wave-Drive</td><td>1000, 0100, 0010, 0001</td></tr><tr><td>Vollschritt</td><td>1100, 0110, 0011, 1001</td></tr><tr><td>Halbschritt</td><td>1000, 1100, 0100, 0110, 0010, 0011, 0001, 1001</td></tr></table>
      <p>Drehzahl im Vollschritt: <b>n = f · 60 / 200</b> (100 Schritte/s ergeben 30 1/min). Ein Schrittmotor läuft <b>gesteuert</b>, nicht geregelt: Reicht das Moment nicht, gehen <b>Schritte verloren</b>, ohne dass es jemand merkt. Das verfügbare Moment <b>fällt mit der Schrittfrequenz</b>. Deshalb beschleunigt man mit einer Rampe. Bei manchen Frequenzen tritt <b>Resonanz</b> auf (Dröhnen). Im Stillstand fließt weiter Haltestrom, der Motor wird warm.</p>` },
    { t: 'Drehstrom und Stern-Dreieck-Anlauf', ex: 'ac-sd', exT: 'Stern-Dreieck-Anlauf ansehen', h: () => `<p>Drei Wechselspannungen, gegeneinander um 120° versetzt, erzeugen in der Motorwicklung ein <b>Drehfeld</b>.</p>${svgSine()}
      <p>Beim <b>Asynchronmotor</b> dreht der Läufer etwas langsamer als das Feld. Der Unterschied heißt <b>Schlupf s = (n<sub>s</sub> − n) / n<sub>s</sub></b>. Die Synchrondrehzahl ist <b>n<sub>s</sub> = 60 · f / p</b> (bei 50 Hz und 2 Polpaaren 1500 1/min, die Wellendrehzahl liegt dann bei etwa 1420 bis 1450 1/min).</p>
      <p>Beim <b>Direktanlauf</b> fließt etwa der 5- bis 8-fache Nennstrom. Beim <b>Stern-Dreieck-Anlauf</b> startet der Motor in Stern: Jede Wicklung bekommt nur U/√3 (statt 400 V etwa 230 V), <b>Strom und Moment sinken auf ein Drittel</b>. Nach dem Hochlauf wird auf Dreieck umgeschaltet. Das geht nur, wenn der Motor im Dreieck für die Netzspannung gebaut ist (Typenschild 400/690 V Δ/Y am 400-V-Netz).</p>${svgStarDelta()}
      <p>Die Schütze: <b>K1</b> Netz, <b>K2</b> Stern, <b>K3</b> Dreieck. <b>K2 und K3 dürfen nie gleichzeitig an sein</b> (Kurzschluss), deshalb gibt es eine Verriegelung und eine kurze Pause. Wird die Last größer als das <b>Kippmoment</b>, bleibt der Motor stehen, brummt und wird sehr heiß.</p>` },
    { t: 'Frequenzumrichter', ex: 'ac-fu', exT: 'FU-Rampe ansehen', h: () => `<p>Ein Frequenzumrichter erzeugt aus dem Netz eine Drehstromspannung mit <b>einstellbarer Frequenz</b>. Dazu wird gleichgerichtet, im <b>Zwischenkreis</b> geglättet und vom Wechselrichter per PWM wieder in Drehstrom verwandelt.</p>${svgFu()}
      <p>Die Drehzahl folgt der Frequenz: n<sub>s</sub> = 60 · f / p. Damit das Magnetfeld im Motor gleich bleibt, führt der Umrichter die Spannung mit der Frequenz mit (<b>U/f konstant</b>) bis zur <b>Eckfrequenz</b> (meist 50 Hz bei 400 V). Darüber bleibt die Spannung gleich (<b>Feldschwächung</b>), das Moment sinkt.</p>${svgUf()}
      <p>Bei kleinen Frequenzen hebt ein <b>Boost</b> die Spannung etwas an, weil der Spannungsfall an der Wicklung sonst zu viel ausmacht. Für Lüfter und Pumpen nimmt man oft eine <b>quadratische</b> Kennlinie. Mit der <b>Hochlaufzeit</b> (Rampe) läuft der Motor sanft an, ohne Stromstoß. Die Drehrichtung wechselst du über die Phasenfolge.</p>` },
    { t: 'Getriebe', ex: 'gear-spur', exT: 'Stirnradpaar ausprobieren', h: () => `<p>Die <b>Übersetzung</b> ist <b>i = z<sub>2</sub> / z<sub>1</sub> = n<sub>ein</sub> / n<sub>aus</sub></b> (Zähne des Abtriebsrads geteilt durch Zähne des Antriebsrads). Bei i größer als 1 sinkt die Drehzahl, das Moment steigt:</p>${svgGear()}
      <p><b>n<sub>aus</sub> = n<sub>ein</sub> / i</b> und <b>M<sub>aus</sub> = M<sub>ein</sub> · i · η</b>. Die Leistung bleibt bis auf die Verluste gleich: P<sub>aus</sub> = P<sub>ein</sub> · η. Bei mehreren Stufen multiplizierst du die Übersetzungen und die Wirkungsgrade.</p>
      <table><tr><th>Bauart</th><th>Wirkungsgrad (Richtwert)</th><th>Besonderheit</th></tr><tr><td>Stirnrad</td><td>etwa 0,95 bis 0,98 je Stufe</td><td>kehrt die Drehrichtung um</td></tr><tr><td>Riemen</td><td>etwa 0,95</td><td>keine Umkehr, leise, rutscht bei Überlast</td></tr><tr><td>Schnecke</td><td>deutlich niedriger, oft 0,4 bis 0,9</td><td>große Untersetzung, bei kleiner Steigung selbsthemmend</td></tr></table>
      <p>Die Verluste werden zu <b>Wärme</b>. Ohne <b>Schmierung</b> steigen Reibung und Temperatur. Überschreitet das Abtriebsmoment das Grenzmoment, bricht ein Zahn.</p>` },
    { t: 'Typenschild lesen', ex: 'calc-ts', exT: 'In den Rechner laden', h: () => `<p>Das Typenschild nennt die Nennwerte des Motors. Wichtig ist: <b>P ist die abgegebene mechanische Leistung an der Welle</b>, nicht die aufgenommene.</p>${svgPlate()}
      <p><b>400/690 V Δ/Y</b> heißt: Am 400-V-Netz wird der Motor im <b>Dreieck</b> geschaltet (Wicklung bekommt 400 V), an 690 V in Stern. Zu jeder Schaltung gehört ein Nennstrom (3,4 A im Dreieck).</p>
      <p>Aus den Angaben rechnest du:</p><ol><li><b>aufgenommene Leistung</b> P<sub>zu</sub> = √3 · U · I · cos φ = 1,732 · 400 V · 3,4 A · 0,80 ≈ 1884 W</li><li><b>Wirkungsgrad</b> η = P / P<sub>zu</sub> = 1500 W / 1884 W ≈ 0,80 (80 %)</li><li><b>Nennmoment</b> M = P / ω = 1500 W / 148,7 rad/s ≈ 10,1 Nm</li><li><b>Polpaare</b>: n = 1420 liegt knapp unter 1500, also p = 2 (n<sub>s</sub> = 1500 1/min)</li><li><b>Schlupf</b> s = (1500 − 1420) / 1500 ≈ 5,3 %</li></ol><p>Außerdem steht auf dem Schild die <b>Schutzart</b> (IP55: staub- und strahlwassergeschützt), die <b>Isolierstoffklasse</b> (F: bis 155 °C) und die Betriebsart (S1: Dauerbetrieb).</p>` },
    { t: 'Sicherheit an Antrieben', ex: 'ac-k2k3', exT: 'Fehlerbeispiel: K2 und K3 zugleich', h: () => `${svgSafety()}<p>Antriebe sind gefährlich: Sie haben Spannung, Kraft und drehende Teile. Halte dich an diese Regeln:</p>
      <ul><li><b>Fünf Sicherheitsregeln</b> vor Arbeiten an elektrischen Anlagen: Freischalten, gegen Wiedereinschalten sichern, Spannungsfreiheit allpolig feststellen, erden und kurzschließen, benachbarte unter Spannung stehende Teile abdecken oder abschranken.</li>
      <li><b>Frequenzumrichter:</b> Die Kondensatoren im Zwischenkreis bleiben nach dem Abschalten noch geladen. Warte die vom Hersteller angegebene Entladezeit ab (oft mehrere Minuten) und miss nach.</li>
      <li><b>Drehende Teile:</b> Einzugsgefahr durch Wellen, Riemen und Zahnräder. Keine lose Kleidung, lange Haare zusammenbinden, Schutzhauben nicht entfernen.</li>
      <li><b>Not-Halt</b> muss immer erreichbar sein und nach dem Auslösen bewusst quittiert werden. Ein Motor darf nach einem Spannungsausfall nicht von allein wieder anlaufen, wenn dadurch jemand gefährdet wird.</li>
      <li><b>Verriegelung:</b> Bei Stern-Dreieck dürfen K2 und K3 nie gleichzeitig schließen, bei der H-Brücke nie beide Schalter einer Seite.</li>
      <li><b>Heiße Oberflächen:</b> Motoren und Getriebe können weit über 60 °C warm werden. Ein <b>Motorschutzschalter</b> oder Temperaturfühler (Kaltleiter) schützt vor Überlast.</li>
      <li><b>Lasten:</b> Hängende Lasten fallen herunter, wenn der Motor stromlos wird. Dafür gibt es Haltebremsen.</li></ul>` }
  ];
  let helpDone = false;
  function renderHelp() {
    const V = $('#helpView'); if (helpDone) return; helpDone = true;
    V.innerHTML = `<p class="big">Lernen und Hilfe</p><p class="hint2" style="margin:0 0 12px">Kurz erklärt, was du zu Antrieben wissen musst. Mit „Beispiel laden“ landest du direkt am passenden Prüfstand.</p>` +
      LEARN.map((s, i) => `<details${s.open ? ' open' : ''}><summary>${i + 1} · ${esc(s.t)}</summary><div class="hb2">${s.h()}<div class="tryit"><button class="chip s on" data-lx="${i}">▶ ${esc(s.exT)}</button></div></div></details>`).join('') +
      `<details><summary>${LEARN.length + 1} · Tastenkürzel</summary><div class="hb2">${keysHtml()}</div></details>`;
  }
  $('#helpView').addEventListener('click', e => {
    const b = e.target.closest('[data-lx]'); if (!b) return; const s = LEARN[+b.dataset.lx];
    if (s.ex === 'calc-ts') { calcId = 'ts'; setTab('calc'); stat('antcalc', 1, 'max'); return; }
    const ex = BUILTIN.find(x => x.id === s.ex); if (ex) loadExample(Object.assign({}, ex, { rows: ex.rows ? clone(ex.rows) : null }));
  });
  function keysHtml() {
    const k = (a, t) => `<tr><td style="white-space:nowrap"><code>${a}</code></td><td>${t}</td></tr>`;
    return '<table>' + k('Eingabe oder F5', 'Prüfstand starten und anhalten') + k('Leertaste', 'Starten und anhalten') + k('Z', 'Prüfstand zurücksetzen (Reset)') + k('1 bis 4', 'Zeitraffer ×0,5 / ×1 / ×2 / ×5') + k('E', 'Effekte und Ton ein oder aus') + k('Strg + S', 'Versuch speichern') + k('?', 'Diese Übersicht') + '</table><p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>';
  }

  /* ============================================================ Oberfläche: Kopf, Tabs, Leiste */
  const TABS = [['rig', '⚙️', 'Prüfstand'], ['curves', '📈', 'Kennlinien'], ['seq', '⏱️', 'Ablauf'], ['calc', '🧮', 'Rechnen'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Lernen']];
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd" style="display:none"></span>' : ''}</button>`).join('');
    updateTaskBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'rig'; const prev = S.tab; S.tab = t; lsPut('ant.tab', t);
    $('#mid').dataset.tab = t; $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'curves') renderCurves(); else if (t === 'seq') renderSeq(); else if (t === 'calc') renderCalc(); else if (t === 'tasks') renderTasks(); else if (t === 'help') renderHelp();
    updateChrome();
    requestAnimationFrame(() => { fitCanvas(); updateMeters(0, true); if (t === 'curves') drawCharts(true); if (t === 'seq') drawSeqChart(); });
    if (prev !== t && t === 'seq') renderSeqLive();
  }
  function updateTitle() {
    const nm = S.rig ? rigName(S.rigId) : rigName(S.rigId || 'gleichstrom');
    $('#title').innerHTML = esc(S.name) + (S.dirty ? ' •' : '') + '\n<small>' + esc(nm) + (S.attrappe ? ' (Notfall-Attrappe)' : '') + (S.running ? ' · läuft' : '') + '</small>';
    document.title = 'Antriebs-Lab: ' + S.name;
    const tag = $('#cvTag'); if (tag) { tag.textContent = S.running ? '' : '⏸ Pause'; tag.style.display = S.running ? 'none' : ''; }
  }
  $('#title').onclick = async () => { const r = await ask('Name des Versuchs', [{ key: 'n', label: 'Name', type: 'text', value: S.name }]); if (r && r.n.trim()) { S.name = r.n.trim(); S.dirty = true; updateChrome(); saveCurSoon(); } };

  let palSig = '';
  function buildPal() {
    const fxOn2 = fxOn(), sig = [S.running, S.speed, S.digital, fxOn2, !!S.rig, !!S.live].join('|');
    if (sig === palSig) return; palSig = sig;
    const sp = [0.5, 1, 2, 5], F = !!root.LochFX;
    $('#pal').innerHTML = `<button class="chip ${S.running ? 'on' : 'go'}" data-a="run" aria-label="${S.running ? 'Stopp' : 'Start'}">${S.running ? '⏸ Pause' : '▶ Start'}</button><button class="chip" data-a="reset" aria-label="Zurücksetzen">⟲ Reset</button><span class="sep"></span>
      <span class="seg" aria-label="Zeitraffer">${sp.map(v => `<button data-sp="${v}" class="${S.speed === v ? 'on' : ''}">×${String(v).replace('.', ',')}</button>`).join('')}</span><span class="sep"></span>
      <button class="chip ${S.digital ? 'on' : ''}" data-a="dig" aria-pressed="${S.digital}" title="Messgeräte als Zeiger oder Zahlen">${S.digital ? '🔢 Zahlen' : '🎯 Zeiger'}</button>${F ? `<button class="chip ${fxOn2 ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn2}" aria-label="Effekte und Ton" title="Effekte und Ton">${fxOn2 ? '🎉' : '🔇'} Effekte</button>` : ''}
      <span id="stat"></span>`;
    const r = $('#bRun'); r.textContent = S.running ? '⏸' : '▶'; r.classList.toggle('on', S.running); r.setAttribute('aria-label', S.running ? 'Pause' : 'Start');
    updateStat();
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sp) setSpeed(+b.dataset.sp);
    else if (b.dataset.a === 'run') setRun(!S.running); else if (b.dataset.a === 'reset') resetRig();
    else if (b.dataset.a === 'dig') { S.digital = !S.digital; lsPut('ant.digital', S.digital ? '1' : '0'); buildMeters(); updateMeters(0, true); updateChrome(); }
    else if (b.dataset.a === 'fx') toggleFx();
  });
  function updateChrome() { updateTitle(); buildPal(); updateTaskBar(); }
  $('#bRun').onclick = () => setRun(!S.running);
  $('#bEx').onclick = openExamples; $('#bOpen').onclick = openList; $('#bTasks').onclick = () => setTab('tasks'); $('#bShare').onclick = shareNow; $('#bPrint').onclick = printNow;

  /* ============================================================ Menü */
  function openMenu() {
    const nT = (TK() || []).length;
    const rows = [
      ['tasks', 'Aufgaben', nT ? nT + ' Aufgaben mit automatischer Prüfung' : 'Aufgaben folgen'], ['new', 'Neuer Versuch', 'Prüfstand wählen und von vorn beginnen'], ['ex', 'Beispielversuche', exampleList().length + ' Versuche zum Ausprobieren'],
      ['open', 'Öffnen', 'Gespeicherte Versuche auf diesem Gerät'], ['save', 'Speichern unter …', S.name], ['share', 'Teilen', 'Link zum Weitergeben (Versuch steckt im Link)'], ['import', 'Aus Code oder Link laden', 'Geteilten Versuch einfügen'],
      ['fx', 'Effekte und Ton: ' + (fxOn() ? 'an' : 'aus'), 'Funken, Sprechblasen, Konfetti und lustige Töne ein- oder ausschalten'], ['png', 'Prüfstandbild speichern (PNG)', 'Aktuelle Ansicht als Bilddatei'], ['csv', 'Aufzeichnung als CSV', 'Zeitschreiber-Daten für Excel'], ['print', 'Drucken', 'Einstellungen, Messwerte und Prüfstandbild'], ['calc', 'Taschenrechner', 'Ohm, Farbcode, Leitung und mehr'],
      ['abz', 'Abzeichen', 'Deine Sammlung und was noch fehlt'], ['kamp', 'Kampagne: Das Abschlussgerät', 'Lernpfad mit Geschichte über alle Labs'], ['trainer', 'Trainer: Erste Schritte', 'Kurze Einführung zum Mitmachen'],
      ['neu', 'Neu in dieser Version', 'Was zuletzt dazukam und wo du es findest'], ['erg', 'Ergebnis senden', 'Code für den Ausbilder: meine bearbeiteten Aufgaben'], ['keys', 'Tastenkürzel', 'Alle Tasten (Taste ? drücken)'], ['help', 'Hilfe und Lernen', 'Grundlagen kurz erklärt'], ['start', 'Zur Startseite', '']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${r[1]}</b>${r[2] ? `<small>${esc(r[2])}</small>` : ''}</div></button>`).join('');
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
      case 'share': shareNow(); break; case 'import': importSheet(); break; case 'fx': toggleFx(); break; case 'png': exportPng(); break; case 'csv': exportCsv(); break;
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
    if (mod) { if (k.toLowerCase() === 's') { e.preventDefault(); doSave(); } return; }
    const l = k.toLowerCase();
    if (k === ' ' && (e.target === document.body || e.target.tagName === 'CANVAS')) { e.preventDefault(); setRun(!S.running); }
    else if (l === 'z') resetRig(); else if (l === 'e') toggleFx();
    else if (k >= '1' && k <= '4') setSpeed([0.5, 1, 2, 5][+k - 1]);
  });

  /* ============================================================ Hauptschleife */
  let last = 0, lastUI = 0, lastCh = 0, lastSq = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = ts; return; }
    const dt = Math.min(100, ts - (last || ts)); last = ts;
    if (S.running && S.rig) {
      try { simAdvance(dt * S.speed); }
      catch (e) { S.running = false; S.live = null; console.error('Simulation:', e); toast('Der Prüfstand hat einen Rechenfehler gemeldet und wurde angehalten.'); updateChrome(); }
    }
    if (S.rig) watchEvents(ts);
    if (S.tab === 'rig') {
      drawRig(ts); updateMeters(dt);
      if (ts - lastUI > 100) {
        lastUI = ts; syncCtl(); updateStat();
        const fb = $('#cvFault'), on = performance.now() < (S.faultUntil || 0);
        if (fb) { if (on) { if (fb.textContent !== S.faultText) fb.textContent = S.faultText; } if (fb.classList.contains('on') !== on) fb.classList.toggle('on', on); }
      }
    } else if (ts - lastUI > 200) { lastUI = ts; updateStat(); }
    fxFrame(ts, dt);
    if (S.tab === 'curves' && ts - lastCh > 130) { lastCh = ts; drawCharts(); }
    if (S.tab === 'seq' && ts - lastSq > 100) { lastSq = ts; renderSeqLive(); }
  }

  /* ============================================================ Schnittstellen für Trainer, Tasten, Tests */
  root.LabTrainerAPI = {
    lab: 'ant', tab: () => S.tab, go: setTab, simMode: () => S.running, running: () => S.running, rig: () => S.rigId, speed: () => S.speed,
    load: loadExampleByName, examples: () => exampleList().map(e => e.name), task: () => (S.task ? S.task.id : null), saved: () => saves().length,
    seqRows: () => curRows().length, seqDone: () => !!S.seqRes, simTime: () => S.simT, faults: () => (lsGet('ant.faults', []) || []).length, calcUsed: () => exScore.n > 0
  };
  root.LabKeysAdapter = {
    lab: 'ant', sheet: (title, build) => (title === 'Tastenkürzel' ? sheet(title, b => { b.innerHTML = keysHtml(); }) : sheet(title, build)), esc, toast,
    sim: () => setRun(!S.running), busy: () => true, has: () => false
  };
  /* kleine Testschnittstelle */
  root.ANT_UI = { S, setTab, setRig, setCtl, applyCtl, setRun, resetRig, simAdvance, loadExample, loadExampleByName, startTask, checkTask, seqRunBg, seqLive, seqSteps, curRows, snapshot, allCtl, coerce, CALC, genEx, drawCharts, renderCurves, renderSeq, renderCalc, retryLoad, exampleList, BUILTIN, rec: () => rec };

  /* ============================================================ Start */
  function init() {
    buildTabs();
    const cur = lsGet('ant.cur', null);
    if (cur && ORDER.includes(cur.rig)) {
      S.rows = cur.rows && typeof cur.rows === 'object' && !Array.isArray(cur.rows) ? cur.rows : {}; S.name = cur.name || 'Neuer Versuch'; S.id = cur.id || null; S.task = cur.task ? { id: cur.task } : null;
      setRig(cur.rig); applyCtl(cur.ctl); S.dirty = !!cur.dirty;
    } else {
      setRig(ORDER[0]);
      if (!lsRaw('ant.seen', '')) { lsPut('ant.seen', '1'); setTimeout(() => toast('Willkommen! Starte mit ▶ unten oder bewege einen Regler: Der Prüfstand läuft dann los.'), 900); }
    }
    setTab(S.tab);
    requestAnimationFrame(frame);
    /* Aufrufparameter von Startseite, Lernpfad, Kampagne und Lernheften: ?aufgabe=an1, ?ex=Name, ?bsp, ?neu */
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
