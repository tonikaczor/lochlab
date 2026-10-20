'use strict';
/* Tonfunk Lab: Verbund-Läufer (Paket A1b). Führt Arduino-Sketche und Python-Programme ohne Browser-Oberfläche aus,
   damit Verbund-Prüfungen sie deterministisch nachrechnen können (D3: Rohdaten + Neuberechnung).
   - Verbund.runSketch(src, scenario)   Arduino-Kern (arduino.js) mit Prüf-io, virtuelle Zeit, Drift (ppm), Schritt- und Zeitlimit
   - Verbund.runPython(src, data, opts) Python-Kern (pyrun.js), Daten als `daten = [...]` im Kopf, Ausgabe als Zeilen / KEY=Wert
   - Verbund.mkMockIo(pins, script, opts) Prüf-io (Arduino oder Pi) mit Signalskripten und Ereignisprotokoll
   Alles läuft in Node und Browser. Keine Seiteneffekte außerhalb der Rückgabe, nichts wird geworfen (Fehler als { ok:false, error }).
   Abweichungen von der Spezifikation: quelle/verbund/ABWEICHUNGEN.md. */
(function (root) {

const LIMITS = { maxSteps: 5000000, maxMs: 3000, maxEvents: 200000 };

/* ---------- Kerne laden (erst beim Aufruf, Ladereihenfolge im Browser egal) ---------- */
function load(name, glob, file) {
  if (root[glob]) return root[glob];
  try { if (typeof require === 'function') return require('./' + file); } catch (e) { /* nicht vorhanden */ }
  return null;
}
const getAR = () => load('Arduino', 'Arduino', 'arduino.js');
const getPY = () => load('PyRun', 'PyRun', 'pyrun.js');

/* ---------- Zufall und Signale ---------- */
function rngOf(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function keyFn(pts, interp) {
  const p = pts.map(x => [Number(x[0]), Number(x[1])]).filter(x => isFinite(x[0]) && isFinite(x[1])).sort((a, b) => a[0] - b[0]);
  return t => {
    if (!p.length) return 0;
    if (t <= p[0][0]) return p[0][1];
    const last = p[p.length - 1]; if (t >= last[0]) return last[1];
    let lo = 0, hi = p.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m][0] <= t) lo = m; else hi = m; }
    if (interp === 'step') return p[lo][1];
    const a = p[lo], b = p[hi]; return a[1] + (b[1] - a[1]) * (t - a[0]) / ((b[0] - a[0]) || 1);
  };
}
/* Signal: Zahl | Funktion(t) | [[t,wert],...] (Stützstellen) | { pts|f|v, interp:'linear'|'step', noise:Amplitude, seed, clamp:[lo,hi] } -> Funktion(t) */
function mkSignal(spec, o) {
  o = o || {};
  if (typeof spec === 'function') return spec;
  if (typeof spec === 'number') return () => spec;
  if (Array.isArray(spec)) return keyFn(spec, o.interp || 'linear');
  if (spec && typeof spec === 'object') {
    let f;
    if (typeof spec.f === 'function') f = spec.f; else if (Array.isArray(spec.pts)) f = keyFn(spec.pts, spec.interp || o.interp || 'linear'); else f = () => Number(spec.v) || 0;
    const amp = Number(spec.noise) || 0, rnd = rngOf(spec.seed == null ? 1 : spec.seed), cl = Array.isArray(spec.clamp) ? spec.clamp : null;
    return t => { let v = f(t); if (amp) v += (rnd() * 2 - 1) * amp; if (cl) v = Math.max(cl[0], Math.min(cl[1], v)); return v; };
  }
  return () => 0;
}

/* ---------- Prüf-io ---------- */
function parsePin(k) {
  const s = String(k).trim(), m = /^A(\d+)$/i.exec(s); if (m) return { analog: true, n: 14 + Number(m[1]) };
  const d = /^D?(\d+)$/i.exec(s); return d ? { analog: false, n: Number(d[1]) } : null;
}
/* mkMockIo(pins, script, opts):
     pins   : { A0:signal, 2:signal, ... }  (Namen A0..A7 = analog, Zahlen = digital), oder null
     script : { analog:{...}, digital:{...}, serialIn:'text'|[{t,text}], touch:number|signal, adc:{kanal:signal 0..1}, i2c:fn(addr,wr,n) }
     opts   : { kind:'arduino'|'pi', cap:Ereignisgrenze }
   Zeit: io.setTime(t, scale)  (t = Umgebungszeit, scale = MCU-Takt/Umgebung, 1 + ppm/1e6). Ereigniszeiten stehen in Umgebungszeit. */
