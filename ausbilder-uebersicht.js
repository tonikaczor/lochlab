'use strict';
/* Tonfunk Lab: Ausbilder-Übersicht (ab v23.145). Liest die Stand-Dateien der Azubis (Schema „tonfunk-stand“, erzeugt von stand.js), legt sie zusammen und zeigt
   Tabelle, Heatmap, Schwächen-Ranking und Detailansicht. Alles läuft im Browser: nichts wird hochgeladen, nichts gespeichert (nur Arbeitsspeicher der Seite).
   Die Logik ohne DOM steht in Ueb.core (Tests: quelle/dash/test_uebersicht.js), die Oberfläche in Ueb.mount().
   Schema siehe stand.js und quelle/dash/UEBERSICHT.md. Diese Seite enthält keine Lösungen.
   Ab Schema 2 (v23.147, Paket D3): Block duell (Duell-Verlauf mit signiertem Code), karriere, jahrgang; Abschnitt 5 „Prüfungs-Duelle und Bestenliste“ (Paar-Prüfung, Flags, Bestenliste TFB1, CSV).
   Schema-1-Dateien bleiben lesbar (kein Block = keine Duelle). Die Duell-Logik (Codes, Signatur, Flags, Bestenliste) kommt aus duell.js (Duell.core), die Übersicht rechnet nichts davon nach. */
