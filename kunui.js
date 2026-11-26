'use strict';
/* Tonfunk Kunststoff-Lab: Oberfläche (Lab-Kennung 'kun').
   ALLE Zahlen (Schwindung, Dichte, Dehnung, Zeiten, Kosten, Faustregeln) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   Reiter: Kunststoffe, Verfahren (animierter Spritzgießzyklus, Zykluszeit), Gestalten (Querschnitt mit Reglern), Schwindung, Verbindungen (Schnapphaken),
           Kosten (Spritzgießen gegen 3D-Druck), Begriffe, Aufgaben, Trainer, Beispiele, Hilfe.
   Module: kuncore.js (KUN_CORE), kundata.js (KUN_DATA, KUN_TASKS), kunviz.js (KUN_VIZ, Bilder und Animationen; vor dieser Datei geladen).
   Speicher (Präfix lm4.kun.): tab, stoff, verf, gest, mass, verb, kost, wiss, mt, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: kunlab.html?aufgabe=kun1 öffnet die Aufgabe, kunlab.html?bsp öffnet die Beispiele (?bsp=gest1 springt zu einem Beispiel). */
(function (root) {
  const C = root.KUN_CORE, D = root.KUN_DATA, V = root.KUN_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.kun.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s), sc = v => String(v).replace('.', ','), e2 = v => C.fmtDe(v, 2, true), fu = (v, u) => (u === '€' ? e2(v) : f(v, 2)) + ' ' + u;
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const reduziert = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Kunststoff-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">kuncore.js, kundata.js oder kunviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['stoff', '🧪', 'Kunststoffe'], ['verf', '⚙️', 'Verfahren'], ['gest', '📐', 'Gestalten'], ['mass', '📏', 'Schwindung'], ['verb', '🔗', 'Verbindungen'], ['kost', '💶', 'Kosten'], ['wiss', '🔤', 'Begriffe'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const SETKEYS = ['stoff', 'verf', 'gest', 'mass', 'verb', 'kost'];
  const MATK = C.MATS.map(m => m.k);
  const GEST0 = { s: 2.5, t: 2, a: 0.5, r: 0.5 };
  const S = {
    tab: lsGet('tab', 'gest'),
    stoff: Object.assign({ filt: 'alle', mat: 'PP', v: '24', n: '2000', a: '10' }, lsGet('stoff', {})),
    verf: Object.assign({ schl: '1,5', einspr: '1', nach: '4', kuehl: '12', oeffn: '1,5', ausw: '1', kav: '4', s: '2' }, lsGet('verf', {})),
    gest: Object.assign({}, GEST0, lsGet('gest', {})),
    mass: Object.assign({ mat: 'PP', lf: '120' }, lsGet('mass', {})),
    verb: Object.assign({ mat: 'ABS', l: '15', h: '1,5', y: '1' }, lsGet('verb', {})),
    kost: Object.assign({ w: '18000', k: '0,6', k3: '8,5', n: '3000' }, lsGet('kost', {})),
    wiss: Object.assign({ key: 'gest' }, lsGet('wiss', {})),
    mt: lsGet('mt', {}), mq: {},
    task: null, tq: null, tAns: {}, tRes: null, tFehl: {},
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  /* Gespeicherte Zustände prüfen */
  ['s', 't', 'a', 'r'].forEach(k => { if (!(typeof S.gest[k] === 'number' && Number.isFinite(S.gest[k]) && S.gest[k] >= 0 && S.gest[k] <= 8)) S.gest[k] = GEST0[k]; });
  if (!(S.gest.s >= 0.5)) S.gest.s = GEST0.s; if (!(S.gest.t >= 0.3)) S.gest.t = GEST0.t;
  if (!['alle', 'amorph', 'teil'].includes(S.stoff.filt)) S.stoff.filt = 'alle';
  [S.stoff, S.mass, S.verb].forEach(o => { if (!MATK.includes(o.mat)) o.mat = MATK[1]; });
  if (!SETKEYS.includes(S.wiss.key)) S.wiss.key = 'gest';
  if (!S.mt || typeof S.mt !== 'object') S.mt = {};
  SETKEYS.forEach(k => { if (!S.mt[k]) S.mt[k] = { n: 0, ok: 0 }; S.mq[k] = { i: -1, sel: -1 }; });
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (k, label, val, unit) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input data-k="${k}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  const matSel = (k, cur) => `<label class="f"><span>Kunststoff</span><select data-k="${k}">${C.MATS.map(m => `<option value="${m.k}"${m.k === cur ? ' selected' : ''}>${esc(m.k + ' (' + m.n + ')')}</option>`).join('')}</select></label>`;
  const UEB = 'Alle Zahlen in diesem Lab (Schwindung, Dichte, Dehnung, Zeiten, Kosten, Faustregeln) sind Übungswerte für die Ausbildung, nicht für die Praxis. Maßgebend sind Datenblätter, Normen und die Vorgaben deines Betriebs.';
  const lbl = t => `<span style="font-size:14px;color:var(--mute)">${esc(t)}</span>`;
  const XREF = (lab, txt) => `<p class="hint2">Siehe auch ${lab}: ${esc(txt)}</p>`;
  const stage = (id, html) => `<div class="kvz" id="${id}">${html}</div>`;

  /* ============================================================ Kunststoffe */
  function matTable(filt) {
    const rows = C.MATS.filter(m => filt === 'alle' || m.struk === filt);
    return `<div class="tw"><table class="tt"><tr><th>Kurzzeichen</th><th>Aufbau</th><th class="n">Dichte g/cm³</th><th class="n">Schwindung %</th><th>Eigenschaften</th><th>Typische Teile</th></tr>${rows.map(m => `<tr><td><b>${esc(m.k)}</b><br><small>${esc(m.n)}</small></td><td>${esc(C.STRUK[m.struk])}</td><td class="n">${f(m.rho, 2)}</td><td class="n">${f(m.smin, 1)} bis ${f(m.smax, 1)}</td><td>${esc(m.eig)}</td><td>${esc(m.use)}</td></tr>`).join('')}</table></div>`;
  }
  function stoffOut(s) {
    const m = C.matOf(s.mat), v = P(s.v), n = P(s.n), a = P(s.a), mg = C.partMass(v, m.rho), kg = C.granulateKg(mg, n, a);
    if (!Number.isFinite(mg) || !Number.isFinite(kg)) return note('Gib Volumen, Stückzahl und Zuschlag als Zahlen ein (Volumen größer als 0).');
    return box('Masse je Teil', f(v, 2) + ' cm³ · ' + f(m.rho, 2) + ' g/cm³', f(mg, 2) + ' g') + box('Granulat mit ' + f(a, 1) + ' % Zuschlag', f(mg, 2) + ' g · ' + f(n, 0) + ' · ' + f(1 + a / 100, 3) + ' / 1.000', f(kg, 2) + ' kg', 'ok');
  }
  function renderStoff() {
    const s = S.stoff;
    $('#stoffView').innerHTML = `<div class="card pl"><h4>Drei Gruppen von Kunststoffen</h4>${stage('vzGroups', V.groupsSvg())}<div class="tw"><table class="tt"><tr><th>Gruppe</th><th>Aufbau und Verhalten</th></tr>${C.GROUPS.map(g => `<tr><td><b>${esc(g.n)}</b></td><td>${esc(g.d)}</td></tr>`).join('')}</table></div></div>
      <div class="card pl"><h4>Thermoplaste: amorph oder teilkristallin</h4>${stage('vzStruk', V.strukSvg())}<p class="hint2">Amorph: ungeordnete Ketten, kann glasklar sein, schwindet wenig und gleichmäßig. Teilkristallin: teils geordnet, milchig, schwindet stärker und neigt zu Verzug.</p></div>
      <div class="card pl"><h4>Werkstofftabelle (Übungswerte)</h4><div class="fbar">${lbl('ZEIGEN')}<div class="seg">${[['alle', 'Alle'], ['amorph', 'amorph'], ['teil', 'teilkristallin']].map(o => `<button data-sf="${o[0]}" class="${s.filt === o[0] ? 'on' : ''}">${o[1]}</button>`).join('')}</div></div><div id="matTab">${matTable(s.filt)}</div></div>
      <div class="card pl"><h4>Recycling-Kennzeichen</h4><div class="rcg">${C.RCODES.map(r => `<div class="rc"><svg viewBox="0 0 60 56" aria-hidden="true"><path class="rctri" d="M30 4 L56 50 L4 50 Z"/><text x="30" y="40" class="rcn">${r[0]}</text></svg><span>${esc(r[1])}</span></div>`).join('')}</div><p class="hint2">Die Zahl im Dreieck zeigt den Kunststoff. Code 07 heißt „andere“: dazu gehören viele technische Kunststoffe. Auf Bauteilen steht oft zusätzlich das Kurzzeichen, zum Beispiel &gt;PP&lt;.</p></div>
      <div class="card pl"><h4>Granulat für einen Auftrag</h4><div class="dsrow">${matSel('mat', s.mat)}${inp('v', 'Volumen je Teil', s.v, 'cm³')}${inp('n', 'Stückzahl', s.n, 'Teile')}${inp('a', 'Zuschlag Anguss und Anfahren', s.a, '%')}</div><div id="stoffOut"></div></div>
      ${XREF('Werkstoff-Lab', 'Metalle, Zugversuch und Härteprüfung stehen dort.')}`;
    $('#stoffOut').innerHTML = stoffOut(s);
  }
  $('#stoffView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.stoff[k] = e.target.value; lsSet('stoff', S.stoff); $('#stoffOut').innerHTML = stoffOut(S.stoff); });
  $('#stoffView').addEventListener('change', e => { if (e.target.dataset.k === 'mat') { S.stoff.mat = e.target.value; lsSet('stoff', S.stoff); $('#stoffOut').innerHTML = stoffOut(S.stoff); } });
  $('#stoffView').addEventListener('click', e => { const b = e.target.closest('[data-sf]'); if (!b) return; S.stoff.filt = b.dataset.sf; lsSet('stoff', S.stoff); $$('[data-sf]').forEach(x => x.classList.toggle('on', x === b)); $('#matTab').innerHTML = matTable(S.stoff.filt); });

  /* ============================================================ Verfahren: animierter Zyklus */
  let cyPh = 0, cyTimer = null, cyOn = false;
  function cyShow(ph) {
    cyPh = ph; const sv = $('#vzZyk svg'); if (sv) sv.setAttribute('class', 'kv cyc ph-' + ph);
    const c = C.CYCLE[ph], tx = $('#cyTx'); if (tx) tx.innerHTML = `<b>Schritt ${ph + 1} von 6: ${esc(c.n)}</b><br>${esc(c.d)}`;
    const bar = $('#cyBar'); if (bar) bar.innerHTML = V.barSvg(verfPh(S.verf), ph);
  }
  function cyTick() { cyTimer = setTimeout(() => { cyShow((cyPh + 1) % 6); cyTick(); }, cyPh === 3 ? 2800 : 1800); }
  function cyPlay(on) {
    clearTimeout(cyTimer); cyTimer = null; cyOn = !!on; const b = $('[data-cy="play"]'); if (b) b.innerHTML = cyOn ? '⏸ Pause' : '▶ Abspielen';
    if (cyOn) cyTick();
  }
  const verfPh = s => { const o = {}; C.CYCLE.forEach(c => { o[c.k] = P(s[c.k]); }); return o; };
  function verfOut(s) {
    const ph = verfPh(s), tz = C.cycleTime(ph), kav = P(s.kav), tph = C.partsPerHour(tz, kav);
    if (!(tz > 0)) return note('Gib alle sechs Zeiten als Zahlen ein (0 oder mehr), die Summe muss größer als 0 sein.');
    if (!Number.isFinite(tph)) return box('Zykluszeit', C.CYCLE.map(c => f(ph[c.k], 1)).join(' + '), f(tz, 1) + ' s') + note('Gib die Zahl der Kavitäten ein (mindestens 1).');
    return box('Zykluszeit', C.CYCLE.map(c => f(ph[c.k], 1)).join(' + '), f(tz, 1) + ' s') + box('Teile je Stunde', '3.600 s / ' + f(tz, 1) + ' s · ' + f(kav, 0), f(tph, 0) + ' Teile', 'ok') + box('Anteil Kühlen', f(ph.kuehl, 1) + ' / ' + f(tz, 1) + ' · 100', f(ph.kuehl / tz * 100, 0) + ' %', 'warn');
  }
  function coolOut(s) {
    const w = P(s.s), t = C.coolTime(w); if (!Number.isFinite(t)) return note('Gib eine Wanddicke größer als 0 ein.');
    return box('Kühlzeit (Übungsregel t = 2 · s²)', '2 · ' + f(w, 1) + '²', f(t, 1) + ' s') + `<p class="hint2">Doppelte Wanddicke heißt vierfache Kühlzeit. Bei ${f(w * 2, 1)} mm wären es ${f(C.coolTime(w * 2), 1)} s.</p>`;
  }
  function renderVerf() {
    const s = S.verf;
    $('#verfView').innerHTML = `<div class="card pl"><h4>Spritzgießzyklus</h4>${stage('vzZyk', V.cycleSvg(cyPh))}<div class="rdout" id="cyTx"></div>
      <div class="btns"><button class="btn" data-cy="prev">⏮ Zurück</button><button class="btn pri" data-cy="play">▶ Abspielen</button><button class="btn" data-cy="next">Weiter ⏭</button></div>
      <p class="hint2">Die Schmelze fließt vom Anguss in die Mitte des Bodens und dann in die Wände. Beim Kühlen wird sie von orange (heiß) zu blau (fest). Danach fährt die bewegliche Hälfte mit dem Teil auf dem Kern auf und die Auswerfer stoßen es ab.</p></div>
      <div class="card pl"><h4>Zykluszeit und Teile je Stunde</h4><div class="mgrid">${C.CYCLE.map(c => inp(c.k, c.n, s[c.k], 's')).join('')}${inp('kav', 'Kavitäten', s.kav, '')}</div><div class="kvz" id="cyBar"></div><div id="verfOut"></div></div>
      <div class="card pl"><h4>Kühlzeit und Wanddicke</h4><div class="dsrow">${inp('s', 'Wanddicke', s.s, 'mm')}</div><div id="coolOut"></div></div>
      <div class="card pl"><h4>Verfahren im Vergleich (Übersicht)</h4><div class="tw"><table class="tt"><tr><th>Verfahren</th><th>Typische Teile</th><th>Stückzahl</th><th>Werkzeug</th><th>Art</th></tr>${C.PROC.map(p => `<tr><td><b>${esc(p.n)}</b></td><td>${esc(p.teil)}</td><td>${esc(p.menge)}</td><td>${esc(p.wz)}</td><td>${esc(p.art)}</td></tr>`).join('')}</table></div>
      <p class="hint2">Spritzgießen, Extrudieren und Blasformen sind Urformverfahren: Aus Granulat entsteht ein Teil. Tiefziehen formt eine fertige Platte um. Der 3D-Druck baut das Teil Schicht für Schicht auf.</p></div>`;
    $('#verfOut').innerHTML = verfOut(s); $('#coolOut').innerHTML = coolOut(s); cyShow(cyPh); cyPlay(!reduziert());
  }
  $('#verfView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.verf[k] = e.target.value; lsSet('verf', S.verf); $('#verfOut').innerHTML = verfOut(S.verf); $('#coolOut').innerHTML = coolOut(S.verf); $('#cyBar').innerHTML = V.barSvg(verfPh(S.verf), cyPh); });
  $('#verfView').addEventListener('click', e => {
    const b = e.target.closest('[data-cy]'); if (!b) return; const a = b.dataset.cy;
    if (a === 'play') { cyPlay(!cyOn); return; }
    cyPlay(false); cyShow((cyPh + (a === 'next' ? 1 : 5)) % 6);
  });

  /* ============================================================ Gestalten: Querschnitt mit Reglern */
  const GSL = [['s', 'Wanddicke s', 0.6, 6, 0.1, 'mm'], ['t', 'Rippendicke t am Fuß', 0.4, 6, 0.1, 'mm'], ['a', 'Entformungsschräge α', 0, 3, 0.25, '°'], ['r', 'Innenradius r', 0, 4, 0.1, 'mm']];
  function gestOut(p) {
    const c = C.designCheck(p); if (!c) return note('Ungültige Werte.');
    let h = c.ok ? note('✓ Alles im grünen Bereich: Rippe, Schräge, Radius und Wanddicke passen zu den Faustregeln.', 'ok') : c.issues.map(x => note((x.lvl === 'bad' ? '✗ ' : '⚠ ') + x.text, x.lvl === 'bad' ? 'bad' : 'warn')).join('');
    h += box('Rippendicke erlaubt (0,5 bis 0,7 · s)', '', f(c.ribMin, 2) + ' bis ' + f(c.ribMax, 2) + ' mm, jetzt t / s = ' + f(c.ratio, 2), c.ratio > 0.7 + 1e-9 ? 'bad' : '');
    h += box('Innenradius mindestens 0,5 · s', '', f(c.rMin, 2) + ' mm, Außenradius r + s = ' + f(c.rOut, 2) + ' mm');
    h += box('Kühlzeit (Übungsregel 2 · s²)', '2 · ' + f(p.s, 1) + '²', f(c.cool, 1) + ' s');
    return h;
  }
  function gestUpdate() {
    const p = S.gest; $('#formStage').innerHTML = V.formSvg(p); $('#gestOut').innerHTML = gestOut(p);
    GSL.forEach(g => { const el = $('#gv_' + g[0]); if (el) el.textContent = f(p[g[0]], 2) + ' ' + g[5]; });
  }
  function renderGest() {
    const p = S.gest;
    $('#gestView').innerHTML = `<div class="cols"><div><div class="card pl"><h4>Gehäusedeckel im Schnitt</h4>${stage('formStage', '')}<p class="hint2">Bewege die Regler. Die Prüfung zeigt sofort, was passiert: Delle über einer zu dicken Rippe (Einfallstelle), Teil hängt am Kern (keine Schräge), rote Ringe an scharfen Ecken (Kerbe).</p></div></div>
      <div><div class="card pl"><h4>Regler</h4>${GSL.map(g => `<label class="f"><span>${esc(g[1])}: <b id="gv_${g[0]}"></b></span><input type="range" data-g="${g[0]}" min="${g[2]}" max="${g[3]}" step="${g[4]}" value="${p[g[0]]}" aria-label="${esc(g[1])}"></label>`).join('')}
      <div class="btns"><button class="btn" data-gp="bad">Schlechter Entwurf</button><button class="btn" data-gp="good">Guter Entwurf</button></div><div id="gestOut"></div></div></div></div>
      <details class="dt"><summary>Faustregeln für Spritzgussteile (Übungswerte)</summary><div class="hb2"><ul><li><b>Wanddicke</b> möglichst gleichmäßig, etwa 1 bis 4 mm. Dicke Stellen kühlen langsam und fallen ein.</li><li><b>Rippen</b> statt dicker Wände: 0,5 bis 0,7 · Wanddicke am Fuß, Höhe bis etwa 3 · Wanddicke.</li><li><b>Entformungsschräge</b> mindestens 0,5°, bei rauer (genarbter) Oberfläche mehr.</li><li><b>Radien</b> innen mindestens 0,5 · Wanddicke, außen Innenradius + Wanddicke.</li><li><b>Dome</b> nicht massiv, mit Rippen an die Wand anbinden.</li></ul></div></details>
      <details class="dt"><summary>Hinterschnitt, Anguss und Bindenaht</summary><div class="hb2"><p><b>Hinterschnitt:</b> Eine Form, die in Öffnungsrichtung festhakt (seitliches Loch, Schnapphaken). Ein Hinterschnitt braucht einen Schieber und macht das Werkzeug teurer. Oft lässt sich die Form so ändern, dass sie ohne Schieber auskommt.</p><p><b>Anguss:</b> an der dicksten Stelle, damit die Schmelze von dick nach dünn fließt und der Nachdruck wirkt. Nicht auf Sichtflächen.</p><p><b>Bindenaht:</b> Hinter Löchern treffen zwei Schmelzefronten aufeinander. Die Naht ist sichtbar und schwächer. Mit der Angusslage legt man sie in Bereiche ohne Last.</p></div></details>
      ${XREF('Konstruktions-Lab', 'Allgemeines zum fertigungsgerechten Konstruieren und zu Gussteilen aus Metall steht dort.')}`;
    gestUpdate();
  }
  $('#gestView').addEventListener('input', e => { const k = e.target.dataset.g; if (!k) return; const v = parseFloat(e.target.value); if (!Number.isFinite(v)) return; S.gest[k] = v; lsSet('gest', S.gest); gestUpdate(); });
  $('#gestView').addEventListener('click', e => {
    const b = e.target.closest('[data-gp]'); if (!b) return;
    S.gest = b.dataset.gp === 'bad' ? { s: 2.5, t: 2.5, a: 0, r: 0 } : { s: 2.5, t: 1.5, a: 1, r: 1.3 }; lsSet('gest', S.gest);
    $$('[data-g]').forEach(i => { i.value = S.gest[i.dataset.g]; }); gestUpdate();
  });

  /* ============================================================ Schwindung */
  function massOut(s) {
    const m = C.matOf(s.mat), lf = P(s.lf), lw = C.moldSize(lf, m.s);
    if (!Number.isFinite(lw)) return note('Gib das Fertigmaß als Zahl größer als 0 ein.');
    const a = C.partSize(lw, m.smax), b = C.partSize(lw, m.smin);
    return box('Werkzeugmaß (Rechenwert ' + f(m.s, 1) + ' %)', f(lf, 2) + ' / (1 − ' + f(m.s / 100, 3) + ')', f(lw, 2) + ' mm', 'ok') +
      box('Fertigmaß schwankt (Schwindung ' + f(m.smin, 1) + ' bis ' + f(m.smax, 1) + ' %)', '', f(a, 2) + ' bis ' + f(b, 2) + ' mm, also ' + f(C.shrinkSpread(lw, m.smin, m.smax), 2) + ' mm', m.smax - m.smin > 0.5 ? 'warn' : '') +
      `<p class="hint2">${esc(m.k)} ist ${esc(C.STRUK[m.struk])}. ${m.struk === 'amorph' ? 'Kleine, gleichmäßige Schwindung: gut für enge Maße.' : 'Große Schwindung mit breiter Streuung: Verzug und Maßschwankung einplanen.'}</p>`;
  }
  function massUpdate() {
    const s = S.mass, m = C.matOf(s.mat), lw = C.moldSize(P(s.lf), m.s);
    $('#massOut').innerHTML = massOut(s); $('#vzShr').innerHTML = Number.isFinite(lw) ? V.shrinkSvg({ lw, s: m.s, smin: m.smin, smax: m.smax }) : '';
  }
  function renderMass() {
    const s = S.mass;
    $('#massView').innerHTML = `<div class="card pl"><h4>Werkzeugmaß aus dem Fertigmaß</h4>${stage('vzShr', '')}<div class="dsrow">${matSel('mat', s.mat)}${inp('lf', 'Fertigmaß laut Zeichnung', s.lf, 'mm')}</div><div id="massOut"></div>
      <span class="eq2">S = (L_W − L_F) / L_W · 100 %  ·  L_W = L_F / (1 − S/100)  ·  L_F = L_W · (1 − S/100)</span></div>
      <div class="card pl"><h4>Schwindung der Werkstoffe (Übungswerte)</h4><div class="tw"><table class="tt"><tr><th>Kunststoff</th><th>Aufbau</th><th class="n">Bandbreite %</th><th class="n">Rechenwert %</th></tr>${C.MATS.map(m => `<tr><td><b>${esc(m.k)}</b></td><td>${esc(C.STRUK[m.struk])}</td><td class="n">${f(m.smin, 1)} bis ${f(m.smax, 1)}</td><td class="n">${f(m.s, 1)}</td></tr>`).join('')}</table></div><p class="hint2">Die echte Schwindung hängt von Typ, Füllstoff, Wanddicke, Fließrichtung und Verarbeitung ab. Der Werkzeugbau nimmt die Werte aus dem Datenblatt und aus Mustern.</p></div>
      <details class="dt"><summary>Verzug</summary><div class="hb2"><p>Schwinden Bereiche eines Teils unterschiedlich stark, entstehen Spannungen und das Teil verbiegt sich. Ursachen: ungleiche Wanddicke, ungleiche Kühlung, ausgerichtete Glasfasern (längs weniger Schwindung als quer). Abhilfe: gleichmäßige Wände, Rippen statt Masse, gleichmäßige Kühlung.</p></div></details>
      <details class="dt"><summary>Toleranzen bei Kunststoffteilen</summary><div class="hb2"><p>Für Kunststoff-Formteile gibt es eine eigene Toleranznorm (DIN ISO 20457, früher DIN 16742). Die Toleranzen sind größer als bei gefrästen Metallteilen, weil die Schwindung streut. Maße in einer Werkzeughälfte sind genauer als Maße über die Trennebene oder über Schieber.</p></div></details>
      ${XREF('Toleranz-Lab', 'ISO-Passungen und Maßketten stehen dort.')}`;
    massUpdate();
  }
  $('#massView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k || k === 'mat') return; S.mass[k] = e.target.value; lsSet('mass', S.mass); massUpdate(); });
  $('#massView').addEventListener('change', e => { if (e.target.dataset.k === 'mat') { S.mass.mat = e.target.value; lsSet('mass', S.mass); massUpdate(); } });

  /* ============================================================ Verbindungen: Schnapphaken */
  const verbP = s => ({ l: P(s.l), h: P(s.h), y: P(s.y), eps: C.matOf(s.mat).eps });
  function verbOut(s) {
    const p = verbP(s), e = C.snapStrain(p.h, p.y, p.l), ym = C.snapMaxY(p.h, p.l, p.eps);
    if (!Number.isFinite(e)) return note('Gib Länge, Dicke (beide größer als 0) und Hinterschnitt als Zahlen ein.');
    const ok = e <= p.eps + 1e-9;
    return box('Dehnung am Fuß', '1,5 · ' + f(p.h, 2) + ' · ' + f(p.y, 2) + ' / ' + f(p.l, 1) + '² · 100 %', f(e, 2) + ' %', ok ? 'ok' : 'bad') +
      box('zulässig für ' + s.mat + ' (einmaliges Fügen, Übungswert)', '', f(p.eps, 1) + ' %') +
      box('größter Hinterschnitt', f(p.eps / 100, 3) + ' · ' + f(p.l, 1) + '² / (1,5 · ' + f(p.h, 2) + ')', f(ym, 2) + ' mm') +
      (ok ? note('✓ Der Haken hält das Einrasten aus.', 'ok') : note('✗ Zu viel Dehnung: Der Haken kann brechen. Länger, dünner oder weniger Hinterschnitt.', 'bad'));
  }
  function verbUpdate() { const s = S.verb, p = verbP(s); $('#verbOut').innerHTML = verbOut(s); $('#vzSnap').innerHTML = V.snapSvg(p, { anim: !reduziert() }); }
  function renderVerb() {
    const s = S.verb;
    $('#verbView').innerHTML = `<div class="cols"><div><div class="card pl"><h4>Schnapphaken beim Fügen</h4>${stage('vzSnap', '')}<p class="hint2">Der Deckel fährt herunter. An der Kante federt der Haken zur Seite aus und rastet dahinter ein. Grün: Die Dehnung bleibt im zulässigen Bereich. Rot: zu viel.</p></div></div>
      <div><div class="card pl"><h4>Haken rechnen</h4><div class="dsrow">${matSel('mat', s.mat)}${inp('l', 'Länge l', s.l, 'mm')}${inp('h', 'Dicke h am Fuß', s.h, 'mm')}${inp('y', 'Hinterschnitt y', s.y, 'mm')}</div><div id="verbOut"></div><p class="hint2">Formel für einen Haken mit gleichbleibendem Rechteckquerschnitt: ε = 1,5 · h · y / l² · 100 %. Ein langer, dünner Haken federt leichter.</p></div></div></div>
      <details class="dt"><summary>Filmscharnier</summary><div class="hb2"><p>Eine sehr dünne, mitgespritzte Stelle (wenige Zehntelmillimeter), an der sich zwei Teile klappen lassen. Meist aus PP. Direkt nach dem Entformen einige Male biegen: Die Ketten richten sich aus und das Scharnier hält dauerhaft.</p></div></details>
      <details class="dt"><summary>Einlegeteile und Gewindeeinsätze</summary><div class="hb2"><p>Metallteile (zum Beispiel Gewindebuchsen aus Messing) werden ins Werkzeug gelegt und umspritzt oder nachträglich warm eingesetzt. Für Schrauben, die oft gelöst werden.</p></div></details>
      <details class="dt"><summary>Ultraschallschweißen</summary><div class="hb2"><p>Schwingungen erwärmen die Fügestelle zweier Thermoplast-Teile in Sekunden, die Flächen schmelzen und verbinden sich dicht. Ein dreieckiger Grat (Energierichtungsgeber) bündelt die Energie. Duroplaste lassen sich nicht schweißen.</p></div></details>
      <details class="dt"><summary>Kleben</summary><div class="hb2"><p>Verbindet auch verschiedene Werkstoffe. PE und PP sind schwer zu kleben und brauchen eine Vorbehandlung der Oberfläche (zum Beispiel Plasma oder Beflammen). Aushärtezeit einplanen; die Verbindung ist nicht lösbar.</p></div></details>`;
    verbUpdate();
  }
  $('#verbView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k || k === 'mat') return; S.verb[k] = e.target.value; lsSet('verb', S.verb); verbUpdate(); });
  $('#verbView').addEventListener('change', e => { if (e.target.dataset.k === 'mat') { S.verb.mat = e.target.value; lsSet('verb', S.verb); verbUpdate(); } });

  /* ============================================================ Kosten */
  const kostP = s => ({ w: P(s.w), k: P(s.k), k3: P(s.k3), n: P(s.n) });
  function kostOut(p) {
    if (![p.w, p.k, p.k3, p.n].every(v => Number.isFinite(v) && v >= 0) || !(p.n > 0)) return note('Gib Werkzeugkosten, beide Stückkosten und eine Menge größer als 0 ein.');
    const sg = C.totalCost(p.w, p.k, p.n), dr = C.totalCost(0, p.k3, p.n), be = C.breakEvenN(p.w, p.k, p.k3);
    return box('Spritzgießen gesamt', e2(p.w) + ' + ' + e2(p.k) + ' · ' + f(p.n, 0), e2(sg) + ' €') + box('3D-Druck gesamt', e2(p.k3) + ' · ' + f(p.n, 0), e2(dr) + ' €') +
      box('Spritzguss je Teil mit Werkzeuganteil', e2(p.w) + ' / ' + f(p.n, 0) + ' + ' + e2(p.k), e2(C.unitCost(p.w, p.k, p.n)) + ' €') +
      (Number.isFinite(be) ? box('Spritzgießen ist billiger ab', e2(p.w) + ' / (' + e2(p.k3) + ' − ' + e2(p.k) + '), aufgerundet', f(be, 0) + ' Teilen', sg < dr ? 'ok' : 'warn') : note('Kein Gleichstand: Der 3D-Druck ist je Teil nicht teurer als das Spritzgussteil.')) +
      note(sg < dr ? 'Bei ' + f(p.n, 0) + ' Teilen ist Spritzgießen billiger.' : 'Bei ' + f(p.n, 0) + ' Teilen ist der 3D-Druck billiger.', sg < dr ? 'ok' : 'warn');
  }
  function kostUpdate() { const p = kostP(S.kost); $('#kostOut').innerHTML = kostOut(p); $('#vzCost').innerHTML = V.costSvg(p); }
  function renderKost() {
    const s = S.kost;
    $('#kostView').innerHTML = `<div class="card pl"><h4>Spritzgießen oder 3D-Druck</h4>${stage('vzCost', '')}<div class="dsrow">${inp('w', 'Werkzeugkosten', s.w, '€')}${inp('k', 'Spritzgussteil je Stück', s.k, '€')}${inp('k3', '3D-Druck je Stück', s.k3, '€')}${inp('n', 'Stückzahl', s.n, 'Teile')}</div><div id="kostOut"></div>
      <span class="eq2">Gesamt = Werkzeug + Stückkosten · Menge  ·  Gleichstand n = Werkzeug / (k_3D − k_SG)</span></div>
      <details class="dt"><summary>Was das Spritzgussteil billiger macht</summary><div class="hb2"><ul><li>Mehr Kavitäten: mehr Teile je Zyklus.</li><li>Dünne, gleichmäßige Wände: kürzere Kühlzeit.</li><li>Keine Hinterschnitte: kein Schieber im Werkzeug.</li><li>Nicht zu enge Toleranzen.</li></ul></div></details>`;
    kostUpdate();
  }
  $('#kostView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.kost[k] = e.target.value; lsSet('kost', S.kost); kostUpdate(); });

  /* ============================================================ Begriffe (Zuordnungsübung) */
  function renderWiss() {
    const key = S.wiss.key, set = D.sets[key];
    let h = `<div class="fbar">${lbl('THEMA')}<div class="seg" style="flex-wrap:wrap">${SETKEYS.map(k => `<button data-wk="${k}" class="${k === key ? 'on' : ''}">${esc(D.sets[k].title)}</button>`).join('')}</div></div>
      <div class="card pl"><h4>Zuordnungsübung: ${esc(set.title)}</h4><div id="mq"></div></div><div class="dt">`;
    let last = '';
    set.items.forEach(o => {
      if (o.g !== last) { if (last) h += '</div>'; last = o.g; h += `<div class="gh">${esc(o.g)}</div><div>`; }
      h += `<details><summary>${esc(o.n)}</summary><div class="hb2"><p>${esc(o.d)}</p>${o.pts.length ? '<ul>' + o.pts.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : ''}</div></details>`;
    });
    $('#wissView').innerHTML = h + '</div></div>';
    if (S.mq[key].i < 0) newMQ(key); else renderMQ(key);
  }
  function newMQ(key) { S.mq[key] = { i: Math.floor(R0() * D.sets[key].items.length), sel: -1 }; renderMQ(key); }
  function renderMQ(key) {
    const set = D.sets[key], q = S.mq[key], o = set.items[q.i], pool = set.items.filter(x => x.g === o.g), opts = C.shuffle(C.rng(key + q.i + ':' + S.mt[key].n), pool), done = q.sel >= 0;
    const el = $('#mq'); if (!el) return;
    el.innerHTML = `<p style="margin-top:0">${esc(set.prompt)} <b>${esc(o.d)}</b></p><div class="opts">${opts.map(x => `<button data-on="${esc(x.n)}" class="${done ? (x === o ? 'ok' : set.items[q.sel] === x ? 'bad' : '') : ''}" ${done ? 'disabled' : ''}>${esc(x.n)}</button>`).join('')}</div>
      <p class="hint2">Richtig: <b>${S.mt[key].ok}</b> von <b>${S.mt[key].n}</b></p>${done ? '<div class="btns"><button class="btn pri" data-on="__next">Nächste Frage</button></div>' : ''}`;
  }
  $('#wissView').addEventListener('click', e => {
    const wk = e.target.closest('[data-wk]'), b = e.target.closest('[data-on]'), key = S.wiss.key;
    if (wk) { S.wiss.key = wk.dataset.wk; lsSet('wiss', S.wiss); renderWiss(); return; }
    if (!b) return;
    if (b.dataset.on === '__next') { newMQ(key); return; }
    const set = D.sets[key], i = set.items.findIndex(x => x.n === b.dataset.on), right = i === S.mq[key].i;
    S.mq[key].sel = i; S.mt[key].n++; if (right) { S.mt[key].ok++; ding(); } else sad(); lsSet('mt', S.mt); renderMQ(key);
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
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : fu(q.value, q.ask.unit));
  /* „So gehst du vor“ und Bild zur Aufgabe */
  const stepsHTML = q => q.steps && q.steps.length ? `<div class="steps"><b>So gehst du vor:</b><ol>${q.steps.map(x => '<li>' + esc(x) + '</li>').join('')}</ol></div>` : '';
  const imgHTML = q => (q.img ? V.img(q.img) : '');
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
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: fu(v, q.ask.unit) };
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
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${imgHTML(q)}${stepsHTML(q)}${qBody(q, a, r)}`;
      if (r) h += fbHTML(q, r);
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && (r.ok || r.stufe === 'loes') ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r && (r.ok || r.stufe === 'loes')) { h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
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
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p style="margin:8px 0">${esc(q.text)}</p>${imgHTML(q)}${stepsHTML(q)}${qBody(q, T.ans, T.res)}${T.res ? fbHTML(q, T.res) : ''}
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
    if (e.tab === 'gest') return `<div class="kvz">${V.formSvg(p, { plain: false })}</div>` + gestOut(p);
    if (e.tab === 'verf') { const s = {}; Object.keys(p).forEach(k => { s[k] = sc(p[k]); }); return `<div class="kvz">${V.barSvg(p, -1)}</div>` + verfOut(s); }
    if (e.tab === 'mass') { const m = C.matOf(p.mat), lw = C.moldSize(p.lf, m.s); return `<div class="kvz">${V.shrinkSvg({ lw, s: m.s, smin: m.smin, smax: m.smax }, { plain: true })}</div>` + massOut({ mat: p.mat, lf: sc(p.lf) }); }
    if (e.tab === 'verb') return `<div class="kvz">${V.snapSvg({ l: p.l, h: p.h, y: p.y, eps: C.matOf(p.mat).eps })}</div>` + verbOut({ mat: p.mat, l: sc(p.l), h: sc(p.h), y: sc(p.y) });
    return `<div class="kvz">${V.costSvg(p, { plain: false })}</div>` + kostOut(p);
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele (Übungswerte). Mit „In den Rechner laden“ öffnest du die Zahlen im passenden Reiter und kannst sie verändern.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" data-ex="${e.id}">In den Rechner laden</button></div></div>`).join('');
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex), p = x.p;
    if (x.tab === 'gest') { S.gest = { s: p.s, t: p.t, a: p.a, r: p.r }; lsSet('gest', S.gest); }
    else if (x.tab === 'verf') { Object.keys(p).forEach(k => { S.verf[k] = sc(p[k]); }); lsSet('verf', S.verf); }
    else if (x.tab === 'mass') { S.mass = { mat: p.mat, lf: sc(p.lf) }; lsSet('mass', S.mass); }
    else if (x.tab === 'verb') { S.verb = { mat: p.mat, l: sc(p.l), h: sc(p.h), y: sc(p.y) }; lsSet('verb', S.verb); }
    else { S.kost = { w: sc(p.w), k: sc(p.k), k3: sc(p.k3), n: sc(p.n) }; lsSet('kost', S.kost); }
    setTab(x.tab); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<p class="hint2">⚠ ${esc(UEB)}</p>` +
      sec('Kunststoffe kennen', `<table><tr><th>Gruppe</th><th>Aufbau</th><th>Verhalten bei Wärme</th></tr><tr><td>Thermoplast</td><td>nicht vernetzt</td><td>wird weich, schmelzbar, schweißbar</td></tr><tr><td>Duroplast</td><td>eng vernetzt</td><td>bleibt hart, zersetzt sich</td></tr><tr><td>Elastomer</td><td>weit vernetzt</td><td>gummielastisch, nicht schmelzbar</td></tr></table><p><b>Amorph</b> (PC, PMMA, ABS): kann glasklar sein, kleine Schwindung. <b>Teilkristallin</b> (PE, PP, PA, POM): milchig, größere Schwindung, Verzug möglich.</p><span class="eq">Masse = Volumen · Dichte</span><span class="eq">Granulat = Masse je Teil · Stückzahl · (1 + Zuschlag / 100)</span><p>Recycling-Codes: ${esc(C.RCODES.map(r => r[0] + ' ' + r[1]).join(', '))}.</p>`, true) +
      sec('Urformverfahren', `<p>Spritzgießzyklus: ${esc(C.CYCLE.map((c, i) => (i + 1) + '. ' + c.n).join(', '))}.</p><span class="eq">Zykluszeit = Summe aller Schrittzeiten</span><span class="eq">Teile je Stunde = 3.600 s / Zykluszeit · Kavitäten</span><span class="eq">Kühlzeit (Übungsregel) t = 2 · s² (s in mm, t in s)</span><span class="eq">Druckzeit FDM = Schichten (Höhe / Schichthöhe, aufgerundet) · Zeit je Schicht</span><p>Extrudieren: endlose Profile. Blasformen: Hohlkörper. Tiefziehen: Schalen aus Platten (Umformen von Halbzeug). 3D-Druck (FDM): Schicht für Schicht, ohne Werkzeug, quer zu den Schichten schwächer.</p>`) +
      sec('Spritzgussgerecht konstruieren', `<span class="eq">Rippendicke = 0,5 bis 0,7 · Wanddicke</span><span class="eq">Innenradius ≥ 0,5 · Wanddicke, Außenradius = Innenradius + Wanddicke</span><span class="eq">Breitenunterschied durch Schräge = 2 · Tiefe · tan α</span><span class="eq">Schraubdom (Übung): außen 2 · d, Kernloch 0,8 · d</span><p>Fehlerbilder: <b>Einfallstelle</b> (Masseanhäufung), <b>Bindenaht</b> (Schmelzefronten treffen sich), <b>Verzug</b> (ungleiche Schwindung), <b>Kratzer und Hängenbleiben</b> (keine Schräge), <b>Riss an der Ecke</b> (Kerbwirkung). Hinterschnitte brauchen Schieber.</p>`) +
      sec('Schwindung und Maße', `<span class="eq">S = (L_W − L_F) / L_W · 100 %</span><span class="eq">L_W = L_F / (1 − S/100)</span><span class="eq">L_F = L_W · (1 − S/100)</span><span class="eq">Schwankung = L_W · (S_max − S_min) / 100</span><p>Manche Bücher rechnen vereinfacht L_W = L_F · (1 + S/100); bei kleiner Schwindung ist der Unterschied gering. Toleranzen für Kunststoff-Formteile: DIN ISO 20457 (früher DIN 16742).</p>`) +
      sec('Verbindungen', `<span class="eq">Dehnung Schnapphaken ε = 1,5 · h · y / l² · 100 %</span><span class="eq">größter Hinterschnitt y = ε/100 · l² / (1,5 · h)</span><table><tr><th>Verbindung</th><th>lösbar</th><th>Hinweis</th></tr><tr><td>Schnapphaken</td><td>ja</td><td>wird mitgespritzt</td></tr><tr><td>Schraube mit Gewindeeinsatz</td><td>ja</td><td>für häufiges Lösen</td></tr><tr><td>Filmscharnier</td><td>beweglich</td><td>meist PP</td></tr><tr><td>Ultraschallschweißen</td><td>nein</td><td>nur Thermoplaste</td></tr><tr><td>Kleben</td><td>nein</td><td>PE und PP vorbehandeln</td></tr></table>`) +
      sec('Kosten', `<span class="eq">Gesamtkosten = Werkzeug + Stückkosten · Menge</span><span class="eq">Kosten je Teil = Werkzeug / Menge + Stückkosten</span><span class="eq">Gleichstand n = Werkzeug / (k_3D − k_SG), aufrunden</span><span class="eq">Maschinenzeit = Zyklen (Menge / Kavitäten, aufgerundet) · Zykluszeit / 3.600</span>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte. Firma und Produkte sind frei erfunden.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'gest'; if (t !== 'verf') cyPlay(false); S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ stoff: renderStoff, verf: renderVerf, gest: renderGest, mass: renderMass, verb: renderVerb, kost: renderKost, wiss: renderWiss, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Kunststoff-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Kunststoff-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('gest');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe und Formeln', 'Kunststoffe, Verfahren, Gestalten, Schwindung, Verbindungen, Kosten'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt', 'mt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; SETKEYS.forEach(k => { S.mt[k] = { n: 0, ok: 0 }; }); S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.KUN_LAB = { id: 'kun', title: 'Kunststoff-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.KUN_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'gest');
  /* Aufruf ?aufgabe=kun1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=gest1 springt zu einem Beispiel) */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
