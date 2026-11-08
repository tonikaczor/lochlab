'use strict';
/* Tonfunk Lab: Fragen für deinen Beruf (v42.159). Übungsfragen (Mehrfachwahl) für Industriemechaniker, Produktdesigner, Lagerlogistik,
   Industriekaufleute und Fachinformatiker aus pruefbank-beruf.js. Reines Üben: kein Eintrag in die Prüfungs-Historie, kein Tipp-Abzug.
   Der Kern (core) hat keinen DOM-Zugriff und ist in Node testbar. */
(function (root) {
  const NAMEN = { im: 'Industriemechaniker', tpd: 'Produktdesigner', fll: 'Lagerlogistik', ik: 'Industriekaufmann', fi: 'Fachinformatiker' };
  const core = {
    NAMEN,
    themen(B, beruf) { return B && B.themenFuer ? B.themenFuer(beruf).map(t => ({ k: t.k, t: t.t, n: B.MC.filter(m => m[0] === t.k).length })) : []; },
    /* Fragen ziehen: ein Thema oder (leer) alle Themen des Berufs gemischt, höchstens n */
    ziehen(B, beruf, thema, n, seed) {
      const ks = thema ? [thema] : core.themen(B, beruf).map(t => t.k);
      const r = B.seeded(seed), qs = [];
      ks.forEach(k => B.drawBeruf(k, 99, seed).forEach(q => qs.push(q)));
      return r.shuffle(qs).slice(0, n);
    },
    /* Auswertung: antworten[i] = gewählter Index oder -1 */
    auswerten(qs, antworten) {
      let ok = 0; qs.forEach((q, i) => { if (antworten[i] === q.r) ok++; });
      return { richtig: ok, gesamt: qs.length, pct: qs.length ? Math.round(100 * ok / qs.length) : 0 };
    }
  };
  root.Berufsfragen = core;
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  if (typeof document === 'undefined') return;

  const $ = s => document.querySelector(s), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const B = () => root.PR_BANK;
  let beruf = 'im', qs = [], ant = [], pos = 0, fertig = false;
  function stdBeruf() { try { const v = String(localStorage.getItem('lm4.beruf') || '').replace(/"/g, ''); return NAMEN[v] ? v : 'im'; } catch (e) { return 'im'; } }
  function wahl() {
    const out = $('#out');
    out.innerHTML = '<p><label for="ber">Beruf: </label><select id="ber">' + Object.keys(NAMEN).map(k => '<option value="' + k + '"' + (k === beruf ? ' selected' : '') + '>' + NAMEN[k] + '</option>').join('') + '</select></p>' +
      '<p><label for="thm">Thema: </label><select id="thm"><option value="">alle Themen gemischt</option>' + core.themen(B(), beruf).map(t => '<option value="' + t.k + '">' + esc(t.t.replace(/^[^:]*: /, '')) + ' (' + t.n + ')</option>').join('') + '</select></p>' +
      '<p><button type="button" class="btn" id="go">Fragen starten</button></p><p class="mute">Für Elektroniker gibt es die Fragen im <a href="pruefungslab.html">Prüfungs-Lab</a>.</p>';
    $('#ber').onchange = () => { beruf = $('#ber').value; wahl(); };
    $('#go').onclick = () => { qs = core.ziehen(B(), beruf, $('#thm').value, 10, Date.now() % 100000); ant = qs.map(() => -1); pos = 0; fertig = false; frage(); };
  }
  function frage() {
    const out = $('#out');
    if (pos >= qs.length) {
      const r = core.auswerten(qs, ant);
      out.innerHTML = '<div class="card"><h2>' + r.richtig + ' von ' + r.gesamt + ' richtig (' + r.pct + ' %)</h2>' + qs.map((q, i) => '<div class="rl ' + (ant[i] === q.r ? 'ok' : 'no') + '"><b>' + (ant[i] === q.r ? '✓ ' : '✗ ') + esc(q.q) + '</b><br>Richtig: ' + esc(q.opts[q.r]) + (ant[i] !== q.r && ant[i] >= 0 ? '<br>Deine Antwort: ' + esc(q.opts[ant[i]]) : '') + '<div class="mute">' + esc(q.w) + '</div></div>').join('') + '</div><p><button type="button" class="btn" id="neu">Noch einmal</button></p>';
      $('#neu').onclick = wahl; return;
    }
    const q = qs[pos];
    out.innerHTML = '<div class="card"><p class="mute">Frage ' + (pos + 1) + ' von ' + qs.length + '</p><h2 class="fr">' + esc(q.q) + '</h2>' + q.opts.map((o, i) => '<button type="button" class="opt" data-i="' + i + '">' + esc(o) + '</button>').join('') + '</div>';
    out.querySelectorAll('.opt').forEach(b => b.onclick = () => { ant[pos] = +b.dataset.i; pos++; frage(); });
  }
  function init() { beruf = stdBeruf(); if (!B() || !B().themenFuer) { $('#out').textContent = 'Fragenbank nicht geladen.'; return; } wahl(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
