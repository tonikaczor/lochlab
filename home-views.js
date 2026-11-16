'use strict';
/* Tonfunk Lab: Startseite in fünf Ansichten (Audit v62.173, Umbau S1; Entwurf quelle/audit/umsetzung/S-entwurf.md).
   Start, Labs, Üben, Prüfen, Ich stehen als section.view#v-<name> in index.html, sichtbar ist immer nur eine (Attribut hidden).
   Umschalten über die Adresse: #start (Standard), #labs, #ueben, #pruefen, #ich. Jeder Wechsel ist ein Eintrag im Verlauf, die Zurück-Taste schaltet zurück.
   Alte Sprungziele (#meinWeg, #lernpfad, #lpHd, #grp-<Bereich>, #footBtns, …) öffnen die passende Ansicht und rollen zum Ziel.
   Die Leiste #bnav ist der Umschalter (unter 900 px unten, darüber oben). Dazu: Zeilen "Zuletzt geöffnet" und "Neu" in Start, Zustände der Zeilen in Üben,
   Prüfen-Zeilen je nach Beruf. ziel() ist reine Logik und wird in Node geprüft (quelle/home/test_home.js). Es wird nichts in den Speicher geschrieben. */
(function (root) {
  const VIEWS = ['start', 'labs', 'ueben', 'pruefen', 'ich'];
  const NAMEN = { start: 'Start', labs: 'Labs', ueben: 'Üben', pruefen: 'Prüfen', ich: 'Ich' };
  /* alte Sprungziele und Bausteine, die in einer Ansicht stehen (ohne DOM entscheidbar) */
  const ALIAS = {
    top: 'start', meinWeg: 'start', mwHero: 'start', contGo: 'start', mwRow: 'start', stZuletzt: 'start',
    lernpfad: 'labs', lpHd: 'labs', groups: 'labs', cardsFlat: 'labs', rub: 'labs', srch: 'labs', srchIn: 'labs', lbBar: 'labs',
    vbRow: 'ueben', duellBand: 'ueben', ubWd: 'ueben',
    planRow: 'pruefen', countdown: 'pruefen', prCd: 'pruefen',
    footBtns: 'ich', foot: 'ich', ftAzubi: 'ich', ftAusb: 'ich', standOpen: 'ich', lsOpen: 'ich', wikiRow: 'ich', beTabs: 'ich', beWege: 'ich', ichBeruf: 'ich', karCard: 'ich', mwStand: 'ich'
  };
  /* Adresse (#…) -> { view, anker }: Ansicht direkt, bekannter Alias, Bereich grp-<k> (Labs, Sortierung Thema), sonst unbekannt (view '') */
  function ziel(hash) {
    const h = String(hash || '').replace(/^#/, '');
    let id = h; try { id = decodeURIComponent(h); } catch (e) { id = h; }
    if (!id) return { view: 'start', anker: '' };
    if (VIEWS.indexOf(id) >= 0) return { view: id, anker: '' };
    if (id === 'ich-beruf') return { view: 'ich', anker: id };
    if (ALIAS[id]) return { view: ALIAS[id], anker: id };
    if (/^grp-[a-z]+$/.test(id)) return { view: 'labs', anker: id, thema: true };
    return { view: '', anker: id };
  }
  const exp = { VIEWS, NAMEN, ALIAS, ziel };
  if (typeof module === 'object' && module.exports) module.exports = exp;
  if (typeof document === 'undefined') return;

  const doc = document, html = doc.documentElement;
  const $ = id => doc.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let cur = '';

  function sectionOf(el) { const s = el && el.closest ? el.closest('section.view') : null; return s ? s.getAttribute('data-view') : ''; }
  function nav() {
    doc.querySelectorAll('#bnav a[data-v]').forEach(a => { if (a.getAttribute('data-v') === cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  function show(v) {
    if (VIEWS.indexOf(v) < 0) v = 'start';
    const neu = v !== cur;
    cur = v;
    doc.querySelectorAll('main#views > section.view').forEach(s => { const on = s.getAttribute('data-view') === v; if (on) s.removeAttribute('hidden'); else s.setAttribute('hidden', ''); });
    html.setAttribute('data-view', v);
    nav();
    if (neu) {
      try { root.dispatchEvent(new CustomEvent('ansicht', { detail: { view: v } })); } catch (e) {}
      setTimeout(() => { try { root.dispatchEvent(new Event('resize')); } catch (e) {} }, 30);   // Karten-Texte, Chips und Bilder neu messen (waren verdeckt)
    }
    return neu;
  }
  function rollen(anker, thema) {
    if (!anker) return false;
    if (thema && root.HomeGroups && root.HomeGroups.sortiere && !$(anker)) { try { root.HomeGroups.sortiere('thema'); } catch (e) {} }
    const el = $(anker); if (!el) return false;
    const v = sectionOf(el); if (v && v !== cur) show(v);
    try { el.scrollIntoView({ block: 'start' }); } catch (e) { el.scrollIntoView(); }
    return true;
  }
  /* Adresse auswerten; oben = beim Wechsel nach oben rollen */
  function route(oben) {
    const z = ziel(root.location.hash);
    let v = z.view;
    if (!v && z.anker) { v = sectionOf($(z.anker)) || 'start'; }
    const neu = show(v);
    if (z.anker) { if (!rollen(z.anker, z.thema)) setTimeout(() => rollen(z.anker, z.thema), 400); }
    else if (neu && oben) { try { root.scrollTo(0, 0); } catch (e) {} }
  }
  /* Wechsel per Skript (z. B. Suche): Adresse setzen, sofort zeigen */
  function go(v, anker) {
    const h = '#' + (anker || v);
    if (root.location.hash !== h) { try { root.location.hash = h; } catch (e) {} }
    show(v); if (anker) rollen(anker); else { try { root.scrollTo(0, 0); } catch (e) {} }
  }

  route(false);
  root.addEventListener('hashchange', () => route(true));
  /* Klick auf den gerade aktiven Punkt der Leiste: nach oben (die Adresse ändert sich nicht, es gibt kein hashchange) */
  doc.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('#bnav a[data-v]'); if (!a) return;
    const v = a.getAttribute('data-v');
    if (v === cur && root.location.hash === '#' + v) { e.preventDefault(); try { root.scrollTo({ top: 0, behavior: 'smooth' }); } catch (x) { root.scrollTo(0, 0); } }
    else if (v === 'start' && !root.location.hash && cur === 'start') { e.preventDefault(); root.scrollTo(0, 0); }
  });
  /* Taste / oder Strg+K: Labs öffnen, die Suche (home-search.js) setzt danach den Fokus */
  doc.addEventListener('keydown', e => {
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if ((e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey) && !e.altKey)) { if (cur !== 'labs') go('labs'); }
  });

  /* ---------- Start: Zuletzt geöffnet (bis zu drei Labs außer dem der blauen Karte) und eine Zeile Neues ---------- */
  function zuletzt() {
    const box = $('stZuletzt'), L = $('stZuL'), HC = root.HomeCont; if (!box || !L || !HC || !HC.zuletzt) return;
    let list = [];
    try {
      const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
      const BR = root.BerufReg;
      list = HC.zuletzt({ get, REG: root.LAB_REG || {}, ROWS: root.AUFGABEN || [], now: Date.now(), ohne: HC.letzterKey || '', n: 3, hat: k => !BR || !BR.has || BR.has(k) });
    } catch (e) { list = []; }
    if (!list.length || html.classList.contains('mw-erst')) { box.hidden = true; return; }
    const st = k => { try { return root.Lernpfad && root.Lernpfad.stat ? root.Lernpfad.stat(k) : null; } catch (e) { return null; } };
    L.innerHTML = list.map(x => {
      const s = st(x.key), card = Array.from(doc.querySelectorAll('.card .btns a.btn.pri')).find(a => (a.dataset.file || (a.getAttribute('href') || '').split(/[?#]/)[0]) === x.file), lab = card ? card.closest('.card').getAttribute('data-lab') : '';
      return '<a class="zl-t" href="' + esc(x.file) + '"><span class="zl-i" aria-hidden="true">' + (lab ? '<svg class="i" viewBox="0 0 24 24" focusable="false"><use href="#i-' + esc(lab) + '"/></svg>' : '') + '</span><span class="zl-x"><b>' + esc(x.name) + '</b><small>' + esc([s && s.n ? s.d + ' von ' + s.n + ' Aufgaben' : '', x.when].filter(Boolean).join(' · ')) + '</small></span></a>';
    }).join('');
    box.hidden = false;
  }
  function neuZeile() {
    const p = $('stNeu'); if (!p) return;
    const v = String(root.LAB_VERSION || '').replace(/^v/, '');
    if (!v || html.classList.contains('mw-erst')) { p.hidden = true; return; }
    if (!p.firstChild) { const b = doc.createElement('button'); b.type = 'button'; b.className = 'stneu-b'; b.addEventListener('click', () => { if (root.LabNeu) root.LabNeu(); }); p.appendChild(b); }
    p.firstChild.textContent = 'Neu in Version ' + v + ': ansehen';
    p.hidden = false;
  }

  /* ---------- Üben: Zustände und Knöpfe (Duell, Fehler-Tausch, Wettbewerb lösen das vorhandene Duell-Band aus) ---------- */
  function setZ(id, t) { const e = $(id); if (e) e.textContent = t || ''; }
  function bandKnopf(b) { const x = doc.querySelector('#duellBand [data-b="' + b + '"]'); if (x) { x.click(); return true; } return false; }
  function ueben() {
    let duell = '';
    try { const s = doc.querySelector('#duellBand .dl-tx small'); if (s) duell = s.textContent.split(' · ').filter(x => /^Diese Woche/.test(x))[0] || ''; } catch (e) {}
    setZ('ubDuellZ', duell);
    try { setZ('ubTauschZ', root.Tauschui && root.Tauschui.statusZeile ? root.Tauschui.statusZeile() : ''); } catch (e) {}
    try { setZ('ubWettZ', root.Wett && root.Wett.ui && root.Wett.ui.statusZeile ? root.Wett.ui.statusZeile() : ''); } catch (e) {}
    try {
      const E = root.Einheit10, e10 = E && E.normE ? E.normE(JSON.parse(localStorage.getItem(E.KEY) || '{}')) : null, heute = E && E.tagKey ? e10 && e10.tage[E.tagKey(Date.now())] : 0;
      setZ('ubE10Z', heute ? 'heute ' + heute + ' gemacht' : '');
    } catch (e) {}
  }
  function wire() {
    const on = (id, f) => { const e = $(id); if (e && !e.dataset.wired) { e.dataset.wired = '1'; e.addEventListener('click', f); } };
    on('ubE10', () => { if (root.Einheit10 && root.Einheit10.start) root.Einheit10.start(); });
    on('ubDuellGo', () => { if (!bandKnopf('neu') && root.Duell && root.Duell.loadUi) root.Duell.loadUi(u => u.neu()); });
    on('ubDuellJoin', () => { if (!bandKnopf('beitreten') && root.Duell && root.Duell.loadUi) root.Duell.loadUi(u => u.beitreten()); });
    on('ubTausch', () => { if (!bandKnopf('tausch') && root.Tauschui && root.Tauschui.open) root.Tauschui.open(); });
    on('ubWett', () => { if (!bandKnopf('wett') && root.Wett && root.Wett.ui && root.Wett.ui.open) root.Wett.ui.open(); });
  }
  /* Prüfen: Zeilen des Prüfungs-Labs nur für Berufe mit Prüfungs-Lab (data-pr), letzte Probeprüfung als Zustand */
  function pruefen() {
    let pr = false; try { pr = !!(root.BerufReg && root.BerufReg.has && root.BerufReg.has('pr')); } catch (e) {}
    html.setAttribute('data-pr', pr ? '1' : '0');
    try {
      const s = JSON.parse(localStorage.getItem('pr.state') || 'null'), h = s && Array.isArray(s.hist) ? s.hist.filter(x => x && x.kind === 'exam') : [], l = h[h.length - 1];
      setZ('prProbeZ', l && isFinite(+l.pct) ? 'zuletzt ' + Math.round(+l.pct) + ' %' : '');
    } catch (e) { setZ('prProbeZ', ''); }
  }
  /* Ich: Liste der Berufe und Wege zeigt zuerst nur die Wahl; "wechseln" öffnet alle elf Einträge (auch über die Marke im Kopf, #ich-beruf) */
  function berufListe(auf) {
    const l = $('ichBeruf'), b = $('ichBerufWechsel'); if (!l || !b) return;
    l.classList.toggle('zu', !auf); b.setAttribute('aria-expanded', auf ? 'true' : 'false'); b.textContent = auf ? 'Liste schließen' : 'Beruf oder Weg wechseln';
  }
  doc.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#ichBerufWechsel'); if (b) berufListe(b.getAttribute('aria-expanded') !== 'true'); });
  root.addEventListener('hashchange', () => { if (root.location.hash === '#ich-beruf') berufListe(true); });
  if (root.location.hash === '#ich-beruf') setTimeout(() => berufListe(true), 0);
  function alles() { try { zuletzt(); neuZeile(); ueben(); pruefen(); wire(); } catch (e) {} }
  function fertig() { route(false); alles(); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fertig); else setTimeout(fertig, 0);
  root.addEventListener('load', alles);
  root.addEventListener('pageshow', e => { if (e.persisted) alles(); });
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) alles(); });
  root.addEventListener('ansicht', e => { if (e.detail && (e.detail.view === 'ueben' || e.detail.view === 'pruefen' || e.detail.view === 'start')) alles(); });
  [600, 2000].forEach(ms => setTimeout(alles, ms));   // Duell-Band und Tausch laden etwas später
  root.HomeViews = Object.assign({ show, go, route, aktuell: () => cur }, exp);
})(typeof window !== 'undefined' ? window : globalThis);
