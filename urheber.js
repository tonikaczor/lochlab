/* Urheberrechtshinweis - wird auf jeder Seite unten eingeblendet */
(function () {
  function add() {
    if (document.getElementById('urheber-hinweis')) return;
    var d = document.createElement('div');
    d.id = 'urheber-hinweis';
    d.style.cssText = 'margin:24px auto 12px;padding:8px 12px;max-width:900px;text-align:center;font:12px/1.4 system-ui,sans-serif;color:var(--mute,#8d99a6)';
    d.innerHTML = '&copy; 2026 Toni Kaczor / Tonfunk GmbH Ermsleben &ndash; Alle Rechte vorbehalten. Weitergabe, Vervielf&auml;ltigung und Ver&ouml;ffentlichung nur durch den Urheber bzw. mit dessen schriftlicher Zustimmung.';
    /* Sprachausgabe-Credits: nur auf Seiten, die die Aufnahmen nutzen (speak.js, Wiki) */
    if (document.querySelector('script[src^="speak.js"],script[src^="wiki.js"]')) {
      var s = document.createElement('div');
      s.id = 'urheber-sprache';
      s.style.cssText = 'margin-top:4px';
      s.innerHTML = 'Sprachausgabe: KI-Stimme, erzeugt mit <a href="https://github.com/resemble-ai/chatterbox" target="_blank" rel="noopener" style="color:inherit">Chatterbox</a> (Resemble AI, MIT-Lizenz) nach einer Aufnahme von Toni Kaczor.';
      d.appendChild(s);
    }
    (document.body || document.documentElement).appendChild(d);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
