'use strict';
/* Tonfunk Lab: „Stand exportieren“ (ab v23.145). Azubis erzeugen aus ihrem Lernstand eine kleine JSON-Datei, die der Ausbilder in ausbilder-uebersicht.html
   mit den Dateien der anderen Azubis zusammenlegt. Dateiweg: kein Server, keine Anmeldung, die Datei liegt zuerst nur auf dem Gerät des Azubis.

   ===== Schema „tonfunk-stand“, Version 1 (genaue Beschreibung: quelle/dash/UEBERSICHT.md) =====
   { format: 'tonfunk-stand', schema: 1, app: 'v23.145', created: ISO-Zeit, ts: ms, kuerzel: 'az07',
     tasks:  { aufgabenId: [prozent 0..100, höchste Tipp-Stufe 0..3] },          (aus sim.done + lm4.tdone, Tipps aus sim.hints)
     labs:   { labKey: [Aufgaben gesamt, davon 100 %, Durchschnitt % über alle Aufgaben] },   (Lernpfad-Fortschritt, wie auf der Startseite; ohne Hub „Projekte“)
     badges: { abzeichenId: ms },                                                  (lm4.badges)
     exam:   { hist: [ { v, area, t, pct, pts, max, note, secs, topics: { thema: [richtig, gesamt] } } ],   (pr.state.hist, höchstens 30)
               topics: { thema: [richtig, gesamt, bestes %] }, titles: { thema: 'Titel' },                 (pr.state.tr / best)
               cfg: { last: { v, g: [Themengruppen], nv: 'mix'|'leicht'|'schwer', n } | null },           (Auswahl der letzten Probeprüfung, ab v23.145; null ohne Eintrag)
               niveau: { 1: [richtig, gesamt], 2: [..], 3: [..] } },                                        (Summe über die exportierten Prüfungen nach Schwierigkeit; die hist-Einträge selbst bleiben unverändert)
     path:   { trainer: [labKey], kampagne: [Kapitelname], kampTotal: Zahl|null, stats: { kapitel, kampagne, vb1.. }, duels: Zahl, think: Zahl, predict: [richtig, gesamt] },
     weak:   { tasks: [ { id, lab, cat, p, h } ], topics: [ { k, t, p, n } ] } }   (versuchte, aber noch nicht gelöste Aufgaben; Prüfungsthemen unter 60 %)
   NICHT enthalten: Klarname (lm4.name), Passwort/Gate, Lösungen, Antworttexte, gespeicherte Schaltungen. Es gibt keine Bearbeitungsdauer und keine Versuchszahl in der App,
   deshalb stehen sie auch nicht in der Datei. Das Kürzel ist die einzige Kennung und soll ein Pseudonym sein. */
