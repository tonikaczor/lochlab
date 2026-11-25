'use strict';
/* Tonfunk Lab: blaue Karte "Weitermachen" der Ansicht Start (SPEC-STARTSEITE-FABLE.md, Abschnitt 6.2; Umbau S1: ein Schritt, Ring, Rang als kleine Zeile, dazu "Zuletzt geöffnet").
   Reihenfolge der Quellen: 1) lm4.last (von design.js geschrieben: Datei, Aufgabe, Zeit), 2) letzter Eintrag in sim.results (nur Labs mit Schaltplan-Kern),
   3) Empfehlung des Lernpfads (Lernpfad.recommend), bei völlig leerem Speicher: SchaltLab mit Einführung. resolve() ist reine Logik und wird in Node getestet.
   Mit bekanntem Lehrjahr (Paket L2, nur Berufe mit Datenlage) führt die Empfehlung nur durch den Teil jedes Labs bis zum eigenen Lehrjahr; ist er geschafft, zeigt die Karte "Dein N. Lehrjahr ist geschafft"
   mit dem Angebot, schon ins nächste Lehrjahr zu schauen (recommend().fertigLj). Der Ring bleibt der Gesamtfortschritt. */
(function (root) {
  const short = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  function relTime(t, now) {
    if (!t || !now) return '';
    const m = Math.floor((now - t) / 60000); if (m < 0) return '';
    if (m < 2) return 'gerade eben';
    if (m < 60) return 'vor ' + m + ' Minuten';
    const h = Math.floor(m / 60); if (h < 24) return h === 1 ? 'vor 1 Stunde' : 'vor ' + h + ' Stunden';
    const d = Math.floor(h / 24); if (d === 1) return 'gestern'; if (d < 14) return 'vor ' + d + ' Tagen';
    const w = Math.floor(d / 7); if (w < 9) return 'vor ' + w + ' Wochen';
    const mo = Math.floor(d / 30); return mo <= 1 ? 'vor 1 Monat' : 'vor ' + mo + ' Monaten';
  }
  // env: { get(key, default), REG, ROWS, stat(labKey), recommend(), now, beruf (optional) }
  function resolve(env) {
    const get = env.get, REG = env.REG || {}, ROWS = env.ROWS || [], now = env.now || 0;
    const res = {}; [get('sim.done', {}), get('lm4.tdone', {})].forEach(o => { if (o && typeof o === 'object') Object.keys(o).forEach(k => { const v = +o[k] || 0; if (v > (res[k] || 0)) res[k] = v; }); });
    const keyOfFile = f => Object.keys(REG).find(k => REG[k].file === f) || null;
    const rowOf = id => id ? ROWS.find(r => r[0] === id) : null;
    let key = null, task = '', t = 0, src = '';
    /* Der Lernpfad führt: gibt es eine offene Station im Pfad, zeigt die blaue Karte dorthin. Das zuletzt geöffnete Lab steht weiter in "Zuletzt geöffnet". */
    const rcP = env.recommend ? env.recommend() : null, pfad = !!(rcP && ((rcP.rec && REG[rcP.rec]) || (rcP.fertigLj && REG[rcP.fertigLj.key])));
    const L = get('lm4.last', null);
    if (!pfad && L && typeof L === 'object' && typeof L.file === 'string' && keyOfFile(L.file)) { key = keyOfFile(L.file); task = typeof L.task === 'string' ? L.task : ''; t = +L.t || 0; src = 'last'; }
    if (!key && !pfad) {
      const arr = get('sim.results', []);
      if (Array.isArray(arr)) { for (let i = arr.length - 1; i >= 0; i--) { const e = arr[i], r = e && rowOf(e.task); if (r && REG[r[1]]) { key = r[1]; task = r[0]; t = +e.t || 0; src = 'results'; break; } } }
    }
    if (key) {
      let row = rowOf(task); if (row && row[1] !== key && REG[row[1]]) key = row[1];
      if (row && row[1] !== key) row = null;
      const R = REG[key], when = relTime(t, now);
      let href = R.file, title = '';
      if (!R.hub && row) {
        if ((res[task] || 0) < 100) { href = R.file + '?aufgabe=' + task; title = row[3]; }
        else { const nx = (env.stat ? env.stat(key) : {}).next; if (nx) { href = R.file + '?aufgabe=' + nx[0]; title = nx[3]; } }
      }
      const sub = [R.name, short(title, 40), when].filter(Boolean).join(' · ');
      return { src, key, href, label: 'Weitermachen', sub, name: R.name, title, when };
    }
    const rc = rcP;
    if (rc && rc.fertigLj && REG[rc.fertigLj.key]) {   // Lehrjahr geschafft: Angebot fürs nächste Lehrjahr (nichts ist gesperrt)
      const f = rc.fertigLj;
      return { src: 'lehrjahr', key: f.key, href: f.href, label: 'Dein ' + rc.lj + '. Lehrjahr ist geschafft', sub: 'Schau schon ins ' + f.lj + '. Lehrjahr: ' + [f.name, short(f.title, 40)].filter(Boolean).join(' · '), name: f.name, title: f.title || '', when: '' };
    }
    const any = Object.keys(res).length > 0 || Object.keys(get('lm4.trainer', {}) || {}).length > 0;
    if (rc && rc.rec && (any || rc.started)) {
      const R = REG[rc.rec];
      if (rc.started) { const title = rc.next ? rc.next[3] : ''; return { src: 'rec', key: rc.rec, href: rc.href, label: 'Weitermachen', sub: [R.name, rc.teilKurz, short(title, 40)].filter(Boolean).join(' · '), name: R.name, title, when: '' }; }
      return { src: 'rec', key: rc.rec, href: rc.href, label: 'Starten', sub: rc.teilText ? R.name + ' · ' + rc.teilText : R.name + ' (Einführung)', name: R.name, title: '', when: '' };
    }
    /* Beruf ohne SchaltLab (die Wege tec/stu/wing/winf und Berufe ohne dieses Lab): bei leerem Speicher der erste Schritt des eigenen Lernpfads statt SchaltLab (env.beruf; ohne Angabe gilt das alte Verhalten) */
    const inB = r => !env.beruf || !r || !Array.isArray(r.beruf) || r.beruf.indexOf(env.beruf) >= 0;
    if (!any && !inB(REG.sch) && rc && rc.rec && REG[rc.rec]) { const R0 = REG[rc.rec]; return { src: 'start', key: rc.rec, href: rc.href || (R0.file + '?trainer'), label: 'Starten', sub: rc.teilText ? R0.name + ' · ' + rc.teilText : R0.name + ' (Einführung)', name: R0.name, title: '', when: '' }; }
    if (!any && REG.sch && inB(REG.sch)) return { src: 'leer', key: 'sch', href: REG.sch.file + '?trainer', label: 'Starten', sub: rc && rc.teilText && rc.rec === 'sch' ? REG.sch.name + ' · ' + rc.teilText : REG.sch.name + ' (Einführung)', name: REG.sch.name, title: '', when: '' };
    const pk = REG.pr && inB(REG.pr) ? 'pr' : REG.sch && inB(REG.sch) ? 'sch' : (Object.keys(REG).find(k => !REG[k].hub && inB(REG[k])) || (REG.pr ? 'pr' : 'sch'));
    const P = REG[pk] || { name: 'Prüfungs-Lab', file: 'pruefungslab.html' };
    return { src: 'fertig', key: pk, href: P.file, label: 'Wiederholen', sub: P.name + ' (alle Aufgaben erledigt)', name: P.name, title: '', when: '' };
  }
  /* Zuletzt geöffnet (Ansicht Start): Labs nach der jüngsten Spur in lm4.last (Datei), lm4.when (Aufgabe) und sim.results (Aufgabe), ohne Hubs und ohne das Lab der blauen Karte.
     env: { get, REG, ROWS, now, ohne (Lab-Schlüssel), n (Anzahl, Standard 3), hat(labKey) optional: gehört zum Beruf } -> [{ key, name, file, t, when }] */
  function zuletzt(env) {
    const get = env.get, REG = env.REG || {}, ROWS = env.ROWS || [], n = env.n || 3, t = {};
    const labOf = {}; ROWS.forEach(r => { labOf[r[0]] = r[1]; });
    const add = (k, ms) => { ms = +ms || 0; if (!k || !REG[k] || REG[k].hub || !ms) return; if (ms > (t[k] || 0)) t[k] = ms; };
    const L = get('lm4.last', null); if (L && typeof L === 'object' && typeof L.file === 'string') add(Object.keys(REG).find(k => REG[k].file === L.file), L.t);
    const W = get('lm4.when', {}); if (W && typeof W === 'object' && !Array.isArray(W)) Object.keys(W).forEach(id => add(labOf[id], W[id]));
    const S = get('sim.results', []); if (Array.isArray(S)) S.forEach(e => { if (e && typeof e === 'object') add(labOf[e.task], e.t); });
    return Object.keys(t).filter(k => k !== env.ohne && (!env.hat || env.hat(k))).sort((a, b) => t[b] - t[a]).slice(0, n)
      .map(k => ({ key: k, name: REG[k].name, file: REG[k].file, t: t[k], when: relTime(t[k], env.now || 0) }));
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (typeof module === 'object' && module.exports) module.exports = { resolve, relTime, short, zuletzt };
  if (typeof document === 'undefined') return;
  const doc = document;
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  /* Blaue Karte der Ansicht Start: genau ein nächster Schritt, Fortschrittsring (Anteil gelöster Aufgaben der Labs des Berufs), Rang als kleine Zeile (erst ab dem ersten XP) */
  function render() {
    const a = doc.getElementById('contGo'); if (!a) return;
    const LP = root.Lernpfad;
    let r; try { r = resolve({ get, REG: root.LAB_REG, ROWS: root.AUFGABEN, stat: LP && LP.stat, recommend: LP && LP.recommend, now: Date.now(), beruf: (root.BerufReg && root.BerufReg.cur && root.BerufReg.cur()) || undefined }); } catch (e) { return; }
    a.href = r.href; HC.letzterKey = r.key || '';
    let pct = 0, rk = '';
    try { const ks = Object.keys(root.LAB_REG || {}).filter(k => !root.LAB_REG[k].hub && (!root.BerufReg || root.BerufReg.has(k))); let n = 0, d = 0; ks.forEach(k => { const s = LP.stat(k); n += s.n; d += s.d; }); pct = n ? Math.round(100 * d / n) : 0; } catch (e) { pct = 0; }
    try { const K = root.Karriere && root.Karriere.summary && root.Karriere.summary(); if (K && K.n && K.xp > 0) rk = 'Rang ' + K.n + (K.t ? ' · ' + K.t : ''); } catch (e) { rk = ''; }
    a.innerHTML = '<span class="ring" aria-hidden="true"><svg viewBox="0 0 44 44"><circle class="rt" cx="22" cy="22" r="19"/>' + (pct > 0 ? '<circle class="rf" cx="22" cy="22" r="19" pathLength="100" stroke-dasharray="' + pct + ' 100"/>' : '') + '</svg><i>' + pct + '&nbsp;%</i></span><span class="tx"><b>' + esc(r.label) + '</b><small>' + esc(r.sub) + '</small>' + (rk ? '<span class="rk">' + esc(rk) + '</span>' : '') + '</span><span class="pill" aria-hidden="true">▶</span>';
    a.setAttribute('aria-label', r.label + ': ' + r.sub + (pct ? ', ' + pct + ' Prozent geschafft' : '') + (rk ? ', ' + rk : ''));
  }
  /* Hinweis "Lernstand scheint zu fehlen" (früher als Coach-Karte in #top; S3): gleiche Bedingung wie die frühere Lernempfehlung (Kürzel gesetzt, aber keine erledigte Aufgabe und kein Prüfungsthema im Speicher).
     Schlichte Zeile unter der blauen Karte, mit Knopf zu "Lernstand laden" (#lsOpen, Ansicht Ich). */
  function lsFehlt() {
    let k = ''; try { k = localStorage.getItem('lm4.kuerzel') || ''; } catch (e) { k = ''; }
    if (typeof k !== 'string' || !k) return false;
    const isObj = o => o && typeof o === 'object' && !Array.isArray(o), fin = v => v != null && v !== '' && isFinite(+v);
    let n = 0;
    ['sim.done', 'lm4.tdone'].forEach(key => { const o = get(key, {}); if (isObj(o)) Object.keys(o).forEach(id => { if (fin(o[id])) n++; }); });
    const ps = get('pr.state', {}), tr = isObj(ps) && isObj(ps.tr) ? ps.tr : {};
    Object.keys(tr).forEach(id => { const t = tr[id]; if (isObj(t) && fin(t.r) && fin(t.n) && +t.n > 0 && +t.r >= 0) n++; });
    return n === 0;
  }
  /* Zeile unter der blauen Karte: ab 80 % in der aktuellen Pfadstation darf man schon ins nächste Lab wechseln (Lernpfad.recommend().weiter). Der Pfad selbst bleibt bis 100 % bei der Station. */
  function pfadWeiter() {
    const top = doc.getElementById('top'); if (!top || !top.parentNode) return;
    let w = null; try { const rc = root.Lernpfad && root.Lernpfad.recommend && root.Lernpfad.recommend(); w = rc && rc.weiter || null; } catch (e) { w = null; }
    let h = doc.getElementById('pfWeiter');
    if (!w) { if (h) h.remove(); return; }
    if (!h) { h = doc.createElement('p'); h.id = 'pfWeiter'; h.className = 'lsfehlt pfweiter'; top.insertAdjacentElement('afterend', h); }
    h.innerHTML = '<span class="lsf-t">' + esc(w.vonName) + (w.lj ? ': Dein Teil für das ' + w.lj + '. Lehrjahr ist zu ' : ' ist zu ') + w.pct + '&nbsp;% geschafft. Du kannst schon ins ' + esc(w.name) + ' wechseln. Für alle Orden brauchst du aber 100&nbsp;%.</span><a class="pfw-a" href="' + esc(w.href) + '">' + esc(w.name) + ' öffnen</a>';
  }
  function hinweis() {
    const top = doc.getElementById('top'); if (!top || !top.parentNode) return;
    let h = doc.getElementById('lsFehlt'), an = false;
    try { an = lsFehlt(); } catch (e) { an = false; }
    if (!an) { if (h) h.remove(); return; }
    if (h) return;
    h = doc.createElement('p'); h.id = 'lsFehlt'; h.className = 'lsfehlt'; h.setAttribute('role', 'status');
    h.innerHTML = '<span class="lsf-t">Neu hier? Dann leg einfach los. Hast du schon auf einem anderen Gerät geübt? Dann hol deinen Stand mit „Lernstand laden“.</span><button type="button" id="lsFehltBtn">Lernstand laden</button>';
    h.querySelector('button').onclick = () => { const x = doc.getElementById('lsOpen'); if (x) x.click(); else if (root.Lernstand && root.Lernstand.open) root.Lernstand.open(); };
    top.insertAdjacentElement('afterend', h);
  }
  const HC = root.HomeCont = { render, resolve, zuletzt, letzterKey: '', hinweis, lsFehlt };
  render(); hinweis(); pfadWeiter();
  root.addEventListener('pageshow', e => { if (e.persisted) { render(); hinweis(); pfadWeiter(); } });
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) { render(); hinweis(); pfadWeiter(); } });
  root.addEventListener('lernpfad:fertig', () => { render(); pfadWeiter(); });
})(typeof window !== 'undefined' ? window : this);
