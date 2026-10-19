(function (root) {
  'use strict';
  const R = root.SEN_RIGS = root.SEN_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===== Pruefstand 6: Digitale Sensoren (Feuchte/Gas/Abstand) am I2C-Bus mit Mini-Logikanalysator =====
  // Eigenes, gekapseltes Modell (bei Bedarf gegen SEN_CORE.i2c austauschbar):
  //   Telegramm: Start, Adresse(7)+R/W, ACK, Datenbytes, Stopp; offener Kollektor (Wired-AND), Pull-up Rp, Buskapazitaet C
  //   Flanke: steigend nach RC (v = 1 - exp(-t/(Rp*C))), fallend sofort. Anstiegszeit tr = 0,8473*Rp*C (30...70 %)
  //   Dekodierung: der Controller tastet SDA/SCL am Ende jedes Bits ab (Schwellen 30 % / 70 % von Vdd) -> zu langsame Flanken
  //   erzeugen ungueltige Bits; Adresskonflikt = zwei Antworter (AND der Daten) -> CRC-8 falsch; falsche Adresse -> NACK
  //   Ultraschall (HC-SR04-aehnlich): kein I2C, Echo-Impulsdauer = 2*d/c, Schallgeschwindigkeit c = 331,3 + 0,606*T
  const WW = 1000, WH = 560;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const MONO = '"Consolas", "SF Mono", Menlo, monospace';
  const C = { bg: '#14181c', panel: '#222830', panel2: '#2a323b', line: '#3a444f', acc: '#3b9eff', ok: '#4cd964', warn: '#ffb340', bad: '#ff5c5c', text: '#e6edf3', dim: '#8b98a5' };
  const TWO_PI = Math.PI * 2;
  const GREEN = [76, 217, 100], BLUE = [59, 158, 255], AMB = [255, 179, 64], RED = [255, 92, 92];
  const VDD = 3.3, SLOT_MS = 36, COOL_SLOTS = 22, GAP_SLOTS = 5, STRETCH_SLOTS = 7, PULSE_MS = 900, WIN = 22, TF = 0.02;
  const SENS = {
    sht: { name: 'Temperatur/Feuchte (SHT-ähnlich)', def: 0x44, cmd: [0x24, 0x00], n: 6 },
    gas: { name: 'Gas (SGP-ähnlich, digital)', def: 0x58, cmd: [0x20, 0x08], n: 6 },
    tof: { name: 'Abstand ToF (VL53-ähnlich)', def: 0x29, cmd: [0x1E], n: 2 },
    us: { name: 'Ultraschall (HC-SR04-ähnlich)', def: 0, cmd: [], n: 0, pulse: true }
  };

  const hexN = (v, n) => { let s = (v >>> 0).toString(16).toUpperCase(); while (s.length < n) s = '0' + s; return '0x' + s; };
  const CONTROLS = [
    { key: 'sensor', label: 'Sensor', type: 'select', value: 'sht', group: 'Sensor', options: [{ value: 'sht', label: 'Temperatur/Feuchte (SHT-ähnlich)' }, { value: 'gas', label: 'Gas (digital, I²C)' }, { value: 'tof', label: 'Abstand ToF (I²C)' }, { value: 'us', label: 'Ultraschall (Impulslaufzeit)' }], help: 'Die ersten drei Sensoren sprechen I²C. Der Ultraschallsensor liefert einen Echo-Impuls, dessen Dauer die Entfernung angibt.' },
    { key: 'temp', label: 'Temperatur', type: 'slider', min: -40, max: 125, step: 0.5, unit: '°C', value: 23, group: 'Messgröße', help: 'Beim Ultraschallsensor ändert die Temperatur die Schallgeschwindigkeit (c = 331,3 + 0,606·T).' },
    { key: 'rh', label: 'Relative Feuchte', type: 'slider', min: 0, max: 100, step: 0.5, unit: '%', value: 45, group: 'Messgröße', help: 'Relative Luftfeuchte in Prozent.' },
    { key: 'gas', label: 'Gas (CO₂-Äquivalent)', type: 'slider', min: 0, max: 5000, step: 10, unit: 'ppm', value: 800, group: 'Messgröße', help: 'Gaskonzentration in ppm.' },
    { key: 'dist', label: 'Abstand', type: 'slider', min: 30, max: 2500, step: 10, unit: 'mm', value: 500, group: 'Messgröße', help: 'Entfernung zum Hindernis. Der ToF-Sensor meldet über 2000 mm "außer Reichweite" (8190).' },
    { key: 'addr', label: 'Adresse im Controller', type: 'select', value: 0x44, group: 'I²C-Adresse', options: [{ value: 0x29, label: '0x29' }, { value: 0x44, label: '0x44' }, { value: 0x45, label: '0x45' }, { value: 0x48, label: '0x48' }, { value: 0x58, label: '0x58' }], help: 'Diese Adresse ruft das Programm im Controller auf. Der Sensor muss unter genau dieser Adresse hören, sonst kommt kein ACK.' },
    { key: 'addrPin', label: 'ADDR-Pin des SHT', type: 'select', value: 'low', group: 'I²C-Adresse', options: [{ value: 'low', label: 'Low → 0x44' }, { value: 'high', label: 'High → 0x45' }], help: 'Der SHT legt seine Adresse über einen Pin fest. Gas- und ToF-Sensor haben feste Adressen (0x58, 0x29).' },
    { key: 'twin', label: 'Zweiter gleicher Sensor am Bus', type: 'switch', value: false, group: 'I²C-Adresse', help: 'Ein zweiter Sensor derselben Bauart mit der Standardadresse. Hören beide auf dieselbe Adresse, gibt es einen Adresskonflikt.' },
    { key: 'pullup', label: 'Pull-up-Widerstand', type: 'select', value: 4700, group: 'Bus', options: [{ value: 1000, label: '1 kΩ' }, { value: 2200, label: '2,2 kΩ' }, { value: 4700, label: '4,7 kΩ' }, { value: 10000, label: '10 kΩ' }, { value: 22000, label: '22 kΩ' }, { value: 47000, label: '47 kΩ' }], help: 'Zieht SDA und SCL nach High. Zu groß: langsame Flanken. Zu klein: hoher Strom, Low-Pegel wird schlecht.' },
    { key: 'busSpeed', label: 'Busgeschwindigkeit', type: 'select', value: 100000, group: 'Bus', options: [{ value: 100000, label: '100 kHz (Standard)' }, { value: 400000, label: '400 kHz (Fast)' }], help: 'Bei 400 kHz bleibt für die Flanken viel weniger Zeit.' },
    { key: 'busLength', label: 'Buslänge (Kabel)', type: 'slider', min: 0.1, max: 10, step: 0.1, unit: 'm', value: 0.3, group: 'Bus', help: 'Jeder Meter Kabel bringt etwa 80 pF. Mehr Kapazität bedeutet langsamere Flanken (RC-Glied mit dem Pull-up).' },
    { key: 'stretch', label: 'Clock-Stretching des Sensors', type: 'switch', value: false, group: 'Bus', help: 'Der Sensor hält SCL kurz auf Low, bis seine Messung fertig ist. Der Controller muss warten.' }
  ];
  const METERS = [
    { key: 'tShown', label: 'Temperatur (angezeigt)', unit: '°C', digits: 2, min: -40, max: 125 },
    { key: 'rhShown', label: 'Feuchte (angezeigt)', unit: '%', digits: 1, min: 0, max: 100 },
    { key: 'gasShown', label: 'Gas (angezeigt)', unit: 'ppm', digits: 0, min: 0, max: 5000 },
    { key: 'distShown', label: 'Abstand (angezeigt)', unit: 'mm', digits: 0, min: 0, max: 2500 },
    { key: 'errorRate', label: 'Fehlerrate', unit: '%', digits: 0, min: 0, max: 100, warnAbove: 10 },
    { key: 'acks', label: 'ACKs (gezählt)', unit: '', digits: 0, min: 0, max: 999 },
    { key: 'tr', label: 'Anstiegszeit', unit: 'ns', digits: 0, min: 0, max: 5000 },
    { key: 'cBus', label: 'Buskapazität', unit: 'pF', digits: 0, min: 0, max: 1000, warnAbove: 400 }
  ];
  const PRESETS = [
    { id: 'ok', name: 'Sauberer Bus (4,7 kΩ, 0,3 m)', params: { sensor: 'sht', addr: 0x44, addrPin: 'low', twin: false, pullup: 4700, busSpeed: 100000, busLength: 0.3, stretch: false } },
    { id: 'pull_gross', name: 'Pull-up zu groß (47 kΩ, 2 m)', params: { sensor: 'sht', addr: 0x44, addrPin: 'low', twin: false, pullup: 47000, busSpeed: 100000, busLength: 2, stretch: false } },
    { id: 'schnell', name: '400 kHz mit 10 kΩ und 1 m', params: { sensor: 'sht', addr: 0x44, addrPin: 'low', twin: false, pullup: 10000, busSpeed: 400000, busLength: 1, stretch: false } },
    { id: 'nack', name: 'Falsche Adresse (NACK)', params: { sensor: 'sht', addr: 0x45, addrPin: 'low', twin: false, pullup: 4700, busSpeed: 100000, busLength: 0.3 } },
    { id: 'konflikt', name: 'Adresskonflikt (zwei Sensoren 0x44)', params: { sensor: 'sht', addr: 0x44, addrPin: 'low', twin: true, pullup: 4700, busSpeed: 100000, busLength: 0.3 } },
    { id: 'konflikt_gelöst', name: 'Konflikt gelöst (ADDR-Pin High)', params: { sensor: 'sht', addr: 0x45, addrPin: 'high', twin: true, pullup: 4700, busSpeed: 100000, busLength: 0.3 } },
    { id: 'gas', name: 'Gassensor 1500 ppm', params: { sensor: 'gas', gas: 1500, addr: 0x58, twin: false, pullup: 4700, busSpeed: 100000, busLength: 0.3 } },
    { id: 'tof', name: 'ToF-Abstand 500 mm', params: { sensor: 'tof', dist: 500, addr: 0x29, twin: false, pullup: 4700, busSpeed: 400000, busLength: 0.3 } },
    { id: 'us', name: 'Ultraschall 1000 mm bei 23 °C', params: { sensor: 'us', dist: 1000, temp: 23 } },
    { id: 'us_kalt', name: 'Ultraschall bei −20 °C (Fehler)', params: { sensor: 'us', dist: 1000, temp: -20 } }
  ];

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const fr = x => x - Math.floor(x);
  const num = (v, d) => { v = +v; return isFinite(v) ? v : d; };
  const f1 = (v, d) => (+v).toFixed(d == null ? 1 : d).replace('.', ',');
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function txt(ctx, s, x, y, size, color, align, bold, font) {
    ctx.font = (bold ? 'bold ' : '') + size + 'px ' + (font || FONT);
    ctx.fillStyle = color || C.text; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function panel(ctx, x, y, w, h, title) {
    ctx.fillStyle = C.panel; rr(ctx, x, y, w, h, 12); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
    if (title) txt(ctx, title, x + 14, y + 16, 12, C.dim, 'left', true);
  }
  function crc8(bytes) { let c = 0xFF; for (let i = 0; i < bytes.length; i++) { c ^= bytes[i] & 255; for (let k = 0; k < 8; k++) c = (c & 0x80) ? ((c << 1) ^ 0x31) & 255 : (c << 1) & 255; } return c; }
  const soundSpeed = T => 331.3 + 0.606 * T;

  // Spannungsverlauf einer Leitung aus Flankenliste (steigend RC, fallend schnell)
  function mkWave(edges, tau) {
    const vb = []; let pv = 1, pt = -1e9, pl = 1;
    edges.forEach(e => { const dt = e.t - pt; pv = pl ? 1 - (1 - pv) * Math.exp(-dt / tau) : pv * Math.exp(-dt / TF); vb.push(pv); pt = e.t; pl = e.lvl; });
    return {
      v(t) {
        let lo = 0, hi = edges.length - 1, k = -1;
        while (lo <= hi) { const m = (lo + hi) >> 1; if (edges[m].t <= t) { k = m; lo = m + 1; } else hi = m - 1; }
        if (k < 0) return 1;
        const dt = t - edges[k].t;
        return edges[k].lvl ? 1 - (1 - vb[k]) * Math.exp(-dt / tau) : vb[k] * Math.exp(-dt / TF);
      }
    };
  }

  function create(opts) {
    opts = opts || {};
    const ctl = JSON.parse(JSON.stringify(CONTROLS));
    const defOf = {}; ctl.forEach(c => { defOf[c.key] = c; });
    const Cv = {}; ctl.forEach(c => { Cv[c.key] = c.value; });
    const events = [];
    let S, V;

    const hwAddr = () => Cv.sensor === 'sht' ? (Cv.addrPin === 'high' ? 0x45 : 0x44) : SENS[Cv.sensor].def;
    const twinAddr = () => SENS[Cv.sensor].def;
    const devCount = () => 2 + (Cv.twin ? 1 : 0);
    const cBus = () => 30 + 10 * devCount() + 80 * Cv.busLength;                // pF
    const tauSec = () => Cv.pullup * cBus() * 1e-12;
    const trNs = () => 0.8473 * Cv.pullup * cBus() * 1e-12 * 1e9;
    const limNs = () => Cv.busSpeed >= 400000 ? 300 : 1000;
    const tauSlots = () => tauSec() * Cv.busSpeed;

    function resetState() {
      S = { t: 0, tf: Cv.temp, rhf: Cv.rh, gf: Cv.gas, df: Cv.dist, tx: null, nextAt: 0, ring: [], acks: 0, txCount: 0, txFail: 0, reason: '', capAct: false, lowAct: false,
        val: { t: Cv.temp, rh: Cv.rh, gas: Cv.gas, dist: Cv.dist }, lastBytes: [], lastFrames: [], lastOk: true, lastReason: '', crcOk: true };
      S.val = trueVals(false);
      V = { };
      events.length = 0;
    }
    function ev(text, kind, fx, x, y) {
      const e = { t: Math.round(S.t), text, kind: kind || 'info' };
      if (fx) { e.fx = fx; if (x != null) { e.x = x; e.y = y; } }
      events.push(e); if (events.length > 300) events.splice(0, events.length - 300);
    }
    function trueVals(twin) {
      return twin ? { t: clamp(S.tf + 3.7, -40, 125), rh: clamp(S.rhf + 9, 0, 100), gas: clamp(S.gf * 1.3 + 50, 0, 5000), dist: clamp(S.df * 0.8, 30, 2500) }
        : { t: S.tf, rh: S.rhf, gas: S.gf, dist: S.df };
    }
    // Datenbytes eines Geraets (Sensor oder Zwilling)
    function dataBytes(twin) {
      const v = trueVals(twin), type = Cv.sensor;
      if (type === 'sht') {
        const rt = clamp(Math.round((v.t + 45) / 175 * 65535), 0, 65535), rh = clamp(Math.round(v.rh / 100 * 65535), 0, 65535);
        const b = [rt >> 8, rt & 255, 0, rh >> 8, rh & 255, 0]; b[2] = crc8([b[0], b[1]]); b[5] = crc8([b[3], b[4]]); return b;
      }
      if (type === 'gas') {
        const w1 = clamp(Math.round(v.gas), 0, 65535), w2 = clamp(Math.round(v.gas * 0.18), 0, 65535);
        const b = [w1 >> 8, w1 & 255, 0, w2 >> 8, w2 & 255, 0]; b[2] = crc8([b[0], b[1]]); b[5] = crc8([b[3], b[4]]); return b;
      }
      const d = v.dist > 2000 ? 8190 : Math.round(v.dist);
      return [d >> 8, d & 255];
    }

    // ---- Telegramm aufbauen und aus der Analogkurve dekodieren ----
    function buildTx() {
      const type = Cv.sensor, def = SENS[type];
      if (def.pulse) return buildPulse();
      const slots = [], frames = [], addr = Cv.addr;
      const devs = [{ id: 'sensor', addr: hwAddr(), twin: false }];
      if (Cv.twin) devs.push({ id: 'twin', addr: twinAddr(), twin: true });
      const resp = devs.filter(d => d.addr === addr);
      const push = (type2, bit) => { slots.push({ type: type2, bit }); return slots.length - 1; };
      const fr2 = (kind, s0, s1, role, exp) => frames.push({ kind, s0, s1, role, exp });
      const startC = () => { const i = push('S'); fr2('S', i, i + 1); };
      const stopC = () => { const i = push('P'); fr2('P', i, i + 1); };
      const addrB = (rw) => {
        const s0 = slots.length;
        for (let b = 6; b >= 0; b--) push('bit', (addr >> b) & 1);
        fr2('ADDR', s0, s0 + 7, 'addr', addr);
        push('bit', rw); fr2('RW', s0 + 7, s0 + 8, 'rw', rw);
        const ack = resp.length > 0, a = push('bit', ack ? 0 : 1); fr2('ACK', a, a + 1, 'ack', 0);
        return ack;
      };
      const wB = (v, ack) => { const s0 = slots.length; for (let b = 7; b >= 0; b--) push('bit', (v >> b) & 1); fr2('DATA', s0, s0 + 8, 'cmd', v); const a = push('bit', ack ? 0 : 1); fr2('ACK', a, a + 1, 'ack', 0); };
      const rBytes = (n) => {
        const bytes = resp.map(d => dataBytes(d.twin));
        for (let k = 0; k < n; k++) {
          let v = 255; bytes.forEach(b => { v &= b[k]; });
          const s0 = slots.length; for (let b = 7; b >= 0; b--) push('bit', (v >> b) & 1); fr2('DATA', s0, s0 + 8, 'rd', v);
          const last = k === n - 1, a = push('bit', last ? 1 : 0); fr2(last ? 'NACK' : 'ACK', a, a + 1, 'ackM', last ? 1 : 0);
        }
      };
      const stretch = () => { const s0 = slots.length; for (let k = 0; k < STRETCH_SLOTS; k++) push('str'); fr2('STR', s0, s0 + STRETCH_SLOTS, 'str'); };
      const idle = n => { for (let k = 0; k < n; k++) push('idle'); };
      const ackAddr = {};
      if (type === 'tof') {
        startC(); const a1 = addrB(0);
        if (a1) {
          wB(def.cmd[0], true);
          { const i = push('Sr'); fr2('Sr', i, i + 1); }
          const a2 = addrB(1); if (a2) rBytes(2);
        }
        stopC();
      } else {
        startC(); const a1 = addrB(0);
        if (a1) { wB(def.cmd[0], true); wB(def.cmd[1], true); }
        stopC();
        if (a1) {
          idle(GAP_SLOTS); startC(); const a2 = addrB(1);
          if (a2) { if (Cv.stretch && type === 'sht') stretch(); rBytes(6); }
          stopC();
        }
      }
      // Flankenlisten
      const sda = [], scl = []; let cs = 1, cd = 1;
      const edge = (arr, t, lvl) => { const cur = arr === sda ? cd : cs; if (cur === lvl) return; arr.push({ t, lvl }); if (arr === sda) cd = lvl; else cs = lvl; };
      slots.forEach((s, i) => {
        if (s.type === 'S') { edge(sda, i + 0.3, 0); edge(scl, i + 0.75, 0); }
        else if (s.type === 'Sr') { edge(sda, i + 0.1, 1); edge(scl, i + 0.35, 1); edge(sda, i + 0.6, 0); edge(scl, i + 0.85, 0); }
        else if (s.type === 'bit') { edge(scl, i, 0); edge(sda, i + 0.2, s.bit); edge(scl, i + 0.5, 1); }
        else if (s.type === 'str') { edge(scl, i, 0); edge(sda, i + 0.2, 1); }
        else if (s.type === 'P') { edge(scl, i, 0); edge(sda, i + 0.2, 0); edge(scl, i + 0.5, 1); edge(sda, i + 0.8, 1); }
      });
      const tau = tauSlots(), ws = mkWave(sda, tau), wc = mkWave(scl, tau);
      const sample = i => { const vc = wc.v(i + 0.97), vd = ws.v(i + 0.97); if (vc < 0.7) return -1; return vd >= 0.7 ? 1 : vd <= 0.3 ? 0 : -1; };
      // Dekodierung
      let bad = false, acks = 0, addrNack = false, bytes = [];
      frames.forEach(f => {
        if (f.kind === 'S' || f.kind === 'Sr') { f.ok = wc.v(f.s0 + 0.28) >= 0.7; f.text = f.kind === 'S' ? 'Start' : 'Sr'; if (!f.ok) { f.text += '?'; bad = true; } return; }
        if (f.kind === 'P') { f.ok = wc.v(f.s0 + 0.78) >= 0.7; f.text = 'Stopp'; if (!f.ok) { f.text += '?'; bad = true; } return; }
        if (f.kind === 'STR') { f.ok = true; f.text = 'Clock-Stretching'; return; }
        let val = 0, inv = false;
        for (let i = f.s0; i < f.s1; i++) { const b = sample(i); if (b < 0) inv = true; val = (val << 1) | (b > 0 ? 1 : 0); }
        f.val = val; f.inv = inv;
        if (f.kind === 'ADDR') { f.ok = !inv; f.text = inv ? 'Adr ?' : 'Adr ' + hexN(val, 2); }
        else if (f.kind === 'RW') { f.ok = !inv; f.text = inv ? '?' : val ? 'R' : 'W'; }
        else if (f.kind === 'DATA') { f.ok = !inv; f.text = inv ? '??' : hexN(val, 2); if (!inv && f.role === 'rd') bytes.push(val); }
        else { // ACK / NACK
          const exp = f.exp; f.ok = !inv && (f.role === 'ackM' ? true : val === 0);
          if (inv) f.text = 'A?'; else if (f.role === 'ackM') { f.text = val ? 'NACK' : 'ACK'; if (!val) acks++; } else { f.text = val ? 'NACK' : 'ACK'; if (!val) acks++; else if (resp.length === 0) addrNack = true; }
        }
        if (inv) bad = true;
      });
      const nExp = def.n, complete = bytes.length === nExp;
      let crcBad = false;
      if (!addrNack && !bad && complete && (type === 'sht' || type === 'gas')) { if (crc8([bytes[0], bytes[1]]) !== bytes[2] || crc8([bytes[3], bytes[4]]) !== bytes[5]) crcBad = true; }
      const incomplete = !addrNack && !bad && !complete;
      const res = { addrNack, bad, crcBad, conflict: resp.length > 1, acks, bytes, ok: false, reason: '', resp: resp.length, readsTwin: resp.length === 1 && resp[0].twin };
      res.reason = addrNack ? 'nack' : res.conflict && (crcBad || bad) ? 'conflict' : bad ? 'slow' : crcBad ? 'crc' : incomplete ? 'incomplete' : '';
      if (res.conflict && !res.reason) res.reason = 'conflict';
      res.ok = !res.reason;
      const total = slots.length;
      return { type, slots, frames, total, sda, scl, tau, res, t0: S.t, wsda: ws, wscl: wc, pulse: false };
    }
    function buildPulse() {
      const c = soundSpeed(S.tf), tEcho = 2 * S.df / 1000 / c * 1000;     // ms
      const frames = [
        { kind: 'TRIG', t0: 1.0, t1: 1.4, text: 'Trig 10 µs' }, { kind: 'BURST', t0: 1.4, t1: 1.8, text: '8 × 40 kHz' },
        { kind: 'FLY', t0: 1.8, t1: 1.8 + tEcho, text: 'Schall unterwegs (hin und zurück)' }
      ];
      const shown = 343 * tEcho / 1000 / 2 * 1000;
      return { type: 'us', pulse: true, tEcho, c, frames, total: 28, t0: S.t, shown, res: { ok: true, reason: '', acks: 0, bytes: [] } };
    }

    function finishTx() {
      const tx = S.tx, r = tx.res;
      S.txCount++;
      if (tx.pulse) { S.val.dist = tx.shown; S.lastOk = true; return; }
      S.acks += r.acks;
      S.lastBytes = r.bytes.slice(); S.lastFrames = tx.frames; S.crcOk = !r.crcBad;
      S.ring.push(r.ok ? 0 : 1); if (S.ring.length > 10) S.ring.shift();
      if (!r.ok) S.txFail++;
      const a = hexN(Cv.addr, 2);
      if (r.ok) {
        const b = r.bytes, type = tx.type;
        if (type === 'sht') { S.val.t = -45 + 175 * ((b[0] << 8) | b[1]) / 65535; S.val.rh = 100 * ((b[3] << 8) | b[4]) / 65535; }
        else if (type === 'gas') S.val.gas = (b[0] << 8) | b[1];
        else S.val.dist = (b[0] << 8) | b[1];
        if (S.lastReason && S.lastReason !== 'twin') ev('Der Bus arbeitet wieder fehlerfrei. Messwert angekommen.', 'info');
        if (r.readsTwin) { if (S.lastReason !== 'twin') ev('Achtung: Die Adresse ' + a + ' gehört hier dem zweiten Sensor. Du liest die Werte des falschen Geräts!', 'warn'); S.lastReason = 'twin'; }
        else S.lastReason = '';
      } else if (r.reason !== S.lastReason) {
        S.lastReason = r.reason;
        const pos = [380, 160];
        if (r.reason === 'nack') ev('Kein ACK! Der Controller ruft die Adresse ' + a + ' auf, aber der Sensor hört auf ' + hexN(hwAddr(), 2) + '. Niemand zieht SDA im neunten Takt nach Low (NACK). Prüfe die Adresse.', 'error', 'stall', pos[0], pos[1]);
        else if (r.reason === 'conflict') ev('Adresskonflikt! Zwei Geräte antworten auf ' + a + ' und treiben SDA gleichzeitig (Wired-AND). Die Daten sind verfälscht, die Prüfsumme (CRC-8) stimmt nicht. Gib einem Gerät eine andere Adresse.', 'error', 'stall', 440, 160);
        else if (r.reason === 'slow') ev('Datenfehler durch langsame Flanken! Anstiegszeit ' + f1(trNs(), 0) + ' ns (erlaubt: ' + limNs() + ' ns). Der Pull-up ' + f1(Cv.pullup / 1000, 1) + ' kΩ lädt die Buskapazität von ' + f1(cBus(), 0) + ' pF zu langsam. Nimm einen kleineren Pull-up, kürzeres Kabel oder 100 kHz.', 'error', 'stall', 260, 150);
        else if (r.reason === 'crc') ev('Prüfsummenfehler (CRC-8): Die empfangenen Daten sind nicht gültig. Der Messwert wird verworfen.', 'warn', 'stall', 380, 160);
        else ev('Telegramm unvollständig.', 'warn');
      }
      const cap = cBus() > 400, low = VDD / Cv.pullup > 0.003;
      if (cap && !S.capAct) { S.capAct = true; ev('Die Buskapazität (' + f1(cBus(), 0) + ' pF) liegt über 400 pF und damit außerhalb der I²C-Spezifikation.', 'warn'); } else if (!cap) S.capAct = false;
      if (low && !S.lowAct) { S.lowAct = true; ev('Der Pull-up ist sehr klein: Beim Low-Pegel fließen ' + f1(VDD / Cv.pullup * 1000, 1) + ' mA, mehr als die 3 mA, die ein Pin laut I²C-Norm aufnehmen muss.', 'info'); } else if (!low) S.lowAct = false;
    }

    function stepCore(dtMs) {
      let rem = dtMs;
      while (rem > 0) {
        const d = Math.min(rem, 20); rem -= d; S.t += d;
        const k = (tc) => 1 - Math.exp(-d / tc);
        S.tf += (Cv.temp - S.tf) * k(1500); S.rhf += (Cv.rh - S.rhf) * k(2000); S.gf += (Cv.gas - S.gf) * k(1000); S.df += (Cv.dist - S.df) * k(150);
        if (!S.tx) { if (S.t >= S.nextAt) { S.tx = buildTx(); S.tx.t0 = S.t; } }
        else {
          const tx = S.tx, dur = tx.pulse ? PULSE_MS : (tx.total + COOL_SLOTS) * SLOT_MS;
          const el = S.t - tx.t0, endAt = tx.pulse ? PULSE_MS * 0.8 : tx.total * SLOT_MS;
          if (!tx.done && el >= endAt) { tx.done = true; finishTx(); }
          if (el >= dur) { S.tx = null; S.nextAt = S.t; }
        }
      }
    }

    function setControl(key, value) {
      const d = defOf[key]; if (!d) return;
      let v;
      if (d.type === 'switch' || d.type === 'button') v = !!value && value !== 'false' && value !== '0';
      else if (d.type === 'slider') v = clamp(num(value, d.value), d.min, d.max);
      else { const o = d.options.find(x => String(x.value) === String(value)); v = o ? o.value : d.value; }
      const old = Cv[key]; Cv[key] = v;
      if (key === 'sensor' && old !== v && SENS[v].def) Cv.addr = SENS[v].def;
      if (key === 'sensor' && old !== v && S) { S.tx = null; S.nextAt = S.t; S.lastReason = ''; }
    }
    function applyPreset(id) {
      const p = PRESETS.find(x => x.id === id); if (!p) return false;
      if (p.params.sensor) setControl('sensor', p.params.sensor);
      Object.keys(p.params).forEach(k => { if (k !== 'sensor') setControl(k, p.params[k]); });
      return true;
    }

    const errRate = () => S.ring.length ? S.ring.reduce((a, b) => a + b, 0) / S.ring.length * 100 : 0;
    function readMeters() {
      return { tShown: S.val.t, rhShown: S.val.rh, gasShown: S.val.gas, distShown: S.val.dist, errorRate: Cv.sensor === 'us' ? 0 : errRate(), acks: S.acks, tr: trNs(), cBus: cBus() };
    }
    function state() {
      const type = Cv.sensor, hw = hwAddr(), ratio = trNs() / limNs(), faults = [];
      const devs = [hw].concat(Cv.twin ? [twinAddr()] : []);
      const nresp = type === 'us' ? 0 : devs.filter(a => a === Cv.addr).length;
      const nack = type !== 'us' && nresp === 0, conflict = nresp > 1;
      if (nack) faults.push('nack'); if (conflict) faults.push('conflict');
      if (type !== 'us' && S.lastReason === 'slow') faults.push('slow');
      if (type !== 'us' && S.lastReason === 'crc') faults.push('crc');
      if (type !== 'us' && ratio > 1) faults.push('tooSlow');
      if (cBus() > 400) faults.push('capacitance');
      const tx = S.tx;
      return {
        sensor: type, name: SENS[type].name, addr: Cv.addr, hwAddr: hw, twinAddr: Cv.twin ? twinAddr() : null, responders: nresp, nack, conflict, readsTwin: type !== 'us' && Cv.twin && nresp === 1 && hw !== Cv.addr && twinAddr() === Cv.addr,
        cBus: cBus(), tr: trNs(), trLimit: limNs(), ratio, tau: tauSec() * 1e9, tooSlow: ratio > 1, vol: VDD * 133 / (Cv.pullup + 133), iLow: VDD / Cv.pullup * 1000, pullupLow: VDD / Cv.pullup > 0.003,
        errorRate: type === 'us' ? 0 : errRate(), acks: S.acks, txCount: S.txCount, txFail: S.txFail, lastReason: S.lastReason, lastOk: S.lastReason === '', crcOk: S.crcOk,
        lastBytes: S.lastBytes.slice(), lastBytesHex: S.lastBytes.map(b => hexN(b, 2)), frames: S.lastFrames.map(f => ({ kind: f.kind, text: f.text, ok: f.ok })), telegram: S.lastFrames.map(f => f.text).join(' '),
        tShown: S.val.t, rhShown: S.val.rh, gasShown: S.val.gas, distShown: S.val.dist, tTrue: S.tf, rhTrue: S.rhf, gasTrue: S.gf, distTrue: S.df,
        soundSpeed: soundSpeed(S.tf), echoMs: tx && tx.pulse ? tx.tEcho : 2 * S.df / 1000 / soundSpeed(S.tf) * 1000,
        busy: !!S.tx, stretch: Cv.stretch, twin: Cv.twin, fault: faults.length > 0 && !(faults.length === 1 && faults[0] === 'tooSlow' && S.lastReason === ''), faults, t: S.t
      };
    }

    // ---- Kennlinien ----
    function curves() {
      const type = Cv.sensor, out = [];
      if (type === 'sht') {
        const a = [], b = [];
        for (let k = 0; k <= 40; k++) { const raw = Math.round(65535 * k / 40); a.push([raw, -45 + 175 * raw / 65535]); b.push([raw, 100 * raw / 65535]); }
        out.push({ id: 'raw', title: 'Rohwert → Messgröße (SHT-Datenblattformel)', xLabel: 'Rohwert', xUnit: 'Digit', yLabel: 'Messgröße', yUnit: '°C bzw. %',
          series: [{ name: 'T = −45 + 175·Roh/65535', points: a }, { name: 'RH = 100·Roh/65535', points: b }],
          marker: { x: Math.round((S.val.t + 45) / 175 * 65535), y: S.val.t } });
      } else if (type === 'gas') {
        const a = []; for (let p = 0; p <= 5000; p += 125) a.push([p, Math.min(65535, p)]);
        out.push({ id: 'raw', title: 'Gaskonzentration → Wort im Register', xLabel: 'Gas', xUnit: 'ppm', yLabel: 'Registerwert', yUnit: 'Digit', series: [{ name: 'CO₂-Äquivalent', points: a }, { name: 'TVOC (ppb)', points: a.map(p => [p[0], Math.round(p[0] * 0.18)]) }], marker: { x: S.gf, y: S.gf } });
      } else if (type === 'tof') {
        const a = []; for (let d = 0; d <= 2600; d += 100) a.push([d, d > 2000 ? 8190 : d]);
        out.push({ id: 'raw', title: 'Abstand → gemeldeter Wert (ToF)', xLabel: 'Abstand', xUnit: 'mm', yLabel: 'Wert', yUnit: 'mm', series: [{ name: 'gemeldet (8190 = außer Reichweite)', points: a }], marker: { x: S.df, y: S.df > 2000 ? 8190 : S.df } });
      } else {
        const a = [], b = []; for (let d = 30; d <= 2500; d += 70) { a.push([d, 2 * d / 1000 / soundSpeed(S.tf) * 1000]); b.push([d, 2 * d / 1000 / 343 * 1000]); }
        out.push({ id: 'echo', title: 'Abstand → Echo-Laufzeit', xLabel: 'Abstand', xUnit: 'mm', yLabel: 'Echo-Impuls', yUnit: 'ms', series: [{ name: 'bei ' + f1(S.tf, 0) + ' °C', points: a }, { name: 'bei 20 °C (c = 343 m/s)', points: b }], marker: { x: S.df, y: 2 * S.df / 1000 / soundSpeed(S.tf) * 1000 } });
      }
      // Anstiegszeit ueber den Pull-up
      const rp = [1000, 2200, 4700, 10000, 22000, 47000], s1 = [], s2 = [];
      rp.forEach(r => { s1.push([r / 1000, 0.8473 * r * cBus() * 1e-3]); s2.push([r / 1000, limNs()]); });
      out.push({ id: 'tr', title: 'Anstiegszeit über den Pull-up', xLabel: 'Pull-up', xUnit: 'kΩ', yLabel: 'Anstiegszeit tr', yUnit: 'ns', series: [{ name: 'tr = 0,8473·Rp·C (' + f1(cBus(), 0) + ' pF)', points: s1 }, { name: 'Grenze', points: s2 }], marker: { x: Cv.pullup / 1000, y: trNs() } });
      const cs = [], cl = []; for (let m = 0.1; m <= 10.01; m += 0.5) { cs.push([m, 0.8473 * Cv.pullup * (30 + 10 * devCount() + 80 * m) * 1e-3]); cl.push([m, limNs()]); }
      out.push({ id: 'trlen', title: 'Anstiegszeit über die Kabellänge', xLabel: 'Buslänge', xUnit: 'm', yLabel: 'Anstiegszeit tr', yUnit: 'ns', series: [{ name: 'tr mit ' + f1(Cv.pullup / 1000, 1) + ' kΩ', points: cs }, { name: 'Grenze', points: cl }], marker: { x: Cv.busLength, y: trNs() } });
      return out;
    }

    // ================= Zeichnen =================
    const SDA_Y = 196, SCL_Y = 160;
    function playhead() { const tx = S.tx; return tx && !tx.pulse ? (S.t - tx.t0) / SLOT_MS : -1; }
    function drawBus(ctx, t) {
      panel(ctx, 14, 52, 506, 236, null);
      txt(ctx, 'I²C-Bus', 28, 70, 12, C.dim, 'left', true);
      const slow = trNs() > limNs(), kv = Cv.sensor === 'us';
      // Versorgung und Pull-ups
      ctx.strokeStyle = '#ff6a5a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(176, 90); ctx.lineTo(300, 90); ctx.stroke();
      txt(ctx, '+3,3 V', 168, 90, 12, '#ff9a8a', 'right', true);
      [[196, SDA_Y, 'SDA', '#ffd24a'], [250, SCL_Y, 'SCL', '#5fe0ff']].forEach(p => {
        const x = p[0]; ctx.strokeStyle = '#8b98a5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 90); ctx.lineTo(x, 100); ctx.moveTo(x, 138); ctx.lineTo(x, p[1]); ctx.stroke();
        ctx.fillStyle = slow ? '#5a2a2a' : '#4a4034'; rr(ctx, x - 9, 100, 18, 38, 3); ctx.fill(); ctx.strokeStyle = slow ? C.bad : '#c9a56a'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#c4ccd4'; ctx.beginPath(); ctx.arc(x, p[1], 4, 0, TWO_PI); ctx.fill();
      });
      txt(ctx, 'Rp ' + (Cv.pullup >= 1000 ? f1(Cv.pullup / 1000, Cv.pullup % 1000 ? 1 : 0) + ' kΩ' : Cv.pullup + ' Ω'), 223, 76, 12, slow ? C.bad : '#e8c98a', 'center', true);
      // Leitungen
      const wire = (y, col, label, active) => {
        ctx.strokeStyle = '#0c1014'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(150, y); ctx.lineTo(505, y); ctx.stroke();
        ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
      };
      wire(SCL_Y, '#2a8aa3'); wire(SDA_Y, '#a58a2a');
      // Kabel (Kapazitaet)
      ctx.fillStyle = 'rgba(139,152,165,0.18)'; rr(ctx, 270, SCL_Y - 18, 90, SDA_Y - SCL_Y + 36, 10); ctx.fill(); ctx.strokeStyle = '#5a6570'; ctx.lineWidth = 1.5; if (ctx.setLineDash) ctx.setLineDash([4, 4]); ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
      txt(ctx, 'Kabel ' + f1(Cv.busLength, 1) + ' m', 315, SCL_Y - 28, 11, C.dim, 'center', true);
      [[285, SCL_Y], [300, SDA_Y]].forEach(p => {
        ctx.strokeStyle = '#c4ccd4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], 236); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p[0] - 9, 236); ctx.lineTo(p[0] + 9, 236); ctx.moveTo(p[0] - 9, 242); ctx.lineTo(p[0] + 9, 242); ctx.stroke();
      });
      ctx.strokeStyle = '#4a545e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(150, 262); ctx.lineTo(505, 262); ctx.stroke();
      txt(ctx, 'C = ' + f1(cBus(), 0) + ' pF', 315, 270, 12, cBus() > 400 ? C.bad : C.text, 'center', true);
      txt(ctx, 'GND', 138, 262, 10, C.dim, 'right');
      // Controller
      const cg = ctx.createLinearGradient(0, 100, 0, 250); cg.addColorStop(0, '#1f5a46'); cg.addColorStop(1, '#173f33');
      ctx.fillStyle = cg; rr(ctx, 28, 98, 118, 150, 8); ctx.fill(); ctx.strokeStyle = '#0c1f19'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#16181b'; rr(ctx, 44, 120, 60, 60, 4); ctx.fill(); txt(ctx, 'MCU', 74, 150, 14, '#c4ccd4', 'center', true);
      txt(ctx, 'Controller', 87, 210, 12, '#bfe6d4', 'center', true); txt(ctx, 'ruft ' + hexN(Cv.addr, 2) + ' auf', 87, 228, 11, '#bfe6d4', 'center');
      txt(ctx, 'SCL', 156, SCL_Y - 11, 11, '#5fe0ff', 'left', true); txt(ctx, 'SDA', 156, SDA_Y + 13, 11, '#ffd24a', 'left', true);
      // Geraete
      const hw = hwAddr(), conf = (Cv.sensor !== 'us') && Cv.twin && twinAddr() === hw && Cv.addr === hw, blink = Math.floor(t / 250) % 2;
      const board = (x, w, name, addr, col, active, ghost) => {
        ctx.save(); if (ghost) ctx.globalAlpha = 0.35;
        const g = ctx.createLinearGradient(0, 100, 0, 250); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
        ctx.fillStyle = g; rr(ctx, x, 104, w, 140, 8); ctx.fill(); ctx.strokeStyle = conf && !ghost ? (blink ? C.bad : '#7a2a2a') : '#0c1f19'; ctx.lineWidth = conf && !ghost ? 5 : 3; ctx.stroke();
        ctx.fillStyle = '#16181b'; rr(ctx, x + w / 2 - 17, 130, 34, 34, 3); ctx.fill();
        txt(ctx, name, x + w / 2, 118, 11, '#e8f4ee', 'center', true);
        ctx.fillStyle = '#e9eef3'; rr(ctx, x + 6, 190, w - 12, 36, 4); ctx.fill();
        txt(ctx, 'Adresse', x + w / 2, 200, 9, '#33404c', 'center'); txt(ctx, addr, x + w / 2, 215, 15, '#16202a', 'center', true, MONO);
        ctx.restore();
        ctx.fillStyle = '#c4ccd4'; [SCL_Y, SDA_Y].forEach(yy => { ctx.beginPath(); ctx.arc(x, yy, 4, 0, TWO_PI); ctx.fill(); });
      };
      if (kv) {
        board(380, 118, 'HC-SR04', 'kein I²C', ['#2a4a6a', '#1c3248'], true);
        txt(ctx, 'Trig / Echo', 439, 178, 12, '#bde0ff', 'center', true);
      } else {
        const cols = { sht: ['#2a5a8a', '#1c3a58'], gas: ['#6a4a2a', '#48311c'], tof: ['#4a2a6a', '#321c48'] }[Cv.sensor];
        const nm = { sht: 'SHT', gas: 'GAS', tof: 'ToF' }[Cv.sensor];
        board(376, 68, nm, hexN(hw, 2), cols, true);
        board(452, 60, nm + ' 2', hexN(twinAddr(), 2), cols, false, !Cv.twin);
        if (!Cv.twin) txt(ctx, 'antippen: 2. Sensor', 482, 262, 10, C.dim, 'center');
      }
      if (conf) txt(ctx, 'ADRESSKONFLIKT', 436, 92, 15, blink ? C.bad : C.warn, 'center', true);
      // ACK-/Datenpunkte auf den Leitungen
      const p = playhead();
      if (p >= 0 && !kv) {
        const sl = S.tx.slots[clamp(Math.floor(p), 0, S.tx.total - 1)];
        if (sl && (sl.type === 'bit' || sl.type === 'S' || sl.type === 'P')) {
          const x = 150 + ((p * 7) % 1) * 330;
          ctx.fillStyle = 'rgba(255,230,120,0.95)'; ctx.beginPath(); ctx.arc(x, SDA_Y, 5, 0, TWO_PI); ctx.fill();
          ctx.fillStyle = 'rgba(120,230,255,0.95)'; ctx.beginPath(); ctx.arc(150 + ((p * 11) % 1) * 330, SCL_Y, 4, 0, TWO_PI); ctx.fill();
        }
      }
      // Anstiegszeit-Hinweis
      
    }
    function drawScene(ctx, t) {
      panel(ctx, 14, 298, 506, 250, null);
      const type = Cv.sensor, x0 = 14, y0 = 298;
      txt(ctx, SENS[type].name, x0 + 14, y0 + 16, 12, C.dim, 'left', true);
      if (type === 'sht') {
        // Thermometer
        const tx = x0 + 70, ty = y0 + 40, th = 160, f = clamp((S.tf + 40) / 165, 0, 1);
        ctx.fillStyle = '#0c1014'; rr(ctx, tx - 9, ty, 18, th, 9); ctx.fill(); ctx.strokeStyle = '#8b98a5'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#e34'; rr(ctx, tx - 5, ty + th - 6 - (th - 16) * f, 10, 6 + (th - 16) * f, 5); ctx.fill();
        ctx.beginPath(); ctx.arc(tx, ty + th + 12, 16, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = '#8b98a5'; ctx.stroke();
        for (let k = -40; k <= 120; k += 20) { const yy = ty + th - 6 - (th - 16) * (k + 40) / 165; ctx.strokeStyle = '#8b98a5'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tx + 12, yy); ctx.lineTo(tx + 20, yy); ctx.stroke(); txt(ctx, String(k), tx + 24, yy, 10, C.dim, 'left'); }
        txt(ctx, f1(S.tf, 1) + ' °C', tx, ty + th + 44, 16, C.text, 'center', true, MONO);
        // Feuchte: Tropfen und Balken
        const dx = x0 + 250, dy = y0 + 110;
        for (let k = 0; k < 12; k++) {
          const ph = fr(t / 2600 + k / 12), n = S.rhf / 100;
          if (k / 12 > n + 0.05) continue;
          const px = dx - 90 + (k * 53 % 180), py = dy - 70 + ph * 140;
          ctx.fillStyle = 'rgba(80,170,255,' + (0.7 * (1 - Math.abs(ph - 0.5) * 1.4)) + ')';
          ctx.beginPath(); ctx.moveTo(px, py - 9); ctx.quadraticCurveTo(px + 8, py + 2, px, py + 8); ctx.quadraticCurveTo(px - 8, py + 2, px, py - 9); ctx.fill();
        }
        ctx.fillStyle = '#0c1014'; rr(ctx, dx - 90, y0 + 196, 180, 16, 8); ctx.fill(); ctx.fillStyle = rgba(BLUE, 1); rr(ctx, dx - 88, y0 + 198, Math.max(4, 176 * S.rhf / 100), 12, 6); ctx.fill();
        txt(ctx, 'Luftfeuchte ' + f1(S.rhf, 1) + ' %', dx, y0 + 226, 15, C.text, 'center', true, MONO);
        sensorChip(ctx, x0 + 400, y0 + 100, 'SHT', '#2a5a8a');
      } else if (type === 'gas') {
        const cx = x0 + 120, cy = y0 + 120;
        const heat = 0.5 + 0.3 * Math.sin(t / 400);
        ctx.fillStyle = 'rgba(255,120,30,' + (0.18 + heat * 0.2) + ')'; ctx.beginPath(); ctx.arc(cx, cy, 70, 0, TWO_PI); ctx.fill();
        const g = ctx.createLinearGradient(cx - 40, 0, cx + 40, 0); g.addColorStop(0, '#6a6e72'); g.addColorStop(0.5, '#c4c8cc'); g.addColorStop(1, '#5a5e62');
        ctx.fillStyle = g; rr(ctx, cx - 40, cy - 50, 80, 100, 10); ctx.fill(); ctx.strokeStyle = '#2a2e32'; ctx.lineWidth = 3; ctx.stroke();
        ctx.strokeStyle = '#3a3e42'; ctx.lineWidth = 1.5; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(cx - 32, cy - 36 + k * 10); ctx.lineTo(cx + 32, cy - 36 + k * 10); ctx.stroke(); }
        txt(ctx, 'Gas', cx, cy + 36, 13, '#333', 'center', true);
        const n = Math.round(S.gf / 5000 * 40);
        for (let k = 0; k < n; k++) {
          const ph = fr(t / 3200 + k * 0.137), a = k * 2.399, rr0 = 50 + (k * 37 % 80) * 1.3;
          const px = x0 + 330 + Math.cos(a) * rr0 * 0.9 - ph * 220 + 120, py = cy + Math.sin(a * 1.3) * 80 - ph * 10;
          if (px > x0 + 500 || px < x0 + 170) continue;
          ctx.fillStyle = 'rgba(190,150,255,' + (0.8 * Math.sin(ph * Math.PI)) + ')'; ctx.beginPath(); ctx.arc(px, py, 4, 0, TWO_PI); ctx.fill();
        }
        ctx.fillStyle = '#0c1014'; rr(ctx, x0 + 190, y0 + 196, 290, 16, 8); ctx.fill();
        const gg = ctx.createLinearGradient(x0 + 190, 0, x0 + 480, 0); gg.addColorStop(0, '#4cd964'); gg.addColorStop(0.5, '#ffb340'); gg.addColorStop(1, '#ff5c5c');
        ctx.fillStyle = gg; rr(ctx, x0 + 192, y0 + 198, Math.max(4, 286 * S.gf / 5000), 12, 6); ctx.fill();
        txt(ctx, f1(S.gf, 0) + ' ppm', x0 + 335, y0 + 226, 18, C.text, 'center', true, MONO);
        txt(ctx, 'Heizung ' + (S.t > 0 ? 'an' : 'aus'), cx, y0 + 196, 11, '#ffb27a', 'center', true);
      } else {
        // ToF / Ultraschall: Szene mit Hindernis
        const us = type === 'us', sx = x0 + 60, sy = y0 + 108, c = soundSpeed(S.tf);
        const wx0 = x0 + 120, wx1 = x0 + 470, wx = wx0 + (wx1 - wx0) * clamp(S.df / 2500, 0, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(wx0 - 60, sy + 70, 440, 2);
        // Kegel
        const half = us ? 0.26 : 0.045;
        const gk = ctx.createLinearGradient(sx + 30, 0, wx, 0); gk.addColorStop(0, us ? 'rgba(120,200,255,0.35)' : 'rgba(255,90,90,0.55)'); gk.addColorStop(1, us ? 'rgba(120,200,255,0.05)' : 'rgba(255,90,90,0.2)');
        ctx.fillStyle = gk; ctx.beginPath(); ctx.moveTo(sx + 30, sy); ctx.lineTo(wx, sy - (wx - sx - 30) * Math.tan(half)); ctx.lineTo(wx, sy + (wx - sx - 30) * Math.tan(half)); ctx.closePath(); ctx.fill();
        // Wellenfronten bzw. Laserpuls
        const cyc = fr(t / 1800), fly = cyc < 0.5 ? cyc * 2 : 1 - (cyc - 0.5) * 2, going = cyc < 0.5;
        if (us) {
          for (let k = 0; k < 4; k++) { const ph = fr(cyc * 2 + k * 0.12) , rad = 14 + (wx - sx - 30) * (going ? cyc * 2 : 1 - (cyc - 0.5) * 2) * 0.98 - k * 22; if (rad < 6) continue; ctx.strokeStyle = 'rgba(160,215,255,' + (0.8 - k * 0.2) + ')'; ctx.lineWidth = 2.5; ctx.beginPath(); const px = going ? sx + 30 + rad : sx + 30 + rad; ctx.arc(going ? sx + 30 : wx, sy, Math.max(2, rad * (going ? 1 : 0.25)), -half * 1.1, half * 1.1); if (going) ctx.stroke(); else { ctx.beginPath(); ctx.arc(wx - 0, sy, 1, 0, 0.01); } }
          if (!going) { for (let k = 0; k < 3; k++) { const px = wx - (wx - sx - 30) * (1 - fly) + 0 - k * 14; ctx.strokeStyle = 'rgba(255,230,140,' + (0.8 - k * 0.25) + ')'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px, sy, 26 + k * 6, Math.PI - half * 3, Math.PI + half * 3); ctx.stroke(); } }
        } else {
          const px = going ? sx + 30 + (wx - sx - 30) * cyc * 2 : sx + 30 + (wx - sx - 30) * (1 - (cyc - 0.5) * 2);
          ctx.fillStyle = going ? '#ff6a6a' : '#ffd0d0'; ctx.shadowColor = '#ff4a4a'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(px, sy, 6, 0, TWO_PI); ctx.fill(); ctx.shadowBlur = 0;
        }
        // Sensor
        const cg = ctx.createLinearGradient(0, sy - 45, 0, sy + 45); cg.addColorStop(0, '#2a4a6a'); cg.addColorStop(1, '#1c3248');
        ctx.fillStyle = cg; rr(ctx, sx - 40, sy - 48, 76, 96, 8); ctx.fill(); ctx.strokeStyle = '#0c1f19'; ctx.lineWidth = 3; ctx.stroke();
        if (us) { [-22, 22].forEach(o => { ctx.fillStyle = '#c4ccd4'; ctx.beginPath(); ctx.arc(sx + 8, sy + o, 16, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(sx + 8, sy + o, 9, 0, TWO_PI); ctx.fill(); }); txt(ctx, 'HC-SR04', sx - 2, sy - 38, 9, '#bde0ff', 'center', true); }
        else { ctx.fillStyle = '#16181b'; rr(ctx, sx - 6, sy - 24, 28, 48, 3); ctx.fill(); ctx.fillStyle = '#6a2a2a'; ctx.beginPath(); ctx.arc(sx + 16, sy - 10, 5, 0, TWO_PI); ctx.fill(); ctx.fillStyle = '#c4ccd4'; ctx.beginPath(); ctx.arc(sx + 16, sy + 10, 5, 0, TWO_PI); ctx.fill(); txt(ctx, 'ToF', sx - 2, sy - 38, 10, '#bde0ff', 'center', true); }
        // Hindernis
        ctx.fillStyle = '#7a6a52'; ctx.fillRect(wx, sy - 70, 14, 140); ctx.fillStyle = '#5a4d3a'; for (let k = 0; k < 7; k++) ctx.fillRect(wx + 14, sy - 70 + k * 20, 6, 10);
        // Massband
        ctx.strokeStyle = '#8b98a5'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx + 30, sy + 84); ctx.lineTo(wx, sy + 84); ctx.moveTo(sx + 30, sy + 78); ctx.lineTo(sx + 30, sy + 90); ctx.moveTo(wx, sy + 78); ctx.lineTo(wx, sy + 90); ctx.stroke();
        txt(ctx, 'd = ' + f1(S.df, 0) + ' mm', (sx + 30 + wx) / 2, sy + 102, 15, C.text, 'center', true, MONO);
        if (us) {
          const te = 2 * S.df / 1000 / c * 1000;
          txt(ctx, 'Echo ' + f1(te, 2) + ' ms  →  d = c·t/2 = ' + f1(343 * te / 2, 0) + ' mm (mit 343 m/s)', x0 + 253, y0 + 224, 12, Math.abs(343 * te / 2 - S.df) > 0.02 * S.df ? C.warn : C.dim, 'center', true);
          txt(ctx, 'wahre Schallgeschwindigkeit bei ' + f1(S.tf, 0) + ' °C: ' + f1(c, 1) + ' m/s', x0 + 253, y0 + 240, 11, C.dim, 'center');
          txt(ctx, 'Schallkegel', sx + 140, sy - (140) * Math.tan(half) - 10, 11, '#9fd4ff', 'center');
        } else txt(ctx, S.df > 2000 ? 'außer Reichweite → 8190' : 'Laufzeit des Lichtpulses (ToF)', x0 + 253, y0 + 224, 12, S.df > 2000 ? C.warn : C.dim, 'center', true);
      }
    }
    function sensorChip(ctx, x, y, name, col) {
      ctx.fillStyle = col; rr(ctx, x - 36, y - 50, 72, 100, 6); ctx.fill(); ctx.strokeStyle = '#0c1f19'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#16181b'; rr(ctx, x - 14, y - 22, 28, 28, 3); ctx.fill(); txt(ctx, name, x, y - 36, 11, '#e8f4ee', 'center', true);
      ctx.fillStyle = '#c4ccd4'; for (let k = 0; k < 4; k++) ctx.fillRect(x - 30 + k * 20, y + 40, 6, 12);
    }
    function drawAnalyzer(ctx, t) {
      const x0 = 536, y0 = 14, w = 454, h = 290, tx = S.tx, kv = Cv.sensor === 'us';
      panel(ctx, x0, y0, w, h, 'MINI-LOGIKANALYSATOR');
      const px = x0 + 54, pw = w - 70;
      const lanes = kv ? [[y0 + 36, 'ECHO', '#ff9a6a'], [y0 + 92, 'TRIG', '#7ad0ff']] : [[y0 + 36, 'SCL', '#5fe0ff'], [y0 + 92, 'SDA', '#ffd24a']];
      const laneH = 38;
      const nowSlot = kv ? 0 : clamp(playhead(), 0, 1e9);
      const tR = (tx && !tx.pulse) ? (playhead() < 0 ? 0 : playhead()) : (tx ? 0 : 0);
      const slotPx = pw / WIN;
      lanes.forEach((ln, li) => {
        ctx.fillStyle = '#0c1014'; rr(ctx, px - 4, ln[0] - 4, pw + 8, laneH + 8, 6); ctx.fill();
        txt(ctx, ln[1], x0 + 12, ln[0] + laneH / 2, 13, ln[2], 'left', true);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; if (ctx.setLineDash) ctx.setLineDash([3, 4]);
        [0.3, 0.7].forEach(v => { const yy = ln[0] + laneH - v * laneH; ctx.beginPath(); ctx.moveTo(px, yy); ctx.lineTo(px + pw, yy); ctx.stroke(); });
        if (ctx.setLineDash) ctx.setLineDash([]);
        if (li === 0 && !kv) { txt(ctx, 'VIH', px + pw - 2, ln[0] + laneH - 0.7 * laneH - 5, 9, C.dim, 'right'); }
      });
      if (!kv) {
        const hasTx = tx && !tx.pulse;
        const tp = hasTx ? Math.max(playhead(), 0) + 2 : 0, tL = tp - WIN;
        // Raster je Taktschlitz
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
        for (let k = Math.ceil(tL); k <= tp; k++) { const xx = px + (k - tL) * slotPx; ctx.beginPath(); ctx.moveTo(xx, lanes[0][0] - 2); ctx.lineTo(xx, lanes[1][0] + laneH + 2); ctx.stroke(); }
        const draw1 = (ln, wave) => {
          ctx.strokeStyle = ln[2]; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.beginPath();
          for (let k = 0; k <= pw; k += 1.5) { const tt = tL + k / slotPx, v = hasTx && tt >= 0 ? wave.v(tt) : 1, yy = ln[0] + laneH - clamp(v, 0, 1.02) * laneH; if (k === 0) ctx.moveTo(px + k, yy); else ctx.lineTo(px + k, yy); }
          ctx.stroke();
        };
        if (hasTx) { draw1(lanes[0], tx.wscl); draw1(lanes[1], tx.wsda); }
        else { [lanes[0], lanes[1]].forEach(ln => { ctx.strokeStyle = ln[2]; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(px, ln[0] + 1); ctx.lineTo(px + pw, ln[0] + 1); ctx.stroke(); }); }
        // Dekodierleiste
        const by = y0 + 148, bh = 34;
        ctx.fillStyle = '#0c1014'; rr(ctx, px - 4, by - 4, pw + 8, bh + 8, 6); ctx.fill(); txt(ctx, 'DEKODER', x0 + 12, by + bh / 2, 11, C.dim, 'left', true);
        if (hasTx) {
          const cols = { S: '#36424e', Sr: '#36424e', P: '#36424e', ADDR: '#2a5a8a', RW: '#8a6a22', ACK: '#2c6b3c', NACK: '#7a2a2a', DATA: '#3b4652', STR: '#5a4a7a' };
          ctx.save(); ctx.beginPath(); ctx.rect(px, by - 2, pw, bh + 4); ctx.clip();
          tx.frames.forEach(f => {
            if (f.s1 > playhead() + 0.5 && f.s0 > playhead()) return;
            const xa = px + (f.s0 - tL) * slotPx, xb = px + (f.s1 - tL) * slotPx;
            if (xb < px || xa > px + pw) return;
            const kind = f.kind === 'ACK' && f.text !== 'ACK' ? 'NACK' : f.kind;
            ctx.fillStyle = f.ok === false ? '#7a2a2a' : (kind === 'NACK' && f.role === 'ackM' ? '#4a3a2a' : cols[kind] || '#3b4652'); rr(ctx, xa + 1, by, Math.max(2, xb - xa - 2), bh, 4); ctx.fill();
            if (f.ok === false) { ctx.strokeStyle = C.bad; ctx.lineWidth = 2; ctx.stroke(); }
            const wdt = xb - xa; if (wdt > 20) txt(ctx, wdt < 44 ? f.text.replace('Start', 'S').replace('Stopp', 'P').replace('Adr ', '') : f.text, (xa + xb) / 2, by + bh / 2, wdt < 44 ? 10 : 12, '#fff', 'center', true, MONO);
          });
          ctx.restore();
          // Cursor
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; const cxx = px + pw - 2 * slotPx; ctx.beginPath(); ctx.moveTo(cxx, lanes[0][0] - 6); ctx.lineTo(cxx, by + bh + 6); ctx.stroke();
        } else txt(ctx, 'warte auf Telegramm …', px + pw / 2, by + bh / 2, 12, C.dim, 'center');
        // Legende
        const ly = y0 + 200;
        txt(ctx, 'Steigende Flanken: Kurve Rp·C. Fallende: sofort.', x0 + 14, ly, 11, C.dim, 'left');
        txt(ctx, 'Gelesen wird kurz vor dem Taktende, wenn SCL über 70 % ist.', x0 + 14, ly + 17, 11, C.dim, 'left');
        const ratio = trNs() / limNs();
        txt(ctx, 'tr = 0,8473·Rp·C = ' + f1(trNs(), 0) + ' ns', x0 + 14, ly + 44, 15, ratio > 1 ? C.bad : C.ok, 'left', true, MONO);
        txt(ctx, 'Grenze ' + limNs() + ' ns', x0 + w - 14, ly + 44, 15, C.dim, 'right', true, MONO);
        ctx.fillStyle = '#0c1014'; rr(ctx, x0 + 14, ly + 58, w - 28, 12, 6); ctx.fill();
        ctx.fillStyle = ratio > 1 ? rgba(RED, 1) : rgba(GREEN, 1); rr(ctx, x0 + 15, ly + 59, Math.max(3, (w - 30) * clamp(ratio / 3, 0, 1)), 10, 5); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + 14 + (w - 28) / 3, ly + 54); ctx.lineTo(x0 + 14 + (w - 28) / 3, ly + 74); ctx.stroke();
      } else {
        // Ultraschall: Trig und Echo ueber 28 ms
        const tw = 28, Xs = ms => px + pw * ms / tw;
        const te = tx && tx.pulse ? tx.tEcho : 2 * S.df / 1000 / soundSpeed(S.tf) * 1000;
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; for (let k = 0; k <= 28; k += 4) { ctx.beginPath(); ctx.moveTo(Xs(k), lanes[0][0] - 2); ctx.lineTo(Xs(k), lanes[1][0] + laneH + 2); ctx.stroke(); txt(ctx, k + ' ms', Xs(k), lanes[1][0] + laneH + 14, 9, C.dim, 'center'); }
        const sq = (ln, ranges) => { ctx.strokeStyle = ln[2]; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(px, ln[0] + laneH); ranges.forEach(r => { ctx.lineTo(Xs(r[0]), ln[0] + laneH); ctx.lineTo(Xs(r[0]), ln[0]); ctx.lineTo(Xs(r[1]), ln[0]); ctx.lineTo(Xs(r[1]), ln[0] + laneH); }); ctx.lineTo(px + pw, ln[0] + laneH); ctx.stroke(); };
        sq(lanes[1], [[1.0, 1.4]]); sq(lanes[0], [[1.8, 1.8 + te]]);
        txt(ctx, '10 µs', Xs(1.2), lanes[1][0] - 8, 10, '#7ad0ff', 'center', true);
        txt(ctx, 't = ' + f1(te, 2) + ' ms', Xs(1.8 + te / 2), lanes[0][0] - 8, 11, '#ffb27a', 'center', true);
        const cur = tx && tx.pulse ? (S.t - tx.t0) / (PULSE_MS * 0.8) : 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; const cxx = px + pw * clamp(cur, 0, 1); ctx.beginPath(); ctx.moveTo(cxx, lanes[0][0] - 6); ctx.lineTo(cxx, lanes[1][0] + laneH + 6); ctx.stroke();
        const by = y0 + 162, bh = 30;
        ctx.fillStyle = '#0c1014'; rr(ctx, px - 4, by - 4, pw + 8, bh + 8, 6); ctx.fill(); txt(ctx, 'DEKODER', x0 + 12, by + bh / 2, 11, C.dim, 'left', true);
        const segs = [[1.0, 1.4, 'Trig', '#2a5a8a'], [1.4, 1.8, '8×', '#5a4a7a'], [1.8, 1.8 + te, 'Echo-Impuls ' + f1(te, 2) + ' ms', '#8a5a22']];
        segs.forEach(s => { const xa = Xs(s[0]), xb = Xs(s[1]); ctx.fillStyle = s[3]; rr(ctx, xa + 1, by, Math.max(3, xb - xa - 2), bh, 4); ctx.fill(); if (xb - xa > 40) txt(ctx, s[2], (xa + xb) / 2, by + bh / 2, 11, '#fff', 'center', true); });
        const ly = y0 + 214, c = soundSpeed(S.tf);
        txt(ctx, 'd = c · t / 2 mit c = 331,3 + 0,606·T = ' + f1(c, 1) + ' m/s', x0 + 14, ly + 4, 13, C.text, 'left', true, MONO);
        txt(ctx, 'Der Controller rechnet fest mit 343 m/s → ' + f1(343 * te / 2, 0) + ' mm angezeigt', x0 + 14, ly + 26, 12, Math.abs(343 * te / 2 - S.df) > 0.02 * S.df ? C.warn : C.dim, 'left', true);
        txt(ctx, 'Kein I²C: Trigger rein, Echo raus. Die Breite ist die Messgröße.', x0 + 14, ly + 48, 11, C.dim, 'left');
      }
    }
    function drawReadout(ctx, t) {
      const x0 = 536, y0 = 314, w = 454, h = 234, type = Cv.sensor;
      panel(ctx, x0, y0, w, h, 'MESSWERTE UND TELEGRAMM');
      const big = (x, y, label, shown, unit, truth, col) => {
        ctx.fillStyle = '#1a2026'; rr(ctx, x, y, 138, 66, 8); ctx.fill();
        txt(ctx, label, x + 10, y + 13, 11, C.dim, 'left', true);
        txt(ctx, shown, x + 100, y + 38, 22, col || C.ok, 'right', true, MONO); txt(ctx, unit, x + 104, y + 42, 12, C.dim, 'left');
        txt(ctx, 'wahr ' + truth, x + 10, y + 56, 10, C.dim, 'left');
      };
      const lastOk = S.lastReason === '' || S.lastReason === 'twin', col = lastOk ? C.ok : C.warn;
      if (type === 'sht') { big(x0 + 12, y0 + 28, 'TEMPERATUR', f1(S.val.t, 2), '°C', f1(S.tf, 2), col); big(x0 + 158, y0 + 28, 'FEUCHTE', f1(S.val.rh, 1), '%', f1(S.rhf, 1), col); }
      else if (type === 'gas') { big(x0 + 12, y0 + 28, 'GAS', f1(S.val.gas, 0), 'ppm', f1(S.gf, 0), col); big(x0 + 158, y0 + 28, 'TVOC', f1(S.val.gas * 0.18, 0), 'ppb', f1(S.gf * 0.18, 0), col); }
      else if (type === 'tof') big(x0 + 12, y0 + 28, 'ABSTAND', S.val.dist >= 8190 ? '8190' : f1(S.val.dist, 0), 'mm', f1(S.df, 0), col);
      else { big(x0 + 12, y0 + 28, 'ABSTAND', f1(S.val.dist, 0), 'mm', f1(S.df, 0), Math.abs(S.val.dist - S.df) > 0.02 * S.df ? C.warn : C.ok); big(x0 + 158, y0 + 28, 'ECHO', f1(2 * S.df / 1000 / soundSpeed(S.tf) * 1000, 2), 'ms', '', C.acc); }
      // Fehler/ACK-Kacheln
      const er = type === 'us' ? 0 : errRate();
      ctx.fillStyle = '#1a2026'; rr(ctx, x0 + 304, y0 + 28, 138, 66, 8); ctx.fill();
      txt(ctx, 'FEHLERRATE', x0 + 314, y0 + 41, 11, C.dim, 'left', true); txt(ctx, f1(er, 0) + ' %', x0 + 430, y0 + 64, 22, er > 0 ? C.bad : C.ok, 'right', true, MONO);
      txt(ctx, 'ACKs ' + S.acks + ' · Telegramme ' + S.txCount, x0 + 314, y0 + 84, 10, C.dim, 'left');
      // Telegramm als Text
      txt(ctx, 'Letztes Telegramm', x0 + 14, y0 + 112, 11, C.dim, 'left', true);
      const fs = type === 'us' ? [] : S.lastFrames;
      let xx = x0 + 14, yy = y0 + 132;
      if (type === 'us') txt(ctx, 'Trig-Impuls 10 µs → Echo-Impuls ' + f1(2 * S.df / 1000 / soundSpeed(S.tf) * 1000, 2) + ' ms → d = c·t/2', x0 + 14, yy + 4, 13, C.text, 'left', true, MONO);
      else if (!fs.length) txt(ctx, 'noch keins …', x0 + 14, yy + 4, 12, C.dim, 'left');
      else fs.forEach(f => {
        const label = f.text, wdt = Math.max(24, label.length * 7.2 + 10);
        if (xx + wdt > x0 + w - 12) { xx = x0 + 14; yy += 22; }
        if (yy > y0 + h - 40) return;
        const cols = { S: '#36424e', Sr: '#36424e', P: '#36424e', ADDR: '#2a5a8a', RW: '#8a6a22', ACK: '#2c6b3c', NACK: '#7a2a2a', DATA: '#3b4652', STR: '#5a4a7a' };
        const nk = f.kind === 'ACK' && f.text === 'NACK' ? 'NACK' : f.kind;
        ctx.fillStyle = f.ok === false ? '#7a2a2a' : cols[nk] || '#3b4652'; rr(ctx, xx, yy - 9, wdt, 18, 4); ctx.fill();
        txt(ctx, label, xx + wdt / 2, yy, 11, '#fff', 'center', true, MONO); xx += wdt + 4;
      });
      // Statuszeile
      let msg = 'Bus in Ordnung', mc = C.ok;
      const s = state();
      if (type === 'us') { msg = Math.abs(S.val.dist - S.df) > 0.02 * S.df ? 'Anzeige weicht ab: c hängt von der Temperatur ab' : 'Messung in Ordnung'; mc = msg.startsWith('Anz') ? C.warn : C.ok; }
      else if (s.nack) { msg = 'KEIN ACK – Adresse ' + hexN(Cv.addr, 2) + ' antwortet nicht'; mc = C.bad; }
      else if (s.conflict) { msg = 'ADRESSKONFLIKT auf ' + hexN(Cv.addr, 2); mc = C.bad; }
      else if (S.lastReason === 'slow') { msg = 'Flanken zu langsam – Datenfehler'; mc = C.bad; }
      else if (S.lastReason === 'crc') { msg = 'Prüfsumme falsch'; mc = C.warn; }
      else if (s.readsTwin) { msg = 'Du liest das FALSCHE Gerät (zweiter Sensor)'; mc = C.warn; }
      else if (s.tooSlow) { msg = 'Flanken über der Grenze – Fehler wahrscheinlich'; mc = C.warn; }
      ctx.fillStyle = mc === C.ok ? 'rgba(76,217,100,0.12)' : 'rgba(255,92,92,0.14)'; rr(ctx, x0 + 12, y0 + h - 44, w - 24, 32, 8); ctx.fill();
      txt(ctx, msg, x0 + w / 2, y0 + h - 28, 14, mc, 'center', true);
    }
    function drawTitle(ctx) {
      txt(ctx, 'Digitale Sensoren am Bus', 20, 26, 18, C.text, 'left', true);
      txt(ctx, 'I²C, Pull-up, Logikanalysator', 20, 44, 11, C.dim, 'left');
    }

    function draw(ctx, w, h, t) {
      t = num(t, 0); w = num(w, 0); h = num(h, 0);
      ctx.save();
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, Math.max(w, 0), Math.max(h, 0));
      if (w > 0 && h > 0) {
        const sc = Math.min(w / WW, h / WH);
        ctx.translate((w - WW * sc) / 2, (h - WH * sc) / 2); ctx.scale(sc, sc);
        ctx.fillStyle = '#171c21'; rr(ctx, 0, 0, WW, WH, 10); ctx.fill();
        drawTitle(ctx); drawBus(ctx, t); drawScene(ctx, t); drawAnalyzer(ctx, t); drawReadout(ctx, t);
      }
      ctx.restore();
    }
    function hitTest(px, py, w, h) {
      w = num(w, 0); h = num(h, 0); if (!(w > 0 && h > 0)) return null;
      const sc = Math.min(w / WW, h / WH);
      const x = (px - (w - WW * sc) / 2) / sc, y = (py - (h - WH * sc) / 2) / sc;
      if (Cv.sensor !== 'us' && x > 448 && x < 516 && y > 100 && y < 270) return { key: 'twin', kind: 'switch' };
      return null;
    }
    function reset() { ctl.forEach(c => { Cv[c.key] = c.value; }); resetState(); }

    resetState();
    const rig = {
      id: 'digital', controls: ctl, meters: METERS.map(m => Object.assign({}, m)), presets: PRESETS,
      setControl, getControl: k => Cv[k], step(dtMs) { dtMs = num(dtMs, 0); if (dtMs > 0) stepCore(Math.min(dtMs, 20000)); },
      readMeters, state, draw, hitTest, curves, reset, events, worldSize: () => ({ w: WW, h: WH }), applyPreset
    };
    if (opts.controls) { if (opts.controls.sensor) setControl('sensor', opts.controls.sensor); Object.keys(opts.controls).forEach(k => { if (k !== 'sensor') setControl(k, opts.controls[k]); }); S.tf = Cv.temp; S.rhf = Cv.rh; S.gf = Cv.gas; S.df = Cv.dist; S.val = trueVals(false); }
    return rig;
  }

  R.register({
    id: 'digital', name: 'Digitale Sensoren (Feuchte/Gas/Abstand, I²C)', icon: '📡',
    info: 'Digitale Sensoren melden ihre Messwerte als I²C-Telegramm. Im Mini-Logikanalysator siehst du SDA und SCL mit Start, Adresse, ACK, Daten und Stopp. Stelle Pull-up, Kabel und Busgeschwindigkeit ein, löse einen Adresskonflikt aus und vergleiche mit einem Ultraschallsensor.',
    controls: CONTROLS, meters: METERS, presets: PRESETS, create
  });
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
