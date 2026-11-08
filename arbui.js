'use strict';
/* Tonfunk Arbeitsschutz-Lab: Oberfläche (Lab-Kennung 'arb').
   Reiter: Zeichen, Brandschutz, Gefahrstoffe, Gefährdungsbeurteilung, PSA, Erste Hilfe, Verhalten, Beispiele, Aufgaben, Trainer, Abschluss, Hilfe.
   Module: arbdata.js (ARB_DATA, ARB_TASKS), arbcore.js (ARB_CORE, Logik).
   Speicher (Präfix lm4.arb.): tab, done ({id:true} nur gelöste), prog ({id:Prozent}), hints ({id:höchste Stufe}), ctipps ({id:Stufe} nur im Prüfmodus),
   exam ('1' = Prüfmodus), rt (Trainer: n, ok, streak, best), fin (Abschlussrunde: best, last, date).
   Tipp-Abzug (25 % je Stufe, zwei Stufen) gibt es nur im Prüfmodus. Es werden keine Daten übertragen. */
(function (root) {
  const C = root.ARB_CORE, D = root.ARB_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const clean = s => (C ? C.stripMark(s) : String(s));
  const esc = s => clean(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.arb.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  const who = () => { try { const v = localStorage.getItem('lm4.name'); return v ? String(v).replace(/^"|"$/g, '') : ''; } catch (e) { return ''; } };

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
  function copyText(t) {
    const ok = () => toast('Kopiert');
    const fb = () => { const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Bitte den Text markieren und kopieren.'); } a.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, fb); else fb();
  }

  if (!C || !D) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Arbeitsschutz-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">arbcore.js oder arbdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['zei', '🪧', 'Zeichen'], ['bra', '🔥', 'Brandschutz'], ['ghs', '☣️', 'Gefahrstoffe'], ['gb', '📋', 'Gefährdungsbeurteilung'], ['psa', '🦺', 'PSA'], ['eh', '🩹', 'Erste Hilfe'], ['ver', '🚪', 'Verhalten'], ['bsp', '💡', 'Beispiele'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['fin', '🏁', 'Abschluss'], ['help', '📘', 'Hilfe']];
  const S = {
    tab: lsGet('tab', 'zei'), braKey: 'F', gbWp: 'bohr', gb: {}, gbRes: {}, psaAct: 'schleifen', psaSel: [], psaRes: null,
    task: null, tAns: {}, tRes: null, pq: {}, bsp: null,
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {})), rtCat: '', rtQ: null, rtAns: null, rtRes: null, rtI: 0,
    fin: { state: 'intro', qs: [], ans: [], i: 0, res: null, name: who(), cert: null, seed: 0, chk: '' }
  };
  if (!TABS.some(x => x[0] === S.tab)) S.tab = 'zei';

  /* ============================================================ Gemeinsame Bausteine */
  const sgn = (id, cls) => `<span class="sgn${cls ? ' ' + cls : ''}">${C.svgOf(id)}</span>`;
  const card = (h4, body) => `<div class="card pl">${h4 ? `<h4>${esc(h4)}</h4>` : ''}${body}</div>`;
  const hint = t => `<p class="hint2" style="margin:0">${esc(t)}</p>`;
  const nameOfSign = id => { const s = C.signById(id) || C.ghsById(id); return s ? (s.name || '') : ''; };
  function details(list, openFirst) { return list.map((x, i) => `<details${openFirst && i === 0 ? ' open' : ''}><summary>${esc(x[0])}</summary><div class="hb2">${clean(x[1])}</div></details>`).join(''); }
  function optsHTML(q, ans, res) {
    const sgs = q.choices.some(c => c.s);
    return `<div class="opts${sgs ? ' sgs' : ''}" data-ctxo="1">` + q.choices.map((c, i) => {
      const sel = q.multi ? (ans || []).indexOf(i) >= 0 : ans === i;
      let cls = '';
      if (res && res.show) { const corr = q.multi ? q.correct.indexOf(i) >= 0 : q.correct === i; cls = corr ? 'ok' : sel ? 'bad' : ''; } else if (res && !res.ok && sel) cls = 'bad'; else if (sel) cls = 'on';
      const lock = res && res.ok;
      return `<button data-c="${i}" class="${cls}" aria-pressed="${sel}" ${lock ? 'disabled' : ''}${c.s ? ` aria-label="${esc(nameOfSign(c.s) || 'Schild ' + (i + 1))}"` : ''}>${c.s ? sgn(c.s, 's') : ''}${c.t ? esc(c.t) : ''}${q.multi ? '<span class="mk">' + (sel ? '☑' : '☐') + '</span>' : ''}</button>`;
    }).join('') + '</div>';
  }
  const solText = q => (Array.isArray(q.correct) ? q.correct : [q.correct]).map(i => q.choices[i].t || nameOfSign(q.choices[i].s)).join('; ');
  function qBody(q, ans, res) {
    return (q.sign ? `<div class="sgbig">${sgn(q.sign)}</div>` : '') + `<p style="margin:8px 0;line-height:1.45">${esc(q.text)}</p>` + (q.multi ? '<p class="hint2" style="margin:0">Mehrere Antworten sind richtig. Wähle alle passenden.</p>' : '') + optsHTML(q, ans, res);
  }

  /* ---------- kleine SVG-Bilder ---------- */
  function svgStop() {
    const rows = [['S', 'Substitution', '#1a7f4b'], ['T', 'Technische Maßnahmen', '#1a6fd4'], ['O', 'Organisatorische Maßnahmen', '#9a5b00'], ['P', 'Persönliche Maßnahmen (PSA)', '#a33a3a']];
    return `<div class="inst fit"><svg viewBox="0 0 320 190" role="img" aria-label="STOP-Prinzip: Rangfolge von Substitution bis persönlicher Schutzausrüstung">` +
      rows.map((r, i) => { const w = 300 - i * 36, x = (320 - w) / 2, y = 4 + i * 42; return `<rect x="${x}" y="${y}" width="${w}" height="38" rx="8" fill="${r[2]}"/><text x="160" y="${y + 24}" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">${r[0]} · ${r[1]}</text>`; }).join('') +
      `<text x="160" y="184" text-anchor="middle" font-size="11" class="sv-note">von oben (wirksam) nach unten: erst die Gefahr beseitigen, PSA zuletzt</text></svg></div>`;
  }
  function svgKette() {
    const L = [['Sofort-', 'maßnahmen'], ['Notruf', '112'], ['Erste', 'Hilfe'], ['Rettungs-', 'dienst'], ['Kranken-', 'haus']];
    return `<div class="inst fit"><svg viewBox="0 0 320 92" role="img" aria-label="Rettungskette mit fünf Gliedern"><line x1="34" y1="26" x2="286" y2="26" stroke="var(--mute)" stroke-width="3"/>` +
      L.map((l, i) => { const x = 34 + i * 63; return `<circle cx="${x}" cy="26" r="19" fill="var(--accent-bg)"/><text x="${x}" y="32" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">${i + 1}</text><text x="${x}" y="64" text-anchor="middle" font-size="11" class="sv-note">${l[0]}</text><text x="${x}" y="78" text-anchor="middle" font-size="11" class="sv-note">${l[1]}</text>`; }).join('') + '</svg></div>';
  }

  /* ============================================================ Zeichen */
  function renderZei() {
    let h = card('Sicherheitszeichen', hint('Form und Farbe verraten die Gruppe. Tippe ein Schild an für die Erklärung. Üben kannst du bei den Aufgaben und im Trainer.'));
    Object.keys(D.kat).forEach(k => {
      const K = D.kat[k];
      h += `<div class="card pl"><h4>${esc(K.name)}</h4><p style="margin:0 0 8px;line-height:1.4"><b>${esc(K.form)}</b>, ${esc(K.farbe)}. Sie ${esc(K.sinn)}.</p><div class="sgrid">` +
        D.signs.filter(s => s.kat === k).map(s => `<button class="sgcell" data-sg="${s.id}" aria-label="${esc(s.name)}">${sgn(s.id)}<small>${esc(s.name)}</small></button>`).join('') + '</div></div>';
    });
    $('#zeiView').innerHTML = h;
  }
  function signSheet(id) {
    const s = C.signById(id); if (!s) return; const K = D.kat[s.kat];
    sheet(s.name, b => { b.innerHTML = `<div class="sgbig">${sgn(id)}</div><p class="big" style="text-align:center">${esc(s.name)}</p><p style="margin:.4em 0"><b>Bedeutung:</b> ${esc(s.bed)}</p><div class="rdout"><b>${esc(K.name)}</b>: ${esc(K.form)}, ${esc(K.farbe)}. Sie ${esc(K.sinn)}.</div>`; });
  }

  /* ============================================================ Brandschutz */
  function renderBra() {
    const k = S.braKey, keys = D.brand.map(b => b.k).concat(['strom']), B = D.brand.find(b => b.k === k);
    let h = card('Brandklassen', `<table class="tt"><tr><th>Klasse</th><th>Stoffe</th></tr>${D.brand.map(b => `<tr><td><b>${b.k}</b></td><td>${esc(b.name)}<br><span class="hint2">${esc(b.bsp)}</span></td></tr>`).join('')}</table>`);
    h += `<div class="card pl"><h4>Was brennt? Welches Löschmittel?</h4><div class="ctl">${keys.map(x => `<button class="chip${x === k ? ' on' : ''}" data-bk="${x}">${x === 'strom' ? '⚡ Strom' : 'Klasse ' + x}</button>`).join('')}</div>`;
    h += `<p style="margin:6px 0;line-height:1.45">${B ? `<b>Klasse ${B.k}: ${esc(B.name)}</b> (${esc(B.bsp)}). ${esc(B.hint)}.` : '<b>Elektrische Anlage unter Spannung</b> (keine Brandklasse). Wenn gefahrlos möglich, zuerst abschalten. Nur Löschmittel verwenden, die keinen Strom leiten.'}</p>`;
    if (C.loeschOk('wasser', k) === 'nein' && ['D', 'F', 'strom'].indexOf(k) >= 0) h += '<div class="rdout bad"><b>Nie Wasser!</b> ' + (k === 'F' ? 'Fettexplosion: Wasser verdampft schlagartig im Fett und schleudert es als Stichflamme heraus.' : k === 'D' ? 'Wasser reagiert mit brennendem Metall heftig.' : 'Wasser leitet Strom: Lebensgefahr.') + '</div>';
    h += `<table class="tt"><tr><th>Löschmittel</th><th>Eignung</th></tr>${D.mittel.map(m => { const v = C.loeschOk(m.id, k); return `<tr><td>${esc(m.name)}</td><td class="${v}">${v === 'ja' ? '✓ geeignet' : v === 'bed' ? '⚠ nur bedingt (kleine Entstehungsbrände)' : '✗ ungeeignet'}</td></tr>`; }).join('')}</table>`;
    h += `<p class="hint2">${D.mittel.filter(m => C.loeschOk(m.id, k) !== 'nein').map(m => esc(D.grund[m.id])).join(' ')}</p></div>`;
    h += card('Verhalten im Brandfall', `<ol class="steps"><li><b>Ruhe bewahren</b></li><li><b>Brand melden</b>: Handfeuermelder drücken, Notruf <b>112</b> (Wo, Was, Wie viele, Welche, Warten)</li><li><b>In Sicherheit bringen</b>: Personen warnen, Hilfsbedürftigen helfen, Türen schließen, keinen Aufzug benutzen, zur Sammelstelle</li><li><b>Löschversuch</b> nur, wenn er ohne Eigengefahr möglich ist: Fluchtweg im Rücken, Brand noch klein, passender Löscher</li></ol><p class="hint2">Löscher einsetzen: Sicherungsstift ziehen, mit dem Wind löschen, auf die Basis der Flammen zielen, in Stößen. Mehrere Löscher gleichzeitig, nicht nacheinander. Benutzte Löscher immer melden und neu füllen lassen.</p>`);
    $('#braView').innerHTML = h;
  }

  /* ============================================================ Gefahrstoffe */
  function renderGhs() {
    let h = card('GHS-Piktogramme', hint('Auf Etiketten von Chemikalien stehen weiße Rauten mit rotem Rand. Tippe ein Piktogramm an.') + `<div class="sgrid" style="margin-top:10px">${D.ghs.map(g => `<button class="sgcell" data-gh="${g.id}" aria-label="${esc(g.id + ' ' + g.name)}">${sgn(g.id)}<small><b>${g.id}</b> ${esc(g.bed.split(':')[0].split(',')[0])}</small></button>`).join('')}</div>`);
    h += card('Signalwörter', `<table class="tt">${D.signal.map(s => `<tr><td><b>${s.w}</b></td><td>${esc(s.t)}</td></tr>`).join('')}</table>`);
    h += card('Das Etikett und das Sicherheitsdatenblatt', `<ul class="tl" style="list-style:disc;padding-left:20px"><li><b>Etikett:</b> Produktname, Piktogramme, Signalwort, H-Sätze, P-Sätze, Hersteller</li><li><b>H-Sätze</b> (Hazard) sind Gefahrenhinweise: H2.. physikalische Gefahren, H3.. Gesundheitsgefahren, H4.. Umweltgefahren</li><li><b>P-Sätze</b> (Precautionary) sind Sicherheitshinweise: P1.. allgemein, P2.. Vorsorge, P3.. Reaktion, P4.. Lagerung, P5.. Entsorgung</li><li><b>Sicherheitsdatenblatt (SDB):</b> 16 Abschnitte, z. B. mögliche Gefahren, Erste-Hilfe-Maßnahmen, Brandbekämpfung, Handhabung und Lagerung, Schutzausrüstung, Entsorgung</li><li><b>Betriebsanweisung:</b> sagt dir im Betrieb, wie du mit dem Stoff umgehst. Lies sie vor dem ersten Einsatz.</li></ul><p class="hint2">Du musst keine Nummern auswendig lernen. Wichtig ist das Prinzip: Etikett lesen, bei Unklarheit ins SDB schauen, im Zweifel den Ausbilder fragen.</p>`);
    $('#ghsView').innerHTML = h;
  }
  function ghsSheet(id) {
    const g = C.ghsById(id); if (!g) return;
    sheet(g.id + ' ' + g.name, b => { b.innerHTML = `<div class="sgbig">${sgn(id)}</div><p class="big" style="text-align:center">${esc(g.id)}: ${esc(g.name)}</p><p style="margin:.4em 0"><b>Bedeutung:</b> ${esc(g.bed)}</p><p style="margin:.4em 0"><b>Beispiele:</b> ${esc(g.bsp)}</p><p class="hint2">Welcher Stoff genau gemeint ist und welche Maßnahmen gelten, steht im Sicherheitsdatenblatt.</p>`; });
  }

  /* ============================================================ Gefährdungsbeurteilung */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  function pctFor(id) { if (!exam()) return 100; const st = lsGet('ctipps', {})[id] || 0; return Math.max(0, 100 - 25 * Math.min(2, st)); }
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    if (pct > 0) { const d = done(); d[id] = true; lsSet('done', d); }
    updateBadge(); updatePal();
  }
  function updateBadge() { const b = $('#tkBd'); if (!b) return; b.textContent = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length + '/' + TASKS.length; }
  const gbTask = wp => TASKS.find(t => t.gb === wp);

  function gbEditor(wp, ctx) {
    const W = D.gb[wp], sel = S.gb[wp] || {}, res = S.gbRes[wp];
    let h = `<div class="gbed" data-wp="${wp}" data-ctx="${ctx}"><p style="margin:0 0 8px;line-height:1.4">${esc(W.intro)} Wähle für jede Gefährdung die passenden Maßnahmen. Die Buchstaben zeigen die STOP-Gruppe. Manche Maßnahmen sind ungeeignet oder gefährlich.</p>`;
    W.gef.forEach((g, i) => {
      h += `<div class="gcard"><b>Gefährdung ${i + 1}: ${esc(g.k)}</b><div class="hint2" style="margin:2px 0 8px">${esc(g.t)}</div><div class="opts">` +
        g.opts.map(o => { const on = (sel[g.id] || []).indexOf(o.id) >= 0; return `<button data-go="${g.id}|${o.id}" class="${on ? 'on' : ''}" aria-pressed="${on}"><span class="stp s${o.stop}">${o.stop}</span>${esc(o.t)}</button>`; }).join('') + '</div></div>';
    });
    if (res) h += `<div class="fb ${res.ok ? 'ok' : 'bad'}"><div class="v">${res.ok ? '✓ Gut: alle Gefährdungen passend bearbeitet' : 'Noch nicht vollständig'} · ${res.pct} %</div><ul class="tl">${res.lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}</li>`).join('')}</ul></div>`;
    return h + `<div class="btns"><button class="btn pri" data-gb="chk">✓ Prüfen</button><button class="btn" data-gb="hint">💡 Tipp</button><button class="btn" data-gb="reset">Zurücksetzen</button></div></div>`;
  }
  function rerenderGb() { if (S.tab === 'gb') renderGb(); else if (S.tab === 'tasks') renderTasks(false); }
  function gbToggle(wp, gid, oid) {
    const s = S.gb[wp] = S.gb[wp] || {}, a = s[gid] = s[gid] || [], i = a.indexOf(oid); if (i >= 0) a.splice(i, 1); else a.push(oid);
    S.gbRes[wp] = null; rerenderGb();
  }
  function gbCheck(wp) {
    const r = S.gbRes[wp] = C.assessGB(wp, S.gb[wp]), t = gbTask(wp);
    if (r.ok) {
      const pct = t ? pctFor(t.id) : 100; if (t) markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (e) {} else ding();
      toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!');
    } else { sad(); toast('Noch nicht vollständig. Lies, was fehlt.'); }
    rerenderGb();
  }
  function gbHint(wp) {
    const t = gbTask(wp), h = lsGet('hints', {}), n = Math.min(2, (h[t.id] || 0) + 1), ex = exam();
    h[t.id] = Math.max(h[t.id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[t.id] = Math.max(c[t.id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 2', b => { b.innerHTML = `<p style="margin-top:0">${esc(C.gbTip(wp, S.gb[wp], n))}</p>` + (n < 2 ? '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“.</p>' : '') + (ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>'); });
  }
  function renderGb() {
    const steps = ['Arbeitsbereiche und Tätigkeiten festlegen', 'Gefährdungen ermitteln', 'Gefährdungen beurteilen (Wie schwer? Wie wahrscheinlich?)', 'Maßnahmen festlegen', 'Maßnahmen umsetzen', 'Wirksamkeit überprüfen', 'Ergebnis dokumentieren und fortschreiben'];
    let h = card('Ablauf der Gefährdungsbeurteilung', `<ol class="steps">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="hint2">Der Arbeitgeber ist verantwortlich. Du lernst hier, wie man vorgeht, und wo du selbst Gefährdungen erkennst und meldest.</p>`);
    h += card('STOP-Prinzip der Maßnahmen', svgStop() + `<table class="tt">${Object.keys(D.stop).map(k => `<tr><td><span class="stp s${k}">${k}</span></td><td><b>${esc(D.stop[k].name)}</b><br><span class="hint2">${esc(D.stop[k].text)}</span></td></tr>`).join('')}</table>`);
    h += `<div class="card pl"><h4>Mini-Gefährdungsbeurteilung</h4><div class="ctl">${D.gbOrder.map(w => `<button class="chip${w === S.gbWp ? ' on' : ''}" data-gbw="${w}">${esc(D.gb[w].name)}</button>`).join('')}</div>${gbEditor(S.gbWp, 'tab')}</div>`;
    $('#gbView').innerHTML = h;
  }

  /* ============================================================ PSA */
  function renderPsa() {
    const a = D.psa.find(x => x.id === S.psaAct), res = S.psaRes;
    let h = card('PSA zuordnen', `<p class="hint2" style="margin:0 0 6px">Wähle eine Tätigkeit und tippe alle nötigen Schutzmittel an.</p><div class="ctl">${D.psa.map(x => `<button class="chip${x.id === S.psaAct ? ' on' : ''}" data-pa="${x.id}">${esc(x.t)}</button>`).join('')}</div><div class="opts">${Object.keys(D.psaItems).map(k => { const on = S.psaSel.indexOf(k) >= 0; return `<button data-pi="${k}" class="${on ? 'on' : ''}" aria-pressed="${on}">${on ? '☑' : '☐'} ${esc(D.psaItems[k])}</button>`; }).join('')}</div><div class="btns"><button class="btn pri" data-pc="chk">✓ Prüfen</button></div>` +
      (res ? `<ul class="tl">${res.lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}</li>`).join('')}</ul>${res.ok ? `<div class="rdout ok">${esc(a.note)}</div>` : ''}` : ''));
    h += `<div class="hl">${details(D.seiten.psa, true)}</div>`;
    $('#psaView').innerHTML = h;
  }

  /* ============================================================ Erste Hilfe, Verhalten */
  function renderEh() { $('#ehView').innerHTML = `<div class="hl">${details(D.seiten.eh.slice(0, 2), true)}${svgKette()}${details(D.seiten.eh.slice(2), false)}</div>`; }
  function renderVer() { $('#verView').innerHTML = `<div class="hl">${details(D.seiten.ver, true)}</div>`; }

  /* ============================================================ Beispiele (Reiter "Beispiele", Aufruf ?bsp) */
  const BSP_INTRO = 'Fertige Beispiele zum Anschauen. „Ansehen“ zeigt das Beispiel durchgespielt, danach kannst du es im passenden Reiter selbst ausprobieren.';
  function renderBsp() {
    const V = $('#bspView');
    if (S.bsp != null && D.beispiele[S.bsp]) { V.innerHTML = bspDetail(D.beispiele[S.bsp]); return; }
    V.innerHTML = card('Beispiele', hint(BSP_INTRO)) + D.beispiele.map((b, i) => `<div class="card pl"><h4>${esc(b.titel)}</h4><p style="margin:0 0 4px;line-height:1.45">${esc(b.text)}</p><div class="btns"><button class="btn pri" data-bsp="${i}">Ansehen</button></div></div>`).join('');
  }
  function bspDetail(b) {
    let h = `<div class="card pl"><h4>${esc(b.titel)}</h4>`;
    const BD = D.beispielDaten;
    if (b.kind === 'gb') {
      const W = D.gb[b.wp]; h += `<p style="margin:0 0 8px">${esc(W.intro)} Jede Gefährdung bekommt Maßnahmen aus mehreren STOP-Gruppen. Unten stehen auch typische Fehler.</p>`;
      W.gef.forEach((g, i) => {
        h += `<div class="gcard"><b>Gefährdung ${i + 1}: ${esc(g.k)}</b><div class="hint2" style="margin:2px 0 6px">${esc(g.t)}</div><ul class="tl">` +
          ['S', 'T', 'O', 'P'].map(lv => g.opts.filter(o => o.ok && o.stop === lv).map(o => `<li class="ok"><span class="stp s${lv}">${lv}</span> ${esc(o.t)}</li>`).join('')).join('') +
          g.opts.filter(o => !o.ok).map(o => `<li class="bad">✗ ${esc(o.t)}</li>`).join('') + '</ul></div>';
      });
    } else if (b.kind === 'zeichen') {
      h += `<div class="sgbig">${sgn(b.sign)}</div><ul class="tl">${BD.zeichen.map(s => `<li><b>${esc(s[0])}:</b> ${esc(s[1])}</li>`).join('')}</ul>`;
    } else if (b.kind === 'brand') {
      const B = D.brand.find(x => x.k === b.klasse);
      h += `<p style="margin:0 0 8px">In der Kantine brennt Fett in einer Pfanne (Klasse ${B.k}: ${esc(B.name)}). Was tust du?</p><table class="tt"><tr><th>Löschmittel</th><th>Eignung</th></tr>${D.mittel.map(m => { const v = C.loeschOk(m.id, b.klasse); return `<tr><td>${esc(m.name)}</td><td class="${v}">${v === 'ja' ? '✓ geeignet' : '✗ ungeeignet'}</td></tr>`; }).join('')}</table><div class="rdout bad"><b>Nie Wasser:</b> Fettexplosion, Stichflamme bis zur Decke.</div><div class="rdout ok"><b>Richtig:</b> Herd abschalten (wenn gefahrlos), Deckel oder Löschdecke auflegen und liegen lassen, Fettbrandlöscher einsetzen, im Zweifel Alarm und 112. Das Fett erst nach dem Abkühlen anfassen.</div>`;
    } else if (b.kind === 'eh') {
      h += `<ol class="steps">${BD.eh.map(s => `<li><b>${esc(s[0])}:</b> ${esc(s[1])}</li>`).join('')}</ol><p class="hint2">Das ersetzt keinen Erste-Hilfe-Kurs.</p>`;
    } else if (b.kind === 'etikett') {
      const E = BD.etikett;
      h += `<div class="etik"><b class="big">${esc(E.stoff)}</b><div class="sgrow">${E.pics.map(p => sgn(p, 'm')).join('')}<span class="sig">${esc(E.signal)}</span></div><p style="margin:6px 0 2px"><b>Gefahrenhinweise (H):</b></p><ul class="tl">${E.h.map(x => `<li><b>${x[0]}</b> ${esc(x[1])}</li>`).join('')}</ul><p style="margin:6px 0 2px"><b>Sicherheitshinweise (P):</b></p><ul class="tl">${E.p.map(x => `<li><b>${x[0]}</b> ${esc(x[1])}</li>`).join('')}</ul></div><p style="margin:10px 0 4px"><b>Was folgt daraus?</b></p><ul class="tl">${E.folge.map(x => `<li>✓ ${esc(x)}</li>`).join('')}</ul>`;
    }
    h += `<div class="btns"><button class="btn" data-bsp="back">← Alle Beispiele</button><button class="btn pri" data-bsp="open">${b.kind === 'gb' ? 'In die Übung laden' : 'Im Reiter öffnen'}</button></div></div>`;
    return h;
  }
  function openBsp(b) {
    if (b.kind === 'gb') { S.gb[b.wp] = C.musterSel(b.wp); S.gbRes[b.wp] = null; S.gbWp = b.wp; }
    else if (b.kind === 'brand') S.braKey = b.klasse;
    setTab(b.tab);
    if (b.kind === 'zeichen') signSheet(b.sign);
    toast('Beispiel geladen: ' + b.titel);
  }

  /* ============================================================ Aufgaben */
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  const tq = t => S.pq[t.id] || (S.pq[t.id] = C.prep(t, C.rng(C.hash(t.id))));
  function checkTask(t) {
    const q = tq(t), a = S.tAns[t.id];
    if (q.multi ? !(a && a.length) : a == null) { toast('Wähle zuerst eine Antwort.'); return; }
    const ok = C.isRight(q, a), pct = ok ? pctFor(t.id) : 0, ex = exam();
    S.tRes = { id: t.id, ok, pct, show: ok || !ex };
    if (ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (e) {} else ding(); toast(ex && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast('Noch nicht richtig. Lies die Erklärung und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintTask(t) {
    const h = lsGet('hints', {}), n = Math.min(2, (h[t.id] || 0) + 1), ex = exam();
    h[t.id] = Math.max(h[t.id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[t.id] = Math.max(c[t.id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 2', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(t.tips[0])}</p>`;
      if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(t.tips[1])}</p>`; else x += '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“ für die nächste Stufe.</p>';
      x += ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const r = S.tRes && S.tRes.id === t.id ? S.tRes : null;
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>`;
      if (t.gb) {
        h += `<p style="margin:8px 0">${esc(t.text)}</p>${gbEditor(t.gb, 'task')}`;
        if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
        const gr = S.gbRes[t.gb];
        if (gr && gr.ok) h += `<div class="rdout ok">${esc(t.expl)}</div><div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`;
        h += '<div class="btns"><button class="btn" data-ta="close">Schließen</button></div>';
      } else {
        const q = tq(t), a = S.tAns[t.id];
        h += `<div data-ctx="task">${qBody(q, a, r)}</div>`;
        h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
        if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
        if (r) {
          h += `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig' : '✗ Das stimmt noch nicht.'}</li></ul>`;
          if (r.show) h += `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(solText(q))}<br>${esc(t.expl)}</div>`;
          else h += '<div class="rdout bad">🎓 Prüfmodus: Die Erklärung gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>';
          if (r.ok) h += '<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>';
        }
      }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : p > 0 ? 'p' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && !d[x.id] ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function startTask(id) {
    S.task = id; S.tAns = {}; S.tRes = null; const t = TASKS.find(x => x.id === id);
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    if (t && t.gb) { S.gb[t.gb] = {}; S.gbRes[t.gb] = null; }
    renderTasks();
  }

  /* ============================================================ Zufalls-Trainer */
  function newTrainer() { S.rtI++; S.rtQ = C.randomQuestion((S.rtSeed + S.rtI * 7919) >>> 0, S.rtCat || undefined); S.rtAns = null; S.rtRes = null; renderTrainer(); }
  S.rtSeed = (Date.now() % 2147483000) + 1;
  function renderTrainer() {
    if (!S.rtQ) { S.rtI++; S.rtQ = C.randomQuestion((S.rtSeed + S.rtI * 7919) >>> 0, S.rtCat || undefined); }
    const q = S.rtQ, r = S.rtRes, R = S.rt;
    let h = `<div class="stats"><div class="bx"><b>${R.n}</b>beantwortet</div><div class="bx"><b>${R.n ? Math.round(100 * R.ok / R.n) : 0} %</b>richtig</div><div class="bx"><b>${R.streak}</b>Serie</div><div class="bx"><b>${R.best}</b>Beste Serie</div></div>`;
    h += `<div class="ctl"><button class="chip s${S.rtCat ? '' : ' on'}" data-rc="">Alle</button>${D.cats.map(c => `<button class="chip s${S.rtCat === c ? ' on' : ''}" data-rc="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
    h += `<div class="card pl" data-ctx="rt"><h4>${esc(q.cat)}</h4>${qBody(q, S.rtAns, r)}<div class="btns"><button class="btn pri" data-ra="chk"${r ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="next">Nächste Frage</button></div>`;
    if (r) h += `<div class="fb ${r.ok ? 'ok' : 'bad'}"><div class="v">${r.ok ? '✓ Richtig' : '✗ Leider falsch'}</div></div><div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(solText(q))}<br>${esc(q.expl)}</div>`;
    $('#rtView').innerHTML = h + '</div>';
  }
  function checkTrainer() {
    const q = S.rtQ, a = S.rtAns;
    if (q.multi ? !(a && a.length) : a == null) { toast('Wähle zuerst eine Antwort.'); return; }
    const ok = C.isRight(q, a), R = S.rt; S.rtRes = { ok, show: true }; R.n++;
    if (ok) { R.ok++; R.streak++; if (R.streak > R.best) R.best = R.streak; ding(); } else { R.streak = 0; sad(); }
    lsSet('rt', R); updatePal(); renderTrainer();
  }

  /* ============================================================ Abschlussrunde */
  function renderFin() {
    const F = S.fin, V = $('#finView'), best = lsGet('fin', null); let h = '';
    if (F.state === 'intro') {
      h += card('Abschlussrunde', `<p style="margin:0 0 8px;line-height:1.5">20 gemischte Fragen aus allen Themen. Bestanden ist die Runde ab <b>${C.PASS_PCT} %</b> (16 von 20). Während der Runde gibt es keine Rückmeldung und keine Tipps; die Auswertung kommt am Ende. Bei „bestanden“ erzeugst du eine <b>Teilnahmebestätigung</b> als Textcode für deinen Ausbilder.</p><p class="hint2">Keine Daten werden übertragen. Die Bestätigung ist eine Übung und <b>ersetzt keine gesetzlich vorgeschriebene Unterweisung</b> durch den Arbeitgeber, sondern ergänzt sie.</p>${best ? `<p class="hint2">Bisher bestes Ergebnis: <b>${best.best} %</b>${best.date ? ' (' + esc(best.date) + ')' : ''}.</p>` : ''}<div class="btns"><button class="btn pri" data-fa="start">Runde starten</button></div>`);
      h += finCheckCard();
    } else if (F.state === 'run') {
      const q = F.qs[F.i], last = F.i === F.qs.length - 1, answered = F.ans.filter(a => a != null && (!Array.isArray(a) || a.length)).length;
      h += `<div class="card pl" data-ctx="fin"><h4>Frage ${F.i + 1} von ${F.qs.length} · ${esc(q.cat)}</h4><div class="bar"><i style="width:${Math.round(100 * (F.i + 1) / F.qs.length)}%"></i></div>${qBody(q, F.ans[F.i], null)}<div class="btns"><button class="btn" data-fa="prev"${F.i ? '' : ' disabled'}>← Zurück</button>${last ? '<button class="btn pri" data-fa="end">Abgeben</button>' : '<button class="btn pri" data-fa="next">Weiter →</button>'}</div><p class="hint2">${answered} von ${F.qs.length} beantwortet.</p></div>`;
    } else {
      const r = F.res;
      h += `<div class="card pl" style="border-color:${r.passed ? 'var(--ok)' : 'var(--danger)'}"><h4>Auswertung</h4><div class="big">${r.correct} von ${r.total} richtig = ${r.pct} %</div><p style="margin:4px 0"><span class="badge ${r.passed ? 'gut' : 'ausschuss'}">${r.passed ? 'Bestanden' : 'Nicht bestanden'}</span></p><p class="hint2">Bestanden ab ${C.PASS_PCT} %. Runde Nr. ${F.seed}.</p>`;
      if (r.passed) {
        h += `<div class="rdout ok"><b>Teilnahmebestätigung erstellen</b><label class="f" style="margin-top:8px"><span>Name</span><input id="finName" autocomplete="name" value="${esc(F.name)}" placeholder="Vor- und Nachname"></label><div class="btns"><button class="btn pri" data-fa="cert">Bestätigung erstellen</button></div></div>`;
        if (F.cert) h += `<pre class="cert" id="certTx">${esc(F.cert.text)}</pre><div class="btns"><button class="btn" data-fa="copy">📋 Kopieren</button></div><p class="hint2">Mach ein Foto oder schreibe den Code ab und zeige beides deinem Ausbilder. Die Prüfsumme erkennt Tippfehler beim Abschreiben; sie ist kein Fälschungsschutz. Es wurden keine Daten übertragen.</p>`;
      } else h += '<p style="margin:8px 0">Lies die Erklärungen unten und starte eine neue Runde. Sie enthält andere Fragen.</p>';
      h += `<div class="btns"><button class="btn${r.passed ? '' : ' pri'}" data-fa="start">Neue Runde</button><button class="btn" data-fa="intro">Zur Übersicht</button></div></div>`;
      if (r.wrong.length) h += `<div class="gh">Nochmal ansehen (${r.wrong.length})</div>` + r.wrong.map(i => { const q = F.qs[i]; return `<div class="card pl"><h4>${esc(q.cat)}</h4>${q.sign ? `<div class="sgbig s">${sgn(q.sign)}</div>` : ''}<p style="margin:0 0 6px;line-height:1.4">${esc(q.text)}</p><div class="rdout"><b>Richtig:</b> ${esc(solText(q))}<br>${esc(q.expl)}</div></div>`; }).join('');
      h += finCheckCard();
    }
    V.innerHTML = h;
  }
  function finCheckCard() {
    return card('Code prüfen (für Ausbilder)', `<p class="hint2" style="margin:0 0 6px">Gib den Code einer Teilnahmebestätigung ein. Die Prüfsumme zeigt, ob Name, Datum und Prozent beim Abschreiben unverändert sind.</p><div class="qin"><input id="finChk" autocomplete="off" autocapitalize="characters" placeholder="ARB1-…" value="${esc(S.fin.chk)}"><button class="btn" data-fa="verify">Prüfen</button></div><div id="finChkOut"></div>`);
  }
  function startFin() { const F = S.fin; F.seed = (Date.now() % 2147483000) + 1; F.qs = C.buildExam(F.seed); F.ans = F.qs.map(() => null); F.i = 0; F.res = null; F.cert = null; F.state = 'run'; renderFin(); $('#pgFin').scrollTop = 0; }
  function endFin() {
    const F = S.fin; F.res = C.scoreExam(F.qs, F.ans); F.state = 'res';
    const b = lsGet('fin', { best: 0 }); b.last = F.res.pct; if (F.res.pct >= (b.best || 0)) { b.best = F.res.pct; b.date = C.deDate(new Date()); } lsSet('fin', b);
    if (F.res.passed) { const f = fx(); if (f && f.pass) try { f.pass(100); } catch (e) {} else ding(); } else sad();
    renderFin(); $('#pgFin').scrollTop = 0;
  }

  /* ============================================================ Hilfe */
  function renderHelp() { $('#helpView').innerHTML = details(D.help, true); }

  /* ============================================================ Ereignisse */
  function pickAnswer(q, cur, i) { if (q.multi) { const a = (cur || []).slice(), k = a.indexOf(i); if (k >= 0) a.splice(k, 1); else a.push(i); return a; } return i; }
  $('#mid').addEventListener('input', e => { if (e.target.id === 'finName') S.fin.name = e.target.value; else if (e.target.id === 'finChk') S.fin.chk = e.target.value; });
  $('#mid').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'finChk') { e.preventDefault(); verifyIn(); } });
  function verifyIn() {
    const v = C.verifyCode(S.fin.chk), o = $('#finChkOut'); if (!o) return;
    o.innerHTML = v.ok ? `<div class="rdout ok"><b>Prüfsumme stimmt.</b> Name (Kennung): ${esc(v.name)}, Datum: ${esc(v.date)}, Ergebnis: ${v.pct} % (${v.passed ? 'bestanden' : 'nicht bestanden'}).</div>` : `<div class="rdout bad"><b>Prüfsumme stimmt nicht</b> (${esc(v.reason)}). Tippfehler? Bitte den Code genau abschreiben.</div>`;
  }
  $('#mid').addEventListener('click', e => {
    const g = s => e.target.closest(s);
    let x;
    if ((x = g('[data-sg]'))) return signSheet(x.dataset.sg);
    if ((x = g('[data-gh]'))) return ghsSheet(x.dataset.gh);
    if ((x = g('[data-bk]'))) { S.braKey = x.dataset.bk; return renderBra(); }
    if ((x = g('[data-gbw]'))) { S.gbWp = x.dataset.gbw; return renderGb(); }
    if ((x = g('[data-go]'))) { const w = g('[data-wp]'), p = x.dataset.go.split('|'); return gbToggle(w.dataset.wp, p[0], p[1]); }
    if ((x = g('[data-gb]'))) { const w = g('[data-wp]').dataset.wp, a = x.dataset.gb; if (a === 'chk') gbCheck(w); else if (a === 'hint') gbHint(w); else { S.gb[w] = {}; S.gbRes[w] = null; rerenderGb(); } return; }
    if ((x = g('[data-pa]'))) { S.psaAct = x.dataset.pa; S.psaSel = []; S.psaRes = null; return renderPsa(); }
    if ((x = g('[data-pi]'))) { const k = x.dataset.pi, i = S.psaSel.indexOf(k); if (i >= 0) S.psaSel.splice(i, 1); else S.psaSel.push(k); S.psaRes = null; return renderPsa(); }
    if ((x = g('[data-pc]'))) { S.psaRes = C.assessPsa(S.psaAct, S.psaSel); S.psaRes.ok ? ding() : sad(); return renderPsa(); }
    if ((x = g('[data-bsp]'))) { const v = x.dataset.bsp; if (v === 'back') S.bsp = null; else if (v === 'open') return openBsp(D.beispiele[S.bsp]); else S.bsp = +v; renderBsp(); $('#pgBsp').scrollTop = 0; return; }
    if ((x = g('[data-c]'))) {
      const ctx = g('[data-ctx]'); if (!ctx) return; const i = +x.dataset.c, c = ctx.dataset.ctx;
      if (c === 'task') { const t = curTask(), q = tq(t); S.tAns[t.id] = pickAnswer(q, S.tAns[t.id], i); if (S.tRes && !S.tRes.ok) S.tRes = null; return renderTasks(false); }
      if (c === 'rt') { if (S.rtRes) return; S.rtAns = pickAnswer(S.rtQ, S.rtAns, i); return renderTrainer(); }
      if (c === 'fin') { const F = S.fin; F.ans[F.i] = pickAnswer(F.qs[F.i], F.ans[F.i], i); return renderFin(); }
    }
    if ((x = g('[data-ta]'))) {
      const t = curTask(), a = x.dataset.ta; if (!t) return;
      if (a === 'chk') checkTask(t); else if (a === 'hint') hintTask(t); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); }
      else if (a === 'next') { const i = TASKS.findIndex(y => y.id === t.id), nx = TASKS.slice(i + 1).find(y => !done()[y.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); }
      return;
    }
    if ((x = g('.row[data-t]'))) return startTask(x.dataset.t);
    if ((x = g('[data-rc]'))) { S.rtCat = x.dataset.rc; return newTrainer(); }
    if ((x = g('[data-ra]'))) { if (x.dataset.ra === 'chk') checkTrainer(); else newTrainer(); return; }
    if ((x = g('[data-fa]'))) {
      const F = S.fin, a = x.dataset.fa;
      if (a === 'start') startFin(); else if (a === 'intro') { F.state = 'intro'; renderFin(); }
      else if (a === 'prev') { F.i = Math.max(0, F.i - 1); renderFin(); } else if (a === 'next') { F.i = Math.min(F.qs.length - 1, F.i + 1); renderFin(); $('#pgFin').scrollTop = 0; }
      else if (a === 'end') { const open = F.ans.filter(v => v == null || (Array.isArray(v) && !v.length)).length; if (open && !F.warned) { F.warned = true; toast(open + ' Frage(n) noch offen. Tippe noch einmal auf „Abgeben“, um trotzdem abzugeben.'); return; } F.warned = false; endFin(); }
      else if (a === 'cert') { const nm = (F.name || '').trim(); if (!nm) { toast('Bitte zuerst deinen Namen eintragen.'); return; } F.cert = C.certText({ name: nm, date: new Date(), correct: F.res.correct, total: F.res.total }); renderFin(); }
      else if (a === 'copy') { if (F.cert) copyText(F.cert.text); }
      else if (a === 'verify') verifyIn();
    }
  });
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });

  /* ============================================================ Rahmen: Tabs, Prüfmodus, Menü */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  const RENDER = { zei: renderZei, bra: renderBra, ghs: renderGhs, gb: renderGb, psa: renderPsa, eh: renderEh, ver: renderVer, bsp: renderBsp, tasks: renderTasks, rt: renderTrainer, fin: renderFin, help: renderHelp };
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'zei'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'bsp') S.bsp = null; RENDER[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Arbeitsschutz-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Arbeitsschutz-Lab: ' + T[2];
    const act = $('.tab.on'); if (act && act.scrollIntoView) try { act.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); updatePal(); $('#bExam').classList.toggle('on', on); $('#bExam').setAttribute('aria-pressed', on); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n, S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Frage im Trainer">🎲 Zufallsfrage</button>
      <span id="stat">Aufgaben gelöst <b>${n}/${TASKS.length}</b> · Serie <b>${S.rt.streak}</b> · Beste Serie <b>${S.rt.best}</b></span>`;
    $('#bExam').classList.toggle('on', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { setTab('rt'); newTrainer(); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('zei');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Fragen mit Serien-Zähler'], ['fin', 'Abschlussrunde', '20 Fragen, bestanden ab 80 %, mit Teilnahmebestätigung'], ['bsp', 'Beispiele', 'Fertige Beispiele zum Ansehen'], ['help', 'Hilfe und Spickzettel', 'Zeichenformen, Brandklassen, STOP'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps, die Trainer-Serie und das beste Ergebnis der Abschlussrunde dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt', 'fin'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.task = null; S.tRes = null; S.fin.state = 'intro'; palSig = ''; updatePal(); updateBadge(); RENDER[S.tab](); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.ARB_LAB = { id: 'arb', title: 'Arbeitsschutz-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.ARB_TASKS };

  buildTabs(); updatePal(); setTab(S.tab);
  /* Aufruf ?aufgabe=arb1 (Startseite, Lernhefte): Aufgabe gleich öffnen */
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
  /* Aufruf ?bsp: gleich die Beispielauswahl zeigen */
  try { const qb = new URLSearchParams(location.search); if (qb.has('bsp') && !qb.get('aufgabe')) { setTab('bsp'); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
