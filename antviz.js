'use strict';
/* Tonfunk Antriebs-Lab: Darstellungs-Ergaenzung (antviz.js, window.ANT_VIZ bzw. module.exports). Reine Anzeige, offline, keine Bibliothek.
   - Lupe fuer den Pruefstand: Auf dem Handy ist die Pruefstand-Zeichnung (1000 x 560 Einheiten) auf ca. 345 px verkleinert, die kleine Beschriftung
     ist dort kaum lesbar. Der Knopf "Vergroessern" (nur unter 700 px Breite) holt dasselbe Zeichenfeld in eine Vollbildansicht, in der es etwa 2,6-fach
     gross ist und mit dem Finger verschoben werden kann. Schalter und Tasten am Pruefstand funktionieren dort unveraendert.
   Aufgaben-, Trainer- und Pruefbereiche werden nicht beruehrt. Farben nur ueber CSS-Variablen der Seite; Bewegung entfaellt bei prefers-reduced-motion.
   Haengt sich per MutationObserver an die vorhandene Seite; Reiter-/Eingabe-IDs der Seite bleiben unveraendert. */
(function (root) {
  const CSS = `.vz-bar{display:none;margin:6px 0 0}
@media (max-width:699px){.vz-bar{display:flex;justify-content:flex-end}}
.vz-btn{min-height:44px;min-width:44px;padding:0 16px;border-radius:22px;background:var(--panel2);border:1px solid var(--line);color:var(--fg);font-weight:700;font-size:14px;display:inline-flex;align-items:center;gap:8px;touch-action:manipulation}
.vz-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
#vzOv{position:fixed;inset:0;z-index:160;background:var(--bg);display:flex;flex-direction:column;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
#vzOv .vz-top{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--panel);border-bottom:1px solid var(--line)}
#vzOv .vz-top span{flex:1;min-width:0;font-size:13px;color:var(--mute);line-height:1.3}
#vzOv .vz-sc{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:10px}
#vzOv #cvw{width:900px;max-width:none;max-height:none;flex:none}
#vzOv #cvw canvas{touch-action:pan-x pan-y}
@media (prefers-reduced-motion:no-preference){#vzOv{animation:vzIn .18s ease-out}@keyframes vzIn{from{opacity:0}to{opacity:1}}}`;
  const ZOOM_W = 900;
  /* Breite des vergroesserten Zeichenfelds: ca. 2,6-fach gegenueber dem Handy-Feld, aber nie unter 700 und nie ueber 1200 px */
  function zoomWidth(viewW) { const v = Number(viewW); if (!isFinite(v) || v <= 0) return ZOOM_W; return Math.max(700, Math.min(1200, Math.round(v * 2.4))); }
  /* Blendet die Lupe nur auf schmalen Bildschirmen ein */
  const zoomUseful = w => Number(w) < 700;

  function inject() { if (typeof document === 'undefined' || document.getElementById('vzCss')) return; const s = document.createElement('style'); s.id = 'vzCss'; s.textContent = CSS; document.head.appendChild(s); }

  let ov = null, ph = null, home = null;
  function openZoom() {
    const cvw = document.getElementById('cvw'); if (!cvw || ov) return;
    home = cvw.parentNode; ph = document.createElement('div'); ph.style.height = cvw.offsetHeight + 'px'; ph.setAttribute('aria-hidden', 'true'); home.insertBefore(ph, cvw);
    ov = document.createElement('div'); ov.id = 'vzOv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Prüfstand vergrößert');
    ov.innerHTML = '<div class="vz-top"><button class="vz-btn" id="vzClose" type="button">✕ Schließen</button><span>Mit dem Finger wischen, um die Ansicht zu verschieben. Schalter und Tasten gehen wie gewohnt.</span></div><div class="vz-sc" id="vzSc"></div>';
    document.body.appendChild(ov); const sc = ov.querySelector('#vzSc'); sc.appendChild(cvw); cvw.style.width = zoomWidth(window.innerWidth) + 'px';
    ov.querySelector('#vzClose').addEventListener('click', closeZoom); document.addEventListener('keydown', onKey);
    ov.querySelector('#vzClose').focus();
  }
  function onKey(e) { if (e.key === 'Escape') closeZoom(); }
  function closeZoom() {
    if (!ov) return; const cvw = document.getElementById('cvw');
    if (cvw && home) { cvw.style.width = ''; home.insertBefore(cvw, ph); }
    if (ph && ph.parentNode) ph.parentNode.removeChild(ph); ov.parentNode.removeChild(ov); ov = ph = home = null; document.removeEventListener('keydown', onKey);
    const b = document.getElementById('vzOpen'); if (b) b.focus();
  }
  function mountBar() {
    const cvw = document.getElementById('cvw'); if (!cvw || document.getElementById('vzBar') || ov) return;
    const bar = document.createElement('div'); bar.className = 'vz-bar'; bar.id = 'vzBar';
    bar.innerHTML = '<button class="vz-btn" id="vzOpen" type="button" aria-label="Prüfstand vergrößert anzeigen">🔍 Vergrößern</button>';
    cvw.parentNode.insertBefore(bar, cvw.nextSibling); bar.querySelector('#vzOpen').addEventListener('click', openZoom);
  }
  function init() {
    if (typeof document === 'undefined') return; inject(); mountBar();
    if (typeof MutationObserver !== 'undefined') new MutationObserver(() => { mountBar(); }).observe(document.body, { childList: true, subtree: true });
  }
  const API = { zoomWidth, zoomUseful, CSS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.ANT_VIZ = API;
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
