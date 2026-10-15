/* Tonfunk LochLab - Oberfläche der Simulation (Umschalter, Messgeräte, Anzeige) */
(function () {
'use strict';
const LS = window.LochSim;
if (!LS) return;

let simOn = false, running = false, sim = null, circ = null;
let speed = 1, simTool = 'use';
const wrap = new Map();
const probe = { a: null, b: null };           // Multimeter-Spitzen {x,y,key,node}
let ampPart = null;                            // Bauteil für Strommessung
const scope = { ch: [null, null], next: 0, tdiv: 1e-3, vdiv: [1, 1] };
const TDIV = [1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2, 0.5, 1];
const VDIV = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
let saved = null, lastFrame = 0, lastPanel = 0, simAct = null, selSim = null;
let dtBase = 2e-4;

window.LochSimDebug = () => ({ simOn, running, simTool, probe, ampPart, scope: JSON.parse(JSON.stringify(scope.ch)), t: sim && sim.t, N: circ && circ.nn, elems: circ && circ.elems.map(e => ({ type: e.type, part: e.part && e.part.k, a: e.a, b: e.b, closed: e.closed, i: e.i })) });
/* ---------- Hilfen ---------- */
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
function fmt(v, unit) {
  if (!isFinite(v)) return '--';
  const a = Math.abs(v);
  const steps = [[1e-9, 'n'], [1e-6, 'µ'], [1e-3, 'm'], [1, ''], [1e3, 'k'], [1e6, 'M']];
  let best = steps[3];
  for (const s of steps) if (a >= s[0] * (s[1] === 'n' ? 1 : 0.9999)) best = s;
  if (a < 1e-12) return '0 ' + unit;
  const x = v / best[0], d = Math.abs(x) >= 100 ? 1 : Math.abs(x) >= 10 ? 2 : 3;
  return x.toFixed(d) + ' ' + best[1] + unit;
}
function fmtT(t) { return t < 1 ? (t * 1000).toFixed(1) + ' ms' : t.toFixed(3) + ' s'; }
function hexRgb(h) {
  h = String(h).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const tdivLabel = t => (t >= 1 ? t + ' s' : t >= 1e-3 ? (t * 1e3) + ' ms' : (t * 1e6) + ' µs');
const vdivLabel = v => (v >= 1 ? v + ' V' : (v * 1000) + ' mV');
const gk = (x, y) => x + ',' + y;
const elemsOf = id => (circ ? circ.elems.filter(e => e.part && e.part.id === id) : []);
const sv = node => (node < 0 || !sim ? NaN : sim.v[node]);

function partAt(fx, fy) {
  for (let i = doc.items.length - 1; i >= 0; i--) {
    const it = doc.items[i]; if (it.t !== 'part') continue;
    const [a, b] = rot(fx - it.x, fy - it.y, (4 - it.r) & 3), r = bodyRect(it);
    if (a >= r[0] - .15 && a <= r[2] + .15 && b >= r[1] - .15 && b <= r[3] + .15) return it;
  }
  return null;
}
/* ---------- Simulation aufbauen ---------- */
// Uno: Pin-Reihenfolge des Schaltplan-Kerns (Index) -> Pin der Stiftleisten im Layout (wie UNO_PM in schaltplan.js)
const UNO_PM_SIM = (() => { const m = [22, 21, 25, 23]; for (let a = 0; a < 6; a++) m.push(26 + a); for (let n = 0; n < 14; n++) m.push(17 - n); m.push(3, 22); return m; })();
// Sensor- und Servo-Module (Stiftleisten im Layout) -> Bauteil im Schaltungskern, Pin-Zuordnung, Startwert und Reglerbeschriftung
const SIP_SIM = {
  'HC-SR04': { core: 'HCSR04', pm: [0, 1, 2, 3], def: 0.5, sl: 'Abstand' },
  'PIR': { core: 'PIR', pm: [0, 1, 2], def: 0, sl: 'Bewegung' },
  'TMP36': { core: 'TMP36', pm: [0, 1, 2], def: 0.394, sl: 'Temperatur' },
  'Servo': { core: 'SERVO', pm: [2, 1, 0] },
  'LM75 I2C': { core: 'I2CTEMP', pm: [0, 1, 2, 3], def: 0.4, sl: 'Temperatur' },
  'BH1750 I2C': { core: 'I2CLUX', pm: [0, 1, 2, 3], def: 0.5, sl: 'Helligkeit' },
};
const sipOf = it => (it.k === 'SIP' ? SIP_SIM[it.v] : null);
const hasSlide = it => SLIDERS.includes(it.k) || !!(sipOf(it) && sipOf(it).sl);
const defPos = it => { const sp = sipOf(it); return sp && sp.def != null ? sp.def : (it.k === 'NTC' || it.k === 'PTC' ? 0.32 : 0.5); };
function build() {
  wrap.clear();
  const parts = doc.items.filter(i => i.t === 'part').map(i => {
    const pr = pinsOf(i), pins = i.k === 'OPTO' ? [pr[0], pr[1], pr[3], pr[2]] : (i.k === 'THY' ? [pr[1], pr[0], pr[2]] : (i.k === 'UNO' ? UNO_PM_SIM.map(li => pr[li]) : (sipOf(i) ? sipOf(i).pm.map(li => pr[li]) : pr)));
    const w = { id: i.id, k: i.k === 'UNO' ? 'MCU' : (i.k === 'PI' ? 'PI40' : (sipOf(i) ? sipOf(i).core : i.k)), vr: i.vr, v: i.v, n: i.n, pins, sw: i.sw || 0, pos: i.pos == null ? defPos(i) : i.pos, light: i.light == null ? 0.5 : i.light, pressed: false, item: i };
    wrap.set(i.id, w); return w;
  });
  circ = LS.buildCircuit({ parts, tracks: doc.items.filter(i => i.t === 'track'), wires: doc.items.filter(i => i.t === 'wire') });
  sim = LS.createSim(circ);
  // Messspitzen neu zuordnen
  const re = o => o && { x: o.x, y: o.y, key: o.key, node: circ.nodeOfKey(o.key) };
  probe.a = re(probe.a); probe.b = re(probe.b);
  scope.ch = scope.ch.map(re);
  resetSamples();
  // Schrittweite nach den schnellsten Signalen
  let f = 0;
  circ.elems.forEach(e => { if (e.type === 'V' && e.freq) f = Math.max(f, e.freq); });
  dtBase = f ? Math.min(2e-4, 1 / (f * 100)) : 2e-4;
  mcuStart();
}

/* ---------- Programm auf dem Uno oder Pi ---------- */
let prog = null, serLog = '';
function mcuStart() {
  prog = null; serLog = '';
  const el = circ && circ.mcu; if (!el || !doc.code) return;
  for (let i = 0; i < 6; i++) sim.step(dtBase);                       // Spannungen einschwingen lassen, bevor das Programm liest
  const py = el.type === 'PI40', L = py ? window.PyRun : window.Arduino, IO = window.LochMcuIO; if (!L || !IO) return;
  const c = L.compile(doc.code);
  if (!c.ok) { const e = c.errors[0]; serLog = '⚠ Fehler in Zeile ' + e.line + ': ' + e.msg + '\n'; return; }
  const X = { get S() { return sim; }, get C() { return circ; }, print: t => { serLog += t; if (serLog.length > 4000) serLog = serLog.slice(-3000); }, rx: [] };
  const runner = L.createRunner(c.program, py ? IO.pi(el, X) : IO.ard(el, X)); runner.start();
  prog = { runner, el, py, err: null };
}
function mcuStep() {
  if (!prog || prog.err) return;
  if (sim.burnt.has(prog.el.part.id)) { prog.err = { msg: 'zerstört' }; serLog += '⚠ ' + (prog.py ? 'Der Raspberry Pi' : 'Der Arduino') + ' ist zerstört.\n'; return; }
  prog.runner.step(sim.t);
  const er = prog.runner.error;
  if (er) { prog.err = er; serLog += '⚠ Fehler in Zeile ' + er.line + ': ' + (er.type ? er.type + ': ' : '') + (er.msg || er.m || '') + '\n'; }
  else if (prog.runner.done) prog.err = { msg: 'Programmende' };
}
window.LochSimDebug = () => ({ run: (T, hook) => { const n = Math.round(T / dtBase); for (let i = 0; i < n; i++) { if (prog) mcuStep(); sim.step(dtBase); if (hook) hook(sim.t); } }, circ, sim, prog, serLog, simOn, running, items: doc.items.filter(i => i.t === 'part').map(i => ({ k: i.k, l: i.l, b: i._b })) });
function mcuTone() {
  if (!window.LochFX) return;
  const mm = circ && circ.mcu && circ.mcu.mcu; let f = 0;
  if (mm && simOn && running) for (let q = 0; q < (mm.npin || 20); q++) if (mm.tone[q]) { f = mm.tone[q].f; break; }
  if (f) LochFX.tone(f); else LochFX.toneOff();
}

function resetSamples() { buf.n = 0; buf.head = 0; trk.dc = 0; trk.ac = 0; trk.init = false; buf.last = -1; }

/* ---------- Messwerte, Scope-Puffer ---------- */
const CAP = 40000;
const buf = { t: new Float64Array(CAP), a: new Float32Array(CAP), b: new Float32Array(CAP), n: 0, head: 0, last: -1 };
const trk = { dc: 0, ac: 0, init: false, vmin: 0, vmax: 0 };
function mmNow() {
  if (!probe.a) return NaN;
  const va = sv(probe.a.node), vb = probe.b ? sv(probe.b.node) : (circ.groundKnown ? 0 : NaN);
  return va - vb;
}
function record(dt) {
  const m = mmNow();
  if (isFinite(m)) {
    if (!trk.init) { trk.dc = m; trk.ac = 0; trk.init = true; trk.vmin = m; trk.vmax = m; }
    const al = 1 - Math.exp(-dt / 0.05);
    trk.dc += al * (m - trk.dc); trk.ac += al * ((m - trk.dc) * (m - trk.dc) - trk.ac);
  }
  const every = scope.tdiv / 100;
  if (sim.t - buf.last >= every || buf.last < 0) {
    buf.last = sim.t;
    const i = buf.head % CAP;
    buf.t[i] = sim.t;
    buf.a[i] = scope.ch[0] ? sv(scope.ch[0].node) : 0;
    buf.b[i] = scope.ch[1] ? sv(scope.ch[1].node) : 0;
    buf.head++; buf.n = Math.min(buf.n + 1, CAP);
  }
}
function simDt() {
  const act = scope.ch[0] || scope.ch[1];
  return act ? Math.min(dtBase, scope.tdiv / 80) : dtBase;
}
function advance(T) {
  const dt = Math.max(simDt(), 1e-7);
  const n = Math.max(1, Math.round(T / dt));
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    if (prog) mcuStep();
    sim.step(dt); record(dt);
    if ((i & 31) === 31 && performance.now() - t0 > 12) break;
  }
  // Zustände auf die Bauteile übertragen
  circ.elems.forEach(e => {
    const it = e.part && e.part.item; if (!it) return;
    if (e.type === 'D' && e.seg != null) { (it._seg = it._seg || [])[e.seg] = Math.pow(clampN(e.i / 0.02, 0, 1), 0.6); return; }
    if (e.type === 'D' && e.led) { it._b = Math.pow(clampN(e.i / 0.02, 0, 1), 0.6); it._st = e.imax ? e.i / e.imax : 0; }
    if (e.res) it._hot = e.power > 0.25 ? clampN(e.power / 1, 0, 1) : 0;
  });
  sim.burnt.forEach(id => { const w = wrap.get(id); if (w) w.item._burnt = true; });
  while (sim.events.length) {
    const ev = sim.events.shift(); toast(ev.text + (ev.part && ev.part.item.l ? ' (' + ev.part.item.l + ')' : ''));
    const it = ev.part && ev.part.item;
    if (it && window.LochFX && ev.kind === 'burn') {
      const ctr = () => { const b = worldBox(it); return [view.ox + (b[0] + b[2]) / 2 * view.s, view.oy + (b[1] + b[3]) / 2 * view.s]; }, [x, y] = ctr();
      const led = it.k === 'LED';
      LochFX.explode(x, y, { kind: led ? 'led' : (it.k === 'R' || it.k === 'P' || it.k === 'TP' ? 'res' : (['Q', 'IC', 'U'].includes(it.k) ? 'chip' : 'big')), color: led ? hexRgb(ledColor(it.v)).join(',') : '255,170,60', scale: view.s, at: ctr });
    }
  }
}
function tick(now) {
  if (!simOn) return;
  try {
    const rdt = Math.min((now - lastFrame) / 1000, 0.1); lastFrame = now;
    if (running && sim && circ.nn > 0) advance(rdt * speed);
    if (now - lastPanel > 80) { lastPanel = now; updatePanel(); mcuTone(); }
    invalidate();
  } catch (e) { console.error(e); running = false; toast('Simulationsfehler: ' + e.message); simNav(); }
  requestAnimationFrame(tick);
}

/* ---------- Umschalter Layout <-> Simulation ---------- */
const css = document.createElement('style');
css.textContent = `
.simsw{display:flex;align-items:center;gap:6px;height:36px;padding:0 8px;margin:0 4px;border-radius:18px;background:#2c343e;border:1px solid #38424d;color:#8d99a6;font-size:12px;flex:none}
.simsw .trk{position:relative;width:38px;height:22px;border-radius:11px;background:#4a5561;transition:background .15s}
.simsw .knob{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .15s}
.simsw[aria-checked=true] .trk{background:#2fae45}.simsw[aria-checked=true] .knob{left:18px}
.simsw .lL,.simsw .lS{color:#8d99a6}
.simsw[aria-checked=false] .lL,.simsw[aria-checked=true] .lS{color:#fff;font-weight:600}
@media(max-width:520px){.simsw .lL,.simsw .lS{display:none}}
#mid{position:relative}
body.sim #side{display:block;width:344px}
@media(max-width:639px){body.sim #side{position:absolute;left:0;right:0;bottom:0;width:auto;height:50%;border-left:0;border-top:1px solid var(--line);z-index:5}}
body.sim #bView{opacity:.3;pointer-events:none}
.sp-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-variant-numeric:tabular-nums}
.sp-top b{font-size:15px}
.card{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:10px}
.card h4{margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute);font-weight:600}
.lcd{font:600 30px/1.15 ui-monospace,Menlo,Consolas,monospace;background:#c9d99d;color:#1d2a0c;border-radius:8px;padding:6px 10px;text-align:right;border:2px solid #7b8a58}
.mmsub{margin-top:6px;font-size:12px;color:var(--mute);min-height:30px}
.scrow{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px}
.scrow .lbl{width:64px;color:var(--mute)}
.scrow .val{flex:1;text-align:center;font-weight:600;font-variant-numeric:tabular-nums}
.scrow button,.mini{height:32px;min-width:34px;border-radius:8px;background:var(--panel);border:1px solid var(--line);font-size:16px;padding:0 8px}
#side canvas{position:static;inset:auto;touch-action:auto}
#scCv{width:100%;height:190px;border-radius:8px;background:#0b130e;display:block}
.warn{border-color:#c97a1a}.warn li{margin:2px 0}
.kv{display:flex;justify-content:space-between;font-size:13px;padding:2px 0}.kv span:first-child{color:var(--mute)}
input[type=range]{padding:0;height:34px}
.tb .big{font-size:20px;line-height:24px;font-weight:700}
`;
document.head.appendChild(css);

const sw = document.createElement('button');
sw.className = 'simsw'; sw.id = 'bSim'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', 'false'); sw.setAttribute('aria-label', 'Simulation');
sw.innerHTML = '<span class="lL">Layout</span><span class="trk"><span class="knob"></span></span><span class="lS">Sim</span>';
$('#bUndo').before(sw);
sw.addEventListener('click', () => (simOn ? leaveSim() : enterSim()));

/* ---------- Ein- und Ausstieg ---------- */
function enterSim() {
  if (!doc.items.some(i => i.t === 'part')) { toast('Noch keine Bauteile im Layout'); return; }
  saved = { mode, tool, sel };
  chain = null; ghost = null; act = null;
  mode = 'both'; tool = 'select'; sel = null; selSim = null;
  probe.a = null; probe.b = null; ampPart = null; scope.ch = [null, null]; scope.next = 0;
  simOn = true; running = true; simTool = 'use';
  document.body.classList.add('sim'); sw.setAttribute('aria-checked', 'true');
  build();
  buildPanel(); simNav(); renderCtx(); updateHeader(); invalidate();
  lastFrame = performance.now(); requestAnimationFrame(tick);
}
function leaveSim() {
  simOn = false; running = false; prog = null; if (window.LochFX) LochFX.toneOff();
  doc.items.forEach(i => { delete i._b; delete i._burnt; delete i._hot; delete i._seg; delete i._p; });
  doc.items.forEach(i => { if (i.t === 'part') { const w = wrap.get(i.id); if (w) { i.sw = w.sw; i.pos = w.pos; i.light = w.light; } } });
  document.body.classList.remove('sim'); sw.setAttribute('aria-checked', 'false');
  $('#side').innerHTML = ''; $('#side').classList.remove('on');
  if (saved) { mode = saved.mode; tool = saved.tool; sel = null; }
  buildNav(); renderCtx(); updateHeader(); invalidate();
  try { save(); } catch (e) {}
}

/* ---------- Eingaben abfangen ---------- */
const _onDown = onDown, _onMove = onMove, _onUp = onUp, _render = render, _renderCtx = renderCtx, _buildNav = buildNav, _setTool = setTool, _delSel = delSel, _rotSel = rotSel, _dupSel = dupSel;
onDown = function (p) { if (simOn) return simDown(p); return _onDown(p); };
onMove = function (p) { if (simOn) return simMove(p); return _onMove(p); };
onUp = function (p) { if (simOn) return simUp(p); return _onUp(p); };
render = function () { _render(); if (simOn) overlay(); };
renderCtx = function () { if (simOn) return simCtx(); return _renderCtx(); };
buildNav = function () { if (simOn) return simNav(); return _buildNav(); };
setTool = function (t) { if (simOn || !t) return; return _setTool(t); };
delSel = function () { if (simOn) return; return _delSel(); };
rotSel = function (d) { if (simOn) return; return _rotSel(d); };
dupSel = function () { if (simOn) return; return _dupSel(); };

function simDown(p) {
  { const sh = sliderAt(p.x, p.y); if (sh) { simAct = { slide: sh }; setSlide(sh, p.x); return; } }
  const [fx, fy] = toGrid(p.x, p.y), [gx, gy] = snap(fx, fy);
  simAct = { sx: p.x, sy: p.y, lx: p.x, ly: p.y, pan: false, fx, fy, gx, gy };
  if (simTool === 'use') {
    const h = partAt(fx, fy);
    if (h) {
      selSim = h.id; sel = h.id;
      const w = wrap.get(h.id);
      if (h.k === 'SCH') { h.sw = h.sw ? 0 : 1; w.sw = h.sw; simAct.done = true; }
      else if (h.k === 'SW') { w.pressed = true; h._p = true; simAct.press = h; simAct.done = true; }
      else if (h.k === 'DSW') {
        const [lx] = rot(fx - h.x, fy - h.y, (4 - h.r) & 3);
        const i = clampN(Math.round(lx), 0, h.n / 2 - 1);
        h.sw = (h.sw || 0) ^ (1 << i); w.sw = h.sw; simAct.done = true;
      }
      buildPanel(); invalidate();
    }
  }
}
function simMove(p) {
  if (!simAct) return;
  if (simAct.slide) { setSlide(simAct.slide, p.x); return; }
  const dx = p.x - simAct.lx, dy = p.y - simAct.ly;
  if (!simAct.pan && Math.hypot(p.x - simAct.sx, p.y - simAct.sy) > 8 && !simAct.press) simAct.pan = true;
  if (simAct.pan) { view.ox += dx; view.oy += dy; }
  simAct.lx = p.x; simAct.ly = p.y;
  const [fx, fy] = toGrid(p.x, p.y); cursor = snap(fx, fy);
  invalidate();
}
function simUp(p) {
  const a = simAct; simAct = null; if (!a) return;
  if (a.slide) { try { save(); } catch (e) {} buildPanel(); invalidate(); return; }
  if (a.press) { const w = wrap.get(a.press.id); if (w) w.pressed = false; a.press._p = false; invalidate(); return; }
  if (a.pan || a.done) return;
  const key = gk(a.gx, a.gy);
  if (simTool === 'use') {
    sel = null; selSim = null; buildPanel(); invalidate();
  } else if (simTool === 'volt') {
    const pr = { x: a.gx, y: a.gy, key, node: circ.nodeOfKey(key) };
    if (!probe.a || (probe.a && probe.b)) { probe.a = pr; probe.b = null; } else probe.b = pr;
    ampPart = null; trk.init = false; invalidate();
  } else if (simTool === 'amp') {
    const h = partAt(a.fx, a.fy);
    if (h) { ampPart = h.id; probe.a = null; probe.b = null; trk.init = false; }
    else toast('Bauteil antippen, durch das der Strom gemessen werden soll');
    invalidate();
  } else if (simTool === 'scope') {
    scope.ch[scope.next] = { x: a.gx, y: a.gy, key, node: circ.nodeOfKey(key) };
    scope.next = (scope.next + 1) % 2; buf.n = 0; buf.head = 0; buf.last = -1;
    invalidate();
  }
}


function drawPill(cx, x, y, w, v, label) {
  const h = 22, x0 = x - w / 2;
  cx.save();
  cx.fillStyle = 'rgba(18,22,28,.92)'; cx.strokeStyle = 'rgba(120,140,160,.8)'; cx.lineWidth = 1.5;
  cx.beginPath(); cx.roundRect ? cx.roundRect(x0, y - h / 2, w, h, 11) : cx.rect(x0, y - h / 2, w, h); cx.fill(); cx.stroke();
  const tx0 = x0 + 12, tx1 = x0 + w - 12;
  cx.strokeStyle = '#5b6672'; cx.lineWidth = 4; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(tx0, y); cx.lineTo(tx1, y); cx.stroke();
  cx.strokeStyle = '#3b9eff'; cx.beginPath(); cx.moveTo(tx0, y); cx.lineTo(tx0 + (tx1 - tx0) * v, y); cx.stroke();
  cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(tx0 + (tx1 - tx0) * v, y, 8, 0, 7); cx.fill(); cx.strokeStyle = '#3b9eff'; cx.lineWidth = 2; cx.stroke();
  cx.fillStyle = '#cfd5db'; cx.font = '600 11px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'bottom'; cx.fillText(label + ' ' + Math.round(v * 100) + ' %', x, y - h / 2 - 2);
  cx.restore();
  return { x0: tx0, x1: tx1, y0: y - h / 2 - 8, y1: y + h / 2 + 8, xl: x0 - 8, xr: x0 + w + 8 };
}

let sliderHits = [];
const SLIDERS = ['P', 'TP', 'LDR', 'NTC', 'PTC', 'PHT'];
const sliderAt = (px, py) => sliderHits.find(h => px >= h.xl && px <= h.xr && py >= h.y0 && py <= h.y1);
const sliderVal = it => it.k === 'LDR' ? (it.light == null ? 0.5 : it.light) : (it.pos == null ? defPos(it) : it.pos);
function setSlide(h, px) {
  const it = byId(h.id), w = it && wrap.get(it.id); if (!it || !w) return;
  const v = clampN((px - h.x0) / (h.x1 - h.x0), 0, 1);
  if (it.k === 'LDR') { w.light = v; it.light = v; } else { w.pos = v; it.pos = v; }
  invalidate();
}
/* ---------- Zusatzzeichnung über dem Layout ---------- */
function overlay() {
  const S = view.s, X = x => view.ox + x * S, Y = y => view.oy + y * S;
  cx.save();
  cx.globalCompositeOperation = 'lighter';
  doc.items.forEach(it => {
    if (it.t !== 'part') return;
    if (it.k === 'LED' && it._st > 0.85 && !it._burnt && window.LochFX) { const b = worldBox(it); LochFX.stress(X((b[0] + b[2]) / 2), Y((b[1] + b[3]) / 2), it._st, S); it._b = Math.min(1.6, it._b * (1 + (it._st - 0.85) * 4)); }
    if (it.k === 'LED' && it._b > 0.02 && !it._burnt) {
      const r = ledR(it), [lx, ly] = rot(it.n / 2, 0, it.r), px = X(it.x + lx), py = Y(it.y + ly);
      const [R, G, B] = hexRgb(ledColor(it.v)), rad = (r * 2.4 + 0.8) * S, a = clampN(it._b, 0, 1);
      const g = cx.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, `rgba(${R},${G},${B},${0.85 * a})`); g.addColorStop(0.4, `rgba(${R},${G},${B},${0.35 * a})`); g.addColorStop(1, `rgba(${R},${G},${B},0)`);
      cx.fillStyle = g; cx.beginPath(); cx.arc(px, py, rad, 0, 7); cx.fill();
      cx.fillStyle = `rgba(255,255,255,${0.55 * a})`; cx.beginPath(); cx.arc(px, py, r * S * 0.45, 0, 7); cx.fill();
    }
    if (it._hot > 0) {
      const b = worldBox(it), g = it._hot;
      cx.fillStyle = `rgba(255,60,20,${0.55 * g})`; cx.fillRect(X(b[0]), Y(b[1]), (b[2] - b[0]) * S, (b[3] - b[1]) * S);
    }
  });
  cx.restore();
  // Relais und Thyristor: Zustandsanzeige
  circ.elems.forEach(e => {
    if (!(e.relay || e.type === 'THY') || !e.part.item) return;
    const b = worldBox(e.part.item), on = e.relay ? e.on : e.on;
    cx.beginPath(); cx.arc(X((b[0] + b[2]) / 2), Y((b[1] + b[3]) / 2) + (e.relay ? 0.5 * S : 0), 0.35 * S, 0, 7); cx.fillStyle = on ? '#4cd964' : '#555'; cx.globalAlpha = 0.95; cx.fill(); cx.globalAlpha = 1;
  });
  // IC-Pegel: Ring je Pin (grün = High, grau = Low, orange = dazwischen)
  circ.elems.forEach(e => {
    if (e.type !== 'IC') return;
    const it = e.part.item, pw = pinsOf(it), g = sim.v[e.gnd], vs = sim.v[e.vcc] - g;
    if (!(vs > 1)) return;
    const sup = new Set([e.vcc, e.gnd]);
    for (let i = 1; i <= e.np; i++) {
      if (e.n[i] === e.vcc || e.n[i] === e.gnd) continue;
      const x = (sim.v[e.n[i]] - g) / vs, col = x > 0.65 ? '#4cd964' : x < 0.3 ? '#8a94a0' : '#ffb340';
      cx.beginPath(); cx.arc(X(pw[i - 1][0]), Y(pw[i - 1][1]), 0.34 * S, 0, 7); cx.fillStyle = col; cx.globalAlpha = 0.9; cx.fill(); cx.globalAlpha = 1;
    }
  });
  // Markierungen: Masse, Messspitzen, Scope
  const ring = (pt, col, label) => {
    if (!pt) return;
    cx.strokeStyle = col; cx.lineWidth = 3; cx.beginPath(); cx.arc(X(pt.x), Y(pt.y), 0.62 * S, 0, 7); cx.stroke();
    cx.fillStyle = col; cx.font = `700 ${Math.max(11, S * 0.55)}px sans-serif`; cx.textAlign = 'left'; cx.textBaseline = 'middle';
    cx.strokeStyle = 'rgba(0,0,0,.7)'; cx.lineWidth = 3; cx.strokeText(label, X(pt.x) + 0.8 * S, Y(pt.y) - 0.7 * S); cx.fillText(label, X(pt.x) + 0.8 * S, Y(pt.y) - 0.7 * S);
  };
  ring(probe.a, '#ff4d4d', probe.b ? '+' : 'rot'); ring(probe.b, '#222', '−');
  if (probe.b) { cx.strokeStyle = '#111'; cx.lineWidth = 3; cx.beginPath(); cx.arc(X(probe.b.x), Y(probe.b.y), 0.62 * S, 0, 7); cx.strokeStyle = '#fff'; cx.lineWidth = 1.5; cx.stroke(); }
  ring(scope.ch[0], '#ffd23f', 'K1'); ring(scope.ch[1], '#35d0ff', 'K2');
  if (ampPart != null) { const it = byId(ampPart); if (it) { const b = worldBox(it); cx.strokeStyle = '#7dff7d'; cx.lineWidth = 3; cx.setLineDash([6, 4]); cx.strokeRect(X(b[0]) - 3, Y(b[1]) - 3, (b[2] - b[0]) * S + 6, (b[3] - b[1]) * S + 6); cx.setLineDash([]); } }
  // Masse-Symbol am Minuspol der ersten Quelle
  const src = doc.items.find(i => i.t === 'part' && (i.k === 'BAT' || i.k === 'SIG'));
  if (src) {
    const pn = pinsOf(src)[1], x = X(pn[0]), y = Y(pn[1]) + 0.9 * S;
    cx.strokeStyle = '#9fe870'; cx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { cx.beginPath(); cx.moveTo(x - (0.5 - i * 0.18) * S, y + i * 0.2 * S); cx.lineTo(x + (0.5 - i * 0.18) * S, y + i * 0.2 * S); cx.stroke(); }
    cx.beginPath(); cx.moveTo(x, y - 0.3 * S); cx.lineTo(x, y); cx.stroke();
  }
  sliderHits = [];
  doc.items.forEach(it => {
    if (it.t !== 'part' || !hasSlide(it)) return;
    const b = worldBox(it), w = Math.max(104, 4.5 * S), lbl = sipOf(it) ? sipOf(it).sl : (it.k === 'LDR' || it.k === 'PHT' ? 'Licht' : (it.k === 'NTC' || it.k === 'PTC' ? 'Temp.' : 'Regler'));
    sliderHits.push(Object.assign({ id: it.id }, drawPill(cx, X((b[0] + b[2]) / 2), Y(b[3]) + 22, w, sliderVal(it), lbl)));
  });
  if (window.LochFX) LochFX.draw(cx);
}

/* ---------- Navigation und Leiste ---------- */
function simNav() {
  const b = (id, ic, l, on) => `<button class="tb ${on ? 'on' : ''}" data-s="${id}"><span class="big">${ic}</span><span>${l}</span></button>`;
  $('#nav').innerHTML =
    b('run', running ? '⏸' : '▶', running ? 'Pause' : 'Start', running) + b('rst', '↺', 'Zurücksetzen') +
    b('t:use', '☝', 'Bedienen', simTool === 'use') + b('t:volt', 'V', 'Spannung', simTool === 'volt') +
    b('t:amp', 'A', 'Strom', simTool === 'amp') + b('t:scope', '∿', 'Oszi', simTool === 'scope');
}
function simCtx() {
  const hints = { use: 'Schalter und Taster antippen, Potis in der Seitenleiste einstellen', volt: 'Zwei Punkte antippen: rote und schwarze Messspitze', amp: 'Bauteil antippen, durch das der Strom gemessen wird', scope: 'Punkt antippen: erst Kanal 1, dann Kanal 2' };
  const chip = (v, l) => `<button class="chip ${speed === v ? 'on' : ''}" data-s="spd" data-v="${v}">${l}</button>`;
  $('#ctx').innerHTML = `<span class="hint">${hints[simTool]}</span><span class="sep"></span><span class="hint">Tempo</span>` +
    chip(0.01, '1/100') + chip(0.1, '1/10') + chip(1, '×1') + chip(10, '×10') + chip(100, '×100');
  $('#side').classList.add('on');
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-s]'); if (!b || !simOn) return;
  const s = b.dataset.s;
  if (s === 'run') { running = !running; lastFrame = performance.now(); }
  else if (s === 'rst') { if (window.LochFX) LochFX.clear(); sim.reset(); resetSamples(); doc.items.forEach(i => { delete i._b; delete i._burnt; delete i._hot; delete i._seg; }); toast('Simulation zurückgesetzt'); }
  else if (s.startsWith('t:')) { simTool = s.slice(2); }
  else if (s === 'spd') speed = parseFloat(b.dataset.v);
  else if (s === 'tm' || s === 'tp') { const i = TDIV.findIndex(t => Math.abs(t - scope.tdiv) < t * 1e-6); scope.tdiv = TDIV[clampN(i + (s === 'tp' ? 1 : -1), 0, TDIV.length - 1)]; buf.n = 0; buf.head = 0; buf.last = -1; }
  else if (s === 'v1m' || s === 'v1p' || s === 'v2m' || s === 'v2p') { const c = +s[1] - 1, i = VDIV.indexOf(scope.vdiv[c]); scope.vdiv[c] = VDIV[clampN(i + (s[2] === 'p' ? 1 : -1), 0, VDIV.length - 1)]; }
  else if (s === 'auto') autoScope();
  simNav(); simCtx(); updatePanel(true); invalidate();
});

