'use strict';
/* Tonfunk Lab: Oszilloskop-Trainer. Ein Übungsgerät mit Zeitbasis, Volt je Kästchen, Trigger und Signalquelle,
   dazu fünf Ableseaufgaben mit Zufallszahlen und ein Kurven-Rätsel (welche Schaltung macht diese Kurve?). */
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TB = [1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2];        // Sekunden je Kästchen
  const VB = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];                                               // Volt je Kästchen
  const tbText = t => (t >= 1e-3 ? (t * 1e3) + ' ms' : (t * 1e6) + ' µs'), vbText = v => (v >= 1 ? v + ' V' : (v * 1e3) + ' mV');
  const fmtHz = f => (f >= 1000 ? (f / 1000).toString().replace('.', ',') + ' kHz' : f.toString().replace('.', ',') + ' Hz');
  let seed = (Date.now() % 100000) + 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  /* Signalformen als Funktion der Phase (0..1) */
  const SHAPES = {
    sin: p => Math.sin(2 * Math.PI * p), sqr: p => (p < .5 ? 1 : -1), tri: p => (p < .5 ? 4 * p - 1 : 3 - 4 * p), saw: p => 2 * p - 1,
    half: p => Math.max(0, Math.sin(2 * Math.PI * p)),
    full: p => Math.abs(Math.sin(Math.PI * p)),
    lp: p => { const k = 3, r = Math.exp(-k), vh = (1 - r) / (1 + r), x = p < .5 ? p / .5 : (p - .5) / .5; return p < .5 ? 1 - (1 + vh) * Math.exp(-k * x) : -1 + (1 + vh) * Math.exp(-k * x); },
    hp: p => { const x = p < .5 ? p / .5 : (p - .5) / .5; return (p < .5 ? 1 : -1) * Math.exp(-7 * x); },
    clip: p => Math.max(-0.45, Math.min(0.45, Math.sin(2 * Math.PI * p))) / 0.45,
    clipPos: p => Math.min(0.6, Math.sin(2 * Math.PI * p)),
    ripple: p => (p < .2 ? .75 + 1.25 * p : 1 - (p - .2) / .8 * .25),
    over: p => Math.max(-1, Math.min(1, 3.2 * Math.sin(2 * Math.PI * p)))
  };
  const RIDDLE = [
    { s: 'half', n: 'Einweggleichrichter ohne Glättung', hint: 'Nur die positiven Halbwellen kommen durch.' },
    { s: 'full', n: 'Brückengleichrichter ohne Glättung', hint: 'Beide Halbwellen sind umgeklappt, kein Loch dazwischen.' },
    { s: 'ripple', n: 'Gleichrichter mit Siebelko (Brummspannung)', hint: 'Kurzes Nachladen, langsames Entladen: Sägezahn auf hohem Pegel.' },
    { s: 'clip', n: 'Begrenzer mit zwei Dioden (beide Halbwellen abgeschnitten)', hint: 'Die Spitzen sind oben und unten flach.' },
    { s: 'clipPos', n: 'Begrenzer mit einer Diode (nur oben abgeschnitten)', hint: 'Nur die positiven Spitzen sind flach.' },
    { s: 'lp', n: 'RC-Tiefpass mit Rechteck am Eingang', hint: 'Die Flanken werden rund: Aufladen und Entladen nach e-Funktion.' },
    { s: 'hp', n: 'RC-Hochpass mit Rechteck am Eingang', hint: 'Nur die Flanken kommen durch, dann klingt die Spannung ab.' },
    { s: 'over', n: 'Übersteuerter Verstärker', hint: 'Fast Rechteck mit leicht schrägen Flanken, oben und unten begrenzt.' },
    { s: 'tri', n: 'Dreieckgenerator (Integrator)', hint: 'Gerade ansteigende und abfallende Flanken.' }
  ];

  function open() {
    if (document.getElementById('osziBox')) return;
    const w = document.createElement('div'); w.id = 'osziBox';
    w.style.cssText = 'position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.62);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:calc(12px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch';
    w.innerHTML = `<div style="background:#1f262e;color:#e8eaed;border:1px solid #38424d;border-radius:14px;padding:14px;max-width:760px;width:100%;font:15px system-ui,sans-serif">
      <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:19px">∿ Oszilloskop-Trainer</b><button id="ozX" style="background:none;border:0;color:#e8eaed;font-size:22px;cursor:pointer" aria-label="Schließen">✕</button></div>
      <div style="display:flex;gap:8px;margin:10px 0"><button class="ozt on" id="oz1">Ablesen</button><button class="ozt" id="oz2">Kurven-Rätsel</button></div>
      <canvas id="ozCv" width="640" height="400" style="width:100%;background:#0b130e;border-radius:10px;display:block"></canvas>
      <div id="ozCtl" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:10px 0"></div>
      <div id="ozTask" style="min-height:120px"></div></div>
      <style>.ozt{background:#2c343e;color:#e8eaed;border:1px solid #38424d;border-radius:9px;padding:9px 14px;font-size:14px;cursor:pointer}.ozt.on{background:#ff9d00;color:#1b1b1b;border-color:#ff9d00;font-weight:700}#osziBox label{display:flex;flex-direction:column;font-size:12px;color:#9aa6b2;gap:3px}#osziBox select,#osziBox input{background:#10151a;color:#e8eaed;border:1px solid #38424d;border-radius:7px;padding:8px;font-size:15px}#osziBox .opt{display:block;width:100%;text-align:left;margin:6px 0;background:#2c343e;color:#e8eaed;border:1px solid #38424d;border-radius:9px;padding:10px 12px;font-size:14px;cursor:pointer}</style>`;
    document.body.appendChild(w);
    const q = s => w.querySelector(s), cv = q('#ozCv'), g = cv.getContext('2d'), ctl = q('#ozCtl'), task = q('#ozTask');
    let timer = 0, mode = 1;
    const S = { sig: { shape: 'sin', f: 1000, a: 2, off: 0 }, tb: 5, vb: 4, trig: true, level: 0, slope: 1, off: 0, hidden: false };
    const close = () => { clearTimeout(timer); w.remove(); };
    q('#ozX').onclick = close; w.addEventListener('pointerdown', e => { if (e.target === w) close(); });
    q('#oz1').onclick = () => { setMode(1); }; q('#oz2').onclick = () => { setMode(2); };
    const stat = (k, v, m) => { if (root.Badges) root.Badges.stat(k, v, m); };
    function drawScope() {
      const W = 640, H = 400, gx = W / 10, gy = H / 8;
      g.fillStyle = '#0b130e'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(120,200,140,.22)'; g.lineWidth = 1; for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(i * gx, 0); g.lineTo(i * gx, H); g.stroke(); } for (let j = 0; j <= 8; j++) { g.beginPath(); g.moveTo(0, j * gy); g.lineTo(W, j * gy); g.stroke(); }
      g.strokeStyle = 'rgba(120,200,140,.5)'; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
      g.strokeStyle = 'rgba(120,200,140,.5)'; for (let i = 0; i < 50; i++) { const x = i * W / 50; g.beginPath(); g.moveTo(x, H / 2 - 4); g.lineTo(x, H / 2 + 4); g.stroke(); }
      const sg = S.sig, T = 1 / sg.f, tdiv = TB[S.tb], vdiv = VB[S.vb], span = tdiv * 10;
      const val = t => sg.off + sg.a * SHAPES[sg.shape](((t / T) % 1 + 1) % 1);
      let t0;
      if (S.trig) {                                                    // erste Stelle suchen, an der der Pegel in der gewählten Flankenrichtung gekreuzt wird
        const step = T / 400; t0 = null; let prev = val(0);
        for (let t = step; t < T * 2; t += step) { const v = val(t); if (S.slope > 0 ? (prev < S.level && v >= S.level) : (prev > S.level && v <= S.level)) { t0 = t; break; } prev = v; }
        if (t0 == null) t0 = Math.random() * T;                         // Pegel wird nie erreicht: Bild läuft
      } else t0 = Math.random() * T;                                    // ohne Trigger zittert das Bild
      g.strokeStyle = '#6dff7a'; g.lineWidth = 2; g.beginPath();
      for (let x = 0; x <= W; x++) { const t = t0 + x / W * span, v = val(t), y = H / 2 - (v / vdiv) * gy + S.off * gy; x ? g.lineTo(x, Math.max(-20, Math.min(H + 20, y))) : g.moveTo(x, y); }
      g.stroke();
      if (S.trig) { const y = H / 2 - (S.level / vdiv) * gy + S.off * gy; g.strokeStyle = '#ffb020'; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.setLineDash([]); g.fillStyle = '#ffb020'; g.font = '11px system-ui'; g.fillText('T', 4, y - 3); }
      g.fillStyle = '#9fe8aa'; g.font = '12px system-ui'; g.fillText(tbText(tdiv) + ' / Kästchen   ' + vbText(vdiv) + ' / Kästchen   Trigger: ' + (S.trig ? (S.slope > 0 ? 'steigend' : 'fallend') : 'aus'), 8, H - 8);
    }
    const loop = () => { if (!document.body.contains(w)) return; drawScope(); timer = setTimeout(loop, S.trig ? 120 : 60); };
    function buildCtl(showSig) {
      ctl.innerHTML = `<label>Zeit je Kästchen<select id="cTb">${TB.map((t, i) => `<option value="${i}"${i === S.tb ? ' selected' : ''}>${tbText(t)}</option>`).join('')}</select></label>
        <label>Volt je Kästchen<select id="cVb">${VB.map((v, i) => `<option value="${i}"${i === S.vb ? ' selected' : ''}>${vbText(v)}</option>`).join('')}</select></label>
        <label>Trigger<select id="cTr"><option value="1"${S.trig && S.slope > 0 ? ' selected' : ''}>steigende Flanke</option><option value="-1"${S.trig && S.slope < 0 ? ' selected' : ''}>fallende Flanke</option><option value="0"${!S.trig ? ' selected' : ''}>aus (freilaufend)</option></select></label>
        <label>Trigger-Pegel<input type="range" id="cLv" min="-8" max="8" step="0.1" value="${S.level / VB[S.vb]}"></label>
        <label>Vertikal verschieben<input type="range" id="cOf" min="-3" max="3" step="0.1" value="${S.off}"></label>` +
        (showSig ? `<label>Signal<select id="cSh">${[['sin', 'Sinus'], ['sqr', 'Rechteck'], ['tri', 'Dreieck'], ['saw', 'Sägezahn']].map(([k, n]) => `<option value="${k}"${S.sig.shape === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label><label>Frequenz (Hz)<input type="number" id="cF" value="${S.sig.f}" min="20" max="50000"></label><label>Amplitude (V)<input type="number" id="cA" value="${S.sig.a}" min="0.1" max="10" step="0.1"></label>` : '');
      ctl.querySelector('#cTb').onchange = e => { S.tb = +e.target.value; }; ctl.querySelector('#cVb').onchange = e => { const lv = S.level / VB[S.vb]; S.vb = +e.target.value; S.level = lv * VB[S.vb]; };
      ctl.querySelector('#cTr').onchange = e => { const v = +e.target.value; S.trig = v !== 0; if (v) S.slope = v; };
      ctl.querySelector('#cLv').oninput = e => { S.level = +e.target.value * VB[S.vb]; }; ctl.querySelector('#cOf').oninput = e => { S.off = +e.target.value; };
      if (showSig) { ctl.querySelector('#cSh').onchange = e => { S.sig.shape = e.target.value; }; ctl.querySelector('#cF').oninput = e => { S.sig.f = Math.max(20, +e.target.value || 1000); }; ctl.querySelector('#cA').oninput = e => { S.sig.a = Math.max(.1, +e.target.value || 1); }; }
    }
    /* ===== Ablesen ===== */
    let qi = 0, ok = 0, cur = null;
    const QS = [
      () => { const f = pick([250, 400, 500, 800, 1000, 1250, 2000, 2500, 4000]); S.sig = { shape: 'sin', f, a: pick([1, 1.5, 2, 3]), off: 0 }; S.tb = 4; S.vb = 4; return { t: 'Wie groß ist die <b>Frequenz</b> des Signals? Stelle die Zeitbasis so ein, dass du eine Periode gut siehst, zähle die Kästchen für eine Periode und rechne f = 1 / T.', unit: 'Hz', ans: f, tol: .1, show: v => fmtHz(v) }; },
      () => { const a = pick([0.5, 1, 1.5, 2, 2.5, 3, 4]); S.sig = { shape: 'sin', f: pick([500, 1000, 2000]), a, off: 0 }; S.tb = 5; S.vb = 4; return { t: 'Wie groß ist die <b>Spitze-Spitze-Spannung</b> (Vss) des Signals? Zähle die Kästchen von ganz unten bis ganz oben und multipliziere mit „Volt je Kästchen“.', unit: 'V', ans: 2 * a, tol: .1, show: v => String(v).replace('.', ',') + ' V' }; },
      () => { const T = pick([0.5e-3, 1e-3, 2e-3, 4e-3]); S.sig = { shape: 'sqr', f: 1 / T, a: pick([1, 2, 3]), off: 0 }; S.tb = 6; S.vb = 4; return { t: 'Wie lang ist die <b>Periodendauer</b> T des Rechtecksignals? (Antwort in Millisekunden)', unit: 'ms', ans: T * 1e3, tol: .1, show: v => String(v).replace('.', ',') + ' ms' }; },
      () => { const off = pick([1, 1.5, 2, -1, -2]); S.sig = { shape: 'sin', f: 1000, a: 1, off }; S.tb = 5; S.vb = 4; return { t: 'Das Signal sitzt nicht symmetrisch um null. Wie groß ist der <b>Gleichanteil</b> (die Mitte der Kurve, in Volt)? Tipp: Die Mittellinie des Signals liegt auf halber Höhe zwischen Maximum und Minimum.', unit: 'V', ans: off, tol: .15, abs: .25, show: v => String(v).replace('.', ',') + ' V' }; },
      () => { const f = pick([200, 500, 1000, 2000]); S.sig = { shape: 'sin', f, a: 2, off: 0 }; S.trig = false; S.tb = 5; S.vb = 4; return { t: 'Das Bild zittert, weil der <b>Trigger aus</b> ist. Stelle ihn auf „steigende Flanke“ und den Pegel auf einen Wert innerhalb der Kurve (zum Beispiel 0 V), damit das Bild stehen bleibt. Gib dann zur Kontrolle die Frequenz ein.', unit: 'Hz', ans: f, tol: .1, need: () => S.trig && Math.abs(S.level) < 1.8, needMsg: 'Der Trigger ist noch nicht richtig eingestellt (steigende Flanke, Pegel innerhalb der Kurve).', show: v => fmtHz(v) }; }
    ];
    function readTask() {
      cur = QS[qi](); S.level = 0; if (qi !== 4) S.trig = true; S.slope = 1; S.off = 0; buildCtl(false);
      task.innerHTML = `<div class="hint2" style="color:#9aa6b2">Aufgabe ${qi + 1} von ${QS.length}</div><p style="margin:6px 0">${cur.t}</p><div style="display:flex;gap:8px;align-items:center"><input id="ozAns" inputmode="decimal" placeholder="Antwort in ${cur.unit}" style="flex:1"><button class="ozt on" id="ozOk">Prüfen</button></div><div id="ozMsg" style="margin-top:8px;min-height:40px"></div>`;
      q('#ozOk').onclick = () => {
        const v = parseFloat(String(q('#ozAns').value).replace(',', '.')); if (!isFinite(v)) { q('#ozMsg').textContent = 'Bitte eine Zahl eingeben.'; return; }
        if (cur.need && !cur.need()) { q('#ozMsg').innerHTML = '<span style="color:#ffb020">' + esc(cur.needMsg) + '</span>'; return; }
        const good = Math.abs(v - cur.ans) <= Math.max(cur.tol * Math.abs(cur.ans), cur.abs || 0);
        if (good) { ok++; q('#ozMsg').innerHTML = `<span style="color:#5ee27d"><b>Richtig!</b> ${esc(cur.show(cur.ans))}</span> <button class="ozt" id="ozNx" style="margin-left:8px">${qi + 1 < QS.length ? 'Weiter' : 'Ergebnis'}</button>`; q('#ozNx').onclick = () => { qi++; if (qi >= QS.length) readSummary(); else readTask(); }; }
        else q('#ozMsg').innerHTML = `<span style="color:#ffb020">Nicht ganz. Zähle noch einmal und achte auf die Einstellung „Zeit“ bzw. „Volt je Kästchen“. Lösung: ${esc(cur.show(cur.ans))}.</span> <button class="ozt" id="ozNx" style="margin-left:8px">Weiter</button>`;
        if (!good) q('#ozNx').onclick = () => { qi++; if (qi >= QS.length) readSummary(); else readTask(); };
      };
    }
    function readSummary() {
      if (ok >= 1) stat('oszi', ok); if (ok === QS.length) stat('osziPerfekt', 1, 'max');
      task.innerHTML = `<p style="font-size:20px;margin:6px 0"><b>${ok} von ${QS.length}</b> richtig</p><p style="color:#9aa6b2">${ok === QS.length ? 'Alles richtig. Jetzt die Kurven-Rätsel?' : 'Übe Ablesen noch einmal: erst die Einstellungen prüfen, dann Kästchen zählen.'}</p><button class="ozt on" id="ozAg">Nochmal</button> <button class="ozt" id="ozRd">Zu den Kurven-Rätseln</button>`;
      q('#ozAg').onclick = () => setMode(1); q('#ozRd').onclick = () => setMode(2);
    }
    /* ===== Kurven-Rätsel ===== */
    let ri = 0, rok = 0;
    function riddle() {
      const right = pick(RIDDLE), opts = [right]; while (opts.length < 4) { const o = pick(RIDDLE); if (!opts.includes(o)) opts.push(o); } opts.sort(() => rnd() - .5);
      S.sig = { shape: right.s, f: pick([500, 1000, 2000]), a: 2, off: 0 }; S.tb = 5; S.vb = 4; S.trig = true; S.level = 0; S.slope = 1; S.off = 0;
      S.level = { half: 0.3, full: 0.3, ripple: 1.6, hp: 0.5 }[right.s] || 0;
      buildCtl(false);
      task.innerHTML = `<div class="hint2" style="color:#9aa6b2">Rätsel ${ri + 1} von 5</div><p style="margin:6px 0">Welche Schaltung liefert diese Kurve am Ausgang?</p>${opts.map((o, i) => `<button class="opt" data-i="${i}">${esc(o.n)}</button>`).join('')}<div id="ozMsg" style="margin-top:8px"></div>`;
      task.querySelectorAll('.opt').forEach(b => { b.onclick = () => { const o = opts[+b.dataset.i], good = o === right; task.querySelectorAll('.opt').forEach(x => { x.disabled = true; }); if (good) rok++; q('#ozMsg').innerHTML = `<span style="color:${good ? '#5ee27d' : '#ffb020'}"><b>${good ? 'Richtig!' : 'Leider nein.'}</b> ${good ? '' : 'Es war: ' + esc(right.n) + '. '}${esc(right.hint)}</span> <button class="ozt" id="ozNx" style="margin-left:8px">${ri + 1 < 5 ? 'Weiter' : 'Ergebnis'}</button>`; q('#ozNx').onclick = () => { ri++; if (ri >= 5) riddleSum(); else riddle(); }; }; });
    }
    function riddleSum() {
      if (rok >= 1) stat('osziRaetsel', rok); if (rok === 5) stat('osziPerfekt', 1, 'max');
      task.innerHTML = `<p style="font-size:20px;margin:6px 0"><b>${rok} von 5</b> Kurven erkannt</p><button class="ozt on" id="ozAg">Nochmal</button>`; q('#ozAg').onclick = () => setMode(2);
    }
    function setMode(m) { mode = m; q('#oz1').classList.toggle('on', m === 1); q('#oz2').classList.toggle('on', m === 2); if (m === 1) { qi = 0; ok = 0; readTask(); } else { ri = 0; rok = 0; riddle(); } }
    setMode(1); loop();
  }
  root.Oszi = { open, SHAPES, RIDDLE };
})(typeof window !== 'undefined' ? window : globalThis);
