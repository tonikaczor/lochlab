'use strict';
/* Tonfunk Wechselstrom-Lab (WSL-Lab): Oberfläche (WP3a).
   Seite, Tabs (Prüfstand, Kennlinien, Messreihe, Auslegen, Rechnen, Aufgaben, Lernen), Sichtenleiste Zeit - Zeiger - Formel (gleichzeitig sichtbar), Gruppen Quelle, Bauteile, Last, Vorgabe und Anzeige,
   Ampelzeile, Bedienpult und Messgeräte automatisch aus rig.controls / rig.meters, Vorher/Nachher (Merken, Geisterbild, Wischer), Ablauf, Fehler-Würfel, Speichern/Öffnen/Teilen,
   Bode-Vertiefung (nur Filter, aufklappbar), Aufgabenanbindung, Qualitätsstufen, Effekte.
   Kennlinien, Messreihe, Auslegen, Rechnen und Lernen kommen aus wslui-curve.js, wslui-report.js, wslui-design.js, wslui-calc.js und wslui-help.js über window.WSL_UI_EXT (VERTRAG 6.5);
   fehlt eine Erweiterung, steht dort ein Hinweis (kein Absturz).
   Es gibt hier KEINE zweite Formelimplementierung: assess, diagnose, runSeq, formulas, exercise, limits rufen immer den Kern bzw. den Prüfstand (SPEC Regel 7).
   Speicher: wsl.cur, wsl.saves, wsl.tab, wsl.speed, wsl.seen, wsl.fx, wsl.faults, wsl.q, wsl.deep ({ bode: Wahrheitswert, n: Anzahl Aufklappungen }), wsl.hint, wsl.rigsused, wsl.digital, wsl.mview (Messgeräte-Ansicht: gauge, digital, front), wsl.autohint, sim.done (gemeinsam mit den anderen Labs).
   Erweiterungen schreiben selbst: wsl.report (Verlauf der Messreihen), wsl.design, S.bericht (laufende Messreihe, wird mit Speichern/Teilen/Abgabe mitgeführt). */
