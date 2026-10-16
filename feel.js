'use strict';
/* Tonfunk Lab: Bauteile fühlen. Kleine Vibrationen (Handy, Android; auf dem iPhone über den Schalter-Trick in Safari) und passende
   Klicks und Geräusche: Relais klackt, Schalter rastet, Motor läuft an und brummt, Sicherung fliegt raus, Kurzschluss ruckelt.
   Einstellung „Bauteile fühlen“ im Menü (Schlüssel lm4.feel, Standard an). */
(function (root) {
  let AC = null, lastV = 0, ios = null; const st = new Map(); let motorAt = 0;
  const on = () => { try { return localStorage.getItem('lm4.feel') !== '0'; } catch (e) { return true; } };
  const muted = () => !!(root.LochFX && root.LochFX.isMuted && root.LochFX.isMuted());
  const PAT = { switch: [10], press: [6], release: [4], relay: [14, 45, 14], thy: [8], whirr: [30, 30, 30], motor: [3], trip: [30, 40, 70], zap: [60, 40, 120, 40, 60], burn: [220], shock: [80, 50, 80, 50, 80], win: [20, 60, 20, 60, 50] };
  function haptic(kind) {
    if (!on()) return; const now = performance.now(); if (now - lastV < 40) return; lastV = now; const p = PAT[kind] || [8];
    try { if (navigator.vibrate && navigator.vibrate(p)) return; } catch (e) {}
    try {                                                        // iPhone: Safari löst bei einem Schalter-Kästchen (type=checkbox, switch) einen Haptik-Impuls aus
      if (!ios) { const l = document.createElement('label'); l.style.cssText = 'position:fixed;left:-200px;top:-200px;opacity:0;pointer-events:none'; const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); l.appendChild(i); document.body.appendChild(l); ios = l; }
      ios.click();
    } catch (e) {}
  }
  function ctx() {
    try { if (!AC) { const C = root.AudioContext || root.webkitAudioContext; if (!C) return null; AC = new C(); } if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; }
  }
  function click(f0, dur, gain) {
    const a = ctx(); if (!a || muted()) return; const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.35, t + dur); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function whirr(up) {
    const a = ctx(); if (!a || muted()) return; const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(up ? 60 : 160, t); o.frequency.exponentialRampToValueAtTime(up ? 170 : 55, t + 0.5); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.6);
  }
  const SND = { switch: () => click(1800, 0.05, 0.12), press: () => click(2200, 0.03, 0.1), release: () => click(1500, 0.03, 0.06), relay: () => { click(2400, 0.04, 0.2); setTimeout(() => click(1400, 0.06, 0.16), 55); }, thy: () => click(2600, 0.02, 0.07) };
  function tap(kind) { if (!on()) return; haptic(kind); if (SND[kind]) SND[kind](); }
  /* Ereignisse der Simulation (Kurzschluss, Auslösen, Schlag): nur Vibration, den Ton machen die Effekte (fx.js) */
  function event(kind) { if (!on()) return; haptic(kind === 'burn' ? 'burn' : kind === 'trip' ? 'trip' : kind === 'shock' ? 'shock' : 'zap'); }
  /* Zustände der Simulation beobachten: Relais, Thyristor, Motor */
  function watch(elems, running) {
    if (!on() || !elems) return; const now = performance.now(); let spinning = false;
    for (let i = 0; i < elems.length; i++) {
      const e = elems[i];
      if (e.relay && typeof e.on === 'boolean') { const k = 'r' + i, was = st.get(k); if (was !== undefined && was !== e.on && running) tap('relay'); st.set(k, e.on); }
      else if ((e.type === 'THY' || e.type === 'TRIAC') && typeof e.on === 'boolean') { const k = 't' + i, was = st.get(k); if (was !== undefined && was !== e.on && running) tap('thy'); st.set(k, e.on); }
      if ((e.mech || e.m3) && Math.abs(e.w || 0) > 8) spinning = true;
    }
    const was = st.get('motor'); if (was !== undefined && was !== spinning && running) { if (!muted()) whirr(spinning); haptic('whirr'); } st.set('motor', spinning);
    if (spinning && running && now - motorAt > 420) { motorAt = now; haptic('motor'); }
  }
  function reset() { st.clear(); }
  function toggle() { const v = !on(); try { localStorage.setItem('lm4.feel', v ? '1' : '0'); } catch (e) {} if (root.LabUI && root.LabUI.toast) root.LabUI.toast(v ? 'Bauteile fühlen: an (Klicks und Vibration)' : 'Bauteile fühlen: aus'); if (v) tap('switch'); return v; }
  document.addEventListener('pointerdown', () => { ctx(); }, { once: true, capture: true });
  root.Feel = { on, toggle, tap, event, watch, reset, haptic };
})(typeof window !== 'undefined' ? window : globalThis);
