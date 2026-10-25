'use strict';
/* Tonfunk Analogtechnik-Lab (ANA-Lab): Oberfläche (WP3a).
   Seite, acht Tabs (Prüfstand, Verläufe, Kennlinien, Messreihe, Auslegen, Rechnen, Aufgaben, Lernen), Sichtenleiste Kennlinie - Signal - Formel (gleichzeitig sichtbar),
   Gruppen Quelle, Bauteile, Last, Fehlerfall (eingeklappt), Vorgabe und Anzeige, Ampelzeile, Bedienpult und Messgeräte automatisch aus rig.controls / rig.meters,
   Vorher/Nachher (Merken, Geisterbild, Wischer), Sweep und Ablauf (Beispiele mit Ablauf laufen live), Fehler-Würfel, Fehlersuche mit verdecktem Fehler
   (rig.setLock/setHidden, Anzeige "Fehler: ?", Diagnose abgeben, diagnose({ verdeckt: true })), Speichern/Öffnen/Teilen,
   vier aufklappbare Vertiefungen im Prüfstand opv_aktiv (bode, slew, offset, sat; Zahlen nur aus ANA_CORE.deep), Aufgabenanbindung, Qualitätsstufen, Effekte.
   Verläufe, Kennlinien, Messreihe, Auslegen, Rechnen und Lernen kommen aus anaui-wave.js, anaui-curve.js, anaui-report.js, anaui-design.js, anaui-calc.js und anaui-help.js über
   window.ANA_UI_EXT (VERTRAG 6.5); fehlt eine Erweiterung, steht dort "Ansicht wird geladen" (kein Absturz).
   Es gibt hier KEINE zweite Formelimplementierung: assess, diagnose, runSeq, formulas, exercise, limits, deep rufen immer den Kern bzw. den Prüfstand (SPEC Regel 7).
   Speicher: ana.cur, ana.saves, ana.tab, ana.speed, ana.seen (Objekt: w Willkommen, a Hinweis Animation, hint Hinweise, rigs benutzte Prüfstände, faults gesehene Fehlerbilder, dig Zahlenanzeige),
   ana.fx, ana.q, ana.deep ({ bode, slew, offset, sat, n }), sim.done (gemeinsam mit den anderen Labs).
   Erweiterungen schreiben selbst: ana.report (Verlauf der Messreihen), ana.design, S.bericht (laufende Messreihe, wird mit Speichern/Teilen/Abgabe mitgeführt). */
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
  const CORE = () => root.ANA_CORE;
  const DRAW = () => root.ANA_DRAW;
  const ORDER = ['diode', 'schalter', 'emitter', 'folger', 'opv_inv', 'opv_nin', 'opv_komp', 'opv_aktiv'];
  const RIGMETA = {
    diode: { icon: '➡️', name: 'Dioden, LED und Z-Diode', file: 'anarig-diode.js', info: 'Kennlinie, Flussspannung, Vorwiderstand, LED und Z-Diode' },
    schalter: { icon: '🔀', name: 'Transistor als Schalter', file: 'anarig-schalter.js', info: 'Sättigung, Übersteuerung, Basisvorwiderstand, Relais und Freilaufdiode' },
    emitter: { icon: '📶', name: 'Emitterschaltung', file: 'anarig-emitter.js', info: 'Arbeitspunkt, Gegenkopplung, Spannungsverstärkung, Aussteuerung' },
    folger: { icon: '🔁', name: 'Kollektorschaltung und Grundschaltungen', file: 'anarig-folger.js', info: 'Emitterfolger, Vergleich der Grundschaltungen, Z-Folger, Konstantstromquelle' },
    opv_inv: { icon: '➖', name: 'Invertierender Verstärker und Summierer', file: 'anarig-opvinv.js', info: 'Gegenkopplung, Verstärkung -R_f/R_1, Summierer' },
    opv_nin: { icon: '➕', name: 'Nichtinvertierender Verstärker und Differenzverstärker', file: 'anarig-opvnin.js', info: 'Verstärkung 1 + R_f/R_g, Spannungsfolger, Differenzverstärker' },
    opv_komp: { icon: '🔔', name: 'Komparator, Schmitt-Trigger und Rechteckgenerator', file: 'anarig-opvkomp.js', info: 'Schaltschwellen, Hysterese, Kippen, Periodendauer' },
    opv_aktiv: { icon: '📈', name: 'Integrierer, aktive Filter und realer OPV', file: 'anarig-opvaktiv.js', info: 'Integrierer, Differenzierer, Tief- und Hochpass, GBW, Slew-Rate, Offset, Sättigung' }
  };
  const FIRELBL = { diode: 'Spannungsdurchlauf', schalter: 'Schaltvorgang', emitter: 'Aussteuerungsdurchlauf', folger: 'Lastwechsel', opv_inv: 'Frequenzdurchlauf', opv_nin: 'Frequenzdurchlauf', opv_komp: 'Eingangsdurchlauf', opv_aktiv: 'Start' };
  const FIREHINT = {
    diode: 'Die Spannung läuft durch: Der Arbeitspunkt wandert auf der Kennlinie.', schalter: 'Der Transistor schaltet ein und aus: Strom und Spannung folgen (an der Spule mit Zeitkonstante).',
    emitter: 'Die Eingangsamplitude läuft durch: Der Arbeitspunkt pendelt, bei Übersteuerung wird der Ausgang begrenzt.', folger: 'Die Last wechselt: Der Ausgang folgt dem Eingang oder bricht ein.',
    opv_inv: 'Die Frequenz läuft durch: Die Verstärkung fällt am Knick ab.', opv_nin: 'Die Frequenz läuft durch: Die Verstärkung fällt am Knick ab.',
    opv_komp: 'Der Eingang läuft durch: Der Ausgang kippt an den Schaltschwellen.', opv_aktiv: 'Der Eingang springt an: Der Ausgang läuft los (Rampe, Abklingen oder Begrenzen).'
  };
  /* Fünf Gruppen des Bedienpults: EINE Tabelle (controls[].gruppe), Fehlerfall eingeklappt */
  const GRUPPEN = {
    quelle: { id: 'quelle', name: 'Quelle', short: 'Quelle', color: 'var(--g-quelle)', sym: '1', text: 'Spannung, Frequenz und Form der Quelle' },
    bauteile: { id: 'bauteile', name: 'Bauteile', short: 'Bauteile', color: 'var(--g-bauteile)', sym: '2', text: 'Widerstände, Kondensatoren, Transistor, Operationsverstärker: die Bauteile der Schaltung' },
    last: { id: 'last', name: 'Last', short: 'Last', color: 'var(--g-last)', sym: '3', text: 'Verbraucher und Lastwiderstand' },
    fehler: { id: 'fehler', name: 'Fehlerfall', short: 'Fehler', color: 'var(--g-fehler)', sym: '4', text: 'Fehlerbilder als Simulation: offen, Kurzschluss, defekt, verpolt, fehlt' },
    ziel: { id: 'ziel', name: 'Vorgabe und Anzeige', short: '', color: 'var(--g-ziel)', sym: '', text: 'Vorgaben für die Ampel und Anzeigeoptionen' }
  };
  const GR_ORDER = ['quelle', 'bauteile', 'last', 'fehler', 'ziel'];
  const gruppeOf = c => (c && c.gruppe && GRUPPEN[c.gruppe] ? c.gruppe : 'ziel');
  const SICHTEN = [{ id: 'kennlinie', n: 1, name: 'Kennlinie', sub: 'Kennlinie und Arbeitspunkt', color: 'var(--sv-kennlinie)' }, { id: 'signal', n: 2, name: 'Signal', sub: 'Zeitverlauf', color: 'var(--sv-signal)' }, { id: 'formel', n: 3, name: 'Formel', sub: 'Rechenweg und Wert', color: 'var(--sv-formel)' }];
  const RIGLIMITS = {
    diode: ['uf_si', 'uf_schottky', 'uf_led_rot', 'led_imax', 'pz_max', 'rz', 'uz_std'], schalter: ['ube', 'ucesat', 'ue_min', 'ue_typ', 'uceo', 'icmax', 'ptot', 'ufd_freilauf'],
    emitter: ['ube', 'b_std', 'ut', 'ap_fenster', 'klirr_grenze', 'emitter_phase'], folger: ['ube', 'b_std', 'kollektor_vu', 'ut'],
    opv_inv: ['uv_std', 'dusat', 'a0', 'opv_inv_phase', 'fenster_op_gruen', 'fenster_op_gelb'], opv_nin: ['uv_std', 'dusat', 'a0', 'opv_nin_vmin', 'opv_folger_v'],
    opv_komp: ['uv_std', 'dusat', 'schmitt_schwellen'], opv_aktiv: ['uv_std', 'dusat', 'a0', 'gbw_langsam', 'sr_langsam', 'uos_langsam', 'gbw_schnell', 'sr_schnell', 'uos_schnell', 'integr_db']
  };
  /* ana.seen: EIN Objekt für alle kleinen Merker (bleibt bei den zehn Speicherschlüsseln der SPEC) */
  const seenObj = () => { const o = lsGet('ana.seen', null); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; };
  const seenGet = (k, d) => { const v = seenObj()[k]; return v === undefined ? d : v; };
  const seenSet = (k, v) => { const o = seenObj(); o[k] = v; lsSet('ana.seen', o); };
  /* Messgeräte-Ansicht: 'gauge' (Zeiger, Standard wie bisher), 'digital' (Zahlen) oder 'front' (Frontplatte, geraete.js); Wahl in ana.seen (mv), Rückfall auf den alten Schalter dig */
  const MVIEWS = ['gauge', 'digital', 'front'], MVNAME = { gauge: 'Zeiger', digital: 'Zahlen', front: 'Frontplatte' };
  const mviewInit = () => { const v = seenGet('mv', null); return MVIEWS.includes(v) ? v : seenGet('dig', 0) === 1 ? 'digital' : 'gauge'; };
  const SIBASE = /^(Hz|F|H|Ω|V|A|W|s)$/;
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
  root.LabUI = { sheet, esc, toast, userName: () => lsRaw('lm4.name', ''), LAB: 'ana' };
  root.sheet = sheet; root.toast = toast;

  const defOf = id => {
    const r = root.ANA_RIGS;
    return r && r.defs && r.defs[id] ? r.defs[id] : null;
  };
  const rigName = id => { const d = defOf(id); return (d && d.name) || (RIGMETA[id] || {}).name || id; };
  const rigIcon = id => { const d = defOf(id); return (d && d.icon) || (RIGMETA[id] || {}).icon || '🎛️'; };

  /* ============================================================ Zustand */
  const mqReduce = (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)')) || { matches: false };
  /* Zeitlupe und Zeitraffer: der Prüfstand rechnet die Darstellungsphase selbst mit setSpeed (0,05 bis 2), die Oberfläche reicht die Stufe weiter */
  const SPEEDS = [0.1, 0.25, 0.5, 1, 2];
  const S = {
    tab: lsRaw('ana.tab', 'rig'), rigId: null, rig: null, refRig: null, err: '', name: 'Neuer Versuch', id: null, task: null, dirty: false,
    running: false, speed: +lsRaw('ana.speed', '1') || 1, mview: mviewInit(), digital: mviewInit() === 'digital',
    ctl: {}, simT: 0, rows: {}, live: null, seqRes: null, readonly: false, ref: null, refMode: 'nachher', wipe: 0.5, gruppe: null,
    clicks: [], sichtHot: null, calcUsed: false, fired: false, bericht: null, simClosed: {}, lock: [], hidden: [], diagnose: null, faultStart: null, gOpen: {},
    q: { mode: lsRaw('ana.q', 'auto'), level: 'hoch', ms: [], lastSwitch: 0, fastSince: 0 }
  };
  const TABS = [['rig', '🎛️', 'Prüfstand'], ['wave', '〰️', 'Verläufe'], ['curve', '📈', 'Kennlinien'], ['report', '📋', 'Messreihe'], ['design', '📐', 'Auslegen'], ['calc', '🧮', 'Rechnen'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Lernen']];
  if (!TABS.some(x => x[0] === S.tab)) S.tab = 'rig';
  if (!SPEEDS.includes(S.speed)) S.speed = 1;
  if (!['auto', 'hoch', 'mittel', 'niedrig'].includes(S.q.mode)) S.q.mode = 'auto';
  const QLEVELS = ['hoch', 'mittel', 'niedrig'];

  /* ---- Tastenkürzel: EINE Tabelle für Behandler, Hilfe-Blatt und Menü (Regel 5) ---- */
  const KEYS = [
    { id: 'run', keys: ['Leertaste'], match: e => e.key === ' ', t: 'Prüfstand starten und anhalten', act: () => setRun(!S.running) },
    { id: 'reset', keys: ['Z'], match: e => e.key.toLowerCase() === 'z' && !(e.ctrlKey || e.metaKey), t: 'Prüfstand zurücksetzen (Reset)', act: () => resetRig() },
    { id: 'fx', keys: ['E'], match: e => e.key.toLowerCase() === 'e', t: 'Effekte und Ton ein oder aus', act: () => toggleFx() },
    { id: 'speed', keys: ['1', '2', '3', '4', '5'], match: e => e.key >= '1' && e.key <= '5', t: 'Zeitlupe und Zeitraffer ×0,1 / ×0,25 / ×0,5 / ×1 / ×2', act: e => setSpeed(SPEEDS[+e.key - 1]) },
    { id: 'merk', keys: ['M'], match: e => e.key.toLowerCase() === 'm', t: 'Zustand merken (Vorher)', act: () => merken() },
    { id: 'vn', keys: ['V'], match: e => e.key.toLowerCase() === 'v', t: 'Zwischen Vorher und Nachher wechseln', act: () => toggleVN() },
    { id: 'wipe', keys: ['W'], match: e => e.key.toLowerCase() === 'w', t: 'Wischer Vorher | Nachher ein oder aus', act: () => toggleWipe() },
    { id: 'fire', keys: ['F'], match: e => e.key.toLowerCase() === 'f' && !(e.ctrlKey || e.metaKey), t: 'Auslösen oder Durchlauf starten (je Prüfstand: Spannungsdurchlauf, Schaltvorgang, Aussteuerungsdurchlauf, Lastwechsel, Frequenzdurchlauf, Eingangsdurchlauf, Start)', act: () => doFire() },
    { id: 'bode', keys: ['B'], match: e => e.key.toLowerCase() === 'b' && !(e.ctrlKey || e.metaKey), t: 'Vertiefung „Bode-Diagramm“ auf- oder zuklappen (Prüfstand Integrierer und realer OPV, Tab Kennlinien)', act: () => toggleBode() },
    { id: 'save', keys: ['S', 'Strg + S'], match: e => e.key.toLowerCase() === 's', t: 'Versuch speichern', act: () => doSave() },
    { id: 'enter', keys: ['Eingabe', 'F5'], ext: true, t: 'Starten und anhalten (gilt auch außerhalb der Bildfläche)' },
    { id: 'help', keys: ['?'], ext: true, t: 'Diese Übersicht' }
  ];
  function keysHtml() {
    const kd = a => a.map(x => `<code>${esc(x)}</code>`).join(' oder ');
    return '<table>' + KEYS.map(k => `<tr><td class="nw">${kd(k.keys)}</td><td>${esc(k.t)}</td></tr>`).join('') + '</table><p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>';
  }
  root.ANA_KEYS = KEYS;

  let drawErr = false, curT = 0, taskRes = null; const taskAns = {};
  /* Auswahlfelder: Einträge als Text oder { value, label } erlaubt; die Oberfläche arbeitet mit Kopien, die Definition des Prüfstands bleibt unberührt */
  const optNorm = o => (Array.isArray(o) ? o : []).map(x => (x && typeof x === 'object' ? { value: x.value, label: x.label != null ? x.label : String(x.value) } : { value: x, label: String(x) }));
  let ctlCache = { rig: null, list: [] };
  const ctlsOf = () => {
    if (!S.rig) return [];
    if (ctlCache.rig !== S.rig) { const src = S.rig.controls || (defOf(S.rigId) || {}).controls || []; ctlCache = { rig: S.rig, list: src.filter(Boolean).map(c => (c.type === 'select' ? Object.assign({}, c, { options: optNorm(c.options) }) : c)) }; }
    return ctlCache.list;
  };
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
  /* Verdeckter Fehler (Fehlersuche): gesperrte und verdeckte Steuerwerte. Beides gilt auch im Prüfstand (setLock/setHidden), die Oberfläche zeigt verdeckte Werte nie. */
  const isLocked = k => !!(S.lock && S.lock.includes(k));
  const isHid = k => !!(S.hidden && S.hidden.includes(k));
  const verdecktNow = () => isHid('fehler');
  function resetRun() {
    S.running = false; S.simT = 0; S.live = null; S.seqRes = null; S.fired = false; S.diag = []; S.diagSeen = {}; S.fx = { amp: null, kazoo: false, flags: {} };
  }
  /* Zeitlupe: die Stufe geht an den Prüfstand (Darstellungsphase und Anzeige "Zeitlupe ×n") */
  function applySpeed(r) { const x = r || S.rig; if (x && typeof x.setSpeed === 'function') { try { x.setSpeed(S.speed); } catch (e) { /* kein Absturz */ } } }
  function setRig(id, o) {
    o = o || {};
    if (!ORDER.includes(id)) id = ORDER[0];
    const same = id === S.rigId;
    S.rigId = id; S.rig = null; S.refRig = null; S.err = ''; S.ctl = {}; S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; S.preset = null; S.st = null; S.sichtHot = null; S.dice = null;
    S.lock = []; S.hidden = []; S.diagnose = null; S.faultStart = null; ctlCache = { rig: null, list: [] };
    if (!same && !o.keepRef) { S.ref = null; S.refMode = 'nachher'; }
    resetRun(); fxReset();
    const d = defOf(id);
    if (d) { try { S.rig = d.create(o.opts || {}); } catch (e) { S.err = (e && e.message) || String(e); console.error('Prüfstand ' + id + ':', e); } }
    if (!S.rows[id]) S.rows[id] = [];
    applySpeed();
    buildRefRig(); buildPick(); buildPresets(); buildControls(); buildMeters(); buildSicht(); buildLimits(); buildDeep(); updateSimBand(); buildFaultPanel(); buildBA(); renderSweep(); fitCanvas(); updateEvents(true); updateChrome(); readState(); updateAmp(true);
    if (EXTHOST[S.tab]) renderExt(S.tab);
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
    if (isLocked(key)) return false; const def = ctlDef(key), v = coerce(def, val); if (v === undefined) return false;
    let ok = true; try { ok = S.rig.setControl(key, v) !== false; } catch (e) { console.error(e); return false; }
    if (!ok) { syncCtl(true); return false; }
    S.ctl[key] = v;
    if (!silent) {
      S.dirty = true; saveCurSoon(); S.sichtHot = def && def.sicht ? def.sicht : null; updateSicht();
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
  function saveCur() { if (!S.rig) return; lsSet('ana.cur', { rig: S.rigId, ctl: allCtl(), ref: S.ref, refMode: S.refMode, rows: S.rows, name: S.name, id: S.id, task: S.task ? S.task.id : null, dirty: S.dirty, bericht: S.bericht, lock: S.lock, hidden: S.hidden, diagnose: S.diagnose, dice: S.dice, fstart: S.faultStart }); }
  function usedRig() {
    if (!S.rigId || !defOf(S.rigId)) return;
    const a = seenGet('rigs', []), s = new Set(Array.isArray(a) ? a : []); s.add(S.rigId); seenSet('rigs', [...s]); stat('anarigs', s.size, 'max');
  }
  function readState() { if (!S.rig) { S.st = null; return null; } try { S.st = S.rig.state(); } catch (e) { S.st = S.st || null; } return S.st; }

  /* ---- Prüfstandwahl und Voreinstellungen ---- */
  function buildPick() {
    $('#rigPick').innerHTML = ORDER.map(id => {
      const have = !!defOf(id);
      return `<button class="chip${id === S.rigId ? ' on' : ''}${have ? '' : ' miss'}" data-rig="${id}">${rigIcon(id)} ${esc(rigName(id))}${have ? '' : ' ⚠'}</button>`;
    }).join('');
  }
  $('#rigPick').addEventListener('click', e => { const b = e.target.closest('[data-rig]'); if (b) usePick(b.dataset.rig); });
  function usePick(id) {
    if (id === S.rigId) return;
    if (S.task) { toast('Während einer Aufgabe ist der Prüfstand fest. Beende zuerst die Aufgabe.'); return; }
    stash(); S.name = 'Neuer Versuch'; S.id = null; S.dirty = false; setRig(id); toast('Prüfstand: ' + rigName(id));
  }
  /* Bei verdecktem Wert (Fehlersuche) gibt es keine Voreinstellungen: Namen wie "Diode verpolt (Fehlerbild)" wären ein Hinweis, und eine Voreinstellung würde den Aufbau mitten in der Suche ändern */
  const presetHidden = p => S.hidden.length > 0 || !!(p && p.controls && typeof p.controls === 'object' && Object.keys(p.controls).some(k => isLocked(k)));
  const presetsOf = () => (S.rig && (S.rig.presets || (defOf(S.rigId) || {}).presets)) || [];
  function buildPresets() {
    const P = presetsOf().filter(p => !presetHidden(p)), el = $('#presetBar');
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
    buildControls(); buildMeters(); buildPresets(); buildSicht(); readState(); updateEvents(true); updateChrome(); updateAmp(true); toast('Voreinstellung: ' + p.name); S.dirty = true; saveCurSoon(); void keepRef;
  });

  /* ---- Platzhalter, wenn ein Prüfstand fehlt ---- */
  const FILES = ['anacore.js', 'anacore-op.js', 'anacore-res.js', 'anadraw.js', 'anarig-base.js', 'anarig-diode.js', 'anarig-schalter.js', 'anarig-emitter.js', 'anarig-folger.js', 'anarig-opvinv.js', 'anarig-opvnin.js', 'anarig-opvkomp.js', 'anarig-opvaktiv.js', 'anadata.js', 'anatasks1.js', 'anatasks2.js'];
  function placeholderHtml() {
    const why = S.err ? 'Der Prüfstand konnte nicht gestartet werden: ' + esc(S.err) : 'Die Datei für „' + esc(rigName(S.rigId)) + '“ ist noch nicht geladen.';
    return `<div class="ph2"><b>Prüfstand noch nicht geladen</b>${why}<br><button class="btn" data-retry>Erneut prüfen</button></div>`;
  }
  function fileMissing(f) {
    if (f === 'anacore.js') return !root.ANA_CORE;
    if (f === 'anacore-op.js') return !(root.ANA_CORE && root.ANA_CORE.op);
    if (f === 'anacore-res.js') return !(root.ANA_CORE && typeof root.ANA_CORE.runSeq === 'function');
    if (f === 'anadraw.js') return !root.ANA_DRAW;
    if (f === 'anadata.js') return !root.ANA_DATA;
    if (f === 'anatasks1.js' || f === 'anatasks2.js') return !root.ANA_TASKS;
    if (f === 'anarig-base.js') return !(root.ANA_RIGS && root.ANA_RIGS.base);
    const id = ORDER.find(i => RIGMETA[i].file === f); return !(root.ANA_RIGS && root.ANA_RIGS.defs && root.ANA_RIGS.defs[id]);
  }
  const loadFile = f => new Promise(res => { const s = document.createElement('script'); s.src = f + '?t=' + Date.now(); s.onload = s.onerror = () => res(); document.head.appendChild(s); });
  function retryLoad() {
    const want = FILES.filter(fileMissing);
    if (!want.length) { setRig(S.rigId); toast('Alles geladen'); return Promise.resolve(); }
    toast('Lade fehlende Dateien …');
    return Promise.all(want.map(loadFile)).then(() => {
      const still = ORDER.filter(i => !defOf(i)).length;
      const keep = S.rig ? allCtl() : ((lsGet('ana.cur', {}) || {}).ctl || {}); setRig(S.rigId); applyCtl(keep); buildPick();
      if (S.tab === 'tasks') renderTasks(); toast(still ? still + ' Prüfstand' + (still > 1 ? 'e fehlen' : ' fehlt') + ' noch' : 'Alle Prüfstände geladen');
    });
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-retry]')) retryLoad(); });

  /* ============================================================ Sichtenleiste Kennlinie - Signal - Formel und Ampelzeile */
  function sichtOf() { const c = S.rig && S.rig.sicht; return c && typeof c === 'object' ? c : null; }
  let sichtSig = '';
  function buildSicht() { sichtSig = ''; updateSicht(true); }
  /* Die drei Texte kommen nur aus rig.sicht, die Hervorhebung aus controls[].sicht, "Zeitlupe ×n" nur, wenn der Prüfstand state().zeitlupe meldet */
  function updateSicht(force) {
    const el = $('#sichtBar'); if (!el) return; const c = sichtOf();
    if (!c) { if (el.innerHTML) el.innerHTML = ''; el.hidden = true; sichtSig = ''; return; }
    const st = S.st || {}, zl = fin(+st.zeitlupe) && +st.zeitlupe > 0 ? +st.zeitlupe : 0;
    const sig = [c.kennlinie, c.signal, c.formel, zl, S.sichtHot].join('|'); if (!force && sig === sichtSig) return; sichtSig = sig; el.hidden = false;
    el.innerHTML = '<div class="cnrow" role="group" aria-label="Kennlinie, Signal, Formel: drei Sichten auf dieselbe Schaltung">' + SICHTEN.map(v => `<div class="cn${S.sichtHot === v.id ? ' hot' : ''}" data-sv="${v.id}" style="--lc:${v.color}"><b><i class="lsym">${v.n}</i> ${esc(v.name)}</b><span>${esc(c[v.id] || '–')}</span><small>${esc(v.sub)}${v.id === 'signal' && zl ? ' · Zeitlupe ×' + String(+zl.toFixed(1)).replace('.', ',') : ''}</small></div>`).join('') + '</div>';
  }
  let ampSig = '';
  const sgn = v => (v > 0 ? '+' : '');
  function assessOf(rig) { let a = null; try { a = rig && typeof rig.assess === 'function' ? rig.assess() : null; } catch (e) { a = null; } return a && typeof a === 'object' ? a : null; }
  const margTxt = a => (a && fin(a.margin) ? 'Marge ' + fnum(a.margin, 2) + (a.marginUnit ? ' ' + a.marginUnit : '') : '');
  const ampelHinweis = () => { const C = CORE(); return (C && C.TEXTS && typeof C.TEXTS.ampelHinweis === 'string' && C.TEXTS.ampelHinweis) || 'Grün heißt: Vorgabe der Simulation erfüllt, nicht: Schaltung ist für jeden Einsatz geeignet.'; };
  const simText = () => { const C = CORE(); return (C && C.TEXTS && typeof C.TEXTS.simOnly === 'string' && C.TEXTS.simOnly) || 'Simulation – Übungswerte. Aufbau und Messung am Labortisch nur nach Anweisung der Ausbilder.'; };
  function updateAmp(force) {
    const el = $('#ampRow'); if (!el) return; const a = assessOf(S.rig);
    if (!a) { el.innerHTML = ''; return; }
    const k = ampKey(a.ampel), ra = S.ref && S.refRig ? assessOf(S.refRig) : null, zu = typeof a.zusatz === 'string' ? a.zusatz : '';
    const sig = [k, a.margin, a.text, zu, ra ? ra.ampel + ra.margin : '', S.refMode].join('|');
    if (!force && sig === ampSig) return; ampSig = sig;
    const A = AMP[k], mt = k === 'grau' ? '' : margTxt(a);
    el.className = 'amprow ' + A.cls; el.setAttribute('role', 'status');
    el.innerHTML = `<span class="asym" aria-hidden="true">${A.sym}</span><div class="atx"><b>${esc(A.name.charAt(0).toUpperCase() + A.name.slice(1))}${mt ? ': ' + esc(mt) : ''}</b><small>${esc(a.text || '')}</small>${zu ? `<small class="nt">${esc(zu)}</small>` : ''}<small class="nt">${esc(ampelHinweis())}</small></div>${ra ? `<div class="avs"><span>Vorher: ${esc(AMP[ampKey(ra.ampel)].sym)} ${fin(ra.margin) ? fnum(ra.margin, 2) : esc(AMP[ampKey(ra.ampel)].name)}</span><span>Nachher: ${esc(A.sym)} ${fin(a.margin) ? fnum(a.margin, 2) : esc(A.name)}${fin(a.margin) && fin(ra.margin) ? ' (' + sgn(a.margin - ra.margin) + fnum(a.margin - ra.margin, 2) + ')' : ''}</span></div>` : ''}`;
    const cv = $('#cv'); if (cv) { let al = ''; try { al = typeof S.rig.ariaLabel === 'function' ? String(S.rig.ariaLabel() || '') : ''; } catch (e) { al = ''; } cv.setAttribute('aria-label', al || ('Bild des Prüfstands ' + rigName(S.rigId) + '. Ampel ' + A.name + (mt ? ', ' + mt : '') + '. ' + (a.text || '') + ' ' + ampelHinweis())); }
  }
  /* Hinweisband (simOnly): einmal je Anlage, schließbar (nur für diese Sitzung) */
  function updateSimBand() { const el = $('#simBand'); if (!el) return; $('#simTx').textContent = simText(); el.hidden = !!S.simClosed[S.rigId]; }
  $('#simX').onclick = () => { S.simClosed[S.rigId] = 1; updateSimBand(); };
  /* Grenzwerte mit Status (Quelle ANA_CORE.limits): belegt oder Übungswert (A) */
  const limGet = id => { const C = CORE(); try { const l = C && typeof C.limit === 'function' ? C.limit(id) : null; return l && l.ok !== false && l.id ? l : null; } catch (e) { return null; } };
  const limBadge = l => (l.status === 'belegt' ? '<span class="bdg ok" title="belegt: Prüfungspool oder Ausbilder">✓ belegt</span>' : '<span class="bdg uw" title="Übungswert: Der Ausbilder gleicht ab">Übungswert (A)</span>');
  const CMPSYM = { '<=': '≤', '>=': '≥', '=': '=' };
  const limSrc = l => (l.status !== 'belegt' ? 'Der Ausbilder gleicht ab' + (l.frage ? ' (' + l.frage + ')' : '') : /^pool:/.test(l.quelle || '') ? 'Quelle: Prüfungs-Pool ' + l.quelle.slice(5) : l.quelle === 'toni' ? 'Quelle: Ausbilder' : 'Quelle: ' + (l.quelle || '–'));
  function limIds() { const ids = new Set(RIGLIMITS[S.rigId] || []); ctlsOf().forEach(c => { if (c && c.limit) ids.add(c.limit); }); metersOf().forEach(m => { if (m && m.limit) ids.add(m.limit); }); return [...ids]; }
  function buildLimits() {
    const card = $('#cLim'), host = $('#limList'); if (!card || !host) return;
    const L = limIds().map(limGet).filter(Boolean);
    const lv = l => { const C = CORE(); let t = ''; try { t = C && typeof C.limitText === 'function' ? String(C.limitText(l.id)) : ''; } catch (e) { t = ''; } t = t.replace(/ \(Übungswert\)$/, ''); return t || ((CMPSYM[l.cmp] || '') + ' ' + fauto(l.value) + (l.unit ? ' ' + l.unit : '')); }; card.hidden = !L.length; host.innerHTML = L.map(l => `<div class="lim"><span>${esc(l.text || l.id)}</span><span><b>${esc(lv(l))}</b> ${limBadge(l)}</span><small>${esc(limSrc(l))}</small></div>`).join('');
  }
  /* ============================================================ Vorher/Nachher: Merken, Geisterbild, Wischer */
  function buildRefRig() {
    S.refRig = null; if (!S.ref || !S.rig) return; const d = defOf(S.rigId); if (!d) return;
    try { const r = d.create({ seed: 1 }); if (typeof r.restore === 'function') r.restore(clone(S.ref)); applySpeed(r); S.refRig = r; } catch (e) { console.error('Referenz:', e); S.refRig = null; }
  }
  function setRef(snap) { S.ref = snap ? clone(snap) : null; if (!S.ref) S.refMode = 'nachher'; buildRefRig(); buildBA(); updateAmp(true); extRefresh(); S.dirty = true; saveCurSoon(); }
  function merken() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    let s = null; try { s = S.rig.snapshot(); } catch (e) { s = null; } if (!s) { toast('Dieser Prüfstand kann seinen Zustand nicht merken.'); return; }
    setRef(s); stat('anaref', 1, 'max'); const a = assessOf(S.rig);
    toast('Gemerkt als Vorher' + (a && fin(a.margin) ? ' (' + margTxt(a) + ')' : '') + '. Ändere jetzt etwas und vergleiche.');
  }
  function toggleVN() {
    if (!S.ref) { toast('Merke zuerst einen Zustand: Taste M oder „Merken“.'); return; }
    S.refMode = S.refMode === 'vorher' ? 'nachher' : 'vorher'; buildBA(); updateAmp(true); stat('anaref', 1, 'max');
  }
  function toggleWipe() {
    if (!S.ref) { toast('Merke zuerst einen Zustand: Taste M oder „Merken“.'); return; }
    S.refMode = S.refMode === 'wischer' ? 'nachher' : 'wischer'; buildBA(); updateAmp(true); stat('anaref', 1, 'max'); if (S.tab !== 'rig') setTab('rig');
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
    if (m) { S.refMode = m.dataset.bm; buildBA(); updateAmp(true); stat('anaref', 1, 'max'); return; }
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

  /* ============================================================ Bedienpult aus rig.controls (nach Gruppen Quelle, Bauteile, Last, Vorgabe gruppiert, mehrere Instanzen synchron) */
  let panels = [];
  const slPos = (c, v) => { if (c.scale === 'log' && c.min > 0 && c.max > c.min) return Math.round(1000 * Math.log(clamp(v, c.min, c.max) / c.min) / Math.log(c.max / c.min)); return Math.round(1000 * (clamp(v, c.min, c.max) - c.min) / ((c.max - c.min) || 1)); };
  function slVal(c, pos) {
    let v = c.scale === 'log' && c.min > 0 && c.max > c.min ? c.min * Math.pow(c.max / c.min, pos / 1000) : c.min + (c.max - c.min) * pos / 1000;
    if (c.step && c.scale !== 'log') v = Math.round(v / c.step) * c.step; else if (c.scale === 'log') { const d = fin(v) ? Math.pow(10, Math.floor(Math.log10(Math.max(1e-12, v))) - 2) : 0.01; v = Math.round(v / d) * d; }
    return clamp(+v.toPrecision(10), c.min, c.max);
  }
  const siUnit = c => !!(c.unit && SIBASE.test(c.unit));
  /* Anzeige: Werte in SI-Basiseinheit (Ω, V, A, s ...) mit Vorsatz (1,5 kΩ), sonst in der Einheit des Reglers (mm², m, mA, nF ...) */
  /* Anschläge: "oberer Anschlag = Leerlauf" (Lastwiderstand) bzw. "= ohne" (Rf des Integrierers), "unterer Anschlag = ohne" (Rs des Differenzierers) */
  const anschlag = (c, v) => {
    const lb = String(c.label || ''); if (c.type !== 'slider' || !fin(v)) return '';
    if (/oberer Anschlag/.test(lb) && v >= c.max * 0.9999) return /Leerlauf/.test(lb) ? 'Leerlauf' : 'ohne';
    if (/unterer Anschlag/.test(lb) && v <= c.min * 1.0001) return 'ohne';
    return '';
  };
  const ctlShow = (c, v) => anschlag(c, v) || (siUnit(c) && c.unitKind !== 'plain' ? fe(v, c.unit) : fnum(v, c.scale === 'log' ? adig(v) : decs(c.step)) + (c.unit ? ' ' + c.unit : ''));
  function ctlParse(c, text) {
    let t = String(text == null ? '' : text).trim(); if (!t) return NaN;
    if (/^(leerlauf|ohne|offen|∞)$/i.test(t) && /Anschlag/.test(c.label || '')) return /unterer Anschlag/.test(c.label) ? c.min : c.max;
    if (siUnit(c)) return parseNum(t);
    if (c.unit && t.endsWith(c.unit)) t = t.slice(0, -c.unit.length).trim();
    const v = parseFloat(t.replace(/\s/g, '').replace(',', '.')); return fin(v) ? v : NaN;
  }
  function ctlHtml(c) {
    const k = esc(c.key), L = GRUPPEN[gruppeOf(c)], lim = c.limit ? limGet(c.limit) : null, bd = lim ? ' ' + limBadge(lim) : '', help = c.help ? `<small class="hp">${esc(c.help)}</small>` : '', lv = `data-lv="${gruppeOf(c)}" data-sv="${esc(c.sicht || '')}" style="--lc:${L.color}"`;
    /* verdeckter Wert (Fehlersuche): nur "Fehler: ?", weder Auswahl noch Hilfetext noch Beschriftung der Optionen */
    if (isHid(c.key)) return `<div class="ct hid" data-k="${k}" data-t="hidden" ${lv}><div class="ctl"><span>${c.key === 'fehler' ? 'Fehler: ?' : esc(c.label) + ': ?'}</span></div><small class="hp">${c.key === 'fehler' ? 'Der Fehlerfall ist verdeckt. Miss, vergleiche und gib deine Diagnose ab.' : 'Dieser Wert ist verdeckt.'}</small></div>`;
    if (c.type === 'slider') return `<div class="ct" data-k="${k}" data-t="slider" ${lv}><div class="ctl"><span>${esc(c.label)}${bd}</span><span class="vi"><input class="num" inputmode="decimal" autocomplete="off" aria-label="${esc(c.label)}, Wert eingeben"></span></div>${help}<input type="range" min="0" max="1000" step="1" value="0" aria-label="${esc(c.label)}"></div>`;
    if (c.type === 'switch') return `<div class="ct p0" data-k="${k}" data-t="switch" ${lv}><button class="sw" role="switch" aria-checked="false" aria-label="${esc(c.label)}"><span class="lab">${esc(c.label)}${bd}${help}</span><span class="tgl"><i></i></span></button></div>`;
    if (c.type === 'button') return `<div class="ct p0" data-k="${k}" data-t="button" ${lv}><button class="bt${c.key === 'fire' ? ' fire' : ''}">${esc(c.label)}${c.key === 'fire' ? '' : ' (halten)'}</button>${help ? `<div class="bth">${help}</div>` : ''}</div>`;
    if (c.type === 'select') {
      const o = c.options || [], long = o.some(x => String(x.label).length > 14) && o.length > 2;
      const body = o.length <= 4 && !long ? `<div class="seg">${o.map((x, i) => `<button data-i="${i}">${esc(x.label)}</button>`).join('')}</div>` : o.length <= 5 && o.length > 1 && o.every(x => String(x.label).length <= 26) ? `<div class="chips ctrlchips">${o.map((x, i) => `<button class="chip s" data-i="${i}">${esc(x.label)}</button>`).join('')}</div>` : `<select aria-label="${esc(c.label)}">${o.map((x, i) => `<option value="${i}">${esc(x.label)}</option>`).join('')}</select>`;
      return `<div class="ct" data-k="${k}" data-t="select" ${lv}><div class="ctl"><span>${esc(c.label)}${bd}</span></div>${help}${body}</div>`;
    }
    return '';
  }
  /* Auslöse-Taste oben im Bedienpult (rig.fire(): je Anlage Spannungsdurchlauf, Schaltvorgang, Aussteuerungsdurchlauf, Lastwechsel, Frequenzdurchlauf, Eingangsdurchlauf, Start) */
  const fireHtml = () => (canFire() && !hasCtl('fire') ? `<div class="ct p0" data-fire="1"><button class="bt fire" title="Taste F" aria-label="${esc(FIRELBL[S.rigId] || 'Auslösen')} (Taste F)">⚡ ${esc(FIRELBL[S.rigId] || 'Auslösen')}</button><div class="bth"><small class="hp" style="padding:0 12px">${esc(FIREHINT[S.rigId] || '')}</small></div></div>` : '');
  function buildPanel(host, filter, title) {
    panels = panels.filter(p => p.host !== host && p.host.isConnected);
    if (!S.rig) { host.innerHTML = '<div class="card">' + placeholderHtml() + '</div>'; return; }
    const list = ctlsOf().filter(c => !filter || filter.includes(c.key)), groups = [], gm = {};
    list.forEach(c => { const lv = filter ? 'f' : gruppeOf(c), L = GRUPPEN[lv] || { name: title || 'Bedienung', color: '#8d99a6' }; if (!gm[lv]) { gm[lv] = { lv, n: filter ? (title || 'Bedienung') : L.name, color: L.color, sym: (GRUPPEN[lv] || {}).sym || '', items: [] }; groups.push(gm[lv]); } gm[lv].items.push(c); });
    if (!filter) groups.sort((a, b) => GR_ORDER.indexOf(a.lv) - GR_ORDER.indexOf(b.lv)); else groups.forEach(g => g.items.sort((a, b) => filter.indexOf(a.key) - filter.indexOf(b.key)));
    /* Fehlerfall: eingeklappt (Standard keiner), bei verdecktem Fehler offen, damit "Fehler: ?" zu sehen ist; die Klappe merkt sich die Bedienung je Sitzung */
    const isOpen = g => (S.gOpen[g.lv] !== undefined ? !!S.gOpen[g.lv] : g.lv === 'fehler' ? S.hidden.length > 0 : true);
    host.innerHTML = (filter ? '' : fireHtml()) + groups.map(g => `<details class="card ctg"${isOpen(g) ? ' open' : ''} data-lv="${g.lv}" style="--lc:${g.color}"><summary>${g.sym ? `<i class="lsym">${g.sym}</i> ` : ''}${esc(g.n)}${(g.lv === 'bauteile' || g.lv === 'last') && !filter ? ' <span class="bdg uw" title="Übungswerte: Der Ausbilder gleicht ab">Übungswerte (A)</span>' : ''}</summary><div class="cb">${g.items.map(ctlHtml).join('')}</div></details>`).join('');
    $$('details.ctg', host).forEach(d => d.addEventListener('toggle', () => { S.gOpen[d.dataset.lv] = d.open; }));
    const els = {}; $$('.ct[data-k]', host).forEach(el => {
      els[el.dataset.k] = { el, t: el.dataset.t, last: undefined, vis: true };
      if (isLocked(el.dataset.k) && el.dataset.t !== 'hidden') { el.classList.add('lockd'); $$('input,button,select', el).forEach(i => { i.disabled = true; }); el.setAttribute('aria-disabled', 'true'); el.insertAdjacentHTML('beforeend', '<small class="hp lk">🔒 gesperrt (Fehlersuche)</small>'); }
    });
    panels.push({ host, els }); if (!host.__anaWired) { host.__anaWired = true; wirePanel(host); } syncCtl(true);
  }
  function buildControls() { ctlCache = { rig: null, list: [] }; buildPanel($('#ctlHost'), null); }
  function syncCtl(force) {
    if (!S.rig) return;
    const st = S.st || readState();
    panels = panels.filter(p => p.host.isConnected);
    panels.forEach(p => ctlsOf().forEach(c => {
      const x = p.els[c.key]; if (!x || x.t === 'hidden') return;
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
    if (!S.rig || typeof S.rig.fire !== 'function') { toast('Hier gibt es nichts auszulösen.'); return false; }
    if (S.readonly) return false;
    let r; try { r = S.rig.fire(); } catch (e) { console.error(e); return false; } if (r === false) return false;
    S.fired = true; S.sichtHot = null; updateSicht(); if (!S.running) setRun(true, true);
    stat('anafire', 1);
    readState(); updateAmp(true); updateMeters(0, true);

    return true;
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
  /* Messwert als Text: "∞" ab infAbove (Standard 1e11, offener Zweig), Text-Messwerte aus meters[].texts (idealer OPV: "unbegrenzt"), sonst Zahl mit Dezimalkomma */
  const isInf = (m, v) => fin(v) && Math.abs(v) >= (fin(+m.infAbove) ? +m.infAbove : 1e11);
  const meterText = (m, v) => {
    if (!fin(v)) return '–';
    if (m.texts && m.texts[Math.round(v)] != null) return String(m.texts[Math.round(v)]);
    if (isInf(m, v)) return m.infText ? String(m.infText) : '∞';
    return fnum(v, m.digits == null ? 1 : m.digits);
  };
  /* Frontplatte (geraete.js): reiner Adapter, gleiche Regeln wie meterText (–, ∞, texts[], Dezimalkomma); Zahl, Einheit und digits kommen unverändert aus rig.meters[] */
  const meterState = (m, v) => ({ value: v, unit: m.unit || '', digits: m.digits == null ? 1 : m.digits, label: m.label, help: m.help || '', inf: isInf(m, v), infText: m.infText, text: fin(v) && m.texts && m.texts[Math.round(v)] != null ? String(m.texts[Math.round(v)]) : null });
  const frontOk = () => !!(root.GERAETE && typeof root.GERAETE.renderMultimeter === 'function');
  function buildMeters() {
    const H = $('#meters'); mEls.forEach(x => { if (x.front) x.front.destroy(); }); mEls = [];
    if (!S.rig) { H.innerHTML = ''; return; }
    const ms = metersOf();
    if (S.mview === 'front' && frontOk()) {
      H.classList.add('ger'); H.innerHTML = ms.map((m, i) => `<div class="ger-slot" data-i="${i}"></div>`).join('');
      mEls = $$('.ger-slot', H).map((el, i) => { const st = meterState(ms[i], NaN); return { el, m: ms[i], st, front: root.GERAETE.renderMultimeter(el, st, { compact: 'auto' }) }; });
      return;
    }
    H.classList.remove('ger');
    H.innerHTML = ms.map((m, i) => {
      const gauge = !S.digital && !m.texts && fin(+m.min) && fin(+m.max) && m.max > m.min, tt = m.help ? ` title="${esc(m.help)}"` : '';
      return gauge ? `<div class="mt" data-i="${i}" aria-label="${esc(m.label)}"${tt}><canvas></canvas><div class="lbl">${esc(m.label)}</div></div>` : `<div class="mt dg" data-i="${i}"${tt}><div class="lbl">${esc(m.label)}</div><div class="num"><span class="v">–</span><small>${esc(m.unit || '')}</small></div></div>`;
    }).join('');
    mEls = $$('.mt', H).map((el, i) => ({ el, m: ms[i], cv: $('canvas', el), v: $('.v', el), disp: null, drawn: null, txt: '', warn: false, inf: false }));
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
    g.fillStyle = wl ? K.badfg : K.fg; g.font = '700 ' + Math.max(11, Math.min(15, Math.round(w * 0.1))) + 'px system-ui'; g.fillText((x.inf ? '∞' : fnum(val, m.digits == null ? 1 : m.digits)) + (m.unit ? ' ' + m.unit : ''), cx, Math.min(h - 4, cy + r + (w >= 110 ? 15 : 13)));
  }
  function updateMeters(dt, force) {
    if (!S.rig || !mEls.length) return;
    let vals; try { vals = S.rig.readMeters() || {}; } catch (e) { return; }
    const k = Math.min(1, dt / 90);
    mEls.forEach(x => {
      const t = vals[x.m.key]; if (!fin(t)) return;
      if (x.front) { const st = x.st; st.value = t; st.inf = isInf(x.m, t); st.text = x.m.texts && x.m.texts[Math.round(t)] != null ? String(x.m.texts[Math.round(t)]) : null; x.front.update(st); return; }
      const inf = isInf(x.m, t);
      if (x.cv) {
        const tg = inf ? +x.m.max : t;
        if (x.disp == null || force) x.disp = tg; else x.disp += (tg - x.disp) * k;
        const rg = (x.m.max - x.m.min) || 1;
        if (force || x.drawn == null || x.inf !== inf || Math.abs(x.disp - x.drawn) > rg * 0.0015 || Math.abs(tg - x.disp) > rg * 0.0015) { x.drawn = x.disp; x.inf = inf; drawGauge(x, x.disp); }
      } else { const txt = meterText(x.m, t); if (txt !== x.txt) { x.txt = txt; x.v.textContent = txt; } }
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
  function worldSz() { try { let w = S.rig && S.rig.worldSize; if (typeof w === 'function') w = w.call(S.rig); if (w && w.w > 0 && w.h > 0) return w; } catch (e) {} return { w: 960, h: 600 }; }
  function fitCanvas() {
    const ws = worldSz(), narrow = (cvw.parentElement ? cvw.parentElement.clientWidth : 1000) < 600, ar = narrow ? NARROW_AR : ws.w + '/' + ws.h; if (cvw.style.aspectRatio !== ar) cvw.style.aspectRatio = ar;
    const w = cvw.clientWidth, h = cvw.clientHeight; if (!w || !h) return;
    dpr = Math.min(2, root.devicePixelRatio || 1); const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; }
    if (cvfx.width !== W || cvfx.height !== H) { cvfx.width = W; cvfx.height = H; }
    cw = w; ch = h;
  }
  if (root.ResizeObserver) new ResizeObserver(() => fitCanvas()).observe(cvw);
  root.addEventListener('resize', () => { fitCanvas(); redrawTab(); updateMeters(0, true); updateDeep(true); });
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
  function setQMode(m) { if (!['auto', ...QLEVELS].includes(m)) return; S.q.mode = m; lsPut('ana.q', m); S.q.ms = []; S.q.fastSince = 0; updateQLine(true); }
  let qSig = '';
  function updateQLine(force) {
    const el = $('#qLine'); if (!el) return;
    const hints = seenGet('hint', []), hid = Array.isArray(hints) && hints.includes(S.rigId);
    const sig = [curQ(), S.q.mode, reduced(), hid, S.rigId].join('|'); if (!force && sig === qSig) return; qSig = sig;
    el.innerHTML = `<span class="qv">Qualität: <b>${esc(curQ())}</b>${S.q.mode === 'auto' && !reduced() ? ' (automatisch)' : reduced() ? ' (Bewegung reduziert)' : ''}</span><button class="chip s" data-qc="1" aria-label="Qualitätsstufe wechseln" title="Qualität: automatisch, hoch, mittel, niedrig">⚙ ${esc(S.q.mode === 'auto' ? 'Auto' : S.q.mode)}</button>${hid ? '' : `<span class="qh" id="qHint">Übungsschaltung: Bauteilwerte sind Übungswerte. <button class="chip s" data-qh="1" aria-label="Hinweis schließen">✕</button></span>`}`;
  }
  $('#qLine').addEventListener('click', e => {
    if (e.target.closest('[data-qc]')) { const o = ['auto', ...QLEVELS], i = o.indexOf(S.q.mode); setQMode(o[(i + 1) % o.length]); toast('Qualität: ' + (S.q.mode === 'auto' ? 'automatisch' : S.q.mode)); }
    else if (e.target.closest('[data-qh]')) { const a = seenGet('hint', []), s = new Set(Array.isArray(a) ? a : []); s.add(S.rigId); seenSet('hint', [...s]); updateQLine(true); }
  });
  try { if (mqReduce.addEventListener) mqReduce.addEventListener('change', () => { updateQLine(true); updateChrome(); }); } catch (e) {}

  /* ---- Zeichnen: Vorher | Nachher | Wischer (SPEC 6.1, 8.2) ---- */
  function drawOpts() {
    const o = { quality: curQ(), reduced: reduced(), theme: theme(), header: false, ghost: null, wipe: null };
    if (S.ref && S.rig) { if (S.refMode === 'wischer') { o.ghost = S.ref; o.wipe = S.wipe; } else if (S.refMode === 'nachher' && S.ghost) o.ghost = S.ref; }
    return o;
  }
  function drawRig(ts) {
    if (!cw || cvw.offsetParent === null) return;
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.fillStyle = bgOf(); g2.fillRect(0, 0, cw, ch);
    if (!S.rig) { g2.fillStyle = '#8d99a6'; g2.font = '600 16px system-ui'; g2.textAlign = 'center'; g2.fillText('Prüfstand noch nicht geladen', cw / 2, ch / 2); return; }
    const r = S.ref && S.refRig && S.refMode === 'vorher' ? S.refRig : S.rig;
    try { r.draw(g2, cw, ch, ts, r === S.rig ? drawOpts() : { quality: curQ(), reduced: reduced(), theme: theme(), header: false }); }
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
  const FXKINDS = { buzz: 1, click: 1, ding: 1, tick: 1, alarm: 1 };
  let fxCool = {}, fxBudgetT = 0;
  function fxReset() { fxCool = {}; fxDrew = false; if (S.fx) S.fx = { amp: null, kazoo: false, flags: {} }; if (root.LochFX && root.LochFX.clear) try { root.LochFX.clear(); } catch (e) {} }
  const fxOn = () => !!(root.LochFX && !root.LochFX.isMuted());
  const slowFx = () => S.speed < 0.5;
  function fxPlay(kind, vol, once) {
    const F = root.LochFX; if (!F || !fxOn() || !canSound()) return; if (slowFx() && kind !== 'ding') return;
    const ts = performance.now(), cd = once ? 1e9 : 900; if (ts - (fxCool[kind] || -1e9) < cd) return; fxCool[kind] = ts;
    try { F.sound(kind, vol == null ? 0.4 : vol); } catch (e) {}
  }
  /* Die Prüfstände melden Texte (kind info, warn, error); der Effekt entsteht nur hier: Sättigung, Begrenzen, Überlast, Spannungsspitze -> buzz, Kippen -> kurzer Klick */
  function eventFx(e) {
    if (e && FXKINDS[e.fx]) return e.fx; const tx = String((e && e.text) || '');
    if (e && e.kind === 'error') return 'buzz';
    if (/Sättigung|begrenz|Überlast|überlast|Spannungsspitze|Übersteuer|übersteuer|zerstör|Gefahr/.test(tx) && e && e.kind !== 'info') return 'buzz';
    if (/kippt|Kippen|schaltet um/.test(tx)) return 'click';
    return null;
  }
  function fxEvent(kind, ts) {
    const F = root.LochFX; if (!F || !FXKINDS[kind] || !canSound()) return;
    const cd = (kind === 'tick' || kind === 'click' ? 400 : 1500); if (ts - (fxCool['e' + kind] || -1e9) < cd) return; fxCool['e' + kind] = ts;
    try { F.sound(kind === 'alarm' ? 'alarm' : kind, kind === 'buzz' ? 0.35 : kind === 'ding' ? 0.5 : 0.25); } catch (er) {}
  }
  function noteFault(e) {
    const key = S.rigId + ':' + String(e.text || '').slice(0, 28);
    const s = new Set(seenGet('faults', [])); if (s.has(key)) return;
    s.add(key); seenSet('faults', [...s].slice(-200)); stat('anafaults', s.size, 'max');
  }
  /* Ampelwechsel: grün (nach nicht grün) -> ding; rot -> leiser Brummer; je Wechsel einmal, nichts blinkt */
  function fxAmpel(a) {
    if (!a || !S.fx) return; const k = ampKey(a.ampel), p = S.fx.amp; S.fx.amp = k; if (p == null || p === k) return;
    if (k === 'gruen' && p !== 'grau') fxPlay('ding', 0.5); else if (k === 'rot') fxPlay('buzz', 0.2);
  }
  /* neue Meldungen beobachten: Liste, Abzeichenstatistik, Effekte */
  function watchEvents(ts) {
    const r = S.rig; if (!r) return; const ev = r.events || []; let changed = false;
    for (let i = Math.max(0, ev.length - 30); i < ev.length; i++) {
      const e = ev[i]; if (!e || S.evSeen.has(e)) continue; S.evSeen.add(e); changed = true;
      if (e.kind === 'error') noteFault(e);
      if (e.kind === 'error' && !verdecktNow()) { S.faultUntil = performance.now() + 9000; S.faultText = String(e.text || ''); if (S.tab !== 'rig' && S.running) toast('⚠ ' + S.faultText); }
      const fk = eventFx(e); if (fk && fxOn() && !slowFx() && (S.speed <= 2 || ts - fxBudgetT > 700)) { fxBudgetT = ts; fxEvent(fk, ts); }
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
    const F = root.LochFX; if (!F) { toast('Effekte sind auf dieser Seite nicht geladen.'); return; } F.setMuted(fxOn()); lsPut('ana.fx', fxOn() ? '1' : '0'); palSig = ''; updateChrome(); toast(fxOn() ? 'Effekte und Ton an' : 'Ton aus');
    if (fxOn()) F.sound('ding', 0.5);
  }

  /* ---- Meldungsliste (Zeitstempel in Anlagenzeit) und Hinweise aus rig.diagnose() ---- */
  const tstamp = t => (fin(+t) ? fnum(+t, 1) + ' s' : '');
  function updateEvents(force) {
    const l = $('#evList'); if (!l) return; const ev = ((S.rig && S.rig.events) || []).filter(x => !(verdecktNow() && x && x.verraet));
    const sig = ev.length + '|' + (ev.length ? (ev[ev.length - 1].text || '') + (ev[ev.length - 1].t || '') : ''); if (!force && sig === S.evSig) return; S.evSig = sig;
    l.innerHTML = ev.length ? ev.slice(-40).reverse().map(x => `<li class="${esc(x.kind || 'info')}"><time>${esc(tstamp(x.t))}</time><span>${esc(x.text)}</span></li>`).join('') : '<li class="empty">Keine Meldungen. Meldet der Prüfstand etwas (zum Beispiel eine Auslösung), steht es hier.</li>';
  }
  $('#evClr').onclick = () => { if (S.rig && S.rig.events) { S.rig.events.length = 0; S.evSig = ''; updateEvents(true); } };
  let lastDiag = 0;
  function updateDiag(force) {
    const el = $('#diagList'); if (!el || !S.rig) return;
    const now = performance.now(); if (!force && now - lastDiag < 400) return; lastDiag = now;
    let d = []; try { d = typeof S.rig.diagnose === 'function' ? (S.rig.diagnose({ verdeckt: verdecktNow() }) || []).filter(x => !(verdecktNow() && x && x.verraet)) : []; } catch (e) { d = []; }
    S.diag = d; d.forEach(x => { if (x && x.id && !S.diagSeen[x.id]) S.diagSeen[x.id] = 1; });
    const h = d.length ? d.map(x => `<li class="${esc(x.kind || 'info')}"><span class="dk" aria-hidden="true">${x.kind === 'error' ? '✗' : x.kind === 'warn' ? '!' : 'i'}</span><span>${esc(x.text)}</span></li>`).join('') : '<li class="empty">Keine Hinweise: Zu den aktuellen Einstellungen meldet die Anlage nichts.</li>';
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  }

  /* ============================================================ Simulation (Animationsphase, Partikel, Impulsfolge; Ablauf live) */
  function setRun(on, auto) {
    if (on && !S.rig) { toast('Der Prüfstand ist noch nicht geladen.'); return; }
    S.running = !!on; updateChrome();
    if (on) { stat('anarun', 1, 'max'); usedRig(); if (auto && !seenGet('a', 0)) { seenSet('a', 1); toast('Die Animation läuft jetzt. Mit ⏸ unten hältst du sie an.'); } }
  }
  /* Reset stellt bei einer Fehlersuche den Aufgabenzustand wieder her (Fehler, Sperren, Verdecken), sonst hätte der Azubi den Fehler "weggesetzt" */
  function restoreFaultCtl() {
    const f = S.faultStart; if (!f || !S.rig) return;
    try {
      if (typeof S.rig.setLock === 'function') S.rig.setLock([]);
      Object.keys(f.controls || {}).forEach(k => { try { S.rig.setControl(k, f.controls[k]); } catch (e) { /* weiter */ } });
      if (typeof S.rig.setLock === 'function') S.rig.setLock(S.lock);
      if (typeof S.rig.setHidden === 'function') S.rig.setHidden(S.hidden);
    } catch (e) { console.error(e); }
  }
  function resetRig(quiet) {
    if (!S.rig) return;
    try { S.rig.reset(); } catch (e) { console.error(e); }
    applySpeed(); if (S.faultStart) restoreFaultCtl();
    const keepRef = S.ref; resetRun(); S.ctl = {}; S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; fxReset(); S.ref = keepRef; buildRefRig();
    readState(); syncCtl(true); updateMeters(0, true); updateEvents(true); updateDiag(true); updateAmp(true); updateChrome(); renderSweepLive(); extRefresh(); if (!quiet) toast('Prüfstand zurückgesetzt');
  }
  function setSpeed(v) { if (!SPEEDS.includes(v)) return; S.speed = v; lsPut('ana.speed', String(v)); applySpeed(); applySpeed(S.refRig); palSig = ''; updateChrome(); }
  /* geplanten Ablauf im Prüfstand ausführen (Zeit in Sekunden Demo-Zeit): Setzen, Rampen, Auslösen */
  function liveApply() {
    const L = S.live; if (!L) return;
    while (L.i < L.steps.length && L.steps[L.i].t <= L.t + 1e-9) {
      const st = L.steps[L.i++];
      if (st.set) Object.keys(st.set).forEach(k => setCtl(k, st.set[k], true));
      if (st.ramp) { let from = NaN; try { from = +S.rig.getControl(st.ramp.key); } catch (e) {} L.ramps.push({ key: st.ramp.key, from, to: +st.ramp.to, t0: st.t, d: Math.max(1e-9, +st.ramp.durS || 1e-9), log: (ctlDef(st.ramp.key) || {}).unitKind === 'freq' }); }
      if (st.fire) doFire();
      if (st.do != null) liveAct(st.do);
    }
    L.ramps = L.ramps.filter(r => {
      const f = clamp((L.t - r.t0) / r.d, 0, 1);
      if (fin(r.from)) { const v = r.log && r.from > 0 && r.to > 0 ? r.from * Math.pow(r.to / r.from, f) : r.from + (r.to - r.from) * f; setCtl(r.key, v, true); }
      return f < 1;
    });
  }
  /* Aktion { t, do: 'name' } eines Ablaufs: der Prüfstand bevorzugt rig.do, sonst rig.act oder rig.doStep (wie ANA_CORE.runSeq); Namen wie "fire" oder "start" lösen aus */
  function liveAct(name) {
    const r = S.rig; if (!r) return false;
    for (const fn of ['do', 'act', 'doStep']) if (typeof r[fn] === 'function') { try { return r[fn](name) !== false; } catch (e) { console.error(e); return false; } }
    return /^(fire|start|ausl)/i.test(String(name)) ? doFire() : false;
  }
  function simAdvance(dtMs) {
    const r = S.rig; if (!r) return; const own = typeof r.setSpeed === 'function', d = dtMs * S.speed;
    if (S.live) { S.live.t += d / 1000; liveApply(); if (S.live && S.live.t >= S.live.end) seqLiveDone(); }
    r.step(own ? dtMs : d);
    if (S.ref && S.refRig && S.refMode === 'vorher') { try { S.refRig.step(own ? dtMs : d); } catch (e) {} }
    S.simT += d / 1000;
  }
  function updateStat() {
    const sEl = $('#stat'); if (!sEl) return;
    const html = (S.running ? '<b class="run" style="color:var(--ok)">LÄUFT</b> ' : '<b>PAUSE</b> ') + 'Zeit ' + fnum(S.simT, 1) + ' s' + (S.st && fin(+S.st.zeitlupe) && +S.st.zeitlupe > 0 ? ' · Zeitlupe ×' + String(+(+S.st.zeitlupe).toFixed(1)).replace('.', ',') : S.speed !== 1 ? ' · ×' + String(S.speed).replace('.', ',') : '');
    if (sEl.dataset.h !== html) { sEl.dataset.h = html; sEl.innerHTML = html; }
  }
  /* Ergebnisse (Ampelwechsel, Statistik) regelmäßig aus dem Prüfstand lesen */
  function watchState() {
    const a = assessOf(S.rig); if (!a) return; fxAmpel(a);
    if (ampKey(a.ampel) === 'gruen') stat('anagruen', 1, 'max');
  }

  /* ============================================================ CSV (Kennlinie), PNG, Druck */
  function csvNum(v) { return fin(v) ? String(+(+v).toPrecision(9)).replace('.', ',') : ''; }
  /* Kennlinie (erste aus rig.curves()) als CSV: Kopf, dann x; y; Reihe */
  function csvText() {
    let cv = null; try { cv = S.rig && typeof S.rig.curves === 'function' ? (S.rig.curves() || [])[0] : null; } catch (e) { cv = null; }
    if (!cv) return '';
    const rows = []; (cv.series || []).forEach(s => (s.points || []).forEach(p => rows.push([csvNum(p[0]), csvNum(p[1]), String(s.name || '').replace(/;/g, ',')].join(';'))));
    return '# Tonfunk Analogtechnik-Lab;' + S.name + ';' + (cv.title || '') + ';Übungswerte\r\n' + (cv.xLabel || 'x') + (cv.xUnit ? ' in ' + cv.xUnit : '') + ';' + (cv.yLabel || 'y') + (cv.yUnit ? ' in ' + cv.yUnit : '') + ';Reihe\r\n' + rows.join('\r\n') + '\r\n';
  }
  function parseCsv(txt) {
    const out = []; String(txt || '').split(/\r?\n/).forEach(ln => {
      if (!ln || ln[0] === '#') return; const c = ln.split(';'), n = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return fin(x) ? x : null; };
      const x = n(c[0]), y = n(c[1]); if (x != null && y != null) out.push({ x, y, name: c[2] || '' });
    });
    return out;
  }
  function saveCsv(txt, fallbackName) {
    const blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' });
    if (root.LabExport && root.LabExport.saveBlob) { try { root.LabExport.saveBlob(blob, root.LabExport.fname ? root.LabExport.fname('csv') : fallbackName); return; } catch (e) {} }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fallbackName; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportCsv() { const t = csvText(); if (!t) { toast('Dieser Prüfstand hat keine Kennlinie zum Exportieren.'); return; } saveCsv(t, 'ana-kennlinie.csv'); stat('csv'); toast('CSV gespeichert'); }
  function rigPng(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = bgOf(); x.fillRect(0, 0, w, h); try { if (S.rig) S.rig.draw(x, w, h, 0, { quality: 'hoch', reduced: true, theme: theme(), header: false }); } catch (e) {} return c;
  }
  function exportPng() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    const c = rigPng(1600, 1000);
    c.toBlob(b => { if (b && root.LabExport) { root.LabExport.saveBlob(b, root.LabExport.fname('png')); stat('png'); } else toast('Bild konnte nicht erzeugt werden'); }, 'image/png');
  }
  function printNow() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    const c = rigPng(1200, 750), who = lsRaw('lm4.name', ''), vals = allCtl(); let mv = {}; try { mv = S.rig.readMeters(); } catch (e) {} const a = assessOf(S.rig) || {};
    const cv = ctlsOf().filter(x => x.type !== 'button').map(x => { if (isHid(x.key)) return `<tr><td>${esc(GRUPPEN[gruppeOf(x)].name)}</td><td>${esc(x.key === 'fehler' ? 'Fehler' : x.label)}</td><td>?</td></tr>`; const v = vals[x.key]; let t = v; if (x.type === 'switch') t = v ? 'EIN' : 'AUS'; else if (x.type === 'select') { const o = (x.options || []).find(q => q.value === v || String(q.value) === String(v)); t = o ? o.label : v; } else t = ctlShow(x, v); return `<tr><td>${esc(GRUPPEN[gruppeOf(x)].name)}</td><td>${esc(x.label)}</td><td>${esc(t)}</td></tr>`; }).join('');
    const mt = metersOf().map(m => `<tr><td>${esc(m.label)}</td><td>${esc(meterText(m, mv[m.key]))} ${esc(m.unit || '')}</td></tr>`).join('');
    const ev = ((S.rig.events) || []).filter(x => !(verdecktNow() && x && x.verraet)).slice(-15).map(e => `<tr><td>${esc(tstamp(e.t))}</td><td>${esc(e.text)}</td></tr>`).join('');
    const rows = curRows().map(r => `<tr><td>${fnum(r.t, 1)} s</td><td>${esc(rowText(r))}</td></tr>`).join('');
    $('#printArea').innerHTML = `<div class="proto"><h1>${esc(S.name)}</h1><p>Prüfstand: ${esc(rigName(S.rigId))} · ${new Date().toLocaleDateString('de-DE')}${who ? ' · ' + esc(who) : ''} · Übungsschaltung: Bauteilwerte sind Übungswerte, kein Nachweis</p><p>${esc(simText())}</p>
      <h2>Prüfstand</h2><img src="${c.toDataURL('image/png')}" alt="">
      <h2>Ampel</h2><p>${esc((AMP[ampKey(a.ampel)] || AMP.grau).sym + ' ' + (AMP[ampKey(a.ampel)] || AMP.grau).name)}${margTxt(a) ? ', ' + esc(margTxt(a)) : ''}. ${esc(a.text || '')} ${esc(ampelHinweis())}</p>
      <h2>Einstellungen</h2><table><tr><th>Gruppe</th><th>Steuerwert</th><th>Wert</th></tr>${cv}</table>
      <h2>Messwerte</h2><table><tr><th>Messgerät</th><th>Wert</th></tr>${mt}</table>
      ${rows ? `<h2>Ablauf</h2><table><tr><th>Zeit</th><th>Aktion</th></tr>${rows}</table>` : ''}
      ${ev ? `<h2>Meldungen</h2><table><tr><th>Zeit</th><th>Meldung</th></tr>${ev}</table>` : ''}</div>`;
    setTimeout(() => window.print(), 80);
  }

  /* ============================================================ Sweep und Ablauf (eingeklappte Zeile im Tab Prüfstand, Läufer ANA_CORE.runSeq) */
  const rowEnd = r => (+r.t || 0) + (r.kind === 'ramp' ? (+r.dur || 0) : 0);
  const seqDur = () => { const d = S.seqDur && S.seqDur[S.rigId]; if (fin(d) && d > 0) return d; const rs = curRows(); return Math.max(10, rs.reduce((m, r) => Math.max(m, rowEnd(r)), 0) * 1.25); };
  const defVal = c => (c.type === 'switch' || c.type === 'button' ? !!c.value : c.type === 'select' ? (c.value !== undefined ? c.value : (c.options && c.options[0] ? c.options[0].value : '')) : (c.value != null ? c.value : c.min));
  const seqKeys = () => ctlsOf().filter(c => c.type !== 'button' && !isHid(c.key) && !isLocked(c.key));
  const canFire = () => !!(S.rig && typeof S.rig.fire === 'function');
  const optLabel = (c, v) => { const o = (c.options || []).find(q => q.value === v || String(q.value) === String(v)); return o ? o.label : String(v); };
  const valText = (c, v) => (!c ? String(v) : c.type === 'switch' ? (v ? 'EIN' : 'AUS') : c.type === 'select' ? optLabel(c, v) : ctlShow(c, +v));
  function rowText(r) {
    if (r.kind === 'fire') return 'löse aus: ' + (FIRELBL[S.rigId] || 'Auslösen');
    if (r.kind === 'do') return 'führe aus: ' + r.key;
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
      if (r.kind === 'do') { if (r.key) other.push({ t, do: String(r.key) }); return; }
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
      if (s.do != null) rows.push({ t: +s.t || 0, kind: 'do', key: String(s.do) });
      if (s.ramp && typeof s.ramp === 'object' && s.ramp.key != null) rows.push({ t: +s.t || 0, kind: 'ramp', key: s.ramp.key, to: +s.ramp.to, dur: +s.ramp.durS || 0 });
      if (s.set && typeof s.set === 'object') Object.keys(s.set).forEach(k => rows.push({ t: +s.t || 0, kind: 'set', key: k, value: s.set[k] }));
      else if (s.key != null) rows.push({ t: +s.t || 0, kind: 'set', key: s.key, value: s.value });
    });
    return rows;
  }
  const rowNorm = rows => (rows || []).filter(r => r && typeof r === 'object').map(r => (r.kind === 'fire' ? { t: +r.t || 0, kind: 'fire' } : r.kind === 'do' ? { t: +r.t || 0, kind: 'do', key: String(r.key || '') } : r.kind === 'ramp' ? { t: +r.t || 0, kind: 'ramp', key: r.key, to: +r.to, dur: +r.dur || 0 } : { t: +r.t || 0, kind: 'set', key: r.key, value: r.value }));
  function valueEd(r, i) {
    const c = ctlDef(r.key); if (!c) return '<span class="hint2">Steuerwert unbekannt</span>';
    const v = r.kind === 'ramp' ? r.to : r.value;
    if (c.type === 'slider') return `<span class="vv"><input class="vIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${esc(ctlShow(c, +v))}" aria-label="Wert"></span>`;
    if (c.type === 'switch') return `<select class="vSel" data-i="${i}" aria-label="Wert"><option value="1"${r.value ? ' selected' : ''}>EIN</option><option value="0"${r.value ? '' : ' selected'}>AUS</option></select>`;
    const o = c.options || [], cur = o.findIndex(x => x.value === r.value || String(x.value) === String(r.value));
    return `<select class="vSel" data-i="${i}" aria-label="Wert">${o.map((x, j) => `<option value="${j}"${j === cur ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`;
  }
  function rowHtml(r, i, n) {
    const keys = seqKeys(), c = ctlDef(r.key), canRamp = c && c.type === 'slider', ramp = r.kind === 'ramp', fire = r.kind === 'fire', isDo = r.kind === 'do';
    const kinds = `<option value="set"${r.kind === 'set' ? ' selected' : ''}>setze</option>${canRamp || ramp ? `<option value="ramp"${ramp ? ' selected' : ''}>ändere bis</option>` : ''}${canFire() ? `<option value="fire"${fire ? ' selected' : ''}>löse aus</option>` : ''}${isDo ? '<option value="do" selected>führe aus</option>' : ''}`;
    return `<div class="sqr" data-i="${i}"><span class="n">${i + 1}</span><label class="tb"><small>nach</small><input class="tIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${fnum(r.t, adig(r.t))}" aria-label="Zeit in Sekunden"> <small>s</small></label>
      <select class="kdSel" data-i="${i}" aria-label="Art">${kinds}</select>
      ${fire ? `<span class="vb hint2">${esc(FIRELBL[S.rigId] || 'Auslösen')}</span>` : isDo ? `<span class="vb hint2">Aktion: ${esc(r.key)}</span>` : `<select class="kSel" data-i="${i}" aria-label="Steuerwert">${keys.map(k => `<option value="${esc(k.key)}"${k.key === r.key ? ' selected' : ''}>${esc(k.label)}</option>`).join('')}</select><span class="vb">${valueEd(r, i)}</span>`}${ramp ? `<label class="tb"><small>in</small><input class="dIn" data-i="${i}" inputmode="decimal" autocomplete="off" value="${fnum(r.dur, adig(r.dur || 1))}" aria-label="Dauer der Änderung in Sekunden"> <small>s</small></label>` : ''}
      <span class="ac"><button class="ib2" data-a="up" data-i="${i}" aria-label="Nach oben"${i === 0 ? ' disabled' : ''}>↑</button><button class="ib2" data-a="dn" data-i="${i}" aria-label="Nach unten"${i === n - 1 ? ' disabled' : ''}>↓</button><button class="ib2" data-a="del" data-i="${i}" aria-label="Löschen">🗑</button></span></div>`;
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
  function seqRunBg() {
    if (!S.rig) return; const steps = seqSteps(curRows()), end = seqDur(), id = S.rigId, d = defOf(id), C = CORE();
    if (!steps.length) { toast('Der Ablauf ist leer.'); return; }
    if (verdecktNow()) { toast('Während der Fehlersuche ist die Berechnung gesperrt, sie würde den Fehler verraten. „Live im Prüfstand“ geht weiter.'); return; } if (!C || typeof C.runSeq !== 'function') { toast('Der Läufer ist nicht geladen (anacore-res.js fehlt).'); return; }
    toast('Berechne den Ablauf …');
    setTimeout(() => {
      const o = { seed: 1, sampleS: Math.max(0.05, end / 200) }; if (S.seqCur !== false) o.controls = allCtl();
      let res = null; try { res = C.runSeq(() => d.create({ seed: 1 }), steps, end, o); } catch (e) { console.error('runSeq:', e); res = null; }
      const fin2 = r => {
        if (!r || !Array.isArray(r.samples) || !r.samples.length) { toast('Der Ablauf konnte nicht berechnet werden.'); return; }
        S.seqRes = { samples: r.samples, final: r.final || {}, events: r.events || [], faults: r.faults || [], errors: r.errors || [], rejected: r.rejected || [], assess: r.assess || null, end, rigId: id, steps };
        stat('anaseq', 1, 'max'); renderSeqRes(); const el = $('#sqRes'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  function seqLiveDone() { S.live = null; stat('anaseq', 1, 'max'); toast('Ablauf beendet'); renderSweepLive(); }
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
      const st = s.state || {}, k = ampKey(st.ampel || (s.assess && s.assess.ampel)), last = out[out.length - 1];
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
      <ul class="tl">${band.map(b => `<li class="${AMP[b.k].cls === 'ok' ? 'ok' : AMP[b.k].cls === 'bad' ? 'bad' : ''}">${AMP[b.k].sym} ${fnum(b.t0, 1)} s bis ${fnum(b.t1, 1)} s: ${esc(AMP[b.k].name)}${fin(b.m) ? ', kleinste Marge ' + fnum(b.m, 2) : ''}</li>`).join('')}</ul>
      ${a ? `<p style="margin:6px 0 0"><b>Am Ende:</b> ${esc((AMP[ampKey(a.ampel)] || AMP.grau).sym)} ${esc((AMP[ampKey(a.ampel)] || AMP.grau).name)}${margTxt(a) ? ', ' + esc(margTxt(a)) : ''}. ${esc(a.text || '')}</p>` : ''}
      <table class="kt"><tr><th>Messgerät am Ende</th><th class="n">Wert</th></tr>${metersOf().map(m => `<tr><td>${esc(m.label)}</td><td class="n"><b>${esc(meterText(m, fm[m.key]))}</b> ${esc(m.unit || '')}</td></tr>`).join('')}</table>
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
        else if (k === 'bg') seqRunBg(); else if (k === 'live') seqLive(); else if (k === 'stop') seqStop();
      } else if (a) {
        const i = +a.dataset.i;
        if (a.dataset.a === 'del') rs.splice(i, 1); else if (a.dataset.a === 'up' && i > 0) [rs[i - 1], rs[i]] = [rs[i], rs[i - 1]]; else if (a.dataset.a === 'dn' && i < rs.length - 1) [rs[i + 1], rs[i]] = [rs[i], rs[i + 1]];
        S.dirty = true; renderSweep(); saveCurSoon();
      }
    });
    V.addEventListener('change', e => {
      const t = e.target, rs = curRows(), i = +t.dataset.i;
      if (t.id === 'sqCur') { S.seqCur = t.checked; return; }
      if (t.id === 'sqDur') { const v = parseNum(t.value); S.seqDur[S.rigId] = fin(v) && v > 0 ? Math.min(3600, v) : null; t.value = fnum(seqDur(), adig(seqDur())); S.dirty = true; return; }
      if (!rs[i]) return; const r = rs[i];
      if (t.classList.contains('tIn')) { const v = parseNum(t.value); r.t = fin(v) && v >= 0 ? +v.toPrecision(8) : r.t; t.value = fnum(r.t, adig(r.t)); }
      else if (t.classList.contains('dIn')) { const v = parseNum(t.value); r.dur = fin(v) && v >= 0 ? +v.toPrecision(8) : r.dur; t.value = fnum(r.dur, adig(r.dur || 1)); }
      else if (t.classList.contains('kdSel')) {
        if (t.value === 'do') return;
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
  /* ============================================================ Beispiele (ANA_DATA.examples, eingebauter Rückfall ohne Zahlen im Text) */
  const B = (id, name, cat, rig, desc, controls, extra) => Object.assign({ id, name, cat, rig, desc, controls }, extra || {});
  const BUILTIN = [
    B('bx-diode', 'LED mit Vorwiderstand', 'Diode', 'diode', 'Verändere den Vorwiderstand und beobachte Arbeitspunkt und Strom auf der Kennlinie.', {}, {}),
    B('bx-schalter', 'Transistor als Schalter', 'Schalter', 'schalter', 'Verändere den Basisvorwiderstand und beobachte, wann der Transistor durchsteuert.', {}, {}),
    B('bx-emitter', 'Emitterschaltung: Arbeitspunkt', 'Emitterschaltung', 'emitter', 'Verändere den Basisspannungsteiler und beobachte den Arbeitspunkt.', {}, {}),
    B('bx-opv', 'Invertierender Verstärker', 'Operationsverstärker', 'opv_inv', 'Verändere R_f und R_1 und beobachte die Spannungsverstärkung.', {}, {})
  ];
  function exampleList() {
    const d = root.ANA_DATA; let a = d && d.examples;
    if (a && !Array.isArray(a)) a = Object.keys(a).map(k => Object.assign({ id: k }, a[k]));
    if (!a || !a.length) a = BUILTIN;
    return a.map(e => ({ id: e.id, name: e.name, cat: e.cat || 'Beispiele', desc: e.desc || e.text || '', rig: e.rig, controls: e.controls || {}, dur: e.dur, ref: e.ref || null, rows: e.rows ? rowNorm(e.rows) : (e.seq ? seqToRows(e.seq) : null), seq: e.seq }));
  }
  /* Vorher-Zustand eines Beispiels: Steuerwerte des Beispiels, darüber die Werte aus ref (oder ein fertiger Schnappschuss) */
  const ctlOfRig = (r, k) => { const c = (r.controls || []).find(x => x && x.key === k); return c && c.type === 'select' ? Object.assign({}, c, { options: optNorm(c.options) }) : c; };
  function refFromExample(e) {
    const rf = e.ref; if (!rf || typeof rf !== 'object') return null; if (rf.ctl && typeof rf.ctl === 'object') return clone(rf);
    const d = defOf(e.rig); if (!d) return null;
    try { const r = d.create({ seed: 1 }); Object.keys(e.controls || {}).forEach(k => { const v = coerce(ctlOfRig(r, k), e.controls[k]); if (v !== undefined) r.setControl(k, v); }); Object.keys(rf).forEach(k => { const v = coerce(ctlOfRig(r, k), rf[k]); if (v !== undefined) r.setControl(k, v); }); return clone(r.snapshot()); } catch (er) { return null; }
  }
  function loadExample(e) {
    if (typeof e === 'string') { const n = e.toLowerCase(); e = exampleList().find(x => x.id === e || x.name.toLowerCase().includes(n)); }
    if (!e) return false; const had = stash(); S.task = null; taskRes = null;
    setRig(e.rig && ORDER.includes(e.rig) ? e.rig : S.rigId || ORDER[0]);
    applyCtl(e.controls); S.rows[S.rigId] = e.rows ? clone(e.rows) : e.seq ? seqToRows(e.seq) : []; S.seqDur[S.rigId] = e.dur && e.dur > 0 ? e.dur : null; S.seqRes = null;
    const rs = refFromExample(e); if (rs) { S.ref = rs; S.refMode = 'nachher'; buildRefRig(); buildBA(); updateAmp(true); }
    S.name = e.name; S.id = null; S.dirty = false; setTab('rig'); updateChrome(); saveCurSoon(); renderSweep();
    toast(had ? 'Beispiel geladen, dein Versuch ist gesichert' : 'Beispiel geladen: ' + e.name);
    /* Beispiele mit Ablauf (seq: set, ramp, fire, do) spielen den Ablauf gleich live ab, wie der Knopf Live im Ablauf-Editor */
    if (e.seq && e.seq.length && curRows().length) { try { seqLive(); } catch (er) { console.error(er); } }
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
  const PK = 'ana.saves';
  const saves = () => { const a = lsGet(PK, []); return Array.isArray(a) ? a : []; };
  function saveItem(name) {
    const a = saves(), id = S.id || uid(); S.id = id; S.name = name || S.name;
    const e = { id, name: S.name, t: Date.now(), rig: S.rigId, ctl: allCtl(), ref: S.ref ? clone(S.ref) : null, refMode: S.refMode, rows: clone(curRows()), dur: seqDur(), bericht: S.bericht ? clone(S.bericht) : null };
    const i = a.findIndex(x => x.id === id); if (i >= 0) a[i] = e; else a.push(e);
    lsSet(PK, a.slice(-100)); S.dirty = false; updateChrome(); saveCur();
  }
  function stash() { if (!S.dirty || !S.rig || S.readonly) return false; if (S.task || verdecktNow()) return false; saveItem(S.name || 'Versuch'); S.id = null; return true; }
  async function doSave() { if (verdecktNow()) { toast('Während der Fehlersuche kannst du nicht speichern: Der Fehler soll verdeckt bleiben.'); return; }
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
    setRig(rid, { keepRef: false }); applyCtl(it.ctl && typeof it.ctl === 'object' ? it.ctl : {}); S.bericht = it.bericht && typeof it.bericht === 'object' ? clone(it.bericht) : null;
    if (it.ref && typeof it.ref === 'object' && it.ref.ctl && typeof it.ref.ctl === 'object') { S.ref = clone(it.ref); S.refMode = ['vorher', 'nachher', 'wischer'].includes(it.refMode) ? it.refMode : 'nachher'; buildRefRig(); buildBA(); updateAmp(true); }
    S.rows[S.rigId] = Array.isArray(it.rows) ? rowNorm(it.rows.filter(r => r && typeof r === 'object' && (r.kind === 'fire' || typeof r.key === 'string'))) : []; S.seqDur[S.rigId] = fin(it.dur) && it.dur > 0 ? it.dur : null; S.seqRes = null;
    S.name = (it.name || 'Versuch') + (suffix || ''); S.dirty = false; updateChrome(); saveCurSoon();
    setTab('rig'); renderSweep();
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
  const shareObj = () => ({ k: 'ana', name: S.name, rig: S.rigId, ctl: allCtl(), ref: S.ref ? clone(S.ref) : null, refMode: S.refMode, rows: clone(curRows()), dur: seqDur(), bericht: S.bericht ? clone(S.bericht) : null });
  async function shareNow() { if (verdecktNow()) { toast('Während der Fehlersuche kannst du nicht teilen: Der Fehler soll verdeckt bleiben.'); return; }
    if (!S.rig) { toast('Es gibt noch nichts zu teilen: der Prüfstand fehlt.'); return; }
    let url; try { url = location.href.split('#')[0].split('?')[0] + '#' + await packShare(shareObj()); } catch (e) { toast('Teilen nicht möglich'); return; }
    if (navigator.share) { try { await navigator.share({ title: 'Tonfunk Analogtechnik-Lab: ' + S.name, text: 'Schau dir meinen Versuch „' + S.name + '“ an:', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    sheet('Teilen', b => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">Diesen Link weitergeben (zum Beispiel per WhatsApp oder E-Mail). Wer ihn öffnet, bekommt eine Kopie deines Versuchs mit Prüfstand, Einstellungen, Vorher-Zustand, Ablauf und Messreihe.</p><textarea id="shTx" rows="5" readonly></textarea><div class="btns"><button class="btn pri" id="shCp">Link kopieren</button></div>';
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

  /* ============================================================ Aufgaben (ANA_TASKS) */
  const TK = () => (root.ANA_TASKS && Array.isArray(root.ANA_TASKS.tasks) && root.ANA_TASKS.tasks.length ? root.ANA_TASKS.tasks : null);
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
  function helpRefresh() { const E = extOf('help'); if (E && typeof E.refresh === 'function') { try { E.refresh(); } catch (e) { /* kein Absturz */ } } }
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
    S.rows[S.rigId] = o.rows ? rowNorm(o.rows) : seqToRows(o.seq); S.seqDur[S.rigId] = o.dur && o.dur > 0 ? o.dur : null; S.seqRes = null; S.taskStart = o; S.clicks = []; S.bericht = o.bericht && typeof o.bericht === 'object' ? clone(o.bericht) : null;
    if (o.ref && typeof o.ref === 'object') { const rs = o.ref.ctl ? clone(o.ref) : refFromExample({ rig: S.rigId, controls: o.controls || {}, ref: o.ref }); if (rs) { S.ref = rs; S.refMode = 'nachher'; buildRefRig(); buildBA(); updateAmp(true); } }
    /* Fehlersuche: start() liefert lock:[keys] und hidden:[keys]; erst die Werte setzen (auch den Fehler), dann sperren und verdecken */
    if ((Array.isArray(o.lock) && o.lock.length) || (Array.isArray(o.hidden) && o.hidden.length)) { applyLockHidden(o.lock, o.hidden); S.faultStart = { controls: clone(allCtl()) }; }
  }
  /* Antwort-Auswahl: die Wahl des Azubi; die abgegebene Diagnose (Fehlersuche) steht zusätzlich unter fehler und ursache, wenn die Aufgabe diese Fragen nicht selbst stellt */
  const choicesOut = a => { const c = Object.assign({}, (a && a.c) || {}); if (S.diagnose) { if (c.fehler === undefined) c.fehler = S.diagnose.id; if (c.ursache === undefined) c.ursache = S.diagnose.id; } return c; };
  const fieldsOf = t => { let f = t.fields; if (typeof f === 'function') { try { f = f(S.taskStart); } catch (e) { f = []; } } return Array.isArray(f) ? f : []; };
  const choicesOf = t => { let f = t.choices; if (typeof f === 'function') { try { f = f(S.taskStart); } catch (e) { f = []; } } return Array.isArray(f) ? f : []; };
  async function startTask(id) {
    const t = (TK() || []).find(x => x.id === id); if (!t) return;
    const had = stash(); taskRes = null;
    if (root.Auswertung) root.Auswertung.hintReset(id);
    let o; try { o = typeof t.start === 'function' ? t.start() : {}; } catch (e) { console.error(e); toast('Die Startvorlage der Aufgabe fehlt'); return; }
    S.task = null; applyTaskState(t, o); S.task = { id }; helpRefresh(); S.name = t.title; S.id = null; S.dirty = false; delete taskAns[id];
    setTab('tasks'); updateChrome();
    toast(had ? 'Aufgabe gestartet, dein Versuch ist gesichert' : 'Aufgabe gestartet'); renderTasksIfOpen();
  }
  const renderTasksIfOpen = () => { if (S.tab === 'tasks') renderTasks(); };
  /* Abgabe: { rig, controls, ref, value, text, fields, choices, clicks, ... } (SPEC 8.5) */
  function collectAnswer(t) {
    let st = null; try { st = S.rig ? clone(S.rig.state()) : null; } catch (e) {}
    const a = taskAns[t.id] || {}, v = a.v != null && a.v !== '' ? parseNum(a.v) : NaN, fl = fieldsOf(t), fo = {};
    fl.forEach(f => { const raw = a.f && a.f[f.key], x = raw != null && raw !== '' ? parseNum(raw) : NaN; fo[f.key] = fin(x) ? x : null; });
    const first = fl.length ? fo[fl[0].key] : null;
    return { rig: S.rigId, controls: allCtl(), ref: S.ref ? clone(S.ref) : null, seq: seqSteps(curRows()), rows: clone(curRows()), dur: seqDur(), state: st, simTime: S.simT, fired: !!S.fired, value: fin(v) ? v : (fin(first) ? first : null), text: a.v == null ? '' : String(a.v), fields: fo, choices: choicesOut(a), diagnose: S.diagnose ? S.diagnose.id : null, clicks: clone(S.clicks || []), bericht: S.bericht ? clone(S.bericht) : null };
  }
  async function checkTask() {
    const t = curTask(); if (!t) return; const R = root.ANA_TASKS;
    S.readonly = true; updateChrome(); updateTaskBar();
    const ans = collectAnswer(t); let lines;
    try { lines = await (R.run ? R.run(t, ans) : t.check(ans)); } catch (e) { console.error(e); lines = [{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden: ' + (e && e.message || e), why: '' }]; }
    S.readonly = false; lines = Array.isArray(lines) ? lines : [];
    const pct = Math.round(100 * lines.filter(l => l.ok).length / Math.max(lines.length, 1));
    taskRes = { id: t.id, lines, pct }; markDone(t.id, pct); updateTaskBadge(); if (pct === 100 && S.hidden.length) applyLockHidden(S.lock, []);
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
    setTab('rig'); if (has) seqLive(); else { setRun(true); if (canFire() && o && o.fire !== false && o.fired) doFire(); }
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
      rows = Array.isArray(rows) ? rows : []; return `<div class="ana-tbl"><table>${t1.caption || t1.title ? `<caption>${esc(t1.caption || t1.title)}</caption>` : ''}${Array.isArray(head) ? `<thead><tr>${head.map(h => `<th>${cell(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map(r => `<tr>${(Array.isArray(r) ? r : [r]).map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    };
    return list.map(one).join('');
  }
  function renderTasks() {
    const V = $('#taskView'), A = TK();
    if (!A) { V.innerHTML = '<div class="card pl"><h4>Aufgaben</h4><p class="big">Aufgaben folgen</p><p class="hint2">Hier erscheinen Aufgaben mit automatischer Prüfung: Diode und LED, Transistor als Schalter, Emitterschaltung, Kollektorschaltung, Operationsverstärker, Komparator, Integrierer, Fehlersuche und prüfungsnahe Aufgaben. Bis dahin kannst du mit den Beispielen, dem Rechner und dem Tab „Lernen“ üben.</p><div class="btns"><button class="btn pri" id="tkEx">Beispiele ansehen</button><button class="btn" id="tkRetry" data-retry>Erneut prüfen</button></div></div>'; $('#tkEx', V).onclick = openExamples; return; }
    const d = taskDone(), t = curTask(); let h = '';
    const n100 = A.filter(x => (d[x.id] || 0) >= 100).length, ic = x => (x.rig ? rigIcon(x.rig) : '🧮'), rn = x => (x.rig ? rigName(x.rig) : 'Rechner');
    h += `<div class="pbar big"><i style="width:${Math.round(100 * n100 / A.length)}%"></i></div>`;
    if (t) {
      const r = taskRes && taskRes.id === t.id ? taskRes : null, ask2 = t.ask ? (typeof t.ask === 'string' ? { label: t.ask } : t.ask) : null, ans = taskAns[t.id] || {}, fl = fieldsOf(t), cl = choicesOf(t);
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat || '')}</h4><div class="big">${esc(t.title)}</div><div class="lv">${'●'.repeat(t.level || 1)}${'○'.repeat(3 - (t.level || 1))}</div>
        <p style="margin:8px 0;white-space:pre-line">${esc(t.text)}</p>${tableHtml(t.table)}<p class="hint2" style="margin-top:0">Prüfstand: ${ic(t)} ${esc(rn(t))}</p>${S.hidden.includes('fehler') ? `<p class="hint2">🩺 Der Fehlerfall ist verdeckt („Fehler: ?“). Miss am Prüfstand, dann gib deine Diagnose ab.${S.diagnose ? ' Abgegebene Diagnose: <b>' + esc(S.diagnose.label) + '</b>.' : ''}</p>` : ''}
        ${ask2 ? `<label class="f"><span>${esc(ask2.label || 'Dein Ergebnis')}${ask2.unit ? ' (' + esc(ask2.unit) + ')' : ''}</span><input id="tkAns" inputmode="decimal" autocomplete="off" value="${esc(ans.v || '')}"></label>` : ''}
        ${fl.length ? `<div class="sheetbox"><div class="gh" style="padding-top:0">Antwortblatt</div>${fl.map(f => `<label class="f"><span>${esc(f.question || f.label || f.key)}${f.unit ? ' in ' + esc(f.unit) : ''}</span><input data-fk="${esc(f.key)}" inputmode="decimal" autocomplete="off" value="${esc((ans.f || {})[f.key] || '')}"></label>`).join('')}</div>` : ''}
        ${cl.map(c => `<fieldset class="choice"><legend>${esc(c.q || c.label || c.key)}</legend>${choiceOpts(c).map((o, i) => `<label class="opt"><input type="radio" name="ch-${esc(c.key)}" data-ck="${esc(c.key)}" data-ci="${i}"${(ans.c || {})[c.key] !== undefined && String((ans.c || {})[c.key]) === String(o.value) ? ' checked' : ''}> ${esc(o.label)}</label>`).join('')}</fieldset>`).join('')}
        <div class="btns"><button class="btn pri" data-ta="check">✓ Lösung prüfen</button>${S.hidden.includes('fehler') ? '<button class="btn" data-ta="diag">🩺 Diagnose abgeben</button>' : ''}<button class="btn" data-ta="hint">💡 Tipp</button></div>
        <div class="btns"><button class="btn" data-ta="rig">Zum Prüfstand</button>${t.report || /Messreihe/i.test(t.cat || '') ? '<button class="btn" data-ta="report">Zur Messreihe</button>' : ''}${ask2 || fl.length ? '<button class="btn" data-ta="calc">Zum Rechner</button>' : ''}${typeof t.sol === 'function' ? '<button class="btn" data-ta="auto">▶ Auto-Weg</button>' : ''}<button class="btn" data-ta="hand">Abgeben (QR)</button><button class="btn danger" data-ta="end">Aufgabe beenden</button></div>`;
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
      if (a === 'check') checkTask(); else if (a === 'hint') hintTask(); else if (a === 'rig') setTab('rig'); else if (a === 'report') setTab('report'); else if (a === 'calc') setTab('calc'); else if (a === 'diag') diagnosePick(); else if (a === 'reveal') revealFault();
      else if (a === 'auto') { if (t && await confirmSheet('Auto-Weg?', 'Der Prüfstand spielt die Musterlösung ab. Das <b>zählt als Hilfe</b> (Stufe 3): Dein Ausbilder sieht es.', 'Abspielen')) autoWay(t); }
      else if (a === 'hand') { if (t && root.Auswertung) root.Auswertung.handIn(t.id, taskDone()[t.id] || 0, t.title); }
      else if (a === 'end') { S.task = null; taskRes = null; helpRefresh(); updateChrome(); renderTasks(); toast('Aufgabe beendet'); }
    } else if (row) startTask(row.dataset.t);
  });

  /* ============================================================ Fehlersuche mit verdecktem Fehler (Aufgaben, Fehler-Würfel): "Fehler: ?", Diagnose abgeben, Auflösung, Beheben und Prüfen */
  const cval = k => { try { return S.rig.getControl(k); } catch (e) { return undefined; } };
  const strs = a => (Array.isArray(a) ? a.filter(k => typeof k === 'string') : []);
  /* Sperren und Verdecken gelten in der Oberfläche UND im Prüfstand (setLock, setHidden); der Fehlerwert steht nie im sichtbaren Text */
  function applyLockHidden(lock, hidden) {
    S.lock = strs(lock); S.hidden = strs(hidden);
    if (S.rig) { try { if (typeof S.rig.setLock === 'function') S.rig.setLock(S.lock); if (typeof S.rig.setHidden === 'function') S.rig.setHidden(S.hidden); } catch (e) { console.error(e); } }
    S.evSig = ''; buildControls(); buildPresets(); buildFaultPanel(); readState(); updateDiag(true); updateAmp(true); updateEvents(true); updateSicht(true);
  }
  const fehlerOpts = () => { const c = ctlDef('fehler'); return c ? (c.options || []).filter(o => String(o.value) !== 'keiner') : []; };
  const optLab = (k, v) => { const c = ctlDef(k); return c ? optLabel(c, v) : String(v); };
  const RANK = { grau: 0, rot: 1, gelb: 2, gruen: 3 };
  const badIds = () => { let d = []; try { d = S.rig.diagnose({ verdeckt: verdecktNow() }) || []; } catch (e) { d = []; } return new Set(d.filter(x => x && (x.kind === 'error' || x.kind === 'warn')).map(x => x.id)); };
  /* Meldungen mit den gerechneten Zahlen aus rig.diagnose() (nur nach dem Aufdecken) */
  function diagTexts() { let d = []; try { d = S.rig.diagnose({ verdeckt: false }) || []; } catch (e) { d = []; } const bad = d.filter(x => x && (x.kind === 'error' || x.kind === 'warn')); return (bad.length ? bad : d).slice(0, 2).map(x => x.text); }
  function predictText(id) {
    const C = CORE(); try { const p = C && C.faults && typeof C.faults.predict === 'function' ? C.faults.predict(S.rigId, id, allCtl()) : null; if (p && p.ok && Array.isArray(p.messbefunde) && p.messbefunde.length) return ' Läge dieser Fehler vor, würdest du messen: ' + p.messbefunde.join('; ') + '.'; } catch (e) { /* ohne Vorhersage */ }
    return '';
  }
  /* Zustand mit runSeq (ein Schritt, aktuelle Steuerwerte): Messwerte, Ampel und Meldungen, die schon vorher bemängelt wurden */
  async function baseState() {
    const C = CORE(); let res = null;
    if (C && typeof C.runSeq === 'function' && defOf(S.rigId)) { try { res = await C.runSeq(() => defOf(S.rigId).create({ seed: 1 }), [{ t: 0, set: {} }], 1, { seed: 1, controls: allCtl() }); } catch (e) { res = null; } }
    const a = res && (res.assess || (res.final && res.final.assess)), ma = assessOf(S.rig);
    return { ampel: a ? ampKey(a.ampel) : ampKey(ma && ma.ampel), meters: res && res.final && res.final.meters ? clone(res.final.meters) : null, bad: [...badIds()] };
  }
  const sameMeters = (a, b) => { if (!a || !b) return null; const ks = Object.keys(b).filter(k => fin(+b[k])); return ks.length ? ks.every(k => fin(+a[k]) && Math.abs(a[k] - b[k]) <= 1e-6 * Math.max(1, Math.abs(b[k]))) : null; };

  const DICE = {
    diode: [
      { id: 'led-ohne-rv', name: 'LED ohne Vorwiderstand', kind: 'wert', apply: () => { const c = ctlDef('rv'); return { typ: 'led_rot', rv: c ? c.min : 1 }; }, text: 'Die LED hängt fast ohne Vorwiderstand an der Quelle: Nur die Kennlinie begrenzt den Strom, die LED wird überlastet. Wähle den Vorwiderstand nach R_V = (U_q − U_F) / I_F.' },
      { id: 'diode-verpolt', name: 'Diode verpolt', kind: 'fehler', fehler: 'verpolt' }],
    schalter: [
      { id: 'rb-offen', name: 'Basiswiderstand offen', kind: 'fehler', fehler: 'rb offen' },
      { id: 'relais-ohne-freilauf', name: 'Relais ohne Freilaufdiode', kind: 'wert', apply: () => ({ last: 'relais', freilauf: false }), text: 'Ohne Freilaufdiode erzeugt die Spule beim Abschalten eine Spannungsspitze am Transistor (Gefahr für das Bauteil, nur Simulation). Schalte die Freilaufdiode wieder dazu.' }],
    emitter: [
      { id: 'r2-offen', name: 'R2 offen', kind: 'fehler', fehler: 'r2 offen' }, { id: 'ce-offen', name: 'Emitterkondensator offen', kind: 'fehler', fehler: 'ce offen' }, { id: 'c1-offen', name: 'Koppelkondensator offen', kind: 'fehler', fehler: 'c1 offen' }],
    folger: [{ id: 're-offen', name: 'Emitterwiderstand offen', kind: 'fehler', fehler: 're offen' }],
    opv_inv: [{ id: 'rf-offen', name: 'Rf offen', kind: 'fehler', fehler: 'rf offen' }, { id: 'versorgung-fehlt', name: 'Versorgung fehlt', kind: 'fehler', fehler: 'versorgung fehlt' }],
    opv_nin: [{ id: 'rg-offen', name: 'Rg offen', kind: 'fehler', fehler: 'rg offen' }, { id: 'versorgung-minus-fehlt', name: 'negative Versorgung fehlt', kind: 'fehler', fehler: 'versorgung minus fehlt' }],
    opv_komp: [{ id: 'mitkopplung-fehlt', name: 'Mitkopplung fehlt', kind: 'fehler', fehler: 'r2 offen' }],
    opv_aktiv: [{ id: 'integrierer-ohne-rp', name: 'Integrierer ohne Rp', kind: 'fehler', fehler: 'rp offen' }]
  };
  const DICE_KINDS = []; Object.keys(DICE).forEach(rid => DICE[rid].forEach(d => DICE_KINDS.push({ rig: rid, id: d.id, name: d.name, kind: d.kind, fehler: d.fehler || null })));
  root.ANA_DICE = DICE; root.ANA_DICE_KINDS = DICE_KINDS;
  /* Steuerwerte, die der Würfel setzt (nur, wenn es sie gibt und sie sich ändern) */
  const diceMap = d => {
    let m = null; try { m = d.kind === 'fehler' ? { fehler: d.fehler } : d.apply(); } catch (e) { m = null; }
    if (!m || !Object.keys(m).length) return null;
    if (!Object.keys(m).every(k => { const c = ctlDef(k); return c && coerce(c, m[k]) !== undefined; })) return null;
    return Object.keys(m).some(k => String(cval(k)) !== String(coerce(ctlDef(k), m[k]))) ? m : null;
  };
  function buildFaultPanel() {
    const H = $('#faultHost'); if (!H) return; const d = S.dice, hid = isHid('fehler');
    if (!S.rig || (!hid && !d)) { H.innerHTML = ''; return; }
    const b = [];
    if (hid) { b.push('<button class="btn pri" data-fa="diag">🩺 Diagnose abgeben</button>'); b.push('<button class="btn" data-fa="reveal">Auflösung zeigen</button>'); }
    if (d && d.kind === 'fehler' && d.revealed && !d.done) b.push('<button class="btn pri" data-fa="repair">🔧 Fehler beheben und prüfen</button>');
    if (d && d.kind === 'wert' && !d.done) { b.push('<button class="btn pri" data-fa="check">✓ Behebung prüfen</button>'); b.push('<button class="btn" data-fa="reveal">Auflösung</button>'); }
    if (d && !d.done) b.push('<button class="btn" data-fa="undo">↩ Abbrechen</button>'); if (d && d.done) b.push('<button class="btn" data-fa="close">Schließen</button>');
    const title = d ? '🎲 Finde den Fehler' + (d.done ? ' – erledigt' : '') : '🩺 Fehlersuche (Simulation)';
    const intro = hid ? 'Der Fehlerfall ist verdeckt („Fehler: ?“). Miss mit den Messgeräten, lies Ampel und Hinweise und gib deine Diagnose ab. Ein defekter Aufbau wird hier nur simuliert.' : 'Am Aufbau stimmt etwas nicht. Beobachte Ampel, Messgeräte und Hinweise. Mit „Behebung prüfen“ kontrolliert der Prüfstand, ob keine neue Warnung mehr kommt.';
    H.innerHTML = `<div class="card pl fault"><h4>${title}</h4><p class="hint2" style="margin:0 0 6px">${esc(intro)}</p><div class="btns" style="margin-top:0">${b.join('')}</div>${S.diagnose && hid ? `<p class="hint2">Abgegebene Diagnose: <b>${esc(S.diagnose.label)}</b></p>` : ''}${d && d.result ? `<div class="hint2 inl" role="status">${esc(d.result)}</div>` : ''}</div>`;
  }
  async function diagnosePick() {
    if (!S.rig || S.readonly) return; const opts = fehlerOpts(); if (!opts.length) { toast('Diese Anlage hat keine Fehlerliste.'); return; }
    const v = await pick('Diagnose abgeben: Was ist die Ursache?', opts.map(o => ({ value: o.value, label: o.label })), { intro: 'Wähle die Ursache, die zu deinen Messwerten passt. Die Liste zeigt alle Fehlerbilder dieser Anlage.' });
    if (v != null) setDiagnose(v);
  }
  function setDiagnose(v) {
    const o = fehlerOpts().find(x => x.value === v || String(x.value) === String(v)); if (!o) return false;
    S.diagnose = { id: o.value, label: o.label }; S.dirty = true; if (hasCtl('diagnose') && !isLocked('diagnose')) setCtl('diagnose', o.value);
    if (S.dice && S.dice.kind === 'fehler' && !S.dice.revealed) diceEval(); else toast('Diagnose abgegeben: ' + o.label + (S.task ? '. Prüfe sie jetzt mit „Lösung prüfen“.' : ''));
    buildFaultPanel(); renderTasksIfOpen(); saveCurSoon(); return true;
  }
  function revealDice() { const d = S.dice; if (!d) return; d.revealed = true; applyLockHidden(S.lock, []); }
  function diceEval() {
    const d = S.dice; if (!d || !S.diagnose) return; d.attempts = (d.attempts || 0) + 1;
    if (S.diagnose.id === d.fehler) { revealDice(); d.result = 'Richtig: ' + S.diagnose.label + '. ' + diagTexts().join(' ') + ' Tippe auf „Fehler beheben und prüfen“.'; toast('Richtig gefunden: ' + S.diagnose.label); }
    else { d.result = 'Nicht ganz: „' + S.diagnose.label + '“ passt nicht zu deinen Messwerten.' + predictText(S.diagnose.id) + ' Miss weiter und gib eine neue Diagnose ab.'; toast('Die Diagnose passt nicht zu den Messwerten'); }
  }
  async function revealFault() {
    const d = S.dice;
    if (d && d.kind === 'wert') { d.revealed = true; d.result = 'Auflösung: ' + d.name + '. ' + d.text; buildFaultPanel(); return; }
    if (S.task) { if (!await confirmSheet('Auflösung zeigen?', 'Das <b>zählt als Hilfe</b> (Stufe 3): Dein Ausbilder sieht es.', 'Zeigen')) return; const h = lsGet('sim.hints', {}); h[S.task.id] = 3; lsSet('sim.hints', h); }
    if (d) { revealDice(); d.result = 'Auflösung: ' + optLab('fehler', d.fehler) + '. ' + diagTexts().join(' '); } else { applyLockHidden(S.lock, []); toast('Auflösung: ' + optLab('fehler', cval('fehler'))); }
    buildFaultPanel(); renderTasksIfOpen(); updateDiag(true);
  }
  /* Behebung prüfen (nur Fehlerbilder aus Werten): runSeq-Zustand, keine neue Warnung gegenüber vorher, Ampel nicht schlechter */
  async function checkDice() {
    const d = S.dice; if (!d || d.kind !== 'wert' || !S.rig) return;
    const now = await baseState(), b = d.base || {}, nb = (now.bad || []).filter(id => !(b.bad || []).includes(id));
    d.fixed = nb.length === 0 && RANK[now.ampel] >= RANK[b.ampel || 'grau']; d.done = d.fixed;
    d.result = d.fixed ? 'Behoben: Der Prüfstand meldet keine neue Warnung mehr, die Ampel steht auf ' + AMP[now.ampel].name + ' (vorher ' + AMP[b.ampel || 'grau'].name + ').' : 'Noch nicht behoben: ' + (diagTexts()[0] || 'Es gibt noch Warnungen.') + ' Die Ampel steht auf ' + AMP[now.ampel].name + '.';
    buildFaultPanel(); toast(d.fixed ? 'Fehlerbild behoben' : 'Noch nicht behoben');
  }
  /* Fehler beheben und prüfen: fehler -> keiner, danach runSeq: dieselben Messwerte und eine Ampel wie vor dem Fehler */
  async function repairDice() {
    const d = S.dice; if (!d || d.kind !== 'fehler' || !S.rig) return;
    if (!d.revealed && !await confirmSheet('Fehler beheben?', 'Du hast die Ursache noch nicht gefunden. Beheben deckt den Fehler auf.', 'Beheben')) return;
    applyLockHidden([], []); S.faultStart = null; setCtl('fehler', 'keiner', true); readState();
    const now = await baseState(), b = d.base || {}; let same = sameMeters(now.meters, b.meters);
    if (same === null) same = Object.keys(d.before || {}).every(k => String(cval(k)) === String(d.before[k]));
    const n = b.meters ? Object.keys(b.meters).length : 0;
    d.fixed = true; d.done = true; d.revealed = true;
    d.result = same && RANK[now.ampel] >= RANK[b.ampel || 'grau'] ? 'Behoben: ' + (n ? 'Alle ' + n + ' Messwerte' : 'Die Einstellungen') + ' stimmen wieder mit dem Zustand vor dem Fehler überein, die Ampel steht auf ' + AMP[now.ampel].name + '.' : 'Der Fehler ist weg, die Werte weichen aber vom Zustand vor dem Fehler ab: Du hast auch andere Steuerwerte geändert.';
    buildFaultPanel(); updateAmp(true); updateDiag(true); toast('Fehler behoben');
  }
  function undoDice() {
    const d = S.dice; if (!d || !S.rig) return; applyLockHidden([], []); S.faultStart = null; applyCtl(d.before); S.dice = null; S.diagnose = null;
    buildFaultPanel(); readState(); updateAmp(true); updateDiag(true); saveCurSoon(); toast('Würfel zurückgesetzt');
  }
  $('#faultHost').addEventListener('click', e => {
    const b = e.target.closest('[data-fa]'); if (!b || !S.rig || S.readonly) return; const a = b.dataset.fa;
    if (a === 'diag') diagnosePick(); else if (a === 'reveal') revealFault(); else if (a === 'repair') repairDice(); else if (a === 'check') checkDice(); else if (a === 'undo') undoDice();
    else if (a === 'close') { S.dice = null; S.diagnose = null; buildFaultPanel(); saveCurSoon(); }
  });
  /* Würfeln: bei Fehlerfällen aus der Liste verdeckt (lock + hidden), sonst als sichtbares Fehlerbild mit gesetzten Werten */
  async function diceRoll() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; } if (S.task) { toast('Beende zuerst die Aufgabe.'); return; }
    if (S.dice) undoDice();
    const ok = (DICE[S.rigId] || []).filter(diceMap); if (!ok.length) { toast('An diesem Prüfstand lässt sich nichts auswürfeln.'); return; }
    const d = ok[Math.floor(Math.random() * ok.length)], m = diceMap(d), before = {}; Object.keys(m).forEach(k => { before[k] = cval(k); });
    const base = await baseState();
    applyCtl(m); readState();
    S.dice = { id: d.id, name: d.name, kind: d.kind, fehler: d.fehler || null, text: d.text || '', rigId: S.rigId, before, base, result: '', attempts: 0, revealed: false, done: false, fixed: false }; S.diagnose = null;
    if (d.kind === 'fehler') { S.faultStart = { controls: clone(allCtl()) }; applyLockHidden(['fehler'], ['fehler']); } else { S.faultStart = null; buildFaultPanel(); }
    stat('anawuerfel', 1); S.dirty = true; saveCurSoon(); if (!S.running) setRun(true); updateAmp(true);
    if (root.LochFX && canSound()) try { root.LochFX.sound('slide'); } catch (e) {}
    sheet('🎲 Fehler gewürfelt', (bd, close) => {
      bd.innerHTML = '<p style="margin-top:0">' + (d.kind === 'fehler' ? 'Im Aufbau steckt ein Fehler, <b>verdeckt</b>. Beobachte Ampel, Messgeräte und Hinweise, finde die Ursache und gib deine Diagnose ab. Danach behebst du den Fehler und der Prüfstand kontrolliert das Ergebnis.' : 'Am Aufbau stimmt etwas nicht. Beobachte Ampel, Messgeräte und Hinweise und stelle den Aufbau richtig. Mit „Behebung prüfen“ kontrolliert der Prüfstand das Ergebnis.') + '</p><div class="btns"><button class="btn pri" data-d="ok">Ich suche selbst</button></div>';
      bd.addEventListener('click', ev => { if (ev.target.closest('[data-d]')) close(); });
    });
  }

/* ============================================================ Vier Vertiefungen (aufklappbar, Zustand ana.deep): bode, slew, offset, sat. Im Prüfstand opv_aktiv unter dem Bild, Zahlen NUR aus ANA_CORE.deep.*, hier nur Zeichnen */
  const DEEP = [
    { k: 'bode', t: 'Bode-Diagramm und GBW', alt: 'Bode-Diagramm des Operationsverstärkers: Leerlauf und gegengekoppelt' },
    { k: 'slew', t: 'Slew-Rate', alt: 'Grenzkurve der Slew-Rate: größte Amplitude über der Frequenz' },
    { k: 'offset', t: 'Offsetspannung', alt: 'Ausgangsspannung bei Eingangsspannung null als Balken' },
    { k: 'sat', t: 'Sättigung (Aussteuergrenze)', alt: 'Übertragungskennlinie mit Aussteuergrenze und größter Eingangsspannung' }
  ];
  const deepGet = () => { const d = lsGet('ana.deep', {}); return d && typeof d === 'object' && !Array.isArray(d) ? d : {}; };
  const deepOpened = () => +deepGet().n || 0;
  const deepNow = () => { const d = deepGet(); return DEEP.filter(x => d[x.k]).length; };
  /* Lernen, Kennlinien und der Prüfstand zeigen dieselben Klappen: alle details[data-deep] nach dem Zustand in ana.deep nachziehen */
  function syncDeepDom() { try { const d = deepGet(); $$('details[data-deep]').forEach(el => { const want = !!d[el.dataset.deep]; if (el.open !== want) el.open = want; }); } catch (e) { /* kein Absturz */ } }
  function deepSet(k, v) {
    if (!DEEP.some(x => x.k === k)) return; const d = deepGet(), was = !!d[k]; d[k] = !!v;
    if (v && !was) { d.n = (+d.n || 0) + 1; stat('anadeep', d.n, 'max'); }
    if (DEEP.every(x => d[x.k])) stat('anadeepall', 1, 'max');
    lsSet('ana.deep', d); syncDeepDom(); if (v && !was) deepSig = '';
  }
  let deepSig = '';
  function buildDeep() {
    const H = $('#deepHost'); if (!H) return; deepSig = '';
    if (S.rigId !== 'opv_aktiv' || !S.rig) { H.innerHTML = ''; return; }
    H.innerHTML = DEEP.map(x => `<details class="card ana-vertiefung" data-deep="${x.k}"><summary>Vertiefung: ${esc(x.t)} <span class="bdg uw" title="Vertiefung: freiwillig">Vertiefung</span></summary><div class="cb"><canvas id="dpCv_${x.k}" role="img" aria-label="${esc(x.alt)}"></canvas><div class="readout" id="dpTx_${x.k}" aria-live="polite"></div></div></details>`).join('');
    $$('details[data-deep]', H).forEach(el => el.addEventListener('toggle', () => { const k = el.dataset.deep; if (el.open !== !!deepGet()[k]) deepSet(k, el.open); deepSig = ''; updateDeep(true); }));
    syncDeepDom();
  }
  function deepCfg() {
    const v = allCtl(); let mv = {}; try { mv = S.rig.readMeters() || {}; } catch (e) { mv = {}; }
    const r1 = +v.r1, rf = +v.rf;
    return { opv: String(v.opv || 'ideal'), r1, rf, uhat: Math.abs(+v.ue), f: +v.f, uv: +v.uv, vu: fin(+mv.v) && +mv.v > 0 ? +mv.v : (r1 > 0 ? rf / r1 : NaN) };
  }
  /* Zeichenfläche einer Vertiefung: Größe nach der Breite, Farben aus den Seitenvariablen */
  function dpCanvas(k, h) {
    const cv = document.getElementById('dpCv_' + k); if (!cv) return null; const w = cv.clientWidth; if (!w) return null; const dp = Math.min(2, root.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dp) || cv.height !== Math.round(h * dp)) { cv.width = Math.round(w * dp); cv.height = Math.round(h * dp); cv.style.height = h + 'px'; }
    const g = cv.getContext('2d'); g.setTransform(dp, 0, 0, dp, 0, 0); g.clearRect(0, 0, w, h); return { cv, g, w, h, K: gaugePal(), tx: document.getElementById('dpTx_' + k) };
  }
  function dpMsg(P, why) {
    const g = P.g; g.fillStyle = P.K.mute; g.font = '600 13px system-ui'; g.textAlign = 'left'; const max = P.w - 24, ls = []; let cur = '';
    String(why).split(' ').forEach(w => { const t = cur ? cur + ' ' + w : w; if (cur && g.measureText(t).width > max) { ls.push(cur); cur = w; } else cur = t; }); if (cur) ls.push(cur);
    ls.slice(0, 3).forEach((l, i) => g.fillText(l, 12, 24 + i * 18)); if (P.tx) P.tx.textContent = why; P.cv.setAttribute('aria-label', why);
  }
  /* Zeichenfläche erst nach der Rechnung: bei ungültigen Werten nur eine niedrige Fläche mit der Meldung */
  const dpArea = (k, bad, h) => dpCanvas(k, bad ? 70 : h);
  const lgx = (x, a, b, L, W) => L + W * (Math.log10(x) - Math.log10(a)) / ((Math.log10(b) - Math.log10(a)) || 1);
  function dpDecades(P, a, b, L, W, T, Hh) { const g = P.g; g.font = '11px system-ui'; g.lineWidth = 1; for (let k = Math.ceil(Math.log10(a) - 1e-9); k <= Math.floor(Math.log10(b) + 1e-9); k++) { const x = lgx(Math.pow(10, k), a, b, L, W); g.strokeStyle = P.K.track; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + Hh); g.stroke(); g.fillStyle = P.K.mute; g.textAlign = 'center'; g.fillText(fe(Math.pow(10, k), 'Hz'), x, T + Hh + 14); } }
  function drawDeepBode(C, c) {
    const D = C && C.deep && C.deep.bode ? C.deep.bode({ art: 'inv', r1: c.r1, rf: c.rf, opv: c.opv }) : null, bad = !D ? 'Der Kern (anacore-op.js) ist nicht geladen.' : (!D.ok || D.valid === false || !Array.isArray(D.f)) ? (D.why || 'Das Bode-Diagramm ist für diese Werte nicht gültig.') : '';
    const P = dpArea('bode', bad, 320); if (!P) return; if (bad) return dpMsg(P, bad);
    const g = P.g, K = P.K, L = 54, R = 10, T1 = 22, H1 = 160, T2 = 205, H2 = 80, pw = P.w - L - R, a = D.f[0], b = D.f[D.f.length - 1], X = f => lgx(f, a, b, L, pw);
    const all = D.a.concat(D.aOpen || []).filter(fin); let amin = Math.min(...all, 0), amax = Math.max(...all, 0); amin = Math.floor((amin - 3) / 20) * 20; amax = Math.ceil((amax + 3) / 20) * 20; const Y1 = v => T1 + H1 * (amax - v) / ((amax - amin) || 1);
    dpDecades(P, a, b, L, pw, T1, T2 + H2 - T1);
    for (let v = amin; v <= amax; v += 20) { const y = Y1(v); g.strokeStyle = K.track; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.fillStyle = K.mute; g.textAlign = 'right'; g.fillText(String(v), L - 5, y + 4); }
    g.fillStyle = K.mute; g.textAlign = 'left'; g.fillText('a in dB', 4, T1 - 9); g.fillText('φ in °', 4, T2 - 9); g.textAlign = 'center'; g.fillText('Frequenz f in Hz (logarithmisch, Dekaden)', L + pw / 2, P.h - 1);
    const line = (ys, col, w, dash) => { g.setLineDash(dash || []); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); ys.forEach((v, i) => { const x = X(D.f[i]), y = Y1(v); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.setLineDash([]); };
    if (D.aOpen) line(D.aOpen, K.mute, 1.6, [5, 4]); line(D.a, K.acc, 2.4);
    const y0 = Y1(0); g.strokeStyle = K.fg; g.lineWidth = 1; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(L, y0); g.lineTo(L + pw, y0); g.stroke(); g.setLineDash([]);
    const mk = (f, txt, y, dx) => { const x = X(f); if (!(x >= L && x <= L + pw)) return; g.setLineDash([3, 3]); g.strokeStyle = K.fg; g.beginPath(); g.moveTo(x, T1); g.lineTo(x, T2 + H2); g.stroke(); g.setLineDash([]); g.fillStyle = K.fg; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); g.textAlign = dx < 0 ? 'right' : 'left'; g.fillText(txt, x + dx, y - 6); };
    mk(D.fg, 'Knick f_g = ' + fe(D.fg, 'Hz'), Y1(20 * Math.log10(Math.abs(D.v0 || 1)) - 3.01), 6); mk(D.gbw, 'GBW = ' + fe(D.gbw, 'Hz'), y0, -6);
    g.fillStyle = K.mute; g.textAlign = 'left'; g.fillText('gestrichelt: Leerlauf (f_A = ' + fe(D.fA, 'Hz') + ')', L + 6, T1 + H1 - 6);
    if (D.phi) { const ph = D.phi.concat(D.phiOpen || []).filter(fin), pmin = Math.min(...ph, 0), pmax = Math.max(...ph, 0), Y2 = v => T2 + H2 * (pmax - v) / ((pmax - pmin) || 1); const l2 = (ys, col, w, dash) => { g.setLineDash(dash || []); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); ys.forEach((v, i) => { const x = X(D.f[i]), y = Y2(v); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.setLineDash([]); }; if (D.phiOpen) l2(D.phiOpen, K.mute, 1.4, [3, 3]); l2(D.phi, K.badfg, 2); g.fillStyle = K.mute; g.textAlign = 'right'; g.fillText(fnum(pmax, 0), L - 5, T2 + 4); g.fillText(fnum(pmin, 0), L - 5, T2 + H2 + 4); }
    if (P.tx) P.tx.textContent = D.text || ''; P.cv.setAttribute('aria-label', 'Bode-Diagramm. ' + (D.text || ''));
  }
  function drawDeepSlew(C, c) {
    const S0 = C && C.deep && C.deep.slew ? C.deep.slew({ opv: c.opv, uhat: c.uhat, f: c.f }) : null, bad = !S0 ? 'Der Kern (anacore-op.js) ist nicht geladen.' : (!S0.ok || S0.valid === false) ? (S0.why || 'Die Slew-Rate gilt nur für einen realen Operationsverstärker.') : '';
    const P = dpArea('slew', bad, 280); if (!P) return; if (bad) return dpMsg(P, bad);
    const g = P.g, K = P.K, L = 54, R = 10, T = 22, Hh = 215, pw = P.w - L - R, a = 1e3, b = 1e7, pts = [];
    for (let i = 0; i <= 40; i++) { const f = a * Math.pow(b / a, i / 40), r = C.deep.slew({ opv: c.opv, f }); if (r && fin(r.uhatMax)) pts.push([f, r.uhatMax]); }
    if (pts.length < 2) return dpMsg(P, 'Keine Kurve berechenbar.');
    const ys = pts.map(p => p[1]).concat(fin(c.uhat) && c.uhat > 0 ? [c.uhat] : []), ylo = Math.pow(10, Math.floor(Math.log10(Math.min(...ys)) - 0.2)), yhi = Math.pow(10, Math.ceil(Math.log10(Math.max(...ys)) + 0.2)), Y = v => T + Hh * (1 - (Math.log10(v) - Math.log10(ylo)) / ((Math.log10(yhi) - Math.log10(ylo)) || 1));
    dpDecades(P, a, b, L, pw, T, Hh); g.font = '11px system-ui';
    for (let k = Math.ceil(Math.log10(ylo)); k <= Math.floor(Math.log10(yhi)); k++) { const y = Y(Math.pow(10, k)); g.strokeStyle = K.track; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.fillStyle = K.mute; g.textAlign = 'right'; g.fillText(fe(Math.pow(10, k), 'V'), L - 5, y + 4); }
    g.globalAlpha = 0.16; g.fillStyle = K.bad; g.beginPath(); pts.forEach((p, i) => { const x = lgx(p[0], a, b, L, pw), y = Y(p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.lineTo(L + pw, T + Hh); g.lineTo(L, T + Hh); g.closePath(); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = K.acc; g.lineWidth = 2.4; g.beginPath(); pts.forEach((p, i) => { const x = lgx(p[0], a, b, L, pw), y = Y(p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.fillStyle = K.badfg; g.textAlign = 'left'; g.fillText('unter der Kurve: Ausgang folgt der Amplitude nicht mehr (Slew-Rate begrenzt)', L + 6, T + Hh - 6);
    g.fillStyle = K.mute; g.textAlign = 'left'; g.fillText('û in V', 4, T - 9); g.textAlign = 'center'; g.fillText('Frequenz f in Hz (logarithmisch)', L + pw / 2, P.h - 1);
    if (fin(c.f) && c.f > 0 && fin(c.uhat) && c.uhat > 0) { const x = lgx(clamp(c.f, a, b), a, b, L, pw), y = Y(c.uhat); g.fillStyle = K.fg; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.textAlign = x > L + pw - 150 ? 'right' : 'left'; g.fillText('eingestellt: ' + fe(c.uhat, 'V') + ' bei ' + fe(c.f, 'Hz'), x + (x > L + pw - 150 ? -8 : 8), y - 8); }
    if (P.tx) P.tx.textContent = S0.text || ''; P.cv.setAttribute('aria-label', 'Slew-Rate. ' + (S0.text || ''));
  }
  function drawDeepOffset(C, c) {
    const O = C && C.deep && C.deep.offset ? C.deep.offset({ opv: c.opv, rf: c.rf, r1: c.r1 }) : null, bad = !O ? 'Der Kern (anacore-op.js) ist nicht geladen.' : (!O.ok || O.valid === false) ? (O.why || 'Die Offsetspannung ist nicht berechenbar.') : '';
    const P = dpArea('offset', bad, 180); if (!P) return; if (bad) return dpMsg(P, bad);
    const g = P.g, K = P.K, L = 30, R = 30, cy = 84, pw = P.w - L - R, half = Math.max(2 * Math.abs(O.uaOff), 1e-3), X = v => L + pw / 2 + pw / 2 * v / half;
    g.font = '11px system-ui'; g.strokeStyle = K.mute; g.lineWidth = 1.5; g.beginPath(); g.moveTo(L, cy); g.lineTo(L + pw, cy); g.stroke();
    [-half, -half / 2, 0, half / 2, half].forEach(v => { const x = X(v); g.beginPath(); g.moveTo(x, cy - 5); g.lineTo(x, cy + 5); g.stroke(); g.fillStyle = K.mute; g.textAlign = 'center'; g.fillText(fe(v, 'V'), x, cy + 20); });
    g.fillStyle = K.acc; const x0 = X(0), x1 = X(O.uaOff); g.fillRect(Math.min(x0, x1), cy - 16, Math.max(2, Math.abs(x1 - x0)), 32);
    g.fillStyle = K.fg; g.textAlign = 'center'; g.fillText('U_a,off = ' + fe(O.uaOff, 'V') + ' bei U_e = 0', L + pw / 2, 24); g.fillStyle = K.mute; g.fillText('Ausgangsspannung in V (Maßstab an den Offset angepasst)', L + pw / 2, P.h - 4);
    if (P.tx) P.tx.textContent = O.text || ''; P.cv.setAttribute('aria-label', 'Offsetspannung. ' + (O.text || ''));
  }
  function drawDeepSat(C, c) {
    const vu = fin(c.vu) && c.vu > 0 ? c.vu : 10, Z = C && C.deep && C.deep.sat ? C.deep.sat({ opv: c.opv, uv: c.uv, v: vu }) : null, bad = !Z ? 'Der Kern (anacore-op.js) ist nicht geladen.' : (!Z.ok || Z.valid === false) ? (Z.why || 'Die Aussteuergrenze ist nicht berechenbar.') : '';
    const P = dpArea('sat', bad, 300); if (!P) return; if (bad) return dpMsg(P, bad);
    const g = P.g, K = P.K, L = 54, R = 14, T = 22, Hh = 224, pw = P.w - L - R, xm = 3 * Z.ueMax, ym = Math.min(Z.usat, Z.usatN) * 1.2, X = v => L + pw / 2 + pw / 2 * v / xm, Y = v => T + Hh / 2 - Hh / 2 * v / ym;
    g.font = '11px system-ui'; g.lineWidth = 1; g.strokeStyle = K.track;
    [-1, -0.5, 0, 0.5, 1].forEach(q => { const x = X(q * xm), y = Y(q * ym); g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + Hh); g.stroke(); g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.fillStyle = K.mute; g.textAlign = 'center'; g.fillText(fe(q * xm, 'V'), x, T + Hh + 14); g.textAlign = 'right'; g.fillText(fe(q * ym, 'V'), L - 5, y + 4); });
    g.strokeStyle = K.fg; g.setLineDash([5, 4]); [Z.usat, -Z.usatN].forEach(v => { g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(L + pw, Y(v)); g.stroke(); }); g.setLineDash([]);
    g.strokeStyle = K.acc; g.lineWidth = 2.4; g.beginPath(); for (let i = 0; i <= 120; i++) { const ue = -xm + 2 * xm * i / 120, ua = clamp(-vu * ue, -Z.usatN, Z.usat), x = X(ue), y = Y(ua); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.fillStyle = K.fg; [-Z.ueMax, Z.ueMax].forEach(v => { g.beginPath(); g.arc(X(v), Y(clamp(-vu * v, -Z.usatN, Z.usat)), 4, 0, 7); g.fill(); });
    g.textAlign = 'left'; g.fillText('U_e,max = ' + fe(Z.ueMax, 'V'), X(Z.ueMax) + 8, Y(clamp(-vu * Z.ueMax, -Z.usatN, Z.usat)) - 8);
    g.fillStyle = K.mute; g.textAlign = 'left'; g.fillText('U_a in V', 4, T - 9); g.textAlign = 'center'; g.fillText('Eingangsspannung U_e in V (invertierend, |V_u| = ' + fnum(vu, vu >= 10 ? 1 : 2) + ')', L + pw / 2, P.h - 1);
    if (P.tx) P.tx.textContent = Z.text || ''; P.cv.setAttribute('aria-label', 'Sättigung. ' + (Z.text || ''));
  }
  /* Der Prüfstand opv_aktiv zeichnet seine Vertiefungen selbst (rig.drawDeep, rig.deepInfo); fehlt das, zeichnet die Oberfläche (Zahlen aus ANA_CORE.deep) */
  function rigDeep(k) {
    const r = S.rig; if (!r || typeof r.drawDeep !== 'function' || typeof r.deepInfo !== 'function') return false;
    try {
      const inf = (r.deepInfo() || {})[k]; if (!inf) return false; const bad = inf.valid === false, P = dpCanvas(k, bad ? 70 : 280); if (!P) return true;
      if (bad) { dpMsg(P, inf.why || inf.text || 'Nicht berechenbar.'); return true; }
      if (r.drawDeep(k, P.g, P.w, P.h, { theme: theme(), quality: curQ(), reduced: reduced() }) === false) return false;
      if (P.tx) P.tx.textContent = inf.text || ''; P.cv.setAttribute('aria-label', (DEEP.find(d => d.k === k) || {}).alt + '. ' + (inf.text || '')); return true;
    } catch (e) { return false; }
  }
  const DRAWDEEP = { bode: drawDeepBode, slew: drawDeepSlew, offset: drawDeepOffset, sat: drawDeepSat };
  function updateDeep(force) {
    const H = $('#deepHost'); if (!H || !S.rig || S.rigId !== 'opv_aktiv' || S.tab !== 'rig') return; const d = deepGet(), open = DEEP.filter(x => d[x.k]); if (!open.length) { deepSig = ''; return; }
    const cfg = deepCfg(); let sig = ''; try { sig = JSON.stringify([cfg, open.map(x => x.k), (document.getElementById('dpCv_' + open[0].k) || {}).clientWidth]); } catch (e) { sig = String(Math.random()); }
    if (!force && sig === deepSig) return; deepSig = sig; const C = CORE();
    open.forEach(x => { try { if (!rigDeep(x.k)) DRAWDEEP[x.k](C, cfg); } catch (e) { if (!updateDeep.err) { updateDeep.err = 1; console.error('Vertiefung ' + x.k + ':', e); } } });
  }
  /* Taste B: Vertiefung Bode auf- oder zuklappen und dorthin wechseln, wo sie zu sehen ist (Kennlinien, sonst Prüfstand Integrierer und realer OPV) */
  function toggleBode() {
    if (S.tab === 'curve') { const E = extOf('curve'); if (E && typeof E.toggleBode === 'function') { try { E.toggleBode(); return; } catch (e) { /* weiter */ } } deepSet('bode', !deepGet().bode); extRefresh(); return; }
    if (S.rigId === 'opv_aktiv') { deepSet('bode', !deepGet().bode); if (S.tab !== 'rig') setTab('rig'); updateDeep(true); return; }
    deepSet('bode', !deepGet().bode); setTab('curve'); toast('Vertiefung Bode-Diagramm: ' + (deepGet().bode ? 'aufgeklappt' : 'zugeklappt') + ' (Tab Kennlinien, am Prüfstand Integrierer und realer OPV)');
  }
  /* ============================================================ Kennlinien, Messreihe, Auslegen, Rechnen, Lernen: Erweiterungen (ANA_UI_EXT, VERTRAG 6.5) */
  function loadRig(o) {
    o = o || {}; if (S.task) { toast('Beende zuerst die Aufgabe.'); return false; }
    const id = o.rig && ORDER.includes(o.rig) ? o.rig : S.rigId; if (!defOf(id)) { toast('Dieser Prüfstand ist noch nicht geladen.'); return false; }
    const had = stash(); S.name = o.name || 'Neuer Versuch'; S.id = null; S.dirty = false; S.rows[id] = []; setRig(id);
    if (o.preset && S.rig && typeof S.rig.applyPreset === 'function') { try { S.rig.applyPreset(o.preset); S.preset = o.preset; } catch (e) { console.error(e); } buildControls(); buildMeters(); buildPresets(); buildSicht(); }
    if (o.controls) applyCtl(o.controls);
    setTab(o.tab || 'rig'); updateChrome(); saveCurSoon(); toast(had ? 'Geladen, dein Versuch ist gesichert' : (o.toast || 'Im Prüfstand geladen: ' + rigName(id)));
    return true;
  }
  function extApi() {
    return { get S() { return S; }, get rig() { return S.rig; }, setTab, loadExample, startTask, toast, esc, stat: (k, v, m) => { if (k === 'anacalc') S.calcUsed = true; stat(k, v, m); }, lsGet, lsSet, get ANA_CORE() { return CORE(); }, get ANA_DRAW() { return DRAW(); }, snapshot, setRef, get quality() { return curQ(); }, get reduced() { return reduced(); }, get theme() { return theme(); },
      KEYS, GRUPPEN, SICHTEN, ORDER, SPEEDS, deep: { get: deepGet, set: deepSet, opened: deepOpened }, loadRig, setCtl, applyCtl, ctlShow, ctlParse, rigName, rigIcon, defOf, fnum, fe, parseNum, setRun, resetRig, merken, toggleVN, doFire, assessOf, allCtl, limGet, limBadge,
      hidden: () => S.hidden.slice(), locked: () => S.lock.slice(), get refRig() { return S.refRig; },
      getBericht: () => (S.bericht ? clone(S.bericht) : null), setBericht: p => { S.bericht = p && typeof p === 'object' ? clone(p) : null; S.dirty = true; saveCurSoon(); } };
  }
  const EXTHOST = { wave: '#waveView', curve: '#curveView', report: '#reportView', design: '#designView', calc: '#calcView', help: '#helpView' }, EXTFILE = { wave: 'anaui-wave.js', curve: 'anaui-curve.js', report: 'anaui-report.js', design: 'anaui-design.js', calc: 'anaui-calc.js', help: 'anaui-help.js' }, EXTNAME = { wave: 'Verläufe', curve: 'Kennlinien', report: 'Messreihe', design: 'Auslegen', calc: 'Rechnen', help: 'Lernen' };
  const extOf = kind => root.ANA_UI_EXT && root.ANA_UI_EXT[kind];
  function renderExt(kind) {
    const host = $(EXTHOST[kind]), E = extOf(kind);
    if (!host) return;
    if (!E || typeof E.render !== 'function') { host.innerHTML = `<div class="card pl"><p class="big">Ansicht wird geladen</p><p class="hint2">Die Datei ${EXTFILE[kind]} ist noch nicht geladen (${EXTNAME[kind]}). Der Prüfstand läuft weiter.</p><div class="btns"><button class="btn" data-retry>Erneut prüfen</button><button class="btn" data-ta="rig">Zum Prüfstand</button></div></div>`; host.dataset.ext = ''; return; }
    if (kind === 'help' && host.dataset.ext === '1' && host.children.length) return;
    try { E.render(host, extApi()); host.dataset.ext = '1'; } catch (e) { console.error('Erweiterung ' + kind + ':', e); host.innerHTML = '<div class="card pl"><p class="big">Das hat nicht geklappt</p><p class="hint2">' + esc((e && e.message) || e) + '</p></div>'; }
  }
  function extRefresh() { if (S.tab === 'curve' || S.tab === 'report' || S.tab === 'wave') { const E = extOf(S.tab); if (E && typeof E.refresh === 'function') { try { E.refresh(); return; } catch (e) { /* neu zeichnen */ } } renderExt(S.tab); } }
  /* "Erneut prüfen" in einer Ansicht: fehlende Datei nachladen, dann zeichnen */
  document.addEventListener('click', e => {
    if (!(e.target.closest && e.target.closest('[data-retry]')) || !EXTHOST[S.tab]) return; const kind = S.tab;
    if (!extOf(kind)) loadFile(EXTFILE[kind]).then(() => { if (S.tab === kind) renderExt(kind); }); else renderExt(kind);
  });
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#pgWave [data-ta=rig],#pgCurve [data-ta=rig],#pgReport [data-ta=rig],#pgDesign [data-ta=rig],#pgCalc [data-ta=rig],#pgHelp [data-ta=rig]'); if (b) setTab('rig'); });
  /* Erweiterungen dürfen update(host, api) anbieten: alle 250 ms, solange ihr Tab offen ist und der Prüfstand läuft */
  let extT = 0;
  function extTick(ts) {
    if (ts - extT < 250 || !EXTHOST[S.tab]) return; extT = ts; const E = extOf(S.tab), host = $(EXTHOST[S.tab]);
    if (E && typeof E.update === 'function' && host && host.dataset.ext === '1' && (S.running || S.live || S.tab === 'wave')) { try { E.update(host, extApi()); } catch (e) { if (!extTick.err) { extTick.err = 1; console.error('Erweiterung update:', e); } } }
  }

  /* ============================================================ Oberfläche: Kopf, Tabs, Leiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd" style="display:none"></span>' : ''}</button>`).join('');
    updateTaskBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function redrawTab() { if (EXTHOST[S.tab]) { const E = extOf(S.tab); if (E && typeof E.redraw === 'function') { try { E.redraw(); } catch (e) { /* kein Absturz */ } } } }
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'rig'; S.tab = t; lsPut('ana.tab', t);
    $('#mid').dataset.tab = t; $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (EXTHOST[t]) renderExt(t); else if (t === 'tasks') renderTasks();
    if (t === 'help' || t === 'curve') syncDeepDom();
    buildPick(); updateChrome();
    requestAnimationFrame(() => { fitCanvas(); updateMeters(0, true); redrawTab(); syncCtl(true); updateSicht(true); updateDeep(true); });
  }
  function updateTitle() {
    const nm = rigName(S.rigId || ORDER[0]);
    $('#title').innerHTML = esc(S.name) + (S.dirty ? ' •' : '') + '\n<small>' + esc(nm) + (S.running ? ' · läuft' : '') + '</small>';
    document.title = 'Analogtechnik-Lab: ' + S.name;
    const tag = $('#cvTag'); if (tag) { tag.textContent = S.running ? '' : '⏸ Pause'; tag.style.display = S.running ? 'none' : ''; }
  }
  $('#title').onclick = async () => { const r = await ask('Name des Versuchs', [{ key: 'n', label: 'Name', type: 'text', value: S.name }]); if (r && r.n.trim()) { S.name = r.n.trim(); S.dirty = true; updateChrome(); saveCurSoon(); } };
  let palSig = '';
  function buildPal() {
    const fx2 = fxOn(), fire = canFire(), sig = [S.running, S.speed, fx2, !!S.rig, !!S.live, fire, S.rigId, reduced()].join('|');
    if (sig === palSig) return; palSig = sig; const F = !!root.LochFX;
    $('#pal').innerHTML = `<button class="chip ${S.running ? 'on' : 'go'}" data-a="run" aria-label="${S.running ? 'Pause' : 'Start'}">${S.running ? '⏸ Pause' : '▶ Start'}</button><button class="chip" data-a="reset" aria-label="Zurücksetzen">⟲ Reset</button>${fire ? `<button class="chip fire" data-a="fire" aria-label="${esc(FIRELBL[S.rigId] || 'Auslösen')} (Taste F)" title="Taste F">⚡ ${esc(FIRELBL[S.rigId] || 'Auslösen')}</button>` : ''}<span class="sep"></span>
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

  /* ============================================================ Menü */
  function openMenu() {
    const nT = (TK() || []).length, kk = KEYS.filter(k => !k.ext).map(k => k.keys.join('/')).slice(0, 4).join(', ');
    const rows = [
      ['tasks', 'Aufgaben', nT ? nT + ' Aufgaben mit automatischer Prüfung' : 'Aufgaben folgen'], ['open', 'Öffnen', 'Gespeicherte Versuche auf diesem Gerät'], ['print', 'Drucken', 'Einstellungen, Messwerte, Ampel und Prüfstandbild'],
      ['new', 'Neuer Versuch', 'Prüfstand wählen und von vorn beginnen'], ['ex', 'Beispielversuche', exampleList().length + ' Versuche zum Ausprobieren'], ['save', 'Speichern unter …', S.name], ['share', 'Teilen', 'Link zum Weitergeben (Versuch steckt im Link)'], ['import', 'Aus Code oder Link laden', 'Geteilten Versuch einfügen'],
      ['dice', 'Fehler-Würfel', 'Einen Fehler auswürfeln, messen und die Ursache finden'], ['fx', 'Effekte und Ton: ' + (fxOn() ? 'an' : 'aus'), 'Töne und Effekte ein- oder ausschalten'], ['png', 'Prüfstandbild speichern (PNG)', 'Aktuelle Ansicht als Bilddatei'], ['csv', 'Kennlinie als CSV', 'Punkte der ersten Kennlinie für Excel'],
      ['meters', 'Messgeräte: ' + (MVNAME[S.mview] || 'Zeiger'), 'Wechsel zwischen Zeigerinstrument, Zahlenanzeige und Frontplatte (Multimeter)'], ['deep', 'Vertiefungen', 'Bode-Diagramm, Slew-Rate, Offsetspannung, Sättigung (aufklappbar am Prüfstand Integrierer und realer OPV, Taste B für Bode)'],
      ['calc2', 'Rechnen', 'LED und Z-Diode, Transistor, Arbeitspunkt, Verstärkung, Operationsverstärker, Schmitt-Trigger, Filter und Übungen'], ['calc', 'Rechner', 'Taschenrechner: Ohm, Farbcode, Leitung und mehr'],
      ['pool', 'Pool-Fragen zum Thema', 'Prüfungsfragen zu Bauelementen ansehen (nur lesen, im Prüfungs-Lab)'],
      ['abz', 'Abzeichen', 'Deine Sammlung und was noch fehlt'], ['kamp', 'Kampagne: Der Verstärker', 'Lernpfad mit Geschichte über alle Labs'], ['trainer', 'Trainer: Erste Schritte', 'Kurze Einführung zum Mitmachen'],
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
      case 'meters': { const ord = MVIEWS.filter(v => v !== 'front' || frontOk()); S.mview = ord[(ord.indexOf(S.mview) + 1) % ord.length]; S.digital = S.mview === 'digital'; seenSet('mv', S.mview); seenSet('dig', S.digital ? 1 : 0); buildMeters(); updateMeters(0, true); break; }
      case 'print': printNow(); break; case 'calc2': setTab('calc'); break; case 'calc': if (root.Rechner) root.Rechner.open(); break; case 'abz': if (root.Badges) root.Badges.open(); break;
      case 'kamp': if (root.Kampagne) root.Kampagne.open(); break; case 'trainer': if (root.Trainer) root.Trainer.start(); break; case 'neu': if (root.LabNeu) root.LabNeu(); break;
      case 'erg': if (root.Auswertung) root.Auswertung.openSend(); break; case 'keys': if (root.LochKeys) root.LochKeys.help(); else keysSheet(); break;
      case 'help': setTab('help'); break; case 'pool': location.href = 'pruefungslab.html?thema=bauteile'; break; case 'start': location.href = 'index.html'; break;
      case 'deep':
        if (S.rigId !== 'opv_aktiv') { if (S.task) { toast('Während einer Aufgabe ist der Prüfstand fest. Beende zuerst die Aufgabe.'); break; } stash(); S.name = 'Neuer Versuch'; S.id = null; S.dirty = false; setRig('opv_aktiv'); }
        setTab('rig'); setTimeout(() => { const h = $('#deepHost'); if (h && h.scrollIntoView) h.scrollIntoView({ block: 'nearest' }); }, 120); break;
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
        lastUI = ts; readState(); syncCtl(); updateStat(); updateDiag(); updateSicht(); updateDeep(); updateAmp(); renderSweepLive(); updateQLine();
        const fb = $('#cvFault'), on = performance.now() < (S.faultUntil || 0);
        if (fb) { if (on) { const tx = S.faultText || ''; if (fb.textContent !== tx) fb.textContent = tx; } if (fb.classList.contains('on') !== on) fb.classList.toggle('on', on); }
      }
    } else if (ts - lastUI > 200) { lastUI = ts; readState(); updateStat(); }
    if (ts - lastSt > 250) { lastSt = ts; if (S.rig) watchState(); }
    fxFrame(); extTick(ts);
    const w = performance.now() - t0; perf.n++; perf.sum += w; if (w > perf.max) perf.max = w; perf.recent.push(w); if (perf.recent.length > 120) perf.recent.shift();
    if (S.tab === 'rig' && S.rig) qualityFeed(w, ts);
  }

  /* ============================================================ Schnittstellen für Trainer, Tasten, Tests */
  const ampelNow = () => { const a = assessOf(S.rig); return a ? ampKey(a.ampel) : 'grau'; };
  root.LabTrainerAPI = {
    lab: 'ana', tab: () => S.tab, go: setTab, simMode: () => S.running, running: () => S.running, rig: () => S.rigId, speed: () => S.speed,
    load: loadExampleByName, examples: () => exampleList().map(e => e.name), task: () => (S.task ? S.task.id : null), saved: () => saves().length,
    seqRows: () => curRows().length, seqDone: () => !!S.seqRes, simTime: () => S.simT, faults: () => (seenGet('faults', []) || []).length, calcUsed: () => !!S.calcUsed,
    ampel: ampelNow, refSet: () => !!S.ref, fired: () => !!S.fired,
    reportDone: () => { const a = lsGet('ana.report', []); return Array.isArray(a) && a.length > 0; }, designed: () => !!lsGet('ana.design', null),
    deepOpened: () => deepOpened()
  };
  root.LabKeysAdapter = {
    lab: 'ana', sheet: (title, build) => (title === 'Tastenkürzel' ? sheet(title, b => { b.innerHTML = keysHtml(); }) : sheet(title, build)), esc, toast,
    sim: () => setRun(!S.running), busy: () => true, has: () => false
  };
  /* kleine Testschnittstelle */
  root.ANA_UI = { frame, S, KEYS, TABS, ORDER, GRUPPEN, FIRELBL, RIGLIMITS, RIGMETA, SPEEDS, setTab, setRig, setCtl, applyCtl, setRun, setSpeed, resetRig, simAdvance, loadExample, loadExampleByName, startTask, checkTask, seqRunBg, seqLive, seqSteps, seqToRows, curRows, allCtl, coerce, csvText, parseCsv, shareObj, packShare, unpackShare, applyItem, saveItem, diceRoll, checkDice, repairDice, undoDice, DICE, DICE_KINDS, exampleList, BUILTIN, renderSweep, extApi, collectAnswer, retryLoad, openMenu, rowNorm, seqDur, slPos, slVal, merken, toggleVN, toggleWipe, backToRef, setRef, qualityFeed, curQ, setQMode, drawOpts, drawRig, fitCanvas, updateAmp, updateDiag, fxAmpel, doFire, tableHtml, perf: () => ({ n: perf.n, mean: perf.n ? perf.sum / perf.n : 0, max: perf.max, recentMean: perf.recent.length ? perf.recent.reduce((a, b) => a + b, 0) / perf.recent.length : 0 }), fnum, ctlShow, ctlParse, refFromExample, bandOf, rigPng, printNow, openExamples, newExperiment, openList, importSheet, exportPng, toggleFx, hintTask, buildLimits, limIds, SICHTEN, toggleBode, DEEP, deepGet, deepSet, deepNow, deepOpened, buildDeep, updateDeep, drawDeepBode, sichtOf, updateSicht, optNorm, updateSimBand, liveAct, applyLockHidden, verdecktNow, isHid, isLocked, setDiagnose, diagnosePick, revealFault, buildFaultPanel, meterText, eventFx, seenGet, seenSet, usePick, fehlerOpts, restoreFaultCtl, baseState };

  /* ============================================================ Start */
  function init() {
    buildTabs();
    const cur = lsGet('ana.cur', null);
    if (cur && ORDER.includes(cur.rig)) {
      S.rows = cur.rows && typeof cur.rows === 'object' && !Array.isArray(cur.rows) ? cur.rows : {}; Object.keys(S.rows).forEach(k => { S.rows[k] = Array.isArray(S.rows[k]) ? rowNorm(S.rows[k].filter(r => r && (r.kind === 'fire' || typeof r.key === 'string'))) : []; });
      S.name = cur.name || 'Neuer Versuch'; S.id = cur.id || null;
      setRig(cur.rig); applyCtl(cur.ctl); S.bericht = cur.bericht && typeof cur.bericht === 'object' ? cur.bericht : null; S.dirty = !!cur.dirty; S.task = cur.task ? { id: cur.task } : null;
      if (cur.ref && typeof cur.ref === 'object' && cur.ref.ctl) { S.ref = clone(cur.ref); S.refMode = ['vorher', 'nachher', 'wischer'].includes(cur.refMode) ? cur.refMode : 'nachher'; buildRefRig(); buildBA(); updateAmp(true); }
      /* eine laufende Fehlersuche (verdeckter Fehler) bleibt nach dem Neuladen verdeckt und gesperrt */
      const dice = cur.dice && typeof cur.dice === 'object' && cur.dice.rigId === cur.rig ? cur.dice : null;
      if (dice) S.dice = dice;
      if (cur.diagnose && typeof cur.diagnose === 'object' && typeof cur.diagnose.id === 'string') S.diagnose = { id: cur.diagnose.id, label: String(cur.diagnose.label || cur.diagnose.id) };
      if ((Array.isArray(cur.lock) && cur.lock.length) || (Array.isArray(cur.hidden) && cur.hidden.length)) { S.faultStart = cur.fstart && typeof cur.fstart === 'object' ? cur.fstart : null; applyLockHidden(cur.lock, cur.hidden); } else if (dice) buildFaultPanel();
    } else {
      setRig(ORDER[0]);
      if (!seenGet('w', 0)) { seenSet('w', 1); setTimeout(() => toast('Willkommen! Starte mit ▶ unten oder bewege einen Regler: Die Animation läuft dann los.'), 900); }
    }
    renderSweep(); setTab(S.tab); requestAnimationFrame(frame);
    root.addEventListener('load', () => { if (EXTHOST[S.tab]) renderExt(S.tab); });
    /* Aufrufparameter von Startseite, Lernpfad, Kampagne und Lernheften: ?aufgabe=ae1, ?ex=Name, ?bsp, ?neu */
    try {
      const q = new URLSearchParams(location.search), qa = q.get('aufgabe'), qe = q.get('ex');
      if (qa && (TK() || []).some(x => x.id === qa)) setTimeout(() => startTask(qa), 250);
      else if (qa) setTimeout(() => { if ((TK() || []).some(x => x.id === qa)) startTask(qa); else { setTab('tasks'); toast('Die Aufgabe ' + qa + ' ist noch nicht geladen.'); } }, 700);
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