function autoScope() {
  const n = Math.min(buf.n, 4000); if (n < 10) return;
  const nice = (x, list) => list.reduce((b, v) => (Math.abs(Math.log(v / x)) < Math.abs(Math.log(b / x)) ? v : b), list[0]);
  let f = 0; circ.elems.forEach(e => { if (e.type === 'V' && e.freq) f = Math.max(f, e.freq); });
  if (f) scope.tdiv = nice(2.5 / f / 10, TDIV);
  [['a', 0], ['b', 1]].forEach(([k, c]) => {
    if (!scope.ch[c]) return;
    let mn = 1e9, mx = -1e9;
    for (let i = 0; i < n; i++) { const idx = ((buf.head - 1 - i) % CAP + CAP) % CAP; mn = Math.min(mn, buf[k][idx]); mx = Math.max(mx, buf[k][idx]); }
    scope.vdiv[c] = nice(Math.max(mx - mn, 0.02) / 6, VDIV);
  });
  buf.n = 0; buf.head = 0; buf.last = -1;
}

/* ---------- Seitenleiste: Messgeräte und Bauteil-Info ---------- */
function buildPanel() {
  const sd = $('#side');
  const sel_ = selSim != null ? byId(selSim) : null;
  let slider = '';
  if (sel_ && hasSlide(sel_)) {
    const w = wrap.get(sel_.id), isL = sel_.k === 'LDR', val = Math.round((isL ? w.light : w.pos) * 100), lbl = sipOf(sel_) ? sipOf(sel_).sl : (isL || sel_.k === 'PHT' ? 'Helligkeit' : (sel_.k === 'NTC' || sel_.k === 'PTC' ? 'Temperatur' : 'Schleifer'));
    slider = `<div class="kv"><span>${lbl}</span><span id="slv">${val} %</span></div><input type="range" id="slr" min="0" max="100" value="${val}" aria-label="${isL ? 'Helligkeit' : 'Schleiferstellung'}">`;
  }
  sd.innerHTML = `
    <div class="sp-top"><b id="spT">t = 0 s</b><span id="spS"></span></div>
    <div id="spW"></div>
    ${doc.code ? '<div class="card"><h4>' + (doc.lang === 'python' ? 'Raspberry Pi: Konsole' : 'Arduino: Serial-Monitor') + '</h4><pre id="spCon" style="margin:0;max-height:150px;overflow:auto;font:12px/1.4 monospace;white-space:pre-wrap;color:var(--fg)"></pre><details style="margin-top:8px"><summary style="cursor:pointer;color:var(--accent);font-weight:600;font-size:13px">Programm anzeigen</summary><pre style="margin:6px 0 0;max-height:220px;overflow:auto;font:11.5px/1.4 monospace;white-space:pre-wrap;color:var(--mute)">' + esc(doc.code) + '</pre><div class="mmsub" style="margin-top:6px">Das Programm lässt sich im ' + (doc.lang === 'python' ? 'Pi-Lab' : 'Arduino-Lab') + ' ändern und ausprobieren.</div></details></div>' : ''}
    <div class="card"><h4>Multimeter</h4><div class="lcd" id="mmVal">--</div><div class="mmsub" id="mmSub"></div></div>
    <div class="card"><h4>Oszilloskop</h4><canvas id="scCv" width="640" height="380"></canvas>
      <div class="scrow"><span class="lbl">Zeit/Div</span><button data-s="tm">−</button><span class="val" id="tdv"></span><button data-s="tp">+</button></div>
      <div class="scrow"><span class="lbl" style="color:#ffd23f">K1 V/Div</span><button data-s="v1m">−</button><span class="val" id="v1d"></span><button data-s="v1p">+</button></div>
      <div class="scrow"><span class="lbl" style="color:#35d0ff">K2 V/Div</span><button data-s="v2m">−</button><span class="val" id="v2d"></span><button data-s="v2p">+</button></div>
      <div class="scrow"><button class="mini" data-s="auto" style="flex:1">Automatisch einstellen</button></div>
    </div>
    <div class="card"><h4>Bauteil</h4><div id="spP"></div>${slider}</div>`;
  const r = $('#slr');
  if (r) r.addEventListener('input', () => {
    const w = wrap.get(sel_.id), v = r.value / 100;
    if (sel_.k === 'LDR') { w.light = v; sel_.light = v; } else { w.pos = v; sel_.pos = v; }
    $('#slv').textContent = r.value + ' %';
  });
  sd.classList.add('on');
  updatePanel(true);
}
function updatePanel(force) {
  if (!simOn || !sim) return;
  const q = id => document.getElementById(id); if (!q('spT')) return;
  q('spT').textContent = 't = ' + (sim.t < 1 ? (sim.t * 1000).toFixed(1) + ' ms' : sim.t.toFixed(3) + ' s');
  q('spS').textContent = running ? '● läuft' : '❚❚ Pause';
  q('spS').style.color = running ? '#4cd964' : 'var(--mute)';
  const con = q('spCon'); if (con && con.textContent !== serLog) { con.textContent = serLog; con.scrollTop = con.scrollHeight; }
  // Warnungen
  const w = [];
  if (!circ.elems.some(e => e.type === 'V' || e.type === 'MCU' || e.type === 'PI40')) w.push('Keine Spannungsquelle (Batterie oder Signalgenerator) im Layout.');
  else if (!circ.groundKnown) w.push('Keine Masse bestimmt.');
  circ.warnings.forEach(x => { const it = x.part.item; w.push((it && it.l ? it.l + ': ' : '') + (PARTS[x.part.k] ? PARTS[x.part.k].name : x.part.k) + ' – ' + x.text); });
  sim.burnt.forEach(id => { const it = byId(id); if (it) w.push(`${it.l || PARTS[it.k].name} ist durchgebrannt. Mit „Zurücksetzen“ wieder herstellen.`); });
  if (running && sim.converged === false) w.push('Schaltung rechnet nicht stabil.');
  q('spW').innerHTML = w.length ? `<div class="card warn"><ul style="margin:0;padding-left:18px;font-size:13px">${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  // Multimeter
  const mv = q('mmVal'), ms = q('mmSub');
  if (ampPart != null) {
    const it = byId(ampPart), es = elemsOf(ampPart);
    let e = es.find(x => x.type !== 'S' || x.closed) || es[0];
    if (it && e) {
      let i = e.type === 'Q' ? e.ic : e.i;
      mv.textContent = fmt(i, 'A');
      ms.textContent = `Strom durch ${it.l || PARTS[it.k].name} (von Pin 1 nach Pin 2)`;
    } else { mv.textContent = '--'; ms.textContent = 'Dieses Bauteil wird nicht simuliert.'; }
  } else if (probe.a) {
    const m = mmNow();
    if (!isFinite(m)) { mv.textContent = '--'; ms.textContent = probe.a.node < 0 || (probe.b && probe.b.node < 0) ? 'Messpunkt ist nicht verbunden.' : 'Keine Masse im Layout.'; }
    else {
      mv.textContent = fmt(trk.dc, 'V');
      const rms = Math.sqrt(Math.max(trk.ac, 0));
      ms.textContent = (probe.b ? 'Spannung rot gegen schwarz' : 'Spannung gegen Masse') + (rms > 1e-3 ? ` · Wechselanteil eff. ${fmt(rms, 'V')}` : '');
    }
  } else { mv.textContent = '--'; ms.textContent = 'Werkzeug „Spannung“ oder „Strom“ wählen und im Layout messen.'; }
  // Scope-Beschriftung
  q('tdv').textContent = tdivLabel(scope.tdiv); q('v1d').textContent = vdivLabel(scope.vdiv[0]); q('v2d').textContent = vdivLabel(scope.vdiv[1]);
  drawScope(q('scCv'));
  // Bauteil-Info
  const it = selSim != null ? byId(selSim) : null, pi = q('spP');
  if (!it) pi.innerHTML = '<div class="kv"><span style="color:var(--mute)">Bauteil in „Bedienen“ antippen</span></div>';
  else {
    const es = elemsOf(it.id), rows = [];
    const pins = wrap.get(it.id).pins;
    const nd = i => circ.nodeOfKey(gk(pins[i][0], pins[i][1]));
    rows.push(['Bauteil', `${esc(it.l || '')} ${esc(PARTS[it.k].name)}${it.v ? ' · ' + esc(it.v) : ''}`]);
    if (pins.length >= 2 && !['T', 'U', 'DSW'].includes(it.k)) rows.push(['Spannung', fmt(sv(nd(0)) - sv(nd(1)), 'V')]);
    const e0 = es.find(x => x.type === 'D' || x.type === 'R' || x.type === 'C' || x.type === 'L' || x.type === 'V') || es[0];
    if (e0 && e0.type !== 'Q') rows.push(['Strom', fmt(e0.i, 'A')]);
    if (e0 && e0.type === 'D' && e0.led) rows.push(['Helligkeit', Math.round(clampN(e0.i / 0.02, 0, 1) * 100) + ' %']);
    if (e0 && e0.type === 'R' && e0.power != null) rows.push(['Leistung', fmt(e0.power, 'W')]);
    if (e0 && e0.type === 'V') rows.push(['Quelle', e0.wave === 'dc' ? fmt(e0.vs, 'V') : `${fmt(e0.amp, 'V')} · ${fmt(e0.freq, 'Hz')}`]);
    const qe = es.find(x => x.type === 'Q');
    if (qe) { rows.push(['Kollektorstrom', fmt(qe.ic, 'A')]); rows.push(['Basisstrom', fmt(qe.ib, 'A')]); rows.push(['Verstärkung', Math.abs(qe.ib) > 1e-9 ? (qe.ic / qe.ib).toFixed(0) : '--']); rows.push(['Leistung', fmt(qe.power, 'W')]); }
    if (it.k === 'SCH' || it.k === 'SW' || it.k === 'DSW') rows.push(['Stellung', it.k === 'SW' ? (wrap.get(it.id).pressed ? 'gedrückt' : 'offen') : (it.k === 'DSW' ? 'Bits ' + (it.sw || 0).toString(2).padStart(it.n / 2, '0') : (it.sw ? 'unten' : 'oben'))]);
    pi.innerHTML = rows.map(([a, b]) => `<div class="kv"><span>${a}</span><span>${b}</span></div>`).join('');
  }
}

/* ---------- Oszilloskop zeichnen ---------- */
function drawScope(cvs) {
  if (!cvs) return;
  const r = cvs.getBoundingClientRect(), dp = window.devicePixelRatio || 1;
  const W = Math.round((r.width || 320) * dp), H = Math.round((r.height || 190) * dp);
  if (cvs.width !== W) cvs.width = W; if (cvs.height !== H) cvs.height = H;
  const c = cvs.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#0b130e'; c.fillRect(0, 0, W, H);
  const gx = 10, gy = 8, px = W / gx, py = H / gy;
  c.strokeStyle = 'rgba(120,200,130,.28)'; c.lineWidth = 1;
  c.beginPath(); for (let i = 0; i <= gx; i++) { c.moveTo(i * px, 0); c.lineTo(i * px, H); } for (let j = 0; j <= gy; j++) { c.moveTo(0, j * py); c.lineTo(W, j * py); } c.stroke();
  c.strokeStyle = 'rgba(120,200,130,.55)'; c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.stroke();
  if (!scope.ch[0] && !scope.ch[1]) { c.fillStyle = 'rgba(200,230,200,.7)'; c.font = `${12 * dp}px sans-serif`; c.textAlign = 'center'; c.fillText('Werkzeug „Oszi“: Punkt im Layout antippen', W / 2, H / 2 - 8 * dp); return; }
  const Wt = 10 * scope.tdiv, tEnd = sim.t;
  // Stützstellen im Puffer von hinten nach vorn einsammeln
  const idxs = []; const tMin = tEnd - 2 * Wt;
  for (let i = 0; i < buf.n; i++) { const k = ((buf.head - 1 - i) % CAP + CAP) % CAP; if (buf.t[k] < tMin) break; idxs.push(k); }
  idxs.reverse();
  if (idxs.length < 2) return;
  // Auslöser: steigende Flanke von Kanal 1 (oder 2), Pegel in der Mitte
  const trigC = scope.ch[0] ? 'a' : 'b';
  let tStart = Math.max(buf.t[idxs[0]], tEnd - Wt);
  if (tEnd >= 2 * Wt) {
    let mn = 1e9, mx = -1e9; idxs.forEach(k => { mn = Math.min(mn, buf[trigC][k]); mx = Math.max(mx, buf[trigC][k]); });
    if (mx - mn > 1e-3) {
      const lvl = (mn + mx) / 2; let found = null;
      for (let i = 1; i < idxs.length; i++) {
        const t = buf.t[idxs[i]]; if (t > tEnd - Wt) break;
        if (buf[trigC][idxs[i - 1]] < lvl && buf[trigC][idxs[i]] >= lvl) found = t;
      }
      if (found != null) tStart = found;
    }
  }
  [['a', 0, '#ffd23f'], ['b', 1, '#35d0ff']].forEach(([k, ci, col]) => {
    if (!scope.ch[ci]) return;
    c.strokeStyle = col; c.lineWidth = 2 * dp; c.beginPath(); let first = true;
    for (const id of idxs) {
      const t = buf.t[id]; if (t < tStart) continue; if (t > tStart + Wt) break;
      const x = (t - tStart) / Wt * W, y = H / 2 - buf[k][id] / scope.vdiv[ci] * py;
      if (first) { c.moveTo(x, y); first = false; } else c.lineTo(x, y);
    }
    c.stroke();
  });
  c.font = `${11 * dp}px sans-serif`; c.textAlign = 'left';
  c.fillStyle = '#ffd23f'; if (scope.ch[0]) c.fillText('K1 ' + vdivLabel(scope.vdiv[0]) + '/Div', 6 * dp, H - 6 * dp);
  c.fillStyle = '#35d0ff'; if (scope.ch[1]) c.fillText('K2 ' + vdivLabel(scope.vdiv[1]) + '/Div', 110 * dp, H - 6 * dp);
  c.fillStyle = '#c8e6c8'; c.textAlign = 'right'; c.fillText(tdivLabel(scope.tdiv) + '/Div', W - 6 * dp, H - 6 * dp);
}

})();
