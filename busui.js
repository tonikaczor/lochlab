'use strict';
/* Tonfunk Bus-Lab: Oberfläche (Lab-Kennung 'bus').
   ALLE Zahlen sind ÜBUNGSWERTE für die Ausbildung. Frei erfundene Firma "Modellbetrieb", keine Hersteller.
   Reiter: UART (Zeichen eintippen, Rahmen auf dem Oszilloskop), CAN (IDs wählen, Arbitrierung ansehen), RS-485 (Abschluss, Länge und Bitrate),
           Aufgaben, Trainer, Hilfe.
   Module: buscore.js (BUS_CORE), busdata.js (BUS_DATA, BUS_TASKS), busviz.js (BUS_VIZ, vor dieser Datei geladen).
   Speicher (Präfix lm4.bus.): tab, u (UART), c (CAN), r (RS-485), done ({id:true}), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus.
   Aufruf: buslab.html?aufgabe=bus1 öffnet die Aufgabe. */
(function (root) {
  const C = root.BUS_CORE, D = root.BUS_DATA, V = root.BUS_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.bus.';
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Bus-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">buscore.js, busdata.js oder busviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['uart', '🔤', 'UART'], ['can', '🚦', 'CAN'], ['rs', '🔌', 'RS-485'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const BAUDS = [1200, 9600, 19200, 115200], PARS = [['N', 'keine'], ['E', 'gerade'], ['O', 'ungerade']], RLEN = [50, 200, 600, 1200], RRATE = [[9600, '9.600 Baud'], [115200, '115.200 Baud'], [1000000, '1 Mbit/s']];
  const RTERM = [['none', 'Kein Abschluss'], ['end', 'Nur rechts'], ['both', 'Beide Enden']], NAMES = 'ABC';
  const S = {
    tab: lsGet('tab', 'uart'),
    u: Object.assign({ txt: 'Hi', i: 0, baud: 9600, d: 8, par: 'N', stop: 1 }, lsGet('u', {})),
    c: Object.assign({ n: 3, ids: ['980', '930', '810'] }, lsGet('c', {})),
    r: Object.assign({ term: 'none', len: 600, rate: 115200 }, lsGet('r', {})),
    task: null, tq: null, tAns: {}, tRes: null, tFehl: {},
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  /* Gespeicherte Zustände prüfen */
  S.u.txt = String(S.u.txt || '').replace(/[^\x20-\x7e]/g, '').slice(0, 8);
  if (!(S.u.i >= 0 && S.u.i < S.u.txt.length)) S.u.i = 0;
  if (!BAUDS.includes(S.u.baud)) S.u.baud = 9600;
  if (![7, 8].includes(S.u.d)) S.u.d = 8;
  if (!PARS.some(p => p[0] === S.u.par)) S.u.par = 'N';
  if (![1, 2].includes(S.u.stop)) S.u.stop = 1;
  if (![2, 3].includes(S.c.n)) S.c.n = 3;
  if (!Array.isArray(S.c.ids) || S.c.ids.length !== 3 || S.c.ids.some(x => typeof x !== 'string')) S.c.ids = ['980', '930', '810'];
  if (!RTERM.some(t => t[0] === S.r.term)) S.r.term = 'none';
  if (!RLEN.includes(S.r.len)) S.r.len = 600;
  if (!RRATE.some(t => t[0] === S.r.rate)) S.r.rate = 115200;
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const UEB = 'Alle Zahlen in diesem Lab (Baudraten, Längen, Zeiten, Pegel) sind Übungswerte. Maßgebend sind immer die Datenblätter, die Normen und die Regeln deines Betriebs.';
  const ueb = () => `<p class="hint2" style="margin:10px 0 0">⚠ ${esc(UEB)}</p>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const lbl = t => `<span style="font-size:14px;color:var(--mute)">${esc(t)}</span>`;
  const stepsBox = (st, kopf) => st && st.length ? `<div class="steps"><b>${kopf || 'So gehst du vor'}</b><ol>${st.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>` : '';
  const imgHtml = img => { const s = V.taskImg(img); return s ? `<div class="vzbox">${s}</div>` : ''; };
  const bin = (v, n) => { let s = ''; for (let i = n - 1; i >= 0; i--) s += (v >> i) & 1; return s; };

  /* ============================================================ UART */
  function renderUart() {
    const u = S.u;
    $('#uartView').innerHTML = `<div class="card pl"><h4>UART-Oszilloskop</h4>
      <label class="f"><span>Text, der gesendet wird (bis 8 Zeichen)</span><input data-ut maxlength="8" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(u.txt)}"></label>
      <div class="mpb" id="uartChars"></div>
      <div class="ctl">${lbl('Baudrate')}${seg('data-ub', BAUDS.map(b => [b, f(b, 0)]), u.baud)}</div>
      <div class="ctl">${lbl('Datenbits')}${seg('data-ud', [[7, '7'], [8, '8']], u.d)}</div><div class="ctl">${lbl('Parität')}${seg('data-up', PARS, u.par)}</div><div class="ctl">${lbl('Stoppbits')}${seg('data-us', [[1, '1'], [2, '2']], u.stop)}</div>
      <div class="vzbox" id="uartHost"></div><div id="uartOut"></div></div>
      <div class="card pl"><h4>Ausprobieren</h4>${stepsBox(['Tippe ein Zeichen ein und tippe es unten an: Das Bild zeigt genau dieses Zeichen.', 'Schau dir an: Ruhepegel hoch, Startbit niedrig, D0 kommt zuerst, am Ende das Stoppbit.', 'Stelle Parität ein und prüfe, ob die Zahl der Einsen (Daten plus Paritätsbit) gerade oder ungerade ist.', 'Erhöhe die Baudrate: Das Bild bleibt gleich, nur die Zeit je Bit wird kürzer.'], 'Was du tun kannst')}</div>`;
    updateUart();
  }
  function updateUart() {
    const u = S.u, n = C.frameBits(u.d, u.par, u.stop), ch = u.txt[u.i];
    $('#uartChars').innerHTML = u.txt.split('').map((c, i) => `<button data-uc="${i}" class="${i === u.i ? 'on' : ''}" aria-label="Zeichen ${esc(c)}">${c === ' ' ? '␣' : esc(c)}</button>`).join('');
    $$('[data-ub],[data-ud],[data-up],[data-us]', $('#uartView')).forEach(b => { const k = Object.keys(b.dataset)[0], m = { ub: 'baud', ud: 'd', up: 'par', us: 'stop' }[k]; b.classList.toggle('on', String(u[m]) === b.dataset[k]); });
    if (!ch) { $('#uartHost').innerHTML = ''; $('#uartOut').innerHTML = note('Tippe mindestens ein Zeichen ein (Buchstaben, Ziffern oder Satzzeichen).'); return; }
    const v = ch.charCodeAt(0), ones = C.onesCount(v, u.d), ft = C.frameTime(u.baud, u.d, u.par, u.stop);
    $('#uartHost').innerHTML = V.uartSvg({ byte: v, d: u.d, par: u.par, stop: u.stop, baud: u.baud });
    $('#uartOut').innerHTML = box('Zeichen „' + ch + '“', 'ASCII-Code ' + v, bin(v, u.d) + ' (D' + (u.d - 1) + ' bis D0), auf der Leitung zuerst D0')
      + (u.par === 'N' ? '' : box('Paritätsbit (' + (u.par === 'E' ? 'gerade' : 'ungerade') + ')', f(ones, 0) + ' Einsen im Datenwort', String(C.parityBit(v, u.d, u.par))))
      + box('Bitzeit', '1 / ' + f(u.baud, 0) + ' Baud', C.fmtZeit(C.bitTime(u.baud)))
      + box('Bits im Rahmen', '1 Start + ' + u.d + ' Daten' + (u.par === 'N' ? '' : ' + 1 Parität') + ' + ' + u.stop + ' Stopp', f(n, 0) + ' Bit')
      + box('Dauer eines Rahmens', f(n, 0) + ' Bit · Bitzeit', C.fmtZeit(ft))
      + box('Nutzdatenrate', f(u.baud, 0) + ' · ' + u.d + ' / ' + f(n, 0), f(C.netRate(u.baud, u.d, u.par, u.stop), 0) + ' bit/s', 'ok')
      + (u.txt.length > 1 ? box('Ganzer Text mit ' + u.txt.length + ' Zeichen', u.txt.length + ' · ' + C.fmtZeit(ft), C.fmtZeit(u.txt.length * ft)) : '');
  }
  const uv = $('#uartView');
  uv.addEventListener('input', e => { if (!e.target.matches('[data-ut]')) return; const t = e.target.value.replace(/[^\x20-\x7e]/g, '').slice(0, 8); if (t !== e.target.value) e.target.value = t; S.u.txt = t; if (S.u.i >= t.length) S.u.i = Math.max(0, t.length - 1); lsSet('u', S.u); updateUart(); });
  uv.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const u = S.u, d = b.dataset;
    if (d.uc != null) u.i = +d.uc; else if (d.ub) u.baud = +d.ub; else if (d.ud) u.d = +d.ud; else if (d.up) u.par = d.up; else if (d.us) u.stop = +d.us; else return;
    lsSet('u', u); updateUart();
  });

  /* ============================================================ CAN */
  const canIds = () => { const c = S.c, ids = c.ids.slice(0, c.n).map(s => { const v = P(s); return Number.isInteger(v) && v >= 0 && v <= 2047 ? v : NaN; }); return ids.every(Number.isFinite) ? ids : null; };
  function renderCan() {
    const c = S.c;
    $('#canView').innerHTML = `<div class="card pl"><h4>CAN-Arbitrierung</h4>
      <div class="ctl">${lbl('Knoten, die gleichzeitig senden')}${seg('data-cn', [[2, '2'], [3, '3']], c.n)}</div>
      <div class="dsrow" id="canIn">${[0, 1, 2].map(i => `<label class="f" data-cl="${i}"${i >= c.n ? ' hidden' : ''}><span>ID Knoten ${NAMES[i]} (0 bis 2047)</span><input data-cid="${i}" inputmode="numeric" autocomplete="off" value="${esc(c.ids[i])}"></label>`).join('')}</div>
      <div class="btns"><button class="btn" data-ca="rnd">🎲 Zufällige IDs</button></div>
      <div class="vzbox" id="canHost"></div><div id="canOut"></div></div>
      <div class="card pl"><h4>Ausprobieren</h4>${stepsBox(['Ändere eine ID und schau, wer gewinnt.', 'Suche in der Bitfolge das erste Bit, in dem sich die Knoten unterscheiden. Wer dort eine 1 sendet, hört auf.', 'Mache eine ID so klein wie möglich, zum Beispiel 0: Sie gewinnt immer.'], 'Was du tun kannst')}</div>`;
    updateCan();
  }
  function updateCan() {
    const c = S.c, ids = canIds(), a = ids && C.arbitrate(ids, 11);
    $$('[data-cn]', $('#canView')).forEach(b => b.classList.toggle('on', +b.dataset.cn === c.n));
    $$('[data-cl]', $('#canView')).forEach(l => { l.hidden = +l.dataset.cl >= c.n; });
    if (!a) { $('#canHost').innerHTML = ''; $('#canOut').innerHTML = note(ids ? 'Die IDs müssen verschieden sein, sonst gäbe es keinen Sieger.' : 'Trage für jeden Knoten eine ganze Zahl von 0 bis 2047 ein.'); return; }
    $('#canHost').innerHTML = V.canSvg({ ids });
    $('#canOut').innerHTML = box('Sieger', 'kleinste ID', 'Knoten ' + NAMES[a.winner] + ' mit ID ' + f(ids[a.winner], 0) + ' (' + C.idBits(ids[a.winner], 11) + ')', 'ok')
      + ids.map((id, i) => a.lost[i] < 0 ? '' : box('Knoten ' + NAMES[i] + ' (ID ' + f(id, 0) + ')', '', 'gibt beim ID-Bit ' + (a.lost[i] + 1) + ' auf und sendet später noch einmal', 'warn')).join('');
  }
  const cv = $('#canView');
  cv.addEventListener('input', e => { const i = e.target.dataset.cid; if (i == null) return; S.c.ids[+i] = e.target.value; lsSet('c', S.c); updateCan(); });
  cv.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.cn) { S.c.n = +b.dataset.cn; lsSet('c', S.c); updateCan(); }
    else if (b.dataset.ca === 'rnd') {
      const k = C.ri(R0, 2, 5), pre = C.ri(R0, 0, Math.pow(2, k) - 1), ids = []; /* gemeinsamer Anfang: Der Streit wird erst bei einem späteren Bit entschieden */
      while (ids.length < 3) { const x = (pre << (11 - k)) | C.ri(R0, 0, Math.pow(2, 11 - k) - 1); if (!ids.includes(x)) ids.push(x); }
      S.c.ids = ids.map(String); lsSet('c', S.c); $$('[data-cid]', cv).forEach(i => { i.value = S.c.ids[+i.dataset.cid]; }); updateCan();
    }
  });

  /* ============================================================ RS-485 */
  function renderRs() {
    const r = S.r;
    $('#rsView').innerHTML = `<div class="card pl"><h4>RS-485-Leitung</h4>
      <div class="ctl">${lbl('Abschluss')}${seg('data-rt', RTERM, r.term)}</div>
      <div class="ctl">${lbl('Länge')}${seg('data-rl', RLEN.map(l => [l, l + ' m']), r.len)}</div>
      <div class="ctl">${lbl('Datenrate')}${seg('data-rr', RRATE, r.rate)}</div>
      <div class="vzbox" id="rsHost"></div><div id="rsOut"></div></div>
      <div class="card pl"><h4>Ausprobieren</h4>${stepsBox(['Schalte den Abschluss durch: ohne, nur rechts, an beiden Enden.', 'Sieh dir beide Oszilloskopbilder an: Sender links und Sender rechts. Bei „Nur rechts“ ist ein Ende sauber und das andere nicht.', 'Ändere Länge und Datenrate und lies unten, wie lang die Reflexion im Vergleich zu einem Bit ist.'], 'Was du tun kannst')}</div>`;
    updateRs();
  }
  function updateRs() {
    const r = S.r, t1 = C.laufzeit(r.len), tb = C.bitTime(r.rate), ratio = 2 * t1 / tb * 100, m1 = C.rsModel(r.term, true), m2 = C.rsModel(r.term, false);
    $$('[data-rt],[data-rl],[data-rr]', $('#rsView')).forEach(b => { const k = Object.keys(b.dataset)[0], m = { rt: 'term', rl: 'len', rr: 'rate' }[k]; b.classList.toggle('on', String(r[m]) === b.dataset[k]); });
    $('#rsHost').innerHTML = V.rsSvg({ term: r.term });
    $('#rsOut').innerHTML = box('Laufzeit auf der Leitung', f(r.len, 0) + ' m · 5 ns/m', C.fmtZeit(t1))
      + box('Hin und zurück (Reflexion)', '2 · ' + C.fmtZeit(t1), C.fmtZeit(2 * t1))
      + box('Bitzeit', '1 / ' + f(r.rate, 0) + ' Baud', C.fmtZeit(tb))
      + box('Hin und zurück im Vergleich zu einem Bit', C.fmtZeit(2 * t1) + ' / ' + C.fmtZeit(tb), f(ratio, 1) + ' %')
      + box('Überschwinger am rechten / linken Ende', '', f(C.overshoot(m1.steps), 0) + ' % / ' + f(C.overshoot(m2.steps), 0) + ' %')
      /* PRUEFEN P15: Faustregel: dauert Hin und zurück über 10 % einer Bitzeit, braucht die Leitung Abschlüsse an beiden Enden (Übungsregel) */
      + (ratio > 10 ? (r.term === 'both' ? note('Die Reflexion dauert lang gegen die Bitzeit, aber beide Enden sind abgeschlossen: Das Signal bleibt sauber.', 'ok') : note('Die Reflexion dauert mehr als 10 % einer Bitzeit. Ohne Abschluss an beiden Enden stört sie das Signal: Schließe die Leitung an beiden Enden ab.', 'bad'))
        : note('Die Leitung ist im Vergleich zur Bitzeit kurz. Die Reflexion klingt ab, bevor gelesen wird. Ein Abschluss an beiden Enden schadet trotzdem nie.', 'ok'));
  }
  const rv2 = $('#rsView');
  rv2.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const r = S.r, d = b.dataset;
    if (d.rt) r.term = d.rt; else if (d.rl) r.len = +d.rl; else if (d.rr) r.rate = +d.rr; else return;
    lsSet('r', r); updateRs();
  });

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
  function qBody(q, a, r) {
    const lock = r && (r.ok || r.stufe === 'loes');
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${lock ? 'disabled' : ''} class="${lock && i === q.ask.correct ? 'ok' : a.c === i ? (r && !r.ok && r.given === c ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)} (${esc(q.ask.unit)})</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${lock ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div>${eingabeHinweis(q)}</label>`;
  }
  const qHead = q => `<p style="margin:8px 0">${esc(q.text)}</p>${imgHtml(q.img)}${stepsBox(q.steps)}`;
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
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${qHead(q)}${qBody(q, a, r)}`;
      if (r) h += fbHTML(q, r);
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && (r.ok || r.stufe === 'loes') ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r && (r.ok || r.stufe === 'loes')) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`;
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
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
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      sec('UART: der serielle Rahmen', `<div class="vzbox">${V.uartSvg({ byte: 72, d: 8, par: 'E', stop: 1, baud: 9600 })}</div><span class="eq">Bitzeit = 1 / Baudrate</span><span class="eq">Bits im Rahmen = 1 Start + Datenbits + Parität (0 oder 1) + Stoppbits</span><span class="eq">Rahmendauer = Bits im Rahmen · Bitzeit</span><span class="eq">Nutzdatenrate = Baudrate · Datenbits / Bits im Rahmen</span><p>Die UART hat keine Taktleitung (asynchron). Im Ruhezustand liegt die Leitung hoch, das Startbit zieht sie nach unten, D0 kommt zuerst. Beide Seiten brauchen dieselbe Baudrate und denselben Rahmen, sonst gibt es Zeichenmüll oder Rahmenfehler. 8N1 heißt: 8 Datenbits, keine Parität, 1 Stoppbit.</p><p><b>Parität:</b> Bei gerader Parität ergänzt das Paritätsbit die Einsen so, dass ihre Zahl (Daten plus Paritätsbit) gerade ist, bei ungerader entsprechend ungerade. Ein Paritätsbit erkennt einen einzelnen Bitfehler, korrigiert ihn aber nicht.</p>`, true) +
      sec('RS-232 und RS-485', `<div class="vzbox">${V.rsSvg({ term: 'both' })}</div><table><tr><th></th><th>RS-232</th><th>RS-485</th></tr><tr><td>Signal</td><td>Spannung gegen Masse, etwa ±3 V bis ±15 V</td><td>Spannungsunterschied zwischen A und B</td></tr><tr><td>Ruhepegel (1)</td><td>negative Spannung</td><td>A und B nach Vorgabe des Busses</td></tr><tr><td>Teilnehmer</td><td>zwei (Punkt zu Punkt)</td><td>viele an einer Linie</td></tr><tr><td>Länge</td><td>kurz</td><td>bis etwa 1.200 m, bei kleinen Datenraten</td></tr></table><span class="eq">Abschluss: an beide Enden der Linie, je etwa 120 Ω (Wellenwiderstand)</span><span class="eq">Zwei Abschlüsse parallel: 1 / R = 1 / 120 Ω + 1 / 120 Ω, also 60 Ω</span><span class="eq">Reflexionsfaktor = (R − Z) / (R + Z)</span><span class="eq">Laufzeit hin und zurück = 2 · Länge · 5 ns/m</span><p>Ohne Abschluss wird das Signal am offenen Ende zurückgeworfen und überlagert die nächsten Bits. Verdrahte als Linie mit kurzen Stichen, nicht als Stern.</p>`) +
      sec('CAN-Bus', `<div class="vzbox">${V.canSvg({ ids: [980, 930, 810] })}</div><p>CAN-Knoten hängen mit CAN_H und CAN_L (verdrillt) an einem Bus mit 120 Ω an beiden Enden. Dominant (0) setzt sich gegen rezessiv (1) durch. Die ID wird mit dem höchstwertigen Bit zuerst gesendet: Die kleinste ID gewinnt die Arbitrierung. Verlierer hören auf und senden später noch einmal, die Nachricht des Gewinners geht nicht verloren.</p><span class="eq">Rahmen (11-Bit-ID) = 47 Bit + 8 Bit · Datenbyte, ohne Stopfbits</span><span class="eq">Rahmendauer = Bits / Bitrate</span><table><tr><th>Länge (Faustwerte)</th><th>höchste Bitrate</th></tr><tr><td>bis 40 m</td><td>1 Mbit/s</td></tr><tr><td>bis 100 m</td><td>500 kbit/s</td></tr><tr><td>bis 250 m</td><td>250 kbit/s</td></tr><tr><td>bis 500 m</td><td>125 kbit/s</td></tr></table><p>Messung am abgeschalteten Bus zwischen CAN_H und CAN_L: etwa 60 Ω ist in Ordnung, etwa 120 Ω heißt ein Abschluss fehlt, etwa 40 Ω heißt ein dritter ist eingebaut.</p>`) +
      sec('USB, Ethernet und Modbus', `<ul><li><b>USB:</b> Ein Host steuert alles, Hubs verzweigen als Baum. Beim Anstecken erkennt der Host das Gerät (Enumeration). Klassische Versorgung: 5 V.</li><li><b>Ethernet:</b> Stern mit einem Switch, Strecke bis etwa 100 m auf Twisted Pair. Jedes Gerät hat eine MAC-Adresse mit 48 Bit. Am Ende jedes Rahmens steht eine 32-Bit-CRC.</li><li><b>Modbus:</b> Der Master fragt, der Slave antwortet. Daten liegen in Registern mit 16 Bit. Der Funktionscode sagt, was getan wird. Modbus RTU läuft seriell mit CRC-16, Modbus TCP über Ethernet auf Port 502.</li></ul><span class="eq">Übertragungszeit = Datenmenge in Bit / Rate</span><span class="eq">Byte pro Tag = Byte je Telegramm · Telegramme pro Tag</span>`) +
      sec('Funk und Pegel', `<span class="eq">P in dBm = 10 · lg(P / 1 mW)</span><span class="eq">0 dBm = 1 mW · +3 dB = etwa doppelte Leistung · +10 dB = zehnfache Leistung</span><span class="eq">Empfangspegel = Sendepegel − Dämpfung</span><span class="eq">Reserve = Empfangspegel − Mindestpegel des Empfängers</span><span class="eq">Sendezeit je Stunde = 3.600 s · Duty Cycle</span><p>Niedrigere Frequenz (868 MHz) reicht meist weiter und kommt besser durch Wände als 2,4 GHz, hat aber weniger Datenrate. WLAN ist schnell und kurz, Bluetooth Low Energy spart Strom auf wenige Meter, LoRa schafft kleine Datenmengen über Kilometer, NFC reicht nur wenige Zentimeter.</p>`) +
      /* PRUEFEN P16: Hamming-Abstand d: erkennen bis d - 1, korrigieren bis (d - 1) / 2 abgerundet; I²C-Zeit (1 + n) · 9 Takte */
      sec('Fehler erkennen', `<span class="eq">Hamming-Abstand = Zahl der Stellen, an denen sich zwei Codewörter unterscheiden</span><span class="eq">erkennen: bis d − 1 Bitfehler · korrigieren: bis (d − 1) / 2, abgerundet</span><span class="eq">8-Bit-Summe = Summe aller Bytes mod 256</span><p>Parität erkennt nur eine ungerade Zahl von Bitfehlern. Die Summe merkt nicht, wenn Bytes vertauscht werden. Eine CRC erkennt viel mehr (Ethernet: 32 Bit, Modbus RTU: 16 Bit, CAN: 15 Bit). Erkennen heißt noch nicht korrigieren: Bei Fehler wird das Telegramm verworfen und neu gesendet.</p>`) +
      sec('Vergleich der Busse', `<table><tr><th>Bus</th><th>Leitungen</th><th>Takt</th><th>Typisch</th></tr><tr><td>I²C</td><td>SDA, SCL</td><td>vom Master</td><td>Chips auf der Platine, Adressen</td></tr><tr><td>SPI</td><td>SCK, MOSI, MISO, CS</td><td>vom Master</td><td>schnell, Platine, CS je Chip</td></tr><tr><td>UART</td><td>TxD, RxD, GND</td><td>keiner</td><td>zwei Geräte, kurze Strecke</td></tr><tr><td>RS-485</td><td>A, B</td><td>keiner</td><td>Halle, lange Linie, Master fragt</td></tr><tr><td>CAN</td><td>CAN_H, CAN_L</td><td>keiner</td><td>Maschine, Nachrichten mit ID</td></tr></table><span class="eq">I²C: Zeit = (1 + Datenbytes) · 9 Takte / Taktfrequenz, ohne Start und Stopp</span>`) + ueb();
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'uart'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ uart: renderUart, can: renderCan, rs: renderRs, tasks: renderTasks, rt: renderTrainer, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Bus-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Bus-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('uart');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe und Formeln', 'UART, RS-485, CAN, Modbus, Funk, Fehlererkennung'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.BUS_LAB = { id: 'bus', title: 'Bus-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.BUS_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'uart');
  /* Aufruf ?aufgabe=bus1 öffnet die Aufgabe */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