(function (root) {
  if (!root.RIGUI || !root.RIGUI.ok('wsl', '59ae85a9')) { const a = document.getElementById('app') || document.body, d = document.createElement('div'); d.className = 'rigui-miss'; d.setAttribute('role', 'alert'); d.style.cssText = 'margin:12px;padding:12px 14px;border:2px solid #c0392b;border-radius:10px;background:#fff4f2;color:#5a1a12;font:15px/1.45 system-ui,sans-serif'; d.innerHTML = 'Der Oberfl\u00e4chen-Rahmen fehlt oder passt nicht zur Seite (rigui-base.js, rigui-pf.js). Bitte die Seite neu laden.' + (typeof navigator !== 'undefined' && navigator.onLine === false ? ' Du bist offline: Verbinde dich einmal mit dem Internet und lade die Seite danach neu, damit die fehlenden Dateien nachgeladen werden.' : '') + ' <button type="button" class="btn pri" onclick="location.reload()">Neu laden</button>'; if (a) a.insertBefore(d, a.firstChild); return; }
  const { $, $$, AMP, B, NARROW_AR, QLEVELS, adig, ampKey, applyHit, assessOf, bgOf, canSound, choiceOpts, clamp, clickSnd, clone, confirmSheet, csvNum, defVal, esc, fauto, fin, fnum, fxOn, isWarn, limBadge, loadExampleByName, lsGet, lsPut, lsRaw, lsSet, margTxt, markDone, optNorm, packShare, parseCsv, pick, rowEnd, rowNorm, saveCsv, seqToRows, sgn, sheet, slPos, slVal, stat, taskDone, theme, toast, tstamp, typing, unpackShare, MVIEWS, MVNAME, frontOk, FXKINDS, SPEEDS, dm } = root.RIGUI.pure('wsl', { root, loadExample, setCtl });
  const CORE = () => root.WSL_CORE;
  const DRAW = () => root.WSL_DRAW;
const ORDER = ['sinus', 'rlc', 'leistung', 'kompens', 'schwing', 'filter', 'trafo', 'drehstrom'];
  const RIGMETA = {
    sinus: { icon: '〰️', name: 'Sinus, Effektivwert und Phase', file: 'wslrig-sinus.js', info: 'Scheitelwert, Effektivwert, Mittelwert, Phasenverschiebung' },
    rlc: { icon: '🌀', name: 'R, L, C im Wechselstromkreis', file: 'wslrig-rlc.js', info: 'Blindwiderstände, Zeigerdiagramm, Spannungsdreieck' },
    leistung: { icon: '⚡', name: 'Wirk-, Blind- und Scheinleistung', file: 'wslrig-leistung.js', info: 'Leistungsdreieck, cos φ, Leitungsverlust' },
    kompens: { icon: '⚖️', name: 'Kompensation', file: 'wslrig-kompens.js', info: 'Parallelkompensation, Überkompensation, Strom vorher und nachher' },
    schwing: { icon: '🔔', name: 'Reihen- und Parallelschwingkreis', file: 'wslrig-schwing.js', info: 'Resonanzfrequenz, Güte, Bandbreite, Überhöhung' },
    filter: { icon: '🎚️', name: 'Hoch- und Tiefpass', file: 'wslrig-filter.js', info: 'RC- und RL-Filter, Grenzfrequenz, Rechteckantwort, Bode-Vertiefung' },
    trafo: { icon: '🔄', name: 'Transformator', file: 'wslrig-trafo.js', info: 'Übersetzung, Last, Verluste, Gleichspannung am Trafo' },
    drehstrom: { icon: '🔺', name: 'Drehstrom kurz', file: 'wslrig-drehstrom.js', info: 'Stern, Dreieck, Außenleiterspannung, Leistung' }
  };
  const FIRELBL = { sinus: 'Phase einfrieren', rlc: 'Frequenzdurchlauf', leistung: 'Messung starten', kompens: 'Kondensator zuschalten', schwing: 'Frequenzdurchlauf', filter: 'Durchlauf / Rechteck', trafo: 'Last zuschalten', drehstrom: 'Stern und Dreieck vergleichen' };
  const FIREHINT = { sinus: 'Die Phase wird eingefroren: Lies den Zeitversatz am Raster ab.', rlc: 'Die Frequenz läuft durch: X_L steigt, X_C fällt, die Zeiger wandern.', leistung: 'Die Messung läuft mit drei Geräten: Spannung, Strom und Leistung.', kompens: 'Das Kompensations-C wird zugeschaltet: Das Leistungsdreieck schrumpft, der Strom sinkt.', schwing: 'Die Resonanzkurve wird gezeichnet: Marker f_u, f₀ und f_o.', filter: 'Frequenzdurchlauf oder Rechteckimpuls, je nach Eingang.', trafo: 'Die Last wird zugeschaltet: Sekundär- und Primärstrom folgen.', drehstrom: 'Rechenvergleich Stern gegen Dreieck (kein Anlaufmodell).' };
  /* Vier Gruppen des Bedienpults: EINE Tabelle (controls[].gruppe) */
  const GRUPPEN = {
    quelle: { id: 'quelle', name: 'Quelle', short: 'Quelle', color: 'var(--g-quelle)', sym: '1', text: 'Spannung, Frequenz und Kurvenform der Quelle' },
    bauteile: { id: 'bauteile', name: 'Bauteile', short: 'Bauteile', color: 'var(--g-bauteile)', sym: '2', text: 'R, L, C, Windungen: die Bauteile der Schaltung' },
    last: { id: 'last', name: 'Last', short: 'Last', color: 'var(--g-last)', sym: '3', text: 'Verbraucher: Wirkleistung, cos φ, Lastwiderstand' },
    ziel: { id: 'ziel', name: 'Vorgabe und Anzeige', short: '', color: 'var(--g-ziel)', sym: '', text: 'Vorgaben für die Ampel und Anzeigeoptionen' }
  };
  const GR_ORDER = ['quelle', 'bauteile', 'last', 'ziel'];
  const SICHTEN = [{ id: 'zeit', n: 1, name: 'Zeit', sub: 'Zeitbild', color: 'var(--sv-zeit)' }, { id: 'zeiger', n: 2, name: 'Zeiger', sub: 'Zeigerbild', color: 'var(--sv-zeiger)' }, { id: 'formel', n: 3, name: 'Formel', sub: 'Rechenweg und Wert', color: 'var(--sv-formel)' }];
const RIGLIMITS = {
    sinus: ['f_netz', 'u_netz', 'eff_sinus', 'eff_rechteck'], rlc: ['f_netz', 'u_netz'], leistung: ['u_netz'], kompens: ['cos_ziel', 'u_netz'],
    schwing: ['res_reihe', 'res_parallel', 'res_fenster'], filter: ['fg_betrag', 'fg_db', 'fg_phase', 'fg_xc', 'tau_5'],
    trafo: ['trafo_ueb', 'trafo_dc', 'trafo_uk', 'trafo_pfe'], drehstrom: ['u_aussen']
  };
  /* Töne nur nach einer Bedienung durch den Nutzer (sonst Warnung des Browsers) */

  /* ============================================================ Fenster, Meldungen, Dialoge */
  root.LabUI = { sheet, esc, toast, userName: () => lsRaw('lm4.name', ''), LAB: 'wsl' };
  root.sheet = sheet; root.toast = toast;

  const defOf = id => {
    const r = root.WSL_RIGS;
    return r && r.defs && r.defs[id] ? r.defs[id] : null;
  };

  /* ============================================================ Zustand */
  const mqReduce = (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)')) || { matches: false };
  /* Messgeräte-Ansicht: 'gauge' (Zeiger, Standard wie bisher), 'digital' (Zahlen) oder 'front' (Frontplatte, geraete.js); Wahl in wsl.mview, Rückfall auf den alten Schalter wsl.digital */
  const mviewInit = () => { const v = lsRaw('wsl.mview', ''); return MVIEWS.includes(v) ? v : lsRaw('wsl.digital', '0') === '1' ? 'digital' : 'gauge'; };
  const S = {
    tab: lsRaw('wsl.tab', 'rig'), rigId: null, rig: null, refRig: null, err: '', name: 'Neuer Versuch', id: null, task: null, dirty: false,
    running: false, speed: +lsRaw('wsl.speed', '1') || 1, mview: mviewInit(), digital: mviewInit() === 'digital',
    ctl: {}, simT: 0, rows: {}, live: null, seqRes: null, readonly: false, ref: null, refMode: 'nachher', wipe: 0.5, gruppe: null,
    clicks: [], sichtHot: null, calcUsed: false, fired: false, bericht: null, simClosed: {},
    q: { mode: lsRaw('wsl.q', 'auto'), level: 'hoch', ms: [], lastSwitch: 0, fastSince: 0 }
  };
  const TABS = [['rig', '🎛️', 'Prüfstand'], ['curve', '📈', 'Kennlinien'], ['report', '📋', 'Messreihe'], ['design', '📐', 'Auslegen'], ['calc', '🧮', 'Rechnen'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Lernen']];
  if (!TABS.some(x => x[0] === S.tab)) S.tab = 'rig';
  if (!SPEEDS.includes(S.speed)) S.speed = 1;
  if (!['auto', 'hoch', 'mittel', 'niedrig'].includes(S.q.mode)) S.q.mode = 'auto';

  /* ---- Tastenkürzel: EINE Tabelle für Behandler, Hilfe-Blatt und Menü (Regel 5) ---- */
  const KEYS = [
    { id: 'run', keys: ['Leertaste'], match: e => e.key === ' ', t: 'Prüfstand starten und anhalten', act: () => setRun(!S.running) },
    { id: 'reset', keys: ['Z'], match: e => e.key.toLowerCase() === 'z' && !(e.ctrlKey || e.metaKey), t: 'Prüfstand zurücksetzen (Reset)', act: () => resetRig() },
    { id: 'fx', keys: ['E'], match: e => e.key.toLowerCase() === 'e', t: 'Effekte und Ton ein oder aus', act: () => toggleFx() },
    { id: 'speed', keys: ['1', '2', '3', '4', '5'], match: e => e.key >= '1' && e.key <= '5', t: 'Zeitlupe und Zeitraffer ×0,1 / ×0,5 / ×1 / ×2 / ×5', act: e => setSpeed(SPEEDS[+e.key - 1]) },
    { id: 'merk', keys: ['M'], match: e => e.key.toLowerCase() === 'm', t: 'Zustand merken (Vorher)', act: () => merken() },
    { id: 'vn', keys: ['V'], match: e => e.key.toLowerCase() === 'v', t: 'Zwischen Vorher und Nachher wechseln', act: () => toggleVN() },
    { id: 'wipe', keys: ['W'], match: e => e.key.toLowerCase() === 'w', t: 'Wischer Vorher | Nachher ein oder aus', act: () => toggleWipe() },
{ id: 'fire', keys: ['F'], match: e => e.key.toLowerCase() === 'f' && !(e.ctrlKey || e.metaKey), t: 'Auslösen oder Durchlauf starten (je Prüfstand: Phase einfrieren, Frequenzdurchlauf, Messung, Kondensator zuschalten, Last zuschalten, Stern und Dreieck vergleichen)', act: () => doFire() },
    { id: 'bode', keys: ['B'], match: e => e.key.toLowerCase() === 'b' && !(e.ctrlKey || e.metaKey), t: 'Bode-Vertiefung auf- oder zuklappen (Prüfstand Hoch- und Tiefpass, Tab Kennlinien)', act: () => toggleBode() },
    { id: 'save', keys: ['S', 'Strg + S'], match: e => e.key.toLowerCase() === 's', t: 'Versuch speichern', act: () => doSave() },
    { id: 'enter', keys: ['Eingabe', 'F5'], ext: true, t: 'Starten und anhalten (gilt auch außerhalb der Bildfläche)' },
    { id: 'help', keys: ['?'], ext: true, t: 'Diese Übersicht' }
  ];
  root.WSL_KEYS = KEYS;

  let drawErr = false, curT = 0, taskRes = null; const taskAns = {};
  /* Auswahlfelder: Einträge als Text oder { value, label } erlaubt; die Oberfläche arbeitet mit Kopien, die Definition des Prüfstands bleibt unberührt */
  let ctlCache = { rig: null, list: [] };
  const ctlsOf = () => {
    if (!S.rig) return [];
    if (ctlCache.rig !== S.rig) { const src = S.rig.controls || (defOf(S.rigId) || {}).controls || []; ctlCache = { rig: S.rig, list: src.filter(Boolean).map(c => (c.type === 'select' ? Object.assign({}, c, { options: optNorm(c.options) }) : c)) }; }
    return ctlCache.list;
  };
  const ctlDef = (key, list) => (list || ctlsOf()).find(c => c.key === key);
  /* Wert an die Definition anpassen (Auswahl über Wert oder Beschriftung, Schieber begrenzen); undefined = nicht passend */

  /* ============================================================ Prüfstand wechseln, Steuerwerte */
  function setRig(id, o) {
    o = o || {};
    if (!ORDER.includes(id)) id = ORDER[0];
    const same = id === S.rigId;
    S.rigId = id; S.rig = null; S.refRig = null; S.err = ''; S.ctl = {}; S.evSeen = new WeakSet(); S.evSig = ''; S.faultUntil = 0; S.preset = null; S.st = null; S.sichtHot = null; S.dice = null; ctlCache = { rig: null, list: [] };
    if (!same && !o.keepRef) { S.ref = null; S.refMode = 'nachher'; }
    resetRun(); fxReset();
    const d = defOf(id);
    if (d) { try { S.rig = d.create(o.opts || {}); } catch (e) { S.err = (e && e.message) || String(e); console.error('Prüfstand ' + id + ':', e); } }
    if (!S.rows[id]) S.rows[id] = [];
    buildRefRig(); buildPick(); buildPresets(); buildControls(); buildMeters(); buildSicht(); buildLimits(); updateSimBand(); updateDice(); buildBA(); renderSweep(); fitCanvas(); updateEvents(true); updateChrome(); readState(); updateAmp(true);
    if (EXTHOST[S.tab]) renderExt(S.tab);
    saveCurSoon();
  }
  /* mehrere Steuerwerte setzen: map { key: Wert }, Auswahlfelder zuerst (Fall, Stapel, Prüfart), nur passende Schlüssel, ohne Hinweise */
  function setCtl(key, val, silent) {
    if (!S.rig || S.readonly) return false;
    const def = ctlDef(key), v = coerce(def, val); if (v === undefined) return false;
    let ok = true; try { ok = S.rig.setControl(key, v) !== false; } catch (e) { console.error(e); return false; }
    if (!ok) { syncCtl(true); return false; }
    S.ctl[key] = v;
    if (!silent) {
      S.dirty = true; saveCurSoon(); S.sichtHot = def && def.sicht ? def.sicht : null; updateSicht();
      if (!S.running && def.type !== 'button' && !S.live && S.tab === 'rig') setRun(true, true);
    }
    readState(); syncCtl(); return true;
  }
  function saveCurSoon() { clearTimeout(curT); curT = setTimeout(saveCur, 400); }
  function saveCur() { if (!S.rig) return; lsSet('wsl.cur', { rig: S.rigId, ctl: allCtl(), ref: S.ref, refMode: S.refMode, rows: S.rows, name: S.name, id: S.id, task: S.task ? S.task.id : null, dirty: S.dirty, bericht: S.bericht }); }
  function usedRig() {
    if (!S.rigId || !defOf(S.rigId)) return;
    const a = lsGet('wsl.rigsused', []), s = new Set(Array.isArray(a) ? a : []); s.add(S.rigId); lsSet('wsl.rigsused', [...s]); stat('wslrigs', s.size, 'max');
  }

  /* ---- Prüfstandwahl und Voreinstellungen ---- */
  $('#rigPick').addEventListener('click', e => { const b = e.target.closest('[data-rig]'); if (b) usePick(b.dataset.rig); });
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
const FILES = ['wslcore.js', 'wslcore-res.js', 'wsldraw.js', 'wslrig-base.js', 'wslrig-sinus.js', 'wslrig-rlc.js', 'wslrig-leistung.js', 'wslrig-kompens.js', 'wslrig-schwing.js', 'wslrig-filter.js', 'wslrig-trafo.js', 'wslrig-drehstrom.js', 'wsldata.js', 'wsltasks1.js', 'wsltasks2.js'];
  function retryLoad() {
    const want = FILES.filter(f => {
      if (f === 'wslcore.js') return !root.WSL_CORE;
      if (f === 'wslcore-res.js') return !(root.WSL_CORE && typeof root.WSL_CORE.runSeq === 'function');
      if (f === 'wsldraw.js') return !root.WSL_DRAW;
      if (f === 'wsldata.js') return !root.WSL_DATA;
      if (f === 'wsltasks1.js' || f === 'wsltasks2.js') return !root.WSL_TASKS;
      if (f === 'wslrig-base.js') return !(root.WSL_RIGS && root.WSL_RIGS.base);
      const id = ORDER.find(i => RIGMETA[i].file === f); return !(root.WSL_RIGS && root.WSL_RIGS.defs && root.WSL_RIGS.defs[id]);
    });
    if (!want.length) { setRig(S.rigId); toast('Alles geladen'); return Promise.resolve(); }
    toast('Lade fehlende Dateien …');
    return Promise.all(want.map(f => new Promise(res => {
      const s = document.createElement('script'); s.src = f + '?t=' + Date.now(); s.onload = s.onerror = () => res(); document.head.appendChild(s);
    }))).then(() => {
      const still = ORDER.filter(i => !defOf(i)).length;
      const keep = S.rig ? allCtl() : ((lsGet('wsl.cur', {}) || {}).ctl || {}); setRig(S.rigId); applyCtl(keep); buildPick();
      if (S.tab === 'tasks') renderTasks(); toast(still ? still + ' Prüfstand' + (still > 1 ? 'e fehlen' : ' fehlt') + ' noch' : 'Alle Prüfstände geladen');
    });
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-retry]')) retryLoad(); });

  /* ============================================================ Sichtenleiste Zeit - Zeiger - Formel und Ampelzeile */
function sichtOf() { const c = S.rig && S.rig.sicht; return c && typeof c === 'object' ? c : null; }
  let sichtSig = '';
  function buildSicht() { sichtSig = ''; updateSicht(true); }
  /* Sichtenleiste Zeit - Zeiger - Formel: die drei Texte kommen nur aus rig.sicht, die Hervorhebung aus controls[].sicht, "Zeitlupe" nur, wenn der Prüfstand state().zeitlupe meldet */
  function updateSicht(force) {
    const el = $('#chainBar'); if (!el) return; const c = sichtOf();
    if (!c) { if (el.innerHTML) el.innerHTML = ''; el.hidden = true; sichtSig = ''; return; }
    const st = S.st || {}, zl = fin(+st.zeitlupe) && +st.zeitlupe > 0 ? +st.zeitlupe : 0;
    const sig = [c.zeit, c.zeiger, c.formel, zl, S.sichtHot].join('|'); if (!force && sig === sichtSig) return; sichtSig = sig; el.hidden = false;
    el.innerHTML = '<div class="cnrow" role="group" aria-label="Zeit, Zeiger, Formel: drei Sichten auf dieselbe Größe">' + SICHTEN.map(v => `<div class="cn${S.sichtHot === v.id ? ' hot' : ''}" data-sv="${v.id}" style="--lc:${v.color}"><b><i class="lsym">${v.n}</i> ${esc(v.name)}</b><span>${esc(c[v.id] || '–')}</span><small>${esc(v.sub)}${v.id === 'zeiger' && zl ? ' · Zeitlupe ×' + fnum(zl, 0) : ''}</small></div>`).join('') + '</div>';
  }
  let ampSig = '';
  const ampelHinweis = () => { const C = CORE(); return (C && C.TEXTS && typeof C.TEXTS.ampelHinweis === 'string' && C.TEXTS.ampelHinweis) || 'Grün heißt: Vorgabe der Simulation erfüllt, nicht: gefahrlos aufbauen.'; };
  const simText = () => { const C = CORE(); return (C && C.TEXTS && typeof C.TEXTS.simOnly === 'string' && C.TEXTS.simOnly) || 'Simulation – Versuche an Netzspannung nur durch Elektrofachkraft oder unter Aufsicht der Ausbilder.'; };
  function updateAmp(force) {
    const el = $('#ampRow'); if (!el) return; const a = assessOf(S.rig);
    if (!a) { el.innerHTML = ''; return; }
    const k = ampKey(a.ampel), ra = S.ref && S.refRig ? assessOf(S.refRig) : null, zu = typeof a.zusatz === 'string' ? a.zusatz : '';
    const sig = [k, a.margin, a.text, zu, ra ? ra.ampel + ra.margin : '', S.refMode].join('|');
    if (!force && sig === ampSig) return; ampSig = sig;
    const A = AMP[k], mt = k === 'grau' ? '' : margTxt(a);
    el.className = 'amprow ' + A.cls; el.setAttribute('role', 'status');
    el.innerHTML = `<span class="asym" aria-hidden="true">${A.sym}</span><div class="atx"><b>${esc(A.name.charAt(0).toUpperCase() + A.name.slice(1))}${mt ? ': ' + esc(mt) : ''}</b><small>${esc(a.text || '')}</small>${zu ? `<small class="nt">${esc(zu)}</small>` : ''}<small class="nt">${esc(ampelHinweis())}</small></div>${ra ? `<div class="avs"><span>Vorher: ${esc(AMP[ampKey(ra.ampel)].sym)} ${fin(ra.margin) ? fnum(ra.margin, 2) : esc(AMP[ampKey(ra.ampel)].name)}</span><span>Nachher: ${esc(A.sym)} ${fin(a.margin) ? fnum(a.margin, 2) : esc(A.name)}${fin(a.margin) && fin(ra.margin) ? ' (' + sgn(a.margin - ra.margin) + fnum(a.margin - ra.margin, 2) + ')' : ''}</span></div>` : ''}`;
    const cv = $('#cv'); if (cv) cv.setAttribute('aria-label', 'Bild des Prüfstands ' + rigName(S.rigId) + '. Ampel ' + A.name + (mt ? ', ' + mt : '') + '. ' + (a.text || ''));
  }
  /* Hinweisband (simOnly): einmal je Anlage, schließbar (nur für diese Sitzung) */
  $('#simX').onclick = () => { S.simClosed[S.rigId] = 1; updateSimBand(); };
  /* Grenzwerte mit Status (Quelle WSL_CORE.limits): belegt oder Übungswert (A) */
  /* ============================================================ Vorher/Nachher: Merken, Geisterbild, Wischer */
  function merken() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    let s = null; try { s = S.rig.snapshot(); } catch (e) { s = null; } if (!s) { toast('Dieser Prüfstand kann seinen Zustand nicht merken.'); return; }
    setRef(s); stat('wslref', 1, 'max'); const a = assessOf(S.rig);
    toast('Gemerkt als Vorher' + (a && fin(a.margin) ? ' (' + margTxt(a) + ')' : '') + '. Ändere jetzt etwas und vergleiche.');
  }
  function toggleVN() {
    if (!S.ref) { toast('Merke zuerst einen Zustand: Taste M oder „Merken“.'); return; }
    S.refMode = S.refMode === 'vorher' ? 'nachher' : 'vorher'; buildBA(); updateAmp(true); stat('wslref', 1, 'max');
  }
  function toggleWipe() {
    if (!S.ref) { toast('Merke zuerst einen Zustand: Taste M oder „Merken“.'); return; }
    S.refMode = S.refMode === 'wischer' ? 'nachher' : 'wischer'; buildBA(); updateAmp(true); stat('wslref', 1, 'max'); if (S.tab !== 'rig') setTab('rig');
  }
  $('#baBar').addEventListener('click', e => {
    const b = e.target.closest('[data-ba]'), m = e.target.closest('[data-bm]');
    if (m) { S.refMode = m.dataset.bm; buildBA(); updateAmp(true); stat('wslref', 1, 'max'); return; }
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
  /* Anzeige: Werte in SI-Basiseinheit (Ω, V, A, s ...) mit Vorsatz (1,5 kΩ), sonst in der Einheit des Reglers (mm², m, mA, nF ...) */
  function ctlHtml(c) {
    const k = esc(c.key), L = GRUPPEN[gruppeOf(c)], lim = c.limit ? limGet(c.limit) : null, bd = lim ? ' ' + limBadge(lim) : '', help = c.help ? `<small class="hp">${esc(c.help)}</small>` : '', lv = `data-lv="${gruppeOf(c)}" data-sv="${esc(c.sicht || '')}" style="--lc:${L.color}"`;
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
  /* Auslöse-Taste oben im Bedienpult (rig.fire(): je Anlage Phase einfrieren, Frequenzdurchlauf, Messung, Kondensator zuschalten, Last zuschalten) */
  function buildPanel(host, filter, title) {
    panels = panels.filter(p => p.host !== host && p.host.isConnected);
    if (!S.rig) { host.innerHTML = '<div class="card">' + placeholderHtml() + '</div>'; return; }
    const list = ctlsOf().filter(c => !filter || filter.includes(c.key)), groups = [], gm = {};
    list.forEach(c => { const lv = filter ? 'f' : gruppeOf(c), L = GRUPPEN[lv] || { name: title || 'Bedienung', color: '#8d99a6' }; if (!gm[lv]) { gm[lv] = { lv, n: filter ? (title || 'Bedienung') : L.name, color: L.color, sym: (GRUPPEN[lv] || {}).sym || '', items: [] }; groups.push(gm[lv]); } gm[lv].items.push(c); });
    if (!filter) groups.sort((a, b) => GR_ORDER.indexOf(a.lv) - GR_ORDER.indexOf(b.lv)); else groups.forEach(g => g.items.sort((a, b) => filter.indexOf(a.key) - filter.indexOf(b.key)));
    host.innerHTML = (filter ? '' : fireHtml()) + groups.map(g => `<details class="card ctg" open data-lv="${g.lv}" style="--lc:${g.color}"><summary>${g.sym ? `<i class="lsym">${g.sym}</i> ` : ''}${esc(g.n)}${g.lv !== 'quelle' && !filter ? ' <span class="bdg uw" title="Übungswerte: Der Ausbilder gleicht ab">Übungswerte (A)</span>' : ''}</summary><div class="cb">${g.items.map(ctlHtml).join('')}</div></details>`).join('');
    const els = {}; $$('.ct[data-k]', host).forEach(el => { els[el.dataset.k] = { el, t: el.dataset.t, last: undefined, vis: true }; });
    panels.push({ host, els }); if (!host.__wslWired) { host.__wslWired = true; wirePanel(host); } syncCtl(true);
  }
  function buildControls() { ctlCache = { rig: null, list: [] }; buildPanel($('#ctlHost'), null); }
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
    if (!S.rig || typeof S.rig.fire !== 'function') { toast('Hier gibt es nichts auszulösen.'); return false; }
    if (S.readonly) return false;
    let r; try { r = S.rig.fire(); } catch (e) { console.error(e); return false; } if (r === false) return false;
    S.fired = true; S.sichtHot = null; updateSicht(); if (!S.running) setRun(true, true);
    stat('wslfire', 1);
    readState(); updateAmp(true); updateMeters(0, true);

    return true;
  }

  /* ============================================================ Messgeräte aus rig.meters */
  let mEls = [];
  /* Frontplatte (geraete.js): reiner Adapter, gleiche Regeln wie die Zahlenansicht (–, texts[], Dezimalkomma); Zahl, Einheit und digits kommen unverändert aus rig.meters[] */
  const meterState = (m, v) => ({ value: v, unit: m.unit || '', digits: m.digits == null ? 1 : m.digits, label: m.label, help: m.help || '', text: fin(v) && m.texts && m.texts[Math.round(v)] != null ? String(m.texts[Math.round(v)]) : null });
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
      const gauge = !S.digital && !m.texts && fin(+m.min) && fin(+m.max) && m.max > m.min;
      return gauge ? `<div class="mt" data-i="${i}" aria-label="${esc(m.label)}"><canvas></canvas><div class="lbl">${esc(m.label)}</div></div>` : `<div class="mt dg" data-i="${i}"><div class="lbl">${esc(m.label)}</div><div class="num"><span class="v">–</span><small>${esc(m.unit || '')}</small></div></div>`;
    }).join('');
    mEls = $$('.mt', H).map((el, i) => ({ el, m: ms[i], cv: $('canvas', el), v: $('.v', el), disp: null, drawn: null, txt: '', warn: false }));
  }
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
      if (x.front) { const st = x.st; st.value = t; st.text = x.m.texts && x.m.texts[Math.round(t)] != null ? String(x.m.texts[Math.round(t)]) : null; x.front.update(st); return; }
      if (x.cv) {
        if (x.disp == null || force) x.disp = t; else x.disp += (t - x.disp) * k;
        const rg = (x.m.max - x.m.min) || 1;
        if (force || x.drawn == null || Math.abs(x.disp - x.drawn) > rg * 0.0015 || Math.abs(t - x.disp) > rg * 0.0015) { x.drawn = x.disp; drawGauge(x, x.disp); }
      } else { const tx = x.m.texts && x.m.texts[Math.round(t)] != null ? String(x.m.texts[Math.round(t)]) : null, txt = tx != null ? tx : fnum(t, x.m.digits == null ? 1 : x.m.digits); if (txt !== x.txt) { x.txt = txt; x.v.textContent = txt; } }
      const wn = isWarn(x.m, t); if (wn !== x.warn) { x.warn = wn; x.el.classList.toggle('warn', wn); }
    });
  }

  /* ============================================================ Zeichenfläche (Prüfstand), Zeigerereignisse, Qualitätsstufen */
  const cvs = $('#cv'), g2 = cvs.getContext('2d'), cvw = $('#cvw');
  let cw = 0, ch = 0, dpr = 1;
  const cvfx = document.createElement('canvas'); cvfx.id = 'cvfx'; cvfx.setAttribute('aria-hidden', 'true'); cvfx.style.pointerEvents = 'none'; cvw.appendChild(cvfx);
  const fxg = cvfx.getContext('2d'); let fxDrew = false;
  /* Handybreite: Die Szenen legen sich nach der echten Pixelgröße aus, ein hohes Bild gibt ihnen Platz für die Beschriftungen */
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
  root.addEventListener('resize', () => { fitCanvas(); redrawTab(); updateMeters(0, true); updateBode(true); });

  /* ---- Qualitätsstufen (SPEC 6.4): Bildzeit (gleitender Mittelwert über 30 Bilder) steuert eine Stufe zurück oder hoch ---- */
  function setQMode(m) { if (!['auto', ...QLEVELS].includes(m)) return; S.q.mode = m; lsPut('wsl.q', m); S.q.ms = []; S.q.fastSince = 0; updateQLine(true); }
  let qSig = '';
  function updateQLine(force) {
    const el = $('#qLine'); if (!el) return;
    const hints = lsGet('wsl.hint', []), hid = Array.isArray(hints) && hints.includes(S.rigId);
    const sig = [curQ(), S.q.mode, reduced(), hid, S.rigId].join('|'); if (!force && sig === qSig) return; qSig = sig;
    el.innerHTML = `<span class="qv">Qualität: <b>${esc(curQ())}</b>${S.q.mode === 'auto' && !reduced() ? ' (automatisch)' : reduced() ? ' (Bewegung reduziert)' : ''}</span><button class="chip s" data-qc="1" aria-label="Qualitätsstufe wechseln" title="Qualität: automatisch, hoch, mittel, niedrig">⚙ ${esc(S.q.mode === 'auto' ? 'Auto' : S.q.mode)}</button>${hid ? '' : `<span class="qh" id="qHint">Übungsschaltung: Bauteilwerte sind Übungswerte. <button class="chip s" data-qh="1" aria-label="Hinweis schließen">✕</button></span>`}`;
  }
  $('#qLine').addEventListener('click', e => {
    if (e.target.closest('[data-qc]')) { const o = ['auto', ...QLEVELS], i = o.indexOf(S.q.mode); setQMode(o[(i + 1) % o.length]); toast('Qualität: ' + (S.q.mode === 'auto' ? 'automatisch' : S.q.mode)); }
    else if (e.target.closest('[data-qh]')) { const a = lsGet('wsl.hint', []), s = new Set(Array.isArray(a) ? a : []); s.add(S.rigId); lsSet('wsl.hint', [...s]); updateQLine(true); }
  });
  try { if (mqReduce.addEventListener) mqReduce.addEventListener('change', () => { updateQLine(true); updateChrome(); }); } catch (e) {}

  /* ---- Zeichnen: Vorher | Nachher | Wischer (SPEC 6.1, 8.2) ---- */
  function drawRig(ts) {
    if (!cw || cvw.offsetParent === null) return;
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.fillStyle = bgOf(); g2.fillRect(0, 0, cw, ch);
    if (!S.rig) { g2.fillStyle = '#8d99a6'; g2.font = '600 16px system-ui'; g2.textAlign = 'center'; g2.fillText('Prüfstand noch nicht geladen', cw / 2, ch / 2); return; }
    const r = S.ref && S.refRig && S.refMode === 'vorher' ? S.refRig : S.rig;
    try { r.draw(g2, cw, ch, ts, r === S.rig ? drawOpts() : { quality: curQ(), reduced: reduced(), theme: theme() }); }
    catch (e) { if (!drawErr) { drawErr = true; console.error('Zeichnung des Prüfstands:', e); } }
  }
  const holdsC = new Map(); let drag = null;
  /* hitTest liefert { key, kind:'switch'|'select'|'button'|'slider'|'knob', to?, set? }: to = Zielwert (Antippen/Ziehen), set = mehrere Steuerwerte (Sonde) */
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
  let fxCool = {}, fxBudgetT = 0;
  function fxReset() { fxCool = {}; fxDrew = false; if (S.fx) S.fx = { amp: null, kazoo: false, flags: {} }; if (root.LochFX && root.LochFX.clear) try { root.LochFX.clear(); } catch (e) {} }
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
        try {
      if (e.fx === 'zap' || e.fx === 'spark') F.sound('zap', 0.2);
      else if (e.fx === 'click' || e.fx === 'trip') F.sound('click', 0.25);
      else if (e.fx === 'defekt' || e.fx === 'smoke' || e.fx === 'buzz') F.sound('buzz', 0.35);
      else if (e.fx === 'alarm') F.sound('alarm', 0.2);
      else if (e.fx === 'ding') F.sound('ding', 0.5);
      else if (e.fx === 'tick') F.sound('tick', 0.3);
    } catch (er) {}
  }
  function noteFault(e) {
    const key = S.rigId + ':' + (e.fx || String(e.text || '').slice(0, 28));
    const a = lsGet('wsl.faults', []), s = new Set(Array.isArray(a) ? a : []); if (s.has(key)) return;
    s.add(key); lsSet('wsl.faults', [...s]); stat('wslfault', s.size, 'max');
  }
  /* Ampelwechsel: grün (nach nicht grün) → ding; Wechsel auf rot → alarm (leise); rot bei Überkompensation oder Spannungsüberhöhung → buzz; Resonanz getroffen → kurzer leiser Ton; je Wechsel einmal, nichts blinkt */
