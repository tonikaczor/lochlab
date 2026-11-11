'use strict';
/* Tonfunk Buchführungs-Lab: Oberfläche (Lab-Kennung 'buc').
   Reiter: Editor (Buchungssatz-Editor mit T-Konten), Beispiele (?bsp), Aufgaben (?aufgabe=buc1), Trainer, Hilfe.
   Module: buccore.js (BUC_CORE, Logik), bucdata.js (BUC_DATA, BUC_TASKS).
   Speicher (Präfix lm4.buc.): tab, ed (Editor: Journal j, Anfangsbestände ab, Entwurf draft, Steuer-Helfer us), done ({id:true} nur gelöste),
   prog ({id:Prozent}), hints ({id:höchste Stufe}), ctipps ({id:Stufe} nur im Prüfmodus), exam ('1' = Prüfmodus), rt (Trainer: n, ok, streak, best).
   Tipp-Abzug (25 % je Stufe, zwei Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts. */
(function (root) {
  const C = root.BUC_CORE, D = root.BUC_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.buc.';
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Buchführungs-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">buccore.js oder bucdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const blank = () => [{ s: 'S', k: '', b: '' }, { s: 'H', k: '', b: '' }];
  const S = {
    tab: lsGet('tab', 'ed'), t: null, tv: {}, r: null, rc: { cat: '', level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {})),
    ed: { j: [], ab: [], draft: blank(), us: { w: '1000', satz: '19', art: 'netto' } }
  };
  (() => {
    const e = lsGet('ed', {}), okL = l => l && (l.s === 'S' || l.s === 'H') && typeof l.k === 'string';
    if (Array.isArray(e.j)) S.ed.j = e.j.filter(b => b && Array.isArray(b.lines) && b.lines.every(l => okL(l) && C.fin(l.b) && C.konto(l.k)));
    if (Array.isArray(e.ab)) S.ed.ab = e.ab.filter(a => a && typeof a.k === 'string').map(a => ({ k: a.k, b: String(a.b == null ? '' : a.b) }));
    if (Array.isArray(e.draft) && e.draft.length >= 2 && e.draft.length <= 6 && e.draft.every(okL)) S.ed.draft = e.draft.map(l => ({ s: l.s, k: l.k, b: String(l.b == null ? '' : l.b) }));
    if (e.us && typeof e.us === 'object') S.ed.us = Object.assign(S.ed.us, e.us);
  })();
  const saveEd = () => lsSet('ed', S.ed);

  /* ============================================================ Bausteine: Konto-Auswahl, Buchungszeilen, T-Konten */
  const opt = (nr, sel) => `<option value="${nr}"${nr === sel ? ' selected' : ''}>${esc(C.kontoLabel(nr))}</option>`;
  function kOpts(list, sel, only) {
    let h = '<option value="">Konto wählen …</option>';
    if (list) return h + list.map(nr => opt(nr, sel)).join('');
    C.GRUPPEN.forEach(g => { const ks = C.KONTEN.filter(k => k.grp === g && (!only || only(k))); if (ks.length) h += `<optgroup label="${esc(g)}">${ks.map(k => opt(k.nr, sel)).join('')}</optgroup>`; });
    return h;
  }
  const sumText = lines => {
    const s = C.sums(lines); if (!s.soll && !s.haben) return { t: 'Soll und Haben müssen am Ende gleich groß sein.', c: '' };
    return { t: 'Soll ' + C.eur(s.soll) + ' · Haben ' + C.eur(s.haben) + (s.diff === 0 ? ' · ausgeglichen ✓' : ' · Differenz ' + C.eur(Math.abs(s.diff))), c: s.diff === 0 ? 'ok' : 'bad' };
  };
  function linesHTML(lines, o) {
    o = o || {}; const dis = o.disabled ? ' disabled' : ''; let h = '<div class="bls">';
    lines.forEach((l, i) => {
      const st = (o.st && o.st[i]) || '';
      h += `<div class="bl ${st}" data-bl="${i}"><div class="seg" role="group" aria-label="Seite"><button data-bs="${i}" data-bv="S" class="${l.s === 'S' ? 'on' : ''}" aria-pressed="${l.s === 'S'}"${dis}>Soll</button><button data-bs="${i}" data-bv="H" class="${l.s === 'H' ? 'on' : ''}" aria-pressed="${l.s === 'H'}"${dis}>Haben</button></div>`
        + `<select data-bi="${i}" data-bf="k" aria-label="Konto"${dis}>${kOpts(o.konten, l.k)}</select>`
        + `<div class="amt"><input data-bi="${i}" data-bf="b" inputmode="decimal" autocomplete="off" placeholder="Betrag in €" aria-label="Betrag" value="${esc(l.b)}"${dis}><button class="x" data-bdel="${i}" aria-label="Zeile entfernen"${dis || lines.length <= 2 ? ' disabled' : ''}>✕</button>${st ? `<span class="mk ${st}">${st === 'ok' ? '✓' : '✗'}</span>` : ''}</div></div>`;
    });
    const sm = sumText(lines);
    return h + `</div><div class="bsum ${sm.c}" data-bsum>${esc(sm.t)}</div><div class="btns" style="margin-top:6px"><button class="btn" data-badd="1"${dis || lines.length >= 6 ? ' disabled' : ''}>+ Zeile</button></div>`;
  }
  /* Ereignisse der Buchungszeilen (Seite, Konto, Betrag, Zeile hinzufügen/entfernen) für einen Container */
  function lineEvents(V, getLines, rerender, changed) {
    const upd = (t, L) => { const s = $('[data-bsum]', V); if (s) { const sm = sumText(L); s.textContent = sm.t; s.className = 'bsum ' + sm.c; } };
    const onIn = e => { const t = e.target; if (t.dataset.bi == null || !t.dataset.bf) return; const L = getLines(); if (!L || !L[+t.dataset.bi]) return; L[+t.dataset.bi][t.dataset.bf] = t.value; upd(t, L); if (changed) changed(); };
    V.addEventListener('input', onIn); V.addEventListener('change', onIn);
    V.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return; const L = getLines(); if (!L) return;
      if (b.dataset.bs != null) { L[+b.dataset.bs].s = b.dataset.bv; if (changed) changed(); rerender(); }
      else if (b.dataset.badd) { if (L.length < 6) L.push({ s: 'S', k: '', b: '' }); if (changed) changed(); rerender(); }
      else if (b.dataset.bdel != null) { if (L.length > 2) L.splice(+b.dataset.bdel, 1); if (changed) changed(); rerender(); }
    });
  }
  /* Buchungssatz als Text im Format "Soll an Haben" */
  function bsHTML(lines) {
    const part = s => lines.filter(l => l.s === s).map(l => `<div>${esc(C.kontoLabel(l.k))} <b>${esc(C.eur(l.b))}</b></div>`).join('');
    return `${part('S')}<div class="a" style="margin:2px 0 2px 8px">an</div>${part('H')}`;
  }
  function tkHTML(t, o) {
    o = o || {}; const s = t.s.slice(), h = t.h.slice(), f = v => C.fmtDe(v, 2);
    if (!o.nosaldo && t.saldo) (t.saldo.side === 's' ? s : h).push({ g: 'Saldo', b: t.saldo.b, sal: 1 });
    const n = Math.max(s.length, h.length), cell = (x, l) => x ? `<td class="g${l ? ' l' : ''}${x.sal ? ' sal' : ''}">${esc(x.g)}</td><td class="b${x.sal ? ' sal' : ''}">${f(x.b)}</td>` : `<td class="g${l ? ' l' : ''}"></td><td class="b"></td>`;
    let r = '<tr class="sh"><td colspan="2">Soll</td><td colspan="2" class="l">Haben</td></tr>';
    for (let i = 0; i < n; i++) r += `<tr>${cell(s[i])}${cell(h[i], 1)}</tr>`;
    if (!n) r += '<tr><td colspan="4" style="color:var(--mute)">noch keine Buchung</td></tr>';
    if (!o.nosaldo && n) r += `<tr class="su"><td></td><td class="b">${f(t.sum)}</td><td class="l"></td><td class="b">${f(t.sum)}</td></tr>`;
    const foot = !o.nosaldo && t.bal ? `<div class="tkf">Saldo: <b>${C.eur(Math.abs(t.bal))}</b> ${t.bal > 0 ? 'im Soll' : 'im Haben'}</div>` : '';
    return `<div class="tk"><div class="tkh">${esc(C.kontoLabel(t.nr))}</div><table>${r}</table>${foot}</div>`;
  }
  const tksHTML = (list, o) => list.length ? `<div class="tks">${list.map(t => tkHTML(t, o)).join('')}</div>` : '';
  const tksOf = (buchungen, ab) => { const r = C.tkonten(buchungen, ab); return r.order.sort().map(nr => r.m[nr]); };

  /* ============================================================ Schema-Tabelle (für Rechenwege) */
  function schemaTable(rows, o) {
    o = o || {}; const fill = o.fill || null, ans = o.ans || {};
    let h = '<table class="sch"><tbody>';
    rows.forEach(r => {
      if (r.head) { h += `<tr class="hd"><td colspan="4">${esc(r.head)}</td></tr>`; return; }
      const isIn = !!fill && fill.includes(r.k), st = isIn && o.res ? o.res[r.k] : '';
      const cls = [r.sum ? 'sum' : '', o.hi === r.k ? 'hi' : '', st || '', fill && !isIn ? 'gv' : ''].filter(Boolean).join(' ');
      const calc = o.calc && r.calc ? `<small>${esc(r.calc)} = ${esc(C.fmtRow(r))}</small>` : '';
      let cell;
      if (isIn) cell = `<input data-k="${esc(r.k)}" inputmode="decimal" autocomplete="off" aria-label="${esc(r.label)}" placeholder="${esc(r.u || '')}" value="${esc(ans[r.k] || '')}"${o.disabled ? ' disabled' : ''}>${st ? `<span class="mk ${st}">${st === 'ok' ? '✓' : '✗'}</span>` : ''}`;
      else cell = esc(C.fmtRow(r));
      h += `<tr class="${cls}"><td class="op">${esc(r.op || '')}</td><td>${esc(r.label)}${r.bas && !isIn ? `<small>${esc(r.bas)}</small>` : ''}${calc}</td><td class="pc">${r.pct != null ? esc(C.fmtP(r.pct)) + ' %' : ''}</td><td class="v">${cell}</td></tr>`;
    });
    return h + '</tbody></table>';
  }

  /* ============================================================ Editor */
  const abMap = () => { const m = {}; S.ed.ab.forEach(a => { const x = C.parseDe(a.b); if (a.k && C.konto(a.k) && C.fin(x) && x > 0 && C.normalSide(a.k)) m[a.k] = (m[a.k] || 0) + x; }); return m; };
  function usOut() {
    const u = S.ed.us, w = C.parseDe(u.w), s = +u.satz; if (!C.fin(w) || w < 0) return '<div class="rdout warn">Gib einen Betrag ein.</div>';
    if (u.art === 'netto') { const x = C.ustVon(w, s); return `<div class="rdout">Umsatzsteuer bzw. Vorsteuer: <b>${C.eur(x)}</b><br>Bruttobetrag: <b>${C.eur(C.rd2(w + x))}</b></div>`; }
    const n = C.nettoAus(w, s); return `<div class="rdout">Nettobetrag: <b>${C.eur(n)}</b> (Bruttobetrag × 100 : ${100 + s})<br>Umsatzsteuer bzw. Vorsteuer: <b>${C.eur(C.rd2(w - n))}</b></div>`;
  }
  function renderEd() {
    const ed = S.ed; let h = '';
    h += '<div class="card pl"><h4>Buchungssatz-Editor <span class="fest">Kontenliste: Übungsfestlegung</span></h4><p class="hint2" style="margin:0">Baue Buchungssätze aus Soll-Konten, Haben-Konten und Beträgen zusammen. Mit „Buchen“ kommen sie ins Journal, die T-Konten darunter rechnen die Salden aus. Die Kontenliste ist eine kleine Übungsliste nach IKR (siehe Hilfe), kein vollständiger Kontenrahmen.</p></div>';
    h += `<div class="card pl"><h4>Neuer Buchungssatz</h4>${linesHTML(ed.draft)}<div class="btns"><button class="btn pri" data-ea="book">Buchen</button><button class="btn" data-ea="clear">Zeilen leeren</button></div></div>`;
    h += `<div class="card pl"><h4>Journal (${ed.j.length})</h4>`;
    if (!ed.j.length) h += '<p class="hint2" style="margin:0">Noch keine Buchungssätze. Lade im Reiter Beispiele einen fertigen Fall oder buche selbst.</p>';
    else { ed.j.forEach((b, i) => { h += `<div class="jr"><span class="n">${i + 1}.</span><div class="tx">${bsHTML(b.lines)}</div><button class="x" data-ea="del" data-i="${i}" aria-label="Buchungssatz ${i + 1} löschen">✕</button></div>`; }); h += '<div class="btns"><button class="btn danger" data-ea="clearj">Journal leeren</button></div>'; }
    h += '</div>';
    h += `<div class="card pl"><details${ed.ab.length ? ' open' : ''}><summary style="min-height:44px;display:flex;align-items:center;cursor:pointer;font-weight:600">Anfangsbestände und Vorsalden (optional)</summary><p class="hint2">Ein Anfangsbestand steht auf der normalen Seite des Kontos (Aktivkonto im Soll, Passivkonto im Haben). Bei Aufwands- und Ertragskonten ist es der bisherige Saldo des Jahres, etwa vor einem Abschluss.</p>`;
    ed.ab.forEach((a, i) => { h += `<div class="bl" style="grid-template-columns:1fr auto;margin-bottom:6px"><select data-abk="${i}" aria-label="Konto">${kOpts(null, a.k, k => k.typ !== 'Ab')}</select><button class="x" data-ea="abdel" data-i="${i}" aria-label="Anfangsbestand entfernen" style="width:44px;height:44px;border:1px solid var(--line);border-radius:10px;color:var(--mute)">✕</button><input data-abb="${i}" inputmode="decimal" autocomplete="off" placeholder="Betrag in €" aria-label="Anfangsbestand" value="${esc(a.b)}" style="grid-column:1/-1;text-align:right"></div>`; });
    h += '<div class="btns"><button class="btn" data-ea="abadd">+ Anfangsbestand</button></div></details></div>';
    h += `<div class="card pl"><h4>T-Konten mit Saldo</h4><div id="edTk">${edTk()}</div></div>`;
    h += `<div class="card pl"><h4>Umsatzsteuer-Helfer</h4><div class="fld"><label class="f"><span>Betrag</span><div class="qin"><input data-us="w" inputmode="decimal" autocomplete="off" value="${esc(ed.us.w)}"><span class="u">€</span></div></label></div>`
      + `<div class="ctl"><div class="seg">${[['netto', 'ist netto'], ['brutto', 'ist brutto']].map(o => `<button data-usb="art" data-val="${o[0]}" class="${ed.us.art === o[0] ? 'on' : ''}">${o[1]}</button>`).join('')}</div><div class="seg">${[['19', '19 %'], ['7', '7 %']].map(o => `<button data-usb="satz" data-val="${o[0]}" class="${ed.us.satz === o[0] ? 'on' : ''}">${o[1]}</button>`).join('')}</div></div><div id="usOut">${usOut()}</div></div>`;
    $('#edView').innerHTML = h;
  }
  function edTk() {
    const list = tksOf(S.ed.j, abMap());
    return list.length ? tksHTML(list) + '<p class="hint2">Die Zahl in der Spalte „Gegenkonto“ ist die Kontonummer des Gegenkontos, „div.“ steht bei mehreren Gegenkonten, „AB“ für den Anfangsbestand, „Jahr“ für den Vorsaldo eines Erfolgskontos.</p>' : '<p class="hint2" style="margin:0">Sobald du etwas buchst oder einen Anfangsbestand einträgst, erscheinen hier die T-Konten.</p>';
  }
  function bookDraft() {
    const ls = S.ed.draft.filter(l => l.k || String(l.b).trim() !== '');
    const lines = ls.map(l => ({ s: l.s, k: l.k, b: C.parseDe(l.b) }));
    if (lines.length < 2) { toast('Ein Buchungssatz braucht mindestens zwei Zeilen.'); return; }
    if (lines.some(l => !l.k)) { toast('Wähle in jeder Zeile ein Konto.'); return; }
    if (lines.some(l => !C.fin(l.b) || l.b <= 0)) { toast('Trage in jeder Zeile einen Betrag größer 0 ein (mit Komma).'); return; }
    if (!lines.some(l => l.s === 'S') || !lines.some(l => l.s === 'H')) { toast('Es braucht mindestens eine Soll- und eine Haben-Zeile.'); return; }
    const sm = C.sums(lines); if (sm.diff !== 0) { toast('Soll (' + C.eur(sm.soll) + ') und Haben (' + C.eur(sm.haben) + ') sind nicht gleich: Differenz ' + C.eur(Math.abs(sm.diff)) + '.'); return; }
    S.ed.j.push({ lines: lines.map(l => ({ s: l.s, k: l.k, b: C.rd2(l.b) })) }); S.ed.draft = blank(); saveEd(); renderEd(); toast('Gebucht (Buchungssatz ' + S.ed.j.length + ').');
  }
  lineEvents($('#edView'), () => S.ed.draft, renderEd, saveEd);
  $('#edView').addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.us) { S.ed.us[t.dataset.us] = t.value; saveEd(); $('#usOut').innerHTML = usOut(); }
    else if (t.dataset.abb != null) { S.ed.ab[+t.dataset.abb].b = t.value; saveEd(); $('#edTk').innerHTML = edTk(); }
  });
  $('#edView').addEventListener('change', e => { const t = e.target; if (t.dataset.abk != null) { S.ed.ab[+t.dataset.abk].k = t.value; saveEd(); $('#edTk').innerHTML = edTk(); } });
  $('#edView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return; const a = b.dataset.ea, i = +b.dataset.i;
    if (b.dataset.usb) { S.ed.us[b.dataset.usb] = b.dataset.val; saveEd(); renderEd(); return; }
    if (!a) return;
    if (a === 'book') bookDraft();
    else if (a === 'clear') { S.ed.draft = blank(); saveEd(); renderEd(); }
    else if (a === 'del') { S.ed.j.splice(i, 1); saveEd(); renderEd(); }
    else if (a === 'clearj') { S.ed.j = []; saveEd(); renderEd(); toast('Journal geleert.'); }
    else if (a === 'abadd') { S.ed.ab.push({ k: '', b: '' }); saveEd(); renderEd(); }
    else if (a === 'abdel') { S.ed.ab.splice(i, 1); saveEd(); renderEd(); }
  });

  /* ============================================================ Beispiele */
  const exTk = e => tksOf(e.buchungen, e.ab);
  function renderBsp() {
    let h = '<div class="card pl"><h4>Fertige Beispiele</h4><p class="hint2" style="margin:0">Jedes Beispiel ist komplett durchgebucht: Buchungssätze und T-Konten mit Saldo. Mit „In den Editor laden“ kannst du die Fälle ändern und selbst probieren. Beträge sind Übungswerte.</p></div>';
    D.examples.forEach((e, i) => {
      h += `<div class="card pl"><h4>Beispiel ${i + 1}</h4><div class="big">${esc(e.title)}</div><p style="margin:6px 0">${esc(e.text)}</p>`;
      h += `<details${i === 0 ? ' open' : ''}><summary style="min-height:44px;display:flex;align-items:center;cursor:pointer;font-weight:600">Buchungssätze und T-Konten anzeigen</summary>`;
      e.buchungen.forEach((b, j) => { h += `<div style="font-size:12.5px;color:var(--mute);margin-top:8px">${j + 1}. ${esc(b.t)}</div><div class="bsatz">${bsHTML(b.lines)}</div>`; });
      h += tksHTML(exTk(e)) + '</details>';
      h += `<p class="hint2">${esc(e.note)}</p><div class="btns"><button class="btn pri" data-ex="${esc(e.id)}">In den Editor laden</button></div></div>`;
    });
    $('#bspView').innerHTML = h;
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const ex = D.examples.find(x => x.id === b.dataset.ex); if (!ex) return;
    S.ed.j = ex.buchungen.map(x => ({ lines: x.lines.map(l => ({ s: l.s, k: l.k, b: l.b })) }));
    S.ed.ab = Object.keys(ex.ab).map(k => ({ k, b: C.fmtDe(ex.ab[k], 2) })); S.ed.draft = blank(); saveEd(); setTab('ed'); toast('Beispiel geladen: ' + ex.title);
  });

  /* ============================================================ Aufgaben (gemeinsam für Aufgaben und Trainer) */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  function pctFor(id) { if (!exam()) return 100; const st = lsGet('ctipps', {})[id] || 0; return Math.max(0, 100 - 25 * st); }   /* zwei Stufen: 75 % bzw. 50 % */
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    if (pct > 0) { const d = done(); d[id] = true; lsSet('done', d); }
    updateBadge(); updatePal();
  }
  const nDone = () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length;
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = nDone() + '/' + TASKS.length; }
  const initAns = q => q.buch ? { lines: blank() } : q.zu ? { z: {} } : {};
  const ruleText = q => q.buch ? 'Jede Zeile besteht aus Seite, Konto und Betrag. Die Reihenfolge der Zeilen ist egal. Beträge werden auf Cent genau erwartet (±0,01 € wird akzeptiert).'
    : q.zu ? 'Wähle für jeden Posten die passende Seite.'
    : q.ask ? 'Rundung: jeder Betrag kaufmännisch auf Cent. Erlaubt ist ' + (q.ask.unit === '%' ? '±0,1 %-Punkt' : q.ask.unit === '€' ? '±0,01 €' : '±0,01') + ' Abweichung.'
    : 'Rundung: jeder Betrag kaufmännisch auf Cent. Je Zeile ist ±0,01 € erlaubt. Die Zeilen werden einzeln geprüft.';
  function evalQ(q, ans) {
    if (q.ask) { const c = C.checkNum(ans.v, q.ask.value, q.ask.tol); if (c.empty) return { empty: true }; if (c.nan) return { nan: true }; return { ok: c.ok, x: c.x }; }
    if (q.buch) { const r = C.checkBuchung(ans.lines || [], q.buch.sol, q.buch.alts); if (r.empty) return { empty: true }; return { ok: r.ok, buch: r, right: r.hit, total: r.total, filled: r.hit + r.extra }; }
    if (q.zu) { const st = {}; let right = 0, filled = 0; q.zu.items.forEach((it, i) => { const a = (ans.z || {})[i]; if (!a) return; filled++; st[i] = a === it.a ? 'ok' : 'bad'; if (a === it.a) right++; }); return { ok: right === q.zu.items.length, zst: st, filled, right, total: q.zu.items.length, empty: filled === 0 }; }
    const rows = {}; let ok = true, filled = 0, right = 0, nan = false;
    q.fill.forEach(k => { const row = q.rows.find(r => r.k === k), c = C.checkNum(ans[k], row.v, C.tolOf(row.u)); if (c.empty) { ok = false; return; } filled++; if (c.nan) { nan = true; ok = false; rows[k] = 'bad'; return; } rows[k] = c.ok ? 'ok' : 'bad'; if (c.ok) right++; else ok = false; });
    return { ok, rows, filled, right, total: q.fill.length, nan, empty: filled === 0 };
  }
  function zuHTML(q, ans, r, locked) {
    return q.zu.items.map((it, i) => {
      const st = r && r.zst && r.zst[i] || '', cur = (ans.z || {})[i];
      return `<div class="zi ${st}"><span class="t">${esc(it.t)}${st ? ` <span class="mk ${st}">${st === 'ok' ? '✓' : '✗'}</span>` : ''}</span><div class="seg">${q.zu.opts.map(o => `<button data-zi="${i}" data-zv="${esc(o[0])}" class="${cur === o[0] ? 'on' : ''}" aria-pressed="${cur === o[0]}"${locked ? ' disabled' : ''}>${esc(o[1])}</button>`).join('')}</div></div>`;
    }).join('');
  }
  function solHTML(q) {
    if (q.buch) return `<b>Lösungsweg: Buchungssatz</b><div class="bsatz">${bsHTML(q.buch.sol)}</div>${tksHTML(tksOf([{ lines: q.buch.sol }]), { nosaldo: true })}<p style="margin:6px 0 0">${esc(q.expl)}</p>`;
    if (q.zu) return `<b>Lösung</b>${q.zu.items.map(it => `<div style="padding:3px 0">${esc(it.t)}: <b>${esc(q.zu.opts.find(o => o[0] === it.a)[1])}</b></div>`).join('')}<p style="margin:6px 0 0">${esc(q.expl)}</p>`;
    return `<b>Lösungsweg mit Schema</b>${schemaTable(q.rows, { calc: true, hi: q.ask && q.ask.key })}${q.tkd ? tksHTML(q.tkd) : ''}<p style="margin:6px 0 0">${esc(q.expl)}</p>`;
  }
  function exHTML(ctx, pre, tipBtn) {
    const q = ctx.q, r = ctx.res, locked = !!(r && r.ok); let h = `<p style="margin:8px 0">${esc(q.text)}</p>`;
    if (q.tkd) h += tksHTML(q.tkd, { nosaldo: true });
    if (q.fill) h += schemaTable(q.rows, { fill: q.fill, ans: ctx.ans, res: r && r.rows, disabled: locked });
    else if (q.ask) h += `<label class="f"><span>${esc(q.ask.label)} (${esc(q.ask.unit || 'Zahl')})</span><div class="qin"><input data-v id="${pre}In" inputmode="decimal" autocomplete="off" value="${esc(ctx.ans.v || '')}"${locked ? ' disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div></label>`;
    else if (q.buch) h += linesHTML(ctx.ans.lines, { konten: q.buch.konten, st: r && r.buch && r.buch.st, disabled: locked });
    else if (q.zu) h += zuHTML(q, ctx.ans, r, locked);
    h += `<p class="hint2">${esc(ruleText(q))}</p>`;
    h += `<div class="btns"><button class="btn pri" data-a="chk"${locked ? ' disabled' : ''}>✓ Prüfen</button>${tipBtn}</div>`;
    if (r && !r.empty) {
      const lines = [];
      if (r.shown) lines.push({ ok: false, text: 'Lösung angezeigt (zählt als Fehler).' });
      else if (q.ask) lines.push({ ok: r.ok, text: r.ok ? 'Richtig: ' + C.fmtDe(r.x, 2) + ' ' + q.ask.unit : 'Deine Antwort „' + C.fmtDe(r.x, 2) + ' ' + q.ask.unit + '“ stimmt nicht.' });
      else if (q.buch) {
        lines.push({ ok: r.ok, text: r.ok ? 'Richtig gebucht.' : r.right + ' von ' + r.total + ' Buchungszeilen richtig' + (r.buch.extra > 0 ? ', ' + r.buch.extra + ' Zeile(n) falsch oder zu viel' : '') + (r.total > r.right + 0 && r.buch.extra === 0 ? ', es fehlt noch etwas' : '') + '.' });
        if (!r.ok && r.buch.bal.diff !== 0) lines.push({ ok: false, text: 'Soll und Haben sind nicht gleich groß (Differenz ' + C.eur(Math.abs(r.buch.bal.diff)) + '). Ein Buchungssatz geht immer auf.' });
      }
      else if (q.zu) lines.push({ ok: r.ok, text: r.ok ? 'Alle ' + r.total + ' Posten stimmen.' : r.right + ' von ' + r.total + ' Posten richtig' + (r.filled < r.total ? ', ' + (r.total - r.filled) + ' noch ohne Auswahl.' : '.') });
      else lines.push({ ok: r.ok, text: r.ok ? 'Alle ' + r.total + ' Zeilen stimmen.' : r.right + ' von ' + r.total + ' Zeilen richtig' + (r.filled < r.total ? ', ' + (r.total - r.filled) + ' noch leer.' : '.') });
      h += `<ul class="tl">${lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}</li>`).join('')}</ul>`;
      if (r.ok || r.shown || !exam() || pre === 'rt') h += `<div class="rdout ${r.ok ? 'ok' : 'bad'}">${solHTML(q)}</div>`;
      else h += '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>';
    }
    return h;
  }
  function tipSheet(q, n) {
    const fr = q.rows && (q.ask ? q.rows.find(x => x.k === q.ask.key) : q.fill ? q.rows.filter(x => q.fill.includes(x.k)).find(x => x.calc) : null);
    sheet('Tipp, Stufe ' + n + ' von 2', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(q.tips[0])}</p>`;
      if (n >= 2) x += `<p><b>Stufe 2:</b> ${q.tips[1] ? esc(q.tips[1]) : fr && fr.calc ? 'Rechenansatz für „' + esc(fr.label) + '“: <b>' + esc(fr.calc) + '</b>. Rechne damit weiter, Schritt für Schritt.' : 'Zerlege die Aufgabe in kleine Schritte und prüfe jeden einzeln.'}</p>`; else x += '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“ für Stufe 2.</p>';
      x += exam() ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  function wire(V, get, A, re) {
    V.addEventListener('input', e => { const c = get(); if (!c) return; if (e.target.dataset.k) c.ans[e.target.dataset.k] = e.target.value; else if (e.target.dataset.v !== undefined) c.ans.v = e.target.value; });
    V.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input[data-k],input[data-v],input[data-bf]')) { e.preventDefault(); const c = get(); if (c && !(c.res && c.res.ok)) A.chk(); } });
    V.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (b && A[b.dataset.a]) { A[b.dataset.a](); return; }
      const z = e.target.closest('[data-zi]'); if (z && !z.disabled) { const c = get(); if (c && c.ans.z) { c.ans.z[+z.dataset.zi] = z.dataset.zv; re(); } return; }
      if (A.other) A.other(e);
    });
    lineEvents(V, () => { const c = get(); return c && c.ans.lines; }, re);
  }

  /* ---- Aufgabenliste ---- */
  function startTask(id, variant) {
    const t = TASKS.find(x => x.id === id); if (!t) return;
    S.tv[id] = variant || 0;
    const q = t.make(C.rng(id + '#' + S.tv[id]), C);
    S.t = { id, q, ans: initAns(q), res: null };
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  function checkTask() {
    const ctx = S.t; if (!ctx) return; const r = evalQ(ctx.q, ctx.ans);
    if (r.empty) { toast(ctx.q.buch ? 'Wähle zuerst Konten und trage Beträge ein.' : ctx.q.zu ? 'Wähle zuerst für mindestens einen Posten eine Seite.' : 'Trage zuerst ein Ergebnis ein.'); return; }
    if (r.nan && ctx.q.ask) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return; }
    ctx.res = r; const pct = r.ok ? pctFor(ctx.id) : 0;
    if (r.ok) { markSolved(ctx.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (e) { ding(); } else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); }
    else { sad(); toast(r.filled != null && r.right > 0 ? 'Fast: ' + r.right + ' von ' + r.total + ' stimmen.' : 'Noch nicht richtig. Lies den Tipp und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintTask() {
    const ctx = S.t; if (!ctx) return; const id = ctx.id, h = lsGet('hints', {}), n = Math.min(2, (h[id] || 0) + 1);
    h[id] = Math.max(h[id] || 0, n); lsSet('hints', h);
    if (exam()) { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    tipSheet(ctx.q, n);
  }
  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), ctx = S.t, t = ctx && TASKS.find(x => x.id === ctx.id); let h = '';
    if (t) {
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>`;
      h += exHTML(ctx, 'tk', '<button class="btn" data-a="hint">💡 Tipp</button>');
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      h += `<div class="btns"><button class="btn" data-a="neu">🎲 Neue Zahlen</button>${ctx.res && ctx.res.ok ? '<button class="btn pri" data-a="next">Nächste Aufgabe</button>' : ''}<button class="btn" data-a="close">Schließen</button></div></div>`;
    }
    h += `<p class="hint2" style="margin:4px 0 0">${nDone()} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : p > 0 ? 'p' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && !d[x.id] ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  wire($('#taskView'), () => S.t, {
    chk: checkTask, hint: hintTask,
    neu: () => { if (S.t) startTask(S.t.id, (S.tv[S.t.id] || 0) + 1); },
    close: () => { S.t = null; renderTasks(); },
    next: () => { const i = TASKS.findIndex(x => x.id === S.t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); },
    other: e => { const row = e.target.closest('.row[data-t]'); if (row) startTask(row.dataset.t); }
  }, () => renderTasks(false));

  /* ---- Zufalls-Trainer ---- */
  function newTrainer() {
    const pool = TASKS.filter(t => (!S.rc.cat || t.cat === S.rc.cat) && (!S.rc.level || t.level === S.rc.level)), t = pool[Math.floor(Math.random() * pool.length)] || TASKS[0];
    const q = t.make(C.rng(t.id + '~' + Math.random() + Date.now()), C);
    S.r = { id: t.id, t, q, ans: initAns(q), res: null }; renderTrainer();
  }
  function trainerResult(r, shown) {
    const ctx = S.r, st = S.rt; ctx.res = Object.assign({}, r, { shown }); st.n++;
    if (r.ok && !shown) { st.ok++; st.streak++; st.best = Math.max(st.best, st.streak); ding(); } else { st.streak = 0; sad(); }
    lsSet('rt', st); renderTrainer(); updatePal();
    if (r.ok && !shown && st.streak % 5 === 0) { toast('🔥 ' + st.streak + ' richtige in Folge!'); const F = fx(); if (F && F.pass) try { F.pass(100); } catch (e) {} }
  }
  function renderTrainer() {
    if (!S.r) { newTrainer(); return; }
    const ctx = S.r, st = S.rt, seg = (a, items, cur) => `<div class="seg">${items.map(i => `<button data-${a}="${esc(i[0])}" class="${String(cur) === String(i[0]) ? 'on' : ''}">${esc(i[1])}</button>`).join('')}</div>`;
    let h = `<div class="card pl"><h4>Zufalls-Trainer: unendlich viele Aufgaben</h4><div class="fbar">${seg('rc', [['', 'Alle']].concat(D.CATS.map(c => [c, c])), S.rc.cat)}</div><div class="fbar">${seg('rl', [[0, 'Alle Stufen'], [1, 'leicht'], [2, 'mittel'], [3, 'schwer']], S.rc.level)}</div>`;
    h += `<div class="stats"><div class="bx"><b>${st.streak}</b>Serie</div><div class="bx"><b>${st.best}</b>Beste Serie</div><div class="bx"><b>${st.ok}/${st.n}</b>Richtig</div></div>`;
    h += `<div class="big" style="font-size:17px">${esc(ctx.t.title)} <span class="lv">${dots(ctx.t.level)}</span></div>`;
    h += exHTML(ctx, 'rt', '<button class="btn" data-a="hint">💡 Tipp</button>');
    h += ctx.res ? `<div class="btns"><button class="btn pri" data-a="next">Nächste Aufgabe</button></div>` : '<div class="btns"><button class="btn" data-a="show">Lösung zeigen (Serie beginnt neu)</button></div>';
    if (ctx.res && !ctx.res.ok && !ctx.res.shown) h += '<p class="hint2">Falsch beantwortet: Die Serie beginnt neu.</p>';
    $('#rtView').innerHTML = h + '</div>';
  }
  wire($('#rtView'), () => S.r, {
    chk: () => { const ctx = S.r, r = evalQ(ctx.q, ctx.ans); if (r.empty) { toast('Trage zuerst eine Antwort ein.'); return; } if (r.nan && ctx.q.ask) { toast('Bitte gib eine Zahl ein.'); return; } trainerResult(r, false); },
    hint: () => { const c = S.r; c.tipn = Math.min(2, (c.tipn || 0) + 1); tipSheet(c.q, c.tipn); },
    show: () => { const ctx = S.r, r = evalQ(ctx.q, ctx.ans); trainerResult(Object.assign({}, r, { ok: false, empty: false }), true); },
    next: newTrainer,
    other: e => { const c = e.target.closest('[data-rc]'), l = e.target.closest('[data-rl]'); if (c) { S.rc.cat = c.dataset.rc; newTrainer(); } else if (l) { S.rc.level = +l.dataset.rl; newTrainer(); } }
  }, renderTrainer);

  /* ============================================================ Hilfe */
  function renderHelp() {
    const ex = id => D.examples.find(e => e.id === id), bsb = id => ex(id).buchungen.map(b => `<div style="font-size:12.5px;color:var(--mute);margin-top:6px">${esc(b.t)}</div><div class="bsatz">${bsHTML(b.lines)}</div>`).join('');
    const kt = C.GRUPPEN.map(g => `<tr><th colspan="2">${esc(g)}</th></tr>` + C.KONTEN.filter(k => k.grp === g).map(k => `<tr><td><b>${k.nr}</b></td><td>${esc(k.name)}</td></tr>`).join('')).join('');
    $('#helpView').innerHTML = `
    <details open><summary>🧾 Inventur, Bilanz, Eigenkapital</summary><div class="hb2">
      <p>Bei der <b>Inventur</b> wird alles gezählt und bewertet. Das <b>Inventar</b> listet Vermögen und Schulden auf, die <b>Bilanz</b> stellt sie in Kontenform gegenüber.</p>
      <table class="h"><tr><th>Aktiva (Vermögen)</th><th>Passiva (Kapital)</th></tr><tr><td>Anlagevermögen: Maschinen, Fuhrpark, Gebäude<br>Umlaufvermögen: Vorräte, Forderungen, Bank, Kasse</td><td>Eigenkapital<br>Fremdkapital: Darlehen, Verbindlichkeiten</td></tr></table>
      <span class="eq">Eigenkapital = Vermögen − Schulden</span><span class="eq">Summe Aktiva = Summe Passiva</span><span class="eq">Gewinn = Eigenkapital Ende − Eigenkapital Anfang + Entnahmen − Einlagen</span></div></details>
    <details><summary>✍️ Buchungssatz und T-Konto</summary><div class="hb2">
      <p>Jedes Konto hat zwei Seiten: <b>Soll</b> (links) und <b>Haben</b> (rechts). Ein Buchungssatz nennt Soll-Konten und Haben-Konten und liest sich „Soll <b>an</b> Haben“. Die Summe im Soll ist immer gleich der Summe im Haben.</p>
      <table class="h"><tr><th>Kontoart</th><th>Zunahme</th><th>Abnahme</th></tr><tr><td>Aktivkonto (z. B. Bank, Maschinen)</td><td>Soll</td><td>Haben</td></tr><tr><td>Passivkonto (z. B. Verbindlichkeiten, Eigenkapital)</td><td>Haben</td><td>Soll</td></tr><tr><td>Aufwandskonto</td><td>Soll</td><td>Haben</td></tr><tr><td>Ertragskonto</td><td>Haben</td><td>Soll</td></tr></table>
      <p>Der <b>Saldo</b> ist der Unterschied der beiden Seiten. Er wird auf der kleineren Seite eingetragen, damit beide Seiten gleich groß sind.</p>
      ${bsb('b1')}${tksHTML(exTk(ex('b1')))}<p>Schritte: 1. Welche Konten sind betroffen? 2. Aktiv, passiv, Aufwand oder Ertrag? 3. Nimmt das Konto zu oder ab? 4. Seite wählen, Beträge eintragen, Soll = Haben prüfen.</p></div></details>
    <details><summary>💶 Umsatzsteuer</summary><div class="hb2">
      <p>Die Umsatzsteuer ist für Unternehmen ein durchlaufender Posten. Beim Einkauf ist sie <b>Vorsteuer</b> (Konto 2600, Forderung an das Finanzamt), beim Verkauf <b>Umsatzsteuer</b> (Konto 4800, Schuld). Steuersätze: 19 % (Regelsatz) und 7 % (ermäßigt).</p>
      <span class="eq">Umsatzsteuer = Nettobetrag × Steuersatz : 100</span><span class="eq">Bruttobetrag = Nettobetrag × (100 + Satz) : 100</span><span class="eq">Nettobetrag = Bruttobetrag × 100 : (100 + Satz)</span><span class="eq">Zahllast = Umsatzsteuer − Vorsteuer</span>
      ${bsb('b2')}${bsb('b3')}<p>Ist am Monatsende die Umsatzsteuer größer als die Vorsteuer, wird die Differenz als <b>Zahllast</b> an das Finanzamt abgeführt. Ist die Vorsteuer größer, gibt es einen Erstattungsanspruch.</p>${bsb('b4')}</div></details>
    <details><summary>🛒 Warenkonten: Einkauf, Fracht, Rücksendung, Skonto</summary><div class="hb2">
      <p>In diesem Lab wird nach dem <b>Aufwandsverfahren</b> gebucht: Der Einkauf geht sofort auf das Aufwandskonto (z. B. 6000 Aufwendungen für Rohstoffe), Bezugskosten auf 6001, Nachlässe (Rücksendungen, Skonti) auf 6002.</p>
      <p><b>Skonto</b> ist ein Preisnachlass für schnelle Zahlung. Weil der Preis sinkt, sinkt auch die Umsatzsteuer: Der Skontobetrag enthält Umsatzsteuer, die berichtigt wird.</p>
      ${bsb('b6')}<p class="hint2">Hinweis für Ausbilder: Der Betrieb kann Rücksendungen und Skonti auf anderen Konten führen (z. B. direkt auf dem Einkaufskonto oder auf eigenen Skontokonten).</p></div></details>
    <details><summary>📉 Abschreibung (linear)</summary><div class="hb2">
      <p>Anlagegüter verlieren durch die Nutzung an Wert. Die Anschaffungskosten werden auf die Nutzungsdauer verteilt.</p>
      <span class="eq">Jährliche AfA = (Anschaffungskosten − Restwert) : Nutzungsdauer</span><span class="eq">Restbuchwert = Anschaffungskosten − Summe der bisherigen AfA</span><span class="eq">AfA im Anschaffungsjahr = Jahres-AfA : 12 × Monate (Anschaffungsmonat zählt voll)</span>
      ${bsb('b5')}${tksHTML(exTk(ex('b5')))}</div></details>
    <details><summary>👥 Personalkosten (einfach)</summary><div class="hb2">
      <p>Der Betrieb zahlt nicht das Bruttogehalt aus: Lohnsteuer und der Arbeitnehmeranteil zur Sozialversicherung werden einbehalten und später abgeführt. Zusätzlich trägt der Arbeitgeber einen eigenen Anteil zur Sozialversicherung.</p>
      <span class="eq">Auszahlung = Brutto − Lohnsteuer − Arbeitnehmeranteil Sozialversicherung</span><span class="eq">Personalkosten = Brutto + Arbeitgeberanteil</span>
      <p class="hint2">Alle Sätze und Beträge in diesem Lab sind frei gewählte Übungswerte (hier 20 % Sozialversicherung je Seite), keine amtlichen Sätze.</p>${bsb('b7')}</div></details>
    <details><summary>🏁 Abschluss: GuV und Schlussbilanz</summary><div class="hb2">
      <p>Am Jahresende werden Erfolgskonten über das <b>Gewinn- und Verlustkonto (GuV)</b> abgeschlossen: Aufwände im Haben des Aufwandskontos gegen GuV (Soll), Erträge im Soll gegen GuV (Haben). Der Saldo der GuV ist der Gewinn oder Verlust und wird in das Eigenkapital gebucht. Bestandskonten werden über das <b>Schlussbilanzkonto</b> abgeschlossen.</p>
      <span class="eq">Gewinn: GuV an Eigenkapital</span><span class="eq">Verlust: Eigenkapital an GuV</span><span class="eq">Aktivkonto: Schlussbilanzkonto an Konto</span><span class="eq">Passivkonto: Konto an Schlussbilanzkonto</span>${bsb('b8')}</div></details>
    <details><summary>📋 Kontenübungsliste <span class="fest">Festlegung</span></summary><div class="hb2">
      <p>Diese Liste ist eine kleine <b>Übungsliste in Anlehnung an den Industriekontenrahmen (IKR)</b> mit vierstelligen Nummern. Sie ist eine Festlegung für dieses Lab und nicht der vollständige Kontenrahmen. Dein Betrieb kann andere Nummern verwenden (Hinweis für Ausbilder: bitte mit dem betrieblichen Kontenplan abgleichen).</p>
      <table class="h">${kt}</table></div></details>
    <details><summary>🎯 Eingabe, Rundung, Prüfmodus</summary><div class="hb2">
      <p>Beträge schreibst du mit Komma (1250,50) oder Punkt. Einheiten wie „€“ am Ende dürfen dabei stehen. Jeder Betrag wird kaufmännisch auf Cent gerundet, Abweichungen bis 0,01 € werden akzeptiert.</p>
      <p>Bei Buchungsaufgaben wählst du für jede Zeile die Seite (Soll oder Haben), das Konto und den Betrag. Mit „+ Zeile“ fügst du Zeilen für zusammengesetzte Buchungssätze hinzu. Die Reihenfolge der Zeilen ist egal.</p>
      <p>Im <b>Prüfmodus</b> (🎓) kostet jede der zwei Tipp-Stufen 25 % der Punkte, und der Lösungsweg erscheint erst nach richtiger Lösung.</p></div></details>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  const TABS = [['ed', '✍️', 'Editor'], ['bsp', '📚', 'Beispiele'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const PG = { ed: 'Ed', bsp: 'Bsp', tasks: 'Tasks', rt: 'Rt', help: 'Help' };
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'ed'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'ed') renderEd(); else if (t === 'bsp') renderBsp(); else if (t === 'tasks') renderTasks(); else if (t === 'rt') renderTrainer(); else if (t === 'help') renderHelp();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Buchführungs-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Buchführungs-Lab: ' + T[2];
    const sc = $('#pg' + PG[t]); if (sc) sc.scrollTop = 0;
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); updatePal(); $('#bExam').classList.toggle('on', on); $('#bExam').setAttribute('aria-pressed', on); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), sig = [F, fxOn, exam(), nDone(), S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Aufgabe im Trainer">🎲 Zufallsaufgabe</button>
      <span id="stat">Aufgaben gelöst <b>${nDone()}/${TASKS.length}</b> · Serie <b>${S.rt.streak}</b> · Beste Serie <b>${S.rt.best}</b></span>`;
    $('#bExam').classList.toggle('on', exam());
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
    const rows = [['ed', 'Buchungssatz-Editor', 'Buchen mit T-Konten, Journal und Saldo'], ['bsp', 'Beispiele', D.examples.length + ' fertig durchgebuchte Beispiele'], ['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe und Kontenliste', 'Regeln, Formeln, Übungskonten'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => {
        const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m;
        if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m);
      });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.t = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.BUC_LAB = { id: 'buc', title: 'Buchführungs-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.BUC_TASKS };

  buildTabs(); updatePal(); setTab(S.tab);
  /* Aufruf ?aufgabe=buc1 (Startseite, Lernhefte): Aufgabe gleich öffnen; ?bsp: Beispielauswahl */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try {
    const qs = new URLSearchParams(location.search), qa = qs.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } else if (qs.has('bsp')) setTab('bsp');
  } catch (e) {}
})(window);