function mkMockIo(pins, script, opts) {
  opts = opts || {}; script = script || {};
  const pi = opts.kind === 'pi', cap = opts.cap || LIMITS.maxEvents;
  const analog = {}, digital = {}, mode = {}, out = {}, duty = {};
  const io = { kind: pi ? 'pi' : 'arduino', t: 0, scale: 1, truncated: false, writes: [], pwms: [], tones: [], servos: [], lcdEvents: [], objects: [], serial: '', serialEvents: [] };
  const put = (arr, e) => { if (arr.length < cap) arr.push(e); else io.truncated = true; };
  Object.keys(pins || {}).forEach(k => { const p = parsePin(k); if (!p) return; if (p.analog) analog[p.n] = mkSignal(pins[k], { interp: 'linear' }); else digital[p.n] = mkSignal(pins[k], { interp: 'step' }); });
  Object.keys(script.analog || {}).forEach(k => { const p = parsePin(k); if (p) analog[p.analog ? p.n : (p.n < 14 ? p.n + 14 : p.n)] = mkSignal(script.analog[k], { interp: 'linear' }); });
  Object.keys(script.digital || {}).forEach(k => { const p = parsePin(k); if (p) digital[p.n] = mkSignal(script.digital[k], { interp: 'step' }); });
  const adc = {}; Object.keys(script.adc || {}).forEach(k => { adc[Number(k)] = mkSignal(script.adc[k], { interp: 'linear' }); });
  const touch = script.touch == null ? null : mkSignal(script.touch);
  const real = vt => (vt == null ? io.t : vt / io.scale);

  /* serieller Eingang */
  let rx = [], pend = [];
  if (typeof script.serialIn === 'string') pend.push({ t: 0, text: script.serialIn });
  else if (Array.isArray(script.serialIn)) script.serialIn.forEach(e => pend.push({ t: Number(e.t) || 0, text: String(e.text == null ? '' : e.text) }));
  pend.sort((a, b) => a.t - b.t);
  const pump = () => { while (pend.length && pend[0].t <= io.t + 1e-12) { const e = pend.shift(); for (let i = 0; i < e.text.length; i++) rx.push(e.text.charCodeAt(i)); } };
  const readInt = () => { pump(); while (rx.length && !(rx[0] === 45 || (rx[0] >= 48 && rx[0] <= 57))) rx.shift(); let s = ''; if (rx[0] === 45) { s = '-'; rx.shift(); } while (rx.length && rx[0] >= 48 && rx[0] <= 57) s += String.fromCharCode(rx.shift()); return parseInt(s, 10) || 0; };
  const readAll = () => { pump(); const s = String.fromCharCode.apply(null, rx); rx = []; return s; };
  const ser = s => { io.serial += s; put(io.serialEvents, { t: io.t, s }); };

  /* gemeinsame Wirkung */
  const wr = (pin, v, vt) => { out[pin] = v ? 1 : 0; duty[pin] = null; put(io.writes, { t: real(vt), pin, v: v ? 1 : 0 }); };
  const rd = (pin, md) => {
    if (md === 1) return out[pin] || 0;
    const s = digital[pin]; if (s) return s(io.t) >= 0.5 ? 1 : 0;
    return md === 2 ? 1 : 0;
  };

  if (!pi) {
    Object.assign(io, {
      pinMode: (q, md) => { mode[q] = md; },
      digitalWrite: (q, v, vt) => { wr(q, v, vt); },
      digitalRead: q => rd(q, mode[q]),
      analogRead: q => { const s = analog[q]; return s ? s(io.t) : 0; },
      analogWrite: (q, v) => { mode[q] = 1; duty[q] = v; put(io.pwms, { t: io.t, pin: q, v }); },
      tone: (q, f, d) => { put(io.tones, { t: io.t, pin: q, f, dur: d || 0 }); }, noTone: q => { put(io.tones, { t: io.t, pin: q, f: 0, dur: 0 }); },
      serialPrint: ser,
      serialAvailable: () => { pump(); return rx.length; },
      serialRead: () => { pump(); return rx.length ? rx.shift() : -1; },
      serialParseInt: readInt, serialReadString: readAll,
      servo: (q, cmd, a) => { put(io.servos, { t: io.t, pin: q, cmd, angle: a }); },
      lcd: (o, name, a) => { put(io.lcdEvents, { t: io.t, name, a }); return 0; },
      object: o => { io.objects.push(o); },
      touch: () => (touch ? Math.round(touch(io.t)) : 0),
      pulseHint: () => null,
    });
  } else {
    const MODE = { out: 1, in: 0, up: 2, down: 3 };
    Object.assign(io, {
      setMode: (g, md) => { mode[g] = MODE[md]; if (md === 'out') duty[g] = null; },
      write: (g, v, vt) => { wr(g, v, vt); },
      read: g => { if (mode[g] === 1) return out[g] || 0; const s = digital[g]; if (s) return s(io.t) >= 0.5 ? 1 : 0; return mode[g] === 2 ? 1 : 0; },
      pwm: (g, d) => { duty[g] = d == null ? null : d; put(io.pwms, { t: io.t, pin: g, v: d == null ? null : d }); },
      servo: (g, deg) => { put(io.servos, { t: io.t, pin: g, cmd: 'write', angle: deg }); },
      tone: (g, f) => { put(io.tones, { t: io.t, pin: g, f: f || 0, dur: 0 }); },
      echo: () => null,
      adc: (ch) => { const s = adc[ch]; if (!s) return { err: 'Im Prüflauf ist für Kanal ' + ch + ' kein Signal vorgegeben.' }; const v = Math.max(0, Math.min(1, s(io.t))); return { value: v, raw: Math.round(v * 1023) }; },
      i2c: (addr, w, n) => (typeof script.i2c === 'function' ? script.i2c(addr, w, n, io.t) : { err: '[Errno 121] Remote I/O error' }),
      print: t => { io.serial += t; },
    });
  }

  /* Abfragen für Prüfungen */
  io.setTime = (t, scale) => { io.t = t; if (scale != null) io.scale = scale; };
  io.mode = pin => mode[pin];
  io.level = pin => out[pin] || 0;                                          // zuletzt geschriebener digitaler Pegel
  io.dutyNow = pin => (duty[pin] == null ? null : duty[pin]);
  io.levelAt = (pin, t) => { let v = 0; for (const w of io.writes) { if (w.pin !== pin) continue; if (w.t <= t + 1e-12) v = w.v; } return v; };
  io.edges = pin => { const r = []; let v = 0; for (const w of io.writes) { if (w.pin !== pin) continue; if (w.v !== v) { r.push({ t: w.t, v: w.v }); v = w.v; } } return r; };
  io.countEdges = (pin, t0, t1) => io.edges(pin).filter(e => e.t >= (t0 == null ? -Infinity : t0) && e.t <= (t1 == null ? Infinity : t1)).length;
  io.dutyAt = (pin, t) => { let v = null; for (const w of io.pwms) { if (w.pin !== pin) continue; if (w.t <= t + 1e-12) v = w.v; } return v; };
  io.series = (pin, t0, t1, dt) => { const r = []; for (let t = t0; t <= t1 + 1e-12; t += dt) r.push({ t, v: io.levelAt(pin, t) }); return r; };
  io.serialLines = () => { const l = io.serial.split('\n'); if (l.length && l[l.length - 1] === '') l.pop(); return l.map(x => x.replace(/\r$/, '')); };
  return io;
}

