'use strict';
/* Pi-Lab: Pins-Ansicht (GPIO-Pinleiste mit Zustand) und Signal-Zeitdiagramm. Logik und Bilder stehen in mcuviz.js. */
(function (root) {
  const go = () => { if (root.McuViz) root.McuViz.attach('pi'); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})(window);
