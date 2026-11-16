/* rg2ui.js - Regelungstechnik Aufbau: Gerüst der Oberfläche (Zustand, Reiter, Regler, Aufgabenansicht, Darstellung hell/dunkel).
 * Die sechs Blöcke (interaktive Visualisierungen) stehen in rg2blk.js und melden sich bei UI.BLK an. Alle Texte kommen aus rg2data.js, alle Zahlen aus rg2core.js.
 * Speicher: lm4.rg2.state (Reglerstände), lm4.rg2.prog (Aufgabenfortschritt), lm4.rg2.tab, lm4.rg2.theme. Jeder Zugriff ist abgesichert (try/catch). */
(function (root) {
  'use strict';
  const R = root.RG2, D = root.RG2DATA, V = root.RG2VIZ;
  const f = D.fmt;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ohne Speicher weiterarbeiten */ } }
  };
  const KEY = { state: 'lm4.rg2.state', prog: 'lm4.rg2.prog', tab: 'lm4.rg2.tab', theme: 'lm4.rg2.theme' };
  const reduceMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  const UI = { BLK: {}, S: null, R: R, D: D, V: V, f: f, esc: esc, $: $, $$: $$, LS: LS, reduceMotion: reduceMotion };
  const S = { tab: 'b1', st: {}, prog: {}, tk: { block: 0, id: null, view: 'list', val: {}, fb: {} } };
  UI.S = S;

  /* ------------------------------------------------------------ Hilfen für Blöcke */
  const roundSig = (x, k) => { if (!isFinite(x) || x === 0) return x; const m = Math.pow(10, k - 1 - Math.floor(Math.log10(Math.abs(x)))); return Math.round(x * m) / m; };
  UI.roundSig = roundSig;
  const posToVal = (pos, o) => { const t = pos / 1000; return o.log ? o.min * Math.pow(o.max / o.min, t) : o.min + (o.max - o.min) * t; };
  const valToPos = (v, o) => { v = Math.min(o.max, Math.max(o.min, v)); return Math.round(1000 * (o.log ? Math.log(v / o.min) / Math.log(o.max / o.min) : (v - o.min) / (o.max - o.min))); };
  const fmtVal = (v, o) => f(v, o.dec == null ? 2 : o.dec) + (o.unit ? ' ' + o.unit : '');
  /* Schieberegler: o = { min, max, log, dec, unit, step (Rundung), snap } */
  UI.slider = function (b, key, label, o) {
    const st = S.st[b], v = st[key] != null ? st[key] : o.min, id = b + '-' + key;
    return '<div class="ctl"><div class="lb"><span id="lb-' + id + '">' + label + '</span><b id="v-' + id + '">' + esc(fmtVal(v, o)) + '</b></div>' +
      '<input type="range" min="0" max="1000" step="1" value="' + valToPos(v, o) + '" data-b="' + b + '" data-k="' + key + '" data-min="' + o.min + '" data-max="' + o.max + '" data-log="' + (o.log ? 1 : 0) + '" data-dec="' + (o.dec == null ? 2 : o.dec) + '" data-unit="' + esc(o.unit || '') + '" data-snap="' + (o.snap || 0) + '" aria-labelledby="lb-' + id + '"></div>';
  };
  UI.seg = function (b, key, opts, label) {
    const st = S.st[b];
    return (label ? '<div class="note" style="margin:6px 0 0">' + label + '</div>' : '') + '<div class="seg" role="group"' + (label ? ' aria-label="' + esc(label) + '"' : '') + '>' + opts.map(o => '<button type="button" data-act="set" data-b="' + b + '" data-k="' + key + '" data-v="' + esc(o[0]) + '" class="' + (String(st[key]) === String(o[0]) ? 'on' : '') + '" aria-pressed="' + (String(st[key]) === String(o[0])) + '">' + esc(o[1]) + '</button>').join('') + '</div>';
  };
  UI.chk = (b, key, label) => '<label class="chk"><input type="checkbox" data-act="chk" data-b="' + b + '" data-k="' + key + '"' + (S.st[b][key] ? ' checked' : '') + '><span>' + label + '</span></label>';
  UI.select = (b, key, opts, label) => '<label class="f"><span>' + label + '</span><select data-act="sel" data-b="' + b + '" data-k="' + key + '">' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (String(S.st[b][key]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></label>';
  UI.badge = cls => '<span class="bad ' + (cls === 'stabil' ? 'ok' : cls === 'grenzstabil' ? 'warn' : 'err') + '">' + esc(cls) + '</span>';
  UI.kv = rows => '<dl class="kv">' + rows.map(r => '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>').join('') + '</dl>';
  UI.rootsText = function (rs) {
    const out = [], used = new Array(rs.length).fill(false), tol = 1e-9;
    rs.forEach((z, i) => {
      if (used[i]) return;
      if (Math.abs(z.im) <= tol * Math.max(1, Math.abs(z.re))) { out.push(f(z.re, 3)); used[i] = true; return; }
      const j = rs.findIndex((w, k) => k !== i && !used[k] && Math.abs(w.re - z.re) < 1e-6 * Math.max(1, Math.abs(z.re)) && Math.abs(w.im + z.im) < 1e-6 * Math.max(1, Math.abs(z.im)));
      used[i] = true; if (j >= 0) used[j] = true;
      out.push(f(z.re, 3) + ' ± j ' + f(Math.abs(z.im), 3));
    });
    return out.length ? out : ['keine'];
  };
  UI.fmtT = x => x == null || !isFinite(x) ? '–' : (Math.abs(x) < 0.1 ? f(x * 1000, 1) + ' ms' : f(x, 2) + ' s');
  UI.legend = items => '<div class="legend" role="list">' + items.map(it => '<span role="listitem" style="color:' + it.color + '"><i class="' + (it.dash === 1 ? 'd1' : it.dash === 2 ? 'd2' : '') + '"></i><span style="color:var(--fg)">' + esc(it.label) + '</span></span>').join('') + '</div>';
  UI.cleanBlow = function (r, lim) {   // Antwort kürzen, sobald sie über die Grenze läuft (instabile Kreise)
    let k = r.y.findIndex(v => !isFinite(v) || Math.abs(v) > lim); if (k < 0) return { t: r.t, y: r.y, cut: false };
    k = Math.max(2, k + 1); return { t: r.t.slice(0, k), y: r.y.slice(0, k), cut: true };
  };
  UI.canvas = (id, cls, label) => '<div class="cvbox"><canvas id="' + id + '" class="' + cls + '" role="img" aria-label="' + esc(label) + '"></canvas><div class="readout" id="' + id + '-ro" aria-live="off"></div></div>';
  /* zeichnet auf ein Canvas; fn(ctx, W, H, pal) liefert die Flächenobjekte (für die Zeigerauswertung) */
  UI.draw = function (id, fn) {
    const cv = document.getElementById(id); if (!cv) return null;
    const { ctx, W, H } = V.fit(cv), pal = V.palette(cv);
    cv._W = W; cv._H = H;
    try { cv._P = fn(ctx, W, H, pal); } catch (e) { cv._P = null; if (window.console) console.warn('rg2: Zeichenfehler in ' + id, e); }
    return cv._P;
  };
  /* Zeigerauswertung: fn(px, py, P) -> Text */
  UI.hover = function (id, fn) {
    const cv = document.getElementById(id), ro = document.getElementById(id + '-ro'); if (!cv || !ro || cv._hov) return; cv._hov = true;
    const go = ev => { const r = cv.getBoundingClientRect(); if (!r.width || !r.height) return; const px = (ev.clientX - r.left) * (cv._W || r.width) / r.width, py = (ev.clientY - r.top) * (cv._H || r.height) / r.height; let t = ''; try { t = cv._P ? fn(px, py, cv._P) : ''; } catch (e) { t = ''; } if (t) ro.textContent = t; };
    cv.addEventListener('pointermove', go); cv.addEventListener('pointerdown', go);
  };
  UI.toast = msg => { const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(UI._tt); UI._tt = setTimeout(() => t.classList.remove('on'), 2200); };
  UI.save = () => LS.set(KEY.state, S.st);
  UI.goTasks = function (block) { S.tk.block = block || 0; S.tk.view = 'list'; const first = D.TASKS.filter(t => !block || t.block === block); const open = first.find(t => !(S.prog[t.id] && S.prog[t.id].ok)) || first[0]; S.tk.id = open ? open.id : null; UI.setTab('tasks'); };

  /* ------------------------------------------------------------ Darstellung */
  function applyTheme(mode) {
    const el = document.documentElement;
    if (mode === 'light' || mode === 'dark') el.setAttribute('data-theme', mode); else el.removeAttribute('data-theme');
    const ic = $('#bThemeIc'); if (ic) ic.textContent = mode === 'light' ? '☀' : mode === 'dark' ? '☾' : '◐';
    const b = $('#bTheme'); if (b) b.setAttribute('aria-label', 'Darstellung: ' + (mode === 'light' ? 'hell' : mode === 'dark' ? 'dunkel' : 'automatisch') + ' (zum Wechseln antippen)');
  }
  /* Welle 2: Darstellung gilt für die ganze App: Schlüssel lm4.theme (roher Text light/dark, wie die Startseite), auto = Eintrag fehlt. Der alte Schlüssel lm4.rg2.theme wird nicht mehr gelesen. */
  UI.themeMode = () => { let m = 'auto'; try { m = localStorage.getItem('lm4.theme') || 'auto'; } catch (e) { /* ohne Speicher */ } return m === 'light' || m === 'dark' ? m : 'auto'; };
  function cycleTheme() { const m = UI.themeMode(), nx = m === 'auto' ? 'light' : m === 'light' ? 'dark' : 'auto'; try { if (nx === 'auto') localStorage.removeItem('lm4.theme'); else localStorage.setItem('lm4.theme', nx); } catch (e) { /* ohne Speicher */ } applyTheme(nx); UI.toast('Darstellung: ' + (nx === 'light' ? 'hell' : nx === 'dark' ? 'dunkel' : 'automatisch (wie das Gerät)')); UI.refresh(); }

  /* ------------------------------------------------------------ Reiter und Seiten */
  const TABS = () => D.BLOCKS.map(b => ({ id: 'b' + b.id, label: b.tab })).concat([{ id: 'tasks', label: 'Aufgaben' }]);
  const solvedCount = () => D.TASKS.filter(t => S.prog[t.id] && S.prog[t.id].ok).length;
  function renderTabs() {
    $('#tabs').innerHTML = TABS().map(t => '<button type="button" role="tab" class="tab' + (S.tab === t.id ? ' on' : '') + '" data-act="tab" data-v="' + t.id + '" data-t="' + t.id + '" aria-selected="' + (S.tab === t.id) + '" id="tab-' + t.id + '">' + esc(t.label) + (t.id === 'tasks' ? '<span class="bd" aria-label="gelöst">' + solvedCount() + '/' + D.TASKS.length + '</span>' : '') + '</button>').join('');
  }
  UI.setTab = function (id) {
    if (!TABS().some(t => t.id === id)) id = 'b1';
    S.tab = id; LS.set(KEY.tab, id); renderTabs(); renderPage();
    const v = $('#view'); if (v) v.scrollTop = 0;
    const on = $('#tab-' + id); if (on && on.scrollIntoView) { try { on.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { /* ältere Browser */ } }
  };
  function renderPage() {
    const v = $('#view');
    if (S.tab === 'tasks') { v.innerHTML = '<div class="wrap" id="pgTasks"></div>'; renderTasks(); return; }
    const b = Number(S.tab.slice(1)), blk = D.BLOCKS[b - 1], B = UI.BLK[S.tab]; if (!blk || !B) { v.innerHTML = '<div class="wrap"><p>Block nicht gefunden.</p></div>'; return; }
    const LP = [].concat(B.left()), n = D.byBlock(b).length, done = D.byBlock(b).filter(t => S.prog[t.id] && S.prog[t.id].ok).length;
    v.innerHTML = '<div class="wrap" id="pg-' + S.tab + '"><h2>' + b + ' ' + esc(blk.title) + '</h2><p class="lead">' + esc(blk.lead) + '</p>' + (b === 1 ? '<p class="note" style="margin:-6px 0 10px">Hier geht es um Theorie und Rechnen. Einen Regler an einer Anlage einstellen übst du im Lab „Regelungstechnik“ (Prüfstand).</p>' : '') +
      '<div class="lab ' + (B.wide ? 'wide' : '') + '"><div class="left" id="left-' + S.tab + '"><div class="prim">' + LP[0] + '</div><div class="sec">' + (LP[1] || '') + '</div></div><div class="right"><div class="card pl" id="ctl-' + S.tab + '"><h4>Regler</h4>' + B.controls() + '</div><div class="card pl"><h4>Messwerte</h4><div id="out-' + S.tab + '" aria-live="polite"></div></div></div></div>' +
      '<details class="card explain" open><summary>Erklärung</summary><div class="cb">' + blk.parts.map(p => '<p>' + esc(p) + '</p>').join('') + '<div class="merke"><b>Merke</b><ul>' + blk.merke.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul></div></div></details>' +
      '<div class="btns"><button type="button" class="btn pri" data-act="goTasks" data-v="' + b + '">Aufgaben zu diesem Block (' + done + ' von ' + n + ' gelöst)</button></div></div>';
    UI.refresh(); UI.watch();
  }
  /* F1: Zeichenflächen beobachten. Ändert sich ihre Größe (Drehen, Fensterbreite, Reiterwechsel, Layoutwechsel), wird neu gezeichnet. Ohne ResizeObserver (Test, alter Browser) bleibt es bei window.resize. */
  UI.watch = function () {
    if (typeof ResizeObserver === "undefined" || typeof document === "undefined") return;
    try {
      if (!UI._ro) UI._ro = new ResizeObserver(() => { clearTimeout(UI._rt); UI._rt = setTimeout(UI.refresh, 60); });
      UI._ro.disconnect(); const cs = document.querySelectorAll("#view canvas"); for (let i = 0; i < cs.length; i++) UI._ro.observe(cs[i]);
    } catch (e) { /* ohne Beobachter weiter */ }
  };
  UI.renderCtl = function () { const B = UI.BLK[S.tab], c = $('#ctl-' + S.tab); if (B && c) { c.innerHTML = '<h4>Regler</h4>' + B.controls(); } UI.refresh(); };
  UI.refresh = function () { if (S.tab === 'tasks') return; const B = UI.BLK[S.tab]; if (B && B.update) { try { B.update(); } catch (e) { if (window.console) console.error('rg2: Fehler im Block ' + S.tab, e); const o = $('#out-' + S.tab); if (o) o.innerHTML = '<p class="note">Beim Rechnen ist ein Fehler aufgetreten. Bitte einen anderen Wert wählen.</p>'; } } };

  /* ------------------------------------------------------------ Aufgaben */
  const TB = {};
  const task = id => TB[id] || (TB[id] = D.build(id));
  const pr = id => S.prog[id] || (S.prog[id] = { ok: false, n: 0, tip: 0, sol: false });
  const saveProg = () => LS.set(KEY.prog, S.prog);
  function listHTML() {
    const blocks = D.BLOCKS, sel = S.tk.block;
    let html = '<div class="card list"><div style="padding:10px 12px 4px"><b>' + solvedCount() + ' von ' + D.TASKS.length + ' Aufgaben gelöst</b><div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="' + D.TASKS.length + '" aria-valuenow="' + solvedCount() + '"><i style="width:' + Math.round(100 * solvedCount() / D.TASKS.length) + '%"></i></div>' +
      '<div class="seg" role="group" aria-label="Block wählen"><button type="button" data-act="tkf" data-v="0" class="' + (sel === 0 ? 'on' : '') + '" aria-pressed="' + (sel === 0) + '">Alle</button>' + blocks.map(b => '<button type="button" data-act="tkf" data-v="' + b.id + '" class="' + (sel === b.id ? 'on' : '') + '" aria-pressed="' + (sel === b.id) + '" aria-label="Block ' + b.id + ' ' + esc(b.tab) + '">' + b.id + '</button>').join('') + '</div></div>';
    blocks.forEach(b => {
      if (sel && sel !== b.id) return;
      html += '<div class="gh">' + b.id + ' ' + esc(b.tab) + '</div>';
      D.byBlock(b.id).forEach(t => {
        const p = S.prog[t.id], st = p && p.ok ? 'g' : (p && (p.n || p.tip || p.sol) ? 'p' : ''), tt = task(t.id);
        html += '<button type="button" class="row' + (S.tk.id === t.id ? ' on' : '') + '" data-act="tko" data-v="' + t.id + '"><span class="dot ' + st + '" aria-hidden="true">' + (st === 'g' ? '✓' : st === 'p' ? '…' : '') + '</span><span class="grow"><b>' + esc(t.id) + ' ' + esc(t.title) + '</b><small><span class="lv" aria-label="Stufe ' + t.level + ' von 3">' + '★'.repeat(t.level) + '☆'.repeat(3 - t.level) + '</span> ' + (st === 'g' ? 'gelöst' : st === 'p' ? 'angefangen' : 'offen') + '</small></span></button>';
      });
    });
    return html + '</div>';
  }
  /* Toleranz als Text: relativ in Prozent, absolut in der Einheit der Aufgabe */
  const nz = x => String(Math.round(x * 1000) / 1000).replace('.', ',');
  UI.tolText = t => { const tl = t.tol || {}, u = t.unit ? ' ' + t.unit : '', a = []; if (tl.rel) a.push('±' + nz(tl.rel * 100) + ' %'); if (tl.abs) a.push('±' + nz(tl.abs) + u); return a.join(' oder '); };
  function detailHTML() {
    const id = S.tk.id; if (!id) return '<div class="card pl"><p>Bitte links eine Aufgabe wählen.</p></div>';
    const t = task(id), p = S.prog[id] || { ok: false, n: 0, tip: 0, sol: false }, val = S.tk.val[id] != null ? S.tk.val[id] : '';
    let h = '<div class="card pl"><button type="button" class="btn backbtn" data-act="tkb" style="margin-bottom:8px">← Liste</button><h4 style="text-transform:none;letter-spacing:0;font-size:18px;color:var(--fg)">' + esc(t.id) + ' ' + esc(t.title) + '</h4><div class="lv" style="margin-bottom:6px" aria-label="Stufe ' + t.level + ' von 3">' + '★'.repeat(t.level) + '☆'.repeat(3 - t.level) + '</div><p>' + esc(t.text) + '</p>';
    if (t.kind === 'choice') {
      h += '<fieldset style="border:0;padding:0;margin:0"><legend class="sr">Antwort wählen</legend>' + t.options.map((o, i) => '<label class="opt"><input type="radio" name="ans" value="' + i + '"' + (String(val) === String(i) ? ' checked' : '') + '><span>' + esc(o) + '</span></label>').join('') + '</fieldset><div class="btns"><button type="button" class="btn pri" data-act="tkc">Prüfen</button></div>';
    } else {
      h += '<div class="ans"><label><span class="sr">Antwort</span><input type="text" id="ansIn" inputmode="decimal" autocomplete="off" placeholder="Ergebnis (Komma erlaubt)" value="' + esc(val) + '" aria-label="Antwort"></label>' + (t.unit ? '<span class="un">' + esc(t.unit) + '</span>' : '') + '<button type="button" class="btn pri" data-act="tkc">Prüfen</button></div><p class="note">Erlaubte Abweichung: ' + esc(UI.tolText(t)) + (t.unit ? '. Einheit: ' + esc(t.unit) : '') + '. Komma oder Punkt geht.</p>';
    }
    const fb = S.tk.fb[id];
    h += '<div id="fb" role="status" aria-live="polite">' + (fb ? '<div class="fb ' + fb.cls + '">' + esc(fb.msg) + '</div>' : '') + '</div>';
    h += '<h3>Tipps</h3><div class="btns">' + [1, 2, 3].map(n => '<button type="button" class="btn" data-act="tkt" data-v="' + n + '"' + (p.tip < n - 1 ? ' disabled' : '') + '>Tipp ' + n + (p.tip >= n ? ' ✓' : '') + '</button>').join('') + '</div>';
    for (let n = 1; n <= p.tip; n++) h += '<div class="tip"><b>Tipp ' + n + ':</b> ' + esc(t.tips[n - 1]) + '</div>';
    h += '<div class="btns"><button type="button" class="btn" data-act="tks">' + (p.sol ? 'Musterlösung ausblenden' : 'Musterlösung mit Rechenweg') + '</button></div>';
    if (p.sol) h += '<div class="sol"><b>Rechenweg</b><ol>' + t.steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol><b>Ergebnis: ' + esc(t.result) + '</b><p class="note" style="margin-top:6px">Alle Zahlen sind vom Programm gerechnet und im Test mit einer zweiten Rechnung verglichen.</p></div>';
    const bl = D.BLOCKS[t.block - 1];
    h += '<div class="btns"><button type="button" class="btn" data-act="tab" data-v="b' + t.block + '">Zur Visualisierung: ' + esc(bl.tab) + '</button>' + nextBtn(id) + '</div></div>';
    return h;
  }
  function nextBtn(id) { const list = D.TASKS.filter(t => !S.tk.block || t.block === S.tk.block), i = list.findIndex(t => t.id === id); const nx = list[i + 1]; return nx ? '<button type="button" class="btn" data-act="tko" data-v="' + nx.id + '">Nächste Aufgabe →</button>' : ''; }
  function renderTasks() {
    const host = $('#pgTasks'); if (!host) return;
    if (!S.tk.id) { const first = D.TASKS.find(t => !(S.prog[t.id] && S.prog[t.id].ok)) || D.TASKS[0]; S.tk.id = first.id; }
    host.innerHTML = '<h2>Aufgaben</h2><p class="lead">60 Aufgaben in sechs Blöcken, je mit drei Tipps, Musterlösung und Rechenweg. Das Ergebnis wird mit einer Toleranz geprüft; du kannst mit Komma oder Punkt eingeben.</p><div class="tk" data-view="' + S.tk.view + '">' + listHTML() + '<div class="detail">' + detailHTML() + '</div></div><div class="btns"><button type="button" class="btn" data-act="reset">Fortschritt zurücksetzen</button></div>';
  }
  function checkAnswer() {
    const id = S.tk.id, t = task(id), p = pr(id); let raw;
    if (t.kind === 'choice') { const c = $('input[name=ans]:checked'); raw = c ? c.value : ''; } else { const i = $('#ansIn'); raw = i ? i.value : ''; }
    S.tk.val[id] = raw;
    if (raw === '') { S.tk.fb[id] = { cls: 'no', msg: t.kind === 'choice' ? 'Bitte eine Antwort wählen.' : 'Bitte eine Zahl eingeben (Komma erlaubt).' }; renderTasks(); return; }
    const res = D.check(t, raw);
    if (res.bad) { S.tk.fb[id] = { cls: 'no', msg: 'Das ist keine Zahl. Beispiel: 12,5 oder −3.' }; renderTasks(); return; }
    p.n++;
    if (res.ok) { p.ok = true; S.tk.fb[id] = { cls: 'ok', msg: 'Richtig. Gut gerechnet. Die Musterlösung zeigt den Rechenweg zum Vergleich.' }; }
    else S.tk.fb[id] = { cls: 'no', msg: 'Das passt noch nicht. Gefragt ist das Ergebnis' + (t.unit ? ' in ' + t.unit : '') + ', erlaubt ist ' + UI.tolText(t) + ' Abweichung. Prüfe den Rechenweg, oder nimm einen Tipp.' };
    saveProg(); renderTabs(); renderTasks(); const fbe = $('#fb'); if (fbe && fbe.scrollIntoView) { try { fbe.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ältere Browser */ } }
  }

  /* ------------------------------------------------------------ Ereignisse */
  let raf = 0;
  function onInput(e) {
    const t = e.target; if (!t.matches || !t.matches('input[type=range][data-b]')) return;
    const o = { min: +t.dataset.min, max: +t.dataset.max, log: t.dataset.log === '1', dec: +t.dataset.dec, unit: t.dataset.unit };
    let v = posToVal(+t.value, o); const sn = +t.dataset.snap; if (sn > 0) v = Math.round(v / sn) * sn; else if (o.log) v = roundSig(v, 3); else v = Math.round(v * 1e6) / 1e6;
    v = Math.min(o.max, Math.max(o.min, v));
    S.st[t.dataset.b][t.dataset.k] = v;
    const lbl = document.getElementById('v-' + t.dataset.b + '-' + t.dataset.k); if (lbl) lbl.textContent = fmtVal(v, o);
    UI.save();
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; UI.refresh(); });
  }
  function onClick(e) {
    const a = e.target.closest ? e.target.closest('[data-act]') : null; if (!a) return;
    const act = a.dataset.act, b = a.dataset.b, k = a.dataset.k, v = a.dataset.v;
    if (act === 'tab') { UI.setTab(v); }
    else if (act === 'set') { const cur = S.st[b][k]; S.st[b][k] = typeof cur === 'number' ? Number(v) : v; UI.save(); const B = UI.BLK[S.tab]; if (B && B.onSet) B.onSet(k, S.st[b][k]); UI.renderCtl(); }
    else if (act === 'goTasks') { UI.goTasks(Number(v)); }
    else if (act === 'act') { const B = UI.BLK[S.tab]; if (B && B.action) B.action(v); }
    else if (act === 'tko') { S.tk.id = v; S.tk.view = 'detail'; renderTasks(); const vw = $('#view'); if (vw && window.innerWidth < 900) vw.scrollTop = 0; }
    else if (act === 'tkb') { S.tk.view = 'list'; renderTasks(); }
    else if (act === 'tkf') { S.tk.block = Number(v); renderTasks(); }
    else if (act === 'tkc') { checkAnswer(); }
    else if (act === 'tkt') { const p = pr(S.tk.id), n = Number(v); if (p.tip >= n - 1) { p.tip = Math.max(p.tip, n); saveProg(); renderTasks(); } }
    else if (act === 'tks') { const p = pr(S.tk.id); p.sol = !p.sol; saveProg(); renderTabs(); renderTasks(); }
    else if (act === 'reset') { if (window.confirm('Den gesamten Aufgabenfortschritt in diesem Lab löschen?')) { S.prog = {}; S.tk.fb = {}; S.tk.val = {}; saveProg(); renderTabs(); renderTasks(); } }
  }
  function onChange(e) {
    const t = e.target; if (!t.dataset) return;
    if (t.dataset.act === 'chk') { S.st[t.dataset.b][t.dataset.k] = t.checked; UI.save(); const B = UI.BLK[S.tab]; if (B && B.onSet) B.onSet(t.dataset.k, t.checked); UI.renderCtl(); }
    else if (t.dataset.act === 'sel') { const cur = S.st[t.dataset.b][t.dataset.k]; S.st[t.dataset.b][t.dataset.k] = typeof cur === 'number' ? Number(t.value) : t.value; UI.save(); const B = UI.BLK[S.tab]; if (B && B.onSet) B.onSet(t.dataset.k, S.st[t.dataset.b][t.dataset.k]); UI.renderCtl(); }
    else if (t.name === 'ans') { S.tk.val[S.tk.id] = t.value; }
  }
  UI.reg = function (id, B) { UI.BLK[id] = B; };
  UI.start = function () {
    const saved0 = LS.get(KEY.state, {}), saved = saved0 && typeof saved0 === 'object' && !Array.isArray(saved0) ? saved0 : {};
    D.BLOCKS.forEach(b => {   // gespeicherte Reglerstände nur übernehmen, wenn Schlüssel und Typ zum Vorgabewert passen
      const B = UI.BLK['b' + b.id], def = B ? B.def : {}, sv = saved['b' + b.id], st = Object.assign({}, def);
      if (sv && typeof sv === 'object') Object.keys(def).forEach(k => { if (typeof sv[k] === typeof def[k] && (typeof sv[k] !== 'number' || isFinite(sv[k])) && (!(B && B.enums && B.enums[k]) || B.enums[k].indexOf(sv[k]) >= 0)) st[k] = sv[k]; });
      S.st['b' + b.id] = st;
    });
    const pg = LS.get(KEY.prog, {}); S.prog = {};
    if (pg && typeof pg === 'object' && !Array.isArray(pg)) Object.keys(pg).forEach(id => { const e = pg[id]; if (D.get(id) && e && typeof e === 'object') S.prog[id] = { ok: e.ok === true, n: Math.max(0, Number(e.n) || 0), tip: Math.min(3, Math.max(0, Number(e.tip) || 0)), sol: e.sol === true }; });
    S.tab = LS.get(KEY.tab, 'b1'); if (typeof S.tab !== 'string') S.tab = 'b1';
    try { const q = new URLSearchParams(location.search), ta = q.get('aufgabe'), tb = q.get('tab'); if (ta && D.get(ta)) { S.tk.block = D.get(ta).block; S.tk.id = ta; S.tk.view = 'detail'; S.tab = 'tasks'; } else if (tb && /^b[1-6]$/.test(tb)) S.tab = tb; } catch (e) { /* ohne URL-Parameter */ }
    applyTheme(UI.themeMode());
    document.addEventListener('input', onInput); document.addEventListener('click', onClick); document.addEventListener('change', onChange);
    document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'ansIn') { e.preventDefault(); checkAnswer(); } });
    const th = $('#bTheme'); if (th) th.addEventListener('click', cycleTheme);
    let rz = 0; const rs = () => { clearTimeout(rz); rz = setTimeout(UI.refresh, 90); };
    window.addEventListener('resize', rs); window.addEventListener('orientationchange', rs);
    try { const mq = window.matchMedia('(prefers-color-scheme: dark)'); (mq.addEventListener ? mq.addEventListener('change', UI.refresh) : mq.addListener && mq.addListener(UI.refresh)); } catch (e) { /* kein matchMedia */ }
    renderTabs(); UI.setTab(S.tab);
  };
  root.RG2UI = UI;
})(typeof self !== 'undefined' ? self : this);
