/* thmrig-vergleich.js - Thermik-Lab: Pruefstand 5 `vergleich` (SPEC 5.5): dasselbe Bauteil, dieselbe Verlustleistung, zwei oder drei Aufbauten nebeneinander.
 * Physik: THM_CORE (chain, steady, thermal mit exaktem Schritt, pzul, cfgFromControls, mountControls, diagnose, TEXTS). Der Pruefstand rechnet je Aufbau ein eigenes Netz
 * (Sperrschicht, Gehaeuse, Kuehlkoerper) in derselben Prozesszeit; es gibt hier weder Abschaltung noch Defekt, ein zu heisser Aufbau wird nur markiert.
 * Meldungen: je Aufbau THM_CORE.diagnose mit dem Vorsatz "Aufbau X: " (einzige Textquelle), dazu vergleich-paste, beruehr-pot, hinweis<i>, ding.
 * Zeichnen: eigene Zeichenroutinen (Schnittbild von unten nach oben, Waermebild, Ersatzschaltbild, Balken) ohne THM_DRAW (Gruende: quelle/thmlab/ABWEICHUNGEN.md, WP2c).
 * Alles ist in Pixeln der Zeichenflaeche gerechnet, Schrift mindestens 12 px, Zahlen immer zusaetzlich zur Farbe. Layout nach Flaeche: side (alle Aufbauten nebeneinander),
 * stack (untereinander), pager (ein Aufbau mit Reitern A, B, C, bei flachem Bild als breite Karte), mini (Karten). Schalter im Bild (hitTest), Zeiger (rig.pointer) fuer
 * Fadenkreuz und Wischen.
 * Schluesselkonvention: gemeinsame Steuerwerte device, pv, ta, n, from, fokus; je Aufbau X in a, b, c: heatsink_X, blechA_X, joint_X, paste_X, bushing_X, screw_X, ksPot_X, fan_X, orient_X.
 * Messgeraete je Aufbau mit Suffix _a, _b, _c (tj, tc, tk, rthTot, pzul, dtJC, dtCK, dtK, reserve, tau in min, groessterAbfall in K), gemeinsam pv, dTjAB, dTjBC (A - B), bestId (Index).
 */