let toneT = 0;
  /* Resonanz getroffen: kurzer, leiser Ton, Frequenz aus f0 (Messgerät f0) logarithmisch auf 220 bis 1760 Hz abgebildet */
  function resoTone() {
    const F = root.LochFX; if (!F || !F.tone || !fxOn() || !canSound() || slowFx()) return; let m = {}; try { m = S.rig.readMeters() || {}; } catch (e) { m = {}; }
    const f0 = +m.f0; if (!fin(f0) || f0 <= 0) return; const v = clamp(Math.log10(f0), 0, 7);
    try { F.tone(220 * Math.pow(8, v / 7)); } catch (e) { return; } clearTimeout(toneT); toneT = setTimeout(() => { try { F.toneOff(); } catch (e) {} }, 450);
  }
  function fxAmpel(a) {
    if (!a || !S.fx) return; const k = ampKey(a.ampel), p = S.fx.amp; S.fx.amp = k; if (p == null || p === k) return;
    if (k === 'gruen' && p !== 'grau') { fxPlay('ding', 0.5); if (S.rigId === 'schwing') resoTone(); } else if (k === 'rot') fxPlay(['schwing', 'kompens'].includes(S.rigId) ? 'buzz' : 'alarm', 0.2);
  }
  /* neue Meldungen beobachten: Liste, Abzeichenstatistik, Effekte */
  function watchEvents(ts) {
    const r = S.rig; if (!r) return; const ev = r.events || []; let changed = false;
    for (let i = Math.max(0, ev.length - 30); i < ev.length; i++) {
      const e = ev[i]; if (!e || S.evSeen.has(e)) continue; S.evSeen.add(e); changed = true;
      if (e.kind === 'error') noteFault(e);
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
    const F = root.LochFX; if (!F) { toast('Effekte sind auf dieser Seite nicht geladen.'); return; } F.setMuted(fxOn()); lsPut('wsl.fx', fxOn() ? '1' : '0'); palSig = ''; updateChrome(); toast(fxOn() ? 'Effekte und Ton an' : 'Ton aus');
    if (fxOn()) F.sound('ding', 0.5);
  }

  /* ---- Meldungsliste (Zeitstempel in Anlagenzeit) und Hinweise aus rig.diagnose() ---- */
  $('#evClr').onclick = () => { if (S.rig && S.rig.events) { S.rig.events.length = 0; S.evSig = ''; updateEvents(true); } };
  let lastDiag = 0;
  function updateDiag(force) {
    const el = $('#diagList'); if (!el || !S.rig) return;
    const now = performance.now(); if (!force && now - lastDiag < 400) return; lastDiag = now;
    let d = []; try { d = typeof S.rig.diagnose === 'function' ? (S.rig.diagnose() || []) : []; } catch (e) { d = []; }
    S.diag = d; d.forEach(x => { if (x && x.id && !S.diagSeen[x.id]) S.diagSeen[x.id] = 1; });
    const h = d.length ? d.map(x => `<li class="${esc(x.kind || 'info')}"><span class="dk" aria-hidden="true">${x.kind === 'error' ? '✗' : x.kind === 'warn' ? '!' : 'i'}</span><span>${esc(x.text)}</span></li>`).join('') : '<li class="empty">Keine Hinweise: Zu den aktuellen Einstellungen meldet die Anlage nichts.</li>';
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  }

  /* ============================================================ Simulation (Animationsphase, Partikel, Impulsfolge; Ablauf live) */
  function setRun(on, auto) {
    if (on && !S.rig) { toast('Der Prüfstand ist noch nicht geladen.'); return; }
    S.running = !!on; updateChrome();
    if (on) { stat('wslrun', 1, 'max'); usedRig(); if (auto && !lsRaw('wsl.autohint', '')) { lsPut('wsl.autohint', '1'); toast('Die Animation läuft jetzt. Mit ⏸ unten hältst du sie an.'); } }
  }
  function setSpeed(v) { if (!SPEEDS.includes(v)) return; S.speed = v; lsPut('wsl.speed', String(v)); palSig = ''; updateChrome(); }
  /* geplanten Ablauf im Prüfstand ausführen (Zeit in Sekunden Demo-Zeit): Setzen, Rampen, Auslösen */
  /* Ergebnisse (Ampelwechsel, Statistik) regelmäßig aus dem Prüfstand lesen */
  function watchState() {
    const a = assessOf(S.rig); if (!a) return; fxAmpel(a);
    if (ampKey(a.ampel) === 'gruen') stat('wslgruen', 1, 'max');
  }

  /* ============================================================ CSV (Kennlinie), PNG, Druck */
  /* Kennlinie (erste aus rig.curves()) als CSV: Kopf, dann x; y; Reihe */
  function csvText() {
    let cv = null; try { cv = S.rig && typeof S.rig.curves === 'function' ? (S.rig.curves() || [])[0] : null; } catch (e) { cv = null; }
    if (!cv) return '';
    const rows = []; (cv.series || []).forEach(s => (s.points || []).forEach(p => rows.push([csvNum(p[0]), csvNum(p[1]), String(s.name || '').replace(/;/g, ',')].join(';'))));
    return '# Tonfunk Wechselstrom-Lab;' + S.name + ';' + (cv.title || '') + ';Übungswerte\r\n' + (cv.xLabel || 'x') + (cv.xUnit ? ' in ' + cv.xUnit : '') + ';' + (cv.yLabel || 'y') + (cv.yUnit ? ' in ' + cv.yUnit : '') + ';Reihe\r\n' + rows.join('\r\n') + '\r\n';
  }
  function exportCsv() { const t = csvText(); if (!t) { toast('Dieser Prüfstand hat keine Kennlinie zum Exportieren.'); return; } saveCsv(t, 'wsl-kennlinie.csv'); stat('csv'); toast('CSV gespeichert'); }
  function printNow() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; }
    const c = rigPng(1200, 750), who = lsRaw('lm4.name', ''), vals = allCtl(); let mv = {}; try { mv = S.rig.readMeters(); } catch (e) {} const a = assessOf(S.rig) || {};
    const cv = ctlsOf().filter(x => x.type !== 'button').map(x => { const v = vals[x.key]; let t = v; if (x.type === 'switch') t = v ? 'EIN' : 'AUS'; else if (x.type === 'select') { const o = (x.options || []).find(q => q.value === v || String(q.value) === String(v)); t = o ? o.label : v; } else t = ctlShow(x, v); return `<tr><td>${esc(GRUPPEN[gruppeOf(x)].name)}</td><td>${esc(x.label)}</td><td>${esc(t)}</td></tr>`; }).join('');
    const mt = metersOf().map(m => `<tr><td>${esc(m.label)}</td><td>${fnum(mv[m.key], m.digits == null ? 1 : m.digits)} ${esc(m.unit || '')}</td></tr>`).join('');
    const ev = ((S.rig.events) || []).slice(-15).map(e => `<tr><td>${esc(tstamp(e.t))}</td><td>${esc(e.text)}</td></tr>`).join('');
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

  /* ============================================================ Sweep und Ablauf (eingeklappte Zeile im Tab Prüfstand, Läufer WSL_CORE.runSeq) */
  function newRow() {
    const rs = curRows(), c = seqKeys()[0]; if (!c) return null;
    const last = rs.length ? rs[rs.length - 1] : null, t = last ? +(rowEnd(last) + 1).toPrecision(6) : 1;
    return { t, kind: 'set', key: c.key, value: defVal(c) };
  }
  /* Zeilen → Läufer-Format (Sekunden): { t, set:{key:Wert} }, { t, ramp:{key,to,durS} }, { t, fire:true } */
  function seqRunBg() {
    if (!S.rig) return; const steps = seqSteps(curRows()), end = seqDur(), id = S.rigId, d = defOf(id), C = CORE();
    if (!steps.length) { toast('Der Ablauf ist leer.'); return; }
    if (!C || typeof C.runSeq !== 'function') { toast('Der Läufer ist nicht geladen (wslcore-pruef.js fehlt).'); return; }
    toast('Berechne den Ablauf …');
    setTimeout(() => {
      const o = { seed: 1, sampleS: Math.max(0.05, end / 200) }; if (S.seqCur !== false) o.controls = allCtl();
      let res = null; try { res = C.runSeq(() => d.create({ seed: 1 }), steps, end, o); } catch (e) { console.error('runSeq:', e); res = null; }
      const fin2 = r => {
        if (!r || !Array.isArray(r.samples) || !r.samples.length) { toast('Der Ablauf konnte nicht berechnet werden.'); return; }
        S.seqRes = { samples: r.samples, final: r.final || {}, events: r.events || [], faults: r.faults || [], errors: r.errors || [], rejected: r.rejected || [], assess: r.assess || null, end, rigId: id, steps };
        stat('wslseq', 1, 'max'); renderSeqRes(); const el = $('#sqRes'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
      if (res && typeof res.then === 'function') res.then(fin2, () => fin2(null)); else fin2(res);
    }, 30);
  }
  function seqLiveDone() { S.live = null; stat('wslseq', 1, 'max'); toast('Ablauf beendet'); renderSweepLive(); }
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
  /* ============================================================ Beispiele (WSL_DATA.examples, eingebauter Rückfall ohne Zahlen im Text) */
const BUILTIN = [
    B('bx-sinus', 'Sinus: Frequenz und Phase ändern', 'Sinus', 'sinus', 'Verändere Frequenz und Phasenwinkel und beobachte Zeitbild und Zeiger.', {}, {}),
    B('bx-rlc', 'R, L, C: Frequenz ändern', 'Zeiger', 'rlc', 'Verändere die Frequenz und beobachte, wie sich die Blindwiderstände und die Zeiger ändern.', {}, {}),
    B('bx-filter', 'Tiefpass: Grenzfrequenz', 'Filter', 'filter', 'Verändere R und C und beobachte die Grenzfrequenz.', {}, {})
  ];
  function exampleList() {
    const d = root.WSL_DATA; let a = d && d.examples;
    if (a && !Array.isArray(a)) a = Object.keys(a).map(k => Object.assign({ id: k }, a[k]));
    if (!a || !a.length) a = BUILTIN;
    return a.map(e => ({ id: e.id, name: e.name, cat: e.cat || 'Beispiele', desc: e.desc || e.text || '', rig: e.rig, controls: e.controls || {}, dur: e.dur, ref: e.ref || null, rows: e.rows ? rowNorm(e.rows) : (e.seq ? seqToRows(e.seq) : null), seq: e.seq }));
  }
  /* Vorher-Zustand eines Beispiels: Steuerwerte des Beispiels, darüber die Werte aus ref (oder ein fertiger Schnappschuss) */
  function loadExample(e) {
    if (typeof e === 'string') { const n = e.toLowerCase(); e = exampleList().find(x => x.id === e || x.name.toLowerCase().includes(n)); }
    if (!e) return false; const had = stash(); S.task = null; taskRes = null;
    setRig(e.rig && ORDER.includes(e.rig) ? e.rig : S.rigId || ORDER[0]);
    applyCtl(e.controls); S.rows[S.rigId] = e.rows ? clone(e.rows) : []; S.seqDur[S.rigId] = e.dur && e.dur > 0 ? e.dur : null; S.seqRes = null;
    const rs = refFromExample(e); if (rs) { S.ref = rs; S.refMode = 'nachher'; buildRefRig(); buildBA(); updateAmp(true); }
    S.name = e.name; S.id = null; S.dirty = false; setTab('rig'); updateChrome(); saveCurSoon(); renderSweep();
    toast(had ? 'Beispiel geladen, dein Versuch ist gesichert' : 'Beispiel geladen: ' + e.name);
    /* Beispiele mit Ablauf (seq: set, ramp, fire, do) spielen den Ablauf gleich live ab, wie der Knopf Live im Ablauf-Editor */
    if (e.seq && e.seq.length && curRows().length) { try { seqLive(); } catch (er) { console.error(er); } }
    return true;
  }
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
  const PK = 'wsl.saves';
  /* Zustand ohne Aufgaben-Vorbelegung wiederherstellen; unbekannte Schlüssel, Werte und Versionen werden toleriert (Regel 8) */
  function applyItem(it, suffix) {
    S.task = null; taskRes = null; const rid = ORDER.includes(it.rig) ? it.rig : ORDER[0];
    setRig(rid, { keepRef: false }); applyCtl(it.ctl && typeof it.ctl === 'object' ? it.ctl : {}); S.bericht = it.bericht && typeof it.bericht === 'object' ? clone(it.bericht) : null;
    if (it.ref && typeof it.ref === 'object' && it.ref.ctl && typeof it.ref.ctl === 'object') { S.ref = clone(it.ref); S.refMode = ['vorher', 'nachher', 'wischer'].includes(it.refMode) ? it.refMode : 'nachher'; buildRefRig(); buildBA(); updateAmp(true); }
    S.rows[S.rigId] = Array.isArray(it.rows) ? rowNorm(it.rows.filter(r => r && typeof r === 'object' && (r.kind === 'fire' || typeof r.key === 'string'))) : []; S.seqDur[S.rigId] = fin(it.dur) && it.dur > 0 ? it.dur : null; S.seqRes = null;
    S.name = (it.name || 'Versuch') + (suffix || ''); S.dirty = false; updateChrome(); saveCurSoon();
    setTab('rig'); renderSweep();
  }
  const shareObj = () => ({ k: 'wsl', name: S.name, rig: S.rigId, ctl: allCtl(), ref: S.ref ? clone(S.ref) : null, refMode: S.refMode, rows: clone(curRows()), dur: seqDur(), bericht: S.bericht ? clone(S.bericht) : null });
  async function shareNow() {
    if (!S.rig) { toast('Es gibt noch nichts zu teilen: der Prüfstand fehlt.'); return; }
    let url; try { url = location.href.split('#')[0].split('?')[0] + '#' + await packShare(shareObj()); } catch (e) { toast('Teilen nicht möglich'); return; }
    if (navigator.share) { try { await navigator.share({ title: 'Tonfunk Wechselstrom-Lab: ' + S.name, text: 'Schau dir meinen Versuch „' + S.name + '“ an:', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    sheet('Teilen', b => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">Diesen Link weitergeben (zum Beispiel per WhatsApp oder E-Mail). Wer ihn öffnet, bekommt eine Kopie deines Versuchs mit Prüfstand, Einstellungen, Vorher-Zustand, Ablauf und Messreihe.</p><textarea id="shTx" rows="5" readonly></textarea><div class="btns"><button class="btn pri" id="shCp">Link kopieren</button></div>';
      const ta = $('#shTx', b); ta.value = url; ta.addEventListener('focus', () => ta.select());
      $('#shCp', b).onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Link kopiert'); } catch (e) { ta.select(); toast('Bitte Text markieren und kopieren'); } };
    });
  }

  /* ============================================================ Aufgaben (WSL_TASKS) */
  const TK = () => (root.WSL_TASKS && Array.isArray(root.WSL_TASKS.tasks) && root.WSL_TASKS.tasks.length ? root.WSL_TASKS.tasks : null);
  $('#taskBar').addEventListener('click', e => { const b = e.target.closest('[data-ta]'); if (!b) return; if (b.dataset.ta === 'info') setTab('tasks'); else checkTask(); });
  /* Aufgabenzustand (start() und sol() liefern { rig?, controls?, seq?: [{t(s), set|ramp|fire}], dur(s)?, ref?, value? }) übernehmen */
  function applyTaskState(t, o) {
    o = o || {}; const rid = o.rig || t.rig || S.rigId;
    setRig(ORDER.includes(rid) ? rid : S.rigId); applyCtl(o.controls || o.ctl);
    S.rows[S.rigId] = o.rows ? rowNorm(o.rows) : seqToRows(o.seq); S.seqDur[S.rigId] = o.dur && o.dur > 0 ? o.dur : null; S.seqRes = null; S.taskStart = o; S.clicks = []; S.bericht = o.bericht && typeof o.bericht === 'object' ? clone(o.bericht) : null;
    if (o.ref && typeof o.ref === 'object') { const rs = o.ref.ctl ? clone(o.ref) : refFromExample({ rig: S.rigId, controls: o.controls || {}, ref: o.ref }); if (rs) { S.ref = rs; S.refMode = 'nachher'; buildRefRig(); buildBA(); updateAmp(true); } }
  }
  async function startTask(id) {
    const t = (TK() || []).find(x => x.id === id); if (!t) return;
    const had = stash(); taskRes = null;
    if (root.Auswertung) root.Auswertung.hintReset(id);
    let o; try { o = typeof t.start === 'function' ? t.start() : {}; } catch (e) { console.error(e); toast('Die Startvorlage der Aufgabe fehlt'); return; }
    S.task = null; applyTaskState(t, o); S.task = { id }; S.name = t.title; S.id = null; S.dirty = false; delete taskAns[id];
    setTab('tasks'); updateChrome();
    toast(had ? 'Aufgabe gestartet, dein Versuch ist gesichert' : 'Aufgabe gestartet'); renderTasksIfOpen();
  }
  /* Abgabe: { rig, controls, ref, value, text, fields, choices, clicks, ... } (SPEC 8.5) */
  function collectAnswer(t) {
    let st = null; try { st = S.rig ? clone(S.rig.state()) : null; } catch (e) {}
    const a = taskAns[t.id] || {}, v = a.v != null && a.v !== '' ? parseNum(a.v) : NaN, fl = fieldsOf(t), fo = {};
    fl.forEach(f => { const raw = a.f && a.f[f.key], x = raw != null && raw !== '' ? parseNum(raw) : NaN; fo[f.key] = fin(x) ? x : null; });
    const first = fl.length ? fo[fl[0].key] : null;
    return { rig: S.rigId, controls: allCtl(), ref: S.ref ? clone(S.ref) : null, seq: seqSteps(curRows()), rows: clone(curRows()), dur: seqDur(), state: st, simTime: S.simT, fired: !!S.fired, value: fin(v) ? v : (fin(first) ? first : null), text: a.v == null ? '' : String(a.v), fields: fo, choices: Object.assign({}, a.c || {}), clicks: clone(S.clicks || []), bericht: S.bericht ? clone(S.bericht) : null };
  }
  async function checkTask() {
    const t = curTask(); if (!t) return; const R = root.WSL_TASKS;
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
    setTab('rig'); if (has) seqLive(); else { setRun(true); if (canFire() && o && o.fire !== false && o.fired) doFire(); }
    toast((had ? 'Auto-Weg läuft, dein Stand ist gesichert' : 'Auto-Weg: Die Musterlösung läuft') + (o && fin(o.value) ? ' · Ergebnis der Musterlösung: ' + fauto(o.value) : ''));
  }
  function hintTask() {
    const t = curTask(); if (!t) return; const h = t.hint, arr = Array.isArray(h) ? h : null;
    const o = { id: t.id, hint: arr ? arr[0] : h, concrete: () => { if (arr && arr[1]) return arr[1]; const l = taskRes && taskRes.id === t.id ? taskRes.lines.find(x => !x.ok) : null; return l ? 'Noch nicht erfüllt: ' + l.text : taskRes && taskRes.id === t.id ? 'Alle Prüfpunkte sind erfüllt. Tippe auf „Lösung prüfen“.' : 'Tippe zuerst auf „Lösung prüfen“, dann kann ich dir den ersten offenen Punkt nennen.'; }, reveal: arr && arr[2] ? () => arr[2] : null, solution: typeof t.sol === 'function' ? () => autoWay(t) : null };
    if (root.Auswertung) root.Auswertung.hint(o); else sheet('Tipp', b => { b.innerHTML = '<p style="margin-top:0">' + esc(o.hint || '') + '</p>'; });
  }
  function tableHtml(tb) {
    if (!tb) return ''; const list = Array.isArray(tb) && tb.length && !Array.isArray(tb[0]) && typeof tb[0] === 'object' ? tb : [tb];
    const cell = v => esc(typeof v === 'number' ? fauto(v) : v), one = t1 => {
      let head = t1.head || t1.header || t1.cols || t1.columns, rows = t1.rows || t1.data;
      if (Array.isArray(t1) && !head) { head = t1[0]; rows = t1.slice(1); }
      rows = Array.isArray(rows) ? rows : []; return `<div class="wsl-tbl"><table>${t1.caption || t1.title ? `<caption>${esc(t1.caption || t1.title)}</caption>` : ''}${Array.isArray(head) ? `<thead><tr>${head.map(h => `<th>${cell(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map(r => `<tr>${(Array.isArray(r) ? r : [r]).map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    };
    return list.map(one).join('');
  }
  function renderTasks() {
    const V = $('#taskView'), A = TK();
    if (!A) { V.innerHTML = '<div class="card pl"><h4>Aufgaben</h4><p class="big">Aufgaben folgen</p><p class="hint2">Hier erscheinen Aufgaben mit automatischer Prüfung: Sinusgrößen, Zeigerdiagramm, R, L, C, Leistung, Kompensation, Schwingkreise, Filter, Transformator, Drehstrom und prüfungsnahe Aufgaben. Bis dahin kannst du mit den Beispielen, dem Rechner und dem Tab „Lernen“ üben.</p><div class="btns"><button class="btn pri" id="tkEx">Beispiele ansehen</button><button class="btn" id="tkRetry" data-retry>Erneut prüfen</button></div></div>'; $('#tkEx', V).onclick = openExamples; return; }
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
      if (a === 'check') checkTask(); else if (a === 'hint') hintTask(); else if (a === 'rig') setTab('rig'); else if (a === 'report') setTab('report'); else if (a === 'calc') setTab('calc');
      else if (a === 'auto') { if (t && await confirmSheet('Auto-Weg?', 'Der Prüfstand spielt die Musterlösung ab. Das <b>zählt als Hilfe</b> (Stufe 3): Dein Ausbilder sieht es.', 'Abspielen')) autoWay(t); }
      else if (a === 'hand') { if (t && root.Auswertung) root.Auswertung.handIn(t.id, taskDone()[t.id] || 0, t.title); }
      else if (a === 'end') { S.task = null; taskRes = null; updateChrome(); renderTasks(); toast('Aufgabe beendet'); }
    } else if (row) startTask(row.dataset.t);
  });

  /* ============================================================ Fehler-Würfel: Fehler auswürfeln (wirkt auf Steuerwerte, je Prüfstand nur sinnvolle Arten, Tabelle DICE); "Finde den Fehler" prüft die Behebung mit runSeq gegen den Ausgangs-Ampelzustand */
const fNetz = () => { const l = limGet('f_netz'); return l && fin(+l.value) ? +l.value : 50; };
  const uScale = c => (c && c.unit === 'µF' ? 1e6 : c && c.unit === 'nF' ? 1e9 : 1);
  /* Ziel-cos-phi fuer den Wuerfel: die Vorgabe des Pruefstands, ohne Vorgabe (ziel = 0) der Uebungswert limits.cos_ziel (A, F6) */
  function dieZiel() { const z = +cval('ziel'); if (fin(z) && z > 0) return z; const C = CORE(); let l = null; try { l = C && C.limit ? C.limit('cos_ziel') : null; } catch (e) { l = null; } return l && fin(+l.value) ? +l.value : NaN; }
  const DICE = {
    rlc: [
      { id: 'c-vorsatz', name: 'Kondensator um Faktor 10 zu groß', apply: () => { const ab = String(cval('aufbau')), c = +cval('c'), cd = ctlDef('c'); if (!cd || !fin(c) || c <= 0 || !(/C/.test(ab) || /parallel/i.test(ab))) return null; if (c * 10 <= cd.max) return { c: c * 10 }; if (c / 10 >= cd.min) return { c: c / 10 }; return null; }, text: (b, a) => 'Der Kondensator hat einen falschen Vorsatz (Bauteilfehler, zum Beispiel 47 µF statt 4,7 µF): Seine Kapazität ist zehnmal zu groß (oder, bei sehr großem C, zehnmal zu klein). X_C ändert sich um den Faktor 10; Strom und Phasenlage stimmen nicht mehr mit der Vorgabe überein.' + dm(b, a) },
      { id: 'blind-vertauscht', name: 'Blindwiderstand vertauscht', apply: () => {
          const ab = String(cval('aufbau')), C = CORE();
          if (/^R[\s-]*L$/i.test(ab)) return { aufbau: pickOpt('aufbau', /^R[\s-]*C$/i) };
          if (/^R[\s-]*C$/i.test(ab)) return { aufbau: pickOpt('aufbau', /^R[\s-]*L$/i) };
          if (/^L$/i.test(ab)) return { aufbau: pickOpt('aufbau', /^C$/i) };
          if (/^C$/i.test(ab)) return { aufbau: pickOpt('aufbau', /^L$/i) };
          const f = +cval('f'); let r = null; try { r = C && C.res && C.res.series ? C.res.series({ u: +cval('u'), f, r: +cval('r'), l: +cval('l'), c: +cval('c') }) : null; } catch (e) { r = null; }
          const f0 = r && +r.f0; if (!fin(f0) || !fin(f) || f <= 0) return null; return { f: f0 * f0 / f };
        }, text: (b, a) => 'Spule und Kondensator sind vertauscht (beim RLC-Kreis spiegelt die Frequenz X_L und X_C um die Resonanz): Der Scheinwiderstand bleibt gleich, die Phasenverschiebung dreht das Vorzeichen. Am Kondensator eilt der Strom der Spannung vor, an der Spule nach.' + dm(b, a) }],
    kompens: [
      { id: 'ueberkompensation', name: 'Überkompensation', apply: () => { const C = CORE(); let n = null; try { n = C && C.comp && C.comp.need ? C.comp.need({ p: +cval('p'), cos1: +cval('cos1'), cos2: dieZiel(), u: +cval('u'), f: fNetz(), form: 'parallel' }) : null; } catch (e) { n = null; } const c = n && +n.c, cd = ctlDef('c'); if (!fin(c) || c <= 0 || !cd) return null; return { c: Math.min(cd.max, 2 * c * uScale(cd)) }; }, text: (b, a) => 'Das Kompensations-C ist doppelt so groß wie nötig: Die Last wird kapazitiv, die Blindleistung kippt ins Negative und cos φ sinkt wieder. Ein hoher cos φ allein heißt nicht: gut kompensiert.' + dm(b, a) }],
    schwing: [
      { id: 'guete-klein', name: 'Güte zu klein', apply: () => { if (/parallel/i.test(String(cval('art')))) { const k = ctlDef('rp') ? 'rp' : 'r', d = ctlDef(k); return d ? { [k]: d.min } : null; } const d = ctlDef('r'); return d ? { r: d.max } : null; }, text: (b, a) => 'Der Verlustwiderstand ist so gewählt, dass die Güte klein wird: Die Resonanzkurve wird flach und breit, die Überhöhung verschwindet.' + dm(b, a) }],
    filter: [
      { id: 'typ-vertauscht', name: 'Typ vertauscht', apply: () => ({ typ: pickOpt('typ', /^tief/i.test(String(cval('typ'))) ? /^hoch/i : /^tief/i) }), text: (b, a) => 'Hochpass und Tiefpass sind vertauscht: Der Filter lässt genau den falschen Frequenzbereich durch.' + dm(b, a) }],
    trafo: [
      { id: 'gleichspannung', name: 'Gleichspannung am Trafo', apply: () => ({ dc: pickOpt('dc', /gleich/i) }), text: (b, a) => 'Gleichspannung am Trafo (Fehlerbild der Simulation): Ohne Wechselfeld gibt es keine Sekundärspannung und keinen induktiven Widerstand. Der Strom wird nur vom Wicklungswiderstand begrenzt, die Wicklung ist gefährdet.' + dm(b, a) }],
    drehstrom: [
      { id: 'stern-dreieck', name: 'Stern statt Dreieck', apply: () => ({ schaltung: pickOpt('schaltung', /^stern/i.test(String(cval('schaltung'))) ? /^dreieck/i : /^stern/i) }), text: (b, a) => 'Stern und Dreieck sind vertauscht: Am Strang liegt eine andere Spannung (U_L gegen U_L durch √3), die Leistung ändert sich um den Faktor 3.' + dm(b, a) }]
  };
  root.WSL_DICE = DICE;
  /* Behebung prüfen: runSeq (ein Schritt, aktuelle Steuerwerte) liefert die Ampel; sie muss mindestens so gut sein wie vor dem Fehler */
  $('#diceBar').addEventListener('click', e => { const x = e.target.closest('[data-d]'); if (!x) return; if (x.dataset.d === 'check') checkDice(); else if (x.dataset.d === 'show') showDice(); else if (x.dataset.d === 'undo') undoDice(); });
  function diceRoll() {
    if (!S.rig) { toast('Der Prüfstand fehlt.'); return; } if (S.task) { toast('Beende zuerst die Aufgabe.'); return; }
    const ok = (DICE[S.rigId] || []).filter(d => diceKeys(d)); if (!ok.length) { toast('An diesem Prüfstand lässt sich nichts auswürfeln.'); return; }
    const d = ok[Math.floor(Math.random() * ok.length)], base = assessOf(S.rig), bm = marg(), keys = diceKeys(d), before = {}; Object.keys(keys).forEach(k => { before[k] = cval(k); });
    applyCtl(keys); readState(); const am = marg(), text = d.text(bm, am);
    S.dice = { id: d.id, name: d.name, text, before, rigId: S.rigId, base: base ? { ampel: ampKey(base.ampel), margin: base.margin } : null, result: '', fixed: false };
    stat('wslfehler', 1); S.dirty = true; saveCurSoon(); if (!S.running) setRun(true); updateDice(); updateAmp(true);
    if (root.LochFX && canSound()) try { root.LochFX.sound('slide'); } catch (e) {}
    sheet('🎲 Fehler gewürfelt', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Am Aufbau stimmt etwas nicht. Beobachte Ampel und Messgeräte und finde die Ursache. Mit „Behebung prüfen“ kontrolliert der Prüfstand, ob die Ampel wieder so gut ist wie vorher.</p><div class="btns"><button class="btn" data-d="show">Auflösung zeigen</button><button class="btn" data-d="undo">Fehler beheben</button><button class="btn pri" data-d="ok">Ich suche selbst</button></div><div id="dcOut"></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-d]'); if (!x || !S.dice) return; if (x.dataset.d === 'show') $('#dcOut', b).innerHTML = '<div class="ex">' + esc(S.dice.text) + '</div>'; else if (x.dataset.d === 'undo') { undoDice(); close(); } else close(); });
    });
  }

/* ============================================================ Bode-Vertiefung (nur Filter): aufklappbar, Zustand in wsl.deep, alle Werte aus WSL_CORE.filter */
  const deepGet = () => { const d = lsGet('wsl.deep', {}); return d && typeof d === 'object' && !Array.isArray(d) ? d : {}; };
  /* Lernen wird nur einmal gerendert: die Klappe der Bode-Vertiefung dort nach dem Zustand in wsl.deep nachziehen (Taste B, Kennlinien, Pruefstand) */
  function syncHelpDeep() { try { const d = document.querySelector('#helpView details[data-deep="bode"]'), want = !!deepGet().bode; if (d && d.open !== want) d.open = want; } catch (e) { /* kein Absturz */ } }
  function deepSet(k, v) { const d = deepGet(); d[k] = !!v; if (k === 'bode' && v) { d.n = (+d.n || 0) + 1; stat('wslbode', d.n, 'max'); } lsSet('wsl.deep', d); if (k === 'bode') syncHelpDeep(); }
  function filterCfg() {
    const v = allCtl(), lo = x => String(x == null ? '' : x).toLowerCase(), art = /rl/.test(lo(v.art)) ? 'RL' : 'RC', typ = /hoch/.test(lo(v.typ)) ? 'hoch' : 'tief';
    const cfg = { art, typ, r: +v.r, ue: +v.ue || 1, f: +v.f }; if (art === 'RL') cfg.l = +v.l; else cfg.c = +v.c; return cfg;
  }
  function bodeData() {
    const C = CORE(); if (!C || !C.filter || typeof C.filter.bode !== 'function') return { why: 'Der Kern (wslcore-res.js) ist nicht geladen.' };
    const cfg = filterCfg(); let g = null; try { g = cfg.art === 'RL' ? C.filter.rl(cfg) : C.filter.rc(cfg); } catch (e) { g = null; }
    const fg = g && +g.fg; if (!fin(fg) || fg <= 0) return { why: (g && g.why) || 'Für diese Werte gibt es keine Grenzfrequenz.' };
    const fl = []; for (let i = 0; i <= 60; i++) fl.push(fg * Math.pow(10, -2 + 4 * i / 60));
    let b = null; try { b = C.filter.bode(cfg, fl); } catch (e) { b = null; }
    if (!b || b.ok === false || !Array.isArray(b.a) || !b.a.length) return { why: (b && b.why) || 'Das Bode-Diagramm ist für diese Werte nicht gültig.' };
    const resp = f => { try { const r = C.filter.response(cfg, f); return r && fin(+r.a) ? +r.a : null; } catch (e) { return null; } };
    const refF = cfg.typ === 'hoch' ? fg / 10 : fg * 10;
    return { cfg, fg, f: Array.isArray(b.f) && b.f.length === b.a.length ? b.f : fl, a: b.a, phi: Array.isArray(b.phi) && b.phi.length === b.a.length ? b.phi : null, asymp: Array.isArray(b.asymp) ? b.asymp : (b.asymp && Array.isArray(b.asymp.a) ? b.asymp.a : null), a1: resp(fg), aRef: resp(refF), refF };
  }
  function drawBode() {
    const cv = $('#bodeCv'), tx = $('#bodeTx'); if (!cv) return; const D = bodeData();
    const w = cv.clientWidth, h = 300; if (!w) return; const dp = Math.min(2, root.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dp) || cv.height !== Math.round(h * dp)) { cv.width = Math.round(w * dp); cv.height = Math.round(h * dp); cv.style.height = h + 'px'; }
    const g = cv.getContext('2d'); g.setTransform(dp, 0, 0, dp, 0, 0); g.clearRect(0, 0, w, h); const K = gaugePal();
    if (D.why) { g.fillStyle = K.mute; g.font = '600 14px system-ui'; g.textAlign = 'center'; g.fillText(D.why, w / 2, h / 2); if (tx) tx.textContent = D.why; return; }
    const L = 54, R = 10, T1 = 14, H1 = 150, T2 = 190, H2 = 80, pw = w - L - R;
    const lf = D.f.map(Math.log10), x0 = lf[0], x1 = lf[lf.length - 1], X = f => L + pw * (Math.log10(f) - x0) / ((x1 - x0) || 1);
    let amin = Math.min(...D.a), amax = Math.max(0, ...D.a); amin = Math.floor((amin - 3) / 10) * 10; amax = Math.ceil((amax + 3) / 10) * 10; if (amax - amin < 20) amin = amax - 20;
    const Y1 = a => T1 + H1 * (amax - a) / (amax - amin);
    g.font = '11px system-ui'; g.lineWidth = 1;
    for (let k = Math.ceil(x0); k <= Math.floor(x1); k++) { const x = L + pw * (k - x0) / ((x1 - x0) || 1); g.strokeStyle = K.track; g.beginPath(); g.moveTo(x, T1); g.lineTo(x, T2 + H2); g.stroke(); g.fillStyle = K.mute; g.textAlign = 'center'; g.fillText(fe(Math.pow(10, k), 'Hz'), x, T2 + H2 + 14); }
    for (let a = amin; a <= amax; a += 10) { const y = Y1(a); g.strokeStyle = K.track; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.fillStyle = K.mute; g.textAlign = 'right'; g.fillText(String(a), L - 5, y + 4); }
    g.fillStyle = K.mute; g.textAlign = 'left'; g.fillText('a in dB', 4, T1 + 4); g.fillText('φ in °', 4, T2 - 6); g.textAlign = 'center'; g.fillText('Frequenz f in Hz (logarithmisch, Dekaden)', L + pw / 2, h - 1);
    if (D.asymp && D.asymp.length === D.f.length) { g.setLineDash([5, 4]); g.strokeStyle = K.mute; g.lineWidth = 1.5; g.beginPath(); D.asymp.forEach((a, i) => { const x = X(D.f[i]), y = Y1(+a); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.setLineDash([]); }
    g.strokeStyle = K.acc; g.lineWidth = 2.4; g.beginPath(); D.a.forEach((a, i) => { const x = X(D.f[i]), y = Y1(+a); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    const xg = X(D.fg); g.setLineDash([3, 3]); g.strokeStyle = K.fg; g.lineWidth = 1; g.beginPath(); g.moveTo(xg, T1); g.lineTo(xg, T2 + H2); g.stroke(); g.setLineDash([]);
    g.fillStyle = K.fg; g.textAlign = 'left'; g.fillText('Knick f_g = ' + fe(D.fg, 'Hz'), Math.min(xg + 4, L + pw - 110), T1 + 10);
    if (D.a1 != null) { g.beginPath(); g.arc(xg, Y1(D.a1), 4, 0, 7); g.fill(); g.textAlign = 'left'; g.fillText(fnum(D.a1, 2) + ' dB', Math.min(xg + 6, L + pw - 60), Y1(D.a1) + 14); }
    if (D.phi) { const pmin = Math.min(...D.phi, 0), pmax = Math.max(...D.phi, 0), Y2 = p => T2 + H2 * (pmax - p) / ((pmax - pmin) || 1); g.strokeStyle = K.badfg; g.lineWidth = 2; g.beginPath(); D.phi.forEach((p, i) => { const x = X(D.f[i]), y = Y2(+p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.fillStyle = K.mute; g.textAlign = 'right'; g.fillText(fnum(pmax, 0), L - 5, T2 + 4); g.fillText(fnum(pmin, 0), L - 5, T2 + H2 + 4); }
    if (tx) tx.textContent = 'Grenzfrequenz f_g = ' + fe(D.fg, 'Hz') + (D.a1 != null ? '; bei f_g liegt die Kurve bei ' + fnum(D.a1, 2) + ' dB (der Knick der Asymptoten liegt bei 0 dB).' : '.') + (D.aRef != null ? ' Eine Dekade ' + (D.cfg.typ === 'hoch' ? 'unter' : 'über') + ' f_g (' + fe(D.refF, 'Hz') + '): ' + fnum(D.aRef, 2) + ' dB, nicht genau ±20 dB.' : '');
    cv.setAttribute('aria-label', 'Bode-Diagramm des Filters. ' + (tx ? tx.textContent : ''));
  }
  let bodeSig = '';
  function updateBode(force) {
    const card = $('#cBode'); if (!card) return; const on = S.rigId === 'filter' && !!S.rig;
    if (card.hidden === on) card.hidden = !on; if (!on) return;
    const open = !!deepGet().bode; if (card.open !== open) card.open = open;
    if (!card.open || S.tab !== 'rig') return;
    let sig = ''; try { sig = JSON.stringify(allCtl()) + '|' + ($('#bodeCv') ? $('#bodeCv').clientWidth : 0); } catch (e) { sig = String(Math.random()); }
    if (!force && sig === bodeSig) return; bodeSig = sig; drawBode();
  }
  (function () { const card = $('#cBode'); if (!card) return; card.addEventListener('toggle', () => { if (card.hidden) return; if (card.open !== !!deepGet().bode) deepSet('bode', card.open); bodeSig = ''; updateBode(true); }); })();
  function toggleBode() {
    if (S.tab === 'curve') { const E = extOf('curve'); if (E && typeof E.toggleBode === 'function') { try { E.toggleBode(); return; } catch (e) {} } deepSet('bode', !deepGet().bode); extRefresh(); return; }
    if (S.rigId !== 'filter') { toast('Die Bode-Vertiefung gibt es am Prüfstand „Hoch- und Tiefpass“ und in den Kennlinien.'); return; }
    deepSet('bode', !deepGet().bode); if (S.tab !== 'rig') setTab('rig'); updateBode(true);
  }
  /* ============================================================ Kennlinien, Messreihe, Auslegen, Rechnen, Lernen: Erweiterungen (WSL_UI_EXT, VERTRAG 6.5) */
  function extApi() {
    return { get S() { return S; }, get rig() { return S.rig; }, setTab, loadExample, startTask, toast, esc, stat: (k, v, m) => { if (k === 'wslcalc') S.calcUsed = true; stat(k, v, m); }, lsGet, lsSet, get WSL_CORE() { return CORE(); }, get WSL_DRAW() { return DRAW(); }, snapshot, setRef, get quality() { return curQ(); }, get reduced() { return reduced(); }, get theme() { return theme(); },
      KEYS, GRUPPEN, SICHTEN, ORDER, SPEEDS, deep: { get: deepGet, set: deepSet, opened: deepOpened }, loadRig, setCtl, applyCtl, ctlShow, ctlParse, rigName, rigIcon, defOf, fnum, fe, parseNum, setRun, resetRig, merken, toggleVN, doFire, assessOf, allCtl, limGet, limBadge,
      getBericht: () => (S.bericht ? clone(S.bericht) : null), setBericht: p => { S.bericht = p && typeof p === 'object' ? clone(p) : null; S.dirty = true; saveCurSoon(); } };
  }
  const EXTHOST = { curve: '#curveView', report: '#reportView', design: '#designView', calc: '#calcView', help: '#helpView' }, EXTFILE = { curve: 'wslui-curve.js', report: 'wslui-report.js', design: 'wslui-design.js', calc: 'wslui-calc.js', help: 'wslui-help.js' }, EXTNAME = { curve: 'Kennlinien', report: 'Messreihe', design: 'Auslegen', calc: 'Rechnen', help: 'Lernen' };
  const extOf = kind => root.WSL_UI_EXT && root.WSL_UI_EXT[kind];
  const { allCtl, ampelNow, applyCtl, ask, backToRef, buildBA, buildPick, buildTabs, canFire, choicesOf, coerce, curQ, curRows, curTask, cvPos, cval, exportPng, fe, fieldsOf, fireHtml, importSheet, keysHtml, keysSheet, limGet, limIds, loadShared, metersOf, newExperiment, openList, parseNum, placeholderHtml, presetsOf, qualityFeed, readState, reduced, refFromExample, renderSweep, renderTasksIfOpen, resetRun, rigIcon, rigName, rowText, saves, seqDur, seqLive, seqSteps, seqStop, setRef, snapshot, toggleCtl, updateChrome, updateSimBand, updateTaskBadge, updateTaskBar, usePick, wirePanel, deepOpened, gruppeOf, loadRig, saveItem, buildLimits, buildPresets, buildRefRig, checkDice, ctlParse, ctlShow, diceKeys, doSave, drawOpts, marg, pickOpt, renderExt, renderSeqRes, resetRig, rigPng, seqKeys, showDice, simAdvance, slowFx, stash, undoDice, updateDice, updateEvents, updateStat } = root.RIGUI.kit('wsl', { CORE, EXTFILE, EXTHOST, EXTNAME, FIREHINT, FIRELBL, GRUPPEN, KEYS, ORDER, PK, RIGLIMITS, RIGMETA, S, TABS, TK, applyItem, bandOf, buildControls, buildMeters, buildPal, buildSicht, ctlDef, ctlsOf, cvs, deepGet, defOf, doFire, extApi, extOf, extRefresh, fxReset, mqReduce, renderSweepLive, renderTasks, saveCur, saveCurSoon, seqLiveDone, setRig, setRun, setTab, simText, syncCtl, updateAmp, updateDiag, updateMeters, updateQLine, updateTitle, updateWipeDom });
  function extRefresh() { if (S.tab === 'curve' || S.tab === 'report') { const E = extOf(S.tab); if (E && typeof E.refresh === 'function') { try { E.refresh(); return; } catch (e) {} } renderExt(S.tab); } }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-retry]') && EXTHOST[S.tab]) renderExt(S.tab); });

  /* ============================================================ Oberfläche: Kopf, Tabs, Leiste */
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function redrawTab() { if (S.tab === 'curve' || S.tab === 'report') { const E = extOf(S.tab); if (E && typeof E.redraw === 'function') { try { E.redraw(); } catch (e) {} } } }
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'rig'; S.tab = t; lsPut('wsl.tab', t);
    $('#mid').dataset.tab = t; $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (EXTHOST[t]) renderExt(t); else if (t === 'tasks') renderTasks();
    if (t === 'help') syncHelpDeep();
    buildPick(); updateChrome();
    requestAnimationFrame(() => { fitCanvas(); updateMeters(0, true); redrawTab(); syncCtl(true); updateSicht(true); updateBode(true); });
  }
  function updateTitle() {
    const nm = rigName(S.rigId || ORDER[0]);
    $('#title').innerHTML = esc(S.name) + (S.dirty ? ' •' : '') + '\n<small>' + esc(nm) + (S.running ? ' · läuft' : '') + '</small>';
    document.title = 'Wechselstrom-Lab: ' + S.name;
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
  $('#bRun').onclick = () => setRun(!S.running);
  $('#bEx').onclick = openExamples; $('#bOpen').onclick = openList; $('#bTasks').onclick = () => setTab('tasks'); $('#bShare').onclick = shareNow; $('#bPrint').onclick = printNow;

  /* ============================================================ Menü */
  function openMenu() {
    const nT = (TK() || []).length, kk = KEYS.filter(k => !k.ext).map(k => k.keys.join('/')).slice(0, 4).join(', ');
const rows = [
      ['tasks', 'Aufgaben', nT ? nT + ' Aufgaben mit automatischer Prüfung' : 'Aufgaben folgen'], ['print', 'Drucken', 'Einstellungen, Messwerte, Ampel und Prüfstandbild'], ['new', 'Neuer Versuch', 'Prüfstand wählen und von vorn beginnen'], ['ex', 'Beispielversuche', exampleList().length + ' Versuche zum Ausprobieren'],
      ['open', 'Öffnen', 'Gespeicherte Versuche auf diesem Gerät'], ['save', 'Speichern unter …', S.name], ['share', 'Teilen', 'Link zum Weitergeben (Versuch steckt im Link)'], ['import', 'Aus Code oder Link laden', 'Geteilten Versuch einfügen'],
      ['fx', 'Effekte und Ton: ' + (fxOn() ? 'an' : 'aus'), 'Töne und Effekte ein- oder ausschalten'], ['png', 'Prüfstandbild speichern (PNG)', 'Aktuelle Ansicht als Bilddatei'], ['csv', 'Kennlinie als CSV', 'Punkte der ersten Kennlinie für Excel'], ['dice', 'Fehler-Würfel', 'Einen Fehler auswürfeln und suchen'],
      ['meters', 'Messgeräte: ' + (MVNAME[S.mview] || 'Zeiger'), 'Wechsel zwischen Zeigerinstrument, Zahlenanzeige und Frontplatte (Multimeter)'], ['bode', 'Bode-Vertiefung', 'Aufklappbar am Prüfstand Hoch- und Tiefpass (Taste B)'], ['calc2', 'Rechnen', 'Sinusgrößen, Blindwiderstände, Leistung, Kompensation, Resonanz, Grenzfrequenz und Übungen'], ['calc', 'Taschenrechner', 'Ohm, Farbcode, Leitung und mehr'],
      ['pool', 'Pool-Fragen zum Thema', 'Prüfungsfragen zu Wechselstrom und Schwingkreisen ansehen (nur lesen, im Prüfungs-Lab)'],
      ['abz', 'Abzeichen', 'Deine Sammlung und was noch fehlt'], ['kamp', 'Kampagne: Der Schwingkreis', 'Lernpfad mit Geschichte über alle Labs'], ['trainer', 'Trainer: Erste Schritte', 'Kurze Einführung zum Mitmachen'],
      ['neu', 'Neu in dieser Version', 'Was zuletzt dazukam und wo du es findest'], ['erg', 'Ergebnis senden', 'Code für den Ausbilder: meine bearbeiteten Aufgaben'], ['keys', 'Tastenkürzel', kk + ' und mehr (Taste ? drücken)'], ['help', 'Hilfe und Lernen', 'Grundlagen kurz erklärt'], ['start', 'Zur Startseite', '']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b>${r[2] ? `<small>${esc(r[2])}</small>` : ''}</div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); menuAct(r.dataset.m); });
    });
  }
  function menuAct(m) {
    switch (m) {
      case 'tasks': setTab('tasks'); break; case 'new': newExperiment(); break; case 'ex': openExamples(); break; case 'open': openList(); break; case 'save': doSave(); break;
      case 'share': shareNow(); break; case 'import': importSheet(); break; case 'fx': toggleFx(); break; case 'png': exportPng(); break; case 'csv': exportCsv(); break; case 'dice': diceRoll(); break;
      case 'meters': { const ord = MVIEWS.filter(v => v !== 'front' || frontOk()); S.mview = ord[(ord.indexOf(S.mview) + 1) % ord.length]; S.digital = S.mview === 'digital'; lsPut('wsl.mview', S.mview); lsPut('wsl.digital', S.digital ? '1' : '0'); buildMeters(); updateMeters(0, true); break; }
      case 'print': printNow(); break; case 'calc2': setTab('calc'); break; case 'calc': if (root.Rechner) root.Rechner.open(); break; case 'abz': if (root.Badges) root.Badges.open(); break;
      case 'kamp': if (root.Kampagne) root.Kampagne.open(); break; case 'trainer': if (root.Trainer) root.Trainer.start(); break; case 'neu': if (root.LabNeu) root.LabNeu(); break;
      case 'erg': if (root.Auswertung) root.Auswertung.openSend(); break; case 'keys': if (root.LochKeys) root.LochKeys.help(); else keysSheet(); break;
      case 'help': setTab('help'); break; case 'pool': location.href = 'pruefungslab.html?thema=wechselstrom'; break; case 'bode': toggleBode(); break; case 'start': location.href = 'index.html'; break;
    }
  }
  $('#bMenu').onclick = openMenu;

  /* ============================================================ Tastatur (liest die Tabelle KEYS) */
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
        lastUI = ts; readState(); syncCtl(); updateStat(); updateDiag(); updateSicht(); updateBode(); updateAmp(); renderSweepLive(); updateQLine();
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
  root.LabTrainerAPI = {
    lab: 'wsl', tab: () => S.tab, go: setTab, simMode: () => S.running, running: () => S.running, rig: () => S.rigId, speed: () => S.speed,
    load: loadExampleByName, examples: () => exampleList().map(e => e.name), task: () => (S.task ? S.task.id : null), saved: () => saves().length,
    seqRows: () => curRows().length, seqDone: () => !!S.seqRes, simTime: () => S.simT, faults: () => (lsGet('wsl.faults', []) || []).length, calcUsed: () => !!S.calcUsed,
    ampel: ampelNow, refSet: () => !!S.ref, fired: () => !!S.fired,
    reportDone: () => { const a = lsGet('wsl.report', []); return Array.isArray(a) && a.length > 0; }, designed: () => !!lsGet('wsl.design', null), bodeOpened: () => deepOpened() > 0
  };
  root.LabKeysAdapter = {
    lab: 'wsl', sheet: (title, build) => (title === 'Tastenkürzel' ? sheet(title, b => { b.innerHTML = keysHtml(); }) : sheet(title, build)), esc, toast,
    sim: () => setRun(!S.running), busy: () => true, has: () => false
  };
  /* kleine Testschnittstelle */
  root.WSL_UI = { frame, S, KEYS, TABS, ORDER, GRUPPEN, FIRELBL, RIGLIMITS, setTab, setRig, setCtl, applyCtl, setRun, resetRig, simAdvance, loadExample, loadExampleByName, startTask, checkTask, seqRunBg, seqLive, seqSteps, seqToRows, curRows, allCtl, coerce, csvText, parseCsv, shareObj, packShare, unpackShare, applyItem, saveItem, diceRoll, checkDice, DICE, exampleList, BUILTIN, renderSweep, extApi, collectAnswer, retryLoad, openMenu, rowNorm, seqDur, slPos, slVal, merken, toggleVN, toggleWipe, backToRef, setRef, qualityFeed, curQ, setQMode, drawOpts, drawRig, fitCanvas, updateAmp, updateDiag, fxAmpel, doFire, tableHtml, perf: () => ({ n: perf.n, mean: perf.n ? perf.sum / perf.n : 0, max: perf.max, recentMean: perf.recent.length ? perf.recent.reduce((a, b) => a + b, 0) / perf.recent.length : 0 }), fnum, ctlShow, ctlParse, refFromExample, bandOf, rigPng, printNow, openExamples, newExperiment, openList, importSheet, exportPng, toggleFx, hintTask, buildLimits, limIds, SICHTEN, toggleBode, drawBode, updateBode, deepGet, deepSet, resoTone, sichtOf, updateSicht, optNorm, updateSimBand };

  /* ============================================================ Start */
  function init() {
    buildTabs();
    const cur = lsGet('wsl.cur', null);
    if (cur && ORDER.includes(cur.rig)) {
      S.rows = cur.rows && typeof cur.rows === 'object' && !Array.isArray(cur.rows) ? cur.rows : {}; Object.keys(S.rows).forEach(k => { S.rows[k] = Array.isArray(S.rows[k]) ? rowNorm(S.rows[k].filter(r => r && (r.kind === 'fire' || typeof r.key === 'string'))) : []; });
      S.name = cur.name || 'Neuer Versuch'; S.id = cur.id || null;
      setRig(cur.rig); applyCtl(cur.ctl); S.bericht = cur.bericht && typeof cur.bericht === 'object' ? cur.bericht : null; S.dirty = !!cur.dirty; S.task = cur.task ? { id: cur.task } : null;
      if (cur.ref && typeof cur.ref === 'object' && cur.ref.ctl) { S.ref = clone(cur.ref); S.refMode = ['vorher', 'nachher', 'wischer'].includes(cur.refMode) ? cur.refMode : 'nachher'; buildRefRig(); buildBA(); updateAmp(true); }
    } else {
      setRig(ORDER[0]);
      if (!lsRaw('wsl.seen', '')) { lsPut('wsl.seen', '1'); setTimeout(() => toast('Willkommen! Starte mit ▶ unten oder bewege einen Regler: Die Animation läuft dann los.'), 900); }
    }
    renderSweep(); setTab(S.tab); requestAnimationFrame(frame);
    root.addEventListener('load', () => { if (EXTHOST[S.tab]) renderExt(S.tab); });
    /* Aufrufparameter von Startseite, Lernpfad, Kampagne und Lernheften: ?aufgabe=ws1, ?ex=Name, ?bsp, ?neu */
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
