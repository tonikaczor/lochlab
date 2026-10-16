'use strict';
/* Tonfunk Lab: Kopfleiste nur mit Symbolen. Die Beschriftung erscheint als kleines Schild beim Zeigen (Maus) und beim Antippen. */
(function () {
  if (!document.getElementById('bMenu')) return;
  const css = document.createElement('style');
  css.textContent = 'header .hb span,header .hb2 span,header .watersw .lL span{display:none!important}header .hb,header .hb2{padding:0 11px!important;gap:0!important}header .simsw .lL,header .simsw .lS{font-size:0!important}header .simsw .lL::before{content:"✏️";font-size:15px}header .simsw .lS::before{content:"⚡";font-size:15px}header #bView{font-size:0!important;min-width:38px}header #bView::before{content:attr(data-ic);font-size:18px}header #bOpen,header #bTasks,header #bPrint{display:none!important}header .run{min-width:44px;text-align:center}#hdrTip{position:fixed;z-index:200;background:#10151a;color:#fff;border:1px solid #4a5561;border-radius:8px;padding:6px 10px;font:600 13px/1.2 system-ui,sans-serif;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.5);white-space:nowrap;display:none}';
  document.head.appendChild(css);
  const tip = document.createElement('div'); tip.id = 'hdrTip'; document.body.appendChild(tip);
  const VIEW = { Beide: ['◫', 'Beide Seiten'], Oben: ['▀', 'Bestückungsseite'], Unten: ['▄', 'Lötseite'] };
  const header = document.querySelector('header');
  const label = el => {
    if (el.id === 'bRun') return /⏸/.test(el.textContent) ? 'Simulation stoppen' : 'Simulation starten';
    if (el.id === 'bSim') return 'Zwischen Zeichnen und Simulation umschalten';
    if (el.id === 'bWater') return 'Wasser-Ansicht';
    if (el.id === 'bView') { const t = el.textContent.trim(); return 'Ansicht wechseln: ' + ((VIEW[t] || [])[1] || t); }
    return el.getAttribute('data-tip') || el.getAttribute('aria-label') || el.title || el.textContent.replace(/[^\p{L}\p{N} ]/gu, '').trim();
  };
  const hostOf = t => t && t.closest ? t.closest('header button, header a.ib, header #logo') : null;
  let timer = 0, hideT = 0;
  function show(el, ms) {
    const txt = label(el); if (!txt) return; tip.textContent = txt; tip.style.display = 'block';
    const r = el.getBoundingClientRect(), w = tip.offsetWidth; let x = r.left + r.width / 2 - w / 2; x = Math.max(6, Math.min(innerWidth - w - 6, x)); tip.style.left = Math.round(x) + 'px'; tip.style.top = Math.round(r.bottom + 8) + 'px';
    clearTimeout(hideT); if (ms) hideT = setTimeout(hide, ms);
  }
  function hide() { clearTimeout(timer); clearTimeout(hideT); tip.style.display = 'none'; }
  /* Titel entfernen, damit nicht zusätzlich der Browser-Tipp erscheint; der Text bleibt in data-tip */
  const strip = () => header.querySelectorAll('[title]').forEach(e => { if (!e.dataset.tip) e.dataset.tip = e.title; e.removeAttribute('title'); });
  strip(); new MutationObserver(strip).observe(header, { childList: true, subtree: true, attributes: true, attributeFilter: ['title'] });
  header.addEventListener('mouseover', e => { if (e.pointerType === 'touch') return; const h = hostOf(e.target); if (!h) return; clearTimeout(timer); timer = setTimeout(() => show(h, 0), 300); });
  header.addEventListener('mouseout', e => { if (hostOf(e.target)) hide(); });
  header.addEventListener('pointerdown', e => { const h = hostOf(e.target); if (h) show(h, e.pointerType === 'mouse' ? 1200 : 1600); });
  document.addEventListener('scroll', hide, true);
  /* LochLab: Ansichtswechsler zeigt nur ein Symbol */
  const bv = document.getElementById('bView');
  if (bv) { const upd = () => { const t = bv.textContent.trim(); if (VIEW[t]) bv.dataset.ic = VIEW[t][0]; }; upd(); new MutationObserver(upd).observe(bv, { childList: true, characterData: true, subtree: true }); }
})();
