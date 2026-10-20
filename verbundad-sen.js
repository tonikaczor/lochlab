/* verbundad-sen.js - Adapter Sensorik-Lab für die Verbundprojekte (Paket A5, SPEC 5.2 / 5.5)
 * Slot-Typ sen.chain: { rig, preset, ctl, ctl2?, sens, rigs, <Formularwerte>, state, state2?, derived, derived2? }
 *   rig     Prüfstand der Station (station.open.rig, sonst der gerade offene), ctl = Steuerwerte dieses Prüfstands (alle Schlüssel)
 *   Prüfstand "licht" mit zwei Sensoren (Optik und Näherungsschalter): ctl = optischer, ctl2 = Näherungsschalter (SPEC 9.1 vg6). Gibt es nur
 *           eine Sorte, steht sie in ctl. Mit station.open.sensor (Name, z. B. 'induktiv') wird dieser Sensor zu ctl, der andere zu ctl2.
 *   sens    zuletzt gesehene Steuerwerte je Sensorname des Prüfstands { reflex: {…}, induktiv: {…} }
 *   rigs    zuletzt gesehene Steuerwerte aller besuchten Prüfstände { licht: {…}, adu: {…} } (Messkette über mehrere Prüfstände)
 *   state   Zustand nach einem Rechenlauf im Kern (SEN_CORE.runSeq, ohne Nebenwirkung auf den Prüfstand im Bild); bei "licht" mit
 *           tResp (ms), fMax (Hz), tSens, sn, mountMin, mountMax, mountOk, mountReserve, iSupplyMa (senrig-opt.js, Annahmen (A) dort)
 *   derived tRespMs, tSensMs, fMax, mountOk, mountReserve, iSupplyMa (nur "licht"), rBurdenMax (normsignal); derived2/state2 für ctl2
 * Das Lab zeigt immer nur EINEN Prüfstand und EINEN Sensor. Der Adapter merkt sich deshalb die zuletzt gesehenen Steuerwerte
 * (localStorage verbund.ad.sen.<pid>.<sid>, an den Seed gebunden, 0,3-s-Abgleich). Formularwerte (station.form) kommen oben in die Daten.
 * Reine Teile in adapter.pure (Node-tauglich, quelle/verbund/test_verbundad_sen.js). Werte mit (A) sind Annahmen (SPEC 8). */
