'use strict';
/* Tonfunk Lab <-> Lernplattform (ILIAS): dezenter Rueck-Link am Seitenende.
   Zeigt zu jedem Lab die passenden Lernfeld-Kurse auf der ILIAS-Testinstanz an.
   Tut nichts Unsichtbares: kein Tracking, kein Request, nur ein paar <a>-Links.
   Pflege: LAB_LF unten anpassen, wenn Toni/Eric die Zuordnung aendern. */
(function () {
  var ILIAS_BASE = 'http://ilias-test.trapi.tonfunk.de/goto.php/crs/';

  var LF_TITLE = {
    1: 'LF01 – Grundlagen Elektrotechnik',
    2: 'LF02 – Elektrische Installationen',
    3: 'LF03 – Steuerungen analysieren und anpassen',
    4: 'LF04 – Informationstechnische Systeme',
    5: 'LF05 – Elektroenergieversorgung',
    6: 'LF06 – Elektronische Baugruppen',
    7: 'LF07 – Baugruppen konfigurieren',
    8: 'LF08 – Geraete herstellen und pruefen',
    9: 'LF09 – Geraete und Systeme instand halten',
    10: 'LF10 – Fertigungsanlagen einrichten',
    11: 'LF11 – Pruefsysteme einrichten und anwenden',
    12: 'LF12 – Geraete und Systeme planen und realisieren',
    13: 'LF13 – Fertigungs- und Pruefsysteme instand halten'
  };
  var LF_REF = { 1: 240, 2: 301, 3: 250, 4: 253, 5: 256, 6: 259, 7: 262, 8: 265, 9: 268, 10: 271, 11: 274, 12: 277, 13: 281 };

  /* Freiwillige Abgabe-Uebung je Lernfeld (ILIAS-Objekt, Typ exc) */
  var LF_EXC = { 1: 434, 2: 435, 3: 436, 4: 437, 5: 438, 6: 439, 7: 440, 8: 441, 9: 442, 10: 443, 11: 444, 12: 445, 13: 446 };
  var EXC_BASE = 'http://ilias-test.trapi.tonfunk.de/goto.php/exc/';

  /* Datei -> Liste der passenden Lernfelder (Zuordnung Toni/Eric, Stand 30.10.2026) */
  var LAB_LF = {
    'layout.html': [1],
    'schaltplan.html': [1],
    'simlab.html': [1],
    'hauslab.html': [2],
    'elslab.html': [2],
    'digilab.html': [3],
    'spslab.html': [3, 10],
    'reglab.html': [3, 12],
    'appwerkstatt.html': [4],
    'codelab.html': [4],
    'pilab.html': [4],
    'enrlab.html': [5],
    'ntslab.html': [5],
    'wsllab.html': [5],
    'pcblab.html': [6, 8],
    'analab.html': [6],
    'dslab.html': [6, 11],
    'messlab.html': [7, 11],
    'senlab.html': [7],
    'thmlab.html': [8, 9],
    'antlab.html': [9, 12],
    'emvlab.html': [9, 13],
    'pruefungslab.html': [11, 13]
  };

  function currentFile() {
    return (location.pathname.split('/').pop() || '').toLowerCase();
  }
  var lfList = LAB_LF[currentFile()];
  if (!lfList || !lfList.length) return;

  /* Fuer den Dialog "Ergebnis senden": freiwilliger Link zur Abgabe-Uebung. Keine Daten werden uebertragen. */
  window.IliasLinks = {
    exercises: function () {
      return lfList.map(function (lf) { return { lf: lf, title: LF_TITLE[lf], url: EXC_BASE + LF_EXC[lf] }; });
    }
  };

  var css = document.createElement('style');
  css.textContent =
    '#iliasBar{position:relative;margin:18px 10px 10px;padding:8px 12px;border-top:1px solid rgba(255,255,255,.12);' +
    'font:12.5px/1.4 system-ui,sans-serif;color:#8d99a6;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}' +
    '#iliasBar b{color:#8d99a6;font-weight:600;white-space:nowrap}' +
    '#iliasBar a{color:#3b9eff;text-decoration:none;white-space:nowrap}' +
    '#iliasBar a:hover{text-decoration:underline}';
  document.head.appendChild(css);

  function render() {
    var bar = document.createElement('div');
    bar.id = 'iliasBar';
    var label = document.createElement('b');
    label.textContent = 'Lernplattform:';
    bar.appendChild(label);
    lfList.forEach(function (lf, i) {
      if (i > 0) bar.appendChild(document.createTextNode('·'));
      var a = document.createElement('a');
      a.href = ILIAS_BASE + LF_REF[lf];
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = LF_TITLE[lf];
      bar.appendChild(a);
    });
    document.body.appendChild(bar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
