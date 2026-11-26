/* Versionsanzeige unten rechts über der Werkzeugleiste, auf der Startseite oben rechts. Bei jedem Release zusammen mit CACHE in sw.js erhöhen. */
(function () {
  var V = 'v69.192';   // 69 = Anzahl der Labs, 192 = laufende Nummer des Releases
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

  /* Neue Version: Die App öffnet immer sofort aus dem Offline-Speicher. Liegt eine neue Version fertig bereit (Service Worker wartet),
     erscheint oben ein gut sichtbarer Knopf. Erst das Antippen lädt sie. Sind alle Fenster zu, gilt sie beim nächsten Öffnen von selbst. */
  var SW = navigator.serviceWorker, hatte = false, wollte = false;
  function knopf(reg, fertig) {
    if (!document.body) return;
    var b = document.getElementById('verNeu');
    if (!b) {
      var st = document.createElement('style');
      st.textContent = '#verNeu{position:fixed;left:0;right:0;margin:0 auto;width:max-content;top:calc(8px + env(safe-area-inset-top,0px));z-index:2147483600;display:flex;align-items:stretch;max-width:calc(100vw - 24px);border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.45);font:700 15px/1.25 system-ui,-apple-system,sans-serif}' +
        '#verNeu button{min-height:48px;border:0;margin:0;cursor:pointer;font:inherit}#verNeu .vn-j{padding:8px 16px;background:#f0883e;color:#16110a;text-align:left}#verNeu .vn-s{padding:8px 14px;background:#252d36;color:#e8eaed;font-weight:600}' +
        '#verNeu button:focus-visible{outline:3px solid #fff;outline-offset:-3px}@media print{#verNeu{display:none}}';
      document.head.appendChild(st);
      b = document.createElement('div'); b.id = 'verNeu'; b.setAttribute('role', 'status');
      b.innerHTML = '<button type="button" class="vn-j"></button><button type="button" class="vn-s">Später</button>';
      document.body.appendChild(b);
      b.querySelector('.vn-s').addEventListener('click', function () { b.remove(); });
    }
    var j = b.querySelector('.vn-j');
    j.textContent = fertig ? 'Neue Version ist da. Tippen zum Neuladen' : 'Neue Version bereit. Tippen zum Laden';
    j.onclick = function () {
      j.textContent = 'Lädt …'; wollte = true;
      if (!fertig && reg && reg.waiting) { try { reg.waiting.postMessage({ type: 'LAB_UPDATE' }); } catch (e) {} setTimeout(function () { location.reload(); }, 4000); }
      else location.reload();
    };
  }
  function schau(reg) { if (reg && reg.waiting && SW.controller) knopf(reg, false); }
  function horch(reg, n) { if (n) n.addEventListener('statechange', function () { if (n.state === 'installed') schau(reg); }); }
  if (SW && SW.getRegistration && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    hatte = !!SW.controller;
    SW.addEventListener('controllerchange', function () { if (wollte) location.reload(); else if (hatte) knopf(null, true); hatte = true; });   // anderes Fenster hat die neue Version geladen
    SW.getRegistration().then(function (reg) {
      if (!reg) return;
      schau(reg); horch(reg, reg.installing);
      reg.addEventListener('updatefound', function () { horch(reg, reg.installing); });
      var frag = function () { try { var p = reg.update(); if (p && p.catch) p.catch(function () {}); } catch (e) {} };
      frag();   // eine einzige kleine Anfrage je Seite: Gibt es eine neue Version?
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { frag(); schau(reg); } });
    }).catch(function () {});
  }
})();
