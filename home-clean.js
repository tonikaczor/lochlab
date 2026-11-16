'use strict';
/* Tonfunk Lab: Startseite aufgeräumt (v50.166, seit dem Umbau in fünf Ansichten S1 ohne Klappbalken).
   Früher: einklappbare Bänder (lm4.home.duell, lm4.home.foot, lm4.home.studium, lm4.home.ausbildung, lm4.home.meinweg) und Knöpfe zum Auf- und Zuklappen aller Bereiche. Diese Schlüssel
   bleiben im Speicher, werden aber nicht mehr gebraucht; die Ansicht der Karten (lm4.home.kompakt) schaltet jetzt home.js.
   Heute: Bausteine fremder Skripte, die sich selbst irgendwo auf der Seite einhängen, an ihren Platz in den Ansichten setzen:
   - Offline-Block (#offlineStatus, offline-status.js) und Urheberhinweis (#urheber-hinweis, urheber.js) in die Ansicht "Ich" unter "Dieses Gerät" bzw. ans Ende,
   - das Duell-Band (#duellBand, duellui.js) bleibt verdeckt in "Üben": seine Knöpfe lösen die Zeilen Duell, Fehler-Tausch und Wettbewerb aus (home-views.js).
   ziel() ist reine Logik (Node-Test quelle/home/test_home_clean.js). Ohne dieses Skript bleiben die Bausteine am Seitenende stehen. */
(function (root) {
  /* wohin gehört welcher Baustein: [ID, Ziel-ID, Art] (Art 'in' = als letztes Kind ins Ziel, 'vor' = vor das Ziel) */
  const ZIELE = [['offlineStatus', 'ichOffline', 'in'], ['urheber-hinweis', 'v-ich', 'in'], ['duellBand', 'vbRow', 'vor']];
  function ziel(id) { const z = ZIELE.find(x => x[0] === id); return z ? { nach: z[1], art: z[2] } : null; }
  if (typeof module === 'object' && module.exports) module.exports = { ZIELE, ziel };
  if (typeof document === 'undefined') return;
  const doc = document;
  function setzen() {
    let fertig = 0;
    ZIELE.forEach(z => {
      const el = doc.getElementById(z[0]), to = doc.getElementById(z[1]); if (!el || !to) return;
      if (z[2] === 'in') { if (el.parentNode !== to) to.appendChild(el); }
      else if (el.nextElementSibling !== to) to.parentNode.insertBefore(el, to);
      if (z[0] === 'duellBand') el.hidden = true;
      fertig++;
    });
    return fertig === ZIELE.length;
  }
  setzen();
  /* die Bausteine entstehen erst nach dem Laden (offline-status.js mit defer, duellui.js wird nachgeladen) */
  let n = 0; const t = setInterval(() => { if (setzen() || ++n > 40) clearInterval(t); }, 250);
  root.addEventListener('load', setzen);
})(typeof window !== 'undefined' ? window : this);
