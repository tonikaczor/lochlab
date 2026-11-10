'use strict';
/* Tonfunk Algorithmen-Lab: Oberfläche (Lab-Kennung 'alg').
   Reiter: Editor (Pseudocode ausführen mit Einzelschritt, Variablenüberwachung, Schreibtischtest), PAP & Struktogramm (Zeichner),
   Aufgaben, Trainer, Beispiele, Hilfe.
   Module: algcore.js (ALG_CORE: Interpreter, Zeichner), algdata.js (ALG_DATA, ALG_TASKS: Aufgaben, Beispiele, Antwort-Prüfung).
   Abgrenzung: Hardware-Programmierung übt das Arduino-Lab (codelab.html, C++ mit Bauteilen) und das Pi-Lab (pilab.html, Python); hier geht es um Algorithmen und Ablaufpläne.
   Speicher (Präfix lm4.alg.): tab, ed ({src, inputs}), dr ({src, view}), done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: alglab.html?aufgabe=alg1 öffnet die Aufgabe, alglab.html?bsp öffnet die Beispiele (?bsp=summe springt zu einem Beispiel). */
(function (root) {
  const C = root.ALG_CORE, D = root.ALG_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.alg.';
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Algorithmen-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">algcore.js oder algdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;
  const fmt = v => C.fmt(v);

  /* ============================================================ Zustand */
  const TABS = [['ed', '▶️', 'Editor'], ['draw', '📐', 'PAP & Struktogramm'], ['viz', '📊', 'Sortieren & Suchen'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const DEF_SRC = D.examples[0].src;
  const S = {
    tab: lsGet('tab', 'ed'),
    ed: Object.assign({ src: DEF_SRC, inputs: '' }, lsGet('ed', {})), run: null,
    dr: Object.assign({ src: '', view: 'beide' }, lsGet('dr', {})),
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (typeof S.ed.src !== 'string' || !S.ed.src.trim()) S.ed.src = DEF_SRC;
  if (typeof S.ed.inputs !== 'string') S.ed.inputs = '';
  if (typeof S.dr.src !== 'string') S.dr.src = '';
  if (['pap', 'nsd', 'beide'].indexOf(S.dr.view) < 0) S.dr.view = 'beide';
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const parseInputs = s => String(s || '').split(/[\s;]+/).filter(Boolean);
  const fig = (kind, src, blank, hi) => { const svg = kind === 'pap' ? C.drawPap(src, { blank, hi }) : C.drawNsd(src, { blank, hi }); return svg ? `<div class="inst fg"><div class="tw">${svg}</div></div>` : ''; };
  /* Visualisierung (algviz.js); ohne die Datei bleibt alles wie vorher */
  const VZ = (k, a, b) => { try { return root.ALG_VIZ ? root.ALG_VIZ[k](a, b) : ''; } catch (e) { return ''; } };
  /* Programmtext mit Zeilennummern; o.on = aktuelle Zeile, o.err = Fehlerzeile, o.pick = Zeilen sind antippbar (Index ab 0), o.sel/o.ok/o.bad = Markierungen (Index ab 0) */
  function codeView(src, o) {
    o = o || {}; const ls = String(src).split('\n');
    return `<div class="cv${o.pick ? ' pick' : ''}" role="${o.pick ? 'listbox' : 'region'}" aria-label="Programmtext">${ls.map((l, i) => {
      const c = (o.on === i + 1 ? ' on' : '') + (o.err === i + 1 ? ' err' : '') + ((o.sel || []).indexOf(i) >= 0 ? ' sel' : '') + ((o.ok || []).indexOf(i) >= 0 ? ' ok' : '') + ((o.bad || []).indexOf(i) >= 0 ? ' bad' : '');
      return `<div class="cl${c}"${o.pick ? ` data-ln="${i}" role="option" tabindex="0"` : ''}><span class="ln">${i + 1}</span><span class="tx">${esc(l) || ' '}</span></div>`;
    }).join('')}</div>`;
  }
  /* Schreibtischtest-Tabelle (aus dem Ablaufprotokoll des Interpreters) */
  function deskTable(res, idx, maxRows) {
    const tr = res.trace || []; if (!tr.length) return '';
    const names = []; tr.forEach(e => Object.keys(e.vars).forEach(k => { if (names.indexOf(k) < 0) names.push(k); }));
    const deep = tr.some(e => e.depth > 0);
    let a = 0, b = Math.min(tr.length, maxRows); if (idx >= maxRows - 50) { a = Math.max(0, idx - Math.floor(maxRows / 2)); b = Math.min(tr.length, a + maxRows); }
    let h = `<div class="tw dtw"><table class="tt dt2"><tr><th class="n">Schritt</th><th class="n">Zeile</th>${deep ? '<th>Ebene</th>' : ''}${names.map(k => `<th class="n">${esc(k)}</th>`).join('')}<th>Ausgabe</th></tr>`;
    for (let i = a; i < b; i++) {
      const e = tr[i], p = i > 0 ? tr[i - 1] : null, o = e.outN > (p ? p.outN : 0) ? res.out[e.outN - 1] : '';
      h += `<tr${i === idx ? ' class="cur" id="dtCur"' : ''}><td class="n">${e.n}</td><td class="n">${e.line}${e.cond === undefined ? '' : e.cond ? ' ✓' : ' ✗'}</td>${deep ? `<td>${esc(e.scope || 'Haupt')}${e.depth ? ' (' + e.depth + ')' : ''}</td>` : ''}${names.map(k => { const v = e.vars[k], pv = p && p.scope === e.scope ? p.vars[k] : undefined, ch = v !== undefined && JSON.stringify(v) !== JSON.stringify(pv); return `<td class="n${ch ? ' chg' : ''}">${v === undefined ? '' : esc(fmt(v))}</td>`; }).join('')}<td>${esc(o)}</td></tr>`;
    }
    h += '</table></div>';
    if (a > 0 || b < tr.length) h += `<p class="hint2">Gezeigt werden die Schritte ${a + 1} bis ${b} von ${tr.length}.</p>`;
    if (res.traceCut) h += `<p class="hint2">Der Tabellentest zeigt nur die ersten ${tr.length} Schritte.</p>`;
    return h + '<p class="hint2">✓ / ✗ hinter der Zeile: Bedingung war wahr / falsch. Fett: Wert hat sich in diesem Schritt geändert.</p>';
  }
  function errText(res) {
    const e = res.error; if (!e) return '';
    return (e.kind === 'syntax' ? 'Schreibfehler im Programm' : e.kind === 'limit' ? 'Schrittgrenze erreicht' : 'Laufzeitfehler') + ' in Zeile ' + e.line + ': ' + e.msg;
  }

  /* ============================================================ Editor */
  /* PRUEFEN P21: Schrittgrenze als Schutz vor Endlosschleifen: 5.000 Schritte im Editor, 100.000 in den Aufgaben. Reichen diese Grenzen für die Aufgaben im Unterricht (z. B. Sortieren mit mehr als 20 Werten)? */
  function runEd(all) {
    const res = C.run(S.ed.src, { inputs: parseInputs(S.ed.inputs), trace: true, traceMax: 2000, maxSteps: 5000 });
    S.run = { res, src: S.ed.src, idx: all ? (res.trace.length - 1) : -1 };
  }
  function renderEd() {
    const exOpts = D.examples.map(e => `<option value="${esc(e.id)}">${esc(e.title)}</option>`).join('');
    $('#edView').innerHTML = `<div class="card pl"><h4>Pseudocode-Programm</h4>
      <label class="f"><span>Beispielprogramm laden</span><select data-k="ex"><option value="">– auswählen –</option>${exOpts}</select></label>
      <textarea class="code" id="edSrc" data-k="src" rows="11" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="Programmtext">${esc(S.ed.src)}</textarea>
      <label class="f" style="margin-top:8px"><span>Eingaben für die „Eingabe“-Befehle (durch Leerzeichen getrennt, Dezimalkomma erlaubt)</span><input data-k="inputs" autocomplete="off" value="${esc(S.ed.inputs)}"></label>
      <div class="btns"><button class="btn pri" data-ea="all">▶ Ausführen</button><button class="btn" data-ea="step">⏭ Einzelschritt</button><button class="btn" data-ea="back">⏮ Schritt zurück</button><button class="btn" data-ea="reset">⏹ Zurücksetzen</button></div>
      <p class="hint2">Die Befehle stehen im Reiter „Hilfe“. „Ende“ allein schließt den innersten Block, mit ; trennst du Befehle in einer Zeile.</p></div><div id="edOut"></div>`;
    renderEdOut();
  }
  function renderEdOut() {
    const el = $('#edOut'); if (!el) return; const R = S.run;
    if (!R || R.src !== S.ed.src) { el.innerHTML = `<div class="rdout">Drücke „▶ Ausführen“ für den ganzen Ablauf oder „⏭ Einzelschritt“, um das Programm Schritt für Schritt zu verfolgen. Dabei siehst du, wie sich die Variablen ändern (automatischer Schreibtischtest).</div>`; return; }
    const res = R.res, tr = res.trace, cur = R.idx >= 0 ? tr[R.idx] : null, last = R.idx === tr.length - 1;
    let h = '';
    if (res.error && res.error.kind === 'syntax') { el.innerHTML = note(errText(res), 'bad') + codeView(R.src, { err: res.error.line }) + '<p class="hint2">Behebe den Fehler im Programmtext oben und starte noch einmal.</p>'; return; }
    h += `<div class="stats"><div class="bx"><b>${R.idx + 1}/${tr.length}</b>Schritt</div><div class="bx"><b>${res.steps}</b>Schritte gesamt</div><div class="bx"><b>${res.cmp}</b>Vergleiche</div></div>`;
    h += codeView(R.src, { on: cur ? cur.line : 0, err: last && res.error ? res.error.line : 0 });
    const outN = cur ? cur.outN : 0, outs = res.out.slice(0, outN);
    if (cur) {
      const ks = Object.keys(cur.vars);
      h += `<div class="card pl"><h4>Variablen${cur.depth ? ' in Funktion ' + esc(cur.scope) + ' (Ebene ' + cur.depth + ')' : ''}</h4>${ks.length ? `<div class="tw"><table class="tt"><tr><th>Name</th><th class="n">Wert</th></tr>${ks.map(k => { const p = R.idx > 0 && tr[R.idx - 1].scope === cur.scope ? tr[R.idx - 1].vars[k] : undefined, ch = JSON.stringify(p) !== JSON.stringify(cur.vars[k]); return `<tr><td><b>${esc(k)}</b></td><td class="n${ch ? ' chg' : ''}">${esc(fmt(cur.vars[k]))}</td></tr>`; }).join('')}</table></div>` : '<p class="hint2">Noch keine Variable hat einen Wert.</p>'}
        <p class="hint2">Zeile ${cur.line}${cur.cond === undefined ? '' : cur.cond ? ': die Bedingung ist wahr' : ': die Bedingung ist falsch'}.</p></div>`;
    } else h += `<div class="rdout">Vor dem ersten Schritt. Tippe auf „⏭ Einzelschritt“.</div>`;
    h += `<div class="rdout ${last && res.finished ? 'ok' : ''}"><span class="st">Ausgabe${last && res.finished ? ' (Programm beendet)' : ''}</span>${outs.length ? outs.map(esc).join('<br>') : '–'}</div>`;
    if (last && res.error) h += note(errText(res), 'bad');
    el.innerHTML = h + VZ('trace', res, R.idx) + `<div class="card pl"><h4>Schreibtischtest</h4>${deskTable(res, R.idx, 300)}</div>`;
    const c = $('#dtCur'); if (c && c.scrollIntoView && R.idx > 0) try { c.scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }
  $('#edView').addEventListener('input', e => {
    const k = e.target.dataset.k; if (!k) return;
    if (k === 'ex') { const x = D.examples.find(z => z.id === e.target.value); if (x) { S.ed.src = x.src; S.ed.inputs = (x.inputs || []).join(' '); S.run = null; lsSet('ed', S.ed); renderEd(); } return; }
    S.ed[k] = e.target.value; S.run = null; lsSet('ed', S.ed); renderEdOut();
  });
  $('#edView').addEventListener('keydown', e => { if (e.target.id === 'edSrc' && e.key === 'Tab') { e.preventDefault(); const t = e.target, a = t.selectionStart, b = t.selectionEnd; t.value = t.value.slice(0, a) + '  ' + t.value.slice(b); t.selectionStart = t.selectionEnd = a + 2; S.ed.src = t.value; S.run = null; lsSet('ed', S.ed); } });
  $('#edView').addEventListener('click', e => {
    const b = e.target.closest('[data-ea]'); if (!b) return; const a = b.dataset.ea;
    if (a === 'all') runEd(true);
    else if (a === 'step') {
      if (!S.run || S.run.src !== S.ed.src) runEd(false);
      const R = S.run; if (R.res.error && R.res.error.kind === 'syntax') { renderEdOut(); return; }
      if (!R.res.trace.length) { toast('Das Programm hat keine Anweisung.'); return; }
      if (R.idx < R.res.trace.length - 1) R.idx++; else toast(R.res.error ? 'Hier endet der Ablauf mit einem Fehler.' : 'Das Programm ist zu Ende.');
    } else if (a === 'back') { if (S.run && S.run.src === S.ed.src && S.run.idx >= 0) S.run.idx--; }
    else if (a === 'reset') S.run = null;
    renderEdOut();
  });

  /* ============================================================ Zeichner */
  const KURZ = [
    ['Positiv oder nicht', 'Eingabe x; Wenn x > 0 dann; Ausgabe "positiv"; Sonst; Ausgabe "nicht positiv"; Ende'],
    ['Summe bis n', 'Eingabe n; Setze s auf 0; Für i von 1 bis n; Setze s auf s + i; Ende; Ausgabe s'],
    ['Zahl raten', 'Setze zahl auf 7; Wiederhole; Eingabe tipp; Bis tipp = zahl; Ausgabe "richtig"']
  ];
  function renderDraw() {
    if (!S.dr.src.trim()) S.dr.src = S.ed.src;
    $('#drawView').innerHTML = `<div class="card pl"><h4>Programm oder Kurzbeschreibung</h4>
      <textarea class="code" id="drSrc" data-d="src" rows="7" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="Pseudocode">${esc(S.dr.src)}</textarea>
      <div class="fbar" style="margin-top:8px">${seg('data-dv', [['pap', 'Ablaufplan'], ['nsd', 'Struktogramm'], ['beide', 'Beide']], S.dr.view)}</div>
      <div class="btns"><button class="btn" data-da="fromEd">↙ Aus dem Editor holen</button><button class="btn" data-da="toEd">↗ In den Editor übernehmen</button></div>
      <p class="hint2">Kurzform: Befehle mit ; trennen, „Ende“ schließt den innersten Block. Beispiele zum Ausprobieren:</p>
      <div class="ctl">${KURZ.map((k, i) => `<button class="chip s" data-da="kurz${i}">${esc(k[0])}</button>`).join('')}</div></div><div id="drOut"></div>`;
    renderDrawOut();
  }
  function renderDrawOut() {
    const el = $('#drOut'); if (!el) return; const src = S.dr.src, P = C.parse(src);
    if (!P.ok) { el.innerHTML = note('Zeile ' + P.error.line + ': ' + P.error.msg, 'bad') + codeView(src, { err: P.error.line }); return; }
    let h = '';
    if (S.dr.view !== 'nsd') h += `<div class="card pl"><h4>Programmablaufplan (PAP)</h4><div class="tw">${C.drawPap(src)}</div></div>`;
    if (S.dr.view !== 'pap') h += `<div class="card pl"><h4>Struktogramm (Nassi-Shneiderman)</h4><div class="tw">${C.drawNsd(src)}</div></div>`;
    el.innerHTML = h + VZ('legend') + '<p class="hint2">Die Zeichnung entsteht direkt aus dem Pseudocode. Rechtecke sind Zuweisungen, Parallelogramme Ein- und Ausgaben, Rauten Entscheidungen.</p>';
  }
  $('#drawView').addEventListener('input', e => { if (e.target.dataset.d === 'src') { S.dr.src = e.target.value; lsSet('dr', S.dr); renderDrawOut(); } });
  $('#drawView').addEventListener('click', e => {
    const v = e.target.closest('[data-dv]'), a = e.target.closest('[data-da]');
    if (v) { S.dr.view = v.dataset.dv; lsSet('dr', S.dr); renderDraw(); return; }
    if (!a) return; const k = a.dataset.da;
    if (k === 'fromEd') { S.dr.src = S.ed.src; lsSet('dr', S.dr); renderDraw(); }
    else if (k === 'toEd') { S.ed.src = S.dr.src; S.run = null; lsSet('ed', S.ed); setTab('ed'); toast('Programm im Editor.'); }
    else if (/^kurz/.test(k)) { S.dr.src = KURZ[+k.slice(4)][1]; lsSet('dr', S.dr); renderDraw(); }
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

  /* Antwortfeld je nach Aufgabenart; a = Antwortzustand, r = Ergebnis (oder null), lock = nicht mehr änderbar */
  function ansHtml(q, a, r, lock) {
    const k = q.ask.type, dis = lock ? ' disabled' : '';
    if (k === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}"${dis} class="${r && lock && i === q.ask.correct ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    if (k === 'num') return `<label class="f"><span>${esc(q.ask.label)}${q.ask.unit ? ' (' + esc(q.ask.unit) + ')' : ''}</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}"${dis}>${q.ask.unit ? `<span class="u">${esc(q.ask.unit)}</span>` : ''}</div></label>`;
    if (k === 'out') return `<label class="f"><span>${esc(q.ask.label)} (mehrere Werte durch Leerzeichen trennen)</span><textarea data-in="1" rows="2" autocomplete="off" autocapitalize="off" spellcheck="false" style="min-height:64px"${dis}>${esc(a.v || '')}</textarea></label>`;
    if (k === 'line') return `<p class="hint2" style="margin:6px 0 0">Tippe die Zeile an, die den Fehler enthält.</p>` + codeView(q.ask.lines.join('\n'), { pick: !lock, sel: r && lock ? [] : (a.s || []), ok: r && lock ? q.ask.correct : [], bad: r && !r.ok ? (a.s || []).filter(x => q.ask.correct.indexOf(x) < 0) : [] });
    if (k === 'order') {
      const sq = a.seq || [];
      return `<p class="hint2" style="margin:6px 0 0">Tippe die Blöcke in der richtigen Reihenfolge an (von oben nach unten im Plan).</p><div class="ctl">${q.ask.items.map((t, i) => `<button class="chip${sq.indexOf(i) >= 0 ? ' on' : ''}" data-oi="${i}"${sq.indexOf(i) >= 0 || lock ? ' disabled' : ''}>${esc(t)}</button>`).join('')}</div>
        <div class="rdout"><span class="st">Deine Reihenfolge</span>${sq.length ? sq.map((i, p) => `<b>${p + 1}.</b> ${esc(q.ask.items[i])}`).join('<br>') : '–'}</div>
        ${lock ? '' : '<div class="ctl"><button class="chip s" data-oa="undo">↶ Letzten entfernen</button><button class="chip s" data-oa="reset">Neu anordnen</button></div>'}`;
    }
    if (k === 'table') {
      const cells = a.cells || {};
      return `<div class="tw"><table class="tt"><tr><th class="n">Zeile</th>${q.ask.cols.map(c => `<th class="n">${esc(c)}</th>`).join('')}</tr>${q.ask.rows.map((row, ri) => `<tr><td class="n">${ri + 1}</td>${row.map((v, ci) => {
        if (v !== null) return `<td class="n">${esc(fmt(v))}</td>`;
        const key = ri + ',' + ci, x = C.parseDe(cells[key]), cls = r && Number.isFinite(x) ? (Math.abs(x - q.ask.full[ri][ci]) < 1e-9 ? ' okc' : ' badc') : '';
        return `<td class="n"><input class="cell${cls}" data-cell="${key}" inputmode="decimal" autocomplete="off" value="${esc(cells[key] || '')}"${dis}></td>`;
      }).join('')}</tr>`).join('')}</table></div>`;
    }
    if (k === 'code') return `<p class="hint2" style="margin:6px 0 0">Schreibe die fehlenden Zeilen in das Feld (eine Anweisung je Zeile).</p>${codeView(q.ask.before.join('\n'))}<textarea class="code" data-in="1" rows="3" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="Deine Zeilen"${dis}>${esc(a.v || '')}</textarea>${codeView(q.ask.after.join('\n'))}`;
    return '';
  }
  function qHead(q) {
    let h = `<p style="margin:8px 0">${esc(q.text)}</p>`;
    if (q.inputs && q.inputs.length) h += `<p class="hint2" style="margin:0 0 4px">Die Eingaben (der Reihe nach, für die „Eingabe“-Befehle): <b>${esc(q.inputs.join(', '))}</b></p>`;
    if (q.prog) h += codeView(q.prog);
    if (q.cpp) h += codeView(q.cpp);   // C++-Ausschnitt (nur zum Lesen, wird nicht vom Interpreter ausgeführt)
    if (q.fig) h += fig(q.fig.kind, q.fig.src, q.fig.blank);
    return h;
  }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li>${r.msg ? `<li>ℹ ${esc(r.msg)}</li>` : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> <span class="pre">${esc(D.solText(q))}</span><br><br><b>Lösungsweg:</b> <span class="pre">${esc(q.expl)}</span></div>${r.ok && q.reveal ? fig(q.reveal.kind, q.reveal.src) : ''}` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || (S.tAns[t.id] = {});
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${qHead(q)}${ansHtml(q, a, r, !!(r && r.ok))}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button>${q.prog && q.ask.type !== 'code' && !exam() ? '<button class="btn" data-ta="ed">▶ Im Editor testen</button>' : ''}<button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte. Der Editor ist hier gesperrt.</p>';
      if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = D.evalAnswer(S.tq, a); if (!e) return;
    if (e.incomplete) { toast(e.incomplete); return; }
    const pct = e.ok ? pctFor(t.id) : 0;
    S.tRes = { id: t.id, ok: e.ok, given: e.given, msg: e.msg, pct };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast('Noch nicht richtig. Lies den Hinweis und versuche es noch einmal.'); }
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
    S.task = id; S.tq = D.makeTask(t); S.tAns = {}; S.tRes = null;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  /* gemeinsame Bedienung der Antwortfelder (Aufgaben und Trainer): ctx() liefert {q, a, res, redraw} */
  function bindAnswers(view, ctx) {
    view.addEventListener('input', e => {
      const c = ctx(); if (!c || (c.res && (c.res.ok || c.rt))) return; const a = c.a;
      if (e.target.dataset.in) a.v = e.target.value; else if (e.target.dataset.cell) (a.cells = a.cells || {})[e.target.dataset.cell] = e.target.value;
    });
    view.addEventListener('click', e => {
      const c = ctx(); if (!c) return; const a = c.a, locked = c.res && (c.res.ok || c.rt);
      const tc = e.target.closest('[data-tc]'), ln = e.target.closest('[data-ln]'), oi = e.target.closest('[data-oi]'), oa = e.target.closest('[data-oa]');
      if (locked) return;
      if (tc) { a.c = +tc.dataset.tc; if (c.res && !c.res.ok) c.clear(); c.redraw(); }
      else if (ln) { a.s = [+ln.dataset.ln]; if (c.res && !c.res.ok) c.clear(); c.redraw(); }
      else if (oi) { (a.seq = a.seq || []).push(+oi.dataset.oi); if (c.res && !c.res.ok) c.clear(); c.redraw(); }
      else if (oa) { a.seq = oa.dataset.oa === 'undo' ? (a.seq || []).slice(0, -1) : []; if (c.res && !c.res.ok) c.clear(); c.redraw(); }
    });
    view.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.ln !== undefined) { e.preventDefault(); e.target.click(); } });
  }
  const tv = $('#taskView');
  bindAnswers(tv, () => { const t = curTask(); if (!t) return null; return { q: S.tq, a: S.tAns[t.id] || (S.tAns[t.id] = {}), res: S.tRes && S.tRes.id === t.id ? S.tRes : null, redraw: () => renderTasks(false), clear: () => { S.tRes = null; } }; });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in && e.target.tagName === 'INPUT') { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('click', e => {
    const t = curTask(), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (ta && t) {
      const a = ta.dataset.ta;
      if (a === 'chk') checkTask(t); else if (a === 'hint') hintFor(S.tq, t.id);
      else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); }
      else if (a === 'ed') { S.ed.src = S.tq.prog; S.ed.inputs = (S.tq.inputs || []).join(' '); S.run = null; lsSet('ed', S.ed); setTab('ed'); toast('Programm der Aufgabe im Editor.'); }
      else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); }
      return;
    }
    if (row) startTask(row.dataset.t);
  });

  /* Zufalls-Trainer (Tipps kosten hier nie etwas) */
  function newTrainer() { const T = S.tr; T.q = D.randomQ(R0, T.level); T.ans = {}; T.res = null; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar"><span class="lbl" style="font-size:12px;color:var(--mute)">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${qHead(q)}${ansHtml(q, T.ans, T.res, !!T.res)}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}</div>`;
  }
  const rv = $('#rtView');
  bindAnswers(rv, () => ({ q: S.tr.q, a: S.tr.ans, res: S.tr.res, rt: true, redraw: renderTrainer, clear: () => {} }));
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in && e.target.tagName === 'INPUT') { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if (!T.res && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res) return; const e = D.evalAnswer(T.q, T.ans); if (!e) return;
    if (e.incomplete) { toast(e.incomplete); return; }
    T.res = { ok: e.ok, given: e.given, msg: e.msg }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Beispiele */
  const exRuns = {};
  function exRun(e) { return exRuns[e.id] || (exRuns[e.id] = C.run(e.src, { inputs: e.inputs, trace: true, traceMax: 60, maxSteps: e.maxSteps || 5000 })); }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele. Mit „Im Editor öffnen“ kannst du das Programm Schritt für Schritt verfolgen und verändern.</p>` + D.examples.map(e => {
      const r = exRun(e);
      return `<div class="card pl" id="ex_${esc(e.id)}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${e.inputs ? `<p class="hint2" style="margin:0 0 4px">Eingaben: <b>${esc(e.inputs.join(', '))}</b></p>` : ''}${codeView(e.src)}
        <div class="rdout ${r.error ? 'warn' : 'ok'}"><span class="st">Ausgabe</span>${r.out.length ? r.out.map(esc).join('<br>') : '–'}${r.error ? '<br><b>' + esc(errText(r)) + '</b>' : ''}</div>
        <details><summary>Schreibtischtest anzeigen (${r.steps} Schritte)</summary>${deskTable(r, -1, 60)}</details>
        ${VZ('trace', r, -1) ? `<details><summary>Ablauf als Bild</summary>${VZ('trace', r, -1)}</details>` : ''}
        <div class="btns"><button class="btn pri" data-ex="${esc(e.id)}" data-exa="ed">▶ Im Editor öffnen</button><button class="btn" data-ex="${esc(e.id)}" data-exa="draw">📐 Zeichnen</button></div></div>`;
    }).join('');
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex); if (!x) return;
    if (b.dataset.exa === 'draw') { S.dr.src = x.src; lsSet('dr', S.dr); setTab('draw'); return; }
    S.ed.src = x.src; S.ed.inputs = (x.inputs || []).join(' '); S.run = null; lsSet('ed', S.ed); setTab('ed'); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    const tbl = (head, rows) => `<table><tr>${head.map(x => `<th>${x}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</table>`;
    $('#helpView').innerHTML =
      `<div class="rdout">Dieses Lab übt Algorithmen und Ablaufpläne ohne Hardware. Programmieren mit Bauteilen übst du im <a href="codelab.html">Arduino-Lab</a> (C++), mit dem Raspberry Pi im <a href="pilab.html">Pi-Lab</a> (Python).</div>` +
      sec('Der Pseudocode', tbl(['Befehl', 'Bedeutung'], [
        ['<code>Setze x auf 5</code>', 'Wert speichern (auch <code>x := 5</code>); Feldelement: <code>Setze a[2] auf 7</code>'],
        ['<code>Eingabe x</code>', 'nimmt den nächsten Wert aus dem Eingabefeld'],
        ['<code>Ausgabe x, "Text"</code>', 'schreibt eine Zeile; mehrere Werte stehen durch ein Leerzeichen getrennt'],
        ['<code>Wenn x &gt; 3 dann … Sonst Wenn … Sonst … Ende Wenn</code>', 'Verzweigung'],
        ['<code>Solange x &gt; 0 … Ende Solange</code>', 'kopfgesteuerte Schleife: Bedingung zuerst, der Körper läuft eventuell nie'],
        ['<code>Wiederhole … Bis x &gt; 5</code>', 'fußgesteuerte Schleife: der Körper läuft mindestens einmal, aufgehört wird, wenn die Bedingung wahr ist'],
        ['<code>Für i von 1 bis 10 Schritt 2 … Ende Für</code>', 'Zählschleife; ohne „Schritt“ zählt i in Einerschritten; Schritt −1 zählt abwärts'],
        ['<code>Funktion f(n) … Gib zurück n … Ende Funktion</code>', 'eigene Funktion; Aufruf <code>f(3)</code> in einem Ausdruck oder allein'],
        ['<code>// Kommentar</code>', 'wird ignoriert']
      ]) + `<p>Ausdrücke: <code>+ − * /</code>, <code>div</code> (ganzzahlig), <code>mod</code> (Rest), Vergleiche <code>= &lt;&gt; &lt; &gt; &lt;= &gt;=</code>, <code>und</code>, <code>oder</code>, <code>nicht</code>, <code>wahr</code>, <code>falsch</code>, Felder <code>[4, 8, 15]</code> (Index ab 0), <code>Länge(a)</code>, <code>Betrag</code>, <code>Wurzel</code>, <code>abrunden</code>, <code>Minimum</code>, <code>Maximum</code>, <code>Text</code>. Zahlen im Programm schreibst du mit Punkt (3.5), die Ausgabe zeigt Komma.</p><p><b>Kurzform:</b> Befehle mit ; trennen, ein einzelnes „Ende“ schließt den innersten Block. So kannst du Aufgabenbeschreibungen schnell in eine Zeichnung umwandeln.</p>`, true) +
      sec('Schritte und Schreibtischtest', `<p>Ein <b>Schritt</b> ist eine ausgeführte Anweisung (Setze, Eingabe, Ausgabe, Gib zurück, Aufruf) oder eine ausgewertete Bedingung (Wenn, Solange, Bis). Bei „Für“ zählt jeder Durchgang durch den Kopf als ein Schritt, auch der letzte, bei dem die Schleife verlassen wird.</p><p>Im <b>Schreibtischtest</b> notierst du nach jedem Schritt die Werte aller Variablen. Der Editor macht das automatisch: Schaue dir die Tabelle an und rechne danach selbst nach.</p><p>Wird ein Programm nicht fertig, bricht der Editor nach 5.000 Schritten ab (Schutz vor Endlosschleifen).</p>`) +
      sec('Variablen, Verzweigung, Schleifen', `<p>Eine <b>Variable</b> ist ein Speicherplatz mit Namen. Sie braucht vor dem ersten Lesen einen Wert (Initialisierung). Ein Wert wird überschrieben, wenn du neu zuweist: bei <code>Setze a auf a + b</code> wird erst die rechte Seite berechnet.</p><p>Die <b>Verzweigung</b> prüft Bedingungen von oben nach unten; der erste wahre Zweig läuft. Eine <b>Zählschleife</b> nimmst du, wenn du die Zahl der Durchläufe kennst, <b>Solange</b>, wenn sie von einer Bedingung abhängt, <b>Wiederhole … Bis</b>, wenn der Körper mindestens einmal laufen soll.</p>`) +
      sec('Ablaufplan (PAP)', tbl(['Symbol', 'Bedeutung'], [['abgerundetes Rechteck', 'Start und Ende'], ['Rechteck', 'Verarbeitung, Zuweisung (x := …)'], ['Parallelogramm', 'Eingabe oder Ausgabe'], ['Raute', 'Verzweigung, zwei Ausgänge „Ja“ und „Nein“'], ['Rechteck mit doppelten Seitenlinien', 'Aufruf eines Unterprogramms (einer Funktion)']]) + `<p>Pfeile zeigen die Ablaufrichtung. Bei einer Schleife führt ein Pfeil zurück zur Raute. Eine Zählschleife ist aufgelöst gezeichnet: Zähler setzen, Raute, Rumpf, Zähler weiterzählen.</p>`) +
      sec('Struktogramm (Nassi-Shneiderman)', `<p>Das Struktogramm hat keine Pfeile. Jeder Befehl ist ein Kasten, Kästen stehen von oben nach unten. Eine <b>Verzweigung</b> hat oben ein Dreieck mit der Bedingung, links der Ja-Zweig und rechts der Nein-Zweig. Eine <b>Schleife</b> hat eine Kopfzeile (Solange, Für) mit eingerücktem Rumpf; bei der fußgesteuerten Schleife steht die Bedingung „Bis …“ in der Fußzeile.</p>`) +
      sec('Suchen', `<p><b>Lineare Suche:</b> von vorn Element für Element vergleichen, bis der Wert gefunden ist. Im ungünstigsten Fall werden alle Elemente geprüft.</p><p><b>Binäre Suche:</b> nur in einem <i>sortierten</i> Feld. Man prüft die Mitte und wirft die Hälfte weg, in der der Wert nicht sein kann. Für 15 Elemente braucht man höchstens 4 Vergleiche.</p>`) +
      sec('Sortieren', `<p><b>Bubble-Sort:</b> Benachbarte Werte tauschen, wenn sie falsch stehen; der größte Wert wandert nach hinten.</p><p><b>Selection-Sort:</b> Immer das kleinste Element des Rests suchen und nach vorn tauschen.</p><p><b>Insertion-Sort:</b> Das nächste Element in den schon sortierten vorderen Teil einfügen; größere Werte rücken nach rechts.</p><p>Du kannst jedes Verfahren in den Beispielen Schritt für Schritt verfolgen.</p>`) +
      sec('Rekursion und Aufwand', `<p>Eine Funktion ist <b>rekursiv</b>, wenn sie sich selbst aufruft. Sie braucht immer eine Abbruchbedingung. <code>fak(n) = n · fak(n − 1)</code>, <code>fak(1) = 1</code>. Bei Fibonacci ruft jeder Aufruf zwei weitere auf; die Zahl der Aufrufe wächst schnell.</p><p><b>Aufwand grob:</b> Zähle die Vergleiche. Eine Schleife über n Elemente braucht etwa n Vergleiche, zwei verschachtelte Schleifen etwa n · n / 2. Verdoppelt man n, dann wächst der Aufwand der verschachtelten Schleifen ungefähr auf das Vierfache.</p>`) +
      sec('Zahlenalgorithmen', `<p><b>Teilersuche:</b> t ist Teiler von n, wenn <code>n mod t = 0</code>.</p><p><b>Primzahltest:</b> n ≥ 2 ist prim, wenn kein t mit 2 ≤ t und t · t ≤ n die Zahl teilt.</p><p><b>ggT (Euklid):</b> (a, b) durch (b, a mod b) ersetzen, bis b = 0; dann ist a der ggT.</p><p><b>Zahlensystem:</b> Dezimalzahl immer wieder durch die Basis teilen, die Reste von hinten nach vorn lesen. 13 → Reste 1, 0, 1, 1 → 1101.</p>`) +
      sec('Typische Fehler', `<ul><li><b>Grenze um eins daneben:</b> Läuft die Schleife von 0 bis n oder bis n − 1? Ein Feld mit n Elementen hat die Indizes 0 bis n − 1.</li><li><b>Schleife endet nie:</b> In der Bedingung vorkommende Variable wird nicht oder in die falsche Richtung geändert. Der Editor bricht nach der Schrittgrenze ab.</li><li><b>Variable ohne Anfangswert:</b> Summen starten bei 0, Produkte bei 1, ein Minimum beim ersten Element.</li><li><b>Falscher Vergleich:</b> &lt; statt &lt;=, = statt &lt;&gt;. Prüfe immer die Grenzfälle.</li><li><b>Rechenreihenfolge:</b> <code>a + b / 2</code> ist nicht <code>(a + b) / 2</code>.</li></ul>`) +
      `<p class="hint2">Notationen (Symbole, Schreibweisen) sind in Lehrbüchern leicht verschieden; Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  const RENDER = { ed: renderEd, draw: renderDraw, viz: () => { const v = $('#vizView'); if (v && root.ALG_VIZ) root.ALG_VIZ.mount(v); }, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp };
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'ed'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    RENDER[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Algorithmen-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Algorithmen-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); palSig = ''; updatePal(); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n, S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Frage im Trainer">🎲 Zufallsfrage</button>
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
  $('#title').onclick = () => setTab('ed');
  $('#bMenu').onclick = () => {
    const rows = [['ed', 'Editor', 'Pseudocode ausführen, Einzelschritt, Schreibtischtest'], ['draw', 'PAP und Struktogramm', 'Zeichnung aus dem Pseudocode'], ['viz', 'Sortieren und Suchen', 'Bubble-, Selection-, Insertion-Sort, lineare und binäre Suche als Balken'], ['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Algorithmen fertig durchgerechnet'], ['help', 'Hilfe', 'Pseudocode, Symbole, Verfahren'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Serien'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht.'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.ALG_LAB = { id: 'alg', title: 'Algorithmen-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.ALG_TASKS };

  /* Rauchtest für quelle/alg/test_algcore.js (läuft nur, wenn der Test window.__ALG_TEST setzt) */
  root.ALG_UI = {
    smoke: function () {
      if (!root.__ALG_TEST) return 'nur im Test';
      try {
        TABS.forEach(t => setTab(t[0]));
        TASKS.forEach(t => {
          setTab('tasks'); startTask(t.id); const q = S.tq, k = q.ask.type;
          S.tAns[t.id] = {}; checkTask(t);
          const wrong = k === 'choice' ? { c: (q.ask.correct + 1) % q.ask.choices.length } : k === 'num' ? { v: '-12345' } : k === 'out' ? { v: 'zzz' } : k === 'line' ? { s: [(q.ask.correct[0] + 1) % q.ask.lines.length] } : k === 'order' ? { seq: q.ask.items.map((x, i) => i) } : k === 'table' ? { cells: { '0,1': '9999', '0,2': '9999', '1,1': '9999', '1,0': '9999', '2,1': '9999', '2,0': '9999' } } : { v: 'Setze zzz auf 1' };
          S.tAns[t.id] = wrong; checkTask(t); renderTasks(false);
          S.tAns[t.id] = D.modelAnswer(q); S.tRes = null; checkTask(t);
          if (!S.tRes || !S.tRes.ok) throw new Error('Aufgabe ' + t.id + ': Musterlösung wird in der Oberfläche nicht akzeptiert');
          renderTasks(false); hintFor(q, t.id);
        });
        S.tr.level = 0; for (let k = 0; k < 40; k++) { newTrainer(); const q = S.tr.q; S.tr.ans = D.modelAnswer(q); trainerCheck(); renderTrainer(); }
        D.examples.forEach(e => { S.ed.src = e.src; S.ed.inputs = (e.inputs || []).join(' '); S.run = null; setTab('ed'); runEd(false); S.run.idx = 3; renderEdOut(); runEd(true); renderEdOut(); S.dr.src = e.src; setTab('draw'); });
        S.ed.src = 'Wenn x'; runEd(false); renderEdOut(); S.dr.src = 'Wenn x'; renderDrawOut();
        setTab('bsp'); setTab('help'); return 'ok';
      } catch (e) { return e && e.stack ? e.stack : String(e); }
    }
  };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'ed');
  /* Aufruf ?aufgabe=alg1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=summe springt zu einem Beispiel) */
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el && el.scrollIntoView) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
