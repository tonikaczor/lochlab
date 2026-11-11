'use strict';
/* Tonfunk Lab: Ausbildungsplan-Zeile der Startseite (#planRow, Paket P1).
   Kompakte Karte "Dein Ausbildungsplan": eine Fortschrittszeile, ein Vorschlag "Als Nächstes" und der Knopf zur Seite ausbildungsplan.html.
   Sie baut ihren Inhalt selbst in section#planRow (Muster wie home-vb.js: reine summary()/lines() plus DOM), lädt den Kern und den Plan des gewählten Berufs bei Bedarf nach
   und liest den Lernstand nur. Zuklappbar wie die Projekte-Zeile: Zustand im Schlüssel "plan" von lm4.home.groups (Standard: Desktop offen, Handy beim ersten Besuch zu).
   Ohne gewählten Beruf zeigt sie einen kurzen Hinweis, bei leerem Plan (Skelett) den Satz "Plan für deinen Beruf wird gerade zusammengestellt".
   Voraussetzung: aufgaben.js ist geladen (AUFGABEN, LAB_REG, VB_INDEX). Ohne section#planRow passiert nichts. */
(function (root) {
  const KEYS = ['egs', 'ige', 'im', 'tpd', 'fll', 'ik', 'fi'];
  const NAMEN = { egs: 'Elektroniker', ige: 'Industrieelektriker', im: 'Industriemechaniker', tpd: 'Techn. Produktdesigner', fll: 'Lagerlogistik', ik: 'Industriekaufmann', fi: 'Fachinformatiker' };
  const GRP = 'lm4.home.groups', SKEY = 'plan';
  const TXT = { kein: 'Wähle oben deinen Beruf, dann zeigt dir der Ausbildungsplan, wo du stehst und womit du weitermachen kannst.', leer: 'Plan für deinen Beruf wird gerade zusammengestellt.', fehlt: 'Der Ausbildungsplan konnte gerade nicht geladen werden.' };

  /* ---------- reine Teile (auch in Node prüfbar) ---------- */
  function chosen(search, stored) {
    const q = /[?&]beruf=(\w+)/.exec(search || '');
    if (q && KEYS.indexOf(q[1]) >= 0) return { beruf: q[1], ueberschrieben: true };
    return stored && KEYS.indexOf(stored) >= 0 ? { beruf: stored, ueberschrieben: false } : { beruf: '', ueberschrieben: false };
  }
  /* AP = AusbildungsPlan (Kern), b = Beruf, ls = Lernstand (AP.ladeLernstand), ctx wie im Kern (optional) */
  function summary(AP, b, ls, ctx) {
    const base = { beruf: b, name: NAMEN[b] || b, zustand: 'kein-beruf', mit: 0, begonnen: 0, pct: 0, entwurf: false, next: null, hier: null };
    if (!b) return base;
    const p = AP && AP.plan(b);
    if (!p) return Object.assign(base, { zustand: 'fehlt' });
    base.entwurf = p.status === 'entwurf';
    if (p.status === 'skelett' || !(p.lernfelder || []).length) return Object.assign(base, { zustand: 'leer' });
    const F = AP.lernfeldFortschritt(b, ls, ctx), N = AP.naechste(b, ls, ctx), lf = id => p.lernfelder.filter(l => l.id === id)[0];
    const mit = p.lernfelder.filter(l => !l.optional && F.lf[l.id] && F.lf[l.id].n > 0);   // optionale Lernfelder zählen nicht
    base.zustand = 'ok'; base.mit = mit.length; base.begonnen = mit.filter(l => F.lf[l.id].started).length; base.pct = F.gesamt.pct;
    if (N) {
      const h = N.hier && lf(N.hier.lf), n = N.naechste[0] && lf(N.naechste[0].lf);
      if (h) base.hier = { id: h.id, titel: h.titel };
      if (n) base.next = { id: n.id, titel: n.titel, start: !!N.leer };
    }
    return base;
  }
  function lines(sum) {
    const who = sum.name;
    if (sum.zustand === 'kein-beruf') return { head: TXT.kein, next: '', open: true };
    if (sum.zustand === 'leer') return { head: who + ': ' + TXT.leer, next: '', open: false };
    if (sum.zustand === 'fehlt') return { head: TXT.fehlt, next: '', open: true };
    let h = who + ': ' + sum.begonnen + ' von ' + sum.mit + (sum.mit === 1 ? ' Lernfeld' : ' Lernfeldern') + ' begonnen, ' + sum.pct + ' %';
    if (sum.entwurf) h += ' (Plan im Entwurf)';
    const n = sum.next ? (sum.next.start ? 'Starte zum Beispiel mit: ' : 'Als Nächstes: ') + sum.next.titel : sum.hier ? 'Du bist bei: ' + sum.hier.titel : '';
    return { head: h, next: n, open: true };
  }
  const exp = { KEYS, NAMEN, chosen, summary, lines, TXT };
  if (typeof module === 'object' && module.exports) module.exports = exp;
  if (typeof document === 'undefined') return;
  const doc = document, row = doc.getElementById('planRow');
  root.HomePlan = exp;
  if (!row) return;

  /* ---------- DOM ---------- */
  const CSS = '#planRow{margin:0 0 14px}#planRow .vbd>summary{display:flex;align-items:center;gap:10px;min-height:44px;list-style:none;cursor:pointer}#planRow .vbd>summary::-webkit-details-marker{display:none}'
    + '#planRow .vbh{flex:1;min-width:0}#planRow .vbh h2{margin:0;font-size:22px}#planRow .vbd[open]>summary{margin-bottom:10px}#planRow .vbn{margin-top:2px;font-size:14px;font-weight:600;overflow-wrap:anywhere}#planRow .vbn small{font-weight:400;color:var(--mute)}'
    + '#planRow .chev{flex:none;display:grid;place-items:center;width:44px;height:44px;color:var(--mute)}#planRow .chev::before{content:"";width:9px;height:9px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg) translate(-2px,-2px);transition:transform .15s}#planRow .vbd:not([open]) .chev::before{transform:rotate(-45deg)}'
    + '#planRow .vbd>summary:focus-visible,#planRow a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}'
    + '#planRow .plbody{display:flex;align-items:center;gap:16px;flex-wrap:wrap}#planRow .plnext{flex:1 1 260px;min-width:0;margin:0;font-size:15px;overflow-wrap:anywhere}#planRow .plnext a{color:var(--accent)}#planRow .plbtns{flex:0 0 auto;margin:0}#planRow .plbtns a.btn{min-width:150px;padding:0 18px}'
    + '@media(max-width:639px){#planRow .vbh h2{font-size:18px}#planRow .plbtns{flex:1 1 100%}}@media(prefers-reduced-motion:reduce){#planRow .chev::before{transition:none}}';
  const el = (tag, props, kids) => { const e = doc.createElement(tag); Object.keys(props || {}).forEach(k => { const v = props[k]; if (v == null) return; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, String(v)); }); (kids || []).forEach(c => e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c)); return e; };
  const clear = e => { while (e.firstChild) e.removeChild(e.firstChild); };
  const store = k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
  const mobile = () => { try { return !!root.matchMedia('(max-width:639px)').matches; } catch (e) { return false; } };
  const saved = () => { try { const o = JSON.parse(store(GRP)); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } };
  let R = null;   // Verweise auf die Teile der Zeile

  function skeleton() {
    if (R) return;
    try { const st = doc.createElement('style'); st.id = 'planRowCss'; st.textContent = CSS; (doc.head || doc.body).appendChild(st); } catch (e) {}
    const head = el('h2', { id: 'planH', text: 'Dein Ausbildungsplan' }), n = el('div', { class: 'vbn', id: 'planN', 'aria-live': 'polite' });
    const sum = el('summary', {}, [el('span', { class: 'vbh' }, [head, n]), el('span', { class: 'chev', 'aria-hidden': 'true' })]);
    const next = el('p', { class: 'plnext', id: 'planNext' }), btns = el('div', { class: 'plbtns' });
    const det = el('details', { class: 'vbd' }, [sum, el('div', { class: 'plbody' }, [next, btns])]);
    const g = saved(), open = (SKEY in g) ? !!g[SKEY] : !mobile();
    if (open) det.setAttribute('open', ''); try { det.open = open; } catch (e) {}
    sum.setAttribute('aria-expanded', open ? 'true' : 'false');
    // Eigene Wahl merken: nur nach Klick auf die Überschrift, und immer frisch lesen und zurückschreiben (home-groups.js führt denselben Schlüssel mit)
    sum.addEventListener('click', () => { det.setAttribute('data-user', '1'); });
    sum.addEventListener('keydown', ev => { if (ev && (ev.key === 'Enter' || ev.key === ' ')) det.setAttribute('data-user', '1'); });
    det.addEventListener('toggle', () => {
      sum.setAttribute('aria-expanded', det.open ? 'true' : 'false');
      if (det.getAttribute('data-user') !== '1') return;
      det.removeAttribute('data-user');
      try { const m = saved(); m[SKEY] = det.open ? 1 : 0; root.localStorage.setItem(GRP, JSON.stringify(m)); } catch (e) {}
    });
    clear(row); row.appendChild(det);
    R = { det: det, n: n, next: next, btns: btns };
  }
  function url(b, ueb, lf) { return 'ausbildungsplan.html' + (ueb && b ? '?beruf=' + b : '') + (lf ? '#lf=' + encodeURIComponent(lf) : ''); }
  function fill(sum, ueb) {
    skeleton();
    const t = lines(sum);
    R.n.textContent = t.head; clear(R.next); clear(R.btns);
    if (t.next) {
      const pre = sum.next ? (sum.next.start ? 'Starte zum Beispiel mit: ' : 'Als Nächstes: ') : 'Du bist bei: ', ttl = sum.next ? sum.next.titel : sum.hier.titel, id = sum.next ? sum.next.id : sum.hier.id;
      R.next.appendChild(doc.createTextNode(pre)); R.next.appendChild(el('a', { href: url(sum.beruf, ueb, id), text: ttl }));
    } else if (sum.zustand === 'ok') R.next.textContent = 'Such dir ein Lernfeld aus, eine feste Reihenfolge gibt es nicht.';
    if (sum.zustand !== 'leer') R.btns.appendChild(el('a', { class: 'btn pri', href: url(sum.beruf, ueb, ''), text: 'Ausbildungsplan öffnen' }));
    row.hidden = false; row.removeAttribute('hidden');
  }
  function loadScript(src, cb) {
    try { const s = doc.createElement('script'); s.src = src; s.onload = () => cb(true); s.onerror = () => cb(false); (doc.head || doc.body).appendChild(s); } catch (e) { cb(false); }
  }
  function ensure(b, cb) {
    const need = () => { if (!root.AusbildungsPlan) return cb(false); if (root.AusbildungsPlan.plan(b)) return cb(true); loadScript('ausbildungsplan-' + b + '.js', () => cb(!!(root.AusbildungsPlan && root.AusbildungsPlan.plan(b)))); };
    if (root.AusbildungsPlan) need(); else loadScript('ausbildungsplan-core.js', need);
  }
  function render() {
    try {
      skeleton();
      const c = chosen(root.location && root.location.search, store('lm4.beruf')), b = c.beruf;
      if (!b) { fill(summary(null, '', null), false); return; }
      if (!Array.isArray(root.AUFGABEN)) { fill(summary(null, b, null), c.ueberschrieben); return; }
      ensure(b, ok => {
        try {
          const AP = root.AusbildungsPlan;
          if (!ok || !AP) { fill(summary(AP || null, b, null), c.ueberschrieben); return; }
          const ls = AP.ladeLernstand(store, (root.VB_INDEX || []).map(x => x.id));
          fill(summary(AP, b, ls), c.ueberschrieben);
        } catch (e) { try { fill({ beruf: b, name: NAMEN[b] || b, zustand: 'fehlt' }, c.ueberschrieben); } catch (x) {} }
      });
    } catch (e) { try { row.hidden = true; } catch (x) {} }
  }
  skeleton();   // Gerüst sofort (vor home-groups.js), Inhalt danach
  root.HomePlan.render = render;
  render();
  if (root.addEventListener) {
    root.addEventListener('pageshow', render);
    root.addEventListener('storage', e => { if (!e.key || e.key === 'lm4.beruf' || /^(sim\.done|lm4\.)/.test(e.key) || e.key.indexOf('verbund.') === 0) render(); });
  }
  doc.addEventListener('click', e => { if (e && e.target && e.target.closest && e.target.closest('.be-tab')) setTimeout(render, 50); });   // Beruf gewechselt
})(typeof window !== 'undefined' ? window : globalThis);
