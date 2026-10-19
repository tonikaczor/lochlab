'use strict';
/* Tonfunk Prüfungs-Lab: Oberfläche.
   Probeprüfung (20 Aufgaben mit Zeitlimit, Note nach IHK-Schlüssel), Training je Thema und Rechenserie, Auswertung mit Schwachstellen,
   Formelsammlung und Aufgaben. Zustand in „pr.state“: hist (Probeprüfungen), best (bestes Ergebnis je Thema), tr (Antworten je Thema),
   streak (Rechenserie), exam (laufende Prüfung), train (laufendes Training). Alle Aufgaben sind eigene Formulierungen. */
(function (root) {
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const B = root.PR_BANK, TOPICS = B.TOPICS, TOP = Object.fromEntries(TOPICS.map(t => [t.k, t]));
  const LABPAGE = { sch: 'schaltplan.html', sim: 'simlab.html', digi: 'digilab.html', mess: 'messlab.html', code: 'codelab.html', haus: 'hauslab.html', loch: 'layout.html' };
  const newS = () => ({ hist: [], best: {}, tr: {}, streak: { cur: 0, best: 0 }, exam: null, train: null, answers: {}, flags: {} });


  /* ---------------- Prüfungs-Pool im Stil der Kammer (Teil 1, Teil 2 Systementwurf und Funktions- und Systemanalyse) ---------------- */
  const POOL = root.PR_POOL || { groups: [], q: [] };
  POOL.groups.forEach(g => { TOP['p:' + g.k] = { k: 'p:' + g.k, t: g.t, icon: g.icon, lab: g.lab, labN: g.labN, pool: true }; });
  TOP['p:alle'] = { k: 'p:alle', t: 'Prüfungs-Pool gemischt', icon: '🎓', lab: 'sch', labN: 'SchaltLab', pool: true };
  const ALLT = TOPICS.concat(POOL.groups.map(g => TOP['p:' + g.k]));
  const VARIANTS = {
    teil1: { t: 'Teil 1 (nach 18 Monaten)', pool: ['Teil1'], limit: 90, nA: 23, keep: 20, fix: 6, nB: 8, note: 'Teil A: 23 gebundene Aufgaben (20 bearbeiten, 3 abwählbar, 6 nicht abwählbar), Teil B: 8 Rechenaufgaben zu je 10 Punkten. Teil A und B zählen je 50 %.' },
    syse: { t: 'Teil 2: Systementwurf', pool: ['SysE'], limit: 105, nA: 28, keep: 25, fix: 8, nB: 8, note: 'Teil A: 28 gebundene Aufgaben (25 bearbeiten, 3 abwählbar, 8 nicht abwählbar), Teil B: 8 Rechenaufgaben zu je 10 Punkten. Teil A und B zählen je 50 %.' },
    fusa: { t: 'Teil 2: Funktions- und Systemanalyse', pool: ['FuSa'], limit: 105, nA: 28, keep: 25, fix: 8, nB: 8, note: 'Teil A: 28 gebundene Aufgaben (25 bearbeiten, 3 abwählbar, 8 nicht abwählbar), Teil B: 8 Rechenaufgaben zu je 10 Punkten. Teil A und B zählen je 50 %.' }
  };
  function poolQ(p, r) {
    if (p.o) { const idx = r.shuffle([0, 1, 2, 3, 4]); return { id: p.id, k: 'p:' + p.g, type: 'mc', q: p.q, opts: idx.map(i => p.o[i]), r: idx.indexOf(p.r), w: p.w, pts: 1, teil: p.teil, pool: true }; }
    return { id: p.id, k: 'p:' + p.g, type: 'num', q: p.q, ans: p.ans, unit: p.u, tol: p.tol, w: p.w, pts: 4, teil: p.teil, pool: true };
  }
  function drawPool(g, n, seed) { // g = Gruppe oder 'alle'; etwa 60 % Mehrfachwahl, 40 % Rechnen
    const r = B.seeded(seed), src = POOL.q.filter(p => g === 'alle' || p.g === g), mc = r.shuffle(src.filter(p => p.o)), nu = r.shuffle(src.filter(p => !p.o));
    const wantN = Math.min(nu.length, Math.round(n * 0.4)), out = nu.slice(0, wantN).concat(mc.slice(0, n - wantN));
    if (out.length < n) out.push(...mc.slice(n - wantN).concat(nu.slice(wantN)).slice(0, n - out.length));
    return r.shuffle(out).map(p => poolQ(p, r));
  }

  /* ---------------- Zustand ---------------- */
  let S = Object.assign(newS(), lsGet('pr.state', {}));
  ['best', 'tr', 'answers', 'flags'].forEach(k => { S[k] = S[k] || {}; }); S.hist = S.hist || []; S.streak = S.streak || { cur: 0, best: 0 };
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
  function addTr(tp) { Object.keys(tp).forEach(k => { const t = S.tr[k] = S.tr[k] || { r: 0, n: 0 }; t.r += tp[k][0]; t.n += tp[k][1]; }); }

  /* ---------------- Fenster und Meldungen ---------------- */
  function toast(t) { let e = $('#toast'); if (!e) { e = document.createElement('div'); e.id = 'toast'; document.body.appendChild(e); } e.textContent = t; e.className = 'show'; clearTimeout(toast.t); toast.t = setTimeout(() => { e.className = ''; }, 2600); }
  function sheet(title, fn) {
    const w = document.createElement('div'); w.className = 'backdrop'; w.innerHTML = '<div class="sheet"><div class="sh"><b>' + esc(title) + '</b><button class="x" aria-label="Schließen">✕</button></div><div class="sb"></div></div>';
    document.body.appendChild(w); const close = () => w.remove(); w.addEventListener('pointerdown', e => { if (e.target === w) close(); }); $('.x', w).onclick = close; fn($('.sb', w), close); return w;
  }
  root.LabUI = { sheet, toast }; root.sheet = sheet; root.toast = toast;

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
  let tab = 'start', openTaskId = null, timer = null;
  function go(t, id) { tab = t; if (t === 'aufgaben') openTaskId = id || null; render(); window.scrollTo(0, 0); }
  function render() {
    if (timer) { clearInterval(timer); timer = null; }
    $('#tabs').innerHTML = TABS.map(([k, n]) => '<button class="tab' + (tab === k ? ' on' : '') + '" data-t="' + k + '">' + n + '</button>').join('');
    $$('#tabs .tab').forEach(b => { b.onclick = () => go(b.dataset.t); });
    const v = $('#view'); ({ start: vStart, pruefung: vExam, training: vTrain, auswertung: vStats, formeln: vFormeln, aufgaben: vTasks })[tab](v);
    try { localStorage.setItem('pr.tab', tab); } catch (e) {}
  }
  const bar = p => '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, p)) + '%"></i></div>';
  const topicStats = (all) => ALLT.filter(t => all || !t.pool).map(t => { const s = S.tr[t.k] || { r: 0, n: 0 }; return { t, r: s.r, n: s.n, p: s.n ? Math.round(100 * s.r / s.n) : null, best: S.best[t.k] || 0 }; });
  const weakest = () => topicStats(true).filter(x => x.n >= 3).sort((a, b) => a.p - b.p)[0] || null;

  /* ----- Start ----- */
  function vStart(v) {
    const d = done(), n = TASKS.filter(t => (d[t.id] || 0) >= 100).length, ex = S.hist.filter(h => h.kind === 'exam'), last = ex[ex.length - 1], w = weakest();
    v.innerHTML = '<div class="card"><h2>Prüfungs-Lab</h2><p>Hier übst du für die <b>Abschlussprüfung</b> (Elektroniker/in für Geräte und Systeme): Aufgaben im Stil der schriftlichen Prüfung, mit Rechnen, Mehrfachwahl, Zeitlimit und Auswertung nach Themen. Alle Aufgaben sind eigene Übungsaufgaben und keine echten Kammer-Aufgaben.</p>'
      + '<div class="steps"><div><b>1</b> Themen üben<br><span class="mute small">Zehn Fragen mit Erklärung, je Thema.</span><br><button class="btn" data-g="training">Zum Training</button></div><div><b>2</b> Probeprüfung<br><span class="mute small">20 Aufgaben, Zeitlimit, Note.</span><br><button class="btn" data-g="pruefung">Zur Probeprüfung</button></div><div><b>3</b> Schwächen finden<br><span class="mute small">Auswertung und Lernempfehlung.</span><br><button class="btn" data-g="auswertung">Zur Auswertung</button></div></div></div>'
      + '<div class="card"><h3>Dein Stand</h3>' + bar(100 * n / TASKS.length) + '<p>' + n + ' von ' + TASKS.length + ' Aufgaben geschafft.' + (last ? ' Letzte Probeprüfung: <b>' + last.pct + ' %</b> (Note ' + last.note + ').' : ' Noch keine Probeprüfung.') + '</p>'
      + (w ? '<p>Schwächstes Thema bisher: <b>' + esc(w.t.t) + '</b> (' + w.p + ' % richtig). <button class="btn s" data-tr="' + w.t.k + '">Jetzt üben</button></p>' : '<p class="mute">Sobald du ein paar Fragen beantwortet hast, siehst du hier dein schwächstes Thema.</p>')
      + '<button class="btn pri" data-g="aufgaben">' + (n ? 'Weiter mit den Aufgaben' : 'Los geht’s mit den Aufgaben') + '</button></div>'
      + '<div class="card"><h3>Praktische Prüfungsvorbereitung in den anderen Labs</h3><p class="mute">Die Prüfung hat auch einen praktischen Teil. Diese Aufgaben üben Stromlaufpläne lesen, Messen, Löten und Programmieren im Stil der Prüfung:</p>'
      + '<ul><li><b>MessLab, Prüfungsschaltungen (Teil B):</b> LED und Vorwiderstand, Poti-Teiler, Verstärker mit Operationsverstärker, Spannungsfolger, Transistorschalter, Z-Diode, Regler 7805, Schutzdiode, Batterie-Innenwiderstand und drei Fehlersuchen. <a href="messlab.html?aufgabe=mp1">MessLab öffnen</a></li>'
      + '<li><b>Arduino-Lab, Prüfungspraxis:</b> Countdown mit Warnton, Luftampel mit Poti, Heizstufen mit entprelltem Taster, Fehlersuche im Würfel-Sketch. <a href="codelab.html?aufgabe=cp1">Arduino-Lab öffnen</a></li>'
      + '<li><b>LochLab, Fehlersuche an Prüfplatinen:</b> Lötbrücke am Netzteil, fehlende Leitung am MOSFET-Schalter und am 555-Blinker. <a href="layout.html?aufgabe=lf5">LochLab öffnen</a></li></ul></div>'
      + '<div class="card warn"><h3>So nutzt du das Lab</h3><ul><li>Rechenaufgaben: Gib die Zahl in der Einheit an, die in der Frage steht. Abweichungen bis 2 % durch Runden gelten als richtig. Komma oder Punkt sind egal.</li><li>Die Note richtet sich nach dem IHK-Schlüssel: 100 bis 92 % = 1, ab 81 % = 2, ab 67 % = 3, ab 50 % = 4, ab 30 % = 5.</li><li>Im Tab „Formeln“ steht alles, was du brauchst. In der echten Prüfung gibt es meist eine Formelsammlung, übe aber auch ohne.</li></ul></div>';
    $$('[data-g]', v).forEach(b => { b.onclick = () => go(b.dataset.g); }); $$('[data-tr]', v).forEach(b => { b.onclick = () => { startTrain(b.dataset.tr); }; });
  }

  /* ----- Fragen darstellen ----- */
  function qHtml(q, i, ans, locked, show) {
    const a = ans[q.id], ok = show && isRight(q, a);
    let h = '<div class="pq' + (show ? (ok ? ' okq' : ' noq') : '') + '"><div class="pqh"><span class="chip">' + esc(TOP[q.k].icon + ' ' + TOP[q.k].t) + '</span><span class="mute small">' + (q.part === 'A' ? 'Teil A' : q.part === 'B' ? 'Teil B' : q.pts + ' Punkte') + (q.part === 'B' ? ' · 10 Punkte' : '') + '</span></div><b>' + (i != null ? (i + 1) + '. ' : '') + esc(q.q) + '</b>';
    if (q.type === 'mc') h += q.opts.map((o, k) => '<label class="ck' + (show && k === q.r ? ' rightopt' : '') + '"><input type="radio" name="q_' + q.id + '" data-q="' + q.id + '" value="' + k + '"' + (a === k ? ' checked' : '') + (locked ? ' disabled' : '') + '> ' + esc(o) + '</label>').join('');
    else h += '<div class="row"><input class="numin" inputmode="decimal" data-n="' + q.id + '" placeholder="Zahl eingeben" value="' + esc(a == null ? '' : a) + '"' + (locked ? ' disabled' : '') + ' autocomplete="off"><span class="unit">' + esc(q.unit) + '</span></div>';
    if (show) h += '<div class="rl ' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓ Richtig.' : '✗ Deine Antwort: ' + esc(yourText(q, a)) + '. Richtig: ' + esc(ansText(q)) + '.') + '</div><div class="why">' + esc(q.w) + '</div>';
    return h + '</div>';
  }
  function bindInputs(v, ans, onChange) {
    $$('input[data-q]', v).forEach(c => { c.onchange = () => { ans[c.dataset.q] = +c.value; onChange(); }; });
    $$('input[data-n]', v).forEach(c => { c.oninput = () => { ans[c.dataset.n] = c.value; onChange(); }; });
  }

  /* ----- Probeprüfung ----- */
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };
  function startExam(limit) { S.exam = { v: 'kurz', seed: Date.now() % 1000000000, qs: B.exam(Date.now() % 1000000000, 20), ans: {}, start: Date.now(), limit, done: false }; persist(); render(); }
  function startOrig(v) { // Prüfungsaufbau wie in der Kammerprüfung: Teil A gebunden mit Abwahl, Teil B Rechenaufgaben
    const c = VARIANTS[v], seed = Date.now() % 1000000000, r = B.seeded(seed);
    const A = r.shuffle(POOL.q.filter(p => c.pool.includes(p.teil) && p.o)).slice(0, c.nA).map(p => poolQ(p, r));
    const Bq = r.shuffle(POOL.q.filter(p => c.pool.includes(p.teil) && !p.o)).slice(0, c.nB).map(p => poolQ(p, r));
    A.forEach(q => { q.pts = 1; q.part = 'A'; }); Bq.forEach(q => { q.pts = 10; q.part = 'B'; });
    const fix = r.shuffle(A.map((q, i) => i)).slice(0, c.fix);
    S.exam = { v, seed, qs: A.concat(Bq), ans: {}, start: Date.now(), limit: c.limit, done: false, orig: { keep: c.keep, fix, skip: {} } }; persist(); render();
  }
  function origScore(e) {
    const A = e.qs.filter(q => q.part === 'A'), Bq = e.qs.filter(q => q.part === 'B'), o = e.orig, allow = A.length - o.keep, fixIds = new Set(o.fix.map(i => A[i].id));
    const skip = Object.keys(o.skip).filter(id => o.skip[id] && !fixIds.has(id)).slice(0, allow);
    const rest = A.filter(q => !fixIds.has(q.id) && !skip.includes(q.id)), auto = allow - skip.length > 0 ? rest.slice(-(allow - skip.length)) : [];
    const dropped = new Set(skip.concat(auto.map(q => q.id)));
    const counted = A.filter(q => !dropped.has(q.id)), okA = counted.filter(q => isRight(q, e.ans[q.id])).length, okB = Bq.filter(q => isRight(q, e.ans[q.id])).length;
    const pA = counted.length ? okA / counted.length : 0, pB = Bq.length ? okB / Bq.length : 0, tp = {};
    counted.concat(Bq).forEach(q => { const t = tp[q.k] = tp[q.k] || [0, 0]; t[1]++; if (isRight(q, e.ans[q.id])) t[0]++; });
    return { pct: Math.round(50 * pA + 50 * pB), pts: okA + okB * 10, max: counted.length + Bq.length * 10, topics: tp, a: [okA, counted.length], b: [okB, Bq.length], dropped: [...dropped] };
  }
  const TASKFOR = { teil1: 'pr14', syse: 'pr15', fusa: 'pr16' };
  function finishExam(auto) {
    const e = S.exam; if (!e || e.done) return; const c = e.orig ? origScore(e) : count(e.qs, e.ans), n = NOTE(c.pct);
    e.done = true; e.res = { pts: c.pts, max: c.max, pct: c.pct, note: n[0], noteT: n[1], topics: c.topics, secs: Math.round((Date.now() - e.start) / 1000), auto: !!auto, a: c.a, b: c.b, dropped: c.dropped };
    S.hist.push({ kind: 'exam', v: e.v || 'kurz', t: Date.now(), pct: c.pct, pts: c.pts, max: c.max, note: n[0], secs: e.res.secs, topics: c.topics }); addTr(c.topics);
    stat('prExam', 1); persist(); render(); if (c.pct >= 50 && !testing) toast('Bestanden: ' + c.pct + ' % (Note ' + n[0] + ')');
  }
  const VNAME = v => (v === 'kurz' || !v ? 'Kurz-Probe' : VARIANTS[v].t);
  function qRun(e, q, i, locked, show) { // Frage mit Teil-Überschrift und Abwahl
    const A = e.qs.filter(x => x.part === 'A'), ia = A.indexOf(q), ib = e.qs.filter(x => x.part === 'B').indexOf(q); let h = '';
    if (e.orig && i === 0) h += '<div class="card"><b>Teil A: gebundene Aufgaben</b><div class="mute small">Je Aufgabe 1 Punkt, genau eine Antwort richtig. ' + (A.length - e.orig.keep) + ' Aufgaben darfst du abwählen, ' + e.orig.fix.length + ' sind nicht abwählbar. Wählst du weniger ab, zählen die letzten abwählbaren Aufgaben nicht.</div></div>';
    if (e.orig && q.part === 'B' && ib === 0) h += '<div class="card"><b>Teil B: ungebundene Aufgaben</b><div class="mute small">Rechenaufgaben zu je 10 Punkte. Gib das Endergebnis in der angegebenen Einheit ein. Teil A und Teil B zählen je 50 %.</div></div>';
    let b = qHtml(q, q.part === 'B' ? ib : e.orig ? ia : i, e.ans, locked, show);
    if (e.orig && q.part === 'A') {
      const fix = e.orig.fix.includes(ia), sk = !!e.orig.skip[q.id];
      b = b.slice(0, -6) + (fix ? '<div class="mute small">nicht abwählbar</div>' : (show ? (sk || (e.res && e.res.dropped && e.res.dropped.includes(q.id)) ? '<div class="warnt small">Diese Aufgabe wurde nicht gewertet (abgewählt).</div>' : '') : '<label class="ck"><input type="checkbox" data-skip="' + q.id + '"' + (sk ? ' checked' : '') + '> Diese Aufgabe abwählen (nicht bearbeiten)</label>')) + '</div>';
    }
    return h + b;
  }
  function vExam(v) {
    const e = S.exam;
    if (!e) {
      v.innerHTML = '<div class="card"><h2>Probeprüfung</h2><label>Variante<select id="exV"><option value="kurz">Kurz-Probe: 20 Aufgaben aus allen acht Themen</option><option value="teil1">Teil 1 nach Prüfungsaufbau (90 min)</option><option value="syse">Teil 2: Systementwurf (105 min)</option><option value="fusa">Teil 2: Funktions- und Systemanalyse (105 min)</option></select></label><p id="exNote" class="mute small"></p>'
        + '<div id="exTBox"><label>Zeit<select id="exT"><option value="30">30 Minuten (kurz)</option><option value="45">45 Minuten</option><option value="60" selected>60 Minuten (wie in der Prüfung)</option><option value="90">90 Minuten (mit Reserve)</option></select></label></div>'
        + '<div class="row"><button class="btn pri" id="exGo">Prüfung starten</button></div><p class="mute small">Du kannst frei zwischen den Aufgaben springen und jederzeit abgeben. Läuft die Zeit ab, wird automatisch abgegeben. Erlaubt sind Taschenrechner und Tabellenbuch, die Formelsammlung (Tab „Formeln“) bitte nicht benutzen.</p></div>'
        + '<div class="card warn"><b>Hinweis zum Prüfungs-Pool:</b> Die Aufgaben von Teil 1 und Teil 2 sind eigene Übungsaufgaben im Stil der Kammerprüfungen. Sie wurden mit KI erstellt und sind vom Ausbilder noch nicht fachlich freigegeben. Bei Zweifeln zählt das Tabellenbuch.</div>'
        + (S.hist.length ? '<div class="card"><h3>Bisherige Prüfungen</h3>' + histHtml() + '</div>' : '');
      const upd = () => { const vv = $('#exV').value; $('#exTBox').hidden = vv !== 'kurz'; $('#exNote').textContent = vv === 'kurz' ? '20 Aufgaben aus allen acht Themen: Rechenaufgaben (4 Punkte) und Mehrfachwahl (2 Punkte).' : VARIANTS[vv].note; };
      $('#exV').onchange = upd; upd();
      $('#exGo').onclick = () => { const vv = $('#exV').value; if (vv === 'kurz') startExam(+$('#exT').value); else startOrig(vv); }; return;
    }
    if (e.done) {
      const r = e.res, c = r.pct >= 50;
      v.innerHTML = '<div class="card"><h2>Ergebnis: ' + esc(VNAME(e.v)) + '</h2><div class="pct ' + (c ? 'g' : '') + '">' + r.pct + ' %</div><p><b>Note ' + r.note + ' (' + r.noteT + ')</b> · ' + (r.a ? 'Teil A: ' + r.a[0] + ' von ' + r.a[1] + ' gewerteten Aufgaben richtig · Teil B: ' + r.b[0] + ' von ' + r.b[1] + ' Aufgaben richtig (je 10 Punkte)' : r.pts + ' von ' + r.max + ' Punkten') + ' · Zeit: ' + mmss(r.secs * 1000) + ' von ' + e.limit + ' Minuten' + (r.auto ? ' (Zeit abgelaufen)' : '') + '</p><p class="' + (c ? 'good' : 'bad') + '">' + (c ? 'Bestanden (ab 50 %).' : 'Noch nicht bestanden (ab 50 %). Übe die schwachen Themen und versuche es erneut.') + '</p></div>'
        + '<div class="card"><h3>Ergebnis nach Themen</h3>' + ALLT.filter(t => r.topics[t.k]).map(t => { const x = r.topics[t.k], p = Math.round(100 * x[0] / x[1]); return '<div class="tp"><div>' + esc(t.icon + ' ' + t.t) + ' <span class="mute small">(' + x[0] + ' von ' + x[1] + ')</span></div>' + bar(p) + '<div class="row"><span class="small ' + (p >= 70 ? 'good' : p >= 50 ? 'warnt' : 'bad') + '">' + p + ' %</span>' + (p < 70 ? '<button class="btn s" data-tr="' + t.k + '">Thema üben</button>' : '') + '</div></div>'; }).join('') + '</div>'
        + '<div class="card"><h3>Alle Aufgaben mit Lösung</h3>' + e.qs.map((q, i) => qRun(e, q, i, true, true)).join('') + '<div class="row"><button class="btn pri" id="exNew">Neue Probeprüfung</button><button class="btn" id="exSend">Ergebnis abgeben</button></div></div>';
      $('#exNew').onclick = () => { S.exam = null; persist(); render(); };
      $('#exSend').onclick = () => { if (!c) { toast('Erst eine bestandene Probeprüfung (ab 50 %) kann abgegeben werden'); return; } const id = TASKFOR[e.v] || 'pr10', t = TASKS.find(x => x.id === id); markDone('pr10', 100); if (id !== 'pr10') markDone(id, 100); if (root.Auswertung) root.Auswertung.handIn(id, 100, t ? t.title : 'Probeprüfung'); };
      $$('[data-tr]', v).forEach(b => { b.onclick = () => startTrain(b.dataset.tr); }); return;
    }
    const left = () => e.start + e.limit * 60000 - Date.now();
    v.innerHTML = '<div class="card tmr"><div class="row"><b>Restzeit: <span id="exLeft">' + mmss(left()) + '</span></b><span class="grow"></span><span class="mute small" id="exCnt"></span><button class="btn pri" id="exFin">Abgeben</button></div>' + '</div>'
      + e.qs.map((q, i) => qRun(e, q, i, false, false)).join('') + '<div class="card"><button class="btn pri" id="exFin2">Prüfung abgeben</button></div>';
    const cnt = () => { $('#exCnt').textContent = Object.keys(e.ans).filter(k => e.ans[k] !== '' && e.ans[k] != null).length + ' von ' + e.qs.length + ' beantwortet'; }; cnt();
    bindInputs(v, e.ans, () => { cnt(); persist(); });
    $$('input[data-skip]', v).forEach(c => { c.onchange = () => { const allow = e.qs.filter(q => q.part === 'A').length - e.orig.keep, cur = Object.keys(e.orig.skip).filter(k => e.orig.skip[k]).length; if (c.checked && cur >= allow) { c.checked = false; toast('Es dürfen höchstens ' + allow + ' Aufgaben abgewählt werden'); return; } e.orig.skip[c.dataset.skip] = c.checked; persist(); }; });
    const fin = () => { const open = e.qs.length - Object.keys(e.ans).filter(k => e.ans[k] !== '' && e.ans[k] != null).length; if (open > 0 && !confirm(open + ' Aufgabe(n) sind noch offen. Trotzdem abgeben?')) return; finishExam(false); };
    $('#exFin').onclick = fin; $('#exFin2').onclick = fin;
    timer = setInterval(() => { const l = left(); const el = $('#exLeft'); if (el) { el.textContent = mmss(l); el.parentNode.className = l < 300000 ? 'warnt' : ''; } if (l <= 0) { clearInterval(timer); timer = null; finishExam(true); } }, 1000);
    if (left() <= 0) finishExam(true);
  }
  function histHtml() {
    return S.hist.slice(-10).reverse().map(h => '<div class="li"><span>' + new Date(h.t).toLocaleDateString('de-DE') + ' · ' + esc(VNAME(h.v)) + '</span><span><b>' + h.pct + ' %</b> · Note ' + h.note + '</span></div>').join('');
  }

  /* ----- Training ----- */
  function startTrain(k, mode) {
    const seed = Date.now() % 1000000000;
    if (mode === 'serie') S.train = { k: null, mode: 'serie', qs: [], i: 0, ans: {}, shown: false, right: 0, seed };
    else if (String(k).startsWith('p:')) { const qs = drawPool(k.slice(2), 10, seed); S.train = { k, mode: 'mix', qs, i: 0, ans: {}, shown: false, right: 0, seed }; }
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
        + '<h3>Prüfungs-Pool im Stil der Kammer</h3><p class="mute small">Aufgaben im Stil von Teil 1 und Teil 2 (KI-Entwurf, noch nicht fachlich freigegeben). Nach Prüfungsthemen:</p><div class="tgrid">' + POOL.groups.map(g => { const s = S.tr['p:' + g.k] || { r: 0, n: 0 }; return '<button class="tbtn" data-k="p:' + g.k + '"><span class="ti1">' + g.icon + '</span><b>' + esc(g.t) + '</b><span class="mute small">' + (s.n ? Math.round(100 * s.r / s.n) + ' % richtig (' + s.n + ' Fragen)' : 'noch nicht geübt') + '</span></button>'; }).join('') + '</div>'
        + '<div class="row"><button class="btn" data-k="p:alle">🎓 Pool gemischt</button><button class="btn" data-k="alle">🎲 Alle Themen gemischt</button><button class="btn" id="serie">🔥 Rechenserie (endlos)</button></div><p class="mute small">Rechenserie: Immer neue Rechenaufgaben aus allen Themen. Eine falsche Antwort setzt die Serie zurück. Rekord: ' + (S.streak.best || 0) + '.</p></div>';
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
        if (t.k && pq > (S.best[t.k] || 0)) S.best[t.k] = pq; stat('prTrain', 1); if (t.k && pq >= 80) stat('prTopic', 1);
        S.flags.sessions = (S.flags.sessions || 0) + 1;
      }
      persist(); render(); window.scrollTo(0, 0);
    };
  }

  /* ----- Auswertung ----- */
  function vStats(v) {
    const ts = topicStats(true).filter(x => !x.t.pool || x.n), w = weakest(), ex = S.hist.filter(h => h.kind === 'exam');
    v.innerHTML = '<div class="card"><h2>Auswertung</h2>' + (ts.some(x => x.n) ? '<p>Dein Stand je Thema (alle bisher beantworteten Fragen, Training und Probeprüfungen):</p>' + ts.map(x => '<div class="tp"><div>' + esc(x.t.icon + ' ' + x.t.t) + ' <span class="mute small">' + (x.n ? x.r + ' von ' + x.n + ' richtig' : 'noch nichts beantwortet') + '</span></div>' + bar(x.p || 0) + '<div class="row"><span class="small ' + (x.p == null ? 'mute' : x.p >= 70 ? 'good' : x.p >= 50 ? 'warnt' : 'bad') + '">' + (x.p == null ? '–' : x.p + ' %') + '</span><button class="btn s" data-tr="' + x.t.k + '">Üben</button><a class="btn s" href="' + LABPAGE[x.t.lab] + '">Im ' + esc(x.t.labN) + ' ausprobieren</a></div></div>').join('') : '<p class="mute">Noch keine Daten. Mache ein Training oder eine Probeprüfung.</p>') + '</div>'
      + (w ? '<div class="card warn"><h3>Dein Lernplan</h3><ol><li>Schwächstes Thema: <b>' + esc(w.t.t) + '</b> (' + w.p + ' %). Übe es im Training, bis du 80 % in einem Durchgang schaffst.</li><li>Lies dazu die Formeln im Tab „Formeln“ und probiere es im ' + esc(w.t.labN) + ' praktisch aus.</li><li>Mache danach eine neue Probeprüfung und vergleiche.</li></ol><div class="row"><button class="btn pri" data-tr="' + w.t.k + '">' + esc(w.t.t) + ' üben</button></div></div>' : '')
      + '<div class="card"><h3>Probeprüfungen</h3>' + (ex.length ? '<p>' + ex.length + ' Prüfung(en). Beste: <b>' + Math.max(...ex.map(h => h.pct)) + ' %</b>. Verlauf:</p>' + ex.slice(-8).map(h => '<div class="li"><span>' + new Date(h.t).toLocaleDateString('de-DE') + '</span><span style="flex:1;margin:0 10px">' + bar(h.pct) + '</span><span><b>' + h.pct + ' %</b> · Note ' + h.note + '</span></div>').join('') : '<p class="mute">Noch keine Probeprüfung.</p>') + '</div>';
    $$('[data-tr]', v).forEach(b => { b.onclick = () => startTrain(b.dataset.tr); });
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
    const gt = Object.fromEntries(POOL.groups.map(g => [g.k, g.t])), TT = { Teil1: 'Teil 1', SysE: 'Teil 2: Systementwurf', FuSa: 'Teil 2: Funktions- und Systemanalyse' };
    return '<h2>Prüfungs-Pool (KI-Entwurf, ' + POOL.q.length + ' Aufgaben)</h2><p class="mute small">Eigene Aufgaben im Stil der Kammerprüfungen (Teil 1, Teil 2). Noch nicht fachlich freigegeben: bitte gegenlesen und Fehler melden.</p>'
      + ['Teil1', 'SysE', 'FuSa'].map(tl => '<h3>' + TT[tl] + '</h3>' + POOL.q.filter(p => p.teil === tl).map(p => '<div class="bk"><b>' + esc(p.id + ' · ' + gt[p.g] + ': ' + p.q) + '</b>' + (p.o ? p.o.map((o, k) => '<div class="small ' + (k === p.r ? 'good' : 'mute') + '">' + (k === p.r ? '✓ ' : '· ') + esc(o) + '</div>').join('') : '<div class="good small">✓ ' + esc(B.de(B.sig(p.ans, 4)) + (p.u ? ' ' + p.u : '')) + '</div>') + '<div class="small">' + esc(p.w) + '</div></div>').join('')).join('');
  }
  function bankView2() { bankView(); const sb = [...document.querySelectorAll('.backdrop .sb')].pop(); if (sb) sb.insertAdjacentHTML('beforeend', poolBankHtml()); }

  /* ----- Menü ----- */
  function menu() {
    sheet('Menü', b => {
      const items = [['Aufgaben', () => go('aufgaben')], ['Formelsammlung', () => go('formeln')], ['Fragenbank zum Gegenlesen', bankView2], ['Abzeichen', () => root.Badges && root.Badges.open()], ['Trainer: Erste Schritte', () => root.Trainer && root.Trainer.start()], ['Kampagne', () => root.Kampagne && root.Kampagne.open()], ['Lernstand sichern oder laden', () => root.Lernstand && root.Lernstand.open()], ['Ergebnis senden', () => root.Auswertung && root.Auswertung.openSend()], ['Lernheft Prüfungs-Lab (PDF)', () => { location.href = 'tonfunk-lab-lernen-pr.pdf'; }], ['Neu in dieser Version', () => root.LabNeu && root.LabNeu()]];
      b.innerHTML = items.map((x, i) => '<button class="row mi" data-i="' + i + '">' + x[0] + '</button>').join('');
      $$('.mi', b).forEach(btn => { btn.onclick = () => { $('.backdrop').remove(); items[+btn.dataset.i][1](); }; });
    });
  }
  root.PrWerk = { go, W, TASKS, DATA, state: () => S, startExam, startOrig, finishExam, startTrain, isRight, count, NOTE, POOL };
  root.LabTrainerAPI = { lab: 'pr', go, tab: () => tab, exam: () => !!S.exam, train: () => !!S.train, hist: () => S.hist.length };

  /* ----- Start ----- */
  const init = () => {
    $('#bMenu').onclick = menu; const sp = new URLSearchParams(location.search), t0 = sp.get('aufgabe'); let st = 'start'; try { st = localStorage.getItem('pr.tab') || 'start'; } catch (e) {}
    tab = TABS.some(x => x[0] === st) ? st : 'start'; if (t0 && TASKS.some(t => t.id === t0)) { tab = 'aufgaben'; openTaskId = t0; } render();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  root.PR_TEST = { poolQ, POOL };   // für den Selbsttest (Mischen der Antworten prüfen)
})(window);
