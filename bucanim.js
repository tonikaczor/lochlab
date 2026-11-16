'use strict';
/* Tonfunk Buchführungs-Lab: Buchungssatz animiert (inline-SVG/DOM, ohne Bibliotheken).
   Wird in buclab.html NACH bucviz.js geladen.
   Zwei Spalten: links die Soll-Konten, rechts die Haben-Konten (je als T-Konto mit Saldo), in der Mitte „an“.
   Buchen: Jeder Soll-Betrag wandert vom Soll-Konto zur Mitte, jeder Haben-Betrag von der Mitte in das Haben-Konto.
   Bedienung: „Buchen“ (alle Schritte nacheinander), „Schritt“ (einzeln), „Zurück“, „Neu“. Die Bedienknöpfe sind mindestens 44 px groß.
   prefers-reduced-motion: keine Bewegung, jeder Schritt (bzw. „Buchen“) zeigt sofort den Endzustand.
   Einbau: Editor (Karte unter dem Buchungssatz-Bild; Entwurf oder Journal-Eintrag), Beispiele (Knopf unter jedem Buchungssatz).
   Aufgaben und Trainer bleiben ohne Animation (keine Lösungen verraten). Es wird nichts gespeichert, Inhalte der Aufgaben/Beispiele bleiben unverändert.
   Reine Berechnung (plan) ist ohne Oberfläche testbar: quelle/buc/test_bucanim.js. Export: window.BUC_ANIM bzw. module.exports. */
