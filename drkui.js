'use strict';
/* Tonfunk 3D-Druck-Lab: Oberfläche (Lab-Kennung 'drk').
   ALLE Zahlen (Temperaturen, Dichten, Geschwindigkeiten, Preise, Zeiten, Maße) sind ÜBUNGSWERTE, nicht für die Praxis.
   Reiter: Slicer-Vorschau (Halter Schicht für Schicht), Fehlerbilder, Überhang (Teil drehen), Filamente (Druckkopf und Temperaturen), Aufgaben, Trainer, Hilfe.
   Module: drkcore.js (DRK_CORE), drkdata.js (DRK_DATA, DRK_TASKS), drkviz.js (DRK_VIZ).
   Speicher (Präfix lm4.drk.): tab, vor, feh, aus, fil, done ({id:true}), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2) nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: drklab.html?aufgabe=drk1 öffnet die Aufgabe. */
(function (root) {
  const C = root.DRK_CORE, D = root.DRK_DATA, Z = root.DRK_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.drk.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s);
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  const calm = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
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
  if (!C || !D || !Z) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>3D-Druck-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">drkcore.js, drkdata.js oder drkviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  Z.inject();
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['vor', '🧱', 'Slicer-Vorschau'], ['feh', '🔍', 'Fehlerbilder'], ['aus', '🔄', 'Überhang'], ['fil', '🧵', 'Filamente'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const MATS = ['pla', 'petg', 'abs'];
  const S = {
    tab: lsGet('tab', 'vor'),
    vor: Object.assign({ hi: 3, walls: 3, infill: 15, pattern: 'gitter', support: 'aus', mat: 'pla', price: '22' }, lsGet('vor', {})),
    feh: Object.assign({ mat: 'pla' }, C.FSTART.pla, lsGet('feh', {})),
    aus: Object.assign({ part: 'winkel', deg: 180, sup: true }, lsGet('aus', {})),
    fil: Object.assign({ mat: 'pla' }, lsGet('fil', {})),
    frac: 1, anim: 0,
    task: null, tq: null, tAns: {}, tRes: null, tFehl: {},
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  const clampN = (v, a, b, d) => (Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : d);
  S.vor.hi = Math.round(clampN(S.vor.hi, 0, C.HOEHEN.length - 1, 3)); S.vor.walls = Math.round(clampN(S.vor.walls, 1, 6, 3)); S.vor.infill = Math.round(clampN(S.vor.infill, 0, 100, 15));
  if (!C.musterOf(S.vor.pattern)) S.vor.pattern = 'gitter'; if (!C.stuetzOf(S.vor.support)) S.vor.support = 'aus'; if (!MATS.includes(S.vor.mat)) S.vor.mat = 'pla';
  if (!(P(S.vor.price) >= 0)) S.vor.price = '22';
  if (!MATS.includes(S.feh.mat)) S.feh = Object.assign({ mat: 'pla' }, C.FSTART.pla);
  S.feh.bed = clampN(S.feh.bed, 20, 120, 55); S.feh.noz = clampN(S.feh.noz, 170, 300, 215); S.feh.fan = clampN(S.feh.fan, 0, 100, 100); S.feh.ret = clampN(S.feh.ret, 0, 6, 0.8);
  if (!C.teilOf(S.aus.part)) S.aus.part = 'winkel'; S.aus.deg = Math.round(clampN(S.aus.deg, 0, 345, 180) / 15) * 15; S.aus.sup = S.aus.sup !== false;
  if (!C.filOf(S.fil.mat)) S.fil.mat = 'pla';
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const UEB = 'Alle Zahlen in diesem Lab (Temperaturen, Dichten, Geschwindigkeiten, Preise, Zeiten, Maße) sind Übungswerte für die Ausbildung, nicht für die Praxis. Maßgebend sind immer das Datenblatt der Spule, die Betriebsanweisung und die Angaben des Druckerherstellers.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const lbl = t => `<span style="font-size:14px;color:var(--mute)">${esc(t)}</span>`;
  const slider = (k, label, min, max, step, val, unit, d, txt) => `<label class="f"><span>${esc(label)}: <b data-sv="${k}">${txt || f(val, d || 0) + (unit ? ' ' + esc(unit) : '')}</b></span><input type="range" data-s="${k}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
  const setSv = (V, k, val, unit, d) => { const el = $('[data-sv="' + k + '"]', V); if (el) el.textContent = f(val, d || 0) + (unit ? ' ' + unit : ''); };
  const matSeg = (attr, cur) => seg(attr, MATS.map(k => [k, C.filOf(k).n]), cur);

  /* ============================================================ Slicer-Vorschau */
  const vorParams = () => ({ h: C.HOEHEN[S.vor.hi], walls: S.vor.walls, infill: S.vor.infill, pattern: S.vor.pattern, support: S.vor.support, mat: S.vor.mat, price: P(S.vor.price) });
  function vorOut() {
    const p = vorParams(), m = C.sliceModel(p);
    if (!m) return note('Gib den Preis je kg als Zahl ein (nicht negativ).');
    const mat = C.filOf(p.mat);
    return box('Schichten', f(C.SL.H, 0) + ' mm / ' + f(p.h, 2) + ' mm', f(m.layers, 0)) + box('Druckzeit (Übungsmodell)', '', C.fmtTime(m.sec)) +
      box('Filament', f(m.V / 1000, 2) + ' cm³ · ' + f(mat.rho, 2) + ' g/cm³', f(m.g, 1) + ' g, das sind ' + f(m.m, 1) + ' m Faden') +
      box('Kosten', f(m.costMat, 2) + ' € Material + ' + f(m.costPower, 2) + ' € Strom', f(m.cost, 2) + ' €') +
      (m.lueber ? note('Ohne Stützen hängt der Arm frei in der Luft: Das druckt nicht sauber. Schalte Stützen ein und sieh dir an, was sie kosten.') : '');
  }
  function vorShow() { $('#vzVor').innerHTML = Z.vorSvg(vorParams(), S.frac); $('#vorOut').innerHTML = vorOut(); const r = $('[data-s="frac"]'); if (r) r.value = Math.round(S.frac * 100); }
  function vorStop() { S.anim++; }
  function vorPlay() {
    vorStop(); const id = S.anim;
    if (calm()) { S.frac = 1; vorShow(); return; }
    const t0 = performance.now(), T = 4500;
    const step = now => { if (id !== S.anim) return; S.frac = Math.min(1, (now - t0) / T); const sv = $('#vzVor svg'); if (!sv) return; Z.vorFrame(sv, vorParams(), S.frac); const r = $('[data-s="frac"]'); if (r) r.value = Math.round(S.frac * 100); if (S.frac < 1) requestAnimationFrame(step); };
    S.frac = 0; requestAnimationFrame(step);
  }
  function renderVor() {
    const s = S.vor;
    $('#vorView').innerHTML = `<div class="inst" id="vzVor"></div><div class="btns" style="margin:0 0 8px"><button class="btn pri" data-vo="play">▶ Aufbau zeigen</button></div>
      <div class="card pl"><h4>Slicer-Vorschau: Halter Schicht für Schicht</h4>
      ${slider('frac', 'Schicht', 0, 100, 1, Math.round(S.frac * 100), '%')}
      ${slider('hi', 'Schichthöhe', 0, C.HOEHEN.length - 1, 1, s.hi, '', 0, f(C.HOEHEN[s.hi], 2) + ' mm')}
      ${slider('walls', 'Wände', 1, 6, 1, s.walls, '')}${slider('infill', 'Füllung', 0, 100, 5, s.infill, '%')}
      <div class="fbar">${lbl('MUSTER')}${seg('data-pa', C.MUSTER.map(m => [m.k, m.n]), s.pattern)}</div>
      <div class="fbar">${lbl('STÜTZEN')}${seg('data-su', C.STUETZ.map(m => [m.k, m.n]), s.support)}</div>
      <div class="fbar">${lbl('MATERIAL')}${matSeg('data-ma', s.mat)}<label class="f" style="margin:0;flex:1 1 130px"><span>Preis (€ je kg)</span><input data-pr="1" inputmode="decimal" autocomplete="off" value="${esc(s.price)}"></label></div></div>
      <div id="vorOut"></div>${ueb()}<p class="hint2">Das ist ein stark vereinfachtes Übungsmodell (Winkelhalter 44 × 40 × 20 mm). Der echte Slicer rechnet genauer.</p>`;
    vorShow(); if (!calm()) vorPlay();
  }
  $('#vorView').addEventListener('input', e => {
    const t = e.target, k = t.dataset.s; if (!k) { if (t.dataset.pr) { S.vor.price = t.value; lsSet('vor', S.vor); $('#vorOut').innerHTML = vorOut(); } return; }
    vorStop(); const v = +t.value;
    if (k === 'frac') { S.frac = v / 100; const sv = $('#vzVor svg'); if (sv) Z.vorFrame(sv, vorParams(), S.frac); setSv($('#vorView'), 'frac', v, '%'); return; }
    S.vor[k] = v; lsSet('vor', S.vor);
    if (k === 'hi') setSv($('#vorView'), 'hi', C.HOEHEN[v], 'mm', 2); else setSv($('#vorView'), k, v, k === 'infill' ? '%' : '');
    S.frac = 1; vorShow();
  });
  $('#vorView').addEventListener('click', e => {
    const b = e.target.closest('button[data-vo],button[data-pa],button[data-su],button[data-ma]'); if (!b) return; vorStop();
    if (b.dataset.vo) { vorPlay(); return; }
    if (b.dataset.pa) S.vor.pattern = b.dataset.pa; else if (b.dataset.su) S.vor.support = b.dataset.su; else S.vor.mat = b.dataset.ma;
    lsSet('vor', S.vor); S.frac = 1; renderVor();
  });

  /* ============================================================ Fehlerbilder */
  function fehOut(d, st) {
    const m = C.filOf(st.mat); let h = '';
    if (!d.found.length) h += note('Mit diesen Werten ist kein Fehler zu erwarten. Alle Werte liegen im Übungsbereich für ' + m.n + '.', 'ok');
    d.found.forEach(k => { const x = C.fehlOf(k); h += `<div class="rdout bad"><b>${esc(x.n)}</b><br>${esc(x.sym)}<span class="st">Ursache</span>${esc(x.ursache)}<span class="st">Abhilfe</span>${esc(x.abhilfe)}</div>`; });
    return h + `<p class="hint2">Bereiche für ${esc(m.n)} (Übungswerte): Düse ${f(m.nl, 0)} bis ${f(m.nh, 0)} °C, Bett ${f(m.bl, 0)} bis ${f(m.bh, 0)} °C, Lüfter ${f(m.fan[0], 0)} bis ${f(m.fan[1], 0)} %, Rückzug ab etwa 0,5 mm (Direktextruder, bei Bowden-Antrieb deutlich mehr). Ein Fehler zeigt sich erst ab einer gewissen Stärke.</p>`;
  }
  function fehShow() { const st = S.feh, d = C.diagnose(st); $('#vzFeh').innerHTML = Z.fehSvg(st, d); $('#fehOut').innerHTML = fehOut(d, st); }
  function renderFeh() {
    const s = S.feh;
    $('#fehView').innerHTML = `<div class="inst" id="vzFeh"></div><div class="card pl"><h4>Fehlerbilder: Stell die Werte ein und sieh, was passiert</h4>
      <div class="fbar">${lbl('MATERIAL')}${matSeg('data-fm', s.mat)}<button class="btn" data-fo="start">Startwerte laden</button></div>
      ${slider('bed', 'Betttemperatur', 20, 120, 1, s.bed, '°C')}${slider('noz', 'Düsentemperatur', 170, 300, 1, s.noz, '°C')}${slider('fan', 'Bauteillüfter', 0, 100, 5, s.fan, '%')}${slider('ret', 'Rückzug', 0, 6, 0.1, s.ret, 'mm', 1)}</div>
      <div id="fehOut"></div>${ueb()}`;
    fehShow();
  }
  $('#fehView').addEventListener('input', e => { const k = e.target.dataset.s; if (!k) return; S.feh[k] = +e.target.value; lsSet('feh', S.feh); setSv($('#fehView'), k, S.feh[k], k === 'bed' || k === 'noz' ? '°C' : k === 'fan' ? '%' : 'mm', k === 'ret' ? 1 : 0); fehShow(); });
  $('#fehView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.fm) S.feh = Object.assign({ mat: b.dataset.fm }, C.FSTART[b.dataset.fm]); else if (b.dataset.fo) S.feh = Object.assign({ mat: S.feh.mat }, C.FSTART[S.feh.mat]); else return;
    lsSet('feh', S.feh); renderFeh();
  });

  /* ============================================================ Überhang und Ausrichtung */
  function ausShow() {
    const s = S.aus, a = C.analyse(s.part, s.deg), best = C.bestAngle(s.part), ab = C.analyse(s.part, best);
    $('#vzAus').innerHTML = Z.ausSvg(s.part, s.deg, s.sup);
    let h = box('Überhang (Fläche zeigt nach unten, über 45° gegen die Senkrechte)', '', f(a.ueber, 1) + ' mm Kantenlänge', a.ueber > 0 ? 'bad' : 'ok') + box('Fläche, die Stützen füllen müssten (Seitenansicht)', '', f(a.stuetzA, 0) + ' mm²', a.stuetzA > 0 ? 'warn' : 'ok') +
      box('Stützmaterial bei 20 mm Tiefe', f(a.stuetzA, 0) + ' mm² · 20 mm', f(a.stuetzV, 2) + ' cm³') + box('Auflage auf der Platte', '', f(a.auf, 0) + ' mm') + box('Höhe und Schichten (0,2 mm)', f(a.h, 0) + ' mm / 0,2 mm', f(a.schichten, 0) + ' Schichten');
    h += best === s.deg ? note('Das ist schon die beste Drehung in 15°-Schritten: wenig Stützen, große Auflage.', 'ok') : note('Bei ' + f(best, 0) + '° braucht das Teil nur ' + f(ab.stuetzA, 0) + ' mm² Stützfläche und liegt mit ' + f(ab.auf, 0) + ' mm auf. Drehe dorthin und vergleiche, auch die Höhe: ' + f(ab.h, 0) + ' mm.', 'warn');
    $('#ausOut').innerHTML = h + '<p class="hint2">Die beste Drehung ist nur nach Stützen, Auflage und Höhe gewählt. Ob das Teil dann hält, hängt von der Belastungsrichtung ab: Quer zu den Schichten ist es am schwächsten.</p>';
    const r = $('[data-s="deg"]'); if (r && +r.value !== s.deg) r.value = s.deg; setSv($('#ausView'), 'deg', s.deg, '°');
  }
  function renderAus() {
    const s = S.aus;
    $('#ausView').innerHTML = `<div class="inst" id="vzAus"></div><div class="card pl"><h4>Überhang und Ausrichtung: Dreh das Teil auf der Platte</h4>
      <div class="fbar">${lbl('TEIL')}${seg('data-ap', C.TEILE.map(t => [t.k, t.n]), s.part)}</div>
      ${slider('deg', 'Drehung', 0, 345, 15, s.deg, '°')}<div class="fbar">${lbl('STÜTZEN ZEIGEN')}${seg('data-as', [['1', 'ja'], ['0', 'nein']], s.sup ? '1' : '0')}<button class="btn" data-ao="best">Beste Drehung</button></div></div>
      <div id="ausOut"></div>${ueb()}`;
    ausShow();
  }
  $('#ausView').addEventListener('input', e => { if (e.target.dataset.s !== 'deg') return; S.aus.deg = +e.target.value; lsSet('aus', S.aus); ausShow(); });
  $('#ausView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ap) S.aus.part = b.dataset.ap; else if (b.dataset.as) S.aus.sup = b.dataset.as === '1'; else if (b.dataset.ao) S.aus.deg = C.bestAngle(S.aus.part); else return;
    lsSet('aus', S.aus); renderAus();
  });

  /* ============================================================ Filamente */
  const STERNE = ['Festigkeit', 'Hitzebeständigkeit', 'Flexibilität', 'einfach zu drucken'];
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  function renderFil() {
    const m = C.filOf(S.fil.mat);
    $('#filView').innerHTML = `<div class="inst" id="vzFil">${Z.aufSvg()}</div><div class="card pl"><h4>Filamente: Wähle ein Material</h4><div class="fbar">${seg('data-fl', C.FIL.map(x => [x.k, x.n]), S.fil.mat)}</div></div>
      <div class="inst" id="vzTemp">${Z.tempSvg(m.k)}</div><div class="card pl">
      ${box('Düsentemperatur', '', f(m.nl, 0) + ' bis ' + f(m.nh, 0) + ' °C')}${box('Betttemperatur', '', f(m.bl, 0) + ' bis ' + f(m.bh, 0) + ' °C')}${box('Dichte', '', f(m.rho, 2) + ' g/cm³')}${box('Trocknen', '', f(m.dry[0], 0) + ' °C, ' + f(m.dry[1], 0) + ' h')}${box('Einhausung', '', m.box ? 'ja, geschlossen drucken' : 'nicht nötig')}
      <table class="tt"><tr><th>Eigenschaft</th><th>${esc(m.n)}</th></tr>${STERNE.map((n, i) => `<tr><td>${n}</td><td class="lv" style="font-size:16px">${stars(m.star[i])}</td></tr>`).join('')}</table>
      <ul class="tl">${m.info.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>${ueb()}`;
  }
  $('#filView').addEventListener('click', e => { const b = e.target.closest('[data-fl]'); if (!b) return; S.fil.mat = b.dataset.fl; lsSet('fil', S.fil); renderFil(); });

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
  const planHTML = q => `<div class="rdout"><span class="st">So gehst du vor</span><ol>${q.plan.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>`;
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
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${planHTML(q)}${qBody(q, a, r)}`;
      if (r) h += fbHTML(q, r);
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && (r.ok || r.stufe === 'loes') ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r && (r.ok || r.stufe === 'loes')) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`;
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
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
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p style="margin:8px 0">${esc(q.text)}</p>${planHTML(q)}${qBody(q, T.ans, T.res)}${T.res ? fbHTML(q, T.res) : ''}
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
  const BAMBU = [['Platte vorbereiten', 'Ansicht „Prepare“: Modell laden, platzieren, ausrichten, Profile wählen'], ['Vorschau', 'Ansicht „Preview“: Schichten, Wände, Füllung, Stützen und geschätzte Zeit ansehen'], ['Druckerprofil', 'Maschine: Bauraum, Düse, Plattentyp'], ['Filamentprofil', 'Material: Temperaturen, Fluss, Lüfter'], ['Prozessprofil', 'Wie gedruckt wird: Schichthöhe, Wände, Füllung, Stützen, Tempo'], ['Schichthöhe, Wände', 'Einstellungen im Prozessprofil (Qualität und Festigkeit)'], ['Füllung und Muster', 'Fülldichte in Prozent und Füllmuster (zum Beispiel Gyroid)'], ['Stützen', 'Typ normal oder Baumstützen (Tree Support), Abstand zum Teil'], ['Brim', 'Randzone an der ersten Schicht gegen Ablösen'], ['Mehrfarbe', 'Filamentwechsler, Spülturm (Prime Tower) für den Farbwechsel'], ['Kalibrierung', 'Abgleich von Fluss und erster Schicht nach Düsen- oder Materialwechsel'], ['Platte', 'glatte oder strukturierte PEI-Platte, bestimmt die Unterseite des Teils']];
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML = `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Ablauf vom Modell zum Teil', '<ol><li>Modell importieren und auf der Platte platzieren.</li><li>Teil ausrichten: wenig Überhang, große Auflage.</li><li>Profile prüfen: Drucker, Filament, Prozess.</li><li>Slicen und die Vorschau Schicht für Schicht prüfen.</li><li>Platte reinigen, Filament prüfen, drucken, erste Schichten beobachten.</li><li>Abkühlen lassen, Teil lösen, Stützen entfernen.</li></ol>', true) +
      sec('So heißt das in Bambu Studio', `<p>Im Betrieb wird mit Drucker und Slicer von Bambu Lab gearbeitet. Die Begriffe in diesem Lab sind allgemein, hier die Zuordnung:</p><table><tr><th>Begriff im Lab</th><th>In Bambu Studio</th></tr>${BAMBU.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table><p class="hint2">Genaue Menüpunkte und Namen können sich mit der Programmversion ändern. Sieh im Programm nach, wie sie bei dir heißen.</p>`) +
      sec('Rechnen', `<span class="eq">Schichten = Höhe / Schichthöhe</span><span class="eq">Masse (g) = Volumen (cm³) · Dichte (g/cm³)</span><span class="eq">Filamentlänge = Volumen / (π · d² / 4), mit d = 1,75 mm</span><span class="eq">Materialkosten = Masse in kg · Preis je kg</span><span class="eq">Stromkosten = Zeit in h · Leistung in kW · Preis je kWh</span><span class="eq">Füllung: nur der Innenraum zählt mit dem Prozentwert</span><span class="eq">Loch = Welle + Spiel (+ Ausgleich der Druckabweichung)</span>`) +
      sec('Fehlerbilder', `<table><tr><th>Bild</th><th>Ursache</th><th>Abhilfe</th></tr>${C.FEHLER.map(x => `<tr><td><b>${esc(x.n)}</b></td><td>${esc(x.ursache)}</td><td>${esc(x.abhilfe)}</td></tr>`).join('')}</table>`) +
      sec('Sicherheit', '<ul><li>Düse und Bett sind heiß: Verbrennungsgefahr, erst nach dem Abkühlen anfassen.</li><li>Achsen und Riemen quetschen: nicht hineingreifen, solange der Drucker läuft.</li><li>Dämpfe beim Schmelzen: gut lüften, bei ABS und ASA Absaugung oder Filter.</li><li>Stützen entfernen: Schutzbrille, Messer vom Körper weg.</li><li>Unbeaufsichtigt drucken nur, wenn die Betriebsanweisung es erlaubt.</li></ul>') +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'vor'; vorStop(); S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'vor') S.frac = 1;
    ({ vor: renderVor, feh: renderFeh, aus: renderAus, fil: renderFil, tasks: renderTasks, rt: renderTrainer, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = '3D-Druck-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = '3D-Druck-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('vor');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe und Formeln', 'Ablauf, Begriffe im Slicer, Rechnen, Fehlerbilder, Sicherheit'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.DRK_LAB = { id: 'drk', title: '3D-Druck-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.DRK_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'vor');
  /* Aufruf ?aufgabe=drk1 (Startseite, Lernhefte) öffnet die Aufgabe */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
