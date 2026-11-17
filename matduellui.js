'use strict';
/* matduellui.js - Rechen-Duell des Rechen-Labs, Oberfläche (Reiter "Duell" in matlab.html). Kern: matduell.js (MatDuell), Aufgaben: MAT_DATA.build.
   Aufruf: matui.js ruft MatDuellUI.render() beim Öffnen des Reiters. Deep-Link: matlab.html?duell=neu oder ?duell=R47-1A2B3.
   Speicher: lm4.mat.rduell   laufende oder letzte Runde { code, start, ans:[{ t (Eingabe), ok }], ende (Sekunden), gegner:[Ergebniscode] }
             lm4.mat.rduellh  die letzten 20 Ergebnisse [{ code, richtig, n, sek, t }]
             lm4.mat.rduellw  letzte Wahl { st, n, min }
   Die Runde zählt nicht in den Lab-Fortschritt: Die Zahlen sind andere als in der Aufgabenliste, und im Duell gibt es keine Tipps. */
(function (root) {
  const M = root.MatDuell, C = root.MAT_CORE, D = root.MAT_DATA, doc = root.document;
  if (!M || !C || !D || !doc) return;
  const LS = 'lm4.mat.';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const jset = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const V = () => doc.getElementById('v_duell');
  const ui = () => root.MAT_UI || {};
  const toast = m => { if (ui().toast) ui().toast(m); };
  const snd = n => { try { if (root.LochFX && root.LochFX.sound) root.LochFX.sound(n, 0.5); } catch (e) {} };
  const kuerzel = () => { try { return M.kurz((localStorage.getItem('lm4.kuerzel') || '').replace(/"/g, '')); } catch (e) { return ''; } };
  const STN = ['', '1. Lehrjahr', 'bis 2. Lehrjahr', 'alle Aufgaben'];
  const info = r => r.n + ' Aufgaben · ' + r.min + ' Minuten · ' + STN[r.st];

  /* Zustand: sicht = 'start' | 'neu' | 'bei' | 'bereit' | 'lauf' | 'ende' */
  const Z = { sicht: 'start', wahl: Object.assign({ st: 1, n: 10, min: 10 }, jget('rduellw', {})), code: '', ps: null, tick: 0, ab: 0, err: '' };
  const cur = () => jget('rduell', null);
  const aufgaben = code => { if (Z.ps && Z.psCode === code) return Z.ps; Z.ps = M.runde(code, D.tasks, D.build); Z.psCode = code; return Z.ps; };
  const rest = c => { const r = M.lies(c.code); return r.min * 60 - (Date.now() - c.start) / 1000; };
  const nOk = c => c.ans.filter(a => a.ok).length;

  function qrInto(host, text) {
    const draw = () => { try { const q = root.qrcode(0, 'M'); q.addData(String(text), 'Byte'); q.make(); host.innerHTML = q.createSvgTag({ cellSize: 4, margin: 4, scalable: true }); host.setAttribute('role', 'img'); host.setAttribute('aria-label', 'QR-Code'); } catch (e) { host.textContent = ''; } };
    if (root.qrcode) { draw(); return; }
    const s = doc.createElement('script'); s.src = 'qr.js'; s.onload = draw; s.onerror = () => { host.textContent = ''; }; doc.head.appendChild(s);
  }
  function scan(onText) {
    const no = () => toast('Der Scanner ist nicht verfügbar. Bitte den Code eintippen.');
    const go = () => { if (root.QrScan) root.QrScan.open({ title: 'QR-Code scannen', onText }); else no(); };
    if (root.QrScan) { go(); return; }
    const s = doc.createElement('script'); s.src = 'qrscan.js'; s.onload = go; s.onerror = no; doc.head.appendChild(s);
  }
  const seg = (key, items, c) => `<div class="seg" role="group">${items.map(([v, l]) => `<button type="button" data-rdw="${key}" data-v="${v}" class="${+c === +v ? 'on' : ''}" aria-pressed="${+c === +v}">${esc(l)}</button>`).join('')}</div>`;

  /* ---------- Sichten ---------- */
  function start() {
    const h = jget('rduellh', []), c = cur(), offen = c && c.ende == null && M.lies(c.code) && rest(c) > 0;
    let x = `<div class="card pl"><h4>Rechen-Duell</h4><div class="big">Wer rechnet besser?</div>
      <p style="margin:8px 0">Alle bekommen dieselben Aufgaben mit denselben Zahlen. Wer mehr richtig hat, gewinnt. Bei Gleichstand gewinnt die kürzere Zeit.</p>
      <ol class="stp"><li>Einer tippt auf „Neues Duell“ und zeigt den Code.</li><li>Alle anderen tippen auf „Beitreten“ und geben den Code ein.</li><li>Zählt gemeinsam 3, 2, 1 und tippt alle zugleich auf „Start“.</li><li>Am Ende vergleicht ihr die Ergebniscodes. Wer mehr richtig hat, gewinnt. Bei gleich vielen richtigen gewinnt, wer schneller fertig war.</li></ol>
      <div class="btns"><button class="btn pri" data-rd="neu">⚔️ Neues Duell</button><button class="btn" data-rd="bei">Beitreten</button>${offen ? '<button class="btn" data-rd="weiter">Laufende Runde fortsetzen</button>' : ''}${c && c.ende != null ? '<button class="btn" data-rd="letzte">Letztes Ergebnis</button>' : ''}</div>
      <p class="hint2">Im Duell gibt es keine Tipps und je Aufgabe nur einen Versuch. Den Lösungsweg siehst du nach der Runde. Taschenrechner und Tabellenbuch sind erlaubt.</p></div>`;
    if (h.length) x += '<div class="gh">Deine letzten Runden</div>' + h.slice(0, 8).map(e => `<div class="row rd-h"><div class="grow"><b>${e.richtig} von ${e.n} richtig</b><small>${esc(M.zeit(e.sek))} min · ${esc(e.code)}</small></div></div>`).join('');
    V().innerHTML = x;
  }
  function neu() {
    const w = Z.wahl;
    V().innerHTML = `<div class="card pl"><h4>Rechen-Duell</h4><div class="big">Neues Duell</div>
      <p class="rd-l">Aufgaben aus</p>${seg('st', [[1, '1. Lehrjahr'], [2, 'bis 2. Lehrjahr'], [3, 'alle']], w.st)}
      <p class="rd-l">Anzahl der Aufgaben</p>${seg('n', M.ANZ.map(n => [n, String(n)]), w.n)}
      <p class="rd-l">Zeit</p>${seg('min', M.MIN.map(n => [n, n + ' min']), w.min)}
      <div class="btns"><button class="btn pri" data-rd="code">Code erzeugen</button><button class="btn" data-rd="start0">Zurück</button></div>
      <p class="hint2">Die Einstellung steckt im Code. Wer beitritt, muss nichts einstellen.</p></div>`;
  }
  function bei() {
    V().innerHTML = `<div class="card pl"><h4>Rechen-Duell</h4><div class="big">Beitreten</div>
      <label class="f"><span>Code der Runde (zum Beispiel R47-1A2B3)</span><input id="rdCode" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(Z.code)}"></label>
      <p class="rd-err" role="alert">${esc(Z.err)}</p>
      <div class="btns"><button class="btn pri" data-rd="join">Weiter</button><button class="btn" data-rd="scan">📷 QR-Code scannen</button><button class="btn" data-rd="start0">Zurück</button></div></div>`;
  }
  function bereit() {
    const r = M.lies(Z.code), c = cur(), schon = c && c.code === r.code && c.ende != null;
    V().innerHTML = `<div class="card pl" style="border-color:var(--accent)"><h4>Rechen-Duell · bereit</h4><div class="rd-code" id="rdCodeBig">${esc(r.code)}</div><div class="rd-qr" id="rdQr"></div>
      <p style="margin:8px 0;text-align:center"><b>${esc(info(r))}</b></p>
      <p class="hint2">Zeig diesen Code allen, die mitmachen. Die anderen tippen im Rechen-Lab auf „Duell“, dann auf „Beitreten“. Wenn alle so weit sind: gemeinsam 3, 2, 1 zählen und zugleich auf „Start“ tippen.</p>
      ${schon ? '<p class="rd-err" role="alert">Diese Runde hast du schon gerechnet. Noch einmal zählt nicht als faires Duell, weil du die Aufgaben kennst.</p>' : ''}
      <div class="btns"><button class="btn pri" data-rd="go">▶ Start</button><button class="btn" data-rd="start0">Zurück</button></div></div>`;
    qrInto(doc.getElementById('rdQr'), r.code);
  }
  function lauf() {
    const c = cur(), ps = aufgaben(c.code), i = c.ans.length, p = ps[i], U = ui();
    V().innerHTML = `<div class="card pl" style="border-color:var(--accent)"><div class="rd-top"><span>Aufgabe <b>${i + 1}</b> von ${ps.length}</span><span class="rd-uhr" id="rdUhr" role="timer">⏱ ${esc(M.zeit(rest(c)))}</span><span>✓ <b>${nOk(c)}</b></span></div>
      <div class="rd-bar"><i style="width:${Math.round(100 * i / ps.length)}%"></i></div>
      <h4>${esc(p.cat)}</h4><div class="big">${esc(p.title)}</div><p style="margin:8px 0">${esc(p.text)}</p>${p.svg && U.svgTri ? `<div class="svbox">${U.svgTri(p.svg)}</div>` : ''}${p.skizze && U.svgSkizze ? `<div class="svbox">${U.svgSkizze(p.skizze)}</div>` : ''}
      <label class="f"><span>${esc(p.label)}${p.unit ? ' (' + esc(p.unit) + ')' : ''}</span><div class="qin"><input id="rdIn" inputmode="${p.bruch ? 'text' : 'decimal'}" autocomplete="off" enterkeyhint="go"><span class="u">${esc(p.unit)}</span></div></label>
      <p class="lr-hinweis">${p.bruch ? 'Bruch mit Schrägstrich, vollständig gekürzt, zum Beispiel 5/8 oder 1 3/8.' : (p.unit ? 'Zahl in ' + esc(p.unit) + '. ' : 'Zahl. ') + (p.exact ? 'Das Ergebnis muss genau stimmen.' : '±' + esc(C.fmt(p.tol, 6)) + ' gilt als richtig.')} Du hast einen Versuch.</p>
      <div class="btns"><button class="btn pri" data-rd="ant">Weiter ▶</button><button class="btn" data-rd="skip">Überspringen</button><button class="btn" data-rd="ab">${Z.ab ? 'Wirklich abbrechen?' : 'Abbrechen'}</button></div></div>`;
    const e = doc.getElementById('rdIn'); if (e) try { e.focus({ preventScroll: true }); } catch (x) {}
    uhr();
  }
  function uhr() {
    clearInterval(Z.tick);
    Z.tick = setInterval(() => {
      const c = cur(); if (Z.sicht !== 'lauf' || !c || c.ende != null) { clearInterval(Z.tick); return; }
      const r = rest(c), u = doc.getElementById('rdUhr'); if (u) { u.textContent = '⏱ ' + M.zeit(r); u.classList.toggle('knapp', r <= 30); }
      if (r <= 0) schluss(true);
    }, 250);
  }
  function antwort(skip) {
    const c = cur(); if (!c || c.ende != null) return; if (rest(c) <= 0) { schluss(true); return; }
    const ps = aufgaben(c.code), p = ps[c.ans.length], e = doc.getElementById('rdIn'), t = skip ? '' : (e ? e.value.trim() : ''), A = C.antwort(p, t);
    if (!skip && !isFinite(A.v)) { toast(p.bruch ? 'Bitte gib einen Bruch ein, zum Beispiel 5/8 oder 1 3/8, oder überspringe die Aufgabe.' : 'Bitte gib eine Zahl ein (mit Komma oder Punkt) oder überspringe die Aufgabe.'); return; }
    const ok = !skip && A.ok; c.ans.push({ t, ok: ok ? 1 : 0 }); jset('rduell', c); Z.ab = 0;
    snd(ok ? 'ding' : 'sad'); toast(skip ? 'Übersprungen.' : ok ? '✓ Richtig.' : '✗ Leider falsch.');
    if (c.ans.length >= ps.length) schluss(false); else lauf();
  }
  function schluss(zeitUm) {
    clearInterval(Z.tick); const c = cur(); if (!c || c.ende != null) return; const r = M.lies(c.code);
    c.ende = zeitUm ? r.min * 60 : Math.min(r.min * 60, Math.max(1, Math.round((Date.now() - c.start) / 1000))); c.zeitUm = zeitUm ? 1 : 0; jset('rduell', c);
    const h = jget('rduellh', []); h.unshift({ code: c.code, richtig: nOk(c), n: r.n, sek: c.ende, t: Date.now() }); jset('rduellh', h.slice(0, 20));
    if (zeitUm) toast('Die Zeit ist um.'); try { if (root.LochFX && root.LochFX.pass && nOk(c) === r.n) root.LochFX.pass(100); } catch (e) {}
    Z.sicht = 'ende'; render(true);
  }
  function ende() {
    const c = cur(), r = M.lies(c.code), ps = aufgaben(c.code), fp = M.abdruck(ps), ich = { richtig: nOk(c), sek: c.ende, name: kuerzel() || 'DU', ich: 1 }, mein = M.ergebnis(c.code, ich.richtig, ich.sek, kuerzel(), fp);
    const geg = (c.gegner || []).map(g => M.liesErgebnis(g, fp, c.code)).filter(g => g.ok && !(g.richtig === ich.richtig && g.sek === ich.sek && g.name === kuerzel() && kuerzel()));
    const alle = [ich].concat(geg).sort(M.vergleich), platz = alle.indexOf(ich) + 1, gleich = alle.filter(a => M.vergleich(a, alle[0]) === 0).length > 1;
    let x = `<div class="card pl" style="border-color:var(--accent)"><h4>Rechen-Duell · Ergebnis</h4><div class="rd-erg"><b>${ich.richtig}</b> von ${r.n} richtig</div><p style="text-align:center;margin:4px 0">Zeit: <b>${esc(M.zeit(c.ende))} min</b>${c.zeitUm ? ' (Zeit abgelaufen)' : ''} · ${esc(r.code)}</p>`;
    if (geg.length) {
      /* Gleich viele richtig: wer schneller fertig war, liegt vorn (M.vergleich). Das sagen wir auch dazu. */
      const nb = platz === 1 ? alle[1] : alle[platz - 2], zeitEnt = nb && nb.richtig === ich.richtig && nb.sek !== ich.sek, dt = nb ? M.zeit(Math.abs(nb.sek - ich.sek)) : '';
      const wer = a => a.ich ? 'du' : (a.name || 'Gegner');
      const sieg = platz === 1 ? (gleich ? 'Unentschieden: gleich viele richtig in derselben Zeit.' : '🏆 Du hast gewonnen.' + (zeitEnt ? ' Gleich viele richtig wie ' + wer(nb) + ', aber du warst ' + dt + ' min schneller.' : ''))
        : 'Platz ' + platz + ' von ' + alle.length + '.' + (zeitEnt ? ' Gleich viele richtig wie ' + wer(nb) + ', aber ' + wer(nb) + ' war ' + dt + ' min schneller.' : '');
      x += `<div class="rdout ${platz === 1 ? 'ok' : 'bad'}" id="rdSieg"><b>${esc(sieg)}</b></div>
        <div class="fw"><table class="rd-t"><thead><tr><th>Platz</th><th>Wer</th><th>Richtig</th><th>Zeit</th></tr></thead><tbody>${alle.map((a, i) => `<tr${a.ich ? ' class="ich"' : ''}><td>${i + 1}</td><td>${esc(a.ich ? (kuerzel() || 'Du') + ' (du)' : a.name || 'Gegner')}</td><td>${a.richtig} von ${r.n}</td><td>${esc(M.zeit(a.sek))}</td></tr>`).join('')}</tbody></table></div><p class="lr-hinweis">Wer mehr richtig hat, gewinnt. Bei gleich vielen richtigen gewinnt, wer schneller fertig war.</p>`;
    }
    x += `<p class="rd-l">Dein Ergebniscode</p><div class="rd-code klein" id="rdMein">${esc(mein)}</div><div class="rd-qr" id="rdQr"></div>
      <label class="f"><span>Ergebniscode der anderen eintippen oder scannen</span><input id="rdGeg" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
      <p class="rd-err" role="alert">${esc(Z.err)}</p>
      <div class="btns"><button class="btn pri" data-rd="geg">Vergleichen</button><button class="btn" data-rd="gscan">📷 Scannen</button><button class="btn" data-rd="neu">Neues Duell</button><button class="btn" data-rd="start0">Zur Übersicht</button></div></div>`;
    x += '<div class="gh">Deine Aufgaben mit Lösungsweg</div>' + ps.map((p, i) => {
      const a = c.ans[i], sol = p.sol || C.fmt(p.value, Math.max(p.dec, 0)) + (p.unit ? ' ' + p.unit : '');
      return `<details class="rd-d ${a && a.ok ? 'ok' : 'bad'}"><summary><span class="dot ${a && a.ok ? 'g' : ''}">${a && a.ok ? '✓' : '✗'}</span> <b>${i + 1}. ${esc(p.title)}</b> <small>${a ? (a.t ? 'deine Antwort: ' + esc(a.t) : 'übersprungen') : 'nicht mehr geschafft'} · richtig: ${esc(sol)}</small></summary><p style="margin:8px 0">${esc(p.text)}</p><ol class="stp">${p.steps.map((s, k) => `<li${k === p.steps.length - 1 ? ' class="res"' : ''}>${esc(s)}</li>`).join('')}</ol></details>`;
    }).join('');
    V().innerHTML = x; qrInto(doc.getElementById('rdQr'), mein);
  }
  function gegner(txt) {
    const c = cur(); if (!c) return; const fp = M.abdruck(aufgaben(c.code)), g = M.liesErgebnis(txt, fp, c.code);
    if (!g.ok) { Z.err = g.why; ende(); return; }
    const code = M.ergebnis(g.code, g.richtig, g.sek, g.name, fp); c.gegner = (c.gegner || []).filter(x => x !== code); c.gegner.push(code); c.gegner = c.gegner.slice(-30); jset('rduell', c); Z.err = ''; ende();
    const s = doc.getElementById('rdSieg'); if (s) try { s.scrollIntoView({ block: 'center' }); } catch (e) {}
  }
  function beitreten(txt) {
    const r = M.lies(txt); if (!r) { Z.err = 'Diesen Code kenne ich nicht. Er sieht so aus: R47-1A2B3.'; Z.code = String(txt || '').trim(); Z.sicht = 'bei'; render(); return; }
    Z.err = ''; Z.code = r.code; Z.sicht = 'bereit'; render(true);
  }
  function los() {
    const r = M.lies(Z.code); if (!r) return; const ps = aufgaben(r.code); if (!ps.length) { toast('Für diese Runde gibt es keine Aufgaben.'); return; }
    jset('rduell', { code: r.code, start: Date.now(), ans: [] }); Z.ab = 0; Z.sicht = 'lauf'; snd('tick'); render(true);
  }

  function render(top) {
    const v = V(); if (!v) return; const c = cur();
    if (Z.sicht === 'lauf' && (!c || c.ende != null)) Z.sicht = 'start';
    if (Z.sicht === 'lauf' && rest(c) <= 0) { schluss(true); return; }
    if (Z.sicht === 'ende' && (!c || c.ende == null)) Z.sicht = 'start';
    ({ start, neu, bei, bereit, lauf, ende })[Z.sicht]();
    if (top) { const pg = doc.getElementById('pg_duell'); if (pg) pg.scrollTop = 0; }
  }

  doc.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#v_duell button'); if (!b) return; const ds = b.dataset;
    if (ds.rdw) { Z.wahl[ds.rdw] = +ds.v; jset('rduellw', Z.wahl); neu(); return; }
    const a = ds.rd; if (!a) return;
    if (a !== 'ab') Z.ab = 0;
    if (a === 'neu') { Z.err = ''; Z.sicht = 'neu'; render(true); }
    else if (a === 'bei') { Z.err = ''; Z.code = ''; Z.sicht = 'bei'; render(true); }
    else if (a === 'start0') { Z.err = ''; Z.sicht = 'start'; render(true); }
    else if (a === 'code') { Z.code = M.neu(Z.wahl); Z.sicht = 'bereit'; render(true); }
    else if (a === 'join') beitreten((doc.getElementById('rdCode') || {}).value);
    /* Scanner: true = Code passt, Scanner schließt sich; Text = Hinweis im Scanner, weiter scannen (sonst meldete der Scanner einen Fehler, obwohl der Code schon übernommen war) */
    else if (a === 'scan') scan(t => M.lies(t) ? (beitreten(t), true) : 'Das ist kein Code für das Rechen-Duell. Er sieht so aus: R47-1A2B3.');
    else if (a === 'go') los();
    else if (a === 'weiter') { Z.sicht = 'lauf'; render(true); }
    else if (a === 'letzte') { Z.err = ''; Z.sicht = 'ende'; render(true); }
    else if (a === 'ant') antwort(false);
    else if (a === 'skip') antwort(true);
    else if (a === 'ab') { if (Z.ab) { clearInterval(Z.tick); const c = cur(); if (c) { c.ende = Math.max(1, Math.min(M.lies(c.code).min * 60, Math.round((Date.now() - c.start) / 1000))); c.abbruch = 1; jset('rduell', c); } Z.ab = 0; Z.sicht = 'ende'; render(true); } else { Z.ab = 1; b.textContent = 'Wirklich abbrechen?'; } }
    else if (a === 'geg') gegner((doc.getElementById('rdGeg') || {}).value);
    else if (a === 'gscan') scan(t => { const c = cur(); if (!c) return true; const g = M.liesErgebnis(t, M.abdruck(aufgaben(c.code)), c.code); if (!g.ok) return g.why; gegner(t); return true; });
  });
  doc.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target || !e.target.id) return; const id = e.target.id;
    if (id === 'rdIn') { e.preventDefault(); antwort(false); } else if (id === 'rdCode') { e.preventDefault(); beitreten(e.target.value); } else if (id === 'rdGeg') { e.preventDefault(); gegner(e.target.value); }
  });

  /* Einstieg: ?duell=neu oder ?duell=<Code> */
  function einstieg(q) {
    if (!q) return false; const r = M.lies(q);
    if (r) { Z.code = r.code; Z.sicht = 'bereit'; } else Z.sicht = 'neu';
    return true;
  }
  root.MatDuellUI = { render: () => { const c = cur(); if (Z.sicht === 'start' && c && c.ende == null && M.lies(c.code) && rest(c) > 0 && c.ans.length < aufgaben(c.code).length) Z.sicht = 'lauf'; render(true); }, einstieg, zustand: () => Z };
})(typeof window !== 'undefined' ? window : globalThis);