(function (root) {
  'use strict';
  const LAB = 'sen', SAVES = 'sen.saves', KEYPFX = 'verbund.ad.sen.';
  const UI = () => root.SEN_UI, CORE = () => root.SEN_CORE;
  const OPT = ['ldr', 'fotodiode', 'fototransistor', 'gabel', 'reflex'], PROX = ['induktiv', 'kapazitiv', 'ultraschall'];
  const RESERVED = ['rig', 'preset', 'ctl', 'ctl2', 'gear', 'state', 'state2', 'derived', 'derived2', 'rigs', 'sens'];
  const DERIVE = { licht: [['tRespMs', 'tResp'], ['tSensMs', 'tSens'], ['fMax', 'fMax'], ['mountOk', 'mountOk'], ['mountReserve', 'mountReserve'], ['iSupplyMa', 'iSupplyMa']], normsignal: [['rBurdenMax', 'burdenMax']] };
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clone = o => JSON.parse(JSON.stringify(o));
  const rd = x => (fin(x) ? +x.toPrecision(7) : x);
  const ls = { get(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } } };

  /* ============================================================ reine Teile */
  /* Zustand kürzen: nur endliche Zahlen (9 Stellen), Wahrheitswerte, kurze Texte, Textlisten */
  function cleanState(st) {
    const o = {}; if (!isObj(st)) return o;
    Object.keys(st).forEach(k => {
      const v = st[k];
      if (typeof v === 'number') { if (isFinite(v)) o[k] = +v.toPrecision(9); }
      else if (typeof v === 'boolean') o[k] = v;
      else if (typeof v === 'string') { if (v.length <= 40) o[k] = v; }
      else if (Array.isArray(v) && v.every(x => typeof x === 'string')) o[k] = v.slice(0, 12);
    });
    return o;
  }
  /* Gedächtnis: { s: seed, rigs: { <rig>: ctl }, sens: { <rig>: { <sensor>: ctl } }, ord: { <rig>: [sensoren, zuletzt gesehener zuletzt] }, pend: { '<rig>:<sensor>': ctl, noch nicht im Lab gezeigt }, extra } */
  const memNew = seed => ({ s: seed, rigs: {}, sens: {}, ord: {}, pend: {}, extra: {} });
  function memLoad(raw, seed) {
    try { const o = JSON.parse(raw); if (isObj(o) && o.s === seed && isObj(o.rigs)) return Object.assign(memNew(seed), { rigs: o.rigs, sens: isObj(o.sens) ? o.sens : {}, ord: isObj(o.ord) ? o.ord : {}, pend: isObj(o.pend) ? o.pend : {}, extra: isObj(o.extra) ? o.extra : {} }); } catch (e) { /* leer */ }
    return memNew(seed);
  }
  /* untouched = der Prüfstand zeigt noch den Vorgabesensor mit Vorgabewerten (nur angezeigt, nichts eingestellt): er zählt nicht als gewählter Sensor */
  function memSet(mem, rigId, ctl, untouched) {
    if (!rigId || !isObj(ctl)) return mem;
    mem.rigs[rigId] = clone(ctl);
    if (typeof ctl.sensor === 'string' && ctl.sensor && !(untouched && !(isObj(mem.sens[rigId]) && mem.sens[rigId][ctl.sensor]))) {
      (mem.sens[rigId] = mem.sens[rigId] || {})[ctl.sensor] = clone(ctl);
      const o = (mem.ord[rigId] = (mem.ord[rigId] || []).filter(n => n !== ctl.sensor)); o.push(ctl.sensor);
    }
    return mem;
  }
  /* ctl/ctl2 des Prüfstands "licht": Optik und Näherungsschalter (jeweils der zuletzt gesehene); open.sensor bestimmt den Hauptsensor */
  function channels(mem, rigId, open) {
    const live = mem.rigs[rigId], sens = mem.sens[rigId] || {}, ord = mem.ord[rigId] || [];
    if (rigId !== 'licht' || !ord.length) return { ctl: live, ctl2: null };
    const last = list => ord.slice().reverse().find(n => list.indexOf(n) >= 0);
    const o = last(OPT), p = last(PROX), want = isObj(open) && typeof open.sensor === 'string' ? open.sensor : '';
    let a = o, b = p;
    if (want && sens[want]) { const cls = OPT.indexOf(want) >= 0 ? OPT : PROX; a = want; b = last(cls === OPT ? PROX : OPT); }
    else if (!a) { a = b; b = null; }
    return { ctl: clone(sens[a] || live), ctl2: b && sens[b] ? clone(sens[b]) : null, names: [a, b] };
  }
  /* Startplan: Prüfstand mit Werten (Musterlösung > Starthilfe Stufe 1 > station.open); ctl2 wird nur gemerkt (das Lab zeigt einen Sensor) */
  function startPlan(station, flags) {
    flags = flags || {};
    const open = isObj(station && station.open) ? station.open : {};
    const asst = flags.assist && isObj(station && station.assist) && isObj(station.assist[1]) ? station.assist[1] : null;
    const sol = flags.solution && isObj(flags.solution.data) ? flags.solution.data : null;
    const src = sol || asst || {};
    const rig = String(src.rig || open.rig || 'licht'), extra = {};
    const ctl = Object.assign({}, isObj(open.ctl) ? open.ctl : {}, isObj(src.ctl) ? src.ctl : {});
    const ctl2 = isObj(src.ctl2) ? Object.assign({}, src.ctl2) : null;
    if (sol) Object.keys(sol).forEach(k => { if (RESERVED.indexOf(k) < 0 && ['number', 'string', 'boolean'].indexOf(typeof sol[k]) >= 0) extra[k] = sol[k]; });
    return { rig, ctl, ctl2, extra, solution: !!sol, assist: !!asst };
  }
  /* Prüfstand steht noch auf den Vorgabewerten (frisch erzeugt, nichts verstellt)? */
  function isFresh(U, rigId, ctl) {
    const d = root.SEN_RIGS && root.SEN_RIGS.defs && root.SEN_RIGS.defs[rigId]; if (!d || !Array.isArray(d.controls)) return false;
    const now = ctl || U.allCtl(); return d.controls.every(c => now[c.key] === undefined || JSON.stringify(now[c.key]) === JSON.stringify(c.value));
  }
  /* Reihenfolge beim Setzen: Sensor zuerst (er setzt Abstand und Zustand zurück), die Betriebsart zuletzt */
  function ordered(ctl) {
    const first = ['sensor', 'type', 'stages'], o = {};
    first.forEach(k => { if (ctl && ctl[k] !== undefined) o[k] = ctl[k]; });
    Object.keys(ctl || {}).forEach(k => { if (o[k] === undefined && k !== 'mode') o[k] = ctl[k]; });
    if (ctl && ctl.mode !== undefined) o.mode = ctl.mode;
    return o;
  }
  /* Eintrag für die Versuchsliste des Labs (wie saveItem in senui.js) */
  function stashEntry(snap, S, now, id) {
    return { id, name: 'Vor Verbund: ' + String((snap && snap.name) || 'Versuch'), t: now, rig: snap.rig, ctl: snap.ctl, rows: snap.rows || [], dur: (S && S.seqDur && S.seqDur[snap.rig]) || null };
  }
  function deriveOf(rigId, state) {
    const d = {}; (DERIVE[rigId] || []).forEach(p => { if (state && state[p[1]] !== undefined) d[p[0]] = typeof state[p[1]] === 'number' ? rd(state[p[1]]) : state[p[1]]; });
    return d;
  }
  /* Daten der Hülle (null, wenn der Prüfstand der Station nie eingestellt wurde); sim = { state, state2? } aus simulate */
  function buildData(mem, primary, o) {
    o = o || {};
    if (!mem || !isObj(mem.rigs[primary])) return null;
    const ch = channels(mem, primary, o.open), data = { rig: primary, preset: o.preset || '', ctl: ch.ctl };
    if (ch.ctl2) data.ctl2 = ch.ctl2;
    if (isObj(mem.sens[primary])) data.sens = clone(mem.sens[primary]);
    data.rigs = clone(mem.rigs);
    const put = src => { if (isObj(src)) Object.keys(src).forEach(k => { if (RESERVED.indexOf(k) < 0 && src[k] !== null && src[k] !== undefined && src[k] !== '') data[k] = src[k]; }); };
    put(mem.extra); put(o.form);
    const sim = o.sim || {};
    data.state = isObj(sim.state) ? sim.state : {}; data.derived = deriveOf(primary, data.state);
    if (ch.ctl2) { data.state2 = isObj(sim.state2) ? sim.state2 : {}; data.derived2 = deriveOf(primary, data.state2); }
    return data;
  }
  const pure = { ordered, cleanState, memNew, memLoad, memSet, channels, startPlan, stashEntry, deriveOf, buildData, OPT, PROX };

  /* ============================================================ Rechenlauf im Kern (ohne Wirkung auf den Prüfstand im Bild) */
  function runState(rigId, ctl) {
    const C = CORE(); if (!C || !C.runSeq || !root.SEN_RIGS || !root.SEN_RIGS.defs || !root.SEN_RIGS.defs[rigId]) return {};
    const r = C.runSeq(rigId, [], 800, { controls: ordered(ctl), dtMs: 2, sampleMs: 400 });
    return cleanState(r.final);
  }
  function simulate(rigId, ch) { return { state: runState(rigId, ch.ctl), state2: ch.ctl2 ? runState(rigId, ch.ctl2) : undefined }; }

  /* ============================================================ Zugriff auf das Lab */
  let cur = null, timer = null;   // cur = { pid, sid, key, mem }
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
    const key = KEYPFX + t.pid + '.' + t.sid, seed = seedOf(t.pid);
    if (!cur || cur.key !== key || cur.mem.s !== seed) cur = { pid: t.pid, sid: t.sid, key, mem: memLoad(ls.get(key), seed) };
    return cur;
  }
  function save() { if (cur) { const s = JSON.stringify(cur.mem); if (s !== cur.last) { cur.last = s; ls.set(cur.key, s); } } }
  function capture() {          // Steuerwerte des offenen Prüfstands ins Gedächtnis
    const U = UI(); if (!U || !U.S || !U.S.rig || !U.S.rigId || U.S.attrappe) return;
    if (!bind()) return;
    if (cur.inst !== U.S.rig) {   // neuer Prüfstand im Lab (Wechsel, Neuladen): steht er auf Vorgabewerten, die gemerkten Werte einstellen
      cur.inst = U.S.rig;
      if (cur.mem.rigs[U.S.rigId] && isFresh(U, U.S.rigId)) U.applyCtl(ordered(cur.mem.rigs[U.S.rigId]));
    }
    const pk = U.S.rigId + ':' + U.allCtl().sensor, pend = cur.mem.pend[pk];   // gemerkter zweiter Sensor: beim Auswählen im Lab seine Werte einstellen
    if (pend) { delete cur.mem.pend[pk]; U.applyCtl(ordered(pend)); }
    const now = U.allCtl(); memSet(cur.mem, U.S.rigId, now, isFresh(U, U.S.rigId, now)); save();
  }
  function startPoll() { if (timer || typeof root.setInterval !== 'function') return; timer = root.setInterval(capture, 300); if (timer && timer.unref) timer.unref(); }
  function stop() { if (timer && typeof root.clearInterval === 'function') root.clearInterval(timer); timer = null; cur = null; }
  /* laufende Arbeit sichern wie das Lab selbst (stash): Versuchsliste sen.saves */
  function stash() {
    const U = UI(), S = U && U.S; if (!S || !S.rig || !S.dirty || S.readonly || S.task) return false;
    let a = []; try { a = JSON.parse(ls.get(SAVES) || '[]'); } catch (e) { a = []; } if (!Array.isArray(a)) a = [];
    a.push(stashEntry(U.snapshot(), S, Date.now(), 'v' + Date.now().toString(36)));
    ls.set(SAVES, JSON.stringify(a.slice(-100))); S.dirty = false; S.id = null; return true;
  }
  const rigName = id => { const d = root.SEN_RIGS && root.SEN_RIGS.defs && root.SEN_RIGS.defs[id]; return (d && d.name) || id; };
  const fmtCtl = c => Object.keys(c).filter(k => ['sensor', 'material', 'dist', 'target'].indexOf(k) >= 0).map(k => k + ' = ' + String(c[k]).replace('.', ',')).join(', ');

  const adapter = {
    lab: LAB, pure, stop, _capture: capture, _mem: () => (cur ? cur.mem : null),
    ready() { const U = UI(); const ok = !!(U && U.S && U.S.rig && CORE() && root.SEN_RIGS); if (ok) { startPoll(); bind(); } return ok; },
    apply(station, ctx) {
      const U = UI(); if (!U || !U.S) return { ok: false, msg: 'Das Sensorik-Lab ist noch nicht bereit.' };
      ctx = ctx || {}; const c = bind(); if (!c) return { ok: false, msg: 'Keine aktive Verbundstation.' };
      const stashed = stash(), plan = startPlan(station, { assist: ctx.assist, solution: ctx.solution });
      c.mem = memNew(c.mem.s); c.mem.extra = plan.extra;
      if (plan.ctl2) { memSet(c.mem, plan.rig, plan.ctl2); c.mem.pend[plan.rig + ':' + plan.ctl2.sensor] = clone(plan.ctl2); }   // zweiter Sensor: gemerkt, im Lab erst beim Auswählen gezeigt
      memSet(c.mem, plan.rig, plan.ctl); save();
      U.setRig(plan.rig); U.applyCtl(ordered(plan.ctl)); c.inst = U.S.rig; const now = U.allCtl(); memSet(c.mem, plan.rig, now, !Object.keys(plan.ctl).length && isFresh(U, plan.rig, now)); save();
      if (U.setTab) U.setTab('rig');
      U.S.name = 'Verbund: ' + String((station && station.title) || 'Station'); U.S.dirty = false; U.S.task = null;
      let msg = (plan.solution ? 'Musterlösung' : 'Startwerte') + ' im Prüfstand „' + rigName(plan.rig) + '“ geladen' + (stashed ? ', deine Arbeit ist gesichert.' : '.');
      if (plan.ctl2) msg += ' Zweiter Sensor (' + fmtCtl(plan.ctl2) + ') wird eingestellt, sobald du ihn im Prüfstand auswählst.';
      return { ok: true, msg };
    },
    collect(station, ctx) {
      const U = UI(); if (!U || !U.S || !U.S.rig) return { error: 'Das Sensorik-Lab ist noch nicht bereit.' };
      const c = bind(); if (!c) return { error: 'Keine aktive Verbundstation.' };
      capture();
      const open = isObj(station && station.open) ? station.open : {}, primary = open.rig || U.S.rigId;
      if (!isObj(c.mem.rigs[primary])) return { error: 'Stelle zuerst im Prüfstand „' + rigName(primary) + '“ die Werte ein, die die Aufgabe verlangt.' };
      const sim = simulate(primary, channels(c.mem, primary, open));
      const data = buildData(c.mem, primary, { open, preset: U.S.rigId === primary && U.S.preset ? String(U.S.preset) : '', form: ctx && ctx.formData, sim });
      if (data && station && typeof station.fromForm === 'function' && ctx && isObj(ctx.formData)) {      // Stationen mit verschachtelten Formularwerten (z. B. scale, thr)
        try { const x = station.fromForm(ctx.formData, ctx); if (isObj(x)) Object.keys(x).forEach(k => { if (RESERVED.indexOf(k) < 0 && x[k] !== null && x[k] !== undefined) data[k] = x[k]; }); } catch (e) { /* Formular unbrauchbar: flache Werte bleiben */ }
      }
      return data ? { type: 'sen.chain', data } : { error: 'Der Prüfstand „' + rigName(primary) + '“ ist nicht eingestellt.' };
    },
    live(station, ctx) {
      const r = this.collect(station, ctx); if (r.error) return [{ ok: false, text: r.error }];
      const d = r.data, st = d.state, dv = d.derived, rows = [], z = x => String(rd(x)).replace('.', ',');
      rows.push({ ok: !st.fault, text: st.fault ? 'Der Prüfstand meldet einen Fehler: ' + (st.faults || []).join(', ') : 'Keine Störung im Rechenlauf.' });
      if (fin(dv.tRespMs)) rows.push({ ok: true, text: 'Ansprechzeit ' + z(dv.tRespMs) + ' ms, größte Schaltfrequenz ' + z(dv.fMax) + ' Hz.' });
      if (st.cls === 'prox') rows.push({ ok: !!st.mountOk, text: 'Montageabstand ' + z(st.dist) + ' mm, erlaubt ' + z(st.mountMin) + ' bis ' + z(st.mountMax) + ' mm (' + (st.mountOk ? 'passt' : 'außerhalb') + ').' });
      if (d.ctl2) rows.push({ ok: true, text: 'Zweiter Sensor (' + d.ctl2.sensor + ') ist gemerkt und geht mit in die Übergabe.' });
      return rows;
    }
  };
  const V = root.Verbund;
  if (V && typeof V.registerAdapter === 'function') V.registerAdapter(LAB, adapter);
  else { root.VERBUND_ADAPTERS = root.VERBUND_ADAPTERS || {}; root.VERBUND_ADAPTERS[LAB] = adapter; }
  if (typeof module !== 'undefined' && module.exports) module.exports = adapter;
})(typeof window !== 'undefined' ? window : globalThis);
