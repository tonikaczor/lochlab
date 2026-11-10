'use strict';
/* Tonfunk Fertigungs-Lab: Oberfläche (Lab-Kennung 'fer').
   ALLE Werte (Kernlöcher, Zuschläge, Dichten, Grenzwerte) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Planung echter Aufträge.
   Reiter: Verfahren (Landkarte DIN 8580), Biegen (gestreckte Länge), Gewinde und Bohren, Planung und Kosten (Stange, Tafel, Zeit, Kosten, Vergleich), Qualität (Mittelwert, Streuung, Fähigkeit, Regelkarte),
   Vorrichtung (3-2-1), Aufgaben, Trainer, Beispiele, Hilfe.
   Module: fercore.js (FER_CORE), ferdata.js (FER_DATA, FER_TASKS), ferviz.js (FER_VIZ: Skizzen).
   Speicher (Präfix lm4.fer.): tab, ver, bie, gew, pla, qua, vor, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Stabile Kennungen für die zentrale Tour: Reiter #tab-<k> mit data-tab, Eingaben #in-<reiter>-<feld>, Ausgaben #out-<reiter>, Hilfe #bHelp, Aufgaben #bTasks, Prüfmodus #bExam, Trainer-Knöpfe #btn-rt-*.
   Aufruf: ferlab.html?aufgabe=fer1 öffnet die Aufgabe, ferlab.html?bsp öffnet die Beispiele (?bsp=bie1 springt zu einem Beispiel). */
