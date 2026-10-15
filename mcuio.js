/* Tonfunk Lab: Brücke zwischen den Programmen (Arduino-C++, Python) und dem Schaltungskern.
   ard(el, X) und pi(el, X) liefern das io-Objekt für den Interpreter.
   X: S = Simulation, C = Schaltung, print = Textausgabe, rx = Eingabepuffer (Serial), lcd = LCD-Rückruf (alles per Getter, damit nach einem Neuaufbau der Schaltung die aktuellen Objekte benutzt werden). */
(function (root) {
'use strict';
const LS = root.LochSim;
function ard(el, X) {
  const m = el.mcu, node = q => el.nd[el.pinNode(q)], ok = q => q >= 0 && q < 20, SIMT = () => X.S.t;
  return {
    pinMode: (q, md) => { if (ok(q)) { m.mode[q] = md; if (md === 2) m.lastDig[q] = 1; } },
    digitalWrite: (q, v, vt) => { if (!ok(q)) return; m.out[q] = v; m.duty[q] = null; const pl = m.pulse[q] || (m.pulse[q] = {}); if (v) { pl.rise = vt == null ? SIMT() : vt; pl.fall = null; pl.used = false; } else if (pl.rise != null && pl.fall == null) pl.fall = vt == null ? SIMT() : vt; },
    digitalRead: q => { if (!ok(q)) return 0; if (m.mode[q] === 1) return m.level[q]; if (m.mode[q] === 2 && SIMT() < 2e-3) return 1; const vv = X.S.v[node(q)]; if (vv > 3) m.lastDig[q] = 1; else if (vv < 1.5) m.lastDig[q] = 0; return m.lastDig[q]; },
    analogRead: q => (ok(q) ? X.S.v[node(q)] / 5 * 1023 : 0),
    analogWrite: (q, v) => { if (!ok(q)) return; m.mode[q] = 1; if ([3, 5, 6, 9, 10, 11].includes(q)) m.duty[q] = v; else { m.duty[q] = null; m.out[q] = v >= 128 ? 1 : 0; } },
    tone: (q, f, dd) => { if (!ok(q)) return; m.mode[q] = 1; m.tone[q] = { f: Math.max(1, f), until: dd ? SIMT() + dd / 1000 : null }; },
    noTone: q => { if (ok(q)) m.tone[q] = null; },
    serialPrint: s => X.print(s), serialAvailable: () => (X.rx ? X.rx.length : 0), serialRead: () => (X.rx && X.rx.length ? X.rx.shift() : -1),
    servo: (q, cmd, a) => { if (cmd === 'detach') delete m.servo[q]; else m.servo[q] = a; },
    lcd: (o, name, a) => (X.lcd ? X.lcd(name, a) : 0), object: () => {},
    touch: q => { const nd = node(q), e = X.C.elems.find(x => x.type === 'TCH' && x.a === nd); return e ? Math.round(8 + (e.part.pos || 0) * 2000) : 0; },
    pulseHint: q => { const e = X.C.elems.find(x => x.type === 'SENS' && x.dev === 'HCSR04' && x.echoPin === q); return e ? e.lastEcho : null; },
  };
}
function pi(el, X) {
  const m = el.mcu, node = g => el.nd[el.pinNode(g)], SIMT = () => X.S.t, MODE = { out: 1, in: 0, up: 2, down: 3 };
  return {
    setMode: (g, md) => { m.mode[g] = MODE[md]; if (md === 'up') m.lastDig[g] = 1; if (md === 'out') m.duty[g] = null; },
    write: (g, v, vt) => { m.out[g] = v ? 1 : 0; m.duty[g] = null; const pl = m.pulse[g] || (m.pulse[g] = {}); if (v) { pl.rise = vt == null ? SIMT() : vt; pl.fall = null; pl.used = false; } else if (pl.rise != null && pl.fall == null) pl.fall = vt == null ? SIMT() : vt; },
    read: g => { if (m.mode[g] === 1) return m.level[g]; if (m.mode[g] === 2 && SIMT() < 2e-3) return 1; const vv = X.S.v[node(g)]; if (vv > 2.0) m.lastDig[g] = 1; else if (vv < 1.0) m.lastDig[g] = 0; return m.lastDig[g]; },
    pwm: (g, dd) => { m.duty[g] = dd == null ? null : dd; },
    servo: (g, deg) => { if (deg == null) delete m.servo[g]; else m.servo[g] = deg; },
    tone: (g, f) => { m.tone[g] = f ? { f } : null; },
    echo: g => { const e = X.C.elems.find(x => x.type === 'SENS' && x.dev === 'HCSR04' && x.echoPin === g); return e ? e.lastEcho : null; },
    adc: (ch, spec) => {
      const e = X.C.elems.find(x => x.type === 'ADC'); if (!e) return { err: 'Es ist kein MCP3008 in der Schaltung.' };
      const v = i => X.S.v[e.nd[i]], gnd = v(3);
      if (!(v(0) - gnd > 2.4)) return { err: 'MCP3008 ohne Versorgung: VDD an 3,3 V und DGND an Masse anschließen.' };
      if (!(v(1) - v(2) > 2.0)) return { err: 'MCP3008 ohne Referenzspannung: VREF an 3,3 V und AGND an Masse anschließen.' };
      const pins = e.spi || {};
      for (const [nm, k] of [['CLK', 'clk'], ['DOUT (MISO)', 'miso'], ['DIN (MOSI)', 'mosi'], ['CS', 'cs']]) {
        const have = pins[k], want = k === 'cs' && spec.hw ? [8, 7] : [spec[k]];
        if (!want.includes(have)) return { err: 'MCP3008 antwortet nicht: ' + nm + ' ' + (have >= 0 ? 'liegt an GPIO' + have : 'ist mit keinem GPIO verbunden') + ', erwartet wird GPIO' + want.join(' oder GPIO') + (spec.hw ? ' (Hardware-SPI)' : '') + '.' };
      }
      const vr = v(1) - v(2), val = Math.max(0, Math.min(1, (v(8 + ch) - v(2)) / vr)); return { value: val, raw: Math.round(val * 1023) };
    },
    i2c: (addr, wr, n) => LS.i2cXfer(X.C, X.S, addr, wr, n),
    print: t => X.print(t),
  };
}
root.LochMcuIO = { ard, pi };
})(typeof window !== 'undefined' ? window : globalThis);
