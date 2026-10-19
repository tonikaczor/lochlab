'use strict';
/* Tonfunk Sensorik-Lab: Oberfläche.
   Seite, Tabs (Prüfstand, Kennlinien, Ablauf, Rechnen, Aufgaben, Lernen), Bedienpult und Messgeräte automatisch aus rig.controls / rig.meters,
   Messketten-Ansicht, Kalibrier-Assistent, Zeitschreiber, Kennlinien-Schreiber, Ablaufprogramm-Editor, Rechner mit Übungsgenerator, Speichern/Öffnen/Teilen, Aufgabenanbindung, Effekte.
   Die Prüfstände kommen aus senrig-*.js über window.SEN_RIGS (Registry), Physik und Läufer aus sencore.js (window.SEN_CORE), Beispiele und Aufgaben aus sendata.js.
   Speicher: sen.cur (laufende Arbeit), sen.saves (gespeicherte Versuche), sen.tab, sen.speed, sen.digital, sen.faults, sen.rigsused, sim.done (Aufgaben, gemeinsam mit den anderen Labs). */
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
  const ORDER = ['temperatur', 'licht', 'kraft', 'beschleunigung', 'normsignal', 'digital', 'adu'];
  const RIGMETA = {
    temperatur: { icon: '🌡️', name: 'Temperatur', file: 'senrig-temp.js', info: 'Temperaturmessung mit NTC, PT100, PT1000, Halbleiter und Thermoelement' },
    licht: { icon: '💡', name: 'Licht und Näherung', file: 'senrig-opt.js', info: 'LDR, Fotodiode, Lichtschranken, induktive, kapazitive und Ultraschall-Sensoren' },
    kraft: { icon: '🏋️', name: 'Kraft und Druck (DMS)', file: 'senrig-force.js', info: 'Dehnungsmessstreifen in der Brücke mit Verstärker und ADU' },
    beschleunigung: { icon: '📐', name: 'Beschleunigung und Neigung', file: 'senrig-accel.js', info: 'MEMS-Beschleunigungssensor am I²C-Bus' },
    normsignal: { icon: '🔁', name: 'Normsignale', file: 'senrig-loop.js', info: '4…20 mA, 0…10 V und Messumformer' },
    digital: { icon: '🔗', name: 'Digitale Sensoren (I²C)', file: 'senrig-dig.js', info: 'Feuchte, Gas und Abstand am Bus mit Logikanalysator' },
    adu: { icon: '📊', name: 'ADU und Abtastung', file: 'senrig-adc.js', info: 'Quantisierung, Abtastrate und Aliasing' }
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
  root.LabUI = { sheet, esc, toast, userName: () => lsRaw('lm4.name', ''), LAB: 'sen' };
  root.sheet = sheet; root.toast = toast;

  /* ============================================================ Notfall-Attrappe (nur wenn SEN_RIGS ganz fehlt): kleine Temperaturmessung mit NTC */
  const DUMMY = (function () {
    const controls = [
      { key: 'tMeas', label: 'Temperatur der Messstelle', type: 'slider', min: -40, max: 300, step: 1, unit: '°C', value: 25, group: 'Messgröße' },
      { key: 'rRef', label: 'Referenzwiderstand', type: 'slider', min: 1000, max: 47000, step: 100, unit: 'Ω', value: 10000, group: 'Schaltung', help: 'Der NTC bildet mit diesem Widerstand einen Spannungsteiler.' },
      { key: 'adcBits', label: 'ADU-Auflösung', type: 'select', options: [8, 10, 12, 16].map(b => ({ value: b, label: b + ' Bit' })), value: 10, group: 'Wandler' },
      { key: 'vref', label: 'Referenzspannung', type: 'select', options: [{ value: 3.3, label: '3,3 V' }, { value: 5, label: '5 V' }], value: 3.3, group: 'Wandler' },
      { key: 'wireBreak', label: 'Drahtbruch', type: 'button', group: 'Fehler', help: 'Halten: Die Sensorleitung ist unterbrochen.' }
    ];
    const meters = [
      { key: 'tTrue', label: 'Wahre Temperatur', unit: '°C', digits: 1, min: -40, max: 300 },
      { key: 'tShown', label: 'Angezeigt', unit: '°C', digits: 1, min: -40, max: 300 },
      { key: 'error', label: 'Fehler', unit: 'K', digits: 2, min: -10, max: 10, warnAbove: 5 },
      { key: 'rSensor', label: 'Sensorwiderstand', unit: 'Ω', digits: 0, min: 0, max: 400000 },
      { key: 'uOut', label: 'Teilerspannung', unit: 'V', digits: 3, min: 0, max: 5 },
      { key: 'adc', label: 'ADU-Zählwert', unit: '', digits: 0, min: 0, max: 65535 }
    ];
    const R25 = 10000, B = 3950, T0 = 298.15, rOf = t => R25 * Math.exp(B * (1 / (t + 273.15) - 1 / T0));
    function create() {
      const c = {}; controls.forEach(x => { if (x.value != null) c[x.key] = x.value; });
      const s = { tp: 25, r: R25, u: 0, adc: 0, shown: 25, t: 0 }, events = [];
      let broke = false, sat = false;
      const ev = (text, kind, fx) => events.push({ t: s.t, text, kind, fx });
      function calc() {
        s.r = c.wireBreak ? 1e9 : rOf(s.tp); const rr = +c.rRef || 10000, vr = +c.vref || 3.3, nb = +c.adcBits || 10, max = Math.pow(2, nb);
        s.u = vr * s.r / (s.r + rr); s.adc = Math.max(0, Math.min(max - 1, Math.floor(s.u / vr * max)));
        const u2 = (s.adc + 0.5) / max * vr, r2 = rr * u2 / Math.max(1e-9, vr - u2); s.shown = 1 / (1 / T0 + Math.log(Math.max(1e-6, r2) / R25) / B) - 273.15;
      }
      const rig = {
        controls, meters, events, presets: [],
        setControl(k, v) { c[k] = v; }, getControl(k) { return c[k]; },
        step(dt) {
          s.tp += (c.tMeas - s.tp) * (1 - Math.exp(-dt / 6000)); s.t += dt; calc();
          if (c.wireBreak && !broke) { broke = true; ev('Drahtbruch: Die Sensorleitung ist unterbrochen, die Teilerspannung springt auf die Referenzspannung.', 'error', 'wirebreak'); } else if (!c.wireBreak) broke = false;
          const sa = s.adc >= Math.pow(2, +c.adcBits || 10) - 1 && !c.wireBreak; if (sa && !sat) { sat = true; ev('Der Wandler ist übersteuert: Der Zählwert steht am Anschlag.', 'warn', 'overrange'); } else if (!sa) sat = false;
        },
        readMeters() { return { tTrue: s.tp, tShown: s.shown, error: s.shown - s.tp, rSensor: Math.min(s.r, 399999), uOut: s.u, adc: s.adc }; },
        state() { return { tTrue: s.tp, tShown: s.shown, error: s.shown - s.tp, rSensor: s.r, uOut: s.u, adc: s.adc, fault: broke || sat, faults: [] }; },
        draw(g, w, h) {
          const sc = Math.min(w / 1000, h / 560); g.save(); g.translate((w - 1000 * sc) / 2, (h - 560 * sc) / 2); g.scale(sc, sc);
          g.fillStyle = '#1b2128'; g.fillRect(0, 0, 1000, 560);
          const bx = [['Messstelle', fm(s.tp, 1) + ' °C'], ['NTC 10 kΩ', fm(Math.min(s.r, 9e8), 0) + ' Ω'], ['Spannungsteiler', fm(s.u, 3) + ' V'], ['ADU', String(s.adc)], ['Anzeige', fm(s.shown, 1) + ' °C']];
          bx.forEach((b, i) => {
            const x = 40 + i * 190, y = 190; g.fillStyle = '#2c343e'; g.strokeStyle = i === 0 ? '#ff5c5c' : '#3b9eff'; g.lineWidth = 3; g.beginPath(); g.roundRect ? g.roundRect(x, y, 150, 120, 12) : g.rect(x, y, 150, 120); g.fill(); g.stroke();
            g.fillStyle = '#8d99a6'; g.font = '600 20px system-ui'; g.textAlign = 'center'; g.fillText(b[0], x + 75, y + 40); g.fillStyle = '#e8ecf0'; g.font = '700 26px system-ui'; g.fillText(b[1], x + 75, y + 82);
            if (i < 4) { g.strokeStyle = '#ffb340'; g.setLineDash([10, 8]); g.lineDashOffset = -s.t / 40; g.beginPath(); g.moveTo(x + 152, y + 60); g.lineTo(x + 188, y + 60); g.stroke(); g.setLineDash([]); }
          });
          g.fillStyle = '#8d99a6'; g.font = '600 24px system-ui'; g.textAlign = 'center'; g.fillText('Notfall-Attrappe: die Prüfstände sind nicht geladen', 500, 440); g.restore();
          function fm(v, d) { return isFinite(v) ? v.toFixed(d).replace('.', ',') : '–'; }
        },
        curves() {
          const rt = [], ut = [], rr = +c.rRef || 10000, vr = +c.vref || 3.3;
          for (let t = -40; t <= 300; t += 5) { const r = rOf(t); rt.push([t, r / 1000]); ut.push([t, vr * r / (r + rr)]); }
          return [{ id: 'rt', title: 'Widerstand über Temperatur', xLabel: 'Temperatur', xUnit: '°C', yLabel: 'Widerstand', yUnit: 'kΩ', series: [{ name: 'NTC 10 kΩ, B 3950', points: rt.filter(p => p[0] >= -20) }], marker: { x: s.tp, y: rOf(s.tp) / 1000 } },
            { id: 'ut', title: 'Teilerspannung über Temperatur', xLabel: 'Temperatur', xUnit: '°C', yLabel: 'Spannung', yUnit: 'V', series: [{ name: 'U(T)', points: ut }], marker: { x: s.tp, y: vr * rOf(s.tp) / (rOf(s.tp) + rr) } }];
        },
        reset() { s.tp = 25; s.t = 0; broke = false; sat = false; events.length = 0; controls.forEach(x => { c[x.key] = x.value != null ? x.value : false; }); calc(); },
        worldSize() { return { w: 1000, h: 560 }; }
      };
      calc();
      return rig;
    }
    return { id: 'temperatur', name: 'Temperatur (Notfall-Attrappe)', icon: '🌡️', info: 'Einfache Ersatzanzeige, bis die echten Prüfstände geladen sind.', controls, meters, create, attrappe: true };
  })();
  const defOf = id => {
    const r = root.SEN_RIGS;
    if (r && r.defs && r.defs[id]) return r.defs[id];
    if (!r && id === 'temperatur') return DUMMY;
    return null;
  };
  const rigName = id => { const d = defOf(id); return (d && !d.attrappe && d.name) || (RIGMETA[id] || {}).name || id; };
  const rigIcon = id => { const d = defOf(id); return (d && d.icon) || (RIGMETA[id] || {}).icon || '📡'; };

  /* ============================================================ Zustand */
  const S = {
    tab: lsRaw('sen.tab', 'rig'), rigId: null, rig: null, err: '', name: 'Neuer Versuch', id: null, task: null, dirty: false,
    running: false, speed: +lsRaw('sen.speed', '1') || 1, digital: lsRaw('sen.digital', '0') === '1',
    ctl: {}, simT: 0, rows: {}, live: null, seqRes: null, readonly: false, sigOn: {}, cal: null
  };
  if (!['rig', 'curves', 'seq', 'calc', 'tasks', 'help'].includes(S.tab)) S.tab = 'rig';
  if (![0.5, 1, 2, 5].includes(S.speed)) S.speed = 1;
  let rec = [], recAcc = 0, drawErr = false;

  /* Signale für den Zeitschreiber: bis zu vier Messgeräte des Prüfstands (je Prüfstand bevorzugte Schlüssel, der Rest wird aufgefüllt) */
  const SIGPREF = {
    temperatur: ['tTrue', 'tShown', 'uOut', 'error'], licht: ['uOut', 'iOut', 'lux', 'state'], kraft: ['value', 'uOut', 'error', 'strain'],
    beschleunigung: ['ax', 'ay', 'az', 'roll'], normsignal: ['value', 'iLoop', 'uAdc', 'shown'], digital: ['tShown', 'rhShown', 'distShown', 'errorRate'], adu: ['snr', 'quantErr', 'lsb', 'enob']
  };
  const SIGCOL = ['#3b9eff', '#ffb340', '#4cd964', '#ff5c5c'];
  let SIGS = [];
  const fin = v => typeof v === 'number' && isFinite(v);
  const sigOnF = k => S.sigOn[k] !== false;
  function buildSigs() {
    const ms = S.rig ? ((S.rig.meters || (defOf(S.rigId) || {}).meters || [])) : [], out = [];
    (SIGPREF[S.rigId] || []).forEach(k => { const m = ms.find(x => x.key === k); if (m && out.length < 4 && !out.includes(m)) out.push(m); });
    ms.forEach(m => { if (out.length < 4 && !out.includes(m)) out.push(m); });
    SIGS = out.map((m, i) => ({ k: m.key, n: m.label, u: m.unit || '', c: SIGCOL[i % 4], d: m.digits == null ? 1 : m.digits }));
  }
  /* Werte der Signale in der Reihenfolge von SIGS: erst Messgerät, sonst Prozessgröße aus state() */
  function sigVals(st, mt) { return SIGS.map(s => (mt && fin(mt[s.k]) ? mt[s.k] : st && fin(st[s.k]) ? st[s.k] : null)); }
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
    S.attrappe = !!(d && d.attrappe); S.cal = null; buildSigs();
    buildPick(); buildPresets(); buildControls(); buildMeters(); buildChain(); renderCal(); fitCanvas(); updateEvents(true); updateChrome();
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
  function saveCur() { if (!S.rig) return; lsSet('sen.cur', { rig: S.rigId, ctl: allCtl(), rows: S.rows, name: S.name, id: S.id, task: S.task ? S.task.id : null, dirty: S.dirty }); }
  function usedRig() {
    if (S.attrappe || !S.rigId) return;
    const a = lsGet('sen.rigsused', []), s = new Set(Array.isArray(a) ? a : []); s.add(S.rigId); lsSet('sen.rigsused', [...s]); stat('senrigs', s.size, 'max');
  }

  /* ---- Prüfstandwahl und Voreinstellungen ---- */
  function buildPick() {
    $('#rigPick').innerHTML = ORDER.map(id => {
      const have = !!defOf(id) && !(defOf(id).attrappe && id !== 'temperatur');
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
  const FILES = ['sencore.js', 'senrig-temp.js', 'senrig-opt.js', 'senrig-force.js', 'senrig-accel.js', 'senrig-loop.js', 'senrig-dig.js', 'senrig-adc.js', 'sendata.js'];
  function placeholderHtml() {
    const why = S.err ? 'Der Prüfstand konnte nicht gestartet werden: ' + esc(S.err) : 'Die Datei für „' + esc(rigName(S.rigId)) + '“ ist noch nicht geladen.';
    return `<div class="ph2"><b>Prüfstand noch nicht geladen</b>${why}<br><button class="btn" data-retry>Erneut prüfen</button></div>`;
  }
  function retryLoad() {
    const want = FILES.filter(f => {
      if (f === 'sencore.js') return !root.SEN_CORE; if (f === 'sendata.js') return !root.SEN_DATA && !root.SEN_TASKS;
      const id = ORDER.find(i => RIGMETA[i].file === f); return !(root.SEN_RIGS && root.SEN_RIGS.defs && root.SEN_RIGS.defs[id]);
    });
    if (!want.length) { setRig(S.rigId); toast('Alles geladen'); return Promise.resolve(); }
    toast('Lade fehlende Dateien …');
    return Promise.all(want.map(f => new Promise(res => {
      const s = document.createElement('script'); s.src = f + '?t=' + Date.now(); s.onload = s.onerror = () => res(); document.head.appendChild(s);
    }))).then(() => {
      const still = ORDER.filter(i => !defOf(i)).length;
      const keep = S.rig ? allCtl() : ((lsGet('sen.cur', {}) || {}).ctl || {}); setRig(S.rigId); applyCtl(keep); buildPick();
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

  /* ============================================================ Messketten-Ansicht (Blockbild mit Livewerten) */
  /* c: Steuerwerte, die im Block angezeigt werden; m: Messgeräte mit Livewert ('*' = die ersten beiden); e: typische Fehlerquelle an dieser Stelle */
  const CHAIN = {
    temperatur: [
      { ic: '🌡️', t: 'Messgröße', c: ['tMeas'], m: ['tTrue'], e: 'Wärmeträgheit der Sonde' },
      { ic: '🔌', t: 'Sensor', c: ['sensor'], m: ['rSensor', 'dTself'], e: 'Selbsterwärmung, Drahtbruch' },
      { ic: '🔧', t: 'Schaltung', c: ['circuit', 'wires'], m: ['uOut', 'current'], e: 'Leitungswiderstand' },
      { ic: '🔢', t: 'Wandler (ADU)', c: ['adcBits'], m: ['adc'], e: 'Übersteuerung, Auflösung' },
      { ic: '📟', t: 'Anzeige', c: [], m: ['tShown', 'error'], e: 'Messabweichung' }
    ],
    licht: [
      { ic: '💡', t: 'Messgröße', c: ['lux', 'dist'], m: ['lux'], e: 'Fremdlicht' },
      { ic: '🔌', t: 'Sensor', c: ['sensor', 'material'], m: ['switchDist'], e: 'Reduktionsfaktor, Sättigung' },
      { ic: '🔧', t: 'Auswertung', c: ['thresh', 'hyst'], m: ['uOut', 'iOut'], e: 'Flattern ohne Hysterese' },
      { ic: '📟', t: 'Ausgang', c: [], m: ['state', 'hystError'], e: 'Schaltfehler' }
    ],
    kraft: [
      { ic: '🏋️', t: 'Messgröße', c: ['force', 'pressure'], m: ['strain'], e: 'Überlast, Kriechen' },
      { ic: '🔌', t: 'DMS-Brücke', c: ['bridge', 'uBridge'], m: ['dR', 'uBridge'], e: 'Brückenungleichgewicht, Drift' },
      { ic: '🔧', t: 'Verstärker', c: ['gain', 'offset', 'filter'], m: ['uOut'], e: 'Übersteuerung, Offset' },
      { ic: '🔢', t: 'Wandler (ADU)', c: ['adcBits'], m: ['adc'], e: 'Quantisierung' },
      { ic: '📟', t: 'Anzeige', c: [], m: ['value', 'error', 'hysteresis'], e: 'Messabweichung' }
    ],
    beschleunigung: [
      { ic: '📐', t: 'Messgröße', c: ['tiltX', 'tiltY', 'shock', 'vibFreq'], m: [], e: 'Stoß, Schwingung' },
      { ic: '🔌', t: 'MEMS-Sensor', c: ['range', 'res'], m: ['ax', 'ay', 'az'], e: 'Clipping, Rauschen' },
      { ic: '🔗', t: 'Digitalisierung (I²C)', c: ['rate', 'filter'], m: ['rawX', 'rawZ'], e: 'Abtastrate, Filter' },
      { ic: '📟', t: 'Anzeige', c: [], m: ['roll', 'pitch'], e: 'Neigung nur im Stillstand' }
    ],
    normsignal: [
      { ic: '🏭', t: 'Messgröße', c: ['lo', 'hi'], m: ['value'], e: 'Messbereich' },
      { ic: '🔌', t: 'Messumformer', c: ['signal', 'uSupply'], m: ['iLoop', 'headroom'], e: 'Sättigung, Drahtbruch' },
      { ic: '🔧', t: 'Leitung und Bürde', c: ['rBurden', 'rLine', 'emi'], m: ['uBurden'], e: 'Einkopplung, Leitungswiderstand' },
      { ic: '🔢', t: 'Wandler (ADU)', c: ['adcBits'], m: ['uAdc', 'adc'], e: 'Quantisierung' },
      { ic: '📟', t: 'Anzeige', c: [], m: ['shown', 'error'], e: 'Messabweichung' }
    ],
    digital: [
      { ic: '🌍', t: 'Messgröße', c: ['temp', 'rh', 'gas', 'dist'], m: [], e: 'Umgebung' },
      { ic: '🔌', t: 'Digitaler Sensor', c: ['sensor', 'addr'], m: [], e: 'Adresskonflikt' },
      { ic: '🔗', t: 'I²C-Bus', c: ['pullup', 'busSpeed', 'busLength'], m: ['acks', 'errorRate', 'tr'], e: 'Pull-up, NACK, Flanken' },
      { ic: '📟', t: 'Anzeige', c: [], m: ['tShown', 'rhShown', 'gasShown', 'distShown'], e: 'Rohwert umrechnen' }
    ],
    adu: [
      { ic: '〰️', t: 'Eingangssignal', c: ['wave', 'fSig', 'amp'], m: ['uIn'], e: 'Rauschen' },
      { ic: '🔧', t: 'Anti-Aliasing', c: ['aaf'], m: [], e: 'Filter fehlt' },
      { ic: '⏱️', t: 'Abtastung', c: ['fs', 'sampleHold'], m: ['nyquist', 'fAlias'], e: 'Aliasing' },
      { ic: '🔢', t: 'ADU', c: ['bits', 'vref'], m: ['lsb', 'quantErr', 'code'], e: 'Quantisierung' },
      { ic: '📟', t: 'Ergebnis', c: [], m: ['snr', 'enob'], e: 'Rauschabstand' }
    ]
  };
  const GENERIC_CHAIN = [
    { ic: '📏', t: 'Messgröße', c: [], m: [], e: '' }, { ic: '🔌', t: 'Sensor', c: [], m: [], e: '' }, { ic: '🔧', t: 'Aufbereitung', c: [], m: [], e: '' },
    { ic: '🔢', t: 'Wandler', c: [], m: [], e: '' }, { ic: '📟', t: 'Anzeige', c: [], m: '*', e: '' }
  ];
  let chainEls = [];
  function ctlText(key) {
    const c = ctlDef(key); if (!c || !S.rig) return ''; let v; try { v = S.rig.getControl(key); } catch (e) { return ''; }
    if (c.type === 'slider') return fnum(v, decs(c.step)) + unitOf(c);
    if (c.type === 'switch' || c.type === 'button') return v ? 'EIN' : 'AUS';
    if (c.type === 'select') { const o = (c.options || []).find(q => q.value === v || String(q.value) === String(v)); return o ? o.label : String(v); }
    return String(v);
  }
  function buildChain() {
    const H = $('#chain'); chainEls = []; if (!H) return;
    if (!S.rig) { H.innerHTML = ''; return; }
    const spec = CHAIN[S.rigId] || GENERIC_CHAIN, ms = metersOf(), has = k => ms.some(m => m.key === k);
    H.innerHTML = '<div class="gh" style="padding:12px 2px 4px">Messkette: so läuft das Signal vom Messort bis zur Anzeige</div><div class="chain" id="chainRow">' + spec.map((b, i) =>
      `${i ? '<div class="ca" aria-hidden="true"><i></i></div>' : ''}<div class="cbk" data-i="${i}"><div class="ct1">${b.ic} ${esc(b.t)}</div><div class="cs"></div><div class="cv"></div>${b.e ? `<div class="ce">⚠ ${esc(b.e)}</div>` : ''}</div>`).join('') + '</div>';
    chainEls = $$('.cbk', H).map((el, i) => {
      const b = spec[i], m = b.m === '*' ? ms.slice(0, 2).map(x => x.key) : (b.m || []).filter(has);
      return { el, cs: $('.cs', el), cv: $('.cv', el), c: (b.c || []).filter(k => ctlDef(k)), m, key: null };
    });
    updateChain(true);
  }
  function updateChain(force) {
    const row = $('#chainRow'); if (!row || !S.rig) return;
    row.classList.toggle('flo', !!S.running);
    let vals = {}; try { vals = S.rig.readMeters() || {}; } catch (e) { return; }
    const ms = metersOf();
    chainEls.forEach(x => {
      const set = x.c.map(k => { const c = ctlDef(k); return c ? esc(c.label) + ': <b>' + esc(ctlText(k)) + '</b>' : ''; }).filter(Boolean).join('<br>');
      let warn = false;
      const val = x.m.map(k => { const m = ms.find(q => q.key === k); if (!m || !fin(vals[k])) return ''; if (fin(+m.warnAbove) && vals[k] > +m.warnAbove) warn = true; return '<span class="ml">' + esc(m.label) + '</span><b>' + fnum(vals[k], m.digits == null ? 1 : m.digits) + '</b> <small>' + esc(m.unit || '') + '</small>'; }).filter(Boolean).join('');
      const key = set + '|' + val + '|' + warn; if (!force && key === x.key) return; x.key = key;
      x.cs.innerHTML = set; x.cv.innerHTML = val; x.el.classList.toggle('warn', warn);
    });
  }

  /* ============================================================ Kalibrier-Assistent (Zwei-Punkt-Kalibrierung: Nullpunkt und Endwert) */
  /* in: Steuerwert für die Messgröße; out: Messgerät mit der Anzeige (erster vorhandener Schlüssel); p0/p1: Kalibrierpunkte (Zahl, 'min' oder 'max') */
  const CAL = {
    temperatur: { in: 'tMeas', out: ['tShown'], p0: 0, p1: 100, settle: 150000 },
    licht: { in: 'lux', out: ['lux'], p0: 100, p1: 10000, settle: 6000 },
    kraft: { in: 'force', out: ['value'], p0: 0, p1: { st: 'nominal' }, settle: 10000 },
    beschleunigung: { in: 'tiltX', out: ['roll'], p0: 0, p1: 45, settle: 8000 },
    normsignal: { in: 'value', out: ['shown'], p0: { ctl: 'lo' }, p1: { ctl: 'hi' }, settle: 8000 },
    digital: { in: 'temp', out: ['tShown'], p0: 0, p1: 50, settle: 90000 },
    adu: null
  };
  const NOT_PROCESS = new Set(['lo', 'hi', 'rLine', 'rBurden', 'uSupply', 'emi', 'adcBits', 'short', 'wireBreak']);
  function calSpec() {
    if (!S.rig) return null; const base = CAL[S.rigId]; if (!base) return null;
    const ms = metersOf(), cs = ctlsOf(); let inKey = base.in;
    if (S.rigId === 'kraft') { let st = null; try { st = S.rig.state(); } catch (e) {} if (st && st.mode === 'druck' && ctlDef('pressure')) inKey = 'pressure'; }
    if (!inKey) { const c = cs.find(x => x.type === 'slider' && !NOT_PROCESS.has(x.key)); inKey = c ? c.key : null; }
    const def = inKey ? ctlDef(inKey) : null; if (!def || def.type !== 'slider') return null;
    let om = null; for (const k of base.out) { om = ms.find(m => m.key === k); if (om) break; }
    if (!om && base.rx) om = ms.find(m => base.rx.test(m.key));
    if (!om) return null;
    const pv = p => { if (p && typeof p === 'object' && p.st) { let g = NaN; try { g = +S.rig.state()[p.st]; } catch (e) {} p = fin(g) && g > 0 ? g : def.max / 2; } else if (p && typeof p === 'object') { let g = NaN; try { g = +S.rig.getControl(p.ctl); } catch (e) {} p = fin(g) ? g : (p.ctl === 'hi' ? 'max' : 'min'); } if (p === 'min') return def.min; if (p === 'max') return def.max; return Math.max(def.min, Math.min(def.max, p)); };
    return { inKey, def, om, x0: pv(base.p0), x1: pv(base.p1), settle: base.settle, inUnit: def.unit || '', outUnit: om.unit || '' };
  }
  const calRead = sp => { try { const v = S.rig.readMeters()[sp.om.key]; return fin(v) ? v : NaN; } catch (e) { return NaN; } };
  /* Eingang setzen, bis die Anzeige ruhig steht (Sonde und Filter brauchen Zeit), dann mitteln */
  function calMeasure(sp, x) {
    setCtl(sp.inKey, x, true);
    const span = Math.abs(sp.x1 - sp.x0) || 1, tol = span * 2e-4, win = Math.min(12000, sp.settle / 4), hist = []; let t = 0;
    while (t < sp.settle) {   /* ruhig = im letzten Zeitfenster hat sich die Anzeige nicht mehr merklich geändert (langsame Sensoren halten Zwischenwerte) */
      simAdvance(500); t += 500; const y = calRead(sp); hist.push([t, y]);
      if (t >= win && fin(y) && hist.filter(h => h[0] > t - win).every(h => fin(h[1]) && Math.abs(h[1] - y) <= tol)) break;
    }
    let sum = 0, n = 0; for (let i = 0; i < 10; i++) { simAdvance(100); const y = calRead(sp); if (fin(y)) { sum += y; n++; } }
    let xa = x; try { const g = +S.rig.getControl(sp.inKey); if (fin(g)) xa = g; } catch (e) {}
    return { x: xa, y: n ? sum / n : NaN };
  }
  const calC = () => (S.cal && S.cal.rigId === S.rigId ? S.cal : (S.cal = { rigId: S.rigId, p: [null, null], mid: null, saved: null, done: false }));
  function calDo(which) {
    const sp = calSpec(); if (!sp) return;
    if (S.live) { toast('Beende zuerst den Live-Ablauf.'); return; } if (S.readonly) return;
    const C = calC(); if (!C.saved) C.saved = allCtl();
    const x = which === 'mid' ? (sp.x0 + sp.x1) / 2 : which === 'p0' ? sp.x0 : sp.x1;
    const r = calMeasure(sp, x);
    if (!fin(r.y)) { toast('Der Prüfstand liefert keinen Messwert.'); return; }
    if (which === 'mid') C.mid = r; else C.p[which === 'p0' ? 0 : 1] = r;
    S.dirty = true; usedRig();
    if (C.p[0] && C.p[1] && !C.done && Math.abs(C.p[1].y - C.p[0].y) > 1e-12) {
      C.done = true; stat('sencal', 1, 'max'); const F = root.LochFX; if (F) try { F.sound('ding'); F.say('Kalibriert!'); } catch (e) {}
    }
    syncCtl(true); updateMeters(0, true); updateChain(true); renderCal(); saveCurSoon();
  }
  function renderCal() {
    const B = $('#calBody'); if (!B) return;
    if (!S.rig) { B.innerHTML = ''; return; }
    const sp = calSpec();
    if (!sp) { B.innerHTML = '<p class="hint2" style="margin:0">Dieser Prüfstand hat keinen Messwert, den man mit Nullpunkt und Endwert abgleichen kann. Wähle zum Beispiel „Temperatur“, „Kraft und Druck“ oder „Normsignale“.</p>'; return; }
    const C = calC(), span = Math.abs(sp.x1 - sp.x0), dd = span < 20 ? 3 : span < 2000 ? 2 : 1, f = v => fnum(v, dd), iu = sp.inUnit ? ' ' + sp.inUnit : '', ou = sp.outUnit ? ' ' + sp.outUnit : '';
    let h = `<p class="hint2" style="margin:0 0 8px">Zwei-Punkt-Kalibrierung: Fahre erst den <b>Nullpunkt</b>, dann den <b>Endwert</b> an. Der Assistent stellt die Messgröße „${esc(sp.def.label)}“ ein, wartet bis die Anzeige ruhig steht und vergleicht Soll und Anzeige. Danach stellt er deine alten Einstellungen auf Wunsch wieder her.</p>
      <div class="calb"><button class="btn s${C.p[0] ? '' : ' pri'}" data-cal="p0">① Nullpunkt anfahren (${f(sp.x0)}${iu})</button><button class="btn s${C.p[0] && !C.p[1] ? ' pri' : ''}" data-cal="p1">② Endwert anfahren (${f(sp.x1)}${iu})</button></div>`;
    if (C.p[0] || C.p[1]) {
      h += `<table class="iot" style="margin-top:8px"><tr><th>Punkt</th><th>Soll</th><th>Anzeige</th><th>Abweichung</th></tr>` + [['Nullpunkt', C.p[0]], ['Endwert', C.p[1]], ['Kontrolle (Mitte)', C.mid]].filter(r => r[1]).map(r => `<tr><td>${r[0]}</td><td class="a">${f(r[1].x)}${iu}</td><td class="a">${f(r[1].y)}${ou}</td><td class="a">${r[1].y - r[1].x >= 0 ? '+' : '−'}${f(Math.abs(r[1].y - r[1].x))}</td></tr>`).join('') + '</table>';
    }
    if (C.p[0] && C.p[1]) {
      const a = C.p[0], b = C.p[1], dx = b.x - a.x, dy = b.y - a.y;
      if (!(Math.abs(dy) > 1e-12) || !(Math.abs(dx) > 1e-12)) h += '<div class="res"><span class="hint2">Die Anzeige hat sich zwischen Nullpunkt und Endwert nicht verändert. Dann lässt sich nichts abgleichen: Prüfe Sensor, Verstärkung und ob der Wandler übersteuert.</span></div>';
      else {
        const g = dy / dx, e0 = a.y - a.x, corr = y => a.x + (y - a.y) / g;
        h += `<div class="res"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>Nullpunktfehler</span><span class="big2">${e0 >= 0 ? '+' : '−'}${f(Math.abs(e0))}${ou}</span></div>
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>Steigungsfehler (Soll 1,000)</span><span class="big2">${fnum(g, 4)}</span></div>
          <details open><summary style="min-height:36px;display:flex;align-items:center;color:var(--accent);cursor:pointer">Korrektur</summary><ol>
          <li>Nullpunktfehler: <b>y₀ − x₀</b> = ${f(a.y)} − ${f(a.x)} = ${f(e0)}${ou}</li>
          <li>Steigung: <b>(y₁ − y₀) / (x₁ − x₀)</b> = ${f(dy)} / ${f(dx)} = ${fnum(g, 4)} (Steigungsfehler ${fnum((g - 1) * 100, 2)} %)</li>
          <li>Korrigierter Wert: <b>x = x₀ + (y − y₀) · (x₁ − x₀) / (y₁ − y₀)</b> = ${f(a.x)} + (y − ${f(a.y)}) · ${fnum(1 / g, 4)}</li></ol></details>
          ${C.mid ? `<p style="margin:8px 0 0">Kontrolle in der Mitte: Soll ${f(C.mid.x)}${iu}, Anzeige ${f(C.mid.y)}${ou}, <b>korrigiert ${f(corr(C.mid.y))}${iu}</b>. Abweichung vorher ${f(Math.abs(C.mid.y - C.mid.x))}, nachher <b>${f(Math.abs(corr(C.mid.y) - C.mid.x))}</b>.${Math.abs(corr(C.mid.y) - C.mid.x) > 0.01 * span ? ' Der Rest ist ein <b>Linearitätsfehler</b>: Er lässt sich mit zwei Punkten nicht wegrechnen.' : ' Die Korrektur passt.'}</p>` : ''}</div>
          <div class="calb"><button class="btn s" data-cal="mid">③ Kontrollpunkt (Mitte) prüfen</button></div>`;
      }
    }
    h += `<div class="calb"><button class="chip s" data-cal="back"${C.saved ? '' : ' disabled'}>↩ Meine Einstellung zurück</button><button class="chip s danger" data-cal="reset"${C.p[0] || C.p[1] ? '' : ' disabled'}>Neu beginnen</button></div>`;
    B.innerHTML = h;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-cal]'); if (!b || !S.rig) return; const a = b.dataset.cal;
    if (a === 'back') { const C = calC(); if (C.saved) { applyCtl(C.saved); updateChain(true); toast('Deine Einstellung ist wieder da.'); } }
    else if (a === 'reset') { const C = calC(); if (C.saved) applyCtl(C.saved); S.cal = null; renderCal(); }
    else { b.disabled = true; b.textContent = 'misst …'; setTimeout(() => { try { calDo(a); } catch (er) { console.error('Kalibrierung:', er); } renderCal(); }, 30); }
  });

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
  const FXTEXT = {
    zap: 'Sensor überlastet! Das war zu viel für die Messkette.', wire: 'Drahtbruch! Hier fließt kein Strom mehr.', heat: 'Selbsterwärmung! Der Sensor misst seine eigene Wärme.',
    alias: 'Aliasing! Das Signal erscheint mit falscher Frequenz.', bus: 'I²C-Fehler! Der Bus antwortet nicht richtig.', over: 'Übersteuert! Das Signal passt nicht in den Messbereich.',
    range: 'Messbereich überschritten!', warn: 'Achtung! Hier stimmt etwas mit der Messung nicht.', hit: 'Bumm! Ein Stoß trifft den Sensor.'
  };
  /* Klassen der Effekte. Die Prüfstände melden ein fx-Feld (shoot, overheat, stall, tip, crash wie im Sensorik-Lab); die Art des Fehlers steckt im Meldungstext, deshalb wird er zuerst untersucht. */
  const TXRE = {
    alias: /alias|frequenzspiegel/i, bus: /nack|ack|i²c|i2c|adress|pull-up|timeout|prüfsumme|crc|buskapaz|flanke/i, heat: /selbsterw|überhitz|zu heiß|erwärmt/i,
    zap: /drahtbruch|kurzschluss|überlast|bleibende verformung|funken|durchgebrannt|überspannung/i, over: /übersteuer|sättig/i, range: /clipping|messbereich|überschreit/i
  };
  function fxClass(e) {
    const f = String(e.fx || '').toLowerCase(), t = String(e.text || ''), bad = e.kind === 'error' || e.kind === 'warn';
    if (bad || f) {
      if (TXRE.alias.test(t) || /alias/.test(f)) return 'alias';
      if (bad && TXRE.bus.test(t)) return 'bus';
      if (/overheat|selfheat|smoke/.test(f) || (bad && TXRE.heat.test(t))) return 'heat';
      if (/shoot|zap|spark/.test(f) || (bad && TXRE.zap.test(t))) return 'zap';
      if (f === 'crash' && e.kind === 'info') return 'hit';
      if (f === 'crash') return 'zap';
      if (bad && TXRE.over.test(t)) return 'over';
      if (bad && TXRE.range.test(t)) return 'range';
      if (/stall|tip|overrange|clip|saturat/.test(f)) return 'warn';
      if (/^(ok|good|ding|right|correct|richtig|cal)/.test(f)) return 'good';
    }
    return null;
  }
  let fxCool = {}, fxBudgetT = 0;
  function fxReset() { fxCool = {}; fxDrew = false; if (root.LochFX && root.LochFX.clear) try { root.LochFX.clear(); } catch (e) {} }
  const fxOn = () => !!(root.LochFX && !root.LochFX.isMuted());
  function worldToPx(x, y) {
    const ws = worldSz(), s = Math.min(cw / ws.w, ch / ws.h);
    if (!fin(x) || !fin(y)) return [cw / 2, ch / 2];
    return [(cw - ws.w * s) / 2 + x * s, (ch - ws.h * s) / 2 + y * s];
  }
  function fxEvent(e, ts, cl) {
    const F = root.LochFX; if (!F || !cl) return;
    const fast = S.speed > 1, cd = (cl === 'good' ? 2500 : 1500) * (fast ? S.speed : 1);
    if (ts - (fxCool[cl] || -1e9) < cd) return; fxCool[cl] = ts;
    const [x, y] = worldToPx(e.x, e.y), sc = Math.max(14, Math.min(34, cw / 28)), t = String(e.text || '');
    try {
      if (cl === 'zap') { const wb = /draht/i.test(t); F.trip(x, y, wb ? 'KLICK!' : 'ZAP!', sc, { kind: 'shock' }); F.sound('zap'); setTimeout(() => { try { F.sound('spark', 0.5); } catch (er) {} }, 140); F.say(wb ? FXTEXT.wire : FXTEXT.zap); }
      else if (cl === 'heat') { F.explode(x, y, { part: 'SENSOR', why: 'Sensor', kind: 'res', color: '255,120,40', scale: sc * 0.8, at: () => [x, y] }); F.sound('alarm'); F.say(FXTEXT.heat); }
      else if (cl === 'alias') { F.sound('kazoo'); F.say(FXTEXT.alias); }
      else if (cl === 'bus') { F.sound('buzz'); F.say(FXTEXT.bus); }
      else if (cl === 'over') { F.sound('buzz', 0.6); F.say(FXTEXT.over); }
      else if (cl === 'range') { F.sound('buzz', 0.6); F.say(FXTEXT.range); }
      else if (cl === 'hit') { F.sound('crash', 0.5); F.say(FXTEXT.hit); }
      else if (cl === 'warn') { F.sound('buzz', 0.5); F.say(FXTEXT.warn); }
      else if (cl === 'good') F.sound('ding');
    } catch (er) {}
  }
  function noteFault(e) {
    const key = S.rigId + ':' + (e.fx || String(e.text || '').slice(0, 28));
    const a = lsGet('sen.faults', []), s = new Set(Array.isArray(a) ? a : []); if (s.has(key)) return;
    s.add(key); lsSet('sen.faults', [...s]); stat('senfault', s.size, 'max');
  }
  /* neue Meldungen beobachten: Liste, Abzeichenstatistik, Effekte */
  function watchEvents(ts) {
    const r = S.rig; if (!r) return; const ev = r.events || [];
    let changed = false;
    for (let i = Math.max(0, ev.length - 30); i < ev.length; i++) {
      const e = ev[i]; if (!e || S.evSeen.has(e)) continue; S.evSeen.add(e); changed = true;
      const cl = fxClass(e);
      if (e.kind === 'error' || cl) noteFault(e);
      if (e.kind === 'error') { S.faultUntil = performance.now() + 9000; S.faultText = e.text; if (S.tab !== 'rig' && S.running) toast('⚠ ' + e.text); }
      if (cl && (!fast() || ts - fxBudgetT > 700)) { fxBudgetT = ts; fxEvent(e, ts, cl); }
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
    if (on) { stat('senrun', 1, 'max'); usedRig(); if (auto && !lsRaw('sen.autohint', '')) { lsPut('sen.autohint', '1'); toast('Der Prüfstand läuft jetzt. Mit ⏸ unten hältst du ihn an.'); } }
  }
  function resetRig(quiet) {
    if (!S.rig) return;
    try { S.rig.reset(); } catch (e) { console.error(e); }
    S.running = false; S.simT = 0; rec = []; recAcc = 0; S.live = null; S.ctl = {}; S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; S.curveCache = null; fxReset();
    syncCtl(true); updateMeters(0, true); updateEvents(true); updateChrome(); renderSeqLive(); if (!quiet) toast('Prüfstand zurückgesetzt');
  }
  function setSpeed(v) { S.speed = v; lsPut('sen.speed', String(v)); updateChrome(); }
  function recordSample() {
    let st = null, mt = null; try { st = S.rig.state(); mt = S.rig.readMeters(); } catch (e) { return; }
    rec.push([S.simT].concat(sigVals(st, mt)));
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
  function normSeries(pts) {
    let lo = Infinity, hi = -Infinity; pts.forEach(p => { if (fin(p[1])) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); } });
    if (!fin(lo)) { lo = 0; hi = 1; }
    if (hi - lo < 1e-9) { const pad = Math.max(Math.abs(lo) * 0.05, 0.5); lo -= pad; hi += pad; }
    return { lo, hi, pts: pts.map(p => [p[0], fin(p[1]) ? (p[1] - lo) / (hi - lo) : null]) };
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
      <p class="hint2" style="margin:4px 0 0">Jedes Signal hat seinen eigenen Maßstab (vom kleinsten bis zum größten Wert im Fenster, die Zahlen stehen in Klammern), damit alle gut sichtbar sind. Der Zeitschreiber läuft nur, solange der Prüfstand läuft. Mit dem Finger oder der Maus liest du genaue Werte ab.</p></div>`;
    crvDirty = true; S.curveCache = null; drawCharts(true);
    const first = S.curveCache && S.curveCache.length; if (first) stat('sencurve', 1, 'max');
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
      const pts = win.map(r => [r[0] / 1000, r[col]]), n = normSeries(pts), last = [...win].reverse().find(r => r[col] != null);
      lg.push({ s, hi: n.hi, lo: n.lo, v: last ? last[col] : null });
      if (sigOnF(s.k)) ser.push({ name: s.n, color: s.c, pts: n.pts });
    });
    drawChart(cv, { series: ser, xMin, xMax, yMin: 0, yMax: 1.05, yHide: true, xLabel: 'Zeit in s', cursorX: recCur });
    const sg = $('#recSig'), h = lg.length ? lg.map(x => `<button class="sig${sigOnF(x.s.k) ? '' : ' off'}" data-sig="${x.s.k}"><i style="background:${x.s.c}"></i>${x.s.n} ${fnum(x.v, Math.abs(x.v) >= 100 ? 0 : 1)} ${x.s.u}<small style="color:var(--mute)"> (${x.lo !== 0 ? fnum(x.lo, 0) + ' bis ' : 'bis '}${fnum(x.hi, Math.abs(x.hi) >= 100 ? 0 : 1)})</small></button>`).join('') : '<span class="hint2">Noch keine Aufzeichnung: starte den Prüfstand (▶ unten).</span>';
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
      else if (sg) { S.sigOn[sg.dataset.sig] = !sigOnF(sg.dataset.sig); $('#recSig').dataset.h = ''; drawRecorder(); }
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
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sensorik-aufzeichnung.csv'; document.body.appendChild(a); a.click(); a.remove(); }
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
      <p class="hint2" style="margin:0 0 8px">Jede Zeile heißt: <b>nach … Sekunden</b> wird ein Steuerwert auf einen neuen Wert gesetzt. So baust du zum Beispiel einen Temperatursprung, eine Hysterese-Schleife oder einen Drahtbruch zu einem bestimmten Zeitpunkt, ohne selbst zu drücken.</p>
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
  /* Ablaufprogramm im Hintergrund: SEN_CORE.runSeq, sonst eigener gleichwertiger Läufer */
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
      stat('senseq', 1, 'max'); if (res.faults && res.faults.length) { /* Fehler im Ablauf zählen für Abzeichen nicht extra */ }
      renderSeqRes(); const el = $('#sqRes'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    let res = null;
    try { if (root.SEN_CORE && typeof root.SEN_CORE.runSeq === 'function') res = root.SEN_CORE.runSeq(factory, steps, end); } catch (e) { console.warn('runSeq:', e); res = null; }
    if (res && typeof res.then === 'function') res.then(done, () => done(null)); else done(res);
  }
  function seqLive() {
    if (!S.rig) return; const steps = seqSteps(curRows());
    if (!steps.length) { toast('Das Ablaufprogramm ist leer.'); return; }
    resetRig(true); S.live = { steps, i: 0, t: 0, end: Math.round(seqDur() * 1000) }; setRun(true); renderSeqLive();
    toast('Ablauf läuft live. Im Tab „Prüfstand“ siehst du die Animation.');
  }
  function seqLiveDone() { S.live = null; stat('senseq', 1, 'max'); toast('Ablauf beendet'); renderSeqLive(); }
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
    const pref = (SIGPREF[S.rigId] || []).concat(['tShown', 'value', 'shown', 'uOut']), out = [];
    pref.forEach(k => { if (out.length < 3 && ms.some(m => m.key === k) && !out.includes(k)) out.push(k); });
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
    const out = [], d = root.SEN_DATA && root.SEN_DATA.examples;
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

  /* ============================================================ Beispiele (eingebaut als Rückfall, sendata.js hat Vorrang) */
  /* Auswahlwerte werden über Wert oder Beschriftung zugeordnet; passt ein Wert nicht, bleibt die Voreinstellung. { rel: 0…1 } setzt einen Schieber relativ zum Bereich. */
  const B = (id, name, cat, rig, desc, controls, extra) => Object.assign({ id, name, cat, rig, desc, controls }, extra || {});
  const BUILTIN = [
    B('temp-ntc', 'NTC im Spannungsteiler', 'Temperatur', 'temperatur', 'Ein NTC 10 kΩ bildet mit einem Festwiderstand einen Spannungsteiler. Ändere die Temperatur und beobachte Widerstand, Spannung und Zählwert.', { sensor: 'NTC', circuit: 'Spannungsteiler', tMeas: 25 }),
    B('temp-sprung', 'Temperatursprung: Trägheit der Sonde', 'Temperatur', 'temperatur', 'Die Messstelle springt von 25 auf 150 °C. Die Sonde braucht Zeit, ihre Zeitkonstante zeigt der Schreiber.', { sensor: 'PT100', tMeas: 25 }, {
      dur: 60, rows: [{ t: 0, key: 'tMeas', value: 25 }, { t: 2, key: 'tMeas', value: 150 }, { t: 30, key: 'tMeas', value: 25 }] }),
    B('temp-2leiter', 'Fehler: Leitungswiderstand bei 2-Leiter', 'Temperatur', 'temperatur', 'Der Leitungswiderstand addiert sich zum PT100 und verfälscht die Anzeige. 3- und 4-Leiter-Schaltung gleichen ihn aus.', { sensor: 'PT100', tMeas: 100, lead: { rel: 0.1 }, wires: 2 }, {
      dur: 30, rows: [{ t: 0, key: 'wires', value: 2 }, { t: 10, key: 'wires', value: 3 }, { t: 20, key: 'wires', value: 4 }] }),
    B('temp-selfheat', 'Fehler: Selbsterwärmung', 'Temperatur', 'temperatur', 'Ein zu großer Messstrom heizt den NTC selbst auf, die Anzeige liegt zu hoch.', { sensor: 'NTC', selfHeat: true, rRef: { rel: 0 }, tMeas: 25 }),
    B('temp-draht', 'Fehler: Drahtbruch', 'Temperatur', 'temperatur', 'Nach 5 s reißt die Sensorleitung kurz ab. Achte auf Spannung, Zählwert und Meldung.', { sensor: 'NTC', tMeas: 40 }, {
      dur: 14, rows: [{ t: 5, key: 'wireBreak', value: true }, { t: 9, key: 'wireBreak', value: false }] }),
    B('licht-ldr', 'LDR: hell und dunkel', 'Licht und Näherung', 'licht', 'Ein Fotowiderstand ändert seinen Widerstand mit der Beleuchtung, aber nicht linear und eher langsam.', { sensor: 'LDR', lux: 50 }, {
      dur: 15, rows: [{ t: 0, key: 'lux', value: 50 }, { t: 5, key: 'lux', value: 20000 }, { t: 10, key: 'lux', value: 50 }] }),
    B('licht-ind', 'Induktiver Näherungsschalter: Stahl und Alu', 'Licht und Näherung', 'licht', 'Der Schaltabstand hängt vom Material ab: Alu schaltet erst deutlich näher (Reduktionsfaktor).', { sensor: 'induktiv', material: 'Stahl', dist: 20 }, {
      dur: 14, rows: [{ t: 0, key: 'dist', value: 20 }, { t: 3, key: 'dist', value: 5 }, { t: 6, key: 'material', value: 'Alu' }, { t: 8, key: 'dist', value: 20 }, { t: 10, key: 'dist', value: 5 }] }),
    B('licht-hyst', 'Flattern ohne Hysterese', 'Licht und Näherung', 'licht', 'Ohne Hysterese flattert der Schaltausgang an der Schwelle. Nach 10 s wird die Hysterese eingestellt.', { sensor: 'LDR', hyst: { rel: 0 } }, {
      dur: 20, rows: [{ t: 10, key: 'hyst', value: { rel: 0.5 } }] }),
    B('licht-fremd', 'Fehler: Fremdlicht', 'Licht und Näherung', 'licht', 'Helles Fremdlicht stört die Lichtschranke, sie schaltet falsch.', { sensor: 'Reflexlichtschranke', ambient: { rel: 0.9 } }),
    B('kraft-voll', 'Vollbrücke: Kraft messen', 'Kraft und Druck', 'kraft', 'Vier DMS in der Vollbrücke liefern die größte Ausgangsspannung. Ändere die Kraft und lies die Anzeige ab.', { bridge: 'Vollbrücke', uBridge: 5, force: { rel: 0.5 } }),
    B('kraft-schleife', 'Hysterese-Schleife', 'Kraft und Druck', 'kraft', 'Belasten bis zur Nennlast und entlasten: Hin- und Rückweg unterscheiden sich ein wenig, das ist die Hysterese. Über der Nennlast bricht der Balken.', { bridge: 'Vollbrücke', force: { rel: 0 } }, {
      dur: 15, rows: [{ t: 0, key: 'force', value: { rel: 0 } }, { t: 3, key: 'force', value: { rel: 0.25 } }, { t: 6, key: 'force', value: { rel: 0.5 } }, { t: 9, key: 'force', value: { rel: 0.25 } }, { t: 12, key: 'force', value: { rel: 0 } }] }),
    B('kraft-drift', 'Fehler: Temperaturdrift', 'Kraft und Druck', 'kraft', 'Bei hoher Temperatur driftet die Messbrücke, der Nullpunkt wandert.', { bridge: 'Viertelbrücke', temp: { rel: 0.9 }, force: { rel: 0 } }),
    B('kraft-uebersteuert', 'Fehler: Verstärker übersteuert', 'Kraft und Druck', 'kraft', 'Mit sehr großer Verstärkung läuft der Wandler an den Anschlag. Die Anzeige ist dann falsch.', { gain: { rel: 1 }, force: { rel: 0.4 } }),
    B('beschl-neigung', 'Neigung messen', 'Beschleunigung', 'beschleunigung', 'Der Sensor misst die Erdbeschleunigung in drei Achsen. Aus den Anteilen berechnest du den Neigungswinkel.', { tiltX: 30, tiltY: 0 }),
    B('beschl-clip', 'Fehler: Messbereich zu klein', 'Beschleunigung', 'beschleunigung', 'Ein Stoß größer als der Messbereich wird abgeschnitten (Clipping).', { range: 2, shock: { rel: 0.6 } }),
    B('beschl-vib', 'Schwingung messen', 'Beschleunigung', 'beschleunigung', 'Eine Schwingung überlagert den Messwert. Datenrate und Filter entscheiden, was du siehst.', { vibFreq: { rel: 0.3 }, vibAmp: { rel: 0.5 } }),
    B('norm-420', '4…20 mA: Messumformer mit Bürde', 'Normsignale', 'normsignal', 'Der Messumformer liefert 4 mA bei 0 % und 20 mA bei 100 %. Die Bürde macht daraus eine Spannung.', { signal: '4…20', rBurden: 250, uSupply: 24 }),
    B('norm-draht', 'Drahtbruch erkennen', 'Normsignale', 'normsignal', 'Bei 4…20 mA ist 0 mA ein Fehler (Live Zero). Nach 5 s wird die Schleife unterbrochen.', { signal: '4…20', rBurden: 250 }, {
      dur: 14, rows: [{ t: 5, key: 'wireBreak', value: true }, { t: 10, key: 'wireBreak', value: false }] }),
    B('norm-buerde', 'Fehler: Bürde zu groß', 'Normsignale', 'normsignal', 'Bei 12 V Versorgung und großer Bürde bleibt dem Messumformer zu wenig Spannung: Das Signal geht in die Sättigung.', { uSupply: 12, rBurden: { rel: 1 } }),
    B('norm-010', '0…10 V: Spannungsabfall auf der Leitung', 'Normsignale', 'normsignal', 'Ein Spannungssignal leidet unter Leitungswiderstand und Störungen, ein Stromsignal viel weniger.', { signal: '0…10', rLine: { rel: 1 } }),
    B('dig-sht', 'Temperatur und Feuchte per I²C', 'Digitale Sensoren', 'digital', 'Der Sensor liefert Rohwerte per I²C. Im Logikanalysator siehst du Start, Adresse, Daten und Prüfsumme.', { pullup: 4700, busSpeed: 100 }),
    B('dig-pullup', 'Fehler: Pull-up zu groß', 'Digitale Sensoren', 'digital', 'Ein zu großer Pull-up macht die Flanken zu langsam: Bei 400 kHz und langem Bus gehen Daten verloren.', { pullup: 47000, busSpeed: 400, busLength: { rel: 1 } }),
    B('dig-gas', 'Gassensor mit Heizung', 'Digitale Sensoren', 'digital', 'Gassensoren brauchen eine Heizung und Zeit. Ändere die Gaskonzentration und beobachte die Anzeige.', { sensor: 'Gas', gas: { rel: 0.4 } }),
    B('adu-quant', '4-Bit-ADU: Treppenstufen', 'ADU und Abtastung', 'adu', 'Mit nur 4 Bit ist jede Stufe grob. Der Quantisierungsfehler ist gut zu sehen.', { wave: 'Sinus', bits: 4 }),
    B('adu-alias', 'Aliasing: 900 Hz bei 1 kHz Abtastung', 'ADU und Abtastung', 'adu', 'Das Abtasttheorem ist verletzt: Ein 900-Hz-Signal erscheint als 100 Hz.', { wave: 'Sinus', fSig: 900, fs: 1000, aaf: false }),
    B('adu-aaf', 'Anti-Aliasing-Filter', 'ADU und Abtastung', 'adu', 'Ein Tiefpass vor dem ADU unterdrückt Frequenzen oberhalb der halben Abtastrate.', { wave: 'Sinus', fSig: 900, fs: 1000, aaf: true })
  ];
  /* Zeilenwerte der Form { rel } in Zahlen umsetzen (Prüfstand muss gesetzt sein) */
  function fixRows(rows) {
    return (rows || []).map(r => { if (r && r.value && typeof r.value === 'object' && 'rel' in r.value) { const v = coerce(ctlDef(r.key), r.value); return Object.assign({}, r, { value: v === undefined ? 0 : v }); } return r; });
  }
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
    const d = root.SEN_DATA; let a = d && d.examples;
    if (a && !Array.isArray(a)) a = Object.keys(a).map(k => Object.assign({ id: k }, a[k]));
    if (!a || !a.length) a = BUILTIN;
    return a.map(e => ({ id: e.id, name: e.name, cat: e.cat || 'Beispiele', desc: e.desc || e.text || '', rig: e.rig, controls: e.controls || {}, dur: e.dur, rows: e.rows ? clone(e.rows) : (e.seq ? seqToRows(e.seq) : null), seq: e.seq }));
  }
  function loadExample(e) {
    if (!e) return false; const had = stash(); S.task = null;
    setRig(e.rig && ORDER.includes(e.rig) ? e.rig : S.rigId || ORDER[0]);
    applyCtl(e.controls);
    S.rows[S.rigId] = e.rows ? fixRows(clone(e.rows)) : []; if (!S.seqDur) S.seqDur = {}; S.seqDur[S.rigId] = e.dur ? (e.dur > 500 ? e.dur / 1000 : e.dur) : null; S.seqRes = null;
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
  const PK = 'sen.saves';
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
    let url; try { url = location.href.split('#')[0].split('?')[0] + '#' + await packShare({ k: 'sen', name: S.name, rig: S.rigId, ctl: allCtl(), rows: curRows(), dur: seqDur() }); } catch (e) { toast('Teilen nicht möglich'); return; }
    if (navigator.share) { try { await navigator.share({ title: 'Tonfunk Sensorik-Lab: ' + S.name, text: 'Schau dir meinen Sensorik-Versuch „' + S.name + '“ an:', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
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
  const TK = () => (root.SEN_TASKS && Array.isArray(root.SEN_TASKS.tasks) && root.SEN_TASKS.tasks.length ? root.SEN_TASKS.tasks : null);
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
    S.rows[S.rigId] = fixRows(o.rows ? clone(o.rows) : seqToRows(o.seq)); if (!S.seqDur) S.seqDur = {}; S.seqDur[S.rigId] = o.dur ? (o.dur > 500 ? o.dur / 1000 : o.dur) : null; S.seqRes = null;
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
    const t = curTask(); if (!t) return; const R = root.SEN_TASKS;
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
    if (!A) { V.innerHTML = '<div class="card pl"><h4>Aufgaben</h4><p class="big">Aufgaben folgen</p><p class="hint2">Hier erscheinen bald Aufgaben mit automatischer Prüfung: Grundlagen, Temperatur, Licht und Näherung, Druck und Kraft, Beschleunigung, Normsignale, ADU, digitale Sensoren, Fehlersuche und Prüfungsaufgaben. Bis dahin kannst du mit den Beispielen und dem Rechner üben.</p><div class="btns"><button class="btn pri" id="tkEx">Beispiele ansehen</button><button class="btn" id="tkRetry" data-retry>Erneut prüfen</button></div></div>'; $('#tkEx', V).onclick = openExamples; return; }
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
  const gz = (x, d) => fnum(x, d == null ? 2 : d);
  const ex4 = x => x.toExponential(4).replace('.', ',');
  const T25 = 298.15, A_PT = 3.9083e-3, B_PT = -5.775e-7, C_PT = -4.183e-12;
  const ptR = (R0, T) => (T >= 0 ? R0 * (1 + A_PT * T + B_PT * T * T) : R0 * (1 + A_PT * T + B_PT * T * T + C_PT * (T - 100) * T * T * T));
  function ptT(R0, R) {   /* Umkehrung durch Intervallhalbierung (ptR ist im Bereich streng steigend) */
    let lo = -200, hi = 850; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (ptR(R0, m) < R) lo = m; else hi = m; } return (lo + hi) / 2;
  }
  const ntcR = (R25, B, T) => R25 * Math.exp(B * (1 / (T + 273.15) - 1 / T25));
  const msgPos = (v, keys) => (keys.some(k => !(v[k] > 0)) ? 'Diese Werte müssen größer als 0 sein.' : '');
  const CALC = [
    { id: 'ntcR', name: 'NTC: Widerstand aus Temperatur', inp: [{ k: 'R25', l: 'Nennwiderstand R25 (bei 25 °C)', u: 'Ω', d: 10000 }, { k: 'B', l: 'B-Wert', u: 'K', d: 3950 }, { k: 'T', l: 'Temperatur ϑ', u: '°C', d: 50 }],
      chk: v => (msgPos(v, ['R25', 'B']) || (v.T <= -273.15 ? 'Die Temperatur muss über −273,15 °C liegen.' : '')),
      fn: v => { const Tk = v.T + 273.15, R = ntcR(v.R25, v.B, v.T); return { res: [['Widerstand R(ϑ)', R, 'Ω', 0], ['Widerstand R(ϑ)', R / 1000, 'kΩ', 3]], steps: ['T = ϑ + 273,15 K', `T = ${gz(v.T, 1)} + 273,15 = ${gz(Tk, 2)} K`, 'R = R25 · e^(B · (1/T − 1/298,15 K))', `1/T − 1/298,15 K = ${ex4(1 / Tk - 1 / T25)} 1/K`, `R = ${gz(v.R25, 0)} Ω · e^(${gz(v.B, 0)} K · ${ex4(1 / Tk - 1 / T25)} 1/K) = ${gz(R, 1)} Ω`] }; } },
    { id: 'ntcT', name: 'NTC: Temperatur aus Widerstand', inp: [{ k: 'R25', l: 'Nennwiderstand R25 (bei 25 °C)', u: 'Ω', d: 10000 }, { k: 'B', l: 'B-Wert', u: 'K', d: 3950 }, { k: 'R', l: 'gemessener Widerstand R', u: 'Ω', d: 3588 }],
      chk: v => msgPos(v, ['R25', 'B', 'R']),
      fn: v => { const Tk = 1 / (1 / T25 + Math.log(v.R / v.R25) / v.B); return { res: [['Temperatur ϑ', Tk - 273.15, '°C', 1], ['Temperatur T', Tk, 'K', 1]], steps: ['1/T = 1/298,15 K + ln(R/R25) / B', `ln(R/R25) = ln(${gz(v.R, 1)} / ${gz(v.R25, 0)}) = ${gz(Math.log(v.R / v.R25), 4)}`, `1/T = ${ex4(1 / T25)} + ${gz(Math.log(v.R / v.R25), 4)} / ${gz(v.B, 0)} = ${ex4(1 / Tk)} 1/K`, `T = ${gz(Tk, 2)} K`, `ϑ = T − 273,15 = ${gz(Tk - 273.15, 1)} °C`] }; } },
    { id: 'ptR', name: 'PT100 / PT1000: Widerstand aus Temperatur', inp: [{ k: 'R0', l: 'Nennwiderstand R0 (bei 0 °C)', u: 'Ω', d: 100 }, { k: 'T', l: 'Temperatur ϑ', u: '°C', d: 100 }],
      chk: v => (msgPos(v, ['R0']) || (v.T < -200 || v.T > 850 ? 'Der Bereich der Formel geht von −200 bis 850 °C.' : '')),
      fn: v => { const R = ptR(v.R0, v.T); return { res: [['Widerstand R(ϑ)', R, 'Ω', 2], ['Änderung gegenüber R0', R - v.R0, 'Ω', 2]], steps: v.T >= 0 ? ['R = R0 · (1 + A·ϑ + B·ϑ²) mit A = 3,9083·10⁻³ 1/°C, B = −5,775·10⁻⁷ 1/°C²', `R = ${gz(v.R0, 1)} Ω · (1 + 3,9083·10⁻³ · ${gz(v.T, 1)} + (−5,775·10⁻⁷) · ${gz(v.T, 1)}²)`, `R = ${gz(v.R0, 1)} Ω · ${gz(1 + A_PT * v.T + B_PT * v.T * v.T, 5)} = ${gz(R, 2)} Ω`] : ['Unter 0 °C kommt ein weiteres Glied dazu: R = R0 · (1 + A·ϑ + B·ϑ² + C·(ϑ − 100 °C)·ϑ³) mit C = −4,183·10⁻¹² 1/°C⁴', `R = ${gz(R, 2)} Ω`] }; } },
    { id: 'ptT', name: 'PT100 / PT1000: Temperatur aus Widerstand', inp: [{ k: 'R0', l: 'Nennwiderstand R0 (bei 0 °C)', u: 'Ω', d: 100 }, { k: 'R', l: 'gemessener Widerstand R', u: 'Ω', d: 138.5 }],
      chk: v => msgPos(v, ['R0', 'R']),
      fn: v => { const T = ptT(v.R0, v.R), lin = (v.R - v.R0) / (v.R0 * 3.85e-3); return { res: [['Temperatur ϑ', T, '°C', 2], ['Näherung linear (0,385 % je K)', lin, '°C', 2]], steps: ['Für ϑ ≥ 0 °C löst man R = R0 · (1 + A·ϑ + B·ϑ²) nach ϑ auf:', 'ϑ = (−A + √(A² − 4·B·(1 − R/R0))) / (2·B)', `R / R0 = ${gz(v.R / v.R0, 5)}`, `ϑ = ${gz(T, 2)} °C`, `Grobe Näherung: ϑ ≈ (R − R0) / (R0 · 0,00385) = ${gz(lin, 2)} °C. Sie wird nach oben immer ungenauer.`] }; } },
    { id: 'teiler', name: 'Spannungsteiler mit Sensor', inp: [{ k: 'U', l: 'Versorgung U', u: 'V', d: 3.3 }, { k: 'Rr', l: 'Referenzwiderstand R', u: 'Ω', d: 10000 }, { k: 'Rs', l: 'Sensorwiderstand R_S', u: 'Ω', d: 10000 }],
      chk: v => (v.U < 0 || v.Rr <= 0 || v.Rs < 0 ? 'U ≥ 0, R > 0 und R_S ≥ 0 eingeben.' : ''),
      fn: v => { const I = v.U / (v.Rr + v.Rs), Ua = v.U * v.Rs / (v.Rr + v.Rs); return { res: [['Ausgangsspannung U_a', Ua, 'V', 3], ['Messstrom I', I * 1000, 'mA', 3], ['Verlustleistung im Sensor', I * I * v.Rs * 1000, 'mW', 3]], steps: ['Der Sensor liegt unten: U_a = U · R_S / (R + R_S)', `U_a = ${gz(v.U)} V · ${gz(v.Rs, 0)} / (${gz(v.Rr, 0)} + ${gz(v.Rs, 0)}) = ${gz(Ua, 3)} V`, 'I = U / (R + R_S)', `I = ${gz(v.U)} V / ${gz(v.Rr + v.Rs, 0)} Ω = ${gz(I * 1000, 3)} mA`, 'P_S = I² · R_S (heizt den Sensor: Selbsterwärmung)', `P_S = (${gz(I * 1000, 3)} mA)² · ${gz(v.Rs, 0)} Ω = ${gz(I * I * v.Rs * 1000, 3)} mW`] }; } },
    { id: 'bridge', name: 'Brückenspannung (Viertelbrücke)', inp: [{ k: 'U', l: 'Speisespannung U', u: 'V', d: 5 }, { k: 'R', l: 'Brückenwiderstand R', u: 'Ω', d: 350 }, { k: 'Rs', l: 'Sensorwiderstand R_S', u: 'Ω', d: 350.7 }],
      chk: v => (v.U < 0 || v.R <= 0 || v.Rs < 0 ? 'U ≥ 0, R > 0 und R_S ≥ 0 eingeben.' : ''),
      fn: v => { const Ud = v.U * (v.Rs / (v.R + v.Rs) - 0.5); return { res: [['Brückenspannung U_d', Ud * 1000, 'mV', 3], ['Verhältnis U_d / U', Ud / v.U * 1000, 'mV/V', 3]], steps: ['Drei feste Widerstände R und ein Sensor R_S: Der Referenzzweig liefert U/2.', 'U_d = U · (R_S / (R + R_S) − R / (R + R))', `U_d = ${gz(v.U)} V · (${gz(v.Rs, 2)} / ${gz(v.R + v.Rs, 2)} − 0,5) = ${gz(Ud * 1000, 3)} mV`, 'Abgeglichen (R_S = R) ist U_d = 0. Das Vorzeichen hängt davon ab, wo der Sensor sitzt.'] }; } },
    { id: 'dms', name: 'DMS: Widerstandsänderung und Brückenspannung', inp: [{ k: 'k', l: 'k-Faktor', u: '', d: 2 }, { k: 'e', l: 'Dehnung ε', u: 'µm/m', d: 500 }, { k: 'R', l: 'DMS-Widerstand R', u: 'Ω', d: 350 }, { k: 'U', l: 'Speisespannung U', u: 'V', d: 5 }],
      chk: v => (v.R <= 0 ? 'R muss größer als 0 sein.' : ''),
      fn: v => { const eps = v.e * 1e-6, dR = v.R * v.k * eps, Rs = v.R + dR, Uq = v.U * (Rs / (v.R + Rs) - 0.5); return { res: [['Widerstandsänderung ΔR', dR, 'Ω', 4], ['Viertelbrücke U_d', Uq * 1000, 'mV', 3], ['Halbbrücke U_d', v.U * v.k * eps / 2 * 1000, 'mV', 3], ['Vollbrücke U_d', v.U * v.k * eps * 1000, 'mV', 3]], steps: ['ε = Dehnung / 10⁶ (µm/m ist 10⁻⁶)', `ε = ${gz(v.e, 0)} µm/m = ${ex4(eps)}`, 'ΔR / R = k · ε', `ΔR = ${gz(v.R, 1)} Ω · ${gz(v.k, 2)} · ${ex4(eps)} = ${gz(dR, 4)} Ω`, 'Viertelbrücke: U_d ≈ U · k · ε / 4 (exakt aus dem Teiler gerechnet)', 'Halbbrücke: U_d = U · k · ε / 2', 'Vollbrücke: U_d = U · k · ε', `Vollbrücke: ${gz(v.U)} V · ${gz(v.k, 2)} · ${ex4(eps)} = ${gz(v.U * v.k * eps * 1000, 3)} mV`] }; } },
    { id: 'gain', name: 'Verstärkung aus dem Messbereich', inp: [{ k: 'Us', l: 'größte Sensorspannung', u: 'mV', d: 25 }, { k: 'Ur', l: 'Eingangsbereich des ADU (U_ref)', u: 'V', d: 3.3 }],
      chk: v => msgPos(v, ['Us', 'Ur']),
      fn: v => { const G = v.Ur * 1000 / v.Us; return { res: [['größtmögliche Verstärkung G', G, '', 1], ['Verstärkung in dB', 20 * Math.log10(G), 'dB', 1]], steps: ['Das größte Sensorsignal soll den ADU-Bereich ausnutzen:', 'G = U_ref / U_Sensor,max', `G = ${gz(v.Ur * 1000, 0)} mV / ${gz(v.Us, 2)} mV = ${gz(G, 1)}`, 'Wähle in der Praxis den nächstkleineren Standardwert, damit der ADU nicht übersteuert.'] }; } },
    { id: 'ina', name: 'Instrumentenverstärker: Verstärkung aus R_G', inp: [{ k: 'Rg', l: 'Verstärkungswiderstand R_G', u: 'Ω', d: 500 }],
      chk: v => msgPos(v, ['Rg']),
      fn: v => { const G = 1 + 49400 / v.Rg; return { res: [['Verstärkung G', G, '', 1]], steps: ['Beispiel AD620: G = 1 + 49,4 kΩ / R_G', `G = 1 + 49400 Ω / ${gz(v.Rg, 1)} Ω = ${gz(G, 1)}`, 'Ohne R_G (offen) ist G = 1. Die Formel gilt für diesen Baustein, andere haben andere Konstanten.'] }; } },
    { id: 'norm', name: 'Normsignal skalieren (4…20 mA, 0…10 V)', inp: [{ k: 'I', l: 'gemessenes Signal (mA oder V)', u: '', d: 12 }, { k: 'Ia', l: 'Signal bei Messbereichsanfang', u: '', d: 4 }, { k: 'Ie', l: 'Signal bei Messbereichsende', u: '', d: 20 }, { k: 'Ma', l: 'Messbereichsanfang', u: '', d: 0 }, { k: 'Me', l: 'Messbereichsende', u: '', d: 10 }],
      chk: v => (v.Ie === v.Ia ? 'Anfang und Ende des Signals dürfen nicht gleich sein.' : ''),
      fn: v => { const p = (v.I - v.Ia) / (v.Ie - v.Ia), M = v.Ma + p * (v.Me - v.Ma); const live = v.Ia > 0 && v.I < v.Ia * 0.9; return { res: [['Messgröße', M, '', 3], ['Anteil am Messbereich', p * 100, '%', 1]], steps: ['Anteil = (Signal − Anfang) / (Ende − Anfang)', `Anteil = (${gz(v.I)} − ${gz(v.Ia)}) / (${gz(v.Ie)} − ${gz(v.Ia)}) = ${gz(p, 4)} = ${gz(p * 100, 1)} %`, 'Messgröße = Anfang + Anteil · (Ende − Anfang)', `Messgröße = ${gz(v.Ma)} + ${gz(p, 4)} · (${gz(v.Me)} − ${gz(v.Ma)}) = ${gz(M, 3)}`, live ? 'Achtung: Das Signal liegt unter dem Messbereichsanfang (Live Zero). Bei 4…20 mA ist ein Wert unter etwa 3,6 mA ein Fehler, zum Beispiel Drahtbruch.' : 'Das Signal liegt im gültigen Bereich.'] }; } },
    { id: 'burden', name: 'Bürde und Messumformer-Versorgung', inp: [{ k: 'Us', l: 'Versorgungsspannung U_S', u: 'V', d: 24 }, { k: 'Um', l: 'Mindestspannung am Messumformer', u: 'V', d: 12 }, { k: 'Rb', l: 'Bürde R_B', u: 'Ω', d: 250 }, { k: 'Rl', l: 'Leitungswiderstand (Hin- und Rückleiter)', u: 'Ω', d: 20 }],
      chk: v => (v.Us <= 0 || v.Um < 0 || v.Rb < 0 || v.Rl < 0 ? 'Die Werte dürfen nicht negativ sein.' : ''),
      fn: v => { const Rmax = (v.Us - v.Um) / 0.02, Ub20 = 0.02 * v.Rb, Ub4 = 0.004 * v.Rb, ok = v.Rb + v.Rl <= Rmax; return { res: [['Bürdenspannung bei 20 mA', Ub20, 'V', 2], ['Bürdenspannung bei 4 mA', Ub4, 'V', 2], ['größte zulässige Gesamtbürde', Rmax, 'Ω', 0], ['Reserve', Rmax - v.Rb - v.Rl, 'Ω', 0]], steps: ['U_B = I · R_B', `U_B(20 mA) = 0,020 A · ${gz(v.Rb, 0)} Ω = ${gz(Ub20)} V`, `U_B(4 mA) = 0,004 A · ${gz(v.Rb, 0)} Ω = ${gz(Ub4)} V`, 'R_max = (U_S − U_min) / 20 mA', `R_max = (${gz(v.Us, 1)} V − ${gz(v.Um, 1)} V) / 0,020 A = ${gz(Rmax, 0)} Ω`, ok ? `R_B + R_Leitung = ${gz(v.Rb + v.Rl, 0)} Ω ist kleiner als R_max: Das passt.` : `R_B + R_Leitung = ${gz(v.Rb + v.Rl, 0)} Ω ist größer als R_max: Der Messumformer kommt bei 20 mA in die Sättigung!`] }; } },
    { id: 'lsb', name: 'ADU: LSB und Zählwert', inp: [{ k: 'n', l: 'Auflösung n', u: 'Bit', d: 10 }, { k: 'Ur', l: 'Referenzspannung U_ref', u: 'V', d: 3.3 }, { k: 'Uin', l: 'Eingangsspannung', u: 'V', d: 1 }],
      chk: v => (!(v.n >= 1 && v.n <= 24) || Math.round(v.n) !== v.n ? 'Die Auflösung muss eine ganze Zahl von 1 bis 24 sein.' : (v.Ur <= 0 ? 'U_ref muss größer als 0 sein.' : '')),
      fn: v => { const st = Math.pow(2, v.n), lsb = v.Ur / st, N = Math.max(0, Math.min(st - 1, Math.floor(v.Uin / lsb))); return { res: [['Anzahl Stufen', st, '', 0], ['LSB', lsb * 1000, 'mV', 3], ['Zählwert N', N, '', 0], ['Quantisierungsfehler (max.)', lsb * 500, 'mV', 3]], steps: ['Stufen = 2ⁿ', `Stufen = 2^${gz(v.n, 0)} = ${gz(st, 0)}`, 'LSB = U_ref / 2ⁿ', `LSB = ${gz(v.Ur)} V / ${gz(st, 0)} = ${gz(lsb * 1000, 3)} mV`, 'N = abgerundet(U_ein / LSB)', `N = abgerundet(${gz(v.Uin, 3)} V / ${gz(lsb, 6)} V) = ${gz(N, 0)}`, 'Der Quantisierungsfehler beträgt höchstens ±LSB/2.'] }; } },
    { id: 'snr', name: 'ADU: Rauschabstand und effektive Bitzahl', inp: [{ k: 'n', l: 'Auflösung n', u: 'Bit', d: 12 }, { k: 'sinad', l: 'gemessener Signal-Rausch-Abstand', u: 'dB', d: 68 }],
      chk: v => (v.n < 1 || v.n > 24 ? 'Die Auflösung muss zwischen 1 und 24 Bit liegen.' : ''),
      fn: v => { const snr = 6.02 * v.n + 1.76, enob = (v.sinad - 1.76) / 6.02; return { res: [['idealer SNR', snr, 'dB', 1], ['effektive Bitzahl (ENOB)', enob, 'Bit', 2]], steps: ['Ideal (nur Quantisierung, Vollaussteuerung mit Sinus): SNR = 6,02 · n + 1,76 dB', `SNR = 6,02 · ${gz(v.n, 0)} + 1,76 = ${gz(snr, 1)} dB`, 'Aus einem gemessenen Wert: ENOB = (SNR − 1,76 dB) / 6,02 dB', `ENOB = (${gz(v.sinad, 1)} − 1,76) / 6,02 = ${gz(enob, 2)} Bit`] }; } },
    { id: 'alias', name: 'Abtasttheorem und Aliasing', inp: [{ k: 'f', l: 'Signalfrequenz f', u: 'Hz', d: 900 }, { k: 'fs', l: 'Abtastfrequenz f_s', u: 'Hz', d: 1000 }],
      chk: v => msgPos(v, ['f', 'fs']),
      fn: v => { const fa = Math.abs(v.f - Math.round(v.f / v.fs) * v.fs), al = v.f > v.fs / 2; return { res: [['Nyquist-Frequenz f_s/2', v.fs / 2, 'Hz', 1], ['kleinste zulässige Abtastfrequenz', 2 * v.f, 'Hz', 0], [al ? 'Alias-Frequenz' : 'erkannte Frequenz', al ? fa : v.f, 'Hz', 1]], steps: ['Abtasttheorem: f_s > 2 · f_max', `f_s/2 = ${gz(v.fs / 2, 1)} Hz, Signal: ${gz(v.f, 1)} Hz`, al ? 'Das Signal liegt über f_s/2: Es wird gespiegelt (Aliasing).' : 'Das Signal liegt unter f_s/2: Es wird richtig erfasst.', 'f_Alias = |f − k · f_s| mit der ganzen Zahl k, die f_Alias am kleinsten macht', `f_Alias = |${gz(v.f, 1)} − ${gz(Math.round(v.f / v.fs), 0)} · ${gz(v.fs, 1)}| = ${gz(fa, 1)} Hz`] }; } },
    { id: 'pullup', name: 'I²C: Pull-up abschätzen', inp: [{ k: 'Vcc', l: 'Busspannung', u: 'V', d: 3.3 }, { k: 'Cb', l: 'Buskapazität C_B', u: 'pF', d: 100 }, { k: 'tr', l: 'höchstzulässige Anstiegszeit t_r', u: 'ns', d: 1000 }],
      chk: v => (v.Vcc <= 0.4 || v.Cb <= 0 || v.tr <= 0 ? 'Busspannung über 0,4 V, C_B und t_r größer als 0 eingeben.' : ''),
      fn: v => { const Rmax = v.tr * 1e-9 / (0.8473 * v.Cb * 1e-12), Rmin = (v.Vcc - 0.4) / 0.003; return { res: [['größter Pull-up R_max', Rmax, 'Ω', 0], ['kleinster Pull-up R_min', Rmin, 'Ω', 0]], steps: ['Der Anstieg folgt der RC-Kurve (von 30 % auf 70 % in 0,8473 · R · C):', 'R_max = t_r / (0,8473 · C_B)', `R_max = ${gz(v.tr, 0)} ns / (0,8473 · ${gz(v.Cb, 0)} pF) = ${gz(Rmax, 0)} Ω`, 'R_min = (U_CC − 0,4 V) / 3 mA (der Sensor darf höchstens 3 mA gegen Low ziehen)', `R_min = (${gz(v.Vcc, 2)} V − 0,4 V) / 0,003 A = ${gz(Rmin, 0)} Ω`, 'Für t_r nimmt man bei 100 kHz bis 1000 ns, bei 400 kHz bis 300 ns. Wähle einen Wert zwischen R_min und R_max.'] }; } },
    { id: 'selfheat', name: 'Selbsterwärmung eines Sensors', inp: [{ k: 'I', l: 'Messstrom I', u: 'mA', d: 1 }, { k: 'R', l: 'Sensorwiderstand R', u: 'Ω', d: 10000 }, { k: 'd', l: 'Wärmeableitung (Dissipationskonstante)', u: 'mW/K', d: 1.5 }],
      chk: v => (v.I < 0 || v.R < 0 || v.d <= 0 ? 'I und R nicht negativ, Wärmeableitung größer als 0 eingeben.' : ''),
      fn: v => { const P = v.I * v.I * v.R / 1000, dT = P / v.d; return { res: [['Verlustleistung P', P, 'mW', 3], ['Übertemperatur ΔT', dT, 'K', 2]], steps: ['P = I² · R', `P = (${gz(v.I, 3)} mA)² · ${gz(v.R, 0)} Ω = ${gz(P, 3)} mW`, 'ΔT = P / δ', `ΔT = ${gz(P, 3)} mW / ${gz(v.d, 2)} mW/K = ${gz(dT, 2)} K`, 'Um so viel zeigt der Sensor zu viel an. Gegenmittel: kleiner Messstrom, gepulster Betrieb.'] }; } },
    { id: 'lead2', name: 'PT100: Fehler durch Leitungswiderstand (2-Leiter)', inp: [{ k: 'R0', l: 'Nennwiderstand R0', u: 'Ω', d: 100 }, { k: 'Rl', l: 'Widerstand einer Zuleitung', u: 'Ω', d: 1 }],
      chk: v => (v.R0 <= 0 || v.Rl < 0 ? 'R0 größer als 0 und R_L nicht negativ eingeben.' : ''),
      fn: v => { const S = v.R0 * 0.00385, dT = 2 * v.Rl / S; return { res: [['Fehlwiderstand (hin und zurück)', 2 * v.Rl, 'Ω', 2], ['Temperaturfehler', dT, 'K', 2]], steps: ['In der 2-Leiter-Schaltung liegen beide Zuleitungen in Reihe zum Sensor: ΔR = 2 · R_L', `ΔR = 2 · ${gz(v.Rl, 2)} Ω = ${gz(2 * v.Rl, 2)} Ω`, `Empfindlichkeit um 0 °C: S ≈ R0 · 0,00385 = ${gz(S, 3)} Ω/K`, `ΔT = ΔR / S = ${gz(2 * v.Rl, 2)} / ${gz(S, 3)} = ${gz(dT, 2)} K`, 'Mit 3- oder 4-Leiter-Schaltung wird dieser Fehler herausgerechnet.'] }; } }
  ];
  const calcVals = {};
  let calcId = 'ntcR', exCur = null, exScore = { ok: 0, n: 0, streak: 0 };
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
    const m = c.chk ? c.chk(v) : ''; if (m) { box.innerHTML = `<div class="res"><span class="hint2">${esc(m)}</span></div>`; return; }
    let r; try { r = c.fn(v); } catch (e) { r = null; }
    if (!r || r.res.some(x => !isFinite(x[1]))) { box.innerHTML = '<div class="res"><span class="hint2">Das lässt sich mit diesen Werten nicht berechnen.</span></div>'; return; }
    box.innerHTML = `<div class="res">${r.res.map(x => `<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>${esc(x[0])}</span><span class="big2">${gz(x[1], x[3])} ${esc(x[2])}</span></div>`).join('')}<details open><summary style="min-height:36px;display:flex;align-items:center;color:var(--accent);cursor:pointer">Rechenweg</summary><ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></details></div>`;
  }
  /* ---- Übungsgenerator ---- */
  const rn = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pk = a => a[Math.floor(Math.random() * a.length)], r1 = (x, d) => Math.round(x * Math.pow(10, d)) / Math.pow(10, d);
  function genEx() {
    const kind = pk(['ntc', 'ntc', 'pt', 'ptT', 'dms', 'dms', 'gain', 'loop', 'loop', 'burden', 'lsb', 'lsb', 'snr', 'alias', 'alias', 'pullup', 'selfheat', 'lead2', 'count']);
    if (kind === 'ntc') {
      const R25 = pk([2200, 4700, 10000, 22000, 100000]), B = pk([3380, 3435, 3950, 4050]), T = pk([0, 10, 40, 50, 60, 80, 100]), R = ntcR(R25, B, T), Tk = T + 273.15;
      return { text: `Ein NTC hat bei 25 °C den Nennwiderstand R25 = ${R25} Ω und den B-Wert ${B} K. Wie groß ist sein Widerstand bei ${T} °C?`, label: 'R', unit: 'Ω', ans: R, dec: 0, steps: ['T = ϑ + 273,15 K', `T = ${T} + 273,15 = ${gz(Tk, 2)} K`, 'R = R25 · e^(B · (1/T − 1/298,15 K))', `R = ${R25} Ω · e^(${B} · ${ex4(1 / Tk - 1 / T25)}) = ${gz(R, 0)} Ω`] };
    }
    if (kind === 'pt') {
      const R0 = pk([100, 1000]), T = pk([20, 50, 100, 150, 200]), R = ptR(R0, T);
      return { text: `Ein PT${R0} hat bei 0 °C ${R0} Ω. Wie groß ist sein Widerstand bei ${T} °C? (A = 3,9083·10⁻³ 1/°C, B = −5,775·10⁻⁷ 1/°C²)`, label: 'R', unit: 'Ω', ans: R, dec: 1, steps: ['R = R0 · (1 + A·ϑ + B·ϑ²)', `R = ${R0} Ω · (1 + 3,9083·10⁻³ · ${T} + (−5,775·10⁻⁷) · ${T}²) = ${gz(R, 1)} Ω`] };
    }
    if (kind === 'ptT') {
      const R0 = pk([100, 1000]), T = pk([25, 60, 80, 120, 150, 180]), R = r1(ptR(R0, T), 1);
      return { text: `Ein PT${R0} (R0 = ${R0} Ω) hat gemessen ${gz(R, 1)} Ω. Welche Temperatur herrscht? (Tipp: Die lineare Näherung mit 0,385 % je K reicht auf 2 % genau.)`, label: 'ϑ', unit: '°C', ans: ptT(R0, R), dec: 0, steps: ['Näherung: ϑ ≈ (R − R0) / (R0 · 0,00385)', `ϑ ≈ (${gz(R, 1)} − ${R0}) / (${R0} · 0,00385) = ${gz((R - R0) / (R0 * 0.00385), 1)} °C`, `Genau (Formel nach ϑ aufgelöst): ${gz(ptT(R0, R), 1)} °C`] };
    }
    if (kind === 'dms') {
      const U = pk([2.5, 5, 10]), e = pk([250, 500, 1000, 1500, 2000]), k = 2, br = pk(['Vollbrücke', 'Halbbrücke']), f = br === 'Vollbrücke' ? 1 : 0.5, Ud = U * k * e * 1e-6 * f * 1000;
      return { text: `Ein DMS (k = ${k}) in einer ${br} wird mit ${gz(U, 1)} V gespeist und um ε = ${e} µm/m gedehnt. Wie groß ist die Brückenspannung?`, label: 'U_d', unit: 'mV', ans: Ud, dec: 2, steps: [`ε = ${e} µm/m = ${e}·10⁻⁶`, br === 'Vollbrücke' ? 'Vollbrücke: U_d = U · k · ε' : 'Halbbrücke: U_d = U · k · ε / 2', `U_d = ${gz(U, 1)} V · ${k} · ${e}·10⁻⁶${f < 1 ? ' / 2' : ''} = ${gz(Ud, 3)} mV`] };
    }
    if (kind === 'gain') {
      const Us = pk([10, 20, 25, 50, 100]), Ur = pk([2.5, 3.3, 5]);
      return { text: `Ein Sensor liefert höchstens ${Us} mV. Der ADU hat U_ref = ${gz(Ur, 1)} V. Mit welcher Verstärkung nutzt du den ADU-Bereich genau aus?`, label: 'G', unit: '', ans: Ur * 1000 / Us, dec: 1, steps: ['G = U_ref / U_Sensor,max', `G = ${gz(Ur * 1000, 0)} mV / ${Us} mV = ${gz(Ur * 1000 / Us, 1)}`] };
    }
    if (kind === 'loop') {
      const I = pk([6, 8, 10, 12, 14, 16, 18]), hi = pk([10, 16, 25]), p = (I - 4) / 16 * hi;
      return { text: `Ein Drucktransmitter (0 bis ${hi} bar) liefert ein 4…20-mA-Signal. Du misst ${I} mA. Wie groß ist der Druck?`, label: 'p', unit: 'bar', ans: p, dec: 2, steps: ['Anteil = (I − 4 mA) / 16 mA', `Anteil = (${I} − 4) / 16 = ${gz((I - 4) / 16, 4)}`, 'p = Anteil · Messbereichsende', `p = ${gz((I - 4) / 16, 4)} · ${hi} bar = ${gz(p, 2)} bar`] };
    }
    if (kind === 'burden') {
      if (Math.random() < 0.5) { const Us = pk([18, 24, 30]), Rm = (Us - 12) / 0.02; return { text: `Ein Zweileiter-Messumformer braucht mindestens 12 V und wird mit ${Us} V versorgt. Wie groß darf die Gesamtbürde höchstens sein (bei 20 mA)?`, label: 'R_max', unit: 'Ω', ans: Rm, dec: 0, steps: ['R_max = (U_S − U_min) / 20 mA', `R_max = (${Us} V − 12 V) / 0,020 A = ${gz(Rm, 0)} Ω`] }; }
      const R = pk([100, 250, 500]);
      return { text: `Ein 4…20-mA-Signal fließt durch eine Bürde von ${R} Ω. Welche Spannung fällt bei 20 mA ab?`, label: 'U_B', unit: 'V', ans: 0.02 * R, dec: 2, steps: ['U_B = I · R_B', `U_B = 0,020 A · ${R} Ω = ${gz(0.02 * R)} V`] };
    }
    if (kind === 'lsb') {
      const n = pk([8, 10, 12, 16]), Ur = pk([2.5, 3.3, 5]), lsb = Ur * 1000 / Math.pow(2, n);
      return { text: `Ein ${n}-Bit-ADU hat U_ref = ${gz(Ur, 1)} V. Wie groß ist ein LSB?`, label: 'LSB', unit: 'mV', ans: lsb, dec: 3, steps: ['LSB = U_ref / 2ⁿ', `LSB = ${gz(Ur * 1000, 0)} mV / ${Math.pow(2, n)} = ${gz(lsb, 3)} mV`] };
    }
    if (kind === 'snr') {
      const n = pk([8, 10, 12, 14, 16]);
      return { text: `Wie groß ist der ideale Rauschabstand (nur Quantisierung) eines ${n}-Bit-ADU?`, label: 'SNR', unit: 'dB', ans: 6.02 * n + 1.76, dec: 1, steps: ['SNR = 6,02 · n + 1,76 dB', `SNR = 6,02 · ${n} + 1,76 = ${gz(6.02 * n + 1.76, 1)} dB`] };
    }
    if (kind === 'alias') {
      const fs = pk([1000, 1000, 2000, 500]), f = pk(fs === 1000 ? [700, 800, 900, 1100, 1300] : fs === 2000 ? [1300, 1500, 1800, 2200] : [300, 400, 600, 700]), fa = Math.abs(f - Math.round(f / fs) * fs);
      return { text: `Ein Sinussignal von ${f} Hz wird ohne Anti-Aliasing-Filter mit ${fs} Hz abgetastet. Mit welcher Frequenz erscheint es im Ergebnis?`, label: 'f_Alias', unit: 'Hz', ans: fa, dec: 0, steps: [`Nyquist: f_s/2 = ${fs / 2} Hz, das Signal liegt darüber.`, 'f_Alias = |f − k · f_s|', `f_Alias = |${f} − ${Math.round(f / fs)} · ${fs}| = ${fa} Hz`] };
    }
    if (kind === 'pullup') {
      const Cb = pk([50, 100, 200, 400]), fast = Math.random() < 0.5, tr = fast ? 300 : 1000, Rm = tr * 1e-9 / (0.8473 * Cb * 1e-12);
      return { text: `Ein I²C-Bus (${fast ? '400 kHz, t_r höchstens 300 ns' : '100 kHz, t_r höchstens 1000 ns'}) hat ${Cb} pF Buskapazität. Wie groß darf der Pull-up höchstens sein?`, label: 'R_max', unit: 'Ω', ans: Rm, dec: 0, steps: ['R_max = t_r / (0,8473 · C_B)', `R_max = ${tr} ns / (0,8473 · ${Cb} pF) = ${gz(Rm, 0)} Ω`] };
    }
    if (kind === 'selfheat') {
      const I = pk([0.5, 1, 2]), R = pk([4700, 10000]), d = pk([1, 1.5, 2]), P = I * I * R / 1000;
      return { text: `Durch einen NTC von ${R} Ω fließt ein Messstrom von ${I} mA. Die Wärmeableitung beträgt ${d} mW/K. Um wie viel Kelvin erwärmt sich der NTC selbst?`, label: 'ΔT', unit: 'K', ans: P / d, dec: 2, steps: ['P = I² · R', `P = (${I} mA)² · ${R} Ω = ${gz(P, 3)} mW`, 'ΔT = P / δ', `ΔT = ${gz(P, 3)} mW / ${d} mW/K = ${gz(P / d, 2)} K`] };
    }
    if (kind === 'lead2') {
      const Rl = pk([0.5, 1, 2, 3]), dT = 2 * Rl / 0.385;
      return { text: `Ein PT100 hängt in 2-Leiter-Schaltung an einer Leitung mit ${gz(Rl, 1)} Ω je Ader. Wie groß ist der Temperaturfehler? (Empfindlichkeit 0,385 Ω/K)`, label: 'ΔT', unit: 'K', ans: dT, dec: 2, steps: ['ΔR = 2 · R_L (Hin- und Rückleiter)', `ΔR = 2 · ${gz(Rl, 1)} Ω = ${gz(2 * Rl, 1)} Ω`, 'ΔT = ΔR / S', `ΔT = ${gz(2 * Rl, 1)} Ω / 0,385 Ω/K = ${gz(dT, 2)} K`] };
    }
    const Ur = pk([3.3, 5]), n = pk([8, 10, 12]), Uin = r1(Ur * rn(10, 90) / 100, 2), N = Math.floor(Uin / Ur * Math.pow(2, n));
    return { text: `Ein ${n}-Bit-ADU (U_ref = ${gz(Ur, 1)} V) misst ${gz(Uin, 2)} V. Welchen Zählwert liefert er (abgerundet)?`, label: 'N', unit: '', ans: N, dec: 0, steps: ['N = abgerundet(U_ein / U_ref · 2ⁿ)', `N = abgerundet(${gz(Uin, 2)} / ${gz(Ur, 1)} · ${Math.pow(2, n)}) = ${N}`] };
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
    stat('sencalc', 1, 'max'); if (ok) stat('sencalcok', exScore.ok, 'max');
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
    V.addEventListener('input', e => { const i = e.target.closest('#cForm input'); if (!i) return; calcVals[calcId][i.dataset.k] = i.value; calcOut(); stat('sencalc', 1, 'max'); });
    V.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'exIn') { e.preventDefault(); checkEx(); } });
  })();

  /* ============================================================ Lernen */
  const SV = (inner, label) => `<svg class="dr" viewBox="0 0 360 200" role="img" aria-label="${esc(label)}">${inner}</svg>`;
  const TX = (x, y, t, o) => `<text x="${x}" y="${y}" fill="${(o && o.c) || '#e8ecf0'}" font-size="${(o && o.s) || 12}" text-anchor="${(o && o.a) || 'middle'}" font-family="system-ui"${o && o.w ? ' font-weight="700"' : ''}>${esc(t)}</text>`;
  const BOX = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#2c343e" stroke="${c || '#8d99a6'}" stroke-width="1.8"/>`;
  function svgChain() {
    const bx = [['Messgröße', 'z. B. °C, N, lx', '#ff8a7a'], ['Sensor', 'NTC, DMS, …', '#3b9eff'], ['Aufbereitung', 'Brücke, Verstärker', '#ffb340'], ['Wandler', 'ADU', '#4cd964'], ['Anzeige', 'Zahl, Regler', '#c77dff']];
    let s = '';
    bx.forEach((b, i) => { const x = 8 + i * 70; s += BOX(x, 70, 60, 60, b[2]) + TX(x + 30, 96, b[0], { s: 9.5, w: 1 }) + TX(x + 30, 112, b[1], { s: 8, c: '#8d99a6' }); if (i < 4) s += `<path d="M${x + 60} 100H${x + 70}" stroke="#e8ecf0" stroke-width="2"/><path d="M${x + 66} 96L${x + 70} 100L${x + 66} 104" stroke="#e8ecf0" stroke-width="2" fill="none"/>`; });
    s += TX(180, 40, 'Messkette', { w: 1, s: 14 }) + TX(180, 62, 'jedes Glied kann das Signal verfälschen', { s: 10, c: '#8d99a6' });
    s += `<path d="M180 150V138" stroke="#ff5c5c" stroke-width="2"/>` + TX(180, 168, 'Störgrößen: Drift, Rauschen, Leitung, Einkopplung', { s: 10, c: '#ff8a7a' }) + TX(180, 184, 'Gesamtfehler = alle Einzelfehler zusammen', { s: 10, c: '#8d99a6' });
    return SV(s, 'Messkette: Messgröße, Sensor, Aufbereitung, Wandler, Anzeige');
  }
  function svgNtc() {
    const X = t => 50 + (t + 20) / 120 * 280, Y = r => 170 - (Math.log10(r) - 2) / 3.7 * 140;
    let n = '', p = '';
    for (let t = -20; t <= 100; t += 4) { n += (n ? 'L' : 'M') + X(t).toFixed(1) + ',' + Y(ntcR(10000, 3950, t)).toFixed(1); p += (p ? 'L' : 'M') + X(t).toFixed(1) + ',' + Y(ptR(1000, t)).toFixed(1); }
    let g = ''; [0, 50, 100].forEach(t => { g += `<path d="M${X(t)} 30V170" stroke="#26303a"/>` + TX(X(t), 184, t + ' °C', { s: 10, c: '#8d99a6' }); });
    [['100 Ω', 100], ['1 kΩ', 1000], ['10 kΩ', 10000], ['100 kΩ', 100000]].forEach(([l, r]) => { g += `<path d="M50 ${Y(r)}H330" stroke="#26303a"/>` + TX(46, Y(r) + 4, l, { a: 'end', s: 10, c: '#8d99a6' }); });
    return SV(`${g}<path d="M50 30V170H330" stroke="#8d99a6" fill="none"/><path d="${n}" stroke="#3b9eff" stroke-width="2.4" fill="none"/><path d="${p}" stroke="#ffb340" stroke-width="2.4" fill="none"/><circle cx="${X(25)}" cy="${Y(10000)}" r="4.5" fill="#ff5c5c"/>
      ${TX(120, 52, 'NTC 10 kΩ (B 3950): fällt stark, nicht linear', { a: 'start', s: 10.5, c: '#7fbaff' })}${TX(326, 150, 'PT1000: steigt schwach, fast linear', { a: 'end', s: 10.5, c: '#ffb340' })}${TX(X(25) + 8, Y(10000) - 6, 'R25', { a: 'start', s: 10, c: '#ff8a7a' })}${TX(8, 22, 'Widerstand (logarithmisch)', { a: 'start', s: 10, c: '#8d99a6' })}`, 'Widerstandskennlinien von NTC und PT1000 über der Temperatur');
  }
  function svgBridge() {
    const nodes = { t: [180, 34], b: [180, 138], l: [100, 86], r: [260, 86] };
    const res = (a, b, n) => { const [x1, y1] = nodes[a], [x2, y2] = nodes[b], mx = (x1 + x2) / 2, my = (y1 + y2) / 2, ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI; return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#8d99a6" stroke-width="2"/><g transform="translate(${mx} ${my}) rotate(${ang})"><rect x="-20" y="-8" width="40" height="16" rx="3" fill="#2c343e" stroke="#ffb340" stroke-width="1.8"/>${TX(0, 4, n, { s: 11, w: 1 })}</g>`; };
    return SV(`${res('t', 'l', 'R1')}${res('t', 'r', 'R3')}${res('l', 'b', 'R2')}${res('r', 'b', 'R4')}
      <circle cx="180" cy="86" r="17" fill="#222830" stroke="#3b9eff" stroke-width="2.2"/>${TX(180, 91, 'U_d', { s: 12, w: 1 })}<path d="M100 86H163M197 86H260" stroke="#8d99a6" stroke-width="2"/>
      ${TX(180, 22, '+U', { w: 1, c: '#ff8a7a' })}${TX(180, 156, '0 V', { w: 1 })}${TX(180, 178, 'U_d = U · (R2/(R1+R2) − R4/(R3+R4))', { s: 11, c: '#ffb340' })}${TX(180, 194, 'abgeglichen (R1/R2 = R3/R4): U_d = 0', { s: 10, c: '#8d99a6' })}`, 'Wheatstone-Brückenschaltung mit vier Widerständen');
  }
  function svgDms() {
    return SV(`<rect x="20" y="70" width="34" height="60" fill="#3a434d" stroke="#8d99a6" stroke-width="2"/><path d="M54 90H300V110H54Z" fill="#3b4652" stroke="#8d99a6" stroke-width="2"/>
      <rect x="90" y="82" width="46" height="8" rx="2" fill="#ffb340"/><rect x="90" y="110" width="46" height="8" rx="2" fill="#7fbaff"/><rect x="150" y="82" width="46" height="8" rx="2" fill="#ffb340"/><rect x="150" y="110" width="46" height="8" rx="2" fill="#7fbaff"/>
      <path d="M300 60V94" stroke="#ff5c5c" stroke-width="3"/><path d="M294 88L300 98L306 88Z" fill="#ff5c5c"/>${TX(300, 54, 'Kraft F', { s: 11, c: '#ff8a7a', w: 1 })}
      ${TX(113, 72, 'gedehnt', { s: 10, c: '#ffb340' })}${TX(113, 136, 'gestaucht', { s: 10, c: '#7fbaff' })}${TX(173, 72, 'gedehnt', { s: 10, c: '#ffb340' })}${TX(173, 136, 'gestaucht', { s: 10, c: '#7fbaff' })}${TX(37, 62, 'fest', { s: 10, c: '#8d99a6' })}
      ${TX(180, 166, 'ΔR / R = k · ε   (k ≈ 2)', { w: 1, s: 12, c: '#e8ecf0' })}${TX(180, 184, 'Vollbrücke: U_d = U · k · ε', { s: 11, c: '#4cd964' })}`, 'Biegebalken mit vier Dehnungsmessstreifen');
  }
  function svgMems() {
    return SV(`<g transform="translate(150 100) rotate(30)"><rect x="-60" y="-14" width="120" height="28" rx="4" fill="#2c343e" stroke="#3b9eff" stroke-width="2"/>${TX(0, 5, 'Sensor', { s: 12, w: 1 })}<path d="M0 0H80" stroke="#ffb340" stroke-width="2"/><path d="M0 0V-50" stroke="#4cd964" stroke-width="2"/></g>
      <path d="M150 100H250" stroke="#4a5663" stroke-dasharray="4 4"/><path d="M150 100V170" stroke="#ff5c5c" stroke-width="3"/><path d="M143 162L150 175L157 162Z" fill="#ff5c5c"/>${TX(166, 178, '1 g', { a: 'start', s: 11, c: '#ff8a7a', w: 1 })}
      <path d="M200 100A50 50 0 0 1 193.3 125" stroke="#e8ecf0" fill="none"/>${TX(214, 118, 'α', { s: 14, w: 1 })}${TX(232, 76, 'x-Achse', { a: 'start', s: 10, c: '#ffb340' })}${TX(160, 40, 'z-Achse', { a: 'start', s: 10, c: '#4cd964' })}
      ${TX(10, 24, 'α = atan2(a_x, a_z)', { a: 'start', s: 12, w: 1 })}${TX(10, 42, 'nur im Stillstand genau', { a: 'start', s: 10, c: '#8d99a6' })}`, 'Geneigter Beschleunigungssensor mit Erdbeschleunigung');
  }
  function svgLoop() {
    return SV(`<path d="M50 40H310V160H50Z" fill="none" stroke="#8d99a6" stroke-width="2"/>
      <circle cx="50" cy="100" r="20" fill="#222830" stroke="#ff8a7a" stroke-width="2"/>${TX(50, 104, '24 V', { s: 11, w: 1 })}
      ${BOX(116, 22, 130, 36, '#3b9eff')}${TX(181, 38, 'Messumformer', { s: 11, w: 1 })}${TX(181, 52, '4 … 20 mA', { s: 10, c: '#8d99a6' })}
      <rect x="296" y="82" width="28" height="36" rx="4" fill="#2c343e" stroke="#ffb340" stroke-width="2"/>${TX(310, 104, 'R', { s: 12, w: 1 })}${TX(310, 74, '250 Ω', { s: 10, a: 'middle', c: '#ffb340' })}
      <path d="M100 150H150" stroke="#e8ecf0" stroke-width="2"/><path d="M144 146L150 150L144 154" stroke="#e8ecf0" stroke-width="2" fill="none"/>${TX(125, 146, 'I', { s: 12, w: 1 })}
      ${TX(180, 98, '4 mA = 0 %   20 mA = 100 %', { s: 11, w: 1, c: '#4cd964' })}${TX(180, 116, 'U = I · R: 1 V … 5 V', { s: 10.5, c: '#ffb340' })}${TX(180, 136, 'unter 3,6 mA: Drahtbruch erkannt', { s: 10, c: '#ff8a7a' })}${TX(180, 182, 'Der Strom ist überall in der Schleife gleich.', { s: 10, c: '#8d99a6' })}`, 'Stromschleife mit Versorgung, Messumformer und Bürde');
  }
  function svgAdc() {
    let d = 'M50 170', st = '';
    for (let i = 0; i < 8; i++) { const x = 50 + i * 35, y = 170 - i * 18; d += `H${x + 35}V${y - 18}`; st += TX(x + 17, 184, String(i), { s: 9, c: '#8d99a6' }); }
    d = 'M50 170'; for (let i = 0; i < 8; i++) { d += `V${170 - (i + 1) * 18 + 0}H${50 + (i + 1) * 35}`; }
    return SV(`<path d="M50 20V170H335" stroke="#8d99a6" fill="none"/><path d="M50 170L330 44" stroke="#8d99a6" stroke-dasharray="4 4"/><path d="M50 170H85V152H120V134H155V116H190V98H225V80H260V62H295V44H330" stroke="#3b9eff" stroke-width="2.6" fill="none"/>${st}
      ${TX(190, 198, 'Eingangsspannung (Stufen = Zählwerte N)', { s: 10, c: '#8d99a6' })}${TX(8, 24, 'N', { a: 'start', s: 11, w: 1 })}${TX(300, 112, '1 LSB = U_ref / 2ⁿ', { a: 'end', s: 11, c: '#ffb340', w: 1 })}${TX(300, 128, '3 Bit: 8 Stufen', { a: 'end', s: 10, c: '#8d99a6' })}
      <path d="M232 98V80" stroke="#ffb340" stroke-width="3"/>${TX(262, 38, 'Quantisierungsfehler ±½ LSB', { s: 10, c: '#ff8a7a', a: 'middle' })}`, 'Treppenkennlinie eines 3-Bit-ADU');
  }
  function svgAlias() {
    let sg = '', al = '', dots = '';
    for (let x = 0; x <= 300; x += 2) { sg += (x ? 'L' : 'M') + (30 + x) + ',' + (100 - 60 * Math.sin(2 * Math.PI * 9 * x / 300)).toFixed(1); al += (x ? 'L' : 'M') + (30 + x) + ',' + (100 + 60 * Math.sin(2 * Math.PI * x / 300)).toFixed(1); }
    for (let k = 0; k <= 10; k++) { const x = k * 30, y = 100 - 60 * Math.sin(2 * Math.PI * 9 * x / 300); dots += `<circle cx="${30 + x}" cy="${y.toFixed(1)}" r="4" fill="#4cd964"/>`; }
    return SV(`<path d="M30 100H330" stroke="#4a5663"/><path d="${sg}" stroke="#3b9eff" stroke-width="1.6" fill="none" opacity=".75"/><path d="${al}" stroke="#ff5c5c" stroke-width="2.4" stroke-dasharray="6 4" fill="none"/>${dots}
      ${TX(180, 24, 'Signal: 9 Perioden, Abtastung: 10 Werte', { s: 11, w: 1 })}${TX(180, 176, 'Die grünen Punkte passen auch zur roten Kurve:', { s: 10.5, c: '#ff8a7a' })}${TX(180, 192, 'Alias mit nur 1 Periode. Erst f_s > 2 · f verhindert das.', { s: 10.5, c: '#8d99a6' })}`, 'Aliasing: Abtastwerte eines schnellen Signals ergeben ein langsames Scheinsignal');
  }
  function svgI2c() {
    const p = 28, x0 = 62, bits = [1, 0, 1, 0, 0, 1, 1, 0, 0]; /* Adresse 0x53 = 1010011, R/W = 0 (Schreiben), ACK = 0 */
    let scl = `M20,40H${x0 - 4}`, sda = `M20,130H${x0 - 12}V160`, lvl = 160;
    bits.forEach((b, i) => {
      const x = x0 + i * p, y = b ? 130 : 160;
      scl += `V70H${x + p / 2}V40H${x + p}`;
      if (y !== lvl) { sda += `H${x}V${y}`; lvl = y; }
    });
    const xe = x0 + 9 * p; sda += `H${xe + 4}V130H${xe + 20}`; scl += `H${xe + 20}`;
    let t = '';
    for (let i = 0; i < 9; i++) t += TX(x0 + i * p + p / 2, 178, i < 7 ? 'A' + (6 - i) : i === 7 ? 'R/W' : 'ACK', { s: 8, c: i === 8 ? '#ffb340' : '#8d99a6' });
    return SV(`<path d="${scl}" stroke="#3b9eff" stroke-width="2" fill="none"/><path d="${sda}" stroke="#4cd964" stroke-width="2" fill="none"/>${TX(14, 52, 'SCL', { a: 'start', s: 11, w: 1, c: '#7fbaff' })}${TX(14, 148, 'SDA', { a: 'start', s: 11, w: 1, c: '#4cd964' })}
      ${t}${TX(x0 - 12, 118, 'START', { s: 9.5, w: 1, c: '#ffb340' })}${TX(xe + 14, 118, 'STOP', { s: 9.5, w: 1, c: '#ffb340' })}${TX(x0 + 3.5 * p, 108, '7 Bit Adresse = 1010011 (0x53)', { s: 10, c: '#e8ecf0' })}${TX(180, 14, 'Slave zieht SDA im 9. Takt auf Low: ACK', { s: 10.5, c: '#ffb340' })}`, 'I²C-Telegramm: Start, Adresse, Lesen oder Schreiben, ACK, Stopp');
  }
  function svgOpt() {
    const tri = (x, t) => TX(x, 192, t, { s: 9.5, c: '#8d99a6' });
    return SV(`<path d="M20 60H34V120H20" fill="none"/><path d="M20 70V130H70V70" fill="#2c343e" stroke="#8d99a6" stroke-width="2"/><circle cx="30" cy="100" r="5" fill="#ffd23c"/><rect x="58" y="96" width="9" height="8" fill="#7fbaff"/><path d="M36 100H56" stroke="#ffd23c" stroke-dasharray="3 3"/><rect x="42" y="84" width="6" height="12" fill="#ff8a7a"/>${tri(45, 'Gabel')}
      <rect x="110" y="70" width="40" height="26" rx="4" fill="#2c343e" stroke="#8d99a6" stroke-width="2"/><circle cx="122" cy="83" r="4" fill="#ffd23c"/><rect x="134" y="78" width="9" height="10" fill="#7fbaff"/><path d="M122 83L190 130" stroke="#ffd23c" stroke-dasharray="3 3"/><path d="M190 130L140 90" stroke="#ffd23c" stroke-dasharray="3 3"/><rect x="186" y="118" width="8" height="26" fill="#c9d1d9"/>${tri(150, 'Reflex')}
      <rect x="245" y="78" width="40" height="30" rx="4" fill="#2c343e" stroke="#8d99a6" stroke-width="2"/><ellipse cx="294" cy="93" rx="6" ry="12" fill="none" stroke="#ffb340"/><ellipse cx="302" cy="93" rx="8" ry="16" fill="none" stroke="#ffb340" stroke-dasharray="3 3"/><rect x="326" y="70" width="10" height="46" fill="#9aa5b1"/><path d="M290 130H326" stroke="#e8ecf0"/><path d="M290 126V134M326 126V134" stroke="#e8ecf0"/>${TX(308, 146, 's', { s: 11, w: 1 })}${tri(300, 'induktiv')}
      ${TX(180, 30, 'Gabel, Reflex und Näherungsschalter', { w: 1, s: 12 })}${TX(180, 48, 'Schaltabstand s hängt vom Material ab', { s: 10, c: '#ffb340' })}`, 'Gabellichtschranke, Reflexlichtschranke und induktiver Näherungsschalter');
  }
  function svgCal() {
    return SV(`<path d="M50 20V170H335" stroke="#8d99a6" fill="none"/><path d="M50 170L320 30" stroke="#8d99a6" stroke-dasharray="5 4"/><path d="M50 150L320 22" stroke="#ff5c5c" stroke-width="2.4"/><path d="M50 170L320 30" stroke="#4cd964" stroke-width="2" opacity="0"/>
      <circle cx="50" cy="150" r="5" fill="#ffb340"/><circle cx="320" cy="22" r="5" fill="#ffb340"/><circle cx="50" cy="170" r="4" fill="#8d99a6"/><circle cx="320" cy="30" r="4" fill="#8d99a6"/>
      ${TX(58, 142, 'Nullpunktfehler', { a: 'start', s: 10, c: '#ffb340' })}${TX(310, 52, 'Steigungsfehler', { a: 'end', s: 10, c: '#ffb340' })}${TX(190, 186, 'Soll (Messgröße x)', { s: 10, c: '#8d99a6' })}${TX(8, 24, 'Anzeige y', { a: 'start', s: 10, c: '#8d99a6' })}
      ${TX(200, 122, 'ideal (gestrichelt)', { a: 'start', s: 10, c: '#8d99a6' })}${TX(100, 62, 'real (rot)', { a: 'start', s: 10, c: '#ff8a7a' })}${TX(130, 162, 'zwei Punkte (gelb) legen die Gerade fest', { a: 'start', s: 10, c: '#e8ecf0' })}`, 'Zwei-Punkt-Kalibrierung: Nullpunktfehler und Steigungsfehler');
  }
  function svgSafety() {
    return SV(`<path d="M90 24L150 128H30Z" fill="#ffb340" stroke="#222830" stroke-width="3" stroke-linejoin="round"/><path d="M96 56L82 90H98L90 112L108 78H92L100 56Z" fill="#222830"/>${TX(90, 150, 'Warnung vor', { s: 10.5 })}${TX(90, 164, 'elektrischer Spannung', { s: 10.5 })}
      <path d="M270 24L330 128H210Z" fill="#ffb340" stroke="#222830" stroke-width="3" stroke-linejoin="round"/><g stroke="#222830" stroke-width="3" stroke-linecap="round"><path d="M270 100L270 62M270 100L246 74M270 100L294 74M270 100L238 100M270 100L302 100"/></g><circle cx="270" cy="100" r="5" fill="#222830"/>${TX(270, 150, 'Warnung vor', { s: 10.5 })}${TX(270, 164, 'Laserstrahl', { s: 10.5 })}`, 'Warnschilder: elektrische Spannung und Laserstrahl');
  }
  const LEARN = [
    { t: 'Sensorik und Messkette', ex: 'temp-ntc', exT: 'Temperaturmessung ansehen', open: true, h: () => `<p>Ein <b>Sensor</b> wandelt eine physikalische Größe (Temperatur, Kraft, Licht, Abstand, Beschleunigung) in ein elektrisches Signal. Bis daraus eine Anzeige oder ein Wert in der Steuerung wird, durchläuft das Signal eine <b>Messkette</b>:</p>${svgChain()}
      <table><tr><th>Glied</th><th>Aufgabe</th><th>typischer Fehler</th></tr><tr><td>Sensor</td><td>Messgröße in Widerstand, Spannung, Strom oder Digitalwert umsetzen</td><td>Drift, Selbsterwärmung, Nichtlinearität</td></tr><tr><td>Aufbereitung</td><td>Teiler, Brücke, Verstärker, Filter</td><td>Offset, Leitungswiderstand, Einkopplung</td></tr><tr><td>Wandler</td><td>Analogwert in Zahl (ADU) oder in Normsignal umsetzen</td><td>Quantisierung, Übersteuerung</td></tr><tr><td>Anzeige</td><td>Zahl in Einheit umrechnen (Kennlinie)</td><td>falsche Kalibrierung</td></tr></table>
      <p>Wichtige Begriffe: <b>Messbereich</b> (von … bis …), <b>Auflösung</b> (kleinste unterscheidbare Änderung), <b>Empfindlichkeit</b> (Ausgangsänderung je Eingangsänderung), <b>Genauigkeit</b> (wie nahe an der Wahrheit) und <b>Linearität</b> (wie gerade die Kennlinie ist).</p>` },
    { t: 'Temperaturmessung: NTC, PT100 und Thermoelement', ex: 'temp-sprung', exT: 'Temperatursprung ansehen', h: () => `<p>Der <b>NTC</b> (Heißleiter) wird mit steigender Temperatur niederohmiger, und zwar stark und nicht linear: <b>R = R<sub>25</sub> · e<sup>B · (1/T − 1/298,15 K)</sup></b> (T in Kelvin). Ein 10-kΩ-NTC mit B = 3950 K hat bei 50 °C etwa 3,6 kΩ.</p>${svgNtc()}
      <p>Der <b>PT100</b> (Platin, 100 Ω bei 0 °C) und <b>PT1000</b> werden mit der Temperatur hochohmiger, fast linear: <b>R = R<sub>0</sub> · (1 + A·ϑ + B·ϑ²)</b> mit A = 3,9083·10⁻³ und B = −5,775·10⁻⁷. Bei 100 °C hat ein PT100 138,5 Ω. Sie sind genauer und austauschbar, aber teurer und träger.</p>
      <p>Halbleitersensoren wie <b>LM35</b> (10 mV je °C) und <b>TMP36</b> (10 mV je °C mit 500 mV Offset bei 0 °C) liefern direkt eine Spannung. Ein <b>Thermoelement</b> (Typ K: NiCr-Ni) erzeugt nur etwa 41 µV je Kelvin Temperaturdifferenz und braucht deshalb eine <b>Vergleichsstelle</b>, damit die Temperatur an der Klemme berücksichtigt wird.</p>
      <p><b>Fehlerquellen:</b> Die <b>Selbsterwärmung</b> (der Messstrom heizt den Sensor, P = I² · R), die <b>Trägheit</b> der Sonde (Zeitkonstante) und der <b>Leitungswiderstand</b>: Bei <b>2-Leiter</b> addiert er sich zum Sensor (1 Ω je Ader gibt beim PT100 etwa 5 K Fehler). Die <b>3-Leiter-Schaltung</b> gleicht ihn in der Brücke aus, die <b>4-Leiter-Schaltung</b> misst mit getrennten Messleitungen ganz ohne Einfluss.</p>` },
    { t: 'Licht und Näherung', ex: 'licht-ind', exT: 'Näherungsschalter ausprobieren', h: () => `<p><b>LDR</b> (Fotowiderstand): Der Widerstand sinkt bei Licht, aber nicht linear und eher langsam. <b>Fotodiode</b> und <b>Fototransistor</b>: Der Strom wächst mit der Beleuchtung, sie sind viel schneller und linearer.</p>${svgOpt()}
      <p>Lichtschranken gibt es als <b>Gabellichtschranke</b> (Sender und Empfänger in einem Gehäuse, ein Objekt unterbricht den Strahl), <b>Reflexlichtschranke</b> (Reflektor gegenüber) und <b>Taster</b> (das Objekt selbst wirft das Licht zurück). <b>Fremdlicht</b> kann den Empfänger blenden, deshalb wird das Licht moduliert und der Empfänger auf diese Frequenz abgestimmt.</p>
      <p>Der <b>induktive Näherungsschalter</b> erkennt Metall über ein Wechselfeld. Der Nennschaltabstand gilt für Stahl. Andere Metalle haben einen <b>Reduktionsfaktor</b> (Richtwerte: Stahl 1, Aluminium etwa 0,4, Kupfer etwa 0,3), der Schaltabstand wird entsprechend kleiner. Der <b>kapazitive Näherungsschalter</b> erkennt auch Kunststoff, Wasser und Füllgut. <b>Ultraschallsensoren</b> messen die Laufzeit des Echos: Abstand = Schallgeschwindigkeit · Zeit / 2 (Schall ca. 343 m/s bei 20 °C).</p>
      <p>Damit der Ausgang an der Schaltschwelle nicht flattert, hat ein Schalter eine <b>Hysterese</b>: Er schaltet bei einem anderen Wert ein als aus.</p>` },
    { t: 'Brückenschaltung und Dehnungsmessstreifen', ex: 'kraft-voll', exT: 'Vollbrücke ausprobieren', h: () => `<p>Ein <b>Dehnungsmessstreifen (DMS)</b> ändert seinen Widerstand, wenn er gedehnt wird: <b>ΔR / R = k · ε</b>. Der <b>k-Faktor</b> liegt bei Metall-DMS um 2, die Dehnung ε wird in µm/m angegeben. Bei 1000 µm/m ändert sich der Widerstand eines 350-Ω-DMS nur um 0,7 Ω (0,2 %). Dieses winzige Signal liest man mit einer <b>Wheatstone-Brücke</b> aus:</p>${svgBridge()}
      <p>Ohne Belastung ist die Brücke <b>abgeglichen</b> (U<sub>d</sub> = 0). Ändert sich ein Widerstand, entsteht die Brückenspannung <b>U<sub>d</sub> = U · (R2/(R1+R2) − R4/(R3+R4))</b>. Aufbau am Biegebalken:</p>${svgDms()}
      <table><tr><th>Schaltung</th><th>aktive DMS</th><th>Ausgang bei Dehnung ε</th></tr><tr><td>Viertelbrücke</td><td>1</td><td>U<sub>d</sub> ≈ U · k · ε / 4</td></tr><tr><td>Halbbrücke</td><td>2</td><td>U<sub>d</sub> = U · k · ε / 2</td></tr><tr><td>Vollbrücke</td><td>4</td><td>U<sub>d</sub> = U · k · ε</td></tr></table>
      <p>Bei 5 V, k = 2 und 1000 µm/m gibt die Vollbrücke nur <b>10 mV</b>. Ein <b>Instrumentenverstärker</b> (U<sub>a</sub> = G · (U<sub>+</sub> − U<sub>−</sub>)) hebt das Signal an den Bereich des ADU. Halb- und Vollbrücken gleichen die <b>Temperaturdrift</b> aus, weil sich alle DMS gleich erwärmen. Am Anfang gleichst du den <b>Nullpunkt</b> ab (Offset), am Ende den <b>Endwert</b> (Kalibrierung). Wägezellen liefern typisch etwa 1 bis 2 mV je Volt Speisespannung bei Nennlast.</p>` },
    { t: 'Beschleunigung und Neigung (MEMS)', ex: 'beschl-neigung', exT: 'Neigung messen', h: () => `<p>Ein <b>MEMS-Beschleunigungssensor</b> enthält eine winzige bewegliche Masse aus Silizium, deren Auslenkung kapazitiv gemessen wird. Er misst die Beschleunigung in drei Achsen, in der Einheit <b>g</b> (1 g = 9,81 m/s²). Im Ruhezustand misst er die Erdbeschleunigung, daraus lässt sich die <b>Neigung</b> berechnen:</p>${svgMems()}
      <p>Beispiel eines typischen Bausteins (ähnlich ADXL345): Er hängt am <b>I²C-Bus</b> mit der Adresse <b>0x53</b>. Die sechs Datenregister <b>0x32 bis 0x37</b> enthalten x, y und z als 16-Bit-Zahlen, das <b>niederwertige Byte zuerst</b> (Little Endian). Der Rohwert wird mit der Empfindlichkeit (g je Digit) umgerechnet.</p>
      <p>Der <b>Messbereich</b> (zum Beispiel ±2, ±4, ±8, ±16 g) bestimmt die Empfindlichkeit: Kleiner Bereich ergibt feine Auflösung, aber ein Stoß oberhalb des Bereichs wird abgeschnitten (<b>Clipping</b>). Neigungswinkel stimmen nur, solange der Sensor still steht, denn Bewegung und Schwingung addieren sich zur Erdbeschleunigung. Ein <b>Tiefpassfilter</b> beruhigt den Wert, macht ihn aber träger.</p>` },
    { t: 'Normsignale: 4…20 mA und 0…10 V', ex: 'norm-420', exT: '4…20 mA ansehen', h: () => `<p>Industrielle Sensoren liefern oft ein <b>Normsignal</b>, das ein <b>Messumformer</b> aus dem Sensorsignal macht. Das Signal wird auf den Messbereich skaliert: 0 % ist der Anfang, 100 % das Ende.</p>${svgLoop()}
      <table><tr><th>Signal</th><th>Vorteil</th><th>Nachteil</th></tr><tr><td>4…20 mA</td><td>unempfindlich gegen Leitungswiderstand und Störungen, lange Leitungen, <b>Live Zero</b> (Drahtbruch erkennbar), Zweileiter-Technik</td><td>braucht Bürde und Versorgung</td></tr><tr><td>0…20 mA</td><td>einfach</td><td>0 mA ist nicht von Drahtbruch zu unterscheiden</td></tr><tr><td>0…10 V</td><td>einfach zu messen</td><td>Spannungsabfall auf der Leitung, störanfälliger, 0 V kann auch Fehler sein</td></tr><tr><td>1…5 V</td><td>Live Zero (1 V)</td><td>wie andere Spannungssignale</td></tr></table>
      <p><b>Skalierung:</b> Bei 4…20 mA ist <b>I = 4 mA + Anteil · 16 mA</b>. 12 mA entsprechen also 50 %. Bei einem Messbereich von 0 bis 10 bar sind das 5 bar. Ein Wert unter etwa <b>3,6 mA</b> gilt als Fehler (zum Beispiel Drahtbruch, NAMUR NE 43).</p>
      <p><b>Bürde:</b> Ein Widerstand (klassisch 250 Ω) macht aus dem Strom eine Spannung: U = I · R, also 1 V bei 4 mA und 5 V bei 20 mA. Beim <b>Zweileiter-Messumformer</b> kommen Versorgung und Signal über dieselben zwei Drähte. Er braucht eine Mindestspannung (oft etwa 12 V). Die <b>Maximalbürde</b> ist R<sub>max</sub> = (U<sub>S</sub> − U<sub>min</sub>) / 20 mA, bei 24 V und 12 V also 600 Ω. Ist die Bürde größer, geht der Messumformer in die Sättigung und das Signal bleibt hängen.</p>` },
    { t: 'ADU und Abtasttheorem', ex: 'adu-alias', exT: 'Aliasing ansehen', h: () => `<p>Ein <b>Analog-Digital-Umsetzer (ADU)</b> macht aus einer Spannung eine Zahl. Bei <b>n Bit</b> gibt es 2ⁿ Stufen. Ein Stufenschritt ist ein <b>LSB = U<sub>ref</sub> / 2ⁿ</b>, der Zählwert ist <b>N = abgerundet(U / LSB)</b>. Ein 10-Bit-ADU mit 3,3 V hat 3,22 mV je Stufe.</p>${svgAdc()}
      <p>Die Rundung erzeugt den <b>Quantisierungsfehler</b> von höchstens ±½ LSB. Der ideale <b>Rauschabstand</b> ist <b>SNR = 6,02 · n + 1,76 dB</b> (12 Bit: etwa 74 dB). Mit Rauschen und anderen Fehlern bleibt die <b>effektive Bitzahl</b> (ENOB) kleiner: ENOB = (SNR − 1,76 dB) / 6,02 dB.</p>
      <p>Das <b>Abtasttheorem</b> (Nyquist-Shannon): Die Abtastfrequenz muss <b>größer als das Doppelte der höchsten Signalfrequenz</b> sein: f<sub>s</sub> &gt; 2 · f<sub>max</sub>. Sonst entsteht <b>Aliasing</b>: Das Signal erscheint als falsche, niedrigere Frequenz <b>f<sub>Alias</sub> = |f − k · f<sub>s</sub>|</b>. Ein 900-Hz-Signal bei 1 kHz Abtastung wird zu 100 Hz.</p>${svgAlias()}
      <p>Dagegen hilft ein <b>Anti-Aliasing-Filter</b> (Tiefpass) <b>vor</b> dem ADU: Er unterdrückt Frequenzen oberhalb f<sub>s</sub>/2, bevor sie abgetastet werden. Im Nachhinein lässt sich Aliasing nicht mehr erkennen oder beheben. Ein <b>Sample-and-Hold</b> hält die Spannung während der Wandlung konstant.</p>` },
    { t: 'I²C-Bus und digitale Sensoren', ex: 'dig-sht', exT: 'I²C-Sensor ansehen', h: () => `<p>Digitale Sensoren (Temperatur und Feuchte, Abstand, Beschleunigung) liefern ihren Messwert als Zahl über einen <b>Bus</b>. Der <b>I²C-Bus</b> braucht nur zwei Leitungen: <b>SDA</b> (Daten) und <b>SCL</b> (Takt). Beide sind <b>Open-Drain</b>: Die Teilnehmer ziehen die Leitung nur nach Low, ein <b>Pull-up-Widerstand</b> zieht sie nach High.</p>${svgI2c()}
      <p><b>Ablauf:</b> Der Master sendet die <b>START-Bedingung</b> (SDA fällt, solange SCL High ist), dann 7 Bit <b>Adresse</b> und ein <b>R/W-Bit</b>. Der angesprochene Teilnehmer antwortet im neunten Takt mit <b>ACK</b> (zieht SDA auf Low). Kommt kein ACK, heißt das <b>NACK</b>: Es hat niemand geantwortet. Dann folgen Datenbytes, jedes mit ACK, und am Ende die <b>STOP-Bedingung</b> (SDA steigt, solange SCL High ist). Übliche Taktraten: 100 kHz (Standard) und 400 kHz (Fast).</p>
      <p><b>Typische Fehler:</b> Zwei Teilnehmer mit <b>gleicher Adresse</b> (Adresskonflikt), ein <b>Pull-up zu groß</b> (die Flanken werden zu langsam, besonders bei hoher Buskapazität und 400 kHz), ein <b>Pull-up zu klein</b> (die Teilnehmer schaffen das Low nicht mehr). Faustformeln: <b>R<sub>max</sub> = t<sub>r</sub> / (0,8473 · C<sub>B</sub>)</b> mit t<sub>r</sub> höchstens 1000 ns (100 kHz) oder 300 ns (400 kHz), und <b>R<sub>min</sub> = (U<sub>CC</sub> − 0,4 V) / 3 mA</b>. Die Buskapazität darf höchstens 400 pF betragen.</p>
      <p>Viele Sensoren hängen an ihre Messwerte eine <b>Prüfsumme (CRC-8)</b> an, damit Übertragungsfehler erkannt werden. Der Rohwert wird mit der Formel aus dem Datenblatt in °C, % relative Feuchte oder mm umgerechnet. Ultraschallsensoren (zum Beispiel HC-SR04-Typ) arbeiten stattdessen mit der Impulslaufzeit eines Echo-Signals.</p>` },
    { t: 'Messfehler und Kalibrierung', ex: 'temp-2leiter', exT: 'Leitungsfehler ansehen', h: () => `<p>Jede Messung hat einen Fehler. <b>Systematische Fehler</b> wirken immer gleich (Offset, falsche Steigung, Leitungswiderstand) und lassen sich <b>herausrechnen</b>. <b>Zufällige Fehler</b> (Rauschen) streuen und lassen sich nur durch Mittelung verkleinern.</p>
      <p>Der <b>absolute Fehler</b> ist Anzeige − wahrer Wert. Der <b>relative Fehler</b> bezieht ihn auf den Messwert, der <b>Fehler in % vom Endwert</b> bezieht ihn auf den Messbereich (so geben viele Datenblätter die Genauigkeit an). Arten von Kennlinienfehlern: <b>Nullpunktfehler</b> (Offset), <b>Steigungsfehler</b> (Verstärkungsfehler), <b>Linearitätsfehler</b>, <b>Hysterese</b> (Hin- und Rückweg verschieden) und <b>Drift</b> (langsame Änderung über Zeit und Temperatur).</p>${svgCal()}
      <p>Bei der <b>Zwei-Punkt-Kalibrierung</b> misst du Nullpunkt (x<sub>0</sub>, y<sub>0</sub>) und Endwert (x<sub>1</sub>, y<sub>1</sub>) und rechnest jede Anzeige zurück: <b>x = x<sub>0</sub> + (y − y<sub>0</sub>) · (x<sub>1</sub> − x<sub>0</sub>) / (y<sub>1</sub> − y<sub>0</sub>)</b>. Das beseitigt Offset- und Steigungsfehler. Linearitätsfehler und Hysterese bleiben. Nutze dafür im Prüfstand den <b>Kalibrier-Assistenten</b>.</p>
      <p>Das Referenznormal muss <b>deutlich genauer</b> sein als das Messgerät (Faustregel: mindestens drei- bis viermal). Kalibriere bei Betriebstemperatur, warte, bis sich die Anzeige beruhigt hat, und wiederhole die Kalibrierung regelmäßig, weil Sensoren altern.</p>` },
    { t: 'Sicherheit bei Sensoren und Messkreisen', ex: 'norm-draht', exT: 'Drahtbruch ansehen', h: () => `${svgSafety()}<p>Sensoren sind klein, hängen aber an Anlagen mit Spannung, Druck, Hitze und Laserlicht. Beachte:</p>
      <ul><li><b>Fünf Sicherheitsregeln</b> vor Arbeiten an elektrischen Anlagen: Freischalten, gegen Wiedereinschalten sichern, Spannungsfreiheit allpolig feststellen, erden und kurzschließen, benachbarte unter Spannung stehende Teile abdecken.</li>
      <li><b>Sensorversorgung</b> ist meist 24 V Gleichspannung. Falsch gepolt oder an falsche Spannung angeschlossen, brennt ein Sensor durch. Schaue ins Datenblatt, bevor du anschließt.</li>
      <li><b>Stromschleife nicht im Betrieb auftrennen:</b> 0 mA bedeutet für die Steuerung Fehler oder Drahtbruch und löst eine Störmeldung oder Abschaltung aus. Zum Messen nutzt du ein Messgerät in Reihe nur nach Rücksprache oder einen Messabgriff.</li>
      <li><b>Druck:</b> Vor dem Ausbau eines Drucksensors die Leitung drucklos machen und gegen Wiedereinschalten sichern. Heiße und aggressive Medien: Schutzausrüstung tragen.</li>
      <li><b>Laser und LED-Licht:</b> Nicht in den Strahl blicken, auch nicht in den reflektierten. Beachte die Laserklasse und das Warnschild.</li>
      <li><b>Sicherheitssensoren</b> (zum Beispiel Lichtgitter, Türschalter) dürfen nie überbrückt oder manipuliert werden.</li>
      <li><b>Störungen:</b> Messleitungen getrennt von Leistungsleitungen verlegen, geschirmte Leitung verwenden und den Schirm richtig auflegen (meist einseitig). Das vermeidet Einkopplung und Masseschleifen.</li>
      <li><b>ESD:</b> MEMS-Sensoren und viele Bausteine sind empfindlich gegen elektrostatische Entladung: Erdungsarmband, ESD-Verpackung.</li>
      <li><b>Explosionsgefährdete Bereiche:</b> Dort dürfen nur dafür zugelassene (zum Beispiel eigensichere) Geräte eingebaut werden.</li></ul>` }
  ];
  let helpDone = false;
  function renderHelp() {
    const V = $('#helpView'); if (helpDone) return; helpDone = true;
    V.innerHTML = `<p class="big">Lernen und Hilfe</p><p class="hint2" style="margin:0 0 12px">Kurz erklärt, was du zur Sensorik wissen musst. Mit „Beispiel laden“ landest du direkt am passenden Prüfstand.</p>` +
      LEARN.map((s, i) => `<details${s.open ? ' open' : ''}><summary>${i + 1} · ${esc(s.t)}</summary><div class="hb2">${s.h()}<div class="tryit"><button class="chip s on" data-lx="${i}">▶ ${esc(s.exT)}</button>${s.calc ? `<button class="chip s" data-lc="${i}">🧮 In den Rechner</button>` : ''}</div></div></details>`).join('') +
      `<details><summary>${LEARN.length + 1} · Tastenkürzel</summary><div class="hb2">${keysHtml()}</div></details>`;
  }
  $('#helpView').addEventListener('click', e => {
    const b = e.target.closest('[data-lx]'); if (!b) return; const s = LEARN[+b.dataset.lx];
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
    if (!TABS.some(x => x[0] === t)) t = 'rig'; const prev = S.tab; S.tab = t; lsPut('sen.tab', t);
    $('#mid').dataset.tab = t; $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'curves') renderCurves(); else if (t === 'seq') renderSeq(); else if (t === 'calc') renderCalc(); else if (t === 'tasks') renderTasks(); else if (t === 'help') renderHelp();
    updateChrome();
    requestAnimationFrame(() => { fitCanvas(); updateMeters(0, true); if (t === 'curves') drawCharts(true); if (t === 'seq') drawSeqChart(); });
    if (prev !== t && t === 'seq') renderSeqLive();
  }
  function updateTitle() {
    const nm = S.rig ? rigName(S.rigId) : rigName(S.rigId || 'temperatur');
    $('#title').innerHTML = esc(S.name) + (S.dirty ? ' •' : '') + '\n<small>' + esc(nm) + (S.attrappe ? ' (Notfall-Attrappe)' : '') + (S.running ? ' · läuft' : '') + '</small>';
    document.title = 'Sensorik-Lab: ' + S.name;
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
    else if (b.dataset.a === 'dig') { S.digital = !S.digital; lsPut('sen.digital', S.digital ? '1' : '0'); buildMeters(); updateMeters(0, true); updateChrome(); }
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
        lastUI = ts; syncCtl(); updateStat(); updateChain();
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
    lab: 'sen', tab: () => S.tab, go: setTab, simMode: () => S.running, running: () => S.running, rig: () => S.rigId, speed: () => S.speed,
    load: loadExampleByName, examples: () => exampleList().map(e => e.name), task: () => (S.task ? S.task.id : null), saved: () => saves().length,
    seqRows: () => curRows().length, seqDone: () => !!S.seqRes, simTime: () => S.simT, faults: () => (lsGet('sen.faults', []) || []).length, calcUsed: () => exScore.n > 0
  };
  root.LabKeysAdapter = {
    lab: 'sen', sheet: (title, build) => (title === 'Tastenkürzel' ? sheet(title, b => { b.innerHTML = keysHtml(); }) : sheet(title, build)), esc, toast,
    sim: () => setRun(!S.running), busy: () => true, has: () => false
  };
  /* kleine Testschnittstelle */
  root.SEN_UI = { S, setTab, setRig, setCtl, applyCtl, setRun, resetRig, simAdvance, loadExample, loadExampleByName, startTask, checkTask, seqRunBg, seqLive, seqSteps, curRows, snapshot, allCtl, coerce, CALC, genEx, drawCharts, renderCurves, renderSeq, renderCalc, retryLoad, exampleList, BUILTIN, rec: () => rec, calSpec, calDo, buildChain, updateChain, sigs: () => SIGS, fxClass };

  /* ============================================================ Start */
  function init() {
    buildTabs();
    const cur = lsGet('sen.cur', null);
    if (cur && ORDER.includes(cur.rig)) {
      S.rows = cur.rows && typeof cur.rows === 'object' && !Array.isArray(cur.rows) ? cur.rows : {}; S.name = cur.name || 'Neuer Versuch'; S.id = cur.id || null; S.task = cur.task ? { id: cur.task } : null;
      setRig(cur.rig); applyCtl(cur.ctl); S.dirty = !!cur.dirty;
    } else {
      setRig(ORDER[0]);
      if (!lsRaw('sen.seen', '')) { lsPut('sen.seen', '1'); setTimeout(() => toast('Willkommen im Sensorik-Lab! Wähle oben einen Prüfstand und bewege einen Regler: Die Messkette läuft dann los.'), 900); }
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
