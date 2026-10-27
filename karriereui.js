'use strict';
/* Tonfunk Lab: Karriere-Dialog und Startseiten-Tür (nur Oberfläche).
   Rechnung: karriere.js (core), Daten: karrieredata.js, Geschichte: kampagne.js (render). Keine eigene Lab-Liste.
   model() und die html-Bausteine sind reine Funktionen (Node-testbar); Dialog und Speicher nur im Browser. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  const Karriere = isNode ? require('./karriere.js') : root.Karriere;
  if (!Karriere || !Karriere.core) return;
  const core = Karriere.core, KD = Karriere.DATA;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const TABS = [['rang', 'Rang'], ['spez', 'Spezialaufgaben'], ['gp', 'Generalprobe'], ['story', 'Geschichte']];

  /* ---------- reine Funktionen ---------- */
  function kampOK(D) { return (D.chAll && D.chAll.length ? D.chAll.every(t => D.kampDone.includes(t)) : false) || (+D.stats.kampagne || 0) >= 1; }
  /* Anzeige-Modell aus Eingaben (D wie core.read) */
  function model(D, ctx, free) {
    const L = core.level(D, ctx), cur = KD.LEVELS[L.n - 1], nx = L.next ? KD.LEVELS[L.n] : null;
    const pct = nx ? Math.max(0, Math.min(100, Math.round(100 * (L.xp - cur.xp) / Math.max(1, nx.xp - cur.xp)))) : 100, xpDone = !!nx && L.xp >= nx.xp;   // xpDone: XP-Ziel erreicht, es fehlt nur noch ein Meilenstein
    const ranks = KD.LEVELS.map(lv => {
      const ms = (lv.kap || []).map(t => ({ t: 'Kapitel „' + t + '“', ok: D.kampDone.includes(t), kap: t }));
      if (lv.kampagne) ms.push({ t: 'Hauptkampagne abgeschlossen', ok: kampOK(D) });
      if (lv.gpNote) ms.push({ t: 'Generalprobe mit Note ' + lv.gpNote + ' oder besser', ok: !!(L.gp && L.gp.note >= 1 && L.gp.note <= lv.gpNote) });
      return { n: lv.n, t: lv.t, xp: lv.xp, frei: lv.frei, status: lv.n < L.n ? 'fertig' : lv.n === L.n ? 'aktuell' : lv.n === L.n + 1 ? 'naechster' : 'gesperrt', xpOK: L.xp >= lv.xp, ms, story: lv.n <= L.n ? lv.story : null };
    });
    const parts = Object.keys(KD.XPKEY).map(k => ({ k, label: KD.XPKEY[k], v: L.parts[k] || 0 }));
    const need = [];
    if (L.need) {
      if (L.need.xp > 0) need.push(fmt(L.need.xp) + ' XP');
      L.need.kap.forEach(t => need.push('Kapitel „' + t + '“'));
      if (L.need.kampagne) need.push('Hauptkampagne abschließen');
      if (L.need.gp) need.push('Generalprobe mit Note ' + KD.GP.notePruefungsbester + ' oder besser');
    }
    const sp = core.specials(D, L.n, free);
    return { L, cur, nx, pct, xpDone, ranks, parts, need, sp, titleOf: n => (KD.LEVELS[n - 1] || {}).t || '' };
  }
  const bar = pct => '<div class="kr-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>';
  function rangHtml(M, extra) {
    extra = extra || {};
    const L = M.L, c = [];
    c.push('<div class="kr-c"><div class="kr-big">Rang ' + L.n + ' · ' + esc(L.t) + '</div>' + bar(M.pct)
      + '<div class="kr-sub">' + (M.nx ? (M.xpDone ? 'XP-Ziel erreicht (' + fmt(M.nx.xp) + ' XP)' : fmt(L.xp) + ' / ' + fmt(M.nx.xp) + ' XP') : fmt(L.xp) + ' XP · höchster Rang erreicht') + '</div>'
      + (M.nx ? '<p class="kr-nx"><b>Nächster Rang: ' + esc(M.nx.t) + '</b><br>' + (M.need.length ? (M.xpDone ? 'Es fehlt noch: ' : 'Braucht noch: ') + M.need.map(esc).join(' · ') : 'Alle Bedingungen erfüllt, der Aufstieg kommt gleich.') + '</p>' : '')
      + (extra.up ? '<p class="kr-up">🎉 Neuer Rang erreicht!</p>' : '')
      + '<p class="kr-story"><span>Meister Funk</span> „' + esc(M.cur.story) + '“</p></div>');
    const right = ['<div class="kr-c"><h3>Nächste Schritte</h3>' + (extra.coach && extra.coach.length ? '<ol class="kr-co">' + extra.coach.map(s => '<li><b>' + esc(s.title) + '</b><span>' + esc(s.text || '') + '</span>' + (s.href ? '<a class="kr-b" href="' + esc(s.href) + '">Los</a>' : '') + '</li>').join('') + '</ol>' : '<p class="kr-sub">Öffne ein Lab und löse eine Aufgabe. Dann erscheinen hier deine nächsten Schritte.</p>')
      + (extra.badges ? '<p class="kr-sub">Abzeichen ' + extra.badges.n + ' von ' + extra.badges.of + ' <button type="button" class="kr-b" data-act="badges">alle ansehen</button></p>' : '') + '</div>'];
    const parts = '<p class="kr-xp"><b>XP-Herkunft:</b> ' + M.parts.map(p => esc(p.label) + ' ' + fmt(p.v)).join(' · ') + '</p>';
    const list = '<div class="kr-c kr-full"><h3>Rangliste und Meilensteine</h3><ol class="kr-rk">' + M.ranks.map(r =>
      '<li class="' + r.status + '"><span class="ic" aria-hidden="true">' + (r.status === 'fertig' ? '✅' : r.status === 'aktuell' ? '🎓' : r.status === 'naechster' ? '▶️' : '🔒') + '</span><div><b>Rang ' + r.n + ': ' + esc(r.t) + '</b> <span class="kr-sub">ab ' + fmt(r.xp) + ' XP' + (r.n > 1 ? (r.xpOK ? ' ✓' : '') : '') + '</span>'
      + (r.ms.length ? '<ul>' + r.ms.map(m => '<li>' + (m.ok ? '✅' : '⬜') + ' ' + esc(m.t) + (!m.ok && m.kap ? ' <button type="button" class="kr-b" data-act="story">Zur Geschichte</button>' : '') + '</li>').join('') + '</ul>' : '')
      + '<br><span class="kr-sub">Schaltet frei: ' + esc(r.frei) + '</span>' + (r.story ? '<em>„' + esc(r.story) + '“</em>' : '') + '</div></li>').join('') + '</ol></div>';
    return '<div class="kr-g">' + c.join('') + right.join('') + '</div>' + '<div class="kr-c kr-full">' + parts + '</div>' + list;
  }
  /* Ziel einer Spezialaufgabe: Link, Aktion oder null (noch nicht verfügbar) */
  function target(s, env) {
    env = env || {};
    if (s.k === 'task') { const row = (env.AUFGABEN || []).find(r => r[0] === s.id), reg = row && (env.LAB_REG || {})[row[1]]; return reg ? { href: reg.file + '?aufgabe=' + s.id } : null; }
    if (s.k === 'escape') return { href: 'schaltplan.html?escape' };
    if (s.k === 'verbund') return { href: 'verbund.html' };
    if (s.k === 'duell') return env.duell ? { act: 'duell', st: s.st } : null;
    if (s.k === 'gp') return { act: 'gp' };
    return null;
  }
  function spezHtml(M, env) {
    return '<div class="kr-sg">' + M.sp.map(s => {
      const t = s.status === 'gesperrt' ? null : target(s, env);
      const ic = s.status === 'gesperrt' ? '🔒' : s.status === 'fertig' ? '✅' : '▶️';
      const txt = s.status === 'gesperrt' ? 'Ab Rang ' + s.ab + ' (' + esc(M.titleOf(s.ab)) + ')' : s.status === 'fertig' ? 'Erledigt' : s.k === 'duell' && !t ? 'Freigeschaltet, Start folgt mit dem Duell-Modus' : 'Freigeschaltet';
      return '<div class="kr-c kr-sp ' + s.status + '"><span class="ic" aria-hidden="true">' + ic + '</span><div style="flex:1;min-width:150px"><b>' + esc(s.t) + '</b><br><span class="kr-sub">' + txt + '</span></div>'
        + (t && t.href ? '<a class="kr-b"' + (s.k === 'task' ? ' data-kchal="' + esc(s.id) + '"' : '') + ' href="' + esc(t.href) + '">' + (s.status === 'fertig' ? 'Nochmal' : 'Los') + '</a>' : t && t.act ? '<button type="button" class="kr-b" data-act="' + t.act + '" data-st="' + (t.st || '') + '">Los</button>' : '') + '</div>';
    }).join('') + '</div>';
  }
  /* Generalprobe-Reiter: Status, Start (Link mit festem Seed), letzte Ergebnisse, Urkunde. D = core.read, now = Zeitstempel */
  function gpHtml(D, M, free, now, name) {
    const G = core.gpStatus(D, M.L.n, free, now), notes = { 1: 'sehr gut', 2: 'gut', 3: 'befriedigend', 4: 'ausreichend', 5: 'mangelhaft', 6: 'ungenügend' };
    const nt = n => 'Note ' + (Math.round(n * 10) / 10 + '').replace('.', ',') + (notes[Math.round(n)] ? ' (' + notes[Math.round(n)] + ')' : '');
    let h = '<div class="kr-g"><div class="kr-c"><h3>🎓 Generalprobe</h3><p class="kr-sub">Kammeraufbau Teil 2 (Systementwurf und Funktions- und Systemanalyse) wie in der Abschlussprüfung: ' + KD.GP.min + ' Minuten, Abgabe, Note. Keine Pause, keine Auflösung, keine Formelsammlung. Alle Azubis des Jahrgangs ' + esc(G.seed.jahrgang === '0000' ? '(Jahrgang noch nicht eingetragen)' : G.seed.jahrgang) + ' bekommen in der Kalenderwoche ' + esc(G.seed.kw.slice(5)) + ' dieselbe Prüfung. Eine neue Woche bringt eine neue Prüfung.</p>';
    if (!G.frei) h += '<p><b>🔒 Ab Rang ' + G.ab + ' (' + esc(M.titleOf(G.ab)) + ')</b></p>';
    else h += '<p><a class="kr-b" id="krGpGo" href="' + esc(KD.GP.url + G.seed.seed) + '">Starten (' + KD.GP.min + ' min)</a></p><p class="kr-sub">Die Prüfung beginnt sofort und läuft auch weiter, wenn du die Seite kurz verlässt.</p>';
    h += '</div><div class="kr-c"><h3>Dein Ergebnis</h3>';
    h += G.best ? '<p class="kr-big">' + nt(G.best.note) + ' · ' + G.best.pct + ' %</p><p class="kr-sub">Bestes Ergebnis. Für Rang 10 „Prüfungsbester“ brauchst du Note ' + G.schwelle + ' oder besser: ' + (G.bester ? 'erreicht ✓' : 'noch nicht erreicht') + '.</p>' : '<p class="kr-sub">Noch keine Generalprobe abgegeben. Rang 10 „Prüfungsbester“ braucht Note ' + G.schwelle + ' oder besser in einer Generalprobe.</p>';
    if (G.runs.length) h += '<ul class="kr-gl">' + G.runs.map(r => '<li>' + new Date(r.t).toLocaleDateString('de-DE') + ': ' + nt(r.note) + ', ' + r.pct + ' %</li>').join('') + '</ul>';
    h += '</div></div><div class="kr-c kr-full"><h3>Urkunde</h3>';
    const U = core.urkunde(D, M.L.n, name);
    h += U ? '<p class="kr-sub">Urkunde „' + esc(U.titel) + '“ (A4 quer, Druck oder PDF über den Browser). Der Name wird nur für den Druck verwendet und nicht gespeichert.</p><div class="kr-row"><label class="kr-sub" for="krName">Name auf der Urkunde</label><input id="krName" class="kr-in" maxlength="60" autocomplete="off" value="' + esc(name || D.kuerzel || '') + '"><button type="button" class="kr-b" data-act="print">Urkunde drucken</button></div>' : '<p class="kr-sub">Die Urkunde gibt es nach deiner ersten Generalprobe.</p>';
    return h + '</div>';
  }
  /* Urkunde als Druckseite (nach dem Muster des Verbund-Zertifikats): A4 quer, Titel, Rang, Datum, Note, Name, Prüfcode */
  function urkundeHtml(U) {
    return '<div class="kr-paper"><div class="kr-cert"><div class="kr-ch"><img class="kr-lg" src="logo-full.png" alt="Tonfunk" onerror="this.style.display=\'none\'"><span>Tonfunk Lehrwerkstatt</span></div>'
      + '<h1>URKUNDE</h1><div class="kr-cs">' + esc(U.titel) + '</div><div class="kr-cn">' + esc(U.name) + '</div>'
      + '<div class="kr-cp">hat die Generalprobe zur Abschlussprüfung (Kammeraufbau Teil 2) am ' + esc(U.datum) + ' mit <b>Note ' + esc(String(U.note).replace('.', ',')) + '</b> (' + esc(U.pct) + ' %) abgelegt<br>und den Rang <b>' + esc(U.rang) + ' · ' + esc(U.rangTitel) + '</b> erreicht.</div>'
      + '<div class="kr-cc">Prüfcode ' + esc(U.code) + '</div><div class="kr-sig"><div>Ort, Datum</div><div>Unterschrift Ausbilder</div></div></div></div>';
  }
  const ui = { model, rangHtml, spezHtml, target, kampOK, fmt, gpHtml, urkundeHtml };

  if (isNode) { module.exports = ui; }
  if (typeof document === 'undefined') { Karriere.ui = ui; return; }

  /* ---------- Browser: Zustand, Dialog, Startseiten-Tür ---------- */
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); if (v == null) return d; try { return JSON.parse(v); } catch (e) { return v; } } catch (e) { return d; } };
  const freeOn = () => { try { return localStorage.getItem('lm4.kamp.free') === '1'; } catch (e) { return false; } };
  function state() {
    const Kp = root.Kampagne, B = root.Badges;
    const D = core.read(lsGet, Kp ? { CH: Kp.CH, mdone: Kp.mdone, virtual: true } : { virtual: true });
    return { D, M: model(D, { AUFGABEN: root.AUFGABEN, DEFS: B && B.DEFS ? B.DEFS.map(d => Array.isArray(d) ? d[0] : d.id) : null }, freeOn()) };
  }
  /* kurze Zusammenfassung für Karte und Lernpfad-Band */
  function summary() {
    try {
      const S = state(), M = S.M, Kp = root.Kampagne;
      const kt = Kp ? Kp.CH.reduce((n, c) => n + c.m.length, 0) : 0, kd = Kp ? Kp.CH.reduce((n, c) => n + Kp.prog(c).d, 0) : 0;
      return { n: M.L.n, t: M.L.t, xp: M.L.xp, xpDone: M.xpDone, next: M.nx ? { t: M.nx.t, xp: M.nx.xp } : null, pct: M.pct, kt, kd };
    } catch (e) { return null; }
  }
  /* Karriere-Start: beim ersten Öffnen des Dialogs wird der Startstand (lm4.karriere.k0) gespeichert; XP zählen ab da, Altdaten nicht. Der Rang-Marker beginnt bei 1. */
  function start() {
    try {
      const Kp = root.Kampagne, had = lsGet('lm4.karriere', {}), fresh = !(had && had.k0);
      core.start(lsGet, (k, v) => { try { if (fresh && v && typeof v === 'object') v.seen = { level: 1 }; localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, Kp ? { CH: Kp.CH, mdone: Kp.mdone } : null);
    } catch (e) {}
  }
  /* Rang-Aufstieg einmalig feiern; speichert nur den „gesehen“-Marker, XP und Rang werden immer neu gerechnet */
  function check(silent) {
    try {
      const S = state(), n = S.M.L.n; let kar = lsGet('lm4.karriere', {}); if (!kar || typeof kar !== 'object') kar = {};
      kar.v = 1; kar.seen = kar.seen && typeof kar.seen === 'object' ? kar.seen : {};
      const was = kar.seen.level, up = was != null && n > was;
      if (was == null || n > was) { kar.seen.level = n; try { localStorage.setItem('lm4.karriere', JSON.stringify(kar)); } catch (e) {} }
      if (root.Badges && root.Badges.stat) root.Badges.stat('rang', n, 'max'); else { const st = lsGet('lm4.stats', {}); if (st && typeof st === 'object' && !(st.rang >= n)) { st.rang = n; try { localStorage.setItem('lm4.stats', JSON.stringify(st)); } catch (e) {} } }   // Startseite lädt badges.js nicht: Marker direkt schreiben, die Labs werten ihn aus
      if (up && !silent) { toast('🎓 Neuer Rang: ' + S.M.L.t); if (root.Badges && root.Badges.confetti) root.Badges.confetti(n >= 9); }
      return up;
    } catch (e) { return false; }
  }
  function toast(t) {
    if (root.LabUI && root.LabUI.toast) { root.LabUI.toast(t); return; }
    const d = document.createElement('div'); d.setAttribute('role', 'status'); d.className = 'kr-toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 4500);
  }
  const CSS = '.kr-ov{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.62);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:calc(12px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom))}'
    + '.kr{background:var(--panel,#1f262e);color:var(--fg,#e8eaed);border:1px solid var(--line,#38424d);border-radius:14px;padding:16px;width:100%;max-width:1000px;font:15px/1.45 system-ui,sans-serif;box-sizing:border-box}'
    + '.kr h3{margin:0 0 8px;font-size:16px}.kr-hd{display:flex;justify-content:space-between;align-items:center;gap:8px}.kr-hd b{font-size:19px}'
    + '.kr-x{min-width:44px;min-height:44px;background:none;border:0;color:inherit;font-size:22px;cursor:pointer}'
    + '.kr-tabs{display:flex;gap:6px;margin:10px 0;overflow-x:auto}.kr-tab{flex:none;min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line,#38424d);background:var(--panel2,#252d36);color:var(--fg,#e8eaed);font:600 14px system-ui,sans-serif;cursor:pointer}'
    + '.kr-tab[aria-selected=true]{background:var(--accent-bg,#1a6fd4);border-color:transparent;color:#fff}'
    + '.kr-g{display:grid;gap:12px;grid-template-columns:1fr;margin-bottom:12px}@media(min-width:900px){.kr-g{grid-template-columns:1fr 1fr}}'
    + '.kr-c{background:var(--panel2,#252d36);border:1px solid var(--line,#38424d);border-radius:12px;padding:12px 14px;min-width:0}.kr-full{margin-bottom:12px}'
    + '.kr-big{font-size:20px;font-weight:700}.kr-sub{color:var(--fg,#e8eaed);font-size:13px}.kr-bar{height:12px;border-radius:8px;background:var(--well,#10151a);overflow:hidden;margin:8px 0}.kr-bar i{display:block;height:100%;background:var(--ok,#4cd964)}'
    + '.kr-nx{margin:8px 0}.kr-up{margin:6px 0;font-weight:700}.kr-story{margin:8px 0 0;font-style:italic}.kr-story span{font-style:normal;font-weight:700;color:var(--accent,#6cb8ff)}'
    + '.kr-b{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border-radius:10px;border:0;background:var(--accent-bg,#1a6fd4);color:#fff;font:600 14px system-ui,sans-serif;text-decoration:none;cursor:pointer}'
    + '.kr-co{margin:0;padding-left:0;list-style:none}.kr-co li{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;margin:6px 0}.kr-co li b{flex:1 1 100%}.kr-co li span{flex:1;min-width:140px;color:var(--fg,#e8eaed);font-size:13px}'
    + '.kr-xp{margin:0;font-size:14px}.kr-rk{list-style:none;margin:0;padding:0}.kr-rk>li{display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--line,#38424d)}.kr-rk>li:first-child{border-top:0}.kr-rk .ic{font-size:20px;flex:none}'
    + '.kr-rk ul{list-style:none;margin:4px 0;padding:0}.kr-rk ul li{margin:6px 0}.kr-rk em{display:block;font-size:13px;margin-top:2px}'
    + '.kr-sg{display:grid;gap:10px;grid-template-columns:1fr}@media(min-width:900px){.kr-sg{grid-template-columns:1fr 1fr}}.kr-sp{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.kr-sp .ic{font-size:22px}'
    + '.kr-gl{margin:6px 0 0;padding-left:18px;font-size:13px}.kr-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.kr-in{min-height:44px;padding:0 10px;border-radius:10px;border:1px solid var(--line,#38424d);background:var(--well,#10151a);color:var(--fg,#e8eaed);font:15px system-ui,sans-serif;flex:1;min-width:160px;box-sizing:border-box}.kr-door{margin:0}.kr-toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:95;background:var(--panel,#1f262e);color:var(--fg,#e8eaed);border:1px solid var(--line,#38424d);border-radius:12px;padding:12px 18px;font:600 15px system-ui,sans-serif}';
  function css() { if (document.getElementById('krCss')) return; const s = document.createElement('style'); s.id = 'krCss'; s.textContent = CSS; document.head.appendChild(s); }

  /* Druck: eigener Container, alles andere im Druck ausgeblendet; danach aufräumen */
  function printUrkunde(U) {
    const old = document.getElementById('krPrint'); if (old) old.remove();
    const st = document.createElement('style'); st.id = 'krPrintCss';
    st.textContent = '#krPrint{display:none}@media print{@page{size:A4 landscape;margin:8mm}body>*:not(#krPrint){display:none!important}#krPrint{display:block!important;background:#fff;color:#111}}'
      + '#krPrint .kr-paper{width:100%;box-sizing:border-box}#krPrint .kr-cert{border:6px double #1a4f8b;padding:18mm 16mm;min-height:180mm;text-align:center;font-family:Georgia,serif;box-sizing:border-box}'
      + '#krPrint .kr-ch{display:flex;justify-content:space-between;align-items:center;font:12px system-ui,sans-serif;color:#555}#krPrint .kr-lg{height:44px}#krPrint h1{font-size:44px;letter-spacing:8px;margin:18px 0 4px;color:#1a4f8b}'
      + '#krPrint .kr-cs{font-size:26px;font-weight:700}#krPrint .kr-cn{font-size:34px;margin:22px 0;border-bottom:1px solid #999;display:inline-block;min-width:60%;padding-bottom:4px}#krPrint .kr-cp{font-size:18px;line-height:1.7}'
      + '#krPrint .kr-cc{margin-top:26px;font:13px monospace;color:#444}#krPrint .kr-sig{display:flex;justify-content:space-around;margin-top:50px;font:13px system-ui,sans-serif}#krPrint .kr-sig div{border-top:1px solid #333;padding-top:4px;min-width:30%}';
    const d = document.createElement('div'); d.id = 'krPrint'; d.innerHTML = urkundeHtml(U);
    const clean = () => { d.remove(); st.remove(); window.removeEventListener('afterprint', clean); };
    document.head.appendChild(st); document.body.appendChild(d); window.addEventListener('afterprint', clean);
    setTimeout(() => { try { window.print(); } catch (e) {} }, 80);
  }
  function open(tab) {
    if (document.getElementById('krBox')) return;
    start(); css(); const up = check(true), opener = document.activeElement; let cur = TABS.some(t => t[0] === tab) ? tab : 'rang';
    const w = document.createElement('div'); w.id = 'krBox'; w.className = 'kr-ov';
    w.innerHTML = '<div class="kr" role="dialog" aria-modal="true" aria-labelledby="krT"><div class="kr-hd"><b id="krT">🎓 Deine Karriere</b><button type="button" class="kr-x" id="krX" aria-label="Schließen">✕</button></div><div class="kr-tabs" role="tablist">'
      + TABS.map(t => '<button type="button" class="kr-tab" role="tab" data-t="' + t[0] + '">' + t[1] + '</button>').join('') + '</div><div id="krBody"></div></div>';
    const close = () => { w.remove(); document.removeEventListener('keydown', onKey); if (opener && opener.focus) try { opener.focus(); } catch (e) {} };
    const onKey = e => { if (e.key === 'Escape') close(); };
    const body = w.querySelector('#krBody');
    const draw = () => {
      w.querySelectorAll('.kr-tab').forEach(b => b.setAttribute('aria-selected', b.dataset.t === cur ? 'true' : 'false'));
      if (cur === 'story') { if (root.Kampagne && root.Kampagne.render) root.Kampagne.render(body, { head: false, tokens: true, close }); else body.innerHTML = '<p class="kr-sub">Die Geschichte ist nicht geladen.</p>'; return; }
      const S = state();
      if (cur === 'rang') {
        let coach = null; try { coach = root.Coach && root.Coach.current ? root.Coach.current() : null; } catch (e) { coach = null; }
        const B = root.Badges;
        body.innerHTML = rangHtml(S.M, { up, coach: coach && coach.slice(0, 3), badges: B && B.DEFS && B.earnedIds ? { n: B.earnedIds().length, of: B.DEFS.length } : null });
      } else if (cur === 'gp') {
        const nm = body.querySelector('#krName') ? body.querySelector('#krName').value : null; body.innerHTML = gpHtml(S.D, S.M, freeOn(), Date.now(), nm);
      } else body.innerHTML = spezHtml(S.M, { AUFGABEN: root.AUFGABEN, LAB_REG: root.LAB_REG, duell: !!(root.Duell && root.Duell.open) });
      body.querySelectorAll('[data-kchal]').forEach(a => { a.addEventListener('click', () => { try { localStorage.setItem('lm4.kchal', JSON.stringify({ a: a.dataset.kchal, t: Date.now() })); } catch (e) {} }); });   /* Start-Flag: Tipps dieser Spezialaufgabe mindern XP */
      body.querySelectorAll('[data-act]').forEach(b => { b.onclick = () => {
        const a = b.dataset.act;
        if (a === 'story') { cur = 'story'; draw(); } else if (a === 'gp') { cur = 'gp'; draw(); } else if (a === 'print') { const U = core.urkunde(S.D, S.M.L.n, (body.querySelector('#krName') || {}).value); if (U) printUrkunde(U); } else if (a === 'badges' && root.Badges && root.Badges.open) { close(); root.Badges.open(); } else if (a === 'duell' && root.Duell && root.Duell.open) { close(); root.Duell.open({ art: 'neu', st: +b.dataset.st || 1 }); }
      }; });
    };
    w.querySelectorAll('.kr-tab').forEach(b => { b.onclick = () => { cur = b.dataset.t; draw(); }; });
    w.querySelector('#krX').onclick = close; w.addEventListener('pointerdown', e => { if (e.target === w) close(); }); document.addEventListener('keydown', onKey);
    document.body.appendChild(w); draw(); w.querySelector('#krX').focus();
  }
  Object.assign(Karriere, { ui, open, summary, check });
  /* Startseite: EINE Tür. Die Kampagnen-Karte (#kampCard) entfällt; falls das Lernpfad-Band fehlt, wird eine eigene Karte unter den Lab-Karten angelegt. */
  function door() {
    const old = document.getElementById('kampCard'); if (old) old.remove();
    if (document.getElementById('lpKamp') || document.getElementById('karCard')) return;
    const cards = document.querySelector('.cards'), s = summary(); if (!cards || !s) return;
    const c = document.createElement('div'); c.id = 'karCard'; c.className = 'kr-door';
    c.style.cssText = 'margin:14px auto;max-width:900px;padding:14px 16px;border-radius:14px;border:1px solid var(--line,#38424d);background:var(--panel,#1f262e);color:var(--fg,#e8eaed);display:flex;gap:12px;align-items:center;flex-wrap:wrap';
    c.innerHTML = '<span style="font-size:28px">🎓</span><div style="flex:1;min-width:200px"><b>Deine Karriere: Rang ' + s.n + ' · ' + esc(s.t) + '</b><br><span class="kr-sub">' + fmt(s.xp) + ' XP' + (s.next ? (s.xpDone ? ' · XP-Ziel erreicht (' + fmt(s.next.xp) + ' XP)' : ' · nächster Rang bei ' + fmt(s.next.xp)) : '') + '</span></div><button type="button" class="kr-b">Öffnen</button>';
    css(); c.querySelector('button').onclick = () => open(); cards.parentNode.insertBefore(c, cards.nextSibling);
  }
  const init = () => { door(); const m = /[?&]karriere(?:=(\w+))?/.exec(location.search); if (m) setTimeout(() => { const g = document.getElementById('gate'); if (g && g.offsetParent !== null) { const t = setInterval(() => { const gg = document.getElementById('gate'); if (!gg || gg.offsetParent === null) { clearInterval(t); open(m[1]); } }, 500); } else open(m[1]); }, 600); else setTimeout(() => check(false), 4000); };
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})(typeof window !== 'undefined' ? window : globalThis);
