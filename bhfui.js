'use strict';
/* Tonfunk Berichtsheft-Helfer: Oberfläche (Lab-Kennung 'bhf').
   Regelbasierte Schreibhilfe ohne KI und ohne Netz: Der Helfer prüft Stichpunkte zu einem Arbeitstag und formt daraus ein Tagesbericht-Gerüst.
   Er prüft nur Stil und Vollständigkeit, nicht die fachliche Richtigkeit. Form und Rhythmus des Ausbildungsnachweises legt der Betrieb fest (frag deinen Ausbilder).
   Reiter: Helfer (Tag), Woche, Aufgaben, Trainer, Beispiele, Hilfe.
   Module: bhfcore.js (BHF_CORE, Prüf- und Gerüstlogik), bhfdata.js (BHF_DATA, BHF_TASKS: Aufgaben, Beispiele).
   Speicher (Präfix lm4.bhf.): tab, hf (Entwurf: Beruf, Ort, Datum, Stichpunkte, Gelerntes), wo (Wochenentwurf), done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Der NAME wird nie gespeichert: Das Namensfeld lebt nur im Arbeitsspeicher der Seite und erscheint nur auf der Druckseite.
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: bhflab.html?aufgabe=bhf1 öffnet die Aufgabe, bhflab.html?bsp öffnet die Beispiele (?bsp=egs1 springt zu einem Beispiel). */
(function (root) {
  const C = root.BHF_CORE, D = root.BHF_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.bhf.';
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
  if (!C || !D) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Berichtsheft-Helfer</h4><p class="big">Dateien fehlen</p><p class="hint2">bhfcore.js oder bhfdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks, BER = C.BERUFE;

  /* ============================================================ Zustand */
  const TABS = [['helfer', '✍️', 'Tagesbericht'], ['woche', '🗓️', 'Woche'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  /* Voreinstellung für den Beruf: Wahl der Startseite (nur gelesen), sonst Elektroniker */
  const defBeruf = () => { try { const v = localStorage.getItem('lm4.beruf'); if (v && BER.some(b => b.k === v)) return v; } catch (e) {} return 'egs'; };
  /* PRUEFEN P14: Der Entwurf (Stichpunkte, Ort, Datum, Gelerntes) bleibt nur auf diesem Gerät im Browser (lm4.bhf.hf), der Name wird nie gespeichert. Ist das datenschutzrechtlich für euch in Ordnung, oder soll auch der Entwurf nicht gespeichert werden? */
  const S = {
    tab: lsGet('tab', 'helfer'),
    hf: Object.assign({ beruf: defBeruf(), ort: '', datum: '', text: '', gel: '' }, lsGet('hf', {})),
    wo: Object.assign({ beruf: defBeruf(), d: ['', '', '', '', ''] }, lsGet('wo', {})),
    name: '',
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (!BER.some(b => b.k === S.hf.beruf)) S.hf.beruf = 'egs';
  if (!BER.some(b => b.k === S.wo.beruf)) S.wo.beruf = 'egs';
  if (!Array.isArray(S.wo.d) || S.wo.d.length !== 5) S.wo.d = ['', '', '', '', ''];
  ['ort', 'datum', 'text', 'gel'].forEach(k => { if (typeof S.hf[k] !== 'string') S.hf[k] = ''; });
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();
  const saveHf = () => lsSet('hf', { beruf: S.hf.beruf, ort: S.hf.ort, datum: S.hf.datum, text: S.hf.text, gel: S.hf.gel });
  const saveWo = () => lsSet('wo', { beruf: S.wo.beruf, d: S.wo.d });
  const bName = k => C.berufOf(k).n;

  /* ============================================================ Bausteine */
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const NOTE = 'Der Helfer arbeitet mit festen Regeln (keine KI) und ohne Internet. Er prüft Stil und Vollständigkeit, nicht ob die Inhalte fachlich stimmen. Form und Rhythmus deines Ausbildungsnachweises legt dein Betrieb fest: frag deinen Ausbilder.';
  const beruSel = (k, cur) => `<label class="f"><span>Beruf</span><select data-k="${k}">${BER.map(b => `<option value="${b.k}"${b.k === cur ? ' selected' : ''}>${esc(b.n)}</option>`).join('')}</select></label>`;
  const GMSG = {
    leer: 'Das Feld „Gelernt“ ist leer: Schreibe auf, was du verstanden oder neu gekonnt hast.',
    vage: '„Gelernt“ ist zu vage („viel gelernt“ sagt nicht, was). Nenne eine konkrete Erkenntnis, die du nächstes Mal anwenden kannst.',
    wertung: '„Gelernt“ enthält eine Wertung („Spaß“, „interessant“). Schreibe stattdessen, was du Neues weißt oder kannst.',
    kurz: '„Gelernt“ ist sehr kurz. Ein vollständiger Satz mit dem Fachbegriff hilft deinem Ausbilder.',
    taetigkeit: '„Gelernt“ beschreibt eine Tätigkeit. Die gehört ins Gerüst; hier steht die Erkenntnis daraus (zum Beispiel „Eine Lötstelle muss glänzen“).'
  };
  const GMSG_ORDER = ['leer', 'vage', 'wertung', 'kurz', 'taetigkeit'];

  /* ---------- Auswertung als Liste ---------- */
  function findingsHtml(a) {
    const per = a.findings.filter(x => x.idx.length === 1 && ['vage', 'wertung', 'ich', 'dauer', 'dauervage', 'fach'].includes(x.code));
    const glob = a.findings.filter(x => !per.includes(x));
    const sev = x => (x.sev === 'warn' ? 0 : 1);
    per.sort((x, y) => x.idx[0] - y.idx[0] || sev(x) - sev(y));
    let h = '';
    const li = x => `<li class="${x.sev}">${x.idx.length === 1 ? `<span class="nr">Nr. ${x.idx[0] + 1}</span>` : ''}${esc(x.msg)}${x.idx.length === 1 ? `<small>„${esc(a.items[x.idx[0]].text.slice(0, 70))}${a.items[x.idx[0]].text.length > 70 ? '…' : ''}“</small>` : ''}</li>`;
    if (glob.length) h += '<div class="gh">Zum ganzen Eintrag</div><ul class="fl">' + glob.map(li).join('') + '</ul>';
    if (per.length) h += '<div class="gh">Zu einzelnen Stichpunkten</div><ul class="fl">' + per.map(li).join('') + '</ul>';
    if (a.gelernt) { const g = GMSG_ORDER.filter(k => a.gelernt.flags.includes(k)); if (g.length) h += '<div class="gh">Feld „Gelernt“</div><ul class="fl">' + g.map(k => `<li class="${k === 'leer' || k === 'taetigkeit' ? 'warn' : 'hint'}">${esc(GMSG[k])}</li>`).join('') + '</ul>'; }
    if (!a.findings.length && (!a.gelernt || !a.gelernt.flags.length)) h += '<ul class="fl"><li class="ok">Keine Hinweise. Lies den Eintrag trotzdem noch einmal laut und prüfe, ob die Tätigkeiten stimmen.</li></ul>';
    return h;
  }
  function gerustHtml(r) {
    if (!r.rows.length) return '';
    let h = `<div class="gh">Gerüst für den Tagesbericht</div><div class="card pl"><div class="tw"><table class="tt"><tr><th>Nr.</th><th>Tätigkeit</th><th>Dauer</th><th>Fachbegriff</th></tr>`;
    r.rows.forEach(w => {
      const same = w.taetigkeit.replace(/[.!?]$/, '') === w.orig.replace(/[.!?]$/, '');
      h += `<tr><td>${w.nr}</td><td>${w.neu ? `<span class="ph">noch konkret formulieren</span><br><small class="m">dein Stichpunkt: ${esc(w.orig)}</small>` : esc(w.taetigkeit) + (same ? '' : `<br><small class="m">dein Stichpunkt: ${esc(w.orig)}</small>`)}</td><td class="n">${w.dauer ? esc(w.dauer) : '<span class="ph">fehlt</span>'}</td><td>${w.fach ? esc(w.fach) : '<span class="ph">fehlt</span>'}</td></tr>`;
    });
    h += `</table></div><p class="hint2" style="margin:6px 0 0"><b>Ort / Abteilung:</b> ${r.ort ? esc(r.ort) : '<span class="ph">noch nicht eingetragen</span>'} · <b>Gesamtdauer:</b> ${r.total ? esc(C.fmtDauer(r.total)) + ' (' + esc(C.fmtStd(r.total)) + ')' : '<span class="ph">nicht berechenbar</span>'}</p>`;
    h += `<p class="hint2" style="margin:6px 0 0"><b>Gelernt:</b> ${r.gelernt.length ? r.gelernt.map(esc).join(' · ') : '<span class="ph">noch leer</span>'}</p></div>`;
    return h;
  }

  /* ============================================================ Tagesbericht */
  function renderHelfer() {
    const s = S.hf, b = C.berufOf(s.beruf);
    $('#helferView').innerHTML = `<p class="note">${esc(NOTE)}</p><div class="card pl"><h4>Dein Arbeitstag</h4>
      <div class="dsrow">${beruSel('beruf', s.beruf)}
      <label class="f"><span>Abteilung / Ort</span><input data-k="ort" list="orte" autocomplete="off" value="${esc(s.ort)}" placeholder="z. B. ${esc(b.ort[0].n)}"><datalist id="orte">${b.ort.map(o => `<option value="${esc(o.n)}">`).join('')}</datalist></label></div>
      <div class="dsrow"><label class="f"><span>Datum (optional)</span><input data-k="datum" autocomplete="off" value="${esc(s.datum)}" placeholder="z. B. 14.10."></label>
      <label class="f"><span>Name (optional, wird nicht gespeichert)</span><input data-name="1" autocomplete="off" value="${esc(S.name)}" placeholder="bleibt leer, wenn du es nicht brauchst"></label></div>
      <label class="f"><span>Stichpunkte: eine Tätigkeit pro Zeile, mit Dauer</span><textarea data-k="text" placeholder="z. B.&#10;Platine gelötet (2 Stunden)&#10;Ausgangsspannung am Netzteil gemessen (1 Stunde)">${esc(s.text)}</textarea></label>
      <label class="f"><span>Gelernt: Was weißt oder kannst du jetzt?</span><textarea class="sm" data-k="gel" placeholder="z. B. Eine Lötstelle muss glänzen und den Anschluss ganz umschließen.">${esc(s.gel)}</textarea></label>
      <div class="btns"><button class="btn" data-h="bsp">📖 Beispiel laden</button><button class="btn" data-h="clear">Leeren</button><button class="btn pri" data-h="print">🖨 Druckseite</button></div>
      <p class="hint2">Der Entwurf bleibt nur auf diesem Gerät. Der Name wird nirgends gespeichert und erscheint nur auf der Druckseite.</p></div><div id="hfOut"></div>`;
    updateHelfer();
  }
  function updateHelfer() {
    const s = S.hf, r = C.buildReport({ beruf: s.beruf, ort: s.ort, datum: s.datum, text: s.text, gelernt: s.gel }), a = r.analysis, el = $('#hfOut'); if (!el) return;
    if (!a.items.length) { el.innerHTML = note('Schreibe oben pro Zeile einen Stichpunkt zu deinem Arbeitstag. Der Helfer prüft sofort und baut daraus das Gerüst.', 'ok'); return; }
    const nW = a.findings.filter(x => x.sev === 'warn').length;
    el.innerHTML = `<div class="stats"><div class="bx"><b>${a.nTaet}</b>Tätigkeiten</div><div class="bx"><b>${a.total ? esc(C.fmtStd(a.total)) : '–'}</b>erfasste Dauer</div><div class="bx"><b>${nW}</b>Warnungen</div></div>` + findingsHtml(a) + gerustHtml(r);
  }
  const hv = $('#helferView');
  hv.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.name) { S.name = t.value; return; }
    const k = t.dataset.k; if (!k) return;
    S.hf[k] = t.value; saveHf();
    if (k === 'beruf') { renderHelfer(); return; }
    updateHelfer();
  });
  hv.addEventListener('click', e => {
    const b = e.target.closest('[data-h]'); if (!b) return;
    const a = b.dataset.h;
    if (a === 'clear') { S.hf = Object.assign(S.hf, { ort: '', datum: '', text: '', gel: '' }); S.name = ''; saveHf(); renderHelfer(); toast('Entwurf geleert'); }
    else if (a === 'bsp') { const pool = D.examples.filter(x => x.beruf === S.hf.beruf); const x = pool[Math.floor(R0() * pool.length)] || D.examples[0]; loadExample(x); }
    else if (a === 'print') printDay();
  });
  function loadExample(x) { S.hf = Object.assign(S.hf, { beruf: x.beruf, ort: x.ort, datum: '', text: x.stich, gel: x.gelernt }); saveHf(); setTab('helfer'); toast('Beispiel geladen: ' + x.title); }

  /* ---------- Druckseite ---------- */
  /* PRUEFEN P12: Die Druckseite zeigt Name (leer oder wie eingegeben), Beruf, Datum, Abteilung/Ort, Tabelle (Tätigkeit, Dauer, Fachbegriff), Gesamtdauer, Gelerntes und zwei Unterschriftszeilen. Entspricht das dem Vordruck eures Betriebs, oder fehlen Felder (z. B. Betrieb/Ausbildungsjahr, Stundenzahl, Berufsschule)? */
  function printDoc(html) {
    const pa = $('#printArea'); if (!pa) return;
    pa.innerHTML = html;
    toast('Die Druckansicht öffnet sich ...');
    setTimeout(() => { try { window.print(); } catch (e) { toast('Drucken ist auf diesem Gerät nicht möglich.'); } }, 120);
  }
  const printKopf = (extra) => `<div class="kopf"><div><b>Name:</b> ${S.name.trim() ? esc(S.name.trim()) : '&nbsp;'}</div><div><b>Beruf:</b> ${esc(extra.beruf)}</div>${extra.l1}${extra.l2}</div>`;
  const printSig = () => '<div class="sig"><div>Datum, Unterschrift Auszubildende/r</div><div>Datum, Unterschrift Ausbilder/in</div></div><p class="fuss">Entwurf aus dem Berichtsheft-Helfer (Tonfunk Lab). Form und Rhythmus des Ausbildungsnachweises legt dein Betrieb fest, frag deinen Ausbilder.</p>';
  function printDay() {
    const s = S.hf, r = C.buildReport({ beruf: s.beruf, ort: s.ort, datum: s.datum, text: s.text, gelernt: s.gel });
    if (!r.rows.length) { toast('Schreibe zuerst mindestens einen Stichpunkt.'); return; }
    let h = '<h1>Tagesbericht</h1>' + printKopf({ beruf: bName(s.beruf), l1: `<div><b>Datum:</b> ${s.datum.trim() ? esc(s.datum.trim()) : '&nbsp;'}</div>`, l2: `<div><b>Abteilung / Ort:</b> ${r.ort ? esc(r.ort) : '&nbsp;'}</div>` });
    h += '<table><tr><th>Nr.</th><th>Tätigkeit</th><th>Dauer</th><th>Fachbegriff</th></tr>' + r.rows.map(w => `<tr><td>${w.nr}</td><td>${esc(w.neu ? w.orig : w.taetigkeit)}</td><td>${esc(w.dauer)}</td><td>${esc(w.fach)}</td></tr>`).join('') + '</table>';
    h += `<p><b>Gesamtdauer:</b> ${r.total ? esc(C.fmtDauer(r.total)) : '&nbsp;'}</p><p><b>Gelernt:</b></p><div class="gel">${esc(r.gelernt.join('\n'))}</div>` + printSig();
    printDoc(h);
  }

  /* ============================================================ Woche */
  function renderWoche() {
    const w = S.wo;
    $('#wocheView').innerHTML = `<p class="note">${esc(NOTE)}</p><div class="card pl"><h4>Deine Woche</h4>${beruSel('wberuf', w.beruf)}
      <label class="f"><span>Name (optional, wird nicht gespeichert)</span><input data-name="1" autocomplete="off" value="${esc(S.name)}" placeholder="bleibt leer, wenn du es nicht brauchst"></label>
      ${C.TAGE.map((t, i) => `<label class="f"><span>${t}: eine Tätigkeit pro Zeile, mit Dauer</span><textarea class="sm" data-d="${i}" placeholder="z. B. Platine gelötet (2 Stunden)">${esc(w.d[i])}</textarea></label>`).join('')}
      <div class="btns"><button class="btn" data-w="clear">Leeren</button><button class="btn pri" data-w="print">🖨 Woche drucken</button></div></div><div id="woOut"></div>`;
    updateWoche();
  }
  /* PRUEFEN P13: Das Wochengerüst zeigt je Tag Anzahl der Tätigkeiten, Dauer und fehlende Zeitangaben, dazu Schwerpunkte (nach Zeit je Fachbegriff) und eine Satzvorlage für die Zusammenfassung. Berufsschulwochen, Urlaub, Krankheit und Feiertage sind nicht gesondert vorgesehen. Soll das ergänzt werden? */
  function updateWoche() {
    const w = S.wo, sm = C.weekSummary(w.d, w.beruf), el = $('#woOut'); if (!el) return;
    if (sm.empty === 5) { el.innerHTML = note('Schreibe zu mindestens einem Tag Stichpunkte, dann erscheint die Wochenübersicht.', 'ok'); return; }
    let h = `<div class="stats"><div class="bx"><b>${esc(C.fmtStd(sm.total))}</b>erfasste Dauer</div><div class="bx"><b>${sm.missing}</b>ohne Dauer</div><div class="bx"><b>${sm.empty}</b>leere Tage</div></div>`;
    h += `<div class="card pl"><div class="tw"><table class="tt"><tr><th>Tag</th><th class="n">Einträge</th><th class="n">Dauer</th><th>Hinweise</th></tr>${sm.days.map(d => `<tr><td>${esc(d.tag)}</td><td class="n">${d.n}</td><td class="n">${d.min ? esc(C.fmtDauer(d.min)) : '–'}</td><td class="m">${d.n ? (d.warn ? d.warn + ' Warnung' + (d.warn > 1 ? 'en' : '') : 'keine Warnung') + (d.miss ? ', ' + d.miss + 'x ohne Dauer' : '') : 'leer'}</td></tr>`).join('')}</table></div></div>`;
    const top = sm.byFach.slice(0, 3);
    const gerust = top.length ? 'In dieser Woche lag der Schwerpunkt bei ' + top.map(x => '„' + x.name + '“ (' + C.fmtStd(x.min) + ')').join(', ') + '; insgesamt wurden ' + C.fmtStd(sm.total) + ' erfasst. Gelernt: …' : '';
    if (gerust) h += `<div class="gh">Gerüst für die Zusammenfassung</div><div class="card pl"><p style="margin:0">${esc(gerust)}</p><p class="hint2">Ergänze hinter „Gelernt:“ ein bis zwei konkrete Erkenntnisse. Wertungen („anstrengend“, „toll“) bleiben draußen.</p></div>`;
    if (sm.missing) h += note(sm.missing + ' Eintrag/Einträge ohne Dauer: Die Wochenstunden stimmen so nicht. Ergänze die Zeiten im jeweiligen Tag.', 'warn');
    if (sm.empty) h += note(sm.empty + ' Tag(e) ohne Einträge. Berufsschule, Urlaub oder Krankheit trägst du so ein, wie es dein Betrieb vorgibt: frag deinen Ausbilder.', 'warn');
    el.innerHTML = h;
  }
  const wv = $('#wocheView');
  wv.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.name) { S.name = t.value; return; }
    if (t.dataset.k === 'wberuf') { S.wo.beruf = t.value; saveWo(); updateWoche(); return; }
    if (t.dataset.d != null) { S.wo.d[+t.dataset.d] = t.value; saveWo(); updateWoche(); }
  });
  wv.addEventListener('click', e => {
    const b = e.target.closest('[data-w]'); if (!b) return;
    if (b.dataset.w === 'clear') { S.wo.d = ['', '', '', '', '']; saveWo(); renderWoche(); toast('Woche geleert'); }
    else printWeek();
  });
  function printWeek() {
    const w = S.wo, sm = C.weekSummary(w.d, w.beruf);
    if (sm.empty === 5) { toast('Schreibe zuerst Stichpunkte zu mindestens einem Tag.'); return; }
    let h = '<h1>Wochenbericht</h1>' + printKopf({ beruf: bName(w.beruf), l1: '<div><b>Woche vom:</b> &nbsp;</div>', l2: '<div><b>Abteilung / Ort:</b> &nbsp;</div>' });
    h += '<table><tr><th>Tag</th><th>Tätigkeiten</th><th>Dauer</th></tr>' + C.TAGE.map((t, i) => {
      const r = C.buildReport({ beruf: w.beruf, text: w.d[i] });
      return `<tr><td>${esc(t)}</td><td>${esc(r.rows.map(x => (x.neu ? x.orig : x.taetigkeit)).join('; '))}</td><td>${r.total ? esc(C.fmtDauer(r.total)) : ''}</td></tr>`;
    }).join('') + '</table>';
    h += `<p><b>Gesamtdauer:</b> ${sm.total ? esc(C.fmtDauer(sm.total)) : '&nbsp;'}</p><p><b>Zusammenfassung / Gelernt:</b></p><div class="gel"></div>` + printSig();
    printDoc(h);
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
  function qBody(q, a, r, pre) {
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${r && (r.ok || pre === 'rt') ? 'disabled' : ''} class="${r && i === q.ask.correct && (r.ok || pre === 'rt') ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)} (${esc(q.ask.unit)})</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${r && (r.ok || pre === 'rt') ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div></label>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 2) + ' ' + q.ask.unit };
  }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 2))} ${esc(q.ask.unit)} (wegen Rundung).</li>` : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(solText(q))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${qBody(q, a, r, 'tk')}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">Alle Beispiele sind frei erfunden. Was in deinem Betrieb gilt, sagt dir dein Ausbilder.</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
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
    S.task = id; S.tq = D.makeTask(t); S.tAns = {}; S.tRes = null;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  const tv = $('#taskView');
  tv.addEventListener('input', e => { const t = curTask(); if (t && e.target.dataset.in) (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintFor(S.tq, t.id); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });

  /* Zufalls-Trainer (Tipps kosten hier nie etwas) */
  function newTrainer() { const T = S.tr; T.q = D.randomQ(R0, T.level); T.ans = {}; T.res = null; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar"><span class="lbl" style="font-size:12px;color:var(--mute)">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p style="margin:8px 0">${esc(q.text)}</p>${qBody(q, T.ans, T.res, 'rt')}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}</div>`;
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
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Frei erfundene Arbeitstage, jeder mit typischen Schwächen. Du siehst, was der Helfer findet. Mit „In den Helfer laden“ kannst du den Tag selbst verbessern.</p>` + D.examples.map(e => {
      const r = C.buildReport({ beruf: e.beruf, ort: e.ort, text: e.stich, gelernt: e.gelernt }), a = r.analysis;
      return `<div class="card pl" id="ex_${e.id}"><h4>Beispiel · ${esc(bName(e.beruf))}</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>
        <div class="rdout"><span class="st">Stichpunkte${e.ort ? ' · ' + esc(e.ort) : ''}</span>${a.items.map((x, i) => `${i + 1}. ${esc(x.text)}`).join('<br>')}${e.gelernt ? `<span class="st" style="margin-top:6px">Gelernt</span>${esc(e.gelernt)}` : ''}</div>
        <div class="stats"><div class="bx"><b>${a.nTaet}</b>Tätigkeiten</div><div class="bx"><b>${a.total ? esc(C.fmtStd(a.total)) : '–'}</b>erfasste Dauer</div><div class="bx"><b>${a.findings.filter(x => x.sev === 'warn').length}</b>Warnungen</div></div>
        ${findingsHtml(a)}<div class="btns"><button class="btn pri" data-ex="${e.id}">In den Helfer laden</button></div></div>`;
    }).join('');
  }
  $('#bspView').addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex); if (x) loadExample(x); });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(NOTE)}</div>` +
      sec('So arbeitest du mit dem Helfer', '<p>1. Wähle deinen Beruf und trage Abteilung oder Ort ein. 2. Schreibe pro Zeile eine Tätigkeit, mit Dauer. 3. Lies die Hinweise und verbessere die Zeilen. 4. Trage unter „Gelernt“ ein, was du weißt oder kannst. 5. Auf Wunsch druckst du die Seite aus. Den Namen musst du nicht eintragen; er wird nie gespeichert.</p>', true) +
      sec('Was der Helfer prüft', `<table><tr><th>Befund</th><th>Beispiel</th><th>Besser</th></tr>
        <tr><td>zu vage</td><td>„Ich habe geholfen.“</td><td>„Platine gelötet (2 Stunden).“</td></tr>
        <tr><td>Wertung statt Tätigkeit</td><td>„Das Feilen war langweilig.“</td><td>„Stahlwinkel gefeilt (1 Stunde).“</td></tr>
        <tr><td>Ich-Form</td><td>„Ich habe gemessen.“</td><td>„Spannung am Netzteil gemessen.“</td></tr>
        <tr><td>keine oder ungenaue Dauer</td><td>„vormittags“</td><td>„2 Stunden“ oder „von 8:00 bis 10:00 Uhr“</td></tr>
        <tr><td>kein Fachbegriff</td><td>„Teile sortiert.“</td><td>„Paletten kontrolliert.“</td></tr>
        <tr><td>Zeitform gemischt</td><td>„Ich habe gelötet. Danach prüfte ich.“</td><td>eine Zeitform durchhalten</td></tr>
        <tr><td>gleiche Satzanfänge</td><td>„Ich habe … Ich habe …“</td><td>mit der Tätigkeit beginnen</td></tr></table><p class="hint2">Die Regeln sind Faustregeln. Der Helfer kann sich irren; entscheidend ist, was dein Ausbilder verlangt.</p>`) +
      sec('Ein guter Stichpunkt', '<span class="eq">Tätigkeit + Gegenstand / Fachbegriff + Dauer</span><p>Beispiel: „Ausgangsspannung am Netzteil mit dem Multimeter gemessen (1 Stunde).“ Er sagt, was, womit und wie lange.</p>') +
      sec('Tätigkeit und Lernertrag', '<p>Die <b>Tätigkeit</b> beschreibt, was du getan hast. Der <b>Lernertrag</b> hält fest, was du daraus weißt oder kannst („Eine Lötstelle muss glänzen“). Der Helfer setzt Sätze mit „Gelernt“, „Erkenntnis“ oder „klar geworden“ in das Feld „Gelernt“.</p>') +
      sec('Wochenbericht', '<p>Im Reiter „Woche“ trägst du Montag bis Freitag ein. Der Helfer addiert die Dauer, zeigt Schwerpunkte und gibt dir eine Satzvorlage für die Zusammenfassung.</p>') +
      sec('Ausbildungsnachweis und dein Betrieb', '<p>Wie oft du schreibst, ob auf Papier oder digital und welche Felder dein Vordruck hat, legt dein Betrieb fest. Das ist keine Rechtsauskunft: <b>Frag deinen Ausbilder.</b></p>') +
      sec('Was nicht in den Bericht gehört', '<ul><li>Namen von Kunden, Preise und interne Daten</li><li>Zugangsdaten und Passwörter</li><li>Meinungen über Kollegen und Privates</li></ul><p>Im Zweifel weglassen und den Ausbilder fragen.</p>') +
      sec('Datenschutz', '<p>Das Lab arbeitet ohne Internet. Dein Entwurf bleibt nur in diesem Browser auf diesem Gerät. Der Name wird nie gespeichert. Über das Menü kannst du alles löschen.</p>') +
      `<p class="hint2">Unsicheres ist im Quelltext mit PRUEFEN markiert und steht in der Liste für den Ausbilder.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'helfer'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ helfer: renderHelfer, woche: renderWoche, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Berichtsheft-Helfer\n<small>' + esc(T[2]) + '</small>'; document.title = 'Berichtsheft-Helfer: ' + T[2];
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
  $('#title').onclick = () => setTab('helfer');
  $('#bMenu').onclick = () => {
    const rows = [['woche', 'Woche', 'Wochenübersicht mit Schwerpunkten'], ['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Erfundene Arbeitstage mit Auswertung'], ['help', 'Hilfe', 'Regeln und gute Stichpunkte'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Alles auf diesem Gerät löschen', 'Löscht Entwurf, gelöste Aufgaben und Trainer-Serie'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Alles löschen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Dein Entwurf, die Wochenstichpunkte, alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt', 'hf', 'wo'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.hf = { beruf: S.hf.beruf, ort: '', datum: '', text: '', gel: '' }; S.wo = { beruf: S.wo.beruf, d: ['', '', '', '', ''] }; S.name = ''; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); setTab(S.tab); toast('Alles gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.BHF_LAB = { id: 'bhf', title: 'Berichtsheft-Helfer', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.BHF_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'helfer');
  /* Aufruf ?aufgabe=bhf1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=egs1 springt zu einem Beispiel) */
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
