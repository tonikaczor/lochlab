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
  function snd(kind) {
    if (muted) return; unlock(); if (!AC || !noiseBuf) return;
    const t = AC.currentTime + 0.01;
    const env = (g, t0, a, d, pk) => { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(pk, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); };
    const nz = (dur, type, f0, f1, pk, dl) => {
      dl = dl || 0; const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = AC.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t + dl); f.frequency.exponentialRampToValueAtTime(f1, t + dl + dur);
      const g = AC.createGain(); env(g, t + dl, 0.004, dur, pk);
      s.connect(f); f.connect(g); g.connect(master); s.start(t + dl, Math.random()); s.stop(t + dl + dur + 0.05);
    };
    const tone = (type, f0, f1, dur, pk, dl) => {
      dl = dl || 0; const o = AC.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t + dl); o.frequency.exponentialRampToValueAtTime(f1, t + dl + dur);
      const g = AC.createGain(); env(g, t + dl, 0.004, dur, pk);
      o.connect(g); g.connect(master); o.start(t + dl); o.stop(t + dl + dur + 0.05);
    };
    switch (kind) {
      case 'boom': nz(1.2, 'lowpass', 3000, 80, 1); tone('sine', 150, 28, 0.8, 1); nz(0.3, 'highpass', 3500, 900, 0.5, 0.01); for (let i = 0; i < 10; i++) nz(0.03, 'highpass', 3500, 3500, 0.25, 0.15 + Math.random() * 0.9); break;
      case 'pop': nz(0.16, 'bandpass', 2800, 500, 0.9); tone('sine', 1000, 140, 0.14, 0.6); tone('triangle', 300, 60, 0.3, 0.3, 0.02); break;
      case 'zap': tone('sawtooth', 1500, 45, 0.4, 0.45); nz(0.35, 'highpass', 2500, 500, 0.55); tone('square', 90, 40, 0.5, 0.2, 0.1); break;
      case 'fizz': nz(1.6, 'bandpass', 4500, 1400, 0.3); for (let i = 0; i < 14; i++) nz(0.025, 'highpass', 3000, 3000, 0.3, Math.random() * 1.4); tone('sine', 220, 50, 0.4, 0.25); break;
      case 'tick': nz(0.02, 'highpass', 4000, 4000, 0.25); break;
      case 'click': nz(0.03, 'bandpass', 2500, 2500, 1); tone('square', 180, 60, 0.07, 0.4); tone('square', 900, 300, 0.04, 0.3, 0.09); break;
    }
  }

  /* ---------- Teilchen ---------- */
  function explode(x, y, o) {
    o = o || {};
    const k = o.kind || 'led', S = o.scale || 22, col = o.color || '255,170,60', big = k === 'chip' || k === 'big';
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
  }
  function trip(x, y, text, scale) {
    const f = (scale || 22) / 22;
    for (let i = 0; i < 14; i++) { const a = rnd(0, 6.283), v = rnd(80, 260) * f; P.push({ t: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 200, life: 0, max: rnd(0.2, 0.5), s: rnd(1.2, 2.4), col: '255,240,170' }); }
    rings.push({ x, y, r: 0, R: 3 * (scale || 22), life: 0, max: 0.35, col: '255,200,80' });
    texts.push({ x, y: y - 10 * f, s: text || 'KLACK!', life: 0, max: 1.1, col: '255,200,80', size: 24 });
    shakeA = Math.max(shakeA, 5); flash = Math.max(flash, 0.2); flashCol = '255,200,80';
    snd('click');
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
      cx.globalCompositeOperation = 'lighter'; cx.strokeStyle = `rgba(${r.col},${0.9 * (1 - u)})`; cx.lineWidth = 2 + 10 * (1 - u);
      cx.beginPath(); cx.arc(r.x, r.y, r.R * e, 0, 7); cx.stroke();
      const g = cx.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.R * e * 0.8); g.addColorStop(0, `rgba(255,240,200,${0.55 * (1 - u)})`); g.addColorStop(1, 'rgba(255,160,60,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(r.x, r.y, r.R * e * 0.8, 0, 7); cx.fill(); cx.globalCompositeOperation = 'source-over';
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i]; t.life += dt; if (t.life >= t.max) { texts.splice(i, 1); continue; }
      const u = t.life / t.max, sc = u < 0.15 ? 0.4 + 4 * u : 1 + 0.2 * u, a = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
      cx.save(); cx.translate(t.x, t.y - 60 * u); cx.rotate(-0.12); cx.scale(sc, sc);
      cx.font = `900 ${t.size}px system-ui,sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.lineJoin = 'round';
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
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  root.LochFX = { tone, toneOff, trip, explode, stress, draw, active, clear, sound: snd, unlock, showBtn, setMuted, isMuted: () => muted, setShakeEl: el => { shakeEl = el; } };
})(typeof window !== 'undefined' ? window : globalThis);
