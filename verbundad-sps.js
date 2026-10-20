'use strict';
/* Tonfunk Lab: Verbund-Adapter fuer das SPS-Lab (Paket A4, SPEC 5.2 / 5.5).
   - apply(station, ctx): sichert die laufende Arbeit (Programmliste sps.progs), stellt die Anlage mit ihren Optionen ein
     (travelS, beltMmS, thr, pumpLpm ...) und legt Startprogramm (leer, Rahmenprogramm Stufe 1) oder Musterloesung ins Lab.
   - collect(station, ctx): liest Programm + Anlage + Optionen -> { type:'sps.program', data:{ prog, plant, opts, lang, notes? } };
     verlangt die Station ein Protokoll (station.log), laeuft ein Szenario und das Ergebnis (sps.log) liegt in data.log und in extra[].
   - live(station, ctx): Hinweise zu Uebersetzung, Anlage und Optionen (ohne Nebenwirkung).
   - pure: reine Hilfen (Node-testbar): normOpts, optsFromSlots, resolveOpts, hasContent, frameProg, stashWork, runLog, press.
   Nutzt nur vorhandene Lab-Objekte: SPS_UI (S, setPlant, setProg, setTab, emptyProg), SPS_CORE, SPS_PLANTS.
   Abweichungen von der Spezifikation: quelle/verbund/ABWEICHUNGEN.md. */
