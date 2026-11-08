'use strict';
/* Tonfunk Lab: Berufe-Reiter auf der Startseite.
   Jede Karte in index.html kann data-beruf="egs im" tragen (Leerzeichen-getrennte Kürzel); ohne Attribut gehört sie zu "egs" (Elektroniker für Geräte und Systeme),
   data-beruf="alle" erscheint bei jedem Beruf. Der Reiter blendet fremde Karten mit .be-out aus; die Wahl steht in localStorage lm4.beruf.
   Berufe ohne eigene Karten zeigen eine Vorschau der geplanten Labs (PLAN). Läuft nach home-groups.js (Gruppen müssen gebaut sein), ohne Skript bleibt die Startseite wie bisher. */
(function (root) {
  const KEY = 'lm4.beruf';
  const BERUFE = [
    { k: 'egs', n: 'Elektroniker', s: 'Geräte und Systeme' },
    { k: 'im', n: 'Industriemechaniker', s: 'Fertigung, Pneumatik, Instandhaltung' },
    { k: 'tpd', n: 'Techn. Produktdesigner', s: 'Zeichnen, Konstruieren, Normteile' },
    { k: 'fll', n: 'Lagerlogistik', s: 'Lager, Ladungssicherung, Disposition' },
    { k: 'ik', n: 'Industriekaufmann', s: 'Buchführung, Kalkulation, Einkauf' },
    { k: 'fi', n: 'Fachinformatiker', s: 'Netzwerk, Datenbank, Sicherheit' }
  ];
  // Vorschau: geplante Labs je Beruf (Stand: Ideensammlung, Fachinhalt wird mit den Ausbildern abgestimmt)
  const PLAN = {
    tpd: ['Technisches Zeichnen: Ansichten und Schnitte', 'Normteile und Stücklisten', 'Form- und Lagetoleranzen', 'Maschinenelemente', 'Fertigungsgerecht konstruieren', 'Räumliches Vorstellen'],
    fll: ['Ladungssicherung', 'Lagerkennzahlen und Disposition', 'Lagerstrategien und Kommissionieren', 'Gefahrgut und Kennzeichnung', 'Wareneingang und Inventur', 'Stapler und Tragfähigkeit'],
    ik: ['Buchführung (Buchungssätze, Bilanz, GuV)', 'Kalkulation und Kostenrechnung', 'Beschaffung und Angebotsvergleich', 'Recht: Kaufvertrag und Fristen', 'Personal und Lohnabrechnung', 'ERP-Simulation Auftragsabwicklung'],
    fi: ['Netzwerk und Subnetting', 'Datenbank und SQL', 'Algorithmen (Struktogramm, PAP)', 'IT-Sicherheit', 'Linux-Terminal', 'Hardware', 'Projekt: Lasten- und Pflichtenheft']
  };
  const DEFAULT = 'egs';
  const keys = () => BERUFE.map(b => b.k);
  // gehört die Karte (Wert von data-beruf, evtl. leer) zum gewählten Beruf?
  function matches(attr, k) {
    const a = String(attr || DEFAULT).trim().split(/\s+/).filter(Boolean);
    return a.indexOf('alle') >= 0 || a.indexOf(k) >= 0;
  }
  if (typeof module === 'object' && module.exports) module.exports = { BERUFE, PLAN, KEY, DEFAULT, matches };
  if (typeof document === 'undefined') return;
  const doc = document;
  let cur = DEFAULT;
  try { const v = localStorage.getItem(KEY); if (v && keys().indexOf(v) >= 0) cur = v; } catch (e) {}
  // Aufruf ?beruf=im (z. B. aus Links) wählt den Reiter, ohne ihn zu speichern
  try { const q = new URLSearchParams(location.search).get('beruf'); if (q && keys().indexOf(q) >= 0) cur = q; } catch (e) {}

  function css() {
    if (doc.getElementById('beCss')) return;
    const st = doc.createElement('style'); st.id = 'beCss';
    st.textContent = '.card.be-out{display:none!important}'
      + 'html[data-beruf]:not([data-beruf=egs]) #top,html[data-beruf]:not([data-beruf=egs]) #karCard{display:none}'   // Weitermachen, Lernpfad, Karriere zählen bisher nur die Elektronik-Labs
      + '.be-tabs{margin:0 0 14px}.be-tabs ul{list-style:none;margin:0;padding:0;display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}.be-tabs ul::-webkit-scrollbar{display:none}'
      + '.be-tab{flex:none;min-height:46px;padding:6px 16px;border-radius:14px;background:var(--panel);border:1px solid var(--line);color:var(--fg);font-weight:600;font-size:15px;line-height:1.15;font-family:inherit;cursor:pointer;display:flex;flex-direction:column;justify-content:center;text-align:left;touch-action:manipulation}'
      + '.be-tab small{font-weight:500;font-size:11.5px;color:var(--mute);margin-top:1px;white-space:nowrap}'
      + '.be-tab[aria-pressed=true]{background:var(--accent-bg);border-color:var(--accent-bg);color:var(--accent-ink,#fff)}.be-tab[aria-pressed=true] small{color:inherit;opacity:.85}'
      + '.be-tab:focus-visible{outline:3px solid var(--accent);outline-offset:2px}'
      + '.be-soon{background:var(--panel);border:1px dashed var(--line);border-radius:18px;padding:20px;margin:0 0 14px}.be-soon h2{margin:0 0 6px;font-size:19px}.be-soon p{margin:0 0 10px;color:var(--mute)}'
      + '.be-soon ul{margin:0;padding:0 0 0 20px;columns:2;column-gap:28px}.be-soon li{margin:0 0 4px;break-inside:avoid}@media(max-width:639px){.be-soon ul{columns:1}}'
      + '.be-soon .be-note{margin-top:12px;font-size:13px}';
    doc.head.appendChild(st);
  }

  function apply(save) {
    const cards = Array.from(doc.querySelectorAll('.card')).filter(c => !c.classList.contains('hm-ghost'));
    let n = 0;
    cards.forEach(c => {
      const ok = matches(c.getAttribute('data-beruf'), cur);
      c.classList.toggle('be-out', !ok);
      if (ok && !c.classList.contains('vbrow')) n++;
    });
    doc.documentElement.setAttribute('data-beruf', cur);
    doc.querySelectorAll('.be-tab').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === cur ? 'true' : 'false'));
    // Vorschau: bei Berufen mit Karten nur die noch fehlenden Labs, ohne Karten die ganze Liste
    const box = doc.getElementById('beSoon'); if (box) {
      const b = BERUFE.find(x => x.k === cur), plan = PLAN[cur];
      if (!plan) box.hidden = true;
      else {
        box.hidden = false;
        const have = Array.from(doc.querySelectorAll('.card[data-beruf~="' + cur + '"]:not(.vbrow)')).length;
        box.innerHTML = '<h2></h2><p></p><ul></ul><p class="be-note"></p>';
        box.querySelector('h2').textContent = have ? b.n + ': weitere Labs in Planung' : b.n + ': Labs in Vorbereitung';
        box.querySelector('p').textContent = have ? 'Diese Themen sollen noch dazukommen:' : 'Für diesen Beruf entstehen gerade eigene Labs. Geplant sind:';
        plan.forEach(t => { const li = doc.createElement('li'); li.textContent = t; box.querySelector('ul').appendChild(li); });
        box.querySelector('.be-note').textContent = 'Die Inhalte werden mit den Ausbildern des Berufs abgestimmt.';
      }
    }
    if (root.HomeGroups && root.HomeGroups.refresh) root.HomeGroups.refresh();
    if (save) { try { localStorage.setItem(KEY, cur); } catch (e) {} }
  }

  function build() {
    if (doc.getElementById('beTabs')) return;
    css();
    const nav = doc.createElement('nav'); nav.className = 'be-tabs'; nav.id = 'beTabs'; nav.setAttribute('aria-label', 'Beruf wählen');
    const ul = doc.createElement('ul');
    BERUFE.forEach(b => {
      const li = doc.createElement('li'), bt = doc.createElement('button');
      bt.type = 'button'; bt.className = 'be-tab'; bt.dataset.k = b.k; bt.setAttribute('aria-pressed', 'false');
      bt.innerHTML = '<span></span><small></small>'; bt.firstChild.textContent = b.n; bt.lastChild.textContent = b.s;
      li.appendChild(bt); ul.appendChild(li);
    });
    nav.appendChild(ul);
    nav.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.be-tab'); if (!b || b.dataset.k === cur) return; cur = b.dataset.k; apply(true); });
    const soon = doc.createElement('section'); soon.className = 'be-soon'; soon.id = 'beSoon'; soon.hidden = true;
    const anchor = doc.getElementById('top') || doc.getElementById('groups');
    if (!anchor || !anchor.parentNode) return;
    anchor.parentNode.insertBefore(nav, anchor);
    const g = doc.getElementById('groups'); if (g && g.parentNode) g.parentNode.insertBefore(soon, g);
    // Wiki und Verbundprojekte: Wiki für alle Berufe, Verbundprojekte nur Elektronik
    const wk = doc.getElementById('wikiRow'); if (wk && !wk.hasAttribute('data-beruf')) wk.setAttribute('data-beruf', 'alle');
    apply(false);
  }
  root.Berufe = { BERUFE, PLAN, matches, get: () => cur, set(k) { if (keys().indexOf(k) >= 0) { cur = k; apply(true); } }, apply };
  build();
})(typeof window !== 'undefined' ? window : this);
