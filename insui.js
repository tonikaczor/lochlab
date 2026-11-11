'use strict';
/* Tonfunk Instandhaltungs-Lab: Oberfläche (Lab-Kennung 'ins').
   Reiter: Grundbegriffe, Fehlersuche (Prüfplatz), Schmierung, Schäden, Kennzahlen, Wartungsplan, Sicherheit, Aufgaben, Trainer, Hilfe.
   Module: insdata.js (INS_DATA, INS_TASKS), inscore.js (INS_CORE, Logik und Szenario-Engine).
   Speicher (Präfix lm4.ins.): tab, done ({id:true} nur gelöste), prog ({id:Prozent}), hints ({id:höchste Stufe}), ctipps ({id:Stufe} nur im Prüfmodus),
   exam ('1' = Prüfmodus), rt (Serie: n, ok, streak, best), diag ({szenario:{n,best}}), plan ({n,ok}), kc (Rechner-Eingaben).
   Tipp-Abzug (25 % je Stufe) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Die Fehlersuche zeigt vor der Abgabe nur C.view() und das Log, nie den Fehler. */
(function (root) {
  const C = root.INS_CORE, D = root.INS_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.ins.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const eur = v => C.fmtDe(v, v % 1 ? 2 : 0) + ' €';
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

  if (!C || !D) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Instandhaltungs-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">insdata.js oder inscore.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['begr', '📚', 'Grundbegriffe'], ['diag', '🔍', 'Fehlersuche'], ['schm', '🛢️', 'Schmierung'], ['scha', '🔧', 'Schäden'], ['kenn', '📊', 'Kennzahlen'], ['plan', '📅', 'Wartungsplan'], ['sich', '🦺', 'Sicherheit'], ['bsp', '💡', 'Beispiele'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const VIEW = { begr: 'begrView', diag: 'diagView', schm: 'schmView', scha: 'schaView', kenn: 'kennView', plan: 'planView', sich: 'sichView', tasks: 'taskView', rt: 'rtView', help: 'helpView' };
  const QCAT = { begr: 'Begriffe', schm: 'Schmierung', scha: 'Schäden', sich: 'Sicherheit', kenn: 'Kennzahlen' };
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();
  const S = {
    tab: lsGet('tab', 'begr'),
    diag: { sid: null, st: null, mode: 'play', cause: null, meas: null, res: null, task: null, tip: 0 },
    qz: {}, kenLv: 2, rtc: { cat: 'mixed', level: 2 },
    kc: Object.assign({ b: '1200', n: '6', r: '14', rn: '4', m1: '200', m2: '8', st: '6', kh: '450', pe: '2', rh: '5', lo: '48', te: '320' }, lsGet('kc', {})),
    plan: { lv: 2, p: null, sel: null, res: null }, planStat: Object.assign({ n: 0, ok: 0 }, lsGet('plan', {})),
    task: null, tAns: {}, tRes: null, tPlan: null,
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {})), dstat: lsGet('diag', {}),
    cover: false, uncovered: {}
  };
  if (!TABS.some(t => t[0] === S.tab)) S.tab = 'begr';

  /* ============================================================ SVG: Schadensbilder */
  /* Bauteil und Marke; feste Zufallspunkte, damit das Bild stabil bleibt */
  const PT = [[.12, .3], [.27, .72], [.41, .22], [.55, .64], [.68, .35], [.8, .78], [.9, .28], [.2, .52], [.62, .15], [.35, .85], [.74, .55], [.47, .45], [.06, .8], [.95, .6], [.52, .88]];
  function svgDamage(kind, mark) {
    let s = '';
    const strip = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#cfd6de" stroke="#6f7b88"/>`;
    if (kind === 'bearing') {
      s += '<circle cx="78" cy="88" r="62" fill="#b3bcc7" stroke="#6f7b88" stroke-width="1.5"/><circle cx="78" cy="88" r="44" fill="#e5e9ee" stroke="#6f7b88"/><circle cx="78" cy="88" r="26" fill="#b3bcc7" stroke="#6f7b88" stroke-width="1.5"/><circle cx="78" cy="88" r="12" fill="#8d99a6"/>';
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; s += `<circle cx="${78 + 35 * Math.cos(a)}" cy="${88 + 35 * Math.sin(a)}" r="8" fill="#e8ecf0" stroke="#6f7b88"/>`; }
      s += strip(160, 50, 130, 76) + '<text x="225" y="40" text-anchor="middle" class="sv-lab">Laufbahn (Ausschnitt)</text>';
      if (mark === 'pits') PT.forEach((p, i) => { s += `<circle cx="${172 + p[0] * 106}" cy="${72 + p[1] * 32}" r="${2.4 + (i % 3) * .8}" fill="#2b3138"/>`; });
      if (mark === 'burn') s += '<rect x="162" y="70" width="126" height="36" fill="#b8742a" opacity=".55"/><rect x="190" y="74" width="70" height="28" fill="#2d58a8" opacity=".45"/><path d="M170 84q20-8 40 0t40 0t36 0" stroke="#3b2a14" stroke-width="3" fill="none" opacity=".7"/>';
      if (mark === 'dirt') PT.forEach((p, i) => { const x = 166 + p[0] * 118, y = 56 + p[1] * 64; s += `<line x1="${x}" y1="${y}" x2="${x + 9}" y2="${y + 4 - (i % 3) * 3}" stroke="#3a424c" stroke-width="1.4"/><circle cx="${x + 3}" cy="${y + 8}" r="1.6" fill="#2b3138"/>`; });
      if (mark === 'rust') for (let i = 0; i < 5; i++) s += `<ellipse cx="${186 + i * 24}" cy="88" rx="8" ry="14" fill="#b4531a" opacity=".8"/>`;
      if (mark === 'off') s += '<path d="M162 58l126 18l0 16l-126-18z" fill="#2b3138" opacity=".75"/>';
      if (mark === 'dents') for (let i = 0; i < 5; i++) s += `<ellipse cx="${184 + i * 24}" cy="88" rx="7" ry="10" fill="#4a535e" stroke="#2b3138"/>`;
    } else if (kind === 'gear') {
      for (let i = 0; i < 6; i++) {
        const x = 10 + i * 24; let tw = mark === 'worn' ? 6 : 10, top = mark === 'worn' ? 74 : 70;
        if (mark === 'broken' && i === 2) { s += `<polygon points="${x},118 ${x + 20},118 ${x + 17},104 ${x + 11},100 ${x + 6},106" fill="#cfd6de" stroke="#6f7b88"/>`; continue; }
        s += `<polygon points="${x},118 ${x + 20},118 ${x + 10 + tw / 2},${top} ${x + 10 - tw / 2},${top}" fill="#cfd6de" stroke="#6f7b88"/>`;
      }
      s += '<rect x="6" y="118" width="148" height="14" fill="#b3bcc7" stroke="#6f7b88"/><text x="80" y="60" text-anchor="middle" class="sv-lab">Zähne (Seitenansicht)</text>';
      s += strip(176, 50, 112, 76) + '<text x="232" y="40" text-anchor="middle" class="sv-lab">Zahnflanke</text>';
      if (mark === 'scuff') for (let i = 0; i < 8; i++) s += `<line x1="184" y1="${58 + i * 8}" x2="282" y2="${66 + i * 8}" stroke="#7a5b2a" stroke-width="2" opacity=".8"/>`;
      if (mark === 'edge') s += '<rect x="178" y="52" width="22" height="72" fill="#f4f6f8"/><rect x="200" y="52" width="86" height="72" fill="#9aa5b1" opacity=".55"/>';
      if (mark === 'worn') s += '<rect x="178" y="52" width="108" height="72" fill="#9aa5b1" opacity=".6"/><circle cx="215" cy="85" r="2" fill="#2b3138"/><circle cx="250" cy="100" r="2" fill="#2b3138"/><circle cx="238" cy="70" r="1.6" fill="#2b3138"/>';
      if (mark === 'broken') s += '<polygon points="178,124 190,100 200,110 214,88 226,98 240,76 252,86 268,70 286,76 286,124" fill="#e8ecf0" stroke="#2b3138" stroke-width="1.6"/><text x="232" y="116" text-anchor="middle" class="sv-lab" style="font-size:10px">Bruchfläche</text>';
    } else if (kind === 'belt') {
      const side = mark === 'oneside' ? 'M30 60h90l-14 52h-62z' : 'M30 60h90l-14 52h-62z';
      s += `<path d="${side}" fill="#3a3f46" stroke="#1b2128" stroke-width="1.5"/><text x="75" y="48" text-anchor="middle" class="sv-lab">Querschnitt</text>`;
      if (mark === 'glaze') s += '<path d="M34 64l-10 40M116 64l10 40" stroke="#dfe6ee" stroke-width="3" opacity=".85" transform="translate(7 0)"/><path d="M40 64l-7 40" stroke="#fff" stroke-width="2" opacity=".6" transform="translate(10 0)"/>';
      if (mark === 'oneside') s += '<path d="M30 60l18 52h-16z" fill="#e8ecf0" opacity=".92"/><path d="M30 60l10 30l8 22" stroke="#ff9f1c" stroke-width="2" fill="none"/>';
      s += strip(150, 62, 140, 46).replace('fill="#cfd6de"', 'fill="#3a3f46"') + '<text x="220" y="52" text-anchor="middle" class="sv-lab">Draufsicht</text>';
      for (let i = 0; i < 7; i++) s += `<line x1="${158 + i * 19}" y1="64" x2="${158 + i * 19}" y2="106" stroke="#5c646e" stroke-width="2"/>`;
      if (mark === 'glaze') s += '<rect x="152" y="66" width="136" height="8" fill="#fff" opacity=".35"/>';
      if (mark === 'torn') s += '<polygon points="214,62 224,76 214,86 226,98 218,108 232,108 232,62" fill="#e8ecf0"/><path d="M214 62l10 14l-10 10l12 12l-8 10" stroke="#ff9f1c" stroke-width="2" fill="none"/><path d="M210 80q8 6 18 2M212 94q10 2 18-4M210 70q10 4 20-2" stroke="#d0c7a8" stroke-width="1.6" fill="none"/>';
    } else if (kind === 'seal') {
      s += '<rect x="10" y="78" width="200" height="30" fill="#cfd6de" stroke="#6f7b88"/><text x="110" y="68" text-anchor="middle" class="sv-lab">Welle</text>';
      s += '<rect x="100" y="108" width="40" height="32" fill="#b3bcc7" stroke="#6f7b88"/><path d="M104 108l16-14l16 14z" fill="#2b3138" stroke="#1b2128"/>';
      s += '<text x="250" y="64" text-anchor="middle" class="sv-lab">Dichtlippe</text><path d="M214 124l30-22l14 18z" fill="#2b3138" stroke="#1b2128" transform="translate(0 -4)"/>';
      if (mark === 'cracked') s += '<path d="M228 112l5 6l-4 6l6 5M240 108l3 8l-4 5" stroke="#e8ecf0" stroke-width="1.6" fill="none"/><path d="M110 100l4 4l-3 4" stroke="#e8ecf0" stroke-width="1.4" fill="none"/>';
      if (mark === 'groove') s += '<rect x="106" y="78" width="28" height="7" fill="#4a535e"/><circle cx="112" cy="95" r="2" fill="#7a5b2a"/><circle cx="123" cy="97" r="1.6" fill="#7a5b2a"/><circle cx="131" cy="94" r="2" fill="#7a5b2a"/><text x="120" y="152" text-anchor="middle" class="sv-lab" style="font-size:10px">Rille</text>';
    }
    return `<svg viewBox="0 0 300 160" style="width:100%;max-width:420px;height:auto;display:block;margin:0 auto" role="img" aria-label="Skizze: ${esc(kind === 'bearing' ? 'Wälzlager' : kind === 'gear' ? 'Zahnrad' : kind === 'belt' ? 'Riemen' : 'Dichtung')}, Schadensbild">${s}</svg>`;
  }
  const dmgSvg = d => svgDamage(d.svg[0], d.svg[1]);

  /* ============================================================ Fragen (gemeinsamer Baustein) */
  function qInner(q, ans, res, reveal) {
    const locked = !!res && (res.ok || reveal), show = !!res && (res.ok || reveal);
    let h = '';
    const sv = q.dmg ? D.schaeden.find(x => x.id === q.dmg).svg : q.svg; if (sv) h += `<div class="inst">${svgDamage(sv[0], sv[1])}</div>`;
    h += `<p class="qt">${esc(q.text)}</p>`;
    if (q.type === 'choice') {
      h += `<div class="opts">${q.choices.map((c, i) => `<button data-qc="${i}" ${locked ? 'disabled' : ''} class="${show && i === q.correct ? 'ok' : ans.c === i ? (res && !res.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    } else if (q.type === 'multi') {
      const m = ans.m || [];
      h += `<p class="hint2">Mehrere Antworten sind richtig.</p><div class="opts">${q.choices.map((c, i) => `<button data-qm="${i}" ${locked ? 'disabled' : ''} aria-pressed="${m.includes(i)}" class="${show && q.correct.includes(i) ? 'ok' : m.includes(i) ? (show || (res && !res.ok) ? 'bad' : 'on') : ''}">${m.includes(i) ? '☑' : '☐'} ${esc(c)}</button>`).join('')}</div>`;
    } else if (q.type === 'match') {
      const a = ans.a || [];
      h += `<div class="mt">${q.items.map((it, i) => `<div class="mrow ${res && res.per ? (res.per[i] ? 'ok' : 'bad') : ''}"><span>${esc(it)}</span><select data-qs="${i}" ${locked ? 'disabled' : ''} aria-label="Zuordnung ${i + 1}"><option value="-1">– wählen –</option>${q.options.map((o, j) => `<option value="${j}" ${a[i] === j ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`).join('')}</div>`;
    } else if (q.type === 'num') {
      h += `<label class="f"><span>${esc(q.label || 'Dein Ergebnis')} (${esc(q.unit)})</span><div class="qin"><input data-qn="1" inputmode="decimal" autocomplete="off" value="${esc(ans.v || '')}" ${locked ? 'disabled' : ''}><span class="u">${esc(q.unit)}</span></div></label>`;
    }
    return h;
  }
  /* Antwort ändern; true = neu zeichnen */
  function qClick(e, q, ans) {
    const c = e.target.closest('[data-qc]'), m = e.target.closest('[data-qm]');
    if (c) { ans.c = +c.dataset.qc; return true; }
    if (m) { const i = +m.dataset.qm, a = ans.m || (ans.m = []); const k = a.indexOf(i); if (k >= 0) a.splice(k, 1); else a.push(i); return true; }
    return false;
  }
  function qChange(e, q, ans) {
    const s = e.target.closest('[data-qs]'); if (s) { const a = ans.a || (ans.a = new Array(q.items.length).fill(-1)); a[+s.dataset.qs] = +s.value; return true; }
    return false;
  }
  function qFeedback(q, res, reveal) {
    if (!res) return '';
    if (res.empty) return '';
    let t = res.ok ? '<span class="v">✓ Richtig!</span>' : '<span class="v">✗ Noch nicht richtig.</span>';
    if (!res.ok && q.type === 'multi') t += ` Gewählt: ${res.wrongSel.length ? res.wrongSel.length + ' falsche' : 'keine falsche'}, ${res.missing.length ? res.missing.length + ' richtige fehlen' : 'nichts fehlt'}.`;
    if (!res.ok && q.type === 'match') t += ` ${res.per.filter(Boolean).length} von ${res.per.length} Zuordnungen stimmen.`;
    if (!res.ok && q.type === 'num') t += ` Du hast ${C.fAny(res.given)} ${esc(q.unit)}.`;
    return t;
  }

  /* ============================================================ Quiz-Karten in den Reitern und im Trainer */
  const statBoxes = () => `<div class="stats"><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div><div class="bx"><b>${S.rt.ok}/${S.rt.n}</b>Richtig</div></div>`;
  function newQ(key) {
    const cat = key === 'rt' ? S.rtc.cat : QCAT[key], lv = key === 'kenn' ? S.kenLv : key === 'rt' ? S.rtc.level : undefined;
    S.qz[key] = { q: C.genQuick(R0, cat, lv), ans: {}, res: null };
  }
  function quizInner(key) {
    if (!S.qz[key]) newQ(key); const z = S.qz[key], q = z.q;
    let h = statBoxes() + qInner(q, z.ans, z.res, true);
    if (z.res) {
      h += `<div class="fb ${z.res.ok ? 'ok' : 'bad'}">${qFeedback(q, z.res, true)}${z.res.ok ? '' : ' Richtig ist: <b>' + esc(C.solutionText(q)) + '</b>.'}</div><div class="rdout ${z.res.ok ? 'ok' : 'bad'}">${esc(q.expl)}</div><div class="btns"><button class="btn pri" data-qa="next">Nächste Frage</button></div>`;
    } else h += '<div class="btns"><button class="btn pri" data-qa="chk">✓ Prüfen</button></div>';
    return h;
  }
  const quizCard = (key, title) => `<div class="card pl" data-quiz="${key}"><h4>${esc(title || 'Üben')}</h4>${quizInner(key)}</div>`;
  function quizCheck(key) {
    const z = S.qz[key]; if (z.res) return;
    const r = C.checkQ(z.q, z.ans); if (r.empty) { toast('Bitte zuerst antworten.'); return; }
    z.res = r; const st = S.rt; st.n++; if (r.ok) { st.ok++; st.streak++; st.best = Math.max(st.best, st.streak); } else st.streak = 0; lsSet('rt', st);
    if (r.ok) ding(); else sad(); updatePal();
    if (r.ok && st.streak > 0 && st.streak % 5 === 0) { toast('🔥 ' + st.streak + ' richtige in Folge!'); const F = fx(); if (F && F.pass) try { F.pass(100); } catch (e) {} }
  }
  function bindQuiz(view) {
    const refresh = el => { const key = el.dataset.quiz; el.innerHTML = el.querySelector('h4').outerHTML + quizInner(key); };
    view.addEventListener('click', e => {
      const card = e.target.closest('[data-quiz]'); if (!card) return; const key = card.dataset.quiz; if (!S.qz[key]) return; const z = S.qz[key];
      if (z.res) { if (e.target.closest('[data-qa=next]')) { newQ(key); refresh(card); } return; }
      if (e.target.closest('[data-qa=chk]')) { quizCheck(key); refresh(card); return; }
      if (qClick(e, z.q, z.ans)) refresh(card);
    });
    view.addEventListener('change', e => { const card = e.target.closest('[data-quiz]'); if (!card) return; const z = S.qz[card.dataset.quiz]; if (z && !z.res) qChange(e, z.q, z.ans); });
    view.addEventListener('input', e => { const card = e.target.closest('[data-quiz]'); if (!card || !e.target.dataset.qn) return; const z = S.qz[card.dataset.quiz]; if (z && !z.res) z.ans.v = e.target.value; });
    view.addEventListener('keydown', e => { const card = e.target.closest('[data-quiz]'); if (!card || e.key !== 'Enter' || !e.target.dataset.qn) return; e.preventDefault(); const key = card.dataset.quiz, z = S.qz[key]; if (z.res) newQ(key); else quizCheck(key); refresh(card); });
  }

  /* ============================================================ Grundbegriffe */
  function svgOverview() {
    const box = (x, y, w, t, c) => `<rect x="${x}" y="${y}" width="${w}" height="44" rx="8" fill="${c}" opacity=".9"/><text x="${x + w / 2}" y="${y + 27}" text-anchor="middle" style="fill:#fff;font-size:13px;font-weight:700">${t}</text>`;
    return `<svg viewBox="0 0 480 130" style="width:100%;max-width:560px;height:auto;display:block;margin:6px auto" role="img" aria-label="Instandhaltung besteht aus Wartung, Inspektion, Instandsetzung und Verbesserung"><rect x="4" y="4" width="472" height="122" rx="12" fill="none" stroke="var(--mute)" stroke-dasharray="5 4"/><text x="240" y="26" text-anchor="middle" class="sv-lab" style="font-weight:700">Instandhaltung (DIN 31051)</text>${box(14, 50, 108, 'Wartung', '#1a6fd4')}${box(130, 50, 108, 'Inspektion', '#2d8a4e')}${box(246, 50, 108, 'Instandsetzung', '#b3591a')}${box(362, 50, 104, 'Verbesserung', '#7a4fb3')}<text x="68" y="112" text-anchor="middle" class="sv-lab m" style="font-size:10.5px">Verschleiß bremsen</text><text x="184" y="112" text-anchor="middle" class="sv-lab m" style="font-size:10.5px">Zustand feststellen</text><text x="300" y="112" text-anchor="middle" class="sv-lab m" style="font-size:10.5px">wieder funktionsfähig</text><text x="414" y="112" text-anchor="middle" class="sv-lab m" style="font-size:10.5px">sicherer machen</text></svg>`;
  }
  function renderBegr() {
    $('#begrView').innerHTML = `<div class="card pl"><h4>Instandhaltung nach DIN 31051</h4>${svgOverview()}
      <p class="hint2">Instandhaltung heißt: eine Maschine funktionsfähig halten. Dafür gibt es vier Teile. Die Begriffe stammen aus der DIN 31051; den genauen Wortlaut bitte in der Norm nachlesen.</p>
      <div class="cols">${D.begriffe.map(b => `<div class="card pl" style="margin:0"><h4>${esc(b.name)}</h4><p style="margin:0 0 6px">${esc(b.def)}</p><p class="hint2" style="margin:0"><b>Beispiele:</b> ${esc(b.bsp)}</p></div>`).join('')}</div></div>
      <div class="card pl"><h4>Instandhaltungsstrategien</h4><div class="cols l3">${D.strategien.map(s => `<div class="card pl" style="margin:0"><h4>${esc(s.long)}</h4><p style="margin:0 0 6px">${esc(s.was)}</p><p class="hint2" style="margin:0"><span class="okc">+ Vorteil:</span> ${esc(s.vor)}</p><p class="hint2" style="margin:4px 0 0"><span class="badc">− Nachteil:</span> ${esc(s.nach)}</p><p class="hint2" style="margin:4px 0 0"><b>Beispiel:</b> ${esc(s.bsp)}</p></div>`).join('')}</div></div>
      ${quizCard('begr', 'Zuordnen üben: Begriffe und Strategien')}`;
  }

  /* ============================================================ Schmierung */
  function renderSchm() {
    const cov = S.cover;
    $('#schmView').innerHTML = `<div class="card pl"><h4>Schmierstoffarten</h4><div class="cols l3">${D.schmier.map(s => `<div class="card pl" style="margin:0"><h4>${esc(s.name)}</h4><p style="margin:0 0 6px">${esc(s.eig)}</p><p class="hint2" style="margin:0"><b>Einsatz:</b> ${esc(s.einsatz)}</p></div>`).join('')}</div>
      <p style="margin:10px 0 4px"><b>Aufgaben der Schmierung</b></p><ul class="ul">${D.schmierAufgaben.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>
      <div class="card pl"><h4>Schmierplan lesen (Beispiel: Fräsmaschine)</h4>
      <p class="hint2" style="margin:0 0 8px">Ein Schmierplan sagt, was wo wann in welcher Menge geschmiert wird. Mit „Schmierstoff abdecken“ übst du: Tippe auf ein verdecktes Feld, um es aufzudecken.</p>
      <div class="ctl"><button class="chip ${cov ? 'on' : ''}" data-cov="1" aria-pressed="${cov}">Schmierstoff abdecken</button></div>
      <div style="overflow-x:auto"><table class="tt"><tr><th>Schmierstelle</th><th>Schmierstoff</th><th>Intervall</th><th>Menge und Verfahren</th></tr>${D.schmierplan.map((r, i) => `<tr><td><b>${esc(r.stelle)}</b></td><td>${cov && !S.uncovered[i] ? `<button class="chip s" data-unc="${i}">? aufdecken</button>` : esc(r.stoff)}</td><td>${esc(r.intervall)}</td><td>${esc(r.menge)}</td></tr>`).join('')}</table></div>
      <p class="hint2">Hinweis: Intervalle, Mengen und Kurzzeichen (CLP, HLP, CGLP) sind Beispiele für die Übung. Maßgeblich sind der Schmierplan und die Herstellerangaben der echten Maschine.</p></div>
      ${quizCard('schm', 'Schmierung üben')}`;
  }

  /* ============================================================ Schäden */
  function renderScha() {
    $('#schaView').innerHTML = `<div class="card pl"><h4>Schadensursachen</h4><p class="hint2" style="margin:0 0 6px">Ein Schaden hat fast immer eine Ursache, die du abstellen musst, sonst kommt er wieder. Häufige Ursachen:</p><div class="cols">${D.ursachen.map(u => `<div class="rdout" style="margin:0"><b>${esc(u.name)}</b></div>`).join('')}</div></div>
      <div class="card pl"><h4>Schadensbilder an Lager, Zahnrad, Riemen und Dichtung</h4><p class="hint2" style="margin:0 0 8px">Tippe auf eine Karte: Dann siehst du Ursache und vorbeugende Maßnahme.</p>
      <div class="gal">${D.schaeden.map(s => `<div class="gc ${S.dmg === s.id ? 'open' : ''}" data-dm="${esc(s.id)}"><button class="gb" aria-expanded="${S.dmg === s.id}"><div class="inst" style="margin:0">${dmgSvg(s)}</div><b>${esc(s.teil)}: ${esc(s.name)}</b></button>${S.dmg === s.id ? `<div class="gd"><p>${esc(s.desc)}</p><p><b>Ursache:</b> ${esc(D.ursachen.find(u => u.id === s.ursache).name)}. ${esc(s.warum)}</p><p><b>Maßnahme:</b> ${esc(s.mass)}</p></div>` : ''}</div>`).join('')}</div></div>
      ${quizCard('scha', 'Schaden und Ursache zuordnen')}`;
  }

  /* ============================================================ Kennzahlen */
  function kcRes() {
    const g = k => C.parseDe(S.kc[k]), f = (v, d, u) => isFinite(v) ? C.fmtDe(v, d) + ' ' + u : '–';
    const a = C.mtbf(g('b'), g('n')), b = C.mttr(g('r'), g('rn')), c = C.verf(g('m1'), g('m2'));
    const k = C.kosten(g('st'), g('kh'), g('pe'), g('rh'), g('lo'), g('te'));
    return { a: f(a, 2, 'h'), b: f(b, 2, 'h'), c: f(c, 2, '%'), d: isFinite(k) ? C.fmtDe(k, 2) + ' €' : '–', d1: f(g('st') * g('kh'), 2, '€'), d2: f(g('pe') * g('rh') * g('lo'), 2, '€') };
  }
  function kfield(k, label, unit) { return `<label class="f"><span>${label}</span><div class="qin"><input data-kc="${k}" inputmode="decimal" autocomplete="off" value="${esc(S.kc[k])}"><span class="u">${unit}</span></div></label>`; }
  function renderKenn() {
    const r = kcRes();
    $('#kennView').innerHTML = `<div class="card pl"><h4>Kennzahlen-Rechner</h4><p class="hint2" style="margin:0 0 8px">Gib Werte ein, die Ergebnisse erscheinen sofort. Komma oder Punkt sind erlaubt.</p><div class="cols">
      <div class="card pl" style="margin:0"><h4>MTBF</h4>${kfield('b', 'Betriebszeit', 'h')}${kfield('n', 'Anzahl Ausfälle', '')}<div class="rdout"><b>MTBF</b> = Betriebszeit : Ausfälle = <b id="kcA">${r.a}</b></div></div>
      <div class="card pl" style="margin:0"><h4>MTTR</h4>${kfield('r', 'Summe der Reparaturzeiten', 'h')}${kfield('rn', 'Anzahl Reparaturen', '')}<div class="rdout"><b>MTTR</b> = Summe : Anzahl = <b id="kcB">${r.b}</b></div></div>
      <div class="card pl" style="margin:0"><h4>Verfügbarkeit</h4>${kfield('m1', 'MTBF', 'h')}${kfield('m2', 'MTTR', 'h')}<div class="rdout"><b>Verfügbarkeit</b> = MTBF : (MTBF + MTTR) = <b id="kcC">${r.c}</b></div></div>
      <div class="card pl" style="margin:0"><h4>Ausfallkosten</h4>${kfield('st', 'Stillstandszeit', 'h')}${kfield('kh', 'Ausfallkosten je Stunde', '€')}${kfield('pe', 'Mitarbeiter', '')}${kfield('rh', 'Reparaturzeit je Mitarbeiter', 'h')}${kfield('lo', 'Stundensatz', '€')}${kfield('te', 'Ersatzteile', '€')}<div class="rdout">Stillstand <b id="kcD1">${r.d1}</b> + Lohn <b id="kcD2">${r.d2}</b> + Teile = <b id="kcD">${r.d}</b></div></div></div></div>
      <div class="card pl"><h4>Zufallsaufgaben</h4><div class="fbar"><span class="lbl">Stufe</span>${segHTML('klv', [[1, 'leicht'], [2, 'mittel'], [3, 'schwer']], S.kenLv)}</div>${quizCard('kenn', 'Rechnen üben')}</div>`;
  }
  const segHTML = (data, items, cur) => `<div class="seg" role="group">${items.map(([k, l]) => `<button data-${data}="${k}" class="${String(cur) === String(k) ? 'on' : ''}" aria-pressed="${String(cur) === String(k)}">${l}</button>`).join('')}</div>`;

  /* ============================================================ Wartungsplan (Jahresraster) */
  const planKey = t => 'p' + (t ? t.id : '');
  function planHTML(p, sel, res) {
    const bad = {}, miss = {}; if (res) res.wrong.forEach(([i, j]) => { if (sel[i][j]) bad[i + ':' + j] = 1; else miss[i + ':' + j] = 1; });
    let h = `<ul class="ul" style="margin:0 0 8px">${p.rows.map(r => `<li>${esc(C.rowText(r))}</li>`).join('')}</ul><div class="pgrid"><table class="pt"><tr><th></th>${C.MON3.map(m => `<th>${m}</th>`).join('')}</tr>`;
    p.rows.forEach((r, i) => { h += `<tr><th class="rl">${esc(r.label)}</th>${C.MON3.map((m, j) => `<td><button class="pc ${sel[i][j] ? 'on' : ''} ${bad[i + ':' + j] ? 'bad' : ''} ${miss[i + ':' + j] ? 'miss' : ''}" data-pc="${i}:${j}" aria-pressed="${!!sel[i][j]}" aria-label="${esc(r.label)}, ${C.MONTHS[j]}">${sel[i][j] ? '●' : ''}</button></td>`).join('')}</tr>`; });
    return h + '</table></div>';
  }
  const emptySel = p => p.rows.map(() => new Array(12).fill(false));
  function newPlan() { S.plan.p = C.genPlan(R0, S.plan.lv); S.plan.sel = emptySel(S.plan.p); S.plan.res = null; }
  function renderPlan() {
    if (!S.plan.p) newPlan(); const P = S.plan, st = S.planStat;
    let h = `<div class="card pl"><h4>Wartungsplan zusammenstellen</h4><p class="hint2" style="margin:0 0 8px">Trage für jede Maßnahme die Termine im Jahr ein. Tippe auf ein Feld. Der erste Termin liegt im genannten Monat, danach geht es im Abstand des Intervalls weiter, bis das Jahr zu Ende ist.</p>
      <div class="fbar">${segHTML('plv', [[1, 'leicht'], [2, 'mittel'], [3, 'schwer']], P.lv)}<span id="stat2" class="hint2" style="margin:0">Gelöst ${st.ok}/${st.n}</span></div>${planHTML(P.p, P.sel, P.res)}`;
    if (P.res) h += `<div class="fb ${P.res.ok ? 'ok' : 'bad'}"><span class="v">${P.res.ok ? '✓ Plan stimmt!' : '✗ Der Plan hat noch Fehler.'}</span> ${P.res.ok ? 'Das sind ' + P.res.total + ' Termine im Jahr.' : 'Rot: falsch gesetzt (' + P.res.extra + '), gestrichelt: fehlt (' + P.res.miss + '). Insgesamt gehören ' + P.res.total + ' Termine in den Plan.'}</div><div class="btns">${P.res.ok ? '' : '<button class="btn" data-pa="fix">Weiter bearbeiten</button>'}<button class="btn pri" data-pa="new">Neuer Plan</button></div>`;
    else h += '<div class="btns"><button class="btn pri" data-pa="chk">✓ Prüfen</button><button class="btn" data-pa="clr">Leeren</button><button class="btn" data-pa="new">Neuer Plan</button></div>';
    $('#planView').innerHTML = h + '</div>';
  }

  /* ============================================================ Sicherheit */
  function renderSich() {
    const R = D.sicherheit;
    $('#sichView').innerHTML = `<div class="card pl"><h4>Die fünf Sicherheitsregeln (sinngemäß)</h4>
      <p class="hint2" style="margin:0 0 6px">Sie stammen aus der Elektrotechnik (DIN VDE 0105-100). Der Wortlaut hier ist vereinfacht, maßgeblich ist die Betriebsanweisung. Elektrische Arbeiten führen nur Elektrofachkräfte aus.</p>
      <ol class="ol">${R.regeln.map(r => `<li><b>${esc(r.name)}.</b> ${esc(r.txt)}</li>`).join('')}</ol></div>
      <div class="card pl"><h4>Ablauf im Prüfplatz des Labs (Maschine sichern)</h4><ol class="ol">${R.ablauf.map(a => `<li>${esc(a)}</li>`).join('')}</ol><p class="hint2">Erst danach darfst du eingreifen: Gehäuse öffnen, Spiel messen, Teile tauschen. Prüfungen, bei denen die Maschine laufen muss, machst du vorher.</p></div>
      <div class="card pl"><h4>Restenergien</h4><p class="hint2" style="margin:0 0 6px">Auch wenn der Hauptschalter aus ist, kann in der Maschine Energie stecken.</p><div style="overflow-x:auto"><table class="tt"><tr><th>Restenergie</th><th>Beispiele</th><th>Maßnahme</th></tr>${R.rest.map(r => `<tr><td><b>${esc(r.name)}</b></td><td>${esc(r.bsp)}</td><td>${esc(r.mass)}</td></tr>`).join('')}</table></div></div>
      <div class="card pl"><h4>${esc(R.loto.name)}</h4><p style="margin:0">${esc(R.loto.txt)}</p><p class="hint2">Die genaue Regelung (Schlosssystem, Schilder, Zuständigkeit) legt der Betrieb fest.</p></div>
      ${quizCard('sich', 'Sicherheit üben')}`;
  }

  /* ============================================================ Fehlersuche (Prüfplatz) */
  const MODE_TAG = { run: '▶ im Betrieb', safe: '🔒 Eingriff', any: '' };
  const GORDER = ['doc', 'sicht', 'hoer', 'mess'];
  function startDiag(sid, o) {
    o = o || {}; const st = C.start(sid, { seed: String(R0()) + Date.now(), fault: o.fault });
    S.diag = { sid, st, mode: 'play', cause: null, meas: null, res: null, task: o.task || null, tip: 0 };
    setTab('diag'); renderDiag(true);
  }
  function leaveDiag() { S.diag = { sid: null, st: null, mode: 'play', cause: null, meas: null, res: null, task: null, tip: 0 }; renderDiag(true); }
  const stateChip = v => v.safe ? '<span class="chip s st on" style="background:var(--ok);border-color:var(--ok);color:#06210d">🔒 gesichert</span>' : v.running ? '<span class="chip s st on">▶ läuft</span>' : '<span class="chip s st" style="border-color:var(--warn);color:var(--warn)">■ abgeschaltet</span>';
  function renderDiag(top) {
    const V = $('#diagView'), keep = $('#pgDiag').scrollTop, d = S.diag; let h = '';
    if (!d.sid) {
      h += `<div class="card pl"><h4>Prüfplatz: Fehlersuche an Maschinen</h4><p style="margin:0 0 6px">Eine Maschine hat eine Störung. Du kennst nur die Symptome. Wähle Prüfschritte, um die Ursache einzugrenzen. Jeder Schritt kostet Zeit (Stillstandskosten). Eingriffe sind erst erlaubt, wenn die Maschine gesichert ist.</p>
        <p class="hint2" style="margin:0">Jedes Mal ist die Ursache anders. Der Fehlername steht erst nach der Abgabe in der Lösung.</p><div class="btns"><button class="btn pri" data-ds="__rand">🎲 Zufälliges Szenario</button></div></div>`;
      h += '<div class="gh">Szenarien</div><div class="card" style="padding:0">';
      D.scenarios.forEach(s => { const ds = S.dstat[s.id]; h += `<button class="row" data-ds="${esc(s.id)}"><span class="dot ${ds && ds.best >= 80 ? 'g' : ds ? 'p' : ''}">${ds && ds.best >= 80 ? '✓' : ''}</span><div class="grow"><b>${esc(s.title)}</b><small>${esc(s.machine)} · <span class="lv">${dots(s.level)}</span>${ds ? ' · bestes Ergebnis ' + ds.best + ' Punkte (' + ds.n + '×)' : ''}</small></div></button>`; });
      V.innerHTML = h + '</div>'; if (top) $('#pgDiag').scrollTop = 0; return;
    }
    const st = d.st, v = C.view(st), sc = C.scenOf(d.sid);
    if (d.task) { const t = TASKS.find(x => x.id === d.task); h += `<div class="rdout"><b>Aufgabe:</b> ${esc(t.title)} <span class="lv">${dots(t.level)}</span>${exam() ? ' · 🎓 Prüfmodus: Tipps kosten 25 %' : ''}</div>`; }
    const last = st.log[st.log.length - 1];
    h += `<div class="dgbar"><div class="dgrow">${stateChip(v)}<span class="chip s st">🔎 ${v.diag} Schritte</span><span class="chip s st">⏱ ${v.minutes} min</span><span class="chip s st" style="font-weight:700">💶 ${eur(v.cost)}</span>${v.violations ? `<span class="chip s st" style="border-color:var(--danger);color:var(--danger)">⚠ ${v.violations} Verstoß${v.violations > 1 ? 'e' : ''}</span>` : ''}</div>
      <button class="dglast ${last && last.refused ? 'bad' : ''}" data-dg="log" aria-label="Alle Befunde anzeigen">${last ? `<b>${esc(last.label)}:</b> ${esc(last.text)}` : '<span class="hint2" style="margin:0">Noch kein Befund. Wähle einen Prüfschritt.</span>'}<span class="more">Alle Befunde ▸</span></button></div>`;
    h += `<div class="card pl"><h4>${esc(v.title)}</h4><p style="margin:0 0 6px">${esc(v.intro)}</p><p style="margin:0 0 4px"><b>Symptome</b></p><ul class="ul">${v.symptoms.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="flow" aria-label="Aufbau der Maschine">${v.flow.map((f, i) => `<span class="fb2">${esc(f)}</span>${i < v.flow.length - 1 ? '<span class="fa">→</span>' : ''}`).join('')}</div>
      <p class="hint2" style="margin:6px 0 0">Stillstandskosten: ${eur(v.rate)} je Minute. Tipp: Erst befragen und im Betrieb prüfen, dann sichern und eingreifen.</p></div>`;
    if (d.mode === 'play') {
      h += '<div class="card pl"><h4>Maschine sichern und freigeben</h4><div class="stepgrid">';
      v.safety.forEach(s => { const done = s.id === 'start' ? v.running : !!st.sec[s.id]; h += `<button class="sbtn ${done ? 'done' : ''}" data-st="${s.id}" ${(s.id === 'start' ? v.running : done) ? 'disabled' : ''}><span class="sl">${done && s.id !== 'start' ? '✓ ' : ''}${esc(s.label)}</span><span class="sm">${s.min} min</span></button>`; });
      h += '</div></div>';
      GORDER.forEach(g => { const items = v.steps.filter(s => s.g === g); if (!items.length) return; h += `<div class="card pl"><h4>${esc(D.GROUPS[g])}</h4><div class="stepgrid">${items.map(s => { const done = !!st.done[s.id]; return `<button class="sbtn ${done ? 'done' : ''}" data-st="${s.id}" ${done ? 'disabled' : ''}><span class="sl">${done ? '✓ ' : ''}${esc(s.label)}</span><span class="sm">${s.min} min${MODE_TAG[s.mode] ? ' · ' + MODE_TAG[s.mode] : ''}</span></button>`; }).join('')}</div></div>`; });
      h += `<div class="btns"><button class="btn pri" data-dg="submit">Ursache festlegen ▸</button><button class="btn" data-dg="tip">💡 Tipp</button><button class="btn" data-dg="quit">${d.task ? 'Zurück zur Aufgabenliste' : 'Abbrechen'}</button></div>`;
    } else if (d.mode === 'submit') {
      const ch = C.choices(st);
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Abgabe: Ursache und Maßnahme</h4>${v.safe ? '' : '<div class="rdout bad">Die Reparatur ist ein Eingriff. Die Maschine ist noch nicht gesichert. Wenn du jetzt abgibst, zählt das als Sicherheitsverstoß. Gehe besser zurück und sichere zuerst.</div>'}
        <p style="margin:6px 0 4px"><b>1. Was ist die Ursache der Störung?</b></p><div class="opts">${ch.causes.map(c => `<button data-cc="${esc(c.id)}" class="${d.cause === c.id ? 'on' : ''}">${esc(c.name)}</button>`).join('')}</div>
        <p style="margin:10px 0 4px"><b>2. Welche Maßnahme behebt sie?</b></p><div class="opts">${ch.measures.map(c => `<button data-cm="${esc(c.id)}" class="${d.meas === c.id ? 'on' : ''}">${esc(c.text)}</button>`).join('')}</div>
        <div class="btns"><button class="btn pri" data-dg="send" ${d.cause && d.meas ? '' : 'disabled'}>✓ Abgeben</button><button class="btn" data-dg="back">◂ Zurück zur Prüfung</button></div></div>`;
    } else {
      h += resultHTML(d.res, sc);
    }
    V.innerHTML = h; $('#pgDiag').scrollTop = top ? 0 : keep;
  }
  function resultHTML(r, sc) {
    const d = S.diag, hide = exam() && !r.ok, p = r.pts;
    let h = `<div class="card pl" style="border-color:${r.passed ? 'var(--ok)' : 'var(--danger)'}"><h4>Ergebnis</h4><div class="big">${r.passed ? '✓ Gelöst' : r.ok ? '✗ Ursache richtig, aber Sicherheitsverstoß' : '✗ Nicht gelöst'}</div>${r.causeOk ? `<div class="lv" style="font-size:16px">${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)} Effizienz</div>` : ''}`;
    h += `<table class="tt" style="margin-top:8px"><tr><th>Bewertung</th><th class="n">Punkte</th></tr><tr><td>Ursache ${r.causeOk ? '✓' : '✗'}</td><td class="n">${p.cause} von 50</td></tr><tr><td>Maßnahme ${r.measOk ? '✓' : '✗'}</td><td class="n">${p.meas} von 20</td></tr><tr><td>Sicherheit (${r.violations} ${r.violations === 1 ? 'Verstoß' : 'Verstöße'})</td><td class="n">${p.safety} von 15</td></tr><tr><td>Effizienz ${r.causeOk ? '(' + r.stars + ' von 3 Sternen)' : '(nur bei richtiger Ursache)'}</td><td class="n">${p.eff} von 15</td></tr><tr><td><b>Gesamt</b></td><td class="n"><b>${p.total} von 100</b></td></tr></table>`;
    h += `<div class="stats" style="margin-top:8px"><div class="bx"><b>${r.diag}</b>Prüfschritte</div><div class="bx"><b>${r.minutes}</b>Minuten</div><div class="bx"><b>${eur(r.cost)}</b>Stillstand</div></div>`;
    if (hide) h += '<div class="rdout bad">🎓 Prüfmodus: Die Lösung gibt es erst, wenn die Aufgabe richtig gelöst ist. Du kannst die Auswahl noch einmal ändern.</div>';
    else {
      h += `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Ursache:</b> ${esc(r.fault.name)}<br>${esc(r.fault.cause)}<br><br><b>Maßnahme:</b> ${esc(r.fault.measure)}<br><br><b>Vorbeugen:</b> ${esc(r.fault.prev)}</div>`;
      if (!r.causeOk) h += `<p class="hint2">Du hattest gewählt: ${esc(sc.faults.find(f => f.id === r.chosen.cause).name)}.</p>`;
      h += `<p style="margin:8px 0 4px"><b>Kürzester Weg</b> (${r.ideal.length} ${r.ideal.length === 1 ? 'Prüfschritt' : 'Prüfschritte'}, ${r.idealMin} min, ohne Sicherheitsschritte):</p><ol class="ol">${r.ideal.map(i => `<li>${esc(i.label)} (${i.min} min)</li>`).join('')}</ol><p class="hint2" style="margin:0">Befragen und Unterlagen sind Hinweise und zählen nicht als Beweis. Bei den Sternen gelten bis zu 2 Schritte mehr als der kürzeste Weg als ideal.</p>`;
    }
    if (d.task && r.ok && r.violations) h += '<div class="rdout bad">Mit einem Sicherheitsverstoß zählt die Aufgabe nicht als gelöst. Versuche es noch einmal und sichere die Maschine, bevor du eingreifst.</div>';
    h += '<div class="btns">';
    if (hide) h += '<button class="btn pri" data-dg="retry">Auswahl ändern</button>';
    else if (d.task) h += `<button class="btn pri" data-dg="again">Nochmal versuchen</button>${r.passed ? '<button class="btn" data-dg="nexttask">Nächste Aufgabe</button>' : ''}<button class="btn" data-dg="quit">Zur Aufgabenliste</button>`;
    else h += `<button class="btn pri" data-dg="again">Nochmal (neue Ursache)</button><button class="btn" data-dg="quit">Anderes Szenario</button>`;
    return h + '</div></div>';
  }
  function diagStep(id) {
    const d = S.diag, r = C.doStep(d.st, id);
    if (r.ok) { if (r.kind === 'diag') toast(r.text); else toast(r.text); } else { toast(r.msg); if (r.violation) sad(); }
    renderDiag();
  }
  function showLog() {
    const st = S.diag.st; if (!st) return;
    sheet('Befunde', b => { b.innerHTML = st.log.length ? [...st.log].reverse().map(l => `<div class="rdout ${l.refused ? 'bad' : ''}"><b>${esc(l.label)}</b>${l.min ? ' · ' + l.min + ' min' : ''}<br>${esc(l.text)}</div>`).join('') : '<p class="hint2">Noch keine Befunde.</p>'; });
  }
  function diagSubmit() {
    const d = S.diag, r = C.submit(d.st, d.cause, d.meas);
    if (r.refused) { toast(r.msg); sad(); renderDiag(); return; }
    d.res = r; d.mode = 'result';
    const ds = S.dstat[d.sid] || { n: 0, best: 0 }; ds.n++; ds.best = Math.max(ds.best, r.pts.total); S.dstat[d.sid] = ds; lsSet('diag', S.dstat);
    if (d.task) { if (r.passed) { const pct = pctFor(d.task); markSolved(d.task, pct); const F = fx(); if (pct === 0) toast('Mit angezeigter Lösung zählt die Aufgabe im Prüfmodus nicht.'); else { if (F && F.pass) try { F.pass(pct); } catch (e) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } } else sad(); }
    else if (r.ok) ding(); else sad();
    renderDiag(true);
  }
  $('#diagView').addEventListener('click', e => {
    const d = S.diag, b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ds) { if (b.dataset.ds === '__rand') startDiag(C.pick(R0, D.scenarios).id); else startDiag(b.dataset.ds); return; }
    if (b.dataset.st) { diagStep(b.dataset.st); return; }
    if (b.dataset.cc) { d.cause = b.dataset.cc; renderDiag(); return; }
    if (b.dataset.cm) { d.meas = b.dataset.cm; renderDiag(); return; }
    const a = b.dataset.dg; if (!a) return;
    if (a === 'log') showLog();
    else if (a === 'submit') { d.mode = 'submit'; renderDiag(true); }
    else if (a === 'back') { d.mode = 'play'; renderDiag(); }
    else if (a === 'send') diagSubmit();
    else if (a === 'retry') { d.st.submitted = null; d.res = null; d.mode = 'submit'; renderDiag(true); }
    else if (a === 'tip') diagTip();
    else if (a === 'again') { const t = d.task && TASKS.find(x => x.id === d.task); startDiag(d.sid, t ? { fault: t.fault, task: t.id } : {}); }
    else if (a === 'nexttask') { const t = TASKS.find(x => x.id === d.task), i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); }
    else if (a === 'quit') { if (d.task) { leaveDiag(); setTab('tasks'); } else leaveDiag(); }
  });
  function diagTip() {
    const d = S.diag, sc = C.scenOf(d.sid);
    if (d.task) { const t = TASKS.find(x => x.id === d.task); hintTask(t); return; }
    d.tip = Math.min(3, d.tip + 1);
    sheet('Tipp, Stufe ' + d.tip + ' von 3', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(sc.tips[0])}</p>`; if (d.tip >= 2) x += `<p><b>Stufe 2:</b> ${esc(sc.tips[1])}</p>`;
      if (d.tip >= 3) x += `<p><b>Stufe 3:</b> Die Ursache lautet <b>${esc(sc.faults.find(f => f.id === d.st.fault).name)}</b>.</p>`; else x += '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“.</p>';
      b.innerHTML = x + '<p class="hint2">Beim Üben kosten Tipps nichts. Bei Aufgaben im Prüfmodus (🎓) zählen sie.</p>';
    });
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
  function updateBadge() { const b = $('#tkBd'); if (!b) return; const n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length; b.textContent = n + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  const tipsOf = t => t.tips || C.scenOf(t.scen).tips;
  function taskSolution(t) {
    if (t.kind === 'scen') { const f = C.faultOf(C.scenOf(t.scen), t.fault); return f.name + ' → ' + f.measure; }
    if (t.kind === 'plan') return C.planTruth(t.plan).map((r, i) => t.plan.rows[i].label + ': ' + r.map((v, j) => v ? C.MON3[j] : '').filter(Boolean).join(', ')).join('; ');
    return C.solutionText(C.taskQ(t));
  }
  function hintTask(t) {
    const h = lsGet('hints', {}), n = Math.min(3, (h[t.id] || 0) + 1), ex = exam(), tp = tipsOf(t);
    h[t.id] = Math.max(h[t.id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[t.id] = Math.max(c[t.id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 3', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(tp[0])}</p>`;
      if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(tp[1])}</p>`;
      if (n >= 3) x += `<p><b>Stufe 3:</b> Die Lösung lautet <b>${esc(taskSolution(t))}</b>.</p>`; else x += '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“ für die nächste Stufe.</p>';
      x += ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte. Mit Stufe 3 zählt die Aufgabe nicht mehr.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  function checkTask(t) {
    const ex = exam(); let ok = false, lines = [], sol = taskSolution(t), per = null;
    if (t.kind === 'plan') {
      const sel = S.tPlan && S.tPlan.id === t.id ? S.tPlan.sel : emptySel(t.plan); if (!sel.some(r => r.some(Boolean))) { toast('Trage zuerst Termine ein.'); return; }
      const r = C.checkPlan(t.plan, sel); ok = r.ok; S.tPlan.res = r;
      lines.push({ ok, text: ok ? 'Der Plan stimmt, ' + r.total + ' Termine im Jahr.' : r.extra + ' Termin(e) zu viel, ' + r.miss + ' Termin(e) fehlen.' });
    } else {
      const q = C.taskQ(t), a = S.tAns[t.id] || {}, r = C.checkQ(q, a); if (r.empty) { toast(t.kind === 'num' ? 'Bitte gib eine Zahl ein (mit Komma oder Punkt).' : 'Bitte zuerst antworten.'); return; }
      ok = r.ok; per = r; lines.push({ ok, text: ok ? 'Richtig: ' + (t.kind === 'num' ? C.fAny(r.given) + ' ' + t.unit : sol) : qFeedback(q, r).replace(/<[^>]+>/g, '').replace(/^[✓✗]\s*/, '') });
      if (t.kind === 'num') lines.push({ ok: true, info: true, text: 'Erlaubt ist eine Abweichung von ±' + C.fAny(t.tol, 2) + ' ' + t.unit + '.' });
    }
    const pct = ok ? pctFor(t.id) : 0;
    S.tRes = Object.assign({ id: t.id, ok, pct, lines, sol }, per && per.per ? { per: per.per } : {});
    if (ok) { markSolved(t.id, pct); if (pct === 0) toast('Mit angezeigter Lösung zählt die Aufgabe im Prüfmodus nicht.'); else { const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (e) {} else ding(); toast(ex && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } } else { sad(); toast('Noch nicht richtig. Lies die Erklärung und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t && t.kind !== 'scen') {
      const r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || (S.tAns[t.id] = {});
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>`;
      if (t.kind === 'plan') {
        if (!S.tPlan || S.tPlan.id !== t.id) S.tPlan = { id: t.id, sel: emptySel(t.plan), res: null };
        h += `<p style="margin:8px 0">${esc(t.text)}</p>${planHTML(t.plan, S.tPlan.sel, r ? S.tPlan.res : null)}`;
      } else {
        const q = C.taskQ(t), res = r ? { ok: r.ok, per: r.per } : null;
        h += `<div id="tkQ">${qInner(q, a, res, false)}</div>`;
      }
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) {
        h += `<ul class="tl">${r.lines.map(l => `<li class="${l.info ? '' : l.ok ? 'ok' : 'bad'}">${l.info ? 'ℹ' : l.ok ? '✓' : '✗'} ${esc(l.text)}</li>`).join('')}</ul>`;
        if (r.ok || !exam()) h += `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(r.sol)}<br>${esc(t.expl)}</div>`;
        else h += '<div class="rdout bad">🎓 Prüfmodus: Die Erklärung gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>';
        if (r.ok) h += '<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>';
      }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : p > 0 ? 'p' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${x.kind === 'scen' ? ' · Prüfplatz' : ''}${p != null && !d[x.id] ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function startTask(id) {
    const t = TASKS.find(x => x.id === id); if (!t) return;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    S.task = id; S.tAns = {}; S.tRes = null; S.tPlan = null;
    if (t.kind === 'scen') { startDiag(t.scen, { fault: t.fault, task: id }); return; }
    setTab('tasks'); renderTasks();
  }
  const tv = $('#taskView');
  tv.addEventListener('click', e => {
    const t = curTask(), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]'), pc = e.target.closest('[data-pc]');
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintTask(t); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (pc && t && t.kind === 'plan' && S.tPlan) { const [i, j] = pc.dataset.pc.split(':').map(Number); if (S.tRes && S.tRes.ok) return; S.tPlan.sel[i][j] = !S.tPlan.sel[i][j]; S.tRes = null; renderTasks(false); return; }
    if (t && t.kind !== 'scen' && t.kind !== 'plan' && !(S.tRes && S.tRes.ok)) { const q = C.taskQ(t), a = S.tAns[t.id] || (S.tAns[t.id] = {}); if (qClick(e, q, a)) { if (S.tRes) S.tRes = null; renderTasks(false); return; } }
    if (row) startTask(row.dataset.t);
  });
  tv.addEventListener('change', e => { const t = curTask(); if (t && t.kind === 'match') { const q = C.taskQ(t), a = S.tAns[t.id] || (S.tAns[t.id] = {}); if (qChange(e, q, a) && S.tRes) { S.tRes = null; renderTasks(false); } } });
  tv.addEventListener('input', e => { const t = curTask(); if (t && e.target.dataset.qn) (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset && e.target.dataset.qn) { e.preventDefault(); checkTask(t); } });

  /* ============================================================ Trainer */
  function renderRt() {
    const c = S.rtc;
    $('#rtView').innerHTML = `<div class="card pl"><h4>Zufalls-Trainer: unendlich viele Fragen</h4><div class="fbar">${segHTML('rcat', [['mixed', 'Gemischt'], ['Begriffe', 'Begriffe'], ['Schmierung', 'Schmierung'], ['Schäden', 'Schäden'], ['Kennzahlen', 'Kennzahlen'], ['Sicherheit', 'Sicherheit']], c.cat)}</div>
      ${c.cat === 'Kennzahlen' ? `<div class="fbar"><span class="lbl">Stufe</span>${segHTML('rlv', [[1, 'leicht'], [2, 'mittel'], [3, 'schwer']], c.level)}</div>` : ''}
      <div data-quiz="rt"><h4 style="display:none"></h4>${quizInner('rt')}</div>
      <div class="btns"><button class="btn" data-ra="scen">🔍 Zufalls-Fehlersuche starten</button></div></div>`;
  }
  $('#rtView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.rcat) { S.rtc.cat = b.dataset.rcat; newQ('rt'); renderRt(); }
    else if (b.dataset.rlv) { S.rtc.level = +b.dataset.rlv; newQ('rt'); renderRt(); }
    else if (b.dataset.ra === 'scen') startDiag(C.pick(R0, D.scenarios).id);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const R = D.sicherheit;
    const grp = (t, list) => `<p><b>${t}</b></p><ul class="ul">${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    $('#helpView').innerHTML = `
    <details open><summary>📚 Begriffe der Instandhaltung</summary><div class="hb2"><table><tr><th>Begriff</th><th>Bedeutung</th></tr>${D.begriffe.map(b => `<tr><td>${esc(b.name)}</td><td>${esc(b.def)}<br><i>${esc(b.bsp)}</i></td></tr>`).join('')}</table>
      <table><tr><th>Strategie</th><th>Kurz</th></tr>${D.strategien.map(s => `<tr><td>${esc(s.long)}</td><td>${esc(s.was)}<br>+ ${esc(s.vor)}<br>− ${esc(s.nach)}</td></tr>`).join('')}</table></div></details>
    <details><summary>🔍 Fehlersuche: so gehst du vor</summary><div class="hb2"><ol class="ol"><li><b>Symptome aufnehmen:</b> Was genau ist los? Seit wann? Immer oder manchmal? Bediener befragen, Wartungsbuch lesen.</li><li><b>Ursachen sammeln:</b> Welche Baugruppen kommen infrage? Antrieb, Lagerung, Schmierung, Medien, Steuerung, Werkzeug.</li><li><b>Eingrenzen:</b> Wähle Prüfschritte, die möglichst viele Ursachen auf einmal ausschließen. Billig und schnell zuerst.</li><li><b>Im Betrieb prüfen</b> (Hören, Fühlen, Temperatur, Strom, Druck), dann <b>sichern</b> und erst danach eingreifen (Spiel messen, Gehäuse öffnen).</li><li><b>Ursache festlegen</b> und Maßnahme wählen. Dann auch die Ursache beseitigen, nicht nur das Symptom.</li></ol>
      <p>Befragen und Unterlagen sind Hinweise, aber kein Beweis. Erst die Messung zeigt, was los ist.</p></div></details>
    <details><summary>🧰 Prüfschritt-Ideen</summary><div class="hb2">
      ${grp('Sichtprüfung', ['Leckage, Ölspuren, Risse, Verfärbungen (Anlauffarben), Rost', 'Riemen: Risse, glänzende Flanken, Abrieb', 'Filter, Siebe, Schauglas, Abstreifer, Dichtungen', 'Befestigung, Schrauben, Kupplungen'])}
      ${grp('Hören und Fühlen', ['Geräusch: gleichmäßig, im Takt der Drehzahl, unregelmäßig, hoch oder tief?', 'Vibration am Gehäuse (nie an drehenden Teilen)', 'Wärme: Handrücken nur an ungefährlichen Stellen, besser Infrarotthermometer', 'Lager von Hand drehen: leicht, rau, schwer?'])}
      ${grp('Messen und Prüfen', ['Temperatur, Temperaturverlauf', 'Spiel mit der Messuhr (Lager, Spindel, Kupplung)', 'Riemenspannung (Durchdrücken)', 'Druck an mehreren Stellen (Netz, Ausgang, Zylinder, Saugseite)', 'Ölstand, Ölzustand, Ölprobe, Magnetabscheider', 'Schwingungen, Stromaufnahme (Anzeige), Drehzahl'])}
      <p class="hint2">Mit Sicherheits-Symbolen: ▶ im Betrieb heißt, die Maschine muss laufen. 🔒 Eingriff heißt, die Maschine muss gesichert sein.</p></div></details>
    <details><summary>🧮 Formeln und Kennzahlen</summary><div class="hb2"><span class="eq">MTBF = Betriebszeit : Anzahl der Ausfälle</span><span class="eq">MTTR = Summe der Reparaturzeiten : Anzahl der Reparaturen</span><span class="eq">Verfügbarkeit = MTBF : (MTBF + MTTR)  (· 100 = Prozent)</span><span class="eq">Verfügbarkeit = (geplante Zeit − Stillstand) : geplante Zeit</span><span class="eq">Ausfallkosten = Stillstand · Kosten je Stunde + Personen · Stunden · Stundensatz + Ersatzteile</span>
      <p>MTBF: mittlere Betriebsdauer zwischen Ausfällen (Mean Time Between Failures). MTTR: mittlere Reparaturdauer (Mean Time To Repair). Beispiel: MTBF 200 h, MTTR 8 h ergibt 200 : 208 = 96,15 %.</p></div></details>
    <details><summary>🛢️ Schmierstoffe und Schmierplan</summary><div class="hb2"><table><tr><th>Art</th><th>Eigenschaften</th><th>Einsatz</th></tr>${D.schmier.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.eig)}</td><td>${esc(s.einsatz)}</td></tr>`).join('')}</table><p>Aufgaben der Schmierung: ${esc(D.schmierAufgaben.join('; '))}.</p><p>Schmierplan: Schmierstelle, Schmierstoff, Intervall, Menge, Verfahren. Nicht zu viel, nicht zu wenig, richtige Sorte, Schmierstellen vorher reinigen.</p></div></details>
    <details><summary>🔧 Schadensursachen</summary><div class="hb2"><table><tr><th>Ursache</th><th>Typische Schadensbilder</th></tr>${D.ursachen.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(D.schaeden.filter(s => s.ursache === u.id).map(s => s.teil + ': ' + s.name).join('; '))}</td></tr>`).join('')}</table></div></details>
    <details><summary>🦺 Sicherheit bei der Instandhaltung</summary><div class="hb2"><ol class="ol">${R.regeln.map(r => `<li><b>${esc(r.name)}.</b> ${esc(r.txt)}</li>`).join('')}</ol><p><b>Ablauf im Lab:</b> ${esc(R.ablauf.join(' → '))}.</p><table><tr><th>Restenergie</th><th>Maßnahme</th></tr>${R.rest.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.mass)}</td></tr>`).join('')}</table><p><b>${esc(R.loto.name)}:</b> ${esc(R.loto.txt)}</p><p class="hint2">Die fünf Regeln sind sinngemäß wiedergegeben. Es gilt die Betriebsanweisung des Ausbilders.</p></div></details>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'begr'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ begr: renderBegr, diag: () => renderDiag(true), schm: renderSchm, scha: renderScha, kenn: renderKenn, plan: renderPlan, sich: renderSich, bsp: renderBsp, tasks: renderTasks, rt: renderRt, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Instandhaltungs-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Instandhaltungs-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); updatePal(); $('#bExam').classList.toggle('on', on); $('#bExam').setAttribute('aria-pressed', on); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); else if (S.tab === 'diag') renderDiag(); }
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
    else if (b.dataset.a === 'rand') { newQ('rt'); setTab('rt'); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('begr');
  $('#bMenu').onclick = () => {
    const rows = [['diag', 'Fehlersuche (Prüfplatz)', 'Zehn Maschinen und Geräte mit verdeckter Ursache'], ['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Fragen mit Serien-Zähler'], ['help', 'Hilfe und Spickzettel', 'Begriffe, Formeln, Prüfschritt-Ideen, Sicherheit'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps, Bestwerte und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt', 'diag', 'plan'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.dstat = {}; S.planStat = { n: 0, ok: 0 }; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); setTab(S.tab); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Ereignisse der einfachen Reiter */
  ['begr', 'schm', 'scha', 'kenn', 'sich', 'rt'].forEach(k => bindQuiz($('#' + VIEW[k])));
  $('#schmView').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.cov) { S.cover = !S.cover; S.uncovered = {}; renderSchm(); } else if (b.dataset.unc) { S.uncovered[b.dataset.unc] = true; renderSchm(); } });
  $('#schaView').addEventListener('click', e => { const g = e.target.closest('.gb'); if (!g) return; const id = g.parentNode.dataset.dm; S.dmg = S.dmg === id ? null : id; const keep = $('#pgScha').scrollTop; renderScha(); $('#pgScha').scrollTop = keep; });
  $('#kennView').addEventListener('input', e => {
    const k = e.target.dataset.kc; if (!k) return; S.kc[k] = e.target.value; lsSet('kc', S.kc); const r = kcRes();
    [['kcA', r.a], ['kcB', r.b], ['kcC', r.c], ['kcD', r.d], ['kcD1', r.d1], ['kcD2', r.d2]].forEach(([id, v]) => { const el = $('#' + id); if (el) el.textContent = v; });
  });
  $('#kennView').addEventListener('click', e => { const b = e.target.closest('[data-klv]'); if (b) { S.kenLv = +b.dataset.klv; newQ('kenn'); renderKenn(); } });
  $('#planView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const P = S.plan;
    if (b.dataset.plv) { P.lv = +b.dataset.plv; newPlan(); renderPlan(); }
    else if (b.dataset.pc) { if (P.res && P.res.ok) return; const [i, j] = b.dataset.pc.split(':').map(Number); P.sel[i][j] = !P.sel[i][j]; P.res = null; const keep = $('#pgPlan').scrollLeft; renderPlan(); }
    else if (b.dataset.pa === 'chk') { if (!P.sel.some(r => r.some(Boolean))) { toast('Trage zuerst Termine ein.'); return; } P.res = C.checkPlan(P.p, P.sel); S.planStat.n++; if (P.res.ok) { S.planStat.ok++; ding(); } else sad(); lsSet('plan', S.planStat); renderPlan(); }
    else if (b.dataset.pa === 'clr') { P.sel = emptySel(P.p); renderPlan(); }
    else if (b.dataset.pa === 'fix') { P.res = null; renderPlan(); }
    else if (b.dataset.pa === 'new') { newPlan(); renderPlan(); }
  });

  /* Schnittstelle für Karriere/Lernpfad */
  root.INS_LAB = { id: 'ins', title: 'Instandhaltungs-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.INS_TASKS };

  /* ============================================================ Beispiele (Reiter "Beispiele", Aufruf ?bsp) */
  const BSP = D.beispiele || [], BSP_INTRO = 'Fertige Lösungsbeispiele zum Lernen. Sie zeigen den richtigen Weg und sind keine Aufgaben: Die Fälle im Prüfplatz bleiben verdeckt.';
  const BSP_BTNS = { fall: 'Ansehen', plan: 'Ansehen', schaden: 'Ansehen', kenn: 'Laden' };
  function renderBsp() {
    const V = $('#bspView'); if (!V) return;
    V.innerHTML = '<div class="card pl"><h4>Beispiele</h4><p class="hint2" style="margin:0">' + BSP_INTRO + '</p></div>' +
      BSP.map((b, i) => '<div class="card pl"><h4>' + esc(b.titel) + '</h4><p style="margin:0 0 4px;line-height:1.45">' + esc(b.text) + '</p><div class="btns"><button class="btn pri" data-bsp="' + i + '" style="min-height:44px">' + BSP_BTNS[b.typ] + '</button></div></div>').join('');
    V.onclick = e => { const x = e.target.closest('[data-bsp]'); if (x && BSP[+x.dataset.bsp]) loadBsp(BSP[+x.dataset.bsp]); };
  }
  function loadBsp(b) {
    if (b.typ === 'kenn') { Object.assign(S.kc, b.kc); lsSet('kc', S.kc); setTab('kenn'); toast('Beispielwerte geladen'); return; }
    sheet(b.titel, (box, close) => {
      if (b.typ === 'fall') {
        box.innerHTML = '<div class="rdout ok"><b>Lösungsbeispiel zum Lernen, kein Aufgabenfall.</b> Hier wird die Lösung gezeigt. Die Fälle im Prüfplatz musst du selbst lösen.</div><p>' + esc(b.fall.intro) + '</p><ol style="padding-left:20px;margin:0">' +
          b.fall.schritte.map(s => '<li style="margin-bottom:10px"><b>' + esc(s.phase) + ': ' + esc(s.titel) + '</b><br>' + esc(s.text) + '</li>').join('') + '</ol><div class="btns"><button class="btn pri" data-x="diag" style="min-height:44px">Selbst üben: Fehlersuche</button></div>';
      } else if (b.typ === 'plan') {
        box.innerHTML = '<table class="tt"><tr><th>Schmierstelle</th><th>Schmierstoff</th><th>Intervall</th><th>Menge</th></tr>' + D.schmierplan.map(r => '<tr><td><b>' + esc(r.stelle) + '</b></td><td>' + esc(r.stoff) + '</td><td>' + esc(r.intervall) + '</td><td>' + esc(r.menge) + '</td></tr>').join('') + '</table><div class="btns"><button class="btn pri" data-x="schm" style="min-height:44px">Zum Reiter Schmierung</button></div>';
      } else if (b.typ === 'schaden') {
        const s = D.schaeden.find(x => x.id === b.schaden), u = D.ursachen.find(x => x.id === s.ursache);
        box.innerHTML = '<p><b>' + esc(s.teil + ': ' + s.name) + '</b></p><div class="rdout"><b>Schadensbild:</b> ' + esc(s.desc) + '</div><div class="rdout"><b>Ursache (' + esc(u.name) + '):</b> ' + esc(s.warum) + '</div><div class="rdout ok"><b>Maßnahme:</b> ' + esc(s.mass) + '</div><div class="btns"><button class="btn pri" data-x="scha" style="min-height:44px">Zum Reiter Schäden</button></div>';
      }
      box.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (x) { close(); setTab(x.dataset.x); } });
    });
  }

  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (S.tab === 'diag' && S.diag.sid) renderDiag(); }, 150); });
  buildTabs(); updatePal(); setTab(S.tab);
  /* Aufruf ?aufgabe=ins1 (Startseite, Lernhefte): Aufgabe gleich öffnen */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
  /* Aufruf ?bsp: gleich die Beispielauswahl zeigen */
  try { const qb = new URLSearchParams(location.search); if (qb.has('bsp') && !qb.get('aufgabe')) { setTab('bsp'); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
