/* embcore.js - Embedded vertieft: reine Logik, ohne Browser lauffaehig (node quelle/emb/test_embcore.js).
 * window.EMB_CORE = { fm, parseNum, ...  }  Fuenf Bloecke:
 *   1 Timer und Interrupts : timerTick, timerOverflow, ctcOcr, ctcSearch, pwmFast, pwmPhase, irqLatency, isrSim, bounceTrace, lockoutCount
 *   2 ADC                  : adcLsb, adcCode, adcVolt, sarSteps, sqnrDb, aliasFreq, adcRate, bitsNeeded, dividerOut
 *   3 Busse                : uartBits, uartWave, uartDecodeWave, ubrr, spiWave, spiDecode, i2cEncode, i2cWave, i2cDecode, i2cRise
 *   4 Automaten            : fsmRun, fsmCheck, seqDetector, debounceFsm, debounceRun, phaseAt, phaseConflicts
 *   5 Speicher/Echtzeit    : ramFree, stackSim, heapSim, tornRead, tornBad, volatileLoop, schedSim, rmAnalysis
 * Regel: Formeln stehen hier; der Test (test_embcore.js) rechnet jede Zahl ein zweites Mal ueber einen anderen Weg
 * (Bit-/Takt-genaue Simulation, Aufzaehlung, Brute-Force) und vergleicht. Zeiten: Sekunden, wenn nicht anders gesagt. */
