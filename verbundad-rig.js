/* verbundad-rig.js - generischer Adapter für die acht Prüfstand-Labs (nts, reg, thm, els, enr, emv, wsl, ana) für die Verbundprojekte
 * (Paket P3, SPEC-VERBUND-NEUE-PROJEKTE Abschnitt 4, Entscheidung E3). Muster: verbundad-sen.js. Keine Änderung an Lab-Kernen und Lab-UIs.
 * Slot-Typ rig.state: { lab, rig, preset?, ctl, seq?, op?, opts?, T?, state, derived, meas?, verdeckt?, <Formularwerte> }
 *   lab      Kürzel des Labs (nts, reg, thm, els, enr, emv, wsl, ana)         rig   Prüfstand (station.open.rig, sonst der gerade offene)
 *   ctl      alle Steuerwerte des Prüfstands (UI.allCtl, sonst snapshot()/stateObj().ctl, sonst Prüfstand direkt)
 *   seq      Ablauf [{t, set|ramp|do|fire}] (Lab-Zeilen, bei nts "fehler" die Aktionen sicht/messe/tausche aus state().clicks)
 *   op       nur reg: Hand-Arbeitspunkt { y, z? } (steckt nicht in allCtl, UI.S.op)      opts  Optionen für die Prüfstandserzeugung (z. B. { params:{Pmax:2000} })
 *   T        Rechenzeit in Prozess-Sekunden (sonst Vorgabe je Prüfstand)
 *   state    Zustand nach CORE.runSeq (nur Zahlen, Wahrheitswerte, kurze Texte; ohne Fehlerklartext)      derived  Kennzahlen (Metriken, Ampel)      meas  Messwerte (Meter, Zahlen)
 *   verdeckt true, wenn Fehlerangaben im Slot versiegelt wurden (R1)
 * R1 (verdeckter Fehler): Der Adapter schreibt nie Fehler-ID oder -Name in Slot, Meldungen oder Texte. nts: ctl.fehler wird 'zufall' (mit ctl.seed), wenn der Würfel
 *   denselben Fehler ergibt, sonst 'verdeckt'; ana: ctl.fehler -> 'verdeckt'; els pruefplatz: m_*-Schalter -> false; state/derived ohne fehlerId/-Name/faults.
 *   Nur die Prüfseite darf faultOf(lab, quelle) rufen (liest den Fehler aus den Rohwerten per CORE.runSeq); die Anzeige kennt sie nicht.
 * API für Datendateien (Prüfseite): VerbundAdRig.run(lab, data, {T}) rechnet kopflos (CORE.runSeq) und liefert { ok, errors, final, samples, meas, derived, metrics,
 *   assess, actions, order, events, T }; VerbundAdRig.faultCtl(lab, fSeed, base) baut die Steuerwerte für station.open.ctl (Würfel mit fSeed); faultOf(lab, {ctl|fSeed}).
 * Reine Teile in adapter.pure (Node-tauglich, quelle/verbund/test_verbundad_rig.js). Werte mit (A) sind Annahmen (SPEC 8). */
