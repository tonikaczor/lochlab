/* thmrig-linear.js - Thermik-Lab: gemeinsame Basis der Pruefstaende Gruppe A (THM_RIGS.baseA) und Pruefstand 1 `linear` (7805 und LM317, SPEC 5.1)
 * Alles Rechnen kommt aus THM_CORE: Waermekette (chain, steady, pzul, rthKerf, mount), Zeitverhalten (thermal mit exaktem Schritt, setCfg, settle),
 * Elektrik des Reglers (devices[id].elec: Ua, Ia, P_V, Dropout, Strombegrenzung, Mindestlast), Abschalthysterese (shutdownStep), Meldungen (diagnose, TEXTS),
 * Rechenweg (recipe). Der Pruefstand fuehrt nur den Kernschritt (h = 0,25 s Prozesszeit), die Abschalt- und Defektlogik, den Schreiber, die Ereignisse und das Bedienpult im Bild.
 * Die Basis (Kernschritt, Schreiber, Ereignisse, Ansichten, Bedienpult im Bild) liegt in dieser Datei (THM_RIGS.baseA); thmrig-transistor.js nutzt sie
 * (im Browser NACH dieser Datei laden, in Node holt sich thmrig-transistor.js die Basis per require). Wer THM_RIGS.baseA.makeRig nutzt, liefert nur die Anlage (def).
 * Zeichnen: THM_DRAW (thmdraw.js) liefert Schnittbild, Waermebild, Ersatzschaltbild, Balken, Thermometer, Drehregler, Kippschalter, Lampe; die Anlage legt sie in Pixeln auf der
 * Zeichenflaeche aus (Layout wide/tall nach Seitenverhaeltnis, Schrift mindestens 12 px). Fehlt THM_DRAW, zeichnet draw einen Platzhaltertext plus Bedienpult.
 */
