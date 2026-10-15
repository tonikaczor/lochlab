/* Tonfunk Lab: Tastenkürzel für alle Editoren (LochLab, SchaltLab, SimLab, Arduino-Lab, Pi-Lab).
   Jede Seite meldet sich mit install(adapter) an und liefert die Aktionen (Werkzeug wählen, Bauteil wählen, drehen, ...).
   Hier stehen nur die Belegungen. Eine Taste pro Bauteil, mit Umschalt (Shift) für die zweite Variante. Die Hilfe öffnet mit „?“. */
(function () {
'use strict';

/* Belegungen: key -> Bauteil bzw. Werkzeug. lab: nur in diesen Labs ('loch','sch','sim','code','pi'), sonst überall. */
const PARTS = {
  loch: [
    ['r', 'R', 'Widerstand'], ['p', 'P', 'Poti'], ['c', 'C', 'Kondensator'], ['e', 'CE', 'Elko'], ['d', 'D', 'Diode'], ['l', 'LED', 'LED'], ['t', 'T', 'Transistor'],
    ['g', 'GL', 'Brückengleichrichter'], ['u', 'U', 'Spannungsregler'], ['i', 'IC', 'IC (DIP)'], ['k', 'RLY', 'Relais'], ['s', 'SW', 'Taster'], ['b', 'BAT', 'Spannungsquelle'], ['f', 'FUSE', 'Sicherungshalter'], ['L', 'L', 'Spule'], ['T', 'TRF', 'Trafo'],
  ],
  sch: [
    ['r', 'R', 'Widerstand'], ['p', 'POT', 'Poti'], ['c', 'C', 'Kondensator'], ['e', 'CE', 'Elko'], ['L', 'L', 'Spule'], ['d', 'D', 'Diode'], ['z', 'ZD', 'Z-Diode'], ['l', 'LED', 'LED'], ['t', 'NPN', 'NPN-Transistor'], ['T', 'PNP', 'PNP-Transistor'],
    ['b', 'BAT', 'Gleichspannung'], ['a', 'AC', 'Wechselspannung'], ['g', 'GND', 'Masse'], ['s', 'SPST', 'Schalter'], ['k', 'PB', 'Taster'], ['v', 'VM', 'Voltmeter'], ['i', 'AM', 'Amperemeter'], ['o', 'OPA', 'Operationsverstärker'], ['u', 'REG', 'Spannungsregler'],
  ],
  sim: [
    ['n', 'NETZ', 'Netz 230 V'], ['a', 'LSS', 'Sicherungsautomat'], ['f', 'RCD', 'FI-Schutzschalter'], ['s', 'SPST', 'Schalter'], ['k', 'PB', 'Taster'], ['l', 'LAMP', 'Glühlampe'], ['h', 'HEAT', 'Heizlüfter'], ['m', 'MOTOR3', 'Drehstrommotor'],
    ['c', 'CABLE', 'Leitung'], ['v', 'VM', 'Voltmeter'], ['i', 'AM', 'Amperemeter'], ['o', 'OHM', 'Durchgangsprüfer'], ['O', 'ISO', 'Isolationsmessgerät'], ['y', 'ZS', 'Schleifenimpedanz'], ['r', 'R', 'Widerstand'], ['d', 'D', 'Diode'], ['b', 'BAT', 'Gleichspannung'], ['g', 'GND', 'Masse'],
  ],
  code: [
    ['u', 'UNO', 'Arduino Uno'], ['r', 'R', 'Widerstand'], ['l', 'LED', 'LED'], ['p', 'POT', 'Poti'], ['s', 'SPST', 'Schalter'], ['k', 'PB', 'Taster'], ['c', 'C', 'Kondensator'], ['d', 'D', 'Diode'], ['t', 'NPN', 'Transistor'], ['b', 'BAT', 'Gleichspannung'], ['g', 'GND', 'Masse'], ['v', 'VM', 'Voltmeter'], ['i', 'AM', 'Amperemeter'],
  ],
  pi: [
    ['u', 'PI', 'Raspberry Pi'], ['r', 'R', 'Widerstand'], ['l', 'LED', 'LED'], ['p', 'POT', 'Poti'], ['s', 'SPST', 'Schalter'], ['k', 'PB', 'Taster'], ['c', 'C', 'Kondensator'], ['d', 'D', 'Diode'], ['t', 'NPN', 'Transistor'], ['b', 'BAT', 'Gleichspannung'], ['g', 'GND', 'Masse'], ['v', 'VM', 'Voltmeter'], ['i', 'AM', 'Amperemeter'],
  ],
};
const TOOLS = {
  loch: [['v', 'select', 'Auswahl'], ['h', 'hand', 'Schieben'], ['w', 'wire', 'Draht (Brücke)'], ['.', 'track', 'Lötbahn (Silberdraht)'], [',', 'dot', 'Lötpunkt (Lötzinn)'], ['n', 'text', 'Text'], ['x', 'erase', 'Löschen']],
  sch: [['w', 'wire', 'Draht'], ['x', 'erase', 'Löschen'], ['Escape', 'select', 'Auswahl']],
};
TOOLS.sim = TOOLS.sch; TOOLS.code = TOOLS.sch; TOOLS.pi = TOOLS.sch;
const OTHER = {
  loch: [['Eingabe oder F5', 'Simulation ein / aus (zwischen Bauen und Simulieren wechseln)'], ['Leertaste', 'Bauteil drehen'], ['Strg + Z', 'Rückgängig'], ['Strg + Umschalt + Z', 'Wiederholen'], ['Entf', 'Auswahl löschen'], ['Strg + D', 'Auswahl kopieren'], ['M', 'Ansicht: Beide / Oben / Unten'], ['F oder Pos1', 'Platine einpassen'], ['/', 'Bauteil suchen'], ['Esc', 'Abbrechen, Auswahl aufheben'], ['?', 'Diese Übersicht']],
  sch: [['Eingabe oder F5', 'Simulation ein / aus (zwischen Bauen und Simulieren wechseln)'], ['Tab', 'Bauteil drehen'], ['Strg + Z', 'Rückgängig'], ['Strg + Umschalt + Z', 'Wiederholen'], ['Entf', 'Auswahl löschen'], ['Strg + D', 'Auswahl kopieren'], ['Leertaste', 'Simulation starten und anhalten'], ['Pos1', 'Schaltung einpassen'], ['/', 'Bauteil suchen'], ['Esc', 'Abbrechen, Auswahl aufheben'], ['?', 'Diese Übersicht']],
};
OTHER.sim = OTHER.sch; OTHER.code = OTHER.sch; OTHER.pi = OTHER.sch;

let A = null;
const typing = e => { const t = e.target; return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); };
function onKey(e) {
  if (!A || typing(e) || e.altKey) return;
  if (document.querySelector('.backdrop')) { if (e.key === '?' ) { /* Hilfe schon offen */ } return; }       // offenes Blatt: keine Kürzel
  const k = e.key, mod = e.ctrlKey || e.metaKey;
  if (mod) { if (k.toLowerCase() === 'd' && A.dup) { e.preventDefault(); A.dup(); } return; }
  if (k === '?') { e.preventDefault(); help(); return; }
  if (k === '/' && A.search) { e.preventDefault(); A.search(); return; }
  if (A.sim && ((k === 'Enter' && (e.target === document.body || e.target.tagName === 'CANVAS')) || k === 'F5')) { e.preventDefault(); A.sim(); return; }
  if (A.rotateKey && k === A.rotateKey) { e.preventDefault(); A.rotate(); return; }
  if ((k === 'Home' || (A.lab === 'loch' && (k === 'f' || k === 'F'))) && A.fit) { e.preventDefault(); A.fit(); return; }
  if (A.lab === 'loch' && (k === 'm' || k === 'M') && A.mode) { e.preventDefault(); A.mode(); return; }
  if (A.busy && A.busy()) return;
  const tl = (TOOLS[A.lab] || []).find(t => t[0] === k);
  if (tl) { e.preventDefault(); A.tool(tl[1]); return; }
  const pt = (PARTS[A.lab] || []).find(p => p[0] === k && p[1] && (!A.has || A.has(p[1])));
  if (pt) { e.preventDefault(); A.part(pt[1]); if (A.toast) A.toast(pt[2] + ' wählen: auf die Fläche tippen oder klicken'); }
}
function help() {
  if (!A || !A.sheet) return;
  const key = s => `<kbd style="display:inline-block;min-width:22px;text-align:center;padding:1px 6px;border:1px solid var(--line,#38424d);border-bottom-width:2px;border-radius:5px;background:var(--panel2,#2c343e);font:600 12px monospace">${A.esc(s)}</kbd>`;
  const rows = a => a.map(r => `<tr><td style="white-space:nowrap;padding:3px 10px 3px 0">${key(r[0])}</td><td>${A.esc(r[1])}</td></tr>`).join('');
  const tools = (TOOLS[A.lab] || []).map(t => [t[0] === 'Escape' ? 'Esc' : t[0].toUpperCase() === t[0] && t[0].length === 1 && /[a-z]/i.test(t[0]) ? t[0] : t[0], t[2]]);
  const parts = (PARTS[A.lab] || []).filter(p => p[1] && (!A.has || A.has(p[1]))).map(p => [p[0].length === 1 && p[0] === p[0].toUpperCase() && /[A-Z]/.test(p[0]) ? 'Umschalt + ' + p[0] : p[0].toUpperCase(), p[2]]);
  A.sheet('Tastenkürzel', b => {
    b.innerHTML = `<p style="margin-top:0;color:var(--mute,#8d99a6)">Beim Bauen geht vieles schneller mit der Tastatur. Taste drücken, dann auf die Fläche klicken. Die Kürzel gelten nicht, solange ein Eingabefeld aktiv ist.</p>
      <h4 style="margin:10px 0 4px">Werkzeuge</h4><table>${rows(tools)}</table>
      <h4 style="margin:10px 0 4px">Bauteile einfügen</h4><table>${rows(parts)}</table>
      <h4 style="margin:10px 0 4px">Bearbeiten und Ansicht</h4><table>${rows(OTHER[A.lab] || [])}</table>`;
  });
}
window.LochKeys = {
  install(adapter) { A = adapter; if (!install.done) { window.addEventListener('keydown', onKey); install.done = true; } },
  help, PARTS, TOOLS, OTHER,
};
const install = window.LochKeys.install; install.done = false;
if (window.LabKeysAdapter) window.LochKeys.install(window.LabKeysAdapter);
})();
