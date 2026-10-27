'use strict';
/* Tonfunk Prüfungs-Lab: Oberfläche.
   Probeprüfung (20 Aufgaben mit Zeitlimit, Note nach IHK-Schlüssel), Training je Thema und Rechenserie, Auswertung mit Schwachstellen,
   Formelsammlung und Aufgaben. Zustand in „pr.state“: hist (Probeprüfungen), best (bestes Ergebnis je Thema), tr (Antworten je Thema),
   streak (Rechenserie), exam (laufende Prüfung), train (laufendes Training), rep (Wiederholstufe je Thema, für die Lernempfehlung), w24 (Selbsteinschätzung der Papier-Probeprüfung, zählt nicht).
   Prüfungsmodus (ab v23.145): Prüfungsart wählen (Kurz-Probe, Kammeraufbau, Eigener Mix), Sprungleiste, „Später“-Markierung, Pause nur im Ausbildermodus, Formelsammlung während der Prüfung gesperrt,
   Auswertung nach Thema und Niveau mit „Nächste Schritte“. Ziehlogik und Auswertung stehen in pruefexam.js, Lernempfehlung in coach.js. Alle Aufgaben sind eigene Formulierungen. */
(function (root) {
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const B = root.PR_BANK, TOPICS = B.TOPICS, TOP = Object.fromEntries(TOPICS.map(t => [t.k, t]));
  const LABPAGE = { sch: 'schaltplan.html', sim: 'simlab.html', digi: 'digilab.html', mess: 'messlab.html', code: 'codelab.html', haus: 'hauslab.html', loch: 'layout.html' };
  const newS = () => ({ hist: [], best: {}, tr: {}, rep: {}, streak: { cur: 0, best: 0 }, exam: null, train: null, answers: {}, flags: {} });
  const X = root.PR_EXAM, Co = root.Coach;   // Ziehlogik (pruefexam.js) und Lernempfehlung (coach.js); ohne sie läuft das Lab wie bisher


  /* ---------------- Prüfungs-Pool im Stil der Kammer (Teil 1, Teil 2 Systementwurf und Funktions- und Systemanalyse) ---------------- */
  const POOL = root.PR_POOL || { groups: [], q: [] };
  POOL.groups.forEach(g => { TOP['p:' + g.k] = { k: 'p:' + g.k, t: g.t, icon: g.icon, lab: g.lab, labN: g.labN, pool: true }; });
  TOP['p:alle'] = { k: 'p:alle', t: 'Prüfungs-Pool gemischt', icon: '🎓', lab: 'sch', labN: 'SchaltLab', pool: true };   // alte Schlüssel bleiben, damit gespeicherte Stände weiterlaufen
  /* Zwei getrennte Bereiche: Teil 1 und Teil 2 (Systementwurf und Funktions- und Systemanalyse). Pool-Themen gibt es je Bereich. */
  const AREAS = { teil1: { t: 'Teil 1', n: '1', pool: ['Teil1'], vars: ['teil1'], info: 'Teil 1 der Abschlussprüfung nach 18 Monaten (90 Minuten).' }, teil2: { t: 'Teil 2', n: '2', pool: ['SysE', 'FuSa', 'WiSo'], vars: ['syse', 'fusa', 'wiso'], info: 'Teil 2 der Abschlussprüfung: Systementwurf, Funktions- und Systemanalyse (je 105 Minuten) und Wirtschafts- und Sozialkunde (60 Minuten).' } };
  const areaOfTeil = tl => (tl === 'Teil1' ? 'teil1' : 'teil2');
  const hasQ = (g, a) => POOL.q.some(p => (g === 'alle' ? p.teil !== 'WiSo' : p.g === g) && AREAS[a].pool.includes(p.teil));
  Object.keys(AREAS).forEach(a => {
    POOL.groups.forEach(g => { const k = 'p:' + g.k + '@' + AREAS[a].n; TOP[k] = { k, t: g.t, icon: g.icon, lab: g.lab, labN: g.labN, pool: true, area: a, g: g.k }; });
    const k = 'p:alle@' + AREAS[a].n; TOP[k] = { k, t: 'Prüfungs-Pool gemischt (' + AREAS[a].t + ')', icon: '🎓', lab: 'sch', labN: 'SchaltLab', pool: true, area: a, g: 'alle' };
  });
  let area = lsGet('pr.area', 'teil1'); if (!AREAS[area]) area = 'teil1';
  const ALLT = TOPICS.concat(Object.keys(AREAS).flatMap(a => POOL.groups.filter(g => hasQ(g.k, a)).map(g => TOP['p:' + g.k + '@' + AREAS[a].n])));
  const VARIANTS = {
    teil1: { t: 'Teil 1 (nach 18 Monaten)', pool: ['Teil1'], limit: 90, nA: 23, keep: 20, fix: 6, nB: 8, note: 'Teil A: 23 gebundene Aufgaben (20 bearbeiten, 3 abwählbar, 6 nicht abwählbar), Teil B: 8 Rechenaufgaben zu je 10 Punkten. Teil A und B zählen je 50 %.' },
    syse: { t: 'Teil 2: Systementwurf', pool: ['SysE'], limit: 105, nA: 28, keep: 25, fix: 8, nB: 8, note: 'Teil A: 28 gebundene Aufgaben (25 bearbeiten, 3 abwählbar, 8 nicht abwählbar), Teil B: 8 Rechenaufgaben zu je 10 Punkten. Teil A und B zählen je 50 %.' },
    wiso: { t: 'Teil 2: Wirtschafts- und Sozialkunde', pool: ['WiSo'], limit: 60, nA: 18, keep: 15, fix: 0, nB: 0, note: 'Wirtschafts- und Sozialkunde wie in der Prüfung: 18 gebundene Aufgaben mit je einer richtigen Antwort, 3 davon darfst du abwählen (15 zählen). Die ungebundenen Aufgaben mit freien Antworten in der echten Prüfung (6 Aufgaben, 5 davon bearbeiten) kann das Lab nicht automatisch bewerten, übe sie mit Stichworten auf Papier. Die Note richtet sich nach dem Anteil richtiger Antworten im gebundenen Teil.' },
    fusa: { t: 'Teil 2: Funktions- und Systemanalyse', pool: ['FuSa'], limit: 105, nA: 28, keep: 25, fix: 8, nB: 8, note: 'Teil A: 28 gebundene Aufgaben (25 bearbeiten, 3 abwählbar, 8 nicht abwählbar), Teil B: 8 Rechenaufgaben zu je 10 Punkten. Teil A und B zählen je 50 %.' }
  };
  function poolQ(p, r) {
    if (p.o) { const idx = r.shuffle([0, 1, 2, 3, 4]); return { id: p.id, k: 'p:' + p.g + '@' + AREAS[areaOfTeil(p.teil)].n, type: 'mc', q: p.q, opts: idx.map(i => p.o[i]), r: idx.indexOf(p.r), w: p.w, pts: 1, teil: p.teil, pool: true, niv: p.n }; }
    return { id: p.id, k: 'p:' + p.g + '@' + AREAS[areaOfTeil(p.teil)].n, type: 'num', q: p.q, ans: p.ans, unit: p.u, tol: p.tol, w: p.w, pts: 4, teil: p.teil, pool: true, niv: p.n };
  }
  function drawPool(g, n, seed, ar) { // g = Gruppe oder 'alle', ar = Bereich; etwa 60 % Mehrfachwahl, 40 % Rechnen
    const r = B.seeded(seed), src = POOL.q.filter(p => (g === 'alle' ? p.teil !== 'WiSo' : p.g === g) && (!ar || AREAS[ar].pool.includes(p.teil))), mc = r.shuffle(src.filter(p => p.o)), nu = r.shuffle(src.filter(p => !p.o));
    const wantN = Math.min(nu.length, Math.round(n * 0.4)), out = nu.slice(0, wantN).concat(mc.slice(0, n - wantN));
    if (out.length < n) out.push(...mc.slice(n - wantN).concat(nu.slice(wantN)).slice(0, n - out.length));
    return r.shuffle(out).map(p => poolQ(p, r));
  }

  /* ---------------- Zustand ---------------- */
  let S = Object.assign(newS(), lsGet('pr.state', {}));
  ['best', 'tr', 'answers', 'flags', 'rep'].forEach(k => { S[k] = S[k] || {}; }); S.hist = S.hist || []; S.streak = S.streak || { cur: 0, best: 0 };
  let testing = false;
  const persist = () => { if (!testing) lsSet('pr.state', S); };
  const RES = (ok, text, why) => ({ ok: !!ok, text, why: why || '' });
  const parse = s => { const x = parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; };
  const stat = (k, v, m) => { if (!testing && root.Badges) root.Badges.stat(k, v, m); };
  const pctOf = L => (L.length ? Math.round(100 * L.filter(x => x.ok).length / L.length) : 0);

  /* ---------------- Bewertung ---------------- */
  const NOTE = p => (p >= 92 ? [1, 'sehr gut'] : p >= 81 ? [2, 'gut'] : p >= 67 ? [3, 'befriedigend'] : p >= 50 ? [4, 'ausreichend'] : p >= 30 ? [5, 'mangelhaft'] : [6, 'ungenügend']);
  function isRight(q, a) {
    if (a == null || a === '') return false;
    if (q.type === 'mc') return a === q.r;
    const x = parse(a); if (isNaN(x)) return false;
    return q.tol === 0 ? Math.abs(x - q.ans) < 0.5 : Math.abs(x - q.ans) <= Math.max(q.tol * Math.abs(q.ans), 1e-9);
  }
  const ansText = q => (q.type === 'mc' ? q.opts[q.r] : B.de(B.sig(q.ans, 4)) + (q.unit ? ' ' + q.unit : ''));
  const yourText = (q, a) => (a == null || a === '' ? '(keine Antwort)' : q.type === 'mc' ? q.opts[a] : String(a) + (q.unit ? ' ' + q.unit : ''));
  function count(qs, ans) { // Punkte und Themen
    let pts = 0, max = 0; const tp = {};
    qs.forEach(q => { max += q.pts; const ok = isRight(q, ans[q.id]); if (ok) pts += q.pts; const t = tp[q.k] = tp[q.k] || [0, 0]; t[1]++; if (ok) t[0]++; });
    return { pts, max, topics: tp, pct: max ? Math.round(100 * pts / max) : 0 };
  }
  function addTr(tp) { const now = Date.now(); Object.keys(tp).forEach(k => { const t = S.tr[k] = S.tr[k] || { r: 0, n: 0 }; t.r += tp[k][0]; t.n += tp[k][1]; t.t = now; }); }   // t = letzte Übung (nur lokal, für die Lernempfehlung; der Export liest nur r und n)

  /* ---------------- Fenster und Meldungen ---------------- */
  function toast(t) { let e = $('#toast'); if (!e) { e = document.createElement('div'); e.id = 'toast'; document.body.appendChild(e); } e.textContent = t; e.className = 'show'; clearTimeout(toast.t); toast.t = setTimeout(() => { e.className = ''; }, 2600); }
  function sheet(title, fn) {
    const w = document.createElement('div'); w.className = 'backdrop'; w.innerHTML = '<div class="sheet"><div class="sh"><b>' + esc(title) + '</b><button class="x" aria-label="Schließen">✕</button></div><div class="sb"></div></div>';
    document.body.appendChild(w); const close = () => w.remove(); w.addEventListener('pointerdown', e => { if (e.target === w) close(); }); $('.x', w).onclick = close; fn($('.sb', w), close); return w;
  }
  root.LabUI = { sheet, toast }; root.sheet = sheet; root.toast = toast;
  { const st = document.createElement('style'); st.id = 'prExamCss'; st.textContent = `
    .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
    .fs{border:1px solid var(--line);border-radius:12px;margin:0 0 12px;padding:8px 12px;min-width:0}.fs legend{font-weight:700;padding:0 6px}
    .opt{display:flex;gap:10px;align-items:flex-start;min-height:44px;padding:8px 10px;margin:6px 0;border:1px solid var(--line);border-radius:10px;background:var(--panel2);color:var(--fg);font-size:14px;cursor:pointer}.opt input{width:22px;height:22px;margin:1px 0 0;flex:none}.opt:has(input:checked){border-color:var(--accent)}
    .opts{display:flex;flex-wrap:wrap;gap:8px}.opts .opt{margin:0;flex:1 1 150px}
    .chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.chp{display:flex;align-items:center;gap:8px;min-height:44px;padding:6px 12px;border:1px solid var(--line);border-radius:22px;background:var(--panel2);color:var(--fg);font-size:14px;cursor:pointer}.chp input{width:20px;height:20px;margin:0;flex:none}.chp:has(input:checked){border-color:var(--accent);background:rgba(59,158,255,.16)}
    .tmr .hrow{margin:0 0 6px;flex-wrap:wrap}.tmr .jrow{margin:0;flex-wrap:nowrap}.tmr .jrow label.inl{flex:none;min-height:44px;font-size:13px;color:var(--fg)}.tmr .jrow label.inl input{width:22px;height:22px}
    #exJump{display:flex;gap:6px;overflow-x:auto;flex:1;min-width:0;padding:3px 2px;-webkit-overflow-scrolling:touch}
    .jc{flex:none;min-width:44px;height:44px;padding:0 8px;border-radius:10px;border:2px solid var(--line);background:var(--panel2);color:var(--fg);font:600 14px system-ui;cursor:pointer}.jc.a{background:rgba(76,217,100,.2);border-color:rgba(76,217,100,.75)}.jc.m{border-style:dashed;border-color:var(--warn)}.jc[aria-current=true]{outline:3px solid var(--accent);outline-offset:1px}
    .pq[data-qid]{scroll-margin-top:190px}.pq .lt{min-height:44px;min-width:44px}.pq .lt.on{background:var(--warn);border-color:var(--warn);color:#14181c}
    .ns{margin:0;padding-left:20px}.ns li{margin:0 0 10px}.ns .btn{margin-top:6px}
    input[type=range]{padding:0;height:44px}
    @media(max-width:560px){.tmr .hrow .btn{min-height:44px}}
    .tmr .btn{min-height:44px}.tmr .hrow .grow{min-width:0}
    .fs .btn,.fs select,#exGo{min-height:44px}.pq label.ck{min-height:44px;align-items:center;padding:6px 0}.pq .numin{min-height:44px}.pq .pqh{justify-content:flex-start;align-items:center;gap:8px}.pq .pqh .mute{margin-right:auto}
  `; document.head.appendChild(st); }   // Stil für Auswahlmaske, Sprungleiste und Auswertung

  /* ---------------- Aufgaben ---------------- */
  const W = { RES, parse, TOPICS, get S() { return S; } };
  const DATA = root.PR_DATA(W), TASKS = DATA.TASKS, FORMELN = DATA.FORMELN;
  root.PR_TASKS = TASKS;
  const done = () => lsGet('sim.done', {});
  function markDone(id, pct) { try { const d = done(); if ((d[id] || 0) < pct) { d[id] = pct; localStorage.setItem('sim.done', JSON.stringify(d)); } } catch (e) {} if (root.Badges) root.Badges.result(id, pct); }
  async function runCheck(t) { try { return await t.check(); } catch (e) { return [RES(false, 'Die Prüfung ist abgestürzt: ' + (e && e.message || e))]; } }
  root.TaskTest = async only => {
    const ids = only || TASKS.map(t => t.id), out = []; const keep = S; testing = true;
    try {
      for (const id of ids) {
        const t = TASKS.find(x => x.id === id); if (!t) { out.push({ id, err: 'unbekannt' }); continue; }
        try { S = newS(); const a = pctOf(await runCheck(t)); S = newS(); t.sol(); const L = await runCheck(t), p = pctOf(L); out.push({ id, pct: p, startPct: a, bad: L.filter(x => !x.ok).map(x => x.text) }); } catch (e) { out.push({ id, err: String(e) }); }
      }
    } finally { S = keep; testing = false; }
    return out;
  };

  /* ---------------- Ansicht ---------------- */
  const TABS = [['start', 'Start'], ['pruefung', 'Probeprüfung'], ['training', 'Training'], ['auswertung', 'Auswertung'], ['formeln', 'Formeln'], ['aufgaben', 'Aufgaben']];
  let tab = 'start', openTaskId = null, timer = null, cleanup = null;
  function go(t, id) { if (t === 'formeln' && examLock()) { toast(LOCK_MSG); return; } tab = t; if (t === 'aufgaben') openTaskId = id || null; render(); window.scrollTo(0, 0); }
  function render() {
    if (timer) { clearInterval(timer); timer = null; } if (cleanup) { cleanup(); cleanup = null; }
    if (tab === 'formeln' && examLock()) tab = 'pruefung';
    $('#tabs').innerHTML = TABS.map(([k, n]) => '<button class="tab' + (tab === k ? ' on' : '') + '" data-t="' + k + '"' + (k === 'formeln' && examLock() ? ' aria-disabled="true" aria-label="Formeln, in der Prüfung gesperrt" title="In der Prüfung gesperrt"' : '') + '>' + (k === 'formeln' && examLock() ? '🔒 ' : '') + n + '</button>').join('');
    $$('#tabs .tab').forEach(b => { b.onclick = () => go(b.dataset.t); });
    areaBar();
    const v = $('#view'); ({ start: vStart, pruefung: vExam, training: vTrain, auswertung: vStats, formeln: vFormeln, aufgaben: vTasks })[tab](v);
    try { localStorage.setItem('pr.tab', tab); } catch (e) {}
  }
  function setArea(a) { if (!AREAS[a] || a === area) return; area = a; lsSet('pr.area', a); if (S.train) { S.train = null; persist(); } render(); }
  function areaBar() {   // Umschalter Teil 1 / Teil 2 über den Reitern; während einer laufenden Prüfung gesperrt
    let ab = $('#areabar'); if (!ab) { ab = document.createElement('div'); ab.id = 'areabar'; ab.style.cssText = 'display:flex;gap:8px;margin:8px 12px 0;flex-wrap:wrap;align-items:center'; $('#tabs').parentNode.insertBefore(ab, $('#tabs')); }
    const lock = !!(S.exam && !S.exam.done);
    ab.innerHTML = '<span class="mute small">Bereich:</span>' + Object.keys(AREAS).map(a => '<button class="btn' + (a === area ? ' pri' : '') + '" data-area="' + a + '"' + (lock && a !== area ? ' disabled' : '') + '>' + AREAS[a].t + '</button>').join('') + '<span class="mute small">' + esc(AREAS[area].info) + '</span>';
    $$('[data-area]', ab).forEach(b => { b.onclick = () => setArea(b.dataset.area); });
  }
  const bar = p => '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, p)) + '%"></i></div>';
  const topicStats = (all) => ALLT.filter(t => (all || !t.pool) && (!t.area || t.area === area)).map(t => { const s = S.tr[t.k] || { r: 0, n: 0 }; return { t, r: s.r, n: s.n, p: s.n ? Math.round(100 * s.r / s.n) : null, best: S.best[t.k] || 0 }; });
  const weakest = () => topicStats(true).filter(x => x.n >= 3).sort((a, b) => a.p - b.p)[0] || null;

  /* ----- Start ----- */
  function vStart(v) {
    const d = done(), n = TASKS.filter(t => (d[t.id] || 0) >= 100).length, ex = S.hist.filter(h => h.kind === 'exam'), last = ex[ex.length - 1], w = weakest();
    v.innerHTML = '<div class="card"><h2>Prüfungs-Lab: ' + AREAS[area].t + '</h2><p class="mute small">Teil 1 und Teil 2 sind getrennte Bereiche mit eigenen Prüfungen, Pool, Training und Auswertung. Wechsle oben mit „Bereich“.</p><p>Hier übst du für die <b>Abschlussprüfung</b> (Elektroniker/in für Geräte und Systeme): Aufgaben im Stil der schriftlichen Prüfung, mit Rechnen, Mehrfachwahl, Zeitlimit und Auswertung nach Themen. Alle Aufgaben sind eigene Übungsaufgaben und keine echten Kammer-Aufgaben.</p>'
      + '<div class="steps"><div><b>1</b> Themen üben<br><span class="mute small">Zehn Fragen mit Erklärung, je Thema.</span><br><button class="btn" data-g="training">Zum Training</button></div><div><b>2</b> Probeprüfung<br><span class="mute small">Kammeraufbau oder eigener Mix, Zeitlimit, Note.</span><br><button class="btn" data-g="pruefung">Zur Probeprüfung</button></div><div><b>3</b> Schwächen finden<br><span class="mute small">Auswertung und Lernempfehlung.</span><br><button class="btn" data-g="auswertung">Zur Auswertung</button></div></div></div>'
      + '<div class="card"><h3>Dein Stand</h3>' + bar(100 * n / TASKS.length) + '<p>' + n + ' von ' + TASKS.length + ' Aufgaben geschafft.' + (last ? ' Letzte Probeprüfung: <b>' + last.pct + ' %</b> (Note ' + last.note + ').' : ' Noch keine Probeprüfung.') + '</p>'
      + (w ? '<p>Schwächstes Thema bisher: <b>' + esc(w.t.t) + '</b> (' + w.p + ' % richtig). <button class="btn s" data-tr="' + w.t.k + '">Jetzt üben</button></p>' : '<p class="mute">Sobald du ein paar Fragen beantwortet hast, siehst du hier dein schwächstes Thema.</p>')
      + '<button class="btn pri" data-g="aufgaben">' + (n ? 'Weiter mit den Aufgaben' : 'Los geht’s mit den Aufgaben') + '</button></div>'
      + '<div class="card"><h3>Praktische Prüfungsvorbereitung in den anderen Labs</h3><p class="mute">Die Prüfung hat auch einen praktischen Teil. Diese Aufgaben üben Stromlaufpläne lesen, Messen, Löten und Programmieren im Stil der Prüfung:</p>'
      + '<ul><li><b>MessLab, Prüfungsschaltungen (Teil B):</b> LED und Vorwiderstand, Poti-Teiler, Verstärker mit Operationsverstärker, Spannungsfolger, Transistorschalter, Z-Diode, Regler 7805, Schutzdiode, Batterie-Innenwiderstand und drei Fehlersuchen. <a href="messlab.html?aufgabe=mp1">MessLab öffnen</a></li>'
      + '<li><b>Arduino-Lab, Prüfungspraxis:</b> Countdown mit Warnton, Luftampel mit Poti, Heizstufen mit entprelltem Taster, Fehlersuche im Würfel-Sketch. <a href="codelab.html?aufgabe=cp1">Arduino-Lab öffnen</a></li>'
      + '<li><b>LochLab, Fehlersuche an Prüfplatinen:</b> Lötbrücke am Netzteil, fehlende Leitung am MOSFET-Schalter und am 555-Blinker. <a href="layout.html?aufgabe=lf5">LochLab öffnen</a></li></ul></div>'
      + '<div class="card" id="w24"><h3>Praxisschaltung W-2024 verstehen</h3><p class="mute">Teil 2 der Prüfung enthält eine Praxisschaltung, die du lesen, aufbauen und prüfen musst. Diese Unterlagen führen dich Schritt für Schritt durch die Schaltung der Praxisprüfung W-2024:</p>'
      + '<ul><li><b>Erklärheft:</b> <a href="lernen-w24.html">Die Schaltung der Praxisprüfung W-2024 verstehen</a> (<a href="./tonfunk-lab-lernen-w24.pdf">PDF</a>)</li>'
      + '<li><b>Arbeitsblätter zum Ausdrucken (PDF):</b><ul><li><a href="./Arbeitsblatt-W24-Bus-Sensoren.pdf">Bus und Sensoren</a></li><li><a href="./Arbeitsblatt-W24-Energie.pdf">Energie</a></li><li><a href="./Arbeitsblatt-W24-Fehlersuche.pdf">Fehlersuche</a></li><li><a href="./Arbeitsblatt-W24-Meldeleuchten.pdf">Meldeleuchten</a></li><li><a href="./Arbeitsblatt-W24-Portexpander-K6.pdf">Portexpander K6</a></li><li><a href="./Arbeitsblatt-W24-Saegezahn-Heizung.pdf">Sägezahn und Heizung</a></li><li><a href="./Arbeitsblatt-W24-Takt-Lauflicht.pdf">Takt und Lauflicht</a></li></ul></li>'
      + '<li><b>Probeprüfung zum Ausdrucken:</b> <a href="./Probepruefung-W24.pdf">Probepruefung-W24.pdf</a></li></ul>'
      + '<p class="mute small">Die Lösungen sind für Ausbilder gedacht: <a href="loesungen.html">Lösungen für Ausbilder</a> (verschlüsselt, mit Ausbilder-Passwort).</p></div>'
      + '<div class="card warn"><h3>So nutzt du das Lab</h3><ul><li>Rechenaufgaben: Gib die Zahl in der Einheit an, die in der Frage steht. Abweichungen bis 2 % durch Runden gelten als richtig. Komma oder Punkt sind egal.</li><li>Die Note richtet sich nach dem IHK-Schlüssel: 100 bis 92 % = 1, ab 81 % = 2, ab 67 % = 3, ab 50 % = 4, ab 30 % = 5.</li><li>Im Tab „Formeln“ steht alles, was du zum Üben brauchst. Während einer Probeprüfung ist der Tab gesperrt, wie in der echten Prüfung (dort hast du nur das Tabellenbuch). Nach der Abgabe ist er wieder offen.</li></ul></div>';
    $$('[data-g]', v).forEach(b => { b.onclick = () => go(b.dataset.g); }); $$('[data-tr]', v).forEach(b => { b.onclick = () => { startTrain(b.dataset.tr); }; });
  }

  /* ----- Fragen darstellen ----- */
  function qHtml(q, i, ans, locked, show, opt) {   // opt = { flag } blendet in der laufenden Prüfung den Knopf „Später“ ein
    const a = ans[q.id], ok = show && isRight(q, a);
    let h = '<div class="pq' + (show ? (ok ? ' okq' : ' noq') : '') + '" data-qid="' + esc(q.id) + '"><div class="pqh"><span class="chip">' + esc(TOP[q.k].icon + ' ' + TOP[q.k].t) + '</span><span class="mute small">' + (q.part ? 'Teil ' + q.part + ' · ' + (q.pts > 1 ? q.pts + ' Punkte' : '1 Punkt') : q.pts + ' Punkte') + '</span>' + (opt ? '<button type="button" class="btn s lt' + (opt.flag ? ' on' : '') + '" data-flag="' + esc(q.id) + '" aria-pressed="' + (opt.flag ? 'true' : 'false') + '">⚑ ' + (opt.flag ? 'Markiert' : 'Später') + '</button>' : '') + '</div><b>' + (i != null ? (typeof i === 'number' ? i + 1 : i) + '. ' : '') + esc(q.q) + '</b>';
    if (q.type === 'mc') h += q.opts.map((o, k) => '<label class="ck' + (show && k === q.r ? ' rightopt' : '') + '"><input type="radio" name="q_' + q.id + '" data-q="' + q.id + '" value="' + k + '"' + (a === k ? ' checked' : '') + (locked ? ' disabled' : '') + '> ' + esc(o) + '</label>').join('');
    else h += '<div class="row"><input class="numin" inputmode="decimal" data-n="' + q.id + '" placeholder="Zahl eingeben" value="' + esc(a == null ? '' : a) + '"' + (locked ? ' disabled' : '') + ' autocomplete="off"><span class="unit">' + esc(q.unit) + '</span></div>';
    if (show) h += '<div class="rl ' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓ Richtig.' : '✗ Deine Antwort: ' + esc(yourText(q, a)) + '. Richtig: ' + esc(ansText(q)) + '.') + '</div><div class="why">' + esc(q.w) + '</div>';
    return h + '</div>';
  }
  function bindInputs(v, ans, onChange) {
    $$('input[data-q]', v).forEach(c => { c.onchange = () => { ans[c.dataset.q] = +c.value; onChange(); }; });
    $$('input[data-n]', v).forEach(c => { c.oninput = () => { ans[c.dataset.n] = c.value; onChange(); }; });
  }

  /* ----- Ausbildermodus (nur Pause und „ohne Zeitlimit“): dieselbe Freigabe wie bei den Lösungen (sessionStorage lm4.god; im Code steht nur der Hash) ----- */
  const GODH = 'a2fdecf55d194ed8cea8d52d7d0442778e86180b6d81c6c37e56278e55add6c6';
  const godOk = () => { try { return sessionStorage.getItem('lm4.god') === GODH; } catch (e) { return false; } };
  async function sha256(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  function godGate() {
    sheet('Ausbildermodus', (b, close) => {
      b.innerHTML = '<p class="mute small">Nur für Ausbilder: In der Probeprüfung kannst du dann pausieren und die Zeit abschalten. Das Passwort ist dasselbe wie bei den Lösungen.</p><label>Passwort<input id="gPw" type="password" autocomplete="off" autocapitalize="off" spellcheck="false"></label><div class="row"><button class="btn pri" id="gOk">Freigeben</button></div>';
      const go = async () => { const pw = $('#gPw', b).value.trim(); if (!(root.crypto && crypto.subtle)) { toast('Bitte die Seite über https öffnen'); return; } if (await sha256(pw) === GODH) { try { sessionStorage.setItem('lm4.god', GODH); } catch (e) {} close(); toast('Ausbildermodus an'); render(); } else { toast('Passwort falsch'); $('#gPw', b).select(); } };
      $('#gOk', b).onclick = go; $('#gPw', b).onkeydown = ev => { if (ev.key === 'Enter') go(); };
    });
  }
  const examLock = () => !!(S.exam && !S.exam.done && !godOk());   // Formelsammlung gesperrt, solange eine Prüfung läuft (außer Ausbildermodus)
  const LOCK_MSG = 'In der Prüfung gibt es keine Formelsammlung. Nach der Abgabe kannst du sie wieder öffnen.';

  /* ----- Zeit der laufenden Prüfung: Start + Pausen, alles über Date.now(), Tabwechsel und Sperrbildschirm ändern nichts ----- */
  const pausedSum = (e, now) => { const p = e.paused || { at: null, sum: 0 }; return (p.sum || 0) + (p.at ? now - p.at : 0); };
  const elapsedMs = (e, now) => Math.max(0, now - e.start - pausedSum(e, now));
  const leftMs = (e, now) => (e.limit > 0 ? e.limit * 60000 - elapsedMs(e, now) : Infinity);
  function setPause(e, on) { const now = Date.now(); e.paused = e.paused || { at: null, sum: 0 }; if (on && !e.paused.at) e.paused.at = now; if (!on && e.paused.at) { e.paused.sum = (e.paused.sum || 0) + now - e.paused.at; e.paused.at = null; } persist(); }

  /* ----- Probeprüfung ----- */
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };
  const examBase = o => Object.assign({ ans: {}, start: Date.now(), done: false, flags: {}, tq: {}, paused: { at: null, sum: 0 } }, o);
  function startExam(limit) { const seed = Date.now() % 1000000000; S.exam = examBase({ v: 'kurz', seed, qs: B.exam(seed, 20), limit }); persist(); render(); }
  const allGroups = teile => [...new Set(POOL.q.filter(p => teile.includes(p.teil)).map(p => p.g))];
  function startOrig(v, limit, gpo) { // Prüfungsaufbau wie in der Kammerprüfung: Teil A gebunden mit Abwahl, Teil B Rechenaufgaben; Ziehen mit Niveau-Quote über pruefexam.js
    const c = gpo ? Object.assign({}, VARIANTS[v], { pool: ['SysE', 'FuSa'] }) : VARIANTS[v], seed = gpo ? gpo.seed : Date.now() % 1000000000, r = B.seeded(seed), gs = allGroups(c.pool), cfg = { teil: c.pool, groups: gs, niveau: 'mix' };
    const A = X.draw(POOL, Object.assign({ n: c.nA, only: 'mc' }, cfg), seed).items.map(p => poolQ(p, r));
    const Bq = c.nB ? X.draw(POOL, Object.assign({ n: c.nB, only: 'num' }, cfg), seed + 7).items.map(p => poolQ(p, r)) : [];
    A.forEach(q => { q.pts = 1; q.part = 'A'; }); Bq.forEach(q => { q.pts = 10; q.part = 'B'; });
    const fix = r.shuffle(A.map((q, i) => i)).slice(0, c.fix);
    S.exam = Object.assign(examBase({ v, seed, qs: A.concat(Bq), limit: limit == null ? c.limit : limit, orig: { keep: c.keep, fix, skip: {} }, cfg: Object.assign(X.cfgShort({ groups: gs, niveau: 'mix', n: A.length + Bq.length }), gpo ? { gp: 1, seed } : {}), area: gpo ? 'teil2' : area }), gpo ? { gp: 1 } : {}); persist(); render();
  }
  /* Generalprobe (Karriere): Kammeraufbau Teil 2 (Systementwurf + Funktions- und Systemanalyse), fester Seed aus der URL, keine Pause, kein Zeitlimit-Aus */
  function startGP(seed) { area = 'teil2'; lsSet('pr.area', area); startOrig('syse', null, { seed: Math.abs(parseInt(seed, 10)) % 1000000000 }); }
  /* Eigener Mix: c = { groups, n, calc (0 bis 1), niveau, weak (ja/nein), limit (Minuten, 0 = ohne Zeit) }; jede Aufgabe zählt einen Punkt */
  function startMix(c) {
    const seed = Date.now() % 1000000000, r = B.seeded(seed ^ 0x2545F491);
    const d = X.draw(POOL, { teil: AREAS[area].pool, groups: c.groups, n: c.n, calcShare: c.calc, niveau: c.niveau, weak: c.weak ? X.weakMap(S.tr, AREAS[area].n) : null }, seed);
    if (d.items.length < 5) { toast('Mit dieser Auswahl gibt es zu wenige Aufgaben. Wähle mehr Themen.'); return false; }
    const qs = d.items.map(p => { const q = poolQ(p, r); q.pts = 1; q.part = p.o ? 'A' : 'B'; return q; });
    S.exam = examBase({ v: 'mix', seed, qs, limit: c.limit, mix: true, area, cfg: X.cfgShort({ groups: c.groups, niveau: c.niveau, n: qs.length }), meta: d.meta }); persist(); render(); return true;
  }
  function origScore(e) {
    const A = e.qs.filter(q => q.part === 'A'), Bq = e.qs.filter(q => q.part === 'B'), o = e.orig, allow = A.length - o.keep, fixIds = new Set(o.fix.map(i => A[i].id));
    const skip = Object.keys(o.skip).filter(id => o.skip[id] && !fixIds.has(id)).slice(0, allow);
    const rest = A.filter(q => !fixIds.has(q.id) && !skip.includes(q.id)), auto = allow - skip.length > 0 ? rest.slice(-(allow - skip.length)) : [];
    const dropped = new Set(skip.concat(auto.map(q => q.id)));
    const counted = A.filter(q => !dropped.has(q.id)), okA = counted.filter(q => isRight(q, e.ans[q.id])).length, okB = Bq.filter(q => isRight(q, e.ans[q.id])).length;
    const pA = counted.length ? okA / counted.length : 0, pB = Bq.length ? okB / Bq.length : 0, tp = {};   // ohne Teil B (WiSo) zählt Teil A allein
    counted.concat(Bq).forEach(q => { const t = tp[q.k] = tp[q.k] || [0, 0]; t[1]++; if (isRight(q, e.ans[q.id])) t[0]++; });
    return { pct: Bq.length ? Math.round(50 * pA + 50 * pB) : Math.round(100 * pA), pts: okA + okB * 10, max: counted.length + Bq.length * 10, topics: tp, a: [okA, counted.length], b: [okB, Bq.length], dropped: [...dropped] };
  }
  const scoreOf = e => (e.orig ? origScore(e) : count(e.qs, e.ans));
  const TASKFOR = { teil1: 'pr14', syse: 'pr15', fusa: 'pr16' };
  function finishExam(auto) {
    const e = S.exam; if (!e || e.done) return; if (e.paused && e.paused.at) setPause(e, false);
    const c = scoreOf(e), n = NOTE(c.pct), now = Date.now(), rp = X ? X.report(e, NOTE, { isRight, score: scoreOf }) : null;
    e.done = true; e.res = { pts: c.pts, max: c.max, pct: c.pct, note: n[0], noteT: n[1], topics: c.topics, secs: Math.round(elapsedMs(e, now) / 1000), auto: !!auto, a: c.a || (e.mix && rp ? rp.byTeil.A : undefined), b: c.b || (e.mix && rp ? rp.byTeil.B : undefined), dropped: c.dropped };
    if (rp) { e.res.byNiveau = rp.byNiveau; e.res.byTeil = rp.byTeil; e.res.slow = rp.slow; e.res.unanswered = rp.unanswered; e.res.marked = rp.marked; }
    const h = { kind: 'exam', v: e.v || 'kurz', area: (e.v === 'teil1' ? 'teil1' : e.v === 'syse' || e.v === 'fusa' ? 'teil2' : e.v === 'mix' ? (e.area || 'beide') : 'beide'), t: now, pct: c.pct, pts: c.pts, max: c.max, note: n[0], secs: e.res.secs, topics: c.topics };
    if (rp) h.byNiveau = rp.byNiveau; if (e.cfg) h.cfg = e.cfg;
    S.hist.push(h); addTr(c.topics);
    stat('prExam', 1); persist(); render(); if (c.pct >= 50 && !testing) toast('Bestanden: ' + c.pct + ' % (Note ' + n[0] + ')');
  }
  const VNAME = v => (v === 'kurz' || !v ? 'Kurz-Probe' : v === 'mix' ? 'Eigener Mix' : VARIANTS[v] ? VARIANTS[v].t : String(v));
  const answered = (e, q) => e.ans[q.id] != null && e.ans[q.id] !== '';
  /* Beschriftung in der Sprungleiste und vor der Aufgabe: bei Teil A/B „A1“, „B1“, sonst die laufende Nummer */
  function qLabel(e, q, i) { if (!(e.orig || e.mix)) return String(i + 1); const l = e.qs.filter(x => x.part === (q.part === 'B' ? 'B' : 'A')); return (q.part === 'B' ? 'B' : 'A') + (l.indexOf(q) + 1); }
  function qRun(e, q, i, locked, show, opt) { // Frage mit Teil-Überschrift, Abwahl und „Später“
    const A = e.qs.filter(x => x.part === 'A'), ia = A.indexOf(q), ib = e.qs.filter(x => x.part === 'B').indexOf(q); let h = '';
    if (e.orig && i === 0) h += '<div class="card"><b>Teil A: gebundene Aufgaben</b><div class="mute small">Je Aufgabe 1 Punkt, genau eine Antwort richtig. ' + (A.length - e.orig.keep) + ' Aufgaben darfst du abwählen, ' + e.orig.fix.length + ' sind nicht abwählbar. Wählst du weniger ab, zählen die letzten abwählbaren Aufgaben nicht.</div></div>';
    if (e.orig && q.part === 'B' && ib === 0) h += '<div class="card"><b>Teil B: ungebundene Aufgaben</b><div class="mute small">Rechenaufgaben zu je 10 Punkte. Gib das Endergebnis in der angegebenen Einheit ein. Teil A und Teil B zählen je 50 %.</div></div>';
    if (e.mix && q.part === 'A' && ia === 0) h += '<div class="card"><b>Teil A: Mehrfachwahl</b><div class="mute small">Genau eine Antwort ist richtig. Jede Aufgabe zählt einen Punkt.</div></div>';
    if (e.mix && q.part === 'B' && ib === 0) h += '<div class="card"><b>Teil B: Rechenaufgaben</b><div class="mute small">Gib das Endergebnis in der angegebenen Einheit ein. Jede Aufgabe zählt einen Punkt.</div></div>';
    let b = qHtml(q, (e.orig || e.mix) ? qLabel(e, q, i) : i, e.ans, locked, show, opt && opt.flag ? { flag: !!(e.flags && e.flags[q.id]) } : null);
    if (e.orig && q.part === 'A') {
      const fix = e.orig.fix.includes(ia), sk = !!e.orig.skip[q.id];
      b = b.slice(0, -6) + (fix ? '<div class="mute small">nicht abwählbar</div>' : (show ? (sk || (e.res && e.res.dropped && e.res.dropped.includes(q.id)) ? '<div class="warnt small">Diese Aufgabe wurde nicht gewertet (abgewählt).</div>' : '') : '<label class="ck"><input type="checkbox" data-skip="' + q.id + '"' + (sk ? ' checked' : '') + '> Diese Aufgabe abwählen (nicht bearbeiten)</label>')) + '</div>';
    }
    return h + b;
  }

  /* Papier-Probeprüfung W-2024 (Teil B Praxis): Aufgaben und Punkte aus Probepruefung-W24.pdf, 100 Punkte, 90 Minuten Übungsvorgabe */
  const W24 = [['Aufbau und Signalweg', 12], ['Versorgung', 14], ['Takt und Lauflicht', 14], ['Steuerspannung', 14], ['Heizungssteuerung', 14], ['Bus und Sensoren', 12], ['Erweiterung Meldeleuchten', 10], ['Fehleranalyse', 10]];
  const w24Pts = per => Math.round(W24.reduce((s, t, i) => s + t[1] * Math.max(0, Math.min(100, +per[i] || 0)) / 100, 0) * 10) / 10;

  /* ---- Auswahlmaske (Schritte 1 bis 3) ---- */
  function vExamStart(v) {
    const gs = POOL.groups.filter(g => hasQ(g.k, area)), gcount = g => POOL.q.filter(p => AREAS[area].pool.includes(p.teil) && p.g === g.k).length, isGod = godOk();
    const arts = [['kurz', 'Kurz-Probe', '20 Aufgaben aus allen acht Themen der Fragenbank (Grundlagen)'], ...AREAS[area].vars.map(x => [x, VARIANTS[x].t + ' nach Prüfungsaufbau', VARIANTS[x].limit + ' Minuten, Teil A und Teil B wie in der Prüfung']), ['mix', 'Eigener Mix', 'Du wählst Themen, Schwierigkeit und Anzahl'], ['w24', 'Teil-B-Praxis W-2024 (Papier)', 'Praxisschaltung auf Papier, 90 Minuten, mit Selbsteinschätzung (zählt nicht in die Note)']];
    const radio = (name, items, def) => '<div class="opts">' + items.map(([val, t]) => '<label class="opt"><input type="radio" name="' + name + '" value="' + val + '"' + (String(val) === String(def) ? ' checked' : '') + '><span>' + esc(t) + '</span></label>').join('') + '</div>';
    const w = S.w24;
    v.innerHTML = '<div class="card"><h2>Probeprüfung: ' + AREAS[area].t + '</h2>'
      + '<fieldset class="fs"><legend>1. Prüfungsart</legend>' + arts.map(([k, t, d], i) => '<label class="opt"><input type="radio" name="exV" value="' + k + '"' + (i === 0 ? ' checked' : '') + '><span><b>' + esc(t) + '</b><br><span class="mute small">' + esc(d) + '</span></span></label>').join('') + '<p id="exNote" class="mute small"></p></fieldset>'
      + '<fieldset class="fs" id="exMix" hidden><legend>2. Mischung</legend><p class="mute small" style="margin-top:0">Themenpakete wählen oder einzelne Themen ankreuzen (die Zuordnung der Pakete zu den Lernfeldern ist vorläufig). Themen mit wenig Fragen sind markiert.</p>'
      + '<div class="row" id="exPk">' + X.PAKETE.map(p => '<button type="button" class="btn s" data-pk="' + p.k + '">' + esc(p.t) + '</button>').join('') + '</div>'
      + '<div class="chips" role="group" aria-label="Themen">' + gs.map(g => { const c = gcount(g); return '<label class="chp"><input type="checkbox" data-g="' + g.k + '"' + (g.k === 'wiso' ? '' : ' checked') + '><span>' + esc(g.icon + ' ' + g.t) + (c < 10 ? ' <span class="warnt">(wenig Fragen: ' + c + ')</span>' : '') + '</span></label>'; }).join('') + '</div>'
      + '<div class="mute small" style="margin-top:8px">Schwierigkeit</div>' + radio('exNv', [['leicht', 'leicht'], ['mix', 'wie Prüfung (leicht, mittel, schwer gemischt)'], ['schwer', 'schwer']], 'mix')
      + '<div class="mute small" style="margin-top:8px">Anzahl der Aufgaben</div>' + radio('exN', [[10, '10'], [20, '20'], [40, '40']], 20)
      + '<div class="mute small" style="margin-top:8px">Anteil Rechnen</div>' + radio('exC', [[0, '0 %'], [40, '40 %'], [60, '60 %']], 40)
      + '<label class="ck"><input type="checkbox" id="exWeak" checked> Schwache Themen stärker gewichten (aus deinem bisherigen Stand)</label></fieldset>'
      + '<fieldset class="fs" id="exDur"><legend>3. Dauer</legend><label>Zeit<select id="exT"></select></label><p class="mute small" id="exTn"></p>' + (isGod ? '<label class="ck"><input type="checkbox" id="exNoT"> Ohne Zeitlimit (Ausbildermodus)</label>' : '') + '</fieldset>'
      + '<div class="row"><button class="btn pri" id="exGo">Prüfung starten</button></div><p class="mute small" id="exInfo">Du kannst frei zwischen den Aufgaben springen, Aufgaben für später markieren und jederzeit abgeben. Läuft die Zeit ab, wird automatisch abgegeben. Erlaubt sind Taschenrechner und Tabellenbuch. Die Formelsammlung ist während der Prüfung gesperrt, wie in der echten Prüfung.</p></div>'
      + '<div class="card" id="exW24" hidden><h3>Teil-B-Praxis W-2024 (Papier)</h3><p>Diese Probeprüfung machst du auf Papier: <a href="./Probepruefung-W24.pdf">Probepruefung-W24.pdf</a> (8 Aufgaben, 100 Punkte). Als Übungsvorgabe nimm dir 90 Minuten. Die Schaltung dazu erklärt das <a href="lernen-w24.html">Heft zur Praxisprüfung W-2024</a>. Die Lösungen bekommst du von deinem Ausbilder (<a href="loesungen.html">Lösungen für Ausbilder</a>).</p>'
      + '<p class="mute small">Nach dem Korrigieren kannst du dir hier eintragen, wie viel du je Aufgabe geschafft hast. Das ist nur eine Orientierung für dich: Es zählt <b>nicht</b> in Note, Verlauf und Statistik.</p>'
      + W24.map((t, i) => '<label>' + (i + 1) + '. ' + esc(t[0]) + ' (' + t[1] + ' Punkte): <b><span data-w24o="' + i + '">' + ((w && w.per && w.per[i]) || 0) + '</span> %</b><input type="range" min="0" max="100" step="5" value="' + ((w && w.per && +w.per[i]) || 0) + '" data-w24="' + i + '" aria-label="Aufgabe ' + (i + 1) + ' ' + esc(t[0]) + ', ' + t[1] + ' Punkte, geschafft in Prozent"></label>').join('')
      + '<p id="w24Sum" role="status"></p><div class="row"><button class="btn" id="w24Save">Selbsteinschätzung merken</button></div>' + (w && w.t ? '<p class="mute small">Zuletzt gemerkt am ' + new Date(w.t).toLocaleDateString('de-DE') + ': ' + w.pts + ' von 100 Punkten (etwa Note ' + w.note + '). Nur ein Hinweis, nicht gewertet.</p>' : '') + '</div>'
      + '<div class="card warn"><b>Hinweis zum Prüfungs-Pool:</b> Die Aufgaben von Teil 1 und Teil 2 sind eigene Übungsaufgaben im Stil der Kammerprüfungen. Sie wurden mit KI erstellt und sind vom Ausbilder noch nicht fachlich freigegeben. Bei Zweifeln zählt das Tabellenbuch.</div>'
      + '<div class="card"><div class="row small mute">' + (isGod ? '<span>Ausbildermodus an: Pause und „ohne Zeitlimit“ sind möglich.</span><button class="btn s" id="godOff">Beenden</button>' : '<button class="btn s" id="godOn">Ausbildermodus (Passwort)</button><span>Nur für Ausbilder: Pause und Prüfung ohne Zeit.</span>') + '</div></div>'
      + (S.hist.filter(inArea).length ? '<div class="card"><h3>Bisherige Prüfungen</h3>' + histHtml() + '</div>' : '');
    const val = n => { const x = $('input[name="' + n + '"]:checked', v); return x ? x.value : ''; }, picked = () => $$('input[data-g]:checked', v).map(x => x.dataset.g);
    const mixCnt = () => { const n = +val('exN') || 20, c = (+val('exC') || 0) / 100, nB = Math.round(n * c); return [n - nB, nB]; };
    const fixSel = (id, opts, sel) => { const s = $(id, v); s.innerHTML = opts.map(o => '<option value="' + o[0] + '"' + (String(o[0]) === String(sel) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join(''); };
    const upd = () => {
      const vv = val('exV'), mix = vv === 'mix', kurz = vv === 'kurz', w24 = vv === 'w24';
      $('#exMix', v).hidden = !mix; $('#exW24', v).hidden = !w24; $('#exDur', v).hidden = w24; $('#exGo', v).hidden = w24; $('#exInfo', v).hidden = w24;
      $('#exNote', v).textContent = kurz ? '20 Aufgaben aus allen acht Themen: Rechenaufgaben (4 Punkte) und Mehrfachwahl (2 Punkte).' : mix ? 'Jede Aufgabe zählt einen Punkt. Die Note richtet sich nach dem Anteil der Punkte (IHK-Schlüssel). Gezogen wird nach Themen im Verhältnis des Prüfungspools, schwache Themen etwas häufiger.' : w24 ? '' : VARIANTS[vv].note;
      const tn = $('#exTn', v), noT = $('#exNoT', v);
      if (kurz) { fixSel('#exT', [[30, '30 Minuten (kurz)'], [45, '45 Minuten'], [60, '60 Minuten (wie in der Prüfung)'], [90, '90 Minuten (mit Reserve)']], 60); tn.textContent = ''; }
      else if (mix) { const [a, b] = mixCnt(), sug = X.suggestLimit(a, b); fixSel('#exT', [[sug, 'Vorschlag: ' + sug + ' Minuten'], [15, '15 Minuten'], [30, '30 Minuten'], [45, '45 Minuten'], [60, '60 Minuten'], [90, '90 Minuten'], [105, '105 Minuten']].filter((o, i, l) => i === 0 || o[0] !== sug), sug); tn.textContent = 'Vorschlag: 2,5 Minuten je Mehrfachwahl-Aufgabe, 6 Minuten je Rechenaufgabe.'; }
      else if (VARIANTS[vv]) { fixSel('#exT', [[VARIANTS[vv].limit, VARIANTS[vv].limit + ' Minuten (wie in der Prüfung)']], VARIANTS[vv].limit); tn.textContent = ''; }
      $('#exT', v).disabled = !!(noT && noT.checked) || !!VARIANTS[vv];
    };
    $$('input[name="exV"], input[name="exN"], input[name="exC"]', v).forEach(x => { x.onchange = upd; }); if ($('#exNoT', v)) $('#exNoT', v).onchange = upd; upd();
    $$('[data-pk]', v).forEach(b => { b.onclick = () => { const pk = X.PAKETE.find(p => p.k === b.dataset.pk); $$('input[data-g]', v).forEach(x => { x.checked = pk.groups.includes(x.dataset.g); }); }; });
    $('#exGo', v).onclick = () => {
      const vv = val('exV'), noT = $('#exNoT', v) && $('#exNoT', v).checked && godOk(), lim = noT ? 0 : +$('#exT', v).value;
      if (vv === 'kurz') startExam(lim); else if (vv === 'mix') { const gl = picked(); if (!gl.length) { toast('Wähle mindestens ein Thema'); return; } startMix({ groups: gl, n: +val('exN') || 20, calc: (+val('exC') || 0) / 100, niveau: val('exNv') || 'mix', weak: !!$('#exWeak', v).checked, limit: lim }); } else startOrig(vv, noT ? 0 : null);
    };
    const sum = () => { const per = $$('input[data-w24]', v).map(x => +x.value), pts = w24Pts(per), n = NOTE(pts); $$('input[data-w24]', v).forEach(x => { $('[data-w24o="' + x.dataset.w24 + '"]', v).textContent = x.value; }); $('#w24Sum', v).textContent = 'Zusammen: ' + pts + ' von 100 Punkten (etwa Note ' + n[0] + ', ' + n[1] + '). Nur ein Hinweis, nicht gewertet.'; return { per, pts, n }; };
    $$('input[data-w24]', v).forEach(x => { x.oninput = sum; }); sum();
    $('#w24Save', v).onclick = () => { const r = sum(); S.w24 = { t: Date.now(), per: r.per, pts: r.pts, pct: r.pts, note: r.n[0] }; persist(); toast('Gemerkt (zählt nicht in die Note)'); render(); };
    if ($('#godOn', v)) $('#godOn', v).onclick = godGate; if ($('#godOff', v)) $('#godOff', v).onclick = () => { try { sessionStorage.removeItem('lm4.god'); } catch (e) {} render(); };
  }

  /* ---- Ergebnis ---- */
  const NIV_T = { 1: 'leicht (Niveau 1)', 2: 'mittel (Niveau 2)', 3: 'schwer (Niveau 3)' };
  function nextStepsHtml(steps) {
    return '<div class="card"><h3>Nächste Schritte</h3><ol class="ns">' + steps.map(s => '<li><b>' + esc(s.title) + '</b><div class="small">' + esc(s.text) + '</div>' + (s.art === 'thema' ? '<button class="btn s" data-tr="' + esc(s.k) + '">Thema üben</button>' : s.act === 'formeln' ? '<button class="btn s" data-go="formeln">Formeln öffnen</button>' : s.href ? '<a class="btn s" href="' + esc(s.href) + '">Öffnen</a>' : '') + '</li>').join('') + '</ol></div>';
  }
  function vExamDone(v, e) {
    const r = e.res, c = r.pct >= 50, nv = r.byNiveau, steps = Co ? Co.afterExam(r.topics, Co.read(lsGet), { AUFGABEN: root.AUFGABEN, LAB_REG: root.LAB_REG, groups: POOL.groups, topics: TOPICS }) : [];
    v.innerHTML = '<div class="card"><h2>Ergebnis: ' + esc(VNAME(e.v)) + '</h2><div class="pct ' + (c ? 'g' : '') + '">' + r.pct + ' %</div><p><b>Note ' + r.note + ' (' + r.noteT + ')</b> · ' + (r.a ? 'Teil A: ' + r.a[0] + ' von ' + r.a[1] + ' gewerteten Aufgaben richtig · Teil B: ' + r.b[0] + ' von ' + r.b[1] + ' Aufgaben richtig' + (e.orig ? ' (je 10 Punkte)' : '') : r.pts + ' von ' + r.max + ' Punkten') + ' · Zeit: ' + mmss(r.secs * 1000) + (e.limit ? ' von ' + e.limit + ' Minuten' : ' (ohne Zeitlimit)') + (r.auto ? ' (Zeit abgelaufen)' : '') + '</p><p class="' + (c ? 'good' : 'bad') + '">' + (c ? 'Bestanden (ab 50 %).' : 'Noch nicht bestanden (ab 50 %). Übe die schwachen Themen und versuche es erneut.') + '</p>'
      + (r.unanswered && r.unanswered.length ? '<p class="warnt small">' + r.unanswered.length + ' gewertete Aufgabe(n) hast du nicht beantwortet.</p>' : '') + (r.slow && r.slow.length ? '<p class="mute small">Viel Zeit gebraucht hast du bei: ' + r.slow.map(id => { const q = e.qs.find(x => x.id === id); return q ? 'Aufgabe ' + qLabel(e, q, e.qs.indexOf(q)) : ''; }).filter(Boolean).join(', ') + '. Die Zeiten bleiben auf deinem Gerät.</p>' : '') + '</div>'
      + '<div class="card"><h3>Ergebnis nach Themen</h3>' + ALLT.filter(t => r.topics[t.k]).map(t => { const x = r.topics[t.k], p = Math.round(100 * x[0] / x[1]); return '<div class="tp"><div>' + esc(t.icon + ' ' + t.t) + ' <span class="mute small">(' + x[0] + ' von ' + x[1] + ')</span></div>' + bar(p) + '<div class="row"><span class="small ' + (p >= 70 ? 'good' : p >= 50 ? 'warnt' : 'bad') + '">' + p + ' %</span>' + (p < 70 ? '<button class="btn s" data-tr="' + t.k + '">Thema üben</button>' : '') + '</div></div>'; }).join('') + '</div>'
      + (nv && [1, 2, 3].some(k => nv[k] && nv[k][1]) ? '<div class="card"><h3>Ergebnis nach Schwierigkeit</h3>' + [1, 2, 3].filter(k => nv[k][1]).map(k => { const p = Math.round(100 * nv[k][0] / nv[k][1]); return '<div class="tp"><div>' + NIV_T[k] + ' <span class="mute small">(' + nv[k][0] + ' von ' + nv[k][1] + ')</span></div>' + bar(p) + '<div class="small ' + (p >= 70 ? 'good' : p >= 50 ? 'warnt' : 'bad') + '">' + p + ' %</div></div>'; }).join('') + '</div>' : '')
      + (steps.length ? nextStepsHtml(steps) : '')
      + '<div class="card"><h3>Alle Aufgaben mit Lösung</h3>' + e.qs.map((q, i) => qRun(e, q, i, true, true)).join('') + '<div class="row"><button class="btn pri" id="exNew">Neue Probeprüfung</button><button class="btn" id="exSend">Ergebnis abgeben</button></div></div>';
    $('#exNew').onclick = () => { S.exam = null; persist(); render(); };
    $('#exSend').onclick = () => { if (!c) { toast('Erst eine bestandene Probeprüfung (ab 50 %) kann abgegeben werden'); return; } const id = TASKFOR[e.v] || 'pr10', t = TASKS.find(x => x.id === id); markDone('pr10', 100); if (id !== 'pr10') markDone(id, 100); if (root.Auswertung) root.Auswertung.handIn(id, 100, t ? t.title : 'Probeprüfung'); };
    $$('[data-tr]', v).forEach(b => { b.onclick = () => startTrain(b.dataset.tr); }); $$('[data-go]', v).forEach(b => { b.onclick = () => go(b.dataset.go); });
  }

  /* ---- laufende Prüfung ---- */
  function vExamRun(v, e) {
    const isGod = godOk() && !e.gp; if (e.paused && e.paused.at && !isGod) setPause(e, false);   // ohne Ausbildermodus gibt es keine Pause, in der Generalprobe nie
    const paused = !!(e.paused && e.paused.at), act = e.qs.filter(q => !(e.orig && e.orig.skip[q.id]));
    v.innerHTML = '<div class="card tmr" id="exHead"><div class="row hrow"><b id="exTimer" role="timer">' + (paused ? 'Pausiert' : 'Restzeit: <span id="exLeft">' + (e.limit ? mmss(leftMs(e, Date.now())) : 'ohne Limit') + '</span>') + '</b>' + (e.gp ? '<span class="small"><b>Generalprobe</b> (ohne Pause)</span>' : '') + '<span class="mute small" id="exCnt"></span><span class="grow"></span>' + (isGod ? '<button class="btn s" id="exPause">' + (paused ? 'Weiter' : 'Pause') + '</button>' : '') + '<button class="btn pri" id="exFin">Abgeben</button></div>'
      + (paused ? '' : '<div class="row jrow"><div id="exJump" role="toolbar" aria-label="Aufgabe wählen">' + e.qs.map((q, i) => '<button type="button" class="jc" data-j="' + esc(q.id) + '">' + esc(qLabel(e, q, i)) + '</button>').join('') + '</div><label class="inl"><input type="checkbox" id="exOnly"> nur offene</label></div>') + '<div class="sr" id="exAnn" role="status" aria-live="polite"></div></div>'
      + (paused ? '<div class="card"><h3>Die Prüfung ist pausiert</h3><p>Die Zeit steht. Die Aufgaben sind ausgeblendet, bis du auf „Weiter“ drückst.</p><div class="row"><button class="btn pri" id="exResume">Weiter</button></div></div>' : e.qs.map((q, i) => qRun(e, q, i, false, false, { flag: true })).join('') + '<div class="card"><button class="btn pri" id="exFin2">Prüfung abgeben</button></div>');
    const doPause = on => { const y = window.scrollY; setPause(e, on); render(); window.scrollTo(0, on ? 0 : y); };
    const fin = () => { const open = act.filter(q => !answered(e, q)).length, mk = act.filter(q => e.flags && e.flags[q.id]).length; const msg = open > 0 ? open + ' Aufgabe(n) sind noch offen' + (mk ? ' und ' + mk + ' markiert' : '') + '. Trotzdem abgeben?' : mk > 0 ? mk + ' Aufgabe(n) sind noch für später markiert. Trotzdem abgeben?' : ''; if (msg && !confirm(msg)) return; finishExam(false); };
    $('#exFin').onclick = fin; if ($('#exFin2')) $('#exFin2').onclick = fin; if ($('#exPause')) $('#exPause').onclick = () => doPause(!paused); if ($('#exResume')) $('#exResume').onclick = () => doPause(false);
    if (paused) return;
    const cnt = () => { const a = act.filter(q => answered(e, q)).length, m = act.filter(q => e.flags && e.flags[q.id]).length; $('#exCnt').textContent = a + ' von ' + act.length + ' beantwortet' + (m ? ' · ' + m + ' markiert' : ''); };
    const chips = $$('.jc', v), qEl = id => v.querySelector('.pq[data-qid="' + id + '"]');
    const updChips = () => chips.forEach((c, i) => { const q = e.qs[i], a = answered(e, q), m = !!(e.flags && e.flags[q.id]); c.classList.toggle('a', a); c.classList.toggle('m', m); c.textContent = qLabel(e, q, i) + (m ? ' ⚑' : ''); c.setAttribute('aria-label', 'Aufgabe ' + qLabel(e, q, i) + ', ' + (a ? 'beantwortet' : 'offen') + (m ? ', für später markiert' : '')); });
    const upd = () => { cnt(); updChips(); persist(); }; upd();
    bindInputs(v, e.ans, upd);
    $$('input[data-skip]', v).forEach(c => { c.onchange = () => { const allow = e.qs.filter(q => q.part === 'A').length - e.orig.keep, cur = Object.keys(e.orig.skip).filter(k => e.orig.skip[k]).length; if (c.checked && cur >= allow) { c.checked = false; toast('Es dürfen höchstens ' + allow + ' Aufgaben abgewählt werden'); return; } e.orig.skip[c.dataset.skip] = c.checked; persist(); }; });
    $$('[data-flag]', v).forEach(b => { b.onclick = () => { const id = b.dataset.flag; e.flags = e.flags || {}; if (e.flags[id]) delete e.flags[id]; else e.flags[id] = 1; const on = !!e.flags[id]; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.textContent = on ? '⚑ Markiert' : '⚑ Später'; b.classList.toggle('on', on); upd(); }; });
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    chips.forEach(c => { c.onclick = () => { const el = qEl(c.dataset.j); if (!el) return; el.hidden = false; const hd = $('#exHead'); el.style.scrollMarginTop = ((hd ? hd.getBoundingClientRect().bottom : 160) + 10) + 'px'; el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }); const i = el.querySelector('input:not([type=checkbox])'); if (i) { try { i.focus({ preventScroll: true }); } catch (x) { i.focus(); } } cur = c.dataset.j; mark(); }; });
    const only = $('#exOnly'); only.onchange = () => { $$('.pq[data-qid]', v).forEach(el => { const q = e.qs.find(x => x.id === el.dataset.qid); el.hidden = only.checked && answered(e, q) && !(e.flags && e.flags[q.id]); }); };
    /* aktuelle Aufgabe: die erste sichtbare unter der Kopfleiste (für aria-current und die Zeit je Aufgabe) */
    let cur = e.qs[0] && e.qs[0].id;
    const mark = () => chips.forEach(c => { if (c.dataset.j === cur) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current'); });
    const find = () => { const y = ($('#exHead') ? $('#exHead').getBoundingClientRect().bottom : 0) + 30; const el = $$('.pq[data-qid]', v).find(x => !x.hidden && x.getBoundingClientRect().bottom > y); if (el) { cur = el.dataset.qid; mark(); } };
    let raf = 0; const onScroll = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; find(); }); };
    window.addEventListener('scroll', onScroll, { passive: true }); cleanup = () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
    v.addEventListener('focusin', ev => { const p = ev.target.closest && ev.target.closest('.pq[data-qid]'); if (p) { cur = p.dataset.qid; mark(); } });
    mark(); find();
    /* Zeitanzeige, Hinweise bei 5 und 1 Minute, Zeit je Aufgabe (nur lokal), automatische Abgabe */
    let last = Date.now(), acc = 0, ticks = 0, a5 = leftMs(e, last) <= 300000, a1 = leftMs(e, last) <= 60000;
    const tick = () => {
      const n = Date.now(), dt = n - last; last = n; const l = leftMs(e, n), el = $('#exLeft');
      if (el && e.limit) { el.textContent = mmss(l); el.parentNode.className = l < 300000 ? 'warnt' : ''; }
      if (e.limit && l <= 300000 && !a5) { a5 = true; $('#exAnn').textContent = 'Noch 5 Minuten.'; }
      if (e.limit && l <= 60000 && !a1) { a1 = true; $('#exAnn').textContent = 'Noch eine Minute.'; }
      if (cur && dt < 5000 && document.visibilityState !== 'hidden') { acc += dt; while (acc >= 1000) { acc -= 1000; e.tq = e.tq || {}; e.tq[cur] = (e.tq[cur] || 0) + 1; } }
      if (++ticks % 10 === 0) persist();
      if (e.limit && l <= 0) { clearInterval(timer); timer = null; finishExam(true); }
    };
    timer = setInterval(tick, 1000);
    if (e.limit && leftMs(e, Date.now()) <= 0) { clearInterval(timer); timer = null; finishExam(true); }
  }
  function vExam(v) {
    const e = S.exam;
    if (!e) return vExamStart(v);
    if (e.done) return vExamDone(v, e);
    vExamRun(v, e);
  }
  const inArea = h => !h.area || h.area === 'beide' || h.area === area;
  function histHtml() {
    return S.hist.filter(inArea).slice(-10).reverse().map(h => '<div class="li"><span>' + new Date(h.t).toLocaleDateString('de-DE') + ' · ' + esc(VNAME(h.v)) + '</span><span><b>' + h.pct + ' %</b> · Note ' + h.note + '</span></div>').join('');
  }

  /* ----- Training ----- */
  function startTrain(k, mode) {
    const seed = Date.now() % 1000000000;
    if (mode === 'serie') S.train = { k: null, mode: 'serie', qs: [], i: 0, ans: {}, shown: false, right: 0, seed };
    else if (String(k).startsWith('p:')) { const mm = String(k).match(/^p:(.+)@(\d)$/), qs = drawPool(mm ? mm[1] : k.slice(2), 10, seed, mm ? (mm[2] === '1' ? 'teil1' : 'teil2') : area); S.train = { k, mode: 'mix', qs, i: 0, ans: {}, shown: false, right: 0, seed }; }
    else { const qs = B.draw(k === 'alle' ? null : k, 10, seed, 'mix'); S.train = { k: k === 'alle' ? null : k, mode: 'mix', qs, i: 0, ans: {}, shown: false, right: 0, seed }; }
    tab = 'training'; if (mode === 'serie') nextSerie(); persist(); render(); window.scrollTo(0, 0);
  }
  function nextSerie() { const t = S.train; const q = B.draw(null, 1, Math.floor(Math.random() * 1e9), 'rechnen')[0]; t.qs = [q]; t.i = 0; t.shown = false; t.ans = {}; }
  function vTrain(v) {
    const t = S.train;
    if (!t) {
      const ts = topicStats();
      v.innerHTML = '<div class="card"><h2>Training</h2><p>Wähle ein Thema: Du bekommst zehn Fragen (Rechnen und Mehrfachwahl) und nach jeder Antwort sofort die Erklärung. Für die Aufgaben im Lab brauchst du pro Thema 80 % in einem Durchgang.</p><div class="tgrid">'
        + ts.map(x => '<button class="tbtn" data-k="' + x.t.k + '"><span class="ti1">' + x.t.icon + '</span><b>' + esc(x.t.t) + '</b><span class="mute small">' + (x.n ? x.p + ' % richtig (' + x.n + ' Fragen)' : 'noch nicht geübt') + (x.best >= 80 ? ' · ✓ 80 % geschafft' : '') + '</span></button>').join('') + '</div>'
        + '<h3>Prüfungs-Pool ' + AREAS[area].t + ' im Stil der Kammer</h3><p class="mute small">Aufgaben im Stil von ' + AREAS[area].t + ' (KI-Entwurf, noch nicht fachlich freigegeben). Nach Prüfungsthemen:</p><div class="tgrid">' + POOL.groups.filter(g => hasQ(g.k, area)).map(g => { const kk = 'p:' + g.k + '@' + AREAS[area].n, s = S.tr[kk] || { r: 0, n: 0 }; return '<button class="tbtn" data-k="' + kk + '"><span class="ti1">' + g.icon + '</span><b>' + esc(g.t) + '</b><span class="mute small">' + (s.n ? Math.round(100 * s.r / s.n) + ' % richtig (' + s.n + ' Fragen)' : 'noch nicht geübt') + '</span></button>'; }).join('') + '</div>'
        + '<div class="row"><button class="btn" data-k="p:alle@' + AREAS[area].n + '">🎓 Pool ' + AREAS[area].t + ' gemischt</button><button class="btn" data-k="alle">🎲 Alle Themen gemischt</button><button class="btn" id="serie">🔥 Rechenserie (endlos)</button></div><p class="mute small">Rechenserie: Immer neue Rechenaufgaben aus allen Themen. Eine falsche Antwort setzt die Serie zurück. Rekord: ' + (S.streak.best || 0) + '.</p></div>';
      $$('[data-k]', v).forEach(b => { b.onclick = () => startTrain(b.dataset.k); }); $('#serie').onclick = () => startTrain(null, 'serie'); return;
    }
    const q = t.qs[t.i];
    if (t.mode === 'mix' && t.i >= t.qs.length) { // Zusammenfassung
      const c = count(t.qs, t.ans), p = c.pct, nR = t.qs.filter(x => isRight(x, t.ans[x.id])).length, pq = Math.round(100 * nR / t.qs.length);
      v.innerHTML = '<div class="card"><h2>Ergebnis</h2><div class="pct ' + (pq >= 80 ? 'g' : '') + '">' + pq + ' %</div><p>' + nR + ' von ' + t.qs.length + ' Fragen richtig' + (t.k ? '' : ' (gemischt)') + '. ' + (t.k ? (pq >= 80 ? '<b class="good">Geschafft: 80 % erreicht.</b>' : 'Für die Aufgabe brauchst du 80 %.') : '') + '</p><div class="row"><button class="btn pri" id="tAgain">Noch ein Durchgang</button><button class="btn" id="tNew">Anderes Thema</button></div></div>'
        + '<div class="card"><h3>Alle Fragen mit Lösung</h3>' + t.qs.map((x, i) => qHtml(x, i, t.ans, true, true)).join('') + '</div>';
      $('#tAgain').onclick = () => startTrain(t.k || 'alle'); $('#tNew').onclick = () => { S.train = null; persist(); render(); }; return;
    }
    const a = t.ans[q.id], head = t.mode === 'serie' ? '<h2>🔥 Rechenserie</h2><p>Serie: <b>' + S.streak.cur + '</b> · Rekord: <b>' + S.streak.best + '</b> (verlangt: 10 in Folge)</p>' : '<h2>' + (t.k ? esc(TOP[t.k].icon + ' ' + TOP[t.k].t) : '🎲 Gemischt') + '</h2><p class="mute">Frage ' + (t.i + 1) + ' von ' + t.qs.length + '</p>' + bar(100 * t.i / t.qs.length);
    v.innerHTML = '<div class="card"><button class="btn s" id="tLeave">← Abbrechen</button>' + head + qHtml(q, null, t.ans, t.shown, t.shown) + (t.shown ? '<div class="row"><button class="btn pri" id="tNext">' + (t.mode === 'serie' ? 'Nächste Aufgabe' : t.i + 1 < t.qs.length ? 'Nächste Frage' : 'Ergebnis ansehen') + '</button></div>' : '<div class="row"><button class="btn pri" id="tOk">Antwort prüfen</button></div>') + '</div>';
    $('#tLeave').onclick = () => { if (t.mode === 'mix' && t.i > 0 && !confirm('Das Training abbrechen? Die Antworten bisher zählen nicht für die Aufgabe.')) return; S.train = null; persist(); render(); };
    bindInputs(v, t.ans, () => {});
    const inp = $('input.numin', v); if (inp) { inp.focus(); inp.onkeydown = e => { if (e.key === 'Enter' && $('#tOk')) $('#tOk').click(); }; }
    if ($('#tOk')) $('#tOk').onclick = () => {
      if (t.ans[q.id] == null || t.ans[q.id] === '') { toast('Gib zuerst eine Antwort ein'); return; }
      const ok = isRight(q, t.ans[q.id]); t.shown = true; addTr({ [q.k]: [ok ? 1 : 0, 1] });
      if (t.mode === 'serie') { if (ok) { S.streak.cur++; S.streak.best = Math.max(S.streak.best, S.streak.cur); stat('prSerie', S.streak.best, 'max'); } else S.streak.cur = 0; }
      persist(); render();
    };
    if ($('#tNext')) $('#tNext').onclick = () => {
      if (t.mode === 'serie') { nextSerie(); persist(); render(); return; }
      t.i++; t.shown = false;
      if (t.i >= t.qs.length) { // Durchgang zu Ende: bestes Ergebnis je Thema
        const nR = t.qs.filter(x => isRight(x, t.ans[x.id])).length, pq = Math.round(100 * nR / t.qs.length);
        if (t.k) { const prev = S.rep[t.k] != null ? S.rep[t.k] : ((S.best[t.k] || 0) >= 80 ? 1 : 0); S.rep[t.k] = Co ? Co.nextStage(prev, pq) : prev; }   // Wiederholstufe für die Lernempfehlung (coach.js)
        if (t.k && pq > (S.best[t.k] || 0)) S.best[t.k] = pq; stat('prTrain', 1); if (t.k && pq >= 80) stat('prTopic', 1);
        S.flags.sessions = (S.flags.sessions || 0) + 1;
      }
      persist(); render(); window.scrollTo(0, 0);
    };
  }

  /* ----- Auswertung ----- */
  function vStats(v) {
    const ts = topicStats(true).filter(x => !x.t.pool || x.n), w = weakest(), ex = S.hist.filter(h => h.kind === 'exam' && inArea(h));
    v.innerHTML = '<div class="card"><h2>Auswertung: ' + AREAS[area].t + '</h2>' + (ts.some(x => x.n) ? '<p>Dein Stand je Thema (alle bisher beantworteten Fragen, Training und Probeprüfungen):</p>' + ts.map(x => '<div class="tp"><div>' + esc(x.t.icon + ' ' + x.t.t) + ' <span class="mute small">' + (x.n ? x.r + ' von ' + x.n + ' richtig' : 'noch nichts beantwortet') + '</span></div>' + bar(x.p || 0) + '<div class="row"><span class="small ' + (x.p == null ? 'mute' : x.p >= 70 ? 'good' : x.p >= 50 ? 'warnt' : 'bad') + '">' + (x.p == null ? '–' : x.p + ' %') + '</span><button class="btn s" data-tr="' + x.t.k + '">Üben</button>' + (LABPAGE[x.t.lab] ? '<a class="btn s" href="' + LABPAGE[x.t.lab] + '">Im ' + esc(x.t.labN) + ' ausprobieren</a>' : '') + '</div></div>').join('') : '<p class="mute">Noch keine Daten. Mache ein Training oder eine Probeprüfung.</p>') + '</div>'
      + (Co ? '<div id="coachSlot"></div>' : '') + (w && !Co ? '<div class="card warn"><h3>Dein Lernplan</h3><ol><li>Schwächstes Thema: <b>' + esc(w.t.t) + '</b> (' + w.p + ' %). Übe es im Training, bis du 80 % in einem Durchgang schaffst.</li><li>Lies dazu die Formeln im Tab „Formeln“ und probiere es im ' + esc(w.t.labN) + ' praktisch aus.</li><li>Mache danach eine neue Probeprüfung und vergleiche.</li></ol><div class="row"><button class="btn pri" data-tr="' + w.t.k + '">' + esc(w.t.t) + ' üben</button></div></div>' : '')
      + '<div class="card"><h3>Probeprüfungen</h3>' + (ex.length ? '<p>' + ex.length + ' Prüfung(en). Beste: <b>' + Math.max(...ex.map(h => h.pct)) + ' %</b>. Verlauf:</p>' + ex.slice(-8).map(h => '<div class="li"><span>' + new Date(h.t).toLocaleDateString('de-DE') + '</span><span style="flex:1;margin:0 10px">' + bar(h.pct) + '</span><span><b>' + h.pct + ' %</b> · Note ' + h.note + '</span></div>').join('') : '<p class="mute">Noch keine Probeprüfung.</p>') + '</div>';
    $$('[data-tr]', v).forEach(b => { b.onclick = () => startTrain(b.dataset.tr); });
    if (Co && $('#coachSlot')) Co.mount($('#coachSlot'), { inlab: true });   // „Was übe ich als Nächstes?“ (ersetzt den Drei-Punkte-Lernplan)
  }

  /* ----- Formeln ----- */
  function vFormeln(v) {
    v.innerHTML = '<div class="card"><h2>Formelsammlung</h2><p class="mute">Alle Formeln, die in den Aufgaben vorkommen, nach Themen sortiert. Einheiten beachten: kΩ · mA = V, kΩ · µF = ms.</p></div>' + FORMELN.map(([k, rows]) => '<details class="card"><summary>' + esc(TOP[k].icon + ' ' + TOP[k].t) + '</summary><table class="ft">' + rows.map(r => '<tr><td>' + esc(r[0]) + '</td><td><b>' + esc(r[1]) + '</b></td><td class="mute small">' + esc(r[2]) + '</td></tr>').join('') + '</table></details>').join('')
      + '<div class="card"><h3>Zehnerpotenzen</h3><p class="mute">p = 10⁻¹², n = 10⁻⁹, µ = 10⁻⁶, m = 10⁻³, k = 10³, M = 10⁶, G = 10⁹</p></div>';
  }

  /* ----- Aufgaben ----- */
  function vTasks(v) {
    if (openTaskId) { card(v, TASKS.find(t => t.id === openTaskId)); return; }
    const d = done(), cats = []; TASKS.forEach(t => { if (!cats.includes(t.cat)) cats.push(t.cat); });
    v.innerHTML = '<div class="card"><h2>Aufgaben</h2><p class="mute">Vom Üben einzelner Themen bis zur bestandenen Probeprüfung. Jede Aufgabe prüft das Lab automatisch.</p></div>' + cats.map(c => '<div class="card"><h3>' + esc(c) + '</h3>' + TASKS.filter(t => t.cat === c).map(t => { const p = d[t.id] || 0; return '<button class="ti" data-id="' + t.id + '"><span class="dot ' + (p >= 100 ? 'g' : p > 0 ? 'y' : '') + '">' + (p >= 100 ? '✓' : '') + '</span><span><b>' + esc(t.title) + '</b><br><span class="mute small">' + ['', 'Einstieg', 'Mittel', 'Fortgeschritten'][t.level] + (p ? ' · ' + p + ' %' : '') + '</span></span></button>'; }).join('') + '</div>').join('');
    $$('.ti', v).forEach(b => { b.onclick = () => go('aufgaben', b.dataset.id); });
  }
  function think(t) {
    const q = root.THINK && root.THINK[t.id]; if (!q) return ''; const a = lsGet('pr.think', {})[t.id];
    return '<div class="think"><b>🤔 Denkfrage: Was erwartest du?</b><div>' + esc(q.q) + '</div>' + q.opts.map((o, i) => '<button class="btn s opt" data-th="' + i + '"' + (a != null ? ' disabled' : '') + '>' + (a != null && i === q.right ? '✓ ' : (a === i ? '✗ ' : '')) + esc(o) + '</button>').join('') + (a != null ? '<div class="small ' + (a === q.right ? 'good' : 'warnt') + '"><b>' + (a === q.right ? 'Richtig gedacht.' : 'Nicht ganz.') + '</b> ' + esc(q.why) + '</div>' : '') + '</div>';
  }
  function card(v, t) {
    const d = done();
    v.innerHTML = '<div class="card"><button class="btn s" id="tBack">← Alle Aufgaben</button><h2>' + esc(t.title) + '</h2><p>' + esc(t.text) + '</p>' + think(t) + '<div class="row"><button class="btn" id="tGo">' + (t.go === 'training' ? (t.topic ? 'Zum Training: ' + esc(TOP[t.topic].t) : 'Zum Training') : t.go === 'auswertung' ? 'Zur Auswertung' : 'Zur Probeprüfung') + '</button></div>'
      + '<div class="row"><button class="btn pri" id="tCheck">Prüfen</button><button class="btn" id="tHint">Tipp</button><button class="btn" id="tHand" ' + ((d[t.id] || 0) > 0 ? '' : 'disabled') + '>Abgeben</button></div><div id="tHintBox" class="hintbox" hidden>' + esc(t.hint || '') + '</div><div id="tRes"></div></div>';
    $('#tBack').onclick = () => go('aufgaben');
    $('#tGo').onclick = () => { if (t.go === 'training') { if (t.topic) startTrain(t.topic); else if (t.id === 'pr9') startTrain(null, 'serie'); else go('training'); } else go(t.go); };
    $$('[data-th]', v).forEach(b => { b.onclick = () => { const o = lsGet('pr.think', {}); o[t.id] = +b.dataset.th; lsSet('pr.think', o); const q = root.THINK[t.id]; if (+b.dataset.th === q.right) { try { const th = lsGet('lm4.think', {}); th[t.id] = 1; lsSet('lm4.think', th); } catch (e) {} if (root.Badges) root.Badges.stat('think', 1, 'max'); } render(); }; });
    $('#tHint').onclick = () => { $('#tHintBox').hidden = !$('#tHintBox').hidden; try { const h = lsGet('sim.hints', {}); h[t.id] = Math.max(h[t.id] || 0, 1); localStorage.setItem('sim.hints', JSON.stringify(h)); } catch (e) {} };
    $('#tCheck').onclick = async () => {
      $('#tRes').innerHTML = '<p class="mute">Prüfe …</p>'; const L = await runCheck(t), p = pctOf(L); markDone(t.id, p); persist();
      $('#tRes').innerHTML = '<div class="pct ' + (p >= 100 ? 'g' : '') + '">' + p + ' %</div>' + L.map(l => '<div class="rl ' + (l.ok ? 'ok' : 'no') + '">' + (l.ok ? '✓ ' : '✗ ') + esc(l.text) + (!l.ok && l.why ? '<div class="why">' + esc(l.why) + '</div>' : '') + '</div>').join('');
      $('#tHand').disabled = !(p > 0); if (p >= 100) toast('Geschafft!');
    };
    $('#tHand').onclick = () => { const p = done()[t.id] || 0; if (root.Auswertung && p > 0) root.Auswertung.handIn(t.id, p, t.title); };
  }

  /* ----- Fragenbank zum Gegenlesen (Ausbilder) ----- */
  function bankView() {
    sheet('Fragenbank zum Gegenlesen', b => {
      b.innerHTML = '<p class="mute small">' + B.nMC + ' Mehrfachwahl-Fragen und ' + B.nGEN + ' Rechengeneratoren. Bei jeder Frage steht die richtige Antwort mit Erklärung; bei Generatoren ein Beispiel mit Lösungsweg. Fachliche Fehler bitte melden.</p>'
        + TOPICS.map(t => '<h3>' + esc(t.icon + ' ' + t.t) + '</h3>' + B.MC.filter(m => m[0] === t.k).map(m => '<div class="bk"><b>' + esc(m[1]) + '</b><div class="good small">✓ ' + esc(m[2]) + '</div><div class="mute small">Falsch: ' + esc([m[3], m[4], m[5]].join(' · ')) + '</div><div class="small">' + esc(m[6]) + '</div></div>').join('') + B.GEN[t.k].map((g, gi) => { const x = g(B.seeded(gi + 11)); return '<div class="bk"><b>Rechnen:</b> ' + esc(x.q) + '<div class="good small">✓ ' + esc(B.de(B.sig(x.ans, 4)) + (x.unit ? ' ' + x.unit : '')) + '</div><div class="small">' + esc(x.w) + '</div></div>'; }).join('')).join('');
    });
  }

  function poolBankHtml() {
    const gt = Object.fromEntries(POOL.groups.map(g => [g.k, g.t])), TT = { Teil1: 'Teil 1', WiSo: 'Teil 2: Wirtschafts- und Sozialkunde', SysE: 'Teil 2: Systementwurf', FuSa: 'Teil 2: Funktions- und Systemanalyse' };
    return '<h2>Prüfungs-Pool (KI-Entwurf, ' + POOL.q.length + ' Aufgaben)</h2><p class="mute small">Eigene Aufgaben im Stil der Kammerprüfungen (Teil 1, Teil 2). Noch nicht fachlich freigegeben: bitte gegenlesen und Fehler melden.</p>'
      + ['Teil1', 'SysE', 'FuSa', 'WiSo'].map(tl => '<h3>' + TT[tl] + '</h3>' + POOL.q.filter(p => p.teil === tl).map(p => '<div class="bk"><b>' + esc(p.id + ' · ' + gt[p.g] + ': ' + p.q) + '</b>' + (p.o ? p.o.map((o, k) => '<div class="small ' + (k === p.r ? 'good' : 'mute') + '">' + (k === p.r ? '✓ ' : '· ') + esc(o) + '</div>').join('') : '<div class="good small">✓ ' + esc(B.de(B.sig(p.ans, 4)) + (p.u ? ' ' + p.u : '')) + '</div>') + '<div class="small">' + esc(p.w) + '</div></div>').join('')).join('');
  }
  function bankView2() { bankView(); const sb = [...document.querySelectorAll('.backdrop .sb')].pop(); if (sb) sb.insertAdjacentHTML('beforeend', poolBankHtml()); }

  /* ----- Menü ----- */
  function menu() {
    sheet('Menü', b => {
      const items = [['Aufgaben', () => go('aufgaben')], ['Formelsammlung', () => go('formeln')], ['Fragenbank zum Gegenlesen', bankView2], ['Abzeichen', () => root.Badges && root.Badges.open()], ['Trainer: Erste Schritte', () => root.Trainer && root.Trainer.start()], ['Kampagne', () => root.Kampagne && root.Kampagne.open()], ['Lernstand sichern oder laden', () => root.Lernstand && root.Lernstand.open()], ['Ergebnis senden', () => root.Auswertung && root.Auswertung.openSend()], ['Lernheft Prüfungs-Lab (PDF)', () => { location.href = 'tonfunk-lab-lernen-pr.pdf'; }], ['Praxisschaltung W-2024 verstehen', () => { location.href = 'lernen-w24.html'; }], ['Neu in dieser Version', () => root.LabNeu && root.LabNeu()]];
      b.innerHTML = items.map((x, i) => '<button class="row mi" data-i="' + i + '">' + x[0] + '</button>').join('');
      $$('.mi', b).forEach(btn => { btn.onclick = () => { $('.backdrop').remove(); items[+btn.dataset.i][1](); }; });
    });
  }
  root.PrWerk = { go, W, TASKS, DATA, state: () => S, startExam, startOrig, startGP, startMix, finishExam, startTrain, isRight, count, NOTE, POOL, examLock, setPause, godOk };
  root.LabTrainerAPI = { lab: 'pr', go, tab: () => tab, exam: () => !!S.exam, train: () => !!S.train, hist: () => S.hist.length };

  /* ----- Start ----- */
  const init = () => {
    $('#bMenu').onclick = menu; const sp = new URLSearchParams(location.search), t0 = sp.get('aufgabe'); let st = 'start'; try { st = localStorage.getItem('pr.tab') || 'start'; } catch (e) {}
    tab = TABS.some(x => x[0] === st) ? st : 'start'; if (t0 && TASKS.some(t => t.id === t0)) { tab = 'aufgaben'; openTaskId = t0; }
    /* ?tab=pruefung&teil=2 (Link aus der Lernempfehlung): Reiter und Bereich vorwählen; laufende Prüfung hat Vorrang */
    try { const tb = sp.get('tab'), tl = sp.get('teil'); if (tb && TABS.some(x => x[0] === tb) && !t0) tab = tb; if (tl === '1' || tl === '2') { area = tl === '1' ? 'teil1' : 'teil2'; lsSet('pr.area', area); } } catch (e) {}
    if (S.exam && !S.exam.done) tab = 'pruefung';
    /* ?gp=1&seed=N (Karriere, Generalprobe): startet den Kammeraufbau Teil 2 mit festem Seed, nur wenn keine Prüfung läuft; Parameter danach entfernen */
    try { if (sp.get('gp') === '1' && /^\d{1,10}$/.test(sp.get('seed') || '')) { if (!(S.exam && !S.exam.done)) { tab = 'pruefung'; startGP(sp.get('seed')); } try { history.replaceState(null, '', location.pathname + '?tab=pruefung'); } catch (e) {} } } catch (e) {}
    render();
    setInterval(() => { const e = S.exam; if (e && !e.done && e.limit > 0 && !(e.paused && e.paused.at) && leftMs(e, Date.now()) <= 0) finishExam(true); }, 4000);   // Zeit abgelaufen, auch wenn gerade ein anderer Reiter offen ist
    /* ?thema=sicherheit (Link aus dem Sicherheits-Lab und dem Lernpfad) ?thema=netzteile (Netzteil-Lab, Thema Stromversorgung) ?thema=wechselstrom (Wechselstrom-Lab, Thema Wechselstrom und Filter) und ?thema=analog (Analogtechnik-Lab, Thema Bauelemente): startet das Training zu diesem Thema */
    try { const th = sp.get('thema'), tk = ({ sicherheit: 'sicher', netzteile: 'strom', wechselstrom: 'wechsel', analog: 'bauteile' })[th] || th; if (th && !t0 && TOP[tk] && (!TOP[tk].pool || TOP[tk].area) && !(S.exam && !S.exam.done)) { if (TOP[tk].area) { area = TOP[tk].area; lsSet('pr.area', area); } startTrain(tk); } } catch (e) {}   // auch Pool-Themen (?thema=p%3Aopv%401 aus der Lernempfehlung)
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  root.PR_TEST = { poolQ, POOL };   // für den Selbsttest (Mischen der Antworten prüfen)
})(window);