(function (root) {
  'use strict';
  const KEYPFX = 'verbund.ad.', MARK = 'verdeckt';
  const LABS = {
    nts: { ui: 'NTS_UI', core: 'NTS_CORE', rigs: 'NTS_RIGS', name: 'Netzteil-Lab' }, reg: { ui: 'REG_UI', core: 'REG_CORE', rigs: 'REG_RIGS', name: 'Regelungs-Lab' },
    thm: { ui: 'THM_UI', core: 'THM_CORE', rigs: 'THM_RIGS', name: 'Thermik-Lab' }, els: { ui: 'ELS_UI', core: 'ELS_CORE', rigs: 'ELS_RIGS', name: 'Elektrosicherheits-Lab' },
    enr: { ui: 'ENR_UI', core: 'ENR_CORE', rigs: 'ENR_RIGS', name: 'Energie-Lab' }, emv: { ui: 'EMV_UI', core: 'EMV_CORE', rigs: 'EMV_RIGS', name: 'EMV-Lab' },
    wsl: { ui: 'WSL_UI', core: 'WSL_CORE', rigs: 'WSL_RIGS', name: 'Wechselstrom-Lab' }, ana: { ui: 'ANA_UI', core: 'ANA_CORE', rigs: 'ANA_RIGS', name: 'Analog-Lab' }
  };
  const DEFT = { nts: 10, els: 5, emv: 5, wsl: 5, ana: 5, enr: 3600, reg: 600, thm: 1800 };              // Rechenzeit in Prozess-Sekunden, wenn der Prüfstand keine eigene Spanne nennt
  const RESERVED = ['lab', 'rig', 'preset', 'ctl', 'seq', 'op', 'opts', 'T', 'state', 'derived', 'meas', 'verdeckt'];
  const FIRST = ['preset', 'device', 'geraet', 'netz', 'typ', 'art', 'topo', 'form', 'modell', 'seed'];         // Auswahlfelder zuerst, dann der Rest, Fehlerwahl dahinter
  /* Fehlerkonzept je Lab: drop = Zustandsschlüssel, die den Fehler nennen (R1) */
  const FAULT = { nts: { drop: ['fehler', 'fehlerId', 'fehlerName', 'sichtText', 'reihenfolge', 'netzText'] }, ana: { drop: ['fehler'] }, els: { drop: ['faults'] } };
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clone = o => JSON.parse(JSON.stringify(o));
  const rd = (x, n) => (fin(x) ? +x.toPrecision(n || 7) : x);
  const ls = { get(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } } };
  const coreOf = lab => (LABS[lab] ? root[LABS[lab].core] : null), rigsOf = lab => (LABS[lab] ? root[LABS[lab].rigs] : null), uiOf = lab => (LABS[lab] ? root[LABS[lab].ui] : null);
  const rigName = (lab, id) => { const R = rigsOf(lab), d = R && R.defs && R.defs[id]; return (d && d.name) || id; };
  const fseed = n => (fin(+n) ? ((Math.abs(Math.round(+n)) + 98) % 99) + 1 : 1);                                  // fSeed -> Würfelstartwert 1..99 (Rig-Bereich)

  /* ============================================================ reine Teile */
  /* Fehlertexte, die nie in Slot oder Anzeige gehören (Katalog des Labs, kleingeschrieben, ab 4 Zeichen) */
  const secCache = {}, norm = x => String(x).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  function secrets(lab) {
    if (secCache[lab]) return secCache[lab];
    const s = [], add = x => { if (typeof x === 'string' && x.length >= 4) { s.push(norm(x)); if (/[-_]/.test(x)) s.push(norm(x.replace(/[-_]/g, ' '))); } };
    try {
      if (lab === 'nts') ((coreOf('nts').fault || {}).catalog || []).forEach(f => { add(f.id); add(f.name); });
      else if (lab === 'els') ((coreOf('els').device || {}).faults || []).forEach(f => add(isObj(f) ? f.id : f));
      else if (lab === 'ana') { const R = rigsOf('ana'); R.list.forEach(r => { const c = (R.create(r.id).controls || []).find(q => q.key === 'fehler'); ((c && c.options) || []).forEach(o => { if (o.value !== 'keiner') { add(o.value); add(o.label); } }); }); }
    } catch (e) { return s; }
    if (s.length) secCache[lab] = s;
    return s;
  }
  const leaks = (lab, text) => { const t = norm(text); return secrets(lab).some(x => t.indexOf(x) >= 0); };
  /* Zustand kürzen: endliche Zahlen (9 Stellen), Wahrheitswerte, kurze Texte, Textlisten; ohne Fehlerklartext (R1) */
  function cleanState(st, lab) {
    const o = {}; if (!isObj(st)) return o;
    const drop = (FAULT[lab] && FAULT[lab].drop) || []; let n = 0;
    Object.keys(st).forEach(k => {
      if (n >= 150 || drop.indexOf(k) >= 0 || /^fehler(id|name)$/i.test(k)) return;
      const v = st[k];
      if (typeof v === 'number') { if (isFinite(v)) { o[k] = +v.toPrecision(9); n++; } }
      else if (typeof v === 'boolean') { o[k] = v; n++; }
      else if (typeof v === 'string') { if (v.length <= 40 && !leaks(lab, v)) { o[k] = v; n++; } }
      else if (Array.isArray(v) && v.every(x => typeof x === 'string' && x.length <= 60 && !leaks(lab, x))) { o[k] = v.slice(0, 40); n++; }
    });
    return o;
  }
  function flat(o, pre, out, depth) {
    if (!isObj(o)) return out;
    Object.keys(o).forEach(k => { const v = o[k], key = pre + k; if (Object.keys(out).length >= 120) return; if (fin(v)) out[key] = rd(v); else if (typeof v === 'boolean') out[key] = v; else if (depth > 0 && isObj(v)) flat(v, key + '_', out, depth - 1); });
    return out;
  }
  /* Messwerte (Meter der letzten Probe, nur Zahlen) und Kennzahlen (Metriken, Ampel); keine Texte aus assess (könnten Ursachen nennen) */
  function measOf(res) {
    const s = res && Array.isArray(res.samples) && res.samples.length ? res.samples[res.samples.length - 1] : null, m = {};
    if (s && isObj(s.meters)) Object.keys(s.meters).forEach(k => { if (fin(s.meters[k]) && Object.keys(m).length < 200) m[k] = rd(s.meters[k]); });
    return m;
  }
  function derivedOf(res, final) {
    const d = flat(res && res.metrics, '', {}, 2);
    const amp = (res && res.assess && res.assess.ampel) || (final && final.ampel); if (typeof amp === 'string' && amp.length <= 12) d.ampel = amp;
    if (res && res.assess && typeof res.assess.ok === 'boolean') d.assessOk = res.assess.ok;
    return d;
  }
  /* Ablauf bereinigen: nur Schritte mit endlicher Zeit, höchstens 500 */
  function cleanSeq(seq) { return (Array.isArray(seq) ? seq : []).filter(x => isObj(x) && fin(x.t)).slice(0, 500).map(x => clone(x)); }
  /* Reihenfolge der Steuerwerte beim Setzen: Auswahlfelder zuerst; Platzhalter 'verdeckt' (versiegelter Fehler) wird nie gesetzt */
  function ordered(ctl) {
    const o = {}; if (!isObj(ctl)) return o;
    FIRST.forEach(k => { if (ctl[k] !== undefined && ctl[k] !== MARK) o[k] = ctl[k]; });
    Object.keys(ctl).forEach(k => { if (o[k] === undefined && ctl[k] !== MARK) o[k] = ctl[k]; });
    return o;
  }
  /* Fehler im Steuerwert-Objekt versiegeln (R1). Liefert { ctl, masked } */
  function maskCtl(lab, ctl) {
    const out = isObj(ctl) ? clone(ctl) : {}; let masked = false;
    if (lab === 'nts' && out.fehler && out.fehler !== 'zufall' && out.fehler !== MARK) {
      let same = false;
      try { const m = coreOf('nts').fault.make('zufall', { netz: out.netz || 'linear', seed: fin(out.seed) ? out.seed : 1 }); same = !!m && m.ok !== false && m.fehler === out.fehler; } catch (e) { same = false; }
      out.fehler = same ? 'zufall' : MARK; masked = true;
    } else if (lab === 'ana' && out.fehler && out.fehler !== 'keiner' && out.fehler !== MARK) { out.fehler = MARK; masked = true; }
    else if (lab === 'els') Object.keys(out).forEach(k => { if (/^m_/.test(k) && out[k] === true) { out[k] = false; masked = true; } });
    return { ctl: out, masked };
  }
  /* Steuerwerte für station.open.ctl: verdeckter Fehler aus fSeed (Würfel). ana hat keinen Würfel: leeres Objekt (Fehler dann ausdrücklich in open.ctl.fehler) */
  function faultCtl(lab, fSeed, base) {
    base = isObj(base) ? base : {};
    if (lab === 'nts') return { netz: base.netz || 'linear', seed: fseed(fSeed), fehler: 'zufall' };
    if (lab === 'els') return { geraet: base.geraet || 'netzteil-labor', zufall: true, seed: fseed(fSeed), anzahl: fin(base.anzahl) ? base.anzahl : 1 };
    return {};
  }
  /* Rohwerte -> Fehler (nur für die Prüfseite): { lab, rig, id, name, ids } oder null. src = Slotdaten oder { rig?, ctl?, opts?, fSeed? } */
  function faultOf(lab, src) {
    if (isObj(lab)) { src = lab.data || lab; lab = lab.lab || (lab.data && lab.data.lab); }
    const C = coreOf(lab), R = rigsOf(lab); if (!C || !C.runSeq || !R || !isObj(src) || !FAULT[lab]) return null;
    let ctl = isObj(src.ctl) ? ordered(src.ctl) : {};
    if (fin(+src.fSeed) && src.fSeed !== null && src.fSeed !== '') ctl = Object.assign(ctl, faultCtl(lab, src.fSeed, Object.assign({}, ctl, src)));
    const rig = typeof src.rig === 'string' && src.rig ? src.rig : (lab === 'nts' ? 'fehler' : lab === 'els' ? 'pruefplatz' : '');
    if (!R.defs || !R.defs[rig]) return null;
    let r; try { r = C.runSeq(rig, [], 1, { seed: 1, controls: ordered(ctl), rigOpts: isObj(src.opts) ? clone(src.opts) : undefined }); } catch (e) { return null; }
    const f = r && r.final; if (!f) return null;
    if (lab === 'nts') return f.fehlerId ? { lab, rig, id: f.fehlerId, name: f.fehlerName || '', ids: [f.fehlerId] } : null;
    if (lab === 'els') return Array.isArray(f.faults) && f.faults.length ? { lab, rig, id: f.faults[0], name: '', ids: f.faults.slice() } : null;
    if (lab === 'ana') {
      if (!f.fehler || f.fehler === 'keiner') return null;
      const c = (R.create(rig).controls || []).find(q => q.key === 'fehler'), o = c && (c.options || []).find(q => q.value === f.fehler);
      return { lab, rig, id: f.fehler, name: (o && o.label) || '', ids: [f.fehler] };
    }
    return null;
  }

  /* Vorgaben je Prüfstand: Steuerwerte im Neuzustand und Rechenzeit (Spanne des Prüfstands, sonst Vorgabe des Labs) */
  const defCache = {};
  function defaultsOf(lab, rigId) {
    const key = lab + ':' + rigId; if (defCache[key]) return defCache[key];
    const R = rigsOf(lab); if (!R || !R.create || !R.defs || !R.defs[rigId]) return { ctl: {}, T: DEFT[lab] || 10 };
    let rig; try { rig = R.create(rigId, { seed: 1 }); } catch (e) { return { ctl: {}, T: DEFT[lab] || 10 }; }
    const ctl = {}; (rig.controls || []).forEach(c => { try { const v = rig.getControl(c.key); if (v !== undefined) ctl[c.key] = v; } catch (e) { /* weiter */ } });
    return (defCache[key] = { ctl, T: fin(rig.spanS) && rig.spanS > 0 ? rig.spanS : (DEFT[lab] || 10) });
  }
  function autoT(lab, rigId, seq) {
    seq = cleanSeq(seq); const base = defaultsOf(lab, rigId).T, last = seq.reduce((a, s) => Math.max(a, s.t), 0);
    return seq.length ? Math.max(base, last + (DEFT[lab] <= 10 ? 2 : base * 0.1)) : base;
  }
  /* Kopfloser Rechenlauf (CORE.runSeq) aus Slotdaten; ohne Wirkung auf irgendeinen Prüfstand im Bild. Rohdaten, nur für Prüfung und Aufbau des Slots */
  function run(lab, d, o) {
    o = o || {}; const out = { ok: false, errors: [], lab };
    const C = coreOf(lab), R = rigsOf(lab);
    if (!LABS[lab]) { out.errors.push('Unbekanntes Lab.'); return out; }
    if (!C || typeof C.runSeq !== 'function' || !R || !R.defs) { out.errors.push('Der Rechenkern des Labs ist nicht geladen.'); return out; }
    if (!isObj(d) || typeof d.rig !== 'string' || !R.defs[d.rig]) { out.errors.push('Den Prüfstand gibt es in diesem Lab nicht.'); return out; }
    const seq = cleanSeq(d.seq), ctl = ordered(d.ctl), opts = { seed: 1, controls: ctl };
    const T = Math.min(86400, Math.max(0, fin(o.T) ? o.T : fin(d.T) ? d.T : autoT(lab, d.rig, seq)));
    if (isObj(d.opts)) opts.rigOpts = clone(d.opts);
    if (lab === 'reg' && isObj(d.op) && fin(d.op.y) && ctl.mode !== 'auto') opts.op = fin(d.op.z) ? { y: d.op.y, z: d.op.z } : { y: d.op.y };
    let r; try { r = C.runSeq(d.rig, seq, T, opts); } catch (e) { out.errors.push('Der Rechenlauf ist abgebrochen.'); return out; }
    if (!r || !r.final) { out.errors = (r && r.errors && r.errors.length ? r.errors.slice(0, 5).map(String) : ['Der Rechenlauf lieferte keinen Zustand.']); return out; }
    return { ok: r.ok !== false && !(r.errors || []).length, errors: (r.errors || []).map(String), rejected: r.rejected || [], lab, rig: d.rig, T, final: r.final, samples: r.samples || [], events: r.events || [], faults: r.faults || [],
      metrics: r.metrics || {}, assess: r.assess || null, actions: r.actions || [], order: r.order || null, meas: measOf(r), derived: derivedOf(r, r.final) };
  }
  /* Daten der Hülle aus dem Gemerkten (rec = { ctl, seq?, op?, opts?, preset? }); form = Formularwerte; mask = Fehler versiegeln (Vorgabe ja) */
  function buildData(lab, rigId, rec, o) {
    o = o || {}; if (!LABS[lab] || !rigId || !rec || !isObj(rec.ctl)) return null;
    const mk = o.mask === false ? { ctl: clone(rec.ctl), masked: false } : maskCtl(lab, rec.ctl);
    let ctl = mk.ctl; const keys = Object.keys(ctl); if (keys.length > 300) { ctl = {}; keys.slice(0, 300).forEach(k => { ctl[k] = mk.ctl[k]; }); }
    const src = { rig: rigId, ctl: rec.ctl, seq: rec.seq, op: rec.op, opts: rec.opts, T: o.T };
    const res = o.sim || run(lab, src, { T: o.T }), data = { lab, rig: String(rigId).slice(0, 64), ctl };
    if (typeof rec.preset === 'string' && rec.preset && rec.preset.length <= 200) data.preset = rec.preset;
    const seq = cleanSeq(rec.seq); if (seq.length) data.seq = seq;
    if (lab === 'reg' && isObj(rec.op) && fin(rec.op.y)) data.op = fin(rec.op.z) ? { y: rd(rec.op.y), z: rd(rec.op.z) } : { y: rd(rec.op.y) };
    if (isObj(rec.opts) && Object.keys(rec.opts).length) data.opts = clone(rec.opts);
    if (res.ok || res.final) data.T = rd(res.T);
    if (mk.masked) data.verdeckt = true;
    const put = x => { if (isObj(x)) Object.keys(x).forEach(k => { if (RESERVED.indexOf(k) < 0 && x[k] !== null && x[k] !== undefined && x[k] !== '') data[k] = x[k]; }); };
    put(o.extra); put(o.form);
    data.state = res.final ? cleanState(res.final, lab) : {}; data.derived = res.final ? res.derived : {};
    if (res.final && Object.keys(res.meas).length) data.meas = res.meas;
    return data;
  }
  /* Gedächtnis: { s: seed, rigs: { <rig>: { ctl, seq?, op?, opts?, preset? } }, extra } */
  const memNew = seed => ({ s: seed, rigs: {}, extra: {} });
  function memLoad(raw, seed) {
    try { const o = JSON.parse(raw); if (isObj(o) && o.s === seed && isObj(o.rigs)) return Object.assign(memNew(seed), { rigs: o.rigs, extra: isObj(o.extra) ? o.extra : {} }); } catch (e) { /* leer */ }
    return memNew(seed);
  }
  function memSet(mem, rigId, rec) { if (isObj(mem) && isObj(mem.rigs) && rigId && isObj(rec) && isObj(rec.ctl)) mem.rigs[rigId] = clone(rec); return mem; }
  /* Startplan: Prüfstand mit Werten (Musterlösung > Starthilfe Stufe 1 > station.open); open.fSeed baut die verdeckte Fehlerwahl */
  function startPlan(lab, station, flags) {
    flags = flags || {}; const R = rigsOf(lab);
    const open = isObj(station && station.open) ? station.open : {};
    const asst = flags.assist && isObj(station && station.assist) && isObj(station.assist[1]) ? station.assist[1] : null;
    const sol = flags.solution && isObj(flags.solution.data) ? flags.solution.data : null;
    const src = sol || asst || {};
    const rig = String(src.rig || open.rig || (R && R.list && R.list[0] && R.list[0].id) || ''), extra = {};
    const ctl = Object.assign({}, fin(+open.fSeed) && open.fSeed !== null && open.fSeed !== '' ? faultCtl(lab, open.fSeed, isObj(open.ctl) ? open.ctl : {}) : {}, isObj(open.ctl) ? open.ctl : {});
    if (isObj(src.ctl)) Object.keys(src.ctl).forEach(k => { if (src.ctl[k] !== MARK) ctl[k] = src.ctl[k]; });
    const pick = k => (isObj(src[k]) || Array.isArray(src[k]) ? src[k] : (isObj(open[k]) || Array.isArray(open[k]) ? open[k] : null));
    if (sol) Object.keys(sol).forEach(k => { if (RESERVED.indexOf(k) < 0 && ['number', 'string', 'boolean'].indexOf(typeof sol[k]) >= 0) extra[k] = sol[k]; });
    return { rig, ctl, seq: cleanSeq(pick('seq')), op: isObj(pick('op')) ? pick('op') : null, opts: isObj(pick('opts')) ? pick('opts') : null, extra, solution: !!sol, assist: !!asst };
  }
  const stashEntry = (snap, now, id, extra) => (snap = snap || {}, Object.assign({ id, name: 'Vor Verbund: ' + String((snap && snap.name) || 'Versuch'), t: now, rig: snap.rig, ctl: snap.ctl, rows: snap.rows || [], dur: snap.dur === undefined ? null : snap.dur }, extra || {}));
  const pure = { cleanState, cleanSeq, ordered, maskCtl, faultCtl, measOf, derivedOf, defaultsOf, autoT, buildData, memNew, memLoad, memSet, startPlan, stashEntry, secrets, leaks, fseed, flat, MARK, RESERVED };

  /* ============================================================ Zugriff auf das Lab (je Lab ein Adapter) */
  function adapterFor(lab) {
    const L = LABS[lab]; if (!L) return null;
    const UI = () => uiOf(lab);
    let cur = null, timer = null;   // cur = { pid, sid, key, mem, inst, last }
    function target() {
      const V = root.Verbund; let a = null;
      try { a = V && V.active && V.active(); } catch (e) { a = null; }
      if (a && a.pid && a.sid) return { pid: a.pid, sid: a.sid };
      try { const m = String(new URLSearchParams(root.location.search).get('verbund') || '').match(/^([a-z][a-z0-9]*):(v[a-z]\w*)$/); if (m) return { pid: m[1], sid: m[2] }; } catch (e) { /* kein Ziel */ }
      return null;
    }
    function seedOf(pid) { try { const s = root.Verbund.state(pid); return s && fin(s.seed) ? s.seed : 0; } catch (e) { return 0; } }
    function bind() {
      const t = target(); if (!t) return null;
      const key = KEYPFX + lab + '.' + t.pid + '.' + t.sid, seed = seedOf(t.pid);
      if (!cur || cur.key !== key || cur.mem.s !== seed) cur = { pid: t.pid, sid: t.sid, key, mem: memLoad(ls.get(key), seed) };
      return cur;
    }
    function save() { if (cur) { const s = JSON.stringify(cur.mem); if (s !== cur.last) { cur.last = s; ls.set(cur.key, s); } } }
    /* Steuerwerte des offenen Prüfstands: allCtl, sonst stateObj()/snapshot() (Objekt oder JSON-Text), sonst direkt am Prüfstand (nts und enr exportieren kein allCtl) */
    function getCtl(U) {
      const tryOf = f => { try { const v = f(); return isObj(v) && Object.keys(v).length ? clone(v) : null; } catch (e) { return null; } };
      const jo = x => (typeof x === 'string' ? JSON.parse(x) : x);
      const viaSnap = f => tryOf(() => { const s = jo(f()); return s && s.ctl; });
      let c = typeof U.allCtl === 'function' ? tryOf(() => U.allCtl()) : null;
      if (!c && typeof U.stateObj === 'function') c = viaSnap(() => U.stateObj());
      if (!c && typeof U.snapshot === 'function') c = viaSnap(() => U.snapshot());
      if (!c) c = tryOf(() => { const o = {}; U.S.rig.controls.forEach(q => { const v = U.S.rig.getControl(q.key); if (v !== undefined) o[q.key] = v; }); return o; });
      return c || {};
    }
    function getSeq(U) {
      try {
        if (typeof U.curRows === 'function' && typeof U.seqSteps === 'function') { const s = cleanSeq(U.seqSteps(U.curRows())); if (s.length) return s; }
        else if (typeof U.rowsToSeq === 'function' && U.S && Array.isArray(U.S.rows)) { const s = cleanSeq(U.rowsToSeq(U.S.rows)); if (s.length) return s; }
      } catch (e) { /* kein Ablauf */ }
      try { if (lab === 'nts' && U.S.rigId === 'fehler') { const cl = U.S.rig.state().clicks; if (Array.isArray(cl)) return cl.slice(0, 200).map((c, i) => ({ t: i + 1, do: String(c) })); } } catch (e) { /* keine Aktionen */ }
      return [];
    }
    function record(U, prev) {
      const rec = { ctl: getCtl(U) }; if (!Object.keys(rec.ctl).length) return null;
      if (typeof U.S.preset === 'string' && U.S.preset) rec.preset = U.S.preset;
      const seq = getSeq(U); if (seq.length) rec.seq = seq; else if (prev && prev.ps && Array.isArray(prev.seq)) { rec.seq = prev.seq; rec.ps = 1; }   // Ablauf aus Musterlösung, den das Lab nicht als Zeilen zeigt
      if (lab === 'reg' && isObj(U.S.op) && fin(U.S.op.y)) rec.op = clone(U.S.op);
      if (prev && isObj(prev.opts)) rec.opts = prev.opts;
      return rec;
    }
    /* Prüfstand steht noch im Neuzustand (frisch erzeugt, nichts verstellt)? */
    function isFresh(rigId, ctl) {
      const d = defaultsOf(lab, rigId).ctl, keys = Object.keys(d); if (!keys.length) return false;
      return keys.every(k => ctl[k] === undefined || JSON.stringify(ctl[k]) === JSON.stringify(d[k]));
    }
    function loadRec(U, rec) {
      U.applyCtl(ordered(rec.ctl));
      if (lab === 'reg' && isObj(rec.op) && fin(rec.op.y) && rec.ctl.mode !== 'auto' && U.S.rig && typeof U.S.rig.setOperatingPoint === 'function') {
        try { U.S.rig.setOperatingPoint(rec.op.y); if (fin(rec.op.z)) U.applyCtl({ z: rec.op.z }); U.S.op = clone(rec.op); } catch (e) { /* Arbeitspunkt nicht möglich */ }
      }
    }
    function capture() {          // Steuerwerte des offenen Prüfstands ins Gedächtnis
      const U = UI(); if (!U || !U.S || !U.S.rig || !U.S.rigId || U.S.attrappe) return;
      if (!bind()) return;
      const id = U.S.rigId, prev = cur.mem.rigs[id];
      if (cur.inst !== U.S.rig) {   // neuer Prüfstand im Lab (Wechsel, Neuladen): steht er im Neuzustand, die gemerkten Werte einstellen
        cur.inst = U.S.rig;
        if (prev && isFresh(id, getCtl(U))) loadRec(U, prev);
      }
      const rec = record(U, prev); if (rec) { memSet(cur.mem, id, rec); save(); }
    }
    function startPoll() { if (timer || typeof root.setInterval !== 'function') return; timer = root.setInterval(capture, 300); if (timer && timer.unref) timer.unref(); }
    function stop() { if (timer && typeof root.clearInterval === 'function') root.clearInterval(timer); timer = null; cur = null; }
    /* laufende Arbeit sichern wie das Lab selbst: Versuchsliste <lab>.saves */
    function stash() {
      const U = UI(), S = U && U.S; if (!S || !S.rig || !S.dirty || S.readonly || S.task) return false;
      const PK = lab + '.saves'; let a = []; try { a = JSON.parse(ls.get(PK) || '[]'); } catch (e) { a = []; } if (!Array.isArray(a)) a = [];
      let rows = []; try { rows = typeof U.curRows === 'function' ? clone(U.curRows()) : []; } catch (e) { rows = []; }
      let dur = null; try { dur = typeof U.seqDur === 'function' ? U.seqDur() : null; } catch (e) { dur = null; }
      const extra = lab === 'reg' ? { op: S.op ? clone(S.op) : null, strecke: S.strecke ? clone(S.strecke) : null } : {};
      a.push(stashEntry({ name: S.name, rig: S.rigId, ctl: getCtl(U), rows, dur }, Date.now(), 'v' + Date.now().toString(36), extra));
      ls.set(PK, JSON.stringify(a.slice(-100))); S.dirty = false; S.id = null; return true;
    }
    function notReady() { return 'Das ' + L.name + ' ist noch nicht bereit.'; }

    const adapter = {
      lab, pure, stop, _capture: capture, _mem: () => (cur ? cur.mem : null),
      ready() { const U = UI(); const ok = !!(U && U.S && U.S.rig && coreOf(lab) && rigsOf(lab)); if (ok) { startPoll(); bind(); } return ok; },
      apply(station, ctx) {
        const U = UI(); if (!U || !U.S) return { ok: false, msg: notReady() };
        ctx = ctx || {}; const c = bind(); if (!c) return { ok: false, msg: 'Keine aktive Verbundstation.' };
        const plan = startPlan(lab, station, { assist: ctx.assist, solution: ctx.solution });
        const R = rigsOf(lab); if (!R || !R.defs || !R.defs[plan.rig]) return { ok: false, msg: 'Der Prüfstand „' + plan.rig + '“ gibt es in diesem Lab nicht.' };
        const stashed = stash();
        try { if (U.S.running && typeof U.setRun === 'function') U.setRun(false); } catch (e) { /* läuft weiter */ }
        c.mem = memNew(c.mem.s); c.mem.extra = plan.extra;
        U.setRig(plan.rig, plan.opts ? { opts: clone(plan.opts) } : undefined);
        const rec = { ctl: plan.ctl }; if (plan.seq.length) rec.seq = plan.seq; if (plan.op) rec.op = plan.op; if (plan.opts) rec.opts = plan.opts;
        loadRec(U, rec); c.inst = U.S.rig;
        try { if (plan.seq.length && typeof U.seqToRows === 'function' && U.S.rows && !Array.isArray(U.S.rows)) U.S.rows[plan.rig] = U.seqToRows(plan.seq); } catch (e) { /* Ablaufzeilen bleiben leer */ }
        try { if (lab === 'ana' && plan.ctl.fehler && plan.ctl.fehler !== 'keiner' && U.S.rig.setLock && U.S.rig.setHidden) { U.S.rig.setLock(['fehler']); U.S.rig.setHidden(['fehler']); } } catch (e) { /* Fehlerwahl bleibt sichtbar */ }
        const now = record(U, rec) || rec; if (plan.seq.length && !(now.seq && now.seq.length)) { now.seq = plan.seq; now.ps = 1; }
        memSet(c.mem, plan.rig, now); save();
        if (U.setTab) U.setTab('rig');
        U.S.name = 'Verbund: ' + String((station && station.title) || 'Station'); U.S.dirty = false; U.S.task = null;
        return { ok: true, msg: (plan.solution ? 'Musterlösung' : 'Startwerte') + ' im Prüfstand „' + rigName(lab, plan.rig) + '“ geladen' + (stashed ? ', deine Arbeit ist gesichert.' : '.') };
      },
      collect(station, ctx) {
        const U = UI(); if (!U || !U.S || !U.S.rig) return { error: notReady() };
        const c = bind(); if (!c) return { error: 'Keine aktive Verbundstation.' };
        capture();
        const open = isObj(station && station.open) ? station.open : {}, primary = open.rig || U.S.rigId;
        const rec = c.mem.rigs[primary];
        if (!isObj(rec)) return { error: 'Stelle zuerst im Prüfstand „' + rigName(lab, primary) + '“ die Werte ein, die die Aufgabe verlangt.' };
        const data = buildData(lab, primary, rec, { mask: open.mask !== false, T: fin(open.T) ? open.T : undefined, extra: c.mem.extra, form: ctx && ctx.formData });
        if (data && station && typeof station.fromForm === 'function' && ctx && isObj(ctx.formData)) {      // Stationen mit verschachtelten Formularwerten
          try { const x = station.fromForm(ctx.formData, ctx); if (isObj(x)) Object.keys(x).forEach(k => { if (RESERVED.indexOf(k) < 0 && x[k] !== null && x[k] !== undefined) data[k] = x[k]; }); } catch (e) { /* Formular unbrauchbar: flache Werte bleiben */ }
        }
        return data ? { type: 'rig.state', data } : { error: 'Der Prüfstand „' + rigName(lab, primary) + '“ ist nicht eingestellt.' };
      },
      live(station, ctx) {
        const r = this.collect(station, ctx); if (r.error) return [{ ok: false, text: r.error }];
        const d = r.data, rows = [], z = x => String(rd(x, 5)).replace('.', ',');
        const amp = d.derived.ampel; if (amp) rows.push({ ok: amp !== 'rot', text: 'Ampel des Prüfstands: ' + amp + '.' });
        if (!FAULT[lab] && Array.isArray(d.state.faults) && d.state.faults.length) rows.push({ ok: false, text: 'Der Prüfstand meldet: ' + d.state.faults.slice(0, 4).join(', ') + '.' });
        const ks = Object.keys(d.meas || {}).slice(0, 4); if (ks.length) rows.push({ ok: true, text: 'Messwerte im Rechenlauf: ' + ks.map(k => k + ' = ' + z(d.meas[k])).join(', ') + '.' });
        if (!rows.length) rows.push({ ok: true, text: 'Rechenlauf ohne Auffälligkeit.' });
        return rows;
      }
    };
    return adapter;
  }

  const adapters = {}; Object.keys(LABS).forEach(l => { adapters[l] = adapterFor(l); });
  const RIG = { adapterFor, adapters, pure, run, faultOf, faultCtl, LABS, lab: 'rig' };
  const V = root.Verbund;
  Object.keys(adapters).forEach(l => {
    if (V && typeof V.registerAdapter === 'function') V.registerAdapter(l, adapters[l]);
    else { root.VERBUND_ADAPTERS = root.VERBUND_ADAPTERS || {}; root.VERBUND_ADAPTERS[l] = adapters[l]; }
  });
  root.VerbundAdRig = RIG;
  if (typeof module !== 'undefined' && module.exports) module.exports = RIG;
})(typeof window !== 'undefined' ? window : globalThis);
