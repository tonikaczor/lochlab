'use strict';
/* Tonfunk Lab: Effekte (Explosion, Funken, Rauch) und Soundeffekte für zerstörte Bauteile.
   Alle Koordinaten sind Bildschirmpixel (CSS-Pixel) der Zeichenfläche. Töne werden synthetisch erzeugt (kein Download nötig). */
(function (root) {
  let AC = null, master = null, noiseBuf = null, muted = false, btn = null, last = 0;
  try { muted = localStorage.getItem('lm4.mute') === '1'; } catch (e) {}
  const P = [], rings = [], texts = [], smokers = [];
  let flash = 0, flashCol = '255,255,255', shakeA = 0, shakeEl = null, shakeT = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- Ton ---------- */
  function unlock() {
    try {
      if (!AC) {
        const C = root.AudioContext || root.webkitAudioContext; if (!C) return;
        AC = new C(); master = AC.createGain(); master.gain.value = 0.6; master.connect(AC.destination);
        noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (AC.state === 'suspended') AC.resume();
    } catch (e) {}
  }
  let tOsc = null, tGain = null, tF = 0;
  function tone(f) {
    if (muted) return; unlock(); if (!AC) return;
    if (tOsc) { if (Math.abs(tF - f) > 0.5) { tOsc.frequency.setValueAtTime(f, AC.currentTime); tF = f; } return; }
    tOsc = AC.createOscillator(); tOsc.type = 'square'; tOsc.frequency.value = f; tF = f; tGain = AC.createGain(); tGain.gain.value = 0.05; tOsc.connect(tGain); tGain.connect(master); tOsc.start();
  }
  function toneOff() { if (tOsc) { try { tOsc.stop(); } catch (e) {} tOsc = null; } }
  const MINGAP = { spark: 180, honk: 350, buzz: 300, alarm: 900, boing: 350, ding: 150, tada: 1500, sad: 1500, clunk: 120, whistle: 600, crash: 300, splash: 300, slide: 500, kazoo: 600, squeak: 250 };
  const lastPlay = {}, recent = [];
  function snd(kind, vol) {
    if (muted) return false; unlock(); if (!AC || !noiseBuf) return false;
    if (MINGAP[kind]) {                         // neue Töne: Mindestabstand und höchstens 5 Töne je 0,4 s (nie nervig)
      const nw = Date.now();
      if (lastPlay[kind] && nw - lastPlay[kind] < MINGAP[kind]) return false;
      while (recent.length && nw - recent[0] > 400) recent.shift();
      if (recent.length >= 5) return false;
      lastPlay[kind] = nw; recent.push(nw);
    }
    const t = AC.currentTime + 0.01;
    const out = AC.createGain(); out.gain.value = vol == null ? 1 : vol; out.connect(master);
    const env = (g, t0, a, d, pk) => { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk), t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); };
    const nz = (dur, type, f0, f1, pk, dl, Q) => {
      dl = dl || 0; const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = AC.createBiquadFilter(); f.type = type; if (Q) f.Q.value = Q; f.frequency.setValueAtTime(f0, t + dl); f.frequency.exponentialRampToValueAtTime(f1, t + dl + dur);
      const g = AC.createGain(); env(g, t + dl, 0.004, dur, pk);
      s.connect(f); f.connect(g); g.connect(out); s.start(t + dl, Math.random()); s.stop(t + dl + dur + 0.05);
    };
    /* Ton mit Gleiten, optional Vibrato (vib, vibHz) und Tiefpass (lp) */
    const tone = (type, f0, f1, dur, pk, dl, o) => {
      dl = dl || 0; o = o || {}; const os = AC.createOscillator(); os.type = type;
      os.frequency.setValueAtTime(f0, t + dl); os.frequency.exponentialRampToValueAtTime(f1, t + dl + dur);
      const g = AC.createGain(); env(g, t + dl, o.a || 0.004, dur, pk);
      let last = os;
      if (o.lp) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; os.connect(f); last = f; }
      last.connect(g); g.connect(out);
      if (o.vib) { const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = o.vibHz || 20; lg.gain.value = o.vib; l.connect(lg); lg.connect(os.frequency); l.start(t + dl); l.stop(t + dl + dur + 0.05); }
      os.start(t + dl); os.stop(t + dl + dur + 0.05);
    };
    switch (kind) {
      case 'boom': nz(1.2, 'lowpass', 3000, 80, 1); tone('sine', 150, 28, 0.8, 1); nz(0.3, 'highpass', 3500, 900, 0.5, 0.01); for (let i = 0; i < 10; i++) nz(0.03, 'highpass', 3500, 3500, 0.25, 0.15 + Math.random() * 0.9); break;
      case 'pop': nz(0.16, 'bandpass', 2800, 500, 0.9); tone('sine', 1000, 140, 0.14, 0.6); tone('triangle', 300, 60, 0.3, 0.3, 0.02); break;
      case 'zap': tone('sawtooth', 1500, 45, 0.4, 0.45); nz(0.35, 'highpass', 2500, 500, 0.55); tone('square', 90, 40, 0.5, 0.2, 0.1); break;
      case 'fizz': nz(1.6, 'bandpass', 4500, 1400, 0.3); for (let i = 0; i < 14; i++) nz(0.025, 'highpass', 3000, 3000, 0.3, Math.random() * 1.4); tone('sine', 220, 50, 0.4, 0.25); break;
      case 'tick': nz(0.02, 'highpass', 4000, 4000, 0.25); break;
      case 'click': nz(0.03, 'bandpass', 2500, 2500, 1); tone('square', 180, 60, 0.07, 0.4); tone('square', 900, 300, 0.04, 0.3, 0.09); break;
      /* ---- neue Töne (kurz und moderat laut) ---- */
      case 'crash': /* Scheppern: dumpfer Schlag und Metallteile */
        nz(0.55, 'lowpass', 2800, 160, 0.7); tone('sine', 130, 34, 0.35, 0.7);
        for (let i = 0; i < 7; i++) { const dl = 0.03 + i * 0.065 + rnd(0, 0.05), f = rnd(480, 1900); tone('square', f, f * 0.85, 0.1, 0.08, dl, { lp: 3500 }); nz(0.07, 'highpass', 4200, 3000, 0.18, dl); }
        break;
      case 'splash': /* Plumps und Blubbern */
        nz(0.45, 'bandpass', 450, 2200, 0.5, 0, 0.8); nz(0.3, 'highpass', 3000, 6500, 0.18, 0.03); tone('sine', 220, 70, 0.25, 0.45);
        for (let i = 0; i < 7; i++) { const f = rnd(280, 720); tone('sine', f, f * 2.2, 0.07, 0.2, 0.08 + i * 0.06 + rnd(0, 0.04)); }
        break;
      case 'boing': { /* Gummi-Boing */
        const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.07); o.frequency.exponentialRampToValueAtTime(190, t + 0.6);
        const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = 17; lg.gain.setValueAtTime(70, t); lg.gain.exponentialRampToValueAtTime(2, t + 0.65); l.connect(lg); lg.connect(o.frequency);
        const g = AC.createGain(); env(g, t, 0.01, 0.62, 0.6); o.connect(g); g.connect(out);
        o.start(t); o.stop(t + 0.7); l.start(t); l.stop(t + 0.7);
        break; }
      case 'honk': /* Hupe, zwei Töne */
        [[0, 0.3], [0.38, 0.2]].forEach(a => { tone('square', 349, 349, a[1], 0.2, a[0], { lp: 1500, a: 0.01 }); tone('square', 440, 440, a[1], 0.18, a[0], { lp: 1500, a: 0.01 }); });
        break;
      case 'buzz': { /* Störungs-Brummer */
        const g = AC.createGain(); env(g, t, 0.01, 0.5, 0.35); g.connect(out);
        const lg = AC.createGain(); lg.gain.value = 0.3; const lfo = AC.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 26; lfo.connect(lg); lg.connect(g.gain);
        const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(g);
        [100, 103.5, 151].forEach(f => { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + 0.58); });
        lfo.start(t); lfo.stop(t + 0.58); nz(0.04, 'bandpass', 2500, 2500, 0.35);
        break; }
      case 'alarm': { /* kurze Sirene */
        const o = AC.createOscillator(); o.type = 'square'; const g = AC.createGain(), lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
        o.frequency.setValueAtTime(620, t);
        for (let i = 0; i < 4; i++) o.frequency.linearRampToValueAtTime(i % 2 ? 620 : 880, t + 0.2 + i * 0.2);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.02); g.gain.setValueAtTime(0.14, t + 0.78); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + 0.95);
        break; }
      case 'ding': /* Glöckchen */
        [[1, 0.28, 1.0], [2.76, 0.1, 0.5], [5.4, 0.05, 0.28]].forEach(p => tone('sine', 1760 * p[0], 1760 * p[0], p[2], p[1], 0, { a: 0.003 }));
        break;
      case 'tada': /* kleine Fanfare */
        tone('triangle', 523.25, 523.25, 0.13, 0.22, 0, { lp: 3500 }); tone('triangle', 659.25, 659.25, 0.13, 0.22, 0.14, { lp: 3500 });
        [523.25, 659.25, 783.99, 1046.5].forEach(f => { tone('triangle', f, f, 0.85, 0.17, 0.3, { lp: 3500, a: 0.01 }); tone('square', f, f, 0.6, 0.035, 0.3, { lp: 2500, a: 0.01 }); });
        nz(0.25, 'highpass', 5000, 8000, 0.07, 0.3);
        break;
      case 'sad': /* Posaune: wah wah wah waaah */
        [[233.08, 0, 0.28], [220, 0.32, 0.28], [207.65, 0.64, 0.28], [185, 0.96, 0.8]].forEach((n, i) => {
          const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(n[0], t + n[1]);
          if (i === 3) { o.frequency.setValueAtTime(n[0], t + n[1] + 0.25); o.frequency.linearRampToValueAtTime(n[0] * 0.9, t + n[1] + n[2]); }
          const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 5; f.frequency.setValueAtTime(260, t + n[1]); f.frequency.linearRampToValueAtTime(1100, t + n[1] + n[2] * 0.4); f.frequency.linearRampToValueAtTime(380, t + n[1] + n[2]);
          const g = AC.createGain(); env(g, t + n[1], 0.03, n[2] - 0.03, 0.22);
          if (i === 3) { const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = 6; lg.gain.value = 5; l.connect(lg); lg.connect(o.frequency); l.start(t + n[1]); l.stop(t + n[1] + n[2] + 0.05); }
          o.connect(f); f.connect(g); g.connect(out); o.start(t + n[1]); o.stop(t + n[1] + n[2] + 0.05);
        });
        break;
      case 'clunk': /* Schalter oder Ventil */
        tone('sine', 165, 55, 0.14, 0.8); nz(0.05, 'lowpass', 1600, 300, 0.7); tone('square', 95, 50, 0.06, 0.16, 0.01);
        break;
      case 'spark': /* Funkenzischen */
        nz(0.5, 'highpass', 5200, 3600, 0.1);
        for (let i = 0; i < 14; i++) nz(0.02, 'highpass', rnd(3000, 5000), 3000, rnd(0.12, 0.3), rnd(0, 0.5));
        tone('sawtooth', 2100, 300, 0.18, 0.1);
        break;
      case 'whistle': /* Trillerpfeife */
        tone('sine', 1850, 2500, 0.42, 0.2, 0, { vib: 140, vibHz: 29, a: 0.02 }); tone('sine', 3700, 5000, 0.4, 0.035, 0, { vib: 200, vibHz: 29 });
        break;
      case 'slide': /* Rutschpfeife: erst hoch, dann tief hinunter */
        tone('sine', 500, 1900, 0.18, 0.2, 0, { a: 0.02 }); tone('sine', 1900, 180, 0.7, 0.2, 0.18, { a: 0.02, vib: 25, vibHz: 9 });
        break;
      case 'kazoo': /* Kazoo: nasale Tonfolge */
        [[392, 0, 0.14], [494, 0.16, 0.14], [587, 0.32, 0.14], [494, 0.48, 0.14], [587, 0.64, 0.3]].forEach(n => {
          const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = n[0];
          const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = 7; lg.gain.value = 6; l.connect(lg); lg.connect(o.frequency);
          const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 2.2;
          const g = AC.createGain(); env(g, t + n[1], 0.015, n[2], 0.5); o.connect(f); f.connect(g); g.connect(out);
          o.start(t + n[1]); o.stop(t + n[1] + n[2] + 0.05); l.start(t + n[1]); l.stop(t + n[1] + n[2] + 0.05);
        });
        break;
      case 'squeak': /* Quietscheentchen: zwei kurze Piepser */
        tone('triangle', 1100, 2300, 0.07, 0.25, 0, { a: 0.006 }); tone('triangle', 1500, 3000, 0.09, 0.22, 0.1, { a: 0.006 });
        break;
      default: return false;
    }
    return true;
  }

  /* ---------- Spaß: Varianten, Sprüche, Sprechblase ---------- */
  /* Je Ereignisart mehrere Varianten [Ton(e), Spruch ≤ 30 Zeichen]. 'a>b' = erst a, dann b. Bei Zerstörung ist der Ton ein Nachklapp nach dem Knall. */
  const VAR = {
    'burn-led': [['squeak', 'Die LED hat Feierabend.'], ['slide', 'LED: Mir war zu hell!'], ['sad', 'Licht aus, Vorhang zu.'], ['boing', 'LED: Ich sehe Sterne!'], ['kazoo', 'Ein letztes Aufleuchten.']],
    'burn-res': [['spark', 'Rauchzeichen!'], ['sad', 'Heiß gelaufen.'], ['squeak', 'Zu heiß zum Anfassen.'], ['honk', 'Widerstand zwecklos!'], ['slide', 'Der Widerstand streikt.']],
    'burn-ic': [['slide', 'Magischer Rauch entwichen.'], ['sad', 'Der Rauch ist raus.'], ['boing', 'Chip hat Burnout.'], ['kazoo', 'Sein letzter Takt.'], ['whistle', 'Rauchen verboten!']],
    'burn-cap': [['squeak', 'Platz! ... Konfetti!'], ['honk', 'Elko-Party!'], ['boing', 'Der Elko hat gepoppt.'], ['kazoo', 'Falsch herum? Peng!'], ['whistle', 'Hoppla, falsch gepolt!']],
    'burn-motor': [['slide', 'Mir wird schwindelig.'], ['boing', 'Motor: Ich dreh durch!'], ['sad', 'Aus der Puste.'], ['honk', 'Brrr... Feierabend!']],
    'burn-lamp': [['squeak', 'Es werde dunkel.'], ['slide', 'Lampe: Mir geht ein Licht auf!'], ['sad', 'Lampe hat ausgeleuchtet.']],
    'burn-spk': [['honk', 'Genug Bass für heute!'], ['slide', 'Lautsprecher: Aua, Ohren!'], ['sad', 'Das war zu laut.']],
    'burn-fuse': [['squeak', 'Sicherung hat sich geopfert.'], ['whistle', 'Tapfer durchgebrannt!'], ['sad', 'Dafür bin ich da.']],
    'burn-water': [['splash', 'Platsch! Rohr geplatzt.'], ['slide', 'Wasser marsch!'], ['honk', 'Da ist was undicht.']],
    'burn': [['squeak', 'Bauteil sagt: Tschüss!'], ['slide', 'Das war es dann wohl.'], ['sad', 'Rauchzeichen von drüben.'], ['boing', 'Ups. Kaputt.']],
    'shock': [['zap>squeak', 'Das kribbelt!'], ['zap>slide', 'Autsch, Haare zu Berge!'], ['zap>boing', 'Strom? Nein danke!'], ['zap>kazoo', 'Zzzap! Wach auf!']],
    'trip': [['clunk', 'Klack! Sicherung rettet.'], ['clunk>honk', 'FI sagt: Stopp!'], ['clunk>whistle', 'Sicher ist sicher!'], ['clunk>ding', 'Licht aus, Sicherheit an.'], ['click>boing', 'Ausgelöst, Glück gehabt!']],
    'ok': [['tada', 'Geschafft!'], ['tada', 'Stark gemacht!'], ['kazoo', 'Läuft wie geschmiert!'], ['tada', 'Volltreffer!'], ['tada', 'Das sitzt!']],
    'fail': [['sad', 'Fast! Noch mal.'], ['boing', 'Hoppla!'], ['buzz', 'Aus Fehlern lernt man.'], ['squeak', 'Nicht ganz.'], ['slide', 'Knapp daneben.']],
    'click': [['click', 'Klick!'], ['tick', 'Tick!'], ['squeak', 'Quiek!']],
    'hint': [['whistle', 'Psst, ein Tipp!'], ['click', 'Kleiner Wink.'], ['ding', 'Ein Tipp für dich.'], ['squeak', 'Hier, bitte sehr.']],
    'done': [['tada', 'Aufgabe erledigt!'], ['tada', 'Bravo!'], ['kazoo>ding', 'Ein Fest!'], ['ding>tada', 'Wieder eine geschafft!']]
  };
  const lastV = {};
  let fun = true, touched = false;
  try { fun = localStorage.getItem('fx.fun') !== '0'; } catch (e) {}
  function playSeq(s, vol, delay) {
    String(s).split('>').forEach((n, i) => { const d = (delay || 0) + i * 380; if (d > 0) setTimeout(() => snd(n, vol), d); else snd(n, vol); });
  }
  /* wählt zufällig eine Variante (nie dieselbe zweimal hintereinander), spielt den Ton (außer silent) und liefert {id, sound, text} */
  function variant(kind, o) {
    o = o || {}; const L = VAR[kind]; if (!L) return null;
    let i = Math.floor(Math.random() * L.length);
    if (L.length > 1 && i === lastV[kind]) i = (i + 1 + Math.floor(Math.random() * (L.length - 1))) % L.length;
    lastV[kind] = i; const v = L[i];
    if (!o.silent) playSeq(v[0], o.vol, o.delay);
    return { id: kind + '#' + i, sound: v[0], text: fun ? v[1] : '' };
  }
  /* Bauteilart aus Bauteilcode (part) bzw. Meldungstext (why) */
  function catOf(part, why) {
    const w = why || '';
    if (part === 'LED') return 'led';
    if (/^(R|POT|P|TP|NTC|PTC|LDR|VDR)$/.test(part)) return 'res';
    if (/^(C|CE|CF)$/.test(part) || /Elko|Kondensator/.test(w)) return 'cap';
    if (part === 'MOTOR' || /Motor/.test(w)) return 'motor';
    if (part === 'LAMP' || /Lampe|Glühlampe/.test(w)) return 'lamp';
    if (part === 'SPK' || /Lautsprecher/.test(w)) return 'spk';
    if (part === 'FUSE' || /^Sicherung/.test(w)) return 'fuse';
    if (/^(D|ZD|SCHOTTKY|NPN|PNP|NMOS|PMOS|DIAC|TRIAC|THY|PHT|OPTO|ICX|UNO|PI|IC|U|Q|OPA|AND|NAND|OR|NOR|XOR|NOT|SNOT|DFF|SEG8D)$/.test(part)) return 'ic';
    if (/LED/.test(w)) return 'led'; if (/Widerstand/.test(w)) return 'res';
    if (/IC|Transistor|Pin|MOSFET|Gate|Diode/.test(w)) return 'ic';
    if (part === 'water' || /Wasser|Rohr|Pumpe|Tank/.test(w)) return 'water';
    return '';
  }
  /* kleine Sprechblase am unteren Rand (Zusatzeffekt, nur bei „Sprüche und Zusatzeffekte“ an) */
  let sayEl = null, sayT = 0;
  function say(text) {
    if (!fun || !text || !touched || typeof document === 'undefined' || !document.body) return;
    try {
      if (!sayEl) {
        sayEl = document.createElement('div');
        sayEl.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:60;max-width:86vw;padding:7px 16px;border-radius:18px;background:rgba(32,40,50,.94);color:#fff;font:700 15px system-ui,sans-serif;border:1px solid #4a5868;pointer-events:none;transition:opacity .35s;opacity:0;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.35)';
        sayEl.setAttribute('aria-live', 'polite'); document.body.appendChild(sayEl);
      }
      sayEl.textContent = text; sayEl.style.opacity = '1'; clearTimeout(sayT); sayT = setTimeout(() => { if (sayEl) sayEl.style.opacity = '0'; }, 1900);
    } catch (e) {}
  }
  /* Bildschirmfüllendes Konfetti (Zusatzeffekt; höchstens alle 1,5 s) */
  let lastConf = 0;
  function confetti(big) {
    try {
      if (typeof document === 'undefined' || !document.body) return;
      const nw = Date.now(); if (nw - lastConf < 1500) return; lastConf = nw;
      const c = document.createElement('canvas'); c.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:200;pointer-events:none';
      c.width = window.innerWidth; c.height = window.innerHeight; document.body.appendChild(c);
      const x = c.getContext('2d'), N = big ? 160 : 70, cols = ['#ff4d4d', '#ffb300', '#3ddc84', '#3b9eff', '#c77dff', '#ffffff'], p = [], t0 = performance.now();
      for (let i = 0; i < N; i++) p.push({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.5, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - .5) * .3, w: 6 + Math.random() * 7, h: 10 + Math.random() * 8, c: cols[i % cols.length] });
      const kill = () => { if (c.parentNode) c.remove(); };
      setTimeout(kill, 4200);
      (function frame(now) {
        const el = now - t0; if (el > 3200 || !c.parentNode) { kill(); return; }
        x.clearRect(0, 0, c.width, c.height);
        p.forEach(q => { q.x += q.vx; q.y += q.vy; q.vy += 0.05; q.r += q.vr; x.save(); x.translate(q.x, q.y); x.rotate(q.r); x.fillStyle = q.c; x.globalAlpha = Math.max(0, 1 - el / 3400); x.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); x.restore(); });
        requestAnimationFrame(frame);
      })(performance.now());
    } catch (e) {}
  }
  /* Ergebnis einer Aufgabe/Prüfung (pct 0..100): 100 % Fanfare und Konfetti, Teilfortschritt „Ding“, sonst dezent „sad“. Nur nach einer Benutzeraktion. */
  let lastPass = 0, lastDrawAt = 0;
  /* Ansichten ohne Effekt-Zeichenfläche (z. B. HausLab 3D): Spruch ersatzweise als Sprechblase unten */
  function sayIfNoCanvas(text) { if (text) setTimeout(() => { if (Date.now() - lastDrawAt > 600) say(text); }, 250); }
  function pass(pct) {
    if (!touched || root.SPS_FX) return;                // SPS-Lab hat eigene Töne und Effekte
    const nw = Date.now(); if (nw - lastPass < 900) return; lastPass = nw;
    if (pct >= 100) { const v = variant('ok'); if (fun) { confetti(false); say(v.text); } }
    else if (pct >= 50) snd('ding');
    else { const v = variant('fail', { vol: 0.5 }); say(v && v.text); }
  }
  /* Abzeichen und Tagesaufgabe: Fanfare bzw. Ding, aber nicht doppelt zu pass() */
  function chime(big) { if (Date.now() - lastPass < 1500) return; snd(big ? 'tada' : 'ding'); }
  const add = p => { if (P.length < 420) P.push(p); };

  /* ---------- Teilchen ---------- */
  function explode(x, y, o) {
    o = o || {};
    const cat = catOf(o.part, o.why || o.text);
    const k = o.kind || (cat === 'led' ? 'led' : /^(res|fuse|lamp)$/.test(cat) ? 'res' : cat === 'ic' ? 'chip' : 'big'), S = o.scale || 22, col = o.color || '255,170,60', big = k === 'chip' || k === 'big';
    const f = S / 22, nS = big ? 70 : k === 'res' ? 36 : 46;
    for (let i = 0; i < nS; i++) {
      const a = rnd(0, 6.283), v = rnd(120, big ? 760 : 560) * f;
      P.push({ t: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60 * f, g: 520 * f, life: 0, max: rnd(0.45, 1.3), s: rnd(1.5, 3.8), col: i % 3 === 0 ? '255,255,230' : col });
    }
    for (let i = 0; i < (big ? 12 : 7); i++) {
      const a = rnd(0, 6.283), v = rnd(80, 380) * f;
      P.push({ t: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 220 * f, g: 900 * f, life: 0, max: rnd(0.9, 1.7), s: rnd(3, 7) * f / 1.1, rot: rnd(0, 6), vr: rnd(-12, 12), col: k === 'led' ? col : '40,40,44' });
    }
    for (let i = 0; i < (big ? 22 : 14); i++) {
      P.push({ t: 'smoke', x: x + rnd(-8, 8) * f, y: y + rnd(-6, 6) * f, vx: rnd(-30, 30) * f, vy: rnd(-90, -30) * f, g: -8, life: -rnd(0, 0.5), max: rnd(2.2, 4.2), s: rnd(8, 16) * f, col: '70,70,76' });
    }
    rings.push({ x, y, r: 0, R: (big ? 9 : 6) * S, life: 0, max: big ? 0.7 : 0.5, col });
    if (big) rings.push({ x, y, r: 0, R: 5 * S, life: -0.08, max: 0.55, col: '255,255,255' });
    flash = Math.max(flash, big ? 0.7 : 0.4); flashCol = col;
    shakeA = Math.max(shakeA, (big ? 16 : 9) * Math.min(1.4, f)); shakeT = 0;
    texts.push({ x, y: y - 10 * f, s: o.text || (k === 'led' ? 'PFFT!' : k === 'res' ? 'ZISCH!' : 'KNALL!'), life: 0, max: 1.5, col, size: (big ? 34 : 26) });
    smokers.push({ at: o.at || (() => [x, y]), left: big ? 7 : 5, acc: 0, f });
    snd(o.sound || (k === 'led' ? 'pop' : k === 'res' ? 'fizz' : k === 'chip' ? 'zap' : 'boom'));
    if (big || k === 'chip') snd('boom');
    /* Spaß: lustiger Nachklapp (Ton) nach dem Knall, zweite Sprechblase und Zusatzeffekt je Bauteilart */
    const v = variant('burn' + (cat ? '-' + cat : ''), { silent: true });
    if (v) {
      setTimeout(() => playSeq(v.sound, 0.8), 600);
      if (v.text) { texts.push({ x, y: y + 24 * f, s: v.text, life: -0.35, max: 2.3, col: '255,255,255', size: 19 }); sayIfNoCanvas(v.text); }
    }
    if (fun) extras(cat, x, y, f);
  }
  /* Zusatzeffekte je Bauteilart (wenige Teilchen, iPad-tauglich) */
  function extras(cat, x, y, f) {
    const cols = ['255,77,77', '255,179,0', '61,220,132', '59,158,255', '199,125,255', '255,255,255'];
    if (cat === 'led' || cat === 'motor') for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; add({ t: 'star', x: x + Math.cos(a) * 20 * f, y: y - 22 * f + Math.sin(a) * 8 * f, vx: Math.cos(a) * 70 * f, vy: Math.sin(a) * 30 * f - 50 * f, g: 60, life: 0, max: rnd(0.9, 1.4), s: rnd(5, 8) * f, rot: rnd(0, 3), vr: rnd(-4, 4), col: '255,236,120' }); }
    if (cat === 'res' || cat === 'ic' || cat === 'fuse' || cat === '') { rings.push({ x, y: y - 6 * f, r: 0, R: 2.2 * 22 * f, life: -0.1, max: 1.1, col: '170,170,178', thin: 1 }); rings.push({ x, y: y - 40 * f, r: 0, R: 1.8 * 22 * f, life: -0.35, max: 1.1, col: '170,170,178', thin: 1 }); }
    if (cat === 'cap') for (let i = 0; i < 34; i++) { const a = rnd(-2.9, -0.25), v = rnd(180, 520) * f; add({ t: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 420 * f, life: 0, max: rnd(1.6, 2.6), s: rnd(2.5, 4.5) * f, rot: rnd(0, 6), vr: rnd(-14, 14), col: cols[i % cols.length] }); }
    if (cat === 'water') for (let i = 0; i < 26; i++) { const a = rnd(-2.6, -0.5), v = rnd(120, 420) * f; add({ t: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 800 * f, life: 0, max: rnd(0.7, 1.3), s: rnd(2, 4.5) * f, col: '90,170,255' }); }
    if (cat === 'lamp') for (let i = 0; i < 12; i++) { const a = rnd(0, 6.283), v = rnd(60, 260) * f; add({ t: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80 * f, g: 700 * f, life: 0, max: rnd(0.8, 1.4), s: rnd(2, 4) * f, rot: rnd(0, 6), vr: rnd(-12, 12), col: '230,240,255' }); }
    if (cat === 'spk') for (let i = 0; i < 3; i++) rings.push({ x, y, r: 0, R: (2 + i) * 22 * f, life: -i * 0.12, max: 0.7, col: '200,200,255', thin: 1 });
  }
  function trip(x, y, text, scale, o) {
    const f = (scale || 22) / 22, vk = o && o.kind, v = vk ? variant(vk, { silent: true }) : null;
    for (let i = 0; i < 14; i++) { const a = rnd(0, 6.283), v = rnd(80, 260) * f; P.push({ t: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 200, life: 0, max: rnd(0.2, 0.5), s: rnd(1.2, 2.4), col: '255,240,170' }); }
    rings.push({ x, y, r: 0, R: 3 * (scale || 22), life: 0, max: 0.35, col: '255,200,80' });
    texts.push({ x, y: y - 10 * f, s: text || 'KLACK!', life: 0, max: 1.1, col: '255,200,80', size: 24 });
    shakeA = Math.max(shakeA, 5); flash = Math.max(flash, 0.2); flashCol = '255,200,80';
    if (v) { playSeq(v.sound); if (v.text) { texts.push({ x, y: y + 24 * f, s: v.text, life: -0.2, max: 2.2, col: '255,255,255', size: 19 }); sayIfNoCanvas(v.text); } } else snd('click');
    if (v && fun && vk === 'shock') for (let i = 0; i < 4; i++) add({ t: 'star', x: x + rnd(-20, 20) * f, y: y - 18 * f, vx: rnd(-60, 60) * f, vy: rnd(-90, -30) * f, g: 80, life: 0, max: rnd(0.8, 1.2), s: rnd(5, 8) * f, rot: rnd(0, 3), vr: rnd(-5, 5), col: '255,236,120' });
  }
  /* Bauteil unter Last: gelegentlich Funken und leises Knistern */
  function stress(x, y, ratio, S) {
    if (ratio < 0.85 || muted && false) return;
    if (Math.random() < Math.min(0.6, (ratio - 0.8) * 2.5)) {
      const a = rnd(0, 6.283), v = rnd(40, 160) * (S || 22) / 22;
      P.push({ t: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, g: 300, life: 0, max: rnd(0.2, 0.5), s: rnd(1, 2.2), col: '255,240,170' });
    }
    if (ratio > 1.0 && Math.random() < 0.04) snd('tick');
  }

  /* ---------- Zeichnen ---------- */
  function draw(cx) {
    lastDrawAt = Date.now();
    const now = performance.now(), dt = Math.min(0.05, Math.max(0.001, (now - (last || now - 16)) / 1000)); last = now;
    if (!active()) { if (shakeEl && shakeEl.style.transform) shakeEl.style.transform = ''; return; }
    // Rauchfahnen über zerstörten Teilen
    for (let i = smokers.length - 1; i >= 0; i--) {
      const s = smokers[i]; s.left -= dt; s.acc += dt;
      while (s.acc > 0.12) { s.acc -= 0.12; const [x, y] = s.at(); P.push({ t: 'smoke', x: x + rnd(-4, 4), y, vx: rnd(-12, 12) * s.f, vy: rnd(-70, -35) * s.f, g: -6, life: 0, max: rnd(1.8, 3), s: rnd(6, 11) * s.f, col: '80,80,86' }); }
      if (s.left <= 0) smokers.splice(i, 1);
    }
    cx.save();
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.life += dt;
      if (p.life < 0) continue;
      if (p.life >= p.max) { P.splice(i, 1); continue; }
      const u = p.life / p.max;
      if (p.t === 'star') { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = `rgba(${p.col},${1 - u * u})`; cx.beginPath(); for (let j = 0; j < 8; j++) { const rr = j % 2 ? p.s * 0.4 : p.s, aa = j * 0.7854; cx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } cx.closePath(); cx.fill(); cx.restore(); continue; }
      if (p.t === 'drop') { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; cx.fillStyle = `rgba(${p.col},${0.9 * (1 - u)})`; cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, 7); cx.fill(); continue; }
      if (p.t === 'smoke') { p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; const r = p.s * (1 + 2.6 * u); cx.fillStyle = `rgba(${p.col},${0.34 * (1 - u) * Math.min(1, u * 8)})`; cx.beginPath(); cx.arc(p.x, p.y, r, 0, 7); cx.fill(); continue; }
      p.vy += p.g * dt; p.vx *= (1 - 1.2 * dt); p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t === 'spark') {
        cx.globalCompositeOperation = 'lighter';
        const L = Math.hypot(p.vx, p.vy) * 0.03;
        cx.strokeStyle = `rgba(${p.col},${1 - u})`; cx.lineWidth = p.s; cx.lineCap = 'round';
        cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); cx.stroke();
        cx.globalCompositeOperation = 'source-over';
      } else {
        p.rot += p.vr * dt; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = `rgba(${p.col},${1 - u * u})`; cx.fillRect(-p.s, -p.s * 0.6, p.s * 2, p.s * 1.2); cx.restore();
      }
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.life += dt; if (r.life < 0) continue; if (r.life >= r.max) { rings.splice(i, 1); continue; }
      const u = r.life / r.max, e = 1 - (1 - u) * (1 - u);
      if (r.thin) { r.y -= 28 * dt; cx.strokeStyle = `rgba(${r.col},${0.7 * (1 - u)})`; cx.lineWidth = 1.5 + 4 * (1 - u); cx.beginPath(); cx.ellipse(r.x, r.y, r.R * e, r.R * e * 0.45, 0, 0, 7); cx.stroke(); continue; }
      cx.globalCompositeOperation = 'lighter'; cx.strokeStyle = `rgba(${r.col},${0.9 * (1 - u)})`; cx.lineWidth = 2 + 10 * (1 - u);
      cx.beginPath(); cx.arc(r.x, r.y, r.R * e, 0, 7); cx.stroke();
      const g = cx.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.R * e * 0.8); g.addColorStop(0, `rgba(255,240,200,${0.55 * (1 - u)})`); g.addColorStop(1, 'rgba(255,160,60,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(r.x, r.y, r.R * e * 0.8, 0, 7); cx.fill(); cx.globalCompositeOperation = 'source-over';
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i]; t.life += dt; if (t.life >= t.max) { texts.splice(i, 1); continue; } if (t.life < 0) continue;
      const u = t.life / t.max, sc = u < 0.15 ? 0.4 + 4 * u : 1 + 0.2 * u, a = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
      cx.font = `900 ${t.size}px system-ui,sans-serif`;
      const cw = cx.canvas.clientWidth || cx.canvas.width, hw = cx.measureText(t.s).width * sc / 2 + 10, tx = Math.min(Math.max(t.x, hw), Math.max(hw, cw - hw));
      cx.save(); cx.translate(tx, t.y - 60 * u); cx.rotate(-0.12); cx.scale(sc, sc);
      cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.lineJoin = 'round';
      cx.lineWidth = 7; cx.strokeStyle = `rgba(0,0,0,${0.8 * a})`; cx.strokeText(t.s, 0, 0); cx.fillStyle = `rgba(${t.col},${a})`; cx.fillText(t.s, 0, 0); cx.restore();
    }
    if (flash > 0.01) { const c = cx.canvas, w = c.clientWidth || c.width, h = c.clientHeight || c.height; cx.fillStyle = `rgba(${flashCol},${flash * 0.55})`; cx.fillRect(0, 0, w, h); flash *= Math.pow(0.0005, dt); }
    cx.restore();
    if (shakeEl) {
      if (shakeA > 0.4) { shakeT += dt; shakeEl.style.transform = `translate(${rnd(-1, 1) * shakeA}px,${rnd(-1, 1) * shakeA}px)`; shakeA *= Math.pow(0.002, dt); }
      else if (shakeEl.style.transform) { shakeEl.style.transform = ''; shakeA = 0; }
    }
  }
  const active = () => P.length > 0 || rings.length > 0 || texts.length > 0 || smokers.length > 0 || flash > 0.01 || shakeA > 0.4;
  function clear() { P.length = rings.length = texts.length = smokers.length = 0; flash = 0; shakeA = 0; if (shakeEl) shakeEl.style.transform = ''; }

  /* ---------- Ton-Schalter ---------- */
  function setMuted(m) { muted = m; try { localStorage.setItem('lm4.mute', m ? '1' : '0'); } catch (e) {} if (btn) btn.textContent = m ? '🔇' : '🔊'; if (!m) unlock(); }
  function showBtn(on) {
    if (!btn) {
      btn = document.createElement('button'); btn.type = 'button'; btn.setAttribute('aria-label', 'Ton an oder aus'); btn.title = 'Ton an/aus';
      btn.style.cssText = 'position:fixed;right:12px;top:64px;z-index:30;width:40px;height:40px;border-radius:20px;border:1px solid #38424d;background:#2c343eee;color:#fff;font-size:20px;line-height:1;display:none;cursor:pointer;padding:0';
      btn.textContent = muted ? '🔇' : '🔊'; btn.onclick = () => { setMuted(!muted); if (!muted) snd('pop'); };
      document.body.appendChild(btn);
    }
    btn.style.display = on ? 'block' : 'none';
  }
  /* Sprüche und Zusatzeffekte (localStorage 'fx.fun', Standard an); die Töne steuert nur die Stummschaltung */
  function setFun(b) { fun = !!b; try { localStorage.setItem('fx.fun', fun ? '1' : '0'); } catch (e) {} }
  const touch = () => { touched = true; unlock(); };
  if (typeof document !== 'undefined') { document.addEventListener('pointerdown', touch, true); document.addEventListener('keydown', touch, true); }
  root.LochFX = { tone, toneOff, trip, explode, stress, draw, active, clear, sound: snd, unlock, showBtn, setMuted, isMuted: () => muted, setShakeEl: el => { shakeEl = el; },
    variant, say, confetti, chime, pass, catOf, setFun, isFun: () => fun, kinds: () => Object.keys(VAR), variants: k => (VAR[k] || []).map(v => v.slice()) };
})(typeof window !== 'undefined' ? window : globalThis);
