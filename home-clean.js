'use strict';
/* Tonfunk Lab: Startseite aufgeräumt (v50.166). Alles Zusätzliche ist einklappbar und merkt sich die eigene Wahl (localStorage, nur Komfort):
   - Duell-Band (Duell, Fehler-Tausch, Wettbewerb): Standard zu     lm4.home.duell  = 1 offen
   - Fußbereich (Stand, Lernhefte, Ausbilder):     Standard zu     lm4.home.foot   = 1 offen
   - Ansicht der Karten: Karten oder Kompakt (nur Titel)           lm4.home.kompakt = 1 kompakt
   - Knöpfe "Alle aufklappen / Alle zuklappen" für die Bereiche.
   Ohne dieses Skript bleibt die Startseite wie vorher. */
(function (root) {
  if (typeof document === 'undefined') return;
  const doc = document, html = doc.documentElement;
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} };
  const K = { duell: 'lm4.home.duell', foot: 'lm4.home.foot', kompakt: 'lm4.home.kompakt' };

  function toggle(id, cls, label, key, target, openDefault) {
    if (doc.getElementById(id) || !target || !target.parentNode) return null;
    const b = doc.createElement('button'); b.type = 'button'; b.id = id; b.className = 'cl-tg';
    b.innerHTML = '<span class="ch" aria-hidden="true"></span><span class="lb"></span>'; b.querySelector('.lb').textContent = label;
    const stored = get(key), open = stored === null ? openDefault : stored === '1';
    const apply = o => { html.classList.toggle(cls, !o); b.setAttribute('aria-expanded', o ? 'true' : 'false'); };
    apply(open);
    b.addEventListener('click', () => { const o = b.getAttribute('aria-expanded') !== 'true'; apply(o); set(key, o ? '1' : '0'); });
    target.parentNode.insertBefore(b, target);
    return { b, open: () => { apply(true); } };
  }

  function bar() {
    const rub = doc.getElementById('rub'); if (!rub || doc.getElementById('clBar')) return;
    const d = doc.createElement('div'); d.className = 'cl-bar'; d.id = 'clBar';
    const mkb = (id, t) => { const b = doc.createElement('button'); b.type = 'button'; b.id = id; b.className = 'cl-b'; b.textContent = t; d.appendChild(b); return b; };
    const bo = mkb('clAuf', 'Alle aufklappen'), bz = mkb('clZu', 'Alle zuklappen'), bk = mkb('clKomp', '');
    const all = want => Array.from(doc.querySelectorAll('section.grp>details>summary')).forEach(sm => { if (sm.parentNode.open !== want) sm.click(); });
    bo.addEventListener('click', () => all(true)); bz.addEventListener('click', () => all(false));
    const kk = () => { const k = html.classList.contains('cl-komp'); bk.textContent = k ? 'Ansicht: Kompakt' : 'Ansicht: Karten'; bk.setAttribute('aria-pressed', k ? 'true' : 'false'); };
    html.classList.toggle('cl-komp', get(K.kompakt) === '1'); kk();
    bk.addEventListener('click', () => { const k = !html.classList.contains('cl-komp'); html.classList.toggle('cl-komp', k); set(K.kompakt, k ? '1' : '0'); kk(); });
    rub.parentNode.insertBefore(d, rub.nextSibling);
  }

  let foot = null;
  function build() {
    bar();
    if (!doc.getElementById('clDuell')) toggle('clDuell', 'cl-duell-zu', 'Duell, Fehler-Tausch, Wettbewerb', K.duell, doc.getElementById('duellBand'), false);
    if (!foot) foot = toggle('clFoot', 'cl-foot-zu', 'Mehr: Lernstand, Lernhefte, Ausbilder', K.foot, doc.getElementById('foot'), false);
  }
  // Die Schnellleiste unten springt zu #footBtns: dann den Fußbereich öffnen
  doc.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href="#footBtns"]'); if (a && foot) foot.open(); });
  build();
  // Das Duell-Band und die Chips legen andere Skripte erst nach dem Laden an
  let n = 0; const t = setInterval(() => { build(); if (++n > 20 || (doc.getElementById('clDuell') && doc.getElementById('clBar') && foot)) clearInterval(t); }, 250);
})(typeof window !== 'undefined' ? window : this);
