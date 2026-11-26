'use strict';
/* Tonfunk Lab: Lab-Raster der Ansicht "Labs" in Abschnitte gliedern (Spezifikation SPEC-STARTSEITE-FABLE.md 6.1; Umbau in fünf Ansichten S1).
   Die Karten stehen in index.html unverändert in Dateireihenfolge (#cardsFlat), jede mit data-group. Dieses Skript hängt sie beim Laden in #groups um,
   in Abschnitte <section class="grp"> mit Überschrift H2. Drei Sortierungen desselben Rasters (sortiere): "thema" (die acht Themenbereiche, IDs grp-<k>),
   "pfad" (Reihenfolge des Lernpfads aus lernpfad.js, mit Nummer und der Marke "Start hier" an der Empfehlung, dazu die Projekte-Spur),
   "lf" (Lernfelder bzw. Module des Ausbildungsplans, ausbildungsplan-<beruf>.js). Keine Klappbalken mehr; der alte Schlüssel lm4.home.groups bleibt im Speicher, wird aber nicht mehr gebraucht.
   Die Wiki-Kachel (#wikiRow) ist kein Lab und steht in der Ansicht "Ich". Ohne Skript bleibt die flache Liste. */
(function (root) {
  const KEY = 'lm4.home.groups';
  const GROUPS = [
    { k: 'grund', n: 'Grundlagen & Werkstatt' },
    { k: 'mess', n: 'Messen & Prüfen' },
    { k: 'sich', n: 'Sicherheit, Installation & Energie' },
    { k: 'anadig', n: 'Analog & Digital' },
    { k: 'auto', n: 'Automatisierung & Steuern' },
    { k: 'bau', n: 'Bauen & Programmieren' },
    { k: 'pruef', n: 'Prüfung & Projekte' },
    { k: 'stud', n: 'Fortgeschritten – Studium und Technik' }   // v55.174: Labs der Wege Techniker/Studium (Karten mit data-group="stud"); bei Ausbildungsberufen leer und damit ausgeblendet, bei den Wegen steht der Bereich oben
  ];
  const OTHER = { k: 'weitere', n: 'Weitere' };
  const MODI = ['pfad', 'thema', 'lf'];
  /* erster Satz eines Spur-Textes (Lernpfad), damit über den Karten kein Fließtext steht (S-13) */
  const ersterSatz = s => { const t = String(s || '').trim(), m = /^(.+?[.!?])(\s|$)/.exec(t), e = m ? m[1] : t; return e.length > 140 ? '' : e; };   // lange Sätze (Aufzählungen) entfallen, dann bleibt der Hinweis zur Reihenfolge
  /* Abschnitte für eine Sortierung ohne DOM: labs = Lab-Schlüssel der Karten (LAB_REG), Rückgabe [{k, n, s, labs:[Schlüssel], extra}] */
  function eimer(modus, o) {
    o = o || {}; const labs = o.labs || [], rest = labs.slice(), nimm = ks => ks.filter(k => { const i = rest.indexOf(k); if (i < 0) return false; rest.splice(i, 1); return true; });
    const out = [];
    if (modus === 'pfad') {
      (o.tracks || []).forEach((t, i) => { const ks = nimm(t.labs || []), hub = (t.labs || []).filter(k => o.hubs && o.hubs.indexOf(k) >= 0); if (ks.length || hub.length) out.push({ k: 'lp' + (i + 1), n: (i + 1) + '. ' + t.t, s: [ersterSatz(t.s), t.pre].filter(Boolean).join(' · '), labs: ks, hub: hub }); });
      if (o.proj) out.push({ k: 'lpProj', n: (out.length + 1) + '. ' + o.proj.t, s: o.proj.pre || '', labs: [], proj: true });
      if (rest.length) out.push({ k: 'lpAndere', n: 'Labs anderer Berufe', s: 'Gehören nicht zu deinem Lernpfad.', labs: rest.splice(0) });
    } else if (modus === 'lf') {
      (o.lernfelder || []).forEach(l => { const ks = nimm((l.labs || []).map(e => e.lab)); if (ks.length) out.push({ k: 'lf-' + String(l.id).replace(/[^A-Za-z0-9_-]/g, ''), n: (l.nr && l.titel.indexOf(l.nr) !== 0 ? l.nr + ' ' : '') + l.titel, s: '', labs: ks }); });
      if (rest.length) out.push({ k: 'lfRest', n: 'Weitere Labs', s: 'In keinem Lernfeld deines Plans eingetragen.', labs: rest.splice(0) });
    }
    return out;
  }
  if (typeof module === 'object' && module.exports) module.exports = { GROUPS, OTHER, KEY, MODI, eimer, ersterSatz };
  if (typeof document === 'undefined') return;
  const doc = document, html = doc.documentElement;
  let modus = 'thema', wrap = null;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const secs = () => Array.from(doc.querySelectorAll('section.grp'));
  const labCards = () => wrap ? Array.from(wrap.querySelectorAll('.card[data-lab]:not(.vbrow)')) : [];
  /* gezählt und gezeigt wird eine Karte, wenn sie zum gewählten Beruf gehört (oder "Alle" an ist und sie überhaupt einem Beruf gehört) und nicht von Hand ausgeblendet ist */
  const sichtbar = c => !c.classList.contains('vbrow') && !c.classList.contains('hm-hid') && !c.classList.contains('lb-nie') && (!c.classList.contains('be-out') || html.classList.contains('lb-alle'));
  const REGkey = c => { const a = c.querySelector('.btns a.btn.pri') || c.querySelector('.btns a'), f = a ? (a.getAttribute('href') || '').split(/[?#]/)[0] : '', R = root.LAB_REG || {}; return Object.keys(R).find(k => R[k].file === f) || ''; };

  function refresh() {
    secs().forEach(s => {
      const vis = Array.from(s.querySelectorAll('.card')).filter(sichtbar);
      const gc = s.querySelector('.gc'), zus = !!s.querySelector('.lp-pj,.lp-hub'); if (gc) gc.textContent = vis.length || !zus ? '(' + vis.length + ')' : '';
      s.classList.toggle('grp-empty', vis.length === 0 && !s.querySelector('.lp-pj,.lp-hub'));
    });
    const sg = wrap && wrap.querySelector('#lpSpaeter>summary .gc'); if (sg) sg.textContent = '(' + Array.from(wrap.querySelectorAll('#lpSpaeter .card[data-lab]')).filter(sichtbar).length + ')';
    chipsUpdate();
  }

  /* Kopfzeile je Karte (Symbol aus dem Sprite in index.html, Marke, kleiner Fortschrittsring). Karten-Inhalte bleiben, es wird nur ein .th um .tag gelegt. */
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
      c.style.setProperty('--p', p + '%');   // dieselbe Zahl treibt den Fortschrittsstreifen am Kartenrand (home.css, nur Anzeige)
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

  /* Rubrik-Chips (Fachgebiet filtern), nur in der Sortierung "Thema". Zustand wird nicht gespeichert; "Alle" ist Standard. */
  let rubKey = '';
  function chipsUpdate() {
    const nav = doc.getElementById('rub'); if (!nav) return;
    nav.hidden = modus !== 'thema';
    let total = 0;
    nav.querySelectorAll('button[data-g]').forEach(b => {
      const k = b.dataset.g; if (!k) return;
      const n = labCards().filter(c => c.dataset.group === k && sichtbar(c)).length;   // je Fachgebiet über alle Karten, unabhängig von der Sortierung
      total += n; const e = b.querySelector('.n'); if (e) e.textContent = String(n);
      if (b.parentNode && b.parentNode.tagName === 'LI') b.parentNode.hidden = n === 0;
    });
    const all = nav.querySelector('button[data-g=""] .n'); if (all) all.textContent = String(total);
  }
  function rubApply() {
    if (modus !== 'thema') rubKey = '';
    secs().forEach(s => s.classList.toggle('rub-out', !!rubKey && s.dataset.grp !== rubKey));
    const nav = doc.getElementById('rub');
    if (nav) nav.querySelectorAll('button[data-g]').forEach(b => b.setAttribute('aria-pressed', b.dataset.g === rubKey ? 'true' : 'false'));
  }
  function rubHint() {
    const ul = doc.querySelector('#rub ul'); if (!ul) return;
    ul.classList.toggle('ov-l', ul.scrollLeft > 4); ul.classList.toggle('ov-r', ul.scrollLeft + ul.clientWidth < ul.scrollWidth - 4);
  }
  function mkChips() {
    if (doc.getElementById('rub') || !wrap) return;
    const nav = doc.createElement('nav'); nav.className = 'rub'; nav.id = 'rub'; nav.setAttribute('aria-label', 'Fachgebiet filtern');
    const ul = doc.createElement('ul');
    const item = (k, n) => { const li = doc.createElement('li'); const b = doc.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.g = k; b.setAttribute('aria-pressed', k === '' ? 'true' : 'false'); if (k) b.style.setProperty('--c', 'var(--g-' + k + ')'); b.innerHTML = (k ? '<span class="sw" aria-hidden="true"></span>' : '') + '<span class="nm"></span> <span class="n"></span>'; b.querySelector('.nm').textContent = n; li.appendChild(b); ul.appendChild(li); };
    item('', 'Alle'); GROUPS.forEach(g => item(g.k, g.n));
    nav.appendChild(ul); wrap.parentNode.insertBefore(nav, wrap);
    nav.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('button[data-g]'); if (!b) return;
      rubKey = b.dataset.g === rubKey ? '' : b.dataset.g; rubApply();
    });
    ul.addEventListener('scroll', rubHint, { passive: true }); root.addEventListener('resize', rubHint);
    chipsUpdate(); setTimeout(rubHint, 100);
  }

  /* Abschnitt anlegen */
  function sec(id, titel, sub, grp) {
    const s = doc.createElement('section'); s.className = 'grp'; s.id = id; if (grp) s.dataset.grp = grp;
    s.innerHTML = '<h2><span class="gn"></span> <small class="gc"></small></h2>' + (sub ? '<p class="gs"></p>' : '') + '<div class="cards"></div>';
    s.querySelector('.gn').textContent = titel; if (sub) s.querySelector('.gs').textContent = sub;
    wrap.appendChild(s); return s.querySelector('.cards');
  }
  function aufraeumen(cards) {
    cards.forEach(c => { c.classList.remove('lp-rec'); c.querySelectorAll('.lp-no,.lp-mk').forEach(x => x.remove()); });
  }
  function thema(cards) {
    const boxes = {}, order = GROUPS.slice();
    if (html.getAttribute('data-weg') === '1') order.unshift(order.pop());   // bei einem Weg steht "Studium und Technik" oben
    order.forEach(g => { boxes[g.k] = sec('grp-' + g.k, g.n, '', g.k); });
    cards.slice().sort((a, b) => (+a.dataset.pos || 0) - (+b.dataset.pos || 0)).forEach(c => {
      let k = c.dataset.group; if (!boxes[k]) { if (!boxes[OTHER.k]) boxes[OTHER.k] = sec('grp-' + OTHER.k, OTHER.n, '', OTHER.k); k = OTHER.k; }
      boxes[k].appendChild(c);
    });
  }
  function mitEimern(list, cards, byKey) {
    list.forEach(b => {
      const box = sec(b.k, b.n, b.s, '');
      b.labs.forEach(k => { const c = byKey[k]; if (c) box.appendChild(c); });
      if (b.proj && root.Lernpfad && root.Lernpfad.projHtml) box.insertAdjacentHTML('afterend', root.Lernpfad.projHtml(root.Lernpfad.projTrack()));
      if (b.hub && b.hub.length) box.insertAdjacentHTML('afterend', '<p class="lp-hub"><a href="verbund.html">Verbundprojekte öffnen: alle Labs arbeiten an einem Gerät</a></p>');
    });
    const ohne = cards.filter(c => !c.parentNode || !c.parentNode.closest || !c.parentNode.closest('section.grp')); if (ohne.length) { const box = sec('lbOhne', 'Weitere', '', ''); ohne.forEach(c => box.appendChild(c)); }
  }
  function pfad(cards, byKey) {
    const L = root.Lernpfad; if (!L || !L.tracksFor) { thema(cards); return false; }
    const R = root.LAB_REG || {}, hubs = Object.keys(R).filter(k => R[k].hub);
    let tracks = []; try { tracks = L.tracksFor(); } catch (e) { tracks = []; }
    let proj = null; try { proj = L.projTrack ? L.projTrack() : null; } catch (e) { proj = null; }
    mitEimern(eimer('pfad', { labs: Object.keys(byKey), tracks, hubs, proj }), cards, byKey);
    /* Nummer je Karte im Pfad und die Marke an der Empfehlung (dieselbe Quelle wie die blaue Karte: Lernpfad.recommend) */
    let rec = '', began = false; try { const r = L.recommend(); rec = r && r.rec || ''; began = !!(r && r.started); } catch (e) { rec = ''; }
    /* Mit Lehrjahr (nur Berufe mit Datenlage, lehrjahr.js): Labs ohne Aufgaben bis zum eigenen Lehrjahr werden im Pfad übersprungen (Strich statt Nummer, Hinweis "Ab 2. Lehrjahr"); sie bleiben im Raster */
    const lj = L.ljAktiv ? L.ljAktiv() : null;
    const uebersprungen = c => { if (!lj) return 0; try { const s = L.stat(REGkey(c)); return s && s.t && s.t.n === 0 ? s.t.erst : 0; } catch (e) { return 0; } };
    secs().forEach(s => { if (!/^lp\d/.test(s.id)) return; let i = 0; s.querySelectorAll('.cards>.card[data-lab]').forEach(c => { const th = c.querySelector('.th'); const ab = uebersprungen(c); if (!ab) i++; if (!th) return; const no = doc.createElement('span'); no.className = 'lp-no'; no.setAttribute('aria-hidden', 'true'); no.textContent = ab ? '–' : String(i); th.insertBefore(no, th.firstChild); if (ab) { const mk = doc.createElement('span'); mk.className = 'lp-mk lp-ab'; mk.textContent = 'Ab ' + ab + '. Lehrjahr'; th.insertAdjacentElement('afterend', mk); } }); });
    if (lj) { const p = doc.createElement('p'); p.className = 'lp-ljn'; p.textContent = 'Dein Pfad führt durch den Teil für das ' + lj + '. Lehrjahr. Alles andere bleibt in den Labs frei wählbar. Dein Lehrjahr stellst du unter „Ich“ ein.'; wrap.insertBefore(p, wrap.firstChild); }
    const rc = rec && byKey[rec]; if (rc) { rc.classList.add('lp-rec'); const mk = doc.createElement('span'); mk.className = 'lp-mk'; mk.textContent = began ? 'Weiter hier' : 'Start hier'; const th = rc.querySelector('.th'); if (th) th.insertAdjacentElement('afterend', mk); else rc.insertBefore(mk, rc.firstChild); }
    jetztDran(tracks, byKey, rec, lj);
    return true;
  }
  /* v78.195 Verschlanken: oben nur „Jetzt dran“ (die nächsten JETZT offenen Labs des Pfads ab der Empfehlung, im eigenen Lehrjahr),
     alles andere (restlicher Pfad, Projekte, Labs anderer Berufe) eingeklappt darunter. Nichts wird gesperrt. Bei höchstens 10 Karten bleibt alles offen. */
  const JETZT = 8;
  function jetztDran(tracks, byKey, rec, lj) {
    const L = root.Lernpfad; if (!rec || !L || !L.stat) return;
    if (labCards().filter(sichtbar).length <= JETZT + 2) return;
    const order = tracks.reduce((a, t) => a.concat(t.labs || []), []).filter((k, i, a) => byKey[k] && a.indexOf(k) === i && sichtbar(byKey[k]));
    const offen = k => { try { const s = L.stat(k), S = (lj && s.t) || s; return S.n > 0 && S.pct < 100; } catch (e) { return false; } };
    const i0 = order.indexOf(rec), ks = (i0 < 0 ? [rec].concat(order) : order.slice(i0)).filter((k, i, a) => byKey[k] && a.indexOf(k) === i && (k === rec || offen(k))).slice(0, JETZT); if (!ks.length) return;
    const box = sec('lpJetzt', 'Jetzt dran', 'Die nächsten Labs auf deinem Pfad' + (lj ? ' im ' + lj + '. Lehrjahr' : '') + '.', '');
    ks.forEach(k => box.appendChild(byKey[k]));
    const det = doc.createElement('details'); det.className = 'lp-spaeter'; det.id = 'lpSpaeter';
    det.innerHTML = '<summary>Später und alle weiteren Labs <small class="gc"></small></summary>';
    Array.from(wrap.children).filter(x => x.id !== 'lpJetzt' && !x.classList.contains('lp-ljn')).forEach(x => det.appendChild(x));
    wrap.appendChild(det);
  }
  function lf(cards, byKey, nachher) {
    const AP = root.AusbildungsPlan, b = root.BerufReg && root.BerufReg.cur ? root.BerufReg.cur() : 'egs', p = AP && AP.plan ? AP.plan(b) : null;
    if (!p || !(p.lernfelder || []).length) {
      if (!nachher) laden(b, () => { if (modus === 'lf') sortiere('lf', true); });
      thema(cards); return false;
    }
    mitEimern(eimer('lf', { labs: Object.keys(byKey), lernfelder: p.lernfelder }), cards, byKey);
    return true;
  }
  function laden(b, cb) {
    const s = src => new Promise(ok => { if (doc.querySelector('script[src="' + src + '"]')) { setTimeout(() => ok(), 300); return; } const e = doc.createElement('script'); e.src = src; e.onload = () => ok(); e.onerror = () => ok(); doc.head.appendChild(e); });
    (root.AusbildungsPlan ? Promise.resolve() : s('ausbildungsplan-core.js')).then(() => (root.AusbildungsPlan && root.AusbildungsPlan.plan(b) ? null : s('ausbildungsplan-' + b + '.js'))).then(() => cb());
  }
  /* Sortierung wechseln: Karten bleiben dieselben Elemente, nur die Abschnitte werden neu gebaut */
  function sortiere(m, nachher) {
    if (!wrap) return modus;
    if (MODI.indexOf(m) < 0) m = 'thema';
    const cards = labCards(); aufraeumen(cards);
    const byKey = {}; cards.forEach(c => { const k = REGkey(c); if (k && !byKey[k]) byKey[k] = c; });
    wrap.querySelectorAll('.lp-pj,.lp-hub,.lp-ljn').forEach(x => x.remove());
    const auf = !!wrap.querySelector('.lp-spaeter[open]');
    cards.forEach(c => wrap.appendChild(c)); secs().forEach(s => s.remove()); wrap.querySelectorAll('.lp-spaeter').forEach(x => x.remove());
    modus = m; let ok = true;
    if (m === 'pfad') ok = pfad(cards, byKey); else if (m === 'lf') ok = lf(cards, byKey, nachher); else thema(cards);
    const sp = wrap.querySelector('.lp-spaeter'); if (sp && auf) sp.open = true;   // nach neuem Sortieren (z. B. Lernpfad fertig geladen) offen lassen, wenn es offen war
    html.setAttribute('data-sort', m); wrap.setAttribute('data-sort', m);
    const note = doc.getElementById('lbLfNote'); if (note) note.hidden = !(m === 'lf' && !ok);
    rubApply(); refresh();
    try { root.dispatchEvent(new CustomEvent('labs:sortiert', { detail: { modus: m, ok } })); } catch (e) {}
    return m;
  }

  function build() {
    const flat = doc.getElementById('cardsFlat'); if (!flat || doc.getElementById('groups')) return;
    const list = Array.from(flat.children).filter(c => c.classList && c.classList.contains('card'));
    list.forEach((c, i) => { c.dataset.pos = String(i); });          // Dateireihenfolge merken (Sortierung Thema)
    wrap = doc.createElement('div'); wrap.id = 'groups';
    flat.parentNode.insertBefore(wrap, flat); list.forEach(c => wrap.appendChild(c)); flat.remove();
    thema(list);
    decorate(); watchRings(); mkChips(); refresh();
  }

  root.HomeGroups = {
    GROUPS, OTHER, MODI, refresh, sortiere, eimer,
    modus: () => modus,
    sichtbar,
    groupOf(el) { const s = el && el.closest && el.closest('section.grp'); return s ? (s.dataset.grp || s.id) : ''; },
    // alte Aufrufer (Startseite anpassen, Suche) gibt es nicht mehr; die Funktionen bleiben als leere Hülle, damit fremde Skripte nicht stolpern
    apply() {}, setEdit() {}, setSearch() {}, wantOpen() {}, state() { return {}; }
  };
  build();
})(typeof window !== 'undefined' ? window : this);
