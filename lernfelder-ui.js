'use strict';
/* Tonfunk Lab: Oberfläche der Seite lernfelder.html (Lehrjahr-Reiter, Lernfeld-Karten, Aufgabenliste mit Lernstand, Probetest mit Zeitlimit und IHK-Note).
   Daten und Logik stehen in lernfelder.js (LERNFELDER); der Lernstand kommt wie im Lernpfad aus sim.done und lm4.tdone (Prozent je Aufgaben-ID, 100 = gelöst).
   Der Fragenpool (pruefbank*.js, pruefpool.js, rund 1 MB) wird erst beim ersten Öffnen eines Probetests nachgeladen.
   Gebaut nur mit createElement/textContent (keine fremden Texte als HTML). */
(function (root) {
  const L = root.LERNFELDER, doc = root.document;
  if (!L || !doc) return;
  const app = doc.getElementById('lfApp'); if (!app) return;
  const REG = root.LAB_REG || {}, ROWS = root.AUFGABEN || [];
  const POOL_JS = ['pruefbank.js', 'pruefbank-schule.js', 'pruefbank-beruf.js', 'pruefpool.js'];
  const S = { lj: 2, lf: null, tab: 'auf', filter: 'alle', pt: null, timer: 0, poolState: 'none' };
  const ZU = L.zuordnung(ROWS), NEU = {}; L.NEU_V48_163.forEach(i => { NEU[i] = 1; });
  const LABORDER = Object.keys(REG);

  /* ---------- Hilfen ---------- */
  function h(tag, props, kids) {
    const e = doc.createElement(tag);
    Object.keys(props || {}).forEach(k => {
      const v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : String(v));
    });
    (kids || []).forEach(c => { if (c == null || c === false) return; e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return e;
  }
  const clear = e => { while (e.firstChild) e.removeChild(e.firstChild); };
  const lsGet = (k, d) => { try { const v = JSON.parse(root.localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const results = () => { const m = {}; [lsGet('sim.done', {}), lsGet('lm4.tdone', {})].forEach(o => Object.keys(o || {}).forEach(k => { const v = +o[k] || 0; if (v > (m[k] || 0)) m[k] = v; })); return m; };
  const probeStore = () => { const o = lsGet('lm4.lf', {}); return (o && typeof o === 'object' && o.probe && typeof o.probe === 'object') ? o : { probe: {} }; };
  const de = x => String(+(+x).toPrecision(4)).replace('.', ',');
  const query = k => { try { const m = new RegExp('[?&]' + k + '(?:=([^&#]*))?(?=[&#]|$)').exec(root.location.search || ''); return m ? decodeURIComponent(m[1] || '') : null; } catch (e) { return null; } };
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); return (m < 10 ? '0' : '') + m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); };
  const bar = pct => { const i = h('i'); i.style.width = Math.max(0, Math.min(100, pct)) + '%'; return h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct }, [i]); };
  const rowsOf = k => (ZU.byLf[k] || []).slice().sort((a, b) => (LABORDER.indexOf(a[1]) - LABORDER.indexOf(b[1])) || (a[4] - b[4]));
  const stopTimer = () => { if (S.timer) { root.clearInterval(S.timer); S.timer = 0; } };

  /* ---------- Kopf: Lehrjahr-Reiter ---------- */
  function lfOfLj(lj) { return L.LF.filter(l => l.lj === lj); }
  function tabs() {
    const res = results(), box = h('div', { class: 'tabs', id: 'tabs', role: 'tablist', 'aria-label': 'Lehrjahr' });
    L.LJ.forEach(j => {
      const rows = lfOfLj(j.lj).reduce((a, l) => a.concat(rowsOf(l.k)), []), st = L.stand(rows, res);
      box.appendChild(h('button', { type: 'button', role: 'tab', 'aria-selected': String(S.lj === j.lj), onclick: () => { stopTimer(); S.lj = j.lj; S.lf = null; S.pt = null; render(); } }, [j.t, h('small', { text: st.done + '/' + st.n })]));
    });
    return box;
  }
  /* ---------- Karten ---------- */
  function cards() {
    const res = results(), best = probeStore().probe, g = h('div', { class: 'grid' });
    lfOfLj(S.lj).forEach(l => {
      const st = L.stand(rowsOf(l.k), res), b = best[l.k];
      g.appendChild(h('button', { type: 'button', class: 'lfc', 'data-lf': l.k, 'aria-pressed': String(S.lf === l.k), onclick: () => { stopTimer(); S.lf = l.k; S.tab = 'auf'; S.filter = 'alle'; S.pt = null; render(true); } }, [
        h('span', {}, [h('span', { class: 'k', text: l.k }), h('b', { text: l.t.replace(/^LF [0-9.]+: |^LF [0-9.]+ Labor: |^LF[0-9]*: |^E[0-9]+: |^Grundlagen E[0-9]: /, '') })]),
        bar(st.pct),
        h('span', { class: 'meta' }, [h('span', { text: st.done + ' von ' + st.n + ' Aufgaben gelöst' }), h('span', { text: b ? 'Probetest: Note ' + b.note : 'Probetest offen' })])
      ]));
    });
    return g;
  }
  /* ---------- Detail ---------- */
  function detail() {
    const l = L.lf(S.lf), res = results(), rows = rowsOf(l.k), st = L.stand(rows, res);
    const box = h('div', { class: 'card', id: 'detail' });
    box.appendChild(h('h2', { text: l.t }));
    box.appendChild(h('div', { class: 'chips' }, l.themen.map(t => h('span', { class: 'chip', text: t })).concat(l.mit ? [] : [h('span', { class: 'chip warn', text: 'ohne eigene Mitschrift, nach Lernfeldtitel eingeordnet' })])));
    box.appendChild(bar(st.pct));
    box.appendChild(h('div', { class: 'meta', style: 'margin:4px 0 8px' }, [h('span', { text: st.done + ' von ' + st.n + ' gelöst, ' + st.begun + ' begonnen, ' + (st.n - st.done - st.begun) + ' offen' }), h('span', { text: st.pct + ' %' })]));
    box.appendChild(h('div', { class: 'seg', role: 'tablist' }, [
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(S.tab === 'auf'), onclick: () => { stopTimer(); S.tab = 'auf'; S.pt = null; render(); } }, ['Aufgaben']),
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(S.tab === 'probe'), onclick: () => { S.tab = 'probe'; render(); ensurePool(); } }, ['Probetest'])
    ]));
    box.appendChild(S.tab === 'probe' ? probeView(l) : tasksView(l, rows, res));
    return box;
  }
  function tasksView(l, rows, res) {
    const wrap = h('div'), f = S.filter;
    const flt = h('div', { class: 'seg', 'aria-label': 'Filter' }, [['alle', 'Alle'], ['offen', 'Offen'], ['gelöst', 'Gelöst']].map(p => h('button', { type: 'button', 'aria-pressed': String(f === p[0]), onclick: () => { S.filter = p[0]; render(); } }, [p[1]])));
    wrap.appendChild(flt);
    const show = rows.filter(r => { const v = +res[r[0]] || 0; return f === 'alle' || (f === 'gelöst' ? v >= 100 : v < 100); });
    if (!show.length) wrap.appendChild(h('p', { class: 'lead', text: f === 'gelöst' ? 'Hier ist noch nichts gelöst.' : 'Alles gelöst. Stark!' }));
    let lab = '';
    show.forEach(r => {
      if (r[1] !== lab) { lab = r[1]; wrap.appendChild(h('div', { class: 'labh', text: (REG[lab] && REG[lab].name) || lab })); }
      const v = +res[r[0]] || 0, R = REG[r[1]], href = R ? R.file + '?aufgabe=' + encodeURIComponent(r[0]) : '#';
      wrap.appendChild(h('div', { class: 'task' }, [
        h('div', { class: 'tt' }, [h('a', { href, text: r[3] }), h('small', { text: r[2] + ' · Stufe ' + r[4] + (NEU[r[0]] ? ' · neu in v48.163' : '') })]),
        h('span', { class: 'st ' + (v >= 100 ? 'ok' : v > 0 ? 'mid' : ''), text: v >= 100 ? 'gelöst' : v > 0 ? v + ' %' : 'offen' })
      ]));
    });
    return wrap;
  }

  /* ---------- Probetest ---------- */
  function ensurePool() {   // lädt den Fragenpool einmal nach und zeichnet danach neu
    if (root.PR_POOL && root.PR_BANK && root.PR_BANK.MC) { S.poolState = 'ok'; return; }
    if (S.poolState === 'loading') return;
    S.poolState = 'loading';
    let i = 0;
    const done = ok => { S.poolState = ok ? 'ok' : 'err'; render(); };
    const next = () => {
      if (i >= POOL_JS.length) { done(!!(root.PR_POOL && root.PR_BANK)); return; }
      const sc = doc.createElement('script'); sc.src = POOL_JS[i++]; sc.onload = next; sc.onerror = () => done(false);
      doc.head.appendChild(sc);
    };
    next();
  }
  function poolReady() { return !!(root.PR_POOL && root.PR_BANK && root.PR_BANK.MC); }
  function probeView(l) {
    const w = h('div');
    if (S.pt && S.pt.phase === 'run') return runView(l);
    if (S.pt && S.pt.phase === 'result') return resultView(l);
    if (!poolReady()) {
      w.appendChild(h('p', { class: 'lead', text: S.poolState === 'err' ? 'Der Fragenpool konnte nicht geladen werden. Öffne die Seite einmal mit Netz, danach geht es offline.' : 'Fragenpool wird geladen …' }));
      return w;
    }
    const z = L.fragenZahl(root.PR_POOL, root.PR_BANK.MC)[l.k], p = L.probe(l.k, root.PR_POOL, root.PR_BANK.MC, { n: L.STD_FRAGEN, seed: 1 });
    w.appendChild(h('p', { text: 'Passende Fragen im Prüfungs-Pool: ' + z.n + ' (' + z.mc + ' Mehrfachwahl, ' + z.num + ' Rechnen). Gezogen werden höchstens ' + L.STD_FRAGEN + ' Fragen, davon höchstens ein Viertel zum Rechnen.' }));
    if (!p.ok) {
      w.appendChild(h('div', { class: 'warnbox', role: 'status', text: p.grund }));
    } else {
      w.appendChild(h('p', { text: 'Zeitlimit: etwa ' + p.minuten + ' Minuten (' + L.MIN_JE_A + ' Min je Mehrfachwahl-Frage, ' + L.MIN_JE_B + ' Min je Rechenaufgabe, wie in der Abschlussprüfung). Du kannst den Test nicht unterbrechen; läuft die Zeit ab, wird er abgegeben.' }));
      if (p.kurz) w.appendChild(h('div', { class: 'note', text: 'Für dieses Lernfeld gibt es weniger als ' + L.STD_FRAGEN + ' passende Fragen. Der Test ist deshalb kürzer, es wird nichts aufgefüllt.' }));
      w.appendChild(h('button', { type: 'button', class: 'btn pri', id: 'ptStart', onclick: () => startProbe(l) }, ['Probetest starten']));
    }
    const b = probeStore().probe[l.k];
    if (b) w.appendChild(h('p', { class: 'lead', style: 'margin-top:10px', text: 'Dein bester Versuch: Note ' + b.note + ' (' + b.pct + ' %), ' + b.versuche + ' Versuch' + (b.versuche === 1 ? '' : 'e') + '.' }));
    w.appendChild(h('details', {}, [h('summary', { text: 'Notenschlüssel nach IHK' }), keyTable()]));
    w.appendChild(h('p', { class: 'lead', style: 'font-size:13px', text: 'Die Fragen stammen aus dem Prüfungs-Pool des Prüfungs-Labs (eigene Formulierungen, noch nicht vom Ausbilder fachlich freigegeben). Die Zuordnung der Fragen zum Lernfeld erfolgt automatisch nach Thema und kann ungenau sein.' }));
    return w;
  }
  function keyTable() {
    const rows = [[100, 92, 1, 'sehr gut'], [91, 81, 2, 'gut'], [80, 67, 3, 'befriedigend'], [66, 50, 4, 'ausreichend'], [49, 30, 5, 'mangelhaft'], [29, 0, 6, 'ungenügend']];
    return h('table', {}, [h('tr', {}, ['Prozent', 'Note'].map(t => h('th', { text: t })))].concat(rows.map(r => h('tr', {}, [h('td', { text: r[1] + ' bis ' + r[0] + ' %' }), h('td', { text: r[2] + ' (' + r[3] + ')' })]))));
  }
  function startProbe(l) {
    const p = L.probe(l.k, root.PR_POOL, root.PR_BANK.MC, { n: L.STD_FRAGEN, seed: (Date.now() % 1000000007) + 1 });
    if (!p.ok) { S.pt = null; render(); return; }
    S.pt = { phase: 'run', lf: l.k, items: p.items, ans: {}, i: 0, start: Date.now(), limit: p.minuten * 60000, confirm: false, kurz: p.kurz };
    stopTimer(); S.timer = root.setInterval(tick, 1000);
    render();
  }
  function tick() {
    const t = S.pt; if (!t || t.phase !== 'run') { stopTimer(); return; }
    const left = t.limit - (Date.now() - t.start), el = doc.getElementById('ptTime');
    if (left <= 0) { finish('Zeit abgelaufen'); return; }
    if (el) { el.textContent = mmss(left); el.className = 'timer' + (left < 5 * 60000 ? ' low' : ''); }
  }
  function runView(l) {
    const t = S.pt, q = t.items[t.i], w = h('div');
    const left = t.limit - (Date.now() - t.start);
    w.appendChild(h('div', { class: 'pt-head' }, [
      h('span', { text: 'Frage ' + (t.i + 1) + ' von ' + t.items.length }),
      h('span', { class: 'timer' + (left < 5 * 60000 ? ' low' : ''), id: 'ptTime', role: 'timer', 'aria-label': 'Restzeit', text: mmss(left) })
    ]));
    w.appendChild(h('div', { class: 'dots' }, t.items.map((x, i) => h('button', { type: 'button', class: t.ans[x.id] != null && t.ans[x.id] !== '' ? 'done' : '', 'aria-current': String(i === t.i), 'aria-label': 'Frage ' + (i + 1), onclick: () => { t.i = i; t.confirm = false; render(); }, text: String(i + 1) }))));
    w.appendChild(h('div', { class: 'q', text: q.q }));
    if (q.type === 'mc') {
      q.opts.forEach((o, i) => {
        const inp = h('input', { type: 'radio', name: 'ptq', value: i, checked: t.ans[q.id] === i, onchange: () => { t.ans[q.id] = i; render(); } });
        w.appendChild(h('label', { class: 'opt' + (t.ans[q.id] === i ? ' sel' : '') }, [inp, h('span', { text: o })]));
      });
    } else {
      w.appendChild(h('label', { for: 'ptNum', class: 'sr', text: 'Antwort' }));
      const inp = h('input', { type: 'text', id: 'ptNum', class: 'numin', inputmode: 'decimal', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', value: t.ans[q.id] == null ? '' : t.ans[q.id], placeholder: 'Zahl, Komma erlaubt', oninput: e => { t.ans[q.id] = e.target.value; } });
      w.appendChild(h('div', {}, [inp, q.unit ? h('span', { style: 'margin-left:8px', text: q.unit }) : null]));
      w.appendChild(h('p', { class: 'lead', style: 'font-size:13px', text: 'Rechenaufgabe: Gib das Ergebnis mit der angegebenen Einheit als Zahl ein. Eine kleine Rundungsabweichung ist erlaubt.' }));
    }
    w.appendChild(h('div', { class: 'seg' }, [
      h('button', { type: 'button', disabled: t.i === 0, onclick: () => { t.i--; t.confirm = false; render(); } }, ['Zurück']),
      h('button', { type: 'button', disabled: t.i === t.items.length - 1, onclick: () => { t.i++; t.confirm = false; render(); } }, ['Weiter']),
      h('button', { type: 'button', class: 'btn pri', id: 'ptEnd', onclick: () => { if (!t.confirm) { t.confirm = true; render(); } else finish('abgegeben'); } }, [t.confirm ? 'Ja, jetzt abgeben' : 'Abgeben'])
    ]));
    if (t.confirm) w.appendChild(h('p', { class: 'note', text: 'Noch ' + t.items.filter(x => t.ans[x.id] == null || t.ans[x.id] === '').length + ' Frage(n) ohne Antwort. Zum Abgeben tippe noch einmal.' }));
    return w;
  }
  function finish(grund) {
    const t = S.pt; if (!t || t.phase !== 'run') return;
    stopTimer();
    const r = L.bewerte(t.items, t.ans); t.phase = 'result'; t.res = r; t.grund = grund; t.used = Math.min(Date.now() - t.start, t.limit);
    const o = probeStore(), b = o.probe[t.lf] || { pct: -1, note: 6, versuche: 0 };
    o.probe[t.lf] = { pct: Math.max(b.pct, r.pct), note: Math.min(b.note || 6, r.note[0]), versuche: (b.versuche || 0) + 1, t: Date.now() };
    if (b.pct > r.pct) o.probe[t.lf].note = b.note;
    lsSet('lm4.lf', o);
    render();
  }
  const ansText = q => q.type === 'mc' ? q.opts[q.r] : de(q.ans) + (q.unit ? ' ' + q.unit : '');
  const yourText = (q, a) => (a == null || a === '') ? '(keine Antwort)' : q.type === 'mc' ? q.opts[a] : String(a) + (q.unit ? ' ' + q.unit : '');
  function resultView(l) {
    const t = S.pt, r = t.res, w = h('div');
    w.appendChild(h('div', { class: 'score', role: 'status', text: 'Note ' + r.note[0] + ' (' + r.note[1] + ')' }));
    w.appendChild(h('p', { text: r.pct + ' % · ' + r.pts + ' von ' + r.max + ' Punkten · ' + r.richtig + ' von ' + r.n + ' Fragen richtig · ' + (r.bestanden ? 'bestanden (ab 50 %)' : 'nicht bestanden (unter 50 %)') + ' · Zeit: ' + mmss(t.used) + (t.grund === 'Zeit abgelaufen' ? ' (Zeit abgelaufen)' : '') }));
    t.items.forEach((q, i) => {
      const ok = L.isRight(q, t.ans[q.id]);
      w.appendChild(h('div', { class: 'res ' + (ok ? 'r' : 'f') }, [
        h('b', { class: ok ? 'r' : 'f', text: (ok ? 'Richtig' : 'Falsch') + ' · Frage ' + (i + 1) }),
        h('div', { text: q.q, style: 'white-space:pre-wrap;margin:4px 0' }),
        h('div', { text: 'Deine Antwort: ' + yourText(q, t.ans[q.id]) }),
        ok ? null : h('div', { text: 'Richtig: ' + ansText(q) }),
        q.w ? h('details', {}, [h('summary', { text: 'Erklärung' }), h('p', { text: q.w })]) : null
      ]));
    });
    w.appendChild(h('div', { class: 'seg' }, [
      h('button', { type: 'button', class: 'btn pri', onclick: () => { S.pt = null; render(); } }, ['Neuer Probetest']),
      h('button', { type: 'button', onclick: () => { S.pt = null; S.tab = 'auf'; render(); } }, ['Zu den Aufgaben'])
    ]));
    return w;
  }

  /* ---------- Gesamtansicht ---------- */
  function render(scrollToDetail) {
    clear(app);
    app.appendChild(tabs());
    const l = S.lf && L.lf(S.lf);
    if (l && l.lj !== S.lj) S.lf = null;
    app.appendChild(cards());
    if (S.lf) app.appendChild(detail());
    else app.appendChild(h('p', { class: 'lead', text: 'Wähle ein Lernfeld, um die Aufgaben und den Probetest zu sehen.' }));
    app.appendChild(h('p', { class: 'lead', style: 'font-size:13px', text: 'Die Einteilung der Aufgaben in Lernfelder ist ein Entwurf nach Inhalt und den Mitschriften der Berufsschule. Aufgaben, die in keinem einzelnen Lernfeld liegen (Tagesaufgabe, Duell, Probeprüfungen, Regelung, EMV, App-Werkstatt), stehen hier nicht. Dein Stand liegt nur auf diesem Gerät.' }));
    if (scrollToDetail && S.lf) { const d = doc.getElementById('detail'); if (d && d.scrollIntoView) { try { d.scrollIntoView({ block: 'start' }); } catch (e) {} } }
  }
  const lf0 = query('lf');
  if (lf0 && L.lf(lf0)) { S.lf = lf0; S.lj = L.lf(lf0).lj; if (query('probe') != null) S.tab = 'probe'; }
  render();
  if (S.lf && S.tab === 'probe') ensurePool();
  root.LernfelderUI = { state: S, render, startProbe, finish };
})(typeof window !== 'undefined' ? window : globalThis);
