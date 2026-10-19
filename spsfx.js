'use strict';
/* Tonfunk SPS-Lab: lustige Effekte und Töne (Zerstörung, Anlagenfehler, Erfolgsmomente).
   - Töne: reine WebAudio-Synthese, keine Audiodateien. Respektiert LochFX.isMuted() und entsperrt sich beim ersten Klick/Tastendruck wie fx.js.
   - Bilder: Overlay-Canvas über der Anlage (Funken, Rauch, Wasser, Konfetti, Sternchen, Comic-Sprechblasen), Objektpool mit fester Obergrenze.
   - Alle Positionen sind Weltkoordinaten der Anlage (plant.worldSize()). Das Overlay rechnet sie wie plant.draw (zentriert, gleicher Maßstab) auf den Canvas um.
   - Schalter: SPS_FX.setEnabled(bool) (localStorage 'sps.fx', Standard an). Humor ist albern, nie verletzend: nur Beulen, Sternchen, Rauch. */
(function (root) {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const nowMs = () => (root.performance ? performance.now() : Date.now());
  const reduce = (() => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } })();
  let enabled = true;
  try { enabled = localStorage.getItem('sps.fx') !== '0'; } catch (e) {}
  let localMute = false;
  const isMuted = () => { try { if (root.LochFX && root.LochFX.isMuted) return !!root.LochFX.isMuted(); } catch (e) {} return localMute; };

  /* ============================================================ Ton */
  let AC = null, master = null, noiseBuf = null;
  const lastPlay = {}, recent = [];
  function unlock() {
    try {
      if (!AC) {
        const C = root.AudioContext || root.webkitAudioContext; if (!C) return;
        AC = new C(); master = AC.createGain(); master.gain.value = 0.5;
        const comp = AC.createDynamicsCompressor(); master.connect(comp); comp.connect(AC.destination);
        noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (AC.state === 'suspended') AC.resume();
    } catch (e) {}
  }
  const MINGAP = { spark: 180, tire: 500, honk: 350, buzz: 300, alarm: 900, boing: 350, ding: 150, tada: 1500, sad: 1500, clunk: 120, whistle: 600, crash: 300, splash: 300 };
  function sound(kind, vol) {
    if (!enabled || isMuted()) return false;
    unlock(); if (!AC || !noiseBuf || AC.state !== 'running') return false;
    const nw = nowMs();
    if (lastPlay[kind] && nw - lastPlay[kind] < (MINGAP[kind] || 100)) return false;
    while (recent.length && nw - recent[0] > 400) recent.shift();
    if (recent.length >= 5) return false;
    lastPlay[kind] = nw; recent.push(nw);
    const t = AC.currentTime + 0.01;
    const out = AC.createGain(); out.gain.value = vol == null ? 1 : vol; out.connect(master);
    const env = (g, t0, a, d, pk) => { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk), t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); };
    const done = (n, end) => { n.start(end[0]); n.stop(end[1]); };
    /* Rauschen mit Filter-Sweep */
    const nz = (dur, type, f0, f1, pk, dl, Q) => {
      dl = dl || 0; const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = AC.createBiquadFilter(); f.type = type; f.Q.value = Q || 1; f.frequency.setValueAtTime(f0, t + dl); f.frequency.exponentialRampToValueAtTime(f1, t + dl + dur);
      const g = AC.createGain(); env(g, t + dl, 0.004, dur, pk);
      s.connect(f); f.connect(g); g.connect(out); s.start(t + dl, Math.random()); s.stop(t + dl + dur + 0.05);
    };
    /* Ton mit Gleiten, optional Vibrato und Tiefpass */
    const tn = (type, f0, f1, dur, pk, dl, o) => {
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
      case 'crash': { /* Krach: dumpfer Schlag, Rauschen und scheppernde Metallteile */
        nz(0.55, 'lowpass', 2800, 160, 0.9); tn('sine', 130, 34, 0.35, 0.9);
        for (let i = 0; i < 7; i++) { const dl = 0.03 + i * 0.065 + rnd(0, 0.05), f = rnd(480, 1900); tn('square', f, f * 0.85, 0.1, 0.1, dl, { lp: 3500 }); nz(0.07, 'highpass', 4200, 3000, 0.22, dl); }
        break; }
      case 'splash': { /* Plumps und Blubbern */
        nz(0.45, 'bandpass', 450, 2200, 0.55, 0, 0.8); nz(0.3, 'highpass', 3000, 6500, 0.2, 0.03); tn('sine', 220, 70, 0.25, 0.5);
        for (let i = 0; i < 7; i++) { const f = rnd(280, 720); tn('sine', f, f * 2.2, 0.07, 0.22, 0.08 + i * 0.06 + rnd(0, 0.04)); }
        break; }
      case 'tire': { /* Reifenquietschen */
        nz(0.8, 'bandpass', 1700, 2600, 2.4, 0, 9); nz(0.8, 'bandpass', 2600, 1500, 1.2, 0.0, 14);
        tn('sawtooth', 1100, 1900, 0.5, 0.12, 0, { vib: 60, vibHz: 31, lp: 2800 });
        break; }
      case 'honk': { /* Hupe: zwei Töne, zwei Hupen */
        [[0, 0.3], [0.38, 0.2]].forEach(a => { tn('square', 349, 349, a[1], 0.22, a[0], { lp: 1500, a: 0.01 }); tn('square', 440, 440, a[1], 0.2, a[0], { lp: 1500, a: 0.01 }); });
        break; }
      case 'buzz': { /* Störungs-Brummer */
        const g = AC.createGain(); env(g, t, 0.01, 0.5, 0.4); g.connect(out);
        const lg = AC.createGain(); lg.gain.value = 0.3; const lfo = AC.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 26; lfo.connect(lg); lg.connect(g.gain);
        const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(g);
        [100, 103.5, 151].forEach(f => { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + 0.58); });
        lfo.start(t); lfo.stop(t + 0.58); nz(0.04, 'bandpass', 2500, 2500, 0.4);
        break; }
      case 'alarm': { /* kurze Sirene */
        const o = AC.createOscillator(); o.type = 'square'; const g = AC.createGain(), lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
        o.frequency.setValueAtTime(620, t);
        for (let i = 0; i < 4; i++) o.frequency.linearRampToValueAtTime(i % 2 ? 620 : 880, t + 0.2 + i * 0.2);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.setValueAtTime(0.18, t + 0.78); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + 0.95);
        break; }
      case 'boing': { /* Gummi-Boing */
        const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.07); o.frequency.exponentialRampToValueAtTime(190, t + 0.6);
        const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = 17; lg.gain.setValueAtTime(70, t); lg.gain.exponentialRampToValueAtTime(2, t + 0.65); l.connect(lg); lg.connect(o.frequency);
        const g = AC.createGain(); env(g, t, 0.01, 0.62, 1.0); o.connect(g); g.connect(out);
        o.start(t); o.stop(t + 0.7); l.start(t); l.stop(t + 0.7);
        break; }
      case 'ding': { /* Glöckchen */
        [[1, 0.55, 1.0], [2.76, 0.2, 0.5], [5.4, 0.1, 0.28]].forEach(p => tn('sine', 1760 * p[0], 1760 * p[0], p[2], p[1], 0, { a: 0.003 }));
        break; }
      case 'tada': { /* kleine Fanfare */
        tn('triangle', 523.25, 523.25, 0.13, 0.25, 0, { lp: 3500 }); tn('triangle', 659.25, 659.25, 0.13, 0.25, 0.14, { lp: 3500 });
        [523.25, 659.25, 783.99, 1046.5].forEach(f => { tn('triangle', f, f, 0.85, 0.2, 0.3, { lp: 3500, a: 0.01 }); tn('square', f, f, 0.6, 0.04, 0.3, { lp: 2500, a: 0.01 }); });
        nz(0.25, 'highpass', 5000, 8000, 0.08, 0.3);
        break; }
      case 'sad': { /* Posaune: wah wah wah waaah */
        const notes = [[233.08, 0, 0.28], [220, 0.32, 0.28], [207.65, 0.64, 0.28], [185, 0.96, 0.8]];
        notes.forEach((n, i) => {
          const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(n[0], t + n[1]);
          if (i === 3) { o.frequency.setValueAtTime(n[0], t + n[1] + 0.25); o.frequency.linearRampToValueAtTime(n[0] * 0.9, t + n[1] + n[2]); }
          const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 5; f.frequency.setValueAtTime(260, t + n[1]); f.frequency.linearRampToValueAtTime(1100, t + n[1] + n[2] * 0.4); f.frequency.linearRampToValueAtTime(380, t + n[1] + n[2]);
          const g = AC.createGain(); env(g, t + n[1], 0.03, n[2] - 0.03, 0.26);
          if (i === 3) { const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = 6; lg.gain.value = 5; l.connect(lg); lg.connect(o.frequency); l.start(t + n[1]); l.stop(t + n[1] + n[2] + 0.05); }
          o.connect(f); f.connect(g); g.connect(out); o.start(t + n[1]); o.stop(t + n[1] + n[2] + 0.05);
        });
        break; }
      case 'clunk': { /* Zylinder oder Ventil */
        tn('sine', 165, 55, 0.14, 0.9); nz(0.05, 'lowpass', 1600, 300, 0.8); tn('square', 95, 50, 0.06, 0.18, 0.01);
        break; }
      case 'spark': { /* Funkenzischen */
        nz(0.5, 'highpass', 5200, 3600, 0.1);
        for (let i = 0; i < 14; i++) nz(0.02, 'highpass', rnd(3000, 5000), 3000, rnd(0.12, 0.3), rnd(0, 0.5));
        tn('sawtooth', 2100, 300, 0.18, 0.1);
        break; }
      case 'whistle': { /* Trillerpfeife */
        tn('sine', 1850, 2500, 0.42, 0.5, 0, { vib: 140, vibHz: 29, a: 0.02 }); tn('sine', 3700, 5000, 0.4, 0.1, 0, { vib: 200, vibHz: 29 });
        break; }
      default: return false;
    }
    return true;
  }

  /* ============================================================ Teilchen (Objektpool) */
  const NP = 380, NB = 4;
  const P = []; for (let i = 0; i < NP; i++) P.push({ on: false, k: '', x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 0, max: 1, s: 1, rot: 0, vr: 0, col: '#fff', cx: 0, cy: 0, ang: 0, rad: 0, w: 0, lay: 0 });
  let pNext = 0, nOn = 0;
  function alloc() {
    for (let n = 0; n < 24; n++) { const p = P[pNext]; pNext = (pNext + 1) % NP; if (!p.on) { p.on = true; p.life = 0; p.lay = 0; nOn++; return p; } }
    const p = P[pNext]; pNext = (pNext + 1) % NP; if (!p.on) nOn++; p.on = true; p.life = 0; p.lay = 0; return p;
  }
  const B = []; /* Sprechblasen */
  const rings = [];
  let shakeA = 0, shakeEl = null, flash = 0, flashCol = '255,255,255', lastBubble = 0, lastText = '', lastTextT = 0;
  let overlay = null, gx = null, drawnLast = false, lastT = 0, screenCv = null, gs = null, screenLast = false;
  const world = { w: 1000, h: 560 };
  let qual = 1;

  const SPARKC = ['#ffe9a0', '#ffb340', '#fff7d6', '#ff8c2a'];
  const CONFC = ['#ff5c5c', '#ffb340', '#ffe14a', '#4cd964', '#3b9eff', '#c070ff', '#ff7ac8'];
  const n = c => Math.max(1, Math.round(c * qual));
  function sparks(x, y, c, v) { for (let i = 0; i < n(c); i++) { const a = rnd(0, 6.283), sp = rnd(0.35, 1) * (v || 330), p = alloc(); p.k = 'spark'; p.x = x; p.y = y; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 90; p.g = 520; p.max = rnd(0.35, 0.95); p.s = rnd(1.5, 3.2); p.col = pick(SPARKC); } }
  function smoke(x, y, c, up) { for (let i = 0; i < n(c); i++) { const p = alloc(); p.k = 'smoke'; p.x = x + rnd(-8, 8); p.y = y + rnd(-5, 5); p.vx = rnd(-14, 14); p.vy = -rnd(25, 70) * (up || 1); p.g = -4; p.life = -rnd(0, 0.35); p.max = rnd(1.4, 2.6); p.s = rnd(7, 13); p.col = '#6e757d'; } }
  function drops(x, y, c, col, v) { for (let i = 0; i < n(c); i++) { const a = -rnd(0.3, Math.PI - 0.3), sp = rnd(0.4, 1) * (v || 340), p = alloc(); p.k = 'drop'; p.x = x + rnd(-14, 14); p.y = y; p.vx = Math.cos(a) * sp * 0.7; p.vy = Math.sin(a) * sp; p.g = 760; p.max = rnd(0.7, 1.3); p.s = rnd(2.5, 5.5); p.col = col || '#6fb8ff'; } }
  function confetti(x, y, c, wide) { for (let i = 0; i < n(c); i++) { const a = -rnd(0.2, Math.PI - 0.2), sp = rnd(0.4, 1) * (wide ? 520 : 400), p = alloc(); p.k = 'conf'; p.x = x + (wide ? rnd(-wide, wide) : 0); p.y = y; p.vx = Math.cos(a) * sp * (wide ? 0.5 : 1); p.vy = Math.sin(a) * sp; p.g = 360; p.max = rnd(1.8, 3.2); p.s = rnd(4, 7); p.rot = rnd(0, 6.28); p.vr = rnd(-9, 9); p.col = pick(CONFC); p.w = rnd(0, 6.28); } }
  /* Konfettiregen über den ganzen Bildschirm (eigener Canvas, auch sichtbar, wenn die Anlage gerade nicht zu sehen ist) */
  function rain(c) { const vw = root.innerWidth || 800; for (let i = 0; i < n(c); i++) { const p = alloc(); p.k = 'conf'; p.lay = 1; p.x = rnd(0, vw); p.y = rnd(-60, -6); p.vx = rnd(-50, 50); p.vy = rnd(80, 240); p.g = 90; p.max = rnd(2.6, 4.2); p.s = rnd(5, 8); p.rot = rnd(0, 6.28); p.vr = rnd(-9, 9); p.col = pick(CONFC); p.w = rnd(0, 6.28); } }
  function stars(x, y, c, r) { for (let i = 0; i < Math.max(2, n(c)); i++) { const p = alloc(); p.k = 'star'; p.cx = x; p.cy = y; p.ang = rnd(0, 6.283) + i * 6.283 / c; p.rad = r || 34; p.vr = rnd(4, 6) * (Math.random() < 0.5 ? -1 : 1); p.max = rnd(1.4, 2.0); p.s = rnd(6, 9); p.col = i % 2 ? '#ffe14a' : '#ffffff'; } }
  function ring(x, y, R, col, max) { if (rings.length > 8) rings.shift(); rings.push({ x: x, y: y, R: R, life: 0, max: max || 0.5, col: col || '255,200,80' }); }

  /* ============================================================ Texte */
  const TX = {
    crash: { foerderband: ['Autsch!', 'Bitte nicht den Ausschieber füttern', 'Das war nicht abgesprochen!'], ampel: ['Beule!', 'Rums! Nur eine Beule', 'Karosserie sagt: Aua'], _: ['Autsch!', 'Klirr!'] },
    overflow: { tank: ['Plumps!', 'Der Tank hat zu viel getrunken', 'Überlauf! Wo ist der Wischmopp?'], _: ['Plumps!'] },
    dry: { _: ['Pumpe: Ich hab Durst!', 'Trocken wie ein Keks!'] },
    obstacle: { auto: ['Rolltor hat Rücken', 'Boing! Das Auto bleibt Sieger'], katze: ['Die Katze lebt noch, sie hat Verhandlungsgeschick', 'Miau! Tor verliert die Diskussion'], person: ['Das war knapp!', 'Hoppla! Lichtschranke, wo warst du?'], _: ['Boing!', 'Das war knapp!'] },
    interlock: { garagentor: ['Auf UND Ab? Das Tor ist verwirrt', 'Motor: Ich kann nicht beides!'], ampel: ['Fußgänger: Ich hatte Grün!', 'Alle Lampen: Grün! Ich auch!'], foerderband: ['Vor und zurück: Der Motor tanzt Twist', 'Motor: Links, rechts, ich bin raus'], _: ['Verriegelung vergessen!'] },
    overrun: { _: ['Endschalter? Nie gehört!', 'Tor: Ich muss noch ein Stück!'] },
    redrun: { _: ['Rot ist auch eine Farbe!', 'Hupkonzert! Das war knapp!'] },
    pedhit: { _: ['Fußgänger: Ich hatte Grün!', 'Sternchen! Alle sind okay'] },
    pedwait: { _: ['Fußgänger: Hallo? Ich warte!'] },
    sorted: { _: ['Ding!', 'Sauber sortiert!', 'Treffer!'] },
    delivered: { _: ['Angekommen!', 'Brav, Teil!'] },
    lost: { _: ['Plumps! Ein Teil macht Urlaub', 'Weg ist es!'] },
    wrong: { _: ['Falsch einsortiert!', 'Hoppla!'] },
    estop: { _: ['Not-Halt gedrückt – Respekt!', 'Alles steht. Gut gemacht!'] },
    batch: { _: ['Charge fertig!', 'Prost, Behälter 2!'] },
    badbatch: { _: ['Nicht durchmischt!', 'Schüttelcocktail ohne Schütteln'] },
    pass: { _: ['Aufgabe geschafft!', 'Läuft wie geschmiert!', 'Die SPS ist stolz auf dich!'] }
  };
  function textFor(fx, o, text) {
    if (text) return text;
    const t = TX[fx]; if (!t) return '';
    const a = (o && o.what && t[o.what]) || (o && o.plant && t[o.plant]) || t._;
    if (!a) return '';
    let s = pick(a); if (a.length > 1 && s === lastText) s = pick(a);
    return s;
  }

  /* ============================================================ Auslöser */
  const FX = {
    crash(x, y, o) { sound('crash'); sparks(x, y, 26, 420); smoke(x, y - 6, 6); stars(x, y - 18, 5, 36); ring(x, y, 60); shake(6); flash = Math.max(flash, 0.25); flashCol = '255,220,150'; },
    overflow(x, y, o) { sound('splash'); sound('alarm', 0.5); drops(x, y, 34, '#7cc4ff', 400); ring(x, y, 50, '124,196,255'); shake(3); },
    dry(x, y, o) { sound('buzz'); sound('spark', 0.7); sparks(x, y, 14, 240); smoke(x, y - 10, 8, 1.2); shake(2); },
    obstacle(x, y, o) { sound('boing'); stars(x, y - 10, 5, 38); sparks(x, y, 8, 200); ring(x, y, 50); shake(5); },
    interlock(x, y, o) { sound('buzz'); sound('alarm', 0.55); sound('spark', 0.6); sparks(x, y, 22, 360); smoke(x, y, 5); ring(x, y, 40, '255,120,80'); shake(4); },
    overrun(x, y, o) { sound('clunk'); sound('buzz', 0.6); sparks(x, y, 10, 220); smoke(x, y, 6); shake(3); },
    redrun(x, y, o) { sound('tire'); sound('honk'); smoke(x - 20, y + 10, 6, 0.6); ring(x, y, 36, '255,255,255', 0.35); },
    pedhit(x, y, o) { sound('honk'); sound('boing', 0.7); stars(x, y - 10, 5, 30); ring(x, y, 40); smoke(x, y, 4); shake(3); },
    pedwait(x, y, o) { sound('whistle', 0.7); },
    sorted(x, y, o) { sound('ding'); stars(x, y, 4, 26); confetti(x, y, o && o.quiet ? 0 : 8); sparks(x, y, 6, 160); },
    delivered(x, y, o) { sound('ding', 0.5); stars(x, y - 8, 3, 24); },
    lost(x, y, o) { sound('clunk'); drops(x, y, 6, '#b8c2cc', 160); smoke(x, y, 3); },
    wrong(x, y, o) { sound('buzz', 0.45); },
    estop(x, y, o) { sound('clunk'); sound('whistle', 0.5); ring(x, y, 54, '255,90,90', 0.5); },
    batch(x, y, o) { sound('ding'); confetti(x, y, 22); stars(x, y, 4, 30); },
    badbatch(x, y, o) { sound('sad', 0.45); smoke(x, y, 4); },
    milestone(x, y, o) { sound('tada'); confetti(world.w * 0.5, world.h * 0.35, 50, world.w * 0.35); confetti(world.w * 0.2, world.h * 0.5, 16); confetti(world.w * 0.8, world.h * 0.5, 16); },
    pass(x, y, o) { sound('tada'); sound('ding', 0.6); if (screenCv) rain(90); else { confetti(world.w * 0.5, world.h * 0.3, 70, world.w * 0.4); confetti(world.w * 0.15, world.h * 0.55, 20); confetti(world.w * 0.85, world.h * 0.55, 20); } },
    fail(x, y, o) { sound('sad', 0.55); smoke(world.w * 0.5, world.h * 0.55, 3); }
  };
  const NOBUBBLE = { fail: 1, wrong: 1, pedwait: 1, lost: 1, delivered: 1, milestone: 0 };
  const PRIO = { crash: 2, overflow: 2, obstacle: 2, interlock: 2, pedhit: 2, estop: 2, pass: 3, milestone: 3, batch: 1, dry: 1, overrun: 1, redrun: 1, sorted: 0, badbatch: 1 };

  function shake(a) { if (reduce || !shakeEl) return; shakeA = Math.max(shakeA, a * (qual < 1 ? 0.6 : 1)); }
  /* fx: Name, x,y: Weltkoordinaten (fehlen sie: Mitte), text: eigener Text für die Sprechblase, o: {plant, what, quiet, q (0.2..1 Menge), fast (Zeitraffer: keine Blasen)} */
  function trigger(fx, x, y, text, o) {
    if (!enabled) return false;
    const f = FX[fx]; if (!f) return false;
    o = o || {};
    if (x == null || y == null || !isFinite(x) || !isFinite(y)) { x = world.w * 0.5; y = world.h * 0.5; }
    qual = clamp(o.q == null ? (nOn > NP * 0.6 ? 0.4 : 1) : o.q, 0.2, 1);
    f(x, y, o);
    if (!NOBUBBLE[fx] || text) {
      const s = textFor(fx, o, text), nw = nowMs();
      if (s && !(o.fast && (PRIO[fx] || 0) < 3) && (nw - lastBubble > 700 || (PRIO[fx] || 0) >= 2) && !(s === lastText && nw - lastTextT < 4000)) { bubble(s, x, y, fx); lastBubble = lastTextT = nw; lastText = s; }
    }
    return true;
  }
  function bubble(text, x, y, fx) {
    if (B.length >= 3) B.shift();
    B.push({ text: text, x: x, y: y, life: 0, max: 2.0 + text.length * 0.035, burst: text.length <= 10 && fx !== 'sorted', lines: null, key: '', good: fx === 'sorted' || fx === 'batch' || fx === 'pass' || fx === 'milestone' || fx === 'delivered' || fx === 'estop' });
  }

  /* ============================================================ Zeichnen */
  function attachScreen(cv) { screenCv = cv || null; gs = cv ? cv.getContext('2d') : null; }
  function attach(cv, shEl) { overlay = cv; gx = cv ? cv.getContext('2d') : null; shakeEl = shEl || null; }
  function setWorld(w, h) { if (w > 0 && h > 0) { world.w = w; world.h = h; } }
  function active() { return nOn > 0 || B.length > 0 || rings.length > 0 || flash > 0.01 || shakeA > 0.3; }
  function clear() { for (let i = 0; i < NP; i++) P[i].on = false; nOn = 0; B.length = 0; rings.length = 0; flash = 0; shakeA = 0; if (shakeEl) shakeEl.style.transform = ''; if (gx && overlay) { gx.setTransform(1, 0, 0, 1, 0, 0); gx.clearRect(0, 0, overlay.width, overlay.height); } drawnLast = false; }

  function wrap(cx, text, maxW) {
    const words = text.split(' '), lines = []; let cur = '';
    words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (cx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }
  function starPath(cx, x, y, r, rot, pts, inner) { cx.beginPath(); for (let i = 0; i < pts * 2; i++) { const a = rot + i * Math.PI / pts - Math.PI / 2, rr = i % 2 ? r * inner : r; cx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } cx.closePath(); }

  /* Aufruf pro Bild: cw, ch = Größe in CSS-Pixeln, dpr = Pixeldichte, dtMs = Zeit seit letztem Bild (bei Zeitraffer ruhig reale Zeit übergeben) */
  function render(cw, ch, dpr, dtMs) {
    if (!gx || !overlay) return;
    let dt = clamp((dtMs == null ? 16 : dtMs) / 1000, 0.001, 0.05);
    if (!active()) { if (drawnLast) { gx.setTransform(1, 0, 0, 1, 0, 0); gx.clearRect(0, 0, overlay.width, overlay.height); drawnLast = false; } if (screenLast && gs) { gs.setTransform(1, 0, 0, 1, 0, 0); gs.clearRect(0, 0, screenCv.width, screenCv.height); screenLast = false; } if (shakeEl && shakeEl.style.transform) shakeEl.style.transform = ''; return; }
    const W = world.w, H = world.h, s = Math.min(cw / W, ch / H), ox = (cw - W * s) / 2, oy = (ch - H * s) / 2;
    gx.setTransform(dpr || 1, 0, 0, dpr || 1, 0, 0); gx.clearRect(0, 0, cw, ch); drawnLast = true;
    let gsOn = false;
    if (gs && screenLast) { gs.setTransform(1, 0, 0, 1, 0, 0); gs.clearRect(0, 0, screenCv.width, screenCv.height); }
    const X = x => ox + x * s, Y = y => oy + y * s;
    // Teilchen
    for (let i = 0; i < NP; i++) {
      const p = P[i]; if (!p.on) continue;
      p.life += dt; if (p.life < 0) continue;
      if (p.life >= p.max) { p.on = false; nOn--; continue; }
      const u = p.life / p.max;
      if (p.k === 'smoke') {
        p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt;
        gx.globalAlpha = 0.34 * (1 - u) * Math.min(1, u * 8); gx.fillStyle = p.col; gx.beginPath(); gx.arc(X(p.x), Y(p.y), p.s * s * (1 + 2.4 * u), 0, 6.2832); gx.fill();
      } else if (p.k === 'star') {
        p.ang += p.vr * dt; const R = p.rad * (0.7 + 0.3 * Math.min(1, u * 4)) * s;
        gx.globalAlpha = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1; gx.fillStyle = p.col; gx.strokeStyle = '#7a5a00'; gx.lineWidth = 1.2;
        starPath(gx, X(p.cx) + Math.cos(p.ang) * R, Y(p.cy) + Math.sin(p.ang) * R * 0.45, p.s * s * 1.5, p.ang * 0.5, 5, 0.45); gx.fill(); gx.stroke();
      } else {
        p.vy += p.g * dt; p.vx *= (1 - 0.9 * dt); p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.k === 'spark') {
          gx.globalAlpha = 1 - u; gx.strokeStyle = p.col; gx.lineWidth = p.s * Math.max(0.7, s); gx.lineCap = 'round';
          gx.beginPath(); gx.moveTo(X(p.x), Y(p.y)); gx.lineTo(X(p.x - p.vx * 0.04), Y(p.y - p.vy * 0.04)); gx.stroke();
        } else if (p.k === 'drop') {
          gx.globalAlpha = 1 - u * u; gx.fillStyle = p.col; gx.beginPath(); gx.ellipse(X(p.x), Y(p.y), p.s * s, p.s * s * 1.3, 0, 0, 6.2832); gx.fill();
        } else if (p.k === 'conf') {
          p.rot += p.vr * dt; p.w += dt * 7; p.vx += Math.sin(p.w) * 40 * dt; p.vy = Math.min(p.vy, p.lay ? 220 : 150);
          const g = p.lay ? gs : gx, k = p.lay ? 1 : s; if (!g) { p.on = false; nOn--; continue; } if (p.lay) gsOn = true;
          g.globalAlpha = u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1; g.fillStyle = p.col; g.save(); g.translate(p.lay ? p.x : X(p.x), p.lay ? p.y : Y(p.y)); g.rotate(p.rot); g.scale(1, Math.cos(p.w * 1.7)); g.fillRect(-p.s * k, -p.s * k * 0.5, p.s * k * 2, p.s * k); g.restore(); g.globalAlpha = 1;
        }
      }
    }
    gx.globalAlpha = 1; screenLast = gsOn;
    // Ringe
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.life += dt; if (r.life >= r.max) { rings.splice(i, 1); continue; }
      const u = r.life / r.max, e = 1 - (1 - u) * (1 - u);
      gx.strokeStyle = 'rgba(' + r.col + ',' + (0.85 * (1 - u)).toFixed(3) + ')'; gx.lineWidth = Math.max(1, (2 + 8 * (1 - u)) * s); gx.beginPath(); gx.arc(X(r.x), Y(r.y), r.R * e * s, 0, 6.2832); gx.stroke();
    }
    // Blitz
    if (flash > 0.01) { gx.fillStyle = 'rgba(' + flashCol + ',' + (flash * 0.4).toFixed(3) + ')'; gx.fillRect(0, 0, cw, ch); flash *= Math.pow(0.001, dt); }
    // Sprechblasen
    const fs = clamp(Math.min(cw, ch * 1.6) / 46, 11, 20), maxW = Math.min(cw * 0.5, fs * 14);
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i]; b.life += dt; if (b.life >= b.max) { B.splice(i, 1); continue; }
      const u = b.life / b.max, pop = Math.min(1, b.life / 0.16), sc = 0.55 + 0.45 * (1 - Math.pow(1 - pop, 3)) + (b.life < 0.16 ? 0.12 * Math.sin(pop * 3.14) : 0), a = b.max - b.life < 0.35 ? (b.max - b.life) / 0.35 : 1;
      gx.save(); gx.globalAlpha = a;
      gx.font = '800 ' + (b.burst ? fs * 1.35 : fs) + 'px system-ui,-apple-system,"Segoe UI",sans-serif'; gx.textAlign = 'center'; gx.textBaseline = 'middle';
      const key = fs + '|' + maxW; if (b.key !== key) { b.key = key; b.lines = b.burst ? [b.text] : wrap(gx, b.text, maxW); }
      const lh = fs * 1.2 * (b.burst ? 1.35 : 1); let tw = 0; b.lines.forEach(l => { tw = Math.max(tw, gx.measureText(l).width); });
      const pw = tw + fs * (b.burst ? 1.6 : 1.3), ph = b.lines.length * lh + fs * (b.burst ? 1.1 : 0.9);
      const ax = X(b.x), ay = Y(b.y), rise = -8 * u;
      let bx = clamp(ax, pw / 2 + 6, cw - pw / 2 - 6), by = ay - 34 * Math.max(0.6, s) - ph / 2 + rise, below = false;
      if (by - ph / 2 < 4) { by = ay + 34 * Math.max(0.6, s) + ph / 2 - rise; below = true; }
      by = clamp(by, ph / 2 + 4, ch - ph / 2 - 4);
      gx.translate(bx, by); gx.scale(sc, sc);
      if (b.burst) {
        const pts = 12; gx.beginPath();
        for (let k = 0; k < pts * 2; k++) { const ang = k * Math.PI / pts, rx = (k % 2 ? 0.72 : 1) * pw * 0.62, ry = (k % 2 ? 0.72 : 1) * ph * 0.78; gx[k ? 'lineTo' : 'moveTo'](Math.cos(ang) * rx, Math.sin(ang) * ry); }
        gx.closePath(); gx.fillStyle = b.good ? '#9af0a8' : '#ffe14a'; gx.fill(); gx.lineWidth = 3; gx.strokeStyle = b.good ? '#1f7a37' : '#d4331f'; gx.lineJoin = 'round'; gx.stroke();
        gx.rotate(-0.07);
      } else {
        const r = Math.min(14, ph / 2), x0 = -pw / 2, y0 = -ph / 2;
        gx.fillStyle = '#ffffff'; gx.strokeStyle = '#1a1f25'; gx.lineWidth = 2.5; gx.lineJoin = 'round';
        gx.beginPath(); gx.moveTo(x0 + r, y0); gx.lineTo(x0 + pw - r, y0); gx.quadraticCurveTo(x0 + pw, y0, x0 + pw, y0 + r); gx.lineTo(x0 + pw, y0 + ph - r); gx.quadraticCurveTo(x0 + pw, y0 + ph, x0 + pw - r, y0 + ph); gx.lineTo(x0 + r, y0 + ph); gx.quadraticCurveTo(x0, y0 + ph, x0, y0 + ph - r); gx.lineTo(x0, y0 + r); gx.quadraticCurveTo(x0, y0, x0 + r, y0); gx.closePath(); gx.fill(); gx.stroke();
        // Zipfel zum Unfallort
        const tx = clamp(ax - bx, -pw / 2 + r + 6, pw / 2 - r - 6), dir = below ? -1 : 1, ty = dir * (ph / 2);
        gx.beginPath(); gx.moveTo(tx - 7, ty); gx.lineTo(clamp(ax - bx, -pw / 2, pw / 2) * 0.6 + tx * 0.4, ty + dir * (30 * Math.max(0.6, s) - 2)); gx.lineTo(tx + 7, ty); gx.closePath();
        gx.fillStyle = '#ffffff'; gx.fill(); gx.stroke();
        gx.beginPath(); gx.moveTo(tx - 6, ty); gx.lineTo(tx + 6, ty); gx.strokeStyle = '#ffffff'; gx.lineWidth = 4; gx.stroke();
      }
      gx.fillStyle = b.burst ? '#1a1f25' : '#1a1f25';
      const y1 = -(b.lines.length - 1) * lh / 2; b.lines.forEach((l, k) => { gx.fillText(l, 0, y1 + k * lh); });
      gx.restore();
    }
    gx.globalAlpha = 1;
    // Wackeln
    if (shakeEl) {
      if (shakeA > 0.3) { shakeEl.style.transform = 'translate(' + (rnd(-1, 1) * shakeA).toFixed(1) + 'px,' + (rnd(-1, 1) * shakeA).toFixed(1) + 'px)'; shakeA *= Math.pow(0.004, dt); }
      else if (shakeEl.style.transform) { shakeEl.style.transform = ''; shakeA = 0; }
    }
  }

  /* ============================================================ Schalter */
  function setEnabled(v) { enabled = !!v; try { localStorage.setItem('sps.fx', enabled ? '1' : '0'); } catch (e) {} if (!enabled) clear(); else unlock(); }
  function setMuted(m) { localMute = !!m; try { if (root.LochFX && root.LochFX.setMuted) root.LochFX.setMuted(!!m); } catch (e) {} }
  if (root.document) { document.addEventListener('pointerdown', unlock, true); document.addEventListener('keydown', unlock, true); }

  root.SPS_FX = {
    sound, trigger, bubble, attach, attachScreen, setWorld, render, active, clear, unlock, setEnabled, isEnabled: () => enabled, setMuted, isMuted,
    confetti: (x, y, c) => confetti(x == null ? world.w / 2 : x, y == null ? world.h / 3 : y, c || 40, world.w * 0.3),
    names: Object.keys(FX), sounds: ['crash', 'splash', 'tire', 'honk', 'buzz', 'alarm', 'boing', 'ding', 'tada', 'sad', 'clunk', 'spark', 'whistle'],
    stats: () => ({ particles: nOn, bubbles: B.length, pool: NP })
  };
})(typeof window !== 'undefined' ? window : globalThis);