(function (root) {
  const C = root.FER_CORE, D = root.FER_DATA, V = root.FER_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.fer.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s);
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fin = Number.isFinite;
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Fertigungs-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">fercore.js, ferdata.js oder ferviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['ver', '🗺️', 'Verfahren'], ['bie', '📐', 'Biegen'], ['gew', '🔩', 'Gewinde & Bohren'], ['pla', '🧮', 'Planung & Kosten'], ['qua', '📊', 'Qualität'], ['vor', '📍', 'Vorrichtung'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const DEF_QUA = () => D.sampleSet('gut').map(v => C.fmtDe(v, 4)).join(' ');
  const S = {
    tab: lsGet('tab', 'ver'),
    ver: Object.assign({ g: 0 }, lsGet('ver', {})),
    bie: Object.assign({ mode: 'out', s: '3', r: '3', a: '60', b: '40', c: '', l1: '40', l2: '30', al: '90' }, lsGet('bie', {})),
    gew: Object.assign({ d: '8', T: '', D: '10' }, lsGet('gew', {})),
    pla: Object.assign({ view: 'stange', L: '3000', l: '85', k: '3', W: '1000', H: '2000', w: '180', h: '250', e: '10', rr: '10', s: '3', mat: 'Stahl', th: '6', tn: '2', zE: '5', zV: '10', tr: '45', m: '25', satz: '60', matk: '2,40', kr1: '30', kv1: '4', kr2: '180', kv2: '2,5' }, lsGet('pla', {})),
    qua: Object.assign({ txt: DEF_QUA(), ugw: '19,9', ogw: '20,1' }, lsGet('qua', {})),
    vor: Object.assign({ a: 3, b: 2, c: 1 }, lsGet('vor', {})),
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (!(S.ver.g >= 0 && S.ver.g <= 6)) S.ver.g = 0;
  if (!['out', 'gerade'].includes(S.bie.mode)) S.bie.mode = 'out';
  if (!C.thread(+P(S.gew.d))) S.gew.d = '8';
  if (!['stange', 'tafel', 'kosten', 'vergleich'].includes(S.pla.view)) S.pla.view = 'stange';
  if (!['Stahl', 'Aluminium'].includes(S.pla.mat)) S.pla.mat = 'Stahl';
  ['a', 'b', 'c'].forEach((k, i) => { S.vor[k] = Math.max(0, Math.min([4, 3, 2][i], Math.round(+S.vor[k]) || 0)); });
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (tab, k, label, val, unit) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input id="in-${tab}-${k}" data-k="${k}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  /* PRUEFEN P21: Der Hinweis zu Übungswerten gilt für das ganze Lab (Gewindetabelle, Zuschläge, Dichten, Rand und Steg beim Schachteln, Fähigkeitsgrenzen). Reicht der Wortlaut, oder soll er für die Berufsschule angepasst werden? */
  const UEB = 'Alle Werte in diesem Lab (Kernlöcher, Zuschläge, Dichten, Rand und Steg beim Schachteln, Grenzwerte der Fähigkeit) sind Übungswerte für die Ausbildung, nicht für die Planung echter Aufträge. Maßgebend sind Tabellenbuch, Zeichnung, Arbeitsplan und die Vorgaben deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const seg = (attr, opts, cur, idp) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}"${idp ? ` id="${idp}-${esc(o[0])}"` : ''} class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const sel = (id, k, opts, cur) => `<select id="${id}" data-k="${k}">${opts.map(o => `<option value="${esc(o[0])}"${String(cur) === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  const inst = s => `<div class="inst">${s}</div>`;
  const gtag = g => `<span class="gtag" style="background:var(--c${g.col})">${g.n} ${esc(g.t)}</span>`;
  const keep = (id, fn) => { const el = $(id); if (el) el.innerHTML = fn(); };

  /* ============================================================ Verfahren (Landkarte) */
  function verHtml(g) {
    const grp = g ? C.group(g) : null;
    let h = `<div id="landkarte" class="inst">${V.landkarte(g || 0)}</div>`;
    if (!grp) return h + `<div class="rdout">Tippe auf eine der sechs Hauptgruppen, um zu sehen, was dazugehört. Oder tippe unten auf ein Verfahren: Dann leuchtet seine Hauptgruppe auf.</div>`;
    const ex = C.PROC.filter(o => o.g === grp.n).map(o => o.p);
    const REF = { 3: 'Das Zerspanen im Detail (Schnittwerte, Drehen, Fräsen) steht im Zerspanungs-Lab, Messen und Toleranzen im Toleranz-Lab.', 4: 'Die einzelnen Fügeverfahren genauer (Schweißen, Löten, Kleben) stehen im Füge-Lab.', 6: 'Das Härten und die Werkstoffe stehen im Werkstoff-Lab.', 2: 'Das Biegen rechnest du in diesem Lab im Reiter Biegen.', 1: 'Gießen und Sintern kommen in der Grundausbildung meist nur als Einordnung vor.', 5: 'Beschichtet wird meist als letzter Schritt, damit die Schicht nicht beschädigt wird.' };
    return h + `<div class="card pl" id="out-ver"><h4>Hauptgruppe ${grp.n}</h4><div class="big">${gtag(grp)}</div><p style="margin:8px 0"><b>Zusammenhalt:</b> ${esc(grp.zl)}</p><p style="margin:8px 0">${esc(grp.d)}</p><div class="rdout">Merksatz: ${esc(grp.m)}</div>
      <p class="hint2" style="margin:8px 0 4px">Beispiele aus der Werkstatt:</p><div class="chipr">${ex.map(p => `<span class="chip s">${esc(p)}</span>`).join('')}</div><p class="hint2">${esc(REF[grp.n])}</p></div>`;
  }
  function renderVer() {
    const names = C.PROC.map(o => o.p);
    $('#verView').innerHTML = ueb() + `<div id="verMap">${verHtml(S.ver.g)}</div><div class="card pl"><h4>Verfahren antippen</h4><div class="chipr" id="procRow">${names.map(p => `<button class="chip" data-proc="${esc(p)}">${esc(p)}</button>`).join('')}</div><p class="hint2">Beim Antippen eines Verfahrens leuchtet seine Hauptgruppe auf der Landkarte auf.</p></div>`;
  }
  function pickGroup(n) { S.ver.g = S.ver.g === n ? 0 : n; lsSet('ver', S.ver); keep('#verMap', () => verHtml(S.ver.g)); }
  $('#verView').addEventListener('click', e => {
    const t = e.target.closest('[data-g]'), p = e.target.closest('[data-proc]');
    if (t) pickGroup(+t.dataset.g);
    else if (p) { const g = C.procGroup(p.dataset.proc); if (g) { S.ver.g = g; lsSet('ver', S.ver); keep('#verMap', () => verHtml(S.ver.g)); } }
  });
  $('#verView').addEventListener('keydown', e => { const t = e.target.closest && e.target.closest('[data-g]'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pickGroup(+t.dataset.g); } });

  /* ============================================================ Biegen */
  function bieOut(p) {
    const s = P(p.s), r = P(p.r);
    if (!(s > 0) || !(r >= 0)) return note('Bitte Blechdicke (größer 0) und Innenradius (0 oder größer) eingeben.');
    let h = '';
    if (p.mode === 'gerade') {
      const l1 = P(p.l1), l2 = P(p.l2), al = P(p.al);
      if (!(l1 >= 0) || !(l2 >= 0) || !(al > 0 && al <= 180)) return note('Bitte beide geraden Schenkel (0 oder größer) und einen Biegewinkel zwischen 0 und 180° eingeben.');
      const rho = r + s / 2, b = C.arc(r, s, al), L = l1 + l2 + b;
      h += box('1. Radius der neutralen Faser', 'r + s/2 = ' + f(r, 1) + ' + ' + f(s / 2, 2), f(rho, 2) + ' mm');
      h += box('2. Bogenlänge der neutralen Faser', 'π · ' + f(rho, 2) + ' · ' + f(al, 0) + '° / 180°', f(b, 2) + ' mm');
      h += box('3. Gestreckte Länge', f(l1, 1) + ' + ' + f(l2, 1) + ' + ' + f(b, 2), f(L, 2) + ' mm', 'ok');
      h += inst(V.biegeteil({ mode: 'gerade', l1, l2, al, s, r, vals: true }));
      return h;
    }
    const a = P(p.a), b = P(p.b), c = String(p.c || '').trim() === '' ? null : P(p.c), dims = c == null ? [a, b] : [a, b, c];
    if (!dims.every(x => x > 0)) return note('Bitte die Außenmaße als Zahlen eingeben (Feld c leer lassen für einen Winkel, ausgefüllt für ein U-Profil).');
    if (!C.bendOk(dims, r, s)) return note('Die Schenkel sind zu kurz für diesen Radius: Endschenkel brauchen mindestens r + s = ' + f(r + s, 1) + ' mm, ein Boden zwischen zwei Biegungen mindestens ' + f(2 * (r + s), 1) + ' mm.', 'bad');
    const n = dims.length - 1, arc = C.arc(r, s, 90), v = C.ausgleich(r, s), L = C.lenOuter(dims, r, s), sum = dims.reduce((x, y) => x + y, 0);
    h += box('1. Bogenlänge je 90°-Biegung (neutrale Faser)', 'π · (r + s/2) / 2 = π · ' + f(r + s / 2, 2) + ' / 2', f(arc, 2) + ' mm');
    h += box('2. Ausgleichswert je Biegung', '2 · (r + s) − Bogen = ' + f(2 * (r + s), 1) + ' − ' + f(arc, 2), f(v, 2) + ' mm');
    h += box('3. Gestreckte Länge (' + n + (n === 1 ? ' Biegung' : ' Biegungen') + ')', 'Summe der Außenmaße − ' + n + ' · Ausgleichswert = ' + f(sum, 1) + ' − ' + f(n * v, 2), f(L, 2) + ' mm', 'ok');
    h += note('Die Summe der Außenmaße (' + f(sum, 1) + ' mm) wäre ' + f(sum - L, 2) + ' mm zu lang: Die Biegung verläuft innen, nicht über die Außenecke.', 'ok');
    h += inst(V.biegeteil({ mode: 'out', dims, s, r, vals: true }));
    return h;
  }
  function renderBie() {
    const b = S.bie;
    $('#bieView').innerHTML = ueb() + `<div class="card pl"><h4>Biegeteil</h4><div class="fbar">${seg('data-bm', [['out', 'Außenmaße (90°)'], ['gerade', 'Gerade Schenkel']], b.mode, 'bm')}</div>
      <div class="dsrow">${inp('bie', 's', 'Blechdicke s', b.s, 'mm')}${inp('bie', 'r', 'Innenradius r', b.r, 'mm')}</div>
      ${b.mode === 'out' ? `<div class="dsrow">${inp('bie', 'a', 'Außenmaß a', b.a, 'mm')}${inp('bie', 'b', 'Außenmaß b', b.b, 'mm')}${inp('bie', 'c', 'Außenmaß c (nur U-Profil)', b.c, 'mm')}</div>` : `<div class="dsrow">${inp('bie', 'l1', 'Gerader Schenkel l₁', b.l1, 'mm')}${inp('bie', 'l2', 'Gerader Schenkel l₂', b.l2, 'mm')}${inp('bie', 'al', 'Biegewinkel', b.al, '°')}</div>`}
      <p class="hint2">Rechenmodell: Die neutrale Faser liegt in der Blechmitte (Radius r + s/2) und behält ihre Länge. Zahlen mit Komma oder Punkt eingeben.</p></div><div id="out-bie"></div>`;
    updateBie();
  }
  function updateBie() { keep('#out-bie', () => bieOut(S.bie)); }
  $('#bieView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.bie[k] = e.target.value; lsSet('bie', S.bie); updateBie(); });
  $('#bieView').addEventListener('click', e => { const b = e.target.closest('[data-bm]'); if (!b) return; S.bie.mode = b.dataset.bm; lsSet('bie', S.bie); renderBie(); });

  /* ============================================================ Gewinde und Bohren */
  const STEPS_G = ['Kernloch passend zum Gewinde bohren', 'Kernloch mit dem Senker anfasen', 'Werkstück sicher spannen', 'Vorschneider mit Schmiermittel rechtwinklig ansetzen und schneiden', 'Mit Mittel- und Fertigschneider nacharbeiten', 'Gewinde mit einer Schraube oder Lehre prüfen'];
  function gewOut(p) {
    const d = Math.round(P(p.d)), th = C.thread(d); if (!th) return note('Bitte ein Gewinde wählen.');
    let h = '';
    h += box('Steigung (Regelgewinde)', 'P', f(th.P, 2) + ' mm');
    h += box('Kernlochdurchmesser (Tabellenwert)', '', f(th.kern, 1) + ' mm', 'ok') + `<p class="hint2">Zur Kontrolle der Richtwert: d − P = ${f(d, 0)} − ${f(th.P, 2)} = ${f(C.kernFaust(d), 2)} mm.</p>`;
    h += inst(V.gewinde({ d, vals: true }));
    h += box('Durchgangsloch für die Schraube (mittlere Reihe)', 'M' + d, f(th.durch, 1) + ' mm');
    h += inst(V.schraube({ d, vals: true }));
    const T = String(p.T || '').trim() === '' ? C.gewTiefe(d) : P(p.T);
    if (!(T > 0)) h += note('Für die Bohrtiefe bitte die nutzbare Gewindetiefe als Zahl eingeben (leer lassen für 1,5 · d).');
    else h += box('Sackloch: Bohrtiefe', 'T + 3 · P = ' + f(T, 1) + ' + ' + f(3 * th.P, 2), f(C.bohrtiefe(T, d), 2) + ' mm') + `<p class="hint2">Nutzbare Gewindetiefe ${String(p.T || '').trim() === '' ? '1,5 · d (Richtwert für Stahl)' : 'wie eingegeben'}; 3 · P Auslauf für den Gewindebohrer (Übungswert).</p>`;
    const D = P(p.D);
    if (!(D > 0)) h += note('Für das Reiben bitte das Nennmaß der Bohrung eingeben.');
    else h += box('Reiben auf Ø ' + f(D, 1) + ' mm: Aufmaß', D <= 10 ? 'bis 10 mm: 0,1 mm' : 'über 10 mm: 0,2 mm', f(C.reibAufmass(D), 1) + ' mm') + box('Vorbohrdurchmesser', f(D, 1) + ' − ' + f(C.reibAufmass(D), 1), f(C.vorbohr(D), 1) + ' mm', 'ok') + `<p class="hint2">Die Handreibahle wird immer im Uhrzeigersinn gedreht, auch beim Herausziehen.</p>`;
    h += `<div class="card pl"><h4>Gewinde von Hand: Reihenfolge</h4><ol style="margin:0 0 0 1.1em;padding:0;line-height:1.5">${STEPS_G.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>`;
    return h;
  }
  function renderGew() {
    const g = S.gew;
    $('#gewView').innerHTML = ueb() + `<div class="card pl"><h4>Gewinde und Bohrungen</h4><div class="dsrow"><label class="f"><span>Gewinde (metrisches Regelgewinde)</span>${sel('in-gew-d', 'd', C.TH_LIST.map(x => [String(x), 'M' + x]), String(Math.round(P(g.d))))}</label>${inp('gew', 'T', 'Nutzbare Gewindetiefe (leer = 1,5 · d)', g.T, 'mm')}${inp('gew', 'D', 'Nennmaß der zu reibenden Bohrung', g.D, 'mm')}</div></div><div id="out-gew"></div>`;
    updateGew();
  }
  function updateGew() { keep('#out-gew', () => gewOut(S.gew)); }
  const gv = $('#gewView');
  gv.addEventListener('input', e => { const k = e.target.dataset.k; if (!k || k === 'd') return; S.gew[k] = e.target.value; lsSet('gew', S.gew); updateGew(); });
  gv.addEventListener('change', e => { if (e.target.dataset.k === 'd') { S.gew.d = e.target.value; lsSet('gew', S.gew); updateGew(); } });

  /* ============================================================ Planung und Kosten */
  function plaOut(p) {
    let h = '';
    if (p.view === 'stange') {
      const L = P(p.L), l = P(p.l), k = P(p.k);
      if (!(L > 0) || !(l > 0) || !(k >= 0)) return note('Bitte Stangenlänge, Teillänge (größer 0) und Schnittbreite (0 oder größer) eingeben.');
      const n = C.partsFromBar(L, l, k), rest = C.barRest(L, l, k);
      h += box('Teile aus der Stange', 'n = (L + k) / (l + k) abgerundet = (' + f(L, 0) + ' + ' + f(k, 1) + ') / (' + f(l, 1) + ' + ' + f(k, 1) + ')', n + ' Stück', 'ok') + box('Schnitte', 'n − 1', String(Math.max(0, n - 1))) + box('Reststück', 'L − n · l − (n − 1) · k', f(rest, 1) + ' mm') + box('Ausnutzung der Stange', 'n · l / L', f(n * l / L * 100, 1) + ' %');
      return h + inst(V.stange({ L, l, kerf: k, vals: true }));
    }
    if (p.view === 'tafel') {
      const W = P(p.W), H = P(p.H), w = P(p.w), hh = P(p.h), e = P(p.e), rr = P(p.rr), s = P(p.s), rho = C.DENS[p.mat] || 7.85;
      if (![W, H, w, hh].every(x => x > 0) || !(e >= 0) || !(rr >= 0)) return note('Bitte Tafel- und Platinenmaße (größer 0) sowie Steg und Rand (0 oder größer) eingeben.');
      const r = C.nest(W, H, w, hh, e, rr), ut = C.nestUtil(W, H, w, hh, e, rr);
      if (!(r.n > 0)) return note('Keine Platine passt auf die Tafel.', 'bad') + inst(V.tafel({ W, H, w, h: hh, vals: true }));
      h += box('Platinen im Raster', r.nx + ' × ' + r.ny + (r.rot ? ' (Platine gedreht)' : ''), r.n + ' Stück', 'ok') + box('Ausnutzung', r.n + ' · ' + f(w, 0) + ' · ' + f(hh, 0) + ' / (' + f(W, 0) + ' · ' + f(H, 0) + ')', f(ut, 1) + ' %') + box('Verschnitt', '100 % − Ausnutzung', f(100 - ut, 1) + ' %');
      if (s > 0) { const mT = C.mass(W, H, s, rho), mP = C.mass(w, hh, s, rho) * r.n; h += box('Masse der Tafel (' + p.mat + ' ' + f(s, 1) + ' mm)', '', f(mT, 1) + ' kg') + box('Masse der Platinen / Verschnitt', '', f(mP, 1) + ' kg / ' + f(mT - mP, 1) + ' kg'); }
      return h + inst(V.nest({ W, H, w, h: hh, e, rr, vals: true }));
    }
    if (p.view === 'kosten') {
      const th = P(p.th), tn = P(p.tn), zE = P(p.zE), zV = P(p.zV), tr = P(p.tr), m = P(p.m), satz = P(p.satz), mat = P(p.matk);
      if (!(th >= 0) || !(tn >= 0) || !(zE >= 0) || !(zV >= 0) || !(tr >= 0) || !(m > 0) || !(satz >= 0) || !(mat >= 0)) return note('Bitte alle Felder mit Zahlen füllen (Stückzahl größer 0, übrige 0 oder größer).');
      const tE = C.te(th, tn, zE, zV), T = C.auftragszeit(tr, m, tE), rueck = C.ruestAnteil(tr, m, satz), fert = tE * satz / 60, k = C.kostenStk(mat, tr, m, tE, satz);
      /* PRUEFEN P22: Das Kostenmodell ist bewusst einfach: Material plus Fertigungszeit mal Stundensatz, Rüstzeit auf die Stückzahl verteilt; keine Gemeinkosten, Werkzeugkosten, Ausschuss oder Zinsen. Reicht das für die Grundausbildung, oder soll ein Zuschlag für Gemeinkosten dazukommen? */
      h += box('Grundzeit', 'th + tn = ' + f(th, 2) + ' + ' + f(tn, 2), f(th + tn, 2) + ' min') + box('Zeit je Einheit', 'Grundzeit · (1 + ' + f(zE + zV, 0) + ' %)', f(tE, 2) + ' min') + box('Auftragszeit', 'tr + m · te = ' + f(tr, 0) + ' + ' + f(m, 0) + ' · ' + f(tE, 2), f(T, 1) + ' min = ' + f(T / 60, 2) + ' h')
        + box('Rüstanteil je Stück', 'tr · Satz / 60 / m', f(rueck, 2) + ' €') + box('Fertigung je Stück (ohne Rüsten)', 'te · Satz / 60', f(fert, 2) + ' €') + box('Material je Stück', '', f(mat, 2) + ' €')
        + box('Kosten je Stück', 'Material + Rüstanteil + Fertigung', f(k, 2) + ' €', 'ok') + box('Kosten des Auftrags', 'm · Kosten je Stück', f(k * m, 2) + ' €');
      return h + inst(V.kostenkurve({ kr: tr * satz / 60, kv: mat + fert, m })) + note('Die Kurve zeigt: Je größer das Los, desto kleiner der Rüstanteil je Stück. Gemeinkosten und Werkzeugkosten sind hier nicht enthalten.', 'warn');
    }
    const kr1 = P(p.kr1), kv1 = P(p.kv1), kr2 = P(p.kr2), kv2 = P(p.kv2);
    if (![kr1, kv1, kr2, kv2].every(x => x >= 0)) return note('Bitte alle vier Werte als Zahlen eingeben (0 oder größer).');
    const m = C.gleichTeuer(kr1, kv1, kr2, kv2);
    if (!(m > 0)) return note('Mit diesen Werten gibt es keine Stückzahl, bei der beide Verfahren gleich teuer sind: Ein Verfahren ist immer günstiger.', 'warn') + inst(V.vergleich({ kr1, kv1, kr2, kv2 }));
    const lowA = kr1 <= kr2;
    h += box('Gleich teuer bei', 'm = (' + f(kr2, 0) + ' − ' + f(kr1, 0) + ') / (' + f(kv1, 2) + ' − ' + f(kv2, 2) + ')', f(m, 1) + ' Stück', 'ok') + box('Gesamtkosten dort', 'Rüstkosten + m · Kosten je Stück', f(kr1 + m * kv1, 2) + ' €') + note('Unter ' + f(m, 0) + ' Stück ist Verfahren ' + (lowA ? 'A' : 'B') + ' billiger (niedrigere Rüstkosten), darüber Verfahren ' + (lowA ? 'B' : 'A') + '.', 'ok');
    return h + inst(V.vergleich({ kr1, kv1, kr2, kv2 }));
  }
  const PLA_FIELDS = {
    stange: [['L', 'Stangenlänge', 'mm'], ['l', 'Länge eines Teils', 'mm'], ['k', 'Schnittbreite', 'mm']],
    tafel: [['W', 'Tafelbreite', 'mm'], ['H', 'Tafelhöhe', 'mm'], ['w', 'Platine Breite', 'mm'], ['h', 'Platine Höhe', 'mm'], ['e', 'Steg zwischen Teilen', 'mm'], ['rr', 'Rand rundum', 'mm'], ['s', 'Blechdicke (für Masse)', 'mm']],
    kosten: [['th', 'Hauptzeit', 'min'], ['tn', 'Nebenzeit', 'min'], ['zE', 'Erholzuschlag', '%'], ['zV', 'Verteilzuschlag', '%'], ['tr', 'Rüstzeit', 'min'], ['m', 'Stückzahl', 'Stück'], ['satz', 'Stundensatz', '€/h'], ['matk', 'Material je Stück', '€']],
    vergleich: [['kr1', 'A: Rüstkosten', '€'], ['kv1', 'A: Kosten je Stück', '€'], ['kr2', 'B: Rüstkosten', '€'], ['kv2', 'B: Kosten je Stück', '€']]
  };
  function renderPla() {
    const p = S.pla;
    $('#plaView').innerHTML = ueb() + `<div class="card pl"><h4>Planung</h4><div class="fbar">${seg('data-pv', [['stange', 'Stange'], ['tafel', 'Blechtafel'], ['kosten', 'Zeit & Kosten'], ['vergleich', 'Zwei Verfahren']], p.view, 'pv')}</div>
      <div class="dsrow">${PLA_FIELDS[p.view].map(x => inp('pla', x[0], x[1], p[x[0]], x[2])).join('')}</div>
      ${p.view === 'tafel' ? `<div class="fbar"><span style="font-size:12px;color:var(--mute)">WERKSTOFF</span>${seg('data-pm', [['Stahl', 'Stahl 7,85'], ['Aluminium', 'Aluminium 2,7']], p.mat, 'pm')}</div>` : ''}</div><div id="out-pla"></div>`;
    updatePla();
  }
  function updatePla() { keep('#out-pla', () => plaOut(S.pla)); }
  $('#plaView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.pla[k] = e.target.value; lsSet('pla', S.pla); updatePla(); });
  $('#plaView').addEventListener('click', e => { const v = e.target.closest('[data-pv]'), m = e.target.closest('[data-pm]'); if (v) { S.pla.view = v.dataset.pv; lsSet('pla', S.pla); renderPla(); } else if (m) { S.pla.mat = m.dataset.pm; lsSet('pla', S.pla); renderPla(); } });

  /* ============================================================ Qualität */
  /* PRUEFEN P23: Bewertung der Fähigkeit nach Cpk: ab 1,33 fähig, von 1,0 bis unter 1,33 bedingt fähig, darunter nicht fähig. Die Regelkarte nutzt die ersten 10 Werte (Vorlauf) für Mittellinie und Grenzen (±3σ, Warngrenzen ±2σ), das ist eine Vereinfachung gegenüber Karten mit Stichproben-Mittelwerten und Spannweiten. Passt das zu eurem Vorgehen? */
  function quaOut(p) {
    const v = C.parseList(p.txt), ugw = P(p.ugw), ogw = P(p.ogw);
    if (v.length < 5) return note('Bitte mindestens fünf Messwerte eingeben (getrennt durch Leerzeichen, Semikolon oder Zeilenumbruch, Dezimalkomma erlaubt).');
    if (!fin(ugw) || !fin(ogw) || !(ogw > ugw)) return note('Bitte untere und obere Toleranzgrenze eingeben (obere größer als untere).');
    const m = C.mean(v), s = C.sdev(v), R = C.range(v), cp = C.cp(ugw, ogw, s), ck = C.cpk(ugw, ogw, m, s), out = v.filter(x => x < ugw - 1e-9 || x > ogw + 1e-9).length;
    let h = box('Anzahl Werte', '', String(v.length)) + box('Mittelwert', 'Summe / n', f(m, 4) + ' mm') + box('Spannweite', 'größter − kleinster Wert', f(R, 4) + ' mm') + box('Standardabweichung (Stichprobe)', 's', f(s, 4) + ' mm');
    if (!(s > 0)) return h + note('Alle Werte sind gleich: Die Streuung ist null, Cp und Cpk lassen sich nicht berechnen.');
    const verd = ck >= C.CPK_MIN ? ['fähig', 'ok'] : ck >= 1 ? ['bedingt fähig', 'warn'] : ['nicht fähig', 'bad'];
    h += box('Cp = Toleranzbreite / (6 · s)', f(ogw - ugw, 3) + ' / (6 · ' + f(s, 4) + ')', f(cp, 2)) + box('Cpk = Abstand zur näheren Grenze / (3 · s)', f(Math.min(ogw - m, m - ugw), 4) + ' / (3 · ' + f(s, 4) + ')', f(ck, 2)) + `<div class="rdout ${verd[1]}"><span class="st">Bewertung nach Cpk (Richtwert 1,33)</span><span class="badge">${esc(verd[0])}</span></div>`;
    h += box('Außerhalb der Toleranz', 'gemessen / erwartet bei Normalverteilung', out + ' von ' + v.length + ' / ' + (C.outShare(ugw, ogw, m, s) < 0.01 ? '< 0,01' : f(C.outShare(ugw, ogw, m, s), 2)) + ' %');
    if (cp - ck > 0.35 && cp >= 1) h += note('Cp ist deutlich größer als Cpk: Der Prozess streut wenig genug, sitzt aber nicht mittig. Die Lage nachstellen.', 'warn');
    else if (cp < 1) h += note('Schon Cp liegt unter 1: Die Streuung ist größer als die Toleranz. Nachstellen allein hilft nicht, die Streuung muss kleiner werden.', 'warn');
    h += inst(V.glocke({ mu: m, sigma: s, ugw, ogw, vals: true })) + inst(V.histogramm({ values: v, ugw, ogw }));
    if (v.length >= 12) {
      const pre = v.slice(0, 10), lim = C.limits(C.mean(pre), C.sdev(pre), 1);
      if (lim && C.sdev(pre) > 0) {
        const rr = C.chartRules(v, lim), msgs = [];
        if (rr.aus.length) msgs.push('Mindestens ein Punkt liegt außerhalb der Eingriffsgrenzen.');
        if (rr.trend.length) msgs.push('Sieben Punkte in Folge steigen oder fallen (Trend).');
        if (rr.lage.length) msgs.push('Sieben Punkte in Folge liegen auf einer Seite der Mittellinie (Lage verschoben).');
        h += `<div class="rdout ${msgs.length ? 'bad' : 'ok'}"><span class="st">Qualitätsregelkarte (Grenzen aus den ersten 10 Werten)</span>${msgs.length ? 'Eingriff nötig: ' + esc(msgs.join(' ')) : 'Kein Eingriff: kein Punkt außerhalb, kein Trend, keine einseitige Folge.'}</div>` + inst(V.regelkarte({ s: v, lim, flags: true }));
      }
    } else h += note('Für die Regelkarte werden mindestens 12 Werte gebraucht (die ersten 10 legen die Grenzen fest).', 'warn');
    return h;
  }
  function renderQua() {
    const q = S.qua;
    $('#quaView').innerHTML = ueb() + `<div class="card pl"><h4>Messreihe</h4><label class="f"><span>Messwerte in der Reihenfolge der Fertigung (mm)</span><textarea class="vals" id="in-qua-txt" data-k="txt" autocomplete="off" spellcheck="false">${esc(q.txt)}</textarea></label>
      <div class="dsrow">${inp('qua', 'ugw', 'Untere Toleranzgrenze UGW', q.ugw, 'mm')}${inp('qua', 'ogw', 'Obere Toleranzgrenze OGW', q.ogw, 'mm')}</div>
      <div class="fbar"><span style="font-size:12px;color:var(--mute)">BEISPIELDATEN</span>${seg('data-qs', [['gut', 'mittig'], ['lage', 'außermittig'], ['streu', 'streut stark'], ['trend', 'Trend']], '', 'qs')}</div></div><div id="out-qua"></div>`;
    updateQua();
  }
  function updateQua() { keep('#out-qua', () => quaOut(S.qua)); }
  $('#quaView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.qua[k] = e.target.value; lsSet('qua', S.qua); updateQua(); });
  $('#quaView').addEventListener('click', e => { const b = e.target.closest('[data-qs]'); if (!b) return; S.qua.txt = D.sampleSet(b.dataset.qs).map(v => C.fmtDe(v, 4)).join(' '); S.qua.ugw = '19,9'; S.qua.ogw = '20,1'; lsSet('qua', S.qua); renderQua(); });

  /* ============================================================ Vorrichtung (3-2-1) */
  const FNAME = [['a', 'Hauptauflage', 4, 'Punkte (Soll 3)'], ['b', 'Führungsfläche', 3, 'Punkte (Soll 2)'], ['c', 'Anschlag', 2, 'Punkte (Soll 1)']];
  function vorOut(p) {
    const a = +p.a, b = +p.b, c = +p.c, d = C.dof(a, b, c); if (!d) return note('Bitte die Zahl der Punkte wählen.');
    let h = box('Gesperrte Freiheitsgrade', C.DOF.filter((_, i) => d.locked.indexOf(i) >= 0).join(', ') || 'keine', d.nLocked + ' von 6');
    h += box('Noch frei', C.DOF.filter((_, i) => d.free.indexOf(i) >= 0).join(', ') || 'keine', d.nFree + ' von 6', d.nFree === 0 ? 'ok' : 'warn');
    if (d.over.length) h += note('Überbestimmt: ' + d.over.map(o => o.t + ' hat ' + o.extra + (o.extra === 1 ? ' Punkt' : ' Punkte') + ' zu viel').join('; ') + '. Das Teil liegt nicht sicher, es kippelt oder verspannt sich.', 'bad');
    else if (d.fullyDetermined) h += note('Vollständig bestimmt: 3 + 2 + 1 = 6 Punkte sperren alle sechs Freiheitsgrade.', 'ok');
    else h += note('Das Teil ist noch nicht vollständig bestimmt: Es kann sich in den freien Richtungen bewegen.', 'warn');
    return h + inst(V.block({ cnt: [a, b, c], bar: true }));
  }
  const SPANN = [['Schraubstock', 'Spannt flache und prismatische Teile; Schutzbacken schonen fertige Flächen.'], ['Spanneisen', 'Hebel mit Schraube: Je näher die Schraube am Werkstück, desto mehr Kraft wirkt dort.'], ['Winkel und Anschlag', 'Geben die Führungsfläche und den Anschlag vor, gegen die das Teil gedrückt wird.'], ['Exzenter und Schnellspanner', 'Spannen mit einer kurzen Bewegung, gut für Serien.']];
  function renderVor() {
    const v = S.vor;
    $('#vorView').innerHTML = ueb() + `<div class="card pl"><h4>Punkte setzen (3-2-1-Regel)</h4><p class="hint2" style="margin-top:0">Stelle ein, wie viele Auflagepunkte an jeder Fläche liegen, und sieh, welche Freiheitsgrade gesperrt sind.</p>
      ${FNAME.map(x => `<div class="mrow" style="margin:6px 0"><span>${esc(x[1])}: <b id="vn-${x[0]}">${v[x[0]]}</b> ${esc(x[3])}</span><div class="stp"><button id="vor-${x[0]}-minus" data-vs="${x[0]}" data-dv="-1" aria-label="${esc(x[1])}: ein Punkt weniger">−</button><button id="vor-${x[0]}-plus" data-vs="${x[0]}" data-dv="1" aria-label="${esc(x[1])}: ein Punkt mehr">+</button></div></div>`).join('')}</div><div id="out-vor"></div>
      <div class="card pl"><h4>Spannmittel</h4><table class="tt">${SPANN.map(x => `<tr><td><b>${esc(x[0])}</b></td><td>${esc(x[1])}</td></tr>`).join('')}</table><p class="hint2">Die Spannkraft wirkt in Richtung der Auflagepunkte, damit nichts durchgebogen wird.</p></div>`;
    updateVor();
  }
  function updateVor() { keep('#out-vor', () => vorOut(S.vor)); FNAME.forEach(x => { const e = $('#vn-' + x[0]); if (e) e.textContent = S.vor[x[0]]; }); }
  $('#vorView').addEventListener('click', e => { const b = e.target.closest('[data-vs]'); if (!b) return; const k = b.dataset.vs, mx = FNAME.find(x => x[0] === k)[2]; S.vor[k] = Math.max(0, Math.min(mx, S.vor[k] + (+b.dataset.dv))); lsSet('vor', S.vor); updateVor(); });

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
  const qText = t => `<p style="margin:8px 0;white-space:pre-line">${esc(t)}</p>`;
  function qBody(q, a, r, pre) {
    const dn = r && (r.ok || pre === 'rt'), as = q.ask; let h = '';
    if (q.viz) { const sv = V.taskSvg(q.viz); if (sv) h += inst(sv); }
    if (as.type === 'choice') h += `<div class="opts">${as.choices.map((c, i) => `<button data-tc="${i}" ${dn ? 'disabled' : ''} class="${r && i === as.correct && dn ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    else if (as.type === 'num') h += `<label class="f"><span>${esc(as.label)}${as.unit ? ' (' + esc(as.unit) + ')' : ''}</span><div class="qin"><input id="in-task-${pre}" data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${dn ? 'disabled' : ''}><span class="u">${esc(as.unit)}</span></div></label>`;
    else if (as.type === 'order') { const o = a.o || []; h += `<p class="hint2" style="margin:4px 0">Tippe die Einträge in der richtigen Reihenfolge an. Nochmal tippen nimmt einen Eintrag zurück.</p><div class="opts">${as.items.map((t, i) => { const k = o.indexOf(i); return `<button data-to="${i}" ${dn ? 'disabled' : ''} class="${k >= 0 ? 'on' : ''}"><span class="no">${k >= 0 ? k + 1 : '·'}</span> ${esc(t)}</button>`; }).join('')}</div><div class="btns"><button class="btn" data-oc="1" ${dn ? 'disabled' : ''}>↺ Reihenfolge zurücksetzen</button></div>`; }
    else if (as.type === 'match') { const m = a.m || []; h += `<div class="mrows">${as.rows.map((t, i) => `<label class="mrow"><span>${esc(t)}</span><select data-mr="${i}" ${dn ? 'disabled' : ''}><option value="">– wählen –</option>${as.options.map((op, j) => `<option value="${j}"${m[i] === j ? ' selected' : ''}>${esc(op)}</option>`).join('')}</select></label>`).join('')}</div>`; }
    return h;
  }
  function evalQ(q, a) { const e = D.evaluate(q, a); if (e.err) { toast(e.err); return null; } return e; }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 2))} ${esc(q.ask.unit)} (wegen Rundung).</li>` : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(D.solText(q))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const Vw = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || (S.tAns[t.id] = {});
      h += `<div class="card pl" id="taskCard" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${qText(q.text)}${qBody(q, a, r, 'tk')}`;
      h += `<div class="btns"><button class="btn pri" id="btn-pruefen" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" id="btn-tipp" data-ta="hint">💡 Tipp</button><button class="btn" id="btn-schliessen" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" id="task-${esc(x.id)}" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    Vw.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    S.tRes = { id: t.id, ok: e.ok, given: e.given, detail: e.detail, pct };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast('Noch nicht richtig. Lies die Hinweise und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintFor(q, id) {
    const h = lsGet('hints', {}), n = Math.min(2, (h[id] || 0) + 1), ex = exam(); h[id] = Math.max(h[id] || 0, n); lsSet('hints', h);
    if (ex && id !== 'rt') { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 2', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(q.tips[0])}</p>`; if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(q.tips[1])}</p>`;
      x += n >= 2 ? '<p class="hint2">Mehr Tipps gibt es nicht. Den Lösungsweg siehst du nach dem Prüfen.</p>' : '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“.</p>';
      x += ex && id !== 'rt' ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
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
  tv.addEventListener('change', e => { const t = curTask(), mr = e.target.dataset && e.target.dataset.mr; if (t && mr != null) { const a = S.tAns[t.id] = S.tAns[t.id] || {}; a.m = a.m || []; a.m[+mr] = e.target.value === '' ? null : +e.target.value; if (S.tRes && !S.tRes.ok) { S.tRes = null; renderTasks(false); } } });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]'), to = e.target.closest('[data-to]'), oc = e.target.closest('[data-oc]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (to && t) { const a = S.tAns[t.id] = S.tAns[t.id] || {}, o = a.o = a.o || [], i = +to.dataset.to, k = o.indexOf(i); if (k >= 0) o.splice(k, 1); else o.push(i); if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (oc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).o = []; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintFor(S.tq, t.id); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });

  /* Zufalls-Trainer (Tipps kosten hier nie etwas) */
  function newTrainer() { const T = S.tr; T.q = D.randomQ(R0, T.level); T.ans = {}; T.res = null; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar"><span class="lbl" style="font-size:12px;color:var(--mute)">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button id="btn-rt-lv${l[0]}" data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${qText(q.text)}${qBody(q, T.ans, T.res, 'rt')}
      <div class="btns"><button class="btn pri" id="btn-rt-pruefen" data-ra="chk" ${T.res ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" id="btn-rt-tipp" data-ra="hint" ${T.res ? 'disabled' : ''}>💡 Tipp</button><button class="btn" id="btn-rt-next" data-ra="next">${T.res ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}</div>`;
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr.ans.v = e.target.value; });
  rv.addEventListener('change', e => { const mr = e.target.dataset && e.target.dataset.mr; if (mr != null && !S.tr.res) { const a = S.tr.ans; a.m = a.m || []; a.m[+mr] = e.target.value === '' ? null : +e.target.value; } });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]'), to = e.target.closest('[data-to]'), oc = e.target.closest('[data-oc]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (tc && !T.res) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (to && !T.res) { const o = T.ans.o = T.ans.o || [], i = +to.dataset.to, k = o.indexOf(i); if (k >= 0) o.splice(k, 1); else o.push(i); renderTrainer(); return; }
    if (oc && !T.res) { T.ans.o = []; renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if (!T.res && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res) return; const e = evalQ(T.q, T.ans); if (!e) return;
    T.res = { ok: e.ok, given: e.given, detail: e.detail }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Beispiele */
  const exQua = p => ({ txt: D.sampleSet(p.set).map(v => C.fmtDe(v, 4)).join(' '), ugw: p.ugw, ogw: p.ogw });
  function exBody(e) {
    const p = e.p;
    if (e.tab === 'ver') return verHtml(p.g);
    if (e.tab === 'bie') return bieOut(p);
    if (e.tab === 'gew') return gewOut(p);
    if (e.tab === 'pla') return plaOut(Object.assign({}, S.pla, p));
    if (e.tab === 'qua') return quaOut(exQua(p));
    return vorOut(p);
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele (Übungswerte). Mit „In den Rechner laden“ öffnest du die Zahlen im passenden Reiter und kannst sie verändern.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" id="ex-load-${e.id}" data-ex="${e.id}">In den Rechner laden</button></div></div>`).join('');
  }
  function loadExample(x) {
    const p = x.p;
    if (x.tab === 'ver') { S.ver.g = p.g; lsSet('ver', S.ver); }
    else if (x.tab === 'bie') { S.bie = Object.assign({}, S.bie, p); lsSet('bie', S.bie); }
    else if (x.tab === 'gew') { S.gew = Object.assign({}, S.gew, p); lsSet('gew', S.gew); }
    else if (x.tab === 'pla') { S.pla = Object.assign({}, S.pla, p); lsSet('pla', S.pla); }
    else if (x.tab === 'qua') { S.qua = Object.assign({}, S.qua, exQua(p)); lsSet('qua', S.qua); }
    else { S.vor = { a: p.a, b: p.b, c: p.c }; lsSet('vor', S.vor); }
    setTab(x.tab);
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (b) { const x = D.examples.find(z => z.id === b.dataset.ex); if (x) { loadExample(x); toast('Beispiel geladen: ' + x.title); } return; }
    const g = e.target.closest('[data-g]'); if (g) { S.ver.g = +g.dataset.g; lsSet('ver', S.ver); }
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Fertigungsverfahren (DIN 8580)', `<table><tr><th>Nr.</th><th>Hauptgruppe</th><th>Zusammenhalt</th></tr>${C.GROUPS.map(g => `<tr><td>${g.n}</td><td><b>${esc(g.t)}</b></td><td>${esc(g.z)}</td></tr>`).join('')}</table><p>Zu jeder Gruppe gehören viele Verfahren. Im Reiter <b>Verfahren</b> tippst du eine Gruppe an und siehst Beispiele. Zerspanen im Detail, Toleranzen, CNC, Werkstoffe, Instandhaltung und Fügeverfahren haben eigene Labs; hier geht es um die Einordnung und die Handfertigung der Grundausbildung.</p>`, true) +
      sec('Gewinde, Bohren, Reiben', `<span class="eq">Kernloch ≈ d − P (Tabelle genauer)</span><table><tr><th>Gewinde</th><th>Steigung P</th><th>Kernloch</th><th>Durchgang (mittel)</th></tr>${C.TH_LIST.map(d => `<tr><td>M${d}</td><td>${f(C.pitch(d), 2)} mm</td><td>${f(C.kernloch(d), 1)} mm</td><td>${f(C.durchgang(d), 1)} mm</td></tr>`).join('')}</table><span class="eq">Sackloch: Bohrtiefe = nutzbare Gewindetiefe + 3 · P</span><span class="eq">Reiben: Vorbohr-Ø = Nennmaß − Aufmaß (0,1 mm bis Ø 10, darüber 0,2 mm)</span><p>Reihenfolge von Hand: Kernloch bohren, anfasen, spannen, mit Vorschneider beginnen, mit Mittel- und Fertigschneider nacharbeiten, prüfen.</p>`) +
      sec('Biegen', `<span class="eq">Bogenlänge = π · (r + s/2) · α / 180°</span><span class="eq">Außenmaße, 90°: L = Summe der Außenmaße − n · (2 · (r + s) − Bogen)</span><p>Außen wird der Werkstoff gedehnt, innen gestaucht; die <b>neutrale Faser</b> behält ihre Länge. Im Übungsmodell liegt sie in der Blechmitte. Nach dem Biegen federt das Blech etwas zurück: Man biegt ein wenig über. Die Biegekante liegt möglichst quer zur Walzrichtung.</p>`) +
      sec('Planung und Kosten', `<span class="eq">Rohlänge = Fertiglänge + 2 · Zugabe</span><span class="eq">Teile aus der Stange: n = (L + k) / (l + k), abgerundet</span><span class="eq">Ausnutzung = n · Fläche der Platine / Tafelfläche</span><span class="eq">Masse = Länge · Breite · Dicke · Dichte (Stahl 7,85 kg/dm³)</span><span class="eq">Zeit je Einheit te = (th + tn) · (1 + Zuschläge)</span><span class="eq">Auftragszeit T = tr + m · te</span><span class="eq">Kosten je Stück = Material + (tr / m + te) · Satz / 60</span><span class="eq">gleich teuer: m = (Kr2 − Kr1) / (kv1 − kv2)</span>`) +
      sec('Qualitätssicherung', `<span class="eq">Mittelwert x̄ = Summe / n</span><span class="eq">Standardabweichung s = √(Σ(x − x̄)² / (n − 1))</span><span class="eq">Cp = (OGW − UGW) / (6 · s)</span><span class="eq">Cpk = min(OGW − x̄, x̄ − UGW) / (3 · s)</span><p>Grundidee: Cp vergleicht die Toleranzbreite mit der Streubreite, Cpk berücksichtigt zusätzlich die Lage. Als fähig gilt ein Prozess meist ab etwa 1,33. In der <b>Qualitätsregelkarte</b> greift man ein bei einem Punkt außerhalb der Eingriffsgrenzen, bei sieben steigenden oder fallenden Punkten in Folge und bei sieben Punkten in Folge auf einer Seite der Mittellinie.</p>`) +
      sec('Vorrichtungen: 3-2-1', `<p>Ein frei beweglicher Körper hat <b>6 Freiheitsgrade</b> (3 Verschiebungen, 3 Drehungen). Hauptauflage 3 Punkte sperren 3, Führungsfläche 2 Punkte sperren 2, Anschlag 1 Punkt sperrt 1. Mehr Punkte als nötig sind <b>überbestimmt</b>: Das Teil kippelt. Die Spannkraft wirkt in Richtung der Auflagepunkte.</p>`) +
      /* PRUEFEN P25: Kurze Sicherheitshinweise zur Handfertigung (Werkstück spannen statt halten, an der Bohrmaschine keine Handschuhe, Späne nicht mit der Hand entfernen, Grat entfernen). Reicht das als Hinweis, oder fehlt etwas, das ihr in der Grundausbildung betont (Schutzbrille, Haare, Ärmel)? */
      sec('Sicherheit in der Werkstatt', `<ul><li>Werkstücke werden gespannt und nicht mit der Hand gehalten.</li><li>An drehenden Maschinen wie der Bohrmaschine trägt man keine Handschuhe und keinen losen Schmuck, lange Haare werden gebunden.</li><li>Späne entfernt man mit Besen oder Haken, nicht mit der Hand.</li><li>Kanten werden entgratet, bevor man das Teil weitergibt.</li><li>Schutzbrille tragen. Maßgebend ist die Unterweisung deines Betriebs.</li></ul>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte; Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" id="tab-${k}" data-tab="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.tab); });
  const RENDER = { ver: renderVer, bie: renderBie, gew: renderGew, pla: renderPla, qua: renderQua, vor: renderVor, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp };
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'ver'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    RENDER[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Fertigungs-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Fertigungs-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); palSig = ''; updatePal(); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n, S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" id="chip-fx" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" id="chip-exam" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" id="chip-rand" data-a="rand" title="Zufällige Frage im Trainer">🎲 Zufallsaufgabe</button>
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
  $('#title').onclick = () => setTab('ver');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe und Formeln', 'Verfahren, Gewinde, Biegen, Planung, Qualität, Vorrichtung'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.FER_LAB = { id: 'fer', title: 'Fertigungs-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.FER_TASKS };

  /* Rauchtest für quelle/fer/test_fercore.js (läuft nur, wenn der Test window.__FER_TEST setzt) */
  root.FER_UI = {
    smoke: function () {
      if (!root.__FER_TEST) return 'nur im Test';
      try {
        TABS.forEach(t => setTab(t[0]));
        TASKS.forEach(t => {
          setTab('tasks'); startTask(t.id); const q = S.tq;
          S.tAns[t.id] = {}; checkTask(t);
          S.tAns[t.id] = D.wrongAns(q); checkTask(t); renderTasks(false);
          S.tAns[t.id] = D.solAns(q); S.tRes = null; checkTask(t);
          if (!S.tRes || !S.tRes.ok) throw new Error('Aufgabe ' + t.id + ': Musterlösung wird in der Oberfläche nicht akzeptiert');
          renderTasks(false); hintFor(q, t.id);
        });
        S.tr.level = 0; for (let k = 0; k < 60; k++) { newTrainer(); const q = S.tr.q; S.tr.ans = D.solAns(q); trainerCheck(); renderTrainer(); }
        D.examples.forEach(e => { loadExample(e); if (!exBody(e)) throw new Error('Beispiel ' + e.id + ' leer'); });
        S.bie.s = 'x'; updateBie(); S.bie.s = '3'; S.bie.mode = 'gerade'; S.bie.al = '200'; updateBie(); S.bie.al = '60'; renderBie(); S.bie.mode = 'out'; S.bie.a = '3'; updateBie(); S.bie.a = '60'; S.bie.c = '50'; updateBie();
        S.gew.T = '-1'; S.gew.D = 'x'; updateGew(); C.TH_LIST.forEach(d => { S.gew.d = String(d); S.gew.T = ''; S.gew.D = '12'; updateGew(); });
        ['stange', 'tafel', 'kosten', 'vergleich'].forEach(v => { S.pla.view = v; renderPla(); S.pla.L = 'x'; S.pla.W = '0'; S.pla.m = '0'; S.pla.kv1 = '2'; S.pla.kv2 = '2'; updatePla(); S.pla.L = '3000'; S.pla.W = '1000'; S.pla.m = '25'; S.pla.kv1 = '4'; S.pla.kv2 = '2,5'; updatePla(); });
        ['gut', 'lage', 'streu', 'trend'].forEach(k => { S.qua.txt = D.sampleSet(k).join(' '); renderQua(); }); S.qua.txt = '1 2'; updateQua(); S.qua.txt = '5 5 5 5 5'; updateQua();
        for (let a = 0; a <= 4; a++) for (let b = 0; b <= 3; b++) for (let c = 0; c <= 2; c++) { S.vor.a = a; S.vor.b = b; S.vor.c = c; renderVor(); }
        for (let g = 0; g <= 6; g++) { S.ver.g = g; renderVer(); }
        setTab('bsp'); setTab('help'); return 'ok';
      } catch (e) { return e && e.stack ? e.stack : String(e); }
    }
  };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'ver');
  /* Aufruf ?aufgabe=fer1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=bie1 springt zu einem Beispiel) */
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
