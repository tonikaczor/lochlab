/* verbundad-ant.js - Adapter Antriebs-Lab für die Verbundprojekte (Paket A5, SPEC 5.2 / 5.5)
 * Slot-Typ ant.setup: { rig, preset, ctl, gear?, <Formularwerte der Station, z. B. fuseA>, state, derived }
 *   rig     Prüfstand der Station (station.open.rig, sonst der gerade offene), ctl = Steuerwerte dieses Prüfstands (alle Schlüssel)
 *   gear    Getriebe aus dem Prüfstand "getriebe" (type, stages, z1..z4), falls dort schon eingestellt
 *   state   Zustand nach einem Rechenlauf im Kern (ANT_CORE.runSeq, ohne Nebenwirkung auf den Prüfstand im Bild)
 *   derived ratio, rpm, iRun, iStart, tempMax, brakeStopMs, brakeAngle (Motorwelle, Grad), brakeMm, vMs, travelS (je nach Daten)
 * Das Lab zeigt immer nur EINEN Prüfstand. Damit Motor und Getriebe in einer Station zusammenkommen, merkt sich der Adapter die
 * zuletzt gesehenen Steuerwerte je Prüfstand (localStorage verbund.ad.ant.<pid>.<sid>, an den Seed gebunden, 0,3-s-Abgleich).
 * Formularwerte (station.form, ctx.formData) werden oben in die Daten gelegt (Schlüssel wie im Formular).
 * Reine Teile in adapter.pure (Node-tauglich, quelle/verbund/test_verbundad_ant.js). Werte mit (A) sind Annahmen (SPEC 8). */
