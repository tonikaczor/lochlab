/* Urheberrechtshinweis - wird auf jeder Seite unten eingeblendet */
(function () {
  function add() {
    if (document.getElementById('urheber-hinweis')) return;
    var d = document.createElement('div');
    d.id = 'urheber-hinweis';
    d.style.cssText = 'margin:24px auto 12px;padding:8px 12px;max-width:900px;text-align:center;font:11px/1.4 system-ui,sans-serif;color:#889;opacity:.85';
    d.innerHTML = '&copy; 2026 Toni Kaczor / Tonfunk GmbH Ermsleben &ndash; Alle Rechte vorbehalten. Weitergabe, Vervielf&auml;ltigung und Ver&ouml;ffentlichung nur durch den Urheber bzw. mit dessen schriftlicher Zustimmung.';
    (document.body || document.documentElement).appendChild(d);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
