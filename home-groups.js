'use strict';
/* Tonfunk Lab: Startseite in sieben Themenbereiche gliedern (Spezifikation SPEC-STARTSEITE-FABLE.md, Abschnitt 6.1).
   Die Karten stehen in index.html unveraendert in Dateireihenfolge, jede mit data-group. Dieses Skript hängt sie beim Laden in
   <section class="grp"> mit <details> (auf dem Handy sind die Bereiche 2 bis 7 beim ersten Besuch zugeklappt) und gibt Überschriften H2 pro Bereich.
   Ohne Skript bleibt die flache Liste wie früher. Zustand zugeklappter Bereiche: localStorage lm4.home.groups = {"mess":0,"auto":1,...} (nur was der Nutzer selbst umgeschaltet hat). */
(function (root) {
  const KEY = 'lm4.home.groups';
  const GROUPS = [
    { k: 'grund', n: 'Grundlagen & Werkstatt' },
    { k: 'mess', n: 'Messen & Prüfen' },
    { k: 'sich', n: 'Sicherheit, Installation & Energie' },
    { k: 'anadig', n: 'Analog & Digital' },
    { k: 'auto', n: 'Automatisierung & Steuern' },
    { k: 'bau', n: 'Bauen & Programmieren' },
    { k: 'pruef', n: 'Prüfung & Projekte' }
  ];
  const OTHER = { k: 'weitere', n: 'Weitere' };
  const MOBILE_MAX = 639;
  if (typeof module === 'object' && module.exports) module.exports = { GROUPS, OTHER, KEY };
  if (typeof document === 'undefined') return;
  const doc = document;

  let map = {}, forceEdit = false, forceSearch = null, wanted = {};
  try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && typeof o === 'object' && !Array.isArray(o)) Object.keys(o).forEach(k => { map[k] = o[k] ? 1 : 0; }); } catch (e) { map = {}; }
  const save = () => { try { if (Object.keys(map).length) localStorage.setItem(KEY, JSON.stringify(map)); else localStorage.removeItem(KEY); } catch (e) {} };
  const mobile = () => { try { return root.matchMedia('(max-width:' + MOBILE_MAX + 'px)').matches; } catch (e) { return false; } };
  const secs = () => Array.from(doc.querySelectorAll('section.grp'));
  const detOf = s => s.querySelector(':scope>details');

  // gewünschter Zustand eines Bereichs: eigene Wahl, sonst Standard (Desktop alle offen; Handy nur der erste und der des Weitermachen-Labs)
  const want = k => (k in map) ? !!map[k] : (!mobile() || k === GROUPS[0].k || !!wanted[k]);
  function apply() {
    secs().forEach(s => {
      const k = s.dataset.grp, d = detOf(s); if (!d) return;
      const force = forceEdit || (forceSearch && forceSearch.has(k));
      const o = force ? true : want(k);
      if (d.open !== o) d.open = o;
      const sm = d.querySelector(':scope>summary'); if (sm) sm.setAttribute('aria-expanded', d.open ? 'true' : 'false');
    });
  }
  // Zähler (ohne ausgeblendete Karten) und leere Bereiche ausblenden (Suche, Startseite anpassen)
  function refresh() {
    secs().forEach(s => {
      const all = Array.from(s.querySelectorAll('.card')), vis = all.filter(c => !c.classList.contains('hm-hid') && !c.classList.contains('srch-out'));
      const labs = all.filter(c => !c.classList.contains('vbrow') && !c.classList.contains('hm-hid'));
      const gc = s.querySelector('.gc'); if (gc) gc.textContent = '(' + labs.length + ')';
      s.classList.toggle('grp-empty', vis.length === 0);
    });
  }

  function build() {
    const flat = doc.getElementById('cardsFlat'); if (!flat || doc.getElementById('groups')) return;
    const list = Array.from(flat.children).filter(c => c.classList && c.classList.contains('card'));
    const vb = doc.getElementById('vbRow'); if (vb) list.push(vb);
    list.forEach((c, i) => { c.dataset.pos = String(i); });          // Dateireihenfolge merken (Standard für "Zurücksetzen")
    const wrap = doc.createElement('div'); wrap.id = 'groups';
    const boxes = {};
    const mk = g => {
      const s = doc.createElement('section'); s.className = 'grp'; s.id = 'grp-' + g.k; s.dataset.grp = g.k;
      s.innerHTML = '<details open><summary><h2><span class="gn"></span> <small class="gc"></small></h2><span class="chev" aria-hidden="true"></span></summary><div class="cards"></div></details>';
      s.querySelector('.gn').textContent = g.n;
      boxes[g.k] = s.querySelector('.cards'); wrap.appendChild(s);
    };
    GROUPS.forEach(mk);
    list.forEach(c => {
      let k = c.dataset.group; if (!boxes[k]) { if (!boxes[OTHER.k]) mk(OTHER); k = OTHER.k; }
      boxes[k].appendChild(c);
    });
    flat.parentNode.insertBefore(wrap, flat); flat.remove();
    // Umschalten selbst (Tastatur und Zeiger); nur eigene Wahl wird gespeichert, bei Suche und Anpassen nur vorübergehend
    wrap.addEventListener('click', e => {
      const sm = e.target.closest && e.target.closest('section.grp>details>summary'); if (!sm) return;
      e.preventDefault();
      const s = sm.closest('section.grp'), d = detOf(s), k = s.dataset.grp;
      d.open = !d.open; sm.setAttribute('aria-expanded', d.open ? 'true' : 'false');
      if (!forceEdit && !forceSearch) { map[k] = d.open ? 1 : 0; save(); }
    });
    if (root.matchMedia) { try { const mq = root.matchMedia('(max-width:' + MOBILE_MAX + 'px)'); (mq.addEventListener || mq.addListener).call(mq, 'change', apply); } catch (e) {} }
    apply(); refresh();
  }

  root.HomeGroups = {
    GROUPS, OTHER, apply, refresh,
    setEdit(on) { forceEdit = !!on; apply(); },
    setSearch(keys) { forceSearch = keys && keys.size ? keys : null; apply(); refresh(); },
    wantOpen(k) { if (k) { wanted[k] = true; apply(); } },
    groupOf(el) { const s = el && el.closest && el.closest('section.grp'); return s ? s.dataset.grp : ''; },
    state() { return Object.assign({}, map); }
  };
  build();
})(typeof window !== 'undefined' ? window : this);
