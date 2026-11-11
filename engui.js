'use strict';
/* Tonfunk Technisches-Englisch-Lab: Oberfläche (Lab-Kennung 'eng').
   Reiter: Vokabeln (Karten-Trainer mit Beruf-Filter), Wortliste, Warnhinweise, Zahlen & Einheiten, Nachschlagen, Aufgaben, Trainer, Beispiele, Hilfe.
   Module: engcore.js (ENG_CORE, Logik und Auswertung), engdata.js (ENG_DATA, ENG_TASKS: Vokabeln, Aufgaben, Beispiele, Tabellen). Alles läuft offline.
   Speicher (Präfix lm4.eng.): tab, vok, cards ({Wort:Box 0..2}), zahl, warn, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: englab.html?aufgabe=eng1 öffnet die Aufgabe, englab.html?bsp öffnet die Beispiele (?bsp=zahl1 springt zu einem Beispiel). */
(function (root) {
  const C = root.ENG_CORE, D = root.ENG_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.eng.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseNum(s);
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Technisches-Englisch-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">engcore.js oder engdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['vok', '🃏', 'Vokabeln'], ['wort', '📚', 'Wortliste'], ['warn', '⚠️', 'Warnhinweise'], ['zahl', '🔢', 'Zahlen & Einheiten'], ['ref', '📋', 'Nachschlagen'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const VIEW = { vok: 'vokView', wort: 'wortView', warn: 'warnView', zahl: 'zahlView', ref: 'refView', tasks: 'taskView', rt: 'rtView', bsp: 'bspView', help: 'helpView' };
  const jobKeys = C.JOBS.map(j => j[0]);
  const homeJob = (() => { try { const v = localStorage.getItem('lm4.beruf'); return jobKeys.indexOf(v) >= 0 ? v : 'all'; } catch (e) { return 'all'; } })();
  const S = {
    tab: lsGet('tab', 'vok'),
    vok: Object.assign({ job: homeJob, g: 'all', dir: 'en2de', mode: 'karte' }, lsGet('vok', {})), V: { cur: null, shown: false, sel: -1, mc: null, n: 0, ok: 0 },
    wort: { q: '' },
    warn: Object.assign({ injury: 'serious', imminent: '1' }, lsGet('warn', {})),
    zahl: Object.assign({ s: '1,250.5', mode: 'en', q: 'len', v: '2,5', from: 'in', to: 'mm' }, lsGet('zahl', {})),
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (S.vok.job !== 'all' && jobKeys.indexOf(S.vok.job) < 0) S.vok.job = 'all';
  if (S.vok.g !== 'all' && !D.groups.some(g => g[0] === S.vok.g)) S.vok.g = 'all';
  if (!['en2de', 'de2en'].includes(S.vok.dir)) S.vok.dir = 'en2de';
  if (!['karte', 'wahl'].includes(S.vok.mode)) S.vok.mode = 'karte';
  const QU = Object.keys(C.UNITS).concat(['temp']);
  const unitsOf = q => (q === 'temp' ? C.TEMPS : Object.keys(C.UNITS[q].u));
  if (!QU.includes(S.zahl.q)) S.zahl.q = 'len';
  if (!unitsOf(S.zahl.q).includes(S.zahl.from) || !unitsOf(S.zahl.q).includes(S.zahl.to)) { S.zahl.from = unitsOf(S.zahl.q)[0]; S.zahl.to = unitsOf(S.zahl.q)[1]; }
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const sel = (attr, opts, cur) => `<select ${attr}>${opts.map(o => `<option value="${esc(o[0])}"${String(cur) === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  const UEB = 'Alle Zahlen, Preise und Beispieltexte in diesem Lab sind Übungsmaterial. Maßgebend sind immer die Unterlagen und Vorgaben deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const sigBox = w => { const s = C.SIGNALS.find(x => x.w === w); return s ? `<span class="sg" style="background:${s.color};color:${w === 'CAUTION' ? '#1b1f24' : '#fff'}">${esc(s.w)} · ${esc(s.de)}</span>` : ''; };
  function docHtml(d) {
    if (!d) return '';
    let h = '<div class="doc">'; if (d.title) h += `<div class="dt1">${esc(d.title)}</div>`;
    if (d.head) h += `<div class="tw"><table class="tt"><tr>${d.head.map(x => `<th>${esc(x)}</th>`).join('')}</tr>${d.rows.map((r, ri) => `<tr>${r.map((x, ci) => `<td${d.hl && d.hl[0] === ri && d.hl[1] === ci ? ' class="hl"' : ''}>${esc(x)}</td>`).join('')}</tr>`).join('')}</table></div>`;
    if (d.lines) h += d.lines.map((l, i) => `<div class="ln${d.mark === i ? ' mk' : ''}">${d.numbered ? `<i>${i + 1}</i>` : ''}<span>${esc(l)}</span></div>`).join('');
    return h + '</div>';
  }
  const table = (head, rows) => `<div class="tw"><table class="tt"><tr>${head.map(x => `<th>${esc(x)}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</table></div>`;

  /* ============================================================ Vokabeltrainer */
  const jobOpts = [['all', 'Alle Berufe']].concat(C.JOBS), grpOpts = [['all', 'Alle Fachgebiete']].concat(D.groups);
  const vCards = () => C.filterCards(D.vocab, S.vok.job, S.vok.g);
  function vFilters(mode) {
    return `<div class="dsrow"><label class="f"><span>Beruf</span>${sel('data-vf="job"', jobOpts, S.vok.job)}</label><label class="f"><span>Fachgebiet</span>${sel('data-vf="g"', grpOpts, S.vok.g)}</label></div>`;
  }
  function newCard() {
    const V = S.V, cs = vCards(); V.shown = false; V.sel = -1;
    if (!cs.length) { V.cur = null; V.mc = null; return; }
    V.cur = C.nextCard(R0, cs, lsGet('cards', {}), V.cur && V.cur.en);
    V.mc = C.makeChoices(R0, D.vocab, V.cur, S.vok.dir, 4);
  }
  function renderVok() {
    const V = S.V, cs = vCards(), boxes = lsGet('cards', {}), known = cs.filter(c => (boxes[c.en] || 0) >= 2).length;
    if (!V.cur || cs.indexOf(V.cur) < 0) newCard();
    let h = `<div class="stats"><div class="bx"><b>${cs.length}</b>Karten</div><div class="bx"><b>${known}</b>sicher</div><div class="bx"><b>${V.n}</b>gezeigt</div><div class="bx"><b>${V.ok}</b>gewusst</div></div>${vFilters()}
      <div class="fbar">${seg('data-vd', [['en2de', 'Englisch → Deutsch'], ['de2en', 'Deutsch → Englisch']], S.vok.dir)}${seg('data-vm', [['karte', 'Karte aufdecken'], ['wahl', 'Auswahl']], S.vok.mode)}</div>`;
    if (!V.cur) h += note('Für diese Auswahl gibt es keine Karten. Wähle einen anderen Beruf oder ein anderes Fachgebiet.');
    else {
      const c = V.cur, q = S.vok.dir === 'en2de' ? c.en : c.de, a = S.vok.dir === 'en2de' ? c.de : c.en;
      h += `<div class="card pl"><h4>${esc(D.groupName(c.g))} · Box ${(boxes[c.en] || 0) + 1} von 3</h4><div class="fw">${esc(q)}</div>`;
      if (S.vok.mode === 'karte') {
        h += V.shown ? `<div class="fw back">${esc(a)}</div><div class="btns"><button class="btn pri" data-va="yes">✓ Gewusst</button><button class="btn" data-va="no">✗ Nochmal</button></div>` : `<div class="btns"><button class="btn pri" data-va="show">Aufdecken</button></div><p class="hint2">Denke zuerst an die Antwort, dann decke auf und sage ehrlich, ob du sie wusstest.</p>`;
      } else {
        const done = V.sel >= 0;
        h += `<div class="opts">${V.mc.choices.map((x, i) => `<button data-vc="${i}" ${done ? 'disabled' : ''} class="${done ? (i === V.mc.correct ? 'ok' : i === V.sel ? 'bad' : '') : ''}">${esc(x)}</button>`).join('')}</div>${done ? '<div class="btns"><button class="btn pri" data-va="next">Nächste Karte</button></div>' : ''}`;
      }
      h += `</div><p class="hint2">Gewusste Karten wandern in höhere Boxen und kommen seltener dran. Fehler schicken die Karte zurück in Box 1. Der Stand bleibt auf diesem Gerät gespeichert.</p>`;
    }
    $('#vokView').innerHTML = h;
  }
  /* PRUEFEN P18: Vokabel-Boxen: drei Stufen (neu/unsicher, bekannt, sicher); gewusst = eine Box höher, nicht gewusst = zurück auf Box 1; seltener gezeigt wird ab Box 2 (Gewicht 4 : 2 : 1). Ist dieses einfache Verfahren für Azubis passend? */
  function markCard(ok) {
    const V = S.V, b = lsGet('cards', {}); b[V.cur.en] = C.advance(b[V.cur.en], ok); lsSet('cards', b); V.n++; if (ok) { V.ok++; ding(); } else sad();
  }
  $('#vokView').addEventListener('change', e => { const k = e.target.dataset.vf; if (!k) return; S.vok[k] = e.target.value; lsSet('vok', S.vok); S.V.cur = null; renderVok(); });
  $('#vokView').addEventListener('click', e => {
    const V = S.V, d = e.target.closest('[data-vd]'), m = e.target.closest('[data-vm]'), a = e.target.closest('[data-va]'), c = e.target.closest('[data-vc]');
    if (d) { S.vok.dir = d.dataset.vd; lsSet('vok', S.vok); newCard(); renderVok(); return; }
    if (m) { S.vok.mode = m.dataset.vm; lsSet('vok', S.vok); V.shown = false; V.sel = -1; renderVok(); return; }
    if (c && V.cur && V.sel < 0) { V.sel = +c.dataset.vc; markCard(V.sel === V.mc.correct); renderVok(); return; }
    if (a) { const x = a.dataset.va; if (x === 'show') { V.shown = true; renderVok(); } else if (x === 'yes' || x === 'no') { markCard(x === 'yes'); newCard(); renderVok(); } else if (x === 'next') { newCard(); renderVok(); } }
  });

  /* ============================================================ Wortliste */
  function wortRows() {
    const q = S.wort.q.trim().toLowerCase();
    return vCards().filter(c => !q || c.en.toLowerCase().indexOf(q) >= 0 || c.de.toLowerCase().indexOf(q) >= 0);
  }
  function wortBody() {
    const rows = wortRows(), boxes = lsGet('cards', {});
    return `<p class="hint2" style="margin:0 0 6px">${rows.length} Wörter</p>` + table(['Englisch', 'Deutsch', 'Fachgebiet', 'Box'], rows.map(c => [c.en, c.de, D.groupName(c.g), String((boxes[c.en] || 0) + 1)]));
  }
  function renderWort() {
    $('#wortView').innerHTML = `<div class="card pl"><h4>Wortliste</h4>${vFilters()}<label class="f"><span>Suche (Englisch oder Deutsch)</span><input data-wq="1" autocomplete="off" value="${esc(S.wort.q)}"></label><div id="wortBody">${wortBody()}</div></div>`;
  }
  $('#wortView').addEventListener('input', e => { if (e.target.dataset.wq) { S.wort.q = e.target.value; $('#wortBody').innerHTML = wortBody(); } });
  $('#wortView').addEventListener('change', e => { const k = e.target.dataset.vf; if (!k) return; S.vok[k] = e.target.value; lsSet('vok', S.vok); S.V.cur = null; renderWort(); });

  /* ============================================================ Warnhinweise */
  function warnOut(info) {
    const w = C.signalFor(info), s = C.SIGNALS.find(x => x.w === w);
    return `<div class="rdout ok"><span class="st">Ergebnis</span>${sigBox(w)}<p style="margin:8px 0 0">${esc(s.rule)}</p></div>`;
  }
  function renderWarn() {
    const s = S.warn, info = { injury: s.injury, imminent: s.imminent === '1' };
    let h = ueb() + `<div class="card pl"><h4>Welches Signalwort passt?</h4><p class="hint2" style="margin:0 0 8px">Stelle ein, was passieren kann. Die Regel ist: erst fragen, ob jemand verletzt werden kann, dann wie schwer und wie nah die Gefahr ist.</p>
      <div class="fbar">${seg('data-wi', [['none', 'Nur Sachschaden'], ['minor', 'Leichte Verletzung'], ['serious', 'Tod oder schwere Verletzung']], s.injury)}</div>
      ${s.injury === 'serious' ? `<div class="fbar">${seg('data-wm', [['1', 'Gefahr ist unmittelbar'], ['0', 'Gefahr ist möglich']], s.imminent)}</div>` : ''}${warnOut(info)}</div>
      <div class="card pl"><h4>Die vier Signalwörter</h4>${C.SIGNALS.map(x => `<div style="margin:8px 0">${sigBox(x.w)}<p class="hint2" style="margin:4px 0 0">${esc(x.rule)}</p></div>`).join('')}</div>
      <div class="gh">Beispiel-Hinweise</div><div class="dt">`;
    D.warn.forEach(w => { h += `<details><summary>${sigBox(w.sig)}</summary><div class="hb2"><p><b>${esc(w.en)}</b></p><p>${esc(w.de)}</p></div></details>`; });
    $('#warnView').innerHTML = h + '</div>';
  }
  $('#warnView').addEventListener('click', e => {
    const i = e.target.closest('[data-wi]'), m = e.target.closest('[data-wm]');
    if (i) S.warn.injury = i.dataset.wi; else if (m) S.warn.imminent = m.dataset.wm; else return; lsSet('warn', S.warn); renderWarn();
  });

  /* ============================================================ Zahlen und Einheiten */
  function zahlNotation(s, mode) {
    const to = mode === 'en' ? 'de' : 'en', ok = C.isNotation(s, mode);
    if (!s.trim()) return note('Gib eine Zahl ein.');
    if (!ok) return note(mode === 'en' ? 'So ist die Zahl keine gültige englische Schreibweise. Englisch: Dezimalpunkt, Tausenderkomma, zum Beispiel 1,250.5.' : 'So ist die Zahl keine gültige deutsche Schreibweise. Deutsch: Dezimalkomma, Tausenderpunkt, zum Beispiel 1.250,5.');
    const v = C.parseNum(s, mode); let h = box(mode === 'en' ? 'Auf Deutsch geschrieben' : 'Auf Englisch geschrieben', '', C.convertNotation(s, mode, to));
    h += box('Zahlenwert', '', f(v, 6));
    if (mode === 'en') { const w = C.sayNumber(s); if (w) h += box('Gesprochen', '', w); }
    return h;
  }
  function zahlUnit(z) {
    const v = P(z.v); if (!Number.isFinite(v)) return note('Gib einen Wert als Zahl ein (mit Komma oder Punkt).');
    const r = C.conv(v, z.from, z.to); if (!Number.isFinite(r)) return note('Diese Umrechnung ist nicht möglich.');
    let fm; if (z.q === 'temp') fm = z.from + ' → ' + z.to; else fm = f(v, 4) + ' ' + z.from + ' · ' + f(C.UNITS[z.q].u[z.from] / C.UNITS[z.q].u[z.to], 6);
    return box('Ergebnis', fm, f(r, 4) + ' ' + z.to) + `<p class="hint2">Auf Englisch geschrieben: ${esc(C.fmtEnN(r, 4, true))} ${esc(z.to)}</p>`;
  }
  const QN = { len: 'Länge', mass: 'Masse', press: 'Druck', vol: 'Volumen', temp: 'Temperatur' };
  function renderZahl() {
    const z = S.zahl;
    $('#zahlView').innerHTML = ueb() + `<div class="card pl"><h4>Zahlenschreibweise</h4><p class="hint2" style="margin:0 0 8px">Englisch: Dezimalpunkt und Tausenderkomma (1,250.5). Deutsch: Dezimalkomma und Tausenderpunkt (1.250,5).</p>
      <div class="fbar">${seg('data-zm', [['en', 'Eingabe ist englisch'], ['de', 'Eingabe ist deutsch']], z.mode)}</div>
      <label class="f"><span>Zahl</span><input data-z="s" inputmode="decimal" autocomplete="off" value="${esc(z.s)}"></label><div id="zNot">${zahlNotation(z.s, z.mode)}</div></div>
      <div class="card pl"><h4>Einheiten umrechnen</h4><div class="fbar">${seg('data-zq', QU.map(q => [q, QN[q]]), z.q)}</div>
      <div class="dsrow"><label class="f"><span>Wert</span><input data-z="v" inputmode="decimal" autocomplete="off" value="${esc(z.v)}"></label><label class="f"><span>von</span>${sel('data-zu="from"', unitsOf(z.q).map(u => [u, u]), z.from)}</label><label class="f"><span>nach</span>${sel('data-zu="to"', unitsOf(z.q).map(u => [u, u]), z.to)}</label></div><div id="zUnit">${zahlUnit(z)}</div>
      <p class="hint2">Faktoren: 1 in = 25,4 mm · 1 lb = 0,4536 kg · 1 psi = 0,0689 bar · °F = °C · 1,8 + 32.</p></div>
      <div class="card pl"><h4>Vorsätze</h4>${table(['Zeichen', 'Name', 'Faktor'], [['µ', 'micro', '10⁻⁶ (Millionstel)'], ['m', 'milli', '10⁻³ (Tausendstel)'], ['k', 'kilo', '10³ (Tausend)'], ['M', 'mega', '10⁶ (Million)'], ['G', 'giga', '10⁹ (Milliarde)']])}</div>`;
  }
  $('#zahlView').addEventListener('input', e => {
    const k = e.target.dataset.z; if (!k) return; S.zahl[k] = e.target.value; lsSet('zahl', S.zahl);
    if (k === 's') $('#zNot').innerHTML = zahlNotation(S.zahl.s, S.zahl.mode); else $('#zUnit').innerHTML = zahlUnit(S.zahl);
  });
  $('#zahlView').addEventListener('change', e => { const u = e.target.dataset.zu; if (!u) return; S.zahl[u] = e.target.value; lsSet('zahl', S.zahl); $('#zUnit').innerHTML = zahlUnit(S.zahl); });
  $('#zahlView').addEventListener('click', e => {
    const m = e.target.closest('[data-zm]'), q = e.target.closest('[data-zq]');
    if (m) S.zahl.mode = m.dataset.zm; else if (q) { S.zahl.q = q.dataset.zq; S.zahl.from = unitsOf(S.zahl.q)[0]; S.zahl.to = unitsOf(S.zahl.q)[1]; } else return;
    lsSet('zahl', S.zahl); renderZahl();
  });

  /* ============================================================ Nachschlagen */
  function renderRef() {
    let h = ueb() + '<div class="dt">';
    D.ref.forEach((s, i) => { h += `<details${i === 0 ? ' open' : ''}><summary>${esc(s.t)}</summary><div class="hb2"><p>${esc(s.intro)}</p>${table(s.head, s.rows)}</div></details>`; });
    $('#refView').innerHTML = h + '</div>';
  }

  /* ============================================================ Aufgaben und Trainer */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  const pctFor = id => C.pctFor(exam(), lsGet('ctipps', {})[id] || 0);
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    const d = done(); d[id] = true; lsSet('done', d); updateBadge(); updatePal();
  }
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : q.ask.type === 'multi' ? q.ask.rows.map(r => r.label + ' → ' + r.options[r.correct]).join('; ') : f(q.value, 2) + ' ' + q.ask.unit);
  function qBody(q, a, r, pre) {
    const lock = r && (r.ok || pre === 'rt');
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${lock ? 'disabled' : ''} class="${lock && i === q.ask.correct ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    if (q.ask.type === 'multi') return q.ask.rows.map((row, i) => `<label class="f"><span>${esc(row.label)}${r && r.rows ? (r.rows[i] ? ' ✓' : ' ✗') : ''}</span><select data-tm="${i}" ${lock ? 'disabled' : ''}><option value="">– wählen –</option>${row.options.map((o, j) => `<option value="${j}"${a.m && a.m[i] === j ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`).join('');
    return `<label class="f"><span>${esc(q.ask.label)} (${esc(q.ask.unit)})</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${lock ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div></label>`;
  }
  function evalQ(q, a) { const r = C.evalAnswer(q, a); if (r.incomplete) { toast(r.msg); return null; } return r; }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 2))} ${esc(q.ask.unit)} (wegen Rundung).</li>` : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(solText(q))}<br><br><b>Erklärung:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Die Erklärung gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${docHtml(q.doc)}${qBody(q, a, r, 'tk')}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    S.tRes = { id: t.id, ok: e.ok, given: e.given, rows: e.rows, pct };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast('Noch nicht richtig. Lies die Erklärung und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintFor(q, id) {
    const h = lsGet('hints', {}), n = Math.min(2, (h[id] || 0) + 1), ex = exam(); h[id] = Math.max(h[id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 2', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(q.tips[0])}</p>`; if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(q.tips[1])}</p>`;
      x += n >= 2 ? '<p class="hint2">Mehr Tipps gibt es nicht. Die Erklärung siehst du nach dem Prüfen.</p>' : '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“.</p>';
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
  const setMulti = (ans, i, v) => { ans.m = ans.m || []; ans.m[i] = v === '' ? null : +v; };
  const tv = $('#taskView');
  tv.addEventListener('input', e => { const t = curTask(); if (t && e.target.dataset.in) (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  tv.addEventListener('change', e => { const t = curTask(); if (t && e.target.dataset.tm != null) { setMulti(S.tAns[t.id] = S.tAns[t.id] || {}, +e.target.dataset.tm, e.target.value); if (S.tRes && !S.tRes.ok) { S.tRes = null; renderTasks(false); } } });
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
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p style="margin:8px 0">${esc(q.text)}</p>${docHtml(q.doc)}${qBody(q, T.ans, T.res, 'rt')}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}</div>`;
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr.ans.v = e.target.value; });
  rv.addEventListener('change', e => { if (e.target.dataset.tm != null && !S.tr.res) setMulti(S.tr.ans, +e.target.dataset.tm, e.target.value); });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (tc && !T.res) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if (!T.res && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res) return; const e = evalQ(T.q, T.ans); if (!e) return;
    T.res = { ok: e.ok, given: e.given, rows: e.rows }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Beispiele */
  function exBody(e) {
    const p = e.p; let h = '';
    if (e.kind === 'notation') {
      const to = p.from === 'en' ? 'de' : 'en', v = C.parseNum(p.s, p.from);
      h += docHtml({ title: p.from === 'en' ? 'Englische Schreibweise' : 'Deutsche Schreibweise', lines: [p.s] }) + box('1. Trennzeichen lesen', p.from === 'en' ? 'Komma = Tausender, Punkt = Dezimalzeichen' : 'Punkt = Tausender, Komma = Dezimalzeichen', p.s);
      h += box('2. In die andere Schreibweise', '', C.convertNotation(p.s, p.from, to)) + box('3. Zahlenwert', '', f(v, 3));
      if (p.from === 'en') h += box('4. Gesprochen', '', C.sayNumber(p.s));
    } else if (e.kind === 'unit') {
      const r = C.conv(p.v, p.from, p.to), q = C.quantityOf(p.from);
      const fm = q === 'temp' ? '(' + f(p.v, 0) + ' − 32) / 1,8' : f(p.v, 1) + ' ' + p.from + ' · ' + f(C.UNITS[q].u[p.from] / C.UNITS[q].u[p.to], 4);
      h += box('Umrechnung', fm, f(r, p.dec) + ' ' + p.to);
    } else if (e.kind === 'signal') {
      const w = D.warn[p.w], s = C.SIGNALS.find(x => x.w === w.sig);
      h += docHtml({ title: 'Label', lines: [w.en] }) + box('1. Was kann passieren?', '', w.injury === 'serious' ? 'Tod oder schwere Verletzung' : w.injury === 'minor' ? 'leichte Verletzung' : 'nur Sachschaden') + (w.injury === 'serious' ? box('2. Wie nah ist die Gefahr?', '', w.imminent ? 'unmittelbar' : 'nur möglich') : '');
      h += `<div class="rdout ok"><span class="st">Ergebnis</span>${sigBox(w.sig)}<p style="margin:8px 0 0">${esc(s.rule)}</p></div>` + box('Übersetzung', '', w.de);
    } else if (e.kind === 'sheet') {
      const v = D.sheetVals(C.rng(p.seed)), a = D.sheetAsk.find(x => x.k === p.k), doc = D.sheetDoc(v), ri = doc.rows.findIndex(r => r[0] === a.row), ci = doc.head.indexOf(a.col);
      doc.hl = [ri, ci]; h += docHtml(doc) + box('1. Zeile suchen', '', a.row) + box('2. Spalte wählen', '', a.col) + box('3. Wert und Einheit', '', C.fmtEnN(a.get(v), 1, true) + ' ' + a.unit + ' (deutsch ' + f(a.get(v), 1) + ' ' + a.unit + ')');
    } else if (e.kind === 'tol') {
      const r = C.tolRange(p.nom, p.pct);
      h += box('Kleinster Wert', 'Nennwert · (1 − ' + f(p.pct, 0) + ' / 100) = ' + f(p.nom, 1) + ' · ' + f(1 - p.pct / 100, 2), f(r.min, 3) + ' ' + p.unit) + box('Größter Wert', 'Nennwert · (1 + ' + f(p.pct, 0) + ' / 100) = ' + f(p.nom, 1) + ' · ' + f(1 + p.pct / 100, 2), f(r.max, 3) + ' ' + p.unit) + note('Jeder Wert von ' + f(r.min, 3) + ' bis ' + f(r.max, 3) + ' ' + p.unit + ' ist in Ordnung.', 'ok');
    } else if (e.kind === 'mail') {
      const m = D.mails[p.i]; h += docHtml({ title: 'E-mail, Subject: ' + m.subj, lines: m.lines, numbered: true, mark: m.err }) + box('Fehler in Zeile ' + (m.err + 1), '', m.lines[m.err], 'bad') + box('Besser', '', m.fix, 'ok') + note(m.why, 'warn');
    } else if (e.kind === 'bom') {
      const b = D.bomFor(C.rng(p.seed)), one = C.bomTotal(b.lines, 1), tot = C.bomTotal(b.lines, b.n);
      h += docHtml(D.bomDoc(b)) + b.lines.map(l => box('Position ' + l.pos, l.qty + ' · ' + C.fmtEn(l.price, 2) + ' EUR', f(C.lineCents(l.qty, l.price) / 100, 2) + ' EUR')).join('') + box('Kosten einer Baugruppe', '', f(one, 2) + ' EUR') + box('Kosten für ' + b.n + ' Baugruppen', f(one, 2) + ' · ' + b.n, f(tot, 2) + ' EUR') + box('Menge Position 1 für ' + b.n + ' Baugruppen', b.lines[0].qty + ' · ' + b.n, C.bomQty(b.lines, 1, b.n) + ' Stück');
    } else if (e.kind === 'lief') {
      const l = D.liefFor(C.rng(p.seed)), d = C.bomCheck(l.ord, l.del);
      h += docHtml(D.liefDoc(l)) + d.map(x => box('Abweichung', '', D.stmt(x), 'bad')).join('') + note('In die Reklamation gehören Bestellnummer, Lieferscheinnummer, die betroffene Position und die Abweichung.', 'warn');
    } else if (e.kind === 'tel') {
      h += p.lines.map(x => `<div class="rdout ${x[0] === 'Du' ? 'ok' : ''}"><span class="st">${esc(x[0])}</span>${esc(x[1])}</div>`).join('');
    }
    return h;
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele mit Übungswerten. Mit „Dazu üben“ öffnest du eine passende Aufgabe.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns">${e.kind === 'notation' || e.kind === 'unit' ? `<button class="btn" data-ex="${e.id}">In den Rechner laden</button>` : ''}<button class="btn pri" data-et="${e.task}">Dazu üben</button></div></div>`).join('');
  }
  $('#bspView').addEventListener('click', e => {
    const t = e.target.closest('[data-et]'), b = e.target.closest('[data-ex]');
    if (t) { setTab('tasks'); startTask(t.dataset.et); return; }
    if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex), p = x.p;
    if (x.kind === 'notation') S.zahl = Object.assign(S.zahl, { s: p.s, mode: p.from });
    else { const q = C.quantityOf(p.from); S.zahl = Object.assign(S.zahl, { q, v: String(p.v).replace('.', ','), from: p.from, to: p.to }); }
    lsSet('zahl', S.zahl); setTab('zahl'); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('So lernst du mit dem Lab', `<p><b>Vokabeln:</b> Wähle deinen Beruf und ein Fachgebiet. Du siehst Karten, deckst die Antwort auf und sagst, ob du sie wusstest. Gewusste Karten kommen seltener, Fehler kommen schnell wieder. Alles liegt offline auf deinem Gerät.</p><p><b>Aufgaben:</b> ${TASKS.length} Aufgaben in acht Themen. Der Trainer erzeugt unendlich viele ähnliche Fragen.</p><p><b>Prüfmodus:</b> Dort kostet jeder Tipp 25 % der Punkte (höchstens zwei Stufen). Beim normalen Üben sind Tipps gratis.</p>`, true) +
      sec('Zahlen im Englischen', `<span class="eq">Englisch: 1,250.5 (Komma = Tausender, Punkt = Dezimal)</span><span class="eq">Deutsch: 1.250,5 (Punkt = Tausender, Komma = Dezimal)</span><p>Achte besonders auf Zahlen wie 2,500: Im Englischen ist das zweitausendfünfhundert, nicht zwei Komma fünf. Beim Eingeben von Antworten darfst du Komma oder Punkt als Dezimalzeichen benutzen. Ein einzelnes Trennzeichen mit genau drei Ziffern danach (zum Beispiel 1.000) wird als Tausender gelesen.</p>`) +
      sec('Datenblatt lesen', `<p>Die Zeile nennt den Parameter, die Spalten <b>Min</b>, <b>Typ</b> und <b>Max</b> die Werte. Min und Max sind garantiert, Typ ist nur üblich. <b>Maximum ratings</b> sind Grenzen, die du nie überschreiten darfst, kein Arbeitspunkt. Die Einheit steht rechts.</p>`) +
      sec('Warnhinweise', `<table><tr><th>Signalwort</th><th>Bedeutung</th></tr>${C.SIGNALS.map(s => `<tr><td>${esc(s.w)} (${esc(s.de)})</td><td>${esc(s.rule)}</td></tr>`).join('')}</table><p class="hint2">Welche Signalwörter dein Betrieb benutzt, steht in seinen Anleitungen.</p>`) +
      sec('E-Mail und Telefon', `<p>Formell bleiben: keine Kurzformen („can’t“), keine Abkürzungen („thx“), kein „Hi“. Höflich fragen mit „Could you please …?“. Am Telefon: „I am afraid …“, „Could you spell that, please?“, „One moment, please.“</p>`) +
      sec('False Friends', `<p>Wörter, die wie deutsche aussehen, aber etwas anderes bedeuten: <i>actual</i> = tatsächlich, <i>become</i> = werden, <i>gift</i> = Geschenk, <i>eventually</i> = schließlich. Die ganze Liste steht unter „Nachschlagen“.</p>`) +
      `<p class="hint2">Fachbegriffe und Beispiele sind eigene Übungsformulierungen; Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'vok'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ vok: renderVok, wort: renderWort, warn: renderWarn, zahl: renderZahl, ref: renderRef, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Technisches-Englisch-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Technisches-Englisch-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('vok');
  $('#bMenu').onclick = () => {
    const rows = [['vok', 'Vokabeltrainer', 'Karten mit Beruf-Filter, offline'], ['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele'], ['help', 'Hilfe', 'Zahlen, Datenblatt, Warnhinweise, Mail'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben, Vokabel-Boxen und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps, Vokabel-Boxen und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt', 'cards'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.V = { cur: null, shown: false, sel: -1, mc: null, n: 0, ok: 0 }; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); else if (S.tab === 'vok') renderVok(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.ENG_LAB = { id: 'eng', title: 'Technisches-Englisch-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.ENG_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'vok');
  /* Aufruf ?aufgabe=eng1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=zahl1 springt zu einem Beispiel) */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