(function (root) {
  const SUPPORTED = 2, MAXBYTES = 2 * 1024 * 1024, MAXFILES = 500, DAY = 86400000;
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
    const r = { kuerzel: o.kuerzel, key: core.keyOf(o.kuerzel), ts: Math.round(ts), app: String(o.app || '').replace(/[^\w.\-]/g, '').slice(0, 20), tasks: {}, labs: {}, badges: {}, exam: { hist: [], topics: {}, titles: {} }, path: { trainer: [], kampagne: [], kampTotal: null, stats: {}, duels: 0, think: 0, predict: [0, 0] }, weak: { tasks: [], topics: [] }, jahrgang: '', duell: { jahrgang: '', n: 0, wins: 0, hist: [] }, karriere: null, warn };
    let drop = 0;
    Object.keys(o.tasks).slice(0, 3000).forEach(id => { const a = o.tasks[id]; if (!idOk(id) || !Array.isArray(a) || !isFinite(+a[0])) { drop++; return; } r.tasks[id] = [clamp(int(a[0]), 0, 100), clamp(int(a[1]), 0, 3)]; });
    if (drop) warn.push(drop + ' ungültige Aufgaben-Einträge übersprungen');
    if (isObj(o.labs)) Object.keys(o.labs).slice(0, 100).forEach(k => { const a = o.labs[k]; if (!idOk(k) || !Array.isArray(a)) return; const n = int(a[0]), d = int(a[1]); if (n < 1 || d < 0 || d > n) return; r.labs[k] = [n, d, clamp(int(a[2]), 0, 100)]; });
    if (isObj(o.badges)) Object.keys(o.badges).slice(0, 400).forEach(k => { if (idOk(k)) r.badges[k] = Math.max(0, int(o.badges[k])); });
    if (isObj(o.exam)) {
      (Array.isArray(o.exam.hist) ? o.exam.hist : []).slice(-30).forEach(h => {
        if (!isObj(h)) return; const e = { v: String(h.v || '').replace(/[^\w-]/g, '').slice(0, 20), area: String(h.area || '').replace(/[^\w-]/g, '').slice(0, 20), t: Math.max(0, int(h.t)), pct: clamp(int(h.pct), 0, 100), note: clamp(int(h.note), 0, 6), secs: Math.max(0, int(h.secs)), topics: {} }; if (h.gp) e.gp = 1;
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
    /* Schema 2: Jahrgang, Duelle, Karriere (bei Schema 1 gibt es die Blöcke nicht: keine Duelle) */
    r.jahrgang = /^\d{4}$/.test(String(o.jahrgang || '')) ? String(o.jahrgang) : '';
    if (o.schema >= 2 && isObj(o.duell)) {
      const d = o.duell; r.duell.jahrgang = /^\d{4}$/.test(String(d.jahrgang || '')) ? String(d.jahrgang) : r.jahrgang; if (!r.jahrgang) r.jahrgang = r.duell.jahrgang;
      r.duell.n = Math.max(0, int(d.n)); r.duell.wins = Math.max(0, int(d.wins));
      (Array.isArray(d.hist) ? d.hist : []).slice(0, 50).forEach(h => {
        if (!isObj(h) || !/^K\d{2}-[0-9A-Fa-f]{4}$/.test(String(h.r || '')) || !/^[A-Za-z0-9_-]{1,12}$/.test(String(h.a || ''))) return;
        const e = { r: String(h.r).toUpperCase(), a: String(h.a), lab: /^[a-z]{2,5}$/.test(String(h.lab || '')) ? String(h.lab) : '', st: clamp(int(h.st), 1, 3), t: Math.max(0, int(h.t)), ms: clamp(int(h.ms), 0, 3 * 3600 * 1000), pct: clamp(int(h.pct), 0, 100),
          h: clamp(int(h.h), 0, 2), f: clamp(int(h.f), 0, 50), m: h.m == null ? null : clamp(int(h.m), 0, 200), pr: h.pr ? 1 : 0, pts: clamp(int(h.pts), 0, 100), g: '', gp: null, sig: '', code: '' };
        if (typeof h.g === 'string' && /^[A-Za-z0-9_-]{1,12}$/.test(h.g)) { e.g = h.g; e.gp = h.gp == null ? null : clamp(int(h.gp), 0, 100); }
        const cm = /^TFD1\.[A-Za-z0-9_-]{1,600}\.(?:[0-9a-f]{12}|u)$/.exec(String(h.code || '')); if (cm) { e.code = cm[0]; e.sig = cm[0].slice(cm[0].lastIndexOf('.') + 1); }
        r.duell.hist.push(e);
      });
    }
    if (o.schema >= 2 && isObj(o.karriere)) { const k = o.karriere, g = isObj(k.gp) ? { t: Math.max(0, int(k.gp.t)), pct: clamp(int(k.gp.pct), 0, 100), note: clamp(int(k.gp.note), 0, 6) } : null; r.karriere = { level: clamp(int(k.level), 1, 20), xp: Math.max(0, int(k.xp)), gp: g }; }
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


  /* ---------- Duelle (Schema 2): Datensätze, Prüfung, Paare, Bestenliste, CSV. Logik der Codes steht in duell.js (D = Duell). ---------- */
  core.FLAGTXT = { punkte: 'Punkte passen nicht zu den Zahlen', geraten: 'geraten? (0 Messungen bei 100 %)', zu_schnell: 'unplausibel schnell', tipps: 'mehr als 2 Tipps im Code', zukunft: 'Zeitstempel in der Zukunft', fremde_kw: 'Code aus anderer Kalenderwoche',
    sig_falsch: 'Signatur falsch', unsigniert: 'unsigniert (Signatur nicht prüfbar)', nicht_pruefbar: 'kein Code, Signatur nicht prüfbar', code_passt_nicht: 'Code passt nicht zu den Werten in der Datei', aufgabe_verschieden: 'Paar mit verschiedener Aufgabe oder Stufe' };
  core.BAD = ['sig_falsch', 'punkte', 'zukunft', 'code_passt_nicht'];   /* Flags, die einen Eintrag aus der Bestenliste nehmen */
  const roundBase = (D, r) => (D && D.core.roundBase(r)) || String(r || '');
  core.duelKw = (D, r) => { const p = D && D.core.parseRound(r); return p ? p.kw : 0; };
  /* alle Duelle aus allen Ständen (auch älteren) der geladenen Dateien plus eingelesene Codes; je Kürzel/Runde/Aufgabe/Zeit nur einmal */
  core.duelRecs = function (state, extra, D) {
    const seen = {}, out = [];
    const push = x => { const k = String(x.k).toLowerCase() + '|' + roundBase(D, x.r) + '|' + x.a + '|' + x.t; if (seen[k]) return; seen[k] = 1; out.push(x); };
    ((state && state.students) || []).forEach(s => s.history.slice().reverse().forEach(r => (r.duell ? r.duell.hist : []).forEach(h => push({ src: 'datei', file: r.file || '', k: s.name, j: r.duell.jahrgang || r.jahrgang || '', r: roundBase(D, h.r), a: h.a, lab: h.lab, st: h.st, t: h.t, ms: h.ms, pct: h.pct, h: h.h, f: h.f, m: h.m, pr: h.pr, pts: h.pts, g: h.g || '', gp: h.gp == null ? null : h.gp, sig: h.sig || '', code: h.code || '' }))));
    (extra || []).forEach(x => push(x));
    return out.map(x => Object.assign({ kw: core.duelKw(D, x.r) }, x));
  };
  /* Prüfung eines Datensatzes (asynchron wegen WebCrypto): Signatur gegen den Rundencode, Plausibilität, Vergleich Code und Datei. Liefert { sig, flags } */
  core.duelCheck = async function (rec, D, now) {
    now = now || Date.now();
    const base = Object.assign({}, rec, { p: rec.pct, _hRaw: rec.h }); let fl = D.core.flags(base, { now }), sig = 'ohne';
    if (rec.code) {
      const v = await D.core.verify(rec.code, undefined, { now });
      if (v) {
        sig = v.sig; fl = v.flags.slice(); const c = v.rec;
        const kOk = !rec.k || rec.src !== 'datei' || rec.k.length > 24 || c.k.toLowerCase() === rec.k.toLowerCase();
        if (rec.src === 'datei' && (!kOk || c.r !== rec.r || c.a !== rec.a || c.pts !== rec.pts || c.p !== rec.pct || c.ms !== rec.ms)) fl.push('code_passt_nicht');
      } else fl.push('nicht_pruefbar');
    } else if (rec.sig === 'u') { sig = 'unsigniert'; fl.push('unsigniert'); } else fl.push('nicht_pruefbar');
    return { sig, flags: fl.filter((x, i) => fl.indexOf(x) === i) };
  };
  core.duelCheckAll = async function (recs, D, now) { const out = []; for (const r of recs) out.push(Object.assign({}, r, await core.duelCheck(r, D, now))); return out; };
  /* Runden: je Rundencode die Spieler (je Kürzel der beste Eintrag), Paar-Status */
  core.rounds = function (recs, D) {
    const by = {};
    recs.forEach(x => { (by[x.r] = by[x.r] || []).push(x); });
    return Object.keys(by).map(r => {
      const bk = {}; by[r].forEach(x => { const k = x.k.toLowerCase(); if (!bk[k] || D.core.effPts(x) > D.core.effPts(bk[k])) bk[k] = x; });
      const pl = Object.keys(bk).map(k => bk[k]).sort((a, b) => D.core.effPts(b) - D.core.effPts(a) || a.ms - b.ms || a.h - b.h || a.k.localeCompare(b.k, 'de')), a0 = pl[0];
      const same = pl.every(x => x.a === a0.a && x.st === a0.st), paar = pl.length >= 2 ? (same ? 'paar' : 'abweichend') : 'einzel';
      const flags = []; pl.forEach(x => (x.flags || []).forEach(f => flags.push({ k: x.k, f })));
      if (paar === 'abweichend') flags.push({ k: '', f: 'aufgabe_verschieden' });
      return { r, kw: a0.kw, a: a0.a, lab: a0.lab, st: a0.st, players: pl, paar, flags, sigOk: pl.every(x => x.sig === 'ok'), hint: paar === 'einzel' && a0.g ? { g: a0.g, gp: a0.gp } : null };
    }).sort((x, y) => y.kw - x.kw || x.r.localeCompare(y.r));
  };
  /* Bestenliste: je Kürzel/Runde nur der beste Eintrag; Einträge mit schweren Flags zählen nicht; Duell.core.bestenliste rechnet (beste 3, bekannte Aufgabe halb) */
  core.best = function (recs, D, opt) {
    opt = opt || {}; const bk = {}; let skipped = 0;
    recs.forEach(x => {
      if ((x.flags || []).some(f => core.BAD.indexOf(f) >= 0)) { skipped++; return; }
      const k = x.k.toLowerCase() + '|' + x.r, w = D.core.effPts(x); if (!bk[k] || w > D.core.effPts(bk[k])) bk[k] = x;
    });
    return { rows: D.core.bestenliste(Object.keys(bk).map(k => bk[k]), { kw: opt.kw, j: opt.j, top: opt.top || 10 }), skipped };
  };
  core.fmtMs = ms => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + pad(s % 60); };
  core.csvDuell = function (rounds, cat) {
    const head = ['KW', 'Runde', 'Aufgabe', 'Lab', 'Stufe', 'Kürzel', 'Jahrgang', 'Punkte', 'Zeit (s)', 'Tipps', 'Versuche', 'Messungen', 'Bekannte Aufgabe', 'Paar', 'Signatur', 'Flags'];
    const lines = [head.map(core.csvCell).join(';')];
    rounds.forEach(R => R.players.forEach(p => lines.push([R.kw, R.r, (cat && cat.byId[R.a] ? cat.byId[R.a].title : R.a), R.lab, R.st, p.k, p.j, p.pts, Math.round(p.ms / 1000), p.h, p.f, p.m == null ? '' : p.m, p.pr ? 'ja' : '', R.paar === 'paar' ? 'vollständig' : R.paar === 'abweichend' ? 'abweichend' : 'Gegner fehlt', p.sig || '', (p.flags || []).map(f => core.FLAGTXT[f] || f).join(' | ')].map(core.csvCell).join(';'))));
    return lines.join('\r\n') + '\r\n';
  };

  /* ====================================================== Oberfläche ====================================================== */
  let UI = null;
  function mount(host, G, doc) {
    const D = doc || document, cat = core.catalog(G || {});
    const BD = (root.Badges && root.Badges.DEFS) || [], bname = id => { const d = BD.find(x => x[0] === id); return d ? { icon: d[1], name: d[2], desc: d[3] } : { icon: '🏅', name: id, desc: '' }; };
    const S = { inputs: [], sort: 'name', dir: 1, heat: 'lab', heatLab: '', detail: null, msg: '', dKw: '', dJg: 'alle', codes: [], dv: null, dmsg: '', pub: null, imp: null };
    let M = null, A = null;
    const $ = s => host.querySelector(s);
    host.innerHTML = `<section class="card noprint" aria-labelledby="hLoad"><h2 id="hLoad">1. Stand-Dateien laden</h2>
      <p class="mute">Wähle die Dateien <code>tonfunk-stand-….json</code> der Azubis aus (mehrere auf einmal) oder ziehe sie hierher. Mehrere Stände desselben Kürzels: der neueste zählt, ältere bilden den Verlauf. Es wird nichts hochgeladen und nichts gespeichert.</p>
      <div id="drop" class="drop"><label class="fbtn" for="files">Dateien auswählen</label><input type="file" id="files" multiple accept=".json,application/json"><span class="mute">oder Dateien hier ablegen</span></div>
      <div class="row"><button type="button" id="reset" class="danger">Alles zurücksetzen</button><span id="stat" class="mute" role="status" aria-live="polite"></span></div>
      <ul id="errs" class="errs" aria-label="Meldungen zu Dateien"></ul></section>
      <div id="out"></div>`;
    const out = $('#out');
    function rerun() { M = core.combine(S.inputs); A = core.aggregate(M, cat); if (S.detail && !M.students.some(s => s.key === S.detail)) S.detail = null; if (!S.heatLab || !cat.labs.some(l => l.key === S.heatLab)) { const withData = A.labs.find(l => A.rows.some(r => r.lp[l.key] && r.lp[l.key].started)); S.heatLab = withData ? withData.key : (cat.labs[0] || {}).key || ''; } S.dv = null; render(); duelRefresh(); }
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
    $('#reset').onclick = () => { S.inputs = []; S.codes = []; S.pub = null; S.imp = null; S.dmsg = ''; S.detail = null; S.msg = ''; rerun(); $('#files').focus(); };

    const th = (k, t, tip) => `<th scope="col" aria-sort="${S.sort === k ? (S.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="srt" data-sort="${k}" title="${esc(tip || 'Sortieren')}">${t}<span aria-hidden="true">${S.sort === k ? (S.dir > 0 ? ' ▲' : ' ▼') : ''}</span></button></th>`;
    const cmp = { name: (a, b) => a.name.localeCompare(b.name, 'de'), pct: (a, b) => a.pct - b.pct, solved: (a, b) => a.d - b.d, badges: (a, b) => a.badges - b.badges, exam: (a, b) => (a.examBest == null ? -1 : a.examBest) - (b.examBest == null ? -1 : b.examBest), ts: (a, b) => a.ts - b.ts, act: (a, b) => a.act - b.act, weak: (a, b) => a.weak - b.weak };
    const cell = (p, started, title, txt) => started ? `<td class="pc" style="background:${core.color(p)}" title="${esc(title)}">${txt == null ? p : txt}</td>` : `<td class="pc none" title="${esc(title)}"><span class="sr">nicht gestartet</span></td>`;
    function stand(r) { const old = Date.now() - r.ts > 14 * DAY; return `<span title="${esc(fmtDT(r.ts))}">${esc(fmtD(r.ts))}</span>${old ? ' <span class="old" title="Der Stand ist älter als 14 Tage">älter</span>' : ''}`; }

    function render() {
      $('#errs').innerHTML = M.errors.map(e => `<li><b>${esc(e.name)}</b>: ${esc(e.error)}</li>`).join('');
      $('#stat').textContent = M.files ? (M.ok + ' Azubis aus ' + M.files + ' Dateien' + (M.errors.length ? ', ' + M.errors.length + ' Datei(en) nicht lesbar' : '') + (M.dups ? ', ' + M.dups + ' doppelte übersprungen' : '') + (M.older ? ', ' + M.older + ' ältere Stände im Verlauf' : '') + '.' + (S.msg ? ' ' + S.msg : '')) : 'Noch keine Dateien geladen.';
      if (!A.rows.length) { out.innerHTML = '<p class="mute">Noch keine Daten. Lade oben die Dateien der Azubis (Duell-Codes kannst du unten auch ohne Dateien einlesen).</p><div id="duellHost"></div>'; renderDuell(); return; }
      const rows = A.rows.slice().sort((a, b) => (cmp[S.sort](a, b) || a.name.localeCompare(b.name, 'de')) * S.dir);
      let h = `<section class="card" aria-labelledby="hTab"><h2 id="hTab">2. Übersicht je Azubi</h2>
        <div class="kpis"><div class="kpi"><b>${A.kpi.n}</b><span>Azubis</span></div><div class="kpi"><b>${A.kpi.pct} %</b><span>Ø Fortschritt (gelöste Aufgaben)</span></div><div class="kpi"><b>${A.kpi.solved}</b><span>gelöste Aufgaben insgesamt</span></div><div class="kpi"><b>${A.kpi.badges}</b><span>Abzeichen insgesamt</span></div><div class="kpi"><b>${A.kpi.exams}</b><span>Probeprüfungen</span></div><div class="kpi"><b class="sm">${esc(fmtD(A.kpi.oldest))} bis ${esc(fmtD(A.kpi.newest))}</b><span>Zeitraum der Stände</span></div></div>
        <p class="mute">Fortschritt = Anteil der Aufgaben mit 100 %, wie auf der Startseite des Azubis. „Stand vom“ ist der Zeitpunkt des Exports. „Letzte Aktivität“ ist das jüngste Abzeichen oder die jüngste Probeprüfung (die App speichert keine Bearbeitungsdauer und keine Versuchszahl).</p>
        <div class="tw" tabindex="0" role="region" aria-label="Tabelle Azubis, waagerecht scrollbar"><table><caption class="sr">Azubis mit Fortschritt je Lab</caption><thead><tr>${th('name', 'Kürzel')}${th('pct', 'Fortschritt')}${th('solved', 'Gelöst')}${th('badges', 'Abzeichen')}<th scope="col" title="Karriere-Rang laut Stand-Datei (ab Schema 2)">Rang</th>${th('exam', 'Beste Prüfung', 'Beste Probeprüfung in Prozent')}${th('weak', 'Schwächen', 'Versuchte, noch nicht gelöste Aufgaben')}${th('ts', 'Stand vom')}${th('act', 'Letzte Aktivität')}${A.labs.map(l => `<th scope="col" class="t" title="${esc(l.name)}"><span>${esc(l.short)}</span></th>`).join('')}</tr></thead><tbody>`;
      rows.forEach(r => {
        h += `<tr><th scope="row" class="nm"><button type="button" class="lnk" data-det="${esc(r.key)}">${esc(r.name)}</button></th><td class="pc" style="background:${core.color(r.pct)}"><span class="bar" aria-hidden="true"><i style="width:${r.pct}%"></i></span>${r.pct} %</td><td>${r.d}/${r.n}</td><td>${r.badges}</td><td>${r.rec.karriere ? 'Rang ' + r.rec.karriere.level + ' · ' + r.rec.karriere.xp + ' XP' : '–'}</td><td>${r.examBest == null ? '–' : r.examBest + ' % (Note ' + (r.noteBest == null ? '?' : r.noteBest) + ')'}</td><td>${r.weak}</td><td>${stand(r)}</td><td>${r.act ? esc(fmtD(r.act)) : '–'}</td>`;
        h += A.labs.map(l => { const st = r.lp[l.key]; return st ? cell(st.pct, st.started, l.name + ': ' + st.d + ' von ' + st.n + ' Aufgaben, Ø ' + st.avg + ' %', st.pct) : '<td class="pc none"><span class="sr">kein Eintrag</span></td>'; }).join('') + '</tr>';
      });
      h += `</tbody><tfoot><tr><th scope="row" class="nm">Ø alle</th><td>${A.kpi.pct} %</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>${A.labs.map(l => { const v = A.rows.filter(r => r.lp[l.key] && r.lp[l.key].started).map(r => r.lp[l.key].pct); return `<td>${v.length ? Math.round(sum(v) / v.length) : ''}</td>`; }).join('')}</tr></tfoot></table></div>
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
      h += '<div id="duellHost"></div>';
      /* Detail */
      h += `<section class="card" aria-labelledby="hDet"><h2 id="hDet" tabindex="-1">6. Detail je Azubi</h2><label class="rb">Azubi <select id="detSel" aria-label="Azubi für die Detailansicht">${'<option value="">(bitte wählen)</option>' + rows.map(r => `<option value="${esc(r.key)}"${r.key === S.detail ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label><div id="det">${S.detail ? detail(S.detail) : '<p class="mute">Wähle einen Azubi oder klicke in der Tabelle auf ein Kürzel.</p>'}</div></section>`;
      /* Export */
      h += `<section class="card noprint" aria-labelledby="hExp"><h2 id="hExp">7. Export</h2><p class="mute">CSV öffnet sich in Excel (Semikolon, UTF-8). Die Druckansicht zeigt Tabelle, Heatmap, Ranking und Detail; ein Hinweis zum Datenschutz steht oben. Die Dateien enthalten nur Pseudonyme, bitte nur im Ausbilder-Ordner ablegen.</p><div class="row"><button type="button" class="pri" id="bCsv">Übersicht als CSV</button><button type="button" id="bCsvW">Schwächen als CSV</button><button type="button" id="bPrint">Druckansicht (Drucken oder PDF)</button></div></section>`;
      out.innerHTML = h; renderDuell();
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

    /* ---------- Abschnitt 5: Prüfungs-Duelle und Bestenliste (Schema 2 und eingelesene Codes) ---------- */
    const DU = () => root.Duell || null;
    let dvSeq = 0;
    async function duelRefresh() {
      const Du = DU(); if (!Du) { S.dv = []; renderDuell(); return; }
      const seq = ++dvSeq; let chk = [];
      try { chk = await core.duelCheckAll(core.duelRecs(M, S.codes, Du), Du); } catch (e) { chk = []; }
      if (seq !== dvSeq) return; S.dv = chk; renderDuell();
    }
    function addCodes(text) {
      const Du = DU(); if (!Du) return 0; const items = Du.core.parse(text); let last = null;
      items.forEach(it => {
        const r = it.rec; last = r;
        if (S.codes.some(x => x.code === it.code)) return;
        S.codes.push({ src: 'code', file: '', k: r.k, j: r.j, r: r.r, a: r.a, lab: r.lab, st: r.st, t: r.t, ms: r.ms, pct: r.p, h: r.h, f: r.f, m: r.m == null ? null : r.m, pr: r.pr, pts: r.pts, g: '', gp: null, sig: it.sig, code: it.code });
      });
      if (last) { S.dKw = String(core.duelKw(Du, last.r) || ''); S.dJg = 'alle'; S.pub = null; S.dmsg = items.length + ' Duell-Code(s) gelesen.'; S.dv = null; duelRefresh(); }
      return items.length;
    }
    function qrInto(host, text) {
      const draw = () => { try { const q = root.qrcode(0, 'M'); q.addData(String(text), 'Byte'); q.make(); host.innerHTML = q.createSvgTag({ cellSize: 3, margin: 2, scalable: true }); host.setAttribute('role', 'img'); host.setAttribute('aria-label', 'QR-Code der Bestenliste'); } catch (e) { host.textContent = 'QR nicht möglich. Bitte den Text weitergeben.'; } };
      if (root.qrcode) { draw(); return; }
      const sc = D.createElement('script'); sc.src = 'qr.js'; sc.onload = draw; sc.onerror = () => { host.textContent = 'QR nicht verfügbar. Bitte den Text weitergeben.'; }; D.head.appendChild(sc);
    }
    function renderDuell() {
      const host = $('#duellHost'); if (!host) return; const Du = DU(), lname = k => (cat.labs.find(l => l.key === k) || { name: k }).name;
      if (!Du) { host.innerHTML = '<section class="card" aria-labelledby="hDuel"><h2 id="hDuel">5. Prüfungs-Duelle und Bestenliste</h2><p class="mute">Das Duell-Modul (duell.js) ist nicht geladen.</p></section>'; return; }
      const all = S.dv || [], rounds = core.rounds(all, Du);
      const kws = rounds.map(r => r.kw).filter((v, i, a) => v && a.indexOf(v) === i).sort((a, b) => b - a), jgs = all.map(x => x.j).filter((v, i, a) => v && a.indexOf(v) === i).sort().reverse();
      if (S.dKw === '' || (S.dKw !== 'alle' && kws.length && kws.indexOf(+S.dKw) < 0)) S.dKw = kws.length ? String(kws[0]) : 'alle';
      if (S.dJg !== 'alle' && jgs.indexOf(S.dJg) < 0) S.dJg = 'alle';
      const kwN = S.dKw === 'alle' ? undefined : +S.dKw, jgV = S.dJg === 'alle' ? undefined : S.dJg;
      const sel = core.rounds(all.filter(x => (kwN == null || x.kw === kwN) && (jgV == null || x.j === jgV)), Du), bl = core.best(all, Du, { kw: kwN, j: jgV });
      const pending = S.dv == null;
      let h = `<section class="card" aria-labelledby="hDuel"><h2 id="hDuel" tabindex="-1">5. Prüfungs-Duelle und Bestenliste</h2>
        <p class="mute">Quelle: der Block „duell“ der Stand-Dateien (Schema 2) und Duell-Codes, die du hier scannst oder einfügst (nur im Arbeitsspeicher, nichts wird gespeichert). Die Signatur wird gegen den Rundencode geprüft; sie ist <b>manipulationsarm, nicht manipulationssicher</b>. Wirksam ist das Nachstellen der Runde und das Gespräch mit dem Azubi. Die Übersicht zeigt nie Fehlertexte oder Lösungen.</p>
        <div class="row noprint"><label class="rb">KW <select id="dKw" aria-label="Kalenderwoche der Runde">${kws.map(k => `<option value="${k}"${S.dKw === String(k) ? ' selected' : ''}>KW ${k}</option>`).join('')}<option value="alle"${S.dKw === 'alle' ? ' selected' : ''}>alle</option></select></label>
          <label class="rb">Jahrgang <select id="dJg" aria-label="Jahrgang"><option value="alle">alle</option>${jgs.map(j => `<option value="${esc(j)}"${S.dJg === j ? ' selected' : ''}>${esc(j)}</option>`).join('')}</select></label>
          <button type="button" id="dScan">Duell-QR scannen</button></div>
        <details class="noprint" id="dPasteD"><summary>Code einfügen (TFD1.…)</summary><label class="sr" for="dTxt">Duell-Codes</label><textarea id="dTxt" rows="3" placeholder="TFD1.…  (mehrere Codes untereinander möglich)"></textarea><div class="row"><button type="button" class="pri" id="dAdd">Codes übernehmen</button></div></details>
        <p class="mute" id="dMsg" role="status" aria-live="polite">${esc(S.dmsg)}${pending ? ' Prüfe Signaturen …' : ''}</p>`;
      h += `<h3>Bestenliste ${S.dKw === 'alle' ? 'alle Wochen' : 'KW ' + esc(S.dKw)}, Jahrgang ${esc(S.dJg === 'alle' ? 'alle' : S.dJg)} <span class="mute">(Summe der besten 3 Duelle; bekannte Aufgabe zählt halb)</span></h3>`;
      h += bl.rows.length ? `<ol class="best">${bl.rows.map((r, i) => `<li><span class="pos">${i + 1}.</span><span class="bn">${esc(r[0])}</span><b>${r[1]} Punkte</b><span class="mute">${r[2]} Duell${r[2] === 1 ? '' : 'e'}</span></li>`).join('')}</ol>` : '<p class="mute">Noch keine gewerteten Duelle für diese Auswahl.</p>';
      if (bl.skipped) h += `<p class="mute">${bl.skipped} Eintrag/Einträge mit schweren Hinweisen (Signatur falsch, Punkte passen nicht, Zukunft, Code passt nicht) zählen hier nicht.</p>`;
      h += `<div class="row noprint"><button type="button" id="dPub">Als Code/QR veröffentlichen</button><button type="button" id="dCsv"${sel.length ? '' : ' disabled'}>CSV Duelle</button></div>
        <p class="mute noprint">Die Bestenliste ist freiwillig (Opt-in): Azubis sehen sie nur, wenn du diesen Code ausgibst und sie ihn selbst einlesen. Es stehen nur Kürzel und Punkte darin. Gib sie nur mit Einverständnis der Azubis weiter.</p>`;
      if (S.pub) h += `<div class="pub noprint"><div class="qrbox" id="dQr"></div><div><label for="dPubT">Bestenlisten-Code (TFB1)</label><textarea id="dPubT" rows="4" readonly>${esc(S.pub.code)}</textarea><div class="row"><button type="button" id="dPubCp">Kopieren</button></div></div></div>`;
      h += '<h3>Duelle</h3>';
      if (!sel.length) h += `<p class="mute">${pending ? 'Wird geprüft …' : 'Keine Duelle für diese Auswahl. Stand-Dateien mit Block „duell“ laden oder einen Duell-Code scannen.'}</p>`;
      else {
        const pl = (R, f) => R.players.map(f).join(' / ');
        h += `<div class="tw" tabindex="0" role="region" aria-label="Tabelle Duelle, waagerecht scrollbar"><table class="duel"><caption class="sr">Duelle der Auswahl</caption><thead><tr><th scope="col">Runde</th><th scope="col">Aufgabe</th><th scope="col">Spieler</th><th scope="col">Punkte</th><th scope="col">Zeit</th><th scope="col">Tipps</th><th scope="col">Versuche</th><th scope="col">Mess.</th><th scope="col">Prüfung und Flags</th><th scope="col" class="noprint">Nachstellen</th></tr></thead><tbody>`;
        sel.forEach(R => {
          const t = cat.byId[R.a], file = ((G && G.LAB_REG) || {})[t && t.lab], href = (file && file.file ? file.file : 'index.html') + '?aufgabe=' + encodeURIComponent(R.a) + '&duell=' + encodeURIComponent(R.r) + '&st=' + R.st + (R.lab ? '&lab=' + R.lab : '');
          const fl = R.flags, ok = R.paar === 'paar' && R.sigOk && !fl.length;
          const stat = R.paar === 'paar' ? (ok ? '<b class="okc">✓ Paar vollständig, Signaturen ok</b>' : '<b class="wc">⚠ Paar vollständig, mit Hinweisen</b>') : R.paar === 'abweichend' ? '<b class="wc">⚠ Paar, aber Aufgabe oder Stufe verschieden</b>' : '<b class="wc">Gegner fehlt</b>' + (R.hint ? ` <span class="mute">(laut Code: ${esc(R.hint.g)}${R.hint.gp != null ? ', ' + R.hint.gp + ' Punkte' : ''})</span>` : '');
          h += `<tr><th scope="row" class="nm">${esc(R.r)}<br><span class="mute">KW ${R.kw}</span></th><td class="l">${esc(t ? t.title : R.a)}<br><span class="mute">${esc(t ? lname(t.lab) : (R.lab || '?'))}, Stufe ${R.st}</span></td><td>${pl(R, p => esc(p.k))}</td><td>${pl(R, p => p.pts + (p.pr ? '*' : ''))}</td><td>${pl(R, p => core.fmtMs(p.ms))}</td><td>${pl(R, p => p.h)}</td><td>${pl(R, p => p.f)}</td><td>${pl(R, p => (p.m == null ? '–' : p.m))}</td>
            <td class="l">${stat}${fl.length ? '<ul class="fl">' + fl.map(f => `<li>${f.k ? esc(f.k) + ': ' : ''}${esc(core.FLAGTXT[f.f] || f.f)}</li>`).join('') + '</ul>' : ''}</td>
            <td class="noprint"><a class="fbtn nach" href="${esc(href)}" target="_blank" rel="noopener" title="Öffnet das Lab mit dieser Runde (Rundencode ${esc(R.r)})">Runde nachstellen</a></td></tr>`;
        });
        h += '</tbody></table></div><p class="mute">* Aufgabe war dem Azubi schon bekannt: zählt in der Bestenliste halb. „Gegner fehlt“: nur ein Code zu dieser Runde geladen.</p>';
      }
      h += `<h3>Runde nachstellen per Rundencode</h3><p class="mute noprint">Gleicher Rundencode, gleiche Stufe und gleicher Lab-Filter ergeben dieselbe Aufgabe mit demselben Fehler. So kannst du die Runde selbst durchspielen und den Azubi die Ursache erklären lassen.</p>
        <div class="row noprint"><label class="rb">Rundencode <input type="text" id="dRc" placeholder="K43-7F2A" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Rundencode"></label>
          <label class="rb">Stufe <select id="dRs" aria-label="Stufe"><option>1</option><option selected>2</option><option>3</option></select></label>
          <label class="rb">Lab <select id="dRl" aria-label="Lab-Filter"><option value="">alle Fehlersuchen</option>${Du.core.pool(G && G.AUFGABEN).map(r => r[1]).filter((v, i, a) => a.indexOf(v) === i).map(k => `<option value="${esc(k)}">${esc(lname(k))}</option>`).join('')}</select></label></div><p id="dRout" role="status" aria-live="polite"></p>`;
      h += `<h3 class="noprint">Bestenlisten-Code einlesen (TFB1)</h3><div class="noprint"><label class="sr" for="dBin">Bestenlisten-Code</label><textarea id="dBin" rows="2" placeholder="TFB1.…"></textarea><div class="row"><button type="button" id="dBimp">Einlesen</button></div><div id="dBout" aria-live="polite"></div></div></section>`;
      host.innerHTML = h;
      const q = x => host.querySelector(x), back = id => { const e = host.querySelector(id); if (e) e.focus(); };
      q('#dKw').onchange = e => { S.dKw = e.target.value; S.pub = null; renderDuell(); back('#dKw'); };
      q('#dJg').onchange = e => { S.dJg = e.target.value; S.pub = null; renderDuell(); back('#dJg'); };
      q('#dScan').onclick = () => { if (!root.QrScan) { S.dmsg = 'Der Scanner (qrscan.js) ist nicht geladen. Bitte den Code einfügen.'; renderDuell(); return; } root.QrScan.open({ title: 'Duell-QR des Azubis scannen', onText: t => (addCodes(t) ? true : 'Das ist kein Duell-Code (er beginnt mit TFD1.).') }); };
      q('#dAdd').onclick = () => { const n = addCodes(q('#dTxt').value); if (!n) { S.dmsg = 'Kein gültiger Duell-Code (TFD1.…) gefunden.'; renderDuell(); back('#dTxt'); } };
      q('#dCsv').onclick = () => download('tonfunk-duelle-' + isoDay() + '.csv', '﻿' + core.csvDuell(sel, cat), 'text/csv;charset=utf-8');
      q('#dPub').onclick = async () => {
        if (kwN == null) { S.dmsg = 'Bitte oben eine Kalenderwoche wählen, die Bestenliste gilt für eine Woche.'; renderDuell(); return; }
        if (!bl.rows.length) { S.dmsg = 'Die Bestenliste ist leer.'; renderDuell(); return; }
        S.pub = { code: await Du.core.encodeBest({ kw: kwN, j: jgV || '', t: Date.now(), rows: bl.rows }, null) }; S.dmsg = 'Bestenlisten-Code erzeugt (unsigniert, da kein Rundenschlüssel). Gib ihn nur mit Einverständnis der Azubis aus.'; renderDuell(); back('#dPubT');
      };
      if (S.pub) { qrInto(q('#dQr'), S.pub.code); q('#dPubCp').onclick = () => { const t = q('#dPubT'); t.focus(); t.select(); try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(S.pub.code); else D.execCommand('copy'); } catch (e) {} q('#dMsg').textContent = 'Kopiert.'; }; }
      const rc = q('#dRc'), upd = () => {
        const out = q('#dRout'), pr = Du.core.parseRound(rc.value); if (!rc.value.trim()) { out.textContent = ''; return; }
        if (!pr) { out.textContent = 'Kein gültiger Rundencode (Form K43-7F2A).'; return; }
        const known = all.find(x => x.r === Du.core.roundBase(pr.code)); let row = null;
        if (known) row = cat.byId[known.a] ? [known.a, cat.byId[known.a].lab] : null;
        if (!row) { const p = Du.core.pick(pr.code, Du.core.pool(G && G.AUFGABEN), { st: +q('#dRs').value, lab: q('#dRl').value }); row = p ? [p[0], p[1]] : null; }
        if (!row) { out.textContent = 'Zu dieser Stufe und diesem Lab gibt es keine Aufgabe.'; return; }
        const t = cat.byId[row[0]], lf = ((G && G.LAB_REG) || {})[row[1]], st = known ? known.st : +q('#dRs').value, lb = known ? known.lab : q('#dRl').value;
        const href = (lf && lf.file ? lf.file : 'index.html') + '?aufgabe=' + encodeURIComponent(row[0]) + '&duell=' + encodeURIComponent(Du.core.roundBase(pr.code)) + '&st=' + st + (lb ? '&lab=' + lb : '');
        out.innerHTML = `${esc(t ? t.title : row[0])} <span class="mute">(${esc(lname(row[1]))}, Stufe ${st}${known ? ', aus geladenem Duell' : ''})</span> <a class="fbtn nach" href="${esc(href)}" target="_blank" rel="noopener">Runde nachstellen</a>`;
      };
      rc.oninput = upd; q('#dRs').onchange = upd; q('#dRl').onchange = upd;
      q('#dBimp').onclick = () => {
        const list = Du.core.parseBest(q('#dBin').value), o = q('#dBout');
        if (!list.length) { o.innerHTML = '<p class="mute">Kein gültiger Bestenlisten-Code (TFB1.…) gefunden.</p>'; return; }
        o.innerHTML = list.map(b => `<p><b>KW ${b.kw}${b.j ? ', Jahrgang ' + esc(b.j) : ''}</b> <span class="mute">(${b.sig === 'u' ? 'unsigniert' : 'Signatur ' + esc(b.sig) + ', ohne Schlüssel nicht prüfbar'}; ${esc(fmtDT(b.t))})</span></p><ol class="best">${b.rows.map((r, i) => `<li><span class="pos">${i + 1}.</span><span class="bn">${esc(r[0])}</span><b>${r[1]} Punkte</b><span class="mute">${r[2]} Duelle</span></li>`).join('')}</ol>`).join('');
      };
    }
    rerun();
    return { state: S, add, addCodes, duelRefresh, rerun, combine: () => M, aggregate: () => A };
  }
  const Ueb = { core, mount, SUPPORTED };
  if (typeof module !== 'undefined' && module.exports) module.exports = Ueb; else root.Ueb = Ueb;
})(typeof window !== 'undefined' ? window : globalThis);
