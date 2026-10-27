/* Klassen-Dashboard für Ausbilder (auswertung.html). Logik ohne DOM in Dash.core (auch unter Node nutzbar, Tests: quelle/dash/test_dash.js),
   Oberfläche in Dash.mount(). Keine Datenübertragung: alles bleibt in localStorage dieses Browsers (Schlüssel „dash.v1“).

   ===== Datenlage: Was im Ergebnis-Code steht (Auswertung.handIn / Auswertung.code) =====
   Ein Code „TFL1.<base64url(JSON)>“ enthält  { n: Name, t: Zeitpunkt der Code-Erzeugung (ms), d: { aufgabenId: Prozent }, h: { aufgabenId: höchste Tipp-Stufe 1..3 },
   b: [Abzeichen-IDs], w: { duellId: [ms, text] } }.  Es gibt KEINE Bearbeitungsdauer, KEINE Versuchszahl und KEINE Prüfungsnote im Code.
   Daraus folgt: „Datum“ einer Aufgabe = Zeitpunkt des Codes, mit dem der beste Stand zum ersten Mal ankam. „Versuche“ = Zahl der Abgaben mit neuem Stand
   (anderer Prozentwert oder andere Tipp-Stufe als zuvor; erneutes Einlesen desselben Codes zählt nicht). Prüfungs-Lab: Es wird die höchste erreichte
   Stufe aus den Aufgaben pr10/pr11/pr12 (bestanden / Note 2 / Note 1) angezeigt, nicht die genaue Note. Auffälligkeiten stützen sich nur auf Tipp-Stufen
   und auf die Zeitstempel einzeln abgegebener Aufgaben-Codes.

   ===== Schnittstelle Dash.source (austauschbarer Datentransport) =====
   Alle Methoden liefern ein Promise. Heute: Dash.source = lokale Quelle (QR/Text/Datei, localStorage). Später: eigene Quelle mit Dash.useSource(obj).
     import(codeOrFile) -> Promise<Record[]>   liest Eingaben und liefert NORMALISIERTE Datensätze, speichert nichts. Eingabe: Text mit einem oder mehreren
                                               Codes (TFL1.…), File/Blob (Text, JSON-Sicherung oder Bild mit QR-Code), Array/Objekt mit Datensätzen.
                                               Eine Server-Quelle darf hier z. B. GET /api/ergebnisse?seit=… aufrufen und die Antwort als Record[] liefern.
     list()              -> Promise<Store>     gesamter Bestand (siehe unten).
     save(store)         -> Promise<void>      speichert den gesamten Bestand (Server: PUT /api/dash/store, JSON-Body = Store).
     clear(classId?)     -> Promise<void>      löscht eine Klasse bzw. ohne Argument alles (Server: DELETE /api/dash/classes/:id bzw. DELETE /api/dash/store).
   Record = { n: string, t: ms, d: {id: 0..100}, h: {id: 1..3}, b: string[], w: {duell: [ms, text]} }   (gleiche Felder wie im Code)
   Store  = { v: 1, active: classId|null, settings: { rank: false, hide: false }, classes: [ { id, name, created: ms, records: Record[] } ] }
   Hinweise für eine Server-Anbindung: Dash.core.normalizeStore() bereinigt jede Antwort (unbekannte Felder fallen weg, Grenzen werden geprüft).
   Dedupe läuft über Dash.core.mergeRecords (Schlüssel Name+Zeit+Inhalt), mehrfaches Hochladen derselben Abgabe ist also unschädlich.
   Namen sind die einzige Identität; bei Server-Betrieb sollte eine Azubi-ID im Feld n mitgeführt oder ein Feld „id“ ergänzt werden (core.keyName anpassen).
   Hinweise: Der Zugriff muss serverseitig geschützt sein (das Passwort-Tor in auswertung.html schützt nur die Oberfläche). */
