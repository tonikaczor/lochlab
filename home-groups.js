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
    chipsUpdate();
  }

  /* Werkbank: Kopfzeile je Karte (Icon aus dem Sprite in index.html, Tag, kleiner Fortschrittsring). Karten-Inhalte bleiben unverändert, es wird nur ein .th-Wrapper um .tag gelegt. */
  function decorate() {
    doc.querySelectorAll('.card').forEach(c => {
      if (c.querySelector('.th')) return;
      const key = c.dataset.lab || c.dataset.hub, tag = c.querySelector('.tag'); if (!key || !tag || !tag.parentNode) return;
      const th = doc.createElement('div'); th.className = 'th';
      const li = doc.createElement('span'); li.className = 'li'; li.setAttribute('aria-hidden', 'true');
      li.innerHTML = '<svg class="i" viewBox="0 0 24 24" focusable="false"><use href="#i-' + key + '"/></svg>';
      tag.parentNode.insertBefore(th, tag); th.appendChild(li); th.appendChild(tag);
    });
  }
  // Fortschrittsring aus der Leiste .mp (legt lernpfad.js erst nach dem Laden an)
  function rings() {
    doc.querySelectorAll('.card').forEach(c => {
      const th = c.querySelector('.th'), bar = c.querySelector('.mp .bar i'); if (!th || !bar) return;
      const p = Math.max(0, Math.min(100, Math.round(parseFloat(bar.style.width) || 0)));
      let m = th.querySelector('.mini');
      if (m && m.dataset.p === String(p)) return;
      if (!m) { m = doc.createElement('span'); m.className = 'mini'; m.setAttribute('aria-hidden', 'true'); th.appendChild(m); }
      m.dataset.p = String(p);
      m.innerHTML = '<svg viewBox="0 0 34 34"><circle class="t" cx="17" cy="17" r="14"/>' + (p > 0 ? '<circle class="v" cx="17" cy="17" r="14" pathLength="100" stroke-dasharray="' + p + ' 100"/>' : '') + '</svg>'
        + (p >= 100 ? '<svg class="i ck" viewBox="0 0 24 24" focusable="false"><use href="#i-check"/></svg>' : p > 0 ? '<b class="pv">' + p + '</b>' : '');
    });
  }
  function watchRings() {
    rings(); let t = 0;
    const go = () => { if (t) return; t = setTimeout(() => { t = 0; rings(); }, 50); };
    try { new MutationObserver(go).observe(doc.getElementById('groups') || doc.body, { subtree: true, childList: true }); } catch (e) { [200, 800, 2500].forEach(ms => setTimeout(rings, ms)); }
  }

  /* Werkbank: Rubrik-Chips (Fachgebiet filtern). Zustand wird nicht gespeichert; "Alle" ist Standard. Bei Suche und "Startseite anpassen" gilt der Filter nicht. */
  let rubKey = '';
  function chipsUpdate() {
    const nav = doc.getElementById('rub'); if (!nav) return;
    let total = 0;
    nav.querySelectorAll('button[data-g]').forEach(b => {
      const k = b.dataset.g; if (!k) return;
      const s = doc.getElementById('grp-' + k), n = s ? s.querySelectorAll('.card:not(.vbrow):not(.hm-hid)').length : 0;
      total += n; const e = b.querySelector('.n'); if (e) e.textContent = String(n);
      if (b.parentNode && b.parentNode.tagName === 'LI') b.parentNode.hidden = !s;
    });
    const all = nav.querySelector('button[data-g=""] .n'); if (all) all.textContent = String(total);
  }
  function rubApply() {
    if (!doc.getElementById('groups')) return;
    secs().forEach(s => s.classList.toggle('rub-out', !!rubKey && s.dataset.grp !== rubKey));
    const nav = doc.getElementById('rub');
    if (nav) nav.querySelectorAll('button[data-g]').forEach(b => b.setAttribute('aria-pressed', b.dataset.g === rubKey ? 'true' : 'false'));
    const t = rubKey ? doc.getElementById('grp-' + rubKey) : null, d = t ? detOf(t) : null;
    if (d && !d.open) { d.open = true; const sm = d.querySelector(':scope>summary'); if (sm) sm.setAttribute('aria-expanded', 'true'); }
  }
  function rubHint() {
    const ul = doc.querySelector('#rub ul'); if (!ul) return;
    ul.classList.toggle('ov-l', ul.scrollLeft > 4); ul.classList.toggle('ov-r', ul.scrollLeft + ul.clientWidth < ul.scrollWidth - 4);
  }
  function mkChips(wrap) {
    if (doc.getElementById('rub')) return;
    const nav = doc.createElement('nav'); nav.className = 'rub'; nav.id = 'rub'; nav.setAttribute('aria-label', 'Fachgebiet filtern');
    const ul = doc.createElement('ul');
    const item = (k, n) => { const li = doc.createElement('li'); const b = doc.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.g = k; b.setAttribute('aria-pressed', k === '' ? 'true' : 'false'); if (k) b.style.setProperty('--c', 'var(--g-' + k + ')'); b.innerHTML = (k ? '<span class="sw" aria-hidden="true"></span>' : '') + '<span class="nm"></span> <span class="n"></span>'; b.querySelector('.nm').textContent = n; li.appendChild(b); ul.appendChild(li); };
    item('', 'Alle'); GROUPS.forEach(g => item(g.k, g.n));
    nav.appendChild(ul); wrap.parentNode.insertBefore(nav, wrap);
    nav.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('button[data-g]'); if (!b) return;
      rubKey = b.dataset.g === rubKey ? '' : b.dataset.g; rubApply();
      const t = rubKey ? doc.getElementById('grp-' + rubKey) : null; if (t && t.scrollIntoView) { try { t.scrollIntoView({ block: 'start' }); } catch (x) {} }
    });
    ul.addEventListener('scroll', rubHint, { passive: true }); root.addEventListener('resize', rubHint);
    chipsUpdate(); setTimeout(rubHint, 100); setTimeout(rubHint, 800);
  }

  function build() {
    const flat = doc.getElementById('cardsFlat'); if (!flat || doc.getElementById('groups')) return;
    const list = Array.from(flat.children).filter(c => c.classList && c.classList.contains('card'));
    const vb = doc.getElementById('vbRow'); if (vb) list.push(vb);
    const wk = doc.getElementById('wikiRow'); if (wk) list.push(wk);   // Wiki-Kachel (kein Lab, Klasse vbrow = zählt nirgends mit), landet am Ende ihres Bereichs (grund)
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
    apply(); refresh(); decorate(); watchRings(); mkChips(wrap);
  }

  root.HomeGroups = {
    GROUPS, OTHER, apply, refresh,
    setEdit(on) { forceEdit = !!on; doc.documentElement.classList.toggle('rub-free', forceEdit || !!forceSearch); apply(); },
    setSearch(keys) { forceSearch = keys && keys.size ? keys : null; doc.documentElement.classList.toggle('rub-free', forceEdit || !!forceSearch); apply(); refresh(); },
    wantOpen(k) { if (k) { wanted[k] = true; apply(); } },
    groupOf(el) { const s = el && el.closest && el.closest('section.grp'); return s ? s.dataset.grp : ''; },
    state() { return Object.assign({}, map); }
  };
  build();
})(typeof window !== 'undefined' ? window : this);