(function (root) {
  const SCHEMA = 1, FORMAT = 'tonfunk-stand', MAXHIST = 30;
  const KUERZEL_RE = /^[A-Za-z0-9ÄÖÜäöüß_.-]{2,24}$/;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = v => { v = +v; return isFinite(v) ? v : 0; };
  const idOk = k => /^[\w.\-]{1,40}$/.test(k);
  const pad = n => String(n).padStart(2, '0');
  const dateStr = t => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

  /* ---------- Kürzel ---------- */
  function checkKuerzel(s) {
    s = String(s == null ? '' : s).trim();
    if (!s) return { ok: false, msg: 'Bitte ein Kürzel eintragen, zum Beispiel az07 oder deinen Spitznamen.' };
    if (/\s/.test(s)) return { ok: false, msg: 'Bitte nur ein Wort ohne Leerzeichen. Ein Vor- und Nachname ist nicht nötig, nimm ein Kürzel.' };
    if (s.length < 2) return { ok: false, msg: 'Das Kürzel ist zu kurz (mindestens 2 Zeichen).' };
    if (s.length > 24) return { ok: false, msg: 'Das Kürzel ist zu lang (höchstens 24 Zeichen).' };
    if (!KUERZEL_RE.test(s)) return { ok: false, msg: 'Erlaubt sind Buchstaben, Ziffern, Punkt, Unterstrich und Bindestrich.' };
    return { ok: true, value: s };
  }
  const slug = s => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9._-]/g, '_');
  const fileName = (kuerzel, t) => 'tonfunk-stand-' + slug(kuerzel) + '-' + dateStr(t) + '.json';

  /* ---------- Thementitel der Prüfungs-Themen (nur wenn Fragenbank/Pool geladen sind) ---------- */
  function topicTitle(k, bank, pool) {
    const T = (bank && bank.TOPICS) || [], G = (pool && pool.groups) || [];
    let x = T.find(t => t.k === k); if (x) return x.t;
    const m = /^p:([^@]+)(?:@(\d))?$/.exec(k);
    if (m) {
      if (m[1] === 'alle') return 'Prüfungs-Pool gemischt' + (m[2] ? ' (Teil ' + m[2] + ')' : '');
      const g = G.find(y => y.k === m[1]); if (g) return g.t + (m[2] ? ' (Teil ' + m[2] + ')' : '');
    }
    return '';
  }

  /* ---------- Export-Objekt bauen (reine Funktion; read(key) liefert den gespeicherten Text oder null) ---------- */
  function build(o) {
    o = o || {}; const read = o.read || (() => null), G = o.G || {}, now = o.now || Date.now();
    const get = (k, d) => { try { const v = JSON.parse(read(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
    const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
    const rows = Array.isArray(G.AUFGABEN) ? G.AUFGABEN : [], REG = G.LAB_REG || {};
    const known = {}; rows.forEach(r => { known[r[0]] = r; });
    /* Aufgaben: bestes Ergebnis aus allen Labs, höchste Tipp-Stufe */
    const best = {};
    [get('sim.done', {}), get('lm4.tdone', {})].forEach(m => { if (isObj(m)) Object.keys(m).forEach(k => { const v = Math.round(num(m[k])); if (idOk(k) && isFinite(+m[k]) && m[k] !== null && m[k] !== '' && typeof m[k] !== 'boolean' && v >= 0 && (best[k] == null || v > best[k])) best[k] = clamp(v, 0, 100); }); });
    const hs = get('sim.hints', {}), tasks = {};
    Object.keys(best).forEach(k => { const h = isObj(hs) ? clamp(Math.round(num(hs[k])), 0, 3) : 0; tasks[k] = [best[k], h]; });
    /* Fortschritt je Lab (wie Lernpfad auf der Startseite: Anteil der Aufgaben mit 100 %) */
    const labs = {};
    Object.keys(REG).forEach(lab => {
      if ((REG[lab] || {}).hub) return;
      const rs = rows.filter(r => r[1] === lab); if (!rs.length) return;
      const ps = rs.map(r => (tasks[r[0]] || [0])[0]);
      labs[lab] = [rs.length, ps.filter(p => p >= 100).length, Math.round(ps.reduce((a, b) => a + b, 0) / rs.length)];
    });
    /* Abzeichen */
    const bd = get('lm4.badges', {}), badges = {};
    if (isObj(bd)) Object.keys(bd).slice(0, 400).forEach(k => { if (idOk(k)) badges[k] = Math.max(0, Math.round(num(bd[k]))); });
    /* Prüfungs-Lab (pr.state): Probeprüfungen und Themenstand, keine Antworten */
    const ps = get('pr.state', {}), exam = { hist: [], topics: {}, titles: {}, cfg: { last: null }, niveau: { 1: [0, 0], 2: [0, 0], 3: [0, 0] } };
    if (isObj(ps)) {
      (Array.isArray(ps.hist) ? ps.hist : []).filter(h => isObj(h) && (h.kind === 'exam' || h.kind == null)).slice(-MAXHIST).forEach(h => {
        const e = { v: String(h.v || '').replace(/[^\w-]/g, '').slice(0, 20), area: String(h.area || '').replace(/[^\w-]/g, '').slice(0, 20), t: Math.max(0, Math.round(num(h.t))), pct: clamp(Math.round(num(h.pct)), 0, 100), pts: num(h.pts), max: num(h.max), note: clamp(Math.round(num(h.note)), 0, 6), secs: Math.max(0, Math.round(num(h.secs))), topics: {} };
        if (isObj(h.topics)) Object.keys(h.topics).slice(0, 60).forEach(k => { const a = h.topics[k]; if (idOk(k.replace(/[:@]/g, '_')) && Array.isArray(a)) e.topics[k] = [Math.max(0, Math.round(num(a[0]))), Math.max(0, Math.round(num(a[1])))]; });
        exam.hist.push(e);
        if (isObj(h.byNiveau)) [1, 2, 3].forEach(k => { const a = h.byNiveau[k]; if (Array.isArray(a)) { exam.niveau[k][0] += Math.max(0, Math.round(num(a[0]))); exam.niveau[k][1] += Math.max(0, Math.round(num(a[1]))); } });
        if (isObj(h.cfg)) exam.cfg.last = { v: e.v, g: (Array.isArray(h.cfg.g) ? h.cfg.g : []).filter(x => typeof x === 'string' && idOk(x)).slice(0, 14), nv: ['mix', 'leicht', 'schwer'].includes(h.cfg.nv) ? h.cfg.nv : 'mix', n: clamp(Math.round(num(h.cfg.n)), 0, 100) };
      });
      const tr = isObj(ps.tr) ? ps.tr : {}, bs = isObj(ps.best) ? ps.best : {};
      Object.keys(tr).slice(0, 200).forEach(k => { const t = tr[k]; if (!isObj(t) || !idOk(k.replace(/[:@]/g, '_'))) return; const n = Math.max(0, Math.round(num(t.n))); if (n) exam.topics[k] = [Math.max(0, Math.round(num(t.r))), n, clamp(Math.round(num(bs[k])), 0, 100)]; });
      Object.keys(exam.topics).forEach(k => { const t = topicTitle(k, o.bank, o.pool); if (t) exam.titles[k] = String(t).slice(0, 80); });
    }
    /* Lernpfad, Kampagne und Zähler */
    const trn = get('lm4.trainer', {}), km = get('lm4.kamp', {}), st = get('lm4.stats', {}), du = get('lm4.duels', {}), th = get('lm4.think', {}), pr = get('lm4.predictstats', {});
    const path = { trainer: isObj(trn) ? Object.keys(trn).filter(k => trn[k] && idOk(k)).slice(0, 60) : [], kampagne: [], kampTotal: o.kampTotal == null ? null : Math.max(0, Math.round(num(o.kampTotal))), stats: {}, duels: isObj(du) ? Object.keys(du).length : 0, think: isObj(th) ? Object.keys(th).length : 0, predict: [isObj(pr) ? Math.max(0, Math.round(num(pr.right))) : 0, isObj(pr) ? Math.max(0, Math.round(num(pr.total))) : 0] };
    if (isObj(km) && Array.isArray(km.done)) path.kampagne = km.done.filter(x => typeof x === 'string').map(x => x.slice(0, 80)).slice(0, 40);
    if (isObj(st)) Object.keys(st).forEach(k => { if (/^(kapitel|kampagne|vb\w{0,8})$/.test(k) && isFinite(+st[k])) path.stats[k] = Math.max(0, Math.round(+st[k])); });
    /* schwache Themen: versucht, aber nicht 100 % (oder Tipp-Stufe 2 und höher bei noch offener Aufgabe) */
    const weak = { tasks: [], topics: [] };
    Object.keys(tasks).forEach(id => { const p = tasks[id][0], h = tasks[id][1]; if (p < 100 && (p > 0 || h > 0)) { const r = known[id]; weak.tasks.push({ id, lab: r ? r[1] : '', cat: r ? String(r[2]) : '', p, h }); } });
    weak.tasks.sort((a, b) => a.p - b.p || b.h - a.h || a.id.localeCompare(b.id)); weak.tasks = weak.tasks.slice(0, 80);
    Object.keys(exam.topics).forEach(k => { const t = exam.topics[k], p = Math.round(100 * t[0] / t[1]); if (t[1] >= 5 && p < 60) weak.topics.push({ k, t: exam.titles[k] || '', p, n: t[1] }); });
    weak.topics.sort((a, b) => a.p - b.p || b.n - a.n || a.k.localeCompare(b.k));
    const kz = checkKuerzel(o.kuerzel);
    return { format: FORMAT, schema: SCHEMA, app: String(o.app || ''), created: new Date(now).toISOString(), ts: now, kuerzel: kz.ok ? kz.value : String(o.kuerzel || ''), tasks, labs, badges, exam, path, weak };
  }

  /* Kontrolle: enthält die Datei verbotene Inhalte? (Test und Schutz gegen versehentliche Erweiterung) */
  function leaks(obj, secrets) {
    const txt = JSON.stringify(obj), out = [];
    (secrets || []).forEach(s => { if (s && txt.indexOf(String(s)) >= 0) out.push(String(s)); });
    ['"lm4.name"', '"lm4.gate"', '"lm4.god"', 'passwort', 'password', 'loesung', 'lösung'].forEach(w => { if (txt.toLowerCase().indexOf(w.toLowerCase()) >= 0) out.push(w); });
    return out;
  }

  /* ====================================================== Oberfläche ====================================================== */
  const KKEY = 'lm4.kuerzel';
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  function loadScript(src) { return new Promise(res => { const s = document.createElement('script'); s.src = src; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); }); }
  async function titlesReady(readFn) {
    let hasTopics = false; try { const ps = JSON.parse(readFn('pr.state') || 'null'); hasTopics = !!(ps && ps.tr && Object.keys(ps.tr).length); } catch (e) {}
    if (!hasTopics) return;
    if (!root.PR_BANK) await loadScript('pruefbank.js');
    if (!root.PR_POOL) await loadScript('pruefpool.js');
  }
  const CSS = `#standBox{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.7);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:calc(14px + env(safe-area-inset-top)) 14px calc(14px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch}
#standBox .sb{background:#222830;color:#e8ecf0;border:1px solid #38424d;border-radius:16px;max-width:560px;width:100%;padding:16px 18px;font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
#standBox h2{font-size:19px;margin:0 0 6px}#standBox p{margin:6px 0}#standBox .mu{color:#aab4bf;font-size:13px}
#standBox label{display:block;font-weight:600;margin:12px 0 4px}
#standBox input[type=text]{width:100%;min-height:44px;font:inherit;font-size:16px;color:#e8ecf0;background:#14181c;border:1px solid #5b6875;border-radius:10px;padding:8px 12px}
#standBox .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
#standBox button{min-height:44px;min-width:44px;padding:0 16px;border-radius:10px;border:1px solid #5b6875;background:#2c343e;color:#fff;font:600 15px system-ui,sans-serif;cursor:pointer}
#standBox button.pri{background:#1a6fd4;border-color:#1a6fd4}
#standBox button:focus-visible,#standBox input:focus-visible,#standBox summary:focus-visible{outline:3px solid #ffd166;outline-offset:2px}
#standBox .err{color:#ff9d92;min-height:20px;margin:6px 0 0}#standBox .ok{color:#6fe28a;min-height:20px;margin:6px 0 0}
#standBox details{margin-top:12px}#standBox summary{cursor:pointer;min-height:44px;display:flex;align-items:center}
#standBox pre{max-height:220px;overflow:auto;background:#14181c;border:1px solid #38424d;border-radius:8px;padding:8px;font:12px/1.4 ui-monospace,Consolas,monospace;white-space:pre-wrap;word-break:break-all}
@media (prefers-reduced-motion:no-preference){#standBox .sb{animation:sbIn .15s ease-out}}@keyframes sbIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`;
  let opener = null;
  function close() { const w = document.getElementById('standBox'); if (w) w.remove(); document.removeEventListener('keydown', onKey, true); if (opener && opener.focus) { try { opener.focus(); } catch (e) {} } opener = null; }
  function onKey(e) {
    const w = document.getElementById('standBox'); if (!w) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const f = Array.from(w.querySelectorAll('button,input,summary,a[href]')).filter(x => !x.disabled && x.offsetParent !== null); if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
    }
  }
  function makeObj(kuerzel) {
    return build({ read: ls.get, G: { AUFGABEN: root.AUFGABEN, LAB_REG: root.LAB_REG }, app: root.LAB_VERSION || '', kuerzel, bank: root.PR_BANK, pool: root.PR_POOL, kampTotal: root.Kampagne && root.Kampagne.CH ? root.Kampagne.CH.length : null });
  }
  async function open(from) {
    opener = from || document.activeElement; if (!document.getElementById('standCss')) { const s = document.createElement('style'); s.id = 'standCss'; s.textContent = CSS; document.head.appendChild(s); }
    await titlesReady(ls.get);
    const old = document.getElementById('standBox'); if (old) old.remove();
    const pre = makeObj(ls.get(KKEY) || ''), nT = Object.keys(pre.tasks).length, nB = Object.keys(pre.badges).length, nE = pre.exam.hist.length;
    const w = document.createElement('div'); w.id = 'standBox';
    w.innerHTML = `<div class="sb" role="dialog" aria-modal="true" aria-labelledby="stTitle" aria-describedby="stInfo">
      <h2 id="stTitle">Stand exportieren</h2>
      <p id="stInfo">Du erzeugst eine kleine Datei mit deinem Lernstand und gibst sie deinem Ausbilder. Darin stehen nur ein Kürzel, deine Aufgaben-Ergebnisse, Abzeichen und Prüfungs-Ergebnisse. Es stehen <b>keine Lösungen und keine Passwörter</b> darin, auch nicht dein Name.</p>
      <p class="mu">Im Moment: ${nT} Aufgaben, ${nB} Abzeichen, ${nE} Probeprüfungen.</p>
      <label for="stKz">Dein Kürzel (kein Klarname nötig)</label>
      <input type="text" id="stKz" maxlength="24" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-describedby="stHint stErr" value="${esc(ls.get(KKEY) || '')}">
      <p class="mu" id="stHint">Zum Beispiel az07 oder ein Spitzname. Dein Ausbilder sagt dir, was gilt. Ohne Leerzeichen, 2 bis 24 Zeichen.</p>
      <p class="err" id="stErr" role="alert"></p>
      <div class="row"><button class="pri" id="stSave" type="button">Als Datei speichern</button>${navigator.share && navigator.canShare ? '<button id="stShare" type="button">Teilen …</button>' : ''}<button id="stClose" type="button">Schließen</button></div>
      <p class="ok" id="stOk" role="status"></p>
      <details><summary>Inhalt der Datei ansehen</summary><pre id="stPre" tabindex="0" aria-label="Vorschau des Dateiinhalts"></pre></details>
      <p class="mu">Die Datei verlässt dein Gerät nur, wenn du sie selbst weitergibst (Ordner, Teams, Mail). Sie enthält Stand und Zeit von jetzt.</p></div>`;
    document.body.appendChild(w);
    const q = s => w.querySelector(s), kz = q('#stKz'), err = q('#stErr'), ok = q('#stOk'), prev = q('#stPre');
    const go = () => { const c = checkKuerzel(kz.value); if (!c.ok) { err.textContent = c.msg; ok.textContent = ''; kz.setAttribute('aria-invalid', 'true'); kz.focus(); return null; } err.textContent = ''; kz.removeAttribute('aria-invalid'); ls.set(KKEY, c.value); const obj = makeObj(c.value); return { obj, name: fileName(c.value, obj.ts), text: JSON.stringify(obj) }; };
    const showPrev = () => { const c = checkKuerzel(kz.value); const o = makeObj(c.ok ? c.value : '…'); prev.textContent = JSON.stringify(o, null, 1).slice(0, 6000) + (JSON.stringify(o, null, 1).length > 6000 ? '\n…' : ''); };
    q('details').addEventListener('toggle', showPrev); kz.addEventListener('input', () => { if (q('details').open) showPrev(); });
    q('#stSave').onclick = () => { const r = go(); if (!r) return; const a = document.createElement('a'), url = URL.createObjectURL(new Blob([r.text], { type: 'application/json' })); a.href = url; a.download = r.name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); ok.textContent = 'Gespeichert: ' + r.name + '. Lege die Datei in den Ordner, den dein Ausbilder nennt.'; };
    const sh = q('#stShare'); if (sh) sh.onclick = async () => { const r = go(); if (!r) return; const f = new File([r.text], r.name, { type: 'application/json' }); try { if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: 'Mein Stand im Tonfunk Lab' }); ok.textContent = 'Geteilt: ' + r.name; } else { ok.textContent = 'Teilen von Dateien geht auf diesem Gerät nicht. Nimm „Als Datei speichern“.'; } } catch (e) { if (e && e.name !== 'AbortError') ok.textContent = 'Teilen hat nicht geklappt. Nimm „Als Datei speichern“.'; } };
    q('#stClose').onclick = close; w.addEventListener('pointerdown', e => { if (e.target === w) close(); });
    kz.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); q('#stSave').click(); } });
    document.addEventListener('keydown', onKey, true); kz.focus();
  }
  function init() {
    document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('#standOpen'); if (a) { e.preventDefault(); open(a); } });
  }
  const Stand = { SCHEMA, FORMAT, build, checkKuerzel, fileName, slug, topicTitle, leaks, open, close, KEY: KKEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = Stand;
  else { root.Stand = Stand; if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); } }
})(typeof window !== 'undefined' ? window : globalThis);
