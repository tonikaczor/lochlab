'use strict';
/* Tonfunk Lab: Berufe-Reiter auf der Startseite.
   Jede Karte in index.html kann data-beruf="egs im" tragen (Leerzeichen-getrennte Kürzel); ohne Attribut gehört sie zu "egs" (Elektroniker für Geräte und Systeme),
   data-beruf="alle" erscheint bei jedem Beruf. Der Reiter blendet fremde Karten mit .be-out aus; die Wahl steht in localStorage lm4.beruf.
   Berufe ohne eigene Karten zeigen eine Vorschau der geplanten Labs (PLAN). Läuft nach home-groups.js (Gruppen müssen gebaut sein), ohne Skript bleibt die Startseite wie bisher. */
(function (root) {
  const KEY = 'lm4.beruf';
  const BERUFE = [
    { k: 'egs', n: 'Elektroniker', s: 'Geräte und Systeme' },
    { k: 'ige', n: 'Industrieelektriker', s: 'Geräte und Systeme, 2 Jahre' },
    { k: 'im', n: 'Industriemechaniker', s: 'Fertigung, Pneumatik, Instandhaltung' },
    { k: 'tpd', n: 'Techn. Produktdesigner', s: 'Zeichnen, Konstruieren, Normteile' },
    { k: 'fll', n: 'Lagerlogistik', s: 'Lager, Ladungssicherung, Disposition' },
    { k: 'ik', n: 'Industriekaufmann', s: 'Buchführung, Kalkulation, Einkauf' },
    { k: 'fi', n: 'Fachinformatiker', s: 'Netzwerk, Datenbank, Sicherheit' }
  ];
  // Vorschau: geplante Labs je Beruf (Stand: Ideensammlung, Fachinhalt wird mit den Ausbildern abgestimmt)
  const PLAN = {
    tpd: ['Räumliches Vorstellen'],
    fll: ['Gefahrgut und Kennzeichnung', ],
    ik: ['ERP-Simulation Auftragsabwicklung'],
    fi: ['Projekt: Lasten- und Pflichtenheft']
  };
  const DEFAULT = 'egs';
  const keys = () => BERUFE.map(b => b.k);
  // gehört die Karte (Wert von data-beruf, evtl. leer) zum gewählten Beruf?
  function matches(attr, k) {
    const a = String(attr || DEFAULT).trim().split(/\s+/).filter(Boolean);
    return a.indexOf('alle') >= 0 || a.indexOf(k) >= 0;
  }
  /* Anordnung: Reihenfolge und ausgeblendete Berufe, gespeichert in lm4.berufe = {order:[Kürzel], hidden:[Kürzel]}; mindestens ein Beruf bleibt sichtbar */
  const CFG_KEY = 'lm4.berufe';
  function normCfg(c) {
    c = c && typeof c === 'object' ? c : {}; const ks = keys(), uniq = a => (Array.isArray(a) ? a : []).filter((k, i, x) => ks.indexOf(k) >= 0 && x.indexOf(k) === i);
    const order = uniq(c.order); ks.forEach(k => { if (order.indexOf(k) < 0) order.push(k); });
    let hidden = uniq(c.hidden); if (hidden.length >= order.length) hidden = [];
    return { order, hidden };
  }
  const visible = c => { const n = normCfg(c); return n.order.filter(k => n.hidden.indexOf(k) < 0); };
  function move(c, k, d) { const n = normCfg(c), i = n.order.indexOf(k), j = i + d; if (i < 0 || j < 0 || j >= n.order.length) return n; n.order[i] = n.order[j]; n.order[j] = k; return n; }
  function toggle(c, k) { const n = normCfg(c), h = n.hidden.indexOf(k); if (h >= 0) n.hidden.splice(h, 1); else if (visible(n).length > 1 && n.order.indexOf(k) >= 0) n.hidden.push(k); return n; }
  if (typeof module === 'object' && module.exports) module.exports = { BERUFE, PLAN, KEY, DEFAULT, matches, CFG_KEY, normCfg, visible, move, toggle };
  if (typeof document === 'undefined') return;
  const doc = document;
  let cur = DEFAULT, cfg = normCfg(null);
  try { cfg = normCfg(JSON.parse(localStorage.getItem(CFG_KEY) || 'null')); } catch (e) {}
  const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {} };
  const bOf = k => BERUFE.find(b => b.k === k);
  try { const v = localStorage.getItem(KEY); if (v && keys().indexOf(v) >= 0) cur = v; } catch (e) {}
  // Aufruf ?beruf=im (z. B. aus Links) wählt den Reiter, ohne ihn zu speichern
  try { const q = new URLSearchParams(location.search).get('beruf'); if (q && keys().indexOf(q) >= 0) cur = q; } catch (e) {}
  if (visible(cfg).indexOf(cur) < 0) cur = visible(cfg)[0];

  function css() {
    if (doc.getElementById('beCss')) return;
    const st = doc.createElement('style'); st.id = 'beCss';
    st.textContent = '.card.be-out{display:none!important}'
      + '.be-tabs{margin:0 0 14px}.be-tabs ul{list-style:none;margin:0;padding:0;display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}.be-tabs ul::-webkit-scrollbar{display:none}'
      + '.be-tab{flex:none;min-height:46px;padding:6px 16px;border-radius:14px;background:var(--panel);border:1px solid var(--line);color:var(--fg);font-weight:600;font-size:15px;line-height:1.15;font-family:inherit;cursor:pointer;display:flex;flex-direction:column;justify-content:center;text-align:left;touch-action:manipulation}'
      + '.be-tab small{font-weight:500;font-size:11.5px;color:var(--mute);margin-top:1px;white-space:nowrap}'
      + '.be-tab[aria-pressed=true]{background:var(--accent-bg);border-color:var(--accent-bg);color:var(--accent-ink,#fff)}.be-tab[aria-pressed=true] small{color:inherit;opacity:.85}'
      + '.be-tab:focus-visible{outline:3px solid var(--accent);outline-offset:2px}'
      + '.be-edit{flex:none;align-self:center;min-height:40px;padding:4px 12px;border-radius:12px;background:transparent;border:1px dashed var(--line);color:var(--mute);font:inherit;font-size:13px;cursor:pointer}.be-edit[aria-expanded=true]{color:var(--fg);border-style:solid}'
      + '.be-panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin:8px 0 0}.be-panel p{margin:0 0 8px;color:var(--mute);font-size:13px}.be-panel ul{display:block;overflow:visible;list-style:none;margin:0;padding:0}'
      + '.be-panel li{display:flex;align-items:center;gap:8px;padding:4px 0;border-top:1px solid var(--line)}.be-panel li:first-child{border-top:0}.be-panel label{flex:1;display:flex;align-items:center;gap:8px;min-height:40px;cursor:pointer}.be-panel input{width:20px;height:20px}'
      + '.be-panel button{min-width:44px;min-height:40px;border-radius:10px;background:var(--panel);border:1px solid var(--line);color:var(--fg);font:inherit;cursor:pointer}.be-panel button:disabled{opacity:.35;cursor:default}.be-panel .be-reset{margin-top:8px;font-size:13px;padding:4px 12px}'
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
    const panel = doc.createElement('section'); panel.className = 'be-panel'; panel.id = 'beEdit'; panel.hidden = true;
    function tabs() {
      ul.textContent = '';
      visible(cfg).forEach(k => {
        const b = bOf(k), li = doc.createElement('li'), bt = doc.createElement('button');
        bt.type = 'button'; bt.className = 'be-tab'; bt.dataset.k = b.k; bt.setAttribute('aria-pressed', 'false');
        bt.innerHTML = '<span></span><small></small>'; bt.firstChild.textContent = b.n; bt.lastChild.textContent = b.s;
        li.appendChild(bt); ul.appendChild(li);
      });
      const li = doc.createElement('li'), eb = doc.createElement('button');
      eb.type = 'button'; eb.className = 'be-edit'; eb.id = 'beEditBtn'; eb.textContent = '⚙ Berufe anordnen'; eb.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true'); eb.setAttribute('aria-controls', 'beEdit');
      li.appendChild(eb); ul.appendChild(li);
    }
    function rows() {
      panel.textContent = '';
      const p = doc.createElement('p'); p.textContent = 'Mit den Pfeilen verschieben, mit dem Haken ein- oder ausblenden. Mindestens ein Beruf bleibt sichtbar. Der Lernstand bleibt erhalten.'; panel.appendChild(p);
      const l = doc.createElement('ul'), vis = visible(cfg);
      cfg.order.forEach((k, i) => {
        const b = bOf(k), li = doc.createElement('li'), lb = doc.createElement('label'), cb = doc.createElement('input'), t = doc.createElement('span');
        cb.type = 'checkbox'; cb.checked = cfg.hidden.indexOf(k) < 0; cb.dataset.k = k; cb.disabled = cb.checked && vis.length < 2; cb.setAttribute('aria-label', b.n + ' anzeigen');
        t.textContent = b.n; lb.appendChild(cb); lb.appendChild(t); li.appendChild(lb);
        [['▲', -1, 'nach oben'], ['▼', 1, 'nach unten']].forEach(([sym, d, tx]) => {
          const bt = doc.createElement('button'); bt.type = 'button'; bt.textContent = sym; bt.dataset.k = k; bt.dataset.d = d; bt.setAttribute('aria-label', b.n + ' ' + tx);
          bt.disabled = (d < 0 && i === 0) || (d > 0 && i === cfg.order.length - 1); li.appendChild(bt);
        });
        l.appendChild(li);
      });
      panel.appendChild(l);
      const r = doc.createElement('button'); r.type = 'button'; r.className = 'be-reset'; r.textContent = 'Zurücksetzen'; panel.appendChild(r);
    }
    function changed() {
      saveCfg(); const was = cur; if (visible(cfg).indexOf(cur) < 0) cur = visible(cfg)[0];
      tabs(); rows(); apply(cur !== was);
      if (cur !== was) { try { if (doc.getElementById('lernpfad') || doc.getElementById('top')) location.reload(); } catch (err) {} }
    }
    panel.addEventListener('click', e => {
      const t = e.target; if (!t || !t.closest) return;
      const b = t.closest('button'); if (!b) return;
      if (b.classList.contains('be-reset')) { cfg = normCfg(null); changed(); return; }
      if (b.dataset.d) { cfg = move(cfg, b.dataset.k, Number(b.dataset.d)); changed(); }
    });
    panel.addEventListener('change', e => { const t = e.target; if (t && t.type === 'checkbox') { cfg = toggle(cfg, t.dataset.k); changed(); } });
    ul.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.be-edit'); if (!b) return; panel.hidden = !panel.hidden; b.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true'); if (!panel.hidden) rows(); });
    tabs();
    nav.appendChild(ul);
    nav.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.be-tab'); if (!b || b.dataset.k === cur) return; cur = b.dataset.k; apply(true); try { if (doc.getElementById('lernpfad') || doc.getElementById('top')) location.reload(); } catch (err) {} });   // Lernpfad, Weitermachen und Karriere richten sich nach dem Beruf: Seite neu aufbauen
    const soon = doc.createElement('section'); soon.className = 'be-soon'; soon.id = 'beSoon'; soon.hidden = true;
    const anchor = doc.getElementById('top') || doc.getElementById('groups');
    if (!anchor || !anchor.parentNode) return;
    nav.appendChild(panel);
    anchor.parentNode.insertBefore(nav, anchor);
    const g = doc.getElementById('groups'); if (g && g.parentNode) g.parentNode.insertBefore(soon, g);
    // Wiki: für alle Berufe. Die Projekte-Zeile (#vbRow) trägt data-beruf="alle" und filtert ihren Inhalt selbst nach Beruf (home-vb.js)
    const wk = doc.getElementById('wikiRow'); if (wk && !wk.hasAttribute('data-beruf')) wk.setAttribute('data-beruf', 'alle');
    apply(false);
  }
  root.Berufe = { BERUFE, PLAN, matches, visible: () => visible(cfg), get: () => cur, set(k) { if (keys().indexOf(k) >= 0) { cur = k; apply(true); } }, apply };
  build();
})(typeof window !== 'undefined' ? window : this);