(function (root) {
  'use strict';
  const fin = x => typeof x === 'number' && isFinite(x);
  const C = {};
  C.PRESCALERS = [1, 8, 64, 256, 1024];

  /* ---------- Zahlen anzeigen und lesen (Dezimalkomma) ---------- */
  C.fm = function (x, d) {
    if (!fin(x)) return '–';
    const s = (+x).toFixed(d == null ? 2 : d).replace('.', ',');
    return s.replace(/^-(?=\d)/, '−');
  };
  C.sig = function (x, n) {   // n gueltige Stellen, Nullen am Ende weg, Dezimalkomma
    if (!fin(x)) return '–';
    if (x === 0) return '0';
    n = n || 4;
    const mag = Math.floor(Math.log10(Math.abs(x)));
    const dec = Math.max(0, n - 1 - mag);
    let s = (+x).toFixed(Math.min(dec, 12));
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', ',').replace(/^-(?=\d)/, '−');
  };
  C.parseNum = function (v) {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string') return NaN;
    let s = v.trim().replace(/\s/g, '').replace(/−/g, '-');
    if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
    return parseFloat(s.replace(',', '.'));
  };
  C.hex = (n, d) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(d || 2, '0');
  C.bin = (n, d) => (n >>> 0).toString(2).padStart(d || 8, '0');
  C.parseHex = function (s) {
    if (typeof s === 'number') return s;
    const m = /^\s*(?:0x)?([0-9a-f]{1,8})\s*$/i.exec(String(s));
    return m ? parseInt(m[1], 16) : NaN;
  };
  const popcount = n => { let c = 0; n >>>= 0; while (n) { c += n & 1; n >>>= 1; } return c; };
  C.popcount = popcount;
  const ceilLog2 = n => { let b = 0; while (Math.pow(2, b) < n - 1e-9) b++; return b; };

  /* =====================================================================
   *  Block 1: Timer, PWM, Interrupts
   * ===================================================================== */
  C.timerTick = (f, ps) => ps / f;
  C.timerCycles = (ps, bits) => ps * Math.pow(2, bits);
  C.timerOverflow = (f, ps, bits) => ps * Math.pow(2, bits) / f;
  C.ctcFreq = (f, ps, ocr) => f / (ps * (ocr + 1));
  C.ctcOcr = function (f, ps, fT) {
    const exact = f / (ps * fT) - 1, ocr = Math.round(exact), fAct = f / (ps * (ocr + 1));
    return { exact, ocr, fAct, errPct: (fAct - fT) / fT * 100 };
  };
  /* beste Kombination: kleinster Betragsfehler, bei Gleichstand der kleinste Vorteiler (feinste Zeitauflösung) */
  C.ctcSearch = function (f, fT, bits, list) {
    const max = Math.pow(2, bits) - 1;
    const rows = (list || C.PRESCALERS).map(ps => { const r = C.ctcOcr(f, ps, fT); r.ps = ps; r.fits = r.ocr >= 0 && r.ocr <= max; return r; });
    const key = r => Math.round(Math.abs(r.errPct) * 1e9);
    const ok = rows.filter(r => r.fits).sort((a, b) => key(a) - key(b) || a.ps - b.ps);
    return { rows, best: ok[0] || null };
  };
  C.pwmFast = function (f, ps, top, ocr) {
    const n = top + 1, o = Math.max(0, Math.min(ocr, top));
    return { ticks: n, period: ps * n / f, freq: f / (ps * n), duty: (o + 1) / n, ticksHigh: o + 1 };
  };
  C.pwmPhase = function (f, ps, top, ocr) {
    const n = 2 * top, o = Math.max(0, Math.min(ocr, top));
    return { ticks: n, period: ps * n / f, freq: f / (ps * n), duty: o / top, ticksHigh: 2 * o };
  };
  C.pwmOcrFast = (duty, top) => Math.max(0, Math.min(top, Math.round(duty * (top + 1)) - 1));
  C.pwmOcrPhase = (duty, top) => Math.max(0, Math.min(top, Math.round(duty * top)));
  /* Latenz im ungünstigsten Fall: laengster kritischer Abschnitt (oder laengster Befehl) + Einsprung */
  C.irqLatency = function (maxInstr, entry, crit, f) {
    const cycles = Math.max(maxInstr, crit || 0) + entry;
    return { cycles, sec: cycles / f, us: cycles / f * 1e6 };
  };
  C.isrLoad = (exec, period) => exec / period;

  /* Ereignisgesteuerte Zeitachse. Zeiten ganzzahlig (z. B. Mikrosekunden). Ein Ereignis setzt das Merkerbit; ist es noch gesetzt
   * (ISR hat noch nicht begonnen), geht ein weiteres Ereignis verloren. Die ISR beginnt fruehestens nach der Latenz, nach dem Ende
   * der vorigen ISR und ausserhalb gesperrter Fenster (masks = [[von,bis), ...], z. B. cli ... sei). */
  C.isrSim = function (o) {
    const ev = o.events.slice().sort((a, b) => a - b), L = o.latency || 0, X = o.exec, masks = o.masks || [];
    const calls = [], lost = [];
    let endPrev = -Infinity, lastStart = -Infinity;
    ev.forEach((te, i) => {
      if (calls.length && te < lastStart) { lost.push(i); return; }
      let start = Math.max(te + L, endPrev), moved = true;
      while (moved) { moved = false; for (const m of masks) if (start >= m[0] && start < m[1]) { start = m[1]; moved = true; } }
      calls.push({ i, te, start, end: start + X, lat: start - te });
      lastStart = start; endPrev = start + X;
    });
    const tEnd = o.tEnd != null ? o.tEnd : (calls.length ? calls[calls.length - 1].end : 0);
    const busy = calls.reduce((s, c) => s + Math.max(0, Math.min(c.end, tEnd) - c.start), 0);
    return { events: ev, calls, lost, maxLat: calls.reduce((m, c) => Math.max(m, c.lat), 0), busy, load: tEnd > 0 ? busy / tEnd : 0, tEnd };
  };

  /* kleine, feste Zufallsfolge (LCG) fuer Prellmuster */
  C.lcg = function (seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
  /* Prellen beim Druecken: Pegel 1 -> 0, n Flanken (immer ungerade, damit der Endpegel 0 ist), erste Flanke bei t0, alle in [t0, t0+span] */
  C.bounceTrace = function (t0, n, seed, span) {
    if (n % 2 === 0) n++;
    const r = C.lcg(seed), ts = [];
    for (let i = 1; i < n; i++) ts.push(Math.round(r() * span));
    ts.sort((a, b) => a - b);
    for (let i = 1; i < ts.length; i++) if (ts[i] <= ts[i - 1]) ts[i] = ts[i - 1] + 1;   // streng wachsend
    const edges = [{ t: t0, lvl: 0 }];
    ts.forEach((d, i) => edges.push({ t: t0 + d + 1, lvl: (i % 2 === 0) ? 1 : 0 }));
    return edges;
  };
  const edgeMatch = (e, mode) => mode === 'change' || (mode === 'fall' && e.lvl === 0) || (mode === 'rise' && e.lvl === 1);
  C.edgeCount = (edges, mode) => edges.filter(e => edgeMatch(e, mode)).length;
  /* Sperrzeit: passende Flanke wird nur angenommen, wenn seit der letzten angenommenen mindestens `lock` vergangen ist */
  C.lockoutCount = function (edges, mode, lock) {
    let last = -Infinity, n = 0;
    for (const e of edges) if (edgeMatch(e, mode) && e.t - last >= lock) { n++; last = e.t; }
    return n;
  };

  /* =====================================================================
   *  Block 2: ADC
   * ===================================================================== */
  C.adcLsb = (vref, bits) => vref / Math.pow(2, bits);
  C.adcCode = function (v, vref, bits, mode) {
    const n = Math.pow(2, bits), x = v / vref * n;
    const c = mode === 'round' ? Math.round(x) : Math.floor(x + 1e-9);
    return Math.max(0, Math.min(n - 1, c));
  };
  C.adcVolt = (code, vref, bits) => code * vref / Math.pow(2, bits);
  C.adcQuant = function (v, vref, bits) {
    const code = C.adcCode(v, vref, bits), vq = C.adcVolt(code, vref, bits);
    return { code, vq, err: v - vq };
  };
  C.sarSteps = function (v, vref, bits) {     // sukzessive Approximation, Bit fuer Bit von oben
    let code = 0; const steps = [];
    for (let b = bits - 1; b >= 0; b--) {
      const trial = code | (1 << b), vt = C.adcVolt(trial, vref, bits), keep = v + 1e-12 >= vt;
      if (keep) code = trial;
      steps.push({ bit: b, trial, vt, keep });
    }
    return { code, steps };
  };
  C.sqnrDb = bits => 6.02 * bits + 1.76;
  C.dividerOut = (vin, r1, r2) => vin * r2 / (r1 + r2);
  C.aliasFreq = (f, fs) => Math.abs(f - fs * Math.round(f / fs));
  C.adcRate = function (f, ps, cycles) {
    cycles = cycles || 13;
    return { fadc: f / ps, tconv: cycles * ps / f, fs: f / (ps * cycles), nyq: f / (ps * cycles) / 2 };
  };
  C.bitsNeeded = (span, res) => ceilLog2(span / res);
  C.oversampleN = extra => Math.pow(4, extra);

  /* =====================================================================
   *  Block 3: UART, SPI, I2C
   * ===================================================================== */
  C.uartBitTime = baud => 1 / baud;
  C.uartFrameBits = cfg => 1 + (cfg.data || 8) + (cfg.parity && cfg.parity !== 'N' ? 1 : 0) + (cfg.stop || 1);
  C.uartByteRate = (baud, cfg) => baud / C.uartFrameBits(cfg);
  C.parityBit = function (byte, data, mode) {
    const ones = popcount(byte & (Math.pow(2, data) - 1));
    return mode === 'E' ? ones % 2 : 1 - (ones % 2);
  };
  C.uartBits = function (byte, cfg) {       // Start, Daten (LSB zuerst), Parität, Stopp
    const d = cfg.data || 8, bits = [0];
    for (let i = 0; i < d; i++) bits.push((byte >> i) & 1);
    if (cfg.parity && cfg.parity !== 'N') bits.push(C.parityBit(byte, d, cfg.parity));
    for (let i = 0; i < (cfg.stop || 1); i++) bits.push(1);
    return bits;
  };
  C.uartDecodeBits = function (bits, cfg) {
    const d = cfg.data || 8, par = cfg.parity && cfg.parity !== 'N';
    let byte = 0; for (let i = 0; i < d; i++) byte |= (bits[1 + i] & 1) << i;
    const pIdx = 1 + d;
    const parityOk = par ? ((bits[pIdx] === C.parityBit(byte, d, cfg.parity))) : true;
    let stopOk = true; for (let i = 0; i < (cfg.stop || 1); i++) if (bits[pIdx + (par ? 1 : 0) + i] !== 1) stopOk = false;
    return { byte, startOk: bits[0] === 0, parityOk, stopOk };
  };
  /* Abtastwerte: spb Proben je Bit, vorn und hinten Ruhepegel */
  C.uartWave = function (frames, spb, idleBits) {
    const out = [], idle = idleBits == null ? 2 : idleBits;
    for (let i = 0; i < idle * spb; i++) out.push(1);
    frames.forEach(fr => { fr.forEach(b => { for (let i = 0; i < spb; i++) out.push(b); }); for (let i = 0; i < idle * spb; i++) out.push(1); });
    return out;
  };
  /* Empfaenger: faellt die Leitung, in Bitmitte abtasten (Start pruefen, Daten, Paritaet, Stopp) */
  C.uartDecodeWave = function (s, spb, cfg) {
    const nb = C.uartFrameBits(cfg), frames = [];
    let i = 1;
    while (i < s.length) {
      if (s[i] === 0 && s[i - 1] === 1) {
        const at = k => s[Math.floor(i + (k + 0.5) * spb)];
        if (at(0) !== 0) { i++; continue; }
        const bits = []; for (let k = 0; k < nb; k++) { const v = at(k); bits.push(v === undefined ? 1 : v); }
        const r = C.uartDecodeBits(bits, cfg);
        frames.push({ start: i, bits, byte: r.byte, parityOk: r.parityOk, framingOk: r.stopOk });
        i = Math.floor(i + (nb - 0.5) * spb);
      } else i++;
    }
    return frames;
  };
  C.uartUbrr = function (f, baud, u2x) {
    const div = u2x ? 8 : 16, ubrr = Math.round(f / (div * baud)) - 1, act = f / (div * (ubrr + 1));
    return { ubrr, actual: act, errPct: (act - baud) / baud * 100 };
  };
  /* Toleranz: Abtastung in Bitmitte, letzter Abtastpunkt bei (N-0,5) Bitzeiten */
  C.uartMaxErrPct = nBits => 50 / (nBits - 0.5);

  /* ---- SPI: je Bit 4 Schritte; Daten wechseln an der "Wechselflanke", die Gegenstelle tastet an der anderen ab ----
   * SCK-Muster je Bit: [!R,!R,R,R] (R = Ruhepegel = CPOL), erste Flanke bei r = 4k (fuehrend), zweite bei 4k+2 (folgend).
   * CPHA = 0: Daten wechseln an der folgenden Flanke (davor), Abtastung an der fuehrenden. CPHA = 1: Wechsel fuehrend, Abtastung folgend. */
  C.SPI_LEAD = 4;
  C.spiCfg = function (mode) {
    const cpol = (mode >> 1) & 1, cpha = mode & 1;
    return { mode, cpol, cpha, idle: cpol, sampleRising: cpol === cpha };
  };
  C.spiWave = function (o) {
    const mode = o.mode || 0, n = o.bits || 8, msb = o.msb !== false, cfg = C.spiCfg(mode), R = cfg.cpol, LEAD = C.SPI_LEAD, TAIL = 4;
    const total = LEAD + 4 * n + TAIL;
    const bit = (v, k) => msb ? (v >> (n - 1 - k)) & 1 : (v >> k) & 1;
    const line = v => i => {
      const r = i - LEAD;
      let k;
      if (cfg.cpha === 1) { if (r < 0) return 0; k = Math.floor(r / 4); }
      else { if (r < -2) return 0; k = Math.floor((r + 2) / 4); }
      return bit(v, Math.min(n - 1, k));
    };
    const m = line(o.mosi || 0), s = line(o.miso || 0), w = { sck: [], mosi: [], miso: [], cs: [], mode, bits: n, msb, total };
    for (let i = 0; i < total; i++) {
      const r = i - LEAD;
      let sck = R;
      if (r >= 0 && r < 4 * n) sck = (r % 4 < 2) ? 1 - R : R;
      w.sck.push(sck); w.mosi.push(m(i)); w.miso.push(s(i)); w.cs.push(i >= 1 && i < total - 2 ? 0 : 1);
    }
    return w;
  };
  /* Dekodieren: an jeder Abtastflanke bei CS = 0 den Wert unmittelbar davor lesen. unsafe = Abtastflanke faellt mit einem Datenwechsel zusammen */
  C.spiDecode = function (w, mode, bits, msb) {
    const cfg = C.spiCfg(mode), n = bits || w.bits || 8, ms = msb !== false && w.msb !== false;
    const edges = [], mo = [], mi = []; let unsafe = false;
    for (let i = 1; i < w.sck.length; i++) {
      if (w.cs[i - 1] !== 0 || w.sck[i] === w.sck[i - 1]) continue;
      if ((w.sck[i] === 1) !== cfg.sampleRising) continue;
      edges.push(i);
      mo.push(w.mosi[i - 1]); mi.push(w.miso[i - 1]);
      if (w.mosi[i] !== w.mosi[i - 1] || w.miso[i] !== w.miso[i - 1]) unsafe = true;
    }
    const asm = a => { let v = 0; for (let k = 0; k < n; k++) { const b = a[k] || 0; v |= b << (ms ? n - 1 - k : k); } return v; };
    return { mosi: asm(mo), miso: asm(mi), edges, count: edges.length, unsafe };
  };
  /* Aus der Aufnahme auf den Modus schliessen: Ruhepegel = CPOL; Datenwechsel vor der ersten SCK-Flanke (bei CS = 0) = CPHA 0 */
  C.spiGuessMode = function (w) {
    const cpol = w.sck[0];
    let first = -1; for (let i = 1; i < w.sck.length; i++) if (w.sck[i] !== w.sck[i - 1]) { first = i; break; }
    let csLow = -1; for (let i = 0; i < w.cs.length; i++) if (w.cs[i] === 0) { csLow = i; break; }
    let changeBefore = false;
    for (let i = csLow + 1; i < first; i++) if (w.mosi[i] !== w.mosi[i - 1]) changeBefore = true;
    const cpha = (changeBefore || w.mosi[csLow] !== 0) ? 0 : 1;
    return (cpol << 1) | cpha;
  };
  C.spiRate = (f, div) => ({ fsck: f / div, tbit: div / f });

  /* ---- I2C: je Bit 4 Schritte (SCL tief, hoch, hoch, tief), SDA wechselt nur bei SCL = tief; Start/Stopp = SDA-Wechsel bei SCL hoch ---- */
  C.i2cEncode = function (o) {   // -> Liste von Elementen {k:'start'|'bit'|'stop'|'rstart', v, role, byte}
    const items = [{ k: 'start' }], rw = o.rw === 'R' ? 1 : 0;
    const bytes = o.bytes || [], acks = o.acks || [];
    const pushByte = (val, role, ackV, idx) => {
      for (let b = 7; b >= 0; b--) items.push({ k: 'bit', v: (val >> b) & 1, role, byte: idx, pos: 7 - b });
      items.push({ k: 'bit', v: ackV, role: 'ack', byte: idx, pos: 8 });
    };
    pushByte(((o.addr & 0x7F) << 1) | rw, 'addr', acks[0] != null ? acks[0] : 0, 0);
    bytes.forEach((b, i) => {
      const def = o.rw === 'R' ? (i === bytes.length - 1 ? 1 : 0) : 0;   // Lesen: Master quittiert alle ausser dem letzten Byte
      pushByte(b, 'data', acks[i + 1] != null ? acks[i + 1] : def, i + 1);
    });
    if (!o.noStop) items.push({ k: 'stop' });
    return items;
  };
  C.i2cWave = function (items) {
    const scl = [1], sda = [1], marks = [];     // marks[i] = [erster, letzter+1] Index der Elemente (fuer Beschriftungen)
    const add = (c, d) => { scl.push(c); sda.push(d); };
    items.forEach(it => {
      const a = scl.length;
      if (it.k === 'start') { add(1, 1); add(1, 0); add(0, 0); }
      else if (it.k === 'rstart') { add(0, 1); add(1, 1); add(1, 0); add(0, 0); }
      else if (it.k === 'bit') { add(0, it.v); add(1, it.v); add(1, it.v); add(0, it.v); }
      else if (it.k === 'stop') { add(0, 0); add(1, 0); add(1, 1); }
      marks.push([a, scl.length]);
    });
    add(1, 1); add(1, 1);
    return { scl, sda, n: scl.length, marks };
  };
  /* Dekodierer arbeitet nur auf scl/sda */
  C.i2cDecode = function (w) {
    const { scl, sda } = w, ev = []; let bits = [], inTx = false, nb = 0, byteIdx = 0;
    const closeByte = (idxEnd) => {
      const val = bits.slice(0, 8).reduce((a, b) => (a << 1) | b, 0), ack = bits[8] === 0;
      if (byteIdx === 0) ev.push({ type: 'ADDR', addr: val >> 1, rw: (val & 1) ? 'R' : 'W', ack, at: idxEnd });
      else ev.push({ type: 'DATA', value: val, ack, at: idxEnd });
      byteIdx++; bits = [];
    };
    for (let i = 1; i < scl.length; i++) {
      if (scl[i] === 1 && scl[i - 1] === 1 && sda[i - 1] === 1 && sda[i] === 0) {          // Start (auch wiederholt)
        if (inTx && bits.length > 1) ev.push({ type: 'ABBRUCH', bits: bits.length, at: i });   // 1 Bit = der Takt vor Start/Stopp, kein Datenbit
        ev.push({ type: inTx ? 'RSTART' : 'START', at: i }); inTx = true; bits = []; byteIdx = 0; continue;
      }
      if (scl[i] === 1 && scl[i - 1] === 1 && sda[i - 1] === 0 && sda[i] === 1) {          // Stopp
        if (inTx && bits.length > 1) ev.push({ type: 'ABBRUCH', bits: bits.length, at: i });
        ev.push({ type: 'STOP', at: i }); inTx = false; bits = []; continue;
      }
      if (inTx && scl[i - 1] === 0 && scl[i] === 1) {                                        // steigende SCL-Flanke: Bit lesen
        bits.push(sda[i]); nb++;
        if (bits.length === 9) closeByte(i);
      }
    }
    if (inTx) ev.push({ type: 'KEIN-STOP', at: scl.length });
    return ev;
  };
  C.i2cClocks = nBytes => 9 * (1 + nBytes);
  C.i2cTime = (fscl, nBytes) => C.i2cClocks(nBytes) / fscl;
  /* Anstiegszeit 30 % -> 70 % an RC: t = RC * ln(0,7/0,3) = 0,8473 RC */
  C.i2cRise = (r, c) => Math.log(0.7 / 0.3) * r * c;
  C.i2cRmax = (trMax, c) => trMax / (Math.log(0.7 / 0.3) * c);
  C.i2cRmin = (vdd, vol, iol) => (vdd - vol) / iol;

  /* =====================================================================
   *  Block 4: Zustandsautomaten
   * ===================================================================== */
  const toSeq = (f, seq) => Array.isArray(seq) ? seq.map(String) : String(seq).replace(/[\s,]/g, '').split('');
  C.fsmRun = function (f, seq) {
    const inp = toSeq(f, seq), states = [f.init], outs = []; let s = f.init;
    for (const x of inp) {
      const nx = f.next[s] && f.next[s][x];
      const o = f.type === 'mealy' ? (f.out[s] && f.out[s][x]) : null;
      s = nx; states.push(s);
      outs.push(f.type === 'mealy' ? o : (f.out[s]));
    }
    return { inputs: inp, states, outs, out0: f.type === 'moore' ? f.out[f.init] : null, final: s };
  };
  C.fsmCheck = function (f) {
    const undef = [], badTarget = [], noOut = [], reach = new Set([f.init]);
    f.states.forEach(s => {
      if (f.type !== 'mealy' && f.out[s] === undefined) noOut.push(s);
      f.inputs.forEach(x => {
        const nx = f.next[s] && f.next[s][x];
        if (nx === undefined) undef.push(s + '/' + x); else if (f.states.indexOf(nx) < 0) badTarget.push(s + '/' + x);
        if (f.type === 'mealy' && !(f.out[s] && f.out[s][x] !== undefined)) noOut.push(s + '/' + x);
      });
    });
    const q = [f.init];
    while (q.length) { const s = q.shift(); f.inputs.forEach(x => { const nx = f.next[s] && f.next[s][x]; if (nx !== undefined && !reach.has(nx)) { reach.add(nx); q.push(nx); } }); }
    return { undef, badTarget, noOut, unreachable: f.states.filter(s => !reach.has(s)) };
  };
  C.ffCount = n => Math.max(1, ceilLog2(n));
  /* Ueberlappender Sequenzdetektor ueber {0,1} aus der Knuth-Morris-Pratt-Tabelle. Mealy: n Zustaende, Moore: n+1 */
  C.seqDetector = function (pat, type) {
    const n = pat.length;
    const delta = (i, c) => { const s = pat.slice(0, i) + c; for (let k = Math.min(n, s.length); k >= 0; k--) if (pat.slice(0, k) === s.slice(s.length - k)) return k; return 0; };
    let border = 0; for (let k = n - 1; k >= 1; k--) if (pat.slice(0, k) === pat.slice(n - k)) { border = k; break; }
    const f = { type, name: 'Detektor ' + pat, inputs: ['0', '1'], init: 'S0', next: {}, out: {}, states: [] };
    const cnt = type === 'moore' ? n + 1 : n;
    for (let i = 0; i < cnt; i++) f.states.push('S' + i);
    for (let i = 0; i < cnt; i++) {
      f.next['S' + i] = {}; if (type === 'mealy') f.out['S' + i] = {};
      ['0', '1'].forEach(c => {
        let d = delta(i, c), o = (d === n) ? '1' : '0';
        if (type === 'mealy' && d === n) d = border;
        f.next['S' + i][c] = 'S' + d;
        if (type === 'mealy') f.out['S' + i][c] = o;
      });
      if (type === 'moore') f.out['S' + i] = (i === n) ? '1' : '0';
    }
    return f;
  };
  /* Entprell-Automat (Moore) fuer Schwelle N: EIN/AUS stabil, dazwischen Zaehlzustaende AN1..AN(N-1), AB1..AB(N-1) */
  C.debounceFsm = function (N) {
    const f = { type: 'moore', name: 'Entprellen N=' + N, inputs: ['0', '1'], init: 'AUS', next: {}, out: {}, states: ['AUS'] };
    for (let i = 1; i < N; i++) f.states.push('AN' + i);
    f.states.push('EIN');
    for (let i = 1; i < N; i++) f.states.push('AB' + i);
    const up = i => i >= N ? 'EIN' : 'AN' + i, dn = i => i >= N ? 'AUS' : 'AB' + i;
    f.next.AUS = { '0': 'AUS', '1': up(1) };
    for (let i = 1; i < N; i++) { f.next['AN' + i] = { '0': 'AUS', '1': up(i + 1) }; f.out['AN' + i] = '0'; }
    f.next.EIN = { '1': 'EIN', '0': dn(1) };
    for (let i = 1; i < N; i++) { f.next['AB' + i] = { '1': 'EIN', '0': dn(i + 1) }; f.out['AB' + i] = '1'; }
    f.out.AUS = '0'; f.out.EIN = '1';
    return f;
  };
  C.debounceRun = function (raw, N, init) {      // Zaehler-Variante: N gleiche Abweichungen in Folge schalten um
    const r = toSeq(null, raw).map(Number); let st = init || 0, cnt = 0; const out = [];
    for (const x of r) { if (x === st) cnt = 0; else { cnt++; if (cnt >= N) { st = x; cnt = 0; } } out.push(st); }
    return out;
  };
  C.debounceN = (tBounce, tSample) => Math.floor(tBounce / tSample + 1e-9) + 1;   // kleinstes N mit N*T > Prellzeit
  C.cycleTime = ph => ph.reduce((s, p) => s + p.dur, 0);
  C.phaseAt = function (ph, t) {
    const c = C.cycleTime(ph); let r = t % c;
    for (let i = 0; i < ph.length; i++) { if (r < ph[i].dur) return { index: i, phase: ph[i], offset: r }; r -= ph[i].dur; }
    return { index: 0, phase: ph[0], offset: 0 };
  };
  C.phaseConflicts = ph => ph.map((p, i) => (p.ns !== 'R' && p.ew !== 'R') ? i + 1 : 0).filter(Boolean);
  C.greenShare = (ph, dir) => ph.filter(p => p[dir] === 'G').reduce((s, p) => s + p.dur, 0) / C.cycleTime(ph);

  /* =====================================================================
   *  Block 5: Speicher, Atomaritaet, Echtzeit
   * ===================================================================== */
  C.ramFree = (ram, data, bss, heap) => ram - data - bss - heap;
  C.frameBytes = o => (o.ret == null ? 2 : o.ret) + (o.regs || 0) + (o.locals || 0);
  C.maxDepth = (free, frame) => Math.floor(free / frame);
  C.stackWorst = list => list.reduce((s, x) => s + x, 0);
  C.heapSim = function (size, ops) {
    let free = [{ s: 0, n: size }]; const al = {}, fails = [];
    const merge = () => {
      free.sort((a, b) => a.s - b.s); const m = [];
      for (const b of free) { const l = m[m.length - 1]; if (l && l.s + l.n === b.s) l.n += b.n; else m.push({ s: b.s, n: b.n }); }
      free = m;
    };
    ops.forEach(o => {
      if (o.op === 'a') {
        const b = free.find(x => x.n >= o.n);
        if (!b) { fails.push(o.id); return; }
        al[o.id] = { s: b.s, n: o.n }; b.s += o.n; b.n -= o.n; free = free.filter(x => x.n > 0);
      } else if (o.op === 'f' && al[o.id]) { free.push({ s: al[o.id].s, n: al[o.id].n }); delete al[o.id]; merge(); }
    });
    const total = free.reduce((s, x) => s + x.n, 0), largest = free.reduce((m, x) => Math.max(m, x.n), 0);
    return { free, allocs: al, fails, totalFree: total, largest, fragPct: total ? (1 - largest / total) * 100 : 0 };
  };
  /* 8-Bit-Bus: niederwertiges Byte wird gelesen, dann zaehlt die ISR hoch, dann das hoehere Byte */
  C.tornRead = function (v, inc, width) {
    width = width || 16; const mod = Math.pow(2, width), v2 = (v + inc) % mod;
    const read = (v2 - (v2 % 256)) + (v % 256);
    return { before: v, after: v2, read, err: read - v };
  };
  C.tornBad = function (inc, width) {
    width = width || 16; let bad = 0; const n = Math.pow(2, width);
    for (let v = 0; v < n; v++) { const r = C.tornRead(v, inc, width); if (r.read !== r.before && r.read !== r.after) bad++; }
    return { bad, total: n, frac: bad / n };
  };
  C.critTime = (cycles, f) => cycles / f;
  /* Modell des Compilers: ohne volatile wird das Flag einmal vor der Schleife in ein Register geladen */
  C.volatileLoop = function (o) {
    let flag = 0; const reg = flag;
    for (let t = 0; t < o.maxTicks; t++) {
      if (t === o.isrAt) flag = 1;
      if ((o.volatile ? flag : reg) === 1) return { exited: true, at: t };
    }
    return { exited: false, at: null };
  };

  /* Festprioritaets-Scheduler mit einem Mutex. Aufgabe: {name, prio (gross = wichtig), arrive, ops:[{t:'run',n}|{t:'lock'}|{t:'unlock'}]}.
   * opt.pip = Prioritaetsvererbung. Ergebnis: trace je Zeiteinheit, done je Aufgabe (Ende), blocked (Wartezeit auf den Mutex). */
  C.schedSim = function (tasks, opt) {
    opt = opt || {}; const maxT = opt.maxT || 300;
    const T = tasks.map((t, i) => ({ name: t.name, prio: t.prio, arrive: t.arrive, ops: t.ops.map(o => Object.assign({}, o)), pc: 0, left: null, wait: false, done: null, idx: i, blocked: 0 }));
    let owner = null; const trace = [];
    const eff = x => {
      if (!opt.pip || owner !== x) return x.prio;
      return T.filter(w => w.wait && w.done === null).reduce((m, w) => Math.max(m, w.prio), x.prio);
    };
    for (let t = 0; t < maxT; t++) {
      if (T.every(x => x.done !== null)) break;
      let runner = null, guard = 0;
      while (guard++ < 100) {
        const cand = T.filter(x => x.arrive <= t && x.done === null && !x.wait).sort((a, b) => eff(b) - eff(a) || a.idx - b.idx)[0];
        if (!cand) break;
        const op = cand.ops[cand.pc];
        if (!op) { cand.done = t; continue; }
        if (op.t === 'unlock') { if (owner === cand) { owner = null; T.forEach(w => { w.wait = false; }); } cand.pc++; continue; }
        if (op.t === 'lock') { if (owner === null || owner === cand) { owner = cand; cand.pc++; } else cand.wait = true; continue; }
        runner = cand; break;
      }
      const waiting = T.filter(x => x.arrive <= t && x.done === null && x.wait);
      waiting.forEach(x => { x.blocked++; });
      trace.push({ t, run: runner ? runner.name : null, owner: owner ? owner.name : null, waiting: waiting.map(x => x.name), eff: runner ? eff(runner) : null });
      if (runner) {
        const op = runner.ops[runner.pc];
        if (runner.left === null) runner.left = op.n;
        runner.left--;
        if (runner.left === 0) { runner.pc++; runner.left = null; if (!runner.ops[runner.pc]) runner.done = t + 1; }
      }
    }
    const done = {}, blocked = {}; T.forEach(x => { done[x.name] = x.done; blocked[x.name] = x.blocked; });
    return { trace, done, blocked, len: trace.length };
  };
  /* Auslastung und Antwortzeiten (Rate-Monotonic: kleinere Periode = hoehere Prioritaet; Frist = Periode) */
  C.rmBound = n => n * (Math.pow(2, 1 / n) - 1);
  C.rmAnalysis = function (tasks) {
    const ts = tasks.slice().sort((a, b) => a.T - b.T), U = ts.reduce((s, x) => s + x.C / x.T, 0), rows = [];
    ts.forEach((x, i) => {
      let R = x.C;
      for (let k = 0; k < 1000; k++) {
        const nx = x.C + ts.slice(0, i).reduce((s, h) => s + Math.ceil(R / h.T - 1e-12) * h.C, 0);
        if (nx === R || nx > x.T) { R = nx; break; }
        R = nx;
      }
      rows.push({ name: x.name, C: x.C, T: x.T, R, ok: R <= x.T });
    });
    return { U, bound: C.rmBound(ts.length), sufficient: U <= C.rmBound(ts.length), rows, all: rows.every(r => r.ok) };
  };

  root.EMB_CORE = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
