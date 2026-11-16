'use strict';
/* Tonfunk Lab: Ausbildungsplan-Zeile der Startseite (#planRow, Paket P1), seit dem Umbau in fünf Ansichten (S1) in der Ansicht "Prüfen".
   Kompakte Zeile "Dein Ausbildungsplan": eine Fortschrittszeile, ein Vorschlag "Als Nächstes" (ein Lernfeld) und der Knopf zur Seite ausbildungsplan.html.
   Sie baut ihren Inhalt selbst in section#planRow (Muster wie home-vb.js: reine summary()/lines() plus DOM), lädt den Kern und den Plan des gewählten Berufs bei Bedarf nach
   und liest den Lernstand nur. Keine Klappe mehr (der alte Schlüssel "plan" in lm4.home.groups bleibt im Speicher). Ohne gespeicherten Beruf gilt die Voreinstellung von berufe.js.
   Dazu füllt sie in derselben Ansicht die Zeile Countdown mit Wochenplan (#prCd, Prüfungs-Countdown aus countdown.js).
   Ohne Beruf zeigt sie einen kurzen Hinweis, bei leerem Plan (Skelett) den Satz "Plan für deinen Beruf wird gerade zusammengestellt".
   Voraussetzung: aufgaben.js ist geladen (AUFGABEN, LAB_REG, VB_INDEX). Ohne section#planRow passiert nichts. */
