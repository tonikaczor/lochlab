'use strict';
/* Tonfunk Maschinen-Lab: Ablaufansicht "Werkstück-Weg" (Lab-Kennung 'mak'). window.MAK_WEG bzw. module.exports.
   Ein Werkstück wandert als Symbol durch die Stationen (Maschinen) eines Beispielwegs; die aktive Station hebt sich ab.
   Bedienung: Zurück, Weiter, Abspielen/Pause, Neu, Tempo (Langsam, Normal, Schnell); jede Station ist antippbar. Alles per Antippen, mindestens 44 px.
   Daten: keine neuen Fachinhalte. Arbeit, Maschinentyp und Begründung kommen aus MAK_DATA.pools.JOBS und MTYPES (Aufgaben "Welche Maschine?"),
   Maschinenname, Kurzbeschreibung und Zeichnung aus MAK_CORE.MACHINES bzw. MAK_VIZ. Die Wege selbst (welche Arbeiten hintereinander) sind BEISPIELE;
   maßgebend ist der Arbeitsplan der Werkstatt. Ein Weg beginnt immer mit dem Zuschnitt, danach folgen die Arbeiten in der Reihenfolge des Beispiels.
   Bewegung: prefers-reduced-motion schaltet das Wandern ab (das Symbol springt), Abspielen und Schrittschaltung bleiben nutzbar.
   Farben nur über CSS-Variablen (siehe maklab.html, Klassen .wg-*). Keine Bibliothek.
   Speicher (über makui: lm4.mak.weg): { r: Weg-Kennung, t: Tempo }. */
