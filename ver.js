/* Versionsanzeige unten rechts über der Werkzeugleiste, auf der Startseite oben rechts. Bei jedem Release zusammen mit CACHE in sw.js erhöhen. */
(function () {
  var V = 'v5.112';   // 5 = Anzahl der Labs, 103 = laufende Versionsnummer
  window.LAB_VERSION = V;
  window.LabNeu = function () { if (window.WhatsNew) { window.WhatsNew.open(); return; } var s = document.createElement('script'); s.src = 'neu.js'; s.onload = function () { window.WhatsNew && window.WhatsNew.open(); }; document.head.appendChild(s); };   // „Neu in dieser Version“ (neu.js wird erst beim Öffnen geladen)
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
    st.textContent = '#verBadge{position:fixed;right:10px;bottom:3px;z-index:3;font:700 11px/1 system-ui,sans-serif;letter-spacing:.04em;color:#e3eaf1;background:rgba(14,17,21,.78);padding:4px 8px;border-radius:8px;cursor:pointer;user-select:none}@media print{#verBadge{display:none}}';
    document.head.appendChild(st);
    d = document.createElement('div'); d.id = 'verBadge'; d.textContent = 'Tonfunk Lab ' + V; d.title = 'Antippen: Was ist neu?'; d.addEventListener('click', function () { window.LabNeu(); });
    document.body.appendChild(d); place();
    window.addEventListener('resize', place); window.addEventListener('load', place); setTimeout(place, 600);
  }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
