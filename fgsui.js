'use strict';
/* Tonfunk Fachgespräch-Lab: Oberfläche (Lab-Kennung 'fgs').
   ALLE Zahlen (Zeiten, Puffer, Anteile, Gewichte, Punkte) sind ÜBUNGSWERTE für die Ausbildung, keine Vorgaben einer Prüfung.
   Reiter: Zeitplan (Regler, Balkenplan), Vortrag (Regler, Zeit-Uhr, Folien), Fachgespräch (Übungsmodus mit Selbsteinschätzung), Aufgaben, Trainer, Hilfe.
   Module: fgscore.js (FGS_CORE, Rechenlogik), fgsdata.js (FGS_DATA, FGS_TASKS), fgsviz.js (FGS_VIZ, Grafiken).
   Speicher (Präfix lm4.fgs.): tab, zp, vt, fg ({Frage-Nr: {fach, beg, term, verst}} je 0, 1 oder 2), done ({id:true}), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Kein Mikrofon, keine Aufnahme: Du sprichst laut für dich und schätzt dich danach selbst ein.
   Aufruf: fgslab.html?aufgabe=fgs1 öffnet die Aufgabe. */
(function (root) {
  const C = root.FGS_CORE, D = root.FGS_DATA, V = root.FGS_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.fgs.';
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Fachgespräch-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">fgscore.js, fgsdata.js oder fgsviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['zp', '🗓️', 'Zeitplan'], ['vt', '🎤', 'Vortrag'], ['fg', '💬', 'Fachgespräch'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const STEPS = ['Auftrag lesen', 'Material holen', 'Aufbauen', 'Prüfen', 'Protokoll'];
  const S = {
    tab: lsGet('tab', 'zp'),
    zp: Object.assign({ d: [15, 20, 60, 30, 25], pct: 20, start: 450 }, lsGet('zp', {})),
    vt: Object.assign({ total: 15, pe: 15, ps: 15, per: 1.5 }, lsGet('vt', {})),
    fg: { ph: 0, i: 0, step: 'denk', shown: 0 },
    task: null, tq: null, tAns: {}, tRes: null, tFehl: {},
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  const inRange = (v, a, b) => typeof v === 'number' && v >= a && v <= b;
  if (!Array.isArray(S.zp.d) || S.zp.d.length !== 5 || !S.zp.d.every(v => inRange(v, 5, 120))) S.zp.d = [15, 20, 60, 30, 25];
  if (!inRange(S.zp.pct, 0, 40)) S.zp.pct = 20;
  if (!inRange(S.zp.start, 360, 600)) S.zp.start = 450;
  if (!inRange(S.vt.total, 5, 30)) S.vt.total = 15;
  if (!inRange(S.vt.pe, 5, 30)) S.vt.pe = 15;
  if (!inRange(S.vt.ps, 5, 30)) S.vt.ps = 15;
  if (![1, 1.5, 2].includes(S.vt.per)) S.vt.per = 1.5;
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span><b>${esc(res)}</b></div>`;
  const UEB = 'Alle Zahlen in diesem Lab (Zeiten, Puffer, Anteile, Gewichte, Punkte) sind Übungswerte für die Ausbildung. Maßgebend sind immer die Vorgaben deines Betriebs, deiner Ausbilder und der Prüfungsordnung.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const slider = (key, label, out, val, min, max, step) => `<label class="f"><span>${esc(label)}: <b data-o="${key}">${esc(out)}</b></span><input type="range" data-s="${key}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
  const setOut = (key, v) => { const e = $('[data-o="' + key + '"]'); if (e) e.textContent = v; };
  const still = el => el.classList.add('still');

  /* ============================================================ Zeitplan */
  const zpG = () => C.gantt(STEPS.map((n, i) => ({ n, d: S.zp.d[i] })), S.zp.start, S.zp.pct);
  function zpOut() {
    const g = zpG(), ck = C.clock, late = g.end > 16 * 60;
    return box('Summe der Schritte', f(g.sum, 0) + ' min') + box('Puffer: ' + f(S.zp.pct, 0) + ' % der Summe', f(g.buf.d, 1) + ' min') + box('Gesamt mit Puffer', f(g.total, 1) + ' min') +
      box('Fertig um', ck(g.end) + ' Uhr', late ? 'warn' : 'ok') + (late ? `<div class="rdout warn">Das ist nach 16:00 Uhr (Übungswert für das Schichtende). Kürze einen Schritt oder beginne früher.</div>` : '');
  }
  function renderZp() {
    const g = zpG();
    $('#zpView').innerHTML = `<p class="hint2" style="margin:0 0 6px">Ein Arbeitsauftrag wird in Schritte zerlegt. Stelle die Dauer jedes Schrittes ein: Der Puffer in Prozent kommt hinten dazu, und du siehst, wann du fertig bist.</p>
      <div class="inst" id="zpSvg">${V.ganttSvg(g)}</div>
      <div class="card pl"><h4>Dauer der Schritte</h4>${STEPS.map((n, i) => slider('zd' + i, n, f(S.zp.d[i], 0) + ' min', S.zp.d[i], 5, 120, 5)).join('')}${slider('zpct', 'Puffer', f(S.zp.pct, 0) + ' %', S.zp.pct, 0, 40, 5)}${slider('zstart', 'Beginn', C.clock(S.zp.start) + ' Uhr', S.zp.start, 360, 600, 15)}</div>
      <div id="zpOut">${zpOut()}</div><p class="hint2">Merke: Der Puffer gilt für die Summe aller Schritte. Plane ihn ein, bevor etwas schiefgeht.</p>${ueb()}`;
  }
  function updateZp() { const el = $('#zpSvg'); still(el); el.innerHTML = V.ganttSvg(zpG()); $('#zpOut').innerHTML = zpOut(); }
  $('#zpView').addEventListener('input', e => {
    const k = e.target.dataset.s, v = +e.target.value; if (!k || !Number.isFinite(v)) return;
    if (k === 'zpct') { S.zp.pct = v; setOut(k, f(v, 0) + ' %'); }
    else if (k === 'zstart') { S.zp.start = v; setOut(k, C.clock(v) + ' Uhr'); }
    else { S.zp.d[+k.slice(2)] = v; setOut(k, f(v, 0) + ' min'); }
    lsSet('zp', S.zp); updateZp();
  });

  /* ============================================================ Vortrag */
  const vtP = () => C.partMinutes(S.vt.total, S.vt.pe, S.vt.ps);
  function vtOut() {
    const p = vtP(), n = C.slideCount(S.vt.total, S.vt.per), sp = C.slideSplit(n, S.vt.pe, S.vt.ps), pc = [S.vt.pe, 100 - S.vt.pe - S.vt.ps, S.vt.ps], nm = V.PNAME, mn = [p.e, p.h, p.s];
    return `<div class="stats">${[0, 1, 2].map(i => `<div class="bx"><b>${esc(f(mn[i], 1))}</b>${nm[i]} (min)</div>`).join('')}</div>` +
      box('Anteile', pc.map(x => f(x, 0) + ' %').join(' · ')) + box('Folien bei ' + f(S.vt.per, 1) + ' min je Folie', n + (sp ? ' (' + sp.e + ' + ' + sp.h + ' + ' + sp.s + ')' : '')) +
      `<div class="rdout">Jede Folie trägt einen Gedanken. Der Hauptteil bekommt die meisten Folien, Einstieg und Schluss brauchen jeweils mindestens eine.</div>`;
  }
  function renderVt() {
    const v = S.vt;
    $('#vtView').innerHTML = `<p class="hint2" style="margin:0 0 6px">Ein Vortrag hat Einstieg, Hauptteil und Schluss. Stelle die Länge und die Anteile ein: Du siehst, wie viele Minuten jeder Teil hat und wie viele Folien du brauchst.</p>
      <div class="inst" id="vtSvg">${V.vortragSvg(v)}</div>
      <div class="card pl"><h4>Länge und Anteile</h4>${slider('total', 'Länge des Vortrags', f(v.total, 0) + ' min', v.total, 5, 30, 1)}${slider('pe', 'Einstieg', f(v.pe, 0) + ' %', v.pe, 5, 30, 5)}${slider('ps', 'Schluss', f(v.ps, 0) + ' %', v.ps, 5, 30, 5)}
      <span style="font-size:14px;color:var(--mute)">Minuten je Folie</span><div class="seg" id="vtPer">${[1, 1.5, 2].map(x => `<button data-per="${x}" class="${v.per === x ? 'on' : ''}">${f(x, 1)}</button>`).join('')}</div></div>
      <div id="vtOut">${vtOut()}</div>${ueb()}`;
  }
  function updateVt() { const el = $('#vtSvg'); still(el); el.innerHTML = V.vortragSvg(S.vt); $('#vtOut').innerHTML = vtOut(); }
  $('#vtView').addEventListener('input', e => {
    const k = e.target.dataset.s, v = +e.target.value; if (!k || !Number.isFinite(v)) return;
    S.vt[k] = v; setOut(k, f(v, 0) + (k === 'total' ? ' min' : ' %')); lsSet('vt', S.vt); updateVt();
  });
  $('#vtView').addEventListener('click', e => {
    const b = e.target.closest('[data-per]'); if (!b) return;
    S.vt.per = +b.dataset.per; lsSet('vt', S.vt); $$('#vtPer button').forEach(x => x.classList.toggle('on', x === b)); updateVt();
  });

  /* ============================================================ Fachgespräch (Übungsmodus) */
  const fgAll = () => lsGet('fg', {});
  const pool = ph => D.fragen.filter(x => x.ph === D.phasen[ph].k);
  const curQ = () => pool(S.fg.ph)[S.fg.i % pool(S.fg.ph).length];
  const rated = r => r && D.krit.every(k => r[k.k] === 0 || r[k.k] === 1 || r[k.k] === 2);
  const qPct = r => C.selfPct(D.krit.map(k => r[k.k]));
  function fgSummary() {
    const all = fgAll();
    return D.phasen.map((p, i) => { const l = pool(i).filter(x => rated(all[x.id])).map(x => qPct(all[x.id])), a = C.avg(l); return `<div class="row" style="cursor:default;padding:8px 4px"><span style="flex:none;width:118px;font-size:14px">${esc(p.kurz)}</span><div class="bar"><i style="width:${Number.isFinite(a) ? a : 0}%"></i></div><b style="flex:none;width:58px;text-align:right;font-size:14px">${Number.isFinite(a) ? f(a, 0) + ' %' : 'offen'}</b></div>`; }).join('');
  }
  function renderFg() {
    const F = S.fg, q = curQ(), all = fgAll(), r = all[q.id] || {}, step = F.step;
    let h = `<p class="hint2" style="margin:0 0 6px">Übe das Fachgespräch allein: Lies die Leitfrage, antworte laut, vergleiche mit den Stichpunkten und schätze dich selbst ein. Nichts wird aufgenommen, deine Einschätzungen bleiben nur auf diesem Gerät.</p>
      <div class="inst" id="fgSvg">${V.konvSvg({ ph: F.ph, step })}</div>
      <div class="fbar"><div class="seg">${D.phasen.map((p, i) => `<button data-fph="${i}" class="${F.ph === i ? 'on' : ''}">${esc(p.kurz)}</button>`).join('')}</div></div>
      <div class="card pl"><h4>Leitfrage · ${esc(D.phasen[F.ph].n)}</h4><div class="big" style="font-size:18px">${esc(q.q)}</div>`;
    if (step === 'denk') h += `<p>1. Nachdenken: Lies die Frage und überlege kurz. Du darfst dir Zeit nehmen.</p><div class="btns"><button class="btn pri" data-fa="sprech">Ich antworte jetzt</button><button class="btn" data-fa="next">Andere Frage</button></div>`;
    else if (step === 'sprech') h += `<p>2. Sprich laut: Antworte so, als säße ein Prüfer vor dir, ein bis zwei Minuten. Bei „Ich weiß es nicht genau“ sagst du, was du sicher weißt und wie du es herausfinden würdest.</p><div class="btns"><button class="btn pri" data-fa="zeig">Fertig gesprochen</button><button class="btn" data-fa="denk">Zurück</button></div>`;
    else if (step === 'zeig') {
      h += `<p>3. Vergleiche: Decke die Stichpunkte einer guten Antwort nach und nach auf. Was hast du genannt, was fehlt?</p><ul class="pts">${q.pts.map((x, i) => i < F.shown ? `<li>${esc(x)}</li>` : '').join('')}</ul>`;
      h += `<div class="btns">${F.shown < q.pts.length ? `<button class="btn pri" data-fa="more">Nächsten Stichpunkt zeigen (${F.shown}/${q.pts.length})</button>` : '<button class="btn pri" data-fa="bew">Weiter zur Bewertung</button>'}${F.shown < q.pts.length ? '<button class="btn" data-fa="all">Alle zeigen</button>' : ''}</div>`;
    } else {
      h += `<p>4. Schätze dich ein: Wie gut hast du die Frage beantwortet?</p>`;
      h += D.krit.map(k => `<div style="margin:8px 0"><div style="font-size:14.5px"><b>${esc(k.n)}</b> <span class="hint2">${esc(k.d)}</span></div><div class="seg" data-rk="${k.k}">${[[0, 'Nein'], [1, 'Teils'], [2, 'Ja']].map(o => `<button data-rv="${o[0]}" class="${r[k.k] === o[0] ? 'on' : ''}">${o[1]}</button>`).join('')}</div></div>`).join('');
      if (rated(r)) { const p = qPct(r); h += `<div class="rdout ${p >= 85 ? 'ok' : p >= 60 ? '' : 'warn'}"><span class="st">Deine Selbsteinschätzung</span><b>${esc(f(p, 0))} %</b><div class="bar"><i style="width:${p}%"></i></div>${esc(p >= 85 ? 'Sehr sicher. Probiere die nächste Frage.' : p >= 60 ? 'Gute Basis. Wiederhole die Punkte, bei denen du „Nein“ oder „Teils“ gewählt hast.' : 'Noch unsicher. Lies die Stichpunkte noch einmal und beantworte die Frage ein zweites Mal laut.')}</div>`; }
      h += `<div class="btns"><button class="btn pri" data-fa="next">Nächste Frage</button><button class="btn" data-fa="denk">Nochmal diese Frage</button></div>`;
    }
    h += `</div><div class="card pl"><h4>Dein Stand je Phase</h4>${fgSummary()}<p class="hint2">Der Wert ist der Durchschnitt deiner Selbsteinschätzungen. Je ehrlicher du dich einschätzt, desto mehr hilft er dir.</p></div>${ueb()}`;
    $('#fgView').innerHTML = h;
  }
  function fgNext() { const F = S.fg; F.i = (F.i + 1) % pool(F.ph).length; F.step = 'denk'; F.shown = 0; }
  $('#fgView').addEventListener('click', e => {
    const F = S.fg, ph = e.target.closest('[data-fph]'), fa = e.target.closest('[data-fa]'), rv = e.target.closest('[data-rv]');
    if (ph) { F.ph = +ph.dataset.fph; F.i = 0; F.step = 'denk'; F.shown = 0; renderFg(); return; }
    if (rv) { const k = rv.parentElement.dataset.rk, all = fgAll(), q = curQ(); all[q.id] = Object.assign({}, all[q.id], { [k]: +rv.dataset.rv }); lsSet('fg', all); renderFg(); return; }
    if (!fa) return; const a = fa.dataset.fa, q = curQ();
    if (a === 'next') fgNext(); else if (a === 'more') F.shown = Math.min(q.pts.length, F.shown + 1); else if (a === 'all') F.shown = q.pts.length; else { F.step = a; if (a === 'zeig') F.shown = 0; }
    renderFg();
  });

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
  const tblHtml = q => (q.table ? `<div class="tw"><table class="tt"><tr>${q.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${q.table.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>` : '');
  const steps = q => `<details class="vor"><summary>So gehst du vor</summary><ol>${q.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></details>`;
  const eingabeHinweis = q => q.ask.type === 'num' ? `<p class="lr-hinweis hint2">Zahl in ${esc(q.ask.unit)}.${q.tol > 0.011 ? ' ±' + esc(f(q.tol, 2)) + ' ' + esc(q.ask.unit) + ' gelten als richtig (wegen Rundung).' : ''}</p>` : '';
  const stufeFuer = (ok, fehl, ex) => ok ? 'ok' : ex ? 'pruef' : fehl >= 2 ? 'loes' : 'tipp';
  const zeigFb = el => { try { const x = el && el.querySelector('.lr-fb'); if (x && root.LabRahmen) root.LabRahmen.zeig(x); } catch (e) {} };
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
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${tblHtml(q)}${steps(q)}${qBody(q, a, r)}`;
      if (r) h += fbHTML(q, r);
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && (r.ok || r.stufe === 'loes') ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r && (r.ok || r.stufe === 'loes')) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`;
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
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p style="margin:8px 0">${esc(q.text)}</p>${tblHtml(q)}${steps(q)}${qBody(q, T.ans, T.res)}${T.res ? fbHTML(q, T.res) : ''}
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
      `<div class="rdout warn">⚠ ${esc(UEB)}</div><div class="inst">${V.wegSvg(-1)}</div>` +
      sec('Ausbildung und Unterweisungen', `<p><b>Unterweisung:</b> Du lernst Gefahren und Schutzmaßnahmen kennen, bevor du arbeitest. Sie wird regelmäßig wiederholt und vor jedem neuen Arbeitsplatz gegeben. Mit deiner Unterschrift bestätigst du, dass sie stattgefunden hat.</p><p><b>Betriebsanweisung:</b> Anwendungsbereich, Gefahren, Schutzmaßnahmen und Verhalten, Verhalten bei Störungen, Erste Hilfe, Entsorgung.</p><p><b>ESD:</b> Baugruppen am Rand anfassen, ableitfähige Unterlage, Erdung über das Armband, ESD-Verpackung. Der Schulungsnachweis gehört dazu.</p><p><b>Berichtsheft:</b> regelmäßig führen und abzeichnen lassen. Es ist eine Voraussetzung für die Zulassung zur Abschlussprüfung. <b>Beurteilung:</b> besprechen, nachfragen, Ziele ableiten.</p>`, true) +
      sec('Arbeitsauftrag planen', `<span class="eq">Summe = alle Schrittzeiten addiert</span><span class="eq">Puffer (min) = Summe · Prozent / 100</span><span class="eq">Gesamtzeit = Summe + Puffer</span><span class="eq">Puffer (%) = Puffer / Summe · 100</span><span class="eq">Fertig um = Beginn + Gesamtzeit (60 min = 1 h)</span><span class="eq">Aufträge je Schicht = (Schicht − Pausen − Rüsten) / Zeit je Auftrag, abgerundet</span><p>Reihenfolge: Auftrag lesen, Material und Prüfmittel bereitlegen, aufbauen, prüfen, Protokoll, Übergabe. Prüfmittel brauchen eine gültige Kalibrierung. Ins Protokoll gehören die echten Werte.</p>`) +
      sec('Präsentation vorbereiten', `<p><b>Einstieg</b> (Thema, Interesse), <b>Hauptteil</b> (Inhalt), <b>Schluss</b> (Zusammenfassung, Fazit).</p><span class="eq">Hauptteil (%) = 100 − Einstieg − Schluss</span><span class="eq">Minuten = Vortragszeit · Anteil / 100</span><span class="eq">Folien = Vortragszeit / Minuten je Folie, abgerundet</span><span class="eq">Vortragszeit = Termin · (100 − Fragen in %) / 100</span><p>Eine Folie, ein Gedanke. Wenig Text, große Schrift, starker Kontrast. Probelauf mit Stoppuhr, laut gesprochen.</p>`) +
      sec('Fachgespräch führen', `<p>Das Übungsgespräch hat fünf Phasen: ${D.phasen.map(p => esc(p.n)).join(', ')}.</p><p><b>Gute Antwort:</b> Kernaussage, Begründung („weil“), Beispiel aus deinem Auftrag, richtige Fachbegriffe. <b>Wenn du etwas nicht weißt:</b> ehrlich sagen, was du sicher weißt, und wie du es herausfinden würdest. Bei Unklarheit höflich nachfragen. Eine kurze Denkpause ist in Ordnung.</p><p><b>Selbsteinschätzung:</b> Je Kriterium Nein (0), Teils (1), Ja (2). Ergebnis = Summe / (2 · Zahl der Kriterien) · 100.</p>`) +
      sec('Bewerten und Rückmeldung', `<span class="eq">Prozent = erreichte Punkte / mögliche Punkte · 100</span><span class="eq">Gewichteter Wert = Summe von (Gewicht · Punkte / höchste Punktzahl), Gewichte zusammen 100 %</span><span class="eq">Unterschied = Selbsteinschätzung − Bewertung (in Prozentpunkten)</span><p>Gute Kriterien kann man beobachten. Rückmeldung: erst das Gelungene, dann konkret beschreiben und einen Vorschlag machen. Kritik annehmen: zuhören, nachfragen, bedanken, entscheiden.</p><p class="hint2">Alle Punkte, Gewichte und Prozente sind Übungswerte, kein Bewertungsschlüssel einer Prüfung.</p>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'zp'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ zp: renderZp, vt: renderVt, fg: renderFg, tasks: renderTasks, rt: renderTrainer, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Fachgespräch-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Fachgespräch-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('zp');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe und Formeln', 'Unterweisung, Zeitplan, Vortrag, Fachgespräch, Bewertung'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben, Trainer-Serie und Selbsteinschätzungen auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps, die Trainer-Serie und deine Selbsteinschätzungen werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt', 'fg'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); if (S.tab === 'fg') renderFg(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.FGS_LAB = { id: 'fgs', title: 'Fachgespräch-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.FGS_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'zp');
  /* Aufruf ?aufgabe=fgs1 (Startseite, Lernhefte) öffnet die Aufgabe */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
