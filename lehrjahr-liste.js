'use strict';
/* Tonfunk Lab: Aufgabenlisten und Aufgabenfolge nach Lehrjahr (Paket L3, 16.11.2026). Reine Logik (node-testbar) plus Browserteil; window.LehrjahrListe bzw. module.exports.
   Gilt nur, wenn Lehrjahr.gilt(Beruf) und ein eigenes Lehrjahr gesetzt ist (Lehrjahr.wirksam, lehrjahr.js). Sonst tut dieses Modul nichts: alle Listen und Abläufe bleiben wie bisher.
   Nichts wird gesperrt, Fortschritt, Orden, 100 % und gespeicherte Ergebnisse bleiben unberührt.

   1. LISTE (DOM): Jede Aufgabenliste mit dem gemeinsamen Markup (Zeilen button.row mit data-t oder data-id, Kategorie-Überschriften .gh oder .sh) wird nach dem Aufbau umgeordnet:
      zuerst die Aufgaben bis zum eigenen Lehrjahr (Reihenfolge: Lehrjahr, dann bisherige Reihenfolge), darunter je Lehrjahr eine Überschrift "Kommt im N. Lehrjahr" mit den späteren Aufgaben (gedämpft, frei wählbar).
      Die Zeilen selbst werden nur verschoben (nicht kopiert), die Klick-Behandlung der Labs bleibt also unverändert. Der MutationObserver ist unschädlich: Das Umordnen ist idempotent
      (ist die Liste schon so geordnet, passiert nichts), er wird während des eigenen Umbaus abgekoppelt.
   2. FOLGE: weiter(lab, ids, aktuell, erledigt) für Labs mit eigener "Nächste Aufgabe"-Logik, erlaubt(id) für Zufalls- und Tagesvorschläge; die Leiste "Nächste Aufgabe" (weiter.js) nutzt kontext().
   3. HINWEISE: Wer bewusst eine spätere Aufgabe wählt (Klick in der Liste oder Adresse ?aufgabe=): kleiner Hinweis "Diese Aufgabe gehört zum N. Lehrjahr." (nicht blockierend, schließbar, verschwindet von selbst).
      Ist der Teil des eigenen Lehrjahres geschafft: "Den Teil für das N. Lehrjahr hast du geschafft. Weiter geht es im nächsten Lab." mit Knopf zur Startseite. */
