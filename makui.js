'use strict';
/* Tonfunk Maschinen-Lab: Oberfläche (Lab-Kennung 'mak').
   ALLE Richtwerte, Zeiten und Regeln sind ÜBUNGSWERTE für die Ausbildung; maßgebend sind Maschinentafel, Tabellenbuch, Werkzeughersteller und die Betriebsanweisung der Werkstatt.
   Reiter: Maschinen (Zeichnung mit antippbaren Bauteilen, Hebel, Drehzahltafel live), Rechner (Drehzahl, Stufe, Schnittzeit), CNC-Bedienfeld (Tasten, Betriebsarten), Aufgaben, Trainer, Beispiele, Hilfe.
   Module: makcore.js (MAK_CORE), makdata.js (MAK_DATA, MAK_TASKS), makviz.js (MAK_VIZ, Zeichnungen).
   Speicher (Präfix lm4.mak.): tab, mach, rech, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Bedienung: Alles per Antippen (mindestens 44 px, kein Hover); Bauteile der Zeichnung sind zusätzlich als Liste wählbar.
   Aufruf: maklab.html?aufgabe=mak1 öffnet die Aufgabe, maklab.html?bsp öffnet die Beispiele (?bsp=bohr1 springt zu einem Beispiel). */
(function (root) {
  const C = root.MAK_CORE, D = root.MAK_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.mak.';
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
  const V = () => root.MAK_VIZ || null;
  const svgOf = fn => { const v = V(); if (!v) return '<p class="hint2">Die Zeichnung steht nicht zur Verfügung (makviz.js fehlt).</p>'; try { return fn(v); } catch (e) { return '<p class="hint2">Die Zeichnung konnte nicht aufgebaut werden.</p>'; } };
  if (!C || !D) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Maschinen-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">makcore.js oder makdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['mach', '⚙️', 'Maschinen'], ['rech', '🧮', 'Rechner'], ['cnc', '🎛️', 'CNC-Bedienfeld'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const S = {
    tab: lsGet('tab', 'mach'),
    mach: Object.assign({ m: 'sbA', pk: {}, hs: null, d: '10', rg: 'L', n: '' }, lsGet('mach', {})),
    rech: Object.assign({ m: 'sbA', proc: 'bohr', grp: 'stahl', cut: 'hss', d: '10', vc: '25', L: '30', f: '0,11' }, lsGet('rech', {})),
    cnc: { st: C.cncNew(), msg: 'Schalte zuerst die Maschine ein: Not-Aus entriegelt, dann MACHINE ON.', last: null },
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (!C.machine(S.mach.m)) S.mach.m = 'sbA'; if (!S.mach.pk || typeof S.mach.pk !== 'object') S.mach.pk = {};
  if (!C.machine(S.rech.m)) S.rech.m = 'sbA'; if (!C.PROCS[S.rech.proc]) S.rech.proc = 'bohr'; if (!C.VC_TAB.bohr[S.rech.grp]) S.rech.grp = 'stahl'; if (S.rech.cut !== 'hm') S.rech.cut = 'hss';
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (k, label, val, unit) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input data-k="${k}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  const UEB = 'Alle Richtwerte, Zeiten und Regeln in diesem Lab sind Übungswerte für die Ausbildung. Maßgebend sind die Tafel an der Maschine, das Tabellenbuch, die Herstellerangaben des Werkzeugs und die Betriebsanweisung deiner Werkstatt.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const sel = (k, opts, cur) => `<select data-k="${k}">${opts.map(o => `<option value="${esc(o[0])}"${String(cur) === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  const MOPTS = C.MACHINE_IDS.map(id => [id, C.machine(id).name]);
  const stg = v => f(v, 0) + ' min⁻¹';
  const reduce = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };

  /* ============================================================ Maschinen */
  const picksOf = m => { const cur = S.mach.pk[m.id]; return Array.isArray(cur) && cur.length === m.sel.length && cur.every((v, i) => v >= 0 && v < m.sel[i].opts.length) ? cur : m.sel.map(() => 0); };
  function machState(m) {
    /* Drehzahl der gewählten Einstellung (n) und Zustandstext */
    if (C.hasTable(m)) { const p = picksOf(m); return { n: C.speedAt(m, p), picks: p }; }
    if (C.isCont(m) && fin(m.cont.ranges[0].lo)) { const n = P(S.mach.n), r = m.cont.ranges.find(x => x.id === S.mach.rg) || m.cont.ranges[0]; return { n: fin(n) ? n : NaN, rg: r, valid: fin(n) && n >= r.lo && n <= r.hi }; }
    if (C.isCont(m)) { const n = P(S.mach.n); return { n: fin(n) && n > 0 ? n : NaN, free: true }; }
    return { n: NaN };
  }
  function renderMach() {
    const m = C.machine(S.mach.m), st = machState(m), n = st.n, hs = S.mach.hs && m.hot.find(h => h.id === S.mach.hs);
    const spin = !reduce() && fin(n) && n > 0 ? C.spinRel(m, n) : 0;
    let h = `<label class="f"><span>Maschine</span>${sel('m', MOPTS, m.id)}</label><p class="hint2" style="margin:0 0 4px">${esc(m.blurb)}</p>`;
    h += `<div class="mkv" id="mkMachine">${svgOf(v => v.machine(m.id, { sel: S.mach.hs, spin }))}</div>`;
    h += `<p class="hint2" style="margin:0 0 4px">Tippe ein Bauteil in der Zeichnung an oder wähle es aus der Liste.${spin ? ' Das Symbol neben der Spindel dreht sich im Takt der gewählten Drehzahl (nicht maßstäblich).' : ''}</p>`;
    h += `<div class="hslist">${m.hot.map(x => `<button class="chip${S.mach.hs === x.id ? ' on' : ''}" data-hs="${esc(x.id)}">${esc(x.name)}</button>`).join('')}</div>`;
    h += hs ? `<div class="rdout"><span class="st">${esc(hs.name)}</span>${esc(hs.text)}</div>` : '';
    if (C.hasTable(m)) {
      const p = st.picks;
      h += `<div class="card pl"><h4>Drehzahl einstellen: ${esc(m.name)}</h4><div class="lvr">${m.sel.map((s, i) => `<div class="grp"><span>${esc(s.label)}</span>${seg('data-pk', s.opts.map((o, j) => [i + ':' + j, o]), i + ':' + p[i])}</div>`).join('')}</div>`;
      h += `<div class="bigval">${esc(f(n, 0))} <small>min⁻¹</small></div><div class="inst" style="padding:6px">${svgOf(v => v.tafel(m.id, p))}</div>`;
      h += inp('d', 'Werkzeugdurchmesser für die Schnittgeschwindigkeit', S.mach.d, 'mm');
      const d = P(S.mach.d); h += fin(d) && d > 0 ? box('Schnittgeschwindigkeit bei dieser Stufe', 'vc = π · d · n / 1000', f(C.vcFromN(d, n), 1) + ' m/min') : '';
      if (m.feed) h += `<div class="hint2" style="margin:8px 0 2px">Vorschubtafel (mm je Umdrehung):</div><div class="inst" style="padding:6px">${svgOf(v => v.tafel(m.id, null, { feed: true }))}</div>`;
      h += '</div>';
    } else if (C.isCont(m) && fin(m.cont.ranges[0].lo)) {
      h += `<div class="card pl"><h4>Drehzahl einstellen: ${esc(m.name)}</h4><div class="lvr"><div class="grp"><span>Hebel (nur im Stillstand schalten)</span>${seg('data-rg', m.cont.ranges.map(r => [r.id, 'Reihe ' + r.id + ' (' + r.lo + ' bis ' + r.hi + ')']), S.mach.rg)}</div></div>`;
      h += inp('n', 'Drehzahl am Regler', S.mach.n, 'min⁻¹');
      h += fin(n) ? (st.valid ? box('Anzeige', '', stg(n), 'ok') : note('Der Wert liegt außerhalb der Reihe ' + st.rg.id + ' (' + st.rg.lo + ' bis ' + st.rg.hi + ' min⁻¹). Wähle die andere Reihe oder einen anderen Wert.')) : '';
      h += `<div class="inst" style="padding:6px">${svgOf(v => v.tafel(m.id, null, { n: fin(n) ? n : null }))}</div>`;
      const d = P(S.mach.d); h += inp('d', 'Werkstückdurchmesser für die Schnittgeschwindigkeit', S.mach.d, 'mm');
      h += fin(d) && d > 0 && fin(n) ? box('Schnittgeschwindigkeit', 'vc = π · d · n / 1000', f(C.vcFromN(d, n), 1) + ' m/min') : '';
      h += '</div>';
    } else if (C.isCont(m)) {
      h += `<div class="card pl"><h4>Drehzahl einstellen: ${esc(m.name)}</h4>${inp('n', 'Drehzahl laut Anzeige', S.mach.n, 'min⁻¹')}${inp('d', 'Werkzeugdurchmesser', S.mach.d, 'mm')}`;
      const d = P(S.mach.d); h += fin(n) && fin(d) && d > 0 ? box('Schnittgeschwindigkeit', 'vc = π · d · n / 1000', f(C.vcFromN(d, n), 1) + ' m/min') : '';
      h += note('Der Drehzahlbereich dieser Maschine steht in der Werkstatt-Anleitung, nicht im Lab.', 'warn') + '</div>';
    } else h += `<div class="card pl"><h4>Drehzahlen</h4><p class="hint2">${esc(m.none || '')}</p></div>`;
    $('#machView').innerHTML = h + ueb();
  }
  const mv = $('#machView');
  mv.addEventListener('click', e => {
    const pk = e.target.closest('[data-pk]'), rg = e.target.closest('[data-rg]'), hsb = e.target.closest('[data-hs]');
    if (pk) { const [i, j] = pk.dataset.pk.split(':').map(Number), m = C.machine(S.mach.m), p = picksOf(m).slice(); p[i] = j; S.mach.pk[m.id] = p; lsSet('mach', S.mach); renderMach(); return; }
    if (rg) { S.mach.rg = rg.dataset.rg; lsSet('mach', S.mach); renderMach(); return; }
    if (hsb) { S.mach.hs = S.mach.hs === hsb.dataset.hs && hsb.tagName === 'BUTTON' ? null : hsb.dataset.hs; lsSet('mach', S.mach); renderMach(); }
  });
  mv.addEventListener('keydown', e => { const g = e.target.closest && e.target.closest('g[data-hs]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); S.mach.hs = g.dataset.hs; lsSet('mach', S.mach); renderMach(); } });
  mv.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.k === 'm') { S.mach.m = e.target.value; S.mach.hs = null; lsSet('mach', S.mach); renderMach(); } });
  mv.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.k; if (k === 'd' || k === 'n') { S.mach[k] = e.target.value; lsSet('mach', S.mach); machLive(); } });
  function machLive() { /* nur die Ergebnisse neu zeichnen, damit das Eingabefeld den Fokus behält */ const a = document.activeElement, k = a && a.dataset && a.dataset.k, pos = a && a.selectionStart; renderMach(); if (k) { const el = $('input[data-k="' + k + '"]', mv); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } } }

  /* ============================================================ Rechner */
  function rechParams(s) { return { m: C.machine(s.m) ? s.m : 'sbA', proc: C.PROCS[s.proc] ? s.proc : 'bohr', grp: C.VC_TAB.bohr[s.grp] ? s.grp : 'stahl', cut: s.cut === 'hm' ? 'hm' : 'hss', d: P(s.d), vc: P(s.vc), L: P(s.L), f: P(s.f) }; }
  function rechOut(p) {
    const m = C.machine(p.m); let h = '';
    if (!(p.d > 0) || !(p.vc >= 0) || !fin(p.vc)) return note('Gib einen Durchmesser und eine Schnittgeschwindigkeit ein (Zahlen, Komma erlaubt).');
    const w = C.vcWindow(p.proc, p.grp, p.cut), nS = C.nFromVc(p.vc, p.d);
    h += w ? box('Richtwert für vc (' + C.PROCS[p.proc] + ', ' + (p.cut === 'hm' ? 'Hartmetall' : 'HSS') + ')', '', f(w[0], 0) + ' bis ' + f(w[1], 0) + ' m/min') : note('Für diese Kombination gibt es keinen Richtwert (Bohren nur mit HSS).');
    if (w) { const s = C.vcStatus(p.vc, w); if (s !== 'ok') h += note('Dein gewähltes vc liegt ' + (s === 'niedrig' ? 'unter' : 'über') + ' dem Richtwert.'); }
    h += box('Solldrehzahl', 'n = vc · 1000 / (π · d)', f(nS, 0) + ' min⁻¹');
    const sf = C.stageFor(m, nS); let nUse = nS;
    if (sf) {
      nUse = sf.n;
      if (!sf.cont) h += box('Stufe der ' + m.name, 'nächstkleinere Stufe der Tafel', stg(sf.n) + ' (' + C.pickLabel(m, sf.p) + ')', sf.status === 'ok' || sf.status === 'exakt' ? 'ok' : 'warn');
      else h += box('Einstellung der ' + m.name, 'Reihe ' + sf.range, stg(sf.n), sf.status === 'ok' ? 'ok' : 'warn');
      if (sf.status === 'zuhoch') h += note('Selbst die kleinste Stufe ist höher als der Sollwert: Diese Maschine ist dafür zu schnell. Wähle eine andere Maschine oder ein anderes Verfahren.');
      if (sf.status === 'zuniedrig') h += note('Die größte Stufe der Maschine reicht für den Sollwert nicht aus: Es wird nur diese Schnittgeschwindigkeit erreicht. Eine schnellere Maschine ist besser geeignet.');
      const vcA = C.vcFromN(p.d, sf.n); h += box('Tatsächliche Schnittgeschwindigkeit', 'vc = π · d · n / 1000', f(vcA, 1) + ' m/min', w && C.vcStatus(vcA, w) === 'ok' ? 'ok' : 'warn');
      if (w && C.vcStatus(vcA, w) !== 'ok') h += note('Mit dieser Stufe liegt vc ' + (C.vcStatus(vcA, w) === 'niedrig' ? 'unter' : 'über') + ' dem Richtwert-Fenster (' + f(w[0], 0) + ' bis ' + f(w[1], 0) + ' m/min).');
    } else h += note(m.cont && m.cont.note ? 'Stufenlose Maschine ohne bekannten Bereich: Stelle die Solldrehzahl an der Anzeige ein; den Bereich nennt die Werkstatt-Anleitung.' : 'Für diese Maschine gibt es im Lab keine Drehzahltafel. Die Drehzahl steht auf der Maschine oder im Programm.', 'warn');
    const mill = p.proc === 'fraes';
    if (p.L > 0 && p.f > 0) {
      if (mill) { const t = C.millTimeMin(p.L, p.f); h += box('Schnittzeit grob', 't = L / vf', f(t * 60, 1) + ' s (' + f(t, 2) + ' min)'); }
      else { const t = C.timeMin(p.L, p.f, nUse); h += box('Vorschubgeschwindigkeit', 'vf = f · n', f(C.vfOf(p.f, nUse), 1) + ' mm/min') + box('Schnittzeit grob', 't = L / (f · n)', f(t * 60, 1) + ' s (' + f(t, 2) + ' min)'); }
    }
    return h;
  }
  function renderRech() {
    const r = S.rech, p = rechParams(r), m = C.machine(p.m), w = C.vcWindow(p.proc, p.grp, p.cut), sf = !isNaN(p.vc) && p.d > 0 ? C.stageFor(m, C.nFromVc(p.vc, p.d)) : null;
    let h = `<div class="card pl"><h4>Drehzahl und Stufe</h4><label class="f"><span>Maschine</span>${sel('m', MOPTS, p.m)}</label><div class="fbar"><span class="lbl" style="font-size:12px;color:var(--mute)">VERFAHREN</span>${seg('data-pr', Object.keys(C.PROCS).map(k => [k, C.PROCS[k]]), p.proc)}</div>`;
    h += `<div class="dsrow"><label class="f"><span>Werkstoff</span>${sel('grp', C.GRUPPEN, p.grp)}</label><label class="f"><span>Werkzeug</span>${sel('cut', [['hss', 'HSS (Schnellarbeitsstahl)']].concat(p.proc === 'bohr' ? [] : [['hm', 'Hartmetall']]), p.proc === 'bohr' ? 'hss' : p.cut)}</label></div>`;
    h += `<div class="dsrow">${inp('d', 'Durchmesser d (Werkzeug oder Werkstück)', r.d, 'mm')}${inp('vc', 'Schnittgeschwindigkeit vc', r.vc, 'm/min')}</div>`;
    h += w ? `<div class="btns" style="margin:0 0 8px"><button class="btn" data-rw="mid">Richtwert-Mitte übernehmen (${f((w[0] + w[1]) / 2, 0)} m/min)</button></div>` : '';
    h += `<div class="dsrow">${inp('L', 'Weg L (Bohrtiefe, Drehlänge, Fräsweg)', r.L, 'mm')}${inp('f', p.proc === 'fraes' ? 'Vorschubgeschwindigkeit vf' : 'Vorschub f', r.f, p.proc === 'fraes' ? 'mm/min' : 'mm/U')}</div></div>`;
    h += `<div id="rechOut">${rechOut(p)}</div>`;
    if (C.hasTable(m)) h += `<div class="card pl"><h4>Tafel der ${esc(m.name)}</h4><div class="inst" style="padding:6px">${svgOf(v => v.tafel(m.id, sf && !sf.cont ? sf.p : null))}</div><p class="hint2">Die markierte Zelle ist die gewählte Stufe.</p></div>`;
    $('#rechView').innerHTML = h + ueb();
  }
  function updateRech() { const o = $('#rechOut'); if (o) o.innerHTML = rechOut(rechParams(S.rech)); }
  const rv2 = $('#rechView');
  rv2.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.k; if (k === 'd' || k === 'vc' || k === 'L' || k === 'f') { S.rech[k] = e.target.value; lsSet('rech', S.rech); updateRech(); } });
  rv2.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.k; if (k === 'm' || k === 'grp' || k === 'cut') { S.rech[k] = e.target.value; if (k === 'm') { const kd = C.machine(S.rech.m).kind; S.rech.proc = kd === 'dreh' ? 'dreh' : kd === 'fraes' ? 'fraes' : 'bohr'; } lsSet('rech', S.rech); renderRech(); } });
  rv2.addEventListener('click', e => {
    const pr = e.target.closest('[data-pr]'), rw = e.target.closest('[data-rw]');
    if (pr) { S.rech.proc = pr.dataset.pr; if (S.rech.proc === 'bohr') S.rech.cut = 'hss'; lsSet('rech', S.rech); renderRech(); }
    else if (rw) { const w = C.vcWindow(S.rech.proc, S.rech.grp, S.rech.cut); if (w) { S.rech.vc = String((w[0] + w[1]) / 2).replace('.', ','); lsSet('rech', S.rech); renderRech(); } }
  });

  /* ============================================================ CNC-Bedienfeld */
  function cncScreen(st) { return {}; }
  function renderCnc() {
    const st = S.cnc.st, k = S.cnc.last && C.KEYS[S.cnc.last];
    let h = `<p class="hint2" style="margin:0 0 6px">Bedienfeld einer CNC-Fräsmaschine als Modell. Tippe die Tasten an: Die Anzeige reagiert wie an der Steuerung. Schrittweiten und Abläufe sind vereinfacht. Das Programm läuft nur in AUTO oder SINGLE, die Achstasten nur in MANUAL.</p>`;
    h += `<div class="mkv" id="mkPanel">${svgOf(v => v.panel({ state: st, press: S.cnc.last }))}</div>`;
    h += `<div class="msgbar" aria-live="polite">${esc(S.cnc.msg)}</div>`;
    if (k) h += `<div class="rdout"><span class="st">Taste ${esc(k.l)} · ${esc(k.g)}</span>${esc(k.t)}</div>`;
    h += `<div class="btns"><button class="btn" data-cx="reset">↺ Modell zurücksetzen</button></div>`;
    h += `<div class="card pl"><h4>Programm lesen</h4><table class="tt">${st.prog.map((l, i) => `<tr><td>${i === st.blk ? '▶ ' : ''}<b>${esc(l)}</b></td><td>${C.parseBlock(l).filter(o => o.L !== 'N').map(o => esc(o.w + ': ' + o.t)).join('<br>')}</td></tr>`).join('')}</table><p class="hint2">G0 ist der Eilgang (nur im freien Raum), G1 die Bearbeitung mit Vorschub F, M30 das Programmende. Satznummern beginnen mit N. Bei G- und M-Funktionen, die nicht in der Tabelle stehen, gilt das Handbuch der Maschine.</p></div>`;
    $('#cncView').innerHTML = h + ueb();
  }
  function cncKey(key) { const r = C.cncPress(S.cnc.st, key); S.cnc.st = r.st; S.cnc.msg = r.msg; S.cnc.last = key; renderCnc(); }
  const cv = $('#cncView');
  cv.addEventListener('click', e => {
    const k = e.target.closest('[data-key]'), x = e.target.closest('[data-cx]');
    if (k) cncKey(k.dataset.key); else if (x) { S.cnc = { st: C.cncNew(), msg: 'Modell zurückgesetzt. Schalte zuerst die Maschine ein.', last: null }; renderCnc(); }
  });
  cv.addEventListener('keydown', e => { const g = e.target.closest && e.target.closest('g[data-key]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); cncKey(g.dataset.key); } });

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
  function vizHtml(q, a) {
    const z = q.viz; if (!z) return '';
    if (z.t === 'machine') return `<div class="mkv">${svgOf(v => v.machine(z.id, { mark: z.mark, inter: false }))}</div>`;
    if (z.t === 'tafel') return `<div class="inst" style="padding:6px">${svgOf(v => v.tafel(z.id, null, { feed: z.feed }))}</div>`;
    if (z.t === 'pratze') return `<div class="mkv">${svgOf(v => v.pratze({ stuetze: z.stuetze, schraube: z.schraube, quiz: true }))}</div>`;
    if (z.t === 'panel') { const isKey = q.ask.type === 'key'; return `<div class="mkv">${svgOf(v => v.panel({ screen: z.screen, press: isKey && a ? a.k : null, inter: isKey }))}</div>`; }
    return '';
  }
  function qBody(q, a, r, pre) {
    const dn = r && (r.ok || pre === 'rt'), as = q.ask; let h = vizHtml(q, a);
    if (as.type === 'choice') h += `<div class="opts">${as.choices.map((c, i) => `<button data-tc="${i}" ${dn ? 'disabled' : ''} class="${r && i === as.correct && dn ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    else if (as.type === 'num') h += `<label class="f"><span>${esc(as.label)}${as.unit ? ' (' + esc(as.unit) + ')' : ''}</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${dn ? 'disabled' : ''}><span class="u">${esc(as.unit)}</span></div></label>`;
    else if (as.type === 'order') { const o = a.o || []; h += `<p class="hint2" style="margin:4px 0">Tippe die Einträge in der richtigen Reihenfolge an. Nochmal tippen nimmt einen Eintrag zurück.</p><div class="opts">${as.items.map((t, i) => { const k = o.indexOf(i); return `<button data-to="${i}" ${dn ? 'disabled' : ''} class="${k >= 0 ? 'on' : ''}"><span class="no">${k >= 0 ? k + 1 : '·'}</span> ${esc(t)}</button>`; }).join('')}</div><div class="btns"><button class="btn" data-oc="1" ${dn ? 'disabled' : ''}>↺ Reihenfolge zurücksetzen</button></div>`; }
    else if (as.type === 'match') { const m = a.m || []; h += `<div class="mrows">${as.rows.map((t, i) => `<label class="mrow"><span>${esc(t)}</span><select data-mr="${i}" ${dn ? 'disabled' : ''}><option value="">– wählen –</option>${as.options.map((op, j) => `<option value="${j}"${m[i] === j ? ' selected' : ''}>${esc(op)}</option>`).join('')}</select></label>`).join('')}</div>`; }
    else if (as.type === 'key') h += `<p class="hint2" style="margin:4px 0">${a.k ? 'Gewählt: ' + esc(C.KEYS[a.k].l) + '. Antippen einer anderen Taste ändert die Wahl.' : 'Tippe die Taste im Bedienfeld an, dann auf „Prüfen“.'}</p>`;
    return h;
  }
  function evalQ(q, a) { const e = D.evaluate(q, a); if (e.err) { toast(e.err); return null; } return e; }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 2))} ${esc(q.ask.unit)} (wegen Rundung).</li>` : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(D.solText(q))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const Vw = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || (S.tAns[t.id] = {});
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${qText(q.text)}${qBody(q, a, r, 'tk')}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    Vw.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    S.tRes = { id: t.id, ok: e.ok, given: e.given, pct };
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
  tv.addEventListener('keydown', e => { const t = curTask(); if (!t) return; if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } const g = e.target.closest && e.target.closest('g[data-key]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pickKey(t, g.dataset.key); } });
  function pickKey(t, k) { (S.tAns[t.id] = S.tAns[t.id] || {}).k = k; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); }
  tv.addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]'), to = e.target.closest('[data-to]'), oc = e.target.closest('[data-oc]'), ky = e.target.closest('g[data-key]');
    if (ky && t && S.tq.ask.type === 'key' && !(S.tRes && S.tRes.ok)) { pickKey(t, ky.dataset.key); return; }
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
      <div class="fbar"><span class="lbl" style="font-size:12px;color:var(--mute)">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${qText(q.text)}${qBody(q, T.ans, T.res, 'rt')}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}</div>`;
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr.ans.v = e.target.value; });
  rv.addEventListener('change', e => { const mr = e.target.dataset && e.target.dataset.mr; if (mr != null && !S.tr.res) { const a = S.tr.ans; a.m = a.m || []; a.m[+mr] = e.target.value === '' ? null : +e.target.value; } });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } const g = e.target.closest && e.target.closest('g[data-key]'); if (g && !S.tr.res && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); S.tr.ans.k = g.dataset.key; renderTrainer(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]'), to = e.target.closest('[data-to]'), oc = e.target.closest('[data-oc]'), ky = e.target.closest('g[data-key]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (ky && T.q && T.q.ask.type === 'key' && !T.res) { T.ans.k = ky.dataset.key; renderTrainer(); return; }
    if (tc && !T.res) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (to && !T.res) { const o = T.ans.o = T.ans.o || [], i = +to.dataset.to, k = o.indexOf(i); if (k >= 0) o.splice(k, 1); else o.push(i); renderTrainer(); return; }
    if (oc && !T.res) { T.ans.o = []; renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if (!T.res && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res) return; const e = evalQ(T.q, T.ans); if (!e) return;
    T.res = { ok: e.ok, given: e.given }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Beispiele */
  function cncExState(p) {
    const st = C.cncNew(); st.on = true; st.mode = p.mode || 'AUTO'; st.ovr = p.ovr == null ? 100 : p.ovr; st.blk = p.blk || 0;
    let pos = { x: 0, y: 0, z: 50 }; for (let i = 0; i < st.blk; i++) pos = C.targetOf(st.prog[i], pos); st.pos = pos; return st;
  }
  function exBody(e) {
    const p = e.p;
    if (e.tab === 'rech') return rechOut(rechParams(p));
    if (e.tab === 'mach') { const m = C.machine(p.m), n = C.speedAt(m, p.sel), h = m.hot.find(x => x.id === p.hs); return `<div class="mkv">${svgOf(v => v.machine(m.id, { sel: p.hs, spin: reduce() ? 0 : C.spinRel(m, n) }))}</div><div class="inst" style="padding:6px">${svgOf(v => v.tafel(m.id, p.sel))}</div>` + box('Drehzahl', C.pickLabel(m, p.sel), stg(n)) + (h ? `<div class="rdout"><span class="st">${esc(h.name)}</span>${esc(h.text)}</div>` : ''); }
    if (e.tab === 'spann') return `<div class="mkv">${svgOf(v => v.pratze(p))}</div>` + note(p.stuetze === 'gleich' && p.schraube === 'werkstueck' ? 'Richtig: Die Pratze liegt waagerecht, die Schraube sitzt nahe am Werkstück, so wirkt die Spannkraft dort, wo sie gebraucht wird.' : 'Falsch: ' + (p.stuetze === 'hoch' ? 'Die Stütze ist höher als das Werkstück, die Pratze liegt nur an der Kante.' : p.stuetze === 'tief' ? 'Die Stütze ist niedriger als das Werkstück, die Pratze kippt.' : 'Die Schraube sitzt nahe an der Stütze, am Werkstück bleibt wenig Spannkraft.'), p.stuetze === 'gleich' && p.schraube === 'werkstueck' ? 'ok' : 'bad');
    if (e.tab === 'cnc') { const st = cncExState(p); return `<div class="mkv">${svgOf(v => v.panel({ state: st, inter: false }))}</div>` + note('Satz ' + (st.blk + 1) + ': ' + st.prog[Math.min(st.blk, st.prog.length - 1)] + '. Override ' + st.ovr + ' %: Ist-Vorschub = F · ' + st.ovr + ' / 100.', 'ok'); }
    return '';
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele (Übungswerte). Mit „In den Rechner laden“ bzw. „Ansehen“ öffnest du die Zahlen im passenden Reiter und kannst sie verändern.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}${e.tab === 'spann' ? '' : `<div class="btns"><button class="btn pri" data-ex="${e.id}">${e.tab === 'rech' ? 'In den Rechner laden' : e.tab === 'mach' ? 'An der Maschine öffnen' : 'Im Bedienfeld öffnen'}</button></div>`}</div>`).join('');
  }
  function loadExample(x) {
    const p = x.p;
    if (x.tab === 'rech') { S.rech = Object.assign({}, S.rech, { m: p.m, proc: p.proc, grp: p.grp, cut: 'hss', d: p.d, vc: p.vc, L: p.L, f: p.f }); lsSet('rech', S.rech); }
    else if (x.tab === 'mach') { S.mach.m = p.m; S.mach.pk[p.m] = p.sel.slice(); S.mach.hs = p.hs || null; lsSet('mach', S.mach); }
    else if (x.tab === 'cnc') { S.cnc = { st: cncExState(p), msg: 'Beispiel geladen: ' + x.title, last: null }; }
    else return;
    setTab(x.tab);
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex); if (!x) return;
    loadExample(x); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function tafelTable(m) {
    const g = C.gridOf(m); if (!g) return '';
    return `<table><tr><th>${esc(m.name)}</th>${g.cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr>${g.rows.map((r, i) => `<tr><td>${esc(r.label)}</td>${g.vals[i].map(v => `<td>${f(v, 0)}</td>`).join('')}</tr>`).join('')}</table>`;
  }
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Drehzahl und Schnittgeschwindigkeit', `<span class="eq">n = vc · 1000 / (π · d)</span><span class="eq">vc = π · d · n / 1000</span><p>d in mm, n in min⁻¹, vc in m/min. Beim Bohren und Fräsen ist d der Werkzeugdurchmesser, beim Drehen der Werkstückdurchmesser. Bei Maschinen mit festen Stufen nimmst du die <b>nächstkleinere Stufe</b> der Tafel (lieber etwas langsamer), bei stufenlosen Maschinen stellst du die Zahl ein.</p><table><tr><th>Werkstoff</th><th>Bohren HSS</th><th>Drehen HSS</th><th>Fräsen HSS</th></tr>${C.GRUPPEN.map(g => `<tr><td>${esc(g[1])}</td>${['bohr', 'dreh', 'fraes'].map(pr => { const w = C.vcWindow(pr, g[0], 'hss'); return `<td>${f(w[0], 0)} bis ${f(w[1], 0)}</td>`; }).join('')}</tr>`).join('')}</table><p>Richtwerte in m/min (Übungswerte, gerundet).</p>`, true) +
      sec('Zeit grob', `<span class="eq">vf = f · n</span><span class="eq">t = L / (f · n)</span><p>L ist der Gesamtweg mit An- und Überlauf. Beim Fräsen rechnet man mit der Vorschubgeschwindigkeit vf in mm/min: t = L / vf.</p>`) +
      sec('Die Maschinen der Werkstatt', `<p>${C.MACHINE_IDS.map(id => `<b>${esc(C.machine(id).name)}</b>: ${esc(C.machine(id).blurb)}`).join('</p><p>')}</p><p class="hint2">Die Werkstatt-Nummern deiner Maschinen kann der Ausbilder ergänzen.</p>`) +
      sec('Drehzahltafeln (aus den Maschinen abgelesen)', C.MACHINE_IDS.filter(id => C.hasTable(C.machine(id))).map(id => tafelTable(C.machine(id))).join('') + `<p>Stufenlos: ${esc(C.machine('dsl').name)} hat zwei Reihen, L (35 bis 440 min⁻¹) und H (200 bis 2500 min⁻¹), umgeschaltet nur im Stillstand. Im Bereich 200 bis 440 gehen beide Reihen.</p>`) +
      sec('Sicherheit an Maschinen', `<ul><li><b>Not-Aus:</b> roter Pilz auf gelbem Grund, nur für die Gefahr; danach erst Ursache klären, dann entriegeln.</li><li><b>Haare, Schmuck, Handschuhe:</b> Haare sichern, Ringe, Uhren und Ketten ablegen, an drehenden Teilen keine Handschuhe, eng anliegende Kleidung.</li><li><b>Späne</b> nie mit der Hand, immer bei Stillstand mit Haken, Handfeger oder Pinsel; nicht mit Druckluft wegblasen.</li><li><b>Spannen statt halten:</b> Werkstücke im Schraubstock oder mit Spannelementen fest spannen.</li><li><b>Futterschlüssel</b> sofort abziehen. Schutzhaube und Futterschutz nie überbrücken.</li><li><b>Schutzbrille</b> tragen. Kühlschmierstoff: Hautschutz beachten, Verschüttetes aufnehmen, Absaugung bei staubenden Werkstoffen.</li><li>Getriebe und Drehzahlhebel nur bei Stillstand schalten.</li></ul>`) +
      sec('Spannen und Werkzeuge', `<ul><li><b>Maschinenschraubstock:</b> für Quader, Teil satt anlegen, fest anziehen, beim Durchbohren unterlegen.</li><li><b>Spannpratzen:</b> Stütze so hoch wie das Werkstück, Schraube nahe am Werkstück, Nutenstein in der T-Nut.</li><li><b>Kniehebelspanner:</b> schnell, für Serien.</li><li><b>Bohrfutter:</b> Bohrer zentrisch und fest spannen, Schlüssel abziehen. <b>Morsekegel:</b> Kegel klemmt, Austreiber zum Lösen.</li></ul>`) +
      sec('CNC-Bedienung', `<ul>${['manual', 'auto', 'single', 'teach', 'start', 'stop', 'reset', 'notaus', 'mason'].map(k => `<li><b>${esc(C.KEYS[k].l)}:</b> ${esc(C.KEYS[k].t)}</li>`).join('')}</ul><p>Vorschub-Override: Ist = F · Override / 100. Restweg = Soll − Ist. Erstlauf: SINGLE, kleiner Override, Haube zu, Hand am Not-Aus.</p>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte; Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'mach'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ mach: renderMach, rech: renderRech, cnc: renderCnc, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Maschinen-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Maschinen-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('mach');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe und Formeln', 'Drehzahl, Tafeln, Sicherheit, Spannen, CNC'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.MAK_LAB = { id: 'mak', title: 'Maschinen-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.MAK_TASKS };

  /* Rauchtest für quelle/mak/test_makcore.js (läuft nur, wenn der Test window.__MAK_TEST setzt) */
  root.MAK_UI = {
    /* Test: Punkte einer gelösten Aufgabe mit zwei Tipps im normalen Üben (100) bzw. im Prüfmodus (50) */
    scoreTest: function (examOn) {
      if (!root.__MAK_TEST) return 'nur im Test';
      lsSet('exam', examOn ? '1' : '0'); startTask('mak6'); hintFor(S.tq, 'mak6'); hintFor(S.tq, 'mak6'); S.tAns.mak6 = D.solAns(S.tq); checkTask(TASKS.find(t => t.id === 'mak6')); return lsGet('prog', {}).mak6;
    },
    smoke: function () {
      if (!root.__MAK_TEST) return 'nur im Test';
      try {
        TABS.forEach(t => setTab(t[0]));
        C.MACHINE_IDS.forEach(id => { S.mach.m = id; S.mach.hs = (C.machine(id).hot[0] || {}).id; renderMach(); const m = C.machine(id); if (C.hasTable(m)) m.sel.forEach((s, i) => s.opts.forEach((_, j) => { const p = picksOf(m).slice(); p[i] = j; S.mach.pk[id] = p; renderMach(); })); S.mach.n = '300'; S.mach.d = '20'; renderMach(); S.mach.n = 'x'; renderMach(); });
        S.mach.rg = 'H'; S.mach.m = 'dsl'; S.mach.n = '1200'; renderMach(); S.mach.n = '3000'; renderMach();
        C.MACHINE_IDS.forEach(id => { S.rech.m = id; Object.keys(C.PROCS).forEach(pr => { S.rech.proc = pr; C.GRUPPEN.forEach(g => { S.rech.grp = g[0]; ['hss', 'hm'].forEach(c => { S.rech.cut = c; renderRech(); }); }); }); });
        S.rech.d = '0'; renderRech(); S.rech.d = 'x'; renderRech(); S.rech.d = '10'; S.rech.vc = '150'; S.rech.m = 'bfr'; S.rech.proc = 'fraes'; S.rech.grp = 'alu'; renderRech(); S.rech.vc = '2'; S.rech.m = 'tb2'; renderRech();
        ['mason', 'auto', 'start', 'reset', 'single', 'start', 'start', 'manual', 'xp', 'zm', 's1000', 'ovrplus', 'ovr0', 'notaus', 'start', 'notaus', 'mason', 'klemm', 'memlock', 'stop'].forEach(k => cncKey(k)); C.KEY_ORDER.forEach(k => cncKey(k));
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
        setTab('bsp'); setTab('help'); return 'ok';
      } catch (e) { return e && e.stack ? e.stack : String(e); }
    }
  };

  /* Start erst nach dem Laden aller Skripte (makviz.js wird nach makui.js eingebunden und liefert die Zeichnungen) */
  function boot() {
    buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'mach');
    /* Aufruf ?aufgabe=mak1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=bohr1 springt zu einem Beispiel) */
    try {
      const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
      if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
      else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
