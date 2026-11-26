'use strict';
/* Tonfunk Simulations- und EDA-Lab: Oberfläche (Lab-Kennung 'eda').
   ALLE Zahlen (Spannungen, Ströme, Bauteilwerte, Mindestmaße des Herstellers) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   Reiter: Simulation (4 Analysearten mit Reglern), ERC (Schaltplan prüfen), Gerber (Lagen, Stapel, Quiz, DFM), Aufgaben, Trainer, Hilfe.
   Module: edacore.js (EDA_CORE), edadata.js (EDA_DATA, EDA_TASKS), edaviz.js (EDA_VIZ, Zeichnungen).
   Speicher (Präfix lm4.eda.): tab, sim, erc, ger, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: edalab.html?aufgabe=eda1 öffnet die Aufgabe. */
(function (root) {
  const C = root.EDA_CORE, D = root.EDA_DATA, V = root.EDA_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.eda.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s), B = t => '<b>' + esc(t) + '</b>';
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Simulations- und EDA-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">edacore.js, edadata.js oder edaviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();
  const UEB = 'Alle Zahlen in diesem Lab (Spannungen, Ströme, Bauteilwerte, Mindestmaße des Herstellers) sind Übungswerte für die Ausbildung, nicht für die Praxis. Maßgebend sind immer Datenblatt, Herstellerregeln und die Vorgaben deines Betriebs.';

  /* ============================================================ Zustand */
  const TABS = [['sim', '📈', 'Simulation'], ['erc', '🔌', 'ERC'], ['ger', '📐', 'Gerber'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  /* Regler laufen über Listen mit Normwerten (Index im Speicher); so stehen nur sinnvolle Werte zur Wahl */
  const LI = { ub: [3.3, 5, 9, 12], rv: [100, 150, 220, 330, 470, 680, 1000], ue: [6, 9, 12, 15, 18], c: [100, 220, 330, 470, 680, 1000, 2200, 3300, 4700], il: [50, 100, 200, 300, 500], r: [1000, 2200, 4700, 10000, 22000], cn: [10, 22, 47, 100, 220], fq: [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000], lim: [0.5, 1, 2, 3], tr: [0.1, 0.15, 0.2, 0.25, 0.3], dr: [0.2, 0.3, 0.4, 0.6, 0.8, 1.0], pd: [0.6, 0.8, 1.0, 1.2, 1.6, 2.0, 2.4] };
  const SWC = [100, 220, 330, 470, 1000, 2200, 3300, 4700];
  const fU = v => f(v, v % 1 ? 1 : 0) + ' V', fI = v => f(v, 0) + ' mA', fMm = v => f(v, 2) + ' mm';
  const SIMMODES = ['ap', 'zeit', 'fr', 'sw'];
  const DEFSIM = { mode: 'ap', ap: { ub: 1, rv: 3 }, zeit: { ue: 2, c: 5, il: 2 }, fr: { r: 2, cn: 3, fq: 4 }, sw: { il: 2, ue: 2, lim: 1 } };
  /* gespeicherte Regler-Indizes prüfen: ganze Zahlen im Bereich der Liste, sonst Standardwert */
  function cleanSim(saved) {
    const o = JSON.parse(JSON.stringify(DEFSIM)); if (!saved || typeof saved !== 'object') return o;
    if (SIMMODES.includes(saved.mode)) o.mode = saved.mode;
    SIMMODES.forEach(g => Object.keys(o[g]).forEach(k => { const v = saved[g] && saved[g][k]; if (Number.isInteger(v) && v >= 0 && v < LI[k].length) o[g][k] = v; }));
    return o;
  }
  const S = {
    tab: lsGet('tab', 'sim'),
    sim: cleanSim(lsGet('sim', null)),
    erc: { seed: String(lsGet('erc', '1')), sel: null, ok: {}, fb: null },
    ger: { mode: 'top', on: { cuTop: 1, silk: 1, edge: 1 }, sel: {}, last: null, dfm: { tr: 2, gp: 2, dr: 2, pd: 3 }, quiz: null },
    task: null, tq: null, tAns: {}, tRes: null, tFehl: {},
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  const svSim = () => lsSet('sim', S.sim);

  /* ============================================================ Reiter Simulation */
  /* je Analyseart: Name, Regler [Schlüssel, Beschriftung, Liste, Format], Zeichnung und Ablesetext */
  const SIMS = {
    ap: { name: 'Arbeitspunkt', frage: 'Welche Spannung und welcher Strom stellen sich an einer LED mit Vorwiderstand ein? Das Programm sucht den Schnittpunkt von Kennlinie und Widerstandsgerade.',
      sl: [['ub', 'Betriebsspannung', 'ub', fU], ['rv', 'Vorwiderstand', 'rv', C.fmtOhm]],
      draw: s => {
        const ub = LI.ub[s.ub], r = LI.rv[s.rv], op = C.operatingPoint(ub, r), ur = ub - op.u;
        return { svg: V.apPlot(ub, r), out: `<span class="st">Ablesen im Arbeitspunkt</span>LED-Spannung ${B(f(op.u, 2) + ' V')}, Strom ${B(f(op.i * 1000, 1) + ' mA')}. Am Widerstand fallen ${B(f(ur, 2) + ' V')} ab, dort werden ${B(f(ur * op.i * 1000, 0) + ' mW')} in Wärme umgesetzt.` };
      } },
    zeit: { name: 'Zeitverlauf', frage: 'Wie verläuft die Spannung am Ladeelko eines Netzteils (Brücke, 50 Hz Netz)? Das Programm rechnet Schritt für Schritt über die Zeit.',
      sl: [['ue', 'Wechselspannung (Effektivwert)', 'ue', fU], ['c', 'Ladeelko', 'c', v => f(v, 0) + ' µF'], ['il', 'Laststrom', 'il', fI]],
      draw: s => {
        const ue = LI.ue[s.ue], c = LI.c[s.c] * 1e-6, i = LI.il[s.il] / 1000, m = C.rectSim({ ueff: ue, c, i }), fo = C.ripple(i, c, 100);
        return { svg: V.zeitPlot(ue, c, i), out: `<span class="st">Messfenster: die letzten 20 ms</span>Brummspannung aus der Simulation ${B(f(m.vpp, 2) + ' V')}, Mittelwert ${B(f(m.vmean, 1) + ' V')}. Die Näherungsformel ΔU = I / (f · C) mit f = 100 Hz gibt ${B(f(fo, 2) + ' V')}: Sie ist etwas pessimistisch, weil der Elko vor dem Scheitel schon nachgeladen wird.` };
      } },
    fr: { name: 'Frequenzgang', frage: 'Ab welcher Frequenz dämpft ein RC-Tiefpass? Das Programm rechnet bei vielen Frequenzen und zeigt die Dämpfung, darunter ein Sinuspaar bei der gewählten Frequenz.',
      sl: [['r', 'Widerstand R', 'r', C.fmtOhm], ['cn', 'Kondensator C', 'cn', v => f(v, 0) + ' nF'], ['fq', 'Testfrequenz', 'fq', C.fmtHz]],
      draw: s => {
        const r = LI.r[s.r], c = LI.cn[s.cn] * 1e-9, fq = LI.fq[s.fq], fg = C.fgRC(r, c), am = C.ampRC(fq, fg);
        return { svg: V.bodePlot(r, c, fq), out: `<span class="st">Grenzfrequenz fg = 1 / (2π · R · C)</span>fg = ${B(C.fmtHz(fg))}. Bei ${esc(C.fmtHz(fq))} bleiben ${B(f(am * 100, 0) + ' %')} der Amplitude, die Dämpfung beträgt ${B(f(C.attenDb(fq, fg), 1) + ' dB')} und der Ausgang läuft ${B(f(C.phaseRC(fq, fg), 0) + '°')} hinterher.` };
      } },
    sw: { name: 'Sweep', frage: 'Welcher Ladeelko reicht? Das Programm ändert die Kapazität in Stufen und rechnet jedes Mal den Zeitverlauf. Du siehst alle Ergebnisse nebeneinander.',
      sl: [['ue', 'Wechselspannung (Effektivwert)', 'ue', fU], ['il', 'Laststrom', 'il', fI], ['lim', 'Zulässige Brummspannung', 'lim', v => f(v, 1) + ' V']],
      draw: s => {
        const ue = LI.ue[s.ue], i = LI.il[s.il] / 1000, lim = LI.lim[s.lim], form = SWC.map(c => C.ripple(i, c * 1e-6, 100)), sim = SWC.map(c => C.rectSim({ ueff: ue, c: c * 1e-6, i }).vpp);
        const need = C.cForRipple(i, 100, lim) * 1e6, ok = SWC.find((c, k) => sim[k] <= lim);
        return { svg: V.sweepPlot(SWC, form, sim, lim), out: `<span class="st">${SWC.length} Läufe</span>Die Formel verlangt mindestens ${B(f(need, 0) + ' µF')}. In der Simulation reicht ${ok ? 'als erster Wert der Reihe ' + B(f(ok, 0) + ' µF') : B('keiner dieser Werte')}.` };
      } }
  };
  const sliders = (spec, st) => spec.map(([k, label, ln, fm]) => `<label class="f"><span>${esc(label)}: <b data-v="${k}">${esc(fm(LI[ln][st[k]]))}</b></span><input type="range" min="0" max="${LI[ln].length - 1}" step="1" value="${st[k]}" data-sl="${k}" aria-label="${esc(label)}"></label>`).join('');
  const seg = (list, cur, attr) => `<div class="seg">${list.map(([k, n]) => `<button ${attr}="${k}" class="${cur === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>`;
  function simDraw() { const m = SIMS[S.sim.mode], r = m.draw(S.sim[S.sim.mode]); $('#simStage').innerHTML = r.svg; $('#simOut').innerHTML = r.out; }
  function renderSim() {
    const m = SIMS[S.sim.mode];
    $('#simView').innerHTML = `<div class="fbar">${seg(SIMMODES.map(k => [k, SIMS[k].name]), S.sim.mode, 'data-sm')}</div><p class="hint2" style="margin:0 0 4px">${esc(m.frage)}</p><div class="inst" id="simStage"></div><div class="rdout" id="simOut"></div><div class="card pl"><h4>Regler</h4>${sliders(m.sl, S.sim[S.sim.mode])}</div>`;
    simDraw();
  }
  $('#simView').addEventListener('click', e => { const b = e.target.closest('[data-sm]'); if (b) { S.sim.mode = b.dataset.sm; svSim(); renderSim(); } });
  $('#simView').addEventListener('input', e => {
    const k = e.target.dataset.sl; if (!k) return; const m = SIMS[S.sim.mode], sp = m.sl.find(x => x[0] === k);
    S.sim[S.sim.mode][k] = +e.target.value; $(`[data-v="${k}"]`).textContent = sp[3](LI[sp[2]][+e.target.value]); svSim(); simDraw();
  });

  /* ============================================================ Reiter ERC */
  const CAUSE = k => C.CAUSES.find(x => x.k === k);
  const ercCase = () => C.makeCase(S.erc.seed);
  function renderErc() {
    const cs = ercCase(), E = S.erc, msgs = cs.msgs, m = E.sel != null ? msgs[E.sel] : null, nOk = msgs.filter((_, i) => E.ok[i]).length;
    let h = `<div class="inst" id="ercStage">${V.ercPlot(cs.sch, m ? V.ercMarks(cs.sch, m) : [])}</div>`;
    h += `<div class="rdout"><span class="st">ERC-Bericht (Elektrische Regelprüfung) für Fall ${esc(E.seed)}</span>${msgs.length} Meldungen, davon ${msgs.filter(x => x.level === 'Fehler').length} Fehler. Erklärt: ${B(nOk + ' von ' + msgs.length)}. Tippe eine Meldung an: Das Programm zeigt dir die Stelle im Schaltplan.</div>`;
    h += msgs.map((x, i) => `<button class="row" data-em="${i}" style="${E.sel === i ? 'background:var(--panel2)' : ''}"><span class="dot ${E.ok[i] ? 'g' : ''}">${E.ok[i] ? '✓' : ''}</span><div class="grow"><b class="${x.level === 'Fehler' ? 'lf' : 'lw'}">${x.level}</b><small>${esc(x.text)}</small></div></button>`).join('');
    if (m) {
      const done = E.ok[E.sel];
      h += `<div class="card pl" style="margin-top:10px"><h4>Welche Ursache steckt dahinter?</h4><p style="margin:0 0 8px">${esc(m.text)}</p><label class="f"><span>Ursache</span><select data-ecs ${done ? 'disabled' : ''}><option value="">Bitte wählen</option>${C.CAUSES.map(c => `<option value="${c.k}"${E.fb && E.fb.given === c.k ? ' selected' : ''}>${esc(c.n)}</option>`).join('')}</select></label>`;
      if (E.fb) h += `<div class="lr-fb ${E.fb.ok ? 'ok' : 'tipp'} fb"><p>${E.fb.ok ? '<strong>✓ Richtig:</strong> ' + esc(CAUSE(C.causeOf(m)).n) + '. ' + esc(CAUSE(C.causeOf(m)).fix) : '<strong>Noch nicht.</strong> Schau dir die markierte Stelle noch einmal an: Wie sind die Netznamen geschrieben, was hängt am Pin?'}</p></div>`;
      h += `<div class="btns"><button class="btn pri" data-ea="chk"${done ? ' disabled' : ''}>✓ Prüfen</button></div></div>`;
    }
    h += `<div class="btns"><button class="btn" data-ea="new">🔄 Neuer Fall</button></div><p class="hint2">Eine Ursache kann mehrere Meldungen auslösen: Ein Tippfehler im Netznamen ergibt oft zwei Meldungen. Beheben musst du die Ursache, nicht jede Meldung einzeln.</p>`;
    $('#ercView').innerHTML = h;
  }
  $('#ercView').addEventListener('click', e => {
    const em = e.target.closest('[data-em]'), ea = e.target.closest('[data-ea]');
    if (em) { S.erc.sel = +em.dataset.em; S.erc.fb = null; renderErc(); return; }
    if (!ea) return;
    if (ea.dataset.ea === 'new') { S.erc = { seed: String(Math.floor(R0() * 99999) + 1), sel: null, ok: {}, fb: null }; lsSet('erc', S.erc.seed); renderErc(); return; }
    const sel = $('[data-ecs]'), v = sel && sel.value; if (!v) { toast('Wähle zuerst eine Ursache.'); return; }
    const ok = v === C.causeOf(ercCase().msgs[S.erc.sel]); S.erc.fb = { ok, given: v }; if (ok) { S.erc.ok[S.erc.sel] = true; ding(); } else sad(); renderErc();
  });

  /* ============================================================ Reiter Gerber */
  const GMODES = [['top', 'Draufsicht'], ['stack', 'Stapel'], ['quiz', 'Lage raten'], ['dfm', 'DFM']];
  const lchips = (set, keys) => `<div class="ctl">${C.LAYERS.filter(l => keys.includes(l.k)).map(l => `<button class="chip ${set[l.k] ? 'on' : ''}" data-gl="${l.k}" aria-pressed="${!!set[l.k]}"><span class="sw sw-${l.k}"></span>${esc(l.n)}</button>`).join('')}</div>`;
  const dfmPar = () => { const d = S.ger.dfm; return { track: LI.tr[d.tr], gap: LI.tr[d.gp], drill: LI.dr[d.dr], pad: LI.pd[d.pd] }; };
  function dfmOut() {
    const res = C.dfmCheck(dfmPar()), bad = res.filter(x => !x.ok);
    return `<span class="st">Mindestwerte des Herstellers (Übungswerte)</span>${res.map(x => `<span class="${x.ok ? 'pc' : 'pc m'}">${x.ok ? '✓' : '✗'} ${esc(x.n)}: ${f(x.val, 2)} mm, verlangt ab ${f(x.min, 2)} mm</span>`).join('<br>')}<br>${bad.length ? B('Der Hersteller würde die Daten zurückweisen.') : B('Alle vier Regeln sind erfüllt.')}`;
  }
  function newQuiz() { const R = C.rng(String(Math.random())); S.ger.quiz = { k: C.pick(R, C.LAYERS).k, res: null }; }
  function renderGer() {
    const G = S.ger; let h = `<div class="fbar">${seg(GMODES, G.mode, 'data-gm')}</div>`;
    if (G.mode === 'top') {
      const last = C.LAYERS.find(l => l.k === G.last);
      h += `<div class="inst" id="gerStage">${V.gerberTop(G.on)}</div>${lchips(G.on, C.LAYERS.map(l => l.k))}<div class="rdout">${last ? `<span class="st">${esc(last.n)} (Endung ${esc(last.ext)})</span>${esc(last.info)}` : 'Schalte die Lagen einzeln ein: So sieht der Hersteller jede Datei. Tippe eine Lage an, dann steht hier, was sie enthält.'}</div>`;
    } else if (G.mode === 'stack') {
      h += `<div class="inst" id="gerStage">${V.gerberStack(G.sel)}</div>${lchips(G.sel, V.STACK)}<p class="hint2">Tippe Lagen an, um sie hervorzuheben. Platinenkontur und Bohrdatei gelten für alle Lagen zugleich: Der Umriss ist an jeder Lage gezeichnet, die Bohrungen gehen durch alle hindurch.</p>`;
    } else if (G.mode === 'quiz') {
      if (!G.quiz) newQuiz();
      const qz = G.quiz, L = C.LAYERS.find(l => l.k === qz.k);
      h += `<div class="inst" id="gerStage">${V.gerberTop({ [qz.k]: 1 })}</div><div class="card pl"><h4>Welche Lage ist das?</h4><div class="opts">${C.LAYERS.map(l => `<button data-gq="${l.k}" ${qz.res ? 'disabled' : ''} class="${qz.res && l.k === qz.k ? 'ok' : qz.res && l.k === qz.res.given ? 'bad' : ''}">${esc(l.n)}</button>`).join('')}</div>${qz.res ? `<div class="lr-fb ${qz.res.ok ? 'ok' : 'tipp'} fb"><p><strong>${qz.res.ok ? '✓ Richtig:' : 'Es war:'}</strong> ${esc(L.n)} (${esc(L.ext)}). ${esc(L.info)}</p></div><div class="btns"><button class="btn pri" data-ga="next">Nächste Lage</button></div>` : '<p class="hint2">Kupfer oben ist orange, Kupfer unten blau, die Lötstoppmaske grün gezeichnet.</p>'}</div>`;
    } else {
      h += `<div class="inst" id="gerStage"></div><div class="rdout" id="gerOut"></div><div class="card pl"><h4>Maße</h4>${sliders([['tr', 'Leiterbahnbreite', 'tr', fMm], ['gp', 'Abstand zwischen Kupferflächen', 'tr', fMm], ['dr', 'Bohrdurchmesser', 'dr', fMm], ['pd', 'Pad-Durchmesser', 'pd', fMm]], G.dfm)}</div>`;
    }
    $('#gerView').innerHTML = h;
    if (G.mode === 'dfm') dfmDraw();
  }
  function dfmDraw() { $('#gerStage').innerHTML = V.dfmPlot(dfmPar()); $('#gerOut').innerHTML = dfmOut(); }
  $('#gerView').addEventListener('click', e => {
    const G = S.ger, gm = e.target.closest('[data-gm]'), gl = e.target.closest('[data-gl]'), gq = e.target.closest('[data-gq]'), ga = e.target.closest('[data-ga]');
    if (gm) { G.mode = gm.dataset.gm; renderGer(); }
    else if (gl) { const set = G.mode === 'top' ? G.on : G.sel, k = gl.dataset.gl; set[k] = set[k] ? 0 : 1; if (G.mode === 'top') G.last = k; renderGer(); }
    else if (gq && G.quiz && !G.quiz.res) { const ok = gq.dataset.gq === G.quiz.k; G.quiz.res = { ok, given: gq.dataset.gq }; if (ok) ding(); else sad(); renderGer(); }
    else if (ga) { newQuiz(); renderGer(); }
  });
  $('#gerView').addEventListener('input', e => { const k = e.target.dataset.sl; if (!k) return; S.ger.dfm[k] = +e.target.value; const sp = { tr: ['tr', fMm], gp: ['tr', fMm], dr: ['dr', fMm], pd: ['pd', fMm] }[k]; $(`[data-v="${k}"]`).textContent = sp[1](LI[sp[0]][+e.target.value]); dfmDraw(); });

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
  const stepsHTML = q => `<div class="rdout"><span class="st">So gehst du vor</span><ol class="steps">${q.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>`;
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
    const V2 = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p class="qt">${esc(q.text)}</p>${stepsHTML(q)}${qBody(q, a, r)}`;
      if (r) h += fbHTML(q, r);
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && (r.ok || r.stufe === 'loes') ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r && (r.ok || r.stufe === 'loes')) h += '<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>';
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V2.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
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
      <div class="fbar"><span class="lbl2" style="color:var(--mute)">STUFE</span>${seg([[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']], T.level, 'data-lv')}</div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p class="qt">${esc(q.text)}</p>${stepsHTML(q)}${qBody(q, T.ans, T.res)}${T.res ? fbHTML(q, T.res) : ''}
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
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`, eq = t => `<span class="eq">${t}</span>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Analysearten der Simulation', `<table><tr><th>Analyse</th><th>Frage</th><th>Ergebnis</th></tr><tr><td>Arbeitspunkt (DC)</td><td>Welche Gleichspannungen und Ströme stellen sich ein?</td><td>Zahlenwerte, Kondensator wirkt wie eine Unterbrechung, Spule wie ein Draht</td></tr><tr><td>Zeitverlauf (Transient)</td><td>Wie ändern sich Spannungen und Ströme über der Zeit?</td><td>Kurven über der Zeit</td></tr><tr><td>Frequenzgang (AC)</td><td>Wie verhält sich die Schaltung bei verschiedenen Frequenzen?</td><td>Dämpfung und Phase über der Frequenz</td></tr><tr><td>Parameter-Sweep</td><td>Was ändert sich, wenn ich einen Wert in Stufen verändere?</td><td>Ergebnisse vieler Läufe nebeneinander</td></tr></table>${eq('fg = 1 / (2 · π · R · C)')}${eq('Dämpfung in dB = 10 · log10(1 + (f / fg)²)')}${eq('Zeit für n Perioden = n / f')}${eq('Läufe beim Sweep = (Ende − Start) / Schritt + 1')}`, true) +
      sec('Ergebnisse lesen und bewerten', `${eq('LED: RV = (UB − UF) / IF und P = (UB − UF) · IF')}${eq('Transistor: IB = IC / B · k, RB = (UE − 0,7 V) / IB')}${eq('Kollektorstrom im Ein-Zustand: IC = (UB − 0,2 V) / RC')}${eq('Brücke: Scheitelwert = Ueff · √2 − 2 · 0,7 V')}${eq('Brummspannung ΔU = I / (f · C), f = 100 Hz')}<p>Prüfe jedes Ergebnis mit einer Überschlagsrechnung: Passt die Größenordnung? Ist es physikalisch möglich?</p>`) +
      sec('Modell und Wirklichkeit', `<p>Ein Simulationsmodell ist ideal, solange nichts anderes dasteht: genaue Werte, kein Innenwiderstand der Quelle, keine Temperatur, kein Leckstrom. Echte Bauteile weichen ab.</p>${eq('Höchstwert = Nennwert · (1 + Toleranz)')}${eq('Abweichung in % = |Messwert − Simulationswert| / Simulationswert · 100')}${eq('Flussspannung einer Si-Diode: rund −2 mV je Kelvin')}<p>Beim Worst-Case rechnest du mit den ungünstigsten Grenzwerten aller Bauteile gleichzeitig.</p>`) +
      sec('Schaltplan und ERC', `<table><tr><th>Pintyp</th><th>Bedeutung</th></tr>${Object.keys(C.PINTYPE).map(k => `<tr><td>${esc(C.PINTYPE[k])}</td><td>${{ out: 'treibt ein Signal', in: 'braucht einen Treiber', pwrout: 'speist ein Versorgungsnetz', pwrin: 'braucht Versorgung', pas: 'kein Treiber, kein Verbraucher festgelegt' }[k]}</td></tr>`).join('')}</table><p>Der ERC prüft den Schaltplan gegen elektrische Regeln. <b>Fehler</b> musst du beheben, bei <b>Warnungen</b> entscheidest du bewusst.</p><table><tr><th>Ursache</th><th>Abhilfe</th></tr>${C.CAUSES.map(c => `<tr><td>${esc(c.n)}</td><td>${esc(c.fix)}</td></tr>`).join('')}</table><p>Der DRC prüft dagegen das Layout (Abstände, Breiten, Bohrungen).</p>`) +
      sec('Fertigungsdaten', `<table><tr><th>Lage</th><th>Endung</th><th>Inhalt</th></tr>${C.LAYERS.map(l => `<tr><td>${esc(l.n)}</td><td>${esc(l.ext)}</td><td>${esc(l.info)}</td></tr>`).join('')}</table>${eq('Restring = (Pad − Bohrung) / 2')}${eq('Bohrdurchmesser = Drahtdurchmesser + 0,2 bis 0,3 mm')}${eq('Nutzen = Bedarf / Platinen je Nutzen, aufgerundet')}<p>Die <b>Stückliste</b> sagt, was bestückt wird (Wert, Gehäuse, Stückzahl). Die <b>Bestückungsdatei</b> sagt, wo: Referenz, Position, Drehung, Seite. Die Mindestwerte in der Gerber-Prüfung sind erfundene Übungswerte, jeder Hersteller nennt seine eigenen.</p>`) +
      sec('Ablauf vom Entwurf bis zur Freigabe', `<ol class="steps">${C.ABLAUF.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p>Jede Änderung nach der Freigabe bekommt einen neuen Revisionsstand und neue Daten.</p>`) +
      sec('Programme', `<p>Für Simulation und Leiterplattenentwurf gibt es freie und kostenpflichtige Programme. Die Begriffe in diesem Lab gelten in allen.</p>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'sim'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ sim: renderSim, erc: renderErc, ger: renderGer, tasks: renderTasks, rt: renderTrainer, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Simulations- und EDA-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Simulations- und EDA-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('sim');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe und Formeln', 'Analysearten, Ergebnisse, Modell, ERC, Fertigungsdaten, Ablauf'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.EDA_LAB = { id: 'eda', title: 'Simulations- und EDA-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.EDA_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'sim');
  /* Aufruf ?aufgabe=eda1 (Startseite, Lernhefte) öffnet die Aufgabe */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
