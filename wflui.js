'use strict';
/* Tonfunk Warenfluss-Lab: Oberfläche (Lab-Kennung 'wfl').
   ALLE Zahlen (Mengen, Fristen, Tarife, Tragfähigkeiten, Maße, Zeiten) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   Reiter: Wareneingang (Prüfer mit Bestellung und Lieferschein), Lagerstrategien, Kommissionieren (Simulator mit Lagergrundriss), Stapler (Traglast-Rechner mit Diagramm),
           Inventur, Versand, Begriffe, Aufgaben, Trainer, Beispiele, Hilfe.
   Module: wflcore.js (WFL_CORE, Rechenlogik), wfldata.js (WFL_DATA, WFL_TASKS: Aufgaben, Beispiele, Zuordnungs-Sätze).
   Speicher (Präfix lm4.wfl.): tab, we, lag, kom, trag, inv, ver, wiss, mt, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: wfllab.html?aufgabe=wfl1 öffnet die Aufgabe, wfllab.html?bsp öffnet die Beispiele (?bsp=fefo1 springt zu einem Beispiel). */
(function (root) {
  const C = root.WFL_CORE, D = root.WFL_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.wfl.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s), sc = v => String(v).replace('.', ',');
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Warenfluss-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">wflcore.js oder wfldata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['we', '📥', 'Wareneingang'], ['lag', '🗄️', 'Lagerstrategien'], ['kom', '🛒', 'Kommissionieren'], ['trag', '🚜', 'Stapler'], ['inv', '📋', 'Inventur'], ['ver', '📦', 'Versand'], ['wiss', '🔤', 'Begriffe'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const SETKEYS = ['we', 'lag', 'kom', 'flur', 'inv', 'ver'];
  const LAGROWS = [{ ein: '40', mhd: '230', qty: '30' }, { ein: '75', mhd: '150', qty: '40' }, { ein: '110', mhd: '300', qty: '50' }, { ein: '20', mhd: '260', qty: '25' }];
  const INVROWS = [{ n: 'Schrauben M8 (100er-Pack)', soll: '120', ist: '118', p: '4,5' }, { n: 'Kugellager 6204', soll: '60', ist: '60', p: '4,5' }, { n: 'Dichtring 40 x 52', soll: '300', ist: '312', p: '1,2' }, { n: 'Netzteil 24 V', soll: '25', ist: '22', p: '21,4' }, { n: 'Kabelbinder 300 mm', soll: '80', ist: '80', p: '3,1' }, { n: 'Hydraulikschlauch 2 m', soll: '18', ist: '17', p: '18,5' }];
  const S = {
    tab: lsGet('tab', 'we'),
    we: Object.assign({ seed: 'w1' }, lsGet('we', {})),
    lag: Object.assign({ rows: LAGROWS, q: '55', strat: 'fefo', m: [['8', '12', '5', '9'], ['3', '4', '10', '6'], ['6', '2', '3', '11']], occ: [] }, lsGet('lag', {})),
    kom: Object.assign({ cur: 'A', A: [], B: [], show: 'mine', v: '1,5', tg: '10', tb: '90', weg: '240', n: '', err: '3', tot: '400' }, lsGet('kom', {})),
    trag: Object.assign({ m: '1600', l: '1600', c: '800', h: '3500', mS: '3600', b: '900', e: '450' }, lsGet('trag', {})),
    inv: Object.assign({ rows: INVROWS, blind: false, z: '1250', zu: '40', ab: '65', dir: 'nach', n: '25', N: '1000', sSum: '180' }, lsGet('inv', {})),
    ver: Object.assign({ l: '90', b: '60', h: '40', kg: '18', pal: '0', pct: '10', k: '3', n: '7' }, lsGet('ver', {})),
    wiss: Object.assign({ key: 'we' }, lsGet('wiss', {})),
    mt: lsGet('mt', {}), mq: {},
    weSel: {}, weDone: false, insSeed: String(lsGet('ins', 'i1')), insSel: {}, insAll: '', insDone: false,
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  /* Gespeicherte Zustände prüfen (Länge, Form) */
  if (!Array.isArray(S.lag.rows) || S.lag.rows.length !== 4 || !S.lag.rows.every(r => r && ['ein', 'mhd', 'qty'].every(k => typeof r[k] === 'string'))) S.lag.rows = LAGROWS;
  if (!Array.isArray(S.lag.m) || S.lag.m.length !== 3 || !S.lag.m.every(r => Array.isArray(r) && r.length === 4)) S.lag.m = [['8', '12', '5', '9'], ['3', '4', '10', '6'], ['6', '2', '3', '11']];
  const allSlots = C.allSlots(2, 3, 3);
  if (!Array.isArray(S.lag.occ)) S.lag.occ = []; S.lag.occ = S.lag.occ.filter(x => allSlots.includes(x));
  if (!C.STRATS.some(x => x.k === S.lag.strat)) S.lag.strat = 'fefo';
  const okPick = q => Array.isArray(q) && q.length === 2 && q[0] >= 1 && q[0] <= C.LAYOUT.aisles && C.LAYOUT.slots.includes(q[1]);
  ['A', 'B'].forEach(k => { if (!Array.isArray(S.kom[k])) S.kom[k] = []; const seen = new Set(); S.kom[k] = S.kom[k].filter(q => okPick(q) && !seen.has(q.join('/')) && seen.add(q.join('/'))).slice(0, 8); });
  if (!['A', 'B'].includes(S.kom.cur)) S.kom.cur = 'A';
  if (!['mine', 's', 'best', 'all', 'none'].includes(S.kom.show)) S.kom.show = 'mine';
  if (!Array.isArray(S.inv.rows) || S.inv.rows.length !== 6 || !S.inv.rows.every(r => r && ['n', 'soll', 'ist', 'p'].every(k => typeof r[k] === 'string'))) S.inv.rows = INVROWS;
  if (!['nach', 'vor'].includes(S.inv.dir)) S.inv.dir = 'nach';
  if (!SETKEYS.includes(S.wiss.key)) S.wiss.key = 'we';
  if (!S.mt || typeof S.mt !== 'object') S.mt = {};
  SETKEYS.forEach(k => { if (!S.mt[k]) S.mt[k] = { n: 0, ok: 0 }; S.mq[k] = { i: -1, sel: -1 }; });
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();
  const newSeed = () => 's' + Math.floor(R0() * 1e9).toString(36);

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (k, label, val, unit, attr) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input ${attr || 'data-k'}="${k}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  const cell = (attr, val) => `<input ${attr} inputmode="decimal" autocomplete="off" value="${esc(val)}">`;
  const UEB = 'Alle Zahlen in diesem Lab (Mengen, Fristen, Tarife, Tragfähigkeiten, Maße, Zeiten) sind Übungswerte für die Ausbildung, nicht für die Praxis. Maßgebend sind immer die Vorschriften, Betriebsanweisungen und Typenschilder deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const lbl = t => `<span style="font-size:12px;color:var(--mute)">${esc(t)}</span>`;
  const XREF = (lab, txt) => `<p class="hint2">Siehe auch ${lab}: ${esc(txt)}</p>`;

  /* ============================================================ Wareneingang */
  const FOPTS = C.FIND.map(x => [x.k, x.n]);
  function weDocs(del, mode, sel) {
    const L = del.lines, tb = (h, rows) => `<div class="tw"><table class="tt">${h}${rows}</table></div>`;
    const bes = tb('<tr><th>Nr.</th><th>Artikel</th><th class="n">Menge</th></tr>', L.map(l => `<tr><td>${esc(l.artO)}</td><td>${esc(l.nameO)}</td><td class="n">${f(l.ordered, 0)}</td></tr>`).join(''));
    const lie = tb('<tr><th>Nr.</th><th>Artikel</th><th class="n">Menge</th></tr>', L.map(l => `<tr><td>${esc(l.artL)}</td><td>${esc(l.nameL)}</td><td class="n">${f(l.noted, 0)}</td></tr>`).join(''));
    const zae = tb('<tr><th>#</th><th class="n">Gezählt</th><th>Zustand</th><th>Befund</th></tr>', L.map((l, i) => `<tr><td>${i + 1}</td><td class="n">${f(l.counted, 0)}</td><td>${esc(l.note)}</td><td>${mode === 'input' ? `<select data-wi="${i}"><option value="">– wählen –</option>${FOPTS.map(o => `<option value="${o[0]}"${sel[i] === o[0] ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>` : '<b>' + esc(C.findOf(C.lineFinding(l)).n) + '</b>'}</td></tr>`).join(''));
    return `<div class="cols"><div class="doc"><h5>Bestellung (Zeilen 1 bis ${L.length})</h5>${bes}</div><div class="doc"><h5>Lieferschein des Lieferers</h5>${lie}</div></div><div class="doc" style="margin-top:10px"><h5>Wareneingang: deine Zählung und Sichtprüfung</h5>${zae}</div>`;
  }
  function weActions(del) {
    return '<ul class="tl">' + del.lines.map((l, i) => { const k = C.lineFinding(l), fi = C.findOf(k); return `<li class="${k === 'ok' ? 'ok' : 'bad'}">Zeile ${i + 1}: <b>${esc(fi.n)}</b>. ${esc(fi.act)}</li>`; }).join('') + '</ul>';
  }
  function weSolved(seed) { const del = C.makeDelivery(seed); return weDocs(del, 'solved', {}) + weActions(del) + weAblauf(); }
  function weAblauf() {
    return `<details class="dt" style="margin-top:10px"><summary>Ablauf bei einer Beanstandung (Übung)</summary><div class="hb2"><ol>${C.ABLAUF.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="hint2">Übungsfristen (keine Rechtsaussage): offener Mangel ${C.FRIST.offen} Werktage, versteckter Mangel ${C.FRIST.versteckt} Werktage; der Ankunftstag zählt nicht mit, Samstag und Sonntag zählen nicht. Die Mängelrüge selbst wird im Lab nur als Ablauf beschrieben. Verbindlich sind die Regeln deines Betriebs und des Vertrags.</p></div></details>`;
  }
  function renderWe() {
    const del = C.makeDelivery(S.we.seed);
    $('#weView').innerHTML = ueb() + `<div class="card pl"><h4>Wareneingangs-Prüfer</h4><p class="hint2" style="margin:0 0 8px">Gleiche Bestellung, Lieferschein und deine Zählung Zeile für Zeile ab und wähle für jede Zeile den Befund. Nichts verrät vorher, wo ein Fehler steckt: Lieferschein und Bestellung können sich unterscheiden, der Lieferschein kann von der Zählung abweichen, die Verpackung kann beschädigt sein.</p>${weDocs(del, 'input', S.weSel)}
      <div class="btns"><button class="btn pri" data-we="chk">✓ Befunde auswerten</button><button class="btn" data-we="new">Neue Lieferung</button></div><div id="weRes"></div></div>${weAblauf()}`;
    if (S.weDone) weResult(del);
  }
  function weResult(del) {
    const L = del.lines, sel = S.weSel; let ok = 0;
    const li = L.map((l, i) => { const k = C.lineFinding(l), fi = C.findOf(k), g = sel[i], right = g === k; if (right) ok++; return `<li class="${right ? 'ok' : 'bad'}">Zeile ${i + 1}: ${right ? '✓ ' : '✗ Du hast „' + esc((C.FIND.find(x => x.k === g) || { n: '–' }).n) + '“ gewählt. Richtig: '}<b>${esc(fi.n)}</b>. ${esc(fi.act)}</li>`; });
    $('#weRes').innerHTML = `<div class="rdout ${ok === L.length ? 'ok' : 'warn'}"><b>${ok} von ${L.length} Zeilen richtig.</b></div><ul class="tl">${li.join('')}</ul>`;
  }
  $('#weView').addEventListener('change', e => { const i = e.target.dataset.wi; if (i == null) return; S.weSel[+i] = e.target.value; S.weDone = false; const r = $('#weRes'); if (r) r.innerHTML = ''; });
  $('#weView').addEventListener('click', e => {
    const b = e.target.closest('[data-we]'); if (!b) return;
    if (b.dataset.we === 'new') { S.we.seed = newSeed(); lsSet('we', S.we); S.weSel = {}; S.weDone = false; renderWe(); return; }
    const del = C.makeDelivery(S.we.seed);
    if (!del.lines.every((_, i) => S.weSel[i])) { toast('Wähle zuerst für jede Zeile einen Befund.'); return; }
    S.weDone = true; weResult(del);
    const all = del.lines.every((l, i) => C.lineFinding(l) === S.weSel[i]); if (all) ding(); else sad();
  });

  /* ============================================================ Lagerstrategien */
  const lagParams = s => ({ rows: s.rows.map((r, i) => ({ id: 'Charge ' + 'ABCD'[i], ein: P(r.ein), mhd: P(r.mhd), qty: P(r.qty) })), q: P(s.q), strat: s.strat });
  function lagOut(p) {
    const okD = v => Number.isInteger(v) && v >= 1 && v <= 365;
    if (!p.rows.every(r => okD(r.ein) && okD(r.mhd) && r.qty >= 0)) return note('Gib den Einlagertag und den Ablauftag als ganze Zahl von 1 bis 365 (Tag im Jahr) und die Menge als Zahl ein.');
    if (!(p.q >= 0)) return note('Gib die Entnahmemenge als Zahl ein.');
    let h = '';
    C.STRATS.forEach(st => {
      const w = C.withdraw(p.rows, st.k, p.q), ord = C.orderBatches(p.rows, st.k);
      h += box(st.n + (st.k === p.strat ? ' (gewählt)' : ''), '', w.picks.length ? w.picks.map(x => x.id + ': ' + f(x.qty, 0) + ' Stück').join(', ') : 'keine Entnahme', st.k === p.strat ? '' : 'warn') + (st.k === p.strat ? `<p class="hint2" style="margin:-4px 0 6px">Reihenfolge: ${esc(ord.map(x => x.id + ' (eingelagert ' + C.dayStr(x.ein) + ', haltbar bis ' + C.dayStr(x.mhd) + ')').join(' → '))}</p>` : '');
    });
    const ff = C.orderBatches(p.rows, 'fifo')[0], fe = C.orderBatches(p.rows, 'fefo')[0];
    if (ff && fe && ff.id !== fe.id) h += note('Achtung: FIFO und FEFO wählen verschiedene Chargen. Nach FIFO wird ' + ff.id + ' zuerst entnommen (eingelagert ' + C.dayStr(ff.ein) + ', haltbar bis ' + C.dayStr(ff.mhd) + '), nach FEFO ' + fe.id + ' (haltbar nur bis ' + C.dayStr(fe.mhd) + '). Bei Ware mit Ablaufdatum gilt FEFO, sonst läuft ' + fe.id + ' ab, bevor sie gebraucht wird.');
    const stock = p.rows.reduce((a, r) => a + r.qty, 0);
    if (p.q > stock) h += note('Es liegen nur ' + f(stock, 0) + ' Stück im Lager, ' + f(p.q - stock, 0) + ' Stück fehlen.', 'bad');
    p.rows.filter(r => r.mhd < r.ein).forEach(r => { h += note(r.id + ': Das Ablaufdatum liegt vor der Einlagerung. Prüfe die Eingabe.', 'bad'); });
    return h;
  }
  function platzOut(m) {
    const pn = C.placeNeed(m); if (!pn) return note('Bitte alle zwölf Bestände als Zahlen eingeben (nicht negativ).');
    const nm = 'ABC';
    let h = box('Feste Zuordnung: Höchstbestand je Artikel zusammenzählen', m.map(r => f(Math.max.apply(null, r), 0)).join(' + '), f(pn.fixed, 0) + ' Plätze');
    h += box('Freie Platzwahl: höchste Monatssumme (' + pn.colSum.map(v => f(v, 0)).join(', ') + ')', '', f(pn.free, 0) + ' Plätze');
    h += box('Ersparnis durch freie Platzwahl', f(pn.fixed, 0) + ' − ' + f(pn.free, 0), f(pn.saving, 0) + ' Plätze', pn.saving > 0 ? 'ok' : '');
    h += box('Ø Platzauslastung', 'Ø Bestand ' + f(pn.avg, 1) + ' / Plätze', 'fest ' + f(pn.utilFixed, 1) + ' % · frei ' + f(pn.utilFree, 1) + ' %');
    return h + `<p class="hint2">Freie Platzwahl braucht ein Lagerverwaltungssystem, das jeden Platz bucht. Eine Reserve für Spitzen ist hier nicht eingerechnet. Artikel ${nm.split('').slice(0, m.length).join(', ')}.</p>`;
  }
  function slotsOut(occ) {
    const nx = C.nextFreeSlot(occ, 2, 3, 3);
    return `<div class="slotg">${allSlots.map(s => `<button data-sl="${s}" class="${occ.includes(s) ? 'on' : ''}${s === nx ? ' nx' : ''}">${s}</button>`).join('')}</div>` +
      (nx ? box('Nächster freier Platz (Gang, Fach, Ebene aufsteigend)', '', nx, 'ok') : note('Alle Plätze sind belegt.', 'bad')) + `<p class="hint2">${occ.length} von ${allSlots.length} Plätzen belegt. Tippe auf einen Platz, um ihn zu belegen oder freizugeben.</p>`;
  }
  function renderLag() {
    const s = S.lag;
    $('#lagView').innerHTML = ueb() + `<div class="card pl"><h4>Entnahme nach Strategie</h4>
      <div class="tw"><table class="tt"><tr><th>Charge</th><th>Einlagertag (1 bis 365)</th><th>Ablauftag (1 bis 365)</th><th>Menge</th></tr>${s.rows.map((r, i) => `<tr><td><b>Charge ${'ABCD'[i]}</b></td><td>${cell('data-r="' + i + '" data-f="ein"', r.ein)}<small class="hint2" data-dd="${i}:ein">${esc(C.dayStr(P(r.ein)))}</small></td><td>${cell('data-r="' + i + '" data-f="mhd"', r.mhd)}<small class="hint2" data-dd="${i}:mhd">${esc(C.dayStr(P(r.mhd)))}</small></td><td>${cell('data-r="' + i + '" data-f="qty"', r.qty)}</td></tr>`).join('')}</table></div>
      <div class="dsrow">${inp('q', 'Gewünschte Entnahmemenge', s.q, 'Stück')}</div>
      <div class="fbar">${lbl('STRATEGIE')}${seg('data-st', C.STRATS.map(x => [x.k, x.k.toUpperCase()]), s.strat)}</div>
      <div id="lagOut"></div>${XREF('Lager-Lab', 'FIFO, LIFO und chaotische Lagerhaltung als Begriffe stehen dort unter Lagerorganisation. Hier rechnest du mit Chargen und Plätzen.')}</div>
      <div class="card pl"><h4>Plätze: fest oder frei</h4><p class="hint2" style="margin:0 0 6px">Bestand in Paletten am Monatsende je Artikel (vier Monate).</p>
      <div class="tw"><table class="tt"><tr><th>Artikel</th><th>Monat 1</th><th>Monat 2</th><th>Monat 3</th><th>Monat 4</th></tr>${s.m.map((r, i) => `<tr><td><b>${'ABC'[i]}</b></td>${r.map((v, j) => `<td>${cell('data-mr="' + i + '" data-mc="' + j + '"', v)}</td>`).join('')}</tr>`).join('')}</table></div><div id="platzOut"></div></div>
      <div class="card pl"><h4>Freie Platzwahl: nächster freier Platz</h4><div id="slotOut"></div></div>`;
    updateLag();
  }
  function updateLag() { $('#lagOut').innerHTML = lagOut(lagParams(S.lag)); $('#platzOut').innerHTML = platzOut(S.lag.m.map(r => r.map(P))); $('#slotOut').innerHTML = slotsOut(S.lag.occ); }
  $('#lagView').addEventListener('input', e => {
    const t = e.target, d = t.dataset;
    if (d.r != null) { S.lag.rows[+d.r][d.f] = t.value; const el = $('[data-dd="' + d.r + ':' + d.f + '"]', $('#lagView')); if (el) el.textContent = C.dayStr(P(t.value)); }
    else if (d.mr != null) S.lag.m[+d.mr][+d.mc] = t.value;
    else if (d.k === 'q') S.lag.q = t.value; else return;
    lsSet('lag', S.lag); updateLag();
  });
  $('#lagView').addEventListener('click', e => {
    const st = e.target.closest('[data-st]'), sl = e.target.closest('[data-sl]');
    if (st) { S.lag.strat = st.dataset.st; lsSet('lag', S.lag); $$('[data-st]', $('#lagView')).forEach(b => b.classList.toggle('on', b.dataset.st === S.lag.strat)); updateLag(); return; }
    if (sl) { const i = S.lag.occ.indexOf(sl.dataset.sl); if (i >= 0) S.lag.occ.splice(i, 1); else S.lag.occ.push(sl.dataset.sl); lsSet('lag', S.lag); $('#slotOut').innerHTML = slotsOut(S.lag.occ); }
  });

  /* ============================================================ Kommissionieren */
  const toPk = arr => arr.map(q => ({ a: q[0], p: q[1] }));
  const KX = a => 50 + a * 70, KY = p => 330 - p * 14, kpt = pt => [50 + pt.x / C.LAYOUT.w * 70, 330 - pt.y * 14];
  function komSvg(picks, show, interactive) {
    const Lg = C.LAYOUT; let s = '';
    for (let i = 0; i <= Lg.aisles; i++) s += `<rect class="shelf" x="${KX(i) + 20}" y="${KY(Lg.L)}" width="30" height="${KY(0) - KY(Lg.L)}" rx="3"/>`;
    for (let a = 0; a <= Lg.aisles; a++) s += `<line class="aisle" x1="${KX(a)}" x2="${KX(a)}" y1="${KY(Lg.L)}" y2="${KY(0)}"/><text class="g-lab m" x="${KX(a)}" y="${KY(Lg.L) - 8}" text-anchor="middle">${a ? 'Gang ' + a : 'Ausgang'}</text>`;
    s += `<line class="cross" x1="${KX(0) - 14}" x2="${KX(Lg.aisles) + 14}" y1="${KY(0)}" y2="${KY(0)}"/><line class="cross" x1="${KX(0) - 14}" x2="${KX(Lg.aisles) + 14}" y1="${KY(Lg.L)}" y2="${KY(Lg.L)}"/>`;
    s += `<text class="g-lab m" x="${KX(Lg.aisles) + 38}" y="${KY(0) + 4}" text-anchor="start">0 m</text><text class="g-lab m" x="${KX(Lg.aisles) + 38}" y="${KY(Lg.L) + 4}" text-anchor="start">20 m</text>`;
    const route = (pk, cls) => { if (!pk.length) return ''; return `<polyline class="${cls}" points="${C.routePath(pk).map(pt => kpt(pt).join(',')).join(' ')}"/>`; };
    if (picks.length) {
      if (show === 'mine' || show === 'all') s += route(picks, 'rt1');
      if (show === 's' || show === 'all') s += route(C.sShapeOrder(picks), 'rt2');
      if ((show === 'best' || show === 'all') && picks.length <= 8) s += route(C.bestOrder(picks).order || [], 'rt3');
    }
    const idx = {}; picks.forEach((q, i) => { idx[q.a + '/' + q.p] = i + 1; });
    for (let a = 1; a <= Lg.aisles; a++) Lg.slots.forEach(p => { const n = idx[a + '/' + p]; s += `<circle class="slot${n ? ' on' : ''}" ${interactive ? `data-a="${a}" data-p="${p}"` : ''} cx="${KX(a)}" cy="${KY(p)}" r="${n ? 10 : 8}"><title>Gang ${a}, ${p} m</title></circle>`; if (n) s += `<text class="pn" x="${KX(a)}" y="${KY(p) + 4}">${n}</text>`; });
    s += `<rect class="basis" x="${KX(0) - 9}" y="${KY(0) - 9}" width="18" height="18" rx="3"/><text class="g-lab" x="${KX(0)}" y="${KY(0) + 26}" text-anchor="middle">Basis</text>`;
    return `<svg viewBox="0 0 540 380" role="img" aria-label="Lagergrundriss mit sechs Gängen, Basis und Pickplätzen">${s}</svg>`;
  }
  function komOut(picks) {
    if (!picks.length) return note('Tippe im Plan auf Plätze (Kreise), um die Pickliste zu füllen. Die Nummer zeigt die Reihenfolge. Höchstens 8 Plätze.', 'warn');
    const mine = C.routeLength(picks), so = C.sShapeOrder(picks), best = C.bestOrder(picks);
    let h = box('Pickliste', '', picks.map(q => q.a + '/' + q.p).join(', '));
    h += box('Weg in deiner Reihenfolge (Basis, alle Plätze, zurück)', '', f(mine, 0) + ' m');
    h += box('Weg nach Gängen sortiert (S-Form-Reihenfolge: ' + so.map(q => q.a + '/' + q.p).join(', ') + ')', '', f(C.routeLength(so), 0) + ' m');
    h += box('Kürzeste Reihenfolge (alle Reihenfolgen probiert: ' + (best.order || []).map(q => q.a + '/' + q.p).join(', ') + ')', '', f(best.len, 0) + ' m');
    h += box('Ersparnis kürzeste gegenüber deiner Reihenfolge', f(mine, 0) + ' − ' + f(best.len, 0), f(mine - best.len, 0) + ' m (' + f(mine > 0 ? (mine - best.len) / mine * 100 : 0, 1) + ' %)', mine - best.len > 0 ? 'ok' : '');
    h += box('S-Form-Strategie (jeden Gang mit Positionen ganz durchlaufen)', '', f(C.sShapeLength(picks), 0) + ' m');
    h += box('Stichstrategie (jeden Gang vorn betreten, nur bis zum hintersten Platz)', '', f(C.stichLength(picks), 0) + ' m');
    return h;
  }
  function leistOut(p) {
    const sec = C.pickSeconds(p.weg, p.v, p.n, p.tg, p.tb);
    if (!Number.isFinite(sec)) return note('Gib Weg, Gehgeschwindigkeit (größer als 0), Positionen, Greifzeit und Basiszeit als Zahlen ein.');
    let h = box('Gehzeit', f(p.weg, 0) + ' m / ' + f(p.v, 2) + ' m/s', f(p.weg / p.v, 0) + ' s');
    h += box('Greifzeit', f(p.n, 0) + ' · ' + f(p.tg, 0) + ' s', f(p.n * p.tg, 0) + ' s');
    h += box('Gesamtzeit je Auftrag', f(p.weg / p.v, 0) + ' + ' + f(p.n * p.tg, 0) + ' + ' + f(p.tb, 0) + ' s', f(sec, 0) + ' s (' + f(sec / 60, 1) + ' min)');
    h += box('Pickleistung', f(p.n, 0) + ' / ' + f(sec, 0) + ' s · 3600', f(C.pickRate(p.n, sec), 1) + ' Positionen je Stunde');
    if (p.tot > 0) h += box('Fehlerquote', f(p.err, 0) + ' / ' + f(p.tot, 0) + ' · 100', f(C.errorRate(p.err, p.tot), 2) + ' %', C.errorRate(p.err, p.tot) > 1 ? 'warn' : 'ok') + `<p class="hint2">Je 1.000 Positionen sind das ${f(C.errorRate(p.err, p.tot) * 10, 1)} falsche Positionen.</p>`;
    return h;
  }
  const leistParams = s => ({ weg: P(s.weg), v: P(s.v), n: s.n === '' ? S.kom[S.kom.cur].length : P(s.n), tg: P(s.tg), tb: P(s.tb), err: P(s.err), tot: P(s.tot) });
  function bundleOut() {
    const a = toPk(S.kom.A), b = toPk(S.kom.B); if (!a.length || !b.length) return note('Fülle Auftrag A und Auftrag B (Schalter oben), dann siehst du hier, was die Bündelung spart.', 'warn');
    const bs = C.bundleSaving([a, b]);
    return box('Zwei Rundgänge nach S-Form', f(C.sShapeLength(a), 0) + ' + ' + f(C.sShapeLength(b), 0), f(bs.single, 0) + ' m') + box('Ein gemeinsamer Rundgang (S-Form)', '', f(bs.joint, 0) + ' m') + box('Ersparnis durch Bündelung', '', f(bs.saving, 0) + ' m (' + f(bs.pct, 1) + ' %)', bs.saving > 0 ? 'ok' : '') + '<p class="hint2">Dafür muss die gesammelte Ware hinterher den Aufträgen zugeteilt werden. Das kostet Zeit und ist hier nicht eingerechnet.</p>';
  }
  function renderKom() {
    const s = S.kom;
    $('#komView').innerHTML = ueb() + `<div class="card pl wf"><h4>Kommissionier-Simulator</h4>
      <p class="hint2" style="margin:0 0 6px">${esc('Gänge 1 bis 6, je 20 m lang, 3 m Abstand, Quergänge vorn und hinten, Start und Ziel an der Basis (Ausgang). Plätze liegen alle 4 m. Tippe auf Kreise, um sie in die Pickliste zu legen (erneut tippen entfernt).')}</p>
      <div class="fbar">${lbl('AUFTRAG')}${seg('data-cur', [['A', 'A'], ['B', 'B']], s.cur)}${lbl('WEG ZEIGEN')}${seg('data-show', [['mine', 'meine'], ['s', 'nach Gängen'], ['best', 'kürzeste'], ['all', 'alle'], ['none', 'keiner']], s.show)}</div>
      <div id="komSvg" class="inst"></div>
      <p class="hint2"><span style="color:var(--hi)">━</span> meine Reihenfolge · <span style="color:var(--ok)">╌</span> nach Gängen sortiert (S-Form-Reihenfolge) · <span style="color:var(--accent)">┄</span> kürzeste Reihenfolge</p>
      <div class="btns"><button class="btn" data-ko="demo">Beispielauftrag</button><button class="btn" data-ko="undo">↶ Letzten entfernen</button><button class="btn" data-ko="clear">Leeren</button><button class="btn" data-ko="sform">Nach Gängen sortieren</button><button class="btn" data-ko="best">Kürzeste Reihenfolge übernehmen</button></div>
      <div id="komOut"></div></div>
      <div class="card pl"><h4>Pickleistung und Fehlerquote</h4><div class="dsrow">${inp('weg', 'Weg je Auftrag', s.weg, 'm')}${inp('v', 'Gehgeschwindigkeit', s.v, 'm/s')}${inp('n', 'Positionen (leer = Pickliste)', s.n, 'Stück')}${inp('tg', 'Greifzeit je Position', s.tg, 's')}${inp('tb', 'Basiszeit je Auftrag', s.tb, 's')}${inp('err', 'Falsche Positionen', s.err, 'Stück')}${inp('tot', 'Kontrollierte Positionen', s.tot, 'Stück')}</div>
      <div class="btns"><button class="btn" data-ko="weg">Weg meiner Reihenfolge übernehmen</button></div><div id="leistOut"></div></div>
      <div class="card pl"><h4>Auftragsbündelung (Auftrag A und B)</h4><div id="bundleOut"></div></div>`;
    updateKom();
  }
  function updateKom() {
    const s = S.kom, pk = toPk(s[s.cur]);
    $('#komSvg').innerHTML = komSvg(pk, s.show, true); $('#komOut').innerHTML = komOut(pk);
    $('#leistOut').innerHTML = leistOut(leistParams(s)); $('#bundleOut').innerHTML = bundleOut();
  }
  $('#komView').addEventListener('click', e => {
    const s = S.kom, cu = e.target.closest('[data-cur]'), sh = e.target.closest('[data-show]'), ko = e.target.closest('[data-ko]'), dot = e.target.closest('circle.slot[data-a]');
    if (cu) { s.cur = cu.dataset.cur; lsSet('kom', s); renderKom(); return; }
    if (sh) { s.show = sh.dataset.show; lsSet('kom', s); renderKom(); return; }
    if (dot) {
      const q = [+dot.dataset.a, +dot.dataset.p], L = s[s.cur], i = L.findIndex(x => x[0] === q[0] && x[1] === q[1]);
      if (i >= 0) L.splice(i, 1); else if (L.length >= 8) { toast('Höchstens 8 Plätze je Auftrag.'); return; } else L.push(q);
      lsSet('kom', s); updateKom(); return;
    }
    if (ko) {
      const a = ko.dataset.ko, L = s[s.cur];
      if (a === 'demo') s[s.cur] = s.cur === 'A' ? [[3, 10], [1, 6], [5, 14], [2, 18], [4, 6]] : [[2, 6], [3, 14], [6, 10]];
      else if (a === 'undo') L.pop(); else if (a === 'clear') s[s.cur] = [];
      else if (a === 'sform') s[s.cur] = C.sShapeOrder(toPk(L)).map(q => [q.a, q.p]);
      else if (a === 'best') { const b = C.bestOrder(toPk(L)); if (b.order) s[s.cur] = b.order.map(q => [q.a, q.p]); }
      else if (a === 'weg') { const pk = toPk(L); if (!pk.length) { toast('Die Pickliste ist leer.'); return; } s.weg = String(C.routeLength(pk)); lsSet('kom', s); renderKom(); return; }
      lsSet('kom', s); updateKom();
    }
  });
  $('#komView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.kom[k] = e.target.value; lsSet('kom', S.kom); $('#leistOut').innerHTML = leistOut(leistParams(S.kom)); });

  /* ============================================================ Stapler */
  const tragParams = s => ({ m: P(s.m), l: P(s.l), c: P(s.c), h: P(s.h), mS: P(s.mS), b: P(s.b), e: P(s.e) });
  function tragSvg(p) {
    const W = 620, H = 300, x0 = 62, x1 = 596, y0 = 262, y1 = 28, cx = c => x0 + (Math.min(1000, Math.max(300, c)) - 300) / 700 * (x1 - x0), cy = k => y0 - Math.min(2600, k) / 2600 * (y0 - y1);
    const hub = C.HUB.find(x => p.h <= x.bis); let s = '';
    for (let k = 0; k <= 2500; k += 500) s += `<line class="g-grid" x1="${x0}" x2="${x1}" y1="${cy(k)}" y2="${cy(k)}"/><text class="g-lab m" x="${x0 - 6}" y="${cy(k) + 4}" text-anchor="end">${k}</text>`;
    for (let c = 300; c <= 1000; c += 100) s += `<line class="g-grid" x1="${cx(c)}" x2="${cx(c)}" y1="${y0}" y2="${y1}"/><text class="g-lab m" x="${cx(c)}" y="${y0 + 15}" text-anchor="middle">${c}</text>`;
    s += `<line class="g-max" x1="${cx(500)}" x2="${cx(500)}" y1="${y0}" y2="${y1}"/><text class="g-lab m" x="${cx(500) + 4}" y="${y1 + 10}">Nenn-Lastschwerpunkt 500 mm</text>`;
    C.HUB.forEach(x => { const pts = []; for (let c = 300; c <= 1000; c += 10) pts.push(cx(c) + ',' + cy(C.restCap(x.q, c))); s += `<polyline class="curve${hub === x ? ' sel' : ''}" points="${pts.join(' ')}"/><text class="g-lab${hub === x ? '' : ' m'}" x="${cx(300) + 4}" y="${cy(x.q) - 5}">bis ${x.bis} mm Hub</text>`; });
    if (p.m > 0 && p.c > 0) { const rest = hub ? C.restCap(hub.q, p.c) : NaN, ok = Number.isFinite(rest) && p.m <= rest, col = ok ? 'var(--ok)' : 'var(--danger)'; s += `<circle cx="${cx(p.c)}" cy="${cy(p.m)}" r="7" fill="${col}" stroke="var(--fg)" stroke-width="1.5"/><text class="g-lab" x="${Math.min(cx(p.c) + 10, x1 - 70)}" y="${cy(p.m) - 10}" style="fill:${col}">${ok ? 'Last passt' : 'Last zu schwer'}</text>`; }
    s += `<text class="g-lab m" x="${(x0 + x1) / 2}" y="${H - 6}" text-anchor="middle">Lastschwerpunkt c (mm) vom Gabelrücken</text><text class="g-lab m" x="14" y="${(y0 + y1) / 2}" transform="rotate(-90 14 ${(y0 + y1) / 2})" text-anchor="middle">zulässige Last (kg)</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Traglastdiagramm: zulässige Last über dem Lastschwerpunkt für drei Hubhöhen">${s}</svg>`;
  }
  function tragOut(p) {
    if (!(p.m > 0) || !(p.c > 0) || !(p.h > 0)) return note('Gib Last, Lastschwerpunkt und Hubhöhe größer als 0 ein.');
    const Q = C.hubQ(p.h); if (!Number.isFinite(Q)) return note('Die Hubhöhe liegt außerhalb der Übungstabelle (höchstens ' + f(C.HUB[C.HUB.length - 1].bis, 0) + ' mm).', 'bad');
    const rest = C.restCap(Q, p.c), ok = p.m <= rest;
    let h = box('1. Nenntragfähigkeit bei ' + f(p.h, 0) + ' mm Hub (Typenschild, c = 500 mm)', '', f(Q, 0) + ' kg');
    h += box('2. Resttragfähigkeit bei c = ' + f(p.c, 0) + ' mm', p.c <= C.C0 ? 'c ≤ 500 mm: volle Tragfähigkeit' : f(Q, 0) + ' · 500 / ' + f(p.c, 0) + ', abgerundet', f(rest, 0) + ' kg');
    h += ok ? note('Die Last (' + f(p.m, 0) + ' kg) ist nicht schwerer als die Resttragfähigkeit (' + f(rest, 0) + ' kg): Anheben ist nach diesem Übungsmodell erlaubt. Auslastung ' + f(p.m / rest * 100, 0) + ' %.', 'ok') : note('Die Last (' + f(p.m, 0) + ' kg) ist schwerer als die Resttragfähigkeit (' + f(rest, 0) + ' kg): Nicht anheben. Zu schwer für diese Hubhöhe und diesen Lastschwerpunkt.', 'bad');
    h += `<div class="inst wf">${tragSvg(p)}</div>`;
    if (p.mS > 0 && p.b > 0 && p.e >= 0) {
      const km = C.tipMoment(p.m, p.c, p.e), sm = C.standMoment(p.mS, p.b), r = C.tipRatio(p.mS, p.b, p.m, p.c, p.e), lim = C.tipLoad(p.mS, p.b, p.c, p.e);
      h += box('3. Kippmoment der Last um die Vorderachse', f(p.m, 0) + ' kg · (' + f(p.c, 0) + ' + ' + f(p.e, 0) + ') mm', f(km, 0) + ' kg·mm');
      h += box('4. Standmoment des Staplers', f(p.mS, 0) + ' kg · ' + f(p.b, 0) + ' mm', f(sm, 0) + ' kg·mm');
      h += box('5. Verhältnis Standmoment / Kippmoment', f(sm, 0) + ' / ' + f(km, 0), f(r, 2), r > 1 ? 'ok' : 'bad');
      h += box('6. Last im Gleichgewicht (Grenzlast)', 'Standmoment / (c + Abstand zur Vorderachse)', f(lim, 0) + ' kg') + `<p class="hint2">Übungsmodell: nur statisch, ohne Fahrbewegung, Mastneigung und Sicherheitsabstand. In der Praxis zählt immer die Tragfähigkeit auf dem Typenschild.</p>`;
    }
    return h;
  }
  function inspRows() {
    const ins = C.makeInspection(S.insSeed);
    return `<div class="tw"><table class="tt chk"><tr><th>Prüfpunkt</th><th>Beobachtung</th><th>Urteil</th></tr>${ins.items.map((it, i) => `<tr><td><b>${esc(it.n)}</b></td><td>${esc(it.text)}</td><td><select data-ii="${i}"><option value="">– wählen –</option><option value="ok"${S.insSel[i] === 'ok' ? ' selected' : ''}>In Ordnung</option><option value="bad"${S.insSel[i] === 'bad' ? ' selected' : ''}>Mangel</option></select></td></tr>`).join('')}</table></div>
      <label class="f"><span>Entscheidung für den Stapler</span><select data-iall="1"><option value="">– wählen –</option><option value="go"${S.insAll === 'go' ? ' selected' : ''}>Fahrbereit, Einsatz freigeben</option><option value="stop"${S.insAll === 'stop' ? ' selected' : ''}>Nicht benutzen, sperren und melden</option></select></label>
      <div class="btns"><button class="btn pri" data-in="chk">✓ Prüfung auswerten</button><button class="btn" data-in="new">Neuer Stapler</button></div><div id="insRes"></div>`;
  }
  /* PRUEFEN P20: Wortlaut der Rückmeldung bei Mangel ("nicht benutzen, sperren, kennzeichnen, melden, nicht selbst reparieren") mit der Betriebsanweisung für Flurförderzeuge abgleichen. Wer ist bei euch für Sperren und Reparatur zuständig? */
  function insResult() {
    const ins = C.makeInspection(S.insSeed), nb = C.inspectionBad(ins); let ok = 0;
    const li = ins.items.map((it, i) => { const right = S.insSel[i] === (it.bad ? 'bad' : 'ok'); if (right) ok++; return `<li class="${right ? 'ok' : 'bad'}">${right ? '✓' : '✗'} ${esc(it.n)}: ${it.bad ? '<b>Mangel</b>' : 'in Ordnung'}.</li>`; });
    const allRight = S.insAll === (nb ? 'stop' : 'go');
    $('#insRes').innerHTML = `<div class="rdout ${ok === ins.items.length && allRight ? 'ok' : 'warn'}"><b>${ok} von ${ins.items.length} Prüfpunkten richtig.</b> Entscheidung: ${allRight ? '✓ richtig' : '✗ falsch'}.</div><ul class="tl">${li.join('')}</ul><div class="rdout ${nb ? 'bad' : 'ok'}">${nb ? 'Bei ' + nb + ' Mangel/Mängeln darf der Stapler nicht benutzt werden. Sperren, kennzeichnen und nach dem betrieblichen Ablauf melden. Nicht selbst reparieren.' : 'Kein Mangel erkennbar: Der Stapler ist nach diesem Übungsstand fahrbereit.'}</div>`;
    return ok === ins.items.length && allRight;
  }
  function renderTrag() {
    const s = S.trag;
    $('#tragView').innerHTML = ueb() + `<div class="card pl"><h4>Traglast-Rechner</h4>
      <div class="dsrow">${inp('m', 'Masse der Last', s.m, 'kg')}${inp('l', 'Tiefe der Last in Gabelrichtung', s.l, 'mm')}${inp('c', 'Lastschwerpunkt c (bei gleichmäßiger Last: halbe Tiefe)', s.c, 'mm')}${inp('h', 'Hubhöhe', s.h, 'mm')}</div>
      <div class="dsrow">${inp('mS', 'Eigengewicht Stapler', s.mS, 'kg')}${inp('b', 'Schwerpunkt Stapler hinter der Vorderachse', s.b, 'mm')}${inp('e', 'Gabelrücken vor der Vorderachse', s.e, 'mm')}</div>
      <p class="hint2">Übungs-Typenschild (Lastschwerpunkt 500 mm): ${esc(C.HUB.map(x => 'bis ' + f(x.bis, 0) + ' mm Hub: ' + f(x.q, 0) + ' kg').join(' · '))}. Echte Werte stehen nur auf dem Typenschild deines Staplers.</p></div><div id="tragOut"></div>
      <div class="card pl"><h4>Prüfung vor Fahrtantritt</h4><p class="hint2" style="margin:0 0 6px">Dieser Stapler steht vor dir. Beurteile jeden Prüfpunkt und entscheide, ob er benutzt werden darf. Nichts verrät vorher, ob ein Mangel vorliegt.</p><div id="insBox">${inspRows()}</div>
      <p class="hint2">Fahrerlaubnis: Fahren dürfen nur unterwiesene, befähigte und vom Unternehmer beauftragte Personen. Die Einzelheiten regelt dein Betrieb, hier wird nur die Pflicht genannt.</p></div>`;
    updateTrag(); if (S.insDone) insResult();
  }
  function updateTrag() { $('#tragOut').innerHTML = tragOut(tragParams(S.trag)); }
  $('#tragView').addEventListener('input', e => {
    const k = e.target.dataset.k; if (!k) return; const s = S.trag; s[k] = e.target.value;
    if (k === 'l') { const c = C.loadCentre(P(s.l)); if (Number.isFinite(c)) { s.c = sc(c); const el = $('input[data-k=c]', $('#tragView')); if (el) el.value = s.c; } }
    lsSet('trag', s); updateTrag();
  });
  $('#tragView').addEventListener('change', e => { const d = e.target.dataset; if (d.ii != null) S.insSel[+d.ii] = e.target.value; else if (d.iall) S.insAll = e.target.value; else return; S.insDone = false; const r = $('#insRes'); if (r) r.innerHTML = ''; });
  $('#tragView').addEventListener('click', e => {
    const b = e.target.closest('[data-in]'); if (!b) return;
    if (b.dataset.in === 'new') { S.insSeed = newSeed(); lsSet('ins', S.insSeed); S.insSel = {}; S.insAll = ''; S.insDone = false; $('#insBox').innerHTML = inspRows(); return; }
    const ins = C.makeInspection(S.insSeed);
    if (!ins.items.every((_, i) => S.insSel[i]) || !S.insAll) { toast('Beurteile zuerst alle Prüfpunkte und triff die Entscheidung.'); return; }
    S.insDone = true; if (insResult()) ding(); else sad();
  });

  /* ============================================================ Inventur */
  function invOut(rows, blind) {
    const t = C.invTotals(rows); if (!t) return note('Bitte Soll, Ist und Preis aller Zeilen als Zahlen eingeben (nicht negativ).');
    let h = `<div class="tw"><table class="tt"><tr><th>Artikel</th><th class="n">Soll</th><th class="n">Ist</th><th class="n">Differenz</th><th class="n">Wert</th></tr>${rows.map(r => { const l = C.invLine(r.soll, r.ist, r.price); return `<tr><td>${esc(r.n)}</td><td class="n">${blind ? '?' : f(r.soll, 0)}</td><td class="n">${f(r.ist, 0)}</td><td class="n ${l.diff < 0 ? 'pc m' : l.diff > 0 ? 'pc' : ''}">${blind ? '?' : (l.diff > 0 ? '+' : '') + f(l.diff, 0)}</td><td class="n">${blind ? '?' : f(l.wert, 2) + ' €'}</td></tr>`; }).join('')}</table></div>`;
    if (blind) return h + note('Blindzählung: Der Sollbestand ist verdeckt. Erst nach der Zählung wird er aufgedeckt, damit niemand unbewusst den Sollwert übernimmt.', 'warn');
    h += box('Mehrbestand (Wert)', '', f(t.plus, 2) + ' €') + box('Fehlbestand (Wert)', '', f(t.minus, 2) + ' €') + box('Saldo der Differenzen', f(t.plus, 2) + ' − ' + f(t.minus, 2), f(t.saldo, 2) + ' €', t.saldo < 0 ? 'bad' : '');
    h += box('Artikel mit Differenz', f(t.nDiff, 0) + ' von ' + f(t.n, 0), f(t.quote, 1) + ' %');
    return h + `<p class="hint2">Ein kleiner Saldo kann täuschen: Mehr- und Fehlbestände heben sich teilweise auf. Prüfe deshalb Mehr- und Fehlbestand getrennt und zähle bei Abweichung nach. „Bestandsdifferenz buchen“ heißt: Der Buchbestand wird nach Klärung und Freigabe an den Istbestand angepasst (hier nur der Begriff).</p>`;
  }
  const invRows = s => s.rows.map(r => ({ n: r.n, soll: P(r.soll), ist: P(r.ist), price: P(r.p) }));
  function stichOut(p) {
    const v = C.stichtagBestand(p.z, p.zu, p.ab, p.dir !== 'vor'); if (!Number.isFinite(v)) return note('Gib Zählergebnis, Zugang und Abgang als Zahlen ein.');
    return p.dir === 'vor' ? box('Zählung vor dem Stichtag: Zugänge dazu, Abgänge weg', f(p.z, 0) + ' + ' + f(p.zu, 0) + ' − ' + f(p.ab, 0), f(v, 0) + ' Stück') : box('Zählung nach dem Stichtag: Zugänge weg, Abgänge dazu', f(p.z, 0) + ' − ' + f(p.zu, 0) + ' + ' + f(p.ab, 0), f(v, 0) + ' Stück');
  }
  const stichParams = s => ({ z: P(s.z), zu: P(s.zu), ab: P(s.ab), dir: s.dir });
  function sampleOut(p) {
    const v = C.extrapolate(p.sSum, p.n, p.N); if (!Number.isFinite(v)) return note('Gib Stichprobenumfang (höchstens Gesamtzahl), Gesamtzahl und Summe als Zahlen ein.');
    return box('Durchschnitt je gezähltem Artikel', f(p.sSum, 2) + ' € / ' + f(p.n, 0), f(p.sSum / p.n, 2) + ' €') + box('Hochrechnung auf alle Artikel', f(p.sSum / p.n, 2) + ' € · ' + f(p.N, 0), f(v, 2) + ' €') + '<p class="hint2">Nur ein Schätzwert. Ob das Verfahren im Betrieb zulässig ist und wie zufällig ausgewählt wird, regelt dein Betrieb.</p>';
  }
  const sampleParams = s => ({ n: P(s.n), N: P(s.N), sSum: P(s.sSum) });
  function renderInv() {
    const s = S.inv;
    $('#invView').innerHTML = ueb() + `<div class="card pl"><h4>Differenzliste</h4><div class="tw"><table class="tt"><tr><th>Artikel</th><th>Soll (System)</th><th>Ist (gezählt)</th><th>Preis €/Stück</th></tr>${s.rows.map((r, i) => `<tr><td>${esc(r.n)}</td><td>${s.blind ? '<span class="hint2">verdeckt</span>' : cell('data-r="' + i + '" data-f="soll"', r.soll)}</td><td>${cell('data-r="' + i + '" data-f="ist"', r.ist)}</td><td>${cell('data-r="' + i + '" data-f="p"', r.p)}</td></tr>`).join('')}</table></div>
      <div class="btns"><button class="btn${s.blind ? ' pri' : ''}" data-iv="blind">${s.blind ? 'Soll aufdecken' : 'Blindzählung: Soll verdecken'}</button><button class="btn" data-iv="reset">Beispieldaten</button></div><div id="invOut"></div></div>
      <div class="card pl"><h4>Bestand am Stichtag</h4><div class="fbar">${lbl('ZÄHLUNG')}${seg('data-dir', [['nach', 'nach dem Stichtag'], ['vor', 'vor dem Stichtag']], s.dir)}</div><div class="dsrow">${inp('z', 'Gezählter Bestand', s.z, 'Stück')}${inp('zu', 'Zugänge zwischen Stichtag und Zählung', s.zu, 'Stück')}${inp('ab', 'Abgänge zwischen Stichtag und Zählung', s.ab, 'Stück')}</div><div id="stichOut"></div></div>
      <div class="card pl"><h4>Stichprobe hochrechnen</h4><div class="dsrow">${inp('n', 'Gezählte Artikel (Stichprobe)', s.n, 'Stück')}${inp('N', 'Alle Artikel', s.N, 'Stück')}${inp('sSum', 'Fehlbestand der Stichprobe (Wert)', s.sSum, '€')}</div><div id="sampleOut"></div></div>
      <details class="dt"><summary>Verfahren im Überblick</summary><div class="hb2"><p><b>Stichtagsinventur:</b> Alle Bestände an einem Tag. <b>Permanente Inventur:</b> Zählung verteilt über das Jahr. <b>Stichprobeninventur:</b> Teil zählen, hochrechnen.</p><p class="hint2">Nur als Begriffe. Welche Verfahren dein Betrieb nutzt und was dafür gilt, regelt der Betrieb.</p></div></details>`;
    updateInv();
  }
  function updateInv() { const s = S.inv; $('#invOut').innerHTML = invOut(invRows(s), s.blind); $('#stichOut').innerHTML = stichOut(stichParams(s)); $('#sampleOut').innerHTML = sampleOut(sampleParams(s)); }
  $('#invView').addEventListener('input', e => { const d = e.target.dataset; if (d.r != null) S.inv.rows[+d.r][d.f] = e.target.value; else if (d.k) S.inv[d.k] = e.target.value; else return; lsSet('inv', S.inv); updateInv(); });
  $('#invView').addEventListener('click', e => {
    const b = e.target.closest('[data-iv]'), dr = e.target.closest('[data-dir]');
    if (dr) { S.inv.dir = dr.dataset.dir; lsSet('inv', S.inv); renderInv(); return; }
    if (!b) return;
    if (b.dataset.iv === 'blind') S.inv.blind = !S.inv.blind; else S.inv.rows = INVROWS.map(r => Object.assign({}, r));
    lsSet('inv', S.inv); renderInv();
  });

  /* ============================================================ Versand */
  const verParams = s => ({ l: P(s.l), b: P(s.b), h: P(s.h), kg: P(s.kg), pal: P(s.pal), pct: P(s.pct), k: P(s.k), n: P(s.n) });
  function verOut(p) {
    const chk = C.parcelCheck(p.l, p.b, p.h, p.kg); if (!chk) return note('Gib Länge, Breite, Höhe und Gewicht größer als 0 ein.');
    const mode = C.shipMode({ l: p.l, b: p.b, h: p.h, kg: p.kg, pal: p.pal >= 0 ? p.pal : 0 }), P0 = C.PAKET;
    const rest = chk.girth - chk.longest;
    let h = box('1. Längste Seite', 'größtes Maß', f(chk.longest, 0) + ' cm', chk.okLong ? '' : 'bad');
    h += box('2. Gurtmaß', 'längste Seite + 2 · (' + f(p.l + p.b + p.h - chk.longest, 0) + ') = ' + f(chk.longest, 0) + ' + ' + f(rest, 0), f(chk.girth, 0) + ' cm', chk.okGirth ? '' : 'bad');
    h += `<ul class="tl"><li class="${chk.okLong ? 'ok' : 'bad'}">${chk.okLong ? '✓' : '✗'} längste Seite ${f(chk.longest, 0)} cm (Grenze ${f(P0.longMax, 0)} cm)</li><li class="${chk.okGirth ? 'ok' : 'bad'}">${chk.okGirth ? '✓' : '✗'} Gurtmaß ${f(chk.girth, 0)} cm (Grenze ${f(P0.girthMax, 0)} cm)</li><li class="${chk.okKg ? 'ok' : 'bad'}">${chk.okKg ? '✓' : '✗'} Gewicht ${f(p.kg, 1)} kg (Grenze ${f(P0.kgMax, 1)} kg)</li></ul>`;
    h += typeof mode !== 'string' ? '' : box('3. Versandart (Übungsregel)', '', C.MODE_NAMES[mode], mode === 'paket' ? 'ok' : 'warn');
    const vol = C.volKg(p.l, p.b, p.h), bw = C.billWeight(p.kg, vol), fr = C.freight(bw);
    h += box('4. Raumgewicht', f(p.l, 0) + ' · ' + f(p.b, 0) + ' · ' + f(p.h, 0) + ' cm³ / 1.000.000 · ' + f(C.RAUM, 0) + ' kg/m³, aufgerundet', f(vol, 0) + ' kg');
    h += box('5. Abrechnungsgewicht', 'größeres von ' + f(Math.ceil(p.kg), 0) + ' kg und ' + f(vol, 0) + ' kg', f(bw, 0) + ' kg');
    if (Number.isFinite(fr)) { const tot = C.withSurcharge(fr, p.pct >= 0 ? p.pct : 0), t = C.TARIF.find(x => bw <= x.bis); h += box('6. Fracht nach Tarif, falls Stückgut (Stufe bis ' + f(t.bis, 0) + ' kg)', '', f(fr, 2) + ' €'); h += box('7. Mit Zuschlag ' + f(p.pct >= 0 ? p.pct : 0, 0) + ' %', f(fr, 2) + ' € · ' + f(1 + (p.pct >= 0 ? p.pct : 0) / 100, 2), f(tot, 2) + ' €'); }
    else h += note('Das Abrechnungsgewicht liegt über der Übungstabelle (höchstens ' + f(C.TARIF[C.TARIF.length - 1].bis, 0) + ' kg). Hier würde ein Angebot der Spedition eingeholt.', 'warn');
    return h;
  }
  function labelHtml(p) {
    const k = Number.isFinite(p.k) ? p.k : 1, n = Number.isFinite(p.n) ? p.n : 1;
    return `<div class="lbl"><b>Packstück ${f(k, 0)} / ${f(n, 0)}</b>Empfänger: Muster GmbH, Beispielweg 1, 00000 Musterstadt<br>Absender: Übungslager, Lagerstraße 2, 00000 Musterstadt<br>Gewicht: ${f(p.kg, 1)} kg · Maße: ${f(p.l, 0)} × ${f(p.b, 0)} × ${f(p.h, 0)} cm<br>Handhabung: Oben, vor Nässe schützen</div>`;
  }
  function renderVer() {
    const s = S.ver;
    $('#verView').innerHTML = ueb() + `<div class="card pl"><h4>Paket oder Spedition</h4><div class="dsrow">${inp('l', 'Länge', s.l, 'cm')}${inp('b', 'Breite', s.b, 'cm')}${inp('h', 'Höhe', s.h, 'cm')}${inp('kg', 'Gewicht', s.kg, 'kg')}${inp('pal', 'Paletten (0 = Paket)', s.pal, 'Stück')}${inp('pct', 'Zuschlag auf die Fracht', s.pct, '%')}</div><div id="verOut"></div></div>
      <div class="card pl"><h4>Packstück-Kennzeichnung</h4><div class="dsrow">${inp('k', 'Laufende Nummer', s.k, '')}${inp('n', 'Packstücke der Sendung', s.n, '')}</div><div id="lblOut"></div><p class="hint2">Jedes Packstück bekommt ein eigenes Etikett. „3 / 7“ heißt: drittes von sieben Packstücken. So fällt auf, wenn eines fehlt.</p></div>
      <details class="dt"><summary>Frachtpapiere im Überblick</summary><div class="hb2"><p><b>Lieferschein:</b> Art und Menge der Lieferung, Grundlage der Wareneingangsprüfung. <b>Frachtbrief:</b> Nachweis des Beförderungsvertrags mit dem Frachtführer (international z. B. CMR, hier nur genannt). <b>Packliste:</b> Inhalt je Packstück mit Maßen und Gewichten.</p><p class="hint2">Stark vereinfacht. Welche Papiere dein Betrieb nutzt, steht in der Versandanweisung.</p></div></details>
      ${XREF('Ladungssicherungs-Lab', 'Zurren, Ladeeinheiten, Verpackungssymbole und Gefahrgut stehen dort.')}`;
    updateVer();
  }
  function updateVer() { const p = verParams(S.ver); $('#verOut').innerHTML = verOut(p); $('#lblOut').innerHTML = labelHtml(p); }
  $('#verView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.ver[k] = e.target.value; lsSet('ver', S.ver); updateVer(); });

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
    $('#wissView').innerHTML = ueb() + h + '</div></div>';
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
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
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
      <div class="fbar"><span class="lbl2" style="font-size:12px;color:var(--mute)">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
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
  function exBody(e) {
    const p = e.p;
    if (e.tab === 'we') return weSolved(p.seed);
    if (e.tab === 'lag') return p.kind === 'ent' ? lagOut({ rows: p.rows, q: p.q, strat: p.strat }) : platzOut(p.m);
    if (e.tab === 'kom') { if (p.kind === 'route') { const pk = toPk(p.picks); return komOut(pk) + `<div class="inst wf">${komSvg(pk, 'all', false)}</div>`; } return leistOut({ weg: p.weg, v: p.v, n: p.n, tg: p.tg, tb: p.tb, err: p.err, tot: p.tot }); }
    if (e.tab === 'trag') return tragOut({ m: p.m, l: p.l, c: C.loadCentre(p.l), h: p.h, mS: p.mS, b: p.b, e: p.e });
    if (e.tab === 'inv') return p.kind === 'diff' ? invOut(p.rows.map(r => ({ n: r.n, soll: r.soll, ist: r.ist, price: r.p })), false) : stichOut({ z: p.z, zu: p.zu, ab: p.ab, dir: 'nach' });
    return verOut({ l: p.l, b: p.b, h: p.h, kg: p.kg, pal: p.pal, pct: p.pct });
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele (Übungswerte). Mit „In den Rechner laden“ öffnest du die Zahlen im passenden Reiter und kannst sie verändern.</p>` + D.examples.map(e => `<div class="card pl wf" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" data-ex="${e.id}">In den Rechner laden</button></div></div>`).join('');
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex), p = x.p;
    if (x.tab === 'we') { S.we.seed = p.seed; lsSet('we', S.we); S.weSel = {}; S.weDone = false; }
    else if (x.tab === 'lag') { if (p.kind === 'ent') { S.lag.rows = p.rows.map(r => ({ ein: sc(r.ein), mhd: sc(r.mhd), qty: sc(r.qty) })); while (S.lag.rows.length < 4) S.lag.rows.push({ ein: '1', mhd: '365', qty: '0' }); S.lag.q = sc(p.q); S.lag.strat = p.strat; } else S.lag.m = p.m.map(r => r.map(sc)); lsSet('lag', S.lag); }
    else if (x.tab === 'kom') { if (p.kind === 'route') { S.kom.A = p.picks.map(q => q.slice()); S.kom.cur = 'A'; S.kom.show = 'all'; } else { S.kom.weg = sc(p.weg); S.kom.v = sc(p.v); S.kom.n = sc(p.n); S.kom.tg = sc(p.tg); S.kom.tb = sc(p.tb); S.kom.err = sc(p.err); S.kom.tot = sc(p.tot); } lsSet('kom', S.kom); }
    else if (x.tab === 'trag') { S.trag = { m: sc(p.m), l: sc(p.l), c: sc(C.loadCentre(p.l)), h: sc(p.h), mS: sc(p.mS), b: sc(p.b), e: sc(p.e) }; lsSet('trag', S.trag); }
    else if (x.tab === 'inv') { if (p.kind === 'diff') { S.inv.rows = p.rows.map(r => ({ n: r.n, soll: sc(r.soll), ist: sc(r.ist), p: sc(r.p) })); S.inv.blind = false; } else { S.inv.z = sc(p.z); S.inv.zu = sc(p.zu); S.inv.ab = sc(p.ab); S.inv.dir = 'nach'; } lsSet('inv', S.inv); }
    else { S.ver = Object.assign({}, S.ver, { l: sc(p.l), b: sc(p.b), h: sc(p.h), kg: sc(p.kg), pal: sc(p.pal), pct: sc(p.pct) }); lsSet('ver', S.ver); }
    setTab(x.tab); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Wareneingang', `<p>Prüfe Art, Menge und Zustand. Vergleiche <b>Lieferschein gegen Bestellung</b> und beide gegen deine <b>Zählung</b>. Der Lieferschein ist nur eine Angabe des Lieferers.</p><table><tr><th>Befund</th><th>Merkmal</th></tr><tr><td>Mengenabweichung</td><td>zu wenig oder zu viel</td></tr><tr><td>Transportschaden</td><td>Verpackung beschädigt, Ware durch Transport zu Schaden gekommen</td></tr><tr><td>Qualitätsmangel</td><td>Verpackung heil, Ware selbst fehlerhaft</td></tr><tr><td>Falschlieferung</td><td>anderer Artikel als bestellt</td></tr></table><p><b>Ablauf bei Beanstandung:</b></p><ol>${C.ABLAUF.map(s => `<li>${esc(s)}</li>`).join('')}</ol><span class="eq">Werktagsfrist: Ankunftstag zählt nicht, Samstag und Sonntag zählen nicht (Übung)</span><p class="hint2">Die Mängelrüge wird nur als Ablauf beschrieben. Die Fristen (offen ${C.FRIST.offen}, versteckt ${C.FRIST.versteckt} Werktage) sind frei gewählte Übungswerte und keine Rechtsaussage.</p>`, true) +
      sec('Lagerstrategien und Platzvergabe', `<table><tr><th>Strategie</th><th>Entnahme</th></tr><tr><td>FIFO</td><td>zuerst eingelagert, zuerst entnommen (Einlagerdatum)</td></tr><tr><td>LIFO</td><td>zuletzt eingelagert, zuerst entnommen</td></tr><tr><td>FEFO</td><td>zuerst ablaufend, zuerst entnommen (Ablaufdatum)</td></tr></table><span class="eq">Feste Plätze = Σ Höchstbestand je Artikel</span><span class="eq">Freie Platzwahl = höchste Gesamtsumme eines Monats</span><span class="eq">Platzadresse: Gang-Fach-Ebene, Ebene 1 unten</span><p class="hint2">Kennzahlen wie Umschlagshäufigkeit, Lagerdauer, Meldebestand und die ABC-Analyse stehen im Lager-Lab.</p>`) +
      sec('Kommissionierung', `<p>Mann-zur-Ware: Person geht zur Ware. Ware-zum-Mann: Ware kommt zur Person. Hilfsmittel: Papierpickliste, Pick-by-Voice, Pick-by-Light.</p><span class="eq">Weg zwischen Gängen = Gangabstand · 3 m + kürzerer Weg über vorn oder hinten</span><span class="eq">S-Form: n · 20 m + 2 · letzter Gang · 3 m (+ 20 m bei ungerader Gangzahl)</span><span class="eq">Stichstrategie: 2 · letzter Gang · 3 m + Σ 2 · hinterster Platz je Gang</span><span class="eq">Gesamtzeit = Weg / v + Positionen · Greifzeit + Basiszeit</span><span class="eq">Pickleistung = Positionen / Zeit in s · 3600</span><span class="eq">Fehlerquote = falsche Positionen / alle Positionen · 100</span><p>Bei der <b>Auftragsbündelung</b> werden mehrere Aufträge in einem Rundgang gesammelt und danach aufgeteilt.</p>`) +
      sec('Flurförderzeuge (Gabelstapler)', `<span class="eq">Lastschwerpunkt c = Tiefe in Gabelrichtung / 2</span><span class="eq">Resttragfähigkeit = Nenntragfähigkeit · 500 / c (bei c ≤ 500 mm volle Tragfähigkeit)</span><span class="eq">Kippmoment = Last · (c + Abstand Gabelrücken zur Vorderachse)</span><span class="eq">Standmoment = Eigengewicht · Abstand Schwerpunkt zur Vorderachse</span><table><tr><th>Hubhöhe</th><th>Nenntragfähigkeit (Übung)</th></tr>${C.HUB.map(x => `<tr><td>bis ${esc(f(x.bis, 0))} mm</td><td>${esc(f(x.q, 0))} kg</td></tr>`).join('')}</table><p>Vor Fahrtantritt: Sicht- und Funktionsprüfung nach Betriebsanweisung. Bei sicherheitsrelevanten Mängeln nicht benutzen, sperren und melden. <b>Fahrerlaubnis:</b> Fahren dürfen nur unterwiesene, befähigte und beauftragte Personen (nur als Pflicht genannt).</p><p class="hint2">Echte Tragfähigkeiten stehen nur auf dem Typenschild bzw. im Traglastdiagramm des jeweiligen Staplers.</p>`) +
      sec('Inventur', `<span class="eq">Differenz = Ist − Soll (Fehlbestand negativ)</span><span class="eq">Wert der Differenz = Differenz · Preis</span><span class="eq">Bestand am Stichtag (Zählung danach) = gezählt − Zugänge + Abgänge</span><span class="eq">Hochrechnung = Summe der Stichprobe / Stichprobenumfang · Gesamtzahl</span><p>Stichtagsinventur, permanente Inventur und Stichprobeninventur sind Verfahren. Die Blindzählung verdeckt den Sollbestand. „Bestandsdifferenz buchen“ heißt, den Buchbestand nach Klärung und Freigabe an den Istbestand anzupassen (nur Begriff).</p>`) +
      sec('Versand und Frachtpapiere', `<span class="eq">Gurtmaß = längste Seite + 2 · (die beiden anderen Seiten)</span><span class="eq">Raumgewicht = Länge · Breite · Höhe (m³) · 200 kg/m³</span><span class="eq">Abrechnungsgewicht = größeres von Gewicht und Raumgewicht</span><table><tr><th>Papier</th><th>Aufgabe</th></tr><tr><td>Lieferschein</td><td>Art und Menge der Lieferung</td></tr><tr><td>Frachtbrief</td><td>Nachweis des Beförderungsvertrags</td></tr><tr><td>Packliste</td><td>Inhalt je Packstück</td></tr></table><p>Paket-Übungsgrenzen: Gewicht höchstens ${esc(f(C.PAKET.kgMax, 1))} kg, längste Seite höchstens ${esc(f(C.PAKET.longMax, 0))} cm, Gurtmaß höchstens ${esc(f(C.PAKET.girthMax, 0))} cm. Alles andere: Stückgut. Tarifstufen: ${esc(C.TARIF.map(t => 'bis ' + f(t.bis, 0) + ' kg ' + f(t.p, 0) + ' €').join(', '))}.</p><p class="hint2">Zurrmittel, Ladeeinheiten, Verpackungssymbole und Gefahrgut stehen im Ladungssicherungs-Lab.</p>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte; Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'we'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ we: renderWe, lag: renderLag, kom: renderKom, trag: renderTrag, inv: renderInv, ver: renderVer, wiss: renderWiss, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Warenfluss-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Warenfluss-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('we');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe und Formeln', 'Wareneingang, Lager, Kommissionieren, Stapler, Inventur, Versand'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.WFL_LAB = { id: 'wfl', title: 'Warenfluss-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.WFL_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'we');
  /* Aufruf ?aufgabe=wfl1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=fefo1 springt zu einem Beispiel) */
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
