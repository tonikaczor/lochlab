'use strict';
/* Tonfunk Löt-Lab: Oberfläche (Lab-Kennung 'lot').
   Alle Zahlen (Temperaturen, Zeiten, Mengen, Grenzwerte) sind ÜBUNGSWERTE für die Ausbildung. Es ist ein Lernmodell, keine Prüfungsvorschrift und keine Norm.
   Reiter: Lötstelle (Durchsteck, Regler), Reflow (SMD, Regler und Zeitleiste), Fehlerbilder, Aufgaben, Trainer, Hilfe.
   Module: lotcore.js (LOT_CORE), lotdata.js (LOT_DATA, LOT_TASKS), lotviz.js (LOT_VIZ, Bilder).
   Speicher (Präfix lm4.lot.): tab, loet, rf, fe, done ({id:true}), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus.
   Aufruf: lotlab.html?aufgabe=lot1 öffnet die Aufgabe. */
(function (root) {
  const C = root.LOT_CORE, D = root.LOT_DATA, V = root.LOT_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.lot.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s);
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2200, m.length * 55)); }
  function sheet(title, build) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sh-h"><b>${esc(title)}</b><button class="x" aria-label="Schließen">✕</button></div><div class="sh-b"></div></div>`;
    document.body.appendChild(bd);
    const close = () => bd.remove();
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
    $('.x', bd).onclick = close; build($('.sh-b', bd), close); return close;
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const b = $$('.backdrop'); if (b.length) b[b.length - 1].remove(); } });
  if (!C || !D || !V) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Löt-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">lotcore.js, lotdata.js oder lotviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['loet', '🔥', 'Lötstelle'], ['reflow', '♨️', 'Reflow'], ['fehler', '🔍', 'Fehlerbilder'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const LOET0 = { lot: 100, temp: 350, zeit: 3, flux: 'normal', alloy: 'sac', mass: 'normal' }, RF0 = { up: 2, hold: 90, peak: 245, down: 3, alloy: 'sac' };
  /* Grenzen der Regler (Übungsbereich) */
  const LIM = { lot: [20, 200, 5], temp: [200, 450, 5], zeit: [0.5, 8, 0.1], up: [0.5, 5, 0.1], hold: [20, 180, 5], peak: [205, 280, 1], down: [0.5, 8, 0.1] };
  const clampTo = (k, v) => Math.min(LIM[k][1], Math.max(LIM[k][0], Number.isFinite(+v) ? +v : LIM[k][0]));
  const sane = (o, base, keys) => { const r = Object.assign({}, base, o && typeof o === 'object' ? o : {}); keys.forEach(k => { r[k] = clampTo(k, r[k]); }); if (!C.ALLOYS[r.alloy]) r.alloy = 'sac'; return r; };
  const S = {
    tab: lsGet('tab', 'loet'),
    loet: sane(lsGet('loet', {}), LOET0, ['lot', 'temp', 'zeit']),
    rf: sane(lsGet('rf', {}), RF0, ['up', 'hold', 'peak', 'down']), rfT: null, rfPlay: 0,
    fe: lsGet('fe', { seite: 'tht', k: 'ziel' }),
    task: null, tq: null, tAns: {}, tRes: null, tFehl: {},
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (!['normal', 'kein', 'wenig'].includes(S.loet.flux)) S.loet.flux = 'normal';
  if (!['normal', 'masse'].includes(S.loet.mass)) S.loet.mass = 'normal';
  if (!D.defects.some(d => d.k === S.fe.k && d.seite === S.fe.seite)) S.fe = { seite: 'tht', k: 'ziel' };
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const UEB = 'Alle Zahlen in diesem Lab (Temperaturen, Zeiten, Mengen, Grenzen) sind Übungswerte und ein vereinfachtes Lernmodell. Maßgebend sind immer die Lötanweisung, das Datenblatt der Paste und die Vorgaben deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const CLS = { ziel: 'ok', annehmbar: 'ok', prozess: 'warn', fehler: 'bad', ok: 'ok', warn: 'warn', bad: 'bad' };
  const slider = (k, label, val, unit, d) => `<label class="f"><span>${esc(label)}: <b data-v="${k}">${esc(f(val, d))} ${esc(unit)}</b></span><input type="range" data-s="${k}" min="${LIM[k][0]}" max="${LIM[k][1]}" step="${LIM[k][2]}" value="${val}"></label>`;
  const chips = (attr, rows) => `<div class="ctl">${rows.map(r => `<button class="chip s" ${attr}="${esc(r[0])}">${esc(r[1])}</button>`).join('')}</div>`;
  const stage = (id, html) => `<div class="vzstage"><div class="vzbox" id="${id}">${html}</div></div>`;
  const finding = (n, lvl, txt, lv) => `<div class="rdout ${CLS[lvl]}"><span class="st">${esc(n)}${lv ? ' · ' + esc(lv) : ''}</span>${esc(txt)}</div>`;

  /* ============================================================ Reiter Lötstelle */
  const PRE_LOET = [['gut', 'Gute Lötstelle', { lot: 100, temp: 350, zeit: 3, flux: 'normal', mass: 'normal' }], ['kalt', 'Zu kalt', { temp: 240, zeit: 3 }], ['heiss', 'Zu heiß und zu lang', { temp: 430, zeit: 6 }], ['flux', 'Ohne Flussmittel', { flux: 'kein' }], ['masse', 'Massefläche', { mass: 'masse', zeit: 3 }], ['viel', 'Zu viel Lot', { lot: 190 }]];
  function renderLoet() {
    const s = S.loet;
    $('#loetView').innerHTML = ueb() + stage('loStage', '') +
      `<div class="card pl"><h4>Stelle die Lötstelle ein</h4>${chips('data-pre', PRE_LOET.map(p => [p[0], p[1]]))}
      ${slider('lot', 'Lotmenge', s.lot, '%', 0)}${slider('temp', 'Spitzentemperatur', s.temp, '°C', 0)}${slider('zeit', 'Lötzeit', s.zeit, 's', 1)}
      <div class="ctl"><span class="lbl2">Flussmittel</span>${seg('data-sg="flux" data-v', Object.keys(C.FLUX).map(k => [k, C.FLUX[k].n]), s.flux)}</div>
      <div class="ctl"><span class="lbl2">Lot</span>${seg('data-sg="alloy" data-v', Object.keys(C.ALLOYS).map(k => [k, C.ALLOYS[k].kurz]), s.alloy)}</div>
      <div class="ctl"><span class="lbl2">Lötauge</span>${seg('data-sg="mass" data-v', [['normal', 'normal'], ['masse', 'an Massefläche']], s.mass)}</div></div><div id="loOut"></div>`;
    loUpdate();
  }
  function loUpdate() {
    const s = S.loet, j = C.joint(s); if (!j) return;
    $('#loStage').innerHTML = V.jointSvg(j);
    const tips = j.tips.length ? `<div class="rdout"><span class="st">Was du ändern kannst</span><ul style="margin:4px 0 0 1.1em;padding:0">${j.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : '';
    $('#loOut').innerHTML = `<div class="rdout ${CLS[j.verdict]}"><span class="st">Gesamturteil (schlechtester Prüfpunkt)</span><b>${esc(C.LEVN[j.verdict])}</b></div>` +
      j.findings.map(x => finding(x.n, x.lvl, x.txt, C.LEVN[x.lvl])).join('') + tips +
      `<div class="vzbox full">${V.heatSvg(j)}</div><p class="hint2">Das Lötauge wird nach einer Aufheizkurve warm: Zuerst steigt die Temperatur schnell, dann immer langsamer. Das Lot fließt erst, wenn das Lötauge Schmelz- plus Fließreserve erreicht hat (Lernmodell).</p>`;
    lsSet('loet', s);
  }

  /* ============================================================ Reiter Reflow */
  const PRE_RF = [['gut', 'Gutes Profil', { up: 2, hold: 90, peak: 245, down: 3 }], ['steil', 'Zu steil', { up: 4.5, hold: 90, peak: 245, down: 3 }], ['kalt', 'Zu kalt', { up: 2, hold: 90, peak: 222, down: 3 }], ['lang', 'Zu lange Haltezeit', { up: 2, hold: 150, peak: 245, down: 3 }], ['heiss', 'Zu heiß', { up: 2, hold: 90, peak: 272, down: 3 }]];
  const rfNow = r => (S.rfT == null ? (r.t3 + r.t4) / 2 : Math.min(S.rfT, r.t5));
  function renderReflow() {
    const s = S.rf, r = C.reflow(s);
    $('#reflowView').innerHTML = ueb() + stage('rfStage', '') +
      `<div class="card pl"><h4>Stelle das Profil ein</h4>${chips('data-pre', PRE_RF.map(p => [p[0], p[1]]))}
      ${slider('up', 'Aufheizrate', s.up, 'K/s', 1)}${slider('hold', 'Haltezeit', s.hold, 's', 0)}${slider('peak', 'Spitzentemperatur', s.peak, '°C', 0)}${slider('down', 'Abkühlrate', s.down, 'K/s', 1)}
      <div class="ctl"><span class="lbl2">Lot</span>${seg('data-sg="alloy" data-v', Object.keys(C.ALLOYS).map(k => [k, C.ALLOYS[k].kurz]), s.alloy)}</div></div>
      <div class="card pl"><h4>Das Brett im Ofen</h4><label class="f"><span>Zeit im Ofen: <b id="rfTv"></b></span><input type="range" id="rfT" min="0" max="${Math.ceil(r.t5)}" step="1" value="${Math.round(rfNow(r))}"></label>
      <div class="btns"><button class="btn" id="rfPlay">▶ Ablauf zeigen</button></div></div><div id="rfOut"></div>`;
    rfUpdate();
  }
  function rfUpdate() {
    const s = S.rf, r = C.reflow(s); if (!r) return;
    const t = rfNow(r), st = C.reflowState(r, t), tr = $('#rfT');
    if (tr) { tr.max = Math.ceil(r.t5); tr.value = Math.round(t); }
    $('#rfTv').textContent = f(t, 0) + ' s';
    $('#rfStage').innerHTML = V.reflowSvg(r, { t });
    const kl = { gut: 'Gut: Alle Werte liegen im Richtbereich.', bedingt: 'Bedingt: Ein Wert liegt am Rand des Richtbereichs.', schlecht: 'Schlecht: Mindestens ein Wert liegt außerhalb.' }[r.urteil];
    $('#rfOut').innerHTML = `<div class="vzbox full">${V.ofenSvg(r, t)}</div><div class="vzbox">${V.chipSvg(st.phase, st.T)}</div>
      <div class="rdout ${r.urteil === 'gut' ? 'ok' : r.urteil === 'bedingt' ? 'warn' : 'bad'}"><span class="st">Urteil über das Profil</span><b>${esc(kl)}</b></div>
      <div class="rdout ${r.pasteOk ? 'ok' : 'bad'}"><span class="st">Paste am großen Bauteil</span>${r.pasteOk ? 'Schmilzt: Spitze ' + esc(f(r.peakBig, 0)) + ' °C, ' + esc(f(r.talB, 0)) + ' s über Schmelztemperatur.' : 'Schmilzt nicht sicher: Am großen Bauteil kommen nur ' + esc(f(r.peakBig, 0)) + ' °C an, ' + esc(f(r.talB, 0)) + ' s über Schmelztemperatur.'}</div>` +
      r.findings.map(x => finding(x.n, x.lvl, x.txt)).join('') +
      `<p class="hint2">Das große Bauteil nimmt Wärme langsamer auf und bleibt kälter als das kleine (Lernmodell). Die Spitze am Brett begrenzt das Bauteil mit der kleinsten Temperaturgrenze.</p>`;
    lsSet('rf', s);
  }
  function rfStop() { if (S.rfPlay) { clearInterval(S.rfPlay); S.rfPlay = 0; } const b = $('#rfPlay'); if (b) b.textContent = '▶ Ablauf zeigen'; }
  function rfStart() {
    const r = C.reflow(S.rf); if (!r) return;
    if (S.rfPlay) { rfStop(); return; }
    S.rfT = 0; $('#rfPlay').textContent = '⏸ Anhalten';
    S.rfPlay = setInterval(() => { const rr = C.reflow(S.rf); S.rfT = Math.min(rr.t5, S.rfT + rr.t5 / 80); rfUpdate(); if (S.rfT >= rr.t5) rfStop(); }, 90);
  }

  /* ============================================================ Reiter Fehlerbilder */
  function renderFehler() {
    const L = D.defects.filter(d => d.seite === S.fe.seite), d = L.find(x => x.k === S.fe.k) || L[0];
    $('#fehlerView').innerHTML = `<div class="fbar">${seg('data-fs', [['tht', 'Durchsteck (THT)'], ['smd', 'SMD']], S.fe.seite)}</div>
      <div class="ctl">${L.map(x => `<button class="chip s${x.k === d.k ? ' on' : ''}" data-fk="${x.k}">${esc(x.n)}</button>`).join('')}</div>` + stage('feStage', V.defectSvg(d.k)) +
      `<div class="rdout ${CLS[d.lvl]}"><span class="st">${esc(d.n)} · ${esc(C.LEVN[d.lvl])}</span><b>So sieht es aus:</b> ${esc(d.merk)}</div>
      <div class="rdout"><span class="st">Ursache</span>${esc(d.urs)}</div><div class="rdout"><span class="st">Was hilft</span>${esc(d.abh)}</div>
      <p class="hint2">Die Einstufung (Zielzustand, Annehmbar, Prozessindikator, Fehler) ist eine vereinfachte Lernübersicht. Welche Klasse deines Produkts gilt, steht in der Vorgabe deines Betriebs.</p>`;
  }

  /* ============================================================ Aufgaben und Trainer */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  function pctFor(id) { if (!exam()) return 100; return 100 - 25 * Math.min(2, lsGet('ctipps', {})[id] || 0); }
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    const d = done(); d[id] = true; lsSet('done', d); updateBadge(); updatePal();
  }
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : f(q.value, 2) + ' ' + q.ask.unit);
  const eingabeHinweis = q => q.ask.type === 'num' ? `<p class="lr-hinweis hint2">Zahl in ${esc(q.ask.unit)}.${q.tol > 0.011 ? ' ±' + esc(f(q.tol, 2)) + ' ' + esc(q.ask.unit) + ' gelten als richtig (wegen Rundung).' : ''}</p>` : '';
  const stufeFuer = (ok, fehl, ex) => ok ? 'ok' : ex ? 'pruef' : fehl >= 2 ? 'loes' : 'tipp';
  const zeigFb = el => { try { const x = el && el.querySelector('.lr-fb'); if (x && root.LabRahmen) root.LabRahmen.zeig(x); } catch (e) {} };
  const how = q => `<div class="rdout"><span class="st">So gehst du vor</span><ol style="margin:4px 0 0 1.2em;padding:0">${q.how.map(h => `<li>${esc(h)}</li>`).join('')}</ol></div>`;
  function qBody(q, a, r) {
    const lock = r && (r.ok || r.stufe === 'loes');
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${lock ? 'disabled' : ''} class="${lock && i === q.ask.correct ? 'ok' : a.c === i ? (r && !r.ok && r.given === c ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)} (${esc(q.ask.unit)})</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${lock ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div>${eingabeHinweis(q)}</label>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 2) + ' ' + q.ask.unit };
  }
  function fbHTML(q, r) {
    if (r.stufe === 'ok') return `<div class="lr-fb ok fb"><p><strong>✓ Richtig:</strong> ${esc(r.given)}</p><p><strong>Lösungsweg:</strong> ${esc(q.expl)}</p></div>`;
    const ist = '<strong>Noch nicht:</strong> Deine Antwort „' + esc(r.given) + '“ stimmt nicht.';
    if (r.stufe === 'tipp') return `<div class="lr-fb tipp fb"><p>${ist}</p><p><strong>Tipp:</strong> ${esc(q.tips[0])} Du hast einen zweiten Versuch.</p></div>`;
    if (r.stufe === 'loes') return `<div class="lr-fb loes fb"><p>${ist}</p><p><strong>Lösung:</strong> ${esc(solText(q))}</p><p><strong>Lösungsweg:</strong> ${esc(q.expl)}</p></div>`;
    return `<div class="lr-fb tipp fb"><p>${ist}</p><p>🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp (kostet 25 %) oder versuche es noch einmal.</p></div>`;
  }

  function renderTasks(top) {
    const Vw = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${how(q)}${qBody(q, a, r)}`;
      if (r) h += fbHTML(q, r);
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && (r.ok || r.stufe === 'loes') ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r && (r.ok || r.stufe === 'loes')) h += '<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>';
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    Vw.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    const fehl = e.ok ? 0 : (S.tFehl[t.id] = (S.tFehl[t.id] || 0) + 1); S.tRes = { id: t.id, ok: e.ok, given: e.given, pct, stufe: stufeFuer(e.ok, fehl, exam()) };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast(S.tRes.stufe === 'loes' ? 'Lösung und Lösungsweg stehen unter der Aufgabe.' : 'Noch nicht richtig. Lies den Tipp und versuche es noch einmal.'); }
    renderTasks(false); zeigFb($('#taskView'));
  }
  function hintFor(q, id) {
    const h = lsGet('hints', {}), n = Math.min(2, (h[id] || 0) + 1), ex = exam(); h[id] = Math.max(h[id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 2', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(q.tips[0])}</p>`; if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(q.tips[1])}</p>`;
      x += n >= 2 ? '<p class="hint2">Mehr Tipps gibt es nicht. Den Lösungsweg siehst du nach dem Prüfen.</p>' : '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“.</p>';
      x += ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  function startTask(id) {
    const t = TASKS.find(x => x.id === id); if (!t) return;
    S.task = id; S.tq = D.makeTask(t); S.tAns = {}; S.tRes = null; S.tFehl[id] = 0;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  const tv = $('#taskView');
  tv.addEventListener('input', e => { const t = curTask(); if (t && e.target.dataset.in) (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintFor(S.tq, t.id); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });

  /* Zufalls-Trainer (Tipps kosten hier nie etwas) */
  function newTrainer() { const T = S.tr; T.q = D.randomQ(R0, T.level); T.ans = {}; T.res = null; T.fehl = 0; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar"><span class="lbl2" style="font-size:14px;color:var(--mute)">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p style="margin:8px 0">${esc(q.text)}</p>${how(q)}${qBody(q, T.ans, T.res)}${T.res ? fbHTML(q, T.res) : ''}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res && T.res.stufe !== 'tipp' ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res && T.res.stufe !== 'tipp' ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res && T.res.stufe !== 'tipp' ? 'Nächste Frage' : 'Überspringen'}</button></div></div>`;
    if (T.res) zeigFb($('#rtView'));
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr.ans.v = e.target.value; });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (tc && (!T.res || T.res.stufe === 'tipp')) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if ((!T.res || T.res.stufe === 'tipp') && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res && T.res.stufe !== 'tipp') return; const e = evalQ(T.q, T.ans); if (!e) return;
    if (!e.ok && !T.fehl) { T.fehl = 1; T.res = { ok: false, given: e.given, stufe: 'tipp' }; sad(); renderTrainer(); return; }
    T.res = { ok: e.ok, given: e.given, stufe: e.ok ? 'ok' : 'loes' }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Worum es geht', '<p>Das Lab übt das Löten in der Elektronikfertigung und das Beurteilen von Lötstellen, wie du es für die Lötprüfung brauchst: <b>Modul 1 (THT, Durchsteckbauteile)</b> und <b>Modul 2 (SMD)</b>. Die Beurteilung folgt dem allgemein bekannten Gedanken der Lötnorm IPC-A-610: Zielzustand, annehmbar, Prozessindikator, Fehler. Die genauen Maße und Kriterien findest du dort und in deiner Vorgabe, hier stehen sie nicht.</p>', true) +
      sec('Reiter Lötstelle', '<p>Stelle Lotmenge, Spitzentemperatur und Lötzeit ein und wähle Flussmittel, Lot und Lötauge. Das Bild zeigt die Lötstelle im Schnitt mit dem Benetzungswinkel. Darunter siehst du, wie warm das Lötauge wird und wie lange das Lot fließen kann.</p><span class="eq">Benetzungswinkel klein = flach ausgebreitet = gut benetzt</span><span class="eq">Hülse gefüllt = Lot ist bis nach oben gestiegen</span><p>Vier Prüfpunkte werden bewertet: Temperatur und Zeit, Lotmenge, Benetzung, Durchstieg. Der schlechteste bestimmt das Gesamturteil.</p>') +
      sec('Reiter Reflow', '<p>Beim Reflow-Löten wird Lotpaste auf die Pads gedruckt, die Bauteile werden aufgesetzt und das ganze Brett läuft durch einen Ofen mit mehreren Zonen: Vorwärmen, Halten, Spitze, Abkühlen.</p><span class="eq">Zeit über Schmelztemperatur (TAL) = Dauer, in der das Lot flüssig ist</span><span class="eq">Zeit = Temperaturunterschied / Rate</span><p>Die Regler Aufheizrate, Haltezeit, Spitze und Abkühlrate zeigen, was zu steil, zu heiß, zu kalt oder zu lang bedeutet. Das große Bauteil bleibt kälter als das kleine, darum muss die Paste auch dort schmelzen.</p>') +
      sec('Fehlerbilder', '<p>Sammlung der typischen Fehler bei THT und SMD mit Aussehen, Ursache und Abhilfe: zu wenig oder zu viel Lot, kalte Lötstelle, schlecht benetzt, Lötbrücke, Lunker, überhitzt, Lotkugeln, Grabstein, Brücke am IC.</p>') +
      sec('ESD und Arbeitsschutz', '<p>Elektronische Bauteile nur mit ESD-Schutz anfassen: Armband mit Schutzwiderstand, ableitfähige Unterlage, ESD-Verpackung. Beim Löten Dämpfe absaugen, heiße Spitze sicher ablegen, Hände nach dem Löten waschen, Schutzbrille bei Spritzern. Es gelten die Betriebsanweisungen deines Betriebs.</p>') +
      '<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte.</p>';
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'loet'; rfStop(); S.tab = t;
    /* Bilder tragen feste Verlauf-Kennungen: nur der sichtbare Reiter behält sein SVG (versteckte SVGs würden die Verläufe der anderen sperren) */
    ['loet', 'reflow', 'fehler'].forEach(k => { if (k !== t) $('#' + k + 'View').innerHTML = ''; }); lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ loet: renderLoet, reflow: renderReflow, fehler: renderFehler, tasks: renderTasks, rt: renderTrainer, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Löt-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Löt-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); palSig = ''; updatePal(); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n, S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Frage im Trainer">🎲 Zufallsaufgabe</button>
      <span id="stat">Aufgaben gelöst <b>${n}/${TASKS.length}</b> · Serie <b>${S.rt.streak}</b> · Beste Serie <b>${S.rt.best}</b></span>`;
    $('#bExam').classList.toggle('on', exam()); $('#bExam').setAttribute('aria-pressed', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { setTab('rt'); newTrainer(); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('loet');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe', 'Lötstelle, Reflow, Fehlerbilder, ESD'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Regler und Knöpfe der Reiter Lötstelle und Reflow */
  function onSlide(st, k, v, upd) { st[k] = clampTo(k, v); const b = $('[data-v="' + k + '"]'); if (b) b.textContent = f(st[k], LIM[k][2] < 1 ? 1 : 0) + ' ' + { lot: '%', temp: '°C', zeit: 's', up: 'K/s', hold: 's', peak: '°C', down: 'K/s' }[k]; upd(); }
  function pick(st, e, renderer, setT) {
    const pr = e.target.closest('[data-pre]'), sg = e.target.closest('[data-sg]'); if (!pr && !sg) return;
    if (pr) { const x = (st === S.loet ? PRE_LOET : PRE_RF).find(p => p[0] === pr.dataset.pre); Object.assign(st, x[2]); } else st[sg.dataset.sg] = sg.dataset.v;
    if (setT) S.rfT = null; rfStop(); renderer();
  }
  $('#loetView').addEventListener('input', e => { const k = e.target.dataset.s; if (k) onSlide(S.loet, k, +e.target.value, loUpdate); });
  $('#loetView').addEventListener('click', e => pick(S.loet, e, renderLoet, false));
  $('#reflowView').addEventListener('input', e => {
    if (e.target.id === 'rfT') { rfStop(); S.rfT = +e.target.value; rfUpdate(); return; }
    const k = e.target.dataset.s; if (k) { rfStop(); S.rfT = null; onSlide(S.rf, k, +e.target.value, rfUpdate); }
  });
  $('#reflowView').addEventListener('click', e => { if (e.target.closest('#rfPlay')) { rfStart(); return; } pick(S.rf, e, renderReflow, true); });
  $('#fehlerView').addEventListener('click', e => {
    const fs = e.target.closest('[data-fs]'), fk = e.target.closest('[data-fk]');
    if (fs) S.fe = { seite: fs.dataset.fs, k: D.defects.find(d => d.seite === fs.dataset.fs).k }; else if (fk) S.fe.k = fk.dataset.fk; else return;
    lsSet('fe', S.fe); renderFehler();
  });

  /* Schnittstelle für Karriere/Lernpfad */
  root.LOT_LAB = { id: 'lot', title: 'Löt-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.LOT_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'loet');
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
