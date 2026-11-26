'use strict';
/* Tonfunk Lab: Leiste der Ansicht "Labs" (Umbau in fünf Ansichten S1).
   Drei Schalter über dem Raster (#lbBar): welche Labs ("Mein Beruf" oder "Alle", nicht gespeichert), Sortierung ("Reihenfolge (Lernpfad)", "Thema", "Lernfeld";
   Schlüssel lm4.home.sort) und Ansicht ("Kompakt" oder "Karten"; Schlüssel lm4.home.kompakt, Standard Kompakt = Klasse html.tiles, gesetzt im Kopf von index.html).
   "Startseite anpassen" gibt es nicht mehr. Labs, die früher von Hand ausgeblendet wurden (lm4.home = {order, hidden}), bleiben unter "Mein Beruf" ausgeblendet;
   ein Hinweis (#lbHid) nennt ihre Zahl und holt sie mit einem Knopf zurück. Die gespeicherte Reihenfolge aus lm4.home bleibt im Speicher, wird aber nicht mehr angewendet.
   In der Kompaktansicht ist die ganze Karte anklickbar; der Hauptknopf heißt je nach Stand "Starten", "Weiter", "Wiederholen" oder "Öffnen" und führt zur nächsten offenen Aufgabe. */
(function (root) {
  const KEY = 'lm4.home', SORT = 'lm4.home.sort', KOMP = 'lm4.home.kompakt';
  const SORTEN = [['pfad', 'Reihenfolge (Lernpfad)'], ['thema', 'Thema'], ['lf', 'Lernfeld']];
  /* gespeicherten Stand lm4.home lesen und säubern (reine Funktion) */
  function lesen(raw) {
    try { const o = JSON.parse(raw); if (o && typeof o === 'object') { const ok = a => Array.isArray(a) ? a.filter(s => typeof s === 'string') : []; return { order: ok(o.order), hidden: ok(o.hidden) }; } } catch (e) {}
    return { order: [], hidden: [] };
  }
  /* Hauptknopf einer Karte nach dem Stand des Labs: s = Lernpfad.stat(lab), trained = Einführung gesehen (seit v78.195 nur noch für den Text „Starten“/„Weiter“) */
  function knopf(file, s, trained) {
    if (!s || !s.n) return { t: 'Öffnen', href: file };
    if (s.pct >= 100) return { t: 'Wiederholen', href: file };
    if (!s.started && !trained) return s.next ? { t: 'Starten', href: file + '?aufgabe=' + encodeURIComponent(s.next[0]), task: s.next[3] } : { t: 'Starten', href: file };   // v78.195: direkt die erste Aufgabe, die Einführung bleibt im Info-Menü
    return s.next ? { t: 'Weiter', href: file + '?aufgabe=' + encodeURIComponent(s.next[0]), task: s.next[3] } : { t: 'Öffnen', href: file };
  }
  if (typeof module === 'object' && module.exports) module.exports = { lesen, knopf, SORTEN, KEY, SORT, KOMP };
  if (typeof document === 'undefined') return;
  const doc = document, html = doc.documentElement;
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const cards = () => Array.from(doc.querySelectorAll('#groups .card[data-lab]')).filter(c => !c.classList.contains('vbrow'));   // Zeilen wie Projekte, Plan und die Nachschlage-Kachel (Klasse vbrow) zählen nie als Lab
  let st = lesen(get(KEY)), bar = null;

  /* Labs ohne Beruf (z. B. bis zur Freigabe gesperrt, data-beruf="wartet") erscheinen auch unter "Alle" nicht */
  function markNie() {
    const B = root.Berufe; if (!B || !B.matches) return;
    const ks = B.BERUFE.concat(B.WEGE).map(b => b.k);
    cards().forEach(c => c.classList.toggle('lb-nie', !ks.some(k => B.matches(c.getAttribute('data-beruf'), k))));
  }
  function anwenden() {
    const alle = html.classList.contains('lb-alle');
    cards().forEach(c => c.classList.toggle('hm-hid', !alle && st.hidden.indexOf(c.dataset.lab) >= 0));
    const nB = cards().filter(c => !c.classList.contains('mappe-teil') && !c.classList.contains('be-out') && !c.classList.contains('lb-nie') && !c.classList.contains('hm-hid')).length;
    const nA = cards().filter(c => !c.classList.contains('lb-nie') && !c.classList.contains('mappe-teil')).length;   // v78.196: Teil-Labs einer Mappe zählen in der Karte des Ziel-Labs
    if (bar) {
      bar.querySelector('[data-f=beruf] .n').textContent = '(' + nB + ')'; bar.querySelector('[data-f=alle] .n').textContent = '(' + nA + ')';
      bar.querySelectorAll('[data-f]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.f === 'alle') === alle ? 'true' : 'false'));
      const komp = html.classList.contains('tiles'), a = bar.querySelector('#lbAnsicht'); a.textContent = komp ? 'Ansicht: Kompakt' : 'Ansicht: Karten'; a.setAttribute('aria-pressed', komp ? 'true' : 'false');
      const w = html.getAttribute('data-weg') === '1', o = bar.querySelector('option[value=lf]'); if (o) o.textContent = w ? 'Modul' : 'Lernfeld';
    }
    const h = doc.getElementById('lbHid'), n = cards().filter(c => st.hidden.indexOf(c.dataset.lab) >= 0 && !c.classList.contains('be-out')).length;
    if (h) { h.hidden = !n || alle; const t = h.querySelector('span'); if (t) t.textContent = n === 1 ? 'Ein Lab hast du früher ausgeblendet.' : n + ' Labs hast du früher ausgeblendet.'; }
    if (root.HomeGroups) root.HomeGroups.refresh();
  }
  /* Hauptknopf je Karte (braucht lernpfad.js) */
  function knoepfe() {
    const L = root.Lernpfad, R = root.LAB_REG || {}; if (!L || !L.stat) return;
    let tr = {}; try { tr = JSON.parse(get('lm4.trainer') || '{}') || {}; } catch (e) { tr = {}; }
    cards().forEach(c => {
      const a = c.querySelector('.btns a.btn.pri'); if (!a) return;
      const file = (a.dataset.file || a.getAttribute('href') || '').split(/[?#]/)[0], key = Object.keys(R).find(k => R[k].file === file); if (!key || R[key].hub) return;
      a.dataset.file = file;
      const k = knopf(file, L.stat(key), !!tr[key]), nm = (c.querySelector('.tag') || {}).textContent || '';
      a.textContent = k.t; a.setAttribute('href', k.href); a.setAttribute('aria-label', nm.trim() + ': ' + k.t + (k.task ? ' mit ' + k.task : ''));
    });
  }
  function baue() {
    const host = doc.getElementById('lbBar'); if (!host || bar) return;
    bar = host;
    const sort = SORTEN.map(s => '<option value="' + s[0] + '">' + s[1] + '</option>').join('');
    host.innerHTML = '<div class="seg" role="group" aria-label="Welche Labs zeigen"><button type="button" data-f="beruf" aria-pressed="true">Mein Beruf <span class="n"></span></button><button type="button" data-f="alle" aria-pressed="false">Alle <span class="n"></span></button></div>'
      + '<label class="lb-sort" for="lbSort"><span>Sortierung</span><select id="lbSort">' + sort + '</select></label>'
      + '<button type="button" class="lb-b" id="lbAnsicht" aria-pressed="true">Ansicht: Kompakt</button>';
    const hid = doc.createElement('p'); hid.className = 'lb-hid'; hid.id = 'lbHid'; hid.hidden = true; hid.innerHTML = '<span></span> <button type="button" class="lb-b">Wieder zeigen</button>';
    const note = doc.createElement('p'); note.className = 'lb-hid'; note.id = 'lbLfNote'; note.hidden = true; note.textContent = 'Für deinen Beruf gibt es noch keinen Plan mit Lernfeldern. Die Labs stehen deshalb nach Thema.';
    host.insertAdjacentElement('afterend', note); host.insertAdjacentElement('afterend', hid);
    host.addEventListener('click', e => {
      const f = e.target.closest && e.target.closest('[data-f]');
      if (f) { html.classList.toggle('lb-alle', f.dataset.f === 'alle'); anwenden(); return; }
      if (e.target.closest && e.target.closest('#lbAnsicht')) {
        const k = !html.classList.contains('tiles'); html.classList.toggle('tiles', k); set(KOMP, k ? '1' : '0'); anwenden();
        setTimeout(() => { try { root.dispatchEvent(new Event('resize')); } catch (x) {} }, 30);
      }
    });
    const sel = host.querySelector('#lbSort');
    let m = get(SORT); if (SORTEN.map(s => s[0]).indexOf(m) < 0) m = 'pfad';
    sel.value = m;
    sel.addEventListener('change', () => { set(SORT, sel.value); if (root.HomeGroups) root.HomeGroups.sortiere(sel.value); knoepfe(); anwenden(); });
    hid.querySelector('button').addEventListener('click', () => {
      st.hidden = []; try { if (!st.order.length) localStorage.removeItem(KEY); else set(KEY, JSON.stringify(st)); } catch (e) {}
      anwenden();
    });
    markNie();
    if (root.HomeGroups) root.HomeGroups.sortiere(m);
    anwenden();
  }
  function init() { baue(); knoepfe(); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  root.addEventListener('lernpfad:fertig', () => { knoepfe(); if (root.HomeGroups && root.HomeGroups.modus() === 'pfad') root.HomeGroups.sortiere('pfad'); anwenden(); });
  root.addEventListener('pageshow', e => { if (e.persisted) { knoepfe(); anwenden(); } });
  root.Home = { get state() { return { order: st.order.slice(), hidden: st.hidden.slice() }; }, render: anwenden, knoepfe };
})(typeof window !== 'undefined' ? window : this);