(function (root) {
  'use strict';
  const R = root.THM_RIGS = root.THM_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // =====================================================================================================================
  //  Gemeinsame Basis
  // =====================================================================================================================
  if (!R.baseA) R.baseA = (function () {
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const num = (v, d) => {
      if (typeof v === 'string' && v.trim() !== '') v = Number(v.trim().replace(',', '.'));
      return (typeof v === 'number' && isFinite(v)) ? v : d;
    };
    const fm = (v, d) => { v = +v; if (!isFinite(v)) return '–'; return v.toFixed(d).replace('.', ','); };
    const fn = (v, d) => { let s = fm(v, d); if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, ''); return s; };
    function tryRequire(n) { try { return typeof require === 'function' ? require(n) : null; } catch (e) { return null; } }
    function getCore() {
      const c = root.THM_CORE || tryRequire('./thmcore.js') || root.THM_CORE;
      if (!c || !c.chain || !c.thermal) throw new Error('THM_CORE (thmcore.js) ist nicht geladen.');
      return c;
    }
    const getDraw = () => root.THM_DRAW || tryRequire('./thmdraw.js') || root.THM_DRAW || null;
    // Zahl aus einem Kernergebnis (Zahl oder Objekt mit einem der Felder)
    const pick = (r, keys, d) => {
      if (typeof r === 'number') return isFinite(r) ? r : d;
      if (r && typeof r === 'object') for (let i = 0; i < keys.length; i++) { const v = r[keys[i]]; if (typeof v === 'number' && isFinite(v)) return v; }
      return d;
    };

    // ---- Symbole (nur Anzeige): THM_CORE.sym(key, satz); ohne Kern oder bei unbekanntem Schluessel Datenblatt-Schreibweise ----
    const SYM_DB = { Tj: 'Tj', Tc: 'Tc', Tk: 'Tk', Ta: 'Ta', Rth_JC: 'Rth_JC', Rth_CK: 'Rth_CK', Rth_K: 'Rth_K', Rth_JA: 'Rth_JA', P: 'P_V' };
    const SYM_DE = { Tj: 'ϑj', Tc: 'ϑG', Tk: 'ϑK', Ta: 'ϑU', Rth_JC: 'R_thJG', Rth_CK: 'R_thGK', Rth_K: 'R_thKU', Rth_JA: 'R_thJU', P: 'P_V' };
    function symOf(CORE, key, set) {
      try {
        if (CORE && typeof CORE.sym === 'function') { const s = CORE.sym(key, set); if (typeof s === 'string' && s && s !== 'undefined') return s; }
      } catch (e) { /* Fallback */ }
      return (set === 'de' ? SYM_DE : SYM_DB)[key] || key;
    }

    // ---------------------------------------------------------------------------------------------------------------
    //  Montage-Steuerwerte (SPEC 5.0): Quelle ist THM_CORE.mountControls() / mountPresets; nur Notfall-Fallback hier
    // ---------------------------------------------------------------------------------------------------------------
    const G_MOUNT = 'Montage und Umgebung';
    function fallbackMount() {
      const hasHs = s => !!s && s.heatsink !== 'none';
      return [
        { key: 'heatsink', label: 'Kühlkörper', type: 'select', value: 'none', group: G_MOUNT, options: [{ value: 'none', label: 'ohne (freistehend)' }, { value: 'fahne', label: 'Fahnenkühlkörper' }, { value: 's', label: 'Profil klein' }, { value: 'm', label: 'Profil mittel' }, { value: 'l', label: 'Profil groß' }, { value: 'xl', label: 'Rippenkörper sehr groß' }, { value: 'blech', label: 'Kühlblech (Selbstbau)' }],
          help: 'Der Kühlkörper führt die Wärme vom Gehäuse an die Luft. Ohne Kühlkörper gilt der Wärmewiderstand Sperrschicht–Umgebung des Datenblatts.' },
        { key: 'blechA', label: 'Fläche des Kühlbleches', type: 'slider', scale: 'lin', min: 10, max: 400, step: 5, unit: 'cm²', value: 100, group: G_MOUNT, visible: s => !!s && s.heatsink === 'blech',
          help: 'Fläche des Kühlbleches (beide Seiten zusammen gerechnet). Mehr Fläche, kleinerer Wärmewiderstand des Kühlkörpers.' },
        { key: 'joint', label: 'Übergang Gehäuse–Kühlkörper', type: 'select', value: 'glimmer', group: G_MOUNT, visible: hasHs, options: [{ value: 'direkt', label: 'direkt (ohne Isolierung)' }, { value: 'glimmer', label: 'Glimmerscheibe' }, { value: 'silikon', label: 'Silikonfolie' }],
          help: 'Direkt leitet die Wärme am besten, isoliert aber nicht. Glimmerscheibe und Silikonfolie isolieren elektrisch und kosten Wärmeleitung.' },
        { key: 'paste', label: 'Wärmeleitpaste', type: 'select', value: 'duenn', group: G_MOUNT, visible: hasHs, options: [{ value: 'keine', label: 'keine' }, { value: 'duenn', label: 'dünn aufgetragen' }, { value: 'dick', label: 'dick aufgetragen' }, { value: 'geliefert', label: 'wie geliefert (nicht geprüft)' }],
          help: 'Dünn aufgetragene Wärmeleitpaste füllt die Luftspalte zwischen Gehäuse und Kühlkörper. Zu viel Paste verschlechtert den Übergang wieder.' },
        { key: 'bushing', label: 'Isolierbuchse', type: 'switch', value: true, group: G_MOUNT, visible: s => !!s && s.heatsink !== 'none' && s.joint !== 'direkt',
          help: 'Die Isolierbuchse isoliert die Schraube gegen die Fahne. Fehlt sie, schließt die Schraube die Isolierscheibe kurz.' },
        { key: 'screw', label: 'Schraube', type: 'select', value: 'fest', group: G_MOUNT, visible: hasHs, options: [{ value: 'fest', label: 'fest angezogen' }, { value: 'locker', label: 'locker' }, { value: 'geliefert', label: 'wie geliefert (nicht geprüft)' }],
          help: 'Eine lockere Schraube lässt einen Spalt: Der Wärmewiderstand des Übergangs steigt. Das Anzugsmoment steht in der Herstellerangabe.' },
        { key: 'ksPot', label: 'Kühlkörper elektrisch', type: 'select', value: 'masse', group: G_MOUNT, visible: hasHs, options: [{ value: 'masse', label: 'an Gerätemasse' }, { value: 'frei', label: 'frei (isoliert eingebaut)' }],
          help: 'An Gerätemasse oder frei eingebaut. Berührt eine Fahne mit Spannung den Kühlkörper an Masse, gibt es einen Kurzschluss.' },
        { key: 'fan', label: 'Lüfter', type: 'select', value: 'aus', group: G_MOUNT, visible: hasHs, options: [{ value: 'aus', label: 'aus' }, { value: 'leise', label: 'leise' }, { value: 'mittel', label: 'mittel' }, { value: 'stark', label: 'stark' }],
          help: 'Ein Lüfter verkleinert nur den Wärmewiderstand des Kühlkörpers zur Luft, nicht den des Gehäuses und des Übergangs.' },
        { key: 'orient', label: 'Einbaulage', type: 'select', value: 'senkrecht', group: G_MOUNT, visible: hasHs, options: [{ value: 'senkrecht', label: 'Rippen senkrecht' }, { value: 'waagrecht', label: 'Rippen waagrecht' }],
          help: 'Stehen die Rippen senkrecht, steigt die warme Luft wie in einem Kamin auf. Waagrecht eingebaut kühlt der Kühlkörper schlechter.' },
        { key: 'ta', label: 'Umgebungstemperatur', type: 'slider', scale: 'lin', min: 0, max: 70, step: 1, unit: '°C', value: 25, group: G_MOUNT,
          help: 'Temperatur der Luft am Kühlkörper. Im Gerät ist es wärmer als im Raum.' },
        { key: 'nonlin', label: 'Konvektion nichtlinear', type: 'switch', value: false, group: G_MOUNT, visible: hasHs,
          help: 'Vertiefung: Der Wärmewiderstand des Kühlkörpers sinkt mit der Übertemperatur. Aufgaben und Prüfungsrechnung rechnen ohne diesen Schalter.' }
      ];
    }
    function fallbackMountPresets() {
      return [
        { id: 'frei', name: 'Freistehend', values: { heatsink: 'none' } },
        { id: 'kk-m-glimmer-paste', name: 'Profil mittel, Glimmerscheibe, Paste', values: { heatsink: 'm', joint: 'glimmer', paste: 'duenn' } },
        { id: 'kk-m-glimmer-trocken', name: 'Profil mittel, Glimmerscheibe, ohne Paste', values: { heatsink: 'm', joint: 'glimmer', paste: 'keine' } },
        { id: 'kk-m-direkt-paste', name: 'Profil mittel, direkt, Paste', values: { heatsink: 'm', joint: 'direkt', paste: 'duenn' } },
        { id: 'kk-l-lüfter', name: 'Profil groß, Glimmerscheibe, Paste, Lüfter mittel', values: { heatsink: 'l', joint: 'glimmer', paste: 'duenn', fan: 'mittel' } }
      ];
    }
    function coreOptional() { return root.THM_CORE || tryRequire('./thmcore.js') || root.THM_CORE || null; }
    function mountControls() {
      let L = null; const C = coreOptional();
      if (C && typeof C.mountControls === 'function') { try { L = C.mountControls(); } catch (e) { L = null; } }
      if (!Array.isArray(L) || !L.length) L = fallbackMount();
      /* Verdeckte Fehler (Fehlersuche th26): 'geliefert' = Montagezustand nicht geprueft; physikalisch wie 'keine' bzw. 'locker' (THM_CORE), ohne Fehlerhinweis */
      const GELIEFERT = { value: 'geliefert', label: 'wie geliefert (nicht geprüft)', help: 'Der Zustand ist nicht geprüft. Die Temperaturen und Temperaturabfälle zeigen, was der Aufbau tut.' };
      return L.map(c => Object.assign({}, c, { group: c.group || G_MOUNT }, (c.key === 'paste' || c.key === 'screw') && Array.isArray(c.options) && !c.options.some(o => o.value === 'geliefert') ? { options: c.options.concat([GELIEFERT]) } : {}));
    }
    function mountPresets() {
      let L = null; const C = coreOptional();
      if (C && Array.isArray(C.mountPresets)) L = C.mountPresets;
      else if (C && typeof C.mountPresets === 'function') { try { L = C.mountPresets(); } catch (e) { L = null; } }
      else if (C && C.mountPresets && typeof C.mountPresets === 'object') L = Object.keys(C.mountPresets).map(k => Object.assign({ id: k }, C.mountPresets[k]));
      if (!Array.isArray(L) || !L.length) L = fallbackMountPresets();
      return L.map(p => ({ id: p.id, name: p.name || p.id, params: Object.assign({}, p.values || p.params || p.ctl || {}), fromMount: true }));
    }
    // Messgeraete-Liste aus Vorlagen [key, Bezeichnung, Einheit, Stellen, min, max, Symbolschluessel?, warnAbove?]; die Symbole stammen aus THM_CORE.sym
    function meterList(tpl) {
      return tpl.map(m => { const o = { key: m[0], label: m[6] ? m[1] + ' ' + symOf(coreOptional(), m[6], 'db') : m[1], unit: m[2], digits: m[3], min: m[4], max: m[5], sym: m[6] || null }; if (m[7]) o.warnAbove = m[7]; return o; });
    }
    function metersLabel(m, S) { return m.sym ? m.label.replace(/ [^ ]+$/, '') + ' ' + S(m.sym) : m.label; }
    // Kippschalter im Bild: on(ctl), to(ctl, letzterKuehlkoerper), label, show(ctl)
    const SWITCHES = [
      { key: 'heatsink', label: 'Kühlkörper', on: c => c.heatsink !== 'none', to: (c, last) => c.heatsink !== 'none' ? 'none' : (last || 'm'), show: c => c.heatsink === 'none' ? 'aus' : 'an' },
      { key: 'joint', label: 'Glimmer', on: c => c.joint !== 'direkt', to: c => c.joint !== 'direkt' ? 'direkt' : 'glimmer', show: c => c.joint === 'direkt' ? 'direkt' : c.joint === 'silikon' ? 'Silikon' : 'Glimmer' },
      { key: 'paste', label: 'Paste', on: c => c.paste !== 'keine', to: c => c.paste !== 'keine' ? 'keine' : 'duenn', show: c => c.paste === 'keine' ? 'keine' : c.paste === 'dick' ? 'dick' : 'dünn' },
      { key: 'fan', label: 'Lüfter', on: c => c.fan !== 'aus', to: c => c.fan !== 'aus' ? 'aus' : 'mittel', show: c => c.fan }
    ];
    const MOUNT_KEYS = ['heatsink', 'blechA', 'joint', 'paste', 'bushing', 'screw', 'ksPot', 'fan', 'orient', 'ta', 'nonlin'];
    const MOUNT_STATE = ['heatsink', 'blechA', 'joint', 'paste', 'bushing', 'screw', 'ksPot', 'fan', 'orient', 'nonlin'];
    const CFG_KEYS = ['device', 'heatsink', 'blechA', 'joint', 'paste', 'bushing', 'screw', 'ksPot', 'fan', 'orient', 'count', 'nonlin'];

    // ---------------------------------------------------------------------------------------------------------------
    //  Farben (Hell und Dunkel), Zeichenhilfen (reine Pixelrechnung, kein Weltmass)
    // ---------------------------------------------------------------------------------------------------------------
    const PAL = {
      dark: { theme: 'dark', bg: '#10151b', panel: '#1a212a', panel2: '#252e39', line: '#3a4654', fg: '#e8ecf0', mute: '#a0acb8', accent: '#4aa3ff', ok: '#52d870', warn: '#ffb340', danger: '#ff6b6b', tj: '#ff6b6b', tc: '#ffa040', tk: '#ffe066', ta: '#a0acb8' },
      light: { theme: 'light', bg: '#f3f5f8', panel: '#ffffff', panel2: '#e7ecf1', line: '#b8c2ce', fg: '#1a222b', mute: '#566473', accent: '#0b63c5', ok: '#17843a', warn: '#a85f00', danger: '#c62828', tj: '#c62828', tc: '#d1600a', tk: '#a37c00', ta: '#566473' }
    };
    function rrect(ctx, x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
    }
    function box(ctx, x, y, w, h, fill, stroke, r) { rrect(ctx, x, y, w, h, r === undefined ? 10 : r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); } }
    function txt(ctx, s, x, y, o) {
      o = o || {}; ctx.font = (o.bold ? '700 ' : '500 ') + (o.size || 13) + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = o.color || '#fff'; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'middle';
      if (o.maxW) ctx.fillText(String(s), x, y, o.maxW); else ctx.fillText(String(s), x, y);
    }
    function pill(ctx, s, x, y, h, fill, fg, size) {
      ctx.font = '700 ' + size + 'px system-ui, sans-serif'; const w = (ctx.measureText ? ctx.measureText(String(s)).width : s.length * size * 0.6) + h * 0.9;
      box(ctx, x, y, w, h, fill, null, h / 2); txt(ctx, s, x + w / 2, y + h / 2 + 0.5, { size, bold: true, color: fg, align: 'center' }); return w;
    }
    // Layout in Pixeln: 'wide' (Bild links, Messwerte rechts, Bedienpult unten) oder 'tall' (alles untereinander, fuer Hochformat und Handy)
    function layout(w, h) {
      const wide = w >= h * 1.15, fs = clamp(Math.round(Math.min(w / 64, h / 34)), 12, 16), pad = Math.max(6, Math.round(Math.min(w, h) * 0.014)), head = Math.round(fs * 2.3);
      let main, side, strip;
      if (wide) {
        const stripH = clamp(h * 0.27, 112, 190), colW = clamp(w * 0.28, 250, 340);
        main = { x: pad, y: head, w: w - colW - 3 * pad, h: h - head - stripH - 2 * pad };
        side = { x: w - colW - pad, y: head, w: colW, h: main.h };
        strip = { x: pad, y: h - stripH - pad, w: w - 2 * pad, h: stripH };
      } else {
        const sideH = clamp(h * 0.22, 150, 220), stripH = clamp(h * 0.27, 200, 260), mainH = Math.max(120, h - head - sideH - stripH - 4 * pad);
        main = { x: pad, y: head, w: w - 2 * pad, h: mainH };
        side = { x: pad, y: head + mainH + pad, w: w - 2 * pad, h: sideH };
        strip = { x: pad, y: side.y + sideH + pad, w: w - 2 * pad, h: stripH };
      }
      return { wide, fs, pad, head, main, side, strip, w, h };
    }
    // Plaetze im Bedienstreifen: Knoepfe und Lampe (oben) und Kippschalter (unten); im Querformat alle in einer Reihe
    function slots(L, nTop, nBot) {
      const out = { top: [], bot: [] }, S = L.strip;
      if (L.wide) {
        const n = nTop + nBot, sw = S.w / Math.max(1, n);
        for (let i = 0; i < n; i++) { const it = { x: S.x + sw * i, y: S.y, w: sw, h: S.h }; (i < nTop ? out.top : out.bot).push(it); }
      } else {
        const rowH = S.h / 2;
        for (let i = 0; i < nTop; i++) out.top.push({ x: S.x + S.w / nTop * i, y: S.y, w: S.w / nTop, h: rowH });
        for (let i = 0; i < nBot; i++) out.bot.push({ x: S.x + S.w / nBot * i, y: S.y + rowH, w: S.w / nBot, h: rowH });
      }
      return out;
    }
    // Bedienelemente des Bildes (Knoepfe, Lampe, Kippschalter) mit Treffbereichen in Pixeln (Platz fuer die Beschriftung von THM_DRAW: je 26 px ueber und unter dem Knopf)
    function items(L, scn) {
      const sl = slots(L, scn.knobs.length + 1, scn.switches.length), out = [];
      scn.knobs.forEach((k, i) => { const s = sl.top[i], r = clamp(Math.min(s.w * 0.26, (s.h - 60) / 2), 14, 34); out.push({ type: 'knob', def: k, cx: s.x + s.w / 2, cy: s.y + s.h / 2, r, slot: s }); });
      { const s = sl.top[scn.knobs.length]; out.push({ type: 'lamp', cx: s.x + s.w / 2, cy: s.y + s.h * 0.4, r: clamp(Math.min(s.w * 0.3, s.h * 0.28), 16, 30), slot: s }); }
      scn.switches.forEach((sw, i) => { const s = sl.bot[i]; out.push({ type: 'switch', def: sw, cx: s.x + s.w / 2, cy: s.y + s.h * 0.45, slot: s }); });
      return out;
    }
    const KNOB_A0 = -2.356, KNOB_SWEEP = 4.712;   // -135 Grad bis +135 Grad
    function knobFrac(k, v) {
      const lo = k.lo, hi = k.hi; v = clamp(v, lo, hi);
      if (k.scale === 'log' && lo > 0) return Math.log(v / lo) / Math.log(hi / lo);
      return (v - lo) / (hi - lo);
    }

    // ---------------------------------------------------------------------------------------------------------------
    //  Rig-Fabrik
    // ---------------------------------------------------------------------------------------------------------------
    function makeRig(def, opts) {
      opts = opts && typeof opts === 'object' ? opts : {};
      const CORE = getCore();
      const h = def.h; let SHUT = null, DESTROY = null;
      const dv0 = (CORE.devices && CORE.devices[def.deviceOf({ device: (opts.controls && opts.controls.device) || '7805' })]) || {};
      const params = Object.freeze(Object.assign({ h: def.h, timeScale: def.timeScale, tShut: dv0.shutdown ? dv0.shutdown.on : null, tShutBack: dv0.shutdown ? dv0.shutdown.off : null, tDestroy: dv0.destroyAt || null }, def.params, (opts.params && typeof opts.params === 'object') ? opts.params : {}));
      const ctl = {}, dmap = {};
      def.controls.forEach(c => { ctl[c.key] = c.value; dmap[c.key] = c; });
      const ev = [];
      const meters = def.meters.map(m => Object.assign({}, m));
      let symSet = 'db', viewId = 'schnitt', theme = 'auto', colorsOverride = null, drawErr = null, lastHs = 'm';
      let t = 0, k = 0, acc = 0, throttled = false, th = null;
      let shutdown = false, shutTimes = [], shutCount = 0, destroyed = false, tShutStart = 0, lastShutEvt = -1e9, pendelSaid = false;
      let TR = null, act = [], prevAct = {}, lastSeen = {}, lastOp = null, dingDone = false, problem = false, touched = false, settled = false;
      let cfgKeyC = '', needEval = false, tjC = 25, cfgDirty = true, cfgC = null, chC = null, chLast = null, memoKey = null, memoVal = null;
      const S = key => symOf(CORE, key, symSet);
      // Meldungstexte: einzige Quelle ist THM_CORE.TEXTS (diag, rig) und THM_CORE.diagnose; hier nur, was der Kern nicht kennt (Zahlen aus den Rechnungen der Anlage)
      const dtext = (id, vars) => CORE.fill((CORE.TEXTS && CORE.TEXTS.diag && CORE.TEXTS.diag[id]) || '', vars, symSet);
      const LT = {
        wertFalsch: (CORE.TEXTS && CORE.TEXTS.rig && CORE.TEXTS.rig.wertAblehnen) || 'Diesen Wert gibt es an dieser Anlage nicht.',
        gedrosselt: ((CORE.TEXTS && CORE.TEXTS.rig && CORE.TEXTS.rig.zeitraffer) || 'Zeitraffer gedrosselt') + ': Die Anlage rechnet nicht schneller, als der Rechner schafft.',
        wieder: sh => 'Der Regler hat sich auf ' + fn(sh.off, 0) + ' °C abgekühlt und schaltet wieder ein.',
        ding: (tj, tjMax) => 'Gut gemacht: Die Sperrschicht ist mit ' + fn(tj, 1) + ' °C wieder unter der zulässigen Grenze (' + fn(tjMax, 0) + ' °C).',
        beharrung: tj => ((CORE.TEXTS && CORE.TEXTS.rig && CORE.TEXTS.rig.beharrung) || 'Beharrungszustand') + ': Alle Temperaturen sind eingeschwungen (' + S('Tj') + ' = ' + fn(tj, 1) + ' °C).',
        keinBeharrung: 'Es gibt keinen Beharrungszustand: Die Abschaltung oder der Defekt greift. Die Anlage startet kalt und läuft bis zu diesem Ereignis.'
      };
      const say = (text, kind, fx, id) => { const e = { t, text, kind: kind || 'info' }; if (fx) e.fx = fx; if (id) e.id = id; ev.push(e); if (ev.length > 150) ev.shift(); };
      const X = { memo(key, fn) { if (memoKey === key) return memoVal; memoVal = fn(); memoKey = key; return memoVal; }, devData, ctl, params, CORE, h, S, fm, fn, clamp, num, say, getChain: () => getChain(), cfg: () => cfgNow(), nodes: () => nodes(), flags: () => flags(), time: () => t, shutTimes: () => shutTimes, shutCount: () => shutCount, helpers: { pzulOf, tjMaxOf, rthCKOf, steadyOf } };

      // ---- Kern-Adapter ----
      function devData(id) { const d = CORE.devices && CORE.devices[id]; return d && typeof d === 'object' ? d : {}; }
      function tjMaxOf(id) { return pick(devData(id).tjMax, ['x'], 125); }
      function pkgOf(id) { return devData(id).pkg || 'TO-220'; }
      function refreshDev() { const d = devData(def.deviceOf(ctl)); SHUT = d.shutdown || null; DESTROY = pick(d.destroyAt, ['x'], 0) || null; }
      function cfgNow() {
        if (!cfgDirty && cfgC) return cfgC;
        const c = def.cfg(ctl, CORE);
        cfgC = c; cfgKeyC = JSON.stringify(c); chC = null; cfgDirty = false; return c;
      }
      function getChain() { const c = cfgNow(); if (!chC) { const r = CORE.chain(c); if (r && r.ok) { chC = r; chLast = r; } else chC = chLast || { ok: true, mode: 'frei', rthJC: 5, rthCK: 0, rthK: 0, rthTotal: 50, count: 1, cth: { j: 0.05, c: 1.5, k: 0 }, faults: [], pkg: 'TO-220', tjMax: 125, dev: {} }; } return chC; }
      function faultIds(ch) {
        if (ch && Array.isArray(ch.faults)) return ch.faults.map(f => typeof f === 'string' ? f : (f && f.id) || '');
        return null;
      }
      function pzulOf(cfg, ta) { return pick(CORE.pzul(cfg, ta), ['value', 'pzul', 'p', 'P'], NaN); }
      function rthCKOf(joint, paste, screw) { return pick(CORE.mount.rthCK(getChain().pkg || pkgOf(def.deviceOf(ctl)), joint, paste, screw), ['x'], NaN); }
      function steadyOf(cfg, P, ta) { return CORE.steady(cfg, P, ta) || {}; }
      function thReset() { try { th.reset(ctl.ta); } catch (e) { /* ignorieren */ } tjC = ctl.ta; }
      function ensureTh() { if (!th) { th = CORE.thermal(cfgNow()); thReset(); } return th; }
      function nodes() {
        const s = ensureTh().state() || {}, ch = getChain();
        const one = v => Array.isArray(v) ? (v.length ? Math.max.apply(null, v) : NaN) : v;
        let tj = one(s.tj), tc = one(s.tc), tk = one(s.tk);
        if (!isFinite(tj)) tj = ctl.ta; if (!isFinite(tc)) tc = tj;
        if (!isFinite(tk) || (ch && ch.mode === 'frei')) tk = tc;
        return { tj, tc, tk };
      }
      function flags() { return { shutdown, destroyed, short: shortNow() }; }
      let shortKey = null, shortVal = false;
      function shortNow() {   // Kurzschluss laut THM_CORE.chain (faults), je Kette nur einmal ausgewertet
        const ch = getChain();
        if (shortKey !== ch) { shortKey = ch; const ids = faultIds(ch); shortVal = !!ids && ids.indexOf('kurzschluss') >= 0; }
        return shortVal;
      }
      function curOp(tj) { return def.op(X, isFinite(tj) ? tj : ctl.ta, flags()); }

      // ---- Schreiber ----
      const REC = 16, MAXPTS = 6000;
      function resetTrace() { TR = { t: [], tj: [], tc: [], tk: [], p: [], on: [] }; }
      function record() {
        const nd = nodes(), op = lastOp || curOp(nd.tj);
        TR.t.push(t); TR.tj.push(nd.tj); TR.tc.push(nd.tc); TR.tk.push(nd.tk); TR.p.push(op.pTot); TR.on.push(shutdown ? 1 : 0);
        if (TR.t.length > MAXPTS + 400) { const cut = TR.t.length - MAXPTS; ['t', 'tj', 'tc', 'tk', 'p', 'on'].forEach(kk => TR[kk].splice(0, cut)); }
      }
      function defSpan() { const hs = ctl.heatsink; return hs === 'none' ? 1800 : (hs === 'l' || hs === 'xl') ? 7200 : 3600; }
      function trace(spanS) {
        spanS = num(spanS, defSpan()); if (!(spanS > 0)) spanS = defSpan();
        const n = TR.t.length, out = { t: [], tj: [], tc: [], tk: [], ta: [], p: [], extra: { shut: [] }, lines: lines(), span: spanS };
        if (!n) return out;
        const t0 = TR.t[n - 1] - spanS; let i0 = n - 1; while (i0 > 0 && TR.t[i0 - 1] >= t0) i0--;
        const st = Math.max(1, Math.ceil((n - i0) / 600)), idx = [];
        for (let i = n - 1; i >= i0; i -= st) idx.push(i);
        idx.reverse().forEach(i => { out.t.push(TR.t[i]); out.tj.push(TR.tj[i]); out.tc.push(TR.tc[i]); out.tk.push(TR.tk[i]); out.ta.push(ctl.ta); out.p.push(TR.p[i]); out.extra.shut.push(TR.on[i]); });
        return out;
      }
      function lines() { return { tjMax: tjMaxOf(def.deviceOf(ctl)), tShut: SHUT ? SHUT.on : null, tShutBack: SHUT ? SHUT.off : null, ta: ctl.ta, tDestroy: DESTROY ? DESTROY : null }; }

      // ---- Kernschritt ----
      function kernel() {
        k++; t = k * h;
        const tj = tjC; let flipped = false;
        if (SHUT && !destroyed) {
          const nowShut = CORE.shutdownStep(shutdown, tj, def.deviceOf(ctl));
          if (!shutdown && nowShut) {
            shutdown = true; shutCount++; shutTimes.push(t); if (shutTimes.length > 400) shutTimes.shift(); tShutStart = t; problem = true;
            // beim schnellen Pendeln nicht jede Abschaltung melden (die Zahl steht in der Meldung "pendeln")
            if (shutCount === 1 || t - lastShutEvt > 120) { say(dtext('abschalt', { on: fn(SHUT.on, 0), off: fn(SHUT.off, 0) }), 'warn', 'shutdown'); lastShutEvt = t; }
            if (!pendelSaid && shutTimes.filter(x => t - x <= 3600).length >= 2) { pendelSaid = true; say(dtext('pendeln', { n: shutCount }), 'warn'); }
            flipped = true;
          } else if (shutdown && !nowShut) {
            shutdown = false; flipped = true; if (t - tShutStart >= 30) say(LT.wieder(SHUT), 'info');
          }
        }
        if (DESTROY && !destroyed && tj >= DESTROY) { destroyed = true; problem = true; say(dtext('defekt', {}), 'error', 'defekt'); flipped = true; }
        const op = def.op(X, tj, { shutdown, destroyed, short: shortNow() });
        lastOp = op;
        const tjN = ensureTh().step(h, op.pNode, ctl.ta); tjC = isFinite(tjN) ? tjN : tjC;
        if (k % REC === 0) record();
        if (flipped || needEval || k % 8 === 0) { needEval = false; evaluate(); }
      }
      function stepProcess(dtS) {
        dtS = num(dtS, 0); if (!(dtS > 0)) return 0;
        acc += dtS / h;
        const n = Math.floor(acc + 1e-9); acc -= n;
        for (let i = 0; i < n; i++) kernel();
        return n;
      }
      function step(dtMs) {
        dtMs = num(dtMs, 0); if (!(dtMs > 0)) return;
        let dtS = dtMs / 1000 * def.timeScale;
        if (dtS / h > 2000) { dtS = 2000 * h; if (!throttled) { throttled = true; say(LT.gedrosselt, 'info'); } } else throttled = false;
        stepProcess(dtS);
      }

      // ---- Meldungen (SPEC 4.8): jede Aussage nur bei erfuellter, im Code stehender Bedingung ----
      function snapshot() {
        const nd = nodes(), cfg = cfgNow(), ch = getChain(), op = curOp(nd.tj), id = def.deviceOf(ctl);
        return { cfg, ch, op, id, tj: nd.tj, tc: nd.tc, tk: nd.tk, ta: ctl.ta, tjMax: tjMaxOf(id), shutdown, destroyed, shutCount, t };
      }
      // Pendeln: mindestens zwei Abschaltungen in der letzten Stunde Prozesszeit und die letzte nicht laenger als 5 Minuten her
      function pendelAktiv() { if (!SHUT || shutTimes.length < 2) return false; const last = shutTimes[shutTimes.length - 1]; return t - last <= 300 && shutTimes.filter(x => t - x <= 3600).length >= 2; }
      function diagCtx(Sx) {
        const ctx = { cfg: Sx.cfg, p: Sx.op.pOn !== undefined ? Sx.op.pOn : Sx.op.p1, ta: Sx.ta, tj: Sx.tj, tc: Sx.tc, tk: Sx.tk, tjMax: Sx.tjMax, shutdown: Sx.shutdown, shutCount: pendelAktiv() ? Sx.shutCount : 0, destroyed: Sx.destroyed, set: symSet };
        const contact = Sx.cfg.heatsink !== 'none' && (Sx.cfg.joint === 'direkt' || Sx.cfg.bushing === false), ex = def.diagExtra ? def.diagExtra(Sx, X) : {};
        ctx.tabV = contact && isFinite(ex.tabV) ? ex.tabV : 0;     // nur wenn die Fahne den Kuehlkoerper beruehrt, fuehrt er ihre Spannung
        if (ex.elec) ctx.elec = ex.elec; if (ex.op) ctx.op = ex.op; if (ex.runaway) ctx.runaway = ex.runaway;
        return ctx;
      }
      const SELF_EVT = { abschalt: 1, pendeln: 1, defekt: 1 };
      function evaluate() {
        const Sx = snapshot(); let out = [];
        try { out = CORE.diagnose(diagCtx(Sx)) || []; } catch (e) { out = []; }
        const cur = {};
        // beim Pendeln kehrt eine Meldung im Sekundentakt wieder: dieselbe Meldung hoechstens alle 20 Prozess-Sekunden neu melden
        out.forEach(d => { cur[d.id] = true; const was = lastSeen[d.id]; if (!prevAct[d.id] && !SELF_EVT[d.id] && !(was !== undefined && t - was <= 20)) say(d.text, d.kind, d.fx, d.id); lastSeen[d.id] = t; });
        // Zurueck im gruenen Bereich nach einem Eingriff: nur einmal je Lauf
        const bad = out.some(d => d.kind === 'error' || d.id === 'abschalt' || d.id === 'pendeln');
        if (bad) problem = true;
        if (problem && touched && !bad && !Sx.destroyed && Sx.tj <= Sx.tjMax && !dingDone) { dingDone = true; say(LT.ding(Sx.tj, Sx.tjMax), 'info', 'ding'); }
        prevAct = cur; act = out;
      }
      function diagnose() { return act.map(d => Object.assign({}, d)); }

      // ---- Fixpunkt und Beharrungszustand ----
      function fixedPoint(fl) {
        let p = def.op(X, ctl.ta, fl).p1, tj = ctl.ta;
        for (let i = 0; i < 400; i++) {
          const s = steadyDevice(p), tjN = s.tj;
          const pN = def.op(X, tjN, fl).p1;
          if (!isFinite(pN) || tjN > 5000) return { ok: false, p: pN, tj: tjN };
          if (Math.abs(pN - p) < 1e-13) { p = pN; tj = tjN; return { ok: true, p, tj }; }
          p = pN; tj = tjN;
        }
        return { ok: false, p, tj };
      }
      // stationaere Temperaturen eines Bauteils bei Verlustleistung p je Bauteil (count Bauteile auf einem Kuehlkoerper: THM_CORE.steady rechnet n*P am Kuehlkoerper)
      function steadyDevice(p) {
        const cfg = cfgNow(), ch = getChain(), ta = ctl.ta, s = steadyOf(cfg, p, ta);
        const tj = pick(s.tj, ['x'], NaN), tc = pick(s.tc, ['x'], NaN), frei = ch.mode === 'frei';
        const tk = frei ? tc : pick(s.tk, ['x'], NaN);
        return { tj, tc, tk, dJC: pick(s.dJC, ['x'], NaN), dCK: frei ? 0 : pick(s.dCK, ['x'], NaN), dK: frei ? tc - ta : pick(s.dK, ['x'], NaN), rthTotal: pick(s.rthTotal, ['x'], ch.rthTotal), steps: s.steps || [] };
      }
      function steady() {
        const cnt = getChain().count || 1, fl = { shutdown: false, destroyed: false, short: shortNow() }, fp = fixedPoint(fl);
        const p = fp.ok ? fp.p : def.op(X, ctl.ta, fl).p1, s = steadyDevice(p), id = def.deviceOf(ctl), tjMax = tjMaxOf(id);
        const stable = fp.ok && isFinite(s.tj);
        const r = { pv: p, pTotal: p * cnt, tj: stable ? s.tj : NaN, tc: stable ? s.tc : NaN, tk: stable ? s.tk : NaN, dJC: s.dJC, dCK: s.dCK, dK: s.dK, rthTotal: s.rthTotal, tjMax, count: cnt, stable, steps: s.steps };
        r.shutExpected = !!SHUT && stable && s.tj >= SHUT.on; r.tjFinite = stable ? s.tj : 1e4;
        Object.keys(r).forEach(kk => { if (typeof r[kk] === 'number' && !isFinite(r[kk])) r[kk] = kk.startsWith('t') ? 1e4 : 0; });
        return r;
      }
      function settle() {
        const fl = { shutdown: false, destroyed: false, short: shortNow() }, fp = fixedPoint(fl);
        const s = fp.ok ? steadyDevice(fp.p) : null;
        const hot = !fp.ok || (SHUT && s.tj >= SHUT.on) || (DESTROY && s.tj >= DESTROY);
        if (!hot) {
          // analytisch: ein sehr grosser exakter Schritt liefert den stationaeren Zustand
          shutdown = false; shutTimes = []; ensureTh().settle(def.op(X, fp.tj, fl).pNode, ctl.ta); tjC = th.state().tj;
          lastOp = def.op(X, tjC, flags()); settled = true; record();
          say(LT.beharrung(nodes().tj), 'info', 'tick'); return true;
        }
        // Es gibt keinen Beharrungszustand (Abschaltung, Defekt oder Weglaufen): kalt starten und bis zum Ereignis laufen lassen
        thReset(); shutdown = false;
        const n0 = shutCount, d0 = destroyed; let guard = 0;
        while (guard++ < 80000 && shutCount === n0 && destroyed === d0) kernel();
        settled = false; say(LT.keinBeharrung, 'info', 'tick'); return false;
      }

      // ---- Lesen ----
      const fin = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
      function baseVals(nd, op) {
        const ch = getChain(), cfg = cfgNow(), frei = ch.mode === 'frei', cnt = ch.count || 1;
        const pz = pzulOf(cfg, ctl.ta);
        return { tj: nd.tj, tc: nd.tc, tk: nd.tk, ta: ctl.ta, dJC: nd.tj - nd.tc, dCK: frei ? 0 : nd.tc - nd.tk, dK: frei ? nd.tc - ctl.ta : nd.tk - ctl.ta, rthJC: ch.rthJC, rthCK: ch.rthCK, rthK: frei ? 0 : ch.rthK, rthTot: ch.rthTotal, pzul: isFinite(pz) ? pz : 0, mode: ch.mode, cnt };
      }
      function readMeters() {
        const nd = nodes(), op = curOp(nd.tj), b = baseVals(nd, op);
        const m = def.meters_(X, op, nd, b);
        m.tj = b.tj; m.tc = b.tc; m.tk = b.tk; m.rthTot = b.rthTot; m.pzul = b.pzul; m.dtJC = b.dJC; m.dtCK = b.dCK; m.dtK = b.dK;
        Object.keys(m).forEach(kk => { m[kk] = fin(m[kk]); });
        return m;
      }
      function tauOf() { try { return pick(ensureTh().tauDominant(), ['tau', 'value'], NaN); } catch (e) { return NaN; } }
      function state() {
        const nd = nodes(), op = curOp(nd.tj), b = baseVals(nd, op), id = def.deviceOf(ctl);
        const faults = act.filter(d => d.kind !== 'info').map(d => d.id);
        const s = { t, device: id, pv: op.p1, pTotal: op.pTot, tj: nd.tj, tc: nd.tc, tk: nd.tk, ta: ctl.ta, rthJC: b.rthJC, rthCK: b.rthCK, rthK: b.rthK, rthTotal: b.rthTot, dJC: b.dJC, dCK: b.dCK, dK: b.dK,
          pzul: b.pzul, mode: b.mode, shutdown, shutCount, destroyed, short: shortNow(), tjMax: tjMaxOf(id), faults, tau: tauOf(), count: b.cnt, throttled, settled };
        MOUNT_STATE.forEach(kk => { if (ctl[kk] !== undefined) s[kk] = ctl[kk]; });
        Object.assign(s, def.state_ ? def.state_(X, op, nd, b) : {});
        Object.keys(s).forEach(kk => { if (typeof s[kk] === 'number' && !isFinite(s[kk])) s[kk] = 0; });
        return s;
      }
      function chain() { return getChain(); }
      function analysis() {
        const st = steady(), cfg = cfgNow(), id = def.deviceOf(ctl), out = { ok: true, steps: [], result: { pv: st.pv, tj: st.tj, tc: st.tc, tk: st.tk, rthTotal: st.rthTotal, tjMax: st.tjMax }, warn: [] };
        if (typeof CORE.recipe === 'function') {
          try {
            const inp = { cfg, device: id, ta: ctl.ta, count: st.count }, op = def.recipeOp ? def.recipeOp(X) : null; if (op) inp.op = op; else inp.p = st.pv;
            const r = CORE.recipe(inp); if (r && r.ok !== false && Array.isArray(r.steps) && r.steps.length) return r;
          } catch (e) { /* Fallback */ }
        }
        out.steps = (st.steps || []).map((x, k) => ({ n: k + 1, title: '', lines: [String(x)] }));
        if (!st.stable) { out.ok = false; out.warn.push(LT.keinBeharrung); }
        return out;
      }
      function identify() {
        const st = steady(), cfg = cfgNow(), tau = tauOf();
        let tau63 = NaN, tauList = [tau];
        try {
          const th2 = CORE.thermal(cfg), tEnd = Math.max(60, 8 * (isFinite(tau) ? tau : 600)), n = 480, r = th2.stepResponse(tEnd, n);
          if (r && Array.isArray(r.t) && Array.isArray(r.tj)) {
            const T0 = r.tj[0], T1 = r.tj[r.tj.length - 1], lev = T0 + 0.6321205588 * (T1 - T0);
            for (let i = 1; i < r.tj.length; i++) if (r.tj[i] >= lev) { tau63 = r.t[i - 1] + (lev - r.tj[i - 1]) / (r.tj[i] - r.tj[i - 1]) * (r.t[i] - r.t[i - 1]); break; }
          }
          const tl = typeof th2.tauList === 'function' ? th2.tauList() : th2.tauList; if (Array.isArray(tl) && tl.length) tauList = tl.slice();
        } catch (e) { /* Werte bleiben NaN */ }
        let rk = null; try { const r = CORE.rthKerf(cfg, st.pv, ctl.ta); rk = r && typeof r === 'object' ? r : { ok: true, value: r }; } catch (e) { rk = null; }
        return { tau, tau63, tauList, tjSteady: st.tj, pzul: baseVals(nodes(), null).pzul, rthKerf: rk };
      }
      function thermalInfo() {
        const ch = getChain(), cnt = ch.count || 1, st = baseVals(nodes(), null), cth = ch.cth || {};
        return { P: curOp(nodes().tj).p1, count: cnt, rth: { jc: ch.rthJC, ck: ch.rthCK, k: ch.mode === 'frei' ? 0 : ch.rthK }, ta: ctl.ta, cth: { j: cth.j, c: cth.c, k: cth.k }, tjMax: tjMaxOf(def.deviceOf(ctl)), mode: st.mode };
      }

      // ---- Steuerwerte ----
      function validate(key, v) {
        const d = dmap[key]; if (!d) return { ok: false };
        if (d.type === 'slider') { v = num(v, NaN); if (!isFinite(v)) return { ok: false }; return { ok: true, v: clamp(v, d.min, d.max) }; }
        if (d.type === 'select') {
          for (let i = 0; i < d.options.length; i++) if (d.options[i].value === v || (typeof v !== 'object' && v !== null && v !== undefined && String(d.options[i].value) === String(v))) return { ok: true, v: d.options[i].value };
          return { ok: false };
        }
        if (typeof v === 'string') { if (v === 'true' || v === 'an') v = true; else if (v === 'false' || v === 'aus' || v === '') v = false; else return { ok: false }; }
        if (v !== true && v !== false && v !== 0 && v !== 1) return { ok: false };
        return { ok: true, v: !!v };
      }
      function onCfgChange() { cfgDirty = true; chC = null; if (th && typeof th.setCfg === 'function') { th.setCfg(cfgNow()); tjC = th.state().tj; } }
      function setControl(key, value) {
        const r = validate(key, value);
        if (!r.ok) { say(LT.wertFalsch, 'warn'); return false; }
        const old = ctl[key]; ctl[key] = r.v; needEval = true;
        if (problem) touched = true;
        if (key === 'heatsink' && r.v !== 'none') lastHs = r.v;
        if (CFG_KEYS.indexOf(key) >= 0 || key === 'blechA') onCfgChange();
        if (def.onControl) def.onControl(key, old, X);
        return true;
      }
      function getControl(key) { return ctl[key]; }
      function resetCtl() { def.controls.forEach(c => { ctl[c.key] = c.value; }); }
      function applyPreset(id) {
        const p = (def.presets || []).find(q => q.id === id); if (!p) return false;
        resetCtl(); lastHs = 'm';
        Object.keys(p.params || {}).forEach(kk => { const r = validate(kk, p.params[kk]); if (r.ok) ctl[kk] = r.v; });
        cfgDirty = true; chC = null;
        initState(); if (p.settle) settle();
        return true;
      }
      function initState() {
        k = 0; acc = 0; t = 0; ev.length = 0; throttled = false; shutdown = false; shutTimes = []; shutCount = 0; destroyed = false; refreshDev();
        dingDone = false; problem = false; touched = false; act = []; prevAct = {}; lastSeen = {}; needEval = true; settled = false; cfgDirty = true; chC = null; tShutStart = 0; lastShutEvt = -1e9; pendelSaid = false;
        th = CORE.thermal(cfgNow()); thReset(); lastOp = null;
        lastOp = curOp(nodes().tj);
        resetTrace(); record();
      }

      // ---- Kennlinien ----
      function heatCurve(pp, tjMax, title) {
        const cfg = cfgNow(), ta = ctl.ta, tau = tauOf(), tEnd = Math.max(120, 5 * (isFinite(tau) ? tau : 600)), pts = [];
        try { const r = CORE.thermal(cfg).stepResponse(tEnd, 60); for (let i = 0; i < r.t.length; i++) pts.push([+(r.t[i] / 60).toFixed(3), +(ta + pp * (r.tj[i] - r.tj[0])).toFixed(3)]); } catch (e) { /* leer */ }
        const sd = steadyDevice(pp), tj63 = ta + (sd.tj - ta) * 0.632;
        return { id: 'heat', title: title, xLabel: 'Prozesszeit', xUnit: 'min', yLabel: 'Sperrschichttemperatur', yUnit: '°C', series: [{ name: 'Tj(t)', points: pts }, { name: 'Tj,max', points: [[0, tjMax], [+(tEnd / 60).toFixed(2), tjMax]], style: 'limit' }], marker: { x: +((isFinite(tau) ? tau : 0) / 60).toFixed(3), y: +tj63.toFixed(2) }, note: 'Marke: 63 % des Endwerts nach der Zeitkonstante' };
      }
      function curves() { return def.curves(X, { cfgNow, getChain, steadyOf, pzulOf, tjMaxOf, ensureTh, tauOf, fixedPoint, heatCurve, steadyDevice }); }

      // ---- Zeichnen ----
      const W = def.world;
      let palCache = { t: -1e9, v: null }, levelMemo = { key: '', v: 1 };
      function themeName() {
        if (theme !== 'auto') return theme;
        try { const a = root.document && root.document.documentElement.getAttribute('data-theme'); if (a === 'light' || a === 'dark') return a; } catch (e) { /* ohne Seite */ }
        try { return root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch (e) { return 'dark'; }
      }
      function palette(D, tms) {
        if (colorsOverride) return Object.assign({}, PAL.dark, colorsOverride);
        if (palCache.v && Math.abs(tms - palCache.t) < 500) return palCache.v;
        const th2 = themeName(); let css = {};
        try { if (D && typeof D.cssColors === 'function' && root.document) css = D.cssColors(root.document.documentElement) || {}; } catch (e) { css = {}; }
        const v = Object.assign({}, PAL[th2] || PAL.dark, css, { theme: css.theme || th2 });
        palCache = { t: tms, v }; return v;
      }
      function reducedNow() { if (rig.reduced !== undefined) return !!rig.reduced; try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
      function sceneNow(op) { return def.scene(X, op, { ctl, view: viewId, shutdown, destroyed, S }); }
      // Aufheizfortschritt 0..1 fuer die Waermepfeile (beim Aufheizen blasser, im Beharrungszustand voll)
      function levelOf(nd, op) {
        cfgNow(); const key = [cfgKeyC, ctl.ta, Math.round(op.pOn * 100)].join('|');
        if (levelMemo.key !== key) { const s = steadyDevice(op.pOn); levelMemo = { key, v: s.tj - ctl.ta }; }
        const full = levelMemo.v; return full > 0.05 ? clamp((nd.tj - ctl.ta) / full, 0, 1) : 1;
      }
      function aufbau(nd, op, b, tms, pal, m, scn, fs) {
        const ch = getChain(), cfg = cfgNow(), id = def.deviceOf(ctl), d = devData(id), tab = d.tab || {}, tjMax = tjMaxOf(id), frei = ch.mode === 'frei';
        const hsName = frei ? '' : (cfg.heatsink === 'blech' ? 'Kühlblech ' + fn(ctl.blechA, 0) + ' cm²' : ((CORE.heatsinks && CORE.heatsinks.byId && CORE.heatsinks.byId[cfg.heatsink]) || {}).name || '');
        const jo = CORE.mount && CORE.mount.options && CORE.mount.options.joint ? CORE.mount.options.joint.find(q => q.value === cfg.joint) : null;
        // Rippentemperaturen (Fuss zur Spitze) nur fuer die Katalogprofile mit Rippenmodell (THM_CORE.heatsink.finProfile)
        let fin; if (!frei && ['s', 'm', 'l', 'xl'].indexOf(cfg.heatsink) >= 0 && CORE.heatsink && CORE.heatsink.finProfile) { try { const fp = CORE.heatsink.finProfile(cfg.heatsink, nd.tk, ctl.ta, 12); if (fp && fp.ok) fin = Array.prototype.slice.call(fp); } catch (e) { fin = undefined; } }
        return {
          fin, device: id, pkg: ch.pkg === 'DO-41' ? 'DO-201' : ch.pkg, mode: ch.mode, count: ch.count || 1, heatsink: cfg.heatsink, blechA: ctl.blechA, joint: cfg.joint, paste: cfg.paste, bushing: cfg.bushing, screw: cfg.screw, ksPot: cfg.ksPot, fan: cfg.fan, orient: cfg.orient,
          P: op.p1, ta: ctl.ta, tj: nd.tj, tc: nd.tc, tk: frei ? nd.tc : nd.tk, tjMax, tShut: SHUT ? SHUT.on : NaN,
          rthJC: ch.rthJC, rthCK: frei ? 0 : ch.rthCK, rthK: frei ? 0 : ch.rthK, rthTotal: ch.rthTotal, rthCA: frei ? ch.rthCA : 0, rthK0: ch.rthK0, fanFactor: ch.fanF, orientFactor: ch.orientF,
          dJC: b.dJC, dCK: b.dCK, dK: frei ? 0 : b.dK, dCA: frei ? nd.tc - ctl.ta : 0, cth: ch.cth, shutdown, destroyed, short: shortNow(), level: levelOf(nd, op), t: tms / 1000,
          lo: ctl.ta, hi: tjMax + 30, sym: { tj: S('Tj'), tc: S('Tc'), tk: S('Tk'), ta: S('Ta'), rthJC: S('Rth_JC'), rthCK: S('Rth_CK'), rthK: S('Rth_K'), rthJA: S('Rth_JA'), P: S('P'), tjMax: S('Tjmax') },
          heatsinkName: hsName, jointName: jo ? jo.label : '', fahneText: tab.potText || '', ksText: cfg.ksPot === 'masse' ? 'Masse' : 'frei', reduced: reducedNow(), colors: pal, compact: m.w < 520
        };
      }
      function fallbackMain(ctx, r, pal, fs, text) { txt(ctx, text, r.w / 2, r.h / 2, { size: fs, color: pal.mute, align: 'center' }); }
      function draw(ctx, w, hh, tms) {
        if (!ctx || !(w > 0) || !(hh > 0) || !isFinite(w) || !isFinite(hh)) return;
        tms = num(tms, 0);
        try {
          const D = opts.noDraw ? null : getDraw(), pal = palette(D, tms), nd = nodes(), op = curOp(nd.tj), b = baseVals(nd, op), scn = sceneNow(op);
          const L = layout(w, hh), fs = L.fs, its = items(L, scn), m = L.main;
          ctx.save();
          // Kopfzeile
          drawHeader(ctx, w, L, scn, pal);
          // Hauptbild: Schnittbild, Waermebild, Ersatzschaltbild oder Balken (THM_DRAW)
          box(ctx, m.x, m.y, m.w, m.h, pal.panel, pal.line, 12);
          const data = aufbau(nd, op, b, tms, pal, m, scn, fs);
          ctx.save(); rrect(ctx, m.x, m.y, m.w, m.h, 12); ctx.clip(); ctx.translate(m.x, m.y);
          let drawn = false;
          if (D) {
            try {
              if (viewId === 'schnitt' && typeof D.schnitt === 'function') drawn = !!D.schnitt(ctx, m.w, m.h, data);
              else if (viewId === 'kamera' && typeof D.kamera === 'function') {
                const p = rig.pointer, cur = p && isFinite(p.x) && isFinite(p.y) && p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h ? { x: p.x - m.x, y: p.y - m.y } : undefined;
                drawn = !!D.kamera(ctx, m.w, m.h, cur ? Object.assign({ cursor: cur }, data) : data);
              } else if (viewId === 'ersatz' && typeof D.ersatz === 'function') {
                const an = CORE.analogie && typeof CORE.analogie.resolved === 'function' ? CORE.analogie.resolved(symSet).map(a => [a.elek, a.therm]) : null;
                drawn = !!D.ersatz(ctx, m.w, m.h, an ? Object.assign({ analogie: an }, data) : data);
              } else if (viewId === 'balken' && typeof D.balken === 'function' && typeof D.balkenData === 'function') drawn = !!D.balken(ctx, { x: 0, y: 0, w: m.w, h: m.h }, D.balkenData([data], { names: [data.device ? def.deviceName(data.device, X) : ''] }));
            } catch (e) { drawErr = e && e.message ? String(e.message) : 'Fehler'; drawn = false; }
          }
          if (!drawn) fallbackMain(ctx, m, pal, fs, D ? 'Diese Ansicht kann nicht gezeichnet werden.' : 'Der Zeichenhelfer thmdraw.js fehlt.');
          ctx.restore();
          drawSide(ctx, L, pal, D, data, nd, op, b, scn);
          const s = L.strip; box(ctx, s.x, s.y, s.w, s.h, pal.panel, pal.line, 12);
          its.forEach(it => drawItem(ctx, it, pal, D, fs, scn, tms));
          ctx.restore();
        } catch (e) { drawErr = e && e.message ? String(e.message) : 'Fehler'; try { ctx.restore(); } catch (e2) { /* ignorieren */ } }
      }
      // Kopfzeile: Titel links, Prozesszeit rechts, dazwischen die Statusplaketten (was nicht passt, entfaellt; die Meldungen stehen in der Liste)
      function textW(ctx, s2, size, bold) { ctx.font = (bold ? '700 ' : '500 ') + size + 'px system-ui, sans-serif'; return ctx.measureText ? ctx.measureText(s2).width : String(s2).length * size * 0.56; }
      function drawHeader(ctx, w, L, scn, pal) {
        const fs = L.fs, fsT = fs + 3, fs1 = Math.max(12, fs - 1), ph = Math.round(fs * 1.5), mid = L.head / 2, min = fm(t / 60, 1) + ' min', avail = w - 2 * L.pad - 4;
        let time = 'Prozesszeit ' + min, title = scn.title;
        if (textW(ctx, title, fsT, true) + 16 + textW(ctx, time, fs, false) > avail) title = scn.titleShort || title;
        if (textW(ctx, title, fsT, true) + 16 + textW(ctx, time, fs, false) > avail) time = 'Prozess ' + min;
        const tW = textW(ctx, title, fsT, true), timeW = textW(ctx, time, fs, false);
        txt(ctx, title, L.pad + 2, mid, { size: fsT, bold: true, color: pal.fg, maxW: Math.max(60, avail - timeW - 8) });
        txt(ctx, time, w - L.pad - 2, mid, { size: fs, color: pal.mute, align: 'right' });
        let xr = w - L.pad - 2 - timeW - 10; const xl = L.pad + 2 + tW + 10;
        (scn.chips || []).slice().sort((p, q) => (q.kind === 'error') - (p.kind === 'error')).forEach(c => { const cw = textW(ctx, c.text, fs1, true) + ph * 0.9; if (xr - cw >= xl) { pill(ctx, c.text, xr - cw, mid - ph / 2, ph, c.kind === 'error' ? pal.danger : c.kind === 'warn' ? pal.warn : pal.accent, '#101418', fs1); xr -= cw + 6; } });
      }
      function drawSide(ctx, L, pal, D, d, nd, op, b, scn) {
        const s = L.side, fs = L.fs; box(ctx, s.x, s.y, s.w, s.h, pal.panel, pal.line, 12);
        // THM_DRAW.thermometer braucht links Platz fuer die Teilstriche und rechts fuer die Marken (T_shut, Tj,max): Roehre bei x + 44, Zahlenzeilen ab x + 150
        const tx = s.x + 44, ty = s.y + 16, thH = Math.max(44, s.h - 16 - 46);
        let ok = false;
        if (D && typeof D.thermometer === 'function') { try { ok = !!D.thermometer(ctx, tx, ty, thH, { value: nd.tj, lo: d.lo, hi: d.hi, tjMax: d.tjMax, shut: d.tShut, destroyed: destroyed, name: d.sym.tj, unit: '°C', colors: pal }); } catch (e) { ok = false; } }
        if (!ok) {
          const bw = Math.max(10, thW * 0.3); box(ctx, tx - bw / 2, ty, bw, thH, pal.panel2, pal.line, bw / 2);
          const fr = clamp((nd.tj - d.lo) / Math.max(1, d.hi - d.lo), 0, 1), fh = Math.max(4, (thH - 4) * fr);
          box(ctx, tx - bw / 2 + 2, ty + thH - 2 - fh, bw - 4, fh, nd.tj > d.tjMax ? pal.danger : pal.ok, null, (bw - 4) / 2);
          const my = ty + thH - 2 - (thH - 4) * clamp((d.tjMax - d.lo) / Math.max(1, d.hi - d.lo), 0, 1); ctx.strokeStyle = pal.danger; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx - bw, my); ctx.lineTo(tx + bw, my); ctx.stroke();
        }
        const x0 = s.x + 150, sg = d.sym, frei = d.mode === 'frei', sig = pal.sig || {};
        const rows = [[sg.tj + ' = ' + fn(nd.tj, 1) + ' °C', sig.tj || pal.danger, true], [sg.tc + ' = ' + fn(nd.tc, 1) + ' °C', sig.tc || pal.warn, false], [frei ? null : sg.tk + ' = ' + fn(d.tk, 1) + ' °C', sig.tk || pal.warn, false],
          [sg.ta + ' = ' + fn(ctl.ta, 0) + ' °C', sig.ta || pal.mute, false], [sg.P + ' = ' + fn(op.pTot, 2) + ' W', sig.p || pal.accent, false]].filter(r => r[0]);
        const extra = (scn.lines || []).slice(0, 2), nRows = rows.length + extra.length * 0.9;
        const rh = Math.min(fs * 2.2, (s.h - 20) / (nRows + 0.4)); let y = s.y + 14 + rh * 0.5;
        rows.forEach(r => { ctx.fillStyle = r[1]; ctx.fillRect(x0, y - fs * 0.5, 5, fs); txt(ctx, r[0], x0 + 12, y, { size: fs, bold: r[2], color: pal.fg, maxW: s.x + s.w - x0 - 18 }); y += rh; });
        extra.forEach(l => { txt(ctx, l, x0, y, { size: Math.max(12, fs - 1), color: pal.mute, maxW: s.x + s.w - x0 - 8 }); y += rh * 0.9; });
      }
      // Lautsprecher-Symbol der Endstufe: Kegel, Schallwellen wachsen mit der Aussteuerung (ohne Bewegung bei reduzierter Animation)
      function drawSpeaker(ctx, x, y, r, lv, pal, tms) {
        const red = reducedNow(), w = red ? 0 : Math.sin(tms / 90) * 1.5 * lv;
        ctx.fillStyle = pal.panel2; ctx.strokeStyle = pal.metal || pal.line; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.rect(x - r * 0.9, y - r * 0.35, r * 0.5, r * 0.7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - r * 0.4, y - r * 0.35); ctx.lineTo(x + r * 0.2 + w, y - r * 0.85); ctx.lineTo(x + r * 0.2 + w, y + r * 0.85); ctx.lineTo(x - r * 0.4, y + r * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = lv > 0.02 ? pal.ok : pal.mute; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        for (let i = 1; i <= 3; i++) { if (lv * 3 + 0.2 < i - 0.6) break; ctx.beginPath(); ctx.arc(x + r * 0.2, y, r * (0.35 + 0.3 * i), -0.7, 0.7); ctx.stroke(); }
        ctx.lineCap = 'butt';
      }
      function drawItem(ctx, it, pal, D, fs, scn, tms) {
        const cl = it.slot;
        if (it.type === 'knob') {
          const k = it.def, v = ctl[k.key], f = knobFrac(k, v), ang = KNOB_A0 + f * KNOB_SWEEP; let ok = false;
          if (D && typeof D.drehregler === 'function') { try { ok = !!D.drehregler(ctx, it.cx, it.cy, it.r, { value: v, lo: k.lo, hi: k.hi, unit: k.unit, digits: k.digits, colors: pal }); } catch (e) { ok = false; } }
          // die Beschriftung zeichnet die Anlage selbst (ganze Breite des Platzes statt gekuerzt)
          if (ok) txt(ctx, k.label, it.cx, it.cy - it.r - 20, { size: Math.max(12, fs - 1), bold: true, color: pal.fg, align: 'center', maxW: cl.w - 6 });
          if (!ok) {
            ctx.fillStyle = pal.panel2; ctx.strokeStyle = pal.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(it.cx, it.cy, it.r, 0, 6.2832); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = pal.fg; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(it.cx, it.cy); ctx.lineTo(it.cx + Math.sin(ang) * it.r * 0.78, it.cy - Math.cos(ang) * it.r * 0.78); ctx.stroke(); ctx.lineCap = 'butt';
            txt(ctx, k.label, it.cx, it.cy - it.r - 14, { size: Math.max(12, fs - 1), color: pal.mute, align: 'center', maxW: cl.w - 6 });
            txt(ctx, k.show(v), it.cx, it.cy + it.r + 16, { size: fs, bold: true, color: pal.fg, align: 'center', maxW: cl.w - 6 });
          }
        } else if (it.type === 'lamp') {
          const lv = clamp(scn.lamp.level, 0, 1); let ok = false;
          if (scn.lamp.kind === 'speaker') { drawSpeaker(ctx, it.cx, it.cy, it.r, lv, pal, tms); ok = true; }
          else if (D && typeof D.lampe === 'function') { try { ok = !!D.lampe(ctx, it.cx, it.cy, { level: lv, size: it.r * 2.3, colors: pal }); } catch (e) { ok = false; } }
          if (!ok) {
            ctx.fillStyle = lv > 0.02 ? 'rgba(255,224,120,' + (0.35 + 0.65 * lv).toFixed(2) + ')' : pal.panel2; ctx.strokeStyle = pal.line; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(it.cx, it.cy, it.r * 0.8, 0, 6.2832); ctx.fill(); ctx.stroke();
          }
          txt(ctx, scn.lamp.label + ' ' + scn.lamp.value, it.cx, it.cy + it.r * 1.15 + fs * 0.9, { size: Math.max(12, fs - 1), bold: true, color: lv > 0.02 ? pal.ok : pal.mute, align: 'center', maxW: cl.w - 6 });
        } else {
          const sw = it.def, on = sw.on(ctl); let ok = false;
          if (D && typeof D.kippschalter === 'function') { try { ok = !!D.kippschalter(ctx, it.cx, it.cy, { on, label: sw.label, colors: pal }); } catch (e) { ok = false; } }
          if (!ok) {
            const bw = clamp(cl.w * 0.55, 34, 56), bh = bw * 0.5; box(ctx, it.cx - bw / 2, it.cy - bh / 2, bw, bh, on ? pal.ok : pal.panel2, pal.line, bh / 2);
            ctx.fillStyle = pal.fg; ctx.beginPath(); ctx.arc(it.cx + (on ? bw / 2 - bh / 2 : -bw / 2 + bh / 2), it.cy, bh * 0.38, 0, 6.2832); ctx.fill();
            txt(ctx, sw.label, it.cx, it.cy + bh / 2 + fs, { size: Math.max(12, fs - 1), color: pal.mute, align: 'center', maxW: cl.w - 4 });
          }
        }
      }
      function hitTest(px, py, w, hh) {
        px = num(px, NaN); py = num(py, NaN); w = num(w, NaN); hh = num(hh, NaN);
        if (!isFinite(px) || !isFinite(py) || !(w > 0) || !(hh > 0)) return null;
        const scn = sceneNow(curOp(nodes().tj)), its = items(layout(w, hh), scn);
        for (let i = 0; i < its.length; i++) {
          const it = its[i];
          if (it.type === 'knob') { if (Math.hypot(px - it.cx, py - it.cy) <= Math.max(it.r * 1.5, 26)) return { key: it.def.key, kind: 'knob' }; }
          else if (it.type === 'switch') { const s = it.slot; if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) return { key: it.def.key, kind: 'switch', value: it.def.to(ctl, lastHs) }; }
        }
        return null;
      }
      function hotspots(w, hh) {   // fuer Tests: alle Treffbereiche in Pixeln
        const scn = sceneNow(curOp(nodes().tj)), L = layout(w, hh);
        return items(L, scn).filter(i => i.type !== 'lamp').map(i => ({ key: i.def.key, kind: i.type === 'knob' ? 'knob' : 'switch', cx: i.cx, cy: i.cy, w: i.slot.w, h: i.slot.h }));
      }

      // ---- Aufbau ----
      initState();
      if (opts.controls && typeof opts.controls === 'object') {
        Object.keys(opts.controls).forEach(kk => { const r = validate(kk, opts.controls[kk]); if (r.ok) { ctl[kk] = r.v; if (kk === 'heatsink' && r.v !== 'none') lastHs = r.v; } });
        cfgDirty = true; chC = null; initState();
      }
      const rig = {
        id: def.id, range: Object.assign({}, def.range), timeScale: def.timeScale, tUnit: def.tUnit, h, controls: def.controls, meters, presets: def.presets, events: ev, params,
        setControl, getControl, step, stepProcess, readMeters, state, draw, hitTest, hotspots, curves, reset() { initState(); }, trace, settle, steady, chain, cfg() { return Object.assign({}, cfgNow()); },
        analysis, identify, thermalInfo, diagnose, applyPreset, worldSize(cw) {   // Seitenverhaeltnis der Zeichenflaeche: Handy hoch, schmale Flaeche fast quadratisch, sonst Querformat (cw = Breite der Flaeche in CSS-Pixeln, ohne Angabe die der Seite)
          let w = num(cw, 0); if (!(w > 0)) { try { const el = root.document && root.document.getElementById('cvw'); w = el ? el.clientWidth : 0; } catch (e) { w = 0; } }
          if (!(w > 0)) { try { w = root.innerWidth || 0; } catch (e) { w = 0; } }
          return w > 0 && w < 480 ? { w: 100, h: 200 } : w > 0 && w < 760 ? { w: 100, h: 130 } : w > 0 && w < 1000 ? { w: 1000, h: 600 } : { w: W.w, h: W.h };
        }, drawError() { return drawErr; }, pointer: null, reduced: undefined,
        model: def.model || {}
      };
      Object.defineProperty(rig, 'spanS', { enumerable: true, get() { return defSpan(); } });
      Object.defineProperty(rig, 'view', { enumerable: true, get() { return viewId; }, set(v) { if (v === 'schnitt' || v === 'kamera' || v === 'ersatz' || v === 'balken') viewId = v; } });
      Object.defineProperty(rig, 'symSet', { enumerable: true, get() { return symSet; }, set(v) { if ((v === 'db' || v === 'de') && v !== symSet) { symSet = v; def.meters.forEach((m, i) => { if (def.metersLabel) meters[i].label = def.metersLabel(m, S); }); } } });
      Object.defineProperty(rig, 'theme', { enumerable: true, get() { return theme; }, set(v) { if (v === 'auto' || v === 'dark' || v === 'light') theme = v; } });
      Object.defineProperty(rig, 'colors', { enumerable: true, get() { return colorsOverride; }, set(v) { colorsOverride = v && typeof v === 'object' ? v : null; } });
      return rig;
    }

    return { version: '1.0', MOUNT_STATE, clamp, num, fm, fn, pick, getCore, getDraw, coreOptional, mountControls, mountPresets, MOUNT_KEYS, makeRig, symOf, PAL, layout, knobFrac, G_MOUNT, rrect, meterList, metersLabel, SWITCHES, box, txt, pill };
  })();

  // =====================================================================================================================
  //  Pruefstand 1: linear (7805, LM317)
  // =====================================================================================================================
  const B = R.baseA, clamp = B.clamp, num = B.num, fm = B.fm, fn = B.fn;
  const RANGE = { lo: 0, hi: 150, unit: '°C', digits: 0 };
  const F0 = x => fn(x, 0), F1 = x => fn(x, 1), F2 = x => fn(x, 2);

  // ---- Elektrik: einzige Quelle ist THM_CORE.devices[id].elec (Dropout, Strombegrenzung, Abschaltung, Mindestlast); hier nur Aufruf und Zwischenspeicher ----
  function elecLin(X, c, tj, fl) {
    const d = X.CORE.devices[c.device], short = !!fl.short && !fl.shutdown;
    const e = d.elec({ ue: c.ue, ua: c.ua, loadMode: short ? 'widerstand' : c.loadMode, iLoad: c.iLoad, rLoad: short ? 1e-6 : c.rLoad, tj, iq: c.iq, shut: !!fl.shutdown });
    return e && e.ok !== false ? e : null;
  }
  function opFrom(e, fl, pOn) {
    const o = { ok: !!e, ue: 0, uaSet: 0, ua: 0, ia: 0, io: 0, iq: 0, pv: 0, off: !!fl.shutdown, dropout: false, ilimit: false, minlast: false, vdo: 0, ilim: 0, du: 0, eta: 0, short: !!fl.short && !fl.shutdown };
    if (e) { o.e = e; o.ue = e.ue; o.uaSet = e.uaSet; o.ua = e.ua; o.ia = e.ia; o.io = e.io; o.pv = e.pv; o.dropout = !!e.dropout; o.ilimit = !!e.ilimit; o.minlast = !!e.minlast; o.vdo = e.vdo; o.ilim = e.ilim; o.du = e.du; o.eta = e.eta * 100; }
    if (o.short) o.ilimit = true;
    o.p1 = o.pTot = o.pNode = o.pv; o.pOn = pOn === undefined ? o.pv : pOn;
    return o;
  }
  function opLinear(X, tj, fl) {
    const c = X.ctl, tq = Math.round(tj * 20) / 20, key = ['lin', c.device, c.ue, c.ua, c.loadMode, c.iLoad, c.rLoad, c.iq, fl.shutdown ? 1 : 0, fl.destroyed ? 1 : 0, fl.short ? 1 : 0, tq].join('|');
    return X.memo(key, () => {
      if (fl.destroyed) { const o = opFrom(null, fl, 0); o.off = true; return o; }
      const e = elecLin(X, c, tq, fl);
      return opFrom(e, fl, fl.shutdown ? (elecLin(X, c, tq, { shutdown: false, short: fl.short }) || { pv: 0 }).pv : undefined);
    });
  }
  // Mindestlast und Dropout-Faehigkeit usw. fuer Kennlinien: Betriebspunkt ohne Zwischenspeicher
  function opRaw(X, over, tj, fl) { return opFrom(elecLin(X, Object.assign({}, X.ctl, over), tj, fl || { shutdown: false, short: false }), fl || { shutdown: false, short: false }); }

  B.F = { F0, F1, F2 };
  const CONTROLS_LIN = [
    { key: 'device', label: 'Regler', type: 'select', value: '7805', group: 'Bauteil und Last', options: [{ value: '7805', label: 'TF-7805 (5 V, 1 A)' }, { value: 'lm317', label: 'TF-LM317 (einstellbar)' }],
      help: 'Der 7805 liefert fest 5 V. Beim LM317 stellst du die Ausgangsspannung ein. Beim Umschalten bleibt die Montage erhalten.' },
    { key: 'ue', label: 'Eingangsspannung Ue', type: 'slider', scale: 'lin', min: 3, max: 40, step: 0.5, unit: 'V', value: 12, group: 'Bauteil und Last',
      help: 'Eingangsspannung des Reglers. Der Regler verbrennt (Ue − Ua)·Ia: Je größer Ue, desto mehr Wärme.' },
    { key: 'ua', label: 'Ausgangsspannung Ua (LM317)', type: 'slider', scale: 'lin', min: 1.25, max: 37, step: 0.05, unit: 'V', value: 5, group: 'Bauteil und Last', visible: s => !!s && s.device === 'lm317',
      help: 'Beim LM317 legt das Widerstandspaar R1 und R2 die Ausgangsspannung fest: Ua = 1,25 V·(1 + R2/R1) + Iadj·R2. R1 ist 240 Ω, R2 wird aus Ua berechnet.' },
    { key: 'loadMode', label: 'Last', type: 'select', value: 'strom', group: 'Bauteil und Last', options: [{ value: 'strom', label: 'Stromsenke (fester Strom)' }, { value: 'widerstand', label: 'Lastwiderstand' }],
      help: 'Stromsenke: Du stellst den Laststrom ein. Lastwiderstand: Der Strom ergibt sich aus Ua geteilt durch RL.' },
    { key: 'iLoad', label: 'Laststrom Ia', type: 'slider', scale: 'lin', min: 0, max: 1.5, step: 0.05, unit: 'A', value: 0.5, group: 'Bauteil und Last', visible: s => !!s && s.loadMode === 'strom',
      help: 'Strom, den die Last aufnimmt. Die Verlustleistung des Reglers wächst linear mit dem Strom.' },
    { key: 'rLoad', label: 'Lastwiderstand RL', type: 'slider', scale: 'log', min: 2.5, max: 500, step: 0.5, unit: 'Ω', value: 10, group: 'Bauteil und Last', visible: s => !!s && s.loadMode === 'widerstand',
      help: 'Lastwiderstand am Ausgang. Beim LM317 ist die Verlustleistung am größten, wenn die Ausgangsspannung halb so groß ist wie die Eingangsspannung.' },
    { key: 'iq', label: 'Ruhestrom berücksichtigen', type: 'switch', value: true, group: 'Bauteil und Last',
      help: 'Der Regler nimmt auch ohne Last einen kleinen Ruhestrom auf. Mit Schalter an wird Ue·Iq zur Verlustleistung addiert (Datenblattformel), aus ist die Prüfungsnäherung.' },
    { key: 'swVergleich', label: 'Schaltregler-Vergleich zeigen', type: 'switch', value: false, group: 'Bauteil und Last',
      help: 'Zeigt, wie viel Verlustleistung ein Schaltregler mit dem eingestellten Wirkungsgrad bei gleicher Ausgangsleistung hätte.' },
    { key: 'etaSw', label: 'Wirkungsgrad Schaltregler', type: 'slider', scale: 'lin', min: 80, max: 95, step: 1, unit: '%', value: 90, group: 'Bauteil und Last', visible: s => !!s && !!s.swVergleich,
      help: 'Übungsannahme für den Wirkungsgrad des Schaltreglers (80 bis 95 Prozent). Ein echter Wert hängt vom Bauteil und vom Betriebspunkt ab.' }
  ].concat(B.mountControls());
  const METER_TPL = [
    ['ua', 'Ausgangsspannung Ua', 'V', 2, 0, 40], ['ia', 'Laststrom Ia', 'A', 3, 0, 2.5], ['pv', 'Verlustleistung', 'W', 2, 0, 40, 'P'], ['tj', 'Sperrschichttemperatur', '°C', 1, 0, 200, 'Tj', 125],
    ['tc', 'Gehäusetemperatur', '°C', 1, 0, 200, 'Tc'], ['tk', 'Kühlkörpertemperatur', '°C', 1, 0, 200, 'Tk'], ['rthTot', 'Gesamt-Wärmewiderstand', 'K/W', 2, 0, 60], ['pzul', 'Zulässige Verlustleistung', 'W', 2, 0, 60],
    ['eta', 'Wirkungsgrad', '%', 1, 0, 100], ['dtJC', 'Temperaturabfall Sperrschicht–Gehäuse', 'K', 1, 0, 150], ['dtCK', 'Temperaturabfall Gehäuse–Kühlkörper', 'K', 1, 0, 150], ['dtK', 'Temperaturabfall Kühlkörper–Umgebung', 'K', 1, 0, 150],
    ['pvSw', 'Verlustleistung Schaltregler', 'W', 2, 0, 40]
  ];
  const METERS_LIN = B.meterList(METER_TPL);

  function mkPreset(id, name, params) { return { id, name, params, settle: false }; }
  const PRESETS_LIN = (function () {
    const a = { device: '7805', ue: 12, iLoad: 0.5, loadMode: 'strom', heatsink: 'none' };
    const b = { device: '7805', ue: 12, iLoad: 0.5, heatsink: 'm', joint: 'glimmer', paste: 'duenn' };
    const c = { device: '7805', ue: 12, iLoad: 0.5, heatsink: 'm', joint: 'glimmer', paste: 'keine' };
    const d = { device: 'lm317', ue: 20, ua: 5, iLoad: 1, heatsink: 'm', joint: 'glimmer', paste: 'duenn' };
    const e = { device: 'lm317', ue: 15, ua: 7.5, loadMode: 'widerstand', rLoad: 10, heatsink: 'm', joint: 'glimmer', paste: 'duenn' };
    const f = { device: '7805', ue: 6.5, iLoad: 0.5, heatsink: 'm', joint: 'glimmer', paste: 'duenn' };
    return [
      mkPreset('7805-frei', '7805 frei (' + F0(a.ue) + ' V, ' + fn(a.iLoad, 1) + ' A)', a),
      mkPreset('7805-kk', '7805 mit Kühlkörper m, Glimmer, Paste', b),
      mkPreset('7805-trocken', '7805 Glimmer ohne Paste', c),
      mkPreset('lm317-kritisch', 'LM317 ' + F0(d.ue) + ' V auf ' + F0(d.ua) + ' V, ' + F0(d.iLoad) + ' A', d),
      mkPreset('lm317-worstcase', 'LM317 Widerstandslast Worst-Case', e),
      mkPreset('7805-dropout', '7805 Dropout (Ue ' + fn(f.ue, 1) + ' V)', f)
    ].concat(B.mountPresets());
  })();

  // Schalter im Bild: jeder liefert on(ctl), to(ctl), label, show
  const SWITCHES = B.SWITCHES;

  const LIN_DEF = {
    id: 'linear', h: 0.25, timeScale: 30, tUnit: 'min', range: RANGE, world: { w: 1000, h: 560 },
    params: {},
    controls: CONTROLS_LIN, meters: METERS_LIN, presets: PRESETS_LIN, metersLabel: B.metersLabel,
    deviceOf: c => c.device, deviceName: (id, X) => (X && X.devData(id).name) || id,
    cfg(c, CORE) { return CORE.cfgFromControls(c, c.device); },
    fahne(X, op) { const d = X.devData(X.ctl.device), tab = d.tab || {}; return { pot: tab.pot, label: tab.potText || '', v: tab.pot === 'masse' ? 0 : op.ua }; },
    op: opLinear,
    model: { opRaw, elecLin },
    meters_(X, op, nd, b) {
      const c = X.ctl, pa = op.ua * op.ia, sw = c.swVergleich && pa > 0 ? X.CORE.power.switching(pa, c.etaSw / 100) : null;
      return { ua: op.ua, ia: op.ia, pv: op.pv, eta: op.off ? 0 : op.eta, pvSw: sw && sw.ok ? sw.p : 0 };
    },
    state_(X, op, nd, b) {
      const c = X.ctl, pa = op.ua * op.ia, sw = c.swVergleich && pa > 0 ? X.CORE.power.switching(pa, c.etaSw / 100) : null, d = X.devData(c.device), st = d.shutdown || {};
      return { ue: op.ue, ua: op.ua, uaSet: op.uaSet, ia: op.ia, io: op.io, iq: c.iq ? (c.device === 'lm317' ? d.iadj : d.iq) : 0, loadMode: c.loadMode, dropout: op.dropout, ilimit: op.ilimit, vdo: op.vdo, ilim: op.ilim, off: op.off, eta: op.off ? 0 : op.eta,
        pvSw: sw && sw.ok ? sw.p : 0, swVergleich: !!c.swVergleich, tShut: st.on, tShutBack: st.off, minlast: op.minlast, fahne: d.tab ? d.tab.pot : '' };
    },
    // Zusatzangaben fuer THM_CORE.diagnose (Dropout, Strombegrenzung, Mindestlast, Spannungsgrenzen kommen aus dem Betriebspunkt des Kerns)
    diagExtra(Sx, X) { const d = X.devData(X.ctl.device), tab = d.tab || {}; return { elec: Sx.op.e || undefined, tabV: tab.pot === 'masse' ? 0 : Sx.op.ua }; },
    recipeOp(X) { const c = X.ctl; return { ue: c.ue, ua: c.ua, loadMode: c.loadMode, iLoad: c.iLoad, rLoad: c.rLoad, tj: X.nodes().tj, iq: c.iq }; },
    scene(X, op, V) {
      const c = X.ctl, chips = [];
      if (V.shutdown) chips.push({ text: 'ABGESCHALTET', kind: 'warn' });
      if (op.dropout && !op.off) chips.push({ text: 'DROPOUT', kind: 'warn' });
      if (op.ilimit && !op.off) chips.push({ text: 'STROMBEGRENZUNG', kind: 'warn' });
      if (op.short) chips.push({ text: 'KURZSCHLUSS', kind: 'error' });
      const knobs = [{ key: 'ue', label: 'Eingang Ue', lo: 3, hi: 40, step: 0.5, scale: 'lin', unit: 'V', digits: 1, show: v => fn(v, 1) + ' V' }];
      if (c.loadMode === 'widerstand') knobs.push({ key: 'rLoad', label: 'Last RL', lo: 2.5, hi: 500, step: 0.5, scale: 'log', unit: 'Ω', digits: 1, show: v => fn(v, 1) + ' Ω' });
      else knobs.push({ key: 'iLoad', label: 'Last Ia', lo: 0, hi: 1.5, step: 0.05, scale: 'lin', unit: 'A', digits: 2, show: v => fn(v, 2) + ' A' });
      const lampLevel = op.off ? 0 : clamp(op.ia / 1.0, 0, 1) * (op.dropout && op.uaSet > 0.1 ? clamp(op.ua / op.uaSet, 0, 1) : 1);
      const lines = [];
      if (c.swVergleich && op.ua * op.ia > 0) {
        const sw = X.CORE.power.switching(op.ua * op.ia, c.etaSw / 100), K = X.CORE.const || {};
        if (sw && sw.ok) {
          const tjSw = c.ta + sw.p * (K.RTH_SWCHIP || 50), tjMax = K.TJMAX_SWCHIP || 125;
          lines.push('Schaltregler ' + F0(c.etaSw) + ' %: ' + F2(sw.p) + ' W (Übungswert)');
          lines.push('gespart ' + F2(op.pv - sw.p) + ' W, Kühlkörper nötig? ' + (tjSw <= tjMax ? 'nein' : 'ja'));
        }
      }
      return { title: 'Linearregler-Prüfstand (Übungsanlage)', titleShort: 'Linearregler-Prüfstand', knobs, lamp: { level: lampLevel, label: 'Last', value: fn(op.ia, 2) + ' A' }, chips, switches: SWITCHES, lines };
    },
    curves(X, K) {
      const c = X.ctl, d = X.devData(c.device), CORE = X.CORE, ta = c.ta, cfg = K.cfgNow(), id = c.device, tjMax = K.tjMaxOf(id), nd = X.nodes();
      const op0 = opLinear(X, nd.tj, X.flags()), pz = K.pzulOf(cfg, ta), out = [], tjC = Math.min(nd.tj, 125);
      const R_ = op => [+op.ia.toFixed(4), +op.pv.toFixed(4)];
      // (1) P_V ueber Ia: Stromsenke: Gerade; Lastwiderstand am LM317: Ausgangsspannung durchfahren (Parabel)
      { const pts = []; let iMax = 1.5;
        if (c.loadMode === 'widerstand' && c.device === 'lm317') { for (let i = 0; i <= 36; i++) { const ua = 1.25 + (Math.min(c.ue, 37) - 1.25) * i / 36, o = opRaw(X, { ua, loadMode: 'widerstand' }, tjC); pts.push(R_(o)); } pts.sort((p, q) => p[0] - q[0]); iMax = pts.length ? pts[pts.length - 1][0] : 1.5; }
        else for (let i = 0; i <= 30; i++) { const o = opRaw(X, { loadMode: 'strom', iLoad: 1.5 * i / 30 }, tjC); pts.push(R_(o)); }
        out.push({ id: 'p-ia', title: 'Verlustleistung über dem Laststrom', xLabel: 'Laststrom Ia', xUnit: 'A', yLabel: 'Verlustleistung', yUnit: 'W', series: [{ name: 'P_V', points: pts }, { name: 'P_zul (aktueller Aufbau)', points: [[0, +pz.toFixed(3)], [+iMax.toFixed(3), +pz.toFixed(3)]], style: 'limit' }], marker: { x: op0.ia, y: op0.pv } }); }
      // (2) P_V ueber Ue
      { const pts = []; for (let i = 0; i <= 37; i++) { const ue = 3 + i, o = opRaw(X, { ue }, tjC); pts.push([ue, +o.pv.toFixed(4)]); }
        out.push({ id: 'p-ue', title: 'Verlustleistung über der Eingangsspannung', xLabel: 'Eingangsspannung Ue', xUnit: 'V', yLabel: 'Verlustleistung', yUnit: 'W', series: [{ name: 'P_V', points: pts }, { name: 'P_zul (aktueller Aufbau)', points: [[3, +pz.toFixed(3)], [40, +pz.toFixed(3)]], style: 'limit' }], marker: { x: c.ue, y: op0.pv } }); }
      // (3) Tj ueber P_V fuer drei Aufbauten (Beharrungszustand, THM_CORE.steady)
      { const frei = Object.assign({}, cfg, { heatsink: 'none' }), kk3 = cfg.heatsink === 'none', third = kk3 ? Object.assign({}, cfg, { heatsink: 'm', joint: 'glimmer', paste: 'duenn', fan: 'mittel', bushing: true, screw: 'fest' }) : Object.assign({}, cfg, { fan: 'mittel' });
        const pMax = Math.max(6, Math.ceil(op0.pOn * 1.5)), ser = [['frei', frei], ['aktueller Aufbau', cfg], [kk3 ? 'Kühlkörper m, Glimmer, Paste, Lüfter mittel' : 'aktueller Aufbau mit Lüfter (mittel)', third]].map(a => {
          const pts = []; for (let i = 0; i <= 12; i++) { const p = pMax * i / 12; pts.push([+p.toFixed(3), +K.steadyOf(a[1], p, ta).tj.toFixed(3)]); } return { name: a[0], points: pts }; });
        ser.push({ name: 'Tj,max', points: [[0, tjMax], [pMax, tjMax]], style: 'limit' });
        out.push({ id: 'tj-p', title: 'Sperrschichttemperatur über der Verlustleistung', xLabel: 'Verlustleistung', xUnit: 'W', yLabel: 'Sperrschichttemperatur', yUnit: '°C', series: ser, marker: { x: op0.pOn, y: +K.steadyOf(cfg, op0.pOn, ta).tj.toFixed(3) } }); }
      // (4) Aufheizkurve
      out.push(K.heatCurve(op0.pOn, tjMax, 'Aufheizkurve der Sperrschicht (ohne Abschaltung)'));
      // (5) LM317 Worst-Case
      if (c.device === 'lm317') {
        const pts = []; const RL = c.loadMode === 'widerstand' ? c.rLoad : 10; let best = [0, -1];
        for (let i = 0; i <= 40; i++) { const ua = 1.25 + (Math.min(c.ue, 37) - 1.25) * i / 40, o = opRaw(X, { ua, loadMode: 'widerstand', rLoad: RL }, tjC); pts.push([+ua.toFixed(3), +o.pv.toFixed(4)]); if (o.pv > best[1]) best = [ua, o.pv]; }
        const oM = opRaw(X, { ua: Math.min(37, Math.max(1.25, c.ue / 2)), loadMode: 'widerstand', rLoad: RL }, tjC);
        out.push({ id: 'p-ua', title: 'Verlustleistung über der Ausgangsspannung (RL fest ' + F1(RL) + ' Ω)', xLabel: 'Ausgangsspannung Ua', xUnit: 'V', yLabel: 'Verlustleistung', yUnit: 'W', series: [{ name: 'P_V', points: pts }], marker: { x: +Math.min(37, Math.max(1.25, c.ue / 2)).toFixed(3), y: +oM.pv.toFixed(4) }, note: 'Maximum bei Ua = Ue/2' });
      }
      return out;
    }
  };

  R.register({
    id: 'linear', name: 'Linearregler (7805, LM317)', icon: '🔥',
    info: 'Übungsanlage: Ein Linearregler (7805 oder einstellbarer LM317) verbrennt die Spannungsdifferenz mal Strom. Du änderst Last und Eingangsspannung, montierst Kühlkörper, Glimmerscheibe und Paste und siehst Schnittbild, Wärmebild und Temperaturverlauf. Freistehend schaltet der Regler thermisch ab.',
    controls: CONTROLS_LIN, meters: METERS_LIN, presets: PRESETS_LIN,
    create(opts) { return B.makeRig(LIN_DEF, opts); }
  });
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