(function (root) {

const isO = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const isN = x => typeof x === 'number' && isFinite(x);
const clone = x => JSON.parse(JSON.stringify(x));
const r3 = x => Math.round(x * 1000) / 1000;
function req(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }

/* ---------- Kerne und Anlagen (erst beim Aufruf laden, Ladereihenfolge egal) ---------- */
const core = () => root.SPS_CORE || req('./spscore.js');
function plants() {
  if (root.SPS_PLANTS && root.SPS_PLANTS.defs && Object.keys(root.SPS_PLANTS.defs).length) return root.SPS_PLANTS;
  ['garagentor', 'tank', 'ampel', 'foerderband'].forEach(n => req('./spsplant-' + n + '.js'));
  return root.SPS_PLANTS || null;
}

/* ---------- Anlagen-Optionen: erlaubte Schluessel, Pruefung ---------- */
const KIND = {
  pos: v => isN(v) && v > 0, pct: v => isN(v) && v >= 0 && v <= 100, ratio: v => isN(v) && v >= 0 && v <= 1, ms: v => isN(v) && v >= 0,
  bool: v => typeof v === 'boolean', str: v => typeof v === 'string' && v.length > 0 && v.length < 40,
  travel: v => isN(v) && v >= 2 && v <= 30, belt: v => isN(v) && v >= 10 && v <= 600,
  thr: v => isO(v) && isN(v.min) && isN(v.mid) && isN(v.max) && v.min > 0 && v.min < v.mid && v.mid < v.max && v.max <= 100
};
const ALLOWED = {
  garagentor: { travelS: 'travel', doorPos: 'pct', obstacleType: 'str' },
  foerderband: { beltMmS: 'belt', metalRatio: 'ratio', tmin: 'ms', tmax: 'ms', spawn: 'bool', scenario: 'str' },
  tank: { thr: 'thr', pumpLpm: 'pos', tankL: 'pos', level: 'pct', level2: 'pct', fracB: 'ratio', mixed: 'ratio' },
  ampel: { scenario: 'str', cars: 'bool', peds: 'bool' }
};
/* normOpts: nur bekannte, gueltige Optionen der Anlage; alles andere landet in dropped (nie ein Wurf) */
function normOpts(plant, o) {
  const out = {}, dropped = [], al = ALLOWED[plant] || {};
  if (!isO(o)) return { opts: out, dropped };
  Object.keys(o).forEach(k => {
    if (k === 'seed') return;
    if (!al[k]) { dropped.push(k); return; }
    const v = o[k];
    if (v === null || v === undefined) return;
    if (KIND[al[k]](v)) out[k] = al[k] === 'thr' ? { min: v.min, mid: v.mid, max: v.max } : v; else dropped.push(k);
  });
  return { opts: out, dropped };
}

/* ---------- Optionen aus den Vorstationen ((A): die Namen in den Slots sind Annahmen, sichere Quelle ist station.open.opts) ---------- */
const pick = (o, keys) => { if (!isO(o)) return undefined; for (const k of keys) if (isN(o[k])) return o[k]; return undefined; };
const sub = (d, k) => (isO(d) && isO(d[k]) ? d[k] : {});
function optsFromSlots(plant, get, spec) {
  const g = n => { try { const v = typeof get === 'function' ? get(n) : null; return isO(v) ? v : {}; } catch (e) { return {}; } };
  const sp = isO(spec) ? (isO(spec.params) ? spec.params : spec) : {}, ant = g('ant'), sen = g('sen'), o = {};
  const antV = k => { const v = pick(sub(ant, 'derived'), [k]); return v !== undefined ? v : pick(sub(ant, 'state'), [k]) !== undefined ? pick(sub(ant, 'state'), [k]) : pick(ant, [k]); };
  if (plant === 'garagentor') { const t = antV('travelS'); const s = t !== undefined ? t : pick(sp, ['travelS']); if (s !== undefined) o.travelS = s; }
  if (plant === 'foerderband') {
    let b = antV('beltMmS'); if (b === undefined) { const v = antV('vBelt'); if (v !== undefined) b = v * 1000; }
    if (b === undefined) { const v = pick(sp, ['vSoll']); if (v !== undefined) b = v * 1000; }
    if (b !== undefined) o.beltMmS = r3(b);
  }
  if (plant === 'tank') {
    const q = antV('qLpm') !== undefined ? antV('qLpm') : antV('q') !== undefined ? antV('q') : pick(sp, ['qSoll']);
    if (q !== undefined) o.pumpLpm = q;
    const th = [sub(sen, 'thr'), sub(sub(sen, 'derived'), 'thr'), sub(sub(sen, 'ctl'), 'thr'), isO(sp.thr) ? sp.thr : {}].find(t => KIND.thr(t));
    if (th) o.thr = th;
  }
  return normOpts(plant, o).opts;
}
/* Rangfolge: Musterloesung > station.open.opts (Objekt oder Funktion(ctx)) > Vorstationen/Lastenheft */
function resolveOpts(plant, st, ctx) {
  ctx = ctx || {};
  const sol = ctx.solution && ctx.solution.data;
  if (sol && isO(sol.opts) && (!sol.plant || sol.plant === plant)) return normOpts(plant, sol.opts).opts;
  let oo = st && st.open && st.open.opts;
  if (typeof oo === 'function') { try { oo = oo(ctx); } catch (e) { oo = null; } }
  if (isO(oo)) return normOpts(plant, oo).opts;
  return optsFromSlots(plant, ctx.get, ctx.spec);
}
const optsText = o => Object.keys(o).map(k => k + ' = ' + (isO(o[k]) ? o[k].min + '/' + o[k].mid + '/' + o[k].max + ' %' : o[k])).join(', ');

/* ---------- Programme ---------- */
function hasContent(p) {
  if (!isO(p)) return false;
  if (p.lang === 'gra') { const g = p.gra || {}; return (g.transitions || []).length > 0 || (g.steps || []).length > 1 || (g.steps || []).some(s => (s.actions || []).length); }
  return (p.networks || []).some(n => n.expr || (n.outs || []).length);
}
const plantSyms = def => { const o = {}; if (def && def.io) def.io.inputs.concat(def.io.outputs).forEach(x => { if (x.sym) o[x.key] = x.sym; }); return o; };
function emptyProg(lang, symbols) {
  if (lang === 'gra') return { lang: 'gra', symbols, gra: { steps: [{ id: 'S0', init: true, title: 'Grundstellung', actions: [] }], transitions: [] } };
  return { lang: lang === 'fup' ? 'fup' : 'kop', symbols, networks: [{ id: 'N1', title: '', expr: null, outs: [] }] };
}
/* Rahmenprogramm Stufe 1: E/A-Symbole + Netzwerke mit Ueberschriften aus station.assist[1] (networks: [Titel], symbols: {...}) */
function frameProg(plantDef, st) {
  const a = (st && st.assist && st.assist[1]) || {}, lang = a.lang === 'fup' || a.lang === 'gra' ? a.lang : 'kop';
  const syms = Object.assign(plantSyms(plantDef), isO(a.symbols) ? a.symbols : {}), p = emptyProg(lang, syms);
  if (lang !== 'gra' && Array.isArray(a.networks) && a.networks.length) p.networks = a.networks.slice(0, 20).map((t, i) => ({ id: 'N' + (i + 1), title: String(t), expr: null, outs: [] }));
  return p;
}
/* laufende Arbeit in die Programmliste des Labs (sps.progs) sichern, wenn etwas drinsteht und noch nicht gesichert ist (wie stash() im Lab) */
function stashWork(S, ls) {
  try {
    if (!S || !hasContent(S.prog) || (S.task && !S.dirty) || (S.id && !S.dirty) || !ls) return false;
    let a = []; try { const v = JSON.parse(ls.getItem('sps.progs') || ''); if (Array.isArray(v)) a = v; } catch (e) { a = []; }
    const t = Date.now();
    a.push({ id: 'vb' + t.toString(36) + Math.floor(Math.random() * 1296).toString(36), name: S.name || 'Programm', t, plant: S.plantId, prog: clone(S.prog) });
    ls.setItem('sps.progs', JSON.stringify(a.slice(-200)));
    return true;
  } catch (e) { return false; }
}

/* ---------- Szenariolauf -> sps.log ---------- */
const FIELDS = {
  ampel: ['carsPassed', 'pedsCrossed', 'carsCrashed', 'pedsCrashed', 'violations', 'redRunners', 'pedRequest', 'pedsWaiting', 'carsWaiting', 'avgPedWaitMs', 'maxPedWaitMs', 'streetSignal', 'pedSignal'],
  foerderband: ['spawned', 'delivered', 'deliveredMetal', 'deliveredLight', 'sorted', 'sortedMetal', 'sortedLight', 'lost', 'crash', 'bandSpeed', 'cylinder'],
  tank: ['level', 'level2', 'pumpedL', 'overflow', 'dryRun', 'batches', 'badBatches', 'fills'],
  garagentor: ['doorPos', 'crash', 'trips', 'moving', 'jammed']
};
const scal = v => (typeof v === 'boolean' ? (v ? 1 : 0) : isN(v) ? r3(v) : typeof v === 'string' ? v : undefined);
/* Tastendruck: ab t0 fuer dur ms (rest = Ruhezustand, Oeffner: true) -> drive(t, plant) */
function press(key, t0, dur, rest) { let a = false, b = false; return (t, p) => { if (!a && t >= t0) { a = true; p.setInput(key, !rest); } if (a && !b && t >= t0 + dur) { b = true; p.setInput(key, !!rest); } }; }
/* o: { plant, opts, seed, scen, ms, sampleMs, inputs:{key:bool}, delay:{key:ms}, drive(t,plant,plc), fields:[..] } ; Ergebnis { ok, data } | { ok:false, error } */
function runLog(prog, o) {
  try {
    o = o || {};
    const PL = plants(), CORE = core(), pid = o.plant;
    if (!PL || !PL.defs[pid]) return { ok: false, error: 'Anlage unbekannt: ' + pid };
    if (!CORE) return { ok: false, error: 'SPS-Kern fehlt' };
    const seed = isN(o.seed) ? o.seed : 1, opts = normOpts(pid, o.opts).opts;
    const plant = PL.create(pid, Object.assign({ seed }, opts));
    if (o.scen && plant.scenarios(o.scen) === false) return { ok: false, error: 'Szenario unbekannt: ' + o.scen };
    const plc = CORE.create(clone(prog));
    if (!plc.ok) return { ok: false, error: 'Programm hat Fehler: ' + String((plc.errorList && plc.errorList[0]) || (plc.errors && plc.errors[0]) || 'unbekannt') };
    if (isO(o.inputs)) Object.keys(o.inputs).forEach(k => plant.setInput(k, !!o.inputs[k]));
    const ms = Math.min(3600000, Math.max(10, Math.round((isN(o.ms) ? o.ms : 60000) / 10) * 10)), smp = Math.max(10, Math.round((isN(o.sampleMs) ? o.sampleMs : 1000) / 10) * 10);
    if (ms / smp > 4000) return { ok: false, error: 'Zu viele Protokollzeilen (' + Math.round(ms / smp) + ', hoechstens 4000)' };
    const qk = plant.io.outputs.map(x => x.key), ik = plant.io.inputs.map(x => x.key), fields = Array.isArray(o.fields) ? o.fields : FIELDS[pid] || null;
    const dl = {}; if (isO(o.delay)) Object.keys(o.delay).forEach(k => { dl[k] = { n: Math.round(o.delay[k] / 10), buf: [] }; });
    const out = {}, series = [];
    for (let t = 0; t < ms; t += 10) {
      if (typeof o.drive === 'function') o.drive(t, plant, plc);
      const inp = plant.readInputs();
      for (const k in dl) { const d = dl[k]; d.buf.push(!!inp[k]); inp[k] = d.buf.length > d.n ? d.buf[d.buf.length - 1 - d.n] : false; if (d.buf.length > d.n + 2) d.buf.shift(); }
      for (const k in inp) plc.setInput(k, !!inp[k]);
      plc.scan(10);
      for (let i = 0; i < qk.length; i++) out[qk[i]] = !!plc.getOutput(qk[i]);
      plant.writeOutputs(out); plant.step(10);
      if ((t + 10) % smp === 0) {
        const st = plant.state(), row = { t: t + 10, q: qk.map(k => (out[k] ? '1' : '0')).join('') }, fi = plant.readInputs();
        row.i = ik.map(k => (fi[k] ? '1' : '0')).join('');
        (fields || Object.keys(st)).forEach(k => { const v = scal(st[k]); if (v !== undefined) row[k] = v; });
        series.push(row);
      }
    }
    const fin = plant.state(), counters = { cycles: ms / 10 };
    Object.keys(fin).forEach(k => { const v = scal(fin[k]); if (v !== undefined && typeof v === 'number') counters[k] = v; });
    const data = { plant: pid, seed, dtMs: smp, series, counters, opts, ms };
    if (Array.isArray(fin.cyc)) data.phases = fin.cyc.slice(-400);
    return { ok: true, data };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

/* ---------- Anbindung an das Lab ---------- */
const UI = () => root.SPS_UI || null;
const lsOf = () => { try { return root.localStorage || null; } catch (e) { return null; } };
const ownOpts = S => isO(S.plantOpts) && S.plantOptsFor === S.plant;   // false nach Neuladen oder Anlagenwechsel im Lab
const defOf = id => { const P = plants(); return P && P.defs[id] ? P.defs[id] : null; };

const adapter = {
  lab: 'sps',
  ready() { const u = UI(), P = plants(); return !!(u && u.S && u.S.plant && u.S.prog && u.setPlant && u.setProg && P && P.list && P.list.length && core()); },
  apply(st, ctx) {
    const u = UI(), P = plants(); if (!u || !P) return { ok: false, msg: 'SPS-Lab ist nicht bereit.' };
    st = st || {}; ctx = ctx || {};
    const S = u.S, open = st.open || {}, sol = ctx.solution && ctx.solution.ok !== false && ctx.solution.data && isO(ctx.solution.data.prog) ? ctx.solution.data : null;
    let plant = (sol && sol.plant) || open.plant || S.plantId; if (!P.defs[plant]) plant = S.plantId;
    const opts = resolveOpts(plant, st, ctx), stashed = stashWork(S, lsOf());
    u.setPlant(plant);
    if (Object.keys(opts).length) S.plant = P.create(plant, Object.assign({ seed: 1 }, opts));
    S.plantOpts = opts; S.plantOptsFor = S.plant;   // plantOptsFor: die Anlage, die diese Optionen wirklich traegt (Lab ersetzt sie bei Anlagenwechsel)
    let prog;
    if (sol) prog = clone(sol.prog);
    else if (ctx.assist && st.assist && st.assist[1]) prog = frameProg(defOf(plant), st);
    else prog = typeof u.emptyProg === 'function' ? u.emptyProg('kop', plantSyms(defOf(plant))) : emptyProg('kop', plantSyms(defOf(plant)));
    S.task = null; S.view = 'edit';
    u.setProg(prog, 'Verbund: ' + (st.title || st.id || 'Station'));
    if (typeof u.setTab === 'function') u.setTab('prog');
    const pd = defOf(plant), t = (pd ? pd.name : plant) + (Object.keys(opts).length ? ' (' + optsText(opts) + ')' : '');
    return { ok: true, msg: (sol ? 'Musterlösung geladen' : ctx.assist && st.assist && st.assist[1] ? 'Rahmenprogramm geladen' : 'Anlage geladen') + ': ' + t + '.' + (stashed ? ' Dein bisheriges Programm ist unter „Öffnen“ gesichert.' : '') };
  },
  collect(st, ctx) {
    const u = UI(); if (!u || !u.S || !isO(u.S.prog)) return { error: 'Das SPS-Lab hat noch kein Programm geladen.' };
    st = st || {}; ctx = ctx || {};
    const S = u.S, plant = S.plantId;
    const opts = ownOpts(S) ? normOpts(plant, S.plantOpts).opts : resolveOpts(plant, st, ctx);
    const data = { prog: clone(S.prog), plant, opts, lang: S.prog.lang || 'kop' };
    const note = ctx.form && typeof ctx.form.notes === 'string' ? ctx.form.notes.trim() : '';
    if (note) data.notes = note;
    const res = { type: 'sps.program', data };
    let lg = st.log; if (typeof lg === 'function') { try { lg = lg(ctx); } catch (e) { lg = null; } }
    if (isO(lg)) {
      const r = runLog(S.prog, Object.assign({}, lg, { plant, opts: Object.assign({}, lg.opts, opts) }));
      if (!r.ok) return { error: 'Das Szenario ließ sich nicht fahren: ' + r.error };
      data.log = r.data; res.extra = [{ slot: lg.slot || null, type: 'sps.log', data: r.data }];
    }
    return res;
  },
  /* Nach dem Neuladen des SPS-Labs zeigt es wieder die Standardanlage (E20); Prüfen und Übergeben rechnen weiter mit den Werten der Station. */
  reloadNote(st, ctx) {
    const u = UI(); if (!u || !u.S || ownOpts(u.S)) return '';
    const o = resolveOpts(u.S.plantId, st || {}, ctx || {}); if (!Object.keys(o).length) return '';
    return 'Das SPS-Lab zeigt nach dem Neuladen wieder die Standardanlage. Prüfen und Übergeben rechnen trotzdem mit den Werten deiner Station (' + optsText(o) + '). Soll die Anlage im Lab mit diesen Werten laufen, tippe auf „Startdaten neu laden“. Dein bisheriges Programm wird vorher unter „Öffnen“ gesichert.';
  },
  live(st, ctx) {
    const u = UI(), rows = []; if (!u || !u.S) return [{ ok: false, text: 'SPS-Lab nicht bereit.' }];
    const S = u.S, plc = S.plc, want = st && st.open && st.open.plant;
    if (!hasContent(S.prog)) rows.push({ ok: false, text: 'Noch nichts programmiert.' });
    rows.push({ ok: !!(plc && plc.ok), text: plc && plc.ok ? 'Das Programm lässt sich übersetzen.' : 'Programm hat Fehler: ' + String((plc && plc.errorList && plc.errorList[0]) || (plc && plc.errors && plc.errors[0]) || 'unbekannt') });
    if (want) rows.push({ ok: S.plantId === want, text: S.plantId === want ? 'Anlage passt zur Station (' + want + ').' : 'Die Station verlangt die Anlage „' + want + '“, geladen ist „' + S.plantId + '“.' });
    const o = ownOpts(S) ? S.plantOpts : {};
    if (Object.keys(o).length) rows.push({ ok: true, text: 'Anlage läuft mit ' + optsText(o) + '.' });
    else { const rn = adapter.reloadNote(st, ctx); if (rn) rows.push({ ok: false, text: rn }); }
    const w = plc && plc.warnings && plc.warnings.length; if (w) rows.push({ ok: false, text: w + ' Warnung(en) in der Fehlerliste.' });
    return rows;
  },
  pure: { normOpts, optsFromSlots, resolveOpts, hasContent, emptyProg, frameProg, plantSyms, stashWork, runLog, press, optsText, ALLOWED, FIELDS }
};

root.VerbundAdSps = adapter;
let V = root.Verbund || null; if (!V) V = req('./verbund.js');
if (V && typeof V.registerAdapter === 'function') V.registerAdapter('sps', adapter);
else { root.VERBUND_ADAPTERS = root.VERBUND_ADAPTERS || {}; root.VERBUND_ADAPTERS.sps = adapter; }
if (typeof module !== 'undefined' && module.exports) module.exports = adapter;

})(typeof window !== 'undefined' ? window : globalThis);
