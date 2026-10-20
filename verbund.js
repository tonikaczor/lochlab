/* verbund.js - Kern der Verbund-Projektkampagnen (Hub): Registry, Speicher, Hüllen, Slots, Prüfung, Zustand, Punkte, Teilen, Bericht
 * window.Verbund (Browser) bzw. module.exports (Node). Läuft ohne Browser; Speicher austauschbar (Verbund.setStorage).
 * Alle Funktionen werfen nie (Unsinn rein -> { ok:false, err, msg }), alle Meldungen Deutsch.
 * Speicher (localStorage, Präfix verbund.): verbund.<pid> (Zustand), verbund.<pid>.s.<slot> (Hülle), verbund.<pid>.bak, verbund.prefs;
 * Ergebnisse zusätzlich in lm4.tdone (Prozent, Maximum), sim.hints (Tipp-Stufe), Badges.stat (falls window.Badges da ist).
 * Projektdefinition, Station und Adapter: siehe quelle/verbund/SPEC.md (Abschnitte 3 bis 5). */
(function (root) {
  'use strict';
  const V = { version: '1.0', SCHEMA: 1 };
  const isO = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const isA = Array.isArray;
  const isS = x => typeof x === 'string';
  const isN = x => typeof x === 'number' && isFinite(x);
  const isI = x => isN(x) && Math.floor(x) === x;
  const clone = o => JSON.parse(JSON.stringify(o));
  const msgOf = e => (e && e.message ? e.message : String(e));
  const guard = (f, fb) => function () { try { return f.apply(this, arguments); } catch (e) { return typeof fb === 'function' ? fb(e) : fb; } };
  const bad = (err, msg, more) => Object.assign({ ok: false, err, msg }, more || {});
  const verText = () => (root && root.LAB_VERSION) || 'v15.135';

  /* ====================================================================== Hilfen: Hash, canon, rng */
  function utf8(str) {
    str = String(str);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    const s = unescape(encodeURIComponent(str)), b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  function fromUtf8(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(s));
  }
  V.hash = function (str) {
    const b = utf8(str === undefined || str === null ? '' : str); let h = 0x811c9dc5;
    for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  };
  V.fnv = function (str) { return ('00000000' + V.hash(str).toString(16)).slice(-8); };
  /* canon: JSON mit sortierten Schlüsseln, Zahlen auf 9 signifikante Stellen, nie werfend (Zyklen -> "[Zyklus]", zu tief -> null) */
  V.canon = function (obj) {
    const stack = [];
    function c(x, d) {
      if (x === null || x === undefined) return 'null';
      const t = typeof x;
      if (t === 'number') return isFinite(x) ? String(Number(x.toPrecision(9))) : 'null';
      if (t === 'boolean') return x ? 'true' : 'false';
      if (t === 'string') return JSON.stringify(x);
      if (t !== 'object') return 'null';
      if (stack.indexOf(x) >= 0) return '"[Zyklus]"';
      if (d > 120) return 'null';
      stack.push(x);
      let r;
      if (isA(x)) r = '[' + x.map(v => c(v, d + 1)).join(',') + ']';
      else {
        const ks = Object.keys(x).sort(), parts = [];
        ks.forEach(k => { const v = x[k]; if (v !== undefined && typeof v !== 'function') parts.push(JSON.stringify(k) + ':' + c(v, d + 1)); });
        r = '{' + parts.join(',') + '}';
      }
      stack.pop();
      return r;
    }
    return c(obj, 0);
  };
  V.rng = function (seed) {
    let a = (+seed || 0) >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };

  /* ====================================================================== Speicher */
  function memStore() {
    const m = new Map();
    return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(String(k), String(v)); }, removeItem: k => { m.delete(k); }, key: i => { const a = Array.from(m.keys()); return i < a.length ? a[i] : null; }, get length() { return m.size; } };
  }
  let ST = null, SS = null, clock = () => Date.now();
  function defaultStorage(which) {
    try { const s = root[which]; if (s) { s.getItem('verbund.test'); return s; } } catch (e) { /* gesperrt */ }
    return memStore();
  }
  const st = () => ST || (ST = defaultStorage('localStorage'));
  const ss = () => SS || (SS = defaultStorage('sessionStorage'));
  const okStore = s => isO(s) && ['getItem', 'setItem', 'removeItem', 'key'].every(k => typeof s[k] === 'function');
  V.setStorage = function (s) { if (!okStore(s)) return false; ST = s; return true; };
  V.setSessionStorage = function (s) { if (!okStore(s)) return false; SS = s; return true; };
  V.setClock = function (fn) { clock = typeof fn === 'function' ? fn : () => Date.now(); };
  const now = () => { const t = clock(); return isN(t) ? t : Date.now(); };
  const sget = k => { try { return st().getItem(k); } catch (e) { return null; } };
  const sset = (k, v) => { try { st().setItem(k, v); return true; } catch (e) { return false; } };
  const sdel = k => { try { st().removeItem(k); return true; } catch (e) { return false; } };
  const jget = (k, def) => { const r = sget(k); if (r === null) return def; try { const v = JSON.parse(r); return v === null || v === undefined ? def : v; } catch (e) { return def; } };
  const jset = (k, v) => { try { return sset(k, JSON.stringify(v)); } catch (e) { return false; } };
  function keysOf(prefix) {
    const out = [];
    try { const s = st(), n = s.length; for (let i = 0; i < n; i++) { const k = s.key(i); if (isS(k) && k.indexOf(prefix) === 0) out.push(k); } } catch (e) { /* leer */ }
    return out;
  }
  const mapMax = (key, id, val) => { const o = jget(key, {}); const m = isO(o) ? o : {}; if (!(val <= (+m[id] || 0))) { m[id] = val; jset(key, m); } };
  const free = () => sget('lm4.kamp.free') === '1';
  V.free = free;
  const lsName = () => { const n = sget('lm4.name'); return isS(n) ? n.trim() : ''; };

  /* ====================================================================== Typen und Validatoren */
  const TYPES = {}, BUILTIN = {};
  function vNetlist(nl, errs, pre) {
    pre = pre || 'Netzliste';
    if (!isO(nl)) { errs.push(pre + ' fehlt'); return; }
    if (nl.v !== undefined && nl.v !== 1) errs.push(pre + ': Version muss 1 sein');
    if (!isA(nl.parts)) errs.push(pre + ': Bauteilliste fehlt');
    if (!isA(nl.nets)) errs.push(pre + ': Netzliste (nets) fehlt');
    if (!isA(nl.parts) || !isA(nl.nets)) return;
    const refs = new Set(), n0 = errs.length;
    nl.parts.forEach((p, i) => {
      if (!isO(p) || !isS(p.ref) || !p.ref) { errs.push(pre + ': Bauteil ' + (i + 1) + ' ohne Bezeichnung (ref)'); return; }
      if (refs.has(p.ref)) errs.push(pre + ': Bauteil ' + p.ref + ' doppelt');
      refs.add(p.ref);
      if (!isS(p.kind) || !p.kind) errs.push(pre + ': Bauteil ' + p.ref + ' ohne Art (kind)');
      if (p.value !== undefined && p.value !== null && !isS(p.value) && !isN(p.value)) errs.push(pre + ': Wert von ' + p.ref + ' ungültig');
    });
    const seen = new Set();
    nl.nets.forEach((n, i) => {
      if (!isO(n) || !isS(n.name) || !n.name || !isA(n.pins)) { errs.push(pre + ': Netz ' + (i + 1) + ' ungültig (name, pins)'); return; }
      n.pins.forEach(pin => {
        if (!isS(pin) || pin.indexOf('.') < 1) { errs.push(pre + ': Pin "' + pin + '" in Netz ' + n.name + ' ungültig (REF.PIN)'); return; }
        if (!refs.has(pin.slice(0, pin.indexOf('.')))) errs.push(pre + ': Pin ' + pin + ' gehört zu unbekanntem Bauteil');
        if (seen.has(pin)) errs.push(pre + ': Pin ' + pin + ' liegt in mehr als einem Netz');
        seen.add(pin);
      });
    });
    if (errs.length - n0 > 8) errs.length = n0 + 8;
  }
  function need(errs, cond, msg) { if (!cond) errs.push(msg); }
  const objOf = (d, errs) => { if (!isO(d)) { errs.push('Daten fehlen oder sind kein Objekt'); return false; } return true; };
  const VAL = {
    lastenheft(d) { const e = []; if (!objOf(d, e)) return e; need(e, isS(d.pid) && d.pid, 'pid fehlt'); need(e, isI(d.level) && d.level >= 1 && d.level <= 3, 'Stufe muss 1, 2 oder 3 sein'); need(e, isN(d.seed), 'seed fehlt'); need(e, isS(d.name) && d.name, 'Name fehlt'); need(e, isO(d.params), 'params fehlt'); need(e, isA(d.text) && d.text.every(isS), 'text muss eine Liste von Zeilen sein'); need(e, d.io === undefined || isA(d.io), 'io muss eine Liste sein'); return e; },
    'digi.design'(d) { const e = []; if (!objOf(d, e)) return e; vNetlist(d.netlist, e); need(e, isA(d.inputs) && d.inputs.every(x => isO(x) && isS(x.name) && isS(x.ref)), 'inputs: Liste aus { name, ref } fehlt'); need(e, isA(d.outputs) && d.outputs.every(x => isO(x) && isS(x.name) && isS(x.ref) && (x.iMaxMa === undefined || isN(x.iMaxMa))), 'outputs: Liste aus { name, ref, iMaxMa? } fehlt'); need(e, isO(d.vdd) && isN(d.vdd.min) && isN(d.vdd.max) && d.vdd.min <= d.vdd.max, 'vdd { min, max } fehlt oder ist verkehrt'); return e; },
    'ds.pick'(d) { const e = []; if (!objOf(d, e)) return e; need(e, isA(d.items) && d.items.every(x => isO(x) && isS(x.role) && isS(x.ds) && isS(x.part)), 'items: Liste aus { role, ds, part } fehlt'); need(e, isO(d.calc), 'calc fehlt'); need(e, isO(d.vals), 'vals fehlt'); return e; },
    'sch.circuit'(d) { const e = []; if (!objOf(d, e)) return e; need(e, isS(d.lab) && d.lab, 'lab fehlt'); need(e, isS(d.name), 'name fehlt'); vNetlist(d.netlist, e); need(e, isO(d.meas) && Object.keys(d.meas).every(k => isN(d.meas[k])), 'meas muss Zahlen enthalten'); need(e, isO(d.snap), 'snap (Engine-Stand) fehlt'); return e; },
    'loch.layout'(d) { const e = []; if (!objOf(d, e)) return e; need(e, isS(d.name), 'name fehlt'); vNetlist(d.netlist, e); need(e, isI(d.boards) && d.boards >= 1, 'boards muss eine ganze Zahl ab 1 sein'); need(e, isA(d.bom) && d.bom.every(x => isO(x) && isS(x.ref) && isS(x.kind)), 'bom: Liste aus { ref, kind, value } fehlt'); need(e, isO(d.doc), 'doc fehlt'); need(e, d.wiresRibbon === undefined || (isI(d.wiresRibbon) && d.wiresRibbon >= 0), 'wiresRibbon ungültig'); return e; },
    'pcb.board'(d) { const e = []; if (!objOf(d, e)) return e; need(e, isO(d.board), 'board fehlt'); if (!isO(d.report)) { e.push('report fehlt'); return e; } ['w', 'h', 'layers', 'drcErrors', 'drcWarns', 'unrouted', 'shorts', 'cost', 'bomCount'].forEach(k => need(e, isN(d.report[k]), 'report.' + k + ' fehlt oder ist keine Zahl')); return e; },
    'mess.protocol'(d) { const e = []; if (!objOf(d, e)) return e; need(e, isA(d.rows) && d.rows.every(r => isO(r) && isS(r.id) && isS(r.label) && isS(r.unit) && isN(r.soll) && (r.ist === null || isN(r.ist)) && isN(r.tol) && isS(r.instrument)), 'rows: Zeilen mit id, label, unit, soll, ist, tol, instrument fehlen'); need(e, isO(d.values), 'values fehlt'); need(e, isA(d.findings), 'findings fehlt'); return e; },
    'sen.chain'(d) { const e = []; if (!objOf(d, e)) return e; need(e, isS(d.rig) && d.rig, 'rig fehlt'); need(e, isS(d.preset), 'preset fehlt'); need(e, isO(d.ctl), 'ctl fehlt'); need(e, isO(d.state), 'state fehlt'); need(e, isO(d.derived), 'derived fehlt'); return e; },
    'ant.setup'(d) { const e = []; if (!objOf(d, e)) return e; need(e, isS(d.rig) && d.rig, 'rig fehlt'); need(e, isS(d.preset), 'preset fehlt'); need(e, isO(d.ctl), 'ctl fehlt'); need(e, d.gear === undefined || isO(d.gear), 'gear muss ein Objekt sein'); need(e, isO(d.state), 'state fehlt'); need(e, isO(d.derived), 'derived fehlt'); return e; },
    'sps.program'(d) { const e = []; if (!objOf(d, e)) return e; need(e, d.prog !== null && typeof d.prog === 'object', 'prog (Programm) fehlt'); need(e, isS(d.plant) && d.plant, 'plant fehlt'); need(e, isO(d.opts), 'opts fehlt'); need(e, isS(d.lang) && d.lang, 'lang fehlt'); need(e, d.notes === undefined || isS(d.notes), 'notes muss Text sein'); return e; },
    'sps.log'(d) { const e = []; if (!objOf(d, e)) return e; need(e, isS(d.plant) && d.plant, 'plant fehlt'); need(e, isN(d.seed), 'seed fehlt'); need(e, isN(d.dtMs) && d.dtMs > 0, 'dtMs muss eine positive Zahl sein'); need(e, isA(d.series) && d.series.every(r => isO(r) && isN(r.t)), 'series: Liste von Zeilen mit t fehlt'); need(e, isO(d.counters), 'counters fehlt'); return e; },
    'code.sketch'(d) { const e = []; if (!objOf(d, e)) return e; need(e, d.lang === 'arduino', 'lang muss "arduino" sein'); need(e, isS(d.src) && d.src.length > 0, 'src (Programmtext) fehlt'); need(e, d.run === undefined || (isO(d.run) && (d.run.serial === undefined || isA(d.run.serial)) && (d.run.events === undefined || isA(d.run.events))), 'run ungültig (serial und events sind Listen)'); return e; },
    'pi.script'(d) { const e = []; if (!objOf(d, e)) return e; need(e, d.lang === 'python', 'lang muss "python" sein'); need(e, isS(d.src) && d.src.length > 0, 'src (Programmtext) fehlt'); need(e, isA(d.out) && d.out.every(isS), 'out muss eine Liste von Zeilen sein'); return e; },
    'haus.plan'(d) { const e = []; if (!objOf(d, e)) return e; if (!isA(d.circuits)) { e.push('circuits fehlt'); return e; } d.circuits.forEach((c, i) => { const w = 'Stromkreis ' + (i + 1); if (!isO(c) || !isS(c.name)) { e.push(w + ': name fehlt'); return; } need(e, isO(c.breaker) && isS(c.breaker.type) && isN(c.breaker.inA), w + ': Sicherung { type, inA } fehlt'); need(e, c.rcd === null || (isO(c.rcd) && isN(c.rcd.imaMa) && isS(c.rcd.type)), w + ': rcd muss null oder { imaMa, type } sein'); need(e, isO(c.cable) && isN(c.cable.mm2) && isN(c.cable.lenM), w + ': Leitung { mm2, lenM } fehlt'); need(e, isA(c.loads), w + ': loads fehlt'); }); need(e, d.notes === undefined || isS(d.notes), 'notes muss Text sein'); return e; },
    'app.note'(d) { const e = []; if (!objOf(d, e)) return e; need(e, isS(d.title) && d.title.trim(), 'title fehlt'); need(e, isS(d.md), 'md (Notiztext) fehlt'); need(e, isA(d.tags) && d.tags.every(isS), 'tags muss eine Liste von Texten sein'); return e; },
    'pr.quiz'(d) { const e = []; if (!objOf(d, e)) return e; need(e, isO(d.answers), 'answers fehlt'); need(e, isI(d.n) && d.n >= 0, 'n muss eine ganze Zahl ab 0 sein'); return e; }
  };
  Object.keys(VAL).forEach(k => { TYPES[k] = { validate: VAL[k] }; BUILTIN[k] = 1; });
  V.registerType = function (typeId, spec) {
    if (!isS(typeId) || !typeId) return bad('typ', 'Typ-ID fehlt');
    if (!isO(spec) || typeof spec.validate !== 'function') return bad('typ', 'validate(data) fehlt');
    if (TYPES[typeId]) return bad('typ', 'Typ ' + typeId + ' ist schon vergeben');
    TYPES[typeId] = { validate: spec.validate }; return { ok: true };
  };
  V.types = () => Object.keys(TYPES);
  V.validate = (type, data) => runValidate(type, data);
  function runValidate(type, data) {
    const t = TYPES[type]; if (!t) return ['Typ unbekannt: ' + type];
    try { const r = t.validate(data); return isA(r) ? r.map(String) : []; } catch (e) { return ['Daten nicht prüfbar: ' + msgOf(e)]; }
  }

  /* ====================================================================== Registry */
  const P = {}, ADAPTERS = {};
  const EVT = { change: [] };
  V.on = function (ev, fn) { if (EVT[ev] && typeof fn === 'function') EVT[ev].push(fn); };
  V.off = function (ev, fn) { if (EVT[ev]) EVT[ev] = EVT[ev].filter(f => f !== fn); };
  function emit(ev, arg) { (EVT[ev] || []).slice().forEach(f => { try { f(arg); } catch (e) { /* Hörer darf nichts kaputt machen */ } }); }
  try { if (root && typeof root.addEventListener === 'function' && root.document) root.addEventListener('storage', e => { if (e && isS(e.key) && e.key.indexOf('verbund.') === 0) emit('change', { pid: (e.key.split('.')[1] || null), ext: true }); }); } catch (e) { /* Node */ }

  const LEVELS = { 1: { name: 'Einsteiger', pass: 70, tolMul: 1.5, f: 1 }, 2: { name: 'Standard', pass: 80, tolMul: 1, f: 1.25 }, 3: { name: 'Profi', pass: 90, tolMul: 0.6, f: 1.5 } };
  const lvl = l => (l === 1 || l === 3 ? l : 2);
  function levelCfg(def, level) {
    level = lvl(level); const d = LEVELS[level], o = def && def.levels && def.levels[level];
    return { level, name: (o && o.name) || d.name, pass: o && isN(o.pass) ? o.pass : d.pass, tolMul: o && isN(o.tolMul) ? o.tolMul : d.tolMul, f: d.f };
  }
  V.levelCfg = (pid, level) => (P[pid] ? levelCfg(P[pid], level) : null);
  const stNeeds = (def, s) => (isA(s.needs) ? s.needs : (s.in || []).map(sl => producer(def, sl)).filter(Boolean));
  const stIdx = (def, sid) => def.stations.findIndex(s => s.id === sid);
  function producer(def, slot) { const s = def.stations.find(x => x.out === slot); return s ? s.id : null; }

  function checkDef(def, opts) {
    const errs = [], warns = [];
    if (!isO(def)) return { errs: ['Projektdefinition fehlt'], warns };
    if (!isS(def.id) || !/^[a-z][a-z0-9]*$/.test(def.id)) errs.push('Projekt-ID ungültig (a-z0-9, Beginn Buchstabe)');
    if (!isS(def.name) || !def.name) errs.push('Projektname fehlt');
    if (!isS(def.prefix) || !/^v[a-z]$/.test(def.prefix)) errs.push('Präfix muss v plus Buchstabe sein (z. B. vg)');
    if (def.id && P[def.id] && !(opts && opts.replace)) errs.push('doppelte Projekt-ID: ' + def.id);
    if (isS(def.prefix) && !(opts && opts.replace)) Object.keys(P).forEach(k => { if (P[k].prefix === def.prefix && k !== def.id) errs.push('Präfix ' + def.prefix + ' gehört schon zu Projekt ' + k); });
    if (def.levels !== undefined) {
      if (!isO(def.levels)) errs.push('levels muss ein Objekt sein');
      else Object.keys(def.levels).forEach(k => { const l = def.levels[k]; if (!/^[123]$/.test(k)) errs.push('Stufe ' + k + ' unbekannt'); else if (!isO(l) || (l.pass !== undefined && !(isN(l.pass) && l.pass > 0 && l.pass <= 100)) || (l.tolMul !== undefined && !(isN(l.tolMul) && l.tolMul > 0))) errs.push('Stufe ' + k + ': pass (1..100) und tolMul (>0) prüfen'); });
    }
    if (typeof def.lastenheft !== 'function') errs.push('lastenheft(seed, level) fehlt');
    if (!isO(def.final) || !isS(def.final.id) || !def.final.id || typeof def.final.check !== 'function') errs.push('final { id, check } fehlt');
    else if (isS(def.prefix) && def.final.id !== def.prefix + 'F') errs.push('final.id muss ' + def.prefix + 'F heißen');
    if (!isA(def.stations) || !def.stations.length) { errs.push('Stationsliste fehlt'); return { errs, warns }; }
    const ids = new Set(), outs = new Set(); let direct = 0, total = 0;
    const others = new Set(); Object.keys(P).forEach(k => { if (k !== def.id) P[k].stations.forEach(s => others.add(s.id)); });
    def.stations.forEach((s, i) => {
      const w = 'Station ' + (i + 1) + (s && s.id ? ' (' + s.id + ')' : '');
      if (!isO(s)) { errs.push(w + ': kein Objekt'); return; }
      if (!isS(s.id) || !/^v[a-z][0-9]+$/.test(s.id) || (isS(def.prefix) && s.id.indexOf(def.prefix) !== 0)) errs.push(w + ': ID muss <Präfix><Nummer> sein');
      else if (ids.has(s.id) || others.has(s.id)) errs.push(w + ': doppelte Stations-ID');
      ids.add(s.id);
      if (s.lab !== 'vb') errs.push(w + ': lab muss "vb" sein');
      if (!isS(s.cat) || !s.cat) errs.push(w + ': cat fehlt');
      if (!isS(s.title) || !s.title) errs.push(w + ': title fehlt');
      if (!(isI(s.level) && s.level >= 1 && s.level <= 9)) errs.push(w + ': level muss eine Ziffer sein');
      if (!isS(s.on) || !s.on) errs.push(w + ': on (Lab) fehlt');
      if (!isS(s.type) || !TYPES[s.type]) errs.push(w + ': Typ unbekannt (' + s.type + ')');
      if (!isS(s.out) || s.out.indexOf((def.id || '?') + '.') !== 0 || !/^[a-z0-9]+\.[a-z0-9_]+$/.test(s.out)) errs.push(w + ': out muss <Projekt>.<name> sein');
      else if (s.out === def.id + '.lastenheft' || outs.has(s.out)) errs.push(w + ': Ausgangs-Slot ' + s.out + ' doppelt oder reserviert');
      if (typeof s.check !== 'function') errs.push(w + ': check(data, ctx) fehlt');
      if (s.in !== undefined && !isA(s.in)) errs.push(w + ': in muss eine Liste sein');
      if (s.w !== undefined && !(isN(s.w) && s.w > 0)) errs.push(w + ': Gewicht w muss > 0 sein');
      if (s.pass !== undefined && s.pass !== null && !(isN(s.pass) && s.pass > 0 && s.pass <= 100)) errs.push(w + ': pass 1..100 oder null');
      const ins = s.in || []; let early = 0;
      ins.forEach(sl => {
        if (sl === def.id + '.lastenheft') return;
        const p = def.stations.findIndex(x => x.out === sl);
        if (p < 0) errs.push(w + ': Eingang ' + sl + ' wird von keiner Station erzeugt');
        else if (p >= i) errs.push(w + ': Eingang ' + sl + ' kommt nicht von einer früheren Station');
        else { early++; if (p === i - 1) direct++; }
      });
      if (i > 0) { total++; if (!early) errs.push(w + ': braucht mindestens einen Eingang aus einer früheren Station'); }
      if (isA(s.needs)) s.needs.forEach(n => { const p = def.stations.findIndex(x => x.id === n); if (p < 0 || p >= i) errs.push(w + ': needs ' + n + ' nicht früher'); });
      if (!isA(s.hint) || s.hint.length !== 3 || !s.hint.every(h => isS(h) && h)) warns.push(w + ': hint soll drei nichtleere Stufen haben');
      if (typeof s.starter !== 'function') warns.push(w + ': starter fehlt');
      if (typeof s.solution !== 'function') warns.push(w + ': solution fehlt');
      if (isS(s.out)) outs.add(s.out);
    });
    return { errs, warns, graph: { direct, total } };
  }
  V.registerProject = function (def, opts) {
    try {
      const r = checkDef(def, opts);
      if (r.errs.length) return { ok: false, err: 'definition', msg: r.errs[0], errs: r.errs, warns: r.warns };
      P[def.id] = def;
      return { ok: true, id: def.id, errs: [], warns: r.warns, graph: r.graph };
    } catch (e) { return bad('definition', msgOf(e), { errs: [msgOf(e)], warns: [] }); }
  };
  V.projects = () => Object.keys(P).map(k => P[k]).sort((a, b) => (a.order || 99) - (b.order || 99) || (a.id < b.id ? -1 : 1)).map(d => ({ id: d.id, name: d.name, icon: d.icon || '', stations: d.stations.length, labs: isA(d.labs) ? d.labs.slice() : Array.from(new Set(d.stations.map(s => s.on))) }));
  V.project = pid => P[pid] || null;
  V.registerAdapter = function (labId, adapter) {
    if (!isS(labId) || !labId) return bad('adapter', 'Lab-ID fehlt');
    if (!isO(adapter) || typeof adapter.apply !== 'function' || typeof adapter.collect !== 'function') return bad('adapter', 'Adapter braucht apply() und collect()');
    ADAPTERS[labId] = adapter; return { ok: true };
  };
  V.adapter = labId => ADAPTERS[labId] || null;
  V.adapters = () => Object.keys(ADAPTERS);

  /* ====================================================================== Slots, Namen, Schlüssel */
  const skey = pid => 'verbund.' + pid;
  const slotKey = (pid, name) => 'verbund.' + pid + '.s.' + name;
  function activeNow() {
    try { const a = ss().getItem('verbund.active'); if (!isS(a)) return null; const i = a.indexOf(':'); if (i < 1) return null; return { pid: a.slice(0, i), sid: a.slice(i + 1) }; } catch (e) { return null; }
  }
  function splitSlot(slot) {
    if (!isS(slot) || !slot) return null;
    let pid, name; const i = slot.indexOf('.');
    if (i < 0) { const a = activeNow(); if (!a) return null; pid = a.pid; name = slot; } else { pid = slot.slice(0, i); name = slot.slice(i + 1); }
    if (!/^[a-z][a-z0-9]*$/.test(pid) || !/^[a-z0-9_]+$/.test(name)) return null;
    return { pid, name, full: pid + '.' + name };
  }
  const qual = (pid, n) => (isS(n) && n.indexOf('.') > 0 ? n : pid + '.' + n);
  V.setActive = function (pid, sid) { try { ss().setItem('verbund.active', pid + ':' + sid); return true; } catch (e) { return false; } };
  V.active = () => activeNow();
  V.clearActive = function () { try { ss().removeItem('verbund.active'); } catch (e) { /* egal */ } };
  V.isApplied = (pid, sid) => { try { return ss().getItem('verbund.applied.' + pid + '.' + sid) === '1'; } catch (e) { return false; } };
  V.markApplied = (pid, sid) => { try { ss().setItem('verbund.applied.' + pid + '.' + sid, '1'); return true; } catch (e) { return false; } };

  const state = pid => { const s = jget(skey(pid), null); return isO(s) && isO(s.stations) ? s : null; };
  const saveState = (pid, s) => jset(skey(pid), s);
  V.state = guard(pid => (isS(pid) ? state(pid) : null), null);

  function envBuild(slot, type, pid, station, from, stt, inputs, data, t) {
    const env = { app: 'tonfunk-verbund', v: 1, slot, type, pid, station: station || null, from, level: stt.level, seed: stt.seed, name: stt.name, t, ver: verText(), inputs: inputs || {}, data };
    env.sum = V.fnv(V.canon({ slot, type, pid, seed: stt.seed, data }));
    return env;
  }
  V.getEnvelope = guard(function (slot) { const s = splitSlot(slot); if (!s) return null; const e = jget(slotKey(s.pid, s.name), null); return isO(e) ? e : null; }, null);
  V.get = guard(function (slot) { const e = V.getEnvelope(slot); return e && e.data !== undefined ? e.data : null; }, null);
  V.has = guard(function (slot) { const s = splitSlot(slot); return !!s && sget(slotKey(s.pid, s.name)) !== null; }, false);
  V.slots = guard(function (pid) {
    const pre = slotKey(pid, ''), out = [];
    keysOf(pre).forEach(k => { const e = jget(k, null); if (isO(e)) out.push({ slot: e.slot || pid + '.' + k.slice(pre.length), type: e.type, from: e.from, station: e.station, sum: e.sum, t: e.t }); });
    return out.sort((a, b) => (a.slot < b.slot ? -1 : 1));
  }, () => []);
  V.usage = guard(function (pid) {
    let bytes = 0, slots = 0;
    keysOf('verbund.' + pid).forEach(k => { if (k !== 'verbund.' + pid && k.indexOf('verbund.' + pid + '.') !== 0) return; const v = sget(k); bytes += (v ? v.length : 0) + k.length; if (k.indexOf('.s.') > 0) slots++; });
    return { bytes, slots };
  }, () => ({ bytes: 0, slots: 0 }));
  V.spec = guard(function (pid) { const d = V.get(pid + '.lastenheft'); return d && isO(d.params) ? d.params : null; }, null);

  V.verify = guard(function (env, opts) {
    const errs = [];
    if (!isO(env)) return { ok: false, errs: ['Hülle fehlt oder ist kein Objekt'] };
    if (env.app !== 'tonfunk-verbund') errs.push('Das ist keine Verbund-Hülle');
    if (env.v !== 1) errs.push('Version der Hülle nicht unterstützt');
    const s = splitSlot(env.slot);
    if (!s) errs.push('Slot-Name ungültig');
    if (!isS(env.type) || !TYPES[env.type]) errs.push('Typ unbekannt: ' + env.type);
    if (s && env.pid !== s.pid) errs.push('Projekt passt nicht zum Slot');
    if (!isN(env.seed)) errs.push('seed fehlt');
    if (env.data === undefined) errs.push('Daten fehlen');
    if (!isS(env.sum) || !/^[0-9a-f]{8}$/.test(env.sum)) errs.push('Prüfsumme fehlt');
    if (!errs.length) {
      if (V.fnv(V.canon({ slot: env.slot, type: env.type, pid: env.pid, seed: env.seed, data: env.data })) !== env.sum) errs.push('Prüfsumme falsch (Daten verändert oder beim Teilen beschädigt)');
      const stt = state(env.pid);
      if (stt && stt.seed !== env.seed) errs.push('gehört zu einem anderen Lastenheft');
      if (!(opts && opts.shallow)) runValidate(env.type, env.data).slice(0, 3).forEach(x => errs.push('Daten: ' + x));
    }
    return { ok: !errs.length, errs };
  }, e => ({ ok: false, errs: [msgOf(e)] }));

  /* ====================================================================== Start, Zustand, Status */
  function newEntry() { return { pct: 0, best: 0, passed: false, tries: 0, hints: 0, t: 0, out: null, sum: null, inputs: {}, stale: false, assisted: false }; }
  const normName = n => (isS(n) ? n.replace(/\s+/g, ' ').trim() : '');
  V.start = guard(function (pid, o) {
    o = o || {};
    const def = P[pid]; if (!def) return bad('projekt', 'Projekt unbekannt: ' + pid);
    const name = normName(o.name) || lsName();
    if (!name) return bad('name', 'Bitte Namen oder Teamnamen eingeben');
    if (name.length > 60) return bad('name', 'Name ist zu lang (höchstens 60 Zeichen)');
    const level = o.level === undefined ? 2 : o.level;
    if (!(level === 1 || level === 2 || level === 3)) return bad('stufe', 'Stufe muss 1, 2 oder 3 sein');
    if (state(pid) && !o.again) return bad('laeuft', 'Dieses Projekt läuft schon (Zurücksetzen oder neu starten bestätigen)');
    const seed = V.hash(name + '|' + pid + '|' + level);
    let lh; try { lh = def.lastenheft(seed, level); } catch (e) { return bad('lastenheft', 'Lastenheft nicht erzeugbar: ' + msgOf(e)); }
    if (!isO(lh) || !isO(lh.params) || !isA(lh.text)) return bad('lastenheft', 'Lastenheft hat kein params/text');
    const stt = { v: 1, id: pid, name, level, seed, t0: now(), t1: null, dev: Math.random().toString(36).slice(2, 8), stations: {}, final: null, points: 0, badges: [], log: [] };
    const data = clone({ pid, level, seed, name, params: lh.params, text: lh.text, io: lh.io });
    if (data.io === undefined) delete data.io;
    const errs = runValidate('lastenheft', data);
    if (errs.length) return bad('lastenheft', 'Lastenheft ungültig: ' + errs[0]);
    const env = envBuild(pid + '.lastenheft', 'lastenheft', pid, null, 'hub', stt, {}, data, stt.t0);
    const key = slotKey(pid, 'lastenheft'), prev = sget(key);
    if (!sset(key, JSON.stringify(env))) return bad('speicher', 'Speicher voll: Projekt als Datei sichern, alte Platinen/Programme löschen');
    if (!saveState(pid, stt)) { if (prev === null) sdel(key); else sset(key, prev); return bad('speicher', 'Speicher voll: Projekt als Datei sichern, alte Platinen/Programme löschen'); }
    if (o.again) { keysOf(slotKey(pid, '')).forEach(k => { if (k !== key) sdel(k); }); }
    const prefs = jget('verbund.prefs', {}); if (isO(prefs)) { prefs.lastPid = pid; jset('verbund.prefs', prefs); }
    emit('change', { pid });
    return { ok: true, state: stt };
  }, e => bad('intern', msgOf(e)));

  /* alle Stationen auswerten: Zustand, Stale, Sperre */
  function evalStations(def, stt) {
    const L = levelCfg(def, stt.level), fr = free(), list = [], by = {};
    def.stations.forEach((s, i) => {
      const e = stt.stations[s.id] || null, limit = isN(s.pass) ? s.pass : L.pass;
      const delivered = !!(e && e.out && e.sum && sget(slotKey(def.id, e.out.slice(def.id.length + 1))) !== null);
      let stale = false;
      if (delivered) {
        (s.in || []).forEach(sl => {
          const p = producer(def, sl); if (!p) return;
          const pr = by[p], cur = pr && pr.delivered ? stt.stations[p].sum : null, rec = e.inputs ? e.inputs[sl] : null;
          if ((rec || null) !== (cur || null)) stale = true;
        });
        stNeeds(def, s).forEach(n => { if (by[n] && (by[n].stale || !by[n].delivered)) stale = true; });
      }
      let state, pct = 0;
      if (delivered) { pct = e.pct; state = stale ? 'stale' : (pct >= limit ? 'passed' : 'failed'); }
      else { const nd = stNeeds(def, s); state = (!nd.length || fr || nd.every(n => by[n] && by[n].state === 'passed')) ? 'open' : 'locked'; }
      const row = { id: s.id, on: s.on, title: s.title, cat: s.cat, state, pct, best: e ? e.best : 0, stale, hints: e ? e.hints : 0, locked: state === 'locked', tries: e ? e.tries : 0, assisted: !!(e && e.assisted), out: s.out, w: isN(s.w) ? s.w : 100, pass: limit, delivered, index: i };
      list.push(row); by[s.id] = row;
    });
    return { list, by, L };
  }
  function finalInfo(def, stt, ev) {
    const all = ev.list.every(r => r.state === 'passed'), fr = free(), f = stt.final;
    if (f) {
      const outs = {}; ev.list.forEach(r => { outs[r.out] = stt.stations[r.id] ? stt.stations[r.id].sum : null; });
      const same = isO(f.inputs) && Object.keys(outs).every(k => (f.inputs[k] || null) === (outs[k] || null));
      const anyStale = ev.list.some(r => r.stale || !r.delivered);
      if (anyStale || !same) return { state: 'stale', pct: f.pct };
      return { state: f.ok ? 'passed' : 'failed', pct: f.pct };
    }
    const ready = all || (fr && ev.list.every(r => r.delivered));
    return { state: ready ? 'open' : 'locked', pct: 0 };
  }
  function pointsOf(def, stt, ev, fin) {
    const f = ev.L.f; let got = 0, max = 0;
    ev.list.forEach(r => { got += (r.delivered ? r.pct : 0) / 100 * r.w; max += r.w; });
    const fw = isN(def.final.w) ? def.final.w : 200; max += fw; if (stt.final && fin.state !== 'locked') got += (stt.final.pct || 0) / 100 * fw;
    return { points: Math.round(got * f), maxPoints: Math.round(max * f) };
  }
  function medalOf(p, fin) { if (fin.state !== 'passed' || !p.maxPoints) return null; const r = p.points / p.maxPoints; return r >= 0.95 ? 'gold' : r >= 0.8 ? 'silber' : r >= 0.6 ? 'bronze' : null; }
  V.status = guard(function (pid) {
    const def = P[pid], stt = def && state(pid); if (!def) return null; if (!stt) return null;
    const ev = evalStations(def, stt), fin = finalInfo(def, stt, ev), p = pointsOf(def, stt, ev, fin);
    const done = ev.list.filter(r => r.state === 'passed').length, total = ev.list.length;
    return { id: pid, name: stt.name, level: stt.level, stations: ev.list, done, total, pct: Math.round(100 * (done + (fin.state === 'passed' ? 1 : 0)) / (total + 1)), finalState: fin.state, finalPct: fin.pct, finalId: def.final.id, points: p.points, maxPoints: p.maxPoints, medal: medalOf(p, fin), demo: !!stt.demo, team: !!stt.team };
  }, null);
  V.next = guard(function (pid) {
    const s = V.status(pid); if (!s) return null;
    const r = s.stations.find(x => x.state !== 'passed' && x.state !== 'locked');
    if (r) return r.id;
    if (s.stations.every(x => x.state === 'passed') && s.finalState !== 'passed') return 'final';
    return null;
  }, null);

  /* gespeicherten Zustand an die Wirklichkeit angleichen (Stale-Flags, Punkte, Abzeichen) */
  function refresh(def, stt) {
    const ev = evalStations(def, stt);
    ev.list.forEach(r => { const e = stt.stations[r.id]; if (e) e.stale = r.stale; });
    const fin = finalInfo(def, stt, ev), p = pointsOf(def, stt, ev, fin);
    stt.points = p.points;
    if (!stt.demo) stt.badges = badgeIds(def, stt, ev, fin, p);
    return { ev, fin, p };
  }

  /* ====================================================================== Abzeichen */
  function projFlags(pid) {
    const def = P[pid], stt = def && state(pid); if (!stt || stt.demo) return null;
    const ev = evalStations(def, stt), fin = finalInfo(def, stt, ev), p = pointsOf(def, stt, ev, fin);
    return { def, stt, ev, fin, p };
  }
  function badgeIds(def, stt, ev, fin, p) {
    const ids = [], X = def.id, passed = ev.list.filter(r => r.state === 'passed').length;
    if (ev.list.some(r => r.delivered)) ids.push('vb_' + X + '_start');
    if (passed >= Math.ceil(ev.list.length / 2)) ids.push('vb_' + X + '_halb');
    if (fin.state === 'passed') ids.push('vb_' + X + '_fertig');
    if (medalOf(p, fin) === 'gold') ids.push('vb_' + X + '_gold');
    return ids;
  }
  function globalStats() {
    let fertig = 0, profi = false, ohne = false, uebergaben = 0, team = false, gestartet = 0, gold = 0;
    Object.keys(P).forEach(k => {
      const f = projFlags(k); if (!f) return;
      if (f.ev.list.some(r => r.delivered)) gestartet++;
      f.ev.list.forEach(r => { uebergaben += r.tries; });
      if (f.stt.team) team = true;
      if (f.fin.state === 'passed') {
        fertig++; if (f.stt.level === 3) profi = true;
        if (f.stt.level >= 2 && !f.ev.list.some(r => r.hints > 0 || r.assisted)) ohne = true;
        if (medalOf(f.p, f.fin) === 'gold') gold++;
      }
    });
    return { fertig, profi, ohne, uebergaben, team, gestartet, gold };
  }
  V.badges = guard(function (pid) {
    const f = projFlags(pid); if (!f) return [];
    const ids = badgeIds(f.def, f.stt, f.ev, f.fin, f.p), g = globalStats();
    if (g.fertig >= 2) ids.push('vb_zwei'); if (g.fertig >= 5) ids.push('vb_alle'); if (g.profi) ids.push('vb_profi');
    if (g.ohne) ids.push('vb_ohnehilfe'); if (g.uebergaben >= 10) ids.push('vb_uebergabe'); if (g.team) ids.push('vb_team');
    return ids;
  }, () => []);
  function pushStats(pid, countDeliver) {
    try {
      const B = root && root.Badges; if (!B || typeof B.stat !== 'function') return;
      const g = globalStats(), f = projFlags(pid);
      B.stat('vbstart', g.gestartet, 'max');
      if (countDeliver) B.stat('vbuebergabe', 1);
      if (f && f.fin.state === 'passed') { B.stat('vb' + pid, 1, 'max'); B.stat('vbfertig', g.fertig, 'max'); if (g.profi) B.stat('vbprofi', 1, 'max'); if (g.gold) B.stat('vbgold', 1, 'max'); }
    } catch (e) { /* Abzeichen sind nie kritisch */ }
  }

  /* ====================================================================== Prüfung */
  function slotMap(pid) {
    const m = {};
    keysOf(slotKey(pid, '')).forEach(k => { const e = jget(k, null); if (isO(e) && e.data !== undefined) { const n = k.slice(slotKey(pid, '').length); m[n] = e.data; m[pid + '.' + n] = e.data; } });
    return m;
  }
  function ctxFor(pid, sid) {
    const def = P[pid], stt = state(pid), L = levelCfg(def, stt ? stt.level : 2);
    const ctx = { pid, sid, level: L.level, tol: L.tolMul, spec: V.spec(pid) || {}, station: def.stations.find(s => s.id === sid) || null, V, get: n => V.get(qual(pid, n)) };
    let cache = null; Object.defineProperty(ctx, 'slots', { get() { return cache || (cache = slotMap(pid)); }, enumerable: true });
    return ctx;
  }
  V.ctx = guard(function (pid, sid) { return P[pid] && state(pid) ? ctxFor(pid, sid) : null; }, null);
  function normLines(raw) {
    const arr = isA(raw) ? raw : (isO(raw) && isA(raw.lines) ? raw.lines : []);
    return arr.filter(isO).map(l => { const max = isN(l.pts) && l.pts > 0 ? l.pts : 0, ok = !!l.ok; return { ok, text: String(l.text === undefined ? '' : l.text), pts: ok ? max : 0, max }; });
  }
  const pctOf = lines => { const tot = lines.reduce((a, l) => a + l.max, 0), got = lines.reduce((a, l) => a + l.pts, 0); return tot > 0 ? Math.round(100 * got / tot) : 0; };
  function checkStation(def, stt, station, data) {
    const L = levelCfg(def, stt.level), limit = isN(station.pass) ? station.pass : L.pass, pid = def.id;
    const inputs = [], auto = []; let missing = false;
    (station.in || []).forEach(sl => {
      const p = producer(def, sl), pi = p ? stIdx(def, p) + 1 : '?', lab = p ? def.stations[pi - 1].on : '?', has = V.has(sl);
      inputs.push({ slot: sl, ok: has, station: p });
      if (has) auto.push({ ok: true, text: 'Eingang übernommen: ' + sl + ' (Station ' + pi + ', ' + lab + ')', pts: 0, max: 0 });
      else { missing = true; auto.push({ ok: false, text: 'Eingang fehlt: ' + sl + ' (Station ' + pi + ', ' + lab + ')', pts: 0, max: 0 }); }
    });
    if (missing) return { ok: true, passed: false, pct: 0, lines: auto, inputs, limit };
    const errs = runValidate(station.type, data);
    if (errs.length) return { ok: true, passed: false, pct: 0, lines: auto.concat(errs.slice(0, 4).map(t => ({ ok: false, text: 'Daten ungültig: ' + t, pts: 0, max: 0 }))), inputs, limit };
    let lines;
    try { lines = normLines(station.check(data, ctxFor(pid, station.id))); } catch (e) { lines = [{ ok: false, text: 'Prüfung abgebrochen: ' + msgOf(e), pts: 0, max: 100 }]; }
    const pct = pctOf(lines);
    return { ok: true, passed: pct >= limit, pct, lines: auto.concat(lines), inputs, limit };
  }
  V.check = guard(function (pid, sid, data) {
    const def = P[pid]; if (!def) return bad('projekt', 'Projekt unbekannt');
    const stt = state(pid); if (!stt) return bad('nostart', 'Projekt nicht gestartet');
    if (sid === 'final' || sid === def.final.id) { const f = V.final(pid); return { ok: f.err !== 'intern', passed: !!f.ok, pct: f.pct, lines: f.lines, inputs: [] }; }
    const station = def.stations.find(s => s.id === sid); if (!station) return bad('station', 'Station unbekannt: ' + sid);
    if (data === undefined) { const env = V.getEnvelope(station.out); if (!env) return bad('keinslot', 'Noch nichts übergeben für ' + station.out); data = env.data; }
    return checkStation(def, stt, station, data);
  }, e => bad('intern', msgOf(e)));

  function kpiList(raw) { return (isA(raw) ? raw : []).filter(isO).map(k => ({ key: String(k.key === undefined ? '' : k.key), label: String(k.label === undefined ? '' : k.label), value: k.value === undefined ? null : k.value, unit: isS(k.unit) ? k.unit : '', ok: k.ok === undefined ? true : !!k.ok })); }
  V.final = guard(function (pid, o) {
    const def = P[pid]; if (!def) return bad('projekt', 'Projekt unbekannt', { pct: 0, lines: [], kpis: [] });
    const stt = state(pid); if (!stt) return bad('nostart', 'Projekt nicht gestartet', { pct: 0, lines: [], kpis: [] });
    const ev = evalStations(def, stt), L = ev.L, limit = isN(def.final.pass) ? def.final.pass : L.pass;
    const ready = ev.list.every(r => r.state === 'passed') || (free() && ev.list.every(r => r.delivered));
    if (!ready) { const miss = ev.list.filter(r => r.state !== 'passed').map(r => r.id).join(', '); return { ok: false, passed: false, pct: 0, lines: [{ ok: false, text: 'Gesamttest gesperrt: erst alle Stationen bestehen (offen: ' + miss + ')', pts: 0, max: 0 }], kpis: [], err: 'gesperrt', msg: 'Gesamttest gesperrt' }; }
    let lines, kpis = [];
    try { const ctx = ctxFor(pid, def.final.id), r = def.final.check(ctx.slots, ctx.spec, stt.level, ctx); lines = normLines(r); kpis = kpiList(r && r.kpis); } catch (e) { lines = [{ ok: false, text: 'Gesamttest abgebrochen: ' + msgOf(e), pts: 0, max: 100 }]; }
    const pct = pctOf(lines), ok = pct >= limit, res = { ok, passed: ok, pct, lines, kpis };
    if (o && o.save) {
      const outs = {}; ev.list.forEach(r => { outs[r.out] = stt.stations[r.id].sum; });
      stt.final = { pct, ok, t: now(), kpis, inputs: outs };
      if (ok && !stt.t1) stt.t1 = now();
      refresh(def, stt);
      if (!saveState(pid, stt)) return bad('speicher', 'Speicher voll: Ergebnis nicht gespeichert', { pct, lines, kpis });
      if (!stt.demo) { mapMax('lm4.tdone', def.final.id, pct); pushStats(pid, false); }
      emit('change', { pid });
    }
    return res;
  }, e => bad('intern', msgOf(e), { pct: 0, lines: [], kpis: [] }));

  /* ====================================================================== Übergabe */
  V.deliver = guard(function (slot, payload, opts) {
    opts = opts || {};
    const s = splitSlot(slot); if (!s) return bad('slot', 'Slot-Name ungültig');
    const def = P[s.pid]; if (!def) return bad('projekt', 'Projekt unbekannt: ' + s.pid);
    const stt = state(s.pid); if (!stt) return bad('nostart', 'Projekt nicht gestartet');
    const station = def.stations.find(x => x.out === s.full); if (!station) return bad('slot', 'Slot ' + s.full + ' gehört zu keiner Station');
    if (!isO(payload)) return bad('payload', 'Übergabe braucht { type, data }');
    if (payload.station !== undefined && payload.station !== null && payload.station !== station.id) return bad('station', 'Die Daten gehören zu Station ' + payload.station + ', nicht zu ' + station.id);
    if (payload.type !== station.type) return bad('typ', 'Falscher Datentyp: erwartet ' + station.type + ', geliefert ' + payload.type);
    const errs = runValidate(station.type, payload.data);
    if (errs.length) return bad('validate', 'Daten ungültig: ' + errs[0], { errs });
    let data; try { data = JSON.parse(JSON.stringify(payload.data)); } catch (e) { return bad('daten', 'Daten nicht speicherbar (Zyklus oder zu tief verschachtelt)'); }
    if (data === undefined) return bad('daten', 'Daten fehlen');
    const ev = evalStations(def, stt), row = ev.by[station.id];
    if (row.state === 'locked') return bad('gesperrt', 'Station ' + (row.index + 1) + ' ist noch gesperrt: erst die Stationen davor bestehen');
    const inputs = {}; (station.in || []).forEach(sl => { const p = producer(def, sl), pe = p && stt.stations[p]; inputs[sl] = pe && pe.sum && ev.by[p].delivered ? pe.sum : null; });
    const t = now(), env = envBuild(s.full, station.type, s.pid, station.id, isS(payload.from) ? payload.from : station.on, stt, inputs, data, t);
    const key = slotKey(s.pid, s.name), prev = sget(key);
    if (!sset(key, JSON.stringify(env))) return bad('speicher', 'Speicher voll: Projekt als Datei sichern, alte Platinen/Programme löschen');
    const old = stt.stations[station.id], backup = old ? clone(old) : null, oldFinal = stt.final, oldDemo = stt.demo, oldLog = stt.log.slice();
    const r = checkStation(def, stt, station, data);
    const e = stt.stations[station.id] || (stt.stations[station.id] = newEntry());
    e.pct = r.pct; e.best = Math.max(e.best || 0, r.pct); e.passed = r.passed; e.tries = (e.tries || 0) + 1; e.t = t; e.out = s.full; e.sum = env.sum; e.inputs = inputs; e.stale = false;
    if (opts.assisted) e.assisted = true;
    if (opts.demo) stt.demo = true;
    stt.log.push({ t, sid: station.id, pct: r.pct, passed: r.passed }); if (stt.log.length > 50) stt.log = stt.log.slice(-50);
    refresh(def, stt);
    if (!saveState(s.pid, stt)) {
      if (prev === null) sdel(key); else sset(key, prev);
      if (backup) stt.stations[station.id] = backup; else delete stt.stations[station.id]; stt.final = oldFinal; stt.demo = oldDemo; stt.log = oldLog;
      return bad('speicher', 'Speicher voll: Projekt als Datei sichern, alte Platinen/Programme löschen');
    }
    if (!stt.demo) { mapMax('lm4.tdone', station.id, r.pct); pushStats(s.pid, true); }
    emit('change', { pid: s.pid });
    return { ok: true, env, check: { pct: r.pct, passed: r.passed, lines: r.lines, inputs: r.inputs }, state: stt.stations[station.id].stale ? 'stale' : (r.passed ? 'passed' : 'failed') };
  }, e => bad('intern', msgOf(e)));

  /* ====================================================================== Tipps, Musterlösung */
  V.hint = guard(function (pid, sid) {
    const def = P[pid]; if (!def) return bad('projekt', 'Projekt unbekannt');
    const stt = state(pid); if (!stt) return bad('nostart', 'Projekt nicht gestartet');
    const station = def.stations.find(s => s.id === sid); if (!station) return bad('station', 'Station unbekannt: ' + sid);
    const ev = evalStations(def, stt); if (ev.by[sid].state === 'locked') return bad('gesperrt', 'Station ist noch gesperrt');
    const e = stt.stations[sid] || (stt.stations[sid] = newEntry());
    const step = Math.min(3, (e.hints || 0) + 1); e.hints = step;
    if (step >= 3) e.assisted = true;
    if (!saveState(pid, stt)) return bad('speicher', 'Speicher voll');
    if (!stt.demo) mapMax('sim.hints', sid, step);
    const text = isA(station.hint) && isS(station.hint[step - 1]) ? station.hint[step - 1] : '';
    emit('change', { pid });
    return { ok: true, step, text, solution: step >= 3 && typeof station.solution === 'function' };
  }, e => bad('intern', msgOf(e)));
  V.solution = guard(function (pid, sid) {
    const def = P[pid]; if (!def) return bad('projekt', 'Projekt unbekannt');
    const stt = state(pid); if (!stt) return bad('nostart', 'Projekt nicht gestartet');
    const station = def.stations.find(s => s.id === sid); if (!station) return bad('station', 'Station unbekannt: ' + sid);
    if (typeof station.solution !== 'function') return bad('keine', 'Für diese Station gibt es keine Musterlösung');
    const e = stt.stations[sid];
    if (!free() && !(e && e.hints >= 3)) return bad('tipp', 'Die Musterlösung gibt es erst nach Tipp-Stufe 3');
    const r = station.solution(ctxFor(pid, sid)), payload = isO(r) && isS(r.type) && r.data !== undefined ? r : { type: station.type, data: r };
    const ent = stt.stations[sid] || (stt.stations[sid] = newEntry()); ent.assisted = true; saveState(pid, stt);
    return { ok: true, type: payload.type, data: clone(payload.data) };
  }, e => bad('intern', msgOf(e)));
  /* Musterlösungen der Reihe nach übergeben (Ausbilder-Demo, Selbsttest); upTo = Stations-ID oder 'final' */
  V.demo = guard(function (pid, o) {
    o = o || {}; const def = P[pid]; if (!def) return bad('projekt', 'Projekt unbekannt');
    if (!state(pid) || o.again) { const r = V.start(pid, { name: o.name, level: o.level, again: !!o.again }); if (!r.ok) return r; }
    const upTo = o.upTo || 'final', done = [];
    for (let i = 0; i < def.stations.length; i++) {
      const s = def.stations[i];
      if (typeof s.solution !== 'function') return bad('keine', 'Musterlösung fehlt: ' + s.id, { done });
      const d = s.solution(ctxFor(pid, s.id)), p = isO(d) && isS(d.type) && d.data !== undefined ? d : { type: s.type, data: d };
      const r = V.deliver(s.out, p, { demo: o.demo !== false, assisted: true }); if (!r.ok) return Object.assign(r, { done });
      done.push(s.id); if (upTo === s.id) return { ok: true, done };
    }
    if (upTo === 'final') { const f = V.final(pid, { save: true }); return { ok: !!f.ok, done, final: f }; }
    return { ok: true, done };
  }, e => bad('intern', msgOf(e)));

  /* ====================================================================== Zurücksetzen */
  function snapshot(pid) { const slots = {}, pre = slotKey(pid, ''); keysOf(pre).forEach(k => { slots[k.slice(pre.length)] = sget(k); }); return { state: sget(skey(pid)), slots, t: now() }; }
  function wipe(pid) { keysOf(slotKey(pid, '')).forEach(sdel); sdel(skey(pid)); }
  V.reset = guard(function (pid, o) {
    o = o || {}; const def = P[pid]; if (!def) return bad('projekt', 'Projekt unbekannt');
    const stt = state(pid); if (!stt) return bad('nostart', 'Projekt nicht gestartet');
    const bakKey = skey(pid) + '.bak'; sdel(bakKey);
    if (!jset(bakKey, snapshot(pid))) { if (!o.force) return bad('speicher', 'Sicherung nicht möglich (Speicher voll): erst Projekt als Datei sichern oder mit force zurücksetzen'); }
    wipe(pid);
    try { const ss2 = ss(); ss2.removeItem('verbund.active'); def.stations.forEach(x => ss2.removeItem('verbund.applied.' + pid + '.' + x.id)); } catch (e) { /* egal */ }
    emit('change', { pid });
    if (o.keepName) return V.start(pid, { name: stt.name, level: stt.level });
    return { ok: true };
  }, e => bad('intern', msgOf(e)));
  V.restore = guard(function (pid) {
    const b = jget(skey(pid) + '.bak', null); if (!isO(b) || !isS(b.state)) return bad('keinbak', 'Keine Sicherung vorhanden');
    wipe(pid); if (!sset(skey(pid), b.state)) return bad('speicher', 'Speicher voll');
    Object.keys(b.slots || {}).forEach(n => { if (isS(b.slots[n])) sset(slotKey(pid, n), b.slots[n]); });
    emit('change', { pid }); return { ok: true };
  }, e => bad('intern', msgOf(e)));
  V.resetStation = guard(function (pid, sid) {
    const def = P[pid]; if (!def) return bad('projekt', 'Projekt unbekannt');
    const stt = state(pid); if (!stt) return bad('nostart', 'Projekt nicht gestartet');
    const station = def.stations.find(s => s.id === sid); if (!station) return bad('station', 'Station unbekannt: ' + sid);
    sdel(slotKey(pid, station.out.slice(pid.length + 1)));
    const e = stt.stations[sid]; if (e) { e.pct = 0; e.passed = false; e.out = null; e.sum = null; e.inputs = {}; e.stale = false; }
    refresh(def, stt); saveState(pid, stt); emit('change', { pid }); return { ok: true };
  }, e => bad('intern', msgOf(e)));

  /* ====================================================================== Teilen */
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function b64enc(b) {
    let s = '', i = 0;
    for (; i + 2 < b.length; i += 3) { const n = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2]; s += B64[n >> 18 & 63] + B64[n >> 12 & 63] + B64[n >> 6 & 63] + B64[n & 63]; }
    if (i + 1 === b.length) { const n = b[i] << 16; s += B64[n >> 18 & 63] + B64[n >> 12 & 63]; }
    else if (i + 2 === b.length) { const n = (b[i] << 16) | (b[i + 1] << 8); s += B64[n >> 18 & 63] + B64[n >> 12 & 63] + B64[n >> 6 & 63]; }
    return s;
  }
  function b64dec(s) {
    if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) throw new Error('Code beschädigt (ungültige Zeichen)');
    const out = []; let acc = 0, bits = 0;
    for (let i = 0; i < s.length; i++) { acc = (acc << 6) | B64.indexOf(s[i]); bits += 6; if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); acc &= (1 << bits) - 1; } }
    return Uint8Array.from(out);
  }
  const MAXOUT = 16 * 1024 * 1024;
  async function readAll(stream) {
    const rd = stream.getReader(), parts = []; let n = 0;
    for (;;) { const r = await rd.read(); if (r.done) break; n += r.value.length; if (n > MAXOUT) throw new Error('Code zu groß'); parts.push(r.value); }
    const o = new Uint8Array(n); let p = 0; parts.forEach(x => { o.set(x, p); p += x.length; }); return o;
  }
  async function viaStream(kind, bytes) {
    const cs = new (kind === 'd' ? DecompressionStream : CompressionStream)('deflate-raw'), w = cs.writable.getWriter();
    w.write(bytes).catch(() => {}); w.close().catch(() => {});
    return readAll(cs.readable);
  }
  async function deflate(bytes) {
    try { if (typeof CompressionStream !== 'undefined') return await viaStream('c', bytes); } catch (e) { /* weiter */ }
    try { if (typeof require === 'function') return new Uint8Array(require('zlib').deflateRawSync(Buffer.from(bytes))); } catch (e) { /* weiter */ }
    return null;
  }
  async function inflate(bytes) {
    try { if (typeof DecompressionStream !== 'undefined') return await viaStream('d', bytes); } catch (e) { /* weiter */ }
    try { if (typeof require === 'function') return new Uint8Array(require('zlib').inflateRawSync(Buffer.from(bytes), { maxOutputLength: MAXOUT })); } catch (e) { /* weiter */ }
    throw new Error('Code beschädigt (nicht entpackbar)');
  }
  V.pack = async function (pid, o) {
    try {
      o = o || {}; const def = P[pid], stt = def && state(pid); if (!stt) return '';
      let names;
      if (o.station) { const s = def.stations.find(x => x.id === o.station); if (!s) return ''; names = [s.out]; }
      else if (isA(o.slots)) names = o.slots.map(n => qual(pid, n));
      else names = V.slots(pid).map(x => x.slot);
      const envs = names.map(n => V.getEnvelope(n)).filter(Boolean);
      const bundle = { app: 'tonfunk-verbund', v: 1, kind: 'bundle', pid, name: stt.name, level: stt.level, seed: stt.seed, t: now(), ver: verText(), dev: stt.dev || '', envs };
      const raw = utf8(JSON.stringify(bundle)), z = await deflate(raw);
      return z ? 'TFV1.' + b64enc(z) : 'TFV0.' + b64enc(raw);
    } catch (e) { return ''; }
  };
  V.unpack = async function (code) {
    try {
      if (!isS(code)) return bad('code', 'Kein Code');
      let c = code.replace(/\s+/g, ''); const h = c.indexOf('#v='); if (h >= 0) c = c.slice(h + 3);
      if (c.length > 24 * 1024 * 1024) return bad('code', 'Code zu groß');
      let bytes;
      if (c.indexOf('TFV1.') === 0) bytes = await inflate(b64dec(c.slice(5)));
      else if (c.indexOf('TFV0.') === 0) bytes = b64dec(c.slice(5));
      else return bad('code', 'Das ist kein Verbund-Code (TFV1. fehlt)');
      let b; try { b = JSON.parse(fromUtf8(bytes)); } catch (e) { return bad('code', 'Code beschädigt (Inhalt nicht lesbar)'); }
      if (!isO(b) || b.app !== 'tonfunk-verbund' || b.kind !== 'bundle' || b.v !== 1) return bad('code', 'Das ist kein Verbund-Paket');
      if (!isS(b.pid) || !isN(b.seed) || !isA(b.envs)) return bad('code', 'Paket unvollständig (Projekt, Seed, Daten)');
      const badl = []; b.envs.forEach((e, i) => { const r = V.verify(e, { shallow: true }); if (!r.ok) badl.push({ slot: isO(e) && isS(e.slot) ? e.slot : '#' + (i + 1), why: r.errs[0] }); });
      return Object.assign({ ok: true }, b, { bad: badl });
    } catch (e) { return bad('code', msgOf(e)); }
  };
  V.importBundle = guard(function (bundle, o) {
    o = o || {}; const mode = o.mode === 'replace' ? 'replace' : 'merge';
    if (!isO(bundle) || bundle.kind !== 'bundle' || !isA(bundle.envs)) return bad('bundle', 'Paket ungültig', { imported: [], rejected: [] });
    const def = P[bundle.pid]; if (!def) return bad('projekt', 'Projekt unbekannt: ' + bundle.pid, { imported: [], rejected: [] });
    const pid = def.id; let stt = state(pid);
    if (!stt) { const r = V.start(pid, { name: bundle.name, level: bundle.level }); if (!r.ok) return Object.assign(r, { imported: [], rejected: [] }); stt = r.state; }
    if (stt.seed !== bundle.seed) return bad('seed', 'gehört zu einem anderen Lastenheft', { imported: [], rejected: bundle.envs.map(e => ({ slot: isO(e) && e.slot, why: 'gehört zu einem anderen Lastenheft' })) });
    if (mode === 'replace') { keysOf(slotKey(pid, '')).forEach(k => { if (k !== slotKey(pid, 'lastenheft')) sdel(k); }); stt.stations = {}; stt.final = null; }
    const imported = [], rejected = [], skipped = [], sids = [];
    bundle.envs.forEach(env => {
      const slot = isO(env) && isS(env.slot) ? env.slot : '?';
      const v = V.verify(env); if (!v.ok) { rejected.push({ slot, why: v.errs[0] }); return; }
      if (env.pid !== pid) { rejected.push({ slot, why: 'gehört zu einem anderen Projekt' }); return; }
      if (slot === pid + '.lastenheft') { const cur = V.getEnvelope(slot); if (cur && cur.sum !== env.sum) rejected.push({ slot, why: 'Lastenheft weicht ab (andere Programmversion)' }); return; }
      const station = def.stations.find(x => x.out === slot);
      if (!station) { rejected.push({ slot, why: 'Slot gehört zu keiner Station' }); return; }
      if (env.type !== station.type) { rejected.push({ slot, why: 'Typ passt nicht zur Station' }); return; }
      const cur = V.getEnvelope(slot);
      if (mode === 'merge' && cur && !(isN(env.t) && env.t > cur.t)) { skipped.push(slot); return; }
      if (!sset(slotKey(pid, slot.slice(pid.length + 1)), JSON.stringify(env))) { rejected.push({ slot, why: 'Speicher voll' }); return; }
      imported.push(slot); sids.push(station.id);
      const e = stt.stations[station.id] || (stt.stations[station.id] = newEntry());
      e.out = slot; e.sum = env.sum; e.inputs = isO(env.inputs) ? env.inputs : {}; e.t = env.t; e.tries = Math.max(e.tries || 0, 1);
    });
    def.stations.forEach(s => {
      if (sids.indexOf(s.id) < 0) return;
      const e = stt.stations[s.id], env = V.getEnvelope(s.out);
      const r = checkStation(def, stt, s, env.data);
      e.pct = r.pct; e.best = Math.max(e.best || 0, r.pct); e.passed = r.passed;
      if (r.passed && bundle.dev && stt.dev && bundle.dev !== stt.dev) stt.team = true;
    });
    refresh(def, stt);
    if (!saveState(pid, stt)) return bad('speicher', 'Speicher voll', { imported, rejected, skipped });
    if (!stt.demo) { sids.forEach(id => mapMax('lm4.tdone', id, stt.stations[id].pct)); pushStats(pid, false); }
    emit('change', { pid });
    return { ok: !(rejected.length && !imported.length), imported, rejected, skipped };
  }, e => bad('intern', msgOf(e), { imported: [], rejected: [] }));
  V.link = code => 'verbund.html#v=' + code;
  V.qrOk = code => isS(code) && code.length < 2300;

  /* ====================================================================== Bericht, Zertifikat */
  V.certCode = guard(function (pid) {
    const def = P[pid], stt = def && state(pid); if (!stt) return '';
    const pcts = def.stations.map(s => (stt.stations[s.id] ? stt.stations[s.id].pct : 0)).join(',');
    return 'TFV-' + V.fnv([stt.name, pid, stt.level, pcts, stt.final ? stt.final.pct : 0].join('|'));
  }, '');
  const fmtV = v => (isN(v) ? String(Number(v.toPrecision(6))).replace('.', ',') : isA(v) ? v.map(fmtV).join(', ') : isO(v) ? Object.keys(v).map(k => k + ' ' + fmtV(v[k])).join('; ') : v === true ? 'ja' : v === false ? 'nein' : String(v));
  V.report = guard(function (pid) {
    const def = P[pid], stt = def && state(pid); if (!stt) return null;
    const s = V.status(pid), spec = V.spec(pid) || {}, lh = V.get(pid + '.lastenheft') || { text: [] };
    const sections = [];
    sections.push({ h: 'Lastenheft', head: ['Größe', 'Wert'], rows: Object.keys(spec).filter(k => k !== 'hidden' && !(isA(spec.hidden) && spec.hidden.indexOf(k) >= 0)).map(k => [k, fmtV(spec[k])]), text: isA(lh.text) ? lh.text.slice() : [] });
    sections.push({ h: 'Stationen', head: ['Station', 'Titel', 'Lab', 'Ergebnis', 'Stand', 'Versuche', 'Tipps'], rows: s.stations.map((r, i) => [(i + 1) + ' (' + r.id + ')', r.title, r.on, r.delivered ? r.pct + ' %' : '-', r.state, r.tries, r.hints]) });
    try { const c = ctxFor(pid, def.final.id); if (typeof def.report === 'function') { const x = def.report(c.slots, spec); if (isA(x)) x.filter(isO).forEach(sec => sections.push(sec)); } } catch (e) { sections.push({ h: 'Zusatzabschnitte', rows: [['Fehler', msgOf(e)]] }); }
    const fin = stt.final;
    sections.push({ h: 'Gesamttest', head: ['Ergebnis'], rows: fin ? [['Gesamttest', fin.pct + ' % (' + (fin.ok ? 'bestanden' : 'nicht bestanden') + ')']] : [['Gesamttest', 'noch nicht abgelegt']] });
    return { title: def.name + ' - Abschlussbericht', project: pid, name: stt.name, level: stt.level, levelName: levelCfg(def, stt.level).name, sections, kpis: fin && isA(fin.kpis) ? fin.kpis : [], cert: { code: V.certCode(pid), medal: s.medal, points: s.points, maxPoints: s.maxPoints, passed: s.finalState === 'passed' } };
  }, null);

  /* ====================================================================== Start: Registrierungswarteschlange */
  root.Verbund = V;
  /* Erweiterungen, die vor dem Kern geladen wurden (Ladereihenfolge egal): Netzlisten-Kern und Läufer hängen sich hier an */
  try { if (root.VerbundNL && root.VerbundNL.attach) root.VerbundNL.attach(V); if (root.VerbundRun && root.VerbundRun.attach) root.VerbundRun.attach(V); } catch (e) { /* egal */ }
  try { const q = root.VERBUND_QUEUE; if (isA(q)) { q.splice(0).forEach(d => V.registerProject(d)); } root.VERBUND_QUEUE = { push: d => V.registerProject(d) }; } catch (e) { /* egal */ }
  if (typeof module !== 'undefined' && module.exports) module.exports = V;
})(typeof window !== 'undefined' ? window : globalThis);
