'use strict';
/* Tonfunk Lab: Karriere-Modus „Vom Azubi zum Prüfungsbesten“, nur Daten (kein DOM, keine Logik).
   Meilensteine verweisen auf Kampagnen-Kapiteltitel (kampagne.js); ein Test prüft, dass jeder Titel in Kampagne.CH existiert.
   Spezialaufgaben sind Verweise auf vorhandene Aufgaben/Funktionen, keine neuen Aufgaben. Story: Meister Funk, kurz und sachlich. */
(function (root) {
  const LEVELS = [
    { n: 1, t: 'Neuling', xp: 0, kap: [], frei: 'Trainer SchaltLab und LochLab', story: 'Erster Tag. Lötkolben, Zettel, los.' },
    { n: 2, t: 'Werkstatt-Azubi', xp: 150, kap: ['Willkommen in der Lehrwerkstatt'], frei: 'Escape-Room, Blitz-Duell Rechnen', story: 'Du kennst die Werkstatt. Jetzt zeig, dass du eine Schaltung zum Leuchten bringst.' },
    { n: 3, t: 'Schaltungsbauer', xp: 400, kap: ['Die Notleuchte', 'Licht nur im Dunkeln'], frei: 'Prüfungs-Duell Stufe 1', story: 'Die Notleuchte brennt. Wer bauen kann, muss auch finden können, was nicht geht.' },
    { n: 4, t: 'Messtechniker', xp: 800, kap: ['Messen wie ein Profi'], frei: 'Spezialaufgabe Wheatstone-Brücke, Duell im MessLab', story: 'Raten kostet Zeit, messen kostet Sekunden. Du misst jetzt zuerst.' },
    { n: 5, t: 'Prüfer', xp: 1300, kap: ['Der Prüfdienst'], frei: 'Prüfungs-Duell Stufe 2, Meisterstück Prüfdienst', story: 'Bevor ein Gerät zum Kollegen geht, wird es geprüft. Das ist jetzt dein Job.' },
    { n: 6, t: 'Geselle in spe', xp: 2000, kap: ['Das Netzteil-Rätsel', 'Der Verstärker'], frei: 'Meisterstücke Netzteil und Verstärker', story: 'Netzteil und Verstärker laufen. Jetzt die Königsdisziplin: der Fehler, den keiner sieht.' },
    { n: 7, t: 'Anlagentechniker', xp: 3000, kap: ['Die Anlage steht still', 'Der Antrieb'], frei: 'Prüfungs-Duell Stufe 3, Verbundprojekte', story: 'Die Anlage läuft. Von hier an liefert jede Station der nächsten.' },
    { n: 8, t: 'Prüfungskandidat', xp: 4500, kap: ['Die Abschlussprüfung'], frei: 'Generalprobe', story: 'Der Prüfungsbogen liegt auf dem Tisch. Übe wie in der Kammer: Zeit, Abgabe, Note.' },
    { n: 9, t: 'Geselle', xp: 6000, kampagne: true, frei: 'Epilog, Urkunde „Abschlussgerät“', story: 'Das Abschlussgerät steht. Jetzt noch die Generalprobe mit Note 2 oder besser.' },
    { n: 10, t: 'Prüfungsbester', xp: 7500, kampagne: true, gpNote: 2, frei: 'Urkunde „Prüfungsbester“', story: 'Du hast die Werkstatt hinter dir und die Prüfung vor dir, und du bist bereit.' }
  ];
  /* Spezialaufgaben: Verweise. ab = Rang, ab dem sie frei sind. Nur Ids, die in AUFGABEN existieren (Test).
     Die Ids el14/el16/el23 aus der Spec sind keine Fehlersuchen (RCD/Isolation) und bleiben draußen; die Duell-Zusatzliste ist Sache von duell.js. */
  const SPECIALS = [
    { k: 'escape', ab: 2, t: 'Escape-Room im SchaltLab' },
    { k: 'duell', st: 1, ab: 3, t: 'Prüfungs-Duell Stufe 1' },
    { k: 'task', id: 'm22', ab: 4, t: 'Wheatstone-Brücke abgleichen' },
    { k: 'duell', st: 2, ab: 5, t: 'Prüfungs-Duell Stufe 2' },
    { k: 'task', id: 'el32', ab: 5, t: 'Meisterstück: Der Prüfdienst' },
    { k: 'task', id: 'nt32', ab: 6, t: 'Meisterstück: Das Netzteil des Kollegen' },
    { k: 'task', id: 'ae32', ab: 6, t: 'Meisterstück: Fehler finden, Stufe auslegen und messen' },
    { k: 'duell', st: 3, ab: 7, t: 'Prüfungs-Duell Stufe 3' },
    { k: 'verbund', ab: 7, t: 'Verbundprojekte' },
    { k: 'gp', ab: 8, t: 'Generalprobe' }
  ];
  /* XP-Regeln: alles Daten. tipp = Abzug je Tipp auf die Aufgaben-XP, gilt NUR im Karriere-Kontext (Üben bleibt tippfrei). */
  const XP = {
    aufgabe: 10,            // je Aufgaben-Level (1 bis 3), bei 100 %
    ohneTipp: 5,            // Bonus: 100 % ohne Tipp
    tipp: 5,                // Abzug je Tipp (gleicher Wert wie W.tipp im Duell), Aufgaben-XP nie unter 0
    abzeichen: 25,
    kapitel: 60,
    trainer: 20,
    pruefung: { 1: 160, 2: 110, 3: 70, 4: 40 }, pruefungMax: 5,   // Note -> XP, beste fünf Prüfungen (kind exam)
    duellGespielt: 10, duellGewonnen: 15, duellProWoche: 20,
    verbund: 150, verbundGold: 50
  };
  /* Generalprobe: Anbindung an das Prüfungs-Lab (Kammeraufbau, Teil 2), kein eigener Prüfungsmotor */
  const GP = {
    ab: 8, art: 'kammer', teil: 2, min: 105, pause: false, formelsammlung: false,
    url: 'pruefungslab.html?tab=pruefung&art=kammer&teil=2&gp=1&seed=',   // Seed: Jahrgang + '-' + Kalenderwoche
    seedRegel: 'jahrgang-kw', zeitAusPruefexam: 'suggestLimit',
    notePruefungsbester: 2, wiederholung: true
  };
  const XPKEY = { aufgaben: 'Aufgaben', abzeichen: 'Abzeichen', kapitel: 'Kapitel', trainer: 'Trainer', pruefungen: 'Prüfungen', duelle: 'Duelle', verbund: 'Verbundprojekte' };
  const D = { LEVELS, SPECIALS, XP, GP, XPKEY, VERBUND_AGG: ['vbfertig', 'vbprofi', 'vbgold'], VERBUND_PIDS: ['vbgarage', 'vbampel', 'vbuhr', 'vbgiess', 'vbfoerder'] };
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
  root.KarriereData = D;
})(typeof window !== 'undefined' ? window : globalThis);
