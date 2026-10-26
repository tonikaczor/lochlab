/* enorm.js - die E-Reihen (Normwerte je Dekade) an einer Stelle (Stufe 1 Schlank).
 * Browser: window.ENORM; Node: module.exports. Werte wie in dscore.js (DS_CORE.eSeries) und thmcore.js; die Kerne behalten ihre eigene Kopie,
 * damit sie ohne weitere Datei in Node laufen. Alle UI-/Daten-Dateien, die nur Werte brauchen, lesen hier.
 * Eine Aenderung an einer Reihe ist ein Fachfehler: erst quelle/gen/test_enorm.js und die Kerne pruefen. */
(function (root) {
  'use strict';
  const ENORM = {
    E6: [1.0, 1.5, 2.2, 3.3, 4.7, 6.8],
    E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
    E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ENORM;
  if (root) root.ENORM = ENORM;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
