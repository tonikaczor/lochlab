'use strict';
/* Tonfunk Lab: Ausbilder-Übersicht (ab v23.145). Liest die Stand-Dateien der Azubis (Schema „tonfunk-stand“, erzeugt von stand.js), legt sie zusammen und zeigt
   Tabelle, Heatmap, Schwächen-Ranking und Detailansicht. Alles läuft im Browser: nichts wird hochgeladen, nichts gespeichert (nur Arbeitsspeicher der Seite).
   Die Logik ohne DOM steht in Ueb.core (Tests: quelle/dash/test_uebersicht.js), die Oberfläche in Ueb.mount().
   Schema siehe stand.js und quelle/dash/UEBERSICHT.md. Diese Seite enthält keine Lösungen.
   Ab Schema 2 (v23.147, Paket D3): Block duell (Duell-Verlauf mit signiertem Code), karriere, jahrgang; Abschnitt 5 „Prüfungs-Duelle und Bestenliste“ (Paar-Prüfung, Flags, Bestenliste TFB1, CSV).
   Schema-1-Dateien bleiben lesbar (kein Block = keine Duelle). Die Duell-Logik (Codes, Signatur, Flags, Bestenliste) kommt aus duell.js (Duell.core), die Übersicht rechnet nichts davon nach.
   Ab Paket W4 (Fehler-Tausch und Wettbewerb): Abschnitt 6 „Fehler-Tausch und Wettbewerb“ (Reiter Ausschreiben, Sammeln, Rangliste, Karten); Detail je Azubi ist jetzt Abschnitt 7, Export Abschnitt 8.
   Die Logik steht in Ueb.core.wett* / karten* (Tests: quelle/wett/test_ausbilder_abschnitt6.js) und rechnet nichts nach: Codes, Wertung, Flags, Rangliste, Güte kommen aus wett.js (Wett.core) und tausch.js (Tausch.core).
   Datenschutz: Nichts wird automatisch gesendet. Lokal bleiben nur lm4.wettkey (Ausbilder-Schlüssel, nur auf Wunsch), lm4.tauschsperr (Sperrliste, Karten-Nummern) und lm4.wettausb (eigene Ausschreibungen, TFW1-Codes ohne Personenbezug). Ergebnisse, Karten und Ranglisten bleiben im Arbeitsspeicher. */
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
    r.beruf = /^(egs|ige|im|tpd|fll|ik|fi)$/.test(String(o.beruf || '')) ? String(o.beruf) : '';
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
    const labs = order.map(k => ({ key: k, name: LABS[k] || (REG[k] || {}).name || k, short: (REG[k] || {}).short || LABS[k] || k, beruf: (REG[k] || {}).beruf || null })).filter(l => tasks.some(t => t.lab === l.key));
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
  core.BERUFE = { egs: 'Elektroniker', ige: 'Industrieelektriker', im: 'Industriemechaniker', tpd: 'Produktdesigner', fll: 'Lagerlogistik', ik: 'Industriekaufmann', fi: 'Fachinformatiker' };
  core.aggregate = function (state, cat, ber) {
    if (ber) state = Object.assign({}, state, { students: state.students.filter(s => (s.latest.beruf || 'egs') === ber) });
    const labKeys = cat.labs.filter(l => !ber || !l.beruf || l.beruf.indexOf(ber) >= 0).map(l => l.key);
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

  /* ---------- Abschnitt 6: Fehler-Tausch und Wettbewerb (W4). Rechnet nichts nach: alles aus wett.js (W) und tausch.js (T), Duell-Kern D. ---------- */
  Object.assign(core.FLAGTXT, { ausserhalb: 'außerhalb des Zeitraums', fremd: 'gehört zu einem anderen Wettbewerb', gesperrt: 'vom Ausbilder ausgeschlossen', doppelt: 'doppelt (spätere Abgabe widerspricht)', ohne_schluessel: 'nicht mit Ausbilder-Schlüssel signiert (mit Wettbewerbs-Code geprüft)',
    eigen: 'eigene Karte gelöst (zählt nicht)', beleg: 'Beleg falsch (Fehler nicht gekannt?)', beleg_offen: 'Beleg nicht prüfbar (Karte nicht lesbar)', abgelaufen: 'Karte abgelaufen', lab_fehlt: 'Lab-Daten fehlen', ungueltig: 'Inhalt nicht lesbar oder passt nicht zur Karte' });
  core.WKEYS = { key: 'lm4.wettkey', sperr: 'lm4.tauschsperr', aus: 'lm4.wettausb' };
  core.symText = s => { const t = String(s == null ? '' : s).replace(/[-_]+/g, ' ').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : '–'; };
  const CIDRE6 = /^[0-9A-F]{6}$/;
  /* Sperrliste (Karten-Nummern): eindeutig, groß, höchstens 50 (= WW.sperrMax) */
  core.sperrNorm = (list, max) => { const out = []; (Array.isArray(list) ? list : []).forEach(c => { const x = typeof c === 'string' ? c.toUpperCase() : ''; if (CIDRE6.test(x) && out.indexOf(x) < 0 && out.length < (max || 50)) out.push(x); }); return out; };
  /* Vorschlag für die Aufgabenliste: Duell-Pool der Stufe, SEEDLABS zuerst, möglichst verschiedene Labs, deterministisch je seed. rows = Duell.core.pool(AUFGABEN), D = Duell */
  core.wettVorschlag = function (rows, st, n, seed, D) {
    rows = Array.isArray(rows) ? rows : []; n = clamp(int(n) || 4, 3, 6); st = clamp(int(st) || 2, 1, 3); const sl = (D && D.SEEDLABS) || [];
    let c = rows.filter(r => r[4] === st); if (c.length < n) c = rows.filter(r => Math.abs(r[4] - st) <= 1);
    const rnd = D.core.seeded(D.core.hash('wett|' + String(seed == null ? '' : seed) + '|' + st)), a = c.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    const out = [], labs = {}, sa = a.filter(r => sl.indexOf(r[1]) >= 0), na = a.filter(r => sl.indexOf(r[1]) < 0);
    /* Reihenfolge der Auswahl: zufällige-Fehler-Labs je ein Lab, dann weitere davon, dann die übrigen Labs je ein Lab, zuletzt der Rest */
    [sa, na].forEach(g => { g.forEach(r => { if (out.length < n && !labs[r[1]]) { labs[r[1]] = 1; out.push(r[0]); } }); g.forEach(r => { if (out.length < n && out.indexOf(r[0]) < 0) out.push(r[0]); }); });
    return out;
  };
  /* Formular prüfen: { ok, errors:[Text], form } */
  core.wettFormCheck = function (f, W) {
    f = f || {}; const errors = [], WW = W.WW, nRaw = String(f.n == null ? '' : f.n).trim(), klRaw = String(f.kl == null ? '' : f.kl).trim(), jRaw = String(f.j == null ? '' : f.j).trim();
    if (!nRaw) errors.push('Der Name der Ausschreibung fehlt.'); else if (nRaw.length > WW.nameMax) errors.push('Der Name darf höchstens ' + WW.nameMax + ' Zeichen haben.');
    const n = W.core.text(nRaw, WW.nameMax);
    const kl = klRaw ? W.core.klasse(klRaw) : ''; if (klRaw && !kl) errors.push('Klassen-Kennung: höchstens ' + WW.klMax + ' Zeichen aus Buchstaben, Ziffern, _ und -, mindestens eine Ziffer (z. B. E25a). Keine Namen von Personen.');
    if (jRaw && !/^\d{4}$/.test(jRaw)) errors.push('Jahrgang: vier Ziffern (z. B. 2025) oder leer lassen.');
    const von = W.core.ymd(f.von), bis = W.core.ymd(f.bis), day = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
    if (!von || !bis) errors.push('Zeitraum: Von und Bis als Datum angeben.');
    else { const dd = day(bis) - day(von); if (dd < 0) errors.push('Zeitraum: „Bis“ liegt vor „Von“.'); else if (dd > WW.fensterTage) errors.push('Zeitraum: höchstens ' + WW.fensterTage + ' Tage (4 Wochen).'); }
    const st = clamp(int(f.st) || 2, 1, 3);
    const a = []; (Array.isArray(f.a) ? f.a : []).forEach(x => { if (typeof x === 'string' && a.indexOf(x) < 0) a.push(x); });
    if (a.length < WW.aMin || a.length > WW.aMax) errors.push('Aufgaben: ' + WW.aMin + ' bis ' + WW.aMax + ' wählen (gewählt: ' + a.length + ').');
    return { ok: !errors.length, errors, form: { n, kl, j: jRaw, von, bis, st, a } };
  };
  /* Ausschreibung erzeugen: { ok, errors, code, aus } (TFW1, mit der wid signiert) */
  core.wettAusschreiben = async function (f, W, opt) {
    opt = opt || {}; const c = core.wettFormCheck(f, W); if (!c.ok) return { ok: false, errors: c.errors };
    let code = null; try { code = await W.core.encodeAus(Object.assign({}, c.form, opt.wid ? { wid: opt.wid } : {}, opt.app ? { app: opt.app } : {})); } catch (e) { code = null; }
    const p = code ? W.core.parseAus(code)[0] : null;
    if (!p) return { ok: false, errors: ['Die Ausschreibung konnte nicht erzeugt werden (Eingaben prüfen).'] };
    return { ok: true, errors: [], code, aus: p.aus };
  };
  /* Ergebnisse (viele TFE1 als Text) prüfen und rangieren. opt: { key, sperr:[k], now } */
  core.wettSammeln = async function (text, aus, W, opt) {
    opt = opt || {}; const items = await W.core.pruefen(text, aus, { key: opt.key || '', now: opt.now });
    return { items, rang: W.core.rangliste(items, aus, { sperr: opt.sperr || [] }) };
  };
  core.wettCsv = (rang, aus, W) => W.core.csv(rang, aus) + '\r\n';
  /* Rangliste veröffentlichen (TFR1): nur gewertete Zeilen (Top 10) und nur Klassen mit Klassenwert (ab 3). Ohne gewertete Zeile: null */
  core.rangCode = async function (aus, rang, sperr, W, now) {
    if (!aus || !rang || !(rang.rows || []).some(r => r.gewertet)) return null;
    const r2 = Object.assign({}, rang, { klassen: (rang.klassen || []).filter(k => k[1] != null) });
    return await W.core.encodeRang({ aus, rang: r2, t: now == null ? Date.now() : now, sperr: core.sperrNorm(sperr) });
  };
  /* Karten und Rückmeldungen auswerten. Ohne registrierten Lab-Adapter bleibt die Karte lesbar (Flag lab_fehlt), die Güte wird trotzdem aus dem verdeckten Teil gerechnet.
     cardCodes: TFF1-Codes, ergCodes: TFE1-Codes (q:'f'). Liefert { rows, ersteller:[[k, wert, anzahl]], ohneKarte, ergGesamt } */
  core.kartenAuswerten = async function (cardCodes, ergCodes, T, opt) {
    opt = opt || {}; const now = opt.now == null ? Date.now() : opt.now, sperr = opt.sperr || [], ergBy = {}, rows = [], seen = {};
    const ergs = T.core.parseErgs((ergCodes || []).filter((c, i, l) => l.indexOf(c) === i).join('\n'));
    ergs.forEach(e => { const cid = e.rec ? e.rec.cid : e.cidRaw; (ergBy[cid] = ergBy[cid] || []).push(e); });
    for (const code of (cardCodes || [])) {
      let e = null, pk = null; try { e = T.core.parseCards(code)[0] || null; pk = T.core.peek(code); } catch (x) { pk = null; }
      if (!pk || seen[pk.cid]) continue; seen[pk.cid] = 1;
      const labFehlt = !e || !e.card; let v = null; try { v = e ? await T.core.verifyCard(e, { now }) : null; } catch (x) { v = null; }
      const fl = (v ? v.flags : ['ungueltig']).filter(f => !(f === 'ungueltig' && labFehlt && v)); if (labFehlt) fl.push('lab_fehlt');
      const card = (e && e.card) || { cid: pk.cid, k: pk.k, st: pk.st, t: pk.t, bis: pk.bis, lab: pk.lab, rig: pk.rig, sym: pk.sym };
      let hidden = (e && e.hidden) || null; if (!hidden && e) { try { hidden = T.core.normHid(T.core.unveil(e.ht, pk.cid)); } catch (x) { hidden = null; } }
      if (!hidden && fl.indexOf('ungueltig') < 0) fl.push('ungueltig');
      const mine = ergBy[card.cid] || []; let list = [];
      try { list = mine.length ? await T.core.verifyErgs(mine.map(x => x.code).join('\n'), { card, hidden, now }) : []; } catch (x) { list = []; }
      const g = T.core.guete(list, card), rf = {}; list.forEach(x => (x.flags || []).forEach(f => { rf[f] = (rf[f] || 0) + 1; }));
      rows.push({ cid: card.cid, code: String(code), k: card.k, lab: card.lab, rig: card.rig, st: card.st, sym: card.sym, t: card.t, bis: card.bis, flags: fl.filter((x, i) => fl.indexOf(x) === i),
        adapter: !labFehlt, nGes: list.length, n: g.n, q: g.q == null ? null : g.q, gk: g.gk == null ? null : g.gk, fehlt: g.fehlt || 0, pruefen: !!g.pruefen, rf });
    }
    const known = {}; rows.forEach(r => { known[r.cid] = 1; });
    let ohne = 0; Object.keys(ergBy).forEach(c => { if (!known[c]) ohne += ergBy[c].length; });
    const by = {}; rows.forEach(r => { (by[r.k] = by[r.k] || []).push({ cid: r.cid, t: r.t, gk: sperr.indexOf(r.cid) >= 0 ? null : r.gk }); });
    const ersteller = Object.keys(by).map(k => [k, T.core.erstellerWert(by[k]), by[k].length]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    return { rows: core.kartenSort(rows, sperr), ersteller, ohneKarte: ohne, ergGesamt: ergs.length };
  };
  /* „bitte prüfen“ (q = 0 bei n >= 3) zuerst, gesperrte zuletzt, sonst neueste zuerst */
  core.kartenSort = (rows, sperr) => { const sp = sperr || []; return rows.slice().sort((a, b) => (b.pruefen ? 1 : 0) - (a.pruefen ? 1 : 0) || (sp.indexOf(a.cid) >= 0 ? 1 : 0) - (sp.indexOf(b.cid) >= 0 ? 1 : 0) || b.t - a.t || (a.cid < b.cid ? -1 : 1)); };
  core.kartenCsv = function (rows, sperr, cat) {
    const sp = sperr || [], lname = k => (cat && cat.labs ? (cat.labs.find(l => l.key === k) || { name: k }).name : k);
    const lines = [['Karte', 'Lab', 'Prüfstand', 'Symptom', 'Stufe', 'Ersteller (Anzeigename)', 'Erstellt', 'Gültig bis', 'Rückmeldungen gesamt', 'Gültige Löser', 'Lösequote %', 'Güte', 'Bitte prüfen', 'Gesperrt', 'Hinweise'].map(core.csvCell).join(';')];
    rows.forEach(r => lines.push([r.cid, lname(r.lab), r.rig, core.symText(r.sym), r.st, r.k, fmtD(r.t), fmtD(r.bis), r.nGes, r.n, r.q == null ? '' : Math.round(100 * r.q), r.gk == null ? '' : r.gk, r.pruefen ? 'ja' : '', sp.indexOf(r.cid) >= 0 ? 'ja' : '',
      r.flags.map(f => core.FLAGTXT[f] || f).concat(Object.keys(r.rf).map(f => (core.FLAGTXT[f] || f) + ' ×' + r.rf[f])).join(' | ')].map(core.csvCell).join(';')));
    return lines.join('\r\n') + '\r\n';
  };

  /* ====================================================== Oberfläche ====================================================== */
  let UI = null;
  function mount(host, G, doc) {
    const D = doc || document, cat = core.catalog(G || {});
    const BD = (root.Badges && root.Badges.DEFS) || [], bname = id => { const d = BD.find(x => x[0] === id); return d ? { icon: d[1], name: d[2], desc: d[3] } : { icon: '🏅', name: id, desc: '' }; };
    const S = { inputs: [], sort: 'name', dir: 1, heat: 'lab', heatLab: '', detail: null, msg: '', dKw: '', dJg: 'alle', codes: [], dv: null, dmsg: '', pub: null, imp: null, beruf: '' };
    let M = null, A = null;
    const wettEl = D.createElement('div'); wettEl.id = 'wettHost';   /* Abschnitt 6 bleibt beim Neuzeichnen der übrigen Abschnitte erhalten (Eingaben gehen nicht verloren) */
    const $ = s => host.querySelector(s);
    host.innerHTML = `<section class="card noprint" aria-labelledby="hLoad"><h2 id="hLoad">1. Stand-Dateien laden</h2>
      <p class="mute">Wähle die Dateien <code>tonfunk-stand-….json</code> der Azubis aus (mehrere auf einmal) oder ziehe sie hierher. Mehrere Stände desselben Kürzels: der neueste zählt, ältere bilden den Verlauf. Es wird nichts hochgeladen und nichts gespeichert.</p>
      <div id="drop" class="drop"><label class="fbtn" for="files">Dateien auswählen</label><input type="file" id="files" multiple accept=".json,application/json"><span class="mute">oder Dateien hier ablegen</span></div>
      <div class="row"><button type="button" id="reset" class="danger">Alles zurücksetzen</button><span id="stat" class="mute" role="status" aria-live="polite"></span></div>
      <ul id="errs" class="errs" aria-label="Meldungen zu Dateien"></ul></section>
      <div id="out"></div>`;
    const out = $('#out');
    function rerun() { M = core.combine(S.inputs); A = core.aggregate(M, cat, S.beruf); if (S.detail && !M.students.some(s => s.key === S.detail)) S.detail = null; if (!S.heatLab || !cat.labs.some(l => l.key === S.heatLab)) { const withData = A.labs.find(l => A.rows.some(r => r.lp[l.key] && r.lp[l.key].started)); S.heatLab = withData ? withData.key : (cat.labs[0] || {}).key || ''; } S.dv = null; render(); duelRefresh(); }
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
    $('#reset').onclick = () => { S.inputs = []; S.codes = []; S.pub = null; S.imp = null; S.dmsg = ''; S.detail = null; S.msg = ''; wettReset(); rerun(); $('#files').focus(); };

    const th = (k, t, tip) => `<th scope="col" aria-sort="${S.sort === k ? (S.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="srt" data-sort="${k}" title="${esc(tip || 'Sortieren')}">${t}<span aria-hidden="true">${S.sort === k ? (S.dir > 0 ? ' ▲' : ' ▼') : ''}</span></button></th>`;
    const cmp = { name: (a, b) => a.name.localeCompare(b.name, 'de'), pct: (a, b) => a.pct - b.pct, solved: (a, b) => a.d - b.d, badges: (a, b) => a.badges - b.badges, exam: (a, b) => (a.examBest == null ? -1 : a.examBest) - (b.examBest == null ? -1 : b.examBest), ts: (a, b) => a.ts - b.ts, act: (a, b) => a.act - b.act, weak: (a, b) => a.weak - b.weak };
    const cell = (p, started, title, txt) => started ? `<td class="pc" style="background:${core.color(p)}" title="${esc(title)}">${txt == null ? p : txt}</td>` : `<td class="pc none" title="${esc(title)}"><span class="sr">nicht gestartet</span></td>`;
    function stand(r) { const old = Date.now() - r.ts > 14 * DAY; return `<span title="${esc(fmtDT(r.ts))}">${esc(fmtD(r.ts))}</span>${old ? ' <span class="old" title="Der Stand ist älter als 14 Tage">älter</span>' : ''}`; }

    function render() {
      $('#errs').innerHTML = M.errors.map(e => `<li><b>${esc(e.name)}</b>: ${esc(e.error)}</li>`).join('');
      $('#stat').textContent = M.files ? (M.ok + ' Azubis aus ' + M.files + ' Dateien' + (M.errors.length ? ', ' + M.errors.length + ' Datei(en) nicht lesbar' : '') + (M.dups ? ', ' + M.dups + ' doppelte übersprungen' : '') + (M.older ? ', ' + M.older + ' ältere Stände im Verlauf' : '') + '.' + (S.msg ? ' ' + S.msg : '')) : 'Noch keine Dateien geladen.';
      if (!A.rows.length && S.beruf) { out.innerHTML = '<p class="row nb"><label for="berSel">Beruf: </label><select id="berSel"><option value="">alle Berufe</option>' + Object.keys(core.BERUFE).map(k => '<option value="' + k + '"' + (S.beruf === k ? ' selected' : '') + '>' + core.BERUFE[k] + '</option>').join('') + '</select></p><p class="mute">Für diesen Beruf liegt keine Datei vor.</p><div id="duellHost"></div><div id="wettSlot"></div>'; const bs0 = out.querySelector('#berSel'); bs0.onchange = () => { S.beruf = bs0.value; rerun(); }; renderDuell(); slot(); return; }
      if (!A.rows.length) { out.innerHTML = '<p class="mute">Noch keine Daten. Lade oben die Dateien der Azubis (Duell-Codes kannst du unten auch ohne Dateien einlesen).</p><div id="duellHost"></div><div id="wettSlot"></div>'; renderDuell(); slot(); return; }
      const rows = A.rows.slice().sort((a, b) => (cmp[S.sort](a, b) || a.name.localeCompare(b.name, 'de')) * S.dir);
      let h = `<section class="card" aria-labelledby="hTab"><h2 id="hTab">2. Übersicht je Azubi</h2>
        <p class="row nb"><label for="berSel">Beruf: </label><select id="berSel"><option value="">alle Berufe</option>${Object.keys(core.BERUFE).map(k => `<option value="${k}"${S.beruf === k ? ' selected' : ''}>${core.BERUFE[k]}</option>`).join('')}</select> <span class="mute">zeigt nur die Azubis und Lab-Spalten dieses Berufs (Dateien ohne Berufsangabe zählen als Elektroniker)</span></p>
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
      h += '<div id="duellHost"></div><div id="wettSlot"></div>';
      /* Detail */
      h += `<section class="card" aria-labelledby="hDet"><h2 id="hDet" tabindex="-1">7. Detail je Azubi</h2><label class="rb">Azubi <select id="detSel" aria-label="Azubi für die Detailansicht">${'<option value="">(bitte wählen)</option>' + rows.map(r => `<option value="${esc(r.key)}"${r.key === S.detail ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label><div id="det">${S.detail ? detail(S.detail) : '<p class="mute">Wähle einen Azubi oder klicke in der Tabelle auf ein Kürzel.</p>'}</div></section>`;
      /* Export */
      h += `<section class="card noprint" aria-labelledby="hExp"><h2 id="hExp">8. Export</h2><p class="mute">CSV öffnet sich in Excel (Semikolon, UTF-8). Die Druckansicht zeigt Tabelle, Heatmap, Ranking und Detail; ein Hinweis zum Datenschutz steht oben. Die Dateien enthalten nur Pseudonyme, bitte nur im Ausbilder-Ordner ablegen.</p><div class="row"><button type="button" class="pri" id="bCsv">Übersicht als CSV</button><button type="button" id="bCsvW">Schwächen als CSV</button><button type="button" id="bPrint">Druckansicht (Drucken oder PDF)</button></div></section>`;
      out.innerHTML = h; renderDuell(); slot();
      const bs = out.querySelector('#berSel'); if (bs) bs.onchange = () => { S.beruf = bs.value; S.heatLab = ''; rerun(); const n = out.querySelector('#berSel'); if (n) n.focus(); };
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
    function qrInto(host, text, label) {
      const draw = () => { try { const q = root.qrcode(0, 'M'); q.addData(String(text), 'Byte'); q.make(); host.innerHTML = q.createSvgTag({ cellSize: 3, margin: 2, scalable: true }); host.setAttribute('role', 'img'); host.setAttribute('aria-label', label || 'QR-Code der Bestenliste'); } catch (e) { host.textContent = 'QR nicht möglich. Bitte den Text weitergeben.'; } };
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
    /* ---------- Abschnitt 6: Fehler-Tausch und Wettbewerb (Reiter Ausschreiben, Sammeln, Rangliste, Karten) ---------- */
    const WA = () => root.Wett || null, TA = () => root.Tausch || null, CB = () => root.Codebus || null;
    const kv = { get: k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { if (v == null || v === '') root.localStorage.removeItem(k); else root.localStorage.setItem(k, v); return true; } catch (e) { return false; } } };
    const WK = core.WKEYS, TABS = [['aus', 'Ausschreiben'], ['sam', 'Sammeln'], ['rang', 'Rangliste'], ['kar', 'Karten']];
    const WS = S.w = { tab: 'aus', f: null, alle: false, sv: 0, errors: [], ausOut: null, list: [], sel: '', key: '', keep: false, ergs: [], msgE: '', pr: null, sperrK: [], cardsIn: [], rueckIn: [], kr: null, msgK: '', sperr: [], pubOk: false, pub: null, msgP: '', draft: {} };
    const poolRows = () => { const Du = DU(); try { return Du ? Du.core.pool(G && G.AUFGABEN) : []; } catch (e) { return []; } };
    const taskTitle = id => (cat.byId[id] || { title: id }).title, labName = k => (cat.labs.find(l => l.key === k) || { name: k }).name;
    const suggest = () => { const Du = DU(); return Du ? core.wettVorschlag(poolRows(), WS.f.st, 4, WS.sv, Du) : []; };
    function persistAus() { kv.set(WK.aus, JSON.stringify(WS.list.map(x => x.code))); }
    function addAusCode(code, persist) {
      const W = WA(); if (!W) return null; const p = W.core.parseAus(code)[0]; if (!p) return null;
      WS.list = WS.list.filter(x => x.aus.wid !== p.aus.wid); WS.list.unshift({ code: p.code, aus: p.aus }); WS.list = WS.list.slice(0, 10);
      if (persist) persistAus(); return p.aus;
    }
    function wettInit() {
      const W = WA(), sp = W ? W.core.vorschlag() : { von: '', bis: '' };
      WS.f = { n: '', kl: '', j: '', von: sp.von, bis: sp.bis, st: 2, a: [] }; WS.f.a = suggest();
      WS.key = kv.get(WK.key) || ''; WS.keep = !!WS.key;
      try { WS.sperr = core.sperrNorm(JSON.parse(kv.get(WK.sperr) || '[]')); } catch (e) { WS.sperr = []; }
      let cs = []; try { cs = JSON.parse(kv.get(WK.aus) || '[]'); } catch (e) { cs = []; }
      (Array.isArray(cs) ? cs : []).slice().reverse().forEach(c => addAusCode(String(c), false)); WS.sel = WS.list.length ? WS.list[0].aus.wid : '';
    }
    function wettReset() { WS.ergs = []; WS.msgE = ''; WS.pr = null; WS.sperrK = []; WS.cardsIn = []; WS.rueckIn = []; WS.kr = null; WS.msgK = ''; WS.pub = null; WS.msgP = ''; WS.pubOk = false; WS.ausOut = null; WS.errors = []; WS.draft = {}; renderWett(); }
    const curAus = () => { const x = WS.list.find(y => y.aus.wid === WS.sel); return x ? x.aus : null; };
    const flagList = (fl, extra) => { const a = (fl || []).map(f => core.FLAGTXT[f] || f).concat(extra || []); return a.length ? '<ul class="fl">' + a.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : ''; };
    const fmtZ = ms => core.fmtMs(ms);
    function lines(text, accept) { const cb = CB(); if (cb) return cb.core.parseCodes(text, accept); const re = new RegExp(accept.source.replace(/^\^/, '') + '[A-Za-z0-9_.-]*', 'g'); return String(text || '').match(re) || []; }
    let eSeq = 0, kSeq = 0;
    async function eRefresh() {
      const W = WA(), aus = curAus(); if (!W || !aus || !WS.ergs.length) { WS.pr = aus && W ? { items: [] } : null; renderWett(); return; }
      const seq = ++eSeq; let r = null;
      try { r = await core.wettSammeln(WS.ergs.join('\n'), aus, W, { key: WS.key, now: Date.now() }); } catch (e) { r = null; }
      if (seq !== eSeq) return; WS.pr = r; renderWett();
    }
    async function kRefresh() {
      const T = TA(); if (!T) { WS.kr = null; renderWett(); return; }
      const seq = ++kSeq; let r = null;
      try { r = await core.kartenAuswerten(WS.cardsIn, WS.rueckIn, T, { now: Date.now(), sperr: WS.sperr }); } catch (e) { r = null; }
      if (seq !== kSeq) return; WS.kr = r; renderWett();
    }
    /* Ergebnisse (TFE1, q:'w') übernehmen; liefert Zähler */
    function addErgText(text) {
      const W = WA(), T = TA(), res = { neu: 0, dup: 0, tausch: 0, kein: 0 }; if (!W) return res;
      lines(text, /^TFE1\./).forEach(code => {
        const p = W.core.parseErg(code)[0];
        if (!p) { if (T && T.core.parseErgs(code).length) res.tausch++; else res.kein++; return; }
        if (WS.ergs.indexOf(p.code) >= 0) { res.dup++; return; }
        if (WS.ergs.length >= W.WW.parseMax) { res.kein++; return; }
        WS.ergs.push(p.code); res.neu++;
      });
      if (res.neu) { WS.pr = null; }
      WS.msgE = res.neu + ' neue(s) Ergebnis(se) gelesen' + (res.dup ? ', ' + res.dup + ' doppelt übersprungen' : '') + (res.tausch ? ', ' + res.tausch + ' Tausch-Rückmeldung(en) gehören in den Reiter Karten' : '') + (res.kein ? ', ' + res.kein + ' nicht lesbar oder passend' : '') + '.';
      return res;
    }
    /* Karten (TFF1) und Rückmeldungen (TFE1, q:'f') übernehmen */
    function addKartenText(text) {
      const T = TA(), res = { karten: 0, rueck: 0, dup: 0, kein: 0 }; if (!T) return res;
      lines(text, /^TF[FE]1\./).forEach(code => {
        if (/^TFF1\./.test(code)) {
          const pk = T.core.peek(code); if (!pk) { res.kein++; return; }
          if (WS.cardsIn.some(c => { const q = T.core.peek(c); return q && q.cid === pk.cid; })) { res.dup++; return; }
          if (WS.cardsIn.length >= 200) { res.kein++; return; } WS.cardsIn.push(code); res.karten++;
        } else {
          if (!T.core.parseErgs(code).length) { res.kein++; return; }
          if (WS.rueckIn.indexOf(code) >= 0) { res.dup++; return; }
          if (WS.rueckIn.length >= 2000) { res.kein++; return; } WS.rueckIn.push(code); res.rueck++;
        }
      });
      WS.msgK = res.karten + ' Karte(n) und ' + res.rueck + ' Rückmeldung(en) gelesen' + (res.dup ? ', ' + res.dup + ' doppelt übersprungen' : '') + (res.kein ? ', ' + res.kein + ' nicht lesbar' : '') + '.';
      return res;
    }
    const noCb = () => { WS.msgP = 'Der Transportweg (codebus.js) ist nicht geladen. Bitte den Text unten kopieren bzw. einfügen.'; renderWett(); };
    function recvE() {
      const cb = CB(); if (!cb) { WS.msgE = 'Der Transportweg (codebus.js) ist nicht geladen. Bitte die Codes unter „Codes direkt einfügen“ eintragen.'; renderWett(); return; }
      cb.receive({ title: 'Wettbewerbs-Ergebnisse einlesen', accept: /^TFE1\./, onCode: c => { const x = addErgText(c); return x.neu ? true : x.dup ? 'schon eingelesen' : x.tausch ? 'Tausch-Rückmeldung (gehört in den Reiter Karten)' : 'kein Wettbewerbs-Ergebnis'; }, onDone: () => { eRefresh(); } });
    }
    function recvK() {
      const cb = CB(); if (!cb) { WS.msgK = 'Der Transportweg (codebus.js) ist nicht geladen. Bitte die Codes unter „Codes direkt einfügen“ eintragen.'; renderWett(); return; }
      cb.receive({ title: 'Fehlerkarten und Rückmeldungen einlesen', accept: /^TF[FE]1\./, onCode: c => { const x = addKartenText(c); return (x.karten || x.rueck) ? true : x.dup ? 'schon eingelesen' : 'keine Fehlerkarte oder Tausch-Rückmeldung'; }, onDone: () => { kRefresh(); } });
    }
    function sendCode(code, title) { const cb = CB(); if (!cb) { noCb(); return; } cb.send(code, { title }); }

    /* ----- Reiter ----- */
    function pAus() {
      const W = WA(); if (!W) return '<p class="mute">Das Wettbewerbs-Modul (wett.js) ist nicht geladen.</p>';
      const f = WS.f, rows = poolRows(), sl = (DU() && DU().SEEDLABS) || [];
      const shown = rows.filter(r => WS.alle || r[4] === f.st || f.a.indexOf(r[0]) >= 0).sort((x, y) => (sl.indexOf(x[1]) >= 0 ? 0 : 1) - (sl.indexOf(y[1]) >= 0 ? 0 : 1) || labName(x[1]).localeCompare(labName(y[1]), 'de') || String(x[3]).localeCompare(String(y[3]), 'de'));
      let h = `<p class="mute">Lege einen Wettbewerb fest: Alle Azubis bekommen dieselben 3 bis 6 Aufgaben (mit demselben Fehler, aus dem Duell-Pool) und geben freiwillig einen Ergebnis-Code ab. Name und Klassen-Kennung bitte <b>ohne Personenbezug</b> wählen (z. B. „Freitags-Fehlersuche“, „E25a“).</p>
        <div class="wf noprint"><label for="wN">Name (höchstens 40 Zeichen)<input type="text" id="wN" maxlength="40" value="${esc(f.n)}" placeholder="Freitags-Fehlersuche" autocomplete="off"></label>
          <label for="wKl">Klassen-Kennung (höchstens 12)<input type="text" id="wKl" maxlength="12" value="${esc(f.kl)}" placeholder="E25a" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
          <label for="wJ">Jahrgang<input type="text" id="wJ" maxlength="4" value="${esc(f.j)}" placeholder="2025" inputmode="numeric" autocomplete="off"></label>
          <label for="wVon">Von<input type="date" id="wVon" value="${esc(f.von)}"></label>
          <label for="wBis">Bis<input type="date" id="wBis" value="${esc(f.bis)}"></label>
          <label for="wSt">Stufe<select id="wSt"><option value="1"${f.st === 1 ? ' selected' : ''}>Stufe 1 (leicht)</option><option value="2"${f.st === 2 ? ' selected' : ''}>Stufe 2</option><option value="3"${f.st === 3 ? ' selected' : ''}>Stufe 3 (schwer)</option></select></label></div>
        <div class="row noprint"><button type="button" id="wVor">Diese Woche (Mo–Fr)</button><button type="button" id="wSug">Neuer Aufgaben-Vorschlag</button><label class="rb"><input type="checkbox" id="wAll"${WS.alle ? ' checked' : ''}> auch andere Stufen anzeigen</label></div>
        <fieldset class="nb noprint"><legend><b>Aufgaben</b> (3 bis 6, Reihenfolge = Reihenfolge der Auswahl; Vorschlag bevorzugt Labs mit zufälligem Fehler)</legend>
        <div class="fw"><div class="tw tk" tabindex="0" role="region" aria-label="Aufgabenliste, scrollbar">${shown.map(r => `<label class="rb tkl" for="wA_${esc(r[0])}"><input type="checkbox" class="wA" id="wA_${esc(r[0])}" value="${esc(r[0])}"${f.a.indexOf(r[0]) >= 0 ? ' checked' : ''}${f.a.indexOf(r[0]) < 0 && f.a.length >= W.WW.aMax ? ' disabled' : ''}><span>${esc(r[3])} <span class="mute">(${esc(labName(r[1]))}${sl.indexOf(r[1]) >= 0 ? ', zufälliger Fehler' : ''}, Stufe ${r[4]})</span></span></label>`).join('') || '<p class="mute">Kein Aufgabenpool geladen (duell.js).</p>'}</div></div></fieldset>
        <p class="mute" id="wCnt" role="status" aria-live="polite">Gewählt: ${f.a.length} (3 bis 6)${f.a.length ? ': ' + f.a.map((id, i) => (i + 1) + '. ' + esc(taskTitle(id))).join(' · ') : ''}</p>
        <details class="noprint" id="wKeyD"><summary>Ausbilder-Schlüssel (optional)</summary><p class="mute">Der Schlüssel bleibt in diesem Gerät und kommt in keinen Code. Er wird nur beim Prüfen gebraucht: Ergebnisse, die ein Gerät mit diesem Schlüssel signiert hat, gelten als „mit Schlüssel“. Alle anderen prüft die Übersicht mit dem Wettbewerbs-Code und markiert sie mit einem Hinweis.</p>
          <div class="wf"><label for="wKey">Schlüssel<input type="text" id="wKey" maxlength="60" value="${esc(WS.key)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label></div>
          <label class="rb"><input type="checkbox" id="wKeep"${WS.keep ? ' checked' : ''}> In diesem Gerät merken</label></details>
        <div class="row noprint"><button type="button" class="pri" id="wGo">Ausschreibung erzeugen</button></div>
        <ul class="errs" id="wErr" role="alert">${WS.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`;
      if (WS.ausOut) {
        const a = WS.ausOut.aus;
        h += `<div class="pub noprint"><div class="qrbox" id="wQr"></div><div><b>Ausschreibung „${esc(a.n)}“</b><br><span class="mute">${a.kl ? 'Klasse ' + esc(a.kl) + ' · ' : ''}KW ${W.core.kwOf(a.von)} · ${esc(a.von)} bis ${esc(a.bis)} · Stufe ${a.st} · ${a.a.length} Aufgaben</span><br>
          <label for="wCode">Ausschreibungs-Code (TFW1)</label><textarea id="wCode" rows="4" readonly>${esc(WS.ausOut.code)}</textarea>
          <div class="row"><button type="button" id="wCp">Kopieren</button><button type="button" class="pri" id="wSend">Weitergeben (QR, Text, Datei)</button><button type="button" id="wToS">Ergebnisse sammeln</button></div>
          <p class="mute">${esc(WS.msgP)}</p></div></div>`;
      }
      return h;
    }
    function pSam() {
      const W = WA(); if (!W) return '<p class="mute">Das Wettbewerbs-Modul (wett.js) ist nicht geladen.</p>';
      const aus = curAus();
      let h = `<p class="mute">Sammle die Ergebnis-Codes (TFE1) der Azubis: scannen, einfügen oder als Textdatei laden. Jede Abgabe ist freiwillig. Die Übersicht prüft Signatur, Zeitraum und Plausibilität und rechnet die Punkte immer neu. Nichts davon wird gespeichert.</p>
        <div class="wf noprint"><label for="wSel">Ausschreibung<select id="wSel">${WS.list.length ? WS.list.map(x => `<option value="${esc(x.aus.wid)}"${x.aus.wid === WS.sel ? ' selected' : ''}>${esc(x.aus.n)}${x.aus.kl ? ' (' + esc(x.aus.kl) + ')' : ''} · KW ${W.core.kwOf(x.aus.von)} · ${esc(x.aus.wid)}</option>`).join('') : '<option value="">(noch keine)</option>'}</select></label></div>
        <details class="noprint" id="wTfwD"${WS.list.length ? '' : ' open'}><summary>Ausschreibung (TFW1) einfügen</summary><label class="sr" for="wTfw">Ausschreibungs-Code</label><textarea id="wTfw" rows="2" placeholder="TFW1.…">${esc(WS.draft.wTfw || '')}</textarea><div class="row"><button type="button" id="wTfwAdd">Übernehmen</button></div></details>`;
      if (!aus) return h + '<p class="mute">Erzeuge zuerst im Reiter „Ausschreiben“ eine Ausschreibung oder füge hier einen TFW1-Code ein.</p>';
      h += `<p><b>${esc(aus.n)}</b> <span class="mute">${aus.kl ? 'Klasse ' + esc(aus.kl) + ' · ' : ''}${esc(aus.von)} bis ${esc(aus.bis)} · Stufe ${aus.st}<br>Aufgaben: ${aus.a.map((id, i) => (i + 1) + '. ' + esc(taskTitle(id))).join(' · ')}</span></p>
        <div class="row noprint"><button type="button" class="pri" id="wRecvE">Ergebnisse einlesen (QR, Text, Datei)</button><button type="button" id="wClrE"${WS.ergs.length ? '' : ' disabled'}>Liste leeren</button></div>
        <details class="noprint" id="wPasteE"><summary>Codes direkt einfügen (TFE1.…)</summary><label class="sr" for="wTxE">Ergebnis-Codes</label><textarea id="wTxE" rows="3" placeholder="TFE1.…  (mehrere Codes untereinander möglich)">${esc(WS.draft.wTxE || '')}</textarea><div class="row"><button type="button" id="wAddE">Codes übernehmen</button></div></details>
        <p class="mute" id="wMsgE" role="status" aria-live="polite">${esc(WS.msgE)}${WS.ergs.length && !WS.pr ? ' Prüfe …' : ''}</p>`;
      if (!WS.ergs.length) return h + '<p class="mute">Noch keine Ergebnisse gelesen.</p>';
      const items = WS.pr ? WS.pr.items : null; if (!items) return h;
      const rang = W.core.rangliste(items, aus, { sperr: WS.sperrK }), items2 = items.slice().sort((a, b) => a.erg.k.localeCompare(b.erg.k, 'de') || a.erg.t - b.erg.t);
      h += `<p class="mute">${WS.ergs.length} Code(s) gelesen · ${items.length} lesbar · ${rang.teilnehmende} Teilnehmende gewertet${rang.ersetzt.length ? ' · ' + rang.ersetzt.length + ' ältere Abgabe(n) ersetzt (die spätere zählt)' : ''}.</p>
        <div class="fw"><div class="tw" tabindex="0" role="region" aria-label="Tabelle gelesene Ergebnisse, waagerecht scrollbar"><table class="duel wt"><caption class="sr">Gelesene Wettbewerbs-Ergebnisse</caption><thead><tr><th scope="col">Anzeigename</th><th scope="col">Klasse</th><th scope="col">Abgabe</th><th scope="col">Aufgaben</th><th scope="col">Signatur</th><th scope="col">Status und Hinweise</th></tr></thead><tbody>${items2.map(it => {
          const er = rang.ersetzt.indexOf(it) >= 0, sg = it.sig === 'ok' ? '<b class="okc">✓ ok</b>' : it.sig === 'unsigniert' ? '<b class="wc">unsigniert</b>' : '<b class="wc">✗ falsch</b>';
          return `<tr><th scope="row" class="nm">${esc(it.erg.k)}</th><td>${esc(it.erg.kl || '–')}</td><td>${esc(fmtDT(it.erg.t))}</td><td>${it.w.n} von ${aus.a.length}</td><td>${sg}</td><td class="l">${er ? '<span class="mute">ersetzt durch spätere Abgabe</span>' : ''}${flagList(it.flags)}</td></tr>`;
        }).join('')}</tbody></table></div></div>`;
      return h;
    }
    function pRang() {
      const W = WA(); if (!W) return '<p class="mute">Das Wettbewerbs-Modul (wett.js) ist nicht geladen.</p>';
      const aus = curAus(); if (!aus) return '<p class="mute">Erst eine Ausschreibung wählen oder erzeugen (Reiter „Ausschreiben“ und „Sammeln“).</p>';
      if (!WS.pr || !WS.pr.items.length) return `<p class="mute">Noch keine Ergebnisse für „${esc(aus.n)}“. Sammle sie im Reiter „Sammeln“.</p>`;
      const rang = W.core.rangliste(WS.pr.items, aus, { sperr: WS.sperrK }), N = aus.a.length, has = rang.rows.some(r => r.gewertet);
      let h = `<h3>${esc(aus.n)} <span class="mute">${aus.kl ? '· Klasse ' + esc(aus.kl) + ' ' : ''}· ${rang.teilnehmende} Teilnehmende gewertet</span></h3>
        <p class="mute">G = Mittel der Aufgabenpunkte (nicht gespielte Aufgabe zählt 0), nur der erste vollständige Versuch jeder Aufgabe; bekannte Aufgabe zählt halb. Gleichstand: kleinere Gesamtzeit, dann weniger Tipps. Der Wettbewerb ist ein Spiel, keine Bewertung von Leistungen.</p>
        <div class="fw"><div class="tw" tabindex="0" role="region" aria-label="Tabelle Rangliste, waagerecht scrollbar"><table class="duel wt"><caption class="sr">Rangliste des Wettbewerbs</caption><thead><tr><th scope="col">Platz</th><th scope="col">Anzeigename</th><th scope="col">Klasse</th><th scope="col">G</th><th scope="col">Aufg.</th><th scope="col">Zeit</th><th scope="col">Tipps</th><th scope="col">Vers.</th><th scope="col">Mess.</th>${aus.a.map((id, i) => `<th scope="col" title="${esc(taskTitle(id))}">A${i + 1}</th>`).join('')}<th scope="col">Hinweise</th><th scope="col" class="noprint">Ausschluss</th></tr></thead><tbody>${rang.rows.map((r, i) => {
          const ex = WS.sperrK.indexOf(r.k) >= 0;
          return `<tr${r.gewertet ? '' : ' class="chk"'}><td>${r.platz == null ? '–' : r.platz}</td><th scope="row" class="nm">${esc(r.k)}</th><td>${esc(r.kl || '–')}</td><td><b>${r.G}</b></td><td>${r.n}/${N}</td><td>${fmtZ(r.ms)}</td><td>${r.h}</td><td>${r.f}</td><td>${r.m}</td>${aus.a.map((id, j) => `<td>${r.L && r.L[j] != null ? r.L[j] : '–'}</td>`).join('')}<td class="l">${r.gewertet ? '' : '<b class="wc">zählt nicht</b>'}${flagList(r.flags)}</td><td class="noprint"><button type="button" class="wX" id="wX${i}" data-k="${esc(r.k)}">${ex ? 'Wieder aufnehmen' : 'Ausschließen'}</button></td></tr>`;
        }).join('')}</tbody></table></div></div>`;
      h += '<h3>Klassenwerte</h3>' + (rang.klassen.length ? `<div class="fw"><div class="tw" tabindex="0" role="region" aria-label="Tabelle Klassenwerte"><table class="duel wt"><caption class="sr">Klassenwerte (Median, ab 3 Teilnehmenden)</caption><thead><tr><th scope="col">Klasse</th><th scope="col">Klassenwert (Median)</th><th scope="col">Teilnehmende</th></tr></thead><tbody>${rang.klassen.map(k => `<tr><th scope="row" class="nm">${esc(k[0])}</th><td>${k[1] == null ? '<span class="mute">erst ab ' + W.WW.medianMin + ' Teilnehmenden</span>' : '<b>' + k[1] + '</b>'}</td><td>${k[2]}</td></tr>`).join('')}</tbody></table></div></div>` : '<p class="mute">Keine Klassen-Kennung in den Ergebnissen (Klassenwert nur mit Klasse und ab ' + W.WW.medianMin + ' Teilnehmenden).</p>');
      h += `<div class="row noprint"><button type="button" id="wCsv">Rangliste als CSV</button></div>
        <div class="pubbox noprint"><h3>Rangliste veröffentlichen (Opt-in)</h3>
          <p class="mute"><b>Mitbestimmung und Datenschutz:</b> Eine Rangliste vergleicht Leistungen von Azubis und kann der Mitbestimmung unterliegen (Betriebsrat, Jugend- und Auszubildendenvertretung). Stimme den Einsatz vorher ab. Es wird nur auf deinen Knopfdruck ein Code erzeugt (TFR1: die ersten 10 mit selbstgewähltem Anzeigenamen und Klassenwerte ab ${W.WW.medianMin} Teilnehmenden, dazu die Sperrliste der Karten). Nichts wird automatisch gesendet, es stehen keine Klarnamen und keine Noten darin. Gib den Code nur weiter, wenn die Azubis einverstanden sind. Die Rangliste ist Spiel, keine Bewertungsgrundlage.</p>
          <label class="rb"><input type="checkbox" id="wPubOk"${WS.pubOk ? ' checked' : ''}> Ich habe die Hinweise gelesen, die Azubis und – wo nötig – der Betriebsrat sind einverstanden.</label>
          <div class="row"><button type="button" class="pri" id="wPub"${WS.pubOk && has ? '' : ' disabled'}>Rangliste veröffentlichen (TFR1 erzeugen)</button></div><p class="mute" role="status" aria-live="polite">${esc(WS.msgP)}</p>`;
      if (WS.pub) h += `<div class="pub"><div class="qrbox" id="wQr2"></div><div><label for="wCode2">Ranglisten-Code (TFR1)</label><textarea id="wCode2" rows="4" readonly>${esc(WS.pub)}</textarea><div class="row"><button type="button" id="wCp2">Kopieren</button><button type="button" class="pri" id="wSend2">Weitergeben (QR, Text, Datei)</button></div></div></div>`;
      return h + '</div>';
    }
    function pKar() {
      const T = TA(); if (!T) return '<p class="mute">Das Tauschbörsen-Modul (tausch.js) ist nicht geladen.</p>';
      let h = `<p class="mute">Lies Fehlerkarten (TFF1) und die Rückmeldungen der Löser (TFE1) ein: scannen, einfügen oder als Textdatei laden. Die Übersicht zeigt Güte, Hinweise und, falls das Lab bekannt ist, einen Knopf zum Nachstellen. Die Auflösung (der Fehler) steht nie in der Liste. Nichts wird gespeichert, nur die Sperrliste (Karten-Nummern) merkt sich dieses Gerät.</p>
        <div class="row noprint"><button type="button" class="pri" id="wRecvK">Karten und Rückmeldungen einlesen (QR, Text, Datei)</button><button type="button" id="wClrK"${WS.cardsIn.length || WS.rueckIn.length ? '' : ' disabled'}>Liste leeren</button></div>
        <details class="noprint" id="wPasteK"><summary>Codes direkt einfügen (TFF1.… und TFE1.…)</summary><label class="sr" for="wTxK">Karten und Rückmeldungen</label><textarea id="wTxK" rows="3" placeholder="TFF1.…  oder  TFE1.…  (mehrere Codes untereinander möglich)">${esc(WS.draft.wTxK || '')}</textarea><div class="row"><button type="button" id="wAddK">Codes übernehmen</button></div></details>
        <p class="mute" id="wMsgK" role="status" aria-live="polite">${esc(WS.msgK)}${(WS.cardsIn.length || WS.rueckIn.length) && !WS.kr ? ' Prüfe …' : ''}</p>`;
      if (!WS.cardsIn.length && !WS.rueckIn.length) return h + '<p class="mute">Noch keine Karten gelesen.</p>';
      const kr = WS.kr; if (!kr) return h;
      const ad = (T.adapters && T.adapters()) || {}, nPr = kr.rows.filter(r => r.pruefen && WS.sperr.indexOf(r.cid) < 0).length;
      h += `<p class="mute">${kr.rows.length} Karte(n) · ${kr.ergGesamt} Rückmeldung(en)${kr.ohneKarte ? ' · ' + kr.ohneKarte + ' davon ohne passende Karte' : ''}${nPr ? ' · <b class="wc">' + nPr + ' Karte(n) bitte prüfen</b>' : ''}. Güte gibt es ab 3 gültigen Lösern (verschiedene Anzeigenamen, ohne eigene und unplausible Lösungen).</p>`;
      h += `<div class="fw"><div class="tw" tabindex="0" role="region" aria-label="Tabelle Fehlerkarten, waagerecht scrollbar"><table class="duel wt"><caption class="sr">Fehlerkarten mit Güte</caption><thead><tr><th scope="col">Karte</th><th scope="col">Lab und Prüfstand</th><th scope="col">Symptom</th><th scope="col">Stufe</th><th scope="col">Ersteller</th><th scope="col">Gültig bis</th><th scope="col">Löser</th><th scope="col">Quote</th><th scope="col">Güte</th><th scope="col">Hinweise</th><th scope="col" class="noprint">Aktionen</th></tr></thead><tbody>${kr.rows.map((r, i) => {
        const sp = WS.sperr.indexOf(r.cid) >= 0, lf = ((G && G.LAB_REG) || {})[r.lab], href = r.adapter && ad[r.lab] && lf && lf.file ? lf.file + '#t=' + r.code : '';
        const rf = Object.keys(r.rf).map(f => (core.FLAGTXT[f] || f) + ' ×' + r.rf[f]), pf = r.flags.filter(f => f !== 'lab_fehlt');
        return `<tr${r.pruefen && !sp ? ' class="chk"' : ''}><th scope="row" class="nm"><code>${esc(r.cid)}</code>${r.pruefen ? '<br><b class="wc">bitte prüfen</b>' : ''}${sp ? '<br><b class="wc">gesperrt</b>' : ''}</th><td class="l">${esc(labName(r.lab))}<br><span class="mute">${esc(r.rig)}</span>${r.adapter ? '' : '<br><b class="wc">Lab-Daten fehlen</b>'}</td><td class="l">${esc(core.symText(r.sym))}</td><td>${r.st}</td><td>${esc(r.k)}</td><td>${esc(fmtD(r.bis))}</td><td>${r.n} gültig<br><span class="mute">von ${r.nGes}</span></td><td>${r.q == null ? '–' : Math.round(100 * r.q) + ' %'}</td><td>${r.gk == null ? '<span class="mute">noch ' + r.fehlt + ' nötig</span>' : '<b>' + r.gk + '</b>'}</td><td class="l">${flagList(pf, rf)}</td><td class="noprint l"><div class="row" style="margin:0"><button type="button" class="wS" id="wS${i}" data-cid="${esc(r.cid)}">${sp ? 'Freigeben' : 'Sperren'}</button>${href ? `<a class="fbtn nach" href="${esc(href)}" target="_blank" rel="noopener" title="Öffnet das Lab mit dieser Karte">Nachstellen</a>` : ''}</div></td></tr>`;
      }).join('')}</tbody></table></div></div>`;
      h += '<h3>Ersteller (Summe der besten 3 Güten)</h3>' + (kr.ersteller.some(e => e[1] > 0) ? `<ol class="best">${kr.ersteller.map((e, i) => `<li><span class="pos">${i + 1}.</span><span class="bn">${esc(e[0])}</span><b>${e[1]} Punkte</b><span class="mute">${e[2]} Karte${e[2] === 1 ? '' : 'n'}</span></li>`).join('')}</ol>` : '<p class="mute">Noch keine Güte berechenbar (mindestens 3 gültige Löser je Karte).</p>');
      h += `<div class="row noprint"><button type="button" id="wCsvK">Karten als CSV</button></div><p class="mute noprint">Die Sperrliste (${WS.sperr.length} Karte${WS.sperr.length === 1 ? '' : 'n'}) liegt nur in diesem Gerät. Sie erreicht die Azubis erst, wenn du im Reiter „Rangliste“ den Code (TFR1) bewusst veröffentlichst.</p>`;
      return h;
    }
    function qrFill(id, text, label) { const e = wettEl.querySelector(id); if (!e) return; if (text.length > 1100) e.textContent = 'Zu lang für einen QR-Code. Bitte Text oder Datei nutzen.'; else qrInto(e, text, label); }
    function fades() {
      wettEl.querySelectorAll('.fw').forEach(fw => { const tw = fw.querySelector('.tw'); if (!tw) return; const upd = () => fw.classList.toggle('more', tw.scrollWidth > tw.clientWidth + 2 && tw.scrollLeft + tw.clientWidth < tw.scrollWidth - 2); tw.addEventListener('scroll', upd, { passive: true }); upd(); });
    }
    function renderWett() {
      const ae = D.activeElement, aid = ae && ae.id && wettEl.contains(ae) ? ae.id : '', ss = aid && ae.selectionStart != null ? [ae.selectionStart, ae.selectionEnd] : null, sc = root.scrollY;
      const panel = WS.tab === 'aus' ? pAus() : WS.tab === 'sam' ? pSam() : WS.tab === 'rang' ? pRang() : pKar();
      wettEl.innerHTML = `<section class="card" aria-labelledby="hWett"><h2 id="hWett" tabindex="-1">6. Fehler-Tausch und Wettbewerb</h2>
        <p class="mute noprint">Wettbewerb ausschreiben, Ergebnisse sammeln, Rangliste bilden und die Fehlerkarten der Tauschbörse prüfen. Alles läuft in diesem Browser, es wird nichts gesendet. Angezeigt wird nur der von den Azubis selbst gewählte Anzeigename, nie ein Klarname. Die Signatur ist <b>manipulationsarm, nicht manipulationssicher</b>; wirksam ist das Nachstellen und das Gespräch mit dem Azubi.</p>
        <div class="wtabs noprint" role="tablist" aria-label="Fehler-Tausch und Wettbewerb">${TABS.map(t => `<button type="button" role="tab" id="wt-${t[0]}" data-tab="${t[0]}" aria-selected="${WS.tab === t[0]}" aria-controls="wPanel" tabindex="${WS.tab === t[0] ? 0 : -1}">${t[1]}</button>`).join('')}</div>
        <div id="wPanel" role="tabpanel" aria-labelledby="wt-${WS.tab}">${panel}</div></section>`;
      bindWett(); fades();
      if (aid) { const e = wettEl.querySelector('#' + (root.CSS && root.CSS.escape ? root.CSS.escape(aid) : aid)); if (e) { try { e.focus({ preventScroll: true }); if (ss && e.setSelectionRange) e.setSelectionRange(ss[0], ss[1]); } catch (x) {} } }
      if (root.scrollY !== sc) root.scrollTo(root.scrollX, sc);
    }
    function copyTa(ta, msg) { ta.focus(); ta.select(); try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value); else D.execCommand('copy'); } catch (e) {} WS.msgP = msg; const p = ta.closest('div').querySelector('p.mute'); if (p) p.textContent = msg; }
    function bindWett() {
      const q = s => wettEl.querySelector(s), qa = s => Array.from(wettEl.querySelectorAll(s));
      const tabs = qa('[role=tab]');
      tabs.forEach((b, i) => {
        b.onclick = () => { WS.tab = b.dataset.tab; WS.msgP = ''; if (WS.tab === 'rang' || WS.tab === 'sam') { if (!WS.pr && WS.ergs.length) eRefresh(); } if (WS.tab === 'kar' && !WS.kr && (WS.cardsIn.length || WS.rueckIn.length)) kRefresh(); renderWett(); const x = q('#wt-' + WS.tab); if (x) x.focus(); };
        b.onkeydown = e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); tabs[(i + d + tabs.length) % tabs.length].click(); };
      });
      const W = WA(), f = WS.f;
      if (WS.tab === 'aus') {
        const bi = (id, fn) => { const e = q(id); if (e) e.oninput = () => fn(e.value); };
        bi('#wN', v => { f.n = v; }); bi('#wKl', v => { f.kl = v; }); bi('#wJ', v => { f.j = v; }); bi('#wVon', v => { f.von = v; }); bi('#wBis', v => { f.bis = v; });
        const st = q('#wSt'); if (st) st.onchange = () => { f.st = +st.value; f.a = suggest(); WS.sv = 0; renderWett(); };
        const vor = q('#wVor'); if (vor) vor.onclick = () => { const sp = W.core.vorschlag(); f.von = sp.von; f.bis = sp.bis; renderWett(); };
        const sug = q('#wSug'); if (sug) sug.onclick = () => { WS.sv++; f.a = suggest(); renderWett(); const x = q('#wCnt'); if (x) x.scrollIntoView({ block: 'nearest' }); };
        const al = q('#wAll'); if (al) al.onchange = () => { WS.alle = al.checked; renderWett(); };
        qa('input.wA').forEach(c => c.onchange = () => { const i = f.a.indexOf(c.value); if (c.checked && i < 0 && f.a.length < (W ? W.WW.aMax : 6)) f.a.push(c.value); else if (!c.checked && i >= 0) f.a.splice(i, 1); renderWett(); });
        const key = q('#wKey'), keep = q('#wKeep'); const saveKey = () => { WS.key = key.value.trim(); WS.keep = keep.checked; kv.set(WK.key, WS.keep ? WS.key : null); };
        if (key) { key.oninput = saveKey; keep.onchange = saveKey; }
        const go = q('#wGo'); if (go) go.onclick = async () => {
          const r = await core.wettAusschreiben(f, W, {}); WS.errors = r.errors;
          if (r.ok) { WS.ausOut = { code: r.code, aus: r.aus }; addAusCode(r.code, true); WS.sel = r.aus.wid; WS.pr = null; WS.ergs = []; WS.msgE = ''; WS.msgP = 'Ausschreibung erzeugt und in diesem Gerät gemerkt (nur der Code, keine Namen).'; }
          renderWett(); const x = q(r.ok ? '#wCode' : '#wErr'); if (x) { if (r.ok) x.scrollIntoView({ block: 'nearest' }); }
        };
        if (WS.ausOut) {
          qrFill('#wQr', WS.ausOut.code, 'QR-Code der Ausschreibung');
          q('#wCp').onclick = () => copyTa(q('#wCode'), 'Kopiert.'); q('#wSend').onclick = () => sendCode(WS.ausOut.code, 'Wettbewerb weitergeben');
          q('#wToS').onclick = () => { WS.tab = 'sam'; renderWett(); const x = q('#wt-sam'); if (x) x.focus(); };
        }
      } else if (WS.tab === 'sam') {
        const sel = q('#wSel'); if (sel) sel.onchange = () => { WS.sel = sel.value; WS.pr = null; WS.ergs = []; WS.msgE = ''; WS.sperrK = []; renderWett(); };
        const tx = q('#wTfw'); if (tx) tx.oninput = () => { WS.draft.wTfw = tx.value; };
        const ta = q('#wTfwAdd'); if (ta) ta.onclick = () => { const ws = WA() ? WA().core.parseAus(tx.value) : []; if (!ws.length) { WS.msgE = 'Kein gültiger Ausschreibungs-Code (TFW1.…) gefunden.'; renderWett(); return; } const a = addAusCode(ws[0].code, true); WS.sel = a.wid; WS.draft.wTfw = ''; WS.pr = null; WS.ergs = []; WS.msgE = 'Ausschreibung „' + a.n + '“ übernommen.'; renderWett(); };
        const te = q('#wTxE'); if (te) te.oninput = () => { WS.draft.wTxE = te.value; };
        const re = q('#wRecvE'); if (re) re.onclick = recvE;
        const ad = q('#wAddE'); if (ad) ad.onclick = () => { const r = addErgText(te.value); if (r.neu) { WS.draft.wTxE = ''; eRefresh(); } else { if (!te.value.trim()) WS.msgE = 'Bitte erst Codes einfügen.'; renderWett(); } };
        const cl = q('#wClrE'); if (cl) cl.onclick = () => { WS.ergs = []; WS.pr = null; WS.msgE = 'Liste geleert.'; renderWett(); };
      } else if (WS.tab === 'rang') {
        qa('button.wX').forEach(b => b.onclick = () => { const k = b.dataset.k, i = WS.sperrK.indexOf(k); if (i >= 0) WS.sperrK.splice(i, 1); else WS.sperrK.push(k); WS.pub = null; renderWett(); });
        const ok = q('#wPubOk'); if (ok) ok.onchange = () => { WS.pubOk = ok.checked; renderWett(); };
        const csv = q('#wCsv'); if (csv) csv.onclick = () => { const aus = curAus(); if (!aus || !WS.pr) return; const rang = WA().core.rangliste(WS.pr.items, aus, { sperr: WS.sperrK }); download('tonfunk-wettbewerb-' + aus.wid + '-' + isoDay() + '.csv', '﻿' + core.wettCsv(rang, aus, WA()), 'text/csv;charset=utf-8'); };
        const pb = q('#wPub'); if (pb) pb.onclick = async () => {
          const aus = curAus(); if (!aus || !WS.pubOk || !WS.pr) return; const rang = WA().core.rangliste(WS.pr.items, aus, { sperr: WS.sperrK });
          const code = await core.rangCode(aus, rang, WS.sperr, WA(), Date.now()); WS.pub = code; WS.msgP = code ? 'Ranglisten-Code erzeugt. Gib ihn nur mit Einverständnis der Azubis weiter.' : 'Keine gewertete Zeile, nichts zu veröffentlichen.'; renderWett(); const x = q('#wCode2'); if (x) x.scrollIntoView({ block: 'nearest' });
        };
        if (WS.pub) { qrFill('#wQr2', WS.pub, 'QR-Code der Rangliste'); q('#wCp2').onclick = () => copyTa(q('#wCode2'), 'Kopiert.'); q('#wSend2').onclick = () => sendCode(WS.pub, 'Rangliste weitergeben (TFR1)'); }
      } else if (WS.tab === 'kar') {
        const tx = q('#wTxK'); if (tx) tx.oninput = () => { WS.draft.wTxK = tx.value; };
        const rk = q('#wRecvK'); if (rk) rk.onclick = recvK;
        const ad = q('#wAddK'); if (ad) ad.onclick = () => { const r = addKartenText(tx.value); if (r.karten || r.rueck) { WS.draft.wTxK = ''; kRefresh(); } else { if (!tx.value.trim()) WS.msgK = 'Bitte erst Codes einfügen.'; renderWett(); } };
        const cl = q('#wClrK'); if (cl) cl.onclick = () => { WS.cardsIn = []; WS.rueckIn = []; WS.kr = null; WS.msgK = 'Liste geleert.'; renderWett(); };
        qa('button.wS').forEach(b => b.onclick = () => { const c = b.dataset.cid, i = WS.sperr.indexOf(c); if (i >= 0) WS.sperr.splice(i, 1); else WS.sperr = core.sperrNorm(WS.sperr.concat([c])); kv.set(WK.sperr, WS.sperr.length ? JSON.stringify(WS.sperr) : null); WS.pub = null; kRefresh(); });
        const csv = q('#wCsvK'); if (csv) csv.onclick = () => { if (WS.kr) download('tonfunk-tauschkarten-' + isoDay() + '.csv', '﻿' + core.kartenCsv(WS.kr.rows, WS.sperr, cat), 'text/csv;charset=utf-8'); };
      }
    }
    function slot() { const sl = out.querySelector('#wettSlot'); if (sl) sl.replaceWith(wettEl); }
    wettInit(); renderWett();
    rerun();
    return { state: S, add, addCodes, duelRefresh, rerun, combine: () => M, aggregate: () => A, wett: { state: WS, render: renderWett, addErgText, addKartenText, addAus: c => addAusCode(c, true), eRefresh, kRefresh } };
  }
  const Ueb = { core, mount, SUPPORTED };
  if (typeof module !== 'undefined' && module.exports) module.exports = Ueb; else root.Ueb = Ueb;
})(typeof window !== 'undefined' ? window : globalThis);