/* ---------- Ausführung ---------- */
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

function loopRun(runner, io, sc, o) {
  const dt = num(sc.dt, o.dt) > 0 ? num(sc.dt, o.dt) : o.dt, T = num(sc.T, o.T) >= 0 ? num(sc.T, o.T) : o.T;
  const scale = 1 + num(sc.ppm, 0) / 1e6, maxSteps = num(sc.maxSteps, LIMITS.maxSteps), maxMs = num(sc.maxMs, LIMITS.maxMs);
  const clock = typeof sc.clock === 'function' ? sc.clock : () => Date.now();
  const n = Math.floor(T / dt + 1e-9), r = { steps: 0, t: 0, aborted: null, error: null, stopped: false };
  if (n + 1 > maxSteps) { r.aborted = 'steps'; r.error = 'Schrittgrenze von ' + maxSteps + ' Schritten überschritten (Laufzeit ' + T + ' s, Schritt ' + dt + ' s): Endlosschleife oder Prüflauf zu lang.'; return r; }
  const t0 = clock();
  for (let i = 0; i <= n; i++) {
    const t = i * dt;
    if (i % 64 === 0 && clock() - t0 > maxMs) { r.aborted = 'time'; r.error = 'Zeitlimit von ' + (maxMs / 1000) + ' s Rechenzeit überschritten (Endlosschleife?).'; break; }
    io.setTime(t, scale);
    if (typeof sc.onStep === 'function') { try { sc.onStep(t, io, runner); } catch (e) { r.error = 'Prüfszenario fehlerhaft: ' + (e && e.message ? e.message : e); break; } }
    runner.step(t * scale);
    r.steps++; r.t = t;
    if (runner.error) break;
    if (o.finish && o.finish(runner)) { r.stopped = true; break; }
    if (typeof sc.stopWhen === 'function') { let s = false; try { s = !!sc.stopWhen(io, t, runner); } catch (e) { r.error = 'Prüfszenario fehlerhaft: ' + (e && e.message ? e.message : e); break; } if (s) { r.stopped = true; break; } }
  }
  return r;
}

