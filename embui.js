/* embui.js - Embedded vertieft: Oberflaeche (fuenf Bloecke: Erklaerung, Labor, Aufgaben). Zahlen kommen aus EMB_CORE, Aufgaben aus EMB_TASKS, Zeichnen aus EMB_VIZ.
 * Speicher: lm4.emb.done (erledigte Aufgaben), lm4.emb.tipps (benutzte Tipps), lm4.emb.tab, lm4.emb.theme. Alles in try/catch, die Seite laeuft auch ohne localStorage. */
(function (root) {
  'use strict';
  const C = () => root.EMB_CORE, V = () => root.EMB_VIZ, D = () => root.EMB_VIZ.draw, DATA = () => root.EMB_DATA, TK = () => root.EMB_TASKS, META = () => root.EMB_META;
  const sg = (x, n) => C().sig(x, n || 4);
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  const KEY = { done: 'lm4.emb.done', tipps: 'lm4.emb.tipps', tab: 'lm4.emb.tab', theme: 'lm4.emb.theme' };

  /* ---------- DOM-Hilfen ---------- */
  function h(tag, props) {
    const e = document.createElement(tag);
    if (props) for (const k in props) { const v = props[k]; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v); }
    for (let i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(x => add(e, x)); else e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); }
  let toastT = null;
  function toast(s) { const t = document.getElementById('toast'); if (!t) return; t.textContent = s; t.className = 'on'; clearTimeout(toastT); toastT = setTimeout(() => { t.className = ''; }, 2600); }
  const fmtF = f => f >= 1e6 ? sg(f / 1e6) + ' MHz' : f >= 1e3 ? sg(f / 1e3) + ' kHz' : sg(f) + ' Hz';
  const fmtT = s => V().fmtT(s);
  let uid = 0;
  /* Regler (Schieber) mit Beschriftung und Wert */
  function range(label, min, max, step, val, fmt, on) {
    const id = 'r' + (++uid), inp = h('input', { type: 'range', id, min, max, step, value: val }), b = h('b'), lab = h('label', { for: id }, h('span', { text: label }), b);
    const api = { el: h('div', { class: 'ctl' }, lab, inp), get: () => +inp.value, set(v) { inp.value = v; show(); }, max(m) { inp.max = m; show(); }, input: inp };
    const show = () => { b.textContent = fmt ? fmt(+inp.value) : inp.value; inp.setAttribute('aria-valuetext', b.textContent); };
    inp.addEventListener('input', () => { show(); on && on(+inp.value); }); show(); return api;
  }
  function seg(label, opts, val, on) {
    const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': label }); let cur = val;
    const btns = opts.map(o => { const b = h('button', { type: 'button', 'aria-pressed': String(o.v === cur), onclick: () => { cur = o.v; paint(); on && on(cur); } }, o.t); wrap.appendChild(b); return b; });
    const paint = () => btns.forEach((b, i) => b.setAttribute('aria-pressed', String(opts[i].v === cur)));
    return { el: h('div', { class: 'ctl' }, h('span', { class: 'lb', text: label }), wrap), get: () => cur, set(v) { cur = v; paint(); } };
  }
  function sel(label, opts, val, on) {
    const id = 's' + (++uid), s = h('select', { id }, opts.map(o => h('option', { value: String(o.v), text: o.t })));
    s.value = String(val); s.addEventListener('change', () => on && on(s.value));
    return { el: h('div', { class: 'ctl' }, h('label', { for: id }, h('span', { text: label })), s), get: () => s.value, set(v) { s.value = String(v); } };
  }
  function textIn(label, val, on, ph) {
    const id = 't' + (++uid), i = h('input', { type: 'text', id, value: val, placeholder: ph || '', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', inputmode: 'text' });
    i.addEventListener('input', () => on && on(i.value));
    return { el: h('div', { class: 'ctl' }, h('label', { for: id }, h('span', { text: label })), i), get: () => i.value, set(v) { i.value = v; } };
  }
  const kv = (k, v) => h('div', { class: 'kv' }, h('span', { text: k }), h('b', { text: v }));
  const note = (txt, cls) => h('div', { class: 'note' + (cls ? ' ' + cls : ''), role: 'note', text: txt });

  /* =====================================================================
   *  Labore
   * ===================================================================== */
  function timerLab() {
    const st = { f: 16e6, ps: 64, mode: 'fast', bits: 8, ocr: 128 };
    const cb = V().cbox({ h: 250, aria: 'Zählerstand und Ausgang des Timers über der Zeit' }), out = h('div');
    const fSel = sel('Systemtakt', [{ v: 1e6, t: '1 MHz' }, { v: 8e6, t: '8 MHz' }, { v: 16e6, t: '16 MHz' }, { v: 20e6, t: '20 MHz' }], st.f, v => { st.f = +v; upd(); });
    const pSel = sel('Vorteiler', C().PRESCALERS.map(p => ({ v: p, t: String(p) })), st.ps, v => { st.ps = +v; upd(); });
    const mSeg = seg('Betriebsart', [{ v: 'ovf', t: 'Überlauf' }, { v: 'ctc', t: 'CTC' }, { v: 'fast', t: 'Fast-PWM' }, { v: 'phase', t: 'Phasenkorrekt' }], st.mode, v => { st.mode = v; upd(); });
    const bSeg = seg('Zählerbreite', [{ v: 8, t: '8 Bit' }, { v: 16, t: '16 Bit' }], 8, v => { st.bits = v; oc.max(Math.pow(2, v) - 1); if (st.ocr > Math.pow(2, v) - 1) { st.ocr = Math.pow(2, v) - 1; oc.set(st.ocr); } upd(); });
    const oc = range('Vergleichswert OCR', 0, 255, 1, st.ocr, v => String(v), v => { st.ocr = v; upd(); });
    function upd() {
      const Cc = C(), top = Math.pow(2, st.bits) - 1, ocr = Math.min(st.ocr, top), m = st.mode; let period, rows = [];
      const tick = Cc.timerTick(st.f, st.ps); rows.push(kv('Dauer eines Zählschritts', fmtT(tick)));
      if (m === 'ovf') { period = Cc.timerOverflow(st.f, st.ps, st.bits); rows.push(kv('Überlaufzeit', fmtT(period)), kv('Interruptfrequenz', fmtF(1 / period))); }
      else if (m === 'ctc') { period = tick * (ocr + 1); rows.push(kv('Periode (OCR + 1 Schritte)', fmtT(period)), kv('Interruptfrequenz', fmtF(Cc.ctcFreq(st.f, st.ps, ocr)))); }
      else { const r = m === 'fast' ? Cc.pwmFast(st.f, st.ps, top, ocr) : Cc.pwmPhase(st.f, st.ps, top, ocr); period = r.period; rows.push(kv('PWM-Frequenz', fmtF(r.freq)), kv('Tastverhältnis', sg(r.duty * 100, 5) + ' %'), kv('Mittelwert bei 5 V', sg(r.duty * 5, 4) + ' V')); }
      cb.draw = (g, W, H, P) => D().timer(g, W, H, P, { mode: m, top: m === 'ctc' ? ocr : top, ocr, periodSec: period }); cb.render();
      oc.input.disabled = m === 'ovf'; out.replaceChildren(...rows);
      if (m === 'ovf') out.appendChild(note('Im Überlaufmodus zählt der Zähler immer bis zum Höchstwert; OCR spielt keine Rolle.'));
      if (m === 'fast' && ocr === 0) out.appendChild(note('Bei Fast-PWM bleibt auch mit OCR = 0 ein schmaler Impuls (1 Schritt): Völlig 0 % gibt es nicht.'));
    }
    const el = h('div', { class: 'card' }, h('h3', { text: 'Labor: Timer, CTC und PWM' }), h('div', { class: 'grid2' }, h('div', null, cb.wrap, h('div', { class: 'legend' }, h('span', null, h('i', { style: 'background:var(--c1)' }), 'Zähler'), h('span', null, h('i', { style: 'background:var(--warn)' }), 'OCR'), h('span', null, h('i', { style: 'background:var(--c3)' }), 'Ausgang'), h('span', null, h('i', { style: 'background:var(--c2)' }), 'Interrupt')), out), h('div', null, mSeg.el, fSel.el, pSel.el, bSeg.el, oc.el)));
    upd(); return el;
  }

  function isrLab() {
    const st = { per: 600, exec: 250, lat: 10, mask: false, jit: false, seed: 1, n: 10 };
    const cb = V().cbox({ h: 232, aria: 'Zeitachse mit Ereignissen, Merkerbit und ISR-Aufrufen' }), out = h('div');
    const per = range('Abstand der Ereignisse', 200, 2000, 50, st.per, v => v + ' µs', v => { st.per = v; upd(); });
    const ex = range('Dauer der ISR', 20, 1500, 10, st.exec, v => v + ' µs', v => { st.exec = v; upd(); });
    const la = range('Latenz bis zum ISR-Start', 0, 150, 5, st.lat, v => v + ' µs', v => { st.lat = v; upd(); });
    const mk = seg('Interrupts gesperrt (cli … sei)', [{ v: false, t: 'nein' }, { v: true, t: 'ja, ein Abschnitt' }], false, v => { st.mask = v; upd(); });
    const jt = seg('Ereignisse', [{ v: false, t: 'gleichmäßig' }, { v: true, t: 'unregelmäßig' }], false, v => { st.jit = v; upd(); });
    const rn = h('button', { type: 'button', class: 'btn', onclick: () => { st.seed++; st.jit = true; jt.set(true); upd(); } }, 'Neue Verteilung würfeln');
    function upd() {
      const r = C().lcg(st.seed * 7919), ev = []; for (let i = 0; i < st.n; i++) ev.push(Math.round(100 + i * st.per + (st.jit ? (r() - 0.5) * st.per * 0.9 : 0)));
      const tEnd = Math.round(100 + st.n * st.per), masks = st.mask ? [[Math.round(100 + 2 * st.per - 40), Math.round(100 + 2 * st.per - 40 + st.per * 0.9)]] : [];
      const sim = C().isrSim({ events: ev, exec: st.exec, latency: st.lat, masks, tEnd });
      cb.draw = (g, W, H, P) => D().isr(g, W, H, P, { events: sim.events, sim, exec: st.exec, tEnd, masks }); cb.render();
      const rows = [kv('Ereignisse', String(ev.length)), kv('ISR-Aufrufe', String(sim.calls.length)), kv('verlorene Ereignisse', String(sim.lost.length)), kv('ISR-Last', sg(sim.load * 100, 3) + ' %'), kv('größte Verzögerung', sim.maxLat + ' µs')];
      out.replaceChildren(...rows);
      if (st.exec > st.per) out.appendChild(note('Die ISR dauert länger als der Abstand der Ereignisse: Der Rückstand wächst mit jedem Ereignis, früher oder später gehen Ereignisse verloren; für die Hauptschleife bleibt keine Zeit.', 'bad'));
      else if (sim.lost.length) out.appendChild(note('Ein Ereignis kam, solange das Merkerbit noch gesetzt war (ISR hatte noch nicht begonnen): Es ist verloren.', 'bad'));
      else out.appendChild(note('Alle Ereignisse werden bedient. Verkürze den Abstand oder verlängere die ISR, bis etwas verloren geht.', 'ok'));
    }
    const el = h('div', { class: 'card' }, h('h3', { text: 'Labor: Zeitachse mit ISR-Aufrufen, Latenz und Verlust' }), h('div', { class: 'grid2' }, h('div', null, cb.wrap, h('div', { class: 'legend' }, h('span', null, h('i', { style: 'background:var(--accent)' }), 'Ereignis'), h('span', null, h('i', { style: 'background:var(--warn)' }), 'wartet (Merkerbit)'), h('span', null, h('i', { style: 'background:var(--c2)' }), 'ISR läuft'), h('span', null, h('i', { style: 'background:var(--danger)' }), 'verloren')), out), h('div', null, per.el, ex.el, la.el, mk.el, jt.el, rn)));
    upd(); return el;
  }

  function bounceLab() {
    const st = { n: 7, span: 2500, seed: 3, mode: 'fall', lock: 0 };
    const cb = V().cbox({ h: 196, aria: 'Prellender Taster: Pegel und ausgelöste Interrupts' }), out = h('div');
    const nn = range('Prellflanken', 1, 15, 2, st.n, v => String(v), v => { st.n = v; upd(); });
    const sp = range('Dauer des Prellens', 500, 5000, 100, st.span, v => v + ' µs', v => { st.span = v; upd(); });
    const md = seg('Interrupt bei', [{ v: 'fall', t: 'fallender Flanke' }, { v: 'rise', t: 'steigender' }, { v: 'change', t: 'jeder Änderung' }], st.mode, v => { st.mode = v; upd(); });
    const lk = range('Software-Sperrzeit', 0, 6000, 250, st.lock, v => v + ' µs', v => { st.lock = v; upd(); });
    const rn = h('button', { type: 'button', class: 'btn', onclick: () => { st.seed++; upd(); } }, 'Neues Prellmuster');
    function upd() {
      const e = C().bounceTrace(500, st.n, st.seed, st.span), last = e[e.length - 1].t - e[0].t, cnt = C().lockoutCount(e, st.mode, st.lock);
      cb.draw = (g, W, H, P) => D().bounce(g, W, H, P, { edges: e, mode: st.mode, lock: st.lock, result: true }); cb.render();
      out.replaceChildren(kv('Flanken insgesamt', String(e.length)), kv('passende Flanken', String(C().edgeCount(e, st.mode))), kv('ISR-Aufrufe mit Sperrzeit', String(cnt)), kv('Prellen dauert', last + ' µs'));
      if (st.mode === 'rise' && C().edgeCount(e, 'rise') === 0) out.appendChild(note('Beim Drücken gibt es nur wenige steigende Flanken: nur durch Prellen. Beim Loslassen wäre es umgekehrt.'));
      else if (cnt === 1 && st.lock > last) out.appendChild(note('Eine Auslösung: Die Sperrzeit ist länger als die Prellzeit.', 'ok'));
      else if (cnt > 1 && st.lock > 0 && st.lock <= last) out.appendChild(note('Die Sperrzeit (' + st.lock + ' µs) ist nicht länger als das Prellen (' + last + ' µs): Prellflanken rutschen nach Ablauf der Sperre durch.', 'bad'));
      else if (cnt > 1) out.appendChild(note('Ein Tastendruck löst ' + cnt + ' Interrupts aus.', 'bad'));
    }
    const el = h('div', { class: 'card' }, h('h3', { text: 'Labor: Taster prellt' }), h('div', { class: 'grid2' }, h('div', null, cb.wrap, h('div', { class: 'legend' }, h('span', null, h('i', { style: 'background:var(--ok)' }), 'ISR-Aufruf'), h('span', null, h('i', { style: 'background:var(--warn)' }), 'Sperrzeit läuft'), h('span', null, '✕ Flanke ignoriert')), out), h('div', null, md.el, nn.el, sp.el, lk.el, rn)));
    upd(); return el;
  }

  function adcLab() {
    const st = { vref: 5, bits: 4, fin: 300, fs: 2000 };
    const cb = V().cbox({ h: 280, aria: 'Sinussignal, Abtastwerte und Quantisierungsstufen' }), out = h('div');
    const vr = sel('Referenz', [{ v: 1.1, t: '1,1 V' }, { v: 2.56, t: '2,56 V' }, { v: 3.3, t: '3,3 V' }, { v: 5, t: '5 V' }], st.vref, v => { st.vref = +v; upd(); });
    const bi = range('Auflösung', 1, 12, 1, st.bits, v => v + ' Bit', v => { st.bits = v; upd(); });
    const fi = range('Signalfrequenz', 50, 5000, 10, st.fin, v => v + ' Hz', v => { st.fin = v; upd(); });
    const fs = sel('Abtastrate', [{ v: 500, t: '500 Hz' }, { v: 1000, t: '1000 Hz' }, { v: 2000, t: '2000 Hz' }, { v: 4000, t: '4000 Hz' }, { v: 8000, t: '8000 Hz' }], st.fs, v => { st.fs = +v; upd(); });
    function upd() {
      const Cc = C(), lsb = Cc.adcLsb(st.vref, st.bits), fa = Cc.aliasFreq(st.fin, st.fs);
      cb.draw = (g, W, H, P) => D().adc(g, W, H, P, st); cb.render();
      out.replaceChildren(kv('Stufen', String(Math.pow(2, st.bits))), kv('LSB', sg(lsb * 1e3, 4) + ' mV'), kv('größter Fehler beim Runden', '± ' + sg(lsb * 500, 4) + ' mV'), kv('SQNR (Faustformel)', sg(Cc.sqnrDb(st.bits), 4) + ' dB'), kv('höchste saubere Frequenz (fs/2)', fmtF(st.fs / 2)), kv('Messfrequenz im Ergebnis', fmtF(fa)));
      out.appendChild(st.fin > st.fs / 2 ? note('Signal oberhalb fs/2: Es erscheint als Alias mit ' + fmtF(fa) + ' (gestrichelt). Aus den Messwerten allein ist das nicht von einem echten ' + fmtF(fa) + '-Signal zu unterscheiden.', 'bad') : note('Unterhalb von fs/2: Die Frequenz wird richtig erfasst. Die Treppenstufen zeigen den Quantisierungsfehler.', 'ok'));
    }
    const el = h('div', { class: 'card' }, h('h3', { text: 'Labor: Abtasten und Quantisieren' }), h('div', { class: 'grid2' }, h('div', null, cb.wrap, h('div', { class: 'legend' }, h('span', null, h('i', { style: 'background:var(--c1)' }), 'Signal'), h('span', null, h('i', { style: 'background:var(--c3)' }), 'quantisierter Wert'), h('span', null, h('i', { style: 'background:var(--fg)' }), 'Abtastzeitpunkt'), h('span', null, h('i', { style: 'background:var(--warn)' }), 'Alias')), out), h('div', null, vr.el, bi.el, fi.el, fs.el)));
    upd(); return el;
  }

  const hexs = (n, d) => C().hex(n, d || 2);
  const printable = b => (b >= 32 && b < 127) ? ' „' + String.fromCharCode(b) + '“' : '';
  function busLab() {
    const st = { proto: 'uart', byte: '4B', parity: 'E', stop: 1, data: 8, baud: 9600, mosi: 'A5', miso: '3C', mode: 0, slave: 0, addr: '48', rw: 'W', bytes: '01 60', fscl: 100000, flips: { uart: [], spi: [], i2c: [] } };
    const ctl = h('div'), bitsRow = h('div', { class: 'bits' }), out = h('div'), proto = seg('Protokoll', [{ v: 'uart', t: 'UART' }, { v: 'spi', t: 'SPI' }, { v: 'i2c', t: 'I²C' }], 'uart', v => { st.proto = v; build(); });
    let heightFn = () => 190, minWFn = () => 0;
    const cbx = V().cbox({ h: W => heightFn(W), minW: W => minWFn(W), aria: 'Logikanalysator: Signalverläufe und Dekodierung' });
    const flipBtn = (label, idx, lst, title) => h('button', { type: 'button', class: lst.indexOf(idx) >= 0 ? 'flip' : '', title: title || '', 'aria-pressed': String(lst.indexOf(idx) >= 0), onclick: () => { const i = lst.indexOf(idx); if (i >= 0) lst.splice(i, 1); else lst.push(idx); render(); } }, label);
    function render() {
      const Cc = C(); out.replaceChildren(); bitsRow.replaceChildren();
      const resetBtn = h('button', { type: 'button', class: 'btn', onclick: () => { st.flips[st.proto] = []; render(); } }, 'Alle Bitfehler zurücknehmen');
      if (st.proto === 'uart') {
        const cfg = { data: st.data, parity: st.parity, stop: st.stop }, msk = Math.pow(2, st.data) - 1; let by = Cc.parseHex(st.byte); if (!isFinite(by) || by > 255) { out.appendChild(note('Bitte ein Byte als Hexzahl eingeben (00 bis FF).', 'bad')); return; } by &= msk;
        const bits = Cc.uartBits(by, cfg), nb = bits.length, fl = st.flips.uart.filter(i => i < nb); fl.forEach(i => { bits[i] ^= 1; });
        const w = Cc.uartWave([bits], 8, 1), fr = Cc.uartDecodeWave(w, 8, cfg);
        heightFn = () => 170; minWFn = () => (nb + 2) * 30 + 24; cbx.draw = (g, W, H, P) => D().uart(g, W, H, P, { bits, cfg, flips: fl, mark: true, decode: fr }); cbx.render();
        const names = ['Start']; for (let i = 0; i < st.data; i++) names.push('D' + i); if (st.parity !== 'N') names.push('Parität'); for (let i = 0; i < st.stop; i++) names.push('Stopp');
        const grp = h('div', { class: 'grp' }, h('span', { text: 'Bit kippen:' })); names.forEach((n, i) => grp.appendChild(flipBtn(n === 'Start' ? 'S' : n === 'Parität' ? 'P' : n === 'Stopp' ? 'St' : n, i, st.flips.uart, n))); bitsRow.appendChild(grp);
        out.appendChild(kv('Bitzeit bei ' + st.baud + ' Baud', fmtT(1 / st.baud))); out.appendChild(kv('Rahmen', Cc.uartFrameBits(cfg) + ' Bit = ' + fmtT(Cc.uartFrameBits(cfg) / st.baud)));
        out.appendChild(kv('gesendet', hexs(by) + printable(by) + ', Bits LSB zuerst: ' + Cc.uartBits(by, cfg).slice(1, 1 + st.data).join('')));
        if (!fr.length) out.appendChild(note('Kein Rahmen erkannt (Startbit fehlt).', 'bad'));
        else { const f = fr[0], bad = f.byte ^ by; out.appendChild(kv('empfangen', hexs(f.byte) + printable(f.byte))); out.appendChild(note(!f.framingOk ? 'Rahmenfehler: Das Stoppbit ist nicht High.' : !f.parityOk ? 'Paritätsfehler: Die Zahl der Einsen passt nicht zum Paritätsbit. Ein Bit ist gekippt, aber welches, sagt die Parität nicht.' : bad ? 'Daten verändert (Bitfehler in Bit ' + [...Array(8).keys()].filter(i => (bad >> i) & 1).join(', ') + '), aber die Prüfung merkt nichts: Es sind zwei Bits gekippt, oder es gibt keine Parität.' : 'Rahmen fehlerfrei empfangen.', !f.framingOk || !f.parityOk ? 'bad' : (bad ? 'bad' : 'ok'))); }
      } else if (st.proto === 'spi') {
        let mo = Cc.parseHex(st.mosi), mi = Cc.parseHex(st.miso); if (!isFinite(mo) || mo > 255 || !isFinite(mi) || mi > 255) { out.appendChild(note('Bitte MOSI und MISO als Hexzahl eingeben (00 bis FF).', 'bad')); return; }
        let sent = mo; st.flips.spi.forEach(k => { sent ^= 1 << (7 - k); });
        const w = Cc.spiWave({ mosi: sent, miso: mi, mode: st.mode }), d = Cc.spiDecode(w, st.slave, 8), cfgM = Cc.spiCfg(st.mode), cfgS = Cc.spiCfg(st.slave);
        heightFn = () => 236; minWFn = () => 54 + w.total * 7 + 10; cbx.draw = (g, W, H, P) => D().spi(g, W, H, P, { wave: w, sample: d }); cbx.render();
        const grp = h('div', { class: 'grp' }, h('span', { text: 'MOSI-Bit kippen:' })); for (let k = 0; k < 8; k++) grp.appendChild(flipBtn('D' + (7 - k), k, st.flips.spi, 'Bit ' + (7 - k))); bitsRow.appendChild(grp);
        out.appendChild(kv('Master: CPOL / CPHA', cfgM.cpol + ' / ' + cfgM.cpha + ' (Modus ' + st.mode + ')')); out.appendChild(kv('Ruhepegel SCK', cfgM.idle ? 'High' : 'Low')); out.appendChild(kv('Slave tastet ab bei', (cfgS.sampleRising ? 'steigender' : 'fallender') + ' Flanke (Modus ' + st.slave + ')'));
        out.appendChild(kv('Takt 4 MHz: ein Byte', fmtT(8 / 4e6))); out.appendChild(kv('MOSI gesendet', hexs(sent))); out.appendChild(kv('Slave liest (MOSI)', hexs(d.mosi))); out.appendChild(kv('Master liest (MISO)', hexs(Cc.spiDecode(w, st.mode, 8).miso)));
        if (d.unsafe) out.appendChild(note('Abtastflanke und Datenwechsel fallen zusammen: Der Slave liest unsicher (Setup- und Hold-Zeit verletzt). Die Modi von Master und Slave passen nicht.', 'bad'));
        else if (sent !== mo) out.appendChild(note('Bitfehler im Byte (gekippt: ' + hexs(sent ^ mo) + '). SPI hat keine eigene Prüfung: Der Fehler fällt nur durch Vergleich auf.', 'bad')); else out.appendChild(note('Modi passen: Der Slave liest, was der Master gesendet hat.', 'ok'));
      } else {
        const ad = Cc.parseHex(st.addr), bytes = st.bytes.trim() ? st.bytes.trim().split(/[\s,;]+/).map(Cc.parseHex) : [];
        if (!isFinite(ad) || ad > 0x7F || bytes.some(b => !isFinite(b) || b > 255) || bytes.length > 4) { out.appendChild(note('Adresse 00 bis 7F und höchstens vier Datenbytes (00 bis FF) als Hexzahlen eingeben.', 'bad')); return; }
        const items = Cc.i2cEncode({ addr: ad, rw: st.rw, bytes }).map(x => Object.assign({}, x)); st.flips.i2c.forEach(i => { if (items[i] && items[i].k === 'bit') items[i].v ^= 1; });
        const w = Cc.i2cWave(items), ev = Cc.i2cDecode(w), labels = [];
        ev.forEach(e => { if (e.type === 'ADDR') labels[0] = 'Adr ' + hexs(e.addr) + ' ' + e.rw; if (e.type === 'DATA') labels[(labels.length || 1)] = hexs(e.value); });
        heightFn = () => 190; minWFn = () => 46 + w.n * 8 + 10; cbx.draw = (g, W, H, P) => D().i2c(g, W, H, P, { wave: w, items, annotate: { bytes: labels } }); cbx.render();
        let curB = -1, grp = null; items.forEach((it, i) => { if (it.k !== 'bit') return; if (it.byte !== curB) { curB = it.byte; grp = h('div', { class: 'grp' }, h('span', { text: curB === 0 ? 'Adresse:' : 'Byte ' + curB + ':' })); bitsRow.appendChild(grp); } const nm = it.pos === 8 ? 'ACK' : curB === 0 ? (it.pos === 7 ? 'R/W' : 'A' + (6 - it.pos)) : 'D' + (7 - it.pos); grp.appendChild(flipBtn(nm + '=' + it.v, i, st.flips.i2c, nm)); });
        ev.forEach(e => { const t = e.type; out.appendChild(h('div', { class: 'kv' }, h('span', { text: t === 'ADDR' ? 'Adresse' : t === 'DATA' ? 'Daten' : t }), h('b', { class: e.ack === false ? 'nack' : '', style: e.ack === false ? 'color:var(--bad-fg)' : '', text: t === 'ADDR' ? hexs(e.addr) + ', ' + (e.rw === 'W' ? 'schreiben' : 'lesen') + ', ' + (e.ack ? 'ACK' : 'NACK') : t === 'DATA' ? hexs(e.value) + ', ' + (e.ack ? 'ACK' : 'NACK') : '' }))); });
        const addrEv = ev.find(e => e.type === 'ADDR');
        out.appendChild(kv('Dauer bei ' + fmtF(st.fscl), fmtT(Cc.i2cTime(st.fscl, bytes.length)) + ' (' + Cc.i2cClocks(bytes.length) + ' Takte)'));
        if (!addrEv) out.appendChild(note('Keine Adresse erkannt.', 'bad')); else if (!addrEv.ack) out.appendChild(note('Adresse nicht quittiert (NACK): Kein Gerät antwortet oder die Adresse ist verändert.', 'bad'));
        else if (ev.some(e => e.type === 'DATA' && !e.ack) && st.rw === 'W') out.appendChild(note('Ein Datenbyte wurde nicht quittiert (NACK): Der Empfänger hat es nicht angenommen.', 'bad'));
        else if (addrEv.addr !== ad) out.appendChild(note('Die Adresse hat sich verändert: Ein anderes Gerät könnte antworten.', 'bad')); else if (ev[ev.length - 1].type !== 'STOP') out.appendChild(note('Kein Stopp-Zustand erkannt.', 'bad')); else out.appendChild(note('Übertragung fehlerfrei: Start, Adresse, ACK, Daten, Stopp.', 'ok'));
      }
      out.appendChild(resetBtn);
    }
    function build() {
      ctl.replaceChildren();
      if (st.proto === 'uart') ctl.append(textIn('Byte (hex)', st.byte, v => { st.byte = v; st.flips.uart = []; render(); }).el, seg('Parität', [{ v: 'N', t: 'keine' }, { v: 'E', t: 'gerade' }, { v: 'O', t: 'ungerade' }], st.parity, v => { st.parity = v; st.flips.uart = []; render(); }).el, seg('Stoppbits', [{ v: 1, t: '1' }, { v: 2, t: '2' }], st.stop, v => { st.stop = v; st.flips.uart = []; render(); }).el, seg('Datenbits', [{ v: 7, t: '7' }, { v: 8, t: '8' }], st.data, v => { st.data = v; st.flips.uart = []; render(); }).el, sel('Baudrate', [{ v: 9600, t: '9600' }, { v: 115200, t: '115200' }], st.baud, v => { st.baud = +v; render(); }).el);
      else if (st.proto === 'spi') ctl.append(textIn('MOSI-Byte (hex)', st.mosi, v => { st.mosi = v; st.flips.spi = []; render(); }).el, textIn('MISO-Byte (hex)', st.miso, v => { st.miso = v; render(); }).el, seg('SPI-Modus des Masters', [0, 1, 2, 3].map(m => ({ v: m, t: String(m) })), st.mode, v => { st.mode = v; render(); }).el, seg('Modus des Slaves (liest mit)', [0, 1, 2, 3].map(m => ({ v: m, t: String(m) })), st.slave, v => { st.slave = v; render(); }).el);
      else ctl.append(textIn('Adresse (7 Bit, hex)', st.addr, v => { st.addr = v; st.flips.i2c = []; render(); }).el, seg('Richtung', [{ v: 'W', t: 'schreiben' }, { v: 'R', t: 'lesen' }], st.rw, v => { st.rw = v; st.flips.i2c = []; render(); }).el, textIn('Datenbytes (hex, durch Leerzeichen)', st.bytes, v => { st.bytes = v; st.flips.i2c = []; render(); }).el, sel('SCL-Takt', [{ v: 100000, t: '100 kHz' }, { v: 400000, t: '400 kHz' }], st.fscl, v => { st.fscl = +v; render(); }).el);
      render();
    }
    const el = h('div', { class: 'card' }, h('h3', { text: 'Labor: Logikanalysator' }), proto.el, h('div', { class: 'grid2' }, h('div', null, cbx.wrap, bitsRow, out), ctl));
    build(); return el;
  }

  const FSM_SHORT = s => s;
  function fsmLab() {
    const st = { m: 'det', pat: '101', type: 'mealy', n: 3, cur: null, hist: [], last: null };
    const cb = V().cbox({ h: W => st.m === 'deb' && st.n > 3 ? 420 : 340, aria: 'Zustandsdiagramm' }), tbl = h('div', { class: 'tbl' }), hist = h('div', { class: 'hist', role: 'log', 'aria-live': 'polite' }), inBtns = h('div', { class: 'seg' }), info = h('div'), ctl = h('div');
    const AMPEL = { type: 'moore', name: 'Ampel (Zeitgeber)', states: ['Rot', 'RtGe', 'Grün', 'Gelb'], inputs: ['T'], init: 'Rot', next: { Rot: { T: 'RtGe' }, RtGe: { T: 'Grün' }, 'Grün': { T: 'Gelb' }, Gelb: { T: 'Rot' } }, out: { Rot: 'R', RtGe: 'R+Ge', 'Grün': 'Gr', Gelb: 'Ge' } };
    const mk = () => st.m === 'det' ? C().seqDetector(st.pat, st.type) : st.m === 'deb' ? C().debounceFsm(st.n) : AMPEL;
    function reset() { st.cur = mk().init; st.hist = []; st.last = null; draw(); }
    function draw() {
      const f = mk(); if (!f.states.includes(st.cur)) st.cur = f.init;
      cb.draw = (g, W, H, P) => D().fsm(g, W, H, P, { fsm: f, cur: st.cur, last: st.last, short: FSM_SHORT }); cb.render();
      const head = h('tr', null, h('th', { text: 'Zustand' }), f.inputs.map(x => h('th', { text: f.type === 'mealy' ? 'Eingang ' + x + ' → Folge / Ausgang' : 'Eingang ' + x + ' →' })), f.type === 'moore' ? h('th', { text: 'Ausgang' }) : null);
      const rows = f.states.map(s => h('tr', { class: s === st.cur ? 'hl' : '' }, h('td', { text: s + (s === f.init ? ' (Start)' : '') }), f.inputs.map(x => h('td', { text: f.type === 'mealy' ? f.next[s][x] + ' / ' + f.out[s][x] : f.next[s][x] })), f.type === 'moore' ? h('td', { text: f.out[s] }) : null));
      tbl.replaceChildren(h('table', null, h('caption', { text: f.name || 'Zustandstabelle' }), h('thead', null, head), h('tbody', null, rows)));
      info.replaceChildren(kv('Zustände', String(f.states.length)), kv('Flipflops (⌈log₂ n⌉)', String(C().ffCount(f.states.length))), kv('Art', f.type === 'mealy' ? 'Mealy (Ausgang an der Kante)' : 'Moore (Ausgang im Zustand)'), kv('aktueller Zustand', st.cur));
      const chk = C().fsmCheck(f); if (chk.undef.length || chk.unreachable.length) info.appendChild(note('Tabelle unvollständig oder Zustand unerreichbar.', 'bad'));
      hist.textContent = st.hist.length ? st.hist.slice(-12).join('\n') : 'Noch keine Eingabe. Wähle unten einen Eingang.';
      inBtns.replaceChildren(...f.inputs.map(x => h('button', { type: 'button', class: 'btn pri', onclick: () => step(x) }, x === 'T' ? 'Zeit abgelaufen (T)' : 'Eingang ' + x)), h('button', { type: 'button', class: 'btn', onclick: reset }, 'Zurück zum Start'));
    }
    function step(x) {
      const f = mk(), s = st.cur, nx = f.next[s][x], o = f.type === 'mealy' ? f.out[s][x] : f.out[nx];
      st.hist.push('Eingang ' + x + ': ' + s + ' → ' + nx + '   Ausgang ' + o); st.last = { from: s, to: nx }; st.cur = nx; draw();
    }
    const m = seg('Automat', [{ v: 'det', t: 'Sequenzdetektor' }, { v: 'deb', t: 'Taster entprellen' }, { v: 'amp', t: 'Ampel' }], st.m, v => { st.m = v; rebuild(); });
    function rebuild() {
      ctl.replaceChildren(m.el);
      if (st.m === 'det') ctl.append(seg('Muster', ['101', '1101', '1011', '110'].map(p => ({ v: p, t: p })), st.pat, v => { st.pat = v; reset(); }).el, seg('Art', [{ v: 'mealy', t: 'Mealy' }, { v: 'moore', t: 'Moore' }], st.type, v => { st.type = v; reset(); }).el);
      if (st.m === 'deb') ctl.append(range('Schwelle N (gleiche Proben in Folge)', 1, 4, 1, st.n, v => String(v), v => { st.n = v; reset(); }).el);
      reset();
    }
    const el = h('div', { class: 'card' }, h('h3', { text: 'Labor: Zustandsautomaten – Tabelle und Diagramm' }), h('div', { class: 'grid2' }, h('div', null, cb.wrap, h('div', { class: 'small', text: 'Der aktuelle Zustand ist gefüllt, die zuletzt benutzte Kante gelb. Moore: Ausgang unter dem Zustand (/x). Mealy: Kante Eingang/Ausgang.' }), h('div', { style: 'margin-top:8px' }, inBtns), h('div', { style: 'margin-top:8px' }, hist)), h('div', null, ctl, info, tbl)));
    rebuild(); return el;
  }

  function memLab() {
    const wrapAll = h('div');
    /* RAM */
    const sr = { ram: 2048, data: 180, bss: 420, heap: 600, frame: 12, depth: 40 };
    const cb = V().cbox({ h: 120, aria: 'RAM-Aufteilung mit Heap und Stack' }), ro = h('div');
    const rsel = sel('RAM-Größe', [{ v: 1024, t: '1024 Byte' }, { v: 2048, t: '2048 Byte' }, { v: 4096, t: '4096 Byte' }], sr.ram, v => { sr.ram = +v; rupd(); });
    const dr = range('.data', 0, 800, 10, sr.data, v => v + ' B', v => { sr.data = v; rupd(); }), br = range('.bss', 0, 1000, 10, sr.bss, v => v + ' B', v => { sr.bss = v; rupd(); }), hr = range('Heap (belegt)', 0, 2000, 20, sr.heap, v => v + ' B', v => { sr.heap = v; rupd(); });
    const fr = sel('Rahmen je Aufruf', [{ v: 8, t: '8 Byte' }, { v: 12, t: '12 Byte' }, { v: 20, t: '20 Byte' }, { v: 32, t: '32 Byte' }], sr.frame, v => { sr.frame = +v; rupd(); }), dp = range('Rekursionstiefe', 0, 150, 1, sr.depth, v => String(v), v => { sr.depth = v; rupd(); });
    function rupd() {
      const free = C().ramFree(sr.ram, sr.data, sr.bss, sr.heap), stack = sr.depth * sr.frame;
      cb.draw = (g, W, H, P) => D().ram(g, W, H, P, { ram: sr.ram, data: sr.data, bss: sr.bss, heap: sr.heap, stack }); cb.render();
      ro.replaceChildren(kv('frei für den Stack', free + ' Byte'), kv('Stack bei dieser Tiefe', stack + ' Byte'), kv('größte Tiefe, die noch passt', String(Math.max(0, C().maxDepth(Math.max(0, free), sr.frame)))));
      if (free < stack) ro.appendChild(note('Der Stack wächst in den Heap: Daten werden zerstört, meist ohne Fehlermeldung.', 'bad'));
    }
    const ramCard = h('div', { class: 'card' }, h('h3', { text: 'Labor: RAM, Heap und Stack' }), h('div', { class: 'grid2' }, h('div', null, cb.wrap, h('div', { class: 'legend' }, h('span', null, h('i', { style: 'background:var(--c1)' }), '.data'), h('span', null, h('i', { style: 'background:var(--c4)' }), '.bss'), h('span', null, h('i', { style: 'background:var(--c2)' }), 'Heap (wächst nach oben)'), h('span', null, h('i', { style: 'background:var(--c3)' }), 'Stack (wächst nach unten)')), ro), h('div', null, rsel.el, dr.el, br.el, hr.el, fr.el, dp.el)));
    /* zerrissener Zugriff */
    const tr = { v: 0x00FF, inc: 1, step: 0, cs: false }, tOut = h('div'), tBytes = h('div', { class: 'bytes' });
    const vSel = sel('Zählerstand', [{ v: 0x00FF, t: '0x00FF' }, { v: 0x01FF, t: '0x01FF' }, { v: 0x0FFF, t: '0x0FFF' }, { v: 0x1234, t: '0x1234' }], tr.v, v => { tr.v = +v; tr.step = 0; tupd(); });
    const iR = range('ISR zählt hoch um', 1, 8, 1, tr.inc, v => String(v), v => { tr.inc = v; tr.step = 0; tupd(); });
    const csT = seg('Lesen', [{ v: false, t: 'ungeschützt' }, { v: true, t: 'mit Interruptsperre' }], false, v => { tr.cs = v; tr.step = 0; tupd(); });
    const stepBtn = h('button', { type: 'button', class: 'btn pri', onclick: () => { tr.step = (tr.step + 1) % 5; tupd(); } }, 'Nächster Schritt');
    function tupd() {
      const r = C().tornRead(tr.v, tr.inc), by = (n, lbl, hot) => h('div', { class: 'by' + (hot ? ' hot' : '') }, h('small', { text: lbl }), hexs(n)), lo = tr.v & 255;
      const lines = ['Start: Der Zähler steht auf ' + hexs(tr.v, 4) + '. Das Hauptprogramm will ihn lesen.', 'Schritt 1: niederwertiges Byte lesen: ' + hexs(lo) + '.', tr.cs ? 'Schritt 2: Interrupts sind gesperrt – die ISR wartet, der Zähler bleibt ' + hexs(tr.v, 4) + '.' : 'Schritt 2: Die ISR schlägt zu und erhöht den Zähler auf ' + hexs(r.after, 4) + '.', 'Schritt 3: höherwertiges Byte lesen: ' + hexs(tr.cs ? tr.v >> 8 : r.after >> 8) + '.', 'Ergebnis'];
      const hi = tr.step >= 3 ? (tr.cs ? tr.v >> 8 : r.after >> 8) : null, got = hi == null ? null : (hi << 8) | lo, bad = got != null && got !== tr.v && got !== r.after;
      tBytes.replaceChildren(by(tr.step >= 2 && !tr.cs ? r.after : tr.v, 'Zähler im RAM', false), tr.step >= 1 ? by(lo, 'gelesen: niederwertig', false) : null, hi != null ? by(hi, 'gelesen: höherwertig', false) : null, got != null ? by(got, 'Ergebnis (16 Bit)', bad) : null);
      tOut.replaceChildren(h('p', { text: lines[Math.min(tr.step, 4)] }));
      if (tr.step >= 3) tOut.appendChild(note(bad ? 'Zerrissener Wert: ' + got + ' ist weder der Stand vorher (' + tr.v + ') noch nachher (' + r.after + '). Fehler: ' + (got - tr.v) + '.' : 'Der Wert ' + got + ' ist ' + (got === tr.v ? 'der Stand vor' : 'der Stand nach') + ' der Erhöhung: in Ordnung.', bad ? 'bad' : 'ok'));
      tOut.appendChild(kv('Anteil schiefer Startwerte bei +' + tr.inc, sg(C().tornBad(tr.inc).frac * 100, 4) + ' %'));
      tOut.appendChild(kv('Kosten der Sperre (6 Takte, 16 MHz)', fmtT(C().critTime(6, 16e6))));
    }
    const tornCard = h('div', { class: 'card' }, h('h3', { text: 'Labor: Zerrissener 16-Bit-Zugriff (Atomarität)' }), h('div', { class: 'grid2' }, h('div', null, tBytes, tOut, h('div', { class: 'acts' }, stepBtn)), h('div', null, vSel.el, iR.el, csT.el)));
    /* volatile */
    const vo = h('div'), vsel = seg('Flag deklariert als', [{ v: false, t: 'int flag' }, { v: true, t: 'volatile int flag' }], false, v => vupd(v));
    function vupd(v) { const r = C().volatileLoop({ volatile: !!v, isrAt: 5, maxTicks: 1000 }); vo.replaceChildren(h('pre', { class: 'code', text: (v ? 'volatile ' : '') + 'int flag = 0;\nISR() { flag = 1; }\nwhile (!flag) { }   // wartet auf die ISR' }), note(r.exited ? 'Die Schleife liest das Flag bei jedem Durchlauf neu und endet im Takt ' + r.at + ' (Modell: ISR bei Takt 5).' : 'Modell eines optimierenden Compilers: Das Flag wird einmal in ein Register geladen. Die ISR ändert nur den Speicher: Die Schleife läuft in diesem Modell endlos (1000 Takte beobachtet).', r.exited ? 'ok' : 'bad')); }
    const volCard = h('div', { class: 'card' }, h('h3', { text: 'Labor: volatile' }), vsel.el, vo); vupd(false);
    /* Prioritaetsinversion */
    const gr = { cL: 6, tH: 2, cH: 2, tM: 3, cM: 5, pip: false }, gcb = V().cbox({ h: 190, aria: 'Zeitdiagramm der drei Aufgaben H, M und L' }), go = h('div');
    const gL = range('L hält die Sperre für', 3, 10, 1, gr.cL, v => v + ' Einheiten', v => { gr.cL = v; gupd(); }), gtH = range('H kommt bei t =', 1, 8, 1, gr.tH, v => String(v), v => { gr.tH = v; gupd(); }), gH = range('H rechnet', 1, 4, 1, gr.cH, v => v + ' Einheiten', v => { gr.cH = v; gupd(); }), gtM = range('M kommt bei t =', 1, 9, 1, gr.tM, v => String(v), v => { gr.tM = v; gupd(); }), gM = range('M rechnet', 1, 9, 1, gr.cM, v => v + ' Einheiten', v => { gr.cM = v; gupd(); });
    const gp = seg('Prioritätsvererbung', [{ v: false, t: 'aus' }, { v: true, t: 'ein' }], false, v => { gr.pip = v; gupd(); });
    function gupd() {
      const tasks = [{ name: 'L', prio: 1, arrive: 0, ops: [{ t: 'lock' }, { t: 'run', n: gr.cL }, { t: 'unlock' }] }, { name: 'M', prio: 2, arrive: gr.tM, ops: [{ t: 'run', n: gr.cM }] }, { name: 'H', prio: 3, arrive: gr.tH, ops: [{ t: 'lock' }, { t: 'run', n: gr.cH }, { t: 'unlock' }] }];
      const a = C().schedSim(tasks, { pip: false }), b = C().schedSim(tasks, { pip: true }), cur = gr.pip ? b : a;
      gcb.draw = (g, W, H, P) => D().gantt(g, W, H, P, { sim: cur, names: ['H', 'M', 'L'], len: Math.max(a.len, b.len), arrive: tasks.map(t => ({ name: t.name, t: t.arrive })), title: gr.pip ? 'mit Prioritätsvererbung' : 'ohne Prioritätsvererbung' }); gcb.render();
      go.replaceChildren(kv('H fertig ohne Vererbung', 't = ' + a.done.H), kv('H fertig mit Vererbung', 't = ' + b.done.H), kv('Verzögerung durch die Inversion', (a.done.H - b.done.H) + ' Einheiten'), kv('H wartet auf die Sperre (gewählt)', cur.blocked.H + ' Einheiten'));
      go.appendChild(a.done.H > b.done.H ? note('Inversion: M verdrängt L, während H auf die Sperre von L wartet. H verliert genau die Rechenzeit von M. Mit Vererbung läuft L bis zum Ende seines Abschnitts.', 'bad') : note('Keine Inversion bei diesen Werten: Entweder ist L schon fertig, wenn M kommt, oder H wartet gar nicht.', 'ok'));
    }
    const ganttCard = h('div', { class: 'card' }, h('h3', { text: 'Labor: Prioritätsinversion' }), h('div', { class: 'grid2' }, h('div', null, gcb.wrap, h('div', { class: 'legend' }, h('span', null, h('i', { style: 'background:var(--danger)' }), 'H (hoch)'), h('span', null, h('i', { style: 'background:var(--c2)' }), 'M (mittel)'), h('span', null, h('i', { style: 'background:var(--c1)' }), 'L (niedrig)'), h('span', null, '▭ gestrichelt: wartet auf die Sperre')), go), h('div', null, gp.el, gL.el, gtH.el, gH.el, gtM.el, gM.el)));
    wrapAll.append(ramCard, tornCard, volCard, ganttCard); rupd(); tupd(); gupd(); return wrapAll;
  }

  /* =====================================================================
   *  Aufgaben
   * ===================================================================== */
  function sceneEl(t) {
    const s = t.scene; if (!s) return null; const Cc = C(); let reveal = null, cbx = null;
    const wrap = h('div', { class: 'card', style: 'padding:8px' });
    if (s.type === 'isr') { cbx = V().cbox({ h: 216, aria: 'Zeitachse mit Ereignissen' }); reveal = on => { const sim = on ? Cc.isrSim({ events: s.events, exec: s.exec, latency: s.latency, tEnd: s.tEnd }) : null; cbx.draw = (g, W, H, P) => D().isr(g, W, H, P, { events: s.events, sim, exec: s.exec, tEnd: s.tEnd, masks: [] }); cbx.render(); }; wrap.append(cbx.wrap, h('div', { class: 'small', text: 'Ereigniszeiten in µs. Die Lösung zeichnet Merkerbit und ISR ein.' })); }
    else if (s.type === 'bounce') { cbx = V().cbox({ h: 196, aria: 'Prellender Taster' }); reveal = on => { cbx.draw = (g, W, H, P) => D().bounce(g, W, H, P, { edges: s.edges, mode: 'fall', lock: on ? 2000 : 0, result: on }); cbx.render(); }; wrap.append(cbx.wrap, h('div', { class: 'small', text: 'Die Lösung zeigt die Annahme der fallenden Flanken mit 2000 µs Sperre.' })); }
    else if (s.type === 'uart') { cbx = V().cbox({ h: 170, minW: W => (Cc.uartFrameBits(s.cfg) + 2) * 30 + 24, aria: 'UART-Rahmen auf dem Logikanalysator' }); const bits = Cc.uartBits(s.byte, s.cfg); bits[s.flip] ^= 1; reveal = on => { cbx.draw = (g, W, H, P) => D().uart(g, W, H, P, { bits, cfg: s.cfg, flips: [s.flip], mark: on }); cbx.render(); }; wrap.append(cbx.wrap); }
    else if (s.type === 'spi') { cbx = V().cbox({ h: 236, minW: () => 54 + 40 * 7 + 10, aria: 'SPI-Signale auf dem Logikanalysator' }); const w = Cc.spiWave({ mosi: s.mosi, miso: s.miso, mode: s.mode }); reveal = on => { cbx.draw = (g, W, H, P) => D().spi(g, W, H, P, { wave: w, sample: on ? Cc.spiDecode(w, Cc.spiGuessMode(w)) : null }); cbx.render(); }; wrap.append(cbx.wrap); }
    else if (s.type === 'i2c') { const items = Cc.i2cEncode(s), w = Cc.i2cWave(items); cbx = V().cbox({ h: 190, minW: () => 46 + w.n * 8 + 10, aria: 'I²C-Signale auf dem Logikanalysator' }); const ev = Cc.i2cDecode(w), labels = []; ev.forEach(e => { if (e.type === 'ADDR') labels[0] = 'Adr ' + hexs(e.addr) + ' ' + e.rw; if (e.type === 'DATA') labels[labels.length || 1] = hexs(e.value); });
      reveal = on => { cbx.draw = (g, W, H, P) => D().i2c(g, W, H, P, { wave: w, items: on ? items : null, annotate: { bytes: labels } }); cbx.render(); }; wrap.append(cbx.wrap, h('div', { class: 'small', text: 'Gestrichelte Linien: steigende SCL-Flanken. ' + (s.addr === 0x48 ? '' : '') })); }
    else if (s.type === 'fsm') { cbx = V().cbox({ h: s.fsm.states.length > 5 ? 360 : 300, aria: 'Zustandsdiagramm' }); reveal = () => { cbx.draw = (g, W, H, P) => D().fsm(g, W, H, P, { fsm: s.fsm, cur: null }); cbx.render(); }; wrap.append(cbx.wrap, h('div', { class: 'small', text: 'Diagramm zur Tabelle. Eingangsfolge: ' + s.input.split('').join(' ') })); }
    else if (s.type === 'debounce') { cbx = V().cbox({ h: 120, minW: () => 66 + s.raw.length * 22, aria: 'Abtastwerte des Tasters' }); reveal = on => { cbx.draw = (g, W, H, P) => D().debounce(g, W, H, P, { raw: s.raw, out: on ? Cc.debounceRun(s.raw, s.n, 0) : null }); cbx.render(); }; cbx.h2 = true; wrap.append(cbx.wrap); }
    else if (s.type === 'cross') { cbx = V().cbox({ h: 150, aria: 'Phasenfolge der Kreuzung' }); reveal = () => { cbx.draw = (g, W, H, P) => D().cross(g, W, H, P, { phases: s.phases }); cbx.render(); }; wrap.append(cbx.wrap); }
    else if (s.type === 'ram') { cbx = V().cbox({ h: 120, aria: 'RAM-Aufteilung' }); reveal = on => { cbx.draw = (g, W, H, P) => D().ram(g, W, H, P, { ram: s.ram, data: s.data, bss: s.bss, heap: s.heap, stack: on ? 0 : 0 }); cbx.render(); }; wrap.append(cbx.wrap); }
    else if (s.type === 'heap') { cbx = V().cbox({ h: 96, aria: 'Heap-Belegung' }); reveal = on => { const r = Cc.heapSim(s.size, on ? s.ops : s.ops.slice(0, 4)); cbx.draw = (g, W, H, P) => D().heap(g, W, H, P, { size: s.size, allocs: r.allocs, free: r.free }); cbx.render(); }; wrap.append(cbx.wrap, h('div', { class: 'small', text: 'Gezeigt: nach den vier Anforderungen. Die Lösung zeigt den Zustand nach den Freigaben.' })); }
    else if (s.type === 'torn') { const r = Cc.tornRead(s.v, s.inc); const row = h('div', { class: 'bytes' }); reveal = on => { row.replaceChildren(h('div', { class: 'by' }, h('small', { text: 'Zähler vorher' }), hexs(s.v, 4)), h('div', { class: 'by' }, h('small', { text: 'nach der ISR' }), hexs(r.after, 4)), on ? h('div', { class: 'by hot' }, h('small', { text: 'gelesen' }), hexs(r.read, 4)) : null); }; wrap.append(row); }
    else if (s.type === 'volatile') { wrap.append(h('pre', { class: 'code', text: 'int flag = 0;          // ohne volatile\nvoid ISR() { flag = 1; }\nint main() {\n  while (!flag) { }     // wartet auf die ISR\n  tuWas();\n}\n\nuint16_t zaehler;       // 16 Bit auf einem 8-Bit-Controller\nvoid ISR2() { zaehler++; }' })); reveal = () => { }; }
    else if (s.type === 'gantt') { cbx = V().cbox({ h: 150, aria: 'Aufgaben und Ankunftszeiten' }); const tasks = s.tasks; let len = 16; reveal = on => { if (!on) { cbx.draw = (g, W, H, P) => D().gantt(g, W, H, P, { sim: null, names: ['H', 'M', 'L'], len, arrive: tasks.map(t => ({ name: t.name, t: t.arrive })), title: 'Ankunftszeiten (Pfeile)' }); cbx.h2 = false; cbx.render(); } else { const a = Cc.schedSim(tasks, { pip: false }), b = Cc.schedSim(tasks, { pip: true }); cbx.draw = (g, W, H, P) => D().gantt(g, W, H, P, { sim: a, names: ['H', 'M', 'L'], len: Math.max(a.len, b.len), arrive: tasks.map(t => ({ name: t.name, t: t.arrive })), title: 'ohne Prioritätsvererbung' }); cbx.render(); } }; wrap.append(cbx.wrap, h('div', { class: 'small', text: 'Pfeile: Ankunft. Die Lösung zeigt den Ablauf ohne Vererbung; das Labor oben zeigt beide Fälle.' })); }
    if (reveal) reveal(false);
    return { el: wrap, reveal };
  }

  function taskCard(t) {
    const done = LS.get(KEY.done, {}), d = h('details', { class: 'task', id: 'task-' + t.id }), mark = h('span', { class: 'dn', 'aria-hidden': 'true', text: done[t.id] ? '✓' : '' });
    d.append(h('summary', null, mark, h('span', { class: 't', text: t.id.replace(/^emb/, '').toUpperCase() + ' · ' + t.title }), h('span', { class: 'lv', text: ['', 'leicht', 'mittel', 'schwer'][t.level] })));
    let built = false;
    d.addEventListener('toggle', () => { if (d.open && !built) { built = true; d.appendChild(body()); V().redrawAll(); } });
    function body() {
      const tb = h('div', { class: 'tb' }), inputs = {}, fb = h('div', { class: 'fb', role: 'status' }), tips = h('div'), sol = h('div'); let nTip = LS.get(KEY.tipps, {})[t.id] || 0, sc = null;
      tb.append(h('p', { text: t.text, style: 'white-space:pre-line' }));
      if (t.table) tb.append(h('div', { class: 'tbl' }, h('table', null, h('caption', { text: t.table.cap || '' }), h('thead', null, h('tr', null, t.table.head.map(x => h('th', { text: x })))), h('tbody', null, t.table.rows.map(r => h('tr', null, r.map(c => h('td', { text: String(c) }))))))));
      sc = sceneEl(t); if (sc) tb.append(sc.el);
      const fl = h('div', { class: 'fld' });
      t.fields.forEach(f => {
        const id = t.id + '-' + f.key; let inp;
        if (f.kind === 'choice') { inp = h('select', { id }, h('option', { value: '', text: '– wählen –' }), f.choices.map(c => h('option', { value: c.v, text: c.t }))); }
        else inp = h('input', { id, type: 'text', inputmode: f.kind === 'num' ? 'decimal' : 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: f.ph || (f.kind === 'hex' ? 'z. B. 0x4A' : f.kind === 'num' ? 'Zahl' : '') });
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); chk(); } }); inputs[f.key] = inp;
        fl.append(h('div', { class: 'f' }, h('label', { for: id, text: f.label }), h('div', { class: 'row' }, inp, f.unit ? h('span', { class: 'un', text: f.unit }) : null)));
      });
      const bChk = h('button', { type: 'button', class: 'btn pri', onclick: chk }, 'Prüfen'), bTip = h('button', { type: 'button', class: 'btn', onclick: tip }), bSol = h('button', { type: 'button', class: 'btn', 'aria-expanded': 'false', onclick: showSol }, 'Musterlösung');
      const tipLbl = () => { bTip.textContent = nTip >= 3 ? 'Alle Tipps gezeigt' : 'Tipp ' + (nTip + 1) + ' von 3'; bTip.disabled = nTip >= 3; };
      function paintTips() { tips.replaceChildren(...t.hint.slice(0, nTip).map((x, i) => h('div', { class: 'tip', text: 'Tipp ' + (i + 1) + ': ' + x }))); tipLbl(); }
      function tip() { if (nTip < 3) nTip++; const o = LS.get(KEY.tipps, {}); o[t.id] = nTip; LS.set(KEY.tipps, o); paintTips(); }
      function chk() {
        const ans = {}; t.fields.forEach(f => { ans[f.key] = inputs[f.key].value; });
        if (t.fields.every(f => !String(ans[f.key]).trim())) { fb.className = 'fb bad'; fb.textContent = 'Bitte erst etwas eintragen.'; return; }
        const r = TK().check(t, ans); r.rows.forEach(x => { inputs[x.key].className = x.ok ? 'ok' : 'no'; });
        if (r.all) { fb.className = 'fb ok'; fb.textContent = '✓ Alles richtig.'; const dn = LS.get(KEY.done, {}); dn[t.id] = true; LS.set(KEY.done, dn); mark.textContent = '✓'; progress(); }
        else { fb.className = 'fb bad'; fb.textContent = r.rows.filter(x => x.ok).length + ' von ' + r.rows.length + ' Feldern stimmen. Rot markierte noch einmal prüfen, Tipp holen oder Rechenweg ansehen.'; }
      }
      function showSol() {
        const open = bSol.getAttribute('aria-expanded') === 'true';
        if (open) { sol.replaceChildren(); bSol.setAttribute('aria-expanded', 'false'); bSol.textContent = 'Musterlösung'; if (sc) sc.reveal(false); return; }
        bSol.setAttribute('aria-expanded', 'true'); bSol.textContent = 'Musterlösung ausblenden';
        sol.replaceChildren(h('div', { class: 'sol' }, h('div', { class: 'res', text: 'Ergebnis: ' + t.fields.map(f => f.label + ' = ' + TK().show(t, f.key)).join('; ') }), h('div', { class: 'small', text: 'Rechenweg' }), h('ol', null, t.steps.map(x => h('li', { text: x })))));
        if (sc) sc.reveal(true);
      }
      paintTips(); tb.append(fl, h('div', { class: 'acts' }, bChk, bTip, bSol), fb, tips, sol); return tb;
    }
    return d;
  }

  /* =====================================================================
   *  Seite
   * ===================================================================== */
  const LABS = { timer: [timerLab, isrLab, bounceLab], adc: [adcLab], bus: [busLab], fsm: [fsmLab], mem: [memLab] };
  function progress() {
    const done = LS.get(KEY.done, {}), n = Object.keys(done).filter(k => TK().byId(k)).length, tot = TK().tasks.length, el = document.getElementById('prog'); if (el) { el.textContent = n + '/' + tot; el.setAttribute('aria-label', n + ' von ' + tot + ' Aufgaben erledigt'); el.title = n + ' von ' + tot + ' Aufgaben erledigt'; }
  }
  function showBlock(id) {
    const b = DATA().blocks.find(x => x.id === id) || DATA().blocks[0]; V().clear(); LS.set(KEY.tab, b.id);
    document.querySelectorAll('#tabs button').forEach(x => { const on = x.dataset.id === b.id; x.setAttribute('aria-selected', String(on)); if (on && x.scrollIntoView) { try { x.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) { } } });
    const view = document.getElementById('view'), tasks = TK().byBlock(b.id), done = LS.get(KEY.done, {});
    view.replaceChildren(h('h2', { id: 'blockTitle', text: b.title }), h('p', { class: 'lead', text: b.lead }),
      h('div', null, b.explain.map((e, i) => h('details', { class: 'exp', open: i === 0 }, h('summary', { text: e.h }), h('div', { class: 'pb' }, e.p.map(p => h('p', { text: p })))))),
      h('div', { style: 'margin-top:12px' }, (LABS[b.id] || []).map(f => f())),
      h('h2', { text: 'Aufgaben (' + tasks.length + ')' }), h('p', { class: 'lead', text: 'Rechne selbst, trage das Ergebnis ein und prüfe. Dezimalkomma oder Punkt sind beide recht, die Einheit steht neben dem Feld. Tipps kommen in drei Stufen; die Musterlösung zeigt den Rechenweg.' }),
      h('div', null, tasks.map(taskCard)), h('div', { class: 'foot' }, 'Embedded vertieft · ' + META().ver + ' · Stufe: Studium. Die Zeitachsen und Wellenformen sind Modelle (siehe jeweilige Beschriftung), keine Messungen an echter Hardware.'));
    void done; window.scrollTo(0, 0);
    requestAnimationFrame(() => V().redrawAll());
    try { history.replaceState(null, '', '#' + b.id); } catch (e) { }
  }
  function applyTheme(t) { const r = document.documentElement; if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme'); }
  function init() {
    const tabs = document.getElementById('tabs'); let theme = LS.get(KEY.theme, null); applyTheme(theme);
    DATA().blocks.forEach(b => tabs.appendChild(h('button', { type: 'button', role: 'tab', 'data-id': b.id, 'aria-selected': 'false', onclick: () => showBlock(b.id) }, b.icon + ' ' + b.short)));
    const tb = document.getElementById('bTheme'); const lbl = () => { tb.setAttribute('aria-label', 'Darstellung: ' + (theme === 'light' ? 'hell' : theme === 'dark' ? 'dunkel' : 'automatisch') + ' (antippen zum Wechseln)'); tb.textContent = theme === 'light' ? '☀' : theme === 'dark' ? '☾' : '◐'; };
    tb.addEventListener('click', () => { theme = theme === null ? 'light' : theme === 'light' ? 'dark' : null; LS.set(KEY.theme, theme); applyTheme(theme); lbl(); V().redrawAll(); }); lbl();
    const hs = (location.hash || '').slice(1), start = DATA().blocks.find(b => b.id === hs) ? hs : LS.get(KEY.tab, 'timer');
    ['done', 'tipps'].forEach(k => { try { const m = TK().migrateIds(LS.get(KEY[k], {})); if (m.changed) LS.set(KEY[k], m.data); } catch (e) { } });   /* alte Ids f1..m10 -> embf1..embm10 */
    let ta = null; try { ta = TK().byId(TK().legacyId(new URLSearchParams(location.search).get('aufgabe'))) || null; } catch (e) { }
    showBlock(ta ? ta.block : start); progress();
    if (ta) { const el = document.getElementById('task-' + ta.id); if (el) { el.open = true; try { el.scrollIntoView({ block: 'start' }); } catch (e) { } } }
    let rt = null; window.addEventListener('resize', () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => V().redrawAll()); });
    try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => V().redrawAll()); } catch (e) { }
    window.addEventListener('hashchange', () => { const x = (location.hash || '').slice(1); if (DATA().blocks.find(b => b.id === x)) showBlock(x); });
    const rb = document.getElementById('bReset'); let rtmo = null; rb.addEventListener('click', () => { if (rb.dataset.arm === '1') { LS.set(KEY.done, {}); LS.set(KEY.tipps, {}); rb.dataset.arm = ''; rb.textContent = 'Fortschritt zurücksetzen'; progress(); showBlock(LS.get(KEY.tab, 'timer')); toast('Fortschritt gelöscht.'); } else { rb.dataset.arm = '1'; rb.textContent = 'Wirklich löschen? Noch einmal tippen'; clearTimeout(rtmo); rtmo = setTimeout(() => { rb.dataset.arm = ''; rb.textContent = 'Fortschritt zurücksetzen'; }, 4000); } });
  }
  root.EMB_UI = { init, showBlock };
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }
})(typeof window !== 'undefined' ? window : globalThis);