(function (root) {
  const C = root.BUC_CORE || (typeof require === 'function' ? require('./buccore.js') : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const f1 = v => (Math.round(v * 10) / 10).toString();
  const num = v => typeof v === 'number' ? v : C.parseDe(v);
  const money = v => C.fmtDe(v, 2);
  const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;

  /* ---------------------------------------------------------- Berechnung (ohne Oberfläche) */
  /* lines: [{s:'S'|'H', k, b}]; ab: {Konto: Anfangsbestand} (steht auf der normalen Seite); prior: Buchungssätze davor [{lines}] oder [lines]
     Ergebnis: { ok:false, reason:'leer'|'ungueltig'|'unausgeglichen', soll, haben }
           oder { ok:true, steps:[{t:'S'|'H', k, b}], accs:[{nr, col:'S'|'H'}], states:[{acc:{nr:{s,h,sumS,sumH,saldo,side}}, hub, hot:{nr,side}|null}], soll, haben }
     states[0] = Ausgangslage, states[i] = Zustand nach Schritt i. Erst alle Soll-Zeilen, dann alle Haben-Zeilen. */
  function plan(lines, ab, prior) {
    const raw = Array.isArray(lines) ? lines : [];
    if (!raw.length) return { ok: false, reason: 'leer' };
    const L = raw.map(l => ({ s: l && l.s === 'H' ? 'H' : l && l.s === 'S' ? 'S' : '', k: String(l && l.k || ''), b: l ? num(l.b) : NaN }));
    if (L.some(l => !l.s || !l.k || !C.konto(l.k) || !fin(l.b) || !(l.b > 0)) || L.length < 2) return { ok: false, reason: 'ungueltig' };
    L.forEach(l => { l.b = C.rd2(l.b); });
    const so = C.sums(L);
    if (!so.ok || !L.some(l => l.s === 'S') || !L.some(l => l.s === 'H')) return { ok: false, reason: 'unausgeglichen', soll: so.soll, haben: so.haben };
    const steps = L.filter(l => l.s === 'S').concat(L.filter(l => l.s === 'H')).map(l => ({ t: l.s, k: l.k, b: l.b }));
    const accs = []; steps.forEach(st => { if (!accs.some(a => a.nr === st.k)) accs.push({ nr: st.k, col: st.t }); });
    /* Ausgangslage: Anfangsbestand (nur gültige, positive, auf der normalen Seite) und Vorbuchungen */
    const base = {}; accs.forEach(a => { base[a.nr] = { s: 0, h: 0 }; });
    let hasPrior = false;
    Object.keys(ab || {}).forEach(nr => { const v = num(ab[nr]), side = C.normalSide(nr); if (base[nr] && fin(v) && v > 0 && side) base[nr][side === 'H' ? 'h' : 's'] += v; });
    (Array.isArray(prior) ? prior : []).forEach(p => {
      const pl = Array.isArray(p) ? p : p && Array.isArray(p.lines) ? p.lines : [];
      pl.forEach(l => { const v = num(l.b); if (l && base[l.k] && fin(v) && v > 0) { base[l.k][l.s === 'H' ? 'h' : 's'] += v; hasPrior = true; } });
    });
    const mk = (b) => {
      const sumS = C.rd2(b.s), sumH = C.rd2(b.h);
      const s = [], h = []; if (sumS > 0) s.push({ g: hasPrior ? 'Stand' : 'AB', b: sumS }); if (sumH > 0) h.push({ g: hasPrior ? 'Stand' : 'AB', b: sumH });
      return { s, h, sumS, sumH };
    };
    const fin2 = a => { const d = C.rd2(a.sumS - a.sumH); a.saldo = Math.abs(d); a.side = d > 0 ? 'S' : d < 0 ? 'H' : ''; return a; };
    let cur = {}; accs.forEach(a => { cur[a.nr] = fin2(mk(base[a.nr])); });
    const states = [{ acc: cur, hub: 0, hot: null }]; let hub = 0;
    steps.forEach(st => {
      const nx = {}; Object.keys(cur).forEach(nr => { const a = cur[nr]; nx[nr] = fin2({ s: a.s.slice(), h: a.h.slice(), sumS: a.sumS, sumH: a.sumH }); });
      const a = nx[st.k];
      if (st.t === 'S') { a.s.push({ g: 'neu', b: st.b }); a.sumS = C.rd2(a.sumS + st.b); hub = C.rd2(hub + st.b); }
      else { a.h.push({ g: 'neu', b: st.b }); a.sumH = C.rd2(a.sumH + st.b); hub = C.rd2(hub - st.b); }
      fin2(a); cur = nx; states.push({ acc: cur, hub, hot: { nr: st.k, side: st.t } });
    });
    return { ok: true, steps, accs, states, soll: so.soll, haben: so.haben };
  }
  const sideName = s => s === 'S' ? 'Soll' : s === 'H' ? 'Haben' : '';
  /* Text zu Zustand i (0 = Ausgangslage). Wird auch als Bildbeschreibung verwendet. */
  function caption(p, i) {
    if (!p || !p.ok) return '';
    const n = p.steps.length;
    if (i <= 0) return 'Ausgangslage: ' + p.accs.length + ' Konten, noch nichts gebucht. Drücke „Buchen“ oder gehe mit „Schritt“ einzeln vor.';
    const st = p.steps[i - 1], a = p.states[i].acc[st.k], pre = 'Schritt ' + i + ' von ' + n + ': ';
    const saldo = ' Neuer Saldo: ' + C.eur(a.saldo) + (a.side ? ' (' + sideName(a.side) + ')' : '') + '.';
    let t;
    if (st.t === 'S') t = pre + 'Soll. Das Konto ' + C.kontoLabel(st.k) + ' wird belastet: ' + C.eur(st.b) + ' stehen im Soll. Der Betrag wandert zur Mitte („an“).';
    else t = pre + 'Haben. Der Betrag wandert von der Mitte auf das Konto ' + C.kontoLabel(st.k) + ': ' + C.eur(st.b) + ' stehen im Haben.';
    t += saldo;
    if (i >= n) t += ' Fertig: Soll ' + C.eur(p.soll) + ' = Haben ' + C.eur(p.haben) + '. Der Buchungssatz ist ausgeglichen.';
    return t;
  }
  const reasonText = p => p.reason === 'leer' ? 'Wähle unten Konten und Beträge, dann kannst du den Buchungssatz animiert buchen.'
    : p.reason === 'ungueltig' ? 'Trage für jede Zeile ein Konto und einen Betrag größer 0 ein, dann kannst du animiert buchen.'
      : 'Soll (' + C.eur(p.soll) + ') und Haben (' + C.eur(p.haben) + ') sind nicht gleich groß. Gebucht wird erst, wenn beide Seiten stimmen.';

  /* ---------------------------------------------------------- Zeichnung */
  const COLW = 140, LX = 4, RX = 216, BOXH = 122, PITCH = 134, TOP = 22, ROWS = 3;
  function geom(p) {
    const col = c => p.accs.filter(a => a.col === c), pos = {};
    ['S', 'H'].forEach(c => col(c).forEach((a, i) => { pos[a.nr] = { x: c === 'S' ? LX : RX, y: TOP + i * PITCH, col: c }; }));
    const rows = Math.max(col('S').length, col('H').length, 1), h = TOP + rows * PITCH - 6;
    return { pos, rows, h, hubX: 180, hubY: TOP + (rows * PITCH - 12) / 2 };
  }
  const shown = list => list.length <= ROWS ? list : list.slice(0, ROWS - 1).concat([{ g: '…', b: C.rd2(list.slice(ROWS - 1).reduce((a, x) => a + x.b, 0)) }]);
  /* Mitte der Zelle, in der der Betrag dieses Schrittes steht (für das Wandern des Betrags) */
  function cellPos(p, g, state, st) {
    const a = state.acc[st.k], P = g.pos[st.k], list = shown(st.t === 'S' ? a.s : a.h), r = Math.max(0, list.length - 1);
    return { x: P.x + (st.t === 'S' ? COLW / 4 : 3 * COLW / 4), y: P.y + 56 + r * 14 };
  }
  /* Statischer Teil: Konten, Pfeile, Mitte. ai = Zustand der Konten, hubV = Betrag in der Mitte */
  function stageInner(p, g, ai, hubV) {
    const S = p.states[ai], hot = S.hot; let s = '';
    s += `<text x="${LX + COLW / 2}" y="13" text-anchor="middle" class="s12 b tS">Soll</text><text x="${RX + COLW / 2}" y="13" text-anchor="middle" class="s12 b tH">Haben</text>`;
    p.accs.forEach(a => {
      const P = g.pos[a.nr], ay = P.y + 60;
      if (a.col === 'S') s += `<path d="M${LX + COLW} ${ay}L${g.hubX - 16} ${f1(g.hubY)}" class="pf"/>`;
      else s += `<path d="M${g.hubX + 16} ${f1(g.hubY)}L${RX - 2} ${ay}" class="pf"/><path d="M${RX - 1} ${ay}l-9 -5v10z" class="ah"/>`;
    });
    s += `<circle cx="${g.hubX}" cy="${f1(g.hubY)}" r="15" class="nd"/><text x="${g.hubX}" y="${f1(g.hubY + 4)}" text-anchor="middle" class="s12 b">an</text>`;
    if (hubV > 0) s += `<text x="${g.hubX}" y="${f1(g.hubY + 30)}" text-anchor="middle" class="s10 b tHub">${esc(money(hubV))}</text>`;
    p.accs.forEach(a => {
      const P = g.pos[a.nr], k = C.konto(a.nr), st = S.acc[a.nr], x = P.x, y = P.y, isHot = hot && hot.nr === a.nr;
      s += `<rect x="${x}" y="${y}" width="${COLW}" height="${BOXH}" rx="8" class="bx${isHot ? ' hot' + hot.side : ''}"/>`;
      s += `<text x="${x + COLW / 2}" y="${y + 14}" text-anchor="middle" class="s11 b">${esc(a.nr)}</text><text x="${x + COLW / 2}" y="${y + 26}" text-anchor="middle" class="s10 m">${esc(cut(k.name, 19))}</text>`;
      s += `<rect x="${x + 1}" y="${y + 32}" width="${COLW / 2 - 1}" height="66" class="cS"/><rect x="${x + COLW / 2}" y="${y + 32}" width="${COLW / 2 - 1}" height="66" class="cH"/>`;
      s += `<line x1="${x}" y1="${y + 32}" x2="${x + COLW}" y2="${y + 32}" class="tl"/><line x1="${x + COLW / 2}" y1="${y + 32}" x2="${x + COLW / 2}" y2="${y + 98}" class="tl"/>`;
      s += `<text x="${x + COLW / 4}" y="${y + 43}" text-anchor="middle" class="s9 m">Soll</text><text x="${x + 3 * COLW / 4}" y="${y + 43}" text-anchor="middle" class="s9 m">Haben</text>`;
      [['S', shown(st.s), x], ['H', shown(st.h), x + COLW / 2]].forEach(([sd, list, bx]) => list.forEach((e, r) => {
        const ty = y + 60 + r * 14, txt = money(e.b), isNew = e.g === 'neu';
        if (!isNew && txt.length <= (e.g.length > 2 ? 7 : 9)) s += `<text x="${bx + 4}" y="${ty}" class="s9 m">${esc(e.g)}</text>`;
        s += `<text x="${bx + COLW / 2 - 5}" y="${ty}" text-anchor="end" class="s10${isNew ? ' b ' + (sd === 'S' ? 'tS' : 'tH') : ''}">${esc(txt)}</text>`;
      }));
      s += `<rect x="${x + 1}" y="${y + 99}" width="${COLW - 2}" height="22" rx="7" class="sb"/>`;
      s += `<text x="${x + COLW / 2}" y="${y + 114}" text-anchor="middle" class="s10 b">${st.saldo > 0 ? 'Saldo ' + esc(money(st.saldo)) + ' ' + sideName(st.side) : st.sumS || st.sumH ? 'Saldo 0,00 (ausgeglichen)' : 'Saldo 0,00'}</text>`;
    });
    return s;
  }
  /* Ganze Zeichnung: statische Ebene + Ebene für den wandernden Betrag */
  function stageSvg(p, ai, hubV, aria) {
    const g = geom(p);
    return `<svg viewBox="0 0 360 ${g.h}" role="img" aria-label="${esc(aria || 'Buchungssatz animiert')}"><g class="stat">${stageInner(p, g, ai == null ? 0 : ai, hubV == null ? 0 : hubV)}</g><g class="tok" display="none"><rect x="-34" y="-10" width="68" height="20" rx="10" class="tkb"/><text x="0" y="4" text-anchor="middle" class="tkt s10 b"></text></g></svg>`;
  }

  /* ---------------------------------------------------------- Stil */
  const CSS = `
.nva .nab{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 4px}
.nva .nab .btn{flex:1 1 0;min-width:44px;min-height:44px;padding:0 6px;font-size:14px;white-space:nowrap}
.nva .nab .btn.pri[aria-pressed=true]{background:var(--danger);border-color:var(--danger)}
.nva .nacap{margin:6px 0 0;font-size:14px;line-height:1.45;min-height:3em}
.nva svg .bx{fill:var(--bg);stroke:var(--line);stroke-width:1.2}
.nva svg .bx.hotS{stroke:var(--accent);stroke-width:2.5}.nva svg .bx.hotH{stroke:var(--hi);stroke-width:2.5}
.nva svg .sb{fill:var(--panel2)}
.nva svg .tHub{fill:var(--fg)}
.nva svg .tkb{fill:var(--accent-bg)}.nva svg .tok.tokH .tkb{fill:var(--hi)}
.nva svg .tkt{fill:#fff}.nva svg .tok.tokH .tkt{fill:#1b1f24}
.nva .nac{margin:6px 0 4px}
.nva .nac .btn{min-height:44px}
@media print{.nva{display:none!important}}`;

  const API = { plan, caption, reasonText, geom, stageSvg, stageInner, cellPos, CSS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.BUC_ANIM = API;
  if (typeof document === 'undefined' || !C) return;

  /* ---------------------------------------------------------- Bedienung (nur im Browser) */
  const $ = id => document.getElementById(id);
  const stl = document.createElement('style'); stl.id = 'naCss'; stl.textContent = CSS; document.head.appendChild(stl);
  const reduced = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const DUR = 750, PAUSE = 500;

  /* host: Element; in = {lines, ab, prior}. Liefert { destroy }. */
  function mount(host, inp) {
    const p = plan(inp.lines, inp.ab, inp.prior);
    if (!p.ok) { host.innerHTML = `<p class="hint2" style="margin:0">${esc(reasonText(p))}</p>`; return { destroy() { } }; }
    const n = p.steps.length, g = geom(p);
    host.innerHTML = '<div class="nast"></div><div class="nab" role="group" aria-label="Buchung steuern">'
      + '<button type="button" class="btn pri" data-na="play" aria-pressed="false">▶ Buchen</button>'
      + '<button type="button" class="btn" data-na="next">Schritt ▸</button>'
      + '<button type="button" class="btn" data-na="back">◂ Zurück</button>'
      + '<button type="button" class="btn" data-na="reset">↺ Neu</button></div>'
      + '<p class="nacap" aria-live="polite"></p>';
    const stage = host.querySelector('.nast'), cap = host.querySelector('.nacap'), B = a => host.querySelector('[data-na="' + a + '"]');
    let i = 0, playing = false, raf = 0, timer = 0, fin_ = null, dead = false, stepId = 0;
    stage.innerHTML = stageSvg(p, 0, 0, caption(p, 0));
    const svgEl = stage.firstChild, stat = svgEl.querySelector('.stat'), tok = svgEl.querySelector('.tok'), tokT = tok.querySelector('text');
    const draw = (ai, hv) => { stat.innerHTML = stageInner(p, g, ai, hv); };
    const ui = () => {
      const pl = B('play'); pl.textContent = playing ? '■ Stopp' : (i >= n ? '↻ Nochmal' : '▶ Buchen'); pl.setAttribute('aria-pressed', playing ? 'true' : 'false');
      B('next').disabled = i >= n; B('back').disabled = i <= 0 && !raf; B('reset').disabled = i <= 0 && !raf;
      const c = caption(p, i); cap.textContent = c; svgEl.setAttribute('aria-label', c);
    };
    const stop = () => { playing = false; clearTimeout(timer); timer = 0; };
    const settle = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } tok.setAttribute('display', 'none'); const f = fin_; fin_ = null; if (f) f(); };
    function goStep(j, cb) {                       /* Schritt j (1..n) ausführen, animiert oder sofort */
      const st = p.steps[j - 1];
      i = j;
      const done = () => { draw(j, p.states[j].hub); if (cb) cb(); ui(); };
      if (reduced() || !root.requestAnimationFrame) { draw(j, p.states[j].hub); if (cb) cb(); ui(); return; }
      const cell = cellPos(p, g, p.states[j], st), hub = { x: g.hubX, y: g.hubY }, from = st.t === 'S' ? cell : hub, to = st.t === 'S' ? hub : cell;
      if (st.t === 'S') draw(j, p.states[j - 1].hub); else draw(j - 1, p.states[j].hub);
      tok.setAttribute('class', 'tok ' + (st.t === 'S' ? 'tokS' : 'tokH')); tokT.textContent = money(st.b); tok.removeAttribute('display');
      const place = t => { const e = ease(t); tok.setAttribute('transform', 'translate(' + f1(from.x + (to.x - from.x) * e) + ' ' + f1(from.y + (to.y - from.y) * e) + ')'); };
      place(0); fin_ = done; ui();
      const t0 = performance.now();
      const tick = now => { if (dead || !host.isConnected) { raf = 0; return; } const t = Math.min(1, (now - t0) / DUR); place(t); if (t < 1) raf = requestAnimationFrame(tick); else { raf = 0; settle(); } };
      raf = requestAnimationFrame(tick);
      const my = ++stepId; setTimeout(() => { if (raf && my === stepId && !dead) settle(); }, DUR + 400);   /* Sicherung: rAF pausiert in Hintergrund-Tabs */
    }
    function next(cb) { if (raf) { settle(); if (!cb) return; } if (i >= n) return; goStep(i + 1, cb); }
    function loop() {
      if (!playing || dead) return;
      if (i >= n) { stop(); ui(); return; }
      next(() => { if (playing && i < n) timer = setTimeout(loop, reduced() ? 0 : PAUSE); else if (i >= n) { stop(); } });
    }
    function play() {
      if (playing) { stop(); settle(); ui(); return; }
      if (raf) settle();
      if (i >= n) { i = 0; draw(0, 0); }
      if (reduced()) { stop(); i = n; draw(n, p.states[n].hub); ui(); return; }          /* direkt Endzustand */
      playing = true; ui(); loop();
    }
    function jump(j) { stop(); settle(); i = j; draw(j, p.states[j].hub); ui(); }
    host.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-na]'); if (!b || b.disabled) return;
      const a = b.dataset.na;
      if (a === 'play') play();
      else if (a === 'next') { stop(); if (raf) settle(); else next(); ui(); }
      else if (a === 'back') jump(Math.max(0, i - (raf ? 0 : 1)));
      else if (a === 'reset') jump(0);
    });
    ui();
    return { destroy() { dead = true; stop(); if (raf) cancelAnimationFrame(raf); raf = 0; } };
  }

  /* ---------------------------------------------------------- Einbau in die Seite */
  /* Editor: Karte unter dem Buchungssatz-Bild; gleiche Auswahl (Entwurf / Journal-Nummer) wie dort */
  const readEd = () => { try { return JSON.parse(localStorage.getItem('lm4.buc.ed') || '{}') || {}; } catch (e) { return {}; } };
  const abOf = ab => (root.BUC_VIZ && root.BUC_VIZ.abMap) ? root.BUC_VIZ.abMap(ab) : {};
  function draftLines(v) {
    return [...v.querySelectorAll('.bl[data-bl]')].map(r => {
      const on = r.querySelector('[data-bv].on'), k = r.querySelector('select[data-bf="k"]'), b = r.querySelector('input[data-bf="b"]');
      return { s: on ? on.dataset.bv : 'S', k: k ? k.value : '', b: b ? C.parseDe(b.value) : NaN };
    }).filter(l => l.k || fin(l.b));
  }
  const edView = $('edView');
  if (edView) {
    let key = '', ctl = null, t = 0;
    const run = () => {
      t = 0;
      const ed = readEd(), J = Array.isArray(ed.j) ? ed.j.filter(b => b && Array.isArray(b.lines)) : [], nb = $('nvBook');
      const on = nb && nb.querySelector('[data-nvb].on'), sel = on ? on.dataset.nvb : 'd';
      const useJ = sel !== 'd' && J[+sel];
      const lines = useJ ? J[+sel].lines : draftLines(edView), prior = useJ ? J.slice(0, +sel) : J, ab = abOf(ed.ab);
      const k = JSON.stringify([lines, prior, ab, sel]);
      let c = $('nvAnim');
      if (c && c.parentNode === edView && k === key) return;
      if (!c || c.parentNode !== edView) {
        c = document.createElement('div'); c.id = 'nvAnim'; c.className = 'card pl nv nva'; c.innerHTML = '<h4>Animation: Buchen, der Betrag wandert</h4><div class="nvb"></div>';
        const ref = nb && nb.parentNode === edView ? nb.nextSibling : null; ref ? edView.insertBefore(c, ref) : edView.appendChild(c); ctl = null;
      }
      key = k; if (ctl) ctl.destroy();
      ctl = mount(c.lastChild, { lines, ab, prior });
    };
    const later = () => { if (!t) t = setTimeout(run, 160); };
    ['input', 'change', 'click'].forEach(ev => edView.addEventListener(ev, e => { if (e.target.closest && e.target.closest('#nvAnim')) return; later(); }));
    setTimeout(run, 160);
    /* Karte wurde vom Editor neu gebaut (z. B. nach Tabwechsel): wieder einsetzen */
    new MutationObserver(() => { if (!$('nvAnim') || $('nvAnim').parentNode !== edView) { key = ''; later(); } }).observe(edView, { childList: true });
  }
  /* Beispiele: Knopf „Animiert buchen“ unter jedem Buchungssatz */
  const bsp = $('bspView');
  if (bsp) {
    let t = 0;
    const build = () => {
      t = 0; const D = root.BUC_DATA; if (!D || !D.examples) return;
      mo.disconnect();
      try {
        [...bsp.querySelectorAll('.card')].forEach(cd => {
          const btn = cd.querySelector('[data-ex]'); if (!btn) return; const ex = D.examples.find(x => x.id === btn.dataset.ex); if (!ex) return;
          [...cd.querySelectorAll('.bsatz')].forEach((el, j) => {
            if (!ex.buchungen[j]) return;
            let ref = el; if (ref.nextElementSibling && ref.nextElementSibling.classList.contains('nvbs')) ref = ref.nextElementSibling;
            if (ref.nextElementSibling && ref.nextElementSibling.classList.contains('nac')) return;
            const w = document.createElement('div'); w.className = 'nac nva';
            w.innerHTML = '<button type="button" class="btn" aria-expanded="false">▶ Animiert buchen</button><div class="nva nv" hidden style="margin-top:6px"></div>';
            ref.parentNode.insertBefore(w, ref.nextSibling);
            const bt = w.firstChild, box = w.lastChild; let ctl = null;
            bt.addEventListener('click', () => {
              if (ctl) { ctl.destroy(); ctl = null; box.hidden = true; box.innerHTML = ''; bt.textContent = '▶ Animiert buchen'; bt.setAttribute('aria-expanded', 'false'); return; }
              box.hidden = false; bt.textContent = '✕ Animation schließen'; bt.setAttribute('aria-expanded', 'true');
              ctl = mount(box, { lines: ex.buchungen[j].lines, ab: ex.ab, prior: ex.buchungen.slice(0, j) });
            });
          });
        });
      } catch (e) { if (root.console) console.warn('bucanim', e); }
      mo.observe(bsp, { childList: true, subtree: true });
    };
    const later = () => { if (!t) t = setTimeout(build, 120); };
    const mo = new MutationObserver(later);
    build();
  }
})(typeof window !== 'undefined' ? window : globalThis);