(function (root) {
  const KOPF_CSS_ID = 'ljListeCss', HINT_ID = 'ljHinweis';
  const ID = /^[A-Za-z0-9_.-]{1,40}$/;

  /* ---------------------------------------------------------------- 1. Reine Logik */
  const kopf = lj => 'Kommt im ' + lj + '. Lehrjahr';
  const hinweisText = lj => 'Diese Aufgabe gehört zum ' + lj + '. Lehrjahr.';
  const fertigKopf = lj => 'Den Teil für das ' + lj + '. Lehrjahr hast du geschafft.';
  const fertigText = () => 'Weiter geht es im nächsten Lab.';

  /* Plan für eine Liste. es: [{ id, kat, lj }] in der bisherigen Reihenfolge (kat = Text der Kategorie-Überschrift oder null), lj = eigenes Lehrjahr.
     Ergebnis: Folge von { t: 'k', kat } (Kategorie-Überschrift), { t: 'r', e } (Zeile), { t: 'l', lj } (Überschrift "Kommt im N. Lehrjahr").
     Erst Aufgaben bis zum eigenen Lehrjahr (Lehrjahr, dann bisherige Reihenfolge), dann je späterem Lehrjahr ein Block in bisheriger Reihenfolge. Kategorie-Überschriften wiederholen sich, wenn die Kategorie wechselt. */
  function bauePlan(es, lj) {
    const out = []; let last;
    const reihe = list => list.forEach(e => { if (e.kat != null && e.kat !== last) { out.push({ t: 'k', kat: e.kat }); last = e.kat; } out.push({ t: 'r', e }); });
    const idx = es.map((e, i) => ({ e, i }));
    reihe(idx.filter(x => x.e.lj <= lj).sort((a, b) => a.e.lj - b.e.lj || a.i - b.i).map(x => x.e));
    [2, 3, 4].forEach(j => {
      if (j <= lj) return;
      const g = es.filter(e => e.lj === j); if (!g.length) return;
      out.push({ t: 'l', lj: j }); last = undefined; reihe(g);
    });
    return out;
  }
  /* Kurzform eines Plans zum Vergleich (Idempotenz): 'k:Text', 'r:id', 'l:2' */
  const zeichen = plan => plan.map(p => p.t === 'k' ? 'k:' + p.kat : p.t === 'r' ? 'r:' + p.e.id : 'l:' + p.lj);

  /* Folge: nächste noch nicht erledigte erlaubte Aufgabe. ids: alle Aufgaben-IDs des Labs in bisheriger Reihenfolge, ljVon(id) -> Lehrjahr, lj = eigenes Lehrjahr,
     aktuell = gerade bearbeitete Aufgabe, erledigt(id) -> bool. Reihenfolge: Lehrjahr, dann bisherige Reihenfolge; danach wieder von vorn. null, wenn im Teil nichts mehr offen ist. */
  function folge(ids, ljVon, lj, aktuell, erledigt) {
    const list = ids.map((id, i) => ({ id, i, lj: ljVon(id) })).filter(x => x.lj <= lj).sort((a, b) => a.lj - b.lj || a.i - b.i).map(x => x.id);
    const i = list.indexOf(aktuell), n = list.length;
    for (let k = 1; k <= n; k++) { const id = list[(i + k + n) % n]; if (id !== aktuell && !erledigt(id)) return id; }
    return null;
  }

  const api = { kopf, hinweisText, fertigKopf, fertigText, bauePlan, zeichen, folge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LehrjahrListe = Object.assign(root.LehrjahrListe || {}, api);

  /* ---------------------------------------------------------------- 2. Browserteil */
  if (typeof document === 'undefined' || !root.document || root.__lm4LjListe) return;
  root.__lm4LjListe = true;
  const doc = root.document;
  let FILE = ''; try { FILE = String(root.location.pathname || '').split('/').pop(); } catch (e) { FILE = ''; }
  const LS = (() => { try { return root.localStorage; } catch (e) { return null; } })();
  const MODUS = /[?&](duell|wett|wettbewerb|probe|probetest|pruefung|exam|verbund)(=|&|#|$)/i;

  /* Welches Lab ist diese Seite, welcher Beruf, welches Lehrjahr? null = nichts tun (alles wie bisher) */
  function kontext() {
    try {
      const L = root.Lehrjahr, R = root.LAB_REG; if (!L || !R || !L.gilt || !L.wirksam) return null;
      const beruf = root.BerufReg && root.BerufReg.cur ? root.BerufReg.cur() : 'egs';
      if (!L.gilt(beruf)) return null;
      const lj = L.wirksam(); if (!(lj >= 1 && lj <= 4)) return null;
      let lab = '';
      Object.keys(R).forEach(k => { if (!lab && R[k] && R[k].file === FILE && !R[k].hub) lab = k; });
      if (!lab) return null;
      /* Gehört das ganze Lab erst in ein späteres Lehrjahr (keine einzige Aufgabe bis zum eigenen), gibt es nichts zu ordnen: das Lab selbst ordnet der Lernpfad ein */
      const rows = (root.AUFGABEN || []).filter(r => r[1] === lab);
      if (rows.length && !rows.some(r => L.ab(r[0], lab) <= lj)) return null;
      return { lab, beruf, lj };
    } catch (e) { return null; }
  }
  const idsDes = k => { try { return root.Lehrjahr.teil(k.lab, k.beruf, 4); } catch (e) { return []; } };
  /* Darf diese Aufgabe von sich aus vorgeschlagen werden? (ohne Lehrjahr: immer ja) */
  function erlaubt(id, lab) {
    const k = kontext(); if (!k) return true;
    try { return root.Lehrjahr.ab(id, lab || k.lab) <= k.lj; } catch (e) { return true; }
  }
  /* Nächste Aufgabe für Labs mit eigener Folge-Logik. undefined = Filter aus (Aufrufer nimmt seine alte Logik); { id } mit id oder null (Teil geschafft, Hinweis wird gezeigt) */
  function weiter(lab, ids, aktuell, erledigt) {
    const k = kontext(); if (!k) return undefined;
    const id = folge(ids, i => root.Lehrjahr.ab(i, lab || k.lab), k.lj, aktuell, erledigt);
    if (id == null) zeigeFertig(k.lj);
    return { id };
  }

  /* ---------- Stil ---------- */
  function stil() {
    if (doc.getElementById(KOPF_CSS_ID) || !doc.head) return;
    const st = doc.createElement('style'); st.id = KOPF_CSS_ID;
    st.textContent = '.ljh{margin-top:16px;padding-top:12px;border-top:2px dashed var(--line,#38424d);color:var(--fg,#e8ecf0);text-transform:none;letter-spacing:0;font-size:15px}'
      + '[data-lj-p] .row small{font-size:14px}'
      + '.row.lj-spaeter{border-left:3px dashed var(--line,#38424d);padding-left:10px}.row.lj-spaeter>.grow>b,.row.lj-spaeter>b{color:var(--mute,#8d99a6);font-weight:500}'
      + '#' + HINT_ID + '{position:fixed;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top,0px));z-index:260;box-sizing:border-box;width:max-content;max-width:min(440px,calc(100vw - 24px));display:flex;align-items:center;gap:8px;padding:6px 6px 6px 14px;border-radius:12px;border:1px solid var(--accent,#3b9eff);background:var(--panel2,#2c343e);color:var(--fg,#e8ecf0);font:500 14px/1.35 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.35)}'
      + '#' + HINT_ID + ' .ljT{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}#' + HINT_ID + ' .ljT b{font-weight:600}'
      + '#' + HINT_ID + ' .ljGo{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid transparent;background:var(--accent-bg,#1a6fd4);color:#fff;text-decoration:none;font:600 14px system-ui,sans-serif;flex:none}'
      + '#' + HINT_ID + ' .ljX{flex:none;min-width:44px;min-height:44px;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--mute,#8d99a6);font:18px system-ui,sans-serif;cursor:pointer}'
      + '#' + HINT_ID + ' .ljGo:focus-visible,#' + HINT_ID + ' .ljX:focus-visible{outline:3px solid var(--focus,#ffd166);outline-offset:2px}'
      + '@media(max-width:420px){#' + HINT_ID + '{flex-wrap:wrap}}@media print{#' + HINT_ID + '{display:none!important}}';
    doc.head.appendChild(st);
  }

  /* ---------- Hinweise ---------- */
  let hTimer = null;
  function wegHinweis() { clearTimeout(hTimer); const e = doc.getElementById(HINT_ID); if (e) e.remove(); }
  /* text: Zeile 1; text2: optional Zeile 2; knopf: { text, href } oder null; dauer in ms (0 = bleibt bis zum Schließen) */
  function zeigeHinweis(text, text2, knopf, dauer) {
    try {
      if (!doc.body) return; stil(); wegHinweis();
      const el = doc.createElement('div'); el.id = HINT_ID; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      const t = doc.createElement('div'); t.className = 'ljT';
      const b = doc.createElement('b'); b.textContent = text; t.appendChild(b);
      if (text2) { const s = doc.createElement('span'); s.textContent = text2; t.appendChild(s); }
      el.appendChild(t);
      if (knopf) { const a = doc.createElement('a'); a.className = 'ljGo'; a.href = knopf.href; a.textContent = knopf.text; el.appendChild(a); }
      const x = doc.createElement('button'); x.type = 'button'; x.className = 'ljX'; x.textContent = '×'; x.setAttribute('aria-label', 'Hinweis schließen'); x.onclick = wegHinweis; el.appendChild(x);
      el.onkeydown = e => { if (e && e.key === 'Escape') wegHinweis(); };
      doc.body.appendChild(el);
      if (dauer) hTimer = setTimeout(wegHinweis, dauer);
    } catch (e) {}
  }
  const zeigeSpaeter = lj => zeigeHinweis(hinweisText(lj), '', null, 7000);
  const zeigeFertig = lj => zeigeHinweis(fertigKopf(lj), fertigText(), { text: 'Zur Startseite', href: 'index.html' }, 0);

  /* ---------- Liste umordnen ---------- */
  const istKopf = k => !!k.classList && (k.classList.contains('gh') || k.classList.contains('sh'));
  const eigen = k => !!k.getAttribute && k.getAttribute('data-lj-liste') != null;
  const rowId = k => (k.classList && k.classList.contains('row') && k.tagName === 'BUTTON') ? (k.getAttribute('data-t') || k.getAttribute('data-id') || '') : (k.classList && k.classList.contains('row') ? (k.getAttribute('data-t') || k.getAttribute('data-id') || '') : '');
  let obs = null;

  /* Eine Liste umordnen. Rückgabe: 'ok' (umgebaut), 'gleich' (war schon so), 'fremd' (Markup passt nicht, bleibt unverändert) oder 'leer' */
  function umordnen(parent, k, bekannt) {
    const kids = Array.prototype.slice.call(parent.children);
    let first = -1, last = -1;
    kids.forEach((c, i) => { if (rowId(c)) { if (first < 0) first = i; last = i; } });
    if (first < 0) return 'leer';
    let start = first; while (start > 0 && istKopf(kids[start - 1])) start--;
    const region = kids.slice(start, last + 1);
    for (let i = 0; i < region.length; i++) { const c = region[i]; if (istKopf(c)) continue; const id = rowId(c); if (!id || !bekannt[id]) return 'fremd'; }
    let kat = null; const es = [], protos = {}, alteKopf = [];
    region.forEach(c => {
      if (istKopf(c)) {
        alteKopf.push(c);
        if (c.getAttribute('data-lj-liste') === 'l') kat = null; else { kat = c.textContent.trim(); if (!protos[kat]) protos[kat] = c; }
      } else es.push({ id: rowId(c), kat, lj: root.Lehrjahr.ab(rowId(c), k.lab), el: c });
    });
    const plan = bauePlan(es, k.lj);
    const aktuell = region.map(c => istKopf(c) ? (c.getAttribute('data-lj-liste') === 'l' ? 'l:' + c.getAttribute('data-lj') : 'k:' + c.textContent.trim()) : 'r:' + rowId(c));
    parent.setAttribute('data-lj-p', '1');   // Markierung der Liste (14-px-Schrift für die Zeilenuntertitel nur im Lehrjahr-Modus)
    const markOk = es.every(e => e.el.classList.contains('lj-spaeter') === (e.lj > k.lj));
    if (markOk && zeichen(plan).join('|') === aktuell.join('|')) return 'gleich';
    const anker = kids[last].nextSibling, frag = doc.createDocumentFragment();
    plan.forEach(p => {
      if (p.t === 'k') { const h = protos[p.kat].cloneNode(true); h.setAttribute('data-lj-liste', 'k'); frag.appendChild(h); }
      else if (p.t === 'l') {
        const h = doc.createElement('div'); h.className = 'gh ljh'; h.setAttribute('data-lj-liste', 'l'); h.setAttribute('data-lj', String(p.lj)); h.setAttribute('role', 'heading'); h.setAttribute('aria-level', '3'); h.textContent = kopf(p.lj); frag.appendChild(h);
      } else {
        const e = p.e; e.el.classList.toggle('lj-spaeter', e.lj > k.lj); if (e.lj > k.lj) e.el.setAttribute('data-lj', String(e.lj)); else e.el.removeAttribute('data-lj'); frag.appendChild(e.el);
      }
    });
    alteKopf.forEach(h => { if (h.parentNode === parent) parent.removeChild(h); });
    parent.insertBefore(frag, anker && anker.parentNode === parent ? anker : null);
    return 'ok';
  }

  let wartet = false;
  function scan() {
    wartet = false;
    const k = kontext(); if (!k) return;
    stil();
    const bekannt = {}; idsDes(k).forEach(i => { bekannt[i] = 1; });
    const rows = doc.querySelectorAll('button.row[data-t],button.row[data-id],.row[data-t],.row[data-id]'), eltern = [];
    rows.forEach(r => { const p = r.parentNode; if (p && eltern.indexOf(p) < 0) eltern.push(p); });
    if (!eltern.length) return;
    if (obs) obs.disconnect();
    try { eltern.forEach(p => { try { umordnen(p, k, bekannt); } catch (e) {} }); }
    finally { if (obs && doc.body) obs.observe(doc.body, { childList: true, subtree: true }); }
  }
  const relevant = n => n.nodeType === 1 && (n.matches('.row,.gh,.sh') || (n.querySelector && n.querySelector('.row[data-t],.row[data-id]')));
  function anstoss(muts) {
    if (wartet) return;
    for (let i = 0; i < muts.length; i++) { const a = muts[i].addedNodes; for (let j = 0; j < a.length; j++) if (relevant(a[j]) && !eigen(a[j])) { wartet = true; Promise.resolve().then(scan); return; } }
  }

  /* Wer bewusst eine spätere Aufgabe wählt (Klick auf eine gedämpfte Zeile): kleiner Hinweis, nichts wird verhindert */
  function klick(e) {
    try {
      const r = e.target && e.target.closest ? e.target.closest('.row.lj-spaeter') : null; if (!r) return;
      const j = +r.getAttribute('data-lj'); if (j >= 2 && j <= 4) setTimeout(() => zeigeSpaeter(j), 0);
    } catch (x) {}
  }
  /* Einsprung mit ?aufgabe=<ID> auf eine spätere Aufgabe */
  function einsprung() {
    try {
      const k = kontext(); if (!k) return;
      const m = /[?&]aufgabe=([A-Za-z0-9_.-]{1,40})/.exec(String(root.location.search || '')); if (!m) return;
      if (idsDes(k).indexOf(m[1]) < 0) return;
      const j = root.Lehrjahr.ab(m[1], k.lab); if (j > k.lj) setTimeout(() => zeigeSpaeter(j), 1200);
    } catch (e) {}
  }

  function los() {
    if (MODUS.test(String(root.location.search || ''))) { /* Duell, Wettbewerb, Probetest: Listen dort nicht anfassen */ }
    obs = new root.MutationObserver(anstoss);
    doc.addEventListener('click', klick, true);
    scan(); einsprung();
    if (doc.body && obs) obs.observe(doc.body, { childList: true, subtree: true });
  }
  Object.assign(root.LehrjahrListe, { kontext, erlaubt, weiter, zeigeHinweis, zeigeSpaeter, zeigeFertig, umordnen, scan });
  if (!root.MutationObserver) return;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', los); else los();
})(typeof window !== 'undefined' ? window : globalThis);