(function (root) {
  'use strict';
  const R = root.THM_RIGS = root.THM_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===================================================================================================================
  //  Hilfsfunktionen
  // ===================================================================================================================
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const fin = (v) => typeof v === 'number' && isFinite(v);
  const num = (v, d) => {
    if (typeof v === 'string') { const s = v.trim().replace(',', '.'); v = s === '' ? NaN : +s; }
    else if (typeof v !== 'number') return d;
    return isFinite(v) ? v : d;
  };
  const pick = (r, keys, d) => {
    if (typeof r === 'number') return isFinite(r) ? r : d;
    if (r && typeof r === 'object') for (let i = 0; i < keys.length; i++) { const v = r[keys[i]]; if (typeof v === 'number' && isFinite(v)) return v; }
    return d;
  };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const safe = (fn, d) => { try { const v = fn(); return v === undefined ? d : v; } catch (e) { return d; } };

  const ID = 'vergleich';
  const LET = ['a', 'b', 'c'];
  const DEVICES = ['7805', 'lm317', 'bd139', 'irlz34n'];
  const MOUNT_KEYS = ['heatsink', 'blechA', 'joint', 'paste', 'bushing', 'screw', 'ksPot', 'fan', 'orient'];
  const OPT_SETS = { heatsink: ['none', 'fahne', 's', 'm', 'l', 'xl', 'blech'], joint: ['direkt', 'glimmer', 'silikon'], paste: ['keine', 'duenn', 'dick'], screw: ['fest', 'locker'], ksPot: ['masse', 'frei'], fan: ['aus', 'leise', 'mittel', 'stark'], orient: ['senkrecht', 'waagrecht'] };
  const TIME_SCALE = 30, TUNIT = 'min', H_STEP = 0.25;
  const MAX_FRAME_STEPS = 2000, MAX_PROC_STEPS = 2e6;
  const REC_EVERY = 16;                    // Kernschritte je Schreiberpunkt (4 s Prozesszeit)
  const BIG_DT = 1e8;                      // sehr grosser exakter Schritt = Beharrungszustand
  const G_COMMON = 'Bauteil und Umgebung';
  // Voreinstellung der Aufbauten (SPEC 5.5): A freistehend, B Profil mittel mit Glimmerscheibe ohne Paste, C wie B mit Paste
  const DEF = {
    a: { heatsink: 'none', blechA: 100, joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', ksPot: 'masse', fan: 'aus', orient: 'senkrecht' },
    b: { heatsink: 'm', blechA: 100, joint: 'glimmer', paste: 'keine', bushing: true, screw: 'fest', ksPot: 'masse', fan: 'aus', orient: 'senkrecht' },
    c: { heatsink: 'm', blechA: 100, joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', ksPot: 'masse', fan: 'aus', orient: 'senkrecht' }
  };
  // Kurznamen fuer Schalter im Bild (nur Anzeige)
  const SHORT = {
    heatsink: { none: 'frei', fahne: 'Fahne', s: 'klein', m: 'mittel', l: 'groß', xl: 'sehr groß', blech: 'Blech' },
    joint: { direkt: 'direkt', glimmer: 'Glimmer', silikon: 'Silikon' },
    paste: { keine: 'keine', duenn: 'dünn', dick: 'dick' },
    fan: { aus: 'aus', leise: 'leise', mittel: 'mittel', stark: 'stark' }
  };
  const CYCLE = { heatsink: ['none', 's', 'm', 'l', 'xl'], joint: ['direkt', 'glimmer', 'silikon'], paste: ['keine', 'duenn'], fan: ['aus', 'mittel', 'stark'] };

  function getCore() {
    let c = root.THM_CORE;
    if (!c && typeof require === 'function') { try { c = require('./thmcore.js'); } catch (e) { c = null; } }
    if (!c || typeof c.chain !== 'function' || typeof c.steady !== 'function' || typeof c.thermal !== 'function') throw new Error('THM_CORE (thmcore.js) ist nicht vollständig geladen.');
    return c;
  }
  // beim Laden: Kern nur fuer Texte und Steuerwert-Beschreibungen, ohne Fehler wenn er (noch) fehlt
  function tryCore() { try { return getCore(); } catch (e) { let c = root.THM_CORE; if (!c && typeof require === 'function') { try { c = require('./thmcore.js'); } catch (e2) { c = null; } } return c || null; } }
  const SYM_FB = { Tj: 'Tj', Tc: 'Tc', Tk: 'Tk', Ta: 'Ta', Rth_JC: 'Rth_JC', Rth_CK: 'Rth_CK', Rth_K: 'Rth_K', Rth_JA: 'Rth_JA', Rth_ges: 'Rth_ges', Pzul: 'P_zul', Tjmax: 'Tj,max', P: 'P', dT: 'ΔT', tau: 'τ', Cth: 'Cth' };
  function tplWith(core, s, set) {
    try { if (core && typeof core.tpl === 'function') { const r = core.tpl(s, set); if (typeof r === 'string') return r; } } catch (e) { /* Fallback */ }
    return String(s).replace(/\{sym:([A-Za-z_]+)\}/g, (_, k) => SYM_FB[k] || k);
  }

  // ===================================================================================================================
  //  Steuerwerte: Montage je Aufbau aus THM_CORE.mountControls() (einzige Quelle der Hilfetexte), Notfall-Fallback nur ohne Kern
  // ===================================================================================================================
  function fallbackMount() {
    const sel = (key, label, opts, value, help) => ({ key, label, type: 'select', value, options: opts.map(o => ({ value: o[0], label: o[1] })), help });
    return [
      sel('heatsink', 'Kühlkörper', [['none', 'ohne Kühlkörper'], ['fahne', 'Fahnenkühlkörper'], ['s', 'Profil klein'], ['m', 'Profil mittel'], ['l', 'Profil groß'], ['xl', 'Rippenkörper sehr groß'], ['blech', 'Kühlblech (Selbstbau)']], 'none', 'Der Kühlkörper führt die Wärme an die Luft ab.'),
      { key: 'blechA', label: 'Blechfläche (eine Seite)', type: 'slider', min: 10, max: 400, step: 5, unit: 'cm²', value: 100, help: 'Fläche einer Seite des Kühlbleches.' },
      sel('joint', 'Übergang', [['direkt', 'direkt'], ['glimmer', 'Glimmerscheibe'], ['silikon', 'Silikonfolie']], 'direkt', 'Der Übergang zwischen Gehäuse und Kühlkörper.'),
      sel('paste', 'Wärmeleitpaste', [['keine', 'keine Paste'], ['duenn', 'Paste dünn'], ['dick', 'Paste dick']], 'duenn', 'Die Wärmeleitpaste füllt Luftspalte.'),
      { key: 'bushing', label: 'Isolierbuchse', type: 'switch', value: true, help: 'Die Isolierbuchse isoliert die Schraube.' },
      sel('screw', 'Schraube', [['fest', 'Schraube fest'], ['locker', 'Schraube locker']], 'fest', 'Eine lockere Schraube verschlechtert den Übergang.'),
      sel('ksPot', 'Kühlkörper elektrisch', [['masse', 'Kühlkörper an Masse'], ['frei', 'Kühlkörper frei']], 'masse', 'Der Kühlkörper liegt an Gerätemasse oder frei.'),
      sel('fan', 'Lüfter', [['aus', 'Lüfter aus'], ['leise', 'Lüfter leise'], ['mittel', 'Lüfter mittel'], ['stark', 'Lüfter stark']], 'aus', 'Der Lüfter wirkt nur auf den Wärmewiderstand des Kühlkörpers.'),
      sel('orient', 'Einbaulage', [['senkrecht', 'Rippen senkrecht'], ['waagrecht', 'Rippen waagrecht']], 'senkrecht', 'Senkrechte Rippen kühlen besser.')
    ];
  }
  function mountDefs(core) {
    let list = null;
    try { const m = core && typeof core.mountControls === 'function' ? core.mountControls() : null; if (Array.isArray(m)) list = m; else if (m && typeof m === 'object') list = Object.keys(m).map(k => Object.assign({ key: k }, m[k])); } catch (e) { list = null; }
    const fb = {}; fallbackMount().forEach(c => { fb[c.key] = c; });
    const by = {};
    (list || []).forEach(c => { if (c && c.key) by[c.key] = c; });
    MOUNT_KEYS.forEach(k => {
      const c = by[k];
      const okSel = c && c.type === 'select' && Array.isArray(c.options) && c.options.filter(o => OPT_SETS[k].indexOf(o.value) >= 0).length === OPT_SETS[k].length;
      const okOther = c && (c.type === 'slider' || c.type === 'switch') && c.type === fb[k].type;
      if (!(okSel || okOther)) by[k] = fb[k];
    });
    return by;
  }
  // sichtbar je Aufbau (gleiche Regeln wie THM_CORE.mountControls, aber auf die Schluessel mit Suffix bezogen)
  function visFor(k, X) {
    const hs = (st) => (st ? st['heatsink_' + X] : undefined), jt = (st) => (st ? st['joint_' + X] : undefined);
    const on = (st) => X !== 'c' || !st || !st.n || st.n >= 3;
    if (k === 'heatsink') return (st) => on(st);
    if (k === 'blechA') return (st) => on(st) && hs(st) === 'blech';
    if (k === 'bushing') return (st) => on(st) && hs(st) !== 'none' && jt(st) !== 'direkt';
    return (st) => on(st) && hs(st) !== 'none';
  }
  function buildControls(core) {
    const by = mountDefs(core), out = [];
    const T = (s) => tplWith(core, s);
    const devName = (id) => safe(() => core.devices[id].name, null) || ({ '7805': 'TF-7805 (5 V, 1 A)', lm317: 'TF-LM317 (1,25…37 V, 1,5 A)', bd139: 'TF-BD139 (NPN, 1,5 A)', irlz34n: 'TF-IRLZ34N (55 V, Logic-Level)' })[id];
    out.push({ key: 'device', label: 'Bauteil', type: 'select', value: '7805', options: DEVICES.map(id => ({ value: id, label: devName(id) })), group: G_COMMON,
      help: T('Das Bauteil ist in allen Aufbauten dasselbe. Es legt {sym:Tjmax}, {sym:Rth_JC}, {sym:Rth_JA} und das Gehäuse fest. Beim Wechsel starten alle Aufbauten kalt.') });
    out.push({ key: 'pv', label: 'Verlustleistung', type: 'slider', scale: 'log', min: 0.1, max: 30, step: 0.1, unit: 'W', value: 3.5, group: G_COMMON,
      help: T('Die {sym:P} entsteht in jedem Aufbau gleich im Bauteil. Nur die Wärmekette dahinter unterscheidet sich.') });
    out.push({ key: 'ta', label: 'Umgebungstemperatur', type: 'slider', min: 0, max: 70, step: 1, unit: '°C', value: 25, group: G_COMMON,
      help: T('Die {sym:Ta} gilt für alle Aufbauten. Im Gerät ist es wärmer als im Raum.') });
    out.push({ key: 'n', label: 'Zahl der Aufbauten', type: 'select', value: 3, options: [{ value: 2, label: 'zwei (A und B)' }, { value: 3, label: 'drei (A, B und C)' }], group: G_COMMON,
      help: 'Wie viele Aufbauten nebeneinander laufen. Alle rechnen gleichzeitig in derselben Prozesszeit.' });
    out.push({ key: 'from', label: 'Aus Prüfstand übernehmen', type: 'button', value: false, group: G_COMMON,
      help: 'Übernimmt Bauteil, Verlustleistung, Umgebungstemperatur und Aufbau aus dem Prüfstand, den du zuletzt benutzt hast. Dein Aufbau wird Aufbau A.' });
    out.push({ key: 'fokus', label: 'Aufbau im Bild', type: 'select', value: 'a', options: [{ value: 'a', label: 'Aufbau A' }, { value: 'b', label: 'Aufbau B' }, { value: 'c', label: 'Aufbau C' }], group: 'Anzeige',
      help: 'Auf schmalen Bildschirmen zeigt das Bild einen Aufbau groß. Tippe oben im Bild auf A, B oder C oder wische zur Seite.', visible: (st) => !!st && st.layout === 'pager' });
    LET.forEach(X => {
      const L = X.toUpperCase();
      MOUNT_KEYS.forEach(k => {
        const d = by[k];
        const c = { key: k + '_' + X, label: String(d.label || k) + ' ' + L, type: d.type, value: DEF[X][k], group: 'Aufbau ' + L, help: String(d.help || ''), visible: visFor(k, X) };
        if (d.type === 'select') c.options = d.options.filter(o => OPT_SETS[k].indexOf(o.value) >= 0).map(o => ({ value: o.value, label: String(o.label), help: o.help || '', hint: o.hint || '' }));
        if (d.type === 'slider') { c.min = d.min; c.max = d.max; c.step = d.step; c.unit = d.unit; if (d.scale) c.scale = d.scale; }
        out.push(c);
      });
    });
    return out;
  }
  function buildMeters() {
    const out = [];
    const M = (key, label, unit, digits, min, max, extra) => out.push(Object.assign({ key, label, unit, digits, min, max }, extra || {}));
    M('pv', 'Verlustleistung', 'W', 1, 0, 30);
    LET.forEach(X => {
      const L = ' ' + X.toUpperCase();
      M('tj_' + X, 'Sperrschichttemperatur' + L, '°C', 1, 0, 200);
      M('tc_' + X, 'Gehäusetemperatur' + L, '°C', 1, 0, 200);
      M('tk_' + X, 'Kühlkörpertemperatur' + L, '°C', 1, 0, 200);
      M('rthTot_' + X, 'Wärmewiderstand gesamt' + L, 'K/W', 1, 0, 100);
      M('pzul_' + X, 'Zulässige Verlustleistung' + L, 'W', 1, 0, 50);
      M('dtJC_' + X, 'Abfall Sperrschicht–Gehäuse' + L, 'K', 1, 0, 200);
      M('dtCK_' + X, 'Abfall Gehäuse–Kühlkörper' + L, 'K', 1, 0, 200);
      M('dtK_' + X, 'Abfall Kühlkörper–Umgebung' + L, 'K', 1, 0, 200);
      M('reserve_' + X, 'Reserve bis zur Grenze' + L, 'K', 1, -100, 150);
      M('tau_' + X, 'Zeitkonstante' + L, TUNIT, 1, 0, 60);
      M('groessterAbfall_' + X, 'Größter Abfall' + L, 'K', 1, 0, 200);
    });
    M('dTjAB', 'Unterschied A − B', 'K', 1, -200, 200);
    M('dTjBC', 'Unterschied B − C', 'K', 1, -200, 200);
    M('bestId', 'Bester Aufbau (0 = A, 1 = B, 2 = C)', '', 0, 0, 2);
    return out;
  }
  const PRESETS = [
    { id: 'paste', name: 'Paste: ja, nein, frei', params: { controls: { device: '7805', pv: 3.5, ta: 25, n: 3 } } },
    { id: 'isolierung', name: 'Glimmer, Silikon, direkt', params: { controls: { device: '7805', pv: 3.5, ta: 25, n: 3, heatsink_a: 'm', joint_a: 'glimmer', paste_a: 'duenn', heatsink_b: 'm', joint_b: 'silikon', paste_b: 'keine', heatsink_c: 'm', joint_c: 'direkt', paste_c: 'duenn' } } },
    { id: 'kuehlkoerper', name: 'Kühlkörper klein, mittel, groß', params: { controls: { device: '7805', pv: 3.5, ta: 25, n: 3, heatsink_a: 's', joint_a: 'glimmer', paste_a: 'duenn', heatsink_b: 'm', joint_b: 'glimmer', paste_b: 'duenn', heatsink_c: 'l', joint_c: 'glimmer', paste_c: 'duenn' } } },
    { id: 'luefter', name: 'Lüfter aus, mittel, stark', params: { controls: { device: '7805', pv: 3.5, ta: 25, n: 3, heatsink_a: 'm', joint_a: 'glimmer', paste_a: 'duenn', fan_a: 'aus', heatsink_b: 'm', joint_b: 'glimmer', paste_b: 'duenn', fan_b: 'mittel', heatsink_c: 'm', joint_c: 'glimmer', paste_c: 'duenn', fan_c: 'stark' } } },
    { id: 'isolierscheibe7805', name: '7805: Isolierscheibe nötig? (Masse)', params: { controls: { device: '7805', pv: 3.5, ta: 25, n: 2, heatsink_a: 'm', joint_a: 'glimmer', paste_a: 'duenn', ksPot_a: 'masse', heatsink_b: 'm', joint_b: 'direkt', paste_b: 'duenn', ksPot_b: 'masse' } } }
  ];
  const INFO = 'Übungsanlage: Dasselbe Bauteil mit derselben Verlustleistung in zwei oder drei Aufbauten nebeneinander. Du siehst sofort, was Wärmeleitpaste, Glimmerscheibe, Kühlkörper und Lüfter jeweils bringen. Alle Aufbauten laufen gleichzeitig in derselben Prozesszeit. Eine Abschaltung oder einen Defekt gibt es hier nicht: Ein zu heißer Aufbau wird nur markiert.';

  // Meldungstexte der Anlage (nur was THM_CORE.TEXTS nicht hat); die Kernmeldungen kommen aus THM_CORE.diagnose, {sym:..} loest tpl() des Kerns auf, {name} fuellt fillTxt
  const TXT = {
    beruehrPot: 'Aufbau {L}: Der Kühlkörper liegt frei und ist {wie} mit der Fahne verbunden, die an {pot} liegt: Er führt dieses Potenzial. Isoliere ihn oder baue ihn berührgeschützt ein.',
    hinweis: 'Aufbau {L}: {note}',
    vglPaste: 'Mit Paste statt ohne ist {sym:Tj} in {wo} um {dt} K niedriger.',
    gruen: 'Aufbau {L} ist wieder im grünen Bereich.',
    neuesBauteil: 'Neues Bauteil: Alle Aufbauten starten kalt.',
    beharr: 'Beharrungszustand',
    beharrZusatz: ': Alle Aufbauten sind eingeschwungen.',
    keineQuelle: 'Es gibt noch keinen Prüfstand, aus dem du übernehmen kannst.',
    uebernommen: 'Bauteil, Verlustleistung, Umgebungstemperatur und Aufbau aus dem Prüfstand übernommen: Aufbau A ist dein bisheriger Aufbau.',
    ablehnen: 'Diesen Wert gibt es an dieser Anlage nicht.',
    zeitraffer: 'Zeitraffer gedrosselt'
  };
  const fillTxt = (core, s, v, set) => {
    let t = tplWith(core, s, set);
    t = t.replace(/\{(\w+)\}/g, (_, k) => (v && v[k] !== undefined ? String(v[k]) : '{' + k + '}'));
    return t;
  };

  const CORE0 = tryCore();
  const CONTROLS = buildControls(CORE0);
  const METERS = buildMeters();
  R.register({ id: ID, name: 'Vergleich (drei Aufbauten)', icon: '⚖️', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS, create(opts) { return createRig(opts || {}); } });

  // ===================================================================================================================
  //  Bausteine: Wertepruefung, Meldungsliste, Schreiberspeicher
  // ===================================================================================================================
  function coerce(def, value) {
    if (!def) return { ok: false };
    if (def.type === 'switch' || def.type === 'button') {
      if (typeof value === 'boolean') return { ok: true, v: value };
      if (value === 1 || value === 0) return { ok: true, v: value === 1 };
      if (value === 'true' || value === 'false') return { ok: true, v: value === 'true' };
      return { ok: false };
    }
    if (def.type === 'slider') {
      if (typeof value === 'boolean') return { ok: false };
      const n = num(value, NaN);
      return fin(n) ? { ok: true, v: clamp(n, def.min, def.max) } : { ok: false };
    }
    if (def.type === 'select') {
      const o = def.options.find(q => q.value === value || (typeof value !== 'object' && value !== null && typeof value !== 'boolean' && String(q.value) === String(value)));
      return o ? { ok: true, v: o.value } : { ok: false };
    }
    return { ok: false };
  }
  function makeEvents(max) {
    const list = [];
    return {
      list,
      add(t, text, kind, fx, x, y, quiet, id) {
        const e = { t: Math.round(t * 10) / 10, text, kind: kind || 'info' };
        if (id) e.id = id;
        if (fx) { e.fx = fx; e.x = x == null ? 500 : x; e.y = y == null ? 250 : y; }
        if (quiet) e.quiet = true;
        list.push(e);
        while (list.length > max) { const q = list.findIndex(v => v.quiet); list.splice(q >= 0 ? q : 0, 1); }
      },
      clear() { list.length = 0; }
    };
  }
  // Ringspeicher des Messschreibers: Spuren je Schluessel
  function makeTrace(cap, keys) {
    const T = new Float64Array(cap), A = {};
    keys.forEach(k => { A[k] = new Float64Array(cap); });
    let n = 0, head = 0;
    return {
      push(t, v) { T[head] = t; for (let i = 0; i < keys.length; i++) A[keys[i]][head] = v[keys[i]]; head = (head + 1) % cap; if (n < cap) n++; },
      clear() { n = 0; head = 0; },
      get(t0, maxPts) {
        const idx = [];
        for (let i = 0; i < n; i++) { const j = (head - n + i + 2 * cap) % cap; if (T[j] >= t0) idx.push(j); }
        const stride = idx.length > maxPts ? Math.ceil(idx.length / maxPts) : 1;
        const out = { t: [] }; keys.forEach(k => { out[k] = []; });
        const take = (j) => { out.t.push(T[j]); keys.forEach(k => out[k].push(A[k][j])); };
        for (let i = 0; i < idx.length; i += stride) take(idx[i]);
        if (idx.length && (idx.length - 1) % stride !== 0) take(idx[idx.length - 1]);
        return out;
      }
    };
  }

  // ===================================================================================================================
  //  Pruefstand
  // ===================================================================================================================
  function createRig(opts) {
    const CORE = getCore();
    let symSetV = opts.sym === 'de' || opts.sym === 'db' ? opts.sym : undefined;
    const sy = (k) => { const s = safe(() => CORE.sym(k, symSetV), ''); return typeof s === 'string' && s ? s : (SYM_FB[k] || k); };
    const fmt = (v, d) => { const s = safe(() => CORE.fmt(v, d), '–'); return typeof s === 'string' ? s : '–'; };
    const tx = (s, v) => fillTxt(CORE, s, v, symSetV);
    const rigText = (id, fb) => { const t = safe(() => CORE.TEXTS.rig[id], null); return typeof t === 'string' && t ? t : fb; };
    const defs = CONTROLS.map(c => Object.assign({}, c, c.options ? { options: c.options.map(o => Object.assign({}, o)) } : {}));
    const def = {}; defs.forEach(c => { def[c.key] = c; });
    const meters = METERS.map(m => Object.assign({}, m));
    const ctl = {}; defs.forEach(c => { ctl[c.key] = c.value; });
    const ev = makeEvents(120);
    const TKEYS = ['ta', 'p'].concat([].concat.apply([], LET.map(X => ['tj_' + X, 'tc_' + X, 'tk_' + X])));
    const tr = makeTrace(12000, TKEYS);
    const U = {};
    LET.forEach(X => { U[X] = { id: X, th: null, cfg: null, cfgKey: '', ch: null, tau: null, i63: null, ss: null }; });
    let S = null, D = null, dKey = '', rev = 0, fromInfo = null, view = 'schnitt', theme = 'dark', reduced = null, probe = null, swipe = null, lastStats = { particles: 0 };
    const fromProvider = typeof opts.from === 'function' ? opts.from : null;
    const say = (text, kind, fx, quiet, id, x, y) => ev.add(S ? S.t : 0, text, kind, fx, x, y, quiet, id);

    // ---------- Aufbau: cfg, Kette, Netz ----------
    function cfgFor(X) {
      const c = {}; MOUNT_KEYS.forEach(k => { c[k] = ctl[k + '_' + X]; });
      let cfg = safe(() => CORE.cfgFromControls(c, ctl.device), null);
      if (!cfg || cfg.ok === false || !cfg.device) {
        cfg = { device: ctl.device, heatsink: c.heatsink, joint: c.joint, paste: c.paste, bushing: c.bushing !== false, screw: c.screw, ksPot: c.ksPot, fan: c.fan, orient: c.orient, blech: { A_cm2: c.blechA, d_mm: 2, material: 'al' } };
      }
      cfg.count = 1;
      return cfg;
    }
    // Knotentemperaturen aus dem Netz (state() liefert Zahlen oder Felder); freistehend gibt es keinen Kuehlkoerper: Tk = Ta (wie THM_CORE.steady)
    function nodesOf(u) {
      const s = u.th ? safe(() => u.th.state(), null) : null;
      const one = (v) => Array.isArray(v) ? (v.length ? Math.max.apply(null, v) : NaN) : v;
      let tj = NaN, tc = NaN, tk = NaN;
      if (Array.isArray(s)) { tj = one(s[0]); tc = one(s[1]); tk = one(s[2]); }
      else if (s && typeof s === 'object') { tj = one(s.tj); tc = one(s.tc); tk = one(s.tk); }
      const ta = ctl.ta, frei = !!(u.ch && u.ch.mode === 'frei');
      const raw = fin(tj);
      if (!fin(tj)) tj = ta;
      if (!fin(tc)) tc = tj;
      if (frei) tk = ta; else if (!fin(tk)) tk = tc;
      return { tj, tc, tk, raw };
    }
    function bigStep(u, p) { safe(() => u.th.step(BIG_DT, p, ctl.ta)); }
    function coldOne(u) {
      safe(() => u.th.reset(ctl.ta));
      if (Math.abs(nodesOf(u).tj - ctl.ta) > 1e-9) bigStep(u, 0);
    }
    function settleOne(u) {
      if (typeof u.th.settle === 'function') safe(() => u.th.settle(ctl.pv, ctl.ta)); else bigStep(u, ctl.pv);
      const st = steadyOf(u);
      for (let i = 0; i < 40 && st && fin(st.tj) && Math.abs(nodesOf(u).tj - st.tj) > 1e-9 * Math.max(1, Math.abs(st.tj)); i++) safe(() => u.th.step(1e6, ctl.pv, ctl.ta));
    }
    function applyCfg(X, forceNew) {
      const u = U[X], cfg = cfgFor(X), key = JSON.stringify(cfg);
      if (!forceNew && key === u.cfgKey && u.ch && u.th) return true;
      const ch = CORE.chain(cfg);
      if (!ch || ch.ok === false) return false;
      const keep = u.th && !forceNew;
      u.cfg = cfg; u.cfgKey = key; u.ch = ch; u.tau = null; u.i63 = null; u.ss = null;
      if (keep) {
        let ok = true;
        try { const r = u.th.setCfg(cfg); if (r && r.ok === false) ok = false; } catch (e) { ok = false; }
        if (ok && !nodesOf(u).raw) ok = false;
        if (!ok) u.th = null;
      } else u.th = null;
      if (!u.th) { u.th = CORE.thermal(cfg); coldOne(u); }
      return true;
    }
    function steadyOf(u) {
      const key = u.cfgKey + '|' + ctl.pv + '|' + ctl.ta;
      if (u.ss && u.ss.key === key) return u.ss.v;
      let v = safe(() => CORE.steady(u.cfg, ctl.pv, ctl.ta), null);
      if (!v || v.ok === false || !fin(v.tj)) {
        const ch = u.ch, frei = ch.mode === 'frei', r3 = Math.max(0, ch.rthTotal - ch.rthJC - (frei ? 0 : ch.rthCK));
        v = { ok: true, tj: ctl.ta + ctl.pv * ch.rthTotal, tc: ctl.ta + ctl.pv * (ch.rthTotal - ch.rthJC), tk: frei ? ctl.ta : ctl.ta + ctl.pv * r3, steps: [] };
      }
      u.ss = { key, v };
      return v;
    }

    // ---------- abgeleitete Werte (ein Rechenstand je Schritt und Steuerwertstand) ----------
    function build() {
      const key = (S ? S.n : 0) + '|' + rev;
      if (D && dKey === key) return D;
      const ta = ctl.ta, pv = ctl.pv, n = ctl.n;
      const A = LET.map((X, i) => {
        const u = U[X], ch = u.ch, nd = nodesOf(u), frei = ch.mode === 'frei';
        const jc = ch.rthJC, ck = frei ? 0 : ch.rthCK, tot = ch.rthTotal, r3 = Math.max(0, tot - jc - ck);
        const ss = steadyOf(u);
        const tjMax = ch.tjMax;
        const dJC = nd.tj - nd.tc, dCK = frei ? 0 : nd.tc - nd.tk, dK = (frei ? nd.tc : nd.tk) - ta;
        if (u.tau === null) { const t = safe(() => u.th.tauDominant(), NaN); u.tau = fin(t) && t > 0 ? t : r3 * ((ch.cth.j || 0) + (ch.cth.c || 0) + (ch.cth.k || 0)); }
        const pz = pick(safe(() => CORE.pzul(u.cfg, ta), NaN), ['value', 'pzul', 'p'], 0);
        const mx = Math.max(jc, ck, r3), eq = (a) => Math.abs(a - mx) <= 1e-9 * Math.max(1, mx);
        const biggest = []; if (eq(jc)) biggest.push('JC'); if (!frei && eq(ck) && ck > 0) biggest.push('CK'); if (eq(r3)) biggest.push(frei ? 'CA' : 'K');
        const qj = jc > 1e-9 ? dJC / jc : pv, qc = ck > 1e-9 ? dCK / ck : pv, qk = r3 > 1e-9 ? dK / r3 : pv;
        return {
          id: X, i, L: X.toUpperCase(), active: i < n, cfg: u.cfg, ch, mode: ch.mode, frei, tj: nd.tj, tc: nd.tc, tk: nd.tk, ta, pv,
          rthJC: jc, rthCK: ck, rthK: r3, rthTotal: tot, dJC, dCK, dK, sum: nd.tj - ta, tjMax, reserve: tjMax - nd.tj, over: nd.tj > tjMax + 1e-9,
          pzul: pz, tau: u.tau, biggest, biggestDT: pv * mx, ss: { tj: ss.tj, tc: ss.tc, tk: ss.tk }, ssSum: pv * tot,
          q: { jc: qj, ck: qc, k: qk }, flow: clamp(pv > 0 ? qk / pv : 0, 0, 1.5), fanF: ch.fanF || 1, orientF: ch.orientF || 1, cth: ch.cth, faults: (ch.faults || []).map(f => typeof f === 'string' ? f : (f && f.id) || '').filter(Boolean)
        };
      });
      const act = A.filter(a => a.active);
      let best = act[0] || A[0];
      act.forEach(a => { if (a.tj < best.tj - 1e-9) best = a; });
      D = { A, act, best, dTjAB: A[0].tj - A[1].tj, dTjBC: ctl.n >= 3 ? A[1].tj - A[2].tj : 0, lo: ta, hi: A[0].tjMax + 30, tjMax: A[0].tjMax };
      dKey = key;
      return D;
    }
    const cl = (v) => (fin(v) ? v : 0);

    // ---------- Meldungen: je Aufbau THM_CORE.diagnose (einzige Textquelle, SPEC 4.8), davor "Aufbau X: "; Defekt gibt es hier nicht ----------
    function potOf(a) { return safe(() => a.ch.dev.tab.potText, '') || 'einem anderen Potenzial'; }
    function diagnose() {
      if (!S) return [];
      const d = build(), out = [], P = d.A[0].pv;
      const add = (base, X, kind, text, fx) => { const o = { id: base + '_' + X, base, aufbau: X, kind, text }; if (fx) o.fx = fx; out.push(o); };
      let taDone = false;
      d.act.forEach(a => {
        const L = a.L, list = safe(() => CORE.diagnose({ cfg: a.cfg, p: P, ta: ctl.ta, tj: a.tj, tc: a.tc, tk: a.tk, set: symSetV }), []);
        (Array.isArray(list) ? list : []).forEach(q => {
          if (!q || q.id === 'defekt') return;   // Abschaltung und Defekt gibt es im Vergleich nicht
          if (q.id === 'ta-hoch') { if (!taDone) { taDone = true; out.push({ id: 'ta-hoch', base: 'ta-hoch', aufbau: '', kind: q.kind, text: q.text }); } return; }
          add(q.id, a.id, q.kind, 'Aufbau ' + L + ': ' + q.text, q.fx);
        });
        // Beruehrhinweis ohne Zahl: Betriebsspannung ist hier nicht festgelegt, das Potenzial der Fahne aber schon (Uebungsdatenblatt)
        const viaScrew = a.cfg.joint !== 'direkt' && a.cfg.bushing === false, pot = safe(() => a.ch.dev.tab.pot, 'masse');
        if (!a.frei && a.cfg.ksPot === 'frei' && (a.cfg.joint === 'direkt' || viaScrew) && pot !== 'masse' && pot !== 'isoliert' && pot !== 'keine') add('beruehr-pot', a.id, 'warn', tx(TXT.beruehrPot, { L, pot: potOf(a), wie: viaScrew ? 'über die Schraube ohne Isolierbuchse' : 'direkt' }));
        (a.ch.notes || []).forEach((note, i) => add('hinweis' + i, a.id, 'info', tx(TXT.hinweis, { L, note })));
      });
      // Vergleich: nur wenn sich zwei Aufbauten nur in der Paste unterscheiden (keine gegen duenn), Zahl aus dem Beharrungszustand
      const same = (a, b) => ['device', 'heatsink', 'joint', 'bushing', 'screw', 'ksPot', 'fan', 'orient'].every(k => a.cfg[k] === b.cfg[k]) && (a.cfg.heatsink !== 'blech' || safe(() => a.cfg.blech.A_cm2 === b.cfg.blech.A_cm2, false));
      for (let i = 0; i < d.act.length; i++) for (let j = 0; j < d.act.length; j++) {
        const w = d.act[i], n0 = d.act[j];
        if (i === j || w.frei || n0.frei || !same(w, n0) || w.cfg.paste !== 'duenn' || n0.cfg.paste !== 'keine') continue;
        const x = n0.ss.tj - w.ss.tj;
        if (x > 1e-9) out.push({ id: 'vergleich-paste_' + w.id + n0.id, base: 'vergleich-paste', aufbau: w.id, kind: 'info', text: fillTxt(CORE, safe(() => CORE.TEXTS.diag['vergleich-paste'], TXT.vglPaste), { wo: 'Aufbau ' + w.L, dt: fmt(x, 1) }, symSetV) });
      }
      return out;
    }
    function evaluate() {
      if (!S) return;
      const list = diagnose(), now = {};
      list.forEach(q => {
        now[q.id] = 1;
        if (!S.act[q.id]) { const a = D && D.A[LET.indexOf(q.aufbau)]; say(q.text, q.kind, q.fx, false, q.id, a ? 170 + a.i * 330 : 500, 120); }
      });
      d3(list);
      S.act = Object.assign(now, S.thr ? { drossel: 1 } : {});
      S.lastDiag = list;
    }
    function d3(list) {   // zurueck im gruenen Bereich nach Eingriff: einmal je Lauf
      const hot = {}; list.forEach(q => { if (q.base === 'heiss') hot[q.aufbau] = true; });
      LET.forEach(X => {
        if (hot[X]) S.wasHot[X] = true;
        else if (S.wasHot[X] && !S.dingDone) { S.dingDone = true; S.wasHot[X] = false; say(tx(TXT.gruen, { L: X.toUpperCase() }), 'info', 'ding', false, 'ding'); }
        else S.wasHot[X] = false;
      });
    }

    // ---------- Zustand, Zeit, Schreiber ----------
    function spanDefault() {
      let s = 1800;
      LET.forEach((X, i) => { if (i >= ctl.n) return; const h = ctl['heatsink_' + X]; const q = h === 'none' || h === 'fahne' ? 1800 : (h === 'l' || h === 'xl') ? 7200 : 3600; if (q > s) s = q; });
      return s;
    }
    function record() {
      const rec = { ta: ctl.ta, p: ctl.pv };
      LET.forEach(X => { const nd = nodesOf(U[X]); rec['tj_' + X] = nd.tj; rec['tc_' + X] = nd.tc; rec['tk_' + X] = nd.tk; });
      tr.push(S.t, rec);
    }
    function initState() {
      S = { t: 0, n: 0, acc: 0, thr: false, act: {}, lastDiag: [], wasHot: { a: false, b: false, c: false }, dingDone: false };
      ev.clear(); tr.clear();
      LET.forEach(X => { applyCfg(X, true); });
      rev++; D = null;
      record();
    }
    function restartTrace() { tr.clear(); S.act = {}; S.wasHot = { a: false, b: false, c: false }; rev++; D = null; record(); }
    function coreStep() {
      const pv = ctl.pv, ta = ctl.ta;
      for (let i = 0; i < 3; i++) U[LET[i]].th.step(H_STEP, pv, ta);
      S.n++; S.t = S.n * H_STEP; D = null;
      if (S.n % REC_EVERY === 0) record();
      if (S.n % 40 === 0) evaluate();
    }
    function stepProcess(dtS) {
      dtS = num(dtS, 0); if (dtS <= 0) return 0;
      S.acc += dtS;
      let n = Math.floor(S.acc / H_STEP + 1e-9);
      if (n > MAX_PROC_STEPS) n = MAX_PROC_STEPS;
      S.acc -= n * H_STEP; if (S.acc < 1e-9) S.acc = 0;
      if (S.acc > H_STEP * 1e6) S.acc = 0;
      for (let i = 0; i < n; i++) coreStep();
      return n;
    }
    function step(dtMs) {
      dtMs = num(dtMs, 0); if (dtMs <= 0) return;
      let dtS = dtMs / 1000 * TIME_SCALE;
      if ((S.acc + dtS) / H_STEP > MAX_FRAME_STEPS) {
        dtS = Math.max(0, MAX_FRAME_STEPS * H_STEP - S.acc); S.thr = true;
        if (!S.act.drossel) { S.act.drossel = 1; say(rigText('zeitraffer', TXT.zeitraffer), 'info'); }
      } else if (S.thr) { S.thr = false; delete S.act.drossel; }
      stepProcess(dtS);
    }
    function settle() {
      LET.forEach(X => settleOne(U[X]));
      D = null; rev++; record(); say(rigText('beharrung', TXT.beharr) + TXT.beharrZusatz, 'info', 'tick', true); evaluate();
      return true;
    }
    function reset() { initState(); }

    // ---------- Steuerwerte ----------
    function resetControls() { defs.forEach(c => { ctl[c.key] = c.value; }); }
    function adopt(info) {
      if (!info || typeof info !== 'object') return false;
      const dev = String(info.device === undefined ? '' : info.device);
      if (DEVICES.indexOf(dev) >= 0) ctl.device = dev;
      const p = num(info.pv !== undefined ? info.pv : (info.P !== undefined ? info.P : info.p), NaN); if (fin(p)) ctl.pv = clamp(p, def.pv.min, def.pv.max);
      const t = num(info.ta, NaN); if (fin(t)) ctl.ta = clamp(t, def.ta.min, def.ta.max);
      const c = info.cfg && typeof info.cfg === 'object' ? info.cfg : null;
      if (c) {
        ['heatsink', 'joint', 'paste', 'screw', 'ksPot', 'fan', 'orient'].forEach(k => { const cc = coerce(def[k + '_a'], c[k]); if (cc.ok) ctl[k + '_a'] = cc.v; });
        if (c.bushing !== undefined) ctl.bushing_a = c.bushing !== false;
        const ba = num(c.blech && c.blech.A_cm2 !== undefined ? c.blech.A_cm2 : c.blechA, NaN); if (fin(ba)) ctl.blechA_a = clamp(ba, def.blechA_a.min, def.blechA_a.max);
      }
      LET.forEach(X => applyCfg(X, true));
      restartTrace(); say(TXT.uebernommen, 'info', 'tick', true);
      return true;
    }
    function setControl(key, value) {
      const d = def[key];
      if (!d) return false;
      const c = coerce(d, value);
      if (!c.ok) { if (d.type === 'select') say(rigText('wertAblehnen', TXT.ablehnen), 'warn', null, false, 'ablehnen'); return false; }
      const v = c.v;
      if (key === 'from') {
        if (!v) return true;
        let info = null; try { info = fromProvider ? fromProvider() : fromInfo; } catch (e) { info = null; }
        if (!info) { say(TXT.keineQuelle, 'warn', null, false, 'keine-quelle'); return false; }
        return adopt(info);
      }
      const old = ctl[key];
      ctl[key] = v;
      if (key === 'device') {
        LET.forEach(X => { applyCfg(X, true); });
        restartTrace(); say(TXT.neuesBauteil, 'info');
      } else if (/^[A-Za-z]+_[abc]$/.test(key)) {
        const X = key.slice(-1);
        if (!applyCfg(X, false)) { ctl[key] = old; applyCfg(X, false); say(rigText('wertAblehnen', TXT.ablehnen), 'warn', null, false, 'ablehnen'); return false; }
      }
      rev++; D = null; evaluate();
      return true;
    }
    const getControl = (key) => (def[key] ? (key === 'from' ? false : ctl[key]) : undefined);
    function applyPreset(id) {
      const p = PRESETS.find(q => q.id === id); if (!p) return false;
      resetControls();
      const cc = p.params.controls || {};
      Object.keys(cc).forEach(k => { const r = coerce(def[k], cc[k]); if (r.ok) ctl[k] = r.v; });
      initState();
      return true;
    }
    function setFrom(info) { fromInfo = info && typeof info === 'object' ? info : null; }

    // ---------- Messwerte, Zustand ----------
    function meterVals() {
      const d = build(), m = { pv: ctl.pv };
      d.A.forEach(a => {
        const X = a.id, on = a.active;
        m['tj_' + X] = on ? a.tj : 0; m['tc_' + X] = on ? a.tc : 0; m['tk_' + X] = on ? a.tk : 0;
        m['rthTot_' + X] = on ? a.rthTotal : 0; m['pzul_' + X] = on ? a.pzul : 0;
        m['dtJC_' + X] = on ? a.dJC : 0; m['dtCK_' + X] = on ? a.dCK : 0; m['dtK_' + X] = on ? a.dK : 0;
        m['reserve_' + X] = on ? a.reserve : 0; m['tau_' + X] = on ? a.tau / 60 : 0; m['groessterAbfall_' + X] = on ? a.biggestDT : 0;
      });
      m.dTjAB = d.dTjAB; m.dTjBC = d.dTjBC; m.bestId = LET.indexOf(d.best.id);
      return m;
    }
    function readMeters() { const m = meterVals(); Object.keys(m).forEach(k => { if (!fin(m[k])) m[k] = 0; }); fixMeterRanges(build()); return m; }
    function fixMeterRanges(d) {
      meters.forEach(m => {
        if (/^(tj|tc|tk)_/.test(m.key)) { m.min = d.lo; m.max = d.hi; if (m.key.slice(0, 2) === 'tj') m.warnAbove = d.tjMax; }
        else if (/^pzul_/.test(m.key)) m.max = Math.max(1, Math.ceil(d.A[0].pzul * 2));
      });
    }
    function state() {
      const d = build(), m = readMeters(), a0 = d.A[0], ids = diagnose().map(q => q.id);
      const s = {
        t: S.t, device: ctl.device, pv: ctl.pv, ta: ctl.ta, n: ctl.n, aufbauten: ctl.n,
        tj: a0.tj, tc: a0.tc, tk: a0.tk, rthJC: a0.rthJC, rthCK: a0.rthCK, rthK: a0.rthK, rthTotal: a0.rthTotal, dJC: a0.dJC, dCK: a0.dCK, dK: a0.dK,
        pzul: a0.pzul, mode: a0.mode, shutdown: false, shutCount: 0, destroyed: false, short: a0.faults.indexOf('kurzschluss') >= 0, tjMax: a0.tjMax, faults: ids, tau: a0.tau,
        dTjAB: d.dTjAB, dTjBC: d.dTjBC, bestId: d.best.id, bestIndex: LET.indexOf(d.best.id),
        timeScale: TIME_SCALE, tUnit: TUNIT, thr: S.thr, throttled: S.thr, view, layout: lastStats.mode || 'side', fokus: ctl.fokus, symSet: symSetV || safe(() => CORE.symSet(), 'db'),
        aufbau: {}
      };
      d.A.forEach(a => {
        const X = a.id;
        s.aufbau[X] = { id: X, active: a.active, mode: a.mode, tj: a.tj, tc: a.tc, tk: a.tk, ta: a.ta, rthJC: a.rthJC, rthCK: a.rthCK, rthK: a.rthK, rthTotal: a.rthTotal, dJC: a.dJC, dCK: a.dCK, dK: a.dK,
          sum: a.sum, pzul: a.pzul, reserve: a.reserve, over: a.over, tau: a.tau, tjMax: a.tjMax, groessterAbfall: a.biggest.slice(), groessterAbfallDT: a.biggestDT, short: a.faults.indexOf('kurzschluss') >= 0,
          tjSteady: a.ss.tj, tcSteady: a.ss.tc, tkSteady: a.ss.tk, faults: ids.filter(q => q.slice(-2) === '_' + X), chainFaults: a.faults.slice(), cfg: Object.assign({}, a.cfg) };
      });
      LET.forEach(X => { MOUNT_KEYS.forEach(k => { s[k + '_' + X] = ctl[k + '_' + X]; }); });
      Object.keys(m).forEach(k => { if (!(k in s)) s[k] = m[k]; });
      Object.keys(s).forEach(k => { if (typeof s[k] === 'number' && !fin(s[k])) s[k] = 0; });
      return s;
    }

    // ---------- Kennlinien (SPEC 5.5: vier Diagramme) ----------
    // Kennlinien nach dem Format der Oberflaeche: Reihen (series/marker/hlines) und Balken (kind 'bars' mit stacks, hline)
    function curves() {
      const d = build(), act = d.act, fm1 = (v) => +cl(v).toFixed(3), pk = PAL.dark;
      const cats = act.map(a => 'Aufbau ' + a.L);
      const col = { jc: sy('Rth_JC'), ck: sy('Rth_CK'), k: act.some(a => a.frei) ? sy('Rth_K') + ' bzw. ' + sy('Rth_CA') : sy('Rth_K') };
      const bars = (id, title, yLabel, yUnit, getters, hline) => Object.assign({
        id, kind: 'bars', title, xLabel: 'Aufbau', xUnit: '', yLabel, yUnit, categories: cats,
        stacks: ['jc', 'ck', 'k'].map((k, i) => ({ key: k, name: col[k], color: pk[k], values: act.map(a => fm1(getters[i](a))) })),
        marker: { x: 0, y: fm1(act[0].sum) }
      }, hline ? { hline: { y: fm1(hline.y), label: hline.label } } : {});
      const span = spanDefault(), g = tr.get(S.t - span, 240), ser = [];
      act.forEach(a => ser.push({ name: 'Aufbau ' + a.L, points: g.t.map((t, i) => [fm1(t / 60), fm1(g['tj_' + a.id][i])]) }));
      return [
        bars('abfaelle', 'Temperaturabfälle je Aufbau (gestapelt)', 'Temperaturabfall', 'K', [a => a.dJC, a => a.dCK, a => a.dK], { y: d.tjMax - ctl.ta, label: sy('Tjmax') + ' − ' + sy('Ta') }),
        { id: 'tjt', title: sy('Tj') + ' über der Prozesszeit (alle Aufbauten)', xLabel: 'Prozesszeit', xUnit: TUNIT, yLabel: sy('Tj'), yUnit: '°C', series: ser, hlines: [{ y: fm1(d.tjMax), label: sy('Tjmax'), color: pk.danger }], marker: { x: fm1(S.t / 60), y: fm1(act[0].tj) } },
        { id: 'pzul', kind: 'bars', title: 'Zulässige Verlustleistung je Aufbau', xLabel: 'Aufbau', xUnit: '', yLabel: sy('Pzul'), yUnit: 'W', categories: cats, stacks: [{ key: 'pzul', name: sy('Pzul'), color: pk.accent, values: act.map(a => fm1(a.pzul)) }], hline: { y: fm1(ctl.pv), label: sy('P') + ' = ' + fmt(ctl.pv, 1) + ' W' }, marker: { x: 0, y: fm1(act[0].pzul) } },
        bars('rth', sy('Rth_ges') + ' je Aufbau (gestapelt)', sy('Rth_ges'), 'K/W', [a => a.rthJC, a => a.rthCK, a => a.rthK], null)
      ];
    }
    function trace(spanS) {
      const sp = fin(spanS) && spanS > 0 ? spanS : spanDefault(), g = tr.get(S.t - sp, 600), d = build();
      const ex = {}; LET.forEach(X => { ex['tj_' + X] = g['tj_' + X]; ex['tc_' + X] = g['tc_' + X]; ex['tk_' + X] = g['tk_' + X]; });
      ex.tjMax = g.t.map(() => d.tjMax);
      return { t: g.t, tj: g.tj_a, tc: g.tc_a, tk: g.tk_a, ta: g.ta, p: g.p, extra: ex };
    }

    // ---------- Kennwerte fuer Tipps, Pruefung, Verbundadapter ----------
    function tau63Of(u) {
      if (u.i63 && u.i63.key === u.cfgKey) return u.i63.v;
      let v = NaN;
      try {
        const th = CORE.thermal(u.cfg); th.step(BIG_DT, 0, 0);
        const tot = u.ch.rthTotal, lev = (1 - Math.exp(-1)) * tot, tau = safe(() => th.tauDominant(), NaN);
        const dt = fin(tau) && tau > 0 ? Math.max(0.05, tau / 400) : 1;
        let t = 0, prev = 0;
        for (let i = 0; i < 6000; i++) {
          th.step(dt, 1, 0); t += dt;
          const s = th.state(), tj = Array.isArray(s) ? s[0] : s.tj;
          if (tj >= lev) { v = (t - dt) + dt * (lev - prev) / (tj - prev); break; }
          prev = tj;
        }
      } catch (e) { v = NaN; }
      u.i63 = { key: u.cfgKey, v };
      return v;
    }
    function identify() {
      const d = build(), per = {};
      LET.forEach((X, i) => {
        const u = U[X], a = d.A[i], th = safe(() => u.th.tauList, null);
        const tl = typeof th === 'function' ? safe(() => u.th.tauList(), null) : th;
        per[X] = { tau: a.tau, tau63: tau63Of(u), tauList: Array.isArray(tl) && tl.length ? tl.slice() : [a.tau], tjSteady: a.ss.tj, pzul: a.pzul, rthKerf: safe(() => CORE.rthKerf(u.cfg, ctl.pv, ctl.ta), null) };
      });
      return Object.assign({ aufbau: per }, per.a);
    }
    function analysis() {
      const d = build(), steps = [], result = {}, warn = [];
      d.act.forEach(a => {
        steps.push('Aufbau ' + a.L + ':');
        const st = steadyOf(U[a.id]);
        (Array.isArray(st.steps) ? st.steps : []).forEach(s => steps.push('  ' + s));
        result[a.id] = { tj: a.ss.tj, tc: a.ss.tc, tk: a.ss.tk, rthTotal: a.rthTotal, pzul: a.pzul, reserve: a.tjMax - a.ss.tj };
      });
      diagnose().forEach(q => warn.push(q.text));
      return { steps, result, warn };
    }
    const idx = (X) => { const i = typeof X === 'number' ? X : LET.indexOf(String(X || 'a').toLowerCase()); return i >= 0 && i < 3 ? i : 0; };
    function steadyPub(X) {
      const d = build(), i = idx(X), a = d.A[i], st = steadyOf(U[a.id]);
      const per = {}; d.A.forEach(b => { per[b.id] = { tj: b.ss.tj, tc: b.ss.tc, tk: b.ss.tk, rthTotal: b.rthTotal, dJC: ctl.pv * b.rthJC, dCK: ctl.pv * b.rthCK, dK: ctl.pv * b.rthK, sum: b.ssSum, pzul: b.pzul }; });
      return Object.assign({}, st, { tj: a.ss.tj, tc: a.ss.tc, tk: a.ss.tk, pv: ctl.pv, rthTotal: a.rthTotal, dJC: ctl.pv * a.rthJC, dCK: ctl.pv * a.rthCK, dK: ctl.pv * a.rthK, sum: a.ssSum, pzul: a.pzul, tjMax: a.tjMax, mode: a.mode, per });
    }
    const chainPub = (X) => U[LET[idx(X)]].ch;
    const cfgPub = (X) => Object.assign({}, U[LET[idx(X)]].cfg);
    function thermalInfo(X) {
      const a = build().A[idx(X)];
      return { P: ctl.pv, count: 1, rth: { jc: a.rthJC, ck: a.rthCK, k: a.frei ? 0 : a.rthK }, ta: ctl.ta, cth: { j: a.cth.j, c: a.cth.c, k: a.cth.k }, tjMax: a.tjMax, mode: a.mode };
    }
    // Zeiger fuer das Fadenkreuz im Waermebild (nur Anzeige): px, py in Pixeln der Zeichenflaeche
    function setProbe(px, py) { probe = fin(px) && fin(py) ? { x: px, y: py, down: !!(probe && probe.down) } : null; }
    // Zeiger der Oberflaeche (rig.pointer = { x, y, down }): Fadenkreuz im Waermebild; im schmalen Bild wechselt Wischen nach links oder rechts den Aufbau
    function setPointer(v) {
      if (!(v && typeof v === 'object' && fin(v.x) && fin(v.y))) { probe = null; swipe = null; return; }
      const prev = probe; probe = { x: v.x, y: v.y, down: !!v.down };
      if (!probe.down) { swipe = null; return; }
      if (!(prev && prev.down) || !swipe) { swipe = { x0: v.x, y0: v.y, done: false }; return; }
      if (swipe.done || lastStats.mode !== 'pager' || view === 'balken') return;
      const dx = v.x - swipe.x0, dy = v.y - swipe.y0;
      if (Math.abs(dx) > 70 && Math.abs(dx) > 1.6 * Math.abs(dy)) {
        swipe.done = true;
        const f = clamp(LET.indexOf(ctl.fokus) + (dx < 0 ? 1 : -1), 0, ctl.n - 1);
        if (LET[f] !== ctl.fokus) { ctl.fokus = LET[f]; rev++; D = null; }
      }
    }

    // ---------- Zeichnen ----------
    const env = () => ({
      CORE, sy, fmt, build, S, ctl, view, theme, reduced: reduced === null ? safe(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches, false) : !!reduced,
      probe, setProbe, spanDefault, focus: Math.max(0, LET.indexOf(ctl.fokus)), trace: tr, sym: symSetV, analogie: safe(() => CORE.analogie && typeof CORE.analogie.resolved === 'function' ? CORE.analogie.resolved(symSetV) : null, null)
    });
    function draw(ctx, w, h, tms, o) {
      if (!ctx || !fin(w) || !fin(h) || w <= 0 || h <= 0) return;
      const e = env(); if (o && typeof o === 'object') { if (o.theme) e.theme = o.theme; if (o.reduced !== undefined) e.reduced = !!o.reduced; }
      try { fixMeterRanges(build()); lastStats = renderFrame(ctx, w, h, num(tms, 0), e) || { particles: 0 }; } catch (er) { lastStats = { particles: 0, error: String(er && er.message || er) }; try { ctx.restore(); } catch (e2) { /* nichts */ } }
    }
    function hitTest(px, py, w, h) {
      if (!fin(px) || !fin(py) || !fin(w) || !fin(h) || w <= 0 || h <= 0) return null;
      try { return hitFor(px, py, w, h, env(), setProbe); } catch (e) { return null; }
    }
    // Breite des Bildbereichs: #cvw der Seite, sonst Fensterbreite; ohne beides Weltmass 1000 x h
    function containerW() {
      try { const el = typeof document !== 'undefined' && document.getElementById ? document.getElementById('cvw') : null; if (el && el.clientWidth > 0) return el.clientWidth; } catch (e) { /* weiter */ }
      try { const iw = root.innerWidth; if (fin(iw) && iw > 0) return iw - 24; } catch (e) { /* weiter */ }
      return 0;
    }
    function worldSize(cw) {
      cw = num(cw, 0); if (!(cw > 0)) cw = containerW();
      try { return sizeFor(cw, ctl.n, view); } catch (e) { return { w: 1000, h: 560 }; }
    }

    // ---------- Aufbau ----------
    LET.forEach(X => { applyCfg(X, true); });
    if (opts.controls && typeof opts.controls === 'object') Object.keys(opts.controls).forEach(k => { const r = coerce(def[k], opts.controls[k]); if (r.ok && k !== 'from') ctl[k] = r.v; });
    const pc = opts.params && opts.params.controls;
    if (pc && typeof pc === 'object') Object.keys(pc).forEach(k => { const r = coerce(def[k], pc[k]); if (r.ok && k !== 'from') ctl[k] = r.v; });
    initState();
    if (opts.preset) applyPreset(opts.preset);
    if (opts.view && ['schnitt', 'kamera', 'ersatz', 'balken'].indexOf(opts.view) >= 0) view = opts.view;
    if (opts.theme === 'light' || opts.theme === 'dark') theme = opts.theme;
    if (opts.reduced !== undefined) reduced = !!opts.reduced;

    const rig = {
      get id() { return ID; },
      get range() { const d = build(); return { lo: d.lo, hi: d.hi, unit: '°C', digits: 1 }; },
      get timeScale() { return TIME_SCALE; }, get tUnit() { return TUNIT; }, get h() { return H_STEP; },
      get presets() { return PRESETS; }, get params() { return { timeScale: TIME_SCALE, h: H_STEP, bigDt: BIG_DT }; }, get spanS() { return spanDefault(); },
      get view() { return view; }, set view(v) { if (['schnitt', 'kamera', 'ersatz', 'balken'].indexOf(v) >= 0) view = v; },
      get pointer() { return probe; }, set pointer(v) { setPointer(v); },
      get theme() { return theme; }, set theme(v) { if (v === 'light' || v === 'dark') theme = v; },
      get reduced() { return reduced; }, set reduced(v) { reduced = v === null || v === undefined ? null : !!v; },
      get symSet() { return symSetV || safe(() => CORE.symSet(), 'db'); }, set symSet(v) { if (v === 'db' || v === 'de') symSetV = v; },
      controls: defs, meters, events: ev.list,
      setControl, getControl, step, stepProcess, readMeters, state, draw, hitTest, curves, reset, worldSize, trace, diagnose, applyPreset,
      settle, steady: steadyPub, chain: chainPub, cfg: cfgPub, analysis, identify, thermalInfo, adopt, setFrom, setProbe,
      drawStats() { return lastStats; }
    };
    return rig;
  }

  // ===================================================================================================================
  //  Zeichnen: Farben, Zeichenhilfen (reine Pixelrechnung)
  // ===================================================================================================================
  const PAL = {
    dark: { bg: '#10151b', panel: '#1a212a', panel2: '#252e39', line: '#3a4654', fg: '#e8ecf0', mute: '#a0acb8', accent: '#4aa3ff', ok: '#52d870', warn: '#ffb340', danger: '#ff6b6b', jc: '#ff6b4a', ck: '#ffc233', k: '#38b6d8' },
    light: { bg: '#f3f5f8', panel: '#ffffff', panel2: '#e7ecf1', line: '#b8c2ce', fg: '#1a222b', mute: '#566473', accent: '#0b63c5', ok: '#137533', warn: '#9a5600', danger: '#c62828', jc: '#d03a24', ck: '#c98a00', k: '#2597bb' }
  };
  const SC = { txt: '#f2f6fa', dim: '#bcc8d4', halo: 'rgba(8,12,28,0.78)', jc: PAL.dark.jc, ck: PAL.dark.ck, k: PAL.dark.k };   // Schrift und Linien auf der Bildflaeche (immer dunkler Grund)
  // Falschfarbenpalette Waermebild: dunkelblau, violett, rot, orange, gelb, weiss (Helligkeit steigt gleichmaessig, keine Regenbogenpalette)
  // gleiche Stuetzstellen wie THM_DRAW.heatColor (einheitliche Optik im Lab, Test gegen THM_DRAW)
  const HEAT = [[0, 11, 26, 107], [0.15, 43, 26, 143], [0.30, 106, 26, 154], [0.45, 179, 33, 122], [0.55, 224, 57, 47], [0.70, 242, 107, 29], [0.82, 251, 176, 45], [0.92, 253, 231, 76], [1, 255, 255, 255]];
  function heatRGB(k) {
    k = clamp(fin(k) ? k : 0, 0, 1);
    for (let i = 1; i < HEAT.length; i++) {
      if (k <= HEAT[i][0]) { const a = HEAT[i - 1], b = HEAT[i], f = (k - a[0]) / (b[0] - a[0]); return [Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f), Math.round(a[3] + (b[3] - a[3]) * f)]; }
    }
    return [255, 255, 255];
  }
  const LUT = []; for (let i = 0; i < 256; i++) { const q = heatRGB(i / 255); LUT.push({ rgb: q, css: 'rgb(' + q[0] + ',' + q[1] + ',' + q[2] + ')' }); }
  const lutAt = (k) => LUT[(clamp(fin(k) ? k : 0, 0, 1) * 255 + 0.5) | 0];
  const heatCss = (k, a) => { const e = lutAt(k); return a == null || a >= 1 ? e.css : 'rgba(' + e.rgb[0] + ',' + e.rgb[1] + ',' + e.rgb[2] + ',' + (a < 0 ? 0 : a).toFixed(3) + ')'; };
  const lum = (rgb) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
  const hexRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  function mkG(ctx, w, h, tms, e, d) {
    return { c: ctx, w, h, t: tms / 1000, pal: PAL[e.theme] || PAL.dark, red: !!e.reduced, lo: d.lo, hi: d.hi, e, d, particles: 0 };
  }
  const kT = (g, T) => { const r = g.hi - g.lo; return r > 0 ? clamp((T - g.lo) / r, 0, 1) : 0; };
  const hc = (g, T, a) => heatCss(kT(g, T), a);
  const GC = new WeakMap();
  function cgrad(g, key, mk) {
    let m = GC.get(g.c);
    if (!m) { m = new Map(); GC.set(g.c, m); }
    let v = m.get(key);
    if (!v) { v = mk(); if (m.size > 400) m.clear(); m.set(key, v); }
    return v;
  }
  const rq = (v) => Math.round(v * 4);
  // senkrechter Verlauf von Temperatur Ta (bei y0) nach Tb (bei y1)
  function vgrad(g, x, y0, y1, Ta, Tb, alpha) {
    if (Math.abs(y1 - y0) < 0.5) return hc(g, (Ta + Tb) / 2, alpha);
    const c = g.c;
    return cgrad(g, 'v' + rq(x) + '|' + rq(y0) + '|' + rq(y1) + '|' + rq(Ta) + '|' + rq(Tb) + '|' + rq(g.lo) + '|' + rq(g.hi) + '|' + (alpha == null ? 1 : alpha), () => {
      const gr = c.createLinearGradient(x, y0, x, y1);
      for (let i = 0; i <= 4; i++) gr.addColorStop(i / 4, hc(g, Ta + (Tb - Ta) * i / 4, alpha));
      return gr;
    });
  }
  function hgrad(g, y, x0, x1, Ta, Tb, alpha) {
    if (Math.abs(x1 - x0) < 0.5) return hc(g, (Ta + Tb) / 2, alpha);
    const c = g.c;
    return cgrad(g, 'h' + rq(y) + '|' + rq(x0) + '|' + rq(x1) + '|' + rq(Ta) + '|' + rq(Tb) + '|' + rq(g.lo) + '|' + rq(g.hi) + '|' + (alpha == null ? 1 : alpha), () => {
      const gr = c.createLinearGradient(x0, y, x1, y);
      for (let i = 0; i <= 4; i++) gr.addColorStop(i / 4, hc(g, Ta + (Tb - Ta) * i / 4, alpha));
      return gr;
    });
  }
  // Weicher Hof: Radialverlauf, Temperatur faellt gaussfoermig von T0 (Mitte) auf Tamb (Rand)
  function halo(g, cx, cy, r, T0, Tamb, alpha) {
    if (!(r > 1)) return;
    const c = g.c;
    const gr = cgrad(g, 'r' + rq(cx) + '|' + rq(cy) + '|' + rq(r) + '|' + rq(T0) + '|' + rq(Tamb) + '|' + rq(g.lo) + '|' + rq(g.hi) + '|' + alpha, () => {
      const q = c.createRadialGradient(cx, cy, 0, cx, cy, r);
      for (let i = 0; i <= 6; i++) { const f = i / 6, T = Tamb + (T0 - Tamb) * Math.exp(-(f * f) * 3.2); q.addColorStop(f, hc(g, T, alpha * (1 - f * f * 0.9))); }
      return q;
    });
    c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
  }
  function rr(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
  }
  function tx(g, s, x, y, size, col, align, weight, haloCol) {
    const c = g.c; s = String(s);
    c.font = (weight || '600') + ' ' + size + 'px ' + FONT; c.textAlign = align || 'left'; c.textBaseline = 'middle';
    if (haloCol) { c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = haloCol; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }
  function fit(g, s, maxW, size, weight) {
    const c = g.c; s = String(s);
    c.font = (weight || '600') + ' ' + size + 'px ' + FONT;
    const m = (t) => (c.measureText ? c.measureText(t).width : t.length * size * 0.56);
    if (!(maxW > 0) || m(s) <= maxW) return s;
    let t = s;
    while (t.length > 1 && m(t + '…') > maxW) t = t.slice(0, -1);
    return t + '…';
  }
  function ln(c, x0, y0, x1, y1, col, lw, dash) {
    c.strokeStyle = col; c.lineWidth = lw; if (dash) c.setLineDash(dash);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    if (dash) c.setLineDash(NODASH);
  }
  const NODASH = [];
  // Platzierung von Beschriftungen: Mindestabstand, Grenzen, Reihenfolge bleibt erhalten
  function spread(ys, gap, lo, hi) {
    const n = ys.length, out = ys.slice();
    for (let pass = 0; pass < 4; pass++) {
      out[0] = Math.max(out[0], lo);
      for (let i = 1; i < n; i++) if (out[i] < out[i - 1] + gap) out[i] = out[i - 1] + gap;
      if (out[n - 1] > hi) { out[n - 1] = hi; for (let i = n - 2; i >= 0; i--) if (out[i] > out[i + 1] - gap) out[i] = out[i + 1] - gap; }
    }
    return out;
  }
  const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const optLabelCache = {};
  function optLabel(key, value) {
    const k = key + '|' + value;
    if (optLabelCache[k] !== undefined) return optLabelCache[k];
    const c = CONTROLS.find(q => q.key === key + '_a');
    const o = c && c.options ? c.options.find(q => q.value === value) : null;
    return (optLabelCache[k] = (o ? String(o.label) : String(value)).replace(/\s*\([^)]*\)/g, ''));
  }
  function cfgText(a) {
    if (a.frei) return 'freistehend, ohne Kühlkörper';
    const f = a.cfg, p = [optLabel('heatsink', f.heatsink)];
    p.push(optLabel('joint', f.joint) + (f.joint !== 'direkt' && f.bushing === false ? ' ohne Buchse' : ''));
    if (!(f.joint === 'silikon' && f.paste === 'keine')) p.push(optLabel('paste', f.paste));
    if (f.screw === 'locker') p.push(lowerFirst(optLabel('screw', 'locker')));
    if (f.fan !== 'aus') p.push(optLabel('fan', f.fan));
    if (f.orient === 'waagrecht') p.push(optLabel('orient', 'waagrecht'));
    if (f.heatsink === 'blech') p[0] += ' ' + fmtN(f.blech && f.blech.A_cm2, 0) + ' cm²';
    return p.join(' · ');
  }
  // Text in hoechstens maxLines Zeilen umbrechen (an ' · ' und Leerzeichen), letzte Zeile mit Auslassung
  function wrap(g, text, maxW, size, weight, maxLines) {
    const c = g.c; c.font = (weight || '600') + ' ' + size + 'px ' + FONT;
    const m = (t) => (c.measureText ? c.measureText(t).width : t.length * size * 0.56);
    const toks = String(text).split(' · '), lines = [];
    let cur = '';
    toks.forEach((tk, i) => {
      const cand = cur ? cur + ' · ' + tk : tk;
      if (!cur || m(cand) <= maxW) cur = cand; else { lines.push(cur); cur = tk; }
      if (i === toks.length - 1) lines.push(cur);
    });
    if (lines.length > maxLines) { const keep = lines.slice(0, maxLines - 1); keep.push(lines.slice(maxLines - 1).join(' · ')); return keep.map((t, i) => (m(t) > maxW ? fit(g, t, maxW, size, weight) : t)); }
    return lines.map(t => (m(t) > maxW ? fit(g, t, maxW, size, weight) : t));
  }
  const fmtN = (v, d) => (fin(+v) ? (+v).toFixed(d).replace('.', ',') : '–');

  // ===================================================================================================================
  //  Layout in Pixeln
  // ===================================================================================================================
  const LAYM = { pad: 10, gap: 10, cap: 24, bot: 46, minPW: 296, head: 50, headC: 36, chips: 46, table: 114, tableC: 72, tabs: 44, colL: 100, colR: 88 };
  const MINPH = 290;       // kleinste Kartenhoehe (kompakt: Kopf einzeilig, kein Schalterfeld, vier Zeilen Tafel; Bild mit Massstab ab 0,47)
  const STACKPH = 400;     // untereinander nur, wenn jede Karte bequem passt
  const MINPH_WIDE = 250;  // breite Karte (Bild links, Tafel rechts)
  const MINPH_ERS = 346, MINPH_ERS_WIDE = 290;   // Ersatzschaltbild: mehr Hoehe fuer drei Glieder mit Beschriftung
  const isWide = (r) => r.w >= 560 && r.w >= 1.7 * r.h;
  // Stufen nach verfuegbarer Hoehe: voll (Schalter + zweizeiliger Kopf + 7 Zeilen), mittel (ohne Schalter), kompakt
  function panelKind(rh, view) { const full = view === 'schnitt' ? 444 : 398; if (rh >= full) return 'full'; if (view === 'schnitt' && rh >= 398) return 'mid'; return 'compact'; }
  const bodyNat = (pw, cap) => 300 * Math.min(cap, (pw - 16 - LAYM.colL - LAYM.colR) / 150) + 14;
  function layoutFor(w, h, n, view, focus) {
    const m = LAYM, top = m.pad + m.cap, botH = view === 'balken' ? 0 : m.bot, availH = h - top - botH - m.pad;
    const out = { mode: 'mini', rects: [], order: [], cap: { x: m.pad, y: 6, w: w - 2 * m.pad, h: m.cap }, bottom: { x: m.pad, y: h - botH - 4, w: w - 2 * m.pad, h: botH }, chart: { x: m.pad, y: top, w: w - 2 * m.pad, h: Math.max(0, h - top - m.pad) } };
    for (let i = 0; i < n; i++) out.order.push(i);
    const need = view === 'ersatz' ? MINPH_ERS : MINPH, needW = view === 'ersatz' ? MINPH_ERS_WIDE : MINPH_WIDE;   // das Ersatzschaltbild braucht mehr Hoehe
    let pw = (w - 2 * m.pad - m.gap * (n - 1)) / n;
    if (pw >= m.minPW && availH >= need) {
      out.mode = 'side';
      for (let i = 0; i < n; i++) out.rects.push({ x: m.pad + i * (pw + m.gap), y: top, w: pw, h: availH });
      return out;
    }
    pw = w - 2 * m.pad;
    const ph = (availH - m.gap * (n - 1)) / n;
    if (pw >= m.minPW && ph >= STACKPH) {
      out.mode = 'stack';
      for (let i = 0; i < n; i++) out.rects.push({ x: m.pad, y: top + i * (ph + m.gap), w: pw, h: ph });
      return out;
    }
    // schmales Bild: ein Aufbau gross, oben Reiter A, B, C (Antippen oder Wischen)
    const phF = availH - m.tabs - 6;
    if (pw >= m.minPW && (phF >= need || (pw >= 560 && pw >= 1.7 * phF && phF >= needW))) {
      const f = clamp(Math.floor(num(focus, 0)), 0, n - 1), tw = (pw - m.gap * (n - 1)) / n;
      out.mode = 'pager'; out.focus = f; out.order = [f]; out.tabs = [];
      for (let i = 0; i < n; i++) out.tabs.push({ x: m.pad + i * (tw + m.gap), y: top, w: tw, h: m.tabs, i });
      out.rects.push({ x: m.pad, y: top + m.tabs + 6, w: pw, h: phF });
      return out;
    }
    // kleine Flaeche: Karten in einer Reihe oder untereinander
    const cw = (w - 2 * m.pad - m.gap * (n - 1)) / n;
    if (cw >= 104 && availH >= 150) for (let i = 0; i < n; i++) out.rects.push({ x: m.pad + i * (cw + m.gap), y: top, w: cw, h: availH });
    else { const chh = (availH - m.gap * (n - 1)) / n; for (let i = 0; i < n; i++) out.rects.push({ x: m.pad, y: top + i * (chh + m.gap), w: w - 2 * m.pad, h: Math.max(0, chh) }); }
    return out;
  }
  function parts(r, view) {
    const m = LAYM;
    if (isWide(r)) {   // breite Karte: Kopf oben, links das Bild, rechts Tafel und Schalter
      const head = { x: r.x + 8, y: r.y + 6, w: r.w - 16, h: m.headC }, tw = clamp(Math.round(r.w * 0.36), 270, 400), by = head.y + head.h + 4, bh = Math.max(0, r.y + r.h - 8 - by);
      const table = { x: r.x + r.w - 8 - tw, y: by, w: tw, h: m.table }, chips = view === 'schnitt' && bh >= m.table + 8 + 40 ? { x: table.x, y: by + m.table + 8, w: tw, h: 40 } : null;
      return { kind: 'wide', head, chips, table, body: { x: r.x + 8, y: by, w: r.w - 16 - tw - 8, h: bh } };
    }
    const kind = panelKind(r.h, view), comp = kind === 'compact', head = { x: r.x + 8, y: r.y + 6, w: r.w - 16, h: comp ? m.headC : m.head };
    let y = head.y + head.h + 2, chips = null;
    if (view === 'schnitt' && kind === 'full') { chips = { x: r.x + 8, y, w: r.w - 16, h: 40 }; y += m.chips; }
    const th = comp ? m.tableC : m.table, table = { x: r.x + 8, y: r.y + r.h - 8 - th, w: r.w - 16, h: th };
    return { kind, head, chips, table, body: { x: r.x + 8, y, w: r.w - 16, h: Math.max(0, table.y - y - 6) } };
  }
  // Weltmass fuer die Oberflaeche (Seitenverhaeltnis): ab Breite fuer drei Aufbauten nebeneinander 1000 x h, darunter ein Aufbau mit Reitern in Breite cw
  const minSideW = (n) => LAYM.minPW * n + 2 * LAYM.pad + LAYM.gap * (n - 1);
  function sizeFor(cw, n, view) {
    const m = LAYM, nn = n >= 3 ? 3 : 2, nat = (pw, cap) => 6 + m.head + 2 + m.chips + bodyNat(pw, cap) + 6 + m.table + 8;
    if (cw > 0 && cw < minSideW(nn)) {
      if (view === 'balken') return { w: Math.round(cw), h: Math.round(clamp(cw * 1.3, 430, 640)) };
      const pw = cw - 2 * m.pad;
      return { w: Math.round(cw), h: Math.round(m.pad + m.cap + m.tabs + 6 + nat(pw, 1.15) + m.bot + m.pad) };
    }
    const W = cw > 0 ? cw : 1000, pw = (W - 2 * m.pad - m.gap * (nn - 1)) / nn;
    if (view === 'balken') return { w: Math.round(W), h: Math.round(W * 0.56) };
    return { w: Math.round(W), h: Math.round(m.pad + m.cap + nat(pw, 1.3) + m.bot + m.pad) };
  }
  // Schalter im Bild: vier Felder je Aufbau (Kuehlkoerper, Isolierung, Paste, Luefter), Antippen schaltet weiter
  const CHIPS = [{ key: 'heatsink', title: 'Kühlkörper' }, { key: 'joint', title: 'Isolierung' }, { key: 'paste', title: 'Paste' }, { key: 'fan', title: 'Lüfter' }];
  function chipRects(r) {
    const gw = 4, w = (r.w - gw * 3) / 4;
    return CHIPS.map((c, i) => ({ key: c.key, title: c.title, x: r.x + i * (w + gw), y: r.y, w, h: r.h }));
  }
  function nextOf(key, cur) {
    const list = CYCLE[key], i = list.indexOf(cur);
    if (i < 0) return key === 'heatsink' ? 'm' : key === 'fan' ? 'mittel' : list[0];
    return list[(i + 1) % list.length];
  }
  function hitFor(px, py, w, h, e, setProbe) {
    const d = e.build(), n = e.ctl.n, view = e.view, lay = layoutFor(w, h, n, view, e.focus);
    if (view === 'balken' || lay.mode === 'mini') return null;
    if (lay.mode === 'pager') {
      for (let i = 0; i < lay.tabs.length; i++) { const q = lay.tabs[i]; if (px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h) return { key: 'fokus', kind: 'switch', to: LET[i], value: LET[i] }; }
    }
    for (let k = 0; k < lay.rects.length; k++) {
      const r = lay.rects[k], i = lay.order[k], pr = parts(r, view), a = d.A[i];
      if (view === 'schnitt' && pr.chips) {
        const cr = chipRects(pr.chips);
        for (let j = 0; j < cr.length; j++) {
          const q = cr[j];
          if (px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h) {
            if (a.frei && q.key !== 'heatsink') return null;
            const key = q.key + '_' + a.id, to = nextOf(q.key, e.ctl[key]);
            return { key, kind: 'switch', to, value: to };
          }
        }
      }
      if (view === 'kamera' && px >= pr.body.x && px <= pr.body.x + pr.body.w && py >= pr.body.y && py <= pr.body.y + pr.body.h) setProbe(px, py);
    }
    return null;
  }

  // ===================================================================================================================
  //  Schnittbild (Waermekette von unten nach oben: Chip, Gehaeuse, Uebergang, Kuehlkoerper, Luft)
  // ===================================================================================================================
  const FIN = {
    fahne: { n: 2, h: 34, t: 3, w: 56, baseT: 8 }, s: { n: 5, h: 62, t: 3, w: 96, baseT: 14 }, m: { n: 7, h: 92, t: 3.2, w: 118, baseT: 16 },
    l: { n: 9, h: 118, t: 3.4, w: 134, baseT: 18 }, xl: { n: 11, h: 140, t: 3.6, w: 148, baseT: 20 }
  };
  function finOf(cfg) {
    if (cfg.heatsink === 'blech') {
      const A = num(cfg.blech && cfg.blech.A_cm2, 100);
      return { n: 1, h: 40 + 100 * Math.sqrt(clamp((A - 10) / 390, 0, 1)), t: 7, w: 44, baseT: 14, sheet: true };
    }
    return FIN[cfg.heatsink] || FIN.m;
  }
  const YB = 196, TAB_X0 = 36, TAB_X1 = 114, SCREW_X = 102;
  function geomOf(a) {
    const G = { frei: a.frei };
    if (a.frei) { G.tabTop = 206; G.layers = []; G.yb = NaN; G.fin = null; G.tip = 40; G.baseTop = NaN; }
    else {
      const f = a.cfg, fin0 = finOf(f);
      G.fin = fin0; G.yb = YB; G.baseTop = YB - fin0.baseT; G.tip = G.baseTop - fin0.h;
      const iface = f.paste === 'duenn' ? { type: 'paste', t: 4.5, k: 0.5 } : f.paste === 'dick' ? { type: 'paste', t: 10, k: 0.5 } : { type: 'gap', t: 4, k: 3 };
      const L = [];
      if (f.joint === 'direkt') L.push(Object.assign({}, iface));
      else {
        const ins = { type: f.joint, t: f.joint === 'glimmer' ? 12 : 10, k: f.joint === 'glimmer' ? 0.9 : 1.2 };
        const soft = f.joint === 'silikon' && f.paste === 'keine';
        if (!soft) L.push(Object.assign({}, iface));
        L.push(ins);
        if (!soft) L.push(Object.assign({}, iface));
      }
      if (f.screw === 'locker') L.push({ type: 'gap', t: 4.5, k: 3 });
      let y = YB, W = 0; L.forEach(q => { W += q.t * q.k; });
      let acc = 0;
      L.forEach(q => { q.y0 = y; q.y1 = y + q.t; q.f0 = acc / W; acc += q.t * q.k; q.f1 = acc / W; y += q.t; });
      G.layers = L; G.tabTop = y;
    }
    G.tabBot = G.tabTop + 12; G.chipC = G.tabTop + 15;
    G.tipR = G.fin ? 1 / Math.cosh(0.5 + G.fin.h / 120) : 1;
    G.tTip = a.ta + (a.tk - a.ta) * G.tipR;
    return G;
  }
  // Isothermen: y(u) der Pegel im Profil (Chip, Fahne, Uebergang, Kuehlkoerper, Rippenspitze, Luft)
  function profileOf(a, G) {
    const p = [[G.chipC, a.tj], [G.tabTop, a.tc]];
    if (!a.frei) { p.push([G.yb, a.tk], [G.baseTop, a.tk], [G.tip, G.tTip], [Math.max(0, G.tip - 40), a.ta]); }
    else p.push([Math.max(0, G.tabTop - 130), a.ta]);
    return p;
  }
  function isoLevels(a) {
    const span = a.tj - a.ta, steps = [10, 20, 50, 100, 200];
    let step = 10; for (let i = 0; i < steps.length; i++) { step = steps[i]; if (span / step <= 14) break; }
    const out = [];
    for (let T = Math.ceil((a.ta + 1e-6) / step) * step; T < a.tj - 1e-6; T += step) out.push(T);
    return { step, levels: out };
  }
  function yAtT(p, T) {
    for (let i = 0; i + 1 < p.length; i++) { const a = p[i], b = p[i + 1]; if (T <= a[1] + 1e-9 && T >= b[1] - 1e-9) { const d = a[1] - b[1]; return d < 1e-9 ? a[0] : a[0] + (b[0] - a[0]) * (a[1] - T) / d; } }
    return NaN;
  }
  function plume(g, X, Y, s, a, G) {
    const c = g.c, q = a.q.k, out = Math.max(0, q);
    const n = out < 0.05 ? 0 : Math.round(clamp(4 + 14 * Math.sqrt(out), 0, 80));
    const x0 = a.frei ? 52 : 75 - (G.fin.w / 2), x1 = a.frei ? 98 : 75 + G.fin.w / 2;
    const yS = a.frei ? G.tabTop - 4 : G.tip + 6, yE = 4, waag = !a.frei && a.cfg.orient === 'waagrecht';
    const fanBoost = 1 + (1 - a.fanF) * 1.2;
    if (g.red || !n) {   // ruhige Ersatzdarstellung: feste Wellenlinien, Dichte nach abgefuehrter Leistung
      const m = out < 0.05 ? 0 : Math.min(5, 2 + Math.round(Math.sqrt(out)));
      c.lineWidth = 2; c.lineCap = 'round';
      for (let i = 0; i < m; i++) {
        const xm = x0 + (x1 - x0) * (i + 0.5) / m;
        c.strokeStyle = heatCss(0.4, 0.55); c.beginPath();
        for (let k = 0; k <= 10; k++) { const f = k / 10, xx = X(xm + Math.sin(f * 7 + i * 1.7) * 5 + (waag ? f * 24 : 0)), yy = Y(yS + (yE - yS) * f); if (!k) c.moveTo(xx, yy); else c.lineTo(xx, yy); }
        c.stroke();
      }
      return;
    }
    g.particles += n; g.pmax = Math.max(g.pmax || 0, n);
    const dur = 5.0 / (0.55 + 0.45 * Math.sqrt(out)) / fanBoost * (waag ? 1.3 : 1);
    for (let i = 0; i < n; i++) {
      const ph = hash(i * 3.1), p = ((g.t / dur) + ph) % 1, sx = hash(i * 7.7 + 1);
      const xx = x0 + (x1 - x0) * sx + Math.sin(p * 7 + ph * 6) * (4 + 6 * p) + (waag ? p * p * 34 : 0), yy = yS + (yE - yS) * p;
      const al = Math.sin(Math.PI * p) * 0.6, r = (2.2 + 3.6 * p) * Math.max(0.85, s);
      c.fillStyle = heatCss(0.26 + 0.42 * (1 - p) * Math.min(1, 0.4 + a.flow), clamp(al * 1.25, 0, 0.8));
      c.beginPath(); c.arc(X(xx), Y(yy), r, 0, TAU); c.fill();
    }
  }
  // Rauchfahne bei Tj > Tj,max (hoechstens 60 Partikel); bei ruhiger Darstellung drei feste Rauchballen
  function smoke(g, X, Y, s, a, G) {
    if (!a.over) return;
    const c = g.c, inten = clamp((a.tj - a.tjMax) / 40, 0.15, 1), x0 = TAB_X1 + 2, y0 = G.tabTop + 2;
    if (g.red) {
      for (let k = 0; k < 3; k++) { c.fillStyle = 'rgba(190,195,205,' + (0.34 - k * 0.07).toFixed(2) + ')'; c.beginPath(); c.arc(X(x0 + 8 + k * 14), Y(y0 - 18 - k * 30), (5 + k * 4) * s, 0, TAU); c.fill(); }
      return;
    }
    const n = Math.round(14 + 40 * inten); g.smokeN = Math.max(g.smokeN || 0, n);
    for (let i = 0; i < n; i++) {
      const ph = hash(i * 2.3 + 9), p = ((g.t / 3.2) + ph) % 1, xx = x0 + p * 40 + Math.sin(p * 6 + ph * 9) * 5, yy = y0 - p * 112, al = Math.sin(Math.PI * p) * 0.45 * (0.5 + inten * 0.5);
      c.fillStyle = 'rgba(190,195,205,' + al.toFixed(3) + ')'; c.beginPath(); c.arc(X(xx), Y(yy), (2 + 9 * p) * Math.max(0.8, s), 0, TAU); c.fill();
    }
  }
  function flowArrow(g, x, yFrom, yTo, P, alpha, speed) {
    const c = g.c, w = clamp(3 + 2.2 * Math.sqrt(Math.max(0, P)), 3, 16), len = yFrom - yTo;
    if (!(len > 4)) return;
    const hd = Math.min(len * 0.6, w * 1.7 + 4);
    c.save(); c.lineCap = 'butt';
    c.strokeStyle = 'rgba(8,12,28,0.55)'; c.lineWidth = w + 3; c.beginPath(); c.moveTo(x, yFrom); c.lineTo(x, yTo + hd * 0.7); c.stroke();
    c.setLineDash([w * 1.5, w * 1.0]); c.lineDashOffset = g.red ? 0 : -(g.t * speed);
    c.strokeStyle = 'rgba(255,255,255,' + clamp(alpha, 0, 1).toFixed(3) + ')'; c.lineWidth = w; c.beginPath(); c.moveTo(x, yFrom); c.lineTo(x, yTo + hd * 0.7); c.stroke();
    c.setLineDash(NODASH);
    c.fillStyle = 'rgba(8,12,28,0.55)'; c.beginPath(); c.moveTo(x, yTo - 1.5); c.lineTo(x - w * 0.95 - 2.5, yTo + hd + 1); c.lineTo(x + w * 0.95 + 2.5, yTo + hd + 1); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,' + clamp(alpha + 0.1, 0, 1).toFixed(3) + ')'; c.beginPath(); c.moveTo(x, yTo); c.lineTo(x - w * 0.95, yTo + hd); c.lineTo(x + w * 0.95, yTo + hd); c.closePath(); c.fill();
    c.restore();
  }
  function fanWheel(g, cx, cy, r, level, rot) {
    const c = g.c;
    c.beginPath(); c.arc(cx, cy, r + 4, 0, TAU); c.fillStyle = 'rgba(8,12,28,0.6)'; c.fill(); c.strokeStyle = 'rgba(200,215,230,0.7)'; c.lineWidth = 1.5; c.stroke();
    c.save(); c.translate(cx, cy); c.rotate(rot);
    c.fillStyle = 'rgba(190,210,230,0.9)';
    for (let i = 0; i < 5; i++) { c.rotate(TAU / 5); c.beginPath(); c.ellipse(r * 0.55, 0, r * 0.5, r * 0.2, 0.35, 0, TAU); c.fill(); }
    c.restore();
    c.beginPath(); c.arc(cx, cy, 3, 0, TAU); c.fillStyle = '#0c1424'; c.fill();
  }

  function cutScene(g, b, a) {
    const c = g.c, G = geomOf(a), d = g.d;
    c.save(); rr(c, b.x, b.y, b.w, b.h, 10); c.clip();
    c.fillStyle = cgrad(g, 'bg|' + rq(b.y) + '|' + rq(b.h) + '|' + rq(g.lo) + '|' + rq(g.hi), () => { const gr = c.createLinearGradient(0, b.y, 0, b.y + b.h); gr.addColorStop(0, hc(g, g.lo)); gr.addColorStop(1, hc(g, g.lo + (g.hi - g.lo) * 0.08)); return gr; });
    c.fillRect(b.x, b.y, b.w, b.h);
    const gw = b.w - LAYM.colL - LAYM.colR, s = Math.min(1.3, gw / 150, (b.h - 14) / 300);
    if (!(s >= 0.45)) { tx(g, 'Bild zu klein', b.x + b.w / 2, b.y + b.h / 2, 13, SC.dim, 'center'); c.restore(); return; }
    const ox = b.x + LAYM.colL + (gw - 150 * s) / 2, oy = b.y + (b.h - 300 * s) / 2;
    const X = (u) => ox + u * s, Y = (u) => oy + u * s;
    const frei = a.frei, tabW0 = X(TAB_X0), tabW = (TAB_X1 - TAB_X0) * s;
    // warme Luft um den Kuehlkoerper bzw. das Gehaeuse
    if (!frei) halo(g, X(75), Y((G.tip + G.baseTop) / 2), 96 * s, a.ta + (a.tk - a.ta) * 0.5, a.ta, 0.55);
    else halo(g, X(75), Y(G.tabTop - 20), 80 * s, a.ta + (a.tc - a.ta) * 0.4, a.ta, 0.55);
    // Isothermen (alle 10 K, bei vielen Linien gröber), Zahlen an jeder zweiten Linie
    const prof = profileOf(a, G), mono = prof.every((p, i) => i === 0 || p[1] <= prof[i - 1][1] + 1e-9);
    const iso = mono ? isoLevels(a) : { step: 10, levels: [] };
    let lastLab = -1e9;
    iso.levels.forEach(T => {
      const yu = yAtT(prof, T); if (!fin(yu)) return;
      ln(c, X(2), Y(yu), X(148), Y(yu), 'rgba(255,255,255,0.40)', 1, [4, 4]);
      if (Math.round(T / iso.step) % 2 === 0 && Math.abs(Y(yu) - lastLab) >= 15) { lastLab = Y(yu); tx(g, fmtN(T, 0) + ' °C', X(148), Y(yu) - 7, 12, SC.txt, 'right', '600', SC.halo); }
    });
    // Kuehlkoerper: Grundplatte und Rippen (Falschfarben nach Temperatur, Fuss Tk, Spitze nach Rippenprofil)
    if (!frei) {
      const f = G.fin, bx0 = X(75 - f.w / 2), bw = f.w * s;
      c.fillStyle = vgrad(g, X(75), Y(G.baseTop - f.h), Y(G.baseTop), G.tTip, a.tk);
      c.beginPath();
      if (f.sheet) c.rect(X(75 - f.t / 2), Y(G.baseTop - f.h), f.t * s, f.h * s + 1);
      else if (a.cfg.orient === 'waagrecht') {
        const gap = f.h / (f.n + 0.5);
        for (let i = 0; i < f.n; i++) c.rect(bx0 + bw * 0.08, Y(G.baseTop - gap * (i + 0.6) - f.t * 0.5), bw * 0.84, f.t * s);
      } else {
        for (let i = 0; i < f.n; i++) c.rect(bx0 + (bw - f.t * s) * i / (f.n - 1), Y(G.baseTop - f.h), f.t * s, f.h * s + 1);
      }
      c.fill(); c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.2; c.stroke();
      c.fillStyle = hc(g, a.tk); rr(c, bx0, Y(G.baseTop), bw, f.baseT * s, 3); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.2; rr(c, bx0, Y(G.baseTop), bw, f.baseT * s, 3); c.stroke();
      // Schraffur der Grundplatte (Material ist nicht allein an der Farbe erkennbar)
      c.save(); rr(c, bx0, Y(G.baseTop), bw, f.baseT * s, 3); c.clip(); c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1;
      for (let x = bx0 - f.baseT * s; x < bx0 + bw; x += 9) { c.beginPath(); c.moveTo(x, Y(G.yb)); c.lineTo(x + f.baseT * s, Y(G.baseTop)); c.stroke(); }
      c.restore();
    }
    // Uebergang: Schichten von der Grundplatte nach unten
    G.layers.forEach(L => {
      const y0 = Y(L.y0), y1 = Y(L.y1), wide = L.type === 'glimmer' || L.type === 'silikon' ? 4 : 1, x0 = tabW0 - wide * s, ww = tabW + 2 * wide * s;
      const Tu = a.tk + (a.tc - a.tk) * L.f0, Tl = a.tk + (a.tc - a.tk) * L.f1;
      c.fillStyle = vgrad(g, X(75), y0, y1, Tu, Tl); c.fillRect(x0, y0, ww, Math.max(1, y1 - y0));
      if (L.type === 'paste') {
        c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(x0, y0, ww, 1.2);
        if (a.cfg.paste === 'dick') { c.fillStyle = hc(g, (Tu + Tl) / 2); c.beginPath(); c.ellipse(x0 - 1, (y0 + y1) / 2, 4 * s, (y1 - y0) * 0.6, 0, 0, TAU); c.ellipse(x0 + ww + 1, (y0 + y1) / 2, 4 * s, (y1 - y0) * 0.6, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1; c.stroke(); }
      } else if (L.type === 'gap') {   // Luftspalt: gezackte Rauheit
        c.fillStyle = 'rgba(14,20,44,0.9)'; c.beginPath(); c.moveTo(x0, y0);
        const st = 5 * s; for (let x = x0, k = 0; x < x0 + ww; x += st, k++) { c.lineTo(Math.min(x + st / 2, x0 + ww), k % 2 ? y0 : y1); c.lineTo(Math.min(x + st, x0 + ww), y0); }
        c.lineTo(x0 + ww, y0); c.closePath(); c.fill();
      } else if (L.type === 'glimmer') {
        c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1; for (let k = 1; k < 4; k++) { const yy = y0 + (y1 - y0) * k / 4; c.beginPath(); c.moveTo(x0 + 2, yy); c.lineTo(x0 + ww - 2, yy); c.stroke(); }
      } else if (L.type === 'silikon') {
        c.fillStyle = 'rgba(255,255,255,0.45)'; for (let x = x0 + 4; x < x0 + ww - 2; x += 7) { c.beginPath(); c.arc(x, (y0 + y1) / 2, 1.1, 0, TAU); c.fill(); }
      }
      if (L.type === 'glimmer' || L.type === 'silikon') { c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1; c.strokeRect(x0, y0, ww, Math.max(1, y1 - y0)); }
    });
    // Gehaeuse: Fahne (Kupfer), Kunststoffkoerper, Chip, Anschlussbeine
    const yT = Y(G.tabTop), yTb = Y(G.tabBot);
    c.fillStyle = vgrad(g, X(75), yTb, yT, a.tj, a.tc); c.fillRect(tabW0, yT, tabW, yTb - yT);
    c.strokeStyle = 'rgba(255,255,255,0.65)'; c.lineWidth = 1.5; c.strokeRect(tabW0, yT, tabW, yTb - yT);
    const bw0 = X(44), bw1 = X(92), byT = yTb, byB = Y(G.tabBot + 30);
    c.fillStyle = vgrad(g, X(60), byT, byB, a.tj, (a.tj + a.tc) / 2); rr(c, bw0, byT, bw1 - bw0, byB - byT, 3); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.2; rr(c, bw0, byT, bw1 - bw0, byB - byT, 3); c.stroke();
    halo(g, X(68), Y(G.chipC), 26 * s, a.tj, (a.tj + a.tc) / 2, 0.7);
    c.fillStyle = hc(g, a.tj); c.fillRect(X(56), Y(G.tabBot), 24 * s, 6 * s);
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.2; c.strokeRect(X(56), Y(G.tabBot), 24 * s, 6 * s);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(X(58), Y(G.tabBot + 6)); c.lineTo(X(78), Y(G.tabBot)); c.moveTo(X(62), Y(G.tabBot + 6)); c.lineTo(X(76), Y(G.tabBot)); c.stroke();
    c.strokeStyle = 'rgba(190,200,215,0.9)'; c.lineWidth = 2; [54, 68, 82].forEach(lx => { c.beginPath(); c.moveTo(X(lx), byB); c.lineTo(X(lx), Y(G.tabBot + 50)); c.stroke(); });
    // Schraube, Isolierbuchse, Spalt bei lockerer Schraube
    if (!frei) {
      const lock = a.cfg.screw === 'locker', dy = lock ? 5 : 0, sx = X(SCREW_X), top = Y(G.yb - 6), bot = Y(G.tabBot + 4 + dy);
      if (a.cfg.joint !== 'direkt' && a.cfg.bushing !== false) {   // Isolierbuchse als Huelse
        c.fillStyle = 'rgba(120,200,255,0.9)'; c.fillRect(sx - 4.5 * s, Y(G.layers[0].y0 - 0.5), 9 * s, Y(G.tabBot) - Y(G.layers[0].y0) + 1);
        c.strokeStyle = '#ffffff'; c.lineWidth = 1; c.strokeRect(sx - 4.5 * s, Y(G.layers[0].y0 - 0.5), 9 * s, Y(G.tabBot) - Y(G.layers[0].y0) + 1);
        c.fillRect(sx - 7.5 * s, Y(G.tabBot) - 1, 15 * s, 2.5 * s);
      }
      c.fillStyle = 'rgba(205,215,230,0.95)'; c.fillRect(sx - 2 * s, top, 4 * s, bot - top);
      c.fillStyle = 'rgba(160,172,190,1)'; rr(c, sx - 6.5 * s, bot, 13 * s, 5 * s, 1.5); c.fill(); c.strokeStyle = '#0c1424'; c.lineWidth = 1; c.stroke();
      if (lock) { c.strokeStyle = '#ffd0d0'; c.lineWidth = 1.5; c.setLineDash([3, 2]); c.beginPath(); c.moveTo(sx - 9 * s, Y(G.tabBot + 2)); c.lineTo(sx + 9 * s, Y(G.tabBot + 2)); c.stroke(); c.setLineDash(NODASH); }
      if (a.faults.indexOf('kurzschluss') >= 0 && !g.red) {   // Funken am Kuehlkoerper
        for (let i = 0; i < 6; i++) { const ph = (g.t * 6 + i * 0.37) % 1, ang = hash(i * 5.3) * TAU, rr0 = 5 + ph * 16; c.strokeStyle = 'rgba(255,230,120,' + (1 - ph).toFixed(2) + ')'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx + Math.cos(ang) * 3, Y(G.tabTop) + Math.sin(ang) * 3); c.lineTo(sx + Math.cos(ang) * rr0, Y(G.tabTop) + Math.sin(ang) * rr0); c.stroke(); }
      }
    }
    // Rippen-Lueftung, Waermefluss-Pfeile, Konvektion
    plume(g, X, Y, s, a, G); smoke(g, X, Y, s, a, G);
    if (!frei && a.cfg.fan !== 'aus') {
      const fcx = b.x + 54, fcy = Y((G.tip + G.baseTop) / 2 + 6), lv = { leise: 2.5, mittel: 5, stark: 8 }[a.cfg.fan] || 0;
      fanWheel(g, fcx, fcy, 14, lv, g.red ? 0.4 : g.t * lv);
      for (let k = -1; k <= 1; k++) { const yy = fcy + k * 13; c.strokeStyle = 'rgba(190,225,255,0.8)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(fcx + 20, yy); c.lineTo(X(2) - 2, yy); c.stroke(); c.fillStyle = 'rgba(190,225,255,0.9)'; c.beginPath(); c.moveTo(X(2) + 3, yy); c.lineTo(X(2) - 4, yy - 3.5); c.lineTo(X(2) - 4, yy + 3.5); c.closePath(); c.fill(); }
      tx(g, '×' + fmtN(a.fanF, 2), fcx, fcy - 27, 12, SC.txt, 'center', '700', SC.halo);
    }
    const P = a.pv, xa = X(75);
    const al = (q) => 0.30 + 0.65 * clamp(P > 0 ? q / P : 0, 0, 1), sp = 18 + 7 * Math.sqrt(Math.max(P, 0));
    flowArrow(g, xa, Y(G.chipC), Y(G.tabTop) - 1, P, al(a.q.jc), sp);
    if (!frei) {
      flowArrow(g, xa, Y(G.tabTop), Y(G.yb), P, al(a.q.ck), sp);
      flowArrow(g, xa, Y(G.baseTop), Y(Math.max(8, G.tip - 22)), P, al(a.q.k), sp);
    } else flowArrow(g, xa, Y(G.tabTop - 2), Y(G.tabTop - 70), P, al(a.q.k), sp);
    // Knoten und Beschriftung links: Zahlen zusaetzlich zur Farbe
    const nodes = frei ? [['Ta', a.ta, 8], ['Tc', a.tc, G.tabTop], ['Tj', a.tj, G.chipC]] : [['Ta', a.ta, 8], ['Tk', a.tk, G.yb], ['Tc', a.tc, G.tabTop], ['Tj', a.tj, G.chipC]];
    const ly = spread(nodes.map(q => Y(q[2])), 19, b.y + 14, b.y + b.h - 14);
    nodes.forEach((q, i) => {
      ln(c, b.x + LAYM.colL - 6, ly[i], X(6), Y(q[2]), 'rgba(255,255,255,0.45)', 1, [3, 3]);
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(X(6), Y(q[2]), 3.2, 0, TAU); c.fill();
      tx(g, g.e.sy(q[0]) + ' ' + fmtN(q[1], 1) + ' °C', b.x + 30, ly[i], 12, SC.txt, 'left', '700', SC.halo);
    });
    // Klammern rechts: Glieder der Kette mit Wert und Abfall
    const xb = X(150) + 8, labX = xb + 12, labW = b.x + b.w - labX - 4;
    const mem = frei
      ? [[g.e.sy('Rth_CA'), SC.k, a.rthK, a.dK, G.tabTop, 6, true], ['', '', 0, 0, 0, 0, false], [g.e.sy('Rth_JC'), SC.jc, a.rthJC, a.dJC, G.chipC, G.tabTop, true]]
      : [[g.e.sy('Rth_K'), SC.k, a.rthK, a.dK, G.yb, 6, true], [g.e.sy('Rth_CK'), SC.ck, a.rthCK, a.dCK, G.tabTop, G.yb, true], [g.e.sy('Rth_JC'), SC.jc, a.rthJC, a.dJC, G.chipC, G.tabTop, true]];
    const list = mem.filter(m => m[6]);
    const my = spread(list.map(m => Y((m[4] + m[5]) / 2)), 47, b.y + 26, b.y + b.h - 26);
    list.forEach((m, i) => {
      const yTop = Y(m[5]), yBot = Y(m[4]);
      c.strokeStyle = m[1]; c.lineWidth = 2; c.beginPath(); c.moveTo(xb - 3, yTop); c.lineTo(xb, yTop); c.lineTo(xb, yBot); c.lineTo(xb - 3, yBot); c.stroke();
      ln(c, xb, (yTop + yBot) / 2, labX - 3, my[i], m[1], 1, [3, 2]);
      tx(g, fit(g, m[0], labW, 13, '700'), labX, my[i] - 14, 13, m[1], 'left', '700', SC.halo);
      tx(g, fmtN(m[2], 1) + ' K/W', labX, my[i], 12, SC.txt, 'left', '600', SC.halo);
      tx(g, g.e.sy('dT') + ' ' + fmtN(m[3], 1) + ' K', labX, my[i] + 14, 12, SC.txt, 'left', '600', SC.halo);
    });
    // Verlust unter dem Gehaeuse
    tx(g, g.e.sy('P') + ' = ' + fmtN(P, 1) + ' W', X(75), Y(G.tabBot + 58), 12, SC.txt, 'center', '700', SC.halo);
    // Thermometer: Zonen gruen bis Tj,max - 10 K, gelb bis Tj,max, rot darueber; Marke bei Tj
    const th = { x: b.x + 8, y0: b.y + 12, y1: b.y + b.h - 12, w: 9 }, ty = (T) => th.y1 - kT(g, T) * (th.y1 - th.y0);
    c.fillStyle = 'rgba(8,12,28,0.7)'; rr(c, th.x - 1, th.y0 - 1, th.w + 2, th.y1 - th.y0 + 2, 4); c.fill();
    const zs = [[g.lo, a.tjMax - 10, '#3fb860'], [a.tjMax - 10, a.tjMax, '#f2b233'], [a.tjMax, g.hi, '#e5484d']];
    zs.forEach(z => { const ya = ty(Math.min(z[1], g.hi)), yb2 = ty(Math.max(z[0], g.lo)); if (yb2 - ya > 0.5) { c.fillStyle = z[2]; c.fillRect(th.x, ya, th.w, yb2 - ya); } });
    c.strokeStyle = '#ffffff'; c.lineWidth = 1; rr(c, th.x - 1, th.y0 - 1, th.w + 2, th.y1 - th.y0 + 2, 4); c.stroke();
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(th.x + th.w + 2, ty(a.tj)); c.lineTo(th.x + th.w + 9, ty(a.tj) - 4.5); c.lineTo(th.x + th.w + 9, ty(a.tj) + 4.5); c.closePath(); c.fill();
    c.restore();
  }

  // ===================================================================================================================
  //  Waermebild (Draufsicht, Falschfarben-Kamera): sieht nur Gehaeuse und Kuehlkoerper, nicht die Sperrschicht
  // ===================================================================================================================
  const HSF = { fahne: 0.16, s: 0.28, m: 0.40, l: 0.56, xl: 0.72 };
  function camGeom(b, a) {
    const cap = 22, pcb = { x: b.x + 10, y: b.y + 10, w: b.w - 20, h: Math.max(40, b.h - 20 - cap) };
    const cx = pcb.x + pcb.w * 0.5, cy = pcb.y + pcb.h * 0.5, G = { pcb, cx, cy, dev: { x: cx - 13, y: cy - 8.5, w: 26, h: 17 }, hs: null };
    if (!a.frei) {
      const f = a.cfg.heatsink, fr = f === 'blech' ? 0.22 + 0.5 * Math.sqrt(clamp((num(a.cfg.blech && a.cfg.blech.A_cm2, 100) - 10) / 390, 0, 1)) : (HSF[f] || 0.4);
      let hw = pcb.w * fr, hh = hw * 0.78; if (hh > pcb.h * 0.86) { hh = pcb.h * 0.86; hw = hh / 0.78; }
      hw = Math.max(hw, 44); hh = Math.max(hh, 34);
      G.hs = { x: cx - hw / 2, y: cy - hh / 2, w: hw, h: hh };
    }
    G.tipR = a.frei ? 1 : 1 / Math.cosh(0.5 + finOf(a.cfg).h / 120);
    G.R = a.frei ? 70 + 9 * Math.sqrt(a.rthTotal) : Math.max(G.hs.w, G.hs.h) * 0.5 + 62;
    G.T0 = a.frei ? a.ta + (a.tc - a.ta) * 0.92 : a.ta + (a.tk - a.ta) * 0.62;
    return G;
  }
  function camTemp(a, G, px, py) {
    const d = G.dev;
    if (px >= d.x && px <= d.x + d.w && py >= d.y && py <= d.y + d.h) return { T: a.tc, what: 'Gehäuse' };
    if (G.hs) {
      const h = G.hs;
      if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) {
        const rn = clamp(Math.max(Math.abs(px - G.cx) / (h.w / 2), Math.abs(py - G.cy) / (h.h / 2)), 0, 1);
        return { T: a.tk + (a.ta + (a.tk - a.ta) * G.tipR - a.tk) * Math.pow(rn, 1.2), what: 'Kühlkörper' };
      }
    }
    const f = Math.hypot(px - G.cx, py - G.cy) / G.R;
    return { T: a.ta + (G.T0 - a.ta) * Math.exp(-3.2 * f * f), what: 'Platine' };
  }
  function camScene(g, b, a) {
    const c = g.c, G = camGeom(b, a), pcb = G.pcb;
    c.save(); rr(c, b.x, b.y, b.w, b.h, 10); c.clip();
    c.fillStyle = hc(g, g.lo); c.fillRect(b.x, b.y, b.w, b.h);
    // Platine mit Orientierungsbauteilen (Umriss, ohne Eigenwaerme)
    rr(c, pcb.x, pcb.y, pcb.w, pcb.h, 8); c.fillStyle = hc(g, g.lo + (g.hi - g.lo) * 0.015); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 1;
    [[0.12, 0.18, 10], [0.2, 0.2, 10], [0.86, 0.78, 8]].forEach(q => { c.beginPath(); c.arc(pcb.x + pcb.w * q[0], pcb.y + pcb.h * q[1], q[2], 0, TAU); c.stroke(); });
    c.strokeRect(pcb.x + pcb.w * 0.8, pcb.y + pcb.h * 0.12, 22, 9); c.strokeRect(pcb.x + pcb.w * 0.08, pcb.y + pcb.h * 0.76, 30, 12);
    c.beginPath(); c.moveTo(pcb.x + 12, pcb.y + pcb.h * 0.5); c.lineTo(G.cx - 40, G.cy); c.moveTo(pcb.x + pcb.w - 12, pcb.y + pcb.h * 0.55); c.lineTo(G.cx + 40, G.cy); c.stroke();
    halo(g, G.cx, G.cy, G.R, G.T0, a.ta, a.frei ? 0.95 : 0.8);
    if (G.hs) {
      const h = G.hs, rad = Math.hypot(h.w, h.h) / 2, Ttip = a.ta + (a.tk - a.ta) * G.tipR;
      c.fillStyle = cgrad(g, 'hs|' + rq(G.cx) + '|' + rq(G.cy) + '|' + rq(rad) + '|' + rq(a.tk) + '|' + rq(Ttip) + '|' + rq(g.lo) + '|' + rq(g.hi), () => {
        const q = c.createRadialGradient(G.cx, G.cy, 0, G.cx, G.cy, rad);
        for (let i = 0; i <= 5; i++) q.addColorStop(i / 5, hc(g, a.tk + (Ttip - a.tk) * Math.pow(i / 5, 1.2)));
        return q;
      });
      rr(c, h.x, h.y, h.w, h.h, 4); c.fill();
      c.save(); rr(c, h.x, h.y, h.w, h.h, 4); c.clip(); c.strokeStyle = 'rgba(8,12,28,0.30)'; c.lineWidth = 1.2;
      const f = finOf(a.cfg), nr = f.sheet ? 0 : f.n;
      for (let i = 1; i < nr; i++) { c.beginPath(); if (a.cfg.orient === 'waagrecht') { const yy = h.y + h.h * i / nr; c.moveTo(h.x, yy); c.lineTo(h.x + h.w, yy); } else { const xx = h.x + h.w * i / nr; c.moveTo(xx, h.y); c.lineTo(xx, h.y + h.h); } c.stroke(); }
      c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.5; rr(c, h.x, h.y, h.w, h.h, 4); c.stroke();
    }
    const dv = G.dev;
    c.fillStyle = hc(g, a.tc); c.fillRect(dv.x, dv.y, dv.w, dv.h); c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.strokeRect(dv.x, dv.y, dv.w, dv.h);
    c.beginPath(); c.arc(dv.x + dv.w * 0.78, dv.y + dv.h / 2, 2.6, 0, TAU); c.fillStyle = 'rgba(8,12,28,0.9)'; c.fill();
    // Fadenkreuz: Tippen oder Zeigen setzt die Marke, ohne Marke liegt sie auf dem Gehaeuse
    const pr = g.e.probe, inside = pr && pr.x >= b.x && pr.x <= b.x + b.w && pr.y >= b.y && pr.y <= b.y + b.h - 22;
    const mx = inside ? clamp(pr.x, pcb.x + 4, pcb.x + pcb.w - 4) : G.cx, my = inside ? clamp(pr.y, pcb.y + 4, pcb.y + pcb.h - 4) : G.cy, hit = camTemp(a, G, mx, my);
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.4; c.beginPath(); c.arc(mx, my, 8, 0, TAU); c.moveTo(mx - 14, my); c.lineTo(mx - 4, my); c.moveTo(mx + 4, my); c.lineTo(mx + 14, my); c.moveTo(mx, my - 14); c.lineTo(mx, my - 4); c.moveTo(mx, my + 4); c.lineTo(mx, my + 14); c.stroke();
    const lab = hit.what + ' ' + fmtN(hit.T, 1) + ' °C', lx = mx > pcb.x + pcb.w * 0.55 ? mx - 18 : mx + 18, al = mx > pcb.x + pcb.w * 0.55 ? 'right' : 'left', ly = my < pcb.y + 24 ? my + 22 : my - 20;
    tx(g, lab, lx, ly, 13, SC.txt, al, '700', SC.halo);
    tx(g, fit(g, 'Die Kamera sieht ' + g.e.sy('Tc') + ' und ' + g.e.sy('Tk') + ', nicht ' + g.e.sy('Tj') + '.', b.w - 16, 12, '600'), b.x + b.w / 2, b.y + b.h - 11, 12, SC.dim, 'center', '600');
    c.restore();
  }

  // ===================================================================================================================
  //  Thermisches Ersatzschaltbild (Analogie: Spannung = Temperaturdifferenz, Strom = Verlustleistung, Widerstand = Waermewiderstand)
  // ===================================================================================================================
  function ersatzScene(g, b, a) {
    const c = g.c;
    c.save(); rr(c, b.x, b.y, b.w, b.h, 10); c.clip();
    c.fillStyle = hc(g, g.lo); c.fillRect(b.x, b.y, b.w, b.h);
    const xs = b.x + 34, xc = b.x + 78, nn = a.frei ? 2 : 3, yTop = b.y + (b.h < 245 ? 22 : 30), yG = b.y + b.h - 56, seg = (yG - yTop) / nn;
    const col = [SC.jc, SC.ck, SC.k], W1 = 'rgba(235,242,250,0.85)';
    const names = a.frei ? [g.e.sy('Rth_JC'), g.e.sy('Rth_CA')] : [g.e.sy('Rth_JC'), g.e.sy('Rth_CK'), g.e.sy('Rth_K')];
    const rv = a.frei ? [a.rthJC, a.rthK] : [a.rthJC, a.rthCK, a.rthK], dv = a.frei ? [a.dJC, a.dK] : [a.dJC, a.dCK, a.dK], cc = a.frei ? [SC.jc, SC.k] : col;
    const tnodes = a.frei ? [['Tj', a.tj], ['Tc', a.tc]] : [['Tj', a.tj], ['Tc', a.tc], ['Tk', a.tk]];
    const caps = a.frei ? [a.cth.j, a.cth.c] : [a.cth.j, a.cth.c, a.cth.k];
    c.lineCap = 'round'; c.lineJoin = 'round';
    // Stromquelle P (Waermepumpe) links, Masse = Umgebung unten
    const ym = (yTop + yG) / 2;
    ln(c, xs, yTop, xc, yTop, W1, 2); ln(c, xs, yTop, xs, ym - 15, W1, 2); ln(c, xs, ym + 15, xs, yG, W1, 2);
    c.beginPath(); c.arc(xs, ym, 15, 0, TAU); c.fillStyle = 'rgba(8,12,28,0.7)'; c.fill(); c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.stroke();
    const fl = g.red ? 0 : ((g.t * 1.2) % 1) * 6 - 3;
    c.beginPath(); c.moveTo(xs, ym + 8 - fl * 0.3); c.lineTo(xs, ym - 7 - fl * 0.3); c.moveTo(xs - 5, ym - 2 - fl * 0.3); c.lineTo(xs, ym - 8 - fl * 0.3); c.lineTo(xs + 5, ym - 2 - fl * 0.3); c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.stroke();
    tx(g, g.e.sy('P') + ' ' + fmtN(a.pv, 1) + ' W', xs, ym + 30, 12, SC.txt, 'center', '700', SC.halo);
    // Masseschiene
    const xr = b.x + b.w - 20;
    ln(c, xs - 14, yG, xr, yG, W1, 2);
    ln(c, xc, yG, xc, yG + 8, W1, 2); [[14, 0], [9, 4], [4, 8]].forEach(q => ln(c, xc - q[0], yG + 8 + q[1], xc + q[0], yG + 8 + q[1], W1, 2));
    tx(g, g.e.sy('Ta') + ' ' + fmtN(a.ta, 1) + ' °C (Umgebung)', xc + 22, yG + 15, 12, SC.txt, 'left', '700', SC.halo);
    // Kette: Widerstaende mit Temperaturabfall, Knoten mit Temperatur, Kondensatoren mit Fuellstand
    for (let i = 0; i < nn; i++) {
      const y0 = yTop + i * seg, y1 = y0 + seg, rh = Math.min(46, seg - 20), ya = (y0 + y1) / 2 - rh / 2, yb = ya + rh;
      ln(c, xc, y0, xc, ya, W1, 2); ln(c, xc, yb, xc, y1, W1, 2);
      c.strokeStyle = cc[i]; c.lineWidth = 2.5; c.beginPath(); c.moveTo(xc, ya);
      for (let k = 0; k < 6; k++) c.lineTo(xc + (k % 2 ? -7 : 7), ya + rh * (k + 0.5) / 6);
      c.lineTo(xc, yb); c.stroke();
      // Spannungspfeil = Temperaturabfall
      const xa = xc - 20; c.strokeStyle = cc[i]; c.lineWidth = 2; c.beginPath(); c.moveTo(xa, y0 + 6); c.lineTo(xa, y1 - 6); c.stroke();
      c.fillStyle = cc[i]; c.beginPath(); c.moveTo(xa, y1 - 3); c.lineTo(xa - 4.5, y1 - 11); c.lineTo(xa + 4.5, y1 - 11); c.closePath(); c.fill();
      const lx = xc + 16, lw = b.x + b.w - lx - 4 - (nn * 24);
      tx(g, fit(g, names[i] + ' ' + fmtN(rv[i], 1) + ' K/W', Math.max(60, lw), 12, '700'), lx, y0 + 9, 12, cc[i], 'left', '700', SC.halo);
      tx(g, g.e.sy('dT') + ' ' + fmtN(dv[i], 1) + ' K', lx, y0 + 22, 12, SC.txt, 'left', '600', SC.halo);
    }
    for (let i = 0; i < nn; i++) {
      const yn = yTop + i * seg, T = tnodes[i][1], xk = xr - 8 - (nn - 1 - i) * 24 + (nn - 1) * 0;   // Tj liegt am weitesten rechts (Leitungen kreuzen sich nicht)
      const xcol = b.x + b.w - 24 - i * 24 + 0;
      void xk;
      ln(c, xc, yn, xcol, yn, W1, 2);
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(xc, yn, 4, 0, TAU); c.fill();
      tx(g, g.e.sy(tnodes[i][0]) + ' ' + fmtN(T, 1) + ' °C', xc + 10, yn - 10, 12, SC.txt, 'left', '700', SC.halo);
      // Kondensator zwischen Knoten und Masse
      const cy = (yn + yG) / 2;
      ln(c, xcol, yn, xcol, cy - 4, W1, 2); ln(c, xcol, cy + 4, xcol, yG, W1, 2);
      ln(c, xcol - 8, cy - 4, xcol + 8, cy - 4, '#ffffff', 2.5); ln(c, xcol - 8, cy + 4, xcol + 8, cy + 4, '#ffffff', 2.5);
      const lv = kT(g, T), bh = 30, bx2 = xcol + 11;
      c.fillStyle = 'rgba(8,12,28,0.7)'; c.fillRect(bx2, cy - bh / 2, 4, bh); c.fillStyle = hc(g, T); c.fillRect(bx2, cy + bh / 2 - bh * lv, 4, bh * lv);
      c.strokeStyle = '#ffffff'; c.lineWidth = 1; c.strokeRect(bx2, cy - bh / 2, 4, bh);
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(xcol, yn, 2.6, 0, TAU); c.fill();
    }
    tx(g, fit(g, g.e.sy('Cth') + ': Sperrschicht ' + fmtN(caps[0], 2) + ' J/K · Gehäuse ' + fmtN(caps[1], 1) + ' J/K', b.w - 12, 12, '600'), b.x + b.w / 2, b.y + b.h - 27, 12, SC.dim, 'center', '600');
    tx(g, fit(g, a.frei ? g.e.sy('tau') + ' = ' + fmtN(a.tau / 60, 1) + ' min Prozesszeit' : 'Kühlkörper ' + fmtN(caps[2], 1) + ' J/K · ' + g.e.sy('tau') + ' = ' + fmtN(a.tau / 60, 1) + ' min Prozesszeit', b.w - 12, 12, '600'), b.x + b.w / 2, b.y + b.h - 10, 12, SC.dim, 'center', '600');
    c.restore();
  }

  // ===================================================================================================================
  //  Karte je Aufbau: Kopf, Schalter, Bild, Wertetafel
  // ===================================================================================================================
  function isLeader(a, d) { return d.act.length > 1 && a === d.best && d.act.some(o => o !== a && o.tj - a.tj > 0.05); }
  function head(g, r, a, d) {
    const pal = g.pal;
    tx(g, 'Aufbau ' + a.L, r.x + 2, r.y + 10, 16, pal.fg, 'left', '800');
    if (isLeader(a, d)) tx(g, '★ kühlster Aufbau', r.x + r.w - 2, r.y + 10, 12, pal.ok, 'right', '700');
    wrap(g, cfgText(a), r.w - 4, 12, '600', r.h >= 50 ? 2 : 1).forEach((t, i) => tx(g, t, r.x + 2, r.y + 28 + i * 14, 12, pal.mute, 'left', '600'));
  }
  function chipsRow(g, r, a) {
    const c = g.c, pal = g.pal;
    chipRects(r).forEach(q => {
      const dis = a.frei && q.key !== 'heatsink';
      rr(c, q.x, q.y, q.w, q.h, 8); c.fillStyle = pal.panel2; c.fill(); c.strokeStyle = pal.line; c.lineWidth = 1.2; c.stroke();
      tx(g, fit(g, q.title, q.w - 6, 12, '600'), q.x + q.w / 2, q.y + 13, 12, pal.mute, 'center', '600');
      tx(g, dis ? '–' : fit(g, SHORT[q.key][a.cfg[q.key]] || '', q.w - 6, 13, '700'), q.x + q.w / 2, q.y + 29, 13, dis ? pal.mute : pal.fg, 'center', '700');
    });
  }
  function table(g, r, a) {
    const c = g.c, pal = g.pal, sy = g.e.sy;
    rr(c, r.x, r.y, r.w, r.h, 8); c.fillStyle = pal.panel2; c.fill();
    if (r.h < 100) {   // kompakte Tafel: vier Zeilen mit denselben Zahlen
      const ok0 = !a.over, y0 = r.y + 12;
      tx(g, fit(g, sy('Rth_ges') + ' ' + fmtN(a.rthTotal, 1) + ' K/W · Σ ' + sy('dT') + ' ' + fmtN(a.sum, 1) + ' K', r.w - 16, 12, '700'), r.x + 8, y0, 12, pal.fg, 'left', '700');
      tx(g, fit(g, (a.frei ? sy('Tj') + ' / ' + sy('Tc') : sy('Tj') + ' / ' + sy('Tc') + ' / ' + sy('Tk')) + ' ' + fmtN(a.tj, 1) + ' / ' + fmtN(a.tc, 1) + (a.frei ? '' : ' / ' + fmtN(a.tk, 1)) + ' °C', r.w - 16, 12, '700'), r.x + 8, y0 + 16, 12, pal.fg, 'left', '700');
      tx(g, fit(g, sy('Pzul') + ' ' + fmtN(a.pzul, 1) + ' W · Reserve ' + fmtN(a.reserve, 1) + ' K', r.w - 16, 12, '700'), r.x + 8, y0 + 32, 12, a.reserve < 0 ? pal.danger : pal.fg, 'left', '700');
      tx(g, fit(g, (ok0 ? '✓ unter der Grenze (' : '⚠ über der Grenze (') + sy('Tjmax') + ' ' + fmtN(a.tjMax, 0) + ' °C)', r.w - 16, 12, '700'), r.x + 8, y0 + 48, 12, ok0 ? pal.ok : pal.danger, 'left', '700');
      return;
    }
    const xv = r.x + r.w * 0.52, xe = r.x + r.w * 0.56, rows = [
      [sy('Rth_JC'), fmtN(a.rthJC, 1) + ' K/W', sy('dT') + ' ' + fmtN(a.dJC, 1) + ' K'],
      [sy('Rth_CK'), a.frei ? 'entfällt' : fmtN(a.rthCK, 1) + ' K/W', a.frei ? '' : sy('dT') + ' ' + fmtN(a.dCK, 1) + ' K'],
      [a.frei ? sy('Rth_CA') : sy('Rth_K'), fmtN(a.rthK, 1) + ' K/W', sy('dT') + ' ' + fmtN(a.dK, 1) + ' K'],
      [sy('Rth_ges'), fmtN(a.rthTotal, 1) + ' K/W', 'Σ ' + fmtN(a.sum, 1) + ' K'],
      [a.frei ? sy('Tj') + ' / ' + sy('Tc') : sy('Tj') + ' / ' + sy('Tc') + ' / ' + sy('Tk'), '', ''],
      [sy('Pzul'), fmtN(a.pzul, 1) + ' W', 'Reserve ' + fmtN(a.reserve, 1) + ' K']
    ];
    rows.forEach((q, i) => {
      const y = r.y + 12 + i * 16;
      tx(g, q[0], r.x + 8, y, 12, pal.mute, 'left', '600');
      if (i === 4) tx(g, fmtN(a.tj, 1) + ' / ' + fmtN(a.tc, 1) + (a.frei ? '' : ' / ' + fmtN(a.tk, 1)) + ' °C', r.x + r.w - 8, y, 12, pal.fg, 'right', '700');
      else { tx(g, q[1], xv, y, 12, pal.fg, 'right', '700'); if (q[2]) tx(g, fit(g, q[2], r.x + r.w - xe - 6, 12, '600'), xe, y, 12, i === 5 && a.reserve < 0 ? pal.danger : pal.fg, 'left', '600'); }
    });
    const y = r.y + 12 + 6 * 16, ok = !a.over;
    tx(g, fit(g, (ok ? '✓ unter der Grenze (' : '⚠ über der Grenze (') + sy('Tjmax') + ' ' + fmtN(a.tjMax, 0) + ' °C)', r.w - 16, 12, '700'), r.x + 8, y, 12, ok ? pal.ok : pal.danger, 'left', '700');
  }
  function panel(g, r, a, d, view) {
    const c = g.c, pal = g.pal, pr = parts(r, view), lead = isLeader(a, d);
    rr(c, r.x, r.y, r.w, r.h, 12); c.fillStyle = pal.panel; c.fill();
    c.lineWidth = a.over ? 2.5 : lead ? 2 : 1.5; c.strokeStyle = a.over ? pal.danger : lead ? pal.ok : pal.line; c.stroke();
    head(g, pr.head, a, d);
    if (pr.chips) chipsRow(g, pr.chips, a);
    if (view === 'schnitt') cutScene(g, pr.body, a); else if (view === 'kamera') camScene(g, pr.body, a); else ersatzScene(g, pr.body, a);
    table(g, pr.table, a);
  }

  // ===================================================================================================================
  //  Balkenansicht: gestapelte Temperaturabfaelle aller Aufbauten (Summe = Tj - Ta), Grenzlinie, Zielwerte
  // ===================================================================================================================
  const niceCeil = (v) => { const c = [5, 10, 20, 25, 50, 100, 200, 500]; for (let i = 0; i < c.length; i++) if (v <= c[i]) return c[i]; return 500; };
  const niceStep = (mx) => { const c = [5, 10, 20, 25, 50, 100, 200, 500]; for (let i = 0; i < c.length; i++) if (mx / c[i] <= 6) return c[i]; return 500; };
  const onColor = (hex) => { const L = lum(hexRGB(hex)); return (1.05) / (L + 0.05) >= (L + 0.05) / 0.057 ? '#ffffff' : '#10151b'; };
  function deltaText(a, b, dd) {   // Satz ueber den Unterschied aus dem gerechneten Wert dd = Tj(a) - Tj(b)
    if (Math.abs(dd) < 0.05) return 'Aufbau ' + b.L + ' ist so heiß wie Aufbau ' + a.L + '.';
    return 'Aufbau ' + b.L + ' ist ' + fmtN(Math.abs(dd), 1) + ' K ' + (dd > 0 ? 'kühler' : 'heißer') + ' als Aufbau ' + a.L + '.';
  }
  function balken(g, r, d) {
    const c = g.c, pal = g.pal, act = d.act, n = act.length, sy = g.e.sy;
    rr(c, r.x, r.y, r.w, r.h, 12); c.fillStyle = pal.panel; c.fill(); c.strokeStyle = pal.line; c.lineWidth = 1.5; c.stroke();
    const cols = [pal.jc, pal.ck, pal.k], nm = [sy('Rth_JC'), sy('Rth_CK'), sy('Rth_K')], narrow = r.w < 380;
    // Legende (zwei Zeilen)
    let lx = r.x + 14;
    for (let i = 0; i < 3; i++) {
      c.fillStyle = cols[i]; c.fillRect(lx, r.y + 12, 13, 13); c.strokeStyle = pal.fg; c.lineWidth = 1; c.strokeRect(lx, r.y + 12, 13, 13); hatch(c, i, lx, r.y + 12, 13, 13, 0.5);
      const t = (narrow ? '' : sy('dT') + ' ') + nm[i] + (narrow ? '' : (i === 2 && d.act.some(a => a.frei) ? ' bzw. Rth_CA' : ''));
      tx(g, t, lx + 18, r.y + 19, 12, pal.fg, 'left', '600'); lx += 18 + Math.max(60, t.length * 6.8) + 12;
    }
    c.strokeStyle = pal.danger; c.lineWidth = 2; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(r.x + 14, r.y + 41); c.lineTo(r.x + 38, r.y + 41); c.stroke(); c.setLineDash(NODASH);
    tx(g, fit(g, 'Grenze ' + sy('Tjmax') + ' − ' + sy('Ta') + ' = ' + fmtN(d.tjMax - g.e.ctl.ta, 0) + ' K', r.w * 0.5, 12, '700'), r.x + 44, r.y + 41, 12, pal.danger, 'left', '700');
    c.strokeStyle = pal.mute; c.lineWidth = 1.5; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(r.x + r.w * 0.55, r.y + 41); c.lineTo(r.x + r.w * 0.55 + 20, r.y + 41); c.stroke(); c.setLineDash(NODASH);
    tx(g, fit(g, narrow ? 'Beharrung' : 'Beharrungszustand', r.w * 0.45 - 30, 12, '600'), r.x + r.w * 0.55 + 26, r.y + 41, 12, pal.mute, 'left', '600');
    const foot = 66 + Math.max(1, n - 1) * 15 + 8, x0 = r.x + 56, x1 = r.x + r.w - 14, yT = r.y + 62, yB = r.y + r.h - foot;
    if (!(yB - yT > 60 && x1 - x0 > 120)) { tx(g, 'Bild zu klein', r.x + r.w / 2, r.y + r.h / 2, 13, pal.mute, 'center'); return; }
    let mx = d.tjMax - g.e.ctl.ta; act.forEach(a => { mx = Math.max(mx, a.sum, a.ssSum); });
    const ymax = mx * 1.12, st = niceStep(ymax), yy = (v) => yB - clamp(v / ymax, 0, 1.0) * (yB - yT);
    c.strokeStyle = pal.line; c.lineWidth = 1;
    for (let v = 0; v <= ymax; v += st) { c.beginPath(); c.moveTo(x0, yy(v)); c.lineTo(x1, yy(v)); c.stroke(); tx(g, fmtN(v, 0) + ' K', x0 - 6, yy(v), 12, pal.mute, 'right', '600'); }
    const slot = (x1 - x0) / n, bw = Math.min(88, slot * 0.58);
    act.forEach((a, i) => {
      const cx = x0 + slot * (i + 0.5), bx = cx - bw / 2, vals = [Math.max(0, a.dJC), Math.max(0, a.dCK), Math.max(0, a.dK)];
      let acc = 0;
      vals.forEach((v, k) => {
        const ya = yy(acc + v), yb2 = yy(acc), hh = yb2 - ya;
        if (hh > 0.4) {
          c.fillStyle = cols[k]; c.fillRect(bx, ya, bw, hh); hatch(c, k, bx, ya, bw, hh, 0.35);
          c.strokeStyle = pal.panel; c.lineWidth = 1.5; c.strokeRect(bx, ya, bw, hh);
          if (hh >= 16) tx(g, fmtN(v, 1) + ' K', cx, (ya + yb2) / 2, 12, onColor(cols[k]), 'center', '700');
        }
        acc += v;
      });
      const ys = yy(a.ssSum);   // Zielwert im Beharrungszustand
      c.strokeStyle = pal.mute; c.lineWidth = 1.5; c.setLineDash([3, 3]); c.strokeRect(bx - 4, ys, bw + 8, yB - ys); c.setLineDash(NODASH);
      const top = yy(a.sum), lab = (a.over ? '⚠ ' : '') + sy('Tj') + ' ' + fmtN(a.tj, 1) + ' °C';
      tx(g, fit(g, lab, slot - 4, 13, '800'), cx, Math.min(top, ys) - 11, 13, a.over ? pal.danger : pal.fg, 'center', '800');
      tx(g, 'Aufbau ' + a.L, cx, yB + 14, 13, pal.fg, 'center', '800');
      wrap(g, cfgText(a), slot - 6, 12, '600', 2).forEach((t, k) => tx(g, t, cx, yB + 30 + k * 14, 12, pal.mute, 'center', '600'));
    });
    c.strokeStyle = pal.danger; c.lineWidth = 2; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(x0, yy(d.tjMax - g.e.ctl.ta)); c.lineTo(x1, yy(d.tjMax - g.e.ctl.ta)); c.stroke(); c.setLineDash(NODASH);
    c.strokeStyle = pal.fg; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0, yB); c.lineTo(x1, yB); c.stroke();
    for (let i = 0; i + 1 < n; i++) tx(g, fit(g, deltaText(act[i], act[i + 1], act[i].tj - act[i + 1].tj), r.w - 24, 12, '600'), r.x + 14, yB + 70 + i * 15, 12, pal.fg, 'left', '600');
  }
  function hatch(c, k, x, y, w, h, al) {   // Muster je Glied: voll, schraeg, Punkte (Farbe ist nicht der einzige Traeger)
    if (k === 0 || !(h > 1)) return;
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.strokeStyle = 'rgba(0,0,0,' + al + ')'; c.fillStyle = 'rgba(0,0,0,' + al + ')'; c.lineWidth = 1.4;
    if (k === 1) { for (let q = -h; q < w; q += 7) { c.beginPath(); c.moveTo(x + q, y + h); c.lineTo(x + q + h, y); c.stroke(); } }
    else { for (let yy2 = y + 4; yy2 < y + h; yy2 += 7) for (let xx = x + 3 + ((((yy2 - y) / 7) | 0) % 2) * 3.5; xx < x + w; xx += 7) { c.beginPath(); c.arc(xx, yy2, 1.3, 0, TAU); c.fill(); } }
    c.restore();
  }

  // ===================================================================================================================
  //  Kleine Flaechen (Karten), Legende, Kopfzeile, Hauptzeichnung
  // ===================================================================================================================
  function mini(g, lay, d, view) {
    const c = g.c, pal = g.pal, sy = g.e.sy;
    d.act.forEach((a, i) => {
      const r = lay.rects[i]; if (!(r.w > 20 && r.h > 20)) return;
      rr(c, r.x, r.y, r.w, r.h, 10); c.fillStyle = pal.panel; c.fill(); c.lineWidth = a.over ? 2.5 : 1.5; c.strokeStyle = a.over ? pal.danger : pal.line; c.stroke();
      if (r.h >= 120 && r.w >= 100) {
        tx(g, 'Aufbau ' + a.L, r.x + 8, r.y + 14, 14, pal.fg, 'left', '800');
        tx(g, sy('Tj') + ' ' + fmtN(a.tj, 1) + ' °C', r.x + 8, r.y + 36, 14, a.over ? pal.danger : pal.fg, 'left', '800');
        tx(g, fit(g, (a.over ? '⚠ über Grenze' : '✓ unter Grenze'), r.w - 14, 12, '700'), r.x + 8, r.y + 54, 12, a.over ? pal.danger : pal.ok, 'left', '700');
        const mx = Math.max(d.tjMax - g.e.ctl.ta, ...d.act.map(o => o.sum), 1), bw = r.w - 16, vals = [a.dJC, a.dCK, a.dK], cols = [pal.jc, pal.ck, pal.k];
        let xx = r.x + 8; c.strokeStyle = pal.line; c.lineWidth = 1; c.strokeRect(r.x + 8, r.y + 64, bw, 14);
        vals.forEach((v, k) => { const w2 = bw * clamp(Math.max(0, v) / mx, 0, 1); c.fillStyle = cols[k]; c.fillRect(xx, r.y + 64, w2, 14); hatch(c, k, xx, r.y + 64, w2, 14, 0.35); xx += w2; });
        if (r.h >= 150) ['JC', 'CK', 'K'].forEach((nme, k) => tx(g, nme + ' ' + fmtN(vals[k], 1) + ' K', r.x + 8, r.y + 94 + k * 16, 12, pal.fg, 'left', '600'));
      } else {
        tx(g, fit(g, 'Aufbau ' + a.L + '   ' + sy('Tj') + ' ' + fmtN(a.tj, 1) + ' °C' + (a.over ? '  ⚠' : '  ✓'), r.w - 14, 13, '800'), r.x + 8, r.y + r.h / 2, 13, a.over ? pal.danger : pal.fg, 'left', '800');
      }
    });
    void view;
  }
  function tabsRow(g, lay, d) {
    const c = g.c, pal = g.pal;
    lay.tabs.forEach((q, i) => {
      const a = d.A[i], sel = i === lay.focus;
      rr(c, q.x, q.y, q.w, q.h, 10); c.fillStyle = sel ? pal.accent : pal.panel2; c.fill(); c.strokeStyle = a.over ? pal.danger : pal.line; c.lineWidth = a.over ? 2 : 1.2; c.stroke();
      const col = sel ? onColor(pal.accent) : pal.fg;
      tx(g, 'Aufbau ' + a.L, q.x + q.w / 2, q.y + 15, 13, col, 'center', '800');
      tx(g, fit(g, (a.over ? '⚠ ' : '✓ ') + fmtN(a.tj, 1) + ' °C', q.w - 8, 12, '700'), q.x + q.w / 2, q.y + 32, 12, col, 'center', '700');
    });
  }
  function legend(g, r, d) {
    if (!(r.h > 30 && r.w > 120)) return;
    const c = g.c, pal = g.pal, sy = g.e.sy, w = Math.min(r.w - 12, 460), x0 = r.x + (r.w - w) / 2, y0 = r.y + 16, gr = cgrad(g, 'leg|' + rq(x0) + '|' + rq(w), () => { const q = c.createLinearGradient(x0, 0, x0 + w, 0); for (let i = 0; i <= 12; i++) q.addColorStop(i / 12, heatCss(i / 12)); return q; });
    c.fillStyle = gr; rr(c, x0, y0, w, 10, 4); c.fill(); c.strokeStyle = pal.line; c.lineWidth = 1; c.stroke();
    const xm = x0 + w * kT(g, d.tjMax);
    c.strokeStyle = pal.danger; c.lineWidth = 2; c.beginPath(); c.moveTo(xm, y0 - 5); c.lineTo(xm, y0 + 15); c.stroke();
    const lt = sy('Tjmax') + ' ' + fmtN(d.tjMax, 0) + ' °C', lw = lt.length * 6.6;
    tx(g, lt, clamp(xm, x0 + lw / 2, x0 + w - lw / 2), r.y + 6, 12, pal.danger, 'center', '700');
    tx(g, sy('Ta') + ' ' + fmtN(g.lo, 0) + ' °C', x0, y0 + 26, 12, pal.fg, 'left', '600');
    tx(g, fmtN(g.hi, 0) + ' °C', x0 + w, y0 + 26, 12, pal.fg, 'right', '600');
    const st = niceCeil((g.hi - g.lo) / Math.max(1, Math.floor(w / 90)));
    for (let T = Math.ceil((g.lo + 1e-6) / st) * st; T < g.hi; T += st) {
      const xt = x0 + w * kT(g, T);
      if (xt - x0 < 88 || x0 + w - xt < 60 || Math.abs(xt - xm) < 48) continue;
      c.strokeStyle = pal.mute; c.lineWidth = 1; c.beginPath(); c.moveTo(xt, y0 + 10); c.lineTo(xt, y0 + 14); c.stroke();
      tx(g, fmtN(T, 0) + ' °C', xt, y0 + 26, 12, pal.mute, 'center', '600');
    }
  }
  function analogy(g, r, e) {
    const a = e.analogie;
    if (!Array.isArray(a) || !a.length || !(r.h > 30)) return;
    const pal = g.pal, one = (q) => (q && q.elek && q.therm ? q.elek + ' ↔ ' + q.therm : '');
    const l1 = [one(a[0]), one(a[1])].filter(Boolean).join('   ·   '), l2 = [one(a[2]), one(a[3])].filter(Boolean).join('   ·   ');
    tx(g, fit(g, l1, r.w, 12, '600'), r.x + r.w / 2, r.y + 14, 12, pal.mute, 'center', '600');
    tx(g, fit(g, l2, r.w, 12, '600'), r.x + r.w / 2, r.y + 32, 12, pal.mute, 'center', '600');
  }
  function renderFrame(ctx, w, h, tms, e) {
    const d = e.build(), g = mkG(ctx, w, h, tms, e, d), view = e.view, n = e.ctl.n, lay = layoutFor(w, h, n, view, e.focus);
    ctx.save();
    ctx.fillStyle = g.pal.bg; ctx.fillRect(0, 0, w, h);
    const pt = e.sy('P') + ' = ' + fmtN(e.ctl.pv, 1) + ' W', ta0 = e.sy('Ta') + ' = ' + fmtN(e.ctl.ta, 0) + ' °C', tm = fmtN(e.S.t / 60, 1) + ' min';
    const caps = [pt + ' in jedem Aufbau gleich · ' + ta0 + ' · Prozesszeit ' + tm, pt + ' je Aufbau · ' + ta0 + ' · ' + tm + ' Prozesszeit', pt + ' · ' + ta0 + ' · ' + tm];
    g.c.font = '600 13px ' + FONT;
    const capT = caps.find(t => (g.c.measureText ? g.c.measureText(t).width : t.length * 7.3) <= lay.cap.w) || caps[2];
    tx(g, fit(g, capT, lay.cap.w, 13, '600'), lay.cap.x, lay.cap.y + 12, 13, g.pal.mute, 'left', '600');
    if (view === 'balken') balken(g, lay.chart, d);
    else {
      if (lay.mode === 'mini') mini(g, lay, d, view);
      else { if (lay.mode === 'pager') tabsRow(g, lay, d); lay.rects.forEach((r, k) => panel(g, r, d.A[lay.order[k]], d, view)); }
      if (view === 'ersatz') analogy(g, lay.bottom, e); else legend(g, lay.bottom, d);
    }
    ctx.restore();
    return { particles: g.particles, particlesMax: g.pmax || 0, smokeMax: g.smokeN || 0, mode: lay.mode, view };
  }

  R.vergleichLib = { heatRGB, lum, hexRGB, PAL, SC, HEAT, layoutFor, sizeFor, parts, chipRects, nextOf, FIN, finOf, niceStep, onColor, geomOf, LAYM };
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
