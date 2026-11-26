'use strict';
/* Tonfunk 3D-Modellierungs-Lab: Oberfläche (Lab-Kennung 'cad').
   ALLE Zahlen sind ÜBUNGSWERTE für die Ausbildung. Firma "Modellbetrieb" und alle Bauteile sind frei erfunden.
   Reiter: Skizze (Bedingungen und Maße ein- und ausschalten, Freiheitsgrade zählen), Zeitleiste (Gehäuse Feature für Feature, Parameter ändern, Volumen und Masse),
           Boolesch (Vereinigung, Differenz, Schnittmenge von Block und Zylinder), Aufgaben, Trainer, Hilfe.
   Module: cadcore.js (CAD_CORE), caddata.js (CAD_DATA, CAD_TASKS), cadviz.js (CAD_VIZ, vor dieser Datei geladen).
   Speicher (Präfix lm4.cad.): tab, sk (Liste der Bedingungen), ft (Parameter und Marker), bo, done ({id:true}), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus.
   Aufruf: cadlab.html?aufgabe=cad1 öffnet die Aufgabe. */
(function (root) {
  const C = root.CAD_CORE, D = root.CAD_DATA, V = root.CAD_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.cad.';
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>3D-Modellierungs-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">cadcore.js, caddata.js oder cadviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['sk', '📐', 'Skizze'], ['ft', '🧱', 'Zeitleiste'], ['bo', '⚙️', 'Boolesch'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const FT_SL = [['L', 'Länge L', 50, 100, 5], ['B', 'Breite B', 40, 70, 5], ['H', 'Höhe H', 20, 45, 5], ['t', 'Wand t', 1, 4, 0.5], ['r', 'Rundung r', 0, 10, 1], ['d', 'Bohrung Ø d', 2, 6, 1]];
  const BO_SL = [['d', 'Zylinder Ø', 8, 36, 2], ['hb', 'Blockhöhe', 10, 30, 5]];
  const FT0 = { L: 80, B: 50, H: 30, t: 2, r: 6, d: 4, step: 4 }, BO0 = { op: 'diff', d: 20, hb: 20 };
  const S = {
    tab: lsGet('tab', 'sk'), sk: lsGet('sk', null), ft: Object.assign({}, FT0, lsGet('ft', {})), bo: Object.assign({}, BO0, lsGet('bo', {})),
    task: null, tq: null, tAns: {}, tRes: null, tFehl: {},
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  /* Gespeicherte Zustände prüfen */
  if (!Array.isArray(S.sk)) S.sk = ['h', 'v'];
  S.sk = S.sk.filter(k => C.SK.some(c => c.k === k));
  FT_SL.forEach(([k, , mn, mx]) => { const v = +S.ft[k]; S.ft[k] = Number.isFinite(v) ? Math.max(mn, Math.min(mx, v)) : FT0[k]; });
  S.ft.step = Math.max(0, Math.min(C.FEATURES.length - 1, Math.round(+S.ft.step) || 0));
  BO_SL.forEach(([k, , mn, mx]) => { const v = +S.bo[k]; S.bo[k] = Number.isFinite(v) ? Math.max(mn, Math.min(mx, v)) : BO0[k]; });
  if (!V.OPN[S.bo.op]) S.bo.op = 'diff';
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span><b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const UEB = 'Alle Zahlen in diesem Lab (Maße, Dichten, Preise) sind Übungswerte. Der Modellbetrieb und seine Bauteile sind frei erfunden. Maßgebend sind immer die Zeichnung, die Vorgaben deines Betriebs und die Einstellungen im verwendeten Programm.';
  const ueb = () => `<p class="hint2" style="margin:10px 0 0">⚠ ${esc(UEB)}</p>`;
  const stepsBox = st => st && st.length ? `<div class="steps"><b>So gehst du vor</b><ol>${st.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>` : '';
  const cm3 = v => f(v / 1000, 2) + ' cm³';
  const slider = (attr, [k, n, mn, mx, st], val, unit) => `<label class="tsl2"><span>${esc(n)}</span><input type="range" ${attr}="${k}" min="${mn}" max="${mx}" step="${st}" value="${val}" aria-label="${esc(n)}"><b data-sv="${k}">${f(val, 1)} ${unit}</b></label>`;

  /* ============================================================ Skizze */
  const SK_MSG = {
    unter: 'Unterbestimmt: Die orangen Pfeile zeigen, was sich noch bewegen lässt. Schalte weitere Bedingungen oder Maße ein.',
    voll: 'Voll bestimmt: Nichts lässt sich mehr ziehen. Jetzt folgt die Skizze genau den Maßen und ist bereit zum Extrudieren.',
    over: 'Überbestimmt: Breite, Höhe und „Gleich“ legen das Quadrat dreifach fest, zwei davon reichen. Schalte eine der drei Bedingungen aus.'
  };
  function renderSk() {
    $('#skView').innerHTML = `<div class="card pl"><h4>Skizzen-Werkstatt</h4>
      <p class="hint2" style="margin:0 0 6px">Ein Rechteck mit einem Kreis darin hat zu Beginn ${C.SK_TOTAL} Freiheitsgrade: Es lässt sich noch verschieben, drehen und ziehen. Jede Bedingung und jedes Maß nimmt Freiheitsgrade weg.</p>
      ${stepsBox(['Schalte unten nacheinander Bedingungen und Maße ein.', 'Lies im Bild die Freiheitsgrade ab. Die orangen Pfeile zeigen, was noch frei ist.', 'Erreiche 0 Freiheitsgrade: Die Skizze wird grün (voll bestimmt).', 'Schalte zum Schluss „Gleich“ dazu und beobachte, was passiert.'])}
      <div class="vzbox" id="skHost"></div><div id="skOut"></div>
      <div class="opts" id="skOpts">${C.SK.map(c => `<button data-sk="${c.k}"><b>${esc(c.n)}</b> <span class="mute">(nimmt ${c.d} weg)</span></button>`).join('')}</div>
      <div class="btns"><button class="btn" data-ska="none">Alles aus</button><button class="btn" data-ska="voll">Voll bestimmt zeigen</button></div></div>${ueb()}`;
    updateSk();
  }
  function updateSk() {
    const st = C.sketchState(S.sk), rem = C.SK_TOTAL - st.dof;
    $('#skHost').innerHTML = V.sketchSvg({ on: S.sk, info: true });
    $('#skOut').innerHTML = box('Freiheitsgrade', C.SK_TOTAL + ' − ' + rem + ' = ' + st.dof, st.status === 'voll' ? 'ok' : st.status === 'over' ? 'bad' : '') + note(SK_MSG[st.status], st.status === 'voll' ? 'ok' : st.status === 'over' ? 'bad' : 'warn');
    $$('[data-sk]', $('#skView')).forEach(b => b.classList.toggle('on', S.sk.includes(b.dataset.sk)));
  }
  $('#skView').addEventListener('click', e => {
    const b = e.target.closest('[data-sk]'), a = e.target.closest('[data-ska]');
    if (b) { const k = b.dataset.sk; S.sk = S.sk.includes(k) ? S.sk.filter(x => x !== k) : S.sk.concat(k); lsSet('sk', S.sk); updateSk(); }
    else if (a) { S.sk = a.dataset.ska === 'none' ? [] : ['h', 'v', 'o', 'w', 'hh', 'm', 'dk']; lsSet('sk', S.sk); updateSk(); }
  });

  /* ============================================================ Zeitleiste (Gehäuse Feature für Feature) */
  function renderFt() {
    const F = C.FEATURES;
    $('#ftView').innerHTML = `<div class="card pl"><h4>Gehäuse Feature für Feature</h4>
      <p class="hint2" style="margin:0 0 6px">Ein Modellbetrieb-Gehäuse entsteht in fünf Schritten. Ändere einen Parameter: Alle Features rechnen sich neu. Schiebe den Marker der Zeitleiste zurück: Spätere Features sind ausgeblendet.</p>
      ${stepsBox(['Schiebe den Marker oder tippe in der Liste auf ein Feature und sieh, wie der Körper entsteht.', 'Ändere Länge, Breite oder Höhe und beobachte Volumen und Masse.', 'Setze die Wandstärke hoch und lies ab, wie viel schwerer das Gehäuse wird.', 'Ändere die Rundung: Die Innenwand folgt, weil die Schale nach der Rundung kommt.'])}
      <div class="vzbox" id="ftHost"></div><div id="ftOut"></div>
      <label class="tsl2" style="margin-top:6px"><span>Zeitleiste</span><input type="range" data-fm min="0" max="${F.length - 1}" step="1" value="${S.ft.step}" aria-label="Marker der Zeitleiste"><b id="fmv"></b></label>
      <div class="sgrid">${FT_SL.map(s => slider('data-fs', s, S.ft[s[0]], 'mm')).join('')}</div>
      <div id="ftList"></div></div>${ueb()}`;
    updateFt();
  }
  function updateFt() {
    const F = C.FEATURES, p = S.ft, st = p.step, vs = C.housing(p), v = vs[st].v, prev = st >= 2 ? vs[st - 1].v : 0;
    $('#ftHost').innerHTML = V.housingSvg(p, st);
    $('#fmv').textContent = (st + 1) + '/' + F.length;
    $('#ftOut').innerHTML = st === 0 ? box('Skizze (noch kein Körper)', 'Fläche ' + f(p.L, 0) + ' · ' + f(p.B, 0) + ' = ' + f(p.L * p.B, 0) + ' mm²') :
      box('Nach „' + F[st][1] + '“', 'Volumen ' + cm3(v) + ' · Masse (PLA ' + f(C.DICHTE.PLA, 2) + ' g/cm³) ' + f(C.massG(v, C.DICHTE.PLA), 1) + ' g') + (st >= 2 ? `<p class="hint2" style="margin:2px 0 0">Dieses Feature ändert das Volumen um ${esc(f((v - prev) / 1000, 2))} cm³.</p>` : '');
    $('#ftList').innerHTML = F.map((x, i) => `<button class="row${i > st ? ' off' : ''}${i === st ? ' cur' : ''}" data-fl="${i}"><span class="dot ${i <= st ? 'g' : ''}">${i + 1}</span><div class="grow"><b>${esc(x[1])}</b><small>${esc(x[2])}${i > st ? ' (ausgeblendet)' : ''}</small></div></button>`).join('');
    $$('[data-fs]', $('#ftView')).forEach(i => { const b = $('[data-sv="' + i.dataset.fs + '"]'); if (b) b.textContent = f(p[i.dataset.fs], 1) + ' mm'; });
    const m = $('[data-fm]'); if (m) m.value = st;
  }
  const fv = $('#ftView');
  fv.addEventListener('input', e => {
    const k = e.target.dataset.fs;
    if (k) S.ft[k] = +e.target.value; else if (e.target.matches('[data-fm]')) S.ft.step = +e.target.value; else return;
    lsSet('ft', S.ft); updateFt();
  });
  fv.addEventListener('click', e => { const b = e.target.closest('[data-fl]'); if (b) { S.ft.step = +b.dataset.fl; lsSet('ft', S.ft); updateFt(); } });

  /* ============================================================ Boolesche Operationen */
  const BO_NAME = [['union', 'Vereinigung'], ['diff', 'Differenz'], ['inter', 'Schnittmenge']];
  const BO_TXT = { union: 'A + B − gemeinsamer Teil: Der gemeinsame Teil steckt in beiden Körpern und zählt nur einmal.', diff: 'A − gemeinsamer Teil: Vom Block fällt weg, was im Zylinder steckt. So entsteht eine Bohrung.', inter: 'Nur der gemeinsame Teil bleibt: Der Zylinder, aber nur so hoch wie der Block.' };
  function renderBo() {
    $('#boView').innerHTML = `<div class="card pl"><h4>Block und Zylinder verrechnen</h4>
      <p class="hint2" style="margin:0 0 6px">Zwei Körper werden mit einer booleschen Operation zu einem neuen Körper. A ist ein Block (60 × 40 mm), B ein stehender Zylinder (50 mm hoch) in der Mitte des Blocks.</p>
      ${stepsBox(['Wähle eine Operation und sieh dir den Ergebnis-Körper an.', 'Ändere Durchmesser und Blockhöhe und lies die Volumen ab.', 'Prüfe: Vereinigung = A + B − gemeinsamer Teil.'])}
      <div class="fbar"><div class="seg">${BO_NAME.map(o => `<button data-bop="${o[0]}" class="${S.bo.op === o[0] ? 'on' : ''}">${o[1]}</button>`).join('')}</div></div>
      <div class="vzbox" id="boHost"></div><div id="boOut"></div>
      <div class="sgrid">${BO_SL.map(s => slider('data-bs', s, S.bo[s[0]], 'mm')).join('')}</div></div>${ueb()}`;
    updateBo();
  }
  function updateBo() {
    const b = S.bo, o = C.boolOps({ L: 60, B: 40, Hb: b.hb, d: b.d, Hc: 50 });
    $('#boHost').innerHTML = V.boolSvg(b);
    $('#boOut').innerHTML = `<div class="stats"><div class="bx"><b>${f(o.a / 1000, 1)}</b>A in cm³</div><div class="bx"><b>${f(o.b / 1000, 1)}</b>B in cm³</div><div class="bx"><b>${f(o.i / 1000, 1)}</b>gemeinsam in cm³</div></div>` +
      box('Ergebnis: ' + V.OPN[b.op], cm3(o[b.op]), 'ok') + `<p class="hint2" style="margin:2px 0 0">${esc(BO_TXT[b.op])}</p>`;
    $$('[data-bop]', $('#boView')).forEach(x => x.classList.toggle('on', x.dataset.bop === b.op));
    $$('[data-bs]', $('#boView')).forEach(i => { const v = $('[data-sv="' + i.dataset.bs + '"]'); if (v) v.textContent = f(b[i.dataset.bs], 1) + ' mm'; });
  }
  const bv = $('#boView');
  bv.addEventListener('input', e => { const k = e.target.dataset.bs; if (!k) return; S.bo[k] = +e.target.value; lsSet('bo', S.bo); updateBo(); });
  bv.addEventListener('click', e => { const b = e.target.closest('[data-bop]'); if (b) { S.bo.op = b.dataset.bop; lsSet('bo', S.bo); updateBo(); } });

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
  const einheit = q => q.ask.unit ? ' ' + q.ask.unit : '';
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : f(q.value, 3) + einheit(q));
  const eingabeHinweis = q => q.ask.type === 'num' ? `<p class="lr-hinweis hint2">${q.ask.unit ? 'Zahl in ' + esc(q.ask.unit) : 'Zahl ohne Einheit'}.${q.tol > 0.011 ? ' ±' + esc(f(q.tol, 2)) + einheit(q) + ' gelten als richtig (wegen Rundung).' : ''}</p>` : '';
  const stufeFuer = (ok, fehl, ex) => ok ? 'ok' : ex ? 'pruef' : fehl >= 2 ? 'loes' : 'tipp';
  const zeigFb = el => { try { const x = el && el.querySelector('.lr-fb'); if (x && root.LabRahmen) root.LabRahmen.zeig(x); } catch (e) {} };
  function qBody(q, a, r) {
    const lock = r && (r.ok || r.stufe === 'loes');
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${lock ? 'disabled' : ''} class="${lock && i === q.ask.correct ? 'ok' : a.c === i ? (r && !r.ok && r.given === c ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)}${q.ask.unit ? ' (' + esc(q.ask.unit) + ')' : ''}</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${lock ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div>${eingabeHinweis(q)}</label>`;
  }
  const qHead = q => `<p style="margin:8px 0">${esc(q.text)}</p>${q.img ? `<div class="vzbox">${V.taskImg(q.img)}</div>` : ''}${q.table ? `<div class="tw"><table class="tt"><tr>${q.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${q.table.rows.map(r => `<tr>${r.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>` : ''}${stepsBox(q.steps)}`;
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 3) + einheit(q) };
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
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)} · ${t.lj}. Lehrjahr</div>${qHead(q)}${qBody(q, a, r)}`;
      if (r) h += fbHTML(q, r);
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && (r.ok || r.stufe === 'loes') ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r && (r.ok || r.stufe === 'loes')) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`;
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span> · ${x.lj}. Lehrjahr${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    Vw.innerHTML = h + ueb(); if (top !== false) $('#pgTasks').scrollTop = 0;
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
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${qHead(q)}${qBody(q, T.ans, T.res)}${T.res ? fbHTML(q, T.res) : ''}
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
  const TERMS = [
    ['Skizze', 'Flache Zeichnung auf einer Ebene. Aus ihr entsteht ein Körper.'], ['Bedingung', 'Regel in der Skizze, zum Beispiel waagerecht, senkrecht, parallel, tangential, koinzident, symmetrisch oder gleich.'],
    ['Bemaßung', 'Ein Maß, das eine Länge, einen Winkel oder einen Durchmesser festlegt.'], ['Extrusion', 'Die Skizze wird senkrecht zur Ebene in die Höhe gezogen.'],
    ['Rotation', 'Die Skizze wird um eine Achse gedreht, so entstehen Wellen und Scheiben.'], ['Bohrung', 'Rundes Loch, als Feature mit Durchmesser und Tiefe.'],
    ['Fase', 'Eine Kante wird durch eine schräge ebene Fläche ersetzt.'], ['Rundung', 'Eine Kante wird durch eine gewölbte Fläche ersetzt.'],
    ['Muster und Spiegeln', 'Ein Feature wird mehrfach oder als Spiegelbild wiederholt.'], ['Boolesche Operationen', 'Vereinigung, Differenz und Schnittmenge von Körpern.'],
    ['Feature-Baum, Zeitleiste', 'Liste der Modellierschritte in der Reihenfolge der Berechnung.'], ['Parameter', 'Benannter Wert, der Maße steuert. Ändern des Werts baut das Modell neu auf.'],
    ['Baugruppe', 'Mehrere Bauteile, die mit Zusammenbaubedingungen verbunden sind.']
  ];
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      sec('Wichtige Begriffe', `<table><tr><th>Begriff</th><th>Bedeutung</th></tr>${TERMS.map(t => `<tr><td><b>${esc(t[0])}</b></td><td>${esc(t[1])}</td></tr>`).join('')}</table>`, true) +
      sec('Arbeitsweise im parametrischen CAD', `<ol><li>Ebene wählen und Skizze zeichnen.</li><li>Bedingungen und Maße setzen, bis die Skizze voll bestimmt ist (0 Freiheitsgrade).</li><li>Feature erzeugen (Extrusion, Rotation) und weitere Features in sinnvoller Reihenfolge ergänzen.</li><li>Parameter prüfen: Ändere ein Maß und kontrolliere, ob das Modell richtig mitwächst.</li></ol><p class="hint2">Koordinatensystem im Lab: X nach rechts, Y nach hinten, Z nach oben. Manche Programme nehmen Y als Höhe, das steht dann in deren Einstellungen.</p>`) +
      sec('Freiheitsgrade zählen', `<span class="eq">Punkt: 2 · Linie: 4 · Kreis: 3 · freier Körper im Raum: 6</span><span class="eq">Freiheitsgrade übrig = Freiheitsgrade ohne Bedingungen − Summe der Bedingungen</span><p>0 übrig heißt voll bestimmt. Mehr Bedingungen als nötig heißt überbestimmt. Die Zählweise im Lab ist vereinfacht, echte Programme zählen je Bedingung etwas anders.</p>`) +
      sec('Formeln', `<span class="eq">Quader: V = a · b · h</span><span class="eq">Zylinder: V = π/4 · d² · h</span><span class="eq">Vier gerundete senkrechte Kanten: ΔV = (4 − π) · r² · h</span><span class="eq">Vereinigung = A + B − gemeinsamer Teil</span><span class="eq">Masse m = Volumen · Dichte (cm³ · g/cm³ = g)</span><span class="eq">Skalieren mit Faktor k: Volumen · k³</span><span class="eq">1 cm³ = 1.000 mm³</span>`) +
      sec('3D-Druck und Dateiformate', `<ul><li>Schichten = Höhe / Schichthöhe. Wandstärke am besten ein Vielfaches der Linienbreite.</li><li>Überhänge steiler als etwa 45 Grad zur Senkrechten brauchen Stützen. Teile so drehen, dass wenig Stützen nötig sind.</li><li>Zugkräfte sollen entlang der Schichten wirken, nicht quer.</li><li>Spiel für Passungen auf beiden Seiten einplanen (Bohrung = Zapfen + 2 · Spiel).</li><li>STL und 3MF: Netzmodelle für das Druckprogramm. STEP: genaue Geometrie für andere CAD-Programme.</li></ul>`) +
      sec('Wie geht es weiter?', `<p>Alles, was du hier ausprobiert hast, kannst du in einem echten Programm anwenden. Eine freie Möglichkeit zum Weiterüben ist <b>SolidCraft</b>, ein quelloffenes parametrisches 3D-CAD-Programm. Es arbeitet mit Skizzen, Bedingungen und Körpern, die über eine Zeitleiste von Features entstehen, und läuft auch im Browser.</p><p>Zeichne dort zum Beispiel eine Skizze, bemaße sie, extrudiere sie und ändere danach ein Maß: Das Modell baut sich neu auf. Frag deinen Ausbilder, wie ihr das Programm in der Lehrwerkstatt nutzt.</p>`) + ueb();
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'sk'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ sk: renderSk, ft: renderFt, bo: renderBo, tasks: renderTasks, rt: renderTrainer, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = '3D-Modellierungs-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = '3D-Modellierungs-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('sk');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe und Formeln', 'Begriffe, Freiheitsgrade, Formeln, 3D-Druck'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.CAD_LAB = { id: 'cad', title: '3D-Modellierungs-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.CAD_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'sk');
  /* Aufruf ?aufgabe=cad1 öffnet die Aufgabe */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