(function (root) {
  'use strict';
  const MAXREC = 20000, DAY = 86400000;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const fmtD = t => { if (!t) return '–'; const d = new Date(t); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); };
  const fmtDT = t => { if (!t) return '–'; const d = new Date(t); return fmtD(t) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const idOk = k => /^[\w.\-]{1,40}$/.test(k);

  /* ====================================================== reine Logik ====================================================== */
  const core = {};
  core.esc = esc; core.fmtD = fmtD; core.fmtDT = fmtDT;
  core.keyName = n => String(n == null ? '' : n).trim().replace(/\s+/g, ' ').toLowerCase();

  function unb64(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof atob === 'function') return decodeURIComponent(escape(atob(s)));
    return Buffer.from(s, 'base64').toString('utf8');
  }
  /* Datensatz bereinigen; null, wenn keine gültigen Aufgaben enthalten sind */
  core.normalize = function (o) {
    if (!o || typeof o !== 'object' || !o.d || typeof o.d !== 'object' || Array.isArray(o.d)) return null;
    const r = { n: String(o.n == null ? '' : o.n).trim().replace(/\s+/g, ' ').slice(0, 60) || 'ohne Namen', t: 0, d: {}, h: {}, b: [], w: {} };
    const t = +o.t; if (isFinite(t) && t > 0 && t < Date.now() + 2 * DAY) r.t = Math.round(t);
    let n = 0;
    Object.keys(o.d).forEach(k => { const v = +o.d[k]; if (idOk(k) && isFinite(v) && n < 1500) { r.d[k] = clamp(Math.round(v), 0, 100); n++; } });
    if (!n) return null;
    if (o.h && typeof o.h === 'object') Object.keys(o.h).forEach(k => { const v = Math.round(+o.h[k]); if (r.d[k] != null && v >= 1) r.h[k] = Math.min(3, v); });
    if (Array.isArray(o.b)) r.b = Array.from(new Set(o.b.map(x => String(x).slice(0, 60)))).slice(0, 300);
    if (o.w && typeof o.w === 'object') Object.keys(o.w).forEach(k => { const x = o.w[k]; if (idOk(k) && Array.isArray(x) && +x[0] > 0) r.w[k] = [Math.round(+x[0]), String(x[1] || '').slice(0, 40)]; });
    return r;
  };
  /* alle Codes (TFL1.…) aus einem Text, oder JSON-Sicherung dieses Dashboards */
  core.parseText = function (txt) {
    txt = String(txt == null ? '' : txt); const out = [], tr = txt.trim();
    if (tr[0] === '{' || tr[0] === '[') {
      try { const j = JSON.parse(tr), arr = Array.isArray(j) ? j : (j && Array.isArray(j.records) ? j.records : null); if (arr) return arr.map(core.normalize).filter(Boolean); } catch (e) {}
    }
    (txt.match(/TFL1\.[A-Za-z0-9_-]+/g) || []).forEach(c => { try { const r = core.normalize(JSON.parse(unb64(c.slice(5)))); if (r) out.push(r); } catch (e) {} });
    return out;
  };
  core.recKey = r => core.keyName(r.n) + '|' + r.t + '|' + Object.keys(r.d).sort().map(k => k + '=' + r.d[k] + (r.h[k] ? 'h' + r.h[k] : '')).join(',');
  /* neue Datensätze zu bestehenden: ohne Doppelte, nach Zeit sortiert */
  core.mergeRecords = function (existing, incoming) {
    const seen = new Set(existing.map(core.recKey)), res = existing.slice(); let added = 0, dups = 0;
    incoming.forEach(r => { r = core.normalize(r); if (!r) return; const k = core.recKey(r); if (seen.has(k)) { dups++; return; } if (res.length >= MAXREC) return; seen.add(k); res.push(r); added++; });
    res.sort((a, b) => a.t - b.t);
    return { records: res, added, dups };
  };

  /* ---------- Bestand (Klassen) ---------- */
  core.newStore = () => ({ v: 1, active: null, settings: { rank: false, hide: false }, classes: [] });
  core.normalizeStore = function (s) {
    const r = core.newStore(); if (!s || typeof s !== 'object') return r;
    if (s.settings && typeof s.settings === 'object') { r.settings.rank = s.settings.rank === true; r.settings.hide = s.settings.hide === true; }
    (Array.isArray(s.classes) ? s.classes : []).slice(0, 100).forEach(c => {
      if (!c || typeof c !== 'object') return;
      const id = String(c.id || '').replace(/[^\w-]/g, '').slice(0, 30); if (!id || r.classes.some(x => x.id === id)) return;
      r.classes.push({ id, name: String(c.name || 'Klasse').trim().slice(0, 60) || 'Klasse', created: +c.created > 0 ? +c.created : 0, records: core.mergeRecords([], Array.isArray(c.records) ? c.records : []).records });
    });
    r.active = r.classes.some(c => c.id === s.active) ? s.active : (r.classes[0] ? r.classes[0].id : null);
    return r;
  };
  let idN = 0;
  core.addClass = function (store, name) {
    name = String(name || '').trim().slice(0, 60); if (!name) return null;
    const id = 'k' + Date.now().toString(36) + (idN++).toString(36) + Math.random().toString(36).slice(2, 5);
    store.classes.push({ id, name, created: Date.now(), records: [] }); store.active = id; return id;
  };
  core.getClass = (store, id) => store.classes.find(c => c.id === (id || store.active)) || null;
  core.renameClass = function (store, id, name) { const c = core.getClass(store, id); name = String(name || '').trim().slice(0, 60); if (!c || !name) return false; c.name = name; return true; };
  core.removeClass = function (store, id) { const i = store.classes.findIndex(c => c.id === id); if (i < 0) return false; store.classes.splice(i, 1); if (store.active === id) store.active = store.classes[0] ? store.classes[0].id : null; return true; };
  core.feed = function (store, classId, recs) { const c = core.getClass(store, classId); if (!c) return null; const m = core.mergeRecords(c.records, recs); c.records = m.records; return { added: m.added, dups: m.dups }; };
  core.removeStudent = function (store, classId, key) { const c = core.getClass(store, classId); if (!c) return 0; const n = c.records.length; c.records = c.records.filter(r => core.keyName(r.n) !== key); return n - c.records.length; };

  /* ---------- Katalog: Labs und Aufgaben aus AUFGABEN / LAB_REG (nichts fest verdrahtet) ---------- */
  core.catalog = function (G, extraIds) {
    G = G || {}; const T = G.AUFGABEN || [], REG = G.LAB_REG || {}, LABS = G.AUFGABEN_LABS || {};
    const order = []; const add = k => { if (k != null && !order.includes(k)) order.push(k); };
    Object.keys(LABS).forEach(add); Object.keys(REG).forEach(add); T.forEach(t => add(t[1]));
    const byId = {}, tasks = [];
    T.forEach(t => { const m = { id: t[0], lab: t[1], cat: t[2], title: t[3], level: t[4] }; byId[m.id] = m; tasks.push(m); });
    const unk = (extraIds || []).filter(id => !byId[id]);
    unk.forEach(id => { const m = { id, lab: '?', cat: 'Unbekannt', title: id, level: 0 }; byId[id] = m; tasks.push(m); });
    if (unk.length) add('?');
    const labs = order.map(k => {
      const reg = REG[k] || {};
      return { key: k, name: k === '?' ? 'Unbekannt (neue Aufgaben)' : (LABS[k] || reg.name || k), short: k === '?' ? '?' : (reg.short || LABS[k] || k), file: reg.file || '', tasks: tasks.filter(t => t.lab === k) };
    }).filter(l => l.tasks.length);
    return { labs, tasks, byId };
  };

  /* ---------- Stand der Azubis aus den Datensätzen (bis zum Zeitpunkt upTo) ---------- */
  core.studentsAt = function (records, upTo) {
    if (upTo == null) upTo = Infinity;
    const recs = records.filter(r => !(r.t > upTo)).slice().sort((a, b) => a.t - b.t), S = {}, last = {};
    recs.forEach(r => {
      const k = core.keyName(r.n), s = S[k] = S[k] || { key: k, name: r.n, d: {}, h: {}, at: {}, att: {}, t: 0, b: [], w: {}, subs: 0 };
      s.name = r.n; s.subs++; if (r.t > s.t) s.t = r.t;
      (r.b || []).forEach(x => { if (!s.b.includes(x)) s.b.push(x); });
      Object.keys(r.w || {}).forEach(x => { if (!s.w[x] || s.w[x][0] > r.w[x][0]) s.w[x] = r.w[x]; });
      Object.keys(r.d).forEach(id => {
        const v = r.d[id], hv = r.h[id] || 0, sig = v + '/' + hv, lk = k + '|' + id;
        if (last[lk] !== sig) { s.att[id] = (s.att[id] || 0) + 1; last[lk] = sig; }
        const old = s.d[id];
        if (old == null || v > old) { s.d[id] = v; s.at[id] = r.t; s.h[id] = hv; } else if (v === old) s.h[id] = hv;
      });
    });
    return S;
  };
  const sum = a => a.reduce((x, y) => x + y, 0);
  core.labProgress = (s, tasks) => tasks.length ? Math.round(sum(tasks.map(t => s.d[t.id] || 0)) / tasks.length) : 0;
  core.studentStats = function (s, tasks) {
    const tried = tasks.filter(t => s.d[t.id] != null), solved = tried.filter(t => s.d[t.id] >= 100).length;
    return { solved, tried: tried.length, avg: tried.length ? Math.round(sum(tried.map(t => s.d[t.id])) / tried.length) : null, hints: sum(tried.map(t => s.h[t.id] || 0)), badges: s.b.length, last: s.t };
  };
  /* höchste erreichte Prüfungs-Lab-Stufe (nur Aufgaben aus dem Code, nicht die genaue Note) */
  core.examLevel = function (s) {
    const ok = id => (s.d[id] || 0) >= 100;
    if (ok('pr12')) return { rank: 3, text: 'Note 1' };
    if (ok('pr11')) return { rank: 2, text: 'mind. Note 2' };
    if (['pr10', 'pr14', 'pr15', 'pr16'].some(ok)) return { rank: 1, text: 'bestanden' };
    return { rank: 0, text: '–' };
  };
  core.score = s => { let x = 0; Object.keys(s.d).forEach(k => { x += Math.max(0, Math.round(s.d[k] / 10) - (s.h[k] || 0)); }); return x + 5 * s.b.length + 3 * Object.keys(s.w).length; };
  /* Farbskala: 0 % rot bis 100 % grün (dunkler Text bleibt in beiden Farbschemata lesbar) */
  core.color = p => p == null ? null : 'hsl(' + Math.round(clamp(p, 0, 100) * 1.2) + ' 62% ' + (p >= 100 ? 58 : 76) + '%)';

  /* ---------- Schwachstellen ---------- */
  core.weakPoints = function (students, tasks, opt) {
    opt = opt || {}; const N = students.length, minTried = opt.minTried || Math.min(2, Math.max(1, N)), rows = [];
    tasks.forEach(t => {
      const tr = students.filter(s => s.d[t.id] != null); if (!tr.length) return;
      const solved = tr.filter(s => s.d[t.id] >= 100).length, notSolved = tr.length - solved;
      const hs = tr.map(s => s.h[t.id] || 0), avgHint = sum(hs) / tr.length, avgPct = sum(tr.map(s => s.d[t.id])) / tr.length;
      rows.push({ id: t.id, title: t.title, lab: t.lab, cat: t.cat, tried: tr.length, solved, notSolved, notTried: N - tr.length, fail: notSolved / tr.length, attempts: sum(tr.map(s => s.att[t.id] || 0)), avgHint, avgPct: Math.round(avgPct) });
    });
    return rows.filter(r => r.tried >= minTried && (r.notSolved > 0 || r.avgHint >= 1.5))
      .sort((a, b) => b.notSolved - a.notSolved || b.fail - a.fail || a.avgPct - b.avgPct || b.avgHint - a.avgHint || a.id.localeCompare(b.id));
  };
  core.topicWeak = function (students, tasks, opt) {
    opt = opt || {}; const g = {};
    tasks.forEach(t => { const k = t.lab + '|' + t.cat, x = g[k] = g[k] || { lab: t.lab, cat: t.cat, tried: 0, notSolved: 0, attempts: 0, sumPct: 0 };
      students.forEach(s => { const v = s.d[t.id]; if (v == null) return; x.tried++; x.sumPct += v; x.attempts += s.att[t.id] || 0; if (v < 100) x.notSolved++; }); });
    return Object.keys(g).map(k => g[k]).filter(x => x.tried >= (opt.minTried || 3) && x.notSolved > 0).map(x => ({ lab: x.lab, cat: x.cat, tried: x.tried, notSolved: x.notSolved, attempts: x.attempts, fail: x.notSolved / x.tried, avgPct: Math.round(x.sumPct / x.tried) }))
      .sort((a, b) => b.fail - a.fail || b.notSolved - a.notSolved);
  };

  /* ---------- Auffälligkeiten (nur aus Tipp-Stufen und Zeitstempeln einzeln abgegebener Aufgaben) ---------- */
  core.anomalies = function (records, students, opt) {
    opt = Object.assign({ tipSum: 10, tipShare: 0.5, minTried: 4, win: 180000, burst: 3 }, opt || {}); const out = [], keys = new Set(students.map(s => s.key));
    students.forEach(s => {
      const ids = Object.keys(s.d);
      ids.forEach(id => { if (s.d[id] >= 100 && s.h[id] === 3) out.push({ key: s.key, name: s.name, id, type: 'aufloesung', text: '100 % nach Auflösung (Tipp-Stufe 3)' }); });
      const hs = sum(ids.map(id => s.h[id] || 0)), withHint = ids.filter(id => (s.h[id] || 0) >= 2).length;
      if (ids.length >= opt.minTried && (hs >= opt.tipSum || withHint / ids.length >= opt.tipShare))
        out.push({ key: s.key, name: s.name, id: null, type: 'tipps', text: 'Viele Tipps: ' + withHint + ' von ' + ids.length + ' Aufgaben mit konkretem Hinweis oder Auflösung (Summe der Stufen ' + hs + ')' });
    });
    const per = {};
    records.slice().sort((a, b) => a.t - b.t).forEach(r => { const k = core.keyName(r.n), ids = Object.keys(r.d); if (!keys.has(k) || ids.length !== 1 || !r.t) return;
      const m = per[k] = per[k] || { seen: new Set(), ev: [] }, id = ids[0]; if (r.d[id] >= 100 && !m.seen.has(id)) { m.seen.add(id); m.ev.push([r.t, id]); } });
    Object.keys(per).forEach(k => {
      const ev = per[k].ev; let i = 0;
      while (i < ev.length) { let j = i; while (j + 1 < ev.length && ev[j + 1][0] - ev[i][0] <= opt.win) j++;
        if (j - i + 1 >= opt.burst) { const s = students.find(x => x.key === k); out.push({ key: k, name: s ? s.name : k, id: null, ids: ev.slice(i, j + 1).map(e => e[1]), type: 'tempo', text: (j - i + 1) + ' Aufgaben mit 100 % innerhalb von ' + Math.max(1, Math.round((ev[j][0] - ev[i][0]) / 60000)) + ' Minuten abgegeben' }); i = j + 1; } else i++; }
    });
    const pr = { tempo: 0, tipps: 1, aufloesung: 2 };
    return out.sort((x, y) => pr[x.type] - pr[y.type] || x.name.localeCompare(y.name, 'de'));
  };

  /* ---------- Verlauf über Zeit ---------- */
  const NICE = [60000, 300000, 900000, 3600000, 6 * 3600000, DAY, 7 * DAY];
  core.bucketSize = span => NICE.find(n => span / n <= 40) || 7 * DAY;
  core.timeline = function (records, keys, labs) {
    const ks = new Set(keys), recs = records.filter(r => r.t > 0 && ks.has(core.keyName(r.n)));
    if (!recs.length) return { times: [], series: [] };
    const t0 = Math.min.apply(null, recs.map(r => r.t)), t1 = Math.max.apply(null, recs.map(r => r.t)), b = core.bucketSize(t1 - t0), times = [];
    for (let t = Math.ceil(t0 / b) * b; ; t += b) { if (t < t0) continue; times.push(Math.min(t, t1 + b)); if (t >= t1) break; }
    if (times[times.length - 1] < t1) times.push(t1);
    const filt = records.filter(r => ks.has(core.keyName(r.n)));
    const series = labs.map(l => ({ key: l.key, name: l.name, values: [] }));
    times.forEach(T => {
      const st = core.studentsAt(filt, T);
      labs.forEach((l, i) => series[i].values.push(keys.length ? Math.round(sum(keys.map(k => st[k] ? core.labProgress(st[k], l.tasks) : 0)) / keys.length) : 0));
    });
    return { times, series };
  };

  /* ---------- Gesamtmodell für die Ansicht ---------- */
  core.model = function (records, G, f) {
    f = Object.assign({ lab: 'alle', cat: 'alle', az: 'alle', sort: 'name', dir: 1, mode: 'auto', showEmpty: false }, f || {});
    const all = core.studentsAt(records), allKeys = Object.keys(all).sort((a, b) => all[a].name.localeCompare(all[b].name, 'de'));
    const used = new Set(); allKeys.forEach(k => Object.keys(all[k].d).forEach(id => used.add(id)));
    const cat = core.catalog(G, Array.from(used));
    const keys = f.az !== 'alle' && all[f.az] ? [f.az] : allKeys, studs = keys.map(k => all[k]);
    const usedSel = new Set(); studs.forEach(s => Object.keys(s.d).forEach(id => usedSel.add(id)));
    const labsSel = cat.labs.filter(l => f.lab === 'alle' || l.key === f.lab).map(l => Object.assign({}, l, { tasks: l.tasks.filter(t => f.cat === 'alle' || t.cat === f.cat) })).filter(l => l.tasks.length);
    const labsVis = labsSel.filter(l => f.showEmpty || l.tasks.some(t => usedSel.has(t.id)));
    const tasksSel = [].concat.apply([], labsVis.map(l => l.tasks));
    const taskCols = tasksSel.filter(t => f.showEmpty || usedSel.has(t.id));
    const mode = f.mode === 'auto' ? (f.lab === 'alle' ? 'lab' : 'task') : f.mode;
    const rows = studs.map(s => {
      const st = core.studentStats(s, tasksSel), lp = {}; labsVis.forEach(l => { lp[l.key] = core.labProgress(s, l.tasks); });
      const prog = labsVis.length ? Math.round(sum(labsVis.map(l => lp[l.key])) / labsVis.length) : 0;
      return { s, key: s.key, name: s.name, st, lp, prog, exam: core.examLevel(s), score: core.score(s) };
    });
    const cmp = { name: (a, b) => a.name.localeCompare(b.name, 'de'), avg: (a, b) => (a.st.avg == null ? -1 : a.st.avg) - (b.st.avg == null ? -1 : b.st.avg), solved: (a, b) => a.st.solved - b.st.solved, last: (a, b) => a.st.last - b.st.last, prog: (a, b) => a.prog - b.prog, hints: (a, b) => a.st.hints - b.st.hints, exam: (a, b) => a.exam.rank - b.exam.rank }[f.sort] || ((a, b) => a.name.localeCompare(b.name, 'de'));
    rows.sort((a, b) => (cmp(a, b) || a.name.localeCompare(b.name, 'de')) * (f.dir < 0 ? -1 : 1));
    const colAvg = labsVis.map(l => rows.length ? Math.round(sum(rows.map(r => r.lp[l.key])) / rows.length) : 0);
    return {
      f, all, allKeys, rows, studs, cat, labsVis, taskCols, mode, colAvg,
      kpi: { n: rows.length, prog: rows.length ? Math.round(sum(rows.map(r => r.prog)) / rows.length) : 0, solved: sum(rows.map(r => r.st.solved)), last: rows.reduce((m, r) => Math.max(m, r.st.last), 0) },
      weak: core.weakPoints(studs, tasksSel), topics: core.topicWeak(studs, tasksSel), anom: core.anomalies(records, studs),
      rank: rows.slice().sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'de')),
      timeline: core.timeline(records, keys, labsVis)
    };
  };

  /* ---------- CSV (Semikolon, Excel-tauglich; Formeln aus Namen werden entschärft) ---------- */
  core.csvCell = v => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s) && isNaN(+s)) s = "'" + s; return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  core.csv = function (m, className) {
    const head = ['Name', 'Klasse', 'Gelöst (100 %)', 'Bearbeitet', 'Durchschnitt %', 'Letzte Aktivität', 'Tipp-Stufen', 'Abzeichen', 'Prüfungs-Lab']
      .concat(m.labsVis.map(l => 'Fortschritt ' + l.name + ' %')).concat(m.taskCols.map(t => (m.cat.labs.find(l => l.key === t.lab) || { name: t.lab }).name + ': ' + t.title + ' (%)'));
    const lines = [head.map(core.csvCell).join(';')];
    m.rows.forEach(r => lines.push([r.name, className || '', r.st.solved, r.st.tried, r.st.avg == null ? '' : r.st.avg, r.st.last ? fmtDT(r.st.last) : '', r.st.hints, r.st.badges, r.exam.text === '–' ? '' : r.exam.text]
      .concat(m.labsVis.map(l => r.lp[l.key])).concat(m.taskCols.map(t => r.s.d[t.id] == null ? '' : r.s.d[t.id])).map(core.csvCell).join(';')));
    return lines.join('\r\n') + '\r\n';
  };
  core.backupJson = (cls) => JSON.stringify({ format: 'tonfunk-dash', v: 1, name: cls.name, exported: Date.now(), records: cls.records });

  /* ====================================================== Datenquelle ====================================================== */
  const KEY = 'dash.v1';
  function readFileText(f) {
    if (typeof f.text === 'function') return f.text();
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(new Error('Datei nicht lesbar')); fr.readAsText(f); });
  }
  /* jsqr.js (251 KB) liegt nicht im Precache des Service Workers: erst bei Bedarf laden (Scan, Bild-Import, Vorbereiten-Knopf). Der Service Worker legt es danach in den Cache. */
  let qrLade = null;
  function loadJsQR() {
    if (root.jsQR) return Promise.resolve(root.jsQR);
    if (qrLade) return qrLade;
    qrLade = new Promise((res, rej) => {
      if (typeof document === 'undefined') { rej(new Error('Scanner nicht verfügbar')); return; }
      const s = document.createElement('script'); s.src = 'jsqr.js';
      s.onload = () => (root.jsQR ? res(root.jsQR) : rej(new Error('Scanner-Bibliothek defekt')));
      s.onerror = () => { s.remove(); rej(new Error('Scanner (jsqr.js) nicht geladen: einmal online öffnen')); };
      document.head.appendChild(s);
    }).catch(e => { qrLade = null; throw e; });
    return qrLade;
  }
  /* Für Offline-Nutzung vorbereiten: laden und sicherstellen, dass jsqr.js im Cache des Labs liegt (auch wenn der Service Worker die Seite noch nicht steuert). */
  function prepareScanner() {
    return loadJsQR().then(() => {
      if (typeof caches === 'undefined') return 'geladen';
      return caches.keys().then(ks => {
        const k = ks.find(x => /^lochlab-/.test(x));
        if (!k) return 'geladen';
        return caches.open(k).then(c => c.match('jsqr.js').then(m => m ? 'bereit' : fetch('jsqr.js').then(r => (r.ok ? c.put('jsqr.js', r).then(() => 'bereit') : 'geladen'))));
      });
    });
  }
  function decodeImage(file) {
    return loadJsQR().catch(() => null).then(() => new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => { try { const sc = Math.min(1, 1400 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * sc)); c.height = Math.max(1, Math.round(im.height * sc));
        const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0, c.width, c.height); const d = cx.getImageData(0, 0, c.width, c.height), r = root.jsQR && root.jsQR(d.data, c.width, c.height); URL.revokeObjectURL(url); res(r && r.data ? r.data : ''); } catch (e) { rej(e); } };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Bild nicht lesbar')); }; im.src = url;
    }));
  }
  const localSource = {
    name: 'lokal',
    import(input) {
      return Promise.resolve().then(() => {
        if (typeof input === 'string') return core.parseText(input);
        if (Array.isArray(input)) return input.map(core.normalize).filter(Boolean);
        if (input && Array.isArray(input.records)) return input.records.map(core.normalize).filter(Boolean);
        if (input && typeof input === 'object' && (typeof input.text === 'function' || typeof input.size === 'number')) {
          if (/^image\//.test(input.type || '')) return decodeImage(input).then(core.parseText);
          return readFileText(input).then(core.parseText);
        }
        return [];
      });
    },
    list() { return Promise.resolve().then(() => { let s = null; try { s = JSON.parse(root.localStorage.getItem(KEY) || 'null'); } catch (e) {} return core.normalizeStore(s); }); },
    save(store) { return new Promise((res, rej) => { try { root.localStorage.setItem(KEY, JSON.stringify(store)); res(); } catch (e) { rej(new Error('Speichern im Browser nicht möglich (Speicher voll oder gesperrt)')); } }); },
    clear(classId) {
      return localSource.list().then(s => { if (classId) { core.removeClass(s, classId); return localSource.save(s); } try { root.localStorage.removeItem(KEY); } catch (e) {} });
    }
  };
  const SRC_METHODS = ['import', 'list', 'save', 'clear'];
  const Dash = { core, source: localSource, version: 1 };
  Dash.useSource = function (src) {
    const miss = SRC_METHODS.filter(m => !src || typeof src[m] !== 'function');
    if (miss.length) throw new Error('Dash.source: Methoden fehlen: ' + miss.join(', '));
    Dash.source = src; STORE = null; if (UI) UI.reload();
  };

  /* ====================================================== Oberfläche ====================================================== */
  let STORE = null, UI = null, queue = Promise.resolve();
  const ensure = () => STORE ? Promise.resolve(STORE) : Dash.source.list().then(s => (STORE = core.normalizeStore(s)));
  const persist = () => Dash.source.save(STORE);
  /* Einlesen aus den alten Karten (Einfügen/Scan): Datensätze in die aktive Klasse übernehmen */
  Dash.feed = function (recs) {
    queue = queue.then(() => ensure().then(() => {
      let c = core.getClass(STORE); if (!c) { core.addClass(STORE, 'Meine Klasse'); c = core.getClass(STORE); }
      const r = core.feed(STORE, c.id, recs); return persist().then(() => { if (UI) UI.refresh(); return r; });
    })).catch(e => { if (UI) UI.msg(String(e.message || e)); });
    return queue;
  };
  Dash.print = () => UI && UI.print();
  Dash.mount = function (el) { if (!el) return; UI = makeUI(el); UI.reload(); return UI; };
  Dash.reset = function () { STORE = null; };

  const CSS = `
.dsh{margin-bottom:16px}.dsh h3{font-size:15px;margin:14px 0 6px}.dsh .mute{color:var(--mute,#68717c);font-size:13px}
.dsh .priv{border-left:4px solid var(--acc,#1f7ae0);background:var(--bg,#f4f5f7);padding:8px 12px;border-radius:0 8px 8px 0;font-size:13px;margin:0 0 10px}
.dsh .bar2{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}.dsh .bar2>label{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;color:var(--mute,#68717c)}
.dsh .bar2 select,.dsh .bar2 input[type=text]{width:auto;max-width:100%;min-width:0}.dsh input[type=checkbox]{width:auto}
.dsh .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:10px 0}.dsh .kpi{border:1px solid var(--line,#d8dce1);border-radius:10px;padding:8px 10px}.dsh .kpi b{display:block;font-size:20px}.dsh .kpi span{font-size:12px;color:var(--mute,#68717c)}
.dsh .scale{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--mute,#68717c);margin:4px 0}.dsh .scale i{display:inline-block;width:160px;height:10px;border-radius:5px;background:linear-gradient(90deg,hsl(0 62% 76%),hsl(60 62% 76%),hsl(120 62% 76%))}
.dsh td.pc{min-width:56px;font-weight:600;color:#1c2127}.dsh td.pc.none{background:var(--none,#eceff2);color:var(--mute,#68717c);font-weight:400}.dsh td.nm a{color:var(--acc,#1f7ae0);cursor:pointer;text-decoration:underline}
.dsh th.srt{cursor:pointer}.dsh th.srt:hover{text-decoration:underline}
.dsh .wk{display:grid;grid-template-columns:minmax(140px,34%) minmax(80px,1fr) minmax(190px,34%);gap:8px;align-items:center;font-size:13px;margin:3px 0}.dsh .wk .lb{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh .wk .nm{text-align:right;color:var(--mute,#68717c)}
.dsh .bar{height:14px;background:var(--none,#eceff2);border-radius:7px;overflow:hidden;display:flex}.dsh .bar i{display:block;height:100%}.dsh .bar i.r{background:#d9534f}.dsh .bar i.y{background:#f0b429}
.dsh .an{margin:4px 0;padding:6px 10px;border-left:4px solid #f0b429;background:var(--bg,#f4f5f7);border-radius:0 8px 8px 0;font-size:13px}
.dsh svg.ch{width:100%;height:auto;max-height:340px;display:block}.dsh .lg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;margin-top:4px}.dsh .lg b{display:inline-block;width:12px;height:4px;margin-right:5px;vertical-align:middle;border-radius:2px}
.dsh .det{border:2px solid var(--acc,#1f7ae0);border-radius:12px;padding:12px 14px;margin-top:14px}.dsh .pbar{display:inline-block;width:90px;height:10px;background:var(--none,#eceff2);border-radius:5px;overflow:hidden;vertical-align:middle}.dsh .pbar i{display:block;height:100%}
.dsh .msg{font-size:13px;color:var(--ok,#2fae45)}.dsh .msg.err{color:#d33}.dsh button.danger{color:#d33}.dsh .tw{margin-top:6px}
.dshoff{display:none!important}
#dashPrint{display:none}
body.printdash #app,body.printdash #gate{display:none!important}body.printdash #dashPrint{display:block!important;background:#fff;color:#000;padding:12px;font:12px/1.35 system-ui,sans-serif}
#dashPrint h1{font-size:18px;margin:0 0 2px}#dashPrint h2{font-size:14px;margin:12px 0 4px}#dashPrint table{border-collapse:collapse;width:100%}#dashPrint th,#dashPrint td{border:1px solid #999;padding:3px 5px;text-align:center;font-size:11px}#dashPrint td.l,#dashPrint th.l{text-align:left}
#dashPrint td.pc{-webkit-print-color-adjust:exact;print-color-adjust:exact;color:#000}#dashPrint .small{color:#444;font-size:11px}#dashPrint li{margin:2px 0}
@media (max-width:600px){.dsh .wk{grid-template-columns:1fr 90px}.dsh .wk .bar{grid-column:1/3;order:3}.dsh .wk .nm{text-align:right}}
@media print{.dsh{display:none}#dashPrint{display:block}}
`;
  const PAL = ['#1f7ae0', '#e0662c', '#2fae45', '#a24bd6', '#c79a12', '#16a6a6', '#d63a6e', '#6b7a8a'];

  function makeUI(host) {
    if (!document.getElementById('dashCss')) { const st = document.createElement('style'); st.id = 'dashCss'; st.textContent = CSS; document.head.appendChild(st); }
    const F = { lab: 'alle', cat: 'alle', az: 'alle', sort: 'name', dir: 1, mode: 'auto', showEmpty: false, detail: null, detailAll: false };
    host.innerHTML = `<section class="card dsh" aria-label="Klassen-Dashboard">
  <h2 style="font-size:18px">Klassen-Dashboard</h2>
  <p class="priv"><b>Datenschutz:</b> Die Daten bleiben nur in diesem Browser (localStorage), es wird nichts übertragen. Export (CSV, Sicherung, Druck) gibt es nur auf Knopfdruck. Löschen: je Klasse oder alles.</p>
  <div class="bar2" id="dshCls"></div>
  <div class="bar2" id="dshIn"><textarea id="dshTxt" rows="2" placeholder="Ergebnis-Codes (TFL1.…) hier einfügen, auch mehrere auf einmal" style="flex:1 1 280px;min-height:54px"></textarea></div>
  <div class="bar2"><button class="pri" id="dshAdd">Codes einlesen</button><label>Datei (Text, JSON-Sicherung, QR-Bild)&nbsp;<input type="file" id="dshFile" multiple accept=".txt,.json,.csv,text/*,application/json,image/*" style="width:auto"></label><span id="dshMsg" class="msg" role="status"></span></div>
  <p class="mute" style="margin:6px 0 0">Kamera-Scan: Karte „Abgaben scannen“ weiter unten. Gescannte und eingefügte Codes landen automatisch in der gewählten Klasse.</p>
  <div id="dshBody"></div></section>`;
    const q = s => host.querySelector(s); let M = null;
    const body = q('#dshBody');
    function msg(t, err) { const m = q('#dshMsg'); m.textContent = t || ''; m.className = 'msg' + (err ? ' err' : ''); }
    const cls = () => STORE && core.getClass(STORE);
    const hide = () => STORE && STORE.settings.hide;
    const lbl = (key, name) => hide() ? 'Azubi ' + (1 + (M ? M.allKeys.indexOf(key) : 0)) : name;
    const G = () => ({ AUFGABEN: root.AUFGABEN, LAB_REG: root.LAB_REG, AUFGABEN_LABS: root.AUFGABEN_LABS });
    const applyRank = () => { const on = STORE && STORE.settings.rank; document.querySelectorAll('#rankCard,#duelCard').forEach(e => e.classList.toggle('dshoff', !on)); };

    function renderBar() {
      const c = cls(), opts = STORE.classes.map(x => `<option value="${esc(x.id)}"${c && x.id === c.id ? ' selected' : ''}>${esc(x.name)} (${Object.keys(core.studentsAt(x.records)).length})</option>`).join('');
      q('#dshCls').innerHTML = `<label>Klasse <select id="dshClass" aria-label="Klasse wählen">${opts || '<option value="">(noch keine Klasse)</option>'}</select></label>
        <input type="text" id="dshName" placeholder="Name der Klasse" maxlength="60" aria-label="Klassenname" value="">
        <button id="dshNew">Neue Klasse</button><button id="dshRen"${c ? '' : ' disabled'}>Umbenennen</button><button class="danger" id="dshDelC"${c ? '' : ' disabled'}>Klasse löschen</button><button class="danger" id="dshDelAll">Alles löschen</button>`;
    }
    function render() {
      if (!STORE) return; renderBar(); applyRank();
      const c = cls();
      if (!c) { body.innerHTML = '<p class="mute">Lege oben eine Klasse an (z. B. „ET 2026 A“). Dann Codes einlesen oder Abgaben scannen.</p>'; M = null; return; }
      M = core.model(c.records, G(), F);
      if (F.detail && !M.all[F.detail]) F.detail = null;
      const labsAll = core.catalog(G(), Object.keys(M.all).reduce((a, k) => a.concat(Object.keys(M.all[k].d)), [])).labs;
      const cats = []; labsAll.filter(l => F.lab === 'alle' || l.key === F.lab).forEach(l => l.tasks.forEach(t => { if (!cats.includes(t.cat)) cats.push(t.cat); }));
      const sel = (id, label, opts, val) => `<label>${label} <select id="${id}">${opts.map(o => `<option value="${esc(o[0])}"${o[0] === val ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
      let h = `<div class="bar2" role="group" aria-label="Filter und Sortierung">`
        + sel('fLab', 'Lab', [['alle', 'alle Labs']].concat(labsAll.map(l => [l.key, l.name])), F.lab)
        + sel('fCat', 'Kategorie', [['alle', 'alle Kategorien']].concat(cats.map(x => [x, x])), F.cat)
        + sel('fAz', 'Azubi', [['alle', 'alle Azubis']].concat(M.allKeys.map(k => [k, lbl(k, M.all[k].name)])), F.az)
        + sel('fSort', 'Sortierung', [['name', 'Name'], ['prog', 'Fortschritt'], ['avg', 'Durchschnitt'], ['solved', 'Gelöst'], ['last', 'Letzte Aktivität'], ['hints', 'Tipps'], ['exam', 'Prüfung']], F.sort)
        + `<button id="fDir" title="Reihenfolge umkehren" aria-label="Sortierrichtung">${F.dir > 0 ? '↑ aufsteigend' : '↓ absteigend'}</button>`
        + sel('fMode', 'Spalten', [['auto', 'automatisch'], ['lab', 'je Lab'], ['task', 'je Aufgabe']], F.mode)
        + `<label><input type="checkbox" id="fEmpty"${F.showEmpty ? ' checked' : ''}> auch ohne Ergebnis</label></div>
        <div class="bar2"><label><input type="checkbox" id="sRank"${STORE.settings.rank ? ' checked' : ''}> Rangliste anzeigen (aus = datenschutzfreundlich)</label><label><input type="checkbox" id="sHide"${STORE.settings.hide ? ' checked' : ''}> Namen ausblenden (Beamer)</label>
        <span style="flex:1"></span><button id="bCsv">CSV exportieren</button><button id="bJson">Klasse sichern (JSON)</button><button id="bPrint">Druckansicht</button></div>`;
      if (!M.rows.length) { body.innerHTML = h + '<p class="mute" style="margin-top:12px">Diese Klasse ist noch leer. Codes einfügen, Datei einlesen oder Abgaben scannen.</p>'; return; }
      h += `<div class="kpis"><div class="kpi"><b>${M.kpi.n}</b><span>Azubis</span></div><div class="kpi"><b>${M.kpi.prog} %</b><span>Ø Fortschritt (Labs mit Ergebnissen)</span></div><div class="kpi"><b>${M.kpi.solved}</b><span>gelöste Aufgaben (100 %)</span></div><div class="kpi"><b style="font-size:16px">${esc(fmtDT(M.kpi.last))}</b><span>letzte Aktivität</span></div></div>`;
      h += `<div class="scale">0 %<i></i>100 % &nbsp; grau: nicht bearbeitet</div>`;
      /* Tabelle */
      const th = (k, t, tip) => `<th class="srt" data-sort="${k}" title="${esc(tip || 'Sortieren')}">${t}${F.sort === k ? (F.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
      h += `<div class="tw"><table aria-label="Azubi mal Lab oder Aufgabe"><thead><tr><th class="name srt" data-sort="name">Azubi${F.sort === 'name' ? (F.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`
        + th('prog', 'Fortschritt', 'Mittelwert der Lab-Fortschritte') + th('solved', 'Gelöst') + th('avg', 'Ø %', 'Durchschnitt über bearbeitete Aufgaben') + th('last', 'Letzte Aktivität') + th('exam', 'Prüfung', 'Höchste erreichte Stufe im Prüfungs-Lab (nur aus den Aufgaben pr10 bis pr12 ableitbar)') + th('hints', 'Tipps', 'Summe der benutzten Tipp-Stufen')
        + (M.mode === 'lab' ? M.labsVis.map(l => `<th class="t" title="${esc(l.name + ' (' + l.tasks.length + ' Aufgaben)')}"><span>${esc(l.name)}</span></th>`).join('') : M.taskCols.map(t => { const l = M.cat.labs.find(x => x.key === t.lab); return `<th class="t" title="${esc((l ? l.name : '?') + ' · ' + t.cat + ' · ' + t.title)}"><span>${esc((l ? l.short : '?') + ': ' + t.title)}</span></th>`; }).join(''))
        + '</tr></thead><tbody>';
      M.rows.forEach(r => {
        h += `<tr><td class="name nm"><a data-det="${esc(r.key)}" tabindex="0" role="button">${esc(lbl(r.key, r.name))}</a></td><td class="pc" style="background:${core.color(r.prog)}">${r.prog} %</td><td>${r.st.solved}/${M.taskCols.length || M.labsVis.reduce((n, l) => n + l.tasks.length, 0)}</td><td>${r.st.avg == null ? '–' : r.st.avg}</td><td title="${esc(fmtDT(r.st.last))}">${esc(fmtD(r.st.last))}</td><td>${esc(r.exam.text)}</td><td>${r.st.hints}</td>`;
        if (M.mode === 'lab') h += M.labsVis.map(l => { const p = r.lp[l.key], any = l.tasks.some(t => r.s.d[t.id] != null); return any ? `<td class="pc" style="background:${core.color(p)}" title="${esc(l.name)}: ${p} %">${p}</td>` : '<td class="pc none"></td>'; }).join('');
        else h += M.taskCols.map(t => { const v = r.s.d[t.id]; return v == null ? '<td class="pc none"></td>' : `<td class="pc" style="background:${core.color(v)}" title="${esc(t.title)}: ${v} %${r.s.h[t.id] ? ', Tipp-Stufe ' + r.s.h[t.id] : ''}">${v}${r.s.h[t.id] ? '<sup>' + r.s.h[t.id] + '</sup>' : ''}</td>`; }).join('');
        h += '</tr>';
      });
      h += '</tbody>' + (M.mode === 'lab' ? `<tfoot><tr><td class="name">Klasse Ø</td><td></td><td></td><td></td><td></td><td></td><td></td>${M.colAvg.map(v => `<td>${v}</td>`).join('')}</tr></tfoot>` : '') + '</table></div>';
      /* Schwachstellen */
      const lname = k => (M.cat.labs.find(l => l.key === k) || { name: k }).name;
      h += '<h3>Schwachstellen der Klasse</h3>';
      h += M.weak.length ? M.weak.slice(0, 10).map(r => `<div class="wk"><span class="lb" title="${esc(lname(r.lab) + ' · ' + r.cat + ' · ' + r.title)}">${esc(r.title)} <span class="mute">(${esc(lname(r.lab))})</span></span><div class="bar" title="rot: nicht geschafft, gelb: noch ohne Versuch"><i class="r" style="width:${100 * r.notSolved / M.rows.length}%"></i><i class="y" style="width:${100 * r.notTried / M.rows.length}%"></i></div><span class="nm">${r.notSolved} von ${r.tried} nicht geschafft · ${r.attempts} Versuche${r.avgHint >= 1 ? ' · Ø Tipp ' + r.avgHint.toFixed(1).replace('.', ',') : ''}</span></div>`).join('') + '<p class="mute">Rot: bearbeitet, aber noch nicht 100 %. Gelb: noch nicht versucht. „Versuche“ = Abgaben mit neuem Stand.</p>' : '<p class="mute">Keine Schwachstellen erkennbar: alle bearbeiteten Aufgaben sind geschafft.</p>';
      if (M.topics.length) h += '<h3>Schwache Themen</h3>' + M.topics.slice(0, 6).map(x => `<div class="an"><b>${esc(x.cat)}</b> (${esc(lname(x.lab))}): ${x.notSolved} von ${x.tried} Bearbeitungen nicht geschafft (${Math.round(100 * x.fail)} %), ${x.attempts} Versuche, Ø ${x.avgPct} %</div>`).join('');
      /* Auffälligkeiten */
      h += '<h3>Aufgaben mit Auffälligkeiten</h3>';
      h += M.anom.length ? M.anom.slice(0, 30).map(a => `<div class="an"><b>${esc(lbl(a.key, a.name))}</b>${a.id && M.cat.byId[a.id] ? ' · ' + esc(M.cat.byId[a.id].title) : ''}: ${esc(a.text)}${a.ids ? ' (' + a.ids.map(i => esc(M.cat.byId[i] ? M.cat.byId[i].title : i)).join(', ') + ')' : ''}</div>`).join('') + (M.anom.length > 30 ? `<p class="mute">… und ${M.anom.length - 30} weitere (Details je Azubi)</p>` : '') + '<p class="mute">Nur Hinweise, kein Beweis: Der Code enthält keine Bearbeitungsdauer. Geprüft werden Tipp-Stufen und die Zeitabstände einzeln abgegebener Aufgaben.</p>' : '<p class="mute">Keine Auffälligkeiten in den vorhandenen Daten.</p>';
      /* Verlauf */
      h += '<h3>Verlauf über Zeit (Ø Fortschritt je Lab)</h3>' + chart(M.timeline);
      /* Rangliste */
      if (STORE.settings.rank) h += '<h3>Rangliste</h3><p class="mute">Punkte: je Aufgabe Prozent/10 minus Tipp-Stufe, 5 je Abzeichen, 3 je Duell. Nur mit Einverständnis der Klasse zeigen.</p>' + M.rank.map((r, i) => `<div class="wk"><span class="lb">${i + 1}. ${esc(lbl(r.key, r.name))}</span><div class="bar"><i style="background:var(--ok,#2fae45);width:${100 * r.score / Math.max(1, M.rank[0].score)}%"></i></div><span class="nm">${r.score} Punkte</span></div>`).join('');
      /* Detail */
      if (F.detail) h += detail(F.detail);
      body.innerHTML = h;
    }
    function chart(tl) {
      if (!tl.times.length || !tl.series.length) return '<p class="mute">Noch kein Verlauf: Die Codes enthalten keine Zeitangaben.</p>';
      const W = 640, Ht = 260, L = 38, R = 12, T = 12, B = 34, n = tl.times.length, x = i => L + (n === 1 ? (W - L - R) / 2 : (W - L - R) * i / (n - 1)), y = v => T + (Ht - T - B) * (1 - v / 100);
      const span = tl.times[n - 1] - tl.times[0], fmt = t => span < 2 * DAY ? fmtDT(t).slice(0, 16).replace(/^(\d\d\.\d\d)\.\d{4}/, '$1.') : fmtD(t).slice(0, 6);
      let s = `<svg class="ch" viewBox="0 0 ${W} ${Ht}" role="img" aria-label="Verlauf des Durchschnittsfortschritts je Lab">`;
      [0, 25, 50, 75, 100].forEach(v => { s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" stroke-opacity=".15"/><text x="${L - 5}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="currentColor" fill-opacity=".7">${v}</text>`; });
      const ticks = n <= 5 ? tl.times.map((t, i) => i) : [0, Math.round((n - 1) / 3), Math.round(2 * (n - 1) / 3), n - 1];
      ticks.forEach(i => { s += `<text x="${x(i)}" y="${Ht - 14}" font-size="11" text-anchor="${i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}" fill="currentColor" fill-opacity=".7">${esc(fmt(tl.times[i]))}</text>`; });
      tl.series.forEach((se, k) => {
        const col = PAL[k % PAL.length], dash = k >= PAL.length ? ' stroke-dasharray="5 3"' : '';
        s += `<polyline fill="none" stroke="${col}" stroke-width="2.2"${dash} points="${se.values.map((v, i) => x(i) + ',' + y(v)).join(' ')}"/>`;
        se.values.forEach((v, i) => { if (n <= 24 || i === n - 1) s += `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${col}"><title>${esc(se.name)}, ${esc(fmtDT(tl.times[i]))}: ${v} %</title></circle>`; });
      });
      return s + '</svg><div class="lg">' + tl.series.map((se, k) => `<span><b style="background:${PAL[k % PAL.length]}"></b>${esc(se.name)} (${se.values[se.values.length - 1]} %)</span>`).join('') + '</div>';
    }
    function detail(key) {
      const s = M.all[key], tasks = M.cat.tasks, exam = core.examLevel(s), an = M.anom.filter(a => a.key === key), st = core.studentStats(s, tasks.filter(t => s.d[t.id] != null));
      let h = `<div class="det" id="dshDet"><div class="bar2" style="margin:0"><h3 style="margin:0;flex:1">${esc(lbl(key, s.name))}</h3><label><input type="checkbox" id="dAll"${F.detailAll ? ' checked' : ''}> auch Aufgaben ohne Ergebnis</label><button id="dClose">Schließen</button><button class="danger" id="dDel">Azubi aus Klasse entfernen</button></div>
        <div class="kpis"><div class="kpi"><b>${st.solved} / ${st.tried}</b><span>gelöst / bearbeitet</span></div><div class="kpi"><b>${st.avg == null ? '–' : st.avg + ' %'}</b><span>Durchschnitt</span></div><div class="kpi"><b style="font-size:16px">${esc(fmtDT(s.t))}</b><span>letzte Aktivität</span></div><div class="kpi"><b>${esc(exam.text)}</b><span>Prüfungs-Lab</span></div><div class="kpi"><b>${st.hints}</b><span>Tipp-Stufen gesamt</span></div><div class="kpi"><b>${s.b.length}</b><span>Abzeichen</span></div></div>`;
      if (an.length) h += an.map(a => `<div class="an">${a.id && M.cat.byId[a.id] ? '<b>' + esc(M.cat.byId[a.id].title) + '</b>: ' : ''}${esc(a.text)}</div>`).join('');
      M.cat.labs.forEach(l => {
        const ts = l.tasks.filter(t => F.detailAll || s.d[t.id] != null); if (!ts.length) return;
        h += `<h3>${esc(l.name)} · ${core.labProgress(s, l.tasks)} %</h3><div class="tw" style="max-height:none"><table style="width:100%"><thead><tr><th class="name">Aufgabe</th><th>Kategorie</th><th>Prozent</th><th>Tipp</th><th>Datum</th></tr></thead><tbody>`
          + ts.map(t => { const v = s.d[t.id]; return `<tr><td class="name" style="white-space:normal">${esc(t.title)}</td><td>${esc(t.cat)}</td>${v == null ? '<td class="pc none">–</td>' : `<td class="pc" style="background:${core.color(v)}">${v} % <span class="pbar"><i style="width:${v}%;background:#2fae45"></i></span></td>`}<td>${s.h[t.id] || ''}</td><td>${v == null ? '' : esc(fmtDT(s.at[t.id]))}</td></tr>`; }).join('') + '</tbody></table></div>';
      });
      return h + '<p class="mute">Datum = Zeitpunkt des Codes, mit dem der beste Stand ankam.</p></div>';
    }
    /* Druckansicht ohne Bedienelemente */
    function printHtml() {
      const c = cls(), lname = k => (M.cat.labs.find(l => l.key === k) || { name: k }).name, pm = M.mode === 'task' && M.taskCols.length > 40 ? 'lab' : M.mode;
      let h = `<h1>Klassenübersicht: ${esc(c.name)}</h1><div class="small">Tonfunk Lab · Stand ${esc(fmtDT(Date.now()))} · ${M.kpi.n} Azubis · Ø Fortschritt ${M.kpi.prog} %${M.f.lab !== 'alle' ? ' · Lab: ' + esc(lname(M.f.lab)) : ''}${M.f.cat !== 'alle' ? ' · Kategorie: ' + esc(M.f.cat) : ''}</div>`;
      h += '<h2>Azubi × ' + (pm === 'lab' ? 'Labs' : 'Aufgaben') + '</h2><table><thead><tr><th class="l">Azubi</th><th>Fortschritt</th><th>Gelöst</th><th>Ø %</th><th>Letzte Aktivität</th><th>Prüfung</th>' + (pm === 'lab' ? M.labsVis.map(l => `<th>${esc(l.short)}</th>`).join('') : M.taskCols.map(t => `<th title="${esc(t.title)}">${esc(t.title.slice(0, 14))}</th>`).join('')) + '</tr></thead><tbody>';
      M.rows.forEach(r => { h += `<tr><td class="l">${esc(lbl(r.key, r.name))}</td><td class="pc" style="background:${core.color(r.prog)}">${r.prog} %</td><td>${r.st.solved}</td><td>${r.st.avg == null ? '–' : r.st.avg}</td><td>${esc(fmtD(r.st.last))}</td><td>${esc(r.exam.text)}</td>`
        + (pm === 'lab' ? M.labsVis.map(l => { const any = l.tasks.some(t => r.s.d[t.id] != null); return `<td class="pc"${any ? ` style="background:${core.color(r.lp[l.key])}"` : ''}>${any ? r.lp[l.key] : ''}</td>`; }).join('') : M.taskCols.map(t => { const v = r.s.d[t.id]; return `<td class="pc"${v == null ? '' : ` style="background:${core.color(v)}"`}>${v == null ? '' : v}</td>`; }).join('')) + '</tr>'; });
      h += '</tbody></table>';
      h += '<h2>Schwachstellen der Klasse</h2>' + (M.weak.length ? '<ol>' + M.weak.slice(0, 8).map(r => `<li>${esc(r.title)} (${esc(lname(r.lab))}): ${r.notSolved} von ${r.tried} nicht geschafft, ${r.attempts} Versuche</li>`).join('') + '</ol>' : '<div class="small">Keine.</div>');
      if (M.anom.length) h += '<h2>Aufgaben mit Auffälligkeiten</h2><ul>' + M.anom.slice(0, 20).map(a => `<li>${esc(lbl(a.key, a.name))}${a.id && M.cat.byId[a.id] ? ' · ' + esc(M.cat.byId[a.id].title) : ''}: ${esc(a.text)}</li>`).join('') + '</ul>';
      if (STORE.settings.rank) h += '<h2>Rangliste</h2><ol>' + M.rank.map(r => `<li>${esc(lbl(r.key, r.name))}: ${r.score} Punkte</li>`).join('') + '</ol>';
      return h;
    }
    function print() {
      if (!M || !M.rows.length) { msg('Nichts zu drucken', true); return; }
      let p = document.getElementById('dashPrint'); if (!p) { p = document.createElement('div'); p.id = 'dashPrint'; document.body.appendChild(p); }
      p.innerHTML = printHtml(); document.body.classList.add('printdash');
      const done = () => { document.body.classList.remove('printdash'); p.innerHTML = ''; window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done); setTimeout(() => window.print(), 80);
    }
    function download(name, text, mime, bom) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([(bom ? '﻿' : '') + text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
    const slug = s => String(s).replace(/[^\w\-]+/g, '_').slice(0, 40) || 'klasse';
    const day = () => new Date().toISOString().slice(0, 10);
    const run = (p, ok) => p.then(r => { if (ok) msg(ok(r)); return r; }).catch(e => msg(String(e.message || e), true));
    function ingest(recsP) {
      return run(recsP.then(recs => ensure().then(() => {
        if (!recs.length) throw new Error('Kein gültiger Code gefunden');
        let c = cls(); if (!c) { core.addClass(STORE, 'Meine Klasse'); c = cls(); }
        const r = core.feed(STORE, c.id, recs); return persist().then(() => { render(); return r; });
      })), r => r.added + ' neue(r) Datensatz/Datensätze übernommen' + (r.dups ? ', ' + r.dups + ' schon vorhanden' : ''));
    }
    host.addEventListener('click', e => {
      const t = e.target, id = t.id, b = t.closest && t.closest('[data-det],[data-sort]');
      if (b && b.dataset.det) { F.detail = b.dataset.det; render(); const d = host.querySelector('#dshDet'); if (d && d.scrollIntoView) d.scrollIntoView({ block: 'nearest' }); return; }
      if (b && b.dataset.sort) { const k = b.dataset.sort; if (F.sort === k) F.dir = -F.dir; else { F.sort = k; F.dir = (k === 'name' || k === 'exam') ? 1 : -1; if (k === 'name') F.dir = 1; } render(); return; }
      if (id === 'dshAdd') { const v = q('#dshTxt').value; ingest(Dash.source.import(v)).then(r => { if (r && r.added != null) q('#dshTxt').value = ''; }); }
      else if (id === 'dshNew') { const nm = q('#dshName').value; ensure().then(() => { if (!core.addClass(STORE, nm)) { msg('Bitte einen Klassennamen eintragen', true); return; } F.detail = null; F.az = 'alle'; run(persist().then(render), () => 'Klasse angelegt'); }); }
      else if (id === 'dshRen') { if (core.renameClass(STORE, null, q('#dshName').value)) run(persist().then(render), () => 'Umbenannt'); else msg('Bitte einen neuen Namen eintragen', true); }
      else if (id === 'dshDelC') { const c = cls(); if (c && confirm('Klasse „' + c.name + '“ mit allen Daten aus diesem Browser löschen?')) { F.detail = null; F.az = 'alle'; run(Dash.source.clear(c.id).then(() => { core.removeClass(STORE, c.id); render(); }), () => 'Klasse gelöscht'); } }
      else if (id === 'dshDelAll') { if (confirm('ALLE Klassen und alle gesammelten Ergebnisse aus diesem Browser löschen?')) { F.detail = null; F.az = 'alle'; run(Dash.source.clear().then(() => { STORE = core.newStore(); ['ausw.data', 'ausw.base'].forEach(k => { try { root.localStorage.removeItem(k); } catch (x) {} }); render(); if (root.render) try { root.render(); } catch (x) {} }), () => 'Alles gelöscht'); } }
      else if (id === 'fDir') { F.dir = -F.dir; render(); }
      else if (id === 'bCsv') { if (!M || !M.rows.length) { msg('Nichts zu exportieren', true); return; } download('Klasse-' + slug(cls().name) + '-' + day() + '.csv', core.csv(M, cls().name), 'text/csv;charset=utf-8', true); msg('CSV erstellt'); }
      else if (id === 'bJson') { const c = cls(); if (!c) return; download('Sicherung-' + slug(c.name) + '-' + day() + '.json', core.backupJson(c), 'application/json'); msg('Sicherung erstellt (enthält Namen und Ergebnisse)'); }
      else if (id === 'bPrint') print();
      else if (id === 'dClose') { F.detail = null; render(); }
      else if (id === 'dDel') { const s = M.all[F.detail]; if (s && confirm(s.name + ' mit allen Ergebnissen aus dieser Klasse entfernen?')) { core.removeStudent(STORE, cls().id, F.detail); F.detail = null; F.az = 'alle'; run(persist().then(render), () => 'Azubi entfernt'); } }
    });
    host.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.det) { e.preventDefault(); e.target.click(); } });
    host.addEventListener('change', e => {
      const t = e.target, id = t.id;
      if (id === 'dshClass') { STORE.active = t.value; F.detail = null; F.az = 'alle'; F.lab = 'alle'; F.cat = 'alle'; run(persist().then(render)); }
      else if (id === 'dshFile') { const fs = Array.from(t.files || []); if (!fs.length) return; ingest(Promise.all(fs.map(f => Dash.source.import(f))).then(a => [].concat.apply([], a))); t.value = ''; }
      else if (id === 'fLab') { F.lab = t.value; F.cat = 'alle'; render(); }
      else if (id === 'fCat') { F.cat = t.value; render(); }
      else if (id === 'fAz') { F.az = t.value; render(); }
      else if (id === 'fSort') { F.sort = t.value; render(); }
      else if (id === 'fMode') { F.mode = t.value; render(); }
      else if (id === 'fEmpty') { F.showEmpty = t.checked; render(); }
      else if (id === 'dAll') { F.detailAll = t.checked; render(); }
      else if (id === 'sRank') { STORE.settings.rank = t.checked; run(persist().then(render)); }
      else if (id === 'sHide') { STORE.settings.hide = t.checked; run(persist().then(render)); }
    });
    return {
      reload() { return Dash.source.list().then(s => { STORE = core.normalizeStore(s); render(); }).catch(e => { body.innerHTML = '<p class="msg err">' + esc(e.message || e) + '</p>'; }); },
      refresh() { render(); }, msg, print, state: () => ({ F, M, STORE }), setFilter(o) { Object.assign(F, o); render(); }
    };
  }
  Dash.ui = () => UI;
  Dash.loadJsQR = loadJsQR; Dash.prepareScanner = prepareScanner;
  root.Dash = Dash;
  if (typeof module !== 'undefined' && module.exports) module.exports = Dash;
})(typeof window !== 'undefined' ? window : globalThis);
