'use strict';
/* Tonfunk Lab: Eigenes Lehrjahr einstellen (Paket L2). Nur im Browser, nur für Berufe mit Datenlage (Lehrjahr.gilt: egs, ige).
   1. Ansicht "Ich": Zeile "Mein Lehrjahr" mit vier Knöpfen (1. bis 4.), Hinweistext und "Keine Angabe" (#ichLj in index.html).
   2. Einmal-Frage unter der blauen Karte ("In welchem Lehrjahr bist du?"): ein kleines Blatt im Stil der Hinweiszeilen (.lsfehlt), kein Browser-Dialog, wegklickbar ("Nicht jetzt");
      danach nie wieder (Schlüssel lm4.lehrjahr.frage), erreichbar bleibt die Zeile in "Ich".
      Geräte mit Fortschritt und ohne Lehrjahr: bis zur Antwort bleibt alles wie bisher. Ganz neue Geräte: Vorgabe 1. Lehrjahr.
   Nach jeder Änderung meldet das Skript "lernpfad:lj"; lernpfad.js rechnet dann Karten, blaue Karte und Sortierung neu. Nichts wird gesperrt. */
(function (root) {
  const doc = root.document; if (!doc) return;
  const X = root.Lehrjahr; if (!X) return;
  const $ = id => doc.getElementById(id);
  const beruf = () => { try { return root.BerufReg && root.BerufReg.cur ? root.BerufReg.cur() : 'egs'; } catch (e) { return 'egs'; } };
  const CSS = '.ljfrage{flex-wrap:wrap}.ljfrage .lj-g{display:flex;flex-wrap:wrap;gap:6px;flex:1 1 100%}.ljfrage .lj-b{min-width:44px;padding:0 12px}.ljfrage .lj-x{color:var(--mute)}'
    + '#ichLj:not([hidden]){display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px}#ichLj .vh3{margin:0}#ichLj .lj-note,#ichLj .lj-aus{flex:1 1 100%}#ichLjSeg button{min-width:48px;padding:0 8px}#ichLj .lj-note{margin:8px 0 0;color:var(--mute);font-size:14px;line-height:1.4}#ichLj .lj-aus{margin-top:6px}#ichLj .lj-aus .btn{font-size:14px;min-height:44px}';
  const stil = () => { if ($('ljCss')) return; const s = doc.createElement('style'); s.id = 'ljCss'; s.textContent = CSS; doc.head.appendChild(s); };
  const changed = () => { try { root.dispatchEvent(new Event('lernpfad:lj')); } catch (e) {} };
  const btns = (cur, kl) => [1, 2, 3, 4].map(n => '<button type="button" class="' + kl + '" data-lj="' + n + '" aria-pressed="' + (cur === n ? 'true' : 'false') + '" aria-label="' + n + '. Lehrjahr">' + n + '.</button>').join('');

  /* ---------- Ansicht Ich ---------- */
  function ichZeile() {
    const sec = $('ichLj'); if (!sec) return;
    if (!X.gilt(beruf())) { sec.hidden = true; return; }
    sec.hidden = false; stil();
    const cur = X.mein(), q = X.quelle ? X.quelle() : '', seg = $('ichLjSeg'), note = $('ichLjNote'), aus = $('ichLjAus');
    if (seg) seg.innerHTML = btns(cur, 'lj-bt');
    let t;
    if (cur && q === 'jahrgang') t = 'Aus deinem Jahrgang berechnet: ' + cur + '. Lehrjahr. Tippe ein Lehrjahr an, wenn es nicht stimmt.';
    else if (cur) t = 'Du bist im ' + cur + '. Lehrjahr. Am 1. August zählt es von selbst weiter.';
    else if (X.wirksam()) t = 'Noch nicht angegeben (bis dahin: ' + X.wirksam() + '. Lehrjahr).';
    else t = 'Noch nicht angegeben (der Pfad zeigt alles).';
    if (note) note.textContent = /^Noch nicht/.test(t) ? t : t + ' Nichts wird gesperrt.';
    if (aus) aus.hidden = q !== 'hand';
  }

  /* ---------- Einmal-Frage ---------- */
  function frage() {
    const top = $('top'); let h = $('ljFrage');
    const an = X.gilt(beruf()) && X.frageNoetig();
    if (!an) { if (h) h.remove(); return; }
    if (h || !top || !top.parentNode) return;
    stil();
    const neu = !!X.wirksam();
    h = doc.createElement('div'); h.id = 'ljFrage'; h.className = 'lsfehlt ljfrage'; h.setAttribute('role', 'group'); h.setAttribute('aria-label', 'In welchem Lehrjahr bist du?');
    h.innerHTML = '<span class="lsf-t"><b>In welchem Lehrjahr bist du?</b> Dein Lernpfad zeigt dann zuerst die Aufgaben, die dazu passen. Es wird nichts gesperrt. '
      + (neu ? 'Bis du antwortest, gilt das 1. Lehrjahr. ' : '') + 'Du kannst es später unter „Ich“ ändern.</span>'
      + '<span class="lj-g">' + btns(0, 'lj-b') + '<button type="button" class="lj-x" data-a="zu">Nicht jetzt</button></span>';
    top.insertAdjacentElement('afterend', h);
  }

  doc.addEventListener('click', e => {
    const t = e.target, b = t && t.closest ? t.closest('#ljFrage [data-lj],#ichLj [data-lj],#ljFrage [data-a],#ichLj [data-a]') : null; if (!b) return;
    if (b.dataset.lj) { X.setz(+b.dataset.lj); }
    else if (b.dataset.a === 'zu') { X.frageSchliessen(); }
    else if (b.dataset.a === 'aus') { X.setz(null); }
    frage(); ichZeile(); changed();
  });

  function start() { try { if (X.gilt(beruf())) X.init(); } catch (e) {} frage(); ichZeile(); }
  start();
  root.addEventListener('pageshow', e => { if (e.persisted) start(); });
  root.LehrjahrUI = { frage, ichZeile };
})(typeof window !== 'undefined' ? window : this);
