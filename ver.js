/* Versionsanzeige unten rechts über der Werkzeugleiste, auf der Startseite oben rechts. Bei jedem Release zusammen mit CACHE in sw.js erhöhen. */
(function () {
  var V = 'v5.85';   // 5 = Anzahl der Labs, 85 = laufende Versionsnummer
  window.LAB_VERSION = V;
  var d;
  function place() {
    if (!d) return;
    if (document.querySelector('.cards')) { d.style.bottom = 'auto'; d.style.top = 'calc(8px + env(safe-area-inset-top))'; return; }   // Startseite: oben rechts
    var bar = document.getElementById('nav') || document.getElementById('pal'), b = 3;
    if (bar) { var r = bar.getBoundingClientRect(); if (r.height > 0 && r.top > window.innerHeight / 2) b = Math.round(window.innerHeight - r.top + 3); }
    d.style.bottom = b + 'px';
  }
  function add() {
    if (document.getElementById('verBadge')) return;
    var st = document.createElement('style');
    st.textContent = '#verBadge{position:fixed;right:10px;bottom:3px;z-index:3;font:600 10px/1 system-ui,sans-serif;letter-spacing:.04em;color:#9aa6b2;opacity:.65;pointer-events:none;user-select:none}@media print{#verBadge{display:none}}';
    document.head.appendChild(st);
    d = document.createElement('div'); d.id = 'verBadge'; d.textContent = 'Tonfunk Lab ' + V;
    document.body.appendChild(d); place();
    window.addEventListener('resize', place); window.addEventListener('load', place); setTimeout(place, 600);
  }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
