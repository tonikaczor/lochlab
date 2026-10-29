'use strict';
/* Tonfunk Lab: Knopf "Weitermachen" auf der Startseite (SPEC-STARTSEITE-FABLE.md, Abschnitt 6.2).
   Reihenfolge der Quellen: 1) lm4.last (von design.js geschrieben: Datei, Aufgabe, Zeit), 2) letzter Eintrag in sim.results (nur Labs mit Schaltplan-Kern),
   3) Empfehlung des Lernpfads (Lernpfad.recommend), bei völlig leerem Speicher: SchaltLab mit Einführung. resolve() ist reine Logik und wird in Node getestet. */
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
  // env: { get(key, default), REG, ROWS, stat(labKey), recommend(), now }
  function resolve(env) {
    const get = env.get, REG = env.REG || {}, ROWS = env.ROWS || [], now = env.now || 0;
    const res = {}; [get('sim.done', {}), get('lm4.tdone', {})].forEach(o => { if (o && typeof o === 'object') Object.keys(o).forEach(k => { const v = +o[k] || 0; if (v > (res[k] || 0)) res[k] = v; }); });
    const keyOfFile = f => Object.keys(REG).find(k => REG[k].file === f) || null;
    const rowOf = id => id ? ROWS.find(r => r[0] === id) : null;
    let key = null, task = '', t = 0, src = '';
    const L = get('lm4.last', null);
    if (L && typeof L === 'object' && typeof L.file === 'string' && keyOfFile(L.file)) { key = keyOfFile(L.file); task = typeof L.task === 'string' ? L.task : ''; t = +L.t || 0; src = 'last'; }
    if (!key) {
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
    const rc = env.recommend ? env.recommend() : null;
    const any = Object.keys(res).length > 0 || Object.keys(get('lm4.trainer', {}) || {}).length > 0;
    if (rc && rc.rec && (any || rc.started)) {
      const R = REG[rc.rec];
      if (rc.started) { const title = rc.next ? rc.next[3] : ''; return { src: 'rec', key: rc.rec, href: rc.href, label: 'Weitermachen', sub: [R.name, short(title, 40)].filter(Boolean).join(' · '), name: R.name, title, when: '' }; }
      return { src: 'rec', key: rc.rec, href: rc.href, label: 'Starten', sub: R.name + ' (Einführung)', name: R.name, title: '', when: '' };
    }
    if (!any && REG.sch) return { src: 'leer', key: 'sch', href: REG.sch.file + '?trainer', label: 'Starten', sub: REG.sch.name + ' (Einführung)', name: REG.sch.name, title: '', when: '' };
    const P = REG.pr || REG.sch || { name: 'Prüfungs-Lab', file: 'pruefungslab.html' };
    return { src: 'fertig', key: REG.pr ? 'pr' : 'sch', href: P.file, label: 'Wiederholen', sub: P.name + ' (alle Aufgaben erledigt)', name: P.name, title: '', when: '' };
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (typeof module === 'object' && module.exports) module.exports = { resolve, relTime, short };
  if (typeof document === 'undefined') return;
  const doc = document;
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  function render() {
    const a = doc.getElementById('contGo'); if (!a) return;
    const LP = root.Lernpfad;
    let r; try { r = resolve({ get, REG: root.LAB_REG, ROWS: root.AUFGABEN, stat: LP && LP.stat, recommend: LP && LP.recommend, now: Date.now() }); } catch (e) { return; }
    a.href = r.href;
    // Hero (Werkbank): Fortschrittsring (Anteil erledigter Aufgaben über alle Labs), Rang aus Karriere.summary(); alles nur Anzeige, resolve() bleibt unberührt
    let pct = 0, rk = '';
    try { const ks = Object.keys(root.LAB_REG || {}).filter(k => !root.LAB_REG[k].hub); let n = 0, d = 0; ks.forEach(k => { const s = LP.stat(k); n += s.n; d += s.d; }); pct = n ? Math.round(100 * d / n) : 0; } catch (e) { pct = 0; }
    try { const K = root.Karriere && root.Karriere.summary && root.Karriere.summary(); if (K && K.n) rk = 'Rang ' + K.n + (K.t ? ' · ' + K.t : ''); } catch (e) { rk = ''; }
    a.innerHTML = '<span class="ring" aria-hidden="true"><svg viewBox="0 0 44 44"><circle class="rt" cx="22" cy="22" r="19"/>' + (pct > 0 ? '<circle class="rf" cx="22" cy="22" r="19" pathLength="100" stroke-dasharray="' + pct + ' 100"/>' : '') + '</svg><i>' + pct + '&nbsp;%</i></span><span class="tx">' + (rk ? '<span class="rk">' + esc(rk) + '</span>' : '') + '<b>' + esc(r.label) + '</b><small>' + esc(r.sub) + '</small></span><span class="pill" aria-hidden="true">▶</span>';
    a.setAttribute('aria-label', r.label + ': ' + r.sub);
    // Handy: Bereich des Labs beim ersten Besuch offen halten
    const REG = root.LAB_REG || {}, f = REG[r.key] && REG[r.key].file;
    if (f && root.HomeGroups) {
      const card = Array.from(doc.querySelectorAll('.card')).find(c => { const b = c.querySelector('.btns a'); return b && (b.getAttribute('href') || '').split('?')[0] === f; });
      const g = card && root.HomeGroups.groupOf(card); if (g) root.HomeGroups.wantOpen(g);
    }
  }
  /* Karte „Was übe ich als Nächstes?“ (coach.js, SPEC-PRUEFUNG-COACH-FABLE.md Teil B) im Primär-Band #top. coach.js wird erst hier nachgeladen; ohne die Datei oder bei einem Fehler bleibt die Startseite wie sie ist.
     Reihenfolge im Band (= Tab-Reihenfolge = Bildschirmreihenfolge der Werkbank): Weitermachen, Heute (Coach, Duell-Zeile), Lernpfad-Kopf. */
  function arrange() {
    const top = doc.getElementById('top'); if (!top) return;
    const lp = doc.getElementById('lernpfad'), ref = lp && lp.parentNode === top ? lp : null;
    const co = top.querySelector(':scope > section.coach'), du = doc.getElementById('duellBand'), want = [co, du].filter(Boolean);
    want.forEach(x => { if (!(x.parentNode === top && (!ref || (x.compareDocumentPosition(ref) & 4)))) top.insertBefore(x, ref); });
    if (co && du && !(co.compareDocumentPosition(du) & 4)) top.insertBefore(co, du);
  }
  function coachCard() {
    const top = doc.getElementById('top'); if (!top) return;
    const go = () => { try { const sec = root.Coach && root.Coach.mount(top); if (sec) { const last = () => arrange(); last(); root.addEventListener('load', last); setTimeout(last, 800); } } catch (e) {} };   // Karte steht im Band hinter dem Weitermachen-Knopf, vor dem Lernpfad
    if (root.Coach) { go(); return; }
    if (doc.getElementById('coachJs')) return;
    try { const sc = doc.createElement('script'); sc.id = 'coachJs'; sc.src = 'coach.js'; sc.onload = go; doc.head.appendChild(sc); } catch (e) {}
  }
  /* Duell-Zeile (duellui.js hängt sie hinter #top) in die "Heute"-Spalte ins Band holen; sie entsteht erst nach dem Laden von duellui.js */
  function duellIn() {
    const top = doc.getElementById('top'); if (!top) return;
    const mv = () => { const d = doc.getElementById('duellBand'); if (d && d.parentNode !== top) { top.appendChild(d); } arrange(); return !!(d && d.parentNode === top); };
    if (mv()) return;
    let n = 0; const t = setInterval(() => { if (mv() || ++n > 40) clearInterval(t); }, 250);
  }
  render(); coachCard(); duellIn();
  root.addEventListener('pageshow', e => { if (e.persisted) { render(); coachCard(); duellIn(); } });
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) { render(); coachCard(); duellIn(); } });
  root.HomeCont = { render, resolve, coachCard, arrange };
})(typeof window !== 'undefined' ? window : this);