function failEarly(phase, msg, extra) { return Object.assign({ ok: false, phase, error: msg, aborted: null, steps: 0, t: 0, io: null, serial: '', lines: [] }, extra || {}); }

/* runSketch(src, scenario): scenario = { T:10, dt:0.001, ppm:0, pins, script|analog/digital/serialIn/touch, io, onStep(t,io,runner), stopWhen(io,t,runner), maxSteps, maxMs, clock }
   Ergebnis: { ok, phase:'compile'|'run'|'limit'|'ok', error, errors, aborted:null|'steps'|'time', steps, t, loops, io, serial, lines, runner } */
function runSketch(src, scenario) {
  try {
    const AR = getAR(); if (!AR) return failEarly('compile', 'Der Arduino-Kern (arduino.js) ist nicht geladen.');
    const sc = scenario || {};
    const comp = AR.compile(String(src == null ? '' : src));
    if (!comp.ok) { const e = comp.errors[0] || { line: 0, msg: 'Übersetzungsfehler' }; return failEarly('compile', 'Zeile ' + e.line + ': ' + e.msg, { errors: comp.errors }); }
    const script = sc.script || { analog: sc.analog, digital: sc.digital, serialIn: sc.serialIn, touch: sc.touch };
    const io = sc.io || mkMockIo(sc.pins, script, { kind: 'arduino' });
    const runner = AR.createRunner(comp.program, io); runner.start();
    const r = loopRun(runner, io, sc, { dt: 0.001, T: 10 });
    let phase = 'ok', error = r.error;
    if (runner.error) { phase = 'run'; error = 'Laufzeitfehler in Zeile ' + runner.error.line + ': ' + runner.error.msg; }
    else if (r.aborted) phase = 'limit'; else if (error) phase = 'run';
    return { ok: !error, phase, error, errors: [], aborted: r.aborted, steps: r.steps, t: r.t, stopped: r.stopped, loops: runner.loops || 0, io, serial: io.serial, lines: io.serialLines(), runner, runtimeError: runner.error || null };
  } catch (e) { return failEarly('run', 'Interner Fehler im Läufer: ' + (e && e.message ? e.message : e)); }
}

/* ---------- Python ---------- */
function pyLit(v) {
  if (v === null || v === undefined) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return isNaN(v) ? "float('nan')" : (v === Infinity ? "float('inf')" : (v === -Infinity ? "float('-inf')" : (Object.is(v, -0) ? '0' : String(v))));
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + "'";
  if (Array.isArray(v)) return '[' + v.map(pyLit).join(', ') + ']';
  if (typeof v === 'object') {
    if (v.$float !== undefined) { const x = Number(v.$float); return Number.isInteger(x) ? x + '.0' : pyLit(x); }
    return '{' + Object.keys(v).map(k => pyLit(String(k)) + ': ' + pyLit(v[k])).join(', ') + '}';
  }
  return 'None';
}
/* Ende einer Anweisung ab Zeile i (Klammertiefe, Zeichenketten, Kommentare); liefert Index der letzten Zeile */
function stmtEnd(lines, i) {
  let depth = 0;
  for (let k = i; k < lines.length; k++) {
    let q = null; const ln = lines[k];
    for (let c = 0; c < ln.length; c++) {
      const ch = ln[c];
      if (q) { if (ch === '\\') c++; else if (ch === q) q = null; continue; }
      if (ch === '#') break; if (ch === '"' || ch === "'") { q = ch; continue; }
      if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--;
    }
    if (depth <= 0 && !/\\\s*$/.test(ln)) return k;
  }
  return lines.length - 1;
}
/* Daten in den Programmkopf: vorhandene Zeile `name = ...` wird ersetzt (Zeilenzahl bleibt, Fehlerzeilen stimmen), sonst Zeile vorangestellt (lineOffset) */
function injectData(src, data) {
  let s = String(src == null ? '' : src);
  if (data == null) return { src: s, lineOffset: 0, replaced: [], added: [], bad: [] };
  const d = Array.isArray(data) ? { daten: data } : data, replaced = [], added = [], bad = [], pre = [];
  const lines = s.split('\n');
  Object.keys(d).forEach(name => {
    if (!/^[A-Za-z_]\w*$/.test(name)) { bad.push(name); return; }
    const re = new RegExp('^' + name + '\\s*=(?!=)'); const idx = lines.findIndex(l => re.test(l));
    const lit = name + ' = ' + pyLit(d[name]);
    if (idx >= 0) { const e = stmtEnd(lines, idx); lines[idx] = lit; for (let k = idx + 1; k <= e; k++) lines[k] = ''; replaced.push(name); }
    else { pre.push(lit); added.push(name); }
  });
  return { src: pre.concat(lines).join('\n'), lineOffset: pre.length, replaced, added, bad };
}
/* KEY=Wert-Zeilen (auch „KEY = Wert“); Zahlen mit Punkt oder Komma werden Zahlen, sonst Text. Spätere Zeilen überschreiben frühere. */
function parseKV(text) {
  const o = {}, lines = Array.isArray(text) ? text : String(text == null ? '' : text).split('\n');
  lines.forEach(l => {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(l); if (!m) return;
    const v = m[2]; o[m[1]] = /^[-+]?\d+(?:[.,]\d+)?(?:[eE][-+]?\d+)?$/.test(v) ? Number(v.replace(',', '.')) : v;
  });
  return o;
}