(function (root) {
  const WEGE = ['tec', 'stu', 'wing', 'winf'];   // Wege Studium/Technik (berufe.js): statt Ausbildungsplan ein Lernpfad aus Modulen, Daten in ausbildungsplan-<weg>.js
  const KEYS = ['egs', 'ige', 'im', 'tpd', 'fll', 'ik', 'fi'].concat(WEGE);
  const NAMEN = { egs: 'Elektroniker', ige: 'Industrieelektriker', im: 'Industriemechaniker', tpd: 'Techn. Produktdesigner', fll: 'Lagerlogistik', ik: 'Industriekaufmann', fi: 'Fachinformatiker', tec: 'Techniker Elektrotechnik', stu: 'Studium Elektrotechnik', wing: 'Wirtschaftsingenieur', winf: 'Wirtschaftsinformatik' };
  const TXT = { kein: 'Wähle unter „Ich“ deinen Beruf, dann zeigt dir der Ausbildungsplan, wo du stehst und womit du weitermachen kannst.', leer: 'Plan für deinen Beruf wird gerade zusammengestellt.', fehlt: 'Der Ausbildungsplan konnte gerade nicht geladen werden.' };

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
    const weg = WEGE.indexOf(sum.beruf) >= 0;
    let h = who + ': ' + sum.begonnen + ' von ' + sum.mit + (weg ? (sum.mit === 1 ? ' Modul' : ' Modulen') : (sum.mit === 1 ? ' Lernfeld' : ' Lernfeldern')) + ' begonnen, ' + sum.pct + ' %';
    if (sum.entwurf) h += ' (Plan im Entwurf)';
    const n = sum.next ? (sum.next.start ? 'Starte zum Beispiel mit: ' : 'Als Nächstes: ') + sum.next.titel : sum.hier ? 'Du bist bei: ' + sum.hier.titel : '';
    return { head: h, next: n, open: true };
  }
  const exp = { KEYS, NAMEN, WEGE, chosen, summary, lines, TXT };
  if (typeof module === 'object' && module.exports) module.exports = exp;
  if (typeof document === 'undefined') return;
  const doc = document, row = doc.getElementById('planRow');
  root.HomePlan = exp;
  if (!row) return;

  /* ---------- DOM ---------- */
  const CSS = '#planRow .plnext{margin:2px 0 0;font-size:14px;color:var(--mute);overflow-wrap:anywhere}#planRow .plnext a{color:var(--accent);display:inline-flex;align-items:center;min-height:44px}'
    + '#planRow a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}';
  const el = (tag, props, kids) => { const e = doc.createElement(tag); Object.keys(props || {}).forEach(k => { const v = props[k]; if (v == null) return; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, String(v)); }); (kids || []).forEach(c => e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c)); return e; };
  const clear = e => { while (e.firstChild) e.removeChild(e.firstChild); };
  const store = k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
  let R = null;   // Verweise auf die Teile der Zeile

  function skeleton() {
    if (R) return;
    try { const st = doc.createElement('style'); st.id = 'planRowCss'; st.textContent = CSS; (doc.head || doc.body).appendChild(st); } catch (e) {}
    const head = el('h2', { id: 'planH', text: 'Dein Ausbildungsplan' }), n = el('div', { class: 'vbn', id: 'planN', 'aria-live': 'polite' });
    const next = el('p', { class: 'plnext', id: 'planNext' }), btns = el('div', { class: 'plbtns' });
    let ic = null; try { ic = typeof row.querySelector === 'function' ? row.querySelector('.mw-i') : null; } catch (e) { ic = null; }   // das Symbol steht in index.html und bleibt
    clear(row); if (ic) row.appendChild(ic);
    row.appendChild(el('div', { class: 'vbt' }, [head, n, next])); row.appendChild(btns);
    R = { n: n, next: next, btns: btns, head: head };
  }
  /* Zeile Countdown mit Wochenplan (#prCd) in der Ansicht Prüfen: mit Datum "noch X Tage" und heute dran, sonst Einladung zum Eintragen */
  function countdown(weg) {
    const a = doc.getElementById('prCd'); if (!a) return;
    let k = null; try { const C = root.Countdown; k = C && C.kurz ? C.kurz() : null; } catch (e) { k = null; }
    const t = doc.getElementById('prCdT'), s = doc.getElementById('prCdS'), z = doc.getElementById('prCdZ');
    if (t) t.textContent = weg ? 'Klausur oder Abschluss: Countdown' : 'Countdown mit Wochenplan';
    if (s) s.textContent = k ? (k.heute ? 'Heute dran: ' + k.heute.titel + '.' : 'Dein Wochenplan bis zum Termin.') : (weg ? 'Datum von Klausur oder Abschluss setzen, dazu ein Wochenplan.' : 'Trag deinen Prüfungstermin ein, dann bekommst du einen Wochenplan.');
    if (z) z.textContent = k ? k.text.replace(/\.$/, '') : '';
    a.setAttribute('href', k ? k.href : 'meinstand.html#countdown');
  }
  function url(b, ueb, lf) { return 'ausbildungsplan.html' + (ueb && b ? '?beruf=' + b : '') + (lf ? '#lf=' + encodeURIComponent(lf) : ''); }
  function fill(sum, ueb) {
    skeleton();
    const t = lines(sum);
    const weg = WEGE.indexOf(sum.beruf) >= 0;
    R.head.textContent = weg ? 'Dein Lernpfad' : 'Dein Ausbildungsplan';
    R.n.textContent = t.head; clear(R.next); clear(R.btns);
    if (t.next) {
      const pre = sum.next ? (sum.next.start ? 'Starte zum Beispiel mit: ' : 'Als Nächstes: ') : 'Du bist bei: ', ttl = sum.next ? sum.next.titel : sum.hier.titel, id = sum.next ? sum.next.id : sum.hier.id;
      R.next.appendChild(doc.createTextNode(pre)); R.next.appendChild(el('a', { href: url(sum.beruf, ueb, id), text: ttl }));
    } else if (sum.zustand === 'ok') R.next.textContent = weg ? 'Such dir ein Modul aus, eine feste Reihenfolge gibt es nicht.' : 'Such dir ein Lernfeld aus, eine feste Reihenfolge gibt es nicht.';
    if (sum.zustand !== 'leer') R.btns.appendChild(el('a', { class: 'btn pri', href: url(sum.beruf, ueb, ''), text: weg ? 'Lernpfad öffnen' : 'Ausbildungsplan öffnen' }));
    try { countdown(weg); } catch (e) {}   // Prüfungs-Countdown (countdown.js) in der eigenen Zeile #prCd
    row.hidden = false; row.removeAttribute('hidden');
    try { root.dispatchEvent(new Event('plan:geladen')); } catch (e) {}   // Mein Weg (meinweg.js) zeichnet seine Plan-Kachel neu
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
      const c = chosen(root.location && root.location.search, store('lm4.beruf') || (root.Berufe && root.Berufe.get ? root.Berufe.get() : '')), b = c.beruf;   // ohne gespeicherte Wahl gilt die Voreinstellung (S-03)
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
  if (root.addEventListener) root.addEventListener('countdown:geaendert', () => { try { countdown(WEGE.indexOf(chosen(root.location && root.location.search, store('lm4.beruf')).beruf) >= 0); } catch (e) {} });
})(typeof window !== 'undefined' ? window : globalThis);
