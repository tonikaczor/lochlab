'use strict';
/* Tonfunk Zeichnungs-Lab: Oberfläche (Lab-Kennung 'zei').
   Reiter: Werkstatt, Linien, Maßstab, Aufgaben, Trainer, Beispiele, Hilfe.
   Module: zeicore.js (ZEI_CORE, Rechnung, SVG), zeidata.js (ZEI_DATA, ZEI_TASKS).
   Speicher (Präfix lm4.zei.): tab, werk, mas, bsp, done ({id:true} nur gelöste), prog ({id:Prozent}), hints ({id:höchste Stufe}),
   ctipps ({id:Stufe} nur im Prüfmodus), exam ('1' = Prüfmodus), rt (Trainer: n, ok, streak, best), vari ({id:Variante}).
   Tipp-Abzug (25 % je Stufe) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts. */
(function (root) {
  const C = root.ZEI_CORE, D = root.ZEI_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.zei.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  const LET = 'ABCD';

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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Zeichnungs-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">zeicore.js oder zeidata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['werk', '🧊', 'Werkstatt'], ['lin', '✏️', 'Linien'], ['mas', '📐', 'Maßstab'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📚', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const S = {
    tab: lsGet('tab', 'werk'),
    werk: Object.assign({ model: 'winkel', seed: 1, r: 0, hid: true, ctr: true, dim: false, mode: 'ans', cy: 1 }, lsGet('werk', {})),
    mas: Object.assign({ sc: '2:1', nat: '20', zei: '40' }, lsGet('mas', {})),
    bsp: Object.assign({ id: 'winkel', r: 0, hid: true, ctr: true, dim: true }, lsGet('bsp', {})),
    task: null, tInst: null, tAns: {}, tRes: null,
    tr: { cat: 'Alle', spec: null, inst: null, ans: {}, res: null, counted: false },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();
  if (!D.models[S.werk.model] && S.werk.model !== 'rand') S.werk.model = 'winkel';
  if (!D.examples.some(e => e.id === S.bsp.id)) S.bsp.id = 'winkel';
  const availW = () => Math.max(240, Math.min(document.documentElement.clientWidth - 52, 1040));
  const F = (f, o) => C.svg.fig(f, o);
  const inst = h => `<div class="inst zc1">${h}</div>`;
  const werkModel = () => S.werk.model === 'rand' ? C.genBody(C.rng('werk' + S.werk.seed), 3) : C.modelByName(S.werk.model);
  const chipRow = (items, cur, attr) => items.map(i => `<button class="chip s${cur === i[0] ? ' on' : ''}" data-${attr}="${esc(i[0])}">${esc(i[1])}</button>`).join('');
  const toggle = (k, label, on) => `<button class="chip s${on ? ' on' : ''}" data-tg="${k}" aria-pressed="${on}">${label}</button>`;
  const LEGEND = `<div class="zleg"><span><svg width="34" height="10"><line x1="2" y1="5" x2="32" y2="5" class="zv"/></svg> sichtbare Kante (Volllinie breit)</span><span><svg width="34" height="10"><line x1="2" y1="5" x2="32" y2="5" class="zh"/></svg> verdeckte Kante (Strichlinie)</span><span><svg width="34" height="10"><line x1="1" y1="5" x2="33" y2="5" class="zc"/></svg> Mittellinie (Strich-Punkt)</span></div>`;

  /* ============================================================ Werkstatt */
  const BLICK = ['von vorn rechts', 'von vorn links', 'von hinten links', 'von hinten rechts'];
  function renderWerk() {
    const w = S.werk, m = werkModel(), W = availW(), def = D.models[w.model];
    if (w.cy >= m.ny || w.cy < 0) w.cy = Math.min(1, m.ny - 1);
    let h = `<div class="ctl">${chipRow(Object.keys(D.models).filter(k => k !== 'wuerfel').map(k => [k, D.models[k].title]), w.model, 'wm')}<button class="chip s${w.model === 'rand' ? ' on' : ''}" data-wm="rand">🎲 Zufallskörper</button></div>`;
    h += `<div class="fbar"><div class="seg" id="wMode"><button data-wmode="ans" class="${w.mode === 'ans' ? 'on' : ''}">Ansichten</button><button data-wmode="cut" class="${w.mode === 'cut' ? 'on' : ''}">Schnitt</button></div>
      <div class="seg"><button data-wr="-1" aria-label="Körper nach links drehen">⟲ drehen</button><button data-wr="1" aria-label="Körper nach rechts drehen">drehen ⟳</button></div></div>`;
    h += `<div class="ctl">${w.mode === 'ans' ? toggle('hid', 'Verdeckte Kanten', w.hid) + toggle('ctr', 'Mittellinien', w.ctr) + toggle('dim', 'Maße', w.dim) : `<span class="lbl" style="align-self:center;font-size:12px;color:var(--mute)">Schnitt durch Schicht</span>${Array.from({ length: m.ny }, (_, i) => `<button class="chip s${w.cy === i ? ' on' : ''}" data-wcy="${i}">${i + 1}</button>`).join('')}`}</div>`;
    h += `<div class="card pl"><h4>Isometrie · Blick ${BLICK[((w.r % 4) + 4) % 4]}</h4>${inst(F({ k: 'iso', m, r: w.r }, { w: Math.min(W, 420), smax: 46 }))}
      <p class="hint2">Gitter ${m.nx} × ${m.ny} × ${m.nz} Würfel, ein Würfel = ${m.u} mm${def && def.note ? '. ' + esc(def.note) : '. Zufallskörper: Mit „Zufallskörper“ erzeugst du einen neuen.'}</p></div>`;
    if (w.mode === 'ans') h += `<div class="card pl"><h4>Ansichten nach Projektionsmethode 1 (Europa)</h4>${inst(F({ k: 'views', m, hid: w.hid, center: w.ctr, dim: w.dim }, { w: Math.min(W, 520), smax: 52 }))}${LEGEND}
      <p class="hint2">Vorderansicht in der Mitte, die Draufsicht liegt darunter, die Seitenansicht von links liegt rechts daneben. Die Vorderseite ist in der Isometrie die linke sichtbare Fläche (Blick von vorn rechts, Pfeil unter dem Bild beachten).</p></div>`;
    else h += `<div class="card pl"><h4>Vollschnitt A–A durch die Schicht ${w.cy + 1}</h4><div class="zrow">${inst(F({ k: 'topcut', m, cy: w.cy }, { w: Math.min(W, 300), smax: 46 }))}${inst(F({ k: 'section', m, cy: w.cy }, { w: Math.min(W, 300), smax: 46 }))}</div>
      <p class="hint2">Die Schnittebene liegt mitten in der gewählten Schicht (von vorn gezählt). Der vordere Teil ist weggenommen, die Pfeile zeigen die Blickrichtung. Die Schnittfläche wird unter 45° schraffiert, verdeckte Kanten zeichnet man im Schnitt nicht.</p></div>`;
    $('#werkView').innerHTML = h;
  }
  $('#werkView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const w = S.werk, d = b.dataset;
    if (d.wm) { w.model = d.wm; if (d.wm === 'rand') w.seed = Math.floor(Math.random() * 1e6) + 1; } else if (d.wmode) w.mode = d.wmode; else if (d.wr) w.r += +d.wr; else if (d.tg) w[d.tg] = !w[d.tg]; else if (d.wcy != null) w.cy = +d.wcy; else return;
    lsSet('werk', w); renderWerk();
  });

  /* ============================================================ Linien */
  function anatomySvg() {
    const x0 = 70, y0 = 56, w = 150, h = 70;
    return `<svg class="zsvg" viewBox="0 0 330 150" style="width:100%;max-width:420px;height:auto;display:block;margin:0 auto" role="img" aria-label="Aufbau einer Maßeintragung"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" class="zv"/>${C.svg.dimH(x0, x0 + w, y0 - 20, y0, '40')}${C.svg.dimV(y0, y0 + h, x0 - 20, x0, '20')}
      <text class="zn" x="${x0 + w + 8}" y="30">Maßlinie mit Maßpfeilen</text><text class="zn" x="${x0 + w + 8}" y="${y0 + 40}">Maßhilfslinien: senkrecht</text><text class="zn" x="${x0 + w + 8}" y="${y0 + 53}">zur Strecke, ragen über</text><text class="zn" x="${x0 + w + 8}" y="${y0 + 66}">die Maßlinie hinaus</text><text class="zn" x="${x0 - 56}" y="${y0 + h + 22}">Maßzahl (links, von rechts lesbar)</text></svg>`;
  }
  function renderLin() {
    let h = '<div class="card pl"><h4>Linienarten nach DIN EN ISO 128-20 (Kurzform)</h4><p class="hint2" style="margin:0 0 6px">Breite Linien sind doppelt so breit wie schmale Linien.</p>';
    D.lines.forEach(l => { h += `<div class="zline"><div class="zls">${F({ k: 'line', id: l.id }, { w: 150 })}</div><div class="grow"><b>${esc(l.name)}</b><small>Linientyp ${esc(l.nr)}</small><div>${esc(l.use)}</div></div></div>`; });
    h += '<div class="btns"><button class="btn pri" data-go="Linien und Bemaßung">Linienarten üben</button></div></div>';
    h += `<div class="card pl"><h4>Aufbau einer Maßeintragung</h4>${inst(anatomySvg())}<ul class="zlist"><li>Maßlinie und Maßhilfslinie: Volllinie schmal.</li><li>Maßzahl über der Maßlinie, lesbar von unten oder von rechts.</li><li>Vor Durchmessern steht ⌀, vor Radien R. Einheit: mm (wird nicht geschrieben).</li><li>Jedes Maß nur einmal. Die Maßzahl ist immer das Naturmaß, egal welcher Maßstab.</li></ul>
      <div class="btns"><button class="btn" data-go="Linien und Bemaßung">Bemaßung üben</button></div></div>`;
    $('#linView').innerHTML = h;
  }
  $('#linView').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { S.tr.cat = b.dataset.go; setTab('rt'); newTrainer(); } });

  /* ============================================================ Maßstab */
  const SCS = ['1:1', '1:2', '1:5', '1:10', '2:1', '5:1', '10:1'];
  const scArr = s => s.split(':').map(Number);
  function masNums() { const sc = scArr(S.mas.sc); return { a: sc[0], b: sc[1] }; }
  function barsSvg() {
    const sc = masNums(), nat = C.parseDe(S.mas.nat), W = 320; if (!(nat > 0)) return '';
    const zei = nat * sc.a / sc.b, k = Math.min(1, (W - 20) / Math.max(nat, zei));
    return `<svg class="zsvg" viewBox="0 0 ${W} 74" style="width:100%;max-width:${W}px;height:auto;display:block;margin:0 auto" role="img" aria-label="Vergleich Naturmaß und Zeichnungsmaß"><text class="zn" x="10" y="14">Bauteil in Wirklichkeit: ${C.fmtDe(nat)} mm</text><rect x="10" y="20" width="${(nat * k).toFixed(1)}" height="9" class="zbn"/><text class="zn" x="10" y="48">Strecke in der Zeichnung: ${C.fmtDe(Math.round(zei * 1e4) / 1e4)} mm</text><rect x="10" y="54" width="${(zei * k).toFixed(1)}" height="9" class="zbz"/></svg>`;
  }
  function renderMas() {
    const sc = S.mas.sc; let h = `<div class="card pl"><h4>Maßstab M (Zeichnung : Natur)</h4><div class="ctl">${chipRow(SCS.map(s => [s, 'M ' + s]), sc, 'ms')}</div>
      <div class="dsrow"><label class="f"><span>Naturmaß (mm)</span><input id="mNat" inputmode="decimal" autocomplete="off" value="${esc(S.mas.nat)}"></label><label class="f"><span>Zeichnungsmaß (mm)</span><input id="mZei" inputmode="decimal" autocomplete="off" value="${esc(S.mas.zei)}"></label></div>
      <div class="inst zc1" id="mBars" style="padding:8px">${barsSvg()}</div><div class="rdout" id="mTxt"></div></div>
      <div class="card pl"><h4>Merke</h4><ul class="zlist"><li><b>M 1:2</b> ist eine Verkleinerung: Die Zeichnung ist halb so groß wie das Bauteil.</li><li><b>M 2:1</b> ist eine Vergrößerung: Die Zeichnung ist doppelt so groß.</li><li><b>M 1:1</b>: Natürliche Größe.</li><li>Zeichnungsmaß = Naturmaß × Zeichnungs-Zahl ÷ Natur-Zahl</li><li>Naturmaß = Zeichnungsmaß × Natur-Zahl ÷ Zeichnungs-Zahl</li><li>Bevorzugte Maßstäbe: Verkleinerung 1:2, 1:5, 1:10 …; Vergrößerung 2:1, 5:1, 10:1 …</li><li>In die Maßlinie schreibt man immer das <b>Naturmaß</b>.</li></ul>
      <div class="btns"><button class="btn pri" data-go="Maßstab">Maßstab üben</button></div></div>`;
    $('#masView').innerHTML = h; masText();
  }
  function masText() {
    const sc = masNums(), nat = C.parseDe(S.mas.nat), zei = C.parseDe(S.mas.zei), t = $('#mTxt'); if (!t) return;
    t.innerHTML = isFinite(nat) && isFinite(zei) ? `M ${sc.a}:${sc.b} → Zeichnung = ${C.fmtDe(nat)} mm × ${sc.a}/${sc.b} = <b>${C.fmtDe(Math.round(nat * sc.a / sc.b * 1e4) / 1e4)} mm</b>. ${sc.a > sc.b ? 'Vergrößerung.' : sc.a < sc.b ? 'Verkleinerung.' : 'Natürliche Größe.'}` : 'Gib ein Maß ein.';
  }
  function masSync(from) {
    const sc = masNums(); if (from === 'nat') { const v = C.parseDe(S.mas.nat); if (isFinite(v)) { S.mas.zei = C.fmtDe(Math.round(v * sc.a / sc.b * 1e4) / 1e4); const i = $('#mZei'); if (i) i.value = S.mas.zei; } }
    else { const v = C.parseDe(S.mas.zei); if (isFinite(v)) { S.mas.nat = C.fmtDe(Math.round(v * sc.b / sc.a * 1e4) / 1e4); const i = $('#mNat'); if (i) i.value = S.mas.nat; } }
    lsSet('mas', S.mas); const bx = $('#mBars'); if (bx) bx.innerHTML = barsSvg(); masText();
  }
  $('#masView').addEventListener('input', e => { if (e.target.id === 'mNat') { S.mas.nat = e.target.value; masSync('nat'); } else if (e.target.id === 'mZei') { S.mas.zei = e.target.value; masSync('zei'); } });
  $('#masView').addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) { S.tr.cat = g.dataset.go; setTab('rt'); newTrainer(); return; }
    const b = e.target.closest('[data-ms]'); if (b) { S.mas.sc = b.dataset.ms; lsSet('mas', S.mas); masSync('nat'); $$('[data-ms]', $('#masView')).forEach(x => x.classList.toggle('on', x === b)); }
  });

  /* ============================================================ Aufgaben-Inhalt (gemeinsam für Aufgaben und Trainer) */
  const emptyG = inst => C.emptyGrid(inst.W, inst.H);
  function optHtml(c, i, cls, dis) {
    const fg = c.f ? F(c.f, { w: c.f.k === 'line' ? 150 : Math.max(120, Math.min(availW() / 2 - 40, 220)), smax: 36 }) : '';
    return `<button data-qc="${i}" ${dis ? 'disabled' : ''} class="${cls}"><span class="zl">${LET[i]}</span>${fg ? `<span class="zfg">${fg}</span>` : ''}${c.t ? `<span>${esc(c.t)}</span>` : ''}</button>`;
  }
  function qHtml(inst, a, r) {
    let h = '';
    if (inst.prompt) h += `<p style="margin:8px 0">${esc(inst.prompt)}</p>`;
    if (inst.figs.length) h += `<div class="zrow">${inst.figs.map(f => inst1(f)).join('')}</div>`;
    if (inst.type === 'choice') {
      const grid = inst.choices.some(c => c.f && c.f.k !== 'line');
      h += `<div class="${grid ? 'zopts' : 'opts'}" id="qOpts">${inst.choices.map((c, i) => optHtml(c, i, r && r.ok && i === inst.correct ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : '', r && r.ok)).join('')}</div>`;
    } else if (inst.type === 'num') {
      h += `<label class="f"><span>${esc(inst.label)} (mm)</span><div class="qin"><input id="qIn" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${r && r.ok ? 'disabled' : ''}><span class="u">mm</span></div></label>`;
    } else {
      const g = a.g || emptyG(inst);
      h += `<p class="hint2" style="margin:6px 0 2px"><b>Gesucht: ${esc(C.VN[inst.target])}.</b> Tippe auf eine Kante: leer, Volllinie, Strichlinie.</p><div class="inst zc1" id="qRas">${C.svg.raster(inst.W, inst.H, g, { w: Math.min(availW(), 340) })}</div>${LEGEND}<div class="btns" style="margin-top:4px"><button class="btn" data-ta="clr"${r && r.ok ? ' disabled' : ''}>Raster leeren</button></div>`;
    }
    return h;
  }
  function inst1(f) { return inst(F(f, { w: f.k === 'views' ? Math.min(availW(), 360) : f.k === 'iso' ? Math.min(availW(), 300) : Math.min(availW(), 230), smax: 40 })); }
  function evalInst(inst, a) {
    if (inst.type === 'choice') { if (a.c == null) return { err: 'Wähle zuerst eine Antwort.' }; const ok = a.c === inst.correct; return { ok, lines: [{ ok, text: ok ? 'Richtig: Antwort ' + LET[a.c] : 'Antwort ' + LET[a.c] + ' stimmt nicht.' }] }; }
    if (inst.type === 'num') { const v = C.parseDe(a.v); if (!isFinite(v)) return { err: 'Bitte gib eine Zahl ein (mit Komma oder Punkt).' }; const ok = Math.abs(v - inst.value) <= inst.tol + 1e-9; return { ok, lines: [{ ok, text: ok ? 'Richtig: ' + C.fmtDe(v) + ' mm' : 'Deine Antwort „' + C.fmtDe(v) + ' mm“ stimmt nicht.' }] }; }
    const g = a.g || emptyG(inst); if (!g.h.some(r => r.some(x => x)) && !g.v.some(r => r.some(x => x))) return { err: 'Trage zuerst Kanten ein.' };
    const r = C.checkGrid(g, inst.solution); return { ok: r.ok, lines: r.ok ? [{ ok: true, text: 'Alle Kanten stimmen, Linienarten auch.' }] : r.msgs.map(t => ({ ok: false, text: t })) };
  }
  function solHtml(inst) {
    if (inst.type !== 'edges') return `<b>${esc(inst.sol)}</b>`;
    return esc(inst.sol) + '<div class="inst zc1" style="margin-top:6px">' + C.svg.view(inst.model, inst.target, { w: 240, name: false }) + '</div>';
  }
  function rasterTap(inst, a, seg, host) {
    const p = seg.split('-'); a.g = a.g || emptyG(inst); const arr = p[0] === 'h' ? a.g.h : a.g.v, i = +p[1], j = +p[2]; arr[i][j] = (arr[i][j] + 1) % 3;
    $('#qRas', host).innerHTML = C.svg.raster(inst.W, inst.H, a.g, { w: Math.min(availW(), 340) });
  }

  /* ============================================================ Aufgaben */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  function pctFor(id) { if (!exam()) return 100; const st = lsGet('ctipps', {})[id] || 0; return st >= 3 ? 0 : 100 - 25 * st; }   /* Stufe 3 verrät die Lösung: 0 % */
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    if (pct > 0) { const d = done(); d[id] = true; lsSet('done', d); }
    updateBadge(); updatePal();
  }
  const nDone = () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length;
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = nDone() + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, ev = evalInst(S.tInst, a); if (ev.err) { toast(ev.err); return; }
    const pct = ev.ok ? pctFor(t.id) : 0, ex = exam();
    S.tRes = { id: t.id, ok: ev.ok, pct, lines: ev.lines };
    if (ev.ok) { markSolved(t.id, pct); if (pct === 0) toast('Mit angezeigter Lösung zählt die Aufgabe im Prüfmodus nicht.'); else { const f = fx(); if (f && f.pass) try { f.pass(pct); } catch (e) {} else ding(); toast(ex && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } } else { sad(); toast('Noch nicht richtig. Lies die Hinweise und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintTask(t) {
    const h = lsGet('hints', {}), n = Math.min(3, (h[t.id] || 0) + 1), ex = exam();
    h[t.id] = Math.max(h[t.id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[t.id] = Math.max(c[t.id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 3', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(t.tips[0])}</p>`;
      if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(t.tips[1])}</p>`;
      if (n >= 3) x += `<p><b>Stufe 3:</b> Die Lösung: ${solHtml(S.tInst)}</p>`;
      else x += '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“ für die nächste Stufe.</p>';
      x += ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte. Mit Stufe 3 zählt die Aufgabe nicht mehr.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(); let h = '';
    if (t && S.tInst) {
      const r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${qHtml(S.tInst, a, r)}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="vari">🔀 Neue Variante</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) {
        h += `<ul class="tl">${r.lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}</li>`).join('')}</ul>`;
        if (r.ok) h += `<div class="rdout ok"><b>Lösung:</b> ${solHtml(S.tInst)}<br>${esc(S.tInst.expl || t.expl)}</div><div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`;
        else if (!exam()) h += `<div class="rdout bad">Tipp: ${esc(S.tInst.type === 'edges' ? 'Vergleiche deine Linien mit dem gezeigten Körper. Nutze die Tipps, wenn du nicht weiterkommst.' : 'Lies die Aufgabe noch einmal und nutze die Tipps.')}</div>`;
        else h += '<div class="rdout bad">🎓 Prüfmodus: Die Erklärung gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>';
      }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${nDone()} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : p > 0 ? 'p' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && !d[x.id] ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  $('#taskView').addEventListener('input', e => { const t = curTask(); if (t && e.target.id === 'qIn') (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  $('#taskView').addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.id === 'qIn') { e.preventDefault(); checkTask(t); } });
  $('#taskView').addEventListener('click', e => {
    const t = curTask(), qc = e.target.closest('[data-qc]'), ta = e.target.closest('[data-ta]'), sg = e.target.closest('[data-s]'), row = e.target.closest('.row[data-t]');
    if (qc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +qc.dataset.qc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (sg && t && S.tInst.type === 'edges' && !(S.tRes && S.tRes.ok)) { rasterTap(S.tInst, S.tAns[t.id] = S.tAns[t.id] || {}, sg.dataset.s, $('#taskView')); if (S.tRes && !S.tRes.ok) { S.tRes = null; renderTasks(false); } return; }
    if (ta && t) {
      const a = ta.dataset.ta;
      if (a === 'chk') checkTask(t); else if (a === 'hint') hintTask(t);
      else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); }
      else if (a === 'clr') { S.tAns[t.id] = {}; S.tRes = null; renderTasks(false); }
      else if (a === 'vari') { const v = lsGet('vari', {}); v[t.id] = (v[t.id] || 1) + 1; lsSet('vari', v); S.tInst = C.build(t, v[t.id]); S.tAns[t.id] = {}; S.tRes = null; renderTasks(false); }
      else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); }
      return;
    }
    if (row) startTask(row.dataset.t);
  });
  function startTask(id) {
    const t = TASKS.find(x => x.id === id); if (!t) return;
    S.task = id; S.tAns = {}; S.tRes = null; S.tInst = C.build(t, lsGet('vari', {})[id] || 1);
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }

  /* ============================================================ Zufalls-Trainer */
  function newTrainer() {
    const T = S.tr, pool = TASKS.filter(t => T.cat === 'Alle' || t.cat === T.cat), spec0 = pool[Math.floor(R0() * pool.length)], spec = Object.assign({}, spec0);
    if (spec0.trainPool) spec.pool = spec0.trainPool;
    T.spec = spec0; T.inst = C.build(spec, 1 + Math.floor(R0() * 1e6)); T.ans = {}; T.res = null; T.counted = false; renderTrainer();
  }
  function renderTrainer() {
    const T = S.tr; if (!T.inst) { newTrainer(); return; }
    const cats = ['Alle'].concat(D.cats), r = T.res;
    let h = `<div class="ctl">${cats.map(c => `<button class="chip s${T.cat === c ? ' on' : ''}" data-tcat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="stats"><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div><div class="bx"><b>${S.rt.ok}/${S.rt.n}</b>richtig</div></div>
      <div class="card pl"><h4>Trainer · ${esc(T.spec.cat)}</h4><div class="big">${esc(T.spec.title)}</div><div class="lv">${dots(T.spec.level)}</div>${qHtml(T.inst, T.ans, r)}
      <div class="btns"><button class="btn pri" data-ra="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="sol">Lösung zeigen</button><button class="btn" data-ra="next">➜ Weiter</button></div>`;
    if (r) { h += `<ul class="tl">${r.lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}</li>`).join('')}</ul>`; if (r.ok || r.shown) h += `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${solHtml(T.inst)}<br>${esc(T.inst.expl || T.spec.expl)}</div>`; }
    $('#rtView').innerHTML = h + '</div>';
  }
  $('#rtView').addEventListener('input', e => { if (e.target.id === 'qIn') S.tr.ans.v = e.target.value; });
  $('#rtView').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'qIn') { e.preventDefault(); trainerCheck(); } });
  function trainerCheck() {
    const T = S.tr, ev = evalInst(T.inst, T.ans); if (ev.err) { toast(ev.err); return; }
    T.res = { ok: ev.ok, lines: ev.lines };
    if (!T.counted) { T.counted = true; S.rt.n++; if (ev.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); } else S.rt.streak = 0; lsSet('rt', S.rt); updatePal(); }
    if (ev.ok) { const f = fx(); if (f && f.pass) try { f.pass(100); } catch (e) {} else ding(); } else sad();
    renderTrainer();
  }
  $('#rtView').addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tcat]'), ra = e.target.closest('[data-ra]'), qc = e.target.closest('[data-qc]'), sg = e.target.closest('[data-s]');
    if (tc) { T.cat = tc.dataset.tcat; newTrainer(); return; }
    if (qc && !(T.res && T.res.ok)) { T.ans.c = +qc.dataset.qc; if (T.res && !T.res.ok) T.res = null; renderTrainer(); return; }
    if (sg && T.inst.type === 'edges' && !(T.res && T.res.ok)) { rasterTap(T.inst, T.ans, sg.dataset.s, $('#rtView')); if (T.res && !T.res.ok) { T.res = null; renderTrainer(); } return; }
    if (!ra) return; const a = ra.dataset.ra;
    if (a === 'chk') trainerCheck();
    else if (a === 'next') newTrainer();
    else if (a === 'sol') { if (!T.counted) { T.counted = true; S.rt.n++; S.rt.streak = 0; lsSet('rt', S.rt); updatePal(); } T.res = { ok: false, shown: true, lines: [{ ok: false, text: 'Lösung angezeigt: zählt nicht als richtig.' }] }; renderTrainer(); }
  });
  $('#rtView').addEventListener('click', e => { const c = e.target.closest('[data-ta="clr"]'); if (c) { S.tr.ans = {}; S.tr.res = null; renderTrainer(); } });

  /* ============================================================ Beispiele */
  function renderBsp() {
    const b = S.bsp, ex = D.examples.find(x => x.id === b.id), m = C.modelByName(ex.model), W = availW();
    let h = `<div class="ctl">${chipRow(D.examples.map(e => [e.id, e.title]), b.id, 'be')}</div><div class="card pl"><h4>Beispiel</h4><div class="big">${esc(ex.title)}</div><p class="hint2" style="margin:0">${esc(D.models[ex.model].note || '')}. Alle Ansichten sind vom Programm berechnet und stimmen mit dem Körper überein.</p></div>`;
    h += `<div class="fbar"><div class="seg"><button data-br="-1">⟲ drehen</button><button data-br="1">drehen ⟳</button></div>${ex.section ? '' : toggle('hid', 'Verdeckte Kanten', b.hid) + toggle('ctr', 'Mittellinien', b.ctr) + (ex.dim ? toggle('dim', 'Maße', b.dim) : '')}</div>`;
    h += `<div class="card pl"><h4>Isometrie · Blick ${BLICK[((b.r % 4) + 4) % 4]}</h4>${inst(F({ k: 'iso', m, r: b.r }, { w: Math.min(W, 420), smax: 46 }))}</div>`;
    if (ex.section) h += `<div class="card pl"><h4>Ansichten und Schnitt A–A</h4>${inst(F({ k: 'views', m, hid: true, center: true }, { w: Math.min(W, 520), smax: 44 }))}<div class="zrow">${inst(F({ k: 'topcut', m, cy: ex.cy }, { w: Math.min(W, 300), smax: 44 }))}${inst(F({ k: 'section', m, cy: ex.cy }, { w: Math.min(W, 300), smax: 44 }))}</div>${LEGEND}</div>`;
    else h += `<div class="card pl"><h4>Drei Ansichten (Projektionsmethode 1)</h4>${inst(F({ k: 'views', m, hid: b.hid, center: b.ctr, dim: !!(ex.dim && b.dim) }, { w: Math.min(W, 520), smax: 52 }))}${LEGEND}</div>`;
    h += `<div class="card pl"><h4>Das siehst du</h4><ul class="zlist">${ex.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
    $('#bspView').innerHTML = h;
  }
  $('#bspView').addEventListener('click', e => {
    const bt = e.target.closest('button'); if (!bt) return; const b = S.bsp, d = bt.dataset;
    if (d.be) b.id = d.be; else if (d.br) b.r += +d.br; else if (d.tg) b[d.tg] = !b[d.tg]; else return;
    lsSet('bsp', b); renderBsp();
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const w = C.modelByName('winkel'), ws = C.modelByName('wellenabsatz');
    $('#helpView').innerHTML = `
    <details open><summary>🧊 Projektionsmethode 1 (Europa)</summary><div class="hb2">
      <p>Du stellst dir den Körper vor und schaust aus drei Richtungen auf ihn. Das Ergebnis zeichnest du so auf das Blatt:</p>
      <div class="inst zc1">${F({ k: 'views', m: w }, { w: 460, smax: 46 })}</div>
      <p><b>Vorderansicht</b> in der Mitte (Blick von vorn, zeigt die wichtigste Form). <b>Draufsicht</b> UNTER der Vorderansicht (Blick von oben). <b>Seitenansicht von links</b> RECHTS neben der Vorderansicht.</p>
      <p>Merke: Die Ansicht liegt immer auf der gegenüberliegenden Seite des Blickpunkts. Alle Ansichten stehen genau untereinander bzw. nebeneinander: Breiten sind in Vorderansicht und Draufsicht gleich, Höhen in Vorderansicht und Seitenansicht.</p>
      <p>In Draufsicht und Seitenansicht liegt die <b>Rückseite des Körpers nach innen</b> (zur Vorderansicht hin), die Vorderseite nach außen: in der Draufsicht ist die Vorderseite unten.</p></div></details>
    <details><summary>✏️ Sichtbare und verdeckte Kanten</summary><div class="hb2">
      <p>Was man in der Blickrichtung sieht, zeichnet man mit der breiten <b>Volllinie</b>. Kanten, die hinter Material liegen, zeichnet man als <b>Strichlinie</b> (verdeckte Kante). Wo zwei Flächen in einer Ebene liegen, entsteht keine Linie.</p>
      ${LEGEND}<p>Bohrungen bekommen eine <b>Mittellinie</b> (Strich-Punkt-Linie schmal). In der Ansicht, in der man den Kreis sieht, zeichnet man ein Kreuz.</p></div></details>
    <details><summary>📏 Linienarten (DIN EN ISO 128-20, Kurzform)</summary><div class="hb2"><table><tr><th>Linie</th><th>Name</th><th>Verwendung</th></tr>${D.lines.map(l => `<tr><td>${F({ k: 'line', id: l.id }, { w: 110 })}</td><td>${esc(l.name)}<br><small>${esc(l.nr)}</small></td><td>${esc(l.use)}</td></tr>`).join('')}</table>
      <p>Breite Linien sind doppelt so breit wie schmale. Welche Strichlinie (breit oder schmal) für verdeckte Kanten gilt, legt der Betrieb fest: innerhalb einer Zeichnung einheitlich.</p></div></details>
    <details><summary>📐 Bemaßungsregeln</summary><div class="hb2">
      <div class="inst zc1">${anatomySvg()}</div>
      <ul class="zlist"><li>Maßlinien und Maßhilfslinien sind Volllinien schmal. Körperkanten und Mittellinien sind keine Maßlinien.</li><li>Maßhilfslinien stehen rechtwinklig zur Strecke und ragen etwas über die Maßlinie hinaus.</li><li>Die erste Maßlinie steht außerhalb der Ansicht mit etwa 10 mm Abstand, weitere mit etwa 7 mm.</li><li>Maßzahlen stehen über der Maßlinie und sind von unten oder von rechts lesbar.</li><li>⌀ steht vor Durchmessern, R vor Radien. Ohne Einheitenzeichen gilt Millimeter.</li><li>Jedes Maß nur einmal, bevorzugt an sichtbaren Kanten. Geschlossene Maßketten vermeiden.</li><li>Die Maßzahl ist immer das Naturmaß, auch bei Vergrößerung oder Verkleinerung.</li></ul></div></details>
    <details><summary>🔎 Maßstäbe</summary><div class="hb2"><table><tr><th>Maßstab</th><th>Art</th><th>Bedeutung</th></tr><tr><td>1:1</td><td>Originalgröße</td><td>Zeichnung = Natur</td></tr><tr><td>1:2, 1:5, 1:10</td><td>Verkleinerung</td><td>Zeichnung ist 2-, 5-, 10-mal kleiner</td></tr><tr><td>2:1, 5:1, 10:1</td><td>Vergrößerung</td><td>Zeichnung ist 2-, 5-, 10-mal größer</td></tr></table>
      <span class="eq">Maßstab M = Zeichnungsmaß : Naturmaß</span><span class="eq">Zeichnungsmaß = Naturmaß × (Zeichnungs-Zahl ÷ Natur-Zahl)</span>
      <p>Beispiel M 1:2, Naturmaß 50 mm: 50 mm ÷ 2 = 25 mm gezeichnet. Beispiel M 5:1, Zeichnung 45 mm: 45 mm ÷ 5 = 9 mm in Wirklichkeit.</p></div></details>
    <details><summary>✂️ Schnitt (Vollschnitt)</summary><div class="hb2">
      <p>Im Schnitt denkst du dir den Körper durchgesägt und den vorderen Teil weggenommen. Die Schnittebene markierst du in einer Ansicht mit der <b>Strich-Punkt-Linie</b> (an den Enden breit) und zwei Buchstaben (A–A). Die <b>Pfeile</b> zeigen die Blickrichtung.</p>
      <div class="zrow">${inst(F({ k: 'topcut', m: ws, cy: 1 }, { w: 300, smax: 44 }))}${inst(F({ k: 'section', m: ws, cy: 1 }, { w: 300, smax: 44 }))}</div>
      <ul class="zlist"><li>Nur die Schnittfläche (dort wo wirklich Material getroffen wird) wird mit 45°-Linien schraffiert.</li><li>Die Schraffur besteht aus Volllinien schmal, gleichen Abständen und gleicher Richtung auf einem Teil.</li><li>Im Schnitt zeichnet man keine verdeckten Kanten.</li></ul></div></details>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'werk'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'werk') renderWerk(); else if (t === 'lin') renderLin(); else if (t === 'mas') renderMas(); else if (t === 'tasks') renderTasks(); else if (t === 'rt') renderTrainer(); else if (t === 'bsp') renderBsp(); else if (t === 'help') renderHelp();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Zeichnungs-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Zeichnungs-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); updatePal(); $('#bExam').classList.toggle('on', on); $('#bExam').setAttribute('aria-pressed', on); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const f = !!fx(), fxOn = f && !fx().isMuted(), n = nDone(), sig = [f, fxOn, exam(), n, S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${f ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Aufgabe im Trainer">🎲 Zufallsaufgabe</button>
      <span id="stat">Aufgaben gelöst <b>${n}/${TASKS.length}</b> · Serie <b>${S.rt.streak}</b> · Beste Serie <b>${S.rt.best}</b></span>`;
    $('#bExam').classList.toggle('on', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const f = fx(); if (f) { f.setMuted(!f.isMuted()); palSig = ''; updatePal(); if (!f.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { S.tr.cat = 'Alle'; setTab('rt'); newTrainer(); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('werk');
  $('#bMenu').onclick = () => {
    const rows = [['werk', 'Werkstatt', 'Körper drehen, Ansichten und Schnitt ansehen'], ['bsp', 'Beispiele', 'Fertige Zeichnungen zum Ansehen'], ['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe und Spickzettel', 'Projektion, Linien, Bemaßung, Maßstab, Schnitt'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => {
        const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m;
        if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m);
      });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt', 'vari'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.ZEI_LAB = { id: 'zei', title: 'Zeichnungs-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.ZEI_TASKS };

  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (S.tab === 'werk') renderWerk(); else if (S.tab === 'bsp') renderBsp(); else if (S.tab === 'tasks' && curTask()) renderTasks(false); else if (S.tab === 'rt') renderTrainer(); }, 150); });
  buildTabs(); updatePal(); setTab(S.tab);
  /* Aufruf ?aufgabe=zei1 (Startseite, Lernhefte): Aufgabe gleich öffnen; ?bsp (oder ?bsp=winkel): Beispiele öffnen */
  try {
    const q = new URLSearchParams(location.search), qa = q.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (q.has('bsp')) { const id = q.get('bsp'); if (id && D.examples.some(e => e.id === id)) { S.bsp.id = id; lsSet('bsp', S.bsp); } setTab('bsp'); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