/* runPython(src, data, opts): opts = { T:60, dt:0.01, io, pins, script, maxSteps, maxMs, clock, mustFinish, onStep, stopWhen }
   Ergebnis: { ok, phase, error, errorLine, errorType, aborted, done, timedOut, out, lines, kv, steps, t, io, runner, inject } */
function runPython(src, data, opts) {
  try {
    const PY = getPY(); if (!PY) return failEarly('compile', 'Der Python-Kern (pyrun.js) ist nicht geladen.', { out: '', kv: {}, done: false, timedOut: false });
    const sc = opts || {};
    const inj = injectData(src, data);
    const comp = PY.compile(inj.src);
    if (!comp.ok) { const e = comp.errors[0] || { line: 0, msg: 'Syntaxfehler' }; const line = Math.max(1, (e.line || 1) - inj.lineOffset); return failEarly('compile', 'Zeile ' + line + ': ' + e.msg, { errors: comp.errors, errorLine: line, out: '', kv: {}, done: false, timedOut: false, inject: inj }); }
    const script = sc.script || { digital: sc.digital, adc: sc.adc, i2c: sc.i2c };
    const io = sc.io || mkMockIo(sc.pins, script, { kind: 'pi' });
    const runner = PY.createRunner(comp.program, io); runner.start();
    const r = loopRun(runner, io, sc, { dt: 0.01, T: 60, finish: rn => rn.done });
    const out = runner.out || '', lines = out.split('\n'); if (lines.length && lines[lines.length - 1] === '') lines.pop();
    let phase = 'ok', error = r.error, errorLine = 0, errorType = null;
    if (runner.error) { errorLine = Math.max(1, (runner.error.line || 1) - inj.lineOffset); errorType = runner.error.type; phase = 'run'; error = 'Zeile ' + errorLine + ': ' + runner.error.type + (runner.error.msg ? ': ' + runner.error.msg : ''); }
    else if (r.aborted) phase = 'limit'; else if (error) phase = 'run';
    const done = !!runner.done, timedOut = !done && !r.aborted && !error && !r.stopped;
    if (!error && timedOut && sc.mustFinish) { phase = 'limit'; error = 'Das Programm endet nicht innerhalb von ' + num(sc.T, 60) + ' s (Endlosschleife?).'; }
    return { ok: !error, phase, error, errors: [], errorLine, errorType, aborted: r.aborted, done, timedOut, stopped: r.stopped, out, lines, kv: parseKV(lines), steps: r.steps, t: r.t, io, runner, inject: inj };
  } catch (e) { return failEarly('run', 'Interner Fehler im Läufer: ' + (e && e.message ? e.message : e), { out: '', kv: {}, done: false, timedOut: false }); }
}

/* ---------- Anbindung ---------- */
const api = { runSketch, runPython, mkMockIo, mkSignal, parseKV, injectData, pyLit, RUN_LIMITS: LIMITS, runVersion: '1.0' };
function attach(V) { if (V && typeof V === 'object') Object.keys(api).forEach(k => { V[k] = api[k]; }); return V; }
api.attach = attach;
root.VerbundRun = api;
attach(root.Verbund);
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
  try { if (typeof require === 'function') { const K = require('./verbund.js'); if (K && K !== api) attach(K); } } catch (e) { /* Kern (Paket K) noch nicht vorhanden */ }
}
})(typeof window !== 'undefined' ? window : globalThis);
