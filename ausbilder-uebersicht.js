'use strict';
/* Tonfunk Lab: Ausbilder-Übersicht (ab v23.145). Liest die Stand-Dateien der Azubis (Schema „tonfunk-stand“, erzeugt von stand.js), legt sie zusammen und zeigt
   Tabelle, Heatmap, Schwächen-Ranking und Detailansicht. Alles läuft im Browser: nichts wird hochgeladen, nichts gespeichert (nur Arbeitsspeicher der Seite).
   Die Logik ohne DOM steht in Ueb.core (Tests: quelle/dash/test_uebersicht.js), die Oberfläche in Ueb.mount().
   Schema siehe stand.js und quelle/dash/UEBERSICHT.md. Diese Seite enthält keine Lösungen. */
(function (root) {
  const SUPPORTED = 1, MAXBYTES = 2 * 1024 * 1024, MAXFILES = 500, DAY = 86400000;
  const KUERZEL_RE = /^[A-Za-z0-9ÄÖÜäöüß_.-]{2,24}$/;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const fmtD = t => { if (!t) return '–'; const d = new Date(t); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); };
  const fmtDT = t => { if (!t) return '–'; const d = new Date(t); return fmtD(t) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = v => { v = +v; return isFinite(v) ? v : 0; };
  const int = v => Math.round(num(v));
  const idOk = k => /^[\w.\-]{1,40}$/.test(k);
  const keyOk = k => /^[\w.:@\-]{1,60}$/.test(k);
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const sum = a => a.reduce((x, y) => x + y, 0);
  const core = {};
  core.esc = esc; core.fmtD = fmtD; core.fmtDT = fmtDT;
  core.keyOf = k => String(k == null ? '' : k).trim().toLowerCase();

  /* ---------- eine Datei prüfen und bereinigen ---------- */
  core.normalize = function (o, now) {
    now = now || Date.now(); const warn = [];
    if (!isObj(o)) return { ok: false, error: 'Der Inhalt ist keine Stand-Datei (kein JSON-Objekt).' };
    if (o.app === 'tonfunk-lab' && o.d) return { ok: false, error: 'Das ist eine Lernstand-Sicherung („Lernstand sichern“), keine Stand-Datei. Der Azubi soll „Stand exportieren“ benutzen.' };
    if (o.format === 'tonfunk-dash') return { ok: false, error: 'Das ist eine Sicherung des Klassen-Dashboards (auswertung.html), keine Stand-Datei.' };
    if (o.format !== 'tonfunk-stand') return { ok: false, error: 'Keine Tonfunk-Stand-Datei (Feld „format“ fehlt oder passt nicht).' };
    if (!Number.isInteger(o.schema) || o.schema < 1) return { ok: false, error: 'Schema-Version fehlt oder ist ungültig.' };
    if (o.schema > SUPPORTED) return { ok: false, error: 'Schema ' + o.schema + ' ist neuer als diese Seite (versteht Schema ' + SUPPORTED + '). Bitte die Ausbilder-Übersicht aktualisieren (Cache leeren).' };
    if (typeof o.kuerzel !== 'string' || !KUERZEL_RE.test(o.kuerzel)) return { ok: false, error: 'Kürzel fehlt oder ist ungültig (2 bis 24 Zeichen, keine Leerzeichen).' };
    const ts = +o.ts;
    if (!isFinite(ts) || ts <= 0) return { ok: false, error: 'Zeitstempel fehlt oder ist ungültig.' };
    if (ts > now + 2 * DAY) return { ok: false, error: 'Zeitstempel liegt in der Zukunft (Uhr des Geräts falsch?).' };
    if (!isObj(o.tasks)) return { ok: false, error: 'Aufgabenliste „tasks“ fehlt.' };
    const r = { kuerzel: o.kuerzel, key: core.keyOf(o.kuerzel), ts: Math.round(ts), app: String(o.app || '').replace(/[^\w.\-]/g, '').slice(0, 20), tasks: {}, labs: {}, badges: {}, exam: { hist: [], topics: {}, titles: {} }, path: { trainer: [], kampagne: [], kampTotal: null, stats: {}, duels: 0, think: 0, predict: [0, 0] }, weak: { tasks: [], topics: [] }, warn };
    let drop = 0;
    Object.keys(o.tasks).slice(0, 3000).forEach(id => { const a = o.tasks[id]; if (!idOk(id) || !Array.isArray(a) || !isFinite(+a[0])) { drop++; return; } r.tasks[id] = [clamp(int(a[0]), 0, 100), clamp(int(a[1]), 0, 3)]; });
    if (drop) warn.push(drop + ' ungültige Aufgaben-Einträge übersprungen');
    if (isObj(o.labs)) Object.keys(o.labs).slice(0, 100).forEach(k => { const a = o.labs[k]; if (!idOk(k) || !Array.isArray(a)) return; const n = int(a[0]), d = int(a[1]); if (n < 1 || d < 0 || d > n) return; r.labs[k] = [n, d, clamp(int(a[2]), 0, 100)]; });
    if (isObj(o.badges)) Object.keys(o.badges).slice(0, 400).forEach(k => { if (idOk(k)) r.badges[k] = Math.max(0, int(o.badges[k])); });
    if (isObj(o.exam)) {
      (Array.isArray(o.exam.hist) ? o.exam.hist : []).slice(-30).forEach(h => {
        if (!isObj(h)) return; const e = { v: String(h.v || '').replace(/[^\w-]/g, '').slice(0, 20), area: String(h.area || '').replace(/[^\w-]/g, '').slice(0, 20), t: Math.max(0, int(h.t)), pct: clamp(int(h.pct), 0, 100), note: clamp(int(h.note), 0, 6), secs: Math.max(0, int(h.secs)), topics: {} };
        if (isObj(h.topics)) Object.keys(h.topics).slice(0, 60).forEach(k => { const a = h.topics[k]; if (keyOk(k) && Array.isArray(a)) e.topics[k] = [Math.max(0, int(a[0])), Math.max(0, int(a[1]))]; });
        r.exam.hist.push(e);
      });
      if (isObj(o.exam.topics)) Object.keys(o.exam.topics).slice(0, 200).forEach(k => { const a = o.exam.topics[k]; if (keyOk(k) && Array.isArray(a) && int(a[1]) > 0) r.exam.topics[k] = [clamp(int(a[0]), 0, int(a[1])), int(a[1]), clamp(int(a[2]), 0, 100)]; });
      if (isObj(o.exam.titles)) Object.keys(o.exam.titles).slice(0, 200).forEach(k => { if (keyOk(k)) r.exam.titles[k] = String(o.exam.titles[k]).slice(0, 80); });
    }
    if (isObj(o.path)) {
      const p = o.path;
      r.path.trainer = (Array.isArray(p.trainer) ? p.trainer : []).filter(x => typeof x === 'string' && idOk(x)).slice(0, 60);
      r.path.kampagne = (Array.isArray(p.kampagne) ? p.kampagne : []).filter(x => typeof x === 'string').map(x => x.slice(0, 80)).slice(0, 40);
      r.path.kampTotal = p.kampTotal == null || !isFinite(+p.kampTotal) ? null : Math.max(0, int(p.kampTotal));
      if (isObj(p.stats)) Object.keys(p.stats).slice(0, 40).forEach(k => { if (idOk(k) && isFinite(+p.stats[k])) r.path.stats[k] = Math.max(0, int(p.stats[k])); });
      r.path.duels = Math.max(0, int(p.duels)); r.path.think = Math.max(0, int(p.think));
      if (Array.isArray(p.predict)) r.path.predict = [Math.max(0, int(p.predict[0])), Math.max(0, int(p.predict[1]))];
    }
    if (isObj(o.weak)) {
      (Array.isArray(o.weak.tasks) ? o.weak.tasks : []).slice(0, 80).forEach(w => { if (isObj(w) && idOk(String(w.id || ''))) r.weak.tasks.push({ id: w.id, lab: String(w.lab || '').replace(/[^\w.\-]/g, '').slice(0, 40), cat: String(w.cat || '').slice(0, 60), p: clamp(int(w.p), 0, 100), h: clamp(int(w.h), 0, 3) }); });
      (Array.isArray(o.weak.topics) ? o.weak.topics : []).slice(0, 80).forEach(w => { if (isObj(w) && keyOk(String(w.k || ''))) r.weak.topics.push({ k: w.k, t: String(w.t || '').slice(0, 80), p: clamp(int(w.p), 0, 100), n: Math.max(0, int(w.n)) }); });
    }
    return { ok: true, rec: r };
  };
  core.parseFile = function (text, name, now) {
    name = String(name || 'Datei');
    if (typeof text !== 'string') return { ok: false, name, error: 'Datei nicht lesbar.' };
    if (text.length > MAXBYTES) return { ok: false, name, error: 'Datei ist zu groß (über 2 MB), das ist keine Stand-Datei.' };
    text = text.replace(/^﻿/, '');
    if (!text.trim()) return { ok: false, name, error: 'Datei ist leer.' };
    let o; try { o = JSON.parse(text); } catch (e) { return { ok: false, name, error: 'Keine gültige JSON-Datei (beschädigt oder abgeschnitten).' }; }
    const res = core.normalize(o, now); res.name = name; return res;
  };

  /* ---------- mehrere Dateien zusammenlegen: je Kürzel gewinnt der neueste Stand, Verlauf bleibt erhalten ---------- */
  core.combine = function (results) {
    const errors = [], by = {}; let dups = 0, files = 0;
    (results || []).forEach(res => {
      files++;
      if (!res || !res.ok) { errors.push({ name: res && res.name || 'Datei', error: res && res.error || 'Unbekannter Fehler' }); return; }
      const r = res.rec, g = by[r.key] = by[r.key] || { key: r.key, history: [], names: [] };
      if (g.history.some(x => x.ts === r.ts)) { dups++; return; }
      r.file = res.name; g.history.push(r);
    });
    const students = Object.keys(by).map(k => { const g = by[k]; g.history.sort((a, b) => a.ts - b.ts); g.latest = g.history[g.history.length - 1]; g.name = g.latest.kuerzel; return g; });
    students.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return { students, errors, dups, files, ok: students.length, older: sum(students.map(s => s.history.length - 1)) };
  };

  /* ---------- Katalog aus aufgaben.js ---------- */
  core.catalog = function (G) {
    G = G || {}; const T = Array.isArray(G.AUFGABEN) ? G.AUFGABEN : [], REG = G.LAB_REG || {}, LABS = G.AUFGABEN_LABS || {}, order = [];
    const add = k => { if (k != null && !order.includes(k) && !(REG[k] || {}).hub) order.push(k); };
    Object.keys(LABS).forEach(add); Object.keys(REG).forEach(add); T.forEach(t => add(t[1]));
    const tasks = T.filter(t => !(REG[t[1]] || {}).hub).map(t => ({ id: t[0], lab: t[1], cat: String(t[2]), title: String(t[3]), level: t[4] })), byId = {};
    T.forEach(t => { byId[t[0]] = { id: t[0], lab: t[1], cat: String(t[2]), title: String(t[3]), level: t[4] }; });
    const labs = order.map(k => ({ key: k, name: LABS[k] || (REG[k] || {}).name || k, short: (REG[k] || {}).short || LABS[k] || k })).filter(l => tasks.some(t => t.lab === l.key));
    return { labs, tasks, byId };
  };

  /* Fortschritt je Lab: aus der Datei (labs), sonst aus Aufgaben und Katalog */
  core.labStat = function (rec, cat, lab) {
    const f = rec.labs[lab]; if (f) return { n: f[0], d: f[1], avg: f[2], pct: Math.round(100 * f[1] / f[0]), started: f[2] > 0 || f[1] > 0, src: 'datei' };
    const ts = cat.tasks.filter(t => t.lab === lab); if (!ts.length) return null;
    const ps = ts.map(t => (rec.tasks[t.id] || [0])[0]), d = ps.filter(p => p >= 100).length;
    return { n: ts.length, d, avg: Math.round(sum(ps) / ts.length), pct: Math.round(100 * d / ts.length), started: ps.some(p => p > 0), src: 'katalog' };
  };
  core.color = p => p == null ? null : 'hsl(' + Math.round(clamp(p, 0, 100) * 1.2) + ' 62% ' + (p >= 100 ? 58 : 76) + '%)';
  core.activity = rec => Math.max.apply(null, [0].concat(Object.keys(rec.badges).map(k => rec.badges[k]), rec.exam.hist.map(h => h.t)));

  /* ---------- Auswertung ---------- */
  core.aggregate = function (state, cat) {
    const labKeys = cat.labs.map(l => l.key);
    state.students.forEach(s => Object.keys(s.latest.labs).forEach(k => { if (!labKeys.includes(k)) labKeys.push(k); }));
    const labs = labKeys.map(k => cat.labs.find(l => l.key === k) || { key: k, name: k, short: k });
    const rows = state.students.map(s => {
      const r = s.latest, lp = {}; let n = 0, d = 0;
      labs.forEach(l => { const st = core.labStat(r, cat, l.key); lp[l.key] = st; if (st) { n += st.n; d += st.d; } });
      const ex = r.exam.hist, bestPct = ex.length ? Math.max.apply(null, ex.map(h => h.pct)) : null, notes = ex.filter(h => h.note > 0).map(h => h.note);
      return { key: s.key, name: s.name, rec: r, versions: s.history.length, ts: r.ts, act: core.activity(r), n, d, pct: n ? Math.round(100 * d / n) : 0, lp, badges: Object.keys(r.badges).length, exams: ex.length, examBest: bestPct, noteBest: notes.length ? Math.min.apply(null, notes) : null, kamp: r.path.kampagne.length, kampTotal: r.path.kampTotal, weak: r.weak.tasks.length };
    });
    return { rows, labs, kpi: { n: rows.length, pct: rows.length ? Math.round(sum(rows.map(r => r.pct)) / rows.length) : 0, solved: sum(rows.map(r => r.d)), badges: sum(rows.map(r => r.badges)), exams: sum(rows.map(r => r.exams)), newest: rows.reduce((m, r) => Math.max(m, r.ts), 0), oldest: rows.length ? rows.reduce((m, r) => Math.min(m, r.ts), Infinity) : 0 } };
  };
  /* Heatmap nach Thema (Kategorie) innerhalb eines Labs */
  core.heatTopics = function (state, cat, lab) {
    const ts = cat.tasks.filter(t => t.lab === lab), cats = []; ts.forEach(t => { if (!cats.includes(t.cat)) cats.push(t.cat); });
    const rows = state.students.map(s => { const r = s.latest, cells = {}; cats.forEach(c => { const g = ts.filter(t => t.cat === c), ps = g.map(t => (r.tasks[t.id] || [0])[0]), d = ps.filter(p => p >= 100).length; cells[c] = { n: g.length, d, pct: Math.round(100 * d / g.length), started: ps.some(p => p > 0) }; }); return { key: s.key, name: s.name, cells }; });
    return { cats, rows };
  };
  /* Schwächen-Ranking über alle Azubis (neueste Stände): häufigste ungelöste Aufgaben, Themen, Prüfungsthemen */
  core.weakness = function (state, cat, opt) {
    opt = opt || {}; const T = {}, G = {}, X = {};
    state.students.forEach(s => {
      const r = s.latest;
      Object.keys(r.tasks).forEach(id => {
        const p = r.tasks[id][0], h = r.tasks[id][1]; if (!(p > 0 || h > 0)) return;
        const m = cat.byId[id] || { id, lab: '?', cat: 'Unbekannt', title: id }, t = T[id] = T[id] || { id, title: m.title, lab: m.lab, cat: m.cat, tried: 0, unsolved: 0, sumP: 0, sumH: 0 };
        t.tried++; t.sumP += p; t.sumH += h; if (p < 100) t.unsolved++;
        const gk = m.lab + '|' + m.cat, g = G[gk] = G[gk] || { lab: m.lab, cat: m.cat, tried: 0, unsolved: 0, sumP: 0 };
        g.tried++; g.sumP += p; if (p < 100) g.unsolved++;
      });
      Object.keys(r.exam.topics).forEach(k => { const a = r.exam.topics[k], x = X[k] = X[k] || { k, t: '', r: 0, n: 0, az: 0 }; x.r += a[0]; x.n += a[1]; x.az++; if (r.exam.titles[k]) x.t = r.exam.titles[k]; });
    });
    const tasks = Object.keys(T).map(k => T[k]).filter(t => t.unsolved > 0).map(t => Object.assign(t, { share: t.unsolved / t.tried, avgP: Math.round(t.sumP / t.tried), avgH: t.sumH / t.tried }))
      .sort((a, b) => b.unsolved - a.unsolved || b.share - a.share || a.avgP - b.avgP || b.avgH - a.avgH || a.id.localeCompare(b.id));
    const topics = Object.keys(G).map(k => G[k]).filter(g => g.tried >= (opt.minTried || 3) && g.unsolved > 0).map(g => Object.assign(g, { share: g.unsolved / g.tried, avgP: Math.round(g.sumP / g.tried) }))
      .sort((a, b) => b.share - a.share || b.unsolved - a.unsolved || a.cat.localeCompare(b.cat, 'de'));
    const exam = Object.keys(X).map(k => X[k]).filter(x => x.n >= (opt.minExam || 5)).map(x => Object.assign(x, { p: Math.round(100 * x.r / x.n) })).sort((a, b) => a.p - b.p || b.n - a.n || a.k.localeCompare(b.k));
    return { tasks, topics, exam };
  };

  /* ---------- CSV (Semikolon, Excel-tauglich; Formeln werden entschärft) ---------- */
  core.csvCell = v => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s) && isNaN(+s)) s = "'" + s; return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  core.csv = function (agg) {
    const head = ['Kürzel', 'Stand vom', 'App-Version', 'Aufgaben gelöst', 'Aufgaben gesamt', 'Fortschritt %', 'Abzeichen', 'Probeprüfungen', 'Beste Prüfung %', 'Beste Note', 'Kampagne Kapitel', 'Offene Schwächen', 'Letzte Aktivität'].concat(agg.labs.map(l => l.name + ' %'));
    const lines = [head.map(core.csvCell).join(';')];
    agg.rows.forEach(r => lines.push([r.name, fmtDT(r.ts), r.rec.app, r.d, r.n, r.pct, r.badges, r.exams, r.examBest == null ? '' : r.examBest, r.noteBest == null ? '' : r.noteBest, r.kamp, r.weak, r.act ? fmtDT(r.act) : ''].concat(agg.labs.map(l => { const st = r.lp[l.key]; return st && st.started ? st.pct : ''; })).map(core.csvCell).join(';')));
    return lines.join('\r\n') + '\r\n';
  };
  core.csvWeak = function (w) {
    const lines = [['Rang', 'Art', 'Aufgabe oder Thema', 'Lab', 'Bearbeitet von', 'Nicht gelöst', 'Anteil nicht gelöst %', 'Ø Prozent', 'Ø Tipp-Stufe'].map(core.csvCell).join(';')];
    w.tasks.forEach((t, i) => lines.push([i + 1, 'Aufgabe', t.title, t.lab, t.tried, t.unsolved, Math.round(100 * t.share), t.avgP, t.avgH.toFixed(1).replace('.', ',')].map(core.csvCell).join(';')));
    w.topics.forEach((t, i) => lines.push([i + 1, 'Thema', t.cat, t.lab, t.tried, t.unsolved, Math.round(100 * t.share), t.avgP, ''].map(core.csvCell).join(';')));
    w.exam.forEach((t, i) => lines.push([i + 1, 'Prüfungsthema', t.t || t.k, 'pr', t.n, t.n - t.r, 100 - t.p, '', ''].map(core.csvCell).join(';')));
    return lines.join('\r\n') + '\r\n';
  };

  /* ====================================================== Oberfläche ====================================================== */
  let UI = null;
  function mount(host, G, doc) {
    const D = doc || document, cat = core.catalog(G || {});
    const BD = (root.Badges && root.Badges.DEFS) || [], bname = id => { const d = BD.find(x => x[0] === id); return d ? { icon: d[1], name: d[2], desc: d[3] } : { icon: '🏅', name: id, desc: '' }; };
    const S = { inputs: [], sort: 'name', dir: 1, heat: 'lab', heatLab: '', detail: null, msg: '' };
    let M = null, A = null;
    const $ = s => host.querySelector(s);
    host.innerHTML = `<section class="card noprint" aria-labelledby="hLoad"><h2 id="hLoad">1. Stand-Dateien laden</h2>
      <p class="mute">Wähle die Dateien <code>tonfunk-stand-….json</code> der Azubis aus (mehrere auf einmal) oder ziehe sie hierher. Mehrere Stände desselben Kürzels: der neueste zählt, ältere bilden den Verlauf. Es wird nichts hochgeladen und nichts gespeichert.</p>
      <div id="drop" class="drop"><label class="fbtn" for="files">Dateien auswählen</label><input type="file" id="files" multiple accept=".json,application/json"><span class="mute">oder Dateien hier ablegen</span></div>
      <div class="row"><button type="button" id="reset" class="danger">Alles zurücksetzen</button><span id="stat" class="mute" role="status" aria-live="polite"></span></div>
      <ul id="errs" class="errs" aria-label="Meldungen zu Dateien"></ul></section>
      <div id="out"></div>`;
    const out = $('#out');
    function rerun() { M = core.combine(S.inputs); A = core.aggregate(M, cat); if (S.detail && !M.students.some(s => s.key === S.detail)) S.detail = null; if (!S.heatLab || !cat.labs.some(l => l.key === S.heatLab)) { const withData = A.labs.find(l => A.rows.some(r => r.lp[l.key] && r.lp[l.key].started)); S.heatLab = withData ? withData.key : (cat.labs[0] || {}).key || ''; } render(); }
    function readText(f) { if (typeof f.text === 'function') return f.text(); return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(new Error('Datei nicht lesbar')); fr.readAsText(f); }); }
    async function add(list) {
      list = Array.from(list || []); if (!list.length) return;
      if (S.inputs.length + list.length > MAXFILES) { list = list.slice(0, Math.max(0, MAXFILES - S.inputs.length)); S.msg = 'Es werden höchstens ' + MAXFILES + ' Dateien verarbeitet.'; }
      /* alle Lesevorgänge sofort starten (bevor die Dateiauswahl zurückgesetzt wird), dann der Reihe nach auswerten */
      const reads = list.map(f => (f.size > MAXBYTES ? Promise.resolve(null) : (() => { try { return Promise.resolve(readText(f)).then(t => t, () => null); } catch (e) { return Promise.resolve(null); } })()));
      for (let i = 0; i < list.length; i++) {
        const f = list[i], t = await reads[i];
        if (f.size > MAXBYTES) S.inputs.push({ ok: false, name: f.name, error: 'Datei ist zu groß (über 2 MB), das ist keine Stand-Datei.' });
        else S.inputs.push(core.parseFile(t, f.name));
      }
      rerun();
    }
    const inp = $('#files'); inp.addEventListener('change', () => { const l = Array.from(inp.files); inp.value = ''; add(l); });
    const drop = $('#drop');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files) add(e.dataTransfer.files); });
    D.addEventListener('dragover', e => { if (!e.target.closest || !e.target.closest('#drop')) e.preventDefault(); });
    D.addEventListener('drop', e => { if (!e.target.closest || !e.target.closest('#drop')) e.preventDefault(); });
    $('#reset').onclick = () => { S.inputs = []; S.detail = null; S.msg = ''; rerun(); $('#files').focus(); };

    const th = (k, t, tip) => `<th scope="col" aria-sort="${S.sort === k ? (S.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="srt" data-sort="${k}" title="${esc(tip || 'Sortieren')}">${t}<span aria-hidden="true">${S.sort === k ? (S.dir > 0 ? ' ▲' : ' ▼') : ''}</span></button></th>`;
    const cmp = { name: (a, b) => a.name.localeCompare(b.name, 'de'), pct: (a, b) => a.pct - b.pct, solved: (a, b) => a.d - b.d, badges: (a, b) => a.badges - b.badges, exam: (a, b) => (a.examBest == null ? -1 : a.examBest) - (b.examBest == null ? -1 : b.examBest), ts: (a, b) => a.ts - b.ts, act: (a, b) => a.act - b.act, weak: (a, b) => a.weak - b.weak };
    const cell = (p, started, title, txt) => started ? `<td class="pc" style="background:${core.color(p)}" title="${esc(title)}">${txt == null ? p : txt}</td>` : `<td class="pc none" title="${esc(title)}"><span class="sr">nicht gestartet</span></td>`;
    function stand(r) { const old = Date.now() - r.ts > 14 * DAY; return `<span title="${esc(fmtDT(r.ts))}">${esc(fmtD(r.ts))}</span>${old ? ' <span class="old" title="Der Stand ist älter als 14 Tage">älter</span>' : ''}`; }

    function render() {
      $('#errs').innerHTML = M.errors.map(e => `<li><b>${esc(e.name)}</b>: ${esc(e.error)}</li>`).join('');
      $('#stat').textContent = M.files ? (M.ok + ' Azubis aus ' + M.files + ' Dateien' + (M.errors.length ? ', ' + M.errors.length + ' Datei(en) nicht lesbar' : '') + (M.dups ? ', ' + M.dups + ' doppelte übersprungen' : '') + (M.older ? ', ' + M.older + ' ältere Stände im Verlauf' : '') + '.' + (S.msg ? ' ' + S.msg : '')) : 'Noch keine Dateien geladen.';
      if (!A.rows.length) { out.innerHTML = '<p class="mute">Noch keine Daten. Lade oben die Dateien der Azubis.</p>'; return; }
      const rows = A.rows.slice().sort((a, b) => (cmp[S.sort](a, b) || a.name.localeCompare(b.name, 'de')) * S.dir);
      let h = `<section class="card" aria-labelledby="hTab"><h2 id="hTab">2. Übersicht je Azubi</h2>
        <div class="kpis"><div class="kpi"><b>${A.kpi.n}</b><span>Azubis</span></div><div class="kpi"><b>${A.kpi.pct} %</b><span>Ø Fortschritt (gelöste Aufgaben)</span></div><div class="kpi"><b>${A.kpi.solved}</b><span>gelöste Aufgaben insgesamt</span></div><div class="kpi"><b>${A.kpi.badges}</b><span>Abzeichen insgesamt</span></div><div class="kpi"><b>${A.kpi.exams}</b><span>Probeprüfungen</span></div><div class="kpi"><b class="sm">${esc(fmtD(A.kpi.oldest))} bis ${esc(fmtD(A.kpi.newest))}</b><span>Zeitraum der Stände</span></div></div>
        <p class="mute">Fortschritt = Anteil der Aufgaben mit 100 %, wie auf der Startseite des Azubis. „Stand vom“ ist der Zeitpunkt des Exports. „Letzte Aktivität“ ist das jüngste Abzeichen oder die jüngste Probeprüfung (die App speichert keine Bearbeitungsdauer und keine Versuchszahl).</p>
        <div class="tw" tabindex="0" role="region" aria-label="Tabelle Azubis, waagerecht scrollbar"><table><caption class="sr">Azubis mit Fortschritt je Lab</caption><thead><tr>${th('name', 'Kürzel')}${th('pct', 'Fortschritt')}${th('solved', 'Gelöst')}${th('badges', 'Abzeichen')}${th('exam', 'Beste Prüfung', 'Beste Probeprüfung in Prozent')}${th('weak', 'Schwächen', 'Versuchte, noch nicht gelöste Aufgaben')}${th('ts', 'Stand vom')}${th('act', 'Letzte Aktivität')}${A.labs.map(l => `<th scope="col" class="t" title="${esc(l.name)}"><span>${esc(l.short)}</span></th>`).join('')}</tr></thead><tbody>`;
      rows.forEach(r => {
        h += `<tr><th scope="row" class="nm"><button type="button" class="lnk" data-det="${esc(r.key)}">${esc(r.name)}</button></th><td class="pc" style="background:${core.color(r.pct)}"><span class="bar" aria-hidden="true"><i style="width:${r.pct}%"></i></span>${r.pct} %</td><td>${r.d}/${r.n}</td><td>${r.badges}</td><td>${r.examBest == null ? '–' : r.examBest + ' % (Note ' + (r.noteBest == null ? '?' : r.noteBest) + ')'}</td><td>${r.weak}</td><td>${stand(r)}</td><td>${r.act ? esc(fmtD(r.act)) : '–'}</td>`;
        h += A.labs.map(l => { const st = r.lp[l.key]; return st ? cell(st.pct, st.started, l.name + ': ' + st.d + ' von ' + st.n + ' Aufgaben, Ø ' + st.avg + ' %', st.pct) : '<td class="pc none"><span class="sr">kein Eintrag</span></td>'; }).join('') + '</tr>';
      });
      h += `</tbody><tfoot><tr><th scope="row" class="nm">Ø alle</th><td>${A.kpi.pct} %</td><td></td><td></td><td></td><td></td><td></td><td></td>${A.labs.map(l => { const v = A.rows.filter(r => r.lp[l.key] && r.lp[l.key].started).map(r => r.lp[l.key].pct); return `<td>${v.length ? Math.round(sum(v) / v.length) : ''}</td>`; }).join('')}</tr></tfoot></table></div>
        <p class="scale" aria-hidden="true">0 %<i></i>100 % &nbsp; grau: nicht gestartet</p></section>`;
      /* Heatmap */
      h += `<section class="card" aria-labelledby="hHeat"><h2 id="hHeat">3. Heatmap</h2><fieldset class="row nb"><legend class="sr">Heatmap nach Lab oder Thema</legend><label class="rb"><input type="radio" name="heat" value="lab"${S.heat === 'lab' ? ' checked' : ''}> je Lab</label><label class="rb"><input type="radio" name="heat" value="topic"${S.heat === 'topic' ? ' checked' : ''}> je Thema in einem Lab</label>${S.heat === 'topic' ? `<label class="rb">Lab <select id="heatLab" aria-label="Lab für die Themen-Heatmap">${cat.labs.map(l => `<option value="${esc(l.key)}"${l.key === S.heatLab ? ' selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>` : ''}</fieldset>`;
      if (S.heat === 'lab') {
        h += `<div class="tw" tabindex="0" role="region" aria-label="Heatmap Azubis mal Labs"><table class="heat"><caption class="sr">Anteil gelöster Aufgaben je Azubi und Lab in Prozent</caption><thead><tr><th scope="col">Kürzel</th>${A.labs.map(l => `<th scope="col" class="t" title="${esc(l.name)}"><span>${esc(l.name)}</span></th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><th scope="row" class="nm">${esc(r.name)}</th>${A.labs.map(l => { const st = r.lp[l.key]; return st ? cell(st.pct, st.started, r.name + ', ' + l.name + ': ' + st.d + ' von ' + st.n, st.pct) : '<td class="pc none"></td>'; }).join('')}</tr>`).join('')}</tbody></table></div>`;
      } else {
        const ht = core.heatTopics(M, cat, S.heatLab);
        h += `<div class="tw" tabindex="0" role="region" aria-label="Heatmap Azubis mal Themen"><table class="heat"><caption class="sr">Anteil gelöster Aufgaben je Azubi und Thema in Prozent</caption><thead><tr><th scope="col">Kürzel</th>${ht.cats.map(c => `<th scope="col" class="t" title="${esc(c)}"><span>${esc(c)}</span></th>`).join('')}</tr></thead><tbody>${ht.rows.map(r => `<tr><th scope="row" class="nm">${esc(r.name)}</th>${ht.cats.map(c => { const x = r.cells[c]; return cell(x.pct, x.started, r.name + ', ' + c + ': ' + x.d + ' von ' + x.n, x.pct); }).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      h += '</section>';
      /* Schwächen */
      const W = core.weakness(M, cat), nz = A.rows.length, lname = k => (cat.labs.find(l => l.key === k) || { name: k }).name;
      h += `<section class="card" aria-labelledby="hWeak"><h2 id="hWeak">4. Schwächen-Ranking</h2><p class="mute">Gezählt werden Aufgaben, die ein Azubi versucht oder mit Tipp bearbeitet, aber noch nicht mit 100 % gelöst hat. Neueste Stände aller Azubis.</p><h3>Aufgaben</h3>`;
      h += W.tasks.length ? `<ol class="rank">${W.tasks.slice(0, 15).map(t => `<li><span class="lb">${esc(t.title)} <span class="mute">(${esc(lname(t.lab))})</span></span><span class="bar2" role="img" aria-label="${t.unsolved} von ${t.tried} nicht gelöst"><i style="width:${Math.round(100 * t.unsolved / nz)}%"></i></span><span class="nm">${t.unsolved} von ${t.tried} nicht gelöst · Ø ${t.avgP} %${t.avgH >= 0.5 ? ' · Ø Tipp ' + t.avgH.toFixed(1).replace('.', ',') : ''}</span></li>`).join('')}</ol>` : '<p class="mute">Keine offenen Aufgaben erkennbar.</p>';
      h += '<h3>Themen (Lab und Kategorie)</h3>' + (W.topics.length ? `<ol class="rank">${W.topics.slice(0, 10).map(t => `<li><span class="lb">${esc(t.cat)} <span class="mute">(${esc(lname(t.lab))})</span></span><span class="bar2" role="img" aria-label="${Math.round(100 * t.share)} Prozent nicht gelöst"><i style="width:${Math.round(100 * t.share)}%"></i></span><span class="nm">${t.unsolved} von ${t.tried} Bearbeitungen nicht gelöst (${Math.round(100 * t.share)} %)</span></li>`).join('')}</ol>` : '<p class="mute">Zu wenige Daten für Themen (mindestens 3 Bearbeitungen je Thema).</p>');
      h += '<h3>Prüfungsthemen (Prüfungs-Lab)</h3>' + (W.exam.length ? `<ol class="rank">${W.exam.slice(0, 10).map(t => `<li><span class="lb">${esc(t.t || t.k)}</span><span class="bar2" role="img" aria-label="${t.p} Prozent richtig"><i class="g" style="width:${t.p}%"></i></span><span class="nm">${t.p} % richtig (${t.r} von ${t.n} Fragen, ${t.az} Azubis)</span></li>`).join('')}</ol>` : '<p class="mute">Keine Prüfungsdaten (mindestens 5 beantwortete Fragen je Thema).</p>');
      h += '</section>';
      /* Detail */
      h += `<section class="card" aria-labelledby="hDet"><h2 id="hDet" tabindex="-1">5. Detail je Azubi</h2><label class="rb">Azubi <select id="detSel" aria-label="Azubi für die Detailansicht">${'<option value="">(bitte wählen)</option>' + rows.map(r => `<option value="${esc(r.key)}"${r.key === S.detail ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label><div id="det">${S.detail ? detail(S.detail) : '<p class="mute">Wähle einen Azubi oder klicke in der Tabelle auf ein Kürzel.</p>'}</div></section>`;
      /* Export */
      h += `<section class="card noprint" aria-labelledby="hExp"><h2 id="hExp">6. Export</h2><p class="mute">CSV öffnet sich in Excel (Semikolon, UTF-8). Die Druckansicht zeigt Tabelle, Heatmap, Ranking und Detail; ein Hinweis zum Datenschutz steht oben. Die Dateien enthalten nur Pseudonyme, bitte nur im Ausbilder-Ordner ablegen.</p><div class="row"><button type="button" class="pri" id="bCsv">Übersicht als CSV</button><button type="button" id="bCsvW">Schwächen als CSV</button><button type="button" id="bPrint">Druckansicht (Drucken oder PDF)</button></div></section>`;
      out.innerHTML = h;
      out.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { const k = b.dataset.sort; if (S.sort === k) S.dir = -S.dir; else { S.sort = k; S.dir = (k === 'name') ? 1 : -1; } render(); const nb = out.querySelector('[data-sort="' + k + '"]'); if (nb) nb.focus(); });
      out.querySelectorAll('[data-det]').forEach(b => b.onclick = () => { S.detail = b.dataset.det; render(); const t = out.querySelector('#hDet'); if (t) { t.scrollIntoView({ block: 'start' }); t.focus({ preventScroll: true }); } });
      out.querySelectorAll('input[name=heat]').forEach(r => r.onchange = () => { S.heat = r.value; render(); const x = out.querySelector('input[name=heat][value=' + S.heat + ']'); if (x) x.focus(); });
      const hl = out.querySelector('#heatLab'); if (hl) hl.onchange = () => { S.heatLab = hl.value; render(); const x = out.querySelector('#heatLab'); if (x) x.focus(); };
      out.querySelector('#detSel').onchange = e => { S.detail = e.target.value || null; render(); const x = out.querySelector('#detSel'); if (x) x.focus(); };
      out.querySelector('#bCsv').onclick = () => download('tonfunk-uebersicht-' + isoDay() + '.csv', '﻿' + core.csv(A), 'text/csv;charset=utf-8');
      out.querySelector('#bCsvW').onclick = () => download('tonfunk-schwaechen-' + isoDay() + '.csv', '﻿' + core.csvWeak(core.weakness(M, cat)), 'text/csv;charset=utf-8');
      out.querySelector('#bPrint').onclick = () => root.print();
    }
    const isoDay = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    function download(name, text, type) { const a = D.createElement('a'), url = URL.createObjectURL(new Blob([text], { type })); a.href = url; a.download = name; D.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); }
    function detail(key) {
      const s = M.students.find(x => x.key === key), r = s.latest, row = A.rows.find(x => x.key === key), lname = k => (cat.labs.find(l => l.key === k) || { name: k }).name;
      let h = `<div class="det"><h3>${esc(s.name)}</h3><p>Stand vom <b>${esc(fmtDT(r.ts))}</b>, App ${esc(r.app || '?')}. Aufgaben gelöst: <b>${row.d} von ${row.n}</b> (${row.pct} %). Abzeichen: <b>${row.badges}</b>. Probeprüfungen: <b>${row.exams}</b>. Kampagne: <b>${row.kamp}${row.kampTotal ? ' von ' + row.kampTotal : ''}</b> Kapitel. Letzte erkennbare Aktivität: ${row.act ? esc(fmtDT(row.act)) : '–'}.</p>`;
      h += '<h4>Fortschritt je Lab</h4><ul class="labs">' + A.labs.map(l => { const st = row.lp[l.key]; if (!st) return ''; return `<li><span class="lb">${esc(l.name)}</span><span class="bar2" role="img" aria-label="${st.pct} Prozent"><i style="width:${st.pct}%"></i></span><span class="nm">${st.d}/${st.n} · ${st.pct} %${st.started ? '' : ' (nicht gestartet)'}</span></li>`; }).join('') + '</ul>';
      const bs = Object.keys(r.badges).sort((a, b) => r.badges[b] - r.badges[a]);
      h += '<h4>Abzeichen</h4>' + (bs.length ? '<ul class="chips">' + bs.map(id => { const b = bname(id); return `<li title="${esc(b.desc)}"><span aria-hidden="true">${esc(b.icon)}</span> ${esc(b.name)}${r.badges[id] ? ' <small>(' + esc(fmtD(r.badges[id])) + ')</small>' : ''}</li>`; }).join('') + '</ul>' : '<p class="mute">Noch keine Abzeichen.</p>');
      h += '<h4>Prüfungs-Ergebnisse</h4>' + (r.exam.hist.length ? '<ul class="plain">' + r.exam.hist.slice().reverse().map(e => `<li>${esc(fmtD(e.t))} · ${esc(e.v || '?')}${e.area ? ' (' + esc(e.area) + ')' : ''}: <b>${e.pct} %</b>, Note ${e.note || '?'}${e.secs ? ', ' + Math.round(e.secs / 60) + ' min' : ''}</li>`).join('') + '</ul>' : '<p class="mute">Keine Probeprüfung gemacht.</p>');
      const wt = Object.keys(r.exam.topics).map(k => ({ k, p: Math.round(100 * r.exam.topics[k][0] / r.exam.topics[k][1]), n: r.exam.topics[k][1], t: r.exam.titles[k] || k })).filter(x => x.n >= 5).sort((a, b) => a.p - b.p).slice(0, 5);
      if (wt.length) h += '<h4>Prüfungsthemen (schwächste zuerst)</h4><ul class="plain">' + wt.map(x => `<li>${esc(x.t)}: ${x.p} % (${x.n} Fragen)</li>`).join('') + '</ul>';
      /* Schwächen: aus den tatsächlichen Aufgaben-Einträgen mit Katalog, sonst aus der Datei */
      const wk = Object.keys(r.tasks).filter(id => { const a = r.tasks[id]; return a[0] < 100 && (a[0] > 0 || a[1] > 0); }).map(id => ({ id, p: r.tasks[id][0], h: r.tasks[id][1], m: cat.byId[id] })).sort((a, b) => a.p - b.p || b.h - a.h);
      h += '<h4>Offene Aufgaben (versucht, nicht 100 %)</h4>' + (wk.length ? '<ul class="plain">' + wk.slice(0, 25).map(x => `<li>${esc(x.m ? x.m.title : x.id)} <span class="mute">(${esc(x.m ? lname(x.m.lab) : '?')})</span>: ${x.p} %${x.h ? ', Tipp-Stufe ' + x.h : ''}</li>`).join('') + '</ul>' + (wk.length > 25 ? `<p class="mute">… und ${wk.length - 25} weitere.</p>` : '') : '<p class="mute">Keine.</p>');
      if (r.path.trainer.length) h += `<h4>Trainer durchgespielt</h4><p>${r.path.trainer.map(k => esc(lname(k))).join(', ')}</p>`;
      if (r.path.kampagne.length) h += `<h4>Kampagne: abgeschlossene Kapitel</h4><ul class="plain">${r.path.kampagne.map(k => `<li>${esc(k)}</li>`).join('')}</ul>`;
      if (s.history.length > 1) h += `<h4>Verlauf (${s.history.length} Stände)</h4><table class="mini"><thead><tr><th scope="col">Stand vom</th><th scope="col">Gelöst</th><th scope="col">Abzeichen</th><th scope="col">Datei</th></tr></thead><tbody>${s.history.slice().reverse().map(x => { const lp = {}; let n = 0, d = 0; A.labs.forEach(l => { const st = core.labStat(x, cat, l.key); if (st) { n += st.n; d += st.d; } }); return `<tr><td>${esc(fmtDT(x.ts))}</td><td>${d} von ${n}</td><td>${Object.keys(x.badges).length}</td><td>${esc(x.file || '')}</td></tr>`; }).join('')}</tbody></table>`;
      if (r.warn.length) h += `<p class="mute">Hinweis zur Datei: ${esc(r.warn.join('; '))}.</p>`;
      return h + '</div>';
    }
    rerun();
    return { state: S, add, rerun, combine: () => M, aggregate: () => A };
  }
  const Ueb = { core, mount, SUPPORTED };
  if (typeof module !== 'undefined' && module.exports) module.exports = Ueb; else root.Ueb = Ueb;
})(typeof window !== 'undefined' ? window : globalThis);
