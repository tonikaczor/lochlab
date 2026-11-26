'use strict';
/* Tonfunk Touren-Lab: Oberfläche (Lab-Kennung 'tou').
   ALLE Zahlen (Entfernungen, Fahrzeuge, Kostensätze, Zeitfenster) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   Reiter: Tourenplaner (Karte, Lkw fährt die Tour ab, Laderaum, Zeitstrahl), Fahrzeug, Lenkzeiten, Kosten, Aufgaben, Trainer, Beispiele, Hilfe.
   Module: toucore.js (TOU_CORE), toudata.js (TOU_DATA, TOU_TASKS), touviz.js (TOU_VIZ, Zeichnungen).
   Speicher (Präfix lm4.tou.): tab, plan, fzg, zeit, kost, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Bewegung: Lkw-Fahrt, Füllen des Laderaums und wachsende Balken nur ohne prefers-reduced-motion: reduce.
   Aufruf: toulab.html?aufgabe=tou1 öffnet die Aufgabe, toulab.html?bsp die Beispiele.
   Nicht doppeln: Kommissionieren, Versand und Frachtpapiere stehen im Warenfluss-Lab, Ladungssicherung im Ladungssicherungs-Lab. */
(function (root) {
  const C = root.TOU_CORE, D = root.TOU_DATA, V = root.TOU_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.tou.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s), sc = v => String(v).replace('.', ',');
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  const ruhig = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Touren-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">toucore.js, toudata.js oder touviz.js konnten nicht geladen werden. Bitte lade die Seite neu.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['plan', '🗺️', 'Tourenplaner'], ['fzg', '🚚', 'Fahrzeug'], ['zeit', '⏱️', 'Lenkzeiten'], ['kost', '💶', 'Kosten'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const FZK = C.FZG.map(x => x.k);
  const S = {
    tab: lsGet('tab', 'plan'),
    plan: Object.assign({ order: [], fz: 'l12', start: 360, v: '60', grund: '15', jePal: '5', ext10: false }, lsGet('plan', {})),
    fzg: Object.assign({ fz: 'l75', n: '12', kg: '350' }, lsGet('fzg', {})),
    zeit: Object.assign({ tage: ['9', '8', '10', '8,5', '9', '0'], vor: '40', lenk: '7', a: '15', b: '30' }, lsGet('zeit', {})),
    kost: Object.assign({ fz: 'l75', km: '180', h: '6,5', pal: '12', preis: '35' }, lsGet('kost', {})),
    undo: [],
    task: null, tq: null, tAns: {}, tRes: null, tFehl: {},
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  /* Gespeicherte Zustände prüfen */
  if (!Array.isArray(S.plan.order) || !C.okOrder(S.plan.order)) S.plan.order = [];
  S.plan.order = S.plan.order.filter(k => C.KUNDEN_KEYS.includes(k));
  if (!FZK.includes(S.plan.fz)) S.plan.fz = 'l12';
  if (![300, 360, 420, 480].includes(S.plan.start)) S.plan.start = 360;
  if (!FZK.includes(S.fzg.fz)) S.fzg.fz = 'l75';
  if (!FZK.includes(S.kost.fz)) S.kost.fz = 'l75';
  if (!Array.isArray(S.zeit.tage) || S.zeit.tage.length !== 6 || !S.zeit.tage.every(x => typeof x === 'string')) S.zeit.tage = ['9', '8', '10', '8,5', '9', '0'];
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (k, label, val, unit, attr) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input ${attr || 'data-k'}="${k}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  const UEB = 'Alle Zahlen in diesem Lab (Entfernungen, Fahrzeuge, Kostensätze, Zeitfenster) sind Übungswerte des Modellbetriebs, nicht für die Praxis. Maßgebend sind die Vorschriften und die Fahrzeugpapiere deines Betriebs.';
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const XREF = (lab, txt) => `<p class="hint2">Siehe auch ${lab}: ${esc(txt)}</p>`;
  const vz = (id, h) => `<div class="vzbox"${id ? ' id="' + id + '"' : ''}>${h}</div>`;
  const uhr = m => C.hm(m) + ' Uhr', fenster = K => C.hm(K.von) + ' bis ' + C.hm(K.bis) + ' Uhr';
  const FZSEG = C.FZG.map(x => [x.k, x.n]);
  /* Fahrt erst nach dem nächsten Bild starten: Direkt nach dem Einsetzen per innerHTML läuft die SVG-Zeit in Chrome noch nicht, der Lkw bliebe stehen */
  const startSmil = el => { if (el) setTimeout(() => $$('animateMotion', el).forEach(a => { try { a.beginElement(); } catch (e) {} }), 60); };

  /* ============================================================ Tourenplaner */
  const planParams = () => ({ order: S.plan.order, fz: S.plan.fz, start: S.plan.start, v: P(S.plan.v), grund: P(S.plan.grund), jePal: P(S.plan.jePal), ext10: !!S.plan.ext10 });
  function renderPlan() {
    const s = S.plan;
    $('#planView').innerHTML = `<div class="card pl"><h4>Tourenplaner</h4><p class="hint2" style="margin:0 0 8px">So gehst du vor: 1. Tippe die Kunden in der Reihenfolge an, in der du sie beliefern willst (noch einmal tippen nimmt einen Kunden heraus). 2. Wähle das Fahrzeug. 3. Tippe auf „Tour abfahren“ und prüfe Strecke, Zeit, Auslastung, Kosten und Verstöße.</p>
      ${vz('planMap', '')}<p class="hint2" id="planOrd"></p>
      <div class="btns"><button class="btn pri" data-pl="drive">▶ Tour abfahren</button><button class="btn" data-pl="nn">Nächster Nachbar</button><button class="btn" data-pl="best">Kürzeste Strecke</button><button class="btn" data-pl="undo">↶ Rückgängig</button><button class="btn" data-pl="clear">Leeren</button></div></div>
      <div class="card pl"><h4>Fahrzeug und Zeit</h4><div class="ctl">${seg('data-fz', FZSEG, s.fz)}</div>
      <div class="ctl"><span class="lbl2">Abfahrt</span>${seg('data-st', [[300, '05:00'], [360, '06:00'], [420, '07:00'], [480, '08:00']], s.start)}</div>
      <div class="ctl"><span class="lbl2">Tageslenkzeit</span>${seg('data-x10', [['0', 'bis 9 h'], ['1', 'bis 10 h (Ausnahmetag)']], s.ext10 ? '1' : '0')}</div>
      <div class="dsrow">${inp('v', 'Durchschnittsgeschwindigkeit', s.v, 'km/h')}${inp('grund', 'Grundzeit je Kunde', s.grund, 'min')}${inp('jePal', 'Entladen je Palette', s.jePal, 'min')}</div></div>
      <div class="card pl"><h4>Kunden des Modellbetriebs</h4><div class="tw"><table class="tt"><tr><th>Kunde</th><th class="n">Paletten</th><th class="n">Gewicht</th><th>Annahme</th></tr>${C.KUNDEN_KEYS.map(k => { const K = C.KUNDEN[k]; return `<tr><td><span class="kdot k${C.KUNDEN_KEYS.indexOf(k)}"></span><b>${k}</b></td><td class="n">${K.pal}</td><td class="n">${f(K.pal * K.kgPal, 0)} kg</td><td>${esc(fenster(K))}</td></tr>`; }).join('')}</table></div></div>
      <div id="planOut"></div>${XREF('das Warenfluss-Lab', 'Kommissionieren, Versand und Frachtpapiere.')}${XREF('das Ladungssicherungs-Lab', 'Wie du die Paletten im Laderaum sicherst.')}`;
    updatePlan(true, false);
  }
  function updatePlan(anim, drive) {
    const s = S.plan, p = C.planTour(planParams()), late = {}, mv = !ruhig();
    if (p) p.stops.forEach(st => { if (st.spaet) late[st.k] = true; });
    $('#planMap').innerHTML = V.mapSvg({ order: s.order, interactive: true, late, drive: drive && mv && s.order.length > 0 });
    if (drive && mv) startSmil($('#planMap'));
    $('#planOrd').textContent = s.order.length ? 'Tour: L → ' + s.order.join(' → ') + ' → L' : 'Noch keine Kunden gewählt.';
    const o = $('#planOut');
    if (!s.order.length) { o.innerHTML = note('Tippe auf der Karte die Kunden an. Die Reihenfolge des Antippens ist die Reihenfolge der Tour.'); return; }
    if (!p) { o.innerHTML = note('Gib Geschwindigkeit (größer als 0), Grundzeit und Entladezeit als Zahlen ein.', 'bad'); return; }
    const lad = p.lad, rows = p.lade.map(k => ({ k, pal: C.KUNDEN[k].pal, kg: C.KUNDEN[k].pal * C.KUNDEN[k].kgPal }));
    let h = '<div class="card pl"><h4>Ergebnis</h4><div class="cols">';
    h += '<div>' + box('Strecke mit Rückfahrt', '', f(p.km, 0) + ' km') + box('Lenkzeit', '', C.dauer(p.lenk)) + box('Pausen, Warten, Entladen', '', C.dauer(p.pausen) + ', ' + C.dauer(p.warten) + ', ' + C.dauer(p.stand)) + box('Einsatz', uhr(p.start) + ' bis ' + uhr(p.ende), C.dauer(p.einsatz)) + '</div>';
    h += '<div>' + box('Ladung', '', p.pal + ' Paletten, ' + f(p.kg, 0) + ' kg') + box('Auslastung Stellplätze, Gewicht', '', f(lad.palPct, 0) + ' %, ' + f(lad.kgPct, 0) + ' %', lad.okPal && lad.okKg ? '' : 'bad') + box('Kosten der Tour', f(p.km, 0) + ' km · ' + f(p.f.kmS) + ' € + ' + f(p.einsatz / 60) + ' h · ' + f(p.f.hS, 0) + ' €', f(p.kosten) + ' €') + box('Kosten je Palette', '', f(p.jePal) + ' €') + '</div></div>';
    h += p.verst.length ? `<ul class="tl">${p.verst.map(v => `<li class="bad">✗ ${esc(v.t)}</li>`).join('')}</ul>` : '<ul class="tl"><li class="ok">✓ Keine Verstöße: Ladung passt, alle Zeitfenster eingehalten, Lenkzeit im Rahmen.</li></ul>';
    h += '</div>';
    h += `<div class="card pl"><h4>Laderaum von oben</h4>${vz('planTruck', V.truckSvg({ fz: p.f, rows, anim: anim && mv }))}<p class="hint2">Ladereihenfolge nach Last In First Out: zuerst ${esc(p.lade[0])} (vorn an der Stirnwand), zuletzt ${esc(p.lade[p.lade.length - 1])} (an der Tür, wird zuerst beliefert).</p></div>`;
    h += `<div class="card pl"><h4>Zeitstrahl des Tages</h4>${vz('planTime', V.timeSvg(p, anim && mv))}<div class="tw"><table class="tt"><tr><th>Kunde</th><th class="n">km</th><th>Ankunft</th><th>Warten</th><th>Abfahrt</th><th>Annahme</th></tr>${p.stops.map(st => `<tr><td><b>${st.k}</b></td><td class="n">${f(st.km, 0)}</td><td class="${st.spaet ? 'pc m' : ''}">${esc(uhr(st.an))}${st.spaet ? ' zu spät' : ''}</td><td>${st.warten ? esc(C.dauer(st.warten)) : '-'}</td><td>${esc(uhr(st.ab))}</td><td>${esc(fenster(C.KUNDEN[st.k]))}</td></tr>`).join('')}</table></div><p class="hint2">Die Pause plant der Planer genau nach 4,5 h Lenkzeit ein. Warten und Entladen zählen nicht als Pause.</p></div>`;
    o.innerHTML = h;
  }
  const savePlan = () => lsSet('plan', S.plan);
  const pv = $('#planView');
  pv.addEventListener('click', e => {
    const hit = e.target.closest('[data-o]'), b = e.target.closest('button');
    if (hit) { const k = hit.dataset.o, o = S.plan.order; S.undo.push(o.slice()); S.plan.order = o.includes(k) ? o.filter(x => x !== k) : o.concat([k]); savePlan(); updatePlan(true, false); return; }
    if (!b) return;
    if (b.dataset.fz) { S.plan.fz = b.dataset.fz; savePlan(); $$('[data-fz]', pv).forEach(x => x.classList.toggle('on', x === b)); updatePlan(true, false); return; }
    if (b.dataset.st) { S.plan.start = +b.dataset.st; savePlan(); $$('[data-st]', pv).forEach(x => x.classList.toggle('on', x === b)); updatePlan(false, false); return; }
    if (b.dataset.x10) { S.plan.ext10 = b.dataset.x10 === '1'; savePlan(); $$('[data-x10]', pv).forEach(x => x.classList.toggle('on', x === b)); updatePlan(false, false); return; }
    const a = b.dataset.pl; if (!a) return;
    if (a === 'drive') { if (!S.plan.order.length) { toast('Wähle zuerst Kunden auf der Karte.'); return; } updatePlan(false, true); if (ruhig()) toast('Bewegung ist am Gerät reduziert: Die Tour wird ohne Fahrt gezeigt.'); return; }
    if (a === 'undo') { if (!S.undo.length) { toast('Nichts zum Rückgängigmachen.'); return; } S.plan.order = S.undo.pop(); }
    else { S.undo.push(S.plan.order.slice()); const keys = S.plan.order.length ? S.plan.order : C.KUNDEN_KEYS;
      if (a === 'clear') S.plan.order = [];
      else if (a === 'nn') { S.plan.order = C.nearest(keys); toast('Nächster Nachbar: immer zum nächstgelegenen offenen Kunden.'); }
      else if (a === 'best') { S.plan.order = C.bestTour(keys).order; toast('Kürzeste Strecke für diese Kunden. Prüfe die Zeitfenster.'); } }
    savePlan(); updatePlan(true, false);
  });
  pv.addEventListener('keydown', e => { const hit = e.target.closest && e.target.closest('[data-o]'); if (hit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); hit.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  pv.addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.plan[k] = e.target.value; savePlan(); updatePlan(false, false); });

  /* ============================================================ Fahrzeug */
  function renderFzg() {
    const s = S.fzg;
    $('#fzgView').innerHTML = `<div class="card pl"><h4>Fahrzeug wählen</h4><p class="hint2" style="margin:0 0 8px">So gehst du vor: 1. Gib Paletten und Gewicht je Palette ein. 2. Wähle ein Fahrzeug. 3. Prüfe Stellplätze und Nutzlast: Beides muss reichen.</p>
      <div class="ctl">${seg('data-fz', FZSEG, s.fz)}</div><div class="dsrow">${inp('n', 'Europaletten', s.n, 'Stück')}${inp('kg', 'Gewicht je Palette', s.kg, 'kg')}</div>
      ${vz('fzgSvg', '')}<div id="fzgOut"></div></div>${XREF('das Ladungssicherungs-Lab', 'Zurrmittel, Ladeeinheiten und das Sichern der Ladung.')}`;
    updateFzg(true);
  }
  function updateFzg(anim) {
    const s = S.fzg, fz = C.fzgOf(s.fz), n = P(s.n), kgP = P(s.kg), o = $('#fzgOut');
    if (!(Number.isInteger(n) && n >= 0 && n <= 60) || !(kgP >= 0)) { $('#fzgSvg').innerHTML = ''; o.innerHTML = note('Gib die Paletten als ganze Zahl von 0 bis 60 und das Gewicht je Palette als Zahl ein.', 'bad'); return; }
    const kg = n * kgP, l = C.ladung(fz, n, kg), sp = l.stell, best = C.passend(n, kg);
    $('#fzgSvg').innerHTML = V.truckSvg({ fz, rows: [{ k: '', pal: n, kg }], anim: anim && !ruhig() });
    let h = '<div class="cols"><div>' + box('Stellplätze (längs geladen)', C.floorN(fz.l / 1.2) + ' Reihen · ' + C.floorN(fz.b / 0.8) + ' je Reihe', sp + ' Stellplätze') + box('Lademeter der Ladung', n + ' · 0,4 ldm', f(C.ldmPal(n)) + ' ldm') + box('Ladevolumen', f(fz.l) + ' · ' + f(fz.b) + ' · ' + f(fz.h) + ' m', f(C.volumen(fz.l, fz.b, fz.h)) + ' m³') + '</div><div>';
    h += box('Nutzlast', f(fz.zgg, 0) + ' kg − ' + f(fz.leer, 0) + ' kg', f(l.nutz, 0) + ' kg') + box('Ladung', n + ' · ' + f(kgP, 0) + ' kg', f(kg, 0) + ' kg', l.okKg ? '' : 'bad') + box('Auslastung Stellplätze, Gewicht', '', f(l.palPct, 0) + ' %, ' + f(l.kgPct, 0) + ' %', l.okPal && l.okKg ? '' : 'bad') + '</div></div>';
    h += l.okPal && l.okKg ? note('✓ Die Ladung passt auf den ' + fz.n + '.', 'ok') : note('✗ ' + (!l.okPal ? 'Zu wenig Stellplätze (' + l.ueberPal + ' Paletten zu viel). ' : '') + (!l.okKg ? 'Überladen um ' + f(l.ueberKg, 0) + ' kg. ' : '') + 'So darf das Fahrzeug nicht fahren.', 'bad');
    h += `<div class="tw"><table class="tt"><tr><th>Fahrzeug</th><th class="n">Stellplätze</th><th class="n">Nutzlast</th><th>Passt?</th></tr>${C.FZG.map(x => { const y = C.ladung(x, n, kg); return `<tr><td>${esc(x.n)}</td><td class="n">${y.stell}</td><td class="n">${f(y.nutz, 0)} kg</td><td class="${y.okPal && y.okKg ? 'pc' : 'pc m'}">${y.okPal && y.okKg ? '✓ ja' : '✗ nein'}</td></tr>`; }).join('')}</table></div>`;
    h += `<p class="hint2">${best ? 'Kleinstes passendes Fahrzeug: <b>' + esc(best.n) + '</b>.' : 'Kein Fahrzeug reicht: Teile die Ladung auf zwei Touren auf.'} Achslasten: Auch wenn das Gesamtgewicht stimmt, darf keine Achse überlastet sein. Das zeigt der Lastverteilungsplan des Fahrzeugs.</p>`;
    o.innerHTML = h;
  }
  const fv = $('#fzgView');
  fv.addEventListener('click', e => { const b = e.target.closest('[data-fz]'); if (!b) return; S.fzg.fz = b.dataset.fz; lsSet('fzg', S.fzg); $$('[data-fz]', fv).forEach(x => x.classList.toggle('on', x === b)); updateFzg(true); });
  fv.addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.fzg[k] = e.target.value; lsSet('fzg', S.fzg); updateFzg(k === 'n'); });

  /* ============================================================ Lenkzeiten */
  const TAGN = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  function renderZeit() {
    const s = S.zeit;
    $('#zeitView').innerHTML = `<div class="card pl"><h4>Die Regeln im Bild</h4>${vz('', V.figSvg({ art: 'regel' }))}<p class="hint2">Grundregeln der EU-Verordnung 561/2006 für Lkw-Fahrer. Ausnahmen (verkürzte Ruhezeit, Mehrfahrerbetrieb) stehen in der Hilfe.</p></div>
      <div class="card pl"><h4>Lenkzeit der Woche</h4><p class="hint2" style="margin:0 0 8px">So gehst du vor: 1. Trage die Lenkzeit je Tag in Stunden ein. 2. Trage die Lenkzeit der Vorwoche ein. 3. Lies ab, ob alle Grenzen eingehalten sind und wie viel Lenkzeit noch bleibt.</p>
      <div class="mgrid">${s.tage.map((v, i) => `<label class="f"><span>${TAGN[i]} (h)</span><input data-tg="${i}" inputmode="decimal" autocomplete="off" value="${esc(v)}"></label>`).join('')}<label class="f"><span>Vorwoche (h)</span><input data-k="vor" inputmode="decimal" autocomplete="off" value="${esc(s.vor)}"></label></div>
      ${vz('weekSvg', '')}<div id="weekOut"></div></div>
      <div class="card pl"><h4>Pausen planen</h4><p class="hint2" style="margin:0 0 8px">So gehst du vor: 1. Gib die geplante Lenkzeit des Tages ein. 2. Lies ab, wie viele Pausen nötig sind. 3. Prüfe, ob deine Aufteilung der Pause erlaubt ist.</p>
      <div class="dsrow">${inp('lenk', 'Lenkzeit heute', s.lenk, 'h')}${inp('a', 'Erster Teil der Pause', s.a, 'min')}${inp('b', 'Zweiter Teil der Pause', s.b, 'min')}</div><div id="pauseOut"></div></div>`;
    updateZeit(true);
  }
  function updateZeit(anim) {
    const s = S.zeit, t = s.tage.map(v => P(v) * 60), vor = P(s.vor) * 60, w = C.wocheCheck(t, vor);
    if (!w || t.some(v => v > 24 * 60)) { $('#weekSvg').innerHTML = ''; $('#weekOut').innerHTML = note('Gib jede Lenkzeit als Zahl von 0 bis 24 Stunden ein.', 'bad'); }
    else {
      $('#weekSvg').innerHTML = V.weekSvg(t, anim && !ruhig());
      $('#weekOut').innerHTML = box('Wochenlenkzeit (höchstens 56 h)', '', f(w.sum / 60) + ' h') + box('Doppelwoche (höchstens 90 h)', f(vor / 60) + ' h + ' + f(w.sum / 60) + ' h', f(w.dop / 60) + ' h') + box('Noch erlaubt diese Woche', '', f(w.rest / 60) + ' h') + (w.ok ? note('✓ Alle Grenzen eingehalten. Tage über 9 h: ' + w.n10 + ' (höchstens 2).', 'ok') : `<ul class="tl">${w.verst.map(v => `<li class="bad">✗ ${esc(v)}</li>`).join('')}</ul>`);
    }
    const L = P(s.lenk) * 60, a = P(s.a), b = P(s.b);
    let h = '';
    if (!(L >= 0 && L <= 600)) h += note('Gib die Lenkzeit als Zahl von 0 bis 10 Stunden ein.', 'bad');
    else { const pm = C.pauseMin(L); h += box('Mindestpausen bei ' + f(L / 60) + ' h Lenkzeit', (pm / 45) + ' · 45 min', pm + ' min') + (L > 540 ? note('Mehr als 9 h Lenkzeit ist nur an zwei Tagen der Woche erlaubt.') : ''); }
    if (a >= 0 && b >= 0) h += C.teilOk(a, b) ? note('✓ Aufteilung erlaubt: erst ' + f(a, 0) + ' min, dann ' + f(b, 0) + ' min.', 'ok') : note('✗ Aufteilung nicht erlaubt: Der erste Teil muss mindestens 15 min und der zweite mindestens 30 min lang sein.', 'bad');
    $('#pauseOut').innerHTML = h;
  }
  const zv = $('#zeitView');
  zv.addEventListener('input', e => { const i = e.target.dataset.tg, k = e.target.dataset.k; if (i != null) S.zeit.tage[+i] = e.target.value; else if (k) S.zeit[k] = e.target.value; else return; lsSet('zeit', S.zeit); updateZeit(false); });

  /* ============================================================ Kosten */
  function renderKost() {
    const s = S.kost;
    $('#kostView').innerHTML = `<div class="card pl"><h4>Kosten der Tour</h4><p class="hint2" style="margin:0 0 8px">So gehst du vor: 1. Wähle das Fahrzeug. 2. Gib Strecke, Einsatzzeit und Paletten ein (oder übernimm sie aus dem Planer). 3. Vergleiche die eigene Tour mit dem Preis des Spediteurs.</p>
      <div class="ctl">${seg('data-fz', FZSEG, s.fz)}</div><div class="dsrow">${inp('km', 'Strecke', s.km, 'km')}${inp('h', 'Einsatzzeit', s.h, 'h')}${inp('pal', 'Paletten', s.pal, 'Stück')}${inp('preis', 'Spediteur je Palette', s.preis, '€')}</div>
      <div class="btns"><button class="btn" data-ko="plan">Aus dem Tourenplaner übernehmen</button></div>
      ${vz('kostSvg', '')}<div id="kostOut"></div></div>`;
    updateKost();
  }
  function updateKost() {
    const s = S.kost, fz = C.fzgOf(s.fz), k = P(s.km), h = P(s.h), n = P(s.pal), pr = P(s.preis), o = $('#kostOut');
    if (!(k >= 0) || !(h >= 0) || !(Number.isInteger(n) && n >= 0) || !(pr > 0)) { $('#kostSvg').innerHTML = ''; o.innerHTML = note('Gib Strecke und Einsatzzeit als Zahlen, die Paletten als ganze Zahl und den Preis größer als 0 ein.', 'bad'); return; }
    const sp = C.stell(fz.l, fz.b), kost = C.tourKosten(k, fz.kmS, h, fz.hS), sped = C.spedKosten(n, pr), be = C.abPaletten(kost, pr);
    $('#kostSvg').innerHTML = V.kostSvg({ kost, preis: pr, max: sp, pal: Math.min(n, sp) });
    let x = '<div class="cols"><div>' + box('Kilometerkosten', f(k, 0) + ' km · ' + f(fz.kmS) + ' €', f(C.kmKosten(k, fz.kmS)) + ' €') + box('Zeitkosten', f(h) + ' h · ' + f(fz.hS, 0) + ' €', f(C.zeitKosten(h, fz.hS)) + ' €') + box('Kosten der Tour', '', f(kost) + ' €') + '</div><div>';
    x += box('Kosten je Palette', n ? f(kost) + ' € / ' + n : '', n ? f(C.jePalette(kost, n)) + ' €' : 'keine Paletten') + box('Spediteur', n + ' · ' + f(pr) + ' €', f(sped) + ' €') + box('Auslastung Stellplätze', n + ' / ' + sp, f(C.pct(n, sp), 0) + ' %', n > sp ? 'bad' : '') + '</div></div>';
    x += n > sp ? note('Zu viele Paletten für den ' + fz.n + ' (' + sp + ' Stellplätze).', 'bad') : note(kost <= sped ? '✓ Die eigene Tour ist um ' + f(sped - kost) + ' € günstiger.' : 'Der Spediteur ist um ' + f(kost - sped) + ' € günstiger.', kost <= sped ? 'ok' : 'warn');
    x += `<p class="hint2">Ab ${be} Paletten lohnt sich die eigene Tour (${f(kost)} € / ${f(pr)} € = ${f(kost / pr)}, aufgerundet zur nächsten ganzen Palette). Je voller der Lkw, desto billiger jede Palette.</p>`;
    o.innerHTML = x;
  }
  const kv = $('#kostView');
  kv.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.fz) { S.kost.fz = b.dataset.fz; lsSet('kost', S.kost); $$('[data-fz]', kv).forEach(x => x.classList.toggle('on', x === b)); updateKost(); return; }
    if (b.dataset.ko === 'plan') { const p = C.planTour(planParams()); if (!p) { toast('Plane zuerst eine Tour im Tourenplaner.'); return; } Object.assign(S.kost, { fz: p.f.k, km: sc(p.km), h: sc(C.rd(p.einsatz / 60, 2)), pal: sc(p.pal) }); lsSet('kost', S.kost); renderKost(); toast('Tour aus dem Planer übernommen.'); }
  });
  kv.addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.kost[k] = e.target.value; lsSet('kost', S.kost); updateKost(); });

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
  /* Text der Aufgabe: "So gehst du vor" als eigene Liste */
  function qText(q) {
    const i = q.text.indexOf(' So gehst du vor: '); if (i < 0) return `<p style="margin:8px 0">${esc(q.text)}</p>`;
    const steps = q.text.slice(i + 18).split(/ ?\d\. /).filter(Boolean);
    return `<p style="margin:8px 0">${esc(q.text.slice(0, i))}</p><div class="sgv"><b>So gehst du vor</b><ol>${steps.map(s => `<li>${esc(s.trim())}</li>`).join('')}</ol></div>`;
  }
  const qFig = q => (q.fig ? vz('', V.figSvg(q.fig)) : '');
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
    const Vw = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${qFig(q)}${qText(q)}${qBody(q, a, r)}`;
      if (r) h += fbHTML(q, r);
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && (r.ok || r.stufe === 'loes') ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r && (r.ok || r.stufe === 'loes')) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`;
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    h += `<p class="hint2" style="margin:10px 0 0">${esc(UEB)}</p>`;
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
      <div class="fbar"><span class="lbl2">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${qFig(q)}${qText(q)}${qBody(q, T.ans, T.res)}${T.res ? fbHTML(q, T.res) : ''}
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
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertige Touren des Modellbetriebs (Übungswerte). Mit „In den Planer laden“ öffnest du die Tour im Tourenplaner und kannst sie verändern.</p>` + D.examples.map(e => {
      const p = C.planTour(Object.assign({ v: 60, grund: 15, jePal: 5 }, e.p));
      return `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${vz('', V.mapSvg({ order: e.p.order }))}${p ? box('Tour ' + e.p.order.join(', ') + ' mit ' + p.f.n, '', f(p.km, 0) + ' km, ' + C.dauer(p.lenk) + ' Lenkzeit, ' + p.verst.length + ' Verstoß/Verstöße') : ''}<div class="btns"><button class="btn pri" data-ex="${e.id}">In den Planer laden</button></div></div>`;
    }).join('');
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex);
    S.undo.push(S.plan.order.slice()); Object.assign(S.plan, { order: x.p.order.slice(), fz: x.p.fz, start: x.p.start }); lsSet('plan', S.plan);
    setTab('plan'); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML = `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Touren bilden', `<p>Eine <b>Verteiltour</b> beliefert ab dem Lager mehrere Kunden und endet wieder im Lager. Eine <b>Sammeltour</b> holt Ware bei mehreren Lieferern ab.</p><span class="eq">Rundtour = Summe aller Teilstrecken + Rückfahrt zum Lager</span><p><b>Nächster-Nachbar-Verfahren:</b> Ab dem Lager immer zum nächstgelegenen Kunden, der noch offen ist. Am Ende zurück zum Lager. Das ist einfach, findet aber nicht immer die kürzeste Tour.</p><p>Außer der Strecke zählen Zeitfenster der Kunden, Stellplätze, Nutzlast sowie Lenk- und Ruhezeiten.</p>`, true) +
      sec('Fahrzeug wählen', `<span class="eq">Nutzlast = zulässiges Gesamtgewicht − Leergewicht</span><span class="eq">Stellplätze (längs) = abgerundet(Ladelänge / 1,2 m) · abgerundet(Ladebreite / 0,8 m)</span><span class="eq">Lademeter = Länge · Breite / 2,4 m (Europalette 0,4 ldm)</span><span class="eq">Ladevolumen = Länge · Breite · Höhe</span><span class="eq">Auslastung = belegt / vorhanden · 100</span><table><tr><th>Fahrzeug</th><th>Ladefläche</th><th>Stellplätze</th><th>Nutzlast</th></tr>${C.FZG.map(x => `<tr><td>${esc(x.n)}</td><td>${f(x.l)} m x ${f(x.b)} m</td><td>${C.stell(x.l, x.b)}</td><td>${f(C.nutzlast(x.zgg, x.leer), 0)} kg</td></tr>`).join('')}</table><p>Auch bei richtigem Gesamtgewicht darf keine <b>Achse</b> überlastet sein. Wo wie viel stehen darf, zeigt der Lastverteilungsplan.</p>`) +
      sec('Ladereihenfolge', `<p><b>Last In First Out:</b> Was zuletzt eingeladen wird, kommt zuerst heraus. Lade in umgekehrter Reihenfolge der Tour: Die Ware des letzten Kunden kommt zuerst hinein (vorn an die Stirnwand), die Ware des ersten Kunden zuletzt (an die Tür).</p><p>Schwere Ware unten und so, wie es der Lastverteilungsplan erlaubt. Das Sichern der Ladung übst du im Ladungssicherungs-Lab.</p>`) +
      sec('Lenk- und Ruhezeiten (EU-Verordnung 561/2006)', `<table><tr><th>Regel</th><th>Wert</th></tr><tr><td>Fahrtunterbrechung</td><td>nach höchstens 4,5 h Lenkzeit mindestens 45 min, teilbar in erst mindestens 15 min und dann mindestens 30 min</td></tr><tr><td>Tageslenkzeit</td><td>höchstens 9 h, zweimal je Woche bis 10 h</td></tr><tr><td>Wochenlenkzeit</td><td>höchstens 56 h</td></tr><tr><td>Doppelwoche</td><td>höchstens 90 h in zwei aufeinanderfolgenden Wochen</td></tr><tr><td>Tägliche Ruhezeit</td><td>mindestens 11 h, teilbar in 3 h und 9 h oder bis zu dreimal zwischen zwei wöchentlichen Ruhezeiten auf 9 h verkürzt</td></tr></table><span class="eq">Fahrzeit in min = Strecke / Geschwindigkeit · 60</span><span class="eq">Einsatzzeit = Lenkzeit + Warten + Entladen + Pausen</span><p>Be- und Entladen und Warten beim Kunden sind keine Pause. Die Regeln gelten für Fahrzeuge über 3,5 t. Für leichtere Fahrzeuge gelten eigene Regeln, im Lab rechnen wir vereinfacht für alle Fahrzeuge gleich.</p>`) +
      sec('Kosten', `<span class="eq">Kilometerkosten = Strecke · Kilometersatz</span><span class="eq">Zeitkosten = Einsatzzeit · Stundensatz</span><span class="eq">Kosten der Tour = Kilometerkosten + Zeitkosten</span><span class="eq">Kosten je Palette = Kosten der Tour / Paletten</span><span class="eq">Spediteur = Paletten · Preis je Palette</span><span class="eq">Eigene Tour lohnt ab: abgerundet(Kosten der Tour / Preis) + 1 Paletten</span><span class="eq">Leeranteil = Leerkilometer / alle Kilometer · 100</span><table><tr><th>Fahrzeug</th><th>Kilometersatz</th><th>Stundensatz</th></tr>${C.FZG.map(x => `<tr><td>${esc(x.n)}</td><td>${f(x.kmS)} €/km</td><td>${f(x.hS, 0)} €/h</td></tr>`).join('')}</table>`) +
      `<p class="hint2">Kommissionieren, Versandarten und Frachtpapiere stehen im Warenfluss-Lab, das Sichern der Ladung im Ladungssicherungs-Lab.</p>`;
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
    ({ plan: renderPlan, fzg: renderFzg, zeit: renderZeit, kost: renderKost, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Touren-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Touren-Lab: ' + T[2];
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
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertige Touren zum Laden in den Planer'], ['help', 'Hilfe und Formeln', 'Touren, Fahrzeug, Ladereihenfolge, Lenkzeiten, Kosten'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.TOU_LAB = { id: 'tou', title: 'Touren-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.TOU_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'plan');
  /* Aufruf ?aufgabe=tou1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=kurz springt zu einem Beispiel) */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