(function (root) {
  /* Maschinentyp (Reihenfolge wie MAK_DATA.pools.MTYPES) -> Maschine aus MAK_CORE.MACHINES, die den Typ im Lab vertritt */
  const TYPE_MACH = ['tb2', 'sbA', 'dgr', 'frd', 'bfr', 'vbs', 'cncf'];
  /* Beispielwege: j = Indizes in MAK_DATA.pools.JOBS (Arbeit, Maschinentyp, Begründung) */
  const ROUTES = [
    { id: 'teil', title: 'Teil mit Fläche, Nut und Bohrung', blurb: 'Zuschneiden, Fläche und Nut fräsen, kleine Bohrung setzen.', j: [5, 3, 0] },
    { id: 'gross', title: 'Teil mit großer Bohrung', blurb: 'Zuschneiden, Fläche und Nut fräsen, große Bohrung in der Ständerbohrmaschine.', j: [5, 3, 1] },
    { id: 'rund', title: 'Rundteil', blurb: 'Rundstab zuschneiden und auf Maß abdrehen.', j: [5, 2] },
    { id: 'eine', title: 'Kleines Teil in einer Aufspannung', blurb: 'Zuschneiden, dann Bohrung, Nut und Bohrbild in einer Aufspannung.', j: [5, 4] },
    { id: 'serie', title: 'Serie nach Programm', blurb: 'Zuschneiden, dann die Frästeile in größerer Serie nach Programm.', j: [5, 6] }
  ];
  const TEMPO = [['slow', 'Langsam', 3600], ['mid', 'Normal', 2200], ['fast', 'Schnell', 1100]];
  const START_TXT = 'Das Werkstück liegt bereit. Tippe auf Weiter oder Abspielen: Es wandert nun von Station zu Station.';
  const END_TXT = 'Alle Stationen dieses Beispielwegs sind durchlaufen. Das Werkstück ist fertig bearbeitet.';
  const NOTE = 'Die Wege sind Beispiele. Welche Maschinen in welcher Reihenfolge arbeiten, steht im Arbeitsplan deiner Werkstatt; maßgebend sind Zeichnung, Arbeitsplan und die Betriebsanweisung.';

  const clamp = (i, n) => Math.max(0, Math.min(n - 1, Number.isInteger(i) ? i : 0));
  const delayOf = t => { const e = TEMPO.find(x => x[0] === t) || TEMPO[1]; return e[2]; };
  const route = id => ROUTES.find(r => r.id === id) || ROUTES[0];

  /* Schritte eines Wegs: Start, eine Station je Arbeit, Ziel. ctx = { C: MAK_CORE, D: MAK_DATA } */
  function build(routeId, ctx) {
    const r = route(routeId), C = ctx.C, P = ctx.D.pools, steps = [{ kind: 'start', label: 'Start', name: 'Werkstück bereit', text: START_TXT }];
    r.j.forEach((ji, k) => {
      const job = P.JOBS[ji], mid = TYPE_MACH[job[1]], m = C.machine(mid);
      steps.push({ kind: 'station', no: k + 1, label: m.abbr, name: P.MTYPES[job[1]], mach: mid, machName: m.name, blurb: m.blurb, work: job[0], why: job[2] });
    });
    steps.push({ kind: 'end', label: 'Ziel', name: 'Fertig', text: END_TXT });
    return steps;
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const WORK_SVG = '<svg viewBox="0 0 40 28" aria-hidden="true" focusable="false"><path d="M4 8l6-6h26a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" class="wg-wk-b"/><path d="M4 8h30M34 8l4-4" class="wg-wk-l"/><circle cx="22" cy="18" r="3.4" class="wg-wk-h"/></svg>';

  /* ---------------- Oberfläche ---------------- */
  const U = { host: null, ctx: null, route: 'teil', tempo: 'mid', i: 0, steps: [], playing: false, timer: 0, placed: false, ro: null };
  const reduce = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };

  function persist() { try { U.ctx.set && U.ctx.set('weg', { r: U.route, t: U.tempo }); } catch (e) {} }
  function stop() { U.playing = false; clearTimeout(U.timer); U.timer = 0; }
  function schedule() {
    clearTimeout(U.timer);
    if (!U.playing) return;
    U.timer = setTimeout(() => {
      if (!U.host || !U.host.isConnected || !U.host.offsetParent) { stop(); paintControls(); return; }
      if (U.i >= U.steps.length - 1) { stop(); paintControls(); return; }
      go(U.i + 1, true); schedule();
    }, delayOf(U.tempo));
  }
  function go(i, animate) {
    U.i = clamp(i, U.steps.length); paintChain(); paintDetail(); paintControls(); placeWork(!!animate && !reduce());
  }

  function paintChain() {
    const ol = U.host.querySelector('.wg-chain'); if (!ol) return;
    [...ol.querySelectorAll('.wg-st')].forEach((b, k) => {
      b.classList.toggle('on', k === U.i); b.classList.toggle('done', k < U.i);
      if (k === U.i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      const mk = b.querySelector('.wg-mk'); if (mk) mk.textContent = k < U.i ? '✓' : (k === U.i ? '●' : '');
    });
  }
  function paintControls() {
    const h = U.host, n = U.steps.length, at = U.i >= n - 1;
    const set = (sel, fn) => { const e = h.querySelector(sel); if (e) fn(e); };
    set('[data-w=prev]', e => { e.disabled = U.i <= 0; });
    set('[data-w=next]', e => { e.disabled = at; });
    set('[data-w=play]', e => { e.innerHTML = U.playing ? '⏸ Pause' : (at ? '↺ Nochmal abspielen' : '▶ Abspielen'); e.setAttribute('aria-pressed', U.playing ? 'true' : 'false'); });
    set('.wg-cnt', e => { e.textContent = 'Schritt ' + (U.i + 1) + ' von ' + n; });
  }
  function detailHtml(s) {
    if (s.kind !== 'station') return `<p class="big" style="font-size:17px">${esc(s.name)}</p><p class="wg-tx">${esc(s.text)}</p>`;
    return `<p class="big" style="font-size:17px">Station ${s.no}: ${esc(s.name)} <span class="wg-ab">${esc(s.label)}</span></p>` +
      `<div class="rdout"><span class="st">Arbeit</span>${esc(s.work)}</div>` +
      `<div class="rdout ok"><span class="st">Warum diese Maschine</span>${esc(s.why)}</div>` +
      `<p class="hint2" style="margin:6px 0"><b>${esc(s.machName)}:</b> ${esc(s.blurb)}</p>` +
      (U.ctx.viz ? `<div class="mkv wg-draw">${vizOf(s.mach)}</div>` : '') +
      (U.ctx.openMachine ? `<div class="btns"><button class="btn" data-w="open" data-m="${esc(s.mach)}">⚙️ Maschine und Drehzahltafel öffnen</button></div>` : '');
  }
  function vizOf(id) { try { return U.ctx.viz.machine(id, {}); } catch (e) { return '<p class="hint2">Die Zeichnung konnte nicht aufgebaut werden.</p>'; } }
  function paintDetail() {
    const d = U.host.querySelector('.wg-detail'); if (!d) return;
    d.innerHTML = detailHtml(U.steps[U.i]);
  }
  /* Werkstück-Symbol über den Platz der aktiven Station setzen; mit animate fährt es dorthin, sonst springt es */
  function placeWork(animate) {
    const h = U.host, wk = h && h.querySelector('.wg-wk'), box = h && h.querySelector('.wg-box'); if (!wk || !box) return;
    const slot = box.querySelectorAll('.wg-slot')[U.i]; if (!slot) return;
    const b = box.getBoundingClientRect(), s = slot.getBoundingClientRect();
    const x = s.left - b.left + (s.width - wk.offsetWidth) / 2, y = s.top - b.top + (s.height - wk.offsetHeight) / 2;
    wk.style.transitionDuration = animate && U.placed ? Math.min(900, delayOf(U.tempo) * 0.45) + 'ms' : '0ms';
    wk.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    U.placed = true;
  }

  function render() {
    const h = U.host, steps = U.steps = build(U.route, U.ctx);
    U.i = clamp(U.i, steps.length);
    h.innerHTML = `<div class="card pl wg"><h4>Werkstück-Weg: Ablauf durch die Maschinen</h4>` +
      `<p class="hint2" style="margin:0 0 8px">Das Werkstück wandert von Maschine zu Maschine. Die aktive Station ist hervorgehoben; mit Weiter gehst du Schritt für Schritt, mit Abspielen läuft der Weg von allein.</p>` +
      `<label class="f"><span>Beispielweg</span><select data-w="route">${ROUTES.map(r => `<option value="${r.id}"${r.id === U.route ? ' selected' : ''}>${esc(r.title)}</option>`).join('')}</select></label>` +
      `<p class="hint2" style="margin:0 0 6px">${esc(route(U.route).blurb)}</p>` +
      `<div class="wg-box"><ol class="wg-chain" aria-label="Stationen des Werkstücks">${steps.map((s, k) => `<li class="wg-li"><button type="button" class="wg-st wg-${s.kind}" data-w="go" data-i="${k}" aria-label="${esc(k + 1 + '. ' + (s.kind === 'station' ? 'Station ' + s.name : s.name))}"><span class="wg-slot"><span class="wg-mk"></span></span><span class="wg-nm"><b>${esc(s.label)}</b><small>${esc(s.kind === 'station' ? s.name : s.name)}</small></span></button></li>`).join('')}</ol><div class="wg-wk" aria-hidden="true">${WORK_SVG}</div></div>` +
      `<div class="wg-ctl" role="group" aria-label="Ablauf steuern"><button class="btn" data-w="prev" aria-label="Einen Schritt zurück">◀ Zurück</button><button class="btn pri" data-w="play" aria-pressed="false">▶ Abspielen</button><button class="btn" data-w="next" aria-label="Einen Schritt weiter">Weiter ▶</button><button class="btn" data-w="reset" aria-label="Zurück zum Start">↺ Neu</button></div>` +
      `<div class="wg-row"><span class="wg-cnt" aria-hidden="true"></span><div class="seg" role="group" aria-label="Tempo">${TEMPO.map(t => `<button type="button" data-w="tempo" data-t="${t[0]}" class="${t[0] === U.tempo ? 'on' : ''}" aria-pressed="${t[0] === U.tempo}">${t[1]}</button>`).join('')}</div></div>` +
      `<div class="wg-detail" aria-live="polite"></div></div>` +
      `<div class="rdout warn">⚠ ${esc(NOTE)}</div>`;
    U.placed = false; paintChain(); paintDetail(); paintControls();
    const wk = h.querySelector('.wg-wk'); if (wk) wk.style.transitionDuration = '0ms';
    (root.requestAnimationFrame || (f => setTimeout(f, 0)))(() => placeWork(false));
    schedule();
  }

  function onClick(e) {
    const b = e.target.closest('[data-w]'); if (!b || b.disabled) return;
    const w = b.dataset.w;
    if (w === 'next') { stop(); go(U.i + 1, true); }
    else if (w === 'prev') { stop(); go(U.i - 1, true); }
    else if (w === 'reset') { stop(); go(0, true); }
    else if (w === 'go') { stop(); go(parseInt(b.dataset.i, 10), true); }
    else if (w === 'play') {
      if (U.playing) stop(); else { if (U.i >= U.steps.length - 1) go(0, false); U.playing = true; schedule(); }
      paintControls();
    } else if (w === 'tempo') {
      U.tempo = b.dataset.t; persist();
      [...U.host.querySelectorAll('[data-w=tempo]')].forEach(x => { const on = x.dataset.t === U.tempo; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
      if (U.playing) schedule();
    } else if (w === 'open' && U.ctx.openMachine) { stop(); U.ctx.openMachine(b.dataset.m); }
  }
  function onChange(e) {
    const s = e.target.closest('[data-w=route]'); if (!s) return;
    stop(); U.route = route(s.value).id; U.i = 0; persist(); render();
  }

  /* ctx: { C, D, viz, get(k), set(k, v), openMachine(id) }; host: Element. Wird bei jedem Öffnen des Reiters neu gezeichnet, der Stand bleibt erhalten. */
  function mount(host, ctx) {
    if (U.host !== host) {
      U.host = host; stop();
      host.addEventListener('click', onClick); host.addEventListener('change', onChange);
      if (root.ResizeObserver) { try { U.ro = new root.ResizeObserver(() => { if (host.offsetParent) placeWork(false); }); U.ro.observe(host); } catch (e) {} }
    }
    U.ctx = ctx;
    let sv = null; try { sv = ctx.get && ctx.get('weg'); } catch (e) {}
    if (sv && !U.sv) { U.sv = 1; if (sv.r && ROUTES.some(r => r.id === sv.r)) U.route = sv.r; if (sv.t && TEMPO.some(t => t[0] === sv.t)) U.tempo = sv.t; }
    render();
  }

  root.MAK_WEG = { ROUTES, TYPE_MACH, TEMPO, START_TXT, END_TXT, NOTE, clamp, delayOf, route, build, mount, stop };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MAK_WEG;
})(typeof window !== 'undefined' ? window : globalThis);
