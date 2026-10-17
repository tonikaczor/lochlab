'use strict';
/* Tonfunk Lab: Tonwerkstatt. Echte Töne zum Anfassen: Klaviertasten mit Arduino-Code, 555-Sirene mit Rechner.
   Eigenes Fenster, kein Eingriff in die Schaltung. Erzeugt alle Töne synthetisch (Web Audio, offline). */
(function (root) {
  let AC = null, master = null, wave = 'square', seq = [], recStart = 0, osc = null, lfo = null, pin = 8;
  const NOTES = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'];
  const BLACK = [1, 3, 6, 8, 10];
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);                              // MIDI-Nummer -> Frequenz
  const nname = n => NOTES[n % 12] + (Math.floor(n / 12) - 1);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function ac() {
    if (!AC) { const C = root.AudioContext || root.webkitAudioContext; if (!C) return null; AC = new C(); master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination); }
    if (AC.state === 'suspended') AC.resume(); return AC;
  }
  function beep(f, dur) {
    if (!ac()) return; const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = wave; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(wave === 'square' ? 0.12 : 0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.4));
    o.connect(g); g.connect(master); o.start(t); o.stop(t + (dur || 0.4) + 0.05);
  }
  function stop() { try { if (osc) osc.stop(); if (lfo) lfo.stop(); } catch (e) {} osc = lfo = null; }
  function siren(f, mod) {                                                          // Dauerton, optional mit zweitem Oszillator (Frequenzmodulation)
    stop(); if (!ac()) return; osc = AC.createOscillator(); osc.type = 'square'; osc.frequency.value = f;
    const g = AC.createGain(); g.gain.value = 0.08; osc.connect(g); g.connect(master);
    if (mod) { lfo = AC.createOscillator(); lfo.type = 'square'; lfo.frequency.value = mod.hz; const lg = AC.createGain(); lg.gain.value = f * mod.depth; lfo.connect(lg); lg.connect(osc.frequency); lfo.start(); }
    osc.start();
  }
  const code = () => {
    if (!seq.length) return '// Spiele Tasten, dann erscheint hier dein Arduino-Code';
    let c = '', prev = seq[0].at;
    seq.forEach((s, i) => { const nxt = seq[i + 1], len = Math.max(100, Math.min(1200, Math.round(((nxt ? nxt.at : s.at + 400) - s.at) / 50) * 50)); c += `  tone(${pin}, ${Math.round(hz(s.n))}, ${len});  // ${nname(s.n)}\n  delay(${len + 50});\n`; });
    return 'void setup() {\n' + c + '}\n\nvoid loop() {\n}\n';
  };
  function open() {
    if (document.getElementById('tonWerk')) return;
    const w = document.createElement('div'); w.id = 'tonWerk';
    w.style.cssText = 'position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch';
    let keys = '', x = 0; const lo = 60, hi = 83, WW = 42;                            // C4 bis H5
    for (let n = lo; n <= hi; n++) if (!BLACK.includes(n % 12)) { keys += `<button data-n="${n}" aria-label="${nname(n)}" style="position:absolute;left:${x}px;top:0;width:${WW - 2}px;height:150px;border:1px solid #333;border-radius:0 0 6px 6px;background:#f4f4f2;color:#444;font-size:11px;padding:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:6px;touch-action:manipulation">${nname(n)}</button>`; x += WW; }
    x = 0; for (let n = lo; n <= hi; n++) { if (!BLACK.includes(n % 12)) { x += WW; continue; } keys += `<button data-n="${n}" aria-label="${nname(n)}" style="position:absolute;left:${x - 13}px;top:0;width:26px;height:92px;border:1px solid #000;border-radius:0 0 5px 5px;background:#1b1f24;z-index:2;padding:0;touch-action:manipulation"></button>`; }
    w.innerHTML = `<div style="background:#1f262e;color:#e8eaed;border:1px solid #38424d;border-radius:14px;padding:16px;max-width:1040px;width:100%;font:15px system-ui,sans-serif">
      <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:19px">🎹 Tonwerkstatt</b><button id="twX" style="background:none;border:0;color:#e8eaed;font-size:22px;cursor:pointer">✕</button></div>
      <p style="color:#9aa6b2;margin:6px 0 10px">Hier hörst du, was ein Lautsprecher oder Summer an einem Arduino-Pin wirklich spielt. Tasten antippen, der passende <code>tone()</code>-Befehl entsteht von selbst.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><button class="twb" id="twW">Klang: Summer (eckig)</button><button class="twb" id="twP">Pin: 8</button><button class="twb" id="twPlay">▶ Abspielen</button><button class="twb" id="twClr">Löschen</button></div>
      <div style="overflow-x:auto;padding-bottom:6px"><div id="twKeys" style="position:relative;height:150px;width:${x}px;min-width:${x}px;margin:0 auto">${keys}</div></div>
      <div id="twNow" style="margin:8px 0;font-size:17px;min-height:26px;color:#6cb8ff"></div>
      <pre id="twCode" style="background:#10151a;border:1px solid #38424d;border-radius:8px;padding:10px;margin:0;max-height:180px;overflow:auto;font-size:13px;color:#cfe3ff"></pre>
      <div style="display:flex;gap:8px;margin-top:8px"><button class="twb" id="twCopy">Code kopieren</button></div>
      <hr style="border:0;border-top:1px solid #38424d;margin:16px 0">
      <b style="font-size:17px">🚨 555-Sirene</b>
      <p style="color:#9aa6b2;margin:6px 0 8px">Der 555 als Rechteckgenerator: <b>f = 1,44 / ((R1 + 2·R2) · C)</b>. Ändere die Werte und höre, wie sich der Ton verändert.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
        <label>R1 (kΩ)<input id="twR1" type="number" value="1" min="0.1" step="0.1" style="width:100%"></label>
        <label>R2 (kΩ)<input id="twR2" type="number" value="10" min="0.1" step="0.1" style="width:100%"></label>
        <label>C (nF)<input id="twC" type="number" value="100" min="1" step="1" style="width:100%"></label>
      </div>
      <div id="twF" style="margin:10px 0;font-size:17px"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="twb" id="twTon">▶ Dauerton</button><button class="twb" id="twSir">🚨 Sirene (zweiter 555 moduliert)</button><button class="twb" id="twStop">■ Aus</button></div>
      <p style="color:#9aa6b2;margin:10px 0 0;font-size:13px">Tipp: Ein zweiter, langsamer 555 (etwa 2 Hz) steuert den Steuereingang des ersten. So entsteht der auf- und abschwellende Sirenenton.</p>
    </div>
    <style>.twb{background:#2c343e;color:#e8eaed;border:1px solid #38424d;border-radius:8px;padding:9px 13px;font-size:14px;cursor:pointer}.twb:active{background:#3b4652}#tonWerk input{background:#10151a;color:#e8eaed;border:1px solid #38424d;border-radius:6px;padding:7px;font-size:15px}#tonWerk button[data-n]:active{filter:brightness(.8)}</style>`;
    document.body.appendChild(w);
    const q = s => w.querySelector(s), show = () => { q('#twCode').textContent = code(); };
    const freq = () => { const r1 = parseFloat(q('#twR1').value) * 1e3, r2 = parseFloat(q('#twR2').value) * 1e3, c = parseFloat(q('#twC').value) * 1e-9; const f = 1.44 / ((r1 + 2 * r2) * c); q('#twF').innerHTML = isFinite(f) ? `Frequenz: <b>${f >= 1000 ? (f / 1000).toFixed(2).replace('.', ',') + ' kHz' : f.toFixed(f < 10 ? 2 : 0).replace('.', ',') + ' Hz'}</b>${f > 20000 ? ' (zu hoch zum Hören)' : f < 20 ? ' (zu tief, du hörst nur Klicken)' : ''}` : ''; return f; };
    w.querySelectorAll('button[data-n]').forEach(b => { b.addEventListener('pointerdown', e => { e.preventDefault(); const n = +b.dataset.n; if (!seq.length) recStart = performance.now(); seq.push({ n, at: performance.now() - recStart }); if (seq.length > 40) seq.shift(); beep(hz(n), 0.45); q('#twNow').textContent = nname(n) + ' = ' + hz(n).toFixed(1).replace('.', ',') + ' Hz'; show(); }); });
    q('#twX').onclick = () => { stop(); w.remove(); };
    w.addEventListener('pointerdown', e => { if (e.target === w) { stop(); w.remove(); } });
    q('#twW').onclick = e => { wave = wave === 'square' ? 'triangle' : 'square'; e.target.textContent = 'Klang: ' + (wave === 'square' ? 'Summer (eckig)' : 'Flöte (weich)'); };
    q('#twP').onclick = e => { pin = pin === 8 ? 9 : pin === 9 ? 11 : 8; e.target.textContent = 'Pin: ' + pin; show(); };
    q('#twClr').onclick = () => { seq = []; show(); q('#twNow').textContent = ''; };
    q('#twPlay').onclick = () => { seq.forEach(s => setTimeout(() => { beep(hz(s.n), 0.4); q('#twNow').textContent = nname(s.n); }, s.at)); };
    q('#twCopy').onclick = e => { try { navigator.clipboard.writeText(code()); e.target.textContent = 'Kopiert ✓'; setTimeout(() => e.target.textContent = 'Code kopieren', 1500); } catch (x) {} };
    ['#twR1', '#twR2', '#twC'].forEach(s => q(s).addEventListener('input', freq));
    q('#twTon').onclick = () => { const f = freq(); if (f >= 20 && f <= 20000) siren(f); };
    q('#twSir').onclick = () => { const f = freq(); if (f >= 20 && f <= 20000) siren(f, { hz: 2, depth: 0.25 }); };
    q('#twStop').onclick = stop;
    freq(); show();
  }
  root.Tonwerkstatt = { open, hz, nname, sirenHz: (r1, r2, c) => 1.44 / ((r1 + 2 * r2) * c), code: () => code(), add: n => seq.push({ n, at: seq.length * 300 }), reset: () => { seq = []; } };
})(typeof window !== 'undefined' ? window : globalThis);
