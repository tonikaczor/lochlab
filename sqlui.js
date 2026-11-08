'use strict';
/* Tonfunk Datenbank-Lab (SQL): Oberfläche (Lab-Kennung 'sql').
   Alle Firmen, Personen und Daten sind erfunden (Übungsdaten). Das Lab hat einen eigenen SQL-Interpreter (sqlcore.js), keine externe Bibliothek, alles offline.
   Reiter: Datenbank (ER-Modell und Tabellen), Editor (Abfragen ausprobieren), Aufgaben, Beispiele, Hilfe.
   Module: sqlcore.js (SQL_CORE, Interpreter), sqldata.js (SQL_DATA, SQL_TASKS: Datenbank, Aufgaben, Beispiele).
   Speicher (Präfix lm4.sql.): tab, ed (Entwurf im Editor), done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1').
   Die Datenbank im Editor liegt nur im Arbeitsspeicher (Zurücksetzen-Knopf); Aufgaben werden immer gegen eine frische Datenbank geprüft.
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: sqllab.html?aufgabe=sql1 öffnet die Aufgabe, sqllab.html?bsp öffnet die Beispiele (?bsp=join1 springt zu einem Beispiel). */
(function (root) {
  const C = root.SQL_CORE, D = root.SQL_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.sql.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Datenbank-Lab (SQL)</h4><p class="big">Dateien fehlen</p><p class="hint2">sqlcore.js oder sqldata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['db', '🗄️', 'Datenbank'], ['ed', '⌨️', 'Editor'], ['tasks', '📝', 'Aufgaben'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const S = {
    tab: lsGet('tab', 'db'), db: C.cloneDb(D.makeDb()), dirty: false, edOut: '',
    task: null, tq: null, tAns: {}, tRes: null, tOut: '', twdb: null
  };
  const DEF_SQL = 'SELECT name, ort\nFROM kunde\nWHERE ort = \'Halle\'\nORDER BY name';
  let edSql = lsGet('ed', DEF_SQL); if (typeof edSql !== 'string') edSql = DEF_SQL;

  /* ============================================================ Ergebnis-Darstellung */
  function tableHtml(cols, rows, max) {
    max = max || 200;
    const head = '<tr>' + cols.map(c => `<th>${esc(c)}</th>`).join('') + '</tr>';
    const body = rows.slice(0, max).map(r => '<tr>' + r.map(v => v === null ? '<td class="nl">NULL</td>' : `<td class="${typeof v === 'number' ? 'n' : ''}">${esc(C.fmtVal(v))}</td>`).join('') + '</tr>').join('');
    return `<div class="tw"><table class="res">${head}${body}</table></div>` + (rows.length === 0 ? '<p class="hint2">(keine Zeilen)</p>' : '') + (rows.length > max ? `<p class="hint2">Es werden nur die ersten ${max} von ${rows.length} Zeilen angezeigt.</p>` : '');
  }
  const zl = n => n + ' Zeile' + (n === 1 ? '' : 'n');
  /* r = Ergebnis von C.exec, db = Datenbank nach der Ausführung, hint = Warnungen zeigen (nicht bei Aufgaben, dort gilt das Verdeckte-Fehler-Prinzip) */
  function resultHtml(r, db, hint) {
    let h = ''; const last = {};
    r.results.forEach((x, i) => { if (x.kind !== 'select') last[x.table] = i; });
    r.results.forEach((x, i) => {
      const pre = r.results.length > 1 ? `<span class="st">Anweisung ${i + 1}</span>` : '';
      if (x.kind === 'select') { h += `<div class="rdout ok">${pre}<b>${zl(x.rows.length)}</b> im Ergebnis</div>` + tableHtml(x.cols, x.rows); return; }
      const verb = { insert: 'eingefügt', update: 'geändert', delete: 'gelöscht' }[x.kind], tb = C.findTable(db, x.table);
      h += `<div class="rdout ok">${pre}✓ <b>${zl(x.affected)}</b> in „${esc(x.table)}“ ${verb}.</div>`;
      if (hint && x.kind !== 'insert' && tb && !/\bwhere\b/i.test(x.sql) && x.affected > 1) h += `<div class="rdout warn">⚠ Dieser Befehl hat keine WHERE-Bedingung und hat deshalb alle Zeilen der Tabelle betroffen. Wolltest du das? Mit „Datenbank zurücksetzen“ machst du es rückgängig.</div>`;
      if (tb && last[x.table] === i) h += `<p class="hint2" style="margin:2px 0">Tabelle „${esc(tb.name)}“ jetzt (${zl(tb.rows.length)}):</p>` + tableHtml(tb.cols.map(c => c.n), tb.rows, 30);
    });
    if (!r.ok) h += `<div class="rdout bad"><b>Fehler:</b> ${esc(r.error)}</div>`;
    return h;
  }
  const codeBlock = s => `<pre class="code">${esc(s)}</pre>`;

  /* ============================================================ Reiter Datenbank (ER-Modell, Tabellen) */
  /* PRUEFEN P8: ER-Darstellung vereinfacht: Kästen mit Spalten, Linien mit 1 und n an den Enden (keine Krähenfuß- oder Chen-Notation). Welche Schreibweise verwendet ihr in der Berufsschule? */
  function erSvg(db) {
    const E = D.er, W = E.w, HD = 26, RH = 20, info = D.schemaInfo(db), pos = k => E.boxes[k], by = {}; info.forEach(t => { by[t.name] = t; });
    const hgt = k => HD + by[k].cols.length * RH + 6, rowY = (k, col) => pos(k)[1] + HD + by[k].cols.findIndex(c => c.n === col) * RH + RH / 2 + 2;
    let s = '';
    E.rels.forEach(([ct, cc, pt, pc], i) => {
      const [cx, cy] = pos(ct), [px, py] = pos(pt); let x1, y1, x2, y2, lx1, lx2, ly1, ly2;
      if (cx === px) { x1 = cx + 50 + i * 24; y1 = cy; x2 = x1; y2 = py + hgt(pt); lx1 = x1 + 8; ly1 = y1 - 6; lx2 = x2 + 8; ly2 = y2 + 16; }
      else if (px < cx) { x1 = cx; y1 = rowY(ct, cc); x2 = px + W; y2 = rowY(pt, pc); lx1 = x1 - 14; ly1 = y1 - 5; lx2 = x2 + 6; ly2 = y2 - 5; }
      else { x1 = cx + W; y1 = rowY(ct, cc); x2 = px; y2 = rowY(pt, pc); lx1 = x1 + 6; ly1 = y1 - 5; lx2 = x2 - 14; ly2 = y2 - 5; }
      s += `<line class="er-l" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><text class="er-n" x="${lx1}" y="${ly1}">n</text><text class="er-n" x="${lx2}" y="${ly2}">1</text>`;
    });
    info.forEach(t => {
      const [x, y] = pos(t.name), h = hgt(t.name);
      s += `<rect class="er-box" x="${x}" y="${y}" width="${W}" height="${h}" rx="6"/><path class="er-hd" d="M${x} ${y + HD} V${y + 6} a6 6 0 0 1 6 -6 H${x + W - 6} a6 6 0 0 1 6 6 V${y + HD} Z"/><text class="er-t" x="${x + 10}" y="${y + 18}">${esc(t.name)}</text>`;
      t.cols.forEach((c, i) => { const yy = y + HD + i * RH + 15; s += `<text class="er-c ${c.pk ? 'er-pk' : c.fk ? 'er-fk' : ''}" x="${x + 10}" y="${yy}">${c.pk ? 'PK ' : c.fk ? 'FK ' : '   '}${esc(c.n)}</text><text class="er-c" x="${x + W - 8}" y="${yy}" text-anchor="end" style="fill:var(--mute)">${esc(c.type)}</text>`; });
    });
    const mp = pos('mitarbeiter'); s += `<text class="er-c" x="${mp[0]}" y="${mp[1] + hgt('mitarbeiter') + 16}" style="fill:var(--mute)">chef_id verweist auf ma_id (Vorgesetzter)</text>`;
    return `<svg viewBox="0 0 960 400" role="img" aria-label="ER-Modell der Firmen-Datenbank mit sechs Tabellen und den Beziehungen zwischen ihnen">${s}</svg>`;
  }
  function renderDb() {
    const info = D.schemaInfo(S.db);
    let h = `<div class="rdout">Die Beispieldatenbank „Firma“ (alle Daten erfunden). Jede Linie im Modell ist eine Beziehung: Auf der <b>n</b>-Seite steht der Fremdschlüssel (FK), auf der <b>1</b>-Seite der Primärschlüssel (PK).</div>
      <div class="card pl"><h4>ER-Modell</h4><div class="inst">${erSvg(S.db)}</div><p class="hint2">Lesebeispiel: Ein Kunde (1) hat viele Bestellungen (n). Eine Bestellung hat viele Positionen (n), und jede Position zeigt auf genau einen Artikel (1). Zwischen bestellung und artikel gibt es daher eine n:m-Beziehung über die Tabelle bestellposition.</p></div>
      <div class="card pl"><h4>Tabellen und Inhalt</h4>${S.dirty ? '<p class="hint2" style="margin:0 0 6px">Stand nach deinen Änderungen im Editor. <button class="chip s" data-a="reset">↺ Zurücksetzen</button></p>' : ''}`;
    h += '<div class="dt">' + info.map(t => { const tb = S.db.tables[t.name]; return `<details><summary>${esc(t.name)} <span class="hint2" style="margin-left:8px">${t.n} Zeilen</span></summary><div class="hb2"><p>${esc(D.desc[t.name] || '')}</p><p class="hint2">${t.cols.map(c => esc(c.n) + ' ' + esc(c.type) + (c.pk ? '<span class="tg pk">PK</span>' : '') + (c.fk ? '<span class="tg fk">FK → ' + esc(c.fk) + '</span>' : '')).join(' · ')}</p>${tableHtml(tb.cols.map(c => c.n), tb.rows, 60)}</div></details>`; }).join('') + '</div></div>';
    $('#dbView').innerHTML = h;
  }
  $('#dbView').addEventListener('click', e => { if (e.target.closest('[data-a=reset]')) resetDb(); });
  function resetDb() { S.db = C.cloneDb(D.makeDb()); S.dirty = false; S.edOut = ''; toast('Datenbank zurückgesetzt'); if (S.tab === 'db') renderDb(); else if (S.tab === 'ed') renderEd(); }

  /* ============================================================ Reiter Editor */
  const SNIP = [['SELECT … FROM', 'SELECT * FROM '], ['WHERE', '\nWHERE '], ['ORDER BY', '\nORDER BY '], ['GROUP BY', '\nGROUP BY '], ['HAVING', '\nHAVING '], ['JOIN … ON', '\nJOIN  ON '], ['LIMIT', '\nLIMIT ']];
  function renderEd() {
    $('#edView').innerHTML = `<div class="card pl"><h4>Abfrage-Editor</h4>
      <textarea id="edSql" class="sqlin" rows="7" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="SQL-Anweisung">${esc(edSql)}</textarea>
      <div class="btns"><button class="btn pri" data-e="run">▶ Ausführen</button><button class="btn" data-e="reset">↺ Datenbank zurücksetzen</button></div>
      <p class="hint2">Strg+Enter führt aus. Mehrere Anweisungen trennst du mit einem Semikolon. ${S.dirty ? '<b>Die Datenbank ist verändert</b> (INSERT, UPDATE oder DELETE wurde ausgeführt).' : 'Die Datenbank ist im Originalzustand.'}</p>
      <div class="snip">${D.schemaInfo(S.db).map(t => `<button class="chip s" data-ins="${esc(t.name)}">${esc(t.name)}</button>`).join('')}${SNIP.map((x, i) => `<button class="chip s" data-sn="${i}">${esc(x[0])}</button>`).join('')}</div></div><div id="edOut">${S.edOut}</div>`;
  }
  function insertAt(txt) { const ta = $('#edSql'); if (!ta) return; const a = ta.selectionStart || 0, b = ta.selectionEnd || 0; ta.value = ta.value.slice(0, a) + txt + ta.value.slice(b); const p = a + txt.length; ta.focus(); try { ta.setSelectionRange(p, p); } catch (e) {} edSql = ta.value; lsSet('ed', edSql); }
  function runEd() {
    const ta = $('#edSql'); edSql = ta ? ta.value : edSql; lsSet('ed', edSql);
    const r = C.exec(S.db, edSql); if (r.ok && r.results.some(x => x.kind !== 'select')) S.dirty = true; else if (!r.ok && r.results.some(x => x.kind !== 'select')) S.dirty = true;
    S.edOut = resultHtml(r, S.db, true); const o = $('#edOut'); if (o) o.innerHTML = S.edOut; if (S.dirty) { const p = $('#edView .hint2'); if (p) p.innerHTML = 'Strg+Enter führt aus. Mehrere Anweisungen trennst du mit einem Semikolon. <b>Die Datenbank ist verändert</b> (INSERT, UPDATE oder DELETE wurde ausgeführt).'; }
    if (!r.ok) sad();
  }
  $('#edView').addEventListener('input', e => { if (e.target.id === 'edSql') { edSql = e.target.value; lsSet('ed', edSql); } });
  $('#edView').addEventListener('keydown', e => { if (e.target.id === 'edSql' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runEd(); } });
  $('#edView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.e === 'run') runEd(); else if (b.dataset.e === 'reset') resetDb();
    else if (b.dataset.ins) insertAt(b.dataset.ins + ' '); else if (b.dataset.sn) insertAt(SNIP[+b.dataset.sn][1]);
  });

  /* ============================================================ Aufgaben */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  function pctFor(id) { if (!exam()) return 100; return 100 - 25 * Math.min(2, lsGet('ctipps', {})[id] || 0); }
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    const d = done(); d[id] = true; lsSet('done', d); updateBadge(); updatePal();
  }
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : q.ask.type === 'num' ? C.fmtVal(q.value) + ' ' + q.ask.unit : q.sol);
  const isSql = q => q.ask.type === 'sql';
  function schemaRef() {
    return `<details style="margin:8px 0"><summary class="hint2" style="cursor:pointer">Tabellen im Überblick (PK = Primärschlüssel, FK = Fremdschlüssel)</summary><div class="hint2" style="line-height:1.7">${D.schemaInfo(D.makeDb()).map(t => '<b>' + esc(t.name) + '</b> (' + t.cols.map(c => esc(c.n) + (c.pk ? ' <span class="tg pk">PK</span>' : '') + (c.fk ? ' <span class="tg fk">FK→' + esc(c.fk) + '</span>' : '')).join(', ') + ')').join('<br>')}</div></details>`;
  }
  function qBody(q, a, r) {
    const lock = r && r.ok;
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${lock ? 'disabled' : ''} class="${lock && i === q.ask.correct ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    if (q.ask.type === 'num') return `<label class="f"><span>${esc(q.ask.label)} (${esc(q.ask.unit)})</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${lock ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div></label>`;
    return schemaRef() + `<textarea id="tkSql" class="sqlin" rows="${q.kind === 'dml' ? 6 : 5}" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="Deine SQL-Anweisung" placeholder="${q.kind === 'dml' ? 'INSERT, UPDATE oder DELETE schreiben …' : 'SELECT … FROM …'}" ${lock ? 'disabled' : ''}>${esc(a.s || '')}</textarea>
      <div class="btns" style="margin-top:6px"><button class="btn" data-ta="run">▶ Ausführen</button><button class="btn" data-ta="reset">↺ Datenbank zurücksetzen</button></div><div id="tkOut">${S.tOut}</div>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c], msg: '' }; }
    if (q.ask.type === 'num') { const v = C.parseDe(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; } return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: C.fmtVal(v) + ' ' + q.ask.unit, msg: '' }; }
    const s = (a.s || '').trim(); if (!s) { toast('Schreibe zuerst deine SQL-Anweisung.'); return null; }
    const c = D.checkTask(q, s); return { ok: c.ok, given: 'deine Anweisung', msg: c.msg };
  }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig. ' + esc(r.msg || r.given) : (isSql(q) ? '✗ ' + esc(r.msg) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.')}</li></ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b>${isSql(q) ? codeBlock(q.sol) : ' ' + esc(solText(q))}<br><b>Lösungsweg:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${q.code ? codeBlock(q.code) : ''}${q.table ? tableHtml(q.table.cols, q.table.rows) : ''}${qBody(q, a, r)}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">Abfragen werden automatisch geprüft: Dein Ergebnis wird mit dem Soll-Ergebnis verglichen (Spaltennamen sind egal, die Reihenfolge der Zeilen nur, wenn die Aufgabe sortiert verlangt).</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const q = S.tq, a = S.tAns[t.id] || {}, e = evalQ(q, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    S.tRes = { id: t.id, ok: e.ok, given: e.given, msg: e.msg, pct };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast('Noch nicht richtig. Lies die Meldung und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function runTask() {
    const t = curTask(); if (!t) return; const ta = $('#tkSql'); const a = (S.tAns[t.id] = S.tAns[t.id] || {}); if (ta) a.s = ta.value;
    if (!(a.s || '').trim()) { toast('Schreibe zuerst deine SQL-Anweisung.'); return; }
    if (!S.twdb) S.twdb = C.cloneDb(D.makeDb());
    const r = C.exec(S.twdb, a.s); S.tOut = resultHtml(r, S.twdb, false); const o = $('#tkOut'); if (o) o.innerHTML = S.tOut; if (!r.ok) sad();
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
    S.task = id; S.tq = D.makeTask(t); S.tAns = {}; S.tRes = null; S.tOut = ''; S.twdb = null;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  const tv = $('#taskView');
  tv.addEventListener('input', e => { const t = curTask(); if (!t) return; const a = (S.tAns[t.id] = S.tAns[t.id] || {}); if (e.target.dataset.in) a.v = e.target.value; else if (e.target.id === 'tkSql') a.s = e.target.value; });
  tv.addEventListener('keydown', e => { const t = curTask(); if (!t) return; if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.id === 'tkSql') { e.preventDefault(); runTask(); } });
  tv.addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (ta && t) {
      const a = ta.dataset.ta;
      if (a === 'chk') { const area = $('#tkSql'); if (area) (S.tAns[t.id] = S.tAns[t.id] || {}).s = area.value; checkTask(t); }
      else if (a === 'run') runTask();
      else if (a === 'reset') { S.twdb = null; S.tOut = ''; const o = $('#tkOut'); if (o) o.innerHTML = ''; toast('Datenbank zurückgesetzt'); }
      else if (a === 'hint') hintFor(S.tq, t.id);
      else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); }
      else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); }
      return;
    }
    if (row) startTask(row.dataset.t);
  });

  /* ============================================================ Beispiele */
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele. Jedes wird auf einer frischen Datenbank ausgeführt. Mit „In den Editor laden“ kannst du die Abfrage verändern und selbst ausprobieren.</p>` + D.examples.map(e => {
      const db = C.cloneDb(D.makeDb()), r = C.exec(db, e.sql);
      return `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${codeBlock(e.sql)}${resultHtml(r, db, false)}<div class="btns"><button class="btn pri" data-ex="${e.id}">In den Editor laden</button></div></div>`;
    }).join('');
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex); if (!x) return;
    edSql = x.sql; lsSet('ed', edSql); S.edOut = ''; setTab('ed'); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  /* PRUEFEN P12: Schreibweisen im Lab: Schlüsselwörter groß oder klein, Texte und Datum in einfachen Hochkommas, Datum als 'JJJJ-MM-TT', Dezimalpunkt statt Komma, Namen ohne Umlaute. Passt das zu den Schreibweisen im Unterricht (z. B. MySQL/Access)? */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">ℹ Dieses Lab hat einen eigenen, kleinen SQL-Interpreter für den Unterricht. Er versteht den wichtigsten Teil von SQL (SELECT, JOIN, GROUP BY, INSERT, UPDATE, DELETE). Einzelne Details können sich von deiner Datenbank im Betrieb unterscheiden (z. B. MySQL, SQLite, PostgreSQL, Access).</div>` +
      sec('Aufbau einer Abfrage', `<span class="eq">SELECT spalten<br>FROM tabelle<br>[JOIN tabelle2 ON bedingung]<br>[WHERE zeilenbedingung]<br>[GROUP BY spalten [HAVING gruppenbedingung]]<br>[ORDER BY spalte [DESC]]<br>[LIMIT zahl]</span><p>Die Datenbank arbeitet in dieser Reihenfolge: <b>FROM/JOIN</b> (Tabellen verbinden) → <b>WHERE</b> (Zeilen filtern) → <b>GROUP BY</b> (gruppieren) → <b>HAVING</b> (Gruppen filtern) → <b>SELECT</b> (Spalten berechnen) → <b>ORDER BY</b> (sortieren) → <b>LIMIT</b> (kürzen). Darum kennt WHERE keine Aggregatfunktionen, HAVING aber schon.</p><p>Texte und Datum stehen in <b>einfachen Hochkommas</b> ('Halle', '2024-08-01'), Zahlen ohne. Dezimalzahlen mit Punkt (4.5).</p>`, true) +
      sec('Bedingungen und Vergleiche', `<table><tr><th>Schreibweise</th><th>Bedeutung</th></tr><tr><td>= &lt;&gt; &lt; &lt;= &gt; &gt;=</td><td>Vergleiche (ungleich ist &lt;&gt;)</td></tr><tr><td>AND, OR, NOT</td><td>verknüpfen; AND bindet stärker als OR, im Zweifel Klammern setzen</td></tr><tr><td>BETWEEN a AND b</td><td>von a bis b, Grenzen eingeschlossen</td></tr><tr><td>IN ('a', 'b')</td><td>Wert kommt in der Liste (oder Unterabfrage) vor</td></tr><tr><td>LIKE '%kabel%'</td><td>Textmuster: % = beliebig viele Zeichen, _ = genau ein Zeichen (im Lab ohne Unterschied zwischen Groß- und Kleinschreibung)</td></tr><tr><td>IS NULL / IS NOT NULL</td><td>leer / nicht leer</td></tr></table>`) +
      sec('NULL: unbekannt', `<p>NULL bedeutet „kein Wert“. Jeder Vergleich mit NULL (auch NULL = NULL) ergibt weder wahr noch falsch, sondern <b>unbekannt</b>, und WHERE lässt nur „wahr“ durch. Deshalb:</p><ul><li>Leere Felder findest du mit <b>IS NULL</b>, nicht mit = NULL.</li><li>COUNT(spalte) zählt nur Zeilen, in denen die Spalte nicht NULL ist, COUNT(*) zählt alle Zeilen.</li><li>SUM, AVG, MIN und MAX überspringen NULL.</li><li>NOT IN mit einer Liste, die NULL enthält, liefert nie eine Zeile.</li><li>Beim Sortieren steht NULL im Lab am Anfang.</li></ul>`) +
      sec('Aggregatfunktionen und GROUP BY', `<table><tr><th>Funktion</th><th>Ergebnis</th></tr><tr><td>COUNT(*)</td><td>Anzahl der Zeilen</td></tr><tr><td>SUM(x), AVG(x)</td><td>Summe, Mittelwert</td></tr><tr><td>MIN(x), MAX(x)</td><td>kleinster, größter Wert</td></tr></table><p>Ohne GROUP BY ist das Ergebnis eine einzige Zeile. Mit <b>GROUP BY</b> gibt es eine Zeile je Gruppe. Jede Spalte hinter SELECT muss dann in GROUP BY stehen oder in einer Aggregatfunktion verpackt sein. <b>HAVING</b> filtert die fertigen Gruppen (z. B. HAVING COUNT(*) &gt; 1).</p>`) +
      sec('JOIN', `<table><tr><th>Art</th><th>Ergebnis</th></tr><tr><td>INNER JOIN … ON</td><td>nur Zeilen, die auf beiden Seiten einen Partner haben</td></tr><tr><td>LEFT JOIN … ON</td><td>alle Zeilen der linken Tabelle; ohne Partner sind die Spalten der rechten NULL</td></tr><tr><td>FROM a, b (ohne Bedingung)</td><td>Kreuzprodukt: jede Zeile von a mit jeder von b</td></tr></table><p>Die Bedingung (ON) vergleicht meist Fremdschlüssel und Primärschlüssel: <span class="eq">… FROM bestellung b JOIN kunde k ON k.kunde_id = b.kunde_id</span> Aliase (b, k) kürzen die Schreibweise und helfen, wenn eine Spalte in zwei Tabellen gleich heißt (z. B. name). Drei Tabellen brauchen zwei JOINs. RIGHT und FULL JOIN kennt das Lab nicht: Vertausche die Tabellen und nimm LEFT JOIN.</p>`) +
      sec('INSERT, UPDATE, DELETE', `<span class="eq">INSERT INTO tabelle (spalte1, spalte2) VALUES (wert1, wert2)</span><span class="eq">UPDATE tabelle SET spalte = wert WHERE bedingung</span><span class="eq">DELETE FROM tabelle WHERE bedingung</span><p><b>Ohne WHERE gilt UPDATE und DELETE für alle Zeilen der Tabelle.</b> Prüfe die Bedingung vorher mit einem SELECT. Die Datenbank prüft Primärschlüssel (eindeutig, nicht leer), Fremdschlüssel (der Verweis muss existieren, eine Zeile darf nicht gelöscht werden, solange andere auf sie zeigen) und Datentypen. Darum löschst du erst die Positionen, dann die Bestellung.</p>`) +
      sec('Unterabfragen', `<p>Ein SELECT in Klammern. Liefert es <b>einen Wert</b>, steht es wie eine Zahl: <span class="eq">WHERE preis &gt; (SELECT AVG(preis) FROM artikel)</span>Liefert es <b>eine Liste</b>, nimmst du IN: <span class="eq">WHERE kunde_id IN (SELECT kunde_id FROM bestellung)</span>Auch EXISTS und NOT EXISTS sind möglich.</p>`) +
      sec('Schlüssel, ER-Modell und Normalformen', `<p><b>Primärschlüssel (PK):</b> identifiziert jede Zeile eindeutig, nie NULL. <b>Fremdschlüssel (FK):</b> verweist auf den Primärschlüssel einer anderen Tabelle. Beziehungen: <b>1:n</b> (Fremdschlüssel auf der n-Seite) und <b>n:m</b> (braucht eine Zwischentabelle mit zwei Fremdschlüsseln).</p><table><tr><th>Normalform</th><th>Regel (vereinfacht)</th></tr><tr><td>1. NF</td><td>Jede Zelle enthält genau einen Wert (atomar)</td></tr><tr><td>2. NF</td><td>1. NF und jede Nichtschlüsselspalte hängt vom ganzen Schlüssel ab, nicht nur von einem Teil</td></tr><tr><td>3. NF</td><td>2. NF und keine Nichtschlüsselspalte hängt von einer anderen Nichtschlüsselspalte ab</td></tr></table><p class="hint2">Ziel: Jede Information steht genau einmal (keine Redundanz, keine Änderungsanomalie).</p>`) +
      sec('Typische Fehler', `<ul><li><b>UPDATE oder DELETE ohne WHERE</b> ändert oder löscht alles.</li><li><b>JOIN ohne ON</b> (oder zwei Tabellen mit Komma ohne Bedingung) ergibt das Kreuzprodukt: Zeilenzahl = Zeilen a mal Zeilen b.</li><li><b>= NULL</b> findet nie etwas, nimm IS NULL.</li><li>AND und OR ohne Klammern: AND bindet stärker.</li><li>Text ohne Hochkommas wird als Spaltenname gelesen.</li><li>WHERE mit Aggregatfunktion: dafür gibt es HAVING.</li><li>COUNT(*) bei LEFT JOIN zählt auch die leere „Ersatzzeile“.</li><li><b>SQL-Injection:</b> Eingaben von Benutzern nie in den SQL-Text kleben, sondern als Parameter übergeben (Prepared Statements).</li></ul>`) +
      sec('Was das Lab (noch) nicht kann', `<p>Nicht enthalten sind: CREATE/ALTER/DROP, UNION, RIGHT und FULL JOIN, Fensterfunktionen, Datums- und Textfunktionen jenseits der Grundfunktionen (UPPER, LOWER, LENGTH, TRIM, SUBSTR, CONCAT, ROUND, ABS, COALESCE), Transaktionen. Die Daten werden nur im Arbeitsspeicher gehalten; mit „Datenbank zurücksetzen“ ist alles wieder im Ausgangszustand.</p><p class="hint2">Hinweis für Ausbilder: Wo das Lab sich bewusst für eine Variante entschieden hat (LIKE ohne Groß-/Kleinschreibung, NULL zuerst, Division mit Nachkommastellen, strenges GROUP BY), steht im Quelltext PRUEFEN.</p>`);
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'db'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ db: renderDb, ed: renderEd, tasks: renderTasks, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Datenbank-Lab (SQL)\n<small>' + esc(T[2]) + '</small>'; document.title = 'Datenbank-Lab (SQL): ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); palSig = ''; updatePal(); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Eine zufällige, noch nicht gelöste Aufgabe öffnen">🎲 Zufallsaufgabe</button>
      <span id="stat">Aufgaben gelöst <b>${n}/${TASKS.length}</b></span>`;
    $('#bExam').classList.toggle('on', exam()); $('#bExam').setAttribute('aria-pressed', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { const open = TASKS.filter(t => !done()[t.id]), pool = open.length ? open : TASKS; setTab('tasks'); startTask(pool[Math.floor(Math.random() * pool.length)].id); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('db');
  $('#bMenu').onclick = () => {
    const rows = [['db', 'Datenbank', 'ER-Modell und Tabellen der Firma'], ['ed', 'Editor', 'Eigene Abfragen ausprobieren'], ['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit automatischer Prüfung und Tipps'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Abfragen zum Laden'], ['help', 'Hilfe', 'SQL-Spickzettel'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben und Tipps dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.SQL_LAB = { id: 'sql', title: 'Datenbank-Lab (SQL)', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.SQL_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'db');
  /* Aufruf ?aufgabe=sql1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=join1 springt zu einem Beispiel) */
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
