'use strict';
/* Tonfunk Projekte (Verbund): Oberfläche des Hubs verbund.html (Paket U).
   Ansichten: Projektwahl, Projektansicht mit Phasenleiste, Stationsdetail, Gesamttest, Zertifikat (A4 quer), Abschlussbericht (A4 hoch),
   Teilen und Import (TFV1), Ausbilder (hinter dem Lehrer-Tor). Kern: window.Verbund (verbund.js), reine Hilfen: window.VerbundBar.pure (verbundbar.js).
   URL-Parameter: ?projekt=garage (&station=vg3 | &final=1), ?aufgabe=vg3 (Deep-Link von Kampagne/Auswertung), ?bericht=garage, ?zertifikat=garage, ?ausbilder, #v=<code> (Import).
   Schnittstellen nach außen: window.LabTrainerAPI (lab:'vb'), window.TaskTest, window.VerbundUI (Test, Sprache).
   Speicher: nur Verbund selbst (Präfix verbund.), außerdem lm4.name (vorbelegter Name), lm4.kamp.free (Ausbilder-Schalter, gleicher Schalter wie die Kampagne). */
(function (root) {
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const BP = (root.VerbundBar && root.VerbundBar.pure) || {};
  const esc = BP.esc || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const humanRows = BP.humanRows || (d => { let t = ''; try { t = JSON.stringify(d); } catch (e) {} return [{ k: 'Daten', v: String(t).slice(0, 400) }]; });
  const labUrl = BP.labUrl || ((lab, pid, sid, x) => 'index.html?verbund=' + pid + ':' + sid + (x || ''));
  const hintKey = BP.hintKey || ((p, s) => 'verbund.ht.' + p + '.' + s);
  const hintMerge = BP.hintMerge || ((o, seed, step, text) => { const r = { s: seed, t: Object.assign({}, o && o.s === seed ? o.t : {}) }; r.t[step] = text; return r; });
  const parseVoice = BP.parseVoice || (() => null);
  const LABN = BP.LAB_NAME || {}, LABI = BP.LAB_ICON || {};
  const labName = l => (root.LAB_REG && root.LAB_REG[l] && root.LAB_REG[l].name) || LABN[l] || l;
  const lsRaw = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsPut = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };
  const V = () => root.Verbund;
  const stat = (k, v, m) => { if (root.Badges) try { root.Badges.stat(k, v, m); } catch (e) {} };
  const kfmt = v => (typeof v === 'number' ? (Number.isInteger(v) ? fmt(v, 0) : fmt(v, Math.abs(v) < 10 ? 2 : Math.abs(v) < 100 ? 1 : 0)) : esc(v == null ? '–' : v));
  const fmt = (n, d) => (isFinite(n) && n !== null ? (+n).toFixed(d == null ? 0 : d) : '–').replace('.', ',');
  const MEDAL = { bronze: ['🥉', 'Bronze'], silber: ['🥈', 'Silber'], gold: ['🥇', 'Gold'] };
  const STATE = { locked: ['🔒', 'gesperrt'], open: ['▶', 'offen'], failed: ['⚠', 'nicht bestanden'], passed: ['✓', 'bestanden'], stale: ['↻', 'Eingang geändert'] };
  const GODH = 'a2fdecf55d194ed8cea8d52d7d0442778e86180b6d81c6c37e56278e55add6c6';          /* Hash des Lehrer-Tors, beim Bau aus schaltplan.js übernommen (kein Klartext-Passwort) */
  const S = { view: 'list', pid: null, sid: null, lastRes: null, finalRes: null, flags: { lastenheft: 0, stationViews: 0, cert: 0, share: 0 } };
  const cache = {};

  /* ============================================================ Fenster, Meldungen */
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2400, String(m).length * 55)); }
  function sheet(title, build, onClose) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = '<div class="sheet" role="dialog" aria-label="' + esc(title) + '"><div class="sh-h"><b>' + esc(title) + '</b><button class="x" aria-label="Schließen">✕</button></div><div class="sh-b"></div></div>';
    document.body.appendChild(bd);
    let closed = false; const close = () => { if (closed) return; closed = true; bd.remove(); if (onClose) onClose(); };
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
    $('.x', bd).onclick = close; build($('.sh-b', bd), close); return close;
  }
  /* Ja/Nein-Frage */
  function confirmBox(title, text, okLabel, danger) {
    return new Promise(res => {
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        b.innerHTML = '<p style="margin-top:0;line-height:1.5">' + text + '</p><div class="btns"><button class="btn' + (danger ? ' danger' : ' pri') + '" id="cbOk">' + esc(okLabel || 'Ja') + '</button><button class="btn" id="cbNo">Abbrechen</button></div>';
        $('#cbOk', b).onclick = () => { fin(true); close(); }; $('#cbNo', b).onclick = () => { fin(false); close(); };
      }, () => fin(false));
    });
  }
  const noKernel = () => { const v = $('#view'); v.innerHTML = '<div class="errbox"><b>Projektdaten fehlen.</b> Der Projektkern (verbund.js) ist nicht geladen. Bitte die Seite neu laden. Wenn das nicht hilft, einmal mit Netz öffnen, damit alle Dateien auf das Gerät kommen.</div>'; };

  /* ============================================================ Zugriff auf den Kern (alles abgesichert) */
  const safe = (f, d) => { try { const r = f(); return r === undefined ? d : r; } catch (e) { console.error(e); return d; } };
  const projects = () => safe(() => V().projects().slice().sort((a, b) => ((V().project(a.id) || {}).order || 99) - ((V().project(b.id) || {}).order || 99)), []);
  const defOf = pid => safe(() => V().project(pid), null);
  const stateOf = pid => safe(() => V().state(pid), null);
  const statusOf = pid => (stateOf(pid) ? safe(() => V().status(pid), null) : null);
  const stDef = (pid, sid) => { const d = defOf(pid); return d && Array.isArray(d.stations) ? d.stations.find(s => s.id === sid) || null : null; };
  const isFree = () => safe(() => V().free(), lsRaw('lm4.kamp.free', '0') === '1');
  const isDemo = pid => { const s = stateOf(pid); return !!(s && (s.demo || s.name === 'Demo')); };
  const lvName = (def, l) => (def && def.levels && def.levels[l] && def.levels[l].name) || ('Stufe ' + l);
  const passOf = (def, l, st) => (st && st.pass != null ? st.pass : (def && def.levels && def.levels[l] && def.levels[l].pass) || 80);
  function findPid(id) {
    for (const p of projects()) { const d = defOf(p.id); if (d && ((d.stations || []).some(s => s.id === id) || (d.final && d.final.id === id))) return p.id; }
    return null;
  }
  const doneLabs = pid => { const d = defOf(pid); return d && Array.isArray(d.labs) ? d.labs : []; };

  /* ============================================================ URL und Ansichten */
  function urlOf() {
    const q = new URLSearchParams();
    if (S.view === 'project' || S.view === 'station' || S.view === 'final') { q.set('projekt', S.pid); if (S.view === 'station') q.set('station', S.sid); if (S.view === 'final') q.set('final', '1'); }
    else if (S.view === 'bericht') q.set('bericht', S.pid); else if (S.view === 'zert') q.set('zertifikat', S.pid); else if (S.view === 'ausbilder') q.set('ausbilder', '1');
    const s = q.toString(); return location.pathname + (s ? '?' + s : '');
  }
  function go(view, pid, sid, opt) {
    Object.assign(S, { view, pid: pid || null, sid: sid || null });
    if (!(opt && opt.noPush)) { try { history.pushState(null, '', urlOf()); } catch (e) {} }
    render(); const pg = $('#pgMain'); if (pg) pg.scrollTop = 0;
  }
  function readUrl() {
    const q = new URLSearchParams(location.search), has = k => q.has(k);
    S.sid = null; S.pid = null;
    if (has('ausbilder')) S.view = 'ausbilder';
    else if (has('zertifikat')) { S.view = 'zert'; S.pid = q.get('zertifikat'); }
    else if (has('bericht')) { S.view = 'bericht'; S.pid = q.get('bericht'); }
    else if (has('aufgabe')) {
      const id = q.get('aufgabe'), pid = findPid(id);
      if (pid) { S.pid = pid; const d = defOf(pid); if (d.final && d.final.id === id) S.view = 'final'; else { S.view = 'station'; S.sid = id; } } else S.view = 'list';
    } else if (has('projekt')) {
      S.pid = q.get('projekt');
      if (!defOf(S.pid)) { S.view = 'list'; S.pid = null; }
      else if (has('station') && stDef(S.pid, q.get('station'))) { S.view = 'station'; S.sid = q.get('station'); }
      else if (has('final')) S.view = 'final'; else S.view = 'project';
    } else S.view = 'list';
    if ((S.view === 'bericht' || S.view === 'zert') && !defOf(S.pid)) { S.view = 'list'; S.pid = null; }
  }
  window.addEventListener('popstate', () => { readUrl(); render(); });

  function setTitle(t) { const el = $('#title'); if (el) el.textContent = t; document.title = t === 'Projekte' ? 'Tonfunk Projekte' : 'Projekte: ' + t; }
  function render() {
    const v = $('#view'); if (!v) return;
    if (!V()) { noKernel(); return; }
    try {
      if (S.view === 'project') renderProject(); else if (S.view === 'station') renderStation(); else if (S.view === 'final') renderFinal();
      else if (S.view === 'bericht') renderBericht(); else if (S.view === 'zert') renderZert(); else if (S.view === 'ausbilder') renderAusbilder(); else renderList();
    } catch (e) { console.error(e); v.innerHTML = '<div class="errbox"><b>Die Ansicht konnte nicht gebaut werden.</b> ' + esc(e && e.message) + '<br>Gehe zurück zu den Projekten oder lade die Seite neu.</div><div class="btns"><button class="btn" data-a="go-list">Zu den Projekten</button></div>'; }
  }
  const crumb = (parts) => '<div class="crumb">' + parts.map((p, i) => (p.a ? '<button data-a="' + p.a + '"' + (p.pid ? ' data-pid="' + esc(p.pid) + '"' : '') + '>' + esc(p.t) + '</button>' : '<span>' + esc(p.t) + '</span>') + (i < parts.length - 1 ? '<span>›</span>' : '')).join('') + '</div>';
  const ring = (pct, size) => { const r = 24, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct || 0)); return '<div class="ring"><svg viewBox="0 0 58 58"><circle cx="29" cy="29" r="' + r + '" fill="none" stroke="#0007" stroke-width="6"/><circle cx="29" cy="29" r="' + r + '" fill="none" stroke="' + (p >= 100 ? '#4cd964' : '#3b9eff') + '" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + (c * p / 100).toFixed(1) + ' ' + c.toFixed(1) + '"/></svg><b>' + Math.round(p) + '%</b></div>'; };
  const medalOf = s => (s && s.medal && MEDAL[s.medal] ? MEDAL[s.medal] : null);
  const labsRow = def => '<div class="labs">' + doneLabs(def.id).map(l => '<span title="' + esc(labName(l)) + '">' + (LABI[l] || '🧩') + '</span>').join('') + '</div>';

  /* ============================================================ 1. Projektwahl */
  function renderList() {
    setTitle('Projekte');
    const ps = projects(); let h = '<h1 class="vh1">Verbundprojekte</h1><p class="vlead">Fünf Projekte, in denen alle Labs zusammen ein Gerät oder eine Anlage fertigstellen. Jede Station bekommt die Ergebnisse der vorigen: Datenblatt, Schaltung, Platine, Messung, Programm.</p>';
    if (!ps.length) h += '<div class="errbox"><b>Projektdaten fehlen.</b> Es ist kein Projekt geladen. Seite neu laden oder einmal mit Netz öffnen.</div>';
    h += '<div class="pgrid">' + ps.map(p => {
      const def = defOf(p.id) || p, st = stateOf(p.id), sta = st ? statusOf(p.id) : null, md = medalOf(sta);
      return '<div class="pj' + (st ? ' on' : '') + '"><div class="top"><div class="ic">' + esc(def.icon || '🧩') + '</div><div style="flex:1;min-width:0"><h3>' + esc(def.name) + (isDemo(p.id) ? '<span class="demo">Demo</span>' : '') + '</h3>' + labsRow(def) + '</div>' + (sta ? ring(sta.pct) : '') + '</div>' +
        '<p class="story">' + esc(def.story || '') + '</p>' +
        (st && sta ? '<p>' + sta.done + ' von ' + sta.total + ' Stationen · ' + esc(lvName(def, st.level)) + ' · ' + esc(st.name || '') + (md ? ' · <span class="medal">' + md[0] + '</span>' : '') + '</p>' : '<p>' + (p.stations || (def.stations || []).length) + ' Stationen · ' + doneLabs(p.id).length + ' Labs</p>') +
        '<div class="acts">' + (st ? '<button class="btn pri" data-a="go-proj" data-pid="' + esc(p.id) + '">Weiter</button><button class="btn" data-a="start" data-pid="' + esc(p.id) + '">Neu starten</button>' : '<button class="btn pri" data-a="start" data-pid="' + esc(p.id) + '">Projekt starten</button>') + '</div></div>';
    }).join('') +
      '<div class="pj add"><div class="ic">📥</div><h3>Bestehendes laden</h3><p>Code, Link oder Datei von einem Partner oder aus einer Sicherung.</p><div class="acts"><button class="btn" data-a="import">Laden …</button></div></div></div>' +
      '<p class="hint2" style="margin-top:16px">Die früheren Einzelprojekte (<a href="projekte.html" style="color:var(--accent)">Projekte</a>, <a href="projekt-ampel.html" style="color:var(--accent)">Ampel</a>) gibt es weiterhin.</p>';
    $('#view').innerHTML = h;
  }

  /* Neues Projekt: Name/Teamname und Stufe */
  function startSheet(pid) {
    const def = defOf(pid); if (!def) return; const st = stateOf(pid); let level = (st && st.level) || 2;
    sheet(def.name + ' starten', (b, close) => {
      const draw = () => {
        b.innerHTML = (st ? '<div class="warnbox">Dieses Projekt läuft schon (' + esc(st.name || '') + '). Beim Neustart wird der Stand zurückgesetzt, eine Sicherung bleibt erhalten.</div>' : '') +
          '<label class="f"><span>Dein Name oder Teamname</span><input id="sName" type="text" autocomplete="name" value="' + esc((st && st.name !== 'Demo' ? st.name : lsRaw('lm4.name', '')) || '') + '"></label>' +
          '<p class="hint2" style="margin-top:-4px">Teamarbeit: Gebt auf beiden Geräten denselben Teamnamen und dieselbe Stufe ein, dann habt ihr dieselben Zahlen und könnt Stationen per Code tauschen.</p>' +
          '<div class="lvsel" role="radiogroup" aria-label="Stufe">' + [1, 2, 3].map(l => '<button data-l="' + l + '" class="' + (level === l ? 'on' : '') + '" role="radio" aria-checked="' + (level === l) + '"><span style="font-size:22px">' + ['🌱', '🔧', '🏆'][l - 1] + '</span><div><b>' + esc(lvName(def, l)) + ' (bestehen ab ' + passOf(def, l) + ' %)</b><small>' + [
            'Starthilfen, weitere Toleranzen, glatte Zahlen. Punkte × 1.', 'Normale Toleranzen, du baust vieles selbst. Punkte × 1,25.', 'Enge Toleranzen, Zusatzanforderungen, ein eingebauter Fehler in der Messstation. Punkte × 1,5.'][l - 1] + '</small></div></button>').join('') + '</div>' +
          '<div class="btns"><button class="btn pri" id="sGo">Starten</button><button class="btn" id="sNo">Abbrechen</button></div>';
        $$('.lvsel button', b).forEach(x => { x.onclick = () => { level = +x.dataset.l; const nm = $('#sName', b).value; draw(); $('#sName', b).value = nm; }; });
        $('#sNo', b).onclick = close;
        $('#sGo', b).onclick = () => {
          const name = $('#sName', b).value.trim().replace(/\s+/g, ' ');
          if (name.length < 2) { toast('Bitte einen Namen oder Teamnamen eintragen.'); return; }
          const had = !!st; close();
          if (had) safe(() => V().reset(pid, {}), null);
          const r = safe(() => V().start(pid, { name, level, again: true }), null);
          if (!r || !r.ok) { toast('Das Projekt konnte nicht gestartet werden' + (r && (r.msg || r.err) ? ': ' + (r.msg || r.err) : '.')); render(); return; }
          if (!lsRaw('lm4.name', '')) lsPut('lm4.name', name);
          toast('Projekt gestartet. Lies das Lastenheft und beginne mit Station 1.'); go('project', pid);
        };
      };
      draw();
    });
  }

  /* ============================================================ 2. Projektansicht */
  function phaseChips(pid, sta, selSid) {
    const def = defOf(pid), st = stateOf(pid);
    const chips = sta.stations.map((s, i) => {
      const sd = stDef(pid, s.id) || {}, m = STATE[s.state] || STATE.open;
      return '<button class="ph1 ' + esc(s.state) + (s.id === selSid ? ' sel' : '') + '" data-a="go-st" data-pid="' + esc(pid) + '" data-sid="' + esc(s.id) + '" aria-label="Station ' + (i + 1) + ': ' + esc(s.title) + ', ' + m[1] + '"><span class="z">' + m[0] + '</span><span class="n">STATION ' + (i + 1) + '</span><span class="l">' + (LABI[s.on] || '🧩') + '</span><span class="t">' + esc(s.title) + '</span><span class="p">' + (s.state === 'locked' ? 'gesperrt' : s.state === 'open' ? labName(s.on) : Math.round(s.pct || 0) + ' %') + '</span></button>';
    });
    const fs = sta.finalState, fm = STATE[fs] || STATE.locked;
    chips.push('<button class="ph1 fin ' + esc(fs) + '" data-a="go-final" data-pid="' + esc(pid) + '" aria-label="Gesamttest, ' + fm[1] + '"><span class="z">' + fm[0] + '</span><span class="n">ABSCHLUSS</span><span class="l">🏁</span><span class="t">' + esc((def.final && def.final.title) || 'Gesamttest') + '</span><span class="p">' + (fs === 'locked' ? 'gesperrt' : fs === 'open' ? 'bereit' : Math.round(sta.finalPct || 0) + ' %') + '</span></button>');
    return '<div class="phases" role="list">' + chips.join('') + '</div>';
  }
  function lastenheftHtml(pid, open) {
    const le = safe(() => V().get(pid + '.lastenheft'), null); if (!le) return '';
    const rows = humanRows(le.params || {});
    return '<div class="sec"><h3>Lastenheft</h3><details id="dLast"' + (open ? ' open' : '') + '><summary>Die Vorgaben für dein Gerät</summary>' + (Array.isArray(le.text) ? '<ul>' + le.text.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') + (rows.length ? '<details><summary>Zahlen als Tabelle</summary><table class="kv2">' + rows.map(r => '<tr><td>' + esc(r.k) + '</td><td>' + esc(r.v) + '</td></tr>').join('') + '</table></details>' : '') + '</details></div>';
  }
  function badgesHtml(pid) {
    const ids = safe(() => V().badges(pid), []) || []; if (!ids.length) return '';
    const defs = {}; safe(() => (root.Badges && root.Badges.DEFS || []).forEach(d => { defs[d[0]] = d; }), 0);
    return '<div class="sec"><h3>Abzeichen in diesem Projekt</h3><div class="row2">' + ids.map(id => { const d = defs[id]; return '<span class="tag ok" title="' + esc(d ? d[3] : id) + '">' + (d ? esc(d[1]) + ' ' + esc(d[2]) : esc(id)) + '</span>'; }).join('') + '</div></div>';
  }
  function renderProject() {
    const pid = S.pid, def = defOf(pid); if (!def) { go('list', null, null, { noPush: true }); return; }
    setTitle(def.name); const st = stateOf(pid);
    let h = crumb([{ t: 'Projekte', a: 'go-list' }, { t: def.name }]);
    h += '<h1 class="vh1">' + esc(def.icon || '') + ' ' + esc(def.name) + (isDemo(pid) ? '<span class="demo">Demo</span>' : '') + '</h1>';
    h += '<p class="vlead">' + esc(def.story || '') + (def.company ? '<br><b>Auftraggeber:</b> ' + esc(def.company) : '') + '</p><div class="labs" style="margin-bottom:10px">' + doneLabs(pid).map(l => '<span title="' + esc(labName(l)) + '">' + (LABI[l] || '🧩') + '</span>').join('') + '</div>';
    if (!st) {
      h += '<div class="sec"><h3>Noch nicht gestartet</h3><p>Du bekommst ein persönliches Lastenheft. Wähle Namen oder Teamnamen und eine Stufe.</p><div class="btns"><button class="btn pri" data-a="start" data-pid="' + esc(pid) + '">Projekt starten</button></div></div>';
      $('#view').innerHTML = h; return;
    }
    const sta = statusOf(pid); if (!sta) { $('#view').innerHTML = h + '<div class="errbox">Der Projektstand konnte nicht gelesen werden. Setze das Projekt zurück oder lade eine Sicherung.</div><div class="btns"><button class="btn danger" data-a="reset" data-pid="' + esc(pid) + '">Zurücksetzen</button></div>'; return; }
    const md = medalOf(sta), nxt = safe(() => V().next(pid), null), stale = sta.stations.filter(s => s.state === 'stale');
    h += '<div class="sec"><h3>Fortschritt</h3><div class="bar"><i style="width:' + Math.round(sta.total ? 100 * sta.done / sta.total : 0) + '%"></i></div><div class="stats"><span><b>' + sta.done + '</b> von ' + sta.total + ' Stationen</span><span><b>' + sta.points + '</b> von ' + sta.maxPoints + ' Punkten</span><span>' + esc(lvName(def, st.level)) + ' · ' + esc(st.name || '') + '</span>' + (md ? '<span class="medal">' + md[0] + ' ' + md[1] + '</span>' : '') + '</div></div>';
    if (stale.length) h += '<div class="warnbox"><b>Eingang geändert:</b> ' + stale.map(s => 'Station ' + (sta.stations.indexOf(s) + 1) + ' (' + esc(s.title) + ')').join(', ') + '. Dein Ergebnis bleibt erhalten, bitte neu prüfen und übergeben.</div>';
    h += phaseChips(pid, sta, null);
    const nSt = nxt && nxt !== 'final' ? sta.stations.find(s => s.id === nxt) : null;
    h += '<div class="btns" style="margin-top:0">' + (nSt ? '<button class="btn pri" data-a="go-st" data-pid="' + esc(pid) + '" data-sid="' + esc(nSt.id) + '">Weiter mit Station ' + (sta.stations.indexOf(nSt) + 1) + '</button>' : nxt === 'final' ? '<button class="btn pri" data-a="go-final" data-pid="' + esc(pid) + '">Zum Gesamttest</button>' : '<button class="btn pri" data-a="go-final" data-pid="' + esc(pid) + '">Gesamttest ansehen</button>') +
      '<button class="btn" data-a="go-final" data-pid="' + esc(pid) + '">Gesamttest</button><button class="btn" data-a="bericht" data-pid="' + esc(pid) + '">Bericht</button><button class="btn" data-a="zert" data-pid="' + esc(pid) + '">Zertifikat</button><button class="btn" data-a="share" data-pid="' + esc(pid) + '">Teilen</button><button class="btn danger" data-a="reset" data-pid="' + esc(pid) + '">Zurücksetzen</button></div>';
    h += lastenheftHtml(pid, false) + badgesHtml(pid);
    $('#view').innerHTML = h;
    const dl = $('#dLast'); if (dl) dl.addEventListener('toggle', () => { if (dl.open) S.flags.lastenheft++; });
  }

  /* ============================================================ 3. Stationsdetail */
  function slotRows(slot) { const d = safe(() => V().get(slot), null); return d ? humanRows(d) : []; }
  const tbl = rows => '<table class="kv2">' + rows.map(r => '<tr><td>' + esc(r.k) + '</td><td>' + esc(r.v) + '</td></tr>').join('') + '</table>';
  const linesHtml = res => '<ul class="res2">' + ((res && res.lines) || []).map(l => '<li class="' + (l.ok ? 'ok' : '') + '">' + esc(l.text) + (l.max ? ' <small style="color:var(--mute)">(' + (l.ok ? l.pts : 0) + '/' + l.max + ')</small>' : '') + '</li>').join('') + '</ul>';
  function renderStation() {
    const pid = S.pid, sid = S.sid, def = defOf(pid), sd = stDef(pid, sid);
    if (!def || !sd) { go('list', null, null, { noPush: true }); return; }
    setTitle(sd.title); S.flags.stationViews++;
    const st = stateOf(pid); let h = crumb([{ t: 'Projekte', a: 'go-list' }, { t: def.name, a: 'go-proj', pid }, { t: sd.title }]);
    if (!st) { $('#view').innerHTML = h + '<div class="warnbox">Dieses Projekt wurde noch nicht gestartet.</div><div class="btns"><button class="btn pri" data-a="start" data-pid="' + esc(pid) + '">Projekt starten</button></div>'; return; }
    const sta = statusOf(pid), info = sta && sta.stations.find(x => x.id === sid), idx = sta ? sta.stations.findIndex(x => x.id === sid) : -1;
    const state = (info && info.state) || 'open', m = STATE[state] || STATE.open, locked = state === 'locked' && !isFree();
    h += '<h1 class="vh1">' + (LABI[sd.on] || '') + ' Station ' + (idx + 1) + ': ' + esc(sd.title) + '</h1><p class="vlead">' + esc(labName(sd.on)) + ' · <span class="tag ' + (state === 'passed' ? 'ok' : state === 'failed' || state === 'stale' ? 'wa' : '') + '">' + m[0] + ' ' + m[1] + (info && info.pct != null && state !== 'open' && state !== 'locked' ? ' · ' + Math.round(info.pct) + ' %' : '') + '</span>' + (info && info.hints ? ' · Tipps: ' + info.hints : '') + '</p>';
    if (sta) h += phaseChips(pid, sta, sid);
    h += '<div class="sec"><h3>Auftrag</h3><p>' + esc(sd.text || '') + '</p></div>';
    const ins = Array.isArray(sd.in) ? sd.in : [];
    h += '<div class="sec"><h3>Eingang</h3><ul class="inl">' + ['' + pid + '.lastenheft'].concat(ins).map(s => {
      const ok = safe(() => V().has(s), false), rows = ok ? slotRows(s) : [];
      return '<li><span class="tag ' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓' : 'fehlt') + '</span><b>' + esc(s) + '</b>' + (ok ? '' : '<span style="color:var(--mute);font-size:13px">noch nicht übergeben</span>') + (rows.length ? '<details style="width:100%"><summary>Daten ansehen</summary>' + tbl(rows) + '</details>' : '') + '</li>';
    }).join('') + '</ul></div>';
    const outOk = !!(info && info.delivered) || safe(() => V().has(sd.out), false), res0 = outOk ? safe(() => V().check(pid, sid), null) : null, res = res0 && res0.ok !== false ? res0 : null;
    h += '<div class="sec"><h3>Ausgang</h3><p><b>' + esc(sd.out || '') + '</b> (' + esc(sd.type || '') + ') ' + (outOk ? '<span class="tag ok">übergeben</span>' : '<span class="tag">noch nicht übergeben</span>') + '</p>' + (outOk ? '<details><summary>Daten ansehen</summary>' + tbl(slotRows(sd.out)) + '</details>' : '') +
      (res ? '<p><b>Prüfergebnis der letzten Übergabe: ' + Math.round(res.pct) + ' %</b> (bestehen ab ' + ((info && info.pass != null) ? info.pass : passOf(def, st.level, sd)) + ' %)</p>' + linesHtml(res) : '<p class="hint2">Noch keine Übergabe. Arbeite im Lab und gib dort mit „Übergeben“ ab.</p>') + '</div>';
    const hs = info && info.hints || 0, cached = safe(() => JSON.parse(lsRaw(hintKey(pid, sid), 'null')), null);
    h += '<div class="btns">' + (locked ? '<button class="btn pri" disabled>Gesperrt: erst die Vorstation bestehen</button>' : '<a class="btn pri" data-a="lab" data-pid="' + esc(pid) + '" data-sid="' + esc(sid) + '" href="' + esc(labUrl(sd.on, pid, sid)) + '">Im ' + esc(labName(sd.on)) + ' öffnen</a>') +
      '<button class="btn" data-a="hint">💡 Tipp (' + hs + '/3)</button>' + (cached && cached.t && cached.s === st.seed && Object.keys(cached.t).length ? '<button class="btn" data-a="hint-old">Bisherige Tipps</button>' : '') +
      (outOk && info && info.pct > 0 ? '<button class="btn" data-a="give">Abgeben</button>' : '') + (outOk ? '<button class="btn danger" data-a="rstation">Station zurücksetzen</button>' : '') + '</div>';
    if (locked) h += '<p class="hint2">Gesperrt, weil die Vorstation noch nicht bestanden ist. Der Ausbilder kann alle Stationen freischalten.</p>';
    $('#view').innerHTML = h;
  }
  function showHintSheet(pid, sid, step, sol) {
    const st = stateOf(pid), c = safe(() => JSON.parse(lsRaw(hintKey(pid, sid), 'null')), null), t = (c && c.s === st.seed && c.t) || {}, top = step || Math.max(0, ...Object.keys(t).map(Number));
    sheet('Tipp, Stufe ' + top + ' von 3', (b, close) => {
      let h = ''; for (let i = 1; i <= top; i++) if (t[i]) h += '<p><b>Stufe ' + i + ':</b> ' + esc(t[i]) + '</p>';
      if (top < 3) h += '<p class="hint2">Brauchst du mehr Hilfe? Tippe noch einmal auf „Tipp“. Dein Ausbilder sieht, wie viele Tipps du gebraucht hast.</p>';
      else if (sol) h += '<p>Stufe 3 bietet die Musterlösung. Sie wird im Lab geladen, dein eigener Stand bleibt gesichert. Die Station zählt dann „mit Hilfe“.</p>' + (((stDef(pid, sid) || {}).solNote) ? '<p class="hint2"><b>Hinweis:</b> ' + esc((stDef(pid, sid) || {}).solNote) + '</p>' : '') + '<div class="btns"><a class="btn pri" href="' + esc(labUrl((stDef(pid, sid) || {}).on, pid, sid, '&loesung=1')) + '">Musterlösung im Lab laden</a></div>';
      b.innerHTML = h;
    });
  }
  function doHint() {
    const pid = S.pid, sid = S.sid, h = safe(() => V().hint(pid, sid), null);
    if (!h || h.ok === false || !h.text) { toast((h && h.msg) || 'Es gibt keinen weiteren Tipp.'); return; }
    const st = stateOf(pid); lsPut(hintKey(pid, sid), JSON.stringify(hintMerge(safe(() => JSON.parse(lsRaw(hintKey(pid, sid), 'null')), null), st.seed, h.step, h.text)));
    showHintSheet(pid, sid, h.step, !!h.solution); render();
  }

  /* ============================================================ 4. Gesamttest */
  function kpiTiles(kpis, anim) {
    return '<div class="tiles">' + (kpis || []).map(k => '<div class="tile ' + (k.ok ? 'ok' : 'no') + '"><span class="m">' + (k.ok ? '✓' : '✗') + '</span><div class="l">' + esc(k.label) + '</div><div class="v" data-v="' + esc(isFinite(k.value) ? k.value : '') + '"' + (anim ? ' data-anim="1"' : '') + '>' + kfmt(k.value) + '<small>' + esc(k.unit || '') + '</small></div></div>').join('') + '</div>';
  }
  function animateTiles() {
    $$('#view .tile .v[data-anim]').forEach(el => {
      const target = parseFloat(el.dataset.v); if (!isFinite(target)) return; const unit = el.querySelector('small'), uh = unit ? unit.outerHTML : '', dec = Math.abs(target) < 10 ? 2 : Math.abs(target) < 100 ? 1 : 0, t0 = performance.now();
      const step = now => { const f = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - f, 3); el.innerHTML = (f >= 1 ? kfmt(target) : fmt(target * e, Number.isInteger(target) ? 0 : dec)) + uh; if (f < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
    });
  }
  function debrief(pid) {
    const st = stateOf(pid), sta = statusOf(pid); if (!st || !sta) return '';
    const rows = sta.stations.map((s, i) => ({ n: i + 1, s, tries: (st.stations && st.stations[s.id] && st.stations[s.id].tries) || 0, hints: s.hints || 0 }));
    const noHint = rows.filter(r => !r.hints).length, most = rows.slice().sort((a, b) => b.hints - a.hints)[0], weak = rows.slice().sort((a, b) => (a.s.best || 0) - (b.s.best || 0))[0], retry = rows.filter(r => r.tries > 1);
    let h = '<div class="sec"><h3>Rückschau</h3><ul>';
    h += '<li>Ohne Tipp geschafft: <b>' + noHint + '</b> von ' + rows.length + ' Stationen.</li>';
    if (most && most.hints > 0) h += '<li>Die meisten Tipps brauchtest du bei Station ' + most.n + ' („' + esc(most.s.title) + '“): ' + most.hints + ' von 3. Das ist ein guter Kandidat zum Wiederholen.</li>';
    if (weak && weak.s.best != null && weak.s.best < 100) h += '<li>Knappste Station: ' + weak.n + ' („' + esc(weak.s.title) + '“) mit bester Wertung ' + Math.round(weak.s.best) + ' %.</li>';
    if (retry.length) h += '<li>Mehrere Versuche: ' + retry.map(r => 'Station ' + r.n + ' (' + r.tries + ')').join(', ') + '. Aus Fehlern lernt man am meisten.</li>';
    return h + '<li>Tipp für den Betrieb: Erzähle deinem Ausbilder, was du beim nächsten Mal anders machen würdest.</li></ul></div>';
  }
  function renderFinal() {
    const pid = S.pid, def = defOf(pid); if (!def) { go('list', null, null, { noPush: true }); return; }
    setTitle((def.final && def.final.title) || 'Gesamttest'); const st = stateOf(pid);
    let h = crumb([{ t: 'Projekte', a: 'go-list' }, { t: def.name, a: 'go-proj', pid }, { t: 'Gesamttest' }]);
    h += '<h1 class="vh1">🏁 ' + esc((def.final && def.final.title) || 'Gesamttest') + '</h1>';
    if (!st) { $('#view').innerHTML = h + '<div class="warnbox">Dieses Projekt wurde noch nicht gestartet.</div><div class="btns"><button class="btn pri" data-a="start" data-pid="' + esc(pid) + '">Projekt starten</button></div>'; return; }
    const sta = statusOf(pid), fs = sta ? sta.finalState : 'locked', free = isFree();
    h += '<p class="vlead">Alle Stationen zusammen: Das fertige Gerät wird gegen das Lastenheft geprüft. Die Ergebnisse kommen aus deinen übergebenen Stationen.</p>';
    if (sta) h += phaseChips(pid, sta, null);
    const res = S.finalRes && S.finalRes.pid === pid ? S.finalRes.r : null, saved = st.final || null;
    if (fs === 'locked' && !free) {
      const left = (sta ? sta.stations : []).map((s, i) => ({ s, i })).filter(x => x.s.state !== 'passed');
      h += '<div class="warnbox">Der Gesamttest ist gesperrt. Es fehlt noch: ' + (left.length ? left.map(x => 'Station ' + (x.i + 1) + ' (' + esc(x.s.title) + (x.s.state === 'stale' ? ', neu prüfen' : '') + ')').join(', ') : 'eine Station') + '.</div>';
    } else {
      h += '<div class="btns" style="margin-top:0"><button class="btn pri" data-a="runfinal">' + (res || saved ? 'Gesamttest erneut laufen lassen' : 'Gesamttest starten') + '</button></div>';
    }
    if (res) {
      h += '<div class="sec"><h3>Ergebnis</h3><p class="bigp ' + (res.ok ? 'ok' : 'no') + '">' + Math.round(res.pct) + ' %</p><p>' + (res.ok ? 'Bestanden. Dein Gerät erfüllt das Lastenheft.' : 'Noch nicht bestanden (Grenze ' + passOf(def, st.level, def.final) + ' %). Prüfe die roten Zeilen, verbessere die zuständige Station und starte den Test erneut.') + '</p>' + kpiTiles(res.kpis, true) + linesHtml(res) + '</div>';
      if (res.ok) h += debrief(pid) + '<div class="btns"><button class="btn pri" data-a="zert" data-pid="' + esc(pid) + '">Zertifikat</button><button class="btn" data-a="bericht" data-pid="' + esc(pid) + '">Abschlussbericht</button><button class="btn" data-a="go-list">Zu den Projekten</button></div>';
    } else if (saved && saved.kpis) {
      h += '<div class="sec"><h3>Letztes Ergebnis</h3><p class="bigp ' + (saved.ok ? 'ok' : 'no') + '">' + Math.round(saved.pct) + ' %</p>' + kpiTiles(saved.kpis, false) + '</div>';
      if (saved.ok) h += debrief(pid) + '<div class="btns"><button class="btn pri" data-a="zert" data-pid="' + esc(pid) + '">Zertifikat</button><button class="btn" data-a="bericht" data-pid="' + esc(pid) + '">Abschlussbericht</button></div>';
    }
    $('#view').innerHTML = h; if (res) animateTiles();
  }
  function runFinal() {
    const pid = S.pid, r = safe(() => V().final(pid, { save: true }), null);
    if (!r) { toast('Der Gesamttest ist fehlgeschlagen.'); return; }
    S.finalRes = { pid, r }; if (r.ok) { try { if (root.Badges && root.Badges.confetti) root.Badges.confetti(); if (root.Badges && root.Badges.chime) root.Badges.chime(); } catch (e) {} }
    renderFinal();
  }

  /* ============================================================ 5. Zertifikat und Bericht (Druckseiten) */
  function printDoc(html, landscape) {
    $('#printArea').innerHTML = html; const ps = $('#pageStyle'); if (ps) ps.textContent = '@page{size:A4 ' + (landscape ? 'landscape;margin:8mm' : 'portrait;margin:12mm') + '}';
    setTimeout(() => window.print(), 80);
  }
  const dDate = t => new Date(t || Date.now()).toLocaleDateString('de-DE');
  function certHtml(pid) {
    const def = defOf(pid), st = stateOf(pid), sta = statusOf(pid), rep = safe(() => V().report(pid), null); if (!def || !st || !sta) return '';
    const cert = (rep && rep.cert) || { code: safe(() => V().certCode(pid), ''), medal: sta.medal, points: sta.points }, md = MEDAL[cert.medal] || medalOf(sta), kp = (rep && rep.kpis) || (st.final && st.final.kpis) || [];
    return '<div class="paper land"><div class="cert"><div style="display:flex;justify-content:space-between;align-items:center"><img class="lg" src="logo-full.png" alt="Tonfunk" onerror="this.style.display=\'none\'"><span style="font-size:12px;color:#555">Tonfunk Lehrwerkstatt</span></div>' +
      '<h1>ZERTIFIKAT</h1><div class="sub">Verbundprojekt abgeschlossen</div><div class="nm">' + esc(st.name || '') + '</div><div class="pj2"><b>' + esc(def.icon || '') + ' ' + esc(def.name) + '</b> · ' + esc(lvName(def, st.level)) + ' · ' + dDate(st.final && st.final.t) + '</div>' +
      '<div class="md">' + (md ? md[0] : '') + '</div><div class="sub">' + (md ? 'Medaille ' + md[1] + ' · ' : '') + sta.points + ' von ' + sta.maxPoints + ' Punkten</div>' +
      '<div class="cols"><div><table><tr><th>Nr.</th><th>Station</th><th>Lab</th><th>Ergebnis</th></tr>' + sta.stations.map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(s.title) + '</td><td>' + esc(labName(s.on)) + '</td><td>' + Math.round(s.best != null ? s.best : s.pct || 0) + ' %</td></tr>').join('') + '<tr><td></td><td><b>Gesamttest</b></td><td>–</td><td><b>' + Math.round(sta.finalPct || 0) + ' %</b></td></tr></table></div>' +
      '<div>' + (kp.length ? '<table><tr><th>Kennzahl</th><th>Wert</th><th></th></tr>' + kp.map(k => '<tr><td>' + esc(k.label) + '</td><td>' + kfmt(k.value) + ' ' + esc(k.unit || '') + '</td><td>' + (k.ok ? '✓' : '✗') + '</td></tr>').join('') + '</table>' : '') + '</div></div>' +
      '<div class="code">Zertifikatscode ' + esc(cert.code || '') + '</div><div class="sig"><div>Ort, Datum</div><div>Unterschrift Ausbilder</div></div></div></div>';
  }
  function rowsHtml(sec) {
    const rows = sec.rows || []; if (!rows.length) return '';
    const head = Array.isArray(sec.head) ? '<tr>' + sec.head.map(x => '<th>' + esc(x) + '</th>').join('') + '</tr>' : '';
    const body = rows.map(r => {
      if (Array.isArray(r)) return '<tr>' + r.map(c => '<td>' + esc(STATE[c] ? STATE[c][1] : c) + '</td>').join('') + '</tr>';
      if (r && typeof r === 'object') { const a = r.label != null ? r.label : r.k != null ? r.k : r.name, b = r.value != null ? r.value : r.v != null ? r.v : r.text; if (a != null) return '<tr><td>' + esc(a) + '</td><td>' + esc(b == null ? '' : b) + (r.unit ? ' ' + esc(r.unit) : '') + '</td></tr>'; return '<tr>' + Object.keys(r).map(k => '<td>' + esc(r[k]) + '</td>').join('') + '</tr>'; }
      return '<tr><td>' + esc(r) + '</td></tr>';
    }).join('');
    return '<table>' + head + body + '</table>';
  }
  function berichtHtml(pid) {
    const def = defOf(pid), st = stateOf(pid), sta = statusOf(pid), rep = safe(() => V().report(pid), null); if (!def || !st || !sta || !rep) return '';
    const secs = rep.sections || [], kp = rep.kpis || (st.final && st.final.kpis) || [], md = medalOf(sta);
    let h = '<div class="paper port"><div class="rep"><div style="display:flex;justify-content:space-between;align-items:center"><img src="logo-full.png" alt="Tonfunk" style="height:40px" onerror="this.remove()"><span style="font-size:12px;color:#555">' + dDate(Date.now()) + '</span></div>' +
      '<h1>' + esc(rep.title || 'Abschlussbericht: ' + def.name) + '</h1><p>' + esc(st.name || '') + ' · ' + esc(rep.levelName || lvName(def, st.level)) + ' · ' + sta.done + ' von ' + sta.total + ' Stationen · ' + sta.points + ' von ' + sta.maxPoints + ' Punkten' + (md ? ' · ' + md[1] : '') + '</p>';
    secs.forEach(sec => { h += '<h2>' + esc(sec.h || '') + '</h2>' + (Array.isArray(sec.text) && sec.text.length ? '<ul>' + sec.text.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') + (sec.html != null ? String(sec.html) : rowsHtml(sec)); });
    if (kp.length) h += '<h2>Gesamttest: Kennzahlen</h2><p>' + kp.map(k => '<span class="kp ' + (k.ok ? 'ok' : 'no') + '">' + esc(k.label) + ': <b>' + kfmt(k.value) + ' ' + esc(k.unit || '') + '</b> ' + (k.ok ? '✓' : '✗') + '</span>').join('') + '</p>';
    return h + '<p style="margin-top:18px;font-size:12px;color:#555">Zertifikatscode: ' + esc((rep.cert && rep.cert.code) || safe(() => V().certCode(pid), '')) + '</p></div></div>';
  }
  function docView(kind) {
    const pid = S.pid, def = defOf(pid); if (!def) { go('list', null, null, { noPush: true }); return; }
    const st = stateOf(pid), sta = st ? statusOf(pid) : null; setTitle(kind === 'zert' ? 'Zertifikat' : 'Abschlussbericht');
    let h = crumb([{ t: 'Projekte', a: 'go-list' }, { t: def.name, a: 'go-proj', pid }, { t: kind === 'zert' ? 'Zertifikat' : 'Bericht' }]);
    if (!st || !sta) { $('#view').innerHTML = h + '<div class="warnbox">Dieses Projekt wurde noch nicht gestartet.</div>'; return; }
    if (kind === 'zert' && sta.finalState !== 'passed') { $('#view').innerHTML = h + '<div class="warnbox"><b>Das Zertifikat gibt es erst nach bestandenem Gesamttest.</b> Dein Stand: ' + sta.done + ' von ' + sta.total + ' Stationen.</div><div class="btns"><button class="btn pri" data-a="go-proj" data-pid="' + esc(pid) + '">Zum Projekt</button></div>'; return; }
    const html = kind === 'zert' ? certHtml(pid) : berichtHtml(pid); S.doc = { html, land: kind === 'zert' }; if (kind === 'zert') S.flags.cert++;
    $('#view').innerHTML = h + '<div class="btns" style="margin-top:0"><button class="btn pri" data-a="print-doc">🖨 Drucken (A4 ' + (kind === 'zert' ? 'quer' : 'hoch') + ', Browser: als PDF speichern)</button>' + (kind === 'zert' ? '<button class="btn" data-a="bericht" data-pid="' + esc(pid) + '">Zum Bericht</button>' : '<button class="btn" data-a="zert" data-pid="' + esc(pid) + '">Zum Zertifikat</button>') + '</div>' + html;
    if (kind === 'bericht' && sta.finalState === 'passed') stat('vbbericht', 1, 'max');
  }
  const renderZert = () => docView('zert'), renderBericht = () => docView('bericht');
  function printNow() {
    if ((S.view === 'zert' || S.view === 'bericht') && S.doc) { printDoc(S.doc.html, S.doc.land); return; }
    if (S.pid && stateOf(S.pid)) { const sta = statusOf(S.pid); if (sta && sta.finalState === 'passed') { go('zert', S.pid); toast('Tippe auf „Drucken“ für das Zertifikat.'); return; } go('bericht', S.pid); toast('Tippe auf „Drucken“ für den Bericht.'); return; }
    toast('Öffne zuerst ein gestartetes Projekt, dann kannst du Bericht oder Zertifikat drucken.');
  }

  /* ============================================================ 6. Teilen und Import */
  const TFV_RE = /TFV[01]\.[A-Za-z0-9_-]+/;
  function saveText(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json' });
    if (root.LabExport && root.LabExport.saveBlob) { root.LabExport.saveBlob(blob, name); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  async function copyText(t, ta) { try { await navigator.clipboard.writeText(t); toast('Kopiert'); } catch (e) { try { ta.select(); document.execCommand('copy'); toast('Kopiert'); } catch (x) { toast('Bitte den Text markieren und selbst kopieren.'); } } }
  function shareSheet(pid, sid) {
    const def = defOf(pid), st = stateOf(pid), sta = statusOf(pid); if (!def || !st || !sta) { toast('Starte zuerst das Projekt.'); return; }
    S.flags.share++;
    sheet('Teilen: ' + def.name, (b, close) => {
      b.innerHTML = '<p style="margin-top:0" class="hint2">Der Code enthält deinen Namen und die Daten der Stationen. Ein Partner mit demselben Teamnamen und derselben Stufe kann ihn laden. Er wird nur lokal erzeugt.</p>' +
        '<label class="f"><span>Was soll mit?</span><select id="shScope"><option value="all">Alle Stationen</option>' + sta.stations.map((s, i) => '<option value="' + esc(s.id) + '"' + (s.id === sid ? ' selected' : '') + '>Nur Station ' + (i + 1) + ': ' + esc(s.title) + '</option>').join('') + '</select></label>' +
        '<div class="btns"><button class="btn pri" id="shGo">Code erzeugen</button></div><div id="shOut"></div>';
      $('#shGo', b).onclick = async () => {
        const sc = $('#shScope', b).value, out = $('#shOut', b); out.innerHTML = '<p class="hint2">Erzeuge Code …</p>';
        let code = null; try { code = await V().pack(pid, sc === 'all' ? { slots: 'all' } : { slots: 'all', station: sc }); } catch (e) {}
        if (!code || typeof code !== 'string') { out.innerHTML = '<div class="errbox">Der Code konnte nicht erzeugt werden. Gibt es schon übergebene Stationen?</div>'; return; }
        const link = location.origin && location.origin !== 'null' ? location.origin + location.pathname.replace(/[^/]*$/, '') + V().link(code) : V().link(code), qr = safe(() => V().qrOk(code), false) && root.Auswertung && root.Auswertung.qrSvg ? root.Auswertung.qrSvg(code) : '';
        out.innerHTML = (qr ? '<div style="background:#fff;padding:8px;border-radius:12px;max-width:320px;margin:10px auto">' + qr + '</div>' : '<p class="hint2">Der Code ist zu lang für einen QR-Code. Nimm Text, Link oder Datei.</p>') +
          '<label class="f"><span>Code (' + code.length + ' Zeichen)</span><textarea class="code" id="shCode" readonly rows="3"></textarea></label><div class="btns"><button class="btn" id="shCopy">Code kopieren</button><button class="btn" id="shLink">Link kopieren</button><button class="btn" id="shFile">Als Datei (.tfv.json)</button></div>';
        const ta = $('#shCode', out); ta.value = code; ta.addEventListener('focus', () => ta.select());
        $('#shCopy', out).onclick = () => copyText(code, ta); $('#shLink', out).onclick = () => { ta.value = link; copyText(link, ta); ta.value = code; };
        $('#shFile', out).onclick = () => saveText('tonfunk-verbund-' + pid + '.tfv.json', JSON.stringify({ app: 'tonfunk-verbund-datei', v: 1, pid, name: st.name, t: Date.now(), code }, null, 1));
        stat('vbteilen', 1, 'max');
      };
    });
  }
  function importSheet(prefill) {
    sheet('Projektdaten laden', (b, close) => {
      b.innerHTML = '<p style="margin-top:0" class="hint2">Füge einen Code (TFV1 …), einen Link oder eine Datei ein. Er muss zu demselben Lastenheft gehören: gleiches Projekt, gleicher Name oder Teamname, gleiche Stufe.</p>' +
        '<textarea class="code" id="imTxt" rows="4" placeholder="Code oder Link hier einfügen" spellcheck="false"></textarea><div class="btns"><button class="btn" id="imFileB">Datei wählen …</button><input type="file" id="imFile" accept=".json,.txt,.tfv,application/json,text/plain" style="display:none"><button class="btn pri" id="imChk">Prüfen</button></div><div id="imOut"></div>';
      const txt = $('#imTxt', b), out = $('#imOut', b); if (prefill) txt.value = prefill;
      $('#imFileB', b).onclick = () => $('#imFile', b).click();
      $('#imFile', b).onchange = e => { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { txt.value = String(rd.result || ''); check(); }; rd.onerror = () => toast('Die Datei konnte nicht gelesen werden.'); rd.readAsText(f); };
      $('#imChk', b).onclick = check;
      async function check() {
        const m = String(txt.value).match(TFV_RE); if (!m) { out.innerHTML = '<div class="errbox">Hier steckt kein Projektcode (er beginnt mit TFV1).</div>'; return; }
        out.innerHTML = '<p class="hint2">Prüfe …</p>'; let bundle = null; try { bundle = await V().unpack(m[0]); } catch (e) {}
        if (!bundle || bundle.ok === false) { out.innerHTML = '<div class="errbox"><b>Der Code ist beschädigt oder unvollständig.</b> ' + esc((bundle && (bundle.msg || bundle.err)) || 'Kopiere ihn noch einmal vollständig.') + '</div>'; return; }
        const pid = bundle.pid || bundle.project || '', def = defOf(pid), n = Array.isArray(bundle.envs) ? bundle.envs.length : '?', badN = Array.isArray(bundle.bad) ? bundle.bad : [];
        out.innerHTML = '<div class="sec" style="margin:10px 0"><p style="margin:0"><b>' + esc(def ? def.name : pid || 'Unbekanntes Projekt') + '</b> von ' + esc(bundle.name || (bundle.meta && bundle.meta.name) || 'unbekannt') + ', ' + n + ' Datenpaket' + (n === 1 ? '' : 'e') + '.</p></div>' + (badN.length ? '<div class="errbox"><b>Beschädigt:</b> ' + badN.map(x => esc(x.slot) + ' (' + esc(x.why) + ')').join('; ') + '. Diese Teile werden abgelehnt.</div>' : '') +
          '<div class="lvsel"><button data-m="merge" class="on"><div><b>Zusammenführen</b><small>Neuere Datenpakete werden übernommen, deine gleichen oder neueren bleiben.</small></div></button><button data-m="replace"><div><b>Ersetzen</b><small>Dein Stand wird durch den Inhalt des Codes ersetzt (eine Sicherung bleibt).</small></div></button></div><div class="btns"><button class="btn pri" id="imGo">Laden</button></div>';
        let mode = 'merge'; $$('.lvsel button', out).forEach(x => { x.onclick = () => { mode = x.dataset.m; $$('.lvsel button', out).forEach(y => y.classList.toggle('on', y === x)); }; });
        $('#imGo', out).onclick = async () => {
          let r = null; try { r = await V().importBundle(bundle, { mode }); } catch (e) {}
          if (!r || (r.ok === false && !(r.rejected || []).length && !(r.imported || []).length)) { out.innerHTML = '<div class="errbox">Das Laden ist fehlgeschlagen' + (r && (r.msg || r.err) ? ': ' + esc(r.msg || r.err) : '.') + '</div>'; return; }
          const rej = r.rejected || [], imp = r.imported || [], skip = r.skipped || [];
          out.innerHTML = '<div class="sec" style="margin:10px 0"><p style="margin:0"><b>' + imp.length + ' Datenpaket' + (imp.length === 1 ? '' : 'e') + ' geladen.</b></p></div>' + (skip.length ? '<p class="hint2">' + skip.length + ' Datenpaket' + (skip.length === 1 ? '' : 'e') + ' übersprungen (dein Stand ist neuer oder gleich).</p>' : '') + (rej.length ? '<div class="errbox"><b>Abgelehnt (' + rej.length + '):</b><ul>' + rej.map(x => '<li>' + esc(x.slot) + ': ' + esc(x.why) + '</li>').join('') + '</ul>' + (rej.some(x => /anderen Lastenheft/i.test(String(x.why))) ? '<p>Starte dasselbe Projekt mit gleichem Namen oder Teamnamen und gleicher Stufe wie dein Partner, dann passt es.</p>' : '') + '</div>' : '') +
            '<div class="btns">' + (imp.length && pid && defOf(pid) ? '<button class="btn pri" id="imOpen">Zum Projekt</button>' : '') + '</div>';
          if (imp.length) render(); const ob = $('#imOpen', out); if (ob) ob.onclick = () => { close(); go('project', pid); };
        };
      }
      if (prefill) check();
    });
  }

  /* ============================================================ 7. Ausbilder */
  async function sha256(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  const godOk = () => { try { return GODH.length === 64 && sessionStorage.getItem('lm4.god') === GODH; } catch (e) { return false; } };
  /* Schutz der echten Ergebnisse bei Demo und Selbsttest: diese Schlüssel werden vorher gesichert und danach zurückgeschrieben */
  const GUARD = ['lm4.tdone', 'sim.hints', 'sim.done', 'lm4.stats', 'lm4.badges', 'lm4.seen', 'lm4.kamp', 'lm4.kamp.free'];
  const snapGuard = () => GUARD.map(k => [k, (() => { try { return localStorage.getItem(k); } catch (e) { return null; } })()]);
  const restoreGuard = s => s.forEach(([k, v]) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} });
  /* Musterlösung einer Station aus dem Kern holen ({ type, data } oder null); für den Ausbilder wird lm4.kamp.free kurz gesetzt */
  function solutionOf(pid, sid) {
    const g = snapGuard(); lsPut('lm4.kamp.free', '1');
    try { const p = safe(() => V().solution(pid, sid), null); return p && p.ok !== false && p.data !== undefined ? { type: p.type, data: p.data } : null; } finally { restoreGuard(g); }
  }
  /* Musterlösung einer Station übergeben (nur Ausbilder). Die Ergebnisse in Aufgaben und Abzeichen bleiben unberührt (Schutz über GUARD). */
  function deliverSolution(pid, sid) {
    const sd = stDef(pid, sid), p = solutionOf(pid, sid); if (!sd || !p) return { ok: false, err: 'keine Musterlösung' };
    const g = snapGuard();
    try { return safe(() => V().deliver(sd.out, { type: p.type || sd.type, data: p.data, station: sid, from: 'vb' }, { assisted: true }), { ok: false, err: 'Fehler' }); } finally { restoreGuard(g); }
  }
  /* Beispielstand aus den Musterlösungen (Kern: Verbund.demo, markiert den Stand als Demo und schreibt weder Aufgaben-Ergebnisse noch Abzeichen) */
  function demoLoad(pid, upto) {
    const def = defOf(pid); if (!def) return { ok: false, err: 'Projekt unbekannt' };
    if (stateOf(pid)) safe(() => V().reset(pid, {}), null);
    const upTo = upto === 'all' ? 'final' : (def.stations[Math.min(def.stations.length, upto) - 1] || {}).id;
    const r = safe(() => V().demo(pid, { name: 'Demo', level: 2, again: true, upTo }), null);
    if (!r || r.ok === false && !r.final) return { ok: false, err: r && (r.msg || r.err) };
    return { ok: true, n: (r.done || []).length, final: r.final || null };
  }
  function renderAusbilder() {
    setTitle('Ausbilder'); const v = $('#view');
    if (!godOk()) {
      v.innerHTML = crumb([{ t: 'Projekte', a: 'go-list' }, { t: 'Ausbilder' }]) + '<h1 class="vh1">Ausbilder</h1><p class="vlead">Dieser Bereich ist für Ausbilder.</p><div class="sec"><label class="f"><span>Passwort (nur für Ausbilder)</span><input id="gPw" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false"></label><div class="btns"><button class="btn pri" data-a="god">Freigeben</button></div></div>';
      return;
    }
    const ps = projects(); let h = crumb([{ t: 'Projekte', a: 'go-list' }, { t: 'Ausbilder' }]) + '<h1 class="vh1">Ausbilder</h1>';
    h += '<div class="sec"><h3>Stationen freischalten</h3><label style="display:flex;gap:10px;align-items:center;min-height:44px"><input type="checkbox" id="aFree" style="width:24px;height:24px"' + (isFree() ? ' checked' : '') + '> Alle Stationen und den Gesamttest freischalten (gleicher Schalter wie in der Kampagne)</label></div>';
    h += '<div class="sec"><h3>Projekt mit Namen starten (Zahlen eines Azubis nachrechnen)</h3><div class="fgrid"><label class="f"><span>Projekt</span><select id="aPid">' + ps.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('') + '</select></label><label class="f"><span>Name oder Teamname (genau wie beim Azubi)</span><input id="aName" type="text"></label><label class="f"><span>Stufe</span><select id="aLv"><option value="1">1 Einsteiger</option><option value="2" selected>2 Standard</option><option value="3">3 Profi</option></select></label></div><div class="btns"><button class="btn" data-a="a-start">Projekt starten (überschreibt den Stand)</button></div></div>';
    h += '<div class="sec"><h3>Beispielstände (Demo, zählen nicht für Ergebnisse)</h3><p class="hint2">Aus den Musterlösungen, Stufe 2. Ersetzt den aktuellen Stand des Projekts und ist im Hub mit „Demo“ gekennzeichnet.</p>' + ps.map(p => '<div class="row2" style="margin:6px 0"><b style="flex:1;min-width:140px">' + esc(p.name) + '</b><button class="btn s" data-a="a-demo" data-pid="' + esc(p.id) + '" data-n="4">bis Station 4</button><button class="btn s" data-a="a-demo" data-pid="' + esc(p.id) + '" data-n="all">fertig</button></div>').join('') + '</div>';
    ps.forEach(p => {
      const def = defOf(p.id), st = stateOf(p.id), sta = st ? statusOf(p.id) : null; if (!def) return;
      h += '<div class="sec"><h3>' + esc(def.name) + (st ? ' · ' + esc(st.name || '') + ' · Stufe ' + st.level : ' · nicht gestartet') + '</h3>';
      if (!sta) { h += '<p class="hint2">Starte das Projekt, um Stationen zu sehen.</p></div>'; return; }
      h += sta.stations.map((s, i) => { const sd = stDef(p.id, s.id) || {}; return '<div class="row2" style="padding:5px 0;border-top:1px solid var(--line)"><span style="flex:1;min-width:150px"><b>' + (i + 1) + '. ' + esc(s.title) + '</b><br><small style="color:var(--mute)">' + esc(labName(s.on)) + ' · ' + (STATE[s.state] || STATE.open)[1] + (s.pct != null && s.state !== 'open' && s.state !== 'locked' ? ' ' + Math.round(s.pct) + ' %' : '') + (s.hints ? ' · Tipps ' + s.hints : '') + '</small></span><button class="btn s" data-a="a-data" data-pid="' + esc(p.id) + '" data-sid="' + esc(s.id) + '">Daten</button><button class="btn s" data-a="a-check" data-pid="' + esc(p.id) + '" data-sid="' + esc(s.id) + '">Prüfung neu</button><button class="btn s" data-a="a-sol" data-pid="' + esc(p.id) + '" data-sid="' + esc(s.id) + '">Musterlösung laden</button></div>'; }).join('') + '</div>';
    });
    h += '<div class="sec"><h3>Lösungen für Ausbilder</h3><p class="hint2">Lösungsblätter zu den Lernheften und zur Praxisprüfung W-2024, verschlüsselt, mit Ausbilder-Passwort.</p><a class="btn" href="loesungen.html">Lösungen öffnen</a></div>';
    h += '<div class="sec"><h3>Speicher</h3>' + ps.map(p => { const u = safe(() => V().usage(p.id), null); return '<p style="margin:2px 0">' + esc(p.name) + ': ' + (u ? Math.round(u.bytes / 1024) + ' KB, ' + u.slots + ' Datenpakete' : '–') + '</p>'; }).join('') + '</div>';
    v.innerHTML = h;
    $('#aFree', v).onchange = e => { lsPut('lm4.kamp.free', e.target.checked ? '1' : '0'); toast(e.target.checked ? 'Alle Stationen sind freigeschaltet.' : 'Reihenfolge gilt wieder.'); };
  }
  async function aAction(a, d) {
    if (a === 'god') {
      const pw = ($('#gPw') || {}).value || ''; if (!(root.crypto && crypto.subtle)) { toast('Bitte die Seite über https öffnen.'); return; }
      if (GODH.length === 64 && await sha256(pw.trim()) === GODH) { try { sessionStorage.setItem('lm4.god', GODH); } catch (e) {} renderAusbilder(); } else { toast('Passwort falsch'); const i = $('#gPw'); if (i) i.select(); } return;
    }
    if (!godOk()) { renderAusbilder(); return; }
    if (a === 'a-start') {
      const pid = $('#aPid').value, name = $('#aName').value.trim().replace(/\s+/g, ' '), level = +$('#aLv').value; if (name.length < 2) { toast('Bitte den Namen eintragen.'); return; }
      if (!await confirmBox('Projekt neu starten?', 'Der aktuelle Stand von „' + esc((defOf(pid) || {}).name) + '“ wird ersetzt (eine Sicherung bleibt).', 'Starten')) return;
      if (stateOf(pid)) safe(() => V().reset(pid, {}), null); const r = safe(() => V().start(pid, { name, level, again: true }), null);
      toast(r && r.ok ? 'Gestartet: ' + name + ', Stufe ' + level + '. Du siehst jetzt dieselben Zahlen.' : 'Start fehlgeschlagen' + (r && r.err ? ': ' + r.err : '.')); renderAusbilder();
    } else if (a === 'a-demo') {
      if (!await confirmBox('Beispielstand laden?', 'Der Stand von „' + esc((defOf(d.pid) || {}).name) + '“ wird durch den Demo-Stand ersetzt. Echte Ergebnisse (Aufgaben, Abzeichen) bleiben unberührt.', 'Laden')) return;
      const r = demoLoad(d.pid, d.n === 'all' ? 'all' : +d.n); toast(r.ok ? 'Demo geladen (' + r.n + ' Stationen' + (r.final ? ', Gesamttest ' + (r.final.ok ? 'bestanden' : 'nicht bestanden') : '') + ').' : 'Demo fehlgeschlagen: ' + (r.err || '')); renderAusbilder();
    } else if (a === 'a-data') {
      const sd = stDef(d.pid, d.sid), rows = sd ? slotRows(sd.out) : [];
      sheet('Daten: ' + (sd ? sd.out : ''), b => { b.innerHTML = rows.length ? tbl(rows) : '<p class="hint2">Noch nichts übergeben.</p>'; });
    } else if (a === 'a-check') {
      const r = safe(() => V().check(d.pid, d.sid), null); sheet('Prüfung neu: ' + ((stDef(d.pid, d.sid) || {}).title || d.sid), b => { b.innerHTML = r ? '<p class="bigp ' + (r.passed ? 'ok' : 'no') + '">' + Math.round(r.pct) + ' %</p>' + linesHtml(r) : '<p class="hint2">Keine Prüfung möglich (nichts übergeben).</p>'; });
    } else if (a === 'a-sol') {
      const g = snapGuard(); lsPut('lm4.kamp.free', '1'); let r; try { r = deliverSolution(d.pid, d.sid); } finally { restoreGuard(g); }
      toast(r && r.ok ? 'Musterlösung übergeben: ' + Math.round((r.check || {}).pct || 0) + ' %.' : 'Nicht möglich: ' + ((r && r.err) || 'Eingang fehlt?')); renderAusbilder();
    }
  }

  /* ============================================================ TaskTest (Musterlösung jedes Projekts, Stufe 2) */
  function memStorage() {
    const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(String(k), String(v)); }, removeItem: k => { m.delete(k); }, key: i => [...m.keys()][i] || null, get length() { return m.size; } };
  }
  async function testProject(pid) {
    const out = {}, v = V(), def = defOf(pid); if (!v || !def || typeof v.setStorage !== 'function') return null;
    const g = snapGuard(); let active = null; try { active = sessionStorage.getItem('verbund.active'); } catch (e) {}
    const mem = memStorage(); mem.setItem('lm4.kamp.free', '1');           /* Musterlösungen freigeben, alles in einem Wegwerf-Speicher */
    if (!v.setStorage(mem)) return { __err: 'Wegwerf-Speicher nicht angenommen' };
    try {
      const r = v.start(pid, { name: 'TaskTest', level: 2, again: true }); if (!r || !r.ok) throw new Error('Start: ' + (r && (r.msg || r.err)));
      const fid = def.final.id; out[fid] = { id: fid, startPct: Math.round((v.final(pid) || {}).pct || 0) };
      for (const sd of def.stations) {
        let sp = 0; try { if (typeof sd.starter === 'function') { const d0 = sd.starter(v.ctx(pid, sd.id)); const c0 = v.check(pid, sd.id, d0); sp = c0 && c0.ok !== false ? c0.pct : 0; } } catch (e) { sp = 0; }
        const sol = v.solution(pid, sd.id); let pct = 0, bad = [];
        if (!sol || sol.ok === false) bad = ['Musterlösung: ' + ((sol && (sol.msg || sol.err)) || 'fehlt')];
        else { const d = v.deliver(sd.out, { type: sol.type, data: sol.data, station: sd.id, from: 'vb' }, { demo: true, assisted: true }); if (!d || !d.ok) bad = ['Übergabe: ' + ((d && (d.msg || d.err)) || 'fehlgeschlagen')]; else { pct = d.check.pct; bad = (d.check.lines || []).filter(l => !l.ok).map(l => l.text); } }
        out[sd.id] = { id: sd.id, pct: Math.round(pct), startPct: Math.round(sp), bad };
      }
      const f = v.final(pid) || {}; Object.assign(out[fid], { pct: Math.round(f.pct || 0), bad: (f.lines || []).filter(l => !l.ok).map(l => l.text) });
    } catch (e) { out.__err = String(e && e.message || e); }
    finally { try { v.setStorage(root.localStorage); } catch (e) {} restoreGuard(g); try { if (active == null) sessionStorage.removeItem('verbund.active'); else sessionStorage.setItem('verbund.active', active); } catch (e) {} }
    return out;
  }
  root.TaskTest = async only => {
    const ids = only || projects().reduce((a, p) => { const d = defOf(p.id); return d ? a.concat(d.stations.map(s => s.id), [d.final.id]) : a; }, []), res = [], want = {};
    ids.forEach(id => { const pid = findPid(id); if (pid) (want[pid] = want[pid] || []).push(id); });
    for (const id of ids) {
      const pid = findPid(id); if (!pid) { res.push({ id, err: 'unbekannt' }); continue; }
      if (!cache[pid]) cache[pid] = await testProject(pid);
      const c = cache[pid]; if (!c || c.__err) { res.push({ id, err: c ? c.__err : 'Kern fehlt' }); continue; }
      const r = c[id]; res.push(r ? { id, pct: r.pct, startPct: r.startPct, bad: r.bad || [] } : { id, err: 'nicht getestet' });
    }
    return res;
  };

  /* ============================================================ Menü, Tastatur, Sprache, Schnittstellen */
  function openMenu() {
    const pid = S.pid && stateOf(S.pid) ? S.pid : null, sta = pid ? statusOf(pid) : null, nxt = pid ? safe(() => V().next(pid), null) : null;
    const rows = [
      ['print', 'Drucken', pid ? (sta && sta.finalState === 'passed' ? 'Zertifikat und Abschlussbericht (A4)' : 'Abschlussbericht (A4)') : 'Bericht oder Zertifikat eines gestarteten Projekts'],
      ['proj', 'Alle Projekte', 'Die fünf Verbundprojekte'],
      pid ? ['next', nxt === 'final' ? 'Weiter zum Gesamttest' : 'Weiter mit der nächsten Station', defOf(pid).name] : null,
      pid ? ['final', 'Gesamttest', 'Das fertige Gerät prüfen'] : null, pid ? ['bericht', 'Abschlussbericht', 'Alle Stationen mit Daten'] : null, pid ? ['zert', 'Zertifikat', 'Nach bestandenem Gesamttest'] : null,
      pid && messSlot(pid) ? ['csv', 'Messprotokoll als CSV', 'Messwerte für Excel (Semikolon, Komma als Dezimalzeichen)'] : null,
      pid ? ['share', 'Teilen', 'Code, Link, QR oder Datei für Partner und Sicherung'] : null,
      ['import', 'Aus Code oder Datei laden', 'Daten von einem Partner oder aus einer Sicherung'],
      pid ? ['reset', 'Projekt zurücksetzen', 'Eine Sicherung bleibt erhalten'] : null,
      ['calc', 'Rechner', 'Taschenrechner und Hilfen'], ['abz', 'Abzeichen', 'Deine Sammlung und was noch fehlt'], ['kamp', 'Kampagne: Das Abschlussgerät', 'Lernpfad mit Geschichte über alle Labs'], ['trainer', 'Trainer: Erste Schritte', 'Kurze Einführung zum Mitmachen'], ['voice', 'Sprachsteuerung', '„Öffne Station drei“, „Gesamttest“, „Tipp“'],
      ['neu', 'Neu in dieser Version', 'Was zuletzt dazukam und wo du es findest'], ['erg', 'Ergebnis senden', 'Code für den Ausbilder: meine bearbeiteten Aufgaben'], ['keys', 'Tastenkürzel', 'Alle Tasten (Taste ? drücken)'], ['aus', 'Ausbilder', 'Stationen freischalten, Musterlösungen, Beispielstände'], ['start', 'Zur Startseite', '']
    ].filter(Boolean);
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => '<button class="row" data-m="' + r[0] + '"><div class="grow"><b>' + esc(r[1]) + '</b>' + (r[2] ? '<small>' + esc(r[2]) + '</small>' : '') + '</div></button>').join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); menuAct(r.dataset.m); });
    });
  }
  function nextAction(pid) {
    const sta = statusOf(pid), n = safe(() => V().next(pid), null); if (!sta) { toast('Starte zuerst das Projekt.'); return; }
    if (n === 'final') go('final', pid); else if (n) go('station', pid, n); else go('project', pid);
  }
  function menuAct(m) {
    const pid = S.pid;
    switch (m) {
      case 'print': printNow(); break; case 'proj': go('list'); break; case 'next': nextAction(pid); break; case 'final': go('final', pid); break; case 'bericht': go('bericht', pid); break; case 'zert': go('zert', pid); break;
      case 'share': shareSheet(pid, S.sid); break; case 'import': importSheet(); break; case 'reset': resetAction(pid); break; case 'csv': exportCsv(pid); break;
      case 'calc': if (root.Rechner) root.Rechner.open(); break; case 'abz': if (root.Badges) root.Badges.open(); break; case 'kamp': if (root.Kampagne) root.Kampagne.open(); break; case 'trainer': if (root.Trainer) root.Trainer.start(); break; case 'voice': if (root.Voice) root.Voice.toggle(); break;
      case 'neu': if (root.LabNeu) root.LabNeu(); break; case 'erg': if (root.Auswertung) root.Auswertung.openSend(); break; case 'keys': keysSheet(); break; case 'aus': go('ausbilder'); break; case 'start': location.href = 'index.html'; break;
    }
  }
  /* Messprotokoll (Slot vom Typ mess.protocol) als CSV: Semikolon, Dezimalkomma, UTF-8 mit BOM (öffnet in Excel richtig) */
  const messSlot = pid => safe(() => (V().slots(pid) || []).find(x => x.type === 'mess.protocol'), null);
  function exportCsv(pid) {
    const sl = messSlot(pid), d = sl ? safe(() => V().get(sl.slot), null) : null; if (!d || !Array.isArray(d.rows)) { toast('Es gibt noch kein Messprotokoll in diesem Projekt.'); return; }
    const cell = v => { const t = v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const head = ['Kennung', 'Messgröße', 'Einheit', 'Soll', 'Ist', 'Toleranz', 'Messgerät'], lines = [head.join(';')].concat(d.rows.map(r => [r.id, r.label, r.unit, r.soll, r.ist, r.tol, r.instrument].map(cell).join(';')));
    saveText('messprotokoll-' + pid + '.csv', '﻿' + lines.join('\r\n') + '\r\n', 'text/csv'); stat('csv');
  }
  async function resetAction(pid) {
    const def = defOf(pid); if (!def || !stateOf(pid)) return;
    if (!await confirmBox('Projekt zurücksetzen?', 'Alle Stationen von „' + esc(def.name) + '“ werden gelöscht. Eine Sicherung des letzten Stands bleibt auf diesem Gerät erhalten. Deine Aufgaben-Ergebnisse in der Auswertung bleiben bestehen.', 'Zurücksetzen', true)) return;
    const r = safe(() => V().reset(pid, {}), null); S.finalRes = null; toast(r && r.ok === false ? 'Zurücksetzen fehlgeschlagen.' : 'Projekt zurückgesetzt.'); go('project', pid);
  }
  const keysHtml = () => '<table class="kv2" style="font-size:14px">' + [['?', 'Diese Hilfe'], ['M', 'Menü'], ['P', 'Alle Projekte'], ['W', 'Weiter mit der nächsten Station'], ['T', 'Gesamttest'], ['B', 'Abschlussbericht'], ['Z', 'Zertifikat'], ['S', 'Teilen'], ['Esc', 'Fenster schließen']].map(r => '<tr><td><kbd style="padding:1px 8px;border:1px solid var(--line);border-radius:5px;background:var(--panel2)">' + esc(r[0]) + '</kbd></td><td style="font-family:inherit;font-size:14px;color:var(--fg)">' + esc(r[1]) + '</td></tr>').join('') + '</table>';
  const keysSheet = () => sheet('Tastenkürzel', b => { b.innerHTML = keysHtml(); });
  const typing = e => { const t = e.target; return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); };
  window.addEventListener('keydown', e => {
    if (typing(e) || e.altKey || e.ctrlKey || e.metaKey || document.querySelector('.backdrop')) { if (e.key === 'Escape') { const x = $('.backdrop .x'); if (x) x.click(); } return; }
    const k = e.key, l = k.toLowerCase(), pid = S.pid && stateOf(S.pid) ? S.pid : null;
    if (k === '?') { e.preventDefault(); keysSheet(); } else if (l === 'm') openMenu(); else if (l === 'p') go('list');
    else if (pid && l === 'w') nextAction(pid); else if (pid && l === 't') go('final', pid); else if (pid && l === 'b') go('bericht', pid); else if (pid && l === 'z') go('zert', pid); else if (pid && l === 's') shareSheet(pid, S.sid);
  });
  /* Sprachbefehle: „öffne Station drei“, „Gesamttest“, „Tipp“; Prüfen und Übergeben passieren in der Leiste im Lab */
  function voice(text) {
    const c = parseVoice(text); if (!c) return null; const pid = S.pid && stateOf(S.pid) ? S.pid : null;
    if (c.cmd === 'open') { if (!pid) return 'Öffne zuerst ein Projekt.'; const sta = statusOf(pid), s = sta && sta.stations[c.n - 1]; if (!s) return 'Diese Station gibt es nicht.'; go('station', pid, s.id); return 'Station ' + c.n; }
    if (c.cmd === 'final') { if (!pid) return 'Öffne zuerst ein Projekt.'; go('final', pid); return 'Gesamttest'; }
    if (c.cmd === 'hub') { go(pid ? 'project' : 'list', pid); return 'Übersicht'; }
    if (c.cmd === 'hint') { if (S.view === 'station') { doHint(); return 'Tipp'; } return 'Öffne zuerst eine Station.'; }
    if (c.cmd === 'panel') { go('project', pid); const d = $('#dLast'); if (d) d.open = true; return 'Lastenheft'; }
    if (c.cmd === 'check' || c.cmd === 'give') return 'Prüfen und Übergeben gehen in der Leiste oben im Lab.';
    return null;
  }
  root.LabTrainerAPI = {
    lab: 'vb', tab: () => S.view, go: v => go(v, S.pid, S.sid), simMode: () => false, running: () => false,
    view: () => S.view, pid: () => S.pid, sid: () => S.sid, started: pid => !!stateOf(pid || S.pid), projectCount: () => projects().length,
    lastenheftOpened: () => S.flags.lastenheft > 0, stationViewed: () => S.flags.stationViews > 0, certViewed: () => S.flags.cert > 0, shared: () => S.flags.share > 0,
    anyStation: () => projects().some(p => { const s = statusOf(p.id); return s && s.stations.some(x => x.state === 'passed' || x.state === 'failed'); })
  };
  root.VerbundUI = { S, go, render, voice, printNow, demoLoad, snapGuard, restoreGuard, certHtml, berichtHtml, importSheet, shareSheet, testProject };

  /* ============================================================ Ereignisse */
  const view = $('#view');
  view.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, d = b.dataset, pid = d.pid || S.pid;
    if (a === 'lab') { safe(() => V().setActive(d.pid, d.sid), 0); return; }              /* Link folgt normal */
    if (b.tagName === 'A') return;
    e.preventDefault();
    switch (a) {
      case 'go-list': go('list'); break; case 'go-proj': go('project', pid); break; case 'go-st': go('station', pid, d.sid); break; case 'go-final': go('final', pid); break;
      case 'start': startSheet(pid); break; case 'import': importSheet(); break; case 'share': shareSheet(pid, S.view === 'station' ? S.sid : null); break;
      case 'bericht': go('bericht', pid); break; case 'zert': go('zert', pid); break; case 'reset': resetAction(pid); break; case 'print-doc': if (S.doc) printDoc(S.doc.html, S.doc.land); break;
      case 'hint': doHint(); break; case 'hint-old': showHintSheet(S.pid, S.sid, 0, false); break;
      case 'give': { const st = statusOf(S.pid), s = st && st.stations.find(x => x.id === S.sid), sd = stDef(S.pid, S.sid); if (root.Auswertung && s) root.Auswertung.handIn(S.sid, s.pct || 0, (defOf(S.pid).name || '') + ': ' + (sd ? sd.title : S.sid)); break; }
      case 'rstation': confirmBox('Station zurücksetzen?', 'Die Übergabe dieser Station wird gelöscht. Folgestationen zeigen dann „Eingang geändert“, nichts wird gelöscht.', 'Zurücksetzen', true).then(ok => { if (ok) { safe(() => V().resetStation(S.pid, S.sid), null); toast('Station zurückgesetzt.'); render(); } }); break;
      case 'runfinal': runFinal(); break;
      default: if (/^a-|^god$/.test(a)) aAction(a, d); break;
    }
  });
  view.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'gPw') aAction('god', {}); });
  $('#bMenu').onclick = openMenu; $('#bProj').onclick = () => go('list'); $('#bPrint').onclick = printNow;
  $('#bShare').onclick = () => { const pid = S.pid && stateOf(S.pid) ? S.pid : null; if (pid) shareSheet(pid, S.view === 'station' ? S.sid : null); else importSheet(); };
  let rT = 0; window.addEventListener('storage', e => { if (!e.key || e.key.indexOf('verbund.') !== 0 || e.key.indexOf('verbund.form') === 0) return; clearTimeout(rT); rT = setTimeout(() => { if (!document.querySelector('.backdrop') && !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))) render(); }, 300); });
  try { if (V() && typeof V().on === 'function') V().on('change', () => { clearTimeout(rT); rT = setTimeout(() => { if (!document.querySelector('.backdrop') && !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))) render(); }, 150); }); } catch (e) {}

  /* ============================================================ Start */
  function importFromHash() {
    const m = location.hash.match(/^#v=(.+)$/); if (!m) return; const code = decodeURIComponent(m[1]); history.replaceState(null, '', location.pathname + location.search); importSheet(code);
  }
  window.addEventListener('hashchange', importFromHash);
  function init() {
    if (!V()) { noKernel(); return; }
    readUrl(); render();
    safe(() => { const s = (root.VERBUND_QUEUE || []).length; if (s) console.warn('Verbund: ' + s + ' Projekte warten in der Warteschlange.'); }, 0);
    importFromHash();
    const pf = safe(() => JSON.parse(lsRaw('verbund.prefs', '{}')), {}) || {};
    if (!(pf.helpSeen && pf.helpSeen.hub) && !projects().some(p => stateOf(p.id))) { pf.helpSeen = Object.assign({}, pf.helpSeen, { hub: 1 }); lsPut('verbund.prefs', JSON.stringify(pf)); setTimeout(() => toast('Willkommen bei den Verbundprojekten! Wähle ein Projekt und tippe auf „Projekt starten“.'), 900); }
  }
  init();
})(window);
