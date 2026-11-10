'use strict';
/* CodeLab: Pins-Ansicht (Arduino-Board-Skizze mit Zustand, LED und Taster live) und Signal-Zeitdiagramm. Logik und Bilder stehen in mcuviz.js. */
(function (root) {
  const go = () => { if (root.McuViz) root.McuViz.attach('ard'); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})(window);
