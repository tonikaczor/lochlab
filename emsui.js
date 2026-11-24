'use strict';
/* Tonfunk EMS-Lab: Oberfläche (Lab-Kennung 'ems', alle Berufe). So fertigt ein EMS-Dienstleister wie Tonfunk Elektronik im Auftrag.
   Reiter: Wertstrom (mit „Dein Beruf“), Fertigung, Prüfen, Material, Qualität, Daten, Montage, Kunde, Aufgaben, Hilfe. Jeder Themen-Reiter hat einen Rechner.
   Module: emscore.js (EMS_CORE, Rechnen und Prüfen), emsdata.js (EMS_DATA).
   Speicher (Präfix lm4.ems.): tab, b (gewählter Beruf im Wertstrom), r (Rechnerwerte), done ({id:true}), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), auf ({id:true} Lösung aufgedeckt), exam ('1').
   Tipps, Prüfmodus und „Lösung zeigen“ wie im Linien-Lab. Aufruf: emslab.html?aufgabe=ems1 öffnet die Aufgabe, ?tab=pru den Reiter. */
(function (root) {
  const C = root.EMS_CORE, D = root.EMS_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.ems.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
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
  if (!C || !D) { $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>EMS-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">emscore.js oder emsdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>'; return; }
  const TASKS = D.tasks, f = (v, d) => C.fmt(v, d);

  /* ============================================================ Zustand */
  const TABS = [['wert', '🏭', 'Wertstrom'], ['fer', '🔥', 'Fertigung'], ['pru', '🔍', 'Prüfen'], ['mat', '📦', 'Material'], ['qua', '✅', 'Qualität'], ['dat', '🏷️', 'Daten'],
    ['mec', '🔩', 'Montage'], ['kun', '🤝', 'Kunde'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Hilfe']];
  const R0 = { fer: { y1: 98, y2: 99, y3: 97, los: 500 }, pru: { n: 300, adapter: 6000, ict: 0.5, fp: 8 }, mat: { lv: '3', h: 100 }, qua: { basis: 0.1 }, dat: { teil: 'kond', los: 'K-18' },
    mec: { F: 50, r: 0.2 }, kun: { material: 12, punkte: 250, preisPunkt: 0.02, loet: 20, preisLoet: 0.05, pruefMin: 2, minSatz: 1.2, ruest: 400, los: 100, zuschlag: 15 } };
  const rs = lsGet('r', {}), Rw = {};
  Object.keys(R0).forEach(k => { Rw[k] = Object.assign({}, R0[k]); const s = rs[k]; if (s && typeof s === 'object') Object.keys(R0[k]).forEach(j => { if (typeof s[j] === typeof R0[k][j] && (typeof s[j] !== 'number' || Number.isFinite(s[j]))) Rw[k][j] = s[j]; }); });
  if (!C.MSL.some(m => m[0] === Rw.mat.lv)) Rw.mat.lv = R0.mat.lv;
  const meinB = (() => { try { return localStorage.getItem('lm4.beruf') || ''; } catch (e) { return ''; } })();
  const S = { tab: lsGet('tab', 'wert'), b: D.beruf[lsGet('b', '')] ? lsGet('b', '') : (D.beruf[meinB] ? meinB : 'egs'), step: null, task: null, tAns: {}, tRes: null, tShow: null, tTries: {} };   // tTries: Fehlversuche je Aufgabe, bleibt beim Ändern der Auswahl

  /* ============================================================ 1 Wertstrom und Dein Beruf */
  function renderWert() {
    const B = D.beruf[S.b], mine = id => B.schritte.indexOf(id) >= 0;
    let h = `<div class="card pl"><h4>Was macht ein EMS-Dienstleister?</h4><p style="margin:0">${esc(D.intro)}</p></div>`;
    h += `<div class="card pl"><h4>Dein Beruf im Wertstrom</h4><div class="ctl" role="group" aria-label="Beruf wählen">${Object.keys(D.beruf).map(k => `<button class="chip${k === S.b ? ' on' : ''}" data-b="${k}" aria-pressed="${k === S.b}">${esc(D.BN[k])}</button>`).join('')}</div>`;
    h += `<p style="margin:8px 0 0"><b>${esc(D.BN[S.b])}:</b> ${esc(B.rolle)}</p><p class="hint2">★ markiert die Schritte, an denen du als ${esc(D.BN[S.b])} mitarbeitest. Tippe einen Schritt an, dann siehst du, was dort passiert.</p></div>`;
    h += `<div class="flow" role="list">${D.schritte.map((s, i) => `<button class="fs${mine(s.id) ? ' mine' : ''}${S.step === s.id ? ' sel' : ''}" data-s="${s.id}" role="listitem" aria-pressed="${S.step === s.id}"><span class="nb">${i + 1}</span><span class="grow"><b>${mine(s.id) ? '★ ' : ''}${esc(s.name)}</b><small>${esc(s.kurz)}</small></span></button>`).join('')}</div>`;
    const s = D.schritte.find(x => x.id === S.step);
    if (s) h += `<div class="card pl" id="stepCard" style="border-color:var(--accent)"><h4>Schritt ${D.schritte.indexOf(s) + 1} von ${D.schritte.length}</h4><div class="big">${esc(s.name)}</div><p>${esc(s.was)}</p><div class="rdout ok"><b>So werden Fehler verhindert oder gefunden:</b> ${esc(s.pruef)}</div><p class="hint2">Hier arbeiten mit: ${s.berufe.map(b => esc(D.BN[b])).join(', ')}.</p></div>`;
    $('#wertView').innerHTML = h;
  }
  $('#wertView').addEventListener('click', e => {
    const b = e.target.closest('[data-b]'), s = e.target.closest('[data-s]');
    if (b) { S.b = b.dataset.b; lsSet('b', S.b); renderWert(); }
    else if (s) { S.step = S.step === s.dataset.s ? null : s.dataset.s; renderWert(); const c = $('#stepCard'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  });

  /* ============================================================ 2 Themen-Reiter mit Rechner */
  const sl = (tab, k, a, b, st, label, unit, d) => `<label class="f"><span>${label}: <b id="v_${tab}_${k}">${f(Rw[tab][k], d)} ${unit}</b></span><input type="range" data-r="${tab}" data-k="${k}" min="${a}" max="${b}" step="${st}" value="${Rw[tab][k]}" data-d="${d}" data-u="${unit}" aria-label="${esc(label)}"></label>`;
  const box = (label, wert) => `<div class="bx">${label}<b>${wert}</b></div>`;
  const bar = (pct, cls) => `<div class="bar"><span class="${cls || ''}" style="width:${Math.max(0.6, Math.min(100, pct))}%"></span></div>`;
  const RECH = {
    fer: {
      t: 'Ausbeute im ersten Durchlauf',
      ctl: () => sl('fer', 'y1', 90, 100, 0.5, 'Pastendruck und Bestücken gut', '%', 1) + sl('fer', 'y2', 90, 100, 0.5, 'Reflow-Löten gut', '%', 1) + sl('fer', 'y3', 90, 100, 0.5, 'THT und Löten gut', '%', 1) + sl('fer', 'los', 100, 2000, 100, 'Losgröße', 'Stück', 0),
      out: r => { const y = C.fpy([r.y1 / 100, r.y2 / 100, r.y3 / 100]), gut = Math.floor(r.los * y + 1e-9); return `<div class="stats">${box('First Pass Yield', f(y * 100, 1) + ' %')}${box('Gut beim ersten Mal', f(gut, 0))}${box('Nacharbeit', f(r.los - gut, 0))}</div>${bar(y * 100, 'ok')}<p class="hint2">FPY = ${f(r.y1, 1)} % × ${f(r.y2, 1)} % × ${f(r.y3, 1)} %. Jede Stufe für sich sieht gut aus, das Produkt ist kleiner als die schwächste Stufe.</p>`; }
    },
    pru: {
      t: 'Prüfstrategie: ICT oder Flying-Probe?',
      ctl: () => sl('pru', 'n', 10, 2000, 10, 'Stückzahl', 'Stück', 0) + sl('pru', 'adapter', 1000, 15000, 500, 'Preis des ICT-Adapters', '€', 0) + sl('pru', 'ict', 0.1, 3, 0.1, 'ICT je Stück', '€', 2) + sl('pru', 'fp', 2, 20, 0.5, 'Flying-Probe je Stück', '€', 2),
      out: r => { const k = C.pruefKosten(r), m = Math.max(k.ict, k.fp); return `<div class="stats">${box('ICT gesamt', f(k.ict, 0) + ' €')}${box('Flying-Probe gesamt', f(k.fp, 0) + ' €')}${box('Gleichstand ab', Number.isFinite(k.gleich) ? f(Math.ceil(k.gleich), 0) + ' Stück' : 'nie')}</div><p class="lbl2">ICT mit Adapter</p>${bar(k.ict / m * 100)}<p class="lbl2">Flying-Probe ohne Adapter</p>${bar(k.fp / m * 100, 'hi')}<div class="rdout ${k.besser === 'ict' ? 'ok' : 'warn'}"><b>Günstiger: ${k.besser === 'ict' ? 'ICT mit Adapter' : 'Flying-Probe'}.</b><span class="st">Gleichstand: Adapter ${f(r.adapter, 0)} € geteilt durch (${f(r.fp, 2)} € − ${f(r.ict, 2)} €). Bei wenigen Stück lohnt der Adapter nicht, bei vielen Stück gewinnt der schnelle ICT.</span></div>`; }
    },
    mat: {
      t: 'MSL-Uhr: Wie lange darf das Bauteil offen liegen?',
      ctl: () => `<div class="ctl" role="group" aria-label="Feuchteklasse wählen">${C.MSL.map(m => `<button class="chip s${Rw.mat.lv === m[0] ? ' on' : ''}" data-r="mat" data-k="lv" data-v="${m[0]}" aria-pressed="${Rw.mat.lv === m[0]}">MSL ${m[0]}</button>`).join('')}</div>` + sl('mat', 'h', 0, 400, 2, 'Schon offen (außerhalb Trockenschrank oder Beutel)', 'h', 0),
      out: r => { const m = C.mslRest(r.lv, r.h), L = m.leben; if (L === 0) return '<div class="rdout bad"><b>MSL 6: Vor jedem Gebrauch trocknen (backen).</b><span class="st">Die Zeit danach steht auf dem Warnetikett des Beutels.</span></div>';
        if (!Number.isFinite(L)) return '<div class="rdout ok"><b>MSL 1: Bodenlebensdauer unbegrenzt.</b><span class="st">Gilt bei höchstens 30 °C und 85 % relativer Feuchte.</span></div>';
        return `<div class="stats">${box('Bodenlebensdauer', f(L, 0) + ' h')}${box('Noch übrig', f(m.rest, 0) + ' h')}</div>${bar(m.rest / L * 100, m.ok ? 'ok' : 'bad')}<div class="rdout ${m.ok ? 'ok' : 'bad'}"><b>${m.ok ? 'Noch verarbeiten.' : 'Zeit abgelaufen: nicht löten, erst trocknen (backen) nach Vorgabe.'}</b><span class="st">Werte nach J-STD-033 bei höchstens 30 °C und 60 % relativer Feuchte. Die Uhr läuft, sobald der Trockenbeutel offen ist.</span></div>`; }
    },
    qua: {
      t: 'Zehnerregel der Fehlerkosten',
      ctl: () => sl('qua', 'basis', 0.05, 1, 0.05, 'Kosten im Wareneingang', '€', 2),
      out: r => { const w = C.STUFEN.map((s, i) => C.zehner(i, r.basis)), m = w[w.length - 1]; return C.STUFEN.map((s, i) => `<p class="lbl2">${i + 1}. ${esc(s)}: <b>${f(w[i], 2)} €</b></p>${bar(w[i] / m * 100, i === 3 ? 'bad' : '')}`).join('') + '<p class="hint2">Je später ein Fehler gefunden wird, desto teurer wird er: etwa zehnmal je Stufe. Darum prüft ein EMS-Fertiger so früh wie möglich.</p>'; }
    },
    dat: {
      t: 'Rückverfolgung: Welche Geräte sind betroffen?',
      ctl: () => { const lose = [...new Set(C.RUECK.map(x => x.los[Rw.dat.teil]))]; return `<div class="ctl" role="group" aria-label="Bauteil wählen">${[['kond', 'Kondensator'], ['ic', 'IC']].map(([k, n]) => `<button class="chip${Rw.dat.teil === k ? ' on' : ''}" data-r="dat" data-k="teil" data-v="${k}" aria-pressed="${Rw.dat.teil === k}">${n}</button>`).join('')}</div><div class="ctl" role="group" aria-label="Los wählen">${lose.map(l => `<button class="chip${Rw.dat.los === l ? ' on' : ''}" data-r="dat" data-k="los" data-v="${l}" aria-pressed="${Rw.dat.los === l}">Los ${l}</button>`).join('')}</div>`; },
      out: r => { const hit = C.betroffen(r.teil, r.los); return `<div class="tw"><table class="tt"><tr><th>Seriennummer</th><th>Los Kondensator</th><th>Los IC</th><th>Betroffen?</th></tr>${C.RUECK.map(x => { const on = hit.indexOf(x.sn) >= 0; return `<tr${on ? ' class="sel"' : ''}><td>${x.sn}</td><td>${x.los.kond}</td><td>${x.los.ic}</td><td>${on ? '⚠ ja' : 'nein'}</td></tr>`; }).join('')}</table></div><div class="rdout ${hit.length ? 'warn' : 'ok'}"><b>${hit.length} von ${C.RUECK.length} Geräten betroffen.</b><span class="st">Weil jede Leiterplatte einen Barcode hat und beim Rüsten die Lose gescannt werden, findest du in Sekunden genau diese Geräte, statt alle zurückzurufen.</span></div>`; }
    },
    mec: {
      t: 'Drehmoment beim Schrauben',
      ctl: () => sl('mec', 'F', 10, 200, 5, 'Kraft am Hebel', 'N', 0) + sl('mec', 'r', 0.05, 0.5, 0.01, 'Hebellänge', 'm', 2),
      out: r => `<div class="stats">${box('Drehmoment', f(C.moment(r.F, r.r), 2) + ' Nm')}</div><p class="hint2">M = F × r = ${f(r.F, 0)} N × ${f(r.r, 2)} m. In der Montage stellt ein überwachter Drehmomentschrauber den Wert aus der Arbeitsanweisung ein und speichert jede Verschraubung.</p>`
    },
    kun: {
      t: 'Kalkulation einer Baugruppe',
      ctl: () => `<div class="dsrow">${[['material', 'Material je Stück', '€'], ['punkte', 'Bestückpunkte SMD', 'Stück'], ['preisPunkt', 'Preis je Bestückpunkt', '€'], ['loet', 'THT-Lötstellen', 'Stück'], ['preisLoet', 'Preis je Lötstelle', '€'], ['pruefMin', 'Prüfzeit je Stück', 'min'], ['minSatz', 'Minutensatz Prüfen', '€'], ['ruest', 'Rüstkosten je Los', '€'], ['los', 'Losgröße', 'Stück'], ['zuschlag', 'Zuschlag', '%']]
        .map(([k, n, u]) => `<label class="f"><span>${n} (${u})</span><input data-r="kun" data-k="${k}" data-num="1" inputmode="decimal" autocomplete="off" value="${esc(f(Rw.kun[k], 3))}"></label>`).join('')}</div>`,
      out: r => { if (!(r.los > 0)) return '<div class="rdout bad"><b>Die Losgröße muss größer als 0 sein.</b></div>'; const k = C.kalk(r);
        return `<div class="stats">${box('Kosten je Stück', f(k.kosten, 2) + ' €')}${box('Angebot je Stück', f(k.angebot, 2) + ' €')}</div><div class="tw"><table class="tt"><tr><th>Losgröße</th><th class="n">Rüstanteil je Stück</th><th class="n">Angebot je Stück</th></tr>${[10, 100, 1000].map(n => `<tr><td>${n}</td><td class="n">${f(r.ruest / n, 2)} €</td><td class="n">${f(C.kalk(Object.assign({}, r, { los: n })).angebot, 2)} €</td></tr>`).join('')}</table></div><p class="hint2">Kosten = Material + Punkte × Preis + Lötstellen × Preis + Prüfminuten × Satz + Rüstkosten / Losgröße. Kleine Lose tragen die Rüstkosten auf wenigen Stück.</p>`; }
    }
  };
  function renderThema(tab) {
    const X = RECH[tab];
    $('#' + tab + 'View').innerHTML = `<div class="card pl"><h4>Rechner: ${esc(X.t)}</h4>${X.ctl()}<div id="out_${tab}">${X.out(Rw[tab])}</div></div>` +
      D.seiten[tab].map((c, i) => `<details class="ex"${i ? '' : ' open'}><summary>${esc(c.h)}</summary><div class="hb2"><p>${esc(c.t)}</p></div></details>`).join('') + `<p class="hint2">${esc(D.NOTE)}</p>`;
  }
    $('#mid').addEventListener('input', e => {
    const el = e.target, tab = el.dataset && el.dataset.r, k = el.dataset && el.dataset.k; if (!tab || !RECH[tab] || !k) return;
    const v = el.dataset.num ? C.parseDe(el.value) : +el.value; if (!Number.isFinite(v) || v < 0) return;
    Rw[tab][k] = v; const lab = $('#v_' + tab + '_' + k); if (lab) lab.textContent = f(v, +el.dataset.d) + ' ' + el.dataset.u;
    const o = $('#out_' + tab); if (o) o.innerHTML = RECH[tab].out(Rw[tab]); lsSet('r', Rw);
  });
  $('#mid').addEventListener('click', e => {
    const b = e.target.closest('button[data-r][data-v]'); if (!b || !RECH[b.dataset.r]) return;
    const tab = b.dataset.r; Rw[tab][b.dataset.k] = b.dataset.v;
    if (tab === 'dat' && b.dataset.k === 'teil') Rw.dat.los = C.RUECK[2].los[b.dataset.v];   // beim Wechsel des Bauteils ein Los wählen, das es gibt
    lsSet('r', Rw); renderThema(tab);
  });

  /* ============================================================ Aufgaben */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  const AUF_PCT = 25;   // Wert einer Aufgabe, deren Lösung vor dem richtigen Lösen aufgedeckt wurde
  const aufg = id => !!lsGet('auf', {})[id];
  function pctFor(id) { let b = 100; if (exam()) b = Math.max(0, Math.round(b * (100 - 25 * Math.min(3, lsGet('ctipps', {})[id] || 0)) / 100)); return aufg(id) ? Math.min(b, AUF_PCT) : b; }
  function markSolved(id, pct) { const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p); const d = done(); d[id] = true; lsSet('done', d); updateBadge(); updatePal(); }
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  const solHtml = t => `<b>Lösung:</b> ${esc(t.kind === 'num' ? f(t.answer, 3) + (t.unit ? ' ' + t.unit : '') : [].concat(t.correct).map(i => t.choices[i]).join(' | '))}${t.steps ? '<br><br><b>Rechenweg:</b><ol class="steps">' + t.steps.map(l => '<li>' + esc(l) + '</li>').join('') + '</ol>' : ''}<p style="margin:8px 0 0">${esc(t.expl)}</p>`;
  function qBody(t, a, r) {
    const locked = r && r.ok;
    if (t.kind === 'num') return `<label class="f"><span>Ergebnis${t.unit ? ' (' + esc(t.unit) + ')' : ''}</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(a.v || '')}" ${locked ? 'disabled' : ''}><span class="u">${esc(t.unit || '')}</span></div></label><p class="hint2 lr-hinweis">Zahl${t.unit ? ' in ' + esc(t.unit) : ''}, Komma oder Punkt.</p>`;
    const multi = Array.isArray(t.correct), c = [].concat(t.correct);
    return `<div class="opts" role="group" aria-label="${multi ? 'Antworten, mehrere möglich' : 'Antworten, eine ist richtig'}">${C.reihe(t).map(i => { const on = (a.s || []).indexOf(i) >= 0, st = r ? (locked ? (c.indexOf(i) >= 0 ? 'ok' : '') : (on ? 'bad' : '')) : (on ? 'on' : ''); return `<button data-tm="${i}" ${locked ? 'disabled' : ''} class="${st}" aria-pressed="${on}">${multi ? (on ? '☑' : '☐') : (on ? '◉' : '○')} ${esc(t.choices[i])}</button>`; }).join('')}</div>`;
  }
  const resBlock = (t, r, shown) => {
    const fbc = r.ok ? 'ok' : exam() ? 'tipp' : shown ? 'loes' : 'tipp';
    const kopf = `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Noch nicht richtig (' + esc(r.given) + ').'}</li></ul>`;
    const rest = r.ok ? `<div class="rdout ok">${solHtml(t)}${r.auf ? `<span class="st" style="margin-top:8px">Gezählt: ${r.pct} %, weil die Lösung aufgedeckt war. Löse die Aufgabe später noch einmal ohne Lösung, dann zählt sie voll.</span>` : ''}</div>`
      : exam() ? '<div class="rdout bad">🎓 Prüfmodus: Die Lösung gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>'
        : shown ? '<p>Die Lösung steht darunter. Lies sie in Ruhe und probiere danach eine andere Aufgabe.</p>'
          : `<p><b>Tipp:</b> ${esc(t.tips[0])} Du hast einen zweiten Versuch.</p><div class="rdout bad">Lies den Tipp (💡) oder versuche es noch einmal. Kommst du gar nicht weiter, kannst du dir die Lösung zeigen lassen. Dann zählt die Aufgabe in dieser Runde nur ${AUF_PCT} %.</div><div class="btns"><button class="btn" data-ta="sol">Lösung zeigen</button></div>`;
    return `<div class="lr-fb ${fbc}" id="tkFb" role="status">${kopf}${rest}</div>`;
  };
  function renderTasks(top) {
    const d = done(), prog = lsGet('prog', {}), t = curTask(), n = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {}, shown = S.tShow === t.id && !exam() && !(r && r.ok);
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv" aria-label="Schwierigkeit ${t.level} von 3">${dots(t.level)}</div><p style="margin:8px 0">${esc(t.text)}</p>${qBody(t, a, r)}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) { h += resBlock(t, r, shown); if (r.ok) h += '<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>'; }
      if (shown) h += `<div class="rdout warn" id="tkSol">${solHtml(t)}</div>`;
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Im Prüfmodus (🎓) zählen Tipps als Abzug.'} Bei Rechnungen tippst du eine Zahl ein, sonst wählst du die richtige Antwort, bei „Wähle alle richtigen“ auch mehrere.</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span> · ${x.kind === 'num' ? 'Rechnung' : Array.isArray(x.correct) ? 'Mehrfachwahl' : 'Auswahl'}${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    $('#taskView').innerHTML = h;
    if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const r0 = C.pruefe(t, S.tAns[t.id] || {});
    if (!r0) { toast(t.kind === 'num' ? 'Bitte gib eine Zahl ein (mit Komma oder Punkt).' : 'Wähle zuerst eine Antwort.'); return; }
    const auf = r0.ok && aufg(t.id), pct = r0.ok ? pctFor(t.id) : 0, tries = S.tTries[t.id] = (S.tTries[t.id] || 0) + (r0.ok ? 0 : 1);
    S.tRes = { id: t.id, ok: r0.ok, given: r0.given, pct, auf, tries };
    if (r0.ok) {
      markSolved(t.id, pct);
      if (auf) { const m = lsGet('auf', {}); delete m[t.id]; lsSet('auf', m); }
      const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding();
      toast(pct < 100 ? pct + (auf && pct === AUF_PCT ? ' % (Lösung war aufgedeckt)' : ' % (Tipps abgezogen)') : '🎉 Geschafft!');
    } else {
      sad(); toast('Noch nicht richtig. Lies den Tipp oder versuche es noch einmal.');
      if (tries >= 2 && !exam()) { if ((lsGet('prog', {})[t.id] || 0) < 100) { const m = lsGet('auf', {}); m[t.id] = true; lsSet('auf', m); } S.tShow = t.id; }
    }
    renderTasks(false); const fb = $('#tkFb'); if (fb && root.LabRahmen && LabRahmen.zeig) LabRahmen.zeig(fb);
  }
  function showSol(t) {
    if (exam() || !S.tRes || S.tRes.id !== t.id || S.tRes.ok) return;
    if ((lsGet('prog', {})[t.id] || 0) < 100) { const m = lsGet('auf', {}); m[t.id] = true; lsSet('auf', m); }
    S.tShow = t.id; renderTasks(false);
  }
  function hintFor(t) {
    const id = t.id, h = lsGet('hints', {}), n = Math.min(3, (h[id] || 0) + 1), ex = exam(); h[id] = Math.max(h[id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 3', b => {
      let x = ''; for (let i = 0; i < n; i++) x += `<p${i ? '' : ' style="margin-top:0"'}><b>Stufe ${i + 1}:</b> ${esc(t.tips[i])}</p>`;
      x += n >= 3 ? '<p class="hint2">Mehr Tipps gibt es nicht.</p>' : '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“.</p>';
      x += ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts.</p>';
      b.innerHTML = x;
    });
  }
  function startTask(id) {
    if (!TASKS.some(x => x.id === id)) return;
    S.task = id; S.tAns = {}; S.tRes = null; S.tShow = null; S.tTries[id] = 0;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  const tv = $('#taskView');
  tv.addEventListener('input', e => { const t = curTask(); if (t && e.target.dataset.in) (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('click', e => {
    const t = curTask(), tm = e.target.closest('[data-tm]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tm && t) { const a = S.tAns[t.id] = S.tAns[t.id] || {}, i = +tm.dataset.tm; if (Array.isArray(t.correct)) { a.s = a.s || []; const j = a.s.indexOf(i); if (j >= 0) a.s.splice(j, 1); else a.s.push(i); } else a.s = [i]; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintFor(t); else if (a === 'sol') showSol(t); else if (a === 'close') { S.task = null; S.tRes = null; S.tShow = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      sec('Für wen ist dieses Lab?', `<p>Für alle Berufe und Studienwege bei Tonfunk. Tonfunk ist ein EMS-Dienstleister: Kunden mit eigener Marke (OEM) lassen ihre Elektronik hier entwickeln, fertigen, prüfen und verpacken. Hier siehst du den ganzen Weg einer Baugruppe und wo dein Beruf darin arbeitet.</p><p class="rdout warn">${esc(D.NOTE)}</p>`, true) +
      sec('So arbeitest du', `<p>Im <b>Wertstrom</b> wählst du deinen Beruf und tippst die Schritte an. Die Reiter <b>Fertigung</b> bis <b>Kunde</b> haben oben einen Rechner und darunter kurze Wissenskarten. Unter <b>Aufgaben</b> findest du ${TASKS.length} Aufgaben mit drei Tipp-Stufen. Nach einer falschen Antwort kannst du dir die Lösung zeigen lassen, dann zählt die Aufgabe in dieser Runde nur ${AUF_PCT} %. Im Prüfmodus kostet jede Tipp-Stufe 25 %.</p>`) +
      sec('Fachbegriffe von A bis Z', `<table><tr><th>Begriff</th><th>Bedeutung</th></tr>${D.help.map(x => `<tr><td><b>${esc(x.h)}</b></td><td>${esc(x.t)}</td></tr>`).join('')}</table>`);
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'wert'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'wert') renderWert(); else if (t === 'tasks') renderTasks(); else if (t === 'help') renderHelp(); else renderThema(t);
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'EMS-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'EMS-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); if (on) S.tShow = null; palSig = ''; updatePal(); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Nächste offene Aufgabe">🎲 Zufallsaufgabe</button><span id="stat">Aufgaben gelöst <b>${n}/${TASKS.length}</b></span>`;
    $('#bExam').classList.toggle('on', exam()); $('#bExam').setAttribute('aria-pressed', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { const open = TASKS.filter(x => !done()[x.id]), pool = open.length ? open : TASKS; setTab('tasks'); startTask(pool[Math.floor(Math.random() * pool.length)].id); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('wert');
  $('#bMenu').onclick = () => {
    const rows = TABS.map(([k, , n]) => [k, n]).concat([['exam', 'Prüfmodus ' + (exam() ? 'ausschalten' : 'einschalten')], ['reset', 'Fortschritt zurücksetzen'], ['home', 'Startseite']]);
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben und Tipps dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'auf'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.task = null; S.tRes = null; S.tShow = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  buildTabs(); updatePal(); setTab(S.tab);
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qt = new URLSearchParams(location.search).get('tab'); if (qt && TABS.some(x => x[0] === qt)) setTab(qt); } catch (e) {}
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
