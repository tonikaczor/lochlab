'use strict';
/* Tonfunk Lab: Lötübung. Zwei Teile: (1) Löten üben (Kolben anlegen, Hitze abwarten, Zinn zuführen, richtig beenden)
   und (2) Lupen-Prüfung (schlechte Lötstellen auf einer Reihe erkennen). Eigenes Fenster, unabhängig von den Schaltungen. */
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KINDS = {
    gut: { t: 'Gute Lötstelle', x: 'Glänzend, kegelförmig mit leicht hohlem Rand. Das Lötauge ist rundum benetzt.' },
    kalt: { t: 'Kalte Lötstelle', x: 'Das Zinn ist matt und kugelig, weil das Lötauge zu kalt war, als das Zinn dazukam. Das hält schlecht und hat oft Wackelkontakt. Nachlöten: erst erhitzen, dann Zinn.' },
    zuwenig: { t: 'Zu wenig Zinn', x: 'Das Lötauge ist nicht ganz bedeckt. Die Verbindung ist schwach und bricht leicht. Etwas mehr Zinn zuführen.' },
    zuviel: { t: 'Zu viel Zinn', x: 'Ein dicker Klecks, der über das Lötauge hinausragt. Er kann zur Nachbarstelle überbrücken (Kurzschluss). Weniger Zinn nehmen.' },
    verbrannt: { t: 'Überhitzt', x: 'Das Lötauge ist braun und kann sich lösen, das Bauteil leidet. Kolben nur so lange anlegen wie nötig (etwa 2 bis 4 Sekunden).' },
    leer: { t: 'Nicht gelötet', x: 'Es ist kein Zinn am Lötauge. Die Verbindung fehlt.' }
  };
  /* ---------- Zeichnen einer Lötstelle ---------- */
  function joint(g, cx, cy, R, kind, seed) {
    let s = seed || 1; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    g.save(); g.translate(cx, cy);
    const pad = kind === 'verbrannt' ? '#5a3418' : '#c27a3a';
    g.fillStyle = pad; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
    if (kind === 'verbrannt') { g.fillStyle = 'rgba(0,0,0,.55)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc((rnd() - .5) * R, (rnd() - .5) * R, R * (.15 + rnd() * .2), 0, 7); g.fill(); } g.strokeStyle = '#2a1608'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R * .98, .3, 2.2); g.stroke(); }
    const blob = (r, col, irregular) => {
      g.beginPath(); const n = 14; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, rr = r * (1 + (irregular ? (rnd() - .5) * .28 : 0)); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.fillStyle = col; g.fill();
    };
    if (kind === 'gut') {
      const gr = g.createRadialGradient(-R * .25, -R * .3, R * .05, 0, 0, R * .95); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.35, '#dfe5ea'); gr.addColorStop(1, '#8f9aa5');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * .92, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(0, 0, R * .12, 0, 7); g.fill();
    } else if (kind === 'kalt') {
      blob(R * .8, '#6d7378', true); g.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc((rnd() - .5) * R * 1.1, (rnd() - .5) * R * 1.1, 1.5 + rnd() * 2, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, R * .82, 0, 7); g.stroke();
    } else if (kind === 'zuwenig') {
      const gr = g.createRadialGradient(-R * .1, -R * .1, R * .03, 0, 0, R * .5); gr.addColorStop(0, '#f2f5f7'); gr.addColorStop(1, '#8f9aa5'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * .48, 0, 7); g.fill();
    } else if (kind === 'zuviel') {
      const gr = g.createRadialGradient(-R * .3, -R * .35, R * .1, 0, 0, R * 1.4); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.5, '#cdd4da'); gr.addColorStop(1, '#7c8791'); g.fillStyle = gr; blob(R * 1.35, gr, false);
    } else if (kind === 'verbrannt') {
      blob(R * .5, '#7d7468', true);
    }
    if (kind === 'leer' || kind === 'verbrannt' || kind === 'zuwenig') { g.fillStyle = '#d7dadd'; g.fillRect(-R * .09, -R * .09, R * .18, R * .18); }
    if (kind === 'leer') { g.fillStyle = '#10151a'; g.beginPath(); g.arc(0, 0, R * .22, 0, 7); g.fill(); g.fillStyle = '#d7dadd'; g.fillRect(-R * .09, -R * .5, R * .18, R * .55); }
    g.restore();
  }
  /* ---------- Fenster ---------- */
  function open() {
    if (document.getElementById('loetBox')) return;
    const w = document.createElement('div'); w.id = 'loetBox';
    w.style.cssText = 'position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px';
    w.innerHTML = `<div style="background:#1f262e;color:#e8eaed;border:1px solid #38424d;border-radius:14px;padding:16px;max-width:560px;width:100%;font:15px system-ui,sans-serif">
      <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:19px">🔥 Lötübung</b><button id="lbX" style="background:none;border:0;color:#e8eaed;font-size:22px;cursor:pointer" aria-label="Schließen">✕</button></div>
      <div style="display:flex;gap:8px;margin:10px 0"><button class="lbt on" id="lbT1">Löten üben</button><button class="lbt" id="lbT2">Lupen-Prüfung</button></div>
      <div id="lbBody"></div></div>
      <style>.lbt{background:#2c343e;color:#e8eaed;border:1px solid #38424d;border-radius:9px;padding:9px 14px;font-size:14px;cursor:pointer;touch-action:manipulation}.lbt.on{background:#ff9d00;color:#1b1b1b;border-color:#ff9d00;font-weight:700}.lbt[disabled]{opacity:.4;cursor:default}#loetBox canvas{width:100%;background:#1d4a2c;border-radius:10px;display:block}</style>`;
    document.body.appendChild(w);
    const body = w.querySelector('#lbBody'); let raf = 0, cleanup = () => {};
    const close = () => { cleanup(); clearTimeout(raf); w.remove(); };
    w.querySelector('#lbX').onclick = close; w.addEventListener('pointerdown', e => { if (e.target === w) close(); });
    const tab = n => { cleanup(); cleanup = () => {}; clearTimeout(raf); w.querySelector('#lbT1').classList.toggle('on', n === 1); w.querySelector('#lbT2').classList.toggle('on', n === 2); n === 1 ? practice() : lupe(); };
    w.querySelector('#lbT1').onclick = () => tab(1); w.querySelector('#lbT2').onclick = () => tab(2);
    const stat = (k, v, m) => { if (root.Badges) root.Badges.stat(k, v, m); };

    /* ===== Teil 1: Löten üben ===== */
    function practice() {
      const TEMPS = [[320, .26, 'Bleifrei 320 °C'], [350, .36, 'Bleifrei 350 °C'], [380, .5, 'Bleifrei 380 °C (heiß)']];
      let ti = 1, n = 0, good = 0, st, results = [];
      body.innerHTML = `<p style="margin:0 0 8px;color:#9aa6b2">Ablauf: <b>1.</b> Kolben anlegen, <b>2.</b> warten, bis die Hitze im grünen Bereich ist, <b>3.</b> Zinn zuführen, bis die Lötstelle gut aussieht, <b>4.</b> Zinn weg, <b>5.</b> Kolben weg. Sechs Lötstellen pro Runde.</p>
        <canvas id="lbCv" width="480" height="260"></canvas>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><button class="lbt" id="lbIron">1. Kolben anlegen</button><button class="lbt" id="lbSol" disabled>2. Zinn zuführen</button><button class="lbt" id="lbTemp"></button></div>
        <div id="lbMsg" style="min-height:62px;font-size:14px"></div>
        <div id="lbDots" style="margin-top:6px;font-size:18px;letter-spacing:3px"></div>`;
      const cv = body.querySelector('#lbCv'), g = cv.getContext('2d'), bI = body.querySelector('#lbIron'), bS = body.querySelector('#lbSol'), bT = body.querySelector('#lbTemp'), msg = body.querySelector('#lbMsg'), dots = body.querySelector('#lbDots');
      const fresh = () => { st = { iron: false, sol: false, h: 0, amt: 0, cold: 0, ovr: 0, heatT: 0, done: false, kind: null, t0: performance.now() }; bI.textContent = '1. Kolben anlegen'; bI.disabled = false; bS.disabled = true; bS.textContent = '2. Zinn zuführen'; msg.innerHTML = ''; };
      const upT = () => { bT.textContent = '🌡 ' + TEMPS[ti][2]; }; upT(); fresh();
      bT.onclick = () => { if (st.iron || st.done) return; ti = (ti + 1) % TEMPS.length; upT(); };
      const finish = () => {
        st.done = true; st.iron = false; st.sol = false; bI.disabled = true; bS.disabled = true;
        let k; if (st.ovr > 2.2) k = 'verbrannt'; else if (st.amt < 0.05) k = 'leer'; else if (st.cold > 0.35) k = 'kalt'; else if (st.amt < 0.55) k = 'zuwenig'; else if (st.amt > 1.75) k = 'zuviel'; else k = 'gut';
        st.kind = k; n++; if (k === 'gut') good++; results.push(k);
        msg.innerHTML = `<b style="color:${k === 'gut' ? '#5ee27d' : '#ffb020'}">${esc(KINDS[k].t)}</b><br>${esc(KINDS[k].x)}<br><button class="lbt" id="lbNext" style="margin-top:8px">${n >= 6 ? 'Ergebnis' : 'Nächste Lötstelle'}</button>`;
        dots.textContent = results.map(r => r === 'gut' ? '🟢' : '🔴').join('') + '⚪'.repeat(Math.max(0, 6 - results.length));
        body.querySelector('#lbNext').onclick = () => { if (n >= 6) summary(); else fresh(); };
      };
      const summary = () => {
        if (good >= 1) stat('loetOK', good); if (good === 6) stat('loetPerfekt', 1, 'max');
        body.innerHTML = `<p style="font-size:20px;margin:0 0 8px"><b>${good} von 6</b> Lötstellen gut</p><p style="color:#9aa6b2">${good === 6 ? 'Makellos! Ruhige Hand. Jetzt noch die Lupen-Prüfung?' : good >= 4 ? 'Schon ordentlich. Achte auf die Hitze vor dem Zinn und auf die Menge.' : 'Übung macht den Meister. Erst erhitzen, dann das Zinn an Lötauge und Kolben zugleich, nicht auf den Kolben.'}</p>
          <div style="display:flex;gap:8px"><button class="lbt on" id="lbAgain">Nochmal</button><button class="lbt" id="lbL">Zur Lupen-Prüfung</button></div>`;
        body.querySelector('#lbAgain').onclick = () => tab(1); body.querySelector('#lbL').onclick = () => tab(2);
      };
      bI.onclick = () => { if (st.done) return; if (!st.iron) { st.iron = true; bI.textContent = '5. Kolben wegnehmen'; bS.disabled = false; } else { if (st.sol) { st.sol = false; } finish(); } };
      bS.onclick = () => { if (st.done || !st.iron) return; st.sol = !st.sol; bS.textContent = st.sol ? '4. Zinn wegnehmen' : '2. Zinn zuführen'; };
      let last = performance.now();
      const loop = now => {
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        if (!st.done) {
          if (st.iron) { st.h = Math.min(1.15, st.h + TEMPS[ti][1] * dt); if (st.h > 1.0) st.ovr += dt; st.heatT += dt; } else st.h = Math.max(0, st.h - 0.5 * dt);
          if (st.sol && st.iron) { if (st.h >= 0.5) { st.amt += 0.75 * dt; st.h = Math.max(0, st.h - 0.22 * dt); } else { st.cold += dt; st.amt += 0.18 * dt; } }
        }
        draw(); raf = setTimeout(() => loop(performance.now()), 16);
      };
      function draw() {
        g.clearRect(0, 0, 480, 260); g.fillStyle = '#1d4a2c'; g.fillRect(0, 0, 480, 260);
        const cx = 240, cy = 168, R = 44;
        if (st.done) joint(g, cx, cy, R, st.kind, 7);
        else {
          const hot = Math.min(1, st.h), padCol = `rgb(${Math.round(194 + 61 * hot)},${Math.round(122 - 60 * hot)},${Math.round(58 - 30 * hot)})`;
          g.fillStyle = padCol; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
          if (st.amt > 0) { const r = Math.min(R * 1.5, R * (.25 + st.amt * .62)); const gr = g.createRadialGradient(cx - r * .3, cy - r * .3, r * .1, cx, cy, r); gr.addColorStop(0, st.cold > .3 ? '#aab0b5' : '#ffffff'); gr.addColorStop(1, st.cold > .3 ? '#6d7378' : '#8f9aa5'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); }
          g.fillStyle = '#d7dadd'; g.fillRect(cx - 4, cy - 70, 8, 70);               // Anschlussdraht
          if (st.iron) { g.save(); g.translate(cx + 18, cy - 6); g.rotate(-0.7); g.fillStyle = '#b8bec4'; g.fillRect(0, -7, 190, 14); g.fillStyle = '#ff7a00'; g.beginPath(); g.moveTo(0, -7); g.lineTo(-26, 0); g.lineTo(0, 7); g.fill(); g.restore(); }
          if (st.sol) { g.strokeStyle = '#c9ced3'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 190, cy - 160); g.lineTo(cx - 26, cy - 20); g.stroke(); }
        }
        // Hitze-Balken
        g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(20, 20, 200, 18);
        const sc = 200 / 1.15;
        g.fillStyle = 'rgba(80,200,110,.35)'; g.fillRect(20 + sc * .5, 20, sc * .5, 18);
        g.fillStyle = 'rgba(255,80,60,.35)'; g.fillRect(20 + sc * 1.0, 20, sc * .15, 18);
        g.fillStyle = st.h > 1.0 ? '#ff5544' : st.h >= 0.5 ? '#5ee27d' : '#ffb020'; g.fillRect(20, 20, sc * Math.min(1.15, st.h), 18);
        g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(20, 20, 200, 18);
        g.fillStyle = '#fff'; g.font = '12px system-ui'; g.fillText('Hitze am Lötauge (grün = bereit für Zinn)', 20, 54);
        g.fillText('Zinn: ' + (st.amt < .05 ? '–' : st.amt < .55 ? 'zu wenig' : st.amt > 1.75 ? 'zu viel' : 'gut'), 20, 72);
      }
      cleanup = () => {}; last = performance.now(); raf = setTimeout(() => loop(performance.now()), 16);
    }

    /* ===== Teil 2: Lupen-Prüfung ===== */
    function lupe() {
      const ALL = ['gut', 'gut', 'gut', 'kalt', 'zuwenig', 'zuviel', 'verbrannt', 'leer'];
      const pick = () => { const o = []; for (let i = 0; i < 12; i++) o.push(Math.random() < .5 ? 'gut' : ALL[3 + Math.floor(Math.random() * 5)]); if (!o.some(x => x !== 'gut')) o[3] = 'kalt'; return o; };
      let row = pick(), mark = new Set(), seeds = row.map(() => 1 + Math.floor(Math.random() * 90000)), checked = false;
      body.innerHTML = `<p style="margin:0 0 8px;color:#9aa6b2">Zwölf Lötstellen unter der Lupe. Tippe alle an, die <b>nicht gut</b> sind, und drücke dann „Prüfen“.</p><canvas id="lpCv" width="480" height="300"></canvas>
        <div style="display:flex;gap:8px;margin:10px 0"><button class="lbt on" id="lpGo">Prüfen</button><button class="lbt" id="lpNew">Neue Reihe</button></div><div id="lpMsg" style="font-size:14px;min-height:60px"></div>`;
      const cv = body.querySelector('#lpCv'), g = cv.getContext('2d'), msg = body.querySelector('#lpMsg');
      const pos = i => [60 + (i % 4) * 120, 62 + Math.floor(i / 4) * 92];
      const paint = () => {
        g.clearRect(0, 0, 480, 300); g.fillStyle = '#1d4a2c'; g.fillRect(0, 0, 480, 300);
        row.forEach((k, i) => {
          const [x, y] = pos(i); joint(g, x, y, 34, k, seeds[i]);
          if (mark.has(i)) { g.strokeStyle = checked ? (k === 'gut' ? '#ff5544' : '#5ee27d') : '#ffd23f'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, 44, 0, 7); g.stroke(); }
          else if (checked && k !== 'gut') { g.strokeStyle = '#ff5544'; g.setLineDash([6, 4]); g.lineWidth = 3; g.beginPath(); g.arc(x, y, 44, 0, 7); g.stroke(); g.setLineDash([]); }
          g.fillStyle = '#fff'; g.font = '12px system-ui'; g.textAlign = 'center'; g.fillText(String(i + 1) + (checked && k !== 'gut' ? ' ' + KINDS[k].t : ''), x, y + 58);
        });
      };
      paint();
      cv.addEventListener('pointerdown', e => { if (checked) return; const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) * 480 / r.width, py = (e.clientY - r.top) * 300 / r.height; let b = -1, bd = 56; row.forEach((k, i) => { const [x, y] = pos(i), d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; b = i; } }); if (b >= 0) { mark.has(b) ? mark.delete(b) : mark.add(b); paint(); } });
      body.querySelector('#lpNew').onclick = () => lupe();
      body.querySelector('#lpGo').onclick = () => {
        if (checked) return; checked = true;
        const bad = row.map((k, i) => k !== 'gut' ? i : -1).filter(i => i >= 0), found = bad.filter(i => mark.has(i)).length, fals = [...mark].filter(i => row[i] === 'gut').length;
        const perfect = found === bad.length && !fals; if (found) stat('lupeOK', found); if (perfect) stat('lupePerfekt', 1, 'max');
        msg.innerHTML = `<b style="color:${perfect ? '#5ee27d' : '#ffb020'}">${found} von ${bad.length} schlechten Lötstellen gefunden${fals ? ', ' + fals + ' gute fälschlich markiert' : ''}.</b><br>${perfect ? 'Scharfes Auge! Das wäre eine saubere Platine.' : 'Rot gestrichelt sind die übersehenen. Die Beschriftung sagt, was der Fehler ist.'}`;
        paint();
      };
    }
    practice();
  }
  root.Loetuebung = { open, joint, KINDS };
})(typeof window !== 'undefined' ? window : globalThis);
