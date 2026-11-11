'use strict';
/* Tonfunk Linux-Terminal-Lab: Oberfläche (Lab-Kennung 'lin').
   REIN SIMULIERT: Das Terminal läuft nur in diesem Browserfenster (JavaScript, virtuelles Dateisystem). Es startet nichts auf dem echten Rechner.
   Reiter: Terminal (freies Üben), Rechte (chmod-Rechner), Cron (Zeitangaben lesen), Aufgaben, Trainer, Beispiele, Hilfe.
   Module: lincore.js (LIN_CORE: Dateisystem, Befehlsinterpreter, Cron), lindata.js (LIN_DATA, LIN_TASKS: Abbild, Aufgaben, Beispiele).
   Speicher (Präfix lm4.lin.): tab, rechte, cron, th (Hinweise im Terminal), done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: linlab.html?aufgabe=lin1 öffnet die Aufgabe, linlab.html?bsp öffnet die Beispiele (?bsp=nav1 springt zu einem Beispiel). */
(function (root) {
  const C = root.LIN_CORE, D = root.LIN_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.lin.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 0 : d, true), P = s => C.parseDe(s);
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
  if (!C || !D) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Linux-Terminal-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">lincore.js oder lindata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['term', '🖥️', 'Terminal'], ['rechte', '🔐', 'Rechte'], ['cron', '⏰', 'Cron'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const WELCOME = 'Willkommen im Linux-Terminal-Lab. Alles hier ist simuliert: Du kannst nichts kaputt machen.\nTipps: help zeigt die Befehle, Tab vervollständigt, mit den Pfeiltasten holst du alte Befehle zurück.';
  const newTS = (sys, banner) => ({ sys, lines: banner ? [{ k: 'h', s: banner }] : [], hist: [], hi: 0 });
  const S = {
    tab: lsGet('tab', 'term'),
    term: newTS(D.image(), WELCOME),
    rechte: Object.assign({ mode: '754', um: '022' }, lsGet('rechte', {})),
    cron: Object.assign({ expr: '*/15 8-17 * * 1-5' }, lsGet('cron', {})),
    task: null, tq: null, tAns: {}, tRes: null, tterm: null, showSol: false,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  const hintsOn = () => lsGet('th', '1') !== '0';
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span><b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const SIM = 'Alles in diesem Lab ist simuliert: ein virtuelles Dateisystem und ein kleiner Befehlsinterpreter in JavaScript. Es wird nichts auf deinem echten Rechner ausgeführt oder verändert. Auf einem echten Linux-System können dieselben Befehle viel anrichten (besonders rm und sudo).';
  const sim = () => `<div class="rdout warn">⚠ ${esc(SIM)}</div>`;

  /* ============================================================ Terminal-Baustein */
  function lineHtml(l) { return `<div class="tl ${l.k}">${esc(l.s)}</div>`; }
  function mountTerm(host, ts, opt) {
    opt = opt || {};
    host.innerHTML = `<div class="term" data-term><div class="tout" role="log" aria-label="Terminalausgabe"></div><label class="tline"><span class="tprompt"></span><input class="tin" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="send" aria-label="Befehl eingeben"></label></div>
      <div class="tkeys" aria-label="Sondertasten">${[['Tab', 'tab'], ['↑', 'up'], ['↓', 'down'], ['|', '|'], ['>', '>'], ['>>', '>>'], ['2>', '2>'], ['&', '&'], ['~', '~'], ['/', '/'], ['..', '..'], ['-', '-'], ['*', '*'], ['$', '$']].map(k => `<button class="chip s" data-key="${esc(k[1])}">${esc(k[0])}</button>`).join('')}<button class="chip s" data-key="clear">Leeren</button></div>`;
    const out = $('.tout', host), inp = $('.tin', host), pr = $('.tprompt', host); let draft = '';
    const draw = () => { out.innerHTML = ts.lines.slice(-600).map(lineHtml).join(''); out.scrollTop = out.scrollHeight; pr.textContent = C.prompt(ts.sys); };
    const push = (k, s) => ts.lines.push({ k, s });
    function exec(line) {
      const r = C.run(ts.sys, line); push('p', r.prompt + line);
      if (r.clear) ts.lines = [];
      r.items.forEach(x => push(x.k === 'e' ? 'e' : 'o', x.s.replace(/\n$/, '')));
      if (hintsOn()) [...new Set(r.hints)].forEach(h => push('h', h));
      if (line.trim()) ts.hist.push(line); ts.hi = ts.hist.length; draw();
      if (opt.onCmd) opt.onCmd(r, line);
    }
    function key(k) {
      if (k === 'tab') { const r = C.complete(ts.sys, inp.value); inp.value = r.line; if (r.options.length) { push('p', C.prompt(ts.sys) + inp.value); push('o', r.options.join('  ')); draw(); } }
      else if (k === 'up') { if (ts.hi === ts.hist.length) draft = inp.value; if (ts.hi > 0) { ts.hi--; inp.value = ts.hist[ts.hi]; } }
      else if (k === 'down') { if (ts.hi < ts.hist.length) { ts.hi++; inp.value = ts.hi === ts.hist.length ? draft : ts.hist[ts.hi]; } }
      else if (k === 'clear') { ts.lines = []; draw(); }
      else { const s = inp.selectionStart == null ? inp.value.length : inp.selectionStart, e = inp.selectionEnd == null ? s : inp.selectionEnd; inp.value = inp.value.slice(0, s) + k + inp.value.slice(e); const p = s + k.length; try { inp.setSelectionRange(p, p); } catch (er) {} }
      inp.focus();
    }
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); const v = inp.value; inp.value = ''; exec(v); return; }
      if (e.key === 'Tab') { e.preventDefault(); key('tab'); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); key('up'); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); key('down'); return; }
      if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); key('clear'); return; }
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C') && inp.selectionEnd === inp.selectionStart) { e.preventDefault(); push('p', C.prompt(ts.sys) + inp.value + '^C'); inp.value = ''; draw(); }
    });
    $('.term', host).addEventListener('click', () => { if (!String(getSelection())) inp.focus(); });
    $('.tkeys', host).addEventListener('pointerdown', e => { if (e.target.closest('[data-key]')) e.preventDefault(); });
    $('.tkeys', host).addEventListener('click', e => { const b = e.target.closest('[data-key]'); if (b) key(b.dataset.key); });
    draw();
    return { focus: () => inp.focus(), exec: l => exec(l), fill: v => { inp.value = v; inp.focus(); } };
  }

  /* ============================================================ Reiter Terminal */
  const TRY = ['pwd', 'ls -l', 'cat notizen.txt', 'cd Projekt', 'ls -la', 'ps aux', 'ip a', 'id', 'sudo apt update', 'cat /var/log/syslog', 'sudo tail -n 5 /var/log/auth.log', 'man ls', 'ls | wc -l', 'echo $HOME'];
  let termCtl = null;
  function renderTerm() {
    $('#termView').innerHTML = sim() + `<div class="card pl"><h4>Terminal (virtuelles System)</h4><div id="termHost"></div>
      <div class="btns"><button class="btn" data-tm="reset">↺ Neu starten</button><button class="btn" data-tm="hint">${hintsOn() ? 'Deutsche Hinweise: an' : 'Deutsche Hinweise: aus'}</button></div>
      <p class="hint2">Hinweise erscheinen nach Fehlern in Gelb. Die Fehlermeldungen selbst sind so englisch wie auf einem echten Server, damit du sie später wiedererkennst.</p></div>
      <div id="vizTerm"></div>
      <div class="card pl"><h4>Zum Ausprobieren (Tippen fügt den Befehl ein)</h4><div class="ctl">${TRY.map(c => `<button class="chip s" data-try="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <p class="hint2">Dein Benutzer ist <b>azubi</b> (Gruppe sudo). Es gibt ein Projekt (~/Projekt), Logdateien unter /var/log und einen kleinen Webserver-Ordner unter /srv/web. Mehr zeigt dir die Hilfe.</p></div>`;
    const vzT = line => { if (root.LIN_VIZ) root.LIN_VIZ.term(document.getElementById('vizTerm'), S.term, line); };
    termCtl = mountTerm($('#termHost'), S.term, { onCmd: (r, line) => vzT(line) }); vzT('');
  }
  $('#termView').addEventListener('click', e => {
    const t = e.target.closest('[data-tm]'), y = e.target.closest('[data-try]');
    if (t) { if (t.dataset.tm === 'reset') { S.term = newTS(D.image(), WELCOME); renderTerm(); toast('Terminal neu gestartet: alle Dateien wieder im Ausgangszustand.'); } else { lsSet('th', hintsOn() ? '0' : '1'); renderTerm(); } return; }
    if (y && termCtl) termCtl.fill(y.dataset.try);
  });

  /* ============================================================ Reiter Rechte */
  /* Visualisierung (linviz.js); ohne die Datei bleibt alles wie vorher */
  const VZ = (k, a, b) => { try { return root.LIN_VIZ ? root.LIN_VIZ[k](a, b) : ''; } catch (e) { return ''; } };
  const permWords = b => (b === 7 ? 'lesen, schreiben und ausführen' : b === 0 ? 'nichts' : [b & 4 ? 'lesen' : '', b & 2 ? 'schreiben' : '', b & 1 ? 'ausführen' : ''].filter(Boolean).join(' und '));
  function renderRechte() {
    const s = S.rechte, ok = /^[0-7]{3}$/.test(s.mode), m = ok ? parseInt(s.mode, 8) : 0o754;
    const bit = (sh, b) => `<button class="tg ${(m >> sh) & b ? 'on' : ''}" data-bit="${sh}:${b}" aria-pressed="${!!((m >> sh) & b)}">${b === 4 ? 'r' : b === 2 ? 'w' : 'x'}</button>`;
    const row = (nm, sh) => `<tr><th>${nm}</th><td>${bit(sh, 4)}</td><td>${bit(sh, 2)}</td><td>${bit(sh, 1)}</td><td class="n"><b>${(m >> sh) & 7}</b></td></tr>`;
    const sym = C.modeSym(m), um = /^[0-7]{3,4}$/.test(s.um) ? parseInt(s.um, 8) & 0o777 : null;
    let h = sim() + `<div class="card pl"><h4>Rechte-Rechner</h4>
      <div class="tw"><table class="tt"><tr><th></th><th>lesen (4)</th><th>schreiben (2)</th><th>ausführen (1)</th><th class="n">Ziffer</th></tr>${row('Besitzer (u)', 6)}${row('Gruppe (g)', 3)}${row('Andere (o)', 0)}</table></div>
      <label class="f"><span>Oktalzahl (drei Ziffern 0 bis 7)</span><input data-k="mode" inputmode="numeric" maxlength="3" autocomplete="off" value="${esc(s.mode)}"></label></div>`;
    h += ok ? VZ('rechte', m) + box('Als Buchstaben (ls -l)', '-' + sym + '  (Datei)   d' + sym + '  (Ordner)') + box('chmod, oktal', 'chmod ' + C.modeOct(m) + ' datei') + box('chmod, symbolisch', 'chmod u=' + permSym((m >> 6) & 7) + ',g=' + permSym((m >> 3) & 7) + ',o=' + permSym(m & 7) + ' datei') + `<div class="rdout"><span class="st">Bedeutung</span>Besitzer: ${esc(permWords((m >> 6) & 7))}<br>Gruppe: ${esc(permWords((m >> 3) & 7))}<br>Andere: ${esc(permWords(m & 7))}</div>` + (m & 0o111 ? '' : note('Ohne x darf niemand die Datei als Programm oder Skript starten. Bei Ordnern fehlt dann auch das Betreten (cd).', 'warn')) : note('Gib genau drei Ziffern von 0 bis 7 ein, z. B. 754.');
    h += `<div class="card pl"><h4>umask (nur zum Kennenlernen)</h4><p class="hint2" style="margin:0 0 8px">Die umask nimmt Rechte von neuen Dateien weg. Dateien starten mit 666, Ordner mit 777, davon wird die umask abgezogen (Ziffer für Ziffer).</p>
      <label class="f"><span>umask (Standard auf vielen Systemen: 022)</span><input data-k="um" inputmode="numeric" maxlength="4" autocomplete="off" value="${esc(s.um)}"></label>` + (um == null ? note('Gib die umask als Oktalzahl ein, z. B. 022 oder 077.') : VZ('umask', um) + box('Neue Datei', C.modeOct(0o666 & ~um) + '  (-' + C.modeSym(0o666 & ~um) + ')') + box('Neuer Ordner', C.modeOct(0o777 & ~um) + '  (d' + C.modeSym(0o777 & ~um) + ')')) + '</div>';
    $('#rechteView').innerHTML = h;
  }
  const permSym = b => (b & 4 ? 'r' : '') + (b & 2 ? 'w' : '') + (b & 1 ? 'x' : '');
  $('#rechteView').addEventListener('click', e => {
    const b = e.target.closest('[data-bit]'); if (!b) return; const [sh, bt] = b.dataset.bit.split(':').map(Number), s = S.rechte, m = /^[0-7]{3}$/.test(s.mode) ? parseInt(s.mode, 8) : 0o754;
    s.mode = ((m ^ (bt << sh)) & 0o777).toString(8).padStart(3, '0'); lsSet('rechte', s); renderRechte();
  });
  $('#rechteView').addEventListener('input', e => {
    const k = e.target.dataset.k; if (!k) return; S.rechte[k] = e.target.value; lsSet('rechte', S.rechte);
    const pos = e.target.selectionStart; renderRechte(); const el = $('[data-k=' + k + ']', $('#rechteView')); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (er) {} }
  });

  /* ============================================================ Reiter Cron */
  const CRON_PRE = ['* * * * *', '*/15 * * * *', '30 2 * * *', '0 8 * * 1-5', '0 0 1 * *', '0 */2 * * *', '15 22 * * 0', '*/5 8-17 * * 1-5', '@daily'];
  function cronOut(expr) {
    const p = C.cronParse(expr); if (!p.ok) return note(p.err, 'bad');
    const names = ['Minute', 'Stunde', 'Tag des Monats', 'Monat', 'Wochentag'], WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const vals = i => { const a = [...p.sets[i].set].sort((x, y) => x - y); return p.sets[i].star ? 'jeder Wert' : a.length > 12 ? a.slice(0, 12).join(', ') + ' ... (' + a.length + ' Werte)' : (i === 4 ? a.map(x => WD[x]).join(', ') : a.join(', ')); };
    let h = VZ('cron', expr) + `<div class="rdout ok"><span class="st">Bedeutung</span><b>${esc(C.cronExplain(expr))}</b></div><div class="tw"><table class="tt"><tr><th>Feld</th><th>Angabe</th><th>Passende Werte</th></tr>${p.raw.map((r, i) => `<tr><td>${names[i]}</td><td><code>${esc(r)}</code></td><td>${esc(vals(i))}</td></tr>`).join('')}</table></div>`;
    const nx = C.cronNext(expr, null, 5); h += `<div class="rdout"><span class="st">Die nächsten Läufe (ab So 2026-11-08 09:30, als Beispiel)</span>${nx.map(x => esc(x)).join('<br>') || 'keine'}</div>`;
    h += box('Läufe pro Tag (an einem Tag, an dem der Job laufen darf)', f(C.cronPerDay(expr)) + ' mal');
    if (!p.sets[2].star && !p.sets[4].star) h += note('Sind Tag des Monats und Wochentag beide gesetzt, läuft der Job, wenn EINE der beiden Angaben passt (ODER), nicht beide gemeinsam.', 'warn');
    return h;
  }
  function renderCron() {
    $('#cronView').innerHTML = sim() + `<div class="card pl"><h4>Cron-Zeitangabe lesen</h4><label class="f"><span>Fünf Felder: Minute Stunde Tag Monat Wochentag</span><input data-k="expr" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(S.cron.expr)}" style="font-family:ui-monospace,Menlo,Consolas,monospace"></label>
      <div class="ctl">${CRON_PRE.map(c => `<button class="chip s" data-pre="${esc(c)}">${esc(c)}</button>`).join('')}</div></div><div id="cronOut">${cronOut(S.cron.expr)}</div>
      <p class="hint2">Das Lab führt keine Cron-Jobs aus. Es erklärt nur die Zeitangabe. Die Zeile steht später in der crontab (crontab -l zeigt sie, crontab -e bearbeitet sie).</p>`;
  }
  $('#cronView').addEventListener('input', e => { if (e.target.dataset.k === 'expr') { S.cron.expr = e.target.value; lsSet('cron', S.cron); $('#cronOut').innerHTML = cronOut(S.cron.expr); } });
  $('#cronView').addEventListener('click', e => { const b = e.target.closest('[data-pre]'); if (b) { S.cron.expr = b.dataset.pre; lsSet('cron', S.cron); renderCron(); } });

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
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : q.ask.type === 'term' ? q.solution.join('   ·   ') : f(q.value, 0) + (q.ask.unit ? ' ' + q.ask.unit : ''));
  function qBody(q, a, r, pre) {
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${r && (r.ok || pre === 'rt') ? 'disabled' : ''} class="${r && i === q.ask.correct && (r.ok || pre === 'rt') ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)}${q.ask.unit ? ' (' + esc(q.ask.unit) + ')' : ''}</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${r && (r.ok || pre === 'rt') ? 'disabled' : ''}><span class="u">${esc(q.ask.unit || '')}</span></div></label>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein.'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 0) + (q.ask.unit ? ' ' + q.ask.unit : '') };
  }
  const resBlock = (q, r, showExpl) => `<ul class="tl2"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li></ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(solText(q))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '', mount = false;
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {}, isT = q.ask.type === 'term', solved = !!d[t.id] && r && r.ok;
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>`;
      if (isT) { h += '<div id="tkTerm"></div>'; mount = true; } else h += qBody(q, a, r, 'tk');
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button>${isT ? '<button class="btn" data-ta="reset">↺ Neu starten</button>' : ''}<button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (isT) {
        h += '<p class="hint2">Die Aufgabe wird automatisch geprüft, sobald das System den Soll-Zustand erreicht. „Prüfen“ sagt dir, was noch fehlt.</p>';
        if (r && r.ok) h += `<ul class="tl2"><li class="ok">✓ Geschafft: ${esc(r.reason)}</li></ul><div class="rdout ok"><b>Musterlösung:</b> ${esc(q.solution.join('  ·  '))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div><div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`;
        else if (r) { h += `<ul class="tl2"><li class="bad">✗ Noch nicht: ${esc(r.reason)}</li></ul>`; if (!exam()) h += `<div class="btns"><button class="btn" data-ta="sol">${S.showSol ? 'Lösung verbergen' : 'Lösung anzeigen'}</button></div>`; if (S.showSol && !exam()) h += `<div class="rdout bad"><b>Musterlösung:</b> ${esc(q.solution.join('  ·  '))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div>`; else if (exam()) h += '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe gelöst ist.</div>'; }
      } else if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(SIM)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${x.kind === 'term' ? ' · Terminal' : ''}${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (mount) { const ctl = mountTerm($('#tkTerm'), S.tterm, { onCmd: autoCheck }); if (top === false && !S.tRes) ctl.focus(); }
    if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function autoCheck() {
    const t = curTask(); if (!t || t.kind !== 'term' || (S.tRes && S.tRes.ok)) return;
    if (t.check(S.tterm.sys) === true) finishTerm(t);
  }
  function finishTerm(t) {
    const pct = pctFor(t.id); S.tRes = { id: t.id, ok: true, reason: 'Das System hat den Soll-Zustand erreicht.', pct }; markSolved(t.id, pct);
    const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); renderTasks(false);
  }
  function checkTask(t) {
    if (t.kind === 'term') {
      const r = t.check(S.tterm.sys); if (r === true) { finishTerm(t); return; }
      S.tRes = { id: t.id, ok: false, reason: String(r) }; sad(); toast('Noch nicht erfüllt.'); renderTasks(false); return;
    }
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    S.tRes = { id: t.id, ok: e.ok, given: e.given, pct };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast('Noch nicht richtig. Lies den Lösungsweg und versuche es noch einmal.'); }
    renderTasks(false);
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
    S.task = id; S.tq = D.makeTask(t); S.tAns = {}; S.tRes = null; S.showSol = false; S.tterm = t.kind === 'term' ? newTS(D.image({ cwd: t.cwd }), 'Aufgabe gestartet. Dein Terminal ist ein eigenes, frisches System.') : null;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  const tv = $('#taskView');
  tv.addEventListener('input', e => { const t = curTask(); if (t && e.target.dataset.in) (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (ta && t) {
      const a = ta.dataset.ta;
      if (a === 'chk') checkTask(t); else if (a === 'hint') hintFor(S.tq, t.id); else if (a === 'close') { S.task = null; S.tRes = null; S.tterm = null; renderTasks(); }
      else if (a === 'reset') { S.tterm = newTS(D.image({ cwd: t.cwd }), 'Neu gestartet: das System ist wieder im Ausgangszustand.'); S.tRes = null; S.showSol = false; renderTasks(false); }
      else if (a === 'sol') { S.showSol = !S.showSol; renderTasks(false); }
      else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); }
      return;
    }
    if (row) startTask(row.dataset.t);
  });

  /* Zufalls-Trainer (Auswahl- und Zahlenfragen; Tipps kosten hier nie etwas) */
  function newTrainer() { const T = S.tr; T.q = D.randomQ(R0, T.level); T.ans = {}; T.res = null; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar"><span class="lbl" style="font-size:12px;color:var(--mute)">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p style="margin:8px 0">${esc(q.text)}</p>${qBody(q, T.ans, T.res, 'rt')}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}</div><p class="hint2">Der Trainer stellt Auswahl- und Zahlenfragen mit immer neuen Werten. Die Terminal-Aufgaben findest du unter „Aufgaben“.</p>`;
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr.ans.v = e.target.value; });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (tc && !T.res) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if (!T.res && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res) return; const e = evalQ(T.q, T.ans); if (!e) return;
    T.res = { ok: e.ok, given: e.given }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Beispiele */
  function transcript(cmds) {
    const sys = D.image(); let h = '';
    cmds.forEach(c => { const r = C.run(sys, c); h += lineHtml({ k: 'p', s: r.prompt + c }); r.items.forEach(x => { h += lineHtml({ k: x.k === 'e' ? 'e' : 'o', s: x.s.replace(/\n$/, '') }); }); [...new Set(r.hints)].slice(0, 1).forEach(t => { h += lineHtml({ k: 'h', s: t }); }); });
    return `<div class="term tr"><div class="tout">${h}</div></div>`;
  }
  function exBody(e) {
    if (e.tab === 'term') return transcript(e.cmds);
    if (e.tab === 'cron') return cronOut(e.p.expr);
    return rechteOut(e.p.mode);
  }
  function rechteOut(mode) { const m = parseInt(mode, 8); return VZ('rechte', m) + box('Als Buchstaben', '-' + C.modeSym(m)) + box('Befehl', 'chmod ' + C.modeOct(m) + ' datei') + `<div class="rdout">Besitzer: ${esc(permWords((m >> 6) & 7))}<br>Gruppe: ${esc(permWords((m >> 3) & 7))}<br>Andere: ${esc(permWords(m & 7))}</div>`; }
  function renderBsp() {
    $('#bspView').innerHTML = sim() + `<p class="hint2" style="margin:0 0 8px">Fertig durchgespielte Beispiele. Die Ausgaben entstehen live aus dem simulierten System. Mit „Im Terminal ausprobieren“ führst du dieselben Befehle selbst aus.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" data-ex="${e.id}">${e.tab === 'term' ? 'Im Terminal ausprobieren' : 'In den Rechner laden'}</button></div></div>`).join('');
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex);
    if (x.tab === 'term') { S.term = newTS(D.image(), 'Beispiel: ' + x.title + '. Die Befehle wurden schon für dich ausgeführt, probiere danach eigene.'); x.cmds.forEach(c => { const r = C.run(S.term.sys, c); S.term.lines.push({ k: 'p', s: r.prompt + c }); r.items.forEach(i => S.term.lines.push({ k: i.k === 'e' ? 'e' : 'o', s: i.s.replace(/\n$/, '') })); if (hintsOn()) [...new Set(r.hints)].forEach(h => S.term.lines.push({ k: 'h', s: h })); S.term.hist.push(c); }); S.term.hi = S.term.hist.length; }
    else if (x.tab === 'cron') { S.cron.expr = x.p.expr; lsSet('cron', S.cron); }
    else { S.rechte.mode = x.p.mode; lsSet('rechte', S.rechte); }
    setTab(x.tab); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  /* PRUEFEN P20: Hilfe-Texte und Stufeneinteilung (40 Aufgaben, Stufe 1 bis 3) sind für Fachinformatiker im 1. bis 3. Ausbildungsjahr gedacht. Stimmen Umfang, Reihe... */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`, cm = (a, b) => `<tr><td><code>${esc(a)}</code></td><td>${b}</td></tr>`, tbl = rows => `<table><tr><th>Befehl</th><th>Wirkung</th></tr>${rows.map(r => cm(r[0], r[1])).join('')}</table>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(SIM)}</div>` +
      sec('So arbeitest du im Terminal', `<p>Der <b>Prompt</b> <code>azubi@tonfunk-pc:~$</code> zeigt Benutzer, Rechnername und Ordner (<code>~</code> ist dein Home-Verzeichnis). Du tippst einen Befehl, drückst Enter und liest die Ausgabe. Mit <b>Tab</b> vervollständigst du Namen, mit den <b>Pfeiltasten</b> holst du alte Befehle zurück.</p><p>Ein Befehl besteht aus <b>Befehlsname</b>, <b>Optionen</b> (mit - davor, z. B. <code>-l</code>) und <b>Argumenten</b> (z. B. Dateinamen). Fast jeder Befehl nennt mit <code>--help</code> seinen Aufbau.</p><p>Fehlermeldungen kommen auf Englisch, wie auf echten Servern. Das Lab ergänzt in Gelb einen deutschen Hinweis. Wichtige Meldungen: <code>No such file or directory</code> (Pfad falsch), <code>Permission denied</code> (Recht fehlt), <code>command not found</code> (Befehl unbekannt oder Tippfehler).</p>`, true) +
      sec('Dateisystem und Pfade', `<p>Alles hängt an der Wurzel <code>/</code>. Ein <b>absoluter Pfad</b> beginnt mit <code>/</code> (z. B. <code>/etc/hosts</code>), ein <b>relativer</b> nicht (z. B. <code>Projekt/src</code>) und gilt ab dem aktuellen Ordner. <code>.</code> ist der aktuelle Ordner, <code>..</code> der darüberliegende, <code>~</code> dein Home.</p>${tbl([['pwd', 'aktuellen Ordner zeigen'], ['ls, ls -l, ls -a', 'Inhalt zeigen (lang, mit versteckten Dateien)'], ['cd ORDNER, cd .., cd ~, cd -', 'Ordner wechseln'], ['mkdir -p a/b/c', 'Ordner anlegen (mit Zwischenordnern)'], ['touch datei', 'leere Datei anlegen'], ['cp quelle ziel, cp -r ordner ziel', 'kopieren'], ['mv quelle ziel', 'verschieben oder umbenennen'], ['rm datei, rm -r ordner', 'löschen (endgültig, kein Papierkorb)'], ['find /pfad -name "*.log"', 'Dateien suchen']])}<p>Sterne helfen: <code>*.txt</code> trifft alle Dateien, die auf .txt enden, <code>?</code> genau ein Zeichen.</p>`) +
      sec('Dateirechte', `<p><code>ls -l</code> zeigt z. B. <code>-rwxr-x--- 1 anna dev 2048 Nov 3 skript.sh</code>. Das erste Zeichen ist der Typ (<code>-</code> Datei, <code>d</code> Ordner), dann dreimal drei Zeichen für <b>Besitzer, Gruppe, andere</b>: <code>r</code> lesen (4), <code>w</code> schreiben (2), <code>x</code> ausführen (1).</p><table><tr><th>Zahl</th><th>Rechte</th><th>Zahl</th><th>Rechte</th></tr><tr><td>7</td><td>rwx</td><td>3</td><td>-wx</td></tr><tr><td>6</td><td>rw-</td><td>2</td><td>-w-</td></tr><tr><td>5</td><td>r-x</td><td>1</td><td>--x</td></tr><tr><td>4</td><td>r--</td><td>0</td><td>---</td></tr></table>${tbl([['chmod 754 datei', 'oktal: Besitzer rwx, Gruppe r-x, andere r--'], ['chmod u+x datei', 'symbolisch: Besitzer bekommt x (u, g, o, a mit + - =)'], ['chown anna:dev datei', 'Besitzer und Gruppe ändern (nur root, daher sudo)'], ['umask', 'zeigt, welche Rechte neue Dateien nicht bekommen (z. B. 0022)']])}<p>Bei <b>Ordnern</b> heißt x „betreten dürfen“ (cd), r „Inhalt auflisten“, w „Dateien anlegen und löschen“.</p>`) +
      sec('Textwerkzeuge, Pipes und Umleitung', `${tbl([['cat datei', 'Datei ausgeben (cat -n mit Zeilennummern)'], ['less datei', 'seitenweise lesen (im Lab: ganzer Inhalt)'], ['head -n 5 datei, tail -n 5 datei', 'erste bzw. letzte Zeilen'], ['grep muster datei', 'Zeilen mit Muster (-i Groß/klein egal, -v Gegenteil, -c zählen, -n Zeilennummer, -r in Ordnern)'], ['wc -l datei', 'Zeilen zählen (-w Wörter, -c Zeichen)'], ['sort, sort -r, sort -n', 'sortieren (rückwärts, numerisch)'], ['uniq, uniq -c', 'doppelte Nachbarzeilen entfernen bzw. zählen (vorher sortieren!)'], ['cut -d\';\' -f1 datei', 'Spalte ausschneiden (Trenner und Feldnummer)'], ['awk \'{print $1}\' datei', 'erstes Feld jeder Zeile (Felder trennt awk an Leerzeichen; $NF ist das letzte)'], ['awk -F: \'{print $1, $3}\' datei', '-F legt den Trenner fest (hier Doppelpunkt), mehrere Felder mit Komma'], ['awk \'/muster/ {print}\' datei', 'nur Zeilen mit dem Muster; auch NR==2 (Zeile 2) oder $3>100 (Bedingung) als Muster'], ['awk \'{s+=$2} END {print s}\' datei', 'Spalte 2 summieren, am Ende die Summe ausgeben'], ['sed \'s/alt/neu/\' datei', 'ersten Treffer je Zeile ersetzen (mit g am Ende alle); die Datei selbst bleibt unverändert'], ['sed -n \'3p\' datei, sed \'3d\' datei', 'nur Zeile 3 ausgeben (-n schaltet die Standardausgabe ab) bzw. Zeile 3 weglassen; auch 2,4p und $d'], ['sed -i \'s/alt/neu/\' datei', 'ändert die Datei selbst (Vorsicht, kein Rückgängig)']])}<p>awk und sed arbeiten auch in Pipes: <code>cat datei | awk \'{print $1}\'</code>. Das Lab kennt von beiden nur die einfache Form; im echten Terminal können sie viel mehr.</p>`+`<table><tr><th>Zeichen</th><th>Bedeutung</th></tr>${[['|', 'Pipe: Ausgabe des linken Befehls wird Eingabe des rechten'], ['> datei', 'Ausgabe in Datei schreiben (überschreibt)'], ['>> datei', 'Ausgabe an Datei anhängen'], ['< datei', 'Datei als Eingabe verwenden'], ['2> datei', 'nur Fehlermeldungen umleiten (2> /dev/null verschluckt sie)'], ['2>&1', 'Fehlermeldungen in die normale Ausgabe mischen'], ['&&  ;  ||', 'Befehle verketten (bei Erfolg / immer / bei Fehler)']].map(r => cm(r[0], r[1])).join('')}</table><p>Beispiel: <code>cut -d' ' -f1 access.log | sort | uniq -c | sort -rn | head -n 3</code> zeigt die drei häufigsten Adressen.</p>`) +
      sec('Prozesse', `${tbl([['ps aux', 'alle Prozesse (USER, PID, %CPU, %MEM, COMMAND)'], ['ps aux | grep name', 'einen Prozess suchen'], ['top', 'Live-Ansicht nach CPU-Last (im Lab nur ein Schnappschuss)'], ['sleep 300 &', '& startet einen Befehl im Hintergrund'], ['jobs', 'Hintergrundjobs dieser Shell'], ['kill PID', 'Signal SIGTERM (15): bitte beenden'], ['kill -9 PID', 'Signal SIGKILL (9): sofort beenden, nur wenn nötig'], ['kill %1', 'Job Nummer 1 beenden']])}<p>Fremde Prozesse darfst du nur mit sudo beenden. Prüfe die PID genau, bevor du kill tippst.</p>`) +
      sec('Dienste (systemctl)', `${tbl([['systemctl status ssh', 'Zustand eines Dienstes: Loaded (beim Start aktiviert?) und Active (läuft gerade?); geht ohne sudo'], ['sudo systemctl start|stop|restart dienst', 'Dienst jetzt starten, beenden oder neu starten'], ['sudo systemctl enable|disable dienst', 'Dienst beim Hochfahren automatisch starten bzw. nicht mehr starten (enable --now startet zugleich)'], ['systemctl is-active dienst, systemctl is-enabled dienst', 'kurze Antwort: active/inactive bzw. enabled/disabled'], ['systemctl list-units --type=service', 'laufende Dienste auflisten (--all zeigt auch gestoppte)']])}<p>Starten, Stoppen und Aktivieren darf nur der Administrator. Ohne sudo meldet Linux <code>Interactive authentication required</code>. Gestoppt heißt nicht deaktiviert: Ein gestoppter, aber aktivierter Dienst startet beim nächsten Hochfahren wieder. Im Lab gibt es eine kleine Dienstliste (ssh, cron, nginx, rsyslog, fail2ban).</p>`) +
      sec('Benutzer, sudo und Pakete', `${tbl([['whoami, id', 'wer bin ich, welche Gruppen habe ich'], ['sudo befehl', 'Befehl als Administrator (root) ausführen; geht nur für Mitglieder der Gruppe sudo'], ['sudo useradd -m tom', 'Benutzer mit Home-Verzeichnis anlegen'], ['sudo usermod -aG sudo tom', 'Benutzer zur Gruppe hinzufügen (-a = anhängen)'], ['sudo apt update', 'Paketliste aktualisieren'], ['sudo apt install -y tree', 'Paket installieren'], ['sudo apt remove tree', 'Paket entfernen'], ['apt search begriff, apt list --installed', 'suchen, Installiertes anzeigen']])}<p>Wichtig: Eine Umleitung wie <code>sudo echo x &gt; /etc/datei</code> klappt nicht, weil die Shell (nicht sudo) die Datei öffnet. Das ist eine häufige Falle.</p>`) +
      sec('Netzwerk lesen', `${tbl([['ip a  (ip -br a)', 'Adressen der Schnittstellen. Bei eth0 steht hinter inet die IP mit Präfix, z. B. 192.168.10.25/24'], ['ip r', 'Routen und Standard-Gateway (default via ...)'], ['ping -c 4 ziel', 'Erreichbarkeit prüfen, -c begrenzt die Anzahl'], ['ss -tuln', 'lauschende TCP- und UDP-Ports. 0.0.0.0 = alle Schnittstellen, 127.0.0.1 = nur lokal'], ['cat /etc/hosts, cat /etc/resolv.conf', 'Namensauflösung']])}<p>Ältere Tools wie ifconfig und netstat sind auf neuen Systemen nicht mehr installiert. Zum Rechnen mit Präfixen und Subnetzen gibt es das <a href="netlab.html">Netzwerk-Lab</a>.</p>`) +
      sec('Logdateien (/var/log)', `<table><tr><th>Datei</th><th>Inhalt</th></tr>${[['syslog', 'allgemeine Systemmeldungen'], ['auth.log', 'Anmeldungen, sudo, SSH (nur root und Gruppe adm dürfen lesen)'], ['nginx/access.log', 'Webserver: jede Anfrage (IP, Zeit, Anfrage, Statuscode)'], ['dpkg.log', 'installierte Pakete']].map(r => cm(r[0], r[1])).join('')}</table><p>Typisch: <code>sudo tail -n 20 /var/log/auth.log</code> zeigt das Neueste, <code>grep</code> filtert, <code>grep -c</code> zählt Treffer. Statuscodes im Webserver-Log: 200 ok, 404 nicht gefunden, 500 Serverfehler.</p><p class="hint2">Wie du einen Raspberry Pi mit Pi-hole einrichtest, steht im <a href="pihole-labor.html">Projekt Pi-hole</a>. Dort wendest du viele dieser Befehle an.</p>`) +
      sec('Shell-Skripte lesen', `<pre class="code">#!/bin/bash
name="Anna"          # Variable setzen (ohne Leerzeichen um =)
echo "Hallo $name"   # lesen mit $
heute=$(date +%F)    # Ausgabe eines Befehls speichern
if [ $zahl -gt 5 ]; then
  echo "gross"
else
  echo "klein"
fi
for datei in *.csv; do
  echo "$datei"
done</pre><p>Die erste Zeile (<code>#!/bin/bash</code>) nennt den Interpreter. Zum Starten braucht die Datei das x-Recht (<code>chmod +x skript.sh</code>, dann <code>./skript.sh</code>). In <code>"..."</code> werden Variablen ersetzt, in <code>'...'</code> nicht. In <code>[ ... ]</code> stehen Leerzeichen innen. Vergleiche: <code>-eq</code> gleich, <code>-ne</code> ungleich, <code>-gt</code> größer, <code>-lt</code> kleiner. Im Lab liest du Skripte mit cat; gestartete Skripte zeigen eine vorbereitete Ausgabe.</p>`) +
      sec('Cron-Zeitangaben', `<span class="eq">Minute  Stunde  Tag  Monat  Wochentag  Befehl</span><table><tr><th>Zeichen</th><th>Bedeutung</th></tr>${[['*', 'jeder Wert'], ['*/15', 'alle 15 (in diesem Feld)'], ['1-5', 'Bereich (Wochentag: 1 = Montag, 0 oder 7 = Sonntag)'], ['1,15', 'Liste']].map(r => cm(r[0], r[1])).join('')}</table><p>Beispiele: <code>30 2 * * *</code> täglich 02:30, <code>0 8 * * 1-5</code> werktags 08:00, <code>*/15 * * * *</code> alle 15 Minuten. Im Reiter Cron kannst du jede Angabe ausprobieren.</p>`) +
      `<p class="hint2">Zahlen, Befehle und Ausgaben sind Lehrbuch- und Übungswerte (Ubuntu-Stil). Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'term'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ term: renderTerm, rechte: renderRechte, cron: renderCron, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Linux-Terminal-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Linux-Terminal-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('term');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben, automatisch geprüft, mit Tipps'], ['rt', 'Zufalls-Trainer', 'Auswahl- und Zahlenfragen mit Serien-Zähler'], ['bsp', 'Beispiele', 'Durchgespielte Befehlsfolgen zum Nachmachen'], ['help', 'Hilfe und Befehlsübersicht', 'Pfade, Rechte, Pipes, awk und sed, Prozesse, Dienste, Netzwerk, Cron'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.task = null; S.tRes = null; S.tterm = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.LIN_LAB = { id: 'lin', title: 'Linux-Terminal-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.LIN_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'term');
  /* Aufruf ?aufgabe=lin1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=nav1 springt zu einem Beispiel) */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