(function (root) {
  'use strict';
  const LAB = 'ant', SAVES = 'ant.saves', KEYPFX = 'verbund.ad.ant.';
  const UI = () => root.ANT_UI, CORE = () => root.ANT_CORE;
  const DC_CORE = { getriebe12: 'gm12', antrieb24: 'antrieb24', modell: 'modell6' };   // Motor-ID des Prüfstands -> Voreinstellung im Kern
  const GEAR_KEYS = ['type', 'stages', 'z1', 'z2', 'z3', 'z4'];
  const RESERVED = ['rig', 'preset', 'ctl', 'ctl2', 'gear', 'state', 'state2', 'derived', 'rigs', 'sens'];
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clone = o => JSON.parse(JSON.stringify(o));
  const rd = (x, d) => { if (!fin(x)) return x; const f = Math.pow(10, d == null ? 3 : d); return Math.round(x * f) / f; };
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
  function pickKeys(o, keys) { const r = {}; if (isObj(o)) keys.forEach(k => { if (o[k] !== undefined) r[k] = o[k]; }); return r; }
  function gearOf(ctl) {
    if (!isObj(ctl)) return null;
    const st = +ctl.stages === 2 ? 2 : 1, g = { type: String(ctl.type || 'stirnrad'), stages: st };
    ['z1', 'z2'].concat(st === 2 ? ['z3', 'z4'] : []).forEach(k => { g[k] = +ctl[k]; });
    return g;
  }
  /* Gedächtnis der Prüfstände: { s: seed, rigs: { <rig>: ctl }, extra: { <Formularwert>: … } } */
  const memNew = seed => ({ s: seed, rigs: {}, extra: {} });
  function memLoad(raw, seed) {
    try { const o = JSON.parse(raw); if (isObj(o) && o.s === seed && isObj(o.rigs)) return { s: seed, rigs: o.rigs, extra: isObj(o.extra) ? o.extra : {} }; } catch (e) { /* leer */ }
    return memNew(seed);
  }
  function memSet(mem, rigId, ctl) { if (rigId && isObj(ctl)) mem.rigs[rigId] = clone(ctl); return mem; }
  /* Startplan: welcher Prüfstand mit welchen Werten (Musterlösung > Starthilfe Stufe 1 > station.open) */
  function startPlan(station, flags) {
    flags = flags || {};
    const open = isObj(station && station.open) ? station.open : {};
    const asst = flags.assist && isObj(station && station.assist) && isObj(station.assist[1]) ? station.assist[1] : null;
    const sol = flags.solution && isObj(flags.solution.data) ? flags.solution.data : null;
    const src = sol || asst || {};
    const rig = String(src.rig || open.rig || 'gleichstrom'), rigs = {}, extra = {};
    rigs[rig] = Object.assign({}, isObj(open.ctl) ? open.ctl : {}, isObj(src.ctl) ? src.ctl : {});
    if (isObj(src.gear) && rig !== 'getriebe') rigs.getriebe = pickKeys(src.gear, GEAR_KEYS);
    if (sol) Object.keys(sol).forEach(k => { if (RESERVED.indexOf(k) < 0 && ['number', 'string', 'boolean'].indexOf(typeof sol[k]) >= 0) extra[k] = sol[k]; });
    const preset = [src.preset, open.preset].find(x => typeof x === 'string' && x);   // Voreinstellung des Prüfstands (z. B. Motor m055 im Drehstrom-Prüfstand)
    return { rig, rigs, extra, preset: preset || '', solution: !!sol, assist: !!asst };
  }
  /* Trommel-/Rollendurchmesser in m: station.open.drumM, sonst Lastenheft dT (Seiltrommel) oder dRolle (Band) */
  function drumOf(spec, station) {
    const open = isObj(station && station.open) ? station.open : {}, s = isObj(spec) ? spec : {};
    const d = [open.drumM, s.dT, s.dRolle].find(x => fin(+x) && +x > 0);
    return d === undefined ? NaN : +d;
  }
  /* Abgeleitete Größen aus Zustand, Übersetzung und Trommel; Bremsweg an der Trommel aus dem Wellenwinkel */
  function derive(o) {
    const d = {}, st = o.state || {}, i = o.ratio;
    if (fin(i)) d.ratio = rd(i, 4);
    if (fin(st.rpm)) d.rpm = rd(Math.abs(st.rpm), 2);
    if (fin(st.current)) d.iRun = rd(Math.abs(st.current), 4);
    else if (fin(st.iLine)) d.iRun = rd(Math.abs(st.iLine), 4);
    if (fin(o.iStart)) d.iStart = rd(o.iStart, 3);
    if (fin(o.tempMax)) d.tempMax = rd(o.tempMax, 1);
    if (fin(st.brakeStopMs) && o.braked) { d.brakeStopMs = rd(st.brakeStopMs, 1); d.brakeAngle = rd(st.brakeAngle, 2); }
    if (fin(o.dM) && o.dM > 0 && fin(i) && i > 0) {
      if (fin(d.rpm)) { d.vMs = rd(Math.PI * o.dM * (d.rpm / i) / 60, 5); if (fin(o.hub) && d.vMs > 0) d.travelS = rd(o.hub / d.vMs, 3); }
      if (d.brakeAngle !== undefined) d.brakeMm = rd(d.brakeAngle / 360 / i * Math.PI * o.dM * 1000, 3);
    }
    return d;
  }
  /* Prüfstand steht noch auf den Vorgabewerten (frisch erzeugt, nichts verstellt)? */
  function isFresh(U, rigId) {
    const d = root.ANT_RIGS && root.ANT_RIGS.defs && root.ANT_RIGS.defs[rigId]; if (!d || !Array.isArray(d.controls)) return false;
    const now = U.allCtl(); return d.controls.every(c => now[c.key] === undefined || JSON.stringify(now[c.key]) === JSON.stringify(c.value));
  }
  /* Reihenfolge beim Setzen: Sensor, Motor, Getriebeart zuerst (sie setzen andere Werte zurück), die Betriebsart zuletzt
     (ein Schalter S1..S4 im PWM-Betrieb schaltet den Prüfstand sonst auf manuell). Im PWM-Betrieb sind S1..S4 nur abgeleitet und werden nicht gesetzt. */
  function ordered(ctl) {
    const first = ['sensor', 'motor', 'type', 'stages'], o = {};
    first.forEach(k => { if (ctl && ctl[k] !== undefined) o[k] = ctl[k]; });
    Object.keys(ctl || {}).forEach(k => { if (o[k] === undefined && k !== 'mode' && !(ctl.mode === 'pwm' && /^S[1-4]$/.test(k))) o[k] = ctl[k]; });
    if (ctl && ctl.mode !== undefined) o.mode = ctl.mode;
    return o;
  }
  /* Eintrag für die Versuchsliste des Labs (wie saveItem in antui.js) */
  function stashEntry(snap, S, now, id) {
    return { id, name: 'Vor Verbund: ' + String((snap && snap.name) || 'Versuch'), t: now, rig: snap.rig, ctl: snap.ctl, rows: snap.rows || [], dur: (S && S.seqDur && S.seqDur[snap.rig]) || null };
  }
  /* Daten der Hülle aus Gedächtnis, Formular und Rechenlauf (null, wenn der Prüfstand der Station nie eingestellt wurde) */
  function buildData(mem, primary, o) {
    o = o || {};
    if (!mem || !isObj(mem.rigs[primary])) return null;
    const data = { rig: primary, preset: o.preset || '', ctl: clone(mem.rigs[primary]) };
    const g = isObj(mem.rigs.getriebe) ? gearOf(mem.rigs.getriebe) : null; if (g) data.gear = g;
    const put = src => { if (isObj(src)) Object.keys(src).forEach(k => { if (RESERVED.indexOf(k) < 0 && src[k] !== null && src[k] !== undefined && src[k] !== '') data[k] = src[k]; }); };
    put(mem.extra); put(o.form);
    data.state = isObj(o.state) ? o.state : {}; data.derived = isObj(o.derived) ? o.derived : {};
    return data;
  }
  const pure = { ordered, cleanState, pickKeys, gearOf, memNew, memLoad, memSet, startPlan, drumOf, derive, stashEntry, buildData, DC_CORE, GEAR_KEYS };

  /* ============================================================ Rechenlauf im Kern (ohne Wirkung auf den Prüfstand im Bild) */
  function simulate(rigId, ctl, gear, spec, station, rigOpts) {
    const C = CORE(); let state = {}, tempMax = NaN, iStart = NaN, braked = false, ratio = NaN;
    const base = ordered(Object.assign({}, ctl, { brake: false }));
    if (rigId === 'drehstrom' && !base.K1 && !base.K2 && !base.K3) base.K1 = true;    // Rechenlauf im Betrieb (Netzschütz ein; Stern/Dreieck nach connection), sonst stünde der Motor und alle Kennwerte wären 0
    if (C && C.runSeq && root.ANT_RIGS && root.ANT_RIGS.defs && root.ANT_RIGS.defs[rigId]) {
      const r = C.runSeq(rigId, [], 1000, { controls: base, dtMs: 5, sampleMs: 500, rigOpts });
      state = r.final || {}; if (r.peaks && r.peaks.temp) tempMax = r.peaks.temp.max;
      if (rigId === 'gleichstrom') {      // Bremsprobe: nach 1 s Anlauf die Wicklung kurzschließen (Rechenschritt 1 ms)
        const b = C.runSeq(rigId, [{ t: 1000, set: { brake: true } }], 3500, { controls: base, dtMs: 1, sampleMs: 500, rigOpts });
        if (b.final && b.final.brakeDone) { state = Object.assign({}, state, { brakeStopMs: b.final.brakeStopMs, brakeAngle: b.final.brakeAngle }); braked = true; }
        const pre = C.dcPresets && C.dcPresets[DC_CORE[ctl.motor] || ctl.motor];
        if (pre && C.dcDerived && C.pwmAverage) { try { iStart = C.dcDerived(pre.params, C.pwmAverage((+ctl.duty || 0) / 100, +ctl.uSupply || 0, 0.2)).iStall; } catch (e) { /* ohne iStart */ } }
      }
    }
    if (C && C.gearbox && isObj(gear)) { try { ratio = C.gearbox({ type: gear.type || 'stirnrad', stages: gear.stages, z1: gear.z1, z2: gear.z2, z3: gear.z3, z4: gear.z4 }).info().ratio; } catch (e) { ratio = NaN; } }
    const sp = isObj(spec) ? spec : {};
    const derived = derive({ state, ratio, iStart, tempMax, braked, dM: drumOf(sp, station), hub: fin(+sp.hub) ? +sp.hub : NaN });
    return { state: cleanState(state), derived };
  }

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
    if (cur.inst !== U.S.rig) {   // neuer Prüfstand im Lab (Wechsel, Neuladen): steht er auf Vorgabewerten, die gemerkten Werte (auch Startwerte/Musterlösung) einstellen
      cur.inst = U.S.rig;
      if (cur.mem.rigs[U.S.rigId] && isFresh(U, U.S.rigId)) U.applyCtl(ordered(cur.mem.rigs[U.S.rigId]));
    }
    memSet(cur.mem, U.S.rigId, U.allCtl()); save();
  }
  function startPoll() { if (timer || typeof root.setInterval !== 'function') return; timer = root.setInterval(capture, 300); if (timer && timer.unref) timer.unref(); }
  function stop() { if (timer && typeof root.clearInterval === 'function') root.clearInterval(timer); timer = null; cur = null; }
  /* laufende Arbeit sichern wie das Lab selbst (stash): Versuchsliste ant.saves */
  function stash() {
    const U = UI(), S = U && U.S; if (!S || !S.rig || !S.dirty || S.readonly || S.task) return false;
    let a = []; try { a = JSON.parse(ls.get(SAVES) || '[]'); } catch (e) { a = []; } if (!Array.isArray(a)) a = [];
    a.push(stashEntry(U.snapshot(), S, Date.now(), 'v' + Date.now().toString(36)));
    ls.set(SAVES, JSON.stringify(a.slice(-100))); S.dirty = false; S.id = null; return true;
  }
  const rigName = id => { const d = root.ANT_RIGS && root.ANT_RIGS.defs && root.ANT_RIGS.defs[id]; return (d && d.name) || id; };

  const adapter = {
    lab: LAB, pure, stop, _capture: capture, _mem: () => (cur ? cur.mem : null),
    ready() { const U = UI(); const ok = !!(U && U.S && U.S.rig && CORE() && root.ANT_RIGS); if (ok) { startPoll(); bind(); } return ok; },
    apply(station, ctx) {
      const U = UI(); if (!U || !U.S) return { ok: false, msg: 'Das Antriebs-Lab ist noch nicht bereit.' };
      ctx = ctx || {}; const c = bind(); if (!c) return { ok: false, msg: 'Keine aktive Verbundstation.' };
      const stashed = stash(), plan = startPlan(station, { assist: ctx.assist, solution: ctx.solution });
      c.mem = memNew(c.mem.s); Object.keys(plan.rigs).forEach(k => memSet(c.mem, k, plan.rigs[k])); c.mem.extra = plan.extra;
      U.setRig(plan.rig);
      if (plan.preset && root.document) { try { const b = root.document.querySelector('#presetBar [data-pre="' + String(plan.preset).replace(/"/g, '') + '"]'); if (b) b.click(); } catch (e) { /* ohne Voreinstellung */ } }   // wie der Klick im Lab (setzt z. B. den Motor)
      U.applyCtl(ordered(plan.rigs[plan.rig])); memSet(c.mem, plan.rig, U.allCtl()); c.inst = U.S.rig; save();
      if (U.setTab) U.setTab('rig');
      U.S.name = 'Verbund: ' + String((station && station.title) || 'Station'); U.S.dirty = false; U.S.task = null;
      let msg = (plan.solution ? 'Musterlösung' : 'Startwerte') + ' im Prüfstand „' + rigName(plan.rig) + '“ geladen' + (stashed ? ', deine Arbeit ist gesichert.' : '.');
      if (plan.rigs.getriebe) msg += ' Das Getriebe (' + gearOf(plan.rigs.getriebe).z1 + '/' + plan.rigs.getriebe.z2 + (+plan.rigs.getriebe.stages === 2 ? ' und ' + plan.rigs.getriebe.z3 + '/' + plan.rigs.getriebe.z4 : '') + ') wird gezeigt, sobald du den Prüfstand „Getriebe“ öffnest.';
      return { ok: true, msg };
    },
    collect(station, ctx) {
      const U = UI(); if (!U || !U.S || !U.S.rig) return { error: 'Das Antriebs-Lab ist noch nicht bereit.' };
      const c = bind(); if (!c) return { error: 'Keine aktive Verbundstation.' };
      capture();
      const open = isObj(station && station.open) ? station.open : {}, primary = open.rig || U.S.rigId;
      if (!isObj(c.mem.rigs[primary])) return { error: 'Stelle zuerst im Prüfstand „' + rigName(primary) + '“ die Werte ein, die die Aufgabe verlangt.' };
      let motor = '';      // Motorwahl des Drehstrom-Prüfstands (Voreinstellung m055 usw.) ist kein Steuerwert: aus dem laufenden Prüfstand lesen und im Rechenlauf nachbilden
      if (primary === 'drehstrom' && U.S.rigId === primary && U.S.rig && typeof U.S.rig.state === 'function') { try { const ls0 = U.S.rig.state(); if (ls0 && typeof ls0.motor === 'string') motor = ls0.motor; } catch (e) { motor = ''; } }
      const m = c.mem, sim = simulate(primary, m.rigs[primary], isObj(m.rigs.getriebe) ? gearOf(m.rigs.getriebe) : null, ctx && ctx.spec, station, motor ? { motor } : undefined);
      const data = buildData(m, primary, { preset: motor || (U.S.rigId === primary && U.S.preset ? String(U.S.preset) : ''), form: ctx && ctx.formData, state: sim.state, derived: sim.derived });
      return data ? { type: 'ant.setup', data } : { error: 'Der Prüfstand „' + rigName(primary) + '“ ist nicht eingestellt.' };
    },
    live(station, ctx) {
      const r = this.collect(station, ctx); if (r.error) return [{ ok: false, text: r.error }];
      const d = r.data, st = d.state, dv = d.derived, rows = [];
      rows.push({ ok: !st.fault, text: st.fault ? 'Der Prüfstand meldet einen Fehler: ' + (st.faults || []).join(', ') : 'Keine Störung im Rechenlauf.' });
      if (fin(dv.travelS)) rows.push({ ok: true, text: 'Fahrzeit (Rechenwert): ' + String(dv.travelS).replace('.', ',') + ' s.' });
      if (fin(dv.brakeStopMs)) rows.push({ ok: true, text: 'Bremsen: Stillstand nach ' + String(dv.brakeStopMs).replace('.', ',') + ' ms, ' + String(dv.brakeAngle).replace('.', ',') + ' Grad an der Motorwelle.' });
      if (d.rig === 'gleichstrom') rows.push({ ok: !!d.gear, text: d.gear ? 'Getriebe aus dem Prüfstand „Getriebe“ übernommen (i = ' + String(dv.ratio).replace('.', ',') + ').' : 'Getriebe fehlt noch: Zähnezahlen im Prüfstand „Getriebe“ einstellen.' });
      return rows;
    }
  };
  const V = root.Verbund;
  if (V && typeof V.registerAdapter === 'function') V.registerAdapter(LAB, adapter);
  else { root.VERBUND_ADAPTERS = root.VERBUND_ADAPTERS || {}; root.VERBUND_ADAPTERS[LAB] = adapter; }
  if (typeof module !== 'undefined' && module.exports) module.exports = adapter;
})(typeof window !== 'undefined' ? window : globalThis);
