'use strict';
/* Tonfunk Lab: Projekte-Zeile der Startseite (#vbRow, v55.170).
   Die Zeile steht weit oben (unter Beruf und Weitermachen, vor den Lab-Karten) und gilt für jeden Beruf. Text und Projektliste kommen aus
   BerufReg (aufgaben.js, window.VB_INDEX): nur die Projekte des gewählten Berufs, Anzahl und "x von y abgeschlossen" aus dem gespeicherten Projektstand.
   Ist noch kein Beruf gewählt (kein lm4.beruf, kein ?beruf=), zeigt sie alle Projekte. Ohne dieses Skript bleibt der feste Text aus index.html stehen. */
(function (root) {
  const NAMEN = { egs: 'Elektroniker', ige: 'Industrieelektriker', im: 'Industriemechaniker', tpd: 'Techn. Produktdesigner', fll: 'Lagerlogistik', ik: 'Industriekaufmann', fi: 'Fachinformatiker' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  // reine Teile (auch in Node prüfbar): Auswahl der Projekte und die beiden Textzeilen
  function chosen(search, stored) {
    const ks = Object.keys(NAMEN);
    const q = /[?&]beruf=(\w+)/.exec(search || '');
    if (q && ks.indexOf(q[1]) >= 0) return q[1];
    return stored && ks.indexOf(stored) >= 0 ? stored : '';
  }
  function summary(index, b, stateOf) {
    const fits = p => { const x = p.beruf || ['egs']; return !b || x.indexOf('alle') >= 0 || x.indexOf(b) >= 0; };
    const list = (index || []).filter(fits).sort((x, y) => (x.order || 99) - (y.order || 99)).map(p => {
      const s = stateOf(p.id) || {};
      return { id: p.id, name: p.name, icon: p.icon, n: s.total != null ? s.total : p.st.length, done: s.done || 0, fin: !!s.fin, started: !!(s.started || s.fin) };
    });
    return { n: list.length, fertig: list.filter(x => x.fin).length, begonnen: list.filter(x => x.started && !x.fin).length, list: list, rest: (index || []).length - list.length };
  }
  function lines(sum, b) {
    const who = b ? (NAMEN[b] || b) : 'Alle Berufe';
    if (!sum.n) return { head: who + ': Für diesen Beruf gibt es noch kein eigenes Projekt.', tail: sum.rest ? 'Die Projekte der anderen Berufe kannst du trotzdem ausprobieren.' : '' };
    let h = who + ': ' + plural(sum.n, 'Projekt', 'Projekte') + ', ' + sum.fertig + ' von ' + sum.n + ' abgeschlossen';
    if (sum.begonnen) h += ', ' + sum.begonnen + (sum.begonnen === 1 ? ' läuft' : ' laufen');
    return { head: h, tail: b && sum.rest > 0 ? 'Dazu ' + plural(sum.rest, 'weiteres Projekt', 'weitere Projekte') + ' anderer Berufe im Projekt-Bereich.' : '' };
  }
  if (typeof module === 'object' && module.exports) module.exports = { NAMEN, chosen, summary, lines };
  if (typeof document === 'undefined') return;
  const doc = document;

  function chip(p) {
    const st = p.fin ? '✓ fertig' : p.started ? p.done + ' von ' + p.n : p.n + (p.n === 1 ? ' Station' : ' Stationen');
    return '<li><a class="' + (p.fin ? 'fin' : '') + '" href="verbund.html?projekt=' + encodeURIComponent(p.id) + '"><span aria-hidden="true">' + esc(p.icon || '🧩') + '</span><span>' + esc(p.name) + '</span><small>' + esc(st) + '</small></a></li>';
  }
  function render() {
    const row = doc.getElementById('vbRow'), BR = root.BerufReg; if (!row || !BR || !Array.isArray(root.VB_INDEX)) return;
    let stored = ''; try { stored = localStorage.getItem('lm4.beruf') || ''; } catch (e) {}
    const b = chosen(root.location && root.location.search, stored);
    const sum = summary(root.VB_INDEX, b, id => BR.projState(id, b || undefined)), t = lines(sum, b);
    const n = doc.getElementById('vbN'), L = doc.getElementById('vbL');
    if (n) n.innerHTML = esc(t.head) + (t.tail ? ' <small>' + esc(t.tail) + '</small>' : '');
    if (L) {
      const narrow = !!(root.matchMedia && root.matchMedia('(max-width:639px)').matches), keep = L.querySelector('details') ? L.querySelector('details').open : null;
      const open = keep === null ? (!narrow || sum.n <= 3) : keep;
      L.innerHTML = sum.n ? '<details' + (open ? ' open' : '') + '><summary>' + (sum.n === 1 ? 'Das Projekt ansehen' : 'Die ' + sum.n + ' Projekte ansehen') + '</summary><ul class="vbl" aria-label="Projekte">' + sum.list.map(chip).join('') + '</ul></details>' : '';
    }
  }
  render();
  root.addEventListener('pageshow', render);
  root.addEventListener('storage', e => { if (!e.key || e.key === 'lm4.beruf' || e.key === 'lm4.stats' || e.key.indexOf('verbund.') === 0) render(); });
  doc.addEventListener('click', e => { if (e.target.closest && e.target.closest('.be-tab')) setTimeout(render, 50); });   // Beruf gewechselt (die Seite lädt danach meist neu)
  root.HomeVb = { render, chosen, summary, lines };
})(typeof window !== 'undefined' ? window : globalThis);
