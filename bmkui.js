'use strict';
/* Tonfunk Plan-Lab: Oberfläche (Lab-Kennung 'bmk').
   Anlage, Orte, Kennzeichen, Klemmenplan, Farben der Steuerleitungen und alle Zahlen sind frei erfundene ÜBUNGSWERTE (Modellbetrieb).
   Die Kennbuchstaben folgen der heute üblichen Belegung; ältere Pläne können abweichen.
   Reiter: Stromlaufplan (Zustände, Kontaktspiegel, Querverweise), Kennzeichen (Baukasten und Zerlegen), Klemmenplan (Klemmleiste, Verdrahtungsliste, Üben), Aufgaben, Trainer, Beispiele, Hilfe.
   Module: bmkcore.js (BMK_CORE), bmkdata.js (BMK_DATA, BMK_TASKS), bmkviz.js (BMK_VIZ, wird davor geladen).
   Speicher (Präfix lm4.bmk.): tab, plan, kz, kl, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: bmklab.html?aufgabe=bmk1 öffnet die Aufgabe, bmklab.html?bsp öffnet die Beispiele (?bsp=plan1 springt zu einem Beispiel). */
(function (root) {
  const C = root.BMK_CORE, D = root.BMK_DATA, V = root.BMK_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.bmk.';
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
  if (!C || !D || !V) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Plan-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">bmkcore.js, bmkdata.js oder bmkviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;
  const UEB = 'Anlage, Orte, Kennzeichen, Klemmenplan und alle Zahlen in diesem Lab sind frei erfundene Übungswerte (Modellbetrieb). Maßgebend sind immer die Pläne, Normen und Vorgaben deines Betriebs. Die Kennbuchstaben folgen der heute üblichen Belegung, ältere Pläne können abweichen.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const lbl = t => `<span style="font-size:14px;color:var(--mute)">${esc(t)}</span>`;
  const sel = (attr, opts, cur, dis) => `<select ${attr}${dis ? ' disabled' : ''}>${opts.map(o => `<option value="${esc(o[0])}"${String(cur) === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  const tbl = t => `<div class="tw"><p class="hint2" style="margin:6px 0 0"><b>${esc(t.title)}</b></p><table class="tt"><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${t.rows.map(r => `<tr>${r.map(c => `<td>${/^[-=+]\S+$/.test(c) ? `<span style="white-space:nowrap">${esc(c)}</span>` : esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;

  /* ============================================================ Zustand */
  const TABS = [['plan', '🔌', 'Stromlaufplan'], ['kz', '🏷️', 'Kennzeichen'], ['klem', '🔗', 'Klemmenplan'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const KZ0 = { mode: 'bau', f: 'A1', o: 'S1', k: 'K', nr: '3', a: '13', txt: '=A1+S1-K3:13' };
  const S = {
    tab: lsGet('tab', 'plan'),
    plan: Object.assign({ mode: 'lauf', sel: '' }, lsGet('plan', {})),
    kz: Object.assign({}, KZ0, lsGet('kz', {})),
    kl: Object.assign({ view: 'strip', sel: 0 }, lsGet('kl', {})),
    ueb: { seed: '', items: [], ans: {}, res: null, show: false },
    task: null, tq: null, tAns: {}, tRes: null, tFehl: {},
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  /* Gespeicherte Zustände prüfen */
  if (!C.MODES.some(m => m[0] === S.plan.mode)) S.plan.mode = 'lauf';
  if (!['', 'K1', 'F2'].includes(S.plan.sel)) S.plan.sel = '';
  if (!['bau', 'zer'].includes(S.kz.mode)) S.kz.mode = 'bau';
  if (S.kz.f && !C.funktOf(S.kz.f)) S.kz.f = KZ0.f;
  if (S.kz.o && !C.ortOf(S.kz.o)) S.kz.o = KZ0.o;
  if (S.kz.k && !C.kbOf(S.kz.k)) { S.kz.k = KZ0.k; S.kz.a = KZ0.a; }
  if (!/^[1-9]$/.test(String(S.kz.nr))) S.kz.nr = KZ0.nr;
  if (typeof S.kz.txt !== 'string') S.kz.txt = KZ0.txt;
  const anschOpts = k => C.ANSCHL[k] || ['1', '2'];
  if (S.kz.a && !anschOpts(S.kz.k).includes(S.kz.a)) S.kz.a = '';
  if (!['strip', 'liste', 'ueb'].includes(S.kl.view)) S.kl.view = 'strip';
  if (!C.klemmeOf(S.kl.sel)) S.kl.sel = 0;
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();
  const newSeed = () => 's' + Math.floor(R0() * 1e9).toString(36);
  const inst = svg => `<div class="inst">${svg}</div>`;

  /* ============================================================ Stromlaufplan */
  const MODEINFO = {
    ruhe: 'Ruhelage: Nichts ist betätigt, K1 ist nicht angezogen und F2 hat nicht ausgelöst. Alle Öffner sind geschlossen, alle Schließer offen. Nur über den Öffner K1 21-22 fließt Strom: P1 (Bereit) leuchtet.',
    lauf: 'Motor läuft: S2 wurde kurz gedrückt, K1 ist angezogen und hält sich über den Schließer 13-14 selbst. Die Hauptkontakte versorgen den Motor, der Öffner 21-22 hat P1 abgeschaltet und der Schließer 33-34 schaltet P2 (Läuft) ein.',
    ueberlast: 'Überlast: F2 hat ausgelöst. Sein Öffner 95-96 trennt die Spule, K1 fällt ab und der Motor ist aus. P1 leuchtet wieder (K1 21-22 ist geschlossen) und der Schließer F2 97-98 schaltet P3 (Störung) ein.'
  };
  function devInfo(dev, mode) {
    const st = C.state(mode), sp = C.spiegel(dev);
    const li = C.CONTACTS.filter(c => c.dev === dev).map(c => {
      const d = C.decodeContact(c.id), art = d ? d.ord + '. Hilfskontakt' : (dev === 'K1' ? 'Hauptkontakt' : 'Kontakt des Überlastrelais');
      return `<li><b>${esc(c.id)}</b>: ${esc(C.CTYP[c.typ])} (${esc(art)}) im Strompfad ${c.pfad}, jetzt ${st.closed[dev + ':' + c.id] ? 'geschlossen' : 'offen'}</li>`;
    }).join('');
    const kopf = dev === 'K1' ? 'Schütz K1: Die Spule liegt im Strompfad 2.' : 'Überlastrelais F2: Das Auslöseteil sitzt im Strompfad 1, im Hauptstromkreis des Motors.';
    return `<div class="rdout"><span class="st">${esc(kopf)}</span><ul class="tl" style="margin:4px 0 0">${li}</ul><p class="hint2" style="margin:6px 0 0">Kontaktspiegel: Schließer in den Strompfaden ${esc(sp.S.join(', '))}, Öffner in ${esc(sp.O.join(', '))}. Die Zahlen sind die Querverweise: Dort findest du die Kontakte im Plan.</p></div>`;
  }
  function planBody(mode, sl) {
    const lit = C.litLamps(mode).map(id => { const l = C.LAMPS.find(x => x.id === id); return id + ' (' + l.n + ')'; }).join(' und ');
    return inst(V.planSvg({ mode, sel: sl })) + `<div class="rdout ok"><span class="st">Es leuchten</span><b>${esc(lit)}</b></div><p class="hint2" style="margin:6px 0">${esc(MODEINFO[mode])}</p>` + (sl ? devInfo(sl, mode) : '');
  }
  function renderPlan() {
    const p = S.plan;
    $('#planView').innerHTML = ueb() + `<div class="card pl"><h4>Schützsteuerung des Förderbands</h4>
      <p class="hint2" style="margin:0 0 8px">Der Plan ist aufgelöst gezeichnet: Spule und Kontakte stehen getrennt, jedes Teil in seinem Strompfad. Wähle einen Zustand und sieh, wo Strom fließt. Tippe auf K1 oder F2 (im Bild oder unten), dann leuchten Spule, Kontakte und Kontaktspiegel zusammen auf.</p>
      <div class="fbar">${lbl('ZUSTAND')}${seg('data-mode', C.MODES, p.mode)}</div>
      <div class="fbar">${lbl('HERVORHEBEN')}${seg('data-sel', [['', 'Nichts'], ['K1', 'K1'], ['F2', 'F2']], p.sel)}</div>
      <div id="planOut">${planBody(p.mode, p.sel)}</div></div>`;
  }
  $('#planView').addEventListener('click', e => {
    const m = e.target.closest('[data-mode]'), s = e.target.closest('[data-sel]'), d = e.target.closest('[data-dev]');
    if (m) S.plan.mode = m.dataset.mode;
    else if (s) S.plan.sel = s.dataset.sel;
    else if (d) S.plan.sel = S.plan.sel === d.dataset.dev ? '' : d.dataset.dev;
    else return;
    lsSet('plan', S.plan); renderPlan();
  });

  /* ============================================================ Kennzeichen */
  const kzObj = () => ({ f: S.kz.f, o: S.kz.o, k: S.kz.k, nr: S.kz.k ? +S.kz.nr : 0, a: S.kz.a });
  function kzOut() {
    if (S.kz.mode === 'bau') {
      const o = kzObj(), s = C.buildKz(o);
      return (s ? `<div class="rdout ok"><span class="st">Dein Referenzkennzeichen</span><b style="font-size:20px">${esc(s)}</b></div>` : note('Wähle mindestens eine Funktion, einen Ort oder ein Betriebsmittel.')) + inst(V.kzSvg(o));
    }
    const t = S.kz.txt.trim(), o = C.parseKz(t);
    if (!t) return note('Gib ein Kennzeichen ein, zum Beispiel =A1+S1-K3:13.');
    if (!o) return note('Das passt nicht. Ein Kennzeichen besteht aus bis zu vier Teilen in dieser Reihenfolge: =Funktion, +Ort, -Produkt (Buchstabe und Nummer), :Anschluss. Ein Anschluss braucht ein Produkt.');
    return inst(V.kzSvg(o));
  }
  function kbCards() {
    return `<div class="kbg">${C.KB.map(x => `<button class="kbc" data-kb="${x.k}"><span class="kbl">${x.k}</span><span class="kbs">${x.sym ? V.symSvg(x.sym) : ''}</span><b>${esc(x.n)}</b><small>${esc(x.ex.slice(0, 2).join(', '))}</small></button>`).join('')}</div>`;
  }
  function renderKz() {
    const z = S.kz, bau = z.mode === 'bau', ex = ['=A1+S1-K3:13', '=A2+S2-S1:11', '-F2:95', '+S1-X1:4'];
    $('#kzView').innerHTML = ueb() + `<div class="card pl"><h4>Referenzkennzeichen</h4>
      <p class="hint2" style="margin:0 0 8px">Ein Referenzkennzeichen sagt, was ein Teil tut (=Funktion), wo es sitzt (+Ort), was es ist (-Produkt) und welcher Anschluss gemeint ist (:Anschluss). Baue eines zusammen oder zerlege ein vorhandenes.</p>
      <div class="fbar">${seg('data-kzm', [['bau', 'Baukasten'], ['zer', 'Zerlegen']], z.mode)}</div>` +
      (bau ? `<div class="dsrow"><label class="f"><span>Funktion (=)</span>${sel('data-kzf="f"', [['', 'ohne']].concat(C.FUNKT.map(x => [x.c, x.c + ' ' + x.n])), z.f)}</label>
        <label class="f"><span>Ort (+)</span>${sel('data-kzf="o"', [['', 'ohne']].concat(C.ORTE.map(x => [x.c, x.c + ' ' + x.n])), z.o)}</label>
        <label class="f"><span>Betriebsmittel (-)</span>${sel('data-kzf="k"', [['', 'ohne']].concat(C.KB.map(x => [x.k, x.k + ' ' + x.ex[0]])), z.k)}</label>
        <label class="f"><span>Nummer</span>${sel('data-kzf="nr"', [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [String(n), String(n)]), z.nr, !z.k)}</label>
        <label class="f"><span>Anschluss (:)</span>${sel('data-kzf="a"', [['', 'ohne']].concat(anschOpts(z.k).map(a => [a, a])), z.a, !z.k)}</label></div>`
        : `<label class="f"><span>Kennzeichen eingeben</span><input data-kzt="1" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(z.txt)}"></label><div class="ctl">${ex.map(x => `<button class="chip s" data-kzx="${esc(x)}">${esc(x)}</button>`).join('')}</div>`) +
      `<div id="kzOut">${kzOut()}</div></div>
      <div class="card pl"><h4>Kennbuchstaben der Betriebsmittel (heute übliche Belegung)</h4><p class="hint2" style="margin:0 0 8px">Der Buchstabe sagt, wofür ein Betriebsmittel da ist, nicht, wie es heißt. Das ist eine Auswahl der häufigsten Fälle in eigenen Worten. Ältere Pläne weichen ab: Eine Meldeleuchte trug früher oft H, ein Endschalter S. Im Zweifel gilt die Zeichenerklärung des Plans. Tippe auf einen Buchstaben, dann nimmt ihn der Baukasten.</p>${kbCards()}</div>`;
  }
  $('#kzView').addEventListener('input', e => {
    if (!e.target.dataset.kzt) return;
    S.kz.txt = e.target.value; lsSet('kz', S.kz); $('#kzOut').innerHTML = kzOut();
  });
  $('#kzView').addEventListener('change', e => {
    const k = e.target.dataset.kzf; if (!k) return;
    S.kz[k] = e.target.value;
    if (k === 'k') { if (!S.kz.k) S.kz.a = ''; else if (!anschOpts(S.kz.k).includes(S.kz.a)) S.kz.a = ''; }
    lsSet('kz', S.kz); renderKz();
  });
  $('#kzView').addEventListener('click', e => {
    const m = e.target.closest('[data-kzm]'), x = e.target.closest('[data-kzx]'), kb = e.target.closest('[data-kb]');
    if (m) S.kz.mode = m.dataset.kzm;
    else if (x) { S.kz.txt = x.dataset.kzx; S.kz.mode = 'zer'; }
    else if (kb) { S.kz.k = kb.dataset.kb; if (!anschOpts(S.kz.k).includes(S.kz.a)) S.kz.a = ''; S.kz.mode = 'bau'; toast('Kennbuchstabe ' + S.kz.k + ' im Baukasten gewählt'); }
    else return;
    lsSet('kz', S.kz); renderKz();
  });

  /* ============================================================ Klemmenplan */
  const klDetail = n => {
    const k = C.klemmeOf(n);
    return k ? `<div class="rdout"><span class="st">Klemme ${k.n} der Klemmleiste -X1</span>Quelle im Schrank <b>${esc(k.innen)}</b>, Ziel im Feld <b>${esc(k.aussen)}</b>. Ader ${esc(k.f)}, ${esc(k.q)} mm².</div>` : '<p class="hint2">Tippe im Bild auf eine Zeile oder wähle eine Klemme aus der Liste.</p>';
  };
  const klList = n => `<div class="tw"><table class="tt"><tr><th>Nr.</th><th>Von</th><th>Nach</th><th>Farbe</th><th>mm²</th></tr>${C.verdrahtung().map(r => `<tr data-kl="${r.nr}" class="${n === r.nr ? 'sel' : ''}"><td>${r.nr}</td><td>${esc(r.von)}</td><td>${esc(r.nach)}</td><td>${esc(r.farbe)}</td><td>${esc(r.q)}</td></tr>`).join('')}</table></div>`;
  const uebNew = () => { S.ueb = { seed: newSeed(), items: [], ans: {}, res: null, show: false }; S.ueb.items = C.klemmenUebung(C.rng(S.ueb.seed), 4); };
  const sortDe = a => a.slice().sort((x, y) => x.localeCompare(y, 'de', { numeric: true }));
  function uebBody() {
    const u = S.ueb, side = { innen: 'Quelle (innen)', aussen: 'Ziel (außen)' }, hide = {};
    u.items.forEach(i => { if (!u.show && !(u.res && u.res[i.n])) hide[i.n] = i.fehlt; });
    const rows = u.items.map(i => {
      const k = C.klemmeOf(i.n), r = u.res && u.res[i.n];
      return `<label class="f"><span>Klemme ${i.n}: Was fehlt? ${esc(side[i.fehlt])}. Bekannt ist die andere Seite: ${esc(i.fehlt === 'innen' ? k.aussen : k.innen)}</span>${sel('data-ua="' + i.n + '"', [['', 'wählen']].concat(sortDe(C.klemmenOptionen(i.fehlt)).map(x => [x, x])), u.show ? k[i.fehlt] : (u.ans[i.n] || ''), u.show)}${u.res ? `<small class="${r ? 'pc' : 'pc m'}">${r ? '✓ richtig' : '✗ noch nicht richtig'}</small>` : ''}</label>`;
    }).join('');
    return inst(V.klemmenSvg({ hide })) + `<p class="hint2" style="margin:6px 0">In vier Klemmen fehlt eine Seite (gestricheltes Fragezeichen). Die andere Seite und die Aderfarbe im Bild helfen. Ergänze das Fehlende aus den Auswahllisten.</p>${rows}<div class="btns"><button class="btn pri" data-ub="chk"${u.show ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ub="show"${u.show ? ' disabled' : ''}>Lösung zeigen</button><button class="btn" data-ub="new">Neue Übung</button></div>`;
  }
  function renderKlem() {
    const k = S.kl;
    if (k.view === 'ueb' && !S.ueb.items.length) uebNew();
    let body;
    if (k.view === 'strip') body = inst(V.klemmenSvg({ sel: k.sel })) + `<label class="f"><span>Klemme wählen</span>${sel('data-ks="1"', [['0', 'keine']].concat(C.KLEMMEN.map(x => [String(x.n), 'Klemme ' + x.n])), k.sel)}</label>` + klDetail(k.sel);
    else if (k.view === 'liste') body = `<p class="hint2" style="margin:0 0 6px">Die Verdrahtungsliste ordnet nach Adern: von der Quelle im Schrank zur Klemme. Der Klemmenplan ordnet nach Klemmen. Es ist dieselbe Verdrahtung in zwei Ordnungen.</p>` + klList(k.sel) + klDetail(k.sel);
    else body = uebBody();
    $('#klemView').innerHTML = ueb() + `<div class="card pl"><h4>Klemmleiste -X1 der Übungsanlage</h4><div class="fbar">${seg('data-kv', [['strip', 'Klemmleiste'], ['liste', 'Verdrahtungsliste'], ['ueb', 'Üben']], k.view)}</div>${body}</div>`;
  }
  $('#klemView').addEventListener('change', e => {
    const d = e.target.dataset;
    if (d.ks) { S.kl.sel = +e.target.value; lsSet('kl', S.kl); renderKlem(); }
    else if (d.ua) { S.ueb.ans[d.ua] = e.target.value; S.ueb.res = null; }
  });
  $('#klemView').addEventListener('click', e => {
    const v = e.target.closest('[data-kv]'), r = e.target.closest('[data-kl]'), b = e.target.closest('[data-ub]');
    if (v) { S.kl.view = v.dataset.kv; lsSet('kl', S.kl); renderKlem(); return; }
    if (r) { S.kl.sel = S.kl.sel === +r.dataset.kl ? 0 : +r.dataset.kl; lsSet('kl', S.kl); renderKlem(); return; }
    if (!b) return;
    const u = S.ueb;
    if (b.dataset.ub === 'new') { uebNew(); renderKlem(); return; }
    if (b.dataset.ub === 'show') { u.show = true; renderKlem(); return; }
    if (!u.items.every(i => u.ans[i.n])) { toast('Wähle zuerst für jede Klemme eine Antwort.'); return; }
    u.res = {}; u.items.forEach(i => { u.res[i.n] = u.ans[i.n] === C.klemmeOf(i.n)[i.fehlt]; });
    const all = u.items.every(i => u.res[i.n]); if (all) ding(); else sad();
    toast(all ? '🎉 Alle richtig' : 'Noch nicht alles richtig. Bessere die markierten Klemmen aus.'); renderKlem();
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
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : f(q.value, 0) + ' ' + q.ask.unit);
  const eingabeHinweis = q => q.ask.type === 'num' ? `<p class="lr-hinweis hint2">Ganze Zahl in ${esc(q.ask.unit)}.</p>` : '';
  const stufeFuer = (ok, fehl, ex) => ok ? 'ok' : ex ? 'pruef' : fehl >= 2 ? 'loes' : 'tipp';
  const zeigFb = el => { try { const x = el && el.querySelector('.lr-fb'); if (x && root.LabRahmen) root.LabRahmen.zeig(x); } catch (e) {} };
  /* Aufgabentext, Bild, Tabellen und "So gehst du vor" */
  function qHead(q) {
    return `<p style="margin:8px 0">${esc(q.text)}</p>` + (q.img ? inst(V.taskImg(q.img)) : '') + (q.tables || []).map(tbl).join('')
      + `<div class="steps"><b>So gehst du vor</b><ol>${q.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>`;
  }
  function qBody(q, a, r) {
    const lock = r && (r.ok || r.stufe === 'loes');
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${lock ? 'disabled' : ''} class="${lock && i === q.ask.correct ? 'ok' : a.c === i ? (r && !r.ok && r.given === c ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)} (${esc(q.ask.unit)})</span><div class="qin"><input data-in="1" inputmode="numeric" autocomplete="off" value="${esc(a.v || '')}" ${lock ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div>${eingabeHinweis(q)}</label>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein.'); return null; }
    return { ok: v === q.value, given: f(v, 0) + ' ' + q.ask.unit };
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
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${qHead(q)}${qBody(q, a, r)}`;
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
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${qHead(q)}${qBody(q, T.ans, T.res)}${T.res ? fbHTML(q, T.res) : ''}
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

  /* ============================================================ Beispiele */
  function exBody(e) {
    const p = e.p;
    if (e.tab === 'plan') return planBody(p.mode, p.sel);
    if (e.tab === 'kz') return inst(V.kzSvg(p)) + `<div class="rdout ok"><span class="st">Referenzkennzeichen</span><b>${esc(C.buildKz(p))}</b></div>`;
    return inst(V.klemmenSvg({ sel: p.n })) + klDetail(p.n);
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele (Übungswerte). Mit „Im Reiter öffnen“ kannst du selbst weiterspielen.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" data-ex="${e.id}">Im Reiter öffnen</button></div></div>`).join('');
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex), p = x.p;
    if (x.tab === 'plan') { S.plan.mode = p.mode; S.plan.sel = p.sel; lsSet('plan', S.plan); }
    else if (x.tab === 'kz') { Object.assign(S.kz, { mode: 'bau', f: p.f, o: p.o, k: p.k, nr: String(p.nr), a: p.a }); lsSet('kz', S.kz); }
    else { S.kl.view = 'strip'; S.kl.sel = p.n; lsSet('kl', S.kl); }
    setTab(x.tab); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Welcher Plan für welchen Zweck?', `<table><tr><th>Unterlage</th><th>Wozu</th></tr><tr><td>Übersichtsplan</td><td>Bausteine und Zusammenhänge grob, ohne einzelne Adern</td></tr><tr><td>Stromlaufplan</td><td>Wie die Schaltung arbeitet, Strompfad für Strompfad</td></tr><tr><td>Anschlussplan</td><td>Wie ein Gerät angeschlossen wird</td></tr><tr><td>Klemmenplan</td><td>Quelle und Ziel jeder Klemme, geordnet nach Klemmen</td></tr><tr><td>Verdrahtungsliste</td><td>Jede Ader als Zeile, geordnet nach Verbindungen</td></tr></table><p><b>Aufgelöst</b> gezeichnet heißt: Spule und Kontakte stehen getrennt, Querverweise verbinden sie. <b>Zusammenhängend</b> heißt: jedes Gerät bleibt als Block beisammen. Die Darstellung ändert nur die Zeichnung, nicht die Schaltung. Jeder Plan hat einen Änderungsstand mit Datum.</p>`, true) +
      sec('Kennbuchstaben', `<p>Der Kennbuchstabe sagt, wofür ein Betriebsmittel da ist: Q Energiefluss schalten, K Signale verarbeiten, F schützen, S von Hand eingeben, B Messgröße in ein Signal umwandeln, M Antrieb, P Information darstellen, X verbinden, T umformen, G erzeugen oder bereitstellen, E Licht oder Wärme abgeben, R begrenzen, C speichern.</p><p><b>Ältere Pläne können abweichen.</b> Eine Meldeleuchte trug früher oft H, ein Endschalter S. Auch Schütze im Hauptstromkreis tragen in der Praxis noch oft K statt Q. Lies, was im Plan steht, und schau in die Zeichenerklärung. Geändert wird nur auf Auftrag.</p><p class="hint2">Das ist eine kleine Auswahl in eigenen Worten für die Ausbildung. Vollständig und verbindlich ist die Norm DIN EN IEC 81346-2.</p>`) +
      sec('Referenzkennzeichen', `<span class="eq">=A1+S1-K3:13</span><p><b>=</b> Funktion: was die Einrichtung tut. <b>+</b> Ort: wo sie sitzt. <b>-</b> Produkt: das Betriebsmittel (Kennbuchstabe und Zählnummer). <b>:</b> Anschluss am Betriebsmittel.</p><p>Auf einem Blatt dürfen Teile, die für das ganze Blatt gleich sind, im Schriftfeld stehen und am Betriebsmittel entfallen. Weicht ein Betriebsmittel ab, steht die Abweichung direkt an seinem Kennzeichen. Grundlage: DIN EN IEC 81346-1.</p>`) +
      sec('Strompfade und Kontaktspiegel', `<p>Jeder Strompfad hat eine Nummer. Unter einer Spule zeigt der Kontaktspiegel, in welchen Strompfaden die zugehörigen Schließer und Öffner liegen. Bei den Kontakten steht umgekehrt, zu welcher Spule sie gehören. Pläne werden in Ruhelage gezeichnet: nichts betätigt, spannungslos.</p><p>Die Selbsthaltung ist ein Schließer der Spule parallel zum Ein-Taster. Der Aus-Taster ist ein Öffner in Reihe: Bei Drahtbruch geht die Anlage in den sicheren Zustand.</p>`) +
      sec('Anschlussbezeichnungen', `<table><tr><th>Teil</th><th>Bezeichnung</th></tr><tr><td>Spule</td><td>A1 und A2</td></tr><tr><td>Hauptkontakte</td><td>1-2, 3-4, 5-6 (oben ungerade, unten gerade)</td></tr><tr><td>Hilfskontakt</td><td>zwei Ziffern je Anschluss: Ordnungsziffer (der wievielte Kontakt) und Funktionsziffer (1-2 Öffner, 3-4 Schließer)</td></tr><tr><td>Überlastrelais</td><td>95-96 Öffner, 97-98 Schließer</td></tr></table><p>Beispiel: 21-22 ist der zweite Hilfskontakt und ein Öffner, 33-34 der dritte und ein Schließer.</p>`) +
      sec('Leiterfarben', `<p>Bei Installationsleitungen gilt: L1 braun, L2 schwarz, L3 grau, N blau, PE grün-gelb. Ältere Leitungen und die Verdrahtung in Maschinen können abweichen. Die Farben der Steuerleitungen in diesem Lab (rot und blau) sind Übungswerte.</p>`) +
      sec('Schaltzeichen', `<p>Genormte Zeichen machen Pläne für alle lesbar. Kontakte werden unbetätigt gezeichnet. Ein Taster schaltet nur, solange er betätigt wird, ein Schalter rastet ein. Ein unbekanntes Zeichen suchst du in der Zeichenerklärung des Plans, du rätst nicht.</p>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'plan'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ plan: renderPlan, kz: renderKz, klem: renderKlem, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Plan-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Plan-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('plan');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe', 'Pläne, Kennbuchstaben, Kennzeichen, Anschlüsse'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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

  /* Schnittstelle für Karriere/Lernpfad */
  root.BMK_LAB = { id: 'bmk', title: 'Plan-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.BMK_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'plan');
  /* Aufruf ?aufgabe=bmk1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=plan1 springt zu einem Beispiel) */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
