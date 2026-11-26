'use strict';
/* Tonfunk Produktions-Lab: Oberfläche (Lab-Kennung 'prd'). Industriekaufleute, LF 6, 2. Lehrjahr.
   ALLE Zahlen sind ÜBUNGSWERTE im frei erfundenen Modellbetrieb (Elektronikfertigung), Produkte frei erfunden.
   Reiter: Fertigung (Hallen-Skizzen), Kapazität (Linie mit Engpass), Losgröße (Kostenkurven), Termine (Balkenplan), Lean (Kanban, Ausschuss),
           Begriffe, Aufgaben, Trainer, Hilfe.
   Module: prdcore.js (PRD_CORE), prddata.js (PRD_DATA, PRD_TASKS), prdviz.js (PRD_VIZ, Bilder).
   Speicher (Präfix lm4.prd.): tab, fer, kap, los, ter, kan, wiss, mt, done ({id:true}), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt.
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) nur im Prüfmodus. Aufruf: prdlab.html?aufgabe=prd1 öffnet die Aufgabe. */
(function (root) {
  const C = root.PRD_CORE, D = root.PRD_DATA, V = root.PRD_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.prd.';
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
  if (!C || !D || !V) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Produktions-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">prdcore.js, prddata.js oder prdviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['fer', '🏭', 'Fertigung'], ['kap', '⚙️', 'Kapazität'], ['los', '📦', 'Losgröße'], ['ter', '📅', 'Termine'], ['kan', '🔁', 'Lean'], ['wiss', '🔤', 'Begriffe'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const SETKEYS = Object.keys(D.sets);
  const STN = [['Bestücken', 2, 1.2], ['Löten', 1, 1.5], ['Prüfen', 2, 2.4], ['Verpacken', 1, 0.6]];
  const OPS0 = [{ n: 'Bestücken', tr: '1', te: '1,2', ue: '2' }, { n: 'Löten', tr: '1,5', te: '0,9', ue: '4' }, { n: 'Prüfen', tr: '0,5', te: '2', ue: '6' }, { n: 'Verpacken', tr: '0,5', te: '0,6', ue: '2' }];
  const S = {
    tab: lsGet('tab', 'fer'),
    fer: Object.assign({ t: 'werk' }, lsGet('fer', {})),
    kap: Object.assign({ m: 6000, tage: 20, sch: 1, te: STN.map(s => s[2]) }, lsGet('kap', {})),
    los: Object.assign({ B: 12000, R: 150, p: 8, z: 20, x: 900 }, lsGet('los', {})),
    ter: Object.assign({ m: 200, T: 48, s: 0, mode: 'v', ops: OPS0 }, lsGet('ter', {})),
    kan: Object.assign({ v: 360, w: 2, si: 20, j: 100, gut: 950, aq: 5 }, lsGet('kan', {})),
    wiss: Object.assign({ key: SETKEYS[0] }, lsGet('wiss', {})),
    mt: lsGet('mt', {}), mq: {},
    task: null, tq: null, tAns: {}, tRes: null, tFehl: {},
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  /* Gespeicherte Zustände prüfen */
  if (!V.HALLS.includes(S.fer.t)) S.fer.t = 'werk';
  if (!Array.isArray(S.kap.te) || S.kap.te.length !== 4 || !S.kap.te.every(Number.isFinite)) S.kap.te = STN.map(s => s[2]);
  if (!Array.isArray(S.ter.ops) || S.ter.ops.length !== 4 || !S.ter.ops.every(o => o && ['tr', 'te', 'ue'].every(k => typeof o[k] === 'string'))) S.ter.ops = OPS0;
  if (!['v', 'r'].includes(S.ter.mode)) S.ter.mode = 'v';
  if (!SETKEYS.includes(S.wiss.key)) S.wiss.key = SETKEYS[0];
  if (!S.mt || typeof S.mt !== 'object') S.mt = {};
  SETKEYS.forEach(k => { if (!S.mt[k]) S.mt[k] = { n: 0, ok: 0 }; S.mq[k] = { i: -1, sel: -1 }; });
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const UEB = 'Alle Zahlen in diesem Lab sind Übungswerte im frei erfundenen Modellbetrieb (Elektronikfertigung), die Produkte sind erfunden.';
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const lbl = t => `<span style="font-size:14px;color:var(--mute)">${esc(t)}</span>`;
  /* Regler: Wert steht im Label und wird beim Schieben mitgeschrieben */
  const sl = (k, label, v, min, max, step, unit, d) => `<label class="f"><span>${esc(label)}: <b data-o="${k}">${esc(f(v, d || 0))} ${esc(unit)}</b></span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${v}" data-d="${d || 0}" data-u="${esc(unit)}" aria-label="${esc(label)}"></label>`;
  function slIn(view, st, key, e) {
    const t = e.target, k = t.dataset.k; if (!k || t.type !== 'range') return false;
    st[k] = +t.value; const o = $('[data-o="' + k + '"]', view); if (o) o.textContent = f(+t.value, +t.dataset.d) + ' ' + t.dataset.u; lsSet(key, st); return true;
  }
  /* Bild weich nachführen: Teile mit data-m behalten ihren Knoten, nur die Lage (style) ändert sich, so greift der CSS-Übergang */
  function morph(el, html) {
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    const a = el.firstElementChild, b = tmp.firstElementChild;
    if (!a || !b || a.tagName !== b.tagName || a.getAttribute('viewBox') !== b.getAttribute('viewBox')) { el.innerHTML = html; return; }
    const old = {}; [...a.children].forEach(n => { const m = n.getAttribute('data-m'); if (m) old[m] = n; else n.remove(); });
    let last = null;
    [...b.children].forEach(m => {
      const id = m.getAttribute('data-m'), o = id && old[id];
      if (o) { if (o.innerHTML !== m.innerHTML) o.innerHTML = m.innerHTML; o.setAttribute('style', m.getAttribute('style')); delete old[id]; last = o; return; }
      a.insertBefore(m, last ? last.nextSibling : a.firstChild); last = m;
    });
    Object.keys(old).forEach(k => old[k].remove());
    a.setAttribute('aria-label', b.getAttribute('aria-label'));
  }
  const stage = id => `<div class="inst pv" id="${id}"></div>`;

  /* ============================================================ Fertigung (Organisationstypen als Hallen-Skizzen) */
  const HALL = {
    werk: { n: 'Werkstattfertigung', d: 'Gleichartige Maschinen stehen in einer Werkstatt (Bohrerei, Lötraum, Prüffeld). Der Auftrag wandert je nach Arbeitsplan von Werkstatt zu Werkstatt.', vor: 'sehr beweglich, viele verschiedene Aufträge möglich, Ausfall einer Maschine stört wenig', nach: 'lange Wege, Liegezeiten, lange Durchlaufzeit, viel Planung', fa: 'Einzel- und Kleinserienfertigung, z. B. Prüfstand nach Kundenwunsch' },
    fliess: { n: 'Fließfertigung', d: 'Die Arbeitsplätze stehen in der Reihenfolge der Arbeitsgänge. Ein Band bringt jedes Stück im festen Takt weiter.', vor: 'kurze Wege und Durchlaufzeiten, niedrige Stückkosten, einfache Steuerung', nach: 'starr, teuer in der Anschaffung, störanfällig: Steht eine Station, steht die Linie; eintönige Arbeit', fa: 'Massen- und Großserienfertigung, z. B. Netzteile in großer Stückzahl' },
    gruppe: { n: 'Gruppenfertigung', d: 'Ein Team fertigt an einer Insel mit allen nötigen Plätzen ein ganzes Teil und plant die Arbeit selbst.', vor: 'kurze Wege, Abwechslung, Verantwortung, Qualität aus einer Hand', nach: 'mehr Maschinen nötig, Gruppe muss sich abstimmen', fa: 'Serienfertigung mit Varianten, z. B. Funkmodule' },
    bau: { n: 'Baustellenfertigung', d: 'Das Erzeugnis ist groß oder steht beim Kunden fest. Menschen, Werkzeug und Material kommen zu ihm.', vor: 'nur so möglich bei großen Anlagen, genau nach Kundenwunsch', nach: 'viel Transport von Leuten und Material, Wetter und Platz vor Ort, hohe Kosten', fa: 'Einzelfertigung, z. B. Schaltanlage im Gebäude des Kunden' }
  };
  function renderFer() {
    const h = HALL[S.fer.t];
    $('#ferView').innerHTML = `${stage('vzHall')}<div class="fbar">${lbl('ORGANISATIONSTYP')}${seg('data-ht', V.HALLS.map(k => [k, HALL[k].n.replace('fertigung', '')]), S.fer.t)}</div>
      <div class="card pl"><h4>${esc(h.n)}</h4><p style="margin:0 0 8px">${esc(h.d)}</p>${box('Vorteile', '', h.vor, 'ok')}${box('Nachteile', '', h.nach, 'bad')}${box('Passt meist zu', '', h.fa)}</div>
      <div class="card pl"><h4>Fertigungsarten: Wie oft wird gleich gefertigt?</h4><div class="tw"><table class="tt"><tr><th>Art</th><th>Merkmal</th><th>Beispiel im Modellbetrieb</th></tr>
      <tr><td><b>Einzelfertigung</b></td><td>ein Stück nach Kundenwunsch</td><td>Prüfstand nach Zeichnung</td></tr><tr><td><b>Serienfertigung</b></td><td>begrenzte Menge (Los), danach umrüsten</td><td>Steuerplatine SP-10 in Losen</td></tr>
      <tr><td><b>Sortenfertigung</b></td><td>Varianten aus demselben Ausgangsstoff</td><td>Kabel in Längen und Farben</td></tr><tr><td><b>Massenfertigung</b></td><td>sehr große Menge ohne geplantes Ende</td><td>Standard-Widerstandsnetzwerk</td></tr></table></div>
      <p class="hint2">Fertigungsart (wie oft) und Organisationstyp (wie angeordnet) sind zwei verschiedene Fragen. Zusammen beschreiben sie die Fertigung.</p></div>`;
    morph($('#vzHall'), V.hallSvg(S.fer.t));
  }
  $('#ferView').addEventListener('click', e => { const b = e.target.closest('[data-ht]'); if (!b) return; S.fer.t = b.dataset.ht; lsSet('fer', S.fer); renderFer(); });

  /* ============================================================ Kapazität (Linie mit Engpass) */
  function kapRows() {
    const s = S.kap, ang = n => C.kapAngebot(n, s.tage, s.sch * 8);
    return STN.map((st, i) => ({ n: st[0], m: st[1], te: s.te[i], angebot: ang(st[1]), bedarf: C.kapBedarf(s.m, s.te[i], 0) }));
  }
  function renderKap() {
    const s = S.kap;
    $('#kapView').innerHTML = stage('vzLine') + `<div class="card pl"><h4>Linie für die Steuerplatine SP-10</h4><div class="dsrow">${sl('m', 'Menge im Monat', s.m, 1000, 12000, 100, 'Stück')}${sl('tage', 'Arbeitstage', s.tage, 18, 23, 1, 'Tage')}${sl('sch', 'Schichten zu 8 h', s.sch, 1, 3, 1, '')}</div>
      <p class="hint2" style="margin:0 0 4px">Stückzeiten je Station (Minuten je Platine):</p><div class="dsrow">${STN.map((st, i) => sl('te' + i, st[0] + ' (' + st[1] + (st[1] > 1 ? ' Plätze' : ' Platz') + ')', s.te[i], 0.2, 4, 0.1, 'min', 1)).join('')}</div><div id="kapOut"></div></div>`;
    updKap();
  }
  function updKap() {
    const rows = kapRows(), e = C.engpass(rows);
    morph($('#vzLine'), V.lineSvg(rows));
    let h = `<div class="tw"><table class="tt"><tr><th>Station</th><th class="n">Bedarf</th><th class="n">Kapazität</th><th class="n">Grad</th></tr>${rows.map(r => `<tr><td>${esc(r.n)}</td><td class="n">${f(r.bedarf, 1)} h</td><td class="n">${f(r.angebot, 0)} h</td><td class="n">${f(C.beschGrad(r.bedarf, r.angebot), 1)} %</td></tr>`).join('')}</table></div>`;
    h += box('Kapazität einer Station', 'Plätze · ' + f(S.kap.tage, 0) + ' Tage · ' + f(S.kap.sch * 8, 0) + ' h', 'z. B. ' + f(rows[0].angebot, 0) + ' h bei ' + rows[0].m + ' Plätzen');
    h += box('Kapazitätsbedarf', 'Menge · Stückzeit / 60', 'z. B. ' + f(S.kap.m, 0) + ' · ' + f(rows[0].te, 1) + ' / 60 = ' + f(rows[0].bedarf, 1) + ' h');
    h += e.grad > 100 ? note('Engpass ist ' + e.n + ' mit ' + f(e.grad, 1) + ' %. Die Kapazität reicht nicht: Zusatzschicht, Überstunden, Stückzeit senken oder einen Teil fremd fertigen lassen.', 'bad') : note('Engpass ist ' + e.n + ' mit ' + f(e.grad, 1) + ' %. Mehr als diese Station schafft, kann die Linie nicht liefern.', e.grad >= 85 ? 'warn' : 'ok');
    $('#kapOut').innerHTML = h;
  }
  $('#kapView').addEventListener('input', e => {
    const t = e.target, k = t.dataset.k; if (!k) return;
    if (/^te\d$/.test(k)) { S.kap.te[+k[2]] = +t.value; const o = $('[data-o="' + k + '"]'); if (o) o.textContent = f(+t.value, 1) + ' min'; lsSet('kap', S.kap); }
    else slIn($('#kapView'), S.kap, 'kap', e);
    updKap();
  });

  /* ============================================================ Losgröße (Kostenkurven) */
  function renderLos() {
    const s = S.los;
    $('#losView').innerHTML = stage('vzCost') + `<div class="card pl"><h4>Losgrößenrechner Funkmodul FM-2</h4><div class="dsrow">${sl('B', 'Jahresbedarf', s.B, 1000, 50000, 500, 'Stück')}${sl('R', 'Rüstkosten je Los', s.R, 20, 500, 10, '€')}${sl('p', 'Herstellkosten je Stück', s.p, 1, 100, 0.5, '€', 2)}${sl('z', 'Lagerhaltungskostensatz', s.z, 5, 40, 1, '%')}${sl('x', 'Deine Losgröße', s.x, 50, 10000, 50, 'Stück')}</div>
      <div class="btns"><button class="btn" data-lo="opt">Optimale Losgröße übernehmen</button></div><div id="losOut"></div></div>`;
    updLos();
  }
  function updLos() {
    const s = S.los, xo = C.andler(s.B, s.R, s.p, s.z), k = C.losKosten(s.B, s.R, s.p, s.z, s.x), ko = C.losKosten(s.B, s.R, s.p, s.z, xo);
    morph($('#vzCost'), V.costSvg(s));
    $('#losOut').innerHTML = box('Lose im Jahr bei ' + f(s.x, 0) + ' Stück', f(s.B, 0) + ' / ' + f(s.x, 0), f(k.lose, 2)) +
      box('Rüstkosten im Jahr', f(k.lose, 2) + ' · ' + f(s.R, 2) + ' €', f(k.ruest, 2) + ' €') +
      box('Lagerkosten im Jahr', f(s.x, 0) + ' / 2 · ' + f(s.p, 2) + ' € · ' + f(s.z, 0) + ' %', f(k.lager, 2) + ' €') +
      box('Summe bei deiner Losgröße', '', f(k.ges, 2) + ' €', Math.abs(k.ges - ko.ges) < 0.5 ? 'ok' : '') +
      box('Optimale Losgröße (Andler)', 'Wurzel(200 · ' + f(s.B, 0) + ' · ' + f(s.R, 2) + ' / (' + f(s.p, 2) + ' · ' + f(s.z, 0) + '))', f(xo, 0) + ' Stück, Summe ' + f(ko.ges, 2) + ' €', 'ok') +
      `<p class="hint2">Im Minimum sind Rüst- und Lagerkosten gleich hoch (${f(ko.ruest, 2)} € und ${f(ko.lager, 2)} €). Schiebe die Regler: Der Punkt für das Minimum wandert mit.</p>`;
  }
  $('#losView').addEventListener('input', e => { if (slIn($('#losView'), S.los, 'los', e)) updLos(); });
  $('#losView').addEventListener('click', e => { if (!e.target.closest('[data-lo]')) return; S.los.x = Math.min(10000, Math.max(50, Math.round(C.andler(S.los.B, S.los.R, S.los.p, S.los.z) / 50) * 50)); lsSet('los', S.los); renderLos(); });

  /* ============================================================ Termine (Balkenplan) */
  const terOps = () => S.ter.ops.map(o => ({ n: o.n, tr: P(o.tr), te: P(o.te), ue: P(o.ue) }));
  function renderTer() {
    const s = S.ter;
    $('#terView').innerHTML = stage('vzGantt') + `<div class="card pl"><h4>Terminplaner Sensormodul SM-3</h4><div class="fbar">${lbl('RECHNUNG')}${seg('data-tm', [['v', 'Vorwärts'], ['r', 'Rückwärts']], s.mode)}</div>
      <div class="dsrow">${sl('m', 'Menge', s.m, 50, 500, 10, 'Stück')}${sl('T', 'Liefertermin (Stunde)', s.T, 16, 160, 2, 'h')}${sl('s', 'Frühester Beginn (Stunde)', s.s, 0, 40, 1, 'h')}</div>
      <div class="tw"><table class="tt"><tr><th>Arbeitsgang</th><th>Übergang davor (h)</th><th>Rüstzeit (h)</th><th>Stückzeit (min)</th></tr>${s.ops.map((o, i) => `<tr><td><b>${esc(o.n)}</b></td>${['ue', 'tr', 'te'].map(k => `<td><input data-r="${i}" data-f="${k}" inputmode="decimal" autocomplete="off" value="${esc(o[k])}" aria-label="${esc(o.n + ' ' + k)}"></td>`).join('')}</tr>`).join('')}</table></div><div id="terOut"></div></div>`;
    updTer();
  }
  function updTer() {
    const s = S.ter, ops = terOps();
    if (!ops.every(o => [o.tr, o.te, o.ue].every(v => Number.isFinite(v) && v >= 0))) { $('#terOut').innerHTML = note('Gib alle Zeiten als Zahlen ein (0 oder mehr).'); return; }
    morph($('#vzGantt'), V.ganttSvg(ops, s.m, s.mode, s.s, s.T));
    const d = C.durchlauf(ops, s.m); let h = '';
    if (s.mode === 'v') {
      const v = C.vorwaerts(ops, s.m, s.s), p = C.puffer(s.T, v.ende);
      h += v.ops.map(o => box(o.n, 'Beginn ' + f(o.start, 2) + ' h', 'Ende ' + f(o.ende, 2) + ' h')).join('');
      h += box('Frühestes Ende', f(s.s, 0) + ' + ' + f(d.dlz, 2), 'Stunde ' + f(v.ende, 2)) + (p >= 0 ? note('Puffer bis zum Liefertermin: ' + f(p, 2) + ' h. Der Termin hält.', 'ok') : note('Es fehlen ' + f(-p, 2) + ' h. Der Termin hält so nicht: Liegezeiten kürzen, Überstunden, Los teilen oder Termin neu abstimmen.', 'bad'));
    } else {
      const r = C.rueckwaerts(ops, s.m, s.T);
      h += r.ops.map(o => box(o.n, 'Beginn ' + f(o.start, 2) + ' h', 'Ende ' + f(o.ende, 2) + ' h')).join('');
      h += box('Spätester Beginn', f(s.T, 0) + ' − ' + f(d.dlz, 2), 'Stunde ' + f(r.start, 2)) + (r.start < s.s ? note('Der späteste Beginn liegt vor dem frühesten Beginn: So wird der Termin nicht gehalten.', 'bad') : note('Wer später als Stunde ' + f(r.start, 2) + ' beginnt, wird nicht rechtzeitig fertig.', 'ok'));
    }
    h += box('Durchlaufzeit', 'Übergang ' + f(d.ue, 1) + ' + Rüsten ' + f(d.ruest, 1) + ' + Bearbeiten ' + f(d.bearb, 2), f(d.dlz, 2) + ' h') + box('Anteil Übergangszeit', f(d.ue, 1) + ' / ' + f(d.dlz, 2) + ' · 100', f(d.anteilUe, 1) + ' %');
    $('#terOut').innerHTML = h;
  }
  $('#terView').addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.r != null) { S.ter.ops[+t.dataset.r][t.dataset.f] = t.value; lsSet('ter', S.ter); updTer(); return; }
    if (slIn($('#terView'), S.ter, 'ter', e)) updTer();
  });
  $('#terView').addEventListener('click', e => { const b = e.target.closest('[data-tm]'); if (!b) return; S.ter.mode = b.dataset.tm; lsSet('ter', S.ter); $$('[data-tm]', $('#terView')).forEach(x => x.classList.toggle('on', x === b)); updTer(); });

  /* ============================================================ Lean (Kanban-Kreislauf, Ausschuss) */
  function renderKan() {
    const s = S.kan;
    $('#kanView').innerHTML = stage('vzKan') + `<div class="card pl"><h4>Kanban-Regelkreis am Lötplatz</h4><div class="dsrow">${sl('v', 'Verbrauch je Tag', s.v, 50, 1000, 10, 'Stück')}${sl('w', 'Wiederbeschaffungszeit', s.w, 0.5, 5, 0.5, 'Tage', 1)}${sl('si', 'Sicherheitszuschlag', s.si, 0, 50, 5, '%')}${sl('j', 'Menge je Behälter', s.j, 20, 300, 10, 'Stück')}</div><div id="kanOut"></div></div>
      <div class="card pl"><h4>Ausschuss: Wie viele muss ich anfangen?</h4><div class="dsrow">${sl('gut', 'Bestellte Gutmenge', s.gut, 100, 3000, 10, 'Stück')}${sl('aq', 'Ausschussquote', s.aq, 0, 20, 0.5, '%', 1)}</div><div id="ausOut"></div></div>
      <div class="card pl"><h4>Kurz erklärt</h4><p style="margin:0 0 6px"><b>Kanban</b>: Der Verbrauch löst den Nachschub aus (Holprinzip). <b>Just in Time</b>: Material kommt genau dann, wenn es gebraucht wird. <b>Kaizen</b>: ständig in kleinen Schritten verbessern. <b>PDCA</b>: Plan, Do, Check, Act, immer im Kreis.</p></div>`;
    updKan();
  }
  function updKan() {
    const s = S.kan, n = C.kanbanAnzahl(s.v, s.w, s.si, s.j), roh = s.v * s.w * (1 + s.si / 100);
    morph($('#vzKan'), V.kanbanSvg(n, s.j));
    $('#kanOut').innerHTML = box('Verbrauch in der Wiederbeschaffungszeit', f(s.v, 0) + ' · ' + f(s.w, 1), f(s.v * s.w, 0) + ' Stück') + box('mit Sicherheitszuschlag', f(s.v * s.w, 0) + ' · ' + f(1 + s.si / 100, 2), f(roh, 1) + ' Stück') + box('Anzahl Kanban-Karten (aufgerundet)', f(roh, 1) + ' / ' + f(s.j, 0), f(n, 0) + ' Karten', 'ok');
    const st = C.startMenge(s.gut, s.aq);
    $('#ausOut').innerHTML = box('Startmenge', f(s.gut, 0) + ' / (1 − ' + f(s.aq, 1) + ' / 100), aufgerundet', f(st, 0) + ' Stück', 'ok') + box('davon erwarteter Ausschuss', '', f(st - s.gut, 0) + ' Stück (Quote bezogen auf die Startmenge)');
  }
  $('#kanView').addEventListener('input', e => { if (slIn($('#kanView'), S.kan, 'kan', e)) updKan(); });

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
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : f(q.value, 2) + ' ' + q.ask.unit);
  const eingabeHinweis = q => q.ask.type === 'num' ? `<p class="lr-hinweis hint2">Zahl${q.ask.unit ? ' in ' + esc(q.ask.unit) : ''}.${q.tol > 0.011 ? ' ±' + esc(f(q.tol, 2)) + ' ' + esc(q.ask.unit) + ' gelten als richtig (wegen Rundung).' : ''}</p>` : '';
  const stufeFuer = (ok, fehl, ex) => ok ? 'ok' : ex ? 'pruef' : fehl >= 2 ? 'loes' : 'tipp';
  const zeigFb = el => { try { const x = el && el.querySelector('.lr-fb'); if (x && root.LabRahmen) root.LabRahmen.zeig(x); } catch (e) {} };
  /* "So gehst du vor" und Bild zum Thema */
  const stepsHTML = q => q.steps && q.steps.length ? `<details class="dt steps" open><summary>👣 So gehst du vor</summary><div class="hb2"><ol>${q.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div></details>` : '';
  const picHTML = q => { const h = V.taskPic(D.cats.indexOf(q.cat)); return h ? `<div class="inst pv tpic">${h}</div>` : ''; };
  function qBody(q, a, r) {
    const lock = r && (r.ok || r.stufe === 'loes');
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${lock ? 'disabled' : ''} class="${lock && i === q.ask.correct ? 'ok' : a.c === i ? (r && !r.ok && r.given === c ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)}${q.ask.unit ? ' (' + esc(q.ask.unit) + ')' : ''}</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${lock ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div>${eingabeHinweis(q)}</label>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: (f(v, 2) + ' ' + q.ask.unit).trim() };
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
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${picHTML(q)}<p style="margin:8px 0">${esc(q.text)}</p>${stepsHTML(q)}${qBody(q, a, r)}`;
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
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${picHTML(q)}<p style="margin:8px 0">${esc(q.text)}</p>${stepsHTML(q)}${qBody(q, T.ans, T.res)}${T.res ? fbHTML(q, T.res) : ''}
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
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML = `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Fertigungsarten und Organisationstypen', `<table><tr><th>Fertigungsart (wie oft)</th><th>Organisationstyp (wie angeordnet)</th></tr><tr><td>Einzelfertigung: ein Stück</td><td>Werkstattfertigung: gleiche Maschinen zusammen</td></tr><tr><td>Serienfertigung: begrenztes Los</td><td>Fließfertigung: Plätze in Arbeitsfolge, Takt</td></tr><tr><td>Sortenfertigung: Varianten aus gleichem Stoff</td><td>Gruppenfertigung: Team an einer Insel</td></tr><tr><td>Massenfertigung: ohne geplantes Ende</td><td>Baustellenfertigung: Erzeugnis steht fest</td></tr></table>`, true) +
      sec('Kapazität und Auslastung', `<span class="eq">Kapazität = Plätze · Arbeitstage · Stunden je Tag</span><span class="eq">Kapazitätsbedarf = Rüstzeit + Menge · Stückzeit / 60</span><span class="eq">Beschäftigungsgrad = Bedarf / Kapazität · 100</span><p>Der <b>Engpass</b> ist die Stelle mit dem höchsten Beschäftigungsgrad. Über 100 %: Überlast (Zusatzschicht, Überstunden, Fremdvergabe). Steigt die Auslastung, sinken die fixen Kosten je Stück.</p>`) +
      sec('Losgröße', `<span class="eq">Rüstkosten im Jahr = Jahresbedarf / Losgröße · Rüstkosten je Los</span><span class="eq">Lagerkosten im Jahr = Losgröße / 2 · Herstellkosten je Stück · Lagerhaltungskostensatz / 100</span><span class="eq">Andler: optimale Losgröße = Wurzel(200 · Jahresbedarf · Rüstkosten je Los / (Herstellkosten je Stück · Lagerhaltungskostensatz in %))</span><p>Große Lose: weniger Rüstkosten, mehr Lagerkosten. Im Minimum sind beide gleich hoch.</p>`) +
      sec('Durchlaufzeit und Terminplanung', `<span class="eq">Auftragszeit = Rüstzeit + Menge · Stückzeit</span><span class="eq">Durchlaufzeit = Σ (Übergangszeit + Rüstzeit + Menge · Stückzeit)</span><span class="eq">Puffer = Liefertermin − frühestes Ende</span><p><b>Vorwärts</b>: vom frühesten Beginn zum frühesten Ende. <b>Rückwärts</b>: vom Liefertermin zum spätesten Beginn. Der <b>Balkenplan</b> (Gantt-Diagramm) zeigt die Arbeitsgänge auf der Zeitachse.</p>`) +
      sec('Kennzahlen und Bedarf', `<span class="eq">Produktivität = Ausbringungsmenge / Einsatzmenge</span><span class="eq">Wirtschaftlichkeit = Ertrag / Aufwand</span><span class="eq">Eigenkapitalrentabilität = Gewinn / Eigenkapital · 100</span><span class="eq">Umsatzrentabilität = Gewinn / Umsatz · 100</span><span class="eq">Bruttobedarf = Primärbedarf · Menge je Erzeugnis (Stückliste)</span><span class="eq">Nettobedarf = Bruttobedarf − Lagerbestand + Sicherheitsbestand − offene Bestellungen (nicht unter 0)</span><p class="hint2">Kalkulation mit Zuschlägen steht im Kalkulations-Lab, Meldebestand und Bestellmenge im Lager-Lab.</p>`) +
      sec('Qualität und Lean', `<span class="eq">Ausschussquote = Ausschuss / gefertigte Menge · 100</span><span class="eq">Startmenge = Gutmenge / (1 − Quote / 100), aufrunden</span><span class="eq">Kanban-Karten = Verbrauch je Tag · Wiederbeschaffungszeit · (1 + Zuschlag / 100) / Menge je Behälter, aufrunden</span><p>PDCA: Plan, Do, Check, Act. Kaizen: kleine ständige Verbesserung. Verschwendung: Bestände, Warten, Wege, Fehler.</p>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'fer'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ fer: renderFer, kap: renderKap, los: renderLos, ter: renderTer, kan: renderKan, wiss: renderWiss, tasks: renderTasks, rt: renderTrainer, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Produktions-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Produktions-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('fer');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe und Formeln', 'Fertigung, Kapazität, Losgröße, Termine, Kennzahlen, Lean'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.PRD_LAB = { id: 'prd', title: 'Produktions-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.PRD_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'fer');
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
